# Lesson 09: Binary Trees and BSTs

## What Is a Binary Tree?

A binary tree is a hierarchical data structure where each node has at most **two children**, called left and right.

### The Family Tree Analogy

Think of a simplified family tree where each person has at most two children:

```
            Grandparent
           /            \
       Parent           Uncle
      /     \          /     \
   Child   Child    Cousin  Cousin
```

Tree terminology mapped to the family analogy:
- **Root**: the grandparent (top of the tree)
- **Parent/Child**: exactly what they sound like
- **Leaf**: a node with no children (the youngest generation)
- **Height/Depth**: how many generations from root to the deepest leaf
- **Subtree**: a node and all its descendants

```
Anatomy of a binary tree:

              ┌───┐
              │ 8 │  ← root (depth 0)
              └─┬─┘
           ┌────┴────┐
         ┌─┴─┐     ┌─┴─┐
         │ 3 │     │ 10│  ← depth 1
         └─┬─┘     └─┬─┘
       ┌───┴───┐      └───┐
     ┌─┴─┐   ┌─┴─┐      ┌─┴─┐
     │ 1 │   │ 6 │      │ 14│  ← depth 2
     └───┘   └─┬─┘      └─┬─┘
            ┌──┴──┐     ┌──┘
          ┌─┴─┐ ┌─┴─┐ ┌─┴─┐
          │ 4 │ │ 7 │ │ 13│  ← depth 3 (leaves)
          └───┘ └───┘ └───┘

Height = 3 (longest path from root to leaf)
Size = 8 (total number of nodes)
```

## Binary Search Tree (BST)

A BST is a binary tree with an ordering invariant:
- All values in the **left subtree** are **less than** the node
- All values in the **right subtree** are **greater than** the node
- This rule applies at **every** node, recursively

```
Valid BST:                    NOT a valid BST:

        ┌───┐                        ┌───┐
        │ 8 │                        │ 8 │
        └─┬─┘                        └─┬─┘
     ┌────┴────┐                  ┌────┴────┐
   ┌─┴─┐    ┌─┴──┐             ┌─┴─┐    ┌─┴──┐
   │ 3 │    │ 10 │             │ 3 │    │ 10 │
   └─┬─┘    └─┬──┘             └─┬─┘    └─┬──┘
 ┌───┴─┐      └──┐             ┌─┴──┐     └──┐
┌┴┐  ┌─┴┐     ┌──┴┐           ┌┴┐  ┌┴──┐   ┌─┴┐
│1│  │ 6│     │ 14│           │1│  │ 12│   │ 9│ ← 9 < 10 but
└─┘  └──┘     └───┘           └─┘  └───┘   └──┘   on the RIGHT!
                                    ↑
                              12 > 8 but on left subtree! also wrong
```

### BST Search: O(log n) When Balanced

Searching a BST is like binary search on a sorted array, but navigating a tree:

```
Search for 6 in the BST:

        ┌───┐
        │ 8 │  6 < 8 → go LEFT
        └─┬─┘
     ┌────┘
   ┌─┴─┐
   │ 3 │  6 > 3 → go RIGHT
   └─┬─┘
     └───┐
       ┌─┴─┐
       │ 6 │  6 == 6 → FOUND!
       └───┘

3 comparisons for a tree of 8 nodes.
```

```rust
fn search(node: &Option<Box<BstNode>>, target: i32) -> bool {
    match node {
        None => false,
        Some(n) => match target.cmp(&n.value) {
            std::cmp::Ordering::Equal => true,
            std::cmp::Ordering::Less => search(&n.left, target),
            std::cmp::Ordering::Greater => search(&n.right, target),
        },
    }
}
```

### BST Insert

New values are always inserted as leaves:

```
Insert 5 into BST:

        ┌───┐
        │ 8 │  5 < 8 → go LEFT
        └─┬─┘
     ┌────┘
   ┌─┴─┐
   │ 3 │  5 > 3 → go RIGHT
   └─┬─┘
     └───┐
       ┌─┴─┐
       │ 6 │  5 < 6 → go LEFT
       └─┬─┘
      ┌──┘
    ┌─┴─┐
    │ 5 │  ← new leaf!
    └───┘
```

### BST Delete

Deletion has three cases:

```
Case 1: Leaf node (no children) → just remove it

Delete 4:
    ┌───┐                ┌───┐
    │ 6 │                │ 6 │
    └─┬─┘      →        └─┬─┘
  ┌───┴───┐            ┌──┘
┌─┴─┐   ┌─┴─┐       ┌─┴─┐
│ 4 │   │ 8 │       │ 8 │
└───┘   └───┘       └───┘


Case 2: One child → replace node with its child

Delete 6 (has right child only):
    ┌───┐                ┌───┐
    │ 6 │                │ 8 │   ← 8 moves up
    └─┬─┘      →        └─┬─┘
      └──┐              ┌──┘
       ┌─┴─┐          ┌─┴─┐
       │ 8 │          │ 9 │
       └─┬─┘          └───┘
         └─┐
         ┌─┴─┐
         │ 9 │
         └───┘


Case 3: Two children → replace with in-order successor (smallest in right subtree)

Delete 3:
        ┌───┐                    ┌───┐
        │ 8 │                    │ 8 │
        └─┬─┘                    └─┬─┘
     ┌────┴────┐              ┌────┴────┐
   ┌─┴─┐    ┌─┴──┐         ┌─┴─┐    ┌─┴──┐
   │ 3 │    │ 10 │         │ 4 │    │ 10 │  ← 4 replaces 3
   └─┬─┘    └────┘         └─┬─┘    └────┘
 ┌───┴───┐                ┌──┴───┐
┌┴┐    ┌─┴┐              ┌┴┐  ┌─┴┐
│1│    │ 6│              │1│  │ 6│
└─┘    └─┬┘              └─┘  └──┘
       ┌─┘                          4 was the in-order successor
     ┌─┴┐                          (smallest value > 3)
     │ 4│
     └──┘
```

## Tree Traversals

Four ways to visit every node:

```
         ┌───┐
         │ 4 │
         └─┬─┘
      ┌────┴────┐
    ┌─┴─┐     ┌─┴─┐
    │ 2 │     │ 6 │
    └─┬─┘     └─┬─┘
  ┌───┴───┐  ┌──┴──┐
┌─┴─┐   ┌─┴┐ ┌┴─┐ ┌─┴┐
│ 1 │   │ 3│ │ 5│ │ 7│
└───┘   └──┘ └──┘ └──┘
```

### In-Order (Left, Node, Right) → Sorted!

```
Visit order: 1, 2, 3, 4, 5, 6, 7

For a BST, in-order traversal gives elements in SORTED ORDER.
This is the most important traversal for BSTs.
```

```rust
fn in_order(node: &Option<Box<BstNode>>, result: &mut Vec<i32>) {
    if let Some(n) = node {
        in_order(&n.left, result);
        result.push(n.value);
        in_order(&n.right, result);
    }
}
```

### Pre-Order (Node, Left, Right)

```
Visit order: 4, 2, 1, 3, 6, 5, 7

Used for: copying/serializing a tree, prefix expression evaluation
```

### Post-Order (Left, Right, Node)

```
Visit order: 1, 3, 2, 5, 7, 6, 4

Used for: deleting a tree (delete children before parent), postfix expressions
```

### Level-Order (BFS)

```
Visit order: 4, 2, 6, 1, 3, 5, 7

Level 0: [4]
Level 1: [2, 6]
Level 2: [1, 3, 5, 7]

Used for: printing tree level by level, finding shortest path in tree
```

```rust
use std::collections::VecDeque;

fn level_order(root: &Option<Box<BstNode>>) -> Vec<Vec<i32>> {
    let mut result = Vec::new();
    let mut queue = VecDeque::new();

    if let Some(node) = root {
        queue.push_back(node.as_ref());
    }

    while !queue.is_empty() {
        let level_size = queue.len();
        let mut level = Vec::new();

        for _ in 0..level_size {
            let node = queue.pop_front().unwrap();
            level.push(node.value);

            if let Some(left) = &node.left {
                queue.push_back(left.as_ref());
            }
            if let Some(right) = &node.right {
                queue.push_back(right.as_ref());
            }
        }
        result.push(level);
    }
    result
}
```

## The Balance Problem

A BST's performance depends entirely on its **shape**:

```
Balanced BST (height = 3):         Degenerate BST (height = 6):

        ┌───┐                      ┌───┐
        │ 4 │                      │ 1 │
        └─┬─┘                      └─┬─┘
     ┌────┴────┐                     └─┐
   ┌─┴─┐    ┌─┴─┐                   ┌─┴─┐
   │ 2 │    │ 6 │                   │ 2 │
   └─┬─┘    └─┬─┘                   └─┬─┘
  ┌──┴──┐  ┌──┴──┐                    └─┐
┌─┴┐ ┌─┴┐ ┌┴─┐ ┌─┴┐                  ┌─┴─┐
│ 1│ │ 3│ │ 5│ │ 7│                  │ 3 │
└──┘ └──┘ └──┘ └──┘                  └─┬─┘
                                       └─┐
Search: O(log n) ≈ 3 steps            ┌─┴─┐
                                       │ 4 │
                                       └─┬─┘
                                         └─┐
This happens when you                   ┌─┴─┐
insert sorted data:                     │ 5 │
1, 2, 3, 4, 5, 6, 7                   └─┬─┘
                                         └─┐
                                         ┌─┴─┐
                                         │ 6 │
                                         └─┬─┘
                                           └─┐
                                           ┌─┴─┐
                                           │ 7 │
                                           └───┘

                               Search: O(n) = 7 steps
                               (it's just a linked list!)
```

This is why balanced trees exist (Lesson 10) — they maintain O(log n) height through rotations.

## BST Complexity

| Operation | Balanced BST | Degenerate BST |
|-----------|-------------|----------------|
| Search | O(log n) | O(n) |
| Insert | O(log n) | O(n) |
| Delete | O(log n) | O(n) |
| In-order traversal | O(n) | O(n) |
| Find min/max | O(log n) | O(n) |

## Rust: BTreeMap and BTreeSet

Rust's standard library doesn't provide a BST. Instead, it provides `BTreeMap` and `BTreeSet`, which use B-trees (a self-balancing tree optimized for cache performance — covered in Lesson 10).

```rust
use std::collections::BTreeMap;

let mut map = BTreeMap::new();
map.insert(3, "three");
map.insert(1, "one");
map.insert(4, "four");
map.insert(1, "ONE");  // updates existing key

for (key, value) in &map {
    println!("{}: {}", key, value);
    // Prints in sorted order: 1: ONE, 3: three, 4: four
}

let range: Vec<(&i32, &&str)> = map.range(2..=4).collect();
// [(3, "three"), (4, "four")]
```

## Exercises

### Exercise 1: Implement a BST

Build a basic BST with insert, search, and in-order traversal:

```rust
type Link = Option<Box<BstNode>>;

struct BstNode {
    value: i32,
    left: Link,
    right: Link,
}

struct Bst {
    root: Link,
}

impl Bst {
    fn new() -> Self { Self { root: None } }
    fn insert(&mut self, value: i32) { /* ... */ }
    fn contains(&self, value: i32) -> bool { /* ... */ }
    fn in_order(&self) -> Vec<i32> { /* ... */ }
    fn min(&self) -> Option<i32> { /* ... */ }
    fn max(&self) -> Option<i32> { /* ... */ }
    fn height(&self) -> usize { /* ... */ }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_and_search() {
        let mut bst = Bst::new();
        bst.insert(5);
        bst.insert(3);
        bst.insert(7);
        bst.insert(1);
        bst.insert(4);

        assert!(bst.contains(3));
        assert!(bst.contains(7));
        assert!(!bst.contains(6));
    }

    #[test]
    fn in_order_gives_sorted() {
        let mut bst = Bst::new();
        for val in [5, 3, 7, 1, 4, 6, 8] {
            bst.insert(val);
        }
        assert_eq!(bst.in_order(), vec![1, 3, 4, 5, 6, 7, 8]);
    }

    #[test]
    fn min_and_max() {
        let mut bst = Bst::new();
        for val in [5, 3, 7, 1, 4, 6, 8] {
            bst.insert(val);
        }
        assert_eq!(bst.min(), Some(1));
        assert_eq!(bst.max(), Some(8));
    }
}
```

### Exercise 2: Validate a BST

Write a function that checks whether a binary tree is a valid BST:

```rust
fn is_valid_bst(root: &Link) -> bool {
    fn validate(node: &Link, min: Option<i32>, max: Option<i32>) -> bool {
        // Each node must be within (min, max) range
        // Left child: max becomes current node's value
        // Right child: min becomes current node's value
        todo!()
    }
    validate(root, None, None)
}
```

### Exercise 3: Tree Height and Balance Check

```rust
fn height(node: &Link) -> i32 {
    // Height of empty tree is -1 (or 0, depending on convention)
    // Height of leaf is 0
    // Height of tree = 1 + max(height(left), height(right))
    todo!()
}

fn is_balanced(node: &Link) -> bool {
    // A tree is balanced if for every node:
    // |height(left) - height(right)| <= 1
    // AND both subtrees are balanced
    todo!()
}
```

---

Next: [Lesson 10: Balanced Trees](./10-balanced-trees.md)
