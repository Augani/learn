# Reference: Data Structure Decision Guide

## The Flowchart — What Do You Need?

```
                        What's your primary operation?
                                    |
                 +------------------+------------------+
                 |                  |                  |
           Key-Value           Collection          Relationships
            Lookup             of Items            Between Items
                 |                  |                  |
         Need ordering?     Need ordering?        → GRAPH (Lesson 12)
           /        \          /        \            Use HashMap<Node, Vec<Node>>
          /          \        /          \            or petgraph crate
        Yes          No    Yes          No
         |            |      |            |
     BTreeMap    HashMap  BTreeSet    HashSet
                                         |
                                    Need priority?
                                      /      \
                                    Yes       No
                                     |         |
                                BinaryHeap     |
                                          What access pattern?
                                          /     |      \
                                       FIFO   LIFO   Random
                                        |       |    Access
                                    VecDeque   Vec    Vec
                                    (Queue)  (Stack)
```

## Quick Decision Table

| I need to... | Use this | Why |
|-------------|----------|-----|
| Store a fixed collection of items | `[T; N]` (array) | No allocation, stack-stored, fastest access |
| Store a growable list | `Vec<T>` | Contiguous memory, fast iteration, O(1) index |
| Look up by key (unordered) | `HashMap<K, V>` | O(1) average get/insert/delete |
| Look up by key (sorted) | `BTreeMap<K, V>` | O(log n) ops, sorted iteration, range queries |
| Check membership (unordered) | `HashSet<T>` | O(1) average contains/insert |
| Check membership (sorted) | `BTreeSet<T>` | O(log n) ops, sorted iteration |
| Process items by priority | `BinaryHeap<T>` | O(1) peek-max, O(log n) push/pop |
| FIFO queue | `VecDeque<T>` | O(1) push_back/pop_front |
| LIFO stack | `Vec<T>` | O(1) push/pop (from end) |
| Double-ended queue | `VecDeque<T>` | O(1) push/pop at both ends |
| Count unique items approximately | Bloom filter | Space-efficient, no false negatives |
| Autocomplete / prefix search | Trie | O(m) lookup where m = key length |
| Find shortest path (weighted) | Graph + BinaryHeap | Dijkstra's algorithm |
| Find shortest path (unweighted) | Graph + VecDeque | BFS |
| Cache with eviction | LRU Cache | HashMap + linked list |
| Sorted data with fast insert | `BTreeMap` / `BTreeSet` | O(log n) everything, sorted iteration |

## Detailed Comparison Matrix

### By Operation Complexity

| | Access by Index | Search | Insert | Delete | Sorted Iteration | Memory Overhead |
|---|---|---|---|---|---|---|
| `Vec` | O(1) | O(n) | O(1) end, O(n) mid | O(1) end, O(n) mid | O(n log n) (sort first) | Low |
| `VecDeque` | O(1) | O(n) | O(1) ends | O(1) ends | O(n log n) (sort first) | Low |
| `LinkedList` | O(n) | O(n) | O(1) at cursor | O(1) at cursor | O(n log n) (sort first) | High (per-node alloc) |
| `HashMap` | N/A | O(1) avg | O(1) avg | O(1) avg | O(n log n) (collect+sort) | Medium |
| `BTreeMap` | N/A | O(log n) | O(log n) | O(log n) | O(n) (native) | Medium |
| `HashSet` | N/A | O(1) avg | O(1) avg | O(1) avg | O(n log n) (collect+sort) | Medium |
| `BTreeSet` | N/A | O(log n) | O(log n) | O(log n) | O(n) (native) | Medium |
| `BinaryHeap` | N/A | O(n) | O(log n) | O(log n) top only | O(n log n) (drain sorted) | Low |

### By Use Case

| Use Case | Best Choice | Runner-up | Avoid |
|----------|------------|-----------|-------|
| General-purpose list | `Vec` | `VecDeque` | `LinkedList` |
| Key-value store | `HashMap` | `BTreeMap` | `Vec<(K,V)>` |
| Unique elements | `HashSet` | `BTreeSet` | Manual dedup on Vec |
| Task scheduler | `BinaryHeap` | `BTreeMap` | Sorted Vec |
| Message queue | `VecDeque` | `crossbeam::queue` | Vec (O(n) pop front) |
| Undo/redo | `Vec` (as stack) | — | `VecDeque` |
| Database index | `BTreeMap` | — | `HashMap` |
| In-memory cache | `HashMap` + LRU | `lru` crate | `BTreeMap` |
| Graph | `HashMap<N, Vec<N>>` | `petgraph` | Adjacency matrix (sparse) |
| String prefix search | Trie | `BTreeSet<String>` | `HashSet` |
| Config lookup | `HashMap` | `BTreeMap` | `Vec` |
| Sorted output | `BTreeMap`/`BTreeSet` | Sort a `Vec` | `HashMap` |
| Streaming top-K | `BinaryHeap` | `BTreeSet` | Sort everything |

## Cross-Language Comparison

| Concept | Rust | Go | TypeScript |
|---------|------|-----|------------|
| Dynamic array | `Vec<T>` | `[]T` (slice) | `Array` |
| Fixed array | `[T; N]` | `[N]T` | `readonly [T, T, ...]` (tuple) |
| Hash map | `HashMap<K,V>` | `map[K]V` | `Map<K,V>` / `{}` |
| Sorted map | `BTreeMap<K,V>` | — (use slice + sort) | — (use array + sort) |
| Hash set | `HashSet<T>` | `map[T]struct{}` | `Set<T>` |
| Stack | `Vec<T>` | `[]T` (slice) | `Array` (push/pop) |
| Queue | `VecDeque<T>` | `container/list` | `Array` (push/shift, but O(n)) |
| Priority queue | `BinaryHeap<T>` | `container/heap` | — (npm packages) |
| Linked list | `LinkedList<T>` | `container/list` | — (implement yourself) |
| Sorted set | `BTreeSet<T>` | — | — |

## When NOT to Use a Data Structure

| Structure | Do NOT use when... |
|-----------|-------------------|
| `HashMap` | You need sorted iteration, keys aren't hashable, or data set is tiny (<20 elements — Vec linear scan may be faster) |
| `BTreeMap` | You don't need ordering and HashMap would work (HashMap is faster for pure lookup) |
| `LinkedList` | Almost always — Vec is better for cache performance. Only consider for O(1) mid-insertion with stable references |
| `BinaryHeap` | You need to search for arbitrary elements (O(n)), or need both min and max (it only gives you max efficiently) |
| `HashSet` | You need to count occurrences (use HashMap<T, usize>) or need ordering |
| `VecDeque` | You only add/remove at one end (use Vec instead) |
| `Vec` | You primarily insert/remove at the front (use VecDeque) or need O(1) contains (use HashSet) |

## Real-World System Examples

```
┌─────────────────────────────────────────────────────────┐
│                    Web Browser                          │
│                                                         │
│  Tab History      → Vec (stack-like, push/pop)          │
│  DOM Tree         → Tree (parent/children nodes)        │
│  CSS Selectors    → HashMap (selector → styles)         │
│  Event Queue      → VecDeque (FIFO processing)          │
│  Visited URLs     → HashSet (dedup history)             │
│  Autocomplete     → Trie (prefix matching)              │
│  Resource Cache   → HashMap + LRU eviction              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    PostgreSQL                           │
│                                                         │
│  B+ Tree Indexes  → BTreeMap-like (sorted, range scan)  │
│  Hash Indexes     → HashMap-like (exact match)          │
│  Query Plan Cache → LRU Cache                           │
│  WAL Buffer       → Ring Buffer (VecDeque-like)         │
│  Connection Pool  → Queue (VecDeque-like)               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Redis                                │
│                                                         │
│  Strings          → HashMap (key → value)               │
│  Sorted Sets      → Skip List (like BTreeMap)           │
│  Lists            → Linked List / Ziplist               │
│  Sets             → HashSet / IntSet                    │
│  HyperLogLog      → Probabilistic (unique counting)    │
│  Pub/Sub Channels → HashMap<Channel, Vec<Subscriber>>   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Linux Kernel                         │
│                                                         │
│  Process Scheduler → Red-Black Tree (CFS)               │
│  Page Tables       → Multi-level tree (radix tree)      │
│  VFS Dentry Cache  → Hash Table + LRU                   │
│  Network Routing   → Trie (longest prefix match)        │
│  I/O Scheduler     → Priority Queue / Red-Black Tree    │
│  Inode Cache       → Hash Table                         │
└─────────────────────────────────────────────────────────┘
```

## Summary: The 80/20 Rule

In practice, **80% of your data structure needs** are covered by just four types:

1. **`Vec`** — your default for ordered collections
2. **`HashMap`** — your default for key-value lookup
3. **`HashSet`** — your default for membership testing
4. **`BinaryHeap`** — when you need priority ordering

The other structures exist for specific situations:
- Need sorted keys? → `BTreeMap` / `BTreeSet`
- Need a queue? → `VecDeque`
- Building a database? → B-tree concepts
- Modeling relationships? → Graph (adjacency list)
- Need prefix matching? → Trie
- Need approximate membership? → Bloom filter
- Need caching? → LRU (HashMap + linked list)

---

Next: [Lesson 01: Arrays and Memory Layout](./01-arrays-memory.md)
