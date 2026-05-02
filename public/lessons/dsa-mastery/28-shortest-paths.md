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

---

## Bellman-Ford

### When it applies

Use Bellman-Ford when negative edges may exist.

### Core idea

Repeat relaxation over all edges `V - 1` times.

Why `V - 1`? A shortest simple path uses at most `V - 1` edges.

### Negative cycle detection

If one more full relaxation still improves some distance, then a
negative cycle is reachable.

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

## Cross-Reference

For a focused introduction to Dijkstra's algorithm, see
[../data-structures/13-shortest-path.md](../data-structures/13-shortest-path.md).

---

## Exercises

1. Explain why Dijkstra's greedy choice depends on non-negative edges.
2. Give a graph where BFS fails but Dijkstra succeeds.
3. Explain how Bellman-Ford detects a negative cycle.
4. When would Floyd-Warshall be preferable to repeated Dijkstra?
5. Give an example of a good heuristic for A* on a grid.

---

## Key Takeaways

- Dijkstra is the standard choice for non-negative weighted graphs.
- Bellman-Ford handles negative edges and can detect negative cycles.
- Floyd-Warshall solves all-pairs shortest paths with dense dynamic
  programming.
- A* uses heuristics to focus the search toward a target.
- Shortest path algorithms differ because graph assumptions differ.

The next lesson covers a different graph optimization problem:
connecting all vertices as cheaply as possible with a minimum spanning
tree.

---

**Previous**: [Lesson 27 — Graph Traversals — BFS and DFS](./27-bfs-dfs.md)
**Next**: [Lesson 29 — Minimum Spanning Trees — Kruskal's and Prim's](./29-minimum-spanning-trees.md)