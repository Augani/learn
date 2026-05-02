# Lesson 11: Comparison-Based Sorting

> **Analogy**: You're sitting at a table with a hand of playing
> cards, and you need to put them in order. Without thinking
> about it, you probably use **insertion sort** — you pick up
> each card and slide it into the right spot among the cards
> you've already sorted. It's natural, it's intuitive, and for
> a small hand it works great. But what if you had a thousand
> cards? You'd want a smarter strategy. That's what this lesson
> is about: the full spectrum of comparison-based sorting, from
> the simple approaches humans naturally use to the clever
> algorithms that achieve the fastest possible time — and a
> proof that no comparison-based sort can ever do better than
> O(n log n).

---

## Why This Matters

Sorting is the most fundamental algorithmic problem in computer
science. It appears everywhere:

- **Databases**: Every `ORDER BY` clause triggers a sort.
- **Search**: Binary search requires sorted input. Building an
  index means sorting keys.
- **Deduplication**: Sort first, then scan for adjacent
  duplicates — O(n log n) total.
- **Scheduling**: Sort tasks by deadline, priority, or
  dependency order.
- **Graphics**: Painter's algorithm sorts polygons by depth.
- **Compression**: Many compression algorithms (like
  Burrows-Wheeler) rely on sorting.

More importantly, sorting is a gateway to understanding
algorithm design. The progression from O(n²) bubble sort to
O(n log n) merge sort teaches you how divide-and-conquer
transforms brute force into elegance. And the proof that
O(n log n) is optimal teaches you that sometimes you can't do
better — a powerful idea in its own right.

By the end of this lesson, you'll understand:

- How six comparison-based sorting algorithms work and why
- The time and space complexity of each
- Why O(n log n) is the best any comparison sort can achieve
- When to choose one algorithm over another
- How to trace through merge sort and quicksort step by step

---

## The Simple Sorts: O(n²)

These algorithms are easy to understand and implement. They're
fine for small inputs (n < 50 or so) but too slow for large
datasets. Understanding them builds intuition for why the
efficient sorts are designed the way they are.

### Bubble Sort

Repeatedly walk through the array, swapping adjacent elements
that are out of order. After each pass, the largest unsorted
element "bubbles up" to its correct position.

```
  BUBBLE SORT — TRACE ON [5, 3, 8, 1, 2]

  Pass 1: compare adjacent pairs, swap if needed
  [5, 3, 8, 1, 2]  → 5>3, swap → [3, 5, 8, 1, 2]
  [3, 5, 8, 1, 2]  → 5<8, ok   → [3, 5, 8, 1, 2]
  [3, 5, 8, 1, 2]  → 8>1, swap → [3, 5, 1, 8, 2]
  [3, 5, 1, 8, 2]  → 8>2, swap → [3, 5, 1, 2, 8]
                                          ↑ 8 is now in place

  Pass 2: (ignore last element — already sorted)
  [3, 5, 1, 2, 8]  → 3<5, ok   → [3, 5, 1, 2, 8]
  [3, 5, 1, 2, 8]  → 5>1, swap → [3, 1, 5, 2, 8]
  [3, 1, 5, 2, 8]  → 5>2, swap → [3, 1, 2, 5, 8]
                                       ↑ 5 in place

  Pass 3:
  [3, 1, 2, 5, 8]  → 3>1, swap → [1, 3, 2, 5, 8]
  [1, 3, 2, 5, 8]  → 3>2, swap → [1, 2, 3, 5, 8]
                                    ↑ 3 in place

  Pass 4:
  [1, 2, 3, 5, 8]  → 1<2, ok   → [1, 2, 3, 5, 8]
                                 ↑ 2 in place, 1 in place

  Result: [1, 2, 3, 5, 8] ✓
```

**Why it's slow**: Each pass does O(n) comparisons, and we need
up to n-1 passes. Total: O(n²). The only redeeming quality: if
the array is already sorted, an optimized version (with an
early-exit flag) detects this in O(n).


### Selection Sort

Find the minimum element in the unsorted portion and swap it
into the next sorted position. Repeat until everything is sorted.

```
  SELECTION SORT — TRACE ON [5, 3, 8, 1, 2]

  Step 1: find min in [5, 3, 8, 1, 2] → min=1 at index 3
          swap arr[0] and arr[3]
          [1, 3, 8, 5, 2]
           ↑ sorted

  Step 2: find min in [3, 8, 5, 2] → min=2 at index 4
          swap arr[1] and arr[4]
          [1, 2, 8, 5, 3]
           ↑──↑ sorted

  Step 3: find min in [8, 5, 3] → min=3 at index 4
          swap arr[2] and arr[4]
          [1, 2, 3, 5, 8]
           ↑──↑──↑ sorted

  Step 4: find min in [5, 8] → min=5 at index 3
          already in place
          [1, 2, 3, 5, 8]
           ↑──↑──↑──↑ sorted

  Result: [1, 2, 3, 5, 8] ✓
```

**Why it's slow**: Finding the minimum requires scanning the
unsorted portion — O(n) work per step, n steps total = O(n²).
Unlike bubble sort, selection sort always does exactly n(n-1)/2
comparisons regardless of input order. It does fewer swaps
though — exactly n-1 swaps, which matters when writes are
expensive.

### Insertion Sort — How Humans Actually Sort

Pick up each element and insert it into its correct position
among the already-sorted elements to its left. This is exactly
how most people sort a hand of playing cards.

```
  INSERTION SORT — TRACE ON [5, 3, 8, 1, 2]

  Start: [5 | 3, 8, 1, 2]    (left of | is "sorted")

  Insert 3: 3 < 5, shift 5 right
            [3, 5 | 8, 1, 2]

  Insert 8: 8 > 5, already in place
            [3, 5, 8 | 1, 2]

  Insert 1: 1 < 8, shift 8 right
            1 < 5, shift 5 right
            1 < 3, shift 3 right
            [1, 3, 5, 8 | 2]

  Insert 2: 2 < 8, shift 8 right
            2 < 5, shift 5 right
            2 < 3, shift 3 right
            2 > 1, stop
            [1, 2, 3, 5, 8]

  Result: [1, 2, 3, 5, 8] ✓
```

**Why insertion sort is special**: It's O(n²) in the worst case
(reverse-sorted input), but O(n) on already-sorted or
nearly-sorted input. Each element only needs to move a short
distance. This makes insertion sort the best choice for small
arrays and nearly-sorted data — which is why real-world hybrid
sorts (like Timsort) use it as a building block.

```
  SIMPLE SORTS — COMPLEXITY SUMMARY

  ┌──────────────────┬──────────┬──────────┬──────────┬───────┬────────┐
  │ Algorithm        │ Best     │ Average  │ Worst    │ Space │ Stable │
  ├──────────────────┼──────────┼──────────┼──────────┼───────┼────────┤
  │ Bubble sort      │ O(n)*    │ O(n²)    │ O(n²)    │ O(1)  │ Yes    │
  │ Selection sort   │ O(n²)    │ O(n²)    │ O(n²)    │ O(1)  │ No**   │
  │ Insertion sort   │ O(n)     │ O(n²)    │ O(n²)    │ O(1)  │ Yes    │
  └──────────────────┴──────────┴──────────┴──────────┴───────┴────────┘

  * With early-exit optimization (stop if no swaps in a pass)
  ** Standard selection sort is unstable because swapping can
     move equal elements past each other
```

---

## The Efficient Sorts: O(n log n)

These algorithms use clever strategies — divide-and-conquer or
heap structure — to achieve the theoretical optimum for
comparison-based sorting.

### Merge Sort — Divide, Sort, Merge

Split the array in half, recursively sort each half, then merge
the two sorted halves. The key insight: merging two sorted
arrays into one sorted array takes only O(n) time.

```
  MERGE SORT — STEP-BY-STEP TRACE ON [38, 27, 43, 3, 9, 82, 10]

  DIVIDE PHASE (split until single elements):

                    [38, 27, 43, 3, 9, 82, 10]
                   /                           \
          [38, 27, 43, 3]                [9, 82, 10]
          /             \                /          \
      [38, 27]      [43, 3]        [9, 82]        [10]
      /      \      /     \        /      \          |
    [38]    [27]  [43]    [3]    [9]     [82]      [10]

  MERGE PHASE (combine sorted subarrays):

  Merge [38] + [27]:
    Compare 38 vs 27 → take 27, then take 38
    Result: [27, 38]

  Merge [43] + [3]:
    Compare 43 vs 3 → take 3, then take 43
    Result: [3, 43]

  Merge [9] + [82]:
    Compare 9 vs 82 → take 9, then take 82
    Result: [9, 82]

  Merge [27, 38] + [3, 43]:
    Compare 27 vs 3  → take 3
    Compare 27 vs 43 → take 27
    Compare 38 vs 43 → take 38
    Take remaining 43
    Result: [3, 27, 38, 43]

  Merge [9, 82] + [10]:
    Compare 9 vs 10  → take 9
    Compare 82 vs 10 → take 10
    Take remaining 82
    Result: [9, 10, 82]

  Merge [3, 27, 38, 43] + [9, 10, 82]:
    Compare 3 vs 9   → take 3
    Compare 27 vs 9  → take 9
    Compare 27 vs 10 → take 10
    Compare 27 vs 82 → take 27
    Compare 38 vs 82 → take 38
    Compare 43 vs 82 → take 43
    Take remaining 82
    Result: [3, 9, 10, 27, 38, 43, 82] ✓
```

**Why it works**: Each level of recursion does O(n) total work
(merging). There are O(log n) levels (we halve each time).
Total: O(n log n). Always. Merge sort's complexity doesn't
depend on the input order — it's O(n log n) in the best,
average, and worst case.

**The trade-off**: Merge sort needs O(n) extra space for the
temporary merge buffer. This is its main disadvantage compared
to quicksort.


### Quicksort — Partition and Conquer

Choose a pivot element, partition the array so everything less
than the pivot is on the left and everything greater is on the
right, then recursively sort each side. The pivot ends up in its
final sorted position after partitioning.

```
  QUICKSORT — STEP-BY-STEP TRACE ON [38, 27, 43, 3, 9, 82, 10]

  Step 1: Choose pivot = 10 (last element)
          Partition around 10:

          [38, 27, 43, 3, 9, 82, 10]
                                 ↑ pivot

          Walk through, moving elements ≤ 10 to the left:
          3 ≤ 10 → move left    [3, 27, 43, 38, 9, 82, 10]
          9 ≤ 10 → move left    [3, 9, 43, 38, 27, 82, 10]
          Place pivot:           [3, 9, 10, 38, 27, 82, 43]
                                       ↑ pivot in final position!

          Left:  [3, 9]         (all ≤ 10)
          Right: [38, 27, 82, 43]  (all > 10)

  Step 2: Recursively sort [3, 9]
          Pivot = 9
          3 ≤ 9 → [3, 9]  ✓ already sorted

  Step 3: Recursively sort [38, 27, 82, 43]
          Pivot = 43
          Partition: 38 ≤ 43, 27 ≤ 43 → [38, 27, 43, 82]
                                                ↑ pivot
          Left:  [38, 27]
          Right: [82]

  Step 4: Sort [38, 27] → pivot=27 → [27, 38]
          Sort [82] → base case, done

  Combine everything:
  [3, 9, 10, 27, 38, 43, 82] ✓
```

**Why quicksort is fast in practice**: On average, the pivot
splits the array roughly in half, giving O(n log n). The
constant factors are small because quicksort works in-place
(no extra array needed) and has excellent cache behavior
(sequential memory access).

**The worst case**: If the pivot is always the smallest or
largest element (e.g., already-sorted input with last-element
pivot), one side has n-1 elements and the other has 0. This
gives O(n²). Mitigation strategies:
- **Randomized pivot**: Pick a random element as pivot.
  Expected time is O(n log n) regardless of input.
- **Median-of-three**: Use the median of the first, middle,
  and last elements as pivot.

### Heapsort — Sort Using a Heap

Build a max-heap from the array, then repeatedly extract the
maximum element and place it at the end.

```
  HEAPSORT — HIGH-LEVEL TRACE ON [5, 3, 8, 1, 2]

  Step 1: Build max-heap (heapify)
          [8, 3, 5, 1, 2]

              8
            /   \
           3     5
          / \
         1   2

  Step 2: Extract max (8), swap with last, heapify remaining
          Swap 8 and 2: [2, 3, 5, 1, | 8]
          Heapify:       [5, 3, 2, 1, | 8]

  Step 3: Extract max (5), swap with last unsorted
          Swap 5 and 1: [1, 3, 2, | 5, 8]
          Heapify:       [3, 1, 2, | 5, 8]

  Step 4: Extract max (3)
          Swap 3 and 2: [2, 1, | 3, 5, 8]
          Heapify:       [2, 1, | 3, 5, 8]

  Step 5: Extract max (2)
          Swap 2 and 1: [1, | 2, 3, 5, 8]

  Result: [1, 2, 3, 5, 8] ✓
```

**Why heapsort matters**: It's O(n log n) in the worst case
(guaranteed, unlike quicksort) and uses O(1) extra space
(unlike merge sort). The downside: poor cache performance
(heap operations jump around in memory) and it's not stable.

```
  EFFICIENT SORTS — COMPLEXITY SUMMARY

  ┌──────────────────┬──────────┬──────────┬──────────┬───────┬────────┐
  │ Algorithm        │ Best     │ Average  │ Worst    │ Space │ Stable │
  ├──────────────────┼──────────┼──────────┼──────────┼───────┼────────┤
  │ Merge sort       │ O(n lg n)│ O(n lg n)│ O(n lg n)│ O(n)  │ Yes    │
  │ Quicksort        │ O(n lg n)│ O(n lg n)│ O(n²)    │ O(lg n)│ No*   │
  │ Heapsort         │ O(n lg n)│ O(n lg n)│ O(n lg n)│ O(1)  │ No     │
  └──────────────────┴──────────┴──────────┴──────────┴───────┴────────┘

  * Quicksort's space is O(log n) for the recursion stack (average case).
    Worst case stack depth is O(n), but tail-call optimization avoids this.
  * "lg n" means log₂ n throughout this lesson.
```

```
  ALL SIX SORTS — COMPLETE COMPARISON

  ┌──────────────────┬──────────┬──────────┬──────────┬───────┬────────┐
  │ Algorithm        │ Best     │ Average  │ Worst    │ Space │ Stable │
  ├──────────────────┼──────────┼──────────┼──────────┼───────┼────────┤
  │ Bubble sort      │ O(n)     │ O(n²)    │ O(n²)    │ O(1)  │ Yes    │
  │ Selection sort   │ O(n²)    │ O(n²)    │ O(n²)    │ O(1)  │ No     │
  │ Insertion sort   │ O(n)     │ O(n²)    │ O(n²)    │ O(1)  │ Yes    │
  │ Merge sort       │ O(n lg n)│ O(n lg n)│ O(n lg n)│ O(n)  │ Yes    │
  │ Quicksort        │ O(n lg n)│ O(n lg n)│ O(n²)    │O(lg n)│ No     │
  │ Heapsort         │ O(n lg n)│ O(n lg n)│ O(n lg n)│ O(1)  │ No     │
  └──────────────────┴──────────┴──────────┴──────────┴───────┴────────┘

  When to use which:
  • Small arrays (n < 50): Insertion sort — low overhead, adaptive
  • Need guaranteed O(n lg n) + stability: Merge sort
  • General purpose, fastest in practice: Quicksort (randomized)
  • Need guaranteed O(n lg n) + O(1) space: Heapsort
  • Nearly sorted data: Insertion sort — O(n) best case
  • Teaching/learning: Bubble sort (but never in production)
```

---

## Why O(n log n) Is the Best We Can Do

This is one of the most beautiful results in computer science:
no comparison-based sorting algorithm can do better than
O(n log n) in the worst case. Not merge sort, not some
undiscovered future algorithm — nothing that sorts by comparing
pairs of elements.

### The Decision Tree Argument

Any comparison-based sort can be modeled as a binary decision
tree. Each internal node is a comparison ("is a[i] < a[j]?"),
and each leaf is a specific permutation of the input — one
possible sorted order.

```
  DECISION TREE FOR SORTING 3 ELEMENTS [a, b, c]

  There are 3! = 6 possible orderings of 3 elements.
  The tree must have at least 6 leaves.

                        a < b?
                       /      \
                    yes         no
                   /              \
               b < c?            b < c?
              /     \           /      \
           yes       no      yes        no
           /          \       /           \
       a<b<c       a < c?  b<a    and   a < c?
                  /      \  b<c        /      \
               yes        no        yes        no
               /            \        /           \
           a<c<b          c<a<b   b<c<a        c<b<a

  Height of tree = number of comparisons in worst case
```

**The key insight**: A binary tree with L leaves has height at
least ⌈log₂ L⌉. For n elements, there are n! possible
permutations, so the tree needs at least n! leaves.

```
  LOWER BOUND DERIVATION

  Minimum comparisons ≥ ⌈log₂(n!)⌉

  Using Stirling's approximation: n! ≈ (n/e)ⁿ

  log₂(n!) ≈ log₂((n/e)ⁿ)
            = n · log₂(n/e)
            = n · (log₂ n - log₂ e)
            = n · log₂ n - n · log₂ e
            ≈ n log₂ n - 1.44n
            = Θ(n log n)

  Therefore: any comparison sort needs Ω(n log n) comparisons
  in the worst case. This is a LOWER BOUND on the problem,
  not on any specific algorithm.
```

This means merge sort and heapsort are **asymptotically
optimal** — they match the lower bound. You cannot invent a
comparison-based sort that's fundamentally faster.

---

## Technical Deep-Dive: Implementations

### Python

```python
# Python — Comparison-Based Sorting Algorithms


def bubble_sort(arr: list) -> list:
    """Bubble sort with early-exit optimization.
    Time: O(n²) average/worst, O(n) best (already sorted)
    Space: O(1)
    Stable: Yes
    """
    a = arr[:]
    n = len(a)
    for i in range(n):
        swapped = False
        for j in range(n - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break  # Array is sorted — exit early
    return a


def selection_sort(arr: list) -> list:
    """Selection sort — find min, place it, repeat.
    Time: O(n²) always
    Space: O(1)
    Stable: No (swapping can reorder equal elements)
    """
    a = arr[:]
    n = len(a)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if a[j] < a[min_idx]:
                min_idx = j
        a[i], a[min_idx] = a[min_idx], a[i]
    return a


def insertion_sort(arr: list) -> list:
    """Insertion sort — how humans sort playing cards.
    Time: O(n²) average/worst, O(n) best (nearly sorted)
    Space: O(1)
    Stable: Yes
    """
    a = arr[:]
    for i in range(1, len(a)):
        key = a[i]
        j = i - 1
        while j >= 0 and a[j] > key:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = key
    return a


def merge_sort(arr: list) -> list:
    """Merge sort — divide, sort halves, merge.
    Time: O(n log n) always
    Space: O(n) for temporary arrays
    Stable: Yes
    """
    if len(arr) <= 1:
        return arr[:]

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return _merge(left, right)


def _merge(left: list, right: list) -> list:
    """Merge two sorted lists into one sorted list."""
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:  # <= for stability
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result


import random

def quicksort(arr: list) -> list:
    """Quicksort with randomized pivot.
    Time: O(n log n) average, O(n²) worst (extremely unlikely with random pivot)
    Space: O(log n) average stack depth
    Stable: No
    """
    a = arr[:]
    _quicksort(a, 0, len(a) - 1)
    return a


def _quicksort(a: list, lo: int, hi: int) -> None:
    if lo < hi:
        pivot_idx = _partition(a, lo, hi)
        _quicksort(a, lo, pivot_idx - 1)
        _quicksort(a, pivot_idx + 1, hi)


def _partition(a: list, lo: int, hi: int) -> int:
    # Randomized pivot selection
    pivot_idx = random.randint(lo, hi)
    a[pivot_idx], a[hi] = a[hi], a[pivot_idx]
    pivot = a[hi]

    i = lo
    for j in range(lo, hi):
        if a[j] <= pivot:
            a[i], a[j] = a[j], a[i]
            i += 1
    a[i], a[hi] = a[hi], a[i]
    return i


def heapsort(arr: list) -> list:
    """Heapsort — build max-heap, extract max repeatedly.
    Time: O(n log n) always
    Space: O(1)
    Stable: No
    """
    a = arr[:]
    n = len(a)

    # Build max-heap (heapify from bottom up)
    for i in range(n // 2 - 1, -1, -1):
        _sift_down(a, i, n)

    # Extract max one by one
    for end in range(n - 1, 0, -1):
        a[0], a[end] = a[end], a[0]  # Move max to end
        _sift_down(a, 0, end)         # Restore heap property
    return a


def _sift_down(a: list, i: int, size: int) -> None:
    """Sift element at index i down to restore max-heap property."""
    while True:
        largest = i
        left = 2 * i + 1
        right = 2 * i + 2
        if left < size and a[left] > a[largest]:
            largest = left
        if right < size and a[right] > a[largest]:
            largest = right
        if largest == i:
            break
        a[i], a[largest] = a[largest], a[i]
        i = largest


# Demo
data = [38, 27, 43, 3, 9, 82, 10]
print(f"Original:       {data}")
print(f"Bubble sort:    {bubble_sort(data)}")
print(f"Selection sort: {selection_sort(data)}")
print(f"Insertion sort: {insertion_sort(data)}")
print(f"Merge sort:     {merge_sort(data)}")
print(f"Quicksort:      {quicksort(data)}")
print(f"Heapsort:       {heapsort(data)}")
```


### TypeScript

```typescript
// TypeScript — Comparison-Based Sorting Algorithms


function bubbleSort(arr: number[]): number[] {
  // Time: O(n²) average/worst, O(n) best
  // Space: O(1) | Stable: Yes
  const a = [...arr];
  const n = a.length;
  for (let i = 0; i < n; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break; // Early exit if sorted
  }
  return a;
}


function selectionSort(arr: number[]): number[] {
  // Time: O(n²) always | Space: O(1) | Stable: No
  const a = [...arr];
  const n = a.length;
  for (let i = 0; i < n; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      if (a[j] < a[minIdx]) minIdx = j;
    }
    [a[i], a[minIdx]] = [a[minIdx], a[i]];
  }
  return a;
}


function insertionSort(arr: number[]): number[] {
  // Time: O(n²) average/worst, O(n) best
  // Space: O(1) | Stable: Yes
  const a = [...arr];
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = key;
  }
  return a;
}


function mergeSort(arr: number[]): number[] {
  // Time: O(n log n) always | Space: O(n) | Stable: Yes
  if (arr.length <= 1) return [...arr];

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

function merge(left: number[], right: number[]): number[] {
  const result: number[] = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {  // <= for stability
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);
  return result;
}


function quickSort(arr: number[]): number[] {
  // Time: O(n log n) average, O(n²) worst
  // Space: O(log n) stack | Stable: No
  const a = [...arr];
  quickSortHelper(a, 0, a.length - 1);
  return a;
}

function quickSortHelper(a: number[], lo: number, hi: number): void {
  if (lo < hi) {
    const pivotIdx = partition(a, lo, hi);
    quickSortHelper(a, lo, pivotIdx - 1);
    quickSortHelper(a, pivotIdx + 1, hi);
  }
}

function partition(a: number[], lo: number, hi: number): number {
  // Randomized pivot
  const pivotIdx = lo + Math.floor(Math.random() * (hi - lo + 1));
  [a[pivotIdx], a[hi]] = [a[hi], a[pivotIdx]];
  const pivot = a[hi];

  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (a[j] <= pivot) {
      [a[i], a[j]] = [a[j], a[i]];
      i++;
    }
  }
  [a[i], a[hi]] = [a[hi], a[i]];
  return i;
}


function heapSort(arr: number[]): number[] {
  // Time: O(n log n) always | Space: O(1) | Stable: No
  const a = [...arr];
  const n = a.length;

  // Build max-heap
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    siftDown(a, i, n);
  }

  // Extract max one by one
  for (let end = n - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end], a[0]];
    siftDown(a, 0, end);
  }
  return a;
}

function siftDown(a: number[], i: number, size: number): void {
  while (true) {
    let largest = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < size && a[left] > a[largest]) largest = left;
    if (right < size && a[right] > a[largest]) largest = right;
    if (largest === i) break;
    [a[i], a[largest]] = [a[largest], a[i]];
    i = largest;
  }
}


// Demo
const data = [38, 27, 43, 3, 9, 82, 10];
console.log("Original:      ", data);
console.log("Bubble sort:   ", bubbleSort(data));
console.log("Selection sort:", selectionSort(data));
console.log("Insertion sort:", insertionSort(data));
console.log("Merge sort:    ", mergeSort(data));
console.log("Quicksort:     ", quickSort(data));
console.log("Heapsort:      ", heapSort(data));
```


### Rust

```rust
use rand::Rng;

/// Bubble sort with early-exit optimization.
/// Time: O(n²) average/worst, O(n) best | Space: O(1) | Stable: Yes
fn bubble_sort(arr: &[i32]) -> Vec<i32> {
    let mut a = arr.to_vec();
    let n = a.len();
    for i in 0..n {
        let mut swapped = false;
        for j in 0..n - 1 - i {
            if a[j] > a[j + 1] {
                a.swap(j, j + 1);
                swapped = true;
            }
        }
        if !swapped { break; }
    }
    a
}

/// Selection sort — find min, place it, repeat.
/// Time: O(n²) always | Space: O(1) | Stable: No
fn selection_sort(arr: &[i32]) -> Vec<i32> {
    let mut a = arr.to_vec();
    let n = a.len();
    for i in 0..n {
        let mut min_idx = i;
        for j in (i + 1)..n {
            if a[j] < a[min_idx] {
                min_idx = j;
            }
        }
        a.swap(i, min_idx);
    }
    a
}

/// Insertion sort — how humans sort playing cards.
/// Time: O(n²) average/worst, O(n) best | Space: O(1) | Stable: Yes
fn insertion_sort(arr: &[i32]) -> Vec<i32> {
    let mut a = arr.to_vec();
    for i in 1..a.len() {
        let key = a[i];
        let mut j = i as isize - 1;
        while j >= 0 && a[j as usize] > key {
            a[(j + 1) as usize] = a[j as usize];
            j -= 1;
        }
        a[(j + 1) as usize] = key;
    }
    a
}

/// Merge sort — divide, sort halves, merge.
/// Time: O(n log n) always | Space: O(n) | Stable: Yes
fn merge_sort(arr: &[i32]) -> Vec<i32> {
    if arr.len() <= 1 {
        return arr.to_vec();
    }
    let mid = arr.len() / 2;
    let left = merge_sort(&arr[..mid]);
    let right = merge_sort(&arr[mid..]);
    merge(&left, &right)
}

fn merge(left: &[i32], right: &[i32]) -> Vec<i32> {
    let mut result = Vec::with_capacity(left.len() + right.len());
    let (mut i, mut j) = (0, 0);
    while i < left.len() && j < right.len() {
        if left[i] <= right[j] { // <= for stability
            result.push(left[i]);
            i += 1;
        } else {
            result.push(right[j]);
            j += 1;
        }
    }
    result.extend_from_slice(&left[i..]);
    result.extend_from_slice(&right[j..]);
    result
}

/// Quicksort with randomized pivot.
/// Time: O(n log n) average, O(n²) worst | Space: O(log n) | Stable: No
fn quicksort(arr: &[i32]) -> Vec<i32> {
    let mut a = arr.to_vec();
    let hi = a.len().saturating_sub(1);
    if !a.is_empty() {
        quicksort_helper(&mut a, 0, hi);
    }
    a
}

fn quicksort_helper(a: &mut [i32], lo: usize, hi: usize) {
    if lo < hi {
        let pivot_idx = partition_qs(a, lo, hi);
        if pivot_idx > 0 {
            quicksort_helper(a, lo, pivot_idx - 1);
        }
        quicksort_helper(a, pivot_idx + 1, hi);
    }
}

fn partition_qs(a: &mut [i32], lo: usize, hi: usize) -> usize {
    let mut rng = rand::thread_rng();
    let pivot_idx = rng.gen_range(lo..=hi);
    a.swap(pivot_idx, hi);
    let pivot = a[hi];

    let mut i = lo;
    for j in lo..hi {
        if a[j] <= pivot {
            a.swap(i, j);
            i += 1;
        }
    }
    a.swap(i, hi);
    i
}

/// Heapsort — build max-heap, extract max repeatedly.
/// Time: O(n log n) always | Space: O(1) | Stable: No
fn heapsort(arr: &[i32]) -> Vec<i32> {
    let mut a = arr.to_vec();
    let n = a.len();

    // Build max-heap
    for i in (0..n / 2).rev() {
        sift_down(&mut a, i, n);
    }

    // Extract max one by one
    for end in (1..n).rev() {
        a.swap(0, end);
        sift_down(&mut a, 0, end);
    }
    a
}

fn sift_down(a: &mut [i32], mut i: usize, size: usize) {
    loop {
        let mut largest = i;
        let left = 2 * i + 1;
        let right = 2 * i + 2;
        if left < size && a[left] > a[largest] { largest = left; }
        if right < size && a[right] > a[largest] { largest = right; }
        if largest == i { break; }
        a.swap(i, largest);
        i = largest;
    }
}

fn main() {
    let data = vec![38, 27, 43, 3, 9, 82, 10];
    println!("Original:       {:?}", data);
    println!("Bubble sort:    {:?}", bubble_sort(&data));
    println!("Selection sort: {:?}", selection_sort(&data));
    println!("Insertion sort: {:?}", insertion_sort(&data));
    println!("Merge sort:     {:?}", merge_sort(&data));
    println!("Quicksort:      {:?}", quicksort(&data));
    println!("Heapsort:       {:?}", heapsort(&data));
}
```

Note: Rust's standard library provides `slice::sort()` (stable,
based on a merge sort variant) and `slice::sort_unstable()`
(unstable, based on a pattern-defeating quicksort). In practice,
always use these — they're heavily optimized. The implementations
above are for learning.

---

## What If We Tried to Sort Faster Than O(n log n) Using Only Comparisons?

You can't. And here's why that's a profound result.

The decision tree argument proves that any algorithm which sorts
by comparing pairs of elements must make at least Ω(n log n)
comparisons in the worst case. This isn't a limitation of known
algorithms — it's a mathematical impossibility.

### Why the Proof Works

Think about it this way: before sorting, the input could be in
any of n! possible orderings. Each comparison gives you one bit
of information (yes or no). To distinguish between n! possible
inputs, you need at least log₂(n!) bits of information.

```
  THE INFORMATION-THEORETIC ARGUMENT

  n elements → n! possible orderings

  Each comparison: 1 bit of information (< or ≥)

  Bits needed to identify the correct ordering:
  log₂(n!) ≈ n log₂ n - 1.44n = Θ(n log n)

  So you need Ω(n log n) comparisons just to IDENTIFY
  which permutation you're looking at, let alone sort it.
```

### What This Means in Practice

- **Merge sort is optimal**: It matches the lower bound.
  You literally cannot do better with comparisons.
- **Quicksort is optimal on average**: Its expected O(n log n)
  matches the lower bound (though its worst case is O(n²)).
- **The only way to beat O(n log n)** is to NOT use comparisons.
  Counting sort, radix sort, and bucket sort achieve O(n) by
  exploiting the structure of the input (e.g., integers in a
  known range). We'll cover these in the next lesson.

### A Thought Experiment

Imagine you're a sorting algorithm. Someone hands you n numbers.
You can only ask questions of the form "is a[i] < a[j]?" Each
answer eliminates some possible orderings. You need to narrow
down from n! possibilities to exactly 1 (the sorted order).

With binary questions, the fastest you can narrow down is by
half each time. Starting from n! possibilities:

```
  n! → n!/2 → n!/4 → ... → 1

  Steps needed: log₂(n!) = Θ(n log n)
```

No cleverness, no trick, no future breakthrough can change this.
It's a fundamental limit of comparison-based information
gathering. The only escape is to use non-comparison operations
— which is exactly what counting sort and radix sort do.

---

## Exercises

1. **Trace by hand**: Sort the array [64, 25, 12, 22, 11] using
   (a) selection sort, (b) insertion sort, and (c) merge sort.
   Write out the state of the array after each step. Count the
   total number of comparisons for each.

2. **Stability matters**: Given the input
   `[(3, "a"), (1, "b"), (3, "c"), (2, "d")]`, sort by the
   first element using (a) insertion sort and (b) selection sort.
   Show that insertion sort preserves the relative order of
   (3, "a") and (3, "c"), but selection sort may not.

3. **Quicksort worst case**: Construct an input of 8 elements
   where always choosing the last element as pivot gives O(n²)
   behavior. Then show how randomized pivot selection avoids
   this.

4. **Merge sort space**: Implement an in-place merge sort
   variant. What happens to the time complexity? Why is the
   standard O(n) space version preferred in practice?

5. **Decision tree lower bound**: For n = 4 elements, how many
   leaves must the decision tree have? What is the minimum
   height? Verify that this matches ⌈log₂(4!)⌉ = ⌈log₂(24)⌉
   = 5 comparisons.

6. **Hybrid sort**: Implement a sort that uses quicksort for
   large subarrays but switches to insertion sort when the
   subarray size drops below 16. Compare its performance against
   pure quicksort on random arrays of size 10,000. Why does the
   hybrid approach win?

---

**Previous**: [Lesson 10 — Amortized Analysis Deep Dive](./10-amortized-analysis-deep-dive.md)
**Next**: [Lesson 12 — Non-Comparison Sorting — Breaking the O(n log n) Barrier](./12-non-comparison-sorting.md)
