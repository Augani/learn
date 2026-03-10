# Lesson 15: Concurrency (Threads, Async/Await, Tokio)

Rust has two main concurrency styles: OS threads and async tasks. This
lesson explains when to use each, what problems they solve, and how Rust's
type system helps keep concurrent code safe.

---

## Why Rust Concurrency Is Different

**Analogy — a construction site with safety inspectors:**

In Go, you build with goroutines and HOPE nobody makes a mistake sharing data (the race detector catches some, but only at runtime). In Python, the GIL acts as a safety net by preventing true parallelism. In Rust, the compiler IS the safety inspector — it reads your blueprints (code) and REFUSES to let you build if it spots a data race. Zero construction accidents, guaranteed.

```
Language         Data Race Prevention         When Caught?
─────────────────────────────────────────────────────────
Go               Race detector (runtime)      Testing (if triggered)
Python           GIL (prevents parallelism)   Never (can't happen*)
Java             Programmer discipline        Production (oops)
Rust             Compiler (Send/Sync traits)  Compile time (before ship)

* Python's GIL prevents CPU parallelism but NOT I/O races
```

The key Rust insight: **if it compiles, there are no data races.** This is enforced by two marker traits:
- `Send`: This type can be transferred to another thread
- `Sync`: This type can be shared (referenced) by multiple threads

---

## OS Threads

### Spawning threads

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        for i in 1..=5 {
            println!("spawned thread: {i}");
            thread::sleep(Duration::from_millis(100));
        }
    });

    for i in 1..=3 {
        println!("main thread: {i}");
        thread::sleep(Duration::from_millis(100));
    }

    handle.join().unwrap();  // wait for thread to finish
}
```

**Go equivalent:**
```go
go func() {
    for i := 1; i <= 5; i++ {
        fmt.Println("goroutine:", i)
        time.Sleep(100 * time.Millisecond)
    }
}()
```

**Key difference:** Go's goroutines are lightweight (green threads, ~8KB stack).
Rust's `thread::spawn` creates OS threads (~8MB stack). For lightweight
concurrency, Rust uses async/await with tokio.

### OS Threads vs Async Tasks: The Real Numbers

**Analogy — hiring employees vs delegating tasks:**

An OS thread is like hiring a full-time employee. They get their own desk (stack), benefits (OS scheduling), and overhead. Great for CPU-heavy work.

An async task is like adding an item to a to-do list. Barely any overhead. A few workers (threads) process a massive to-do list. Great for I/O-heavy work.

```
OS Thread:                    Async Task:
┌────────────────────┐       ┌──────────────────┐
│ Stack: 8 MB        │       │ Future: 64-256 B │
│ OS resources: yes  │       │ OS resources: no │
│ Context switch:    │       │ Context switch:  │
│   1-10 μs (kernel) │       │   ~50 ns (user)  │
│ Max practical:     │       │ Max practical:   │
│   ~10,000          │       │   ~1,000,000     │
└────────────────────┘       └──────────────────┘

10,000 threads × 8MB = 80GB RAM
1,000,000 tasks × 256B = 256MB RAM

Rule of thumb:
  CPU-bound work → std::thread (one per core)
  I/O-bound work → tokio::spawn (thousands)
  Mixed → thread pool + async I/O
```

### Moving data into threads

```rust
use std::thread;

fn main() {
    let name = String::from("Augustus");

    // `move` keyword transfers ownership into the closure
    let handle = thread::spawn(move || {
        println!("Hello from thread, {name}!");
    });

    // println!("{name}");  // COMPILE ERROR: name was moved
    handle.join().unwrap();
}
```

---

## Channels (like Go channels)

### Channels: The Conveyor Belt

**Analogy — a sushi conveyor belt restaurant:**

A channel is like a conveyor belt. The kitchen (sender) places dishes on the belt. Customers (receivers) pick dishes off. The belt has a maximum capacity (bounded channel). If the belt is full, the kitchen waits. If the belt is empty, customers wait.

```
                  Bounded channel (capacity=4)
  Sender ──> [item][item][item][item] ──> Receiver
             ─────────────────────────
             Belt full? Sender blocks.
             Belt empty? Receiver blocks.

  mpsc = Multiple Producers, Single Consumer

  Producer 1 ──┐
  Producer 2 ──┼──> [conveyor belt] ──> Consumer
  Producer 3 ──┘

  Many kitchens, one conveyor, one customer.

  tokio::sync::mpsc     → async, bounded
  std::sync::mpsc        → blocking
  tokio::sync::broadcast → one sender, MANY receivers (like TV)
  tokio::sync::watch     → latest value only (like a scoreboard)
```

```rust
use std::sync::mpsc;  // multiple producer, single consumer
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let messages = vec!["hello", "from", "thread"];
        for msg in messages {
            tx.send(msg.to_string()).unwrap();
        }
    });

    // Receive (blocks until message arrives)
    for received in rx {
        println!("Got: {received}");
    }
}
```

**Go equivalent:**
```go
ch := make(chan string)
go func() {
    ch <- "hello"
    ch <- "from"
    ch <- "goroutine"
    close(ch)
}()
for msg := range ch {
    fmt.Println("Got:", msg)
}
```

### Multiple producers

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    for i in 0..3 {
        let tx = tx.clone();
        thread::spawn(move || {
            tx.send(format!("message from thread {i}")).unwrap();
        });
    }
    drop(tx);  // drop the original sender so rx knows when all senders are done

    for msg in rx {
        println!("{msg}");
    }
}
```

---

## Async/Await with Tokio

This is Rust's version of lightweight concurrency (like goroutines or
TS async/await). You need a runtime — `tokio` is the standard choice.

### Setup

```bash
cargo add tokio --features full
```

### Basic async

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let result = fetch_data().await;
    println!("{result}");
}

async fn fetch_data() -> String {
    sleep(Duration::from_millis(100)).await;
    "data loaded".to_string()
}
```

**TS equivalent:**
```typescript
async function fetchData(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return "data loaded";
}
```

**Go equivalent:**
```go
// Go doesn't have async/await. You'd use goroutines + channels.
```

### Spawning async tasks (like goroutines)

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let task1 = tokio::spawn(async {
        sleep(Duration::from_millis(100)).await;
        "result from task 1"
    });

    let task2 = tokio::spawn(async {
        sleep(Duration::from_millis(50)).await;
        "result from task 2"
    });

    let (r1, r2) = tokio::join!(task1, task2);
    println!("{}", r1.unwrap());
    println!("{}", r2.unwrap());
}
```

**Go equivalent:**
```go
var wg sync.WaitGroup
wg.Add(2)
go func() { defer wg.Done(); /* task 1 */ }()
go func() { defer wg.Done(); /* task 2 */ }()
wg.Wait()
```

### Running tasks concurrently

```rust
use tokio::time::{sleep, Duration};

async fn fetch_user(id: u64) -> String {
    sleep(Duration::from_millis(100)).await;
    format!("User {id}")
}

#[tokio::main]
async fn main() {
    // Sequential (slow — 300ms)
    let u1 = fetch_user(1).await;
    let u2 = fetch_user(2).await;
    let u3 = fetch_user(3).await;

    // Concurrent (fast — 100ms)
    let (u1, u2, u3) = tokio::join!(
        fetch_user(1),
        fetch_user(2),
        fetch_user(3),
    );

    println!("{u1}, {u2}, {u3}");
}
```

---

## Tokio Channels

Tokio has its own async-friendly channels:

```rust
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel(32);  // buffered channel, capacity 32

    tokio::spawn(async move {
        for i in 0..5 {
            tx.send(format!("message {i}")).await.unwrap();
        }
    });

    while let Some(msg) = rx.recv().await {
        println!("Received: {msg}");
    }
}
```

### Other channel types

| Type | Use case | Go equivalent |
|------|----------|---------------|
| `tokio::sync::mpsc` | Multiple senders, one receiver | `chan T` (buffered) |
| `tokio::sync::oneshot` | Send one value | `chan T` with cap 1 |
| `tokio::sync::broadcast` | All receivers get every message | (no direct equivalent) |
| `tokio::sync::watch` | Latest value only, multiple readers | (no direct equivalent) |

---

## Shared State in Async

### RwLock: The Museum Analogy

**Analogy — a museum exhibit:**

A `Mutex` is like a private viewing room — only one person at a time, whether they're looking or touching. An `RwLock` is like a museum exhibit — unlimited visitors can look simultaneously, but if someone needs to restore the painting, everyone must leave and the room is locked until they're done.

```
Mutex:
  Reader 1: lock() → read → unlock()
  Reader 2:          (waiting...)  → lock() → read → unlock()
  Only ONE reader at a time. Unnecessary bottleneck!

RwLock:
  Reader 1: read_lock() → read ─────────→ unlock()
  Reader 2: read_lock() → read ─────────→ unlock()
  Reader 3: read_lock() → read ─────────→ unlock()
  Writer:   (waits for all readers)  → write_lock() → write → unlock()

  Many readers OR one writer. Never both.
  Use when reads >> writes (config, caches).
  Use Mutex when reads ≈ writes (simpler, less overhead).
```

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = tokio::spawn(async move {
            let mut lock = counter.lock().await;  // async-aware lock
            *lock += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();  // awaiting JoinHandle
    }

    println!("Count: {}", *counter.lock().await);
}
```

**Important:** Use `tokio::sync::Mutex` (not `std::sync::Mutex`) in async
code. The std Mutex blocks the OS thread, which can deadlock the async runtime.

---

## Select — Racing Futures

Like Go's `select` statement:

```rust
use tokio::time::{sleep, Duration};
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel(1);

    tokio::spawn(async move {
        sleep(Duration::from_secs(2)).await;
        tx.send("done").await.unwrap();
    });

    tokio::select! {
        msg = rx.recv() => {
            println!("Received: {msg:?}");
        }
        _ = sleep(Duration::from_secs(1)) => {
            println!("Timeout!");
        }
    }
}
```

**Go equivalent:**
```go
select {
case msg := <-ch:
    fmt.Println("Received:", msg)
case <-time.After(time.Second):
    fmt.Println("Timeout!")
}
```

---

## When to Use What

| Scenario | Use | Why |
|----------|-----|-----|
| CPU-heavy work | `thread::spawn` / `rayon` | Needs real OS threads |
| I/O-heavy work (HTTP, DB) | `tokio::spawn` / async | Lightweight, non-blocking |
| Simple parallelism | `rayon` (parallel iterators) | Easiest API |
| Message passing | channels (mpsc) | Decoupled communication |
| Shared mutable state | `Arc<Mutex<T>>` | Thread-safe interior mutability |

---

## The Concurrency Decision Tree

```
What kind of work?
├── I/O-bound (network, disk, database)
│   └── Use async/await (tokio)
│       ├── Need request/response? → tokio::spawn + await
│       ├── Need streaming? → tokio::sync::mpsc channels
│       └── Need broadcast? → tokio::sync::broadcast
│
├── CPU-bound (computation, parsing, crypto)
│   └── Use OS threads (std::thread or rayon)
│       ├── Embarrassingly parallel? → rayon::par_iter()
│       ├── Need shared state? → Arc<Mutex<T>>
│       └── Need message passing? → std::sync::mpsc
│
└── Mixed (web server: I/O + some CPU)
    └── Async I/O + tokio::spawn_blocking for CPU work
        Don't block the async runtime with CPU work!
        spawn_blocking runs it on a separate thread pool.
```

---

## Exercises

### Exercise 1: Parallel sum
```rust
// Split a large vector into chunks
// Sum each chunk in a separate thread
// Combine the results
```

### Exercise 2: Async HTTP fetcher
```rust
// Using tokio, create an async function that "fetches" 5 URLs concurrently
// (simulate with sleep). Print results as they complete.
```

### Exercise 3: Producer-consumer
```rust
// Create a producer task that sends numbers 1..=100 through a channel
// Create 4 consumer tasks that receive and print them
// Use tokio::sync::mpsc
```

---

## Key Takeaways

1. **OS threads** for CPU work. **Async/tokio** for I/O work.
2. **`tokio::spawn`** is the Rust equivalent of `go func()`.
3. **`tokio::join!`** runs futures concurrently (like `sync.WaitGroup`).
4. **`tokio::select!`** races futures (like Go's `select`).
5. **Channels** work similarly to Go — `mpsc` for multi-producer.
6. **`Arc<Mutex<T>>`** for shared mutable state across threads/tasks.
7. **Coming from Go:** The mental model is the same. Rust just requires
   you to choose between threads and async, and be explicit about
   data ownership across task boundaries.

Next: [Lesson 16 — Trait Objects vs Generics](./16-trait-objects.md)
