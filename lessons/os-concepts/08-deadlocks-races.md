# Lesson 08: Deadlocks and Race Conditions — When Concurrency Goes Wrong

You now know the tools for synchronization. This lesson covers what happens
when those tools are used incorrectly — and how to avoid it.

---

## Race Conditions

A race condition is a bug where the program's behavior depends on the
unpredictable timing of thread execution. The same inputs can produce different
outputs depending on which thread runs first.

### Example: check-then-act

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let inventory = Arc::new(Mutex::new(1)); // only 1 item left

    let mut handles = Vec::new();

    for customer in 0..3 {
        let inventory = Arc::clone(&inventory);
        handles.push(thread::spawn(move || {
            let count = *inventory.lock().unwrap();
            if count > 0 {
                println!("Customer {} sees {} item(s), purchasing...", customer, count);
                thread::sleep(std::time::Duration::from_millis(10));
                let mut inv = inventory.lock().unwrap();
                *inv -= 1;
                println!("Customer {} purchased! Inventory: {}", customer, *inv);
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("Final inventory: {}", *inventory.lock().unwrap());
}
```

The bug: checking the count and decrementing it are two separate critical
sections. All three customers can see `count > 0` before any of them
decrements. Result: inventory goes to -2.

```
Thread 1        Thread 2        Thread 3        Inventory
────────        ────────        ────────        ─────────
read: 1                                         1
check: 1>0 ✓
                read: 1                          1
                check: 1>0 ✓
                                read: 1          1
                                check: 1>0 ✓
decrement                                       0
                decrement                        -1 ← BUG
                                decrement        -2 ← BUG
```

**Fix**: keep the lock held for the entire check-and-act operation:

```rust
let mut inv = inventory.lock().unwrap();
if *inv > 0 {
    *inv -= 1;
    println!("Customer {} purchased! Inventory: {}", customer, *inv);
} else {
    println!("Customer {}: out of stock", customer);
}
```

Now the read, check, and write are one atomic operation (protected by the mutex).

---

## Data Races vs Race Conditions

These are related but distinct:

| | Data Race | Race Condition |
|--|-----------|----------------|
| **Definition** | Two threads access same memory, at least one writes, no synchronization | Outcome depends on unpredictable timing |
| **Consequence** | Undefined behavior (C/C++), memory corruption | Logical bugs, wrong results |
| **Rust prevention** | Compile-time (ownership + type system) | NOT prevented at compile time |
| **Example** | Two threads write to same `i32` without mutex | Check-then-act without holding lock |

Rust prevents **data races** — it's physically impossible to have two threads
writing to the same memory without synchronization in safe Rust. But Rust does
NOT prevent **race conditions** — you can still have logical bugs where the
order of operations matters.

```rust
// This compiles in Rust but has a race condition:
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let account_a = Arc::new(Mutex::new(500));
    let account_b = Arc::new(Mutex::new(500));

    // Thread 1: transfer 200 from A to B
    let a1 = Arc::clone(&account_a);
    let b1 = Arc::clone(&account_b);
    let t1 = thread::spawn(move || {
        let mut a = a1.lock().unwrap();
        *a -= 200;
        drop(a);
        // Context switch here → another thread sees inconsistent state
        // Total money is temporarily 800 instead of 1000
        let mut b = b1.lock().unwrap();
        *b += 200;
    });

    // Thread 2: check total balance
    let a2 = Arc::clone(&account_a);
    let b2 = Arc::clone(&account_b);
    let t2 = thread::spawn(move || {
        let a = a2.lock().unwrap();
        let b = b2.lock().unwrap();
        let total = *a + *b;
        println!("Total: {} (should be 1000)", total);
    });

    t1.join().unwrap();
    t2.join().unwrap();
}
```

No data race (mutexes protect each account), but a race condition exists:
the transfer releases one lock before acquiring the other, creating a window
where the total is inconsistent.

---

## Deadlocks

A deadlock occurs when two or more threads are each waiting for a resource
held by the other. Nobody makes progress. The program hangs forever.

### The narrow bridge analogy

Two cars approach a narrow bridge from opposite sides:

```
Car A ──►  │ BRIDGE │  ◄── Car B
           │        │

Car A: "I'll cross when B backs up."
Car B: "I'll cross when A backs up."

Both wait forever. Neither moves.
```

### Classic deadlock with two mutexes

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let resource_a = Arc::new(Mutex::new("Resource A"));
    let resource_b = Arc::new(Mutex::new("Resource B"));

    let ra = Arc::clone(&resource_a);
    let rb = Arc::clone(&resource_b);

    let t1 = thread::spawn(move || {
        let _a = ra.lock().unwrap();
        println!("Thread 1: locked A, trying to lock B...");
        thread::sleep(std::time::Duration::from_millis(100));
        let _b = rb.lock().unwrap();
        println!("Thread 1: locked both!");
    });

    let ra = Arc::clone(&resource_a);
    let rb = Arc::clone(&resource_b);

    let t2 = thread::spawn(move || {
        let _b = rb.lock().unwrap();
        println!("Thread 2: locked B, trying to lock A...");
        thread::sleep(std::time::Duration::from_millis(100));
        let _a = ra.lock().unwrap();
        println!("Thread 2: locked both!");
    });

    t1.join().unwrap();
    t2.join().unwrap();

    println!("This line is never reached — program is deadlocked");
}
```

What happens:

```
Thread 1                    Thread 2
────────                    ────────
lock A ✓                    lock B ✓
try lock B...               try lock A...
  B is held by T2 → WAIT     A is held by T1 → WAIT
         │                           │
         └──── both waiting ─────────┘
               forever
               DEADLOCK
```

---

## The Four Coffman Conditions

A deadlock can ONLY occur when ALL four conditions hold simultaneously:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  1. MUTUAL EXCLUSION                                     │
│     Resources can't be shared (mutex, not rwlock-read)   │
│                                                          │
│  2. HOLD AND WAIT                                        │
│     A thread holds one resource while waiting for another│
│                                                          │
│  3. NO PREEMPTION                                        │
│     Resources can't be forcibly taken from a thread      │
│                                                          │
│  4. CIRCULAR WAIT                                        │
│     T1 waits for T2, T2 waits for T1 (or longer chain)  │
│                                                          │
│  Break ANY ONE of these → deadlock impossible            │
└──────────────────────────────────────────────────────────┘
```

Visualized as a resource allocation graph:

```
DEADLOCK (cycle exists):           NO DEADLOCK (no cycle):

┌────┐    holds    ┌────┐          ┌────┐    holds    ┌────┐
│ T1 │────────────►│ A  │          │ T1 │────────────►│ A  │
│    │◄────────────│    │          │    │             │    │
└────┘   wants     └────┘          └────┘             └────┘
  │                  ▲                                  ▲
  │ wants            │ holds           wants            │ holds
  ▼                  │               ┌────┐             │
┌────┐             ┌────┐           │ T2 │─────────────┘
│ B  │◄────────────│ T2 │          │    │
│    │────────────►│    │          └────┘
└────┘    holds    └────┘
  ▲                                T1 holds A, T2 wants A.
  │ wants                          T2 waits for T1 to release.
  │                                No cycle → no deadlock.
┌────┐                             T1 will eventually release.
│ T1 │
└────┘

T1→A→T2→B→T1 (cycle!)
```

---

## Deadlock Prevention Strategies

### Strategy 1: Lock ordering (break circular wait)

Always acquire locks in the same global order:

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn transfer(
    from: &Mutex<i64>,
    to: &Mutex<i64>,
    amount: i64,
    from_id: usize,
    to_id: usize,
) {
    let (_first, _second) = if from_id < to_id {
        (from.lock().unwrap(), to.lock().unwrap())
    } else {
        (to.lock().unwrap(), from.lock().unwrap())
    };
    // Now locks are always acquired in order of ID
    // No circular wait possible
}
```

By always locking the lower-ID resource first, two threads can never form
a cycle.

### Strategy 2: Try-lock with backoff (break hold and wait)

```rust
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn try_lock_both(a: &Mutex<String>, b: &Mutex<String>) -> bool {
    loop {
        if let Ok(guard_a) = a.try_lock() {
            if let Ok(guard_b) = b.try_lock() {
                println!("Got both: {} and {}", *guard_a, *guard_b);
                return true;
            }
            drop(guard_a);
        }
        println!("Couldn't get both locks, backing off...");
        thread::sleep(Duration::from_millis(1));
    }
}
```

`try_lock()` returns immediately with `Err` if the lock is held. If you can't
get both, release what you have and retry. This breaks the "hold and wait"
condition.

### Strategy 3: Single lock (break mutual exclusion/hold-and-wait)

Protect all related resources with a single mutex:

```rust
struct BankState {
    accounts: Vec<i64>,
}

let state = Arc::new(Mutex::new(BankState {
    accounts: vec![500, 500, 500],
}));

// One lock for all accounts — can't deadlock
let mut s = state.lock().unwrap();
s.accounts[0] -= 200;
s.accounts[1] += 200;
```

Simple and deadlock-free, but reduces concurrency — only one thread can
access any account at a time.

### Strategy 4: Timeout (practical detection)

```rust
use std::sync::Mutex;
use std::time::Duration;

fn lock_with_timeout<T>(mutex: &Mutex<T>, timeout: Duration) -> Option<std::sync::MutexGuard<T>> {
    let start = std::time::Instant::now();
    loop {
        match mutex.try_lock() {
            Ok(guard) => return Some(guard),
            Err(_) => {
                if start.elapsed() > timeout {
                    return None;
                }
                std::thread::sleep(Duration::from_millis(1));
            }
        }
    }
}
```

If you can't acquire a lock within a timeout, assume deadlock and take
corrective action (release held locks, retry, or report an error).

---

## Livelock

Livelock is like two people meeting in a hallway. Both step aside to let
the other pass — in the same direction. They keep stepping back and forth,
both being "polite," and neither makes progress:

```
Time 1: A moves left,  B moves left   → still blocked
Time 2: A moves right, B moves right  → still blocked
Time 3: A moves left,  B moves left   → still blocked
...forever
```

In code, this happens when threads keep retrying but always conflict:

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let lock_a = Arc::new(AtomicBool::new(false));
    let lock_b = Arc::new(AtomicBool::new(false));

    let la = Arc::clone(&lock_a);
    let lb = Arc::clone(&lock_b);

    thread::spawn(move || {
        loop {
            la.store(true, Ordering::SeqCst);
            if !lb.load(Ordering::SeqCst) {
                println!("Thread 1: got both!");
                break;
            }
            la.store(false, Ordering::SeqCst);
            // "Back off and retry" — but Thread 2 does the same thing
        }
    });

    let la = Arc::clone(&lock_a);
    let lb = Arc::clone(&lock_b);

    thread::spawn(move || {
        loop {
            lb.store(true, Ordering::SeqCst);
            if !la.load(Ordering::SeqCst) {
                println!("Thread 2: got both!");
                break;
            }
            lb.store(false, Ordering::SeqCst);
        }
    });

    thread::sleep(std::time::Duration::from_secs(5));
    println!("(Might still be livelocked after 5 seconds)");
}
```

**Fix**: add randomized backoff. If each thread waits a random amount of time
before retrying, they'll eventually stop colliding:

```rust
use rand::Rng;
use std::time::Duration;

// In the retry loop:
let backoff = rand::thread_rng().gen_range(1..10);
thread::sleep(Duration::from_millis(backoff));
```

---

## Starvation

A thread is "starved" when it's runnable but never gets to run because
higher-priority threads or lock-acquiring threads always go first:

```
Thread A (high priority):   run──run──run──run──run──run──run
Thread B (low priority):    wait─wait─wait─wait─wait─wait─wait
                                                             ↑
                                                         never runs!
```

Common causes:
- Priority-based scheduling without aging.
- Unfair mutex implementations (a thread that just released a lock immediately
  re-acquires it before waiters get a chance).
- Writer starvation in `RwLock` (readers keep coming, writer never gets in).

Rust's `std::sync::Mutex` is NOT guaranteed to be fair. In practice, the OS
usually provides reasonable fairness, but under heavy contention, starvation
is possible.

For guaranteed fairness, use `parking_lot::FairMutex` or design your system
to avoid high contention.

---

## Priority Inversion

A classic systems bug. It crashed the Mars Pathfinder in 1997.

```
Three threads with priorities: High, Medium, Low

Normal operation:
  High runs before Medium, Medium runs before Low.

Priority inversion:
  1. Low acquires mutex M
  2. High needs mutex M → blocks (waiting for Low to release)
  3. Medium runs — it doesn't need M, has higher priority than Low
  4. Low can't run (Medium is hogging CPU)
  5. High can't run (waiting for Low, which can't run)

Result: High-priority task is effectively blocked by Medium,
which has LOWER priority than High. Priorities are inverted.

Timeline:
Low:     [LOCK M────────────────────────UNLOCK M──]
Medium:  [────────RUN──RUN──RUN──RUN──RUN─────────]
High:    [────────BLOCKED (waiting for M)──────────]
                  ↑ Medium shouldn't run before High!
```

**Solution: Priority inheritance** — when a high-priority thread blocks on a
mutex held by a low-priority thread, temporarily boost the low-priority thread
to the high-priority level. This lets it finish quickly and release the lock.

---

## Practical Debugging

### Thread sanitizer (TSan)

Detects data races at runtime. Available for C/C++/Rust:

```bash
# Rust nightly only
RUSTFLAGS="-Z sanitizer=thread" cargo +nightly run
```

### Logging

When debugging concurrency bugs, add logging with thread IDs:

```rust
use std::thread;

fn log(msg: &str) {
    let thread = thread::current();
    let name = thread.name().unwrap_or("unnamed");
    eprintln!("[{:?} / {}] {}", thread.id(), name, msg);
}
```

### Reproduce timing-dependent bugs

Use `thread::sleep()` strategically to widen race condition windows:

```rust
// To reproduce a race condition, add a sleep between the two operations
// that should be atomic but aren't:

let count = inventory.lock().unwrap().clone();
thread::sleep(Duration::from_millis(100)); // force context switch
let mut inv = inventory.lock().unwrap();
if count > 0 {
    *inv -= 1;
}
```

This makes the bug happen consistently instead of randomly, making it easier
to debug.

### Common signs of concurrency bugs

| Symptom | Likely cause |
|---------|-------------|
| Program hangs | Deadlock |
| Wrong results, different each run | Race condition |
| Wrong results, consistent | Logic error (not concurrency) |
| CPU at 100% but no progress | Livelock or busy-wait |
| One thread never completes | Starvation |
| Crash in safe Rust | Usually not a data race (Rust prevents those) |

---

## Summary: What Rust Prevents and What It Doesn't

```
┌──────────────────────────────────────────────────────────┐
│             RUST PREVENTS (compile time)                  │
│                                                          │
│  ✓ Data races (two threads writing same memory)          │
│  ✓ Use-after-free across threads                         │
│  ✓ Dangling references across threads                    │
│  ✓ Sending non-thread-safe types across threads          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│           RUST DOES NOT PREVENT                          │
│                                                          │
│  ✗ Deadlocks (mutual lock waiting)                      │
│  ✗ Race conditions (logical ordering bugs)               │
│  ✗ Livelocks (retry loops with no progress)             │
│  ✗ Starvation (thread never gets resources)              │
│  ✗ Priority inversion                                    │
│                                                          │
│  These are LOGIC bugs, not MEMORY bugs.                  │
│  No type system can prevent all logic bugs.              │
└──────────────────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Create a deadlock, then fix it

```rust
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    let lock_a = Arc::new(Mutex::new("A".to_string()));
    let lock_b = Arc::new(Mutex::new("B".to_string()));

    let la = Arc::clone(&lock_a);
    let lb = Arc::clone(&lock_b);
    let t1 = thread::spawn(move || {
        let a = la.lock().unwrap();
        println!("T1 locked A: {}", *a);
        thread::sleep(Duration::from_millis(100));
        let b = lb.lock().unwrap();
        println!("T1 locked B: {}", *b);
    });

    let la = Arc::clone(&lock_a);
    let lb = Arc::clone(&lock_b);
    let t2 = thread::spawn(move || {
        let b = lb.lock().unwrap();
        println!("T2 locked B: {}", *b);
        thread::sleep(Duration::from_millis(100));
        let a = la.lock().unwrap();
        println!("T2 locked A: {}", *a);
    });

    t1.join().unwrap();
    t2.join().unwrap();
}
```

Run this to confirm it deadlocks. Then fix it using lock ordering (both threads
lock A before B).

### Exercise 2: Find the race condition

```rust
use std::sync::{Arc, Mutex};
use std::thread;

struct BankAccount {
    balance: i64,
}

fn main() {
    let account = Arc::new(Mutex::new(BankAccount { balance: 1000 }));
    let mut handles = Vec::new();

    for _ in 0..10 {
        let acct = Arc::clone(&account);
        handles.push(thread::spawn(move || {
            let balance = acct.lock().unwrap().balance;
            if balance >= 200 {
                thread::sleep(std::time::Duration::from_millis(1));
                let mut acct = acct.lock().unwrap();
                acct.balance -= 200;
                println!("Withdrew 200, balance: {}", acct.balance);
            } else {
                println!("Insufficient: {}", balance);
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("Final: {}", account.lock().unwrap().balance);
}
```

1. Identify the race condition.
2. Explain what can go wrong.
3. Fix it so the balance never goes negative.

### Exercise 3: Dining philosophers

The classic deadlock problem. Five philosophers sit at a round table with a
fork between each pair:

```
        P0
     /      \
   F4        F0
   /          \
  P4          P1
  |            |
  F3          F1
   \          /
    P3      P2
       \  /
        F2
```

Each philosopher needs both adjacent forks to eat. Implement this with threads
and mutexes. First, create the naive version that deadlocks. Then fix it using
one of these strategies:
- Lock ordering (always pick up the lower-numbered fork first).
- Limit concurrency (at most 4 philosophers can try to eat simultaneously —
  use a semaphore).

### Exercise 4: Safe concurrent data structure

Build a thread-safe bounded channel (queue with max capacity):

```rust
use std::collections::VecDeque;
use std::sync::{Condvar, Mutex};

struct BoundedChannel<T> {
    inner: Mutex<VecDeque<T>>,
    capacity: usize,
    not_empty: Condvar,
    not_full: Condvar,
}
```

Implement:
- `new(capacity: usize)` — create the channel.
- `send(item: T)` — blocks if full, pushes when space available.
- `recv() -> T` — blocks if empty, pops when item available.

Test with multiple producer and consumer threads.

### Exercise 5: Thinking questions

1. Can a single-threaded program have a deadlock? (Yes, if it tries to lock
   a non-reentrant mutex it already holds. Or with async, if two futures wait
   for each other.)
2. Why can't the compiler detect deadlocks? (It would need to know all possible
   runtime orderings — equivalent to the halting problem.)
3. In the dining philosophers problem, why does limiting to 4 simultaneous
   eaters prevent deadlock? (With 5 forks and at most 4 philosophers trying,
   at least one philosopher can always get both forks.)
4. Why does randomized backoff help with livelock? (It breaks the symmetry.
   If both threads wait the same amount, they collide again. Random waits
   make collisions unlikely.)
5. Is it possible to have a race condition in a program that uses no shared
   state? (Yes — two processes writing to the same file, two services
   modifying the same database record, etc. Concurrency bugs aren't limited
   to threads sharing memory.)

---

Next: [Lesson 09: File Systems — How Files Actually Work](./09-file-systems.md)
