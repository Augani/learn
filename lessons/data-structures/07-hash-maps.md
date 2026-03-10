# Lesson 07: Hash Maps — The Most Important Data Structure

## The Problem

You need to go from **key to value** in constant time. An array can do `index → value` in O(1), but what if your key is a string, a struct, or any non-integer type?

```
Arrays:   index (0, 1, 2, ...) → value     O(1)
HashMap:  ANY hashable key     → value     O(1) average
```

Hash maps are everywhere: database indexes, caches, configuration stores, symbol tables in compilers, DNS resolution, session stores, counting occurrences. If you could only use one data structure, this is the one.

## The Coat Check Analogy

A coat check at a theater:

```
1. You hand over your coat (value) and get a numbered ticket (hash)
2. The attendant hangs your coat on hook #ticket_number
3. When you return, give your ticket → attendant goes directly to that hook

┌─────────────────────────────────────────┐
│                Coat Rack                 │
│  Hook #0   Hook #1   Hook #2   Hook #3  │
│  [empty]   [Alice's] [empty]   [Bob's]  │
│            coat               coat       │
└─────────────────────────────────────────┘

Alice's name → hash("Alice") = 1 → Hook #1
Bob's name   → hash("Bob") = 3   → Hook #3

Retrieval: O(1) — go directly to the hook
```

## How Hash Maps Work

### Step 1: Hash Function

A hash function converts any key into an integer (the hash code):

```
hash("hello")  → 2314539   (some large number)
hash("world")  → 8943021
hash("hello")  → 2314539   (same input ALWAYS gives same output)
```

Properties of a good hash function:
- **Deterministic**: same input → same output, always
- **Uniform distribution**: outputs spread evenly across the range
- **Fast**: computing the hash should be quick
- **Avalanche effect**: small input change → large output change

### Step 2: Map Hash to Array Index

```
index = hash(key) % array_capacity

hash("Alice") = 7429301
capacity = 8
index = 7429301 % 8 = 5

Store Alice's data at slot 5:

Bucket:  [0]    [1]    [2]    [3]    [4]    [5]       [6]    [7]
         empty  empty  empty  empty  empty  Alice's   empty  empty
                                            data
```

### Step 3: Store Key-Value Pair

The slot stores the **full key and value**, not just the value. We need the key to handle collisions and verify lookups:

```
Slot 5: { key: "Alice", value: "alice@email.com" }
```

## Collisions

What happens when two keys hash to the same index?

```
hash("Alice") % 8 = 5
hash("Evelyn") % 8 = 5   ← COLLISION! Both map to slot 5
```

This is inevitable. By the pigeonhole principle, if you have more possible keys than array slots, some keys must share a slot.

### Resolution Strategy 1: Chaining

Each slot holds a linked list (or Vec) of key-value pairs:

```
Chaining:

Bucket:  [0]    [1]    [2]    [3]    [4]    [5]              [6]    [7]
         empty  empty  empty  empty  empty  ┌──────────┐     empty  empty
                                            │ "Alice"  │
                                            │ → email  │
                                            │ ↓        │
                                            │ "Evelyn" │
                                            │ → email  │
                                            └──────────┘

Lookup "Evelyn":
1. hash("Evelyn") % 8 = 5  → go to slot 5
2. Walk the chain: "Alice" ≠ "Evelyn", next → "Evelyn" ✓
3. Return value
```

Average case: O(1) if chains are short (low load factor)
Worst case: O(n) if everything hashes to the same slot (one long chain)

### Resolution Strategy 2: Open Addressing

If the target slot is occupied, **probe** (search) for the next empty slot:

```
Linear probing:

Insert "Alice" → slot 5: ┌────────┐
                          │ Alice  │
                          └────────┘

Insert "Evelyn" → slot 5 occupied → try slot 6:
                                    ┌────────┐
                                    │ Evelyn │
                                    └────────┘

Bucket:  [0]    [1]    [2]    [3]    [4]    [5]     [6]      [7]
         empty  empty  empty  empty  empty  Alice   Evelyn   empty

Lookup "Evelyn":
1. hash("Evelyn") % 8 = 5 → slot 5 has "Alice" ≠ "Evelyn"
2. Probe next → slot 6 has "Evelyn" ✓
3. Return value
```

Open addressing keeps everything in the main array (better cache performance) but can suffer from **clustering** — occupied slots clump together, making probing slower.

Rust's `HashMap` uses a variant called **Swiss table** (Robin Hood hashing with SIMD-accelerated probing), which is one of the fastest hash map implementations.

## Load Factor and Resizing

The **load factor** is the ratio of stored items to total capacity:

```
load_factor = num_items / capacity

Example: 6 items in capacity-8 array → load_factor = 0.75
```

As load factor increases, collisions increase, and performance degrades. Most hash maps resize (double capacity) when load factor exceeds a threshold (typically 0.75):

```
Load Factor vs. Performance:

Load Factor    Avg. probes (open addressing)
   0.25              ~1.2
   0.50              ~1.5
   0.75              ~2.5
   0.90              ~5.5
   0.95              ~10.5
   1.00              ∞ (table full)
```

Resizing requires rehashing every element (because `hash(key) % new_capacity` gives different slots):

```
Before resize (capacity 4, load factor 0.75):
[0: Bob]  [1: empty]  [2: Alice]  [3: Carol]

After resize (capacity 8):
[0: empty] [1: empty] [2: Alice] [3: empty] [4: Bob] [5: empty] [6: Carol] [7: empty]

Every key rehashed: hash(key) % 8 gives new positions
```

## Why Iteration Order Is Random

Hash map iteration visits slots in array order (0, 1, 2, ...), not insertion order:

```
Insertion order: "Carol", "Alice", "Bob"

Internal array after hashing:
[0: Bob]  [1: empty]  [2: Alice]  [3: Carol]

Iteration order: Bob, Alice, Carol (array order, not insertion order)
```

Additionally, after a resize, the order changes completely. Never depend on hash map iteration order.

## Choosing Good Hash Functions

A bad hash function creates many collisions:

```
BAD: hash(name) = name.len()
  "Bob" → 3, "Amy" → 3, "Eve" → 3   ← all collide!

BAD: hash(name) = name[0] as u8
  "Alice" → 65, "Adam" → 65          ← all names starting with 'A' collide

GOOD: hash(name) = complex function considering all bytes
  "Alice" → 7429301, "Adam" → 1893047  ← well distributed
```

Rust uses **SipHash** by default — it's designed to be resistant to hash-flooding attacks (where an attacker crafts inputs that all collide). For performance-critical code where you control the inputs, you can use faster hash functions like `FxHashMap` from the `rustc-hash` crate.

## Rust: HashMap

```rust
use std::collections::HashMap;

let mut scores: HashMap<String, i32> = HashMap::new();

scores.insert("Alice".to_string(), 95);
scores.insert("Bob".to_string(), 87);
scores.insert("Carol".to_string(), 92);

let alice_score = scores.get("Alice");     // Some(&95)
let unknown = scores.get("Dave");          // None

scores.remove("Bob");

let has_carol = scores.contains_key("Carol"); // true

for (name, score) in &scores {
    println!("{}: {}", name, score);
}
```

### The Entry API

The Entry API is one of Rust's best HashMap features. It handles the "check if key exists, then insert or update" pattern without double lookup:

```rust
use std::collections::HashMap;

let mut word_count: HashMap<String, usize> = HashMap::new();
let text = "the cat sat on the mat the cat";

for word in text.split_whitespace() {
    *word_count.entry(word.to_string()).or_insert(0) += 1;
}
// {"the": 3, "cat": 2, "sat": 1, "on": 1, "mat": 1}
```

Entry API variants:

```rust
let mut map: HashMap<String, Vec<i32>> = HashMap::new();

map.entry("key".to_string()).or_insert(Vec::new()).push(42);

map.entry("key".to_string()).or_insert_with(Vec::new);

map.entry("key".to_string()).or_default(); // uses Default trait

map.entry("key".to_string())
    .and_modify(|v| v.push(99))
    .or_insert_with(|| vec![42]);
```

### Custom Hash Implementations

To use a custom type as a HashMap key, it must implement `Hash` and `Eq`:

```rust
use std::collections::HashMap;
use std::hash::{Hash, Hasher};

#[derive(Eq, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}

impl Hash for Point {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.x.hash(state);
        self.y.hash(state);
    }
}

let mut grid: HashMap<Point, String> = HashMap::new();
grid.insert(Point { x: 0, y: 0 }, "origin".to_string());
```

Or use `#[derive(Hash)]`:

```rust
#[derive(Hash, Eq, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}
```

**Critical rule**: if `a == b`, then `hash(a) == hash(b)`. The reverse is not required (collisions are allowed). If you violate this, HashMap will lose data.

## Complexity Summary

| Operation | Average | Worst Case |
|-----------|---------|------------|
| get | O(1) | O(n) |
| insert | O(1) | O(n) |
| remove | O(1) | O(n) |
| contains_key | O(1) | O(n) |
| iteration | O(n) | O(n) |

Worst case happens with pathological hash collisions (all keys map to same slot). With a good hash function, this is extremely rare.

## Cross-Language Comparison

| Feature | Rust | Go | TypeScript |
|---------|------|-----|------------|
| Type | `HashMap<K,V>` | `map[K]V` | `Map<K,V>` or `{}` |
| Missing key | `get()` returns `Option` | returns zero value | `get()` returns `undefined` |
| Check existence | `.contains_key(&k)` | `_, ok := m[k]` | `.has(k)` |
| Delete | `.remove(&k)` | `delete(m, k)` | `.delete(k)` |
| Iteration order | Random | Random | Insertion order (Map) |
| Upsert pattern | Entry API | Manual check | Manual check |

Go's trap: accessing a missing key returns the zero value (0, "", nil, false) silently. Always use the two-value form: `v, ok := m[k]`.

TypeScript's `Map` preserves insertion order (unlike Rust/Go). Plain objects `{}` also preserve insertion order in modern JS engines, but this is technically implementation-defined for numeric keys.

## Exercises

### Exercise 1: Implement a Hash Map from Scratch

Build a basic hash map using chaining for collision resolution:

```rust
const INITIAL_CAPACITY: usize = 16;
const LOAD_FACTOR_THRESHOLD: f64 = 0.75;

struct Entry {
    key: String,
    value: i32,
}

struct SimpleHashMap {
    buckets: Vec<Vec<Entry>>,
    len: usize,
}

impl SimpleHashMap {
    fn new() -> Self { /* ... */ }
    fn insert(&mut self, key: String, value: i32) -> Option<i32> { /* ... */ }
    fn get(&self, key: &str) -> Option<&i32> { /* ... */ }
    fn remove(&mut self, key: &str) -> Option<i32> { /* ... */ }
    fn len(&self) -> usize { /* ... */ }
    fn contains_key(&self, key: &str) -> bool { /* ... */ }
}
```

Requirements:
- Use a simple hash function (sum of byte values, or use `std::hash`)
- Implement chaining with `Vec<Vec<Entry>>`
- Resize (double capacity) when load factor exceeds 0.75
- Handle key updates (inserting a key that already exists replaces the value)

### Exercise 2: Word Frequency Counter

Using `HashMap`, write a program that:
1. Reads a text string
2. Counts the frequency of each word (case-insensitive)
3. Prints the top 10 most frequent words

```rust
use std::collections::HashMap;

fn word_frequencies(text: &str) -> Vec<(String, usize)> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    // Use the entry API
    // Convert to lowercase
    // Sort by frequency descending
    // Return top 10
    todo!()
}
```

### Exercise 3: Two-Sum Problem

Given an array of integers and a target sum, find two numbers that add up to the target. Use a HashMap for O(n) solution:

```rust
fn two_sum(nums: &[i32], target: i32) -> Option<(usize, usize)> {
    // For each number, check if (target - number) exists in the map
    // HashMap<value, index>
    todo!()
}

// two_sum(&[2, 7, 11, 15], 9) → Some((0, 1)) because 2 + 7 = 9
```

---

Next: [Lesson 08: Hash Sets and Bloom Filters](./08-hash-sets-bloom.md)
