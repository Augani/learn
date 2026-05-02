# Lesson 37: Divide and Conquer

> **Analogy**: Imagine cleaning a huge messy room. Trying to organize it
> all at once is overwhelming. But if you split it into four zones,
> clean each zone separately, and then merge the results, the problem
> becomes manageable. Divide and conquer works the same way: break a big
> problem into smaller independent problems, solve them recursively, and
> combine the answers.

---

## Why This Matters

Divide and conquer is one of the central algorithm design paradigms.
It powers some of the most important algorithms in computer science:

- merge sort
- quicksort
- binary search
- Karatsuba multiplication
- closest pair of points

The paradigm is simple to state:

1. divide the problem into smaller subproblems
2. conquer the subproblems recursively
3. combine the subproblem answers

But the real skill is recognizing when the split is helpful, whether
the subproblems are independent, and whether the combine step is cheap
enough to justify the recursion.

---

## The Three-Step Template

```
  DIVIDE AND CONQUER

  original problem
         |
         v
   divide into smaller pieces
         |
         v
   solve each piece recursively
         |
         v
   combine partial answers
```

This sounds abstract, so the key is to look at concrete examples.

---

## Binary Search: The Simplest Divide and Conquer

Binary search is divide and conquer in its most minimal form.

- divide: pick the midpoint
- conquer: recurse into only one half
- combine: no real combine step, just return the recursive answer

#### Python

```python
def binary_search(values: list[int], target: int, left: int, right: int) -> int:
    if left > right:
        return -1

    middle = (left + right) // 2
    if values[middle] == target:
        return middle
    if target < values[middle]:
        return binary_search(values, target, left, middle - 1)
    return binary_search(values, target, middle + 1, right)
```

Recurrence:

$$
T(n) = T(n / 2) + O(1)
$$

So:

$$
T(n) = O(\log n)
$$

This is an example where dividing in half is powerful because only one
subproblem survives.

---

## Merge Sort: The Canonical Example

Merge sort shows the paradigm in full.

- divide: split the array into two halves
- conquer: sort each half recursively
- combine: merge the two sorted halves

### Step-by-step trace

```
  [7, 2, 5, 1, 9, 3, 8, 4]

  divide
  -> [7, 2, 5, 1]     [9, 3, 8, 4]

  divide again
  -> [7, 2] [5, 1]    [9, 3] [8, 4]

  divide again
  -> [7] [2] [5] [1] [9] [3] [8] [4]

  merge upward
  -> [2, 7] [1, 5] [3, 9] [4, 8]
  -> [1, 2, 5, 7] [3, 4, 8, 9]
  -> [1, 2, 3, 4, 5, 7, 8, 9]
```

#### Python

```python
def merge_sort(values: list[int]) -> list[int]:
    if len(values) <= 1:
        return values

    middle = len(values) // 2
    left = merge_sort(values[:middle])
    right = merge_sort(values[middle:])

    merged: list[int] = []
    left_index = 0
    right_index = 0

    while left_index < len(left) and right_index < len(right):
        if left[left_index] <= right[right_index]:
            merged.append(left[left_index])
            left_index += 1
        else:
            merged.append(right[right_index])
            right_index += 1

    merged.extend(left[left_index:])
    merged.extend(right[right_index:])
    return merged
```

Recurrence:

$$
T(n) = 2T(n / 2) + O(n)
$$

The recursion tree has $\log n$ levels, and each level costs $O(n)$.
Therefore:

$$
T(n) = O(n \log n)
$$

### Why dividing in half often leads to $O(n \log n)$

When you split a problem into two equal halves and each level of the
recursion tree does total linear work, you get:

- $\log n$ levels because the problem size keeps halving
- $O(n)$ work per level because the subproblem sizes add back up to $n$

Multiply them together and you get:

$$
O(n \log n)
$$

This is one of the most important recurring patterns in algorithms.

---

## Quicksort: Divide and Conquer With An Uneven Split Risk

Quicksort also follows divide and conquer:

- divide: partition around a pivot
- conquer: recursively sort left and right partitions
- combine: trivial, because partitioning already placed the pivot

#### TypeScript

```typescript
function quickSort(values: number[]): number[] {
  if (values.length <= 1) {
    return values;
  }

  const pivot = values[values.length - 1];
  const less: number[] = [];
  const greater: number[] = [];

  for (let index = 0; index < values.length - 1; index += 1) {
    if (values[index] <= pivot) {
      less.push(values[index]);
    } else {
      greater.push(values[index]);
    }
  }

  return [...quickSort(less), pivot, ...quickSort(greater)];
}
```

### Best and average intuition

If partitions are reasonably balanced, quicksort behaves like merge sort
in complexity:

$$
T(n) = 2T(n / 2) + O(n) = O(n \log n)
$$

### Worst case

If the pivot is always the smallest or largest element:

$$
T(n) = T(n - 1) + O(n)
$$

So the worst case becomes:

$$
O(n^2)
$$

This is a good warning that divide-and-conquer performance often depends
on the quality of the split.

---

## Karatsuba Multiplication

Grade-school multiplication of two $n$-digit numbers takes roughly
$O(n^2)$ work.

Karatsuba improves this by reducing the number of recursive
multiplications.

### Core idea

Split:

$$
x = a \cdot 10^m + b
$$

$$
y = c \cdot 10^m + d
$$

Naively, multiplying needs four subproducts:

- $ac$
- $ad$
- $bc$
- $bd$

Karatsuba observes that you can derive the middle terms using only
three recursive multiplications:

- $ac$
- $bd$
- $(a+b)(c+d)$

Then:

$$
ad + bc = (a+b)(c+d) - ac - bd
$$

Recurrence:

$$
T(n) = 3T(n / 2) + O(n)
$$

By the Master Theorem:

$$
T(n) = O(n^{\log_2 3}) \approx O(n^{1.585})
$$

That is a classic example of divide and conquer producing a non-obvious
speedup by changing the algebra.

---

## Closest Pair of Points

This is a more geometric divide-and-conquer example.

### Problem

Given points in the plane, find the pair with minimum Euclidean distance.

### Brute force

Check every pair:

$$
O(n^2)
$$

### Divide-and-conquer strategy

1. sort points by x-coordinate
2. split into left and right halves
3. recursively solve closest pair on each side
4. check whether the true closest pair crosses the dividing line

The nontrivial insight is that only a narrow vertical strip near the
middle needs to be checked, and only a constant number of neighbors per
point in that strip matter.

Recurrence:

$$
T(n) = 2T(n / 2) + O(n)
$$

So again:

$$
O(n \log n)
$$

This is important because it shows that divide and conquer is not only
for arrays. It also works when geometry gives a way to constrain the
combine step.

---

## What Makes Divide And Conquer Work?

The paradigm succeeds when:

- subproblems are meaningfully smaller
- recursive subproblems are mostly independent
- the combine step is cheaper than solving the full problem directly

It fails or becomes unattractive when:

- the split is too uneven too often
- the combine step is too expensive
- subproblems overlap heavily, which is usually a sign that dynamic
  programming may be more appropriate

---

## What If We Divided Into 3 Parts Instead Of 2?

The number of parts is not magical. What matters is the recurrence.

If you split into three equal parts and do linear combine work:

$$
T(n) = 3T(n / 3) + O(n)
$$

The recursion depth is still $O(\log n)$, and each level still costs
$O(n)$, so the result is still:

$$
O(n \log n)
$$

But if the split adds more subproblems without reducing combine cost or
leaf work meaningfully, you may gain nothing. The right question is not
"two or three parts?" It is "what recurrence does this design create?"

---

## Rust Example: Merge Sort

```rust
fn merge_sort(values: &[i32]) -> Vec<i32> {
    if values.len() <= 1 {
        return values.to_vec();
    }

    let middle = values.len() / 2;
    let left = merge_sort(&values[..middle]);
    let right = merge_sort(&values[middle..]);

    let mut merged = Vec::with_capacity(values.len());
    let mut left_index = 0usize;
    let mut right_index = 0usize;

    while left_index < left.len() && right_index < right.len() {
        if left[left_index] <= right[right_index] {
            merged.push(left[left_index]);
            left_index += 1;
        } else {
            merged.push(right[right_index]);
            right_index += 1;
        }
    }

    merged.extend_from_slice(&left[left_index..]);
    merged.extend_from_slice(&right[right_index..]);
    merged
}
```

---

## Exercises

1. Explain the difference between the divide step and the combine step.
2. Why does merge sort achieve $O(n \log n)$ even though it makes two
   recursive calls?
3. Why can quicksort degrade to $O(n^2)$?
4. What is the key insight behind Karatsuba's speedup?
5. Why is closest pair of points not obviously a divide-and-conquer
   problem until you study the strip argument?
6. Give an example where a divide-and-conquer design would create
   overlapping subproblems and suggest a better paradigm.

---

## Key Takeaways

- Divide and conquer means divide, solve recursively, and combine.
- Balanced splits plus linear work per level often produce $O(n \log n)$.
- The quality of the split can determine whether the algorithm is fast
  or disastrous.
- The paradigm applies beyond arrays, including arithmetic and geometry.
- The right way to reason about divide-and-conquer designs is through
  their recurrence relation.

The next lesson moves from recursive decomposition to memoized reuse:
dynamic programming fundamentals.

---

**Previous**: [Lesson 36 — Recursion and Recurrence Relations](./36-recursion-recurrences.md)
**Next**: [Lesson 38 — Dynamic Programming Fundamentals](./38-dp-fundamentals.md)