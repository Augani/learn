# Lesson 27: Graph Traversals — BFS and DFS

> **Analogy**: In a maze, BFS behaves like water spreading through
> every corridor at once, while DFS behaves like a person picking one
> hallway and following it as far as possible before backtracking.
> Both visit the graph. They just ask different questions while doing it.

---

## Why This Matters

Most graph algorithms are built from just two traversal ideas:

- **Breadth-first search (BFS)**: explores layer by layer, guaranteeing
  shortest paths in unweighted graphs
- **Depth-first search (DFS)**: explores deeply before backtracking,
  ideal for structural reasoning and connectivity

These two traversals power a surprising range of problems:

- **Connected components**: which nodes can reach each other?
- **Shortest paths in unweighted graphs**: minimum number of hops between
  two points
- **Cycle detection**: does the graph contain a loop?
- **Bipartite checks**: can nodes be colored with two colors such that no
  edge connects same-colored nodes?
- **Topological sorting**: what order should tasks run given dependencies?
- **Strongly connected components (SCCs)**: which groups of nodes form
  mutually reachable clusters?

If trees taught you traversal, graphs teach you why **traversal order**
changes the kind of structure you discover. BFS and DFS are not just
ways to visit nodes — they are lenses that reveal different properties
of the graph.

---

## The Maze Analogy — Deeper

Imagine you are lost in a hedge maze and your friend is at the exit.

**BFS (Water Spreading)**
You send out scouts in all directions simultaneously. After 1 minute, every corridor 1 step from the entrance is checked. After 2 minutes, every corridor 2 steps away is checked. The first scout to reach your friend guarantees they found the shortest route.

**DFS (Persistent Explorer)**
You pick one corridor and walk until you hit a dead end. Then you backtrack to the last intersection and try the next unexplored corridor. You might find your friend quickly — or you might wander deep into a long blind alley before trying the direct path.

The key difference is not whether they find the exit. It is **what they guarantee**:
- BFS guarantees the shortest path in an unweighted maze
- DFS guarantees every reachable corridor is eventually explored

This difference shapes every algorithm built on top of them.

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

  Pop D, no new neighbors
  queue = [E, F]

  Pop E, no new neighbors
  queue = [F]

  Pop F, no new neighbors
  queue = []
  
  Done. Visited order: A, B, C, D, E, F
```

### Why BFS finds shortest paths in unweighted graphs

Because it reaches nodes in increasing number of edges from the
 source. The first time you see a node, you have found the shortest
 unweighted path to it.

**Proof sketch:** Suppose BFS reaches node X at distance d. Any other path to X must pass through some node at distance d-1. But BFS already processed all nodes at distance d-1 before touching distance d. Therefore no shorter path could exist.

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
  pop D, no children
  stack = [C, E]
  pop E, no children
  stack = [C]
  pop C, push F
  stack = [F]
  pop F, no children
  stack = []
  
  Done. Visited order: A, B, D, E, C, F
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

This is not a theoretical quibble. In unweighted routing, using DFS
 could route a packet through 10 hops when a direct 1-hop link exists.

### What if the graph is very deep?

Recursive DFS may overflow the call stack. An explicit stack is safer:

```python
def dfs_iterative(graph: dict[str, list[str]], start: str) -> list[str]:
    stack = [start]
    visited: set[str] = set()
    order: list[str] = []

    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        for neighbor in reversed(graph.get(node, [])):
            if neighbor not in visited:
                stack.append(neighbor)

    return order
```

The `reversed()` is only needed if you want to mimic recursive order.

---

## Classic Applications

### Connected components

Run BFS or DFS from each unvisited node. Every traversal marks one
 component.

```
  Graph:   A -- B    C -- D -- E    F

  Component 1: A, B
  Component 2: C, D, E
  Component 3: F
```

### Cycle detection

In undirected graphs, track parent edges.

In directed graphs, DFS can track recursion-stack state:

```
  WHITE = unvisited
  GRAY  = currently being processed (in recursion stack)
  BLACK = fully processed

  If DFS reaches a GRAY node, a cycle exists.
```

### Bipartiteness

Color nodes with two colors while traversing.

If an edge connects same-colored nodes, the graph is not bipartite.

```
  Bipartite:        Not bipartite:
  A -- B            A -- B
  |    |             \  /
  C -- D              C
```

---

## Iterative Deepening

Iterative deepening DFS runs depth-limited DFS multiple times with
 increasing depth limits.

It combines:

- DFS's low memory usage
- BFS's layered search order

It is useful when the solution is shallow but memory is tight.

```
  Limit 1: explore nodes within 1 edge of start
  Limit 2: explore nodes within 2 edges of start
  Limit 3: explore nodes within 3 edges of start
  ...
```

The overhead of re-exploring early layers is small compared to the
 exponential growth of deeper layers.

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

BFS discovers proximity first. DFS discovers depth first.

---

## Exercises

1. Explain why BFS needs a queue and DFS needs a stack-like behavior. What would happen if you swapped them?

2. Give a graph where DFS finds a path but not the shortest path. Trace both BFS and DFS on it.

3. Modify BFS to return distances from the source to every reachable node.

4. Describe how to count connected components with DFS. Trace it on a graph with 3 components.

5. Explain how traversal changes on directed vs undirected graphs. What new complication arises with directed edges?

6. Implement cycle detection for an undirected graph using DFS. What special case must you handle?

7. Why does iterative deepening DFS not waste too much time re-exploring shallow layers? Use the branching factor in your answer.

8. In a directed graph, explain why the "parent edge" rule for cycle detection is not enough. What extra state do you need?

---

## Key Takeaways

- BFS explores by distance layers and finds shortest paths in
  unweighted graphs.
- DFS explores deeply before backtracking and is natural for
  structural graph reasoning.
- The right traversal depends on what property you need, not which
  one is simpler to code.
- Many advanced graph algorithms are just BFS or DFS plus extra state.
- Iterative deepening combines BFS's completeness with DFS's memory efficiency.

The next lesson moves from traversal to optimization: shortest path
 algorithms on weighted graphs.

---

**Previous**: [Lesson 26 — Graph Representations](./26-graph-representations.md)
**Next**: [Lesson 28 — Shortest Path Algorithms](./28-shortest-paths.md)
