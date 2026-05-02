# Lesson 17: Binary Trees and Traversals

> **Analogy**: Think of an org chart. At the top is the CEO.
> Below them are a few direct reports. Below each of those are
> more reports, and so on. You do not naturally think about that
> structure as a flat list. You think in levels, parents,
> children, branches, and sub-organizations. A binary tree is a
> similar way of organizing data: each node can point to a left
> child and a right child, creating a hierarchy that is perfect
> for recursive reasoning.

---

## Why This Matters

Arrays are great when data is linear. Graphs are great when
relationships are arbitrary. Trees sit in the middle: structured
enough to exploit shape, flexible enough to model hierarchy.

Binary trees matter because they appear everywhere:

- File-system directories and parse trees
- Binary search trees and heaps
- Expression trees in compilers
- Decision trees in machine learning
- DOM structures in browsers
- Recursive divide-and-conquer problems

This lesson is the foundation for all later tree topics. Before
you can understand binary search trees, heaps, AVL rotations, or
segment trees, you need the core tree mental model.

By the end of this lesson, you will understand:

- The essential terminology: root, parent, child, leaf, depth,
  height, level, subtree
- What makes binary trees special
- The four major traversal orders and what each is good for
- Simple recursive tree algorithms like height, size, and mirror
- Why traversals are not arbitrary; each order emphasizes a
  different view of the structure

> **Cross-reference**: The earlier
> [`../data-structures/09-binary-trees.md`](../data-structures/09-binary-trees.md)
> introduces binary trees and BSTs in Rust. This lesson goes
> deeper on terminology, traversal intuition, recursive tree
> algorithms, and the idea of structural thinking that the rest of
> the DSA Mastery track depends on.

---

## What Is a Binary Tree?

A binary tree is a hierarchical data structure where each node
has at most two children:

- a **left child**
- a **right child**

Unlike arrays, a binary tree is not defined by contiguous
positions. It is defined by relationships.

```
  A SIMPLE BINARY TREE

             [A]
            /   \
          [B]   [C]
         /   \     \
       [D]   [E]   [F]

  A is parent of B and C
  B is parent of D and E
  C is parent of F
```

Each node is the root of its own subtree.

That means the tree above also contains smaller trees:

```
  SUBTREE ROOTED AT B

        [B]
       /   \
     [D]   [E]
```

This recursive self-similarity is why tree algorithms are so
often naturally recursive.

---

## Core Tree Terminology

You need this vocabulary cold. Later lessons assume it.

```
                    [8]                <- root, depth 0
                   /   \
                 [3]   [10]            <- depth 1
                /  \      \
              [1]  [6]    [14]         <- depth 2
                  /   \    /
                [4]  [7] [13]          <- depth 3
```

### Terms

- **Root**: the topmost node, here `8`
- **Parent**: a node with children, like `3`
- **Child**: a node pointed to by a parent, like `6`
- **Leaf**: a node with no children, like `1`, `4`, `7`, `13`
- **Sibling**: nodes with the same parent, like `4` and `7`
- **Depth**: number of edges from root to the node
- **Level**: often depth + 1, depending on convention
- **Height of a node**: longest downward path from that node to a leaf
- **Height of a tree**: height of the root
- **Subtree**: a node plus all of its descendants

### Depth vs Height

People often confuse these, so separate them mentally:

- **Depth** looks upward to the root
- **Height** looks downward to the deepest leaf

```
  NODE 6

        [8]
       /
     [3]
       \
       [6]
      /   \
    [4]   [7]

  depth(6)  = 2   because 8 -> 3 -> 6 is two edges
  height(6) = 1   because the longest path down is one edge
```

---

## Why Trees Are Useful

Trees are useful when the data is hierarchical or when recursive
splitting is natural.

Examples:

- A file system: folders containing files and subfolders
- A company org chart
- A mathematical expression like `(a + b) * c`
- A tournament bracket
- A game decision process

Trying to force these into a flat array often obscures the real
structure.

```
  EXPRESSION TREE FOR (2 + 3) * (4 - 1)

              [*]
             /   \
           [+]   [-]
          /  \   /  \
        [2] [3] [4] [1]

  This structure directly represents the computation.
```

The tree shape itself carries meaning.

---

## Binary Tree Properties

Some basic properties are worth knowing.

### Maximum nodes by level

At depth `d`, a binary tree can have at most:

$$
2^d
$$

nodes.

### Maximum nodes in a tree of height h

If height is measured in edges and the tree is full, the maximum
number of nodes is:

$$
1 + 2 + 4 + \dots + 2^h = 2^{h+1} - 1
$$

```
  FULL BINARY TREE OF HEIGHT 2

          [ ]              level 0 -> 1 node
         /   \
       [ ]   [ ]           level 1 -> 2 nodes
      / \   / \
    [ ][ ][ ][ ]           level 2 -> 4 nodes

  Total = 1 + 2 + 4 = 7 = 2^(2+1) - 1
```

### Common Shapes

```
  BALANCED-ISH TREE              SKEWED TREE

         [1]                        [1]
        /   \                         \
      [2]   [3]                      [2]
     / \   /                           \
   [4][5][6]                          [3]
                                        \
                                        [4]
```

The shape matters because many tree algorithms depend on height.

- Balanced trees often lead to O(log n) height
- Skewed trees can degenerate to O(n) height

That distinction becomes critical in the next lessons.

---

## Tree Traversals — Four Ways to Visit the Same Structure

Traversing a tree means visiting every node in some order.

Here is our reference tree:

```
              [A]
             /   \
           [B]   [C]
          /  \   /  \
        [D] [E] [F] [G]
```

The four major traversals are:

- Pre-order: node, left, right
- In-order: left, node, right
- Post-order: left, right, node
- Level-order: breadth-first, top to bottom

### 1. Pre-Order Traversal

Visit the current node before its subtrees.

```
  PRE-ORDER: Node -> Left -> Right

              [A]  -> visit A first
             /   \
           [B]   [C]
          /  \   /  \
        [D] [E] [F] [G]

  Order: A, B, D, E, C, F, G
```

Use cases:

- Copying a tree
- Serializing structure with roots first
- Prefix expression generation

### 2. In-Order Traversal

Visit left subtree, then node, then right subtree.

```
  IN-ORDER: Left -> Node -> Right

  Left side of A first, then A, then right side

  Order: D, B, E, A, F, C, G
```

This traversal becomes especially important for binary search
trees, because it yields sorted order there.

### 3. Post-Order Traversal

Visit children before the parent.

```
  POST-ORDER: Left -> Right -> Node

  Order: D, E, B, F, G, C, A
```

Use cases:

- Deleting/freeing a tree safely
- Evaluating expression trees bottom-up
- Computing properties that depend on children first

### 4. Level-Order Traversal

Visit nodes one level at a time from top to bottom.

```
  LEVEL-ORDER (BFS)

  Level 0: A
  Level 1: B, C
  Level 2: D, E, F, G

  Order: A, B, C, D, E, F, G
```

Use cases:

- Printing trees level by level
- Shortest-path reasoning in unweighted trees
- Problems about nearest leaf, minimum depth, or layer grouping

---

## Traversal Trace on a Concrete Tree

```
                [4]
               /   \
             [2]   [6]
            /  \   /  \
          [1] [3] [5] [7]

  Pre-order:  4, 2, 1, 3, 6, 5, 7
  In-order:   1, 2, 3, 4, 5, 6, 7
  Post-order: 1, 3, 2, 5, 7, 6, 4
  Level-order:4, 2, 6, 1, 3, 5, 7
```

Notice how each order emphasizes a different perspective:

- Pre-order emphasizes roots before details
- In-order emphasizes left-to-right structural order
- Post-order emphasizes children before parent decisions
- Level-order emphasizes depth layers

They are not arbitrary conventions. They match different kinds of
questions.

---

## Recursive Tree Algorithms

Trees are recursive structures, so many tree algorithms almost
write themselves recursively.

### Height of a Tree

The height is:

1. `-1` or `0` for an empty tree, depending on convention
2. otherwise `1 + max(height(left), height(right))`

We will use height-in-edges here, so an empty tree has height
`-1` and a single node has height `0`.

```
  HEIGHT COMPUTATION

            [8]
           /   \
         [3]   [10]
        /  \      \
      [1]  [6]    [14]

  height(1)  = 0
  height(6)  = 0
  height(3)  = 1 + max(0, 0) = 1
  height(14) = 0
  height(10) = 1 + max(-1, 0) = 1
  height(8)  = 1 + max(1, 1) = 2
```

### Size of a Tree

The size is the total number of nodes:

$$
\text{size}(node) = 1 + \text{size}(left) + \text{size}(right)
$$

### Mirror a Tree

To mirror a tree, swap each node's left and right children.

```
  ORIGINAL                     MIRRORED

            [8]                          [8]
           /   \                        /   \
         [3]   [10]      ---->       [10]  [3]
        /  \                            /   \
      [1]  [6]                        [6]   [1]
```

This is another recursive pattern:

1. mirror left subtree
2. mirror right subtree
3. swap them

---

## Technical Deep-Dive: Implementations

### Python

```python
from collections import deque


class TreeNode:
    def __init__(self, val: int, left: "TreeNode | None" = None, right: "TreeNode | None" = None):
        self.val = val
        self.left = left
        self.right = right


def height(node: TreeNode | None) -> int:
    if node is None:
        return -1
    return 1 + max(height(node.left), height(node.right))


def size(node: TreeNode | None) -> int:
    if node is None:
        return 0
    return 1 + size(node.left) + size(node.right)


def inorder(node: TreeNode | None) -> list[int]:
    if node is None:
        return []
    return inorder(node.left) + [node.val] + inorder(node.right)


def preorder(node: TreeNode | None) -> list[int]:
    if node is None:
        return []
    return [node.val] + preorder(node.left) + preorder(node.right)


def postorder(node: TreeNode | None) -> list[int]:
    if node is None:
        return []
    return postorder(node.left) + postorder(node.right) + [node.val]


def level_order(root: TreeNode | None) -> list[list[int]]:
    if root is None:
        return []

    result: list[list[int]] = []
    queue: deque[TreeNode] = deque([root])

    while queue:
        level_size = len(queue)
        level: list[int] = []

        for _ in range(level_size):
            node = queue.popleft()
            level.append(node.val)
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)

        result.append(level)

    return result


def mirror(node: TreeNode | None) -> TreeNode | None:
    if node is None:
        return None

    node.left, node.right = mirror(node.right), mirror(node.left)
    return node
```

### TypeScript

```typescript
class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;

  constructor(val: number, left: TreeNode | null = null, right: TreeNode | null = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function height(node: TreeNode | null): number {
  if (node === null) {
    return -1;
  }
  return 1 + Math.max(height(node.left), height(node.right));
}

function size(node: TreeNode | null): number {
  if (node === null) {
    return 0;
  }
  return 1 + size(node.left) + size(node.right);
}

function inorder(node: TreeNode | null): number[] {
  if (node === null) {
    return [];
  }
  return [...inorder(node.left), node.val, ...inorder(node.right)];
}

function preorder(node: TreeNode | null): number[] {
  if (node === null) {
    return [];
  }
  return [node.val, ...preorder(node.left), ...preorder(node.right)];
}

function postorder(node: TreeNode | null): number[] {
  if (node === null) {
    return [];
  }
  return [...postorder(node.left), ...postorder(node.right), node.val];
}

function levelOrder(root: TreeNode | null): number[][] {
  if (root === null) {
    return [];
  }

  const result: number[][] = [];
  const queue: TreeNode[] = [root];

  while (queue.length > 0) {
    const levelSize = queue.length;
    const level: number[] = [];

    for (let count = 0; count < levelSize; count += 1) {
      const node = queue.shift();
      if (node === undefined) {
        break;
      }
      level.push(node.val);
      if (node.left !== null) {
        queue.push(node.left);
      }
      if (node.right !== null) {
        queue.push(node.right);
      }
    }

    result.push(level);
  }

  return result;
}

function mirror(node: TreeNode | null): TreeNode | null {
  if (node === null) {
    return null;
  }

  const mirroredLeft = mirror(node.right);
  const mirroredRight = mirror(node.left);
  node.left = mirroredLeft;
  node.right = mirroredRight;
  return node;
}
```

### Rust

```rust
use std::collections::VecDeque;

#[derive(Debug, Clone)]
struct TreeNode {
    val: i32,
    left: Option<Box<TreeNode>>,
    right: Option<Box<TreeNode>>,
}

fn height(node: &Option<Box<TreeNode>>) -> i32 {
    match node {
        None => -1,
        Some(current) => 1 + height(&current.left).max(height(&current.right)),
    }
}

fn size(node: &Option<Box<TreeNode>>) -> i32 {
    match node {
        None => 0,
        Some(current) => 1 + size(&current.left) + size(&current.right),
    }
}

fn inorder(node: &Option<Box<TreeNode>>, result: &mut Vec<i32>) {
    if let Some(current) = node {
        inorder(&current.left, result);
        result.push(current.val);
        inorder(&current.right, result);
    }
}

fn preorder(node: &Option<Box<TreeNode>>, result: &mut Vec<i32>) {
    if let Some(current) = node {
        result.push(current.val);
        preorder(&current.left, result);
        preorder(&current.right, result);
    }
}

fn postorder(node: &Option<Box<TreeNode>>, result: &mut Vec<i32>) {
    if let Some(current) = node {
        postorder(&current.left, result);
        postorder(&current.right, result);
        result.push(current.val);
    }
}

fn level_order(root: &Option<Box<TreeNode>>) -> Vec<Vec<i32>> {
    let mut result = Vec::new();
    let mut queue: VecDeque<&TreeNode> = VecDeque::new();

    if let Some(node) = root.as_deref() {
        queue.push_back(node);
    }

    while !queue.is_empty() {
        let level_size = queue.len();
        let mut level = Vec::with_capacity(level_size);

        for _ in 0..level_size {
            if let Some(node) = queue.pop_front() {
                level.push(node.val);
                if let Some(left) = node.left.as_deref() {
                    queue.push_back(left);
                }
                if let Some(right) = node.right.as_deref() {
                    queue.push_back(right);
                }
            }
        }

        result.push(level);
    }

    result
}

fn mirror(node: &mut Option<Box<TreeNode>>) {
    if let Some(current) = node {
        mirror(&mut current.left);
        mirror(&mut current.right);
        std::mem::swap(&mut current.left, &mut current.right);
    }
}
```

---

## What If We Stored Hierarchical Data in a Flat Array?

Sometimes that is the right choice. Heaps do exactly that, and we
will study them soon.

But for general hierarchical relationships, a flat array loses
clarity.

Suppose you want to represent this tree:

```
          [A]
         /   \
       [B]   [C]
            /
          [D]
```

In a pointer-based tree, the structure is explicit.

In a flat array, you now need extra conventions:

- where are the missing children?
- how do you encode nulls?
- how do you handle unbalanced shape?

```
  Possible array encoding:
  [A, B, C, null, null, D, null]

  This works, but it includes empty slots and becomes awkward for
  sparse or irregular trees.
```

So the real answer is:

- For **complete or nearly complete trees**, array layouts can be
  excellent.
- For **general recursive structure**, node-based trees are much
  more natural.

The point is not that one representation is always superior. The
point is that representation should reflect structure.

---

## Exercises

1. For the tree with nodes `A` as root, `B` and `C` as children,
   and `D` as left child of `B`, write the pre-order, in-order,
   post-order, and level-order traversals.
2. Prove by induction that a full binary tree of height `h` has
   `2^(h+1) - 1` nodes.
3. Write a recursive function to count leaf nodes in a binary
   tree.
4. Explain why post-order traversal is the natural order for
   deleting all nodes in a tree.
5. Given a tree, how would you check whether two trees are mirror
   images of each other?
6. Draw a skewed binary tree of 5 nodes and compute its height.

---

## Key Takeaways

- Binary trees organize data hierarchically, not linearly.
- The essential vocabulary is root, parent, child, leaf, depth,
  height, level, and subtree.
- Traversals are meaningful views of structure, not arbitrary
  visit orders.
- Pre-order, in-order, post-order, and level-order each support
  different tasks.
- Recursive tree algorithms work naturally because every subtree
  is itself a smaller tree.
- Tree shape matters; later lessons will show how balancing can
  make the difference between O(log n) and O(n).

The next lesson builds directly on this one: once you understand
how binary trees work, you can enforce an ordering invariant and
turn them into binary search trees.

---

**Previous**: [Lesson 16 — Sorting in Practice — Hybrid Algorithms and Real-World Considerations](./16-sorting-in-practice.md)
**Next**: [Lesson 18 — Binary Search Trees](./18-binary-search-trees.md)