# Lesson 9: Garbage Collection vs Manual Memory Management

## The Restaurant Cleanup Problem

Every restaurant has the same problem: dirty dishes pile up. How do you handle them?
This seemingly mundane question is one of the deepest trade-offs in all of computer
science. There are three fundamentally different strategies.

**Strategy 1 — Manual cleanup (C/C++):**
Every customer buses their own table. You eat, you clean up, you leave. It works
perfectly when everyone is responsible. But one forgetful customer and dirty dishes
accumulate. One overzealous customer throws away someone else's plate while they are
still eating. The restaurant descends into chaos.

**Strategy 2 — Garbage collector (Go, Java, Python, JavaScript):**
Hire a cleaning crew that periodically sweeps through the restaurant, collecting
abandoned dishes. Customers never think about cleanup — they eat and leave. But every
so often, the crew yells "EVERYONE FREEZE!" and cleans. During that pause, nobody eats.

**Strategy 3 — Ownership system (Rust):**
Every dish belongs to exactly one person. When that person leaves, their dishes are
automatically cleared. No cleaning crew needed. No freezes. But the host at the door
enforces strict rules about who can touch which dish, and sometimes refuses to seat you
until you sort out who owns what.

```
 STRATEGY         ANALOGY                WHO CLEANS UP?      COST
 ──────────────────────────────────────────────────────────────────────────
 Manual (C)       Bus your own table     You, the developer  Bugs if you forget
 GC (Go/Java)     Cleaning crew sweeps   Runtime system      Periodic pauses
 Ownership (Rust) Dishes tied to owner   Compiler enforces   Developer complexity
```

Each strategy has won in different domains. Understanding why requires understanding how
each actually works.

---

## Manual Memory Management (C/C++)

In C, you are the cleanup crew. You call `malloc()` to allocate memory and `free()` to
release it. There is no safety net.

```c
#include <stdlib.h>
#include <string.h>

void example() {
    // Allocate 100 bytes on the heap
    char *buffer = malloc(100);
    strcpy(buffer, "Hello, world!");

    // ... use buffer ...

    free(buffer);  // YOU must remember to do this

    // Danger zone: buffer is freed, but the pointer still exists
    // printf("%s", buffer);  // USE-AFTER-FREE: undefined behavior!
}
```

What can go wrong:

**Memory leak** — you forget to `free()`. The dish sits on the table forever. Over hours
or days, the restaurant fills with dirty dishes. Your program's memory usage grows
until the OS kills it.

**Use-after-free** — you `free()` the memory, then use the pointer again. You threw away
someone's plate while they were still eating. The data might be there, might be
overwritten, might crash. This is one of the most exploited security vulnerabilities
in history.

**Double free** — you call `free()` twice on the same pointer. You try to bus a table
that was already cleaned. The memory allocator's internal bookkeeping gets corrupted.
Anything can happen.

**Buffer overflow** — you write past the end of allocated memory. You pile dishes on the
table next to yours. This corrupts neighboring data and is the foundation of most
security exploits in C programs.

Despite these dangers, manual management gives you absolute control. For operating
systems, embedded firmware, and latency-critical code, that control matters.

---

## Mark-and-Sweep Garbage Collection

The most intuitive GC algorithm. It mirrors how you would actually clean a restaurant.

**Step 1 — Mark:** Start from the entrance (root references: global variables, stack
variables). Walk through the restaurant. Every table that has a path from the entrance
is "reachable" — someone is sitting there or someone knows someone sitting there. Mark
these tables as "in use."

**Step 2 — Sweep:** Walk through every table. Any table NOT marked? The dishes are
garbage. Clear them.

```
 MARK AND SWEEP
 ==============

 Roots (stack, globals)
      |
      v
   +-----+       +-----+       +-----+
   |  A  | ----> |  B  | ----> |  C  |     Reachable from roots
   +-----+       +-----+       +-----+     (MARKED - keep these)
                                    |
                                    v
                                +-----+
                                |  D  |     Reachable through C
                                +-----+     (MARKED - keep this)


   +-----+       +-----+
   |  E  | ----> |  F  |               Not reachable from any root
   +-----+       +-----+               (UNMARKED - these are garbage!)
                                        Swept and freed.


 After sweep:

   A -> B -> C -> D     (alive)
   E, F                 (freed)
```

In code, imagine the object graph:

```python
class Node:
    def __init__(self, value):
        self.value = value
        self.children = []

# These are reachable from local variables (roots)
root = Node("A")
b = Node("B")
c = Node("C")
d = Node("D")

root.children.append(b)
b.children.append(c)
c.children.append(d)

# These are created but nobody references them
orphan_e = Node("E")
orphan_f = Node("F")
orphan_e.children.append(orphan_f)

# Now remove our local references to the orphans
orphan_e = None
orphan_f = None

# At this point, E and F are unreachable. The GC will eventually find and free them.
# A, B, C, D remain because they're reachable from `root`.
```

### The Cost of Mark-and-Sweep

The GC must traverse every live object during the mark phase and scan all memory during
the sweep phase. This takes time proportional to the total amount of live data.

During a naive mark-and-sweep, the entire program **stops**. Every thread pauses. No
requests are served. No frames are rendered. This is the infamous **stop-the-world** pause.

For a web server handling 10,000 requests per second, a 100ms GC pause means 1,000
requests experience unexpected latency. For a video game running at 60fps, a 50ms pause
means 3 dropped frames — a visible stutter.

---

## Reference Counting

An alternative approach: instead of periodic sweeps, track object lifetimes in real time.

Every object has a counter: "how many things point to me?" When you create a new
reference, increment the counter. When a reference goes away, decrement it. When the
counter hits zero, the object is garbage — free it immediately.

```
 REFERENCE COUNTING
 ==================

 a = Object()        Object refcount: 1
 b = a               Object refcount: 2  (b also points to it)
 a = None            Object refcount: 1  (a no longer points to it)
 b = None            Object refcount: 0  → FREED IMMEDIATELY
```

This is how **Python** primarily manages memory (with a cycle collector as backup) and
how **Swift** manages it (Automatic Reference Counting / ARC).

Advantage: no stop-the-world pauses. Objects are freed the instant they become unused.
Memory usage stays tight.

Disadvantage: **circular references**.

### The Circular Reference Problem

```
 CIRCULAR REFERENCE
 ==================

   +-------+          +-------+
   |   A   |  ------> |   B   |
   | ref=1 |  <------ | ref=1 |
   +-------+          +-------+

 A points to B (B's refcount = 1)
 B points to A (A's refcount = 1)

 Nobody else points to A or B.
 They are GARBAGE — unreachable from any root.
 But their refcounts will NEVER reach 0.
 They point to each other forever.
```

```python
class Node:
    def __init__(self, name):
        self.name = name
        self.partner = None

# Create a cycle
a = Node("A")
b = Node("B")
a.partner = b    # A -> B
b.partner = a    # B -> A

# Remove our references
a = None
b = None

# A and B still exist in memory!
# A.refcount = 1 (B points to it)
# B.refcount = 1 (A points to it)
# Neither will ever reach 0.
# This is a MEMORY LEAK in a pure reference-counting system.
```

Python solves this with a secondary **cycle detector** that periodically searches for
reference cycles and breaks them. Swift avoids it by requiring you to declare `weak`
references — references that don't increment the counter.

---

## Generational Garbage Collection

A crucial empirical observation: **most objects die young.**

Think about a web server processing a request. It creates objects for the request,
the parsed JSON, temporary strings, intermediate computations — and then the response
is sent and all those objects are garbage. They lived for milliseconds.

Meanwhile, the database connection pool, the configuration object, and the routing table
live for the entire lifetime of the program.

```
 OBJECT LIFETIME DISTRIBUTION
 ============================

 Number of
 objects
   |
   |  *
   |  **
   |  ****
   |  *******
   |  ***********
   |  ******************
   |  *********************************
   +-----------------------------------------> Lifetime
   Short                                Long

   Most objects die very young. A few live forever.
   This is called the "generational hypothesis."
```

**Generational GC** exploits this pattern. It divides the heap into generations:

```
 GENERATIONAL HEAP LAYOUT
 ========================

 +----------------+------------------+------------------+
 |    NURSERY     |    SURVIVOR      |   OLD GENERATION |
 |  (Generation 0)|  (Generation 1)  |   (Generation 2) |
 +----------------+------------------+------------------+
 |                |                  |                   |
 | New objects    | Survived 1+      | Survived many     |
 | land here     | nursery GCs      | collections       |
 |                |                  |                   |
 | Collected     | Collected less   | Collected rarely  |
 | VERY often    | often            |                   |
 +----------------+------------------+------------------+
   Small, fast       Medium             Large, slow
   to scan           to scan            to scan
```

The analogy: a hospital. You check on newborn babies every hour. You check on adults
in stable condition every few hours. You check on long-term residents once a day.
It would be absurd to give every patient the same check-in frequency.

**How it works:**
1. New objects go into the nursery (small, fixed-size area).
2. When the nursery fills up, do a minor GC — scan only the nursery. Most objects are dead.
3. Survivors get promoted to the survivor space.
4. If objects survive multiple minor GCs, they get promoted to the old generation.
5. Major GC (scan everything) happens rarely, only when the old generation fills up.

Since the nursery is small, minor GCs are fast — often under 1ms. Major GCs are slow,
but they happen infrequently because most long-lived objects truly do live a long time.

This is how **Java (G1, ZGC)**, **C# (.NET GC)**, and **Go** work, with various refinements.

---

## Stop-the-World Pauses

The cleaning crew locks the restaurant for 30 seconds. Nobody can eat. For a
casual diner, no big deal. For a fast-food chain during lunch rush, catastrophic.

**Impact by application type:**

| Application        | Tolerable pause | Consequence of long pause       |
|--------------------|-----------------|----------------------------------|
| Batch processing   | Seconds         | None (nobody is waiting)         |
| Web server         | ~10ms           | Request latency spike            |
| Online game        | ~16ms (1 frame) | Visible stutter                  |
| Trading system     | ~1ms            | Missed trades, lost money        |
| Self-driving car   | ~0ms            | You die                          |

Different GC implementations optimize for different points on this spectrum.

---

## Go's Garbage Collector

Go's GC is designed for one thing above all else: **low pause times.** The target is
sub-millisecond pauses, and they consistently achieve it.

How? The GC runs **concurrently** with your program. Instead of stopping the world,
the cleaning crew works alongside the diners. They use a clever algorithm called
**tri-color marking**:

```
 TRI-COLOR MARKING
 =================

 Objects are colored:
   WHITE  = not yet visited (potentially garbage)
   GRAY   = visited but children not yet scanned
   BLACK  = visited and all children scanned (definitely alive)

 Start: all objects WHITE, roots are GRAY

 Step 1:          Step 2:          Step 3:          Step 4:
 Pick a GRAY      Scan its         Color it BLACK.  Repeat until
 object.          children.        Color children   no GRAY remains.
                  Mark them GRAY.  GRAY.

 +-----+          +-----+          +-----+
 | A   | GRAY     | A   | BLACK    | A   | BLACK
 |  \  |          |  \  |          |  \  |
 |   v |          |   v |          |   v |
 | B   | WHITE    | B   | GRAY     | B   | BLACK
 +-----+          +-----+          +-----+

 When done: WHITE objects = garbage. Sweep them.
```

The key insight: the GC threads and the application threads run simultaneously. A small
stop-the-world pause (under 1ms) happens only at the start and end of a GC cycle for
bookkeeping. The heavy work of marking and sweeping happens concurrently.

Trade-off: Go's GC uses more CPU (the cleaning crew takes effort) and more memory (you
need headroom for the GC to run). But pause times stay tiny.

---

## Rust's Approach — No GC At All

Rust takes a radically different approach: **ownership with deterministic destruction.**

Every value has exactly one owner. When the owner goes out of scope, the value is
immediately freed. No GC. No runtime overhead. No pauses.

```rust
fn main() {
    {
        let s = String::from("hello"); // `s` owns the String
        // use s...
    } // `s` goes out of scope here. Memory is freed IMMEDIATELY.
      // No GC needed. The compiler inserts `drop(s)` at this exact point.
}
```

For shared ownership, Rust uses reference counting (`Rc<T>` for single-threaded,
`Arc<T>` for multi-threaded), but the compiler enforces strict rules to prevent misuse:

```rust
use std::rc::Rc;

fn main() {
    let a = Rc::new(vec![1, 2, 3]); // Reference count = 1
    let b = Rc::clone(&a);           // Reference count = 2

    println!("a: {:?}", a);
    println!("b: {:?}", b);

    drop(b);                          // Reference count = 1
    drop(a);                          // Reference count = 0 → freed
}
```

The famous **borrow checker** enforces these rules:
- A value can have either ONE mutable reference OR any number of immutable references.
- References cannot outlive the data they point to.
- No null pointers. No dangling pointers. No use-after-free.

```rust
fn main() {
    let mut data = vec![1, 2, 3];

    let r1 = &data;     // Immutable borrow — OK
    let r2 = &data;     // Another immutable borrow — OK
    // let r3 = &mut data; // COMPILE ERROR: can't borrow mutably
    //                      // while immutable borrows exist

    println!("{:?} {:?}", r1, r2);
    // r1 and r2 are no longer used after this point

    let r3 = &mut data; // NOW it's OK — no other borrows alive
    r3.push(4);
    println!("{:?}", r3);
}
```

The trade-off: the borrow checker can reject valid programs. Sometimes you know something
is safe, but the compiler cannot prove it. This leads to wrestling with the compiler,
refactoring code to satisfy its rules, or reaching for `unsafe` blocks.

---

## Comparison Table

```
 ┌───────────────┬────────────────┬────────────────┬────────────────┬──────────────────┐
 │               │ Manual (C/C++) │ Ref Counting   │ Tracing GC     │ Ownership (Rust) │
 │               │                │ (Python/Swift) │ (Go/Java/.NET) │                  │
 ├───────────────┼────────────────┼────────────────┼────────────────┼──────────────────┤
 │ Latency       │ None (no GC)   │ Tiny per-op    │ Pause spikes   │ None (no GC)     │
 │ impact        │                │ overhead       │ (Go: <1ms)     │                  │
 ├───────────────┼────────────────┼────────────────┼────────────────┼──────────────────┤
 │ Throughput    │ Best (no       │ Moderate       │ Good (but GC   │ Near-best (no    │
 │               │ overhead)      │ (counter ops)  │ uses CPU)      │ runtime cost)    │
 ├───────────────┼────────────────┼────────────────┼────────────────┼──────────────────┤
 │ Memory        │ Minimal        │ Per-object     │ 2-3x needed    │ Minimal          │
 │ overhead      │                │ counter        │ for GC headroom│                  │
 ├───────────────┼────────────────┼────────────────┼────────────────┼──────────────────┤
 │ Developer     │ Very high      │ Low (mostly    │ Very low       │ High (borrow     │
 │ effort        │ (manual mgmt)  │ automatic)     │ (automatic)    │ checker)         │
 ├───────────────┼────────────────┼────────────────┼────────────────┼──────────────────┤
 │ Safety        │ Dangerous      │ Safe (except   │ Safe           │ Very safe        │
 │               │ (UB, crashes)  │ cycles)        │                │ (compile-time)   │
 ├───────────────┼────────────────┼────────────────┼────────────────┼──────────────────┤
 │ Handles       │ N/A            │ NO (needs      │ YES            │ N/A (use weak    │
 │ cycles?       │                │ cycle detector)│                │ refs if needed)  │
 ├───────────────┼────────────────┼────────────────┼────────────────┼──────────────────┤
 │ Predictable   │ YES            │ YES            │ NO (GC timing  │ YES              │
 │ timing?       │                │                │ varies)        │                  │
 └───────────────┴────────────────┴────────────────┴────────────────┴──────────────────┘
```

---

## When to Pick Which

### GC languages (Go, Java, Python, JavaScript) — for rapid development

When correctness of memory management should not be your problem. When you want to
focus on business logic, ship features fast, and let the runtime handle cleanup.

- Web services and APIs (Go, Java)
- Scripts and data analysis (Python)
- UI applications (JavaScript, C#)
- Anything where developer productivity matters more than microsecond latency

### Ownership (Rust) — for performance-critical code

When you need the performance of manual management with the safety of garbage collection.
When you cannot afford GC pauses.

- Game engines and real-time systems
- Operating system components
- Database engines
- Network infrastructure (proxies, load balancers)
- Embedded systems with constrained memory
- WebAssembly modules

### Manual management (C/C++) — for maximum control

When you need to control every byte, every allocation, every deallocation. When the
overhead of even Rust's abstractions is too much.

- Operating system kernels
- Device drivers
- Real-time embedded systems (pacemakers, flight controllers)
- Performance-critical legacy codebases

The trend in the industry is clear: new systems code is increasingly written in Rust
rather than C/C++. Linux, Android, Windows, and Chromium all now accept Rust code.
The safety guarantees are too valuable to ignore.

---

## Practical Impact: Watching GC in Action

### Go: Observing GC pauses

```go
package main

import (
    "fmt"
    "runtime"
    "time"
)

func main() {
    // Enable GC stats
    var stats runtime.MemStats

    // Create garbage
    for i := 0; i < 1_000_000; i++ {
        _ = make([]byte, 1024) // Allocate 1KB, immediately discard
    }

    runtime.ReadMemStats(&stats)
    fmt.Printf("Total GC pauses: %d\n", stats.NumGC)
    fmt.Printf("Total pause time: %v\n", time.Duration(stats.PauseTotalNs))
    fmt.Printf("Last pause: %v\n", time.Duration(stats.PauseNs[(stats.NumGC+255)%256]))
    fmt.Printf("Heap in use: %d KB\n", stats.HeapInuse/1024)
}
```

```bash
# Run with GC tracing enabled:
GODEBUG=gctrace=1 go run main.go
# Output shows every GC cycle: pause time, heap size, CPU used
```

### Python: Observing reference counting

```python
import sys
import gc

class HeavyObject:
    def __init__(self):
        self.data = [0] * 100_000

# Reference counting in action
obj = HeavyObject()
print(f"Refcount: {sys.getrefcount(obj)}")  # 2 (obj + getrefcount's arg)

alias = obj
print(f"Refcount: {sys.getrefcount(obj)}")  # 3 (obj + alias + arg)

del alias
print(f"Refcount: {sys.getrefcount(obj)}")  # 2

# Cycle detector
a = {}
b = {}
a['ref'] = b
b['ref'] = a

del a
del b
# a and b still exist (circular reference)!

gc.collect()  # Force cycle collection
print(f"Collected {gc.get_stats()}")
```

### Rust: Deterministic destruction

```rust
struct DatabaseConnection {
    name: String,
}

impl DatabaseConnection {
    fn new(name: &str) -> Self {
        println!("  [Opening connection: {}]", name);
        DatabaseConnection { name: name.to_string() }
    }
}

impl Drop for DatabaseConnection {
    fn drop(&mut self) {
        // This runs at a KNOWN, DETERMINISTIC point — when the owner goes out of scope
        println!("  [Closing connection: {}]", self.name);
    }
}

fn main() {
    println!("1. Entering outer scope");

    {
        println!("2. Entering inner scope");
        let conn = DatabaseConnection::new("db-primary");
        println!("3. Using connection");
        // conn is dropped HERE, at the closing brace
    }

    println!("4. Back in outer scope (connection already closed!)");
}

// Output:
// 1. Entering outer scope
// 2. Entering inner scope
//   [Opening connection: db-primary]
// 3. Using connection
//   [Closing connection: db-primary]    <-- deterministic!
// 4. Back in outer scope (connection already closed!)
```

This deterministic destruction is crucial for resources beyond memory: file handles,
network connections, database transactions, GPU buffers. In GC languages, you need
`try-finally` or `defer` or `using` blocks. In Rust, it happens automatically.

---

## The RAII Pattern — Beyond Memory

Rust's ownership model generalizes beautifully. **RAII** (Resource Acquisition Is
Initialization) means: when you acquire a resource, tie it to an object's lifetime.
When the object dies, the resource is released.

```rust
use std::fs::File;
use std::io::Write;

fn write_report() -> std::io::Result<()> {
    let mut file = File::create("report.txt")?;  // File opened
    file.write_all(b"Sales data...")?;
    // file is dropped here → file is closed
    // Even if write_all fails and we return early,
    // the file is still closed. No resource leak possible.
    Ok(())
}
```

Compare with manual management where forgetting to close a file handle is a common bug:

```python
# BUG: if process() raises an exception, file is never closed
f = open("report.txt", "w")
f.write("Sales data...")
process()  # What if this throws?
f.close()  # Never reached!

# FIX: use a context manager (Python's equivalent of RAII)
with open("report.txt", "w") as f:
    f.write("Sales data...")
    process()
# f is closed here, even if process() threw an exception
```

---

## Common GC Tuning Mistakes

If you work with GC languages in production, you will eventually need to understand
GC tuning. Here are the most common mistakes:

**1. Allocating in hot loops:**
Every allocation is future GC work. In a tight loop processing millions of items,
preallocate and reuse buffers.

```go
// BAD: allocates a new slice every iteration
for i := 0; i < 1_000_000; i++ {
    data := make([]byte, 1024)
    process(data)
}

// GOOD: allocate once, reuse
data := make([]byte, 1024)
for i := 0; i < 1_000_000; i++ {
    process(data)
}
```

**2. Holding references longer than needed:**
The GC can only collect objects that are unreachable. If you stuff everything into a
global cache and never evict, the GC cannot help you.

**3. Premature GC tuning:**
Measure first. Use profiling tools (Go: `pprof`, Java: `VisualVM`, Python: `tracemalloc`)
before changing GC settings.

---

## Exercises

### Exercise 1: Observe Reference Counting

Write a Python program that:
1. Creates an object and prints its reference count using `sys.getrefcount()`.
2. Creates additional references and watches the count increase.
3. Deletes references and watches the count decrease.
4. Creates a circular reference and shows that `del` does not free the objects.
5. Calls `gc.collect()` and shows the cycle is broken.

### Exercise 2: Trigger and Measure GC Pauses

Write a Go program that:
1. Allocates millions of small objects.
2. Uses `runtime.ReadMemStats` to report GC statistics.
3. Run it with `GODEBUG=gctrace=1` and analyze the output.
4. Try setting `GOGC=50` (collect more aggressively) and `GOGC=200` (collect less).
   What happens to pause times and memory usage?

### Exercise 3: Rust Ownership Puzzle

Make this Rust code compile without using `.clone()`:

```rust
fn main() {
    let names = vec!["Alice".to_string(), "Bob".to_string(), "Charlie".to_string()];

    let greeting = create_greeting(names);
    println!("{}", greeting);

    // This line currently fails — names was moved into create_greeting
    println!("Number of names: {}", names.len());
}

fn create_greeting(names: Vec<String>) -> String {
    format!("Hello, {}!", names.join(", "))
}
```

Hint: change the function signature to borrow instead of taking ownership.

### Exercise 4: Implement a Simple Mark-and-Sweep

In Python (where irony is free), implement a toy mark-and-sweep collector:

```python
class Object:
    def __init__(self, name):
        self.name = name
        self.references = []  # Pointers to other Objects
        self.marked = False

class SimpleGC:
    def __init__(self):
        self.heap = []   # All allocated objects
        self.roots = []  # Root references (like stack variables)

    def allocate(self, name):
        obj = Object(name)
        self.heap.append(obj)
        return obj

    def mark(self):
        # TODO: Starting from roots, mark all reachable objects
        pass

    def sweep(self):
        # TODO: Remove all unmarked objects from the heap
        pass

    def collect(self):
        self.mark()
        self.sweep()
```

Implement `mark()` (recursive or iterative traversal from roots) and `sweep()` (remove
unmarked objects). Test with a graph that has some reachable and some unreachable objects.

### Exercise 5: RAII in Rust

Write a Rust struct `Timer` that:
1. Records the current time when created.
2. Prints the elapsed time when dropped.
3. Use it to automatically measure function execution time.

```rust
use std::time::Instant;

struct Timer {
    label: String,
    start: Instant,
}

// Implement `new` and `Drop` for Timer

fn main() {
    {
        let _t = Timer::new("heavy computation");
        // do some work...
        let sum: u64 = (0..10_000_000).sum();
        println!("Sum: {}", sum);
    } // Timer prints elapsed time here automatically
}
```

---

## Key Takeaways

1. **Memory management is the fundamental systems programming trade-off.** Safety vs performance vs developer effort — pick two.
2. **Manual management (C) gives maximum control** but is error-prone. Use-after-free, double-free, and buffer overflows are the basis of most security vulnerabilities.
3. **Mark-and-sweep walks the object graph** from roots, marks everything reachable, and frees everything else. Simple but requires pauses.
4. **Reference counting frees immediately at zero** but cannot handle cycles without help. Python and Swift use this as their primary strategy.
5. **Generational GC exploits a key observation:** most objects die young. Check the nursery often, check old objects rarely.
6. **Stop-the-world pauses are the GC's Achilles' heel.** Go minimizes them with concurrent collection. Java offers multiple collectors for different latency targets.
7. **Rust eliminates GC entirely** through compile-time ownership tracking. The cost is developer complexity (the borrow checker), but the reward is zero-overhead safety.
8. **RAII generalizes ownership beyond memory** to files, connections, locks — any resource that must be released. This is one of Rust's most powerful ideas.
9. **The industry is trending toward Rust** for new systems code. The safety guarantees are too valuable, and the performance overhead of GC is not always acceptable.
10. **Measure before you tune.** Most GC performance problems are caused by excessive allocation, not GC settings. Profile first, optimize second.
