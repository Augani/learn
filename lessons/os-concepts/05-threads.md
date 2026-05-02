# Lesson 05: Threads — Doing Multiple Things in One Process

Processes are heavyweight. Creating one involves cloning page tables, file
descriptor tables, and process metadata. Threads give you parallelism within a
single process, sharing the same address space. Cheaper to create, faster to
switch between, but harder to use safely.

---

## Threads vs Processes

### The apartment analogy

- **Processes** are separate apartments in a building. Each has its own
  kitchen, bathroom, living room, and front door. Tenants can't enter each
  other's apartments. Safe but expensive — the building manager (kernel) has
  to set up a whole new apartment for each tenant.

- **Threads** are roommates sharing one apartment. They share the kitchen
  (heap), bathroom (file descriptors), and living room (code). Each has their
  own bedroom (stack). Cheaper and faster to communicate, but if one roommate
  leaves a mess in the kitchen, everyone suffers (shared mutable state bugs).

```
┌──────────────────────────────────────────────────────────────┐
│                      PROCESS                                 │
│                                                              │
│  Shared between all threads:                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Code (text segment)                                   │  │
│  │  Heap memory (Box, Vec, String, etc.)                  │  │
│  │  Global/static data                                    │  │
│  │  File descriptors (open files, sockets)                │  │
│  │  PID, environment variables, working directory         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Private to each thread:                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Thread 1    │  │  Thread 2    │  │  Thread 3    │       │
│  │              │  │              │  │              │       │
│  │  Stack       │  │  Stack       │  │  Stack       │       │
│  │  Registers   │  │  Registers   │  │  Registers   │       │
│  │  Thread ID   │  │  Thread ID   │  │  Thread ID   │       │
│  │  Stack ptr   │  │  Stack ptr   │  │  Stack ptr   │       │
│  │  Program ctr │  │  Program ctr │  │  Program ctr │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Comparison table

| Aspect | Process | Thread |
|--------|---------|--------|
| Memory space | Separate (isolated) | Shared within process |
| Creation cost | Heavy (~100 us) | Light (~10 us) |
| Communication | IPC (pipes, sockets) | Direct memory access |
| Crash impact | Only that process dies | Can crash entire process |
| Security | Strong isolation | No isolation between threads |
| Context switch | Expensive (TLB flush) | Cheaper (same page table) |

---

## What Threads Share and Don't Share

### Shared (the dangerous part)

Everything on the heap is visible to all threads. If Thread 1 pushes to a
`Vec<String>` while Thread 2 is iterating it, you have a data race. This is
exactly what Rust's ownership system prevents.

```rust
use std::sync::Arc;

fn main() {
    let data = Arc::new(vec![1, 2, 3, 4, 5]);

    let data_clone = Arc::clone(&data);
    let handle = std::thread::spawn(move || {
        println!("Thread sees: {:?}", data_clone);
    });

    println!("Main sees: {:?}", data);
    handle.join().unwrap();
}
```

`Arc` (Atomic Reference Counted) allows safe shared ownership between threads.
Without it, Rust won't compile — the ownership rules physically prevent you
from accidentally sharing mutable data.

### Not shared (the safe part)

Each thread has its own stack. Local variables in one thread are invisible to
other threads:

```
Thread 1's stack:              Thread 2's stack:

┌─────────────────┐            ┌─────────────────┐
│ fn worker()     │            │ fn worker()     │
│   x = 42       │            │   x = 99        │
│   buf = [0;256] │            │   buf = [0;256] │
└─────────────────┘            └─────────────────┘

Same function, same variable names, completely
separate memory locations. No conflict possible.
```

---

## Why Threads Are Lighter Than Processes

Creating a process with `fork()`:
1. Allocate new PID.
2. Clone page table (even with COW, the table itself is copied).
3. Clone file descriptor table.
4. Clone signal handlers.
5. Set up new process control block.
6. Add to scheduler.

Creating a thread with `clone()`:
1. Allocate new thread ID.
2. Allocate a new stack (typically 2-8 MB).
3. Share everything else with parent.
4. Add to scheduler.

No page table duplication. No file descriptor table copy. The thread just points
to the same process's resources.

---

## OS Threads vs Green Threads

### OS threads (what Rust's std::thread gives you)

Each `std::thread::spawn` creates a real kernel thread. The OS scheduler
decides when it runs. Each gets a full stack (default 2 MB in Rust):

```
Your Rust process
┌──────────────────────────────────────┐
│                                      │
│  OS Thread 1 ─── scheduled by ──►    │
│  OS Thread 2 ─── scheduled by ──►  OS Scheduler
│  OS Thread 3 ─── scheduled by ──►    │
│                                      │
└──────────────────────────────────────┘

Each thread: ~2 MB stack, kernel-managed
Practical limit: hundreds to low thousands
```

### Green threads (what Go's goroutines give you)

Green threads are user-space threads managed by a runtime, not the kernel.
Multiple green threads are multiplexed onto a small pool of OS threads:

```
Go process
┌──────────────────────────────────────────────┐
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │          Go Runtime Scheduler           │ │
│  │                                         │ │
│  │  goroutine 1 ┐                          │ │
│  │  goroutine 2 ├─► OS Thread 1 ──► CPU 1  │ │
│  │  goroutine 3 ┘                          │ │
│  │                                         │ │
│  │  goroutine 4 ┐                          │ │
│  │  goroutine 5 ├─► OS Thread 2 ──► CPU 2  │ │
│  │  goroutine 6 ┘                          │ │
│  │                                         │ │
│  │  goroutine 7 ... 10000 (waiting)        │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

Each goroutine: ~4 KB stack (grows dynamically)
Practical limit: millions
```

### Rust's approach: OS threads + async (tokio)

Rust doesn't have green threads built in. Instead:
- `std::thread::spawn` gives you OS threads (straightforward, ~2 MB each).
- `tokio` / `async-std` gives you async tasks (similar to green threads but
  without stackful coroutines). Tasks are state machines multiplexed onto a
  thread pool.

```rust
// OS threads — heavy, good for CPU-bound work
use std::thread;

fn main() {
    let handle = thread::spawn(|| {
        heavy_computation()
    });
    let result = handle.join().unwrap();
}

// Async tasks — lightweight, good for I/O-bound work
// (needs tokio runtime, covered in lesson 06)
#[tokio::main]
async fn main() {
    let result = tokio::spawn(async {
        fetch_data().await
    }).await.unwrap();
}
```

| | OS threads (std) | Async tasks (tokio) | Green threads (Go) |
|--|-----------------|--------------------|--------------------|
| Stack size | ~2 MB | No stack (state machine) | ~4 KB (growable) |
| Max count | ~thousands | ~millions | ~millions |
| Scheduling | OS kernel | tokio runtime | Go runtime |
| Best for | CPU-bound work | I/O-bound work | Both (simpler API) |

---

## Thread Pools — Reuse Instead of Create

Creating a thread for every task is wasteful — thread creation takes
microseconds, and having thousands of threads causes scheduler overhead.
A thread pool solves this:

```
WITHOUT pool:                   WITH pool:
                                ┌───────────────────────┐
Task 1 → spawn thread → die    │  Thread Pool (4 threads)│
Task 2 → spawn thread → die    │                       │
Task 3 → spawn thread → die    │  Worker 1 ← Task 1   │
Task 4 → spawn thread → die    │  Worker 2 ← Task 2   │
...                             │  Worker 3 ← Task 3   │
Task 1000→ spawn thread→ die   │  Worker 4 ← Task 4   │
                                │                       │
1000 thread creations           │  Task 5 waits in queue│
                                │  Task 6 waits in queue│
                                │  ...                  │
                                │  (workers pick up new │
                                │   tasks when done)    │
                                └───────────────────────┘
                                4 thread creations total
```

In Rust, `rayon` provides a work-stealing thread pool:

```rust
use rayon::prelude::*;

fn main() {
    let numbers: Vec<u64> = (1..=1_000_000).collect();

    let sum: u64 = numbers.par_iter().sum();

    println!("Sum: {}", sum);
}
```

`rayon` splits the work across a pool of threads (one per CPU core by default),
handles work stealing for load balancing, and joins the results. You don't
manage threads at all.

---

## Rust: std::thread in Practice

### Basic thread creation

```rust
use std::thread;

fn main() {
    let handle = thread::spawn(|| {
        for i in 1..=5 {
            println!("spawned thread: {}", i);
            thread::sleep(std::time::Duration::from_millis(100));
        }
        42
    });

    for i in 1..=3 {
        println!("main thread: {}", i);
        thread::sleep(std::time::Duration::from_millis(150));
    }

    let result = handle.join().unwrap();
    println!("thread returned: {}", result);
}
```

### Moving data into threads

Threads might outlive the scope that spawned them, so Rust requires `move`
closures to transfer ownership:

```rust
use std::thread;

fn main() {
    let name = String::from("Augustus");

    let handle = thread::spawn(move || {
        println!("Hello from thread, {}", name);
    });

    // println!("{}", name);  // COMPILE ERROR: name was moved

    handle.join().unwrap();
}
```

Without `move`, the closure would try to borrow `name`, but the compiler can't
guarantee `name` outlives the thread. `move` transfers ownership into the
closure, making it self-contained.

### Multiple threads with shared immutable data

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    let mut handles = Vec::new();

    for chunk_start in (0..data.len()).step_by(3) {
        let data = Arc::clone(&data);
        let handle = thread::spawn(move || {
            let chunk_end = (chunk_start + 3).min(data.len());
            let sum: i32 = data[chunk_start..chunk_end].iter().sum();
            println!("Chunk [{}-{}]: sum = {}", chunk_start, chunk_end, sum);
            sum
        });
        handles.push(handle);
    }

    let total: i32 = handles
        .into_iter()
        .map(|h| h.join().unwrap())
        .sum();

    println!("Total: {}", total);
}
```

### Getting thread info

```rust
use std::thread;

fn main() {
    let builder = thread::Builder::new()
        .name("worker-1".to_string())
        .stack_size(4 * 1024 * 1024);

    let handle = builder.spawn(|| {
        let current = thread::current();
        println!("Thread name: {:?}", current.name());
        println!("Thread ID: {:?}", current.id());
    }).unwrap();

    handle.join().unwrap();
}
```

---

## Thread-Local Storage

Sometimes you want per-thread data without sharing:

```rust
use std::cell::RefCell;

thread_local! {
    static COUNTER: RefCell<u32> = RefCell::new(0);
}

fn increment() {
    COUNTER.with(|c| {
        *c.borrow_mut() += 1;
    });
}

fn get_count() -> u32 {
    COUNTER.with(|c| *c.borrow())
}

fn main() {
    let handles: Vec<_> = (0..3)
        .map(|thread_num| {
            std::thread::spawn(move || {
                for _ in 0..5 {
                    increment();
                }
                println!("Thread {}: count = {}", thread_num, get_count());
            })
        })
        .collect();

    for h in handles {
        h.join().unwrap();
    }

    println!("Main thread: count = {}", get_count());
}
```

Each thread gets its own independent `COUNTER`. No synchronization needed
because no sharing occurs.

---

## Exercises

### Exercise 1: Thread creation and observation

```rust
use std::thread;
use std::time::Duration;

fn main() {
    println!("Main PID: {}", std::process::id());
    println!("Main thread: {:?}", thread::current().id());

    let mut handles = Vec::new();

    for i in 0..4 {
        let handle = thread::Builder::new()
            .name(format!("worker-{}", i))
            .spawn(move || {
                println!(
                    "  {} (thread {:?}) starting",
                    thread::current().name().unwrap_or("unnamed"),
                    thread::current().id()
                );
                thread::sleep(Duration::from_secs(10));
            })
            .unwrap();
        handles.push(handle);
    }

    println!("\nIn another terminal, run:");
    println!("  Linux: ps -T -p {}", std::process::id());
    println!("  macOS: ps -M -p {}", std::process::id());
    println!("  Or use htop and press 'H' to show threads.\n");

    for h in handles {
        h.join().unwrap();
    }
}
```

Run this and observe the threads in htop or ps.

### Exercise 2: Parallel computation

Write a program that:
1. Creates a `Vec<u64>` with 10 million random numbers.
2. Spawns 4 threads, each summing 1/4 of the vector.
3. Collects and adds the partial sums.
4. Compares the result and time with a single-threaded sum.

Hint: Use `Arc` for sharing the vector, and give each thread a range
(start index, end index).

### Exercise 3: Thread-local vs shared

Modify this broken code to compile:
```rust
use std::thread;

fn main() {
    let mut counter = 0;

    let handles: Vec<_> = (0..5)
        .map(|_| {
            thread::spawn(|| {
                counter += 1;  // ERROR: can't borrow as mutable across threads
            })
        })
        .collect();

    for h in handles {
        h.join().unwrap();
    }
    println!("counter: {}", counter);
}
```

Fix it two ways:
a) Using `Arc<Mutex<u32>>` (shared counter).
b) Having each thread return its count and summing in main (no sharing).

### Exercise 4: Thread pool concept

Without using rayon, implement a simple manual thread pool:
1. Create 4 threads that loop, reading tasks from a shared channel.
2. Send 20 tasks (closures or task IDs) through the channel.
3. Each worker processes tasks until the channel is closed.

Hint: Use `std::sync::mpsc::channel()` for the task queue, and wrap the
receiver in `Arc<Mutex<Receiver<Task>>>`.

### Exercise 5: Thinking questions
1. If you have a 4-core CPU, what's the maximum speedup from using 4 threads
   on a CPU-bound task? (Ideally 4x. In practice, less due to synchronization
   overhead.)
2. Why does Rust's `std::thread::spawn` require `'static` lifetime for the
   closure? (The thread might outlive the function that spawned it.)
3. Why would you choose OS threads over async tasks, or vice versa?

---

Next: [Lesson 06: Context Switching — How the OS Juggles Programs](./06-context-switching.md)
