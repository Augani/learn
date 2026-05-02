# Lesson 06: Queues, Deques, and Circular Buffers

> **Analogy**: Picture the line at a coffee shop. The first person
> who arrives is the first person served. New customers join at
> the back, and the barista serves whoever is at the front. Nobody
> cuts the line, nobody gets served out of order. That's a queue:
> First In, First Out. It sounds obvious — but this simple
> ordering principle is the backbone of everything from CPU task
> scheduling to print job management to breadth-first search.
> When fairness and ordering matter, you reach for a queue.

---

## Why This Matters

A queue enforces FIFO (First In, First Out) ordering — the
opposite of a stack's LIFO. This matters more than you might
think:

- **CPU scheduling**: Operating systems use queues to schedule
  processes. The process that's been waiting longest gets the CPU
  next. Without FIFO, some processes could starve forever.
- **Print queues**: Documents print in the order they were
  submitted. Nobody wants their 2-page memo stuck behind a
  100-page report that arrived later.
- **BFS traversal**: Breadth-first search on graphs uses a queue
  to explore nodes level by level. This is why BFS finds shortest
  paths in unweighted graphs — it processes closer nodes first.
- **Message queues**: Systems like RabbitMQ and Kafka process
  messages in order. Financial transactions, event logs, and
  task pipelines all depend on FIFO ordering.
- **Buffering**: Network packets, keyboard input, and streaming
  data all flow through queues. Data arrives at one end and is
  consumed from the other.
- **Rate limiting**: Request queues ensure servers process
  requests fairly, preventing any single client from monopolizing
  resources.

By the end of this lesson, you'll understand:

- What FIFO means and why it matters for fairness
- Why a naive array-based queue wastes space
- How circular buffers solve the wasted-space problem
- What deques are and when you need both-end access
- How priority queues differ from regular queues
- When each variant is the right tool

> **Cross-reference**: The existing data structures track covers
> stacks and queues together from a Rust-focused perspective. See
> [Stacks & Queues](../data-structures/04-stacks-queues.md)
> for a complementary treatment.

---

## The Coffee Shop Line — Deeper

Imagine you're managing the line at a busy coffee shop:

```
  The coffee shop queue:

  Step 1: Empty shop
  FRONT ──────────────────── BACK
  (nobody in line)

  Step 2: Alice arrives
  FRONT ──────────────────── BACK
  [Alice]
   ↑ next to be served

  Step 3: Bob arrives
  FRONT ──────────────────── BACK
  [Alice] [Bob]
   ↑ served next    ↑ just joined

  Step 4: Carol arrives
  FRONT ──────────────────── BACK
  [Alice] [Bob] [Carol]

  Step 5: Serve Alice (dequeue from front)
  FRONT ──────────────────── BACK
  [Bob] [Carol]
   ↑ now first in line

  Step 6: Dave arrives (enqueue at back)
  FRONT ──────────────────── BACK
  [Bob] [Carol] [Dave]

  Bob has been waiting longest → Bob is served next.
  That's FIFO: first to arrive, first to be served.
```

Key properties:

- **Enqueue**: Join the back of the line. O(1).
- **Dequeue**: Leave from the front. O(1).
- **Peek/Front**: See who's next without serving them. O(1).
- **No middle access**: You can't serve Carol before Bob — that
  would violate FIFO ordering.

Why is FIFO important? Because **fairness requires ordering**.
If you let the most recent arrival go first (LIFO/stack), early
arrivals starve. If you serve randomly, there's no predictability.
FIFO guarantees that waiting time is proportional to arrival
time — the longer you've waited, the sooner you're served.

---

## FIFO Semantics: The Core Operations

A queue supports these operations:

```
  ┌──────────────────────────────────────────────────────┐
  │                     QUEUE                            │
  │                                                      │
  │   enqueue(x) → Add x to the back           O(1)     │
  │   dequeue()  → Remove and return the front  O(1)     │
  │   peek()     → Return the front (no remove) O(1)     │
  │   isEmpty()  → Check if queue is empty      O(1)     │
  │                                                      │
  │   Items enter at the BACK, leave from the FRONT      │
  └──────────────────────────────────────────────────────┘
```

Step-by-step trace:

```
  ENQUEUE/DEQUEUE TRACE

  Operation        Queue (front → back)    Returned
  ─────────        ────────────────────    ────────
  enqueue(10)      [10]
  enqueue(20)      [10, 20]
  enqueue(30)      [10, 20, 30]
  peek()           [10, 20, 30]            10
  dequeue()        [20, 30]                10
  dequeue()        [30]                    20
  enqueue(40)      [30, 40]
  dequeue()        [40]                    30
  dequeue()        []                      40
  dequeue()        []                      ERROR: queue empty!
```

Notice: we enqueued 10, 20, 30 and dequeued them as 10, 20, 30.
Same order in, same order out. First in, first out.

---

## The Naive Array Implementation — And Its Problem

The simplest queue implementation uses an array with two indices:
`front` (where to dequeue) and `back` (where to enqueue).

```
  NAIVE ARRAY QUEUE

  Start: front=0, back=0
  Array: [_, _, _, _, _]    (capacity 5)
          ↑
          front & back (empty)

  enqueue(10): place at back, advance back
  Array: [10, _, _, _, _]
          ↑   ↑
          f   b

  enqueue(20), enqueue(30):
  Array: [10, 20, 30, _, _]
          ↑           ↑
          f           b

  dequeue() → returns 10, advance front:
  Array: [__, 20, 30, _, _]
              ↑       ↑
              f       b

  dequeue() → returns 20, advance front:
  Array: [__, __, 30, _, _]
                  ↑   ↑
                  f   b

  enqueue(40), enqueue(50):
  Array: [__, __, 30, 40, 50]
                  ↑           ↑
                  f           b (at end!)
```

**The problem**: After dequeuing 10 and 20, those slots at
indices 0 and 1 are wasted. The back pointer has reached the end
of the array, but there are empty slots at the front. We have
two bad options:

1. **Shift everything left** after each dequeue — but that's
   O(n) per dequeue, destroying our O(1) guarantee.
2. **Resize the array** — but we're wasting existing space.

```
  THE WASTED SPACE PROBLEM

  Array: [__, __, 30, 40, 50]
          ↑   ↑               ↑
          wasted!              b (can't enqueue!)

  We have 2 empty slots but can't use them because
  the back pointer only moves forward.

  Option A: Shift everything left after dequeue
  Array: [30, 40, 50, __, __]   ← O(n) shift!
          ↑           ↑
          f           b

  Option B: Resize to a bigger array
  Array: [__, __, 30, 40, 50, __, __, __, __, __]
                                              ↑
                                              wasteful!

  Neither option is good. We need a smarter approach.
```

This is a real problem. If you're processing millions of messages
through a queue, you can't afford O(n) shifts or unbounded memory
growth. The solution? Wrap around.

---

## Circular Buffers: The Elegant Solution

A **circular buffer** (also called a ring buffer) treats the
array as if it wraps around — when the back pointer reaches the
end, it wraps to index 0. The array forms a logical circle:

```
  CIRCULAR BUFFER — CONCEPTUAL VIEW

  Think of the array as a circle, not a line:

          ┌─────┐
        ╱ │  0  │ ╲
      ╱   └─────┘   ╲
    ┌─────┐       ┌─────┐
    │  4  │       │  1  │
    └─────┘       └─────┘
      ╲   ┌─────┐   ╱
        ╲ │  3  │ ╱
          └─────┘
            │  2  │
            └─────┘

  The "front" and "back" pointers chase each other
  around the circle. When one reaches the end of the
  underlying array, it wraps to index 0.
```

The key insight: use **modular arithmetic** to wrap indices.
Instead of `back++`, use `back = (back + 1) % capacity`.

```
  CIRCULAR BUFFER — STEP BY STEP

  Capacity: 5, front=0, back=0, size=0

  Array indices:  [0]  [1]  [2]  [3]  [4]

  Step 1: enqueue(10)
  [10]  [__]  [__]  [__]  [__]
   ↑f                          back=(0+1)%5=1
        ↑b
  size=1

  Step 2: enqueue(20), enqueue(30)
  [10]  [20]  [30]  [__]  [__]
   ↑f                ↑b
  size=3

  Step 3: dequeue() → 10, front=(0+1)%5=1
  [__]  [20]  [30]  [__]  [__]
        ↑f          ↑b
  size=2

  Step 4: dequeue() → 20, front=(1+1)%5=2
  [__]  [__]  [30]  [__]  [__]
              ↑f    ↑b
  size=1

  Step 5: enqueue(40), enqueue(50), enqueue(60)
  [__]  [__]  [30]  [40]  [50]
              ↑f                 back=(4+1)%5=0
   ↑b                            ← WRAPPED AROUND!
  size=4

  Step 6: enqueue(70) — back wraps to index 1
  [60]  [__]  [30]  [40]  [50]
              ↑f
        ↑b
  size=4... wait, let's redo:

  After Step 4: size=1, front=2, back=3
  enqueue(40): array[3]=40, back=4, size=2
  enqueue(50): array[4]=50, back=(4+1)%5=0, size=3
  enqueue(60): array[0]=60, back=(0+1)%5=1, size=4

  [60]  [__]  [30]  [40]  [50]
        ↑b    ↑f
  size=4

  The back pointer WRAPPED AROUND to reuse slots 0 and 1
  that were freed by earlier dequeues. No wasted space!

  Step 7: dequeue() → 30 (from front=2), front=(2+1)%5=3
  [60]  [__]  [__]  [40]  [50]
        ↑b          ↑f
  size=3

  The front pointer chases the back pointer around the ring.
```

Why this works:

- **No wasted space**: Freed slots are reused when the pointers
  wrap around.
- **O(1) enqueue and dequeue**: Just update a pointer and use
  modular arithmetic. No shifting, no copying.
- **Fixed memory**: The buffer uses exactly `capacity` slots.
  If it fills up, you either reject new items or resize
  (doubling, like a dynamic array).

### When Is the Buffer Full vs Empty?

Both "full" and "empty" have `front == back` if we only track
pointers. Common solutions:

```
  FULL vs EMPTY DETECTION

  Option A: Track a "size" counter
  • Empty when size == 0
  • Full when size == capacity
  • Simple and clear

  Option B: Waste one slot
  • Empty when front == back
  • Full when (back + 1) % capacity == front
  • Uses capacity - 1 usable slots

  Option C: Use a boolean flag
  • Set "full" flag when back catches up to front after enqueue
  • Clear it on dequeue

  Option A is most common in practice.
```

---

## Deques: Double-Ended Queues

A **deque** (pronounced "deck") allows insertion and removal at
*both* ends. It's a generalization of both stacks and queues:

```
  DEQUE — DOUBLE-ENDED QUEUE

  push_front / pop_front          push_back / pop_back
         ↕                               ↕
  ┌────┬────┬────┬────┬────┐
  │ 10 │ 20 │ 30 │ 40 │ 50 │
  └────┴────┴────┴────┴────┘
  front                    back

  Operations:
  ┌──────────────────────────────────────────────────┐
  │ push_front(x) — Add to front              O(1)  │
  │ push_back(x)  — Add to back               O(1)  │
  │ pop_front()   — Remove from front          O(1)  │
  │ pop_back()    — Remove from back           O(1)  │
  │ peek_front()  — View front                 O(1)  │
  │ peek_back()   — View back                  O(1)  │
  └──────────────────────────────────────────────────┘

  Use as a stack:  push_back + pop_back  (LIFO)
  Use as a queue:  push_back + pop_front (FIFO)
  Use as both:     all four operations
```

Deques are typically implemented as circular buffers (just like
queues), but with the ability to move the front pointer backward
as well as forward.

### When Do You Need a Deque?

- **Sliding window maximum/minimum**: Maintain a monotonic deque
  to find the max in every window of size k in O(n) total. You
  add to the back and remove from both ends.
- **0-1 BFS**: In graphs where edge weights are only 0 or 1, use
  a deque instead of a priority queue — push weight-0 edges to
  the front, weight-1 edges to the back.
- **Work-stealing schedulers**: Threads push tasks to one end of
  their deque and steal from the other end of another thread's
  deque.
- **Palindrome checking**: Compare characters from both ends,
  popping from front and back simultaneously.

---

## Priority Queues: A Preview

A regular queue serves items in arrival order (FIFO). A
**priority queue** serves items in *priority* order — the
highest-priority item comes out first, regardless of when it
arrived.

```
  REGULAR QUEUE vs PRIORITY QUEUE

  Regular queue (FIFO):
  Enqueue: A(1st), B(2nd), C(3rd)
  Dequeue order: A, B, C  (arrival order)

  Priority queue (by priority):
  Enqueue: A(priority=3), B(priority=1), C(priority=2)
  Dequeue order: B, C, A  (lowest priority number = highest priority)

  Think: hospital emergency room
  • Regular queue: patients seen in arrival order
  • Priority queue: most critical patients seen first
```

Priority queues are NOT implemented as sorted arrays or sorted
linked lists (those would make insertion O(n)). They're
implemented using **heaps** — a tree-based structure that
maintains partial ordering. We'll cover heaps in depth in
Lesson 20.

For now, just know:

```
  ┌─────────────────────────────────────────────────────┐
  │ Priority Queue — Complexity (heap-based)            │
  │                                                     │
  │   enqueue(x, priority)  →  O(log n)                 │
  │   dequeue_min()         →  O(log n)                 │
  │   peek_min()            →  O(1)                     │
  │                                                     │
  │ Much better than sorted array:                      │
  │   enqueue → O(n) for sorted array, O(log n) for heap│
  └─────────────────────────────────────────────────────┘
```

---

## Technical Deep-Dive: Implementing Queues

### Python

```python
# Python — circular buffer queue
class CircularQueue:
    def __init__(self, capacity: int = 8):
        self._data = [None] * capacity
        self._front = 0
        self._size = 0
        self._capacity = capacity

    def enqueue(self, item):
        """Add item to back — O(1) amortized."""
        if self._size == self._capacity:
            self._resize(self._capacity * 2)
        back = (self._front + self._size) % self._capacity
        self._data[back] = item
        self._size += 1

    def dequeue(self):
        """Remove and return front item — O(1)."""
        if self.is_empty():
            raise IndexError("dequeue from empty queue")
        item = self._data[self._front]
        self._data[self._front] = None  # help GC
        self._front = (self._front + 1) % self._capacity
        self._size -= 1
        return item

    def peek(self):
        """Return front item without removing — O(1)."""
        if self.is_empty():
            raise IndexError("peek at empty queue")
        return self._data[self._front]

    def is_empty(self) -> bool:
        return self._size == 0

    def __len__(self) -> int:
        return self._size

    def _resize(self, new_capacity: int):
        """Copy elements to a new array in order."""
        new_data = [None] * new_capacity
        for i in range(self._size):
            new_data[i] = self._data[(self._front + i) % self._capacity]
        self._data = new_data
        self._front = 0
        self._capacity = new_capacity

    def __repr__(self) -> str:
        items = []
        for i in range(self._size):
            items.append(repr(self._data[(self._front + i) % self._capacity]))
        return f"CircularQueue([{', '.join(items)}])"


# Usage
q = CircularQueue(4)
q.enqueue(10)
q.enqueue(20)
q.enqueue(30)
print(q.peek())     # 10
print(q.dequeue())  # 10
print(q.dequeue())  # 20
q.enqueue(40)
q.enqueue(50)       # wraps around!
print(q)            # CircularQueue([30, 40, 50])
```

Note: In practice, use Python's `collections.deque` — it's a
highly optimized double-ended queue implemented in C. It supports
O(1) `append`, `appendleft`, `pop`, and `popleft`. For
thread-safe queues, use `queue.Queue`.

```python
from collections import deque

# collections.deque as a queue
q = deque()
q.append(10)       # enqueue
q.append(20)
q.append(30)
print(q.popleft())  # dequeue → 10
print(q.popleft())  # 20

# collections.deque as a deque
d = deque()
d.append(20)        # push_back
d.appendleft(10)    # push_front
d.append(30)        # push_back
print(d.popleft())  # pop_front → 10
print(d.pop())      # pop_back → 30
```

### TypeScript

```typescript
// TypeScript — circular buffer queue
class CircularQueue<T> {
  private data: (T | undefined)[];
  private front: number = 0;
  private count: number = 0;
  private capacity: number;

  constructor(capacity: number = 8) {
    this.capacity = capacity;
    this.data = new Array(capacity);
  }

  enqueue(item: T): void {
    if (this.count === this.capacity) {
      this.resize(this.capacity * 2);
    }
    const back = (this.front + this.count) % this.capacity;
    this.data[back] = item;
    this.count++;
  }

  dequeue(): T {
    if (this.isEmpty()) {
      throw new Error("dequeue from empty queue");
    }
    const item = this.data[this.front] as T;
    this.data[this.front] = undefined;
    this.front = (this.front + 1) % this.capacity;
    this.count--;
    return item;
  }

  peek(): T {
    if (this.isEmpty()) {
      throw new Error("peek at empty queue");
    }
    return this.data[this.front] as T;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  get length(): number {
    return this.count;
  }

  private resize(newCapacity: number): void {
    const newData = new Array<T | undefined>(newCapacity);
    for (let i = 0; i < this.count; i++) {
      newData[i] = this.data[(this.front + i) % this.capacity];
    }
    this.data = newData;
    this.front = 0;
    this.capacity = newCapacity;
  }

  toString(): string {
    const items: string[] = [];
    for (let i = 0; i < this.count; i++) {
      items.push(String(this.data[(this.front + i) % this.capacity]));
    }
    return `CircularQueue([${items.join(", ")}])`;
  }
}

// Usage
const q = new CircularQueue<number>(4);
q.enqueue(10);
q.enqueue(20);
q.enqueue(30);
console.log(q.peek());     // 10
console.log(q.dequeue());  // 10
console.log(q.dequeue());  // 20
q.enqueue(40);
q.enqueue(50);             // wraps around
console.log(q.toString()); // CircularQueue([30, 40, 50])
```

Note: JavaScript doesn't have a built-in deque. Arrays have
`push`/`pop` (back) and `unshift`/`shift` (front), but `shift`
and `unshift` are O(n) because they move all elements. For
performance-critical code, implement a circular buffer or use a
library.

### Rust

```rust
use std::collections::VecDeque;

// Rust — circular buffer queue from scratch
struct CircularQueue<T> {
    data: Vec<Option<T>>,
    front: usize,
    size: usize,
    capacity: usize,
}

impl<T: Clone> CircularQueue<T> {
    fn new(capacity: usize) -> Self {
        CircularQueue {
            data: vec![None; capacity],
            front: 0,
            size: 0,
            capacity,
        }
    }

    fn enqueue(&mut self, item: T) {
        if self.size == self.capacity {
            self.resize(self.capacity * 2);
        }
        let back = (self.front + self.size) % self.capacity;
        self.data[back] = Some(item);
        self.size += 1;
    }

    fn dequeue(&mut self) -> Option<T> {
        if self.is_empty() {
            return None;
        }
        let item = self.data[self.front].take();
        self.front = (self.front + 1) % self.capacity;
        self.size -= 1;
        item
    }

    fn peek(&self) -> Option<&T> {
        if self.is_empty() {
            return None;
        }
        self.data[self.front].as_ref()
    }

    fn is_empty(&self) -> bool {
        self.size == 0
    }

    fn len(&self) -> usize {
        self.size
    }

    fn resize(&mut self, new_capacity: usize) {
        let mut new_data = vec![None; new_capacity];
        for i in 0..self.size {
            let idx = (self.front + i) % self.capacity;
            new_data[i] = self.data[idx].take();
        }
        self.data = new_data;
        self.front = 0;
        self.capacity = new_capacity;
    }
}

fn main() {
    // From-scratch circular queue
    let mut q = CircularQueue::new(4);
    q.enqueue(10);
    q.enqueue(20);
    q.enqueue(30);
    println!("{:?}", q.peek());     // Some(10)
    println!("{:?}", q.dequeue());  // Some(10)
    println!("{:?}", q.dequeue());  // Some(20)
    q.enqueue(40);
    q.enqueue(50);                  // wraps around
    println!("size: {}", q.len()); // 3

    // Rust's standard library: VecDeque (circular buffer deque)
    let mut dq = VecDeque::new();
    dq.push_back(10);       // enqueue
    dq.push_back(20);
    dq.push_back(30);
    println!("{:?}", dq.pop_front()); // dequeue → Some(10)

    // Use as deque
    dq.push_front(5);       // push to front
    dq.push_back(40);       // push to back
    println!("{:?}", dq);   // [5, 20, 30, 40]
}
```

Note: Rust's `VecDeque<T>` is a growable circular buffer that
supports O(1) amortized push/pop at both ends. It's the standard
choice for both queues and deques in Rust. For multi-threaded
queues, see `crossbeam::deque` or `std::sync::mpsc`.

---

## Operation Complexity Summary

```
┌──────────────────────┬──────────────┬──────────────┬──────────────┐
│ Operation            │ Circular Buf │ Linked List  │ Naive Array  │
├──────────────────────┼──────────────┼──────────────┼──────────────┤
│ enqueue(x)           │ O(1) amort.  │ O(1)         │ O(1)         │
│ dequeue()            │ O(1)         │ O(1)         │ O(n) shift!  │
│ peek()               │ O(1)         │ O(1)         │ O(1)         │
│ isEmpty()            │ O(1)         │ O(1)         │ O(1)         │
│ Space per element    │ Just data    │ Data + ptr   │ Just data    │
│ Space waste          │ None         │ None         │ Grows over   │
│                      │              │              │ time         │
└──────────────────────┴──────────────┴──────────────┴──────────────┘

Deque (circular buffer):
┌──────────────────────┬──────────────┐
│ push_front(x)        │ O(1) amort.  │
│ push_back(x)         │ O(1) amort.  │
│ pop_front()          │ O(1)         │
│ pop_back()           │ O(1)         │
│ peek_front()         │ O(1)         │
│ peek_back()          │ O(1)         │
└──────────────────────┴──────────────┘
```

---

## What If We Used a Plain Array and Shifted Everything?

Let's say we ignore circular buffers and just use a plain array.
Every time we dequeue, we shift all remaining elements left to
fill the gap:

```
  SHIFT-BASED QUEUE — THE COST

  Start: [10, 20, 30, 40, 50]

  dequeue() → 10
  Shift everything left:
  [20, 30, 40, 50, __]
   ←── ←── ←── ←──
   4 elements moved! O(n)

  dequeue() → 20
  [30, 40, 50, __, __]
   ←── ←── ←──
   3 elements moved! O(n)

  For n dequeues on a queue of size n:
  Total shifts = n + (n-1) + (n-2) + ... + 1 = n(n+1)/2 = O(n²)

  Compare with circular buffer:
  n dequeues = n × O(1) = O(n) total

  That's the difference between O(n²) and O(n).
  For 1 million items: ~500 billion shifts vs 1 million pointer updates.
```

### Why This Matters in Practice

Imagine a web server processing 10,000 requests per second
through a queue:

- **Circular buffer**: Each dequeue is O(1). The server handles
  requests smoothly.
- **Shift-based array**: Each dequeue shifts thousands of
  elements. The server bogs down, latency spikes, and requests
  start timing out.

The circular buffer isn't just theoretically better — it's the
difference between a system that works and one that doesn't.

### Could We Batch the Shifts?

A clever compromise: don't shift on every dequeue. Instead, let
the front pointer advance (like a circular buffer), and only
shift when the front pointer reaches the middle of the array.
This gives amortized O(1) dequeue — but it's more complex than
a circular buffer and still wastes up to half the array. The
circular buffer is simpler and wastes nothing.

---

## Exercises

1. **Trace enqueue/dequeue**: Starting with an empty circular
   buffer of capacity 4, trace the array state, front pointer,
   and back pointer after each operation: `enqueue(A)`,
   `enqueue(B)`, `enqueue(C)`, `dequeue()`, `dequeue()`,
   `enqueue(D)`, `enqueue(E)`, `enqueue(F)`. Show where the
   wrap-around happens.

2. **Hot potato**: N people stand in a circle. Starting from
   person 1, count k people and eliminate the k-th person.
   Repeat until one person remains. Implement this using a queue.
   (This is the Josephus problem.)

3. **Implement a deque**: Write a deque class using a circular
   buffer that supports `push_front`, `push_back`, `pop_front`,
   `pop_back`, all in O(1) amortized time. Handle resizing.

4. **Recent counter**: Design a class that counts the number of
   requests received in the last 3000 milliseconds. Each call to
   `ping(t)` adds a request at time `t` and returns the count of
   requests in `[t - 3000, t]`. Use a queue to discard old
   requests.

5. **Sliding window maximum**: Given an array and window size k,
   find the maximum value in each window of size k. Use a deque
   to achieve O(n) time. Hint: maintain a monotonically
   decreasing deque of indices.

6. **Circular buffer full detection**: Implement a fixed-size
   circular buffer (no resizing) that correctly distinguishes
   between "full" and "empty" states. Try both the "waste one
   slot" approach and the "size counter" approach. Which do you
   prefer and why?

---

**Previous**: [Lesson 05 — Stacks](./05-stacks.md)
**Next**: [Lesson 07 — Hash Tables](./07-hash-tables.md)
