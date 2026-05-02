# Lesson 52: Cache-Friendly Algorithms

> **Analogy**: Two people can read the same library and still work at
> very different speeds depending on whether the books they need are on
> the same shelf or scattered across the building. Modern hardware works
> similarly. Memory locality often matters as much as asymptotic runtime.

---

## Why This Matters

Big-O tells you how runtime grows with input size. It does not tell you
how well your algorithm fits real hardware.

Cache-friendly algorithms matter because modern CPUs execute billions of
instructions per second, but accessing main memory takes hundreds of
cycles. If your algorithm jumps around memory unpredictably, the CPU may
spend most of its time waiting for data — not computing.

A cache-naive algorithm with better asymptotic complexity can lose to a
cache-aware algorithm with worse Big-O on realistic input sizes. This is
one of the most important lessons for high-performance software
engineering.

This lesson covers:

- **Spatial and temporal locality**: how access patterns determine
  whether data is already in fast cache memory
- **Arrays vs pointer-heavy structures**: why contiguous memory often
  wins despite similar asymptotic complexity
- **Blocking / tiling**: restructuring algorithms to fit working sets
  into cache
- **Layout-aware algorithm design**: making data structure choices based
  on hardware memory hierarchy, not just theoretical operations

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
   look similar? What is the hardware mechanism (cache lines) that
   causes this difference?
2. What is the difference between spatial and temporal locality? Give an
   example of an algorithm that exploits each.
3. Why does matrix blocking help in practice? Calculate how many cache
   misses naive row-by-column matrix multiplication causes versus a
   blocked approach.
4. Why can traversal order change runtime significantly? Compare row-major
   versus column-major traversal of a large 2D array in terms of cache
   performance.
5. What is the appeal of cache-oblivious algorithms? How does recursive
   subdivision naturally produce cache-friendly behavior without knowing
   cache size?
6. Design a linked list traversal and an array traversal that both visit
   `n` elements. Explain why the array version is typically 5-10x faster
   on modern CPUs despite both being `O(n)`.
7. In matrix multiplication, what block size would you choose if your L1
   cache is 32KB and you are multiplying double-precision matrices? Why
   does the answer depend on cache size?
8. Explain why binary search on a sorted array can be slower than
   sequential search for very small arrays. How does cache line size
   play a role?

---

## Key Takeaways

- **Modern performance depends heavily on memory locality**, not just
  operation counts. CPUs are orders of magnitude faster than RAM; cache
  misses dominate runtime for memory-bound algorithms.
- **Spatial locality** means accessing nearby memory locations together.
  **Temporal locality** means reusing the same memory locations soon.
  Both keep data in fast cache memory.
- **Contiguous layouts** (arrays, vectors) often beat pointer-heavy layouts
  (linked lists, trees with scattered nodes) in practice because they
  maximize cache line utilization.
- **Blocking and tiling** restructure algorithms so that working sets fit
  into cache. A blocked matrix multiplication can be 5-10x faster than
  the naive triple-loop version despite both being `O(n^3)`.
- **Traversal order matters enormously**. Row-major arrays reward row-major
  traversal; column-major traversal can trigger a cache miss per element.
- **Cache-aware algorithms** are tuned to specific cache sizes.
  **Cache-oblivious algorithms** use recursive subdivision to perform well
  across all cache levels without knowing their sizes.
- **Big-O is essential, but not sufficient for high-performance
  reasoning**. Hardware-aware design completes the picture.

The next lesson applies advanced topics through a mixed practice set.

---

**Previous**: [Lesson 51 — Advanced Data Structures](./51-advanced-data-structures.md)
**Next**: [Lesson 53 — Practice Problems — Advanced Topics](./53-practice-advanced.md)