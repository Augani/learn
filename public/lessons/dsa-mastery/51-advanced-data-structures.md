# Lesson 51: Advanced Data Structures

> **Analogy**: Basic data structures are like standard hand tools.
> Advanced data structures are specialized instruments: more precise,
> more situational, sometimes harder to master, but the right one can
> turn a painful problem into a manageable one.

---

## Why This Matters

Some workloads need more than arrays, heaps, hash maps, and balanced
BSTs. Standard structures are excellent general-purpose tools, but
specialized problems demand specialized instruments:

- **Fast meld operations**: merging two priority queues efficiently, needed
  in some graph algorithms and scheduling problems
- **Adaptive self-adjustment**: frequently accessed items should become
  cheaper to reach automatically, as in caches and frequently queried
  databases
- **Probabilistic balancing**: simpler code with expected good
  performance, easier to implement correctly in interviews and production
- **Range updates and advanced queries**: maintaining aggregates over
  intervals, handling dynamic order statistics

This lesson covers structures that extend your toolkit beyond the basics:

- **Skip lists**: randomized multi-level linked lists that compete with
  balanced BSTs but with simpler implementation
- **Splay trees**: self-adjusting BSTs that move accessed nodes to the
  root, optimizing for access locality
- **Treaps**: combining BST key ordering with heap priority ordering for
  elegant randomized balancing
- **Fibonacci heaps**: theoretically optimal decrease-key for Dijkstra
  and Prim, though often impractical in real code

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

1. Why can skip lists compete with balanced BSTs? What is the expected
   height of a skip list with `n` elements?
2. Why are splay trees analyzed amortized rather than per-operation worst
   case? Describe a sequence of operations where splay trees perform
   excellently and another where they perform poorly.
3. What makes a treap both a BST and a heap at the same time? How do
   rotations preserve both invariants when priorities violate heap order?
4. Why are Fibonacci heaps attractive in theory but often less attractive
   in practice? Compare their theoretical decrease-key cost to that of a
   binary heap.
5. Which of these structures would you least want to implement in an
   interview and why? Which would you most want to describe conceptually?
6. Explain why splay trees can be better than static BSTs for workloads
   with strong access locality. What is the "working set" property?
7. In a treap, if priorities are assigned randomly and independently,
   why does the expected tree height resemble that of a random BST?
8. Describe a scenario where a Fibonacci heap genuinely improves the
   asymptotic bound of an algorithm over binary heaps. Is the improvement
   visible in practice?

---

## Key Takeaways

- **Advanced data structures** exist because different workloads reward
  different tradeoffs beyond what standard arrays, hash maps, and heaps
  can offer.
- **Skip lists** use random tower heights to achieve expected
  `O(log n)` operations with simpler code than deterministic balanced
  trees. They are often preferred when implementation simplicity matters.
- **Splay trees** adapt to access patterns through self-adjustment.
  Frequently accessed items move to the root, yielding excellent
  amortized performance for workloads with locality (working set property).
- **Treaps** combine BST key ordering with heap priority ordering. Random
  priorities produce expected balanced trees with elegant insertion logic.
- **Fibonacci heaps** offer `O(1)` amortized insert and decrease-key,
  improving theoretical bounds for Prim and Dijkstra. However, their
  implementation complexity and poor cache behavior often make binary
  heaps faster in practice.
- **Choosing a data structure** is about workload shape, cache behavior,
  and implementation constraints — not just asymptotic tables.

The next lesson shifts from asymptotic complexity toward hardware-aware
performance through cache-friendly algorithms.

---

**Previous**: [Lesson 50 — NP-Completeness and Computational Complexity](./50-np-completeness.md)
**Next**: [Lesson 52 — Cache-Friendly Algorithms](./52-cache-friendly-algorithms.md)