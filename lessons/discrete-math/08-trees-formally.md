# Lesson 08 — Trees, Formally

> A tree is a connected graph with no cycles. It's the minimal structure
> that keeps everything reachable. Remove one edge and it disconnects.
> Add one edge and you create a cycle.

## Equivalent Definitions

For a graph G with n vertices, the following are ALL equivalent:

```
1. G is connected and has no cycles
2. G is connected and has exactly n-1 edges
3. G has no cycles and has exactly n-1 edges
4. There is exactly ONE path between any two vertices
5. G is connected, but removing any edge disconnects it
6. G has no cycles, but adding any edge creates exactly one cycle
```

Any one of these can serve as the definition of a tree.

## Tree Properties

```
Leaves:       Vertices with degree 1
Internal:     Vertices with degree > 1
Root:         A designated "top" vertex (in rooted trees)

Every tree with n >= 2 vertices has at least 2 leaves.

    A           Rooted at A:
   / \          depth(A)=0, depth(B)=depth(C)=1
  B   C         depth(D)=depth(E)=depth(F)=2
 / \   \        height = 2
D   E   F       leaves = {D, E, F}
```

## Spanning Trees

A spanning tree of graph G is a subgraph that:
- Is a tree (connected, no cycles)
- Contains ALL vertices of G

```
Original graph:          A spanning tree:
  A --- B                  A --- B
  |\ /|                  |       |
  | X  |                  |       |
  |/ \|                  |       |
  C --- D                  C     D

6 edges                    3 edges (n-1 = 4-1 = 3)
```

Every connected graph has at least one spanning tree.

### Finding Spanning Trees: DFS and BFS

```
DFS spanning tree (from A):    BFS spanning tree (from A):
  Start at A, go deep first      Start at A, go wide first

  A --> B --> D --> C             A --> B, A --> C
       (backtrack)                    B --> D

  A --- B                          A --- B
  |     |                          |
  C     D                          C     D (reached from B)
```

### Minimum Spanning Tree (MST)

In a weighted graph, the MST has minimum total edge weight.

```
    A --1-- B
    |      /|
    4    3  2
    |  /    |
    C --5-- D

Kruskal's: sort edges by weight, add if no cycle
  (A,B)=1  add
  (B,D)=2  add
  (B,C)=3  add    Now have 3 edges = n-1. Done!

MST weight = 1 + 2 + 3 = 6

    A --1-- B
            |
    C   3   2
      /     |
    C --    D

  A --- B
        |
  C     D
   \   /
    (via B)
```

```python
def kruskal(vertices, edges):
    edges.sort(key=lambda e: e[2])
    parent = {v: v for v in vertices}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        px, py = find(x), find(y)
        if px == py:
            return False
        parent[px] = py
        return True

    mst = []
    for u, v, w in edges:
        if union(u, v):
            mst.append((u, v, w))
        if len(mst) == len(vertices) - 1:
            break
    return mst
```

## Counting Trees: Cayley's Formula

How many labeled trees exist on n vertices?

```
Cayley's Formula: n^(n-2)

n=1:  1^(-1) = 1   (just the single vertex)
n=2:  2^0    = 1   (one edge: 1---2)
n=3:  3^1    = 3   (three possible trees on {1,2,3})
n=4:  4^2    = 16

For n = 3:
  1---2---3    1---3---2    2---1---3

That's the only 3 shapes (with labeled vertices).
```

## Prufer Sequences

A Prufer sequence is a bijection between labeled trees on n vertices
and sequences of length n-2 with elements from {1, ..., n}.

This is how Cayley's formula is proved: n^(n-2) possible sequences
= n^(n-2) possible trees.

### Tree to Prufer Sequence

```
Algorithm:
  Repeat n-2 times:
    1. Find the leaf with smallest label
    2. Record its neighbor in the sequence
    3. Remove the leaf

Example tree:
  1 --- 3 --- 5
        |
  2 --- 4

Step 1: Smallest leaf = 1, neighbor = 3. Sequence: [3]
        Remove 1. Remaining: 2-4-3-5
Step 2: Smallest leaf = 2, neighbor = 4. Sequence: [3, 4]
        Remove 2. Remaining: 4-3-5
Step 3: Smallest leaf = 4, neighbor = 3. Sequence: [3, 4, 3]
        Remove 4. Remaining: 3-5

Prufer sequence: [3, 4, 3]
```

### Prufer Sequence to Tree

```
Sequence: [3, 4, 3]    Vertices: {1, 2, 3, 4, 5}

Step 1: Smallest vertex NOT in sequence and not yet used as leaf = 1
        Add edge (1, 3). Remove first element: sequence becomes [4, 3]
Step 2: Smallest not in [4,3] = 2
        Add edge (2, 4). Sequence becomes [3]
Step 3: Smallest not in [3] = 4
        Add edge (4, 3). Sequence becomes []
Final:  Connect remaining two vertices: add edge (3, 5)

Edges: {(1,3), (2,4), (4,3), (3,5)}  -- Original tree recovered!
```

```python
def tree_to_prufer(n, edges):
    adj = {i: set() for i in range(1, n + 1)}
    for u, v in edges:
        adj[u].add(v)
        adj[v].add(u)

    sequence = []
    for _ in range(n - 2):
        leaf = min(v for v in range(1, n + 1) if len(adj[v]) == 1)
        neighbor = next(iter(adj[leaf]))
        sequence.append(neighbor)
        adj[leaf].remove(neighbor)
        adj[neighbor].remove(leaf)
        del adj[leaf]
    return sequence

def prufer_to_tree(sequence):
    n = len(sequence) + 2
    degree = {i: 1 for i in range(1, n + 1)}
    for v in sequence:
        degree[v] += 1

    edges = []
    for v in sequence:
        leaf = min(u for u in range(1, n + 1) if degree[u] == 1)
        edges.append((leaf, v))
        degree[leaf] -= 1
        degree[v] -= 1

    remaining = [u for u in range(1, n + 1) if degree[u] == 1]
    edges.append(tuple(remaining))
    return edges
```

## Rooted Tree Properties

```
Binary tree:     Every node has at most 2 children.
Full binary:     Every node has 0 or 2 children.
Complete binary: All levels full except possibly the last.
Perfect binary:  All internal nodes have 2 children, all leaves same depth.

Perfect binary tree of height h:
  Leaves:        2^h
  Internal nodes: 2^h - 1
  Total nodes:    2^(h+1) - 1
  Height:         log_2(n+1) - 1

         1              height 0: 1 node
       /   \
      2     3           height 1: 2 nodes
     / \   / \
    4   5 6   7         height 2: 4 nodes
                        Total: 7 = 2^3 - 1
```

## Tree Traversals (Formal View)

```
         A
        / \
       B   C
      / \
     D   E

Pre-order  (root, left, right):  A B D E C
In-order   (left, root, right):  D B E A C
Post-order (left, right, root):  D E B C A
```

Any two traversals uniquely determine the tree structure.

## Exercises

1. Prove that every tree with n >= 2 vertices has at least 2 leaves.
   (Hint: consider the longest path.)

2. Find the Prufer sequence for:
   ```
   1 --- 2 --- 3 --- 4
               |
               5
   ```

3. Reconstruct the tree from Prufer sequence [2, 2, 6, 6].

4. How many spanning trees does K_4 have? Verify with Cayley's formula.

5. **Python challenge:** Implement Prim's algorithm for MST and compare its output
   with Kruskal's on the same weighted graph.

6. A full binary tree has 15 internal nodes. How many leaves does it have?

---

[Next: Lesson 09 — Boolean Algebra](09-boolean-algebra.md)
