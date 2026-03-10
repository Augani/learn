# Lesson 10: Balanced Trees — B-Trees and Red-Black Trees

## The Problem

An unbalanced BST degenerates into a linked list with O(n) operations. Self-balancing trees solve this by automatically maintaining O(log n) height.

```
Unbalanced (O(n)):          Balanced (O(log n)):

    1                            4
     \                         /   \
      2                       2     6
       \                     / \   / \
        3                   1   3 5   7
         \
          4
           \
            5
```

You rarely implement balanced trees yourself — they're built into standard libraries. But understanding them is essential for knowing **why** BTreeMap is O(log n) and **why** databases use B-trees.

## Red-Black Trees

### Overview

A red-black tree is a BST with extra coloring rules that keep the tree approximately balanced. Each node is either **red** or **black**.

```
Red-Black Tree Rules:
1. Every node is red or black
2. The root is always black
3. Every NULL leaf is black
4. If a node is red, both its children must be black
   (no two consecutive red nodes)
5. Every path from root to any NULL leaf has the same
   number of black nodes (the "black-height")
```

```
Valid red-black tree:

              ┌───────┐
              │  13 B  │
              └───┬───┘
         ┌────────┴────────┐
     ┌───┴───┐         ┌───┴───┐
     │  8 R  │         │ 17 R  │
     └───┬───┘         └───┬───┘
   ┌─────┴─────┐     ┌────┴─────┐
┌──┴──┐    ┌───┴──┐ ┌┴───┐  ┌───┴──┐
│ 1 B │    │ 11 B │ │15 B│  │ 25 B │
└─────┘    └──────┘ └────┘  └───┬──┘
                              ┌─┴───┐
                              │22 R │
                              └─────┘

B = black, R = red

Black-height from root to any leaf = 2 (count black nodes excluding root)
```

### Why the Rules Work

The rules guarantee that the longest path is at most **twice** the shortest path:
- Shortest path: all black nodes
- Longest path: alternating red-black nodes (since you can't have two reds in a row)

This means height ≤ 2 * log₂(n+1), so operations are O(log n).

### Rotations and Recoloring

When an insertion or deletion violates the rules, the tree fixes itself through **rotations** and **recoloring**:

```
Left Rotation at node A:

    A                    B
   / \                  / \
  x   B       →       A   z
     / \              / \
    y   z            x   y


Right Rotation at node B:

      B                A
     / \              / \
    A   z    →       x   B
   / \                  / \
  x   y                y   z
```

Rotations are O(1) — they just change a few pointers. After insertion, at most 2 rotations are needed. After deletion, at most 3.

### Where Red-Black Trees Are Used

- **Java**: `TreeMap`, `TreeSet`
- **C++**: `std::map`, `std::set`
- **Linux kernel**: process scheduling (CFS scheduler), memory management
- **.NET**: `SortedDictionary`

Rust chose B-trees instead of red-black trees for its standard library. Let's see why.

## B-Trees

### The Key Insight: Wider is Better for Cache and Disk

A BST has at most 2 children per node. A B-tree can have **hundreds** of children per node. This means the tree is much shallower — fewer levels to traverse.

```
Binary tree with 15 nodes (height 3):

              ┌───┐
              │ 8 │                    Height = 3
              └─┬─┘                    Nodes visited to reach leaf: 4
         ┌─────┴─────┐
       ┌─┴─┐       ┌─┴─┐
       │ 4 │       │ 12│
       └─┬─┘       └─┬─┘
     ┌───┴───┐   ┌───┴───┐
   ┌─┴┐   ┌─┴┐ ┌┴─┐   ┌─┴─┐
   │ 2│   │ 6│ │10│   │ 14│
   └──┘   └──┘ └──┘   └───┘


B-tree (order 4) with 15 keys (height 1):

              ┌────────────┐
              │  4,  8, 12 │           Height = 1
              └──────┬─────┘           Nodes visited to reach leaf: 2
        ┌──────┬─────┼────┬──────┐
    ┌───┴──┐ ┌─┴──┐ ┌┴───┐ ┌────┴───┐
    │ 1,2,3│ │5,6,7│ │9,10│ │13,14,15│
    └──────┘ └────┘  │ 11 │ └────────┘
                     └────┘
```

The B-tree has far fewer levels. Each level access in a B-tree might read more data, but on modern hardware, reading 64-256 bytes is essentially the same cost as reading 1 byte (one cache line or one disk page).

### B-Tree Properties

A B-tree of order `m` (also called a B-tree of minimum degree `t` where `m = 2t`):
- Every node has at most `m` children
- Every non-root node has at least `m/2` children (at least half full)
- Every non-root node has between `⌈m/2⌉ - 1` and `m - 1` keys
- All leaves are at the same depth
- Keys within a node are sorted

```
B-tree of order 5 (max 4 keys, max 5 children per node):

Node structure:
┌──────────────────────────────────────┐
│ key₁ │ key₂ │ key₃ │ key₄ │         │
├──────┼──────┼──────┼──────┼─────────┤
│child₀│child₁│child₂│child₃│ child₄  │
└──────┴──────┴──────┴──────┴─────────┘

child₀ has all keys < key₁
child₁ has all keys between key₁ and key₂
child₂ has all keys between key₂ and key₃
...
```

### B-Tree Search

```
Search for key 42 in a B-tree:

Root: [20, 40, 60, 80]
       42 is between 40 and 60 → follow child₂

child₂: [41, 42, 43, 45]
         Found 42!

Only 2 node accesses for a tree that could hold thousands of keys.
```

### B-Tree Insert

When a node is full, it **splits**:

```
Insert 25 into a full node:

Before:
    ┌──────────────────┐
    │ 10, 20, 30, 40   │  ← full (max 4 keys)
    └──────────────────┘

25 needs to go between 20 and 30. Node is full → SPLIT!

After split:
                  ┌────┐
                  │ 30 │  ← middle key moves up to parent
                  └──┬─┘
            ┌────────┴────────┐
    ┌───────┴──────┐  ┌──────┴──────┐
    │ 10, 20, 25   │  │    40       │
    └──────────────┘  └─────────────┘
```

Splits can cascade up to the root. When the root splits, the tree grows one level taller. This is the **only** way a B-tree gets taller, which guarantees all leaves are at the same depth.

### Why B-Trees Are Perfect for Databases

This connects directly to **Lesson 03 in the databases module** (indexes).

```
Disk I/O is ~100,000x slower than memory access:

Memory access:  ~100 nanoseconds
Disk access:    ~10 milliseconds = 10,000,000 nanoseconds

Each level in a tree = one disk access.

Binary tree with 1 million records:
  Height ≈ 20 → up to 20 disk reads = 200ms

B-tree (order 100) with 1 million records:
  Height ≈ 3 → 3 disk reads = 30ms

B-tree is ~7x faster, not because of Big-O,
but because each node fits in one disk page (4KB or 8KB).
```

A B-tree node is designed to match the disk page size:

```
Disk Page (4 KB):
┌────────────────────────────────────────────────────┐
│ Key₁ → Ptr₁ │ Key₂ → Ptr₂ │ ... │ Key₁₀₀ → Ptr₁₀₀│
│  (40 bytes)  │  (40 bytes)  │     │   (40 bytes)    │
└────────────────────────────────────────────────────┘
100 keys × 40 bytes = 4000 bytes ≈ one 4KB page

One disk read loads an entire node with 100 keys to compare.
```

## B+ Trees: What Databases Actually Use

B+ trees are a variant where:
1. **All data is stored in leaf nodes** (internal nodes only store keys for routing)
2. **Leaf nodes are linked together** in a sorted linked list

```
B+ tree:

                    ┌──────────┐
                    │  30, 60  │         ← internal (routing only)
                    └────┬─────┘
            ┌────────────┼────────────┐
    ┌───────┴──────┐ ┌───┴─────┐ ┌────┴───────┐
    │ 10, 20, 25   │→│ 30, 40  │→│ 60, 70, 80 │  ← leaves (all data here)
    │ data data data│ │data data│ │data data data│
    └──────────────┘ └─────────┘ └─────────────┘
         ↑               ↑              ↑
    Linked together for fast range scans
```

Why B+ trees are better for databases:
1. **Range queries are fast**: follow the leaf links. `SELECT * WHERE age BETWEEN 20 AND 40` just scans the leaf linked list.
2. **Internal nodes are smaller**: they only store keys, not data, so more keys fit per node, making the tree shallower.
3. **Predictable performance**: every lookup traverses the same number of levels (root to leaf).

This is what PostgreSQL, MySQL, SQLite, and most databases actually use for their indexes.

## Comparison

| | Red-Black Tree | B-Tree | B+ Tree |
|---|---|---|---|
| Max children | 2 | m (typically 100-1000) | m (typically 100-1000) |
| Height for 1M keys | ~20 | ~3-4 | ~3-4 |
| Optimized for | In-memory | Disk/cache | Disk/cache + range queries |
| Data location | Every node | Every node | Leaves only |
| Range scan | O(n) traversal | O(n) traversal | O(log n + range) via leaf links |
| Used by | Java TreeMap, C++ std::map | Rust BTreeMap | PostgreSQL, MySQL, SQLite |

## Rust: BTreeMap and BTreeSet

Rust chose B-trees over red-black trees because B-trees have better **cache performance** — fewer cache misses per lookup since each node contains multiple keys contiguously in memory.

```rust
use std::collections::BTreeMap;

let mut map = BTreeMap::new();
map.insert("charlie", 3);
map.insert("alice", 1);
map.insert("bob", 2);

for (key, value) in &map {
    println!("{}: {}", key, value);
    // Iterates in sorted order: alice, bob, charlie
}

let range: Vec<_> = map.range("a"..="b").collect();
// [("alice", &1), ("bob", &2)]

map.entry("dave").or_insert(4);

let first = map.iter().next();          // smallest key
let last = map.iter().next_back();      // largest key
```

### HashMap vs BTreeMap

| | HashMap | BTreeMap |
|---|---|---|
| Get/Insert/Delete | O(1) average | O(log n) |
| Sorted iteration | O(n log n) (sort first) | O(n) (native) |
| Range queries | Not supported | `.range(start..end)` |
| Memory layout | Hash table | B-tree nodes |
| Key requirement | `Hash + Eq` | `Ord` |
| Best for | Fast lookup by key | Sorted data, range queries |

**Default to HashMap**. Use BTreeMap when you need sorted keys or range queries.

## Exercises

### Exercise 1: BTreeMap vs HashMap Performance

Benchmark BTreeMap vs HashMap for different operations:

```rust
use std::collections::{BTreeMap, HashMap};
use std::time::Instant;

fn bench_insert(n: usize) {
    let start = Instant::now();
    let mut hmap: HashMap<i32, i32> = HashMap::new();
    for i in 0..n as i32 {
        hmap.insert(i, i);
    }
    println!("HashMap insert {}: {:?}", n, start.elapsed());

    let start = Instant::now();
    let mut bmap: BTreeMap<i32, i32> = BTreeMap::new();
    for i in 0..n as i32 {
        bmap.insert(i, i);
    }
    println!("BTreeMap insert {}: {:?}", n, start.elapsed());
}

fn bench_sorted_iteration(n: usize) {
    let hmap: HashMap<i32, i32> = (0..n as i32).map(|i| (i, i)).collect();
    let bmap: BTreeMap<i32, i32> = (0..n as i32).map(|i| (i, i)).collect();

    let start = Instant::now();
    let mut sorted: Vec<_> = hmap.iter().collect();
    sorted.sort();
    println!("HashMap sorted iteration {}: {:?}", n, start.elapsed());

    let start = Instant::now();
    let _: Vec<_> = bmap.iter().collect();
    println!("BTreeMap sorted iteration {}: {:?}", n, start.elapsed());
}
```

Run for n = 10,000, 100,000, and 1,000,000. BTreeMap should win on sorted iteration; HashMap should win on random lookups.

### Exercise 2: Range Query Application

Use BTreeMap to build a simple time-series database:

```rust
use std::collections::BTreeMap;

struct TimeSeriesDb {
    data: BTreeMap<u64, f64>,  // timestamp → value
}

impl TimeSeriesDb {
    fn new() -> Self { Self { data: BTreeMap::new() } }
    fn insert(&mut self, timestamp: u64, value: f64) { /* ... */ }
    fn query_range(&self, start: u64, end: u64) -> Vec<(u64, f64)> { /* ... */ }
    fn average_in_range(&self, start: u64, end: u64) -> Option<f64> { /* ... */ }
    fn latest(&self) -> Option<(u64, f64)> { /* ... */ }
    fn earliest(&self) -> Option<(u64, f64)> { /* ... */ }
}
```

### Exercise 3: Understand B-Tree Splits

Trace through the insertion of the following keys into a B-tree of order 3 (max 2 keys per node). Draw the tree after each insertion:

Keys: 10, 20, 30, 40, 50, 60, 70

```
After insert 10: [10]
After insert 20: [10, 20]
After insert 30: Node is full → split!
                      [20]
                     /    \
                  [10]    [30]
After insert 40: ...
After insert 50: ...
...continue...
```

This exercise builds intuition for how B-trees grow and stay balanced.

---

Next: [Lesson 11: Heaps and Priority Queues](./11-heaps.md)
