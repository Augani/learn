# 03 - Shared Memory

## The Analogy

A shared bathroom in an office.

**Mutex** (mutual exclusion): A lock on the door. One person at a time.
Everyone else waits in line.

**Semaphore**: A bathroom with 3 stalls and 3 keys on a hook. Take a key
to enter, hang it back when done. Up to 3 people at once.

**Read-Write Lock**: A library. Many people can read books at the same time.
But when the librarian restocks (writes), everyone must leave first.

```
  MUTEX                 SEMAPHORE (3)         READ-WRITE LOCK
  =====                 =============         ===============

  [LOCKED]              Keys: [K][K][ ]       Readers: [R][R][R]
  Person A inside       2 of 3 inside           3 readers OK
  B,C,D waiting         D waiting               Writer must wait

  [LOCKED]              Keys: [ ][ ][ ]       Writer: [W]
  Person B inside       3 of 3 inside           All readers blocked
  C,D waiting           nobody waits            No other writers
```

## Mutexes

The most basic synchronization primitive. Lock before accessing shared
data, unlock when done.

### Go: sync.Mutex

```go
type SafeCounter struct {
    mu sync.Mutex
    v  map[string]int
}

func (c *SafeCounter) Inc(key string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.v[key]++
}

func (c *SafeCounter) Value(key string) int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.v[key]
}
```

### Rust: Mutex<T>

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0i64));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            let mut val = counter.lock().unwrap();
            *val += 1;
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("{}", *counter.lock().unwrap());
}
```

Rust's `Mutex<T>` *wraps* the data it protects. You literally cannot
access the data without locking first. The compiler enforces this.
See: **Rust Track** on interior mutability.

### Python: threading.Lock

```python
import threading

class SafeCounter:
    def __init__(self):
        self._lock = threading.Lock()
        self._counts = {}

    def inc(self, key):
        with self._lock:
            self._counts[key] = self._counts.get(key, 0) + 1

    def value(self, key):
        with self._lock:
            return self._counts.get(key, 0)
```

## The Mutex Lifecycle

```
  Thread A              Mutex             Thread B
  --------              -----             --------
  lock() ------------> LOCKED
  [working...]                            lock() -----> BLOCKED
  [working...]                            [waiting...]
  unlock() ----------> UNLOCKED --------> ACQUIRED
                                          [working...]
                                          unlock() ---> UNLOCKED
```

**Critical section**: the code between lock and unlock. Keep it SHORT.
Long critical sections = high contention = threads stuck waiting.

## Semaphores

A generalization of mutexes. A mutex is a semaphore with count = 1.

```
  Semaphore(3)

  Thread 1: acquire() --> count: 2 --> enters
  Thread 2: acquire() --> count: 1 --> enters
  Thread 3: acquire() --> count: 0 --> enters
  Thread 4: acquire() --> count: 0 --> BLOCKS
  Thread 1: release() --> count: 1 --> Thread 4 unblocks
```

### Python: Semaphore for Rate Limiting

```python
import asyncio

async def fetch_with_limit(sem, url):
    async with sem:
        print(f"Fetching {url}")
        await asyncio.sleep(0.1)
        return f"Result from {url}"

async def main():
    sem = asyncio.Semaphore(5)
    urls = [f"https://api.example.com/{i}" for i in range(20)]
    tasks = [fetch_with_limit(sem, url) for url in urls]
    results = await asyncio.gather(*tasks)
    print(f"Fetched {len(results)} URLs, 5 at a time")

asyncio.run(main())
```

### Go: Weighted Semaphore

```go
func main() {
    sem := make(chan struct{}, 5)
    var wg sync.WaitGroup

    for i := 0; i < 20; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            sem <- struct{}{}
            defer func() { <-sem }()
            fmt.Printf("Worker %d running\n", id)
            time.Sleep(100 * time.Millisecond)
        }(i)
    }

    wg.Wait()
}
```

Go doesn't have a built-in semaphore type, but a buffered channel
works perfectly. The channel capacity is the semaphore count.

## Read-Write Locks

When reads vastly outnumber writes, a mutex is wasteful. Readers don't
conflict with each other -- only writers need exclusive access.

```
  RWLock State Machine
  ====================

  +----------+    read_lock()     +-------------+
  |          | -----------------> |             |
  |  IDLE    |                    |  READING(n) | <--+
  |          | <---------+        |             | ---+  more readers OK
  +----------+   last    |        +-------------+
       |        read_unlock()          |
       |                               | write_lock() --> BLOCKS
       |                               |                  until n=0
       | write_lock()                  v
       |                         +-------------+
       +-----------------------> |             |
                                 |  WRITING    |  all lock() calls block
                                 |             |
                                 +-------------+
                                       |
                                 write_unlock()
                                       |
                                       v
                                    IDLE
```

### Rust: RwLock

```rust
use std::sync::{Arc, RwLock};
use std::thread;

fn main() {
    let config = Arc::new(RwLock::new(vec![1, 2, 3]));
    let mut handles = vec![];

    for i in 0..5 {
        let config = Arc::clone(&config);
        handles.push(thread::spawn(move || {
            let data = config.read().unwrap();
            println!("Reader {}: {:?}", i, *data);
        }));
    }

    {
        let config = Arc::clone(&config);
        handles.push(thread::spawn(move || {
            let mut data = config.write().unwrap();
            data.push(4);
            println!("Writer: added 4");
        }));
    }

    for h in handles {
        h.join().unwrap();
    }
}
```

### Go: sync.RWMutex

```go
type Config struct {
    mu   sync.RWMutex
    data map[string]string
}

func (c *Config) Get(key string) string {
    c.mu.RLock()
    defer c.mu.RUnlock()
    return c.data[key]
}

func (c *Config) Set(key, value string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.data[key] = value
}
```

## Condition Variables

"Wake me up when something changes." A thread can wait for a condition
and be notified when another thread makes it true.

```
  Producer-Consumer with Condition Variable
  ==========================================

  Producer                Condition         Consumer
  --------                ---------         --------
                          queue empty
  lock()                                    lock()
  push(item)                                while empty:
  signal() -------------------------------->  wait() (releases lock,sleeps)
  unlock()                                  (wakes up, reacquires lock)
                                            pop(item)
                                            unlock()
```

### Python: Condition Variable

```python
import threading
import queue
import time

buffer = queue.Queue(maxsize=5)
condition = threading.Condition()

def producer():
    for i in range(20):
        with condition:
            while buffer.full():
                condition.wait()
            buffer.put(i)
            condition.notify()
        time.sleep(0.05)

def consumer(name):
    while True:
        with condition:
            while buffer.empty():
                condition.wait()
            item = buffer.get()
            condition.notify()
        print(f"{name} consumed {item}")

threads = [
    threading.Thread(target=producer),
    threading.Thread(target=consumer, args=("C1",), daemon=True),
    threading.Thread(target=consumer, args=("C2",), daemon=True),
]
for t in threads:
    t.start()
threads[0].join()
```

## Common Pitfalls

```
  PITFALL 1: Forgetting to unlock          PITFALL 2: Lock ordering

  lock(A)                                  Thread 1:     Thread 2:
  if error:                                lock(A)       lock(B)
      return    <-- A stays locked!        lock(B)       lock(A)
  unlock(A)                                  ^             ^
                                             |             |
  FIX: use defer/with/RAII                   +-- DEADLOCK--+

  PITFALL 3: Holding locks too long

  lock()
  result = expensive_computation()    <-- other threads starve
  db_write(result)                    <-- even longer
  unlock()

  FIX: compute outside the lock, only lock for the shared state update
```

## Performance Hierarchy

```
  Fastest                                         Slowest
  |                                                    |
  v                                                    v
  Atomic ops  >  SpinLock  >  Mutex  >  RWLock  >  Semaphore
  (no lock)     (busy wait)  (sleep)    (more      (generalized)
                                        state)

  BUT: "fastest" doesn't mean "best". Spinlocks waste CPU.
  Choose based on contention level and critical section length.
```

## Exercises

1. **Implement**: Write a thread-safe bounded buffer (producer-consumer)
   using a mutex and condition variable in your language of choice.

2. **Benchmark**: Compare mutex vs RWLock performance with 90% reads /
   10% writes vs 50% reads / 50% writes. When does RWLock win?

3. **Debug**: This code has a bug. Find it:
   ```
   lock(A); lock(B); process(); unlock(A); unlock(B);
   ```
   (Hint: what happens if process() panics between the unlocks?)

4. **Design**: You have a cache that 100 threads read from and 1 thread
   updates every 5 seconds. Which synchronization primitive fits best?

---

**Next** -> [04 - Lock-Free Programming](04-lock-free-programming.md)
