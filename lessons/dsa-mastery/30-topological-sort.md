# Lesson 30: Topological Sort

> **Analogy**: Getting dressed is a dependency problem. Socks must come
> before shoes. Underwear before pants. A topological ordering is any
> order that respects all such constraints.

---

## Why This Matters

Topological sort is one of the most practically useful graph algorithms.
It appears whenever tasks have prerequisites that must be satisfied in
order:

- **Build systems**: Make, Gradle, and npm must compile source files in
  an order that respects dependencies — a module cannot be built before
  its dependencies are ready
- **Course scheduling**: Universities use topological sorts to ensure
  students take prerequisite courses before advanced ones
- **Package dependency resolution**: When you install a Python package
  with pip or a JavaScript package with npm, the resolver must install
  dependencies before the packages that need them
- **Pipeline execution**: Data processing workflows, CI/CD pipelines, and
  ETL jobs must run stages in an order that respects data flow
  dependencies
- **Spreadsheet formula evaluation**: Excel and similar tools must
  evaluate cells in an order where each formula's inputs are computed
  before the formula itself
- **Deadlock detection**: In operating systems, resource allocation
  graphs with cycles indicate deadlock; topological sort confirms
  acyclicity

It only makes sense on a **directed acyclic graph (DAG)**.

If a directed cycle exists, there is no valid ordering — you would
need A before B, B before C, and C before A simultaneously, which is
impossible.

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

Notice that the ordering is not necessarily unique. If two vertices
have no path between them (like A and B above), their relative order
does not matter. This flexibility is both a feature and a source of
subtle bugs — some applications need a specific topological order, not
just any valid one.

---

## The Getting Dressed Analogy — Deeper

Think about getting dressed in the morning. Some items have clear
prerequisites:

```
  DEPENDENCY GRAPH FOR GETTING DRESSED

  underwear -----> pants -----> belt
      |              |
      |              v
      |           shoes
      |
      v
    socks -----> shoes

  shirt --------> tie --------> jacket
      |                          ^
      |                          |
      +--------------------------+
```

Rules:
- You cannot put on shoes before socks
- You cannot put on pants before underwear
- You cannot put on a belt before pants
- You cannot put on a jacket before a shirt and tie

A topological sort gives any valid order:

```
  ONE VALID ORDER:
  underwear, socks, shirt, pants, tie, belt, shoes, jacket

  ANOTHER VALID ORDER:
  shirt, underwear, socks, tie, pants, belt, shoes, jacket
```

Both are correct because socks and shirt have no dependency between
them. But there is no valid order that puts shoes before socks — that
would violate a direct edge in the DAG.

This analogy also explains why cycles break topological sort:

```
  socks -> shoes -> socks

  IMPOSSIBLE: shoes require socks, but socks somehow require shoes.
  This cycle means no valid dressing order exists.
```

In real systems, detecting such cycles is critical — a package manager
must refuse to install circular dependencies rather than loop forever.

---

## Kahn's Algorithm

### Core idea

Any node with in-degree `0` has no remaining prerequisites, so it can
be placed next in the order immediately.

Algorithm:

1. Compute every node's in-degree (count of incoming edges)
2. Put all in-degree-0 nodes in a queue
3. Repeatedly remove one, append it to the order, and reduce the
   in-degree of its outgoing neighbors
4. If a neighbor's in-degree drops to 0, it has no remaining
   prerequisites — add it to the queue

### Detailed trace

```
  Graph:
  A -> C <- B
       |
       v
       D

  Step 0: Compute in-degrees
    A: 0 (no incoming edges)
    B: 0 (no incoming edges)
    C: 2 (edges from A and B)
    D: 1 (edge from C)

  Step 1: Queue all in-degree-0 nodes
    Queue: [A, B]
    Order: []

  Step 2: Pop A from queue
    Order: [A]
    Reduce in-degree of A's neighbors:
      C: 2 -> 1 (not zero, don't enqueue)
    Queue: [B]

  Step 3: Pop B from queue
    Order: [A, B]
    Reduce in-degree of B's neighbors:
      C: 1 -> 0 (now enqueue C!)
    Queue: [C]

  Step 4: Pop C from queue
    Order: [A, B, C]
    Reduce in-degree of C's neighbors:
      D: 1 -> 0 (now enqueue D!)
    Queue: [D]

  Step 5: Pop D from queue
    Order: [A, B, C, D]
    D has no outgoing neighbors.
    Queue: []

  Done! Queue is empty and all 4 nodes were processed.
```

### Cycle detection

If the processed-node count is smaller than the total number of nodes,
a cycle exists. The remaining nodes all have in-degree > 0 — every
node in the cycle depends on another node in the cycle, so none can ever
reach in-degree 0.

### Why Kahn's algorithm works

Every time we output a node, we remove it and its outgoing edges from
the graph. Nodes only enter the queue when all their prerequisites
have been removed. Because the graph is a DAG, at least one node
always has in-degree 0, so the queue never empties prematurely unless
a cycle exists.

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

Run DFS from every unvisited node. After completely exploring all of a
node's descendants, append the node to a list. Reversing that finish
order gives a topological sort.

Why it works:

- If `u -> v`, then any DFS starting from `u` must visit `v` before it
  can finish `u`
- So `v` is appended to the list before `u`
- Reversing the list puts `u` before `v`, satisfying the edge constraint

### Detailed trace

```
  Graph:  A -> C <- B
               |
               v
               D

  DFS from A:
    visit A -> visit C -> visit D -> append D
                     <- back to C -> append C
           <- back to A -> append A

  DFS from B:
    visit B -> C already visited -> append B

  Append order: [D, C, A, B]
  Reverse:      [B, A, C, D]

  Check: A before C? Yes (positions 1 and 2)
         B before C? Yes (positions 0 and 2)
         C before D? Yes (positions 2 and 3)
```

Notice the DFS order and Kahn's order may differ — both are valid
topological sorts.

### Directed cycle detection

Use three color states:

- **White (0)**: unvisited — node has not been seen
- **Gray (1)**: visiting — node is on the current DFS recursion stack
- **Black (2)**: visited — node and all descendants fully explored

If DFS reaches a gray node, that node is an ancestor in the current
call stack. The path from that ancestor back to itself forms a cycle:

```
  A -> B -> C -> A

  DFS stack when cycle is detected:
    visit A (gray)
      visit B (gray)
        visit C (gray)
          visit A (already gray!) -> CYCLE DETECTED
```

This three-state coloring is more precise than Kahn's simple count
because it pinpoints exactly which nodes participate in the cycle.

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
  iteratively processes nodes         recursively explores paths
  queue-driven                      recursion / stack-driven
  naturally signals cycle via       naturally signals cycle via
  remaining unprocessed nodes       gray-node detection
  easier to trace step-by-step      elegant for graph reasoning
  preferred for iterative builds    preferred for detecting cycles
```

Both are standard. Learn both. Kahn's algorithm is often preferred in
build systems because it naturally produces a working queue of ready
tasks. DFS-based ordering is elegant and pairs naturally with other
DFS applications like strongly connected components.

---

## Complexity Summary

```
  ┌─────────────────┬─────────────────┬─────────────────┐
  │ Algorithm       │ Time            │ Space           │
  ├─────────────────┼─────────────────┼─────────────────┤
  │ Kahn's          │ O(V + E)        │ O(V) queue +    │
  │                 │                 │ O(V) in-degree  │
  │ DFS-based       │ O(V + E)        │ O(V) recursion  │
  │                 │                 │ stack + O(V)    │
  │                 │                 │ output list     │
  └─────────────────┴─────────────────┴─────────────────┘

  Both algorithms are linear in the size of the graph.
  The choice between them is usually based on coding style
  and whether you need cycle path reporting (DFS is better).
```

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

1. Explain why topological sort only works on DAGs. What goes wrong if
   a cycle exists?
2. Walk through Kahn's algorithm step-by-step on a four-node dependency
   graph of your choice, showing in-degrees and queue state at each step.
3. Explain how DFS finish order produces a topological ordering. Why
   is the reverse of finish order correct?
4. Describe how cycle detection differs in Kahn's algorithm versus DFS.
   Which one tells you exactly which nodes are in the cycle?
5. Give two valid topological orders for the same DAG. Explain why
   multiple valid orders exist.
6. A build system uses Kahn's algorithm. Task A takes 5 minutes, task
   B takes 3 minutes, and both are prerequisites for task C. Does
   Kahn's algorithm minimize total build time? Why or why not?
7. Design a small DAG where Kahn's algorithm and DFS produce
   *different* topological orders. Show both outputs.
8. Explain why the number of possible topological orderings can grow
   factorially with the number of vertices.

---

## Key Takeaways

- A **topological sort** orders the vertices of a DAG so every directed
  edge `u -> v` places `u` before `v`.
- The ordering is not necessarily unique. Any DAG may have many valid
  topological orders.
- **Kahn's algorithm** iteratively removes in-degree-0 nodes, reduces
  neighbor in-degrees, and detects cycles when unprocessed nodes remain.
- **DFS-based topological sort** appends nodes after fully exploring
descendants, then reverses. Three-state coloring (white/gray/black)
pinpoints exact cycle paths.
- Directed cycles make topological ordering impossible because every
  node in a cycle is a prerequisite for another node in the same
cycle.
- Topological sort is foundational for build systems, course
  scheduling, package managers, pipeline execution, and spreadsheet
  evaluation.
- Both Kahn's and DFS-based approaches run in `O(V + E)` time.

The next lesson introduces union-find, a compact structure that powers
component tracking and Kruskal's MST.

---

**Previous**: [Lesson 29 — Minimum Spanning Trees — Kruskal's and Prim's](./29-minimum-spanning-trees.md)
**Next**: [Lesson 31 — Union-Find (Disjoint Set Union)](./31-union-find.md)