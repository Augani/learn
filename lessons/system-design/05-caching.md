# Caching

Caching is like keeping frequently used tools on your desk instead of walking
to the storage room every time you need them. The wrench you use 10 times a
day lives on your desk. The specialized drill bit you use once a year stays
in the storage room.

The magic of caching comes from two observations about real-world access
patterns:

1. **Temporal locality:** If you accessed something recently, you'll probably
   access it again soon. (You just looked up that API documentation? You'll
   look at it again in 5 minutes.)

2. **The Pareto principle:** 20% of your data serves 80% of your requests.
   A small number of "hot" items get most of the traffic.

Combined, this means you can serve the vast majority of requests from a small,
fast store instead of hitting your slow, large database every time.

---

## Why Caching Works — The Math

```
Without cache:
  10,000 QPS × 10ms per DB query = 100 seconds of DB work per second
  Your database is doing 100 seconds of work every second.
  That's impossible. You need 100+ database servers.

With 95% cache hit rate:
  10,000 QPS × 95% cache hit = 9,500 from cache (0.5ms each)
  10,000 QPS × 5% cache miss = 500 from database (10ms each)

  Cache: 9,500 × 0.5ms = 4.75 seconds of work per second ← easy for Redis
  DB:    500 × 10ms = 5 seconds of work per second ← 1 database handles this

You went from needing 100 database servers to needing 1.
```

That's not a small optimization. That's the difference between a $100,000/month
infrastructure bill and a $1,000/month bill.

---

## Cache Levels — The Hierarchy

Caching happens at every level of the stack. Each level is faster but smaller.

```
┌──────────────────────────────────────────────┐
│           Browser Cache                      │ ← Fastest
│   Images, CSS, JS, API responses             │    0ms (local disk)
│   Controlled by Cache-Control headers        │
├──────────────────────────────────────────────┤
│           CDN Cache                          │
│   Static assets, cacheable API responses     │    1-20ms (edge server)
│   Cloudflare, CloudFront, Fastly             │
├──────────────────────────────────────────────┤
│           API Gateway Cache                  │
│   Full response caching for common routes    │    1-5ms
│   Nginx proxy_cache, Varnish                 │
├──────────────────────────────────────────────┤
│           Application Cache                  │
│   Redis, Memcached                           │    0.5-2ms
│   Business objects, computed results         │
├──────────────────────────────────────────────┤
│       In-Process Cache (Local Memory)        │
│   Go: sync.Map, groupcache                   │    ~100ns
│   Node: node-cache, LRU-cache               │
│   Hot config, frequently-used lookups        │
├──────────────────────────────────────────────┤
│           Database Cache                     │
│   Query cache, buffer pool (InnoDB)          │    1-5ms (warm DB)
│   PostgreSQL shared_buffers                  │
├──────────────────────────────────────────────┤
│           OS / Filesystem Cache              │ ← Slowest cache
│   Page cache (Linux VFS)                     │    (still faster
│   Automatically caches disk reads in RAM     │     than disk)
└──────────────────────────────────────────────┘
```

### Which Level to Cache At?

| Level | Best For | Capacity | Latency | Invalidation |
|---|---|---|---|---|
| Browser | Static assets, user-specific data | Small | 0ms | Hard (user's browser) |
| CDN | Static assets, public API responses | Large | 1-20ms | Medium (purge API) |
| API Gateway | Identical responses for same URL | Medium | 1-5ms | Easy (TTL / purge) |
| Application (Redis) | Business objects, computed data | Medium | 0.5-2ms | You control it |
| In-Process | Ultra-hot data, config, lookups | Tiny | ~100ns | Easy (same process) |
| Database | Recently queried data | Medium | 1-5ms | Automatic (built-in) |

---

## Caching Strategies

There are four main patterns for how your application interacts with the cache.
Each has different consistency and performance characteristics.

### Cache-Aside (Lazy Loading)

The application manages the cache explicitly. It checks the cache first, and on
a miss, fetches from the database and stores the result in the cache.

```
READ PATH:
                     ┌─────────┐
                     │  Cache   │
                ┌───▶│ (Redis)  │───┐
                │    └─────────┘   │
  ┌─────────┐  │                   │  Cache Hit → return
  │   App   │──┤                   ├──────────────────▶
  │         │  │                   │
  └─────────┘  │    ┌─────────┐   │  Cache Miss ↓
                └───▶│Database │───┘
                     │         │
                     └─────────┘
                           │
                    Write to cache
                    for next time
```

**In Go:**

```go
func GetProduct(ctx context.Context, cache *redis.Client, db *pgxpool.Pool, productID string) (*Product, error) {
    cacheKey := "product:" + productID

    cached, err := cache.Get(ctx, cacheKey).Bytes()
    if err == nil {
        var product Product
        if err := json.Unmarshal(cached, &product); err == nil {
            return &product, nil
        }
    }

    var product Product
    err = db.QueryRow(ctx,
        "SELECT id, name, price, description FROM products WHERE id = $1",
        productID,
    ).Scan(&product.ID, &product.Name, &product.Price, &product.Description)
    if err != nil {
        return nil, fmt.Errorf("query product %s: %w", productID, err)
    }

    data, _ := json.Marshal(product)
    cache.Set(ctx, cacheKey, data, 10*time.Minute)

    return &product, nil
}
```

**In TypeScript:**

```typescript
async function getProduct(productId: string): Promise<Product> {
    const cacheKey = `product:${productId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached) as Product;
    }

    const result = await pool.query(
        'SELECT id, name, price, description FROM products WHERE id = $1',
        [productId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError(`Product ${productId} not found`);
    }

    const product = result.rows[0] as Product;
    await redis.setex(cacheKey, 600, JSON.stringify(product));

    return product;
}
```

**Pros:** Only caches data that's actually requested (no wasted memory). Simple
to implement. Cache failure is not fatal — just hit the database.

**Cons:** Cache miss = slow (database round trip + cache write). First request
for any item is always slow. Stale data if the database is updated without
invalidating the cache.

### Write-Through

Every write goes to both the cache AND the database. The cache is always
up-to-date.

```
WRITE PATH:
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │   App   │────▶│  Cache   │────▶│Database │
  │         │     │ (Redis)  │     │         │
  └─────────┘     └─────────┘     └─────────┘

  Write to cache FIRST, then cache writes to database.
  (or write to both simultaneously)

READ PATH:
  ┌─────────┐     ┌─────────┐
  │   App   │────▶│  Cache   │──── always a hit (if written before)
  │         │     │ (Redis)  │
  └─────────┘     └─────────┘
```

**Pros:** Cache is always consistent with the database. Reads are always fast
(cache is pre-warmed).

**Cons:** Write latency is higher (must write to two places). Caches data that
might never be read (wasted memory). More complex write logic.

### Write-Behind (Write-Back)

Writes go to the cache immediately, then the cache asynchronously flushes to
the database in the background.

```
WRITE PATH:
  ┌─────────┐     ┌─────────┐
  │   App   │────▶│  Cache   │     ← immediate, fast
  │         │     │ (Redis)  │
  └─────────┘     └────┬─────┘
                       │
                  (async, batched)
                       │
                  ┌────┴─────┐
                  │ Database │     ← eventually consistent
                  └──────────┘
```

**Pros:** Extremely fast writes (just write to memory). Batch database writes
for efficiency. Absorbs write spikes.

**Cons:** Data loss risk if cache crashes before flushing. Complex
implementation. Eventual consistency between cache and database.

**Use when:** Write-heavy workloads where losing a few seconds of writes is
acceptable (analytics, view counts, activity logs).

### Read-Through

Similar to cache-aside, but the cache itself is responsible for loading data
from the database on a miss. The application only talks to the cache.

```
READ PATH:
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │   App   │────▶│  Cache   │────▶│Database │
  │         │     │ (smart)  │     │         │
  └─────────┘     └─────────┘     └─────────┘

  App asks cache for data.
  Cache checks itself.
  If miss, cache loads from DB, stores it, returns it.
  App never touches DB directly.
```

**Pros:** Clean separation — application doesn't know about the database.
Cache handles all data loading logic.

**Cons:** Cache must understand how to query the database (coupling). Not all
caching systems support this natively.

### Strategy Comparison

| Strategy | Read Perf | Write Perf | Consistency | Complexity | Risk |
|---|---|---|---|---|---|
| Cache-Aside | Miss = slow | N/A | Stale until TTL | Low | Low |
| Write-Through | Always fast | Slower | Strong | Medium | Low |
| Write-Behind | Always fast | Very fast | Eventual | High | Data loss |
| Read-Through | Miss = slow | N/A | Stale until TTL | Medium | Low |

**For most web applications:** Start with cache-aside. It's the simplest, most
flexible, and most forgiving. Move to write-through or write-behind only when
you have specific performance needs.

---

## Cache Invalidation — The Hard Problem

There are only two hard things in Computer Science: cache invalidation, naming
things, and off-by-one errors.

When the underlying data changes, your cache becomes stale. How do you fix it?

### Strategy 1: TTL (Time to Live)

Every cached item has an expiration time. After that time, the cache entry is
automatically deleted and the next read triggers a fresh load.

```
SET product:123 "{...}" EX 300    ← expires in 5 minutes

Timeline:
  t=0:    Cache SET (fresh data)
  t=0-5m: Cache HIT (increasingly stale)
  t=5m:   Cache expires
  t=5m+1: Cache MISS → reload from DB → fresh data
```

**Pros:** Dead simple. No coordination needed. Stale data is bounded by TTL.

**Cons:** Data can be stale up to the full TTL duration. Short TTL = more cache
misses. Long TTL = more staleness.

**Choosing TTL values:**

| Data Type | Suggested TTL | Why |
|---|---|---|
| User profile | 5-15 minutes | Changes rarely |
| Product info | 1-5 minutes | Prices/stock can change |
| Feed/timeline | 30-60 seconds | Should feel fresh |
| Config/settings | 1-5 minutes | Doesn't change often |
| Session data | 30 minutes | Security considerations |
| Search results | 1-5 minutes | Varies by freshness needs |

### Strategy 2: Event-Based Invalidation

When data changes, explicitly delete or update the cache.

```
UPDATE product SET price = 29.99 WHERE id = 123;
DELETE FROM cache WHERE key = 'product:123';

   ┌──────────┐    update    ┌──────────┐
   │   App    │─────────────▶│ Database │
   │          │              └──────────┘
   │          │    delete    ┌──────────┐
   │          │─────────────▶│  Cache   │
   └──────────┘              └──────────┘
```

**In Go:**

```go
func UpdateProductPrice(ctx context.Context, cache *redis.Client, db *pgxpool.Pool, productID string, newPrice float64) error {
    _, err := db.Exec(ctx,
        "UPDATE products SET price = $1 WHERE id = $2",
        newPrice, productID,
    )
    if err != nil {
        return fmt.Errorf("update product: %w", err)
    }

    cache.Del(ctx, "product:"+productID)

    return nil
}
```

**Pros:** Immediate consistency. No stale data.

**Cons:** Must track every place that updates data and add cache invalidation.
If you miss one update path, you get stale data. Race conditions between
write and invalidation.

### Strategy 3: Versioned Keys

Include a version number in the cache key. When data changes, increment the
version. Old cache entries become unreachable (and expire via TTL).

```
Version 1: cache key = "product:123:v1" → old data
Version 2: cache key = "product:123:v2" → new data

App always reads current version from a version counter.
Old entries expire naturally via TTL.
```

**Pros:** No explicit invalidation needed. Clean and simple.

**Cons:** Requires a version counter (often stored in Redis itself). Old
entries waste memory until TTL expires.

---

## Cache Stampede / Thundering Herd

The scariest cache problem. Here's the scenario:

```
1. Popular item's cache entry expires
2. 10,000 requests arrive simultaneously
3. ALL of them see cache miss
4. ALL of them query the database
5. Database collapses under 10,000 identical queries
6. Everything is on fire

    Cache expires
         │
         ▼
  ┌──────────────┐     10,000 simultaneous
  │              │     queries
  │    Cache     │────────────────────────┐
  │   (empty)    │                        │
  └──────────────┘                        ▼
                                   ┌──────────┐
                                   │ Database │ ← melts
                                   └──────────┘
```

### Solutions

**1. Mutex / Single-Flight**

Only one request queries the database. Others wait for the result.

```go
import "golang.org/x/sync/singleflight"

var group singleflight.Group

func GetProductCached(ctx context.Context, cache *redis.Client, db *pgxpool.Pool, productID string) (*Product, error) {
    cacheKey := "product:" + productID

    cached, err := cache.Get(ctx, cacheKey).Bytes()
    if err == nil {
        var product Product
        json.Unmarshal(cached, &product)
        return &product, nil
    }

    result, err, _ := group.Do(cacheKey, func() (interface{}, error) {
        var product Product
        err := db.QueryRow(ctx,
            "SELECT id, name, price, description FROM products WHERE id = $1",
            productID,
        ).Scan(&product.ID, &product.Name, &product.Price, &product.Description)
        if err != nil {
            return nil, err
        }

        data, _ := json.Marshal(product)
        cache.Set(ctx, cacheKey, data, 10*time.Minute)

        return &product, nil
    })

    if err != nil {
        return nil, err
    }

    product := result.(*Product)
    return product, nil
}
```

The `singleflight` package in Go is purpose-built for this. 10,000 requests for
the same key → only 1 database query → all 10,000 get the result.

**In TypeScript:**

```typescript
const inFlight = new Map<string, Promise<Product>>();

async function getProductCached(productId: string): Promise<Product> {
    const cacheKey = `product:${productId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    const existing = inFlight.get(cacheKey);
    if (existing) {
        return existing;
    }

    const promise = loadAndCache(cacheKey, productId);
    inFlight.set(cacheKey, promise);

    try {
        return await promise;
    } finally {
        inFlight.delete(cacheKey);
    }
}

async function loadAndCache(cacheKey: string, productId: string): Promise<Product> {
    const result = await pool.query(
        'SELECT id, name, price, description FROM products WHERE id = $1',
        [productId]
    );
    const product = result.rows[0] as Product;
    await redis.setex(cacheKey, 600, JSON.stringify(product));
    return product;
}
```

**2. Staggered TTL**

Add random jitter to TTL so not all entries expire at the same time.

```go
baseTTL := 10 * time.Minute
jitter := time.Duration(rand.Intn(60)) * time.Second
cache.Set(ctx, key, data, baseTTL+jitter)
```

**3. Background Refresh**

Refresh cache entries before they expire. A background goroutine/worker
periodically refreshes hot keys.

```
TTL = 10 minutes
Refresh at 8 minutes (before expiration)

Timeline:
  t=0:    Cache SET
  t=8m:   Background worker refreshes (cache never goes empty)
  t=16m:  Background worker refreshes again
  ...     Cache NEVER expires for hot keys
```

---

## Eviction Policies

When the cache is full and a new item needs to be stored, which old item gets
evicted?

### LRU (Least Recently Used)

Evict the item that hasn't been accessed for the longest time.

```
Cache capacity: 3

Access A → [A]
Access B → [B, A]
Access C → [C, B, A]       ← cache full
Access D → [D, C, B]       ← A evicted (least recently used)
Access B → [B, D, C]       ← B moves to front (recently used)
Access E → [E, B, D]       ← C evicted
```

**Best for:** General-purpose caching. Most workloads benefit from LRU. Redis
uses approximate LRU by default.

### LFU (Least Frequently Used)

Evict the item that has been accessed the fewest times.

```
Cache capacity: 3

Access A (count: 1)
Access A (count: 2)
Access B (count: 1)
Access C (count: 1)         ← cache full
Access D                    ← evict B or C (count: 1, least frequent)
```

**Best for:** Workloads where some items are consistently popular (product
catalog, configuration). Prevents a one-time scan from evicting popular items.

**Watch out for:** LFU has a "frequency accumulation" problem — an item that
was popular yesterday but isn't today stays in cache because it has high
historical frequency. Some implementations use time-windowed frequency to
mitigate this.

### FIFO (First In, First Out)

Evict the oldest item, regardless of access pattern.

```
Cache capacity: 3

Insert A → [A]
Insert B → [A, B]
Insert C → [A, B, C]       ← cache full
Insert D → [B, C, D]       ← A evicted (first in)
```

**Best for:** Time-series data where recency matters more than frequency.

### Comparison

| Policy | Hit Rate | Overhead | Best For |
|---|---|---|---|
| LRU | Good | Low | General purpose (default choice) |
| LFU | Better for skewed | Medium | Popular items dominate |
| FIFO | Lowest | Lowest | Time-series, simple cases |
| Random | Surprisingly decent | Lowest | When you don't care |

Redis supports: `volatile-lru`, `allkeys-lru`, `volatile-lfu`, `allkeys-lfu`,
`volatile-ttl`, `volatile-random`, `allkeys-random`, `noeviction`.

For most applications, use `allkeys-lru`. It's simple, effective, and well-understood.

---

## Redis Caching Patterns in Practice

### Pattern 1: Simple Key-Value Cache

```go
func cacheSet(ctx context.Context, rdb *redis.Client, key string, value interface{}, ttl time.Duration) error {
    data, err := json.Marshal(value)
    if err != nil {
        return fmt.Errorf("marshal cache value: %w", err)
    }
    return rdb.Set(ctx, key, data, ttl).Err()
}

func cacheGet[T any](ctx context.Context, rdb *redis.Client, key string) (*T, error) {
    data, err := rdb.Get(ctx, key).Bytes()
    if err != nil {
        return nil, err
    }
    var result T
    if err := json.Unmarshal(data, &result); err != nil {
        return nil, fmt.Errorf("unmarshal cache value: %w", err)
    }
    return &result, nil
}
```

### Pattern 2: Cache with Graceful Degradation

```go
func GetUserWithFallback(ctx context.Context, cache *redis.Client, db *pgxpool.Pool, userID string) (*User, error) {
    user, err := cacheGet[User](ctx, cache, "user:"+userID)
    if err == nil {
        return user, nil
    }

    user, err = fetchUserFromDB(ctx, db, userID)
    if err != nil {
        return nil, err
    }

    go func() {
        bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
        defer cancel()
        cacheSet(bgCtx, cache, "user:"+userID, user, 10*time.Minute)
    }()

    return user, nil
}
```

Notice the `go func()` for the cache write — the user doesn't wait for the
cache to be populated. If Redis is slow or down, the user still gets their
response.

### Pattern 3: Batch Cache Check (TypeScript)

```typescript
async function getUsers(userIds: string[]): Promise<Map<string, User>> {
    const cacheKeys = userIds.map(id => `user:${id}`);
    const cached = await redis.mget(...cacheKeys);

    const result = new Map<string, User>();
    const missingIds: string[] = [];

    cached.forEach((value, index) => {
        if (value) {
            result.set(userIds[index], JSON.parse(value));
        } else {
            missingIds.push(userIds[index]);
        }
    });

    if (missingIds.length > 0) {
        const dbUsers = await pool.query(
            `SELECT id, name, email FROM users WHERE id = ANY($1)`,
            [missingIds]
        );

        const pipeline = redis.pipeline();
        for (const row of dbUsers.rows) {
            result.set(row.id, row as User);
            pipeline.setex(`user:${row.id}`, 600, JSON.stringify(row));
        }
        await pipeline.exec();
    }

    return result;
}
```

Use `MGET` for batch reads and `pipeline` for batch writes. This dramatically
reduces the number of round trips to Redis.

### Pattern 4: Counter Cache

For things like view counts or like counts, use Redis atomic increments
instead of hitting the database.

```go
func IncrementViewCount(ctx context.Context, cache *redis.Client, postID string) (int64, error) {
    count, err := cache.Incr(ctx, "views:"+postID).Result()
    if err != nil {
        return 0, err
    }

    if count%100 == 0 {
        go flushViewCountToDB(postID, count)
    }

    return count, nil
}
```

Flush to the database periodically (every 100 increments, or every minute) —
not on every view. This is a write-behind pattern for counters.

---

## Cache Sizing

### How Much Memory Do You Need?

```
Step 1: Estimate hot data size
  Total items: 1,000,000 products
  Hot items (20%): 200,000
  Avg item size: 2 KB (JSON)
  Raw data: 200,000 × 2 KB = 400 MB

Step 2: Add Redis overhead
  Per-key overhead: ~100 bytes (hash table entry, pointers)
  Overhead: 200,000 × 100 bytes = 20 MB
  Total: 400 MB + 20 MB = ~420 MB

Step 3: Add headroom
  Redis maxmemory should be ~70% utilized
  Required: 420 MB / 0.7 = 600 MB

Step 4: Add replication
  Primary + 1 replica: 600 MB × 2 = 1.2 GB

Conclusion: A single Redis node with 2 GB RAM is plenty.
```

---

## When NOT to Cache

Caching isn't always the answer:

| Scenario | Why Caching Doesn't Help |
|---|---|
| Every request is unique | Cache hit rate near 0% — wasted memory |
| Data changes every request | Cache invalidated immediately — no benefit |
| Strong consistency required | Stale cache is unacceptable |
| Write-heavy workload | More writes than reads → cache churn |
| Small dataset that fits in DB memory | Database buffer pool is already caching it |
| Low traffic | Database can easily handle the load without cache |

**The test:** Will the cache hit rate be > 50%? If not, caching probably isn't
worth the complexity.

---

## Exercises

### Exercise 1: Cache Hit Rate
Your API has 10,000 QPS. You add a Redis cache with 5-minute TTL. Your data
has 100,000 unique items, and the top 1,000 items get 90% of the traffic.
Estimate the cache hit rate and the remaining database QPS.

### Exercise 2: Design a Cache Layer
You're building a social media feed. Each feed load shows 20 posts. There are
10M DAU loading their feed 10 times per day. Design the caching strategy:
- What do you cache? (Individual posts? Entire feeds? Both?)
- What TTL?
- What invalidation strategy?
- How much Redis memory?

### Exercise 3: Implement Singleflight
Implement a singleflight-style cache loader in TypeScript that:
- Checks Redis first
- On miss, ensures only one database query runs per key
- All concurrent callers get the same result
- Handles errors without leaking promises

---

## Key Takeaways

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. Cache-aside with TTL is the default. Start there.       │
│                                                             │
│  2. Use singleflight / request coalescing to prevent        │
│     cache stampedes. This is non-negotiable.                │
│                                                             │
│  3. Cache invalidation is hard. TTL with short duration     │
│     is the simplest approach. Add event-based invalidation  │
│     only when staleness is unacceptable.                    │
│                                                             │
│  4. LRU is the right eviction policy for most cases.        │
│                                                             │
│  5. Monitor your cache hit rate. Below 80%, rethink your    │
│     caching strategy. Above 95%, you're doing great.        │
│                                                             │
│  6. Design for cache failure. Your app should work          │
│     (slower) without the cache. Cache is an optimization,   │
│     not a requirement.                                      │
│                                                             │
│  7. Batch your Redis operations (MGET, pipelines).          │
│     100 round trips to Redis is 100ms.                      │
│     1 MGET with 100 keys is 1ms.                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
