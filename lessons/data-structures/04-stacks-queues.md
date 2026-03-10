# Lesson 04: Stacks and Queues — LIFO and FIFO

## Two Fundamental Access Patterns

Almost every data flow in computing follows one of two patterns:
- **Stack (LIFO)**: Last In, First Out
- **Queue (FIFO)**: First In, First Out

These aren't just abstract data structures — they're everywhere. Your browser's back button is a stack. Your printer's job list is a queue. Your function calls are a stack. Your message broker is a queue.

## Stacks: Last In, First Out

### The Stack of Plates Analogy

Imagine a stack of plates in a cafeteria:

```
Push plate:              Pop plate:

    ┌─────┐              Take from top
    │  C  │  ← top           ↑
    ├─────┤              ┌─────┐
    │  B  │              │  C  │  ← removed
    ├─────┤              ├─────┤
    │  A  │              │  B  │  ← new top
    └─────┘              ├─────┤
                         │  A  │
                         └─────┘

You can only add or remove from the top.
You can't pull plate A without removing B and C first.
```

### Stack Operations

```
push(X)  — add X to the top           O(1)
pop()    — remove and return the top   O(1)
peek()   — look at the top (no remove) O(1)
isEmpty()                              O(1)
```

All operations are O(1) because you only ever touch the top.

### Stack in Rust: Vec as a Stack

Rust doesn't have a dedicated `Stack` type. `Vec` is the stack:

```rust
let mut stack: Vec<i32> = Vec::new();

stack.push(10);    // [10]
stack.push(20);    // [10, 20]
stack.push(30);    // [10, 20, 30]

let top = stack.last();    // Some(&30) — peek
let popped = stack.pop();  // Some(30), stack is now [10, 20]
let popped = stack.pop();  // Some(20), stack is now [10]
```

```
Vec as stack (grows right):

push(10): [10]
push(20): [10, 20]
push(30): [10, 20, 30]
                    ↑ top (end of Vec)

pop():    [10, 20]  → returns 30
pop():    [10]      → returns 20
```

### Real-World Stack Use Cases

#### 1. Function Call Stack

Every program uses a stack to track function calls:

```rust
fn main() {
    let result = a();
}
fn a() -> i32 { b() + 1 }
fn b() -> i32 { c() + 2 }
fn c() -> i32 { 42 }
```

```
Call stack (grows upward):

Step 1:  │ main() │     Step 2:  │ a()    │     Step 3:  │ b()    │
         └────────┘              │ main() │              │ a()    │
                                 └────────┘              │ main() │
                                                         └────────┘

Step 4:  │ c()    │     Step 5:  │ b()    │     Step 6:  │ a()    │
         │ b()    │     c returns│ a()    │     b returns│ main() │
         │ a()    │     42       │ main() │     44       └────────┘
         │ main() │              └────────┘     a returns 45
         └────────┘
```

Stack overflow = this stack gets too deep (usually from unbounded recursion).

#### 2. Undo/Redo

```
Action stack (undo):     Redo stack:

User types "Hello":
  │ type 'o'  │          │         │
  │ type 'l'  │          │         │
  │ type 'l'  │          │         │
  │ type 'e'  │          │         │
  │ type 'H'  │          │         │
  └───────────┘          └─────────┘

User presses Undo:
  │ type 'l'  │          │ type 'o' │  ← moved to redo stack
  │ type 'l'  │          │          │
  │ type 'e'  │          │          │
  │ type 'H'  │          │          │
  └───────────┘          └──────────┘

User presses Redo:
  │ type 'o'  │          │          │  ← moved back
  │ type 'l'  │          │          │
  │ type 'l'  │          │          │
  │ type 'e'  │          │          │
  │ type 'H'  │          │          │
  └───────────┘          └──────────┘
```

#### 3. Expression Parsing

```
Evaluating: 3 + 4 * 2

Operator stack:     Number stack:

Read 3:             │ 3 │
Read +:  │ + │      │ 3 │
Read 4:  │ + │      │ 4 │
                    │ 3 │
Read *:  │ * │      │ 4 │  (* has higher precedence than +)
         │ + │      │ 3 │
Read 2:  │ * │      │ 2 │
         │ + │      │ 4 │
                    │ 3 │

End: pop * → 4*2=8  │ + │      │ 8 │
                                │ 3 │
     pop + → 3+8=11            │ 11│

Result: 11
```

#### 4. DFS (Depth-First Search)

```
Graph:  A → B → D
        ↓   ↓
        C   E

DFS with stack:
Stack: [A]          Visit A, push neighbors
Stack: [C, B]       Visit B (top), push neighbors
Stack: [C, E, D]    Visit D (top), no unvisited neighbors
Stack: [C, E]       Visit E (top), no unvisited neighbors
Stack: [C]          Visit C (top), no unvisited neighbors
Stack: []           Done!

Visit order: A, B, D, E, C
```

## Queues: First In, First Out

### The Store Line Analogy

A queue works like a line at a store — the first person who gets in line is the first person served:

```
Enqueue (join line):                    Dequeue (get served):

    Back                 Front            Back                 Front
    ┌────┐┌────┐┌────┐┌────┐             ┌────┐┌────┐┌────┐
    │ D  ││ C  ││ B  ││ A  │ → served    │ D  ││ C  ││ B  │ → A leaves
    └────┘└────┘└────┘└────┘             └────┘└────┘└────┘
     ↑                                    ↑
     new arrival                          new arrival
```

### Queue Operations

```
enqueue(X) — add X to the back         O(1)
dequeue()  — remove from the front     O(1)
peek()     — look at the front         O(1)
isEmpty()                              O(1)
```

### Why Vec Is Bad for Queues

Using `Vec` as a queue is tempting but problematic:

```rust
let mut bad_queue: Vec<i32> = Vec::new();

bad_queue.push(1);     // enqueue: O(1) — fine
bad_queue.push(2);     // enqueue: O(1) — fine
bad_queue.remove(0);   // dequeue: O(n) — BAD! shifts all elements
```

```
bad_queue.remove(0):

Before: [A, B, C, D, E]
         ↑ remove this

After:  [B, C, D, E]
         ← ← ← ←   every element shifts left = O(n)
```

### Queue in Rust: VecDeque

`VecDeque` (Vec Double-Ended Queue) uses a **ring buffer** for O(1) operations at both ends:

```rust
use std::collections::VecDeque;

let mut queue: VecDeque<i32> = VecDeque::new();

queue.push_back(1);   // enqueue: [1]
queue.push_back(2);   // enqueue: [1, 2]
queue.push_back(3);   // enqueue: [1, 2, 3]

let front = queue.pop_front();  // dequeue: Some(1), queue is [2, 3]
let front = queue.pop_front();  // dequeue: Some(2), queue is [3]
```

### Ring Buffer: How VecDeque Works

A ring buffer wraps around the end of the array, avoiding the need to shift elements:

```
VecDeque internal state:

Initial: capacity 8, empty
┌───┬───┬───┬───┬───┬───┬───┬───┐
│   │   │   │   │   │   │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘
 ↑
 head (front = back, empty)

After push_back(A), push_back(B), push_back(C):
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ B │ C │   │   │   │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘
 ↑           ↑
 head        tail

After pop_front() → returns A:
┌───┬───┬───┬───┬───┬───┬───┬───┐
│   │ B │ C │   │   │   │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘
     ↑       ↑
     head    tail

No shifting! Just move the head pointer forward.

After many operations, it wraps around:
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ G │ H │   │   │   │ D │ E │ F │
└───┴───┴───┴───┴───┴───┴───┴───┘
         ↑           ↑
         tail        head

Logical order: D, E, F, G, H (wraps from index 7 back to index 0)
```

### Real-World Queue Use Cases

#### 1. Task Scheduling

```
Print queue:

Job 1: "Report.pdf"     → enqueue
Job 2: "Photo.jpg"      → enqueue
Job 3: "Resume.pdf"     → enqueue

Printer processes:
  Dequeue → "Report.pdf" (prints first)
  Dequeue → "Photo.jpg"  (prints second)
  Dequeue → "Resume.pdf" (prints third)
```

#### 2. BFS (Breadth-First Search)

```
Graph:  A → B → D
        ↓   ↓
        C   E

BFS with queue:
Queue: [A]          Dequeue A, enqueue neighbors B, C
Queue: [B, C]       Dequeue B, enqueue neighbors D, E
Queue: [C, D, E]    Dequeue C, no unvisited neighbors
Queue: [D, E]       Dequeue D, no unvisited neighbors
Queue: [E]          Dequeue E, no unvisited neighbors
Queue: []           Done!

Visit order: A, B, C, D, E (level by level)
```

#### 3. Message Queues (Kafka, RabbitMQ, SQS)

```
Producer → [msg1, msg2, msg3, msg4] → Consumer
           ←── queue ──→

Messages processed in order (FIFO).
Multiple consumers can process from the same queue.
```

## Deque: Double-Ended Queue

A deque allows push and pop from **both** ends in O(1):

```
           push_front                    push_back
               ↓                             ↓
front ← [D, C, B, A, E, F, G, H] → back
               ↑                             ↑
           pop_front                     pop_back
```

```rust
use std::collections::VecDeque;

let mut deque: VecDeque<i32> = VecDeque::new();

deque.push_back(1);    // [1]
deque.push_back(2);    // [1, 2]
deque.push_front(0);   // [0, 1, 2]
deque.push_front(-1);  // [-1, 0, 1, 2]

deque.pop_front();     // Some(-1), deque is [0, 1, 2]
deque.pop_back();      // Some(2), deque is [0, 1]
```

Deques can function as both a stack and a queue. They're useful for algorithms like sliding window maximum and work-stealing schedulers.

## Comparison Table

| Feature | Stack (Vec) | Queue (VecDeque) | Deque (VecDeque) |
|---------|------------|------------------|------------------|
| Add to top/back | O(1) push | O(1) push_back | O(1) push_back |
| Remove from top/front | O(1) pop | O(1) pop_front | O(1) pop_front |
| Add to bottom/front | O(n) insert(0,..) | O(1) push_front | O(1) push_front |
| Remove from bottom/back | N/A | N/A | O(1) pop_back |
| Peek top/front | O(1) last() | O(1) front() | O(1) front()/back() |
| Random access | O(1) | O(1) | O(1) |

## Cross-Language Comparison

| Concept | Rust | Go | TypeScript |
|---------|------|-----|------------|
| Stack | `Vec<T>` (push/pop) | `[]T` (append/slice) | `Array` (push/pop) |
| Queue | `VecDeque<T>` | `container/list` or channel | `Array` (push/shift — O(n)!) |
| Deque | `VecDeque<T>` | No built-in | No built-in |

TypeScript trap: `Array.shift()` is O(n) because it shifts all elements. For a real queue in JS/TS, use a linked list or a library.

Go trap: Go slices used as queues (`s = s[1:]`) don't release memory for dequeued elements. Use channels for concurrent queues or `container/list` for general-purpose queues.

## Exercises

### Exercise 1: Bracket Validator

Write a function that checks if a string has balanced brackets using a stack:

```rust
fn is_balanced(input: &str) -> bool {
    // Valid:   "([]{})", "((()))", "{[()]}"
    // Invalid: "(]", "([)]", "(()", "}"
    todo!()
}
```

Algorithm:
1. For each character:
   - If opening bracket `(`, `[`, `{` → push onto stack
   - If closing bracket `)`, `]`, `}` → pop from stack and check if it matches
2. At the end, the stack should be empty

```
Input: "{[()]}"

Char  Stack        Action
{     [{]          push
[     [{, []       push
(     [{, [, (]    push
)     [{, []       pop ( → matches )  ✓
]     [{]          pop [ → matches ]  ✓
}     []           pop { → matches }  ✓
                   stack empty         ✓ → balanced!

Input: "([)]"

Char  Stack        Action
(     [(]          push
[     [(, []       push
)     [(]          pop [ → doesn't match )  ✗ → unbalanced!
```

### Exercise 2: Implement a Queue Using Two Stacks

This is a classic interview question. Implement a queue using only stack operations (push/pop):

```rust
struct QueueFromStacks {
    inbox: Vec<i32>,
    outbox: Vec<i32>,
}

impl QueueFromStacks {
    fn new() -> Self { /* ... */ }
    fn enqueue(&mut self, value: i32) { /* ... */ }
    fn dequeue(&mut self) -> Option<i32> { /* ... */ }
}
```

Hint: push into `inbox`. When you need to dequeue, if `outbox` is empty, pour all of `inbox` into `outbox` (which reverses the order). Then pop from `outbox`.

```
enqueue(1): inbox=[1]         outbox=[]
enqueue(2): inbox=[1,2]       outbox=[]
enqueue(3): inbox=[1,2,3]     outbox=[]
dequeue():  inbox=[]          outbox=[3,2,1] → pop → 1
dequeue():  inbox=[]          outbox=[3,2]   → pop → 2
enqueue(4): inbox=[4]         outbox=[3,2]
dequeue():  inbox=[4]         outbox=[3]     → pop → 3 (not 4! FIFO preserved)
```

### Exercise 3: Task Queue with Priorities

Build a simple task processing system:

```rust
use std::collections::VecDeque;

#[derive(Debug)]
struct Task {
    name: String,
    priority: Priority,
}

#[derive(Debug, PartialEq)]
enum Priority {
    High,
    Normal,
    Low,
}

struct TaskQueue {
    high: VecDeque<Task>,
    normal: VecDeque<Task>,
    low: VecDeque<Task>,
}

impl TaskQueue {
    fn new() -> Self { /* ... */ }
    fn add_task(&mut self, task: Task) { /* route to correct queue */ }
    fn next_task(&mut self) -> Option<Task> { /* dequeue from highest non-empty queue */ }
}
```

Process high-priority tasks first, then normal, then low. Within each priority level, process in FIFO order.

---

Next: [Lesson 05: Searching](./05-searching.md)
