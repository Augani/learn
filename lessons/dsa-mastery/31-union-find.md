# Lesson 31: Union-Find (Disjoint Set Union)

> **Analogy**: Imagine students gradually forming friend groups. At any
> point, you want to know whether two students belong to the same group,
> and you want to merge groups quickly when a new friendship links them.
> Union-find is the data structure for that problem.

---

## Why This Matters

Union-find (also called Disjoint Set Union, or DSU) solves dynamic
connectivity problems where sets merge over time and you need to query
whether two elements belong to the same set.

It is a core tool for:

- **Kruskal's MST**: checking whether adding an edge would create a
  cycle by testing if its endpoints are already connected
- **Connected component tracking**: as edges are added to a graph,
  union-find maintains which vertices are reachable from which
- **Cycle detection in undirected graphs**: if `find(u) == find(v)`
  before adding edge `(u, v)`, the edge would close a cycle
- **Grouping and clustering problems**: merging similar items into
  equivalence classes, such as in image segmentation or percolation
  theory
- **Offline queries**: answering connectivity questions as a graph is
  built incrementally
- **Grid connectivity problems**: determining if two cells in a grid
  belong to the same connected region as walls are removed

Its power comes from two independent optimizations:

- **Path compression**: flattens the tree during find operations
- **Union by rank (or size)**: keeps trees shallow by attaching smaller
  trees under larger ones

Together they make operations effectively constant for any realistic
workload. The amortized time per operation is the inverse Ackermann
function, which is below 5 for all practical input sizes.

---

## The Basic Structure

Each set has a representative root.

Each element points to a parent, and roots point to themselves.

```
  Initial:
  0   1   2   3   4

  parent = [0, 1, 2, 3, 4]

  After union(0, 1), union(1, 2):

      0
     / \
    1   2

  parent = [0, 0, 0, 3, 4]
```

Operations:

- `find(x)`: return the representative (root) of the set containing `x`
- `union(a, b)`: merge the two sets if they are different

Think of `find` as "who is the leader of your group?" and `union` as
"these two groups just became friends — pick one leader."

---

## The Friend Groups Analogy — Deeper

Imagine a university orientation with 1000 students. Initially everyone
is alone. As students meet and become friends, groups merge.

```
  INITIAL STATE:
  Each student is their own group leader:
  [0] [1] [2] [3] ... [999]

  Alice(5) meets Bob(7):
    union(5, 7) -> one group, leader is 5
    [5] <- [7]   (7 now points to 5)

  Bob(7) meets Charlie(9):
    union(7, 9) -> same group as 5
    find(7) = 5, so Charlie joins Alice's group
    [5] <- [7] <- [9]   (naive, before path compression)
```

Without optimizations, chains get long:

```
  Long chain after naive unions:
  0 <- 1 <- 2 <- 3 <- 4 <- 5

  find(5) must walk through 5 parent pointers.
  find(5) again must do the same work.
```

This is why the two optimizations matter so much — they keep the
leader chains short and remember what they have already learned.

---

## Naive Union-Find

Without optimizations, trees can become tall. If you always attach the
new root under the existing root without considering tree depth, a
sequence of unions can create a degenerate chain:

```
  After naive unions: union(0,1), union(1,2), union(2,3), union(3,4), union(4,5)

  0 <- 1 <- 2 <- 3 <- 4 <- 5

  find(5) takes O(n) — walking through every parent.
  find(4) takes O(n-1).

  This is as slow as a linked list. The whole point of union-find is
  near-constant time, so naive union order defeats the purpose.
```

Two optimizations fix this: union by rank keeps trees shallow, and
path compression flattens them aggressively during queries.

---

## Path Compression

When running `find(x)`, make every visited node point directly to the
root. Future queries on those nodes become O(1).

### Detailed trace

```
  Before find(5):

  0 <- 1 <- 2 <- 3 <- 4 <- 5

  find(5):
    5 -> parent is 4
    4 -> parent is 3
    3 -> parent is 2
    2 -> parent is 1
    1 -> parent is 0
    0 -> parent is 0 (root!)

  After path compression:

      0
     /|\ 
    1 2 3 4 5   (all point directly to 0)

  Next call to find(3) returns 0 immediately.
  Next call to find(5) returns 0 immediately.
```

This flattens the tree aggressively. The first `find` on a deep node
pays the traversal cost, but every subsequent query on any node in that
path is constant time. Over many operations, the average cost becomes
essentially flat.

### What if we only compressed the queried node?

Some implementations update only the final node's parent. That helps,
but compressing every node on the path helps even more — every node
visited by `find` gets upgraded to direct root access. This is the
difference between good and great performance in practice.

---

## Union by Rank

Always attach the shallower tree under the deeper tree. This avoids
creating long chains in the first place.

### How rank works

Each root stores a "rank" — an upper bound on tree height. When
merging two trees:

```
  Union by rank trace:

  Initial:
  rank[0] = 0, rank[1] = 0

  union(0, 1):
    Both have rank 0. Attach 1 under 0.
    Increment rank[0] to 1.

  Tree 0 (rank 1) now has height at most 1.

  union(2, 3):
    Both have rank 0. Attach 3 under 2.
    rank[2] = 1.

  union(0, 2):
    Both have rank 1. Attach either under the other.
    Increment winner's rank to 2.

  rank[0] = 2, tree height at most 2.
```

Without union by rank, a sequence of unions could create a chain of
length `n`. With union by rank, the maximum height is `O(log n)`.

### Union by size is equivalent

Instead of rank, track the number of nodes in each tree. Always attach
the smaller tree under the larger. This also guarantees `O(log n)`
height because a node's depth can only increase when its tree at least
doubles in size.

### Why both optimizations matter together

- **Union by rank** prevents bad trees from forming in the first place
- **Path compression** repairs any remaining deep paths during queries

### What if we skipped path compression?

Then repeated `find` operations would keep paying for the same long
paths again and again. The structure would never learn from prior
queries. Union by rank alone gives `O(log n)` per operation, which is
acceptable but not the near-constant performance that makes union-find
so powerful.

### What if we skipped union by rank?

Path compression alone still yields excellent amortized performance
(`O(log n)` amortized, though the analysis is more complex). But union
by rank ensures that even before any `find` operations run, the trees
are reasonably balanced. The two optimizations complement each other
beautifully.

---

## Complexity Summary

```
  ┌────────────────────┬──────────────────────────────┐
  │ Variant            │ Amortized time per operation │
  ├────────────────────┼──────────────────────────────┤
  │ Naive              │ O(n) worst case              │
  │ Union by rank only │ O(log n)                     │
  │ Path compression   │ O(log n) amortized         │
  │ Both together      │ O(α(n)) ≈ O(1)               │
  └────────────────────┴──────────────────────────────┘

  α(n) = inverse Ackermann function.
  For all practical n, α(n) < 5.
```

This is one of the most remarkable complexity results in all of
computer science: a data structure whose operations are effectively
constant time with extremely simple code.

---

## Python Implementation

```python
class UnionFind:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))
        self.rank = [0] * size

    def find(self, value: int) -> int:
        if self.parent[value] != value:
            self.parent[value] = self.find(self.parent[value])
        return self.parent[value]

    def union(self, first: int, second: int) -> bool:
        root_first = self.find(first)
        root_second = self.find(second)

        if root_first == root_second:
            return False

        if self.rank[root_first] < self.rank[root_second]:
            root_first, root_second = root_second, root_first

        self.parent[root_second] = root_first
        if self.rank[root_first] == self.rank[root_second]:
            self.rank[root_first] += 1

        return True
```

## TypeScript Implementation

```typescript
class UnionFind {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Array<number>(size).fill(0);
  }

  find(value: number): number {
    if (this.parent[value] !== value) {
      this.parent[value] = this.find(this.parent[value]);
    }
    return this.parent[value];
  }

  union(first: number, second: number): boolean {
    let rootFirst = this.find(first);
    let rootSecond = this.find(second);

    if (rootFirst === rootSecond) {
      return false;
    }

    if (this.rank[rootFirst] < this.rank[rootSecond]) {
      [rootFirst, rootSecond] = [rootSecond, rootFirst];
    }

    this.parent[rootSecond] = rootFirst;
    if (this.rank[rootFirst] === this.rank[rootSecond]) {
      this.rank[rootFirst] += 1;
    }
    return true;
  }
}
```

## Rust Implementation

```rust
struct UnionFind {
    parent: Vec<usize>,
    rank: Vec<usize>,
}

impl UnionFind {
    fn new(size: usize) -> Self {
        Self {
            parent: (0..size).collect(),
            rank: vec![0; size],
        }
    }

    fn find(&mut self, value: usize) -> usize {
        if self.parent[value] != value {
            let root = self.find(self.parent[value]);
            self.parent[value] = root;
        }
        self.parent[value]
    }

    fn union(&mut self, first: usize, second: usize) -> bool {
        let mut root_first = self.find(first);
        let mut root_second = self.find(second);

        if root_first == root_second {
            return false;
        }

        if self.rank[root_first] < self.rank[root_second] {
            std::mem::swap(&mut root_first, &mut root_second);
        }

        self.parent[root_second] = root_first;
        if self.rank[root_first] == self.rank[root_second] {
            self.rank[root_first] += 1;
        }
        true
    }
}
```

---

## Inverse Ackermann Time

With path compression and union by rank, the amortized time per
operation is:

$$
O(\alpha(n))
$$

where $\alpha(n)$ is the inverse Ackermann function. The Ackermann
function grows faster than any primitive recursive function — so fast
that `A(4, 4)` is an astronomically large number. Its inverse grows so
slowly that for all practical purposes:

```
  n                        α(n)
  1                        1
  2                        2
  3-7                      3
  8-2047                   4
  2048 and beyond          ≤ 5 (for all physically realizable inputs)
```

In practice: near-constant time. You will never see a workload where
`α(n) > 5`.

This is one of the most remarkable complexity results in all of
computer science: a data structure whose operations are effectively
constant time with extremely simple code.

---

## Exercises

1. Explain why naive union-find can degrade to linear time. Draw the
   tree shape that causes this.
2. Draw a parent array before and after path compression on a chain
   of 6 nodes.
3. Explain why Kruskal's MST algorithm uses union-find. What would go
   wrong without it?
4. Describe how to detect a cycle in an undirected graph using DSU.
   What is the exact condition that signals a cycle?
5. Why is amortized analysis the right lens for union-find, rather
   than worst-case per operation?
6. Trace union by rank on the sequence: union(0,1), union(2,3),
   union(0,2), union(4,5), union(0,4). Show the rank array at each step.
7. Compare union by rank versus union by size. Are they equivalent?
   When might one be preferable?
8. Design a small graph and show how union-find detects a cycle when
   Kruskal's algorithm considers each edge.

---

## Key Takeaways

- **Union-find (DSU)** tracks dynamically merging disjoint sets and
  answers "are these two elements in the same set?" in near-constant
  time.
- **`find(x)`** traverses parent pointers to the root representative.
  **Path compression** makes every visited node point directly to the
  root, flattening the tree aggressively.
- **`union(a, b)`** merges two sets by attaching one root under another.
  **Union by rank (or size)** keeps trees shallow by attaching the
  smaller tree under the larger.
- With both optimizations, the amortized time per operation is
  `O(α(n))`, effectively constant for all realistic inputs.
- DSU is a graph tool even though it is not itself a graph traversal.
  It powers Kruskal's MST, cycle detection, connected component
  tracking, and percolation problems.
- **Naive union-find without optimizations degrades to `O(n)` per
  operation** because chains of parent pointers can grow linearly.

The next lesson moves from connectivity to capacities with network flow.

---

**Previous**: [Lesson 30 — Topological Sort](./30-topological-sort.md)
**Next**: [Lesson 32 — Network Flow](./32-network-flow.md)