# Lesson 50: NP-Completeness and Computational Complexity

> **Analogy**: A completed jigsaw puzzle is easy to verify: you can look
> at it and see whether every piece fits. Solving the puzzle from a pile
> of pieces is much harder. NP-completeness studies that gap between
> verifying a candidate solution and efficiently finding one.

---

## Why This Matters

By this point in the track, you know many efficient algorithms. This
lesson is about learning when efficient exact algorithms may not exist.

That matters because it changes what you should do next:

- stop searching for a clean polynomial-time exact solution
- look for approximation
- look for heuristics
- restrict the problem
- use exponential search with pruning only when input sizes are small

NP-completeness is not only theory. It is a practical signal about what
kind of solution strategy is realistic.

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
   proposed solution?
2. Why does reduction direction matter?
3. Why is 3-SAT such a common starting point for NP-hardness proofs?
4. Why does NP-completeness often push us toward approximation or
   heuristics?
5. What would change if $P = NP$?

---

## Key Takeaways

- NP-completeness helps you recognize when efficient exact algorithms
  are unlikely.
- Reductions are the main tool for proving hardness.
- SAT, 3-SAT, Vertex Cover, TSP, and Subset Sum are core landmark
  problems.
- Once exact tractability looks unlikely, approximation and heuristics
  become central.
- Complexity theory is practical because it shapes which solution
  strategies are realistic.

The next lesson returns to advanced data structures, including skip
lists, splay trees, treaps, and Fibonacci heaps.

---

**Previous**: [Lesson 49 — Computational Geometry](./49-computational-geometry.md)
**Next**: [Lesson 51 — Advanced Data Structures](./51-advanced-data-structures.md)