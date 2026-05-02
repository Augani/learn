# DSA Mastery Reference: Complexity Cheat Sheet

> Use this as the fast lookup table for the whole track. The point is not
> to memorize every cell mechanically, but to compare tradeoffs quickly:
> what gives fast lookup, what gives fast updates, what is cache-friendly,
> and what breaks when ordering or range queries enter the problem.

---

## How To Read This Sheet

- `n` = number of elements
- `V` = number of vertices
- `E` = number of edges
- `h` = tree height
- `L` = string length or pattern length depending on context
- amortized and expected bounds are labeled when relevant

---

## Core Data Structures

| Structure | Access | Search | Insert | Delete | Notes | Space |
| --- | --- | --- | --- | --- | --- | --- |
| Array | `O(1)` | `O(n)` | `O(n)` | `O(n)` | great cache locality, expensive middle updates | `O(n)` |
| Dynamic array | `O(1)` | `O(n)` | append amortized `O(1)`, middle `O(n)` | `O(n)` | resize causes occasional expensive copy | `O(n)` |
| Singly linked list | `O(n)` | `O(n)` | head `O(1)`, known-node after `O(1)` | head `O(1)`, known-prev after `O(1)` | poor cache locality | `O(n)` |
| Doubly linked list | `O(n)` | `O(n)` | ends `O(1)` | known-node `O(1)` | useful for LRU-style designs | `O(n)` |
| Stack | top `O(1)` | `O(n)` | push `O(1)` | pop `O(1)` | LIFO | `O(n)` |
| Queue | front `O(1)` | `O(n)` | enqueue `O(1)` | dequeue `O(1)` | FIFO | `O(n)` |
| Deque | ends `O(1)` | `O(n)` | ends `O(1)` | ends `O(1)` | supports both front and back operations | `O(n)` |
| Hash table / hash map | N/A | average `O(1)`, worst `O(n)` | average `O(1)` | average `O(1)` | unordered, depends on hash quality | `O(n)` |
| Hash set | N/A | average `O(1)` | average `O(1)` | average `O(1)` | set membership structure | `O(n)` |
| Bloom filter | N/A | false-positive membership `O(k)` | insert `O(k)` | no delete in basic form | probabilistic | `O(m)` |

---

## Tree Structures

| Structure | Search | Insert | Delete | Extra Operations | Space |
| --- | --- | --- | --- | --- | --- |
| Binary tree | `O(n)` | depends on shape | depends on shape | traversal `O(n)` | `O(n)` |
| BST | average `O(log n)`, worst `O(n)` | average `O(log n)` | average `O(log n)` | inorder gives sorted order | `O(n)` |
| AVL tree | `O(log n)` | `O(log n)` | `O(log n)` | tighter balance than red-black | `O(n)` |
| Red-black tree | `O(log n)` | `O(log n)` | `O(log n)` | fewer rotations on average than AVL | `O(n)` |
| Splay tree | amortized `O(log n)` | amortized `O(log n)` | amortized `O(log n)` | good locality, poor single-op worst case | `O(n)` |
| Treap | expected `O(log n)` | expected `O(log n)` | expected `O(log n)` | randomized priorities | `O(n)` |
| Skip list | expected `O(log n)` | expected `O(log n)` | expected `O(log n)` | probabilistic balancing | `O(n)` expected |
| Heap / priority queue | search arbitrary `O(n)`, top `O(1)` | push `O(log n)` | pop top `O(log n)` | heapify `O(n)` | `O(n)` |
| Fibonacci heap | top `O(1)` | insert amortized `O(1)` | extract-min amortized `O(log n)` | decrease-key amortized `O(1)` | `O(n)` |
| B-tree | `O(log n)` | `O(log n)` | `O(log n)` | optimized for disks / pages | `O(n)` |
| B+ tree | `O(log n)` | `O(log n)` | `O(log n)` | fast range scans via leaf links | `O(n)` |
| Trie | `O(L)` | `O(L)` | `O(L)` | prefix lookup `O(L)` | `O(total characters)` |

---

## Range Query Structures

| Structure | Build | Point Query | Range Query | Point Update | Range Update | Space |
| --- | --- | --- | --- | --- | --- | --- |
| Prefix sums | `O(n)` | N/A | `O(1)` sum | expensive rebuild | expensive rebuild | `O(n)` |
| Difference array | `O(n)` | after restore `O(1)` | not primary purpose | range add `O(1)` boundary marks | `O(1)` per range add + `O(n)` final restore | `O(n)` |
| Fenwick tree | `O(n)` or `O(n log n)` | prefix `O(log n)` | range via prefix diff `O(log n)` | `O(log n)` | limited variants | `O(n)` |
| Segment tree | `O(n)` | `O(log n)` | `O(log n)` | `O(log n)` | with lazy propagation `O(log n)` | `O(n)` to `O(4n)` |
| Sparse table | `O(n log n)` | N/A | idempotent query `O(1)` | no efficient update | no efficient update | `O(n log n)` |

---

## Sorting Algorithms

| Algorithm | Best | Average | Worst | Space | Stable | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Bubble sort | `O(n)` | `O(n^2)` | `O(n^2)` | `O(1)` | yes | mostly educational |
| Selection sort | `O(n^2)` | `O(n^2)` | `O(n^2)` | `O(1)` | no | few swaps, many comparisons |
| Insertion sort | `O(n)` | `O(n^2)` | `O(n^2)` | `O(1)` | yes | excellent for small or nearly sorted input |
| Merge sort | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(n)` | yes | predictable, good for linked lists and external sorting |
| Quick sort | `O(n log n)` | `O(n log n)` | `O(n^2)` | `O(log n)` expected recursion | no | very fast in practice, pivot sensitive |
| Heap sort | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(1)` | no | good worst-case bound, worse cache behavior |
| Counting sort | `O(n + k)` | `O(n + k)` | `O(n + k)` | `O(n + k)` | yes | requires bounded key range |
| Radix sort | `O(d(n + k))` | `O(d(n + k))` | `O(d(n + k))` | `O(n + k)` | depends on inner stable sort | non-comparison sorting |
| Bucket sort | `O(n + k)` expected | `O(n + k)` expected | `O(n^2)` | `O(n + k)` | depends | works well on well-distributed data |
| Timsort | `O(n)` | `O(n log n)` | `O(n log n)` | `O(n)` | yes | Python / Java hybrid, exploits runs |
| Introsort | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(log n)` | no | quicksort with heap-sort fallback |

---

## Searching And Array Patterns

| Technique | Time | Space | Notes |
| --- | --- | --- | --- |
| Linear search | `O(n)` | `O(1)` | no assumptions |
| Binary search | `O(log n)` | `O(1)` iterative | requires monotonic ordering |
| Two pointers | usually `O(n)` | `O(1)` | often on sorted arrays or inward scans |
| Sliding window | usually `O(n)` | `O(1)` or `O(k)` | requires maintainable local invariant |
| Monotonic stack | `O(n)` amortized | `O(n)` | next/previous greater-smaller problems |
| Monotonic queue | `O(n)` amortized | `O(n)` | sliding-window extrema |

---

## Graph Algorithms

| Algorithm | Time | Space | Best Use |
| --- | --- | --- | --- |
| BFS | `O(V + E)` | `O(V)` | shortest path in unweighted graphs, layers |
| DFS | `O(V + E)` | `O(V)` | traversal, connectivity, cycle detection |
| Topological sort | `O(V + E)` | `O(V)` | DAG ordering |
| Dijkstra with heap | `O((V + E) log V)` | `O(V)` | nonnegative weighted shortest path |
| Bellman-Ford | `O(VE)` | `O(V)` | negative edges, detects negative cycles |
| Floyd-Warshall | `O(V^3)` | `O(V^2)` | all-pairs shortest path on dense small graphs |
| A* | depends on heuristic, often near `O(E)` to `O(E log V)` | `O(V)` | guided shortest path |
| Kruskal | `O(E log E)` | `O(V)` | MST with DSU |
| Prim with heap | `O(E log V)` | `O(V)` | MST on adjacency lists |
| Union-Find operations | amortized `O(alpha(n))` | `O(n)` | dynamic connectivity |
| Edmonds-Karp | `O(VE^2)` | `O(V + E)` | max flow, simpler augmenting-path version |
| Dinic | `O(V^2E)` general, better on many practical cases | `O(V + E)` | faster max flow |
| Kosaraju SCC | `O(V + E)` | `O(V)` | strongly connected components |
| Tarjan SCC | `O(V + E)` | `O(V)` | SCC with one DFS pass |

---

## Dynamic Programming Patterns

| Pattern | Typical Time | Typical Space | Notes |
| --- | --- | --- | --- |
| 1D DP | `O(n)` | `O(n)` or optimized `O(1)` | linear recurrences |
| 2D grid DP | `O(nm)` | `O(nm)` or row-optimized `O(m)` | grids, LCS-style tables |
| Knapsack DP | `O(nW)` | `O(nW)` or `O(W)` | weight-capacity state |
| Interval DP | often `O(n^3)` | `O(n^2)` | state on `[l, r]` |
| Bitmask DP | `O(n 2^n)` or similar | `O(2^n)` to `O(n 2^n)` | small combinatorial state spaces |
| Digit DP | `O(d * state_space)` | `O(d * state_space)` | counting values up to bound |
| Tree DP | usually `O(n * state)` | `O(n * state)` | subtree composition |

---

## String Algorithms And Structures

| Algorithm / Structure | Build | Query / Match | Space | Notes |
| --- | --- | --- | --- | --- |
| Naive string matching | none | `O(nm)` | `O(1)` | simple baseline |
| KMP | `O(m)` LPS build | `O(n + m)` | `O(m)` | avoids redundant comparisons |
| Rabin-Karp | `O(m)` setup | average `O(n + m)`, worst `O(nm)` | `O(1)` extra | rolling hash, verify collisions |
| Boyer-Moore | preprocess pattern | often sublinear practical behavior | depends on tables | strong practical skipping |
| Trie | `O(total chars)` | prefix `O(L)` | `O(total chars)` | prefix-heavy workloads |
| Suffix array | depends on construction, naive `O(n^2 log n)` | substring search `O(m log n)` | `O(n)` | compact full-text index |
| LCP array | `O(n)` after suffix array with Kasai | range/use-dependent | `O(n)` | repeated substring analysis |
| Suffix tree | linear-time theoretical construction | many substring queries `O(m)` | large constants | powerful but complex |
| Burrows-Wheeler transform | `O(n log n)` via suffix array style approaches | transform, not direct query structure | `O(n)` | helps compression |

---

## Advanced Topics Quick Reference

| Topic | Typical Complexity | Notes |
| --- | --- | --- |
| Convex hull (monotone chain) | `O(n log n)` | sort + turn tests |
| Closest pair of points | `O(n log n)` | divide and conquer |
| Reservoir sampling | `O(n)` stream pass | `O(1)` sample memory |
| Reverse bits / bit tricks | usually `O(word size)` | often treated as `O(1)` on fixed-width machines |
| Meet-in-the-middle | `O(2^(n/2))` style | useful around `n ~ 30..40` |
| Binary search on answer | `O(check * log range)` | requires monotonic feasibility |

---

## Which Table Should You Reach For?

- Need lookup/update tradeoffs: core data structures.
- Need range queries: range-query structures.
- Need ordering or sorting guarantees: sorting table.
- Need graph runtimes: graph table.
- Need pattern-level DP guidance: DP table.
- Need text indexing or matching: string section.

---

**Previous**: [DSA Mastery Roadmap](./00-roadmap.md)
**Next**: [Data Structure and Algorithm Selection Guide](./reference-decision-guide.md)