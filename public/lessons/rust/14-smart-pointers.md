# Lesson 14: Smart Pointers (Box, Rc, Arc)

Smart pointers are types that act like references but carry extra powers
(like reference counting or heap allocation). You won't use these daily,
but you need to recognize them when reading Rust code.

---

## The Everyday Analogy

Smart pointers are like different ways of **sharing and owning physical items**:

- **Box** is like a **shipping box**. You put something inside, seal it up, and ship it. One person owns the box. When they're done, they throw it away (and whatever's inside). Simple, single ownership, but the thing is on the "heap shelf" instead of right in your hands.

- **Rc** is like a **library book**. Multiple people can check out the same book (read-only). The library tracks how many people have it checked out. When the last person returns it, the library can dispose of it. But you can't write in a library book — it's shared and immutable.

- **Arc** is like a **library book that can be mailed between cities**. Same concept as Rc (reference counting), but it works safely when sent across city borders (threads). The tracking mechanism is "atomic" — it uses special stamps that work even when multiple post offices process returns simultaneously.

- **Cow** is like a **shared document with "suggest changes" mode**. Everyone reads the same copy. If nobody edits, there's only one copy in memory. The moment someone wants to edit, THEY get their own private copy, and the original stays untouched for everyone else.

```
Box:     📦 One owner, thing is on the shelf (heap)
Rc:      📚 Library book, many readers, returned when last reader finishes
Arc:     📚✈️ Library book that works across cities (threads)
Cow:     📄 Shared doc — clone only if you need to edit
```

---

## Box<T> — Heap Allocation

`Box<T>` puts a value on the heap instead of the stack. Single owner, just
like a regular value.

### When you need Box

```rust
// 1. Recursive types (size unknown at compile time)
#[derive(Debug)]
enum List {
    Cons(i32, Box<List>),
    Nil,
}

fn main() {
    let list = List::Cons(1,
        Box::new(List::Cons(2,
            Box::new(List::Cons(3,
                Box::new(List::Nil))))));
    println!("{list:?}");
}
```

Without `Box`, the compiler can't calculate the size of `List` because it
contains itself. `Box` has a fixed size (just a pointer), so it works.

```rust
// 2. Large data you don't want on the stack
let big_array = Box::new([0u8; 1_000_000]);  // 1MB on heap, not stack

// 3. Trait objects (dynamic dispatch)
let animal: Box<dyn Animal> = Box::new(Dog { name: "Rex".to_string() });
```

### Using Box

```rust
fn main() {
    let boxed = Box::new(42);
    let value = *boxed;          // dereference to get the inner value
    println!("{value}");

    // Box implements Deref, so you can often use it like a regular reference
    let boxed_string = Box::new(String::from("hello"));
    println!("Length: {}", boxed_string.len());  // auto-deref
}
```

### Box Under the Hood: What Actually Happens

```
Stack                    Heap
+----------------+       +-------+
| boxed: Box<42> |------>|  42   |
| (8 bytes: ptr) |       +-------+
+----------------+

let value = *boxed;      // moves 42 back to stack, frees heap

Stack                    Heap
+----------------+       (freed)
| value: 42      |
| (4 bytes)      |
+----------------+
```

**When to reach for Box:**

The real-world pattern isn't "I want heap allocation." It's one of these three situations:
1. **Recursive types** — a type that contains itself (linked list, tree). The compiler needs a known size, and `Box` is always pointer-sized.
2. **Trait objects** — you want to store "any type that implements X" behind a pointer (`Box<dyn Error>`).
3. **Moving large data without copying** — moving a `[u8; 1_000_000]` copies 1MB. Moving a `Box<[u8; 1_000_000]>` copies 8 bytes (just the pointer).

**Go equivalent:** `new(int)` returns `*int`. But in Go you rarely think
about it because the GC handles everything.

---

## Rc<T> — Reference Counting (single-threaded)

`Rc` lets multiple owners share the same data. A counter tracks how many
owners exist. When the last owner is dropped, the data is freed.

```rust
use std::rc::Rc;

fn main() {
    let data = Rc::new(vec![1, 2, 3]);

    let a = Rc::clone(&data);  // ref count: 2
    let b = Rc::clone(&data);  // ref count: 3

    println!("Count: {}", Rc::strong_count(&data));  // 3
    println!("Data: {:?}", a);
    println!("Data: {:?}", b);

    drop(b);  // ref count: 2
    drop(a);  // ref count: 1
    // data goes out of scope: ref count 0, memory freed
}
```

**TS equivalent:** JavaScript does reference counting under the hood (plus
mark-and-sweep). `Rc` makes it explicit.

### When to use Rc

- Graph structures where nodes are shared
- Multiple parts of your program need read-only access to the same data
- Single-threaded only! (use `Arc` for multi-threaded)

### Rc is immutable by default

`Rc` only gives you shared (`&T`) references. For interior mutability,
combine with `RefCell`:

```rust
use std::cell::RefCell;
use std::rc::Rc;

fn main() {
    let shared = Rc::new(RefCell::new(vec![1, 2, 3]));

    let a = Rc::clone(&shared);
    let b = Rc::clone(&shared);

    a.borrow_mut().push(4);  // runtime borrow check
    b.borrow_mut().push(5);

    println!("{:?}", shared.borrow());  // [1, 2, 3, 4, 5]
}
```

`RefCell` moves Rust's borrow rules from compile time to runtime. It panics
if you violate the rules (two mutable borrows at once).

### The Reference Counting Lifecycle: A Visual Walkthrough

**Analogy — a coworking space with a "last one out locks up" policy:**

```
let data = Rc::new(vec![1, 2, 3]);   // Occupancy: 1
                                       // You opened the office this morning

let a = Rc::clone(&data);             // Occupancy: 2
                                       // Alice arrived

let b = Rc::clone(&data);             // Occupancy: 3
                                       // Bob arrived

drop(b);                               // Occupancy: 2
                                       // Bob went home

drop(a);                               // Occupancy: 1
                                       // Alice went home

drop(data);                            // Occupancy: 0
                                       // You're the last one out — lock up!
                                       // (memory freed)
```

**The Rc<RefCell<T>> pattern explained:**

`Rc` gives you multiple owners. `RefCell` gives you runtime-checked mutability. Together: multiple owners who can all mutate the shared data — but only one at a time, checked at runtime (not compile time).

**Analogy — a shared whiteboard with one marker:**

The whiteboard (data) is in the shared office (Rc). Anyone can read it anytime. But there's only one marker (mutable borrow). If you want to write, you grab the marker (`borrow_mut()`). If someone else already has the marker, you panic (runtime error, not compile error). When you're done writing, you put the marker back.

```
Compile-time borrowing (normal Rust):
  Compiler checks → won't compile if wrong → zero runtime cost

Runtime borrowing (RefCell):
  Compiles fine → panics at runtime if wrong → tiny runtime cost

Use RefCell when the compiler can't prove your borrows are safe
but YOU know they are. Common in graph structures and observers.
```

---

## Arc<T> — Atomic Reference Counting (multi-threaded)

`Arc` is the thread-safe version of `Rc`. Use it when sharing data across
threads.

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(vec![1, 2, 3, 4, 5]);

    let mut handles = vec![];

    for i in 0..3 {
        let data = Arc::clone(&data);
        let handle = thread::spawn(move || {
            let sum: i32 = data.iter().sum();
            println!("Thread {i}: sum = {sum}");
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }
}
```

### Arc + Mutex for shared mutable state

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut num = counter.lock().unwrap();
            *num += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Result: {}", *counter.lock().unwrap());  // 10
}
```

**Go equivalent:**
```go
var mu sync.Mutex
var counter int
var wg sync.WaitGroup

for i := 0; i < 10; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        mu.Lock()
        counter++
        mu.Unlock()
    }()
}
wg.Wait()
```

Same concept. Rust just forces you to use the Mutex — you literally cannot
access the data without locking.

### Why Rc Can't Cross Thread Boundaries

**Analogy — a paper sign-in sheet vs a digital one:**

`Rc` uses a regular counter — like a paper sign-in sheet. If two people try to write their name at the same time, they might overwrite each other (data race on the count itself). Fine when there's only one door (one thread).

`Arc` uses an **atomic** counter — like a digital counter with a lock. No matter how many people tap the button simultaneously, every tap is counted correctly. This costs a bit more (atomic CPU instructions are slower than regular increments), which is why Rust doesn't just make everything atomic by default.

```
Rc: counter++              (not thread-safe, ~1 CPU cycle)
Arc: atomic_fetch_add(1)   (thread-safe, ~10-50 CPU cycles)

Rust forces the choice:
  Rc  → won't compile if sent to another thread
  Arc → compiles, works safely across threads

This is NOT a runtime error like most languages.
The compiler rejects Rc in threaded code at compile time.
The trait that controls this: Send + Sync (Lesson 15).
```

---

## Cow<T> — Clone on Write

`Cow` delays cloning until mutation is needed. Useful when a function
sometimes needs to modify data and sometimes doesn't.

```rust
use std::borrow::Cow;

fn clean_input(input: &str) -> Cow<str> {
    if input.contains("bad") {
        Cow::Owned(input.replace("bad", "good"))
    } else {
        Cow::Borrowed(input)
    }
}

fn main() {
    let clean = clean_input("hello");        // no allocation (borrowed)
    let modified = clean_input("bad word");  // allocated (owned)

    println!("{clean}");
    println!("{modified}");
}
```

---

## Quick Decision Guide

| Need | Use |
|------|-----|
| Put something on the heap | `Box<T>` |
| Multiple owners, single thread | `Rc<T>` |
| Multiple owners, multi-thread | `Arc<T>` |
| Shared + mutable, single thread | `Rc<RefCell<T>>` |
| Shared + mutable, multi-thread | `Arc<Mutex<T>>` |
| Sometimes borrow, sometimes own | `Cow<'a, T>` |
| Recursive types | `Box<T>` |
| Trait objects | `Box<dyn Trait>` |

---

## Exercises

### Exercise 1: Recursive tree
```rust
// Define a binary tree using Box
// enum Tree { Leaf(i32), Node(Box<Tree>, Box<Tree>) }
// Write a function to sum all leaf values
```

### Exercise 2: Shared config
```rust
// Create a Config struct shared between multiple "services" using Rc
// Each service reads from the config
```

### Exercise 3: Thread-safe counter
```rust
// Use Arc<Mutex<HashMap<String, i32>>> to create a thread-safe word counter
// Spawn 4 threads, each incrementing counts for their words
```

---

## Key Takeaways

1. **`Box<T>`** = heap allocation with single owner. Needed for recursive types.
2. **`Rc<T>`** = shared ownership via reference counting. Single-threaded.
3. **`Arc<T>`** = thread-safe `Rc`. Use for sharing data across threads.
4. **`Arc<Mutex<T>>`** = Rust's version of Go's `sync.Mutex` pattern.
5. **`Cow<T>`** = avoid unnecessary clones.
6. **Coming from Go:** Go's GC hides all this. Rust makes you choose, but
   in return gives you predictable performance and no GC pauses.

Next: [Lesson 15 — Concurrency](./15-concurrency.md)
