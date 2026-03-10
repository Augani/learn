# Lesson 02: Big-O Notation — How to Think About Performance

## The Core Idea

Big-O notation is not about speed. It's about **growth**. It answers: **"As my input gets larger, how does the work increase?"**

Saying an algorithm is O(n) doesn't tell you it takes 5 milliseconds. It tells you that if you double the input, the work roughly doubles. If you 10x the input, the work roughly 10x's.

This is the single most important concept in computer science for making good engineering decisions.

## The Phone Book Analogy

Imagine finding a name in a phone book:

**Linear search O(n)** — Start at page 1, read every name until you find it.
- 10 people: check up to 10 names. Fine.
- 10,000 people: check up to 10,000 names. Tedious but doable.
- 10,000,000 people: check up to 10 million names. Hours of work.

**Binary search O(log n)** — Open to the middle. Is the name before or after? Discard half. Repeat.
- 10 people: ~3 steps
- 10,000 people: ~13 steps
- 10,000,000 people: ~23 steps

The phone book went from 10 to 10 million (a million times bigger), but binary search only went from 3 to 23 steps. That's the power of O(log n).

```
Input Size    O(n) steps    O(log n) steps    Difference
──────────    ──────────    ──────────────    ──────────
10            10            ~3                3x
100           100           ~7                14x
1,000         1,000         ~10               100x
1,000,000     1,000,000     ~20               50,000x
1,000,000,000 1,000,000,000 ~30               33,000,000x
```

## The Formal (But Practical) Definition

O(f(n)) means: **for large enough n, the algorithm does at most c * f(n) work**, where c is some constant.

In practice, this means:
1. **Drop constants**: O(2n) = O(n). O(n/2) = O(n). The constant doesn't matter at scale.
2. **Drop lower-order terms**: O(n² + n + 100) = O(n²). The n² dominates when n is large.
3. **Only the fastest-growing term matters**: O(n³ + n² + n) = O(n³).

```
Why constants don't matter at scale:

n = 10:       2n = 20,        n² = 100        ← 2n is bigger!
n = 100:      2n = 200,       n² = 10,000     ← n² wins
n = 1000:     2n = 2,000,     n² = 1,000,000  ← n² dominates completely
n = 1000000:  2n = 2,000,000, n² = 1,000,000,000,000 ← game over
```

## Walking Through Each Complexity Class

### O(1) — Constant Time

The amount of work is the same regardless of input size.

```rust
fn is_even(n: i64) -> bool {
    n % 2 == 0
}

fn first_element(data: &[i32]) -> Option<&i32> {
    data.first()
}

fn hash_map_get(map: &HashMap<String, i32>, key: &str) -> Option<&i32> {
    map.get(key)
}
```

```
Work
  ^
  |
  |  _______________________________________________
  | |
  | |  The line is flat — input size doesn't matter
  | |
  +─+───────────────────────────────────────────────→ n
```

### O(log n) — Logarithmic

Each step eliminates a constant fraction of the remaining work (usually half).

```rust
fn binary_search(sorted: &[i32], target: i32) -> bool {
    let (mut low, mut high) = (0, sorted.len());
    while low < high {
        let mid = low + (high - low) / 2;
        match sorted[mid].cmp(&target) {
            std::cmp::Ordering::Equal => return true,
            std::cmp::Ordering::Less => low = mid + 1,
            std::cmp::Ordering::Greater => high = mid,
        }
    }
    false
}
```

```
Searching in 16 elements:

Step 1: [1  2  3  4  5  6  7  8│ 9 10 11 12 13 14 15 16]
         ←──── eliminate ────→   ←──── search here ────→

Step 2:                          [9 10 11 12│13 14 15 16]
                                  ← elim →   ← search →

Step 3:                                      [13 14│15 16]
                                              elim   search

Step 4:                                             [15│16]
                                                      found!

16 elements → 4 steps.  log₂(16) = 4. ✓
```

How to recognize O(log n): **the problem is halved (or divided by some constant) at each step**.

### O(n) — Linear

Work scales proportionally with input size.

```rust
fn find_max(data: &[i32]) -> Option<i32> {
    let mut max = None;
    for &val in data {
        match max {
            None => max = Some(val),
            Some(current) if val > current => max = Some(val),
            _ => {}
        }
    }
    max
}

fn sum(data: &[i32]) -> i32 {
    data.iter().sum()
}
```

How to recognize O(n): **a single pass through all elements**.

### O(n log n) — Linearithmic

Do O(log n) work for each of the n elements. This is the speed limit for comparison-based sorting.

```rust
fn merge_sort(data: &mut [i32]) {
    let len = data.len();
    if len <= 1 {
        return;
    }
    let mid = len / 2;
    merge_sort(&mut data[..mid]);
    merge_sort(&mut data[mid..]);

    let merged: Vec<i32> = merge(&data[..mid], &data[mid..]);
    data.copy_from_slice(&merged);
}
```

```
Merge sort on [38, 27, 43, 3, 9, 82, 10]:

Level 0: [38, 27, 43, 3, 9, 82, 10]          ← 1 array
Level 1: [38, 27, 43] [3, 9, 82, 10]         ← 2 arrays
Level 2: [38, 27] [43] [3, 9] [82, 10]       ← 4 arrays
Level 3: [38] [27] [43] [3] [9] [82] [10]    ← 7 arrays (all size 1)

Then merge back up:
Level 2: [27, 38] [43] [3, 9] [10, 82]       ← merge pairs, n work
Level 1: [27, 38, 43] [3, 9, 10, 82]         ← merge pairs, n work
Level 0: [3, 9, 10, 27, 38, 43, 82]          ← merge pairs, n work
                                                 ↑
                                            log n levels × n work each = O(n log n)
```

### O(n²) — Quadratic

Every element interacts with every other element. Nested loops are the usual culprit.

```rust
fn bubble_sort(data: &mut [i32]) {
    let n = data.len();
    for i in 0..n {
        for j in 0..n - 1 - i {
            if data[j] > data[j + 1] {
                data.swap(j, j + 1);
            }
        }
    }
}

fn all_pairs(data: &[i32]) -> Vec<(i32, i32)> {
    let mut pairs = Vec::new();
    for i in 0..data.len() {
        for j in (i + 1)..data.len() {
            pairs.push((data[i], data[j]));
        }
    }
    pairs
}
```

```
n = 5: pairs to check

     0  1  2  3  4
  0  .  ×  ×  ×  ×     ← 4 comparisons
  1     .  ×  ×  ×     ← 3 comparisons
  2        .  ×  ×     ← 2 comparisons
  3           .  ×     ← 1 comparison
  4              .     ← 0 comparisons

Total: 4 + 3 + 2 + 1 = 10 = n(n-1)/2 ≈ n²/2 = O(n²)
```

### O(2^n) — Exponential

Work doubles with each additional input element. Only feasible for n < ~25.

```rust
fn fibonacci_naive(n: u32) -> u64 {
    if n <= 1 {
        return n as u64;
    }
    fibonacci_naive(n - 1) + fibonacci_naive(n - 2)
}

fn all_subsets(items: &[i32]) -> Vec<Vec<i32>> {
    if items.is_empty() {
        return vec![vec![]];
    }
    let rest_subsets = all_subsets(&items[1..]);
    let mut result = rest_subsets.clone();
    for mut subset in rest_subsets {
        subset.push(items[0]);
        result.push(subset);
    }
    result
}
```

```
Fibonacci call tree for fib(5):

                        fib(5)
                       /      \
                  fib(4)       fib(3)
                 /     \       /     \
            fib(3)   fib(2) fib(2) fib(1)
            /   \    /   \   /   \
        fib(2) fib(1) fib(1) fib(0) fib(1) fib(0)
        /   \
    fib(1) fib(0)

15 function calls for n=5. For n=50, it's over 1 trillion calls.
```

## Best Case, Worst Case, Average Case

Most algorithms have different performance depending on the input:

```
Linear search for value 42 in [42, 7, 13, 99, 5]:

Best case:  O(1)   — 42 is the first element
Worst case: O(n)   — 42 is the last element (or not present)
Average:    O(n/2) = O(n) — on average, check half the elements
```

**Big-O typically refers to worst case** unless stated otherwise. When someone says "HashMap lookup is O(1)", they mean average case — worst case is O(n) with pathological hash collisions.

```
Quick sort:
Best case:    O(n log n)  — good pivot selection
Average case: O(n log n)  — random pivot
Worst case:   O(n²)       — already sorted + bad pivot (e.g., always pick first)
```

## Space Complexity

Big-O applies to memory usage too, not just time.

```rust
fn needs_extra_space(data: &[i32]) -> Vec<i32> {
    let mut copy = data.to_vec();  // O(n) extra space
    copy.sort();
    copy
}

fn in_place(data: &mut [i32]) {
    data.sort();  // O(log n) extra space (recursion stack)
}

fn constant_space(data: &[i32]) -> i32 {
    let mut sum = 0;  // O(1) extra space
    for &val in data {
        sum += val;
    }
    sum
}
```

The trade-off: **you can often trade space for time** (or vice versa).

| Approach | Time | Space | Example |
|----------|------|-------|---------|
| Brute force | O(n²) | O(1) | Check all pairs for duplicates |
| Hash set | O(n) | O(n) | Track seen items in a set |
| Sorted | O(n log n) | O(1)* | Sort then check adjacent elements |

## Amortized Analysis

Some operations are usually fast but occasionally slow. **Amortized analysis** averages the cost over many operations.

```
Vec::push — Amortized O(1):

Push #1:  Write to slot 0.            Cost: 1
Push #2:  Resize (copy 1) + write.    Cost: 2
Push #3:  Write to slot 2.            Cost: 1
Push #4:  Resize (copy 3) + write.    Cost: 4
Push #5:  Write to slot 4.            Cost: 1
Push #6:  Write to slot 5.            Cost: 1
Push #7:  Write to slot 6.            Cost: 1
Push #8:  Resize (copy 7) + write.    Cost: 8
                                      ──────
Total cost for 8 pushes:              19
Average cost per push:                19/8 ≈ 2.4 → O(1)
```

The resize operations are expensive but happen exponentially less often, so the average stays constant.

**Warning for real-time systems**: amortized O(1) means occasional O(n) spikes. If you can't tolerate latency spikes (audio processing, game physics, trading systems), you might need to pre-allocate with `Vec::with_capacity()`.

## Common Traps

### Trap 1: "O(1) is Always Fast"

No. O(1) means the time doesn't grow with input, but the constant can be huge.

```rust
fn o1_but_slow() -> i32 {
    let mut sum = 0;
    for i in 0..1_000_000 {
        sum += i;
    }
    sum
}
```

This is O(1) (no input-dependent loop) but does a million operations. An O(n) algorithm with a small constant on small input would be faster.

### Trap 2: "O(n) is Always Worse Than O(log n)"

For small n, O(n) with a small constant beats O(log n) with a large constant.

```
Algorithm A: O(n) with constant 1     → cost = n
Algorithm B: O(log n) with constant 100 → cost = 100 * log(n)

n = 10:     A costs 10,    B costs 332    ← A is faster!
n = 1000:   A costs 1000,  B costs 996    ← about equal
n = 10000:  A costs 10000, B costs 1328   ← B is faster
```

This is why Rust's sort uses insertion sort (O(n²)) for small sub-arrays inside its O(n log n) Tim sort — the constant factor matters for small n.

### Trap 3: Ignoring Cache Effects

Two O(n) algorithms can differ by 100x due to memory access patterns:

```rust
let data: Vec<i32> = (0..10_000_000).collect();

for &x in &data { /* cache-friendly: sequential access */ }

let indices: Vec<usize> = random_permutation(10_000_000);
for &i in &indices { let _ = data[i]; /* cache-hostile: random access */ }
```

Both are O(n), but the random access version is dramatically slower because of cache misses.

### Trap 4: Hidden Loops

```rust
fn looks_like_on(data: &[String]) -> Vec<String> {
    let mut result = Vec::new();
    for item in data {
        if !result.contains(item) {  // contains() is O(n) — hidden inner loop!
            result.push(item.clone());
        }
    }
    result
}
```

This looks like O(n) but is actually O(n²) because `contains()` scans the result vector each time. Use a `HashSet` for O(n) deduplication.

## How to Analyze Your Own Code

### Step 1: Identify the Input Variable

What is "n"? It might be array length, number of users, file size, etc.

### Step 2: Count the Loops

```
No loop:           → O(1)
Single loop:       → O(n)
Nested loops:      → O(n²), O(n³), etc.
Loop halving:      → O(log n)
Loop + inner loop halving: → O(n log n)
```

### Step 3: Check for Hidden Costs

Look for function calls inside loops that might themselves be O(n):

```rust
for item in &data {
    if other_data.contains(item) {  // ← O(m) inside O(n) loop = O(n*m)
        // ...
    }
}
```

### Step 4: Consider Recursion

For recursive functions, draw the call tree. The total work is the sum of work across all nodes in the tree.

```
T(n) = 2*T(n/2) + O(n)  → Merge sort → O(n log n)
T(n) = T(n/2) + O(1)    → Binary search → O(log n)
T(n) = 2*T(n-1) + O(1)  → Naive fibonacci → O(2^n)
```

## Exercises

### Exercise 1: Determine Big-O

For each function, determine the time complexity:

```rust
// Function A
fn mystery_a(n: usize) -> usize {
    let mut count = 0;
    let mut i = n;
    while i > 0 {
        count += 1;
        i /= 2;
    }
    count
}

// Function B
fn mystery_b(data: &[i32]) -> i32 {
    let mut sum = 0;
    for i in 0..data.len() {
        for j in i..data.len() {
            sum += data[i] * data[j];
        }
    }
    sum
}

// Function C
fn mystery_c(data: &[i32]) -> Vec<i32> {
    let mut result = data.to_vec();
    result.sort();
    result.dedup();
    result
}

// Function D
fn mystery_d(n: usize) -> usize {
    if n <= 1 {
        return 1;
    }
    mystery_d(n - 1) + mystery_d(n - 1)
}

// Function E
fn mystery_e(data: &[i32], target: i32) -> bool {
    for &val in data {
        if val == target {
            return true;
        }
    }
    false
}
```

Answers: A = O(log n), B = O(n²), C = O(n log n), D = O(2^n), E = O(n)

### Exercise 2: Optimize This Code

The following function finds common elements between two arrays. It's O(n*m). Rewrite it to be O(n + m):

```rust
fn common_elements_slow(a: &[i32], b: &[i32]) -> Vec<i32> {
    let mut result = Vec::new();
    for &x in a {
        for &y in b {
            if x == y && !result.contains(&x) {
                result.push(x);
            }
        }
    }
    result
}
```

Hint: use a `HashSet`.

### Exercise 3: Predict and Verify

Write a program that measures the execution time of an O(n²) function for n = 1000, 2000, 4000, 8000. Verify that doubling n roughly quadruples the time:

```rust
use std::time::Instant;

fn quadratic_work(n: usize) -> usize {
    let mut count = 0;
    for _ in 0..n {
        for _ in 0..n {
            count += 1;
        }
    }
    count
}

fn main() {
    for &n in &[1000, 2000, 4000, 8000] {
        let start = Instant::now();
        quadratic_work(n);
        let elapsed = start.elapsed();
        println!("n={:>5}: {:?}", n, elapsed);
    }
}
```

---

Next: [Lesson 03: Linked Lists](./03-linked-lists.md)
