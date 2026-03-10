# CS Fundamentals for Rust (No Degree Required)

Everyday analogies for the computer science concepts that come up in Rust.
No jargon without explanation.

---

## How a Computer Runs Your Program

Think of your computer as a **kitchen**.

- **CPU** = the chef. It does the actual work (math, logic, decisions).
- **RAM (memory)** = the countertop/workspace. Fast to access, limited space,
  everything disappears when you turn off the power.
- **Hard drive/SSD** = the pantry/fridge. Lots of space, slower to access,
  stuff persists when you turn off the power.
- **Your program** = a recipe. The CPU follows the instructions step by step.

When you run `cargo run`, your compiled program gets loaded from disk into
RAM, and the CPU starts executing it instruction by instruction.

---

## Stack and Heap — The Two Parts of Your Workspace

Your program's RAM is divided into two main areas: the **stack** and the
**heap**. This is the most important concept for understanding Rust.

### The Stack — A Stack of Plates

Imagine a stack of plates at a buffet:
- You can only add a plate to the **top** (push)
- You can only remove a plate from the **top** (pop)
- You can't pull one out from the middle

**The stack in your program works the same way.**

Every time you call a function, a new "plate" (called a **stack frame**)
gets placed on top. It contains:
- The function's local variables
- Where to return when the function is done

When the function finishes, its plate gets removed. All its local
variables disappear instantly. No cleanup needed.

```rust
fn main() {                    // plate 1 pushed onto stack
    let x = 42;               // x lives on plate 1
    let y = add(x, 10);       // plate 2 pushed (for add function)
    println!("{y}");           // plate 2 is gone, back to plate 1
}                              // plate 1 removed, x and y gone

fn add(a: i32, b: i32) -> i32 {  // plate 2: a and b live here
    let result = a + b;           // result lives here too
    result                         // return value, plate 2 about to be removed
}
```

**Stack properties:**
- Extremely fast (just move a pointer up or down)
- Automatic cleanup (function ends = variables gone)
- Limited size (~8MB typically)
- Everything must have a known, fixed size at compile time

**What lives on the stack:**
- Numbers: `i32`, `f64`, `bool`, `char`
- Fixed-size arrays: `[u8; 10]`
- Tuples: `(i32, f64)`
- References/pointers (the pointer itself, not what it points to)

### The Heap — A Warehouse with Lockers

Imagine a huge warehouse full of lockers:
- You go to the front desk and say "I need space for 100 bytes"
- The attendant finds an empty locker, gives you a key (address/pointer)
- You can put stuff in and take stuff out using your key
- When you're done, you return the key and the locker becomes available

**The heap in your program works the same way.**

```rust
fn main() {
    // "hello" needs 5 bytes. Rust asks the heap for 5 bytes.
    // `name` on the stack holds the key (pointer) to the locker (heap memory).
    let name = String::from("hello");

    // name on stack: { pointer: 0x7f..., length: 5, capacity: 5 }
    // heap at 0x7f...: [h, e, l, l, o]
}
// main ends → name's stack frame is removed → Rust sees the String owns
// heap data → automatically returns the locker key → heap memory freed
```

**Heap properties:**
- Slower than stack (finding a free locker takes time)
- No automatic cleanup in C/C++ (you must return the key yourself)
- In Go/JS: garbage collector returns keys for you periodically
- In Rust: the owner returns the key when it goes out of scope
- Can store any amount of data
- Data can live beyond the function that created it

**What lives on the heap:**
- `String` (the actual characters — the pointer lives on the stack)
- `Vec<T>` (the elements — the metadata lives on the stack)
- `Box<T>` (whatever you put in the box)
- Anything dynamically sized

### Visual: Stack vs Heap

```
STACK (fixed, fast)              HEAP (flexible, slower)
┌─────────────────┐              ┌──────────────────────┐
│ main()          │              │                      │
│   x: 42         │              │  "hello world" bytes │
│   name: ─────────────────────> │  at address 0x7f...  │
│     ptr: 0x7f   │              │                      │
│     len: 11     │              │                      │
│     cap: 11     │              │  [1, 2, 3, 4, 5]     │
│   nums: ─────────────────────> │  at address 0x8a...  │
│     ptr: 0x8a   │              │                      │
│     len: 5      │              │                      │
│     cap: 5      │              │                      │
└─────────────────┘              └──────────────────────┘
```

---

## Three Questions to Ask About Any Rust Value

When a piece of Rust code feels confusing, ask these three questions:

1. **Where are the actual bytes?**
2. **Who owns those bytes right now?**
3. **What gets copied when I pass this value around?**

Example:

```rust
let name = String::from("augustus");
let other = name;
```

- **Where are the bytes?**
  The characters `a u g u s t u s` are on the heap.
- **Who owns them?**
  After `let other = name;`, `other` owns them.
- **What got copied?**
  Only the small `String` header moved: pointer, length, capacity.
  The characters were **not** duplicated.

This is the core mental shift in Rust:

- A value can be **small on the stack**
- While referring to **large data on the heap**
- And a "move" often means **moving ownership metadata**, not cloning all bytes

**Analogy:** Think of a warehouse receipt.

- The boxes are in the warehouse (heap)
- The receipt is in your hand (stack)
- Moving ownership often means handing the receipt to someone else
- Cloning means paying to duplicate the actual boxes

---

## Memory — What Actually Happens

### Allocating Memory = Checking Out a Library Book

When your program needs heap memory:
1. It usually asks the process allocator/runtime for N bytes
2. The allocator reuses a free block if it has one
3. If not, the allocator asks the OS for more pages and gives your program a pointer

This is called **allocation**. It's slow compared to the stack because
the allocator has to manage free space and may occasionally call into
the OS for more memory.

### Freeing Memory = Returning the Library Book

When you're done with heap memory, it needs to be freed (returned):

| Language | How memory is freed |
|----------|-------------------|
| C | You manually call `free()`. Forget = memory leak. Free twice = crash. |
| C++ | Destructors (RAII), or manual. Still error-prone. |
| Go | Garbage collector does it for you. Convenient but unpredictable timing. |
| JavaScript | Garbage collector. Same as Go. |
| Rust | The owner frees it when it goes out of scope. Predictable, no GC. |

### Memory Leak = Never Returning the Book

If memory is allocated but never freed, it's "leaked." Your program keeps
using more and more RAM until it crashes or the OS kills it.

- **In Go/JS:** The GC prevents most leaks, but you can still leak by
  holding references to things you no longer need.
- **In Rust:** Leaks are rare because the ownership system forces cleanup.
  (You CAN still leak with `Rc` reference cycles, but it's hard to do
  accidentally.)

### Dangling Pointer = Using an Expired Library Card

If you free memory but still have a pointer to it, that pointer is
"dangling." Using it reads garbage data or crashes.

```c
// C example of a dangling pointer:
char* name = malloc(10);
strcpy(name, "hello");
free(name);          // memory freed
printf("%s", name);  // BOOM: dangling pointer, reading freed memory
```

**In Rust, this is literally impossible.** The compiler refuses to let you
use a reference after the data it points to has been freed. That's what
ownership and lifetimes enforce.

---

## Common Misconceptions That Trip People Up

### "Stack means fast, heap means slow"

Usually true, but too simplistic.

- Stack allocation is cheap because it often just moves a pointer
- Heap allocation is more expensive because the allocator has more work
- But real performance also depends on **cache locality**, **how much data you copy**,
  and **whether you trigger allocations repeatedly**

A badly designed stack-heavy program can be slower than a heap-using one.
The real lesson is: avoid unnecessary allocation and unnecessary copying.

### "A value is either on the stack or on the heap"

Many important Rust types are really **split across both**.

`String`, `Vec<T>`, and `Box<T>` usually have:
- a small control structure on the stack
- the actual dynamic data on the heap

So asking "is String on the stack or heap?" is the wrong question.
The better question is: **which part lives where?**

### "Moving a String copies all the text"

No. A move usually copies only the small fixed-size header.

```rust
let a = String::from("hello");
let b = a; // moves ownership, does not duplicate "hello"
```

The heap bytes stay where they are. Ownership of those bytes changes hands.

### "Ownership is about where data lives"

Ownership is about **who is responsible for cleanup**, not whether the data
is on the stack or heap.

- Stack locals are cleaned up automatically when the frame ends
- Heap data also gets cleaned up automatically in Rust, but only because
  some owner is responsible for dropping it

### "References are just pointers"

They are pointers, but not *just* pointers.

A Rust reference is an address **plus compiler-enforced rules**:
- shared references allow reading
- mutable references allow exclusive mutation
- references cannot outlive the data they refer to

That extra ruleset is why references feel safe while raw pointers do not.

---

## Garbage Collector — The Cleaning Crew

### What it is

A garbage collector (GC) is a background process in your program that
periodically:
1. Pauses your program (briefly)
2. Scans all memory to find data nothing points to anymore
3. Frees that memory
4. Resumes your program

Think of it like a cleaning crew that periodically sweeps the office.
You don't have to take out your own trash, but the cleaning crew
occasionally interrupts everyone to do their sweep.

### Go's GC

Go uses a **concurrent, mark-and-sweep GC**:
- **Mark phase:** Walk through all references starting from global variables
  and stack. Mark everything reachable as "in use."
- **Sweep phase:** Everything NOT marked is garbage. Free it.

The GC runs concurrently with your code (mostly), but still causes brief
"stop-the-world" pauses (usually <1ms in Go).

### Why Rust Doesn't Need a GC

Rust's ownership rules guarantee at compile time that:
1. Every piece of data has exactly one owner
2. When the owner is done (goes out of scope), the data is freed

The compiler inserts `drop()` calls at the right places in your code.
No scanning, no pausing, no runtime overhead. The tradeoff: you have to
satisfy the ownership rules, and the compiler is strict about it.

---

## Pointers and References — Addresses

### A pointer is an address

Your house has an address (like "123 Main St"). A pointer is a variable
that stores the memory address of some data.

```
Variable `x` at stack address 0x1000:  42
Variable `ptr` at stack address 0x1008:  0x1000  ← this IS a pointer to x
```

When you write `&x` in Rust, you get a reference (a safe pointer) to where
`x` lives in memory.

### Why pointers matter

Without pointers, passing data to a function means COPYING all the data.
A 1MB struct? Copy 1MB. With a pointer, you just pass the 8-byte address.

```rust
fn process(data: &[u8]) {   // just receives an 8-byte pointer + length
    // can read the original 1MB of data without copying it
}
```

### Rust references vs raw pointers

| Type | Safety | Syntax |
|------|--------|--------|
| Shared reference | Safe (compiler checked) | `&T` |
| Mutable reference | Safe (compiler checked) | `&mut T` |
| Raw pointer | Unsafe (you're on your own) | `*const T` / `*mut T` |

You'll almost exclusively use `&T` and `&mut T`. Raw pointers are for
FFI with C libraries and other advanced cases.

---

## Binary, Compilation, and Executables

### Source code → Binary

Your `.rs` files are human-readable text. The computer can't execute text.
Compilation transforms your code into machine instructions (binary).

```
source.rs  →  [compiler]  →  binary executable
  (text)        (rustc)       (machine code)
```

When you run `cargo build`, the Rust compiler (`rustc`) reads your code,
checks types, checks ownership rules, optimizes, and produces a binary
file that your CPU can execute directly.

### Why Rust is fast

| Language | How it runs |
|----------|-------------|
| Python/JS | Interpreted: reads and executes code line by line at runtime |
| Go | Compiled to machine code, but has a GC runtime |
| Rust | Compiled to machine code, no GC, no runtime overhead |

Rust's compiled binary is about as fast as C/C++, but with memory safety
guarantees.

---

## Concurrency vs Parallelism

### Concurrency — Juggling

One person juggling 3 balls. At any instant, only one ball is in your hand,
but you manage all three. You switch between them quickly.

**Example:** A single CPU core handling multiple web requests by switching
between them while waiting for database responses.

### Parallelism — Multiple Jugglers

Three people each juggling one ball. Actually doing multiple things at the
same exact time.

**Example:** Four CPU cores each processing a different web request
simultaneously.

### In Rust

- **`async/await` (tokio)** = concurrency. One thread handles many tasks
  by switching when a task is waiting (I/O, network, sleep).
- **`thread::spawn`** = parallelism. Multiple OS threads on multiple CPU cores.
- **`rayon`** = easy parallelism. Splits work across all CPU cores.

### In Go

Go's goroutines do both — the Go runtime schedules thousands of goroutines
across a few OS threads, handling both concurrency and parallelism
automatically. Rust makes you choose explicitly.

---

## Types and Type Safety

### What types are

A type tells the compiler two things:
1. How much memory to allocate (an `i32` = 4 bytes, an `i64` = 8 bytes)
2. What operations are valid (you can add numbers, not add a number to a string)

### Static vs Dynamic typing

| | Static typing | Dynamic typing |
|---|---|---|
| **When checked** | Compile time | Runtime |
| **Languages** | Rust, Go, TypeScript | Python, JavaScript |
| **Errors** | Caught before running | Caught when the line executes |

Rust is statically typed AND has type inference (the compiler figures out
types for you when it's obvious):

```rust
let x = 42;           // compiler infers i32
let name = "hello";   // compiler infers &str
let v = vec![1, 2];   // compiler infers Vec<i32>
```

### What "zero-cost abstraction" means

When you use high-level features like iterators:

```rust
let sum: i32 = (1..=100).filter(|x| x % 2 == 0).sum();
```

The compiler optimizes this to the EXACT SAME machine code as a hand-written
loop:

```rust
let mut sum = 0;
let mut i = 1;
while i <= 100 {
    if i % 2 == 0 { sum += i; }
    i += 1;
}
```

"Zero cost" means you pay no runtime penalty for using the nicer syntax.
The abstraction is eliminated at compile time.

---

## Quick Reference: Sizes of Common Types

| Type | Size | What it holds |
|------|------|-------------|
| `bool` | 1 byte | true or false |
| `u8` / `i8` | 1 byte | 0–255 / -128–127 |
| `u16` / `i16` | 2 bytes | 0–65535 / -32768–32767 |
| `u32` / `i32` | 4 bytes | 0–4.2 billion / ±2.1 billion |
| `u64` / `i64` | 8 bytes | Very large numbers |
| `f32` | 4 bytes | Decimal numbers (7 digits precision) |
| `f64` | 8 bytes | Decimal numbers (15 digits precision) |
| `usize` | 8 bytes (64-bit) | Size of things in memory, array indices |
| `char` | 4 bytes | One Unicode character |
| `&T` | 8 bytes | A pointer to T |
| `&str` | 16 bytes | Pointer (8) + length (8) |
| `String` | 24 bytes on stack | Pointer (8) + length (8) + capacity (8), plus heap data |
| `Vec<T>` | 24 bytes on stack | Same as String layout, plus heap data |
| `Option<T>` | size of T + alignment | Some(T) or None |

A byte = 8 bits. A bit is a single 0 or 1. All data in a computer is
ultimately just bits.
