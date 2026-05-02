# Common Concurrency Bugs & Detection Reference

Quick lookup for identifying, detecting, and fixing concurrency bugs.

---

## Bug Identification

```
+---------------------+----------------------------+---------------------------+
| Bug                 | Symptoms                   | Root Cause                |
+---------------------+----------------------------+---------------------------+
| Race Condition      | Intermittent wrong values, | Two threads access shared |
|                     | lost updates, data         | data without sync, at     |
|                     | corruption                 | least one writes          |
+---------------------+----------------------------+---------------------------+
| Deadlock            | Program hangs forever,     | Circular lock dependency  |
|                     | threads all blocked,       | (A holds L1, wants L2;   |
|                     | CPU usage drops to 0%      | B holds L2, wants L1)    |
+---------------------+----------------------------+---------------------------+
| Livelock            | Program runs but makes no  | Threads keep reacting to  |
|                     | progress, CPU at 100%,     | each other, retrying same |
|                     | no useful output           | failed operation          |
+---------------------+----------------------------+---------------------------+
| Starvation          | Some threads/requests      | Unfair scheduling, high-  |
|                     | never complete, uneven     | priority threads dominate |
|                     | response times             |                           |
+---------------------+----------------------------+---------------------------+
| Priority Inversion  | High-priority task delayed | Low-priority thread holds |
|                     | unexpectedly, system meets | lock needed by high-prior |
|                     | deadlines intermittently   | thread; medium preempts   |
+---------------------+----------------------------+---------------------------+
| Thundering Herd     | CPU spikes when condition  | All waiting threads wake  |
|                     | changes, then drops;       | up but only one can       |
|                     | unnecessary load           | proceed                   |
+---------------------+----------------------------+---------------------------+
| ABA Problem         | Corrupted lock-free data   | CAS succeeds because      |
|                     | structure, use-after-free  | value changed back to     |
|                     | in concurrent context      | original between reads    |
+---------------------+----------------------------+---------------------------+
| Memory Ordering     | Reads see stale values,    | CPU/compiler reorders     |
|                     | flags appear set before    | memory operations without |
|                     | data is ready              | proper barriers           |
+---------------------+----------------------------+---------------------------+
| Goroutine/Task Leak | Memory grows unbounded,    | Goroutine/task blocked    |
|                     | increasing goroutine count | forever on channel/lock   |
|                     |                            | that is never signaled    |
+---------------------+----------------------------+---------------------------+
| Double-Checked      | Partially constructed      | Object published before   |
| Locking             | objects visible to other   | fully initialized (mem    |
|                     | threads                    | ordering issue)           |
+---------------------+----------------------------+---------------------------+
```

---

## Detection Tools

```
+------------------------+------------+-----------------------------------+
| Tool                   | Languages  | Detects                           |
+------------------------+------------+-----------------------------------+
| ThreadSanitizer (TSan) | C/C++,     | Data races, lock order violations |
|                        | Go, Rust   |                                   |
+------------------------+------------+-----------------------------------+
| Helgrind (Valgrind)    | C/C++      | Data races, lock misuse,          |
|                        |            | deadlocks                         |
+------------------------+------------+-----------------------------------+
| Go Race Detector       | Go         | Data races                        |
| (go test -race)        |            |                                   |
+------------------------+------------+-----------------------------------+
| AddressSanitizer       | C/C++      | Use-after-free (from ABA),        |
| (ASan)                 |            | buffer overflow                   |
+------------------------+------------+-----------------------------------+
| Miri                   | Rust       | Undefined behavior, data races    |
|                        |            | in unsafe code                    |
+------------------------+------------+-----------------------------------+
| jcmd / jstack          | Java       | Thread dumps, deadlock detection  |
+------------------------+------------+-----------------------------------+
| pprof                  | Go         | Goroutine leaks, blocking profile |
+------------------------+------------+-----------------------------------+
| TLA+                   | Any (spec) | Model checking all interleavings  |
+------------------------+------------+-----------------------------------+
| Loom (Tokio)           | Rust       | Permutation testing for async     |
+------------------------+------------+-----------------------------------+
```

---

## Fix Patterns

```
+---------------------+----------------------------------------------+
| Bug                 | Fixes                                        |
+---------------------+----------------------------------------------+
| Race Condition      | 1. Mutex / RwLock around shared state        |
|                     | 2. Atomic operations for simple values       |
|                     | 3. Message passing (eliminate sharing)        |
|                     | 4. Immutable data structures                 |
+---------------------+----------------------------------------------+
| Deadlock            | 1. Global lock ordering (always acquire in   |
|                     |    same order)                               |
|                     | 2. Lock timeout (try_lock with timeout)      |
|                     | 3. Single coarse lock (trade performance)    |
|                     | 4. Lock-free algorithms                      |
+---------------------+----------------------------------------------+
| Livelock            | 1. Random backoff before retry               |
|                     | 2. Priority/ordering to break symmetry       |
|                     | 3. Limit retry count                         |
+---------------------+----------------------------------------------+
| Starvation          | 1. Fair locks (FIFO ordering)                |
|                     | 2. Priority aging (boost waiting threads)    |
|                     | 3. Work stealing for load balance            |
+---------------------+----------------------------------------------+
| Priority Inversion  | 1. Priority inheritance protocol             |
|                     | 2. Priority ceiling protocol                 |
|                     | 3. Lock-free algorithms                      |
+---------------------+----------------------------------------------+
| Thundering Herd     | 1. notify_one() vs notify_all()              |
|                     | 2. Single-flight pattern (one refiller)      |
|                     | 3. Staggered wakeup / jitter                |
+---------------------+----------------------------------------------+
| ABA Problem         | 1. Tagged/versioned pointers                 |
|                     | 2. Hazard pointers                           |
|                     | 3. Epoch-based reclamation                   |
+---------------------+----------------------------------------------+
| Memory Ordering     | 1. Atomic with proper ordering               |
|                     |    (Acquire/Release or SeqCst)               |
|                     | 2. Memory fences / barriers                  |
|                     | 3. volatile (Java), Atomic (Rust)            |
+---------------------+----------------------------------------------+
| Goroutine Leak      | 1. Context cancellation                      |
|                     | 2. Done channels                             |
|                     | 3. Timeout on blocking operations            |
+---------------------+----------------------------------------------+
```

---

## Deadlock Prevention Checklist

```
  [ ] All locks acquired in consistent global order
  [ ] No lock held while calling external code/callbacks
  [ ] try_lock with timeout used where ordering is hard
  [ ] No nested lock acquisition where possible
  [ ] Lock scope is minimal (hold for shortest time)
  [ ] No lock held across I/O operations
  [ ] Lock hierarchy documented and enforced
```

---

## Race Condition Code Patterns

```
  PATTERN: CHECK-THEN-ACT (Time-of-Check-Time-of-Use, TOCTOU)

  BAD:
  if (map.contains(key)) {     // check
      value = map.get(key);    // act (key might be removed!)
  }

  GOOD:
  lock.acquire();
  if (map.contains(key)) {
      value = map.get(key);
  }
  lock.release();

  BETTER (in languages with concurrent maps):
  value = concurrent_map.get_or_default(key, null);

  ---

  PATTERN: READ-MODIFY-WRITE

  BAD:
  counter = counter + 1;       // not atomic!

  GOOD:
  atomic_counter.fetch_add(1); // single atomic operation

  ---

  PATTERN: LAZY INITIALIZATION

  BAD:
  if (instance == null) {
      instance = new Singleton();  // two threads might both create
  }

  GOOD:
  std::call_once(flag, []{ instance = new Singleton(); });
  // Or: use language-level sync (sync.Once in Go, lazy_static in Rust)
```
