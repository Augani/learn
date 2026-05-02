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

## The Family Tree Analogy — Deeper

Picture a royal family tree. The king sits at the top, his children below him, their children below them. Now imagine two distant cousins want to find their closest shared ancestor:

```
              King Arthur
             /           \
        Prince John    Princess Mary
         /    \           /       \
     Alice   Bob      Carol      David
       |      |         |          |
     Eve     Frank     Gwen       Henry

  LCA(Eve, Frank) = Prince John
  LCA(Eve, Gwen) = King Arthur
  LCA(Carol, David) = Princess Mary
```

Key insight: the LCA is the deepest person who appears on **both** paths back to the root. This is not just a tree fact — it is the foundation of how hierarchical systems resolve ancestry, permissions, and dependency queries.

Now imagine you want to visit every person in the family tree in order of birth, but you are forbidden from using a notebook (stack) or asking anyone to remember where you came from (recursion). Morris traversal is like leaving temporary string trails between people so you can find your way back without any external memory.

Tree DP is like planning a family reunion where each branch must decide: "If we hold the party here, what is the best total joy we can achieve, considering we cannot invite both a parent and their direct child?" Each subtree makes its own local decision, and those decisions flow upward.

---

## Lowest Common Ancestor (LCA)

The LCA of two nodes is the deepest node that is an ancestor of both.

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

LCA appears everywhere hierarchical paths intersect:

- **File systems**: find the deepest shared directory between two files
- **Git version control**: `git merge-base` computes LCA of two branches
- **Organizational hierarchies**: find the lowest manager supervising two employees
- **Taxonomy trees**: find the most specific shared category (e.g., "mammal" for "cat" and "dog")
- **Network routing**: find the nearest common router between two hosts
- **DOM trees**: find the deepest container element holding two nodes
- **Many competitive programming problems** reduce to LCA after proper modeling

### Standard Recursive Idea

For a binary tree:

1. if current node is null, return null
2. if current node matches `p` or `q`, return current node
3. recurse left and right
4. if both sides return non-null, current node is the LCA
5. otherwise return the non-null side

### Step-by-Step Trace: LCA(6, 4)

```
  At node 3:
    left subtree (rooted at 5)  → returns something
    right subtree (rooted at 1) → returns null
    -> return left result upward (5)

  At node 5:
    left subtree (rooted at 6)  → returns 6  (matches p)
    right subtree (rooted at 2) → returns 4  (found q under 2)
    -> BOTH non-null, so 5 is the LCA ✓

  At node 2:
    left subtree (rooted at 7)  → returns null
    right subtree (rooted at 4) → returns 4  (matches q)
    -> return right result upward (4)
```

The key insight: when both subtrees report a find, the current node is where the two search paths first converge.

### What If We Tried a Non-Recursive Approach?

You could find LCA by building parent pointers (or recording paths from root) and then walking upward until the paths meet. This works and is sometimes preferred when you need to answer many LCA queries on a static tree:

```
  Path from root to 6:  [3, 5, 6]
  Path from root to 4:  [3, 5, 2, 4]

  Walk both paths from the root:
    Step 1: both have 3  → match
    Step 2: both have 5  → match
    Step 3: 6 vs 2       → diverge!

  Last match before divergence: 5 → LCA
```

This parent-pointer approach is O(depth) per query after O(n) preprocessing. The recursive approach is O(n) per query with no preprocessing. For thousands of queries, binary lifting (below) is better.

### Binary Lifting Idea

For repeated LCA queries on a static tree, we can preprocess jump tables so each query becomes O(log n).

This is called **binary lifting**:

- store the 2^k-th ancestor of each node
- lift the deeper node upward
- then lift both upward together until just before they diverge

Think of it as giving each person in the family tree a series of "express elevators": one that goes up 1 generation, one that goes up 2, one that goes up 4, one that goes up 8, etc. To meet efficiently, you take the biggest elevator that does not overshoot.

This is more advanced and especially useful in large query-heavy problems.

---

## Morris Traversal — In-Order Traversal With O(1) Extra Space

Normally, in-order traversal uses:

- recursion → O(h) call stack
- or an explicit stack → O(h) space

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

Then when traversal finishes the left subtree and reaches 3, the thread leads back to 4, where the algorithm knows it has already processed the left side.

### Step-by-Step Trace

```
  Tree:        [4]
              /   \
            [2]   [6]
           /  \
         [1] [3]

  Step 1: current = 4, has left child
          predecessor of 4 = 3
          3's right is null → create thread 3->4
          move to left child: current = 2

  Step 2: current = 2, has left child
          predecessor of 2 = 1
          1's right is null → create thread 1->2
          move to left child: current = 1

  Step 3: current = 1, no left child
          visit 1
          move to right child: current = 2 (via thread!)

  Step 4: current = 2, has left child
          predecessor of 2 = 1
          1's right ALREADY points to 2 → thread exists!
          remove thread (1's right = null)
          visit 2
          move to right child: current = 3

  Step 5: current = 3, no left child
          visit 3
          move to right child: current = 4 (via thread!)

  Step 6: current = 4, has left child
          predecessor of 4 = 3
          3's right ALREADY points to 4 → thread exists!
          remove thread (3's right = null)
          visit 4
          move to right child: current = 6

  Step 7: current = 6, no left child
          visit 6
          move to right child: current = null → DONE

  Visited order: 1, 2, 3, 4, 6 ✓
```

### Why This Is Clever

It reuses unused null right pointers as temporary return edges.

That gives in-order traversal in:

- time: O(n)
- extra space: O(1)

The tree is restored afterward. Every thread is created once and removed once.

### What If the Tree Was a Linked List?

If the tree is completely right-skewed (every node has only a right child), Morris traversal degenerates to simple linear traversal with no threading at all — each node has no left subtree, so we just visit and move right. This is still O(n) time and O(1) space.

If the tree is completely left-skewed, we create a thread at every node and remove it immediately after. This is still O(n) because each thread is handled exactly twice (create + remove).

---

## Tree DP — Dynamic Programming on Subtrees

Tree DP means:

- each subtree is a subproblem
- each node combines answers from its children
- the tree structure prevents cycles, which makes recursion natural

### The Core Pattern

At every node, you typically compute two kinds of values:

1. **Return value**: the best answer you can send upward to the parent
2. **Global update**: a candidate answer that passes through this node

These are often different. A node may return its best "one-branch" path upward while simultaneously updating a global "two-branch" best.

### Example 1: Diameter of a Binary Tree

The diameter is the number of edges on the longest path between any two nodes.

At each node, if you know the heights of the left and right subtrees, then a path through that node has length:

$$
left\_height + right\_height
$$

So the algorithm returns subtree height upward while updating a global diameter.

**Step-by-step trace:**

```
            [1]
           /   \
         [2]   [3]
        / \
      [4] [5]

  Node 4: height = 0,  diameter candidate = 0
  Node 5: height = 0,  diameter candidate = 0

  Node 2:
    left_height = 0, right_height = 0
    diameter through 2 = 0 + 0 = 0
    global best so far = 0
    return height = 1 + max(0, 0) = 1

  Node 3: height = 0,  diameter candidate = 0

  Node 1:
    left_height = 1, right_height = 0
    diameter through 1 = 1 + 0 = 1
    global best = max(0, 1) = 1
    return height = 1 + max(1, 0) = 2

  Final diameter = 1 (path: 4 -> 2 -> 1 or 5 -> 2 -> 1)
```

Notice: the return value (height) is not the same as the diameter candidate. The height tells the parent "how far down can you reach from me?" The diameter tells the global tracker "what is the longest path I've seen so far?"

### Example 2: Maximum Path Sum

You saw this in the practice lesson. The logic is identical to diameter but with weighted nodes instead of counting edges.

At each node:
- combine left and right gains
- update global maximum with the "arch" through this node
- return the best single-branch gain upward

### Example 3: House Robber on Trees

Each tree node is a house. If you rob a node, you cannot rob its children.

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

**Step-by-step trace:**

```
            [3]
           /   \
         [2]   [3]
          |     |
         [3]   [1]

  Node 3 (leaf): take = 3, skip = 0
  Node 1 (leaf): take = 1, skip = 0

  Node 2 (left):
    take = 2 + skip(3) = 2 + 0 = 2
    skip = max(3, 0) = 3
    -> returns (take=2, skip=3)

  Node 3 (right):
    take = 3 + skip(1) = 3 + 0 = 3
    skip = max(1, 0) = 1
    -> returns (take=3, skip=1)

  Node 3 (root):
    take = 3 + skip(left) + skip(right) = 3 + 3 + 1 = 7
    skip = max(2,3) + max(3,1) = 3 + 3 = 6
    -> best = max(7, 6) = 7

  Answer: rob root (3), left leaf (3), right leaf (1) = 7
```

This is classic DP, but the subproblems live on a tree instead of an array. The tree structure guarantees no cycles, so recursion naturally terminates.

### What If We Tried Greedy Instead of DP?

A greedy approach might say "always rob the highest-value node available." But this fails:

```
        [10]
       /    \
     [9]    [9]
    /  \    /  \
  [8] [8] [8] [8]
```

Greedy picks the root (10), then cannot pick any children. Total = 10.

But the optimal solution picks all four leaves: 8 + 8 + 8 + 8 = 32.

The greedy choice (root looks attractive) blocks too many alternatives. This is why we need DP: to explore both choices (take vs skip) at every node.

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


def house_robber_tree(root: TreeNode | None) -> int:
    def dfs(node: TreeNode | None) -> tuple[int, int]:
        if node is None:
            return (0, 0)
        left_take, left_skip = dfs(node.left)
        right_take, right_skip = dfs(node.right)
        take = node.val + left_skip + right_skip
        skip = max(left_take, left_skip) + max(right_take, right_skip)
        return (take, skip)

    return max(dfs(root))
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

function houseRobberTree(root: TreeNode | null): number {
  function dfs(node: TreeNode | null): [number, number] {
    if (node === null) {
      return [0, 0];
    }
    const [leftTake, leftSkip] = dfs(node.left);
    const [rightTake, rightSkip] = dfs(node.right);
    const take = node.val + leftSkip + rightSkip;
    const skip = Math.max(leftTake, leftSkip) + Math.max(rightTake, rightSkip);
    return [take, skip];
  }

  return Math.max(...dfs(root));
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

## Operation Complexity Summary

```
  ┌──────────────────────┬──────────────┬────────────────────────┐
  │ Technique            │ Time         │ Extra Space            │
  ├──────────────────────┼──────────────┼────────────────────────┤
  │ LCA (recursive)      │ O(n)         │ O(h) recursion stack   │
  │ LCA (parent ptr)     │ O(depth)     │ O(n) preprocessing     │
  │ LCA (binary lifting) │ O(log n)     │ O(n log n) preprocessing│
  │ Morris traversal     │ O(n)         │ O(1)                   │
  │ Tree DP (diameter)   │ O(n)         │ O(h) recursion stack   │
  │ Tree DP (path sum)   │ O(n)         │ O(h) recursion stack   │
  │ Tree DP (robber)     │ O(n)         │ O(h) recursion stack   │
  └──────────────────────┴──────────────┴────────────────────────┘
```

---

## What Makes These Techniques Advanced?

They force you to think beyond plain traversal.

- **LCA** is about ancestor relationships and path structure. The recursive solution is elegant because it propagates "found" signals upward until they collide.
- **Morris traversal** is about reusing temporary structural links. It turns "I need a stack" into "I can build my own return path."
- **Tree DP** is about defining the right state per subtree. The hard part is not the recursion — it is knowing what information to return upward vs what to track globally.

These are not new data structures. They are new ways of thinking about the same structure.

That is why they matter.

---

## Exercises

1. **Trace LCA manually**: On the sample tree in the LCA section, compute the LCA for pairs `(6, 4)`, `(7, 8)`, and `(5, 4)`. Draw the recursive call stack for one of these.

2. **Explain Morris restoration**: Explain why Morris traversal restores the tree correctly even though it temporarily changes right pointers. (Hint: every thread is created once and removed once.)

3. **Derive the tree-DP recurrence**: Write out the full recurrence for the house-robber-on-tree problem, including base cases.

4. **Diameter vs height distinction**: For the diameter algorithm, explain why a node's best upward return value is different from the best diameter passing through that node. When would they be the same?

5. **Binary lifting intuition**: If you had to answer thousands of LCA queries on a fixed tree, why would binary lifting help? What does the preprocessing step actually store?

6. **Construct a counterexample**: Draw a tree where the diameter does not pass through the root. Show the diameter calculation step by step.

7. **Morris on skewed trees**: Walk through Morris traversal on a completely left-skewed tree of 4 nodes. Count how many threads are created and removed.

8. **Greedy failure**: In the house robber on trees problem, give a concrete tree where greedy (always pick the highest available node) fails, and show why.

---

## Key Takeaways

- LCA captures the deepest shared ancestor of two nodes. The recursive solution propagates findings upward until they meet.
- Morris traversal achieves in-order traversal with O(1) extra space by temporarily threading the tree through unused right pointers.
- Tree DP treats each subtree as a subproblem and combines child answers carefully, often separating "return value" from "global best."
- Advanced tree problems are often about defining the right state or structural interpretation, not inventing new traversal from scratch.
- Binary lifting preprocesses ancestor information for O(log n) LCA queries.

Phase 3 is now complete: you can work with basic trees, ordered trees, balanced trees, heaps, disk-oriented trees, tries, range trees, and advanced tree techniques.

---

**Previous**: [Lesson 24 — Practice Problems — Trees](./24-practice-trees.md)
**Next**: [Lesson 26 — Graph Representations](./26-graph-representations.md)
