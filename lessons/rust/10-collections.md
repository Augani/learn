# Lesson 10: Collections (Vec, HashMap, HashSet)

These are Rust's standard growable collections. The main thing to learn is
not the data structures themselves, but how ownership and borrowing affect
reading, updating, and iterating over them.

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

### The Entry API (Rust's killer feature for maps)

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
