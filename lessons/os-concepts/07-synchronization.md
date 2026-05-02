# Lesson 07: Synchronization — Mutexes, Semaphores, Atomics

Threads share memory. This is powerful and dangerous. Without synchronization,
two threads modifying the same data produces unpredictable results. This lesson
covers the tools that prevent chaos.

---

## The Problem: Shared Mutable State

```rust
// THIS IS BROKEN — DO NOT RUN (won't compile in Rust, but would be a bug in C)
// Shown to illustrate the problem.

static mut BALANCE: i64 = 1000;

fn withdraw(amount: i64) {
    unsafe {
        if BALANCE >= amount {
            // Thread A reads BALANCE = 1000, checks 1000 >= 500 → true
            // ── CONTEXT SWITCH ──
            // Thread B reads BALANCE = 1000, checks 1000 >= 800 → true
            // Thread B: BALANCE = 1000 - 800 = 200
            // ── CONTEXT SWITCH ──
            // Thread A: BALANCE = 1000 - 500 = 500  ← WRONG! Should be -300
            BALANCE -= amount;
        }
    }
}
```

The problem: reading the balance and subtracting from it are TWO separate
operations. A context switch between them lets both threads see the old value.

```
Thread A                    Thread B                BALANCE
────────                    ────────                ───────
read BALANCE (1000)                                  1000
check: 1000 >= 500? yes
                            read BALANCE (1000)      1000
                            check: 1000 >= 800? yes
                            BALANCE = 1000 - 800     200
BALANCE = 1000 - 500                                 500 ← WRONG
                                                     (should be 200-500 = ERROR)
```

This is a **race condition**: the outcome depends on the unpredictable timing
of thread scheduling.

---

## Mutex — Mutual Exclusion

### The bathroom analogy

A mutex is a lock on a single-occupant bathroom:

- Before entering, you lock the door (acquire the mutex).
- While you're inside, nobody else can enter (they wait outside).
- When you leave, you unlock the door (release the mutex).
- The next person waiting enters.

```
Without mutex:                  With mutex:

Thread A: read────write         Thread A: LOCK──read──write──UNLOCK
Thread B:    read────write      Thread B:              wait......LOCK──read──write──UNLOCK
         ↑ RACE!                                  ↑ safe, B waits its turn
```

### Rust: Mutex<T>

Rust's `Mutex<T>` wraps the protected data. You can ONLY access the data by
locking the mutex first. The compiler enforces this — there's no way to forget:

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let balance = Arc::new(Mutex::new(1000i64));

    let mut handles = Vec::new();

    for _ in 0..5 {
        let balance = Arc::clone(&balance);
        handles.push(thread::spawn(move || {
            let mut guard = balance.lock().unwrap();
            if *guard >= 200 {
                *guard -= 200;
                println!("Withdrew 200, balance: {}", *guard);
            } else {
                println!("Insufficient funds: {}", *guard);
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("Final balance: {}", *balance.lock().unwrap());
}
```

Key details:
- `balance.lock()` blocks the current thread until the mutex is available.
- It returns a `MutexGuard<i64>` — a smart pointer that auto-unlocks when
  dropped (end of scope or explicit `drop(guard)`).
- If the thread holding the lock panics, the mutex becomes "poisoned." Future
  `lock()` calls return `Err`. This prevents using data left in an
  inconsistent state.

```
Mutex internals:

┌──────────────────────────┐
│ Mutex<i64>               │
│                          │
│  locked: false           │  ← atomic flag
│  wait_queue: []          │  ← threads waiting to acquire
│  data: 1000              │  ← protected data
│                          │
└──────────────────────────┘

Thread A calls lock():
  1. Atomically set locked = true (if was false)
  2. Return MutexGuard pointing to data
  3. When guard drops → set locked = false, wake one waiter
```

---

## Semaphore — Limited Concurrent Access

### The parking lot analogy

A semaphore is a parking lot with N spaces:

- The counter starts at N (number of permits).
- Each car entering decrements the counter (acquire).
- Each car leaving increments the counter (release).
- When counter = 0, new cars wait at the entrance.

```
Semaphore(3):  [■ ■ ■]  Three spaces available

Thread 1 acquires:  [□ ■ ■]  count = 2
Thread 2 acquires:  [□ □ ■]  count = 1
Thread 3 acquires:  [□ □ □]  count = 0
Thread 4 tries:     BLOCKED  (waits for a release)
Thread 1 releases:  [■ □ □]  count = 1
Thread 4 acquires:  [□ □ □]  count = 0
```

A mutex is just a semaphore with N=1.

Rust's standard library doesn't include a semaphore, but tokio does:

```rust
use std::sync::Arc;
use tokio::sync::Semaphore;

#[tokio::main]
async fn main() {
    let semaphore = Arc::new(Semaphore::new(3));
    let mut handles = Vec::new();

    for i in 0..10 {
        let sem = Arc::clone(&semaphore);
        handles.push(tokio::spawn(async move {
            let permit = sem.acquire().await.unwrap();
            println!("Task {} acquired permit", i);
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            println!("Task {} releasing permit", i);
            drop(permit);
        }));
    }

    for h in handles {
        h.await.unwrap();
    }
}
```

Only 3 tasks run concurrently. The other 7 wait for a permit.

---

## Condition Variables — Waiting for a Condition

A condition variable lets a thread sleep until some condition is true,
without busy-waiting:

```
WITHOUT condvar (busy wait):       WITH condvar:

loop {                             let (lock, cvar) = &*pair;
    let guard = mutex.lock();      let mut started = lock.lock().unwrap();
    if *guard == true {            while !*started {
        break;                         started = cvar.wait(started).unwrap();
    }                              }
    drop(guard);                   // condition is true, continue
    thread::sleep(10ms); // waste
}
```

```rust
use std::sync::{Arc, Condvar, Mutex};
use std::thread;

fn main() {
    let pair = Arc::new((Mutex::new(false), Condvar::new()));

    let pair_clone = Arc::clone(&pair);
    let producer = thread::spawn(move || {
        thread::sleep(std::time::Duration::from_secs(2));
        let (lock, cvar) = &*pair_clone;
        let mut ready = lock.lock().unwrap();
        *ready = true;
        println!("Producer: data is ready!");
        cvar.notify_one();
    });

    let (lock, cvar) = &*pair;
    let mut ready = lock.lock().unwrap();
    while !*ready {
        println!("Consumer: waiting...");
        ready = cvar.wait(ready).unwrap();
    }
    println!("Consumer: data received!");

    producer.join().unwrap();
}
```

`cvar.wait(guard)` atomically:
1. Releases the mutex (so the producer can acquire it).
2. Puts the thread to sleep.
3. When notified, re-acquires the mutex and returns.

The `while !*ready` loop handles **spurious wakeups** — the OS might wake the
thread even without a notify call.

---

## Atomics — Lock-Free Operations for Simple Values

For simple counters or flags, a full mutex is overkill. Atomic operations
execute indivisibly at the CPU level — no lock needed:

```
Regular increment (NOT atomic):     Atomic increment:
  1. Read value from memory         1. CPU executes single
  2. Add 1                             atomic instruction
  3. Write back                        (read-modify-write)
                                       No other core can
  Context switch between                interfere mid-operation
  steps → race condition
```

```rust
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let counter = Arc::new(AtomicU64::new(0));
    let mut handles = Vec::new();

    for _ in 0..8 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            for _ in 0..100_000 {
                counter.fetch_add(1, Ordering::Relaxed);
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("Counter: {}", counter.load(Ordering::Relaxed));
    println!("Expected: {}", 8 * 100_000);
}
```

### Memory ordering (the `Ordering` parameter)

This is one of the most subtle topics in systems programming. The quick version:

| Ordering | Guarantee | Use when |
|----------|-----------|----------|
| `Relaxed` | Only atomicity, no ordering guarantees | Simple counters, statistics |
| `Acquire` | Subsequent reads see all writes before the matching `Release` | Reading a flag/lock |
| `Release` | All prior writes visible to the thread that does `Acquire` | Setting a flag/lock |
| `SeqCst` | Strongest — total order visible to all threads | When in doubt |

Rule of thumb: use `Ordering::SeqCst` unless you have a specific reason to use
something weaker. The performance difference is negligible for most code.

### Common atomic operations

```rust
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

fn main() {
    let counter = AtomicU64::new(0);
    let flag = AtomicBool::new(false);

    counter.store(42, Ordering::SeqCst);
    let val = counter.load(Ordering::SeqCst);

    counter.fetch_add(1, Ordering::SeqCst);
    counter.fetch_sub(1, Ordering::SeqCst);

    let was_false = flag.compare_exchange(
        false,
        true,
        Ordering::SeqCst,
        Ordering::SeqCst,
    );

    let old = counter.swap(100, Ordering::SeqCst);

    println!("val: {}, old: {}, was_false: {:?}", val, old, was_false);
}
```

---

## RwLock — Many Readers OR One Writer

A mutex blocks even when multiple threads only need to read. An `RwLock`
allows concurrent reads but exclusive writes:

```
Mutex:                          RwLock:
  Reader 1: LOCK──read──UNLOCK    Reader 1: READ_LOCK──read──UNLOCK
  Reader 2:       wait...LOCK     Reader 2: READ_LOCK──read──UNLOCK  ← concurrent!
  Reader 3:                       Reader 3: READ_LOCK──read──UNLOCK  ← concurrent!
                                  Writer:         wait..........WRITE_LOCK──write──UNLOCK
```

```rust
use std::sync::{Arc, RwLock};
use std::thread;

fn main() {
    let config = Arc::new(RwLock::new(vec![
        ("max_connections".to_string(), 100u32),
        ("timeout_ms".to_string(), 5000),
    ]));

    let mut handles = Vec::new();

    for i in 0..5 {
        let config = Arc::clone(&config);
        handles.push(thread::spawn(move || {
            let guard = config.read().unwrap();
            println!("Reader {}: {:?}", i, *guard);
        }));
    }

    {
        let config = Arc::clone(&config);
        handles.push(thread::spawn(move || {
            let mut guard = config.write().unwrap();
            guard.push(("new_setting".to_string(), 42));
            println!("Writer: added new setting");
        }));
    }

    for h in handles {
        h.join().unwrap();
    }
}
```

Use `RwLock` when reads vastly outnumber writes (e.g., configuration data,
caches, lookup tables).

---

## How Rust Prevents Data Races at Compile Time

Rust's type system enforces two rules that eliminate data races:

1. **Send** — A type can be transferred to another thread.
2. **Sync** — A type can be shared (via references) between threads.

```
┌─────────────────────────────────────────────────────────┐
│  Type             │  Send?  │  Sync?  │  Thread-safe?   │
├───────────────────┼─────────┼─────────┼─────────────────┤
│  i32, f64, bool   │  Yes    │  Yes    │  Immutable, safe│
│  String, Vec<T>   │  Yes    │  Yes    │  Owned, not     │
│                   │         │         │  shared         │
│  Arc<T>           │  Yes*   │  Yes*   │  *if T:Send+Sync│
│  Mutex<T>         │  Yes    │  Yes    │  Enforces       │
│                   │         │         │  exclusive access│
│  Rc<T>            │  NO     │  NO     │  Not atomic     │
│  Cell<T>          │  Yes    │  NO     │  Interior mut,  │
│                   │         │         │  not thread-safe│
│  RefCell<T>       │  Yes    │  NO     │  Not thread-safe│
│  *mut T           │  NO     │  NO     │  Raw pointer    │
└───────────────────┴─────────┴─────────┴─────────────────┘
```

The compiler checks these traits at every thread boundary:

```rust
use std::rc::Rc;
use std::thread;

fn main() {
    let data = Rc::new(42);
    thread::spawn(move || {
        println!("{}", data);
    });
    // COMPILE ERROR: `Rc<i32>` cannot be sent between threads safely
    // Required trait: `Send`
}
```

The fix: use `Arc` instead of `Rc`. `Arc` uses atomic reference counting,
making it safe to share between threads.

### Comparison with Go

Go has no compile-time data race prevention:

```go
// Go — compiles and runs, but has a data race
counter := 0
for i := 0; i < 10; i++ {
    go func() {
        counter++ // DATA RACE — no compile error
    }()
}
// You need `go run -race` to detect this at runtime
```

```rust
// Rust — won't compile without proper synchronization
let counter = 0;
for _ in 0..10 {
    thread::spawn(move || {
        counter += 1;  // COMPILE ERROR
    });
}
```

Rust forces you to use `Arc<Mutex<i32>>` or `Arc<AtomicI32>`. The cost: more
verbose code. The benefit: data races are physically impossible in safe Rust.

---

## Choosing the Right Tool

```
┌──────────────────────────────────────────────────────────┐
│ What do you need?                                        │
│                                                          │
│ Simple counter/flag?                                     │
│   └── AtomicU64 / AtomicBool                            │
│                                                          │
│ Protect complex data from concurrent access?             │
│   ├── Many readers, rare writes? → RwLock<T>            │
│   └── Frequent writes? → Mutex<T>                       │
│                                                          │
│ Limit concurrent access to N?                            │
│   └── Semaphore (tokio::sync::Semaphore)                │
│                                                          │
│ Wait for a condition to become true?                     │
│   └── Condvar + Mutex                                   │
│                                                          │
│ Share ownership between threads?                         │
│   └── Arc<T> (wraps any of the above)                   │
│                                                          │
│ Avoid shared state entirely?                             │
│   └── Channels (mpsc, crossbeam) — message passing      │
└──────────────────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Thread-safe counter — three ways

Implement a counter that 8 threads each increment 100,000 times. Verify the
final count is 800,000.

**Version A**: `Arc<Mutex<u64>>`

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0u64));
    let mut handles = Vec::new();

    for _ in 0..8 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            for _ in 0..100_000 {
                let mut guard = counter.lock().unwrap();
                *guard += 1;
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }
    println!("Mutex counter: {}", *counter.lock().unwrap());
}
```

**Version B**: Implement the same using `Arc<AtomicU64>`.

**Version C**: Implement using channels — each thread sends its partial count
to main, which sums them.

Benchmark all three with `std::time::Instant`. Which is fastest and why?

### Exercise 2: Read-heavy workload

Create a shared configuration store (`RwLock<HashMap<String, String>>`) with:
- 10 reader threads that each read a key 100,000 times.
- 1 writer thread that updates a key 1,000 times.

Then rewrite using `Mutex<HashMap<String, String>>` and compare performance.
The `RwLock` version should be significantly faster because readers don't
block each other.

### Exercise 3: Producer-consumer with condvar

```rust
use std::collections::VecDeque;
use std::sync::{Arc, Condvar, Mutex};
use std::thread;

fn main() {
    let queue = Arc::new((Mutex::new(VecDeque::<u64>::new()), Condvar::new()));

    let producer_queue = Arc::clone(&queue);
    let producer = thread::spawn(move || {
        for i in 0..20 {
            let (lock, cvar) = &*producer_queue;
            let mut q = lock.lock().unwrap();
            q.push_back(i);
            println!("Produced: {}", i);
            cvar.notify_one();
            drop(q);
            thread::sleep(std::time::Duration::from_millis(50));
        }
    });

    let consumer_queue = Arc::clone(&queue);
    let consumer = thread::spawn(move || {
        let mut consumed = 0;
        while consumed < 20 {
            let (lock, cvar) = &*consumer_queue;
            let mut q = lock.lock().unwrap();
            while q.is_empty() {
                q = cvar.wait(q).unwrap();
            }
            let item = q.pop_front().unwrap();
            println!("Consumed: {}", item);
            consumed += 1;
        }
    });

    producer.join().unwrap();
    consumer.join().unwrap();
}
```

Extend this to have 3 producers and 2 consumers. Make sure every item is
consumed exactly once.

### Exercise 4: Atomic spin lock

Implement a simple spin lock using `AtomicBool`:

```rust
use std::sync::atomic::{AtomicBool, Ordering};

struct SpinLock {
    locked: AtomicBool,
}

impl SpinLock {
    fn new() -> Self {
        SpinLock {
            locked: AtomicBool::new(false),
        }
    }

    fn lock(&self) {
        while self
            .locked
            .compare_exchange_weak(false, true, Ordering::Acquire, Ordering::Relaxed)
            .is_err()
        {
            std::hint::spin_loop();
        }
    }

    fn unlock(&self) {
        self.locked.store(false, Ordering::Release);
    }
}
```

Use this to protect a shared counter and verify correctness. Why is this worse
than a `Mutex` for most use cases? (Answer: spin locks waste CPU while waiting.
Mutexes put the thread to sleep.)

### Exercise 5: Thinking questions
1. Why does Rust's `Mutex::lock()` return a `Result`? (Poisoning — if a thread
   panics while holding the lock.)
2. Can you have a deadlock with a single mutex? (Yes — if a thread tries to
   lock a non-reentrant mutex it already holds.)
3. Why is `Rc<T>` not `Send`? (Its reference count isn't atomic. Two threads
   cloning/dropping could corrupt the count.)
4. When would you use channels instead of shared state? (When you can model
   the problem as message passing rather than shared memory. Often simpler
   and less error-prone.)

---

Next: [Lesson 08: Deadlocks and Race Conditions — When Concurrency Goes Wrong](./08-deadlocks-races.md)
