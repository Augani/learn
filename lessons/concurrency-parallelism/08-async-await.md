# 08 - Async/Await

## The Analogy

A chef in a restaurant kitchen with multiple timers.

She doesn't stand in front of the oven staring at a roast for 45 minutes.
She puts it in, sets a timer, and works on something else. When the
timer dings (the I/O is ready), she comes back to it.

The chef is the **event loop**. The timers are **futures/promises**.
Setting a timer is **await**. The ding is **waking up**.

```
  Chef (Event Loop)
  =================

  [start roast] -> set timer -> [start salad] -> [plate appetizer]
                                                        |
  DING! roast ready <-----------------------------------+
  [take out roast] -> set timer for sauce -> [wash dishes]
                                                   |
  DING! sauce ready <------------------------------+
  [plate main course]

  One chef, zero idle time. Maximum throughput.
```

## Event Loop: The Core

At the heart of every async runtime is an event loop:

```
  Event Loop
  ==========

  loop {
      ready_tasks = poll_all_pending_futures()

      for task in ready_tasks {
          run task until it yields (hits an await)
          if task completed:
              remove from pending
          else:
              register what it's waiting for (I/O, timer, etc.)
      }

      if no tasks ready:
          sleep until OS signals something is ready (epoll/kqueue)
  }

  +----------------------------------------------------------+
  |                    EVENT LOOP                             |
  |                                                          |
  |  Pending: [Future A] [Future B] [Future C] [Future D]   |
  |                                                          |
  |  1. Poll A: Ready! Run until await. Yields.              |
  |  2. Poll B: Not ready (waiting for socket). Skip.        |
  |  3. Poll C: Ready! Run until complete. Remove.           |
  |  4. Poll D: Ready! Run until await. Yields.              |
  |  5. No more ready. Sleep on epoll/kqueue.                |
  |  6. OS: "Socket for B is readable!" Wake up.             |
  |  7. Poll B: Ready! Run until await. Yields.              |
  |  8. Repeat...                                            |
  +----------------------------------------------------------+
```

## Futures and Promises

A **future** (or promise) is a value that doesn't exist yet but will.

```
  STATES OF A FUTURE
  ==================

  [Pending] ----poll()----> [Pending]     (not ready yet)
      |                         |
      +----poll()----> [Ready(value)]     (done! here's the result)
      |
      +----poll()----> [Error(err)]       (failed)

  The event loop calls poll() on each future.
  The future returns Pending or Ready.
```

### Rust: Future Trait

```rust
trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}

enum Poll<T> {
    Ready(T),
    Pending,
}
```

When `poll()` returns `Pending`, the future registers a **waker** with
the reactor. When the I/O is ready, the reactor calls the waker, which
tells the executor to poll this future again.

### Python: Coroutines as Futures

```python
import asyncio

async def fetch_data(url):
    await asyncio.sleep(1)
    return f"Data from {url}"

async def main():
    results = await asyncio.gather(
        fetch_data("api/users"),
        fetch_data("api/posts"),
        fetch_data("api/comments"),
    )
    for r in results:
        print(r)

asyncio.run(main())
```

Three coroutines, all sleeping for 1 second. Total time: ~1 second
(not 3) because they sleep concurrently.

### Go: No Async/Await Needed

```go
func fetchData(url string) string {
    time.Sleep(1 * time.Second)
    return fmt.Sprintf("Data from %s", url)
}

func main() {
    results := make(chan string, 3)

    urls := []string{"api/users", "api/posts", "api/comments"}
    for _, url := range urls {
        go func(u string) {
            results <- fetchData(u)
        }(url)
    }

    for i := 0; i < 3; i++ {
        fmt.Println(<-results)
    }
}
```

Go doesn't have async/await because goroutines make blocking calls
implicitly async. The runtime parks goroutines at I/O points. This is
simpler but less explicit. See: **Go Track** for the runtime scheduler.

## Cooperative Scheduling

Async tasks **voluntarily yield** at await points. The runtime never
preempts them.

```
  COOPERATIVE SCHEDULING
  ======================

  Task A: [run run run AWAIT] [run run AWAIT] [run DONE]
  Task B:                [run AWAIT]     [run run run AWAIT]
  Task C:                          [run AWAIT]        [run DONE]
          -----time----->

  Each task runs until it hits an await, then the scheduler
  picks the next ready task.

  PROBLEM: If a task never awaits...

  Task A: [run run run run run run run run run run...]
  Task B: [STARVED -- never gets to run]
  Task C: [STARVED -- never gets to run]

  This is why CPU-bound work in async code is dangerous.
```

## Structured Concurrency

Modern async code uses **structured concurrency**: child tasks are
scoped to their parent. When the parent finishes or cancels, all
children are cleaned up.

```
  UNSTRUCTURED                    STRUCTURED
  ============                    ==========

  spawn(taskA)                    async with TaskGroup() as tg:
  spawn(taskB)                        tg.create_task(taskA)
  spawn(taskC)                        tg.create_task(taskB)
  // who cleans up?                   tg.create_task(taskC)
  // what if main exits?          // ALL tasks done or cancelled here
  // what if B fails?             // exceptions propagate to parent
```

### Python: TaskGroup (3.11+)

```python
import asyncio

async def fetch(name, delay):
    await asyncio.sleep(delay)
    if name == "bad":
        raise ValueError("fetch failed")
    return f"{name}: done"

async def main():
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(fetch("fast", 0.1))
            tg.create_task(fetch("slow", 0.5))
            tg.create_task(fetch("bad", 0.2))
    except ExceptionGroup as eg:
        for exc in eg.exceptions:
            print(f"Error: {exc}")

asyncio.run(main())
```

### Rust: Structured Concurrency with JoinSet

```rust
use tokio::task::JoinSet;
use std::time::Duration;

#[tokio::main]
async fn main() {
    let mut set = JoinSet::new();

    set.spawn(async {
        tokio::time::sleep(Duration::from_millis(100)).await;
        "fast"
    });

    set.spawn(async {
        tokio::time::sleep(Duration::from_millis(500)).await;
        "slow"
    });

    while let Some(result) = set.join_next().await {
        match result {
            Ok(value) => println!("{}", value),
            Err(e) => eprintln!("Task failed: {}", e),
        }
    }
}
```

## Cancellation

One of the hardest problems in async programming.

```
  CANCELLATION APPROACHES
  =======================

  Python:   task.cancel() raises CancelledError inside the task
            Task must handle it (or not -- it's an exception)

  Rust:     Drop the future. It just stops at the last await point.
            No exception, no cleanup unless you implement Drop.
            DANGER: if dropped between two operations, half-done state!

  Go:       context.WithCancel() + checking ctx.Done() in select
            Cooperative: goroutine must check. Can't force-cancel.

  Erlang:   Send exit signal. Process dies. Supervisor restarts.
            Simplest and most reliable.
```

### Rust: Cancellation Safety

```rust
async fn transfer(from: &Account, to: &Account, amount: u64) {
    from.withdraw(amount).await;
    to.deposit(amount).await;
}
```

If this future is dropped after `withdraw` but before `deposit`,
money disappears! This is a **cancellation safety** bug.

```rust
async fn transfer_safe(from: &Account, to: &Account, amount: u64) {
    let withdrawn = from.withdraw(amount).await;
    if withdrawn {
        if to.deposit(amount).await.is_err() {
            from.deposit(amount).await;
        }
    }
}
```

## Async Runtimes Compared

```
  +------------------+----------+----------+-----------+
  |                  | tokio    | asyncio  | Go runtime|
  +------------------+----------+----------+-----------+
  | Multi-threaded   | Yes      | No*      | Yes       |
  | Work stealing    | Yes      | No       | Yes       |
  | Timer wheel      | Yes      | Yes      | Yes       |
  | I/O backend      | epoll/   | epoll/   | netpoll   |
  |                  | kqueue   | kqueue   |           |
  | Preemptive       | No       | No       | Hybrid    |
  | Cancellation     | Drop     | Exception| Context   |
  +------------------+----------+----------+-----------+

  * Python's asyncio is single-threaded by default.
    You can run multiple event loops on multiple threads.
```

## The Colored Function Problem

Async introduces "function coloring" -- async functions can only be
called from other async functions (with await).

```
  FUNCTION COLORS
  ===============

  sync fn A()  -->  can call sync B()     OK
  sync fn A()  -->  can call async C()    PROBLEM (need runtime)
  async fn D() -->  can call sync B()     OK
  async fn D() -->  can call async C()    OK (just await)

  This creates two "worlds" of code:
  - Sync libraries can't easily use async code
  - Async code can use sync code (by blocking, which is bad)

  Go avoids this entirely -- all code looks sync.
  Rust and Python have this split.
```

## Exercises

1. **Implement**: Write an async web scraper that fetches 10 URLs
   concurrently (not sequentially). Measure the time difference.

2. **Break it**: Write an async task that does CPU-heavy work (e.g.,
   compute Fibonacci(40)) without ever awaiting. Observe how it
   blocks all other tasks. Then fix it with `tokio::task::spawn_blocking`
   or equivalent.

3. **Cancellation**: Write a Rust async function that performs two
   sequential database operations. Analyze: what happens if the
   future is dropped between the two operations? Design a safe version.

4. **Compare**: Implement the same concurrent HTTP fetcher in Python
   asyncio, Rust tokio, and Go goroutines. Which has the simplest code?
   Which gives you the most control?

---

**Next** -> [09 - Coroutines & Fibers](09-coroutines-fibers.md)
