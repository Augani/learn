# Lesson 23: Segment Trees and Fenwick Trees

> **Analogy**: Imagine a spreadsheet full of numbers where people
> keep asking for subtotals: sum rows 5 through 20, then update
> row 11, then sum rows 8 through 15, then update row 3, then sum
> rows 1 through 1000. If you recompute every subtotal from
> scratch each time, you waste huge amounts of repeated work. A
> segment tree and a Fenwick tree are two different ways of
> storing precomputed partial sums so that both queries and
> updates stay fast.

---

## Why This Matters

Range-query problems show up everywhere:

- sum of values in an interval
- minimum or maximum on a range
- frequency counts over a range
- dynamic scoreboards and time-series data

The naive approach is obvious:

- for query `[l, r]`, loop from `l` to `r`

That costs O(n) in the worst case per query.

If updates also happen between queries, plain prefix sums stop
being enough, because one changed value invalidates many cached
totals.

This lesson covers two important solutions:

- **Segment trees**: flexible, powerful, support many range
  operations and lazy propagation
- **Fenwick trees**: elegant and lighter-weight, great for prefix
  sums and point updates

By the end, you will understand:

- why range-query data structures exist
- how segment trees store interval summaries
- how point updates and range queries become O(log n)
- how lazy propagation handles deferred range updates
- how Fenwick trees use binary index structure to store prefix info

---

## The Problem With Recomputing Every Time

Suppose you have:

```
  nums = [2, 1, 5, 3, 4, 7, 6, 8]
```

Query 1:

```
  sum(2, 5) = 5 + 3 + 4 + 7 = 19
```

Query 2:

```
  update index 3 from 3 to 10
```

Query 3:

```
  sum(2, 5) = 5 + 10 + 4 + 7 = 26
```

If every sum query scans the whole interval, then many repeated
queries become expensive.

```
  NAIVE COST

  q range queries on n elements
  -> O(qn) in the worst case
```

The key idea is familiar by now: store intermediate structure so
that each query does not start from zero.

---

## Segment Trees — A Tree of Intervals

A segment tree is a binary tree where each node stores summary
information for an interval.

For range sums, each node stores the sum of its interval.

### Example Array

```
  nums = [2, 1, 5, 3, 4, 7, 6, 8]
  index   0  1  2  3  4  5  6  7
```

### Segment Tree for Sums

```
                         [0..7] sum=36
                        /              \
               [0..3] sum=11         [4..7] sum=25
               /          \          /           \
        [0..1] 3       [2..3] 8   [4..5] 11   [6..7] 14
         /    \         /    \      /    \      /    \
      [0]2   [1]1    [2]5  [3]3  [4]4  [5]7  [6]6  [7]8
```

Each node summarizes a contiguous interval. Leaves are individual
array values.

---

## Range Query in a Segment Tree

Suppose we want:

```
  sum(2, 6)
```

We do not blindly visit every leaf. We use interval overlap.

### Three overlap cases

For a node interval `[L, R]` and a query interval `[l, r]`:

1. **No overlap**: ignore this node
2. **Full overlap**: use this node's stored summary directly
3. **Partial overlap**: recurse to children

### Query Trace

```
  Query: sum(2, 6)

  Root [0..7]: partial overlap -> go both sides

  Left child [0..3]: partial overlap
    [0..1]: no overlap -> contribute 0
    [2..3]: full overlap -> contribute 8

  Right child [4..7]: partial overlap
    [4..5]: full overlap -> contribute 11
    [6..7]: partial overlap
      [6]: full overlap -> contribute 6
      [7]: no overlap -> contribute 0

  Total = 8 + 11 + 6 = 25
```

Only O(log n) relevant branches are explored for balanced trees.

---

## Point Update in a Segment Tree

Suppose index 3 changes from 3 to 10.

We update:

1. the leaf for index 3
2. every ancestor interval that contains index 3

### Update Trace

```
  Update nums[3] = 10

  Leaf [3]: 3 -> 10

  Recompute parent [2..3]: 5 + 10 = 15
  Recompute parent [0..3]: 3 + 15 = 18
  Recompute root   [0..7]: 18 + 25 = 43
```

Only one root-to-leaf path changes, so point update is O(log n).

---

## Lazy Propagation — Range Updates Without Touching Everything

What if we want:

```
  add 5 to every value in range [2, 6]
```

Doing that leaf by leaf costs O(n). Lazy propagation avoids that.

### Core idea

If a node interval is fully covered by the update range, we:

- update the node summary immediately
- store a lazy tag saying: "my children still need this update later"

We defer the detailed child updates until they are actually needed.

### Example

```
  Add 5 to range [0..3]

  Node [0..3] is fully covered.
  Instead of descending to all four leaves:

  - increase sum at node [0..3]
  - record lazy += 5 on that node

  Children are not updated immediately.
```

Later, if a query or deeper update touches those children, the
lazy value gets pushed downward.

This is one of the classic advanced tree techniques: postpone work
until you are forced to do it.

---

## Fenwick Trees — Binary Indexed Trees

Fenwick trees solve a narrower problem very elegantly:

- prefix sums
- point updates

They are less general than segment trees, but simpler and often
lighter in practice.

### Core idea

Each index stores the sum of a certain trailing range whose size
is determined by the least significant set bit of the index.

Fenwick trees are usually shown with 1-based indexing.

### Example Index Coverage

```
  Index in binary      Lowbit      Covers range size

  1  = 0001           1           1 element
  2  = 0010           2           2 elements
  3  = 0011           1           1 element
  4  = 0100           4           4 elements
  5  = 0101           1           1 element
  6  = 0110           2           2 elements
  7  = 0111           1           1 element
  8  = 1000           8           8 elements
```

### Fenwick Structure Example

```
  fenwick[1] stores sum of [1..1]
  fenwick[2] stores sum of [1..2]
  fenwick[3] stores sum of [3..3]
  fenwick[4] stores sum of [1..4]
  fenwick[5] stores sum of [5..5]
  fenwick[6] stores sum of [5..6]
  fenwick[7] stores sum of [7..7]
  fenwick[8] stores sum of [1..8]
```

This strange layout is what makes prefix-sum updates and queries
efficient using bit tricks.

---

## Fenwick Prefix Query

To compute prefix sum up to index `i`, keep jumping backward by
subtracting the lowbit.

### Example: prefix sum up to 13

```
  13 = 1101

  Use fenwick[13]
  Move to 13 - lowbit(13) = 13 - 1 = 12

  Use fenwick[12]
  Move to 12 - lowbit(12) = 12 - 4 = 8

  Use fenwick[8]
  Move to 8 - lowbit(8) = 8 - 8 = 0

  Stop
```

So a prefix query aggregates only O(log n) buckets.

## Fenwick Point Update

If index `i` increases by `delta`, we update every Fenwick bucket
that covers `i`.

### Example: update index 5

```
  Start at 5
  Add delta to fenwick[5]
  Move to 5 + lowbit(5) = 6

  Add delta to fenwick[6]
  Move to 6 + lowbit(6) = 8

  Add delta to fenwick[8]
  Move to 8 + lowbit(8) = 16

  Continue while within bounds
```

Again the path length is O(log n).

---

## Segment Tree vs Fenwick Tree

```
  SEGMENT TREE
  - supports many associative range operations
  - can do min, max, sum, gcd, etc.
  - handles lazy propagation for range updates
  - more flexible, more code, more memory

  FENWICK TREE
  - excellent for prefix sums and related operations
  - simpler and smaller
  - typically used for point updates + prefix/range sums
  - less general than segment trees
```

If you only need prefix sums and point updates, Fenwick is often
the simpler tool. If you need richer interval behavior, segment
trees are the workhorse.

---

## Technical Deep-Dive: Implementations

### Python

```python
class SegmentTree:
    def __init__(self, nums: list[int]):
        self.n = len(nums)
        self.tree = [0] * (4 * self.n)
        if self.n > 0:
            self._build(nums, 1, 0, self.n - 1)

    def _build(self, nums: list[int], node: int, left: int, right: int) -> None:
        if left == right:
            self.tree[node] = nums[left]
            return
        mid = (left + right) // 2
        self._build(nums, 2 * node, left, mid)
        self._build(nums, 2 * node + 1, mid + 1, right)
        self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1]

    def query(self, ql: int, qr: int, node: int = 1, left: int = 0, right: int | None = None) -> int:
        if self.n == 0:
            return 0
        if right is None:
            right = self.n - 1
        if qr < left or right < ql:
            return 0
        if ql <= left and right <= qr:
            return self.tree[node]
        mid = (left + right) // 2
        return self.query(ql, qr, 2 * node, left, mid) + self.query(ql, qr, 2 * node + 1, mid + 1, right)

    def update(self, index: int, value: int, node: int = 1, left: int = 0, right: int | None = None) -> None:
        if self.n == 0:
            return
        if right is None:
            right = self.n - 1
        if left == right:
            self.tree[node] = value
            return
        mid = (left + right) // 2
        if index <= mid:
            self.update(index, value, 2 * node, left, mid)
        else:
            self.update(index, value, 2 * node + 1, mid + 1, right)
        self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1]


class FenwickTree:
    def __init__(self, size: int):
        self.tree = [0] * (size + 1)

    def update(self, index: int, delta: int) -> None:
        while index < len(self.tree):
            self.tree[index] += delta
            index += index & -index

    def query(self, index: int) -> int:
        result = 0
        while index > 0:
            result += self.tree[index]
            index -= index & -index
        return result

    def range_sum(self, left: int, right: int) -> int:
        return self.query(right) - self.query(left - 1)
```

### TypeScript

```typescript
class SegmentTree {
  private readonly n: number;
  private readonly tree: number[];

  constructor(nums: number[]) {
    this.n = nums.length;
    this.tree = new Array(Math.max(1, 4 * this.n)).fill(0);
    if (this.n > 0) {
      this.build(nums, 1, 0, this.n - 1);
    }
  }

  private build(nums: number[], node: number, left: number, right: number): void {
    if (left === right) {
      this.tree[node] = nums[left];
      return;
    }
    const mid = Math.floor((left + right) / 2);
    this.build(nums, 2 * node, left, mid);
    this.build(nums, 2 * node + 1, mid + 1, right);
    this.tree[node] = this.tree[2 * node] + this.tree[2 * node + 1];
  }

  query(queryLeft: number, queryRight: number, node = 1, left = 0, right = this.n - 1): number {
    if (this.n === 0 || queryRight < left || right < queryLeft) {
      return 0;
    }
    if (queryLeft <= left && right <= queryRight) {
      return this.tree[node];
    }
    const mid = Math.floor((left + right) / 2);
    return this.query(queryLeft, queryRight, 2 * node, left, mid)
      + this.query(queryLeft, queryRight, 2 * node + 1, mid + 1, right);
  }

  update(index: number, value: number, node = 1, left = 0, right = this.n - 1): void {
    if (this.n === 0) {
      return;
    }
    if (left === right) {
      this.tree[node] = value;
      return;
    }
    const mid = Math.floor((left + right) / 2);
    if (index <= mid) {
      this.update(index, value, 2 * node, left, mid);
    } else {
      this.update(index, value, 2 * node + 1, mid + 1, right);
    }
    this.tree[node] = this.tree[2 * node] + this.tree[2 * node + 1];
  }
}

class FenwickTree {
  private readonly tree: number[];

  constructor(size: number) {
    this.tree = new Array(size + 1).fill(0);
  }

  update(index: number, delta: number): void {
    while (index < this.tree.length) {
      this.tree[index] += delta;
      index += index & -index;
    }
  }

  query(index: number): number {
    let result = 0;
    while (index > 0) {
      result += this.tree[index];
      index -= index & -index;
    }
    return result;
  }

  rangeSum(left: number, right: number): number {
    return this.query(right) - this.query(left - 1);
  }
}
```

### Rust

```rust
struct SegmentTree {
    n: usize,
    tree: Vec<i64>,
}

impl SegmentTree {
    fn new(nums: &[i64]) -> Self {
        let n = nums.len();
        let mut segment_tree = Self {
            n,
            tree: vec![0; usize::max(1, 4 * n)],
        };
        if n > 0 {
            segment_tree.build(nums, 1, 0, n - 1);
        }
        segment_tree
    }

    fn build(&mut self, nums: &[i64], node: usize, left: usize, right: usize) {
        if left == right {
            self.tree[node] = nums[left];
            return;
        }
        let mid = (left + right) / 2;
        self.build(nums, 2 * node, left, mid);
        self.build(nums, 2 * node + 1, mid + 1, right);
        self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1];
    }

    fn query(&self, query_left: usize, query_right: usize, node: usize, left: usize, right: usize) -> i64 {
        if self.n == 0 || query_right < left || right < query_left {
            return 0;
        }
        if query_left <= left && right <= query_right {
            return self.tree[node];
        }
        let mid = (left + right) / 2;
        self.query(query_left, query_right, 2 * node, left, mid)
            + self.query(query_left, query_right, 2 * node + 1, mid + 1, right)
    }

    fn update(&mut self, index: usize, value: i64, node: usize, left: usize, right: usize) {
        if left == right {
            self.tree[node] = value;
            return;
        }
        let mid = (left + right) / 2;
        if index <= mid {
            self.update(index, value, 2 * node, left, mid);
        } else {
            self.update(index, value, 2 * node + 1, mid + 1, right);
        }
        self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1];
    }
}

struct FenwickTree {
    tree: Vec<i64>,
}

impl FenwickTree {
    fn new(size: usize) -> Self {
        Self { tree: vec![0; size + 1] }
    }

    fn update(&mut self, mut index: usize, delta: i64) {
        while index < self.tree.len() {
            self.tree[index] += delta;
            index += index & (!index + 1);
        }
    }

    fn query(&self, mut index: usize) -> i64 {
        let mut result = 0;
        while index > 0 {
            result += self.tree[index];
            index -= index & (!index + 1);
        }
        result
    }

    fn range_sum(&self, left: usize, right: usize) -> i64 {
        self.query(right) - self.query(left.saturating_sub(1))
    }
}
```

---

## What If We Just Recomputed the Sum Every Time?

That is the obvious baseline.

For one query, it is fine.

But if you have many interleaved updates and queries, it becomes
too expensive.

```
  Recompute each query from scratch:
  range sum -> O(n)
  repeated q times -> O(qn)

  Segment tree / Fenwick tree:
  each query -> O(log n)
  each point update -> O(log n)
```

The whole lesson is really about this principle:

> store partial structure so repeated range work becomes cheap

---

## Exercises

1. Draw the segment tree for `[1, 3, 5, 7]` with sums stored at
   each interval node.
2. Trace a segment-tree query for sum on range `[1, 3]`.
3. Trace a point update changing index `2` from `5` to `10`.
4. Explain why lazy propagation is useful for range updates.
5. For a Fenwick tree, list the buckets updated when index `6`
   changes.
6. Compare when you would choose a Fenwick tree instead of a full
   segment tree.

---

## Key Takeaways

- Segment trees store summaries for intervals, not single values
  only.
- Range queries and point updates both become O(log n).
- Lazy propagation defers child updates until necessary.
- Fenwick trees are a compact, elegant solution for prefix sums
  and point updates.
- These structures exist because repeated range queries waste too
  much work if done from scratch.

The next lesson applies the tree concepts in interview-style
practice problems.

---

**Previous**: [Lesson 22 — Tries — Prefix Trees](./22-tries.md)
**Next**: [Lesson 24 — Practice Problems — Trees](./24-practice-trees.md)