# Lesson 63: Practice Problems — Hard Combined Techniques

> Hard interview problems often stop looking like pattern matching and
> start looking like synthesis. The question is no longer “which one
> pattern is this?” It becomes “which ideas have to cooperate for this to
> become tractable?”

---

## Why This Matters

Combined-technique problems are where strong preparation becomes visible.
You must:

- recognize more than one pattern
- decide which idea is primary
- ensure the combined state stays coherent
- justify why the parts fit together

This lesson focuses on four hard problems requiring multi-phase skills.

---

## Problem 1: Tree DP — Binary Tree Maximum Path Sum

**Techniques:** tree traversal + DP on subtrees

### Why it is combined

This is not merely traversal.
Each node must return a value useful to its parent while also updating a
global answer that may use both left and right contributions.

### Core distinction

At each node, there are two different quantities:

- best downward path returned upward
- best path passing through the node as a candidate global answer

### Why this matters

Many tree DP problems become manageable only after separating what is
returned upward from what is globally optimal.

---

## Problem 2: Graphs + Binary Search — Path With Minimum Effort

**Techniques:** graph/grid modeling + binary search on answer + BFS/DFS

### Why it is combined

The optimization objective is minimum maximum edge cost along a path.
That sounds like shortest path, but a cleaner solution uses:

1. guess an allowed effort threshold
2. check reachability using BFS or DFS with only allowed edges
3. binary search the threshold

### Why this is powerful

The graph traversal is only the feasibility subroutine.
The real optimization layer is binary search.

---

## Problem 3: Backtracking + Pruning + Memoization — Stickers To Spell Word

**Techniques:** search + state compression + memoization

### Why it is combined

The brute-force search over sticker choices explodes quickly.
But many branches reduce to the same remaining target state.

### Better framing

Represent the remaining unmet target compactly and memoize it.
Use pruning to avoid sticker choices that do not reduce the state.

### Key lesson

This is a classic example where backtracking becomes viable only after
you add memoization and good pruning.

---

## Problem 4: Segment Tree + Sweep Line — Rectangle Area II

**Techniques:** interval sweep + coordinate compression + segment tree

### Why it is combined

Sweeping over x-coordinates reduces the 2D geometry problem to repeated
maintenance of covered y-length.
But maintaining covered y-length dynamically requires a stronger range
structure.

### Modeling outline

1. convert rectangle edges into x-events
2. compress y-coordinates
3. sweep from left to right
4. use a segment tree to maintain currently covered y-length
5. accumulate area as width times covered height

### Why this is genuinely hard

Without sweep line, the geometry is too global.
Without a segment tree, the dynamic covered-length maintenance is too
expensive.

---

## Combined-Technique Recognition Signals

```
  SIGNAL                                      LIKELY COMBINATION

  optimize threshold + yes/no reachability    binary search + graph/greedy
  subtree answers + global best               tree traversal + DP
  huge search with repeated remainder states  backtracking + memoization
  geometry with dynamic active coverage       sweep line + range structure
```

---

## Why These Problems Feel Different

Single-pattern problems usually reveal their technique quickly.
Combined-technique problems usually require:

- one transformation to expose structure
- one supporting data structure to make it fast enough
- one argument proving the composition is valid

That extra layer is what makes them hard.

---

## Exercises

1. Why does `Binary Tree Maximum Path Sum` need two notions of "best" at
   each node? Explain the difference between the best downward path and
   the best path passing through the node as a global answer.
2. Why is `Path With Minimum Effort` often cleaner with binary search on
   answer than with direct shortest-path thinking? What is the
   monotonic feasibility condition here?
3. What clue in `Stickers to Spell Word` suggests memoization should join
   the search? How does the state space explode without it, and how does
   a compact state representation fix this?
4. Why does `Rectangle Area II` need both sweep line and a range data
   structure? What does sweep line alone miss, and what does a segment tree
   alone miss?
5. What is the main sign that a problem is really a combined-technique
   problem rather than a single-pattern problem?
6. For each of the 4 problems in this lesson, identify the primary
   pattern, the supporting structure, and the proof burden that makes the
   combination valid.
7. Explain why tree DP problems often require separating "return value"
   from "global best." What happens if you try to return the global best
   from every subtree call?
8. Design a small 3x3 grid with varying elevation costs and walk through
   how binary search on answer + BFS would find the path with minimum
   maximum elevation difference.

---

## Key Takeaways

- Hard combined-technique problems usually need both modeling and a
  supporting structure.
- Tree DP often separates upward-return values from global answers.
- Binary search can sit on top of graph or greedy feasibility checks.
- Search becomes far more powerful when pruning and memoization work
  together.
- Sweep line often needs a secondary structure to maintain active state.

The next lesson is the capstone: eight hard problems spanning the whole
track, with hints, dead ends, and full-solution framing.

---

**Previous**: [Lesson 62 — Practice Problems — Medium to Hard Transition](./62-practice-medium-hard.md)
**Next**: [Lesson 64 — Capstone Assessment — Hard Problems](./64-practice-hard-capstone.md)