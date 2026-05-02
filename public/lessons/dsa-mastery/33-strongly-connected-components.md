# Lesson 33: Strongly Connected Components

> **Analogy**: In a directed graph, a strongly connected component is a
> region where every place can reach every other place by following the
> arrow directions. Outside the region, that mutual reachability breaks.

---

## Why This Matters

Strongly connected components are the directed-graph analogue of
connected components, but they are subtler because edge direction
matters. In an undirected graph, if you can walk from A to B, you can
always walk back. In a directed graph, outgoing and incoming reachability
are not guaranteed to be symmetric.

SCCs appear in many advanced applications:

- **Dependency condensation graphs**: when analyzing package dependencies
  or build systems, SCCs identify circular dependency clusters that must
  be resolved together
- **Compiler analyses**: optimizing compilers use SCCs to identify
  strongly connected regions in control flow graphs for loop
  optimization and dead code elimination
- **2-SAT solving**: the classic polynomial-time algorithm for
  2-satisfiability builds an implication graph and uses SCCs to detect
  contradictions
- **Deadlock and reachability analysis**: in operating systems and
  distributed systems, SCCs in resource allocation graphs indicate
  potential deadlock cycles
- **Web crawling and page ranking**: SCCs in the web graph identify
  clusters of mutually referencing pages
- **Social network analysis**: SCCs find tightly knit communities where
  every member can reach every other member through directed
  relationships

---

## The City Districts Analogy — Deeper

Imagine a city with one-way streets. A strongly connected component is
like a district where you can drive from any intersection to any other
intersection by following the one-way signs. Outside the district,
that mutual reachability breaks — you might be able to enter from a
neighboring district, but you cannot get back.

```
  CITY STREET MAP (one-way arrows)

  District 1 (SCC):    District 2 (SCC):    District 3 (SCC):
  A ---> B             C ---> D             E
  ^   /                ^   /                |
  |  /                 |  /                 v
  E <-/                F <-/                F

  Inter-district roads:
  B --> C   (can go from District 1 to 2)
  D --> E   (can go from District 2 to 3)
  No road back from C to B!
  No road back from E to D!
```

Key observation: the SCCs themselves form a DAG when condensed. You can
traverse from District 1 -> District 2 -> District 3, but never
backward. This DAG structure is incredibly useful because it lets us
apply topological sort and other DAG algorithms to an otherwise cyclic
graph.

---

## Definition

A **strongly connected component** is a maximal set of vertices such that
every vertex in the set can reach every other vertex in the set through
directed edges.

### Maximal means:
- You cannot add any other vertex to the set while preserving mutual
  reachability
- SCCs are as large as possible; they are not arbitrary subsets

```
  A -> B -> C
  ^    |    |
  |    v    v
  E <- D <- F

  Let's trace reachability:
  - A reaches B, C, D, E, F
  - B reaches C, D, E, F
  - C reaches D, F (but not back to A, B, or E)
  - D reaches E, F (and back to A? D->F, no path F->A. D->E->A? E->A yes!)

  Actually: D -> E -> A -> B -> C -> ... wait, does C reach D?
  C -> D directly? The diagram shows C -> D.

  Let's re-examine:
  A -> B -> C
  A -> E? A has no edge to E.
  B -> D, and E <- D, so B -> D -> E.
  E -> A? Yes, E -> A.
  So A -> B -> D -> E -> A forms a cycle.

  What about C and F?
  B -> C, C -> D, so C reaches D, E, A, B.
  D -> F, F has no outgoing edges shown.
  So C cannot reach F and get back.

  SCCs in this graph:
  {A, B, D, E} — mutually reachable cycle
  {C} — can reach the big SCC but not get back from F
  {F} — sink, no outgoing edges
```

Notice that a vertex can reach an SCC without being in it. C can reach
{A, B, D, E} but is not part of that SCC because it cannot be reached
back from F (or from within the SCC via a return path through C's own
outgoing edges).

### How SCCs differ from connected components

In an undirected graph, connected components partition the vertices
into disjoint sets where every pair is connected by some path.

In a directed graph, SCCs are also disjoint and partition the vertices,
but the reachability is stricter: paths must exist in both directions.

---

## Kosaraju's Algorithm

### Core idea

Kosaraju's algorithm works in two passes:

1. **First pass**: Run DFS on the original graph and record the finish
   order (when each node is completely explored, append it to a list)
2. **Reverse every edge** to create the transposed graph
3. **Second pass**: Process vertices in reverse finish order on the
   reversed graph. Each DFS tree in this second pass is one SCC.

### Why it works — the intuition

Consider a directed graph as a set of SCCs with directed edges between
them. When you condense SCCs into meta-nodes, the result is a DAG (no
cycles between SCCs by definition). In any DAG, there is at least one
source (no incoming edges) and at least one sink (no outgoing edges).

The first DFS on the original graph explores nodes and records finish
times. Nodes in a "sink SCC" (an SCC with no outgoing edges to other
SCCs) finish last because DFS must fully explore everything reachable
from them before backtracking. When we reverse the graph, that sink
SCC becomes a source SCC (no incoming edges from other SCCs). If we
start our second DFS from nodes that finished last, we are guaranteed
to start in a source SCC of the reversed graph, which means our DFS
cannot escape to other SCCs — all edges point inward!

### Detailed trace

```
  Original graph:

  A -> B -> C -> D
  ^    |    ^    |
  |    v    |    v
  F <- E <- G <- H

  Step 1: DFS on original graph, record finish order.
  Assume adjacency list order gives this finish sequence:

    Start at A:
      A -> B -> C -> D -> (done) -> append D
                <- back to C -> G -> H -> (done) -> append H
                              <- back to G -> E -> F -> (done) -> append F
                                            <- back to E -> (done) append E
                              <- back to G -> append G
                <- back to C -> append C
      <- back to B -> append B
    <- back to A -> append A

  Finish order: [D, H, F, E, G, C, B, A]

  Step 2: Reverse all edges.
    A <- B <- C <- D
    |    ^    |    ^
    v    |    v    |
    F -> E -> G -> H

  Step 3: Process in REVERSE finish order: A, B, C, G, E, F, H, D

    DFS from A in reversed graph:
      A -> F -> E -> B -> (back to A already visited)
      Component 1: {A, B, E, F}

    Next unvisited in order: C
      C -> B (already visited)
      Component 2: {C}

    Next unvisited: G
      G -> C (already visited)
      Component 3: {G}

    Next unvisited: H
      H -> G (already visited)
      Component 4: {H}

    Next unvisited: D
      D -> C (already visited)
      Component 5: {D}

  Final SCCs: {A,B,E,F}, {C}, {G}, {H}, {D}
```

Notice how each second-pass DFS stays trapped within one SCC because
we start from the "source" of the reversed condensation DAG.

### What if we processed in original finish order instead of reverse?

Processing in original finish order would likely start DFS in a "sink"
SCC of the reversed graph (which was a source SCC of the original). That
DFS might follow reversed edges into multiple SCCs, producing incorrect
larger components that span multiple true SCCs. The reversal of finish
order is essential, not optional.

---

## Tarjan's Algorithm

Tarjan's algorithm finds SCCs in a **single DFS pass**, making it more
space-efficient than Kosaraju's two-pass approach. It uses three
mechanisms:

- **Discovery indices**: a counter assigning each node a unique ID when
  first visited
- **Low-link values**: the smallest discovery index reachable from the
  current node through tree edges and back edges into the active DFS
  stack
- **An explicit stack**: nodes currently in the DFS recursion tree are
  kept on a stack. When a node's low-link equals its discovery index,
  it is the root of an SCC, and all nodes above it on the stack belong
  to that SCC.

### Low-link value intuition

`low[node]` represents: "how far back in the DFS tree can we reach from
this node, including through back edges to ancestors currently on the
stack?"

- If `low[node] == index[node]`, then no back edge from this node's
  subtree reaches any ancestor. The node is the root of an SCC.
- If `low[node] < index[node]`, then some descendant has a back edge to
  an ancestor, meaning this node is part of a larger SCC rooted at
  that ancestor.

### Detailed low-link trace

```
  Graph:    A -> B -> C
            ^         |
            |         v
            E <------ D

  DFS execution:

    Visit A: index=0, low=0, stack=[A]
      Visit B: index=1, low=1, stack=[A,B]
        Visit C: index=2, low=2, stack=[A,B,C]
          Visit D: index=3, low=3, stack=[A,B,C,D]
            Visit E: index=4, low=4, stack=[A,B,C,D,E]
              E -> A (A is on the stack!)
              low[E] = min(4, index[A]=0) = 0
            Back to D: low[D] = min(3, low[E]=0) = 0
          Back to C: low[C] = min(2, low[D]=0) = 0
        Back to B: low[B] = min(1, low[C]=0) = 0
      Back to A: low[A] = min(0, low[B]=0) = 0

    Now DFS finishes A. low[A] == index[A] (both 0).
    Pop from stack until A: SCC = {E, D, C, B, A}.

  Wait — this graph might be strongly connected. Let's verify:
    A -> B -> C -> D -> E -> A. Yes, one SCC containing all nodes.
```

Now consider a graph with multiple SCCs:

```
  Graph:    A -> B -> C
                      |
                      v
                      D -> E
                      (C cannot reach back to A or B)

  DFS:
    Visit A: index=0, low=0, stack=[A]
      Visit B: index=1, low=1, stack=[A,B]
        Visit C: index=2, low=2, stack=[A,B,C]
          Visit D: index=3, low=3, stack=[A,B,C,D]
            Visit E: index=4, low=4, stack=[A,B,C,D,E]
              E has no outgoing edges to stack nodes.
              low[E] = 4. low[E] == index[E].
              Pop E. SCC = {E}.
            Back to D: low[D] = min(3, low[E]=4) = 3.
            D has no other neighbors. low[D] == index[D] = 3.
            Pop D. SCC = {D}.
          Back to C: low[C] = min(2, low[D]=3) = 2.
          C has no back edge. low[C] == index[C] = 2.
          Wait — but B can reach C, and C cannot reach back to B.
          So C should be its own SCC.
          Pop C. SCC = {C}.
        Back to B: low[B] = min(1, low[C]=2) = 1.
        low[B] == index[B]. Pop B. SCC = {B}.
      Back to A: low[A] = min(0, low[B]=1) = 0.
      low[A] == index[A]. Pop A. SCC = {A}.

  SCCs: {A}, {B}, {C}, {D}, {E}
```

Notice: Tarjan's algorithm identifies SCC roots dynamically during DFS,
without needing to build the reversed graph.

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
DAG. This is called the **condensation graph** (or **component graph**,
or **meta-graph**).

```
  Original directed graph with cycles:

  {A,B} --> {C,D,E} --> {F}
     |          ^
     |          |
     +----------+   (cycle within {A,B}, another within {C,D,E})

  Condensation DAG:

  SCC1 ----> SCC2 ----> SCC3

  No cycles remain between components.
```

### Why the condensation graph is always a DAG

Proof by contradiction: if there were a cycle between SCCs in the
condensation graph, then vertices in those SCCs could reach each other
through the cycle, meaning they should have been a single SCC. By the
maximality property of SCCs, no such inter-component cycle can exist.

### Why this matters

The condensation graph lets us:
- Apply topological sort to an otherwise cyclic graph
- Reason about reachability at the component level
- Design dynamic programming on directed graphs by processing SCCs in
  topological order
- Solve 2-SAT by checking if a variable and its negation are in the
  same SCC

```
  2-SAT implication graph condensation:

  If x and ¬x are in the same SCC, the formula is unsatisfiable.
  Otherwise, process SCCs in reverse topological order of the
  condensation DAG to assign truth values.
```

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

## Complexity Summary

```
  ┌─────────────────┬─────────────────┬─────────────────┐
  │ Algorithm       │ Time            │ Space           │
  ├─────────────────┼─────────────────┼─────────────────┤
  │ Kosaraju's      │ O(V + E)        │ O(V + E) for    │
  │                 │                 │ reversed graph  │
  │                 │                 │ + O(V) stack    │
  │ Tarjan's        │ O(V + E)        │ O(V) recursion  │
  │                 │                 │ stack + O(V)    │
  │                 │                 │ explicit stack  │
  └─────────────────┴─────────────────┴─────────────────┘

  Both run in linear time. Kosaraju's needs the reversed graph;
  Tarjan's uses a single pass but requires careful stack management.
```

---

## Exercises

1. Explain why SCCs are not the same as connected components. Draw a
   small directed graph where the SCC partition differs from the
   connected component partition.
2. Describe why reversing edges helps in Kosaraju's algorithm. What
   would go wrong if we ran the second pass on the original graph?
3. Explain the meaning of a low-link value in Tarjan's algorithm.
   Trace Tarjan's algorithm on a 5-node graph showing index and low
   values at each step.
4. Why is the condensation graph always a DAG? Prove it by
   contradiction.
5. Give a simple directed graph with exactly two SCCs and draw its
   condensation DAG.
6. Design a directed graph where Kosaraju's and Tarjan's would
   discover SCCs in different orders. Does the order matter?
7. Explain how SCCs help solve 2-SAT. What is the condition for
   unsatisfiability?
8. A package manager detects a dependency cycle. How does this relate
   to SCCs? What would the SCC size tell you about the severity of
   the problem?

---

## Key Takeaways

- **Strongly connected components** partition a directed graph into
  maximal sets where every vertex reaches every other vertex in the set.
  Unlike undirected connected components, direction matters.
- **Kosaraju's algorithm** uses two DFS passes: first to record finish
  order, then on the reversed graph in reverse finish order. The
  reversal ensures each second-pass DFS stays within one SCC.
- **Tarjan's algorithm** finds SCCs in a single DFS pass using discovery
  indices, low-link values, and an explicit stack. When `low[node] ==
  index[node]`, the node is the root of an SCC.
- The **condensation graph** (meta-graph of SCCs) is always a DAG. This
  lets us apply topological sort and dynamic programming to cyclic
  directed graphs at the component level.
- **SCCs are foundational** for 2-SAT, dependency analysis, compiler
  optimization, deadlock detection, and web graph analysis.
- Both Kosaraju's and Tarjan's run in `O(V + E)` time. Kosaraju's is
  conceptually simpler; Tarjan's is more space-efficient (no reversed
  graph needed).

The next lesson converts these graph ideas into interview-style problem
solving practice.

---

**Previous**: [Lesson 32 — Network Flow](./32-network-flow.md)
**Next**: [Lesson 34 — Practice Problems — Graphs](./34-practice-graphs.md)