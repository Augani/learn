# Lesson 05: gRPC & Protocol Buffers

## The Express Mail Analogy

REST with JSON is like sending a letter -- human-readable but bulky.
gRPC with Protocol Buffers is like sending a compressed, barcoded package.
Machines read it faster, it's smaller on the wire, and the format is
enforced at both ends.

```
  REST / JSON:                    gRPC / Protobuf:
  +-------------------+           +-------------------+
  | { "name": "Alice",|           | [binary: 0A 05   |
  |   "age": 30,      |           |  41 6C 69 63 65  |
  |   "email": "..." }|           |  10 1E ...]      |
  +-------------------+           +-------------------+
  ~120 bytes, human-readable      ~25 bytes, machine-optimized
  Parse: ~milliseconds            Parse: ~microseconds
```

## What Is gRPC?

gRPC is a high-performance RPC (Remote Procedure Call) framework from Google.
It uses HTTP/2 and Protocol Buffers by default.

```
  +----------+          HTTP/2           +----------+
  |  Client  | ======================== |  Server  |
  |  (stub)  |   Binary Protobuf msgs   |  (impl)  |
  +----------+          Stream           +----------+
       |                                      |
       |  Generated from same .proto file     |
       +--------------------------------------+
```

## Protocol Buffers: The Schema

A `.proto` file defines your data types and services. It's the single
source of truth -- code is generated from it for any language.

```protobuf
syntax = "proto3";

package userservice;

option go_package = "github.com/example/userservice";

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
  UserRole role = 4;
}

enum UserRole {
  USER_ROLE_UNSPECIFIED = 0;
  USER_ROLE_ADMIN = 1;
  USER_ROLE_MEMBER = 2;
}

message GetUserRequest {
  int32 id = 1;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;
}

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc WatchUsers(WatchRequest) returns (stream User);
}

message WatchRequest {}
```

Those field numbers (= 1, = 2) are wire format identifiers. They make
it possible to evolve the schema without breaking existing clients.

## Four Types of gRPC Communication

```
  1. UNARY (request-response, like REST)
  Client ---[request]---> Server
  Client <--[response]--- Server

  2. SERVER STREAMING (server sends multiple responses)
  Client ---[request]---> Server
  Client <--[msg 1]------ Server
  Client <--[msg 2]------ Server
  Client <--[msg N]------ Server

  3. CLIENT STREAMING (client sends multiple messages)
  Client ---[msg 1]-----> Server
  Client ---[msg 2]-----> Server
  Client ---[msg N]-----> Server
  Client <--[response]--- Server

  4. BIDIRECTIONAL STREAMING (both sides stream)
  Client ---[msg]-------> Server
  Client <--[msg]-------- Server
  Client ---[msg]-------> Server
  Client <--[msg]-------- Server
  (interleaved, any order)
```

Think of it like walkie-talkies:
1. Unary: you ask, they answer
2. Server stream: you tune into a radio station
3. Client stream: you dictate a letter
4. Bidi stream: a phone call -- both sides talk freely

## Code Generation

```
  user.proto
      |
      v
  protoc compiler
      |
      +---> user.pb.go        (Go structs + serialization)
      +---> user_grpc.pb.go   (Go client + server interfaces)
      +---> user_pb.ts         (TypeScript types)
      +---> user_grpc.ts       (TypeScript client + server)
```

## Go gRPC Server

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/example/userservice"
)

type server struct {
	pb.UnimplementedUserServiceServer
	mu    sync.RWMutex
	users map[int32]*pb.User
	next  int32
}

func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, ok := s.users[req.Id]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "user %d not found", req.Id)
	}
	return user, nil
}

func (s *server) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.User, error) {
	if req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "name is required")
	}
	if req.Email == "" {
		return nil, status.Error(codes.InvalidArgument, "email is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.next++
	user := &pb.User{
		Id:    s.next,
		Name:  req.Name,
		Email: req.Email,
		Role:  pb.UserRole_USER_ROLE_MEMBER,
	}
	s.users[s.next] = user
	return user, nil
}

func (s *server) WatchUsers(req *pb.WatchRequest, stream pb.UserService_WatchUsersServer) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, user := range s.users {
		if err := stream.Send(user); err != nil {
			return err
		}
	}
	return nil
}

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatal(err)
	}

	s := grpc.NewServer()
	pb.RegisterUserServiceServer(s, &server{
		users: make(map[int32]*pb.User),
	})

	fmt.Println("gRPC server on :50051")
	if err := s.Serve(lis); err != nil {
		log.Fatal(err)
	}
}
```

## Go gRPC Client

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/example/userservice"
)

func main() {
	conn, err := grpc.NewClient("localhost:50051",
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	client := pb.NewUserServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	created, err := client.CreateUser(ctx, &pb.CreateUserRequest{
		Name:  "Alice",
		Email: "alice@example.com",
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Created: %v\n", created)

	fetched, err := client.GetUser(ctx, &pb.GetUserRequest{Id: created.Id})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Fetched: %v\n", fetched)
}
```

## gRPC vs REST vs GraphQL

```
  +----------------+----------+----------+----------+
  |                | REST     | GraphQL  | gRPC     |
  +----------------+----------+----------+----------+
  | Transport      | HTTP/1.1 | HTTP/1.1 | HTTP/2   |
  | Format         | JSON     | JSON     | Protobuf |
  | Schema         | OpenAPI  | SDL      | .proto   |
  | Streaming      | No*      | Subscr.  | Yes      |
  | Browser        | Native   | Native   | Needs    |
  |                |          |          | proxy    |
  | Code gen       | Optional | Optional | Required |
  | Best for       | Public   | Flexible | Service  |
  |                | APIs     | clients  | to svc   |
  +----------------+----------+----------+----------+
  * Server-Sent Events add limited streaming to REST
```

## Exercises

1. **Write a `.proto` file** for an order service with: CreateOrder,
   GetOrder, ListOrders, and a server-streaming WatchOrderStatus.

2. **Compare sizes.** A user object `{id: 1, name: "Alice", email: "a@b.com"}`
   is ~50 bytes in JSON. Estimate the Protobuf size (hint: field tags are
   1 byte, strings have a length prefix).

3. **When would you choose gRPC over REST?** List 3 scenarios.

4. **What happens** if you add a new field to a `.proto` message? Does it
   break existing clients? Why or why not?

---

[Next: Lesson 06 - WebSockets ->](06-websockets.md)
