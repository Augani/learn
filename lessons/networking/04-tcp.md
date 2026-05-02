# Lesson 04: TCP -- Reliable Delivery

TCP (Transmission Control Protocol) is the workhorse of the internet. It
provides reliable, ordered, error-checked delivery of data between
applications. HTTP, SSH, email, databases -- almost everything that matters
runs over TCP.

---

## TCP's Job

IP can deliver packets, but it makes no guarantees:
- Packets can be lost
- Packets can arrive out of order
- Packets can be duplicated
- Packets can be corrupted

TCP sits on top of IP and fixes all of this. It provides:
- **Reliable delivery:** every byte you send arrives at the destination
- **Ordered delivery:** bytes arrive in the same order they were sent
- **Error detection:** corrupted data is detected and retransmitted
- **Flow control:** the sender does not overwhelm the receiver
- **Congestion control:** the sender does not overwhelm the network

### The Phone Call Analogy

TCP is like a phone call:

1. You **dial** the number (connection setup -- three-way handshake)
2. The other person **picks up** (connection established)
3. You talk **back and forth** (data transfer with acknowledgments)
4. If you miss something, you say **"can you repeat that?"** (retransmission)
5. When done, you say **"goodbye"** and **hang up** (connection teardown)

Contrast this with UDP (Lesson 05), which is like shouting into a crowd -- you
send your message and hope someone hears it.

---

## The Three-Way Handshake

Before any data can flow, TCP establishes a connection with a three-way
handshake. Both sides agree on initial sequence numbers and confirm they can
communicate.

```
  Client                                  Server
    |                                       |
    |  1. SYN (seq=100)                     |
    |  "Hello, I'd like to connect."        |
    |  "My starting sequence number is 100" |
    | ------------------------------------> |
    |                                       |
    |  2. SYN-ACK (seq=300, ack=101)        |
    |  "Hello! I accept."                   |
    |  "My starting number is 300."         |
    |  "I expect your next byte to be 101." |
    | <------------------------------------ |
    |                                       |
    |  3. ACK (ack=301)                     |
    |  "Great, let's talk."                 |
    |  "I expect your next byte to be 301." |
    | ------------------------------------> |
    |                                       |
    |  CONNECTION ESTABLISHED               |
    |  (data can now flow both ways)        |
    |                                       |
```

**SYN** = Synchronize. "I want to start a connection."
**ACK** = Acknowledge. "I received your message."
**SYN-ACK** = Both at once. "I accept your connection AND here's my info."

Why three steps? Because both sides need to:
1. Agree to the connection
2. Exchange starting sequence numbers
3. Confirm both directions work

Two steps would not confirm the client can receive (the server's SYN-ACK might
get lost and the server would never know).

---

## Sequence Numbers and Acknowledgments

TCP treats data as a **stream of bytes**, not individual packets. Every byte
has a sequence number. The receiver acknowledges which bytes it has received.

```
Client sends 3 segments of data:

  Client                                     Server
    |                                          |
    |  Segment 1: seq=101, 100 bytes of data   |
    |  "Here are bytes 101-200"                |
    | ---------------------------------------->|
    |                                          |
    |  Segment 2: seq=201, 100 bytes of data   |
    |  "Here are bytes 201-300"                |
    | ---------------------------------------->|
    |                                          |
    |             ACK: ack=301                 |
    |  "I got everything up to byte 300."      |
    |  "Send me byte 301 next."                |
    |<---------------------------------------- |
    |                                          |
    |  Segment 3: seq=301, 100 bytes of data   |
    | ---------------------------------------->|
    |                                          |

The ACK number means: "I have received all bytes BEFORE this number.
Send me this byte next." This is called a cumulative acknowledgment.
```

### What Happens When a Packet Is Lost?

```
  Client                                     Server
    |                                          |
    |  seq=101, 100 bytes                      |
    | ---------------------------------------->|  Received!
    |                                          |
    |  seq=201, 100 bytes                      |
    | --------X (LOST!)                        |  Never arrived
    |                                          |
    |  seq=301, 100 bytes                      |
    | ---------------------------------------->|  Received (out of order)
    |                                          |
    |             ACK: ack=201                 |
    |  "I still need byte 201."               |
    |<---------------------------------------- |
    |             ACK: ack=201  (duplicate)    |
    |  "I STILL need byte 201!"               |
    |<---------------------------------------- |
    |                                          |
    | After timeout or 3 duplicate ACKs:       |
    |  seq=201, 100 bytes (RETRANSMIT)         |
    | ---------------------------------------->|  Received!
    |                                          |
    |             ACK: ack=401                 |
    |  "Got everything up to 400 now."         |
    |<---------------------------------------- |
```

The receiver keeps ACK-ing the last contiguous byte it received. When the
sender sees multiple duplicate ACKs (typically 3), it retransmits the missing
segment without waiting for the full timeout. This is called **fast
retransmit**.

---

## Flow Control: Window Size

What if the sender is much faster than the receiver? The receiver's buffer
would overflow and data would be lost. TCP prevents this with **flow control**.

The receiver advertises a **window size** -- the amount of buffer space it has
available. The sender must not send more unacknowledged data than the window
allows.

```
  Client                                     Server
    |                                          |
    |  "My window size is 3000 bytes"          |
    |<--(advertised in every ACK)------------- |
    |                                          |
    |  Send 1000 bytes  (1000/3000 used)       |
    | ---------------------------------------->|
    |  Send 1000 bytes  (2000/3000 used)       |
    | ---------------------------------------->|
    |  Send 1000 bytes  (3000/3000 used)       |
    | ---------------------------------------->|
    |                                          |
    |  MUST WAIT for ACK before sending more   |
    |  (window is full)                        |
    |                                          |
    |             ACK + window=3000            |
    |  "Got your data. I have room again."     |
    |<---------------------------------------- |
    |                                          |
    |  Send more data...                       |

If the receiver is busy:
    |             ACK + window=0               |
    |  "STOP! My buffer is full."              |
    |<---------------------------------------- |
    |                                          |
    |  (client waits, probes periodically)     |
    |                                          |
    |             ACK + window=2000            |
    |  "OK, I have room again."               |
    |<---------------------------------------- |
```

Window size is dynamic. A fast receiver advertises a large window. A slow
receiver shrinks it. A receiver with a full buffer sets it to 0 (sender stops
completely).

---

## Congestion Control

Flow control prevents overwhelming the **receiver**. Congestion control
prevents overwhelming the **network**.

If everyone sends as fast as possible, routers get overloaded, drop packets,
and things get worse (congestion collapse). TCP detects congestion and backs
off.

### The Highway Analogy

Imagine a highway feeding into a narrow bridge:

- If cars arrive at the bridge faster than it can handle, a traffic jam forms
- Smart drivers notice the backup and slow down (congestion control)
- As the jam clears, they gradually speed up again

### How TCP Detects Congestion

- **Packet loss** (timeout or triple duplicate ACK) = the network is
  congested somewhere
- **Increased RTT** = queues are building up at routers

### The Algorithm (Simplified)

```
1. SLOW START: Begin with a small congestion window (cwnd = 1 MSS).
   Double the window each RTT (1 -> 2 -> 4 -> 8 -> 16...).
   Exponential growth.

2. CONGESTION AVOIDANCE: Once cwnd reaches a threshold (ssthresh),
   grow linearly (add 1 MSS per RTT instead of doubling).

3. PACKET LOSS DETECTED:
   - Timeout: Severe. Reset cwnd = 1 MSS, start over (slow start).
   - Triple duplicate ACK: Moderate. Cut cwnd in half (fast recovery).

Sending Rate
     ^
     |          * (packet loss!)
     |        *   \
     |      *      \  <-- cut in half (fast recovery)
     |    *         \
     |  *            *
     | *           *
     |*          *
     *---------*---------*--------> Time
     ^         ^
     Slow      Congestion
     Start     Avoidance
```

Modern TCP variants (CUBIC, BBR) use more sophisticated algorithms, but the
core idea is the same: probe for available bandwidth, back off when you
detect congestion.

---

## Connection Teardown

When both sides are done, they gracefully close the connection with a four-way
handshake (or sometimes three-way if combined):

```
  Client                                  Server
    |                                       |
    |  FIN (seq=500)                        |
    |  "I'm done sending data."             |
    | ------------------------------------> |
    |                                       |
    |  ACK (ack=501)                        |
    |  "OK, I acknowledge your FIN."        |
    | <------------------------------------ |
    |                                       |
    |  (server may still send data here)    |
    |                                       |
    |  FIN (seq=700)                        |
    |  "I'm done sending too."              |
    | <------------------------------------ |
    |                                       |
    |  ACK (ack=701)                        |
    |  "OK, connection closed."             |
    | ------------------------------------> |
    |                                       |
    |  Both sides closed.                   |
```

FIN means "I have no more data to send." But it can still receive until it
also sends a FIN. This is called a **half-close** -- one direction is closed
while the other remains open.

---

## TCP Ports: Multiplexing Connections

A single server might handle thousands of connections simultaneously. How does
the OS know which connection each packet belongs to? **Ports.**

A TCP connection is uniquely identified by a **4-tuple**:

```
(Source IP, Source Port, Destination IP, Destination Port)

Example:
  Your browser:    192.168.1.5 : 52431   ->  93.184.216.34 : 443
  Your API call:   192.168.1.5 : 52432   ->  93.184.216.34 : 443
  Your SSH:        192.168.1.5 : 52433   ->  10.0.0.50     : 22

All from the same machine, all using different source ports.
```

### The Apartment Building Analogy

Think of an IP address as a building and ports as apartment numbers:

```
Server: 93.184.216.34 (the building)
  +---+---+---+---+---+
  | 22| 80|443|5432| ..|
  +---+---+---+---+---+
  SSH  HTTP HTTPS Postgres

Each port has a different service answering the door.
```

### Well-Known Ports

| Port | Service   | Protocol | Notes                          |
|------|-----------|----------|--------------------------------|
| 22   | SSH       | TCP      | Secure shell, file transfer    |
| 25   | SMTP      | TCP      | Email sending                  |
| 53   | DNS       | UDP/TCP  | Name resolution                |
| 80   | HTTP      | TCP      | Unencrypted web                |
| 443  | HTTPS     | TCP      | Encrypted web (TLS)            |
| 3306 | MySQL     | TCP      | MySQL database                 |
| 5432 | PostgreSQL| TCP      | Postgres database              |
| 6379 | Redis     | TCP      | Redis key-value store          |
| 8080 | HTTP Alt  | TCP      | Common development port        |

Ports 0-1023 require root/admin to bind (well-known ports).
Your OS assigns ephemeral ports (49152-65535) for outbound connections.

---

## TCP State Machine

A TCP connection goes through defined states. Understanding these helps when
debugging connection issues (ever seen TIME_WAIT eating all your ports?):

```
                     +--------+
                     | CLOSED |
                     +--------+
                      /      \
            (passive open)   (active open, send SYN)
                    /          \
              +---------+    +----------+
              | LISTEN  |    | SYN_SENT |
              +---------+    +----------+
                    |              |
          (recv SYN,          (recv SYN-ACK,
           send SYN-ACK)      send ACK)
                    |              |
              +----------+        |
              | SYN_RCVD |        |
              +----------+        |
                    |              |
              (recv ACK)          |
                    \            /
                     +----------+
                     |ESTABLISHED|  <-- Data flows here
                     +----------+
                      /        \
           (send FIN)           (recv FIN, send ACK)
                    /             \
            +---------+      +-----------+
            |FIN_WAIT1|      |CLOSE_WAIT |
            +---------+      +-----------+
                  |                |
         (recv ACK)         (send FIN)
                  |                |
            +---------+      +-----------+
            |FIN_WAIT2|      | LAST_ACK  |
            +---------+      +-----------+
                  |                |
         (recv FIN,          (recv ACK)
          send ACK)               |
                  |           +--------+
            +-----------+     | CLOSED |
            | TIME_WAIT |     +--------+
            +-----------+
                  |
            (wait 2*MSL)
                  |
            +--------+
            | CLOSED |
            +--------+
```

### TIME_WAIT: The Gotcha

After closing a connection, the client enters `TIME_WAIT` for 2*MSL (Maximum
Segment Lifetime, typically 60 seconds). During this time, the port is
unavailable for new connections.

**Why it exists:** To handle delayed packets from the old connection that
might arrive and confuse a new connection on the same port.

**Why it matters:** A high-traffic server closing many short-lived connections
can exhaust ephemeral ports due to TIME_WAIT. This is why connection pooling
and keep-alive connections matter.

```bash
# See connections in TIME_WAIT:
# macOS:
netstat -an | grep TIME_WAIT
# Linux:
ss -tan state time-wait
```

---

## The TCP Header

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Source Port          |       Destination Port        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        Sequence Number                       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    Acknowledgment Number                     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  Data |       |U|A|P|R|S|F|                                  |
| Offset| Rsrvd |R|C|S|S|Y|I|            Window Size           |
|       |       |G|K|H|T|N|N|                                  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           Checksum            |         Urgent Pointer        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    Options (if Data Offset > 5)              |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

Key fields:
  Source/Dest Port:  16 bits each (0-65535)
  Sequence Number:   32 bits. Byte offset of this segment's data.
  ACK Number:        32 bits. Next byte the receiver expects.
  Flags:             SYN, ACK, FIN, RST, PSH, URG
  Window Size:       16 bits. How many bytes the receiver can accept.
  Checksum:          Error detection for header + data.

Minimum header size: 20 bytes (no options).
With options (timestamps, etc.): up to 60 bytes.
```

---

## TCP in Rust

Here is a simple TCP client and server in Rust using the standard library:

### TCP Server (Echo)

```rust
use std::io::{Read, Write};
use std::net::TcpListener;

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080")?;
    println!("Listening on 127.0.0.1:8080");

    for stream in listener.incoming() {
        let mut stream = stream?;
        let peer = stream.peer_addr()?;
        println!("Connection from {}", peer);

        let mut buffer = [0u8; 1024];
        loop {
            let bytes_read = stream.read(&mut buffer)?;
            if bytes_read == 0 {
                println!("{} disconnected", peer);
                break;
            }
            stream.write_all(&buffer[..bytes_read])?;
        }
    }
    Ok(())
}
```

### TCP Client

```rust
use std::io::{Read, Write};
use std::net::TcpStream;

fn main() -> std::io::Result<()> {
    let mut stream = TcpStream::connect("127.0.0.1:8080")?;
    println!("Connected to server");

    let message = b"Hello, TCP!";
    stream.write_all(message)?;

    let mut buffer = [0u8; 1024];
    let bytes_read = stream.read(&mut buffer)?;

    let response = std::str::from_utf8(&buffer[..bytes_read])
        .unwrap_or("<invalid utf8>");
    println!("Server echoed: {}", response);

    Ok(())
}
```

### What Happens Under the Hood

When you call `TcpStream::connect()`:
1. OS sends SYN to the server
2. Server responds with SYN-ACK
3. OS sends ACK
4. `connect()` returns a `TcpStream` (the connection is established)

When you call `stream.write_all()`:
1. Data goes into the OS send buffer
2. OS breaks it into TCP segments
3. Each segment gets a sequence number
4. OS sends segments and waits for ACKs
5. If no ACK comes back, OS retransmits automatically

When you call `stream.read()`:
1. OS receives segments from the network
2. Reorders them by sequence number
3. Puts them in the receive buffer
4. `read()` copies data from the receive buffer to your application

All the reliability, ordering, and retransmission happens in the OS kernel,
invisible to your code.

---

## Exercises

### Exercise 1: Watch the Handshake

```bash
# In one terminal, start capturing TCP traffic:
sudo tcpdump -i lo0 port 8080 -nn

# In another terminal, start a server (netcat):
nc -l 8080

# In a third terminal, connect:
nc localhost 8080

# In the tcpdump output, you should see:
# 1. SYN        (Flags [S])
# 2. SYN-ACK    (Flags [S.])
# 3. ACK        (Flags [.])

# Type something and watch the data + ACK exchange.
# Press Ctrl+C and watch the FIN exchange.
```

### Exercise 2: See TCP States

```bash
# Start a server:
nc -l 8080 &

# Connect to it:
nc localhost 8080 &

# See the connection state:
# macOS:
netstat -an | grep 8080
# Linux:
ss -tan | grep 8080

# You should see ESTABLISHED connections.
# Close one side and check again -- look for TIME_WAIT, FIN_WAIT, etc.
```

### Exercise 3: Run the Rust Echo Server

Take the TCP server code from this lesson. Run it, then connect with:

```bash
nc localhost 8080
# Type messages and see them echoed back.
# Try connecting multiple clients simultaneously.
```

### Exercise 4: Observe Retransmission

```bash
# Capture traffic with sequence numbers visible:
sudo tcpdump -i en0 -nn -S port 80

# Visit a website in your browser.
# Look at the sequence and acknowledgment numbers.
# Do they increment as expected?
```

### Exercise 5: Count TIME_WAIT Connections

```bash
# On a busy server (or after running many short connections):
# macOS:
netstat -an | grep TIME_WAIT | wc -l
# Linux:
ss -tan state time-wait | wc -l

# If the count is high, it means the server is closing many
# short-lived connections. Connection pooling would help.
```

---

Next: [Lesson 05: UDP -- Fast, Unreliable Delivery](./05-udp.md)
