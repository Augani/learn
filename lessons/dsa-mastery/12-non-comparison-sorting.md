# Lesson 12: Non-Comparison Sorting — Breaking the O(n log n) Barrier

> **Analogy**: Imagine you work at a post office sorting
> thousands of letters. You don't compare one letter's address
> to another — you just look at the zip code and drop each
> letter into the right bin. Bin 10001 goes here, bin 90210
> goes there. No "is this letter before or after that one?"
> needed. In one pass through the pile, every letter lands in
> the correct bin. That's the core idea behind non-comparison
> sorting: instead of asking "which element is bigger?", you
> exploit the *structure* of the data itself — its digits, its
> range, its distribution — to place elements directly where
> they belong.

---

## Why This Matters

In the previous lesson, we proved that comparison-based sorting
has a hard floor of Ω(n log n). Merge sort, quicksort, heapsort
— none of them can ever beat that barrier because they sort by
comparing pairs of elements.

But what if we *don't* compare elements? What if we use the
actual values of the elements to determine their position?

Non-comparison sorts break the O(n log n) barrier by exploiting
structure in the input:

- **Counting sort**: Values are integers in a known range [0, k).
  Time: O(n + k).
- **Radix sort**: Values have a fixed number of digits d, each
  in range [0, k). Time: O(d(n + k)).
- **Bucket sort**: Values are uniformly distributed in a range.
  Expected time: O(n).

These algorithms don't violate the decision tree lower bound —
they sidestep it entirely. The lower bound only applies to
algorithms that sort by comparing elements. These algorithms
never compare two elements against each other.

**When this matters in practice:**

- Sorting millions of 32-bit integers (radix sort beats
  quicksort)
- Sorting strings of fixed length (radix sort on characters)
- Histogram construction and frequency counting
- Suffix array construction (used in text indexing)
- Database operations on integer keys with bounded range

By the end of this lesson, you'll understand:

- How counting sort, radix sort, and bucket sort work
- Why each achieves better-than-O(n log n) performance
- What assumptions each algorithm requires
- When to choose non-comparison sorts over comparison sorts
- Why you can't just use counting sort for everything

---

## Counting Sort — Direct Placement by Value

Counting sort is the simplest non-comparison sort. The idea:
count how many times each value appears, then use those counts
to place elements directly into their sorted positions.

**Requirement**: The input values must be non-negative integers
in a known range [0, k).

### How It Works

1. Create a count array of size k (one slot per possible value)
2. Count occurrences of each value
3. Compute prefix sums (cumulative counts) — this tells you
   where each value's block starts in the output
4. Place elements into the output array using the prefix sums

```
  COUNTING SORT — STEP-BY-STEP ON [4, 2, 2, 8, 3, 3, 1]

  Input:  [4, 2, 2, 8, 3, 3, 1]
  Range:  values are in [0, 9), so k = 9

  STEP 1: Count occurrences
  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┐
  │ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │  ← value
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┤
  │ 0 │ 1 │ 2 │ 2 │ 1 │ 0 │ 0 │ 0 │ 1 │  ← count
  └───┴───┴───┴───┴───┴───┴───┴───┴───┘
  (value 2 appears twice, value 3 appears twice, etc.)

  STEP 2: Compute prefix sums (cumulative count)
  Each entry = sum of all counts before it
  This tells us: "values less than i occupy positions 0..prefix[i]-1"

  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┐
  │ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │  ← value
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┤
  │ 0 │ 0 │ 1 │ 3 │ 5 │ 6 │ 6 │ 6 │ 6 │  ← prefix sum
  └───┴───┴───┴───┴───┴───┴───┴───┴───┘
  Meaning: value 2 starts at index 1, value 3 starts at index 3,
           value 4 starts at index 5, value 8 starts at index 6

  STEP 3: Place elements (walk input LEFT to RIGHT for stability)
  For each element, use prefix sum as its output index, then increment

  Process input[0] = 4: prefix[4] = 5 → output[5] = 4, prefix[4]++
  Process input[1] = 2: prefix[2] = 1 → output[1] = 2, prefix[2]++
  Process input[2] = 2: prefix[2] = 2 → output[2] = 2, prefix[2]++
  Process input[3] = 8: prefix[8] = 6 → output[6] = 8, prefix[8]++
  Process input[4] = 3: prefix[3] = 3 → output[3] = 3, prefix[3]++
  Process input[5] = 3: prefix[3] = 4 → output[4] = 3, prefix[3]++
  Process input[6] = 1: prefix[1] = 0 → output[0] = 1, prefix[1]++

  Output: [1, 2, 2, 3, 3, 4, 8] ✓
```

### Why It's O(n + k)

- Counting: one pass through n elements → O(n)
- Prefix sums: one pass through k buckets → O(k)
- Placement: one pass through n elements → O(n)
- Total: O(n + k)

When k is O(n) or smaller, this is O(n) — linear time!

### The Catch

If k is huge (say, sorting 100 numbers in range [0, 10⁹)),
the count array has a billion entries. The O(k) space and time
dominates, making counting sort impractical. Counting sort is
only efficient when the range k is comparable to n.

### Stability

Counting sort is **stable** — equal elements appear in the
output in the same order as the input. This is critical because
radix sort depends on a stable subroutine. The stability comes
from processing the input left-to-right and using prefix sums
that increment after each placement.

---

## Radix Sort — Digit by Digit

What if the range is too large for counting sort? Radix sort
handles this by sorting one digit at a time, from least
significant to most significant, using a stable sort (like
counting sort) as the subroutine for each digit.

### How It Works

1. Find the maximum number of digits d in any element
2. For each digit position (starting from the least significant):
   - Use a stable sort (counting sort) to sort by that digit
3. After processing all d digits, the array is fully sorted

The key insight: because the subroutine is stable, sorting by
digit i doesn't disturb the relative order established by
digits 0 through i-1.

```
  RADIX SORT — STEP-BY-STEP ON [170, 45, 75, 90, 802, 24, 2, 66]

  Maximum value: 802 → 3 digits (d = 3)
  We'll sort by ones, then tens, then hundreds.

  Original:  [170, 045, 075, 090, 802, 024, 002, 066]
             (padded with leading zeros for clarity)

  ─── PASS 1: Sort by ONES digit ───

  170 → ones = 0     Buckets:
  045 → ones = 5     0: [170, 090]
  075 → ones = 5     2: [802, 002]
  090 → ones = 0     4: [024]
  802 → ones = 2     5: [045, 075]
  024 → ones = 4     6: [066]
  002 → ones = 2
  066 → ones = 6

  Collect buckets in order:
  After pass 1: [170, 090, 802, 002, 024, 045, 075, 066]

  ─── PASS 2: Sort by TENS digit ───

  170 → tens = 7     Buckets:
  090 → tens = 9     0: [802, 002]
  802 → tens = 0     2: [024]
  002 → tens = 0     4: [045]
  024 → tens = 2     6: [066]
  045 → tens = 4     7: [170, 075]
  075 → tens = 7     9: [090]
  066 → tens = 6

  Collect buckets in order:
  After pass 2: [802, 002, 024, 045, 066, 170, 075, 090]

  ─── PASS 3: Sort by HUNDREDS digit ───

  802 → hundreds = 8   Buckets:
  002 → hundreds = 0   0: [002, 024, 045, 066, 075, 090]
  024 → hundreds = 0   1: [170]
  045 → hundreds = 0   8: [802]
  066 → hundreds = 0
  075 → hundreds = 0
  090 → hundreds = 0
  170 → hundreds = 1

  Collect buckets in order:
  After pass 3: [002, 024, 045, 066, 075, 090, 170, 802]

  Result: [2, 24, 45, 66, 75, 90, 170, 802] ✓
```

### Why Least-Significant-Digit First?

This seems backwards — why not sort by the most important digit
first? The answer is stability.

When we sort by the ones digit, elements with the same ones
digit keep their original relative order. When we then sort by
the tens digit, elements with the same tens digit keep the order
from the previous pass — which means they're already sorted by
ones digit within each tens-digit group.

```
  WHY LSD RADIX SORT WORKS — STABILITY IN ACTION

  After sorting by ones:  [170, 090, 802, 002, ...]
                           ↑    ↑
                           Both have ones=0.
                           170 comes before 090 (original order).

  After sorting by tens:  [802, 002, 024, 045, 066, 170, 075, 090]
                                                     ↑         ↑
                           170 and 090 now separated by tens digit.
                           Within tens=0 group: 802, 002 — stable!

  After sorting by hundreds: fully sorted.
  Each pass refines the order without destroying previous work.
```

If we sorted most-significant-digit first (MSD radix sort), we'd
need to recursively sort within each bucket — essentially
creating sub-problems. LSD radix sort avoids this by relying on
stability.

### Complexity

- d digit positions, each pass is a counting sort on base-k
  digits: O(n + k) per pass
- Total: O(d(n + k))

For 32-bit integers with base-256 digits: d = 4, k = 256.
Total: O(4(n + 256)) = O(n). In practice, radix sort with
base 256 is one of the fastest ways to sort large arrays of
integers.

---

## Bucket Sort — Divide by Distribution

Bucket sort works by distributing elements into buckets based
on their value, sorting each bucket individually, then
concatenating the results.

### How It Works

1. Create n buckets covering the value range
2. Distribute each element into its bucket
   (bucket index = ⌊n × value / range⌋)
3. Sort each bucket (using insertion sort or any sort)
4. Concatenate all buckets in order

```
  BUCKET SORT — ON [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]

  n = 10 elements, values in [0, 1)
  Create 10 buckets for ranges [0, 0.1), [0.1, 0.2), ..., [0.9, 1.0)

  DISTRIBUTE into buckets (bucket = ⌊10 × value⌋):

  Bucket 0 [0.0, 0.1):  (empty)
  Bucket 1 [0.1, 0.2):  [0.17, 0.12]
  Bucket 2 [0.2, 0.3):  [0.26, 0.21, 0.23]
  Bucket 3 [0.3, 0.4):  [0.39]
  Bucket 4 [0.4, 0.5):  (empty)
  Bucket 5 [0.5, 0.6):  (empty)
  Bucket 6 [0.6, 0.7):  [0.68]
  Bucket 7 [0.7, 0.8):  [0.78, 0.72]
  Bucket 8 [0.8, 0.9):  (empty)
  Bucket 9 [0.9, 1.0):  [0.94]

  SORT each bucket (insertion sort — buckets are small):

  Bucket 1: [0.12, 0.17]
  Bucket 2: [0.21, 0.23, 0.26]
  Bucket 3: [0.39]
  Bucket 6: [0.68]
  Bucket 7: [0.72, 0.78]
  Bucket 9: [0.94]

  CONCATENATE:
  [0.12, 0.17, 0.21, 0.23, 0.26, 0.39, 0.68, 0.72, 0.78, 0.94] ✓
```

### Why It's O(n) on Average

If the input is uniformly distributed, each bucket gets about
n/n = 1 element on average. Sorting a bucket of size 1 is O(1).
Concatenating n buckets is O(n). Total: O(n).

More precisely: with n buckets and uniform distribution, the
expected number of elements per bucket is O(1). Insertion sort
on each bucket is O(1²) = O(1). Summing over all buckets:
O(n × 1) = O(n).

### The Catch

If the distribution is skewed (e.g., all elements are between
0.50 and 0.51), most elements land in one bucket, and we're
back to O(n²) if that bucket uses insertion sort, or O(n log n)
if it uses merge sort. Bucket sort's performance depends
entirely on the distribution assumption.

```
  NON-COMPARISON SORTS — COMPLEXITY SUMMARY

  ┌──────────────────┬──────────┬──────────┬──────────┬─────────┬────────┐
  │ Algorithm        │ Best     │ Average  │ Worst    │ Space   │ Stable │
  ├──────────────────┼──────────┼──────────┼──────────┼─────────┼────────┤
  │ Counting sort    │ O(n + k) │ O(n + k) │ O(n + k) │ O(n + k)│ Yes    │
  │ Radix sort (LSD) │ O(d(n+k))│ O(d(n+k))│ O(d(n+k))│ O(n + k)│ Yes    │
  │ Bucket sort      │ O(n)     │ O(n)     │ O(n²)    │ O(n + k)│ Yes*   │
  └──────────────────┴──────────┴──────────┴──────────┴─────────┴────────┘

  k = range of values (counting sort) or base (radix sort) or
      number of buckets (bucket sort)
  d = number of digits
  * Bucket sort is stable if the per-bucket sort is stable

  WHEN TO USE WHICH:
  • Integers in small range:       Counting sort — simplest, O(n + k)
  • Integers or fixed-length keys: Radix sort — O(d(n + k)), handles large range
  • Uniformly distributed floats:  Bucket sort — O(n) expected
  • General data, no assumptions:  Stick with comparison sort (quicksort/mergesort)
```

---

## Technical Deep-Dive: Implementations

### Python

```python
# Python — Non-Comparison Sorting Algorithms


def counting_sort(arr: list[int], max_val: int | None = None) -> list[int]:
    """Counting sort for non-negative integers.
    Time: O(n + k) where k = max value + 1
    Space: O(n + k)
    Stable: Yes
    """
    if not arr:
        return []

    k = (max_val if max_val is not None else max(arr)) + 1
    count = [0] * k

    # Step 1: Count occurrences
    for x in arr:
        count[x] += 1

    # Step 2: Prefix sums — count[i] = number of elements ≤ i
    for i in range(1, k):
        count[i] += count[i - 1]

    # Step 3: Place elements in output (right-to-left for stability)
    output = [0] * len(arr)
    for x in reversed(arr):
        count[x] -= 1
        output[count[x]] = x

    return output


def counting_sort_by_digit(arr: list[int], exp: int) -> list[int]:
    """Counting sort as subroutine for radix sort.
    Sorts by the digit at position `exp` (1 = ones, 10 = tens, etc.)
    """
    n = len(arr)
    output = [0] * n
    count = [0] * 10  # digits 0-9

    # Count occurrences of each digit
    for x in arr:
        digit = (x // exp) % 10
        count[digit] += 1

    # Prefix sums
    for i in range(1, 10):
        count[i] += count[i - 1]

    # Place elements (right-to-left for stability)
    for x in reversed(arr):
        digit = (x // exp) % 10
        count[digit] -= 1
        output[count[digit]] = x

    return output


def radix_sort(arr: list[int]) -> list[int]:
    """Radix sort (LSD) for non-negative integers.
    Time: O(d(n + 10)) where d = number of digits
    Space: O(n)
    Stable: Yes
    """
    if not arr:
        return []

    result = arr[:]
    max_val = max(result)

    # Process each digit position
    exp = 1
    while max_val // exp > 0:
        result = counting_sort_by_digit(result, exp)
        exp *= 10

    return result


def bucket_sort(arr: list[float], num_buckets: int | None = None) -> list[float]:
    """Bucket sort for values in [0, 1).
    Time: O(n) average (uniform distribution), O(n²) worst
    Space: O(n)
    Stable: Yes (if per-bucket sort is stable)
    """
    if not arr:
        return []

    n = len(arr)
    k = num_buckets if num_buckets is not None else n
    buckets: list[list[float]] = [[] for _ in range(k)]

    # Distribute elements into buckets
    for x in arr:
        idx = int(k * x)
        idx = min(idx, k - 1)  # Handle edge case x = 1.0
        buckets[idx].append(x)

    # Sort each bucket (insertion sort for small buckets)
    for bucket in buckets:
        bucket.sort()  # Python's sort is Timsort — efficient for small lists

    # Concatenate
    result = []
    for bucket in buckets:
        result.extend(bucket)

    return result


# Demo
integers = [170, 45, 75, 90, 802, 24, 2, 66]
print(f"Original:       {integers}")
print(f"Counting sort:  {counting_sort(integers)}")
print(f"Radix sort:     {radix_sort(integers)}")

floats = [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]
print(f"\nOriginal:       {floats}")
print(f"Bucket sort:    {bucket_sort(floats)}")
```

### TypeScript

```typescript
// TypeScript — Non-Comparison Sorting Algorithms


function countingSort(arr: number[], maxVal?: number): number[] {
  // Time: O(n + k) | Space: O(n + k) | Stable: Yes
  if (arr.length === 0) return [];

  const k = (maxVal ?? Math.max(...arr)) + 1;
  const count = new Array(k).fill(0);

  // Step 1: Count occurrences
  for (const x of arr) {
    count[x]++;
  }

  // Step 2: Prefix sums
  for (let i = 1; i < k; i++) {
    count[i] += count[i - 1];
  }

  // Step 3: Place elements (right-to-left for stability)
  const output = new Array(arr.length);
  for (let i = arr.length - 1; i >= 0; i--) {
    count[arr[i]]--;
    output[count[arr[i]]] = arr[i];
  }

  return output;
}


function countingSortByDigit(arr: number[], exp: number): number[] {
  const n = arr.length;
  const output = new Array(n);
  const count = new Array(10).fill(0);

  for (const x of arr) {
    const digit = Math.floor(x / exp) % 10;
    count[digit]++;
  }

  for (let i = 1; i < 10; i++) {
    count[i] += count[i - 1];
  }

  for (let i = n - 1; i >= 0; i--) {
    const digit = Math.floor(arr[i] / exp) % 10;
    count[digit]--;
    output[count[digit]] = arr[i];
  }

  return output;
}


function radixSort(arr: number[]): number[] {
  // Time: O(d(n + 10)) | Space: O(n) | Stable: Yes
  if (arr.length === 0) return [];

  let result = [...arr];
  const maxVal = Math.max(...result);

  let exp = 1;
  while (Math.floor(maxVal / exp) > 0) {
    result = countingSortByDigit(result, exp);
    exp *= 10;
  }

  return result;
}


function bucketSort(arr: number[], numBuckets?: number): number[] {
  // Time: O(n) average | Space: O(n) | Stable: Yes
  // Assumes values in [0, 1)
  if (arr.length === 0) return [];

  const n = arr.length;
  const k = numBuckets ?? n;
  const buckets: number[][] = Array.from({ length: k }, () => []);

  // Distribute into buckets
  for (const x of arr) {
    const idx = Math.min(Math.floor(k * x), k - 1);
    buckets[idx].push(x);
  }

  // Sort each bucket
  for (const bucket of buckets) {
    bucket.sort((a, b) => a - b);
  }

  // Concatenate
  const result: number[] = [];
  for (const bucket of buckets) {
    result.push(...bucket);
  }

  return result;
}


// Demo
const integers = [170, 45, 75, 90, 802, 24, 2, 66];
console.log("Original:      ", integers);
console.log("Counting sort: ", countingSort(integers));
console.log("Radix sort:    ", radixSort(integers));

const floats = [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68];
console.log("\nOriginal:      ", floats);
console.log("Bucket sort:   ", bucketSort(floats));
```

### Rust

```rust
/// Counting sort for non-negative integers.
/// Time: O(n + k) | Space: O(n + k) | Stable: Yes
fn counting_sort(arr: &[u32]) -> Vec<u32> {
    if arr.is_empty() {
        return vec![];
    }

    let k = (*arr.iter().max().unwrap() + 1) as usize;
    let mut count = vec![0usize; k];

    // Count occurrences
    for &x in arr {
        count[x as usize] += 1;
    }

    // Prefix sums
    for i in 1..k {
        count[i] += count[i - 1];
    }

    // Place elements (right-to-left for stability)
    let mut output = vec![0u32; arr.len()];
    for &x in arr.iter().rev() {
        count[x as usize] -= 1;
        output[count[x as usize]] = x;
    }

    output
}

/// Counting sort by a specific digit (subroutine for radix sort).
fn counting_sort_by_digit(arr: &[u32], exp: u32) -> Vec<u32> {
    let n = arr.len();
    let mut output = vec![0u32; n];
    let mut count = [0usize; 10];

    for &x in arr {
        let digit = ((x / exp) % 10) as usize;
        count[digit] += 1;
    }

    for i in 1..10 {
        count[i] += count[i - 1];
    }

    for &x in arr.iter().rev() {
        let digit = ((x / exp) % 10) as usize;
        count[digit] -= 1;
        output[count[digit]] = x;
    }

    output
}

/// Radix sort (LSD) for non-negative integers.
/// Time: O(d(n + 10)) | Space: O(n) | Stable: Yes
fn radix_sort(arr: &[u32]) -> Vec<u32> {
    if arr.is_empty() {
        return vec![];
    }

    let mut result = arr.to_vec();
    let max_val = *arr.iter().max().unwrap();

    let mut exp = 1u32;
    while max_val / exp > 0 {
        result = counting_sort_by_digit(&result, exp);
        exp *= 10;
    }

    result
}

/// Bucket sort for values in [0.0, 1.0).
/// Time: O(n) average | Space: O(n) | Stable: Yes
fn bucket_sort(arr: &[f64]) -> Vec<f64> {
    if arr.is_empty() {
        return vec![];
    }

    let n = arr.len();
    let mut buckets: Vec<Vec<f64>> = vec![vec![]; n];

    // Distribute into buckets
    for &x in arr {
        let idx = ((n as f64) * x) as usize;
        let idx = idx.min(n - 1); // Handle edge case x ≈ 1.0
        buckets[idx].push(x);
    }

    // Sort each bucket
    for bucket in &mut buckets {
        // Insertion sort for small buckets
        for i in 1..bucket.len() {
            let key = bucket[i];
            let mut j = i;
            while j > 0 && bucket[j - 1] > key {
                bucket[j] = bucket[j - 1];
                j -= 1;
            }
            bucket[j] = key;
        }
    }

    // Concatenate
    let mut result = Vec::with_capacity(n);
    for bucket in &buckets {
        result.extend_from_slice(bucket);
    }

    result
}

fn main() {
    let integers: Vec<u32> = vec![170, 45, 75, 90, 802, 24, 2, 66];
    println!("Original:       {:?}", integers);
    println!("Counting sort:  {:?}", counting_sort(&integers));
    println!("Radix sort:     {:?}", radix_sort(&integers));

    let floats: Vec<f64> = vec![0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68];
    println!("\nOriginal:       {:?}", floats);
    println!("Bucket sort:    {:?}", bucket_sort(&floats));
}
```

Note: Rust's standard library doesn't include non-comparison
sorts because the generic `sort()` and `sort_unstable()` methods
work on any `Ord` type. For integer-specific sorting, crates
like `rdxsort` and `voracious_radix_sort` provide optimized
radix sort implementations.

---

## What If We Tried Counting Sort on Floating-Point Numbers?

This is a great question that reveals exactly why non-comparison
sorts have constraints that comparison sorts don't.

### The Problem

Counting sort needs one slot in the count array for each
possible value. For integers in [0, 100), that's 100 slots —
easy. But floating-point numbers?

A 64-bit double can represent approximately 2⁶⁴ distinct
values. You'd need a count array with ~1.8 × 10¹⁹ entries.
That's about 144 exabytes of memory. Not happening.

```
  WHY COUNTING SORT FAILS ON FLOATS

  Integer range [0, 100):
  ┌───┬───┬───┬───┬─── ... ───┬────┐
  │ 0 │ 1 │ 2 │ 3 │           │ 99 │  ← 100 slots, easy
  └───┴───┴───┴───┴─── ... ───┴────┘

  Float range [0.0, 1.0):
  How many distinct floats between 0.0 and 1.0?
  Answer: ~4.6 × 10¹⁸ (for 64-bit doubles)

  ┌─────┬─────┬─────┬─── ... ───┬─────┐
  │0.000│0.000│0.000│           │1.000│  ← 4.6 × 10¹⁸ slots??
  │ 000 │ 000 │ 000 │           │     │     That's 37 exabytes.
  │ 001 │ 002 │ 003 │           │     │     Not gonna work.
  └─────┴─────┴─────┴─── ... ───┴─────┘
```

### The Workarounds

**Option 1: Discretize (lose precision)**

Multiply floats by a scaling factor and round to integers.
For example, to sort dollar amounts with 2 decimal places,
multiply by 100: $3.14 → 314, $2.71 → 271. Now use counting
sort on the integers.

This works when you know the precision you need. It doesn't
work for arbitrary floating-point values.

**Option 2: Bucket sort (the right tool)**

Bucket sort is designed for this exact scenario. Instead of one
slot per value, it uses n buckets that each cover a range. With
uniformly distributed floats in [0, 1), bucket sort achieves
O(n) expected time.

**Option 3: Radix sort on the bit representation**

IEEE 754 floating-point numbers have a useful property: for
positive floats, the bit representation preserves order. You
can reinterpret the float bits as an unsigned integer and radix
sort those. Negative floats need special handling (flip all bits
after the sign bit), but it works.

```
  RADIX SORT ON FLOAT BITS (positive floats only)

  3.14 → bits: 0 10000000 10010001111010111000011
  2.71 → bits: 0 10000000 01011010111000010100100
  1.41 → bits: 0 01111111 01101000111101011100001

  As unsigned integers: 3.14 > 2.71 > 1.41
  The bit ordering matches the value ordering!
  So radix sort on the bits gives correct results.
```

### The Lesson

Each non-comparison sort has specific requirements:
- **Counting sort**: small integer range
- **Radix sort**: fixed-width keys with digit decomposition
- **Bucket sort**: known distribution (ideally uniform)

There's no free lunch. These algorithms beat O(n log n) by
exploiting structure. If your data doesn't have that structure,
you're back to comparison sorts — and that's perfectly fine.

---

## Comparison vs Non-Comparison: The Full Picture

```
  DECISION GUIDE: WHICH SORT TO USE?

  Is the data integers in a small range [0, k)?
  ├── YES, k ≈ n → Counting sort: O(n + k)
  ├── YES, k >> n → Radix sort: O(d(n + k)) with base-k digits
  └── NO
      │
      Are the values uniformly distributed in a known range?
      ├── YES → Bucket sort: O(n) expected
      └── NO
          │
          Use a comparison sort:
          ├── Need stability? → Merge sort: O(n log n)
          ├── Need O(1) space? → Heapsort: O(n log n)
          └── General purpose? → Quicksort: O(n log n) avg
```

```
  COMPARISON SORTS vs NON-COMPARISON SORTS

  ┌─────────────────────┬──────────────────────────────────────┐
  │ Comparison Sorts    │ Non-Comparison Sorts                 │
  ├─────────────────────┼──────────────────────────────────────┤
  │ Work on ANY data    │ Require specific input structure     │
  │ that supports < / > │ (integers, bounded range, uniform    │
  │                     │ distribution, fixed-width keys)      │
  ├─────────────────────┼──────────────────────────────────────┤
  │ Lower bound:        │ No comparison lower bound applies    │
  │ Ω(n log n)          │ Can achieve O(n) or O(nk)            │
  ├─────────────────────┼──────────────────────────────────────┤
  │ Space: O(1) to O(n) │ Space: O(n + k) typically            │
  ├─────────────────────┼──────────────────────────────────────┤
  │ Examples: merge,    │ Examples: counting, radix, bucket    │
  │ quick, heap, insert │                                      │
  └─────────────────────┴──────────────────────────────────────┘
```

---

## Exercises

1. **Trace by hand**: Sort the array [6, 0, 2, 0, 1, 3, 4, 6, 1, 3, 2]
   using counting sort. Show the count array, the prefix sum
   array, and the output array after each placement step.

2. **Radix sort trace**: Sort [329, 457, 657, 839, 436, 720, 355]
   using LSD radix sort with base 10. Show the state of the
   array after each digit pass (ones, tens, hundreds).

3. **Stability proof**: Given input [(2, "a"), (1, "b"), (2, "c"), (1, "d")]
   where we sort by the integer key, show that counting sort
   preserves the relative order of (2, "a") and (2, "c"), and
   of (1, "b") and (1, "d"). Then explain why this property is
   essential for radix sort to work correctly.

4. **Radix sort base selection**: For sorting 1 million 32-bit
   integers, compare radix sort with base 10 (d=10 digits) vs
   base 256 (d=4 digits) vs base 65536 (d=2 digits). What are
   the trade-offs in terms of passes, count array size, and
   cache behavior?

5. **Bucket sort worst case**: Construct an input of 10 floats
   in [0, 1) where bucket sort with 10 buckets degrades to
   O(n²). What distribution causes this? How could you mitigate
   it?

6. **Hybrid approach**: Implement a sort that checks the input
   range: if max - min < 2n, use counting sort; otherwise, use
   quicksort. Test it on (a) [5, 3, 1, 4, 2], (b) [1000000, 1, 500000],
   and (c) a random array of 100,000 integers in [0, 100).
   Which cases benefit from the hybrid approach?

---

**Previous**: [Lesson 11 — Comparison-Based Sorting](./11-comparison-sorting.md)
**Next**: [Lesson 13 — Searching Algorithms](./13-searching-algorithms.md)
