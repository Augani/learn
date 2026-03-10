# Lesson 15: Testing Concurrent Code

> Concurrent bugs hide. They only show up under specific
> timing conditions. You need tools that flush them out.

---

## Why Testing Concurrency Is Hard

```
  REGULAR BUG:
  Input X always produces wrong output Y.
  Test: assert f(X) != Y. Done.

  CONCURRENCY BUG:
  Input X produces correct output 999,999 times.
  On the 1,000,000th run, threads interleave differently.
  Wrong output. Can't reproduce.

  NON-DETERMINISM SOURCES:
  +-------------------------------+
  | Thread scheduling decisions   |
  | CPU cache state               |
  | Number of cores active        |
  | System load                   |
  | Memory allocation addresses   |
  | Network timing                |
  | OS interrupts                 |
  +-------------------------------+
  All of these change between runs.
```

---

## Tool 1: Thread Sanitizer (TSan)

Compile-time instrumentation that detects data races
at runtime.

```
  HOW IT WORKS:
  1. Compiler instruments every memory access
  2. Runtime tracks which thread accessed which address
  3. If two threads access same address without
     synchronization and at least one is a write:
     REPORT DATA RACE

  C/C++:  gcc -fsanitize=thread -g program.c
  Rust:   cargo +nightly build -- -Z sanitizer=thread
  Go:     go test -race ./...

  EXAMPLE OUTPUT:
  WARNING: ThreadSanitizer: data race
    Write of size 4 at 0x7f3c by thread T1:
      #0 increment counter.c:12
    Previous read of size 4 at 0x7f3c by thread T2:
      #0 increment counter.c:12

  COST:
  - 5-15x slowdown
  - 5-10x memory overhead
  - Use in CI, not production
```

```c
// compile: gcc -fsanitize=thread -g -o race race.c -lpthread
#include <pthread.h>
#include <stdio.h>

int counter = 0;

void* increment(void* arg) {
    for (int i = 0; i < 100000; i++) {
        counter++;
    }
    return NULL;
}

int main() {
    pthread_t t1, t2;
    pthread_create(&t1, NULL, increment, NULL);
    pthread_create(&t2, NULL, increment, NULL);
    pthread_join(t1, NULL);
    pthread_join(t2, NULL);
    printf("Counter: %d\n", counter);
    return 0;
}
```

---

## Tool 2: Go Race Detector

```go
// run: go test -race ./...

package counter

import (
	"sync"
	"testing"
)

type Counter struct {
	mu    sync.Mutex
	value int
}

func (c *Counter) Increment() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.value++
}

func (c *Counter) Value() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.value
}

func TestCounterRace(t *testing.T) {
	c := &Counter{}
	var wg sync.WaitGroup

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 1000; j++ {
				c.Increment()
			}
		}()
	}

	wg.Wait()

	if c.Value() != 100000 {
		t.Errorf("Expected 100000, got %d", c.Value())
	}
}
```

---

## Tool 3: Property-Based Testing

Instead of specific test cases, define properties that
must ALWAYS hold, then generate random inputs.

```python
from hypothesis import given, settings
from hypothesis.strategies import integers, lists
import threading

class ThreadSafeQueue:
    def __init__(self):
        self.items = []
        self.lock = threading.Lock()

    def enqueue(self, item):
        with self.lock:
            self.items.append(item)

    def dequeue(self):
        with self.lock:
            if not self.items:
                return None
            return self.items.pop(0)

    def size(self):
        with self.lock:
            return len(self.items)

@given(items=lists(integers(), min_size=1, max_size=100))
@settings(max_examples=200)
def test_queue_preserves_all_items(items):
    queue = ThreadSafeQueue()
    results = []
    errors = []

    def producer():
        for item in items:
            queue.enqueue(item)

    def consumer(expected_count):
        collected = 0
        attempts = 0
        while collected < expected_count and attempts < expected_count * 10:
            val = queue.dequeue()
            if val is not None:
                results.append(val)
                collected += 1
            attempts += 1

    prod = threading.Thread(target=producer)
    cons = threading.Thread(target=consumer, args=(len(items),))

    prod.start()
    cons.start()
    prod.join()
    cons.join()

    while queue.size() > 0:
        results.append(queue.dequeue())

    assert sorted(results) == sorted(items), \
        f"Items lost or duplicated: expected {sorted(items)}, got {sorted(results)}"

test_queue_preserves_all_items()
print("Property test passed")
```

---

## Tool 4: Stress Testing

Run operations in a tight loop with many threads to
increase the chance of exposing timing bugs.

```python
import threading
import time
from typing import List

def stress_test(
    operation,
    num_threads: int = 16,
    iterations_per_thread: int = 100_000,
    duration_seconds: float = 5.0,
):
    errors: List[Exception] = []
    stop_event = threading.Event()

    def worker():
        count = 0
        while not stop_event.is_set() and count < iterations_per_thread:
            try:
                operation()
                count += 1
            except Exception as e:
                errors.append(e)
                return

    threads = [threading.Thread(target=worker) for _ in range(num_threads)]
    start = time.time()

    for t in threads:
        t.start()

    time.sleep(duration_seconds)
    stop_event.set()

    for t in threads:
        t.join(timeout=10)

    elapsed = time.time() - start
    alive = sum(1 for t in threads if t.is_alive())

    print(f"Duration: {elapsed:.2f}s")
    print(f"Errors: {len(errors)}")
    print(f"Stuck threads: {alive}")

    if errors:
        print(f"First error: {errors[0]}")
    if alive > 0:
        print("WARNING: possible deadlock!")

    return len(errors) == 0 and alive == 0


counter = 0
lock = threading.Lock()

def safe_increment():
    global counter
    with lock:
        counter += 1

stress_test(safe_increment, num_threads=8, duration_seconds=2.0)
print(f"Final counter: {counter}")
```

---

## Tool 5: Deterministic Simulation

Record all nondeterminism and replay exactly.
The gold standard for testing distributed/concurrent systems.

```
  DETERMINISTIC SIMULATION:

  1. Replace all nondeterminism with controllable versions:
     - Thread scheduling -> deterministic scheduler
     - Time -> simulated clock
     - Random numbers -> seeded PRNG
     - Network -> simulated network (with faults)
     - Disk I/O -> simulated disk

  2. Run system under simulation.
  3. If bug found: re-run with same seed -> same bug!
  4. PERFECTLY REPRODUCIBLE.

  USED BY:
  +---------------------+-----------------------------------+
  | FoundationDB        | Deterministic simulation testing  |
  |                     | Found >100 bugs before release    |
  +---------------------+-----------------------------------+
  | TigerBeetle         | Deterministic simulation          |
  +---------------------+-----------------------------------+
  | Antithesis          | Platform for det. simulation      |
  +---------------------+-----------------------------------+
  | AWS (ShardStore)    | Formal methods + simulation       |
  +---------------------+-----------------------------------+

  FOUNDATIONDB'S CLAIM:
  "We have never had a bug reported that our simulation
   couldn't have found first."
```

---

## Tool 6: Model Checking

Explore ALL possible interleavings. Guarantee correctness.

```
  MODEL CHECKING (TLA+, Spin, etc.):

  Given a concurrent algorithm with N threads:
  Explore every possible scheduling of operations.

  Thread A: [op1, op2, op3]
  Thread B: [op1, op2]

  Interleavings:
  A1 A2 A3 B1 B2
  A1 A2 B1 A3 B2
  A1 A2 B1 B2 A3
  A1 B1 A2 A3 B2
  A1 B1 A2 B2 A3
  A1 B1 B2 A2 A3
  B1 A1 A2 A3 B2
  B1 A1 A2 B2 A3
  B1 A1 B2 A2 A3
  B1 B2 A1 A2 A3

  10 interleavings for just 5 operations!
  With more threads: combinatorial explosion.

  TLA+: specify your algorithm, check ALL interleavings.
  Used by Amazon (AWS) for S3, DynamoDB, EBS.
```

---

## Testing Strategy Matrix

```
  +-----------------------+------------+----------+-----------+
  | Technique             | Coverage   | Speed    | Effort    |
  +-----------------------+------------+----------+-----------+
  | Unit tests            | Low        | Fast     | Low       |
  | (single-threaded)     |            |          |           |
  +-----------------------+------------+----------+-----------+
  | Thread Sanitizer      | Medium     | Slow     | Low       |
  | (race detection)      | (sampling) | (5-15x)  | (compile) |
  +-----------------------+------------+----------+-----------+
  | Stress testing        | Medium     | Medium   | Low       |
  | (many threads, loop)  |            |          |           |
  +-----------------------+------------+----------+-----------+
  | Property testing      | Medium     | Medium   | Medium    |
  | (random inputs)       |            |          |           |
  +-----------------------+------------+----------+-----------+
  | Deterministic sim     | High       | Fast     | High      |
  | (controlled sched.)   |            | (replay) | (rewrite) |
  +-----------------------+------------+----------+-----------+
  | Model checking        | Complete   | Slow     | High      |
  | (all interleavings)   |            | (explode)| (TLA+)    |
  +-----------------------+------------+----------+-----------+

  RECOMMENDED STACK:
  1. Thread Sanitizer in CI (catches most races, minimal effort)
  2. Stress tests for critical paths (find timing bugs)
  3. Property tests for invariants (data structure correctness)
  4. Deterministic simulation for complex systems (high investment)
  5. TLA+ for critical algorithms (highest confidence)
```

---

## Practical Testing Patterns

```
  PATTERN 1: LINEARIZABILITY CHECKER
  Record all operations and their results.
  Check if there exists a sequential ordering that
  produces the same results. If not: BUG.

  PATTERN 2: INVARIANT CHECKING
  After every operation, verify invariants:
  - Balance >= 0
  - Total items in = total items out
  - No duplicates in unique set

  PATTERN 3: CHAOS TESTING
  Randomly inject:
  - Thread pauses (sleep 0-10ms)
  - Lock contention (hold locks longer)
  - Memory pressure (allocate junk)
  - CPU load (busy loops)

  PATTERN 4: SEQUENTIAL ORACLE
  Run the same operations on:
  1. Your concurrent implementation
  2. A simple single-threaded implementation
  Compare results. Any difference = BUG.
```

---

## Exercises

### Exercise 1: Add TSan to a Project

Take any concurrent program and compile with
`-fsanitize=thread`. Fix all reported races.

### Exercise 2: Property Test a Concurrent Map

Write property tests for a concurrent hash map:
1. Property: all inserted keys can be retrieved
2. Property: deleted keys return None
3. Property: concurrent inserts of unique keys never lose data
4. Run with 8 threads, 10000 operations, 100 trials

### Exercise 3: Build a Linearizability Checker

Given a log of concurrent operations:
```
Thread 1: put(k=1, v=A) started=0 ended=5
Thread 2: get(k=1) -> A  started=3 ended=7
Thread 3: put(k=1, v=B) started=4 ended=9
Thread 4: get(k=1) -> B  started=6 ended=10
```
Write a checker that verifies there exists a valid
sequential ordering consistent with the timestamps.

### Exercise 4: Stress Test with Chaos

Write a stress test for a thread-safe LRU cache:
1. 8 threads doing random get/put operations
2. Randomly pause threads for 0-5ms
3. Verify: no crashes, no data corruption, capacity respected
4. Run for 60 seconds

---

## Key Takeaways

```
  1. Concurrency bugs are nondeterministic — hard to reproduce
  2. ThreadSanitizer: lowest effort, catches most data races
  3. Go race detector: go test -race (always use in CI)
  4. Property testing: define invariants, generate random inputs
  5. Stress testing: many threads + tight loops + duration
  6. Deterministic simulation: gold standard, highest effort
  7. Model checking (TLA+): mathematically proves correctness
  8. Use sequential oracle to verify concurrent implementation
  9. Linearizability checker validates operation ordering
  10. Layer techniques: TSan + stress tests + property tests
```

---

Next: [Lesson 16 — Choosing the Right Model](./16-choosing-the-right-model.md)
