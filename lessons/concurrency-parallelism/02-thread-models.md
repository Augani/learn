# 02 - Thread Models

## The Analogy

Think of a factory with workers.

**OS Threads** are full-time employees with their own desks, chairs, and
phone lines. Expensive to hire, expensive to maintain, but fully independent.

**Green Threads** are contractors who share desks (hot-desking). Cheaper,
more flexible, but someone has to manage the desk schedule.

**Goroutines** are contractors with a smart scheduler that automatically
moves them between desks when they're waiting for a phone call.

**Async Tasks** are sticky notes on a board. A single worker picks up a note,
works on it until blocked, sticks it back, picks up another.

## OS Threads (1:1 Model)

Each user-space thread maps to one kernel thread. The OS schedules them.

```
  User Space          Kernel Space          Hardware
  ----------          ------------          --------
  Thread A  -------->  KThread A  -------->  Core 0
  Thread B  -------->  KThread B  -------->  Core 1
  Thread C  -------->  KThread C  -------->  Core 0 (time-sliced)

  1:1 mapping
  OS handles scheduling, preemption, context switching
```

**Characteristics:**
- Stack size: ~1-8 MB (configurable)
- Creation cost: ~50-100 microseconds
- Context switch: ~1-10 microseconds (kernel involvement)
- Preemptive: OS can interrupt at any point
- Limit: thousands (memory-bound)

### Rust: OS Threads

```rust
use std::thread;
use std::sync::Arc;
use std::sync::Mutex;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut num = counter.lock().unwrap();
            *num += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Result: {}", *counter.lock().unwrap());
}
```

Rust threads are 1:1 OS threads. The ownership system (`Arc<Mutex<T>>`)
enforces thread-safe access at compile time. See: **Rust Track**, lesson
on fearless concurrency.

### Python: OS Threads (with GIL)

```python
import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:
            counter += 1

threads = [threading.Thread(target=increment) for _ in range(10)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"Result: {counter}")
```

Python uses real OS threads but the GIL serializes CPU-bound work.
Useful for I/O-bound tasks; for CPU parallelism, use `multiprocessing`.

## Green Threads (M:N Model)

M user-space threads mapped onto N kernel threads, where M >> N.
A runtime scheduler manages the mapping.

```
  User Space                Kernel Space        Hardware
  ----------                ------------        --------
  GreenThread A  --+
  GreenThread B  --+------> KThread 1  -------> Core 0
  GreenThread C  --+
  GreenThread D  --+------> KThread 2  -------> Core 1
  GreenThread E  --+
  GreenThread F  --+------> KThread 3  -------> Core 0

  M:N mapping (6 green threads on 3 kernel threads)
  Runtime scheduler manages assignment
```

**Characteristics:**
- Stack size: ~2-8 KB (growable)
- Creation cost: ~1-5 microseconds
- Context switch: ~100-500 nanoseconds (no kernel)
- Cooperative or hybrid scheduling
- Limit: millions

## Goroutines (Go's M:N)

Go's goroutines are the most well-known green thread implementation.

```go
func main() {
    var wg sync.WaitGroup

    for i := 0; i < 100_000; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            time.Sleep(10 * time.Millisecond)
        }(i)
    }

    wg.Wait()
    fmt.Println("All done")
}
```

100,000 goroutines. Each starts with a ~2KB stack that grows as needed.
The Go runtime multiplexes them onto a small number of OS threads
(typically GOMAXPROCS, which defaults to the number of CPU cores).

```
  Go Runtime Scheduler (GMP Model)
  ================================

  G = Goroutine    M = Machine (OS thread)    P = Processor (logical)

  +---+  +---+  +---+  +---+  +---+
  | G |  | G |  | G |  | G |  | G |    ... (millions possible)
  +---+  +---+  +---+  +---+  +---+
    |      |      |      |      |
    v      v      v      v      v
  [  Local Queue  ]  [  Local Queue  ]
         |                   |
    +----+----+         +----+----+
    |    P    |         |    P    |      (GOMAXPROCS = num cores)
    +----+----+         +----+----+
         |                   |
    +----+----+         +----+----+
    |    M    |         |    M    |      (OS threads)
    +---------+         +---------+
         |                   |
      Core 0              Core 1
```

See: **Go Track** for the full GMP model breakdown.

## Async Tasks (Futures/Promises)

No threads at all for the tasks themselves. An event loop polls futures.

```
  Event Loop (single thread)
  ==========================

         +-------> Task A (ready?) --YES--> run until yield
         |                |
         |               NO
         |                |
  loop --+-------> Task B (ready?) --YES--> run until yield
         |                |
         |               NO
         |                |
         +-------> Task C (ready?) --YES--> run until yield
         |
         +-------> (repeat)

  No extra threads for tasks
  Tasks voluntarily yield at await points
```

### Rust: Tokio Async Tasks

```rust
#[tokio::main]
async fn main() {
    let mut handles = vec![];

    for i in 0..100_000 {
        handles.push(tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            i
        }));
    }

    for handle in handles {
        let _ = handle.await.unwrap();
    }
}
```

Tokio runs a multi-threaded runtime by default. Each OS thread in the
pool runs its own event loop, and tasks can migrate between threads.

### Python: asyncio

```python
import asyncio

async def worker(task_id):
    await asyncio.sleep(0.01)
    return task_id

async def main():
    tasks = [asyncio.create_task(worker(i)) for i in range(100_000)]
    results = await asyncio.gather(*tasks)
    print(f"Completed {len(results)} tasks")

asyncio.run(main())
```

Single-threaded event loop. Great for I/O, terrible for CPU work.

## Comparison Table

```
+------------------+----------+----------+-----------+----------+
|                  | OS Thread| Green Th | Goroutine | Async    |
+------------------+----------+----------+-----------+----------+
| Stack size       | 1-8 MB   | 2-8 KB   | 2 KB+     | 0 (heap) |
| Creation cost    | ~100 us  | ~1-5 us  | ~1 us     | ~0.1 us  |
| Context switch   | ~1-10 us | ~100 ns  | ~100 ns   | ~10 ns   |
| Max count        | ~10K     | ~1M      | ~1M       | ~10M     |
| Preemptive       | Yes      | Varies   | Hybrid*   | No       |
| True parallel    | Yes      | Yes      | Yes       | Depends  |
| Kernel involved  | Yes      | Minimal  | Minimal   | No       |
+------------------+----------+----------+-----------+----------+

* Go goroutines: cooperative at await points, preemptive via
  sysmon (since Go 1.14) for long-running computations.
```

## When to Use What

```
  Need true preemption for untrusted code?  -->  OS Threads
  Need millions of I/O-bound tasks?         -->  Async Tasks
  Need millions of mixed tasks?             -->  Goroutines / Green Threads
  Need predictable latency?                 -->  OS Threads + pinning
  Need maximum throughput for I/O?          -->  Async + thread pool
```

## The Hidden Cost: Context Switching

```
  OS Thread Context Switch
  ========================
  1. Save registers to kernel stack       (~50 ns)
  2. Save FP/SSE state                    (~100 ns)
  3. Switch page tables (if process)      (~1000 ns)
  4. Flush TLB (if process)               (~varies)
  5. Restore new thread state             (~50 ns)
  6. Pipeline flush                       (~100 ns)
  Total: ~1-10 microseconds

  Green Thread Context Switch
  ===========================
  1. Save registers to user stack         (~20 ns)
  2. Swap stack pointer                   (~5 ns)
  3. Restore registers                    (~20 ns)
  Total: ~50-200 nanoseconds

  Async Task Switch
  =================
  1. Return from poll()                   (~5 ns)
  2. Pick next ready future               (~5 ns)
  3. Call poll() on it                    (~5 ns)
  Total: ~10-50 nanoseconds
```

## Exercises

1. **Measure**: Write a benchmark that creates 10,000 OS threads vs 10,000
   goroutines (or async tasks). Compare memory usage and creation time.

2. **Reason**: Why can't async tasks handle CPU-bound work well? What
   happens if one async task runs a tight loop without awaiting?

3. **Design**: You need to handle 100,000 WebSocket connections, each
   sending one message per second. Some messages trigger a CPU-heavy
   encryption step. Which thread model(s) would you combine and why?

4. **Explore**: Go's goroutine scheduler became preemptive in Go 1.14.
   What problem did this solve? (Hint: think about tight loops.)

---

**Next** -> [03 - Shared Memory](03-shared-memory.md)
