# Lesson 28: Shortest Path Algorithms

> **Analogy**: Navigation is not one problem. Sometimes every road is
> equally costly, sometimes some roads are negative because of rebates,
> sometimes you want all-pairs answers, and sometimes a heuristic lets
> you head toward the goal instead of exploring blindly. Shortest path
> algorithms differ because the graph model differs.

---

## Why This Matters

Shortest paths show up in:

- routing and navigation
- scheduling and dependency costs
- networking
- game AI
- state-space search

There is no single shortest-path algorithm for all graphs.

This lesson covers:

- Dijkstra's algorithm
- Bellman-Ford
- Floyd-Warshall
- A* search

---

## The Navigation Analogy — Deeper

Imagine four different navigation scenarios:

**Scenario 1: City with positive distances only (Dijkstra)**
Every road has a positive length. Once you have found the shortest route to an intersection, no future discovery can make it shorter. This is Dijkstra's world.

**Scenario 2: Roads with toll rebates (Bellman-Ford)**
Some roads give you money back (negative weight). Now a longer path might become shorter overall because of a big rebate later. You cannot finalize any intersection until you have checked all possible paths up to V-1 edges.

**Scenario 3: All-pairs travel guide (Floyd-Warshall)**
You are publishing a guide that needs the shortest route between EVERY pair of cities. Instead of running Dijkstra from every city, you use dynamic programming to build all answers at once.

**Scenario 4: GPS with "as the crow flies" estimate (A*)**
You know the straight-line distance to the destination. Instead of exploring equally in all directions, you prioritize roads that seem to point toward the goal.

Each scenario demands a different algorithm because the assumptions differ.

---

## Dijkstra's Algorithm

### When it applies

Use Dijkstra when all edge weights are non-negative.

### Core idea

Always expand the unprocessed node with the smallest known distance.
 That greedy choice is safe only because weights are never negative.

```
       4
  A ------> B
  |         |
  1         2
  v         v
  C ------> D
       3
```

If we know the cheapest unsettled node is `C` with distance `1`, then
 no future path can make `C` cheaper without using negative edges.

### Step-by-Step Trace

```
  Graph:
  A --4--> B
  A --1--> C
  C --3--> D
  B --2--> D

  Initial state:
  distances: A=0, B=∞, C=∞, D=∞
  visited:   {}
  priority queue: [(0, A)]

  Step 1: pop A (dist 0)
    relax A->B: new_dist = 0+4 = 4 < ∞ → update B to 4
    relax A->C: new_dist = 0+1 = 1 < ∞ → update C to 1
    queue: [(1, C), (4, B)]
    visited: {A}

  Step 2: pop C (dist 1)
    relax C->D: new_dist = 1+3 = 4 < ∞ → update D to 4
    queue: [(4, B), (4, D)]
    visited: {A, C}

  Step 3: pop B (dist 4)
    relax B->D: new_dist = 4+2 = 6 > 4 → no update
    queue: [(4, D)]
    visited: {A, C, B}

  Step 4: pop D (dist 4)
    D has no outgoing edges
    queue: []
    visited: {A, C, B, D}

  Final distances:
  A=0, B=4, C=1, D=4
```

### Relaxation

For an edge `(u, v, w)`, if

$$
dist[u] + w < dist[v]
$$

then update `dist[v]`.

#### Python

```python
import heapq


def dijkstra(graph: dict[str, list[tuple[str, int]]], start: str) -> dict[str, int]:
    distances: dict[str, int] = {start: 0}
    heap: list[tuple[int, str]] = [(0, start)]

    while heap:
        cost, node = heapq.heappop(heap)
        if cost > distances.get(node, float("inf")):
            continue

        for neighbor, weight in graph.get(node, []):
            new_cost = cost + weight
            if new_cost < distances.get(neighbor, float("inf")):
                distances[neighbor] = new_cost
                heapq.heappush(heap, (new_cost, neighbor))

    return distances
```

---

## Why Dijkstra Fails With Negative Edges

```
  A --2--> B
  A --5--> C
  C ---4-> B
```

Dijkstra may finalize `B` at cost `2` before discovering the path
 `A -> C -> B` with total cost `1`.

Negative edges destroy the greedy guarantee.

**Why?** Dijkstra's proof relies on this invariant: once a node is popped from the priority queue, its distance is final. With negative edges, a future path through an unsettled node could reduce that distance, breaking the invariant.

```
  Step 1: pop A (dist 0)
    B = 2, C = 5

  Step 2: pop B (dist 2)  ← Dijkstra thinks B is done!
    But path A->C->B = 5 + (-4) = 1 < 2
    Too late — B was already finalized.
```

### What if we ran Dijkstra anyway and just "re-relaxed"?

That is the idea behind the **Bellman-Ford** algorithm. Instead of greedily finalizing nodes, we relax all edges repeatedly, giving each path up to V-1 edges a chance to propagate.

---

## Bellman-Ford

### When it applies

Use Bellman-Ford when negative edges may exist.

### Core idea

Repeat relaxation over all edges `V - 1` times.

Why `V - 1`? A shortest simple path uses at most `V - 1` edges. After k passes, all shortest paths using at most k edges are correct.

### Step-by-Step Trace

```
  Graph:
  A --2--> B
  A --5--> C
  C --(-4)-> B
  B --1--> D

  Initial: A=0, B=∞, C=∞, D=∞

  Pass 1:
    A->B: B = min(∞, 0+2) = 2
    A->C: C = min(∞, 0+5) = 5
    C->B: B = min(2, 5-4) = 1  ← negative edge improves B!
    B->D: D = min(∞, 2+1) = 3  (uses old B value in this pass)

    After pass 1: A=0, B=1, C=5, D=3

  Pass 2:
    A->B: no change
    A->C: no change
    C->B: no change
    B->D: D = min(3, 1+1) = 2  ← B improved, so D improves too!

    After pass 2: A=0, B=1, C=5, D=2

  Pass 3:
    No changes.

  Final distances: A=0, B=1, C=5, D=2
```

Notice how the negative edge C->B allowed B to improve, which then allowed D to improve in the next pass. This propagation is exactly what Dijkstra cannot handle.

### Negative cycle detection

If one more full relaxation still improves some distance, then a
 negative cycle is reachable.

```
  A --1--> B
  B --(-2)-> C
  C --1--> A

  Cycle A->B->C->A has total weight 1 + (-2) + 1 = 0.
  If it were negative (e.g., C->A = 0.5), we could loop forever,
  decreasing the distance each time. Bellman-Ford detects this
  because distances would keep improving after V-1 passes.
```

#### Python

```python
def bellman_ford(
    vertices: list[str],
    edges: list[tuple[str, str, int]],
    start: str,
) -> tuple[dict[str, int], bool]:
    distances = {vertex: float("inf") for vertex in vertices}
    distances[start] = 0

    for _ in range(len(vertices) - 1):
        updated = False
        for source, target, weight in edges:
            if distances[source] != float("inf") and distances[source] + weight < distances[target]:
                distances[target] = distances[source] + weight
                updated = True
        if not updated:
            break

    has_negative_cycle = False
    for source, target, weight in edges:
        if distances[source] != float("inf") and distances[source] + weight < distances[target]:
            has_negative_cycle = True
            break

    return distances, has_negative_cycle
```

---

## Floyd-Warshall

### When it applies

Use Floyd-Warshall when you need all-pairs shortest paths and the graph
 is small enough for $O(V^3)$ time.

### Core idea

Dynamic programming over allowed intermediate vertices.

At stage `k`, ask:

> Is the shortest path from `i` to `j` better if it is allowed to go
> through vertex `k`?

$$
dist[i][j] = \min(dist[i][j], dist[i][k] + dist[k][j])
$$

This is elegant, dense, and powerful.

### Step-by-Step Trace

```
  Graph (4 nodes, directed):
  0 --5--> 1
  0 --10-> 3
  1 --3--> 2
  2 --1--> 3
  1 --9--> 3

  Initial distance matrix:
      0    1    2    3
  0 [ 0,   5,   ∞,  10 ]
  1 [ ∞,   0,   3,   9 ]
  2 [ ∞,   ∞,   0,   1 ]
  3 [ ∞,   ∞,   ∞,   0 ]

  k=0 (allow paths through node 0):
    Nothing improves — node 0 has no incoming edges from others.

  k=1 (allow paths through node 1):
    Check 0->1->2: dist[0][1] + dist[1][2] = 5 + 3 = 8 < ∞
      → dist[0][2] = 8
    Check 0->1->3: dist[0][1] + dist[1][3] = 5 + 9 = 14 > 10
      → no change

    Matrix:
      0 [ 0,   5,   8,  10 ]

  k=2 (allow paths through node 2):
    Check 0->2->3: dist[0][2] + dist[2][3] = 8 + 1 = 9 < 10
      → dist[0][3] = 9
    Check 1->2->3: dist[1][2] + dist[2][3] = 3 + 1 = 4 < 9
      → dist[1][3] = 4

    Matrix:
      0 [ 0,   5,   8,   9 ]
      1 [ ∞,   0,   3,   4 ]

  k=3 (allow paths through node 3):
    Nothing improves — node 3 has no outgoing edges.

  Final all-pairs shortest paths:
      0 [ 0,   5,   8,   9 ]
      1 [ ∞,   0,   3,   4 ]
      2 [ ∞,   ∞,   0,   1 ]
      3 [ ∞,   ∞,   ∞,   0 ]
```

Notice how allowing intermediate nodes progressively builds shorter paths. The final matrix contains every shortest path in one table.

---

## A* Search

### When it applies

Use A* when you want one source-to-target shortest path and you have a
 useful heuristic `h(n)` estimating remaining distance.

### Core idea

Prioritize nodes by:

$$
f(n) = g(n) + h(n)
$$

where:

- `g(n)` is known cost so far
- `h(n)` is estimated cost to target

### Why it helps

A* pushes search toward the goal instead of expanding evenly in all
 directions like Dijkstra.

In a grid, Manhattan distance is a common heuristic.

```
  Grid with obstacles (#):
  S . . # . . .
  . # . # . . .
  . . . . . # .
  . # # . . . T

  Dijkstra expands in a circle from S.
  A* prioritizes cells closer to T, skipping many dead-end explorations.
```

### What makes a good heuristic?

- **Admissible**: never overestimates the true cost (h(n) ≤ true cost)
- **Consistent**: h(u) ≤ cost(u,v) + h(v) for every edge

If admissible, A* is guaranteed optimal. If also consistent, it is optimally efficient among all optimal algorithms.

---

## BFS on Weighted Graphs?

### What if we ran BFS on a weighted graph?

That only works when all edges have equal weight.

```
  A --1--> B --1--> D
  A --5--> C --1--> D

  BFS sees both A->B->D and A->C->D as two-edge paths.
  But costs are 2 and 6. BFS cannot tell the difference.
```

Weighted graphs need algorithms that track cost, not just edge count.

---

## TypeScript Examples

```typescript
function dijkstra(graph: Record<string, Array<[string, number]>>, start: string): Record<string, number> {
  const distances: Record<string, number> = { [start]: 0 };
  const heap: Array<[number, string]> = [[0, start]];

  while (heap.length > 0) {
    heap.sort((first, second) => first[0] - second[0]);
    const [cost, node] = heap.shift() as [number, string];

    if (cost > (distances[node] ?? Number.POSITIVE_INFINITY)) {
      continue;
    }

    for (const [neighbor, weight] of graph[node] ?? []) {
      const newCost = cost + weight;
      if (newCost < (distances[neighbor] ?? Number.POSITIVE_INFINITY)) {
        distances[neighbor] = newCost;
        heap.push([newCost, neighbor]);
      }
    }
  }

  return distances;
}
```

```typescript
function bellmanFord(
  vertices: string[],
  edges: Array<[string, string, number]>,
  start: string,
): { distances: Record<string, number>; hasNegativeCycle: boolean } {
  const distances: Record<string, number> = Object.fromEntries(
    vertices.map((vertex) => [vertex, Number.POSITIVE_INFINITY]),
  );
  distances[start] = 0;

  for (let pass = 0; pass < vertices.length - 1; pass += 1) {
    let updated = false;
    for (const [source, target, weight] of edges) {
      if (distances[source] !== Number.POSITIVE_INFINITY && distances[source] + weight < distances[target]) {
        distances[target] = distances[source] + weight;
        updated = true;
      }
    }
    if (!updated) {
      break;
    }
  }

  let hasNegativeCycle = false;
  for (const [source, target, weight] of edges) {
    if (distances[source] !== Number.POSITIVE_INFINITY && distances[source] + weight < distances[target]) {
      hasNegativeCycle = true;
      break;
    }
  }

  return { distances, hasNegativeCycle };
}
```

---

## Rust Example

```rust
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

fn dijkstra(graph: &HashMap<&str, Vec<(&str, i32)>>, start: &str) -> HashMap<String, i32> {
    let mut distances = HashMap::from([(start.to_string(), 0)]);
    let mut heap = BinaryHeap::from([Reverse((0, start.to_string()))]);

    while let Some(Reverse((cost, node))) = heap.pop() {
        if cost > *distances.get(&node).unwrap_or(&i32::MAX) {
            continue;
        }

        if let Some(neighbors) = graph.get(node.as_str()) {
            for &(neighbor, weight) in neighbors {
                let new_cost = cost + weight;
                let current = *distances.get(neighbor).unwrap_or(&i32::MAX);
                if new_cost < current {
                    distances.insert(neighbor.to_string(), new_cost);
                    heap.push(Reverse((new_cost, neighbor.to_string())));
                }
            }
        }
    }

    distances
}
```

---

## Algorithm Selection Guide

```
  CONDITION                                 ALGORITHM

  Non-negative weights, single source       Dijkstra
  Negative weights possible, single source  Bellman-Ford
  All-pairs shortest paths, small graph     Floyd-Warshall
  Single target, good heuristic available   A*
  Unweighted graph, shortest path           BFS
```

---

## Exercises

1. Explain why Dijkstra's greedy choice depends on non-negative edges. What exactly breaks when negative edges exist?

2. Give a graph where BFS fails but Dijkstra succeeds. Trace both algorithms.

3. Explain how Bellman-Ford detects a negative cycle. Why does the V-th pass matter?

4. When would Floyd-Warshall be preferable to repeated Dijkstra? Consider both time complexity and implementation simplicity.

5. Give an example of a good heuristic for A* on a grid. Prove it is admissible.

6. Trace Floyd-Warshall on a 3-node triangle graph with weights 1, 2, and 3. Show the matrix after each k.

7. Why does Bellman-Ford need V-1 passes? Construct a graph where the shortest path uses exactly V-1 edges.

8. In Dijkstra, what happens if you use a regular queue instead of a priority queue? Trace it on a small weighted graph.

---

## Key Takeaways

- Dijkstra is the standard choice for non-negative weighted graphs.
- Bellman-Ford handles negative edges and can detect negative cycles.
- Floyd-Warshall solves all-pairs shortest paths with dense dynamic
  programming.
- A* uses heuristics to focus the search toward a target.
- Shortest path algorithms differ because graph assumptions differ.
- Negative edges break greedy finalization; Bellman-Ford replaces it with repeated relaxation.

The next lesson covers a different graph optimization problem:
 connecting all vertices as cheaply as possible with a minimum spanning
 tree.

---

**Previous**: [Lesson 27 — Graph Traversals — BFS and DFS](./27-bfs-dfs.md)
**Next**: [Lesson 29 — Minimum Spanning Trees — Kruskal's and Prim's](./29-minimum-spanning-trees.md)
