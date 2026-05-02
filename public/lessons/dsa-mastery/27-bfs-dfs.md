# Lesson 27: Graph Traversals — BFS and DFS

> **Analogy**: In a maze, BFS behaves like water spreading through
> every corridor at once, while DFS behaves like a person picking one
> hallway and following it as far as possible before backtracking.
> Both visit the graph. They just ask different questions while doing it.

---

## Why This Matters

Most graph algorithms are built from just two traversal ideas:

- breadth-first search
- depth-first search

These power:

- connected components
- shortest paths in unweighted graphs
- cycle detection
- bipartite checks
- topological sorting
- SCC algorithms

If trees taught you traversal, graphs teach you why traversal order
changes the kind of structure you discover.

---

## BFS — Breadth-First Search

### Core idea

Visit nodes in order of increasing distance from the start.

That means BFS explores layer by layer.

```
          A
        /   \
       B     C
      / \     \
     D   E     F

  BFS from A:
  Level 0: A
  Level 1: B, C
  Level 2: D, E, F
```

### Data structure

BFS uses a queue.

```
  Start:
  queue = [A]

  Pop A, push B, C
  queue = [B, C]

  Pop B, push D, E
  queue = [C, D, E]

  Pop C, push F
  queue = [D, E, F]
```

### Why BFS finds shortest paths in unweighted graphs

Because it reaches nodes in increasing number of edges from the
source. The first time you see a node, you have found the shortest
unweighted path to it.

#### Python

```python
from collections import deque


def bfs(graph: dict[str, list[str]], start: str) -> list[str]:
    visited = {start}
    queue = deque([start])
    order: list[str] = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    return order
```

#### TypeScript

```typescript
function bfs(graph: Record<string, string[]>, start: string): string[] {
  const visited = new Set<string>([start]);
  const queue: string[] = [start];
  const order: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) {
      break;
    }
    order.push(node);

    for (const neighbor of graph[node] ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return order;
}
```

#### Rust

```rust
use std::collections::{HashMap, HashSet, VecDeque};

fn bfs(graph: &HashMap<&str, Vec<&str>>, start: &str) -> Vec<String> {
    let mut visited = HashSet::from([start.to_string()]);
    let mut queue = VecDeque::from([start.to_string()]);
    let mut order = Vec::new();

    while let Some(node) = queue.pop_front() {
        order.push(node.clone());
        if let Some(neighbors) = graph.get(node.as_str()) {
            for &neighbor in neighbors {
                if visited.insert(neighbor.to_string()) {
                    queue.push_back(neighbor.to_string());
                }
            }
        }
    }

    order
}
```

---

## DFS — Depth-First Search

### Core idea

Go as deep as possible before backtracking.

```
          A
        /   \
       B     C
      / \     \
     D   E     F

  One DFS order from A:
  A, B, D, E, C, F
```

DFS can be implemented with:

- recursion
- an explicit stack

### Stack intuition

```
  stack = [A]
  pop A, push C, B
  stack = [C, B]
  pop B, push E, D
  stack = [C, E, D]
```

DFS does not guarantee shortest paths in general. It explores a path,
not a distance frontier.

#### Python

```python
def dfs(graph: dict[str, list[str]], start: str) -> list[str]:
    visited: set[str] = set()
    order: list[str] = []

    def visit(node: str) -> None:
        visited.add(node)
        order.append(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visit(neighbor)

    visit(start)
    return order
```

#### TypeScript

```typescript
function dfs(graph: Record<string, string[]>, start: string): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(node: string): void {
    visited.add(node);
    order.push(node);

    for (const neighbor of graph[node] ?? []) {
      if (!visited.has(neighbor)) {
        visit(neighbor);
      }
    }
  }

  visit(start);
  return order;
}
```

#### Rust

```rust
use std::collections::{HashMap, HashSet};

fn dfs(graph: &HashMap<&str, Vec<&str>>, start: &str) -> Vec<String> {
    fn visit(
        graph: &HashMap<&str, Vec<&str>>,
        node: &str,
        visited: &mut HashSet<String>,
        order: &mut Vec<String>,
    ) {
        visited.insert(node.to_string());
        order.push(node.to_string());

        if let Some(neighbors) = graph.get(node) {
            for &neighbor in neighbors {
                if !visited.contains(neighbor) {
                    visit(graph, neighbor, visited, order);
                }
            }
        }
    }

    let mut visited = HashSet::new();
    let mut order = Vec::new();
    visit(graph, start, &mut visited, &mut order);
    order
}
```

---

## BFS vs DFS

```
  QUESTION                                  TRAVERSAL

  shortest path in unweighted graph         BFS
  connected components                      either
  bipartite check                           BFS or DFS
  cycle detection in directed graph         DFS
  topological reasoning                     DFS or Kahn's BFS
```

### What if we used DFS to find shortest paths?

DFS might find a path quickly, but not the shortest one. It commits to
depth before considering all paths with fewer edges.

```
  A -- B -- C -- D
   \
    E

  If target is E, DFS might first walk A-B-C-D before ever checking E.
  BFS finds E immediately at distance 1.
```

---

## Classic Applications

### Connected components

Run BFS or DFS from each unvisited node. Every traversal marks one
component.

### Cycle detection

In undirected graphs, track parent edges.

In directed graphs, DFS can track recursion-stack state.

### Bipartiteness

Color nodes with two colors while traversing.

If an edge connects same-colored nodes, the graph is not bipartite.

---

## Iterative Deepening

Iterative deepening DFS runs depth-limited DFS multiple times with
increasing depth limits.

It combines:

- DFS's low memory usage
- BFS's layered search order

It is useful when the solution is shallow but memory is tight.

---

## ASCII Traversal Trace

```
  Graph:
      A
     / \
    B   C
   / \   \
  D   E   F

  BFS order: A, B, C, D, E, F
  DFS order: A, B, D, E, C, F
```

The traversal order is not cosmetic. It determines what structure the
algorithm exposes first.

---

## Exercises

1. Explain why BFS needs a queue and DFS needs a stack-like behavior.
2. Give a graph where DFS finds a path but not the shortest path.
3. Modify BFS to return distances from the source.
4. Describe how to count connected components with DFS.
5. Explain how traversal changes on directed vs undirected graphs.

---

## Key Takeaways

- BFS explores by distance layers and finds shortest paths in
  unweighted graphs.
- DFS explores deeply before backtracking and is natural for
  structural graph reasoning.
- The right traversal depends on what property you need, not which
  one is simpler to code.
- Many advanced graph algorithms are just BFS or DFS plus extra state.

The next lesson moves from traversal to optimization: shortest path
algorithms on weighted graphs.

---

**Previous**: [Lesson 26 — Graph Representations](./26-graph-representations.md)
**Next**: [Lesson 28 — Shortest Path Algorithms](./28-shortest-paths.md)