# DSA Mastery Reference: Data Structure and Algorithm Selection Guide

> This reference answers a practical question: when a problem gives you a
> choice, what should you reach for first? The point is not one universal
> best structure. The point is selecting the structure whose tradeoffs
> match the workload.

---

## Start Here

```
  What kind of work do you need to do most?

  lookup / membership?      -> hash-based structures
  ordered traversal?        -> BST / heap / sorted array
  prefix / range queries?   -> prefix sums / Fenwick / segment tree
  graph reachability?       -> BFS / DFS / DSU
  substring / prefix work?  -> trie / KMP / suffix structures
  combinatorial subsets?    -> bitmask / DP / backtracking
```

---

## Lookup And Membership

### Need fast membership with no ordering?

- use `hash set`
- use `hash map` if you need associated values

### Need approximate membership with low memory?

- use `Bloom filter`

### Need ordered membership and traversal?

- use `balanced BST`
- use `B-tree` / `B+ tree` when external memory or range scans matter

---

## Ordered Data

### Need minimum or maximum repeatedly?

- use `heap / priority queue`

### Need insert, delete, and sorted traversal?

- use `AVL tree`, `red-black tree`, `treap`, or `skip list`

### Need locality-sensitive repeated access?

- consider `splay tree`

### Need disk/page efficiency?

- consider `B-tree` or `B+ tree`

---

## Range Queries And Updates

```
  static range sums only?              -> prefix sums
  many range adds, final array only?   -> difference array
  prefix/range sums + point updates?   -> Fenwick tree
  general range query/update mix?      -> segment tree
  static idempotent queries?           -> sparse table
```

### Decision notes

- choose `prefix sums` if there are no online updates
- choose `Fenwick tree` for compact sum-style updates and queries
- choose `segment tree` when the query/update logic is richer

---

## Graph Problems

### Need reachability or connected components?

- use `DFS` or `BFS`

### Need shortest path in an unweighted graph or grid?

- use `BFS`

### Need shortest path with nonnegative edge weights?

- use `Dijkstra`

### Need negative edges?

- use `Bellman-Ford`

### Need all-pairs shortest path on small dense graphs?

- use `Floyd-Warshall`

### Need dependency ordering?

- use `topological sort`

### Need dynamic connectivity under unions?

- use `Union-Find`

### Need maximum flow / matching modeling?

- use `network flow`

---

## String Problems

### Need simple single-pattern matching?

- start with `naive search`
- upgrade to `KMP` when redundant comparison matters

### Need rolling-hash filtering or multiple comparisons?

- consider `Rabin-Karp`

### Need strong practical skipping on large text?

- consider `Boyer-Moore`

### Need prefix-based dictionary operations?

- use `trie`

### Need many substring queries on a fixed text?

- use `suffix array` or `suffix tree`

### Need compression-oriented transform reasoning?

- use `BWT`

---

## Arrays And Sequence Problems

### Need subarray / substring optimization on contiguous ranges?

- check `sliding window`

### Need repeated range sums?

- use `prefix sums`

### Need next greater / previous smaller style answers?

- use `monotonic stack`

### Need moving-window max/min?

- use `monotonic queue`

### Need pair finding on sorted data?

- use `two pointers`

### Need answer search under monotonic feasibility?

- use `binary search on answer`

---

## Optimization And Search

### Need exact search over combinations?

- start with `backtracking`

### Same recursive states repeat?

- add `memoization / DP`

### Small combinatorial state space?

- consider `bitmask DP`

### Need greedy only if local choice can be justified?

- use `greedy` when exchange/stays-ahead reasoning exists

### Need divide-and-conquer because halves combine efficiently?

- use `divide and conquer`

---

## Problem-Type Guide

### Lookup problems

- membership only: `hash set`
- key -> value: `hash map`
- ordered lookup: `balanced BST`

### Ordered data problems

- repeatedly need smallest/largest: `heap`
- need ordered inserts + deletes + traversal: `balanced BST` / `skip list` / `treap`

### Range-query problems

- static sums: `prefix sums`
- dynamic sums: `Fenwick tree`
- complex range ops: `segment tree`

### Graph problems

- unweighted shortest path: `BFS`
- weighted shortest path: `Dijkstra`
- dependencies: `topological sort`
- connectivity under merges: `Union-Find`

### String problems

- prefix lookup: `trie`
- exact pattern search: `KMP` / `Rabin-Karp` / `Boyer-Moore`
- many substring queries: `suffix array`

### Optimization problems

- overlapping states: `DP`
- local safe choice exists: `greedy`
- small exact combinatorics: `bitmask DP` / `backtracking`
- monotonic answer space: `binary search on answer`

---

## Constraint-Based Heuristics

```
  n <= 20                    exact exponential / bitmask often okay
  need O(1) average lookup   hash structures
  sorted input               binary search / two pointers often useful
  many updates + many queries range trees become likely
  fixed text, many queries   preprocess with suffix/prefix structures
  repeated local comparisons monotonic structures may help
```

---

## Final Rule

Choose the structure or algorithm that matches:

1. the dominant operation
2. the update/query mix
3. the constraint size
4. whether ordering matters
5. whether the data is static or dynamic

That decision process is more reliable than memorizing isolated “best”
structures.

---

**Previous**: [Complexity Cheat Sheet](./reference-complexity.md)
**Next**: [LeetCode Patterns Catalog](./reference-patterns.md)