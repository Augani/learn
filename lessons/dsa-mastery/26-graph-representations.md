# Lesson 26: Graph Representations

> **Analogy**: A graph is a map of relationships. The same city map
> can be written as a list of roads, a table of direct connections,
> or an implicit rule like "you can move up, down, left, or right in
> a grid." The representation changes what becomes fast, what becomes
> slow, and which algorithms feel natural.

---

## Why This Matters

Arrays and trees feel concrete because their structure is built into
 the data. Graphs are different: the first design choice is often not
 the algorithm but the representation.

The same graph can be stored as:

- an adjacency list
- an adjacency matrix
- an edge list
- an implicit graph

That choice directly affects:

- **Space usage**: adjacency matrices waste space on sparse graphs; edge
  lists are compact but slow for neighbor queries
- **Edge lookup time**: matrices give `O(1)` edge existence checks; lists
  require scanning neighbors
- **Neighbor iteration speed**: lists give direct neighbor access; matrices
  must scan entire rows
- **Algorithm simplicity**: some algorithms (Floyd-Warshall) naturally fit
  matrices; others (Kruskal's) naturally fit edge lists

This is why graph performance begins before BFS, DFS, Dijkstra, or
 any other traversal even starts. Choosing the wrong representation can
 turn a linear algorithm into a quadratic one, or waste gigabytes of
 memory on a sparse social network graph.

---

## The City Map Analogy — Deeper

Imagine you are building a navigation app for a city. You have three ways to store the road network:

**Option 1: Adjacency List (Friend Lists)**
Each intersection has a list of directly connected intersections.

```
  Main St: [1st Ave, 2nd Ave, 3rd Ave]
  1st Ave: [Main St, Oak Rd]
  2nd Ave: [Main St, Pine Rd]
  ...
```

This is compact. You only store roads that actually exist.

**Option 2: Adjacency Matrix (Giant Table)**
A table where every row is an intersection and every column is an intersection. A `1` means they are directly connected.

```
           Main St  1st Ave  2nd Ave  Oak Rd
  Main St    0        1        1        0
  1st Ave    1        0        0        1
  2nd Ave    1        0        0        0
  Oak Rd     0        1        0        0
```

This makes "are these two connected?" instant — just look up one cell. But most cells are `0`, wasting enormous space.

**Option 3: Edge List (List of Roads)**
Just a list of every road:

```
  [(Main St, 1st Ave), (Main St, 2nd Ave), (1st Ave, Oak Rd)]
```

This is the most compact, but finding "all roads from Main St" requires scanning the entire list.

The right choice depends on what your app does most often:
- Showing all exits from an intersection → adjacency list
- Checking if two specific intersections connect → adjacency matrix
- Finding the shortest road network (MST) → edge list

---

## What Is a Graph?

A graph consists of:

- **vertices** or **nodes**: the objects
- **edges**: the relationships between them

Graphs may be:

- directed or undirected
- weighted or unweighted
- sparse or dense

### Social Network Analogy

An adjacency list is like each person's friend list.

An adjacency matrix is like a giant table where row `u` and column
 `v` says whether `u` and `v` are connected.

```
          Alice
         /     \
      Bob ----- Carol
        \        /
         \      /
          David
```

Same graph, three representations below.

---

## Adjacency List

Store, for each node, the list of its neighbors.

```
  Graph:

      A ----- B
      |     / |
      |   /   |
      | /     |
      C ----- D

  Adjacency list:

  A: [B, C]
  B: [A, C, D]
  C: [A, B, D]
  D: [B, C]
```

### Why it is common

Most real graphs are sparse. They have far fewer than $V^2$ edges.
 An adjacency list stores only edges that actually exist.

### Complexity

- space: $O(V + E)$
- iterate neighbors of `u`: $O(\deg(u))$
- test whether edge `(u, v)` exists: $O(\deg(u))$ unless neighbor sets are hashed

### Step-by-step construction

```
  Start with empty lists:
  A: []
  B: []
  C: []
  D: []

  Add edge (A, B):
  A: [B]
  B: [A]

  Add edge (A, C):
  A: [B, C]
  C: [A]

  Add edge (B, C):
  B: [A, C]
  C: [A, B]

  Add edge (B, D):
  B: [A, C, D]
  D: [B]

  Add edge (C, D):
  C: [A, B, D]
  D: [B, C]
```

#### Python

```python
graph: dict[str, list[str]] = {
    "A": ["B", "C"],
    "B": ["A", "C", "D"],
    "C": ["A", "B", "D"],
    "D": ["B", "C"],
}
```

#### TypeScript

```typescript
const graph: Record<string, string[]> = {
  A: ["B", "C"],
  B: ["A", "C", "D"],
  C: ["A", "B", "D"],
  D: ["B", "C"],
};
```

#### Rust

```rust
use std::collections::HashMap;

fn build_graph() -> HashMap<&'static str, Vec<&'static str>> {
    HashMap::from([
        ("A", vec!["B", "C"]),
        ("B", vec!["A", "C", "D"]),
        ("C", vec!["A", "B", "D"]),
        ("D", vec!["B", "C"]),
    ])
}
```

---

## Adjacency Matrix

Store a $V \times V$ table where entry `(i, j)` says whether the edge
 exists.

```
      A  B  C  D
  A [ 0, 1, 1, 0 ]
  B [ 1, 0, 1, 1 ]
  C [ 1, 1, 0, 1 ]
  D [ 0, 1, 1, 0 ]
```

### Complexity

- space: $O(V^2)$
- edge lookup: $O(1)$
- iterate neighbors of `u`: $O(V)$

### Step-by-step construction

```
  Start with 4x4 zeros:
      A  B  C  D
  A [ 0, 0, 0, 0 ]
  B [ 0, 0, 0, 0 ]
  C [ 0, 0, 0, 0 ]
  D [ 0, 0, 0, 0 ]

  Add edge (A, B):
      A  B  C  D
  A [ 0, 1, 0, 0 ]
  B [ 1, 0, 0, 0 ]

  Add edge (A, C):
      A  B  C  D
  A [ 0, 1, 1, 0 ]
  C [ 1, 0, 0, 0 ]

  ...and so on for all edges
```

### When it helps

It is useful for:

- dense graphs
- algorithms like Floyd-Warshall
- problems with many edge-existence queries

### What if we always used an adjacency matrix?

That sounds attractive because edge lookup becomes constant time.
 But if the graph has one million vertices and each vertex connects
 to only ten others, $V^2$ space is catastrophic. You pay enormous
 memory and cache cost just to store mostly zeros.

```
  Sparse graph example:
  1,000,000 vertices, 10,000,000 edges

  Adjacency list space:  V + E  ≈ 11,000,000 entries
  Adjacency matrix space: V^2   = 1,000,000,000,000 entries

  The matrix uses ~90,000x more space!
```

Sparse graphs punish adjacency matrices.

---

## Edge List

Store only the edges as pairs or triples.

```
  Unweighted:
  [(A, B), (A, C), (B, C), (B, D), (C, D)]

  Weighted:
  [(A, B, 4), (A, C, 2), (B, D, 5), (C, D, 1)]
```

### Why it matters

An edge list is often the input format for algorithms like:

- Kruskal's MST
- Bellman-Ford
- batch graph ingestion pipelines

### Trade-offs

- space: $O(E)$
- iterate all edges: excellent
- iterate neighbors of one node: poor unless converted first

### Step-by-step construction

```
  Start with empty list: []

  Add (A, B, 4):   [(A, B, 4)]
  Add (A, C, 2):   [(A, B, 4), (A, C, 2)]
  Add (B, D, 5):   [(A, B, 4), (A, C, 2), (B, D, 5)]
  Add (C, D, 1):   [(A, B, 4), (A, C, 2), (B, D, 5), (C, D, 1)]
```

For directed graphs, the order matters: `(A, B)` means A → B.

---

## Implicit Graphs

Sometimes you never store the graph explicitly.

### Grid example

```
  [S] [.] [#]
  [.] [.] [.] 
  [#] [.] [T]
```

Each open cell is a node. Edges are generated by movement rules:

- up
- down
- left
- right

This is an **implicit graph**. The nodes and edges are defined by the
 problem rules rather than by a materialized adjacency structure.

Implicit graphs appear in:

- grids
- puzzle states
- word transformations
- shortest-sequence problems

### Why implicit graphs matter

For a 1000×1000 grid, an explicit adjacency list would have 1,000,000 nodes and ~4,000,000 edges. That is manageable but unnecessary. The grid coordinates themselves encode the structure:

```
  neighbors of (r, c):
    (r-1, c), (r+1, c), (r, c-1), (r, c+1)
    (if within bounds and not a wall)
```

No storage needed. The graph is generated on demand.

---

## Same Graph in All Representations

```
  Sample weighted directed graph:

      A --3--> B
      |        |
      2        4
      v        v
      C --1--> D

  Adjacency list:
  A: [(B, 3), (C, 2)]
  B: [(D, 4)]
  C: [(D, 1)]
  D: []

  Edge list:
  [(A, B, 3), (A, C, 2), (B, D, 4), (C, D, 1)]

  Adjacency matrix:
      A  B  C  D
  A [ 0, 3, 2, 0 ]
  B [ 0, 0, 0, 4 ]
  C [ 0, 0, 0, 1 ]
  D [ 0, 0, 0, 0 ]
```

Notice how the same information is arranged very differently. The adjacency list makes "who can A reach?" fast. The matrix makes "does A connect to D?" fast. The edge list makes "sort all edges by weight" fast.

---

## Representation Choice and Algorithm Performance

```
  TASK                              GOOD CHOICE

  Traverse neighbors often          adjacency list
  Check many edge existences        adjacency matrix
  Sort all edges globally           edge list
  Search a grid or state space      implicit graph
  Memory-constrained sparse graph   adjacency list
  Dense graph with few nodes        adjacency matrix
```

This is why the same algorithm can feel fast or slow depending on
 how the graph is modeled.

### What if we converted everything to adjacency list "just in case"?

For some problems, that is fine. But for others, it is wasteful:

- **Floyd-Warshall** needs matrix indexing. Converting from list to matrix costs O(V^2) time and space.
- **Kruskal's algorithm** sorts edges. Converting from list to edge list is O(E), but then you paid for list construction unnecessarily.
- **Implicit grids** never need materialization at all.

The best practice is to choose the representation that matches your algorithm's access pattern, not to default to one structure.

---

## Memory Layout Comparison

```
  ADJACENCY LIST (sparse graph, V=4, E=5):

  Array of pointers:
  [ptrA, ptrB, ptrC, ptrD]

  A -> [B, C]
  B -> [A, C, D]
  C -> [A, B, D]
  D -> [B, C]

  Total storage: O(V + E) pointers/values

  ADJACENCY MATRIX (same graph):

      A  B  C  D
  A [ 0, 1, 1, 0 ]
  B [ 1, 0, 1, 1 ]
  C [ 1, 1, 0, 1 ]
  D [ 0, 1, 1, 0 ]

  Total storage: O(V^2) values
  (16 entries for 4 nodes, 6 of which are 0)
```

---

## Cross-Reference

For a more introductory graph foundation, see
[../data-structures/12-graphs.md](../data-structures/12-graphs.md).

---

## Exercises

1. For a graph with 10,000 vertices and 20,000 edges, compare the space cost of an adjacency list vs an adjacency matrix. Show the calculation.

2. Explain why adjacency lists are usually better for BFS and DFS. What operation dominates those traversals?

3. Give an example of a problem that is naturally an implicit graph. Draw a small example and list the implicit edges.

4. Explain why Kruskal's algorithm often starts from an edge list. What operation does Kruskal need first?

5. Describe a case where an adjacency matrix is the better choice. What property of the graph or the algorithm makes it preferable?

6. Convert the following edge list to an adjacency list and an adjacency matrix:
   `[(0, 1), (0, 2), (1, 3), (2, 3)]`. Show each step.

7. For a directed graph, explain why the adjacency matrix is not symmetric. Give a concrete example.

8. In a social network with 1 billion users where each user has ~200 friends, which representation would you use to find "friends of friends"? Justify your choice.

---

## Key Takeaways

- A graph representation is part of the algorithm design, not an
  implementation afterthought.
- Adjacency lists are usually best for sparse graphs and traversal.
- Adjacency matrices are useful when graphs are dense or edge lookup
  dominates.
- Edge lists are compact and especially useful for edge-centric
  algorithms.
- Implicit graphs are everywhere in grid and state-space problems.
- The representation should match the algorithm's access pattern.

The next lesson builds on these representations with the two most
 fundamental graph traversals: BFS and DFS.

---

**Previous**: [Lesson 25 — Tree Techniques — LCA, Morris Traversal, and Tree DP](./25-tree-techniques.md)
**Next**: [Lesson 27 — Graph Traversals — BFS and DFS](./27-bfs-dfs.md)
