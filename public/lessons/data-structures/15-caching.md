# Lesson 15: Caching Strategies — LRU, LFU, TTL

## What Is Caching?

Caching keeps **frequently used data in fast storage** so you don't have to fetch it from slow storage every time.

### The Kitchen Counter Analogy

Your kitchen has two storage areas:
- **Counter** (cache): small, easy to reach, holds your most-used ingredients
- **Pantry** (main storage): large, requires walking to, holds everything

```
Counter (cache):            Pantry (main storage):
┌────────────────────┐      ┌──────────────────────────┐
│ Salt  Pepper  Oil  │      │ Flour  Sugar  Vinegar    │
│ Garlic             │      │ Soy Sauce  Honey         │
└────────────────────┘      │ Baking Soda  Vanilla     │
     Quick access!          │ Cumin  Paprika  ...      │
                            └──────────────────────────┘
                                 Slower access

When you need salt: grab from counter (cache hit) → instant
When you need vanilla: walk to pantry (cache miss) → slower
After using vanilla often: move it to counter (cache update)
Counter full? Remove least-used item back to pantry (eviction)
```

## Cache Hit vs Cache Miss

```
Request for data:

  ┌──────────┐     cache hit (fast)      ┌───────┐
  │  Client  │ ───────────────────────→  │ Cache │ → return data
  └──────────┘                           └───────┘

  ┌──────────┐     cache miss            ┌───────┐     ┌──────────┐
  │  Client  │ ──→ not in cache ──→      │ Cache │ ──→ │ Database │
  └──────────┘                           └───┬───┘     └────┬─────┘
                                             │              │
                                             │←── fetch ────┘
                                             │    data
                                             ↓
                                    Store in cache for next time
```

**Cache hit ratio** = hits / (hits + misses). A good cache has >90% hit ratio.

## Eviction Policies

When the cache is full and a new item needs to go in, which existing item do you remove?

### LRU: Least Recently Used

Evict the item that hasn't been **used** the longest. The assumption: if you haven't used something recently, you probably won't need it soon.

```
Cache capacity: 3

Access A → cache: [A]               (miss, add A)
Access B → cache: [A, B]            (miss, add B)
Access C → cache: [A, B, C]         (miss, add C, full)
Access B → cache: [A, C, B]         (hit, move B to most-recent)
Access D → cache: [C, B, D]         (miss, evict A (least recent), add D)
Access A → cache: [B, D, A]         (miss, evict C (least recent), add A)
Access C → cache: [D, A, C]         (miss, evict B (least recent), add C)
Access B → cache: [A, C, B]         (miss, evict D (least recent), add B)

              Least                Most
              Recent              Recent
              ←─────────────────→
              Evict               Keep
              this                this
```

**LRU is the most common eviction policy.** Used by:
- CPU caches (hardware-level)
- Operating system page replacement
- Web browser cache
- Database buffer pools
- CDN edge caches
- Redis (approximated LRU)

### LFU: Least Frequently Used

Evict the item used the **fewest total times**. The assumption: items used often in the past are important.

```
Cache capacity: 3

Access A → cache: {A:1}                    (miss)
Access B → cache: {A:1, B:1}              (miss)
Access A → cache: {A:2, B:1}              (hit, A count = 2)
Access C → cache: {A:2, B:1, C:1}         (miss, full)
Access D → cache: {A:2, C:1, D:1}         (miss, evict B (count=1, tied with C, evict older))

A stays because it's been accessed twice.
```

**Problem**: LFU can keep stale items. An item accessed 1000 times yesterday but never today will stay while fresh items get evicted.

### TTL: Time To Live

Each item has an **expiration time**. After that time passes, the item is considered stale and evicted (or refreshed).

```
Set "user:123" with TTL = 60 seconds

  t=0s:   Insert. Expires at t=60s.
  t=30s:  Access → cache hit. Still valid.
  t=59s:  Access → cache hit. Still valid.
  t=61s:  Access → expired! Cache miss. Fetch fresh data.
```

TTL is essential for data that **changes over time** (user sessions, API responses, stock prices). Used by DNS, HTTP caching, CDN, session stores.

### FIFO: First In, First Out

Evict the oldest item, regardless of access pattern. Simple but often suboptimal.

```
Cache capacity: 3

Access A → [A]           (add)
Access B → [A, B]        (add)
Access C → [A, B, C]     (full)
Access A → [A, B, C]     (hit, but A's position doesn't change!)
Access D → [B, C, D]     (evict A — it was first in, even though we just used it!)
```

FIFO is simple but can evict frequently-used items. Only use when access recency doesn't matter.

### Policy Comparison

| Policy | Evicts | Best When | Weakness |
|--------|--------|-----------|----------|
| LRU | Least recently used | Temporal locality (recent = relevant) | Scan pollution (one-time scans evict useful data) |
| LFU | Least frequently used | Frequency matters more than recency | Stale popular items never evicted |
| TTL | Expired items | Data has natural expiration | Must choose TTL; too short = many misses, too long = stale data |
| FIFO | Oldest item | Simple, order-based workloads | Evicts regardless of usefulness |

## LRU Cache Implementation

An LRU cache needs two operations to be O(1):
1. **get(key)**: look up a value and mark it as recently used
2. **put(key, value)**: insert/update and evict if full

The classic implementation uses **HashMap + Doubly Linked List**:

```
HashMap: key → pointer to node in linked list
Linked List: ordered by recency (head = least recent, tail = most recent)

┌──────────────────────┐
│       HashMap        │
│ "A" → node_ptr ──────┼──┐
│ "B" → node_ptr ──────┼──┼──┐
│ "C" → node_ptr ──────┼──┼──┼──┐
└──────────────────────┘  │  │  │
                          │  │  │
Doubly Linked List:       ↓  ↓  ↓
HEAD ⇄ [A,val] ⇄ [B,val] ⇄ [C,val] ⇄ TAIL
       LRU                            MRU
       (evict                         (most
       first)                         recent)

get("B"):
  1. HashMap lookup → O(1) → find node
  2. Move node to tail → O(1) (just pointer manipulation)

put("D", val) when full:
  1. Remove head node (LRU) → O(1)
  2. Remove from HashMap → O(1)
  3. Insert new node at tail → O(1)
  4. Add to HashMap → O(1)
```

### Rust Implementation

Since doubly linked lists are awkward in Rust (ownership), we can use an alternative approach with a `Vec` and index-based linking, or use the `lru` crate. Here's a practical implementation using `LinkedList` handles:

```rust
use std::collections::HashMap;

struct LruCache<K: Clone + Eq + std::hash::Hash, V> {
    capacity: usize,
    map: HashMap<K, (V, usize)>,  // key → (value, order_counter)
    order: Vec<(K, usize)>,        // (key, counter) sorted by access time
    counter: usize,
}

impl<K: Clone + Eq + std::hash::Hash, V> LruCache<K, V> {
    fn new(capacity: usize) -> Self {
        Self {
            capacity,
            map: HashMap::new(),
            order: Vec::new(),
            counter: 0,
        }
    }

    fn get(&mut self, key: &K) -> Option<&V> {
        if self.map.contains_key(key) {
            self.counter += 1;
            let entry = self.map.get_mut(key).unwrap();
            entry.1 = self.counter;
            Some(&entry.0)
        } else {
            None
        }
    }

    fn put(&mut self, key: K, value: V) {
        self.counter += 1;

        if self.map.contains_key(&key) {
            let entry = self.map.get_mut(&key).unwrap();
            entry.0 = value;
            entry.1 = self.counter;
            return;
        }

        if self.map.len() >= self.capacity {
            let lru_key = self.map.iter()
                .min_by_key(|(_, (_, counter))| *counter)
                .map(|(k, _)| k.clone())
                .unwrap();
            self.map.remove(&lru_key);
        }

        self.map.insert(key, (value, self.counter));
    }
}
```

For production use, the `lru` crate provides an optimized O(1) implementation:

```rust
// Cargo.toml: lru = "0.12"
use lru::LruCache;
use std::num::NonZeroUsize;

let mut cache = LruCache::new(NonZeroUsize::new(100).unwrap());

cache.put("key1", "value1");
cache.put("key2", "value2");

let val = cache.get("key1");  // Some(&"value1"), marks as recently used

cache.put("key3", "value3");  // if at capacity, evicts LRU
```

## Cache Stampede / Thundering Herd

When a popular cache entry expires, many concurrent requests all experience a cache miss simultaneously and all hit the database:

```
Normal operation:
  Request 1 → cache hit → fast
  Request 2 → cache hit → fast
  ...

Cache expires at t=60:
  t=60.001: Request 1 → MISS → query database
  t=60.002: Request 2 → MISS → query database
  t=60.003: Request 3 → MISS → query database
  t=60.004: Request 4 → MISS → query database
  ... 1000 simultaneous requests all hit database!

  Database: "I'm dying!"
```

### Solutions

**1. Mutex/Lock**: Only one request fetches from database; others wait for the cache to be repopulated:

```
  t=60.001: Request 1 → MISS → acquire lock → query database
  t=60.002: Request 2 → MISS → lock taken → wait...
  t=60.003: Request 3 → MISS → lock taken → wait...
  t=60.010: Request 1 → database responds → update cache → release lock
  t=60.011: Request 2 → cache hit! (Request 1 populated it)
  t=60.012: Request 3 → cache hit!
```

**2. Stale-While-Revalidate**: Serve the stale (expired) data while refreshing in the background:

```
  t=60.001: Request 1 → expired but serve stale data → trigger background refresh
  t=60.002: Request 2 → serve stale data (background refresh in progress)
  t=60.500: Background refresh completes → update cache with fresh data
  t=60.501: Request 3 → cache hit with fresh data
```

**3. Probabilistic Early Expiration**: Each request near expiration has a small random chance of refreshing, spreading the load:

```
TTL = 60s, early_expiration_window = 5s

  t=55: Request → 5% chance of refreshing (probably serves cached)
  t=57: Request → 20% chance of refreshing
  t=59: Request → 80% chance of refreshing
  t=60: Expired → 100% must refresh
```

## Write-Through vs Write-Back Caches

### Write-Through

Every write goes to both cache AND storage immediately. Data is always consistent, but writes are slower:

```
Write "user:123" = {name: "Alice"}

  ┌────────┐     write      ┌───────┐     write     ┌──────────┐
  │ Client │ ──────────→    │ Cache │ ──────────→   │ Database │
  └────────┘                └───────┘               └──────────┘

  Both updated simultaneously. If cache fails, database still has data.
  Write latency = cache_write + db_write (slower)
```

### Write-Back (Write-Behind)

Writes go to cache only. Cache writes to storage later (batched, asynchronous):

```
Write "user:123" = {name: "Alice"}

  ┌────────┐     write      ┌───────┐
  │ Client │ ──────────→    │ Cache │   ← only cache is updated
  └────────┘                └───┬───┘
                                │
                         (later, async)
                                │
                                ↓
                          ┌──────────┐
                          │ Database │   ← updated in background
                          └──────────┘

  Write latency = cache_write only (fast!)
  Risk: cache crash before database write → data loss
```

Write-back is faster but risks data loss. CPU caches use write-back. Databases use write-ahead logs (WAL) to prevent data loss with write-back strategies.

## Real-World Caching Layers

```
┌─────────┐   ┌───────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐
│ Browser │ → │ CDN Edge  │ → │ App Server│ → │ Redis/   │ → │ Database │
│  Cache  │   │  Cache    │   │  In-Memory│   │ Memcached│   │          │
│ (local) │   │ (network) │   │  Cache    │   │ (shared) │   │ (disk)   │
└─────────┘   └───────────┘   └───────────┘   └──────────┘   └──────────┘
  ~0ms          ~10ms           ~0.1ms           ~1ms           ~10ms

Each layer: smaller + faster → larger + slower
Cache hit at any layer avoids hitting slower layers.
```

## Exercises

### Exercise 1: Implement an LRU Cache

Build an LRU cache with O(1) get and put using HashMap and a doubly linked list (simulated with Vec or index-based approach):

```rust
struct LruCache {
    capacity: usize,
    // Your data structures here
}

impl LruCache {
    fn new(capacity: usize) -> Self { todo!() }
    fn get(&mut self, key: &str) -> Option<String> { todo!() }
    fn put(&mut self, key: String, value: String) { todo!() }
    fn len(&self) -> usize { todo!() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basic_operations() {
        let mut cache = LruCache::new(2);
        cache.put("a".into(), "1".into());
        cache.put("b".into(), "2".into());
        assert_eq!(cache.get("a"), Some("1".into()));

        cache.put("c".into(), "3".into());  // evicts "b" (LRU)
        assert_eq!(cache.get("b"), None);
        assert_eq!(cache.get("c"), Some("3".into()));
    }

    #[test]
    fn access_updates_recency() {
        let mut cache = LruCache::new(2);
        cache.put("a".into(), "1".into());
        cache.put("b".into(), "2".into());
        cache.get("a");  // "a" is now most recent

        cache.put("c".into(), "3".into());  // evicts "b" (not "a")
        assert_eq!(cache.get("a"), Some("1".into()));
        assert_eq!(cache.get("b"), None);
    }

    #[test]
    fn update_existing_key() {
        let mut cache = LruCache::new(2);
        cache.put("a".into(), "1".into());
        cache.put("a".into(), "updated".into());
        assert_eq!(cache.get("a"), Some("updated".into()));
        assert_eq!(cache.len(), 1);
    }
}
```

### Exercise 2: TTL Cache

Extend the LRU cache with TTL (time-to-live):

```rust
use std::time::{Duration, Instant};

struct TtlCache {
    capacity: usize,
    default_ttl: Duration,
    // entries with expiration timestamps
}

impl TtlCache {
    fn new(capacity: usize, default_ttl: Duration) -> Self { todo!() }
    fn get(&mut self, key: &str) -> Option<String> {
        // Return None if expired, even if present
        todo!()
    }
    fn put(&mut self, key: String, value: String) { todo!() }
    fn put_with_ttl(&mut self, key: String, value: String, ttl: Duration) { todo!() }
    fn cleanup_expired(&mut self) { todo!() }
}
```

### Exercise 3: Cache Hit Rate Analyzer

Build a simulator that compares different eviction policies:

```rust
fn simulate_lru(requests: &[&str], capacity: usize) -> f64 {
    // Return hit rate (0.0 to 1.0)
    todo!()
}

fn simulate_lfu(requests: &[&str], capacity: usize) -> f64 {
    todo!()
}

fn simulate_fifo(requests: &[&str], capacity: usize) -> f64 {
    todo!()
}

fn main() {
    let requests = vec![
        "A", "B", "C", "D", "A", "B", "E", "A", "B", "C",
        "D", "E", "A", "A", "A", "B", "B", "C", "D", "E",
    ];

    for cap in [2, 3, 5] {
        println!("Capacity: {}", cap);
        println!("  LRU hit rate: {:.1}%", simulate_lru(&requests, cap) * 100.0);
        println!("  LFU hit rate: {:.1}%", simulate_lfu(&requests, cap) * 100.0);
        println!("  FIFO hit rate: {:.1}%", simulate_fifo(&requests, cap) * 100.0);
    }
}
```

---

Next: [Lesson 16: Choosing the Right Data Structure](./16-choosing.md)
