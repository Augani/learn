# Lesson 31: Union-Find (Disjoint Set Union)

> **Analogy**: Imagine students gradually forming friend groups. At any
> point, you want to know whether two students belong to the same group,
> and you want to merge groups quickly when a new friendship links them.
> Union-find is the data structure for that problem.

---

## Why This Matters

Union-find solves dynamic connectivity problems where sets merge over
time.

It is a core tool for:

- Kruskal's MST
- connected component tracking
- cycle detection in undirected graphs
- grouping and clustering problems

Its power comes from two optimizations:

- path compression
- union by rank or size

Together they make operations effectively constant for real workloads.

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

- `find(x)`: return the representative of `x`
- `union(a, b)`: merge the two sets if different

---

## Naive Union-Find

Without optimizations, trees can become tall.

```
  0 <- 1 <- 2 <- 3 <- 4 <- 5

  find(5) takes O(n)
```

That defeats the point.

---

## Path Compression

When running `find(x)`, make every visited node point directly to the
root.

```
  Before find(5):
  0 <- 1 <- 2 <- 3 <- 4 <- 5

  After find(5):
  0 <- 1
  ^   ^   ^   ^   ^
  |   |   |   |   |
  2   3   4   5   all now point to 0
```

This flattens the tree aggressively.

---

## Union by Rank

Always attach the shallower tree under the deeper tree.

This avoids creating long chains in the first place.

### Why both optimizations matter

- union by rank prevents bad trees
- path compression repairs trees during queries

### What if we skipped path compression?

Then repeated `find` operations would keep paying for the same long
paths again and again. The structure would never learn from prior
queries.

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

where $\alpha(n)$ is the inverse Ackermann function, which grows so
slowly that it is below 5 for any realistic input size.

In practice: near-constant time.

---

## Exercises

1. Explain why naive union-find can degrade to linear time.
2. Draw a parent array before and after path compression.
3. Explain why Kruskal uses union-find.
4. Describe how to detect a cycle in an undirected graph with DSU.
5. Why is amortized analysis the right lens for union-find?

---

## Key Takeaways

- Union-find tracks dynamically merging sets.
- `find` answers connectivity through representatives.
- Path compression and union by rank make the structure extremely fast.
- DSU is a graph tool even though it is not itself a graph traversal.
- Many greedy graph algorithms rely on it for structural checks.

The next lesson moves from connectivity to capacities with network flow.

---

**Previous**: [Lesson 30 — Topological Sort](./30-topological-sort.md)
**Next**: [Lesson 32 — Network Flow](./32-network-flow.md)