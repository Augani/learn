# Lesson 04: The Stack and Heap in Depth — What Your Rust Code Actually Does

This lesson bridges OS concepts and Rust ownership. You already learned
ownership rules in [Lesson 01](../rust/01-ownership.md). Now you'll see what's
physically happening in memory when those rules are enforced.

---

## The Two Memories

Every process has two main regions for storing data:

```
┌─────────────────────────────────────────────────────────┐
│                        STACK                            │
│                                                         │
│  - Fixed-size values (i32, f64, bool, pointers)         │
│  - Function call frames                                 │
│  - Grows/shrinks automatically with function calls      │
│  - Extremely fast: just move the stack pointer           │
│  - LIFO: last in, first out                             │
│  - Typical limit: 8 MB (configurable)                   │
│  - One stack per thread                                 │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                        HEAP                             │
│                                                         │
│  - Dynamically-sized data (String, Vec, HashMap)        │
│  - Explicitly allocated and freed                       │
│  - Slower: allocator must find free space               │
│  - No ordering constraint                               │
│  - Shared between all threads in a process              │
│  - Limited only by available RAM + swap                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Speed difference

| Operation | Stack | Heap |
|-----------|-------|------|
| Allocate | ~1 ns (move stack pointer) | ~25-100 ns (allocator search) |
| Access | Cache-friendly (contiguous) | Cache-unfriendly (scattered) |
| Free | Automatic (function returns) | Manual (or Rust's Drop trait) |

---

## Stack Frames Visualized

Every function call pushes a new **frame** onto the stack. When the function
returns, the frame is popped off:

```rust
fn add(a: i64, b: i64) -> i64 {
    let sum = a + b;
    sum
}

fn main() {
    let x = 10;
    let y = 20;
    let result = add(x, y);
    println!("{}", result);
}
```

Stack evolution during execution:

```
STEP 1: main() starts          STEP 2: add() called         STEP 3: add() returns

High addr                       High addr                    High addr
│                               │                            │
│ ┌─────────────────┐           │ ┌─────────────────┐        │ ┌─────────────────┐
│ │ main() frame    │           │ │ main() frame    │        │ │ main() frame    │
│ │                 │           │ │                 │        │ │                 │
│ │ x = 10         │           │ │ x = 10         │        │ │ x = 10         │
│ │ y = 20         │           │ │ y = 20         │        │ │ y = 20         │
│ │ result = ?     │           │ │ result = ?     │        │ │ result = 30    │
│ │ return addr    │           │ │ return addr    │        │ │ return addr    │
│ └─────────────────┘           │ ├─────────────────┤        │ └─────────────────┘
│   ▲ SP (stack pointer)        │ │ add() frame    │        │   ▲ SP (popped back)
│                               │ │                 │        │
▼                               │ │ a = 10         │        ▼
Low addr                        │ │ b = 20         │        Low addr
                                │ │ sum = 30       │
                                │ │ return addr    │
                                │ └─────────────────┘
                                │   ▲ SP
                                ▼
                                Low addr
```

The stack pointer (SP) is a CPU register. Allocating on the stack means
decrementing SP. Freeing means incrementing SP. That's it — no bookkeeping,
no searching for free space.

---

## Deeper: Nested Calls

```rust
fn factorial(n: u64) -> u64 {
    if n <= 1 {
        return 1;
    }
    n * factorial(n - 1)
}

fn main() {
    let result = factorial(5);
    println!("{}", result);
}
```

Stack at maximum depth (when `n = 1`):

```
┌─────────────────────┐
│ main()              │
│   result = ?        │
├─────────────────────┤
│ factorial(5)        │
│   n = 5             │
│   return addr → main│
├─────────────────────┤
│ factorial(4)        │
│   n = 4             │
│   return addr       │
├─────────────────────┤
│ factorial(3)        │
│   n = 3             │
│   return addr       │
├─────────────────────┤
│ factorial(2)        │
│   n = 2             │
│   return addr       │
├─────────────────────┤
│ factorial(1)        │  ← current frame
│   n = 1             │
│   return addr       │
└─────────────────────┘
  ▲ SP
```

Each call adds ~32-64 bytes to the stack. With `factorial(100_000)`, you'd
push 100,000 frames — probably exceeding the 8 MB stack limit. That's a
stack overflow.

---

## Stack Overflow

```rust
fn infinite_recursion() {
    infinite_recursion();
}

fn main() {
    infinite_recursion();
}
```

```
thread 'main' has overflowed its stack
```

What happens:
1. Each recursive call pushes a new frame.
2. The stack grows downward toward the heap.
3. It hits the **guard page** — an unmapped page the kernel placed as a boundary.
4. Accessing the guard page triggers a page fault.
5. The kernel sees it's the guard page and sends a signal.
6. Rust catches the signal and panics with "stack overflow."

```
┌─────────────┐
│    Stack     │
│   frame 1   │
│   frame 2   │
│   frame 3   │
│     ...     │
│  frame N    │
├─────────────┤ ← guard page (unmapped)
│  BOOM!      │   accessing this = page fault = stack overflow
├─────────────┤
│             │
│    Heap     │
└─────────────┘
```

Default stack size:
- Linux: 8 MB (`ulimit -s`)
- macOS: 8 MB
- Rust threads: 2 MB (configurable via `thread::Builder::new().stack_size()`)

---

## Heap Allocation: What malloc/free Actually Do

When your Rust code allocates on the heap, the allocator does real work:

### The allocator's job

The heap is a region of memory managed by an **allocator** (Rust uses `jemalloc`
or the system allocator depending on platform and configuration):

```
Heap memory (simplified view):

┌──────────────────────────────────────────────────────────┐
│  USED    │  FREE     │  USED  │  FREE  │  USED          │
│  64 B    │  128 B    │  32 B  │  256 B │  512 B         │
└──────────────────────────────────────────────────────────┘

Request: allocate 100 bytes

Allocator searches free blocks:
- 128 B block? Yes, big enough → use it
- Split: 100 B for the allocation + 28 B remains free

After allocation:
┌──────────────────────────────────────────────────────────┐
│  USED    │USED│FREE│  USED  │  FREE  │  USED            │
│  64 B    │100B│28B │  32 B  │  256 B │  512 B           │
└──────────────────────────────────────────────────────────┘
```

This is much more complex than stack allocation:
1. Search for a free block of sufficient size.
2. Possibly split the block.
3. Update bookkeeping metadata.
4. Return a pointer.

When the allocator runs out of space in its managed region, it asks the kernel
for more via the `brk()` or `mmap()` syscall.

### Memory fragmentation

Over time, the heap gets messy:

```
After many allocate/free cycles:

┌───┬────┬──┬─────┬───┬──┬────┬───────┬──┬───────────┐
│USE│FREE│US│FREE │USE│FR│FREE│ USED  │FR│   FREE    │
│32B│16B │8B│ 64B │32B│4B│24B │ 128B  │8B│   256B    │
└───┴────┴──┴─────┴───┴──┴────┴───────┴──┴───────────┘

Total free: 16+64+4+24+8+256 = 372 bytes
But can we allocate 200 bytes? Only from the 256B block.
The rest is fragmented into small pieces.
```

This is **external fragmentation** — lots of free space, but no single
contiguous block large enough. It's a major reason heap allocation is slower
and more complex than stack allocation.

Rust helps reduce heap allocations through its ownership model. Values on the
stack don't contribute to fragmentation.

---

## How Rust's Ownership Maps to Memory

### Stack allocation: `let x = 5;`

```rust
let x: i32 = 5;
```

```
What happens: stack pointer decremented by 4 bytes, value 5 written.

Stack:
┌──────────┐
│ x = 5    │  4 bytes, directly on stack
│ (i32)    │
└──────────┘
  ▲ SP

Cost: ~1 ns. No allocator involved.
When x goes out of scope: SP moves back up. Done.
```

### Heap allocation: `let s = String::from("hello");`

```rust
let s = String::from("hello");
```

```
What happens:

1. Allocator finds 5 bytes on the heap (the string data)
2. Copies "hello" into those 5 bytes
3. Pushes a String struct (ptr, len, capacity) onto the stack

Stack:                          Heap:
┌──────────────────┐           ┌───┬───┬───┬───┬───┐
│ s: String        │           │ h │ e │ l │ l │ o │
│   ptr ───────────┼──────────►│   │   │   │   │   │
│   len: 5         │           └───┴───┴───┴───┴───┘
│   capacity: 5    │           (5 bytes allocated)
│                  │
│ (24 bytes on     │
│  64-bit system)  │
└──────────────────┘

Cost: ~25-100 ns for heap allocation + memcpy.
```

### Move: `let s2 = s;`

```rust
let s = String::from("hello");
let s2 = s;  // ownership moves
// s is now invalid
```

```
BEFORE move:                    AFTER move:

Stack:                          Stack:
┌──────────────┐               ┌──────────────┐
│ s: String    │               │ s: INVALID   │  (compiler won't
│   ptr ──────►│ heap          │              │   let you use it)
│   len: 5     │               ├──────────────┤
│   cap: 5     │               │ s2: String   │
└──────────────┘               │   ptr ──────►│ heap
                               │   len: 5     │
Heap:                          │   cap: 5     │
┌─────────────┐                └──────────────┘
│ h e l l o   │
└─────────────┘                Heap:
                               ┌─────────────┐
                               │ h e l l o   │  (same allocation!)
                               └─────────────┘

What actually happened: 24 bytes copied on the stack (ptr, len, cap).
Zero heap activity. The heap data doesn't move.
```

### Drop: `drop(s)` or end of scope

```rust
{
    let s = String::from("hello");
    // ... use s ...
}  // s dropped here
```

```
At drop:

1. Rust calls s.drop() (the Drop trait implementation)
2. Drop calls the allocator's free/dealloc for the heap memory
3. The allocator marks those 5 bytes as available
4. The stack frame is popped (SP moves up)

Stack:                          Heap:
┌──────────────┐               ┌─────────────┐
│ (reclaimed)  │               │ (freed)     │  Available for
└──────────────┘               └─────────────┘  future allocations
```

### Borrow: `&s`

```rust
let s = String::from("hello");
let r = &s;
```

```
Stack:                          Heap:
┌──────────────┐               ┌─────────────┐
│ s: String    │               │ h e l l o   │
│   ptr ──────►│──────────────►│             │
│   len: 5     │               └─────────────┘
│   cap: 5     │
├──────────────┤
│ r: &String   │
│   ptr ──────►│ (points to s on the stack, NOT to heap)
└──────────────┘

r is just an 8-byte pointer on the stack.
No heap allocation. No copying. Zero cost.
```

---

## Using std::mem::size_of to See Actual Sizes

```rust
use std::mem;

fn main() {
    println!("Sizes on the STACK (the struct/metadata, not heap data):\n");

    println!("  bool:           {} bytes", mem::size_of::<bool>());
    println!("  i32:            {} bytes", mem::size_of::<i32>());
    println!("  i64:            {} bytes", mem::size_of::<i64>());
    println!("  f64:            {} bytes", mem::size_of::<f64>());
    println!("  char:           {} bytes", mem::size_of::<char>());
    println!("  &i32:           {} bytes", mem::size_of::<&i32>());
    println!("  &str:           {} bytes", mem::size_of::<&str>());
    println!("  String:         {} bytes", mem::size_of::<String>());
    println!("  Vec<u8>:        {} bytes", mem::size_of::<Vec<u8>>());
    println!("  Vec<i64>:       {} bytes", mem::size_of::<Vec<i64>>());
    println!("  Option<i32>:    {} bytes", mem::size_of::<Option<i32>>());
    println!("  Option<&i32>:   {} bytes", mem::size_of::<Option<&i32>>());
    println!("  Box<i32>:       {} bytes", mem::size_of::<Box<i32>>());
    println!("  [u8; 100]:      {} bytes", mem::size_of::<[u8; 100]>());

    println!("\nNotice:");
    println!("  - String and Vec are 24 bytes (ptr + len + capacity)");
    println!("  - &str is 16 bytes (ptr + len) — a 'fat pointer'");
    println!("  - &i32 is 8 bytes (just a pointer)");
    println!("  - Option<&i32> is 8 bytes (null pointer optimization!)");
    println!("  - Box<i32> is 8 bytes (just a pointer, i32 is on heap)");
}
```

Expected output (on 64-bit systems):
```
  bool:           1 bytes
  i32:            4 bytes
  i64:            8 bytes
  f64:            8 bytes
  char:           4 bytes
  &i32:           8 bytes
  &str:           16 bytes    ← fat pointer: ptr + length
  String:         24 bytes    ← ptr + length + capacity
  Vec<u8>:        24 bytes    ← same structure as String
  Vec<i64>:       24 bytes    ← same! (the actual data is on heap)
  Option<i32>:    8 bytes     ← i32 + discriminant + padding
  Option<&i32>:   8 bytes     ← null pointer optimization
  Box<i32>:       8 bytes     ← just a pointer
  [u8; 100]:      100 bytes   ← fixed-size, entirely on stack
```

---

## Box<T> — Explicit Heap Allocation

```rust
fn main() {
    let stack_val = 42i32;
    let heap_val = Box::new(42i32);

    println!("stack_val at: {:p} (on stack)", &stack_val);
    println!("heap_val ptr at: {:p} (Box on stack)", &heap_val);
    println!("heap_val data at: {:p} (i32 on heap)", &*heap_val);
}
```

```
Stack:                         Heap:
┌──────────────┐              ┌──────────┐
│ stack_val: 42│              │ 42       │  ← 4 bytes
├──────────────┤              └──────────┘
│ heap_val: Box│                   ▲
│   ptr ───────┼───────────────────┘
└──────────────┘

Box<i32> on stack: 8 bytes (just a pointer)
i32 on heap: 4 bytes
Total: 12 bytes instead of 4. Why use Box then?

Use Box when:
- You need a value to live longer than the current scope
- You need a recursive data structure (Box breaks infinite size)
- You need to transfer ownership without copying large data
- You need a trait object (Box<dyn Trait>)
```

---

## Vec Growth Strategy

When a Vec runs out of capacity, it allocates a new, larger buffer and copies:

```rust
fn main() {
    let mut v: Vec<i32> = Vec::new();

    for i in 0..20 {
        let old_cap = v.capacity();
        v.push(i);
        let new_cap = v.capacity();
        if new_cap != old_cap {
            println!(
                "push({:2}): capacity {} → {}, ptr: {:p}",
                i, old_cap, new_cap, v.as_ptr()
            );
        }
    }
}
```

```
push( 0): capacity 0 → 4, ptr: 0x6000012e8040
push( 4): capacity 4 → 8, ptr: 0x6000012e8060   ← new allocation!
push( 8): capacity 8 → 16, ptr: 0x600001ae0080  ← new allocation!
push(16): capacity 16 → 32, ptr: 0x600001ee0100  ← new allocation!
```

Each reallocation:
1. Allocates new, larger buffer on heap (typically 2x capacity).
2. Copies all existing elements to the new buffer.
3. Frees the old buffer.

This is why `Vec::with_capacity(n)` exists — if you know the size, preallocate
to avoid reallocation.

---

## Exercises

### Exercise 1: Trace the memory layout

For this code, draw the stack and heap at the marked point:

```rust
fn process(data: &[i32]) -> i32 {
    let mut total = 0;
    for val in data {
        total += val;
    }
    total
    // ← DRAW MEMORY HERE
}

fn main() {
    let numbers = vec![10, 20, 30, 40, 50];
    let result = process(&numbers);
    println!("{}", result);
}
```

Questions:
- Where is `numbers`'s metadata (ptr, len, cap)? (stack, in main's frame)
- Where are the actual integers 10, 20, 30, 40, 50? (heap)
- What does `&numbers` pass to `process`? (a fat pointer: ptr + length)
- Where is `total` in `process`? (stack, in process's frame)

### Exercise 2: Size exploration

```rust
use std::mem;

struct Point {
    x: f64,
    y: f64,
}

struct Line {
    start: Point,
    end: Point,
}

enum Shape {
    Circle(f64),
    Rectangle(f64, f64),
    Triangle(Point, Point, Point),
}

fn main() {
    println!("Point: {} bytes", mem::size_of::<Point>());
    println!("Line: {} bytes", mem::size_of::<Line>());
    println!("Shape: {} bytes", mem::size_of::<Shape>());
    println!("Option<Box<Point>>: {} bytes", mem::size_of::<Option<Box<Point>>>());
    println!("Vec<Point>: {} bytes", mem::size_of::<Vec<Point>>());
}
```

Predict the sizes before running. Then run and check.

### Exercise 3: Stack overflow experiment

```rust
fn deep_recursion(depth: u64) -> u64 {
    if depth == 0 {
        return 0;
    }
    let padding = [0u8; 1024];
    let _ = &padding;
    deep_recursion(depth - 1) + 1
}

fn main() {
    let max = deep_recursion(100_000);
    println!("Reached depth: {}", max);
}
```

This will overflow. Each frame uses at least 1024 bytes (the `padding` array).
With 8 MB stack / 1024 bytes per frame, you can get roughly 8192 frames deep.
Try reducing the array size and see how much deeper you can go.

### Exercise 4: Compare stack vs heap performance

```rust
use std::time::Instant;

fn stack_heavy() {
    for _ in 0..1_000_000 {
        let arr = [0u8; 256];
        std::hint::black_box(&arr);
    }
}

fn heap_heavy() {
    for _ in 0..1_000_000 {
        let v = vec![0u8; 256];
        std::hint::black_box(&v);
    }
}

fn main() {
    let start = Instant::now();
    stack_heavy();
    println!("Stack: {:?}", start.elapsed());

    let start = Instant::now();
    heap_heavy();
    println!("Heap:  {:?}", start.elapsed());
}
```

Run with `cargo run --release`. The stack version should be dramatically faster
because it doesn't involve the allocator at all.

### Exercise 5: Thinking questions
1. Why does Rust's `String` store capacity separately from length?
2. If you have a `Vec<Vec<String>>`, how many heap allocations are there for
   a vec containing 3 inner vecs, each with 2 strings?
3. Why are references (`&T`) always 8 bytes on a 64-bit system, regardless
   of what T is?

---

Next: [Lesson 05: Threads — Doing Multiple Things in One Process](./05-threads.md)
