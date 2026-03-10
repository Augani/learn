# Lesson 05: UDP -- Fast, Unreliable Delivery

UDP (User Datagram Protocol) is TCP's simpler, faster sibling. Where TCP
guarantees reliable, ordered delivery at the cost of overhead, UDP just fires
packets and moves on. No handshake, no acknowledgments, no retransmissions.

---

## UDP's Job

UDP provides one thing: a way to send a chunk of data (a **datagram**) from
one port to another. That is it.

What UDP does:
- Adds source and destination ports (multiplexing)
- Adds a checksum (optional in IPv4, mandatory in IPv6)
- Sends the datagram

What UDP does NOT do:
- No connection setup (no handshake)
- No guarantee of delivery (packets can be lost)
- No guarantee of ordering (packets can arrive out of order)
- No duplicate detection (same packet can arrive twice)
- No flow control (sender can overwhelm receiver)
- No congestion control (sender can overwhelm network)

### The Postcard Analogy

UDP is like mailing a postcard:

- You write the message, put the address on it, and drop it in the mailbox
- No confirmation that it was delivered
- If you send 5 postcards, they might arrive in any order (or not at all)
- You do not know if the recipient read it
- It is cheap and fast because there is no overhead

TCP, by contrast, is like a registered letter with delivery confirmation,
signature required, and a return receipt.

---

## The UDP Header

The UDP header is tiny -- just 8 bytes. Compare that to TCP's minimum 20 bytes
(and typically 32+ with options).

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Source Port          |       Destination Port        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|            Length             |           Checksum            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         Data ...                             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

That is it. Four fields:
  Source Port:       16 bits (which app sent this)
  Destination Port:  16 bits (which app should receive this)
  Length:            16 bits (header + data, in bytes)
  Checksum:          16 bits (error detection)
```

Compare the two headers side by side:

```
TCP Header (20+ bytes):              UDP Header (8 bytes):
+------------------+                +------------------+
| Src Port         |                | Src Port         |
| Dst Port         |                | Dst Port         |
| Sequence Number  |                | Length           |
| ACK Number       |                | Checksum         |
| Data Offset      |                +------------------+
| Flags (SYN,ACK..)|
| Window Size      |                That's all.
| Checksum         |                No seq numbers.
| Urgent Pointer   |                No ACKs. No flags.
| Options...       |                No window. No state.
+------------------+
```

Less header = less overhead = more of your data per packet = faster.

---

## When to Use UDP

UDP shines when:

1. **Speed matters more than reliability.** A dropped video frame is
   acceptable; waiting 200ms for a retransmission is not.

2. **The data is time-sensitive.** Old data is useless. In a live video call,
   you do not want a retransmitted frame from 500ms ago -- the conversation
   has moved on.

3. **You are doing your own reliability.** Some applications build their own
   reliability on top of UDP (like QUIC) to get TCP-like guarantees with
   better performance characteristics.

4. **The request-response is simple.** DNS queries are typically one UDP packet
   out, one UDP packet back. A full TCP handshake would triple the latency.

### Real-World UDP Applications

| Application       | Why UDP?                                          |
|-------------------|---------------------------------------------------|
| DNS               | Single query/response. TCP handshake would be too slow. |
| Online gaming     | Position updates every 16ms. Old positions are useless. |
| Video streaming   | Dropped frames are invisible. Retransmission adds lag. |
| VoIP (voice calls)| Missing a syllable is better than a 200ms delay. |
| DHCP              | Getting an IP address before you even have one.   |
| NTP (time sync)   | Single packet. Needs to be fast.                  |
| IoT/telemetry     | Tiny sensor readings sent frequently. Loss is OK. |

---

## TCP vs UDP: The Decision Matrix

```
                        Need reliability?
                        /              \
                      YES               NO
                      /                   \
              Use TCP                  Is latency critical?
             HTTP, SSH,                /              \
             databases,              YES               NO
             file transfer          /                   \
                              Use UDP              Either works,
                              gaming,              but UDP is
                              video,               simpler for
                              VoIP                 simple queries
                                                   (DNS, NTP)
```

| Factor               | TCP                      | UDP                    |
|----------------------|--------------------------|------------------------|
| Connection setup     | Three-way handshake      | None                   |
| Delivery guarantee   | Yes                      | No                     |
| Ordering             | Yes                      | No                     |
| Overhead             | High (20+ byte header)   | Low (8 byte header)    |
| Speed                | Slower (due to overhead)  | Faster                 |
| Flow control         | Yes (window)             | No                     |
| Congestion control   | Yes                      | No                     |
| Use case             | Most things              | Real-time, simple query|
| Analogy              | Phone call               | Postcard               |

---

## Multicast and Broadcast

Unlike TCP (which is always point-to-point), UDP supports sending to multiple
recipients at once.

### Broadcast

Send to every device on the local network:

```
Source: 192.168.1.5:5000
Destination: 255.255.255.255:5000 (broadcast)

Every device on the subnet receives this packet.
Used by: DHCP, ARP (sort of), local service discovery.
```

### Multicast

Send to a group of devices that have opted in:

```
Source: 192.168.1.5:5000
Destination: 239.1.2.3:5000 (multicast group address)

Only devices that joined multicast group 239.1.2.3 receive this.
Used by: IPTV, video conferencing, stock market data feeds.

Multicast addresses: 224.0.0.0 - 239.255.255.255

   Sender                 Multicast Group 239.1.2.3
     |
     |----> Router ---+---> Subscriber A (joined)
                      |
                      +---> Subscriber B (joined)
                      |
                      X     Device C (not joined, does not receive)
```

Multicast is efficient because the sender sends one copy and the network
duplicates it only where needed. Without multicast, sending a video stream
to 1000 viewers would require 1000 separate UDP streams from the sender.

---

## QUIC: Reliable UDP

**QUIC** (Quick UDP Internet Connections) is a modern transport protocol
built on top of UDP. It was developed by Google and is now used by HTTP/3.

QUIC takes the best of both worlds:
- Uses UDP as its base (avoids TCP's kernel-level head-of-line blocking)
- Adds reliability, ordering, and congestion control (like TCP)
- Built-in encryption (TLS 1.3 is mandatory)
- Faster connection setup (0-RTT or 1-RTT vs TCP+TLS's 3-RTT)
- Multiplexed streams without head-of-line blocking

```
Traditional Stack:            QUIC Stack:
+------------+                +------------+
|   HTTP/2   |                |   HTTP/3   |
+------------+                +------------+
|    TLS     |                |    QUIC    | (includes TLS 1.3
+------------+                |            |  and reliability)
|    TCP     |                +------------+
+------------+                |    UDP     |
|     IP     |                +------------+
+------------+                |     IP     |
                              +------------+

TCP + TLS handshake:          QUIC handshake:
  SYN          (1 RTT)         ClientHello    (1 RTT total,
  SYN-ACK                      ServerHello     or 0-RTT for
  ACK                          [connected!]    repeat visits)
  ClientHello  (1-2 RTT)
  ServerHello
  [connected!]
  Total: 2-3 RTT              Total: 1 RTT (or 0 RTT)
```

Why not just improve TCP? Because TCP is implemented in OS kernels and
middleboxes (firewalls, NATs) that are hard to update. By building on UDP,
QUIC can be implemented in user space and deployed without waiting for OS
updates. Middleboxes already know how to forward UDP packets.

---

## UDP in Rust

### Sending a UDP Datagram

```rust
use std::net::UdpSocket;

fn main() -> std::io::Result<()> {
    let socket = UdpSocket::bind("0.0.0.0:0")?;

    let message = b"Hello, UDP!";
    let destination = "127.0.0.1:9000";

    socket.send_to(message, destination)?;
    println!("Sent {} bytes to {}", message.len(), destination);

    Ok(())
}
```

### Receiving UDP Datagrams

```rust
use std::net::UdpSocket;

fn main() -> std::io::Result<()> {
    let socket = UdpSocket::bind("127.0.0.1:9000")?;
    println!("Listening on 127.0.0.1:9000");

    let mut buffer = [0u8; 1024];
    loop {
        let (bytes_received, sender_addr) = socket.recv_from(&mut buffer)?;
        let message = std::str::from_utf8(&buffer[..bytes_received])
            .unwrap_or("<invalid utf8>");
        println!("Received from {}: {}", sender_addr, message);
    }
}
```

### UDP Echo Server

```rust
use std::net::UdpSocket;

fn main() -> std::io::Result<()> {
    let socket = UdpSocket::bind("127.0.0.1:9000")?;
    println!("UDP echo server on 127.0.0.1:9000");

    let mut buffer = [0u8; 1024];
    loop {
        let (bytes_received, sender) = socket.recv_from(&mut buffer)?;
        println!(
            "Received {} bytes from {}",
            bytes_received, sender
        );
        socket.send_to(&buffer[..bytes_received], sender)?;
    }
}
```

Notice the differences from the TCP version:
- No `listen()` or `accept()` -- there is no connection to establish
- No `TcpStream` -- you just send and receive datagrams on the socket
- `recv_from()` returns the sender's address with each datagram (since there
  is no persistent connection, each datagram could be from a different sender)
- No ordering guarantee -- if the sender sends packets A, B, C, you might
  receive B, A, C

### Comparing the APIs

```
TCP:                              UDP:
TcpListener::bind(addr)           UdpSocket::bind(addr)
listener.accept()  -> TcpStream   (no equivalent)
TcpStream::connect(addr)          (no equivalent)
stream.read(&mut buf)             socket.recv_from(&mut buf)
stream.write(data)                socket.send_to(data, addr)
(connection state maintained)     (stateless - any addr any time)
```

---

## Practical Example: A Simple Chat Over UDP

```rust
use std::net::UdpSocket;
use std::thread;
use std::io::{self, BufRead};

fn main() -> std::io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: {} <listen_port> <peer_addr:port>", args[0]);
        std::process::exit(1);
    }

    let listen_addr = format!("0.0.0.0:{}", &args[1]);
    let peer_addr = args[2].clone();

    let socket = UdpSocket::bind(&listen_addr)?;
    println!("Listening on {}, sending to {}", listen_addr, peer_addr);

    let recv_socket = socket.try_clone()?;
    thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        loop {
            let (n, src) = recv_socket.recv_from(&mut buffer).unwrap();
            let msg = std::str::from_utf8(&buffer[..n]).unwrap_or("???");
            println!("\n[{}]: {}", src, msg);
        }
    });

    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = line?;
        if line.is_empty() {
            continue;
        }
        socket.send_to(line.as_bytes(), &peer_addr)?;
    }

    Ok(())
}
```

Run two instances:
```bash
# Terminal 1:
cargo run -- 9001 127.0.0.1:9002

# Terminal 2:
cargo run -- 9002 127.0.0.1:9001

# Type messages in either terminal. They appear in the other.
# Messages might be lost or arrive out of order (though on localhost
# this is unlikely). On a real network, it would happen.
```

---

## Exercises

### Exercise 1: Send and Receive UDP with netcat

```bash
# Terminal 1 (receiver):
nc -u -l 9000

# Terminal 2 (sender):
echo "Hello UDP" | nc -u 127.0.0.1 9000

# The message should appear in Terminal 1.
# Note: no connection was established. nc just sent the datagram.
```

### Exercise 2: Run the Rust UDP Echo Server

Take the UDP echo server from this lesson. Compile and run it, then test:

```bash
# Send a datagram:
echo "ping" | nc -u 127.0.0.1 9000

# You should receive "ping" back.
# Try sending multiple messages rapidly.
```

### Exercise 3: Compare TCP and UDP with tcpdump

```bash
# Capture UDP traffic:
sudo tcpdump -i lo0 udp port 9000 -nn

# In another terminal, send some UDP datagrams.
# Compare with TCP capture from Lesson 04.
# Note: no SYN/SYN-ACK/ACK. No FIN. Just raw datagrams.
```

### Exercise 4: DNS Uses UDP

```bash
# Watch DNS queries (UDP port 53):
sudo tcpdump -i any udp port 53 -nn

# In another terminal, resolve a domain:
dig example.com

# In tcpdump, you should see:
# 1. One UDP packet out (the query)
# 2. One UDP packet back (the response)
# No handshake. No teardown. Just two packets.
```

### Exercise 5: Observe Packet Loss (Simulation)

Modify the UDP receiver to drop every 3rd packet:

```rust
use std::net::UdpSocket;

fn main() -> std::io::Result<()> {
    let socket = UdpSocket::bind("127.0.0.1:9000")?;
    let mut buffer = [0u8; 1024];
    let mut count = 0u64;

    loop {
        let (n, src) = socket.recv_from(&mut buffer)?;
        count += 1;
        if count % 3 == 0 {
            println!("DROPPED packet #{} from {}", count, src);
            continue;
        }
        let msg = std::str::from_utf8(&buffer[..n]).unwrap_or("???");
        println!("Received #{}: {}", count, msg);
        socket.send_to(&buffer[..n], src)?;
    }
}
```

Send numbered messages and observe that every 3rd response is missing. This
is what real UDP applications deal with. If your application needs reliability,
you must handle retransmissions yourself (or use TCP/QUIC).

---

Next: [Lesson 06: DNS -- How Names Become IP Addresses](./06-dns.md)
