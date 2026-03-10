# Networking Reference Glossary

Quick-reference for terms, port numbers, protocols, and tools used throughout
the networking lessons.

---

## OSI Model (Simplified)

```
Layer   Name          What It Does                     Example Protocols
-----   -----------   ------------------------------   -----------------
  7     Application   What your code talks to          HTTP, DNS, SSH
  6     Presentation  Data format / encryption         TLS, JSON, gzip
  5     Session       Manage connections               (rarely discussed)
  4     Transport     Reliable or fast delivery         TCP, UDP, QUIC
  3     Network       Addressing & routing              IP, ICMP
  2     Data Link     Local network delivery            Ethernet, Wi-Fi
  1     Physical      Actual wires / radio waves        Copper, fiber, RF
```

In practice, most developers think in 5 layers (TCP/IP model):

```
TCP/IP Layer      OSI Equivalent    You Care About
--------------    ---------------   -------------------------
Application       7, 6, 5          HTTP, DNS, TLS, gRPC
Transport         4                TCP, UDP, QUIC
Internet          3                IP addressing, routing
Link              2, 1             Ethernet, Wi-Fi, MAC addrs
```

---

## Common Port Numbers

| Port  | Protocol   | Description                        |
|-------|------------|------------------------------------|
| 20    | FTP Data   | File transfer (data channel)       |
| 21    | FTP Ctrl   | File transfer (control channel)    |
| 22    | SSH        | Secure shell / SFTP / SCP          |
| 25    | SMTP       | Email sending                      |
| 53    | DNS        | Domain name resolution             |
| 80    | HTTP       | Web traffic (unencrypted)          |
| 110   | POP3       | Email retrieval                    |
| 143   | IMAP       | Email retrieval (better than POP3) |
| 443   | HTTPS      | Web traffic (TLS encrypted)        |
| 465   | SMTPS      | Email sending (TLS)                |
| 587   | SMTP       | Email submission (STARTTLS)        |
| 993   | IMAPS      | Email retrieval (TLS)              |
| 3000  | Dev        | Common dev server port             |
| 3306  | MySQL      | MySQL database                     |
| 5432  | PostgreSQL | Postgres database                  |
| 5672  | AMQP       | RabbitMQ                           |
| 6379  | Redis      | Redis key-value store              |
| 8080  | HTTP Alt   | Alternative HTTP / dev servers     |
| 8443  | HTTPS Alt  | Alternative HTTPS                  |
| 9092  | Kafka      | Apache Kafka                       |
| 27017 | MongoDB    | MongoDB database                   |

Ports 0-1023 are "well-known" and require root/admin to bind.
Ports 1024-49151 are "registered" (assigned by IANA but anyone can use them).
Ports 49152-65535 are "ephemeral" (used by the OS for outbound connections).

---

## Protocol Summary Table

| Protocol | Layer       | Reliable? | Connection? | Use Case                         |
|----------|-------------|-----------|-------------|----------------------------------|
| TCP      | Transport   | Yes       | Yes         | Web, email, databases, SSH       |
| UDP      | Transport   | No        | No          | DNS, gaming, video, VoIP         |
| QUIC     | Transport   | Yes       | Yes         | HTTP/3, modern web               |
| IP       | Network     | No        | No          | Packet routing (everything uses) |
| ICMP     | Network     | No        | No          | Ping, traceroute, errors         |
| HTTP/1.1 | Application | Via TCP   | Via TCP     | Traditional web                  |
| HTTP/2   | Application | Via TCP   | Via TCP     | Multiplexed web                  |
| HTTP/3   | Application | Via QUIC  | Via QUIC    | Modern fast web                  |
| DNS      | Application | UDP/TCP   | Varies      | Name resolution                  |
| TLS      | Session     | Via TCP   | Yes         | Encryption for HTTPS, etc.       |
| SSH      | Application | Via TCP   | Yes         | Secure remote access             |
| WebSocket| Application | Via TCP   | Yes         | Bidirectional real-time          |
| gRPC     | Application | Via HTTP/2| Yes         | Service-to-service RPC           |

---

## Terminology

### A

**ACK** -- Acknowledgment. A signal from the receiver confirming it received
data. Used in TCP to guarantee delivery.

**ARP (Address Resolution Protocol)** -- Translates IP addresses into MAC
addresses on a local network. "I know the IP, what's the hardware address?"

**Asymmetric Encryption** -- Encryption with two keys: public (for locking)
and private (for unlocking). Slow but solves key distribution. Used in TLS
handshake. RSA and ECDSA are examples.

### B

**Bandwidth** -- The maximum amount of data a connection can carry per second.
Measured in bits per second (Mbps, Gbps). Analogy: the width of a pipe.

**BGP (Border Gateway Protocol)** -- The routing protocol that makes the
internet work. ISPs use BGP to tell each other which IP ranges they can reach.

### C

**CA (Certificate Authority)** -- A trusted organization that signs TLS
certificates, vouching that a domain really belongs to who it claims.
Examples: Let's Encrypt, DigiCert.

**CIDR (Classless Inter-Domain Routing)** -- Notation for IP ranges.
`192.168.1.0/24` means "all IPs where the first 24 bits match" (256 addresses).

**Congestion Control** -- TCP mechanism to detect when the network is
overloaded and slow down sending rate. Algorithms: slow start, congestion
avoidance, fast retransmit.

**CORS (Cross-Origin Resource Sharing)** -- Browser security mechanism. The
server tells the browser which other origins are allowed to make requests.

**Cookie** -- A small piece of data the server sends to the browser, which the
browser sends back with every subsequent request. Used for sessions, auth.

### D

**DHCP (Dynamic Host Configuration Protocol)** -- Automatically assigns IP
addresses to devices when they connect to a network. Your router runs a DHCP
server.

**DNS (Domain Name System)** -- The internet's phone book. Translates domain
names (example.com) into IP addresses (93.184.216.34).

**DNS Record Types:**
- **A** -- Maps domain to IPv4 address
- **AAAA** -- Maps domain to IPv6 address
- **CNAME** -- Alias pointing to another domain name
- **MX** -- Mail exchange server for a domain
- **NS** -- Authoritative nameserver for a domain
- **TXT** -- Arbitrary text (used for SPF, DKIM, verification)
- **SRV** -- Service location (host + port for a service)
- **SOA** -- Start of authority (zone metadata)
- **PTR** -- Reverse DNS (IP to domain)

### E

**Encapsulation** -- Each network layer wraps data from the layer above with
its own header. Like putting a letter in an envelope, then putting that
envelope in a shipping box.

**Ephemeral Port** -- A temporary port number (49152-65535) that the OS assigns
for outbound connections. When you connect to a server, your side uses an
ephemeral port.

**Ethernet** -- The standard for wired local area networks. Defines frame
format, MAC addressing, and physical signaling.

### F

**Firewall** -- Software or hardware that filters network traffic based on
rules (allow/deny by port, IP, protocol).

**Flow Control** -- TCP mechanism where the receiver tells the sender how much
data it can accept (via window size). Prevents overwhelming a slow receiver.

**Frame** -- A data unit at the link layer. Contains source/destination MAC
addresses plus payload.

**FIN** -- TCP flag used to close a connection. Both sides send FIN to
gracefully shut down.

### G

**Gateway** -- The router that connects your local network to the internet.
Your "default gateway" is where packets go when the destination isn't on your
local network.

### H

**HPACK** -- Header compression algorithm used in HTTP/2. Reduces overhead by
encoding commonly-used headers efficiently.

**Header** -- Metadata prepended to data at each network layer. Contains
addresses, sequence numbers, flags, checksums, etc.

**Hop** -- One step in a packet's journey across the internet. Each router the
packet passes through is one hop.

### I

**ICMP (Internet Control Message Protocol)** -- Used for network diagnostics.
`ping` uses ICMP echo request/reply. `traceroute` uses ICMP TTL exceeded.

**IP Address** -- A numerical label assigned to each device on a network.
IPv4: 32-bit (e.g., 192.168.1.1). IPv6: 128-bit (e.g., 2001:db8::1).

### J

**Jitter** -- Variation in packet delay. Low jitter is important for real-time
applications (video calls, gaming). Consistent 50ms latency is better than
latency that bounces between 20ms and 200ms.

### K

**Keep-Alive** -- HTTP mechanism to reuse a TCP connection for multiple
requests instead of opening a new connection each time.

### L

**Latency** -- The time it takes for a packet to travel from source to
destination. Measured in milliseconds. Analogy: the length of the road.

**Load Balancer** -- Distributes incoming requests across multiple servers.
Layer 4 (TCP) or Layer 7 (HTTP). Examples: nginx, HAProxy, AWS ALB.

**Loopback** -- The address `127.0.0.1` (IPv4) or `::1` (IPv6). Refers to
"this machine." `localhost` resolves to loopback.

### M

**MAC Address** -- A 48-bit hardware address burned into a network card.
Format: `AA:BB:CC:DD:EE:FF`. Unique per device (in theory). Used for local
network delivery.

**MTU (Maximum Transmission Unit)** -- The largest packet size a network link
can carry. Ethernet MTU is typically 1500 bytes. Packets larger than MTU are
fragmented.

**Multiplexing** -- Sharing a single connection for multiple streams of data.
HTTP/2 multiplexes many requests on one TCP connection. TCP uses port numbers
to multiplex connections on one IP.

### N

**NAT (Network Address Translation)** -- Your home router translates between
your private IPs (192.168.x.x) and your single public IP. Lets many devices
share one public address.

**Nameserver** -- A DNS server that answers queries for a specific domain zone.

### O

**OSI Model** -- A 7-layer conceptual model for how networks work. Useful for
understanding, though the real internet uses TCP/IP (roughly 4-5 layers).

### P

**Packet** -- A chunk of data at the network layer (IP). Contains source IP,
destination IP, TTL, and payload.

**Port** -- A 16-bit number (0-65535) that identifies a specific service on a
host. Like an apartment number in a building (the building is the IP address).

**Proxy** -- An intermediary server that forwards requests. Forward proxy acts
on behalf of the client. Reverse proxy acts on behalf of the server (e.g.,
nginx in front of an app server).

### Q

**QUIC** -- A UDP-based transport protocol developed by Google. Provides
reliable, multiplexed, encrypted connections. Faster than TCP+TLS. Used by
HTTP/3.

### R

**Round-Trip Time (RTT)** -- The time for a packet to go from sender to
receiver and back. Latency x 2. Important metric for TCP performance.

**Routing** -- The process of forwarding packets from source to destination
across multiple networks. Routers examine destination IPs and forward packets
to the next hop.

**Routing Table** -- A table in a router (or your OS) that maps destination
networks to next-hop addresses. `ip route` or `netstat -rn` shows yours.

### S

**Segment** -- A data unit at the transport layer (TCP). Contains source/dest
ports, sequence numbers, and payload.

**Socket** -- An OS-level endpoint for sending/receiving data. Identified by
(protocol, IP, port). Your code creates sockets to do networking.

**SSL (Secure Sockets Layer)** -- Predecessor to TLS. Deprecated and insecure.
When people say "SSL" today, they usually mean TLS.

**Subnet** -- A logical subdivision of an IP network. Devices on the same
subnet can communicate directly without a router.

**SYN** -- TCP flag used to initiate a connection. The three-way handshake is
SYN, SYN-ACK, ACK.

**SYN Flood** -- A denial-of-service attack that sends many SYN packets
without completing the handshake, exhausting server resources.

### T

**TCP (Transmission Control Protocol)** -- Reliable, ordered, connection-
oriented transport protocol. The backbone of the web.

**TLS (Transport Layer Security)** -- Cryptographic protocol that provides
encryption, authentication, and integrity. HTTPS = HTTP over TLS.

**TTL (Time To Live)** -- A counter in each IP packet, decremented by each
router. When it hits 0, the packet is dropped. Prevents infinite loops.

**Three-Way Handshake** -- TCP's connection setup: SYN -> SYN-ACK -> ACK.

### U

**UDP (User Datagram Protocol)** -- Simple, connectionless transport protocol.
No reliability, no ordering, no flow control. Fast.

**URL (Uniform Resource Locator)** -- A web address.
`https://api.example.com:8443/users?id=42`
scheme://host:port/path?query

### W

**Window Size** -- In TCP, the amount of data the receiver is willing to
accept before needing an acknowledgment. Larger window = higher throughput on
high-latency links.

---

## Common Networking Tools

### curl -- HTTP client

```bash
curl https://httpbin.org/get                 # GET request
curl -X POST -d '{"key":"val"}' \
     -H "Content-Type: application/json" \
     https://httpbin.org/post                # POST with JSON
curl -I https://example.com                  # Headers only (HEAD)
curl -v https://example.com                  # Verbose (see TLS, headers)
curl -o file.zip https://example.com/f.zip   # Download to file
```

### netcat (nc) -- Raw TCP/UDP connections

```bash
nc -l 8080                    # Listen on port 8080
nc localhost 8080             # Connect to port 8080
echo "hello" | nc -u host 53 # Send UDP packet

# Raw HTTP request:
echo -e "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n" | nc example.com 80
```

### dig -- DNS queries

```bash
dig example.com                # Query A record
dig example.com AAAA           # Query IPv6 record
dig example.com MX             # Query mail servers
dig +trace example.com         # Full recursive trace
dig @8.8.8.8 example.com      # Use specific DNS server
dig +short example.com         # Just the IP, nothing else
```

### nslookup -- Simpler DNS queries

```bash
nslookup example.com
nslookup -type=MX example.com
```

### tcpdump -- Packet capture

```bash
sudo tcpdump -i any port 80          # Capture HTTP traffic
sudo tcpdump -i en0 host 8.8.8.8    # Traffic to/from 8.8.8.8
sudo tcpdump -i any -n tcp           # TCP only, no DNS resolution
sudo tcpdump -i any -A port 80      # Print packet contents as ASCII
sudo tcpdump -w capture.pcap        # Save to file (open in Wireshark)
```

### ping -- Test reachability

```bash
ping example.com          # Continuous ping (Ctrl+C to stop)
ping -c 5 example.com     # Send 5 pings then stop
ping -i 0.5 example.com   # Ping every 0.5 seconds
```

### traceroute / tracepath -- Show route to destination

```bash
traceroute example.com     # Show each hop
traceroute -n example.com  # No DNS resolution (faster)
tracepath example.com      # Similar, doesn't need root
```

### ip / ifconfig -- Network interface info

```bash
ip addr                    # Show all interfaces and IPs (Linux)
ip route                   # Show routing table (Linux)
ifconfig                   # Show interfaces (macOS/older Linux)
```

### ss / netstat -- Socket statistics

```bash
ss -tlnp                   # TCP listening sockets with process (Linux)
ss -tunp                   # All TCP/UDP connections with process
netstat -an                # All connections (macOS/older Linux)
lsof -i :8080             # What process is using port 8080?
```

### openssl -- TLS/SSL testing

```bash
openssl s_client -connect example.com:443   # TLS handshake details
openssl x509 -in cert.pem -text            # Read certificate details
openssl req -x509 -newkey rsa:4096 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes                          # Generate self-signed cert
```

---

## Quick Reference: TCP vs UDP

```
                TCP                         UDP
          +--------------+           +--------------+
          | Reliable     |           | Unreliable   |
          | Ordered      |           | Unordered    |
          | Connection   |           | Connectionless|
          | Flow control |           | No control   |
          | 20+ byte hdr |           | 8 byte hdr   |
          | Slower setup |           | No setup     |
          +--------------+           +--------------+
          HTTP, SSH, DB              DNS, gaming,
          Email, file                video, VoIP
          transfer                   streaming
```

---

## Quick Reference: HTTP Status Codes

| Range | Category     | Common Codes                                 |
|-------|-------------|----------------------------------------------|
| 1xx   | Info        | 100 Continue, 101 Switching Protocols        |
| 2xx   | Success     | 200 OK, 201 Created, 204 No Content          |
| 3xx   | Redirect    | 301 Moved Permanently, 302 Found, 304 Not Modified |
| 4xx   | Client Error| 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 405 Method Not Allowed, 409 Conflict, 429 Too Many Requests |
| 5xx   | Server Error| 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

---

Next: Start with [Lesson 01: The Big Picture](./01-big-picture.md)
