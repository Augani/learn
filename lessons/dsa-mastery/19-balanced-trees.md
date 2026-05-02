# Lesson 19: Balanced Binary Search Trees — AVL and Red-Black Trees

> **Analogy**: Imagine a bookshelf mounted on a wall with a smart
> hinge system. If too many heavy books pile up on one side, the
> shelf automatically shifts and redistributes the weight so it
> stays level. A balanced search tree does the same thing. It does
> not wait until search becomes slow. It continuously repairs its
> shape as items are inserted and deleted.

---

## Why This Matters

The previous lesson exposed the fatal weakness of ordinary BSTs:
they can become tall, skinny chains.

That means a plain BST can go from:

$$
O(\log n)
$$

to:

$$
O(n)
$$

without violating the BST property at all.

Balanced BSTs fix that by maintaining extra structure that keeps
the height under control.

This lesson covers the two canonical families:

- **AVL trees**: stricter balance, faster lookups, more rotations
- **Red-black trees**: looser balance, fewer rotations, widely used

By the end, you will understand:

- Why self-balancing is necessary
- How rotations repair local shape problems
- AVL balance factors and the four rotation cases
- Red-black tree coloring rules and why they limit height
- The practical trade-off between stricter and looser balancing

> **Cross-reference**: The earlier
> [`../data-structures/10-balanced-trees.md`](../data-structures/10-balanced-trees.md)
> introduces balanced-tree motivation and red-black-tree basics.
> This lesson goes deeper on AVL rotations, red-black invariants,
> and the design trade-offs between the two families.

---

## Why Self-Balancing Trees Exist

A plain BST stores order but does not control shape.

```
  SAME VALUES, TWO SHAPES

  Balanced-ish BST               Degenerate BST

          [4]                        [1]
         /   \                         \
       [2]   [6]                      [2]
      / \   / \                         \
    [1][3][5][7]                       [3]
                                           \
                                           [4]
                                              \
                                              [5]
                                                 \
                                                 [6]
                                                    \
                                                    [7]

  Height ~ 2                    Height ~ 6
  Search ~ O(log n)             Search ~ O(n)
```

The values are identical. The invariant is identical. Only the
shape changed.

So the mission of a balanced BST is:

> preserve the BST property while preventing the tree from
> becoming too tall

That sounds global, but the repair operations are local.

---

## Rotations — The Core Repair Operation

Almost every self-balancing BST relies on rotations.

A rotation changes a few pointers while preserving in-order
sortedness.

### Left Rotation

```
  LEFT ROTATION AT A

      A                    B
     / \                  / \
    x   B      ->        A   z
       / \              / \
      y   z            x   y

  In-order before:  x, A, y, B, z
  In-order after:   x, A, y, B, z
  Same sorted order. Better shape.
```

### Right Rotation

```
  RIGHT ROTATION AT B

        B                A
       / \              / \
      A   z    ->      x   B
     / \                  / \
    x   y                y   z

  In-order before:  x, A, y, B, z
  In-order after:   x, A, y, B, z
```

This is the magic of rotations: they repair shape without breaking
the BST ordering.

---

## AVL Trees — Strictly Balanced

An AVL tree is a BST that maintains a tight balance condition at
every node.

### Balance Factor

For each node:

$$
\text{balance factor} = \text{height(left)} - \text{height(right)}
$$

AVL requires the balance factor to be one of:

- `-1`
- `0`
- `+1`

If any node goes outside that range, the tree rotates to repair
it.

### Why This Helps

Because AVL maintains stricter local balance than red-black trees,
the overall height stays very close to logarithmic. That gives
excellent lookup performance.

The downside is that insertions and deletions may trigger more
rebalancing work.

---

## AVL Rotation Cases

There are four classic imbalance patterns.

### 1. LL Case

The left subtree of the left child became too heavy.

Fix: one right rotation.

```
  LL IMBALANCE

        [30]
        /
      [20]
      /
    [10]

  Too heavy on the left-left side.

  Right rotate at 30:

        [20]
       /    \
     [10]  [30]
```

### 2. RR Case

The right subtree of the right child became too heavy.

Fix: one left rotation.

```
  RR IMBALANCE

    [10]
       \
       [20]
          \
          [30]

  Left rotate at 10:

        [20]
       /    \
     [10]  [30]
```

### 3. LR Case

The left child is heavy, but its heavy side is to the right.

Fix:

1. left rotate the left child
2. right rotate the root

```
  LR IMBALANCE

        [30]
        /
      [10]
         \
         [20]

  Step 1: left rotate at 10

        [30]
        /
      [20]
      /
    [10]

  Step 2: right rotate at 30

        [20]
       /    \
     [10]  [30]
```

### 4. RL Case

The right child is heavy, but its heavy side is to the left.

Fix:

1. right rotate the right child
2. left rotate the root

```
  RL IMBALANCE

    [10]
       \
       [30]
       /
     [20]

  Step 1: right rotate at 30

    [10]
       \
       [20]
          \
          [30]

  Step 2: left rotate at 10

        [20]
       /    \
     [10]  [30]
```

These four cases are the standard AVL repair vocabulary. Once you
internalize them, balanced BSTs stop feeling mystical.

---

## AVL Insert Example

Insert `30`, then `20`, then `10`.

```
  After inserting 30:
      [30]

  After inserting 20:
      [30]
      /
    [20]

  After inserting 10:
        [30]
        /
      [20]
      /
    [10]

  Node 30 now has balance factor +2.
  This is an LL case.

  Right rotate at 30:

        [20]
       /    \
     [10]  [30]
```

After a local repair, global height quality is restored.

---

## Red-Black Trees — Looser Balance, Fewer Repairs

AVL trees are strict. Red-black trees are more relaxed.

Each node has a color:

- red
- black

And the tree obeys a set of rules.

### Red-Black Rules

1. Every node is red or black.
2. The root is black.
3. Every null leaf is considered black.
4. A red node cannot have a red child.
5. Every path from a node to a descendant null leaf has the same
   number of black nodes.

```
  RED-BLACK EXAMPLE

              [13 B]
             /      \
          [8 R]    [17 R]
          /  \      /   \
       [1 B][11 B][15 B][25 B]
                               /
                            [22 R]

  B = black, R = red
```

### Why These Rules Control Height

The crucial ideas are:

- no two reds can be adjacent
- all root-to-leaf paths have the same black height

So the longest path can only be at most about twice the shortest
path, because red nodes can only appear interleaved with black
nodes.

That keeps the height bounded by O(log n), though not as tightly
as AVL.

---

## Red-Black Tree Insertion Intuition

A common insertion strategy is:

1. Insert as in a normal BST
2. Color the new node red
3. Repair any red-black rule violations using recoloring and
   rotations

Why insert red instead of black?

Because inserting black would immediately change the black-height
of one path, which is harder to repair. Red insertion is usually a
smaller disturbance.

### Typical local violation

```
  Suppose we insert a red node under a red parent:

        [10 B]
        /
      [5 R]
      /
    [2 R]   <- violation: red parent with red child
```

The repair depends on the "uncle" node and may involve:

- recoloring only
- one rotation
- two rotations

The full case analysis is longer than AVL, but the big picture is
simple: preserve the coloring rules while keeping height
logarithmic.

---

## AVL vs Red-Black Trees

This is the core design trade-off.

### AVL Trees

- More strictly balanced
- Shorter height on average
- Faster lookups
- More rotations during updates
- Good when reads dominate writes

### Red-Black Trees

- Less strictly balanced
- Slightly taller trees on average
- Fewer rotations during updates
- Good all-around update performance
- Common in standard libraries

```
  DESIGN TRADE-OFF

  AVL:
    tighter balance -> shorter tree -> faster search
    but more repair work on insert/delete

  Red-black:
    looser balance -> slightly taller tree
    but fewer structural changes during updates
```

There is no universal winner. The right answer depends on the
workload.

---

## Why We Do Not Just Rebuild the Tree From Scratch Every Time

That idea sounds simple:

1. insert the new value somewhere
2. flatten the tree to a sorted list
3. rebuild a perfectly balanced tree

But this is wildly too expensive.

If rebuild costs O(n) after each insertion, then `n` insertions
cost:

$$
O(n^2)
$$

Balanced trees are powerful precisely because they achieve local
repair:

- a few recolorings
- a few pointer changes
- sometimes one or two rotations

That is much cheaper than global reconstruction.

---

## Complexity Summary

```
  BALANCED BSTS

  Operation     AVL Tree      Red-Black Tree
  ------------------------------------------
  Search        O(log n)      O(log n)
  Insert        O(log n)      O(log n)
  Delete        O(log n)      O(log n)
  Balance       Stricter      Looser
  Rotations     More common   Less common
```

Both guarantee logarithmic height. Their difference is not in
asymptotic complexity, but in constants and workload behavior.

---

## Technical Deep-Dive: Rotation Helpers

The balancing logic is complicated, but the rotation primitives
are compact.

### Python

```python
class Node:
    def __init__(self, val: int):
        self.val = val
        self.left: Node | None = None
        self.right: Node | None = None
        self.height = 1


def left_rotate(root: Node) -> Node:
    new_root = root.right
    if new_root is None:
        return root

    transferred_subtree = new_root.left
    new_root.left = root
    root.right = transferred_subtree

    root.height = 1 + max(get_height(root.left), get_height(root.right))
    new_root.height = 1 + max(get_height(new_root.left), get_height(new_root.right))
    return new_root


def right_rotate(root: Node) -> Node:
    new_root = root.left
    if new_root is None:
        return root

    transferred_subtree = new_root.right
    new_root.right = root
    root.left = transferred_subtree

    root.height = 1 + max(get_height(root.left), get_height(root.right))
    new_root.height = 1 + max(get_height(new_root.left), get_height(new_root.right))
    return new_root


def get_height(node: Node | None) -> int:
    return 0 if node is None else node.height
```

### TypeScript

```typescript
class Node {
  val: number;
  left: Node | null = null;
  right: Node | null = null;
  height = 1;

  constructor(val: number) {
    this.val = val;
  }
}

function getHeight(node: Node | null): number {
  return node === null ? 0 : node.height;
}

function leftRotate(root: Node): Node {
  const newRoot = root.right;
  if (newRoot === null) {
    return root;
  }

  const transferredSubtree = newRoot.left;
  newRoot.left = root;
  root.right = transferredSubtree;

  root.height = 1 + Math.max(getHeight(root.left), getHeight(root.right));
  newRoot.height = 1 + Math.max(getHeight(newRoot.left), getHeight(newRoot.right));
  return newRoot;
}

function rightRotate(root: Node): Node {
  const newRoot = root.left;
  if (newRoot === null) {
    return root;
  }

  const transferredSubtree = newRoot.right;
  newRoot.right = root;
  root.left = transferredSubtree;

  root.height = 1 + Math.max(getHeight(root.left), getHeight(root.right));
  newRoot.height = 1 + Math.max(getHeight(newRoot.left), getHeight(newRoot.right));
  return newRoot;
}
```

### Rust

```rust
#[derive(Debug)]
struct Node {
    val: i32,
    height: i32,
    left: Option<Box<Node>>,
    right: Option<Box<Node>>,
}

fn height(node: &Option<Box<Node>>) -> i32 {
    node.as_ref().map_or(0, |current| current.height)
}

fn update_height(node: &mut Box<Node>) {
    node.height = 1 + height(&node.left).max(height(&node.right));
}

fn left_rotate(mut root: Box<Node>) -> Box<Node> {
    let mut new_root = root.right.take().expect("right child required for left rotation");
    let transferred = new_root.left.take();
    root.right = transferred;
    update_height(&mut root);
    new_root.left = Some(root);
    update_height(&mut new_root);
    new_root
}

fn right_rotate(mut root: Box<Node>) -> Box<Node> {
    let mut new_root = root.left.take().expect("left child required for right rotation");
    let transferred = new_root.right.take();
    root.left = transferred;
    update_height(&mut root);
    new_root.right = Some(root);
    update_height(&mut new_root);
    new_root
}
```

These helpers are the mechanical heart of many self-balancing tree
implementations.

---

## Exercises

1. For each AVL case LL, RR, LR, and RL, draw the imbalance and
   the repaired tree after the needed rotation sequence.
2. Why does a rotation preserve BST sorted order even though it
   changes parent-child relationships?
3. Explain why red-black trees allow slightly worse balance than
   AVL trees while still guaranteeing O(log n) height.
4. If your workload is 95% lookups and 5% inserts, which would you
   prefer: AVL or red-black? Defend the choice.
5. If your workload is update-heavy, why might red-black trees be
   preferable?
6. Why is rebuilding a perfectly balanced tree after every update
   a bad idea asymptotically?

---

## Key Takeaways

- Plain BSTs fail because they do not control shape.
- Balanced BSTs preserve order while actively limiting height.
- Rotations are local pointer transformations that preserve the
  in-order sorted sequence.
- AVL trees maintain stricter balance and often give faster
  lookups.
- Red-black trees maintain looser balance and usually perform
  fewer structural repairs on updates.
- Both achieve O(log n) search, insert, and delete, but with
  different engineering trade-offs.

The next lesson shifts from ordered-search trees to a different
tree family with a different goal: heaps, where the top priority
value rises to the root.

---

**Previous**: [Lesson 18 — Binary Search Trees](./18-binary-search-trees.md)
**Next**: [Lesson 20 — Heaps and Priority Queues](./20-heaps-and-priority-queues.md)