# Lesson 06: Context Switching — How the OS Juggles Programs

You're running Chrome, Slack, Spotify, an IDE, and three terminal sessions.
Your laptop has 8 CPU cores. That's 8 threads running simultaneously, but
you might have 500+ threads across all processes. How do they all seem to
run at the same time? Context switching.

---

## One Core, One Thread at a Time

A single CPU core can execute exactly one thread at any given instant. "Multitasking"
is an illusion created by the OS rapidly switching between threads — thousands of
times per second.

```
Time ──────────────────────────────────────────────────►

Core 0:
┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐
│ T1  ││ T2  ││ T3  ││ T1  ││ T2  ││ T1  ││ T3  │
└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘
      ↑      ↑      ↑      ↑      ↑      ↑
  ctx switch  cs     cs     cs     cs     cs

Each segment is a "time slice" (~1-10 ms).
Each arrow is a context switch (~1-10 us).
```

Threads T1, T2, T3 each think they're running continuously. In reality, they're
taking turns, with the OS saving and restoring their state at each switch.

---

## What Is a Context Switch?

### The chef analogy

A chef is working on three dishes simultaneously in a small kitchen. They can
only actively work on one at a time:

1. Chef is making pasta. Timer goes off for the soup.
2. Chef puts down the pasta tongs, notes "pasta is at step 4, water is boiling."
3. Chef picks up the soup ladle, reads their note "soup needs salt and stir."
4. Chef works on soup. Timer goes off for the roast.
5. Chef puts down the ladle, notes "soup has been salted, stir for 2 more minutes."
6. Chef picks up roast...

The "notes" are the saved CPU registers. The "putting down / picking up tools"
is the context switch. The "timer going off" is the timer interrupt.

### What gets saved and restored

When the OS switches from Thread A to Thread B:

```
SAVE Thread A's context:        LOAD Thread B's context:
┌──────────────────────┐        ┌──────────────────────┐
│ Program Counter (PC) │        │ Program Counter (PC) │
│  → where in the code │        │  → resume here       │
│                      │        │                      │
│ Stack Pointer (SP)   │        │ Stack Pointer (SP)   │
│  → top of A's stack  │        │  → top of B's stack  │
│                      │        │                      │
│ General registers    │        │ General registers    │
│  rax, rbx, rcx, rdx │        │  rax, rbx, rcx, rdx │
│  rsi, rdi, rbp, rsp │        │  rsi, rdi, rbp, rsp │
│  r8-r15              │        │  r8-r15              │
│                      │        │                      │
│ Floating point regs  │        │ Floating point regs  │
│  xmm0-xmm15 (SSE)   │        │  xmm0-xmm15 (SSE)   │
│  ymm0-ymm15 (AVX)   │        │  ymm0-ymm15 (AVX)   │
│                      │        │                      │
│ Status flags (RFLAGS)│        │ Status flags (RFLAGS)│
└──────────────────────┘        └──────────────────────┘

Stored in Thread A's             Loaded from Thread B's
kernel data structure            kernel data structure
(task_struct on Linux)           (task_struct on Linux)
```

For a **thread switch** (same process): just save/restore registers. Same page
table, same TLB entries (mostly).

For a **process switch** (different process): save/restore registers AND switch
page tables AND flush/invalidate TLB. More expensive.

```
Thread switch (same process):

┌────────────────────────────────────────────────┐
│                 Process A                       │
│                                                │
│   Thread 1                Thread 2             │
│   ┌─────────┐            ┌─────────┐          │
│   │registers│ ──save──►  │         │          │
│   │stack ptr│            │registers│ ◄──load  │
│   │prog ctr │            │stack ptr│          │
│   └─────────┘            │prog ctr │          │
│                          └─────────┘          │
│                                                │
│   Same page table ✓  Same TLB ✓               │
└────────────────────────────────────────────────┘
Cost: ~1-3 microseconds


Process switch (different processes):

┌───────────────────┐     ┌───────────────────┐
│    Process A       │     │    Process B       │
│                   │     │                   │
│ Thread            │     │ Thread            │
│ ┌─────────┐      │     │ ┌─────────┐      │
│ │registers│──save │     │ │registers│◄load │
│ └─────────┘      │     │ └─────────┘      │
│                   │     │                   │
│ Page table A      │     │ Page table B      │
└───────────────────┘     └───────────────────┘
       ↓                         ↓
  Switch CR3 register (points to page table)
  Flush TLB (cached translations are wrong now)

Cost: ~3-10 microseconds (TLB flush is the expensive part)
```

---

## The Cost of Context Switching

A context switch itself takes ~1-10 microseconds. But the real cost is larger:

### Direct costs
- Saving/restoring ~100+ registers: ~1 us
- TLB flush (process switch): ~1-5 us of subsequent misses
- Pipeline flush: CPU has to discard in-flight instructions

### Indirect costs (the bigger problem)
- **Cache pollution**: Thread A had its data in L1/L2 cache. Thread B has
  completely different data. All of A's cached data is useless. Thread B
  starts with cold caches, taking 10-100x longer per memory access until
  caches warm up.
- **TLB misses**: After a process switch, every memory access needs a full page
  table walk until TLB fills up again.

```
Time to access data:
  L1 cache hit:     ~1 ns
  L2 cache hit:     ~5 ns
  L3 cache hit:     ~20 ns
  RAM (cache miss):  ~100 ns

After a context switch, many accesses go from 1 ns → 100 ns.
This "cache warmup" period can cost more than the switch itself.
```

### When context switches become a problem

```
Scenario: Web server with 10,000 concurrent connections

Approach 1: One thread per connection (bad)
  10,000 threads × 2 MB stack = 20 GB just for stacks
  Scheduler overhead for 10,000 threads
  Constant context switching → cache thrashing

Approach 2: Thread pool + async I/O (good)
  ~8 threads (one per core) × 2 MB stack = 16 MB
  Millions of async tasks multiplexed on 8 threads
  Minimal context switching → caches stay warm
```

This is why `tokio` exists.

---

## Preemptive vs Cooperative Scheduling

### Preemptive scheduling (what modern OSes use)

The OS can **forcibly** interrupt any thread at any time via a timer interrupt:

```
Thread A is running:
  instruction 1
  instruction 2
  instruction 3
  ──── TIMER INTERRUPT ────
  (CPU traps to kernel)
  Kernel: "A has used its time slice. Switch to B."
  ──── CONTEXT SWITCH TO B ────
  Thread B resumes
```

Advantages:
- No thread can hog the CPU forever.
- One misbehaving thread can't freeze the system.
- Fair allocation of CPU time.

The timer interrupt fires at a regular interval (typically every 1-10 ms).
Each interrupt gives the kernel a chance to decide if the current thread
should continue or be preempted.

### Cooperative scheduling (used by async runtimes)

Threads/tasks voluntarily yield control at specific points:

```
Task A:
  do work...
  await something  ← yields here
  do more work...
  await again       ← yields here

If task A never awaits, other tasks starve.
```

Go's goroutines and Rust's async tasks use cooperative scheduling within their
runtime. The runtime handles multiplexing on top of OS threads, which are still
preemptively scheduled by the kernel.

```
┌─────────────────────────────────────────────┐
│              OS (preemptive)                 │
│  Schedules OS threads onto CPU cores        │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │     Tokio runtime (cooperative)     │    │
│  │  Schedules async tasks onto threads │    │
│  │                                     │    │
│  │  Task A ─┐                          │    │
│  │  Task B ──► OS Thread 1 ──► Core 1  │    │
│  │  Task C ─┘                          │    │
│  │                                     │    │
│  │  Task D ─┐                          │    │
│  │  Task E ──► OS Thread 2 ──► Core 2  │    │
│  │  Task F ─┘                          │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

---

## Time Slices and Quantum

The **time slice** (or quantum) is the maximum time a thread runs before the
scheduler considers switching:

```
Typical values:
  Linux CFS:    ~1-10 ms (dynamic, based on load)
  macOS:        ~10 ms
  Windows:      ~15.6 ms (but configurable)

Too short → too many context switches, overhead dominates
Too long  → poor responsiveness, interactive apps feel laggy
```

The scheduler doesn't always switch at the end of a time slice. If a thread
voluntarily gives up the CPU (e.g., calls `read()` which blocks on I/O), the
scheduler immediately runs another thread without waiting for the time slice
to expire.

---

## Scheduler Policies

### Round-robin (simplest)

Each thread gets a fixed time slice. After it expires, the next thread in the
queue runs:

```
Ready queue: [T1, T2, T3, T4]

Time: ─────────────────────────────────────►
      T1(10ms) T2(10ms) T3(10ms) T4(10ms) T1(10ms) ...

Fair, but doesn't account for priority.
```

### Priority-based

Each thread has a priority. Higher-priority threads run first:

```
Priority queue:
  High:   [T1 (audio player)]
  Medium: [T2 (web server), T3 (compiler)]
  Low:    [T4 (backup), T5 (indexer)]

Audio gets CPU time before backup. Interactive apps feel responsive.

Risk: starvation — low-priority threads might never run.
Solution: aging — boost priority of waiting threads over time.
```

### Linux CFS (Completely Fair Scheduler)

CFS tracks how much CPU time each thread has received ("virtual runtime")
and always picks the thread with the LEAST runtime:

```
Virtual runtimes:
  T1: 50 ms
  T2: 45 ms  ← lowest → runs next
  T3: 52 ms
  T4: 47 ms

After T2 runs for its time slice:
  T1: 50 ms
  T2: 55 ms
  T3: 52 ms
  T4: 47 ms  ← lowest → runs next
```

CFS uses a red-black tree for O(log n) insertion/removal, making it efficient
even with thousands of threads. Interactive processes get a priority boost to
keep UIs responsive.

---

## Why Async/Await Exists

For I/O-bound work (web servers, database clients, file processing), most
threads spend most of their time waiting:

```
Traditional threading (one thread per connection):

Thread 1: [work][──── waiting for network ────][work][wait]
Thread 2: [work][──── waiting for disk ──────][work]
Thread 3: [work][── waiting for network ──][work][── wait ──]

CPU is idle most of the time, but context switches still happen
when threads wake up and go back to sleep.
```

Async/await replaces this with:

```
Single thread, multiple tasks:

Thread: [T1 work][T3 work][T2 work][T1 work][T3 work]...

When T1 awaits (network), the runtime immediately switches to T3.
No context switch. No kernel involvement. Just a function call.
The "switch" is ~10-100 ns instead of ~1-10 us.
```

### How tokio avoids OS thread overhead

```rust
#[tokio::main]
async fn main() {
    let mut handles = Vec::new();

    for i in 0..10_000 {
        handles.push(tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            i * 2
        }));
    }

    let mut sum = 0u64;
    for handle in handles {
        sum += handle.await.unwrap();
    }
    println!("sum: {}", sum);
}
```

10,000 concurrent tasks, but only ~8 OS threads (one per core). Each `await`
point is where the runtime can switch tasks. No OS context switch, no kernel
involvement, no 2 MB stack per task.

The task's state (local variables across await points) is stored as a
compiler-generated state machine on the heap, typically a few hundred bytes
instead of 2 MB.

---

## Measuring Context Switches

### On Linux
```bash
# Context switches system-wide per second
vmstat 1
# Look at the "cs" column

# Context switches for a specific process
cat /proc/<pid>/status | grep ctxt
# voluntary_ctxt_switches: (thread yielded, e.g., I/O)
# nonvoluntary_ctxt_switches: (preempted by scheduler)

# Count context switches of a program
perf stat -e context-switches ./your_program
```

### On macOS
```bash
# System-wide activity
vm_stat 1
```

### From Rust

```rust
use std::thread;
use std::time::{Duration, Instant};

fn main() {
    let iterations = 1_000_000;

    let start = Instant::now();
    for _ in 0..iterations {
        thread::yield_now();
    }
    let elapsed = start.elapsed();

    println!(
        "{} yields in {:?} ({:.0} ns/yield)",
        iterations,
        elapsed,
        elapsed.as_nanos() as f64 / iterations as f64
    );
}
```

`thread::yield_now()` voluntarily gives up the CPU, forcing a context switch
(if another thread is ready). This measures the minimum context switch time.

---

## Exercises

### Exercise 1: Observe context switches

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let pid = std::process::id();
    println!("PID: {}", pid);

    let handles: Vec<_> = (0..8)
        .map(|i| {
            thread::spawn(move || {
                for _ in 0..1_000_000 {
                    std::hint::black_box(i * i);
                }
            })
        })
        .collect();

    println!("Check context switches:");
    println!("  Linux: watch -n 0.5 'cat /proc/{}/status | grep ctxt'", pid);
    println!("  macOS: use Activity Monitor → select process → Sample");

    for h in handles {
        h.join().unwrap();
    }
}
```

### Exercise 2: Threads vs async for I/O

Compare thread-based and async approaches to sleeping (simulating I/O):

```rust
use std::thread;
use std::time::{Duration, Instant};

fn threads_approach(num_tasks: usize) -> Duration {
    let start = Instant::now();
    let handles: Vec<_> = (0..num_tasks)
        .map(|_| {
            thread::spawn(|| {
                thread::sleep(Duration::from_millis(10));
            })
        })
        .collect();
    for h in handles {
        h.join().unwrap();
    }
    start.elapsed()
}

fn main() {
    for count in [100, 1000, 5000] {
        let elapsed = threads_approach(count);
        println!("{} threads: {:?}", count, elapsed);
    }
}
```

Then write the async version using tokio and compare. At what point does the
thread approach start struggling?

### Exercise 3: Priority and fairness

```rust
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

fn main() {
    let counters: Vec<Arc<AtomicU64>> = (0..4)
        .map(|_| Arc::new(AtomicU64::new(0)))
        .collect();

    let deadline = Instant::now() + Duration::from_secs(2);

    let handles: Vec<_> = counters
        .iter()
        .enumerate()
        .map(|(i, counter)| {
            let counter = Arc::clone(counter);
            thread::spawn(move || {
                while Instant::now() < deadline {
                    counter.fetch_add(1, Ordering::Relaxed);
                }
            })
        })
        .collect();

    for h in handles {
        h.join().unwrap();
    }

    for (i, counter) in counters.iter().enumerate() {
        println!(
            "Thread {}: {} iterations",
            i,
            counter.load(Ordering::Relaxed)
        );
    }
    println!("\nAre the counts roughly equal? (CFS tries to be fair)");
}
```

### Exercise 4: Thinking questions
1. If a thread is doing pure computation (no I/O, no syscalls), how does the
   OS regain control to switch to another thread? (Timer interrupt.)
2. Why does having 1000 threads hurt performance even if you have 8 cores?
   (Context switching overhead + cache pollution.)
3. Why are async runtimes cooperative rather than preemptive? (User-space code
   can't set hardware timer interrupts. Cooperation is the only option without
   kernel support.)
4. What happens if an async task does CPU-heavy work without ever hitting an
   await point? (It blocks the worker thread. Other tasks on that thread starve.
   Use `tokio::task::spawn_blocking` for CPU work.)

---

Next: [Lesson 07: Synchronization — Mutexes, Semaphores, Atomics](./07-synchronization.md)
