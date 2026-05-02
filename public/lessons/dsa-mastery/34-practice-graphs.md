# Lesson 34: Practice Problems — Graphs

> Graph problems often look unrelated on the surface: islands in a grid,
> flights with stop limits, course prerequisites, critical network links.
> Underneath, they reduce to a small set of patterns: traversal, shortest
> path, topological reasoning, and graph structure discovery.

---

## How to Use This Lesson

Each problem includes:

- the graph pattern it exercises
- why the brute-force approach is tempting
- a more useful mental model
- a concise optimal solution

This lesson includes:

- 3 easy problems
- 3 medium problems
- 2 hard problems

---

## Easy Problems

---

### Problem 1: Number of Islands

**Pattern:** Grid as implicit graph, flood fill

**Problem statement:**
Given a 2D grid of `'1'`s and `'0'`s, count how many connected land
components exist when adjacency is up, down, left, and right.

Every land cell is a node. Adjacency is up, down, left, right.
The problem is just connected-components counting.

**Why the brute-force instinct appears:**
It is tempting to start a fresh search from every land cell and ask,
"What island am I in?" That repeats the same work many times.

**Better mental model:**
Each time you discover an unvisited land cell, you have found a brand
new component. Flood the whole component once, and never count its
cells again.

**Hints:**

1. What graph does the grid represent implicitly?
2. When should the island count increase?
3. How can you mark a cell so you do not process it twice?

**Walkthrough:**

```
  1 1 0 0
  1 0 0 1
  0 0 1 1

  First unvisited 1 -> flood first island
  Next unvisited 1 on far right -> flood second island
  Answer = 2
```

The algorithm is:

1. scan every cell
2. when a `'1'` appears, increment the answer
3. DFS or BFS to mark the entire island visited

#### Python

```python
def num_islands(grid: list[list[str]]) -> int:
    rows = len(grid)
    cols = len(grid[0]) if rows else 0
    islands = 0

    def dfs(row: int, col: int) -> None:
        if row < 0 or row >= rows or col < 0 or col >= cols or grid[row][col] != "1":
            return
        grid[row][col] = "0"
        dfs(row + 1, col)
        dfs(row - 1, col)
        dfs(row, col + 1)
        dfs(row, col - 1)

    for row in range(rows):
        for col in range(cols):
            if grid[row][col] == "1":
                islands += 1
                dfs(row, col)

    return islands
```

---

### Problem 2: Flood Fill

**Pattern:** BFS or DFS component expansion

**Problem statement:**
Given a starting pixel and a new color, recolor the entire connected
region that originally had the start pixel's color.

The state-space is a grid component of same-colored cells.

**Key idea:**
This is the same connected-component logic as `number of islands`, but
the stopping rule is based on matching the original color.

**Walkthrough:**

```
  Original color at (sr, sc) = 2

  Recolor every connected 2 reachable from the start.
  Stop whenever you hit:
  - boundary
  - a different color
  - an already recolored cell
```

If the original color already equals the target color, return early.
Otherwise recursion can bounce forever between cells of the same color.

#### TypeScript

```typescript
function floodFill(image: number[][], sr: number, sc: number, color: number): number[][] {
  const original = image[sr][sc];
  if (original === color) {
    return image;
  }

  const rows = image.length;
  const cols = image[0]?.length ?? 0;

  function dfs(row: number, col: number): void {
    if (row < 0 || row >= rows || col < 0 || col >= cols || image[row][col] !== original) {
      return;
    }
    image[row][col] = color;
    dfs(row + 1, col);
    dfs(row - 1, col);
    dfs(row, col + 1);
    dfs(row, col - 1);
  }

  dfs(sr, sc);
  return image;
}
```

---

### Problem 3: Find If Path Exists

**Pattern:** Reachability with BFS/DFS

**Problem statement:**
Given an undirected graph, determine whether `source` can reach
`destination`.

The whole problem is: can traversal from `source` reach `destination`?

**Brute-force thought:**
Try every possible path from the source. That explodes combinatorially.

**Optimal idea:**
Reachability does not require enumerating paths. A single BFS or DFS
with a visited set is enough.

#### Rust

```rust
use std::collections::{HashMap, HashSet, VecDeque};

fn valid_path(edges: &[(i32, i32)], source: i32, destination: i32) -> bool {
    let mut graph: HashMap<i32, Vec<i32>> = HashMap::new();
    for &(u, v) in edges {
        graph.entry(u).or_default().push(v);
        graph.entry(v).or_default().push(u);
    }

    let mut queue = VecDeque::from([source]);
    let mut visited = HashSet::from([source]);

    while let Some(node) = queue.pop_front() {
        if node == destination {
            return true;
        }
        if let Some(neighbors) = graph.get(&node) {
            for &neighbor in neighbors {
                if visited.insert(neighbor) {
                    queue.push_back(neighbor);
                }
            }
        }
    }

    false
}
```

---

## Medium Problems

---

### Problem 4: Course Schedule

**Pattern:** Cycle detection in a directed graph

**Problem statement:**
Given prerequisite pairs, determine whether all courses can be finished.

The courses and prerequisites form a directed graph. The question is
whether the graph is acyclic.

**Why this matters:**
This is the canonical "hidden DAG" interview problem.

**Brute-force instinct:**
Try to simulate all possible course orders. That is unnecessary.

**Optimal model:**
The answer is `true` exactly when the prerequisite graph has no
directed cycle.

Use either:

- Kahn's algorithm
- DFS with visiting/visited states

**Walkthrough:**

If Kahn's algorithm processes all nodes, the graph is acyclic.
If some nodes never reach in-degree zero, they are trapped behind a
cycle.

#### Python

```python
from collections import deque


def can_finish(num_courses: int, prerequisites: list[list[int]]) -> bool:
  graph = [[] for _ in range(num_courses)]
  indegree = [0] * num_courses

  for course, prereq in prerequisites:
    graph[prereq].append(course)
    indegree[course] += 1

  queue = deque(course for course in range(num_courses) if indegree[course] == 0)
  processed = 0

  while queue:
    course = queue.popleft()
    processed += 1
    for neighbor in graph[course]:
      indegree[neighbor] -= 1
      if indegree[neighbor] == 0:
        queue.append(neighbor)

  return processed == num_courses
```

---

### Problem 5: Network Delay Time

**Pattern:** Single-source shortest path on weighted graph

**Problem statement:**
Given travel times as directed weighted edges and a starting node,
return how long it takes for all nodes to receive the signal, or `-1`
if some node is unreachable.

This is Dijkstra on a directed weighted graph. After computing shortest
distances from the source, the answer is the maximum finite distance if
all nodes are reachable.

**Brute-force thought:**
Enumerate every path from the source to every node. That is far too
expensive.

**Optimal idea:**
This is exactly single-source shortest path on a graph with
non-negative weights.

#### TypeScript

```typescript
function networkDelayTime(times: number[][], n: number, k: number): number {
  const graph: Array<Array<[number, number]>> = Array.from({ length: n + 1 }, () => []);
  for (const [source, target, weight] of times) {
    graph[source].push([target, weight]);
  }

  const distances = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  distances[k] = 0;
  const heap: Array<[number, number]> = [[0, k]];

  while (heap.length > 0) {
    heap.sort((first, second) => first[0] - second[0]);
    const [cost, node] = heap.shift() as [number, number];
    if (cost > distances[node]) {
      continue;
    }

    for (const [neighbor, weight] of graph[node]) {
      const nextCost = cost + weight;
      if (nextCost < distances[neighbor]) {
        distances[neighbor] = nextCost;
        heap.push([nextCost, neighbor]);
      }
    }
  }

  let answer = 0;
  for (let node = 1; node <= n; node += 1) {
    if (!Number.isFinite(distances[node])) {
      return -1;
    }
    answer = Math.max(answer, distances[node]);
  }
  return answer;
}
```

---

### Problem 6: Cheapest Flights Within K Stops

**Pattern:** Shortest path with extra state

**Problem statement:**
Find the cheapest route from `src` to `dst` using at most `k` stops.

The trap is treating this like plain Dijkstra on node alone.

The real state is:

- current city
- number of stops used so far

This is a graph problem on an expanded state space.

**Walkthrough:**

Two visits to the same city are not equivalent if they used different
numbers of stops. A more expensive arrival with fewer stops may still
lead to a valid final answer, while a cheaper arrival with too many
stops may be useless.

That is why the state must include both location and stop count.

#### Python

```python
import heapq


def find_cheapest_price(
  n: int,
  flights: list[list[int]],
  src: int,
  dst: int,
  k: int,
) -> int:
  graph = [[] for _ in range(n)]
  for start, end, price in flights:
    graph[start].append((end, price))

  heap: list[tuple[int, int, int]] = [(0, src, 0)]
  best: dict[tuple[int, int], int] = {(src, 0): 0}

  while heap:
    cost, node, used_edges = heapq.heappop(heap)
    if node == dst:
      return cost
    if used_edges == k + 1:
      continue

    for neighbor, price in graph[node]:
      next_state = (neighbor, used_edges + 1)
      next_cost = cost + price
      if next_cost < best.get(next_state, float("inf")):
        best[next_state] = next_cost
        heapq.heappush(heap, (next_cost, neighbor, used_edges + 1))

  return -1
```

---

## Hard Problems

---

### Problem 7: Alien Dictionary

**Pattern:** Topological sort from inferred precedence constraints

**Problem statement:**
Given words sorted according to an unknown alphabet, recover one valid
character ordering if possible.

Compare adjacent words. The first differing letters reveal an ordering
edge. Then perform topological sort on the resulting directed graph.

The challenge is not graph traversal. It is building the graph from the
word list correctly.

**Key pitfall:**
If a longer word appears before its own prefix, the input is invalid.

Example:

```
  "abc"
  "ab"

  Invalid, because no alphabet order can make the longer word come first
  when the shorter word is its full prefix.
```

**Brute-force to optimal:**

- brute force: guess a character order and test it
- optimal: infer only the necessary precedence edges, then topologically sort

---

### Problem 8: Critical Connections in a Network

**Pattern:** Bridges, low-link values

**Problem statement:**
Return every edge whose removal disconnects the graph.

An edge is critical if removing it disconnects the graph.

This is a low-link problem closely related to Tarjan-style reasoning.

**Key insight:**
For a DFS tree edge `u -> v`, if the subtree rooted at `v` cannot reach
`u` or any ancestor of `u` using a back edge, then `(u, v)` is a bridge.

#### TypeScript

```typescript
function criticalConnections(n: number, connections: number[][]): number[][] {
  const graph: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of connections) {
    graph[u].push(v);
    graph[v].push(u);
  }

  const discovery = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const bridges: number[][] = [];
  let time = 0;

  function dfs(node: number, parent: number): void {
    discovery[node] = time;
    low[node] = time;
    time += 1;

    for (const neighbor of graph[node]) {
      if (neighbor === parent) {
        continue;
      }
      if (discovery[neighbor] === -1) {
        dfs(neighbor, node);
        low[node] = Math.min(low[node], low[neighbor]);
        if (low[neighbor] > discovery[node]) {
          bridges.push([node, neighbor]);
        }
      } else {
        low[node] = Math.min(low[node], discovery[neighbor]);
      }
    }
  }

  dfs(0, -1);
  return bridges;
}
```

---

## Pattern Identification Table

```
  PROBLEM                            PATTERN

  Number of islands                  grid DFS/BFS, components
  Flood fill                         component expansion
  Path exists                        reachability
  Course schedule                    DAG / cycle detection
  Network delay time                 Dijkstra
  Cheapest flights within K stops    shortest path with augmented state
  Alien dictionary                   graph construction + topo sort
  Critical connections               low-link / bridge detection
```

---

## Brute Force to Optimal Thinking

- `number of islands`: brute force asks separately from each cell;
  optimal thinking marks an entire component once.
- `network delay time`: brute force tries many routes; optimal thinking
  uses shortest-path relaxation.
- `cheapest flights within K stops`: brute force enumerates all paths;
  optimal thinking treats `(node, stops)` as the state.
- `alien dictionary`: brute force guesses letter orders; optimal
  thinking infers only necessary constraints and topologically sorts.
- `critical connections`: brute force removes each edge and rechecks
  connectivity; optimal thinking discovers bridges in one DFS.

---

## Exercises

1. Explain why grids are often implicit graphs. Draw a small 3x3 grid
   with obstacles and list the implicit edges from the center cell.
2. For `course schedule`, compare Kahn's algorithm vs DFS cycle checks.
   When would you prefer each, and what does Kahn's algorithm provide
   that DFS cycle detection does not?
3. Why does `cheapest flights within K stops` need extra state? Explain
   why Dijkstra on `(city)` alone fails and why `(city, stops)` is the
   minimal correct state.
4. Explain why `alien dictionary` is a graph-construction problem first.
   Describe the exact inference rule for extracting edges from adjacent
   words and the invalid-input case that requires special handling.
5. What low-link signal identifies a bridge? Explain the relationship
   between `discovery[u]`, `low[v]`, and the bridge condition
   `low[v] > discovery[u]` for a tree edge `u -> v`.
6. In `number of islands`, explain why DFS and BFS are both correct but
   may differ in memory usage. What determines which is better for a
   very wide grid versus a very deep grid?
7. For `network delay time`, explain why the answer is the maximum finite
   distance from the source, not the sum. Construct a counterexample
   where summing all distances gives the wrong answer.
8. Trace the `critical connections` algorithm on a simple graph with
   4 nodes and 4 edges forming a square with one diagonal. Which edges
   are bridges, and what do the `discovery` and `low` values look like?

---

## Key Takeaways

- Most graph interview problems reduce to a small set of patterns.
- The modeling step is often harder than the traversal itself.
- Weighted graphs require cost-aware algorithms, not plain BFS.
- Constraint problems often hide a topological sort underneath.
- Low-link ideas show up beyond SCCs, including bridges and articulation points.

The next lesson focuses entirely on that modeling skill: how to notice
when a problem should be turned into a graph in the first place.

---

**Previous**: [Lesson 33 — Strongly Connected Components](./33-strongly-connected-components.md)
**Next**: [Lesson 35 — Graph Modeling Techniques](./35-graph-modeling.md)