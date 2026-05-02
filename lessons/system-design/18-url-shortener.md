# Lesson 18: Design a URL Shortener

Your first end-to-end system design. A URL shortener looks simple — take a
long URL, give back a short one, redirect when someone clicks it. But
underneath, it's a masterclass in hashing, database choices, caching, and
scaling reads.

**Analogy:** Think of a URL shortener like a coat check at a fancy
restaurant. You hand over your bulky coat (long URL), get a small ticket
with a number (short code), and when you come back with the ticket, they
find your coat instantly. The interesting part: how do you assign ticket
numbers, how do you find coats fast, and what happens when 10,000 people
show up at once?

---

## Step 1: Requirements

Always start by asking "what does this system need to do?" before drawing
any boxes.

### Functional Requirements

1. **Shorten** — Given a long URL, return a short URL (e.g., `bit.ly/abc123`)
2. **Redirect** — Given a short URL, redirect to the original long URL
3. **Custom aliases** — Users can pick their own short code (`bit.ly/my-brand`)
4. **Analytics** — Track click count, referrer, timestamp, geography
5. **Expiration** — URLs can have a TTL (time-to-live)

### Non-Functional Requirements

1. **High availability** — The redirect must always work (it's the whole product)
2. **Low latency** — Redirects should be < 50ms (users are waiting)
3. **Read-heavy** — Way more redirects than URL creations
4. **Not guessable** — Short codes shouldn't be sequential (security)

### Out of Scope

- User accounts and authentication (simplify for now)
- URL preview pages
- Spam/phishing detection

---

## Step 2: Back-of-Envelope Estimation

This is napkin math. It doesn't need to be precise — it needs to be in the
right ballpark so you pick the right architecture.

### Traffic

```
Write (create short URL):  100M URLs/day
                           ~1,200 URLs/second

Read (redirects):          100:1 read-to-write ratio
                           10B redirects/day
                           ~120,000 redirects/second
```

**Analogy:** Imagine a library. A few librarians add new books each day
(writes), but thousands of people come in to borrow books every hour
(reads). You'd optimize for finding and lending, not for cataloging.

### Storage

```
Each URL record:
  - Short code:     7 bytes
  - Long URL:       average 200 bytes
  - Created at:     8 bytes
  - Expiration:     8 bytes
  - Click count:    8 bytes
  - Total:          ~250 bytes per URL

Per day:   100M * 250 bytes = 25 GB/day
Per year:  25 GB * 365 = ~9 TB/year
5 years:   ~45 TB
```

### Short Code Length

How long should the short code be? We need enough codes for 5 years of URLs.

```
5 years of URLs: 100M/day * 365 * 5 = ~180 billion URLs

Base62 characters: [a-z, A-Z, 0-9] = 62 characters

62^6 = ~56 billion   (not enough)
62^7 = ~3.5 trillion (plenty of room)

Answer: 7-character codes give us 3.5 trillion possible URLs
```

### Memory for Cache

If we cache the top 20% most-accessed URLs:

```
Daily unique redirects: ~1 billion
Cache 20%: 200M URLs
Memory: 200M * 250 bytes = ~50 GB

A few large Redis instances can handle this.
```

---

## Step 3: High-Level Design

```
                         ┌──────────────┐
                         │   Clients    │
                         │ (browsers,   │
                         │  mobile)     │
                         └──────┬───────┘
                                │
                         ┌──────▼───────┐
                         │ Load Balancer│
                         └──────┬───────┘
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
          ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
          │  Write API  │ │ Read API │ │ Analytics   │
          │  (create)   │ │(redirect)│ │ API         │
          └──────┬──────┘ └────┬─────┘ └──────┬──────┘
                 │             │              │
                 │        ┌────▼─────┐        │
                 │        │  Cache   │        │
                 │        │ (Redis)  │        │
                 │        └────┬─────┘        │
                 │             │              │
          ┌──────▼─────────────▼──────────────▼──────┐
          │              Database                     │
          │        (URL mappings store)               │
          └──────────────────┬───────────────────────┘
                             │
                      ┌──────▼──────┐
                      │  Analytics  │
                      │  Store      │
                      │ (time-series│
                      │  or OLAP)   │
                      └─────────────┘
```

### API Design

```
POST /api/v1/shorten
  Request:  { "long_url": "https://example.com/very/long/path",
              "custom_alias": "my-brand",   // optional
              "expiration": "2025-12-31" }  // optional
  Response: { "short_url": "https://sho.rt/abc123",
              "expires_at": "2025-12-31" }

GET /{short_code}
  Response: HTTP 301/302 redirect to long URL

GET /api/v1/stats/{short_code}
  Response: { "clicks": 142857,
              "created_at": "2024-01-15",
              "top_referrers": [...] }
```

### Core Flow: Creating a Short URL

```
1. Client sends POST /api/v1/shorten with long URL
2. Write API validates the URL (is it a real URL? not blocked?)
3. Generate a unique short code (this is the hard part — see deep dive)
4. Store mapping: short_code → long_url in database
5. Return the short URL to the client
```

### Core Flow: Redirecting

```
1. Client hits GET /abc123
2. Read API checks cache (Redis) for short_code
3. Cache hit → redirect immediately
4. Cache miss → query database, populate cache, then redirect
5. Log the click event asynchronously (don't slow down the redirect)
```

---

## Step 4: Deep Dives

### Deep Dive 1: ID Generation (The Core Problem)

This is the most interesting part. How do you turn a long URL into a
7-character short code? There are several approaches, each with trade-offs.

#### Approach A: Auto-Increment Counter + Base62

**Analogy:** Like a deli counter. Each customer gets the next number.
Simple, guaranteed unique, but predictable.

```
1. Database has an auto-increment counter
2. New URL gets ID 1000000
3. Convert 1000000 to base62 → "4c92"
4. Pad to 7 characters → "004c92" or similar
```

**Base62 encoding** converts a number into characters using [0-9, a-z, A-Z].
Think of it like converting from decimal (base10) to a system with 62 digits.

Here's the implementation in Go:

```go
package shortener

const base62Chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

func EncodeBase62(num uint64) string {
	if num == 0 {
		return string(base62Chars[0])
	}

	encoded := make([]byte, 0, 7)
	for num > 0 {
		remainder := num % 62
		encoded = append(encoded, base62Chars[remainder])
		num /= 62
	}

	for left, right := 0, len(encoded)-1; left < right; left, right = left+1, right-1 {
		encoded[left], encoded[right] = encoded[right], encoded[left]
	}

	return string(encoded)
}

func DecodeBase62(encoded string) uint64 {
	var num uint64
	for _, char := range encoded {
		num *= 62
		switch {
		case char >= '0' && char <= '9':
			num += uint64(char - '0')
		case char >= 'a' && char <= 'z':
			num += uint64(char-'a') + 10
		case char >= 'A' && char <= 'Z':
			num += uint64(char-'A') + 36
		}
	}
	return num
}
```

**Trade-offs:**
- **Pro:** Simple, guaranteed unique, no collisions
- **Con:** Predictable (users can guess next URL), single point of failure
  (the counter), scaling the counter across servers is hard

#### Approach B: Hash + Collision Resolution

**Analogy:** Like assigning locker numbers by hashing a student's name.
Sometimes two students get the same number — you need a backup plan.

```
1. Hash the long URL: MD5("https://example.com/long") → "a1b2c3d4e5f6..."
2. Take the first 7 characters of the base62-encoded hash → "a1b2c3d"
3. Check if that code already exists in the database
4. If collision: append a counter and re-hash, or take next 7 characters
```

**Trade-offs:**
- **Pro:** Same URL always generates the same code (deduplication for free)
- **Con:** Collisions require resolution (extra DB lookups), hash computation
  overhead

#### Approach C: Pre-Generated Keys

**Analogy:** Like pre-printing raffle tickets. You generate all possible
short codes in advance and hand them out as needed.

```
1. Offline service generates millions of unique 7-char codes
2. Stores them in a "key pool" database table (columns: code, used)
3. When a new URL comes in, grab an unused code from the pool
4. Mark it as used
```

**Trade-offs:**
- **Pro:** Zero collision risk, fast (just a DB read + update)
- **Con:** Needs a separate key generation service, concurrency on claiming
  keys (two servers grab the same key)

#### Approach D: Snowflake IDs

**Analogy:** Like a timestamp-based serial number that also includes which
factory made it. Globally unique without coordination.

```
┌─────────────────────────────────────────────────────┐
│ 1 bit │ 41 bits    │ 10 bits     │ 12 bits         │
│ sign  │ timestamp  │ machine ID  │ sequence number  │
└─────────────────────────────────────────────────────┘
```

```
Snowflake ID → 64-bit integer → base62 encode → short code
```

**Trade-offs:**
- **Pro:** No central coordination, time-sortable, no collisions
- **Con:** More complex, depends on synchronized clocks, longer codes

#### Which to Pick?

For a URL shortener at scale, **pre-generated keys** or **counter + base62**
are the most practical. Pre-generated keys avoid the counter bottleneck.
Snowflake is overkill for this use case but great to mention in an interview.

---

### Deep Dive 2: Database Choice

#### Option A: Relational (PostgreSQL)

```
Table: urls
┌──────────┬──────────────────────────────────┬─────────────┬──────────┐
│ short_code│ long_url                         │ created_at  │ expires  │
│ (PK)     │                                  │             │          │
├──────────┼──────────────────────────────────┼─────────────┼──────────┤
│ abc123   │ https://example.com/very/long/... │ 2024-01-15  │ NULL     │
│ xyz789   │ https://other.com/page?q=test    │ 2024-01-15  │ 2025-01  │
└──────────┴──────────────────────────────────┴─────────────┴──────────┘
```

- **Pro:** ACID transactions, mature tooling, easy to reason about
- **Con:** Harder to scale horizontally past a certain point

#### Option B: Key-Value Store (DynamoDB, Cassandra)

The access pattern is simple: `short_code → long_url`. That's a perfect
key-value lookup. No joins, no complex queries.

- **Pro:** Horizontally scalable, fast key lookups, handles massive write
  throughput
- **Con:** No transactions across keys, analytics queries are harder

**Recommendation:** Start with PostgreSQL. Move to a key-value store when you
hit scaling limits. The access pattern is simple enough for either.

---

### Deep Dive 3: Caching Strategy

At 120K redirects/second, hitting the database for every redirect is
expensive. Most URL shorteners follow a Zipf distribution — a small
percentage of URLs get the vast majority of clicks.

**Analogy:** A library doesn't keep every book at the front desk. They keep
the popular bestsellers there and store rare books in the back. Your cache
is the front desk.

```
┌─────────┐     ┌───────────┐     ┌──────────┐
│ Client  │────▶│  Redis    │────▶│ Database │
│         │     │  Cache    │     │          │
└─────────┘     └───────────┘     └──────────┘
                 Cache Hit            Cache Miss
                 (< 1ms)             (5-10ms)
                 ~95% of             populate cache
                 requests            on read
```

**Cache strategy:** Read-through with TTL.

```
1. Check Redis for short_code
2. If found → return long_url (cache hit)
3. If not found → query DB → store in Redis with TTL → return
4. On URL creation → also write to cache (write-through)
```

**Eviction policy:** LRU (Least Recently Used). URLs that haven't been
clicked recently get evicted to make room for active ones.

**Cache warming:** Pre-load the top 1,000 most-clicked URLs into cache on
startup. These "heavy hitters" generate a disproportionate amount of traffic.

---

### Deep Dive 4: 301 vs 302 Redirects

This is a critical trade-off that most people miss.

| Redirect | Meaning | Browser Behavior |
|----------|---------|-----------------|
| **301** | Moved Permanently | Browser caches it — future clicks go directly to long URL |
| **302** | Moved Temporarily | Browser asks the shortener every time |

**If you care about analytics:** Use **302**. Every click goes through your
servers, so you can count it. This is what bit.ly does.

**If you care about speed:** Use **301**. Browsers cache the redirect,
reducing load on your servers. But you lose visibility into clicks.

**Hybrid approach:** Use 302 for the first N days (collect analytics), then
switch to 301 for stable URLs. Or always use 302 and absorb the traffic
cost.

**Analogy:** 301 is like giving someone the new phone number directly — they
never call you again. 302 is like saying "call me and I'll transfer you
every time" — you know every time they call, but it costs you effort.

---

## Step 5: Scaling

### Sharding the Database

At 9 TB/year, you'll need to distribute data across multiple database servers.

**Shard by hash prefix:**

```
short_code = "abc123d"
shard_key  = hash("abc123d") % num_shards

Shard 0: codes where hash % 4 == 0
Shard 1: codes where hash % 4 == 1
Shard 2: codes where hash % 4 == 2
Shard 3: codes where hash % 4 == 3
```

**Why not shard by first character?** Uneven distribution. Codes starting
with 'a' might be 10x more common than codes starting with 'Z'. Hashing
gives uniform distribution.

### Read Replicas

Since reads outnumber writes 100:1, add read replicas:

```
                  ┌──────────────┐
    Writes ──────▶│   Primary    │
                  │   Database   │
                  └──────┬───────┘
                         │ replication
              ┌──────────┼──────────┐
              │          │          │
        ┌─────▼──┐ ┌────▼───┐ ┌───▼────┐
        │Replica │ │Replica │ │Replica │
        │   1    │ │   2    │ │   3    │
        └────────┘ └────────┘ └────────┘
              ▲          ▲          ▲
              └──────────┼──────────┘
                    Reads
```

### Rate Limiting

Protect against abuse (someone creating millions of URLs to exhaust your
short code space):

```
- Per IP: 100 URL creations per hour
- Per user (if authenticated): 1,000 per hour
- Global: Circuit breaker if creation rate exceeds 2x normal
```

### Analytics Pipeline

Don't process analytics in the redirect path — it slows down redirects.

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Redirect │────▶│  Kafka   │────▶│ Consumer │────▶│ Analytics│
│ Service  │     │  Topic   │     │ Workers  │     │ DB       │
└──────────┘     └──────────┘     └──────────┘     └──────────┘

Click event → fire-and-forget into Kafka → process async
```

Each click event contains:

```json
{
  "short_code": "abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "referrer": "https://twitter.com",
  "user_agent": "Mozilla/5.0...",
  "ip_geo": "US-CA"
}
```

---

## Complete Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                    │
│                   (browsers, mobile apps)                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                    ┌──────▼───────┐
                    │    DNS +     │
                    │ Load Balancer│
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │  Write API  │ │ Read API │ │ Analytics   │
     │ (stateless) │ │(stateless│ │ API         │
     │ N instances │ │N instances│ │             │
     └──────┬──────┘ └────┬─────┘ └──────┬──────┘
            │             │              │
     ┌──────▼──────┐ ┌────▼─────┐        │
     │Key Generator│ │  Redis   │        │
     │  Service    │ │  Cluster │        │
     │ (pre-gen)   │ │ (cache)  │        │
     └──────┬──────┘ └────┬─────┘        │
            │             │              │
     ┌──────▼─────────────▼──────┐  ┌────▼─────┐
     │    URL Database           │  │  Kafka   │
     │   (sharded, replicated)   │  │  Topic   │
     └───────────────────────────┘  └────┬─────┘
                                         │
                                   ┌─────▼─────┐
                                   │ Analytics │
                                   │ Workers   │
                                   └─────┬─────┘
                                         │
                                   ┌─────▼──────┐
                                   │ClickHouse/ │
                                   │ Time-Series│
                                   │ DB         │
                                   └────────────┘
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| ID generation | Counter + base62 | Pre-generated keys | Pre-gen for scale |
| Database | SQL (Postgres) | NoSQL (DynamoDB) | Start SQL, migrate later |
| Redirect | 301 (permanent) | 302 (temporary) | 302 if analytics matter |
| Cache | Write-through | Read-through | Both (write + read-through) |
| Analytics | Sync (in request) | Async (Kafka) | Async — never slow redirects |

---

## Common Interview Follow-Ups

**Q: How do you handle the same long URL being shortened twice?**
Option 1: Return the existing short code (requires a lookup by long_url — add
an index). Option 2: Create a new short code each time (simpler, uses more
storage). Most real systems do option 2 because the same URL might be
shortened by different users who each want their own analytics.

**Q: How do you handle expired URLs?**
Lazy deletion: check expiration on redirect. If expired, return 404 and
queue the record for deletion. Background job cleans up expired records
periodically to reclaim space.

**Q: What if the key generation service goes down?**
Each API server can pre-fetch a batch of keys (e.g., 1,000 at a time) and
keep them in memory. If the key service goes down, servers can still create
URLs until their local batch runs out.

**Q: How do custom aliases work?**
Skip the key generation step. Check if the alias is available (DB lookup).
If available, insert it directly. If taken, return an error. Reserve common
words to prevent squatting.

---

## Hands-On Exercise

Build a minimal URL shortener:

1. Write the base62 encode/decode functions in Go
2. Create a simple HTTP server with two endpoints:
   - `POST /shorten` — accepts a URL, returns a short code
   - `GET /:code` — redirects to the original URL
3. Use an in-memory map first, then swap in Redis
4. Add click counting
5. Measure: how many redirects/second can your single server handle?

---

## Key Takeaways

1. **Start with estimation** — the numbers drive every decision (cache size,
   database choice, code length)
2. **ID generation is the core problem** — understand the trade-offs between
   counter, hash, pre-generated, and snowflake approaches
3. **Cache aggressively** — a read-heavy system lives or dies by its cache
4. **301 vs 302 is a business decision**, not just a technical one
5. **Async everything non-critical** — analytics should never slow down the
   user experience
6. **The access pattern is simple** — `key → value` lookup, which means you
   have many good database options

---

*Next: [Lesson 19 — Design a Chat System](./19-chat-system.md), where we
tackle real-time communication, WebSockets, and message delivery guarantees.*
