# Lesson 02: Stack and Heap — Where Your Data Lives

> **The one thing to remember**: The stack is a pile of cafeteria trays —
> fast, automatic, but limited. The heap is a warehouse with numbered
> lockers — flexible, but you need to manage checkout and return.

---

## The Two Parts of Your Program's Memory

When your program runs, the OS gives it a chunk of memory. This memory
is divided into sections, and the two most important ones are the
**stack** and the **heap**.

```
PROCESS MEMORY LAYOUT

  High addresses
  +---------------------------+
  |         STACK             |  ← Grows DOWNWARD
  |  (function calls,         |    Like a pile of trays growing down
  |   local variables)        |    from the ceiling
  |           ↓               |
  |                           |
  |   (free space between)    |
  |                           |
  |           ↑               |
  |         HEAP              |  ← Grows UPWARD
  |  (dynamically allocated   |    Like boxes stacking up
  |   data: String, Vec, etc.)|    from the floor
  +---------------------------+
  |   BSS (uninitialized      |
  |   global/static vars)     |
  +---------------------------+
  |   DATA (initialized       |
  |   global/static vars)     |
  +---------------------------+
  |   TEXT (your compiled      |
  |   code — the instructions)|
  +---------------------------+
  Low addresses
```

Stack grows down, heap grows up. They grow toward each other.
If they meet, you're out of memory.

---

## The Stack: A Pile of Cafeteria Trays

### The Analogy

Imagine a cafeteria with a spring-loaded tray dispenser:
- You can only take the **top** tray (pop)
- You can only add a tray to the **top** (push)
- You can't pull one from the middle
- When you remove a tray, the one below is now on top

The stack in your program works identically.

### Stack Frames

Every time you call a function, a new "tray" (called a **stack frame**)
is placed on top. It contains:
- The function's local variables
- The arguments passed to the function
- The **return address** (where to go back when the function ends)

```
STACK FRAMES — NESTED FUNCTION CALLS

  fn main() {                    fn add(a: i32, b: i32) -> i32 {
      let x = 10;                   let sum = a + b;
      let result = add(x, 20);      sum
      println!("{result}");      }
  }

  Step 1: main() called        Step 2: add() called        Step 3: add() returns
  +-------------------+        +-------------------+        +-------------------+
  |                   |        | add()             |        |                   |
  |                   |        |   a = 10          |        |                   |
  |                   |        |   b = 20          |        |                   |
  |                   |        |   sum = 30        |        |                   |
  |                   |  SP -> |   return addr     |        |                   |
  +-------------------+        +-------------------+        +-------------------+
  | main()            |        | main()            |        | main()            |
  |   x = 10          |        |   x = 10          |        |   x = 10          |
  |   result = ???    |        |   result = ???    |  SP -> |   result = 30     |
  +-------------------+  SP -> +-------------------+        +-------------------+

  SP = Stack Pointer (points to the top of the stack)
```

When `add()` returns, its entire stack frame is removed instantly.
No cleanup, no garbage collection. Just move the stack pointer back.
This is why the stack is so fast.

### Why the Stack Is Fast

```
Allocating on the stack:
  1. Move stack pointer down by N bytes
  That's it. ONE instruction.

Deallocating from the stack:
  1. Move stack pointer back up
  That's it. ONE instruction.

Compare to the heap:
  1. Search free list for a block of size N
  2. Split the block if it's too big
  3. Update bookkeeping data structures
  4. Return pointer
  That's dozens of instructions.
```

**Analogy**: Adding a tray to the pile (stack) vs finding an empty
locker in a warehouse (heap). The tray just goes on top. The locker
requires walking around and checking which ones are available.

### Stack Overflow: Too Many Trays

The stack has a fixed size (typically 8MB on Linux, 1MB on Windows).
If you push too many frames, you run out of stack space:

```rust
// This will crash with "stack overflow"
fn infinite_recursion() {
    infinite_recursion();  // Each call adds a frame
}                          // Never returns, frames pile up forever
```

```
Stack overflow:

  +-------------------+
  | recursion()  #8001|  ← NO ROOM! Stack overflow!
  +-------------------+
  | recursion()  #8000|
  +-------------------+
  | recursion()  #7999|
  +-------------------+
  |       ...         |
  +-------------------+
  | recursion()  #1   |
  +-------------------+
  | main()            |
  +-------------------+
```

This is why deep recursion is dangerous and why iterative solutions
are often preferred in systems programming.

---

## The Heap: A Warehouse with Lockers

### The Analogy

Imagine a huge warehouse full of numbered lockers:

1. You go to the front desk (the **allocator**) and say:
   "I need space for 100 bytes"
2. The attendant finds an empty section, gives you a **key** (pointer)
3. You can store and retrieve stuff using your key
4. When done, you return the key and the locker becomes available

```
THE HEAP

  Front Desk (Allocator)
  "I need 24 bytes"  -->  "Here's address 0x7FA0, locker #42"

  +--------+--------+--------+--------+--------+--------+
  |  Used  |  FREE  |  Used  |  Used  |  FREE  |  Used  |
  |  24B   |  48B   |  100B  |  16B   |  200B  |  64B   |
  +--------+--------+--------+--------+--------+--------+
     #40      #41      #42      #43      #44      #45

  The allocator tracks which lockers are free and which are used.
  This bookkeeping is why heap allocation is slower than stack.
```

### Why the Heap Exists

The stack is fast but has two limitations:
1. **Fixed size at compile time** — you must know how big each variable is
2. **Lifetime tied to function** — data disappears when the function returns

The heap solves both:
1. **Dynamic size** — allocate as much as you need at runtime
2. **Arbitrary lifetime** — data lives until you explicitly free it (or the GC/owner handles it)

### Fragmentation: The Parking Lot Problem

**Analogy**: Imagine a parking lot where cars come and go throughout
the day. By afternoon, there are plenty of empty spots, but they're
scattered between parked cars. You need to park a bus, but there's no
single space big enough — even though the total empty space is plenty.

```
Fragmentation:

  +----+--+----+--+----+--+--+----+--+
  |Used|  |Used|  |Used|  |  |Used|  |
  | 8B |4B| 8B |4B| 8B |4B|4B| 8B |4B|
  +----+--+----+--+----+--+--+----+--+

  Total free: 20 bytes
  Need: 16 contiguous bytes
  Result: ALLOCATION FAILED (even though there's "enough" free space)
```

This is why memory allocators are complex — they need strategies to
minimize fragmentation (coalescing free blocks, best-fit vs first-fit, etc.).

---

## Stack vs Heap in Practice

### Rust

```rust
fn main() {
    // STACK: fixed-size types
    let x: i32 = 42;           // 4 bytes on stack
    let point = (3.0, 4.0);    // 16 bytes on stack
    let arr = [1, 2, 3, 4, 5]; // 20 bytes on stack

    // HEAP: dynamically-sized types
    let name = String::from("hello");  // 24 bytes on stack (ptr, len, cap)
                                       // + 5 bytes on heap ("hello")

    let nums = vec![1, 2, 3];         // 24 bytes on stack (ptr, len, cap)
                                       // + 12 bytes on heap (three i32s)

    let boxed = Box::new(42);          // 8 bytes on stack (pointer)
                                       // + 4 bytes on heap (the i32)
}

// When main() ends:
//   - Stack frame is removed (x, point, arr pointers gone)
//   - Rust automatically calls drop() on name, nums, boxed
//   - Heap memory is freed. No garbage collector needed.
```

```
WHAT name = String::from("hello") LOOKS LIKE

  Stack                          Heap
  +------------------+           +---+---+---+---+---+
  | name             |           | h | e | l | l | o |
  |   ptr: 0x7FA0 ───────────>  | (5 bytes at 0x7FA0)|
  |   len: 5         |           +---+---+---+---+---+
  |   cap: 5         |
  +------------------+
  (24 bytes on stack)            (5 bytes on heap)
```

### Go

```go
func main() {
    // Go decides stack vs heap (escape analysis)
    x := 42                    // Stack (doesn't escape)

    name := "hello"            // String header on stack, data is
                               // in the read-only data section (literal)

    slice := []int{1, 2, 3}   // Slice header on stack,
                               // backing array on heap

    p := &x                   // If p escapes this function,
                              // Go moves x to the heap!
    fmt.Println(p)            // fmt.Println takes interface{},
                              // so p escapes → x goes to heap
}

// When main() ends:
//   - Stack is cleaned up automatically
//   - Heap data is cleaned up by the garbage collector (eventually)
```

**Key difference**: In Go, the compiler uses **escape analysis** to
decide what goes on the heap. If a value might be referenced after the
function returns, Go puts it on the heap automatically. You don't
control this explicitly.

### Python

```python
def main():
    # In Python, EVERYTHING is on the heap
    x = 42            # Creates an int OBJECT on the heap
    name = "hello"    # Creates a str OBJECT on the heap
    nums = [1, 2, 3]  # Creates a list OBJECT on the heap

    # Even x = 42 involves:
    #   1. Allocate memory for an int object on the heap
    #   2. Store the value 42 in the object
    #   3. Store a pointer to the object in the local variable table

    # (Python caches small integers -5 to 256, so x = 42 reuses
    #  a pre-allocated object. But conceptually, it's still a heap object.)

main()

# When main() ends:
#   - Local variable references are removed
#   - Reference counts on objects decrease
#   - Objects with ref count 0 are freed immediately
#   - Circular references are caught by the cycle collector (GC)
```

---

## The Three Questions

When Rust code feels confusing, ask these three questions about any value:

### 1. Where are the actual bytes?

```rust
let x = 42;                        // Bytes are on the STACK
let name = String::from("hello");   // String header on STACK,
                                    // character bytes on HEAP
let boxed = Box::new([0u8; 1000]);  // Pointer on STACK,
                                    // 1000 bytes on HEAP
```

### 2. Who owns those bytes right now?

```rust
let name = String::from("hello");  // name owns the heap data
let other = name;                  // ownership MOVES to other
// println!("{name}");             // ERROR: name no longer owns it
println!("{other}");               // other owns it now
```

### 3. What gets copied when I pass this value?

```rust
let x = 42;
let y = x;           // COPIES the 4 bytes (i32 implements Copy)
                      // Both x and y are valid

let name = String::from("hello");
let other = name;     // MOVES the 24-byte header (ptr, len, cap)
                      // The 5 heap bytes stay in place
                      // name is invalid, other owns the data
```

**Analogy**: Think of a warehouse receipt.
- The boxes are in the warehouse (heap)
- The receipt is in your hand (stack)
- Moving ownership = handing the receipt to someone else
- Cloning = paying to duplicate the actual boxes

---

## Common Misconceptions

### "Stack means fast, heap means slow"

Usually true, but too simplistic. Stack allocation IS faster because
it's just a pointer bump. But:
- Accessing data on the heap that's in cache is faster than accessing
  stack data that isn't
- A huge stack allocation (a million-element array) can blow the stack
- Small heap allocations (with a good allocator) are very fast

The real lesson: **avoid unnecessary allocation and copying**.

### "A value is either on the stack or the heap"

Many types are **split across both**:

```
String, Vec<T>, Box<T>:
  - Control structure (pointer, length, capacity) → STACK
  - Actual data (characters, elements) → HEAP

"Is String on the stack or heap?" is the WRONG question.
"Which PART lives where?" is the right question.
```

### "Moving a String copies all the characters"

No. A move copies only the 24-byte header. The heap data stays put.
Ownership changes hands, but the characters don't move.

```rust
let a = String::from("a very long string with lots of characters");
let b = a;  // Copies 24 bytes (ptr, len, cap). NOT the string data.
            // The heap characters stay at the same address.
            // a is now invalid. b is the new owner.
```

---

## Exercises

1. **Draw the memory**: For this code, draw the stack and heap,
   showing what lives where:
   ```rust
   fn main() {
       let x = 10;
       let name = String::from("Rust");
       let nums = vec![1, 2, 3];
       let y = process(&name);
   }
   fn process(s: &str) -> usize { s.len() }
   ```

2. **Stack overflow**: Write a recursive function that causes a stack
   overflow. Then rewrite it as an iterative loop.

3. **Escape analysis**: In Go, write a function that returns a pointer
   to a local variable. Does it compile? Where does the variable live?
   ```go
   func create() *int {
       x := 42
       return &x  // Does this work?
   }
   ```

4. **Ownership tracing**: For this Rust code, trace who owns the
   String at each line:
   ```rust
   let a = String::from("hello");
   let b = a;
   let c = b.clone();
   println!("{b} {c}");
   ```

---

[Next: Lesson 03 — Memory](./03-memory.md)
