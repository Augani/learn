# Lesson 13: Searching Algorithms

> **Analogy**: You're playing a number-guessing game. Your
> friend picks a number between 1 and 100, and after each
> guess they say "higher" or "lower." A beginner checks 1,
> then 2, then 3 — that's linear search. A smart player
> always guesses the middle of the remaining range: 50, then
> 25 or 75, then 12 or 37 — halving the possibilities each
> time. That's binary search. In at most 7 guesses, you
> nail any number from 1 to 100. The same principle powers
> some of the most important algorithms in computer science:
> if you can eliminate half the candidates with each step,
> you turn an O(n) problem into an O(log n) one.

---

## Why This Matters

Searching is the most fundamental operation in computing. Every
database query, every dictionary lookup, every autocomplete
suggestion, every spell checker — they all search.

The question isn't *whether* you'll search, but *how fast* you
can do it. The answer depends on one critical factor: **is the
data sorted?**

- **Unsorted data**: You have no choice but to check every
  element. Linear search: O(n).
- **Sorted data**: You can exploit the ordering to skip huge
  chunks. Binary search: O(log n).

The difference is staggering at scale:

```
  SEARCH TIME COMPARISON — FINDING ONE ELEMENT

  n elements     Linear O(n)     Binary O(log n)     Speedup
  ─────────────────────────────────────────────────────────────
  100            100 checks      7 checks            14×
  10,000         10,000          14                  714×
  1,000,000      1,000,000       20                  50,000×
  1,000,000,000  1,000,000,000   30                  33,333,333×
```

Binary search on a billion elements takes 30 steps. Linear
search takes a billion. That's the power of logarithmic time.

This lesson covers four searching algorithms:

- **Linear search**: The baseline — works on anything, O(n)
- **Binary search**: The workhorse — requires sorted data, O(log n)
- **Interpolation search**: The gambler — guesses where the
  target *probably* is, O(log log n) average on uniform data
- **Exponential search**: The scout — finds the right range
  first, then binary searches within it, O(log n)

By the end, you'll understand:

- Why binary search requires sorted input (and what breaks if
  it doesn't)
- How the halving principle achieves O(log n)
- When interpolation search beats binary search (and when it
  doesn't)
- How exponential search handles unbounded or unknown-size data
- Whether we can ever beat O(n) on unsorted data (spoiler: not
  in the general case — but there are tricks)

> **Cross-reference**: The existing
> [`../data-structures/05-searching.md`](../data-structures/05-searching.md)
> covers linear and binary search in Rust with a focus on
> sorted-vs-unsorted trade-offs. This lesson goes deeper into
> the *why*, adds interpolation and exponential search, covers
> three languages, and explores the theoretical limits of
> searching.

---

## Linear Search — The Baseline

Linear search is the simplest possible search: start at the
beginning, check each element, stop when you find the target
(or reach the end).

It works on *any* data — sorted, unsorted, linked list, array,
stream. No preconditions. No setup. Just brute force.

```
  LINEAR SEARCH — FINDING 42 IN [17, 3, 42, 8, 25, 91, 6]

  Step 1: Check index 0 → 17 ≠ 42, continue
  Step 2: Check index 1 →  3 ≠ 42, continue
  Step 3: Check index 2 → 42 = 42, FOUND at index 2 ✓

  Best case:  O(1)  — target is the first element
  Worst case: O(n)  — target is last or not present
  Average:    O(n)  — check about n/2 elements on average
  Space:      O(1)  — no extra memory needed
```

Linear search is the right choice when:
- The data is unsorted and you can't sort it
- The collection is tiny (n < ~20)
- You only search once (sorting + binary search costs more)
- The data is a stream or linked list (no random access)

---

## Binary Search — The Halving Principle

Binary search is one of the most important algorithms in
computer science. The idea is deceptively simple: if the data
is sorted, you can eliminate half the remaining candidates with
each comparison.

### How It Works

1. Look at the middle element
2. If it's the target, done
3. If the target is smaller, search the left half
4. If the target is larger, search the right half
5. Repeat until found or the range is empty

```
  BINARY SEARCH — FINDING 23 IN [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]

  Array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
          0  1  2   3   4   5   6   7   8   9

  ─── Step 1: lo=0, hi=9, mid=4 ───

  [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
   ◄──────────  ▲  ──────────────────►
                mid=4
                arr[4]=16
                16 < 23 → search RIGHT half
                Set lo = mid + 1 = 5

  ─── Step 2: lo=5, hi=9, mid=7 ───

  [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
                      ◄────  ▲  ─────►
                             mid=7
                             arr[7]=56
                             56 > 23 → search LEFT half
                             Set hi = mid - 1 = 6

  ─── Step 3: lo=5, hi=6, mid=5 ───

  [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
                      ▲
                      mid=5
                      arr[5]=23
                      23 = 23 → FOUND at index 5 ✓

  Total comparisons: 3 (out of 10 elements)
  log₂(10) ≈ 3.32 — right on target
```

### Why It Requires Sorted Input

Binary search makes a critical assumption: if `arr[mid] < target`,
then *every element to the left of mid* is also less than the
target. This is only true if the array is sorted.

```
  WHAT HAPPENS ON UNSORTED DATA?

  Unsorted: [42, 3, 17, 8, 25, 91, 6]
  Looking for 17

  Step 1: mid=3, arr[3]=8
          8 < 17 → search right half
          But 17 is at index 2 — in the LEFT half!
          Binary search misses it entirely. ✗

  The sorted invariant is BROKEN, so the halving
  logic produces WRONG results.
```

### Why O(log n)?

Each step cuts the search space in half. Starting with n
elements:

```
  THE HALVING PRINCIPLE

  After step 1: n/2 elements remain
  After step 2: n/4 elements remain
  After step 3: n/8 elements remain
  ...
  After step k: n/2ᵏ elements remain

  We stop when n/2ᵏ = 1, i.e., 2ᵏ = n, i.e., k = log₂(n)

  Example: n = 1,000,000
  log₂(1,000,000) ≈ 20

  Twenty comparisons to search a million elements.
  That's the power of halving.
```

### Complexity

```
  BINARY SEARCH COMPLEXITY

  Time:   O(log n) — worst and average case
  Space:  O(1) iterative, O(log n) recursive (call stack)
  Requires: sorted input, random access (arrays, not linked lists)
```

### Common Pitfalls

**Integer overflow in mid calculation:**

```
  BAD:   mid = (lo + hi) / 2        ← lo + hi can overflow!
  GOOD:  mid = lo + (hi - lo) / 2   ← safe arithmetic
```

**Off-by-one errors:**

The most common bug in binary search is getting the boundary
updates wrong. The key rules:
- When `arr[mid] < target`: set `lo = mid + 1` (mid is too small)
- When `arr[mid] > target`: set `hi = mid - 1` (mid is too large)
- Loop while `lo <= hi` (not `lo < hi` — you'd miss the case
  where the target is the last remaining element)

---

## Interpolation Search — Educated Guessing

Binary search always checks the middle. But what if you could
make a smarter guess about *where* the target probably is?

If you're looking up "Smith" in a phone book, you don't open
to the middle — you open near the back, because S is late in
the alphabet. Interpolation search does the same thing: it
estimates the target's position based on its value relative to
the endpoints.

### How It Works

Instead of `mid = lo + (hi - lo) / 2`, interpolation search
computes:

```
  mid = lo + ((target - arr[lo]) / (arr[hi] - arr[lo])) × (hi - lo)
```

This formula estimates where the target would fall if the values
were uniformly distributed between `arr[lo]` and `arr[hi]`.

```
  INTERPOLATION SEARCH — FINDING 67 IN [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

  lo=0, hi=9
  arr[lo]=10, arr[hi]=100, target=67

  Estimate position:
  mid = 0 + ((67 - 10) / (100 - 10)) × (9 - 0)
      = 0 + (57 / 90) × 9
      = 0 + 0.633 × 9
      = 5.7 → round to 5 (or 6)

  Check arr[6] = 70
  70 > 67 → search left, set hi = 5

  lo=0, hi=5
  arr[lo]=10, arr[hi]=60, target=67... wait, 67 > 60.
  Target not in range → not found.

  Actually, let's re-check: arr[5]=60, arr[6]=70.
  With mid=6: 70 > 67 → hi = 5
  With mid=5: 60 < 67 → lo = 6
  lo > hi → not found? But 67 isn't in the array!

  Let's try FINDING 70 instead:
  lo=0, hi=9, arr[lo]=10, arr[hi]=100
  mid = 0 + ((70 - 10) / (100 - 10)) × 9 = 0 + (60/90) × 9 = 6
  arr[6] = 70 = target → FOUND in 1 step! ✓

  Binary search would have taken: mid=4 → mid=7 → mid=5 → mid=6
  That's 4 steps vs 1 step for interpolation search.
```

### Complexity

```
  INTERPOLATION SEARCH COMPLEXITY

  Best case:    O(1)          — lucky guess
  Average case: O(log log n)  — uniformly distributed data
  Worst case:   O(n)          — skewed distribution

  The O(log log n) average is remarkable:
  n = 1,000,000 → log₂(n) ≈ 20 → log₂(20) ≈ 4.3

  ~4 steps vs ~20 for binary search on uniform data!
```

### When It Shines (and When It Doesn't)

Interpolation search is excellent when:
- Data is uniformly distributed (evenly spaced values)
- The array is large (the log log n advantage matters more)

It's terrible when:
- Data is clustered or exponentially distributed
- Values are strings or non-numeric (hard to interpolate)

```
  UNIFORM vs SKEWED DISTRIBUTION

  Uniform: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  Interpolation guess is accurate → O(log log n)

  Skewed:  [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000000]
  Looking for 999999:
  mid = 0 + ((999999 - 1) / (1000000 - 1)) × 9 ≈ 9
  Guess is index 9 → arr[9] = 1000000 > 999999
  Now hi = 8, but arr[8] = 9 < 999999
  lo = 9 > hi = 8 → not found (correctly, 999999 isn't there)

  But if the skewed data had many values clustered at one end,
  interpolation search degrades to scanning one element at a
  time — O(n) worst case.
```

---

## Exponential Search — Finding the Range First

Exponential search is designed for situations where you don't
know the size of the data, or the target is likely near the
beginning. It works in two phases:

1. **Find the range**: Start at index 1, then double (1, 2, 4,
   8, 16, ...) until you overshoot the target
2. **Binary search within the range**: Once you've found a range
   `[i/2, i]` that contains the target, binary search within it

```
  EXPONENTIAL SEARCH — FINDING 35 IN [2, 3, 5, 8, 13, 21, 34, 55, 89, 144]

  Phase 1: Find the range (double the index each time)

  i=1:  arr[1]=3   < 35 → double, i=2
  i=2:  arr[2]=5   < 35 → double, i=4
  i=4:  arr[4]=13  < 35 → double, i=8
  i=8:  arr[8]=89  > 35 → STOP

  Target is in range [i/2, i] = [4, 8]

  Phase 2: Binary search in arr[4..8] = [13, 21, 34, 55, 89]

  lo=4, hi=8, mid=6: arr[6]=34 < 35 → lo=7
  lo=7, hi=8, mid=7: arr[7]=55 > 35 → hi=6
  lo=7 > hi=6 → not found

  Hmm, 35 isn't in the array. Let's find 34:

  Phase 1: same as above, range [4, 8]
  Phase 2: lo=4, hi=8, mid=6: arr[6]=34 = 34 → FOUND ✓

  Total steps: 4 (range finding) + 1 (binary search) = 5
```

### Why Not Just Binary Search?

Exponential search has two advantages:

1. **Works on unbounded data**: If you don't know the array
   size (e.g., searching an infinite sorted stream), you can't
   compute `mid = (0 + n-1) / 2`. Exponential search finds the
   upper bound first.

2. **Faster when the target is near the beginning**: If the
   target is at position p, exponential search takes O(log p)
   steps — not O(log n). For a target at position 10 in an
   array of 1 billion elements, that's ~4 steps instead of ~30.

### Complexity

```
  EXPONENTIAL SEARCH COMPLEXITY

  Phase 1 (range finding): O(log p) where p is the target's position
  Phase 2 (binary search):  O(log p) within the range [p/2, p]
  Total:                    O(log p)

  When p ≈ n: O(log n) — same as binary search
  When p << n: O(log p) — much faster than binary search

  Space: O(1)
  Requires: sorted input, random access
```

---

## Algorithm Comparison

```
  SEARCHING ALGORITHMS — SUMMARY

  ┌─────────────────────┬──────────┬──────────────┬──────────┬──────────────────────┐
  │ Algorithm           │ Best     │ Average      │ Worst    │ Requirements         │
  ├─────────────────────┼──────────┼──────────────┼──────────┼──────────────────────┤
  │ Linear search       │ O(1)     │ O(n)         │ O(n)     │ None                 │
  │ Binary search       │ O(1)     │ O(log n)     │ O(log n) │ Sorted, random access│
  │ Interpolation search│ O(1)     │ O(log log n)*│ O(n)     │ Sorted, uniform dist │
  │ Exponential search  │ O(1)     │ O(log p)     │ O(log n) │ Sorted, random access│
  └─────────────────────┴──────────┴──────────────┴──────────┴──────────────────────┘

  * O(log log n) average only with uniformly distributed data
  p = position of the target element

  WHEN TO USE WHICH:
  • Unsorted data, any size:           Linear search — only option
  • Sorted data, general purpose:      Binary search — reliable O(log n)
  • Sorted, uniform numeric data:      Interpolation search — O(log log n) avg
  • Sorted, target likely near start:  Exponential search — O(log p)
  • Sorted, unknown/unbounded size:    Exponential search — finds bounds first
```

---

## Technical Deep-Dive: Implementations

### Python

```python
# Python — Searching Algorithms


def linear_search(arr: list, target) -> int:
    """Linear search — works on any data.
    Time: O(n) | Space: O(1)
    Returns index of target, or -1 if not found.
    """
    for i, val in enumerate(arr):
        if val == target:
            return i
    return -1


def binary_search(arr: list, target) -> int:
    """Binary search — requires sorted input.
    Time: O(log n) | Space: O(1)
    Returns index of target, or -1 if not found.
    """
    lo, hi = 0, len(arr) - 1

    while lo <= hi:
        mid = lo + (hi - lo) // 2  # Avoids overflow

        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1


def interpolation_search(arr: list[int | float], target: int | float) -> int:
    """Interpolation search — best on uniformly distributed sorted data.
    Time: O(log log n) average, O(n) worst | Space: O(1)
    Returns index of target, or -1 if not found.
    """
    lo, hi = 0, len(arr) - 1

    while lo <= hi and arr[lo] <= target <= arr[hi]:
        # Avoid division by zero when all remaining elements are equal
        if arr[lo] == arr[hi]:
            if arr[lo] == target:
                return lo
            break

        # Estimate position based on value distribution
        fraction = (target - arr[lo]) / (arr[hi] - arr[lo])
        mid = lo + int(fraction * (hi - lo))

        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1


def exponential_search(arr: list, target) -> int:
    """Exponential search — good when target is near the start.
    Time: O(log p) where p is target position | Space: O(1)
    Returns index of target, or -1 if not found.
    """
    if not arr:
        return -1

    # Special case: check first element
    if arr[0] == target:
        return 0

    # Phase 1: Find range by doubling index
    n = len(arr)
    bound = 1
    while bound < n and arr[bound] < target:
        bound *= 2

    # Phase 2: Binary search within [bound/2, min(bound, n-1)]
    lo = bound // 2
    hi = min(bound, n - 1)

    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1


# Demo
sorted_arr = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
target = 23

print(f"Array:  {sorted_arr}")
print(f"Target: {target}")
print(f"Linear search:        index {linear_search(sorted_arr, target)}")
print(f"Binary search:        index {binary_search(sorted_arr, target)}")
print(f"Interpolation search: index {interpolation_search(sorted_arr, target)}")
print(f"Exponential search:   index {exponential_search(sorted_arr, target)}")
```

### TypeScript

```typescript
// TypeScript — Searching Algorithms


function linearSearch<T>(arr: T[], target: T): number {
  // Time: O(n) | Space: O(1)
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}


function binarySearch(arr: number[], target: number): number {
  // Time: O(log n) | Space: O(1)
  let lo = 0;
  let hi = arr.length - 1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2); // Avoids overflow

    if (arr[mid] === target) return mid;
    else if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }

  return -1;
}


function interpolationSearch(arr: number[], target: number): number {
  // Time: O(log log n) average, O(n) worst | Space: O(1)
  let lo = 0;
  let hi = arr.length - 1;

  while (lo <= hi && arr[lo] <= target && target <= arr[hi]) {
    // Avoid division by zero
    if (arr[lo] === arr[hi]) {
      if (arr[lo] === target) return lo;
      break;
    }

    // Estimate position based on value distribution
    const fraction = (target - arr[lo]) / (arr[hi] - arr[lo]);
    const mid = lo + Math.floor(fraction * (hi - lo));

    if (arr[mid] === target) return mid;
    else if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }

  return -1;
}


function exponentialSearch(arr: number[], target: number): number {
  // Time: O(log p) where p = target position | Space: O(1)
  if (arr.length === 0) return -1;

  // Special case: check first element
  if (arr[0] === target) return 0;

  // Phase 1: Find range by doubling index
  const n = arr.length;
  let bound = 1;
  while (bound < n && arr[bound] < target) {
    bound *= 2;
  }

  // Phase 2: Binary search within [bound/2, min(bound, n-1)]
  let lo = Math.floor(bound / 2);
  let hi = Math.min(bound, n - 1);

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] === target) return mid;
    else if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }

  return -1;
}


// Demo
const sortedArr = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
const target = 23;

console.log("Array: ", sortedArr);
console.log("Target:", target);
console.log("Linear search:       ", linearSearch(sortedArr, target));
console.log("Binary search:       ", binarySearch(sortedArr, target));
console.log("Interpolation search:", interpolationSearch(sortedArr, target));
console.log("Exponential search:  ", exponentialSearch(sortedArr, target));
```

### Rust

```rust
/// Linear search — works on any data.
/// Time: O(n) | Space: O(1)
fn linear_search<T: PartialEq>(arr: &[T], target: &T) -> Option<usize> {
    for (i, val) in arr.iter().enumerate() {
        if val == target {
            return Some(i);
        }
    }
    None
}

/// Binary search — requires sorted input.
/// Time: O(log n) | Space: O(1)
fn binary_search(arr: &[i64], target: i64) -> Option<usize> {
    if arr.is_empty() {
        return None;
    }

    let mut lo: usize = 0;
    let mut hi: usize = arr.len() - 1;

    while lo <= hi {
        let mid = lo + (hi - lo) / 2; // Avoids overflow

        if arr[mid] == target {
            return Some(mid);
        } else if arr[mid] < target {
            lo = mid + 1;
        } else {
            // Prevent underflow on unsigned subtraction
            if mid == 0 {
                break;
            }
            hi = mid - 1;
        }
    }

    None
}

/// Interpolation search — best on uniformly distributed sorted data.
/// Time: O(log log n) average, O(n) worst | Space: O(1)
fn interpolation_search(arr: &[i64], target: i64) -> Option<usize> {
    if arr.is_empty() {
        return None;
    }

    let mut lo: usize = 0;
    let mut hi: usize = arr.len() - 1;

    while lo <= hi && arr[lo] <= target && target <= arr[hi] {
        if arr[lo] == arr[hi] {
            if arr[lo] == target {
                return Some(lo);
            }
            break;
        }

        // Estimate position
        let fraction = (target - arr[lo]) as f64 / (arr[hi] - arr[lo]) as f64;
        let mid = lo + (fraction * (hi - lo) as f64) as usize;

        if arr[mid] == target {
            return Some(mid);
        } else if arr[mid] < target {
            lo = mid + 1;
        } else {
            if mid == 0 {
                break;
            }
            hi = mid - 1;
        }
    }

    None
}

/// Exponential search — good when target is near the start.
/// Time: O(log p) where p = target position | Space: O(1)
fn exponential_search(arr: &[i64], target: i64) -> Option<usize> {
    if arr.is_empty() {
        return None;
    }

    // Special case: check first element
    if arr[0] == target {
        return Some(0);
    }

    // Phase 1: Find range by doubling index
    let n = arr.len();
    let mut bound: usize = 1;
    while bound < n && arr[bound] < target {
        bound *= 2;
    }

    // Phase 2: Binary search within [bound/2, min(bound, n-1)]
    let mut lo = bound / 2;
    let mut hi = bound.min(n - 1);

    while lo <= hi {
        let mid = lo + (hi - lo) / 2;
        if arr[mid] == target {
            return Some(mid);
        } else if arr[mid] < target {
            lo = mid + 1;
        } else {
            if mid == 0 {
                break;
            }
            hi = mid - 1;
        }
    }

    None
}

fn main() {
    let arr: Vec<i64> = vec![2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
    let target: i64 = 23;

    println!("Array:  {:?}", arr);
    println!("Target: {}", target);
    println!("Linear search:        {:?}", linear_search(&arr, &target));
    println!("Binary search:        {:?}", binary_search(&arr, target));
    println!("Interpolation search: {:?}", interpolation_search(&arr, target));
    println!("Exponential search:   {:?}", exponential_search(&arr, target));
}
```

Note: Rust's standard library provides `slice::binary_search()`
which returns `Result<usize, usize>` — the `Ok` variant gives
the index if found, and the `Err` variant gives the index where
the element *would* be inserted to maintain sorted order. This
is extremely useful for insertion-point queries:

```rust
let arr = vec![2, 5, 8, 12, 16, 23, 38, 56, 72, 91];

// Found at index 5
assert_eq!(arr.binary_search(&23), Ok(5));

// Not found — would insert at index 4 to keep sorted
assert_eq!(arr.binary_search(&15), Err(4));
```

---

## What If the Array Isn't Sorted — Can We Still Do Better Than O(n)?

This is one of the most important questions in algorithm design,
and the answer reveals a deep truth about computation.

### The Short Answer: No (In General)

If you have an unsorted array and no additional information about
the data, you *must* check every element to be sure the target
isn't there. Any element you skip could be the one you're
looking for.

This is provable: in the comparison model (where you can only
compare elements), searching unsorted data requires Ω(n)
comparisons in the worst case. There's no clever trick that
avoids this.

```
  WHY YOU CAN'T BEAT O(n) ON UNSORTED DATA

  Unsorted: [?, ?, ?, ?, ?, ?, ?, ?, ?, ?]
  Looking for 42.

  Suppose you check 7 out of 10 elements and none is 42.
  Can you conclude 42 isn't in the array?

  NO — it could be in any of the 3 unchecked positions.
  You MUST check every element to be certain.

  This is an information-theoretic argument:
  each comparison gives you 1 bit of information,
  and you need log₂(n) bits to identify which of n
  positions holds the target. But without ordering,
  each comparison only eliminates 1 position, not half.
```

### The Longer Answer: It Depends on What You Know

While you can't beat O(n) for a *single* search on unsorted
data, there are strategies that change the game:

**Strategy 1: Sort first, then search many times**

If you'll search the same data repeatedly, sort it once in
O(n log n), then every subsequent search is O(log n).

Break-even point: after about O(log n) searches, the upfront
sorting cost is amortized.

```
  AMORTIZED COST OF SORT-THEN-SEARCH

  k searches on n elements:

  Without sorting: k × O(n) = O(kn)
  With sorting:    O(n log n) + k × O(log n)

  Sort-then-search wins when:
  k × n > n log n + k × log n
  k(n - log n) > n log n
  k > (n log n) / (n - log n) ≈ log n

  After ~log n searches, sorting pays for itself.
```

**Strategy 2: Use a hash table**

Build a hash table from the data in O(n), then every lookup is
O(1) average. This is even better than binary search if you
have the memory.

**Strategy 3: Use a different data structure from the start**

If you know you'll need fast lookups, don't store data in an
unsorted array in the first place. Use a balanced BST (O(log n)
search), a hash set (O(1) average), or a trie (O(m) for
string keys of length m).

**Strategy 4: Probabilistic approaches**

Bloom filters can tell you "definitely not in the set" in O(1)
with a small probability of false positives. Useful when most
queries return "not found."

### The Real Lesson

The question "can we search faster?" is really asking: **what
are we willing to invest upfront?**

```
  THE SEARCH SPEED SPECTRUM

  ┌──────────────────────────────────────────────────────────┐
  │ Upfront Cost          Search Cost     Data Structure     │
  ├──────────────────────────────────────────────────────────┤
  │ O(1) — nothing        O(n)            Unsorted array     │
  │ O(n) — build hash     O(1) avg        Hash table         │
  │ O(n log n) — sort     O(log n)        Sorted array       │
  │ O(n log n) — build    O(log n)        Balanced BST       │
  │ O(n) — build trie     O(m)*           Trie               │
  └──────────────────────────────────────────────────────────┘
  * m = length of the key (for strings)

  There's no free lunch. Faster search requires upfront work
  to organize the data. The right choice depends on how many
  searches you'll do and how much memory you can spare.
```

This trade-off between *preprocessing time* and *query time*
is one of the most fundamental ideas in algorithm design. You'll
see it again in range queries (prefix sums, segment trees),
string matching (building a suffix array), and graph algorithms
(precomputing shortest paths).

---

## Exercises

1. **Binary search trace**: Trace binary search on the array
   `[3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47]` looking
   for the value 35. Show `lo`, `hi`, and `mid` at each step.
   How many comparisons does it take?

2. **Off-by-one debugging**: The following binary search has a
   bug. Find it and explain what goes wrong:
   ```
   lo, hi = 0, len(arr)  # Bug is here — should be len(arr) - 1
   while lo < hi:         # Bug — should be lo <= hi
       mid = (lo + hi) // 2
       if arr[mid] == target: return mid
       elif arr[mid] < target: lo = mid
       else: hi = mid
   ```
   Fix all the bugs and explain why each fix is necessary.

3. **Interpolation vs binary**: Generate a sorted array of
   1,000 uniformly spaced integers (e.g., 0, 10, 20, ..., 9990).
   Count the number of comparisons binary search and
   interpolation search make to find the value 5000. Repeat
   with a non-uniform array (e.g., [1, 2, 3, ..., 999, 1000000]).
   When does interpolation search lose its advantage?

4. **Exponential search advantage**: You have a sorted array of
   1 million elements and need to find a value that's at index
   15. How many steps does exponential search take (range
   finding + binary search)? How many does binary search take?
   At what target position does binary search become faster?

5. **Search strategy selection**: For each scenario, choose the
   best search algorithm and justify your choice:
   - (a) Search a sorted array of 50 elements once
   - (b) Search a sorted array of 10 million elements once
   - (c) Search an unsorted array of 10 million elements 1000 times
   - (d) Search a sorted array where the target is usually in
     the first 100 elements (out of 10 million)
   - (e) Search uniformly distributed sorted integers

6. **Lower bound proof**: Explain in your own words why any
   algorithm that searches an unsorted array must examine every
   element in the worst case. Use an adversary argument: if the
   algorithm skips position i, the adversary places the target
   there.

---

**Previous**: [Lesson 12 — Non-Comparison Sorting](./12-non-comparison-sorting.md)
**Next**: [Lesson 14 — Two Pointers and Sliding Window](./14-two-pointers-sliding-window.md)
