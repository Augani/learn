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
