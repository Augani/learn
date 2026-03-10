# Concurrency & Parallelism Track

## The Big Picture

This track is about making things happen at the same time -- or at least
*appear* to. Every modern system, from your phone to a GPU cluster training
an LLM, relies on concurrency and parallelism. This track unifies the
concepts you've seen scattered across languages and operating systems.

```
  YOU ARE HERE
      |
      v
+-----+------------------------------------------------------+
|                CONCURRENCY & PARALLELISM                     |
|                                                              |
|  Foundations          Models           Hardware    Practice   |
|  ----------          ------           --------    --------   |
|  01 Conc vs Par      06 CSP           11 SIMD     14 Bugs    |
|  02 Thread Models    07 Actors        12 GPU      15 Testing |
|  03 Shared Memory    08 Async/Await   13 ML Par   16 Choosing|
|  04 Lock-Free        09 Coroutines                           |
|  05 Memory Order     10 Par Algos                            |
+--------------------------------------------------------------+
```

## Prerequisites

You should be comfortable with:
- Basic threading (see: **OS Track**, lessons on processes & threads)
- Ownership and borrowing (see: **Rust Track**, lessons 03-05)
- Goroutines and channels (see: **Go Track**, lessons on concurrency)

This track assumes you've *used* threads or goroutines before.
We go deeper into *why* things work (or break).

## Lesson Map

| #  | Lesson                        | Key Concept                        |
|----|-------------------------------|------------------------------------|
| 01 | Concurrency vs Parallelism    | The fundamental distinction        |
| 02 | Thread Models                 | OS threads, green threads, async   |
| 03 | Shared Memory                 | Mutexes, semaphores, RW locks      |
| 04 | Lock-Free Programming         | Atomics, CAS, ABA problem          |
| 05 | Memory Ordering               | Why CPUs reorder your code         |
| 06 | CSP Model                     | Channels and message passing       |
| 07 | Actor Model                   | Independent agents with mailboxes  |
| 08 | Async/Await                   | Event loops, futures, promises     |
| 09 | Coroutines & Fibers           | Stackful vs stackless              |
| 10 | Parallel Algorithms           | Map-reduce, fork-join, work steal  |
| 11 | SIMD & Vectorization          | One instruction, many data points  |
| 12 | GPU Parallelism               | CUDA, warps, blocks, grids         |
| 13 | Data Parallelism for ML       | Data/model/pipeline parallelism    |
| 14 | Common Bugs                   | Races, deadlocks, livelocks        |
| 15 | Testing Concurrent Code       | Sanitizers, property testing       |
| 16 | Choosing the Right Model      | Decision framework                 |

## Reference Material

- [Concurrency Model Comparison](reference-models.md)
- [Common Bugs & Detection](reference-bugs.md)

## How to Use This Track

1. Lessons 01-05 build **foundations** -- do them in order
2. Lessons 06-09 cover **models** -- pick based on interest, but 06 before 07
3. Lessons 10-13 cover **hardware-level parallelism** -- do them in order
4. Lessons 14-16 are **practice** -- do them last

Each lesson is 5-15 minutes of focused reading with exercises.

## What You'll Be Able to Do

After completing this track you will:
- Choose the right concurrency model for any problem
- Debug race conditions, deadlocks, and memory ordering bugs
- Understand GPU parallelism well enough to reason about ML training
- Write lock-free data structures when performance demands it
- Test concurrent code with confidence

---

**Start here** -> [01 - Concurrency vs Parallelism](01-concurrency-vs-parallelism.md)
