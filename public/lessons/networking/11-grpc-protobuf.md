# Lesson 11: gRPC and Protocol Buffers -- Service-to-Service Communication

When your backend is a single server, REST/JSON works fine. But when you have
dozens of internal services calling each other millions of times per day, the
overhead of parsing JSON, the lack of type safety across service boundaries,
and the ambiguity of REST conventions become real problems. This lesson covers
Protocol Buffers and gRPC -- the tools designed for fast, typed, internal
service communication.

---

## The Problem With REST/JSON for Internal Services

Consider a microservice that processes 50,000 requests per second from other
internal services:

```json
{
  "user_id": 12345,
  "name": "Alice Chen",
  "email": "alice@example.com",
  "role": "admin",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Verbose:** Every field name is repeated in every single message. `"user_id"`
is 9 bytes of text just for the key. The integer 12345 takes 5 bytes as text
but only 2 bytes in binary.

**Slow to parse:** JSON is text. Parsing it requires scanning characters,
handling escape sequences, converting strings to numbers, and allocating
memory for every value.

**No type contract:** The client and server agree on the JSON shape through
documentation, hope, and convention. Nothing stops one side from sending
`"user_id": "12345"` (string) while the other expects a number.

**No code generation:** Every service must manually write serialization and
deserialization code (or use reflection-based approaches that are slow).

At 50,000 requests per second, these costs multiply into real CPU and latency.

---

## The Analogy

**REST/JSON is like exchanging handwritten letters.** Flexible format, anyone
can read them, but slow to write and read. You might misread someone's
handwriting. There is no enforced structure -- the other person might forget
to include the return address.

**gRPC/Protobuf is like a phone call with a predefined script.** Both sides
have the same script (the `.proto` file). The caller says "give me user 42"
and the response comes back instantly in a compact, pre-agreed format. No
ambiguity, no wasted words, type-safe by construction.

---

## Protocol Buffers: The Serialization Format

Protocol Buffers (protobuf) is a binary serialization format developed by
Google. You define your data structures in `.proto` files, then generate code
for any language.

### A .proto File

```protobuf
syntax = "proto3";

package user;

message User {
  uint64 id = 1;
  string name = 2;
  string email = 3;
  Role role = 4;
  int64 created_at_unix = 5;
}

enum Role {
  ROLE_UNSPECIFIED = 0;
  ROLE_USER = 1;
  ROLE_ADMIN = 2;
}

message GetUserRequest {
  uint64 id = 1;
}

message GetUserResponse {
  User user = 1;
}
```

Key concepts:

**Field numbers** (`= 1`, `= 2`, etc.) are not default values. They are wire
identifiers. When serialized, protobuf uses these numbers (not field names)
to identify fields. This is why protobuf is so compact and why you must never
reuse or change field numbers.

**Types are explicit.** `uint64`, `string`, `int64`, enums. No ambiguity
about what a field contains.

**Enums start at 0.** The zero value must be an "unspecified" or "unknown"
sentinel. This is required by proto3 for forward compatibility.

### Binary Encoding

Protobuf encodes data as a sequence of field-number + type + value triplets:

```
JSON (95 bytes):
{"id":12345,"name":"Alice Chen","email":"alice@example.com","role":"admin","created_at":"..."}

Protobuf (~45 bytes):
[field 1, varint, 12345][field 2, string, "Alice Chen"][field 3, string, ...]
```

Integers use variable-length encoding (varints): small numbers take fewer
bytes. The number 1 takes 1 byte, not 8.

```
Varint encoding of 12345:

12345 in binary: 11000000111001
Split into 7-bit groups: 0110000 0011100 1
Add continuation bits: 10111001 01100000
Wire bytes (little-endian): B9 60

Only 2 bytes instead of 8 for a uint64!
```

### Code Generation

From a single `.proto` file, protobuf generates typed code for every
language:

```
                    user.proto
                        |
          +-------------+-------------+
          |             |             |
    protoc --rust   protoc --go   protoc --ts
          |             |             |
     user.rs        user.go       user.ts
   (Rust struct)  (Go struct)   (TS interface)
```

Every service gets compile-time type safety and zero manual serialization
code. Change the `.proto` file and regenerate -- the compiler catches
mismatches.

---

## gRPC: The RPC Framework

gRPC is a remote procedure call framework built on top of HTTP/2 and
Protocol Buffers. Instead of designing URL patterns and HTTP methods, you
define services with typed methods:

### Service Definition

```protobuf
syntax = "proto3";

package user;

service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc ListUsers(ListUsersRequest) returns (stream User);
  rpc UploadUsers(stream User) returns (UploadSummary);
  rpc SyncUsers(stream UserUpdate) returns (stream UserUpdate);
}
```

This defines four methods, one for each gRPC communication pattern.

---

## Four Communication Patterns

### 1. Unary RPC (Request-Response)

The simplest pattern. Client sends one request, server sends one response.
Just like a normal function call, but across the network.

```
Client                          Server
  |--- GetUser(id=42) ----------->|
  |<-- User{name:"Alice",...} ----|
```

### 2. Server Streaming

Client sends one request, server sends a stream of responses. The server
keeps sending until it is done.

```
Client                          Server
  |--- ListUsers(role=ADMIN) ---->|
  |<-- User{id:1, ...} ----------|
  |<-- User{id:5, ...} ----------|
  |<-- User{id:12, ...} ---------|
  |<-- (end of stream) ----------|
```

Use case: returning large result sets, live feeds, log streaming.

### 3. Client Streaming

Client sends a stream of messages, server responds with a single message
after the stream ends.

```
Client                          Server
  |--- User{...} --------------->|
  |--- User{...} --------------->|
  |--- User{...} --------------->|
  |--- (end of stream) --------->|
  |<-- UploadSummary{count:3} ---|
```

Use case: file upload, batch data ingestion, aggregation.

### 4. Bidirectional Streaming

Both sides send streams of messages independently. Neither side waits for
the other -- messages flow in both directions simultaneously.

```
Client                          Server
  |--- UserUpdate{...} --------->|
  |<-- UserUpdate{...} ----------|
  |--- UserUpdate{...} --------->|
  |--- UserUpdate{...} --------->|
  |<-- UserUpdate{...} ----------|
  |<-- UserUpdate{...} ----------|
```

Use case: real-time sync, chat, collaborative editing.

---

## Why HTTP/2 Matters for gRPC

gRPC uses HTTP/2 as its transport for several reasons:

```
HTTP/1.1                          HTTP/2
+-----------+                     +-----------+
| request 1 | (wait for          | req 1 | req 2 | req 3 |  multiplexed
| response 1| response)          | resp2 | resp1 | resp3 |  on one connection
+-----------+                     +-----------+
| request 2 |
| response 2|
+-----------+
```

- **Multiplexing:** Multiple RPC calls share one TCP connection without
  head-of-line blocking.
- **Header compression (HPACK):** Reduces overhead for repeated metadata.
- **Streaming:** HTTP/2 streams map directly to gRPC streaming RPCs.
- **Flow control:** Built-in backpressure prevents fast producers from
  overwhelming slow consumers.

---

## gRPC vs REST: When to Use Which

| Aspect | REST/JSON | gRPC/Protobuf |
|---|---|---|
| **Audience** | Public APIs, browsers, third parties | Internal services |
| **Readability** | Human readable (JSON) | Binary (need tools to inspect) |
| **Type safety** | None (documentation only) | Compile-time (generated code) |
| **Performance** | Slower (text parsing) | Faster (binary, HTTP/2) |
| **Streaming** | SSE or WebSocket (bolted on) | Native (4 patterns) |
| **Browser support** | Native | Requires grpc-web proxy |
| **Tooling** | curl, Postman, any HTTP client | grpcurl, Postman, BloomRPC |
| **Discovery** | OpenAPI/Swagger docs | Proto files are the contract |
| **Caching** | HTTP caching works naturally | No built-in caching |

**Rule of thumb:**
- Public API consumed by third parties or browsers? Use REST/JSON.
- Internal service-to-service calls where performance matters? Use gRPC.
- Need both? Many companies expose REST externally and use gRPC internally,
  with an API gateway translating between them.

---

## gRPC in Rust: The tonic Crate

`tonic` is the standard gRPC framework for Rust. It generates Rust code from
`.proto` files and provides both server and client implementations.

### Project Setup

```
my-grpc-project/
  proto/
    user.proto
  src/
    main.rs
    server.rs
    client.rs
  build.rs
  Cargo.toml
```

### Cargo.toml

```toml
[dependencies]
tonic = "0.12"
prost = "0.13"
tokio = { version = "1", features = ["full"] }

[build-dependencies]
tonic-build = "0.12"
```

### Proto File (proto/user.proto)

```protobuf
syntax = "proto3";

package user;

service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc ListUsers(ListUsersRequest) returns (stream GetUserResponse);
}

message GetUserRequest {
  uint64 id = 1;
}

message ListUsersRequest {
  uint32 page_size = 1;
}

message GetUserResponse {
  uint64 id = 1;
  string name = 2;
  string email = 3;
}
```

### build.rs (Code Generation)

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::compile_protos("proto/user.proto")?;
    Ok(())
}
```

When you run `cargo build`, tonic generates Rust types and a service trait
from the `.proto` file. You then implement the trait.

### Server Implementation

```rust
use tonic::{transport::Server, Request, Response, Status};

pub mod user_proto {
    tonic::include_proto!("user");
}

use user_proto::user_service_server::{UserService, UserServiceServer};
use user_proto::{GetUserRequest, GetUserResponse, ListUsersRequest};

#[derive(Default)]
struct MyUserService;

#[tonic::async_trait]
impl UserService for MyUserService {
    async fn get_user(
        &self,
        request: Request<GetUserRequest>,
    ) -> Result<Response<GetUserResponse>, Status> {
        let user_id = request.into_inner().id;

        if user_id == 0 {
            return Err(Status::invalid_argument("user ID must be > 0"));
        }

        let response = GetUserResponse {
            id: user_id,
            name: format!("User {}", user_id),
            email: format!("user{}@example.com", user_id),
        };

        Ok(Response::new(response))
    }

    type ListUsersStream = tokio_stream::wrappers::ReceiverStream<
        Result<GetUserResponse, Status>,
    >;

    async fn list_users(
        &self,
        request: Request<ListUsersRequest>,
    ) -> Result<Response<Self::ListUsersStream>, Status> {
        let page_size = request.into_inner().page_size as usize;
        let (tx, rx) = tokio::sync::mpsc::channel(page_size.max(1));

        tokio::spawn(async move {
            for i in 1..=page_size {
                let user = GetUserResponse {
                    id: i as u64,
                    name: format!("User {}", i),
                    email: format!("user{}@example.com", i),
                };
                if tx.send(Ok(user)).await.is_err() {
                    break;
                }
            }
        });

        Ok(Response::new(tokio_stream::wrappers::ReceiverStream::new(rx)))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "127.0.0.1:50051".parse()?;
    println!("gRPC server listening on {}", addr);

    Server::builder()
        .add_service(UserServiceServer::new(MyUserService::default()))
        .serve(addr)
        .await?;

    Ok(())
}
```

### Client Implementation

```rust
use user_proto::user_service_client::UserServiceClient;
use user_proto::GetUserRequest;

pub mod user_proto {
    tonic::include_proto!("user");
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = UserServiceClient::connect("http://127.0.0.1:50051").await?;

    let request = tonic::Request::new(GetUserRequest { id: 42 });
    let response = client.get_user(request).await?;
    let user = response.into_inner();

    println!("Got user: {} ({})", user.name, user.email);

    Ok(())
}
```

### What tonic Generated For You

From the `.proto` file, tonic generates:
- `GetUserRequest`, `GetUserResponse`, `ListUsersRequest` -- Rust structs
  with proper types
- `UserService` trait -- you implement this on the server
- `UserServiceClient` -- ready-to-use client with typed methods
- Serialization/deserialization -- completely handled

You write zero boilerplate for networking, serialization, or type conversion.

---

## gRPC Error Handling

gRPC defines a set of standard status codes (similar to HTTP status codes
but more specific to RPC):

| Code | Name | When to Use |
|---|---|---|
| 0 | OK | Success |
| 3 | INVALID_ARGUMENT | Client sent bad input |
| 5 | NOT_FOUND | Requested resource doesn't exist |
| 7 | PERMISSION_DENIED | Caller lacks permission |
| 13 | INTERNAL | Unexpected server error |
| 14 | UNAVAILABLE | Service temporarily unavailable (retry) |
| 4 | DEADLINE_EXCEEDED | Operation took too long |

In tonic, you return these via `Status`:

```rust
Err(Status::not_found(format!("user {} not found", user_id)))
Err(Status::internal("database connection failed"))
Err(Status::deadline_exceeded("query took too long"))
```

---

## gRPC Metadata and Deadlines

### Metadata (Like HTTP Headers)

```rust
let mut request = tonic::Request::new(GetUserRequest { id: 42 });
request.metadata_mut().insert(
    "authorization",
    "Bearer my-token".parse().unwrap(),
);
```

### Deadlines

Every gRPC call should have a deadline. If the call doesn't complete in time,
both sides abort:

```rust
let mut request = tonic::Request::new(GetUserRequest { id: 42 });
request.set_timeout(std::time::Duration::from_secs(5));
```

This prevents slow downstream services from holding up the entire system.

---

## Architecture Pattern: REST Gateway + gRPC Backend

A common production architecture:

```
                   Internet
                      |
              +-------+-------+
              | API Gateway   |
              | (REST/JSON)   |
              +---+---+---+---+
                  |   |   |
          gRPC    |   |   |    gRPC
       +----------+   |   +----------+
       |              |              |
  +----+----+   +-----+-----+  +----+----+
  | User    |   | Order     |  | Payment |
  | Service |   | Service   |  | Service |
  +---------+   +-----------+  +---------+
```

External clients speak REST/JSON. The API gateway translates to gRPC for
internal communication. Internal services talk gRPC to each other.

---

## Exercises

1. **Install protoc.** Install the Protocol Buffer compiler for your OS
   (`brew install protobuf` on macOS, `apt install protobuf-compiler` on
   Linux). Verify with `protoc --version`.

2. **Create a proto file.** Define a `TodoService` with these methods:
   - `CreateTodo(CreateTodoRequest) returns (Todo)`
   - `GetTodo(GetTodoRequest) returns (Todo)`
   - `ListTodos(ListTodosRequest) returns (stream Todo)`
   - `DeleteTodo(DeleteTodoRequest) returns (Empty)`
   Define the `Todo` message with fields: `id`, `title`, `completed`.

3. **Build the server.** Using tonic, implement the `TodoService` trait.
   Store todos in a `HashMap<u64, Todo>` wrapped in `Arc<RwLock<...>>`.
   Handle not-found and invalid-argument errors properly.

4. **Build the client.** Write a client that creates 3 todos, lists them
   (using the streaming endpoint), marks one complete, and deletes another.

5. **Compare sizes.** Serialize a `Todo` as JSON (using serde_json) and as
   protobuf (using prost). Print both byte lengths. How much smaller is
   protobuf?

6. **Add metadata.** Add a `request-id` metadata header to every client
   request. Log it on the server side. This is how distributed tracing works.

---

Next: [Lesson 12: Sockets -- The Raw Building Block](./12-sockets.md)
