# Lesson 50: NP-Completeness and Computational Complexity

> **Analogy**: A completed jigsaw puzzle is easy to verify: you can look
> at it and see whether every piece fits. Solving the puzzle from a pile
> of pieces is much harder. NP-completeness studies that gap between
> verifying a candidate solution and efficiently finding one.

---

## Why This Matters

By this point in the track, you know many efficient algorithms: sorting,
graph traversal, dynamic programming, greedy methods, and more. This lesson
is about recognizing when **efficient exact algorithms may not exist** —
and what to do instead.

That matters because it changes what you should do next:

- **Stop searching** for a clean polynomial-time exact solution if the
  problem is NP-hard; you are unlikely to find one unless `P = NP`
- **Look for approximation algorithms** that run in polynomial time and
  guarantee a solution within some factor of optimal
- **Look for heuristics** when guarantees are impossible but good
  solutions are sufficient
- **Restrict the problem** to a special case that may be tractable
  (e.g., trees, bounded degree, planar graphs)
- **Use exponential search with pruning** (branch and bound, backtracking)
  only when input sizes are small enough to make it feasible

NP-completeness is not only theory. It is a **practical signal** about
what kind of solution strategy is realistic. When a client asks you to
solve an optimal routing problem for 10,000 cities, knowing that TSP is
NP-hard tells you that exact optimality in polynomial time is
computationally infeasible — you should suggest approximation or
constraint relaxation instead.

---

## Complexity Classes At A High Level

### P

Problems solvable in polynomial time.

### NP

Problems whose proposed solutions can be verified in polynomial time.

### NP-hard

At least as hard as every problem in NP.

### NP-complete

Problems that are both:

- in NP
- NP-hard

### ASCII hierarchy

```
      NP-hard
   +-------------------+
   |      +-------+    |
   |      |  NP   |    |
   |      | +---+ |    |
   |      | | P | |    |
   |      | +---+ |    |
   |      +-------+    |
   +-------------------+

  NP-complete = NP ∩ NP-hard
```

---

## Reductions

The main proof tool is a polynomial-time reduction.

To show problem `B` is hard, reduce a known hard problem `A` to `B`.

That means:

> If we could solve `B` efficiently, then we could solve `A` efficiently
> too.

### Direction matters

This is a common point of confusion.

To prove `B` is hard, reduce:

$$
A \to B
$$

where `A` is already known to be hard.

### ASCII reduction diagram

```
  Known hard problem A
          |
          | polynomial-time transform
          v
     New problem B

  Efficient solver for B
          |
          v
  Efficient solver for A
```

---

## Classic NP-Complete Problems

- SAT
- 3-SAT
- Vertex Cover
- Traveling Salesman Problem (decision version)
- Subset Sum
- Clique
- Hamiltonian Cycle

These are landmarks. You do not need to memorize every proof, but you
should recognize the names and the types of structure they represent.

---

## SAT And 3-SAT

SAT asks whether a Boolean formula has a satisfying assignment.

SAT was the first problem proven NP-complete.

3-SAT is the special case where each clause has exactly three literals.
It remains NP-complete and is often used as a starting point for many
later reductions.

---

## Vertex Cover And Approximation

### Problem

Choose the smallest set of vertices touching every edge.

The exact optimization problem is NP-hard.

### 2-approximation idea

Repeatedly pick an uncovered edge `(u, v)` and add both endpoints to the
cover.

This cannot be optimal in general, but it is guaranteed to be within a
factor of 2 of optimal.

This is an example of what you do once NP-completeness tells you exact
polynomial-time algorithms are unlikely.

---

## Set Cover And Greedy Approximation

Set cover asks for the minimum number of sets whose union covers the
entire universe.

The greedy strategy repeatedly picks the set covering the most currently
uncovered elements.

It is not exact, but it has provable approximation guarantees.

This is a good reminder that once exact efficiency is unlikely, the goal
often shifts from perfection to guaranteed near-optimality.

---

## What If P = NP?

If $P = NP$, then every problem with efficiently verifiable solutions
would also have an efficient algorithm to find those solutions.

That would transform huge areas of computer science, optimization, and
cryptography.

Most researchers believe $P \ne NP$, but it remains unproven.

### Why this question matters

It is not just abstract curiosity. Modern cryptography relies heavily on
some computational problems being hard enough in practice.

---

## Practical Use Of NP-Completeness Knowledge

When you suspect a problem is NP-hard, ask:

- Is the input size small enough for backtracking or bitmask DP?
- Can I solve a restricted special case efficiently?
- Is an approximation acceptable?
- Is a heuristic acceptable?

This is the real engineering value of the theory.

---

## Exercises

1. What is the difference between solving a problem and verifying a
   proposed solution? Give a concrete example where verification is much
   easier than solving.
2. Why does reduction direction matter? Explain what happens if you
   accidentally reverse the direction in an NP-hardness proof.
3. Why is 3-SAT such a common starting point for NP-hardness proofs?
   What makes it a good "hub" problem?
4. Why does NP-completeness often push us toward approximation or
   heuristics? What is the alternative for small inputs?
5. What would change if $P = NP$? Name three areas of computer science
   or daily life that would be transformed.
6. Explain why the 2-approximation for Vertex Cover works. Is it
   possible to do better in polynomial time if $P \ne NP$?
7. A colleague claims they have a polynomial-time algorithm for the
   Traveling Salesman Problem. What should you ask them before
   believing it?
8. Design a small instance of Subset Sum that is solvable by brute force.
   How does the difficulty scale as the number of elements grows?

---

## Key Takeaways

- **NP-completeness** helps you recognize when efficient exact algorithms
  are unlikely, saving you from searching for polynomial-time solutions
  that probably do not exist.
- **P** contains problems solvable in polynomial time. **NP** contains
  problems whose proposed solutions can be verified in polynomial time.
  **NP-hard** problems are at least as hard as every problem in NP.
  **NP-complete** problems are both in NP and NP-hard.
- **Reductions** are the main tool for proving hardness: show that solving
  problem B efficiently would also solve known-hard problem A efficiently.
  Direction matters — reduce FROM a known-hard problem TO your target.
- **SAT and 3-SAT** are foundational NP-complete problems, often used as
  starting points for hardness proofs. 3-SAT's clause structure makes it
  particularly convenient for reductions.
- **Vertex Cover, TSP, Subset Sum, Clique, and Hamiltonian Cycle** are core
  landmark NP-complete problems. Recognizing their structural patterns
  helps identify new NP-hard problems.
- **Once exact tractability looks unlikely**, shift to approximation
  algorithms, heuristics, special-case restrictions, or exponential
  algorithms with pruning for small inputs.
- **Complexity theory is practical engineering guidance**: it tells you
  which solution strategies are realistic and which are wishful thinking.

The next lesson returns to advanced data structures, including skip
lists, splay trees, treaps, and Fibonacci heaps.

---

**Previous**: [Lesson 49 — Computational Geometry](./49-computational-geometry.md)
**Next**: [Lesson 51 — Advanced Data Structures](./51-advanced-data-structures.md)