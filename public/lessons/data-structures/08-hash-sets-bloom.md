# Lesson 08: Hash Sets and Bloom Filters

## HashSet: Membership Without Values

A `HashSet` is a `HashMap` where you only care about the **keys** — there are no values. It answers one question: **"Is this element in the set?"**

```
HashMap:  key → value     "Is Alice enrolled?" → Yes, her data is {...}
HashSet:  key → (exists)  "Is Alice enrolled?" → Yes (or No)
```

Internally, Rust's `HashSet<T>` is literally `HashMap<T, ()>` — a hash map with unit type as the value.

```
HashSet internal storage:

┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐
│ empty │  │"Alice"│  │ empty │  │ "Bob" │  │"Carol"│
└───────┘  └───────┘  └───────┘  └───────┘  └───────┘
  slot 0     slot 1     slot 2     slot 3     slot 4

contains("Alice") → hash("Alice") % 5 = 1 → slot 1 → ✓ found
contains("Dave")  → hash("Dave") % 5 = 2  → slot 2 → ✗ empty
```

## HashSet Operations

```rust
use std::collections::HashSet;

let mut seen: HashSet<String> = HashSet::new();

seen.insert("Alice".to_string());   // true (was new)
seen.insert("Bob".to_string());     // true
seen.insert("Alice".to_string());   // false (already exists)

seen.contains("Alice");             // true
seen.contains("Dave");              // false

seen.remove("Bob");                 // true (was present)
seen.remove("Eve");                 // false (wasn't present)

seen.len();                         // 1
```

All operations are O(1) average, same as HashMap.

## Set Operations: Union, Intersection, Difference

Sets support mathematical set operations:

```rust
use std::collections::HashSet;

let a: HashSet<i32> = [1, 2, 3, 4, 5].into_iter().collect();
let b: HashSet<i32> = [3, 4, 5, 6, 7].into_iter().collect();

let union: HashSet<&i32> = a.union(&b).collect();
// {1, 2, 3, 4, 5, 6, 7}

let intersection: HashSet<&i32> = a.intersection(&b).collect();
// {3, 4, 5}

let difference: HashSet<&i32> = a.difference(&b).collect();
// {1, 2}  — in a but not in b

let symmetric_diff: HashSet<&i32> = a.symmetric_difference(&b).collect();
// {1, 2, 6, 7}  — in a or b but not both

let is_subset = a.is_subset(&b);    // false
let is_disjoint = a.is_disjoint(&b); // false (they share 3,4,5)
```

```
Venn Diagram:

        Set A                Set B
    ┌───────────┐       ┌───────────┐
    │           │       │           │
    │  1, 2     │ 3,4,5 │    6, 7   │
    │           │       │           │
    └───────────┘       └───────────┘

    A ∪ B (union):         {1, 2, 3, 4, 5, 6, 7}
    A ∩ B (intersection):  {3, 4, 5}
    A - B (difference):    {1, 2}
    A △ B (sym. diff):     {1, 2, 6, 7}
```

## Common Use Cases

### Deduplication

```rust
fn deduplicate(data: &[i32]) -> Vec<i32> {
    let mut seen = HashSet::new();
    data.iter()
        .filter(|&&x| seen.insert(x))
        .copied()
        .collect()
}

let items = vec![3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
let unique = deduplicate(&items);
// [3, 1, 4, 5, 9, 2, 6] — order preserved, duplicates removed
```

### Fast Membership Checks

```rust
let banned_ips: HashSet<String> = load_banned_ips();

fn is_allowed(ip: &str, banned: &HashSet<String>) -> bool {
    !banned.contains(ip)  // O(1) check instead of O(n) list scan
}
```

### Finding Common/Unique Elements

```rust
fn find_common_tags(user_a_tags: &[String], user_b_tags: &[String]) -> Vec<String> {
    let set_a: HashSet<&String> = user_a_tags.iter().collect();
    user_b_tags.iter()
        .filter(|tag| set_a.contains(tag))
        .cloned()
        .collect()
}
```

## BTreeSet: Sorted HashSet Alternative

When you need a sorted set, use `BTreeSet`:

```rust
use std::collections::BTreeSet;

let mut sorted_set: BTreeSet<i32> = BTreeSet::new();
sorted_set.insert(5);
sorted_set.insert(1);
sorted_set.insert(3);

for &val in &sorted_set {
    println!("{}", val); // prints 1, 3, 5 (sorted order)
}

let range: Vec<&i32> = sorted_set.range(2..=5).collect();
// [3, 5] — range queries!
```

| | HashSet | BTreeSet |
|---|---|---|
| insert/contains/remove | O(1) avg | O(log n) |
| Iteration order | Random | Sorted |
| Range queries | No | Yes |
| Memory | Hash table overhead | Tree node overhead |

## Bloom Filters: Probabilistic Membership

### The Bouncer Analogy

Imagine a nightclub bouncer with an imperfect memory:

```
Guest arrives: "Is Alex on the list?"

If the bouncer says "NO" → Alex is DEFINITELY NOT on the list (100% certain)
If the bouncer says "YES" → Alex is PROBABLY on the list (could be wrong)
```

A Bloom filter gives you:
- **No false negatives**: if it says "not in set", it's guaranteed correct
- **Possible false positives**: if it says "maybe in set", it might be wrong
- **No deletion**: you can add elements but can't remove them (standard variant)
- **Extremely space-efficient**: uses a fraction of the memory of a HashSet

### How Bloom Filters Work

A Bloom filter is a **bit array** + **multiple hash functions**:

```
Bit array (m = 16 bits, initially all 0):
Position:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
Bits:     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

Using k = 3 hash functions:

Insert "Alice":
  hash1("Alice") % 16 = 3   → set bit 3
  hash2("Alice") % 16 = 7   → set bit 7
  hash3("Alice") % 16 = 11  → set bit 11

Position:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
Bits:     [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]

Insert "Bob":
  hash1("Bob") % 16 = 1   → set bit 1
  hash2("Bob") % 16 = 5   → set bit 5
  hash3("Bob") % 16 = 11  → set bit 11 (already set — that's fine)

Position:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
Bits:     [0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]


Check "Alice":
  hash1("Alice") % 16 = 3  → bit 3 = 1 ✓
  hash2("Alice") % 16 = 7  → bit 7 = 1 ✓
  hash3("Alice") % 16 = 11 → bit 11 = 1 ✓
  All bits set → "PROBABLY in set" ✓ (correct)

Check "Carol":
  hash1("Carol") % 16 = 3  → bit 3 = 1 ✓
  hash2("Carol") % 16 = 9  → bit 9 = 0 ✗
  At least one bit is 0 → "DEFINITELY NOT in set" ✓ (correct)

Check "Dave":
  hash1("Dave") % 16 = 1  → bit 1 = 1 ✓
  hash2("Dave") % 16 = 3  → bit 3 = 1 ✓
  hash3("Dave") % 16 = 7  → bit 7 = 1 ✓
  All bits set → "PROBABLY in set" ✗ (FALSE POSITIVE! Dave was never added)
  These bits were set by Alice and Bob coincidentally
```

### False Positive Rate

The false positive probability depends on:
- **m**: number of bits in the array
- **n**: number of elements inserted
- **k**: number of hash functions

```
Formula: P(false positive) ≈ (1 - e^(-kn/m))^k

Optimal k = (m/n) * ln(2)

Example: m = 1,000,000 bits (~122 KB), n = 100,000 elements, k = 7
  False positive rate ≈ 0.8% (less than 1%)

Compare with HashSet for 100,000 strings averaging 20 bytes:
  HashSet: ~2 MB + overhead
  Bloom filter: ~122 KB

The Bloom filter uses ~16x less memory with 99.2% accuracy.
```

### Bloom Filter Use Cases

**1. Spell Checker Pre-filter**
```
User types a word → check Bloom filter
  "definitely not in dictionary" → underline as misspelled (no further lookup)
  "probably in dictionary" → check the actual dictionary (expensive lookup)

Saves expensive dictionary lookups for most misspelled words.
```

**2. Database Query Optimization**
```
Query: SELECT * FROM users WHERE email = 'alice@example.com'

Without Bloom filter:
  Check disk → expensive I/O for every query

With Bloom filter:
  Check Bloom filter (in memory, fast):
    "definitely not here" → skip disk read entirely
    "probably here" → check disk
```

**3. Web Crawler Deduplication**
```
Bloom filter tracks visited URLs (billions of URLs, memory is precious)
  "Have we visited this URL?" → probably yes → skip
  "Have we visited this URL?" → definitely no → crawl it
```

**4. Network Security**
```
Bloom filter of known malicious domains:
  "Is this domain malicious?" → definitely no → allow
  "Is this domain malicious?" → probably yes → do full check
```

## Implementation

```rust
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

struct BloomFilter {
    bits: Vec<bool>,
    num_hashes: usize,
    size: usize,
}

impl BloomFilter {
    fn new(size: usize, num_hashes: usize) -> Self {
        Self {
            bits: vec![false; size],
            num_hashes,
            size,
        }
    }

    fn hash_at(&self, item: &str, seed: usize) -> usize {
        let mut hasher = DefaultHasher::new();
        item.hash(&mut hasher);
        seed.hash(&mut hasher);
        hasher.finish() as usize % self.size
    }

    fn insert(&mut self, item: &str) {
        for i in 0..self.num_hashes {
            let idx = self.hash_at(item, i);
            self.bits[idx] = true;
        }
    }

    fn might_contain(&self, item: &str) -> bool {
        (0..self.num_hashes).all(|i| {
            let idx = self.hash_at(item, i);
            self.bits[idx]
        })
    }
}
```

## Cross-Language Comparison

| Concept | Rust | Go | TypeScript |
|---------|------|-----|------------|
| Hash set | `HashSet<T>` | `map[T]struct{}` | `Set<T>` |
| Sorted set | `BTreeSet<T>` | — | — |
| Bloom filter | `bloom` crate | `bloom` package | `bloom-filters` npm |
| Set operations | `.union()`, `.intersection()` | Manual loops | Proposed `Set.union()` |

Go doesn't have a built-in set type. The idiomatic approach is `map[T]struct{}` which uses zero bytes per value (empty struct).

## Exercises

### Exercise 1: Implement a Bloom Filter

Build a Bloom filter with configurable size and number of hash functions:

```rust
struct BloomFilter {
    bits: Vec<bool>,
    num_hashes: usize,
    size: usize,
}

impl BloomFilter {
    fn new(expected_items: usize, false_positive_rate: f64) -> Self {
        // Calculate optimal size and number of hash functions
        // m = -n * ln(p) / (ln(2))^2
        // k = (m / n) * ln(2)
        todo!()
    }

    fn insert(&mut self, item: &str) { /* ... */ }
    fn might_contain(&self, item: &str) -> bool { /* ... */ }
}
```

Test it:
1. Insert 10,000 items
2. Check 10,000 items that were inserted (all should return true)
3. Check 10,000 items that were NOT inserted
4. Measure the false positive rate — does it match the theoretical prediction?

### Exercise 2: Set Operations from Scratch

Implement set operations without using Rust's built-in methods:

```rust
fn union(a: &HashSet<i32>, b: &HashSet<i32>) -> HashSet<i32> {
    todo!()
}

fn intersection(a: &HashSet<i32>, b: &HashSet<i32>) -> HashSet<i32> {
    todo!()
}

fn difference(a: &HashSet<i32>, b: &HashSet<i32>) -> HashSet<i32> {
    todo!()
}

fn is_subset(a: &HashSet<i32>, b: &HashSet<i32>) -> bool {
    todo!()
}
```

Optimization hint: for intersection, iterate over the **smaller** set and check the larger one.

### Exercise 3: URL Deduplicator with Bloom Filter

Build a web crawler URL tracker that uses a Bloom filter for fast "already visited" checks, with a HashSet as backup for confirmed URLs:

```rust
struct UrlTracker {
    bloom: BloomFilter,
    confirmed: HashSet<String>,
}

impl UrlTracker {
    fn should_visit(&mut self, url: &str) -> bool {
        if self.bloom.might_contain(url) {
            // Could be false positive — check confirmed set
            return !self.confirmed.contains(url);
        }
        true // definitely not seen
    }

    fn mark_visited(&mut self, url: &str) {
        self.bloom.insert(url);
        self.confirmed.insert(url.to_string());
    }
}
```

Benchmark memory usage of Bloom filter vs HashSet alone for 1 million URLs.

---

Next: [Lesson 09: Binary Trees and BSTs](./09-binary-trees.md)
