# Lesson 03: Arrays and Dynamic Arrays

> **Analogy**: Imagine a theater row with assigned seating. Every
> seat has a number, and you can walk directly to seat #47 without
> checking any other seat — that's an array. But the row has a
> fixed number of seats. If the show sells out and you need more,
> you can't just squeeze in extra chairs — you have to move
> everyone to a bigger row. That's the core tension of arrays:
> instant access to any seat, but rigid capacity.

---

## Why This Matters

Arrays are the most fundamental data structure in computing. Every
language has them. Most other data structures are built on top of
them (hash tables, heaps, stacks, queues). Understanding how
arrays work at the memory level — and why dynamic arrays resize
the way they do — gives you the foundation for everything that
follows.

By the end of this lesson, you'll understand:

- Why contiguous memory layout enables O(1) indexing
- The difference between static and dynamic arrays
- Why dynamic arrays double in size (not grow by one)
- How to analyze the amortized cost of appends
- Why arrays are cache-friendly and what that means in practice
- The trade-offs that make arrays the default choice — and when
  they're not

> **Cross-reference**: The existing data structures track covers
> arrays and memory layout from a Rust-focused perspective. See
> [Arrays and Memory Layout](../data-structures/01-arrays-memory.md)
> for a complementary treatment with deeper cache-line analysis.

---

## The Theater Row Analogy — Deeper

Picture a theater with one long row of numbered seats:

```
Seat:    0     1     2     3     4     5     6     7
       ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
       │Alice│ Bob │Carol│Dave │ Eve │     │     │     │
       └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
         ▲                               ▲
         │                               │
       occupied                        empty seats
       (5 people)                      (capacity = 8)
```

Key properties of this arrangement:

- **Direct access**: "Who's in seat 3?" → Dave. No scanning needed.
- **Ordered**: People sit in the order they arrived (or were assigned).
- **Fixed capacity**: The row has 8 seats. Period.
- **Insertion is awkward**: Want to seat someone between Bob and
  Carol? Everyone from Carol onward must shift right one seat.

Now imagine the show is a hit. All 8 seats fill up, and more
people want in. You can't add seats to this row — the walls are
in the way. Your only option:

1. Find a bigger row (say, 16 seats) in another part of the theater
2. Move everyone from the old row to the new row
3. Seat the new person

That's exactly how dynamic arrays work.

---

## Contiguous Memory Layout

An array stores elements **side by side** in a single block of
memory. Each element occupies the same number of bytes, so the
address of any element is a simple calculation:

```
address(arr[i]) = base_address + (i × element_size)
```

This is why array indexing is O(1) — it's just arithmetic.

```
Array: [10, 20, 30, 40, 50]

Address:  0x100  0x104  0x108  0x10C  0x110
         ┌──────┬──────┬──────┬──────┬──────┐
         │  10  │  20  │  30  │  40  │  50  │
         └──────┴──────┴──────┴──────┴──────┘
           [0]    [1]    [2]    [3]    [4]

  arr[3] = 0x100 + (3 × 4 bytes) = 0x10C → value: 40
  One multiplication, one addition. Done.
```

Compare this to a linked list, where finding element [3] means
following 3 pointers through scattered memory locations. The
array wins because the math replaces the walking.

### Why Contiguous Matters for Cache Performance

Modern CPUs don't fetch individual bytes from RAM. They fetch
**cache lines** — typically 64 bytes at a time. When you access
`arr[0]`, the CPU loads a chunk of nearby memory into its cache.
If `arr[1]` through `arr[15]` are right next to `arr[0]` (which
they are, because the array is contiguous), they're already in
the cache when you need them.

```
Cache line fetch when accessing arr[0]:

  RAM:
  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
  │  10  │  20  │  30  │  40  │  50  │  60  │  70  │  80  │
  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘

  CPU requests arr[0] (value 10)
  RAM sends entire 64-byte cache line:
  ┌──────────────────────────────────────────────────────┐
  │  10 │ 20 │ 30 │ 40 │ 50 │ 60 │ 70 │ 80 │ ...       │
  └──────────────────────────────────────────────────────┘
  └──────── all of these are now "free" to access ───────┘

  Iterating through the array → almost every access is a
  cache hit → 10-100× faster than scattered memory access.
```

This is called **spatial locality**, and it's why iterating
through an array is one of the fastest things a computer can do.
Linked lists, by contrast, scatter nodes across the heap — each
access is likely a cache miss.

---

## Static Arrays vs Dynamic Arrays

### Static Arrays

A static array has a fixed size determined at creation time. You
can't add or remove elements — only read and write to existing
slots.

```
Static array of size 5:

  ┌──────┬──────┬──────┬──────┬──────┐
  │  10  │  20  │  30  │  40  │  50  │
  └──────┴──────┴──────┴──────┴──────┘
    [0]    [1]    [2]    [3]    [4]

  arr[2] = 99  →  O(1), just overwrite

  ┌──────┬──────┬──────┬──────┬──────┐
  │  10  │  20  │  99  │  40  │  50  │
  └──────┴──────┴──────┴──────┴──────┘

  Want to add a 6th element? Can't. The block is full.
```

Static arrays are used when you know the size upfront: a chess
board (8×8), RGB pixel values (3 channels), days of the week (7).

### Dynamic Arrays

A dynamic array wraps a static array and handles resizing
automatically. It tracks two numbers:

- **length**: how many elements are currently stored
- **capacity**: how many elements the underlying array can hold

```
Dynamic array — length: 5, capacity: 8

  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
  │  10  │  20  │  30  │  40  │  50  │      │      │      │
  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
    [0]    [1]    [2]    [3]    [4]    [5]    [6]    [7]
  ◄──────── used (length=5) ────────►◄── spare capacity ──►
```

Appending when there's spare capacity is O(1) — just write to
the next slot and increment the length. But what happens when
the array is full?

---

## Resizing: The Doubling Strategy

When a dynamic array runs out of capacity, it must resize. The
process is:

1. Allocate a new array with **double** the current capacity
2. Copy all existing elements to the new array
3. Free the old array
4. Add the new element

```
BEFORE RESIZE — length: 8, capacity: 8 (FULL)

  Old array:
  ┌────┬────┬────┬────┬────┬────┬────┬────┐
  │ 10 │ 20 │ 30 │ 40 │ 50 │ 60 │ 70 │ 80 │
  └────┴────┴────┴────┴────┴────┴────┴────┘
  capacity = 8, length = 8  →  NO ROOM for element 90


RESIZE STEP 1: Allocate new array with capacity 16

  New array:
  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
  │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │
  └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘


RESIZE STEP 2: Copy all 8 elements

  New array:
  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
  │ 10 │ 20 │ 30 │ 40 │ 50 │ 60 │ 70 │ 80 │    │    │    │    │    │    │    │    │
  └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ◄──────── copied from old array ────────►


RESIZE STEP 3: Free old array, add element 90

  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
  │ 10 │ 20 │ 30 │ 40 │ 50 │ 60 │ 70 │ 80 │ 90 │    │    │    │    │    │    │    │
  └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
  length = 9, capacity = 16
```

That resize was expensive — we copied 8 elements. But now we have
7 empty slots. The next 7 appends are all O(1). This is the key
insight behind the doubling strategy.

---

## Amortized Analysis of Appends

A single append to a dynamic array is either:
- **O(1)** — there's room, just write and increment
- **O(n)** — no room, must resize (copy n elements) then write

The worst case is O(n), but that's misleading. Resizes happen
rarely, and each resize buys you many cheap appends. To get the
true cost, we use **amortized analysis**: spread the total cost
of a sequence of operations evenly across all operations.

### The Accounting Argument

Think of each append as costing $1 for the write itself. But
we'll "charge" each append $3 instead, banking the extra $2:

- $1 pays for the current write
- $1 is saved to pay for copying *this* element during a future resize
- $1 is saved to pay for copying an *older* element that was
  already present when this element arrived

When a resize happens, the banked dollars pay for all the copying.
The math works out perfectly with doubling.

### Amortized Cost Diagram

```
Append operations to a dynamic array (starting capacity = 1):

  Operation    Capacity   Actual Cost    Amortized Cost
  ─────────    ────────   ───────────    ──────────────
  append(1)    1 → 1      1 (write)      $3
  append(2)    1 → 2      1+1 (resize)   $3
  append(3)    2 → 4      1+2 (resize)   $3
  append(4)    4           1 (write)      $3
  append(5)    4 → 8      1+4 (resize)   $3
  append(6)    8           1 (write)      $3
  append(7)    8           1 (write)      $3
  append(8)    8           1 (write)      $3
  append(9)    8 → 16     1+8 (resize)   $3

  Cost visualization (actual cost per operation):

  Cost
   9 │                                          █
   8 │                                          █
   7 │                                          █
   6 │                                          █
   5 │                    █                     █
   4 │                    █                     █
   3 │          █         █                     █
   2 │    █     █         █                     █
   1 │ █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █
   0 └──────────────────────────────────────────────────
     1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16
                      Operation number

  Most operations cost 1. Occasional spikes (resizes) are
  expensive, but they happen less and less frequently.

  Total cost for 16 operations: 16 + (1+2+4+8) = 31
  Average cost per operation: 31/16 ≈ 1.94 → O(1) amortized
```

The total cost of n appends is at most 3n, so the amortized cost
per append is O(1). The occasional O(n) resize is "paid for" by
the many O(1) appends that follow it.

---

## Technical Deep-Dive: Implementing a Dynamic Array

Let's build a minimal dynamic array from scratch in all three
languages to see the resize logic in action.

### Python

```python
# Python — dynamic array from scratch
class DynamicArray:
    def __init__(self):
        self._capacity = 1
        self._length = 0
        self._data = [None] * self._capacity

    def __len__(self):
        return self._length

    def __getitem__(self, index):
        if index < 0 or index >= self._length:
            raise IndexError("index out of bounds")
        return self._data[index]

    def append(self, value):
        if self._length == self._capacity:
            self._resize(self._capacity * 2)
        self._data[self._length] = value
        self._length += 1

    def _resize(self, new_capacity):
        new_data = [None] * new_capacity
        for i in range(self._length):
            new_data[i] = self._data[i]
        self._data = new_data
        self._capacity = new_capacity

    def __repr__(self):
        items = [str(self._data[i]) for i in range(self._length)]
        return f"DynamicArray([{', '.join(items)}], len={self._length}, cap={self._capacity})"


# Usage
arr = DynamicArray()
for i in range(1, 10):
    arr.append(i * 10)
    print(arr)

# Output shows capacity doubling: 1 → 2 → 4 → 8 → 16
```

Note: Python's built-in `list` is already a dynamic array. The
implementation above is for learning — in practice, just use
`list.append()`.

### TypeScript

```typescript
// TypeScript — dynamic array from scratch
class DynamicArray<T> {
  private data: (T | undefined)[];
  private length_: number;
  private capacity: number;

  constructor() {
    this.capacity = 1;
    this.length_ = 0;
    this.data = new Array(this.capacity);
  }

  get length(): number {
    return this.length_;
  }

  get(index: number): T {
    if (index < 0 || index >= this.length_) {
      throw new RangeError("Index out of bounds");
    }
    return this.data[index] as T;
  }

  append(value: T): void {
    if (this.length_ === this.capacity) {
      this.resize(this.capacity * 2);
    }
    this.data[this.length_] = value;
    this.length_++;
  }

  private resize(newCapacity: number): void {
    const newData = new Array<T | undefined>(newCapacity);
    for (let i = 0; i < this.length_; i++) {
      newData[i] = this.data[i];
    }
    this.data = newData;
    this.capacity = newCapacity;
  }

  toString(): string {
    const items = [];
    for (let i = 0; i < this.length_; i++) {
      items.push(this.data[i]);
    }
    return `DynamicArray([${items.join(", ")}], len=${this.length_}, cap=${this.capacity})`;
  }
}

// Usage
const arr = new DynamicArray<number>();
for (let i = 1; i <= 9; i++) {
  arr.append(i * 10);
  console.log(arr.toString());
}
```

Note: JavaScript/TypeScript arrays are already dynamic. This
implementation demonstrates the underlying mechanics.

### Rust

```rust
// Rust — dynamic array from scratch (simplified Vec)
struct DynamicArray<T> {
    data: Vec<Option<T>>,  // using Vec<Option<T>> for simplicity
    length: usize,
    capacity: usize,
}

impl<T: Clone + std::fmt::Debug> DynamicArray<T> {
    fn new() -> Self {
        DynamicArray {
            data: vec![None; 1],
            capacity: 1,
            length: 0,
        }
    }

    fn len(&self) -> usize {
        self.length
    }

    fn get(&self, index: usize) -> Option<&T> {
        if index >= self.length {
            return None;
        }
        self.data[index].as_ref()
    }

    fn append(&mut self, value: T) {
        if self.length == self.capacity {
            self.resize(self.capacity * 2);
        }
        self.data[self.length] = Some(value);
        self.length += 1;
    }

    fn resize(&mut self, new_capacity: usize) {
        let mut new_data = vec![None; new_capacity];
        for i in 0..self.length {
            new_data[i] = self.data[i].clone();
        }
        self.data = new_data;
        self.capacity = new_capacity;
    }
}

impl<T: Clone + std::fmt::Debug> std::fmt::Display for DynamicArray<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let items: Vec<String> = (0..self.length)
            .map(|i| format!("{:?}", self.data[i].as_ref().unwrap()))
            .collect();
        write!(f, "DynamicArray([{}], len={}, cap={})",
            items.join(", "), self.length, self.capacity)
    }
}

fn main() {
    let mut arr = DynamicArray::new();
    for i in 1..=9 {
        arr.append(i * 10);
        println!("{}", arr);
    }
}
```

Note: Rust's `Vec<T>` is the standard dynamic array. It uses a
similar doubling strategy internally. The implementation above
is pedagogical — in practice, use `Vec::push()`.

---

## Operation Complexity Summary

```
┌──────────────────────┬────────────┬────────────────────────┐
│ Operation            │ Time       │ Notes                  │
├──────────────────────┼────────────┼────────────────────────┤
│ Access by index      │ O(1)       │ Pointer arithmetic     │
│ Set by index         │ O(1)       │ Pointer arithmetic     │
│ Append (amortized)   │ O(1)*      │ Occasional O(n) resize │
│ Insert at position i │ O(n)       │ Shift elements right   │
│ Delete at position i │ O(n)       │ Shift elements left    │
│ Search (unsorted)    │ O(n)       │ Linear scan            │
│ Search (sorted)      │ O(log n)   │ Binary search          │
│ Space                │ O(n)       │ Plus unused capacity   │
└──────────────────────┴────────────┴────────────────────────┘
  * amortized O(1) with doubling strategy
```

---

## What If We Allocated One Extra Slot at a Time?

This is the natural first idea: when the array is full, grow it
by exactly one slot. It seems efficient — no wasted space! Let's
see what happens.

### The Increment-by-One Strategy

```
Start: capacity = 1

  append(10): capacity 1 → 1, write.          Cost: 1
  append(20): FULL. capacity 1 → 2, copy 1.   Cost: 1 + 1 = 2
  append(30): FULL. capacity 2 → 3, copy 2.   Cost: 1 + 2 = 3
  append(40): FULL. capacity 3 → 4, copy 3.   Cost: 1 + 3 = 4
  append(50): FULL. capacity 4 → 5, copy 4.   Cost: 1 + 4 = 5
  ...
  append(n):  FULL. capacity (n-1) → n, copy (n-1). Cost: n
```

Every single append triggers a resize. The total cost for n
appends:

```
Total = 1 + 2 + 3 + 4 + ... + n = n(n+1)/2 ≈ n²/2

Amortized cost per append = n²/2 ÷ n = n/2 → O(n)
```

That's terrible. Each append costs O(n) on average, making n
appends cost O(n²) total.

### Doubling vs Increment-by-One

```
Strategy comparison for n = 1,000 appends:

  Increment by 1:
    Total copies ≈ 1 + 2 + 3 + ... + 1000 = 500,500
    Wasted space: 0 (perfect fit)

  Doubling:
    Total copies ≈ 1 + 2 + 4 + 8 + ... + 512 = 1,023
    Wasted space: up to 50% of capacity

  ┌──────────────────┬──────────────┬──────────────┐
  │                  │ Increment +1 │ Doubling     │
  ├──────────────────┼──────────────┼──────────────┤
  │ Total copies     │ ~500,000     │ ~1,000       │
  │ Amortized append │ O(n)         │ O(1)         │
  │ Wasted space     │ 0            │ up to ~n     │
  │ n appends total  │ O(n²)        │ O(n)         │
  └──────────────────┴──────────────┴──────────────┘
```

Doubling uses more memory (up to 2× what's needed) but makes
appends 500× faster for 1,000 elements. The trade-off is
overwhelmingly in favor of doubling. This is why every major
language's dynamic array — Python's `list`, JavaScript's `Array`,
Rust's `Vec`, Java's `ArrayList`, C++'s `std::vector` — uses a
multiplicative growth strategy.

### What About Growing by 1.5×?

Some implementations (like C++'s `std::vector` in certain
compilers) grow by 1.5× instead of 2×. The amortized cost is
still O(1) — any constant multiplicative factor works. The
trade-off:

- **2× growth**: fewer resizes, more wasted space (up to 50%)
- **1.5× growth**: more resizes, less wasted space (up to 33%)

Both are O(1) amortized. The choice is an engineering decision,
not an algorithmic one.

---

## Exercises

1. **Index calculation**: An array of 64-bit integers (8 bytes
   each) starts at memory address `0x2000`. What is the memory
   address of element `arr[12]`? What about `arr[0]`?

2. **Resize trace**: Starting with a dynamic array of capacity 2,
   trace the state (length, capacity, and contents) after each of
   these operations: `append(5)`, `append(10)`, `append(15)`,
   `append(20)`, `append(25)`. When does each resize happen?

3. **Amortized cost calculation**: If a dynamic array starts with
   capacity 1 and you perform 32 appends, how many total element
   copies occur due to resizing? What is the amortized cost per
   append? (Hint: resizes happen at sizes 1, 2, 4, 8, 16.)

4. **Cache experiment**: Write a program that creates a large
   array (1 million integers) and a linked list with the same
   elements. Time how long it takes to sum all elements in each.
   Run it several times. Which is faster, and by how much? Why?

5. **Growth factor analysis**: Suppose a dynamic array uses a
   growth factor of 3× (triples capacity on resize). Starting
   from capacity 1, how many resizes occur for 100 appends?
   What's the maximum wasted space as a fraction of capacity?
   Compare to the 2× strategy.

6. **Insert-at-front cost**: You need to repeatedly insert
   elements at the *beginning* of a dynamic array (not the end).
   What is the time complexity of each insertion? What is the
   total cost of n insertions at the front? Why might a different
   data structure be better for this use case? (Hint: Lesson 04
   covers linked lists.)

---

**Previous**: [Lesson 02 — Computational Complexity: Big-O and Beyond](./02-computational-complexity.md)
**Next**: [Lesson 04 — Linked Lists: Singly, Doubly, and Circular](./04-linked-lists.md)
