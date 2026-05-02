# Lesson 14: Two Pointers and Sliding Window

> **Analogy**: Imagine you are hanging a picture frame on a
> wall. Sometimes you place one hand on each side of the frame
> and move both hands inward until it is centered. That is the
> **two pointers** pattern: two positions moving through data in
> a coordinated way. Other times you hold a rectangular paper
> frame up to the wall and slide it left or right until it shows
> exactly the section you want. That is the **sliding window**
> pattern: maintain a contiguous region, update it incrementally,
> and avoid recomputing everything from scratch.

---

## Why This Matters

This lesson is where brute force starts turning into algorithmic
thinking.

Many array and string problems tempt beginners into nested loops:

- Check every pair
- Check every subarray
- Check every substring

That often gives O(n²) or O(n³) time. But in many of those
problems, adjacent candidate ranges overlap heavily. If you just
computed something about the range `arr[i..j]`, then the next
range `arr[i..j+1]` or `arr[i+1..j]` differs by only one element.
Throwing away all previous work is wasteful.

Two pointers and sliding window solve that by reusing state.

- **Two pointers** helps when two positions move relative to each
  other in a predictable way.
- **Sliding window** helps when you care about a contiguous range
  and can update the answer as the range expands or shrinks.

These patterns appear constantly:

- Finding pairs in sorted arrays
- Removing duplicates in place
- Longest substring with a constraint
- Minimum-size subarray meeting a target
- Merging sorted sequences
- Detecting cycles with fast/slow pointers

By the end of this lesson, you will understand:

- The major two-pointer movement patterns
- The difference between fixed-size and variable-size windows
- Why overlapping work makes these patterns possible
- How to turn an O(n²) subarray scan into O(n)
- When these patterns do **not** apply

> **Connection to the previous lesson**:
> [Lesson 13: Searching Algorithms](./13-searching-algorithms.md)
> showed that exploiting structure turns linear work into
> logarithmic work. This lesson is the same mindset in a
> different form: instead of halving the search space, we avoid
> recomputing overlapping ranges.

---

## The Big Idea: Reuse Neighboring Work

Consider the brute-force problem:

> Find the maximum sum of any subarray of length 4.

The naive approach recomputes each window from scratch.

```
  Array: [2, 1, 5, 1, 3, 2]

  Windows of size 4:
  [2, 1, 5, 1] -> sum = 9
  [1, 5, 1, 3] -> sum = 10
  [5, 1, 3, 2] -> sum = 11

  Notice what changed:
  [2, 1, 5, 1]
      ↓ drop 2, add 3
  [1, 5, 1, 3]
      ↓ drop 1, add 2
  [5, 1, 3, 2]

  Most of the window stayed the same.
```

If you already know one window sum, the next window sum is:

$$
\text{next sum} = \text{current sum} - \text{outgoing element} + \text{incoming element}
$$

That turns O(k) work per window into O(1) work per shift.

This same reuse principle drives both sliding windows and many
two-pointer algorithms.

---

## Pattern 1: Opposite-End Two Pointers

This pattern places one pointer at the left end and one at the
right end. It is common when:

- The array is sorted
- You want a pair satisfying a condition
- Moving one side changes the condition monotonically

### Classic Example: Two Sum in a Sorted Array

Given a sorted array and a target, find two numbers that add to
the target.

```
  Array:   [1, 3, 4, 6, 8, 10, 13]
  Target:  14

  left=0 (1), right=6 (13)
  1 + 13 = 14 -> FOUND
```

That was lucky. Here is a more interesting trace.

```
  Array:   [1, 3, 4, 6, 8, 10, 13]
  Target:  17

  Step 1:
  left=0 -> 1
  right=6 -> 13
  sum = 14 < 17
  Too small, so move left rightward.

  [1, 3, 4, 6, 8, 10, 13]
   L                 R

  Step 2:
  left=1 -> 3
  right=6 -> 13
  sum = 16 < 17
  Still too small -> move left

  [1, 3, 4, 6, 8, 10, 13]
      L              R

  Step 3:
  left=2 -> 4
  right=6 -> 13
  sum = 17 -> FOUND ✓
```

### Why This Works

The sorted order gives a monotonic guarantee.

- If the sum is too small, moving `right` leftward would only
  make it even smaller, so that cannot help.
- If the sum is too large, moving `left` rightward would only
  make it even larger, so that cannot help.

That means each step safely eliminates possibilities.

### Complexity

- Time: O(n)
- Space: O(1)

Each pointer only moves inward, never backward.

---

## Pattern 2: Same-Direction Two Pointers

Sometimes both pointers move left to right, but at different
speeds or with different roles.

Common uses:

- Remove duplicates in-place
- Partition arrays
- Compress valid elements to the front

### Example: Remove Duplicates from a Sorted Array

Use:

- `read` pointer to scan every element
- `write` pointer to mark where the next distinct value should go

```
  Input: [1, 1, 2, 2, 2, 3, 4, 4]

  Start:
  write = 1
  read  = 1

  Index:  0  1  2  3  4  5  6  7
  Value: [1, 1, 2, 2, 2, 3, 4, 4]
           W  R

  read=1 -> arr[1] == arr[0], skip
  read=2 -> arr[2] != arr[1], write arr[1] = 2

  [1, 2, 2, 2, 2, 3, 4, 4]
              W  R

  read=5 -> value 3 differs, write arr[2] = 3
  [1, 2, 3, 2, 2, 3, 4, 4]

  read=6 -> value 4 differs, write arr[3] = 4
  [1, 2, 3, 4, 2, 3, 4, 4]

  First 4 elements now contain the deduplicated array:
  [1, 2, 3, 4]
```

The important idea is that the array serves as both input and
output. One pointer reads, the other compacts.

---

## Pattern 3: Fast and Slow Pointers

This is still a two-pointer technique, but usually on linked
lists or implicit sequences.

Common uses:

- Detect cycles
- Find the middle node
- Split a list in half

### Floyd's Cycle Detection

Move:

- `slow` by one step
- `fast` by two steps

If there is a cycle, they must eventually meet.

```
  LINKED LIST WITH CYCLE

  1 -> 2 -> 3 -> 4 -> 5
            ^         |
            |_________|

  slow moves: 1 step
  fast moves: 2 steps

  Round 1: slow=2, fast=3
  Round 2: slow=3, fast=5
  Round 3: slow=4, fast=4  -> meet! cycle exists ✓
```

The intuition: on a cycle, the fast pointer gains one step per
round relative to the slow pointer, so eventually the gap wraps
around to zero.

---

## Sliding Window: Fixed-Size Windows

A fixed-size sliding window is the easiest window pattern.
The window length never changes.

### Example: Maximum Sum Subarray of Size k

Brute force:

- For each start index, sum the next `k` elements
- Time: O(nk)

Sliding window:

- Compute the first window once
- Slide by removing one element and adding one element
- Time: O(n)

```
  FIXED WINDOW TRACE

  Array: [2, 1, 5, 1, 3, 2]
  k = 3

  Window 1: [2, 1, 5] -> sum = 8
            ^^^^^^^

  Slide right by 1:
  subtract outgoing 2, add incoming 1
  new sum = 8 - 2 + 1 = 7
  Window 2: [1, 5, 1] -> sum = 7
               ^^^^^^^

  Slide right by 1:
  subtract outgoing 1, add incoming 3
  new sum = 7 - 1 + 3 = 9
  Window 3: [5, 1, 3] -> sum = 9
                  ^^^^^^^

  Slide right by 1:
  subtract outgoing 5, add incoming 2
  new sum = 9 - 5 + 2 = 6
  Window 4: [1, 3, 2] -> sum = 6

  Maximum = 9 ✓
```

### Python

```python
def max_sum_subarray_k(nums: list[int], k: int) -> int:
    if k <= 0 or k > len(nums):
        raise ValueError("k must be between 1 and len(nums)")

    window_sum = sum(nums[:k])
    best = window_sum

    for right in range(k, len(nums)):
        window_sum += nums[right]
        window_sum -= nums[right - k]
        best = max(best, window_sum)

    return best
```

### TypeScript

```typescript
function maxSumSubarrayK(nums: number[], k: number): number {
  if (k <= 0 || k > nums.length) {
    throw new Error("k must be between 1 and nums.length");
  }

  let windowSum = 0;
  for (let index = 0; index < k; index += 1) {
    windowSum += nums[index];
  }

  let best = windowSum;

  for (let right = k; right < nums.length; right += 1) {
    windowSum += nums[right];
    windowSum -= nums[right - k];
    best = Math.max(best, windowSum);
  }

  return best;
}
```

### Rust

```rust
fn max_sum_subarray_k(nums: &[i32], k: usize) -> i32 {
    assert!(k > 0 && k <= nums.len());

    let mut window_sum: i32 = nums[..k].iter().sum();
    let mut best = window_sum;

    for right in k..nums.len() {
        window_sum += nums[right];
        window_sum -= nums[right - k];
        best = best.max(window_sum);
    }

    best
}
```

---

## Sliding Window: Variable-Size Windows

This is the more powerful pattern. The window expands and
shrinks based on a condition.

Typical structure:

1. Expand `right` to include new elements
2. While the window violates or satisfies some condition,
   move `left` to restore the desired state
3. Track the best answer during the process

### Brute-Force-to-Optimal Walkthrough: Minimum-Length Subarray With Sum at Least Target

> Given positive integers and a target, find the minimum length
> of a contiguous subarray whose sum is at least the target.

#### Brute force

Try every starting point and keep extending until the sum hits
the target.

- Outer loop over starts: O(n)
- Inner loop over ends: O(n)
- Total: O(n²)

#### Key observation

All numbers are positive. That matters enormously.

- Expanding the window always increases the sum
- Shrinking the window always decreases the sum

That monotonicity means that once the sum is large enough, you
can safely shrink from the left to see whether a shorter valid
window exists.

```
  VARIABLE WINDOW TRACE

  nums   = [2, 3, 1, 2, 4, 3]
  target = 7

  Start: left=0, sum=0

  right=0 -> add 2  -> sum=2
  window [2]

  right=1 -> add 3  -> sum=5
  window [2, 3]

  right=2 -> add 1  -> sum=6
  window [2, 3, 1]

  right=3 -> add 2  -> sum=8  (valid)
  window [2, 3, 1, 2], length=4
  best = 4

  Shrink from left:
  remove 2 -> sum=6, left=1
  window no longer valid

  right=4 -> add 4 -> sum=10  (valid)
  window [3, 1, 2, 4], length=4
  best = 4

  Shrink:
  remove 3 -> sum=7, left=2
  window [1, 2, 4], length=3
  best = 3

  Still valid, shrink again:
  remove 1 -> sum=6, left=3
  no longer valid

  right=5 -> add 3 -> sum=9  (valid)
  window [2, 4, 3], length=3
  best = 3

  Shrink:
  remove 2 -> sum=7, left=4
  window [4, 3], length=2
  best = 2

  Shrink:
  remove 4 -> sum=3, left=5
  invalid, stop shrinking

  Answer: 2 -> subarray [4, 3] ✓
```

### Why This Is O(n), Not O(n²)

At first glance there is a nested `while` inside a `for`, which
looks quadratic. But each element:

- enters the window once when `right` moves forward
- leaves the window once when `left` moves forward

So the total number of pointer moves is at most `2n`.

This is a classic amortized-style argument, linking back to
[Lesson 10: Amortized Analysis Deep Dive](./10-amortized-analysis-deep-dive.md).

### Python

```python
def min_subarray_len(target: int, nums: list[int]) -> int:
    left = 0
    window_sum = 0
    best = float("inf")

    for right, value in enumerate(nums):
        window_sum += value

        while window_sum >= target:
            best = min(best, right - left + 1)
            window_sum -= nums[left]
            left += 1

    return 0 if best == float("inf") else int(best)
```

### TypeScript

```typescript
function minSubarrayLen(target: number, nums: number[]): number {
  let left = 0;
  let windowSum = 0;
  let best = Number.POSITIVE_INFINITY;

  for (let right = 0; right < nums.length; right += 1) {
    windowSum += nums[right];

    while (windowSum >= target) {
      best = Math.min(best, right - left + 1);
      windowSum -= nums[left];
      left += 1;
    }
  }

  return Number.isFinite(best) ? best : 0;
}
```

### Rust

```rust
fn min_subarray_len(target: i32, nums: &[i32]) -> usize {
    let mut left = 0usize;
    let mut window_sum = 0i32;
    let mut best = usize::MAX;

    for right in 0..nums.len() {
        window_sum += nums[right];

        while window_sum >= target {
            best = best.min(right - left + 1);
            window_sum -= nums[left];
            left += 1;
        }
    }

    if best == usize::MAX { 0 } else { best }
}
```

---

## When Sliding Window Works

Sliding window is strongest when:

- You need a **contiguous** subarray or substring
- Neighboring windows overlap heavily
- You can update window state incrementally
- The validity condition changes monotonically as the window
  expands or shrinks

Examples:

- Maximum sum of size `k`
- Longest substring without repeating characters
- Minimum window satisfying a condition
- Number of subarrays meeting a bounded property

## When It Does Not Work Cleanly

If the condition is not monotonic, a simple sliding window may
fail.

Example: minimum subarray with sum at least target works nicely
for **positive numbers**, but not with arbitrary negatives.

Why? Because removing the leftmost element might *increase* or
*decrease* the sum unpredictably once negatives are involved.

```
  POSITIVE NUMBERS:
  remove from left -> sum always goes down

  WITH NEGATIVES:
  window sum = 5
  leftmost = -3
  remove it -> sum becomes 8

  The neat monotonic logic breaks.
```

That does not mean the problem is impossible. It means this
specific pattern is no longer the right hammer.

---

## What If We Just Checked Every Possible Subarray?

That is the natural first attempt.

```
  ALL SUBARRAYS OF [a, b, c, d]

  Start at 0: [a], [a,b], [a,b,c], [a,b,c,d]
  Start at 1: [b], [b,c], [b,c,d]
  Start at 2: [c], [c,d]
  Start at 3: [d]

  Total count = 4 + 3 + 2 + 1 = 10 = n(n+1)/2
```

In general, there are:

$$
\frac{n(n+1)}{2}
$$

subarrays. That is already O(n²) candidates before doing any
work inside them.

If you also recompute each subarray property from scratch, the
cost can rise to O(n³).

Sliding window avoids this by recognizing that adjacent windows
are not independent. They differ by only a small local change.

That is the whole game: use the overlap.

---

## Pattern Catalog Summary

```
  TWO-POINTER / WINDOW PATTERN CHEAT SHEET

  1. Opposite ends
     Use for: sorted pairs, palindrome checks
     Moves: left++, right-- depending on condition

  2. Same direction
     Use for: in-place compaction, deduplication, partitioning
     Moves: read scans all, write lags behind

  3. Fast / slow
     Use for: linked list cycles, middle node
     Moves: one pointer twice as fast

  4. Fixed window
     Use for: contiguous range of exact size k
     Moves: expand right, drop left automatically

  5. Variable window
     Use for: shortest/longest contiguous range satisfying rule
     Moves: expand right, shrink left while condition holds
```

---

## Exercises

1. In a sorted array, find whether there exists a pair whose
   difference is exactly `k`. Why does opposite-end pointer logic
   still work?
2. Modify the fixed-size window algorithm to compute the average
   of every subarray of size `k`.
3. Solve "longest substring without repeating characters" with a
   variable-size sliding window and a hash map.
4. Explain why fast/slow pointers can find the middle of a linked
   list in one pass.
5. Suppose the array can contain negative numbers. Why does the
   minimum-length-subarray-with-sum-at-least-target problem stop
   being a straightforward sliding-window problem?
6. For the array `[1, 2, 3, 4, 5]`, trace all windows of size 2
   and update the sum incrementally.

---

## Key Takeaways

- Two pointers and sliding window are about **reusing adjacent
  work**, not recomputing from scratch.
- Opposite-end pointers usually rely on sorted order and
  monotonic movement.
- Same-direction pointers are common for in-place array edits.
- Fast/slow pointers shine on linked lists and implicit cycles.
- Fixed-size windows are simple incremental updates.
- Variable-size windows depend on a condition that can be
  maintained while pointers move only forward.
- The reason these patterns are fast is subtle but simple:
  each pointer usually advances at most n times.

In the next lesson, we will apply the Phase 2 ideas to actual
interview-style problems and walk them from brute force to the
right pattern.

---

**Previous**: [Lesson 13 — Searching Algorithms](./13-searching-algorithms.md)
**Next**: [Lesson 15 — Practice Problems — Sorting and Searching](./15-practice-sorting-searching.md)