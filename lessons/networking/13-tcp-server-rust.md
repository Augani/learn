# Lesson 13: Building a TCP Echo Server in Rust

An echo server sends back whatever it receives. It is the "hello world" of
network programming and the perfect vehicle for understanding concurrency
models. This lesson builds the same server three times -- single-threaded,
multi-threaded, and async -- so you can see exactly why async I/O exists.

---

## What We Are Building

```
Client A                Echo Server              Client B
   |                        |                        |
   |--- "hello" ----------->|                        |
   |<-- "hello" ------------|                        |
   |                        |                        |
   |                        |<--- "world" -----------|
   |                        |---- "world" ---------->|
   |                        |                        |
   |--- "foo" ------------->|                        |
   |<-- "foo" --------------|                        |
```

The server accepts TCP connections, reads data from each client, and sends
the same data back. Multiple clients should be able to connect simultaneously.

---

## Version 1: Single-Threaded

The simplest possible implementation. One client at a time.

```rust
use std::io::{Read, Write};
use std::net::TcpListener;

fn handle_client(mut stream: std::net::TcpStream) {
    let peer = stream.peer_addr().unwrap();
    println!("[connect] {}", peer);

    let mut buffer = [0u8; 4096];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => {
                println!("[disconnect] {}", peer);
                return;
            }
            Ok(n) => {
                println!("[recv] {} bytes from {}", n, peer);
                if stream.write_all(&buffer[..n]).is_err() {
                    println!("[error] write failed for {}", peer);
                    return;
                }
            }
            Err(err) => {
                println!("[error] read from {}: {}", peer, err);
                return;
            }
        }
    }
}

fn main() {
    let listener = TcpListener::bind("127.0.0.1:7878").unwrap();
    println!("Echo server v1 (single-threaded) on 127.0.0.1:7878");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => handle_client(stream),
            Err(err) => eprintln!("[error] accept: {}", err),
        }
    }
}
```

### Testing With netcat

Open two terminals:

```bash
# Terminal 1: start the server
cargo run

# Terminal 2: connect as a client
nc 127.0.0.1 7878
hello          # type this
hello          # server echoes it back
```

### The Problem

Try opening a third terminal and connecting a second client:

```bash
# Terminal 3: second client
nc 127.0.0.1 7878
# ... hangs. No response until client 1 disconnects.
```

The server is stuck in `handle_client()` for the first client. It cannot
call `accept()` for the second client until the first one disconnects.

```
Timeline:
  Client A connects ----> Server enters handle_client(A)
  Client B connects ----> Connection queued (listen backlog)
                          Server is blocked reading from A
  Client A sends data --> Server reads, echoes back to A
  Client B sends data --> Sitting in queue, ignored
  Client A disconnects -> Server returns from handle_client(A)
                          Server calls accept() for B
  Client B finally gets served
```

This is unacceptable for any real server. On to version 2.

---

## Version 2: Multi-Threaded (thread::spawn)

Spawn a new OS thread for every incoming connection. Now each client gets its
own thread, and the main thread is free to keep accepting new connections.

```rust
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;

fn handle_client(mut stream: TcpStream) {
    let peer = stream.peer_addr().unwrap();
    println!("[connect] {} (thread {:?})", peer, thread::current().id());

    let mut buffer = [0u8; 4096];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => {
                println!("[disconnect] {}", peer);
                return;
            }
            Ok(n) => {
                println!("[recv] {} bytes from {}", n, peer);
                if stream.write_all(&buffer[..n]).is_err() {
                    println!("[error] write failed for {}", peer);
                    return;
                }
            }
            Err(err) => {
                println!("[error] read from {}: {}", peer, err);
                return;
            }
        }
    }
}

fn main() {
    let listener = TcpListener::bind("127.0.0.1:7878").unwrap();
    println!("Echo server v2 (multi-threaded) on 127.0.0.1:7878");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                thread::spawn(|| handle_client(stream));
            }
            Err(err) => eprintln!("[error] accept: {}", err),
        }
    }
}
```

### What Changed

One line: `thread::spawn(|| handle_client(stream))`. The main thread
immediately returns to `accept()` while the new thread handles the client.

```
Timeline:
  Client A connects ----> Server spawns Thread-1 for A
                          Main thread back to accept()
  Client B connects ----> Server spawns Thread-2 for B
                          Main thread back to accept()
  Client C connects ----> Server spawns Thread-3 for C

  Thread-1: reading/writing with Client A
  Thread-2: reading/writing with Client B  (all concurrent!)
  Thread-3: reading/writing with Client C
```

### Testing

```bash
# Terminal 1: start server
cargo run

# Terminal 2: client A
nc 127.0.0.1 7878
hello
hello

# Terminal 3: client B (works immediately!)
nc 127.0.0.1 7878
world
world
```

Both clients are served simultaneously.

### The Problem

Each OS thread consumes ~2-8 MB of stack memory and requires a kernel context
switch to schedule. With 10,000 concurrent connections, you need 10,000
threads:

```
10,000 threads * 4 MB stack = 40 GB of memory (just for stacks!)
10,000 context switches = significant CPU overhead
```

This is the C10K problem: how do you handle 10,000 concurrent connections
without 10,000 threads? The answer is async I/O.

---

## Version 3: Async With tokio

Instead of one thread per connection, async I/O uses a small pool of threads
(typically one per CPU core) and multiplexes thousands of connections across
them.

### Cargo.toml

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

### The Server

```rust
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

async fn handle_client(mut stream: tokio::net::TcpStream) {
    let peer = stream.peer_addr().unwrap();
    println!("[connect] {}", peer);

    let mut buffer = [0u8; 4096];
    loop {
        match stream.read(&mut buffer).await {
            Ok(0) => {
                println!("[disconnect] {}", peer);
                return;
            }
            Ok(n) => {
                println!("[recv] {} bytes from {}", n, peer);
                if stream.write_all(&buffer[..n]).await.is_err() {
                    println!("[error] write failed for {}", peer);
                    return;
                }
            }
            Err(err) => {
                println!("[error] read from {}: {}", peer, err);
                return;
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("127.0.0.1:7878").await.unwrap();
    println!("Echo server v3 (async/tokio) on 127.0.0.1:7878");

    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                tokio::spawn(handle_client(stream));
            }
            Err(err) => eprintln!("[error] accept: {}", err),
        }
    }
}
```

### What Changed

The code looks almost identical to version 2, but the mechanism underneath
is completely different:

| Aspect | Version 2 (threads) | Version 3 (async) |
|---|---|---|
| `handle_client` | Regular function | `async fn` |
| `read()` / `write()` | Blocking system calls | `.await` (yields to runtime) |
| `thread::spawn` | Creates OS thread | `tokio::spawn` creates lightweight task |
| Memory per connection | ~4 MB (thread stack) | ~few KB (task state) |
| 10,000 connections | 10,000 OS threads | 10,000 tasks on ~8 threads |

When `stream.read(&mut buffer).await` is called and no data is available, the
task yields control back to the tokio runtime. The runtime then runs other
tasks that are ready. When data arrives (the OS notifies via epoll/kqueue),
the runtime resumes this task.

```
Single OS Thread Running Multiple Tasks:

  Time ----->
  |-- Task A: read().await (waiting) --|-- Task B: read().await (data ready!) --|
  |-- Task B: write().await (ready) ---|-- Task C: read().await (waiting) ------|
  |-- Task A: read().await (data!) ----|-- Task A: write().await (ready) -------|

  The thread is never idle. It always runs whichever task has data ready.
```

---

## Handling Client Disconnection Gracefully

A client can disconnect in several ways:
1. **Clean close:** Client sends FIN (TCP close). `read()` returns `Ok(0)`.
2. **Abrupt close:** Client crashes or network drops. `read()` returns
   `Err(ConnectionReset)` or the next `write()` returns `Err(BrokenPipe)`.
3. **Timeout:** Client stops sending but keeps the connection open.

Here is a more robust handler:

```rust
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

async fn handle_client(mut stream: TcpStream) {
    let peer = match stream.peer_addr() {
        Ok(addr) => addr,
        Err(_) => return,
    };
    println!("[connect] {}", peer);

    let mut buffer = [0u8; 4096];
    let idle_timeout = Duration::from_secs(60);

    loop {
        match timeout(idle_timeout, stream.read(&mut buffer)).await {
            Ok(Ok(0)) => {
                println!("[disconnect] {} (clean close)", peer);
                break;
            }
            Ok(Ok(n)) => {
                if let Err(err) = stream.write_all(&buffer[..n]).await {
                    println!("[disconnect] {} (write error: {})", peer, err);
                    break;
                }
            }
            Ok(Err(err)) => {
                println!("[disconnect] {} (read error: {})", peer, err);
                break;
            }
            Err(_) => {
                println!("[timeout] {} (idle for {}s)", peer, idle_timeout.as_secs());
                break;
            }
        }
    }
}
```

---

## Logging Connections

For a production server, you want structured logging. Here is a minimal
approach using `tracing`:

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
tracing-subscriber = "0.3"
```

```rust
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tracing::{error, info, warn};

async fn handle_client(mut stream: tokio::net::TcpStream) {
    let peer = stream.peer_addr().unwrap();
    info!(client = %peer, "connected");

    let mut buffer = [0u8; 4096];
    let mut total_bytes: u64 = 0;

    loop {
        match stream.read(&mut buffer).await {
            Ok(0) => {
                info!(client = %peer, total_bytes, "disconnected");
                return;
            }
            Ok(n) => {
                total_bytes += n as u64;
                if stream.write_all(&buffer[..n]).await.is_err() {
                    warn!(client = %peer, "write failed");
                    return;
                }
            }
            Err(err) => {
                error!(client = %peer, %err, "read error");
                return;
            }
        }
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let listener = TcpListener::bind("127.0.0.1:7878").await.unwrap();
    info!("echo server listening on 127.0.0.1:7878");

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                tokio::spawn(handle_client(stream));
            }
            Err(err) => error!(%err, "accept failed"),
        }
    }
}
```

---

## Testing With netcat

netcat (`nc`) is the simplest way to test TCP servers from the command line.

```bash
# Connect and type messages manually
nc 127.0.0.1 7878

# Send a message and disconnect
echo "hello" | nc 127.0.0.1 7878

# Send a file
nc 127.0.0.1 7878 < some_file.txt

# Keep the connection open and pipe input
cat | nc 127.0.0.1 7878
```

For automated testing, send multiple messages:

```bash
# Send 3 messages with a short delay between each
(echo "one"; sleep 0.1; echo "two"; sleep 0.1; echo "three") | nc 127.0.0.1 7878
```

---

## Performance Comparison

Here is a rough comparison of the three approaches for an echo server under
load (10,000 concurrent connections, each sending 1 message per second):

```
+------------------+----------+-----------+------------+
| Metric           | V1       | V2        | V3         |
|                  | Single   | Threaded  | Async      |
+------------------+----------+-----------+------------+
| Max connections  | 1        | ~2,000*   | 100,000+   |
| Memory per conn  | N/A      | ~4 MB     | ~few KB    |
| Memory at 1K     | N/A      | ~4 GB     | ~10 MB     |
| Context switches | 0        | High      | Minimal    |
| Code complexity  | Trivial  | Low       | Low**      |
| Latency          | High***  | Low       | Low        |
+------------------+----------+-----------+------------+

*  OS thread limit (ulimit) and memory constraints
** With tokio, async code looks almost like sync code
*** Only because other clients are blocked waiting
```

The async version handles orders of magnitude more connections with a
fraction of the memory. This is why every modern Rust web framework (axum,
actix-web, warp) is built on tokio.

---

## The Full Picture

```
Version 1: Single-threaded

  Main Thread
  +-----------------------------------------+
  | accept -> handle(A) -> accept -> handle(B) -> ...
  |           ^^^^^^^^^^           ^^^^^^^^^^
  |           blocked here         blocked here
  +-----------------------------------------+


Version 2: Multi-threaded

  Main Thread         Thread 1        Thread 2        Thread 3
  +------------+   +-----------+   +-----------+   +-----------+
  | accept(A)  |   | handle(A) |   |           |   |           |
  | spawn(A)   |   | read/write|   |           |   |           |
  | accept(B)  |   | ...       |   | handle(B) |   |           |
  | spawn(B)   |   |           |   | read/write|   |           |
  | accept(C)  |   |           |   | ...       |   | handle(C) |
  | spawn(C)   |   |           |   |           |   | read/write|
  +------------+   +-----------+   +-----------+   +-----------+


Version 3: Async (tokio)

  Worker Thread 1 (runs many tasks)     Worker Thread 2 (runs many tasks)
  +----------------------------------+  +----------------------------------+
  | Task A: read().await (waiting)   |  | Task D: write().await (ready)    |
  | Task B: read().await (data!) --> |  | Task E: read().await (waiting)   |
  |   write data back, await next    |  | Task F: read().await (data!) --> |
  | Task C: read().await (data!) --> |  |   write data back, await next    |
  |   write data back               |  | Task D: done, Task G starts      |
  +----------------------------------+  +----------------------------------+
```

---

## Exercises

1. **Run all three versions.** Build and run each version. Test with netcat.
   Verify that v1 blocks on the second client, v2 handles both, and v3
   handles both.

2. **Stress test.** Write a Rust program that opens 100 simultaneous TCP
   connections to the echo server, sends a message on each, reads the echo,
   and verifies correctness. Run it against v2 and v3. Which handles it
   better?

3. **Connection counter.** Add a shared atomic counter that tracks the number
   of active connections. Print it when clients connect and disconnect.
   For v2, use `Arc<AtomicUsize>`. For v3, use the same (tokio tasks can
   share atomics just like threads).

4. **Chat server.** Extend v3 into a chat server: when any client sends a
   message, broadcast it to all other connected clients. Use
   `tokio::sync::broadcast` channel. This is the natural evolution of an
   echo server.

5. **Benchmarking.** Use a tool like `tcpkali` or write your own load
   generator to measure throughput (messages per second) and latency (time
   from send to echo) for v2 and v3 at different connection counts (10, 100,
   1000, 5000). Plot the results.

---

Next: [Lesson 14: Building a Simple HTTP Server From Scratch](./14-http-server-rust.md)
