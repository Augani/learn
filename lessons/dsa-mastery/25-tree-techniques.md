# Lesson 25: Tree Techniques — LCA, Morris Traversal, and Tree DP

> **Analogy**: Once you stop seeing a tree as "just nodes and
> pointers" and start seeing it as a structure with reusable
> paths, temporary threading, and subproblems flowing from leaves
> to root, a new level of techniques opens up. This lesson is
> about that jump: the advanced patterns that show up when you are
> no longer learning what a tree is, but how to think with trees.

---

## Why This Matters

By now you can traverse, search, balance, and aggregate over
trees. But many interesting problems require more specialized
techniques:

- find where two nodes meet in a hierarchy
- traverse without recursion or an explicit stack
- compute an optimal value over every subtree

This lesson covers three such techniques:

- **Lowest Common Ancestor (LCA)**
- **Morris Traversal**
- **Tree DP**

Each one teaches a different kind of tree reasoning:

- path intersection
- temporary structure reuse
- dynamic programming on hierarchical subproblems

---

## Lowest Common Ancestor (LCA)

The LCA of two nodes is the deepest node that is an ancestor of
both.

### Example

```
              [3]
             /   \
           [5]   [1]
          /  \   /  \
        [6] [2] [0] [8]
            / \
          [7] [4]

  LCA(6, 4) = 5
  LCA(7, 4) = 2
  LCA(5, 1) = 3
```

### Why It Matters

LCA appears in:

- organizational hierarchies
- file-system directory ancestry
- query systems on trees
- many competitive programming problems

### Standard Recursive Idea

For a binary tree:

1. if current node is null, return null
2. if current node matches `p` or `q`, return current node
3. recurse left and right
4. if both sides return non-null, current node is the LCA
5. otherwise return the non-null side

```
  LCA TRACE FOR 6 AND 4

  At node 3:
    left subtree finds something
    right subtree finds nothing
    -> return left result upward

  At node 5:
    left subtree finds 6
    right subtree finds 4
    -> both non-null, so 5 is the LCA ✓
```

### Binary Lifting Idea

For repeated LCA queries on a static tree, we can preprocess jump
tables so each query becomes O(log n).

This is called **binary lifting**:

- store the 2^k-th ancestor of each node
- lift the deeper node upward
- then lift both upward together until just before they diverge

This is more advanced and especially useful in large query-heavy
problems.

---

## Morris Traversal — In-Order Traversal With O(1) Extra Space

Normally, in-order traversal uses:

- recursion -> O(h) call stack
- or an explicit stack -> O(h) space

Morris traversal avoids both by temporarily threading the tree.

### Core idea

For each node with a left subtree:

1. find its in-order predecessor (rightmost node in the left subtree)
2. make that predecessor's right pointer temporarily point back to the current node
3. use that thread to return later without a stack

### Diagram

```
  CURRENT NODE = 4

          [4]
         /   \
       [2]   [6]
      /  \
    [1] [3]

  In-order predecessor of 4 is 3.
  Temporarily create thread:

          [4]
         /   \
       [2]   [6]
      /  \
    [1] [3]
           \
           [4]   <- temporary thread back to current
```

Then when traversal finishes the left subtree and reaches 3, the
thread leads back to 4, where the algorithm knows it has already
processed the left side.

### Why This Is Clever

It reuses unused null right pointers as temporary return edges.

That gives in-order traversal in:

- time: O(n)
- extra space: O(1)

The tree is restored afterward.

---

## Tree DP — Dynamic Programming on Subtrees

Tree DP means:

- each subtree is a subproblem
- each node combines answers from its children
- the tree structure prevents cycles, which makes recursion natural

### Example 1: Diameter of a Binary Tree

The diameter is the number of edges on the longest path between
any two nodes.

At each node, if you know the heights of the left and right
subtrees, then a path through that node has length:

$$
left\_height + right\_height
$$

So the algorithm returns subtree height upward while updating a
global diameter.

### Example 2: Maximum Path Sum

You saw this in the practice lesson.

The node combines child gains, updates a global answer, and
returns a one-branch gain upward.

### Example 3: House Robber on Trees

Each tree node is a house. If you rob a node, you cannot rob its
children.

For each node, keep two states:

- `take`: best value if you rob this node
- `skip`: best value if you do not rob this node

Then:

$$
take = node.val + skip(left) + skip(right)
$$

$$
skip = max(take, skip)_{left} + max(take, skip)_{right}
$$

This is classic DP, but the subproblems live on a tree instead of
an array.

---

## Technical Deep-Dive: Implementations

### Python

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def lowest_common_ancestor(root: TreeNode | None, p: TreeNode, q: TreeNode) -> TreeNode | None:
    if root is None or root is p or root is q:
        return root

    left = lowest_common_ancestor(root.left, p, q)
    right = lowest_common_ancestor(root.right, p, q)

    if left is not None and right is not None:
        return root
    return left if left is not None else right


def morris_inorder(root: TreeNode | None) -> list[int]:
    result: list[int] = []
    current = root

    while current is not None:
        if current.left is None:
            result.append(current.val)
            current = current.right
        else:
            predecessor = current.left
            while predecessor.right is not None and predecessor.right is not current:
                predecessor = predecessor.right

            if predecessor.right is None:
                predecessor.right = current
                current = current.left
            else:
                predecessor.right = None
                result.append(current.val)
                current = current.right

    return result


def diameter_of_binary_tree(root: TreeNode | None) -> int:
    best = 0

    def dfs(node: TreeNode | None) -> int:
        nonlocal best
        if node is None:
            return 0
        left_height = dfs(node.left)
        right_height = dfs(node.right)
        best = max(best, left_height + right_height)
        return 1 + max(left_height, right_height)

    dfs(root)
    return best
```

### TypeScript

```typescript
class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;

  constructor(val = 0, left: TreeNode | null = null, right: TreeNode | null = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function lowestCommonAncestor(root: TreeNode | null, p: TreeNode, q: TreeNode): TreeNode | null {
  if (root === null || root === p || root === q) {
    return root;
  }

  const left = lowestCommonAncestor(root.left, p, q);
  const right = lowestCommonAncestor(root.right, p, q);

  if (left !== null && right !== null) {
    return root;
  }
  return left ?? right;
}

function morrisInorder(root: TreeNode | null): number[] {
  const result: number[] = [];
  let current = root;

  while (current !== null) {
    if (current.left === null) {
      result.push(current.val);
      current = current.right;
    } else {
      let predecessor = current.left;
      while (predecessor.right !== null && predecessor.right !== current) {
        predecessor = predecessor.right;
      }

      if (predecessor.right === null) {
        predecessor.right = current;
        current = current.left;
      } else {
        predecessor.right = null;
        result.push(current.val);
        current = current.right;
      }
    }
  }

  return result;
}

function diameterOfBinaryTree(root: TreeNode | null): number {
  let best = 0;

  function dfs(node: TreeNode | null): number {
    if (node === null) {
      return 0;
    }
    const leftHeight = dfs(node.left);
    const rightHeight = dfs(node.right);
    best = Math.max(best, leftHeight + rightHeight);
    return 1 + Math.max(leftHeight, rightHeight);
  }

  dfs(root);
  return best;
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

fn lowest_common_ancestor<'a>(
    root: Option<&'a TreeNode>,
    p: i32,
    q: i32,
) -> Option<&'a TreeNode> {
    let node = root?;
    if node.val == p || node.val == q {
        return Some(node);
    }

    let left = lowest_common_ancestor(node.left.as_deref(), p, q);
    let right = lowest_common_ancestor(node.right.as_deref(), p, q);

    match (left, right) {
        (Some(_), Some(_)) => Some(node),
        (Some(found), None) => Some(found),
        (None, Some(found)) => Some(found),
        (None, None) => None,
    }
}

fn diameter_of_binary_tree(root: &Option<Box<TreeNode>>) -> i32 {
    fn dfs(node: &Option<Box<TreeNode>>, best: &mut i32) -> i32 {
        match node {
            None => 0,
            Some(current) => {
                let left_height = dfs(&current.left, best);
                let right_height = dfs(&current.right, best);
                *best = (*best).max(left_height + right_height);
                1 + left_height.max(right_height)
            }
        }
    }

    let mut best = 0;
    dfs(root, &mut best);
    best
}
```

---

## ASCII Technique Summary

```
  ADVANCED TREE PATTERNS

  LCA:
  find where two paths first meet from below

  Morris traversal:
  temporarily thread predecessor -> current
  to avoid recursion/stack

  Tree DP:
  each node combines child answers
  and may also update a global best
```

---

## What Makes These Techniques Advanced?

They force you to think beyond plain traversal.

- LCA is about ancestor relationships and path structure
- Morris traversal is about reusing temporary structural links
- Tree DP is about defining the right state per subtree

These are not new data structures. They are new ways of thinking
about the same structure.

That is why they matter.

---

## Exercises

1. On the sample tree in the LCA section, compute the LCA for
   pairs `(6, 4)`, `(7, 8)`, and `(5, 4)`.
2. Explain why Morris traversal restores the tree correctly even
   though it temporarily changes right pointers.
3. Derive the tree-DP recurrence for the house-robber-on-tree
   problem.
4. For diameter, explain why a node's best upward return value is
   different from the best diameter passing through that node.
5. If you had to answer thousands of LCA queries on a fixed tree,
   why would binary lifting help?
6. Construct a tree where the diameter does not pass through the
   root.

---

## Key Takeaways

- LCA captures the deepest shared ancestor of two nodes.
- Morris traversal achieves in-order traversal with O(1) extra
  space by temporarily threading the tree.
- Tree DP treats each subtree as a subproblem and combines child
  answers carefully.
- Advanced tree problems are often about defining the right state
  or structural interpretation, not inventing new traversal from
  scratch.

Phase 3 is now complete: you can work with basic trees, ordered
trees, balanced trees, heaps, disk-oriented trees, tries, range
trees, and advanced tree techniques.

---

**Previous**: [Lesson 24 — Practice Problems — Trees](./24-practice-trees.md)
**Next**: [Lesson 26 — Graph Representations](./26-graph-representations.md)