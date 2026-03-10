# Lesson 16: Choosing the Right Data Structure — Real-World Scenarios

## The Decision Framework

Choosing the right data structure is the most impactful performance decision you make as a developer. A wrong choice can mean the difference between O(1) and O(n) for your most common operation — and at scale, that's the difference between 1ms and 10 seconds.

The process:
1. **Identify your primary operations** (what do you do most?)
2. **Identify your constraints** (memory? latency? concurrency?)
3. **Pick the structure that optimizes for #1 within the constraints of #2**
4. **Benchmark** (theory doesn't always match practice due to cache effects)

## Decision Scenarios

### "I need to check if an item exists"

```
                  Need ordering?
                   /          \
                 Yes           No
                  |             |
           Need range?     Just exists?
            /      \          |
          Yes      No     HashSet
           |        |      O(1)
       BTreeSet  BTreeSet
        range()   O(log n)
```

```rust
use std::collections::{HashSet, BTreeSet};

let banned: HashSet<String> = load_banned();
if banned.contains(&user_ip) { /* block */ }  // O(1)

let sorted_scores: BTreeSet<i32> = load_scores();
let high_scores: Vec<&i32> = sorted_scores.range(90..=100).collect();  // O(log n + k)
```

### "I need key-value lookup"

```
                  Need sorted keys?
                   /            \
                 Yes             No
                  |               |
            Need range           Just lookup?
             queries?               |
              /    \             HashMap
            Yes     No           O(1)
             |       |
          BTreeMap  BTreeMap
           range()  O(log n)
```

```rust
let config: HashMap<String, String> = load_config();
let db_url = config.get("DATABASE_URL");  // O(1)

let events: BTreeMap<DateTime, Event> = load_events();
let today: Vec<_> = events.range(start_of_day..end_of_day).collect();  // O(log n + k)
```

### "I need to process items in priority order"

```
BinaryHeap — always.

  Need min?  → BinaryHeap<Reverse<T>>
  Need max?  → BinaryHeap<T>
  Need both? → Two heaps, or BTreeMap
```

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

let mut tasks: BinaryHeap<Reverse<(u32, String)>> = BinaryHeap::new();
tasks.push(Reverse((3, "low priority".into())));
tasks.push(Reverse((1, "urgent".into())));
let next = tasks.pop();  // Reverse((1, "urgent"))
```

### "I need a FIFO queue"

```
VecDeque — always. (Unless concurrent, then use crossbeam or channels)
```

```rust
use std::collections::VecDeque;

let mut queue: VecDeque<Job> = VecDeque::new();
queue.push_back(job);              // enqueue
let next = queue.pop_front();      // dequeue — O(1)
```

### "I need sorted data with fast insert"

```
                  How many items?
                 /              \
              < 1000          > 1000
                |                |
         Sorted Vec          BTreeMap
         (binary search      O(log n)
          + insert)           native
```

For small collections, a sorted Vec with `binary_search` for lookup and `insert` at the found position can be faster than BTreeMap due to cache effects. But for larger collections, BTreeMap wins.

### "I need fast random access by index"

```
Vec — always.

  O(1) indexing, cache-friendly iteration.
  No other structure competes for index-based access.
```

### "I need to find shortest path"

```
                  Weighted?
                   /       \
                 Yes        No
                  |          |
              Negative     BFS with
              weights?     VecDeque
               /    \       O(V+E)
             Yes     No
              |       |
          Bellman-  Dijkstra
           Ford     with BinaryHeap
          O(V*E)    O((V+E) log V)
```

### "I need to count unique items approximately"

```
                  Exact count needed?
                   /              \
                 Yes               No
                  |                 |
              HashSet          How approximate?
              O(n) space        /          \
                            Membership    Cardinality
                               |              |
                          Bloom Filter    HyperLogLog
                          (is X in set?)  (how many unique?)
```

## Real System Examples

### How Redis Uses Data Structures

```
┌────────────────────────────────────────────────────────┐
│                      Redis                              │
│                                                         │
│  String commands (GET/SET)                              │
│    → Simple hash table (key → value)                   │
│    → O(1) get/set                                      │
│                                                         │
│  List commands (LPUSH/RPUSH/LPOP)                      │
│    → Linked list (large) or ziplist (small)            │
│    → O(1) push/pop at both ends                        │
│                                                         │
│  Set commands (SADD/SISMEMBER/SUNION)                  │
│    → Hash set (large) or intset (small integers)       │
│    → O(1) add/check membership                         │
│                                                         │
│  Sorted Set commands (ZADD/ZRANGE/ZRANK)               │
│    → Skip list + hash table                            │
│    → O(log n) insert, O(log n + k) range queries       │
│    → Skip list ≈ probabilistic balanced tree           │
│                                                         │
│  Hash commands (HSET/HGET)                             │
│    → Hash table (large) or ziplist (small)             │
│    → O(1) field access                                 │
│                                                         │
│  HyperLogLog (PFADD/PFCOUNT)                           │
│    → Probabilistic cardinality estimator               │
│    → 12 KB per counter, ~0.81% error rate              │
│    → Count unique visitors: 100M users in 12 KB!       │
└────────────────────────────────────────────────────────┘
```

### How PostgreSQL Uses Data Structures

```
┌────────────────────────────────────────────────────────┐
│                    PostgreSQL                           │
│                                                         │
│  B+ Tree Index (CREATE INDEX ... USING btree)          │
│    → Default index type                                │
│    → O(log n) lookup, excellent range scans            │
│    → Each node = one disk page (8 KB)                  │
│    → Used for: WHERE, ORDER BY, JOIN                   │
│                                                         │
│  Hash Index (CREATE INDEX ... USING hash)              │
│    → O(1) equality lookup                              │
│    → No range queries                                  │
│    → Used for: WHERE col = value (exact match)         │
│                                                         │
│  GIN Index (Generalized Inverted Index)                │
│    → Inverted index: value → list of row IDs           │
│    → Used for: full-text search, JSONB, arrays         │
│                                                         │
│  GiST Index (Generalized Search Tree)                  │
│    → Balanced tree for geometric/custom data           │
│    → Used for: PostGIS, range types, nearest neighbor  │
│                                                         │
│  Buffer Pool                                           │
│    → LRU-based page cache                              │
│    → Keeps frequently accessed disk pages in memory    │
│                                                         │
│  WAL (Write-Ahead Log)                                 │
│    → Append-only log (sequential writes)               │
│    → Ring buffer in memory → flush to disk             │
│                                                         │
│  Query Plan Cache                                      │
│    → LRU cache of prepared statement plans             │
└────────────────────────────────────────────────────────┘
```

### How the Linux Kernel Uses Data Structures

```
┌────────────────────────────────────────────────────────┐
│                    Linux Kernel                         │
│                                                         │
│  Completely Fair Scheduler (CFS)                       │
│    → Red-black tree of runnable processes              │
│    → Key = virtual runtime (vruntime)                  │
│    → Always pick leftmost node (smallest vruntime)     │
│    → O(log n) insert/remove, O(1) pick next            │
│                                                         │
│  Virtual Memory (Page Tables)                          │
│    → Multi-level radix tree (4 levels on x86-64)       │
│    → Virtual address → physical address translation    │
│    → Each level = 9 bits of address → 512 entries      │
│                                                         │
│  VFS Dentry Cache                                      │
│    → Hash table + LRU list                             │
│    → Path → inode mapping cache                        │
│    → Avoids disk reads for path resolution             │
│                                                         │
│  Network Routing (FIB)                                 │
│    → Trie (LC-trie: level-compressed trie)             │
│    → Longest prefix match for IP routing               │
│    → 0.0.0.0/0 → default route                        │
│    → 192.168.1.0/24 → local network                   │
│                                                         │
│  I/O Scheduler                                         │
│    → Various: deadline (two sorted lists),             │
│      CFQ (per-process queues), BFQ (B-tree based)      │
│                                                         │
│  Slab Allocator                                        │
│    → Object pools with free lists                      │
│    → Pre-allocated fixed-size objects                   │
│    → O(1) allocate/free for common kernel objects      │
└────────────────────────────────────────────────────────┘
```

### How Web Browsers Use Data Structures

```
┌────────────────────────────────────────────────────────┐
│                    Web Browser                          │
│                                                         │
│  DOM Tree                                              │
│    → N-ary tree (each node has arbitrary children)     │
│    → Parent/child/sibling pointers                     │
│    → document.getElementById → hash map internally     │
│                                                         │
│  CSS Style Resolution                                  │
│    → Rule matching: hash maps by tag, class, id        │
│    → Specificity: sorted comparison                    │
│    → Computed style cache                              │
│                                                         │
│  JavaScript Engine (V8)                                │
│    → Hidden classes: tree of shape transitions         │
│    → Inline caches: hash maps for fast property access │
│    → Garbage collector: generational with mark-sweep   │
│                                                         │
│  Navigation History                                    │
│    → Back/forward stack (two stacks or doubly linked)  │
│                                                         │
│  Resource Cache                                        │
│    → LRU cache with TTL                                │
│    → Images, scripts, stylesheets                      │
│    → Bloom filter for HSTS preload list                │
│                                                         │
│  Autocomplete                                          │
│    → Trie or sorted list with binary search            │
│    → History + bookmarks + search suggestions          │
└────────────────────────────────────────────────────────┘
```

## Performance Benchmarks in Rust

These are approximate benchmarks for common operations. Run your own benchmarks for your specific data and hardware:

```
Operation benchmarks (1 million elements, i64 keys):

Insert 1M elements:
  Vec (push):              ~15ms
  HashMap:                 ~80ms
  BTreeMap:                ~200ms
  BinaryHeap:              ~25ms

Lookup 1M elements (random):
  Vec (index):             ~3ms
  Vec (linear search):     ~5000ms (O(n) per lookup)
  Vec (binary search):     ~60ms (requires sorted)
  HashMap:                 ~40ms
  BTreeMap:                ~120ms

Iterate all elements:
  Vec:                     ~2ms
  HashMap:                 ~8ms
  BTreeMap:                ~6ms

Sorted iteration:
  Vec (sort + iterate):    ~80ms (sort) + ~2ms (iterate)
  HashMap (collect + sort): ~40ms (collect) + ~80ms (sort)
  BTreeMap (iterate):      ~6ms (already sorted!)

Delete 1M elements:
  Vec (pop from end):      ~5ms
  Vec (remove from front): ~VERY SLOW (O(n) shift per remove)
  HashMap:                 ~60ms
  BTreeMap:                ~150ms
```

## Summary Table: All Data Structures

| Structure | Get | Insert | Delete | Iterate | Sorted? | Use Case |
|-----------|-----|--------|--------|---------|---------|----------|
| `[T; N]` | O(1) | N/A | N/A | O(n) | No | Fixed-size, stack-allocated |
| `Vec<T>` | O(1) | O(1)* end | O(1) end | O(n) | No | Default list, stack |
| `VecDeque<T>` | O(1) | O(1)* ends | O(1) ends | O(n) | No | Queue, deque |
| `LinkedList<T>` | O(n) | O(1) at cursor | O(1) at cursor | O(n) | No | Rarely used |
| `HashMap<K,V>` | O(1) | O(1) | O(1) | O(n) | No | Default key-value |
| `BTreeMap<K,V>` | O(log n) | O(log n) | O(log n) | O(n) | Yes | Sorted keys, ranges |
| `HashSet<T>` | O(1) | O(1) | O(1) | O(n) | No | Membership testing |
| `BTreeSet<T>` | O(log n) | O(log n) | O(log n) | O(n) | Yes | Sorted membership |
| `BinaryHeap<T>` | O(1) peek | O(log n) | O(log n) top | O(n) | No** | Priority queue |
| BST | O(log n)*** | O(log n)*** | O(log n)*** | O(n) | Yes | Educational |
| Trie | O(m) | O(m) | O(m) | O(total chars) | Yes | Prefix search |
| Bloom Filter | O(k) | O(k) | N/A | N/A | No | Probabilistic membership |
| Graph (adj. list) | O(degree) | O(1) | O(degree) | O(V+E) | No | Relationships |

\* amortized
\** heap order, not sorted
\*** when balanced; O(n) when degenerate

## The 80/20 Guide

For 80% of programming tasks, you need these four:

```
1. Vec<T>         → ordered collection, stack
2. HashMap<K,V>   → fast key-value lookup
3. HashSet<T>     → fast membership checking
4. VecDeque<T>    → FIFO queue

For the other 20%:
5. BTreeMap<K,V>  → sorted keys, range queries
6. BinaryHeap<T>  → priority queue
7. BTreeSet<T>    → sorted set
```

Everything else (tries, bloom filters, graphs, LRU caches) you build from these primitives or import from crates.

## Exercises

### Exercise 1: System Design — URL Shortener

Design the data structures for a URL shortener service (like bit.ly):

Requirements:
- Generate short codes for long URLs
- Redirect short codes to original URLs (fast lookup)
- Track click counts per URL
- Show top 10 most-clicked URLs
- Expire URLs after 30 days

What data structures would you use for each requirement? Implement a simplified version:

```rust
struct UrlShortener {
    // What goes here?
}

impl UrlShortener {
    fn shorten(&mut self, url: &str) -> String { todo!() }
    fn resolve(&self, short_code: &str) -> Option<&str> { todo!() }
    fn click(&mut self, short_code: &str) { todo!() }
    fn top_urls(&self, n: usize) -> Vec<(String, usize)> { todo!() }
    fn cleanup_expired(&mut self) { todo!() }
}
```

### Exercise 2: System Design — Autocomplete System

Design an autocomplete system for a search box:

Requirements:
- Suggest completions as user types
- Rank by frequency (most searched = first suggestion)
- Handle millions of search terms
- Fast response (< 10ms for any prefix)

```rust
struct Autocomplete {
    // What goes here?
}

impl Autocomplete {
    fn record_search(&mut self, query: &str) { todo!() }
    fn suggest(&self, prefix: &str, max_results: usize) -> Vec<(String, usize)> { todo!() }
}
```

Hint: Trie with frequency counts at each node, or sorted BTreeMap with prefix scanning.

### Exercise 3: Benchmark Your Intuition

Before running benchmarks, predict which data structure wins for each scenario. Then write benchmarks and compare:

```rust
use std::collections::*;
use std::time::Instant;

fn main() {
    let n = 100_000;

    // Scenario 1: Insert 100K random integers, then check if 1000 values exist
    // Prediction: Vec (linear)? HashSet? BTreeSet?

    // Scenario 2: Insert 100K key-value pairs, iterate in sorted order
    // Prediction: HashMap + sort? BTreeMap?

    // Scenario 3: Insert 100K elements, repeatedly remove/add at both ends
    // Prediction: Vec? VecDeque? LinkedList?

    // Scenario 4: Find top 10 elements out of 100K
    // Prediction: Sort Vec? BinaryHeap? Partial sort?

    // Write benchmarks for each and compare your predictions with reality.
}
```

---

This concludes the Data Structures and Algorithms lessons. You now have the vocabulary and mental models to make informed choices about data structures in any system you build.

For quick reference, see:
- [Big-O Cheat Sheet](./reference-big-o.md)
- [Decision Guide](./reference-decision-guide.md)
