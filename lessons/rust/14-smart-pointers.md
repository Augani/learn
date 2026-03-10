# Lesson 14: Smart Pointers (Box, Rc, Arc)

Smart pointers are types that act like references but carry extra powers
(like reference counting or heap allocation). You won't use these daily,
but you need to recognize them when reading Rust code.

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
