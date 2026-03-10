# Lesson 14: API Performance

> A fast API keeps users happy. A slow API loses them.
> Performance is a feature.

---

## The Performance Stack

```
  EVERY API RESPONSE PASSES THROUGH:

  Client
    |  DNS resolution (~50ms first time)
    |  TCP handshake (~1 RTT)
    |  TLS handshake (~1-2 RTT)
    v
  Load Balancer
    |  Routing (~<1ms)
    v
  API Server
    |  Parse request (~<1ms)
    |  Auth check (~1-10ms)
    |  Business logic (~varies)
    |  Database query (~1-100ms)
    |  Serialize response (~<1ms)
    v
  Response back through the chain

  TOTAL BUDGET EXAMPLE (target p99 < 200ms):
  +---------------------+----------+
  | Component           | Budget   |
  +---------------------+----------+
  | Network (one way)   | 50ms     |
  | Auth                | 10ms     |
  | Business logic      | 20ms     |
  | Database            | 50ms     |
  | Serialization       | 5ms      |
  | Network (return)    | 50ms     |
  +---------------------+----------+
  | Total               | 185ms    |
  +---------------------+----------+
```

---

## HTTP Caching

### Cache-Control Header

```
  CLIENT CACHING:
  Server sends: Cache-Control: max-age=3600
  Client caches response for 1 hour.
  Next request within 1 hour: served from local cache.
  ZERO network traffic!

  COMMON DIRECTIVES:
  +------------------------+--------------------------------------+
  | max-age=N              | Cache for N seconds                  |
  | no-cache               | Must revalidate with server first    |
  | no-store               | Never cache (sensitive data)         |
  | private                | Only client can cache (not CDN)      |
  | public                 | CDN and client can cache             |
  | stale-while-revalidate | Serve stale, refresh in background   |
  +------------------------+--------------------------------------+

  EXAMPLES:
  Static assets:     Cache-Control: public, max-age=31536000
  User profile:      Cache-Control: private, max-age=60
  API list endpoint: Cache-Control: public, max-age=30, stale-while-revalidate=60
  Login response:    Cache-Control: no-store
```

### ETags for Conditional Requests

```
  FIRST REQUEST:
  Client: GET /api/products/42
  Server: 200 OK
          ETag: "abc123"
          {name: "Widget", price: 9.99}

  SECOND REQUEST:
  Client: GET /api/products/42
          If-None-Match: "abc123"
  Server: 304 Not Modified (no body!)
          (product hasn't changed, save bandwidth)

  IF PRODUCT CHANGED:
  Client: GET /api/products/42
          If-None-Match: "abc123"
  Server: 200 OK
          ETag: "def456"
          {name: "Widget Pro", price: 14.99}

  BANDWIDTH SAVINGS:
  304 response: ~100 bytes
  Full response: ~10KB
  100x bandwidth reduction for unchanged resources!
```

```python
import hashlib
import json
from typing import Optional

class ETagCache:
    def __init__(self):
        self.cache = {}

    def generate_etag(self, data: dict) -> str:
        content = json.dumps(data, sort_keys=True).encode()
        return hashlib.md5(content).hexdigest()

    def handle_request(
        self,
        resource_id: str,
        if_none_match: Optional[str],
        fetch_fn,
    ) -> dict:
        data = fetch_fn(resource_id)
        if data is None:
            return {"status": 404, "body": None, "headers": {}}

        etag = self.generate_etag(data)

        if if_none_match == etag:
            return {"status": 304, "body": None, "headers": {"ETag": etag}}

        return {
            "status": 200,
            "body": data,
            "headers": {"ETag": etag, "Cache-Control": "max-age=60"},
        }
```

---

## Compression

```
  REQUEST:
  Accept-Encoding: gzip, br

  RESPONSE:
  Content-Encoding: gzip
  (body is gzip compressed)

  COMPRESSION RATIOS FOR JSON:
  +----------+-------------+-----------+
  | Method   | Ratio       | CPU Cost  |
  +----------+-------------+-----------+
  | gzip     | 70-80% less | Medium    |
  | brotli   | 75-85% less | Higher    |
  | zstd     | 75-85% less | Lower     |
  +----------+-------------+-----------+

  EXAMPLE:
  Uncompressed JSON: 50 KB
  gzip:              10 KB (80% reduction)
  brotli:             8 KB (84% reduction)

  WHEN TO COMPRESS:
  +-- Response > 1KB? YES -> compress
  +-- Already compressed (images, video)? NO -> skip
  +-- CPU constrained? -> lighter algorithm (zstd)
```

---

## Connection Pooling

```
  WITHOUT POOLING:
  Request 1: open conn -> query -> close conn  (50ms overhead)
  Request 2: open conn -> query -> close conn  (50ms overhead)
  Request 3: open conn -> query -> close conn  (50ms overhead)

  WITH POOLING:
  Request 1: get conn from pool -> query -> return to pool (1ms)
  Request 2: get conn from pool -> query -> return to pool (1ms)
  Request 3: get conn from pool -> query -> return to pool (1ms)

  POOL SIZING:
  Too few: requests wait for connections (queuing)
  Too many: database overwhelmed, more context switching

  RULE OF THUMB (for database connections):
  pool_size = (num_cores * 2) + effective_spindle_count
  For SSDs: pool_size = num_cores * 2

  Typical:
  +----------------------+----------+
  | Small app (1 server) | 10-20    |
  | Medium (4 servers)   | 5-10 each|
  | Large (100 servers)  | 2-5 each |
  +----------------------+----------+
  Total connections to DB should be < DB max_connections.
```

---

## HTTP/2 and HTTP/3

```
  HTTP/1.1:                       HTTP/2:
  One request per connection      Multiple requests per connection
  (or pipelining, rarely used)    (multiplexing)

  Connection 1: [req1] [resp1]   Connection 1: [req1][req2][req3]
  Connection 2: [req2] [resp2]                  [resp2][resp1][resp3]
  Connection 3: [req3] [resp3]   ONE connection handles ALL requests

  HTTP/1.1: 6 connections per     HTTP/2: 1 connection, unlimited
  domain (browser limit)          concurrent streams

  HTTP/2 FEATURES:
  +-- Multiplexing: multiple requests on one connection
  +-- Header compression (HPACK): repeated headers sent once
  +-- Server push: server sends resources before client asks
  +-- Stream priority: important requests first

  HTTP/3 (QUIC):
  +-- UDP-based (not TCP)
  +-- No head-of-line blocking (stream-level)
  +-- 0-RTT connection establishment
  +-- Better for mobile (connection migration)
```

---

## Pagination Strategies

```
  OFFSET PAGINATION:
  GET /items?page=5&per_page=20

  SQL: SELECT * FROM items LIMIT 20 OFFSET 80
  PROBLEM: OFFSET 1000000 scans 1M rows then discards them!
  O(N) performance where N = offset.

  CURSOR PAGINATION (keyset):
  GET /items?after=item_abc&limit=20

  SQL: SELECT * FROM items WHERE id > 'item_abc' LIMIT 20
  ALWAYS fast: uses index, scans only 20 rows.
  O(1) performance regardless of position!

  +-------------------+------------------+--------------------+
  |                   | Offset           | Cursor             |
  +-------------------+------------------+--------------------+
  | Jump to page 50   | Easy             | Not possible       |
  | Deep pagination    | SLOW (O(N))      | Fast (O(1))        |
  | Real-time data     | Duplicates/skips | Consistent         |
  | Implementation     | Simple           | Moderate           |
  +-------------------+------------------+--------------------+

  USE OFFSET: admin dashboards, small datasets
  USE CURSOR: feeds, infinite scroll, large datasets
```

---

## Database Query Optimization

```
  N+1 QUERY PROBLEM:

  BAD:
  GET /orders  (fetches 100 orders)
  Then for EACH order: GET user for that order
  Result: 1 + 100 = 101 database queries!

  GOOD:
  GET /orders with JOIN or IN clause
  SELECT o.*, u.name FROM orders o
  JOIN users u ON o.user_id = u.id
  Result: 1 database query.

  RESPONSE FIELD SELECTION:
  GET /users?fields=id,name,email

  Instead of selecting ALL columns:
  SELECT * FROM users (returns 20 columns)

  Select only needed:
  SELECT id, name, email FROM users (returns 3 columns)

  Less data transferred, less serialization work.
```

---

## API Response Time Optimization Checklist

```
  QUICK WINS (< 1 day each):
  [ ] Add Cache-Control headers to GET endpoints
  [ ] Enable gzip/brotli compression
  [ ] Add database indexes for common queries
  [ ] Use cursor pagination instead of offset
  [ ] Add field selection (sparse fieldsets)
  [ ] Set connection pool sizes appropriately

  MEDIUM EFFORT (1-3 days):
  [ ] Implement ETags for conditional requests
  [ ] Move to HTTP/2
  [ ] Add Redis caching for hot data
  [ ] Fix N+1 queries with JOINs or DataLoader
  [ ] Add request coalescing (batch similar requests)

  LARGER EFFORT (1+ weeks):
  [ ] Add CDN for static and semi-static responses
  [ ] Implement async processing (return 202, process later)
  [ ] Denormalize hot read paths
  [ ] Add read replicas for database
  [ ] Profile and optimize serialization (use MessagePack/Protobuf)
```

---

## Measuring Performance

```
  METRICS TO TRACK:

  +-------------------+--------------------------------------+
  | p50 (median)      | "Normal" response time               |
  | p95               | 95% of requests are faster than this |
  | p99               | The "long tail" — worst 1%           |
  | p99.9             | The truly worst case                 |
  +-------------------+--------------------------------------+

  WHY P99 MATTERS:
  If you have 100 API calls per page load:
  P(at least one call > p99) = 1 - 0.99^100 = 63%!

  63% of page loads will experience your worst-case latency.

  TARGETS:
  +-------------------+------------------+
  | Tier              | p99 Target       |
  +-------------------+------------------+
  | Internal API      | < 100ms          |
  | User-facing API   | < 200ms          |
  | Search/Feed       | < 500ms          |
  | Report generation | < 5s             |
  +-------------------+------------------+
```

---

## Exercises

### Exercise 1: Add Caching Headers

Take an existing API and add appropriate Cache-Control
headers to each endpoint. Consider:
- Which endpoints can be cached publicly?
- Which are private (user-specific)?
- Which should never be cached?
- What TTL is appropriate for each?

### Exercise 2: Implement ETag Support

Add ETag generation and conditional request handling:
1. Generate ETags from response content hash
2. Check If-None-Match header
3. Return 304 when content hasn't changed
4. Measure bandwidth savings over 1000 requests

### Exercise 3: Pagination Benchmark

Compare offset vs cursor pagination:
1. Create a table with 1M rows
2. Paginate to page 1, 100, 1000, 10000
3. Measure query time for each
4. Plot the results

### Exercise 4: Performance Audit

Audit an API for performance issues:
1. Identify N+1 queries
2. Find missing indexes
3. Check for missing compression
4. Measure p50, p95, p99 under load
5. Propose and implement fixes, re-measure

---

## Key Takeaways

```
  1. Cache-Control headers eliminate unnecessary requests
  2. ETags save bandwidth with conditional requests (304)
  3. gzip/brotli reduce response size by 70-85%
  4. Connection pooling eliminates per-request overhead
  5. HTTP/2 multiplexing: one connection, many requests
  6. Cursor pagination is O(1), offset is O(N)
  7. Fix N+1 queries with JOINs or DataLoader
  8. Track p99, not just average response time
  9. Field selection reduces unnecessary data transfer
  10. Profile before optimizing — measure, don't guess
```

---

Next: [Lesson 15 — Webhooks & Events](./15-webhooks-events.md)
