# Lesson 14: Common Concurrency Bugs

> The bugs that keep experienced engineers up at night.
> They're intermittent, hard to reproduce, and devastating.

---

## Bug 1: Race Condition

Two threads access shared data, at least one writes,
and there's no synchronization.

```
  BANK ACCOUNT EXAMPLE:
  balance = $100

  Thread A: read balance (100)
  Thread B: read balance (100)
  Thread A: balance = 100 + 50 = 150, write
  Thread B: balance = 100 - 30 = 70, write

  EXPECTED: $120 ($100 + $50 - $30)
  ACTUAL:   $70 (Thread A's write was overwritten!)

  TIMELINE:
  Thread A:  [read=100]         [write 150]
  Thread B:      [read=100]          [write 70]
  Memory:   100         100    150         70
                                    ^
                                    LOST UPDATE!
```

```python
import threading

counter = 0

def increment(n):
    global counter
    for _ in range(n):
        counter += 1

threads = [threading.Thread(target=increment, args=(100_000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"Expected: 400000, Actual: {counter}")
```

```python
import threading

counter = 0
lock = threading.Lock()

def increment_safe(n):
    global counter
    for _ in range(n):
        with lock:
            counter += 1

threads = [threading.Thread(target=increment_safe, args=(100_000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"Expected: 400000, Actual: {counter}")
```

---

## Bug 2: Deadlock

Two or more threads each hold a lock and wait for
a lock held by another. Nobody can proceed.

```
  DINING PHILOSOPHERS (simplified):

  Thread A:
  1. Lock(resource_1)    <-- acquired
  2. Lock(resource_2)    <-- BLOCKED (Thread B holds it)

  Thread B:
  1. Lock(resource_2)    <-- acquired
  2. Lock(resource_1)    <-- BLOCKED (Thread A holds it)

  CIRCULAR WAIT!

  Thread A             Thread B
  holds: resource_1    holds: resource_2
  wants: resource_2    wants: resource_1

       +-----+  wants  +-----+
       |  A  | ------> |  2  |
       +-----+         +-----+
         ^                |
    holds|           holds|
         |                v
       +-----+  wants  +-----+
       |  1  | <------ |  B  |
       +-----+         +-----+

  FOUR CONDITIONS (ALL must hold):
  1. Mutual exclusion: resource held by only one thread
  2. Hold and wait: thread holds one, waits for another
  3. No preemption: locks can't be forcibly taken
  4. Circular wait: A waits for B, B waits for A
```

### Prevention: Lock Ordering

```python
import threading

lock_a = threading.Lock()
lock_b = threading.Lock()

def transfer_deadlock(amount):
    with lock_a:
        with lock_b:
            pass

def transfer_deadlock_other(amount):
    with lock_b:
        with lock_a:
            pass

def transfer_safe(from_lock, to_lock, amount):
    first, second = sorted([from_lock, to_lock], key=id)
    with first:
        with second:
            pass
```

---

## Bug 3: Livelock

Threads keep responding to each other but make no progress.
Like two people in a hallway who keep stepping aside
in the same direction.

```
  HALLWAY ANALOGY:

  Person A: "Oh, you go left"  -> steps right
  Person B: "Oh, you go left"  -> steps right
  Person A: "Oh, you go left"  -> steps left
  Person B: "Oh, you go left"  -> steps left
  ... forever ...

  THREAD VERSION:

  Thread A:              Thread B:
  try lock_1 -> got it   try lock_2 -> got it
  try lock_2 -> fail     try lock_1 -> fail
  release lock_1         release lock_2
  retry...               retry...
  try lock_1 -> got it   try lock_2 -> got it
  try lock_2 -> fail     try lock_1 -> fail
  (repeat forever)       (repeat forever)

  BOTH threads are running (not blocked),
  but NEITHER makes progress.

  FIX: add random backoff before retrying.
  Thread A waits 50ms, Thread B waits 120ms.
  Now they won't keep colliding.
```

---

## Bug 4: Priority Inversion

A high-priority thread is blocked by a low-priority thread,
while a medium-priority thread runs instead.

```
  THREE THREADS:
  High (H): needs lock L
  Medium (M): CPU-intensive, no lock needed
  Low (L): holds lock L

  TIMELINE:
  Low gets lock L:      [L runs, holds lock]
  High needs lock L:    [H blocked, waiting for L]
  Medium starts:        [M runs, preempts L because M > L priority]
  Low can't finish:     [L preempted, still holds lock]
  High still blocked:   [H waiting... waiting... waiting...]

  RESULT: High-priority thread is effectively at LOW priority!
  Medium runs, High waits, Low is preempted.

  THIS CRASHED THE MARS PATHFINDER IN 1997.

  FIX: Priority Inheritance
  When H waits for L's lock, temporarily boost L's priority to H.
  L now preempts M, finishes, releases lock.
  H gets the lock and runs.
```

---

## Bug 5: Thundering Herd

Many threads/processes are woken up but only one can proceed.

```
  100 THREADS WAITING ON SAME CONDITION:

  Event fires!
  +-- Thread 1: wakes up, checks condition, GETS IT
  +-- Thread 2: wakes up, checks condition, fails, sleeps
  +-- Thread 3: wakes up, checks condition, fails, sleeps
  +-- Thread 4: wakes up, checks condition, fails, sleeps
  ...
  +-- Thread 100: wakes up, checks condition, fails, sleeps

  99 THREADS WOKE UP FOR NOTHING.
  CPU spike for zero useful work.

  REAL EXAMPLE: cache stampede
  Cache entry expires.
  1000 requests arrive.
  All see cache miss.
  All query the database.
  Database melts.

  FIX 1: notify_one() instead of notify_all()
  FIX 2: Cache locking - only ONE thread refills cache
  FIX 3: Staggered expiry (add random jitter to TTL)
```

```python
import threading
import time
import random

class CacheWithStampedePrevention:
    def __init__(self):
        self.cache = {}
        self.locks = {}
        self.global_lock = threading.Lock()

    def get(self, key, fetch_fn, ttl=60):
        entry = self.cache.get(key)
        if entry and entry["expires"] > time.time():
            return entry["value"]

        with self.global_lock:
            if key not in self.locks:
                self.locks[key] = threading.Lock()
            key_lock = self.locks[key]

        if key_lock.acquire(blocking=False):
            try:
                entry = self.cache.get(key)
                if entry and entry["expires"] > time.time():
                    return entry["value"]
                value = fetch_fn(key)
                jitter = random.uniform(0, ttl * 0.1)
                self.cache[key] = {
                    "value": value,
                    "expires": time.time() + ttl + jitter,
                }
                return value
            finally:
                key_lock.release()
        else:
            time.sleep(0.01)
            entry = self.cache.get(key)
            if entry:
                return entry["value"]
            return fetch_fn(key)
```

---

## Bug 6: Starvation

A thread never gets to run because other threads keep
taking the resource.

```
  UNFAIR LOCK:
  Thread A and B keep alternating lock acquisition.
  Thread C never gets a chance.

  Time: --->
  A: [lock][....][lock][....][lock][....]
  B: [....][lock][....][lock][....][lock]
  C: [wait][wait][wait][wait][wait][wait] STARVING!

  CAUSES:
  - Unfair lock implementations (no FIFO)
  - Priority scheduling without aging
  - Spinlocks favoring the thread that just released

  FIX: fair locks (FIFO ordering)
  FIX: aging (boost priority of waiting threads over time)
```

---

## Bug 7: ABA Problem

```
  LOCK-FREE ALGORITHM USING COMPARE-AND-SWAP (CAS):

  Thread 1: read value = A
  Thread 1: (preempted)

  Thread 2: change A -> B
  Thread 2: change B -> A

  Thread 1: (resumes)
  Thread 1: CAS(expected=A, new=C) -> SUCCEEDS!
  But the world changed while Thread 1 was asleep!

  EXAMPLE: lock-free stack
  Stack: A -> B -> C

  Thread 1: pop() reads top = A, next = B
  Thread 1: (preempted)

  Thread 2: pop A, pop B, push D, push A
  Stack: A -> D

  Thread 1: CAS(top, expected=A, new=B) -> SUCCEEDS
  Stack: B -> ???  (B was freed! Use-after-free!)

  FIX: tagged pointers (add a version counter)
  CAS on (pointer, version) instead of just pointer.
  Even if pointer matches, version won't.
```

---

## Bug 8: Memory Ordering Issues

```
  CPU AND COMPILER REORDER INSTRUCTIONS FOR PERFORMANCE.

  Thread 1:                Thread 2:
  x = 42                   while (!ready) {}
  ready = true             print(x)

  YOU EXPECT: x is always 42 when printed.

  REALITY (without memory barriers):
  Compiler or CPU might reorder Thread 1:
  ready = true   (moved before x = 42!)
  x = 42

  Thread 2 sees ready=true but x is still 0!

  FIX: memory barriers / atomic operations
  - C++: std::atomic with proper memory_order
  - Rust: Atomic types with Ordering (SeqCst, Release, Acquire)
  - Java: volatile keyword
  - Go: sync/atomic package
```

---

## Detection Quick Reference

```
  +---------------------+------------------------+-------------------+
  | Bug                 | Detection              | Prevention        |
  +---------------------+------------------------+-------------------+
  | Race condition      | ThreadSanitizer (TSan) | Locks, atomics    |
  |                     | Helgrind (Valgrind)    |                   |
  +---------------------+------------------------+-------------------+
  | Deadlock            | Lock-order checking    | Lock ordering     |
  |                     | Wait-for graph         | Timeout on locks  |
  +---------------------+------------------------+-------------------+
  | Livelock            | Progress monitoring    | Random backoff    |
  +---------------------+------------------------+-------------------+
  | Priority inversion  | Priority tracking      | Priority inherit. |
  +---------------------+------------------------+-------------------+
  | Thundering herd     | Monitoring CPU spikes  | notify_one(),     |
  |                     | on wake events         | lock on refill    |
  +---------------------+------------------------+-------------------+
  | Starvation          | Thread wait-time stats | Fair locks, aging |
  +---------------------+------------------------+-------------------+
  | ABA problem         | AddressSanitizer       | Tagged pointers   |
  +---------------------+------------------------+-------------------+
  | Memory ordering     | TSan, stress testing   | Proper atomics    |
  +---------------------+------------------------+-------------------+
```

---

## Exercises

### Exercise 1: Create and Fix a Race Condition

Write a program where 4 threads each append 1000 items
to a shared list. Observe the lost items. Fix it with
a lock, then fix it with a lock-free approach (atomic
operations or thread-local lists with merge).

### Exercise 2: Deadlock Detection

Write a program that creates a deadlock between 3 threads
(each holding one lock and waiting for the next in a cycle).
Add timeout-based detection that identifies the deadlock
within 5 seconds and breaks it.

### Exercise 3: Cache Stampede Simulation

Simulate a cache stampede:
1. 100 threads all request the same cache key
2. Cache expires
3. All 100 threads hit the database
4. Implement the "single flight" pattern (only one thread
   refills, others wait for the result)
5. Measure: database calls (should be 1, not 100)

### Exercise 4: Memory Ordering Bug

Write a producer-consumer using a simple flag variable
(no synchronization). Show that on x86 it "works" (strong
model) but explain why it would fail on ARM (weak model).
Fix it with proper atomic operations.

---

## Key Takeaways

```
  1. Race conditions: unsynchronized shared mutable state
  2. Deadlocks: circular lock dependencies (prevent with ordering)
  3. Livelocks: threads active but making no progress
  4. Priority inversion: low-priority lock holder blocks high
  5. Thundering herd: mass wakeup, only one can proceed
  6. Starvation: thread never gets to run (fix with fair locks)
  7. ABA problem: value changes and changes back (tagged ptrs)
  8. Memory ordering: CPUs reorder reads/writes (use atomics)
  9. ThreadSanitizer catches most of these at development time
  10. The hardest bugs are intermittent — test under load
```

---

Next: [Lesson 15 — Testing Concurrent Code](./15-testing-concurrent-code.md)
