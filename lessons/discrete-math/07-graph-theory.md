# Lesson 07 — Graph Theory

> **Analogy:** A social network is a graph. People are vertices, friendships are edges.
> "Who knows who" is adjacency. "Six degrees of separation" is shortest path.
> Graph theory formalizes all of this.

## Formal Definition

A graph G = (V, E) where:
- V = set of vertices (nodes)
- E = set of edges (connections between vertices)

```
V = {A, B, C, D}
E = {(A,B), (A,C), (B,D), (C,D)}

    A --- B
    |     |
    C --- D
```

### Directed vs Undirected

```
Undirected:  A --- B     Edge {A,B} = {B,A}
             (friendship: mutual)

Directed:    A --> B     Edge (A,B) != (B,A)
             (Twitter follow: one-way)
```

### Weighted Graphs

```
    A --5-- B
    |       |
    3       2
    |       |
    C --4-- D

Edges carry weights (distances, costs, capacities).
```

## Key Terminology

```
+--------------------+--------------------------------------------+
| Term               | Meaning                                    |
+--------------------+--------------------------------------------+
| Adjacent           | Connected by an edge                       |
| Degree deg(v)      | Number of edges touching v                 |
| Path               | Sequence of vertices connected by edges    |
| Cycle              | Path that starts and ends at same vertex   |
| Connected          | Path exists between every pair of vertices |
| Complete (K_n)     | Every pair connected, C(n,2) edges         |
| Bipartite          | Vertices split into 2 groups, edges only   |
|                    | between groups                             |
| Planar             | Can be drawn with no edge crossings        |
+--------------------+--------------------------------------------+
```

## Graph Representations

### Adjacency Matrix

```
      A  B  C  D
  A [ 0  1  1  0 ]
  B [ 1  0  0  1 ]
  C [ 1  0  0  1 ]
  D [ 0  1  1  0 ]

Space: O(V^2)
Edge lookup: O(1)
Good for: dense graphs
```

### Adjacency List

```
A: [B, C]
B: [A, D]
C: [A, D]
D: [B, C]

Space: O(V + E)
Edge lookup: O(degree)
Good for: sparse graphs (most real graphs)
```

### Python Implementation

```python
class Graph:
    def __init__(self, directed=False):
        self.adj = {}
        self.directed = directed

    def add_edge(self, u, v, weight=1):
        self.adj.setdefault(u, []).append((v, weight))
        if not self.directed:
            self.adj.setdefault(v, []).append((u, weight))

    def neighbors(self, v):
        return [u for u, w in self.adj.get(v, [])]

    def degree(self, v):
        return len(self.adj.get(v, []))
```

## The Handshaking Theorem

```
Sum of all degrees = 2 * |E|

Why? Each edge contributes 1 to the degree of each endpoint.

    A --- B --- C

  deg(A) = 1, deg(B) = 2, deg(C) = 1
  Sum = 4 = 2 * 2 edges
```

**Corollary:** The number of vertices with odd degree is always EVEN.

## Special Graphs

```
Complete Graph K_4:      Cycle Graph C_5:      Bipartite K_{2,3}:
  A --- B                 1 --- 2               A --- X
  |\ /|                  |       |              A --- Y
  | X  |                  5       3             A --- Z
  |/ \|                  |       |              B --- X
  C --- D                 4 --- 3               B --- Y
                                                 B --- Z
  Edges: C(4,2)=6        Edges: 5               Edges: 6
```

## Euler Paths and Circuits

Can you draw the graph without lifting your pen?

```
Euler PATH:    Visit every EDGE exactly once.
Euler CIRCUIT: Euler path that returns to start.

+-------------------------------------------+
| Graph Type      | Euler Path | Euler Circ |
+-----------------+------------+------------|
| All even degree |    Yes     |    Yes     |
| Exactly 2 odd   |    Yes     |    No      |
| More than 2 odd |    No      |    No      |
+-------------------------------------------+
```

**The Konigsberg Bridge Problem:**

```
     [A]
    / | \
   1  2  3
  /   |   \
[B]---4---[C]
  \       /
   5     6
    \   /
     [D]

deg(A)=3, deg(B)=3, deg(C)=3, deg(D)=3
Four odd-degree vertices -> No Euler path exists.
Euler proved this in 1736, founding graph theory.
```

## Hamilton Paths and Circuits

Visit every VERTEX exactly once.

```
Euler:    every EDGE once    (checkable in polynomial time)
Hamilton: every VERTEX once  (NP-complete to determine!)
```

## Graph Coloring

Assign colors to vertices so no adjacent vertices share a color.

```
The chromatic number X(G) is the minimum colors needed.

    A --- B          Color with 2:
    |     |          A=Red, B=Blue
    C --- D          C=Blue, D=Red

  X(this graph) = 2 (it's bipartite)
```

```
    A --- B          Need 3 colors:
    |\ /|           A=Red, B=Blue, C=Green, D=Red
    | X  |
    |/ \|
    C --- D

  K_4 needs 4 colors. K_n needs n colors.
```

**The Four Color Theorem:** Every planar graph can be colored with at most 4 colors.
(Maps need at most 4 colors so no adjacent countries share a color.)

## Planar Graphs and Euler's Formula

A planar graph can be drawn without edge crossings.

```
Euler's Formula for connected planar graphs:
  V - E + F = 2

Where F = number of faces (regions), including the outer infinite region.

Example:
    A --- B
    |     |
    C --- D

  V = 4, E = 4, F = 2 (inner rectangle + outer region)
  4 - 4 + 2 = 2  Checks out.
```

**Consequence:** For a simple planar graph with V >= 3:

```
E <= 3V - 6

K_5 has V=5, E=10.  3(5)-6 = 9 < 10.  K_5 is NOT planar.
K_{3,3} has V=6, E=9.  3(6)-6 = 12 >= 9.  Test passes, but K_{3,3}
is still not planar (need a different test for bipartite: E <= 2V-4).
```

## Isomorphism

Two graphs are isomorphic if you can relabel vertices to make them identical.

```
  1 --- 2         A --- B
  |     |    ~    |     |
  3 --- 4         C --- D

  Mapping: 1->A, 2->B, 3->C, 4->D
  Same structure, different labels.
```

**Quick non-isomorphism checks:**
- Different number of vertices or edges
- Different degree sequences
- One has a cycle of length k, other doesn't

## Exercises

1. Draw K_5 and verify the handshaking theorem.

2. Determine if this graph has an Euler circuit:
   ```
   A --- B --- C
   |           |
   D --- E --- F
   ```

3. What is the chromatic number of C_5 (cycle of 5 vertices)?

4. Use Euler's formula to prove that the Petersen graph is not planar.
   (V=10, E=15, verify E <= 3V-6)

5. **Python challenge:** Write BFS to find the shortest path between two vertices
   in an unweighted graph using the adjacency list representation above.

6. Prove that every tree with n vertices has exactly n-1 edges.
   (Hint: induction on n.)

---

[Next: Lesson 08 — Trees Formally](08-trees-formally.md)
