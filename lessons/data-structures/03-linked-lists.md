# Lesson 03: Linked Lists — When and Why (Spoiler: Rarely in Rust)

## What Is a Linked List?

A linked list is a sequence of nodes where each node contains a value and a pointer to the next node. Unlike arrays, the nodes are **not contiguous in memory** — they can be scattered anywhere on the heap.

## The Scavenger Hunt Analogy

Imagine a scavenger hunt where each clue tells you where to find the next clue:

```
Clue #1 (at the park):
  "The answer is HELLO. Next clue is at the library."
     ↓
Clue #2 (at the library):
  "The answer is WORLD. Next clue is at the bakery."
     ↓
Clue #3 (at the bakery):
  "The answer is FOO. This is the last clue."
```

To find clue #50, you **must follow all 49 clues before it**. You can't jump directly to clue #50 because you don't know where it is until you reach clue #49.

This is fundamentally different from an array (the mailbox analogy), where you can jump directly to any position.

## Memory Layout: Array vs Linked List

```
Array (contiguous):
┌──────┬──────┬──────┬──────┬──────┐
│  10  │  20  │  30  │  40  │  50  │
└──────┴──────┴──────┴──────┴──────┘
0x1000 0x1004 0x1008 0x100C 0x1010

Access arr[3]: base + 3*4 = 0x100C → O(1)


Linked List (scattered):

0x1000         0x3048         0x2010         0x5080         0x1090
┌──────┬──┐   ┌──────┬──┐   ┌──────┬──┐   ┌──────┬──┐   ┌──────┬──────┐
│  10  │ ─┼──→│  20  │ ─┼──→│  30  │ ─┼──→│  40  │ ─┼──→│  50  │ NULL │
└──────┴──┘   └──────┴──┘   └──────┴──┘   └──────┴──┘   └──────┴──────┘
  value next    value next    value next    value next    value  next

Access 4th element: start at 0x1000 → follow to 0x3048 → follow to 0x2010
                    → follow to 0x5080 → found! O(n)
```

## Singly Linked vs Doubly Linked

### Singly Linked List

Each node has a value and a pointer to the **next** node. You can only traverse forward.

```
head
 ↓
[A] → [B] → [C] → [D] → NULL

Can go: A→B→C→D
Cannot: D→C→B→A (no backward pointers)
```

### Doubly Linked List

Each node has pointers to **both** the next and previous nodes. You can traverse in both directions.

```
NULL ← [A] ⇄ [B] ⇄ [C] ⇄ [D] → NULL
        ↑                    ↑
       head                 tail
```

```
Doubly linked node detail:

┌──────┬──────┬──────┐
│ prev │ data │ next │
│  ←   │  42  │  →   │
└──────┴──────┴──────┘
```

## Operations and Complexity

### Insert at Head — O(1)

```
Before:     head → [A] → [B] → [C] → NULL

Insert X:
1. Create node [X]
2. Point X.next → head (which is [A])
3. Update head → [X]

After:      head → [X] → [A] → [B] → [C] → NULL
```

This is O(1) because no elements need to shift. Compare with `Vec::insert(0, x)` which is O(n) because every element must shift right.

### Insert at Position — O(n)

```
Insert Y after position 1:

head → [A] → [B] → [C] → NULL
              ↑
              Found B (after traversing to position 1)

1. Create node [Y]
2. Point Y.next → B.next (which is [C])
3. Point B.next → [Y]

head → [A] → [B] → [Y] → [C] → NULL
```

Finding the position is O(n), but the actual insertion (pointer manipulation) is O(1). **If you already have a reference to the node, insertion is O(1).**

### Delete at Head — O(1)

```
Before:     head → [A] → [B] → [C] → NULL
After:      head → [B] → [C] → NULL
            (free [A])
```

### Access by Index — O(n)

```rust
fn get(head: &Node, index: usize) -> Option<&i32> {
    let mut current = Some(head);
    for _ in 0..index {
        current = current?.next.as_deref();
    }
    current.map(|node| &node.value)
}
```

You must walk the chain from the head. No random access.

### Complexity Summary

| Operation | Array/Vec | Singly Linked | Doubly Linked |
|-----------|-----------|---------------|---------------|
| Access by index | O(1) | O(n) | O(n) |
| Insert at head | O(n) | **O(1)** | **O(1)** |
| Insert at tail | O(1)* | O(n)** | **O(1)** |
| Insert at middle | O(n) | O(n)*** | O(n)*** |
| Delete at head | O(n) | **O(1)** | **O(1)** |
| Delete at tail | O(1) | O(n) | **O(1)** |
| Search | O(n) | O(n) | O(n) |
| Iteration | O(n) cache-friendly | O(n) cache-hostile | O(n) cache-hostile |

\* amortized for Vec
\** O(1) if you maintain a tail pointer
\*** O(1) if you have a reference to the preceding node

## Why Linked Lists Are Rare in Rust

### Ownership Makes Them Hard

In Rust, every value has exactly one owner. A linked list node wants to be owned by the previous node's `next` pointer, but then who owns the head? And how do you have a doubly linked list where a node is pointed to by both its previous and next nodes?

```rust
struct Node {
    value: i32,
    next: Option<Box<Node>>,  // Box = sole ownership of heap data
}
```

This works for a singly linked list with `Box`, but:
- You can't have multiple owners (needed for doubly linked lists)
- You can't easily get a mutable reference to a node deep in the list
- Deletion requires navigating from the head to find the predecessor

Doubly linked lists in safe Rust require `Rc<RefCell<Node>>` which adds runtime overhead and defeats many performance benefits:

```rust
use std::cell::RefCell;
use std::rc::Rc;

type Link = Option<Rc<RefCell<Node>>>;

struct Node {
    value: i32,
    next: Link,
    prev: Link,  // Rc allows shared ownership, RefCell allows interior mutability
}
```

This is complex, error-prone, and slower than Vec for most use cases.

### Vec Is Almost Always Better

Due to CPU cache effects, `Vec` iteration is 10-100x faster than linked list iteration on modern hardware, even though both are O(n).

```
Iterating 1 million elements:

Vec:         ~0.5ms  (sequential memory, cache-friendly)
LinkedList:  ~5-50ms (scattered memory, cache-hostile)

The cache miss penalty dominates the theoretical O(n) equivalence.
```

When you think you want a linked list for O(1) insertion, consider:
- `Vec::push()` is O(1) amortized and cache-friendly
- `VecDeque` gives O(1) push/pop at both ends
- For most real-world sizes, Vec with O(n) insert is faster than linked list O(1) insert because cache effects dominate

## When Linked Lists DO Make Sense

Despite the above, there are legitimate use cases:

### 1. LRU Cache (Lesson 15)
An LRU cache uses a doubly linked list combined with a hash map. The hash map provides O(1) lookup, and the linked list provides O(1) move-to-front and eviction.

### 2. Intrusive Lists in OS Kernels
The Linux kernel uses intrusive linked lists extensively. Each node embeds the list pointers directly in the struct, avoiding separate heap allocations.

### 3. When You Need Stable References
If you insert/remove elements frequently and other parts of your code hold references into the collection, a linked list provides **stable addresses** — existing nodes don't move when you insert/remove. Vec invalidates all pointers on resize.

### 4. Lock-Free Concurrent Data Structures
Lock-free stacks and queues often use linked list nodes with atomic pointers.

### 5. Functional Programming
Singly linked lists with shared tails (persistent data structures) are natural in functional programming. Multiple lists can share suffix nodes.

## Rust's Standard Library

Rust provides `std::collections::LinkedList<T>` — a doubly linked list. But the docs themselves say:

> It is almost always better to use Vec or VecDeque because array-based containers are generally faster, more memory efficient, and make better use of CPU cache.

```rust
use std::collections::LinkedList;

let mut list = LinkedList::new();
list.push_back(1);
list.push_back(2);
list.push_front(0);

for val in &list {
    println!("{}", val);
}

let front = list.pop_front();  // Some(0)
let back = list.pop_back();    // Some(2)
```

## Cross-Language Comparison

| | Rust | Go | TypeScript |
|---|---|---|---|
| Standard linked list | `LinkedList<T>` | `container/list` | None (implement yourself) |
| Recommendation | Use Vec/VecDeque instead | Use slices instead | Use Array |
| Doubly linked | Yes | Yes (container/list) | N/A |
| Safe implementation | Yes (but awkward) | Yes (GC handles ownership) | N/A |

Go and TypeScript have garbage collectors, which makes linked lists much easier to implement (no ownership concerns). But the performance argument for arrays still applies.

## Exercises

### Exercise 1: Implement a Singly Linked List

Build a basic singly linked list in Rust to understand the ownership challenges:

```rust
type Link = Option<Box<Node>>;

struct Node {
    value: i32,
    next: Link,
}

struct SinglyLinkedList {
    head: Link,
    len: usize,
}

impl SinglyLinkedList {
    fn new() -> Self { /* ... */ }
    fn push_front(&mut self, value: i32) { /* O(1) */ }
    fn pop_front(&mut self) -> Option<i32> { /* O(1) */ }
    fn peek_front(&self) -> Option<&i32> { /* O(1) */ }
    fn len(&self) -> usize { /* O(1) */ }
    fn is_empty(&self) -> bool { /* O(1) */ }
}
```

Key things to discover:
- Why does `push_front` need `self.head.take()`?
- Why is `pop_front` tricky with ownership?
- Why is implementing iteration challenging?

### Exercise 2: Detect a Cycle

Given a linked list that might contain a cycle, detect whether it has one using Floyd's tortoise and hare algorithm:

```
Normal:     [A] → [B] → [C] → [D] → NULL

Cycle:      [A] → [B] → [C] → [D]
                    ↑              |
                    └──────────────┘

Algorithm:
- Slow pointer moves 1 step at a time
- Fast pointer moves 2 steps at a time
- If they meet, there's a cycle
- If fast reaches NULL, no cycle
```

### Exercise 3: Vec vs LinkedList Benchmark

Write a program that compares:
1. Insert 100,000 elements at the front: `Vec::insert(0, x)` vs `LinkedList::push_front(x)`
2. Iterate through 100,000 elements: Vec vs LinkedList
3. Random access (by index) of 10,000 elements

```rust
use std::collections::LinkedList;
use std::time::Instant;

fn bench_vec_insert_front(n: usize) -> std::time::Duration {
    let start = Instant::now();
    let mut v = Vec::new();
    for i in 0..n {
        v.insert(0, i);
    }
    start.elapsed()
}

fn bench_list_insert_front(n: usize) -> std::time::Duration {
    let start = Instant::now();
    let mut list = LinkedList::new();
    for i in 0..n {
        list.push_front(i);
    }
    start.elapsed()
}
```

For insert at front, LinkedList should win. For iteration and random access, Vec should win dramatically. This exercise shows that even when the linked list wins on one operation, the overall system design usually favors Vec.

---

Next: [Lesson 04: Stacks and Queues](./04-stacks-queues.md)
