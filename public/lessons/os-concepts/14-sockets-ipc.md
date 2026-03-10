# Lesson 14: Sockets as IPC — Talking Between Processes

Sockets aren't just for networking across the internet. Unix domain
sockets let processes on the same machine communicate through a fast,
bidirectional channel. They're the backbone of many system services:
Docker talks to its daemon via a socket, PostgreSQL accepts local
connections via a socket, your window manager uses sockets.

---

## Sockets Revisited

A socket is a communication endpoint. You can read from it and write to
it, just like a file. But unlike a file, a socket has another process
on the other end.

```
Two types of sockets:

TCP/IP Socket:                    Unix Domain Socket:
  Address: IP + port                Address: file path
  Scope: any machine on network     Scope: same machine only
  Overhead: full TCP/IP stack       Overhead: minimal (kernel shortcut)
  Example: 127.0.0.1:8080          Example: /tmp/my_app.sock

Both use the SAME API: socket, bind, listen, accept, read, write, close
```

### Why Unix Domain Sockets Are Faster

TCP loopback (127.0.0.1) goes through the entire TCP/IP stack even
though the data never leaves the machine. Unix domain sockets bypass
all of that.

```
TCP loopback path:
  write() → TCP layer → IP layer → loopback interface
  → IP layer → TCP layer → read()
  (checksums, sequence numbers, congestion control — all unnecessary)

Unix domain socket path:
  write() → kernel buffer → read()
  (direct copy between process buffers)

Result: Unix domain sockets are ~2x faster for throughput
        and have lower latency than TCP loopback
```

---

## Stream vs Datagram Sockets

### SOCK_STREAM (Stream Sockets)

Like a phone call — you establish a connection, then send/receive
a continuous stream of bytes. Order is guaranteed. No message boundaries.

```
Stream socket (SOCK_STREAM):

Writer:  write("Hel") → write("lo, ") → write("world!")
Reader:  read() might get "Hello, world!" (all at once)
         or "Hel" then "lo, world!" (split differently)

Key properties:
- Connection-oriented (connect first, then communicate)
- Reliable (data arrives in order, no duplicates)
- No message boundaries (byte stream)
- Bidirectional
```

### SOCK_DGRAM (Datagram Sockets)

Like sending letters — each message is independent, has clear
boundaries, but delivery order isn't guaranteed.

```
Datagram socket (SOCK_DGRAM):

Writer:  sendto("Hello") → sendto("World")
Reader:  recvfrom() gets "Hello" (complete message)
         recvfrom() gets "World" (complete message)

Key properties:
- Connectionless (no connect step needed)
- Message boundaries preserved
- Messages can arrive out of order (for network datagrams)
- For Unix domain datagrams: delivery IS reliable and ordered
- Lower overhead than stream sockets
```

For local IPC, stream sockets are the most common choice.

---

## The Socket Lifecycle

**Analogy: opening a restaurant**

```
Step 1: socket()  ── Get a building
        "I need a place to operate"
        → Returns a file descriptor

Step 2: bind()    ── Put up a sign with your address
        "My restaurant is at 123 Main Street"
        → Associates the socket with an address (file path)

Step 3: listen()  ── Open the doors, hire a host
        "We're open! We can seat up to 5 waiting parties"
        → Mark socket as accepting connections (with a backlog queue)

Step 4: accept()  ── Seat a customer
        "Welcome! Here's your table"
        → Blocks until a client connects
        → Returns a NEW socket for this specific client

Step 5: read()/write()  ── Serve the customer
        "Here's your food / What would you like?"
        → Bidirectional communication on the new socket

Step 6: close()   ── Customer leaves / Restaurant closes
        "Thank you, goodbye"
        → Release the socket
```

```
Server                                Client
──────                                ──────

socket(AF_UNIX, SOCK_STREAM)          socket(AF_UNIX, SOCK_STREAM)
    │                                     │
    ▼                                     │
bind("/tmp/my.sock")                      │
    │                                     │
    ▼                                     │
listen(backlog=5)                         │
    │                                     │
    ▼                                     │
accept() ←─── blocks ──────────────── connect("/tmp/my.sock")
    │                                     │
    ▼ (returns new fd for                 ▼
    │  this client)
    │                                     │
    ├── read(client_fd) ◄──────────── write(fd, request)
    │                                     │
    ├── write(client_fd, response) ──► read(fd)
    │                                     │
    ├── close(client_fd)                  │
    │                                 close(fd)
    │
    ▼
accept() ←─── blocks, waiting for next client
```

---

## Building a Server-Client Pair in Rust

### The Server

```rust
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixListener;
use std::path::Path;

fn run_server(socket_path: &str) -> std::io::Result<()> {
    let path = Path::new(socket_path);
    if path.exists() {
        std::fs::remove_file(path)?;
    }

    let listener = UnixListener::bind(socket_path)?;
    println!("Server listening on {}", socket_path);

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                println!("Client connected!");
                if let Err(err) = handle_client(stream) {
                    eprintln!("Error handling client: {}", err);
                }
            }
            Err(err) => {
                eprintln!("Connection failed: {}", err);
            }
        }
    }

    Ok(())
}

fn handle_client(stream: std::os::unix::net::UnixStream) -> std::io::Result<()> {
    let reader = BufReader::new(&stream);
    let mut writer = &stream;

    for line in reader.lines() {
        let line = line?;
        println!("Received: {}", line);

        if line.trim() == "quit" {
            writeln!(writer, "Goodbye!")?;
            break;
        }

        let response = format!("Echo: {}\n", line.to_uppercase());
        writer.write_all(response.as_bytes())?;
        writer.flush()?;
    }

    println!("Client disconnected.");
    Ok(())
}

fn main() -> std::io::Result<()> {
    run_server("/tmp/echo_server.sock")
}
```

### The Client

```rust
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;

fn run_client(socket_path: &str) -> std::io::Result<()> {
    let stream = UnixStream::connect(socket_path)?;
    println!("Connected to {}", socket_path);

    let mut writer = &stream;
    let mut reader = BufReader::new(&stream);

    let messages = ["Hello, server!", "How are you?", "quit"];

    for msg in &messages {
        writeln!(writer, "{}", msg)?;
        writer.flush()?;
        println!("Sent: {}", msg);

        let mut response = String::new();
        reader.read_line(&mut response)?;
        println!("Got:  {}", response.trim());
    }

    Ok(())
}

fn main() -> std::io::Result<()> {
    run_client("/tmp/echo_server.sock")
}
```

### Running It

```bash
# Terminal 1: start the server
cargo run --bin server

# Terminal 2: run the client
cargo run --bin client

# Output:
# Server: "Client connected!"
# Server: "Received: Hello, server!"
# Client: "Sent: Hello, server!"
# Client: "Got: Echo: HELLO, SERVER!"
# ...
```

---

## Blocking vs Non-Blocking Sockets

By default, socket operations **block** — `accept()` waits forever
until a client connects, `read()` waits until data arrives.

```
Blocking (default):
  accept() → thread sits idle until connection arrives
  read()   → thread sits idle until data arrives

Non-blocking:
  accept() → returns immediately with EAGAIN if no connection
  read()   → returns immediately with EAGAIN if no data
```

Non-blocking is useful when you need to handle multiple clients
without one thread per client. But raw non-blocking code is complex
(busy-loop checking is wasteful). Enter: event-driven I/O.

---

## Select/Poll/Epoll: Monitoring Multiple Sockets

With multiple clients, you need to know WHICH socket has data ready.

### The Problem

```
Naive approach: one thread per client

Client 1 ──→ Thread 1 (read loop)
Client 2 ──→ Thread 2 (read loop)
Client 3 ──→ Thread 3 (read loop)
...
Client 10000 ──→ Thread 10000 (read loop)

Problem: 10,000 threads = huge memory usage, context switch overhead
```

### The Solution: Event-Driven I/O

```
Event-driven approach: one thread, many clients

                  ┌──────────────────────┐
Client 1 ──fd3──→│                      │
Client 2 ──fd4──→│  epoll / kqueue      │──→ "fd 4 is readable"
Client 3 ──fd5──→│  (kernel watches     │    "fd 7 is writable"
Client 4 ──fd6──→│   all fds for you)   │
Client 5 ──fd7──→│                      │
                  └──────────────────────┘
                           │
                    Single thread handles
                    only the ready ones
```

### Evolution of event APIs

```
select()  (1983)  — limited to 1024 fds, scans all fds every time
                    O(n) per call

poll()    (1997)  — no fd limit, but still scans all fds
                    O(n) per call

epoll()   (Linux 2002)  — kernel tracks changes, returns only ready fds
                          O(1) per event, scales to millions of fds

kqueue()  (BSD/macOS)   — similar to epoll, used on macOS/FreeBSD
```

In practice, you use a library that wraps these:
- **mio** (Rust): cross-platform event loop (epoll on Linux, kqueue on macOS)
- **tokio** (Rust): async runtime built on mio
- **libuv** (C): used by Node.js

---

## Multi-Client Server with Threads

A practical server that handles multiple clients concurrently:

```rust
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixListener;
use std::path::Path;
use std::thread;

fn main() -> std::io::Result<()> {
    let socket_path = "/tmp/multi_server.sock";
    let path = Path::new(socket_path);
    if path.exists() {
        std::fs::remove_file(path)?;
    }

    let listener = UnixListener::bind(socket_path)?;
    println!("Server listening on {}", socket_path);

    let mut client_id = 0u64;

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                client_id += 1;
                let id = client_id;

                thread::spawn(move || {
                    println!("[client {}] Connected", id);

                    let reader = BufReader::new(&stream);
                    let mut writer = &stream;

                    for line in reader.lines() {
                        match line {
                            Ok(line) => {
                                if line.trim() == "quit" {
                                    let _ = writeln!(writer, "Goodbye, client {}!", id);
                                    break;
                                }
                                let response = format!("[{}] Echo: {}\n", id, line);
                                if writer.write_all(response.as_bytes()).is_err() {
                                    break;
                                }
                                let _ = writer.flush();
                            }
                            Err(_) => break,
                        }
                    }

                    println!("[client {}] Disconnected", id);
                });
            }
            Err(err) => eprintln!("Accept failed: {}", err),
        }
    }

    Ok(())
}
```

---

## Async Server with Tokio

For high-concurrency servers, async is more efficient than threads:

```rust
// Cargo.toml:
// tokio = { version = "1", features = ["full"] }

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixListener;
use std::path::Path;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let socket_path = "/tmp/async_server.sock";
    if Path::new(socket_path).exists() {
        std::fs::remove_file(socket_path)?;
    }

    let listener = UnixListener::bind(socket_path)?;
    println!("Async server listening on {}", socket_path);

    let mut client_id = 0u64;

    loop {
        let (stream, _addr) = listener.accept().await?;
        client_id += 1;
        let id = client_id;

        tokio::spawn(async move {
            println!("[client {}] Connected", id);

            let (reader, mut writer) = stream.into_split();
            let mut reader = BufReader::new(reader);
            let mut line = String::new();

            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(_) => {
                        let trimmed = line.trim();
                        if trimmed == "quit" {
                            let _ = writer.write_all(b"Goodbye!\n").await;
                            break;
                        }
                        let response = format!("[{}] Echo: {}", id, line);
                        if writer.write_all(response.as_bytes()).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }

            println!("[client {}] Disconnected", id);
        });
    }
}
```

---

## Socket Files on Disk

Unix domain sockets create a special file on the file system:

```bash
$ ls -la /tmp/my_server.sock
srwxrwxrwx 1 alice alice 0 Mar 15 10:30 /tmp/my_server.sock
│
└── 's' means socket file

$ file /tmp/my_server.sock
/tmp/my_server.sock: socket

$ stat /tmp/my_server.sock
# Shows: type=socket
```

The socket file is just a rendezvous point — no data is stored in it.
When the server exits, the socket file remains (stale). That's why
servers typically remove the socket file before binding:

```rust
if Path::new(socket_path).exists() {
    std::fs::remove_file(socket_path)?;
}
```

---

## Real-World Unix Socket Examples

```bash
# Docker daemon
ls -la /var/run/docker.sock

# PostgreSQL
ls -la /var/run/postgresql/.s.PGSQL.5432

# SSH agent
echo $SSH_AUTH_SOCK
ls -la $SSH_AUTH_SOCK

# systemd
ls -la /run/systemd/journal/socket

# Nginx (when configured for Unix sockets)
# upstream backend { server unix:/tmp/app.sock; }
```

---

## Exercises

### Exercise 1: Build an Echo Server and Client

Build the server and client from the examples above. Test them:

```bash
# Terminal 1
cargo run --bin server

# Terminal 2
cargo run --bin client

# Or use socat to test manually:
socat - UNIX-CONNECT:/tmp/echo_server.sock
# Type messages, see echoes
```

### Exercise 2: Multi-Client Chat Server

Extend the multi-client server into a simple chat room:
- Each client picks a username on connect
- Messages from any client are broadcast to all connected clients
- Handle disconnections gracefully

Hint: use `Arc<Mutex<Vec<UnixStream>>>` to share the client list, or
use channels (`std::sync::mpsc`) with a broadcast pattern.

### Exercise 3: Request-Response Protocol

Design a simple binary protocol over Unix domain sockets:

```
Request format:
  [1 byte: command] [2 bytes: payload length] [N bytes: payload]

Commands:
  0x01 = ECHO   (server returns the payload)
  0x02 = UPPER  (server returns payload uppercased)
  0x03 = LEN    (server returns payload length as string)

Response format:
  [1 byte: status] [2 bytes: payload length] [N bytes: payload]

Status:
  0x00 = OK
  0x01 = ERROR
```

Implement the server and client using raw byte I/O (no line-based
protocol).

### Exercise 4: Benchmark TCP vs Unix Domain Socket

Write a benchmark that sends 100,000 small messages and measures
throughput for:
1. TCP socket on 127.0.0.1:8080
2. Unix domain socket on /tmp/bench.sock

Measure: messages per second, total time, average latency.

### Exercise 5: socat Exploration

Use `socat` to explore socket communication:

```bash
# Create a Unix domain socket server that echoes
socat UNIX-LISTEN:/tmp/test.sock,fork EXEC:/bin/cat

# Connect to it
socat - UNIX-CONNECT:/tmp/test.sock

# Forward a Unix socket to a TCP port
socat TCP-LISTEN:8080,fork UNIX-CONNECT:/var/run/docker.sock

# Create a bidirectional pipe between two sockets
socat UNIX-LISTEN:/tmp/a.sock UNIX-LISTEN:/tmp/b.sock
```

---

Next: [Lesson 15: Working with the OS from Rust](./15-rust-os-apis.md)
