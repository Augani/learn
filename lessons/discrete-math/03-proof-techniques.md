# Lesson 03 — Proof Techniques

> **Analogy:** A proof is like a detective building a case.
> You have evidence (axioms, definitions), you chain logical steps,
> and you reach an airtight conclusion no jury can dispute.

## Why Proofs?

In programming, you test. In math, you PROVE. A test checks some cases.
A proof covers ALL cases — infinite inputs, zero exceptions.

When you prove an algorithm correct, you're not hoping it works. You KNOW.

## Direct Proof

The most straightforward approach. Assume the hypothesis, derive the conclusion.

```
Claim: If n is even, then n^2 is even.

Proof:
  1. Assume n is even.               [Start from hypothesis]
  2. Then n = 2k for some integer k.  [Definition of even]
  3. n^2 = (2k)^2 = 4k^2 = 2(2k^2). [Algebra]
  4. Let m = 2k^2. Then n^2 = 2m.    [Substitution]
  5. Therefore n^2 is even.           [Definition of even]  QED
```

**Template:**

```
Claim: If P then Q.
Proof:
  Assume P.
  ... chain of logical steps ...
  Therefore Q.  QED
```

## Proof by Contrapositive

Instead of proving `P -> Q`, prove `~Q -> ~P`. They're equivalent (Lesson 01).

```
Claim: If n^2 is odd, then n is odd.

Proof (by contrapositive):
  We prove: if n is NOT odd (even), then n^2 is NOT odd (even).
  1. Assume n is even.
  2. Then n = 2k for some integer k.
  3. n^2 = 4k^2 = 2(2k^2), which is even.
  Therefore, if n^2 is odd, n must be odd.  QED
```

**When to use:** When the conclusion is hard to work with directly,
but its negation gives you something concrete.

## Proof by Contradiction

Assume the OPPOSITE of what you want to prove. Show it leads to absurdity.

```
Claim: sqrt(2) is irrational.

Proof (by contradiction):
  1. Assume sqrt(2) IS rational.
  2. Then sqrt(2) = a/b where a,b are integers with no common factors.
  3. Squaring: 2 = a^2/b^2, so a^2 = 2b^2.
  4. a^2 is even, so a is even (proved above). Write a = 2c.
  5. (2c)^2 = 2b^2, so 4c^2 = 2b^2, so b^2 = 2c^2.
  6. b^2 is even, so b is even.
  7. Both a and b are even — they share factor 2.
  8. CONTRADICTION with step 2 (no common factors).
  Therefore sqrt(2) is irrational.  QED
```

```
  Your claim:  X is true
                  |
  Assume:      X is false
                  |
           Chain of logic...
                  |
              BOOM! Contradiction
                  |
  Therefore:   X must be true
```

## Proof by Induction

The domino effect. Prove the first case, then prove each case triggers the next.

```
  Base Case           Inductive Step
     |                     |
  Prove P(0)    +    If P(k) then P(k+1)
     |                     |
     v                     v
  P(0) -> P(1) -> P(2) -> P(3) -> ...

  Like dominoes:
  [0]-->[1]-->[2]-->[3]-->[4]--> ...
   ^     fall  fall  fall  fall
   |
  push this one
```

**Example:**

```
Claim: 1 + 2 + 3 + ... + n = n(n+1)/2

Base case (n = 1):
  Left side: 1
  Right side: 1(2)/2 = 1
  They match. Base case holds.

Inductive step:
  Assume true for n = k:  1 + 2 + ... + k = k(k+1)/2
  Prove for n = k + 1:

  1 + 2 + ... + k + (k+1)
  = k(k+1)/2 + (k+1)          [by inductive hypothesis]
  = k(k+1)/2 + 2(k+1)/2       [common denominator]
  = (k+1)(k+2)/2               [factor out (k+1)]
  = (k+1)((k+1)+1)/2           [this is the formula with n = k+1]

  QED
```

**Python verification:**

```python
def sum_formula(n):
    return n * (n + 1) // 2

def sum_direct(n):
    return sum(range(1, n + 1))

for n in range(1, 1000):
    assert sum_formula(n) == sum_direct(n)
```

## Strong Induction

Regular induction: assume P(k), prove P(k+1).
Strong induction: assume P(1), P(2), ..., P(k), prove P(k+1).

You get to use ALL previous cases, not just the last one.

```
Claim: Every integer n >= 2 can be written as a product of primes.

Base case (n = 2):
  2 is prime. It's a product of one prime.

Inductive step:
  Assume every integer from 2 to k can be written as a product of primes.
  Consider k + 1:
    Case 1: k+1 is prime. Done — product of one prime.
    Case 2: k+1 is composite. Then k+1 = a * b where 2 <= a, b <= k.
            By the inductive hypothesis, a and b are products of primes.
            So k+1 = a * b is also a product of primes.
  QED
```

## The Pigeonhole Principle

If you stuff n+1 pigeons into n holes, at least one hole has 2+ pigeons.

```
  n = 3 holes, 4 pigeons:

  +---+  +---+  +---+
  | @ |  | @ |  | @ |
  | @ |  |   |  |   |
  +---+  +---+  +---+

  At least one box MUST have 2+. Guaranteed.
```

**Example:**

```
Claim: In any group of 13 people, at least 2 share a birth month.

Proof:
  There are 12 months (holes) and 13 people (pigeons).
  By the pigeonhole principle, at least 2 people share a month.  QED
```

**Generalized pigeonhole principle:**
If n items go into k bins, at least one bin has ceil(n/k) items.

```python
import math

def pigeonhole_min(items, bins):
    return math.ceil(items / bins)

print(pigeonhole_min(13, 12))
```

## Proof by Cases (Exhaustion)

Split into cases that cover all possibilities. Prove each one.

```
Claim: For any integer n, n^2 + n is even.

Proof by cases:
  Case 1: n is even.
    n = 2k, so n^2 + n = 4k^2 + 2k = 2(2k^2 + k). Even.

  Case 2: n is odd.
    n = 2k+1, so n^2 + n = (2k+1)^2 + (2k+1) = 4k^2 + 4k + 1 + 2k + 1
    = 4k^2 + 6k + 2 = 2(2k^2 + 3k + 1). Even.

  Both cases give even result.  QED
```

## Choosing Your Technique

```
+---------------------------+----------------------------------+
| Technique                 | When to Use                      |
+---------------------------+----------------------------------+
| Direct proof              | Conclusion follows naturally     |
| Contrapositive            | Negation of conclusion is easier |
| Contradiction             | Hard to prove directly           |
| Induction                 | Statement about all n >= base    |
| Strong induction          | Need more than just P(k)        |
| Pigeonhole                | "At least two share..."          |
| Cases                     | Natural split into subcases      |
+---------------------------+----------------------------------+
```

## Exercises

1. **Direct proof:** Prove that the sum of two odd numbers is even.

2. **Contrapositive:** Prove that if n^2 is divisible by 3, then n is divisible by 3.

3. **Contradiction:** Prove that there are infinitely many prime numbers.
   (Hint: assume finitely many, multiply them all, add 1.)

4. **Induction:** Prove that 2^n > n for all n >= 1.

5. **Pigeonhole:** Prove that in any set of 6 integers, at least two have the same
   remainder when divided by 5.

6. **Challenge:** Prove by strong induction that every amount of postage >= 12 cents
   can be made using 4-cent and 5-cent stamps.

---

[Next: Lesson 04 — Sets and Functions](04-sets-and-functions.md)
