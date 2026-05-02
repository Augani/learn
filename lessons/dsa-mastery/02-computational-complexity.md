# Lesson 02: Computational Complexity — Big-O and Beyond

> **Analogy**: When someone asks how long your commute takes, you
> say "about 2 hours" — not "7,243 seconds." You drop the
> irrelevant precision and communicate the *scale*. That's what
> Big-O notation does for algorithms: it tells you how performance
> scales as input grows, without drowning you in exact operation
> counts that depend on your specific machine, compiler, and
> what else is running.

---

## Why This Matters

In Lesson 01, we saw that a list-based lookup takes up to N steps
while a hash set takes ~1 step. We described that informally. But
when you're comparing algorithms, debating design decisions, or
reading a technical paper, you need a shared language for
describing performance.

That language is **asymptotic notation** — Big-O, Omega, and
Theta. By the end of this lesson, you'll be able to:

- Read and write Big-O, Omega, and Theta notation
- Analyze the time and space complexity of simple loops and
  recursive functions
- Recognize the common complexity classes and how they compare
- Explain *why* we care about asymptotic behavior instead of
  exact counts
- Avoid the most common mistakes beginners make with Big-O

---

## The Travel Time Analogy — Deeper

Suppose three friends describe their commute:

```
Alice: "About 30 minutes"
Bob:   "About 2 hours"
Carol: "About 30 minutes, but sometimes 5 hours if there's
        a traffic jam on the bridge"
```

You immediately know Bob's commute is worse than Alice's. You
know Carol's is *usually* fine but has a nasty worst case. You
didn't need to know the exact number of traffic lights, the
speed limit on each road, or whether Alice drives a sedan or
a truck.

Asymptotic notation works the same way:

```
Algorithm A: "About n steps"           ← like a 30-min commute
Algorithm B: "About n² steps"          ← like a 2-hour commute
Algorithm C: "Usually n log n steps,   ← usually fine,
              but n² in the worst case"   bad worst case
```

The exact constants don't matter when you're choosing between
an algorithm that takes 3n steps and one that takes n² steps.
At n = 1,000, that's 3,000 vs 1,000,000. The constant 3 is
noise compared to the shape of the growth.

---

## The Three Notations

### Big-O: Upper Bound ("at most this bad")

Big-O describes the **worst-case growth rate**. When we say an
algorithm is O(n²), we mean: as the input size n grows, the
number of steps grows *at most* proportionally to n².

```
f(n) is O(g(n)) means:

  There exist constants c > 0 and n₀ such that
  f(n) ≤ c · g(n)  for all n ≥ n₀

  In plain English:
  "Eventually, f(n) stays below some constant multiple of g(n)."
```

Think of it as a ceiling. The actual runtime might be lower, but
it won't grow faster than this.

### Big-Ω (Omega): Lower Bound ("at least this much")

Omega describes the **best-case growth rate**. When we say an
algorithm is Ω(n), we mean: no matter how lucky you get, the
algorithm must do *at least* proportionally n steps.

```
f(n) is Ω(g(n)) means:

  There exist constants c > 0 and n₀ such that
  f(n) ≥ c · g(n)  for all n ≥ n₀

  In plain English:
  "Eventually, f(n) stays above some constant multiple of g(n)."
```

Think of it as a floor. The algorithm can't do better than this.

### Big-Θ (Theta): Tight Bound ("exactly this growth rate")

Theta means the algorithm is *both* O(g(n)) and Ω(g(n)). The
growth rate is pinned down precisely.

```
f(n) is Θ(g(n)) means:

  f(n) is O(g(n))  AND  f(n) is Ω(g(n))

  In plain English:
  "f(n) grows at exactly the same rate as g(n),
   up to constant factors."
```

```
Visual summary:

  Big-O (upper bound)     Big-Ω (lower bound)     Big-Θ (tight bound)
  ─────────────────────   ─────────────────────   ─────────────────────
        c·g(n)                                          c₂·g(n)
       ╱                        f(n)                   ╱
      ╱   f(n)                 ╱                      ╱   f(n)
     ╱   ╱                    ╱                      ╱   ╱
    ╱   ╱                    ╱  c·g(n)              ╱   ╱
   ╱   ╱                    ╱  ╱                   ╱   ╱  c₁·g(n)
  ╱   ╱                    ╱  ╱                   ╱   ╱  ╱
  f(n) ≤ c·g(n)          f(n) ≥ c·g(n)          c₁·g(n) ≤ f(n) ≤ c₂·g(n)
```

In practice, most people say "Big-O" when they really mean Theta.
When someone says "binary search is O(log n)," they usually mean
Θ(log n) — it's both the upper and lower bound for the worst case.
This is technically sloppy but universally understood.

---

## Common Complexity Classes

Here are the complexity classes you'll encounter constantly,
ordered from fastest to slowest growth:

```
GROWTH RATE COMPARISON (n = input size)
═══════════════════════════════════════════════════════════════

  n        O(1)   O(log n)  O(n)    O(n log n)  O(n²)      O(2ⁿ)
  ──────   ────   ────────  ──────  ──────────  ─────────  ──────────
  1        1      0         1       0           1          2
  10       1      3         10      33          100        1,024
  100      1      7         100     664         10,000     1.27 × 10³⁰
  1,000    1      10        1,000   9,966       1,000,000  TOO BIG
  10,000   1      13        10,000  132,877     10⁸        TOO BIG
  100,000  1      17        10⁵     1.7 × 10⁶  10¹⁰       TOO BIG

  ──────────────────────────────────────────────────────────────────
  "TOO BIG" = more operations than atoms in the observable universe
```

```
VISUAL: How each class grows as n increases

Steps
  ▲
  │                                              ╱ O(2ⁿ)
  │                                            ╱
  │                                          ╱
  │                                        ╱
  │                                      ╱
  │                                ·····    O(n²)
  │                          ·····
  │                    ·····
  │              ·····
  │        ·····                ___________  O(n log n)
  │   ····           _________/
  │  ··        _____/
  │ ·    ____/ ─────────────────────────── O(n)
  │·____/
  │/  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ O(log n)
  │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ O(1)
  └──────────────────────────────────────► n
```

### What Each Class Feels Like

| Class | Name | Intuition | Example |
|-------|------|-----------|---------|
| O(1) | Constant | Doesn't care about input size | Array index access |
| O(log n) | Logarithmic | Halving the problem each step | Binary search |
| O(n) | Linear | Touch every element once | Linear search |
| O(n log n) | Linearithmic | Touch every element, log n times | Merge sort |
| O(n²) | Quadratic | Every pair of elements | Bubble sort |
| O(2ⁿ) | Exponential | Every subset of elements | Brute-force subset sum |

---

## Time Complexity: Analyzing Loops

The most common task in complexity analysis is looking at loops
and figuring out how many times the body executes.

### Single Loop — O(n)

```python
# How many times does the print run?
def print_all(items):
    for item in items:      # runs n times (n = len(items))
        print(item)         # 1 operation per iteration
    # Total: n iterations × O(1) work = O(n)
```

### Nested Loops — O(n²)

```python
# How many times does the print run?
def print_pairs(items):
    for i in items:             # outer: n times
        for j in items:         # inner: n times PER outer iteration
            print(i, j)         # runs n × n = n² times
    # Total: O(n²)
```

### Loop with Halving — O(log n)

```python
# How many times does the print run?
def halving(n):
    while n > 1:
        print(n)
        n = n // 2
    # n → n/2 → n/4 → n/8 → ... → 1
    # Number of halvings: log₂(n)
    # Total: O(log n)
```

### Loop with Doubling — O(log n)

```python
# How many times does the print run?
def doubling(n):
    i = 1
    while i < n:
        print(i)
        i = i * 2
    # i: 1 → 2 → 4 → 8 → ... → n
    # Number of doublings: log₂(n)
    # Total: O(log n)
```

### Nested Loop with Different Bounds — O(n × m)

```python
# When the loops iterate over different-sized inputs:
def cross_check(list_a, list_b):
    for a in list_a:            # n times
        for b in list_b:        # m times per outer iteration
            if a == b:
                print("match")
    # Total: O(n × m) — NOT O(n²) unless n = m
```

---

## Space Complexity

Time complexity measures *steps*. Space complexity measures
*extra memory* your algorithm uses beyond the input itself.

```python
# O(1) space — uses a fixed number of variables
def find_max(items):
    best = items[0]
    for item in items:
        if item > best:
            best = item
    return best
# 'best' is one variable regardless of input size → O(1) space

# O(n) space — creates a new collection proportional to input
def reverse_copy(items):
    result = []
    for item in reversed(items):
        result.append(item)
    return result
# 'result' grows to size n → O(n) space

# O(n) space — recursion uses stack frames
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
# Each call adds a stack frame. n calls deep → O(n) space
```

A common trade-off: you can often reduce time complexity by
using more space (caching results), or reduce space by accepting
slower time (recomputing instead of storing).

---

## Analyzing Recursive Functions

Recursion adds a twist: you need to figure out how many times
the function calls itself and how much work each call does.

### Linear Recursion — O(n)

```python
def sum_list(items, i=0):
    if i == len(items):
        return 0
    return items[i] + sum_list(items, i + 1)
# One call per element → n calls × O(1) work each = O(n)
```

### Binary Recursion — O(2ⁿ)

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
# Each call spawns TWO more calls
# Total calls roughly doubles each level → O(2ⁿ)
```

```
Call tree for fib(5):

                    fib(5)
                   /      \
              fib(4)      fib(3)
             /     \      /     \
         fib(3)  fib(2) fib(2) fib(1)
         /   \    / \    / \
     fib(2) fib(1) ...  ...
      / \
  fib(1) fib(0)

  Calls explode exponentially. fib(50) would take
  over a quadrillion calls.
```

### Divide-and-Conquer Recursion — O(n log n)

```python
def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])      # T(n/2)
    right = merge_sort(arr[mid:])     # T(n/2)
    return merge(left, right)         # O(n) work to merge
# Recurrence: T(n) = 2T(n/2) + O(n)
# Solution (Master Theorem): O(n log n)
```

```
Recursion tree for merge sort (n=8):

  Level 0:  [8 elements]                    → n work to merge
            /          \
  Level 1:  [4]        [4]                  → n work total
           / \        / \
  Level 2: [2] [2]  [2] [2]                → n work total
           /\ /\    /\ /\
  Level 3: [1][1]...                        → n work total

  log₂(n) levels × n work per level = O(n log n)
```

---

## Technical Deep-Dive: Complexity Analysis in Three Languages

Let's analyze a real function — finding if any two elements in
an array sum to a target value — and show the brute-force vs
optimized approach with complexity analysis.

### Brute Force: O(n²) time, O(1) space

```python
# Python — check every pair
def two_sum_brute(nums: list[int], target: int) -> bool:
    n = len(nums)
    for i in range(n):              # n iterations
        for j in range(i + 1, n):   # up to n-1 iterations
            if nums[i] + nums[j] == target:
                return True
    return False
# Time: O(n²) — nested loops over the same array
# Space: O(1) — only loop variables
```

```typescript
// TypeScript — check every pair
function twoSumBrute(nums: number[], target: number): boolean {
  const n = nums.length;
  for (let i = 0; i < n; i++) {           // n iterations
    for (let j = i + 1; j < n; j++) {     // up to n-1 iterations
      if (nums[i] + nums[j] === target) {
        return true;
      }
    }
  }
  return false;
}
// Time: O(n²)   Space: O(1)
```

```rust
// Rust — check every pair
fn two_sum_brute(nums: &[i32], target: i32) -> bool {
    let n = nums.len();
    for i in 0..n {
        for j in (i + 1)..n {
            if nums[i] + nums[j] == target {
                return true;
            }
        }
    }
    false
}
// Time: O(n²)   Space: O(1)
```

### Optimized: O(n) time, O(n) space

```python
# Python — use a hash set to remember what we've seen
def two_sum_fast(nums: list[int], target: int) -> bool:
    seen = set()                    # extra space: up to n elements
    for num in nums:                # n iterations
        complement = target - num
        if complement in seen:      # O(1) lookup
            return True
        seen.add(num)               # O(1) insert
    return False
# Time: O(n) — single pass, each lookup/insert is O(1)
# Space: O(n) — the set stores up to n elements
```

```typescript
// TypeScript — use a Set to remember what we've seen
function twoSumFast(nums: number[], target: number): boolean {
  const seen = new Set<number>();
  for (const num of nums) {
    const complement = target - num;
    if (seen.has(complement)) {   // O(1) lookup
      return true;
    }
    seen.add(num);                // O(1) insert
  }
  return false;
}
// Time: O(n)   Space: O(n)
```

```rust
// Rust — use a HashSet to remember what we've seen
use std::collections::HashSet;

fn two_sum_fast(nums: &[i32], target: i32) -> bool {
    let mut seen = HashSet::new();
    for &num in nums {
        let complement = target - num;
        if seen.contains(&complement) {
            return true;
        }
        seen.insert(num);
    }
    false
}
// Time: O(n)   Space: O(n)
```

The trade-off is clear: we spend O(n) extra memory to drop from
O(n²) time to O(n) time. For n = 1,000,000, that's the
difference between a trillion operations and a million.

---

## What If We Counted Exact Operations Instead?

This is a fair question. Why not just count the precise number
of operations and compare?

Let's try. Consider this simple loop:

```python
def sum_array(arr):
    total = 0                # 1 assignment
    for item in arr:         # n iterations
        total += item        # 1 addition + 1 assignment per iteration
    return total             # 1 return
```

Exact count: 1 + n × 2 + 1 = 2n + 2 operations.

Now consider a slightly different version:

```python
def sum_array_v2(arr):
    total = 0                # 1 assignment
    i = 0                    # 1 assignment
    while i < len(arr):      # n comparisons + n len() calls
        total += arr[i]      # 1 addition + 1 index + 1 assignment
        i += 1               # 1 addition + 1 assignment
    return total             # 1 return
```

Exact count: 2 + n × 5 + n + 1 = 6n + 3 operations.

So `sum_array_v2` does 3× more "operations" than `sum_array`.
Is it 3× slower?

**No.** Here's why exact counts are misleading:

```
Problem 1: What counts as "one operation"?
  - Is `arr[i]` one operation or two (bounds check + memory access)?
  - Is `len(arr)` one operation? (In Python, yes. In a linked list, no.)
  - Does the CPU execute `total += item` in 1 cycle or 3?

Problem 2: Constants depend on the machine.
  - A 2020 laptop and a 2024 server run the same code at
    different speeds. The exact count is meaningless across machines.

Problem 3: Constants don't matter at scale.
  - 2n + 2  vs  6n + 3
  - At n = 1,000,000: 2,000,002 vs 6,000,003
  - Both are "about n." Neither is anywhere close to n².
  - The difference between them is a constant factor (3×).
  - The difference between either of them and an O(n²) algorithm
    is a factor of n — which is 1,000,000×.
```

```
The key insight:

  When comparing algorithms, the SHAPE of the growth curve
  matters far more than the constant multiplier.

  3n vs 5n?     Same shape. Doesn't matter.
  3n vs 3n²?    Different shapes. HUGE difference at scale.

  ┌──────────────────────────────────────────┐
  │  n²                                      │
  │  │                              ·····    │
  │  │                        ·····          │
  │  │                  ·····                │
  │  │            ·····                      │
  │  │      ·····                            │
  │  │ ····                                  │
  │  │··  ─────────────────────── 5n         │
  │  │· ──────────────────────── 3n          │
  │  └──────────────────────────────► n      │
  │                                          │
  │  3n and 5n are practically the same line │
  │  n² is in a completely different league  │
  └──────────────────────────────────────────┘
```

This is why Big-O drops constants and lower-order terms. It
captures the *shape* — the thing that actually determines whether
your program finishes in seconds or centuries.

### When Constants DO Matter

There's a caveat. Constants matter when you're comparing two
algorithms with the *same* Big-O class. If algorithm A takes
2n steps and algorithm B takes 100n steps, they're both O(n),
but A is 50× faster in practice. At that point, you profile
and benchmark rather than relying on Big-O alone.

Big-O tells you which algorithms to *consider*. Benchmarking
tells you which one to *ship*.

---

## Common Mistakes

**Mistake 1: "O(2n) is different from O(n)"**

No. O(2n) = O(n). Constants are dropped. The growth rate is
the same — linear.

**Mistake 2: "O(n² + n) is O(n² + n)"**

No. O(n² + n) = O(n²). Lower-order terms are dropped. When n
is large, the n² term dominates so completely that the +n is
irrelevant.

**Mistake 3: Confusing best case, worst case, and average case**

Big-O is often used for worst case, but it's really just an
upper bound on *some* function. Be specific:
- "Worst-case time is O(n²)" — clear
- "Average-case time is O(n log n)" — also clear
- "It's O(n²)" — ambiguous (which case?)

**Mistake 4: Thinking O(1) means "fast"**

O(1) means the time doesn't grow with input size. But O(1)
could be 1 nanosecond or 1 hour — it's still constant. A hash
table lookup is O(1) but involves computing a hash, which takes
real time. For tiny inputs, a simple O(n) scan can beat an O(1)
hash lookup because the constant overhead of hashing is larger
than scanning 5 elements.

---

## Exercises

1. **Classify these functions**: For each code snippet, determine
   the time complexity in Big-O notation:

   ```python
   # (a)
   def mystery_a(n):
       for i in range(n):
           for j in range(n):
               for k in range(n):
                   print(i, j, k)

   # (b)
   def mystery_b(n):
       i = n
       while i > 0:
           print(i)
           i = i // 3

   # (c)
   def mystery_c(n):
       for i in range(n):
           j = 1
           while j < n:
               print(i, j)
               j *= 2
   ```

2. **Space complexity**: Determine the space complexity of each:

   ```python
   # (a) Build a matrix
   def make_grid(n):
       return [[0] * n for _ in range(n)]

   # (b) Recursive countdown
   def countdown(n):
       if n == 0:
           return
       countdown(n - 1)
   ```

3. **Growth rate ordering**: Rank these from slowest to fastest
   growth: O(n!), O(n²), O(2ⁿ), O(n log n), O(1), O(log n),
   O(n), O(n³)

4. **Practical reasoning**: You have two algorithms for the same
   problem:
   - Algorithm A: 1000n steps
   - Algorithm B: 2n² steps

   At what value of n does Algorithm A become faster than
   Algorithm B? What does this tell you about when Big-O
   analysis is most useful?

5. **Recursive analysis**: Draw the call tree for `fib(6)` using
   the naive recursive Fibonacci function. Count the total number
   of calls. How does this compare to the number of calls for
   `fib(7)`? What pattern do you see?

6. **"What if" reflection**: We showed that counting exact
   operations is impractical. But imagine you're optimizing a
   function that runs inside a tight loop executed billions of
   times per second (like a game engine's physics update). Would
   you care about constant factors then? Why or why not?

---

**Previous**: [Lesson 01 — What Are Data Structures and Why Do They Matter?](./01-what-are-data-structures.md)
**Next**: [Lesson 03 — Arrays and Dynamic Arrays](./03-arrays-and-dynamic-arrays.md)
