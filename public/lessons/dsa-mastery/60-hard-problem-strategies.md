# Lesson 60: Hard Problem Strategies

> **Analogy**: Hard problems are rarely blocked by one locked door. They
> usually have three or four doors in a row. You clear the problem only
> by combining tools: maybe a graph model first, then binary search, then
> greedy verification. This lesson is about those combinations.

---

## Why This Matters

What often makes a problem “hard” is not bigger code. It is one of these:

- multiple constraints interact
- the right abstraction is hidden
- one paradigm alone is not enough
- the proof of correctness is subtle

This lesson focuses on combination strategies.

---

## Strategy 1: Binary Search + Greedy Check

### Signal

Look for an optimization objective with a monotonic feasibility test.

Examples:

- minimum largest subarray sum
- aggressive cows / maximize minimum distance
- capacity or rate scheduling problems

### Structure

1. guess an answer
2. greedily verify whether it is feasible
3. binary search over the answer space

### Why this is powerful

The greedy part gives a yes/no decision.
The binary-search part turns that decision into an optimization.

---

## Strategy 2: DP + Graph Traversal

### Signal

Look for pathfinding where the state includes extra memory or resource
usage.

Examples:

- shortest path with `k` stops
- shortest path with keys collected
- grid traversal with obstacles that can be removed

### Key idea

The graph node alone is not the true state. You must extend the state to
include the extra resource or mode.

This is where many medium problems become hard problems.

---

## Strategy 3: Segment Tree + Coordinate Compression

### Signal

Look for:

- large value ranges
- only a small number of distinct coordinates actually matter
- range queries or updates after discretization

### Why coordinate compression matters

If coordinates go up to $10^9$, a direct array is impossible.
But if only a few thousand coordinates appear, compress them first.

After that, a segment tree or Fenwick tree may become practical.

---

## Strategy 4: Backtracking + Pruning + Memoization

### Signal

Look for exponential search where:

- many branches are obviously bad early
- subproblems repeat under the same remaining state

### Why the combination matters

Backtracking alone explores possibilities.
Pruning cuts off hopeless branches.
Memoization prevents revisiting equivalent states.

That three-part combination shows up in many hard combinatorial problems.

---

## Worked Example 1: Ship Packages Within D Days

### Surface impression

Looks like an array or prefix problem.

### Better model

This is binary search on capacity, with a greedy simulation to check
whether a candidate capacity can ship within `d` days.

### Why greedy works

For a fixed capacity, delaying a package to a later day never helps if it
already fits now.

### Why hard-problem reasoning matters

The difficulty is not writing the simulation. It is seeing the monotonic
answer space.

---

## Worked Example 2: Shortest Path To Get All Keys

### Surface impression

Looks like a grid BFS.

### Real state

The state is:

```
  (row, col, keys_mask)
```

The same cell with different key sets is not the same state.

### Why this changes everything

Without state expansion, the search is wrong.

This is a canonical hard-problem lesson:

> When constraints change what future moves are legal, the state must
> remember the relevant history.

---

## Worked Example 3: Count Smaller Numbers After Self

### Surface impression

Looks like repeated comparison from each index.

### Real challenge

You need dynamic order statistics while scanning from right to left.

### Typical strategy choices

- merge-sort counting
- Fenwick tree after coordinate compression

### Why this is hard

It requires both a transformed perspective and a supporting data
structure.

---

## Signs A Problem Is Actually Hard

- a standard pattern almost works but misses one crucial constraint
- the state needs an extra dimension
- exact search explodes and needs pruning or DP
- coordinate ranges are huge but sparse
- the correctness proof matters as much as the implementation

These are not reasons to panic. They are clues about what kind of extra
modeling is needed.

---

## Exercises

1. Why do binary-search-plus-greedy problems require a monotonic
   feasibility condition?
2. Why does adding resource state often turn a graph problem into a hard
   problem?
3. What problem signal suggests coordinate compression?
4. Why is backtracking alone often insufficient on hard combinatorial
   problems?
5. What usually distinguishes a “standard pattern” problem from a hard
   combined-technique problem?

---

## Key Takeaways

- Hard problems often require combining paradigms rather than choosing
  only one.
- State expansion is one of the most important hard-problem techniques.
- Coordinate compression often turns impossible ranges into manageable
  data-structure problems.
- Pruning and memoization are critical in difficult search spaces.
- The real challenge in hard problems is usually modeling, not typing.

The next lesson returns to practice with a structured easy-and-medium set
focused on pattern recognition and walkthrough discipline.

---

**Previous**: [Lesson 59 — Solution Analysis and Optimization](./59-solution-analysis.md)
**Next**: [Lesson 61 — Practice Problems — Easy and Medium Patterns](./61-practice-easy-medium.md)