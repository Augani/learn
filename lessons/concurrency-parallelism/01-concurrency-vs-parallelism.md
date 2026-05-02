# 01 - Concurrency vs Parallelism

## The Analogy

Imagine a kitchen.

**Concurrency**: One cook juggling three pots. She stirs the soup, checks the
pasta, flips the pancake, back to the soup. One person, multiple tasks,
*interleaved*. Nothing literally happens at the same time -- she just
switches fast enough that everything progresses.

**Parallelism**: Three cooks, three pots. Each cook handles one pot. Work
literally happens *simultaneously*.

```
  CONCURRENCY (one cook, multiple pots)

  Time -->
  Cook: [stir soup] [check pasta] [flip pancake] [stir soup] [check pasta]
        --------->  ----------->  ------------->  --------->  ----------->

  PARALLELISM (three cooks, three pots)

  Time -->
  Cook A: [stir soup------] [stir soup------] [stir soup------]
  Cook B: [check pasta----] [check pasta----] [check pasta----]
  Cook C: [flip pancake---] [flip pancake---] [flip pancake---]
          |||               |||               |||
          simultaneous      simultaneous      simultaneous
```

## Formal Definitions

**Concurrency** is about *dealing with* multiple things at once.
It is a structural property of your program -- multiple tasks can
make progress, though not necessarily at the same instant.

**Parallelism** is about *doing* multiple things at once.
It is a runtime property -- multiple computations execute simultaneously
on different hardware (cores, machines, GPUs).

```
+-------------------+----------------------------+
|                   | Parallel?                  |
|                   |   NO            YES        |
+-------------------+-------------+--------------+
| Concurrent?  NO   | Sequential  | (impossible) |
|              YES   | Concurrent  | Concurrent + |
|                    | only        | Parallel     |
+-------------------+-------------+--------------+
```

You can have concurrency without parallelism (one core, time-slicing).
You cannot have parallelism without concurrency (parallel tasks are
by definition concurrent).

## Why the Distinction Matters

Consider a web server handling 10,000 connections.

**Approach A**: Spawn 10,000 OS threads (parallelism-heavy).
Each thread blocks on I/O. The OS schedules them across cores.
Cost: ~8MB stack per thread = 80GB of memory. Not feasible.

**Approach B**: Use an event loop with async I/O (concurrency-only).
One thread, one core. When a connection waits for data, switch to another.
Cost: ~1KB per connection = 10MB total. Very feasible.

**Approach C**: Event loop + thread pool (both).
Async I/O for connection management, worker threads for CPU-bound work.
This is what most production servers actually do.

```
  Approach A: Thread-per-connection      Approach B: Event loop
  ================================      ======================

  Core 0: [Thread 1] [Thread 5] ...    Core 0: [conn1] [conn2] [conn3] ...
  Core 1: [Thread 2] [Thread 6] ...              ^      ^       ^
  Core 2: [Thread 3] [Thread 7] ...              |      |       |
  Core 3: [Thread 4] [Thread 8] ...              switch when blocked

  Memory: 80GB                          Memory: 10MB
  Cores: fully utilized                 Cores: one used
```

## Concurrency in Different Languages

### Go: Goroutines (concurrent, sometimes parallel)

```go
func main() {
    go fetchURL("https://api.example.com/a")
    go fetchURL("https://api.example.com/b")
    go fetchURL("https://api.example.com/c")

    time.Sleep(3 * time.Second)
}

func fetchURL(url string) {
    resp, err := http.Get(url)
    if err != nil {
        return
    }
    defer resp.Body.Close()
    fmt.Println(url, resp.Status)
}
```

Three goroutines. The Go runtime decides if they run in parallel
(multiple OS threads) or concurrently (one thread, switching at I/O).
See: **Go Track** for goroutine scheduling details.

### Python: asyncio (concurrent, never parallel within one process)

```python
import asyncio
import aiohttp

async def fetch_url(session, url):
    async with session.get(url) as resp:
        print(url, resp.status)

async def main():
    async with aiohttp.ClientSession() as session:
        await asyncio.gather(
            fetch_url(session, "https://api.example.com/a"),
            fetch_url(session, "https://api.example.com/b"),
            fetch_url(session, "https://api.example.com/c"),
        )

asyncio.run(main())
```

The GIL means Python threads can't run Python code in parallel.
`asyncio` gives you concurrency on one thread via cooperative scheduling.
For CPU parallelism, you need `multiprocessing`.

### Rust: tokio (concurrent + parallel)

```rust
use reqwest;

#[tokio::main]
async fn main() {
    let urls = vec![
        "https://api.example.com/a",
        "https://api.example.com/b",
        "https://api.example.com/c",
    ];

    let handles: Vec<_> = urls.into_iter().map(|url| {
        tokio::spawn(async move {
            let resp = reqwest::get(url).await;
            match resp {
                Ok(r) => println!("{} {}", url, r.status()),
                Err(e) => eprintln!("{} error: {}", url, e),
            }
        })
    }).collect();

    for handle in handles {
        let _ = handle.await;
    }
}
```

Tokio is multi-threaded by default. Tasks are concurrent *and* can run
in parallel across the thread pool. Rust's ownership system prevents
data races at compile time. See: **Rust Track** for ownership details.

## The Spectrum

Concurrency and parallelism aren't binary. They exist on a spectrum:

```
  Sequential                                    Massively Parallel
  |                                                            |
  v                                                            v
  [single thread] ... [async I/O] ... [thread pool] ... [GPU with 10K cores]
       |                  |               |                     |
   No concurrency    Concurrent      Concurrent +         Concurrent +
                     (1 thread)      Parallel              Massively
                                     (N threads)           Parallel
```

## Shared State: Why Concurrency Is Hard

Concurrency is easy when tasks are independent. It becomes dangerous when
tasks share data — because now they can step on each other's toes.

**Analogy — two people editing the same shopping list:**

You and your roommate both look at the fridge, see you're out of milk,
and each add "milk" to the shared shopping list. Now you have "milk" on
the list twice and you'll buy two cartons. That's a **race condition** —
the result depends on the timing of who reads and writes when.

Worse: you both see the list says "eggs (3)" and each decide to cross it
off and write "eggs (0)". But between reading "3" and writing "0", your
roommate already bought eggs and wrote "eggs (0)". Your write of "0"
overwrites their update. This is a **lost update** — a classic concurrency
bug.

```
Thread A reads counter: 10
Thread B reads counter: 10
Thread A writes counter: 11  (10 + 1)
Thread B writes counter: 11  (10 + 1, not 12!)

Expected: 12    Actual: 11    One increment was lost.
```

### Locks: The Bathroom Key

The simplest solution: a lock. Only one person can hold it at a time.

**Analogy — a single bathroom key on a hook:**
Only whoever holds the key can enter the bathroom. Everyone else waits.
When they're done, they hang the key back. This is a **mutex** (mutual
exclusion lock).

```go
var mu sync.Mutex
var counter int

func increment() {
    mu.Lock()         // grab the bathroom key
    counter++         // safe — you're the only one in here
    mu.Unlock()       // hang the key back
}
```

### Deadlock: The Mexican Standoff

Locks solve race conditions but introduce a new problem: **deadlock**.

**Analogy — two people, two doors, two keys:**

Alice holds the kitchen key and needs the bathroom key.
Bob holds the bathroom key and needs the kitchen key.
Neither will give up their key until they get the other.
They wait forever. The house is frozen.

```
Thread A:                    Thread B:
  Lock(resource_1) ✓          Lock(resource_2) ✓
  Lock(resource_2) ... wait   Lock(resource_1) ... wait
       │                           │
       └─── both waiting forever ──┘
                DEADLOCK
```

Four conditions must ALL be true for deadlock:
1. **Mutual exclusion** — resources can't be shared
2. **Hold and wait** — holding one resource while waiting for another
3. **No preemption** — can't force someone to give up their resource
4. **Circular wait** — A waits for B, B waits for A

Break any one condition and deadlock becomes impossible. The simplest
strategy: always acquire locks in the same order (e.g., always kitchen
before bathroom). This prevents circular wait.

### Async/Await: Concurrency Without Threads

Modern languages offer a lighter alternative to threads: **async/await**.
Instead of the OS scheduling threads, your program cooperatively yields
control when it's waiting for something.

**Analogy — a chef with a timer:** Instead of standing and watching water
boil (blocking), the chef sets a timer and starts chopping vegetables.
When the timer rings (the I/O completes), they go back to the pot. One
chef, multiple dishes, no wasted time standing around.

```
Threads (OS manages):         Async (your code manages):
┌─────────────────────┐       ┌─────────────────────┐
│ Thread 1: ████░░████│       │ Task 1: ████    ████│
│ Thread 2: ░░████░░░░│       │ Task 2:     ████    │
│ Thread 3: ████░░░░██│       │ All on ONE thread   │
└─────────────────────┘       └─────────────────────┘
 ████ = running                ████ = running
 ░░░░ = blocked, wasting       (gaps) = yielded, another task runs
        an OS thread                    on same thread

 3 threads × 8MB = 24MB       1 thread × 8MB = 8MB
```

The tradeoff: async code can't do CPU-heavy work without blocking the
event loop (since it's all on one thread). That's why Approach C from
earlier (event loop + thread pool) is the real-world pattern: async for
I/O, threads for computation.

---

## Key Takeaways

1. Concurrency = structure (your code *can* handle multiple tasks)
2. Parallelism = execution (tasks *actually* run at the same time)
3. I/O-bound work benefits most from concurrency
4. CPU-bound work benefits most from parallelism
5. Most real systems use both

## Exercises

1. **Classify**: A web browser renders a page while downloading images and
   running JavaScript. Is this concurrency, parallelism, or both? Why?

2. **Design**: You're building a chat server for 50,000 users. Messages are
   small (I/O-bound) but you also need to run spam detection (CPU-bound).
   Sketch the architecture using concurrency and parallelism appropriately.

3. **Experiment**: Write a program in your language of choice that:
   - Creates 100 tasks that each sleep for 100ms
   - Run them sequentially, then concurrently
   - Measure the wall-clock time difference

4. **Think**: Python's GIL prevents parallel CPU execution. Why does Python
   still benefit from `threading` for I/O-bound work?

---

**Next** -> [02 - Thread Models](02-thread-models.md)
