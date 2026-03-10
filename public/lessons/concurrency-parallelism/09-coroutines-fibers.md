# 09 - Coroutines & Fibers

## The Analogy

Think of reading multiple books simultaneously.

**Stackful coroutine (fiber)**: You have a physical bookmark in each book.
You can stop reading mid-paragraph, put the book down with the bookmark,
pick up another book, and resume exactly where you left off. Each book
keeps its own "reading state" (the bookmark = the stack).

**Stackless coroutine**: You write down your position on a sticky note
before switching books. The book itself doesn't hold your place -- you
recreate your reading state from the note. Lighter, but you can only
pause at chapter boundaries (yield points).

```
  STACKFUL (Fiber)                  STACKLESS (async/await)
  ================                  =======================

  [own stack]                       [state machine on heap]
  can yield from ANY                can only yield at explicit
  point in the call chain           await/yield points

  fn A() {                          async fn A() {
    B()                               B().await   <-- yield point
  }                                 }
  fn B() {                          async fn B() {
    C()                               C().await   <-- yield point
  }                                 }
  fn C() {                          async fn C() {
    yield  <-- deep in stack          yield       <-- yield point
  }                                 }

  A->B->C->yield: stack preserved   A->B->C: compiler transforms
  Resume at C, unwind naturally      into a state machine
```

## Stackful Coroutines (Fibers)

Each coroutine has its own stack. When it yields, the entire stack is
saved. When it resumes, the stack is restored.

```
  FIBER CONTEXT SWITCH
  ====================

  Fiber A running:              Fiber B suspended:
  +------------------+         +------------------+
  | frame: main()    |         | frame: main()    |
  | frame: process() |         | frame: handle()  |
  | frame: read_io() |         | frame: parse()   |  <-- saved SP
  | --> yield here    |         +------------------+
  +------------------+

  yield() saves A's stack pointer, restores B's stack pointer

  After switch:
  Fiber A suspended:            Fiber B running:
  +------------------+         +------------------+
  | frame: main()    |         | frame: main()    |
  | frame: process() |         | frame: handle()  |
  | frame: read_io() |  saved  | frame: parse()   |
  +------------------+         | --> resumes here  |
                               +------------------+
```

### Go: Goroutines Are Stackful

Go's goroutines are stackful coroutines with a twist: **growable stacks**.

```
  Goroutine Stack Growth
  ======================

  Initial: 2KB              Need more: 8KB           Shrunk: 4KB
  +--------+                +--------+               +--------+
  |  used  |                |  used  |               |  used  |
  |  1KB   |                |  5KB   |               |  2KB   |
  +--------+                |        |               +--------+
  | unused |                +--------+               | unused |
  |  1KB   |                | unused |               |  2KB   |
  +--------+                |  3KB   |               +--------+
                            +--------+

  Go copies the entire stack to a larger allocation when needed.
  This is why goroutines can start at 2KB but handle deep recursion.
```

### Python: Generators as Coroutines

Python's generators are a limited form of coroutine:

```python
def counter(start=0):
    n = start
    while True:
        received = yield n
        if received is not None:
            n = received
        else:
            n += 1

gen = counter(10)
print(next(gen))
print(next(gen))
print(gen.send(100))
print(next(gen))
```

`yield` suspends execution and returns a value. `send()` resumes with
a value. But generators can only yield from the *top-level* function --
they can't yield from a nested call (without `yield from`).

### Python: yield from (Delegation)

```python
def inner():
    yield 1
    yield 2
    return "inner_result"

def outer():
    result = yield from inner()
    yield result

gen = outer()
print(next(gen))
print(next(gen))
print(next(gen))
```

`yield from` delegates to another generator, forwarding yields and
sends. This was the bridge to `async/await` in Python 3.5+.

## Stackless Coroutines (State Machines)

The compiler transforms async functions into state machines. No
separate stack needed -- just a struct on the heap.

```
  SOURCE CODE:                    COMPILED STATE MACHINE:

  async fn example() {            enum ExampleState {
    let a = fetch().await;            Start,
    let b = process(a).await;         AfterFetch { a: Data },
    save(b).await;                    AfterProcess { b: Result },
  }                                   Done,
                                  }

                                  impl Future for Example {
                                    fn poll(&mut self) -> Poll<()> {
                                      match self.state {
                                        Start => {
                                          self.future = fetch();
                                          // poll inner future...
                                        }
                                        AfterFetch { a } => {
                                          self.future = process(a);
                                          // poll inner future...
                                        }
                                        // ...
                                      }
                                    }
                                  }
```

### Rust: Async Is Stackless

```rust
async fn process_request(url: &str) -> Result<String, Box<dyn std::error::Error>> {
    let response = reqwest::get(url).await?;
    let body = response.text().await?;
    let parsed = serde_json::from_str::<serde_json::Value>(&body)?;
    Ok(parsed.to_string())
}
```

The compiler turns this into a state machine with states:
1. Before first await (fetching)
2. After fetch, before second await (reading body)
3. After body read (parsing)
4. Done

Each state captures only the variables alive at that point. This is
why Rust futures have zero overhead from heap-allocated stacks.

## Comparison: Stackful vs Stackless

```
  +-------------------+-----------------+-------------------+
  |                   | Stackful        | Stackless         |
  |                   | (Fibers)        | (Async/Await)     |
  +-------------------+-----------------+-------------------+
  | Memory per task   | 2KB-1MB stack   | Bytes-few KB      |
  | Yield from nested | Yes (anywhere)  | Only at await     |
  | Implementation    | Stack swapping  | State machine     |
  | Compilation       | No transform    | Complex transform |
  | Debugging         | Normal stacks   | Fragmented traces |
  | Function coloring | No              | Yes (async split) |
  | Max tasks         | ~100K-1M        | ~1M-10M           |
  | Examples          | Go, Lua, Ruby   | Rust, Python,     |
  |                   | Java (Loom)     | JavaScript, C#    |
  +-------------------+-----------------+-------------------+
```

## Java Virtual Threads (Project Loom)

Java is adding stackful virtual threads, similar to goroutines:

```
  BEFORE LOOM                       WITH LOOM

  Thread.new(() -> {                Thread.startVirtualThread(() -> {
    var data = fetch(url);            var data = fetch(url);
    process(data);                    process(data);
  });                               });

  Platform thread: ~1MB stack       Virtual thread: ~1KB initial
  Max: ~10K threads                 Max: millions
  Blocking = wasting OS thread      Blocking = runtime unmounts
```

The key insight: existing blocking Java code (JDBC, HTTP clients)
works unchanged with virtual threads. No async/await coloring needed.

## Fibers in Practice

### Implementing a Simple Fiber (Conceptual)

```
  Fiber structure:
  +------------------+
  | stack_pointer    |  --> points into allocated stack
  | stack_bottom     |  --> base of allocated stack
  | stack_size       |  --> typically 64KB-1MB
  | state            |  --> RUNNING / SUSPENDED / DONE
  | entry_function   |  --> what to run
  +------------------+

  Context switch (assembly level):
  1. Push callee-saved registers onto current stack
  2. Save current stack pointer to current fiber
  3. Load stack pointer from target fiber
  4. Pop callee-saved registers from target stack
  5. Return (now on target fiber's stack, at its last yield point)
```

### Rust: Manual Fiber-Like Behavior

```rust
use std::pin::Pin;
use std::future::Future;
use std::task::{Context, Poll, Wake, Waker};
use std::sync::Arc;

struct NoopWaker;

impl Wake for NoopWaker {
    fn wake(self: Arc<Self>) {}
}

fn block_on<F: Future>(mut future: F) -> F::Output {
    let waker = Waker::from(Arc::new(NoopWaker));
    let mut cx = Context::from_waker(&waker);
    let mut future = unsafe { Pin::new_unchecked(&mut future) };

    loop {
        match future.as_mut().poll(&mut cx) {
            Poll::Ready(val) => return val,
            Poll::Pending => std::thread::yield_now(),
        }
    }
}

fn main() {
    let result = block_on(async {
        42
    });
    println!("{}", result);
}
```

## The Yield Depth Problem

Stackless coroutines can only yield at explicit points:

```
  STACKFUL: yield anywhere          STACKLESS: yield only at top

  fn process() {                    async fn process() {
    for item in list {                for item in list {
      transform(item)                   transform(item).await
    }                                 }
  }                                 }
  fn transform(item) {              async fn transform(item) {
    validate(item)                    validate(item).await
  }                                 }
  fn validate(item) {               async fn validate(item) {
    yield <-- works fine!             yield <-- requires ALL callers
  }                                            to be async
  }                                 }

  Stackful: transparent yielding    Stackless: viral async annotation
```

This is why Go code is simpler -- goroutines yield transparently.
In Rust/Python, you must annotate the entire call chain as async.

## When to Use What

```
  Use STACKFUL (goroutines/fibers) when:
  - You want transparent blocking (no function coloring)
  - Migrating existing sync code
  - Deep call stacks that yield
  - Simplicity > raw performance

  Use STACKLESS (async/await) when:
  - Maximum task density (millions of tasks)
  - Minimum memory overhead matters
  - You need fine-grained cancellation
  - Compile-time guarantees about yield points
```

## Exercises

1. **Explore**: Write a Python generator that implements cooperative
   multitasking: 3 generators that yield to each other in round-robin.

2. **Measure**: Compare memory usage of 100,000 goroutines vs 100,000
   Rust async tasks vs 100,000 Python coroutines.

3. **Think**: Why can't you call an async function from a sync function
   in Rust without a runtime? What fundamental limitation causes this?

4. **Research**: Look up Java's Project Loom virtual threads. How do
   they solve the "colored function" problem that Rust and Python have?

---

**Next** -> [10 - Parallel Algorithms](10-parallel-algorithms.md)
