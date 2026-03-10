# 04 - Lock-Free Programming

## The Analogy

Imagine a whiteboard in an office where anyone can update the project status.

**With a lock**: Everyone takes turns. You grab the marker, erase the old
status, write the new one, put the marker down. Others wait.

**Lock-free (CAS)**: You read the current status, prepare your update on a
sticky note, then try to swap it onto the board -- but only if nobody changed
it while you were writing. If someone did, you read again and retry.

```
  LOCK-BASED                    LOCK-FREE (CAS)

  Thread A: [lock] [write] [unlock]   Thread A: [read] [prepare] [CAS!]
  Thread B: [wait........] [lock]     Thread B: [read] [prepare] [CAS-fail]
            [write] [unlock]                    [read] [prepare] [CAS!]
  Thread C: [wait.................     Thread C: [read] [prepare] [CAS!]
            ........] [lock] [write]
                                      No waiting! Just retry on conflict.
```

## Why Lock-Free?

Locks have problems:
1. **Priority inversion**: Low-priority thread holds lock, high-priority blocks
2. **Convoying**: One slow thread holds lock, everyone queues behind it
3. **Deadlock potential**: Multiple locks + wrong ordering = frozen system
4. **OS scheduling**: Thread holding lock gets preempted, everyone waits

Lock-free algorithms guarantee that *some* thread always makes progress,
even if others are suspended or slow.

## Atomic Operations

The building blocks of lock-free programming. An atomic operation completes
in a single step from the perspective of other threads -- no partial states.

```
  NON-ATOMIC increment            ATOMIC increment
  (counter = counter + 1)         (atomic_fetch_add)

  Thread A      Thread B          Thread A       Thread B
  --------      --------          --------       --------
  read: 5       read: 5           fetch_add: 5
  add:  6       add:  6             result: 6
  write: 6      write: 6                         fetch_add: 6
                                                   result: 7
  Final: 6 (WRONG!)               Final: 7 (CORRECT!)
```

### Rust: Atomics

```rust
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let counter = Arc::new(AtomicI64::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            for _ in 0..1000 {
                counter.fetch_add(1, Ordering::Relaxed);
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("{}", counter.load(Ordering::Relaxed));
}
```

### Go: sync/atomic

```go
func main() {
    var counter int64
    var wg sync.WaitGroup

    for i := 0; i < 10; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for j := 0; j < 1000; j++ {
                atomic.AddInt64(&counter, 1)
            }
        }()
    }

    wg.Wait()
    fmt.Println(counter)
}
```

### Python: No True Atomics

```python
import threading

counter = 0

def increment():
    global counter
    for _ in range(100_000):
        counter += 1

threads = [threading.Thread(target=increment) for _ in range(10)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(counter)
```

Python has no atomic primitives. `counter += 1` is NOT atomic even with
the GIL (it's multiple bytecodes). Use `threading.Lock` or
`multiprocessing.Value` with a lock.

## Compare-And-Swap (CAS)

The fundamental lock-free operation. Atomically: "If the value is still
what I expect, replace it with my new value. Otherwise, fail."

```
  CAS(address, expected, new_value) -> bool

  Memory: [42]

  CAS(&mem, 42, 99)  -->  Memory: [99], returns true   (it was 42)
  CAS(&mem, 42, 100) -->  Memory: [99], returns false   (it's now 99)
```

### Lock-Free Stack (Push)

```
  push(new_node):
    loop:
      old_head = stack.head         // 1. read current head
      new_node.next = old_head      // 2. point new node to it
      if CAS(&stack.head,           // 3. try to swap
             old_head,
             new_node):
        return                      // success!
                                    // else: someone changed head, retry
```

```
  Initial:   head -> [A] -> [B] -> nil

  Thread 1 wants to push [X]:
    reads head = &A
    X.next = &A
    CAS(head, &A, &X)  -- SUCCESS
    Result: head -> [X] -> [A] -> [B] -> nil

  Thread 2 (concurrent) wants to push [Y]:
    reads head = &A  (stale!)
    Y.next = &A
    CAS(head, &A, &Y)  -- FAILS (head is now &X)
    RETRY:
    reads head = &X
    Y.next = &X
    CAS(head, &X, &Y)  -- SUCCESS
    Result: head -> [Y] -> [X] -> [A] -> [B] -> nil
```

### Rust: CAS with AtomicPtr

```rust
use std::sync::atomic::{AtomicPtr, Ordering};
use std::ptr;

struct Node<T> {
    data: T,
    next: *mut Node<T>,
}

struct LockFreeStack<T> {
    head: AtomicPtr<Node<T>>,
}

impl<T> LockFreeStack<T> {
    fn new() -> Self {
        LockFreeStack {
            head: AtomicPtr::new(ptr::null_mut()),
        }
    }

    fn push(&self, data: T) {
        let new_node = Box::into_raw(Box::new(Node {
            data,
            next: ptr::null_mut(),
        }));

        loop {
            let old_head = self.head.load(Ordering::Acquire);
            unsafe { (*new_node).next = old_head; }

            if self.head
                .compare_exchange_weak(
                    old_head,
                    new_node,
                    Ordering::Release,
                    Ordering::Relaxed,
                )
                .is_ok()
            {
                break;
            }
        }
    }
}
```

## The ABA Problem

CAS checks "is the value the same?" but not "has it been unchanged?"

```
  The ABA Problem
  ===============

  Stack: head -> [A] -> [B] -> [C]

  Thread 1:                          Thread 2:
  ---------                          ---------
  read head = &A
  (gets preempted)
                                     pop() -> A
                                     pop() -> B
                                     push(A)  (reuses node A!)
                                     Stack: head -> [A] -> [C]
  CAS(head, &A, &B) -- SUCCESS!
  (because head == &A again)
  Stack: head -> [B] -> ???
                   ^
                   B was already freed! USE AFTER FREE!

  Thread 1 saw "A" both times, but the stack changed underneath.
```

**Solutions:**

```
  1. TAGGED POINTERS          2. HAZARD POINTERS       3. EPOCH-BASED
     (version counter)           (announce reads)          RECLAMATION

  +--------+--------+        Thread announces:        Global epoch counter
  | pointer|  tag   |        "I'm looking at &A"      Objects freed only
  +--------+--------+        So &A can't be freed      when no thread is
  CAS checks BOTH             until thread is done     in a prior epoch
  Tag increments each op
```

### Go: Avoiding ABA

Go's garbage collector eliminates most ABA concerns because freed nodes
aren't reused at the same address. This is one advantage of GC'd languages
for lock-free programming.

```go
type node struct {
    value int
    next  unsafe.Pointer
}

type LockFreeStack struct {
    head unsafe.Pointer
}

func (s *LockFreeStack) Push(value int) {
    newNode := unsafe.Pointer(&node{value: value})
    for {
        oldHead := atomic.LoadPointer(&s.head)
        (*node)(newNode).next = oldHead
        if atomic.CompareAndSwapPointer(&s.head, oldHead, newNode) {
            return
        }
    }
}
```

## Lock-Free vs Wait-Free vs Obstruction-Free

```
  Progress Guarantees (strongest to weakest)
  ==========================================

  WAIT-FREE:    Every thread completes in bounded steps
                (even if others are frozen)
                Example: atomic increment

  LOCK-FREE:    At least one thread makes progress
                (individual threads may starve but system progresses)
                Example: CAS retry loop

  OBSTRUCTION-  A thread makes progress if run in isolation
  FREE:         (may livelock if threads interfere)
                Example: simple retry without backoff

  LOCK-BASED:   No progress guarantee if lock holder is preempted
```

## When to Use Lock-Free

```
  USE LOCK-FREE when:              USE LOCKS when:
  =====================            ================
  - Hot path, extreme perf need    - Correctness > performance
  - Simple data structure          - Complex invariants
  - Signal handler safety needed   - Multiple variables to update
  - Real-time latency bounds       - Team needs to maintain it
  - Avoiding priority inversion    - Contention is low
```

Lock-free code is **much harder** to write correctly. Most applications
should use mutexes and only reach for lock-free when profiling proves
it's needed.

## Exercises

1. **Implement**: Write a lock-free counter using CAS in your language.
   Verify it's correct with 10 threads each incrementing 100,000 times.

2. **Think**: Why does `compare_exchange_weak` exist in Rust alongside
   `compare_exchange`? When would you prefer the weak version?

3. **Analyze**: Draw the ABA problem for a lock-free queue (not stack).
   How would you solve it?

4. **Research**: Look up the Michael-Scott lock-free queue. Draw the
   enqueue and dequeue operations step by step.

---

**Next** -> [05 - Memory Ordering](05-memory-ordering.md)
