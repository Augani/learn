# Lesson 01: Arrays and Memory Layout — Contiguous vs Scattered

## Why Memory Layout Matters

Before you can understand why certain data structures are fast and others are slow, you need to understand how memory works at the hardware level. The difference between "contiguous memory" and "scattered memory" explains 90% of real-world performance differences between data structures.

## The Mailbox Analogy

Imagine a row of mailboxes at an apartment building, numbered 0 through 99:

```
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ #0 │ #1 │ #2 │ #3 │ #4 │ #5 │ #6 │ #7 │ #8 │ #9 │ ...
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑
  Start here
```

**Getting mailbox #42 is instant** — you know exactly where it is. Start at mailbox #0, walk 42 positions. No searching required. This is O(1) random access.

Now imagine a different setup: each mailbox has a note inside that says "the next mailbox is at [some random address across town]." To find the 42nd mailbox, you'd have to visit 41 mailboxes first, each one sending you to a random location. This is a linked list — O(n) access.

## Contiguous Memory: Why Arrays Are Fast

An array stores elements **side by side** in memory. Each element is the same size, so the address of element `i` is:

```
address_of(arr[i]) = base_address + (i * element_size)
```

This is a single multiplication and addition — O(1) no matter how large the array.

```
Memory layout of arr: [10, 20, 30, 40, 50]

Address:  0x1000   0x1004   0x1008   0x100C   0x1010
         ┌────────┬────────┬────────┬────────┬────────┐
         │   10   │   20   │   30   │   40   │   50   │
         └────────┴────────┴────────┴────────┴────────┘
           arr[0]   arr[1]   arr[2]   arr[3]   arr[4]

To find arr[3]: 0x1000 + (3 * 4 bytes) = 0x100C → value is 40
```

### CPU Cache Lines and Spatial Locality

Modern CPUs don't fetch one byte at a time from RAM. They fetch entire **cache lines** (typically 64 bytes). When you access `arr[0]`, the CPU loads `arr[0]` through `arr[15]` (for 4-byte integers) into the cache automatically.

```
RAM request for arr[0]:
                        ┌── CPU loads this entire 64-byte block ──┐
                        │                                          │
Address:  0x1000        v                                          v
         ┌────────┬────────┬────────┬────────┬────────┬─── ... ──┬────────┐
         │   10   │   20   │   30   │   40   │   50   │          │  160   │
         └────────┴────────┴────────┴────────┴────────┴─── ... ──┴────────┘
           arr[0]   arr[1]   arr[2]   arr[3]   arr[4]             arr[15]
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                    These are now in L1 cache — accessing them is ~1ns
                    vs ~100ns to go back to RAM
```

When you iterate through an array sequentially, almost every access is a **cache hit** — the data is already in the fastest memory on your CPU. This is called **spatial locality**.

Scattered data (like a linked list) forces a **cache miss** on almost every access, because the next element could be anywhere in RAM.

```
Sequential array iteration:        Linked list iteration:
Cache: HIT HIT HIT HIT HIT ...    Cache: MISS MISS MISS MISS MISS ...
~1ns   ~1ns ~1ns ~1ns ~1ns         ~100ns ~100ns ~100ns ~100ns ~100ns

Array iteration can be 100x faster even though both are O(n)!
```

## Fixed-Size Arrays: `[T; N]`

Rust's fixed-size array has its length baked into the type. `[i32; 5]` is a different type from `[i32; 10]`.

```rust
let scores: [i32; 5] = [90, 85, 78, 92, 88];

let zeroed: [u8; 1024] = [0; 1024];

let first = scores[0];  // O(1) access
let len = scores.len();  // 5 — known at compile time
```

Fixed arrays are stored on the **stack** (not the heap), which makes allocation and deallocation free. But the size must be known at compile time.

## Dynamic Arrays: `Vec<T>`

`Vec<T>` is Rust's growable array. It stores data on the **heap** and manages capacity automatically.

```
Stack                          Heap
┌──────────────────┐          ┌────┬────┬────┬────┬────┬────┬────┬────┐
│ ptr: 0x7F00 ─────┼────────→ │ 10 │ 20 │ 30 │ 40 │ 50 │    │    │    │
│ len: 5           │          └────┴────┴────┴────┴────┴────┴────┴────┘
│ capacity: 8      │           ←── used (len=5) ──→←── spare (cap-len) →
└──────────────────┘
```

A `Vec` is three values on the stack:
- **ptr**: pointer to heap-allocated buffer
- **len**: number of elements currently stored
- **capacity**: total slots allocated

### How Vec Grows: The Doubling Strategy

When you push an element and `len == capacity`, the Vec must grow:

1. Allocate a new buffer with **double** the capacity
2. Copy all existing elements to the new buffer
3. Free the old buffer
4. Insert the new element

```
Initial state (capacity 4, len 4):
┌────┬────┬────┬────┐
│ 10 │ 20 │ 30 │ 40 │  ← FULL!
└────┴────┴────┴────┘

Push 50 → triggers resize:

Step 1: Allocate new buffer (capacity 8):
┌────┬────┬────┬────┬────┬────┬────┬────┐
│    │    │    │    │    │    │    │    │
└────┴────┴────┴────┴────┴────┴────┴────┘

Step 2: Copy elements + insert 50:
┌────┬────┬────┬────┬────┬────┬────┬────┐
│ 10 │ 20 │ 30 │ 40 │ 50 │    │    │    │
└────┴────┴────┴────┴────┴────┴────┴────┘

Step 3: Free old buffer
```

**Amortized O(1) push**: Most pushes are O(1) (just increment len and write). Resizing is O(n) but happens exponentially less often. Over n pushes, total work is roughly 2n, so each push is O(1) on average.

```
Push sequence with capacity growth:

Push #   Capacity   Resize cost   Comment
  1         1           0         Initial alloc
  2         2           1         Copy 1 element
  3         4           2         Copy 2 elements
  4         4           0
  5         8           4         Copy 4 elements
  6-8       8           0
  9         16          8         Copy 8 elements
  10-16     16          0

Total copies after 16 pushes: 1+2+4+8 = 15
Average copies per push: 15/16 ≈ 1 → O(1) amortized
```

### Vec Operations and Complexity

```rust
let mut v: Vec<i32> = Vec::new();

v.push(42);              // O(1) amortized — append to end
v.pop();                 // O(1) — remove from end
v[3];                    // O(1) — random access by index
v.insert(2, 99);         // O(n) — must shift elements right
v.remove(2);             // O(n) — must shift elements left
v.contains(&42);         // O(n) — linear search
v.len();                 // O(1) — stored field
v.is_empty();            // O(1) — check len == 0
v.sort();                // O(n log n)
v.binary_search(&42);    // O(log n) — but data must be sorted first
```

Visualizing insert and remove:

```
v.insert(2, 99):    Insert 99 at index 2

Before: [10, 20, 30, 40, 50]
                     ↓  shift right →→→
After:  [10, 20, 99, 30, 40, 50]

v.remove(2):        Remove element at index 2

Before: [10, 20, 99, 30, 40, 50]
                     ←←← shift left
After:  [10, 20, 30, 40, 50]
```

## Slices: `&[T]`

A slice is a **view** into a contiguous sequence. It doesn't own the data — it borrows it. Slices work with both arrays and Vecs.

```rust
let arr = [1, 2, 3, 4, 5];
let slice: &[i32] = &arr[1..4]; // [2, 3, 4] — no copy!

let v = vec![10, 20, 30, 40, 50];
let slice: &[i32] = &v[2..];    // [30, 40, 50] — no copy!
```

```
Original Vec: [10, 20, 30, 40, 50]
                        ↑
Slice &v[2..]:          │
  ┌──────────────┐      │
  │ ptr ─────────┼──────┘
  │ len: 3       │
  └──────────────┘

  The slice points into the Vec's buffer. Zero allocation.
```

Slices are used heavily in function signatures because they work with any contiguous data:

```rust
fn sum(data: &[i32]) -> i32 {
    data.iter().sum()
}

let arr = [1, 2, 3];
let v = vec![4, 5, 6];

sum(&arr);      // works with arrays
sum(&v);        // works with Vecs
sum(&v[1..]);   // works with sub-slices
```

## Cross-Language Comparison

| Concept | Rust | Go | TypeScript |
|---------|------|-----|------------|
| Fixed array | `[i32; 5]` | `[5]int` | `readonly [n,n,n,n,n]` (tuple type) |
| Dynamic array | `Vec<i32>` | `[]int` (slice) | `number[]` / `Array<number>` |
| View/slice | `&[i32]` | `[]int` (slice of slice) | `Array.prototype.slice()` (copies!) |
| Capacity hint | `Vec::with_capacity(100)` | `make([]int, 0, 100)` | N/A |

Key difference: Go slices can share underlying arrays (like Rust slices), but TypeScript's `Array.slice()` creates a copy.

## When to Use What

| Structure | Use When |
|-----------|----------|
| `[T; N]` | Size known at compile time, stack allocation desired, small/fixed-size buffers |
| `Vec<T>` | Default choice for growable collections. 95% of the time, this is what you want |
| `&[T]` | Function parameters that read from any contiguous data |
| `&mut [T]` | Function parameters that modify contiguous data in place |

## Exercises

### Exercise 1: Implement a Growable Array

Build a simplified `Vec<i32>` from scratch to understand the internals:

```rust
struct MyVec {
    data: Box<[i32]>,
    len: usize,
    capacity: usize,
}

impl MyVec {
    fn new() -> Self { /* start with capacity 0 or 1 */ }
    fn push(&mut self, value: i32) { /* grow if needed */ }
    fn pop(&mut self) -> Option<i32> { /* remove last */ }
    fn get(&self, index: usize) -> Option<&i32> { /* bounds-checked access */ }
    fn len(&self) -> usize { /* return length */ }
    fn capacity(&self) -> usize { /* return capacity */ }
}
```

Requirements:
- Use `Box<[i32]>` or raw pointer + `alloc::alloc` for the buffer
- Double capacity when full (start at 1, grow to 2, 4, 8, ...)
- Implement `push`, `pop`, `get`, `len`
- Add bounds checking on `get`

### Exercise 2: Measure Cache Effects

Write a benchmark comparing sequential vs random access patterns:

```rust
use std::time::Instant;

fn sequential_sum(data: &[i64]) -> i64 {
    data.iter().sum()
}

fn random_sum(data: &[i64], indices: &[usize]) -> i64 {
    indices.iter().map(|&i| data[i]).sum()
}
```

Create a large array (10 million elements), then:
1. Sum it sequentially
2. Sum it by random indices (pre-generate random index order)
3. Compare the times — the random version should be significantly slower

### Exercise 3: Insert Performance

Benchmark inserting 100,000 elements at the beginning vs the end of a Vec:

```rust
fn insert_at_end(n: usize) -> Vec<i32> {
    let mut v = Vec::new();
    for i in 0..n as i32 {
        v.push(i); // O(1) amortized
    }
    v
}

fn insert_at_beginning(n: usize) -> Vec<i32> {
    let mut v = Vec::new();
    for i in 0..n as i32 {
        v.insert(0, i); // O(n) each time!
    }
    v
}
```

Predict the time difference before running. How much slower is inserting at the beginning?

---

Next: [Lesson 02: Big-O Notation](./02-big-o.md)
