# Lesson 06: DNS -- How Names Become IP Addresses

DNS (Domain Name System) translates human-readable domain names like
`api.example.com` into IP addresses like `93.184.216.34`. It is one of the
most critical pieces of internet infrastructure -- if DNS goes down, the
internet effectively stops working for most people.

---

## The Problem

Computers route packets using IP addresses. Humans remember names. We need a
system to translate between the two.

You could hardcode every mapping in a file (and in the early internet, they
did -- a single `HOSTS.TXT` file distributed to every machine). But with
billions of domains, that does not scale.

### The Directory Assistance Analogy

DNS is like calling 411 (directory assistance):

1. You call 411 and say: "I need the number for Example Pizza"
2. The operator looks it up in their directory
3. They reply: "The number is 555-0123"
4. You hang up and call 555-0123

DNS does this for the internet. You give it a name, it gives you a number.

But unlike a single directory, DNS is a **distributed system** -- no single
server has all the answers. The directory is split across millions of servers
organized in a hierarchy.

---

## The DNS Hierarchy

DNS is structured as an inverted tree:

```
                            . (root)
                           / | \
                         /   |   \
                       /     |     \
                    .com   .org   .net   .io   .dev   ...
                   / | \
                 /   |   \
               /     |     \
         example   google   github
          / \        |
        /     \      |
      www    api    mail
```

### The Four Levels

1. **Root (`.`)** -- The top of the tree. There are 13 root server clusters
   (named a.root-servers.net through m.root-servers.net), distributed globally
   via anycast. They do not know every domain -- they know where to find the
   TLD servers.

2. **TLD (Top-Level Domain)** -- `.com`, `.org`, `.net`, `.io`, `.dev`, country
   codes like `.uk`, `.de`, `.jp`. The `.com` TLD servers know where to find
   every `.com` domain's authoritative nameserver.

3. **Authoritative Nameserver** -- The server that has the actual DNS records
   for a domain. If you own `example.com`, your authoritative nameserver holds
   the A, AAAA, MX, and other records for `example.com`.

4. **Subdomains** -- `www.example.com`, `api.example.com`,
   `mail.example.com`. These are additional records managed by the same
   authoritative nameserver (or delegated to another).

---

## DNS Record Types

Each domain can have multiple records of different types:

| Type   | Name                | Purpose                           | Example                          |
|--------|---------------------|-----------------------------------|----------------------------------|
| A      | Address             | Maps domain to IPv4 address       | `example.com -> 93.184.216.34`   |
| AAAA   | IPv6 Address        | Maps domain to IPv6 address       | `example.com -> 2606:2800:...`   |
| CNAME  | Canonical Name      | Alias to another domain           | `www.example.com -> example.com` |
| MX     | Mail Exchange       | Where to deliver email            | `example.com -> mail.example.com`|
| NS     | Nameserver          | Which server is authoritative     | `example.com -> ns1.example.com` |
| TXT    | Text                | Arbitrary text (SPF, DKIM, etc.)  | `example.com -> "v=spf1 ..."`   |
| SRV    | Service             | Service location (host + port)    | `_http._tcp.example.com`        |
| PTR    | Pointer             | Reverse DNS (IP to domain)        | `34.216.184.93 -> example.com`   |
| SOA    | Start of Authority  | Zone metadata (serial, refresh)   | Zone admin info                  |

### CNAME: The Alias Record

A CNAME is like a mail forwarding address. When you look up `www.example.com`
and it has a CNAME pointing to `example.com`, the resolver follows the chain
and returns the A record for `example.com`:

```
Query: www.example.com
  -> CNAME: example.com
  -> A: 93.184.216.34

The client gets: 93.184.216.34
```

CNAMEs are commonly used to point subdomains to CDNs or load balancers:
```
cdn.example.com  CNAME  d1234.cloudfront.net
api.example.com  CNAME  my-app.herokuapp.com
```

### MX: Mail Records

MX records tell email servers where to deliver mail for a domain. They include
a priority (lower = preferred):

```
example.com  MX  10  mail1.example.com
example.com  MX  20  mail2.example.com

"Deliver email to mail1 first. If it is down, try mail2."
```

---

## DNS Resolution: Step by Step

When you type `api.example.com` in your browser, here is the full resolution
process:

```
Your Machine            Recursive Resolver        Root Server
     |                  (e.g., 8.8.8.8)           (e.g., a.root-servers.net)
     |                        |                         |
     |  1. "What is the       |                         |
     |   IP for               |                         |
     |   api.example.com?"    |                         |
     | ---------------------->|                         |
     |                        |                         |
     |                        |  2. "Where is           |
     |                        |   .com?"                |
     |                        |------------------------>|
     |                        |                         |
     |                        |  3. "Ask the .com       |
     |                        |   TLD servers at        |
     |                        |   192.5.6.30"           |
     |                        |<------------------------|
     |                        |
     |                        |         TLD Server (.com)
     |                        |         (e.g., a.gtld-servers.net)
     |                        |               |
     |                        |  4. "Where is |
     |                        |   example.com?"|
     |                        |-------------->|
     |                        |               |
     |                        |  5. "Ask      |
     |                        |   ns1.example |
     |                        |   .com at     |
     |                        |   198.51.100.1"|
     |                        |<--------------|
     |                        |
     |                        |    Authoritative NS (example.com)
     |                        |    (ns1.example.com)
     |                        |               |
     |                        |  6. "What is  |
     |                        |   api.example |
     |                        |   .com?"      |
     |                        |-------------->|
     |                        |               |
     |                        |  7. "It is    |
     |                        |   93.184.216.34"|
     |                        |<--------------|
     |                        |
     |  8. "api.example.com   |
     |   is 93.184.216.34"    |
     |<-----------------------|
     |                        |
     |  (resolver caches      |
     |   this for future      |
     |   queries)             |
```

This looks expensive (4 round trips), but in practice:
- The recursive resolver **caches** results aggressively
- Root and TLD servers are cached almost permanently
- Most queries are answered from cache in a single round trip

### Who Is the Recursive Resolver?

Your recursive resolver (also called a DNS resolver or recursive nameserver)
is usually:
- Your ISP's DNS server (assigned automatically via DHCP)
- Or a public resolver you configured: `8.8.8.8` (Google), `1.1.1.1`
  (Cloudflare), `9.9.9.9` (Quad9)

---

## DNS Caching and TTL

Every DNS record has a **TTL (Time To Live)** -- how long resolvers should
cache the answer before asking again.

```
$ dig example.com

;; ANSWER SECTION:
example.com.    3600    IN    A    93.184.216.34
                ^^^^
                TTL = 3600 seconds (1 hour)
```

After 1 hour, the cached entry expires, and the resolver must query the
authoritative server again.

### TTL Trade-offs

| Short TTL (60s)              | Long TTL (86400s / 24h)          |
|------------------------------|----------------------------------|
| Changes propagate quickly    | Changes take hours to propagate  |
| More DNS queries (more load) | Fewer queries (less load)        |
| Higher latency (more lookups)| Lower latency (cached longer)    |
| Good for: failover, migration| Good for: stable services        |

**Common strategy:** Use a long TTL normally (3600s). Before a migration,
lower the TTL to 60s so the change propagates quickly. After migration, raise
it back.

### DNS Caching Layers

Your query might be cached at multiple levels:

```
1. Browser cache (Chrome caches DNS for ~60s)
2. OS cache (your machine's local DNS cache)
3. Router cache (some home routers cache DNS)
4. Recursive resolver cache (ISP or public resolver)

A cached answer at any level skips all further queries.
```

```bash
# View your OS DNS cache (macOS):
sudo dscacheutil -flushcache  # flush it
# There is no built-in way to view macOS DNS cache

# Linux (systemd-resolved):
resolvectl statistics           # cache stats
sudo systemd-resolve --flush-caches  # flush
```

---

## /etc/hosts: Local DNS Override

Before your machine queries any DNS server, it checks `/etc/hosts` -- a local
file that maps names to IPs:

```
# /etc/hosts
127.0.0.1       localhost
::1             localhost

# Custom entries:
192.168.1.50    mydevserver.local
127.0.0.1       ads.annoying-tracker.com
```

Uses for `/etc/hosts`:
- **Development:** Point `api.myapp.local` to `127.0.0.1`
- **Testing:** Override a domain to point to a staging server
- **Ad blocking:** Point ad domains to `127.0.0.1` (the request goes nowhere)

Entries in `/etc/hosts` take precedence over DNS queries. If you add
`127.0.0.1 example.com` to `/etc/hosts`, your machine will never query DNS
for `example.com`.

---

## DNS Tools

### dig: The Standard DNS Tool

`dig` (Domain Information Groper) is the go-to tool for DNS troubleshooting.

```bash
# Basic query:
$ dig example.com

; <<>> DiG 9.18.18 <<>> example.com
;; QUESTION SECTION:
;example.com.                   IN      A

;; ANSWER SECTION:
example.com.            3600    IN      A       93.184.216.34

;; Query time: 12 msec
;; SERVER: 8.8.8.8#53(8.8.8.8)
;; MSG SIZE  rcvd: 56
```

```bash
# Query specific record types:
dig example.com AAAA          # IPv6 address
dig example.com MX            # Mail servers
dig example.com NS            # Nameservers
dig example.com TXT           # TXT records (SPF, DKIM)
dig example.com ANY           # All records (some servers block this)

# Just the answer, nothing else:
dig +short example.com        # Output: 93.184.216.34

# Use a specific DNS server:
dig @1.1.1.1 example.com     # Query Cloudflare's resolver
dig @8.8.8.8 example.com     # Query Google's resolver

# Trace the full resolution path:
dig +trace example.com
# Shows: root -> TLD -> authoritative -> answer
# This is the most educational dig command.
```

### nslookup: Simpler Alternative

```bash
$ nslookup example.com
Server:     8.8.8.8
Address:    8.8.8.8#53

Non-authoritative answer:
Name:   example.com
Address: 93.184.216.34
```

### host: Simplest

```bash
$ host example.com
example.com has address 93.184.216.34
example.com has IPv6 address 2606:2800:220:1:248:1893:25c8:1946
example.com mail is handled by 0 .
```

---

## DNS Over HTTPS (DoH) and DNS Over TLS (DoT)

Traditional DNS queries are sent in **plaintext over UDP**. Anyone on the
network path (your ISP, a coffee shop Wi-Fi operator) can see what domains
you are resolving. This is a privacy problem.

### DNS Over TLS (DoT)

Wraps DNS queries in a TLS connection (port 853). The query content is
encrypted, but the fact that you are making DNS queries (to port 853) is
still visible.

### DNS Over HTTPS (DoH)

Sends DNS queries as HTTPS requests to a web server (port 443). This looks
like normal HTTPS traffic, making it harder to distinguish from regular web
browsing. Used by Firefox, Chrome, and other browsers.

```
Traditional DNS:
  Client ---[UDP port 53, plaintext]---> Resolver
  ISP can see: "Client queried example.com"

DNS over TLS:
  Client ---[TLS port 853, encrypted]--> Resolver
  ISP can see: "Client is making DNS queries" (but not which domains)

DNS over HTTPS:
  Client ---[HTTPS port 443, encrypted]-> Resolver
  ISP can see: "Client is making HTTPS requests" (indistinguishable
  from normal web traffic)
```

### Common DoH Resolvers

| Provider   | DoH URL                                    |
|------------|---------------------------------------------|
| Cloudflare | `https://cloudflare-dns.com/dns-query`      |
| Google     | `https://dns.google/dns-query`              |
| Quad9      | `https://dns.quad9.net/dns-query`           |

---

## DNS in Rust

A simple DNS lookup using the standard library:

```rust
use std::net::ToSocketAddrs;

fn main() {
    let domain = "example.com:80";

    match domain.to_socket_addrs() {
        Ok(addrs) => {
            for addr in addrs {
                println!("{} resolved to {}", domain, addr);
            }
        }
        Err(err) => {
            eprintln!("Failed to resolve {}: {}", domain, err);
        }
    }
}
```

For more control, use the `trust-dns-resolver` (now called `hickory-resolver`)
crate:

```rust
// Cargo.toml:
// [dependencies]
// hickory-resolver = "0.24"
// tokio = { version = "1", features = ["full"] }

use hickory_resolver::TokioAsyncResolver;
use hickory_resolver::config::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let resolver = TokioAsyncResolver::tokio(
        ResolverConfig::default(),
        ResolverOpts::default(),
    );

    let response = resolver.lookup_ip("example.com.").await?;
    for ip in response.iter() {
        println!("example.com -> {}", ip);
    }

    let mx_response = resolver.mx_lookup("example.com.").await?;
    for mx in mx_response.iter() {
        println!(
            "MX: priority={}, exchange={}",
            mx.preference(),
            mx.exchange()
        );
    }

    Ok(())
}
```

---

## Common DNS Problems

### 1. DNS Propagation Delay

You update your DNS record, but the old IP is still being served. This is
because resolvers cache the old record until its TTL expires. Lower the TTL
before making changes.

### 2. NXDOMAIN

"Non-Existent Domain." The domain does not exist in DNS. Check for typos.

### 3. SERVFAIL

The authoritative nameserver failed to respond. Could be misconfigured DNS,
the nameserver is down, or DNSSEC validation failed.

### 4. DNS Hijacking

A malicious actor intercepts DNS queries and returns fake IP addresses,
redirecting you to a phishing site. DoH/DoT help prevent this.

### 5. DNS Rebinding

An attack where a domain resolves to a public IP initially, then resolves to
a private IP (like 127.0.0.1 or 192.168.1.1), tricking your browser into
making requests to internal services.

---

## Exercises

### Exercise 1: Use dig to Explore DNS Records

```bash
# Look up various record types for a domain you use:
dig example.com A
dig example.com AAAA
dig example.com MX
dig example.com NS
dig example.com TXT

# Try with +short for concise output:
dig +short github.com A
dig +short gmail.com MX
```

### Exercise 2: Trace a Full DNS Resolution

```bash
# Watch the entire resolution process:
dig +trace example.com

# You should see:
# 1. Query to root servers (.)
# 2. Referral to .com TLD servers
# 3. Referral to example.com's authoritative NS
# 4. Final answer from authoritative NS
```

### Exercise 3: Compare DNS Resolvers

```bash
# Query the same domain from different resolvers:
dig @8.8.8.8 example.com +short     # Google
dig @1.1.1.1 example.com +short     # Cloudflare
dig @9.9.9.9 example.com +short     # Quad9

# Do they all return the same IP?
# Measure the query time for each:
dig @8.8.8.8 example.com | grep "Query time"
dig @1.1.1.1 example.com | grep "Query time"
```

### Exercise 4: Add a Custom /etc/hosts Entry

```bash
# Add a custom entry (requires sudo):
sudo sh -c 'echo "127.0.0.1  mytest.local" >> /etc/hosts'

# Test it:
ping -c 1 mytest.local
# Should resolve to 127.0.0.1

# Clean up when done:
# Remove the line you added from /etc/hosts
```

### Exercise 5: Observe DNS Caching

```bash
# Query a domain and note the TTL:
dig example.com | grep -A1 "ANSWER SECTION"

# Query again immediately. The TTL should be lower
# (counting down from the original value).
dig example.com | grep -A1 "ANSWER SECTION"

# The decreasing TTL shows the resolver is serving from cache.
```

### Exercise 6: Watch DNS Over UDP

```bash
# Capture DNS traffic:
sudo tcpdump -i any udp port 53 -nn

# In another terminal, clear your DNS cache and resolve a domain:
# macOS:
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
dig example.com

# In tcpdump, you should see:
# 1. One UDP packet out (your query to the resolver)
# 2. One UDP packet back (the resolver's answer)
```

---

Next: [Lesson 07: HTTP/1.1 -- The Protocol That Runs the Web](./07-http.md)
