# Concurrency Model Comparison

Quick reference for choosing between concurrency models.

---

## Models at a Glance

```
+------------------+-------------+-----------+-----------+-------------+
| Model            | Primitives  | State     | Communic. | Failure     |
|                  |             | Sharing   |           | Isolation   |
+------------------+-------------+-----------+-----------+-------------+
| Threads + Locks  | Thread,     | Shared    | Shared    | None (crash |
|                  | Mutex, CV   | memory    | memory    | kills proc) |
+------------------+-------------+-----------+-----------+-------------+
| Lock-Free        | Atomics,    | Shared    | Shared    | None        |
|                  | CAS         | memory    | memory    |             |
+------------------+-------------+-----------+-----------+-------------+
| CSP (Channels)   | Goroutine,  | No sharing| Channels  | Partial     |
|                  | Channel     | (by conv.)| (msg pass)| (goroutine) |
+------------------+-------------+-----------+-----------+-------------+
| Actor Model      | Actor,      | No sharing| Mailbox   | Strong      |
|                  | Message     | (isolated)| (async)   | (supervision|
|                  |             |           |           |  tree)      |
+------------------+-------------+-----------+-----------+-------------+
| Async/Await      | Future,     | Shared    | Async     | None (panic |
|                  | Task,       | (via Arc) | channels  | kills task) |
|                  | Runtime     |           |           |             |
+------------------+-------------+-----------+-----------+-------------+
| Coroutines       | Coroutine,  | Shared    | yield/    | None        |
|                  | yield       |           | resume    |             |
+------------------+-------------+-----------+-----------+-------------+
| Fork-Join        | Task,       | Shared    | Join      | Partial     |
|                  | ForkPool    | (read     | result    |             |
|                  |             |  mostly)  |           |             |
+------------------+-------------+-----------+-----------+-------------+
| SIMD             | Vector      | N/A       | N/A       | N/A         |
|                  | intrinsics  | (data     | (single   |             |
|                  |             |  parallel)| thread)   |             |
+------------------+-------------+-----------+-----------+-------------+
| GPU (CUDA)       | Kernel,     | Global    | Shared    | Kernel      |
|                  | Block,      | memory,   | memory    | failure     |
|                  | Thread      | shared mem| (block)   |             |
+------------------+-------------+-----------+-----------+-------------+
```

---

## Scalability Comparison

```
+------------------+-----------------+------------------+----------------+
| Model            | Max Concurrent  | Memory per Unit  | Context Switch |
+------------------+-----------------+------------------+----------------+
| OS Threads       | ~10K            | 1-8 MB (stack)   | ~1-10 us       |
| Green Threads    | ~1M (Go)        | 2-8 KB initial   | ~100-300 ns    |
| Async Tasks      | ~1M             | ~few hundred B   | ~50-100 ns     |
| Actors (Erlang)  | ~10M            | ~300 bytes       | ~50 ns         |
| Actors (Akka)    | ~1M             | ~300 bytes       | ~100 ns        |
| Coroutines       | ~1M             | ~few KB          | ~50-200 ns     |
+------------------+-----------------+------------------+----------------+
```

---

## Language-Model Mapping

```
+------------------+--------------------------------------------------+
| Language         | Primary Model(s)                                 |
+------------------+--------------------------------------------------+
| Go               | CSP (goroutines + channels)                      |
| Rust             | Async/await (Tokio) + threads + channels         |
| Erlang/Elixir    | Actor model (processes + OTP)                    |
| Java             | Threads + locks, Fork-Join, Virtual Threads      |
| Kotlin           | Coroutines + structured concurrency              |
| C#               | Async/await (Task) + threads                     |
| JavaScript       | Event loop + async/await (single-threaded)       |
| Python           | asyncio + multiprocessing (GIL limits threads)   |
| C/C++            | Threads + locks, SIMD, GPU (CUDA/OpenCL)         |
| Swift            | Structured concurrency (async/await + actors)    |
| Scala            | Akka actors, Cats Effect (FP concurrency)        |
+------------------+--------------------------------------------------+
```

---

## Performance Characteristics

```
+------------------+--------+---------+----------+----------+
| Model            | I/O    | CPU     | Latency  | Through. |
|                  | Bound  | Bound   | Sensitiv | Focus    |
+------------------+--------+---------+----------+----------+
| Threads + Locks  | Good   | Good    | Medium   | Medium   |
| Lock-Free        | N/A    | Best    | Lowest   | Highest  |
| CSP              | Great  | Good    | Low      | High     |
| Actors           | Great  | Medium  | Low      | High     |
| Async/Await      | Best   | Poor*   | Low      | Highest  |
| Fork-Join        | Poor   | Great   | Medium   | High     |
| SIMD             | N/A    | Best**  | Lowest   | Highest  |
| GPU              | N/A    | Best*** | High**** | Highest  |
+------------------+--------+---------+----------+----------+
*  Async hurts CPU-bound (overhead of state machine)
** For data-parallel workloads that fit in SIMD registers
*** For massively parallel workloads
**** High latency for small workloads due to transfer overhead
```

---

## Debugging Difficulty

```
+------------------+-------------+------------------------------------+
| Model            | Difficulty  | Why                                |
+------------------+-------------+------------------------------------+
| Sequential       | Easiest     | Deterministic, step-through debug  |
| Async/Await      | Easy        | Single-thread, but async stacks    |
| CSP              | Medium      | Channel deadlocks, goroutine leaks |
| Threads + Locks  | Hard        | Races, deadlocks, nondeterminism   |
| Lock-Free        | Very Hard   | Subtle ordering bugs, ABA problem  |
| Actors           | Medium-Hard | Message ordering, mailbox overflow  |
| GPU              | Very Hard   | No breakpoints, race conditions    |
+------------------+-------------+------------------------------------+
```

---

## When to Combine Models

```
  WEB APPLICATION:
  Async (HTTP handling) + Thread Pool (CPU tasks) + Actors (WebSocket)

  GAME SERVER:
  Actors (game entities) + Threads (physics) + GPU (rendering)

  DATA PIPELINE:
  CSP (stage connection) + SIMD (processing) + Async (I/O)

  ML TRAINING:
  GPU (compute) + Async (data loading) + MPI (distributed)

  TRADING SYSTEM:
  Lock-Free (order book) + Async (network) + Threads (risk calc)
```
