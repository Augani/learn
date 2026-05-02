# Lesson 36: Recursion and Recurrence Relations

> **Analogy**: Think of Russian nesting dolls. You open a large doll,
> and inside is a smaller copy of the same structure. Then inside that,
> another. Recursion works when a problem has that same shape: a large
> problem contains a smaller version of itself. The art is knowing where
> to stop opening dolls and how to combine what you found.

---

## Why This Matters

Phase 5 is about algorithm design paradigms, and recursion sits at the
foundation of almost all of them.

- divide and conquer is recursive by structure
- backtracking is recursive search with undo steps
- dynamic programming often begins as a recursive recurrence before it
  becomes memoization or tabulation
- tree algorithms are naturally recursive because every subtree is a
  smaller tree

There are really two separate but connected ideas here:

- **recursion as a way to write algorithms**
- **recurrence relations as a way to analyze them**

The first is about control flow.
The second is about cost.

If you do not understand recursion deeply, later paradigms feel like a
bag of tricks. If you do understand it, Phase 5 becomes a sequence of
variations on one core idea: solve a smaller problem, then reason about
what it costs.

By the end of this lesson, you should be able to:

- recognize when recursion is natural
- design correct base cases and shrinking recursive calls
- understand the call stack as a concrete runtime mechanism
- see why some recursions overflow or repeat unnecessary work
- analyze common recurrences with unrolling, recursion trees, and the
  Master Theorem

---

## Recursion As Problem Decomposition

A recursive algorithm works when a problem can be reduced to a smaller
instance of the same problem.

Every correct recursive function has three essential ingredients:

1. a **base case** that is small enough to solve directly
2. a **recursive step** that reduces the problem size
3. a **progress argument** that proves the recursion must eventually hit
   the base case

That third ingredient is the part beginners often skip mentally.
Recursion is not correct because it "looks elegant." It is correct only
if every call moves closer to termination.

---

## A First Worked Example: Factorial

Mathematically:

$$
n! = n \cdot (n - 1)! \quad \text{for } n > 1
$$

with base case:

$$
0! = 1
$$

This definition is recursive, so the code is naturally recursive.

#### Python

```python
def factorial(n: int) -> int:
    if n < 0:
        raise ValueError("n must be non-negative")
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

#### TypeScript

```typescript
function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("n must be a non-negative integer");
  }
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}
```

#### Rust

```rust
fn factorial(n: u64) -> u64 {
    if n <= 1 {
        return 1;
    }
    n * factorial(n - 1)
}
```

### Full evaluation trace

```
  factorial(4)
  = 4 * factorial(3)
  = 4 * (3 * factorial(2))
  = 4 * (3 * (2 * factorial(1)))
  = 4 * (3 * (2 * 1))
  = 24
```

This exposes an important point: recursion often has two phases.

- **descent**: calls move toward the base case
- **unwind**: results come back upward and are combined

Many recursive problems are easiest to understand when you ask which
work happens on the way down and which work happens on the way back up.

---

## The Call Stack Is The Runtime Reality

Recursive code is not magic. Every function call creates a stack frame.
That frame stores local variables, the return address, and intermediate
state.

### Call stack trace for `factorial(4)`

```
  Descending calls:

  +------------------------------+
  | factorial(4): waiting for    |
  | 4 * factorial(3)             |
  +------------------------------+
  | factorial(3): waiting for    |
  | 3 * factorial(2)             |
  +------------------------------+
  | factorial(2): waiting for    |
  | 2 * factorial(1)             |
  +------------------------------+
  | factorial(1): returns 1      |
  +------------------------------+

  Unwinding:

  factorial(2) receives 1, returns 2
  factorial(3) receives 2, returns 6
  factorial(4) receives 6, returns 24
```

This is why recursion is so closely tied to stacks. Recursive control
flow is just a disciplined way of using the call stack.

### Why this matters for algorithms

Some algorithms are elegant recursively because the stack naturally
stores the path of unfinished work:

- tree traversals store the path from root to current node
- DFS stores the current search path
- divide-and-conquer stores suspended subproblems

But that elegance is not free. Deep recursion consumes stack space.

---

## Stack Overflow And Broken Progress

If recursive calls never bottom out, or bottom out too late, the stack
keeps growing until the program runs out of space.

### Broken example

```python
def broken(n: int) -> int:
    return broken(n + 1)
```

This has no base case and moves in the wrong direction.

### What if we forgot the base case?

Then the function does not describe a finite computation. It describes
an infinite descent.

```
  broken(1)
    -> broken(2)
      -> broken(3)
        -> broken(4)
          -> broken(5)
            -> ...

  No call can return, because none reaches a stopping condition.
```

### More subtle bug: wrong progress metric

```python
def also_broken(n: int) -> int:
    if n == 0:
        return 0
    return also_broken(n // 2 + 1)
```

For some values, this may stop shrinking properly and can get trapped.

The general rule is:

> You do not just need a base case. You need a measure that strictly
> decreases toward it.

That measure might be:

- input size
- remaining depth
- number of choices left
- number of items unprocessed

---

## Recursive Thinking: The Three Questions

When designing a recursive algorithm, ask:

1. **What is the smallest instance I can solve directly?**
2. **If smaller instances were already solved, how would I use them?**
3. **Why must the input get smaller on every call?**

### Example: sum of an array

```
  sum([4, 1, 7, 2])
  = 4 + sum([1, 7, 2])
  = 4 + 1 + sum([7, 2])
  = 4 + 1 + 7 + sum([2])
  = 4 + 1 + 7 + 2 + sum([])
  = 14
```

#### Python

```python
def array_sum(values: list[int], index: int = 0) -> int:
    if index == len(values):
        return 0
    return values[index] + array_sum(values, index + 1)
```

What the recursion is really saying:

- base case: an empty suffix sums to `0`
- recursive case: current answer is `values[index] + answer_of_rest`

This is the same mental pattern you will use later for DP recurrences.

---

## Tail Recursion

A recursive call is **tail recursive** when nothing remains to do after
the recursive call returns.

### Tail-recursive factorial

Instead of delaying multiplication until unwind, carry the partial
answer forward in an accumulator.

#### TypeScript

```typescript
function factorialTail(n: number, acc = 1): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("n must be a non-negative integer");
  }
  if (n <= 1) {
    return acc;
  }
  return factorialTail(n - 1, acc * n);
}
```

### Non-tail vs tail recursion

```
  Non-tail:
  return n * factorial(n - 1)
         ^ work still remains after the recursive call returns

  Tail:
  return factorialTail(n - 1, acc * n)
         ^ result of recursive call is returned directly
```

### Why people care about tail recursion

In languages with guaranteed tail-call optimization, tail recursion can
reuse stack frames and behave like iteration in space.

But many mainstream runtimes do not guarantee that optimization. So the
right engineering lesson is:

- tail recursion is a useful conceptual transformation
- do not assume it removes stack growth unless your runtime promises it

---

## Recursion Vs Iteration

Recursion is often clearer when the structure itself is recursive.
Iteration is often safer when stack depth may be large.

### Same idea, two forms

#### Python recursive binary search

```python
def binary_search_recursive(values: list[int], target: int, left: int, right: int) -> int:
    if left > right:
        return -1

    middle = (left + right) // 2
    if values[middle] == target:
        return middle
    if target < values[middle]:
        return binary_search_recursive(values, target, left, middle - 1)
    return binary_search_recursive(values, target, middle + 1, right)
```

#### Python iterative binary search

```python
def binary_search_iterative(values: list[int], target: int) -> int:
    left = 0
    right = len(values) - 1

    while left <= right:
        middle = (left + right) // 2
        if values[middle] == target:
            return middle
        if target < values[middle]:
            right = middle - 1
        else:
            left = middle + 1

    return -1
```

The recursive version mirrors the mathematical idea of halving the
problem. The iterative version avoids call-stack growth.

Good engineers learn both expressions of the same logic.

---

## From Recursive Structure To Recurrence Relations

When you analyze recursive algorithms, you usually do not count every
machine instruction directly. You describe the total cost recursively.

That description is a **recurrence relation**.

### Example: binary search

Binary search solves one half-size subproblem and does constant extra
work to compare with the midpoint.

$$
T(n) = T(n / 2) + O(1)
$$

### Example: merge sort

Merge sort solves two half-size subproblems and spends linear work to
merge the sorted halves.

$$
T(n) = 2T(n / 2) + O(n)
$$

### Example: linear recursion

If a function processes one element and recurses on the rest, the cost
often looks like:

$$
T(n) = T(n - 1) + O(1)
$$

The recurrence is not just a formula. It is a compressed explanation of
the algorithm's structure.

---

## Unrolling A Recurrence By Hand

Take:

$$
T(n) = T(n - 1) + 1
$$

Expand repeatedly:

$$
T(n) = T(n - 2) + 2
$$

$$
T(n) = T(n - 3) + 3
$$

$$
T(n) = T(1) + (n - 1)
$$

So:

$$
T(n) = O(n)
$$

This is the simplest recurrence-solving technique, and you should be
comfortable doing it mechanically.

### Slightly richer example

$$
T(n) = T(n - 1) + n
$$

Unrolling gives:

$$
T(n) = T(n - 2) + (n - 1) + n
$$

$$
T(n) = T(n - 3) + (n - 2) + (n - 1) + n
$$

Eventually:

$$
T(n) = T(1) + 2 + 3 + \dots + n = O(n^2)
$$

This matters because many naive recursive algorithms accumulate a full
linear amount of extra work at each level.

---

## The Recursion Tree Method

The recursion tree method visualizes the work at each level of the
recursion.

### Merge sort

$$
T(n) = 2T(n / 2) + n
$$

```
  Level 0:                        cost n
                                [size n]

  Level 1:            [n/2]                 [n/2]
                       n/2                   n/2      total = n

  Level 2:      [n/4] [n/4]           [n/4] [n/4]
                  n/4   n/4             n/4   n/4    total = n

  Level 3:    eight subproblems of size n/8                     total = n

  ...

  Height = log2(n)
```

Each level contributes total work $n$.
There are $\log n$ levels.
Therefore:

$$
T(n) = O(n \log n)
$$

### Why the tree method is useful

It tells you **where** the work is concentrated.

- if every level costs the same, multiply by depth
- if upper levels dominate, the root work matters most
- if leaf levels dominate, the recursive explosion matters most

This is far more intuitive than memorizing formulas.

---

## A Second Recursion Tree: Binary Search

For binary search:

$$
T(n) = T(n / 2) + 1
$$

```
  Level 0:  1
  Level 1:  1
  Level 2:  1
  Level 3:  1
  ...

  Number of levels until size becomes 1 = log2(n)
```

So:

$$
T(n) = O(\log n)
$$

Unlike merge sort, each level here contains only one recursive branch.
That single design choice changes the complexity dramatically.

---

## The Substitution Method

The substitution method means:

1. guess an asymptotic form
2. substitute it into the recurrence
3. verify that the inequality closes correctly

### Example

Suppose:

$$
T(n) = 2T(n / 2) + n
$$

Guess:

$$
T(n) = O(n \log n)
$$

Then substituting the guess into the right-hand side gives:

$$
T(n) \le 2 \cdot c(n / 2)\log(n / 2) + n
$$

$$
= cn(\log n - 1) + n
$$

$$
= cn\log n - cn + n
$$

For a large enough constant $c$, this is bounded by $cn\log n$.

The substitution method is more formal than a recursion tree. It is how
you turn intuition into a proof sketch.

---

## The Master Theorem

For divide-and-conquer recurrences of the form:

$$
T(n) = aT(n / b) + f(n)
$$

compare the non-recursive work $f(n)$ against:

$$
n^{\log_b a}
$$

That quantity represents the amount of work contributed by the recursive
branching structure alone.

### Case 1: recursive work dominates

If:

$$
f(n) = O(n^{\log_b a - \varepsilon})
$$

for some $\varepsilon > 0$, then:

$$
T(n) = \Theta(n^{\log_b a})
$$

Example:

$$
T(n) = 4T(n / 2) + n
$$

Here $a = 4$, $b = 2$, so:

$$
n^{\log_2 4} = n^2
$$

Since $n$ is smaller than $n^2$, recursive branching dominates.
Therefore:

$$
T(n) = \Theta(n^2)
$$

### Case 2: balanced contribution

If:

$$
f(n) = \Theta(n^{\log_b a} \log^k n)
$$

then:

$$
T(n) = \Theta(n^{\log_b a} \log^{k+1} n)
$$

Classic example:

$$
T(n) = 2T(n / 2) + n
$$

Here both the recursive structure and the combine work contribute at
the same scale, so:

$$
T(n) = \Theta(n \log n)
$$

### Case 3: non-recursive work dominates

If:

$$
f(n) = \Omega(n^{\log_b a + \varepsilon})
$$

and a regularity condition holds, then:

$$
T(n) = \Theta(f(n))
$$

Example:

$$
T(n) = 2T(n / 2) + n^2
$$

The combine work is so large that it dominates the whole process, so:

$$
T(n) = \Theta(n^2)
$$

### Practical warning

The Master Theorem is powerful, but it does **not** apply to every
recurrence. It works only for a fairly specific divide-and-conquer form.

It does not directly handle:

- $T(n) = T(n - 1) + 1$
- $T(n) = T(\sqrt{n}) + 1$
- recurrences with uneven split sizes like quicksort's worst case

---

## Why Recursion Maps Naturally To Certain Structures

Recursion feels natural when the input is structurally recursive.

### Trees

Every subtree is itself a tree.

That is why tree algorithms almost write themselves recursively:

```python
def height(node: TreeNode | None) -> int:
    if node is None:
        return 0
    return 1 + max(height(node.left), height(node.right))
```

### Divide-and-conquer arrays

An array split into halves creates smaller versions of the same sorting,
searching, or selection problem.

### Search spaces

When every partial decision creates a smaller remaining search problem,
backtracking becomes the recursive expression of that tree of choices.

### Dynamic programming

DP often begins as a naive recursion over subproblems. Memoization is
what happens when we realize those recursive calls overlap.

This is why recursion is not a separate topic from later Phase 5
lessons. It is the common substrate beneath them.

---

## When Iteration Is Better Engineering

Recursion is not automatically superior.

Iteration is often better when:

- maximum depth may be very large
- explicit control of memory matters
- the state transition is simple and linear
- the language/runtime has limited recursion depth

### Example: iterative DFS

Recursive DFS is elegant, but an explicit stack may be safer on a very
deep graph.

```python
def dfs_iterative(graph: dict[int, list[int]], start: int) -> list[int]:
    stack = [start]
    visited: set[int] = set()
    order: list[int] = []

    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        for neighbor in reversed(graph.get(node, [])):
            if neighbor not in visited:
                stack.append(neighbor)

    return order
```

The important skill is not choosing recursion or iteration by style
preference. It is understanding that they often express the same logic
with different operational trade-offs.

---

## Worked Complexity Examples

### Example 1: Fibonacci recursion

Naive Fibonacci:

```python
def fib(n: int) -> int:
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
```

Recurrence:

$$
T(n) = T(n - 1) + T(n - 2) + O(1)
$$

This is much worse than linear. The recursion tree branches repeatedly,
and the same subproblems appear many times.

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

Notice how `fib(3)` and `fib(2)` repeat. This is the exact doorway into
dynamic programming.

### Example 2: merge sort

Merge sort recurrence:

$$
T(n) = 2T(n / 2) + O(n)
$$

Interpretation:

- two recursive calls sort the halves
- one linear pass combines them

This leads to:

$$
T(n) = O(n \log n)
$$

### Example 3: binary search

Binary search recurrence:

$$
T(n) = T(n / 2) + O(1)
$$

Each step discards half the work, so:

$$
T(n) = O(\log n)
$$

These three examples are worth comparing because they represent three
different recursive growth patterns:

- repeated linear shrink: $T(n - 1)$
- repeated halving with one branch: $T(n / 2)$
- repeated halving with two branches: $2T(n / 2)$

---

## Common Recurrence Patterns Cheat Sheet

```
  RECURRENCE                    TYPICAL RESULT

  T(n) = T(n - 1) + O(1)        O(n)
  T(n) = T(n - 1) + O(n)        O(n^2)
  T(n) = T(n / 2) + O(1)        O(log n)
  T(n) = T(n / 2) + O(n)        O(n)
  T(n) = 2T(n / 2) + O(n)       O(n log n)
  T(n) = 2T(n / 2) + O(1)       O(n)
  T(n) = 3T(n / 2) + O(n)       O(n^log2(3))
```

Do not memorize this blindly. Use it to build pattern recognition.

---

## Cross-References

- For earlier discussion of stack behavior, see
  [./05-stacks.md](./05-stacks.md).
- For earlier recurrence examples inside complexity analysis, see
  [./02-computational-complexity.md](./02-computational-complexity.md).
- For a more math-centered treatment of recurrence relations, see
  [../discrete-math/06-recurrence-relations.md](../discrete-math/06-recurrence-relations.md).

---

## Exercises

1. Explain why every recursive algorithm needs a decreasing progress
   measure, not just a base case.
2. Draw the stack frames for `factorial(5)` and label what each frame is
   waiting for.
3. Unroll $T(n) = T(n - 1) + 3$ and solve it.
4. Use a recursion tree to analyze $T(n) = 2T(n / 2) + n$.
5. Use the Master Theorem to classify $T(n) = 8T(n / 2) + n^2$.
6. Explain why naive Fibonacci recursion is a warning sign for dynamic
   programming.
7. Give an example where iterative code is safer than recursive code.

---

## Key Takeaways

- Recursion expresses self-similar problem structure directly.
- The call stack is the concrete mechanism behind recursive execution.
- Correct recursion requires both a base case and a strictly shrinking
  progress argument.
- Recurrence relations compress the runtime structure of recursive
  algorithms into equations.
- Unrolling, recursion trees, substitution, and the Master Theorem are
  core tools for analyzing recursive algorithms.
- Phase 5 builds on this lesson repeatedly: divide-and-conquer,
  dynamic programming, and backtracking all rely on recursive thinking.

The next lesson turns recursion into a full design strategy: divide and
conquer.

---

**Previous**: [Lesson 35 — Graph Modeling Techniques](./35-graph-modeling.md)
**Next**: [Lesson 37 — Divide and Conquer](./37-divide-and-conquer.md)