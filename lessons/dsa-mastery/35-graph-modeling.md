# Lesson 35: Graph Modeling Techniques

> The hardest graph problems often do not mention graphs. They talk
> about flights, locks, word ladders, minimum operations, grids, game
> states, dependencies, or transformations. Graph modeling is the skill
> of seeing the hidden nodes and edges anyway.

---

## Why This Matters

You can know every graph algorithm and still miss the right solution if
you fail to model the problem as a graph.

This lesson teaches how to recognize:

- when objects are nodes
- when transitions are edges
- when the graph is implicit
- when extra state should become part of the node

---

## Recognition Checklist

Suspect a graph whenever the problem asks about:

- reachability: can I get from A to B?
- minimum steps or moves
- dependencies or prerequisite order
- transformations between states
- connected regions or clusters
- routing under constraints

Those are graph signals, even if the word "graph" never appears.

---

## Grid Problems as Implicit Graphs

```
  [S] [.] [#]
  [.] [.] [.] 
  [#] [.] [T]
```

Model:

- each traversable cell is a node
- valid moves create edges

Then the problem becomes BFS, DFS, or Dijkstra depending on the cost
model.

---

## State-Space Graphs

Sometimes a node is not a place. It is a full state.

Examples:

- a lock combination like `1034`
- a puzzle board configuration
- `(city, stops_used)` in flight problems
- `(row, col, keys_mask)` in grid-with-keys problems

### ASCII example

```
  Puzzle state graph:

  [1230] --> [1203] --> [1023]
     |                    |
     v                    v
  [1234] --> [1034] --> [0134]
```

Each legal move transforms one state into another.

---

## Multi-Source BFS

Sometimes the problem has many starting points.

Examples:

- nearest hospital
- rotting oranges
- distance to nearest zero

Instead of running BFS from each source separately, push all sources
into the queue initially.

This lets the wavefront expand from all of them at once.

---

## 0-1 BFS

If every edge weight is either 0 or 1, there is a specialized shortest
path algorithm faster and simpler than full Dijkstra.

Use a deque:

- weight 0 edge -> push front
- weight 1 edge -> push back

This preserves increasing-distance order.

### Why this matters

It is a perfect example of modeling detail changing algorithm choice.
The graph is weighted, but not arbitrarily weighted.

---

## Transforming Non-Obvious Problems Into Graphs

### Dependency problems

If one task must happen before another, draw a directed edge.

### Transformation problems

If one valid state can become another in one move, draw an edge.

### Region problems

If neighboring cells or entities should be grouped, draw undirected
edges.

### Optimization under moves

If the question asks for minimum operations, shortest path is usually
close by.

---

## Common Modeling Mistakes

1. Using plain BFS when the state needs extra dimensions.
2. Forgetting direction in prerequisite problems.
3. Materializing a huge graph that should be implicit.
4. Treating weighted problems as unweighted.
5. Failing to mark visited state with the full state signature.

---

## Worked Modeling Examples

### Word ladder

- node: a word
- edge: two words differ by one letter
- algorithm: BFS for minimum transformations

### Cheapest flight with K stops

- node: `(city, stops_used)`
- edge: take one flight
- algorithm: shortest path on augmented state

### Rotting oranges

- nodes: grid cells
- sources: all rotten oranges initially
- algorithm: multi-source BFS

---

## Exercises

1. Convert a lock-combination puzzle into a graph model.
2. Explain why a grid shortest-path problem is often implicit.
3. Give a problem where nodes must include extra state beyond location.
4. Explain when multi-source BFS is better than repeated BFS.
5. Describe when 0-1 BFS should replace Dijkstra.

---

## Key Takeaways

- Graph modeling is the skill of identifying hidden states and transitions.
- Many "non-graph" problems are graph problems in disguise.
- Implicit graphs avoid unnecessary storage and often fit naturally.
- Extra constraints often belong inside the node state.
- The best graph algorithm depends on what the modeled edges mean.

Phase 4 is complete: you can now represent graphs, traverse them,
optimize on them, reason about directed structure, and model new
problems as graphs when the statement does not spell that out for you.

---

**Previous**: [Lesson 34 — Practice Problems — Graphs](./34-practice-graphs.md)
**Next**: [Lesson 36 — Recursion and Recurrence Relations](./36-recursion-recurrences.md)