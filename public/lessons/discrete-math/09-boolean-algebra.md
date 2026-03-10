# Lesson 09 — Boolean Algebra

> **Analogy:** Circuit design. Every chip in your computer is built from logic gates
> that implement boolean algebra. When hardware engineers minimize circuits,
> they're simplifying boolean expressions.

## Boolean Algebra Axioms

A boolean algebra is a set {0, 1} with operations AND, OR, NOT satisfying:

```
Identity:      x + 0 = x         x * 1 = x
Domination:    x + 1 = 1         x * 0 = 0
Idempotent:    x + x = x         x * x = x
Complement:    x + x' = 1        x * x' = 0
Commutative:   x + y = y + x     x * y = y * x
Associative:   (x+y)+z = x+(y+z) (x*y)*z = x*(y*z)
Distributive:  x*(y+z) = xy+xz   x+(y*z) = (x+y)*(x+z)
De Morgan's:   (x+y)' = x'*y'    (x*y)' = x'+y'
Double neg:    (x')' = x
```

Notation: `+` is OR, `*` is AND, `'` is NOT (complement).

## Logic Gates

Every boolean function maps to physical hardware:

```
AND gate:        OR gate:         NOT gate:
  A ---\           A ---\           A ---[>o]--- out
       |---out          |---out
  B ---/           B ---/

  A  B  out        A  B  out       A  out
  0  0   0         0  0   0        0   1
  0  1   0         0  1   1        1   0
  1  0   0         1  0   1
  1  1   1         1  1   1

NAND gate:       XOR gate:        XNOR gate:
  A ---\           A ---\           A ---\
       |o--out         |=1--out         |=1-o--out
  B ---/           B ---/           B ---/

  A  B  out        A  B  out       A  B  out
  0  0   1         0  0   0        0  0   1
  0  1   1         0  1   1        0  1   0
  1  0   1         1  0   1        1  0   0
  1  1   0         1  1   0        1  1   1
```

**NAND is universal** — you can build ANY gate from just NAND gates:

```
NOT from NAND:   A --+
                     |--- out = (A NAND A) = A'
                 A --+

AND from NAND:   A ---\                   \
                      |o--+---+            |o--- out
                 B ---/   +---+           /
                          NAND with itself

OR from NAND:    A --+--+
                     +--+\
                          |o--- out
                 B --+--+/
                     +--+
```

## Canonical Forms

Any boolean function can be written in two standard forms.

### Sum of Products (SOP) — Disjunctive Normal Form

OR of AND terms. Each AND term (minterm) makes the function 1.

```
f(A, B, C) from truth table:
  A  B  C  | f
  0  0  0  | 0
  0  0  1  | 1  ->  A'B'C
  0  1  0  | 0
  0  1  1  | 1  ->  A'BC
  1  0  0  | 1  ->  AB'C'
  1  0  1  | 0
  1  1  0  | 1  ->  ABC'
  1  1  1  | 0

SOP: f = A'B'C + A'BC + AB'C' + ABC'
```

### Product of Sums (POS) — Conjunctive Normal Form

AND of OR terms. Each OR term (maxterm) makes the function 0.

```
From rows where f = 0:
  f = (A+B+C)(A+B'+C)(A'+B+C')(A'+B'+C')
```

## Simplification with Boolean Algebra

```
f = A'B'C + A'BC + AB'C' + ABC'

Group:
  = A'C(B'+B) + AC'(B'+B)     (factor)
  = A'C(1) + AC'(1)           (complement law)
  = A'C + AC'                 (identity)
  = A XOR C                   (definition of XOR)
```

## Karnaugh Maps — Visual Simplification

A K-map arranges truth table entries so adjacent cells differ by one variable.
Group adjacent 1s in powers of 2 to find simplified expressions.

### 2-Variable K-map

```
         B=0   B=1
A=0  [  m0  |  m1  ]
A=1  [  m2  |  m3  ]
```

### 3-Variable K-map

```
          BC
         00   01   11   10
A=0  [  m0 | m1 | m3 | m2  ]
A=1  [  m4 | m5 | m7 | m6  ]

Note: columns are in Gray code order (00, 01, 11, 10)
so adjacent cells differ by exactly 1 bit.
```

### Example: Simplify f(A,B,C) = SUM(1,3,4,6)

```
          BC
         00   01   11   10
A=0  [  0  |  1  |  1  |  0  ]
A=1  [  1  |  0  |  0  |  1  ]

Group the 1s:
  - m1, m3 (top row, BC=01 and BC=11): A'C (B changes, doesn't matter)
  - m4, m6 (bottom row, BC=00 and BC=10): AC' (B changes, doesn't matter)

f = A'C + AC' = A XOR C
```

### 4-Variable K-map

```
            CD
           00   01   11   10
AB=00  [      |     |     |     ]
AB=01  [      |     |     |     ]
AB=11  [      |     |     |     ]
AB=10  [      |     |     |     ]

Grouping rules:
  - Groups must be rectangular, sizes 1, 2, 4, 8, 16
  - Wrapping allowed (top-bottom, left-right)
  - Bigger groups = simpler terms
  - Every 1 must be covered, but groups can overlap
```

### Example: 4 Variables

```
            CD
           00   01   11   10
AB=00  [  0  |  1  |  1  |  0  ]
AB=01  [  0  |  1  |  1  |  0  ]
AB=11  [  0  |  1  |  1  |  0  ]
AB=10  [  0  |  1  |  1  |  0  ]

All four CD=01 and CD=11 columns are 1.
This is a group of 8 (all rows, 2 columns).
The variable that's 1 in both: D=1 in both 01 and 11.
Wait -- look at it differently: C varies, D=1 in 01; C=1,D=1 in 11.
Actually the common factor is just D.

f = D

(The entire column where D=1 is marked.)
```

## Don't-Care Conditions

Sometimes certain inputs can never occur. Mark them as `X` (don't care).
You can treat X as 0 or 1, whichever gives simpler grouping.

```
            CD
           00   01   11   10
AB=00  [  1  |  X  |  0  |  1  ]
AB=01  [  1  |  0  |  0  |  1  ]
AB=11  [  X  |  0  |  0  |  X  ]
AB=10  [  1  |  X  |  0  |  1  ]

Treat the Xs as 1 where it helps grouping.
```

## Python: Boolean Simplification

```python
from itertools import product

def minterms_from_function(f, n_vars):
    result = []
    for values in product([0, 1], repeat=n_vars):
        if f(*values):
            result.append(values)
    return result

def f(a, b, c):
    return (not a and c) or (a and not c)

for minterm in minterms_from_function(f, 3):
    print(minterm)
```

## Half Adder and Full Adder

Building arithmetic from boolean algebra:

```
Half Adder (adds 2 bits):
  Sum   = A XOR B
  Carry = A AND B

  A  B  | Sum  Carry
  0  0  |  0    0
  0  1  |  1    0
  1  0  |  1    0
  1  1  |  0    1

Full Adder (adds 3 bits: A, B, Carry_in):
  Sum   = A XOR B XOR Cin
  Cout  = (A AND B) OR (Cin AND (A XOR B))
```

## Exercises

1. Simplify using boolean algebra: f = AB + AB' + A'B

2. Create a K-map and simplify: f(A,B,C) = SUM(0, 2, 4, 5, 6)

3. Build a 4-variable K-map for f(A,B,C,D) = SUM(0,1,2,5,8,9,10) and simplify.

4. Show that NAND is functionally complete by building AND, OR, and NOT from it.

5. **Python challenge:** Write a function that takes a truth table (list of 0s and 1s)
   for 3 variables and outputs the SOP expression as a string.

6. Design a circuit using only NAND gates that implements XOR.

---

[Next: Lesson 10 — Modular Arithmetic](10-modular-arithmetic.md)
