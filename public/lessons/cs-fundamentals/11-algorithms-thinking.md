# Lesson 11: Algorithms Thinking — How to Reason About Efficiency

## This Is NOT a LeetCode Lesson

We're not here to memorize algorithms. We're here to build **intuition** — the ability to
look at a problem and immediately sense whether a solution will be fast, slow, or
catastrophically slow. This is the difference between a cook who follows recipes and a chef
who understands heat, timing, and chemistry.

The goal: when someone says "we'll just loop through every pair," you should feel a twinge
of concern. When someone says "we'll use a hash map," you should understand *why* that helps.

---

## The Phonebook Analogy — Three Ways to Find a Name

You have a phonebook with 1,000,000 entries. You need to find "Smith, John."

### Strategy 1: Linear Search — O(n)
Start at page 1. Read every name. "Aaronson... Adams... Baker..." Keep going until you find
Smith. On average, you'll check 500,000 names. If the book doubled in size, you'd check
twice as many.

### Strategy 2: Binary Search — O(log n)
Open to the middle. "M" — Smith comes after M, so throw away the first half. Open to the
middle of the remaining half. "R" — Smith comes after R. Keep halving. For 1,000,000
entries, you'll make about **20 comparisons**. If the book doubled to 2,000,000, you'd
make **21** comparisons. One more. That's the power of logarithms.

### Strategy 3: Hash Lookup — O(1)
Someone gives you a magic formula: take the name, run it through a function, and it tells
you the exact page number. "Smith, John" → page 847,293. Go directly there. The book could
have 10 entries or 10 billion — it still takes one lookup.

```
  LINEAR SEARCH:    [?][?][?][?][?][?][?][?][?][!]
                     1   2   3   4   5   6   7   8   9  10
                     Check each one until you find it.

  BINARY SEARCH:    [         ?         ]
                    [    ?    ]            ← wrong half, discard
                         [  ?  ]
                          [ !]             ← found in ~3 steps
                     1   2   3   4   5   6   7   8   9  10

  HASH LOOKUP:      ────────────────────> [!]
                     "Smith" → hash → position 10. Done.
```

---

## Big-O: How Does the Work GROW?

Big-O notation doesn't tell you exactly how long something takes. It tells you the **shape
of the growth curve** — how the work scales as input size increases.

Analogy: if someone asks "how much does shipping cost?", Big-O doesn't say "$4.50." It says
"the cost grows linearly with weight" (O(n)) or "the cost is flat regardless of weight"
(O(1)). It's about the *pattern*, not the exact number.

```
  Work
  ▲
  │                                                    O(2^n)
  │                                                  /
  │                                                /
  │                                             /
  │                                         /
  │                                     ╱        O(n²)
  │                                 ╱          ╱
  │                              ╱          ╱
  │                          ╱          ╱
  │                      ╱          ╱
  │                  ╱          ╱╱
  │              ╱         ╱╱           O(n log n)
  │          ╱        ╱╱            ╱──────────────
  │       ╱      ╱╱           ╱────
  │    ╱    ╱╱          ╱────
  │  ╱  ╱╱       ╱────                 O(n)
  │╱╱╱     ╱────                  ─────────────────
  │── ────         O(log n)  ─────
  │───── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    O(1)
  └──────────────────────────────────────────────> Input size (n)
```

| Big-O       | Name            | Example                              | Growth                    |
|-------------|-----------------|--------------------------------------|---------------------------|
| O(1)        | Constant        | Hash map lookup, array index         | Same work regardless      |
| O(log n)    | Logarithmic     | Binary search, balanced BST lookup   | Barely grows              |
| O(n)        | Linear          | Scanning a list, simple loop         | Doubles with input        |
| O(n log n)  | Linearithmic    | Good sorting (merge sort, etc.)      | Slightly worse than linear|
| O(n²)       | Quadratic       | Nested loops, bubble sort            | 10x input → 100x work    |
| O(2^n)      | Exponential     | Brute-force subsets, naive recursion  | Absolutely explodes       |

---

## Real Numbers at Scale

Theory is nice. Let's make it concrete. For n = 1,000,000 items:

```
  ┌──────────────┬────────────────────────────────────────────┐
  │  Algorithm   │  Operations for n = 1,000,000              │
  ├──────────────┼────────────────────────────────────────────┤
  │  O(1)        │  1                                         │
  │  O(log n)    │  20                                        │
  │  O(n)        │  1,000,000                                 │
  │  O(n log n)  │  20,000,000                                │
  │  O(n²)       │  1,000,000,000,000  (ONE TRILLION)         │
  │  O(2^n)      │  More than atoms in the observable universe│
  └──────────────┴────────────────────────────────────────────┘
```

If each operation takes 1 nanosecond:
- O(log n) = 20 nanoseconds (instant)
- O(n) = 1 millisecond (blink and you miss it)
- O(n log n) = 20 milliseconds (imperceptible)
- O(n²) = **11.5 days**
- O(2^n) = longer than the age of the universe

This is why algorithm choice matters. The difference between O(n) and O(n²) isn't "a bit
slower." It's the difference between *milliseconds* and *days*.

---

## Time vs. Space Trade-offs — Paying for a Bigger Desk

Imagine you're an accountant with a tiny desk. Every time you need a document, you walk to
the filing cabinet, pull it out, use it, then put it back. Slow, but your desk stays clean
(low space usage).

Now imagine a massive desk where you spread out every document you might need. Finding
anything is instant — just glance down. But you need a much bigger desk (more memory).

This is the fundamental **time-space trade-off**: use more memory to save time.

### Example: Caching

```python
# WITHOUT cache — O(n) every time we check for duplicates
def has_duplicate_slow(items):
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if items[i] == items[j]:
                return True       # O(n²) — checking every pair
    return False

# WITH cache (hash set) — O(n) total, O(1) per lookup
def has_duplicate_fast(items):
    seen = set()                  # Extra space: O(n)
    for item in items:
        if item in seen:
            return True           # O(1) lookup
        seen.add(item)
    return False
```

The fast version uses O(n) extra memory (the set) but runs in O(n) time instead of O(n²).
For a million items, that's the difference between 1 second and 11 days.

### Example: Memoization

```python
# WITHOUT memoization — O(2^n), recomputes the same values over and over
def fib_slow(n):
    if n <= 1:
        return n
    return fib_slow(n - 1) + fib_slow(n - 2)

# fib_slow(40) makes about 1 BILLION recursive calls
# fib_slow(50) would take hours

# WITH memoization — O(n), each value computed exactly once
def fib_fast(n, memo={}):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_fast(n - 1, memo) + fib_fast(n - 2, memo)
    return memo[n]

# fib_fast(50) returns instantly
```

Analogy: memoization is writing answers in a notebook. The first time you compute fib(35),
it takes work. But you write down the answer. Next time someone asks for fib(35), you just
look it up. The notebook costs paper (memory), but saves enormous time.

---

## Common Algorithm Patterns

You don't need to memorize hundreds of algorithms. Most problems use a handful of recurring
patterns. Here are the big ones:

### 1. Two Pointers — Two Bookmarks Moving Through a Book

Place one bookmark at the start and one at the end (or both at the start). Move them
toward each other (or in the same direction) based on some condition.

```
  Find a pair that sums to 10 in a sorted array:
  [1, 2, 4, 5, 7, 8, 9]
   L →                ← R     L + R = 1 + 9 = 10 ✓ Found!

  If sum too small, move L right (make it bigger).
  If sum too big, move R left (make it smaller).
```

```go
// Two pointers: find pair summing to target in sorted slice
func twoSum(nums []int, target int) (int, int, bool) {
    left, right := 0, len(nums)-1

    for left < right {
        sum := nums[left] + nums[right]
        if sum == target {
            return left, right, true
        } else if sum < target {
            left++   // Need a bigger number, move left pointer right
        } else {
            right--  // Need a smaller number, move right pointer left
        }
    }
    return 0, 0, false
}
// O(n) instead of O(n²) with brute-force nested loops
```

### 2. Divide and Conquer — Sorting Cards by Splitting

You have a messy pile of 1,000 cards to sort. Strategy: split into two piles of 500. Sort
each half (recursively split those too). Then merge the two sorted halves together.

```
  Merge Sort Visualization:

  [38, 27, 43, 3, 9, 82, 10]        ← unsorted
        /                    \
  [38, 27, 43, 3]     [9, 82, 10]   ← split in half
    /         \          /       \
  [38,27]  [43,3]    [9,82]   [10]  ← split again
   / \       / \       / \      |
  38  27   43   3    9   82    10    ← single elements (trivially sorted)
   \ /       \ /       \ /      |
  [27,38]  [3,43]    [9,82]   [10]  ← merge pairs
    \         /          \       /
  [3, 27, 38, 43]    [9, 10, 82]    ← merge halves
        \                  /
  [3, 9, 10, 27, 38, 43, 82]        ← merge final → sorted!
```

This gives O(n log n) — you split log n times, and each level does O(n) work merging.

### 3. Memoization — The Answer Notebook

Already covered above with Fibonacci. The pattern: if you see the same subproblem appearing
multiple times, store results the first time and look them up on subsequent calls.

```
  Fibonacci call tree WITHOUT memoization:

                    fib(5)
                  /        \
              fib(4)        fib(3)        ← fib(3) computed TWICE
             /     \        /    \
          fib(3)  fib(2)  fib(2) fib(1)   ← fib(2) computed THREE times
          /    \
       fib(2) fib(1)                      ← massive redundancy!

  WITH memoization: each unique call computed ONCE,
  then looked up from the notebook.
```

### 4. Greedy — Always Take the Biggest Coin

Making change for $0.67 with US coins: always grab the largest coin that fits.
- Quarter (25¢)? Yes. Remaining: $0.42
- Quarter (25¢)? Yes. Remaining: $0.17
- Dime (10¢)? Yes. Remaining: $0.07
- Nickel (5¢)? Yes. Remaining: $0.02
- Penny (1¢)? Yes. Remaining: $0.01
- Penny (1¢)? Yes. Done! 6 coins.

Greedy works when the locally optimal choice leads to the globally optimal solution. It
doesn't always work (for some coin systems, greedy gives the wrong answer), but when it
does, it's beautifully simple.

```rust
// Greedy: make change with fewest coins (US denominations)
fn make_change(mut amount: u32) -> Vec<u32> {
    let coins = [25, 10, 5, 1];
    let mut result = Vec::new();

    for &coin in &coins {
        while amount >= coin {
            result.push(coin);
            amount -= coin;
        }
    }
    result
}

fn main() {
    let coins = make_change(67);
    println!("Coins: {:?}", coins);
    // [25, 25, 10, 5, 1, 1] — 6 coins
    println!("Total coins: {}", coins.len());
}
```

---

## When O(n²) Is Actually Fine

Here's a secret experienced engineers know: **Big-O doesn't tell the whole story.**

Big-O describes behavior as n approaches infinity. But your n might be 50. For small n,
a "bad" algorithm with low overhead can beat a "good" algorithm with high overhead.

```
  Actual time (not just Big-O):

  Insertion sort: ~0.5 * n²     (simple, low overhead, cache-friendly)
  Merge sort:     ~10 * n log n (complex, allocations, pointer chasing)

  For n = 20:
    Insertion sort: 0.5 * 400   = 200 units
    Merge sort:     10 * 20 * 4 = 800 units   ← SLOWER!

  For n = 10,000:
    Insertion sort: 0.5 * 100,000,000 = 50,000,000 units
    Merge sort:     10 * 10,000 * 13  = 1,300,000 units  ← 38x FASTER
```

This is why many real-world sorting algorithms (like Rust's `sort()` and Python's Timsort)
use insertion sort for small arrays and switch to merge sort for large ones. The "crossover
point" is typically around n = 10-30.

**Rules of thumb:**
- n < 100? Almost anything is fine. Use what's simplest.
- n < 10,000? O(n²) might be OK. Benchmark if unsure.
- n > 100,000? Algorithm choice matters a lot. O(n²) is probably unacceptable.
- n > 1,000,000? You need O(n log n) or better. Period.

---

## Profiling Before Optimizing — Measure, Don't Guess

Imagine a chef who decides to buy a faster oven because meals are taking too long. But the
actual bottleneck is the 30-minute prep work — not the 5-minute baking. A faster oven
wouldn't help at all.

The same applies to code. Before optimizing, **measure** where the time is actually spent.

```python
import cProfile

def slow_function():
    total = 0
    for i in range(1000000):
        total += i ** 2
    return total

def fast_function():
    return sum(i ** 2 for i in range(1000000))

def main():
    slow_function()
    fast_function()

# Profile to see where time is spent
cProfile.run('main()')
```

```go
package main

import (
    "fmt"
    "runtime"
    "time"
)

func main() {
    // Simple timing
    start := time.Now()

    // ... your algorithm here ...
    data := make([]int, 1_000_000)
    for i := range data {
        data[i] = i
    }

    elapsed := time.Since(start)
    fmt.Printf("Took: %v\n", elapsed)

    // Memory stats
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    fmt.Printf("Heap in use: %d KB\n", m.HeapInuse/1024)
}
// For serious profiling, use: go tool pprof
```

---

## Amdahl's Law — The Bottleneck Principle

If 95% of your program runs instantly and 5% is slow, even making the fast part infinitely
faster gives you almost no improvement. You must fix the slow part.

```
  Your program: [=====fast=====][slow]
                     95%          5%

  Make the fast part 10x faster:
  [=f=][slow]
   9.5%  5%     → total speedup: ~5%    (barely noticeable)

  Make the slow part 10x faster:
  [=====fast=====][s]
       95%       0.5%  → total speedup: ~4.7%  (also modest!)

  The REAL lesson: if 5% of your code takes 50% of the time,
  focus ALL your effort there.
```

Analogy: if your commute is 50 minutes of highway driving and 10 minutes at a traffic
light, buying a faster car doesn't help. You need a better route through the light.

---

## Real-World Data Structures — Why They Exist

### Why databases use B-trees (not binary trees)

A hard disk is like a warehouse where you can only retrieve items in crate-sized batches.
You can't grab one book — you have to bring the whole crate to the loading dock, find your
book, then send the crate back.

A B-tree is designed for this: each node holds many keys (like a whole crate of sorted
index cards), so one disk read gives you lots of useful information. A binary tree node
holds just one key — so you'd need one disk read per level. With millions of records, a
binary tree might be 20 levels deep (20 disk reads). A B-tree is typically 3-4 levels deep
(3-4 disk reads).

```
  Binary tree (one key per node):        B-tree (many keys per node):

       50                                [10 | 30 | 50 | 70 | 90]
      /  \                               /    |    |    |    |    \
    25    75          vs.          [1-9] [11-29] [31-49] [51-69] ...
   / \   / \
  12 37 62  87                    Each node = one disk read
                                  3 levels covers millions of records
  20 levels for 1M records
```

### Why hash maps are everywhere

A hash map gives O(1) average lookup. It's like having a magic filing system: you compute
a formula on the key, and it tells you exactly which drawer to check.

```
  Hash map: name → phone number

  hash("Alice") = 3   →  bucket[3]: ("Alice", "555-0101")
  hash("Bob")   = 7   →  bucket[7]: ("Bob", "555-0202")
  hash("Carol") = 3   →  bucket[3]: ("Alice","555-0101") → ("Carol","555-0303")
                                      ↑ collision! Same bucket, linked list.

  Average case: O(1) — go directly to the bucket.
  Worst case: O(n) — every key hashes to the same bucket (degenerate).
```

```rust
use std::collections::HashMap;

fn main() {
    // Hash map: O(1) average lookup, insertion, deletion
    let mut phonebook: HashMap<&str, &str> = HashMap::new();

    phonebook.insert("Alice", "555-0101");   // O(1)
    phonebook.insert("Bob", "555-0202");     // O(1)

    // Lookup: O(1) average — no scanning needed
    match phonebook.get("Alice") {
        Some(number) => println!("Alice's number: {}", number),
        None => println!("Not found"),
    }

    // Compare with a Vec: finding Alice means scanning every entry — O(n)
    let phonebook_vec: Vec<(&str, &str)> = vec![
        ("Alice", "555-0101"),
        ("Bob", "555-0202"),
    ];

    // O(n) search — must check each element
    for (name, number) in &phonebook_vec {
        if *name == "Alice" {
            println!("Found Alice: {}", number);
            break;
        }
    }
}
```

---

## Putting It Together: Choosing the Right Approach

Here's a decision framework:

```
  "I need to find an element"
       │
       ├── Is the data sorted?
       │      ├── Yes → Binary search: O(log n)
       │      └── No  → Can I sort it first?
       │                  ├── Yes, and I'll search many times → Sort O(n log n) + search O(log n)
       │                  └── No, or only searching once → Linear scan: O(n)
       │
       ├── Do I need frequent lookups?
       │      └── Yes → Use a hash map: O(1) average
       │
       └── Do I need the data ordered AND searchable?
              └── Yes → Use a balanced BST / B-tree: O(log n)
```

```
  "I need to process all pairs"
       │
       ├── Can I avoid checking all pairs?
       │      ├── Sorting + two pointers: O(n log n) instead of O(n²)
       │      └── Hash map to find complements: O(n) instead of O(n²)
       │
       └── No way around it?
              └── O(n²) — but make sure n is small enough
```

---

## Exercises

### Exercise 1: Big-O Identification
What is the Big-O of each function? Explain your reasoning.

```python
# Function A
def func_a(items):
    return items[0] if items else None

# Function B
def func_b(items):
    for item in items:
        print(item)

# Function C
def func_c(items):
    for i in items:
        for j in items:
            print(i, j)

# Function D
def func_d(n):
    while n > 1:
        n = n // 2
        print(n)

# Function E
def func_e(items):
    if len(items) <= 1:
        return items
    mid = len(items) // 2
    left = func_e(items[:mid])
    right = func_e(items[mid:])
    return merge(left, right)  # merge is O(n)
```

### Exercise 2: The Crossover Point
Implement both insertion sort and merge sort. Time them on arrays of size 5, 10, 20, 50,
100, 1000, and 10000. At what size does merge sort start winning? Plot the results if you
can.

### Exercise 3: Hash Map From Scratch
Implement a simple hash map in Python or Go:
- Fixed-size array of buckets (start with 16).
- Hash function: `hash(key) % num_buckets`.
- Handle collisions with chaining (linked list per bucket).
- Implement `insert(key, value)`, `get(key)`, and `delete(key)`.
- Count collisions. What happens when you insert 1000 items into 16 buckets vs. 1024?

### Exercise 4: Memoization in Practice
Write a function that counts the number of ways to climb n stairs, taking 1 or 2 steps at
a time. First write the naive recursive version. Time it for n=30, n=35, n=40. Then add
memoization and time again. What's the speedup?

### Exercise 5: Profiling a Real Program
Take any program you've written (or write a data-processing script that reads a file and
computes statistics). Profile it. Where does it spend the most time? Was it where you
expected? Optimize the bottleneck and measure the improvement.

### Exercise 6: Space-Time Trade-off
You have a list of 10 million integers and need to answer "is X in the list?" queries
thousands of times. Compare three approaches:
1. Unsorted list, linear scan each time.
2. Sort once, binary search each time.
3. Build a hash set once, O(1) lookup each time.
Measure memory usage and query time for each.

---

## Key Takeaways

1. **Big-O describes growth, not speed.** It tells you how work scales as input grows —
   the shape of the curve, not the exact time.
2. **The numbers matter.** O(n²) for n=1,000,000 is a trillion operations. O(log n) is 20.
   Know when algorithm choice is critical.
3. **Time and space trade off.** Hash maps, caches, and memoization spend memory to buy
   speed. This is almost always worth it.
4. **Small n forgives everything.** If n < 100, use the simplest solution. Don't
   over-engineer.
5. **Measure before you optimize.** Profile your code. The bottleneck is rarely where you
   think it is. Fix the traffic light, not the car.
6. **Amdahl's law:** speeding up the fast part doesn't help. Find the 5% that takes 50%
   of the time.
7. **Data structures exist for a reason.** B-trees for disk. Hash maps for lookups. Sorted
   arrays for binary search. Choosing the right structure IS choosing the right algorithm.
