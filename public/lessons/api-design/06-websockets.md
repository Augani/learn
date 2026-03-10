# Lesson 06: WebSockets

## The Phone Call Analogy

HTTP is like sending letters -- you write, wait for a response, repeat.
WebSockets are like a phone call -- once connected, both sides can talk
at any time without re-dialing.

```
  HTTP (request-response):
  Client --[request]--> Server
  Client <-[response]-- Server
  (connection closed)
  Client --[request]--> Server    <-- new connection every time
  Client <-[response]-- Server

  WebSocket (persistent, bidirectional):
  Client --[handshake]-> Server
  Client <==============> Server   <-- connection stays open
  Client --[msg]-------> Server
  Client <-[msg]-------- Server
  Client --[msg]-------> Server
  Client <-[msg]-------- Server
  (either side can send at any time)
```

## Connection Lifecycle

```
  1. HANDSHAKE (HTTP Upgrade)
  +--------+                          +--------+
  | Client | -- GET / HTTP/1.1 -----> | Server |
  |        |    Upgrade: websocket    |        |
  |        |    Connection: Upgrade   |        |
  |        | <-- 101 Switching -----  |        |
  +--------+     Protocols            +--------+

  2. OPEN (bidirectional messaging)
  +--------+                          +--------+
  | Client | <====== messages ======> | Server |
  +--------+                          +--------+

  3. CLOSE (graceful shutdown)
  +--------+                          +--------+
  | Client | -- close frame --------> | Server |
  |        | <- close frame --------- |        |
  +--------+   connection terminated  +--------+
```

The handshake starts as a regular HTTP request and "upgrades" to WebSocket.
After that, it's a raw TCP connection with framing.

## When to Use WebSockets

```
  USE WEBSOCKETS:                    DON'T USE WEBSOCKETS:
  +---------------------------+     +---------------------------+
  | Chat applications         |     | CRUD APIs                 |
  | Live dashboards           |     | File uploads              |
  | Multiplayer games         |     | One-off data fetches      |
  | Collaborative editing     |     | Search endpoints          |
  | Stock tickers             |     | Authentication flows      |
  | Live notifications        |     | Anything request-response |
  +---------------------------+     +---------------------------+
```

Rule of thumb: if the server needs to push data to the client without
being asked, consider WebSockets.

## Go WebSocket Server

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"golang.org/x/net/websocket"
)

type ChatRoom struct {
	mu      sync.Mutex
	clients map[*websocket.Conn]string
}

func NewChatRoom() *ChatRoom {
	return &ChatRoom{clients: make(map[*websocket.Conn]string)}
}

func (r *ChatRoom) Join(ws *websocket.Conn, name string) {
	r.mu.Lock()
	r.clients[ws] = name
	r.mu.Unlock()
	r.Broadcast(fmt.Sprintf("%s joined the chat", name))
}

func (r *ChatRoom) Leave(ws *websocket.Conn) {
	r.mu.Lock()
	name := r.clients[ws]
	delete(r.clients, ws)
	r.mu.Unlock()
	r.Broadcast(fmt.Sprintf("%s left the chat", name))
}

func (r *ChatRoom) Broadcast(msg string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for conn := range r.clients {
		if err := websocket.Message.Send(conn, msg); err != nil {
			conn.Close()
			delete(r.clients, conn)
		}
	}
}

func main() {
	room := NewChatRoom()

	http.Handle("/ws", websocket.Handler(func(ws *websocket.Conn) {
		name := ws.Request().URL.Query().Get("name")
		if name == "" {
			name = "anonymous"
		}

		room.Join(ws, name)
		defer room.Leave(ws)

		for {
			var msg string
			if err := websocket.Message.Receive(ws, &msg); err != nil {
				break
			}
			room.Broadcast(fmt.Sprintf("%s: %s", name, msg))
		}
	}))

	fmt.Println("WebSocket server on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

## TypeScript WebSocket Server

```typescript
const server = Bun.serve({
  port: 8080,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const name = url.searchParams.get("name") ?? "anonymous";
      const upgraded = server.upgrade(req, { data: { name } });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }
    return new Response("Use /ws for WebSocket");
  },
  websocket: {
    open(ws) {
      const name = (ws.data as { name: string }).name;
      ws.subscribe("chat");
      ws.publish("chat", `${name} joined the chat`);
    },
    message(ws, message) {
      const name = (ws.data as { name: string }).name;
      ws.publish("chat", `${name}: ${message}`);
    },
    close(ws) {
      const name = (ws.data as { name: string }).name;
      ws.publish("chat", `${name} left the chat`);
    },
  },
});

console.log(`WebSocket server on :${server.port}`);
```

## TypeScript WebSocket Client

```typescript
const ws = new WebSocket("ws://localhost:8080/ws?name=Alice");

ws.onopen = () => {
  console.log("Connected");
  ws.send("Hello everyone!");
};

ws.onmessage = (event) => {
  console.log("Received:", event.data);
};

ws.onclose = () => {
  console.log("Disconnected");
};

ws.onerror = (error) => {
  console.error("Error:", error);
};
```

## Scaling Challenges

WebSockets are stateful. That's the opposite of REST's statelessness,
and it creates real problems at scale.

```
  PROBLEM: Sticky connections
  +---------+        +----------+
  | Client1 |------->| Server A |  Client1 is "stuck" on Server A
  +---------+        +----------+
  +---------+        +----------+
  | Client2 |------->| Server B |  Client2 is "stuck" on Server B
  +---------+        +----------+

  If Client1 sends a message for Client2, Server A doesn't know
  about Client2 -- it's on Server B!

  SOLUTION: Pub/Sub backbone (Redis, NATS, Kafka)
  +---------+     +----------+     +-------+     +----------+     +---------+
  | Client1 |---->| Server A |---->| Redis |---->| Server B |---->| Client2 |
  +---------+     +----------+     +-------+     +----------+     +---------+
                                   Pub/Sub
                                   bridges
                                   servers
```

### Key Scaling Concerns

```
  +---------------------------+------------------------------------+
  | Challenge                 | Solution                           |
  +---------------------------+------------------------------------+
  | Connection limits         | Multiple servers + load balancer   |
  | Cross-server messaging    | Redis Pub/Sub or message broker    |
  | Connection drops          | Auto-reconnect with backoff        |
  | Memory per connection     | Monitor and set limits             |
  | Load balancer config      | Use sticky sessions or Layer 4 LB |
  +---------------------------+------------------------------------+
```

## Heartbeats and Reconnection

Connections die silently. You need heartbeats to detect dead connections
and reconnection logic to recover.

```
  Client                              Server
    |                                    |
    |-------- ping ------------------>  |
    |<------- pong -------------------  |  (every 30s)
    |                                    |
    |  (network drops)                   |
    |                                    |
    |  (no pong received for 60s)        |
    |  -> connection considered dead     |
    |  -> reconnect with backoff:        |
    |     1s, 2s, 4s, 8s, 16s, 30s max  |
```

## Exercises

1. **Run the chat server** (Go or TypeScript). Open two browser tabs
   and send messages between them.

2. **Add heartbeats.** Implement a ping/pong mechanism that closes
   connections if no pong is received within 60 seconds.

3. **Design a scaling strategy** for a chat app with 100k concurrent
   users. How many servers? What pub/sub system?

4. **When would you use Server-Sent Events (SSE) instead of WebSockets?**
   Hint: SSE is one-directional, server to client only.

---

[Next: Lesson 07 - API Versioning ->](07-api-versioning.md)
