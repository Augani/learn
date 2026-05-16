# Lesson 10: Cache Behavior and Performance

> **The one thing to remember**: Cache performance is mostly about access
> patterns. The same algorithmic work can run very differently depending on
> whether the CPU sees predictable, nearby data or scattered, conflicting access.

---

## Start With a Desk That Keeps Changing

Suppose you are working on a desk with only a few open folders allowed at once.

If you keep reusing the same nearby pages, work feels smooth.
If you constantly switch between far-apart folders, you spend your time searching and swapping instead of thinking.

That is the feel of good versus bad cache behavior.

---

## Locality Is the Whole Game

Last lesson, we saw two key ideas:

- **temporal locality**: recently used data is likely to be used again
- **spatial locality**: nearby data is likely to be used soon

Good cache behavior usually means your program gives the hardware both.

Examples:

- walking an array from left to right
- reusing a small hot working set repeatedly
- keeping related fields close together when frequently accessed together

Poor cache behavior often looks like:

- random pointer chasing
- revisiting huge data sets with long gaps between uses
- access patterns that keep evicting useful data

---

## Cache Hits vs Misses

When the needed data is already in cache, the CPU gets a **hit**.
When the CPU must fetch it from a lower level, it gets a **miss**.

Misses are expensive because they create wait time and reduce useful throughput.

There are several common miss patterns worth understanding.

### Compulsory Misses

The first time you touch data, it cannot already be in cache.

### Capacity Misses

Your working set is too large for the cache level, so useful data gets evicted before reuse.

### Conflict Misses

Data competes for the same cache locations even though the total data volume may not seem huge.

These categories help you reason about *why* a workload misses, not just that it misses.

---

## Why Arrays Often Beat Linked Structures

Consider two ways to store many values.

### Array

- elements are contiguous
- one cache line fetch brings in several nearby values
- sequential iteration is friendly to prefetching and locality

### Linked List

- each node may live far from the next one
- every pointer step may jump to a fresh location
- the CPU often cannot guess the next address as effectively

This is why an array-based structure can outperform a pointer-heavy one even if the asymptotic algorithm story sounds similar.

```
ARRAY
  [1][2][3][4][5][6]

LINKED LIST
  [1] -> [2] -> [3] -> [4]
  nodes may be scattered across memory
```

Architecture changes what “efficient” means in practice.

---

## Stride Matters

Access pattern spacing, or **stride**, matters a lot.

If you touch every element of an array, you use each fetched line well.
If you touch every 64th or 128th element, you may waste most of each fetched line.

That means two loops over the same data structure can behave very differently.

Example idea:

- row-major access over a matrix can be cache-friendly
- column-major access on row-major data can trigger many more misses

This is one reason data layout and loop order matter in numeric code.

---

## Working Set Size

The **working set** is the amount of data actively needed in a period of execution.

If the working set fits in a nearby cache, performance can be great.
If it spills beyond that level, you may see a step down in throughput.

This is why performance sometimes changes abruptly instead of smoothly as data grows.

You may hear people say things like:

- “it fits in L1”
- “once it blows past L2, performance drops”

That is working-set language.

---

## False Sharing

One of the strangest performance problems in multicore systems is **false sharing**.

This happens when:

- two threads update different variables
- those variables happen to live on the same cache line
- the cores keep invalidating each other's line copies even though they are not logically sharing the same variable

```
FALSE SHARING IDEA

  cache line:
  [ counter_for_thread_A | counter_for_thread_B ]

  different variables, same line
```

The sharing is “false” because at the program level the values are separate. But at the cache-line level they are coupled.

This is one reason padding and layout choices matter in concurrent code.

---

## Hardware Prefetching

Modern CPUs often try to guess future memory accesses and fetch data early.

This is called **prefetching**.

Sequential and regular patterns are easier to prefetch:

- array walks
- simple strided loops

Irregular pointer-heavy patterns are harder.

Prefetching can hide some latency, but it is not magic. If the access pattern is chaotic or the working set is too large, misses still hurt.

---

## Why Big-O Is Not the Whole Story

Algorithmic complexity still matters, but architecture explains why two $O(n)$ loops can behave very differently.

One loop may:

- stream through contiguous memory
- reuse hot data effectively
- let the hardware prefetch well

Another may:

- jump unpredictably
- waste cache lines
- trigger more misses and stalls

Same asymptotic complexity. Very different real time.

This is why systems performance requires both algorithmic thinking and machine-awareness.

---

## Why Developers Should Care

This lesson explains:

- why data layout is a performance tool
- why arrays often beat linked structures in real systems
- why loop order matters for matrices and buffers
- why multicore scaling can be wrecked by false sharing
- why benchmark results can look surprising if you ignore cache behavior

When performance work says “improve locality,” this is what it means.

---

## Common Misunderstandings

### “A cache miss is just a small slowdown”

In tight code, misses can dominate the whole runtime.

### “If the algorithm is optimal, memory layout no longer matters”

Not true. The machine still runs the algorithm through real caches and memory.

### “False sharing means the threads used the same variable” 

No. They may use different variables that merely occupy the same cache line.

---

## Hands-On Exercise

Try one of these:

1. Benchmark row-wise versus column-wise traversal of a large matrix.
2. Benchmark array iteration versus linked-list traversal for many elements.
3. In threaded code, place two counters next to each other, then separate them with padding and compare throughput.

If you prefer a visual tool, use a cache simulator to compare sequential, strided, and random access patterns.

---

## Recap

- Cache performance depends heavily on access pattern locality.
- Misses come in different forms: compulsory, capacity, and conflict.
- Arrays often benefit from contiguous layout and predictable access.
- Working-set size determines which cache levels can help you.
- False sharing is a multicore cache-line problem, not a source-code-level sharing problem.

Next, we add another layer that every memory access on modern systems usually passes through first: virtual memory and the TLB.