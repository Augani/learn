# Lesson 10: WebSockets -- Persistent Bidirectional Connections

HTTP has a fundamental constraint baked into its design: the client always
speaks first. The server can never wake up and say "hey, something changed!"
on its own. Every response must be preceded by a request. This lesson covers
WebSockets, the protocol that removes that constraint entirely.

---

## The Problem With Plain HTTP

Think about building a chat application. With HTTP, your client has two bad
options:

**Polling:** Ask the server "any new messages?" every second.

```
Client                        Server
  |--- GET /messages?since=100 --->|
  |<-- 200 OK (nothing new) ------|   wasted request
  |                                |
  |--- GET /messages?since=100 --->|
  |<-- 200 OK (nothing new) ------|   wasted request
  |                                |
  |--- GET /messages?since=100 --->|
  |<-- 200 OK [message 101] ------|   finally something!
```

This hammers the server with useless requests and adds latency (you only see
the message at the next poll interval).

**Long polling:** Send a request, and the server holds it open until there is
something to send back. Better, but still one request per message, plus the
overhead of re-establishing the connection each time.

What you really want is a persistent connection where either side can send
data at any time.

---

## The Analogy

**HTTP is like walkie-talkies.** One person talks, then says "over," and only
then can the other person respond. You take turns. If nobody is talking, the
channel is silent -- there is no way for the other side to jump in without
being asked.

**WebSocket is like a phone call.** Once the call is connected, both sides can
talk whenever they want. You can interrupt each other. You can both be silent.
Neither side needs permission to speak. The line stays open until someone
hangs up.

---

## What Is a WebSocket?

A WebSocket is a full-duplex communication channel over a single, long-lived
TCP connection. Once established:

- The client can send messages to the server at any time.
- The server can send messages to the client at any time.
- Messages are framed (not a raw byte stream) so each message is discrete.
- The connection stays open until either side closes it.

```
    Standard HTTP                        WebSocket

Client         Server            Client           Server
  |-- req 1 ----->|                |                  |
  |<-- resp 1 ----|                |--- upgrade ----->|
  |                |               |<-- 101 switch ---|
  |-- req 2 ----->|               |                   |
  |<-- resp 2 ----|               |<== msg from srv ==|  server initiates!
  |                |              |=== msg from cli ==>|  client sends anytime
  |-- req 3 ----->|              |<== msg from srv ===|
  |<-- resp 3 ----|              |=== msg from cli ==>|
  |                |              |<== msg from srv ==|
                                  |--- close -------->|
                                  |<-- close ---------|
```

---

## The Upgrade Handshake

WebSocket connections start life as a normal HTTP request. The client sends a
special `Upgrade` header asking the server to switch protocols.

### Client Request

```
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: http://example.com
```

Key headers:
- `Upgrade: websocket` -- "I want to switch to WebSocket protocol"
- `Connection: Upgrade` -- "This connection should be upgraded"
- `Sec-WebSocket-Key` -- A random base64 value for handshake validation
- `Sec-WebSocket-Version: 13` -- The WebSocket protocol version (always 13)

### Server Response

```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

The server responds with `101 Switching Protocols`. From this point on, the
TCP connection is no longer HTTP -- it speaks the WebSocket frame protocol.

The `Sec-WebSocket-Accept` value is derived from the client's key:

```
accept = base64(sha1(client_key + "258EAFA5-E914-47DA-95CA-5AB5DC11E5A5"))
```

This proves the server actually understands WebSocket (not just blindly
accepting the upgrade).

### Why Start With HTTP?

Starting as HTTP is pragmatic:
- Works through existing proxies, firewalls, and load balancers that understand HTTP
- Uses the same port (80/443) so no firewall changes needed
- Existing HTTP authentication and cookies work during the handshake
- Existing HTTP infrastructure (nginx, CDNs) can route the initial request

---

## WebSocket Frame Format

After the handshake, data flows as WebSocket frames. Each frame has a small
header followed by payload data.

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
|N|V|V|V|       |S|             |   (if payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+-------------------------------+
|                  Masking key (if MASK set)                     |
|                         (32 bits)                              |
+---------------------------------------------------------------+
|                       Payload Data                             |
|                     (variable length)                          |
+---------------------------------------------------------------+
```

**FIN (1 bit):** Is this the final fragment of a message? Usually 1.

**Opcode (4 bits):** What kind of frame is this?
- `0x1` = text frame (UTF-8 data)
- `0x2` = binary frame
- `0x8` = connection close
- `0x9` = ping
- `0xA` = pong

**MASK (1 bit):** Client-to-server frames must be masked. Server-to-client
frames must not. The masking prevents caching proxies from confusing WebSocket
frames with HTTP responses.

**Payload length:** 7 bits for payloads up to 125 bytes, extended to 16 bits
(up to 65535) or 64 bits (up to 2^63) for larger payloads.

In practice, you never construct frames by hand -- your WebSocket library
handles this. But understanding the format helps when debugging.

---

## Ping/Pong: Keepalive

TCP connections can die silently. A router reboot, a NAT table timeout, or a
network blip can kill the connection without either side knowing.

WebSocket defines ping and pong frames for keepalive:

```
Server                     Client
  |--- ping (opcode 0x9) --->|
  |<-- pong (opcode 0xA) ----|   "I'm still here"
  |                           |
  ... 30 seconds later ...
  |                           |
  |--- ping (opcode 0x9) --->|
  |                           |   no pong received
  |                           |   connection is dead
  |--- close connection ---   |
```

Either side can send a ping. The other side must respond with a pong
containing the same payload data. If no pong arrives within a timeout,
the connection is considered dead.

Most WebSocket libraries handle ping/pong automatically. In production,
configure the interval (commonly 30-60 seconds).

---

## Use Cases

WebSocket shines when you need real-time, bidirectional communication:

| Use Case | Why WebSocket? |
|---|---|
| **Chat applications** | Both sides send messages freely |
| **Live dashboards** | Server pushes metric updates as they happen |
| **Multiplayer games** | Low-latency bidirectional game state updates |
| **Collaborative editing** | Multiple users editing the same document |
| **Live notifications** | Server pushes events without polling |
| **Financial tickers** | Continuous stream of price updates |
| **Live sports scores** | Server pushes score changes in real time |

---

## WebSocket vs Server-Sent Events (SSE)

Server-Sent Events are a simpler alternative when you only need one-way
streaming from server to client.

```
         SSE (Server-Sent Events)              WebSocket
   Client ←←←←←←←←←←←← Server         Client ⇄⇄⇄⇄⇄⇄⇄ Server
   (receive only)       (send only)     (send & receive) (send & receive)
```

| Feature | WebSocket | SSE |
|---|---|---|
| Direction | Bidirectional | Server → Client only |
| Protocol | WebSocket (binary) | HTTP (text/event-stream) |
| Reconnection | Manual | Automatic (built-in) |
| Binary data | Yes | No (text only) |
| Browser support | All modern browsers | All modern browsers |
| Proxy friendly | Sometimes problematic | Works through any HTTP proxy |
| Complexity | Higher | Lower |

**When to use SSE instead:**
- Live feeds, news tickers, notifications (server pushes, client only reads)
- You don't need the client to send data through the same channel
- You want automatic reconnection and event IDs for free
- You want simpler infrastructure (plain HTTP, works with any proxy/CDN)

**When you need WebSocket:**
- Chat, gaming, collaborative editing (both sides send data)
- Binary data streaming
- You need the absolute lowest latency in both directions

---

## WebSocket in Rust: tokio-tungstenite

The `tokio-tungstenite` crate provides async WebSocket support built on
tokio. It handles the handshake, framing, ping/pong, and close protocol.

### Cargo.toml Dependencies

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.24"
futures-util = "0.3"
```

### WebSocket Echo Server

A server that echoes back every message it receives:

```rust
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("127.0.0.1:9001").await.unwrap();
    println!("WebSocket server listening on ws://127.0.0.1:9001");

    while let Ok((stream, addr)) = listener.accept().await {
        println!("New TCP connection from {}", addr);

        tokio::spawn(async move {
            let ws_stream = match accept_async(stream).await {
                Ok(ws) => ws,
                Err(err) => {
                    eprintln!("WebSocket handshake failed for {}: {}", addr, err);
                    return;
                }
            };

            println!("WebSocket connection established with {}", addr);
            let (mut write, mut read) = ws_stream.split();

            while let Some(result) = read.next().await {
                match result {
                    Ok(msg) => {
                        match msg {
                            Message::Text(text) => {
                                println!("Received from {}: {}", addr, text);
                                if write.send(Message::Text(text)).await.is_err() {
                                    break;
                                }
                            }
                            Message::Binary(data) => {
                                if write.send(Message::Binary(data)).await.is_err() {
                                    break;
                                }
                            }
                            Message::Close(_) => {
                                println!("{} disconnected", addr);
                                break;
                            }
                            Message::Ping(payload) => {
                                if write.send(Message::Pong(payload)).await.is_err() {
                                    break;
                                }
                            }
                            _ => {}
                        }
                    }
                    Err(err) => {
                        eprintln!("Error from {}: {}", addr, err);
                        break;
                    }
                }
            }
        });
    }
}
```

### WebSocket Client

```rust
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

#[tokio::main]
async fn main() {
    let url = "ws://127.0.0.1:9001";
    let (ws_stream, _) = connect_async(url)
        .await
        .expect("Failed to connect");

    println!("Connected to {}", url);
    let (mut write, mut read) = ws_stream.split();

    write
        .send(Message::Text("Hello, WebSocket!".into()))
        .await
        .expect("Failed to send");

    if let Some(Ok(msg)) = read.next().await {
        println!("Received: {}", msg);
    }

    write.send(Message::Close(None)).await.ok();
}
```

---

## Building a Chat Server

A chat server broadcasts every message to all connected clients. The key
difference from an echo server: you need shared state.

```rust
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

type ClientMap = Arc<RwLock<HashMap<usize, mpsc::UnboundedSender<Message>>>>;

static NEXT_ID: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(1);

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("127.0.0.1:9001").await.unwrap();
    let clients: ClientMap = Arc::new(RwLock::new(HashMap::new()));

    println!("Chat server listening on ws://127.0.0.1:9001");

    while let Ok((stream, addr)) = listener.accept().await {
        let clients = clients.clone();

        tokio::spawn(async move {
            let ws_stream = match accept_async(stream).await {
                Ok(ws) => ws,
                Err(_) => return,
            };

            let id = NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let (mut ws_write, mut ws_read) = ws_stream.split();
            let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

            clients.write().await.insert(id, tx);
            println!("Client {} connected from {}", id, addr);

            let write_task = tokio::spawn(async move {
                while let Some(msg) = rx.recv().await {
                    if ws_write.send(msg).await.is_err() {
                        break;
                    }
                }
            });

            while let Some(Ok(msg)) = ws_read.next().await {
                if let Message::Text(ref text) = msg {
                    println!("Client {}: {}", id, text);
                    let broadcast_msg = Message::Text(
                        format!("Client {}: {}", id, text).into()
                    );
                    let readers = clients.read().await;
                    for (client_id, sender) in readers.iter() {
                        if *client_id != id {
                            let _ = sender.send(broadcast_msg.clone());
                        }
                    }
                }

                if matches!(msg, Message::Close(_)) {
                    break;
                }
            }

            clients.write().await.remove(&id);
            write_task.abort();
            println!("Client {} disconnected", id);
        });
    }
}
```

### How It Works

1. Each client gets a unique ID and an `mpsc` channel for outgoing messages.
2. A background task reads from the channel and writes to the WebSocket.
3. When a client sends a message, the server iterates over all other clients
   and sends the message through their channels.
4. When a client disconnects, it is removed from the shared map.

```
Client A                Server                Client B
   |                      |                      |
   |== "hello" =========>|                       |
   |                      |== "Client A: hello"=>|
   |                      |                      |
   |                      |<= "world" ===========|
   |<= "Client B: world"=|                       |
```

---

## Connection Lifecycle Summary

```
1. Client opens TCP connection to server
2. Client sends HTTP Upgrade request
3. Server responds with 101 Switching Protocols
4. ---- Connection is now WebSocket ----
5. Either side sends frames freely
6. Periodic ping/pong to verify liveness
7. Either side sends a Close frame
8. Other side responds with Close frame
9. TCP connection is closed
```

---

## Common Pitfalls

**Forgetting reconnection logic.** WebSocket connections will eventually drop
(network issues, server restarts, deploys). Clients must implement reconnect
with exponential backoff.

**Not handling backpressure.** If the server sends messages faster than the
client can consume them, the send buffer grows unbounded. Use bounded channels
or drop old messages.

**Ignoring close frames.** When one side sends a Close frame, the other must
respond with a Close frame before closing the TCP connection. Libraries
handle this, but be aware of it.

**Running WebSocket through a CDN or proxy without configuration.** Many
proxies have idle timeouts (60-120 seconds). Configure your proxy to support
long-lived connections or ensure ping/pong keeps the connection alive.

---

## Exercises

1. **Run the echo server and client.** Add `tokio-tungstenite` to a new
   project, run the echo server, and test it with the client code above.
   Verify you can send multiple messages.

2. **Build the chat server.** Run the chat server above. Open multiple
   terminal windows running the client (modify it to read from stdin in a
   loop). Verify that messages from one client appear on all others.

3. **Add usernames.** Modify the chat server so clients send a username as
   their first message. Broadcast messages as `"username: message"` instead
   of `"Client N: message"`.

4. **Add a `/users` command.** When a client sends `/users`, the server
   responds (only to that client) with a list of connected usernames.

5. **Compare with SSE.** Build a simple SSE endpoint in Rust (using axum or
   actix-web) that pushes a counter every second. Connect to it from a
   browser or curl. Compare the complexity to the WebSocket approach.

---

Next: [Lesson 11: gRPC and Protocol Buffers](./11-grpc-protobuf.md)
