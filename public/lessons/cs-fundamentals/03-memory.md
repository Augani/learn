# Lesson 03: Memory — Allocation, Freeing, and What Can Go Wrong

> **The one thing to remember**: Memory management is the #1 source
> of bugs in systems programming. Every language makes a different
> trade-off between safety, performance, and developer convenience.
> Understanding these trade-offs is understanding why languages exist.

---

## Memory Allocation: Checking Out a Library Book

When your program needs memory at runtime (for a String, a Vec, a
network buffer), it asks the **memory allocator** for some bytes.

**Analogy — hotel front desk:**

You walk into a hotel (the heap) and say "I need a room for 3 nights"
(100 bytes). The front desk (allocator) checks which rooms are free,
assigns you Room 42, and gives you a key card (a pointer).

```
THE ALLOCATOR'S JOB

  Your program: "I need 100 bytes"

  Allocator's internal free list:
  +--------+--------+--------+--------+--------+
  |  USED  |  FREE  |  USED  |  FREE  |  USED  |
  |  64B   | 128B ← |  256B  |  48B   |  100B  |
  +--------+--------+--------+--------+--------+

  Allocator: "Here's a pointer to the 128B free block.
              I'll split it: 100B for you, 28B stays free."

  After allocation:
  +--------+----+---+--------+--------+--------+
  |  USED  |USED|FR |  USED  |  FREE  |  USED  |
  |  64B   |100B|28B|  256B  |  48B   |  100B  |
  +--------+----+---+--------+--------+--------+
```

### What Happens Inside `malloc` (simplified)

```
1. Check the free list for a block >= requested size
2. If found:
   - Split the block if it's much larger than needed
   - Return a pointer to the allocated portion
3. If not found:
   - Ask the OS for more memory (mmap or brk syscall)
   - Add the new memory to the free list
   - Try again
```

In Rust, this happens behind the scenes when you create a `String`,
`Vec`, `Box`, or any heap-allocated type. In C, you call `malloc()`
explicitly.

---

## Freeing Memory: Returning the Key Card

When you're done with memory, it needs to be returned to the
allocator so it can be reused.

```
WHAT DIFFERENT LANGUAGES DO

  +-----------+---------------------------------------------------+
  | Language  | How memory is freed                               |
  +-----------+---------------------------------------------------+
  | C         | You call free() manually.                         |
  |           | Forget = memory leak. Free twice = crash.         |
  +-----------+---------------------------------------------------+
  | C++       | Destructors (RAII) or manual. Still error-prone.  |
  +-----------+---------------------------------------------------+
  | Go        | Garbage collector does it for you.                |
  |           | Convenient but unpredictable timing.              |
  +-----------+---------------------------------------------------+
  | Java      | Garbage collector. Like Go.                       |
  +-----------+---------------------------------------------------+
  | Python    | Reference counting + cycle collector.             |
  |           | Mostly automatic.                                 |
  +-----------+---------------------------------------------------+
  | Rust      | Owner frees when it goes out of scope.            |
  |           | Compile-time checked. No GC. No manual free.      |
  +-----------+---------------------------------------------------+
```

---

## What Goes Wrong: The Four Horsemen of Memory Bugs

### 1. Memory Leak — Never Returning the Book

**Analogy**: You borrow library books and never return them. The
library keeps buying new books to replace them, but eventually runs
out of shelf space (RAM) and closes (crashes/OOM kill).

```c
// C: Classic memory leak
void process_request() {
    char *buffer = malloc(1024);  // Allocate 1KB
    // ... do work with buffer ...

    if (error_condition) {
        return;  // BUG: forgot to free(buffer)!
    }

    free(buffer);  // This line only runs if no error
}
// Call this function 1 million times = leak 1 GB
```

```go
// Go: Leak via goroutine that never exits
func leaky() {
    ch := make(chan int)
    go func() {
        val := <-ch  // Blocks forever — ch is never sent to
        fmt.Println(val)
    }()
    // The goroutine and its stack memory are leaked
}
```

```rust
// Rust: Leaks are very rare, but possible with Rc cycles
use std::rc::Rc;
use std::cell::RefCell;

struct Node {
    next: Option<Rc<RefCell<Node>>>,
}

let a = Rc::new(RefCell::new(Node { next: None }));
let b = Rc::new(RefCell::new(Node { next: Some(a.clone()) }));
a.borrow_mut().next = Some(b.clone());
// a → b → a → b → ...  Ref count never reaches 0. Memory leaked.
// (This is why Rust has Weak<T> — to break cycles)
```

### 2. Dangling Pointer — Using an Expired Library Card

**Analogy**: Your library card expires, but you still try to use it.
The library gave your locker to someone else. When you open it, you
find someone else's stuff — or an empty locker — or the lock is
broken and the building collapses.

```c
// C: Use-after-free (dangling pointer)
char *name = malloc(10);
strcpy(name, "hello");
free(name);             // Memory returned to allocator

// name still holds the old address, but the memory is freed
printf("%s\n", name);   // UNDEFINED BEHAVIOR!
                         // Might print "hello" (memory not yet reused)
                         // Might print garbage
                         // Might crash
                         // Might format your hard drive (technically allowed!)
```

```rust
// Rust: The compiler PREVENTS this at compile time
let name = String::from("hello");
drop(name);              // Explicitly free
// println!("{name}");   // COMPILE ERROR: value used after move
                          // Rust refuses to let this happen.
```

**Real-world impact**: The Heartbleed bug (2014) was essentially a
buffer over-read — OpenSSL read memory it shouldn't have been able
to access, leaking passwords and encryption keys from thousands of
servers.

### 3. Double Free — Returning a Book Twice

**Analogy**: You return a library book. The library puts it back on
the shelf. Someone else checks it out. Then you "return" the same
book again. The library removes whatever book is in that slot — which
now belongs to someone else.

```c
// C: Double free
char *data = malloc(100);
free(data);       // First free — OK
// ... more code ...
free(data);       // Second free — CRASH or heap corruption!
                  // The allocator's bookkeeping is now corrupted
```

```rust
// Rust: Impossible — ownership prevents double free
let data = String::from("hello");
drop(data);       // First drop — OK, memory freed
// drop(data);    // COMPILE ERROR: value used after move
```

### 4. Buffer Overflow — Writing Past Your Shelf Space

**Analogy**: You rented shelf space for 10 books, but you put 15
books on the shelf. The extra 5 books end up on your neighbor's shelf,
overwriting their stuff. If your neighbor's shelf had important
instructions (like a return address on the stack), an attacker can
control what those instructions say.

```
Buffer overflow — the #1 security vulnerability in history

  Your buffer: [h][e][l][l][o][\0][  ][  ]
  Neighbor:    [return address][ saved regs ]

  Overflow:    [h][e][l][l][o][ ][w][o][r][l][d]
                               ^^^^^^^^^^^^^^^^^^^^
                               These bytes overwrite the return address!
                               Attacker can redirect execution to their code.
```

```c
// C: Classic buffer overflow
char buffer[8];
strcpy(buffer, "this string is way too long for the buffer");
// Overwrites past buffer[7] into adjacent memory
// If this is a stack buffer, it can overwrite the return address
```

```rust
// Rust: Bounds checking prevents this
let mut buffer = vec![0u8; 8];
buffer[100] = 42;  // PANIC at runtime: index out of bounds
                    // The program crashes safely instead of
                    // silently corrupting memory
```

---

## Virtual Memory: Every Guest Gets Their Own Floor

**Analogy**: In a hotel, every guest believes they have the entire
floor to themselves. Room 1 is always at the same place on "their"
floor. But behind the scenes, the hotel manager (OS) maps each
guest's "Room 1" to a different physical room.

```
VIRTUAL MEMORY

  Process A thinks:              Process B thinks:
  "My memory starts at 0"       "My memory starts at 0"

  Process A                      Process B
  Virtual Address Space          Virtual Address Space
  +------------------+           +------------------+
  | 0x0000: my code  |           | 0x0000: my code  |
  | 0x1000: my data  |           | 0x1000: my data  |
  | 0x2000: my heap  |           | 0x2000: my heap  |
  +------------------+           +------------------+
         |                              |
         v                              v
  +------+-----------+----------+------+-----------+
  |      Page Table A |          |     Page Table B  |
  |  virt   → phys   |          | virt   → phys    |
  |  0x0000 → 0x5000 |          | 0x0000 → 0x9000  |
  |  0x1000 → 0x6000 |          | 0x1000 → 0xA000  |
  |  0x2000 → 0x7000 |          | 0x2000 → 0xB000  |
  +-------------------+         +-------------------+
                    |                   |
                    v                   v
         +--------------------------------------+
         |         Physical RAM (Hardware)       |
         |  0x5000  0x6000  0x7000  ...         |
         |  0x9000  0xA000  0xB000  ...         |
         +--------------------------------------+
```

### Why Virtual Memory Matters

1. **Isolation**: Process A can't read Process B's memory. They don't
   even know each other exists. Security!

2. **Simplicity**: Every program thinks it starts at address 0. The
   OS handles the mapping. Programs don't need to coordinate addresses.

3. **Overcommit**: The OS can promise more memory than physically
   exists. If you `malloc(1GB)` but only use 4KB, only 4KB of physical
   RAM is actually allocated (on Linux, at least).

4. **Swapping**: If RAM is full, the OS can move inactive pages to
   disk (swap), freeing physical RAM for active processes.

---

## Page Faults: When the Hotel Needs to Build a New Room

When your program accesses a virtual address that isn't mapped to
physical RAM yet, the CPU triggers a **page fault**. The OS then:

1. Finds a free physical page (or evicts one to disk)
2. Maps the virtual page to the physical page
3. Resumes your program — it never knew the interruption happened

**Analogy**: You open the door to Room 42, but the hotel hasn't
built it yet. The construction crew (OS) quickly builds the room,
and when you look again, it's ready. You never noticed the delay
(unless it was slow — then you felt a "page fault stall").

```
Page fault timeline:

  Program: "Read address 0x2000"
  CPU: "That page isn't in RAM!"
       → Page fault interrupt
  OS:  "Let me load this page from disk"
       → Reads from swap/file
       → Maps physical page
       → Returns control to program
  Program: "Read address 0x2000" (succeeds this time)
```

Minor page faults (page exists but isn't mapped yet) are fast (~1μs).
Major page faults (page must be read from disk) are slow (~10ms on HDD).

---

## How Rust Handles All of This

Rust's ownership system means:
- **No memory leaks** (in practice) — every allocation has exactly one owner
- **No dangling pointers** — the borrow checker prevents use-after-free
- **No double free** — ownership prevents freeing twice
- **No buffer overflows** — bounds checking on array/vec access
- **No garbage collector** — deterministic destruction when owners go out of scope

The trade-off: you have to satisfy the compiler's ownership rules,
and sometimes that means restructuring your code.

```rust
fn safe_rust() {
    let data = vec![1, 2, 3, 4, 5];

    // Bounds-checked access
    if let Some(val) = data.get(10) {
        println!("Got: {val}");
    } else {
        println!("Index out of bounds — handled safely");
    }

    // Ownership ensures cleanup
    let name = String::from("hello");
    process(name);        // name MOVED into process()
    // name is no longer valid here — can't accidentally use freed memory
}

fn process(s: String) {
    println!("{s}");
}   // s is dropped here, memory freed. Exactly once. Guaranteed.
```

---

## Exercises

1. **Spot the bug**: What's wrong with this C code?
   ```c
   int* create_array() {
       int arr[5] = {1, 2, 3, 4, 5};
       return arr;  // What happens?
   }
   ```

2. **Memory layout**: A `Vec<String>` contains 3 strings. Draw the
   full memory layout showing what's on the stack, what's on the heap,
   and all the pointers between them.

3. **Virtual memory**: If two programs both have a variable at virtual
   address 0x1000, do they conflict? Why or why not?

4. **Language comparison**: Write a program in your language of choice
   that allocates 1 million small objects (like Strings). Monitor
   memory usage. How does it compare to the theoretical minimum?
   (Hint: allocator overhead adds up)

5. **Buffer overflow**: Explain why this Rust code panics instead of
   causing a security vulnerability:
   ```rust
   let v = vec![1, 2, 3];
   println!("{}", v[10]);
   ```

---

[Next: Lesson 04 — Types and Type Systems](./04-types.md)
