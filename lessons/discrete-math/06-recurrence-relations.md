# Lesson 06 — Recurrence Relations

> **Analogy:** Russian nesting dolls. To open the biggest doll, you must open the one
> inside it, which contains another, and another. Each step depends on the previous one.
> A recurrence relation captures this self-referential structure.

## What Is a Recurrence Relation?

A recurrence defines a sequence where each term depends on previous terms.
You already know the most famous one:

```
Fibonacci:
  F(0) = 0
  F(1) = 1
  F(n) = F(n-1) + F(n-2)   for n >= 2

  0, 1, 1, 2, 3, 5, 8, 13, 21, 34, ...
```

A recurrence has two parts:
1. **Base case(s)** — starting values
2. **Recurrence rule** — how to compute the next term

## Why Programmers Care

Every recursive function IS a recurrence relation:

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

```
T(1) = 1
T(n) = T(n-1) + O(1)

This tells us factorial is O(n).
```

## Solving Recurrences: Repeated Substitution (Unrolling)

Expand the recurrence until you see the pattern.

```
T(n) = T(n-1) + c          (c is a constant)
     = [T(n-2) + c] + c
     = T(n-2) + 2c
     = [T(n-3) + c] + 2c
     = T(n-3) + 3c
     ...
     = T(n-k) + kc

When k = n-1: T(1) + (n-1)c = O(n)
```

## The Towers of Hanoi

```
Move n disks from peg A to peg C using peg B.
Rules: only move one disk at a time, never place larger on smaller.

    |           |           |
   -+-          |           |
  --+--         |           |
 ---+---        |           |
====A=======  ==B=======  ==C=======

T(1) = 1
T(n) = 2 * T(n-1) + 1

Unroll:
T(n) = 2T(n-1) + 1
     = 2[2T(n-2) + 1] + 1 = 4T(n-2) + 3
     = 4[2T(n-3) + 1] + 3 = 8T(n-3) + 7
     ...
     = 2^k * T(n-k) + (2^k - 1)

When k = n-1:
T(n) = 2^(n-1) * T(1) + 2^(n-1) - 1
     = 2^(n-1) + 2^(n-1) - 1
     = 2^n - 1
```

## Solving Linear Recurrences: Characteristic Equation

For recurrences like `a(n) = c1*a(n-1) + c2*a(n-2)`:

```
Step 1: Write the characteristic equation
        x^2 = c1*x + c2
        x^2 - c1*x - c2 = 0

Step 2: Find roots r1, r2

Step 3: General solution
        If r1 != r2:  a(n) = A*r1^n + B*r2^n
        If r1 == r2:  a(n) = A*r1^n + B*n*r1^n

Step 4: Use base cases to find A and B
```

### Solving Fibonacci

```
F(n) = F(n-1) + F(n-2)

Characteristic: x^2 = x + 1  ->  x^2 - x - 1 = 0

Roots: r1 = (1 + sqrt(5))/2    (golden ratio, approx 1.618)
       r2 = (1 - sqrt(5))/2    (approx -0.618)

General: F(n) = A * r1^n + B * r2^n

Using F(0) = 0, F(1) = 1:
  A + B = 0       ->  B = -A
  A*r1 + B*r2 = 1 ->  A(r1 - r2) = 1  ->  A = 1/sqrt(5)

F(n) = (1/sqrt(5)) * [((1+sqrt(5))/2)^n - ((1-sqrt(5))/2)^n]
```

This is Binet's formula. The n-th Fibonacci number from a closed-form expression.

## Divide and Conquer Recurrences

Many algorithms split problems in half:

```
Merge Sort:   T(n) = 2T(n/2) + O(n)
Binary Search: T(n) = T(n/2) + O(1)
Strassen:      T(n) = 7T(n/2) + O(n^2)

General form: T(n) = a * T(n/b) + O(n^d)

  a = number of subproblems
  b = factor by which input shrinks
  d = exponent of work done outside recursion
```

## The Master Theorem

For T(n) = a * T(n/b) + O(n^d):

```
Compare log_b(a) with d:

+--------------------------+---------------------------+
| Condition                | Result                    |
+--------------------------+---------------------------+
| log_b(a) < d             | T(n) = O(n^d)            |
| log_b(a) = d             | T(n) = O(n^d * log n)    |
| log_b(a) > d             | T(n) = O(n^(log_b(a)))   |
+--------------------------+---------------------------+
```

### Examples

```
Merge Sort: a=2, b=2, d=1
  log_2(2) = 1 = d
  T(n) = O(n log n)  <-- Case 2

Binary Search: a=1, b=2, d=0
  log_2(1) = 0 = d
  T(n) = O(log n)  <-- Case 2

Strassen: a=7, b=2, d=2
  log_2(7) = 2.807 > 2 = d
  T(n) = O(n^2.807)  <-- Case 3

Karatsuba multiplication: a=3, b=2, d=1
  log_2(3) = 1.585 > 1 = d
  T(n) = O(n^1.585)  <-- Case 3
```

## Recursion Tree Method

Visualize the work at each level:

```
T(n) = 2T(n/2) + n     (Merge Sort)

Level 0:              n                    work: n
                    /   \
Level 1:         n/2     n/2               work: n
                / \     / \
Level 2:     n/4  n/4 n/4  n/4            work: n
              ...                          ...
Level k:     1 1 1 1 1 1 1 1 ... (n leaves) work: n

Height: log_2(n)
Total work: n * log_2(n) = O(n log n)
```

## Python: Analyzing Recurrences

```python
import math

def master_theorem(a, b, d):
    log_b_a = math.log(a) / math.log(b)
    if abs(log_b_a - d) < 1e-9:
        return f"O(n^{d} * log n)"
    elif log_b_a < d:
        return f"O(n^{d})"
    else:
        return f"O(n^{log_b_a:.3f})"

print("Merge Sort:", master_theorem(2, 2, 1))
print("Binary Search:", master_theorem(1, 2, 0))
print("Strassen:", master_theorem(7, 2, 2))

def solve_recurrence_table(f, base_cases, n):
    table = list(base_cases)
    while len(table) <= n:
        table.append(f(table))
    return table

fib = solve_recurrence_table(
    lambda t: t[-1] + t[-2],
    [0, 1],
    20
)
print("Fibonacci:", fib)
```

## Common Recurrences Cheat Sheet

```
+---------------------------+------------------+-------------------+
| Recurrence                | Solution         | Example           |
+---------------------------+------------------+-------------------+
| T(n) = T(n-1) + c        | O(n)             | Linear search     |
| T(n) = T(n-1) + n        | O(n^2)           | Selection sort    |
| T(n) = 2T(n-1)           | O(2^n)           | Towers of Hanoi   |
| T(n) = T(n/2) + c        | O(log n)         | Binary search     |
| T(n) = 2T(n/2) + n       | O(n log n)       | Merge sort        |
| T(n) = 2T(n/2) + c       | O(n)             | Tree traversal    |
| T(n) = T(n-1) + T(n-2)   | O(1.618^n)       | Naive Fibonacci   |
+---------------------------+------------------+-------------------+
```

## Exercises

1. Solve by unrolling: T(n) = T(n-1) + 2n, T(1) = 1

2. Find the closed form for: a(n) = 5a(n-1) - 6a(n-2), a(0) = 1, a(1) = 4
   (Hint: characteristic equation x^2 - 5x + 6 = 0)

3. Use the Master Theorem to classify:
   a) T(n) = 4T(n/2) + n
   b) T(n) = 4T(n/2) + n^2
   c) T(n) = 4T(n/2) + n^3

4. Draw the recursion tree for T(n) = 3T(n/3) + n and determine the complexity.

5. **Python challenge:** Write a memoized Fibonacci function and measure how many
   recursive calls it saves compared to the naive version for n = 30.

---

[Next: Lesson 07 — Graph Theory](07-graph-theory.md)
