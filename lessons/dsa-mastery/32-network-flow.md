# Lesson 32: Network Flow

> **Analogy**: Think of water moving through a pipe system. Each pipe
> has a capacity. You want to know the maximum amount of water that can
> travel from the source to the sink without violating any pipe limits.
> That is the max-flow problem.

---

## Why This Matters

Network flow is one of the most versatile and powerful frameworks in
graph algorithms. The same underlying algorithm (max-flow) solves an
astonishing variety of seemingly unrelated problems:

- **Bipartite matching**: assigning workers to jobs, students to
  schools, or organ donors to recipients where each edge represents an
  allowed assignment
- **Assignment and scheduling problems**: allocating resources under
  capacity constraints, such as airline crew scheduling or conference
  room booking
- **Routing with capacities**: determining how much traffic can flow
  through a network of roads, pipes, or network links without exceeding
  any single link's capacity
- **Image segmentation**: in computer vision, separating foreground from
  background by modeling pixels as nodes and similarity scores as edge
  capacities
- **Maximum edge-disjoint paths**: finding how many completely
  independent communication routes exist between two network nodes
- **Project selection**: choosing which projects to undertake given
  prerequisites and budget constraints (modeled as a min-cut problem)
- **Baseball elimination**: determining whether a team can still win the
  league by modeling remaining games as a flow network

It introduces one of the most elegant ideas in algorithms: the
**residual graph**. The residual graph is not an approximation or a
heuristic. It is a precise mathematical structure that lets an algorithm
revise earlier decisions by sending flow "backwards" along edges. This
concept of "undoing" previous choices is the key insight that makes
max-flow both correct and efficient.

---

## The Max-Flow Problem

Given a directed graph where each edge has a **capacity** (the maximum
flow it can carry), find the largest possible flow from a designated
**source** `s` to a designated **sink** `t`.

Two fundamental constraints govern every valid flow:

1. **Capacity constraint**: flow on each edge does not exceed its capacity
2. **Flow conservation**: at every vertex except `s` and `t`, the total
   flow entering equals the total flow leaving

```
  s --10--> a --8--> t
  s --5 ---> b --7--> t
  a --3 ---> b

  Source s can push at most 10 + 5 = 15 units out initially.
  But edge a -> t only carries 8, and b -> t only carries 7.
  Can we route all 15 through? Let's see:
  - Send 8 through s -> a -> t (uses a->t fully)
  - Send 5 through s -> b -> t (uses b->t partially)
  - The remaining 2 from s->a could go a->b->t
    But b->t only has 2 remaining capacity (7 - 5 = 2)
    So a->b carries 2, b->t carries 2 more.
  Total: 8 + 5 + 2 = 15? Wait, s only pushes 10 + 5 = 15.
  Actually: s->a sends 10, but a->t only takes 8.
  The excess 2 goes a->b->t.
  s->b sends 5, b->t takes 5.
  Total into t: 8 + 5 + 2 = 15. Yes! Max flow = 13.
```

The goal is not one path. It is the total feasible throughput from
source to sink, which may split across many paths simultaneously.

---

## The Pipe System Analogy — Deeper

Imagine a water treatment plant (source `s`) connected to a reservoir
(sink `t`) through a network of pipes. Each pipe has a maximum flow rate
(capacity) it can handle:

```
  SOURCE                    SINK
  (plant)                 (reservoir)
     |                        ^
     |                        |
   10 |                    8 |
     v                        |
     a ------ 3 -----> b ---- 7 ---> t
     |                        |
     |                        |
     +-----------> (direct to t, capacity 8)
```

The plant wants to push as much water as possible to the reservoir. But:
- The pipe from `a` to `t` can only handle 8 units
- The pipe from `b` to `t` can only handle 7 units
- The pipe from `s` to `a` can push 10 units, but `a` cannot send all
  10 directly to `t`

So some water must detour: `s -> a -> b -> t`. But the `a -> b` pipe
only handles 3 units, and `b -> t` already takes 5 from `s -> b`. So
the detour can only add `min(3, 7-5) = 2` more units.

Total flow: `8 (direct) + 5 (through b) + 2 (detour) = 13`.

The max-flow problem asks: what is this maximum total? And the residual
captures the remaining pipe capacity after we have pushed this flow.

Notice: **there is no single best path**. The optimal solution uses
multiple paths simultaneously. This is fundamentally different from
shortest path, which finds one minimum-cost route.

---

## Ford-Fulkerson Method

### Core idea

The Ford-Fulkerson method is not a single algorithm but a framework:

1. Start with zero flow on all edges
2. Repeatedly find an **augmenting path** from `s` to `t` in the
   **residual graph**
3. Push as much additional flow as possible along that path (the
   bottleneck capacity)
4. Update the residual graph to reflect the new flow
5. Repeat until no augmenting path exists

The key insight: because we update the residual graph after each
augmentation, later paths can "undo" or reroute earlier choices through
backward edges.

### Bottleneck

The amount you can push through a path is limited by the smallest
remaining capacity on that path.

```
  Path: s -> a -> t
  Original capacities: s->a = 10, a->t = 8
  bottleneck = min(10, 8) = 8

  Push 8 units of flow along this path.
```

After pushing, the residual capacities on this path decrease. But
crucially, **backward edges appear** with capacity equal to the flow
pushed. These backward edges let future augmenting paths send flow
"backwards" to revise earlier routing decisions.

---

## Residual Graph — The Key Insight

The residual graph is the masterstroke of max-flow algorithms. It
transforms the problem from "which edges have capacity left?" into
"where can we still push or reroute flow?"

### Forward and backward residual edges

For every original edge `u -> v` with capacity `c` and current flow `f`:

- **Forward residual edge** `u -> v` with capacity `c - f`: how much
  more flow we can send in the original direction
- **Backward residual edge** `v -> u` with capacity `f`: how much flow
  we can "undo" by sending flow backwards

```
  Original edge: u --(capacity 10, flow 5)--> v

  Residual graph contains:
    u --(capacity 5)--> v   (forward: 10 - 5 = 5 remaining)
    v --(capacity 5)--> u   (backward: can undo up to 5 units)
```

### Why backward edges matter

Backward edges let the algorithm revise earlier decisions. If an early
augmenting path made a suboptimal routing choice, a later augmenting
path can send flow backward along an edge, effectively rerouting that
flow elsewhere.

### Detailed augmenting path trace

```
  Initial network:

  s --10--> a --8--> t
  s --5 ---> b --7--> t
  a --3 ---> b

  Step 1: Find augmenting path s -> a -> t
    Bottleneck = min(10, 8) = 8
    Push 8 units.

    After pushing 8:
    Forward residuals:
      s -> a : 2   (10 - 8)
      a -> t : 0   (8 - 8)
      s -> b : 5   (unchanged)
      b -> t : 7   (unchanged)
      a -> b : 3   (unchanged)
    Backward residuals:
      a -> s : 8   (undo the 8 sent)
      t -> a : 8   (undo the 8 received)

    Current flow: 8

  Step 2: Find next augmenting path in residual graph
    Path s -> b -> t exists with forward capacities 5 and 7.
    Bottleneck = min(5, 7) = 5
    Push 5 units.

    After pushing 5:
    Forward residuals:
      s -> a : 2
      a -> t : 0
      s -> b : 0   (5 - 5)
      b -> t : 2   (7 - 5)
      a -> b : 3
    Backward residuals:
      a -> s : 8
      t -> a : 8
      b -> s : 5
      t -> b : 5

    Current flow: 8 + 5 = 13

  Step 3: Can we push more?
    Path s -> a -> b -> t?
    s -> a forward: 2
    a -> b forward: 3
    b -> t forward: 2
    Bottleneck = min(2, 3, 2) = 2
    Push 2 more units!

    After pushing 2:
    Forward residuals:
      s -> a : 0   (2 - 2)
      a -> b : 1   (3 - 2)
      b -> t : 0   (2 - 2)
    Current flow: 13 + 2 = 15

    Wait — is 15 correct? Let's verify total source output:
    s -> a sent 8 + 2 = 10 (capacity 10, OK)
    s -> b sent 5 (capacity 5, OK)
    Total source outflow: 15.

    Total sink inflow:
    a -> t: 8
    b -> t: 5 + 2 = 7
    Total: 15. Matches!

  Step 4: Any remaining augmenting path?
    s -> a: forward capacity 0
    s -> b: forward capacity 0
    No path from s to t exists in residual graph.

  Final max flow: 15.
```

This trace illustrates the crucial mental model: every augmentation
changes the residual graph, and later augmentations may use edges that
did not exist in the original graph (backward edges) to reroute flow
optimally.

---

## Edmonds-Karp

Edmonds-Karp is Ford-Fulkerson with one specific, critical rule:

- **Find augmenting paths using BFS** (shortest path in number of edges)

This guarantees polynomial time: `O(V * E^2)` in the worst case.

### Why BFS matters here

BFS does not maximize bottleneck capacity. It minimizes the number of
edges in the augmenting path. That specific rule is what turns the more
general Ford-Fulkerson method into a polynomial-time algorithm.

### What if we used DFS instead of BFS?

Ford-Fulkerson with DFS (not Edmonds-Karp) can have exponential runtime
on graphs with irrational capacities, and poor scaling even with integer
capacities. The BFS rule ensures each augmentation uses the shortest
possible path, which guarantees that the number of augmentations is
bounded by `O(V * E)`.

### Complexity

```
  ┌─────────────────┬─────────────────┬─────────────────┐
  │ Algorithm       │ Time            │ Space           │
  ├─────────────────┼─────────────────┼─────────────────┤
  │ Ford-Fulkerson  │ O(E * max_flow) │ O(V^2) residual │
  │ (DFS, integer)  │ pseudo-polynomial                │
  │                 │                 │                 │
  │ Edmonds-Karp    │ O(V * E^2)      │ O(V^2) residual │
  │ (BFS)           │ strongly polynomial               │
  │                 │                 │                 │
  │ Dinic's         │ O(V^2 * E)      │ O(V^2) level    │
  │ (blocking flow) │                 │ graph + BFS     │
  └─────────────────┴─────────────────┴─────────────────┘
```

For most competitive programming and interview settings, Edmonds-Karp
is sufficient. Dinic's algorithm is faster for dense graphs but more
complex to implement.

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

One of the most beautiful theorems in graph algorithms:

> The maximum value of a flow equals the minimum capacity of an `s-t`
> cut.

### What is an s-t cut?

An `s-t` cut partitions the vertices into two sets: one containing the
source `s`, and one containing the sink `t`. The capacity of the cut is
the sum of capacities of all edges going from the source side to the
sink side.

```
  EXAMPLE CUT

  {s, a}  |  {b, t}
     -------+-------
          3  (a -> b)
          5  (s -> b)

  Cut capacity = 3 + 5 = 8

  Another cut:
  {s}     |  {a, b, t}
     -------+-------
         10  (s -> a)
          5  (s -> b)

  Cut capacity = 10 + 5 = 15
```

The minimum cut capacity equals the maximum flow value. In our
example, the max flow was 15, and the minimum cut `{s} | {a,b,t}` has
capacity `10 + 5 = 15`.

### Why this theorem is profound

It equates two completely different perspectives:

- **Flow perspective**: how much can we actively push through the network?
- **Cut perspective**: what is the cheapest way to separate source from sink?

The theorem tells us: the bottleneck is structural. No matter how
cleverly you route flow, you can never exceed the capacity of the
weakest cut. And conversely, max-flow algorithms always find a flow
that saturates some cut, proving optimality.

### Applications of min-cut

- **Image segmentation**: find the minimum cut separating foreground
  from background pixels
- **Network reliability**: identify the smallest set of links whose
  failure disconnects source from sink
- **Project selection**: choose projects to maximize profit by modeling
  dependencies and penalties as a min-cut problem

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

## Applications — Max-Flow as a Modeling Language

Network flow is often a modeling trick disguised as an algorithm. Many
problems that do not look like "water through pipes" become max-flow
when you design the right graph.

### Bipartite matching

Convert left/right choices into capacity-1 edges. A flow of 1 through
an edge represents choosing that pairing.

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
pairings. Each unit of flow from source to sink represents one matched
pair.

### What if capacities were not 1?

If workers can take multiple jobs, increase source->worker capacities.
If jobs require multiple workers, increase job->sink capacities. The
same algorithm handles weighted and multi-unit assignments naturally.

### Edge-disjoint paths

Set every edge capacity to 1. The max flow equals the maximum number of
edge-disjoint paths from `s` to `t`, because each path uses capacity 1
on each edge and no edge can be shared.

### Image segmentation

In computer vision, pixels are nodes. Edges between neighboring pixels
have capacities representing similarity (high capacity = likely same
segment). Source connects to foreground seeds, sink to background seeds.
The min-cut separates the image into two regions.

---

## Exercises

1. Explain what a residual graph represents. What do forward and
   backward residual edges mean intuitively?
2. Why are backward edges necessary? Give a small example where an
   algorithm without backward edges gets stuck with a suboptimal flow.
3. Trace the full Edmonds-Karp execution on the example network from
   this lesson, showing each augmenting path and the residual capacities
   after each step.
4. Explain the bottleneck concept. Why is it the limiting factor on any
   augmenting path?
5. State the max-flow min-cut theorem in your own words. Why is it
   remarkable that max flow equals min cut?
6. Convert a small bipartite matching problem into a max-flow network.
   Show the graph and explain why a max flow gives a maximum matching.
7. What happens if all edge capacities in a max-flow problem are
   integers? Does the algorithm still produce an integer flow?
8. Design a small network where the first augmenting path a greedy
   DFS would pick leads to many more iterations than Edmonds-Karp's
   BFS approach.

---

## Key Takeaways

- **Max flow** is about total feasible throughput from source to sink,
  not a single best path. Flow may split across many routes.
- **Ford-Fulkerson** is the general method: repeatedly find augmenting
  paths in the residual graph and push bottleneck flow.
- **Edmonds-Karp** uses BFS for shortest augmenting paths, guaranteeing
  `O(V * E^2)` polynomial time.
- The **residual graph** is the key insight: forward edges show remaining
  capacity, backward edges let the algorithm undo and reroute earlier
  flow decisions.
- The **max-flow min-cut theorem** states that maximum flow equals
  minimum cut capacity. This links the active optimization (flow) to a
  structural bottleneck (cut).
- **Network flow is a modeling language**: bipartite matching,
  assignment, disjoint paths, image segmentation, and many other problems
  become max-flow with the right graph construction.

The next lesson studies strongly connected components in directed graphs.

---

**Previous**: [Lesson 31 — Union-Find (Disjoint Set Union)](./31-union-find.md)
**Next**: [Lesson 33 — Strongly Connected Components](./33-strongly-connected-components.md)