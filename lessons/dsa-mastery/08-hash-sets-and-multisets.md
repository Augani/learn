# Lesson 08: Hash Sets, Multisets, and Bloom Filters

> **Analogy**: You're throwing a party. The **guest list** is a
> set — each name appears exactly once, and all you care about
> is "are they invited or not?" You don't need to know anything
> else about them, just membership. Now imagine you're also
> running a **door counter** — every time someone walks in, you
> tick their name. Alice arrived three times (she kept going
> back to her car). That counter is a multiset — it tracks not
> just *who* showed up, but *how many times*. Finally, imagine
> the bouncer has a quick cheat sheet that *might* say someone
> is on the list when they're not, but *never* misses someone
> who actually is. That's a Bloom filter — a probabilistic
> guest list that trades perfect accuracy for incredible speed
> and tiny memory.

---

## Why This Matters

Sets and multisets are everywhere in real software:

- **Deduplication**: Removing duplicate URLs from a web crawler,
  duplicate emails from a mailing list, or duplicate log entries.
- **Membership testing**: "Has this user already voted?" "Is this
  IP address in the blocklist?" "Have we seen this transaction
  ID before?"
- **Counting**: Word frequency in documents, vote tallies, page
  view counters, inventory tracking — all multiset operations.
- **Set algebra**: Finding common friends (intersection), merging
  permission sets (union), computing what changed between two
  versions (symmetric difference).
- **Bloom filters**: Used by databases (Cassandra, HBase, LevelDB)
  to avoid expensive disk reads, by web browsers to check URLs
  against malware lists, by spell checkers, and by network routers
  for packet classification. They save enormous amounts of memory
  when you need fast "probably yes / definitely no" answers.

Understanding when to use a set vs a map, and when a Bloom filter
is the right trade-off, is a skill that separates good engineers
from great ones.

By the end of this lesson, you'll understand:

- How hash sets work internally (it's simpler than you think)
- Set operations: union, intersection, difference, symmetric
  difference — and their complexities
- When to use a set vs a map
- What multisets/counters are and when they're useful
- How Bloom filters work and why they have false positives but
  never false negatives
- When a Bloom filter is the right choice

> **Cross-reference**: The existing data structures track covers
> hash sets and Bloom filters from a Rust-focused perspective.
> See [Hash Sets & Bloom Filters](../data-structures/08-hash-sets-bloom.md)
> for a complementary treatment.

---

## Sets vs Maps: When Do You Need a Value?

A hash map stores key-value pairs. A hash set stores only keys.
That's the entire difference. Internally, a hash set is just a
hash map where the value is either absent or a dummy placeholder.

```
  SET vs MAP — WHEN TO USE WHICH

  Use a SET when you only care about:        Use a MAP when you need:
  ┌──────────────────────────────────┐       ┌──────────────────────────────────┐
  │ • Is this element present?       │       │ • What value is associated with  │
  │ • Add/remove elements            │       │   this key?                      │
  │ • Union, intersection, diff      │       │ • Store key-value pairs          │
  │                                  │       │ • Look up data by key            │
  │ Examples:                        │       │                                  │
  │ • Visited URLs                   │       │ Examples:                        │
  │ • Unique words in a document     │       │ • Phone book (name → number)     │
  │ • Blocked IP addresses           │       │ • Config settings (key → value)  │
  │ • Friends of a user              │       │ • Cache (URL → response)         │
  └──────────────────────────────────┘       └──────────────────────────────────┘

  Rule of thumb:
  • Need to associate data with each key? → Map
  • Just need to know "is it in there?"  → Set
  • Need to count occurrences?           → Multiset (or Map<key, count>)
```

---

## Hash Set Implementation

A hash set is a hash table that stores only keys. Under the hood,
most languages implement sets as hash maps with dummy values:

- Python's `set` is backed by the same hash table as `dict`, but
  stores only keys (values are `None` internally).
- Java's `HashSet` is literally a `HashMap<K, Object>` where
  every value is the same dummy `PRESENT` object.
- Rust's `HashSet<T>` is a thin wrapper around `HashMap<T, ()>`.

```
  HASH SET INTERNALS

  A set containing {"cat", "dog", "ant"}:

  Index │ Entry
  ──────┼──────────────
    0   │ ∅
    1   │ "ant"
    2   │ ∅
    3   │ "cat"
    4   │ ∅
    5   │ "dog"
    6   │ ∅
    7   │ ∅

  Operations:
  • add("cat")      → hash("cat") % 8 = 3, slot 3 → already there, no-op
  • contains("fox") → hash("fox") % 8 = 6, slot 6 → empty → false
  • remove("dog")   → hash("dog") % 8 = 5, slot 5 → found, remove

  Same collision resolution as hash tables (chaining or probing).
  Same amortized O(1) for add, contains, remove.
```

---

## Set Operations: Union, Intersection, Difference

Sets support powerful algebraic operations. These are the
building blocks for solving many real-world problems.

```
  SET OPERATIONS — VISUAL

  A = {1, 2, 3, 4, 5}
  B = {3, 4, 5, 6, 7}

  UNION (A ∪ B) — "everything in either set"
  {1, 2, 3, 4, 5, 6, 7}

  ┌─────────────────────────────┐
  │  A          ┌───────────┐   │
  │  ┌──────────┤ 3  4  5   │   │
  │  │ 1  2     │           │ B │
  │  └──────────┤           │   │
  │             │     6  7  │   │
  │             └───────────┘   │
  └─────────────────────────────┘
  Everything shaded = union

  INTERSECTION (A ∩ B) — "only what's in both"
  {3, 4, 5}

  DIFFERENCE (A - B) — "in A but not in B"
  {1, 2}

  SYMMETRIC DIFFERENCE (A △ B) — "in one but not both"
  {1, 2, 6, 7}
```

### Complexity of Set Operations

```
┌──────────────────────────┬──────────────────────────────────┐
│ Operation                │ Time Complexity                  │
├──────────────────────────┼──────────────────────────────────┤
│ add(element)             │ O(1) amortized                   │
│ remove(element)          │ O(1) amortized                   │
│ contains(element)        │ O(1) average                     │
│ union(A, B)              │ O(|A| + |B|)                     │
│ intersection(A, B)       │ O(min(|A|, |B|))                 │
│ difference(A - B)        │ O(|A|)                           │
│ symmetric_difference     │ O(|A| + |B|)                     │
│ is_subset(A ⊆ B)         │ O(|A|)                           │
├──────────────────────────┼──────────────────────────────────┤
│ Space                    │ O(n)                             │
└──────────────────────────┴──────────────────────────────────┘

Intersection is O(min(|A|, |B|)) because we iterate the smaller
set and check membership in the larger one — each check is O(1).
```

---

## Multisets (Counters): When Duplicates Matter

A set says "is it present?" A multiset says "how many times is
it present?" A multiset (also called a bag or counter) maps each
element to a count.

```
  SET vs MULTISET

  Input: ["apple", "banana", "apple", "cherry", "banana", "apple"]

  As a SET:                    As a MULTISET:
  {"apple", "banana", "cherry"}    {"apple": 3, "banana": 2, "cherry": 1}

  The set lost the count information.
  The multiset preserved it.
```

### The Party Analogy — Deeper

```
  THE GUEST LIST vs THE DOOR COUNTER

  Guest list (SET):
  ┌──────────────────────────┐
  │ ☑ Alice                  │
  │ ☑ Bob                    │
  │ ☑ Charlie                │
  │ ☐ Dave  (not invited)    │
  └──────────────────────────┘
  Question: "Is Dave invited?" → No

  Door counter (MULTISET):
  ┌──────────────────────────┐
  │ Alice    │ III  (3 times) │
  │ Bob      │ I    (1 time)  │
  │ Charlie  │ II   (2 times) │
  └──────────────────────────┘
  Question: "How many times did Alice enter?" → 3

  The guest list only cares about presence.
  The door counter tracks frequency.
```

### Common Multiset Use Cases

- **Word frequency**: Count how often each word appears in a
  document. The most common operation in natural language
  processing.
- **Inventory**: Track how many of each item are in stock.
- **Vote counting**: Tally votes for each candidate.
- **Anagram detection**: Two strings are anagrams if and only if
  their character multisets are equal.
- **Top-K problems**: Find the K most frequent elements.

---

## Bloom Filters: Probabilistic Membership Testing

A Bloom filter is a space-efficient probabilistic data structure
that answers the question "is this element in the set?" with:

- **"Definitely not in the set"** — always correct
- **"Probably in the set"** — might be wrong (false positive)

It never produces false negatives. If the Bloom filter says "no,"
the element is guaranteed absent. If it says "yes," the element
is *probably* present but might not be.

### Why Would You Accept False Positives?

Because the memory savings are enormous. A Bloom filter can
represent a set of millions of elements in just a few kilobytes,
while a hash set would need megabytes. The trade-off: a small
percentage of "probably yes" answers will be wrong.

```
  BLOOM FILTER vs HASH SET — SPACE COMPARISON

  Storing 1 million URLs:

  Hash set:  ~50-100 MB (stores actual URL strings)
  Bloom filter: ~1.2 MB (at 1% false positive rate)
                ~2.4 MB (at 0.1% false positive rate)

  That's a 40-80x reduction in memory!
```

### How a Bloom Filter Works

A Bloom filter uses:
1. A **bit array** of `m` bits, all initially set to 0
2. `k` independent **hash functions**, each mapping an element
   to one of the `m` bit positions

```
  BLOOM FILTER — STRUCTURE

  Bit array (m = 16 bits), k = 3 hash functions: h1, h2, h3

  Initial state (all zeros):
  Index:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  Bits: [ 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0 ]
```

**Inserting an element**: Compute all `k` hash functions and set
those bit positions to 1.

```
  INSERT "cat":
  h1("cat") % 16 = 2
  h2("cat") % 16 = 7
  h3("cat") % 16 = 13

  Index:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  Bits: [ 0  0  1  0  0  0  0  1  0  0  0  0  0  1  0  0 ]
                ↑              ↑                 ↑
              h1=2           h2=7             h3=13

  INSERT "dog":
  h1("dog") % 16 = 4
  h2("dog") % 16 = 7     ← same bit as h2("cat")!
  h3("dog") % 16 = 11

  Index:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  Bits: [ 0  0  1  0  1  0  0  1  0  0  0  1  0  1  0  0 ]
                ↑     ↑        ↑        ↑     ↑
              cat   dog    cat+dog    dog    cat
```

**Querying an element**: Compute all `k` hash functions and check
if ALL those bit positions are 1.

```
  QUERY "cat": check positions 2, 7, 13
  Bits[2]=1, Bits[7]=1, Bits[13]=1 → ALL set → "probably yes" ✓

  QUERY "fox": check positions 1, 7, 14
  Bits[1]=0 → NOT all set → "definitely no" ✗

  QUERY "elk": check positions 4, 11, 13
  Bits[4]=1, Bits[11]=1, Bits[13]=1 → ALL set → "probably yes"
  But we never inserted "elk"! This is a FALSE POSITIVE.
  The bits were set by "cat" and "dog" coincidentally.
```

### Why No False Negatives?

When we insert an element, we set its `k` bit positions to 1.
Bits are never set back to 0. So if an element was inserted, its
bits are guaranteed to still be 1 when we query. The filter can
never say "no" for something that was actually added.

### Why False Positives?

Different elements can set overlapping bits. As more elements are
inserted, more bits become 1. Eventually, a query for a
never-inserted element might find all its bit positions already
set by other elements — a false positive.

```
  FALSE POSITIVE RATE vs FILL RATIO

  As the bit array fills up, false positives increase:

  Fill ratio │ Approx. false positive rate (k=3)
  ───────────┼──────────────────────────────────
  10%        │ 0.1%
  25%        │ 1.6%
  50%        │ 12.5%
  75%        │ 42.2%
  90%        │ 72.9%

  Rule of thumb: keep the bit array less than 50% full.
```

### Optimal Parameters

For `n` elements and a desired false positive rate `p`:

- Optimal bit array size: `m = -(n × ln(p)) / (ln(2))²`
- Optimal number of hash functions: `k = (m/n) × ln(2)`

```
  PARAMETER EXAMPLES

  n = 1,000,000 elements, p = 1% false positive rate:
  m ≈ 9,585,059 bits ≈ 1.14 MB
  k ≈ 7 hash functions

  n = 1,000,000 elements, p = 0.1% false positive rate:
  m ≈ 14,377,588 bits ≈ 1.71 MB
  k ≈ 10 hash functions

  Compare: storing 1M URLs as strings ≈ 50-100 MB
```

### Bloom Filter Limitations

- **No deletion**: Setting a bit to 0 would affect other elements
  that share that bit. (Counting Bloom filters solve this by
  using counters instead of bits, at the cost of more memory.)
- **No enumeration**: You can't list the elements in a Bloom
  filter. It only answers membership queries.
- **False positive rate grows**: As you add more elements, the
  false positive rate increases. You can't resize a Bloom filter
  without rebuilding it.

---

## Technical Deep-Dive: Implementing Sets, Multisets, and Bloom Filters

### Python

```python
# Python — hash set operations
# Python's built-in set is a highly optimized hash set

a = {1, 2, 3, 4, 5}
b = {3, 4, 5, 6, 7}

# Core operations — all O(1) average
a.add(8)            # Add element
a.remove(8)         # Remove (raises KeyError if missing)
a.discard(99)       # Remove (no error if missing)
print(3 in a)       # Membership test → True

# Set algebra
print(a | b)        # Union:        {1, 2, 3, 4, 5, 6, 7}
print(a & b)        # Intersection: {3, 4, 5}
print(a - b)        # Difference:   {1, 2}
print(a ^ b)        # Symmetric diff: {1, 2, 6, 7}
print(a <= b)       # Subset test:  False
print({3, 4} <= a)  # Subset test:  True


# Python — multiset using collections.Counter
from collections import Counter

words = ["apple", "banana", "apple", "cherry", "banana", "apple"]
counter = Counter(words)
print(counter)
# Counter({'apple': 3, 'banana': 2, 'cherry': 1})

# Counter operations
counter["apple"] += 1       # Increment count
print(counter["apple"])     # 4
print(counter["grape"])     # 0 (missing keys return 0, not KeyError)
print(counter.most_common(2))  # [('apple', 4), ('banana', 2)]

# Counter arithmetic
c1 = Counter(a=3, b=1)
c2 = Counter(a=1, b=2)
print(c1 + c2)   # Counter({'a': 4, 'b': 3})
print(c1 - c2)   # Counter({'a': 2})  — drops zero/negative
print(c1 & c2)   # Counter({'a': 1, 'b': 1})  — min of each
print(c1 | c2)   # Counter({'a': 3, 'b': 2})  — max of each

# Anagram detection using Counter
def are_anagrams(s1: str, s2: str) -> bool:
    """Two strings are anagrams iff their character counters match."""
    return Counter(s1) == Counter(s2)

print(are_anagrams("listen", "silent"))  # True
print(are_anagrams("hello", "world"))    # False


# Python — simple Bloom filter implementation
import hashlib
import math

class BloomFilter:
    def __init__(self, expected_items: int, fp_rate: float = 0.01):
        """Create a Bloom filter sized for expected_items with fp_rate."""
        # Calculate optimal size and hash count
        self.size = self._optimal_size(expected_items, fp_rate)
        self.hash_count = self._optimal_hashes(self.size, expected_items)
        self.bit_array = [False] * self.size
        self.count = 0

    def add(self, item: str) -> None:
        """Add an item to the Bloom filter."""
        for i in range(self.hash_count):
            idx = self._hash(item, i)
            self.bit_array[idx] = True
        self.count += 1

    def might_contain(self, item: str) -> bool:
        """Check if item might be in the set.
        Returns False → definitely not present.
        Returns True  → probably present (may be false positive).
        """
        return all(
            self.bit_array[self._hash(item, i)]
            for i in range(self.hash_count)
        )

    def _hash(self, item: str, seed: int) -> int:
        """Generate the i-th hash for an item."""
        h = hashlib.sha256(f"{seed}:{item}".encode()).hexdigest()
        return int(h, 16) % self.size

    @staticmethod
    def _optimal_size(n: int, p: float) -> int:
        """Optimal bit array size: m = -(n * ln(p)) / (ln(2))^2"""
        return int(-n * math.log(p) / (math.log(2) ** 2))

    @staticmethod
    def _optimal_hashes(m: int, n: int) -> int:
        """Optimal hash count: k = (m/n) * ln(2)"""
        return max(1, int((m / n) * math.log(2)))


# Usage
bf = BloomFilter(expected_items=1000, fp_rate=0.01)
bf.add("cat")
bf.add("dog")
bf.add("elephant")

print(bf.might_contain("cat"))       # True  (correct)
print(bf.might_contain("dog"))       # True  (correct)
print(bf.might_contain("fox"))       # False (correct — definitely not)
print(bf.might_contain("unicorn"))   # False (probably — could be True)
print(f"Bits: {bf.size}, Hashes: {bf.hash_count}")
```


### TypeScript

```typescript
// TypeScript — hash set operations
// JavaScript/TypeScript's built-in Set is a hash set

const a = new Set([1, 2, 3, 4, 5]);
const b = new Set([3, 4, 5, 6, 7]);

// Core operations — all O(1) average
a.add(8);            // Add element
a.delete(8);         // Remove element (returns true/false)
console.log(a.has(3)); // Membership test → true

// Set algebra — no built-in operators, but easy to implement
function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  const result = new Set<T>();
  for (const item of smaller) {
    if (larger.has(item)) result.add(item);
  }
  return result;
}

function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const item of a) {
    if (!b.has(item)) result.add(item);
  }
  return result;
}

function symmetricDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return union(difference(a, b), difference(b, a));
}

console.log(union(a, b));               // Set {1,2,3,4,5,6,7}
console.log(intersection(a, b));        // Set {3,4,5}
console.log(difference(a, b));          // Set {1,2}
console.log(symmetricDifference(a, b)); // Set {1,2,6,7}


// TypeScript — multiset using Map<T, number>
class Multiset<T> {
  private counts = new Map<T, number>();
  private _size = 0;

  add(item: T, count: number = 1): void {
    const current = this.counts.get(item) ?? 0;
    this.counts.set(item, current + count);
    this._size += count;
  }

  getCount(item: T): number {
    return this.counts.get(item) ?? 0;
  }

  remove(item: T, count: number = 1): boolean {
    const current = this.counts.get(item) ?? 0;
    if (current === 0) return false;
    const newCount = Math.max(0, current - count);
    if (newCount === 0) {
      this.counts.delete(item);
    } else {
      this.counts.set(item, newCount);
    }
    this._size -= Math.min(count, current);
    return true;
  }

  mostCommon(k: number): Array<[T, number]> {
    return [...this.counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);
  }

  get size(): number { return this._size; }
  get uniqueSize(): number { return this.counts.size; }
}

// Anagram detection
function areAnagrams(s1: string, s2: string): boolean {
  if (s1.length !== s2.length) return false;
  const counter = new Map<string, number>();
  for (const ch of s1) counter.set(ch, (counter.get(ch) ?? 0) + 1);
  for (const ch of s2) {
    const count = counter.get(ch) ?? 0;
    if (count === 0) return false;
    counter.set(ch, count - 1);
  }
  return true;
}

console.log(areAnagrams("listen", "silent")); // true
console.log(areAnagrams("hello", "world"));   // false


// TypeScript — simple Bloom filter
class BloomFilter {
  private bits: Uint8Array;
  private bitCount: number;
  private hashCount: number;

  constructor(expectedItems: number, fpRate: number = 0.01) {
    this.bitCount = BloomFilter.optimalSize(expectedItems, fpRate);
    this.hashCount = BloomFilter.optimalHashes(this.bitCount, expectedItems);
    this.bits = new Uint8Array(Math.ceil(this.bitCount / 8));
  }

  add(item: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const idx = this.hash(item, i);
      this.bits[Math.floor(idx / 8)] |= (1 << (idx % 8));
    }
  }

  mightContain(item: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const idx = this.hash(item, i);
      if (!(this.bits[Math.floor(idx / 8)] & (1 << (idx % 8)))) {
        return false;
      }
    }
    return true;
  }

  private hash(item: string, seed: number): number {
    // Simple FNV-1a inspired hash with seed
    let h = 2166136261 ^ seed;
    for (let i = 0; i < item.length; i++) {
      h ^= item.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % this.bitCount;
  }

  private static optimalSize(n: number, p: number): number {
    return Math.ceil(-n * Math.log(p) / (Math.log(2) ** 2));
  }

  private static optimalHashes(m: number, n: number): number {
    return Math.max(1, Math.round((m / n) * Math.log(2)));
  }
}

// Usage
const bf = new BloomFilter(1000, 0.01);
bf.add("cat");
bf.add("dog");
bf.add("elephant");

console.log(bf.mightContain("cat"));     // true  (correct)
console.log(bf.mightContain("dog"));     // true  (correct)
console.log(bf.mightContain("fox"));     // false (correct)
console.log(bf.mightContain("unicorn")); // false (probably)
```


### Rust

```rust
use std::collections::{HashMap, HashSet, BTreeSet};
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;

fn main() {
    // Rust — hash set operations
    // Rust's HashSet uses SipHash by default (DoS-resistant)

    let a: HashSet<i32> = [1, 2, 3, 4, 5].into_iter().collect();
    let b: HashSet<i32> = [3, 4, 5, 6, 7].into_iter().collect();

    // Core operations — all O(1) average
    let mut s = a.clone();
    s.insert(8);            // Add element
    s.remove(&8);           // Remove element
    println!("{}", s.contains(&3)); // Membership test → true

    // Set algebra — built-in methods!
    let union: HashSet<_> = a.union(&b).copied().collect();
    let inter: HashSet<_> = a.intersection(&b).copied().collect();
    let diff: HashSet<_> = a.difference(&b).copied().collect();
    let sym: HashSet<_> = a.symmetric_difference(&b).copied().collect();

    println!("Union: {:?}", union);        // {1,2,3,4,5,6,7}
    println!("Intersection: {:?}", inter); // {3,4,5}
    println!("Difference: {:?}", diff);    // {1,2}
    println!("Sym diff: {:?}", sym);       // {1,2,6,7}
    println!("Subset: {}", a.is_subset(&b)); // false


    // Rust — multiset using HashMap<T, usize>
    let words = vec!["apple", "banana", "apple", "cherry", "banana", "apple"];
    let mut counter: HashMap<&str, usize> = HashMap::new();
    for word in &words {
        *counter.entry(word).or_insert(0) += 1;
    }
    println!("{:?}", counter);
    // {"apple": 3, "banana": 2, "cherry": 1}

    // Most common
    let mut sorted: Vec<_> = counter.iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(a.1));
    println!("Most common: {:?}", &sorted[..2]);

    // Anagram detection
    fn are_anagrams(s1: &str, s2: &str) -> bool {
        if s1.len() != s2.len() { return false; }
        let mut counts = HashMap::new();
        for ch in s1.chars() {
            *counts.entry(ch).or_insert(0i32) += 1;
        }
        for ch in s2.chars() {
            let count = counts.entry(ch).or_insert(0);
            *count -= 1;
            if *count < 0 { return false; }
        }
        true
    }

    println!("{}", are_anagrams("listen", "silent")); // true
    println!("{}", are_anagrams("hello", "world"));   // false


    // Rust — simple Bloom filter
    struct BloomFilter {
        bits: Vec<bool>,
        bit_count: usize,
        hash_count: usize,
    }

    impl BloomFilter {
        fn new(expected_items: usize, fp_rate: f64) -> Self {
            let bit_count = Self::optimal_size(expected_items, fp_rate);
            let hash_count = Self::optimal_hashes(bit_count, expected_items);
            BloomFilter {
                bits: vec![false; bit_count],
                bit_count,
                hash_count,
            }
        }

        fn add(&mut self, item: &str) {
            for i in 0..self.hash_count {
                let idx = self.hash(item, i);
                self.bits[idx] = true;
            }
        }

        fn might_contain(&self, item: &str) -> bool {
            (0..self.hash_count).all(|i| self.bits[self.hash(item, i)])
        }

        fn hash(&self, item: &str, seed: usize) -> usize {
            let mut hasher = DefaultHasher::new();
            seed.hash(&mut hasher);
            item.hash(&mut hasher);
            (hasher.finish() as usize) % self.bit_count
        }

        fn optimal_size(n: usize, p: f64) -> usize {
            let ln2_sq = (2.0_f64.ln()).powi(2);
            (-(n as f64) * p.ln() / ln2_sq).ceil() as usize
        }

        fn optimal_hashes(m: usize, n: usize) -> usize {
            let k = (m as f64 / n as f64) * 2.0_f64.ln();
            k.round().max(1.0) as usize
        }
    }

    let mut bf = BloomFilter::new(1000, 0.01);
    bf.add("cat");
    bf.add("dog");
    bf.add("elephant");

    println!("{}", bf.might_contain("cat"));     // true  (correct)
    println!("{}", bf.might_contain("dog"));     // true  (correct)
    println!("{}", bf.might_contain("fox"));     // false (correct)
    println!("{}", bf.might_contain("unicorn")); // false (probably)
}
```

Note: Rust's `HashSet<T>` is a wrapper around `HashMap<T, ()>`.
For ordered sets, use `BTreeSet<T>` which keeps elements sorted
and provides O(log n) operations. For Bloom filters in production,
consider the `bloomfilter` or `probabilistic-collections` crates.

---


## What If We Used a Sorted Array Instead of a Hash Set?

This is a reasonable question. A sorted array supports binary
search for O(log n) lookups. Why not just use that?

Let's compare:

```
  SORTED ARRAY vs HASH SET

  ┌──────────────────────┬──────────────┬──────────────┐
  │ Operation            │ Sorted Array │ Hash Set     │
  ├──────────────────────┼──────────────┼──────────────┤
  │ contains(x)          │ O(log n)     │ O(1) avg     │
  │ add(x)               │ O(n) *       │ O(1) amort.  │
  │ remove(x)            │ O(n) *       │ O(1) amort.  │
  │ union                │ O(n + m)     │ O(n + m)     │
  │ intersection         │ O(n + m)     │ O(min(n,m))  │
  │ min / max            │ O(1)         │ O(n)         │
  │ iterate in order     │ O(n)         │ O(n log n) **│
  │ range query [lo, hi] │ O(log n + k) │ O(n)         │
  │ Space                │ O(n)         │ O(n)         │
  └──────────────────────┴──────────────┴──────────────┘

  * Insertion/deletion in a sorted array requires shifting
    elements to maintain order — O(n) in the worst case.

  ** Hash sets are unordered. To iterate in sorted order,
     you must collect and sort — O(n log n).
```

### When the Sorted Array Wins

- **You need ordered iteration**: Printing elements in sorted
  order, finding the k-th smallest, or iterating a range.
- **You need min/max**: O(1) for sorted arrays vs O(n) for
  hash sets.
- **Range queries**: "Find all elements between 10 and 20" is
  O(log n + k) with binary search, but O(n) with a hash set.
- **The set is built once and only queried**: If you sort once
  and never insert/delete, binary search is excellent.
- **Memory is tight**: Sorted arrays have no overhead for hash
  table metadata (load factor padding, bucket pointers).

### When the Hash Set Wins

- **Frequent insertions and deletions**: O(1) amortized vs O(n)
  for sorted arrays. This is the killer advantage.
- **You only need membership testing**: "Is x in the set?" is
  the most common set operation, and O(1) beats O(log n).
- **Set algebra**: Intersection of a hash set is O(min(n, m))
  because you iterate the smaller set and do O(1) lookups in
  the larger one.

### The Middle Ground: Balanced BSTs

If you need both fast insertion *and* ordered iteration, use a
balanced BST (like a red-black tree or AVL tree):

```
  ┌──────────────────────┬──────────────┬──────────────┬──────────────┐
  │ Operation            │ Sorted Array │ Hash Set     │ Balanced BST │
  ├──────────────────────┼──────────────┼──────────────┼──────────────┤
  │ contains(x)          │ O(log n)     │ O(1)         │ O(log n)     │
  │ add(x)               │ O(n)         │ O(1)         │ O(log n)     │
  │ remove(x)            │ O(n)         │ O(1)         │ O(log n)     │
  │ min / max            │ O(1)         │ O(n)         │ O(log n)     │
  │ iterate in order     │ O(n)         │ O(n log n)   │ O(n)         │
  └──────────────────────┴──────────────┴──────────────┴──────────────┘

  This is exactly why languages offer both:
  • Python: set (hash) — no built-in tree set
  • Java: HashSet (hash) vs TreeSet (red-black tree)
  • Rust: HashSet (hash) vs BTreeSet (B-tree)
  • C++: unordered_set (hash) vs set (red-black tree)
```

The lesson: hash sets are the default choice for membership
testing and set operations. Reach for sorted structures only
when you need ordering, range queries, or min/max.

---

## Exercises

1. **Set operations by hand**: Given A = {1, 3, 5, 7, 9} and
   B = {2, 3, 5, 8, 9, 10}, compute the union, intersection,
   difference (A - B), and symmetric difference by hand. Then
   verify with code.

2. **Duplicate detection**: Given an array of integers, write a
   function that returns `true` if any value appears at least
   twice. Use a hash set for O(n) time. What would the brute
   force approach be, and why is it slower?

3. **Anagram groups**: Given a list of strings, group all
   anagrams together. For example, `["eat", "tea", "tan", "ate",
   "nat", "bat"]` → `[["eat","tea","ate"], ["tan","nat"],
   ["bat"]]`. Use a multiset (character counter) as the grouping
   key.

4. **Bloom filter false positive rate**: Create a Bloom filter
   sized for 1000 elements at 1% false positive rate. Insert
   1000 random strings. Then test 10,000 strings that were NOT
   inserted. Count the false positives. Is the observed rate
   close to 1%? Try again with 5000 insertions (5× the designed
   capacity) — how does the false positive rate change?

5. **Set intersection for common friends**: Given a social
   network represented as a `Map<string, Set<string>>` (user →
   set of friends), write a function that finds the common
   friends of two users. What is the time complexity?

6. **When to use what**: For each scenario, decide whether a
   hash set, sorted array, balanced BST, or Bloom filter is the
   best choice, and explain why:
   - Checking if a username is already taken (10M users)
   - Finding all transactions between $100 and $500
   - A web crawler tracking visited URLs (billions of URLs)
   - Computing the intersection of two friend lists
   - Maintaining a leaderboard sorted by score

---

**Previous**: [Lesson 07 — Hash Tables — O(1) Lookup Magic](./07-hash-tables.md)
**Next**: [Lesson 09 — Practice Problems — Fundamentals](./09-practice-fundamentals.md)