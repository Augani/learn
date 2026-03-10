# Lesson 16: Choosing the Right Concurrency Model

> Every concurrency model exists because someone had a
> problem that the existing models didn't solve well.
> Know the problem, know the model.

---

## Decision Framework

```
  START HERE: What is your workload?

  I/O-bound (network, disk, database)?
  |
  +-- Many connections (10K+)?
  |   +-- YES --> async/await (event loop)
  |   +-- NO  --> threads (simple, good enough)
  |
  CPU-bound (computation)?
  |
  +-- Data parallelism (same op on many items)?
  |   +-- Small data? --> SIMD / vectorization
  |   +-- Large data? --> threads / multiprocessing
  |   +-- GPU suitable? --> CUDA / GPU compute
  |
  +-- Task parallelism (different independent tasks)?
  |   +-- Fork-join / work stealing
  |
  Complex coordination between components?
  |
  +-- Message passing? --> actors / CSP (channels)
  +-- Shared state?    --> locks / lock-free structures
  +-- Event-driven?    --> event loop + callbacks

  Distributed across machines?
  |
  +-- Same datacenter? --> gRPC + async
  +-- Multiple regions? --> actors (Akka, Orleans)
```

---

## Model Comparison

```
  +------------------+----------+----------+-----------+-----------+
  | Model            | Best For | Scaling  | Complexity| Languages |
  +------------------+----------+----------+-----------+-----------+
  | Threads + Locks  | General  | ~100s    | Medium    | All       |
  |                  | purpose  | threads  | (deadlock)|           |
  +------------------+----------+----------+-----------+-----------+
  | Async/Await      | I/O-bound| ~100Ks   | Low-Med   | JS, Py,   |
  |                  | high     | connections| (colored |  Rust, C# |
  |                  | concurr. |          |  funcs)   |           |
  +------------------+----------+----------+-----------+-----------+
  | CSP (Channels)   | Pipeline | ~100Ks   | Low       | Go, Rust  |
  |                  | patterns | goroutines|          |  Clojure  |
  +------------------+----------+----------+-----------+-----------+
  | Actors           | Isolated | Millions | Medium    | Erlang,   |
  |                  | stateful | actors   |           | Akka,     |
  |                  | entities |          |           | Orleans   |
  +------------------+----------+----------+-----------+-----------+
  | Fork-Join        | Divide & | #cores   | Low       | Java,     |
  |                  | conquer  |          |           | Rust, C++ |
  +------------------+----------+----------+-----------+-----------+
  | SIMD             | Data     | Vector   | High      | C/C++,    |
  |                  | parallel | width    | (intrin.) | Rust      |
  +------------------+----------+----------+-----------+-----------+
  | GPU (CUDA)       | Massive  | 1000s    | High      | CUDA, CuPy|
  |                  | data par.| cores    |           | Triton    |
  +------------------+----------+----------+-----------+-----------+
  | Coroutines       | Cooperat.| ~100Ks   | Low       | Kotlin,   |
  |                  | multitask|          |           | Lua, C++20|
  +------------------+----------+----------+-----------+-----------+
```

---

## Scenario 1: Web Server

```
  REQUIREMENTS:
  - Handle 10,000+ concurrent connections
  - Most time spent waiting for database/API calls
  - Some CPU work (JSON serialization, validation)

  ANALYSIS:
  - I/O-bound with high concurrency
  - Need lightweight concurrent units
  - Shared state: minimal (maybe session cache)

  BEST: async/await OR goroutines (CSP)

  +-- Node.js: event loop + async/await
  |   Single-threaded, non-blocking I/O.
  |   Worker threads for CPU-heavy tasks.
  |
  +-- Go: goroutines + channels
  |   Thousands of goroutines, multiplexed on OS threads.
  |   Built-in HTTP server handles concurrency.
  |
  +-- Rust (Tokio): async/await
  |   Zero-cost abstractions, lowest latency.
  |
  +-- Python (FastAPI): async/await + uvloop
      GIL limits CPU parallelism, but I/O is async.

  WRONG CHOICE: one-thread-per-connection (Apache prefork)
  1000 threads = 1GB+ RAM just for stacks.
  10K threads = context switching nightmare.
```

---

## Scenario 2: Real-Time Game Server

```
  REQUIREMENTS:
  - 100s of players per server
  - Each player has independent state
  - Players interact (collisions, chat, trades)
  - Low latency (< 50ms per tick)

  ANALYSIS:
  - Many independent stateful entities (players, NPCs)
  - Need message-passing between entities
  - Isolation prevents one player's bug from crashing others

  BEST: Actor model

  Each player/NPC/room = an actor.
  Actors communicate via messages.
  No shared mutable state between actors.

  Player Actor:
  +------------------+
  | state: position, |
  |   health, items  |
  | mailbox: [msgs]  |
  +------------------+
       |
       | message: "player2 attacks you"
       v
  Process message, update state, send response.

  WHY NOT THREADS + LOCKS?
  - Lock contention between 1000 players = performance killer
  - Deadlock risk grows with complexity
  - Hard to reason about shared state
```

---

## Scenario 3: Image Processing Pipeline

```
  REQUIREMENTS:
  - Read 10,000 images from disk
  - Resize each image
  - Apply filter
  - Save processed image

  ANALYSIS:
  - Pipeline of stages (read -> resize -> filter -> save)
  - Each stage can run in parallel
  - I/O at the edges, CPU in the middle

  BEST: CSP (channels) or thread pool with pipeline

  +--------+     +--------+     +--------+     +--------+
  | Read   | --> | Resize | --> | Filter | --> | Save   |
  | (I/O)  |chan | (CPU)  |chan | (CPU)  |chan | (I/O)  |
  | 2 thrd |    | 4 thrd |    | 4 thrd |    | 2 thrd |
  +--------+     +--------+     +--------+     +--------+

  Go implementation:
  - Each stage is a goroutine pool
  - Connected by buffered channels
  - Back-pressure handled by channel capacity
```

---

## Scenario 4: Scientific Computing

```
  REQUIREMENTS:
  - Matrix operations on 10,000 x 10,000 matrices
  - Iterative algorithms (converge after N steps)
  - Maximum performance needed

  ANALYSIS:
  - Pure CPU-bound
  - Regular data access patterns
  - Same operation on many elements

  BEST: SIMD + multi-threading + (optional) GPU

  LEVEL 1: Use optimized libraries (BLAS, LAPACK, NumPy)
           They already use SIMD + threads internally.

  LEVEL 2: GPU offload for massive matrices.
           cuBLAS for matrix multiply = 10-100x speedup.

  LEVEL 3: Distributed (MPI) for cluster-scale.
           Split matrices across nodes.

  WRONG CHOICE: actors or async/await
  No I/O to wait on. No message passing needed.
  Pure compute = parallelize the compute directly.
```

---

## Scenario 5: Event-Driven Microservice

```
  REQUIREMENTS:
  - Process messages from Kafka/RabbitMQ
  - Each message triggers business logic
  - Some messages need database calls
  - Order matters within a partition

  ANALYSIS:
  - Consumer per partition (maintain order)
  - I/O-bound (database calls)
  - Independent between partitions

  BEST: async/await with per-partition concurrency

  Partition 0 --> async consumer 0 --> process sequentially
  Partition 1 --> async consumer 1 --> process sequentially
  Partition 2 --> async consumer 2 --> process sequentially

  Within each consumer: async database calls.
  Between consumers: fully parallel (no shared state).
```

---

## Anti-Pattern: Using the Wrong Model

```
  ANTI-PATTERN 1: Threads for 10K connections
  Each thread = 1-8MB stack.
  10K threads = 10-80GB RAM just for stacks.
  Context switching kills performance.
  USE: async/await instead.

  ANTI-PATTERN 2: Async for CPU-bound work
  async only helps when you're WAITING for I/O.
  CPU-bound async just adds overhead (state machines).
  USE: threads or multiprocessing instead.

  ANTI-PATTERN 3: Locks for distributed state
  Can't lock across network boundaries (reliably).
  USE: distributed consensus or CRDTs instead.

  ANTI-PATTERN 4: Actors for simple request/response
  Overhead of actor creation, messaging, mailbox.
  If you just need a request-response handler:
  USE: simple thread pool or async handler.

  ANTI-PATTERN 5: GPU for small data
  CPU<->GPU transfer overhead dominates for small arrays.
  USE: CPU SIMD for arrays < 100K elements.
```

---

## Hybrid Approaches

```
  REAL SYSTEMS MIX MODELS:

  WEB SERVER (typical production):
  +-----------------------------------------------------+
  | Async event loop (handle HTTP connections)           |
  |   |                                                  |
  |   +-> Thread pool (CPU-bound work: JSON, crypto)    |
  |   |                                                  |
  |   +-> Async I/O (database queries, API calls)       |
  |   |                                                  |
  |   +-> Background workers (scheduled tasks)          |
  +-----------------------------------------------------+

  GAME ENGINE:
  +-----------------------------------------------------+
  | Main loop (single thread, game state)               |
  |   |                                                  |
  |   +-> Thread pool (physics, AI, pathfinding)        |
  |   |                                                  |
  |   +-> GPU (rendering)                               |
  |   |                                                  |
  |   +-> Async I/O (network, disk)                     |
  +-----------------------------------------------------+

  ML TRAINING:
  +-----------------------------------------------------+
  | Data loading: multiple processes (CPU, I/O)         |
  |   |                                                  |
  |   +-> GPU compute (forward/backward pass)           |
  |   |                                                  |
  |   +-> AllReduce (inter-GPU communication, NCCL)     |
  |   |                                                  |
  |   +-> Async checkpointing (save to disk)            |
  +-----------------------------------------------------+
```

---

## Quick Decision Table

```
  "I need to..."                          "Use..."
  +--------------------------------------+------------------+
  | Handle many network connections      | async/await      |
  | Process items in parallel            | thread pool      |
  | Build a pipeline of stages           | channels (CSP)   |
  | Manage many independent entities     | actors           |
  | Divide-and-conquer a large problem   | fork-join        |
  | Process vectors/arrays fast          | SIMD             |
  | Train a neural network               | GPU + data par.  |
  | Coordinate with retries/timeout      | async + select   |
  | Share a cache between threads        | RwLock / ConcMap |
  | Process Kafka partitions             | async consumers  |
  +--------------------------------------+------------------+
```

---

## Exercises

### Exercise 1: Choose and Justify

For each scenario, choose a concurrency model and justify:
1. A chat server handling 50K simultaneous users
2. A video transcoding service processing uploaded files
3. A trading engine matching buy/sell orders
4. A web scraper fetching 100K URLs
5. A particle physics simulation with 1M particles

### Exercise 2: Benchmark Models

Implement the same task (process 1M items with I/O simulation)
using three different models:
1. Thread pool (threading)
2. Async (asyncio)
3. Multiprocessing
Compare throughput, latency, and resource usage.

### Exercise 3: Hybrid Architecture

Design a concurrent architecture for a ride-sharing app:
- Accept rider requests (high concurrency)
- Match riders with drivers (stateful, coordination)
- Track driver positions (real-time updates)
- Calculate prices (CPU-bound)
Draw the architecture and label which model each component uses.

### Exercise 4: Migration Plan

You have a legacy system using one-thread-per-request
(Apache + PHP style). It handles 500 concurrent users but
falls over at 2000. Design a migration plan to handle
50K concurrent users. What model do you choose and why?

---

## Key Takeaways

```
  1. I/O-bound + high concurrency = async/await or goroutines
  2. CPU-bound + data parallel = threads + SIMD or GPU
  3. Many stateful entities = actor model
  4. Pipeline processing = CSP / channels
  5. Divide-and-conquer = fork-join
  6. Real systems mix multiple models
  7. Wrong model = worse than no concurrency
  8. Start simple (threads), optimize when needed
  9. Measure before choosing (profile your bottleneck)
  10. The best model matches your problem's structure
```
