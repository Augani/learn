# Lesson 04 — Sets and Functions

> **Analogy:** Think of lockers at a school. A set is a collection of lockers.
> A function maps each student to exactly one locker. Can two students share a locker?
> Can a locker be empty? These questions define injection, surjection, bijection.

## Sets — Collections Without Duplicates

A set is an unordered collection of distinct elements. Like Python's `set`.

```
A = {1, 2, 3}
B = {3, 2, 1}         A = B (order doesn't matter)
C = {1, 1, 2, 3}      C = {1, 2, 3} (no duplicates)
```

### Special Sets

```
N  = {0, 1, 2, 3, ...}    Natural numbers
Z  = {..., -2, -1, 0, 1, 2, ...}   Integers
Q  = Rationals (fractions)
R  = Real numbers
{}  = Empty set (also written as the "null set" symbol)
```

### Set-Builder Notation

```
{ x in Z | x > 0 }  =  {1, 2, 3, ...}  "All integers greater than 0"

Python equivalent:
{x for x in range(-100, 100) if x > 0}
```

## Set Operations

```
Union:         A U B  =  {x | x in A OR x in B}
Intersection:  A n B  =  {x | x in A AND x in B}
Difference:    A - B  =  {x | x in A AND x NOT in B}
Complement:    ~A     =  {x in U | x NOT in A}    (U = universal set)
```

### Venn Diagrams (ASCII Style)

```
A U B (Union):            A n B (Intersection):
+-------+-------+         +-------+-------+
|///////|///////|         |       |///////|
|///A///||///B///|         |   A   ||  B   |
|///////|///////|         |       |///////|
+-------+-------+         +-------+-------+
  Everything shaded          Only overlap shaded

A - B (Difference):       A XOR B (Symmetric Diff):
+-------+-------+         +-------+-------+
|///////|       |         |///////|       |///////|
|///A///||   B  |         |///A///||      ||///B///|
|///////|       |         |///////|       |///////|
+-------+-------+         +-------+-------+
  A only, no overlap        Everything EXCEPT overlap
```

### Python Sets

```python
A = {1, 2, 3, 4, 5}
B = {4, 5, 6, 7, 8}

union = A | B
intersection = A & B
difference = A - B
symmetric_diff = A ^ B
is_subset = A <= B
```

## Set Identities

```
Commutative:   A U B = B U A          A n B = B n A
Associative:   (A U B) U C = A U (B U C)
Distributive:  A n (B U C) = (A n B) U (A n C)
De Morgan's:   ~(A U B) = ~A n ~B
               ~(A n B) = ~A U ~B
Identity:      A U {} = A             A n U = A
Complement:    A U ~A = U             A n ~A = {}
```

Notice: De Morgan's for sets mirrors De Morgan's for logic (Lesson 01).

## Power Set and Cardinality

**Cardinality** = number of elements. Written |A|.

```
A = {1, 2, 3}
|A| = 3
```

**Power set** = set of ALL subsets:

```
P({1, 2}) = { {}, {1}, {2}, {1,2} }

|P(A)| = 2^|A|

Why? Each element is either IN or OUT of a subset. Binary choice.
n elements -> 2^n subsets.
```

## Cartesian Product

```
A x B = { (a, b) | a in A, b in B }

{1, 2} x {a, b} = { (1,a), (1,b), (2,a), (2,b) }

|A x B| = |A| * |B|
```

Like a SQL `CROSS JOIN`. Every combination of one element from each set.

## Functions — The Mapping

A function f: A -> B assigns EACH element in A to EXACTLY ONE element in B.

```
A = {1, 2, 3}       B = {a, b, c}

f(1) = a
f(2) = b         This IS a function (every input has one output)
f(3) = c

  A         B
+---+     +---+
| 1 |---->| a |
| 2 |---->| b |
| 3 |---->| c |
+---+     +---+
```

```
NOT a function:          NOT a function:
f(1) = a AND f(1) = b   f(1) = a, f(2) = b, f(3) = ???
(one input, two outputs) (f(3) undefined)
```

- **Domain** = A (input set)
- **Codomain** = B (possible outputs)
- **Range** = actual outputs used = {f(x) | x in A}

## Injection, Surjection, Bijection

### Injection (One-to-One)

Different inputs always give different outputs. No sharing lockers.

```
Injective:               NOT injective:
  1 --> a                  1 --> a
  2 --> b                  2 --> a    <-- 1 and 2 map to same output!
  3 --> c                  3 --> b
```

**Test:** f(x1) = f(x2) implies x1 = x2

### Surjection (Onto)

Every element in B is hit by something. No empty lockers.

```
Surjective:              NOT surjective:
  1 --> a                  1 --> a
  2 --> b                  2 --> b
  3 --> b                  3 --> a
  (B = {a, b}, all hit)   (B = {a, b, c}, c never hit)
```

**Test:** For every b in B, there exists a in A with f(a) = b.

### Bijection (Both)

One-to-one AND onto. Perfect pairing. Every student gets exactly one locker,
every locker has exactly one student.

```
Bijective:
  1 --> a
  2 --> b
  3 --> c

  Every element paired exactly once. Invertible!
  f^(-1)(a) = 1, f^(-1)(b) = 2, f^(-1)(c) = 3
```

**Key fact:** A bijection between A and B means |A| = |B|.

```
+--------------------------------------------+
|  INJECTIVE     |  NOT INJECTIVE            |
|  (one-to-one)  |                           |
|================+===========================|
|  SURJECTIVE:   |  SURJECTIVE:              |
|  BIJECTION     |  Some outputs have         |
|  (perfect map) |  multiple inputs           |
|----------------|---------------------------|
|  NOT SURJ:     |  NOT SURJECTIVE:           |
|  Some outputs  |  Some outputs unused AND   |
|  unused        |  some share inputs         |
+--------------------------------------------+
```

## Composition

```
f: A -> B,  g: B -> C
(g o f)(x) = g(f(x))

Like function chaining: pipe(f, g)(x) or g(f(x))
```

## Python Examples

```python
def is_injective(f, domain):
    outputs = [f(x) for x in domain]
    return len(outputs) == len(set(outputs))

def is_surjective(f, domain, codomain):
    outputs = {f(x) for x in domain}
    return codomain.issubset(outputs)

def is_bijective(f, domain, codomain):
    return is_injective(f, domain) and is_surjective(f, domain, codomain)

domain = {1, 2, 3}
codomain = {10, 20, 30}
f = lambda x: x * 10

print(is_bijective(f, domain, codomain))
```

## Exercises

1. Let A = {1,2,3,4} and B = {1,2,3,4,5,6}. Compute A U B, A n B, A - B, B - A.

2. How many elements are in the power set of {a, b, c, d, e}?

3. Define f: Z -> Z by f(x) = 2x + 1.
   Is f injective? Surjective? Bijective? Prove each answer.

4. Find a function f: N -> N that is injective but NOT surjective.

5. Prove: if f: A -> B and g: B -> C are both bijections, then (g o f) is a bijection.

6. **Python challenge:** Write a function that takes a function `f`, a `domain`, and a
   `codomain`, and returns "bijection", "injection only", "surjection only", or "neither".

---

[Next: Lesson 05 — Counting](05-counting.md)
