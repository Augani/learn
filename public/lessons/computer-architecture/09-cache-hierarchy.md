# Lesson 09: Cache Hierarchy (L1, L2, L3)

> **The one thing to remember**: Caches exist because CPUs are much faster than
> main memory. The cache hierarchy keeps the most likely-needed data closer to
> the processor so it does not spend all its time waiting on RAM.

---

## Start With Distance and Delay

Imagine working at a desk.

- the pen in your hand is instant
- the notebook on the desk is close
- the book on the shelf is farther away
- the archive in the basement takes much longer

You arrange your workspace so frequently used things stay near you.

The cache hierarchy is the processor doing the same thing with data and instructions.

---

## Why Caches Exist

CPUs can perform arithmetic extremely quickly, but fetching data from RAM is much slower.

If every load had to wait for main memory, the execution units would spend huge amounts of time idle.

Caches reduce that pain by storing copies of recently or nearby used memory in smaller, faster structures.

```
MEMORY HIERARCHY

  Registers   fastest, tiniest
  L1 cache    very fast, very small
  L2 cache    fast, larger
  L3 cache    slower, larger again
  RAM         much larger, much slower
  SSD/Disk    huge, persistent, far slower
```

The further away you go, the more capacity you get, but the more latency you pay.

---

## What a Cache Stores

Caches do not usually fetch one byte at a time. They work with **cache lines**,
which are fixed-size chunks of memory, often 64 bytes on modern systems.

Why a whole chunk?

Because if you touch one location, there is a decent chance you will soon touch nearby locations too.

That is **spatial locality**.

```
CACHE LINE IDEA

  RAM addresses:
  1000 1001 1002 1003 ... 1063

  Cache brings in a whole nearby block,
  not just a single byte.
```

This is why arrays and contiguous data structures often perform well.

---

## The Three Main Levels

### L1 Cache

- smallest
- fastest cache level
- typically split into instruction cache and data cache on many CPUs
- very close to the execution core

### L2 Cache

- larger than L1
- slower than L1, still much faster than RAM
- often private to a core or core cluster

### L3 Cache

- larger again
- slower than L2
- often shared across multiple cores

You do not need the exact sizes to understand the pattern. The important rule is:

> Small and close is fast. Large and far is slower.

---

## What Happens on a Cache Hit or Miss

When the CPU needs data:

1. check L1
2. if not there, check L2
3. if not there, check L3
4. if not there, fetch from RAM

If the data is found at a given level, that is a **cache hit**.
If not, it is a **cache miss**.

```
LOOKUP PATH

  CPU -> L1 ?
         hit: use it
         miss -> L2 ?
                  miss -> L3 ?
                           miss -> RAM
```

The performance difference between an L1 hit and a RAM miss is enormous relative to CPU timescales.

---

## Why Small Caches Still Work So Well

At first, caches look tiny compared with RAM. So why are they so effective?

Because many real programs show two patterns:

### Temporal Locality

If you used data recently, you may use it again soon.

Examples:

- loop counters
- active stack frames
- hot code paths

### Spatial Locality

If you used one location, you may soon use nearby locations.

Examples:

- arrays
- sequential instruction fetch
- contiguous buffers

Caches are built to exploit those patterns.

---

## Associativity: Where a Line Can Go

Not every cache line can live in every place inside the cache. Caches organize storage in ways that affect flexibility and speed.

The beginner-friendly idea is:

- some cache designs are more rigid about where data can be placed
- some are more flexible but more complex

This is described using terms like:

- direct-mapped
- set-associative
- fully associative

You do not need the full formalism yet. The key takeaway is that cache design must balance:

- lookup speed
- hardware complexity
- conflict behavior

---

## Inclusive and Exclusive Policies

Another design choice is whether higher-level caches contain copies of data that is also present in lower-level caches.

### Inclusive

If a line is in L1, a copy may also be present in L2 or L3.

### Exclusive

Different levels try not to duplicate the same line as much.

These policies affect capacity behavior, coherence behavior, and management complexity.

For beginners, it is enough to know that multi-level caches are not just different-sized buckets. They follow policies with real tradeoffs.

---

## Instruction Cache vs Data Cache

Many CPUs separate the closest instruction and data caches.

Why?

- the front end wants to fetch instructions continuously
- the execution side wants to load and store data continuously
- splitting them reduces some contention

This is one of those places where modern CPUs can look a bit “Harvard-like” internally even if the programming model remains mostly Von Neumann.

---

## Why Developers Should Care

Cache hierarchy explains why:

- array scans are often fast
- pointer chasing can be slow
- hot loops care about data layout
- keeping working sets small matters
- performance can collapse when data no longer fits a nearby cache level

It is also the foundation for later topics:

- cache misses
- false sharing
- TLB effects
- NUMA-like concerns on larger systems

If registers are the CPU's hands, caches are the desk space that keeps useful material close.

---

## Common Misunderstandings

### “Cache is just a smaller RAM”

Not quite. It is a managed hierarchy optimized around locality and very fast access patterns.

### “More cache always solves memory problems”

Bigger caches help some workloads, but access patterns still dominate.

### “Developers never need to think about cache” 

If performance matters, you eventually do. Even without writing low-level code, data structure choices change cache behavior.

---

## Hands-On Exercise

Compare sequential and scattered access.

1. Write one loop that walks through an array sequentially.
2. Write another that accesses elements through shuffled indices or pointer-like jumps.
3. Time both versions on a large enough data set.
4. Notice that the arithmetic is similar, but memory behavior changes drastically.

If you do not want to code, search for a cache visualizer that shows line fills and misses for sequential versus random access.

---

## Recap

- Caches keep recently or nearby used memory closer to the CPU.
- L1, L2, and L3 trade size for speed.
- Cache lines bring in blocks of nearby bytes, not just single values.
- Temporal and spatial locality are why caches work well on many workloads.
- Cache hierarchy is one of the biggest reasons real-world code performance varies so much.

Next, we stop treating caches as magic and look at the behavior patterns that create hits, misses, and some of the strangest performance surprises developers encounter.