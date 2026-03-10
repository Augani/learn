# Lesson 21: Design a Distributed Rate Limiter

A rate limiter controls how many requests a user, IP, or API endpoint can
make in a given time window. Without one, a single misbehaving client can
take down your entire system. Every serious production API has rate limiting.

**Analogy:** Think of a rate limiter like a bouncer at a nightclub with a
"one in, one out" policy. The club has a max capacity. If you arrive and
it's full, you wait. The bouncer doesn't care who you are (well, maybe VIPs
get different rules) — they enforce the capacity limit. Now imagine the club
has 50 entrances, each with its own bouncer, and they all need to agree on
the current headcount. That's the distributed part.

---

## Step 1: Requirements

### Functional Requirements

1. **Configurable rules** — Rate limit per user, per IP, per API endpoint,
   or any combination
2. **Multiple algorithms** — Support token bucket, sliding window, fixed
   window
3. **Different limits for different tiers** — Free: 100 req/min, Pro:
   1,000 req/min, Enterprise: 10,000 req/min
4. **Informative responses** — Return remaining quota and reset time in
   response headers
5. **Rule updates** — Change rate limits without restarting servers

### Non-Functional Requirements

1. **Low latency** — Rate limiting check must be < 1ms (it's on every request)
2. **Distributed** — Work across multiple API server instances
3. **Accurate** — Should not allow significantly more requests than the limit
4. **Fault tolerant** — If the rate limiter is down, fail open (allow
   requests) rather than blocking all traffic
5. **Memory efficient** — Millions of users, reasonable memory footprint

### Out of Scope

- DDoS protection (that's network-layer, this is application-layer)
- Bot detection
- Billing integration

---

## Step 2: High-Level Design

```
┌──────────┐     ┌──────────────────────────────────┐     ┌──────────┐
│          │     │         Rate Limiter              │     │          │
│  Client  │────▶│  ┌──────────┐  ┌──────────────┐  │────▶│   API    │
│          │     │  │ Rules    │  │   Counter    │  │     │  Server  │
│          │     │  │ Engine   │  │   Store      │  │     │          │
│          │◀────│  │          │  │   (Redis)    │  │◀────│          │
│          │     │  └──────────┘  └──────────────┘  │     │          │
│ 429 or   │     │                                  │     │          │
│ 200      │     └──────────────────────────────────┘     └──────────┘
└──────────┘                     │
                          ┌──────▼──────┐
                          │   Config    │
                          │   Service   │
                          │  (rules DB) │
                          └─────────────┘
```

### Where Does the Rate Limiter Live?

There are three options:

```
Option A: In the API Gateway (before your code)
  Client → API Gateway (rate limit here) → API Server

Option B: As middleware in each API server
  Client → API Server → [Rate Limit Middleware] → Handler

Option C: As a separate service
  Client → API Server → Rate Limit Service → allow/deny
```

| Location | Latency | Complexity | Flexibility |
|----------|---------|-----------|-------------|
| API Gateway | Lowest | Low (managed) | Limited to gateway features |
| Middleware | Low | Medium | Full control |
| Separate service | Higher (network hop) | High | Maximum flexibility |

**Recommendation:** API Gateway for simple rules (per-IP global limits),
middleware for business logic rules (per-user, per-endpoint).

### Rate Limit Headers

When the limiter processes a request, return these HTTP headers:

```
X-RateLimit-Limit:     100       (max requests allowed)
X-RateLimit-Remaining: 73        (requests left in window)
X-RateLimit-Reset:     1705315200 (unix timestamp when window resets)

When rate limited:
HTTP 429 Too Many Requests
Retry-After: 30                  (seconds until they can retry)
```

---

## Step 3: Algorithm Deep Dives

### Algorithm 1: Token Bucket

This is the most widely used rate limiting algorithm. It's what AWS API
Gateway, Stripe, and most cloud providers use.

**Analogy:** Imagine a bucket that holds tokens (coins). Tokens drip into
the bucket at a steady rate. Every request costs one token. If the bucket
is empty, you wait. The bucket has a maximum capacity, so tokens don't
accumulate forever — this allows short bursts of traffic.

```
┌─────────────────────────┐
│    Token Bucket         │
│                         │
│  Capacity: 10 tokens    │
│  Refill: 2 tokens/sec   │
│                         │
│  ████████░░  (8 tokens) │
│                         │
│  Request arrives:       │
│    tokens > 0? → Allow  │
│    tokens = 0? → Deny   │
└─────────────────────────┘

Timeline:
  t=0.0s  bucket=10  request → allow (9 left)
  t=0.1s  bucket=9   request → allow (8 left)
  t=0.2s  bucket=8   request → allow (7 left)
  ...
  t=0.8s  bucket=2   request → allow (1 left)
  t=0.9s  bucket=1   request → allow (0 left)
  t=1.0s  bucket=2   (+2 refill) request → allow (1 left)
```

**Parameters:**
- **Bucket size (capacity):** Maximum burst size. A bucket of 10 allows 10
  requests in quick succession.
- **Refill rate:** Sustained throughput. 2 tokens/second means 2 requests
  per second on average.

Here's the token bucket implementation in Go:

```go
package ratelimit

import (
	"sync"
	"time"
)

type TokenBucket struct {
	capacity   float64
	tokens     float64
	refillRate float64
	lastRefill time.Time
	mu         sync.Mutex
}

func NewTokenBucket(capacity int, refillPerSecond float64) *TokenBucket {
	return &TokenBucket{
		capacity:   float64(capacity),
		tokens:     float64(capacity),
		refillRate: refillPerSecond,
		lastRefill: time.Now(),
	}
}

func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	tb.refill()

	if tb.tokens < 1 {
		return false
	}

	tb.tokens--
	return true
}

func (tb *TokenBucket) refill() {
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.tokens += elapsed * tb.refillRate

	if tb.tokens > tb.capacity {
		tb.tokens = tb.capacity
	}

	tb.lastRefill = now
}

func (tb *TokenBucket) Remaining() int {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.refill()
	return int(tb.tokens)
}
```

**Trade-offs:**
- **Pro:** Allows bursts (great for real traffic patterns), memory efficient
  (2 numbers per user), simple to implement
- **Con:** Harder to set "exactly N requests per minute" — it's approximate

---

### Algorithm 2: Fixed Window Counter

**Analogy:** Like a parking garage that resets its counter every hour on the
hour. "100 cars per hour" means at 2:00 PM the counter resets to zero, and
the first 100 cars get in. At 2:59 PM it's full, at 3:00 PM it resets.

```
Window: 1 minute

  Minute 1          Minute 2          Minute 3
  ┌────────────┐    ┌────────────┐    ┌────────────┐
  │ count: 87  │    │ count: 100 │    │ count: 23  │
  │ limit: 100 │    │ FULL!      │    │ limit: 100 │
  └────────────┘    └────────────┘    └────────────┘
```

**The boundary problem:** If a user sends 100 requests at 1:59 and 100
requests at 2:00, they've sent 200 requests in a 1-minute span, even though
each individual window only shows 100. The window boundary creates a loophole.

```
Problem visualization:

      Minute 1                    Minute 2
  ──────────────────┼───────────────────────
              ████████████████
              100 req  │  100 req
              at 1:59  │  at 2:00
                       │
  Both windows show 100, but 200 requests happened
  in a ~2-second span crossing the boundary
```

---

### Algorithm 3: Sliding Window Counter (Best of Both Worlds)

This fixes the boundary problem by using a weighted average of the current
and previous window.

**Analogy:** Instead of resetting the parking counter exactly on the hour,
you look at a rolling 60-minute window. "How many cars came in the last 60
minutes?" adjusts continuously.

```
Formula:
  weighted_count = (prev_window_count * overlap_percentage) + current_window_count

Example:
  Previous window (1:00-2:00): 84 requests
  Current window  (2:00-3:00): 36 requests (so far)
  Current time: 2:15 (25% into current window)

  Overlap of previous window: 75% (45 minutes of the previous hour still counts)
  Weighted count = (84 * 0.75) + 36 = 63 + 36 = 99

  Limit is 100 → Allow (1 more request until next tick)
```

This gives you a smooth approximation without storing every individual
request timestamp.

---

### Algorithm 4: Sliding Window Log (Most Accurate)

Store the timestamp of every request. Count how many fall within the window.

```
User: user_123
Window: 60 seconds
Limit: 100 requests

Sorted set in Redis: [timestamps of all requests in the last 60s]

On new request:
  1. Remove all timestamps older than (now - 60 seconds)
  2. Count remaining timestamps
  3. If count < 100 → allow, add current timestamp
  4. If count >= 100 → deny
```

**Trade-offs:**
- **Pro:** Perfectly accurate, no boundary issues
- **Con:** Memory-hungry (stores every timestamp), O(n) cleanup

---

## Step 4: Distributed Implementation with Redis

In production, you have multiple API servers. Each one needs to check the
same rate limit counters. Redis is the standard choice — it's fast (< 1ms),
supports atomic operations, and is already in most tech stacks.

### The Race Condition Problem

```
Without atomicity:

Server A:  GET counter → 99    (under limit of 100)
Server B:  GET counter → 99    (under limit of 100)
Server A:  SET counter → 100   (allow request)
Server B:  SET counter → 100   (allow request — but should be 101!)

Both servers allow the request. Limit exceeded.
```

**Solution:** Use Redis Lua scripts for atomic read-and-increment.

### Full Redis Lua Script: Token Bucket

This is the production-grade implementation. The entire operation — read
tokens, calculate refill, decide allow/deny, update state — runs atomically
inside Redis.

```lua
-- Token Bucket Rate Limiter
-- KEYS[1] = rate limit key (e.g., "ratelimit:user_123:/api/orders")
-- ARGV[1] = bucket capacity
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = current timestamp (seconds, floating point)
-- ARGV[4] = tokens to consume (usually 1)
--
-- Returns: {allowed (0 or 1), remaining_tokens, retry_after_seconds}

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
    tokens = capacity
    last_refill = now
end

local elapsed = math.max(0, now - last_refill)
tokens = math.min(capacity, tokens + (elapsed * refill_rate))
last_refill = now

local allowed = 0
local retry_after = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    retry_after = (requested - tokens) / refill_rate
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) * 2)

return {allowed, math.floor(tokens), math.ceil(retry_after)}
```

### Full Redis Lua Script: Sliding Window Counter

```lua
-- Sliding Window Counter Rate Limiter
-- KEYS[1] = key for previous window count
-- KEYS[2] = key for current window count
-- ARGV[1] = window size in seconds
-- ARGV[2] = max requests per window
-- ARGV[3] = current timestamp
--
-- Returns: {allowed (0 or 1), current_count, remaining}

local prev_key = KEYS[1]
local curr_key = KEYS[2]
local window_size = tonumber(ARGV[1])
local max_requests = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local current_window = math.floor(now / window_size)
local window_start = current_window * window_size
local elapsed_in_window = now - window_start
local weight_previous = 1 - (elapsed_in_window / window_size)

local prev_count = tonumber(redis.call('GET', prev_key) or '0')
local curr_count = tonumber(redis.call('GET', curr_key) or '0')

local weighted_count = math.floor(prev_count * weight_previous) + curr_count

if weighted_count >= max_requests then
    return {0, weighted_count, 0}
end

redis.call('INCR', curr_key)
redis.call('EXPIRE', curr_key, window_size * 2)

local new_count = weighted_count + 1
local remaining = max_requests - new_count

return {1, new_count, remaining}
```

### Using the Lua Scripts from Go

```go
package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type DistributedRateLimiter struct {
	client      *redis.Client
	tokenBucket *redis.Script
}

type RateLimitResult struct {
	Allowed    bool
	Remaining  int
	RetryAfter time.Duration
}

func NewDistributedRateLimiter(client *redis.Client) *DistributedRateLimiter {
	return &DistributedRateLimiter{
		client:      client,
		tokenBucket: redis.NewScript(tokenBucketLua),
	}
}

func (rl *DistributedRateLimiter) Check(
	ctx context.Context,
	key string,
	capacity int,
	refillRate float64,
) (RateLimitResult, error) {
	now := float64(time.Now().UnixMicro()) / 1_000_000.0

	result, err := rl.tokenBucket.Run(ctx, rl.client,
		[]string{fmt.Sprintf("ratelimit:tb:%s", key)},
		capacity, refillRate, now, 1,
	).Int64Slice()

	if err != nil {
		return RateLimitResult{Allowed: true}, err
	}

	return RateLimitResult{
		Allowed:    result[0] == 1,
		Remaining:  int(result[1]),
		RetryAfter: time.Duration(result[2]) * time.Second,
	}, nil
}
```

---

## Step 5: Rules Engine

Rate limits aren't one-size-fits-all. You need different rules for different
situations.

```
Rules configuration (stored in database or config service):

┌──────────────────────────────────────────────────────────────┐
│                     Rate Limit Rules                         │
├──────────┬──────────────┬──────────┬────────────┬────────────┤
│ Rule ID  │ Match        │ Limit    │ Window     │ Algorithm  │
├──────────┼──────────────┼──────────┼────────────┼────────────┤
│ 1        │ tier=free    │ 100      │ 1 minute   │ token_bucket│
│ 2        │ tier=pro     │ 1000     │ 1 minute   │ token_bucket│
│ 3        │ endpoint=    │ 10       │ 1 minute   │ sliding_win│
│          │ /api/login   │          │            │            │
│ 4        │ ip=*         │ 500      │ 1 minute   │ fixed_win  │
│ 5        │ global       │ 100000   │ 1 second   │ token_bucket│
└──────────┴──────────────┴──────────┴────────────┴────────────┘
```

**Rule evaluation order:** Most specific rule wins.

```
Request from user_123 (Pro tier) to /api/login from IP 1.2.3.4:

1. Check endpoint rule:  /api/login → 10 req/min  ← most specific
2. Check tier rule:      pro → 1000 req/min
3. Check IP rule:        1.2.3.4 → 500 req/min
4. Check global rule:    100,000 req/sec

All must pass. The tightest limit effectively controls.
```

---

## Step 6: Advanced Topics

### Rate Limiting at Different Layers

```
┌────────────┐
│   Client   │
└──────┬─────┘
       │
┌──────▼──────┐  Layer 1: Network (IP-based)
│   CDN /     │  Block obvious abuse, DDoS mitigation
│  WAF        │  (Cloudflare, AWS Shield)
└──────┬──────┘
       │
┌──────▼──────┐  Layer 2: API Gateway
│   API       │  Per-IP and per-API-key limits
│  Gateway    │  Global throttling
└──────┬──────┘
       │
┌──────▼──────┐  Layer 3: Application
│  Rate Limit │  Per-user, per-endpoint business rules
│  Middleware  │  Tier-based limits
└──────┬──────┘
       │
┌──────▼──────┐  Layer 4: Service-to-Service
│  Service    │  Circuit breakers, bulkheads
│  Mesh       │  Prevent cascading failures
└──────┬──────┘
       │
┌──────▼──────┐
│  Database   │  Connection pool limits
└─────────────┘  Query timeout limits
```

Each layer catches different types of abuse:
- **Network:** Volumetric attacks (millions of requests from botnets)
- **API Gateway:** API key abuse, scraping
- **Application:** Business logic abuse (spamming messages, brute-force login)
- **Service mesh:** Internal service overload

### Graceful Degradation

What happens when Redis (the counter store) goes down?

```
Option A: Fail Open (recommended for most APIs)
  → If rate limiter is unavailable, allow all requests
  → Risk: temporary over-limit traffic
  → Benefit: users are not blocked

Option B: Fail Closed
  → If rate limiter is unavailable, deny all requests
  → Risk: entire API goes down
  → Benefit: guaranteed protection

Option C: Local Fallback
  → Fall back to in-memory rate limiting per server
  → Risk: limits are per-server, not global (less accurate)
  → Benefit: still some protection, users not blocked
```

**Analogy:** If the bouncer's radio dies and they can't check the headcount
with the other entrances, do they (A) let everyone in, (B) let nobody in,
or (C) keep counting at their own door? Usually (C), with a bias toward (A).

### Synchronization Across Rate Limiter Instances

Three approaches: (1) **Centralized counter (Redis)** — every server checks
Redis on every request. Accurate, adds ~0.5ms latency. Most common. (2)
**Local + periodic sync** — each server keeps local counters and syncs to
Redis every N seconds. Faster but slightly over-limit during sync gaps. (3)
**Gossip protocol** — servers share counter updates with each other, no
central store. Eventually consistent, used at extreme scale.

For most systems, approach 1 works well. Redis handles 100K+ ops/sec easily,
and the 0.5ms latency is negligible compared to the request itself.

---

## Complete Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                         CLIENTS                                │
└────────────────────────────┬──────────────────────────────────┘
                             │
                      ┌──────▼──────┐
                      │    CDN /    │   Layer 1: IP-based blocking
                      │    WAF      │   (Cloudflare, AWS Shield)
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │    API      │   Layer 2: API key limits
                      │   Gateway   │   (Kong, AWS API GW)
                      └──────┬──────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
     ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
     │  API Server │  │ API Server │  │ API Server  │
     │  ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐  │
     │  │Rate    │ │  │ │Rate    │ │  │ │Rate    │  │
     │  │Limit   │ │  │ │Limit   │ │  │ │Limit   │  │
     │  │Middle- │ │  │ │Middle- │ │  │ │Middle- │  │
     │  │ware    │ │  │ │ware    │ │  │ │ware    │  │
     │  └───┬────┘ │  │ └───┬────┘ │  │ └───┬────┘  │
     │      │      │  │     │      │  │     │       │
     └──────┼──────┘  └─────┼──────┘  └─────┼───────┘
            └───────────────┼────────────────┘
                            │
                     ┌──────▼──────┐
                     │   Redis     │  Lua scripts for
                     │  Cluster    │  atomic operations
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │   Rules     │  Rate limit rules
                     │   Config    │  (database + cache)
                     │   Service   │
                     └─────────────┘
```

---

## Algorithm Comparison

| Algorithm | Memory | Accuracy | Burst Handling | Complexity |
|-----------|--------|----------|---------------|-----------|
| Token Bucket | Low (2 values/key) | Good | Allows controlled bursts | Simple |
| Fixed Window | Low (1 counter/key) | Boundary issues | No burst control | Simplest |
| Sliding Window Counter | Low (2 counters/key) | Good (approximate) | Moderate | Medium |
| Sliding Window Log | High (all timestamps) | Perfect | No burst control | Complex |

**Use token bucket when:** You want to allow bursts but enforce average rate
(most APIs).

**Use sliding window when:** You need strict "N requests per time period"
guarantees (login attempts, expensive operations).

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Storage | Local (in-memory) | Centralized (Redis) | Redis for distributed |
| Failure mode | Fail open | Fail closed | Fail open (availability > protection) |
| Algorithm | Token bucket | Sliding window | Token bucket for general, sliding for strict |
| Atomicity | Optimistic locking | Lua script | Lua script (simpler, guaranteed atomic) |
| Rule storage | Config file | Database + cache | DB for dynamic updates, cache for speed |

---

## Common Interview Follow-Ups

**Q: How do you rate limit across multiple data centers?**
Two approaches: (1) Each data center has its own Redis with its own limit
(simpler, limit is per-DC). (2) Global Redis cluster or cross-DC sync
(accurate, but adds latency). Most systems use approach (1) and set each
DC's limit to `global_limit / num_data_centers`.

**Q: How do you handle rate limiting for WebSocket connections?**
Rate limit the connection establishment (HTTP upgrade request) the same as
any other request. For messages within a connection, implement a per-
connection token bucket that runs in-process (no Redis needed since it's a
single connection on a single server).

**Q: How do you communicate limits to API consumers?**
Publish rate limits in your API documentation. Return `X-RateLimit-*`
headers on every response. Provide a `/api/v1/rate-limit-status` endpoint
that returns current usage. Send email alerts when users consistently hit
limits.

**Q: What about rate limiting in a service mesh (microservices)?**
Use sidecar proxies (Envoy, Istio) with built-in rate limiting. This
protects each service from being overwhelmed by other internal services.
Different from API rate limiting — this is about circuit breaking and
backpressure between services.

---

## Hands-On Exercise

Build a rate limiter from scratch:

1. Implement the token bucket algorithm in Go (in-memory, single server)
2. Write an HTTP middleware that uses your token bucket
3. Test it with a load generator — verify it blocks requests after the limit
4. Port the logic to a Redis Lua script
5. Update the middleware to use Redis instead of in-memory
6. Add rate limit response headers
7. Implement a simple rules engine (different limits per endpoint)

---

## Key Takeaways

1. **Redis Lua scripts solve the distributed atomicity problem** — read,
   decide, and update in a single atomic operation
2. **Token bucket is the go-to algorithm** — it handles bursts gracefully
   and is memory efficient
3. **Fail open, not closed** — a broken rate limiter should not take down
   your entire API
4. **Layer your defenses** — rate limiting at the network, gateway,
   application, and service levels catches different threats
5. **Return rate limit headers** — good API citizenship helps clients
   self-throttle and reduces support burden
6. **The tightest limit wins** — when multiple rules apply, the most
   restrictive one effectively controls

---

*Next: [Lesson 22 — Design a News Feed](./22-news-feed.md), where we tackle
fan-out, ranking, and the celebrity problem.*
