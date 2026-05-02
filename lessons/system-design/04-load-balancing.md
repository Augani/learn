# Load Balancing

A load balancer is like a restaurant host. When customers walk in, the host
doesn't send everyone to the same table or the same waiter. They look at which
sections are full, which waiters are overwhelmed, and which tables are clean —
then they seat the customer accordingly.

Without a host, customers would pile up at the first table they see, one waiter
would be drowning while others stand around, and the kitchen would bottleneck
on one section's orders.

Load balancers do the same thing for your servers.

---

## Why You Need Load Balancing

No single server can handle everything. Even if it could handle the traffic,
you still need load balancing for:

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  1. REDUNDANCY      Server dies → others pick up traffic  │
│  2. SCALABILITY     Add servers as traffic grows          │
│  3. ZERO-DOWNTIME   Deploy to servers one at a time       │
│  4. EFFICIENCY      Distribute work evenly                │
│  5. GEOGRAPHIC      Route users to nearest servers        │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

Without a load balancer:

```
┌──────┐     ┌──────────┐
│Client│────▶│ Server 1 │  ← handles ALL traffic
└──────┘     └──────────┘
             ┌──────────┐
             │ Server 2 │  ← sits idle
             └──────────┘
             ┌──────────┐
             │ Server 3 │  ← sits idle
             └──────────┘
```

With a load balancer:

```
┌──────┐     ┌────┐     ┌──────────┐
│Client│────▶│ LB │────▶│ Server 1 │  ← 33% traffic
└──────┘     │    │     └──────────┘
             │    │     ┌──────────┐
             │    │────▶│ Server 2 │  ← 33% traffic
             │    │     └──────────┘
             │    │     ┌──────────┐
             │    │────▶│ Server 3 │  ← 33% traffic
             └────┘     └──────────┘
```

---

## Layer 4 vs Layer 7 Load Balancing

Load balancers operate at different layers of the network stack. The two that
matter are Layer 4 (transport) and Layer 7 (application).

### Layer 4 — The Dumb Pipe

Layer 4 looks at TCP/UDP packets — source IP, destination IP, and port number.
It doesn't understand what's inside the packet (HTTP, WebSocket, gRPC — it
doesn't know and doesn't care).

```
Client: "Connect to 1.2.3.4:443"

L4 LB thinks: "I see a TCP connection to port 443.
               I'll forward it to backend server 10.0.0.5:8080."

┌────────┐  TCP SYN  ┌────────┐  TCP SYN  ┌──────────┐
│ Client │──────────▶│  L4 LB │──────────▶│ Backend  │
│        │           │        │           │  Server  │
│        │◀──────────│        │◀──────────│          │
└────────┘  TCP ACK  └────────┘  TCP ACK  └──────────┘

The LB just forwards packets. Fast and simple.
```

**Pros:** Extremely fast (hardware-level forwarding), low latency, handles any
TCP/UDP protocol, simple to configure.

**Cons:** Can't make routing decisions based on content (URL path, headers,
cookies). Can't do SSL termination (well, it can, but it becomes L7-ish).
Can't rewrite requests.

**Use when:** You need raw throughput, you're load balancing non-HTTP protocols
(databases, game servers, DNS), or you want the lowest possible overhead.

### Layer 7 — The Smart Router

Layer 7 understands HTTP. It reads the URL, headers, cookies, and body. It can
make intelligent routing decisions based on the content of the request.

```
Client: "GET /api/users/123 HTTP/1.1
         Host: api.example.com
         Cookie: session=abc123"

L7 LB thinks: "This is an API request for users.
               Route to the user-service backend.
               Also, terminate SSL here, add X-Forwarded-For header,
               and rate-limit this IP."

┌────────┐   HTTPS   ┌────────┐    HTTP    ┌──────────────┐
│ Client │──────────▶│  L7 LB │───────────▶│ User Service │
│        │           │        │            │   Backend    │
│        │           │ • SSL  │            │              │
│        │           │ • Route│            │              │
│        │           │ • Rate │            │              │
│        │           │   limit│            │              │
└────────┘           └────────┘            └──────────────┘
```

**Pros:** Content-based routing (URL path, headers, cookies), SSL termination,
request/response modification, A/B testing, canary deploys, rate limiting,
authentication.

**Cons:** Slower than L4 (must parse HTTP), more resource-intensive, higher
complexity, connection overhead (terminates and re-establishes connections).

**Use when:** You're serving HTTP/HTTPS traffic (almost always in web
applications), you need path-based routing, or you want SSL termination at the
load balancer.

### Comparison Table

| Feature | Layer 4 | Layer 7 |
|---|---|---|
| Speed | Very fast | Fast |
| Protocol awareness | TCP/UDP only | HTTP, gRPC, WebSocket |
| Content-based routing | No | Yes (URL, headers, cookies) |
| SSL termination | No (pass-through) | Yes |
| Connection pooling | No | Yes |
| Request modification | No | Yes |
| Health checks | TCP connect / ping | HTTP GET /health |
| Use case | Database LB, gaming, raw TCP | Web apps, APIs, microservices |
| AWS equivalent | NLB (Network LB) | ALB (Application LB) |
| GCP equivalent | Network LB | HTTP(S) LB |

---

## Load Balancing Algorithms

The algorithm determines which backend server gets the next request. The choice
matters more than you'd think.

### Round Robin

The simplest algorithm. Requests go to servers in order: 1, 2, 3, 1, 2, 3...

```
Request 1 → Server A
Request 2 → Server B
Request 3 → Server C
Request 4 → Server A
Request 5 → Server B
...
```

**Pros:** Dead simple, perfectly even distribution, no state needed.

**Cons:** Ignores server capacity differences. If Server A is a 2-core machine
and Server C is a 32-core machine, they get equal traffic.

**Use when:** All servers are identical (same hardware, same code, same capacity).

### Weighted Round Robin

Like round robin, but servers with more capacity get more requests.

```
Server A (weight 1): ██
Server B (weight 2): ████
Server C (weight 5): ██████████

Sequence: C, C, C, C, C, B, B, A, C, C, C, C, C, B, B, A ...
```

**Use when:** Servers have different capacities (during rolling upgrades, mixed
hardware, or canary deploys where the new version gets less traffic initially).

### Least Connections

Send the next request to the server with the fewest active connections.

```
Server A: 5 active connections  ← next request goes here
Server B: 12 active connections
Server C: 8 active connections
```

**Pros:** Naturally handles servers with different speeds. A slow server
accumulates connections; a fast server finishes them quickly and gets more.

**Cons:** Requires tracking connection counts (small overhead). Doesn't account
for connection "weight" (one request might be a simple health check, another
might be processing a 10MB upload).

**Use when:** Requests have variable processing times. This is a good default
for most web applications.

### IP Hash

Hash the client's IP address to determine which server handles the request.
Same IP always goes to the same server.

```
hash("192.168.1.1") % 3 = 0 → Server A
hash("192.168.1.2") % 3 = 2 → Server C
hash("10.0.0.50")   % 3 = 1 → Server B
```

**Pros:** Session affinity without cookies. Useful for protocols that don't
support cookies.

**Cons:** Uneven distribution (many users behind same NAT get same server).
Adding/removing servers redistributes ALL traffic.

**Use when:** You need basic session stickiness without L7 cookie inspection.

### Consistent Hashing

A smarter version of IP hash. Servers are placed on a virtual ring. Requests
are hashed and routed to the nearest server on the ring.

```
                        Server A (position 90)
                        ●
                   /         \
                  /           \
                 /             \
     Server D  ●               ● Server B
    (pos 320) |               (position 180)
               \             /
                \           /
                 \         /
                  ●
                Server C (position 250)

Request hash = 100 → nearest clockwise = Server B (180)
Request hash = 200 → nearest clockwise = Server C (250)
Request hash = 300 → nearest clockwise = Server D (320)
```

**Pros:** Adding or removing a server only redistributes a fraction of traffic
(~1/N where N is the number of servers), not all of it.

**Cons:** Can be uneven without virtual nodes. More complex to implement.

**Use when:** Caching layers (like Memcached), where you want to minimize cache
invalidation when servers change. Also used in distributed systems like
DynamoDB and Cassandra.

### Algorithm Comparison

| Algorithm | Distribution | Session Affinity | Add/Remove Impact | Complexity |
|---|---|---|---|---|
| Round Robin | Even | None | Minimal | Trivial |
| Weighted RR | Weighted even | None | Minimal | Simple |
| Least Connections | Adaptive | None | Minimal | Simple |
| IP Hash | By source IP | By IP | Redistributes all | Simple |
| Consistent Hash | By key | By key | Redistributes ~1/N | Moderate |
| Random | Statistically even | None | None | Trivial |

---

## Health Checks

A load balancer is only useful if it knows which servers are alive. Health checks
are how it finds out.

```
┌────────┐    GET /health     ┌──────────┐
│   LB   │───────────────────▶│ Server A │ → 200 OK ✓
│        │    every 10s       └──────────┘
│        │
│        │    GET /health     ┌──────────┐
│        │───────────────────▶│ Server B │ → 200 OK ✓
│        │                    └──────────┘
│        │
│        │    GET /health     ┌──────────┐
│        │───────────────────▶│ Server C │ → 503 Error ✗
│        │                    └──────────┘
│        │
│        │    After 3 failures, stop sending traffic to Server C
└────────┘
```

### Types of Health Checks

| Type | What It Checks | L4/L7 | Reliability |
|---|---|---|---|
| TCP connect | Can I open a TCP connection? | L4 | Low (server might accept TCP but app is broken) |
| HTTP GET | Does /health return 200? | L7 | Medium (app is running) |
| Deep health | Can the app query the database? | L7 | High (entire stack is working) |

### Implementing a Health Check in Go

```go
func healthHandler(db *pgxpool.Pool, cache *redis.Client) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
        defer cancel()

        if err := db.Ping(ctx); err != nil {
            w.WriteHeader(http.StatusServiceUnavailable)
            json.NewEncoder(w).Encode(map[string]string{"status": "unhealthy", "reason": "database"})
            return
        }

        if err := cache.Ping(ctx).Err(); err != nil {
            w.WriteHeader(http.StatusServiceUnavailable)
            json.NewEncoder(w).Encode(map[string]string{"status": "unhealthy", "reason": "cache"})
            return
        }

        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
    }
}
```

**In TypeScript:**

```typescript
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        await redis.ping();
        res.status(200).json({ status: 'healthy' });
    } catch (err) {
        res.status(503).json({ status: 'unhealthy', reason: String(err) });
    }
});
```

**Health check configuration to think about:**
- **Interval:** How often to check (5-30 seconds typical)
- **Timeout:** How long to wait for a response (2-5 seconds)
- **Threshold:** How many failures before marking unhealthy (2-5)
- **Recovery:** How many successes before marking healthy again (2-3)

---

## Session Stickiness (and Why It's Usually Bad)

Session stickiness (affinity) means the load balancer always routes the same
user to the same backend server.

```
WITH STICKINESS:
User Alice ──always──▶ Server A
User Bob   ──always──▶ Server B
User Carol ──always──▶ Server A

WITHOUT STICKINESS:
User Alice ──request 1──▶ Server A
User Alice ──request 2──▶ Server C
User Alice ──request 3──▶ Server B
```

### Why People Want It
- Server stores session data in local memory
- WebSocket connections need to stay on the same server
- Local cache warming — server builds up cache for that user's data

### Why It's Usually Bad

| Problem | Explanation |
|---|---|
| Uneven distribution | Popular users all stuck on one server |
| Failed failover | Server dies → all sticky users lose their session |
| Can't scale down | Remove a server → all its sticky users lose state |
| Deploy complexity | Rolling deploy must drain connections gracefully |
| Testing difficulty | Hard to reproduce bugs when users are pinned |

### Better Alternatives

```
Instead of stickiness:                  Use:
────────────────────                    ────
In-memory sessions                 →    Redis session store
Local caching                      →    Shared Redis cache
WebSocket state                    →    Redis pub/sub for fan-out
User-specific data in memory       →    Stateless design (JWT)
```

The principle: **make your servers stateless.** Any server should be able to
handle any request from any user. Store shared state externally (Redis,
database, etc.).

---

## Software Load Balancers

### Nginx

The most popular reverse proxy and load balancer. Used by approximately 30%+
of all websites.

**Basic load balancing config:**

```nginx
upstream api_servers {
    least_conn;

    server 10.0.0.1:8080 weight=3;
    server 10.0.0.2:8080 weight=2;
    server 10.0.0.3:8080 weight=1;
    server 10.0.0.4:8080 backup;
}

server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location /api/ {
        proxy_pass http://api_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    location /static/ {
        root /var/www;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Path-based routing (L7):**

```nginx
upstream user_service {
    server 10.0.1.1:8080;
    server 10.0.1.2:8080;
}

upstream photo_service {
    server 10.0.2.1:8080;
    server 10.0.2.2:8080;
}

server {
    listen 443 ssl;

    location /api/users/ {
        proxy_pass http://user_service;
    }

    location /api/photos/ {
        proxy_pass http://photo_service;
    }
}
```

### HAProxy

The gold standard for high-performance load balancing. Known for reliability
and extremely low latency.

```
frontend http_front
    bind *:443 ssl crt /etc/ssl/cert.pem
    default_backend api_servers

    acl is_api path_beg /api/
    acl is_ws  hdr(Upgrade) WebSocket

    use_backend api_servers  if is_api
    use_backend ws_servers   if is_ws

backend api_servers
    balance leastconn
    option httpchk GET /health

    server srv1 10.0.0.1:8080 check weight 3
    server srv2 10.0.0.2:8080 check weight 2
    server srv3 10.0.0.3:8080 check weight 1 backup
```

### Envoy

Modern service mesh proxy, designed for microservices. Used extensively at
companies running Kubernetes with Istio.

**Key features:** gRPC load balancing, automatic retries, circuit breaking,
distributed tracing integration, observability.

### Comparison

| Feature | Nginx | HAProxy | Envoy |
|---|---|---|---|
| Primary use | Web server + LB | Pure LB | Service mesh proxy |
| Config | Static (nginx.conf) | Static (haproxy.cfg) | Dynamic (xDS API) |
| L4/L7 | Both | Both | Both |
| gRPC | Basic | Limited | Native |
| Hot reload | Yes (nginx -s reload) | Yes | Yes (dynamic config) |
| Observability | Basic | Good (stats page) | Excellent (Prometheus) |
| Learning curve | Low | Medium | High |
| Latency overhead | Low | Very low | Low |

---

## Cloud Load Balancers

### AWS

| Service | Layer | Use Case |
|---|---|---|
| ALB (Application LB) | L7 | HTTP/HTTPS, path routing, WebSocket |
| NLB (Network LB) | L4 | TCP/UDP, extreme performance, static IPs |
| CLB (Classic LB) | L4/L7 | Legacy, don't use for new projects |
| GWLB (Gateway LB) | L3 | Firewalls, intrusion detection appliances |

### GCP

| Service | Layer | Use Case |
|---|---|---|
| HTTP(S) LB | L7 | Global HTTP, auto-scaling, CDN integration |
| TCP Proxy LB | L4 | TCP traffic, SSL offloading |
| Network LB | L4 | Regional, UDP support, pass-through |
| Internal LB | L4/L7 | Service-to-service within VPC |

---

## DNS Load Balancing

Before the request even reaches your load balancer, DNS can distribute traffic
across multiple endpoints.

```
User: "What IP is api.example.com?"

DNS Response (Round Robin):
  First query:  → 1.1.1.1 (US-East)
  Second query: → 2.2.2.2 (US-West)
  Third query:  → 3.3.3.3 (EU-West)
```

**Pros:** No single point of failure. Works at the global level. No extra
infrastructure needed.

**Cons:** DNS caching means changes are slow (TTL). No health checks (DNS
doesn't know if the server is alive). Uneven distribution due to DNS caching.
No awareness of server load.

**When to use:** Global traffic distribution in combination with other load
balancing methods. DNS gets users to the right region; L7 LB distributes
within the region.

---

## Global Server Load Balancing (GSLB)

GSLB combines DNS-level routing with health-aware, geography-aware load
balancing. It's the layer that decides which datacenter handles your request.

```
                    ┌───────────────┐
                    │  GSLB / DNS   │
                    │  (Route 53,   │
                    │   Cloudflare) │
                    └───────┬───────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
    ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
    │   US-East   │  │   US-West   │  │   EU-West   │
    │             │  │             │  │             │
    │  ┌──────┐   │  │  ┌──────┐   │  │  ┌──────┐   │
    │  │  LB  │   │  │  │  LB  │   │  │  │  LB  │   │
    │  └──┬───┘   │  │  └──┬───┘   │  │  └──┬───┘   │
    │     │       │  │     │       │  │     │       │
    │  ┌──┴───┐   │  │  ┌──┴───┐   │  │  ┌──┴───┐   │
    │  │Servers│  │  │  │Servers│  │  │  │Servers│  │
    │  └──────┘   │  │  └──────┘   │  │  └──────┘   │
    └─────────────┘  └─────────────┘  └─────────────┘

    User in Paris → EU-West (lowest latency)
    User in NYC   → US-East (lowest latency)
    US-East down  → failover to US-West
```

**Routing strategies:**

| Strategy | How It Works | Good For |
|---|---|---|
| Geographic | Route to nearest region | Latency-sensitive apps |
| Latency-based | Route to fastest responding region | Global apps |
| Weighted | Send X% to each region | Canary deploys, migration |
| Failover | Primary/secondary with health checks | Disaster recovery |

**AWS Route 53 example:** You configure health checks on each region's endpoint.
If US-East fails health checks, Route 53 automatically routes traffic to
US-West. Users experience maybe 60 seconds of elevated latency while DNS
propagates, but no downtime.

---

## Load Balancer as Single Point of Failure

Wait — if the load balancer receives ALL traffic, isn't IT a single point of
failure?

Yes. So you load balance the load balancers.

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│         DNS resolves to multiple IPs (VIP)             │
│         Virtual IP with failover                       │
│                                                        │
│              ┌──────────┐  ┌──────────┐               │
│              │  LB 1    │  │  LB 2    │               │
│              │ (active) │  │ (standby)│               │
│              └────┬─────┘  └────┬─────┘               │
│                   │             │                      │
│              Shared Virtual IP (VIP): 1.2.3.4          │
│              If LB 1 dies, LB 2 takes over VIP        │
│                                                        │
│              Protocols: VRRP, keepalived               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

In the cloud, this is handled for you. AWS ALB/NLB, GCP HTTP LB — they're
all redundant by default across multiple availability zones. You don't manage
the LB instances directly.

---

## Real-World Architecture Pattern

Putting it all together for a modern web application:

```
User Request Flow:

  Browser
    │
    ▼
  DNS (GSLB) ─── resolves to nearest region
    │
    ▼
  CDN Edge ─── serves static assets (cache hit)
    │ (cache miss or API request)
    ▼
  Cloud L7 LB (ALB) ─── SSL termination, path routing
    │
    ├── /api/users/* ──▶ User Service (3 instances)
    ├── /api/photos/* ──▶ Photo Service (5 instances)
    ├── /api/feed/* ────▶ Feed Service (10 instances)
    └── /* ─────────────▶ Web Server (2 instances)
```

Each service behind the LB is stateless. The LB handles:
- SSL termination (so backends don't need certificates)
- Path-based routing (so one domain serves multiple services)
- Health checks (so dead backends get removed automatically)
- Connection draining (so in-flight requests finish during deploys)

---

## Exercises

### Exercise 1: Choose the Right Algorithm
For each scenario, which load balancing algorithm would you use?
1. 5 identical API servers handling REST requests
2. 3 servers: 1 powerful (32 cores), 2 small (4 cores)
3. WebSocket connections that last 30+ minutes
4. A caching layer where you want the same key to hit the same cache node

### Exercise 2: Nginx Configuration
Write an Nginx config that:
- Terminates SSL
- Routes /api/* to a backend pool of 3 servers using least connections
- Routes /static/* to a local file directory with 30-day cache headers
- Returns a custom 502 page when all backends are down
- Has health checks every 10 seconds

### Exercise 3: Failure Scenarios
Your load balancer serves 3 backends. Describe what happens when:
1. Backend 2 starts returning 500 errors on every request
2. Backend 1 becomes extremely slow (10s per response) but doesn't crash
3. All 3 backends go down simultaneously
4. The load balancer itself loses network connectivity

---

## Key Takeaways

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. Use L7 for web apps, L4 for non-HTTP or extreme perf.  │
│                                                             │
│  2. Least connections is a good default algorithm.          │
│                                                             │
│  3. Make servers stateless. Don't rely on stickiness.       │
│                                                             │
│  4. Health checks must test what matters (DB, cache, etc.)  │
│                                                             │
│  5. In the cloud, use managed LBs (ALB, NLB).              │
│     Don't run your own unless you have a specific reason.   │
│                                                             │
│  6. GSLB handles the global layer. LB handles the local    │
│     layer. They work together.                              │
│                                                             │
│  7. The LB is infrastructure you should rarely think about  │
│     once set up correctly. If you're debugging your LB      │
│     regularly, something else is wrong.                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
