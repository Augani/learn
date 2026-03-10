# Lesson 8: Concurrency and Parallelism — Doing Multiple Things

## The Restaurant Kitchen

A busy restaurant kitchen is the perfect analogy for understanding concurrency and
parallelism. These two words sound similar, but they mean fundamentally different things.

**Concurrency** = one chef juggling multiple dishes. They chop onions for the soup, put
the roast in the oven, go back to stirring the soup, check on the roast. One person,
multiple tasks, switching between them.

**Parallelism** = multiple chefs each making a dish simultaneously. Chef A makes soup.
Chef B makes salad. Chef C makes dessert. Multiple people, multiple tasks, truly at the
same time.

```
 CONCURRENCY (one chef, multiple dishes)
 =========================================

 Time ---->

 Chef:  [Soup] [Roast] [Soup] [Salad] [Roast] [Soup] [Salad]
         chop   season  stir   wash    check   serve   plate

 One person switching between tasks.
 Tasks OVERLAP in time but don't execute SIMULTANEOUSLY.


 PARALLELISM (multiple chefs, multiple dishes)
 ==============================================

 Time ---->

 Chef A: [Soup ] [Soup ] [Soup ] [Soup ]
 Chef B: [Roast] [Roast] [Roast] [Roast]
 Chef C: [Salad] [Salad] [Salad] [Salad]

 Multiple people working SIMULTANEOUSLY.
 Tasks truly execute AT THE SAME TIME.
```

A key insight: **you can have concurrency without parallelism.** A single-core CPU
juggles multiple tasks by switching between them thousands of times per second — giving
the illusion of simultaneous execution. True parallelism requires multiple CPU cores.

Concurrency is about **structure** (designing a program to handle multiple things).
Parallelism is about **execution** (actually doing multiple things at once).

---

## Why Concurrency Matters

Your CPU is absurdly fast. A modern processor executes billions of instructions per
second. But I/O — reading from disk, waiting for a network response, querying a
database — is glacially slow by comparison.

```
 OPERATION                    TIME (approx)       ANALOGY
 ─────────────────────────────────────────────────────────────
 CPU instruction              0.3 ns              One heartbeat
 L1 cache access              1 ns                3 heartbeats
 L2 cache access              4 ns                12 heartbeats
 RAM access                   100 ns              5 minutes
 SSD read                     100,000 ns          4 days
 HDD read                     10,000,000 ns       1 year
 Network round-trip           150,000,000 ns      15 years
 (same continent)
```

If a CPU cycle were one heartbeat, a network round-trip would take **fifteen years**.

Without concurrency, your web server processes one request at a time. While waiting 15
"years" for a database response, the CPU sits idle. With concurrency, the chef says
"the roast needs 30 minutes in the oven — let me chop vegetables while I wait."

---

## Threads — Hiring Additional Chefs

A **thread** is an independent flow of execution within a program. Think of it as hiring
additional chefs for your kitchen. Each chef has their own cutting board and knife
(their own stack), but they all share the same kitchen, pantry, and refrigerator
(the same heap memory).

```rust
use std::thread;

fn main() {
    // Hire two additional chefs
    let chef_a = thread::spawn(|| {
        println!("Chef A: Making soup");
    });

    let chef_b = thread::spawn(|| {
        println!("Chef B: Making salad");
    });

    println!("Head chef: Making the main course");

    // Wait for both chefs to finish
    chef_a.join().unwrap();
    chef_b.join().unwrap();
}
```

```go
package main

import (
    "fmt"
    "sync"
)

func main() {
    var wg sync.WaitGroup

    wg.Add(2)

    go func() {
        defer wg.Done()
        fmt.Println("Chef A: Making soup")
    }()

    go func() {
        defer wg.Done()
        fmt.Println("Chef B: Making salad")
    }()

    fmt.Println("Head chef: Making the main course")
    wg.Wait()
}
```

```python
import threading

def make_soup():
    print("Chef A: Making soup")

def make_salad():
    print("Chef B: Making salad")

chef_a = threading.Thread(target=make_soup)
chef_b = threading.Thread(target=make_salad)

chef_a.start()
chef_b.start()

print("Head chef: Making the main course")

chef_a.join()
chef_b.join()
```

---

## Processes vs Threads

**Processes** are like separate apartments. Each has its own kitchen, its own
refrigerator, its own copy of everything. They communicate by passing messages through
the mailbox (inter-process communication).

**Threads** are like roommates in a shared apartment. Each has their own bedroom (stack),
but they share the kitchen and living room (heap memory). Faster to communicate, but
they can trip over each other.

```
 PROCESSES (separate apartments)

 +-------------------+     +-------------------+
 | Process A         |     | Process B         |
 |                   |     |                   |
 | [Own heap]        |     | [Own heap]        |
 | [Own stack]       |     | [Own stack]       |
 | [Own code]        |     | [Own code]        |
 | [Own file handles]|     | [Own file handles]|
 +-------------------+     +-------------------+
         |                         |
         +--- IPC (pipes, sockets, shared memory) ---+


 THREADS (roommates in shared apartment)

 +--------------------------------------------------+
 | Process                                          |
 |                                                  |
 |  [Shared heap memory]                            |
 |  [Shared code]                                   |
 |  [Shared file handles]                           |
 |                                                  |
 |  +----------+  +----------+  +----------+       |
 |  | Thread 1 |  | Thread 2 |  | Thread 3 |       |
 |  | [Stack]  |  | [Stack]  |  | [Stack]  |       |
 |  | [Regs]   |  | [Regs]   |  | [Regs]   |       |
 |  +----------+  +----------+  +----------+       |
 +--------------------------------------------------+
```

| Aspect            | Processes                     | Threads                        |
|-------------------|-------------------------------|--------------------------------|
| Memory            | Separate (isolated)           | Shared heap                    |
| Creation cost     | Heavy (fork, copy page tables)| Light (new stack only)         |
| Communication     | IPC (slow, explicit)          | Shared memory (fast, implicit) |
| Crash isolation   | One crash doesn't kill others | One crash can kill all threads |
| Typical use       | Separate programs, sandboxing | Parallel work within a program |

---

## The Shared State Problem

Here is where things get dangerous. Two chefs reaching for the salt shaker at the same
time. Two threads modifying the same variable simultaneously. The result? Chaos.

### Race Conditions

A **race condition** occurs when the outcome of a program depends on the unpredictable
timing of thread execution.

The classic example — the "check then act" bug:

```
 THE MILK PROBLEM
 ================

 You check the fridge. No milk. You go to the store.
 Your roommate checks the fridge. No milk. They go to the store.
 You both come home with milk. Now you have too much milk.

 Thread A                          Thread B
 ────────                          ────────
 read balance: $100                     .
      .                           read balance: $100
 balance = 100 - 40 = $60              .
      .                           balance = 100 - 30 = $70
 write balance: $60                    .
      .                           write balance: $70
                                       .
 Expected final balance: $30      Actual final balance: $70
                                  (One withdrawal was LOST!)
```

This is not a theoretical problem. This exact bug has caused real financial losses,
corrupted databases, and crashed systems.

Here is the bug in code:

```python
import threading

balance = 100

def withdraw(amount):
    global balance
    current = balance          # Step 1: READ
    # ... imagine a context switch happens right here ...
    balance = current - amount # Step 2: WRITE

# Two threads withdraw simultaneously
t1 = threading.Thread(target=withdraw, args=(40,))
t2 = threading.Thread(target=withdraw, args=(30,))
t1.start()
t2.start()
t1.join()
t2.join()

print(f"Balance: {balance}")
# Sometimes 30, sometimes 60, sometimes 70. Never deterministic.
```

The problem: reading and writing the balance is not **atomic** (indivisible). Another
thread can sneak in between the read and the write.

---

## Mutexes/Locks — The "Do Not Disturb" Sign

A **mutex** (mutual exclusion) is like a lock on the bathroom door. Only one person can
be inside at a time. Everyone else waits in line.

```
 MUTEX IN ACTION
 ===============

 Thread A                           Thread B
 ────────                           ────────
 lock(mutex)     ← acquires lock         .
 read balance                       lock(mutex) ← BLOCKED, waits
 write balance                           .
 unlock(mutex)   ← releases lock         .
      .                             (now acquires lock)
      .                             read balance
      .                             write balance
      .                             unlock(mutex)
```

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let balance = Arc::new(Mutex::new(100));

    let b1 = Arc::clone(&balance);
    let t1 = thread::spawn(move || {
        let mut bal = b1.lock().unwrap(); // Acquire lock
        *bal -= 40;
        // Lock automatically released when `bal` goes out of scope
    });

    let b2 = Arc::clone(&balance);
    let t2 = thread::spawn(move || {
        let mut bal = b2.lock().unwrap(); // Acquire lock
        *bal -= 30;
    });

    t1.join().unwrap();
    t2.join().unwrap();

    println!("Balance: {}", *balance.lock().unwrap()); // Always 30
}
```

```go
package main

import (
    "fmt"
    "sync"
)

func main() {
    var mu sync.Mutex
    balance := 100

    var wg sync.WaitGroup
    wg.Add(2)

    go func() {
        defer wg.Done()
        mu.Lock()         // Acquire lock
        balance -= 40
        mu.Unlock()       // Release lock
    }()

    go func() {
        defer wg.Done()
        mu.Lock()
        balance -= 30
        mu.Unlock()
    }()

    wg.Wait()
    fmt.Println("Balance:", balance) // Always 30
}
```

Mutexes solve the race condition, but they introduce a new problem.

---

## Deadlock — The Deadly Embrace

**Deadlock** occurs when two or more threads each hold a resource the other needs, and
neither will release what they have. Everyone is stuck forever.

The classic illustration: **The Dining Philosophers Problem.**

Five philosophers sit around a table. Between each pair is one chopstick (five total).
To eat, a philosopher needs both the chopstick to their left and the one to their right.

If every philosopher picks up their left chopstick simultaneously, they all wait for the
right chopstick — which their neighbor is holding. Nobody eats. Everyone starves.

```
 DEADLOCK
 ========

 Thread A holds Lock 1, wants Lock 2
 Thread B holds Lock 2, wants Lock 1
 Neither can proceed.

      Thread A                 Thread B
      ┌──────┐                 ┌──────┐
      │ HOLDS│                 │ HOLDS│
      │Lock 1│ ──── wants ──-> │Lock 2│
      │      │ <─── wants ──── │      │
      └──────┘                 └──────┘

      Both threads are STUCK FOREVER.


 THE DINING PHILOSOPHERS (5 around a table)

           P1
         /    \
      C5        C1
      /            \
    P5              P2
      \            /
      C4        C2
         \    /
      P4 ─ C3 ─ P3

  Pi = Philosopher i
  Ci = Chopstick i

  Each philosopher grabs left chopstick first.
  All grab simultaneously → all hold one, need one → DEADLOCK
```

The deadlock in code:

```python
import threading

lock_a = threading.Lock()
lock_b = threading.Lock()

def thread_1():
    lock_a.acquire()
    # Tiny delay makes deadlock almost certain
    lock_b.acquire()     # BLOCKED — thread_2 holds lock_b
    print("Thread 1 done")
    lock_b.release()
    lock_a.release()

def thread_2():
    lock_b.acquire()
    lock_a.acquire()     # BLOCKED — thread_1 holds lock_a
    print("Thread 2 done")
    lock_a.release()
    lock_b.release()

t1 = threading.Thread(target=thread_1)
t2 = threading.Thread(target=thread_2)
t1.start()
t2.start()
# Program hangs forever. Neither thread prints "done."
```

**Deadlock prevention strategies:**
1. **Lock ordering**: Always acquire locks in the same order (A then B, never B then A).
2. **Timeout**: Try to acquire a lock with a timeout. If it fails, release everything and retry.
3. **Avoid nested locks**: Redesign so you never need to hold two locks simultaneously.
4. **Use channels instead**: Avoid shared state entirely (more on this below).

---

## Async/Await — Cooperative Concurrency

Threads are preemptive — the operating system can interrupt a thread at any time and
switch to another. **Async/await** is cooperative — a task voluntarily pauses itself when
it has nothing to do (like waiting for I/O).

Think of a chef who says: "The pasta needs to boil for 8 minutes. Instead of standing
here watching the pot, let me go prep the salad. When the timer goes off, I'll come
back to the pasta."

The chef is not two people (not two threads). It is one person efficiently using their
time by switching tasks at natural pause points.

```
 THREADS (preemptive)                  ASYNC (cooperative)

 OS decides when to switch             Task decides when to yield

 Thread A: [---work---]|               Task A: [--work--][await]
 Thread B:       [---work---]|         Task B:      [--work--][await]
 Thread A:             [--work--]      Task A:           [--work--]
                  ^                                  ^
           OS interrupts                    Task voluntarily yields
           (could be anywhere)              (only at await points)
```

```rust
// Rust with tokio
use tokio;

#[tokio::main]
async fn main() {
    // These two requests run concurrently on ONE thread
    let (result_a, result_b) = tokio::join!(
        fetch_data("https://api.example.com/a"),
        fetch_data("https://api.example.com/b"),
    );
    println!("Got: {} and {}", result_a, result_b);
}

async fn fetch_data(url: &str) -> String {
    // When this hits the network, the task yields control
    // so another task can run while we wait for the response
    let response = reqwest::get(url).await.unwrap();
    response.text().await.unwrap()
}
```

```python
import asyncio
import aiohttp

async def fetch_data(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()

async def main():
    # Both requests happen concurrently on ONE thread
    result_a, result_b = await asyncio.gather(
        fetch_data("https://api.example.com/a"),
        fetch_data("https://api.example.com/b"),
    )
    print(f"Got: {result_a} and {result_b}")

asyncio.run(main())
```

**When to use async vs threads:**
- **Async**: Best for I/O-bound work (web servers, API calls, database queries). Low overhead, scales to thousands of concurrent tasks.
- **Threads**: Best for CPU-bound work (number crunching, image processing). Uses multiple cores.

---

## Channels and Message Passing — Don't Share, Communicate

Instead of two chefs fighting over a shared ingredient, what if they passed ingredients
through a window? Chef A puts tomatoes on the counter. Chef B picks them up. No collision,
no locking, no race conditions.

This is the **message passing** model. Go made it famous with the proverb:

> "Don't communicate by sharing memory; share memory by communicating."

```
 SHARED STATE (locks required)       MESSAGE PASSING (no locks needed)

 +----------+    +----------+        +----------+          +----------+
 | Thread A |    | Thread B |        | Thread A |          | Thread B |
 |          |    |          |        |          |          |          |
 +----+-----+    +-----+----+        +----+-----+          +-----+----+
      |                |                  |                      |
      v                v                  |    +-----------+     |
   +---------+                            +--> | Channel   | -->-+
   | Shared  |  <-- DANGER!                    | (message  |
   | Memory  |  <-- Needs locks                |  queue)   |
   +---------+                                 +-----------+
```

```go
package main

import "fmt"

func producer(ch chan<- int) {
    for i := 0; i < 5; i++ {
        ch <- i // Send value into channel
    }
    close(ch) // Signal: no more values
}

func main() {
    ch := make(chan int)

    go producer(ch)

    // Receive values until channel is closed
    for value := range ch {
        fmt.Println("Received:", value)
    }
}
```

```rust
use std::sync::mpsc; // mpsc = multi-producer, single-consumer
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        for i in 0..5 {
            tx.send(i).unwrap(); // Send value through channel
        }
    });

    // Receive values until sender is dropped
    for value in rx {
        println!("Received: {}", value);
    }
}
```

Channels enforce a discipline: data flows in one direction, from sender to receiver.
There is no shared mutable state, so no race conditions. The channel itself handles
synchronization internally.

---

## How Different Languages Handle Concurrency

### Rust — Fearless Concurrency

Rust's ownership system prevents data races at compile time. If two threads could access
the same data and one could write, the program will not compile. Period.

```rust
use std::thread;

fn main() {
    let mut data = vec![1, 2, 3];

    thread::spawn(|| {
        data.push(4); // COMPILE ERROR: data moved into closure,
                       // but main thread might still use it
    });

    println!("{:?}", data); // Would be a data race
}
```

Rust forces you to choose: either move ownership to the thread (it owns the data
exclusively) or wrap it in `Arc<Mutex<T>>` (shared ownership with locking). The borrow
checker makes data races impossible.

### Go — Goroutines and Channels

Go's goroutines are extremely lightweight threads (2KB initial stack vs 1-8MB for OS
threads). You can spin up millions of them.

```go
// Launch a million concurrent tasks — try this with OS threads!
for i := 0; i < 1_000_000; i++ {
    go func(id int) {
        // do work
    }(i)
}
```

Go's scheduler multiplexes goroutines onto a small number of OS threads. The runtime
handles scheduling, so you think in terms of concurrent tasks, not thread management.

### Python — The GIL Problem

Python has a **Global Interpreter Lock (GIL)**. Only one thread can execute Python
bytecode at a time, even on a multi-core machine. Your four chefs have to share one
knife and take turns using it.

```python
import threading
import time

def cpu_bound_work():
    total = 0
    for i in range(10_000_000):
        total += i

# This is NOT faster than sequential, because of the GIL:
t1 = threading.Thread(target=cpu_bound_work)
t2 = threading.Thread(target=cpu_bound_work)

start = time.time()
t1.start()
t2.start()
t1.join()
t2.join()
print(f"Threaded: {time.time() - start:.2f}s")  # About the same as single-threaded!
```

Workarounds:
- `multiprocessing` — use separate processes instead of threads (separate apartments, not roommates).
- `asyncio` — for I/O-bound work, the GIL is released during I/O waits.
- C extensions (NumPy, etc.) release the GIL during computation.

### JavaScript — The Event Loop

JavaScript is single-threaded. Always has been (in the main thread). Concurrency is
achieved through the **event loop**: a single chef with a timer system.

```
 THE JAVASCRIPT EVENT LOOP
 =========================

    ┌──────────────────────┐
    │     Call Stack        │    ← currently executing code
    └──────────┬───────────┘
               │ (when empty, check queue)
               v
    ┌──────────────────────┐
    │   Callback Queue     │    ← completed async operations waiting to run
    │  [onClick] [fetch]   │
    └──────────────────────┘
               ^
               │ (completed I/O pushes callbacks here)
    ┌──────────────────────┐
    │   Web APIs / OS      │    ← network requests, timers, file I/O
    │   (run in parallel)  │       (these DO run on separate threads,
    └──────────────────────┘        but your code stays single-threaded)
```

The I/O operations happen on separate threads managed by the runtime (libuv in Node.js),
but your JavaScript code always executes on one thread. This eliminates race conditions
on JavaScript objects — at the cost of never being able to do CPU-intensive work without
blocking the UI.

---

## Common Concurrency Patterns

### Worker Pool

Like a restaurant with a fixed number of chefs. Orders (tasks) go into a queue.
Whichever chef finishes first takes the next order.

```go
package main

import (
    "fmt"
    "sync"
)

func worker(id int, jobs <-chan int, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {
        fmt.Printf("Worker %d processing job %d\n", id, job)
    }
}

func main() {
    jobs := make(chan int, 100)
    var wg sync.WaitGroup

    // Start 3 workers (3 chefs)
    for w := 1; w <= 3; w++ {
        wg.Add(1)
        go worker(w, jobs, &wg)
    }

    // Send 10 jobs
    for j := 1; j <= 10; j++ {
        jobs <- j
    }
    close(jobs) // No more jobs

    wg.Wait()
}
```

### Fan-Out / Fan-In

Split work across many goroutines (fan-out), then collect results into one place (fan-in).
Like a head chef assigning different prep tasks to sous chefs and then combining
everything into the final dish.

```
 FAN-OUT / FAN-IN
 ================

               ┌─── Worker A ───┐
               │                 │
  Input ───────┼─── Worker B ───┼──── Merged Output
               │                 │
               └─── Worker C ───┘

  One input channel         One output channel
  Many processors           Results merged
```

---

## Exercises

### Exercise 1: Experience a Race Condition

Run this Go program multiple times. Observe that you get different results:

```go
package main

import (
    "fmt"
    "sync"
)

func main() {
    counter := 0
    var wg sync.WaitGroup

    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            counter++ // NOT thread-safe
        }()
    }

    wg.Wait()
    fmt.Println("Counter:", counter) // Rarely 1000!
}
```

Now fix it by adding `sync.Mutex`. Verify the result is always 1000.

Then try using `sync/atomic` instead. When would you prefer atomic operations over a mutex?

### Exercise 2: Create a Deadlock

Write a program in any language that deadlocks. Two goroutines/threads, two locks,
acquired in opposite order. Observe the hang. Then fix it by enforcing consistent
lock ordering.

### Exercise 3: Producer-Consumer with Channels

Implement a pipeline in Go:
1. Producer generates numbers 1 to 100.
2. Stage 1 (square): receives numbers, sends their squares.
3. Stage 2 (filter): receives squares, sends only those divisible by 3.
4. Consumer prints the final results.

Each stage should be a separate goroutine. Use channels to connect them.

```
 [Producer] --ch1--> [Square] --ch2--> [Filter] --ch3--> [Consumer]
```

### Exercise 4: Async Web Fetcher

Write a Python program using `asyncio` and `aiohttp` (or `httpx`) that fetches 5 URLs
concurrently. Compare the wall-clock time to fetching them sequentially. How much
faster is the concurrent version?

### Exercise 5: Spot the Concurrency Bug

This Rust code compiles and runs but has a logic bug. Can you find it?

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let data = Arc::new(Mutex::new(vec![1, 2, 3, 4, 5]));
    let sum = Arc::new(Mutex::new(0));

    let mut handles = vec![];

    for i in 0..5 {
        let data = Arc::clone(&data);
        let sum = Arc::clone(&sum);
        handles.push(thread::spawn(move || {
            let d = data.lock().unwrap();
            let s = &d[i];
            drop(d); // Release data lock before acquiring sum lock (good!)

            let mut total = sum.lock().unwrap();
            *total += s; // BUG: what is `s` pointing to here?
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("Sum: {}", *sum.lock().unwrap());
}
```

Hint: Think about what `s` references after `d` is dropped.

---

## Key Takeaways

1. **Concurrency is structure; parallelism is execution.** You can be concurrent on one core. Parallelism requires multiple cores.
2. **CPUs are fast; I/O is slow.** Concurrency lets you do useful work while waiting for I/O instead of blocking.
3. **Threads share memory.** This is both their strength (fast communication) and their danger (race conditions).
4. **Race conditions are non-deterministic.** A program with a race condition might work correctly 999 times and fail on the 1000th. Testing alone cannot catch them.
5. **Mutexes prevent races but enable deadlocks.** Every lock you add is a potential deadlock. Lock ordering and minimal lock scope are your friends.
6. **Async/await is cooperative concurrency.** One thread, many tasks, yielding at I/O boundaries. Ideal for network services.
7. **Message passing (channels) avoids shared state entirely.** If you don't share memory, you can't have race conditions on shared memory.
8. **Different languages make different trade-offs.** Rust prevents data races at compile time. Go makes concurrency cheap with goroutines. Python's GIL limits thread parallelism. JavaScript embraces single-threaded async.
9. **Pick the right tool for the job.** CPU-bound work needs parallelism (multiple cores). I/O-bound work needs concurrency (async or threads). Don't use threads for I/O; don't use async for CPU work.
