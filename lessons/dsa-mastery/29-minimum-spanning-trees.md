# Lesson 29: Minimum Spanning Trees — Kruskal's and Prim's

> **Analogy**: Suppose you must connect a set of cities with roads so
> every city is reachable, but you want the total cost to be as small
> as possible. You do not need every possible road. You need just enough
> roads to connect everything, and no cycles wasting cost.

---

## Why This Matters

Minimum spanning trees appear in:

- network design
- clustering
- circuit layout
- map simplification
- approximation algorithms

The problem is different from shortest paths.

- shortest paths optimize from one source outward
- MST optimizes the total cost of connecting the whole graph

---

## What Is a Spanning Tree?

A spanning tree of a connected undirected graph:

- includes all vertices
- has no cycles
- has exactly `V - 1` edges

A **minimum** spanning tree is the spanning tree with the smallest total
edge weight.

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

## Kruskal's Algorithm

### Core idea

Sort edges from cheapest to most expensive. Add an edge if it connects
two different components.

To test whether an edge would create a cycle efficiently, use
union-find.

### Step-by-step

```
  Sorted edges:
  (A, B, 1)
  (B, D, 2)
  (C, D, 3)
  (A, C, 4)

  Pick A-B
  Pick B-D
  Pick C-D
  Stop after V-1 edges
```

### Why it works

Kruskal is justified by the **cut property**: the lightest edge across
a cut is always safe to add.

#### Python

```python
def kruskal(
    vertices: list[str],
    edges: list[tuple[int, str, str]],
) -> list[tuple[int, str, str]]:
    parent = {vertex: vertex for vertex in vertices}
    rank = {vertex: 0 for vertex in vertices}

    def find(vertex: str) -> str:
        if parent[vertex] != vertex:
            parent[vertex] = find(parent[vertex])
        return parent[vertex]

    def union(first: str, second: str) -> bool:
        root_first = find(first)
        root_second = find(second)
        if root_first == root_second:
            return False
        if rank[root_first] < rank[root_second]:
            root_first, root_second = root_second, root_first
        parent[root_second] = root_first
        if rank[root_first] == rank[root_second]:
            rank[root_first] += 1
        return True

    mst: list[tuple[int, str, str]] = []
    for weight, source, target in sorted(edges):
        if union(source, target):
            mst.append((weight, source, target))
    return mst
```

---

## Prim's Algorithm

### Core idea

Grow one connected tree outward from a starting vertex, always adding
the cheapest edge that brings in a new vertex.

### Intuition

Kruskal thinks globally about edges.

Prim thinks locally about the current frontier.

```
  Start at A
  frontier edges: A-B (1), A-C (4)
  pick A-B

  new frontier: A-C (4), B-D (2)
  pick B-D

  new frontier: A-C (4), D-C (3)
  pick D-C
```

#### TypeScript

```typescript
function prim(graph: Record<string, Array<[string, number]>>, start: string): Array<[string, string, number]> {
  const visited = new Set<string>([start]);
  const edges: Array<[number, string, string]> = (graph[start] ?? []).map(([neighbor, weight]) => [weight, start, neighbor]);
  const mst: Array<[string, string, number]> = [];

  while (edges.length > 0) {
    edges.sort((first, second) => first[0] - second[0]);
    const [weight, source, target] = edges.shift() as [number, string, string];
    if (visited.has(target)) {
      continue;
    }

    visited.add(target);
    mst.push([source, target, weight]);

    for (const [neighbor, nextWeight] of graph[target] ?? []) {
      if (!visited.has(neighbor)) {
        edges.push([nextWeight, target, neighbor]);
      }
    }
  }

  return mst;
}
```

---

## Kruskal vs Prim

```
  KRUSKAL                           PRIM

  sorts all edges                   grows one tree
  uses union-find                   uses priority queue / frontier
  natural on edge lists             natural on adjacency lists
```

Both are greedy. Both are correct. They just express the greedy choice
in different ways.

### What if we just picked the globally cheapest edges?

That fails if we ignore cycle checks.

```
  Triangle:
  A-B (1), B-C (2), A-C (3)

  Picking cheapest edges blindly works here.
  But on larger graphs, you can waste edges on cycles and fail to
  connect some vertex that needs a slightly more expensive bridge.
```

---

## Rust Example

```rust
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap, HashSet};

fn prim(graph: &HashMap<&str, Vec<(&str, i32)>>, start: &str) -> Vec<(String, String, i32)> {
    let mut visited = HashSet::from([start.to_string()]);
    let mut heap = BinaryHeap::new();
    let mut mst = Vec::new();

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
                    heap.push(Reverse((next_weight, target.clone(), neighbor.to_string())));
                }
            }
        }
    }

    mst
}
```

---

## Exercises

1. Explain why every spanning tree has exactly `V - 1` edges.
2. Explain why Kruskal needs cycle detection.
3. Describe how Prim changes if the graph is disconnected.
4. Compare when an edge list favors Kruskal over Prim.
5. State the cut property in your own words.

---

## Key Takeaways

- MSTs connect all vertices with minimum total weight.
- Kruskal grows a forest by adding safe edges in sorted order.
- Prim grows one tree from a starting vertex using the cheapest
  frontier edge.
- Cycle checks are essential; greed without structural constraints is
  wrong.
- MST and shortest path are different optimization goals.

The next lesson turns from undirected optimization to directed
dependency ordering with topological sort.

---

**Previous**: [Lesson 28 — Shortest Path Algorithms](./28-shortest-paths.md)
**Next**: [Lesson 30 — Topological Sort](./30-topological-sort.md)