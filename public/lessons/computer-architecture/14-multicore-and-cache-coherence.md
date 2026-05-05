# Lesson 14: Multicore and Cache Coherence

> **The one thing to remember**: Multicore systems are powerful because several
> cores can run at once, but shared memory becomes tricky. Cache coherence exists
> so the different cores do not keep contradicting versions of the same data.

---

## Start With Shared Notes on Several Desks

Imagine four coworkers each keep a photocopy of the same schedule on their desk.

That is efficient because everyone can read quickly without walking to a central office.

But if one person edits the schedule, the copies can become inconsistent.

That is the multicore cache problem.

Each core wants fast local cached data. But shared-memory programming only works if cores eventually agree about what shared data means.

---

## Why Multicore Became Necessary

For many years, processors mainly got faster by increasing clock speeds and exploiting more instruction-level parallelism.

Eventually power and thermal limits made unlimited frequency growth impractical.

One response was:

- put multiple cores on the chip
- run different threads or tasks in parallel

This increased total throughput without depending only on a faster single core.

---

## Shared Memory Is Convenient but Hard

From the programmer's point of view, multicore systems often look like:

- multiple threads
- one shared address space

That is convenient. But physically, each core may have:

- its own registers
- its own L1 and often L2 caches
- a path to shared higher-level caches and memory

```
MULTICORE SKETCH

  Core A -> private caches
  Core B -> private caches
  Core C -> private caches
  Core D -> private caches
           \
            shared memory system
```

Now the question becomes: if core A writes `x`, when and how do B, C, and D learn about it?

---

## What Cache Coherence Means

**Cache coherence** is about keeping the values of shared memory locations consistent across caches.

The beginner-level promise is roughly:

- if one core writes a location
- other cores should not keep using stale versions forever as though nothing changed

Coherence is not the same as easy programming. It is a hardware protocol that helps preserve a sane memory view.

---

## The MESI Intuition

One famous family of coherence protocols is often summarized as **MESI**.

The letters stand for states a cache line can be in, such as:

- modified
- exclusive
- shared
- invalid

You do not need to master every transition for the first pass. The useful mental model is:

- a line may be clean and shared
- a core may get exclusive ownership before writing
- other stale copies may be invalidated or updated according to the protocol

```
COHERENCE INTUITION

  Core A wants to write line X
      |
      v
  other cores' stale copies must stop being valid
```

That prevents contradictory cached versions from lingering indefinitely.

---

## Why Coherence Traffic Costs Performance

Coherence is necessary, but it is not free.

If several cores keep reading and writing the same cache lines, the system spends time on:

- invalidations
- ownership transfers
- line movement
- waiting for data to become available in the right state

This is one reason shared-memory parallelism can scale poorly when threads communicate too much.

---

## False Sharing Returns Here

False sharing is one of the most practical coherence problems.

If two cores write two separate variables that happen to sit on the same line,
the hardware still treats the whole line as the unit of coherence.

So the line bounces between cores even though the program's variables are conceptually independent.

This can destroy performance in counters, queues, and data-processing loops unless layout is carefully padded.

---

## Multicore Scaling Is Never Automatic

Suppose one core can do work in time $T$.
You might hope four cores reduce the time to $T/4$.

Sometimes they do not, because of:

- shared-memory contention
- coherence traffic
- locks and synchronization
- load imbalance
- serial parts of the program

This is why multicore performance depends on the structure of the workload, not just core count.

---

## Coherence vs Consistency

These words sound similar but are not identical.

### Coherence

Focuses on whether different cores agree on the value of a given memory location over time.

### Consistency / Memory Ordering

Focuses on the rules about the order in which operations may become visible.

You need both ideas for correct and performant concurrent systems.

---

## Why Developers Should Care

This lesson explains:

- why multicore scaling hits limits
- why hot shared variables become bottlenecks
- why padding and sharding counters can help
- why locks, atomics, and synchronization cost more than their source code suggests
- why per-core or per-thread local work is often faster than constant shared-state updates

If you are writing servers, databases, runtimes, or high-throughput concurrent code, cache coherence is not optional background knowledge.

---

## Common Misunderstandings

### “If threads share memory, they all instantly see the same thing”

Not literally. Hardware must coordinate cached copies and ordering rules.

### “More cores always means linearly more speed”

No. Shared-state coordination often becomes the real limit.

### “False sharing is a language-level feature” 

No. It is a cache-line and coherence behavior problem.

---

## Hands-On Exercise

Try one of these:

1. Build a tiny threaded benchmark with one shared counter and compare it with per-thread counters plus a final reduction.
2. Put two hot counters next to each other, then pad them apart and compare throughput.
3. Read a visual explanation of MESI and trace what happens when one core reads a line and another later writes it.

---

## Recap

- Multicore chips improve throughput by running several cores at once.
- Private caches make local access fast, but shared data then requires coherence.
- Coherence protocols keep cached copies of shared lines from diverging forever.
- The unit of coherence is often the cache line, which is why false sharing is so costly.
- Scaling across cores depends heavily on how much shared-state traffic the workload creates.

Next, we zoom out from correctness and throughput to the constraint that now shapes much of processor design: power, thermals, and frequency limits.