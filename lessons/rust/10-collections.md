# Lesson 10: Collections (Vec, HashMap, HashSet)

These are Rust's standard growable collections. The main thing to learn is
not the data structures themselves, but how ownership and borrowing affect
reading, updating, and iterating over them.

---

## The Everyday Analogy: Three Ways to Store Things

Rust's three core collections map to everyday storage:

- **Vec** is like a **notebook with numbered pages**. You write things in order, one after another. You can quickly flip to page 47 (O(1) index access). Adding a new page at the end is fast. But inserting a page in the middle means renumbering everything after it — slow.

- **HashMap** is like a **filing cabinet with labeled folders**. You store things by name ("taxes_2024", "recipes"). Looking up a folder by name is instant (O(1) average). But the folders aren't in any particular order — you can't say "give me the third folder."

- **HashSet** is like a **guest list at a party**. It only tracks WHO is on the list, not any associated data. Checking "is Alice invited?" is instant. Adding someone who's already on the list does nothing (no duplicates).

```
Vec<T>:       [item0, item1, item2, item3, ...]
              Ordered. Indexed. Contiguous in memory.
              Like an array that grows.

HashMap<K,V>: { "key1" => val1, "key2" => val2, ... }
              Unordered. Keyed. O(1) lookup.
              Like a dictionary.

HashSet<T>:   { item1, item2, item3, ... }
              Unordered. Unique. O(1) membership test.
              Like a mathematical set.
```

---

## Vec<T> — Dynamic Array

Go: `[]T` (slice). TS: `T[]` / `Array<T>`.

### Creating

```rust
fn main() {
    let v1: Vec<i32> = Vec::new();
    let v2 = vec![1, 2, 3, 4, 5];
    let v3 = vec![0; 10];                // [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let v4: Vec<i32> = (1..=5).collect();
    let v5 = Vec::with_capacity(100);    // pre-allocate
}
```

### Vec Under the Hood

```
let v = vec![10, 20, 30];

Stack:                  Heap:
+----------+           +----+----+----+----+----+
| ptr   ───┼──────────>| 10 | 20 | 30 |    |    |
| len: 3   |           +----+----+----+----+----+
| cap: 5   |           ← len=3 →← unused  →
+----------+           ← capacity=5 ────────→

v.push(40):  len becomes 4, no reallocation (cap=5)
v.push(50):  len becomes 5, no reallocation
v.push(60):  len would exceed cap!
             → Allocate new buffer (cap=10)
             → Copy all elements
             → Free old buffer

This is why Vec::with_capacity(n) exists —
if you know you'll need 1000 elements,
pre-allocate to avoid repeated reallocations.
```

### Access

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5];

    let third = v[2];              // panics if out of bounds
    let maybe = v.get(2);          // Option<&i32> — safe
    let first = v.first();         // Option<&i32>
    let last = v.last();           // Option<&i32>

    if let Some(val) = v.get(10) {
        println!("{val}");
    } else {
        println!("out of bounds");
    }
}
```

**Go equivalent:** `v[2]` panics on OOB too. No `.get()` equivalent — you
check `len()` manually.

### Modifying

```rust
fn main() {
    let mut v = vec![1, 2, 3];

    v.push(4);                     // append
    v.pop();                       // remove last → Option<T>
    v.insert(1, 10);              // insert at index
    v.remove(0);                   // remove at index, shifts elements
    v.retain(|x| *x > 2);        // keep only elements matching predicate
    v.sort();                      // in-place sort
    v.dedup();                     // remove consecutive duplicates
    v.reverse();                   // in-place reverse
    v.truncate(2);                // keep first 2 elements
    v.clear();                     // remove all elements
}
```

### The Borrow Checker and Vectors

```rust
fn main() {
    let mut v = vec![1, 2, 3, 4, 5];

    // This WON'T compile:
    // let first = &v[0];      // immutable borrow
    // v.push(6);              // mutable borrow — conflict!
    // println!("{first}");    // immutable borrow still in use

    // WHY? push() might reallocate the vector, invalidating `first`.
    // Go would just let the reference dangle. Rust catches it.

    // Fix: use first before mutating
    let first = v[0];          // copy the i32 (it's Copy)
    v.push(6);
    println!("{first}");
}
```

### Iterating

```rust
fn main() {
    let v = vec![1, 2, 3];

    for val in &v {
        println!("{val}");
    }

    // With mutation
    let mut v = vec![1, 2, 3];
    for val in &mut v {
        *val *= 2;
    }

    // Consuming
    let v = vec![1, 2, 3];
    for val in v {
        println!("{val}");
    }
    // v is no longer available — it was consumed
}
```

### Useful Vec patterns

```rust
fn main() {
    let v = vec![3, 1, 4, 1, 5, 9, 2, 6];

    let contains = v.contains(&4);              // true
    let pos = v.iter().position(|&x| x == 5);  // Some(4)
    let sum: i32 = v.iter().sum();
    let min = v.iter().min();                   // Some(&1)
    let max = v.iter().max();                   // Some(&9)

    // Windowed iteration
    for window in v.windows(3) {
        println!("{window:?}");
    }

    // Chunks
    for chunk in v.chunks(3) {
        println!("{chunk:?}");
    }
}
```

---

## HashMap<K, V> — Key-Value Map

Go: `map[K]V`. TS: `Map<K, V>` / `Record<string, V>`.

### Creating

```rust
use std::collections::HashMap;

fn main() {
    let mut scores: HashMap<String, i32> = HashMap::new();

    scores.insert("Alice".to_string(), 95);
    scores.insert("Bob".to_string(), 87);

    // From iterator of tuples
    let scores: HashMap<&str, i32> = vec![
        ("Alice", 95),
        ("Bob", 87),
    ].into_iter().collect();

    // With capacity
    let map: HashMap<String, i32> = HashMap::with_capacity(100);
}
```

### Access

```rust
use std::collections::HashMap;

fn main() {
    let mut scores = HashMap::new();
    scores.insert("Alice", 95);
    scores.insert("Bob", 87);

    let alice = scores.get("Alice");         // Option<&i32>
    let alice = scores["Alice"];             // panics if missing (like Go)
    let missing = scores.get("Charlie");     // None

    let has_alice = scores.contains_key("Alice"); // true
    let count = scores.len();
}
```

**Go equivalent:**
```go
scores := map[string]int{"Alice": 95, "Bob": 87}
alice, ok := scores["Alice"]  // Go returns (value, bool)
```

Rust returns `Option` instead of `(value, bool)`.

### The Entry API: Rust's Elegant Update Pattern

**Analogy — a hotel check-in desk:**

You arrive at a hotel. The receptionist checks if you have a reservation:
- If YES (occupied entry): they update your room details
- If NO (vacant entry): they create a new reservation

Without the Entry API, you'd check, then insert — two lookups. The Entry API does it in one:

```rust
use std::collections::HashMap;

fn main() {
    // Count word frequencies — the classic example
    let mut counts: HashMap<String, i32> = HashMap::new();
    let text = "hello world hello rust hello";

    for word in text.split_whitespace() {
        // One lookup: check if entry exists, insert 0 if not, then increment
        *counts.entry(word.to_string()).or_insert(0) += 1;
    }
    // {"hello": 3, "world": 1, "rust": 1}

    // Without Entry API (two lookups, clunky):
    // for word in text.split_whitespace() {
    //     if counts.contains_key(word) {    // lookup #1
    //         *counts.get_mut(word).unwrap() += 1;  // lookup #2
    //     } else {
    //         counts.insert(word.to_string(), 1);   // lookup #2
    //     }
    // }
}
```

```rust
use std::collections::HashMap;

fn main() {
    let mut word_count: HashMap<String, i32> = HashMap::new();
    let text = "hello world hello rust hello";

    for word in text.split_whitespace() {
        let count = word_count.entry(word.to_string()).or_insert(0);
        *count += 1;
    }
    // {"hello": 3, "world": 1, "rust": 1}

    // or_insert_with — lazy default
    let mut cache: HashMap<String, Vec<i32>> = HashMap::new();
    cache.entry("key".to_string()).or_insert_with(Vec::new).push(42);

    // or_default — uses Default trait
    let mut counts: HashMap<String, i32> = HashMap::new();
    *counts.entry("hello".to_string()).or_default() += 1;
}
```

**Go equivalent:**
```go
counts := map[string]int{}
counts["hello"]++  // Go auto-initializes to zero value
```

Go's zero-value initialization is simpler for this case, but Rust's entry
API is more powerful for complex values.

### Iterating

```rust
use std::collections::HashMap;

fn main() {
    let scores = HashMap::from([("Alice", 95), ("Bob", 87)]);

    for (name, score) in &scores {
        println!("{name}: {score}");
    }

    // Keys only
    for name in scores.keys() {
        println!("{name}");
    }

    // Values only
    for score in scores.values() {
        println!("{score}");
    }

    // Mutable values
    let mut scores = HashMap::from([("Alice", 95), ("Bob", 87)]);
    for score in scores.values_mut() {
        *score += 10;
    }
}
```

---

## HashSet<T> — Unique Values

Go: `map[T]struct{}`. TS: `Set<T>`.

```rust
use std::collections::HashSet;

fn main() {
    let mut fruits: HashSet<&str> = HashSet::new();
    fruits.insert("apple");
    fruits.insert("banana");
    fruits.insert("apple");  // duplicate — ignored

    println!("{}", fruits.len());            // 2
    println!("{}", fruits.contains("apple")); // true

    fruits.remove("banana");

    // From iterator
    let unique: HashSet<i32> = vec![1, 2, 2, 3, 3, 3].into_iter().collect();
    // {1, 2, 3}

    // Set operations
    let a: HashSet<i32> = [1, 2, 3].into_iter().collect();
    let b: HashSet<i32> = [2, 3, 4].into_iter().collect();

    let union: HashSet<&i32> = a.union(&b).collect();             // {1,2,3,4}
    let intersection: HashSet<&i32> = a.intersection(&b).collect(); // {2,3}
    let difference: HashSet<&i32> = a.difference(&b).collect();    // {1}
    let sym_diff: HashSet<&i32> = a.symmetric_difference(&b).collect(); // {1,4}

    let is_subset = a.is_subset(&b);     // false
    let is_disjoint = a.is_disjoint(&b); // false
}
```

---

### The Borrow Checker and Collections

This is where Rust collections feel different from every other language. The borrow checker prevents you from modifying a collection while iterating over it.

**Analogy — restocking shelves in a store:**

Imagine you're counting items on a shelf (iterating). A coworker tries to add new items to the shelf while you're counting (modifying). Your count would be wrong! Rust prevents this at compile time.

```rust
let mut v = vec![1, 2, 3, 4, 5];

// ✗ COMPILE ERROR: can't mutate while iterating
for x in &v {
    if *x > 3 {
        v.push(*x * 2);  // Error! v is borrowed by the loop
    }
}

// ✓ Solution: collect what to add, then add after
let additions: Vec<i32> = v.iter()
    .filter(|&&x| x > 3)
    .map(|&x| x * 2)
    .collect();
v.extend(additions);
```

This rule applies to all collections — Vec, HashMap, HashSet, and their sorted variants. If you're iterating (`&collection`), you cannot simultaneously call methods that modify the collection (`.push()`, `.insert()`, `.remove()`, etc.).

---

## BTreeMap / BTreeSet — Sorted Variants

Same API as HashMap/HashSet but keys are sorted. Use when you need ordered
iteration.

```rust
use std::collections::BTreeMap;

fn main() {
    let mut map = BTreeMap::new();
    map.insert("charlie", 3);
    map.insert("alice", 1);
    map.insert("bob", 2);

    for (k, v) in &map {
        println!("{k}: {v}");
    }
    // alice: 1, bob: 2, charlie: 3 — always sorted
}
```

---

## VecDeque<T> — Double-Ended Queue

Efficient push/pop from both ends. Go: `container/list`.

```rust
use std::collections::VecDeque;

fn main() {
    let mut deque = VecDeque::new();
    deque.push_back(1);
    deque.push_back(2);
    deque.push_front(0);

    let front = deque.pop_front();  // Some(0)
    let back = deque.pop_back();    // Some(2)
}
```

---

## Exercises

### Exercise 1: Group by
```rust
use std::collections::HashMap;

// Group a list of (category, item) tuples into a HashMap<String, Vec<String>>
fn group_by(items: Vec<(&str, &str)>) -> HashMap<String, Vec<String>> {
    todo!()
}
// Input: [("fruit", "apple"), ("veg", "carrot"), ("fruit", "banana")]
// Output: {"fruit": ["apple", "banana"], "veg": ["carrot"]}
```

### Exercise 2: Unique sorted
```rust
// Given a Vec<i32>, return a sorted Vec with duplicates removed
fn unique_sorted(nums: Vec<i32>) -> Vec<i32> {
    todo!()
}
```

### Exercise 3: Two sum
```rust
use std::collections::HashMap;

// Given a vec of numbers and a target, return the indices of two numbers
// that add up to the target
fn two_sum(nums: &[i32], target: i32) -> Option<(usize, usize)> {
    todo!()
}
```

---

## Key Takeaways

1. **`Vec<T>`** is your go-to dynamic array. Use `.get()` for safe access.
2. **`HashMap`** — entry API (`or_insert`, `or_default`) is idiomatic Rust.
3. **`HashSet`** for unique values. Has set operations built in.
4. **`BTreeMap`/`BTreeSet`** when you need sorted keys.
5. **Borrow checker applies** — can't hold a reference and mutate the collection.
6. **Coming from Go:** `HashMap.get()` returns `Option` not `(value, ok)`.

Next: [Lesson 11 — Modules, Crates, and Cargo](./11-modules-cargo.md)
