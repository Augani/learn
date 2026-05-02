# Lesson 24: Practice Problems — Trees

> You now have the full Phase 3 toolkit: binary trees,
> traversals, BSTs, balancing, heaps, B-trees, tries, and range
> trees. This lesson is where those ideas become problem-solving
> reflexes. The goal is not to memorize a handful of tree tricks.
> The goal is to recognize structural signals: recursion from the
> root, information flowing upward from children, level-by-level
> traversal, subtree validation, and when the hard part is not the
> traversal but the state you carry through it.

---

## How to Use This Lesson

Each problem includes:

- the tree pattern it exercises
- why the brute-force approach is tempting
- hints from light to direct
- a solution walkthrough
- Python, TypeScript, and Rust solutions

This lesson includes:

- 3 easy problems
- 3 medium problems
- 2 hard problems

---

## Easy Problems

---

### Problem 1: Maximum Depth of Binary Tree

**Pattern:** Tree recursion, combine child answers

**Problem statement:**
Given the root of a binary tree, return its maximum depth.

```
  Example:

          [3]
         /   \
       [9]  [20]
            /  \
         [15] [7]

  Answer: 3
```

**Hints:**

1. What is the depth of an empty tree?
2. If you know the max depth of the left subtree and right
   subtree, how do you get the answer for the current node?
3. The answer is `1 + max(left_depth, right_depth)`.

**Solution walkthrough:**

This is the cleanest possible recursive tree problem.

```
  depth(node) = 1 + max(depth(left), depth(right))
```

Every node asks its children for their best answer, then adds one
for itself.

#### Python

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def max_depth(root: TreeNode | None) -> int:
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))
```

#### TypeScript

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

function maxDepth(root: TreeNode | null): number {
  if (root === null) {
    return 0;
  }
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
```

#### Rust

```rust
#[derive(Debug)]
struct TreeNode {
    val: i32,
    left: Option<Box<TreeNode>>,
    right: Option<Box<TreeNode>>,
}

fn max_depth(root: &Option<Box<TreeNode>>) -> i32 {
    match root {
        None => 0,
        Some(node) => 1 + max_depth(&node.left).max(max_depth(&node.right)),
    }
}
```

---

### Problem 2: Symmetric Tree

**Pattern:** Mirror recursion

**Problem statement:**
Given the root of a binary tree, determine whether it is a mirror
of itself around its center.

```
          [1]
         /   \
       [2]   [2]
      /  \   /  \
    [3] [4] [4] [3]

  Answer: true
```

**Key insight:**
This is not a simple left-subtree-equals-right-subtree check.
It is a mirrored comparison:

- left.left must match right.right
- left.right must match right.left

#### Python

```python
def is_symmetric(root: TreeNode | None) -> bool:
    def is_mirror(left: TreeNode | None, right: TreeNode | None) -> bool:
        if left is None and right is None:
            return True
        if left is None or right is None:
            return False
        return (
            left.val == right.val
            and is_mirror(left.left, right.right)
            and is_mirror(left.right, right.left)
        )

    if root is None:
        return True
    return is_mirror(root.left, root.right)
```

#### TypeScript

```typescript
function isSymmetric(root: TreeNode | null): boolean {
  function isMirror(left: TreeNode | null, right: TreeNode | null): boolean {
    if (left === null && right === null) {
      return true;
    }
    if (left === null || right === null) {
      return false;
    }
    return left.val === right.val
      && isMirror(left.left, right.right)
      && isMirror(left.right, right.left);
  }

  return root === null ? true : isMirror(root.left, root.right);
}
```

#### Rust

```rust
fn is_symmetric(root: &Option<Box<TreeNode>>) -> bool {
    fn is_mirror(left: &Option<Box<TreeNode>>, right: &Option<Box<TreeNode>>) -> bool {
        match (left, right) {
            (None, None) => true,
            (Some(l), Some(r)) => {
                l.val == r.val
                    && is_mirror(&l.left, &r.right)
                    && is_mirror(&l.right, &r.left)
            }
            _ => false,
        }
    }

    match root {
        None => true,
        Some(node) => is_mirror(&node.left, &node.right),
    }
}
```

---

### Problem 3: Path Sum

**Pattern:** Root-to-leaf recursion with state accumulation

**Problem statement:**
Given the root of a binary tree and a target sum, return whether
the tree has a root-to-leaf path such that adding all values along
the path equals the target sum.

```
  target = 22

          [5]
         /   \
       [4]   [8]
      /      /  \
    [11]   [13] [4]
    /  \             \
  [7]  [2]           [1]

  Path 5 -> 4 -> 11 -> 2 = 22 ✓
```

**Key idea:**
Carry the remaining sum downward.

#### Python

```python
def has_path_sum(root: TreeNode | None, target_sum: int) -> bool:
    if root is None:
        return False
    if root.left is None and root.right is None:
        return root.val == target_sum
    remaining = target_sum - root.val
    return has_path_sum(root.left, remaining) or has_path_sum(root.right, remaining)
```

#### TypeScript

```typescript
function hasPathSum(root: TreeNode | null, targetSum: number): boolean {
  if (root === null) {
    return false;
  }
  if (root.left === null && root.right === null) {
    return root.val === targetSum;
  }
  const remaining = targetSum - root.val;
  return hasPathSum(root.left, remaining) || hasPathSum(root.right, remaining);
}
```

#### Rust

```rust
fn has_path_sum(root: &Option<Box<TreeNode>>, target_sum: i32) -> bool {
    match root {
        None => false,
        Some(node) => {
            if node.left.is_none() && node.right.is_none() {
                return node.val == target_sum;
            }
            let remaining = target_sum - node.val;
            has_path_sum(&node.left, remaining) || has_path_sum(&node.right, remaining)
        }
    }
}
```

---

## Medium Problems

---

### Problem 4: Validate Binary Search Tree

**Pattern:** Range constraints, not just local parent-child checks

**Problem statement:**
Given the root of a binary tree, determine if it is a valid BST.

**Why the brute-force idea fails:**
Checking only whether `left < node < right` for immediate children
is not enough. A bad value can hide deeper in a subtree.

**Correct insight:**
Every node must respect an allowed range inherited from all its
ancestors.

```
  For root 8:
  left subtree must be in (-inf, 8)
  right subtree must be in (8, +inf)

  If you go right to 10, then left child must be in (8, 10)
```

#### Python

```python
def is_valid_bst(root: TreeNode | None) -> bool:
    def dfs(node: TreeNode | None, low: int | None, high: int | None) -> bool:
        if node is None:
            return True
        if low is not None and node.val <= low:
            return False
        if high is not None and node.val >= high:
            return False
        return dfs(node.left, low, node.val) and dfs(node.right, node.val, high)

    return dfs(root, None, None)
```

#### TypeScript

```typescript
function isValidBST(root: TreeNode | null): boolean {
  function dfs(node: TreeNode | null, low: number | null, high: number | null): boolean {
    if (node === null) {
      return true;
    }
    if (low !== null && node.val <= low) {
      return false;
    }
    if (high !== null && node.val >= high) {
      return false;
    }
    return dfs(node.left, low, node.val) && dfs(node.right, node.val, high);
  }

  return dfs(root, null, null);
}
```

#### Rust

```rust
fn is_valid_bst(root: &Option<Box<TreeNode>>) -> bool {
    fn dfs(node: &Option<Box<TreeNode>>, low: Option<i64>, high: Option<i64>) -> bool {
        match node {
            None => true,
            Some(current) => {
                let value = current.val as i64;
                if low.is_some_and(|bound| value <= bound) {
                    return false;
                }
                if high.is_some_and(|bound| value >= bound) {
                    return false;
                }
                dfs(&current.left, low, Some(value)) && dfs(&current.right, Some(value), high)
            }
        }
    }

    dfs(root, None, None)
}
```

---

### Problem 5: Binary Tree Level Order Traversal

**Pattern:** Breadth-first search on trees

**Problem statement:**
Return the level order traversal of a tree as a list of levels.

```
          [3]
         /   \
       [9]  [20]
            /  \
         [15] [7]

  Output: [[3], [9, 20], [15, 7]]
```

**Brute-force thought:**
Compute each level separately using depth calculations. That works
but is awkward.

**Optimal idea:**
Use a queue and process one breadth layer at a time.

#### Python

```python
from collections import deque


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
```

#### TypeScript

```typescript
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
```

#### Rust

```rust
use std::collections::VecDeque;

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
```

---

### Problem 6: Construct Binary Tree From Preorder and Inorder Traversal

**Pattern:** Divide and conquer using traversal structure

**Why this is medium:**
The trick is not coding recursion. The trick is seeing how the
two traversals reveal the split.

### Key insight

- preorder gives you the root first
- inorder tells you which nodes belong to the left and right subtree

Example:

```
  preorder = [3, 9, 20, 15, 7]
  inorder  = [9, 3, 15, 20, 7]

  Root = 3  (first in preorder)
  In inorder, 3 splits the array:
    left  = [9]
    right = [15, 20, 7]
```

Recursively apply the same logic.

#### Python

```python
def build_tree(preorder: list[int], inorder: list[int]) -> TreeNode | None:
    index_map = {value: index for index, value in enumerate(inorder)}
    preorder_index = 0

    def helper(left: int, right: int) -> TreeNode | None:
        nonlocal preorder_index
        if left > right:
            return None

        root_value = preorder[preorder_index]
        preorder_index += 1
        root = TreeNode(root_value)

        split = index_map[root_value]
        root.left = helper(left, split - 1)
        root.right = helper(split + 1, right)
        return root

    return helper(0, len(inorder) - 1)
```

#### TypeScript

```typescript
function buildTree(preorder: number[], inorder: number[]): TreeNode | null {
  const indexMap = new Map<number, number>();
  inorder.forEach((value, index) => indexMap.set(value, index));
  let preorderIndex = 0;

  function helper(left: number, right: number): TreeNode | null {
    if (left > right) {
      return null;
    }

    const rootValue = preorder[preorderIndex];
    preorderIndex += 1;
    const root = new TreeNode(rootValue);
    const split = indexMap.get(rootValue);
    if (split === undefined) {
      throw new Error("invalid traversal input");
    }

    root.left = helper(left, split - 1);
    root.right = helper(split + 1, right);
    return root;
  }

  return helper(0, inorder.length - 1);
}
```

#### Rust

```rust
use std::collections::HashMap;

fn build_tree(preorder: &[i32], inorder: &[i32]) -> Option<Box<TreeNode>> {
    let index_map: HashMap<i32, usize> = inorder.iter().enumerate().map(|(i, &v)| (v, i)).collect();
    let mut preorder_index = 0usize;

    fn helper(
        preorder: &[i32],
        index_map: &HashMap<i32, usize>,
        preorder_index: &mut usize,
        left: usize,
        right: usize,
    ) -> Option<Box<TreeNode>> {
        if left > right {
            return None;
        }

        let root_value = preorder[*preorder_index];
        *preorder_index += 1;
        let split = *index_map.get(&root_value)?;

        let left_subtree = if split == 0 || left > split - 1 {
            None
        } else {
            helper(preorder, index_map, preorder_index, left, split - 1)
        };
        let right_subtree = helper(preorder, index_map, preorder_index, split + 1, right);

        Some(Box::new(TreeNode {
            val: root_value,
            left: left_subtree,
            right: right_subtree,
        }))
    }

    if inorder.is_empty() {
        None
    } else {
        helper(preorder, &index_map, &mut preorder_index, 0, inorder.len() - 1)
    }
}
```

---

## Hard Problems

---

### Problem 7: Serialize and Deserialize Binary Tree

**Pattern:** Structural encoding of a recursive object

**Why it is hard:**
The challenge is not traversal. It is preserving enough shape
information to rebuild the exact same tree later.

### Common mistake

If you serialize only node values in preorder, you lose where the
null children were.

### Correct idea

Use preorder plus explicit null markers.

```
          [1]
         /   \
       [2]   [3]
            /   \
          [4]   [5]

  Serialized preorder with null markers:
  1,2,#,#,3,4,#,#,5,#,#
```

That sequence contains enough information to reconstruct the tree.

#### Python

```python
def serialize(root: TreeNode | None) -> str:
    values: list[str] = []

    def dfs(node: TreeNode | None) -> None:
        if node is None:
            values.append("#")
            return
        values.append(str(node.val))
        dfs(node.left)
        dfs(node.right)

    dfs(root)
    return ",".join(values)


def deserialize(data: str) -> TreeNode | None:
    values = iter(data.split(","))

    def dfs() -> TreeNode | None:
        value = next(values)
        if value == "#":
            return None
        node = TreeNode(int(value))
        node.left = dfs()
        node.right = dfs()
        return node

    return dfs()
```

#### TypeScript

```typescript
function serialize(root: TreeNode | null): string {
  const values: string[] = [];

  function dfs(node: TreeNode | null): void {
    if (node === null) {
      values.push("#");
      return;
    }
    values.push(String(node.val));
    dfs(node.left);
    dfs(node.right);
  }

  dfs(root);
  return values.join(",");
}

function deserialize(data: string): TreeNode | null {
  const values = data.split(",");
  let index = 0;

  function dfs(): TreeNode | null {
    const value = values[index];
    index += 1;
    if (value === "#") {
      return null;
    }
    const node = new TreeNode(Number(value));
    node.left = dfs();
    node.right = dfs();
    return node;
  }

  return dfs();
}
```

#### Rust

```rust
fn serialize(root: &Option<Box<TreeNode>>) -> String {
    fn dfs(node: &Option<Box<TreeNode>>, values: &mut Vec<String>) {
        match node {
            None => values.push("#".to_string()),
            Some(current) => {
                values.push(current.val.to_string());
                dfs(&current.left, values);
                dfs(&current.right, values);
            }
        }
    }

    let mut values = Vec::new();
    dfs(root, &mut values);
    values.join(",")
}
```

---

### Problem 8: Binary Tree Maximum Path Sum

**Pattern:** Tree DP with two different meanings of "best"

**Why it is hard:**
At each node you need to distinguish between:

- the best downward path you can return to your parent
- the best complete path that passes through this node

Those are not the same quantity.

### Key insight

For a node:

- downward gain = node + max(0, left_gain, right_gain)
- through-node path = node + max(0, left_gain) + max(0, right_gain)

The through-node value can update the global answer, but only the
single-branch downward gain can be returned upward.

#### Python

```python
def max_path_sum(root: TreeNode | None) -> int:
    best = float("-inf")

    def dfs(node: TreeNode | None) -> int:
        nonlocal best
        if node is None:
            return 0

        left_gain = max(dfs(node.left), 0)
        right_gain = max(dfs(node.right), 0)
        best = max(best, node.val + left_gain + right_gain)
        return node.val + max(left_gain, right_gain)

    dfs(root)
    return int(best)
```

#### TypeScript

```typescript
function maxPathSum(root: TreeNode | null): number {
  let best = Number.NEGATIVE_INFINITY;

  function dfs(node: TreeNode | null): number {
    if (node === null) {
      return 0;
    }

    const leftGain = Math.max(dfs(node.left), 0);
    const rightGain = Math.max(dfs(node.right), 0);
    best = Math.max(best, node.val + leftGain + rightGain);
    return node.val + Math.max(leftGain, rightGain);
  }

  dfs(root);
  return best;
}
```

#### Rust

```rust
fn max_path_sum(root: &Option<Box<TreeNode>>) -> i32 {
    fn dfs(node: &Option<Box<TreeNode>>, best: &mut i32) -> i32 {
        match node {
            None => 0,
            Some(current) => {
                let left_gain = dfs(&current.left, best).max(0);
                let right_gain = dfs(&current.right, best).max(0);
                *best = (*best).max(current.val + left_gain + right_gain);
                current.val + left_gain.max(right_gain)
            }
        }
    }

    let mut best = i32::MIN;
    dfs(root, &mut best);
    best
}
```

---

## What These Problems Were Really Testing

```
  PROBLEM -> UNDERLYING TREE IDEA

  Maximum depth                     -> combine child recursion
  Symmetric tree                    -> mirrored recursion
  Path sum                          -> carry state down the tree
  Validate BST                      -> inherited range constraints
  Level order traversal             -> BFS by depth layers
  Construct tree from traversals    -> recursive splitting
  Serialize / deserialize           -> preserve shape explicitly
  Maximum path sum                  -> tree DP with global answer
```

The real pattern is that trees force you to ask:

- what information flows down?
- what information flows up?
- what information must be global?

That framing is more useful than memorizing individual problems.

---

## Exercises

1. Re-solve `maximum depth` iteratively using BFS instead of
   recursion.
2. Explain why validating a BST using only parent-child checks is
   incorrect.
3. Modify `level order traversal` to return levels from bottom to
   top.
4. For `construct tree from preorder and inorder`, trace the split
   logic on a 5-node example by hand.
5. Explain why null markers are required in binary-tree
   serialization.
6. For `maximum path sum`, construct a case where the best path
   does not go through the root.

---

## Key Takeaways

- Easy tree problems usually test clean recursive structure.
- Medium tree problems often hinge on what constraints flow from
  ancestors or what traversal order exposes the structure.
- Hard tree problems often require separating local return values
  from global answers.
- Tree problems are easiest when you explicitly ask what state
  travels downward, upward, or globally.

The next lesson closes Phase 3 with advanced tree techniques:
LCA, Morris traversal, and tree dynamic programming.

---

**Previous**: [Lesson 23 — Segment Trees and Fenwick Trees](./23-segment-trees-fenwick.md)
**Next**: [Lesson 25 — Tree Techniques — LCA, Morris Traversal, and Tree DP](./25-tree-techniques.md)