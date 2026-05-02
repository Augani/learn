# Lesson 15: Practice Problems — Sorting and Searching

> You now have the core tools of Phase 2: comparison sorts,
> non-comparison sorts, binary-search-style reasoning, and the
> two-pointers / sliding-window toolkit. This lesson is where
> those ideas stop being isolated topics and start becoming a
> problem-solving language. Each problem below asks a deeper
> question than "do you know the algorithm?" It asks whether you
> can recognize the structure of a problem, reject a slower first
> idea, and justify why the better approach works.

---

## How to Use This Lesson

Each problem includes:

- The pattern it tests
- Why the brute-force idea is tempting
- Hints that escalate from subtle to direct
- A walkthrough of the optimal approach
- Python, TypeScript, and Rust implementations

The lesson includes:

- 3 easy problems
- 3 medium problems
- 2 hard problems

---

## Easy Problems

---

### Problem 1: Merge Sorted Arrays

**Pattern:** Two pointers from the end, merge logic

**Problem statement:**
You are given two sorted arrays `nums1` and `nums2`, and enough
space at the end of `nums1` to hold all elements of `nums2`.
Merge them into `nums1` in sorted order.

```
  nums1 = [1, 2, 3, 0, 0, 0], m = 3
  nums2 = [2, 5, 6],           n = 3

  Result: [1, 2, 2, 3, 5, 6]
```

**Why the naive idea is tempting:**
Copy `nums2` into the empty space and sort everything. That
works, but costs O((m+n) log(m+n)).

**Key insight:**
Because both arrays are already sorted, the largest remaining
element must be at the end of one of them. Fill from the back.

```
  BACKWARD MERGE TRACE

  nums1: [1, 2, 3, 0, 0, 0]
                 ^
                 i = 2
  nums2: [2, 5, 6]
              ^
              j = 2
  write = 5

  Compare 3 and 6 -> place 6 at write=5
  [1, 2, 3, 0, 0, 6]

  Compare 3 and 5 -> place 5 at write=4
  [1, 2, 3, 0, 5, 6]

  Compare 3 and 2 -> place 3 at write=3
  [1, 2, 3, 3, 5, 6]

  Compare 2 and 2 -> place 2 at write=2
  [1, 2, 2, 3, 5, 6]

  nums2 still has 2? No. Done ✓
```

**Time:** O(m + n)
**Space:** O(1)

#### Python

```python
def merge(nums1: list[int], m: int, nums2: list[int], n: int) -> None:
    i = m - 1
    j = n - 1
    write = m + n - 1

    while j >= 0:
        if i >= 0 and nums1[i] > nums2[j]:
            nums1[write] = nums1[i]
            i -= 1
        else:
            nums1[write] = nums2[j]
            j -= 1
        write -= 1
```

#### TypeScript

```typescript
function merge(nums1: number[], m: number, nums2: number[], n: number): void {
  let i = m - 1;
  let j = n - 1;
  let write = m + n - 1;

  while (j >= 0) {
    if (i >= 0 && nums1[i] > nums2[j]) {
      nums1[write] = nums1[i];
      i -= 1;
    } else {
      nums1[write] = nums2[j];
      j -= 1;
    }
    write -= 1;
  }
}
```

#### Rust

```rust
fn merge(nums1: &mut [i32], m: usize, nums2: &[i32], n: usize) {
    let mut i = m;
    let mut j = n;
    let mut write = m + n;

    while j > 0 {
        write -= 1;
        if i > 0 && nums1[i - 1] > nums2[j - 1] {
            nums1[write] = nums1[i - 1];
            i -= 1;
        } else {
            nums1[write] = nums2[j - 1];
            j -= 1;
        }
    }
}
```

---

### Problem 2: First Bad Version

**Pattern:** Binary search on a monotonic predicate

**Problem statement:**
Versions `1..n` exist. Once a version is bad, every later version
is also bad. Find the first bad version using the fewest calls to
`isBadVersion(version)`.

```
  Versions: 1  2  3  4  5
           G  G  G  B  B

  Answer: 4
```

**Key observation:**
This is not just search for a value. It is search for the first
index where a predicate becomes true:

- `false false false true true true`

That monotonic boundary is exactly what binary search wants.

#### Python

```python
def first_bad_version(n: int, is_bad_version) -> int:
    left, right = 1, n

    while left < right:
        mid = left + (right - left) // 2
        if is_bad_version(mid):
            right = mid
        else:
            left = mid + 1

    return left
```

#### TypeScript

```typescript
function firstBadVersion(n: number, isBadVersion: (version: number) => boolean): number {
  let left = 1;
  let right = n;

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (isBadVersion(mid)) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }

  return left;
}
```

#### Rust

```rust
fn first_bad_version(n: i32, is_bad_version: impl Fn(i32) -> bool) -> i32 {
    let mut left = 1;
    let mut right = n;

    while left < right {
        let mid = left + (right - left) / 2;
        if is_bad_version(mid) {
            right = mid;
        } else {
            left = mid + 1;
        }
    }

    left
}
```

---

### Problem 3: Search Insert Position

**Pattern:** Lower bound binary search

**Problem statement:**
Given a sorted array of distinct integers and a target, return
the index if the target is found. If not, return the index where
it should be inserted to keep the array sorted.

```
  nums = [1, 3, 5, 6], target = 5 -> 2
  nums = [1, 3, 5, 6], target = 2 -> 1
  nums = [1, 3, 5, 6], target = 7 -> 4
```

This is lower bound: find the first index whose value is greater
than or equal to the target.

#### Python

```python
def search_insert(nums: list[int], target: int) -> int:
    left, right = 0, len(nums)

    while left < right:
        mid = left + (right - left) // 2
        if nums[mid] < target:
            left = mid + 1
        else:
            right = mid

    return left
```

#### TypeScript

```typescript
function searchInsert(nums: number[], target: number): number {
  let left = 0;
  let right = nums.length;

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}
```

#### Rust

```rust
fn search_insert(nums: &[i32], target: i32) -> usize {
    let mut left = 0usize;
    let mut right = nums.len();

    while left < right {
        let mid = left + (right - left) / 2;
        if nums[mid] < target {
            left = mid + 1;
        } else {
            right = mid;
        }
    }

    left
}
```

---

## Medium Problems

---

### Problem 4: Sort Colors

**Pattern:** Three-way partition, two pointers

**Problem statement:**
Given an array containing only `0`, `1`, and `2`, sort it in
place so that equal colors are adjacent in the order red, white,
blue.

```
  Input:  [2, 0, 2, 1, 1, 0]
  Output: [0, 0, 1, 1, 2, 2]
```

**Brute force:**
Count each color and rewrite the array. That is valid O(n), but
it relies on the very special value range.

**Pattern goal:**
Recognize the Dutch National Flag partition:

- `low` marks next position for `0`
- `mid` scans current element
- `high` marks next position for `2`

```
  DUTCH NATIONAL FLAG TRACE

  [2, 0, 2, 1, 1, 0]
   L  M              H

  arr[mid] = 2 -> swap with high
  [0, 0, 2, 1, 1, 2]
   L  M           H

  arr[mid] = 0 -> swap with low, move both
  [0, 0, 2, 1, 1, 2]
      L  M        H

  arr[mid] = 0 -> swap with low, move both
  [0, 0, 2, 1, 1, 2]
         L  M     H

  arr[mid] = 2 -> swap with high
  [0, 0, 1, 1, 2, 2]
         L  M  H

  arr[mid] = 1 -> just move mid
  arr[mid] = 1 -> just move mid
  Done ✓
```

#### Python

```python
def sort_colors(nums: list[int]) -> None:
    low = 0
    mid = 0
    high = len(nums) - 1

    while mid <= high:
        if nums[mid] == 0:
            nums[low], nums[mid] = nums[mid], nums[low]
            low += 1
            mid += 1
        elif nums[mid] == 1:
            mid += 1
        else:
            nums[mid], nums[high] = nums[high], nums[mid]
            high -= 1
```

#### TypeScript

```typescript
function sortColors(nums: number[]): void {
  let low = 0;
  let mid = 0;
  let high = nums.length - 1;

  while (mid <= high) {
    if (nums[mid] === 0) {
      [nums[low], nums[mid]] = [nums[mid], nums[low]];
      low += 1;
      mid += 1;
    } else if (nums[mid] === 1) {
      mid += 1;
    } else {
      [nums[mid], nums[high]] = [nums[high], nums[mid]];
      high -= 1;
    }
  }
}
```

#### Rust

```rust
fn sort_colors(nums: &mut [i32]) {
    let mut low = 0usize;
    let mut mid = 0usize;
    let mut high = nums.len();

    while mid < high {
        match nums[mid] {
            0 => {
                nums.swap(low, mid);
                low += 1;
                mid += 1;
            }
            1 => {
                mid += 1;
            }
            2 => {
                high -= 1;
                nums.swap(mid, high);
            }
            _ => panic!("unexpected value"),
        }
    }
}
```

---

### Problem 5: Find Peak Element

**Pattern:** Binary search on directional slope

**Problem statement:**
Given an array where adjacent elements are never equal, find any
peak element. A peak is an element greater than its neighbors.

```
  [1, 2, 3, 1] -> peak at index 2
  [1, 2, 1, 3, 5, 6, 4] -> peaks at 1 or 5
```

**Why this is not obvious:**
The array is not sorted. Yet binary search still works.

**Key insight:**
Compare `nums[mid]` with `nums[mid + 1]`.

- If `nums[mid] < nums[mid + 1]`, you are on an upward slope, so
  a peak must exist to the right.
- Otherwise, a peak must exist at `mid` or to the left.

You are not searching for a value. You are searching for a
guaranteed structural property.

#### Python

```python
def find_peak_element(nums: list[int]) -> int:
    left, right = 0, len(nums) - 1

    while left < right:
        mid = left + (right - left) // 2
        if nums[mid] < nums[mid + 1]:
            left = mid + 1
        else:
            right = mid

    return left
```

#### TypeScript

```typescript
function findPeakElement(nums: number[]): number {
  let left = 0;
  let right = nums.length - 1;

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (nums[mid] < nums[mid + 1]) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}
```

#### Rust

```rust
fn find_peak_element(nums: &[i32]) -> usize {
    let mut left = 0usize;
    let mut right = nums.len() - 1;

    while left < right {
        let mid = left + (right - left) / 2;
        if nums[mid] < nums[mid + 1] {
            left = mid + 1;
        } else {
            right = mid;
        }
    }

    left
}
```

---

### Problem 6: Minimum in Rotated Sorted Array

**Pattern:** Binary search on broken sorted order

**Problem statement:**
A sorted ascending array was rotated at some pivot. Find the
minimum element.

```
  [3, 4, 5, 1, 2] -> 1
  [4, 5, 6, 7, 0, 1, 2] -> 0
  [11, 13, 15, 17] -> 11
```

**Brute force:**
Scan everything. O(n).

**Optimal idea:**
At least one half remains sorted. Compare `nums[mid]` with
`nums[right]`:

- If `nums[mid] > nums[right]`, the minimum must be right of mid
- Otherwise, the minimum is at mid or left of it

#### Python

```python
def find_min(nums: list[int]) -> int:
    left, right = 0, len(nums) - 1

    while left < right:
        mid = left + (right - left) // 2
        if nums[mid] > nums[right]:
            left = mid + 1
        else:
            right = mid

    return nums[left]
```

#### TypeScript

```typescript
function findMin(nums: number[]): number {
  let left = 0;
  let right = nums.length - 1;

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (nums[mid] > nums[right]) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return nums[left];
}
```

#### Rust

```rust
fn find_min(nums: &[i32]) -> i32 {
    let mut left = 0usize;
    let mut right = nums.len() - 1;

    while left < right {
        let mid = left + (right - left) / 2;
        if nums[mid] > nums[right] {
            left = mid + 1;
        } else {
            right = mid;
        }
    }

    nums[left]
}
```

---

## Hard Problems

---

### Problem 7: Median of Two Sorted Arrays

**Pattern:** Binary search on a partition

**Why it is hard:**
The obvious approach is to merge both arrays, then take the
middle. That works in O(m + n), but the challenge demands
O(log(min(m, n))).

This is the kind of problem where the correct solution feels
impossible until you reframe it.

### Reframe the Problem

Instead of asking:

> "What is the median value?"

ask:

> "Can I partition the two arrays so that the left half contains
> exactly half the elements, and every left-side element is less
> than or equal to every right-side element?"

If yes, the median follows immediately.

```
  A = [1, 3, 8]
  B = [7, 9, 10, 11]

  Valid partition:

  A left  | A right     -> [1, 3] | [8]
  B left  | B right     -> [7]    | [9, 10, 11]

  Combined left  = [1, 3, 7]
  Combined right = [8, 9, 10, 11]

  max(left) = 7
  min(right)= 8
  Left side has half the elements.
  Therefore median = 7 for odd total length? Not here.
  Total length = 7, so median = max(left) = 7 ✓
```

### Key insight hints

1. Binary search the smaller array.
2. Choose a partition `i` in array A.
3. That forces partition `j` in array B so the left half has the
   correct number of elements.
4. Check whether the partition is valid using the boundary
   elements around `i` and `j`.

#### Python

```python
def find_median_sorted_arrays(nums1: list[int], nums2: list[int]) -> float:
    if len(nums1) > len(nums2):
        nums1, nums2 = nums2, nums1

    x, y = len(nums1), len(nums2)
    left, right = 0, x

    while left <= right:
        partition_x = left + (right - left) // 2
        partition_y = (x + y + 1) // 2 - partition_x

        max_left_x = float("-inf") if partition_x == 0 else nums1[partition_x - 1]
        min_right_x = float("inf") if partition_x == x else nums1[partition_x]
        max_left_y = float("-inf") if partition_y == 0 else nums2[partition_y - 1]
        min_right_y = float("inf") if partition_y == y else nums2[partition_y]

        if max_left_x <= min_right_y and max_left_y <= min_right_x:
            if (x + y) % 2 == 0:
                return (max(max_left_x, max_left_y) + min(min_right_x, min_right_y)) / 2
            return float(max(max_left_x, max_left_y))
        if max_left_x > min_right_y:
            right = partition_x - 1
        else:
            left = partition_x + 1

    raise ValueError("input arrays must be sorted")
```

#### TypeScript

```typescript
function findMedianSortedArrays(nums1: number[], nums2: number[]): number {
  if (nums1.length > nums2.length) {
    return findMedianSortedArrays(nums2, nums1);
  }

  const x = nums1.length;
  const y = nums2.length;
  let left = 0;
  let right = x;

  while (left <= right) {
    const partitionX = left + Math.floor((right - left) / 2);
    const partitionY = Math.floor((x + y + 1) / 2) - partitionX;

    const maxLeftX = partitionX === 0 ? Number.NEGATIVE_INFINITY : nums1[partitionX - 1];
    const minRightX = partitionX === x ? Number.POSITIVE_INFINITY : nums1[partitionX];
    const maxLeftY = partitionY === 0 ? Number.NEGATIVE_INFINITY : nums2[partitionY - 1];
    const minRightY = partitionY === y ? Number.POSITIVE_INFINITY : nums2[partitionY];

    if (maxLeftX <= minRightY && maxLeftY <= minRightX) {
      if ((x + y) % 2 === 0) {
        return (Math.max(maxLeftX, maxLeftY) + Math.min(minRightX, minRightY)) / 2;
      }
      return Math.max(maxLeftX, maxLeftY);
    }

    if (maxLeftX > minRightY) {
      right = partitionX - 1;
    } else {
      left = partitionX + 1;
    }
  }

  throw new Error("input arrays must be sorted");
}
```

#### Rust

```rust
fn find_median_sorted_arrays(nums1: &[i32], nums2: &[i32]) -> f64 {
    if nums1.len() > nums2.len() {
        return find_median_sorted_arrays(nums2, nums1);
    }

    let x = nums1.len();
    let y = nums2.len();
    let mut left = 0usize;
    let mut right = x;

    while left <= right {
        let partition_x = left + (right - left) / 2;
        let partition_y = (x + y + 1) / 2 - partition_x;

        let max_left_x = if partition_x == 0 { i32::MIN } else { nums1[partition_x - 1] };
        let min_right_x = if partition_x == x { i32::MAX } else { nums1[partition_x] };
        let max_left_y = if partition_y == 0 { i32::MIN } else { nums2[partition_y - 1] };
        let min_right_y = if partition_y == y { i32::MAX } else { nums2[partition_y] };

        if max_left_x <= min_right_y && max_left_y <= min_right_x {
            if (x + y) % 2 == 0 {
                return (i32::max(max_left_x, max_left_y) as f64
                    + i32::min(min_right_x, min_right_y) as f64)
                    / 2.0;
            }
            return i32::max(max_left_x, max_left_y) as f64;
        }

        if max_left_x > min_right_y {
            if partition_x == 0 {
                break;
            }
            right = partition_x - 1;
        } else {
            left = partition_x + 1;
        }
    }

    panic!("input arrays must be sorted");
}
```

---

### Problem 8: Count of Smaller Numbers After Self

**Pattern:** Modified merge sort, order statistics during merge

**Why it is hard:**
The brute-force solution is easy:

- For each index `i`, scan every later element `j > i`
- Count how many are smaller
- O(n²)

The hard part is realizing this is secretly a sorting problem.

### Core insight

During merge sort, when an element from the right half moves
ahead of an element from the left half, that right-half element
is smaller and originally appeared later. That is exactly the
kind of inversion-style information we need.

```
  Example: [5, 2, 6, 1]

  For 5 -> smaller after it: 2, 1  -> count 2
  For 2 -> smaller after it: 1     -> count 1
  For 6 -> smaller after it: 1     -> count 1
  For 1 -> none                    -> count 0

  Answer: [2, 1, 1, 0]
```

### Common mistake

People often reach for a binary search tree or heap first. Those
can work, but the merge-sort counting method gives clean
O(n log n) time and is easier to reason about once you see it.

#### Python

```python
def count_smaller(nums: list[int]) -> list[int]:
    counts = [0] * len(nums)
    indexed = list(enumerate(nums))

    def sort(items: list[tuple[int, int]]) -> list[tuple[int, int]]:
        if len(items) <= 1:
            return items

        mid = len(items) // 2
        left = sort(items[:mid])
        right = sort(items[mid:])

        merged: list[tuple[int, int]] = []
        i = 0
        j = 0
        right_taken = 0

        while i < len(left) and j < len(right):
            if left[i][1] <= right[j][1]:
                counts[left[i][0]] += right_taken
                merged.append(left[i])
                i += 1
            else:
                merged.append(right[j])
                right_taken += 1
                j += 1

        while i < len(left):
            counts[left[i][0]] += right_taken
            merged.append(left[i])
            i += 1

        while j < len(right):
            merged.append(right[j])
            j += 1

        return merged

    sort(indexed)
    return counts
```

#### TypeScript

```typescript
function countSmaller(nums: number[]): number[] {
  const counts = new Array<number>(nums.length).fill(0);
  const indexed: Array<[number, number]> = nums.map((value, index) => [index, value]);

  function sort(items: Array<[number, number]>): Array<[number, number]> {
    if (items.length <= 1) {
      return items;
    }

    const mid = Math.floor(items.length / 2);
    const left = sort(items.slice(0, mid));
    const right = sort(items.slice(mid));
    const merged: Array<[number, number]> = [];
    let i = 0;
    let j = 0;
    let rightTaken = 0;

    while (i < left.length && j < right.length) {
      if (left[i][1] <= right[j][1]) {
        counts[left[i][0]] += rightTaken;
        merged.push(left[i]);
        i += 1;
      } else {
        merged.push(right[j]);
        rightTaken += 1;
        j += 1;
      }
    }

    while (i < left.length) {
      counts[left[i][0]] += rightTaken;
      merged.push(left[i]);
      i += 1;
    }

    while (j < right.length) {
      merged.push(right[j]);
      j += 1;
    }

    return merged;
  }

  sort(indexed);
  return counts;
}
```

#### Rust

```rust
fn count_smaller(nums: &[i32]) -> Vec<i32> {
    let mut counts = vec![0i32; nums.len()];
    let indexed: Vec<(usize, i32)> = nums.iter().copied().enumerate().collect();

    fn sort(items: Vec<(usize, i32)>, counts: &mut [i32]) -> Vec<(usize, i32)> {
        if items.len() <= 1 {
            return items;
        }

        let mid = items.len() / 2;
        let left = sort(items[..mid].to_vec(), counts);
        let right = sort(items[mid..].to_vec(), counts);

        let mut merged = Vec::with_capacity(left.len() + right.len());
        let mut i = 0usize;
        let mut j = 0usize;
        let mut right_taken = 0i32;

        while i < left.len() && j < right.len() {
            if left[i].1 <= right[j].1 {
                counts[left[i].0] += right_taken;
                merged.push(left[i]);
                i += 1;
            } else {
                merged.push(right[j]);
                right_taken += 1;
                j += 1;
            }
        }

        while i < left.len() {
            counts[left[i].0] += right_taken;
            merged.push(left[i]);
            i += 1;
        }

        while j < right.len() {
            merged.push(right[j]);
            j += 1;
        }

        merged
    }

    let _ = sort(indexed, &mut counts);
    counts
}
```

---

## What These Problems Were Really Testing

```
  PROBLEM -> UNDERLYING IDEA

  Merge sorted arrays            -> Two pointers with sorted data
  First bad version             -> Binary search on a boundary
  Search insert position        -> Lower bound / insertion point
  Sort colors                   -> In-place partitioning
  Find peak element             -> Binary search on structure
  Minimum in rotated array      -> Binary search on broken order
  Median of two sorted arrays   -> Binary search on a partition
  Count smaller after self      -> Sorting reveals order info
```

The deeper lesson is that "sorting and searching" is broader than:

- call `sort()`
- call binary search

It includes recognizing when sortedness, partitioning, or merge
logic reveals hidden structure in a problem.

---

## Exercises

1. Modify `search insert position` to return the rightmost valid
   insertion index instead of the leftmost one.
2. Solve `two sum` on a sorted array using opposite-end pointers,
   then compare it against the hash-map version from Phase 1.
3. For `find peak element`, explain why there must be at least one
   peak in every finite array with unequal neighbors.
4. Implement `minimum in rotated sorted array` when duplicates are
   allowed. What changes in the worst case?
5. Re-derive the `median of two sorted arrays` partition condition
   from scratch without looking at the code.
6. For `count smaller numbers after self`, trace the merge steps on
   `[3, 1, 2]` and record when each count increases.

In the next lesson, we leave interview toy versions and look at
how real language runtimes and production systems actually sort.

---

**Previous**: [Lesson 14 — Two Pointers and Sliding Window](./14-two-pointers-sliding-window.md)
**Next**: [Lesson 16 — Sorting in Practice — Hybrid Algorithms and Real-World Considerations](./16-sorting-in-practice.md)