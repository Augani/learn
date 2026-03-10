# Lesson 12: Sockets -- The Raw Building Block

Every network program you have ever used -- every web server, every database
client, every chat application -- is built on sockets. HTTP, WebSocket, gRPC,
DNS, SSH -- they all use the socket API to send and receive bytes over the
network. This lesson takes you to that foundational layer.

---

## What Is a Socket?

A socket is an endpoint for sending and receiving data across a network. It
is the interface between your application and the operating system's
networking stack.

### The Analogy

**A socket is like a telephone.** You need one on each end to communicate.
You pick up the phone (create a socket), dial a number (connect to an
address), talk and listen (send and receive data), and hang up when done
(close the socket).

A server's socket is like the phone at a business: it has a known number
(IP + port), it waits for incoming calls (listens for connections), and when
someone calls, it picks up (accepts the connection).

A client's socket is like your personal phone: you dial the business number
(connect to the server's address) and start talking.

```
Your Phone (Client Socket)          Business Phone (Server Socket)
     |                                      |
     |  1. You dial their number            |  1. Phone is plugged in (bind)
     |     (connect)                        |  2. Ringer is on (listen)
     |                                      |
     |------- ring ring ------------------>|  3. They pick up (accept)
     |                                      |
     |  "Hi, I'd like to order..."         |
     |====================================|   4. Conversation (send/recv)
     |  "Sure, that'll be $15"            |
     |====================================|
     |                                      |
     |  5. You hang up (close)             |  5. They hang up (close)
```

---

## Socket Types

### Stream Sockets (TCP)

Stream sockets provide a reliable, ordered, bidirectional byte stream. Data
arrives in the same order it was sent, and the OS handles retransmission of
lost packets.

- Protocol: TCP
- Guarantees: ordered delivery, no duplicates, no data loss
- Analogy: a phone call -- continuous, reliable, ordered conversation

### Datagram Sockets (UDP)

Datagram sockets send discrete messages (datagrams) without a persistent
connection. Each message is independent. Messages may arrive out of order,
be duplicated, or be lost entirely.

- Protocol: UDP
- Guarantees: none (best effort)
- Analogy: sending postcards -- each one is independent, might arrive out of
  order, might get lost

```
Stream Socket (TCP)                  Datagram Socket (UDP)

Client         Server               Client         Server
  |--- connect ---->|                  |                |
  |<-- connected ---|                  |-- msg 1 ----->|  no connection
  |                  |                 |-- msg 2 ----->|  step needed
  |== data ========>|                  |-- msg 3 ----->|
  |== data ========>|                  |               |
  |<= data =========|                  |<- msg 2 ------|  might arrive
  |                  |                 |<- msg 1 ------|  out of order
  |--- close ------>|                  |               |  msg 3 lost!
```

---

## The Socket API

The socket API is a set of system calls that every operating system provides.
The functions are the same across Linux, macOS, and Windows (with minor
variations). Every language wraps these same system calls.

### Server Lifecycle (TCP)

```
  socket()      Create a socket file descriptor
     |
  bind()        Assign an address (IP + port) to the socket
     |
  listen()      Mark the socket as passive (ready to accept connections)
     |
  accept()      Wait for and accept an incoming connection
     |           Returns a NEW socket for this specific client
     |
  recv/send()   Read and write data on the client socket
     |
  close()       Close the connection
```

### Client Lifecycle (TCP)

```
  socket()      Create a socket file descriptor
     |
  connect()     Initiate connection to server's address
     |
  send/recv()   Write and read data
     |
  close()       Close the connection
```

### Each Function Explained

**`socket(domain, type, protocol)`** -- Creates a new socket and returns a
file descriptor (an integer the OS uses to identify this socket).
- `domain`: AF_INET (IPv4) or AF_INET6 (IPv6)
- `type`: SOCK_STREAM (TCP) or SOCK_DGRAM (UDP)
- `protocol`: usually 0 (OS picks the right one)

**`bind(socket, address)`** -- Associates the socket with a specific IP
address and port. Servers bind so clients know where to connect. Clients
usually skip bind (the OS assigns a random port).

**`listen(socket, backlog)`** -- Tells the OS this socket will accept
incoming connections. The `backlog` parameter sets how many pending
connections can queue before the OS starts rejecting them.

**`accept(socket)`** -- Blocks until a client connects, then returns a *new*
socket for that specific connection. The original socket continues listening
for more clients. This is a critical detail:

```
Server Socket (listening)
  port 8080
     |
     |--- accept() ---> Client Socket A (connected to client A)
     |--- accept() ---> Client Socket B (connected to client B)
     |--- accept() ---> Client Socket C (connected to client C)
     |
  Still listening for more connections
```

**`connect(socket, address)`** -- Initiates a TCP connection to the server.
For TCP, this triggers the three-way handshake. For UDP, it just sets the
default destination address.

**`send(socket, data)` / `recv(socket, buffer)`** -- Send and receive data.
For TCP, the OS handles breaking large sends into TCP segments and reassembling
received segments into a byte stream. `recv` returns however many bytes are
currently available (not necessarily a complete "message").

**`close(socket)`** -- Closes the socket and frees the file descriptor.

---

## Socket Addresses: IP + Port

A socket address uniquely identifies one end of a network connection. It
consists of an IP address and a port number:

```
Socket Address = IP Address + Port
                 192.168.1.10:8080

IPv4: 32-bit address, ~4 billion possible
      192.168.1.10

IPv6: 128-bit address
      [2001:db8::1]:8080
```

**Well-known ports (0-1023):** Reserved for standard services. HTTP = 80,
HTTPS = 443, SSH = 22, DNS = 53.

**Ephemeral ports (49152-65535):** Assigned by the OS for client connections.
When you connect to a server, the OS picks a random ephemeral port for your
side.

```
Client                              Server
192.168.1.10:54321  <------->  10.0.0.5:8080
(ephemeral port)               (well-known port)
```

---

## Blocking vs Non-Blocking Modes

By default, sockets are **blocking**:
- `accept()` blocks until a client connects
- `recv()` blocks until data arrives
- `send()` blocks until the data is buffered by the OS

This is simple to program but limits concurrency: while waiting for one
client's data, you cannot do anything else.

**Non-blocking mode** makes these calls return immediately:
- `accept()` returns "no connection yet" (EWOULDBLOCK/EAGAIN)
- `recv()` returns "no data yet"
- `send()` returns "buffer full, try later"

Your code must then check back later (polling) or use an event notification
system like epoll/kqueue (covered in Lesson 15).

```
Blocking Mode                    Non-Blocking Mode

recv() called                    recv() called
  |                                |
  | ... waiting ...                |--> EWOULDBLOCK (no data)
  | ... waiting ...                |
  | ... waiting ...              recv() called again
  | ... waiting ...                |--> EWOULDBLOCK (still no data)
  |                                |
  v                              recv() called again
data arrives!                      |--> data arrives! Return it.
return data
```

---

## Important Socket Options

Socket options control low-level behavior. You set them with `setsockopt()`.

### SO_REUSEADDR

When a server closes, its port enters a TIME_WAIT state for ~60 seconds. If
you try to restart the server immediately, `bind()` fails with "address
already in use." `SO_REUSEADDR` allows reuse of the port.

```
Server crashes at 12:00:00
Port 8080 enters TIME_WAIT
Server restarts at 12:00:05

Without SO_REUSEADDR: "Error: address already in use" (must wait ~60s)
With SO_REUSEADDR:    bind() succeeds immediately
```

Always enable this for development servers. In production, it is standard
practice.

### TCP_NODELAY

TCP normally buffers small writes and combines them into larger segments
before sending (Nagle's algorithm). This reduces the number of tiny packets
but adds latency.

```
Without TCP_NODELAY (Nagle enabled):
  send("H")  -- buffered
  send("i")  -- buffered
  send("!")  -- buffered
  ... 200ms later: sends "Hi!" as one packet

With TCP_NODELAY (Nagle disabled):
  send("H")  -- sent immediately
  send("i")  -- sent immediately
  send("!")  -- sent immediately
```

Disable Nagle (enable TCP_NODELAY) when latency matters more than bandwidth
efficiency: games, interactive protocols, RPC calls.

### SO_RCVBUF / SO_SNDBUF

Set the size of the kernel receive and send buffers. Larger buffers improve
throughput for high-bandwidth connections but use more memory.

---

## Sockets in Rust: std::net

Rust's standard library provides socket types that wrap the OS socket API.

### TCP Server

```rust
use std::io::{Read, Write};
use std::net::TcpListener;

fn main() {
    let listener = TcpListener::bind("127.0.0.1:8080").unwrap();
    println!("Listening on 127.0.0.1:8080");

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                let peer = stream.peer_addr().unwrap();
                println!("Connection from {}", peer);

                let mut buffer = [0u8; 1024];
                match stream.read(&mut buffer) {
                    Ok(0) => println!("{} disconnected", peer),
                    Ok(n) => {
                        let received = String::from_utf8_lossy(&buffer[..n]);
                        println!("Received: {}", received);
                        stream.write_all(b"Message received\n").unwrap();
                    }
                    Err(err) => eprintln!("Read error: {}", err),
                }
            }
            Err(err) => eprintln!("Accept error: {}", err),
        }
    }
}
```

### TCP Client

```rust
use std::io::{Read, Write};
use std::net::TcpStream;

fn main() {
    let mut stream = TcpStream::connect("127.0.0.1:8080").unwrap();
    println!("Connected to server");

    stream.write_all(b"Hello from client!").unwrap();

    let mut buffer = [0u8; 1024];
    let n = stream.read(&mut buffer).unwrap();
    let response = String::from_utf8_lossy(&buffer[..n]);
    println!("Server said: {}", response);
}
```

### UDP Socket

UDP has no connection or accept step. You bind to an address and immediately
send/receive datagrams.

```rust
use std::net::UdpSocket;

fn main() {
    let socket = UdpSocket::bind("127.0.0.1:9000").unwrap();
    println!("UDP socket bound to 127.0.0.1:9000");

    let mut buffer = [0u8; 1024];
    let (n, sender) = socket.recv_from(&mut buffer).unwrap();
    let received = String::from_utf8_lossy(&buffer[..n]);
    println!("Received '{}' from {}", received, sender);

    socket.send_to(b"Got your message!", sender).unwrap();
}
```

UDP client:

```rust
use std::net::UdpSocket;

fn main() {
    let socket = UdpSocket::bind("0.0.0.0:0").unwrap();
    socket.send_to(b"Hello UDP!", "127.0.0.1:9000").unwrap();

    let mut buffer = [0u8; 1024];
    let (n, _) = socket.recv_from(&mut buffer).unwrap();
    println!("Response: {}", String::from_utf8_lossy(&buffer[..n]));
}
```

### Setting Socket Options in Rust

```rust
use std::net::TcpListener;

fn main() {
    let listener = TcpListener::bind("127.0.0.1:8080").unwrap();

    // SO_REUSEADDR is set automatically by Rust's TcpListener

    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            // TCP_NODELAY
            stream.set_nodelay(true).unwrap();

            // Non-blocking mode
            stream.set_nonblocking(true).unwrap();

            // Read timeout
            stream
                .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                .unwrap();
        }
    }
}
```

---

## The Relationship Between Sockets and Higher Protocols

Everything you have learned builds on sockets:

```
+-----------------------------------------------------------+
|  Your Application Code                                     |
+-----------------------------------------------------------+
|  HTTP / WebSocket / gRPC / DNS (application protocols)     |
+-----------------------------------------------------------+
|  Sockets API (send, recv, connect, accept)                 |
+-----------------------------------------------------------+
|  TCP / UDP (transport layer -- handled by OS kernel)       |
+-----------------------------------------------------------+
|  IP (network layer -- handled by OS kernel)                |
+-----------------------------------------------------------+
|  Ethernet / Wi-Fi (link layer -- handled by hardware/driver)|
+-----------------------------------------------------------+
```

When you call `TcpStream::connect("10.0.0.5:8080")`, the OS:
1. Creates a socket file descriptor
2. Resolves the address
3. Performs the TCP three-way handshake
4. Returns control to your code

When you call `stream.write_all(b"GET / HTTP/1.1\r\n...")`, the OS:
1. Copies your data into a kernel buffer
2. Breaks it into TCP segments
3. Wraps each segment in an IP packet
4. Wraps each packet in an Ethernet frame
5. Sends the frame out the network interface

You write at the socket level. Everything below is handled for you.

---

## Common Pitfall: TCP Is a Byte Stream, Not a Message Stream

This catches every beginner. TCP does not preserve message boundaries.

If you send "Hello" and then "World", the receiver might get:
- "HelloWorld" (combined into one read)
- "Hel" then "loWorld" (split at an arbitrary point)
- "Hello" then "World" (matching what you sent -- but don't count on it)

```
Sender                         Receiver
send("Hello")                  recv() -> "HelloWor"   (combined + partial)
send("World")                  recv() -> "ld"         (rest of second send)
```

This is why every protocol built on TCP defines message framing:
- HTTP uses `Content-Length` or chunked transfer encoding
- WebSocket wraps every message in a length-prefixed frame
- Protobuf uses varint length prefixes

If you are building your own protocol on raw TCP, you must define your own
framing. Common approaches:
- **Length prefix:** First 4 bytes are the message length, followed by the
  message body
- **Delimiter:** Messages end with `\n` or `\r\n`
- **Fixed size:** Every message is exactly N bytes

---

## Exercises

1. **TCP echo client.** Write a Rust TCP client that:
   - Connects to `127.0.0.1:8080`
   - Reads a line from stdin
   - Sends it to the server
   - Reads the server's response
   - Prints the response
   - Loops until the user types "quit"
   Test it against the TCP server code above (modify the server to echo
   back what it receives).

2. **UDP ping-pong.** Write two programs:
   - A UDP server that receives a message, prepends "pong: " to it, and
     sends it back
   - A UDP client that sends "ping" and prints the response
   Compare the code complexity to the TCP version.

3. **Length-prefixed framing.** Modify the TCP server and client to use
   4-byte length-prefixed messages:
   - Sender: write 4 bytes (big-endian u32) for the message length, then
     write the message bytes
   - Receiver: read 4 bytes to get the length, then read exactly that many
     bytes
   Verify that messages are always received completely, even when sending
   large payloads.

4. **Multiple clients.** Try connecting two clients to the basic TCP server
   at the same time. What happens? (The second client hangs until the first
   disconnects.) This motivates the multi-threaded approach in Lesson 13.

5. **Port scanning.** Write a Rust program that attempts to connect to ports
   1-1024 on `127.0.0.1` with a 100ms timeout. Print which ports are open.
   This is exactly what tools like `nmap` do.

---

Next: [Lesson 13: Building a TCP Echo Server in Rust](./13-tcp-server-rust.md)
