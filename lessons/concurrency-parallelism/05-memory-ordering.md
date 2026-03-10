# 05 - Memory Ordering

## The Analogy

Imagine you're writing a letter and your friend is reading over your shoulder.

You write: "The meeting is at 3pm" then "The room is 405."

But your friend might *see* them in the opposite order. Not because you
wrote them wrong, but because the postal system (CPU, cache, compiler)
rearranged deliveries for efficiency.

Memory ordering rules tell the postal system: "These two letters MUST
arrive in this exact order."

## Why Do CPUs Reorder?

Modern CPUs don't execute instructions in program order. They use:

```
  YOUR CODE                      WHAT THE CPU ACTUALLY DOES
  =========                      ==========================

  x = 42;                        store x=42 -> store buffer (not yet in RAM)
  ready = true;                  store ready=true -> store buffer
                                 (may flush ready before x!)

  WHY? The store buffer lets the CPU continue working while
  waiting for the cache/memory bus. Flushing order may differ
  from program order.

  +--------+     +--------+     +--------+     +--------+
  |  Core  | --> | Store  | --> | Cache  | --> | Memory |
  |        |     | Buffer |     | (L1)   |     | (RAM)  |
  +--------+     +--------+     +--------+     +--------+
                  ^
                  Writes sit here temporarily.
                  Other cores can't see them yet.
                  Flush order != program order.
```

This is fine for single-threaded code (the CPU preserves the *illusion*
of order). But for multi-threaded code, other threads observe the
real order of memory writes -- which may be different.

## The Classic Broken Pattern

```
  Thread A:                    Thread B:
  ---------                    ---------
  data = 42;                   while (!ready) { }
  ready = true;                print(data);

  EXPECTED: prints 42
  POSSIBLE: prints 0 (or garbage)

  WHY: CPU may reorder ready=true before data=42
       Thread B sees ready=true, reads data before it's written
```

## Memory Ordering Levels

From strongest (slowest) to weakest (fastest):

```
  SEQUENTIAL CONSISTENCY (SeqCst)
  |  All threads see all operations in the same total order
  |  Like a global timeline everyone agrees on
  |
  ACQUIRE / RELEASE
  |  Acquire: nothing moves BEFORE this read
  |  Release: nothing moves AFTER this write
  |  Paired: write-Release ... read-Acquire creates a "happens-before"
  |
  RELAXED
  |  No ordering guarantees at all
  |  Only guarantees atomicity (no torn reads/writes)
  |
  v
  (fastest, least guarantees)
```

## Sequential Consistency

The simplest model. All threads agree on one global order of all
atomic operations. As if there's one shared timeline.

```
  Sequential Consistency
  ======================

  Thread A: W(x,1)  W(y,1)
  Thread B:                 R(y)=1  R(x)=?

  With SeqCst: if B sees y=1, it MUST see x=1
  There's a total order everyone agrees on.

  Possible total orders:
    W(x,1) -> W(y,1) -> R(y)=1 -> R(x)=1   OK
    W(x,1) -> R(y)=0 ...                     OK (didn't see y yet)
    W(y,1) -> R(y)=1 -> R(x)=0              IMPOSSIBLE with SeqCst
```

### Rust: SeqCst

```rust
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(AtomicI32::new(0));
    let ready = Arc::new(AtomicBool::new(false));

    let data_w = Arc::clone(&data);
    let ready_w = Arc::clone(&ready);
    let writer = thread::spawn(move || {
        data_w.store(42, Ordering::SeqCst);
        ready_w.store(true, Ordering::SeqCst);
    });

    let data_r = Arc::clone(&data);
    let ready_r = Arc::clone(&ready);
    let reader = thread::spawn(move || {
        while !ready_r.load(Ordering::SeqCst) {}
        assert_eq!(data_r.load(Ordering::SeqCst), 42);
    });

    writer.join().unwrap();
    reader.join().unwrap();
}
```

SeqCst is the **default** in most languages and the safest choice.
Use it unless you have a proven performance reason not to.

## Acquire / Release

More efficient than SeqCst. Creates a "happens-before" relationship
between a Release store and an Acquire load of the same variable.

```
  Acquire/Release Semantics
  =========================

  Thread A (writer):           Thread B (reader):
  ------------------           ------------------
  data = 42;                   while !ready.load(Acquire) { }
  ready.store(true, Release);  print(data);
       ^                            ^
       |                            |
       Release: everything          Acquire: everything
       BEFORE this store            AFTER this load
       is visible to...             sees everything before
       ...anyone who Acquires       the paired Release

  GUARANTEE: if B reads ready==true (via Acquire),
             then B sees data==42 (written before Release)
```

### Rust: Acquire/Release

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(std::sync::atomic::AtomicI32::new(0));
    let ready = Arc::new(AtomicBool::new(false));

    let d = Arc::clone(&data);
    let r = Arc::clone(&ready);
    let writer = thread::spawn(move || {
        d.store(42, Ordering::Relaxed);
        r.store(true, Ordering::Release);
    });

    let d = Arc::clone(&data);
    let r = Arc::clone(&ready);
    let reader = thread::spawn(move || {
        while !r.load(Ordering::Acquire) {
            std::hint::spin_loop();
        }
        assert_eq!(d.load(Ordering::Relaxed), 42);
    });

    writer.join().unwrap();
    reader.join().unwrap();
}
```

Notice: `data` uses `Relaxed` but is still safe because the
Acquire/Release on `ready` creates the happens-before edge.

## Relaxed Ordering

No ordering guarantees. Only guarantees the operation itself is atomic.

```
  RELAXED: good for...
  =====================

  1. Standalone counters (order doesn't matter)
     counter.fetch_add(1, Relaxed)

  2. Statistics / metrics
     total_requests.fetch_add(1, Relaxed)

  3. Flags that don't guard other data
     (but be very careful here)
```

### Go: Limited Ordering Control

```go
var data int64
var ready int32

func writer() {
    atomic.StoreInt64(&data, 42)
    atomic.StoreInt32(&ready, 1)
}

func reader() {
    for atomic.LoadInt32(&ready) == 0 {
        runtime.Gosched()
    }
    fmt.Println(atomic.LoadInt64(&data))
}
```

Go's `sync/atomic` provides sequential consistency for all operations.
You can't choose weaker orderings. This is simpler but leaves
performance on the table in extreme cases.

### Python: No Ordering Control

Python doesn't expose memory ordering at all. The GIL and the
`threading` module handle synchronization at a higher level.

## CPU Architectures and Ordering

Different CPUs have different default ordering:

```
  ARCHITECTURE        DEFAULT MODEL          REORDERING
  ============        =============          ==========
  x86/x86_64         Total Store Order      Store-Load only
                     (TSO)                   (strongest common CPU)

  ARM                 Weakly ordered         All reorderings possible
                                             (need explicit barriers)

  RISC-V              Weakly ordered         All reorderings possible
                     (RVWMO)

  x86 is "accidentally" safe for many patterns.
  Code that works on x86 may break on ARM.
  This is why testing only on x86 is dangerous.
```

```
  x86 TSO: only reorders Store -> Load (not Store -> Store)

  Thread A:               Thread B:
  store x = 1             store y = 1
  load r1 = y             load r2 = x

  On x86: r1=0, r2=0 is POSSIBLE (store-load reorder)
  On SeqCst: r1=0, r2=0 is IMPOSSIBLE

  This is the only reordering x86 does, and it's enough to cause bugs.
```

## Memory Barriers (Fences)

Explicit instructions that prevent reordering across them.

```
  WITHOUT FENCE              WITH FENCE

  store A                    store A
  store B  <-- may pass A    FENCE (StoreStore)
  load C                     store B  <-- cannot pass fence
                             FENCE (StoreLoad)
                             load C   <-- cannot pass fence
```

### Rust: Fences

```rust
use std::sync::atomic::{fence, Ordering};

fn publish_data(data: &AtomicI32, flag: &AtomicBool) {
    data.store(42, Ordering::Relaxed);
    fence(Ordering::Release);
    flag.store(true, Ordering::Relaxed);
}

fn read_data(data: &AtomicI32, flag: &AtomicBool) -> i32 {
    while !flag.load(Ordering::Relaxed) {
        std::hint::spin_loop();
    }
    fence(Ordering::Acquire);
    data.load(Ordering::Relaxed)
}
```

Fences are a blunter tool than per-operation orderings. They affect
ALL atomic operations around them, not just one.

## The Decision Tree

```
  Need to share data between threads atomically?
  |
  +--YES--> Does the order relative to other variables matter?
  |         |
  |         +--NO---> Use Relaxed (counters, stats)
  |         |
  |         +--YES--> Is it a publish/consume pattern?
  |                   |
  |                   +--YES--> Use Release (writer) / Acquire (reader)
  |                   |
  |                   +--NO---> Need all threads to agree on total order?
  |                             |
  |                             +--YES--> Use SeqCst
  |                             +--NO---> Use Acquire/Release
  |
  +--NO---> Use a Mutex (it handles ordering for you)
```

## Exercises

1. **Identify**: Which memory ordering would you use for a simple
   hit counter on a web server? Why?

2. **Analyze**: On ARM, the following code is broken. On x86, it
   (usually) works. Explain why:
   ```
   Thread A: store data=42; store ready=true;
   Thread B: while(!ready); read data;
   ```

3. **Fix**: Rewrite the above using proper Acquire/Release ordering
   in Rust or Go.

4. **Research**: What is the "out of thin air" problem in the C++
   memory model? Why did the committee struggle with Relaxed ordering?

---

**Next** -> [06 - CSP Model](06-csp-model.md)
