# Lesson 07: Goroutines

## Thousands of Waiters in a Restaurant

Imagine a restaurant where every customer gets their own personal
waiter. Normal threads are like hiring full-time staff — expensive
(each takes ~1MB stack, OS overhead). Goroutines are like having
magical waiters that cost almost nothing (~2KB stack) and can
number in the millions.

```
OS Threads:                    Goroutines:
+--------+--------+           +--+--+--+--+--+--+--+--+
| Thread | Thread |           |g |g |g |g |g |g |g |g |
| 1 MB   | 1 MB   |          |2K|2K|2K|2K|2K|2K|2K|2K|
+--------+--------+           +--+--+--+--+--+--+--+--+
                              |g |g |g |g |g |g |g |g |
Max: thousands                +--+--+--+--+--+--+--+--+
                              |g |g |g |g |g |g |g |g |
                              +--+--+--+--+--+--+--+--+

                              Max: millions
```

In Rust, you'd use `tokio::spawn` or `std::thread::spawn`. In Go,
you just write `go` before a function call.

---

## Your First Goroutine

```go
package main

import (
    "fmt"
    "time"
)

func greet(name string) {
    for i := 0; i < 3; i++ {
        fmt.Printf("Hello, %s! (%d)\n", name, i)
        time.Sleep(100 * time.Millisecond)
    }
}

func main() {
    go greet("Alice")
    go greet("Bob")

    greet("Main")
}
```

The `go` keyword launches a goroutine. It runs concurrently with
the calling code. If `main()` returns, all goroutines die — even
if they're not done.

---

## The Scheduling Model

```
Go Runtime Scheduler (M:N scheduling)

     Goroutines (G)          OS Threads (M)         CPUs (P)
     +---+---+---+           +-----+-----+          +---+
     | G | G | G |           |  M  |  M  |          | P |
     +---+---+---+     -->   +-----+-----+    -->   +---+
     | G | G | G |           |  M  |  M  |          | P |
     +---+---+---+           +-----+-----+          +---+

     Thousands+               ~GOMAXPROCS             = CPUs
```

The Go scheduler multiplexes goroutines onto OS threads. You don't
manage threads directly. The runtime handles:

- Preemptive scheduling (since Go 1.14)
- Growing/shrinking goroutine stacks
- Parking idle goroutines efficiently

### The GMP Model: How the Scheduler Really Works

Go's scheduler uses three key entities: **G** (goroutines), **M** (OS threads/machines), and **P** (processors/contexts). Understanding this model explains why Go can run millions of goroutines efficiently.

**Analogy — a food court with multiple kitchens:**

Imagine a food court (the Go runtime). There are:
- **Customers (G — goroutines)**: Thousands of hungry people with orders
- **Kitchens (M — OS threads)**: Physical kitchens with real equipment. Expensive to build.
- **Order windows (P — processors)**: The interface between customers and kitchens. Each window has a queue of orders (the local run queue).

```
The GMP Model:

  Global Run Queue (overflow)
  [G] [G] [G] [G] [G]
         |
    +----+----+----+
    |         |         |
    v         v         v
  +---+     +---+     +---+
  | P |     | P |     | P |    ← Processor contexts (GOMAXPROCS)
  +---+     +---+     +---+
  |[G]|     |[G]|     |[G]|   ← Local run queues (fast, no lock)
  |[G]|     |[G]|     |   |
  |[G]|     |   |     |   |
  +---+     +---+     +---+
    |         |         |
    v         v         v
  +---+     +---+     +---+
  | M |     | M |     | M |    ← OS threads
  +---+     +---+     +---+
    |         |         |
  [CPU]     [CPU]     [CPU]    ← Hardware cores
```

**Key insight — the P is the secret sauce.** Without P, every goroutine schedule/deschedule would need to lock the global run queue (slow). With P, each processor has its own local queue — goroutines are scheduled without any locking most of the time.

### Work Stealing: The Idle Kitchen

When a P's local queue is empty, it doesn't just sit idle. It **steals** work from other P's queues.

**Analogy — restaurant kitchen stealing orders:**
Kitchen C has no orders. Kitchen A has 10 orders backed up. Kitchen C reaches over and grabs half of Kitchen A's orders. Now both kitchens are busy. No manager needed to coordinate — each kitchen looks for work on its own.

```
Before work stealing:          After work stealing:
P0: [G][G][G][G][G]           P0: [G][G][G]
P1: [G][G]                    P1: [G][G]
P2: (empty, idle!)            P2: [G][G]  ← stole from P0

Order of theft:
1. Check own local queue       (fastest)
2. Check global run queue      (needs lock, but rare)
3. Steal from other P's queue  (lock-free, half the queue)
4. Check network poller        (any I/O completions?)
```

### When a Goroutine Blocks

**Analogy — a kitchen worker waiting for a delivery:**

When a goroutine does a blocking syscall (like reading a file), the OS thread (M) gets stuck waiting. But Go doesn't waste the P! The P detaches from the blocked M and finds another M (or creates one) to keep running goroutines.

```
Before blocking syscall:        During syscall:
  P0 ←→ M0 running G1           M0 stuck in syscall (with G1)
                                 P0 ←→ M1 (new thread!) running G2

After syscall completes:
  G1 goes back into P0's run queue
  M0 goes back to the idle thread pool
```

This is why Go can handle thousands of concurrent file reads without creating thousands of permanent threads. The thread pool grows and shrinks dynamically.

### Preemptive Scheduling (Since Go 1.14)

Before Go 1.14, goroutines were only descheduled at specific points (function calls, channel ops, I/O). A tight computational loop with no function calls could starve other goroutines.

**Analogy — a customer who won't stop talking:**
Imagine a customer at the order window who just keeps talking and never lets anyone else order. Before 1.14, there was nothing you could do. Since 1.14, the Go runtime can tap the customer on the shoulder and say "excuse me, other people are waiting" (using OS signals — specifically SIGURG on Unix).

```
Before Go 1.14 (cooperative):
  func cpuHog() {
      for { /* infinite loop, no yield points */ }
  }
  // Other goroutines on same P STARVE

After Go 1.14 (preemptive):
  Same function — runtime inserts preemption points
  using asynchronous signals (~10ms time slices)
  Other goroutines get their turn
```

---

## WaitGroups: Waiting for Goroutines

The simplest way to wait for goroutines to finish:

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

func worker(id int, wg *sync.WaitGroup) {
    defer wg.Done()
    fmt.Printf("Worker %d starting\n", id)
    time.Sleep(time.Duration(id*100) * time.Millisecond)
    fmt.Printf("Worker %d done\n", id)
}

func main() {
    var wg sync.WaitGroup

    for i := 1; i <= 5; i++ {
        wg.Add(1)
        go worker(i, &wg)
    }

    wg.Wait()
    fmt.Println("All workers done")
}
```

```
WaitGroup is like a counter:

wg.Add(1)    --> counter: 1, 2, 3 ...
go worker()  --> runs concurrently
wg.Done()    --> counter: ... 2, 1, 0
wg.Wait()    --> blocks until counter == 0
```

Always pass `*sync.WaitGroup` (pointer). Always `defer wg.Done()`
to guarantee it runs even if the goroutine panics.

---

## Mutexes: Protecting Shared State

When multiple goroutines access shared data, you need protection.

```
Without mutex:                 With mutex:

  Goroutine A    Goroutine B     Goroutine A    Goroutine B
  read count=5   read count=5    lock()
  count=6        count=6         read count=5   (waiting...)
  write 6        write 6         count=6
                                 write 6
  Result: 6 (WRONG, lost update) unlock()
                                                lock()
                                                read count=6
                                                count=7
                                                write 7
                                                unlock()
                                 Result: 7 (CORRECT)
```

```go
package main

import (
    "fmt"
    "sync"
)

type SafeCounter struct {
    mu    sync.Mutex
    count int
}

func (c *SafeCounter) Increment() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.count++
}

func (c *SafeCounter) Value() int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.count
}

func main() {
    counter := &SafeCounter{}
    var wg sync.WaitGroup

    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            counter.Increment()
        }()
    }

    wg.Wait()
    fmt.Println("Final count:", counter.Value())
}
```

In Rust, the borrow checker prevents data races at compile time.
In Go, you must use mutexes (or channels) and the race detector.

---

## The Race Detector

Go has a built-in race detector. Use it during development:

```bash
go run -race main.go
go test -race ./...
```

It catches data races at runtime. Not perfect (only finds races
that actually occur during execution), but invaluable.

---

## Common Goroutine Patterns

### Fire and Forget

```go
go func() {
    sendEmail(user.Email, "Welcome!")
}()
```

Be careful — if main exits, this goroutine dies. Use WaitGroups
or channels if the work must complete.

### Launch N Workers

```go
package main

import (
    "fmt"
    "sync"
)

func main() {
    tasks := []string{"A", "B", "C", "D", "E"}
    var wg sync.WaitGroup

    for _, task := range tasks {
        wg.Add(1)
        go func(t string) {
            defer wg.Done()
            fmt.Println("Processing:", t)
        }(task)
    }

    wg.Wait()
}
```

Note: we pass `task` as a parameter to the closure. Before Go 1.22,
capturing the loop variable directly was a classic bug. Since 1.22,
loop variables are per-iteration, but passing explicitly is still
clearer.

### Once: Initialize Exactly Once

```go
package main

import (
    "fmt"
    "sync"
)

var (
    instance *Config
    once     sync.Once
)

type Config struct {
    DBHost string
}

func GetConfig() *Config {
    once.Do(func() {
        fmt.Println("Initializing config...")
        instance = &Config{DBHost: "localhost:5432"}
    })
    return instance
}

func main() {
    var wg sync.WaitGroup

    for i := 0; i < 5; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            cfg := GetConfig()
            fmt.Println("Got:", cfg.DBHost)
        }()
    }

    wg.Wait()
}
```

`sync.Once` guarantees the function runs exactly once, even with
concurrent callers. Perfect for lazy initialization.

---

## Goroutine Lifecycle

```
              go func()
                  |
                  v
           +------------+
           |  Runnable   |  (waiting to be scheduled)
           +------+-----+
                  |
                  v
           +------------+
           |  Running    |  (executing on a thread)
           +------+-----+
                  |
          +-------+-------+
          |               |
          v               v
   +----------+    +----------+
   | Blocked  |    | Finished |
   | (I/O,    |    | (returned|
   |  channel,|    |  or      |
   |  mutex)  |    |  panicked|
   +----+-----+    +----------+
        |
        v
   Back to Runnable
```

---

## Goroutine Leaks

A goroutine that never finishes is a memory leak. Common causes:

- Blocked on a channel nobody sends to
- Blocked on a mutex nobody unlocks
- Infinite loop with no exit condition
- Waiting for I/O that never completes

```go
func leaky() {
    ch := make(chan int)
    go func() {
        val := <-ch
        fmt.Println(val)
    }()
}
```

The goroutine above blocks forever because `ch` is never sent to
and `leaky()` doesn't close it. Use `context.Context` (Lesson 16)
to cancel goroutines cleanly.

---

## Goroutine Debugging: How Many Are Running?

In production, goroutine leaks are silent killers. Here's how to monitor:

```go
import "runtime"

// Check goroutine count
fmt.Println("Goroutines:", runtime.NumGoroutine())

// Dump all goroutine stacks (like a thread dump in Java)
import "runtime/debug"
debug.PrintStack()

// Or use pprof for production monitoring
import _ "net/http/pprof"
// Then visit: http://localhost:6060/debug/pprof/goroutine?debug=1
```

**Rule of thumb:** If `runtime.NumGoroutine()` keeps growing over time, you have a leak. Add this to your health check endpoint.

---

## Exercises

1. Launch 10 goroutines that each print their ID, use a WaitGroup
   to wait for all of them

2. Create a `SafeMap` (goroutine-safe map) using `sync.Mutex` with
   `Get`, `Set`, and `Delete` methods

3. Write a program that simulates 5 workers downloading URLs
   concurrently (use `time.Sleep` to simulate work)

4. Run your code with `-race` flag and fix any races

5. Write a program that demonstrates a goroutine leak, then fix it
   using a done channel

---

[Next: Lesson 08 - Channels ->](08-channels.md)
