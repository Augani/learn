# Lesson 20: Heaps and Priority Queues

> **Analogy**: Think of a hospital emergency room triage desk.
> Patients do not get treated strictly in arrival order. The most
> urgent case should rise to the top immediately. But the hospital
> also cannot afford to fully sort every patient against every
> other patient after each arrival. It needs a structure that
> keeps the highest-priority patient easy to access while allowing
> fast insertions of new cases. That is exactly what a heap does.

---

## Why This Matters

Binary search trees organize data for ordered lookup. Heaps solve
different problems.

They are built for questions like:

- What is the smallest element right now?
- What is the largest task priority right now?
- Which node should Dijkstra process next?
- What are the top `k` items seen so far?

The heap is one of the most important examples of choosing the
right partial order for the job. A heap is not fully sorted, and
that is exactly why it is efficient.

By the end of this lesson, you will understand:

- The min-heap and max-heap properties
- Why a complete binary tree stored in an array is ideal
- Insert via sift-up
- Extract-min / extract-max via sift-down
- Heapify and why it is O(n), not O(n log n)
- How heaps implement priority queues
- How heaps connect to heapsort

> **Cross-reference**: The earlier
> [`../data-structures/11-heaps.md`](../data-structures/11-heaps.md)
> introduces heaps and Rust's `BinaryHeap`. This lesson goes
> deeper on the array representation, heapify reasoning, the
> priority-queue abstraction, and the trade-offs against other
> possible representations.

---

## What Is a Heap?

A heap is a **complete binary tree** with a local ordering rule.

There are two common versions:

- **Min-heap**: every parent is less than or equal to its children
- **Max-heap**: every parent is greater than or equal to its children

### Min-Heap Example

```
              [2]
             /   \
           [4]   [6]
          /  \   /  \
        [7] [9] [8] [10]

  Every parent <= its children
  Root is the global minimum
```

### Max-Heap Example

```
              [20]
             /    \
           [15]   [18]
          /  \    /  \
        [7] [10] [9] [4]

  Every parent >= its children
  Root is the global maximum
```

Important: a heap is **not** a fully sorted tree.

```
  MIN-HEAP DOES NOT MEAN LEFT < RIGHT OR GLOBAL SORTED ORDER

              [2]
             /   \
           [4]   [6]
          /  \   /  \
        [7] [9] [8] [10]

  4 < 6, but that is incidental.
  9 is in the left subtree, 8 is in the right subtree.
  The only guarantee is parent <= children.
```

That limited guarantee is enough to expose the best-priority item
at the root while avoiding the cost of full sorting.

---

## Why the Tree Must Be Complete

A heap is not just any binary tree. It must be a **complete**
binary tree:

- all levels are full except possibly the last
- the last level is filled left to right

```
  COMPLETE TREE                     NOT COMPLETE

              [1]                        [1]
             /   \                      /   \
           [2]   [3]                  [2]   [3]
          /  \   /                    /        \
        [4] [5] [6]                [4]        [6]

  Left-packed shape                Gap on the last level
```

This shape is what makes the array representation perfect.

---

## The Array Representation — No Pointers Needed

Because the heap is complete, we can store it in a flat array.

```
  TREE VIEW

              [10]                     index 0
             /    \
           [15]   [20]                 index 1, 2
          /  \    /  \
        [30] [40][50] [60]             index 3, 4, 5, 6


  ARRAY VIEW

  Index:  0   1   2   3   4   5   6
  Value: [10, 15, 20, 30, 40, 50, 60]
```

For zero-based indexing:

$$
\text{left child}(i) = 2i + 1
$$

$$
\text{right child}(i) = 2i + 2
$$

$$
\text{parent}(i) = \left\lfloor\frac{i - 1}{2}\right\rfloor
$$

### Example

For node at index `2`:

- left child = `2*2+1 = 5`
- right child = `2*2+2 = 6`
- parent of index `5` = `(5-1)//2 = 2`

This representation is ideal because:

- no pointer overhead
- contiguous memory
- cache-friendly traversal
- simple arithmetic navigation

This is why the complete-tree constraint matters so much.

---

## Peek — O(1)

The best-priority item is always at the root, which is array
index 0.

- min-heap -> smallest value
- max-heap -> largest value

```
  Min-heap array: [2, 4, 6, 7, 9, 8, 10]
                   ^
                   peek = 2
```

That is the main reason heaps are useful.

---

## Insert — Sift Up

To insert a value:

1. place it at the end of the array
2. while it violates the heap property with its parent, swap upward

### Insert 5 into a Min-Heap

Start with:

```
  [2, 4, 6, 7, 9, 8, 10]

              [2]
             /   \
           [4]   [6]
          /  \   /  \
        [7] [9] [8] [10]
```

Append `5`:

```
  [2, 4, 6, 7, 9, 8, 10, 5]

                  [2]
                 /   \
               [4]   [6]
              /  \   /  \
            [7] [9] [8] [10]
            /
          [5]
```

Now sift up:

```
  Compare 5 with parent 7 -> 5 < 7, swap

  [2, 4, 6, 5, 9, 8, 10, 7]

  Compare 5 with parent 4 -> 5 >= 4, stop
```

Final heap:

```
              [2]
             /   \
           [4]   [6]
          /  \   /  \
        [5] [9] [8] [10]
        /
      [7]
```

Each swap moves the value up one level, so insertion takes O(log n).

---

## Extract-Min / Extract-Max — Sift Down

Removing the root is trickier.

For a min-heap:

1. save the root value
2. move the last array element to index 0
3. remove the last slot
4. sift the new root down until the heap property is restored

### Extract-Min Example

Start with:

```
  [2, 4, 6, 5, 9, 8, 10, 7]
```

Remove root `2`, move last element `7` to the root:

```
  [7, 4, 6, 5, 9, 8, 10]
```

Now sift down by swapping with the smaller child.

```
  Step 1:
  root = 7, children = 4 and 6
  smaller child = 4 -> swap

  [4, 7, 6, 5, 9, 8, 10]

  Step 2:
  node = 7, children = 5 and 9
  smaller child = 5 -> swap

  [4, 5, 6, 7, 9, 8, 10]

  Step 3:
  7 has no violating child -> stop
```

The minimum `2` has been extracted, and the heap property is restored.

Again, the value moves at most one level per swap, so extraction is O(log n).

---

## Heapify — Building a Heap Efficiently

Suppose you already have an unsorted array and want to turn it
into a heap.

The naive idea is:

- start with an empty heap
- insert each element one by one

That costs O(n log n).

But there is a better approach: **bottom-up heapify**.

### Bottom-Up Heapify

Observation:

- leaves are already valid heaps of size 1
- the last internal node is at index `(n//2) - 1`
- if you sift down each internal node from right to left, the
  whole array becomes a heap

### Example

```
  Unsorted array:
  [9, 4, 7, 1, 0, 3, 2]

  Tree:
              [9]
             /   \
           [4]   [7]
          /  \   /  \
        [1] [0] [3] [2]
```

Process internal nodes from right to left.

```
  Last internal node index = 2

  Index 2 -> value 7, children 3 and 2
  Swap with 2
  [9, 4, 2, 1, 0, 3, 7]

  Index 1 -> value 4, children 1 and 0
  Swap with 0
  [9, 0, 2, 1, 4, 3, 7]

  Index 0 -> value 9, children 0 and 2
  Swap with 0
  [0, 9, 2, 1, 4, 3, 7]
  Continue sifting 9 down:
  children 1 and 4 -> swap with 1
  [0, 1, 2, 9, 4, 3, 7]

  Result: valid min-heap ✓
```

### Why Heapify Is O(n), Not O(n log n)

This surprises many people.

Not every node can move down `log n` levels:

- many nodes are leaves and move 0 levels
- many are one level above leaves and move at most 1
- very few are near the root and can move far

The total work sums to O(n), not O(n log n).

This is a classic example of aggregated cost analysis.

---

## Priority Queue — The Abstraction Heaps Implement

A priority queue is not a specific data structure. It is an ADT
with operations like:

- insert an item with a priority
- peek at the highest or lowest priority item
- remove that highest or lowest priority item

Heaps are the standard implementation because they make the key
operations efficient:

```
  PRIORITY QUEUE VIA MIN-HEAP

  Tasks:
  (deploy hotfix, priority 1)
  (answer email, priority 5)
  (background cleanup, priority 9)

  Min-heap by priority:
  root always contains the smallest priority number
  -> next urgent task is immediate to access
```

### Common Uses

- Dijkstra's shortest path
- Prim's minimum spanning tree
- A* search
- task scheduling
- event simulation
- merging k sorted lists
- top-k streaming problems

The recurring pattern is simple:

> I repeatedly need the current best candidate, and new
> candidates keep arriving.

That is priority-queue territory.

---

## Heapsort Connection

Heapsort uses a max-heap to sort an array in ascending order.

High-level idea:

1. build a max-heap from the array
2. swap the root with the last element
3. shrink the heap boundary by one
4. sift down the new root
5. repeat

### Example

```
  Array: [5, 1, 8, 3, 2]

  Build max-heap -> [8, 3, 5, 1, 2]

  Swap root with last:
  [2, 3, 5, 1, 8]
  Heap boundary now excludes 8
  Sift down -> [5, 3, 2, 1, 8]

  Swap root with last unsorted:
  [1, 3, 2, 5, 8]
  Sift down -> [3, 1, 2, 5, 8]

  Continue...
  Final sorted array: [1, 2, 3, 5, 8]
```

Heapsort gives:

- O(n log n) worst-case time
- O(1) extra array space

But it is not stable, and in practice it often loses to quicksort
or Timsort because of memory-access behavior.

---

## Technical Deep-Dive: Min-Heap Operations

### Python

```python
def sift_up(heap: list[int], index: int) -> None:
    while index > 0:
        parent = (index - 1) // 2
        if heap[parent] <= heap[index]:
            break
        heap[parent], heap[index] = heap[index], heap[parent]
        index = parent


def sift_down(heap: list[int], index: int) -> None:
    size = len(heap)
    while True:
        left = 2 * index + 1
        right = 2 * index + 2
        smallest = index

        if left < size and heap[left] < heap[smallest]:
            smallest = left
        if right < size and heap[right] < heap[smallest]:
            smallest = right

        if smallest == index:
            break

        heap[index], heap[smallest] = heap[smallest], heap[index]
        index = smallest


def heappush(heap: list[int], value: int) -> None:
    heap.append(value)
    sift_up(heap, len(heap) - 1)


def heappop(heap: list[int]) -> int:
    if not heap:
        raise IndexError("pop from empty heap")
    result = heap[0]
    last = heap.pop()
    if heap:
        heap[0] = last
        sift_down(heap, 0)
    return result
```

### TypeScript

```typescript
function siftUp(heap: number[], index: number): void {
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent] <= heap[index]) {
      break;
    }
    [heap[parent], heap[index]] = [heap[index], heap[parent]];
    index = parent;
  }
}

function siftDown(heap: number[], index: number): void {
  const size = heap.length;

  while (true) {
    const left = 2 * index + 1;
    const right = 2 * index + 2;
    let smallest = index;

    if (left < size && heap[left] < heap[smallest]) {
      smallest = left;
    }
    if (right < size && heap[right] < heap[smallest]) {
      smallest = right;
    }

    if (smallest === index) {
      break;
    }

    [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
    index = smallest;
  }
}

function heapPush(heap: number[], value: number): void {
  heap.push(value);
  siftUp(heap, heap.length - 1);
}

function heapPop(heap: number[]): number {
  if (heap.length === 0) {
    throw new Error("pop from empty heap");
  }

  const result = heap[0];
  const last = heap.pop();
  if (last === undefined) {
    throw new Error("pop from empty heap");
  }

  if (heap.length > 0) {
    heap[0] = last;
    siftDown(heap, 0);
  }

  return result;
}
```

### Rust

```rust
fn sift_up(heap: &mut [i32], mut index: usize) {
    while index > 0 {
        let parent = (index - 1) / 2;
        if heap[parent] <= heap[index] {
            break;
        }
        heap.swap(parent, index);
        index = parent;
    }
}

fn sift_down(heap: &mut [i32], mut index: usize) {
    let size = heap.len();
    loop {
        let left = 2 * index + 1;
        let right = 2 * index + 2;
        let mut smallest = index;

        if left < size && heap[left] < heap[smallest] {
            smallest = left;
        }
        if right < size && heap[right] < heap[smallest] {
            smallest = right;
        }

        if smallest == index {
            break;
        }

        heap.swap(index, smallest);
        index = smallest;
    }
}

fn heappush(heap: &mut Vec<i32>, value: i32) {
    heap.push(value);
    let last_index = heap.len() - 1;
    sift_up(heap, last_index);
}

fn heappop(heap: &mut Vec<i32>) -> Option<i32> {
    if heap.is_empty() {
        return None;
    }

    let result = heap[0];
    let last = heap.pop()?;
    if !heap.is_empty() {
        heap[0] = last;
        sift_down(heap, 0);
    }
    Some(result)
}
```

---

## What If We Used a Sorted Array as a Priority Queue?

That is a reasonable idea. It just makes a different trade-off.

Suppose the smallest value should come out first.

### Sorted array option

- peek minimum: O(1)
- remove minimum from front: O(n) if shifting is required, or O(1)
  from the end depending on ordering choice
- insert new value in sorted order: O(n)

### Heap option

- peek minimum: O(1)
- insert: O(log n)
- extract minimum: O(log n)

So which is better?

- If you perform many inserts and removals, heaps are much better
- If the data is mostly static and you just want repeated access to
  extremes, a sorted array may be competitive

The deeper lesson is that heaps optimize for **dynamic priority
maintenance**, not for full sorted traversal.

---

## Exercises

1. Given the array `[3, 5, 8, 10, 12, 9]`, draw its min-heap tree.
2. Insert `4` into the min-heap `[2, 5, 6, 9, 7, 8]` and trace the
   sift-up swaps.
3. Extract the minimum from `[1, 3, 2, 7, 6, 5, 4]` and trace the
   sift-down swaps.
4. Explain why a heap is not suitable for efficient search of an
   arbitrary target value.
5. Why does heapify run in O(n) even though sift-down can take
   O(log n)?
6. Compare a min-heap and a sorted array as implementations of a
   priority queue in a write-heavy workload.

---

## Key Takeaways

- A heap is a complete binary tree with a local parent-child order.
- The complete-tree shape makes the array representation ideal.
- Insert works by appending then sifting up.
- Extract works by moving the last element to the root then
  sifting down.
- Heapify builds a heap from an array in O(n).
- A priority queue is the abstraction; the heap is the standard
  implementation.
- Heaps expose the best-priority item efficiently without fully
  sorting everything.

The next lesson broadens the tree idea even further: B-trees and
B+ trees, where one node can hold many keys and disk access
becomes the dominant concern.

---

**Previous**: [Lesson 19 — Balanced Binary Search Trees — AVL and Red-Black Trees](./19-balanced-trees.md)
**Next**: [Lesson 21 — B-Trees and B+ Trees — Disk-Oriented Search Trees](./21-b-trees.md)