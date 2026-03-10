# Lesson 18: Network Debugging -- tcpdump, Wireshark, curl, netcat

When something breaks in a networked system, the problem could be anywhere:
DNS, the network path, TLS, the HTTP request, the server, a proxy, a
firewall. This lesson equips you with the tools to systematically isolate
where the problem is.

---

## The Debugging Mindset

Network debugging works from the bottom up. Start with the most basic
question and build from there:

```
1. Can I reach the server at all?              --> ping, traceroute
2. Is DNS resolving correctly?                 --> dig, nslookup
3. Is the TCP connection being established?    --> nc, tcpdump
4. Is TLS working?                             --> openssl s_client
5. Is the HTTP request/response correct?       --> curl -v
6. What's happening on the wire?               --> tcpdump, Wireshark
```

---

## curl: The Swiss Army Knife of HTTP

curl is the most versatile HTTP debugging tool. If you learn one tool from
this lesson, make it curl.

### Basic Usage

```bash
# Simple GET request
curl https://httpbin.org/get

# See full request and response headers (-v = verbose)
curl -v https://httpbin.org/get

# Only show response headers
curl -I https://httpbin.org/get

# Follow redirects (-L)
curl -L http://httpbin.org/redirect/3
```

### Setting Headers

```bash
# Custom headers (-H)
curl -H "Authorization: Bearer my-token" \
     -H "Accept: application/json" \
     https://api.example.com/users
```

### Sending Data (POST)

```bash
# POST with JSON body
curl -X POST https://httpbin.org/post \
     -H "Content-Type: application/json" \
     -d '{"name":"Alice","email":"alice@example.com"}'

# POST form data
curl -X POST https://httpbin.org/post \
     -d "name=Alice&email=alice@example.com"

# POST from a file
curl -X POST https://httpbin.org/post \
     -H "Content-Type: application/json" \
     -d @payload.json
```

### Other HTTP Methods

```bash
# PUT
curl -X PUT https://httpbin.org/put -d '{"id":1,"name":"Updated"}'

# DELETE
curl -X DELETE https://httpbin.org/delete

# PATCH
curl -X PATCH https://httpbin.org/patch -d '{"name":"Patched"}'
```

### Output Options

```bash
# Save response to a file
curl -o response.json https://httpbin.org/get

# Show only the HTTP status code
curl -o /dev/null -s -w "%{http_code}\n" https://httpbin.org/get

# Show timing information
curl -o /dev/null -s -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTotal: %{time_total}s\n" https://httpbin.org/get

# Silent mode (no progress bar)
curl -s https://httpbin.org/get | jq .
```

### Reading curl -v Output

```bash
curl -v https://httpbin.org/get
```

```
* Trying 34.198.16.126:443...                  <-- TCP connection attempt
* Connected to httpbin.org (34.198.16.126)      <-- TCP connected
* ALPN: offers h2,http/1.1                      <-- TLS negotiation
* TLSv1.3 (OUT), TLS handshake                  <-- TLS handshake
* SSL connection using TLSv1.3                  <-- TLS established
> GET /get HTTP/2                               <-- REQUEST starts (>)
> Host: httpbin.org                             <-- Request headers
> User-Agent: curl/8.1.2
> Accept: */*
>                                               <-- End of request headers
< HTTP/2 200                                    <-- RESPONSE starts (<)
< content-type: application/json                <-- Response headers
< content-length: 256
<
{                                               <-- Response body
  "args": {},
  "headers": { ... },
  "origin": "1.2.3.4",
  "url": "https://httpbin.org/get"
}
```

Lines starting with `>` are what curl sent. Lines starting with `<` are what
the server returned. Lines starting with `*` are curl's internal info (TLS,
connection).

---

## netcat (nc): Raw TCP/UDP Connections

netcat is a simple tool for reading and writing data over TCP or UDP. Think
of it as a raw pipe to a network socket.

### As a Client (Connect to a Server)

```bash
# Connect to a TCP server
nc 127.0.0.1 8080

# Type anything -- it's sent as raw bytes
# Server's response appears on your terminal

# Send a raw HTTP request manually
echo -e "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n" | nc 127.0.0.1 8080
```

### As a Server (Listen for Connections)

```bash
# Listen on port 9000
nc -l 9000

# In another terminal, connect:
nc 127.0.0.1 9000

# Now type in either terminal -- text appears in the other
# This is a basic chat between two terminals!
```

### Port Scanning

```bash
# Check if a port is open (TCP)
nc -z -v 127.0.0.1 8080
# Connection to 127.0.0.1 port 8080 [tcp/*] succeeded!

# Scan a range of ports
nc -z -v 127.0.0.1 80-443 2>&1 | grep succeeded
```

### UDP

```bash
# Listen for UDP
nc -u -l 9000

# Send UDP
echo "hello" | nc -u 127.0.0.1 9000
```

### File Transfer

```bash
# Receiver (listening):
nc -l 9000 > received_file.txt

# Sender (connecting):
nc 127.0.0.1 9000 < file_to_send.txt
```

---

## tcpdump: Capture Network Packets

tcpdump captures packets on a network interface and displays them. It shows
you exactly what is flowing on the wire.

### Basic Usage

```bash
# Capture all traffic on the default interface (requires sudo)
sudo tcpdump

# Capture on a specific interface
sudo tcpdump -i en0

# Capture on loopback (local traffic)
sudo tcpdump -i lo0        # macOS
sudo tcpdump -i lo          # Linux
```

### Filtering

tcpdump filters let you focus on specific traffic:

```bash
# Filter by host
sudo tcpdump host 10.0.0.5

# Filter by port
sudo tcpdump port 8080

# Filter by source or destination
sudo tcpdump src 10.0.0.5
sudo tcpdump dst port 443

# Filter by protocol
sudo tcpdump tcp
sudo tcpdump udp
sudo tcpdump icmp

# Combine filters
sudo tcpdump 'host 10.0.0.5 and port 80'
sudo tcpdump 'src 10.0.0.5 and dst port 443'
sudo tcpdump 'port 80 or port 443'
```

### Useful Options

```bash
# Show packet contents in ASCII (-A)
sudo tcpdump -A port 8080

# Show packet contents in hex and ASCII (-X)
sudo tcpdump -X port 8080

# Capture only N packets (-c)
sudo tcpdump -c 10 port 8080

# Don't resolve hostnames (-n) -- faster output
sudo tcpdump -n port 8080

# Write to a file for Wireshark analysis (-w)
sudo tcpdump -w capture.pcap port 8080

# Read from a saved capture file (-r)
tcpdump -r capture.pcap
```

### Reading tcpdump Output

```
14:23:45.123456 IP 192.168.1.10.54321 > 10.0.0.5.8080: Flags [S], seq 1234567890, win 65535, length 0
```

Breaking this down:

```
14:23:45.123456          Timestamp
IP                       Protocol (IPv4)
192.168.1.10.54321       Source IP and port
>                        Direction
10.0.0.5.8080            Destination IP and port
Flags [S]                TCP flags: S=SYN, .=ACK, P=PSH, F=FIN, R=RST
seq 1234567890           Sequence number
win 65535                Window size
length 0                 Payload length
```

### Capturing a TCP Handshake

```bash
sudo tcpdump -n -i lo0 port 8080
```

Then in another terminal: `curl http://localhost:8080/hello`

```
14:23:45.001 IP 127.0.0.1.54321 > 127.0.0.1.8080: Flags [S]      SYN
14:23:45.001 IP 127.0.0.1.8080 > 127.0.0.1.54321: Flags [S.]     SYN-ACK
14:23:45.001 IP 127.0.0.1.54321 > 127.0.0.1.8080: Flags [.]      ACK
14:23:45.002 IP 127.0.0.1.54321 > 127.0.0.1.8080: Flags [P.]     HTTP request
14:23:45.002 IP 127.0.0.1.8080 > 127.0.0.1.54321: Flags [P.]     HTTP response
14:23:45.003 IP 127.0.0.1.54321 > 127.0.0.1.8080: Flags [F.]     FIN (close)
14:23:45.003 IP 127.0.0.1.8080 > 127.0.0.1.54321: Flags [F.]     FIN-ACK
14:23:45.003 IP 127.0.0.1.54321 > 127.0.0.1.8080: Flags [.]      ACK
```

You can see the three-way handshake (SYN, SYN-ACK, ACK), the data exchange,
and the connection teardown (FIN, FIN-ACK, ACK) -- exactly what we learned
in the TCP lesson.

---

## Wireshark: GUI Packet Analyzer

Wireshark does the same thing as tcpdump but with a graphical interface that
makes it much easier to inspect packets, follow TCP streams, and decode
protocols.

### Installation

```bash
# macOS
brew install --cask wireshark

# Linux
sudo apt install wireshark
```

### Key Features

- **Packet list:** Shows every captured packet with timestamp, source,
  destination, protocol, and a summary
- **Packet details:** Expand each layer (Ethernet, IP, TCP, HTTP) and see
  every field
- **Follow TCP stream:** Right-click a packet, "Follow > TCP Stream" to see
  the full conversation between client and server
- **Display filters:** `http`, `tcp.port == 8080`, `ip.addr == 10.0.0.5`
- **Coloring rules:** Different protocols get different colors

### Reading a Capture File From tcpdump

```bash
# Capture with tcpdump
sudo tcpdump -w /tmp/capture.pcap port 8080

# Open in Wireshark
wireshark /tmp/capture.pcap
```

Wireshark excels at decoding protocols. For an HTTP request, it shows the
method, path, headers, and body in a structured tree instead of raw bytes.

---

## dig / nslookup: DNS Debugging

When a hostname does not resolve, or resolves to the wrong IP, use dig.

### dig

```bash
# Basic DNS lookup
dig example.com

# Query a specific record type
dig example.com A          # IPv4 address
dig example.com AAAA       # IPv6 address
dig example.com MX         # Mail servers
dig example.com NS         # Name servers
dig example.com CNAME      # Canonical name (alias)
dig example.com TXT        # Text records (SPF, DKIM, etc.)

# Short output (just the answer)
dig +short example.com

# Query a specific DNS server
dig @8.8.8.8 example.com

# Trace the full DNS resolution path
dig +trace example.com
```

### Reading dig Output

```
;; ANSWER SECTION:
example.com.        3600    IN    A    93.184.216.34
```

```
example.com.     Domain name
3600             TTL (time to live, in seconds -- how long to cache)
IN               Class (Internet)
A                Record type (IPv4 address)
93.184.216.34    The answer (the IP address)
```

### Common DNS Problems

```bash
# "Host not found" -- DNS can't resolve the name
dig nonexistent.example.com
# ;; status: NXDOMAIN   (Non-Existent Domain)

# Slow resolution -- might be DNS server issues
dig example.com
# ;; Query time: 2500 msec   (should be <100ms)

# Wrong IP -- check if DNS is pointing to the right server
dig myapp.example.com +short
# 10.0.0.5   (is this the right server?)
```

### nslookup (simpler alternative)

```bash
nslookup example.com
# Server:  8.8.8.8
# Address: 8.8.8.8#53
#
# Non-authoritative answer:
# Name: example.com
# Address: 93.184.216.34
```

---

## openssl s_client: TLS Debugging

When HTTPS connections fail, openssl s_client lets you inspect the TLS
handshake, certificates, and cipher suites.

```bash
# Connect and show certificate info
openssl s_client -connect example.com:443

# Show certificate chain
openssl s_client -connect example.com:443 -showcerts

# Check certificate expiration
echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -dates
# notBefore=Jan 15 00:00:00 2024 GMT
# notAfter=Feb 15 23:59:59 2025 GMT

# Check which TLS version is used
echo | openssl s_client -connect example.com:443 2>/dev/null | grep "Protocol"
# Protocol  : TLSv1.3

# Test a specific TLS version
openssl s_client -connect example.com:443 -tls1_2

# Verify server name (SNI)
openssl s_client -connect example.com:443 -servername example.com
```

### Common TLS Problems

```
"certificate has expired"
  --> Certificate needs renewal (Let's Encrypt certs expire every 90 days)

"certificate verify failed"
  --> Certificate is self-signed, or CA is not trusted

"wrong version number"
  --> Server is not speaking TLS on this port (might be plain HTTP)

"handshake failure"
  --> Client and server can't agree on a TLS version or cipher suite
```

---

## mtr / traceroute: Path Debugging

When traffic is slow or dropping packets, traceroute shows every router
(hop) between you and the destination. mtr combines traceroute with
continuous ping.

### traceroute

```bash
traceroute example.com
```

```
 1  router.local (192.168.1.1)      1.234 ms
 2  isp-gateway (10.0.0.1)          5.678 ms
 3  core-router.isp.com (72.1.2.3)  12.345 ms
 4  * * *                            (no response -- firewall)
 5  edge.cdn.com (93.184.216.1)      15.678 ms
 6  example.com (93.184.216.34)      16.789 ms
```

Each line is a router hop. The times show round-trip latency to that hop.
A sudden jump (e.g., hop 2 is 5ms, hop 3 is 100ms) indicates a slow link.
`* * *` means the router does not respond to traceroute probes (common for
firewalls; not necessarily a problem).

### mtr (My TraceRoute)

mtr runs continuously, updating latency and packet loss statistics:

```bash
mtr example.com
```

```
Host                       Loss%  Snt  Last  Avg  Best  Wrst
1. router.local             0.0%   50   1.2  1.3  0.8   2.1
2. isp-gateway              0.0%   50   5.4  5.8  4.2   8.1
3. core-router.isp.com      0.5%   50  12.1 12.8  11.2  15.3
4. ???                       ---    ---  ---  ---  ---   ---
5. edge.cdn.com              0.0%   50  15.2 15.8  14.5  18.2
6. example.com               0.0%   50  16.1 16.5  15.8  19.1
```

Look for:
- **High loss%:** Packet loss at a hop indicates a problem at that router
- **High latency jump:** A big latency increase between hops indicates a
  slow link
- **Increasing loss at each hop:** Likely a problem at the first hop showing
  loss; later hops inherit it

---

## ping: The Most Basic Check

```bash
# Is the server reachable?
ping example.com

# Send only 5 pings
ping -c 5 example.com

# Set timeout
ping -W 2 example.com
```

```
PING example.com (93.184.216.34): 56 data bytes
64 bytes from 93.184.216.34: icmp_seq=0 ttl=56 time=15.2 ms
64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=14.8 ms
64 bytes from 93.184.216.34: icmp_seq=2 ttl=56 time=15.1 ms
```

If ping fails, the server is either down, blocking ICMP, or unreachable from
your network.

---

## Common Debugging Scenarios

### "My API request is failing"

```bash
# Step 1: Can you reach the server?
ping api.example.com

# Step 2: Is DNS correct?
dig api.example.com +short

# Step 3: Is the port open?
nc -z -v api.example.com 443

# Step 4: Is TLS working?
echo | openssl s_client -connect api.example.com:443 2>&1 | head -5

# Step 5: What does the HTTP response look like?
curl -v https://api.example.com/health
```

### "The connection is timing out"

```bash
# Where is the timeout happening?
# Is it DNS?
dig api.example.com          # Check query time

# Is it TCP connect?
nc -z -v -w 3 api.example.com 443   # 3-second timeout

# Is it TLS?
curl -v --connect-timeout 5 https://api.example.com/

# Is it the server being slow?
curl -o /dev/null -s -w "DNS: %{time_namelookup}s\nTCP: %{time_connect}s\nTLS: %{time_appconnect}s\nFirstByte: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://api.example.com/
```

If DNS is 0.001s, TCP is 0.050s, TLS is 0.150s, but FirstByte is 5.000s,
the server itself is slow.

### "Intermittent connection drops"

```bash
# Run continuous ping to check for packet loss
ping -c 100 api.example.com | tail -3
# 100 packets transmitted, 97 received, 3% packet loss

# Use mtr for detailed path analysis
mtr --report -c 100 api.example.com

# Capture packets to see connection resets
sudo tcpdump -n 'host api.example.com and tcp[tcpflags] & (tcp-rst) != 0'
```

### "SSL certificate error"

```bash
# Check certificate details
echo | openssl s_client -connect api.example.com:443 2>/dev/null | \
  openssl x509 -noout -subject -dates -issuer

# Check if cert matches the hostname
echo | openssl s_client -connect api.example.com:443 -servername api.example.com 2>&1 | \
  grep "Verify return code"
# Verify return code: 0 (ok)       <-- good
# Verify return code: 10 (certificate has expired)   <-- bad
```

### "DNS is not resolving"

```bash
# Check with different DNS servers
dig @8.8.8.8 myapp.example.com        # Google DNS
dig @1.1.1.1 myapp.example.com        # Cloudflare DNS
dig @9.9.9.9 myapp.example.com        # Quad9 DNS

# Check if it's a propagation issue (new DNS record)
dig +trace myapp.example.com

# Check local DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

### "Works on my machine, fails in production"

```bash
# Compare DNS resolution
dig myapp.example.com                      # your machine
ssh prod-server "dig myapp.example.com"    # production

# Compare network path
mtr myapp.example.com                      # your machine
ssh prod-server "mtr --report myapp.example.com"  # production

# Check if a firewall is blocking traffic
sudo tcpdump -n host target-server-ip      # look for RST packets

# Check if the port is accessible from production
ssh prod-server "nc -z -v target-server-ip 5432"  # e.g., database port
```

---

## Quick Reference: Which Tool for Which Problem

```
+-------------------------------------+---------------------------+
| Question                            | Tool                      |
+-------------------------------------+---------------------------+
| Is the server reachable?            | ping                      |
| Is DNS resolving correctly?         | dig, nslookup             |
| Is the port open?                   | nc -z                     |
| Is TLS/SSL working?                | openssl s_client           |
| What does the HTTP response look    | curl -v                   |
|   like?                             |                           |
| What's happening on the wire?       | tcpdump, Wireshark        |
| Where is latency coming from?       | mtr, traceroute           |
| Is there packet loss on the path?   | mtr                       |
| What's the network timing breakdown?| curl -w (timing format)   |
| Need to send/receive raw TCP/UDP?   | nc (netcat)               |
+-------------------------------------+---------------------------+
```

---

## Exercises

1. **curl mastery.** Use curl to:
   - Make a GET request to `https://httpbin.org/get` and pipe through `jq`
   - POST JSON to `https://httpbin.org/post` and verify the echo
   - Follow a redirect chain at `https://httpbin.org/redirect/3` with `-L -v`
   - Measure the DNS, TCP connect, TLS, and total time for a request to
     any HTTPS site using `-w` format strings

2. **DNS investigation.** Use dig to:
   - Find the IP address of `google.com`
   - Find the mail servers (MX records) for `gmail.com`
   - Find the name servers (NS records) for `cloudflare.com`
   - Trace the full DNS resolution path for any domain with `dig +trace`
   - Compare resolution times between Google DNS (8.8.8.8) and Cloudflare
     DNS (1.1.1.1)

3. **tcpdump a conversation.** Start your echo server from Lesson 13 on
   port 7878. In another terminal, start tcpdump:
   `sudo tcpdump -i lo0 -n port 7878`
   Then connect with netcat and send a message. Identify the SYN, SYN-ACK,
   ACK (three-way handshake), the data packets, and the FIN (close) in the
   tcpdump output.

4. **TLS inspection.** Use `openssl s_client` to connect to three different
   HTTPS sites. For each, note:
   - TLS version (1.2 or 1.3)
   - Certificate issuer (Let's Encrypt, DigiCert, etc.)
   - Certificate expiration date
   - Whether the certificate chain is valid

5. **Debugging challenge.** Run your HTTP server from Lesson 14 on port
   8080. Then intentionally break things and practice debugging:
   - Stop the server and try `curl http://localhost:8080/` -- what error?
   - Start the server on port 8081 but curl port 8080 -- what error?
   - Send a malformed request with `echo "INVALID" | nc localhost 8080`
     and capture with tcpdump -- what happens?
   - Use `curl -w` to measure how long your server takes to respond to
     different routes

6. **Path analysis.** Run `mtr` to three different servers:
   - A server in your country
   - A server on another continent
   - `8.8.8.8` (Google DNS)
   Compare the number of hops and latency. Can you identify where the
   undersea cable hop is (sudden large latency increase)?

---

## What's Next

You have covered the entire journey from electrical signals to HTTP APIs,
built servers from scratch, and learned to debug when things go wrong.

Here are paths to continue your networking education:

**Go deeper on protocols:**
- Read RFCs (start with RFC 7230-7235 for HTTP/1.1, RFC 9110 for HTTP
  semantics)
- Study QUIC (RFC 9000) -- the protocol under HTTP/3
- Learn about BGP (how the internet routes between ISPs)

**Build more things:**
- Build a Redis clone (TCP protocol with custom commands)
- Build a DNS resolver from scratch
- Build a peer-to-peer chat application
- Implement a simple HTTP/2 parser

**Production networking:**
- Learn Kubernetes networking (Services, Ingress, NetworkPolicies)
- Study service mesh architecture (Istio, Linkerd)
- Explore eBPF for kernel-level network observability
- Set up monitoring with Prometheus and Grafana for network metrics

**Security:**
- Study common network attacks (SYN flood, DNS poisoning, MITM)
- Learn about mutual TLS (mTLS) for service-to-service authentication
- Explore zero-trust networking principles

Every concept in this course is a foundation. The more you build with
networks, the more these fundamentals will surface in your daily work.
