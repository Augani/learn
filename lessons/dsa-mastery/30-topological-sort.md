# Lesson 30: Topological Sort

> **Analogy**: Getting dressed is a dependency problem. Socks must come
> before shoes. Underwear before pants. A topological ordering is any
> order that respects all such constraints.

---

## Why This Matters

Topological sort appears whenever tasks have prerequisites:

- build systems
- course scheduling
- package dependency resolution
- pipeline execution

It only makes sense on a **directed acyclic graph**.

If a directed cycle exists, there is no valid ordering.

---

## The Problem

Given a DAG, produce an ordering of vertices such that every edge
`u -> v` places `u` before `v`.

```
  A -> C
  B -> C
  C -> D

  Valid orders:
  A, B, C, D
  B, A, C, D
```

---

## Kahn's Algorithm

### Core idea

Any node with in-degree `0` has no remaining prerequisites, so it can
be taken now.

Algorithm:

1. compute every node's in-degree
2. put all in-degree-0 nodes in a queue
3. repeatedly remove one, append it to the order, and reduce the
   in-degree of its outgoing neighbors

### Trace

```
  Graph:
  A -> C <- B
       |
       v
       D

  Initial in-degrees:
  A: 0, B: 0, C: 2, D: 1

  Queue: [A, B]
  Pop A -> reduce C to 1
  Queue: [B]
  Pop B -> reduce C to 0, push C
  Queue: [C]
  Pop C -> reduce D to 0, push D
  Queue: [D]
```

If processed-node count is smaller than total nodes, a cycle exists.

#### Python

```python
from collections import deque


def kahn_toposort(graph: dict[str, list[str]]) -> list[str]:
    indegree: dict[str, int] = {node: 0 for node in graph}
    for node, neighbors in graph.items():
        indegree.setdefault(node, 0)
        for neighbor in neighbors:
            indegree[neighbor] = indegree.get(neighbor, 0) + 1

    queue = deque([node for node, degree in indegree.items() if degree == 0])
    order: list[str] = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph.get(node, []):
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)

    return order if len(order) == len(indegree) else []
```

---

## DFS-Based Topological Sort

### Core idea

Run DFS. After finishing a node's descendants, place the node in the
ordering. Reversing that finish order gives a topological sort.

Why it works:

- if `u -> v`, then DFS finishes `v` before `u`
- so reversing finish order puts `u` before `v`

### Directed cycle detection

Use three states:

- unvisited
- visiting
- visited

If DFS reaches a node currently in `visiting`, the graph has a cycle.

#### TypeScript

```typescript
function dfsToposort(graph: Record<string, string[]>): string[] {
  const state = new Map<string, number>();
  const order: string[] = [];

  function visit(node: string): boolean {
    const currentState = state.get(node) ?? 0;
    if (currentState === 1) {
      return false;
    }
    if (currentState === 2) {
      return true;
    }

    state.set(node, 1);
    for (const neighbor of graph[node] ?? []) {
      if (!visit(neighbor)) {
        return false;
      }
    }
    state.set(node, 2);
    order.push(node);
    return true;
  }

  for (const node of Object.keys(graph)) {
    if ((state.get(node) ?? 0) === 0 && !visit(node)) {
      return [];
    }
  }

  order.reverse();
  return order;
}
```

---

## Kahn vs DFS

```
  KAHN'S ALGORITHM                  DFS APPROACH

  based on in-degree                based on finish order
  naturally signals cycle           naturally signals cycle
  queue-driven                      recursion / stack-driven
  useful for scheduling             useful for graph reasoning
```

Both are standard. Learn both.

---

## Rust Example

```rust
use std::collections::{HashMap, VecDeque};

fn kahn_toposort(graph: &HashMap<&str, Vec<&str>>) -> Vec<String> {
    let mut indegree: HashMap<String, i32> = HashMap::new();
    for (&node, neighbors) in graph {
        indegree.entry(node.to_string()).or_insert(0);
        for &neighbor in neighbors {
            *indegree.entry(neighbor.to_string()).or_insert(0) += 1;
        }
    }

    let mut queue = VecDeque::new();
    for (node, degree) in &indegree {
        if *degree == 0 {
            queue.push_back(node.clone());
        }
    }

    let mut order = Vec::new();
    while let Some(node) = queue.pop_front() {
        order.push(node.clone());
        if let Some(neighbors) = graph.get(node.as_str()) {
            for &neighbor in neighbors {
                if let Some(value) = indegree.get_mut(neighbor) {
                    *value -= 1;
                    if *value == 0 {
                        queue.push_back(neighbor.to_string());
                    }
                }
            }
        }
    }

    if order.len() == indegree.len() {
        order
    } else {
        Vec::new()
    }
}
```

---

## Exercises

1. Explain why topological sort only works on DAGs.
2. Walk through Kahn's algorithm on a four-node dependency graph.
3. Explain how DFS finish order produces a topological ordering.
4. Describe how cycle detection differs in Kahn vs DFS.
5. Give two valid topological orders for the same DAG.

---

## Key Takeaways

- Topological sort orders tasks while respecting prerequisites.
- Kahn's algorithm uses in-degree tracking and a queue.
- DFS-based topological sort uses reverse finish order.
- Directed cycles make topological ordering impossible.
- Dependency problems are one of the clearest graph applications.

The next lesson introduces union-find, a compact structure that powers
component tracking and Kruskal's MST.

---

**Previous**: [Lesson 29 — Minimum Spanning Trees — Kruskal's and Prim's](./29-minimum-spanning-trees.md)
**Next**: [Lesson 31 — Union-Find (Disjoint Set Union)](./31-union-find.md)