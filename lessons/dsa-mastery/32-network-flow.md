# Lesson 32: Network Flow

> **Analogy**: Think of water moving through a pipe system. Each pipe
> has a capacity. You want to know the maximum amount of water that can
> travel from the source to the sink without violating any pipe limits.
> That is the max-flow problem.

---

## Why This Matters

Network flow appears in:

- bipartite matching
- assignment problems
- routing with capacities
- image segmentation
- maximum edge-disjoint path problems

It introduces one of the most elegant ideas in algorithms: the
residual graph.

---

## The Max-Flow Problem

Given a directed graph with capacities, find the largest possible flow
from source `s` to sink `t` such that:

- flow on each edge does not exceed capacity
- flow is conserved at internal vertices

```
  s --10--> a --8--> t
  s --5 ---> b --7--> t
  a --3 ---> b
```

The goal is not one path. It is the total feasible flow.

---

## Ford-Fulkerson Method

### Core idea

Repeatedly find an augmenting path from `s` to `t`, push as much flow as
possible along it, and update the residual graph.

### Bottleneck

The amount you can push through a path is limited by the smallest
remaining capacity on that path.

```
  Path: s -> a -> t
  capacities: 10, 8
  bottleneck = 8
```

Push 8 units, then reduce forward residual capacity and create or grow
backward residual capacity.

---

## Residual Graph

This is the key idea.

- forward residual edge: how much more flow you can send
- backward residual edge: how much flow you can undo

Backward edges let the algorithm revise earlier decisions.

```
  If 5 units flow on u -> v,
  residual graph contains:

  u -> v with remaining capacity
  v -> u with capacity 5
```

Without backward edges, the algorithm could get stuck with bad local
choices.

### Augmenting path trace

```
  Initial network:

  s --10--> a --8--> t
  s --5 ---> b --7--> t
  a --3 ---> b

  Pick path s -> a -> t
  bottleneck = min(10, 8) = 8

  After pushing 8:
  forward residuals:
    s -> a : 2
    a -> t : 0
  backward residuals:
    a -> s : 8
    t -> a : 8

  Remaining useful path:
  s -> b -> t with bottleneck 5

  Total flow becomes 8 + 5 = 13
```

This trace is the key mental move: every augmentation changes the
future graph you search on.

---

## Edmonds-Karp

Edmonds-Karp is Ford-Fulkerson with one specific rule:

- find augmenting paths using BFS

That means it always picks a shortest augmenting path in number of
edges. This guarantees polynomial time.

### Why BFS matters here

BFS does not maximize bottleneck capacity. It minimizes the number of
edges in the augmenting path. That specific rule is what turns the more
general Ford-Fulkerson method into a polynomial-time algorithm.

### Python

```python
from collections import deque


def edmonds_karp(capacity: list[list[int]], source: int, sink: int) -> int:
    size = len(capacity)
    residual = [row[:] for row in capacity]
    max_flow = 0

    while True:
        parent = [-1] * size
        parent[source] = source
        queue = deque([source])

        while queue and parent[sink] == -1:
            node = queue.popleft()
            for neighbor in range(size):
                if parent[neighbor] == -1 and residual[node][neighbor] > 0:
                    parent[neighbor] = node
                    queue.append(neighbor)

        if parent[sink] == -1:
            break

        path_flow = float("inf")
        node = sink
        while node != source:
            previous = parent[node]
            path_flow = min(path_flow, residual[previous][node])
            node = previous

        node = sink
        while node != source:
            previous = parent[node]
            residual[previous][node] -= int(path_flow)
            residual[node][previous] += int(path_flow)
            node = previous

        max_flow += int(path_flow)

    return max_flow
```

---

## Max-Flow Min-Cut Theorem

One of the central theorems in graph algorithms says:

> The maximum value of a flow equals the minimum capacity of an `s-t`
> cut.

That means the limiting bottleneck of the network exactly matches the
best flow value.

This is beautiful because it equates:

- an optimization problem over flows
- a structural bottleneck over cuts

---

## TypeScript Example

```typescript
function edmondsKarp(capacity: number[][], source: number, sink: number): number {
  const residual = capacity.map((row) => [...row]);
  let maxFlow = 0;

  while (true) {
    const parent = new Array<number>(capacity.length).fill(-1);
    parent[source] = source;
    const queue: number[] = [source];

    while (queue.length > 0 && parent[sink] === -1) {
      const node = queue.shift() as number;
      for (let neighbor = 0; neighbor < capacity.length; neighbor += 1) {
        if (parent[neighbor] === -1 && residual[node][neighbor] > 0) {
          parent[neighbor] = node;
          queue.push(neighbor);
        }
      }
    }

    if (parent[sink] === -1) {
      break;
    }

    let pathFlow = Number.POSITIVE_INFINITY;
    for (let node = sink; node !== source; node = parent[node]) {
      pathFlow = Math.min(pathFlow, residual[parent[node]][node]);
    }

    for (let node = sink; node !== source; node = parent[node]) {
      residual[parent[node]][node] -= pathFlow;
      residual[node][parent[node]] += pathFlow;
    }

    maxFlow += pathFlow;
  }

  return maxFlow;
}
```

---

## Applications

- bipartite matching: convert left/right choices into capacity-1 edges
- assignment: capacities encode allowable assignments
- disjoint paths: capacities limit repeated edge use

Network flow is often a modeling trick disguised as an algorithm.

### Modeling example: bipartite matching

```
  Left side:   L1   L2
  Right side:  R1   R2

  allowed matches:
  L1 -> R1, R2
  L2 -> R2

  Convert to flow network:

  source -> L1, L2          capacity 1
  L1 -> R1, R2              capacity 1
  L2 -> R2                  capacity 1
  R1, R2 -> sink            capacity 1
```

Now a maximum flow corresponds exactly to the maximum number of valid
pairings.

---

## Exercises

1. Explain what a residual graph represents.
2. Why are backward edges necessary?
3. Trace one augmenting path update on a small network.
4. Explain the bottleneck concept.
5. State the max-flow min-cut theorem in your own words.

---

## Key Takeaways

- Max flow is about total feasible throughput, not a single best path.
- Ford-Fulkerson repeatedly augments along available paths.
- Edmonds-Karp uses BFS to choose augmenting paths systematically.
- Residual graphs let the algorithm revise earlier routing choices.
- Max-flow min-cut links optimization and structure in a deep way.

The next lesson studies strongly connected components in directed graphs.

---

**Previous**: [Lesson 31 — Union-Find (Disjoint Set Union)](./31-union-find.md)
**Next**: [Lesson 33 — Strongly Connected Components](./33-strongly-connected-components.md)