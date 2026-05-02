# Lesson 04: Linked Lists — Singly, Doubly, and Circular

> **Analogy**: Imagine a treasure hunt where each clue tells you
> where to find the next clue. You start at the first clue, read
> it, follow its directions to the second clue, and so on until
> you reach the treasure. You can't jump straight to clue #7 —
> you have to follow the chain from the beginning. But if you
> want to add a new clue between clue #3 and clue #4, it's easy:
> just change clue #3's directions to point to the new clue, and
> have the new clue point to clue #4. No need to move any of the
> other clues. That's a linked list.

---

## Why This Matters

Arrays give you instant access to any element, but inserting or
deleting in the middle costs O(n) because everything after the
change point must shift. Linked lists flip that trade-off: they
give up instant access in exchange for O(1) insertion and deletion
at any position — as long as you already have a reference to that
position.

This trade-off shows up everywhere:

- **Operating systems** use linked lists for process scheduling
  queues where tasks are constantly added and removed
- **Text editors** use linked lists (or variants like ropes) so
  inserting a character in the middle of a document doesn't
  require shifting the entire file
- **Memory allocators** maintain free lists — linked lists of
  available memory blocks
- **Hash tables** use linked lists for chaining (collision
  resolution)
- **LRU caches** combine a hash map with a doubly linked list
  for O(1) access and O(1) eviction

By the end of this lesson, you'll understand:

- How nodes and pointers form a linked list
- The differences between singly, doubly, and circular variants
- How to insert and delete nodes in O(1) at a known position
- Why sentinel (dummy) nodes simplify edge-case handling
- When to choose a linked list over an array — and when not to

> **Cross-reference**: The existing data structures track covers
> linked lists from a Rust-focused perspective with emphasis on
> ownership semantics. See
> [Linked Lists](../data-structures/03-linked-lists.md)
> for a complementary treatment.

---

## The Treasure Hunt Analogy — Deeper

Picture a treasure hunt laid out across a park. Each clue is a
card placed at a random location:

```
  Clue A          Clue B          Clue C          Clue D
  (park bench)    (fountain)      (oak tree)      (gazebo)
  ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
  │ "Go to    │   │ "Go to    │   │ "Go to    │   │ "You found │
  │  fountain"│──►│  oak tree"│──►│  gazebo"  │──►│  the       │
  │           │   │           │   │           │   │  treasure!"│
  └───────────┘   └───────────┘   └───────────┘   └───────────┘
```

Key properties:

- **Sequential access only**: You must start at Clue A and follow
  the chain. You can't jump to Clue C without visiting A and B.
- **Scattered locations**: The clues aren't next to each other —
  they're spread across the park (like nodes scattered in heap
  memory).
- **Easy insertion**: Want to add a new clue between B and C?
  Change B's directions to point to the new clue, and have the
  new clue point to C. No other clues need to move.
- **Easy removal**: Want to remove Clue B? Change A's directions
  to point directly to C. Done.

Compare this to an array, which is like a row of lockers. Finding
locker #7 is instant (just count), but inserting a new locker in
the middle means physically sliding every locker after it down
by one.

---

## Node Structure: The Building Block

A linked list is built from **nodes**. Each node holds two things:

1. **Data** — the value stored at this position
2. **Pointer(s)** — reference(s) to the next (and possibly
   previous) node

```
  A single node:

  ┌──────────┬──────────┐
  │   data   │   next ──┼──► (points to next node)
  └──────────┴──────────┘

  The list itself just stores a pointer to the first node (head):

  head
   │
   ▼
  ┌──────┬───┐    ┌──────┬───┐    ┌──────┬───┐    ┌──────┬───┐
  │  10  │ ──┼──► │  20  │ ──┼──► │  30  │ ──┼──► │  40  │ ╳ │
  └──────┴───┘    └──────┴───┘    └──────┴───┘    └──────┴───┘

  ╳ = null/None — marks the end of the list
```

Unlike an array, these nodes are **not** stored next to each
other in memory. Each node is allocated independently on the
heap, and the `next` pointer is what connects them. This is why
you can't do index-based access — there's no formula to compute
where node #3 lives. You have to follow the chain.

---

## Singly Linked Lists

A singly linked list is the simplest variant. Each node has one
pointer: `next`.

### Traversal

To visit every node, start at `head` and follow `next` pointers
until you hit `null`:

```
  Traversal: visit each node from head to tail

  head
   │
   ▼
  [10] ──► [20] ──► [30] ──► [40] ──► null

  Step 1: current = head         → visit 10
  Step 2: current = current.next → visit 20
  Step 3: current = current.next → visit 30
  Step 4: current = current.next → visit 40
  Step 5: current = null         → stop

  Time: O(n) — must visit every node
```

### Insertion at the Head — O(1)

The simplest insertion. Create a new node, point it at the
current head, then update head:

```
  INSERT 5 AT HEAD

  Before:
  head
   │
   ▼
  [10] ──► [20] ──► [30] ──► null

  Step 1: Create new node with data = 5
          [5]

  Step 2: Point new node's next to current head
          [5] ──► [10] ──► [20] ──► [30] ──► null

  Step 3: Update head to point to new node
  head
   │
   ▼
  [5] ──► [10] ──► [20] ──► [30] ──► null

  Total operations: 2 pointer updates → O(1)
```

### Insertion After a Known Node — O(1)

If you already have a reference to a node, inserting after it
is O(1). This is the linked list's superpower:

```
  INSERT 25 AFTER NODE CONTAINING 20

  Before:
  head
   │
   ▼
  [10] ──► [20] ──► [30] ──► null
             ▲
             │
           "prev" (we have a reference to this node)

  Step 1: Create new node with data = 25
          [25]

  Step 2: Point new node's next to prev's next (which is [30])
          [25] ──► [30]

  Step 3: Point prev's next to new node
          [20] ──► [25] ──► [30]

  After:
  head
   │
   ▼
  [10] ──► [20] ──► [25] ──► [30] ──► null

  Total operations: 2 pointer updates → O(1)
  (No elements were shifted or copied!)
```

Compare this to an array: inserting 25 between indices 1 and 2
would require shifting elements at indices 2, 3, 4, ... all one
position to the right — O(n) work.

### Deletion of a Known Node's Successor — O(1)

To delete the node after a given node, redirect the pointer:

```
  DELETE NODE AFTER [20] (i.e., remove [25])

  Before:
  head
   │
   ▼
  [10] ──► [20] ──► [25] ──► [30] ──► null
             ▲
             │
           "prev"

  Step 1: Save reference to node being deleted
          target = prev.next  →  [25]

  Step 2: Point prev's next to target's next
          [20] ──────────────────► [30]

  Step 3: Free/discard target node [25]

  After:
  head
   │
   ▼
  [10] ──► [20] ──► [30] ──► null

  Total operations: 1 pointer update → O(1)
```

### The Catch: Finding a Node is O(n)

Insertion and deletion are O(1) *at a known position*. But
finding that position requires traversal from the head — O(n).
This is the fundamental trade-off:

```
  ┌──────────────────────┬────────────┬──────────────┐
  │ Operation            │ Array      │ Singly LL    │
  ├──────────────────────┼────────────┼──────────────┤
  │ Access by index      │ O(1)       │ O(n)         │
  │ Search               │ O(n)       │ O(n)         │
  │ Insert at head       │ O(n)       │ O(1)         │
  │ Insert at known pos  │ O(n)       │ O(1)         │
  │ Insert at tail       │ O(1)*      │ O(n) or O(1) │
  │ Delete at known pos  │ O(n)       │ O(1)         │
  │ Delete at head       │ O(n)       │ O(1)         │
  └──────────────────────┴────────────┴──────────────┘
  * amortized, for dynamic arrays
  † O(1) tail insert if you maintain a tail pointer
```

---

## Doubly Linked Lists

A doubly linked list adds a `prev` pointer to each node, so you
can traverse in both directions:

```
  Doubly linked list node:

  ┌──────────┬──────────┬──────────┐
  │ ◄── prev │   data   │  next ──►│
  └──────────┴──────────┴──────────┘

  Full doubly linked list:

  head                                              tail
   │                                                  │
   ▼                                                  ▼
  ┌───┬────┬───┐    ┌───┬────┬───┐    ┌───┬────┬───┐
  │ ╳ │ 10 │ ──┼──► │◄──│ 20 │ ──┼──► │◄──│ 30 │ ╳ │
  └───┴────┴───┘    └───┴────┴───┘    └───┴────┴───┘
       ▲    │            ▲    │            ▲
       │    └────────────┘    └────────────┘
       null                                null
```

### Why Add the `prev` Pointer?

With a singly linked list, deleting a node requires a reference
to the *previous* node (so you can redirect its `next` pointer).
If you only have a reference to the node you want to delete, you
must traverse from the head to find its predecessor — O(n).

A doubly linked list solves this: every node knows its
predecessor. Deletion of any node you have a reference to is O(1):

```
  DELETE NODE [20] (we have a direct reference to it)

  Before:
  [10] ◄──► [20] ◄──► [30]

  Step 1: node.prev.next = node.next
          [10].next ──────────► [30]

  Step 2: node.next.prev = node.prev
          [10] ◄──────────────  [30]

  After:
  [10] ◄──► [30]

  Total: 2 pointer updates → O(1)
```

This is why **LRU caches** use a doubly linked list: when a
cached item is accessed, you need to move it to the front of the
list. With a doubly linked list, you can remove it from its
current position in O(1) and re-insert it at the head in O(1).

### Trade-off: Extra Memory

Each node now stores two pointers instead of one. On a 64-bit
system, that's an extra 8 bytes per node. For a list of 1 million
small integers, the pointer overhead can exceed the data itself.

```
  Memory per node comparison:

  Singly linked (storing a 4-byte int):
  ┌──────┬──────┐
  │ data │ next │  = 4 + 8 = 12 bytes (67% overhead)
  └──────┴──────┘

  Doubly linked (storing a 4-byte int):
  ┌──────┬──────┬──────┐
  │ prev │ data │ next │  = 8 + 4 + 8 = 20 bytes (80% overhead)
  └──────┴──────┴──────┘

  Array (storing a 4-byte int):
  ┌──────┐
  │ data │  = 4 bytes (0% overhead)
  └──────┘
```

---

## Circular Linked Lists

In a circular linked list, the last node points back to the
first node instead of `null`. There's no natural "end":

```
  Circular singly linked list:

       ┌──────────────────────────────────┐
       │                                  │
       ▼                                  │
      [10] ──► [20] ──► [30] ──► [40] ───┘

  Circular doubly linked list:

       ┌──────────────────────────────────────────┐
       │                                          │
       ▼                                          │
      [10] ◄──► [20] ◄──► [30] ◄──► [40] ◄───────┘
       ▲                                          │
       └──────────────────────────────────────────┘
```

### When Are Circular Lists Useful?

- **Round-robin scheduling**: Processes take turns in a cycle.
  When you reach the last process, you wrap around to the first.
- **Circular buffers**: A fixed-size buffer where the write
  position wraps around (though these are usually implemented
  with arrays and modular arithmetic).
- **Josephus problem**: A classic problem where people standing
  in a circle are eliminated every k-th person.

The key advantage: you can traverse the entire list starting from
*any* node, not just the head. The disadvantage: you need a
termination condition (track the starting node) to avoid infinite
loops.

---

## Sentinel Nodes (Dummy Nodes)

A **sentinel node** is a dummy node that doesn't hold real data
but simplifies edge-case handling. Without sentinels, every
insertion and deletion must check "is this the head?" or "is the
list empty?" — leading to messy conditional logic.

```
  WITHOUT sentinel — inserting at head requires a special case:

  if head is null:
      head = new_node          ← special case: empty list
  else:
      new_node.next = head
      head = new_node          ← normal case

  WITH sentinel — head always exists, no special case:

  sentinel
     │
     ▼
  [DUMMY] ──► [10] ──► [20] ──► [30] ──► null

  Insert new_node after sentinel:
      new_node.next = sentinel.next
      sentinel.next = new_node         ← same code for empty or non-empty

  The "real" list starts at sentinel.next.
```

For a doubly linked list, you can use a single sentinel that
serves as both the "before head" and "after tail":

```
  Doubly linked list with sentinel:

  sentinel ◄──► [10] ◄──► [20] ◄──► [30] ◄──► sentinel
     │                                            ▲
     └────────────────────────────────────────────┘
     (sentinel.next = first real node)
     (sentinel.prev = last real node)

  Empty list:
  sentinel ◄──► sentinel
  (sentinel.next = sentinel, sentinel.prev = sentinel)
```

This eliminates *all* null checks. Every insertion and deletion
uses the same code regardless of position or list state. This is
a common technique in production implementations.

---

## Technical Deep-Dive: Implementing Linked Lists

### Python

```python
# Python — singly linked list
class Node:
    def __init__(self, data, next_node=None):
        self.data = data
        self.next = next_node


class SinglyLinkedList:
    def __init__(self):
        self.head = None
        self.size = 0

    def __len__(self):
        return self.size

    def prepend(self, data):
        """Insert at head — O(1)."""
        self.head = Node(data, self.head)
        self.size += 1

    def append(self, data):
        """Insert at tail — O(n) without tail pointer."""
        new_node = Node(data)
        if self.head is None:
            self.head = new_node
        else:
            current = self.head
            while current.next is not None:
                current = current.next
            current.next = new_node
        self.size += 1

    def insert_after(self, prev_node, data):
        """Insert after a known node — O(1)."""
        new_node = Node(data, prev_node.next)
        prev_node.next = new_node
        self.size += 1

    def delete_head(self):
        """Remove head node — O(1)."""
        if self.head is None:
            return None
        data = self.head.data
        self.head = self.head.next
        self.size -= 1
        return data

    def find(self, data):
        """Search for a value — O(n)."""
        current = self.head
        while current is not None:
            if current.data == data:
                return current
            current = current.next
        return None

    def __repr__(self):
        parts = []
        current = self.head
        while current is not None:
            parts.append(str(current.data))
            current = current.next
        return " -> ".join(parts) + " -> None"


# Usage
ll = SinglyLinkedList()
ll.prepend(30)
ll.prepend(20)
ll.prepend(10)
print(ll)  # 10 -> 20 -> 30 -> None

node_20 = ll.find(20)
ll.insert_after(node_20, 25)
print(ll)  # 10 -> 20 -> 25 -> 30 -> None
```

Note: Python doesn't have a built-in singly linked list, but
`collections.deque` is a doubly linked list under the hood and
is the idiomatic choice when you need O(1) appends and pops from
both ends.

### TypeScript

```typescript
// TypeScript — singly linked list
class ListNode<T> {
  data: T;
  next: ListNode<T> | null;

  constructor(data: T, next: ListNode<T> | null = null) {
    this.data = data;
    this.next = next;
  }
}

class SinglyLinkedList<T> {
  head: ListNode<T> | null = null;
  private size_: number = 0;

  get length(): number {
    return this.size_;
  }

  prepend(data: T): void {
    this.head = new ListNode(data, this.head);
    this.size_++;
  }

  append(data: T): void {
    const newNode = new ListNode(data);
    if (this.head === null) {
      this.head = newNode;
    } else {
      let current = this.head;
      while (current.next !== null) {
        current = current.next;
      }
      current.next = newNode;
    }
    this.size_++;
  }

  insertAfter(prevNode: ListNode<T>, data: T): void {
    const newNode = new ListNode(data, prevNode.next);
    prevNode.next = newNode;
    this.size_++;
  }

  deleteHead(): T | null {
    if (this.head === null) return null;
    const data = this.head.data;
    this.head = this.head.next;
    this.size_--;
    return data;
  }

  find(data: T): ListNode<T> | null {
    let current = this.head;
    while (current !== null) {
      if (current.data === data) return current;
      current = current.next;
    }
    return null;
  }

  toString(): string {
    const parts: string[] = [];
    let current = this.head;
    while (current !== null) {
      parts.push(String(current.data));
      current = current.next;
    }
    return parts.join(" -> ") + " -> null";
  }
}

// Usage
const ll = new SinglyLinkedList<number>();
ll.prepend(30);
ll.prepend(20);
ll.prepend(10);
console.log(ll.toString()); // 10 -> 20 -> 30 -> null

const node20 = ll.find(20)!;
ll.insertAfter(node20, 25);
console.log(ll.toString()); // 10 -> 20 -> 25 -> 30 -> null
```

### Rust

```rust
// Rust — singly linked list (simplified, using Box)
type Link<T> = Option<Box<Node<T>>>;

struct Node<T> {
    data: T,
    next: Link<T>,
}

struct SinglyLinkedList<T> {
    head: Link<T>,
    size: usize,
}

impl<T: std::fmt::Display + PartialEq> SinglyLinkedList<T> {
    fn new() -> Self {
        SinglyLinkedList { head: None, size: 0 }
    }

    fn len(&self) -> usize {
        self.size
    }

    fn prepend(&mut self, data: T) {
        let new_node = Box::new(Node {
            data,
            next: self.head.take(),
        });
        self.head = Some(new_node);
        self.size += 1;
    }

    fn delete_head(&mut self) -> Option<T> {
        self.head.take().map(|node| {
            self.head = node.next;
            self.size -= 1;
            node.data
        })
    }

    fn peek(&self) -> Option<&T> {
        self.head.as_ref().map(|node| &node.data)
    }

    fn iter(&self) -> impl Iterator<Item = &T> {
        let mut current = &self.head;
        std::iter::from_fn(move || {
            current.as_ref().map(|node| {
                current = &node.next;
                &node.data
            })
        })
    }
}

impl<T: std::fmt::Display + PartialEq> std::fmt::Display for SinglyLinkedList<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let parts: Vec<String> = self.iter().map(|d| d.to_string()).collect();
        write!(f, "{} -> None", parts.join(" -> "))
    }
}

fn main() {
    let mut ll = SinglyLinkedList::new();
    ll.prepend(30);
    ll.prepend(20);
    ll.prepend(10);
    println!("{}", ll); // 10 -> 20 -> 30 -> None
}
```

Note: Rust's ownership model makes linked lists notoriously
tricky. The `Box`-based approach above is the simplest safe
implementation. For production use, consider `std::collections::LinkedList`
(doubly linked) or explore the excellent
[Learn Rust With Entirely Too Many Linked Lists](https://rust-unofficial.github.io/too-many-lists/)
tutorial for deeper coverage.

---

## Operation Complexity Summary

```
┌──────────────────────────┬──────────┬──────────┬──────────┐
│ Operation                │ Singly   │ Doubly   │ Array    │
├──────────────────────────┼──────────┼──────────┼──────────┤
│ Access by index          │ O(n)     │ O(n)     │ O(1)     │
│ Search                   │ O(n)     │ O(n)     │ O(n)     │
│ Insert at head           │ O(1)     │ O(1)     │ O(n)     │
│ Insert at tail (w/ ptr)  │ O(1)     │ O(1)     │ O(1)*    │
│ Insert after known node  │ O(1)     │ O(1)     │ O(n)     │
│ Delete head              │ O(1)     │ O(1)     │ O(n)     │
│ Delete known node        │ O(n)†    │ O(1)     │ O(n)     │
│ Delete tail              │ O(n)     │ O(1)     │ O(1)*    │
│ Space per element        │ data+ptr │ data+2ptr│ data     │
└──────────────────────────┴──────────┴──────────┴──────────┘
  * amortized, for dynamic arrays
  † O(n) because you need to find the predecessor; O(1) if you
    already have a reference to the predecessor
```

---

## What If We Tried to Do Random Access on a Linked List?

Arrays give you O(1) access to any element via index arithmetic:
`address = base + (index × element_size)`. Can we do the same
with a linked list?

### The Problem

Linked list nodes are scattered across memory. There's no formula
to compute where node #7 lives — you have to start at the head
and follow 7 pointers:

```
  Accessing element at index 4:

  Array — O(1):
  ┌────┬────┬────┬────┬────┬────┐
  │ 10 │ 20 │ 30 │ 40 │ 50 │ 60 │
  └────┴────┴────┴────┴────┴────┘
                        ▲
                        └── base + 4 × size = direct jump

  Linked list — O(n):
  [10] ──► [20] ──► [30] ──► [40] ──► [50] ──► [60]
   ▲        ▲        ▲        ▲        ▲
   │        │        │        │        │
  hop 0   hop 1    hop 2    hop 3    hop 4 ← found it!
```

### What If We Tried to Fix This?

**Idea 1: Store an array of pointers to each node.**

You could maintain a separate array where `index_array[i]` points
to the i-th node. Now access is O(1)! But:

- Inserting or deleting a node means updating the index array —
  shifting all entries after the change point. That's O(n), which
  defeats the purpose of using a linked list.
- You're now maintaining two data structures, doubling complexity.

**Idea 2: Cache every k-th node (skip list preview).**

Store pointers to every 10th node. To access node #47, jump to
node #40 (via the cache), then walk 7 steps. Access is now
O(n/k + k) instead of O(n). This is the seed of the **skip list**
idea, which we'll see in a later lesson — but it adds significant
complexity and still isn't O(1).

### The Takeaway

Random access and O(1) insertion/deletion at arbitrary positions
are fundamentally at odds. Arrays optimize for access. Linked
lists optimize for modification. Choosing between them depends on
your workload:

```
  Use an ARRAY when:              Use a LINKED LIST when:
  ─────────────────────           ──────────────────────────
  • Frequent random access        • Frequent insert/delete at
  • Iteration (cache-friendly)      known positions
  • Known or bounded size         • Unknown size, lots of growth
  • Sorting, binary search        • Need O(1) removal (e.g., LRU)
  • Memory efficiency matters     • No random access needed
```

---

## Exercises

1. **Trace insertion**: Starting with an empty singly linked list,
   trace the state of the list after each operation: `prepend(3)`,
   `prepend(2)`, `prepend(1)`, `append(4)`, `insert_after(node_2, 2.5)`.
   Draw the node diagram after each step.

2. **Delete the k-th node**: Write a function that deletes the
   node at index `k` (0-indexed) from a singly linked list.
   What is the time complexity? Why can't you do better than O(k)
   for a singly linked list?

3. **Reverse a singly linked list**: Write a function that
   reverses a singly linked list in-place (without creating new
   nodes). Hint: you need three pointers — `prev`, `current`, and
   `next`. Trace your algorithm on the list `1 -> 2 -> 3 -> 4`.

4. **Detect a cycle**: Given a singly linked list that might
   contain a cycle (the last node points back to some earlier
   node instead of null), write a function to detect whether a
   cycle exists. Can you do it in O(1) space? (Hint: Floyd's
   tortoise and hare algorithm — use two pointers moving at
   different speeds.)

5. **Doubly linked list deletion**: Implement a doubly linked
   list with a `delete_node(node)` method that removes a given
   node in O(1). Test it by building a list `[1, 2, 3, 4, 5]`,
   deleting the middle node (3), then deleting the head (1),
   then deleting the tail (5).

6. **Sentinel node refactor**: Take the singly linked list
   implementation from this lesson and refactor it to use a
   sentinel node. How many `if` statements can you eliminate
   from `prepend`, `append`, and `delete_head`?

---

**Previous**: [Lesson 03 — Arrays and Dynamic Arrays](./03-arrays-and-dynamic-arrays.md)
**Next**: [Lesson 05 — Stacks: Last In, First Out](./05-stacks.md)
