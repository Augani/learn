# Lesson 39: Advanced Dynamic Programming

> **Analogy**: Basic dynamic programming is like learning how to fill a
> spreadsheet carefully. Advanced dynamic programming is learning when to
> redesign the spreadsheet, compress it, traverse it in a surprising
> order, or realize the whole problem is secretly another pattern such as
> binary search or patience sorting in disguise.

---

## Why This Matters

Once you understand DP fundamentals, the next difficulty is not the
idea of memoization or tabulation. It is handling richer state spaces,
choosing among multiple formulations, and compressing brute force into
something practical.

This lesson covers:

- knapsack variants
- edit distance
- matrix chain multiplication
- longest increasing subsequence
- DP on trees

The through-line is the same:

- start with brute force
- identify the repeating subproblem state
- derive the recurrence
- choose memoization, tabulation, or an optimized variant

---

## The DP Workflow, Revisited

For harder DP problems, use this sequence deliberately:

1. write the brute-force recursive idea
2. identify what parameters fully determine a subproblem
3. memoize it
4. convert to bottom-up if useful
5. optimize space only after correctness is clear

This workflow matters because advanced DP often feels hard only when you
try to jump directly to the optimized version.

---

## 0/1 Knapsack

### Problem

Each item can be taken at most once. Maximize total value without
exceeding capacity.

### Brute-force recursion

For each item, you either:

- take it
- skip it

That immediately creates a binary recursion tree.

### State

`dp[i][w]` = best value using items from index `i` onward with remaining
capacity `w`.

### Recurrence

If item `i` is too heavy, skip it.
Otherwise:

$$
dp[i][w] = \max(\text{skip}, \text{take})
$$

where:

$$
\text{skip} = dp[i + 1][w]
$$

$$
\text{take} = value[i] + dp[i + 1][w - weight[i]]
$$

#### Python

```python
def knapsack_01(weights: list[int], values: list[int], capacity: int) -> int:
    item_count = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(item_count + 1)]

    for item in range(item_count - 1, -1, -1):
        for remaining in range(capacity + 1):
            dp[item][remaining] = dp[item + 1][remaining]
            if weights[item] <= remaining:
                dp[item][remaining] = max(
                    dp[item][remaining],
                    values[item] + dp[item + 1][remaining - weights[item]],
                )

    return dp[0][capacity]
```

### What if we tried greedy for 0/1 knapsack?

Greedy works for **fractional** knapsack, but not for 0/1 knapsack.

Counterexample:

```
  capacity = 50

  item A: weight 10, value 60   ratio 6
  item B: weight 20, value 100  ratio 5
  item C: weight 30, value 120  ratio 4

  Greedy by value/weight picks A and B -> value 160
  Optimal is B and C -> value 220
```

The inability to split items destroys the greedy guarantee.

---

## Unbounded Knapsack

Now each item can be taken multiple times.

The state changes subtly because taking an item does **not** force you
to advance past it.

That single modeling change alters the recurrence.

---

## Fractional Knapsack

Fractional knapsack is not actually a DP problem in its best form.
It is solved greedily by value density.

This is useful precisely because it contrasts with 0/1 knapsack.
Two similar problem statements can demand different paradigms.

---

## Edit Distance

### Problem

Compute the minimum number of insertions, deletions, and substitutions
needed to transform one string into another.

### State

`dp[i][j]` = minimum edit distance between suffixes `word1[i:]` and
`word2[j:]`.

### Recurrence

If characters match, move diagonally.

Otherwise take the best of:

- insert
- delete
- replace

#### TypeScript

```typescript
function minDistance(word1: string, word2: string): number {
  const rows = word1.length + 1;
  const cols = word2.length + 1;
  const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    dp[row][word2.length] = word1.length - row;
  }
  for (let col = 0; col < cols; col += 1) {
    dp[word1.length][col] = word2.length - col;
  }

  for (let row = word1.length - 1; row >= 0; row -= 1) {
    for (let col = word2.length - 1; col >= 0; col -= 1) {
      if (word1[row] === word2[col]) {
        dp[row][col] = dp[row + 1][col + 1];
      } else {
        dp[row][col] = 1 + Math.min(
          dp[row + 1][col],
          dp[row][col + 1],
          dp[row + 1][col + 1],
        );
      }
    }
  }

  return dp[0][0];
}
```

### ASCII table intuition

```
  word1 = horse
  word2 = ros

  dp[row][col] answers:
  how many edits to transform word1[row:] into word2[col:]
```

Edit distance is a classic example where the DP state is two-dimensional
because two strings are progressing at once.

---

## Matrix Chain Multiplication

### Problem

Given matrices, choose the parenthesization minimizing multiplication
cost.

### Why brute force is bad

There are many possible parenthesizations, and enumerating them grows
rapidly.

### State

`dp[i][j]` = minimum cost to multiply matrices from `i` to `j`.

### Recurrence

Try every split point `k` between `i` and `j`.

This is interval DP.

The pattern matters more than the formula itself:

- problem on a range
- try all split points
- combine left and right interval answers

This same idea appears in many advanced DP problems.

---

## Longest Increasing Subsequence (LIS)

### Standard DP

Let `dp[i]` be the length of the LIS ending at index `i`.

Then:

$$
dp[i] = 1 + \max(dp[j]) \quad \text{for all } j < i \text{ with } a[j] < a[i]
$$

This gives an $O(n^2)$ solution.

#### Rust

```rust
fn lis_length(values: &[i32]) -> usize {
    if values.is_empty() {
        return 0;
    }

    let mut dp = vec![1usize; values.len()];
    let mut best = 1usize;

    for index in 0..values.len() {
        for previous in 0..index {
            if values[previous] < values[index] {
                dp[index] = dp[index].max(dp[previous] + 1);
            }
        }
        best = best.max(dp[index]);
    }

    best
}
```

### Optimized LIS with patience sorting idea

There is a more advanced $O(n \log n)$ method that tracks the smallest
possible tail value for an increasing subsequence of each length.

This is important because it shows a recurring theme in advanced DP:

> Sometimes the best solution starts as DP but gets optimized into a
> more structural algorithm.

---

## DP On Trees

Dynamic programming is not only for arrays and strings.

Tree DP treats each subtree as a subproblem.

### Example: House Robber on Trees

For each node, keep two values:

- `take`: best answer if you rob this node
- `skip`: best answer if you do not rob this node

Then:

$$
take = node.val + skip(left) + skip(right)
$$

$$
skip = \max(take, skip)_{left} + \max(take, skip)_{right}
$$

This is advanced DP because the state is attached to structure, not an
array index.

---

## Brute Force To Optimal: A Pattern Summary

```
  PROBLEM                    EVOLUTION

  0/1 knapsack               recursion -> memo -> table -> space optimize
  edit distance              recursion -> memo/table
  matrix chain               brute-force splits -> interval DP
  LIS                        O(n^2) DP -> O(n log n) optimization
  tree problems              recursive structure -> subtree state DP
```

The consistent move is not "write a table." It is:

- identify state
- remove repeated work
- optimize representation if needed

---

## Exercises

1. Explain why greedy fails for 0/1 knapsack but works for fractional
   knapsack. Construct a concrete counterexample where value-density
   greedy picks a suboptimal set.
2. What does `dp[i][j]` mean in edit distance? Explain the three recursive
   cases (match/replace, insert, delete) and why taking the minimum of all
   valid predecessor states is correct.
3. Why is matrix chain multiplication an interval DP problem? Explain why
   the optimal split point `k` divides the problem into two independent
   subproblems and how the recurrence combines their costs.
4. Why is LIS a good example of DP being optimized beyond a direct table?
   Explain the `O(n^2)` DP and how the patience sorting / binary search
   optimization reduces it to `O(n log n)`.
5. Give an example of a tree problem that naturally becomes DP. Explain
   why the state typically includes "best including root" and "best
   excluding root" or similar subtree aggregations.
6. For one problem in this lesson, describe the progression from brute
   force to memoization to tabulation. Explicitly identify the state space
   size at each step and the final time/space complexity.
7. In 0/1 knapsack, explain why iterating items outermost and capacity
   innermost (in reverse) preserves correctness, while iterating capacity
   forward would allow unlimited reuse of items. What invariant does
   reverse-order protect?
8. For matrix chain multiplication, trace the DP table for three matrices
   with dimensions `A(10x30)`, `B(30x5)`, `C(5x60)`. Show the optimal
   split and the total cost.

---

## Key Takeaways

- Advanced DP is mostly about richer state design and sharper
  optimization, not a different core idea.
- Knapsack shows how small modeling changes can change the paradigm.
- Edit distance and LCS illustrate 2D DP over two progressing strings.
- Matrix chain multiplication is a classic interval DP.
- LIS shows that DP can sometimes be compressed into a faster structural
  algorithm.
- Tree DP extends DP thinking beyond linear data layouts.

The next lesson shifts from reuse and optimal substructure to local
choice rules and correctness proofs: greedy algorithms.

---

**Previous**: [Lesson 38 — Dynamic Programming Fundamentals](./38-dp-fundamentals.md)
**Next**: [Lesson 40 — Greedy Algorithms](./40-greedy-algorithms.md)