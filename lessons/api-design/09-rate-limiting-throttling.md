# Lesson 09: Rate Limiting & Throttling

## The Nightclub Bouncer Analogy

A nightclub has a maximum capacity. The bouncer counts people entering:
too many, and you wait in line. Rate limiting is the same concept for APIs --
it caps how many requests a client can make in a time window.

```
  Without rate limiting:
  Client --> [req][req][req][req][req][req][req] --> Server CRASHES

  With rate limiting:
  Client --> [req][req][req][WAIT][req][req][WAIT] --> Server HEALTHY

  Response headers:
  X-RateLimit-Limit: 100        (max requests per window)
  X-RateLimit-Remaining: 23     (requests left)
  X-RateLimit-Reset: 1709312400 (when window resets, unix epoch)

  When exceeded:
  HTTP 429 Too Many Requests
  Retry-After: 30
```

## Token Bucket Algorithm

The most common algorithm. Imagine a bucket that fills with tokens at a
steady rate. Each request costs one token. If the bucket is empty, you wait.

```
  Bucket: capacity=5, refill=1/second

  Time 0:  [*][*][*][*][*]   5 tokens (full)
  Request: [*][*][*][*][ ]   4 tokens (used 1)
  Request: [*][*][*][ ][ ]   3 tokens
  Request: [*][*][ ][ ][ ]   2 tokens
  Time +1: [*][*][*][ ][ ]   3 tokens (refilled 1)
  Request: [*][*][ ][ ][ ]   2 tokens
  Request: [*][ ][ ][ ][ ]   1 token
  Request: [ ][ ][ ][ ][ ]   0 tokens
  Request: REJECTED (429)     bucket empty!
  Time +1: [*][ ][ ][ ][ ]   1 token (refilled)
  Request: [ ][ ][ ][ ][ ]   0 tokens (just made it)
```

**Pros:** Allows bursts up to bucket capacity. Smooth.
**Cons:** Slightly more complex to implement.

## Sliding Window Algorithm

Instead of fixed time windows, you look at a rolling window of time.

```
  Fixed window problem:
  |---- Window 1 ----|---- Window 2 ----|
  |                99|100               |  <-- 199 requests in 1 second
  |     limit: 100   |    limit: 100    |      at the boundary!

  Sliding window fix:
       |<---- 60 seconds ---->|
  .....[====================]          count requests in THIS window
          (slides forward)
```

### TypeScript - Sliding Window Rate Limiter

```typescript
class SlidingWindowRateLimiter {
  private windows: Map<string, { count: number; timestamp: number }[]> = new Map();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    const entries = this.windows.get(key) ?? [];
    const valid = entries.filter((e) => e.timestamp > cutoff);

    const count = valid.reduce((sum, e) => sum + e.count, 0);

    if (count >= this.limit) {
      const oldestValid = valid[0]?.timestamp ?? now;
      const resetMs = oldestValid + this.windowMs - now;
      return { allowed: false, remaining: 0, resetMs };
    }

    valid.push({ count: 1, timestamp: now });
    this.windows.set(key, valid);

    return {
      allowed: true,
      remaining: this.limit - count - 1,
      resetMs: this.windowMs,
    };
  }
}

const limiter = new SlidingWindowRateLimiter(5, 10_000);

const server = Bun.serve({
  port: 8080,
  fetch(req) {
    const clientIP = "127.0.0.1";
    const result = limiter.isAllowed(clientIP);

    const headers = new Headers({
      "Content-Type": "application/json",
      "X-RateLimit-Limit": "5",
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
    });

    if (!result.allowed) {
      headers.set("Retry-After", String(Math.ceil(result.resetMs / 1000)));
      return new Response(
        JSON.stringify({ error: "rate limit exceeded" }),
        { status: 429, headers }
      );
    }

    return new Response(
      JSON.stringify({ message: "ok", remaining: result.remaining }),
      { status: 200, headers }
    );
  },
});

console.log(`Server on :${server.port} (5 requests per 10s)`);
```

## Go - Token Bucket Rate Limiter

```go
package main

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sync"
	"time"
)

type TokenBucket struct {
	mu         sync.Mutex
	tokens     float64
	capacity   float64
	refillRate float64
	lastRefill time.Time
}

func NewTokenBucket(capacity, refillPerSecond float64) *TokenBucket {
	return &TokenBucket{
		tokens:     capacity,
		capacity:   capacity,
		refillRate: refillPerSecond,
		lastRefill: time.Now(),
	}
}

func (b *TokenBucket) Allow() (bool, float64) {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens = math.Min(b.capacity, b.tokens+elapsed*b.refillRate)
	b.lastRefill = now

	if b.tokens < 1 {
		return false, b.tokens
	}

	b.tokens--
	return true, b.tokens
}

type RateLimiterStore struct {
	mu       sync.Mutex
	buckets  map[string]*TokenBucket
	capacity float64
	rate     float64
}

func NewRateLimiterStore(capacity, ratePerSecond float64) *RateLimiterStore {
	return &RateLimiterStore{
		buckets:  make(map[string]*TokenBucket),
		capacity: capacity,
		rate:     ratePerSecond,
	}
}

func (s *RateLimiterStore) GetBucket(key string) *TokenBucket {
	s.mu.Lock()
	defer s.mu.Unlock()

	bucket, ok := s.buckets[key]
	if !ok {
		bucket = NewTokenBucket(s.capacity, s.rate)
		s.buckets[key] = bucket
	}
	return bucket
}

func main() {
	store := NewRateLimiterStore(5, 0.5)

	http.HandleFunc("GET /api/data", func(w http.ResponseWriter, r *http.Request) {
		clientIP := r.RemoteAddr
		bucket := store.GetBucket(clientIP)
		allowed, remaining := bucket.Allow()

		w.Header().Set("X-RateLimit-Limit", "5")
		w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%.0f", remaining))
		w.Header().Set("Content-Type", "application/json")

		if !allowed {
			w.Header().Set("Retry-After", "2")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{"error": "rate limit exceeded"})
			return
		}

		json.NewEncoder(w).Encode(map[string]any{
			"message":   "ok",
			"remaining": remaining,
		})
	})

	fmt.Println("Server on :8080 (5 tokens, 0.5/sec refill)")
	http.ListenAndServe(":8080", nil)
}
```

## Distributed Rate Limiting

Single-server rate limiting breaks when you have multiple servers.
You need a shared store.

```
  WITHOUT shared store:
  +--------+     +----------+
  | Client |---->| Server A |  5 requests allowed
  |        |---->| Server B |  5 requests allowed
  +--------+     +----------+  = 10 total (limit is 5!)

  WITH Redis:
  +--------+     +----------+     +-------+
  | Client |---->| Server A |---->|       |
  |        |---->| Server B |---->| Redis |  single counter
  +--------+     +----------+     +-------+  5 total, enforced
```

```
  Redis commands for sliding window:

  MULTI
    ZREMRANGEBYSCORE rate:{client_id} 0 {window_start}
    ZADD rate:{client_id} {now} {request_id}
    ZCARD rate:{client_id}
    EXPIRE rate:{client_id} {window_seconds}
  EXEC
```

## Rate Limiting Strategies

```
  +-------------------+--------------------------------------------+
  | Strategy          | Description                                |
  +-------------------+--------------------------------------------+
  | Per IP            | Simple, but shared IPs cause problems      |
  | Per API key       | Most common for authenticated APIs         |
  | Per user          | Fair, but requires authentication          |
  | Per endpoint      | Different limits for different operations  |
  | Tiered            | Free: 100/hr, Pro: 10000/hr                |
  +-------------------+--------------------------------------------+

  Example tiered setup:
  +--------+----------+----------+----------+
  | Tier   | Requests | Window   | Burst    |
  +--------+----------+----------+----------+
  | Free   | 100      | 1 hour   | 10/min   |
  | Basic  | 1,000    | 1 hour   | 50/min   |
  | Pro    | 10,000   | 1 hour   | 200/min  |
  +--------+----------+----------+----------+
```

## Exercises

1. **Run both servers.** Hit the endpoint rapidly and observe the 429 responses
   and rate limit headers.

2. **Burst test.** With the token bucket (capacity=5, refill=0.5/sec), send
   10 requests instantly. How many succeed? How long before you can send again?

3. **Design rate limits** for a social media API. Different limits for:
   reading posts, creating posts, sending DMs, uploading images.

4. **Implement per-endpoint limiting.** Give `GET /users` 100 req/min
   and `POST /users` 10 req/min.

---

[Next: Lesson 10 - API Gateways ->](10-api-gateways.md)
