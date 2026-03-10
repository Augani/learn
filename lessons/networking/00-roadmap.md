# Networking From Scratch — How Computers Talk

From electrical signals to HTTP APIs. How the internet actually works,
then build network programs in Rust.

No CS degree assumed. Everyday analogies for everything.

---

## Reference Files

- [Glossary & Cheat Sheet](./reference-glossary.md) — Terms, port numbers, protocol summary

---

## The Roadmap

### Phase 1: Foundations — The Network Stack (Hours 1–12)
- [ ] [Lesson 01: The big picture — how data gets from A to B](./01-big-picture.md)
- [ ] [Lesson 02: Physical & link layer — cables, Wi-Fi, MAC addresses, Ethernet](./02-physical-link.md)
- [ ] [Lesson 03: IP — addressing and routing across the internet](./03-ip-addressing.md)
- [ ] [Lesson 04: TCP — reliable delivery (the backbone of the internet)](./04-tcp.md)
- [ ] [Lesson 05: UDP — fast, unreliable delivery (gaming, video, DNS)](./05-udp.md)
- [ ] [Lesson 06: DNS — how names become IP addresses](./06-dns.md)

### Phase 2: Application Protocols (Hours 13–24)
- [ ] [Lesson 07: HTTP/1.1 — the protocol that runs the web](./07-http.md)
- [ ] [Lesson 08: HTTP/2 and HTTP/3 — what changed and why](./08-http2-http3.md)
- [ ] [Lesson 09: TLS/SSL — encryption and HTTPS](./09-tls-ssl.md)
- [ ] [Lesson 10: WebSockets — persistent bidirectional connections](./10-websockets.md)
- [ ] [Lesson 11: gRPC and Protocol Buffers — service-to-service communication](./11-grpc-protobuf.md)

### Phase 3: Socket Programming in Rust (Hours 25–36)
- [ ] [Lesson 12: Sockets — the raw building block](./12-sockets.md)
- [ ] [Lesson 13: Building a TCP echo server in Rust](./13-tcp-server-rust.md)
- [ ] [Lesson 14: Building a simple HTTP server from scratch](./14-http-server-rust.md)
- [ ] [Lesson 15: Non-blocking I/O, event loops, and why async matters](./15-nonblocking-io.md)

### Phase 4: Practical Networking (Hours 37–44)
- [ ] [Lesson 16: Serialization formats — JSON, Protobuf, MessagePack, CBOR](./16-serialization.md)
- [ ] [Lesson 17: Load balancing, proxies, and CDNs](./17-load-balancing.md)
- [ ] [Lesson 18: Network debugging — tcpdump, wireshark, curl, netcat](./18-debugging-tools.md)

---

## How to use these lessons

Every lesson has:
1. Concept explained with everyday analogies (mail system, phone calls, etc.)
2. Protocol details with ASCII diagrams
3. Rust code you can run to see networking in action
4. Exercises (build something, capture packets, debug)
