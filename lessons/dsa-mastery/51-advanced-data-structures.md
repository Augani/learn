# Lesson 51: Advanced Data Structures

> **Analogy**: Basic data structures are like standard hand tools.
> Advanced data structures are specialized instruments: more precise,
> more situational, sometimes harder to master, but the right one can
> turn a painful problem into a manageable one.

---

## Why This Matters

Some workloads need more than arrays, heaps, hash maps, and balanced
BSTs. Advanced data structures matter when you need:

- fast meld operations
- adaptive self-adjustment
- probabilistic balancing
- range updates and advanced queries

This lesson covers:

- skip lists
- splay trees
- treaps
- Fibonacci heaps

---

## Skip Lists

You already met them in the randomized algorithms lesson. Here the focus
is as a serious data-structure alternative to balanced trees.

### Structure

Each node appears in a tower of random height.
Higher levels contain sparser express lanes.

### Intuition

Search starts at the top-left, moves right while safe, then drops down.

```
  top level:      2 -------- 10 -------- 20
  mid level:      2 ---- 7 -- 10 -- 14 -- 20
  bottom level:   2 4 7 9 10 13 14 18 20
```

Expected operations:

$$
O(\log n)
$$

Skip lists are often favored when simpler implementation and good
average behavior matter more than worst-case deterministic guarantees.

---

## Splay Trees

### Core idea

Whenever you access a node, rotate it toward the root.

The structure self-adjusts based on usage.

### Why this is interesting

Frequently accessed items move closer to the top, so future accesses to
hot elements become cheaper.

### Zig, zig-zig, zig-zag

Splay operations are combinations of rotations.

This is one of those structures that feels strange at first because it
does not maintain the rigid local balance conditions of AVL trees.
Instead, it offers strong amortized guarantees.

### Key mental model

Splay trees optimize sequences of operations, not isolated operations.

That is why amortized analysis matters so much here.

---

## Treaps

### Core idea

Combine two structures at once:

- BST order by key
- heap order by random priority

Each node has:

- `key`
- `priority`

The keys maintain BST searchability.
The priorities maintain randomized balance in expectation.

### Why it works

If priorities are random, the tree shape behaves like a random BST,
which gives expected logarithmic height.

Treaps are elegant because they turn balancing into heap-order
maintenance plus rotations.

---

## Fibonacci Heaps

### What problem are they trying to solve?

In some graph algorithms, especially Dijkstra and Prim, we perform many
priority-decrease operations.

Binary heaps support decrease-key awkwardly.
Fibonacci heaps are designed to make key decreases very cheap in the
amortized sense.

### Main ideas

- lazy consolidation
- collection of heap-ordered trees
- cut and cascading-cut behavior when structure gets too unbalanced

### Why they matter theoretically

They improve certain algorithmic bounds, especially for workloads with
many `decrease-key` operations.

### Why they matter less in practice

Despite elegant theory, Fibonacci heaps are complex and often lose to
simpler structures with better constants and cache behavior.

This is a valuable engineering lesson: better asymptotics do not always
mean better wall-clock performance.

---

## When To Choose What

```
  STRUCTURE        USEFUL WHEN

  Skip list        want simple randomized balancing
  Splay tree       access pattern has locality / repeated hot elements
  Treap            want elegant randomized BST balancing
  Fibonacci heap   theoretical decrease-key heavy workloads
```

---

## Exercises

1. Why can skip lists compete with balanced BSTs?
2. Why are splay trees analyzed amortized rather than per-operation worst
   case?
3. What makes a treap both a BST and a heap at the same time?
4. Why are Fibonacci heaps attractive in theory but often less attractive
   in practice?
5. Which of these structures would you least want to implement in an
   interview and why?

---

## Key Takeaways

- Advanced data structures exist because different workloads reward
  different tradeoffs.
- Skip lists and treaps use randomness for expected balance.
- Splay trees adapt to access patterns through self-adjustment.
- Fibonacci heaps are a classic example of asymptotic elegance versus
  implementation complexity.
- Choosing a data structure is about workload shape, not just asymptotic
  tables.

The next lesson shifts from asymptotic complexity toward hardware-aware
performance through cache-friendly algorithms.

---

**Previous**: [Lesson 50 — NP-Completeness and Computational Complexity](./50-np-completeness.md)
**Next**: [Lesson 52 — Cache-Friendly Algorithms](./52-cache-friendly-algorithms.md)