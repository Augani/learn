# Lesson 08: Iterators and Closures

Iterators are one of Rust's core tools for working with collections.
Closures let you pass behavior into iterator pipelines. Together, they give
you concise data-processing code that still compiles efficiently.

---

## Closures

Closures are anonymous functions that capture their environment.

```rust
fn main() {
    let multiplier = 3;

    // Closure syntax: |params| body
    let multiply = |x: i32| x * multiplier;

    println!("{}", multiply(5));  // 15
}
```

**Go equivalent:**
```go
multiplier := 3
multiply := func(x int) int { return x * multiplier }
```

**TS equivalent:**
```typescript
const multiplier = 3;
const multiply = (x: number) => x * multiplier;
```

### Closure syntax variations

```rust
let add_one = |x| x + 1;                    // type inferred
let add = |x: i32, y: i32| -> i32 { x + y }; // explicit types
let greet = || println!("hello");             // no parameters
let complex = |x| {                           // multi-line
    let doubled = x * 2;
    doubled + 1
};
```

### How closures capture (the ownership angle)

```rust
fn main() {
    let name = String::from("Augustus");

    // Borrows `name` (immutable)
    let greet = || println!("Hello, {name}!");
    greet();
    println!("{name}");  // still valid

    // Borrows `name` mutably
    let mut name = String::from("Augustus");
    let mut add_title = || name.insert_str(0, "Mr. ");
    add_title();
    println!("{name}");  // "Mr. Augustus"

    // Takes ownership with `move`
    let name = String::from("Augustus");
    let greet = move || println!("Hello, {name}!");
    greet();
    // println!("{name}");  // COMPILE ERROR: name was moved
}
```

`move` closures are essential for threads and async (the closure needs to
own its data to safely send it to another thread).

---

## Iterators

### Basic iteration

```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];

    // For loop (uses IntoIterator implicitly)
    for n in &numbers {
        println!("{n}");
    }

    // Explicit iterator
    let mut iter = numbers.iter();
    assert_eq!(iter.next(), Some(&1));
    assert_eq!(iter.next(), Some(&2));
}
```

### Three types of iteration

| Method | Yields | Ownership |
|--------|--------|-----------|
| `.iter()` | `&T` | Borrows the collection |
| `.iter_mut()` | `&mut T` | Borrows mutably |
| `.into_iter()` | `T` | Consumes the collection |

```rust
let v = vec![1, 2, 3];

for x in v.iter() { }       // x: &i32, v still usable
for x in v.iter_mut() { }   // x: &mut i32, v still usable
for x in v.into_iter() { }  // x: i32, v is consumed
for x in v { }               // shorthand for into_iter()
```

---

## Iterator Adaptors (the fun part)

These are lazy — they don't execute until consumed.

### map — transform each element

```rust
let numbers = vec![1, 2, 3, 4, 5];
let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
// [2, 4, 6, 8, 10]
```

**TS:** `numbers.map(x => x * 2)`
**Go:** Manual for loop (no map in stdlib)

### filter — keep elements matching a condition

```rust
let evens: Vec<&i32> = numbers.iter().filter(|x| *x % 2 == 0).collect();
// [2, 4]
```

### filter_map — filter and transform in one step

```rust
let input = vec!["1", "two", "3", "four", "5"];
let nums: Vec<i32> = input
    .iter()
    .filter_map(|s| s.parse::<i32>().ok())  // parse, keep only Ok values
    .collect();
// [1, 3, 5]
```

### flat_map — map then flatten

```rust
let sentences = vec!["hello world", "foo bar"];
let words: Vec<&str> = sentences.iter().flat_map(|s| s.split_whitespace()).collect();
// ["hello", "world", "foo", "bar"]
```

### enumerate — get index + value

```rust
for (i, val) in numbers.iter().enumerate() {
    println!("{i}: {val}");
}
```

**Go:** `for i, val := range numbers { ... }` — same thing.

### zip — pair up two iterators

```rust
let names = vec!["Alice", "Bob"];
let ages = vec![30, 25];
let people: Vec<(&str, &i32)> = names.iter().zip(ages.iter()).collect();
// [("Alice", 30), ("Bob", 25)]
```

### take, skip, chain

```rust
let first_three: Vec<&i32> = numbers.iter().take(3).collect();
let skip_two: Vec<&i32> = numbers.iter().skip(2).collect();
let combined: Vec<i32> = vec![1, 2].into_iter().chain(vec![3, 4]).collect();
```

---

## Consumers (trigger execution)

| Method | What it does | Returns |
|--------|-------------|---------|
| `.collect()` | Gather into a collection | `Vec`, `HashMap`, etc. |
| `.sum()` | Add all elements | Number |
| `.count()` | Count elements | `usize` |
| `.any(predicate)` | Any element matches? | `bool` |
| `.all(predicate)` | All elements match? | `bool` |
| `.find(predicate)` | First matching element | `Option<&T>` |
| `.position(predicate)` | Index of first match | `Option<usize>` |
| `.min()` / `.max()` | Smallest/largest | `Option<&T>` |
| `.fold(init, fn)` | Reduce to single value | Accumulator type |
| `.for_each(fn)` | Side effect per element | `()` |

### Examples

```rust
let numbers = vec![1, 2, 3, 4, 5];

let sum: i32 = numbers.iter().sum();                    // 15
let has_even = numbers.iter().any(|x| x % 2 == 0);     // true
let all_positive = numbers.iter().all(|x| *x > 0);     // true
let first_even = numbers.iter().find(|x| *x % 2 == 0); // Some(&2)

// fold = reduce
let product = numbers.iter().fold(1, |acc, x| acc * x); // 120
```

**TS equivalent of fold:**
```typescript
numbers.reduce((acc, x) => acc * x, 1);
```

---

## Collecting into different types

`.collect()` uses type inference to know what to build:

```rust
use std::collections::{HashMap, HashSet};

let v: Vec<i32> = (1..=5).collect();
let s: HashSet<i32> = (1..=5).collect();
let m: HashMap<&str, i32> = vec![("a", 1), ("b", 2)].into_iter().collect();

// Turbofish syntax (alternative to type annotation)
let v = (1..=5).collect::<Vec<i32>>();
```

---

## Real-World Chaining Example

```rust
use std::collections::HashMap;

fn word_frequency(text: &str) -> HashMap<String, usize> {
    text.split_whitespace()
        .map(|w| w.to_lowercase())
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
        .filter(|w| !w.is_empty())
        .fold(HashMap::new(), |mut map, word| {
            *map.entry(word).or_insert(0) += 1;
            map
        })
}
```

---

## Exercises

### Exercise 1: Iterator chain
```rust
// Given a Vec<String> of lines, return the total character count
// of lines that start with '#' (comments), excluding the '#' itself
fn count_comment_chars(lines: &[String]) -> usize {
    todo!()
}
```

### Exercise 2: Implement Iterator for a custom type
```rust
struct Fibonacci {
    a: u64,
    b: u64,
}

// Implement Iterator for Fibonacci
// Then use: Fibonacci::new().take(10).collect::<Vec<u64>>()
```

### Exercise 3: Transform data
```rust
// Given a vec of (name, score) tuples, return names of people
// who scored above average, sorted alphabetically
fn above_average(scores: &[(String, f64)]) -> Vec<String> {
    todo!()
}
```

---

## Key Takeaways

1. **Iterators are lazy** — nothing runs until a consumer (`.collect()`, `.sum()`) is called.
2. **Zero-cost** — iterator chains compile to the same code as hand-written loops.
3. **`move` closures** take ownership — needed for threads/async.
4. **`.collect()` is polymorphic** — it builds whatever type you ask for.
5. **Coming from Go:** This replaces `for range` + manual accumulation.
6. **Coming from TS:** Same `.map().filter()` style, but type-safe and compiled.

Next: [Lesson 09 — Strings](./09-strings.md)
