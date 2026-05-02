# Lesson 58: Advanced LeetCode Patterns

> **Analogy**: Basic patterns are like knowing common road signs.
> Advanced patterns are like understanding the traffic system of a whole
> city: the rules interact, detours matter, and sometimes the obvious
> route is wrong because the real structure is hidden underneath.

---

## Why This Matters

Harder interview problems often combine ideas from earlier phases. They
rarely announce themselves as “this is a DP problem” or “this is a graph
problem.” Instead, they mix constraints and ask you to discover the
correct state model.

This lesson surveys advanced families:

- graph patterns
- tree patterns
- DP patterns
- advanced combinatorial patterns

The point is to build a map of the territory, not to memorize one trick
per topic.

---

## Advanced Pattern Catalog

```
  GRAPH                TREE                 DP                    COMBINATORIAL

  grid BFS/DFS         LCA                  state-machine DP      bitmask DP
  topological order    path-sum variants    interval DP           meet-in-the-middle
  shortest-path vars   serialization        digit DP              inclusion-style reasoning
```

---

## Graph Pattern 1: BFS And DFS On Grids

### Signal

Look for:

- 2D board or matrix
- movement rules like up/down/left/right
- connected components, shortest steps, flood fill, island counting

### Key choice

- use BFS for shortest path in an unweighted grid
- use DFS for reachability, components, or exhaustive traversal

### Visual

```
  S . # .
  . . # .
  # . . T

  BFS explores by layers from S
```

### Common trap

Candidates sometimes reach for Dijkstra when BFS is enough because every
edge has equal cost.

---

## Graph Pattern 2: Topological Sort Problems

### Signal

Look for dependency language:

- “must come before”
- prerequisites
- ordering with constraints
- cycle means impossible

### Why this matters

The problem is often not about arbitrary graph traversal. It is about
whether a DAG ordering exists and how to construct it.

### Typical examples

- course schedule
- alien dictionary
- build systems and dependency graphs

---

## Graph Pattern 3: Shortest Path Variants

### Signal

Look for path optimization under weighted or stateful constraints.

The actual shortest-path state may be:

- node only
- node + stops used
- node + keys collected
- node + parity / mode / resource state

### Important lesson

Many “hard graph” problems are actually about expanding the state space,
not inventing a new graph algorithm.

That means the question becomes:

> What does a state really need to remember?

---

## Tree Pattern 1: Lowest Common Ancestor

### Signal

Look for relationships between two nodes in a tree:

- common ancestor
- path between nodes
- distance through shared ancestry

### Why it matters

LCA often turns a path question into a local ancestor question.

This pattern appears repeatedly in advanced tree questions because it
compresses global tree reasoning into a structured primitive.

---

## Tree Pattern 2: Path Sum Variants

### Signal

Look for:

- root-to-leaf constraints
- downward path conditions
- counts of paths with a target value

### Why prefix ideas reappear

Some tree path-sum problems are really prefix-sum problems on root-to-
node paths. The tree is changing the traversal, not the core algebra.

That is a recurring advanced theme:

> old ideas reappear in new containers

---

## Tree Pattern 3: Serialization And Reconstruction

### Signal

Look for conversion between structure and representation:

- serialize / deserialize tree
- build tree from traversals
- encode null positions explicitly

### What this tests

These problems test whether you understand what information uniquely
determines structure.

---

## DP Pattern 1: State-Machine DP

### Signal

Look for problems where the answer depends on a small mode or status:

- holding stock or not
- number of transactions used
- cooldown or waiting state
- previous action constrains next action

### Core idea

Represent each mode explicitly as a state.

Examples:

- stock-buy-sell problems
- alternating-choice sequences
- cooldown scheduling variants

---

## DP Pattern 2: Interval DP

### Signal

Look for decisions made over contiguous intervals where a split point or
chosen last action matters.

Typical examples:

- burst balloons
- matrix chain multiplication
- palindrome partitioning variants

### Why it is hard

The subproblem is not “prefix up to i.”
It is usually “best answer on interval `[l, r]`.”

That change in state model is what makes interval DP feel advanced.

---

## DP Pattern 3: Digit DP

### Signal

Look for counting numbers with digit constraints up to some bound.

Examples:

- count numbers without repeated digits
- count numbers satisfying digit-sum constraints
- count values in a range with restricted patterns

### State idea

The DP often tracks:

- current digit position
- whether we are tight to the bound
- extra condition state such as used digits or accumulated sum

Digit DP is a good example of a pattern that is difficult until the
state is named clearly.

---

## DP Pattern 4: Bitmask DP

### Signal

Look for small `n` with combinatorial subset states.

Examples:

- traveling salesman on small graphs
- assignment and seating problems
- visiting subsets of nodes

### Key mental model

The mask *is the state*.

Once that clicks, many “impossible-looking” problems become standard DP.

---

## Advanced Combinatorial Pattern 1: Meet-In-The-Middle

### Signal

Look for exponential search on `n` around 30 to 40, where `2^n` is too
large but `2^(n/2)` may be manageable.

### Idea

Split the set into two halves, enumerate each half, then combine results
efficiently.

This pattern is a good reminder that exponentials are not all equally
bad.

---

## Advanced Combinatorial Pattern 2: Non-Obvious Transformations

Some hard problems are solved only after you transform them:

- array problem -> graph problem
- path problem -> DP on states
- subarray problem -> prefix counting
- exact optimization -> approximation or bounded search

This is often what separates hard problems from medium problems.

The obstacle is not coding. The obstacle is modeling.

---

## Exercises

1. Why is "state expansion" such a common idea in advanced graph
   problems? Explain how a grid-with-keys problem turns BFS into a
   multi-dimensional state-space search.

   State expansion is a common idea in advanced graph problems because it allows us to model complex problems by adding more dimensions to the state space. For example, in a grid-with-keys problem, we can start with a simple BFS state that only tracks the current position. However, as we add more constraints such as keys and locks, we need to expand the state space to track the keys we have collected and the locks we have opened. This expansion of the state space allows us to model the problem more accurately and find the optimal solution.

2. What signal distinguishes interval DP from prefix DP? Give a problem
   where prefix DP fails and interval DP is needed.

   The signal that distinguishes interval DP from prefix DP is the need to make decisions over contiguous intervals where a split point or chosen last action matters. A problem where prefix DP fails and interval DP is needed is the burst balloons problem. In this problem, we need to find the maximum coins we can collect by bursting balloons in a specific order. The problem requires us to make decisions over contiguous intervals (the balloons) and the split point (the balloon we choose to burst next) matters.

3. Why does digit DP need a "tight" flag? Explain what goes wrong if you
   ignore whether the prefix already matches the bound.

   Digit DP needs a "tight" flag because it allows us to track whether the prefix we have constructed so far already matches the bound. If we ignore this flag, we may end up counting prefixes that exceed the bound, which is incorrect. For example, if we are counting numbers without repeated digits up to a certain bound, we need to make sure that the prefix we have constructed so far does not exceed the bound. If it does, we should not count it.

4. When is meet-in-the-middle more appropriate than bitmask DP? Compare
   the runtime for `n = 40` using both approaches.

   Meet-in-the-middle is more appropriate than bitmask DP when the size of the input `n` is around 30 to 40, where `2^n` is too large but `2^(n/2)` may be manageable. For `n = 40`, the runtime of meet-in-the-middle is `O(2^(n/2)) = O(2^20)`, which is much faster than the runtime of bitmask DP, which is `O(2^n) = O(2^40)`.

5. Why do hard problems so often require a problem transformation first?
   Give an example of an array problem that becomes a graph problem.

   Hard problems often require a problem transformation first because it allows us to model the problem more accurately and find the optimal solution. An example of an array problem that becomes a graph problem is the minimum spanning tree problem. In this problem, we are given an array of edges and we need to find the minimum spanning tree. We can transform this problem into a graph problem by constructing a graph where the edges are the elements of the array and the nodes are the vertices of the graph. We can then use graph algorithms such as Kruskal's algorithm to find the minimum spanning tree.

6. In tree path-sum problems, why must you distinguish between the best
   downward path (return value) and the best path anywhere (global answer)?
7. Explain why state-machine DP is the right tool for stock problems with
   cooldown. How many states are needed, and what transitions connect them?
8. Design a small graph problem where topological sort is the first move,
   but you still need dynamic programming on the resulting DAG to compute
   an optimal path. What does each layer contribute?

---

## Key Takeaways

- Advanced patterns often combine earlier ideas rather than replacing
  them.
- Hard graph problems are frequently state-modeling problems.
- Tree problems often reuse prefix, path, and ancestor ideas in new
  forms.
- Advanced DP depends on naming the correct state precisely.
- Many hard problems become manageable only after a transformation.

The next lesson turns from pattern catalogs back to the craft of
analyzing and optimizing a concrete solution.

---

**Previous**: [Lesson 57 — The Brute-Force-to-Optimal Methodology](./57-brute-force-to-optimal.md)
**Next**: [Lesson 59 — Solution Analysis and Optimization](./59-solution-analysis.md)