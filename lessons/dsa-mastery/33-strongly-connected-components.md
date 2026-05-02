# Lesson 33: Strongly Connected Components

> **Analogy**: In a directed graph, a strongly connected component is a
> region where every place can reach every other place by following the
> arrow directions. Outside the region, that mutual reachability breaks.

---

## Why This Matters

SCCs are the directed-graph analogue of connected components, but they
are subtler because edge direction matters.

They appear in:

- dependency condensation graphs
- compiler analyses
- 2-SAT
- deadlock and reachability analysis

---

## Definition

A strongly connected component is a maximal set of vertices such that
every vertex can reach every other vertex in the set.

```
  A -> B -> C
  ^    |    |
  |    v    v
  E <- D <- F

  {A, B, D, E} might form one SCC if all are mutually reachable.
  F may not belong if it cannot be reached back from the others.
```

---

## Kosaraju's Algorithm

### Core idea

1. run DFS on the original graph and record finish order
2. reverse every edge
3. process vertices in reverse finish order on the reversed graph
4. each DFS tree is one SCC

### Intuition

Finish order identifies which component should be processed first after
reversal. The reversal turns incoming reachability into outgoing reachability.

### Trace

```
  Original graph:

  A -> B -> C -> D
  ^    |    ^    |
  |    v    |    v
  F <- E <- G <- H

  Suppose one DFS finish order ends with:
  [D, H, G, C, E, B, F, A]

  Reverse all edges.
  Now process in reverse finish order:
  A, F, B, E, C, G, H, D

  Each DFS on the reversed graph stays inside one SCC before moving to
  the next component.
```

The deep idea is that finish order exposes which component sits "last"
in the original graph, which becomes the right place to start in the
reversed graph.

---

## Tarjan's Algorithm

Tarjan finds SCCs in one DFS pass using:

- discovery indices
- low-link values
- a stack of active nodes

### Low-link idea

`low[node]` is the smallest discovery index reachable from `node`
through tree edges and at most one back edge into the current DFS stack.

If `low[node] == index[node]`, then `node` is the root of an SCC.

### Low-link intuition trace

```
  DFS path: A -> B -> C
                 ^    |
                 |    v
                 E <- D

  If D or E can reach B through a back edge, then low[C] and low[D]
  may drop to B's discovery index.

  But if a subtree cannot reach any earlier active node, its root's
  low-link stays equal to its own discovery index, and that root closes
  an SCC.
```

### Python

```python
def tarjan_scc(graph: dict[int, list[int]]) -> list[list[int]]:
    index = 0
    indices: dict[int, int] = {}
    low: dict[int, int] = {}
    stack: list[int] = []
    on_stack: set[int] = set()
    components: list[list[int]] = []

    def dfs(node: int) -> None:
        nonlocal index
        indices[node] = index
        low[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)

        for neighbor in graph.get(node, []):
            if neighbor not in indices:
                dfs(neighbor)
                low[node] = min(low[node], low[neighbor])
            elif neighbor in on_stack:
                low[node] = min(low[node], indices[neighbor])

        if low[node] == indices[node]:
            component: list[int] = []
            while True:
                value = stack.pop()
                on_stack.remove(value)
                component.append(value)
                if value == node:
                    break
            components.append(component)

    for node in graph:
        if node not in indices:
            dfs(node)

    return components
```

---

## Condensation Graph

If you compress each SCC into one meta-node, the resulting graph is a
DAG.

```
  SCC1 --> SCC2 --> SCC3

  No cycles remain between components.
```

This condensation graph is useful because it reduces a complicated
cyclic directed graph into an acyclic structure.

---

## TypeScript Example

```typescript
function kosaraju(graph: Record<string, string[]>): string[][] {
  const visited = new Set<string>();
  const order: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    for (const neighbor of graph[node] ?? []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    }
    order.push(node);
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  const reversed: Record<string, string[]> = {};
  for (const node of Object.keys(graph)) {
    reversed[node] = reversed[node] ?? [];
    for (const neighbor of graph[node] ?? []) {
      reversed[neighbor] = reversed[neighbor] ?? [];
      reversed[neighbor].push(node);
    }
  }

  visited.clear();
  const components: string[][] = [];

  function reverseDfs(node: string, component: string[]): void {
    visited.add(node);
    component.push(node);
    for (const neighbor of reversed[node] ?? []) {
      if (!visited.has(neighbor)) {
        reverseDfs(neighbor, component);
      }
    }
  }

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const node = order[index];
    if (!visited.has(node)) {
      const component: string[] = [];
      reverseDfs(node, component);
      components.push(component);
    }
  }

  return components;
}
```

## Condensation Example

```
  Original SCCs:
  {A, B, E} -> {C, G} -> {D, H}

  After condensation:

  SCC1 ----> SCC2 ----> SCC3
```

Once compressed, all internal cycles disappear and only inter-component
dependency direction remains.

---

## Applications

- detect mutually recursive dependency clusters
- simplify directed graphs before further DP or ordering
- solve logical implication graphs in 2-SAT

SCCs let you reason about cycles structurally instead of treating every
cycle as separate noise.

---

## Exercises

1. Explain why SCCs are not the same as connected components.
2. Describe why reversing edges helps in Kosaraju's algorithm.
3. Explain the meaning of a low-link value in Tarjan's algorithm.
4. Why is the condensation graph always a DAG?
5. Give a simple directed graph with exactly two SCCs.

---

## Key Takeaways

- SCCs capture mutual reachability in directed graphs.
- Kosaraju uses two DFS passes and graph reversal.
- Tarjan uses one DFS pass with low-link values and a stack.
- Condensing SCCs produces a DAG that is easier to reason about.
- SCCs are foundational for several advanced directed-graph problems.

The next lesson converts these graph ideas into interview-style problem
solving practice.

---

**Previous**: [Lesson 32 — Network Flow](./32-network-flow.md)
**Next**: [Lesson 34 — Practice Problems — Graphs](./34-practice-graphs.md)