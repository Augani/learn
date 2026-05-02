# Lesson 14: Rate Limiting and Throttling — Protecting Your System

Every API you've ever used has a limit on how much you can call it. Stripe
gives you 100 requests per second. GitHub gives you 5,000 per hour. Twitter
gives authenticated users 300 reads per 15 minutes. This isn't stinginess —
it's survival. Without rate limiting, one misbehaving client can take down
your entire service.

---

## The Nightclub Bouncer Analogy

Rate limiting is like a nightclub bouncer:

- **Max capacity** — the club holds 500 people. Once full, nobody else gets in
  until someone leaves.
- **Controlled entry rate** — even if there's room, the bouncer lets people
  in at a steady pace (not 200 at once through the door).
- **Line management** — people in line are told approximately how long to wait.
- **VIP treatment** — some people get faster entry (higher rate limits for
  paying customers).
- **Troublemakers get banned** — repeated abuse gets you blocked entirely.

Your API bouncer does exactly the same thing, but with HTTP status codes
instead of velvet ropes.

---

## Why You Need Rate Limiting

### 1. Abuse Prevention

Without limits, a single script can hammer your API with millions of requests,
consuming CPU, memory, database connections, and bandwidth meant for
legitimate users.

### 2. Cost Control

Every API call costs money — compute, bandwidth, third-party API calls
downstream. An uncontrolled client can run up your cloud bill overnight.

### 3. Fair Usage

If one tenant consumes 90% of shared resources, the other tenants suffer.
Rate limiting ensures equitable access.

### 4. Cascading Failure Prevention

```
Without rate limiting:

Client burst ──> API Server ──> Database
  10,000 req/s      dies         dies

With rate limiting:

Client burst ──> Rate Limiter ──> API Server ──> Database
  10,000 req/s    passes 100/s     healthy       healthy
                  rejects rest
                  (429 status)
```

---

## Algorithm 1: Token Bucket

The most widely used algorithm. Imagine a bucket that holds tokens:

```
┌──────────────────────────────────────────────────┐
│                  TOKEN BUCKET                     │
│                                                   │
│  Bucket capacity: 10 tokens                       │
│  Refill rate: 2 tokens per second                 │
│                                                   │
│  ┌─────────────────────────────┐                  │
│  │  ○ ○ ○ ○ ○ ○ ○ . . .       │ 7/10 tokens      │
│  └─────────────────────────────┘                  │
│       ▲                    │                      │
│       │ Refill (2/sec)     │ Consume (1 per req)  │
│       │                    ▼                      │
│                                                   │
│  Request arrives:                                 │
│    Token available? → Take one, process request   │
│    No tokens?       → Reject (429 Too Many Reqs)  │
│                                                   │
│  Key property: allows bursts up to bucket size    │
│  A full bucket (10) can handle 10 rapid requests  │
│  Then refills at the steady 2/sec rate            │
└──────────────────────────────────────────────────┘
```

**Why it's popular:** It naturally handles bursts. A user who hasn't made
requests in a while has a full bucket and can fire off several quick calls.
The steady-state rate is still enforced over time.

### Token Bucket in Go

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

	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.tokens += elapsed * tb.refillRate
	if tb.tokens > tb.capacity {
		tb.tokens = tb.capacity
	}
	tb.lastRefill = now

	if tb.tokens < 1 {
		return false
	}

	tb.tokens--
	return true
}

func (tb *TokenBucket) RetryAfter() time.Duration {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	if tb.tokens >= 1 {
		return 0
	}

	deficit := 1.0 - tb.tokens
	return time.Duration(deficit/tb.refillRate*1000) * time.Millisecond
}
```

---

## Algorithm 2: Leaky Bucket

Same idea, different metaphor. Requests go into a bucket. The bucket "leaks"
(processes) requests at a fixed rate. If the bucket is full, new requests
overflow and are dropped.

```
┌──────────────────────────────────────────────────┐
│                 LEAKY BUCKET                      │
│                                                   │
│  Incoming requests pour in from the top           │
│                                                   │
│       ▼ ▼ ▼ ▼ ▼  (burst of requests)             │
│  ┌─────────────────┐                              │
│  │  ■ ■ ■ ■ ■      │ ← Queue (fixed size)        │
│  │  ■ ■ ■          │                              │
│  └────────┬────────┘                              │
│           │                                       │
│           ▼  (leaks at constant rate)              │
│      ═══════                                      │
│      Processed: 5 requests/second (always)        │
│                                                   │
│  Overflow (bucket full) → Request rejected        │
│                                                   │
│  Key property: output is ALWAYS at a fixed rate    │
│  No bursts allowed in the output                  │
└──────────────────────────────────────────────────┘
```

**Token Bucket vs Leaky Bucket:**

```
┌───────────────┬──────────────────────┬──────────────────────┐
│               │  Token Bucket        │  Leaky Bucket        │
├───────────────┼──────────────────────┼──────────────────────┤
│  Bursts       │  Allows (up to       │  Smooths out — fixed │
│               │  bucket capacity)    │  output rate always  │
│  Use case     │  API rate limiting   │  Traffic shaping     │
│  Analogy      │  Prepaid phone       │  Hourglass           │
│               │  minutes             │                      │
│  Output       │  Variable            │  Constant            │
└───────────────┴──────────────────────┴──────────────────────┘
```

---

## Algorithm 3: Fixed Window

Divide time into fixed windows (e.g., 1-minute blocks). Count requests
per window. If the count exceeds the limit, reject.

```
┌──────────────────────────────────────────────────┐
│               FIXED WINDOW                        │
│                                                   │
│  Window: 1 minute, Limit: 100 requests            │
│                                                   │
│  10:00:00 ─────────── 10:01:00 ─────────── 10:02 │
│  │  count: 87         │  count: 12                │
│  │  ✓ all allowed     │  ✓ all allowed            │
│  └────────────────────┴───────────────────────────│
│                                                   │
│  Problem — the boundary spike:                    │
│                                                   │
│  10:00:00 ──────────── 10:01:00 ──────────── 10:02│
│            ...58 reqs │ 92 reqs...                │
│           last 2 sec  │ first 2 sec               │
│                                                   │
│  Both windows under 100, but 150 requests hit     │
│  in a 4-second span across the boundary!          │
└──────────────────────────────────────────────────┘
```

**Pros:** Simple, memory-efficient (one counter per key per window).
**Cons:** The boundary problem — up to 2x the rate limit near window edges.

---

## Algorithm 4: Sliding Window Log

Instead of fixed windows, track the timestamp of every request. When a new
request arrives, count all requests in the past N seconds.

```
┌──────────────────────────────────────────────────┐
│            SLIDING WINDOW LOG                     │
│                                                   │
│  Limit: 5 requests per 10 seconds                 │
│                                                   │
│  Request log (sorted timestamps):                 │
│  [10:00:01, 10:00:03, 10:00:05, 10:00:07, 10:00:09]  │
│                                                   │
│  New request at 10:00:11:                         │
│  Window = [10:00:01 ... 10:00:11]                 │
│  Remove entries before 10:00:01: none             │
│  Count in window: 5                               │
│  At limit → REJECT                                │
│                                                   │
│  New request at 10:00:12:                         │
│  Window = [10:00:02 ... 10:00:12]                 │
│  Remove 10:00:01 (expired)                        │
│  Count in window: 4                               │
│  Under limit → ALLOW                              │
└──────────────────────────────────────────────────┘
```

**Pros:** Perfectly accurate. No boundary problems.
**Cons:** Memory-intensive — stores every timestamp. At 10,000 requests
per window, that's 10,000 entries per user.

---

## Algorithm 5: Sliding Window Counter

The sweet spot. Combines fixed window efficiency with sliding window accuracy.
Uses a weighted sum of the current and previous window.

```
┌──────────────────────────────────────────────────┐
│          SLIDING WINDOW COUNTER                   │
│                                                   │
│  Window: 1 minute, Limit: 100 requests            │
│                                                   │
│  Previous window (10:00 - 10:01): 84 requests     │
│  Current window  (10:01 - 10:02): 36 requests     │
│  Current time: 10:01:15                           │
│                                                   │
│  We're 15 seconds into the current window         │
│  = 25% through the window                         │
│  = 75% of previous window still overlaps          │
│                                                   │
│  Weighted count = (84 * 0.75) + 36 = 63 + 36 = 99│
│                                                   │
│  99 < 100 → ALLOW                                 │
│                                                   │
│  Only stores TWO counters per key — extremely     │
│  memory-efficient while staying accurate.          │
└──────────────────────────────────────────────────┘
```

### Sliding Window in TypeScript with Redis

```typescript
import { Redis } from "ioredis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
  resetAt: number;
}

async function slidingWindowRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const currentWindow = Math.floor(now / windowMs) * windowMs;
  const previousWindow = currentWindow - windowMs;

  const pipe = redis.pipeline();
  pipe.get(`rate:${key}:${previousWindow}`);
  pipe.get(`rate:${key}:${currentWindow}`);
  const results = await pipe.exec();

  const prevCount = parseInt((results![0][1] as string) ?? "0", 10);
  const currCount = parseInt((results![1][1] as string) ?? "0", 10);

  const elapsedInWindow = now - currentWindow;
  const previousWeight = 1 - elapsedInWindow / windowMs;
  const estimatedCount = Math.floor(prevCount * previousWeight) + currCount;

  if (estimatedCount >= limit) {
    const retryAfterMs = Math.ceil(
      ((estimatedCount - limit + 1) / (limit / windowMs)) * 1000
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
      limit,
      resetAt: currentWindow + windowMs,
    };
  }

  const incrPipe = redis.pipeline();
  incrPipe.incr(`rate:${key}:${currentWindow}`);
  incrPipe.pexpire(`rate:${key}:${currentWindow}`, windowMs * 2);
  await incrPipe.exec();

  return {
    allowed: true,
    remaining: limit - estimatedCount - 1,
    retryAfterMs: 0,
    limit,
    resetAt: currentWindow + windowMs,
  };
}
```

### Using It in Express Middleware

```typescript
import { Request, Response, NextFunction } from "express";

function rateLimitMiddleware(
  redis: Redis,
  limit: number,
  windowMs: number
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientKey = req.ip ?? "unknown";
    const result = await slidingWindowRateLimit(
      redis,
      clientKey,
      limit,
      windowMs
    );

    res.setHeader("X-RateLimit-Limit", result.limit);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(result.resetAt / 1000)
    );

    if (!result.allowed) {
      res.setHeader(
        "Retry-After",
        Math.ceil(result.retryAfterMs / 1000)
      );
      res.status(429).json({
        error: "Too Many Requests",
        retryAfterMs: result.retryAfterMs,
      });
      return;
    }

    next();
  };
}
```

---

## Algorithm Comparison

```
┌──────────────────────┬──────────┬───────────┬───────────────┐
│  Algorithm           │  Memory  │  Accuracy │  Burst Handle │
├──────────────────────┼──────────┼───────────┼───────────────┤
│  Token Bucket        │  O(1)    │  Good     │  Allows burst │
│  Leaky Bucket        │  O(N)    │  Good     │  Smooths out  │
│  Fixed Window        │  O(1)    │  Poor     │  2x at edges  │
│  Sliding Window Log  │  O(N)    │  Perfect  │  No bursts    │
│  Sliding Window Cnt  │  O(1)    │  Good*    │  Approx only  │
└──────────────────────┴──────────┴───────────┴───────────────┘

* Sliding window counter is ~99.8% accurate per Cloudflare's analysis.
  Good enough for nearly all use cases.
```

---

## Distributed Rate Limiting

Single-server rate limiting is easy — a mutex and a counter. But when you
have 50 API servers behind a load balancer, each server only sees a fraction
of the traffic. You need centralized state.

```
┌──────────────────────────────────────────────────────────┐
│              DISTRIBUTED RATE LIMITING                    │
│                                                          │
│   Client ─┬─> Server 1 ─┐                               │
│            ├─> Server 2 ──┤──> Redis (shared counters)   │
│            └─> Server 3 ─┘                               │
│                                                          │
│   Without Redis: Each server allows 100 req/s            │
│   = 300 req/s total (3x the intended limit!)             │
│                                                          │
│   With Redis: All servers check the same counter         │
│   = 100 req/s total (correct)                            │
└──────────────────────────────────────────────────────────┘
```

### Redis-Based Rate Limiting in Go

```go
package ratelimit

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

type DistributedLimiter struct {
	client   *redis.Client
	limit    int
	windowMs int64
}

func NewDistributedLimiter(client *redis.Client, limit int, window time.Duration) *DistributedLimiter {
	return &DistributedLimiter{
		client:   client,
		limit:    limit,
		windowMs: window.Milliseconds(),
	}
}

var slidingWindowScript = redis.NewScript(`
	local key = KEYS[1]
	local now = tonumber(ARGV[1])
	local window = tonumber(ARGV[2])
	local limit = tonumber(ARGV[3])

	-- Remove expired entries
	redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

	-- Count current entries
	local count = redis.call('ZCARD', key)

	if count < limit then
		-- Add this request
		redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
		redis.call('PEXPIRE', key, window)
		return {1, limit - count - 1, 0}
	else
		-- Get oldest entry to calculate retry time
		local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
		local retryAfter = 0
		if #oldest > 0 then
			retryAfter = tonumber(oldest[2]) + window - now
		end
		return {0, 0, retryAfter}
	end
`)

type Result struct {
	Allowed      bool
	Remaining    int
	RetryAfterMs int64
}

func (dl *DistributedLimiter) Allow(ctx context.Context, clientID string) (Result, error) {
	key := fmt.Sprintf("ratelimit:%s", clientID)
	now := time.Now().UnixMilli()

	vals, err := slidingWindowScript.Run(ctx, dl.client, []string{key},
		now, dl.windowMs, dl.limit,
	).Int64Slice()
	if err != nil {
		return Result{}, fmt.Errorf("rate limit check failed: %w", err)
	}

	return Result{
		Allowed:      vals[0] == 1,
		Remaining:    int(vals[1]),
		RetryAfterMs: vals[2],
	}, nil
}
```

### Why a Lua Script?

The Lua script runs atomically on Redis. Without it, there's a race condition:

```
Time 0ms: Server A reads count = 99   (under limit of 100)
Time 0ms: Server B reads count = 99   (under limit of 100)
Time 1ms: Server A increments → 100
Time 1ms: Server B increments → 101   (OVER LIMIT — slipped through!)
```

The Lua script makes the read-check-write atomic. Redis executes Lua scripts
without interleaving other commands.

---

## Rate Limit Headers

Your API should always tell clients about their rate limit status:

```
Standard headers (draft RFC):

X-RateLimit-Limit: 100          ← Max requests allowed per window
X-RateLimit-Remaining: 42       ← Requests remaining in current window
X-RateLimit-Reset: 1705312800   ← Unix timestamp when window resets

When rate limited (429):
Retry-After: 30                 ← Seconds until client should retry
```

Some APIs also include:

```
X-RateLimit-Policy: 100;w=60    ← 100 requests per 60-second window
X-RateLimit-Used: 58             ← Requests used so far
```

---

## Client-Side Handling

### Exponential Backoff

When you get a 429, don't retry immediately. Each retry waits longer:

```
Attempt 1: wait 1 second
Attempt 2: wait 2 seconds
Attempt 3: wait 4 seconds
Attempt 4: wait 8 seconds
Attempt 5: wait 16 seconds
...give up after max retries
```

### Jitter

If 1,000 clients all get rate-limited at the same time and all retry after
exactly 1 second, you get a "thundering herd" — 1,000 simultaneous retries.
Add randomness (jitter) to spread them out.

```
┌──────────────────────────────────────────────────────────┐
│              THUNDERING HERD WITHOUT JITTER               │
│                                                          │
│  Time 0s:  1000 requests → all rejected (429)            │
│  Time 1s:  1000 retries  → all rejected again            │
│  Time 2s:  1000 retries  → all rejected again            │
│                                                          │
│              WITH JITTER                                  │
│                                                          │
│  Time 0s:  1000 requests → all rejected (429)            │
│  Time 0.5-1.5s: retries spread across 1 second           │
│  Time 1.0-3.0s: second round spread across 2 seconds     │
│  Much smoother load on the server                        │
└──────────────────────────────────────────────────────────┘
```

### Exponential Backoff with Jitter in TypeScript

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

async function fetchWithBackoff<T>(
  url: string,
  options: RequestInit,
  config: RetryConfig = { maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 30000 }
): Promise<T> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status !== 429 && response.status < 500) {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json() as Promise<T>;
    }

    if (attempt === config.maxRetries) {
      throw new Error(
        `Failed after ${config.maxRetries} retries: HTTP ${response.status}`
      );
    }

    let delayMs: number;

    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) {
      delayMs = parseInt(retryAfter, 10) * 1000;
    } else {
      const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * config.baseDelayMs;
      delayMs = Math.min(exponentialDelay + jitter, config.maxDelayMs);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Unreachable");
}
```

### Backoff in Go

```go
package ratelimit

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"time"
)

type RetryConfig struct {
	MaxRetries  int
	BaseDelay   time.Duration
	MaxDelay    time.Duration
}

func DoWithBackoff(ctx context.Context, client *http.Client, req *http.Request, cfg RetryConfig) (*http.Response, error) {
	for attempt := 0; attempt <= cfg.MaxRetries; attempt++ {
		resp, err := client.Do(req.WithContext(ctx))
		if err != nil {
			return nil, fmt.Errorf("request failed: %w", err)
		}

		if resp.StatusCode != http.StatusTooManyRequests && resp.StatusCode < 500 {
			return resp, nil
		}
		resp.Body.Close()

		if attempt == cfg.MaxRetries {
			return nil, fmt.Errorf("failed after %d retries: status %d", cfg.MaxRetries, resp.StatusCode)
		}

		delay := calculateDelay(resp, attempt, cfg)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
	}

	return nil, fmt.Errorf("unreachable")
}

func calculateDelay(resp *http.Response, attempt int, cfg RetryConfig) time.Duration {
	if retryAfter := resp.Header.Get("Retry-After"); retryAfter != "" {
		if seconds, err := strconv.Atoi(retryAfter); err == nil {
			return time.Duration(seconds) * time.Second
		}
	}

	exponential := float64(cfg.BaseDelay) * math.Pow(2, float64(attempt))
	jitter := rand.Float64() * float64(cfg.BaseDelay)
	delay := time.Duration(exponential + jitter)

	if delay > cfg.MaxDelay {
		delay = cfg.MaxDelay
	}

	return delay
}
```

---

## API Gateway Rate Limiting

In production, you rarely implement rate limiting in every service. Instead,
put it at the gateway layer:

```
┌─────────────────────────────────────────────────────────────┐
│                   API GATEWAY RATE LIMITING                   │
│                                                              │
│  Client ──> API Gateway ──────────────────> Backend Services │
│              │                                               │
│              ├── Global rate limit (10,000 req/s total)      │
│              ├── Per-IP rate limit (100 req/min)              │
│              ├── Per-API-key rate limit (1,000 req/min)       │
│              ├── Per-endpoint rate limit                      │
│              │   ├── GET  /feed     → 60 req/min             │
│              │   ├── POST /posts    → 10 req/min             │
│              │   └── POST /upload   → 3 req/min              │
│              └── Per-user rate limit (tied to auth token)     │
│                                                              │
│  Common gateways: Kong, NGINX, AWS API Gateway, Envoy        │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tier Rate Limiting

Real systems often have multiple layers:

```
Tier 1: Edge / CDN
  └── Block known bad IPs, DDoS protection
      (Cloudflare, AWS Shield)

Tier 2: API Gateway
  └── Per-key rate limits, authentication
      (Kong, NGINX)

Tier 3: Application
  └── Per-user, per-resource limits
      (Custom middleware — the code we wrote above)

Tier 4: Database
  └── Connection pooling, query timeouts
      (pgBouncer, connection limits)
```

---

## Rate Limiting Strategies by Use Case

```
┌────────────────────────┬────────────────────────────────────┐
│  Scenario              │  Strategy                          │
├────────────────────────┼────────────────────────────────────┤
│  Public API            │  Per-API-key, token bucket         │
│                        │  Allow bursts, enforce avg rate    │
│                        │                                    │
│  Login endpoint        │  Per-IP, fixed window              │
│                        │  Strict limit (5/min) to prevent   │
│                        │  brute force                       │
│                        │                                    │
│  File upload           │  Per-user, leaky bucket            │
│                        │  Smooth out, prevent storage abuse │
│                        │                                    │
│  Internal service      │  Per-service, sliding window       │
│                        │  Protect downstream dependencies   │
│                        │                                    │
│  Free vs paid tier     │  Per-API-key with different limits │
│                        │  Free: 100/hr, Paid: 10,000/hr    │
│                        │                                    │
│  Webhook delivery      │  Per-endpoint, token bucket        │
│                        │  Don't overwhelm receiver          │
└────────────────────────┴────────────────────────────────────┘
```

---

## Common Mistakes

### 1. Rate Limiting Only by IP

Behind a corporate NAT, thousands of users share one IP. You'd rate limit
an entire company as if they were one client. Always prefer API key or
authenticated user ID when available. Fall back to IP for unauthenticated
endpoints.

### 2. Not Returning Rate Limit Headers

If clients can't see their remaining quota, they can't self-regulate. They'll
just retry blindly and make things worse. Always return `X-RateLimit-*`
headers on every response, not just 429s.

### 3. Fixed Window Without Awareness of the Boundary Problem

If you use fixed windows, understand that a client can send 2x the limit
by timing requests at the window boundary. Use sliding window counter
instead — it's barely more complex and much more accurate.

### 4. Forgetting to Rate Limit Internal Services

External rate limiting protects against bad actors. Internal rate limiting
protects against cascading failures. Service A calling Service B 100,000
times per second because of a bug can take down your entire platform.

### 5. Hard-Coding Limits

Rate limits should be configurable per client, per tier, per endpoint. Store
them in a config system (not hardcoded constants) so you can adjust without
redeploying.

---

## Summary

```
┌─────────────────────────────────────────────────────────┐
│               RATE LIMITING CHEAT SHEET                  │
│                                                          │
│  Algorithm to use:                                       │
│    Most cases → Token Bucket (simple, allows bursts)     │
│    Need accuracy → Sliding Window Counter                │
│    Need smoothing → Leaky Bucket                         │
│                                                          │
│  Where to put it:                                        │
│    API Gateway for global/per-key limits                 │
│    Application for per-user/per-resource limits          │
│    Redis for distributed coordination                    │
│                                                          │
│  Always:                                                 │
│    Return rate limit headers on EVERY response           │
│    Use Lua scripts for atomic Redis operations           │
│    Implement exponential backoff + jitter in clients     │
│    Configure limits per tier (free/paid/enterprise)      │
│                                                          │
│  Never:                                                  │
│    Hard-code limits in application code                  │
│    Rate limit only by IP address                         │
│    Return 429 without Retry-After header                 │
│    Forget to rate limit internal service calls           │
└─────────────────────────────────────────────────────────┘
```
