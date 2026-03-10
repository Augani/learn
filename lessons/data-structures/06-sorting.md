# Lesson 06: Sorting — The Practical Algorithms

## Why Sorting Matters

Sorting is a prerequisite for many other operations:
- **Binary search** requires sorted data (O(log n) vs O(n))
- **Finding duplicates** becomes trivial on sorted data (adjacent elements)
- **Merge operations** (joining two datasets) are efficient on sorted data
- **Human readability** — sorted output is easier to scan and understand
- **Database indexes** are built on sorted structures (B-trees)

The study of sorting algorithms teaches fundamental algorithmic thinking: divide and conquer, trade-offs between time and space, and why theoretical complexity doesn't always match practical performance.

## The Sorting Landscape

```
                    Speed
                     ↑
          O(n)    ── │ ── Counting/Radix (restricted inputs)
                     │
      O(n log n) ── │ ── Merge Sort, Quick Sort, Tim Sort ← the practical ones
                     │
          O(n²)  ── │ ── Bubble Sort, Insertion Sort ← educational / small n only
                     │
                     └──────────────────────────────────→ Generality
                          Restricted         Any comparable data
```

## Bubble Sort: Simple but Terrible

Walk through the array, swapping adjacent elements that are out of order. Repeat until no swaps needed.

```
Sorting [5, 3, 8, 1, 2]:

Pass 1: Compare adjacent pairs, swap if needed
[5, 3, 8, 1, 2]  → 5>3 swap → [3, 5, 8, 1, 2]
[3, 5, 8, 1, 2]  → 5<8 ok   → [3, 5, 8, 1, 2]
[3, 5, 8, 1, 2]  → 8>1 swap → [3, 5, 1, 8, 2]
[3, 5, 1, 8, 2]  → 8>2 swap → [3, 5, 1, 2, 8]  ← 8 "bubbled" to the end

Pass 2:
[3, 5, 1, 2, 8]  → 3<5 ok   → [3, 5, 1, 2, 8]
[3, 5, 1, 2, 8]  → 5>1 swap → [3, 1, 5, 2, 8]
[3, 1, 5, 2, 8]  → 5>2 swap → [3, 1, 2, 5, 8]  ← 5 in place

Pass 3:
[3, 1, 2, 5, 8]  → 3>1 swap → [1, 3, 2, 5, 8]
[1, 3, 2, 5, 8]  → 3>2 swap → [1, 2, 3, 5, 8]  ← 3 in place

Pass 4:
[1, 2, 3, 5, 8]  → no swaps → done!
```

```rust
fn bubble_sort(data: &mut [i32]) {
    let n = data.len();
    for i in 0..n {
        let mut swapped = false;
        for j in 0..n - 1 - i {
            if data[j] > data[j + 1] {
                data.swap(j, j + 1);
                swapped = true;
            }
        }
        if !swapped {
            break;
        }
    }
}
```

**Time**: O(n^2) average and worst, O(n) best (already sorted with early exit)
**Space**: O(1)
**Stable**: Yes

Never use in production. Only useful for understanding what sorting means.

## Insertion Sort: Good for Small/Nearly-Sorted Data

Take each element and insert it into its correct position in the already-sorted portion.

### The Card Hand Analogy

When you pick up cards one at a time, you insert each card into the right spot in your hand:

```
Hand: [3]                    Pick up 3
Hand: [3, 7]                 Pick up 7 — goes after 3
Hand: [2, 3, 7]              Pick up 2 — insert before 3
Hand: [2, 3, 5, 7]           Pick up 5 — insert between 3 and 7
Hand: [1, 2, 3, 5, 7]        Pick up 1 — insert at beginning
```

```
Sorting [5, 3, 8, 1, 2]:

Step 1: [5 | 3, 8, 1, 2]    sorted portion = [5]
        Insert 3: shift 5 right → [3, 5 | 8, 1, 2]

Step 2: [3, 5 | 8, 1, 2]    sorted portion = [3, 5]
        Insert 8: already in place → [3, 5, 8 | 1, 2]

Step 3: [3, 5, 8 | 1, 2]    sorted portion = [3, 5, 8]
        Insert 1: shift 8,5,3 right → [1, 3, 5, 8 | 2]

Step 4: [1, 3, 5, 8 | 2]    sorted portion = [1, 3, 5, 8]
        Insert 2: shift 8,5,3 right → [1, 2, 3, 5, 8]

Done!
```

```rust
fn insertion_sort(data: &mut [i32]) {
    for i in 1..data.len() {
        let key = data[i];
        let mut j = i;
        while j > 0 && data[j - 1] > key {
            data[j] = data[j - 1];
            j -= 1;
        }
        data[j] = key;
    }
}
```

**Time**: O(n^2) average and worst, O(n) best (nearly sorted)
**Space**: O(1)
**Stable**: Yes

Insertion sort is used inside production sort algorithms (like Tim sort) for small sub-arrays (n < 16-64) because its low overhead and cache-friendliness beat merge sort's overhead for small n.

## Merge Sort: Divide and Conquer

### The Card Deck Analogy

Sorting a deck of cards by merge sort:
1. Split the deck in half
2. Sort each half (recursively)
3. Merge the two sorted halves by comparing top cards

```
Split phase (divide):

[38, 27, 43, 3, 9, 82, 10]
          /                \
   [38, 27, 43]        [3, 9, 82, 10]
     /      \            /          \
  [38, 27]  [43]     [3, 9]    [82, 10]
   /    \              /  \      /    \
 [38]  [27]          [3]  [9]  [82]  [10]


Merge phase (conquer):

 [38]  [27]          [3]  [9]  [82]  [10]
   \    /              \  /      \    /
  [27, 38]  [43]     [3, 9]    [10, 82]
     \      /            \          /
   [27, 38, 43]        [3, 9, 10, 82]
          \                /
   [3, 9, 10, 27, 38, 43, 82]
```

### How Merging Works

```
Merging [27, 38, 43] and [3, 9, 10, 82]:

Left:  [27, 38, 43]     Right: [3, 9, 10, 82]     Result: []
        ↑                       ↑
        Compare: 27 vs 3 → take 3

Left:  [27, 38, 43]     Right: [9, 10, 82]         Result: [3]
        ↑                       ↑
        Compare: 27 vs 9 → take 9

Left:  [27, 38, 43]     Right: [10, 82]            Result: [3, 9]
        ↑                       ↑
        Compare: 27 vs 10 → take 10

Left:  [27, 38, 43]     Right: [82]                Result: [3, 9, 10]
        ↑                       ↑
        Compare: 27 vs 82 → take 27

Left:  [38, 43]         Right: [82]                Result: [3, 9, 10, 27]
        ↑                       ↑
        Compare: 38 vs 82 → take 38

Left:  [43]             Right: [82]                Result: [3, 9, 10, 27, 38]
        ↑                       ↑
        Compare: 43 vs 82 → take 43

Left:  []               Right: [82]                Result: [3, 9, 10, 27, 38, 43]
                                                    Append remaining: [82]

Final: [3, 9, 10, 27, 38, 43, 82]
```

```rust
fn merge_sort(data: &mut [i32]) {
    let len = data.len();
    if len <= 1 {
        return;
    }
    let mid = len / 2;

    let mut left = data[..mid].to_vec();
    let mut right = data[mid..].to_vec();

    merge_sort(&mut left);
    merge_sort(&mut right);

    merge_into(data, &left, &right);
}

fn merge_into(dest: &mut [i32], left: &[i32], right: &[i32]) {
    let (mut li, mut ri, mut di) = (0, 0, 0);

    while li < left.len() && ri < right.len() {
        if left[li] <= right[ri] {
            dest[di] = left[li];
            li += 1;
        } else {
            dest[di] = right[ri];
            ri += 1;
        }
        di += 1;
    }

    while li < left.len() {
        dest[di] = left[li];
        li += 1;
        di += 1;
    }

    while ri < right.len() {
        dest[di] = right[ri];
        ri += 1;
        di += 1;
    }
}
```

**Time**: O(n log n) always (best, average, worst)
**Space**: O(n) — needs temporary storage for merging
**Stable**: Yes

Why O(n log n)? There are log n levels of recursion, and each level does O(n) work (merging):

```
Level 0:  [────────── n elements ──────────]  → n work to merge
Level 1:  [──── n/2 ────] [──── n/2 ────]    → n work to merge
Level 2:  [─ n/4 ─] [─ n/4 ─] [─ n/4 ─] [─ n/4 ─]  → n work to merge
...
Level log n: [1] [1] [1] ... [1]              → n work to merge

Total: n work × log n levels = O(n log n)
```

## Quick Sort: Fast in Practice

Choose a **pivot** element, partition the array into elements less than and greater than the pivot, then recursively sort each partition.

```
Sorting [8, 3, 1, 7, 5, 6, 2, 4], pivot = 4:

Partition: elements < 4 go left, elements > 4 go right

[3, 1, 2] [4] [8, 7, 5, 6]
  < pivot  pivot  > pivot

Recursively sort each side:

[3, 1, 2] → pivot=2 → [1] [2] [3]
[8, 7, 5, 6] → pivot=6 → [5] [6] [8, 7]
                                    → pivot=7 → [7] [8]

Result: [1, 2, 3, 4, 5, 6, 7, 8]
```

```rust
fn quick_sort(data: &mut [i32]) {
    if data.len() <= 1 {
        return;
    }

    let pivot_idx = partition(data);
    let (left, right) = data.split_at_mut(pivot_idx);
    quick_sort(left);
    quick_sort(&mut right[1..]);
}

fn partition(data: &mut [i32]) -> usize {
    let pivot = data[data.len() - 1];
    let mut store_idx = 0;

    for i in 0..data.len() - 1 {
        if data[i] <= pivot {
            data.swap(i, store_idx);
            store_idx += 1;
        }
    }
    data.swap(store_idx, data.len() - 1);
    store_idx
}
```

**Time**: O(n log n) average, O(n^2) worst case (bad pivot choices)
**Space**: O(log n) for recursion stack
**Stable**: No

### Why Quick Sort Is Fast in Practice

Despite the O(n^2) worst case, quick sort is often the fastest comparison sort:
1. **In-place**: no extra O(n) allocation like merge sort
2. **Cache-friendly**: partitioning accesses elements sequentially
3. **Small constant factor**: fewer comparisons and swaps per operation

The O(n^2) worst case happens when the pivot is always the smallest or largest element (e.g., already-sorted input with first-element pivot). Modern implementations use **median-of-three** pivot selection or **random pivot** to avoid this.

## Tim Sort: What Production Code Actually Uses

Tim sort is a hybrid of merge sort and insertion sort, invented by Tim Peters for Python in 2002. It's now used by Rust, Python, Java, and many other languages.

The key insight: **real-world data often has runs of already-sorted elements**.

```
Real data often looks like:

[3, 5, 7, 9, | 2, 4, 8, | 1, 6, 10, 15, 20, | 11, 12]
 ← run 1 →     ← run 2 →   ← run 3 →            ← run 4 →
```

Tim sort:
1. Scan for natural runs (already sorted subsequences)
2. Extend short runs using insertion sort (to a minimum length, typically 32-64)
3. Merge runs using merge sort's merge operation
4. Use a merge stack with invariants to balance merges

**Time**: O(n) best (already sorted!), O(n log n) average and worst
**Space**: O(n) for merging
**Stable**: Yes

## The O(n log n) Barrier

It's been **proven mathematically** that no comparison-based sorting algorithm can do better than O(n log n) in the worst case.

The proof: with n elements, there are n! possible orderings. Each comparison eliminates at most half the remaining possibilities. So you need at least log₂(n!) comparisons, which is Θ(n log n).

```
n! possible orderings for n elements:

n=3: 3! = 6 orderings → need log₂(6) ≈ 3 comparisons minimum
n=10: 10! = 3,628,800 → need log₂(3,628,800) ≈ 22 comparisons
n=100: 100! ≈ 9.3×10¹⁵⁷ → need ≈ 525 comparisons
```

## Non-Comparison Sorts: Breaking the Barrier

If your data has special properties, you can sort in O(n):

### Counting Sort

For integers in a known range [0, k]:

```
Input:  [4, 2, 2, 8, 3, 3, 1]
Range:  0..9

Count:  [0, 1, 2, 1, 1, 0, 0, 0, 1, 0]
         0  1  2  3  4  5  6  7  8  9

         index 1 has count 1 → one 1
         index 2 has count 2 → two 2s
         index 3 has count 1 → one 3
         ...

Output: [1, 2, 2, 3, 3, 4, 8]
```

**Time**: O(n + k) where k is the range
**Space**: O(k)
**When**: integers in a small range

### Radix Sort

Sort by each digit, least significant first:

```
Input: [329, 457, 657, 839, 436, 720, 355]

Sort by ones digit:   [720, 355, 436, 457, 657, 329, 839]
Sort by tens digit:   [720, 329, 436, 839, 355, 457, 657]
Sort by hundreds:     [329, 355, 436, 457, 657, 720, 839]
```

**Time**: O(d * (n + k)) where d = number of digits, k = radix (base)
**Space**: O(n + k)
**When**: fixed-length integers or strings

## Stable vs Unstable Sorting

A **stable** sort preserves the relative order of equal elements:

```
Sort by age:

Before:  [(Alice, 30), (Bob, 25), (Carol, 30), (Dave, 25)]

Stable:  [(Bob, 25), (Dave, 25), (Alice, 30), (Carol, 30)]
          Bob before Dave ✓        Alice before Carol ✓
          (original order preserved for equal ages)

Unstable: [(Dave, 25), (Bob, 25), (Carol, 30), (Alice, 30)]
           Dave before Bob ✗       (original order NOT preserved)
```

Stability matters when sorting by multiple fields (sort by last name, then by first name).

## Rust Standard Library

```rust
let mut data = vec![5, 3, 8, 1, 2];

data.sort();               // stable sort (Tim sort), O(n log n)
data.sort_unstable();      // unstable sort (pattern-defeating quicksort)
                           // ~10-20% faster, less memory

data.sort_by(|a, b| b.cmp(a));            // sort descending
data.sort_by_key(|x| std::cmp::Reverse(*x)); // sort descending (alternative)

let mut strings = vec!["banana", "apple", "cherry"];
strings.sort();                                    // lexicographic
strings.sort_by(|a, b| a.len().cmp(&b.len()));   // by length
```

- `sort()` → stable, Tim sort variant, O(n log n), O(n) extra space
- `sort_unstable()` → unstable, pattern-defeating quicksort, O(n log n), O(1) extra space

Use `sort_unstable()` when you don't need stability and want better performance.

## Cross-Language Comparison

| | Rust | Go | TypeScript |
|---|---|---|---|
| Default sort | `sort()` (Tim sort, stable) | `sort.Slice()` (pattern-defeating quicksort, unstable) | `Array.sort()` (Tim sort, stable) |
| Unstable sort | `sort_unstable()` | default | N/A |
| Custom comparator | `sort_by(\|a,b\| ...)` | `sort.Slice(s, func(i,j int) bool {...})` | `arr.sort((a,b) => ...)` |
| Sort by key | `sort_by_key(\|x\| ...)` | manual | manual |

TypeScript trap: `[1, 10, 2].sort()` returns `[1, 10, 2]` because the default sort is **lexicographic** (string comparison). You must write `[1, 10, 2].sort((a, b) => a - b)` for numeric sort.

## Exercises

### Exercise 1: Implement Merge Sort

Write merge sort in Rust:

```rust
fn merge_sort(data: &mut Vec<i32>) {
    todo!()
}

fn merge(left: &[i32], right: &[i32]) -> Vec<i32> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty() {
        let mut data = vec![];
        merge_sort(&mut data);
        assert_eq!(data, vec![]);
    }

    #[test]
    fn already_sorted() {
        let mut data = vec![1, 2, 3, 4, 5];
        merge_sort(&mut data);
        assert_eq!(data, vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn reverse_sorted() {
        let mut data = vec![5, 4, 3, 2, 1];
        merge_sort(&mut data);
        assert_eq!(data, vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn duplicates() {
        let mut data = vec![3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
        merge_sort(&mut data);
        assert_eq!(data, vec![1, 1, 2, 3, 3, 4, 5, 5, 5, 6, 9]);
    }
}
```

### Exercise 2: Benchmark Sort Algorithms

Compare your merge sort, Rust's `sort()`, and Rust's `sort_unstable()` on arrays of size 10,000 and 1,000,000:

```rust
use std::time::Instant;

fn benchmark_sort(name: &str, mut data: Vec<i32>, sort_fn: impl FnOnce(&mut Vec<i32>)) {
    let start = Instant::now();
    sort_fn(&mut data);
    println!("{}: {:?}", name, start.elapsed());
}

fn main() {
    let n = 1_000_000;
    let data: Vec<i32> = (0..n).rev().collect();

    benchmark_sort("merge_sort", data.clone(), |d| merge_sort(d));
    benchmark_sort("std sort", data.clone(), |d| d.sort());
    benchmark_sort("std sort_unstable", data.clone(), |d| d.sort_unstable());
}
```

### Exercise 3: Sort Stability Test

Demonstrate that `sort()` is stable but `sort_unstable()` may not be:

```rust
#[derive(Debug, Clone)]
struct Student {
    name: String,
    grade: u8,
    original_index: usize,
}

fn test_stability() {
    let students = vec![
        Student { name: "Alice".into(), grade: 90, original_index: 0 },
        Student { name: "Bob".into(), grade: 85, original_index: 1 },
        Student { name: "Carol".into(), grade: 90, original_index: 2 },
        Student { name: "Dave".into(), grade: 85, original_index: 3 },
    ];

    let mut stable = students.clone();
    stable.sort_by_key(|s| s.grade);
    // For equal grades, original order should be preserved

    let mut unstable = students.clone();
    unstable.sort_unstable_by_key(|s| s.grade);
    // For equal grades, original order is NOT guaranteed
}
```

---

Next: [Lesson 07: Hash Maps](./07-hash-maps.md)
