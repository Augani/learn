# Lesson 18: Binary Search Trees

> **Analogy**: Imagine a very disciplined bookshelf. Every book
> to the left of a given book comes earlier alphabetically, and
> every book to the right comes later. If that rule is maintained
> at every shelf split, you can find a title by repeatedly making
> a local decision: left or right. That is the essence of a
> binary search tree. It turns a hierarchy into an ordered
> hierarchy.

---

## Why This Matters

In the previous lesson, trees gave us hierarchy. Binary search
trees add something more powerful: **order**.

That ordering invariant lets us do the tree equivalent of binary
search:

- go left if the target is smaller
- go right if the target is larger

When the tree stays reasonably balanced, search, insert, and
delete all take O(log n) time. That is what makes BSTs one of the
classic foundational data structures.

But BSTs also teach a crucial engineering lesson: a beautiful
invariant is not enough. Structure quality matters. If the tree
becomes degenerate, performance collapses from O(log n) to O(n).

By the end of this lesson, you will understand:

- The BST ordering property
- How search, insertion, and deletion work
- The three deletion cases
- In-order successor and predecessor
- Why inserting sorted data can destroy performance
- Why self-balancing trees exist at all

> **Connection to the previous lesson**:
> [Lesson 17: Binary Trees and Traversals](./17-binary-trees.md)
> gave us the raw tree vocabulary. This lesson adds the invariant
> that turns a generic binary tree into a searchable ordered
> structure.

---

## The BST Property

A binary search tree is a binary tree where, for every node:

- all values in the left subtree are smaller than the node value
- all values in the right subtree are larger than the node value
- both subtrees are themselves BSTs

```
  VALID BST

              [8]
             /   \
           [3]   [10]
          /  \      \
        [1]  [6]    [14]
            /  \    /
          [4] [7] [13]

  Left of 8:  3,1,6,4,7   all < 8
  Right of 8: 10,14,13    all > 8
```

The important detail is that the rule is **global through each
subtree**, not just about immediate children.

```
  INVALID BST

              [8]
             /   \
           [3]   [10]
          /  \      \
        [1] [12]    [14]

  12 is to the left of 8, so it should be < 8.
  It is not. Therefore this is NOT a BST.
```

This is one of the first places in DSA where a local-looking rule
actually has recursive global consequences.

---

## Why Search Is Fast

In an ordinary binary tree, finding a value may require checking
every node. In a BST, each comparison eliminates half of the
remaining structure in the ideal case.

### Search Example

Find `6` in this BST:

```
              [8]
             /   \
           [3]   [10]
          /  \      \
        [1]  [6]    [14]
            /  \    /
          [4] [7] [13]

  Step 1: compare with 8
          6 < 8 -> go LEFT

  Step 2: compare with 3
          6 > 3 -> go RIGHT

  Step 3: compare with 6
          FOUND ✓
```

If the tree has height `h`, search takes O(h).

- Balanced BST: `h = O(log n)`
- Skewed BST: `h = O(n)`

So the real complexity is not magically O(log n). It is O(height).

---

## In-Order Traversal Gives Sorted Order

This is one of the most important BST facts.

If you perform an in-order traversal:

- left subtree
- node
- right subtree

you get the values in ascending sorted order.

```
              [8]
             /   \
           [3]   [10]
          /  \      \
        [1]  [6]    [14]
            /  \    /
          [4] [7] [13]

  In-order result:
  [1, 3, 4, 6, 7, 8, 10, 13, 14]
```

This makes BSTs feel like a bridge between:

- arrays of sorted data
- recursively linked tree structure

That dual identity is why they are so conceptually important.

---

## Insertion

Insertion follows the same decision path as search.

1. Start at the root
2. Compare the new value
3. Go left or right accordingly
4. When you hit a null position, insert the new node there

### Inserting 5

```
  START

              [8]
             /   \
           [3]   [10]
          /  \      \
        [1]  [6]    [14]
            /  \    /
          [4] [7] [13]

  Insert 5:

  5 < 8 -> go left
  5 > 3 -> go right
  5 < 6 -> go left
  5 > 4 -> go right
  null reached -> insert here

              [8]
             /   \
           [3]   [10]
          /  \      \
        [1]  [6]    [14]
            /  \    /
          [4] [7] [13]
             \
             [5]
```

### Why insertion is elegant

You never need to reorder the whole tree. You only follow one
root-to-leaf path. That is why insertion is O(height).

---

## Deletion — The Hardest BST Operation

Search and insertion are straightforward. Deletion is where BSTs
become interesting because removing a node must preserve the BST
property.

There are three cases.

### Case 1: Delete a Leaf

If the node has no children, remove it directly.

```
  Delete leaf 4

      [6]                 [6]
     /   \      ->          \
   [4]   [8]               [8]
```

Easy: no subtree structure needs repair.

### Case 2: Delete a Node With One Child

Replace the node with its only child.

```
  Delete 10 (one child: 14)

        [8]                  [8]
       /   \                /   \
     [3]   [10]    ->     [3]   [14]
              \
              [14]
```

The child simply moves up into the deleted node's position.

### Case 3: Delete a Node With Two Children

This is the important one.

You cannot simply remove the node, because you would disconnect
both subtrees. Instead, replace it with either:

- its **in-order successor**: the smallest value in the right subtree
- or its **in-order predecessor**: the largest value in the left subtree

Most textbook explanations use the successor.

#### Delete 3 Using Its Successor

```
  BEFORE

              [8]
             /   \
           [3]   [10]
          /  \      \
        [1]  [6]    [14]
            /  \    /
          [4] [7] [13]

  Node to delete: 3
  Successor = smallest value in right subtree of 3
            = leftmost node under 6
            = 4

  Replace 3 with 4, then delete original 4 leaf

  AFTER

              [8]
             /   \
           [4]   [10]
          /  \      \
        [1]  [6]    [14]
             \      /
             [7]  [13]
```

Why successor works:

- it is the next larger value after the deleted node
- it preserves left < node < right ordering

---

## Successor and Predecessor

These are useful concepts even outside deletion.

- **In-order successor**: next larger value in sorted order
- **In-order predecessor**: next smaller value in sorted order

### Successor rule

If a node has a right subtree, its successor is the leftmost node
of that right subtree.

```
  Successor of 8:

              [8]
                 \
                 [10]
                 /  \
               [9]  [14]

  Go right once, then left as far as possible -> 9
```

### Predecessor rule

If a node has a left subtree, its predecessor is the rightmost
node of that left subtree.

```
  Predecessor of 8:

              [8]
             /
           [3]
             \
             [6]
               \
               [7]

  Go left once, then right as far as possible -> 7
```

These ideas matter later for ordered sets, balanced trees, and
range queries.

---

## The Degenerate Tree Problem

BSTs are wonderful when balanced. They are disappointing when
they are not.

### Balanced-ish shape

```
              [8]
             /   \
           [4]   [12]
          / \    /  \
        [2] [6][10][14]

  Height ~ log n
  Search path is short
```

### Degenerate shape

```
  Insert 1, then 2, then 3, then 4, then 5 into an empty BST:

  [1]
     \
     [2]
        \
        [3]
           \
           [4]
              \
              [5]

  Height = n - 1
  Search becomes a linear scan down a chain
```

This is the core flaw of ordinary BSTs.

The tree still satisfies the BST property, but its shape is poor.
So search, insert, and delete degrade from:

$$
O(\log n)
$$

to:

$$
O(n)
$$

That is exactly why balanced BSTs exist, which is the topic of
the next lesson.

---

## Why Sorted Insertions Are So Bad

If you insert values in sorted order into a plain BST:

```
1, 2, 3, 4, 5, 6, 7
```

each new value becomes the right child of the previous one.

Likewise, reverse-sorted insertion creates a purely left-leaning
chain.

The structure is still "correct" logically, but useless as an
efficient search tree.

This is one of the best examples in DSA of a subtle but crucial
idea:

> correctness of the invariant does not guarantee performance

Performance depends on both the invariant and the shape.

---

## Complexity Summary

```
  BST OPERATIONS

  Operation     Balanced BST     Degenerate BST
  ---------------------------------------------
  Search        O(log n)         O(n)
  Insert        O(log n)         O(n)
  Delete        O(log n)         O(n)
  In-order      O(n)             O(n)
```

The operation logic is the same in both cases. Only the height
changes. That is what drives the complexity change.

---

## Technical Deep-Dive: Implementations

### Python

```python
class TreeNode:
    def __init__(self, val: int):
        self.val = val
        self.left: TreeNode | None = None
        self.right: TreeNode | None = None


def search(node: TreeNode | None, target: int) -> TreeNode | None:
    if node is None or node.val == target:
        return node
    if target < node.val:
        return search(node.left, target)
    return search(node.right, target)


def insert(node: TreeNode | None, value: int) -> TreeNode:
    if node is None:
        return TreeNode(value)
    if value < node.val:
        node.left = insert(node.left, value)
    elif value > node.val:
        node.right = insert(node.right, value)
    return node


def min_value_node(node: TreeNode) -> TreeNode:
    current = node
    while current.left is not None:
        current = current.left
    return current


def delete(node: TreeNode | None, value: int) -> TreeNode | None:
    if node is None:
        return None

    if value < node.val:
        node.left = delete(node.left, value)
    elif value > node.val:
        node.right = delete(node.right, value)
    else:
        if node.left is None:
            return node.right
        if node.right is None:
            return node.left

        successor = min_value_node(node.right)
        node.val = successor.val
        node.right = delete(node.right, successor.val)

    return node
```

### TypeScript

```typescript
class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;

  constructor(val: number) {
    this.val = val;
    this.left = null;
    this.right = null;
  }
}

function search(node: TreeNode | null, target: number): TreeNode | null {
  if (node === null || node.val === target) {
    return node;
  }
  if (target < node.val) {
    return search(node.left, target);
  }
  return search(node.right, target);
}

function insert(node: TreeNode | null, value: number): TreeNode {
  if (node === null) {
    return new TreeNode(value);
  }
  if (value < node.val) {
    node.left = insert(node.left, value);
  } else if (value > node.val) {
    node.right = insert(node.right, value);
  }
  return node;
}

function minValueNode(node: TreeNode): TreeNode {
  let current = node;
  while (current.left !== null) {
    current = current.left;
  }
  return current;
}

function deleteNode(node: TreeNode | null, value: number): TreeNode | null {
  if (node === null) {
    return null;
  }

  if (value < node.val) {
    node.left = deleteNode(node.left, value);
    return node;
  }

  if (value > node.val) {
    node.right = deleteNode(node.right, value);
    return node;
  }

  if (node.left === null) {
    return node.right;
  }
  if (node.right === null) {
    return node.left;
  }

  const successor = minValueNode(node.right);
  node.val = successor.val;
  node.right = deleteNode(node.right, successor.val);
  return node;
}
```

### Rust

```rust
#[derive(Debug)]
struct TreeNode {
    val: i32,
    left: Option<Box<TreeNode>>,
    right: Option<Box<TreeNode>>,
}

fn search(node: &Option<Box<TreeNode>>, target: i32) -> bool {
    match node {
        None => false,
        Some(current) => {
            if target == current.val {
                true
            } else if target < current.val {
                search(&current.left, target)
            } else {
                search(&current.right, target)
            }
        }
    }
}

fn insert(node: &mut Option<Box<TreeNode>>, value: i32) {
    match node {
        None => {
            *node = Some(Box::new(TreeNode {
                val: value,
                left: None,
                right: None,
            }));
        }
        Some(current) => {
            if value < current.val {
                insert(&mut current.left, value);
            } else if value > current.val {
                insert(&mut current.right, value);
            }
        }
    }
}

fn min_value(node: &TreeNode) -> i32 {
    let mut current = node;
    while let Some(left) = current.left.as_deref() {
        current = left;
    }
    current.val
}

fn delete(node: Option<Box<TreeNode>>, value: i32) -> Option<Box<TreeNode>> {
    match node {
        None => None,
        Some(mut current) => {
            if value < current.val {
                current.left = delete(current.left, value);
                Some(current)
            } else if value > current.val {
                current.right = delete(current.right, value);
                Some(current)
            } else {
                match (current.left, current.right) {
                    (None, None) => None,
                    (Some(left), None) => Some(left),
                    (None, Some(right)) => Some(right),
                    (Some(left), Some(right)) => {
                        let successor = min_value(&right);
                        let new_right = delete(Some(right), successor);
                        Some(Box::new(TreeNode {
                            val: successor,
                            left: Some(left),
                            right: new_right,
                        }))
                    }
                }
            }
        }
    }
}
```

---

## What If We Insert Sorted Data Into a BST?

Then we accidentally destroy the very speed we wanted.

```
  Insert: 10, 20, 30, 40, 50

  Result:

  [10]
      \
      [20]
          \
          [30]
              \
              [40]
                  \
                  [50]
```

This is no better than a linked list for search.

So a plain BST is best viewed as:

- conceptually fundamental
- practically useful in some controlled situations
- incomplete as a general-purpose ordered dictionary without a
  balancing strategy

That is why AVL trees and red-black trees matter so much.

---

## Exercises

1. Insert the values `8, 3, 10, 1, 6, 14, 4, 7, 13` into an empty
   BST and draw the resulting tree.
2. Delete a leaf, a one-child node, and a two-child node from the
   same BST. Trace each case by hand.
3. Explain why the leftmost node of a right subtree is always the
   in-order successor.
4. Find the predecessor and successor of `6` in the example BST.
5. Construct a sequence of insertions that produces the worst
   possible BST shape for 6 nodes.
6. Why is BST search really O(height) rather than inherently
   O(log n)?

---

## Key Takeaways

- A BST adds an ordering invariant to a binary tree.
- Search, insert, and delete all work by following one root-to-
  leaf path.
- Deletion has three cases: leaf, one child, two children.
- Successor and predecessor capture the next value in sorted
  order.
- In-order traversal of a BST produces sorted output.
- Plain BST performance depends entirely on shape, not just on
  the invariant.
- Sorted insertions can degenerate a BST into a linear chain.

The next lesson solves the main weakness of plain BSTs: how to
maintain balance automatically using AVL and red-black trees.

---

**Previous**: [Lesson 17 — Binary Trees and Traversals](./17-binary-trees.md)
**Next**: [Lesson 19 — Balanced Binary Search Trees — AVL and Red-Black Trees](./19-balanced-trees.md)