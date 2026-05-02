# Lesson 29: Minimum Spanning Trees — Kruskal's and Prim's

> **Analogy**: Suppose you must connect a set of cities with roads so
> every city is reachable, but you want the total cost to be as small
> as possible. You do not need every possible road. You need just enough
> roads to connect everything, and no cycles wasting cost.

---

## Why This Matters

Minimum spanning trees are one of the most practically important graph
algorithms. They appear everywhere infrastructure must be built under
cost constraints:

- **Network design**: laying fiber-optic cable between buildings or data
centers at minimum cost while ensuring every node is reachable
- **Clustering algorithms**: MSTs can be used to find natural groupings
in data by cutting the most expensive edges
- **Circuit layout**: connecting pins on a chip with the shortest total
wire length
- **Road and utility planning**: designing road networks, power grids,
and water pipelines that reach every location with minimum material
- **Map simplification**: approximating a dense road network with a
tree that preserves connectivity while discarding redundant edges
- **Approximation algorithms**: MSTs are a building block for
approximating NP-hard problems like the traveling salesman problem

By the end of this lesson, you will understand:

- Why a spanning tree must have exactly `V - 1` edges
- The cut property that makes greedy MST algorithms correct
- How Kruskal's algorithm sorts and filters edges using union-find
- How Prim's algorithm grows a tree from a single starting point
- When to choose Kruskal versus Prim
- Why MST and shortest path are fundamentally different problems

---

## The Island Bridge Analogy — Deeper

Picture four islands: A, B, C, and D. Surveyors have priced every
possible bridge:

```
  POSSIBLE BRIDGES AND COSTS

      A
    1/ \4
    B---C
    2\ /3
      D

  A-B: 1    A-C: 4
  B-C: ???  (not shown, assume expensive)
  B-D: 2    C-D: 3
```

You need to connect all four islands with the cheapest total bridge
cost. Let's think through the logic:

- With 4 islands, you need at least 3 bridges (any fewer leaves
  someone disconnected)
- With more than 3 bridges, you create a cycle — meaning you built
  at least one redundant bridge
- So the optimal solution uses exactly 3 bridges and costs 1 + 2 + 3 = 6

This is a spanning tree: all vertices connected, no cycles, `V - 1`
edges. The minimum spanning tree is the one with smallest total weight.

Key insight: the problem is not about any single path. It is about the
cheapest set of edges that keeps the whole graph connected.

---

## What Is a Spanning Tree?

A **spanning tree** of a connected undirected graph is a subgraph that:

1. **Includes all vertices** — every node is in the tree
2. **Has no cycles** — there is exactly one simple path between any
   two vertices
3. **Has exactly `V - 1` edges** — the minimum number of edges needed
   to connect `V` nodes

### Why exactly `V - 1` edges?

Think of building the tree one edge at a time:

- Start with `V` isolated vertices: 0 edges, `V` components
- Each new edge can connect at most two components into one
- To go from `V` components down to 1 component, you need exactly `V - 1`
  edges
- Any additional edge would create a cycle (both endpoints already
  connected through the tree)

```
  BUILDING A SPANNING TREE STEP BY STEP

  Step 0:  A    B    C    D     (4 components, 0 edges)

  Step 1:  A----B    C    D     (3 components, 1 edge)
           (add A-B)

  Step 2:  A----B    C----D     (2 components, 2 edges)
                      (add C-D)

  Step 3:  A----B----C----D     (1 component, 3 edges = V - 1)
                 (add B-C)

  Step 4:  A----B----C----D     (adding A-C would create a cycle)
           \_________/

  Adding any further edge creates a cycle.
```

A **minimum** spanning tree (MST) is the spanning tree with the smallest
possible total edge weight.

```
  Graph:

      A
    1/ \4
    B---C
    2\ /3
      D

  One MST:
  A-B (1), B-D (2), D-C (3)
  Total = 6
```

---

## The Cut Property — Why Greedy Works

Both Kruskal and Prim are greedy algorithms, and both are correct
because of a deep structural fact called the **cut property**:

> For any cut (a partition of vertices into two non-empty sets), the
> minimum-weight edge crossing that cut belongs to some MST.

This is why greedily picking the cheapest safe edge never locks you out
of an optimal solution.

### Cut property intuition

Imagine drawing a line through your graph, separating vertices into a
left group and a right group. Every edge from left to right "crosses"
the cut. The cheapest crossing edge is always safe to include:

```
  THE CUT PROPERTY

  Left side:    {A, B}        Right side: {C, D}
                   \          /
                    \   3   /
                 1   \   /   4
                      \ /
                       X
                      / \
                 2   /   \   5
                    /   6  \

  The cut separates {A, B} from {C, D}.
  Crossing edges: B-C (3), B-D (4), A-C (5), A-D (6)
  Minimum crossing edge: B-C with weight 3

  The cut property says: edge B-C (3) is safe to add.
  There exists an MST that contains B-C.
```

If you are ever unsure whether a cheap edge belongs in the MST, ask:
does it connect two previously disconnected groups? If yes, the cut
property guarantees it is safe.

---

## Kruskal's Algorithm — Sort and Merge

### Core idea

Sort all edges from cheapest to most expensive. Consider each edge in
order. Add it to the MST if it connects two vertices that are currently
in different components. Skip it if it would create a cycle.

To test whether an edge connects different components efficiently, use
**union-find** (see Lesson 31).

### Why this is greedy

At every step, Kruskal picks the globally cheapest remaining edge that
does not create a cycle. The cut property guarantees this is safe.

### Detailed step-by-step trace

```
  Graph:
      A
    1/ \4
    B---C
    2\ /3
      D

  All edges: (A,B,1), (B,D,2), (C,D,3), (A,C,4)

  INITIAL STATE:
  Components: {A}, {B}, {C}, {D}
  MST edges:  []

  Step 1: Consider (A,B,1) — cheapest edge
    A and B are in different components? YES
    Add to MST. Merge {A} and {B}.
    Components: {A,B}, {C}, {D}
    MST: [(A,B,1)]

  Step 2: Consider (B,D,2) — next cheapest
    B (in {A,B}) and D (in {D}) different? YES
    Add to MST. Merge {A,B} and {D}.
    Components: {A,B,D}, {C}
    MST: [(A,B,1), (B,D,2)]

  Step 3: Consider (C,D,3) — next cheapest
    C (in {C}) and D (in {A,B,D}) different? YES
    Add to MST. Merge {C} and {A,B,D}.
    Components: {A,B,C,D}
    MST: [(A,B,1), (B,D,2), (C,D,3)]

  Step 4: Consider (A,C,4)
    A and C are both in {A,B,C,D}. Same component!
    SKIP — would create cycle A-B-D-C-A.

  Final MST weight: 1 + 2 + 3 = 6
```

Notice: Kruskal did not need to reconsider edges. Once sorted, each
edge is examined exactly once.

### What if two edges have the same weight?

Ties can be broken arbitrarily. The cut property holds for any
minimum-weight crossing edge, so multiple MSTs may exist with equal
total weight. Kruskal will find one of them.

#### Python

```python
def kruskal(
    vertices: list[str],
    edges: list[tuple[int, str, str]],
) -> list[tuple[int, str, str]]:
    """Kruskal's MST algorithm — O(E log E) time."""
    parent = {vertex: vertex for vertex in vertices}
    rank = {vertex: 0 for vertex in vertices}

    def find(vertex: str) -> str:
        """Find root with path compression."""
        if parent[vertex] != vertex:
            parent[vertex] = find(parent[vertex])
        return parent[vertex]

    def union(first: str, second: str) -> bool:
        """Union by rank. Returns True if merged, False if already same."""
        root_first = find(first)
        root_second = find(second)
        if root_first == root_second:
            return False
        # Attach smaller rank under larger rank
        if rank[root_first] < rank[root_second]:
            root_first, root_second = root_second, root_first
        parent[root_second] = root_first
        if rank[root_first] == rank[root_second]:
            rank[root_first] += 1
        return True

    # Sort edges by weight ascending
    mst: list[tuple[int, str, str]] = []
    for weight, source, target in sorted(edges, key=lambda e: e[0]):
        if union(source, target):
            mst.append((weight, source, target))

    return mst


# Usage
vertices = ["A", "B", "C", "D"]
edges = [
    (1, "A", "B"),
    (4, "A", "C"),
    (2, "B", "D"),
    (3, "C", "D"),
]
mst = kruskal(vertices, edges)
print(mst)  # [(1, 'A', 'B'), (2, 'B', 'D'), (3, 'C', 'D')]
print(sum(w for w, _, _ in mst))  # 6
```

---

## Prim's Algorithm — Grow From a Seed

### Core idea

Start at any vertex. Repeatedly add the cheapest edge that connects a
vertex already in the tree to a vertex not yet in the tree. Grow the
MST outward like a mold spreading across the graph.

### Intuition

Kruskal thinks globally about edges.

Prim thinks locally about the current frontier.

### Detailed step-by-step trace

```
  Same graph, starting from A:

      A
    1/ \4
    B---C
    2\ /3
      D

  INITIAL STATE:
  In tree:     {A}
  Not in tree: {B, C, D}
  Frontier edges from A: A-B (1), A-C (4)
  MST: []

  Step 1: Pick cheapest frontier edge: A-B (1)
    Add B to tree.
    In tree: {A, B}
    Frontier now: A-C (4), plus new edges from B:
                  B-D (2)
    MST: [(A,B,1)]

  Step 2: Pick cheapest frontier edge: B-D (2)
    Add D to tree.
    In tree: {A, B, D}
    Frontier now: A-C (4), plus new edges from D:
                  D-C (3)
    MST: [(A,B,1), (B,D,2)]

  Step 3: Pick cheapest frontier edge: D-C (3)
    (cheaper than A-C's 4)
    Add C to tree.
    In tree: {A, B, D, C} — all vertices!
    MST: [(A,B,1), (B,D,2), (D,C,3)]

  Done! All vertices connected. Total weight: 6.
```

### Why Prim's frontier approach works

At every step, Prim considers all edges from the growing tree to the
outside world. The cheapest such edge crosses a cut (tree vs. rest), so
by the cut property, it is safe to add.

#### TypeScript

```typescript
function prim(
  graph: Record<string, Array<[string, number]>>,
  start: string,
): Array<[string, string, number]> {
  const visited = new Set<string>([start]);
  // Min-heap of frontier edges: [weight, from, to]
  const heap: Array<[number, string, string]> = [];
  for (const [neighbor, weight] of graph[start] ?? []) {
    heap.push([weight, start, neighbor]);
  }

  const mst: Array<[string, string, number]> = [];

  while (heap.length > 0) {
    // Simple linear extract-min (binary heap would be O(log n))
    let minIndex = 0;
    for (let i = 1; i < heap.length; i++) {
      if (heap[i][0] < heap[minIndex][0]) minIndex = i;
    }
    const [weight, source, target] = heap.splice(minIndex, 1)[0];

    if (visited.has(target)) continue;

    visited.add(target);
    mst.push([source, target, weight]);

    for (const [neighbor, nextWeight] of graph[target] ?? []) {
      if (!visited.has(neighbor)) {
        heap.push([nextWeight, target, neighbor]);
      }
    }
  }

  return mst;
}
```

---

## Kruskal vs Prim — When To Use Which

```
  KRUSKAL                           PRIM

  sorts all edges                   grows one tree from seed
  uses union-find                   uses priority queue / min-heap
  natural on edge lists             natural on adjacency lists
  O(E log E) time                   O(E log V) with binary heap
  works on disconnected graphs      needs connected graph (or run
                                    once per component)

  Choose Kruskal when:
  - The graph is sparse (E ≈ V)
  - You already have edges as a list
  - You want to handle disconnected graphs naturally

  Choose Prim when:
  - The graph is dense (E ≈ V^2)
  - You have an adjacency list ready
  - You want to grow from a specific starting point
```

Both are greedy. Both are correct. Both rely on the cut property. They
just express the greedy choice differently — Kruskal globally over all
edges, Prim locally over the current frontier.

### What if we just picked the globally cheapest edges?

This is the naive greedy trap. Without cycle checking, you can include
redundant edges:

```
  Triangle with edge weights:

      A
    1/ \3
    B---C
      2

  Blind cheapest-first:
    Pick A-B (1) — fine
    Pick B-C (2) — fine, now A,B,C all connected
    Pick A-C (3) — CREATES CYCLE A-B-C-A!

  The cycle adds cost 3 with no benefit.
  Correct MST uses only A-B and B-C, total = 3.
```

On larger graphs, this mistake is worse. A cycle might use an expensive
edge that blocks you from connecting a distant vertex later. Cycle
detection is not an optimization — it is essential for correctness.

### What if the graph is disconnected?

A spanning tree requires a connected graph. If the graph has multiple
connected components:

- Kruskal naturally produces a **minimum spanning forest** — one MST per
  component
- Prim will only visit the component containing the start vertex. To
  cover all components, you must run Prim once per component

In practice, always verify your graph is connected before applying MST
algorithms (unless you explicitly want a forest).

### What if we skipped union-find and checked cycles naively?

Without union-find, each cycle check requires a graph traversal (DFS
or BFS), costing `O(V + E)` per edge. With `E` edges, that becomes
`O(E(V + E))` — potentially `O(V^3)` for dense graphs. Union-find
reduces this to nearly constant time per check.

---

## Rust Example

```rust
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap, HashSet};

fn prim(
    graph: &HashMap<&str, Vec<(&str, i32)>>,
    start: &str,
) -> Vec<(String, String, i32)> {
    let mut visited = HashSet::from([start.to_string()]);
    let mut heap = BinaryHeap::new();
    let mut mst = Vec::new();

    // Seed the heap with edges from the start vertex
    if let Some(neighbors) = graph.get(start) {
        for &(neighbor, weight) in neighbors {
            heap.push(Reverse((weight, start.to_string(), neighbor.to_string())));
        }
    }

    while let Some(Reverse((weight, source, target))) = heap.pop() {
        if visited.contains(&target) {
            continue;
        }

        visited.insert(target.clone());
        mst.push((source.clone(), target.clone(), weight));

        if let Some(neighbors) = graph.get(target.as_str()) {
            for &(neighbor, next_weight) in neighbors {
                if !visited.contains(neighbor) {
                    heap.push(Reverse((
                        next_weight,
                        target.clone(),
                        neighbor.to_string(),
                    )));
                }
            }
        }
    }

    mst
}
```

---

## Complexity Summary

```
  ┌────────────────────┬──────────────────┬──────────────────┐
  │ Algorithm          │ Time             │ Space            │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Kruskal (sort)     │ O(E log E)       │ O(V) union-find  │
  │ Kruskal + sort     │ dominated by     │ plus O(E) for    │
  │                    │ edge sorting     │ edge list        │
  │ Prim (binary heap) │ O(E log V)       │ O(V) heap +      │
  │                    │                  │ O(V + E) graph   │
  │ Prim (dense,       │ O(V^2) with      │ O(V^2) matrix    │
  │ adjacency matrix)  │ linear scan      │                  │
  └────────────────────┴──────────────────┴──────────────────┘

  For dense graphs (E ≈ V^2): Prim with adjacency matrix is O(V^2),
  which beats Kruskal's O(V^2 log V).

  For sparse graphs (E ≈ V): both are O(V log V), but Kruskal is
  simpler to implement if you already have an edge list.
```

---

## Exercises

1. Explain why every spanning tree has exactly `V - 1` edges. Use the
   component-merging argument.
2. Explain why Kruskal needs cycle detection. Give a concrete example
   where skipping it produces a wrong answer.
3. Describe how Prim changes if the graph is disconnected. How would
   you handle it?
4. Compare when an edge list representation favors Kruskal over Prim,
   and vice versa.
5. State the cut property in your own words. Why does it guarantee that
   Kruskal's greedy choice is safe?
6. Trace Kruskal's algorithm on a graph with a tie: two edges of equal
   weight that both seem valid. Show that either choice still leads to
   an MST (possibly a different one).
7. A graph has all edge weights equal. How many MSTs does it have?
   What do Kruskal and Prim produce?
8. Design a small graph where the shortest path tree from a single
   source is NOT the same as the MST. This proves MST ≠ shortest path.

---

## Key Takeaways

- A spanning tree connects all `V` vertices with exactly `V - 1` edges
  and no cycles. The MST is the one with minimum total weight.
- The **cut property** is the mathematical foundation: the cheapest edge
  across any cut is always safe to include in some MST.
- **Kruskal's algorithm** sorts all edges and greedily adds the cheapest
  edge that connects two different components. It naturally uses
  union-find for cycle detection and works on disconnected graphs.
- **Prim's algorithm** grows a single tree from a starting vertex,
  always adding the cheapest edge connecting the tree to the outside.
  It uses a priority queue (min-heap) to track the frontier.
- Cycle checks are essential; picking the cheapest edges blindly can
  create wasteful cycles and block necessary connections.
- **MST and shortest path are different optimization goals**. MST
  minimizes total connection cost across all vertices. Shortest path
  minimizes cost from one source to one destination.
- Choose **Kruskal** for sparse graphs or when you have an edge list.
  Choose **Prim** for dense graphs or when you have an adjacency list.

The next lesson turns from undirected optimization to directed
dependency ordering with topological sort.

---

**Previous**: [Lesson 28 — Shortest Path Algorithms](./28-shortest-paths.md)
**Next**: [Lesson 30 — Topological Sort](./30-topological-sort.md)