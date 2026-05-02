# Lesson 21: B-Trees and B+ Trees — Disk-Oriented Search Trees

> **Analogy**: Imagine a huge library with millions of books.
> You would not build the catalog as a narrow chain of tiny index
> cards where each lookup forces you to walk through many levels.
> Instead, each catalog page would contain many keys at once, so a
> single page read lets you eliminate a large portion of the
> search space. That is the core idea of B-trees: make each node
> wide, so the tree becomes shallow.

---

## Why This Matters

Binary search trees were designed for ordered lookup in memory.
But once data grows beyond cache or RAM, the real bottleneck is
not comparison count. It is I/O.

Disk and page reads are expensive compared with pointer chasing in
memory. So the design goal changes from:

> minimize tree height in a binary structure

to:

> minimize the number of page reads

B-trees and B+ trees are the answer.

They matter because they power:

- database indexes
- key-value stores
- filesystems
- ordered maps designed for cache locality

By the end of this lesson, you will understand:

- Why multi-way search trees beat binary trees on storage devices
- B-tree node structure and invariants
- Insertion by splitting full nodes
- Deletion via redistribution or merging
- Why B+ trees store all data in leaves
- Why databases overwhelmingly prefer B+ trees

---

## The Big Idea: Wider Nodes, Shallower Trees

A BST node stores one key and has up to two children.

A B-tree node stores many keys and has many children.

```
  BINARY SEARCH TREE NODE

       [40]
       /  \
    <40   >40


  B-TREE NODE

  [10 | 20 | 30 | 40]
    |    |    |    |    |
   <10  10-20 20-30 30-40 >40
```

One B-tree node can eliminate large chunks of the key space in a
single access.

That makes the tree dramatically shorter.

```
  1,000,000 KEYS

  Binary tree branching factor: about 2
  Height: around 20

  B-tree branching factor: often 100+ in practice
  Height: around 3 or 4
```

That difference is enormous when each level might cost a page read.

---

## What Is a B-Tree?

A B-tree is a balanced multi-way search tree.

For a B-tree of minimum degree `t`:

- each node can hold at most `2t - 1` keys
- each internal node can have at most `2t` children
- every non-root internal node has at least `t` children
- every non-root node has at least `t - 1` keys
- all leaves are at the same depth
- keys inside a node are sorted

### Node Layout

```
  B-TREE NODE WITH 3 KEYS

  [ 20 | 40 | 70 ]
     |     |     |
   c0 c1  c2 c3

  child c0 contains keys < 20
  child c1 contains keys between 20 and 40
  child c2 contains keys between 40 and 70
  child c3 contains keys > 70
```

The node itself acts like a small sorted array plus pointers.

---

## Search in a B-Tree

Searching works like a hybrid of:

- binary search inside one node
- tree descent between nodes

### Example

```
  ROOT: [20 | 40 | 60 | 80]

  Search for 67:
  67 is > 60 and < 80
  therefore follow child between 60 and 80

  NEXT NODE: [61 | 65 | 67 | 72]
  found 67 ✓
```

Because one node covers many keys, each descent step is much more
informative than in a binary tree.

---

## Why B-Trees Minimize Disk I/O

This is the real reason they exist.

Suppose a node is sized to match a disk page or a cache-friendly
memory block. Then one read fetches:

- many keys
- many child references

That means one I/O gives you a lot of routing information.

```
  DISK PAGE VIEW

  One page read loads:
  [ 103 | 145 | 209 | 310 | 402 | ... ]
   ptr   ptr   ptr   ptr   ptr   ptr

  Instead of learning about just one split point,
  you learn about many split points at once.
```

That is why databases use B-trees rather than binary search trees
for indexes.

---

## Insertion — Split Full Nodes

When inserting into a B-tree, we search down to the correct leaf.

If the target node is full, we split it.

### Split Example

Suppose a node can hold at most 4 keys.

```
  FULL NODE

  [10 | 20 | 30 | 40]

  Insert 25
```

If we inserted directly, the node would overflow. So we split.

```
  Split around the median key 30:

              [30]
             /    \
     [10 | 20 | 25]   [40]
```

The middle key moves up to the parent. The remaining keys split
into left and right children.

### Cascading Splits

If the parent is also full, the split may continue upward.

```
  INSERTION WITH CASCADING SPLIT

  Leaf overflows -> split leaf
  Parent receives promoted key
  Parent now overflows -> split parent
  Root overflows -> split root, tree grows by one level
```

This is the only way the tree gains height.

---

## Deletion — Redistribution or Merging

Deletion in B-trees is more involved because nodes must not fall
below their minimum occupancy.

There are two main repair strategies.

### 1. Redistribution (Borrowing)

If a sibling has extra keys, a key can move through the parent to
rebalance the underfull node.

```
  BEFORE REDISTRIBUTION

        Parent: [40]
         /          \
    [10 | 20]    [50 | 60 | 70]

  Suppose the left child becomes underfull.
  Borrow from the right sibling through the parent.

  AFTER REDISTRIBUTION

        Parent: [50]
         /          \
    [10 | 20 | 40] [60 | 70]
```

### 2. Merging

If siblings do not have spare keys, merge two children together
using a separator key from the parent.

```
  BEFORE MERGE

        Parent: [40]
         /        \
      [10]       [50]

  AFTER MERGE

        [10 | 40 | 50]
```

If this causes the parent to underflow, the repair may propagate
upward.

The big pattern is familiar now:

- local overflow -> split
- local underflow -> redistribute or merge

That is how balanced tree structures survive updates.

---

## B+ Trees — What Databases Usually Use

B+ trees are a variant of B-trees with two important design
choices:

1. internal nodes store only routing keys
2. all actual records live in leaf nodes

Leaves are also linked together in sorted order.

### B+ Tree Layout

```
                   [30 | 60]
                  /    |    \
                 /     |     \
       [10 | 20] [30 | 40] [60 | 70 | 80]
            ->         ->          ->
          leaf       leaf        leaf

  Internal node tells you where to go.
  Leaves hold the actual data and are linked left-to-right.
```

### Why This Is Great for Databases

- **Range queries are fast**: find the first matching leaf, then
  follow the leaf links
- **Internal nodes are compact**: they store routing info only,
  so more keys fit per page
- **All lookups end at leaves**: predictable path structure

This makes B+ trees ideal for queries like:

```sql
SELECT * FROM users WHERE age BETWEEN 20 AND 29;
```

The database finds the first relevant leaf, then scans forward
through linked leaves.

---

## B-Tree vs B+ Tree

```
  B-TREE
  - keys and data may live in internal nodes and leaves
  - point lookups are good
  - range scans are less elegant

  B+ TREE
  - internal nodes are routing only
  - all data is stored in leaves
  - leaves are linked for fast range scans
  - standard choice for database indexes
```

The difference is subtle but practical. B+ trees are tuned for
real storage workloads.

---

## Technical Deep-Dive: Simplified Search Logic

Full B-tree insertion and deletion implementations are long and
fussy. For this lesson, the code focuses on the core node-search
logic and how multi-key nodes are traversed.

### Python

```python
class BTreeNode:
    def __init__(self, keys: list[int], children: list["BTreeNode"] | None = None, leaf: bool = True):
        self.keys = keys
        self.children = children or []
        self.leaf = leaf


def search(node: BTreeNode | None, target: int) -> bool:
    if node is None:
        return False

    index = 0
    while index < len(node.keys) and target > node.keys[index]:
        index += 1

    if index < len(node.keys) and node.keys[index] == target:
        return True

    if node.leaf:
        return False

    return search(node.children[index], target)
```

### TypeScript

```typescript
class BTreeNode {
  keys: number[];
  children: BTreeNode[];
  leaf: boolean;

  constructor(keys: number[], children: BTreeNode[] = [], leaf = true) {
    this.keys = keys;
    this.children = children;
    this.leaf = leaf;
  }
}

function search(node: BTreeNode | null, target: number): boolean {
  if (node === null) {
    return false;
  }

  let index = 0;
  while (index < node.keys.length && target > node.keys[index]) {
    index += 1;
  }

  if (index < node.keys.length && node.keys[index] === target) {
    return true;
  }

  if (node.leaf) {
    return false;
  }

  return search(node.children[index], target);
}
```

### Rust

```rust
#[derive(Debug)]
struct BTreeNode {
    keys: Vec<i32>,
    children: Vec<BTreeNode>,
    leaf: bool,
}

fn search(node: Option<&BTreeNode>, target: i32) -> bool {
    let Some(node) = node else {
        return false;
    };

    let mut index = 0usize;
    while index < node.keys.len() && target > node.keys[index] {
        index += 1;
    }

    if index < node.keys.len() && node.keys[index] == target {
        return true;
    }

    if node.leaf {
        return false;
    }

    search(node.children.get(index), target)
}
```

These snippets capture the key idea: search within a node, then
descend into exactly one child interval.

---

## What If Databases Used Binary Search Trees Instead?

They would be much taller and much worse for storage access.

A binary tree with millions of records may require around 20 node
visits to reach a leaf. A B-tree might require only 3 or 4.

If each node visit risks a page read, that difference is massive.

Also, binary trees are poor for wide sequential range scans on
storage because neighboring values are not naturally packed into
contiguous leaf pages the way B+ trees are.

So the short answer is:

- in-memory ordered sets can use binary-like trees
- storage-oriented indexes want wide shallow nodes

This is a perfect example of hardware-aware data-structure design.

---

## Exercises

1. Draw a B-tree node with keys `[20, 40, 60]` and label the four
   child intervals precisely.
2. Explain why all leaves of a B-tree must be at the same depth.
3. Trace insertion of `10, 20, 30, 40, 50` into a small B-tree and
   show the first split.
4. Describe the difference between redistribution and merging in
   B-tree deletion repair.
5. Why are linked leaves such a big advantage for B+ trees?
6. Compare the likely number of page reads for a binary search tree
   and a B+ tree with one million keys.

---

## Key Takeaways

- B-trees are balanced multi-way search trees designed to reduce
  I/O by making nodes wide and trees shallow.
- Insertion is handled by splitting full nodes.
- Deletion is handled by redistribution or merging when nodes
  underflow.
- B+ trees store all records in leaves and link those leaves for
  efficient range scans.
- Databases prefer B+ trees because storage access patterns matter
  more than elegant binary structure.

The next lesson moves back from storage-oriented trees to a
character-oriented structure: tries, where shared prefixes become
the main organizing principle.

---

**Previous**: [Lesson 20 — Heaps and Priority Queues](./20-heaps-and-priority-queues.md)
**Next**: [Lesson 22 — Tries — Prefix Trees](./22-tries.md)