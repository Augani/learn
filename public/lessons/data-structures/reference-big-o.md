# Reference: Big-O Cheat Sheet

## What Big-O Actually Means

Big-O notation describes **how an algorithm's resource usage grows as input size increases**. It does not tell you the exact time in milliseconds. It tells you the **growth rate** — how the work scales.

Two algorithms can both be O(n), but one might be 10x faster than the other in practice. Big-O ignores constant factors and lower-order terms. It answers: **"If I double my input, how much more work do I do?"**

```
O(n)     → double input → ~double the work
O(n²)    → double input → ~quadruple the work
O(log n) → double input → ~one more step
O(1)     → double input → same work
```

## The Traffic Analogy

Think of Big-O like describing traffic patterns:

| Big-O | Traffic Analogy |
|-------|-----------------|
| O(1) | An empty highway at 3 AM. No matter how many people live in the city, your commute takes the same time. |
| O(log n) | A toll road with express lanes. More cars on the road, but the toll system halves the remaining traffic at each checkpoint. |
| O(n) | City traffic that scales linearly. Every new car on the road adds proportionally to your commute. |
| O(n log n) | Rush hour with smart traffic lights. Worse than linear, but the lights keep things from getting truly terrible. |
| O(n²) | A traffic jam where every new car blocks every other car. Adding 10 cars doesn't add 10 units of delay — it adds 100. |
| O(2^n) | A city where every new intersection doubles the total number of possible routes. The entire road system collapses. |

## Common Complexities with Examples

### O(1) — Constant Time

Work does not change with input size.

```
Input:       10    100    1,000    1,000,000
Operations:   1      1        1            1
```

Examples:
- Array access by index: `arr[42]`
- HashMap get/insert (average case)
- Stack push/pop
- Checking if a number is even/odd

```rust
fn get_first(data: &[i32]) -> Option<&i32> {
    data.first() // always one step, regardless of array size
}
```

### O(log n) — Logarithmic

Work grows by one step each time input doubles. Extremely efficient.

```
Input:       10    100    1,000    1,000,000    1,000,000,000
Operations:  ~3     ~7      ~10          ~20              ~30
```

Examples:
- Binary search
- BTreeMap get/insert
- Balanced BST operations
- Finding a word in a dictionary (divide and conquer)

```rust
// Binary search: each step eliminates half the remaining elements
fn binary_search(sorted: &[i32], target: i32) -> Option<usize> {
    let (mut low, mut high) = (0, sorted.len());
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

### O(n) — Linear

Work grows proportionally with input. Double input = double work.

```
Input:       10    100    1,000    1,000,000
Operations:  10    100    1,000    1,000,000
```

Examples:
- Linear search (find in unsorted array)
- Iterating through a list
- Counting elements
- Finding max/min in unsorted data

```rust
fn find_max(data: &[i32]) -> Option<&i32> {
    data.iter().max() // must check every element
}
```

### O(n log n) — Linearithmic

The sweet spot for comparison-based sorting. Slightly worse than linear.

```
Input:       10    100      1,000      1,000,000
Operations:  ~33   ~664     ~9,966     ~19,931,569
```

Examples:
- Merge sort, quick sort (average), heap sort
- Rust's `slice.sort()`
- Many divide-and-conquer algorithms

### O(n²) — Quadratic

Work grows with the square of input. Gets painful fast.

```
Input:       10    100      1,000       1,000,000
Operations:  100   10,000   1,000,000   1,000,000,000,000
```

Examples:
- Bubble sort, insertion sort, selection sort
- Nested loops over the same collection
- Comparing every pair of elements
- Naive string matching

```rust
fn has_duplicates(data: &[i32]) -> bool {
    for i in 0..data.len() {
        for j in (i + 1)..data.len() {
            if data[i] == data[j] {
                return true; // O(n²) comparisons in worst case
            }
        }
    }
    false
}
```

### O(2^n) — Exponential

Work doubles with each additional input element. Only feasible for tiny inputs.

```
Input:       10        20           30              40
Operations:  1,024     1,048,576    1,073,741,824   ~1 trillion
```

Examples:
- Naive recursive Fibonacci
- Generating all subsets of a set
- Brute-force traveling salesman
- Many brute-force combinatorial problems

## Visual Growth Comparison

```
Operations
    ^
    |                                                    /  O(2^n)
    |                                                   /
    |                                                  /
    |                                                 /
    |                                               /
    |                                             /
    |                                           /
    |                                        /
    |                                     /
    |                                  /          ___--- O(n²)
    |                              /       __---
    |                          /      __--
    |                       /    __--
    |                    /   _--
    |                 / _--            ___-------- O(n log n)
    |             / _-          ___----
    |          /_--       ___---
    |        _-      __---     ___------------ O(n)
    |     _-    __---    ___---
    |   _- __---   ___---
    |  _---  ___---
    | --- ---         ___________________________  O(log n)
    |--_______________
    |________________________________________________  O(1)
    +-------------------------------------------------> Input Size (n)
```

## Data Structure Operations — Big-O Summary

### Sequential Structures

| Structure | Access | Search | Insert (end) | Insert (mid) | Delete (end) | Delete (mid) | Space |
|-----------|--------|--------|--------------|--------------|--------------|--------------|-------|
| Array `[T; N]` | O(1) | O(n) | N/A (fixed) | N/A (fixed) | N/A (fixed) | N/A (fixed) | O(n) |
| Vec | O(1) | O(n) | O(1)* | O(n) | O(1) | O(n) | O(n) |
| LinkedList | O(n) | O(n) | O(1)** | O(1)** | O(1)** | O(1)** | O(n) |
| VecDeque | O(1) | O(n) | O(1)* | O(n) | O(1)* | O(n) | O(n) |

\* amortized
\** if you have a reference to the node; O(n) to find the node first

### Associative Structures

| Structure | Get | Insert | Delete | Iterate (sorted) | Space |
|-----------|-----|--------|--------|-------------------|-------|
| HashMap | O(1)* | O(1)* | O(1)* | O(n log n)** | O(n) |
| BTreeMap | O(log n) | O(log n) | O(log n) | O(n) | O(n) |
| HashSet | O(1)* | O(1)* | O(1)* | O(n log n)** | O(n) |
| BTreeSet | O(log n) | O(log n) | O(log n) | O(n) | O(n) |

\* average case; O(n) worst case with pathological hash collisions
\** must collect and sort; iteration itself is O(n) but order is arbitrary

### Tree / Heap

| Structure | Find min/max | Insert | Delete min/max | Search | Space |
|-----------|-------------|--------|----------------|--------|-------|
| BinaryHeap | O(1) | O(log n) | O(log n) | O(n) | O(n) |
| BST (balanced) | O(log n) | O(log n) | O(log n) | O(log n) | O(n) |
| BST (worst) | O(n) | O(n) | O(n) | O(n) | O(n) |

### Sorting Algorithms

| Algorithm | Best | Average | Worst | Space | Stable |
|-----------|------|---------|-------|-------|--------|
| Bubble Sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Insertion Sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes |
| Quick Sort | O(n log n) | O(n log n) | O(n²) | O(log n) | No |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No |
| Tim Sort | O(n) | O(n log n) | O(n log n) | O(n) | Yes |
| Counting Sort | O(n+k) | O(n+k) | O(n+k) | O(k) | Yes |

### Search Algorithms

| Algorithm | Best | Average | Worst | Prerequisite |
|-----------|------|---------|-------|--------------|
| Linear Search | O(1) | O(n) | O(n) | None |
| Binary Search | O(1) | O(log n) | O(log n) | Sorted data |
| HashMap lookup | O(1) | O(1) | O(n) | Hash function |
| BTreeMap lookup | O(log n) | O(log n) | O(log n) | Ord trait |

## Rules of Thumb

1. **Drop constants**: O(2n) = O(n). O(n/2) = O(n).
2. **Drop lower-order terms**: O(n² + n) = O(n²). The n² dominates.
3. **Nested loops multiply**: a loop inside a loop over the same data is O(n²).
4. **Sequential steps add**: O(n) + O(m) = O(n + m). If n and m are the same, O(n).
5. **Divide and conquer = log**: halving the problem each step gives you log n.
6. **O(1) is not always fast**: an O(1) operation with a constant factor of 10,000 is slower than O(n) for small n.
7. **Cache matters**: O(n) array iteration beats O(n) linked list iteration by 10-100x due to CPU cache.
8. **Amortized is not worst case**: Vec push is O(1) amortized but O(n) on resize. For real-time systems, this matters.

---

Next: [Lesson 01: Arrays and Memory Layout](./01-arrays-memory.md)
