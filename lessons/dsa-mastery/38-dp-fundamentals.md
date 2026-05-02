# Lesson 38: Dynamic Programming Fundamentals

> **Analogy**: Solving a crossword puzzle is easier when each filled-in
> answer helps constrain the next one. Dynamic programming works the same
> way: solve smaller subproblems once, store their answers, and reuse
> them instead of recomputing them over and over.

---

## Why This Matters

Dynamic programming is one of the most important and most misunderstood
algorithm paradigms.

People often think DP means:

- making a table
- memorizing patterns
- spotting certain LeetCode tags

That is too shallow. DP is about one precise idea:

> When a recursive problem has overlapping subproblems and optimal
> substructure, cache the answers to smaller subproblems instead of
> recomputing them.

DP is powerful because it converts exponential recursive search into
polynomial-time computation in many classic problems.

---

## The Two Conditions That Make DP Work

### 1. Overlapping subproblems

The same smaller subproblem appears multiple times.

### 2. Optimal substructure

An optimal answer to the full problem can be built from optimal answers
to smaller subproblems.

If either condition is missing, dynamic programming is not the right
tool.

---

## The Canonical Warning Sign: Fibonacci

Naive recursion:

```python
def fib(n: int) -> int:
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
```

Recursion tree:

```
  fib(5)
  ├── fib(4)
  │   ├── fib(3)
  │   │   ├── fib(2)
  │   │   └── fib(1)
  │   └── fib(2)
  └── fib(3)
      ├── fib(2)
      └── fib(1)
```

Repeated work is obvious:

- `fib(3)` is computed more than once
- `fib(2)` is computed more than once

That is the signal for memoization.

---

## Memoization: Top-Down DP

Memoization keeps the recursive structure but stores subproblem answers
the first time they are computed.

#### Python

```python
def fib_memo(n: int, memo: dict[int, int] | None = None) -> int:
    if memo is None:
        memo = {}
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo)
    return memo[n]
```

Now each `fib(k)` is solved once.

Time becomes:

$$
O(n)
$$

instead of exponential.

### Why memoization is often the best first step

When a brute-force recursive solution exists, memoization is usually the
easiest path to a correct DP.

It lets you:

- preserve the original reasoning
- discover the real subproblem state
- avoid building the table too early

---

## Tabulation: Bottom-Up DP

Tabulation computes subproblems in dependency order from smallest to
largest.

#### TypeScript

```typescript
function fibTab(n: number): number {
  if (n <= 1) {
    return n;
  }

  const dp = new Array<number>(n + 1).fill(0);
  dp[1] = 1;

  for (let index = 2; index <= n; index += 1) {
    dp[index] = dp[index - 1] + dp[index - 2];
  }

  return dp[n];
}
```

### Memoization vs tabulation

```
  MEMOIZATION                     TABULATION

  top-down recursion              bottom-up iteration
  computes only needed states     usually computes all states
  often easier to derive          often easier to optimize space
```

You should be fluent in both. Interviews often start with memoization
and then ask for a bottom-up version.

---

## Example 1: Climbing Stairs

### Problem

You can climb 1 or 2 steps at a time. In how many distinct ways can you
reach step `n`?

### Recursive recurrence

To land on step `n`, you must come from:

- `n - 1`
- `n - 2`

So:

$$
ways(n) = ways(n - 1) + ways(n - 2)
$$

with base cases:

$$
ways(0) = 1, \quad ways(1) = 1
$$

This is Fibonacci in disguise.

#### Rust

```rust
fn climb_stairs(n: usize) -> i32 {
    if n <= 1 {
        return 1;
    }

    let mut dp = vec![0; n + 1];
    dp[0] = 1;
    dp[1] = 1;

    for index in 2..=n {
        dp[index] = dp[index - 1] + dp[index - 2];
    }

    dp[n]
}
```

---

## Example 2: Coin Change

### Problem

Given coin denominations and a target amount, find the minimum number
of coins needed to make that amount.

### Brute-force thought

Try every possible combination of coins. That explodes.

### DP insight

If `dp[a]` means the minimum coins to make amount `a`, then:

$$
dp[a] = 1 + \min(dp[a - coin])
$$

over all usable coins.

#### Python

```python
def coin_change(coins: list[int], amount: int) -> int:
    dp = [amount + 1] * (amount + 1)
    dp[0] = 0

    for current in range(1, amount + 1):
        for coin in coins:
            if coin <= current:
                dp[current] = min(dp[current], dp[current - coin] + 1)

    return dp[amount] if dp[amount] != amount + 1 else -1
```

### Why this is DP

The optimal answer for amount `a` depends on optimal answers for smaller
amounts. That is optimal substructure.

And those smaller amounts are reused many times. That is overlap.

---

## Example 3: Longest Common Subsequence (LCS)

### Problem

Given strings `text1` and `text2`, find the length of their longest
common subsequence.

### Subproblem definition

Let `dp[i][j]` be the LCS length between:

- `text1[:i]`
- `text2[:j]`

### Recurrence

If the current characters match:

$$
dp[i][j] = dp[i - 1][j - 1] + 1
$$

Otherwise:

$$
dp[i][j] = \max(dp[i - 1][j], dp[i][j - 1])
$$

### ASCII table intuition

```
      ''  A  C  E
   ''  0  0  0  0
   A   0  1  1  1
   B   0  1  1  1
   C   0  1  2  2
   D   0  1  2  2
   E   0  1  2  3
```

Every cell summarizes a smaller subproblem.

#### TypeScript

```typescript
function longestCommonSubsequence(text1: string, text2: string): number {
  const rows = text1.length + 1;
  const cols = text2.length + 1;
  const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      if (text1[row - 1] === text2[col - 1]) {
        dp[row][col] = dp[row - 1][col - 1] + 1;
      } else {
        dp[row][col] = Math.max(dp[row - 1][col], dp[row][col - 1]);
      }
    }
  }

  return dp[text1.length][text2.length];
}
```

---

## How To Recognize A DP Problem

Ask these questions:

1. Can I write a brute-force recursive version?
2. Do the same subproblems appear repeatedly?
3. Can the answer be defined in terms of smaller answers?
4. What exactly is the state that identifies a subproblem?

That last question is the hardest one.

DP difficulty is often not in coding loops. It is in defining the right
state.

Examples of state:

- index in an array
- remaining capacity
- two string positions
- current row and column
- bitmask of chosen items

---

## What If We Just Used Plain Recursion Without Memoization?

Then overlapping subproblems get recomputed over and over.

For Fibonacci that causes exponential blow-up.
For LCS it creates a huge branching recursion tree.
For coin change it repeatedly recomputes the same amounts.

Memoization is not a small optimization. It is often the difference
between impossible and practical.

---

## Space Optimization

Sometimes DP only depends on a small part of the previous state.

For Fibonacci or climbing stairs, you only need the previous two values.

#### Python

```python
def climb_stairs_optimized(n: int) -> int:
    if n <= 1:
        return 1

    previous_two = 1
    previous_one = 1
    for _ in range(2, n + 1):
        previous_two, previous_one = previous_one, previous_two + previous_one
    return previous_one
```

This reduces space from $O(n)$ to $O(1)$.

Optimization comes after state design, not before it.

---

## Exercises

1. Explain the difference between overlapping subproblems and optimal
   substructure. Give a problem that has one but not the other, or explain
   why both are needed for DP.
2. Why is Fibonacci the canonical DP teaching example? Trace the naive
   recursion tree for `fib(5)` and count how many times `fib(2)` is called.
3. For coin change, what does the state `dp[a]` mean? Explain the
   recurrence and why iterating coins outermost versus innermost matters.
4. For LCS, why is a 2D state natural? Explain the four cases in the
   recurrence and draw a small DP table for two short strings.
5. Convert a recursive memoized solution into a tabulated one for a
   simple problem of your choice. Show the dependency order and explain
   why bottom-up avoids recursion stack limits.
6. Give an example of a problem that has recursion but not overlapping
   subproblems. Why is memoization useless there?
7. In climbing stairs, explain why space-optimized DP works and what
   invariant it preserves. Why can you discard `dp[i-2]` once `dp[i]` is
   computed?
8. Design a small problem with optimal substructure but no overlapping
   subproblems. Is DP still useful, or would divide-and-conquer suffice?

---

## Key Takeaways

- Dynamic programming is recursion plus reuse.
- It works when subproblems overlap and the problem has optimal
  substructure.
- Memoization preserves recursive thinking while avoiding recomputation.
- Tabulation computes states in dependency order from the bottom up.
- The hardest part of DP is usually identifying the right state and
  recurrence.

The next lesson pushes further into advanced DP patterns, optimizations,
and harder problem families.

---

**Previous**: [Lesson 37 — Divide and Conquer](./37-divide-and-conquer.md)
**Next**: [Lesson 39 — Advanced Dynamic Programming](./39-dp-advanced.md)