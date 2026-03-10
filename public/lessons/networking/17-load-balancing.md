# Lesson 17: Load Balancing, Proxies, and CDNs

A single server has limits: CPU, memory, network bandwidth, and the number
of connections it can handle. When your application grows beyond what one
machine can serve, you need multiple servers working together. This lesson
covers the infrastructure that makes that possible.

---

## Load Balancing

A load balancer sits between clients and a pool of servers. It receives
every incoming request and decides which server should handle it.

### The Analogy

**A load balancer is the host at a restaurant.** When you walk in, the host
does not let you choose any table -- they seat you at whichever table will
keep the restaurant balanced. If one section is packed and another is empty,
new guests go to the empty section. If a table is being cleaned (unhealthy
server), the host skips it.

```
Without load balancer:              With load balancer:

Clients --> Single Server           Clients --> Load Balancer --> Server A
                                                              --> Server B
                                                              --> Server C
```

```
                    Internet
                       |
                +------+------+
                |   Load      |
                |  Balancer   |
                +--+---+---+--+
                   |   |   |
            +------+   |   +------+
            |          |          |
        +---+---+  +---+---+  +---+---+
        |Server |  |Server |  |Server |
        |  A    |  |  B    |  |  C    |
        +-------+  +-------+  +-------+
```

---

## Load Balancing Algorithms

### Round-Robin

The simplest algorithm. Send each request to the next server in sequence.

```
Request 1 --> Server A
Request 2 --> Server B
Request 3 --> Server C
Request 4 --> Server A  (back to start)
Request 5 --> Server B
...
```

**Pros:** Simple, even distribution when all servers are identical.
**Cons:** Ignores server load. If Server A is processing a slow request
while B and C are idle, new requests still go to A.

### Weighted Round-Robin

Like round-robin but some servers get more traffic. Useful when servers have
different capacities.

```
Server A (weight 3):  gets 3 out of every 6 requests
Server B (weight 2):  gets 2 out of every 6 requests
Server C (weight 1):  gets 1 out of every 6 requests

Sequence: A, A, A, B, B, C, A, A, A, B, B, C, ...
```

### Least Connections

Send each request to the server with the fewest active connections. This
naturally balances load when requests take different amounts of time.

```
Server A: 5 active connections
Server B: 2 active connections  <-- next request goes here
Server C: 8 active connections
```

**Pros:** Adapts to uneven workloads.
**Cons:** Slightly more overhead (must track connection counts).

### IP Hash

Hash the client's IP address to determine the server. The same client
always goes to the same server.

```
hash("203.0.113.10") % 3 = 0  --> Server A
hash("198.51.100.5") % 3 = 2  --> Server C
hash("192.0.2.100")  % 3 = 1  --> Server B
```

**Pros:** Client affinity without session state.
**Cons:** Uneven distribution if some IPs generate more traffic. Breaks when
servers are added/removed (rehashing).

### Least Response Time

Send requests to the server with the lowest average response time. Combines
connection count with actual performance data.

### Random

Pick a random server. Surprisingly effective at scale because random
distribution approaches even distribution with large numbers.

---

## Layer 4 vs Layer 7 Load Balancing

### Layer 4 (Transport Layer -- TCP/UDP)

The load balancer looks at IP addresses and port numbers only. It forwards
raw TCP connections without inspecting the content.

```
Client --> LB sees: SRC=1.2.3.4:54321 DST=10.0.0.1:80
                    Forwards entire TCP connection to Server B
                    Does not read HTTP headers or body
```

**Pros:** Very fast (no content inspection), works for any TCP protocol.
**Cons:** Cannot make routing decisions based on URL, headers, or cookies.

### Layer 7 (Application Layer -- HTTP)

The load balancer reads the HTTP request (URL, headers, cookies, body) and
makes routing decisions based on content.

```
Client --> LB reads: GET /api/users HTTP/1.1
                     Host: example.com
                     Cookie: session=abc123

           LB decides: /api/* goes to API servers
                       /static/* goes to CDN
                       session=abc123 goes to Server B (sticky session)
```

**Pros:** Content-based routing, URL rewriting, SSL termination, caching.
**Cons:** Slower (must parse HTTP), more complex, only works for HTTP.

```
+-------------------+--------------------+
| Layer 4           | Layer 7            |
+-------------------+--------------------+
| TCP/UDP level     | HTTP level         |
| Very fast         | Slower (parsing)   |
| Any protocol      | HTTP only          |
| No content inspect| Full content aware |
| Simple config     | Rich routing rules |
| HAProxy, LVS      | nginx, HAProxy,    |
|                   | Envoy, Traefik     |
+-------------------+--------------------+
```

---

## Health Checks

A load balancer must know which servers are healthy. Dead servers should
receive zero traffic.

### Active Health Checks

The load balancer periodically sends a request to each server:

```
Load Balancer                  Server A
     |--- GET /health -------->|
     |<-- 200 OK --------------|  healthy

Load Balancer                  Server B
     |--- GET /health -------->|
     |                         |  no response (timeout)
     |--- mark unhealthy ---   |  stop sending traffic
```

Common health check endpoint:

```json
GET /health

{
  "status": "healthy",
  "uptime_seconds": 86400,
  "database": "connected",
  "cache": "connected"
}
```

### Passive Health Checks

Monitor actual traffic. If a server returns too many 5xx errors or
connections time out, mark it unhealthy.

```
Request to Server B --> 500 Internal Server Error  (error count: 1)
Request to Server B --> 502 Bad Gateway            (error count: 2)
Request to Server B --> Connection refused          (error count: 3)
                        Threshold reached: 3 errors in 10 seconds
                        Server B marked unhealthy
```

### Recovery

After marking a server unhealthy, the load balancer periodically checks if
it has recovered. Once the health check passes, traffic resumes (often
gradually).

---

## Reverse Proxy

A reverse proxy sits in front of your servers and acts on behalf of the
servers. From the client's perspective, the reverse proxy is the server.

```
Client's view:
  "I'm talking to example.com"

Reality:
  Client --> nginx (reverse proxy) --> your Rust app on port 3000
```

### What a Reverse Proxy Does

- **Load balancing:** Distributes requests across multiple backends
- **SSL termination:** Handles HTTPS (TLS), backends talk plain HTTP
- **Caching:** Caches responses for static content
- **Compression:** Gzip/brotli compresses responses
- **Rate limiting:** Limits requests per client
- **Request buffering:** Absorbs slow client uploads before forwarding

### Common Reverse Proxies

| Tool | Strengths |
|---|---|
| **nginx** | Battle-tested, high performance, huge ecosystem |
| **Caddy** | Automatic HTTPS, simple config, modern |
| **HAProxy** | Purpose-built for load balancing, TCP and HTTP |
| **Envoy** | Service mesh proxy, gRPC native, observability |
| **Traefik** | Docker/Kubernetes native, auto-discovery |

### nginx Configuration Example

```nginx
upstream rust_app {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://rust_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        root /var/www;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

This configuration:
- Distributes traffic across three instances of your Rust app
- Passes along the real client IP in headers
- Serves static files directly from disk (nginx is faster than your app for this)
- Caches static files for 30 days

---

## Forward Proxy

A forward proxy sits in front of clients. The client knows about the proxy
and routes traffic through it.

```
Reverse proxy (in front of servers):
  Client --> [reverse proxy] --> Server

Forward proxy (in front of clients):
  Client --> [forward proxy] --> Internet --> Server
```

### Use Cases

- **Corporate proxy:** Company routes all employee traffic through a proxy
  for security, filtering, and logging
- **VPN:** Encrypts and tunnels all traffic through a remote server
- **Caching proxy (Squid):** Caches web content for faster repeated access
- **Privacy proxy:** Hides the client's real IP from the destination server

```
Without forward proxy:
  Your laptop (IP: 1.2.3.4) --> example.com
  example.com sees: request from 1.2.3.4

With forward proxy:
  Your laptop --> Corporate proxy (IP: 10.0.0.1) --> example.com
  example.com sees: request from 10.0.0.1
```

---

## SSL/TLS Termination

Handling TLS (HTTPS) is CPU-intensive. SSL termination offloads this to the
load balancer or reverse proxy, so your application servers speak plain HTTP.

```
                Internet (encrypted)        Internal Network (plain HTTP)
Client  ----HTTPS----> Load Balancer ----HTTP----> Server A
                       (terminates TLS)  ----HTTP----> Server B
                                         ----HTTP----> Server C
```

**Benefits:**
- Application servers are simpler (no TLS configuration)
- TLS certificate management is centralized (one place)
- Load balancer can inspect HTTP content (Layer 7 routing)
- Hardware acceleration for TLS is possible at the LB

**Concern:** Traffic between the load balancer and backends is unencrypted.
This is acceptable on a trusted internal network. For zero-trust
environments, use mutual TLS (mTLS) between all services.

---

## Sticky Sessions (Session Affinity)

Sometimes the same user must always reach the same server (e.g., if session
state is stored in server memory).

```
User A (session on Server B):
  Request 1 --> LB --> Server B  (session created)
  Request 2 --> LB --> Server B  (same server, session found)
  Request 3 --> LB --> Server B  (still the same server)
```

### Methods

- **Cookie-based:** LB sets a cookie (`SERVERID=B`), routes based on it
- **IP hash:** Same IP always goes to same server
- **URL parameter:** Session ID in the URL determines the server

### Why to Avoid Sticky Sessions

Sticky sessions cause problems:

1. **Uneven load:** Some servers get heavy users, others get light users
2. **Failure fragility:** If Server B dies, all of User A's sessions are lost
3. **Scaling difficulty:** Cannot add/remove servers freely
4. **No redundancy:** Server state is a single point of failure

**Better alternatives:**
- Store sessions in a shared database (PostgreSQL, Redis)
- Use stateless authentication (JWT tokens)
- Store session state in cookies (encrypted, small data only)

---

## CDN (Content Delivery Network)

A CDN is a network of servers distributed worldwide that cache and serve your
content from locations close to the user.

### The Analogy

**Without a CDN:** You have one warehouse (origin server) in New York. A
customer in Tokyo orders a product. It ships across the Pacific -- slow.

**With a CDN:** You have small warehouses (edge servers) in every major city.
The Tokyo warehouse already has copies of popular products. The customer gets
their order from the Tokyo warehouse -- fast.

```
Without CDN:
  User in Tokyo -------- 12,000 km --------> Server in New York
  Latency: ~150ms round trip

With CDN:
  User in Tokyo ---- 50 km ----> CDN edge in Tokyo (cached copy)
  Latency: ~5ms round trip

  If not cached:
  CDN edge in Tokyo ---- 12,000 km ----> Origin server in New York
  CDN edge caches it for future requests
```

### How a CDN Works

```
1. User requests https://example.com/logo.png
2. DNS resolves example.com to the nearest CDN edge server
3. Edge server checks its cache:
   a. Cache HIT:  return the cached file immediately
   b. Cache MISS: fetch from origin server, cache it, return it
4. Future requests from nearby users hit the cache
```

```
                    +---- CDN Edge: London ----+
                    |     (cached content)      |
                    +---------------------------+
                              |
User (London) ------>   CDN DNS   <------ User (Paris)
                              |
                    +---- CDN Edge: Paris -----+
                    |     (cached content)      |
                    +---------------------------+
                              |
                              | (cache miss)
                              v
                    +---- Origin Server -------+
                    |     New York              |
                    +---------------------------+
```

### What CDNs Cache

- Static files: images, CSS, JavaScript, fonts, videos
- API responses (with appropriate cache headers)
- HTML pages (if configured)

### Major CDN Providers

| Provider | Notes |
|---|---|
| **Cloudflare** | Free tier, DDoS protection, DNS, Workers (edge compute) |
| **AWS CloudFront** | Tight AWS integration |
| **Fastly** | Real-time purging, edge compute (WASM) |
| **Akamai** | Largest network, enterprise focus |
| **Bunny CDN** | Simple, affordable |

### Cache Headers

Your server controls what the CDN caches using HTTP cache headers:

```
Cache-Control: public, max-age=31536000, immutable
```

- `public`: CDN can cache this
- `max-age=31536000`: cache for 1 year (in seconds)
- `immutable`: content will never change (versioned assets)

```
Cache-Control: private, no-cache
```

- `private`: only the user's browser can cache this, not the CDN
- `no-cache`: always revalidate with the origin before serving

---

## Putting It All Together: Production Architecture

```
                        Internet
                           |
                    +------+------+
                    |   CDN Edge  |  (static assets, cached responses)
                    +------+------+
                           |
                    +------+------+
                    | DNS / Load  |  (Route53, Cloudflare DNS)
                    |  Balancer   |
                    +--+---+---+--+
                       |   |   |
                +------+   |   +------+
                |          |          |
           +----+----+----+----+----+----+
           | nginx   | nginx   | nginx   |  (reverse proxy, SSL termination)
           +----+----+----+----+----+----+
                |          |          |
           +----+----+----+----+----+----+
           | App     | App     | App     |  (your Rust/Go/etc servers)
           | :3000   | :3000   | :3000   |
           +----+----+----+----+----+----+
                |          |          |
           +----+----+----+----+----+----+
           | DB      | Cache   | Queue   |  (PostgreSQL, Redis, RabbitMQ)
           +----+----+----+----+----+----+
```

Request flow:
1. User's browser makes HTTPS request
2. DNS routes to nearest CDN edge
3. CDN serves cached content (if available) or forwards to origin
4. Load balancer picks a healthy nginx instance
5. nginx terminates TLS, forwards plain HTTP to app server
6. App server processes request, queries database/cache
7. Response flows back through the same chain

---

## Exercises

1. **nginx reverse proxy.** Install nginx (`brew install nginx` on macOS).
   Run a Rust HTTP server (from Lesson 14) on port 3000. Configure nginx
   to proxy requests from port 8080 to your Rust server. Verify it works
   with `curl http://localhost:8080/hello`.

2. **Multiple backends.** Run two instances of your Rust server on ports
   3000 and 3001 (just run the binary twice with different ports). Configure
   nginx `upstream` to balance between them. Send 10 requests and check
   server logs to verify requests are distributed.

3. **Health check endpoint.** Add a `GET /health` endpoint to your Rust
   server that returns `{"status":"healthy"}`. Configure nginx to use it
   for health checks (nginx Plus has active checks; open-source nginx
   relies on passive checks -- configure `max_fails` and `fail_timeout`).

4. **Static file serving.** Configure nginx to serve `/static/*` from a
   directory on disk and proxy everything else to your Rust app. Verify
   static files are served directly by nginx (check response headers --
   nginx adds a `Server: nginx` header).

5. **Cache headers.** Add `Cache-Control: public, max-age=3600` to your
   Rust server's static file responses. Use `curl -v` to verify the header
   is present. Then configure nginx to add `Cache-Control: public,
   max-age=86400` for static files it serves directly.

6. **Compare load balancing algorithms.** Configure nginx with `least_conn`
   instead of the default round-robin. Add artificial delay to one server
   instance (`tokio::time::sleep`). Send 100 requests and observe how the
   distribution changes compared to round-robin.

---

Next: [Lesson 18: Network Debugging -- tcpdump, Wireshark, curl, netcat](./18-debugging-tools.md)
