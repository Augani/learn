# Lesson 12: Graphs — Representation, BFS, DFS

## What Is a Graph?

A graph models **relationships between things**. It consists of:
- **Nodes** (also called vertices): the things
- **Edges**: the connections between things

### The Social Network Analogy

A social network is a graph:
- People are nodes
- Friendships are edges

```
Alice ─── Bob ─── Dave
  |         |
  └── Carol─┘
        |
       Eve

Nodes: {Alice, Bob, Carol, Dave, Eve}
Edges: {(Alice,Bob), (Alice,Carol), (Bob,Carol), (Bob,Dave), (Carol,Eve)}
```

Graphs are everywhere:
- Road networks (intersections = nodes, roads = edges)
- The internet (routers = nodes, cables = edges)
- Dependencies (packages = nodes, dependencies = edges)
- Databases (entities = nodes, foreign keys = edges)
- File systems (directories/files = nodes, contains = edges)

## Graph Types

### Directed vs Undirected

```
Undirected (friendship — mutual):    Directed (Twitter follow — one-way):

  A ─── B                              A ──→ B
  |     |                              ↑     |
  C ─── D                              C ←── D

  A-B means both A knows B             A→B means A follows B
  and B knows A                         but B might not follow A
```

### Weighted vs Unweighted

```
Unweighted:                          Weighted (distances):

  A ─── B                              A ──5── B
  |     |                              |       |
  C ─── D                              3       7
                                       |       |
  All edges have equal cost             C ──2── D

                                       Path A→B = 5
                                       Path A→C→D→B = 3+2+7 = 12
                                       Shortest: A→B (cost 5)
```

### Other Variations

```
Cyclic:                    Acyclic (DAG):

  A → B                      A → B
  ↑   ↓                          ↓
  D ← C                      C → D

  A→B→C→D→A (cycle!)         No way to follow edges
                              back to where you started

DAGs are used for: dependency graphs, build systems,
task scheduling, git commit history
```

## Graph Representation

### Adjacency List (Most Common)

Store each node's neighbors in a list. Use a `HashMap<Node, Vec<Node>>`:

```
Graph:
  A → B, C
  B → D
  C → B, D
  D → (none)

Adjacency List:
┌───────┬──────────┐
│ Node  │ Neighbors│
├───────┼──────────┤
│   A   │ [B, C]   │
│   B   │ [D]      │
│   C   │ [B, D]   │
│   D   │ []       │
└───────┴──────────┘
```

```rust
use std::collections::HashMap;

type Graph = HashMap<String, Vec<String>>;

fn build_graph() -> Graph {
    let mut graph = HashMap::new();
    graph.insert("A".into(), vec!["B".into(), "C".into()]);
    graph.insert("B".into(), vec!["D".into()]);
    graph.insert("C".into(), vec!["B".into(), "D".into()]);
    graph.insert("D".into(), vec![]);
    graph
}
```

**Space**: O(V + E) where V = vertices, E = edges
**Check if edge exists**: O(degree) — scan neighbor list
**Best for**: sparse graphs (most real-world graphs)

### Adjacency Matrix

A 2D array where `matrix[i][j] = 1` if there's an edge from i to j:

```
Graph:         Adjacency Matrix:
  A → B, C         A  B  C  D
  B → D        A [ 0, 1, 1, 0 ]
  C → B, D     B [ 0, 0, 0, 1 ]
  D → (none)   C [ 0, 1, 0, 1 ]
               D [ 0, 0, 0, 0 ]
```

**Space**: O(V^2) — wasteful for sparse graphs
**Check if edge exists**: O(1) — just look up matrix[i][j]
**Best for**: dense graphs, algorithms that frequently check edge existence

### When to Use Which

| | Adjacency List | Adjacency Matrix |
|---|---|---|
| Space | O(V + E) | O(V^2) |
| Check edge exists | O(degree) | O(1) |
| Iterate neighbors | O(degree) | O(V) |
| Add edge | O(1) | O(1) |
| Best for | Sparse graphs | Dense graphs |
| Real-world usage | 95% of cases | Floyd-Warshall, some special cases |

Most real-world graphs are sparse (social network: billions of users, but each has ~hundreds of friends, not billions). Use adjacency lists.

## BFS: Breadth-First Search

### The Ripple Analogy

Drop a stone in a pond. The ripples expand outward in concentric circles. BFS explores a graph the same way — **level by level**:

```
Starting from A:

Level 0:  {A}
Level 1:  {B, C}     (A's neighbors)
Level 2:  {D, E}     (B and C's unvisited neighbors)
Level 3:  {F}        (D and E's unvisited neighbors)

         A
        / \
       B   C         ← discovered at distance 1
      / \   \
     D   E   F       ← discovered at distance 2 (wait, F might be at 3)
```

### BFS Algorithm

Uses a **queue** (FIFO) and a visited set:

```
BFS from node A:

Queue:    [A]              Visited: {A}
Dequeue A, enqueue neighbors B, C

Queue:    [B, C]           Visited: {A, B, C}
Dequeue B, enqueue unvisited neighbors D

Queue:    [C, D]           Visited: {A, B, C, D}
Dequeue C, enqueue unvisited neighbors E

Queue:    [D, E]           Visited: {A, B, C, D, E}
Dequeue D, no unvisited neighbors

Queue:    [E]              Visited: {A, B, C, D, E}
Dequeue E, no unvisited neighbors

Queue:    []               Done!

Visit order: A, B, C, D, E
```

```rust
use std::collections::{HashMap, HashSet, VecDeque};

fn bfs(graph: &HashMap<String, Vec<String>>, start: &str) -> Vec<String> {
    let mut visited = HashSet::new();
    let mut queue = VecDeque::new();
    let mut order = Vec::new();

    visited.insert(start.to_string());
    queue.push_back(start.to_string());

    while let Some(node) = queue.pop_front() {
        order.push(node.clone());

        if let Some(neighbors) = graph.get(&node) {
            for neighbor in neighbors {
                if visited.insert(neighbor.clone()) {
                    queue.push_back(neighbor.clone());
                }
            }
        }
    }

    order
}
```

### BFS Finds Shortest Path (Unweighted)

BFS naturally discovers nodes in order of their **distance** from the start. The first time BFS reaches a node, it found the shortest path:

```
Find shortest path from A to F:

         A
        / \
       B   C
      /     \
     D       E
      \     /
        F

BFS levels:
Level 0: A
Level 1: B, C
Level 2: D, E
Level 3: F

Shortest path: A → B → D → F (or A → C → E → F), length 3
```

To reconstruct the path, track each node's parent:

```rust
fn shortest_path(
    graph: &HashMap<String, Vec<String>>,
    start: &str,
    end: &str,
) -> Option<Vec<String>> {
    let mut visited = HashSet::new();
    let mut queue = VecDeque::new();
    let mut parent: HashMap<String, String> = HashMap::new();

    visited.insert(start.to_string());
    queue.push_back(start.to_string());

    while let Some(node) = queue.pop_front() {
        if node == end {
            let mut path = vec![end.to_string()];
            let mut current = end.to_string();
            while let Some(prev) = parent.get(&current) {
                path.push(prev.clone());
                current = prev.clone();
            }
            path.reverse();
            return Some(path);
        }

        if let Some(neighbors) = graph.get(&node) {
            for neighbor in neighbors {
                if visited.insert(neighbor.clone()) {
                    parent.insert(neighbor.clone(), node.clone());
                    queue.push_back(neighbor.clone());
                }
            }
        }
    }

    None
}
```

**Time**: O(V + E) — visit every vertex and examine every edge
**Space**: O(V) — queue and visited set

## DFS: Depth-First Search

### The Maze Analogy

Exploring a maze: go as deep as possible down one path. When you hit a dead end, **backtrack** to the last intersection and try the next path.

```
DFS from A:

        A
       / \
      B   C
     / \   \
    D   E   F

DFS path: A → B → D (dead end) → backtrack to B → E (dead end)
          → backtrack to A → C → F (dead end) → done!

Visit order: A, B, D, E, C, F
```

### DFS Algorithm

Uses a **stack** (LIFO) or recursion:

```rust
fn dfs_iterative(graph: &HashMap<String, Vec<String>>, start: &str) -> Vec<String> {
    let mut visited = HashSet::new();
    let mut stack = vec![start.to_string()];
    let mut order = Vec::new();

    while let Some(node) = stack.pop() {
        if !visited.insert(node.clone()) {
            continue;
        }
        order.push(node.clone());

        if let Some(neighbors) = graph.get(&node) {
            for neighbor in neighbors.iter().rev() {
                if !visited.contains(neighbor) {
                    stack.push(neighbor.clone());
                }
            }
        }
    }

    order
}

fn dfs_recursive(
    graph: &HashMap<String, Vec<String>>,
    node: &str,
    visited: &mut HashSet<String>,
    order: &mut Vec<String>,
) {
    if !visited.insert(node.to_string()) {
        return;
    }
    order.push(node.to_string());

    if let Some(neighbors) = graph.get(node) {
        for neighbor in neighbors {
            dfs_recursive(graph, neighbor, visited, order);
        }
    }
}
```

**Time**: O(V + E) — same as BFS
**Space**: O(V) — stack depth (worst case for deep graphs)

## BFS vs DFS: When to Use Which

```
BFS explores wide (level by level):    DFS explores deep (path by path):

        A                                      A
       /|\                                    /
      B C D   ← BFS visits this level        B
     /| |\                                   /
    E F G H   ← then this level             E    ← DFS goes deep first
                                            /
                                           I
```

| Use Case | BFS | DFS |
|----------|-----|-----|
| Shortest path (unweighted) | Yes | No |
| Connected components | Yes | Yes |
| Cycle detection | Possible | Easier |
| Topological sort | Kahn's algorithm | Natural |
| Web crawling (pages close to start) | Yes | No |
| Solving mazes | Yes (shortest) | Yes (any path) |
| Memory usage | O(branching^depth) | O(depth) |

**Rule of thumb**: Use BFS when you need shortest path or want to explore nearby nodes first. Use DFS when you need to explore entire branches or detect cycles.

## Connected Components

A connected component is a group of nodes that can all reach each other:

```
Graph:
  A ── B      D ── E      G
  |    |      |
  C    F      F

Component 1: {A, B, C, F}
Component 2: {D, E, F}  (wait, F appears twice?)

Let's use distinct labels:
  A ── B      D ── E      H
  |    |      |
  C    F      G

Component 1: {A, B, C, F}
Component 2: {D, E, G}
Component 3: {H}
```

```rust
fn connected_components(graph: &HashMap<String, Vec<String>>) -> Vec<Vec<String>> {
    let mut visited = HashSet::new();
    let mut components = Vec::new();

    for node in graph.keys() {
        if !visited.contains(node) {
            let mut component = Vec::new();
            let mut stack = vec![node.clone()];

            while let Some(current) = stack.pop() {
                if !visited.insert(current.clone()) {
                    continue;
                }
                component.push(current.clone());

                if let Some(neighbors) = graph.get(&current) {
                    for neighbor in neighbors {
                        if !visited.contains(neighbor) {
                            stack.push(neighbor.clone());
                        }
                    }
                }
            }

            components.push(component);
        }
    }

    components
}
```

## Cycle Detection

DFS can detect cycles in directed graphs using three states: unvisited, in-progress, and completed:

```
Cycle detection in directed graph:

A → B → C → D
         ↑   |
         └───┘  ← cycle: C → D → C

DFS from A:
Visit A (in-progress)
Visit B (in-progress)
Visit C (in-progress)
Visit D (in-progress)
  D → C, but C is "in-progress" → CYCLE DETECTED!
```

## Cross-Language Comparison

| | Rust | Go | TypeScript |
|---|---|---|---|
| Graph type | No built-in | No built-in | No built-in |
| Common representation | `HashMap<N, Vec<N>>` | `map[N][]N` | `Map<N, N[]>` |
| Graph library | `petgraph` crate | `gonum/graph` | `graphlib` npm |
| Queue for BFS | `VecDeque` | `container/list` or slice | `Array` (but shift is O(n)) |

All three languages require you to build or import graph representations. None have built-in graph types.

## Exercises

### Exercise 1: Implement BFS and DFS

Build a graph from an edge list and implement both traversals:

```rust
use std::collections::{HashMap, HashSet, VecDeque};

fn build_undirected_graph(edges: &[(String, String)]) -> HashMap<String, Vec<String>> {
    todo!()
}

fn bfs(graph: &HashMap<String, Vec<String>>, start: &str) -> Vec<String> {
    todo!()
}

fn dfs(graph: &HashMap<String, Vec<String>>, start: &str) -> Vec<String> {
    todo!()
}

#[test]
fn test_traversals() {
    let edges = vec![
        ("A".into(), "B".into()),
        ("A".into(), "C".into()),
        ("B".into(), "D".into()),
        ("C".into(), "D".into()),
        ("D".into(), "E".into()),
    ];
    let graph = build_undirected_graph(&edges);

    let bfs_order = bfs(&graph, "A");
    assert!(bfs_order[0] == "A");
    assert_eq!(bfs_order.len(), 5);

    let dfs_order = dfs(&graph, "A");
    assert!(dfs_order[0] == "A");
    assert_eq!(dfs_order.len(), 5);
}
```

### Exercise 2: Find Shortest Path

Use BFS to find the shortest path between two nodes in an unweighted graph:

```rust
fn shortest_path(
    graph: &HashMap<String, Vec<String>>,
    start: &str,
    end: &str,
) -> Option<Vec<String>> {
    todo!()
}

#[test]
fn test_shortest_path() {
    // Build a graph like a small road network
    // Verify shortest path between two distant nodes
}
```

### Exercise 3: Connected Components

Find all connected components in an undirected graph:

```rust
fn find_components(graph: &HashMap<String, Vec<String>>) -> Vec<HashSet<String>> {
    todo!()
}

#[test]
fn test_components() {
    // Build a graph with 3 disconnected components
    let edges = vec![
        ("A".into(), "B".into()),
        ("B".into(), "C".into()),
        // gap
        ("D".into(), "E".into()),
        // gap
        ("F".into(), "G".into()),
    ];
    let graph = build_undirected_graph(&edges);
    let components = find_components(&graph);
    assert_eq!(components.len(), 3);
}
```

### Exercise 4: Cycle Detection

Detect if a directed graph contains a cycle:

```rust
fn has_cycle(graph: &HashMap<String, Vec<String>>) -> bool {
    // Use DFS with three states: Unvisited, InProgress, Completed
    todo!()
}
```

---

Next: [Lesson 13: Shortest Path — Dijkstra's Algorithm](./13-shortest-path.md)
