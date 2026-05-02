# Lesson 07: Hash Tables — O(1) Lookup Magic

> **Analogy**: Imagine a library with thousands of books. Instead
> of searching every shelf, the librarian has a card catalog: you
> look up a book's title, the card tells you "Shelf 14, Slot 3,"
> and you walk straight there. No scanning, no guessing. A hash
> table works the same way — it converts a key into a shelf
> number (an array index) using a hash function, giving you
> near-instant lookup. The magic isn't really magic at all — it's
> clever arithmetic that turns any key into a number, then uses
> that number to jump directly to the right slot.

---

## Why This Matters

Hash tables are arguably the most important data structure in
practical programming. They power:

- **Dictionaries/maps**: Python's `dict`, JavaScript's `Map` and
  plain objects, Rust's `HashMap` — all hash tables under the
  hood.
- **Databases**: Index lookups, join operations, and query
  caching all rely on hashing.
- **Caches**: Memcached, Redis, and in-memory caches use hash
  tables for O(1) key-value retrieval.
- **Compilers**: Symbol tables that map variable names to memory
  locations are hash tables.
- **Networking**: Routing tables, connection tracking, and load
  balancers use hashing to distribute traffic.
- **Deduplication**: Detecting duplicate files, URLs, or records
  in O(1) per check.
- **Counting**: Frequency counting (word counts, vote tallies,
  analytics) is a hash table's bread and butter.

The "Two Sum" problem — given an array, find two numbers that add
to a target — is the most famous coding interview question. The
optimal O(n) solution uses a hash table. Without hashing, you're
stuck with O(n²) brute force or O(n log n) sorting.

By the end of this lesson, you'll understand:

- How hash functions convert keys to array indices
- Why the modulo trick works and what makes a good hash function
- How collisions happen and two strategies to resolve them
- What load factor means and when to rehash
- Why hash table operations are amortized O(1)
- When hash tables are the wrong choice

> **Cross-reference**: The existing data structures track covers
> hash maps from a Rust-focused perspective. See
> [Hash Maps](../data-structures/07-hash-maps.md)
> for a complementary treatment.

---

## The Library Card Catalog — Deeper

Let's extend the library analogy to understand every piece of a
hash table:

```
  THE LIBRARY CARD CATALOG

  You have 8 shelves (numbered 0-7) and books to store.

  The "hash function" is: count the letters in the title,
  then take the remainder when dividing by 8.

  Book: "Cat"     → 3 letters → 3 % 8 = shelf 3
  Book: "Dog"     → 3 letters → 3 % 8 = shelf 3  ← COLLISION!
  Book: "Elephant" → 8 letters → 8 % 8 = shelf 0
  Book: "Ant"     → 3 letters → 3 % 8 = shelf 3  ← ANOTHER!

  Shelf 0: [Elephant]
  Shelf 1: [ ]
  Shelf 2: [ ]
  Shelf 3: [Cat] → [Dog] → [Ant]   ← 3 books on one shelf!
  Shelf 4: [ ]
  Shelf 5: [ ]
  Shelf 6: [ ]
  Shelf 7: [ ]

  This is a BAD hash function — it groups books by title
  length, so many books end up on the same shelf. A GOOD
  hash function would spread books evenly across all shelves.
```

Key concepts from this analogy:

- **Hash function**: The rule that converts a key (book title)
  into a number (shelf number).
- **Modulo trick**: `hash(key) % table_size` maps any number
  into the valid range of indices.
- **Collision**: When two different keys map to the same index.
- **Load factor**: How full the shelves are. If you have 6 books
  and 8 shelves, the load factor is 6/8 = 0.75.
- **Rehashing**: When shelves get too crowded, buy more shelves
  (resize the array) and redistribute all books.

---

## Hash Functions: Turning Keys into Numbers

A hash function takes an input of any type and produces an
integer. For a hash table with `m` slots, we then use
`hash(key) % m` to get an index in `[0, m-1]`.

```
  HASH FUNCTION PIPELINE

  key: "hello"
       │
       ▼
  ┌──────────────┐
  │ Hash Function │  → produces a large integer
  │ h("hello")    │  → e.g., 2314539827
  └──────────────┘
       │
       ▼
  ┌──────────────┐
  │ Modulo (% m) │  → maps to valid index
  │ 2314539827%8 │  → 3
  └──────────────┘
       │
       ▼
  Index 3 in the array
```

### What Makes a Good Hash Function?

A good hash function has three properties:

1. **Deterministic**: Same input always produces the same output.
   `hash("cat")` must always return the same number.

2. **Uniform distribution**: Outputs should be spread evenly
   across all possible indices. If most keys hash to the same
   few slots, performance degrades to O(n).

3. **Fast to compute**: The whole point of hashing is speed. If
   the hash function itself takes O(n²), we've gained nothing.

```
  GOOD vs BAD HASH FUNCTIONS

  BAD: h(s) = len(s) % m
  • "cat", "dog", "ant" all → 3 % m
  • Terrible distribution — groups by string length

  BAD: h(s) = first_char(s) % m
  • "cat", "car", "cup" all → same bucket
  • Groups by first letter — only 26 possible values

  GOOD: h(s) = (s[0]*31⁰ + s[1]*31¹ + s[2]*31² + ...) % m
  • Polynomial rolling hash
  • Each character contributes differently based on position
  • 31 is prime — reduces patterns in the output
  • Used by Java's String.hashCode()

  GOOD: h(n) = ((a*n + b) % p) % m
  • Universal hashing (a, b random, p prime)
  • Provably uniform distribution
```

### The Modulo Trick

Why modulo? Because hash functions produce numbers that can be
enormous (billions or more), but our array has only `m` slots.
Modulo wraps any number into the range `[0, m-1]`:

```
  THE MODULO TRICK

  hash("apple")  = 3284729374  →  3284729374 % 8 = 6
  hash("banana") = 9182736455  →  9182736455 % 8 = 7
  hash("cherry") = 1029384756  →  1029384756 % 8 = 4

  No matter how large the hash value, % m gives us
  a valid array index between 0 and m-1.

  Why use a prime number for m?
  • If m = 8 (power of 2), only the last 3 bits matter
  • If m = 7 (prime), all bits contribute to the result
  • Prime table sizes reduce collision clustering
  • In practice, powers of 2 are used with good hash
    functions (faster than division)
```

---

## Collision Resolution: When Two Keys Want the Same Slot

Collisions are inevitable. By the **pigeonhole principle**, if
you have more possible keys than array slots, at least two keys
must map to the same slot. Even with fewer keys than slots,
collisions happen — the **birthday paradox** tells us that with
just 23 people, there's a >50% chance two share a birthday.

There are two main strategies for handling collisions:

### Strategy 1: Separate Chaining

Each slot in the array holds a linked list (or other collection).
When multiple keys hash to the same index, they're all stored in
that slot's list.

```
  SEPARATE CHAINING

  Table size: 8
  Insert: ("cat", 1), ("dog", 2), ("ant", 3), ("elk", 4), ("bee", 5)

  hash("cat") % 8 = 3
  hash("dog") % 8 = 5
  hash("ant") % 8 = 3   ← collision with "cat"
  hash("elk") % 8 = 1
  hash("bee") % 8 = 5   ← collision with "dog"

  Index │ Chain
  ──────┼──────────────────────────────
    0   │ ∅
    1   │ → ["elk":4]
    2   │ ∅
    3   │ → ["cat":1] → ["ant":3]
    4   │ ∅
    5   │ → ["dog":2] → ["bee":5]
    6   │ ∅
    7   │ ∅

  Lookup "ant":
  1. hash("ant") % 8 = 3
  2. Go to index 3
  3. Walk the chain: "cat"? No. "ant"? Yes! Return 3.

  Worst case: all n keys in one chain → O(n) lookup
  Average case (good hash): chain length ≈ n/m → O(1)
```

Advantages of chaining:
- Simple to implement
- Never runs out of space (chains can grow)
- Deletion is straightforward (remove from linked list)
- Performance degrades gracefully

Disadvantages:
- Extra memory for linked list pointers
- Poor cache performance (pointer chasing)
- Each node is a separate heap allocation

### Strategy 2: Open Addressing

All entries are stored directly in the array — no linked lists.
When a collision occurs, we **probe** for the next empty slot
using a probing sequence.

#### Linear Probing

Try the next slot, then the next, then the next...

```
  LINEAR PROBING

  Table size: 8
  Insert: ("cat", 1), ("dog", 2), ("ant", 3), ("elk", 4)

  hash("cat") % 8 = 3 → slot 3 empty → place here
  [__] [__] [__] [cat:1] [__] [__] [__] [__]
                    3

  hash("dog") % 8 = 5 → slot 5 empty → place here
  [__] [__] [__] [cat:1] [__] [dog:2] [__] [__]
                    3             5

  hash("ant") % 8 = 3 → slot 3 occupied!
    Try slot 4 → empty → place here
  [__] [__] [__] [cat:1] [ant:3] [dog:2] [__] [__]
                    3       4       5

  hash("elk") % 8 = 4 → slot 4 occupied!
    Try slot 5 → occupied!
    Try slot 6 → empty → place here
  [__] [__] [__] [cat:1] [ant:3] [dog:2] [elk:4] [__]
                    3       4       5       6

  PROBING SEQUENCE for index i:
  Try i, i+1, i+2, i+3, ... (all mod m)

  Problem: CLUSTERING
  Occupied slots clump together, making future probes longer.
  Slots 3-6 form a cluster. Any key hashing to 3, 4, 5, or 6
  must probe past the entire cluster.
```

#### Quadratic Probing

Instead of trying consecutive slots, try slots at quadratically
increasing distances: `i, i+1, i+4, i+9, i+16, ...`

```
  QUADRATIC PROBING

  Probing sequence for index i:
  Try i, i+1², i+2², i+3², ... (all mod m)
  =   i, i+1,  i+4,  i+9, ...

  hash("ant") % 8 = 3 → slot 3 occupied!
    Try 3 + 1  = 4 → occupied!
    Try 3 + 4  = 7 → empty → place here

  Advantage: Breaks up the linear clusters
  Disadvantage: Can miss empty slots if table is >50% full
                (guaranteed to find a slot if m is prime
                 and load factor < 0.5)
```

#### Comparison

```
  LINEAR vs QUADRATIC PROBING

  Linear:    i, i+1, i+2, i+3, i+4, ...
  Quadratic: i, i+1, i+4, i+9, i+16, ...

  ┌─────────────────┬──────────────┬──────────────────┐
  │                  │ Linear       │ Quadratic        │
  ├─────────────────┼──────────────┼──────────────────┤
  │ Clustering       │ Primary      │ Secondary        │
  │                  │ (bad)        │ (less severe)    │
  │ Cache perf.      │ Excellent    │ Good             │
  │ Implementation   │ Simple       │ Moderate         │
  │ Guaranteed find  │ Always       │ If m prime &     │
  │                  │ (if space)   │ load < 0.5       │
  └─────────────────┴──────────────┴──────────────────┘

  In practice, linear probing with a good hash function
  and low load factor performs extremely well due to
  CPU cache locality.
```

---

## Load Factor and Rehashing

The **load factor** α = n/m (number of entries / table size)
measures how full the table is. As α increases, collisions
become more frequent and performance degrades:

```
  LOAD FACTOR AND PERFORMANCE

  α (load factor)  │ Avg. probes (linear)  │ Avg. probes (chaining)
  ─────────────────┼───────────────────────┼───────────────────────
  0.25             │ ~1.17                 │ ~1.25
  0.50             │ ~1.50                 │ ~1.50
  0.75             │ ~2.50                 │ ~1.75
  0.90             │ ~5.50                 │ ~1.90
  0.99             │ ~50.5                 │ ~1.99

  Linear probing degrades sharply above α = 0.75.
  Chaining degrades more gracefully.

  Common thresholds:
  • Open addressing: rehash when α > 0.5 to 0.75
  • Separate chaining: rehash when α > 1.0 to 2.0
```

### Rehashing: Growing the Table

When the load factor exceeds the threshold, we **rehash**:

1. Allocate a new array (typically 2× the old size)
2. Recompute `hash(key) % new_size` for every entry
3. Insert each entry into the new array

```
  REHASHING — STEP BY STEP

  Old table (size 4, α = 3/4 = 0.75 → threshold hit):
  [__] [elk:4] [cat:1] [ant:3]
    0     1       2       3

  New table (size 8):
  Recompute all hashes with % 8 instead of % 4:

  hash("cat") % 8 = 3  → slot 3
  hash("elk") % 8 = 1  → slot 1
  hash("ant") % 8 = 3  → slot 3 occupied! probe → slot 4

  [__] [elk:4] [__] [cat:1] [ant:3] [__] [__] [__]
    0     1      2     3       4      5    6    7

  Rehashing is O(n) — we must move every entry.
  But it happens rarely (only when the table doubles).
```

---

## Amortized O(1) Analysis

Individual operations are O(1) on average, but rehashing is
O(n). How can we claim O(1)?

The same argument as dynamic arrays: rehashing doubles the table,
so it happens after n insertions. The cost of rehashing (O(n)) is
spread across those n insertions:

```
  AMORTIZED ANALYSIS

  Start with table size 1. Rehash at load factor 1.0.

  Insert #  │ Cost (1 for insert + n for rehash if triggered)
  ──────────┼────────────────────────────────────────────────
  1         │ 1 + 1 (rehash: copy 1 item to size 2)  = 2
  2         │ 1 + 2 (rehash: copy 2 items to size 4) = 3
  3         │ 1                                       = 1
  4         │ 1 + 4 (rehash: copy 4 items to size 8) = 5
  5         │ 1                                       = 1
  6         │ 1                                       = 1
  7         │ 1                                       = 1
  8         │ 1 + 8 (rehash: copy 8 to size 16)      = 9
  ──────────┼────────────────────────────────────────────────
  Total     │ 2 + 3 + 1 + 5 + 1 + 1 + 1 + 9 = 23
  Average   │ 23 / 8 ≈ 2.9 → O(1) per insert

  In general: total rehash cost = 1 + 2 + 4 + 8 + ... + n
            = 2n - 1 = O(n)
  Spread over n inserts → O(n)/n = O(1) amortized per insert.

  Lookups and deletes don't trigger rehashing → O(1) average
  (assuming a good hash function and reasonable load factor).
```

---

## Operation Complexity Summary

```
┌──────────────────────┬──────────────┬──────────────┬──────────────┐
│ Operation            │ Average      │ Worst Case   │ Amortized    │
├──────────────────────┼──────────────┼──────────────┼──────────────┤
│ insert(key, value)   │ O(1)         │ O(n)         │ O(1)         │
│ lookup(key)          │ O(1)         │ O(n)         │ —            │
│ delete(key)          │ O(1)         │ O(n)         │ —            │
│ rehash               │ O(n)         │ O(n)         │ O(1)/insert  │
├──────────────────────┼──────────────┼──────────────┼──────────────┤
│ Space                │ O(n)         │ O(n)         │              │
└──────────────────────┴──────────────┴──────────────┴──────────────┘

Worst case O(n) happens when ALL keys hash to the same slot.
With a good hash function, this is astronomically unlikely.
```

---

## Technical Deep-Dive: Implementing Hash Tables

### Python

```python
# Python — hash table with separate chaining
class HashTable:
    def __init__(self, capacity: int = 8):
        self._capacity = capacity
        self._size = 0
        self._buckets: list[list[tuple]] = [[] for _ in range(capacity)]
        self._load_threshold = 0.75

    def _hash(self, key) -> int:
        """Use Python's built-in hash, then modulo."""
        return hash(key) % self._capacity

    def put(self, key, value):
        """Insert or update a key-value pair — O(1) amortized."""
        if self._size / self._capacity >= self._load_threshold:
            self._rehash()

        idx = self._hash(key)
        bucket = self._buckets[idx]

        # Update existing key
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)
                return

        # Insert new key
        bucket.append((key, value))
        self._size += 1

    def get(self, key, default=None):
        """Lookup a key — O(1) average."""
        idx = self._hash(key)
        for k, v in self._buckets[idx]:
            if k == key:
                return v
        return default

    def delete(self, key) -> bool:
        """Remove a key — O(1) average."""
        idx = self._hash(key)
        bucket = self._buckets[idx]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket.pop(i)
                self._size -= 1
                return True
        return False

    def _rehash(self):
        """Double the table and reinsert all entries."""
        old_buckets = self._buckets
        self._capacity *= 2
        self._buckets = [[] for _ in range(self._capacity)]
        self._size = 0
        for bucket in old_buckets:
            for key, value in bucket:
                self.put(key, value)

    def __len__(self) -> int:
        return self._size

    def __repr__(self) -> str:
        pairs = []
        for bucket in self._buckets:
            for k, v in bucket:
                pairs.append(f"{k!r}: {v!r}")
        return "{" + ", ".join(pairs) + "}"


# Usage
ht = HashTable()
ht.put("cat", 1)
ht.put("dog", 2)
ht.put("ant", 3)
print(ht.get("cat"))    # 1
print(ht.get("dog"))    # 2
ht.put("cat", 99)       # update
print(ht.get("cat"))    # 99
ht.delete("dog")
print(ht.get("dog"))    # None
print(len(ht))          # 2
```

Note: In practice, use Python's built-in `dict` — it's a highly
optimized hash table implemented in C using open addressing with
a custom probing scheme. It handles resizing, hashing, and
collision resolution far more efficiently than any pure-Python
implementation.

```python
# Python's dict IS a hash table
d = {"cat": 1, "dog": 2, "ant": 3}
print(d["cat"])          # 1 — O(1) lookup
d["cat"] = 99            # O(1) update
del d["dog"]             # O(1) delete
print("ant" in d)        # True — O(1) membership test
```

### TypeScript

```typescript
// TypeScript — hash table with separate chaining
class HashTable<K extends string | number, V> {
  private buckets: Array<Array<[K, V]>>;
  private count: number = 0;
  private capacity: number;
  private readonly loadThreshold = 0.75;

  constructor(capacity: number = 8) {
    this.capacity = capacity;
    this.buckets = Array.from({ length: capacity }, () => []);
  }

  private hash(key: K): number {
    // Simple hash for strings and numbers
    const str = String(key);
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0; // |0 keeps it 32-bit int
    }
    return Math.abs(h) % this.capacity;
  }

  put(key: K, value: V): void {
    if (this.count / this.capacity >= this.loadThreshold) {
      this.rehash();
    }

    const idx = this.hash(key);
    const bucket = this.buckets[idx];

    // Update existing key
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket[i] = [key, value];
        return;
      }
    }

    // Insert new key
    bucket.push([key, value]);
    this.count++;
  }

  get(key: K): V | undefined {
    const idx = this.hash(key);
    for (const [k, v] of this.buckets[idx]) {
      if (k === key) return v;
    }
    return undefined;
  }

  delete(key: K): boolean {
    const idx = this.hash(key);
    const bucket = this.buckets[idx];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket.splice(i, 1);
        this.count--;
        return true;
      }
    }
    return false;
  }

  get size(): number {
    return this.count;
  }

  private rehash(): void {
    const oldBuckets = this.buckets;
    this.capacity *= 2;
    this.buckets = Array.from({ length: this.capacity }, () => []);
    this.count = 0;
    for (const bucket of oldBuckets) {
      for (const [key, value] of bucket) {
        this.put(key, value);
      }
    }
  }
}

// Usage
const ht = new HashTable<string, number>();
ht.put("cat", 1);
ht.put("dog", 2);
ht.put("ant", 3);
console.log(ht.get("cat"));    // 1
console.log(ht.get("dog"));    // 2
ht.put("cat", 99);             // update
console.log(ht.get("cat"));    // 99
ht.delete("dog");
console.log(ht.get("dog"));    // undefined
console.log(ht.size);          // 2
```

Note: JavaScript/TypeScript has `Map` for hash table semantics
with any key type, and plain objects `{}` for string keys. `Map`
preserves insertion order and handles non-string keys correctly.

```typescript
// Built-in Map — the standard choice
const m = new Map<string, number>();
m.set("cat", 1);
m.set("dog", 2);
console.log(m.get("cat"));  // 1
m.delete("dog");
console.log(m.has("dog"));  // false
```

### Rust

```rust
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;

// Rust — hash table with separate chaining from scratch
struct HashTable<K: Hash + Eq + Clone, V: Clone> {
    buckets: Vec<Vec<(K, V)>>,
    size: usize,
    capacity: usize,
}

impl<K: Hash + Eq + Clone, V: Clone> HashTable<K, V> {
    fn new(capacity: usize) -> Self {
        HashTable {
            buckets: (0..capacity).map(|_| Vec::new()).collect(),
            size: 0,
            capacity,
        }
    }

    fn hash_key(&self, key: &K) -> usize {
        let mut hasher = DefaultHasher::new();
        key.hash(&mut hasher);
        (hasher.finish() as usize) % self.capacity
    }

    fn put(&mut self, key: K, value: V) {
        if self.size as f64 / self.capacity as f64 >= 0.75 {
            self.rehash();
        }

        let idx = self.hash_key(&key);

        // Update existing key
        for entry in &mut self.buckets[idx] {
            if entry.0 == key {
                entry.1 = value;
                return;
            }
        }

        // Insert new key
        self.buckets[idx].push((key, value));
        self.size += 1;
    }

    fn get(&self, key: &K) -> Option<&V> {
        let idx = self.hash_key(key);
        for (k, v) in &self.buckets[idx] {
            if k == key {
                return Some(v);
            }
        }
        None
    }

    fn delete(&mut self, key: &K) -> bool {
        let idx = self.hash_key(key);
        if let Some(pos) = self.buckets[idx].iter().position(|(k, _)| k == key) {
            self.buckets[idx].swap_remove(pos);
            self.size -= 1;
            return true;
        }
        false
    }

    fn len(&self) -> usize {
        self.size
    }

    fn rehash(&mut self) {
        let new_capacity = self.capacity * 2;
        let mut new_buckets: Vec<Vec<(K, V)>> =
            (0..new_capacity).map(|_| Vec::new()).collect();

        for bucket in self.buckets.drain(..) {
            for (key, value) in bucket {
                let mut hasher = DefaultHasher::new();
                key.hash(&mut hasher);
                let idx = (hasher.finish() as usize) % new_capacity;
                new_buckets[idx].push((key, value));
            }
        }

        self.buckets = new_buckets;
        self.capacity = new_capacity;
    }
}

fn main() {
    // From-scratch hash table
    let mut ht = HashTable::new(8);
    ht.put("cat", 1);
    ht.put("dog", 2);
    ht.put("ant", 3);
    println!("{:?}", ht.get(&"cat"));  // Some(1)
    println!("{:?}", ht.get(&"dog"));  // Some(2)
    ht.put("cat", 99);                 // update
    println!("{:?}", ht.get(&"cat"));  // Some(99)
    ht.delete(&"dog");
    println!("{:?}", ht.get(&"dog"));  // None
    println!("size: {}", ht.len());    // 2

    // Rust's standard library: HashMap
    let mut map = HashMap::new();
    map.insert("cat", 1);
    map.insert("dog", 2);
    println!("{:?}", map.get("cat"));     // Some(1)
    map.remove("dog");
    println!("{}", map.contains_key("dog")); // false
}
```

Note: Rust's `HashMap<K, V>` uses SipHash by default (resistant
to hash-flooding DoS attacks) with Robin Hood hashing (a variant
of open addressing). For performance-critical code where DoS
resistance isn't needed, consider `FxHashMap` from the `rustc-hash`
crate.

---


## What If Our Hash Function Always Returned the Same Value?

This is the nightmare scenario — and understanding it reveals
exactly why good hash functions matter.

If `hash(key)` returns the same number for every key, then
*every* key maps to the same index. The hash table degenerates
into a single linked list (chaining) or a linear scan of the
entire array (open addressing):

```
  THE DEGENERATE HASH TABLE

  hash(key) = 42 for ALL keys (constant hash function)

  With separate chaining:
  Index │ Chain
  ──────┼──────────────────────────────────────────
    0   │ ∅
    1   │ ∅
    2   │ → [A] → [B] → [C] → [D] → [E] → [F]
    3   │ ∅
    4   │ ∅
    ...

  Every operation walks the entire chain:
  • Insert: O(n) — check for duplicates, then append
  • Lookup: O(n) — scan the whole chain
  • Delete: O(n) — find the node, then remove

  We've turned our O(1) hash table into an O(n) linked list!

  With open addressing (linear probing):
  [A] [B] [C] [D] [E] [F] [__] [__]
   ↑ all clustered starting at index 42 % 8 = 2

  Inserting the 7th element probes through ALL existing
  entries before finding an empty slot. O(n) per insert.
```

### Why This Matters: Hash-Flooding Attacks

This isn't just theoretical. In 2011, researchers demonstrated
**hash-flooding attacks** against web frameworks (PHP, Python,
Java, Ruby). An attacker sends HTTP requests with carefully
crafted parameter names that all hash to the same bucket. The
server spends O(n²) time parsing the request instead of O(n),
causing denial of service.

Defenses:
- **Randomized hash functions**: Python 3.3+ randomizes hash
  seeds on startup. Each process uses a different seed, so
  attackers can't predict collisions.
- **SipHash**: Rust's `HashMap` uses SipHash by default — a
  cryptographically-inspired hash function that's fast and
  resistant to hash flooding.
- **Limit input size**: Cap the number of parameters a request
  can contain.

### The Lesson

The difference between O(1) and O(n) for hash tables comes
entirely from the hash function's quality. A perfect hash table
with a terrible hash function is just an expensive linked list.
This is why real-world hash table implementations invest heavily
in good hash functions and randomization.

---

## Exercises

1. **Trace insertions**: Starting with an empty hash table of
   size 7 using separate chaining, insert the keys "apple",
   "banana", "cherry", "date", "elderberry", "fig". Use the hash
   function `h(s) = (sum of ASCII values) % 7`. Draw the table
   after all insertions. What is the load factor?

2. **Linear probing trace**: Starting with an empty table of
   size 8, insert keys with hash values 3, 3, 5, 3, 4, 5 using
   linear probing. Draw the table after each insertion. Identify
   the primary cluster that forms.

3. **Implement open addressing**: Modify the chaining-based hash
   table above to use linear probing instead. Handle deletion
   correctly (hint: you can't just empty the slot — you need
   tombstone markers or backward-shift deletion).

4. **Two Sum**: Given an array of integers and a target sum, find
   two numbers that add up to the target. Implement the O(n)
   hash table solution. For each number `x`, check if
   `target - x` is already in the table.

5. **Load factor experiment**: Insert n random integers into a
   hash table with separate chaining. Measure the average chain
   length at load factors 0.25, 0.5, 0.75, 1.0, 1.5, and 2.0.
   Plot the results. At what load factor does performance become
   noticeably worse?

6. **Collision counting**: Write a program that inserts 1000
   random strings into a hash table of size 1000. Count the
   number of collisions. Repeat with table sizes 500, 750, 1500,
   and 2000. How does table size affect collision rate?

---

**Previous**: [Lesson 06 — Queues, Deques, and Circular Buffers](./06-queues-and-deques.md)
**Next**: [Lesson 08 — Hash Sets, Multisets, and Bloom Filters](./08-hash-sets-and-multisets.md)
