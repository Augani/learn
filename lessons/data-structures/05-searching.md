# Lesson 05: Searching — Linear, Binary, and Why Sorted Data Matters

## The Problem

You have a collection of data and need to find a specific element. How you search depends entirely on whether the data is **sorted** or **unsorted**.

This choice — sorted vs unsorted — is one of the most impactful decisions you make when designing a system.

## Linear Search: Check Everything

### The Bookshelf Analogy

Imagine an unsorted bookshelf. To find a specific book, you start at one end and check every book until you find it:

```
Looking for "Rust Programming":

[Python] [Go] [Java] [C++] [Rust] [Haskell] [Kotlin]
  check   check check  check FOUND!

4 checks needed (it was at position 4)
```

```rust
fn linear_search<T: PartialEq>(data: &[T], target: &T) -> Option<usize> {
    for (index, item) in data.iter().enumerate() {
        if item == target {
            return Some(index);
        }
    }
    None
}
```

### Complexity

- **Best case**: O(1) — target is the first element
- **Worst case**: O(n) — target is the last element or not present
- **Average case**: O(n/2) = O(n) — on average, check half the elements

Linear search works on **any** collection — sorted or unsorted. It's your fallback when you can't do better.

### When Linear Search Is Good Enough

- Small collections (< 50-100 elements): the overhead of sorting or building a hash map isn't worth it
- Unsorted data you'll only search once
- Searching with complex predicates (not just equality)

```rust
let people: Vec<Person> = get_people();
let result = people.iter().find(|p| p.age > 30 && p.city == "Portland");
```

## Binary Search: Divide and Conquer

### The Dictionary Game

Imagine finding "mango" in a dictionary:

```
Step 1: Open to the middle → "lamp"
        "mango" > "lamp" → go to the RIGHT half

        [A ──────── lamp ──────── Z]
                         └────── search here ──────┘

Step 2: Open to the middle of right half → "pencil"
        "mango" < "pencil" → go to the LEFT half

                    [lamp ── pencil ──── Z]
                    └── search here ──┘

Step 3: Open to the middle → "mango"
        FOUND!

        [lamp ── mango ── pencil]
                  ↑ here!
```

3 steps for a dictionary of thousands of pages. This is the power of O(log n).

### The Algorithm

```
Binary search for 42 in [2, 5, 8, 12, 16, 23, 38, 42, 56, 72, 91]:

Step 1: low=0, high=10, mid=5
        arr[5] = 23
        42 > 23 → search right half

        [ 2  5  8  12  16  23 | 38  42  56  72  91]
                                 ← search here →

Step 2: low=6, high=10, mid=8
        arr[8] = 56
        42 < 56 → search left half

        [38  42 | 56  72  91]
         ← here →

Step 3: low=6, high=7, mid=6
        arr[6] = 38
        42 > 38 → search right half

        [38 | 42]
              ↑

Step 4: low=7, high=7, mid=7
        arr[7] = 42
        42 == 42 → FOUND at index 7!
```

```rust
fn binary_search(sorted: &[i32], target: i32) -> Option<usize> {
    let mut low = 0;
    let mut high = sorted.len();

    while low < high {
        let mid = low + (high - low) / 2;
        match sorted[mid].cmp(&target) {
            std::cmp::Ordering::Equal => return Some(mid),
            std::cmp::Ordering::Less => low = mid + 1,
            std::cmp::Ordering::Greater => high = mid,
        }
    }
    None
}
```

### Why `low + (high - low) / 2` Instead of `(low + high) / 2`?

The second form can **overflow** if `low + high > usize::MAX`. The first form is safe because `high - low` is always smaller than the array size.

This is a famous bug — Java's `Arrays.binarySearch` had this overflow bug for **9 years** before it was fixed.

### Complexity

- **Best case**: O(1) — target is at the middle
- **Worst case**: O(log n) — target is at an extreme or not present
- **Prerequisite**: Data MUST be sorted

```
How many steps for different input sizes:

Elements        Steps (log₂)
──────────      ─────────
10              ~3
100             ~7
1,000           ~10
1,000,000       ~20
1,000,000,000   ~30

1 billion elements searched in ~30 comparisons.
```

### Binary Search Variants

Binary search isn't just for "find exact value." Common variants:

```rust
let data = vec![1, 3, 5, 5, 5, 7, 9];

let exact = data.binary_search(&5);
// Ok(3) — found at index 3 (could be any of the 5s)

let lower_bound = data.partition_point(|&x| x < 5);
// 2 — first index where value >= 5

let upper_bound = data.partition_point(|&x| x <= 5);
// 5 — first index where value > 5

// All 5s are at indices lower_bound..upper_bound = 2..5
```

```
Partition point for target 5:

Index:  0   1   2   3   4   5   6
Value: [1,  3,  5,  5,  5,  7,  9]
                ↑               ↑
           lower_bound(5)  upper_bound(5)
           (first ≥ 5)     (first > 5)
```

## The Cost of Sorting

Binary search requires sorted data. Sorting is O(n log n). So when does it pay to sort?

```
Strategy 1: Linear search k times
  Cost: O(k * n)

Strategy 2: Sort once, then binary search k times
  Cost: O(n log n) + O(k * log n)

Break-even: when k * n = n log n + k * log n
  Approximately when k > log n

For n = 1,000,000:
  log n ≈ 20
  If you search more than ~20 times, sorting first is worth it.
```

**Rule of thumb**: If you'll search the same data more than a handful of times, sort it (or use a HashMap).

## Interpolation Search (Brief)

If your data is **uniformly distributed** (like a phone book), you can estimate where the target is:

```
Looking for "Smith" in a phone book:
- "Smith" starts with 'S', which is ~73% through the alphabet
- Jump to ~73% through the book instead of the middle
- Much faster than binary search for uniform distributions
```

Average case: O(log log n) — even faster than binary search. But worst case is O(n) for non-uniform distributions. In practice, binary search is almost always preferred because it's more predictable.

## Rust Standard Library

```rust
let data = vec![1, 3, 5, 7, 9, 11];

data.contains(&5);           // true — linear search O(n)
data.binary_search(&5);      // Ok(2) — binary search O(log n), requires sorted
data.binary_search(&6);      // Err(3) — not found, 3 is where it would be inserted

data.iter().find(|&&x| x > 4);     // Some(&5) — linear search with predicate
data.iter().position(|&x| x == 7); // Some(3) — linear search returning index

data.partition_point(|&x| x < 5);  // 2 — binary search for insertion point
```

### binary_search Return Value

Rust's `binary_search` returns `Result<usize, usize>`:
- `Ok(index)` — found at `index`
- `Err(index)` — not found, but `index` is where it would be inserted to maintain sort order

This is extremely useful for maintaining sorted collections:

```rust
let mut sorted = vec![1, 3, 7, 9];

match sorted.binary_search(&5) {
    Ok(_) => {} // already exists
    Err(pos) => sorted.insert(pos, 5), // insert at correct position
}
// sorted is now [1, 3, 5, 7, 9]
```

## Cross-Language Comparison

| Operation | Rust | Go | TypeScript |
|-----------|------|-----|------------|
| Linear search | `slice.contains()`, `iter().find()` | `slices.Contains()` | `arr.includes()`, `arr.find()` |
| Binary search | `slice.binary_search()` | `sort.Search()` | None built-in (implement or use lodash) |
| Sort + search | `slice.sort()` + `binary_search()` | `sort.Slice()` + `sort.Search()` | `arr.sort()` + manual |

Go's `sort.Search` uses a different API — it takes a closure and returns the smallest index where the closure returns true. Rust's API is more ergonomic.

## Exercises

### Exercise 1: Implement Binary Search

Write binary search from scratch, handling all edge cases:

```rust
fn binary_search(sorted: &[i32], target: i32) -> Option<usize> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_slice() {
        assert_eq!(binary_search(&[], 5), None);
    }

    #[test]
    fn single_element_found() {
        assert_eq!(binary_search(&[5], 5), Some(0));
    }

    #[test]
    fn single_element_not_found() {
        assert_eq!(binary_search(&[5], 3), None);
    }

    #[test]
    fn first_element() {
        assert_eq!(binary_search(&[1, 3, 5, 7, 9], 1), Some(0));
    }

    #[test]
    fn last_element() {
        assert_eq!(binary_search(&[1, 3, 5, 7, 9], 9), Some(4));
    }

    #[test]
    fn middle_element() {
        assert_eq!(binary_search(&[1, 3, 5, 7, 9], 5), Some(2));
    }

    #[test]
    fn not_present() {
        assert_eq!(binary_search(&[1, 3, 5, 7, 9], 4), None);
    }
}
```

### Exercise 2: Find First Occurrence

Given a sorted array with duplicates, find the **first** occurrence of a target:

```rust
fn find_first(sorted: &[i32], target: i32) -> Option<usize> {
    // [1, 3, 5, 5, 5, 7, 9], target=5 → Some(2) (not 3 or 4)
    todo!()
}
```

Hint: when you find the target, don't stop — keep searching left.

### Exercise 3: Search Application — Square Root

Use binary search to find the integer square root of a number (the largest integer whose square is ≤ n):

```rust
fn integer_sqrt(n: u64) -> u64 {
    // integer_sqrt(16) = 4
    // integer_sqrt(17) = 4
    // integer_sqrt(25) = 5
    // integer_sqrt(0)  = 0
    // integer_sqrt(1)  = 1
    todo!()
}
```

Binary search on the range [0, n] where you check if `mid * mid <= n`.

### Exercise 4: Benchmark Linear vs Binary Search

Search for 10,000 random values in a sorted array of 1,000,000 elements. Compare linear search vs binary search times:

```rust
use std::time::Instant;
use rand::Rng;

fn main() {
    let data: Vec<i64> = (0..1_000_000).collect();
    let mut rng = rand::thread_rng();
    let targets: Vec<i64> = (0..10_000)
        .map(|_| rng.gen_range(0..1_000_000))
        .collect();

    let start = Instant::now();
    for &target in &targets {
        data.iter().find(|&&x| x == target);
    }
    println!("Linear: {:?}", start.elapsed());

    let start = Instant::now();
    for &target in &targets {
        data.binary_search(&target);
    }
    println!("Binary: {:?}", start.elapsed());
}
```

---

Next: [Lesson 06: Sorting](./06-sorting.md)
