# Lesson 43: Choosing the Right Paradigm

> **Analogy**: A strong engineer does not just know many tools. They can
> reach for the right tool under uncertainty. This lesson is about that
> judgment: deciding whether a problem wants divide and conquer, dynamic
> programming, greedy reasoning, or backtracking.

---

## Why This Matters

By the end of Phase 5, the challenge is no longer understanding each
paradigm in isolation. It is choosing among them.

Many problems can be described in more than one way, but only one
framing is natural and efficient.

This lesson gives a decision framework rather than another isolated set
of examples.

---

## The Core Decision Questions

When you see a new problem, ask these in order:

1. Can the problem be broken into independent smaller subproblems?
2. Do smaller subproblems overlap repeatedly?
3. Is there a locally optimal rule that looks globally safe?
4. Does the problem ask for all solutions or search under constraints?

These questions map naturally to the main paradigms.

---

## Decision Flowchart

```
  NEW PROBLEM
      |
      v
  Can I split into smaller independent pieces?
      |
   yes|-------------------------------> divide and conquer candidate
      |
      no
      v
  Do recursive subproblems repeat?
      |
   yes|-------------------------------> dynamic programming candidate
      |
      no
      v
  Is there a safe local choice rule?
      |
   yes|-------------------------------> greedy candidate
      |
      no
      v
  Am I exploring combinations under constraints?
      |
   yes|-------------------------------> backtracking candidate
```

This is not a theorem. It is a practical first-pass filter.

---

## Divide And Conquer Signals

Choose divide and conquer when:

- the problem naturally splits into independent smaller parts
- recursive calls do not heavily overlap
- there is a structured combine step

Examples:

- merge sort
- quicksort
- closest pair of points
- Karatsuba multiplication

### Common mistake

Forcing divide and conquer on problems whose subproblems overlap badly.
Those often want dynamic programming instead.

---

## Dynamic Programming Signals

Choose DP when:

- a brute-force recursive recurrence exists
- the same states repeat
- answers can be built from smaller optimal answers

Examples:

- coin change
- edit distance
- LCS
- house robber
- knapsack

### Common mistake

Trying greedy first because the problem asks for an optimum. Many
optimization problems are not greedy-safe.

---

## Greedy Signals

Choose greedy when:

- a strong local rule seems plausible
- the solution can be built incrementally
- you can support it with an exchange or stays-ahead argument

Examples:

- activity selection
- fractional knapsack
- Huffman coding
- Jump Game

### Common mistake

Mistaking a plausible heuristic for a proof.

If you cannot justify the local rule, greedy is still only a guess.

---

## Backtracking Signals

Choose backtracking when:

- you need all valid constructions or one valid construction
- the search space is combinatorial
- partial solutions can be rejected early by constraints

Examples:

- N-Queens
- Sudoku
- permutations
- subsets
- combination sum

### Common mistake

Generating all possibilities and filtering later instead of pruning
during generation.

---

## Comparison Table

```
  PARADIGM            MAIN SIGNAL                     TYPICAL COST SHAPE

  Divide and conquer  independent smaller pieces      recurrence over splits
  Dynamic programming overlapping subproblems         cached state graph/table
  Greedy             safe local choice                single pass / sorting / heap
  Backtracking       constrained search               exponential worst case, pruned
```

---

## Worked Classification Examples

### Example 1: Merge Sort

- split array into two independent halves
- no overlap between recursive subproblems
- combine by merging

Paradigm: divide and conquer.

### Example 2: Coin Change

- recursive recurrence exists
- same amounts repeat
- optimal answer built from smaller amounts

Paradigm: dynamic programming.

### Example 3: Activity Selection

- local earliest-finish rule can be proven safe
- no need to revisit earlier choices

Paradigm: greedy.

### Example 4: N-Queens

- must explore placements
- constraints prune invalid branches
- often want all solutions

Paradigm: backtracking.

---

## Hybrid Reality

Real problems are not always pure.

Examples:

- DP can be written recursively with memoization
- greedy preprocessing can simplify later DP
- backtracking may use DP-style memoization on repeated states
- divide and conquer often relies on recurrence analysis from the
  recursion lesson

The paradigms are tools, not tribes.

---

## Common Mistakes In Paradigm Selection

1. Seeing recursion and immediately assuming DP.
2. Assuming every optimization problem is greedy.
3. Missing overlap and using divide and conquer where memoization is
   needed.
4. Using brute force when the state can be compressed into DP.
5. Using backtracking where a simple greedy invariant would suffice.

---

## Exercises

1. Give one signal that points strongly toward each of the four major
   paradigms (divide and conquer, DP, greedy, backtracking). For each
   signal, name a classic problem that exhibits it.
2. Why is overlap the key separator between divide and conquer and DP?
   Draw a small recursion tree where subproblems overlap and explain why
   memoization is necessary.
3. Why does greedy require a proof rather than intuition? Construct a
   small problem where intuition suggests a greedy rule that is actually
   suboptimal.
4. Why is backtracking often the right choice for "find all valid
   solutions" problems? Explain why greedy or DP cannot enumerate all
   solutions by their nature.
5. Take one problem from a previous lesson and explain why an
   alternative paradigm would be less natural. Be specific about what
   property the chosen paradigm exploits that the alternative misses.
6. A problem asks for the maximum sum of non-adjacent elements in a
   circular array. How does the circular constraint change the paradigm
   application from the linear `house robber` case?
7. In the decision flowchart, why is "Is there a safe local choice
   rule?" positioned AFTER checking for overlapping subproblems?
   What would go wrong if you checked greedy before DP?
8. Design a problem that can be solved by either divide-and-conquer or
   DP, but one is asymptotically better. Explain the overlap property
   that makes the difference.

---

## Key Takeaways

- Strong problem solving is often about choosing the right paradigm,
  not just implementing it.
- Divide and conquer favors independent recursive structure.
- Dynamic programming favors repeated state and optimal substructure.
- Greedy favors a provably safe local choice rule.
- Backtracking favors constrained exploration with undo and pruning.

Phase 5 is now complete: you can reason about recursive structure,
split problems intelligently, reuse repeated subproblems, trust greedy
algorithms only when justified, and search combinatorial spaces with
pruning.

---

**Previous**: [Lesson 42 — Practice Problems — Algorithm Design Paradigms](./42-practice-paradigms.md)
**Next**: [Lesson 44 — String Matching Algorithms](./44-string-matching.md)