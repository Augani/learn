# Lesson 52: Cache-Friendly Algorithms

> **Analogy**: Two people can read the same library and still work at
> very different speeds depending on whether the books they need are on
> the same shelf or scattered across the building. Modern hardware works
> similarly. Memory locality often matters as much as asymptotic runtime.

---

## Why This Matters

Big-O tells you how runtime grows. It does not tell you how well your
algorithm fits real hardware.

Cache-friendly algorithms matter because CPUs are much faster than main
memory. If your algorithm jumps around memory unpredictably, the CPU may
spend much of its time waiting for data.

This lesson covers:

- spatial and temporal locality
- arrays vs pointer-heavy structures
- blocking / tiling
- layout-aware algorithm design

---

## The Memory Hierarchy

At a high level:

```
  registers
     |
  L1 cache
     |
  L2/L3 cache
     |
  RAM
     |
  disk / SSD
```

The farther away the data is, the more expensive it is to access.

---

## Locality

### Spatial locality

If you access one memory location, nearby locations are likely to be
useful soon.

### Temporal locality

If you access a value now, you may access it again soon.

Algorithms that exploit these patterns often outperform theoretically
similar algorithms that do not.

---

## Arrays vs Linked Structures

Arrays are often cache-friendly because adjacent elements are stored
contiguously.

Linked lists and pointer-heavy trees can be slower because each access
may jump to a distant memory location.

This is one reason arrays and vectors are so dominant in high-performance
software.

### Example intuition

```
  array scan:       data data data data data
  linked traversal: data -> far jump -> far jump -> far jump
```

The asymptotic cost may look similar. The hardware cost is not.

---

## Blocking / Tiling

### Problem

Matrix algorithms often revisit data in patterns that exceed cache.

### Solution

Process data in blocks that fit better into cache.

Instead of multiplying matrices by traversing enormous rows and columns
naively, divide them into smaller tiles.

This raises reuse of recently loaded data.

### Why this matters

Cache-aware matrix multiplication can dramatically outperform the naive
triple-loop version, even though both are still written as $O(n^3)$
algorithms.

---

## Traversal Order Matters

Row-major arrays reward row-major traversal.

If you traverse by columns in row-major memory, each step may jump far
away in memory, destroying locality.

This is one of the simplest examples of hardware-aware algorithm design.

---

## Cache-Oblivious Thinking

Some algorithms are designed to perform well across cache levels without
being explicitly tuned to a particular cache size.

The guiding principle is often recursive subdivision:

- split the problem
- keep working on smaller pieces
- let those pieces eventually fit naturally into cache

Cache-oblivious algorithms are elegant because they use structure rather
than fixed machine parameters.

---

## Practical Lessons

- better asymptotics do not guarantee better real performance
- contiguous memory is often a major advantage
- branch predictability and layout matter too
- engineering for real machines means caring about locality

This lesson is a reminder that algorithm design does not stop at the RAM
model.

---

## Exercises

1. Why can arrays outperform linked structures even when asymptotic costs
   look similar?
2. What is the difference between spatial and temporal locality?
3. Why does matrix blocking help in practice?
4. Why can traversal order change runtime significantly?
5. What is the appeal of cache-oblivious algorithms?

---

## Key Takeaways

- Modern performance depends heavily on memory locality.
- Contiguous layouts often beat pointer-heavy layouts in practice.
- Blocking and traversal order can matter enormously.
- Cache-aware and cache-oblivious design extend algorithmic thinking to
  real hardware.
- Big-O is essential, but not sufficient for high-performance reasoning.

The next lesson applies advanced topics through a mixed practice set.

---

**Previous**: [Lesson 51 — Advanced Data Structures](./51-advanced-data-structures.md)
**Next**: [Lesson 53 — Practice Problems — Advanced Topics](./53-practice-advanced.md)