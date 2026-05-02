# Lesson 13: Shortest Path — Dijkstra's Algorithm

## The Problem

Given a weighted graph, find the path with the **lowest total weight** between two nodes. BFS finds shortest paths in unweighted graphs, but when edges have different costs (distances, times, prices), you need Dijkstra's algorithm.

```
Unweighted (BFS works):          Weighted (need Dijkstra):

  A ── B ── D                      A ─1─ B ─10─ D
  |         |                      |            |
  C ── E ── F                      C ─2─ E ─1── F
                                   A→C→E→F→D costs 1+2+1+? but
Shortest A→D: 2 edges (A-B-D)     we need edge weights to decide
```

## The Road Trip Analogy

Planning a road trip from your city to a destination. You want the **cheapest total fuel cost**, not the fewest number of roads:

```
            ┌─────────────┐
            │  Your City  │
            │     (A)     │
            └──────┬──────┘
               ┌───┴───┐
          cost:2│       │cost:5
               ↓       ↓
          ┌────┴──┐ ┌──┴────┐
          │Town B │ │Town C │
          └───┬───┘ └───┬───┘
          cost:8│       │cost:1
               ↓       ↓
            ┌──┴───────┴──┐
            │  Town D     │
            └──────┬──────┘
               cost:3│
                   ↓
            ┌──────┴──────┐
            │ Destination │
            │    (E)      │
            └─────────────┘

Path A→B→D→E: 2+8+3 = 13
Path A→C→D→E: 5+1+3 = 9  ← cheaper!

Even though A→B is closer initially,
the total cost via C is lower.
```

## Dijkstra's Algorithm: Step by Step

### The Core Idea

Always expand the **unvisited node with the lowest known cost**. Once you visit a node, its shortest distance is finalized.

### Detailed Walkthrough

```
Graph:
         2
    A ──────→ B
    |         |↖
   1|        3| \4
    ↓     1   ↓  \
    C ──────→ D ──→ E
         ↑        /
          └──────┘
              2

Find shortest path from A to all nodes.
```

```
Step 0: Initialize
  distances:  A=0,  B=∞,  C=∞,  D=∞,  E=∞
  visited:    {}
  priority queue: [(0, A)]

Step 1: Process A (cost 0) — lowest in queue
  visited: {A}
  Check neighbors:
    B: 0 + 2 = 2  (2 < ∞) → update B = 2
    C: 0 + 1 = 1  (1 < ∞) → update C = 1

  distances:  A=0,  B=2,  C=1,  D=∞,  E=∞
  queue: [(1, C), (2, B)]

Step 2: Process C (cost 1) — lowest in queue
  visited: {A, C}
  Check neighbors:
    D: 1 + 1 = 2  (2 < ∞) → update D = 2

  distances:  A=0,  B=2,  C=1,  D=2,  E=∞
  queue: [(2, B), (2, D)]

Step 3: Process B (cost 2) — tied with D, pick either
  visited: {A, C, B}
  Check neighbors:
    D: 2 + 3 = 5  (5 > 2, D already has shorter path) → no update

  distances:  A=0,  B=2,  C=1,  D=2,  E=∞
  queue: [(2, D)]

Step 4: Process D (cost 2)
  visited: {A, C, B, D}
  Check neighbors:
    E: 2 + 4 = 6  (6 < ∞) → update E = 6

  distances:  A=0,  B=2,  C=1,  D=2,  E=6
  queue: [(6, E)]

Step 5: Process E (cost 6)
  visited: {A, C, B, D, E}
  Check neighbors:
    C: 6 + 2 = 8  (8 > 1, C already has shorter path) → no update

  distances:  A=0,  B=2,  C=1,  D=2,  E=6
  queue: [] → DONE!

Final shortest distances from A:
  A → A: 0
  A → B: 2  (path: A→B)
  A → C: 1  (path: A→C)
  A → D: 2  (path: A→C→D)
  A → E: 6  (path: A→C→D→E)
```

### Visual Step-by-Step

```
Step 1: Start at A                Step 2: Process C (cheapest)
      ┌─[0]─┐                          ┌─[0]─┐
      │  A   │                          │  A   │
      └──┬───┘                          └──┬───┘
     1/    \2                          1/    \2
    ┌┴──┐  ┌┴──┐                     ┌┴──┐  ┌┴──┐
    │ C │  │ B │                     │ C │  │ B │
    │[1]│  │[2]│                     │[1]│  │[2]│
    └─┬─┘  └─┬─┘                    └─┬─┘  └─┬─┘
      1\   /3                          1\   /3
       ┌┴┴┐                            ┌┴┴┐
       │ D│                            │ D│
       │[∞]                            │[2]│  ← updated! 1+1=2
       └──┘                            └──┘

Step 3: Process B (cost 2)          Step 4: Process D (cost 2)
  B→D: 2+3=5 > 2, skip              D→E: 2+4=6

       ┌┴──┐                            ┌┴──┐
       │ D │                             │ D │
       │[2]│  ← no change               │[2]│
       └─┬─┘                            └─┬─┘
         4\                                4\
          ┌┴┐                              ┌┴┐
          │E│                              │E│
          │[∞]                             │[6]│ ← updated!
          └──┘                             └──┘
```

## Implementation in Rust

```rust
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

type WeightedGraph = HashMap<String, Vec<(String, u64)>>;

fn dijkstra(
    graph: &WeightedGraph,
    start: &str,
) -> HashMap<String, u64> {
    let mut distances: HashMap<String, u64> = HashMap::new();
    let mut heap: BinaryHeap<Reverse<(u64, String)>> = BinaryHeap::new();

    distances.insert(start.to_string(), 0);
    heap.push(Reverse((0, start.to_string())));

    while let Some(Reverse((cost, node))) = heap.pop() {
        if let Some(&best) = distances.get(&node) {
            if cost > best {
                continue;
            }
        }

        if let Some(neighbors) = graph.get(&node) {
            for (neighbor, weight) in neighbors {
                let new_cost = cost + weight;
                let current_best = distances.get(neighbor).copied().unwrap_or(u64::MAX);

                if new_cost < current_best {
                    distances.insert(neighbor.clone(), new_cost);
                    heap.push(Reverse((new_cost, neighbor.clone())));
                }
            }
        }
    }

    distances
}
```

### With Path Reconstruction

```rust
fn dijkstra_with_path(
    graph: &WeightedGraph,
    start: &str,
    end: &str,
) -> Option<(u64, Vec<String>)> {
    let mut distances: HashMap<String, u64> = HashMap::new();
    let mut previous: HashMap<String, String> = HashMap::new();
    let mut heap: BinaryHeap<Reverse<(u64, String)>> = BinaryHeap::new();

    distances.insert(start.to_string(), 0);
    heap.push(Reverse((0, start.to_string())));

    while let Some(Reverse((cost, node))) = heap.pop() {
        if node == end {
            let mut path = vec![end.to_string()];
            let mut current = end.to_string();
            while let Some(prev) = previous.get(&current) {
                path.push(prev.clone());
                current = prev.clone();
            }
            path.reverse();
            return Some((cost, path));
        }

        if let Some(&best) = distances.get(&node) {
            if cost > best {
                continue;
            }
        }

        if let Some(neighbors) = graph.get(&node) {
            for (neighbor, weight) in neighbors {
                let new_cost = cost + weight;
                let current_best = distances.get(neighbor).copied().unwrap_or(u64::MAX);

                if new_cost < current_best {
                    distances.insert(neighbor.clone(), new_cost);
                    previous.insert(neighbor.clone(), node.clone());
                    heap.push(Reverse((new_cost, neighbor.clone())));
                }
            }
        }
    }

    None
}
```

## Time Complexity

With a binary heap (BinaryHeap in Rust):

```
O((V + E) * log V)

Where V = vertices, E = edges

Each vertex is processed once:          O(V * log V) for heap operations
Each edge is examined once:             O(E * log V) for potential heap updates
Total:                                  O((V + E) * log V)
```

For dense graphs (E ≈ V^2), this is O(V^2 * log V). A Fibonacci heap can reduce this to O(V^2 + E), but in practice binary heaps are faster due to simpler constants and better cache performance.

## Limitations

### No Negative Weights

Dijkstra assumes: once you finalize a node's distance, it won't improve. Negative edges break this:

```
    A ─(1)→ B
    |       |
   (3)    (-5)
    |       |
    ↓       ↓
    C ←(1)─ D

Dijkstra would finalize B at cost 1.
But A→C→...→B might be cheaper if negative edges exist.

Actual shortest A→B: A(0)→B(1) vs A(0)→C(3)→...
With the -5 edge: A→B→D cost = 1+(-5) = -4, then D→C cost = -4+1 = -3
```

For negative weights, use **Bellman-Ford** (O(V*E)) or **SPFA**.

### Single Source

Dijkstra finds shortest paths from **one** source to **all** destinations. For all-pairs shortest paths, use **Floyd-Warshall** (O(V^3)).

## A* Algorithm: Dijkstra with a Heuristic

A* is Dijkstra plus a **heuristic function** that estimates the remaining distance to the goal. This makes it explore toward the goal first, dramatically reducing the number of nodes visited.

```
Dijkstra explores equally in all directions (like ripples):

            * * *
          * * * * *
        * * * S * * *
          * * * * *
            * * *           G (goal is far away, wasted work everywhere)


A* explores toward the goal (like a flashlight beam):

              * *
            * * * *
        S * * * * * * G     (heuristic guides search toward G)
            * * * *
              * *
```

```rust
fn a_star(
    graph: &WeightedGraph,
    start: &str,
    end: &str,
    heuristic: impl Fn(&str) -> u64,
) -> Option<(u64, Vec<String>)> {
    let mut g_score: HashMap<String, u64> = HashMap::new();
    let mut previous: HashMap<String, String> = HashMap::new();
    let mut heap: BinaryHeap<Reverse<(u64, String)>> = BinaryHeap::new();

    g_score.insert(start.to_string(), 0);
    heap.push(Reverse((heuristic(start), start.to_string())));

    while let Some(Reverse((_f_score, node))) = heap.pop() {
        if node == end {
            let cost = g_score[&node];
            let mut path = vec![end.to_string()];
            let mut current = end.to_string();
            while let Some(prev) = previous.get(&current) {
                path.push(prev.clone());
                current = prev.clone();
            }
            path.reverse();
            return Some((cost, path));
        }

        let current_g = g_score[&node];

        if let Some(neighbors) = graph.get(&node) {
            for (neighbor, weight) in neighbors {
                let tentative_g = current_g + weight;
                let best_g = g_score.get(neighbor).copied().unwrap_or(u64::MAX);

                if tentative_g < best_g {
                    g_score.insert(neighbor.clone(), tentative_g);
                    previous.insert(neighbor.clone(), node.clone());
                    let f = tentative_g + heuristic(neighbor);
                    heap.push(Reverse((f, neighbor.clone())));
                }
            }
        }
    }

    None
}
```

A* is used in:
- **GPS navigation**: heuristic = straight-line distance to destination
- **Game pathfinding**: heuristic = Manhattan distance or Euclidean distance
- **Robot motion planning**: heuristic = distance ignoring obstacles

**Admissibility**: the heuristic must **never overestimate** the true remaining cost. If it does, A* might miss the optimal path.

## Comparison of Shortest Path Algorithms

| Algorithm | Time | Space | Negative Weights | Use Case |
|-----------|------|-------|-----------------|----------|
| BFS | O(V + E) | O(V) | No weights | Unweighted graphs |
| Dijkstra | O((V+E) log V) | O(V) | No | Single-source, non-negative |
| A* | O((V+E) log V)* | O(V) | No | Single-source to single-target |
| Bellman-Ford | O(V * E) | O(V) | Yes | Negative weights, cycle detection |
| Floyd-Warshall | O(V^3) | O(V^2) | Yes | All-pairs shortest paths |

\* A* is typically faster than Dijkstra due to the heuristic pruning, but worst case is the same.

## Exercises

### Exercise 1: Implement Dijkstra's Algorithm

Build a city map and find shortest paths:

```rust
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

fn main() {
    let mut graph: HashMap<&str, Vec<(&str, u64)>> = HashMap::new();

    graph.insert("home", vec![("grocery", 4), ("park", 2), ("school", 7)]);
    graph.insert("grocery", vec![("home", 4), ("park", 1), ("office", 5)]);
    graph.insert("park", vec![("home", 2), ("grocery", 1), ("school", 3)]);
    graph.insert("school", vec![("home", 7), ("park", 3), ("office", 2)]);
    graph.insert("office", vec![("grocery", 5), ("school", 2)]);

    // Find shortest path from "home" to "office"
    // Expected: home → park → grocery → ... or home → park → school → office
}
```

### Exercise 2: Network Latency

Model a network of servers and find the minimum latency path:

```rust
struct Network {
    connections: HashMap<String, Vec<(String, u64)>>,  // server → [(server, latency_ms)]
}

impl Network {
    fn min_latency(&self, from: &str, to: &str) -> Option<u64> {
        // Use Dijkstra
        todo!()
    }

    fn all_reachable_within(&self, from: &str, max_latency: u64) -> Vec<String> {
        // Run Dijkstra, collect all nodes with distance <= max_latency
        todo!()
    }
}
```

### Exercise 3: Grid Pathfinding

Implement pathfinding on a 2D grid with obstacles. Each cell has a movement cost:

```rust
struct Grid {
    width: usize,
    height: usize,
    cells: Vec<Vec<Option<u64>>>,  // None = obstacle, Some(cost) = traversable
}

impl Grid {
    fn shortest_path(
        &self,
        start: (usize, usize),
        end: (usize, usize),
    ) -> Option<(u64, Vec<(usize, usize)>)> {
        // Neighbors are up/down/left/right (no diagonals)
        // Use Dijkstra or A* with Manhattan distance heuristic
        todo!()
    }
}

fn main() {
    // Create a 10x10 grid with some obstacles
    // Find shortest path from (0,0) to (9,9)
    // Print the grid with the path marked
}
```

---

Next: [Lesson 14: String Algorithms](./14-strings.md)
