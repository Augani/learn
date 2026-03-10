# Lesson 08: HTTP/2 and HTTP/3 -- What Changed and Why

HTTP/1.1 served the web for over 15 years, but its design has fundamental
performance limitations. HTTP/2 and HTTP/3 solve these problems while keeping
the same semantics (methods, headers, status codes) you already know.

---

## HTTP/1.1's Problems

### 1. Head-of-Line (HOL) Blocking

In HTTP/1.1, requests on a single TCP connection are serialized. The second
request cannot begin until the first response is complete:

```
HTTP/1.1 on one TCP connection:

  Request 1 =======>  Response 1 (200ms) ========>
                                                   Request 2 =======>
                                                   Response 2 (50ms) =>
                                                                       Request 3
                                                                       ...

Total: 200 + 50 + ... (sequential)

If Response 1 is slow, everything waits behind it.
This is head-of-line blocking.
```

**Workaround:** Browsers open 6-8 TCP connections per domain. This helps but
creates overhead (each connection needs its own TCP handshake, TLS handshake,
and congestion control ramp-up).

### 2. Redundant Headers

HTTP/1.1 sends headers as uncompressed text with every request. Common headers
(Host, User-Agent, Accept, Cookie) are repeated verbatim for every single
request. A typical request might have 500-800 bytes of headers, and a page
might make 50+ requests. That is 25-40 KB of redundant header data.

### 3. No Server Push

The server can only respond to requests. It cannot proactively send resources
it knows the client will need. The client must:
1. Request the HTML page
2. Parse it and discover it needs CSS and JS
3. Request the CSS and JS files

This creates unnecessary round trips.

---

## HTTP/2: Multiplexing and Binary Framing

HTTP/2 (published 2015, based on Google's SPDY) solves these problems while
keeping the same HTTP semantics.

### Binary Framing

HTTP/1.1 is a text protocol (human-readable). HTTP/2 is a **binary protocol**
(machine-readable). All communication is split into small binary **frames**:

```
HTTP/1.1 (text):               HTTP/2 (binary frames):

GET /index.html HTTP/1.1       +--------+--------+
Host: example.com              |  Frame  | Frame  |
Accept: text/html              | HEADERS | DATA   |
                               | Stream 1| Stream 1|
                               +--------+--------+
                               |  Frame  | Frame  |
                               | HEADERS | DATA   |
                               | Stream 3| Stream 3|
                               +--------+--------+
```

Frame types include HEADERS, DATA, SETTINGS, PING, RST_STREAM, and others.

### Multiplexing: The Big Win

HTTP/2 **multiplexes** multiple requests and responses on a **single TCP
connection**. Requests and responses are broken into frames, and frames from
different streams are interleaved:

```
HTTP/1.1 (sequential, 6 connections):

  Conn 1: [=== Request A ===][=== Response A ===]
  Conn 2: [=== Request B ===][=== Response B ===]
  Conn 3: [=== Request C ===][=== Response C ===]
  Conn 4: [=== Request D ===][=== Response D ===]
  Conn 5: [=== Request E ===][=== Response E ===]
  Conn 6: [=== Request F ===][=== Response F ===]


HTTP/2 (multiplexed, 1 connection):

  Single TCP connection:
  [A-hdr][B-hdr][C-hdr][A-data][B-data][A-data][C-data][B-data]...

  Stream 1 (Request A): [hdr].....[data].........[data].........
  Stream 3 (Request B): .....[hdr]........[data].........[data].
  Stream 5 (Request C): ..........[hdr]...............[data]....

  All happening simultaneously on one connection!
```

### The Highway Analogy

HTTP/1.1 is a **single-lane road**. Only one car (request) can pass at a time.
To move more traffic, you build more roads (open more TCP connections).

HTTP/2 is a **multi-lane highway**. Many cars travel simultaneously on the
same road. One slow truck in lane 1 does not block the cars in lanes 2, 3,
and 4.

### Header Compression (HPACK)

HTTP/2 compresses headers using **HPACK**, which:
1. Uses a static table of 61 common header name-value pairs
2. Maintains a dynamic table of previously-sent headers
3. Uses Huffman encoding for values

```
HTTP/1.1 (every request):
  Host: api.example.com         (20 bytes)
  User-Agent: Mozilla/5.0...    (80 bytes)
  Accept: application/json      (24 bytes)
  Cookie: session=abc123...     (200 bytes)
  Total: ~324 bytes per request

HTTP/2 (after first request):
  Host: (index 62 in dynamic table, 1 byte)
  User-Agent: (index 63, 1 byte)
  Accept: (index 64, 1 byte)
  Cookie: (index 65, 1 byte)
  Total: ~4 bytes per request (98% reduction!)
```

### Server Push (Largely Deprecated)

HTTP/2 allowed servers to proactively send resources before the client
requests them:

```
Client: GET /index.html
Server: Here's /index.html (response)
Server: Here's /style.css (push - I know you'll need it)
Server: Here's /app.js (push - I know you'll need it too)
Client: (never needed to request CSS and JS separately)
```

In practice, server push was hard to use correctly (the server might push
resources the client already has cached) and has been largely deprecated in
favor of other techniques like `103 Early Hints` and preload headers.

### HTTP/2 Streams and Priorities

Each request-response pair is a **stream** identified by a number. Streams
can have priorities and dependencies:

```
Stream 1: GET /index.html     (highest priority - need it first)
Stream 3: GET /critical.css   (high priority - blocks rendering)
Stream 5: GET /app.js         (medium priority)
Stream 7: GET /analytics.js   (low priority - not critical)
Stream 9: GET /hero.jpg       (low priority - visible but not blocking)

The server can serve high-priority streams first.
Odd-numbered streams are client-initiated.
Even-numbered streams are server-initiated (push).
```

---

## HTTP/2's Remaining Problem: TCP HOL Blocking

HTTP/2 solved HOL blocking at the HTTP layer, but TCP still has the same
problem at the transport layer:

```
HTTP/2 multiplexes streams A, B, C on one TCP connection.

TCP sees a single byte stream:
  [A-data][B-data][C-data][A-data][B-data]...

If one TCP packet is lost:
  [A-data][B-data][ LOST ][A-data][B-data]...
                     ^
                     TCP must retransmit this packet.
                     ALL streams (A, B, C) stall until it arrives,
                     even if the lost packet only contained B's data.

This is TCP-level head-of-line blocking.
HTTP/2 cannot fix it because TCP treats everything as one stream.
```

This is worse than HTTP/1.1 in some cases: with 6 separate TCP connections,
a lost packet only blocks 1 of the 6 connections. With HTTP/2 on 1 TCP
connection, a lost packet blocks everything.

---

## HTTP/3: QUIC to the Rescue

HTTP/3 (finalized 2022) replaces TCP with **QUIC** as the transport layer.
QUIC runs over UDP and handles its own reliability, multiplexing, and
encryption.

### Why QUIC Solves TCP HOL Blocking

QUIC is aware of individual streams. If a packet carrying Stream B's data is
lost, only Stream B stalls. Streams A and C continue uninterrupted:

```
QUIC with streams A, B, C:

  Stream A: [data]...[data]...[data]...  (unaffected)
  Stream B: [data]...[LOST]...(wait for retransmit)...[data]
  Stream C: [data]...[data]...[data]...  (unaffected)

Only Stream B stalls. A and C keep flowing.
```

### Faster Connection Setup

```
TCP + TLS 1.3:                     QUIC:
  Client -> SYN                     Client -> Initial (crypto + data)
  Server -> SYN-ACK                 Server -> Initial + Handshake
  Client -> ACK                     Client -> Handshake
  Client -> ClientHello             (connected! 1 RTT total)
  Server -> ServerHello
  (connected! 2+ RTT total)        Resumption (0-RTT):
                                    Client -> Initial + early data
                                    (data sent with FIRST packet!)

RTTs saved = faster page loads, especially on high-latency connections.
```

### Connection Migration

TCP connections are identified by (src IP, src port, dst IP, dst port). If
any of these change (e.g., you switch from Wi-Fi to cellular), the TCP
connection breaks and must be re-established.

QUIC connections are identified by a **Connection ID** in the QUIC header.
If your IP changes, the connection continues with the same Connection ID:

```
TCP:
  Wi-Fi (192.168.1.5) -> TCP connection -> Server
  Switch to cellular (10.0.0.5)
  TCP connection BREAKS (different source IP)
  Must re-establish: new handshake, new TLS, lost state

QUIC:
  Wi-Fi (192.168.1.5) -> QUIC connection (ID: abc123) -> Server
  Switch to cellular (10.0.0.5)
  QUIC connection CONTINUES (same Connection ID: abc123)
  Seamless transition, no interruption
```

### The Full Stack Comparison

```
HTTP/1.1 Stack:        HTTP/2 Stack:        HTTP/3 Stack:
+------------+         +------------+       +------------+
|  HTTP/1.1  |         |   HTTP/2   |       |   HTTP/3   |
+------------+         +------------+       +------------+
|    TLS     |         |    TLS     |       |    QUIC    |
+------------+         +------------+       | (TLS built |
|    TCP     |         |    TCP     |       |  in, over  |
+------------+         +------------+       |  UDP)      |
|     IP     |         |     IP     |       +------------+
+------------+         +------------+       |     IP     |
                                            +------------+

Key differences:
- HTTP/1.1: text, one req at a time, separate TLS
- HTTP/2: binary, multiplexed, separate TLS, still TCP
- HTTP/3: binary, multiplexed, TLS built-in, QUIC over UDP
```

---

## When Each Version Is Used

| Version   | When Used                                       |
|-----------|-------------------------------------------------|
| HTTP/1.1  | Legacy systems, simple APIs, debugging          |
| HTTP/2    | Most modern websites (default in browsers)      |
| HTTP/3    | Growing adoption (Google, Cloudflare, Facebook)  |

Most websites serve HTTP/2 today. HTTP/3 adoption is growing rapidly because
major CDNs (Cloudflare, Google, Akamai) support it. Browsers automatically
negotiate the best version using **ALPN** (Application-Layer Protocol
Negotiation) during the TLS handshake.

As a developer, you rarely need to think about this. Your web framework
(Axum, Actix, Express, etc.) and your reverse proxy (nginx, Caddy) handle the
protocol negotiation. Your application code sees the same request/response
model regardless of HTTP version.

---

## Detecting Which Version Is Used

```bash
# curl can show the HTTP version:
curl -v --http2 https://example.com 2>&1 | grep "< HTTP"
# Output: < HTTP/2 200

# Check HTTP/3 support (requires curl with HTTP/3):
curl -v --http3 https://cloudflare.com 2>&1 | grep "< HTTP"
# Output: < HTTP/3 200

# Chrome DevTools:
# Network tab -> right-click column headers -> enable "Protocol"
# You'll see h2 (HTTP/2) or h3 (HTTP/3) for each request.

# Check what a server supports:
curl -sI https://example.com | grep -i alt-svc
# alt-svc: h3=":443"; ma=86400
# This header advertises HTTP/3 support.
```

---

## Summary Table

| Feature              | HTTP/1.1         | HTTP/2              | HTTP/3           |
|----------------------|------------------|---------------------|------------------|
| Year                 | 1997             | 2015                | 2022             |
| Format               | Text             | Binary              | Binary           |
| Transport            | TCP              | TCP                 | QUIC (over UDP)  |
| Multiplexing         | No               | Yes                 | Yes              |
| HOL Blocking         | Application + TCP| TCP only            | None             |
| Header Compression   | None             | HPACK               | QPACK            |
| Connection setup     | TCP + TLS (2-3 RTT)| TCP + TLS (2-3 RTT)| 1 RTT (0 RTT resume)|
| Connection migration | No               | No                  | Yes              |
| Encryption           | Optional (TLS)   | Effectively required| Always (built-in)|
| Server Push          | No               | Yes (deprecated)    | Yes (deprecated) |

---

## Exercises

### Exercise 1: Check HTTP Version in Use

```bash
# See what version your favorite sites use:
curl -sI https://google.com | head -1
curl -sI https://github.com | head -1
curl -sI https://cloudflare.com | head -1

# Force HTTP/1.1:
curl --http1.1 -sI https://example.com | head -1

# Force HTTP/2:
curl --http2 -sI https://example.com | head -1
```

### Exercise 2: Observe Multiplexing

Open Chrome DevTools (Network tab) and load a complex page. Enable the
"Protocol" column. Notice:
- How many connections are used (should be very few with h2)
- How requests are interleaved (waterfall chart)
- Compare with HTTP/1.1 by disabling HTTP/2 in Chrome flags

### Exercise 3: Check for HTTP/3 Support

```bash
# Look for the Alt-Svc header advertising h3:
curl -sI https://cloudflare.com | grep -i alt-svc
curl -sI https://google.com | grep -i alt-svc

# If you see h3=":443", the server supports HTTP/3.
```

### Exercise 4: Compare Connection Setup Time

```bash
# Time a connection to a server using HTTP/1.1 vs HTTP/2:
curl -w "Connect: %{time_connect}s\nTLS: %{time_appconnect}s\nTotal: %{time_total}s\n" \
  -o /dev/null -s --http1.1 https://example.com

curl -w "Connect: %{time_connect}s\nTLS: %{time_appconnect}s\nTotal: %{time_total}s\n" \
  -o /dev/null -s --http2 https://example.com
```

### Exercise 5: Examine Header Compression

```bash
# Send a request with verbose output and count header bytes:
curl -v https://httpbin.org/get 2>&1 | grep "^>"
# Count the bytes in the headers you sent.

# With HTTP/2, these headers would be compressed by HPACK.
# On a second request to the same server, most headers would
# be just 1 byte each (referencing the dynamic table).
```

---

Next: [Lesson 09: TLS/SSL -- Encryption and HTTPS](./09-tls-ssl.md)
