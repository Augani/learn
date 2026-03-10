# Lesson 01: How a Computer Runs Your Program

> **The one thing to remember**: Your computer is a chef following a
> recipe. The CPU does the work, RAM is the countertop, and the disk
> is the pantry. Everything your program does is just the chef reading
> instructions and moving ingredients around.

---

## The Kitchen Analogy

```
YOUR COMPUTER AS A KITCHEN

  +------------------+
  |    CPU (Chef)     |  Does the actual work: math, logic, decisions
  |  +------+        |  Can only work on a few things at once
  |  | Regs |        |  (the chef's hands)
  |  +------+        |
  |  +-----------+   |
  |  | L1 Cache  |   |  Apron pocket: tiny but instant access (~1ns)
  |  +-----------+   |
  |  +-----------+   |
  |  | L2 Cache  |   |  Nearby shelf: small but very fast (~4ns)
  |  +-----------+   |
  |  +-----------+   |
  |  | L3 Cache  |   |  Kitchen counter: bigger, still fast (~12ns)
  |  +-----------+   |
  +------------------+
          |
          v
  +------------------+
  |   RAM (Counter)   |  The workspace. Fast, limited, volatile.
  |   ~8-64 GB        |  Everything disappears when power is off.
  |   ~100ns access   |  Like a big countertop — room for active work.
  +------------------+
          |
          v
  +------------------+
  |  SSD/HDD (Pantry) | Lots of space, persistent, but SLOW.
  |  256GB - 4TB       | SSD: ~100,000ns (100μs)
  |                    | HDD: ~10,000,000ns (10ms)
  +------------------+
```

Notice the latency numbers. If L1 cache access is 1 second in human
terms, then:

```
LATENCY AT HUMAN SCALE (if L1 = 1 second)

  L1 cache:      1 second       (grabbing something from your pocket)
  L2 cache:      4 seconds      (reaching to a nearby shelf)
  L3 cache:      12 seconds     (walking to the counter)
  RAM:           1.5 minutes    (walking to another room)
  SSD:           1.5 days       (ordering from a nearby warehouse)
  HDD:           3 months       (ordering from overseas)
  Network:       4+ years       (sending a letter to Mars)
```

This is why performance-aware programmers care about **cache-friendly
code**. The difference between hitting cache and missing to RAM is the
difference between grabbing something from your pocket versus walking
to another room.

---

## The CPU: Your Program's Chef

The CPU (Central Processing Unit) is the brain. But it's a very simple
brain — it can only do one tiny thing at a time:

1. **Fetch** an instruction from memory
2. **Decode** what the instruction means
3. **Execute** the instruction
4. Repeat. Billions of times per second.

```
THE FETCH-DECODE-EXECUTE CYCLE

  Like a chef reading a recipe card one step at a time:

  +--------+     +---------+     +---------+
  | FETCH  |---->| DECODE  |---->| EXECUTE |---+
  | Read   |     | What    |     | Do the  |   |
  | next   |     | does it |     | work    |   |
  | recipe |     | mean?   |     |         |   |
  | step   |     |         |     |         |   |
  +--------+     +---------+     +---------+   |
      ^                                        |
      |                                        |
      +----------------------------------------+
                  repeat forever
```

**Clock speed** is the metronome. A 3 GHz CPU ticks 3 billion times
per second. Each tick, the chef does one step. Faster clock = faster
chef (mostly).

### Registers: The Chef's Hands

The CPU has a tiny number of **registers** — typically 16-32 of them,
each holding one number (64 bits on modern CPUs). These are the chef's
hands: the fastest possible storage, but you can only hold a few things.

```
CPU REGISTERS (x86-64, simplified)

  +------+  +------+  +------+  +------+
  | RAX  |  | RBX  |  | RCX  |  | RDX  |
  | (64b)|  | (64b)|  | (64b)|  | (64b)|
  +------+  +------+  +------+  +------+
  General-purpose: hold values being computed

  +------+
  | RIP  |  Instruction Pointer: "which recipe step am I on?"
  +------+
  +------+
  | RSP  |  Stack Pointer: "where's the top of my stack?"
  +------+
  +------+
  | RFLAGS|  Flags: "was the last result zero? negative? overflow?"
  +------+
```

Every computation goes through registers. To add two numbers from RAM:
1. Load first number from RAM into register RAX
2. Load second number from RAM into register RBX
3. Add RAX + RBX, store result in RAX
4. Store RAX back to RAM

That's four operations for one addition. This is why compilers work
so hard to keep frequently-used values in registers.

---

## Cache: The Speed Secret

Modern CPUs are so fast that RAM can't keep up. If the CPU had to wait
for RAM every time, it would be idle 99% of the time. Caches solve this.

```
THE MEMORY HIERARCHY

  Speed      Size       Cost
  ↑ fast     ↑ tiny     ↑ expensive
  |          |          |
  | Regs     | ~1 KB    | $$$$$$
  | L1       | ~64 KB   | $$$$$
  | L2       | ~256 KB  | $$$$
  | L3       | ~8 MB    | $$$
  | RAM      | ~16 GB   | $$
  | SSD      | ~512 GB  | $
  ↓ slow     ↓ huge     ↓ cheap
```

### How Cache Works: The Chef's Trick

When the chef needs an ingredient (data), they check:
1. Is it in my apron pocket (L1)? → Use it instantly
2. Not there? Check the nearby shelf (L2) → Quick grab
3. Not there? Check the kitchen counter (L3) → Walk over
4. Not there? Go to the pantry (RAM) → Leave the kitchen

**The key insight**: when the chef fetches something from the pantry,
they don't just grab the one ingredient — they grab a whole tray of
nearby ingredients (a **cache line**, typically 64 bytes). Because
if you needed ingredient #5, you'll probably need #6, #7, #8 soon.

This is called **spatial locality**. And it's why iterating through
an array is fast (elements are next to each other in memory) but
following pointers in a linked list is slow (nodes are scattered
randomly in memory).

```rust
// FAST: array elements are contiguous in memory
// Each cache line fetch brings in multiple elements
let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8];
let sum: i32 = numbers.iter().sum();

// SLOW: linked list nodes are scattered across the heap
// Each node might cause a cache miss
// (This is why Vec is almost always faster than LinkedList in Rust)
```

---

## Your Program Is Just Numbers

This is the mind-bending part: **everything in your computer is numbers**.

- The number `65` means the letter `A` (in ASCII)
- The number `0x48 0x89 0xE5` means "copy RSP to RBP" (a CPU instruction)
- The number `0xFF0000` means the color red (in RGB)
- The number `3.14159` is stored as `0x40490FDB` (in IEEE 754)

The CPU doesn't know the difference. It just processes numbers. The
**meaning** depends on how your program interprets them.

```
THE SAME BYTES, DIFFERENT MEANINGS

  Bytes: 01000001

  As an integer:  65
  As a character: 'A'
  As an instruction: (part of a CPU instruction)
  As a color component: a specific shade of blue

  The computer doesn't know which one it is.
  YOUR PROGRAM decides.
```

This is the **Von Neumann architecture**: both your program's
instructions AND the data it operates on live in the same memory.
The CPU fetches instructions from memory, and those instructions
tell the CPU to read/write data in the same memory.

```
VON NEUMANN ARCHITECTURE

  +---------+           +------------------+
  |  CPU    |<--------->|     Memory       |
  |         |  address  |                  |
  |  fetch  |  bus      | Instructions:    |
  |  decode |           |   add r1, r2     |
  |  execute|  data     |   load r3, [100] |
  |         |  bus      |   store [200], r1|
  |         |           |                  |
  |         |           | Data:            |
  |         |           |   x = 42         |
  |         |           |   name = "Ada"   |
  +---------+           +------------------+

  Instructions and data share the same memory.
  This is both powerful (self-modifying code is possible)
  and dangerous (buffer overflows can overwrite instructions).
```

---

## What Happens When You Run a Program

Let's trace what happens when you type `./my_program`:

```
1. SHELL asks the OS: "Run this file"

2. OS LOADER:
   - Opens the binary file on disk
   - Reads the headers (what sections exist, where to load)
   - Creates a new process (virtual address space)
   - Maps the code section into memory
   - Maps the data section into memory
   - Sets up the stack
   - Sets the instruction pointer (RIP) to the entry point

3. CPU starts executing:
   - Fetches instruction at RIP
   - Decodes it
   - Executes it
   - Increments RIP
   - Repeat until the program calls exit()

4. OS CLEANUP:
   - Frees all memory
   - Closes all open files
   - Reports exit code to parent process
```

In Rust, this looks like:

```rust
fn main() {
    // By the time this runs, the OS has already:
    // 1. Loaded the binary into memory
    // 2. Set up the stack (default ~8MB)
    // 3. Initialized the Rust runtime (minimal)
    // 4. Called main()

    let x = 42;          // Store 42 on the stack
    let y = x + 1;       // Load x, add 1, store on stack
    println!("{y}");      // Many function calls, heap allocation, I/O syscall
}
// main returns → Rust runtime runs destructors → OS cleans up
```

In Go:

```go
func main() {
    // Go's runtime has already:
    // 1. Set up the garbage collector
    // 2. Started the scheduler
    // 3. Created the main goroutine
    // 4. Called main()

    x := 42
    y := x + 1
    fmt.Println(y)
}
```

In Python:

```python
# Python works differently:
# 1. The `python` interpreter binary is loaded (steps above)
# 2. The interpreter READS your .py file as text
# 3. Compiles it to bytecode (.pyc)
# 4. The interpreter executes bytecode one instruction at a time

x = 42           # Create an int object on the heap (!)
y = x + 1        # Create ANOTHER int object on the heap
print(y)         # More objects, function calls
```

Notice how Python puts even simple integers on the heap as objects.
This is why Python is ~100x slower than Rust for computation-heavy
work. The CPU is doing the same fetch-decode-execute cycle, but
Python's instructions are "interpret this bytecode" rather than
"add these two registers."

---

## Why This All Matters

Understanding the memory hierarchy explains:

- **Why arrays are faster than linked lists** — cache locality
- **Why Rust is fast** — compiles to native machine code, no interpreter
- **Why Python is slow for math** — everything is a heap object
- **Why databases use B-trees** — minimize disk reads (the slowest tier)
- **Why GPU computing is powerful** — thousands of simple cores, massive parallelism
- **Why premature optimization is bad** — the CPU is already incredibly fast, focus on algorithmic complexity first

```
RULE OF THUMB FOR PERFORMANCE

  1. Get the algorithm right (O(n) vs O(n²) matters most)
  2. Use the right data structure (array vs hash map vs tree)
  3. Be cache-friendly (contiguous data, avoid pointer chasing)
  4. Reduce allocations (reuse buffers, use the stack)
  5. Profile before micro-optimizing (measure, don't guess)
```

---

## Exercises

1. **Mental model**: A function calls another function which calls
   a third function. Each creates two local variables. Draw the
   stack frames and label the stack pointer.

2. **Cache math**: Your L1 cache is 64KB and a cache line is 64 bytes.
   How many cache lines fit? If you iterate through a `Vec<i32>` (4
   bytes each), how many elements does one cache line hold?

3. **Latency thinking**: Your program reads 1000 random locations in
   a 1GB array. Will this mostly hit cache or miss to RAM? Why?
   What if you read 1000 sequential locations instead?

4. **Language comparison**: Write a program that sums numbers 1 to
   100 million in Rust, Go, and Python. Time each one. Can you
   explain the speed differences using what you learned?

---

[Next: Lesson 02 — Stack and Heap](./02-stack-and-heap.md)
