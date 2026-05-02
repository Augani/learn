# Lesson 11: Heaps and Priority Queues

## What Is a Heap?

A heap is a **complete binary tree** where every parent node satisfies a heap property relative to its children:
- **Max-heap**: parent >= both children (largest element at root)
- **Min-heap**: parent <= both children (smallest element at root)

### The Corporate Hierarchy Analogy

In a corporate hierarchy, your boss always outranks you, and their boss outranks them:

```
Max-heap (boss outranks everyone below):

              ┌────┐
              │ CEO│  ← always the highest rank
              │ 100│
              └──┬─┘
         ┌───────┴───────┐
       ┌─┴──┐          ┌─┴──┐
       │ VP │          │ VP │
       │ 80 │          │ 75 │
       └──┬─┘          └──┬─┘
     ┌────┴────┐     ┌────┴────┐
   ┌─┴──┐  ┌──┴─┐ ┌─┴──┐  ┌──┴─┐
   │Mgr │  │Mgr │ │Mgr │  │Mgr │
   │ 60 │  │ 50 │ │ 70 │  │ 40 │
   └────┘  └────┘ └────┘  └────┘

Rule: every boss ≥ their direct reports
NOT required: 80 > 75 (siblings don't need ordering)
NOT required: 70 > 60 (cousins don't need ordering)
```

Important: a heap is NOT a sorted structure. It only guarantees the root is the min/max. The rest is partially ordered.

## The Array Trick: No Pointers Needed

The genius of heaps is that a complete binary tree maps perfectly to an array. No left/right pointers — just arithmetic:

```
Tree view:
              ┌────┐
              │ 90 │  index 0
              └──┬─┘
         ┌───────┴───────┐
       ┌─┴──┐          ┌─┴──┐
       │ 80 │          │ 70 │  index 1, 2
       └──┬─┘          └──┬─┘
     ┌────┴────┐     ┌────┴────┐
   ┌─┴──┐  ┌──┴─┐ ┌─┴──┐  ┌──┴─┐
   │ 50 │  │ 60 │ │ 30 │  │ 40 │  index 3, 4, 5, 6
   └────┘  └────┘ └────┘  └────┘

Array view:
Index:   0    1    2    3    4    5    6
Value: [90,  80,  70,  50,  60,  30,  40]
```

Navigation formulas (0-indexed):
```
Parent of node i:       (i - 1) / 2
Left child of node i:   2 * i + 1
Right child of node i:  2 * i + 2

Example: node at index 1 (value 80)
  Parent: (1-1)/2 = 0 → value 90 ✓
  Left child: 2*1+1 = 3 → value 50 ✓
  Right child: 2*1+2 = 4 → value 60 ✓
```

This array representation is cache-friendly (contiguous memory) and has zero pointer overhead.

## Heap Operations

### Peek — O(1)

The root is always the max (max-heap) or min (min-heap):

```rust
fn peek(heap: &[i32]) -> Option<&i32> {
    heap.first() // root is always index 0
}
```

### Insert (Push) — O(log n)

Add the new element at the end, then **sift up** (bubble up) to restore the heap property:

```
Insert 85 into max-heap:

Step 1: Add at end
[90, 80, 70, 50, 60, 30, 40, 85]
                                ↑ new element at index 7

Step 2: Sift up — compare with parent
Parent of index 7 = (7-1)/2 = 3 → value 50
85 > 50 → SWAP

[90, 80, 70, 85, 60, 30, 40, 50]
              ↑                ↑ swapped

Step 3: Continue sift up
Parent of index 3 = (3-1)/2 = 1 → value 80
85 > 80 → SWAP

[90, 85, 70, 80, 60, 30, 40, 50]
     ↑       ↑ swapped

Step 4: Continue sift up
Parent of index 1 = (1-1)/2 = 0 → value 90
85 < 90 → STOP. Heap property restored.

Tree view after insert:
              ┌────┐
              │ 90 │
              └──┬─┘
         ┌───────┴───────┐
       ┌─┴──┐          ┌─┴──┐
       │ 85 │          │ 70 │
       └──┬─┘          └──┬─┘
     ┌────┴────┐     ┌────┴────┐
   ┌─┴──┐  ┌──┴─┐ ┌─┴──┐  ┌──┴─┐
   │ 80 │  │ 60 │ │ 30 │  │ 40 │
   └──┬─┘  └────┘ └────┘  └────┘
   ┌──┘
 ┌─┴──┐
 │ 50 │
 └────┘
```

At most log(n) swaps (height of the tree).

### Extract Max/Min (Pop) — O(log n)

Remove the root, replace it with the last element, then **sift down** to restore heap property:

```
Extract max from: [90, 85, 70, 80, 60, 30, 40, 50]

Step 1: Save root value (90), move last element to root
[50, 85, 70, 80, 60, 30, 40]
 ↑ was 90, now 50 (was last element)

Step 2: Sift down — compare with children, swap with larger child
Left child: index 1, value 85
Right child: index 2, value 70
Larger child is 85 at index 1
50 < 85 → SWAP

[85, 50, 70, 80, 60, 30, 40]
 ↑   ↑ swapped

Step 3: Continue sift down from index 1
Left child: index 3, value 80
Right child: index 4, value 60
Larger child is 80 at index 3
50 < 80 → SWAP

[85, 80, 70, 50, 60, 30, 40]
     ↑       ↑ swapped

Step 4: Continue sift down from index 3
No children (index 7 >= len) → STOP

Return 90. Heap property restored.
```

## Priority Queue

A priority queue is an abstract concept: "process items by priority, not by arrival time." Heaps are the standard implementation.

```
Regular queue (FIFO):        Priority queue:
Process in order of arrival  Process in order of priority

Queue: [Task A, Task B, Task C]     PQ: [(Task C, priority 10),
Next:   Task A (arrived first)           (Task A, priority 5),
                                         (Task B, priority 1)]
                                    Next: Task C (highest priority)
```

### Use Cases

**1. Task Scheduling**
```
OS scheduler: run highest-priority process next

Priority Queue:
  (kernel interrupt,  priority 99)   ← runs first
  (UI rendering,      priority 50)
  (background backup,  priority 1)   ← runs last
```

**2. Dijkstra's Algorithm (Lesson 13)**
```
Always expand the node with the lowest total cost so far.
The priority queue makes this O(log n) per expansion.
```

**3. Finding Top-K Elements**
```
Top 10 scores out of 1 million entries:

Approach 1: Sort all 1M entries → O(n log n)
Approach 2: Use a min-heap of size 10 → O(n log k) where k=10

For each score:
  If heap has < 10 items → push
  If score > heap.peek() → pop min, push new score

At the end, the heap contains the top 10.
```

**4. Merge K Sorted Lists**
```
List 1: [1, 4, 7]
List 2: [2, 5, 8]
List 3: [3, 6, 9]

Min-heap of (value, list_index):
  Push first element of each list: [(1, 0), (2, 1), (3, 2)]
  Pop min (1) → output 1, push next from list 0 (4)
  Pop min (2) → output 2, push next from list 1 (5)
  Pop min (3) → output 3, push next from list 2 (6)
  ...

Result: [1, 2, 3, 4, 5, 6, 7, 8, 9]
Time: O(n * k * log k) where n = total elements, k = number of lists
```

## Rust: BinaryHeap

Rust provides `BinaryHeap<T>` — a **max-heap** (largest element first).

```rust
use std::collections::BinaryHeap;

let mut heap = BinaryHeap::new();

heap.push(30);
heap.push(10);
heap.push(50);
heap.push(20);

heap.peek();  // Some(&50) — max element, O(1)
heap.pop();   // Some(50) — remove max, O(log n)
heap.pop();   // Some(30)
heap.pop();   // Some(20)
heap.pop();   // Some(10)
heap.pop();   // None
```

### Min-Heap with Reverse

Rust's BinaryHeap is max-heap by default. For a min-heap, use `std::cmp::Reverse`:

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

let mut min_heap = BinaryHeap::new();

min_heap.push(Reverse(30));
min_heap.push(Reverse(10));
min_heap.push(Reverse(50));

min_heap.peek();  // Some(&Reverse(10)) — min element
min_heap.pop();   // Some(Reverse(10)) — removes minimum
```

### Custom Priority with Structs

```rust
use std::collections::BinaryHeap;
use std::cmp::Ordering;

#[derive(Eq, PartialEq)]
struct Task {
    priority: u32,
    name: String,
}

impl Ord for Task {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority.cmp(&other.priority)
    }
}

impl PartialOrd for Task {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

let mut scheduler = BinaryHeap::new();
scheduler.push(Task { priority: 1, name: "backup".into() });
scheduler.push(Task { priority: 10, name: "user request".into() });
scheduler.push(Task { priority: 5, name: "email send".into() });

let next = scheduler.pop();
// Task { priority: 10, name: "user request" } — highest priority
```

## Complexity Summary

| Operation | Time | Space |
|-----------|------|-------|
| peek (find max/min) | O(1) | — |
| push (insert) | O(log n) | — |
| pop (extract max/min) | O(log n) | — |
| Build heap from array | O(n)* | — |
| Search for arbitrary element | O(n) | — |

\* Building a heap by sifting down from the bottom is O(n), not O(n log n). This is a subtle result — the lower levels have more nodes but less sifting distance.

## Heap vs Other Structures

| Need | Heap | Sorted Vec | BTreeMap |
|------|------|-----------|----------|
| Find min/max | O(1) | O(1) | O(log n) |
| Insert | O(log n) | O(n) | O(log n) |
| Delete min/max | O(log n) | O(1) or O(n) | O(log n) |
| Find arbitrary | O(n) | O(log n) | O(log n) |
| Find BOTH min and max | Need two heaps | O(1) | O(log n) |

Use a heap when you only need the extreme value (min or max), not arbitrary search.

## Cross-Language Comparison

| | Rust | Go | TypeScript |
|---|---|---|---|
| Priority queue | `BinaryHeap<T>` | `container/heap` (interface) | No built-in (npm packages) |
| Default order | Max-heap | Implement `heap.Interface` | N/A |
| Min-heap | `BinaryHeap<Reverse<T>>` | Implement `Less()` reversed | N/A |
| Custom priority | Implement `Ord` | Implement `heap.Interface` | N/A |

Go's `container/heap` is an interface you implement on a slice. It's more flexible but more boilerplate than Rust's approach.

## Exercises

### Exercise 1: Top-K Frequent Words

Given a text, find the top 10 most frequent words using a BinaryHeap:

```rust
use std::collections::{BinaryHeap, HashMap};

fn top_k_words(text: &str, k: usize) -> Vec<(String, usize)> {
    // Step 1: Count word frequencies with HashMap
    // Step 2: Use a BinaryHeap to find top K
    //   Option A: Push all into max-heap, pop K times
    //   Option B: Use min-heap of size K (more efficient for large datasets)
    todo!()
}

fn main() {
    let text = "the quick brown fox jumps over the lazy dog \
                the fox the dog the quick fox";

    let top = top_k_words(text, 3);
    // Expected: [("the", 5), ("fox", 3), ("dog", 2)] or similar
    for (word, count) in &top {
        println!("{}: {}", word, count);
    }
}
```

### Exercise 2: Merge K Sorted Iterators

Merge K sorted vectors into a single sorted vector using a min-heap:

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

fn merge_k_sorted(lists: Vec<Vec<i32>>) -> Vec<i32> {
    // Min-heap entries: (value, list_index, element_index)
    // Push first element from each list
    // Pop min, push next from same list
    // Repeat until heap is empty
    todo!()
}

#[test]
fn test_merge() {
    let lists = vec![
        vec![1, 4, 7],
        vec![2, 5, 8],
        vec![3, 6, 9],
    ];
    assert_eq!(merge_k_sorted(lists), vec![1, 2, 3, 4, 5, 6, 7, 8, 9]);
}
```

### Exercise 3: Running Median

Maintain the median of a stream of numbers using two heaps:

```rust
struct MedianFinder {
    max_heap: BinaryHeap<i32>,           // lower half
    min_heap: BinaryHeap<Reverse<i32>>,  // upper half
}

impl MedianFinder {
    fn new() -> Self { /* ... */ }
    fn add(&mut self, num: i32) { /* ... */ }
    fn median(&self) -> f64 { /* ... */ }
}

// Add 1: median = 1.0
// Add 3: median = 2.0  (average of 1 and 3)
// Add 2: median = 2.0  (middle of 1, 2, 3)
// Add 5: median = 2.5  (average of 2 and 3)
```

The trick: keep the lower half in a max-heap and the upper half in a min-heap. The median is at the tops of the heaps.

```
Stream: [1, 3, 2, 5]

After 1:    max_heap: [1]     min_heap: []        median = 1
After 3:    max_heap: [1]     min_heap: [3]       median = (1+3)/2 = 2
After 2:    max_heap: [2, 1]  min_heap: [3]       median = 2
After 5:    max_heap: [2, 1]  min_heap: [3, 5]    median = (2+3)/2 = 2.5
```

---

Next: [Lesson 12: Graphs](./12-graphs.md)
