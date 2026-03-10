# Lesson 05 — Counting

> **Analogy:** You have 10 books and a shelf that holds 4.
> How many ways can you arrange them? That depends on whether order matters
> and whether you put them back after choosing.

## Why Counting Matters

Algorithm analysis boils down to counting: how many operations, how many paths,
how many possible states. Combinatorics gives you the tools.

## The Fundamental Counting Principles

### Multiplication Principle (AND)

If task A has m ways and task B has n ways, doing A AND B has m * n ways.

```
Shirts: 4 choices
Pants:  3 choices
Outfits: 4 * 3 = 12

  S1-P1  S1-P2  S1-P3
  S2-P1  S2-P2  S2-P3
  S3-P1  S3-P2  S3-P3
  S4-P1  S4-P2  S4-P3
```

### Addition Principle (OR)

If task A has m ways and task B has n ways (mutually exclusive),
doing A OR B has m + n ways.

```
Travel by bus: 3 routes
Travel by train: 2 routes
Total ways to travel: 3 + 2 = 5
```

### Inclusion-Exclusion

When choices overlap:

```
|A U B| = |A| + |B| - |A n B|

Students taking Math: 30
Students taking CS: 25
Students taking BOTH: 10

Taking Math OR CS: 30 + 25 - 10 = 45
```

```
  +-------+-----+-------+
  |       |/////|       |
  |  20   | 10  |  15   |
  | Math  |both | CS    |
  | only  |     | only  |
  +-------+-----+-------+
```

## Permutations — Order Matters

A permutation is an ordered arrangement.

### All Items

How many ways to arrange n distinct items?

```
n! = n * (n-1) * (n-2) * ... * 1

3 books: ABC, ACB, BAC, BCA, CAB, CBA = 3! = 6 ways

0! = 1 (by convention — there's exactly one way to arrange nothing)
```

### k Items from n (Partial Permutation)

Choose and arrange k items from n:

```
P(n, k) = n! / (n-k)!

Choose 2 from {A, B, C}:
P(3, 2) = 3! / 1! = 6
AB, AC, BA, BC, CA, CB
```

Think: n choices for first slot, (n-1) for second, ..., (n-k+1) for kth.

## Combinations — Order Doesn't Matter

A combination is a selection where order is irrelevant.

```
C(n, k) = n! / (k! * (n-k)!)

Also written as "n choose k."

Choose 2 from {A, B, C}:
C(3, 2) = 3! / (2! * 1!) = 3
{A,B}, {A,C}, {B,C}

We divided out the 2! orderings within each group.
```

```
Permutations of 2 from {A,B,C}:    Combinations of 2 from {A,B,C}:
AB  BA  <-- same combination        {A,B}
AC  CA  <-- same combination        {A,C}
BC  CB  <-- same combination        {B,C}
 6 arrangements                      3 selections
```

### The Relationship

```
P(n, k) = C(n, k) * k!

Permutations = Combinations * (orderings within each selection)
```

## Binomial Coefficients

C(n, k) is also called a binomial coefficient because:

```
(x + y)^n = SUM over k from 0 to n of C(n,k) * x^(n-k) * y^k

(x + y)^3 = x^3 + 3x^2y + 3xy^2 + y^3
             C(3,0) C(3,1)  C(3,2) C(3,3)
```

### Pascal's Triangle

Each entry is the sum of the two above it:

```
              1                   C(0,0)
            1   1                 C(1,0) C(1,1)
          1   2   1               C(2,0) C(2,1) C(2,2)
        1   3   3   1             C(3,0) ...
      1   4   6   4   1          C(4,0) ...
    1   5  10  10   5   1        C(5,0) ...
```

**Pascal's identity:** C(n, k) = C(n-1, k-1) + C(n-1, k)

## Combinations with Repetition (Stars and Bars)

Distributing k identical items into n distinct bins:

```
C(n + k - 1, k)

How many ways to put 5 identical balls into 3 boxes?
C(3 + 5 - 1, 5) = C(7, 5) = 21

Visualized as stars and bars:
**|*|**    -> 2 in box 1, 1 in box 2, 2 in box 3
***||**    -> 3 in box 1, 0 in box 2, 2 in box 3
|****|*    -> 0 in box 1, 4 in box 2, 1 in box 3
```

Arrange 5 stars and 2 bars (n-1 bars) in a line: C(7, 2) = 21.

## Python Counting Tools

```python
from math import factorial, comb, perm

def P(n, k):
    return perm(n, k)

def C(n, k):
    return comb(n, k)

print(f"P(10, 3) = {P(10, 3)}")
print(f"C(10, 3) = {C(10, 3)}")

def pascals_triangle(rows):
    for n in range(rows):
        row = [comb(n, k) for k in range(n + 1)]
        padding = " " * (rows - n)
        print(padding + " ".join(f"{x:3}" for x in row))

pascals_triangle(8)
```

## Common Counting Patterns

```
+-----------------------------------+--------------------+
| Problem Type                      | Formula            |
+-----------------------------------+--------------------+
| Arrange all n items               | n!                 |
| Choose k from n, order matters    | P(n,k) = n!/(n-k)!|
| Choose k from n, order no matter  | C(n,k) = n!/(k!(n-k)!)|
| Distribute k same into n diff     | C(n+k-1, k)       |
| Binary strings of length n        | 2^n                |
| Subsets of n-element set          | 2^n                |
+-----------------------------------+--------------------+
```

## The Subtraction Principle

Sometimes it's easier to count what you DON'T want.

```
Valid passwords = Total passwords - Invalid passwords

8-char passwords using a-z, A-Z, 0-9 with at least one digit:
Total: 62^8
No digits: 52^8
With at least one digit: 62^8 - 52^8
```

## Exercises

1. A license plate has 3 letters followed by 4 digits.
   How many possible plates are there?

2. How many 5-card poker hands can be dealt from a 52-card deck?

3. In how many ways can 8 people sit around a circular table?
   (Hint: rotations are the same arrangement.)

4. Use inclusion-exclusion: how many integers from 1 to 100 are divisible
   by 3 OR by 5?

5. **Stars and bars:** In how many ways can you distribute 10 identical cookies
   among 4 children if each child must get at least 1?
   (Hint: give each child 1 first, then distribute 6 remaining.)

6. **Python challenge:** Write a function that generates all C(n, k) combinations
   without using itertools.

---

[Next: Lesson 06 — Recurrence Relations](06-recurrence-relations.md)
