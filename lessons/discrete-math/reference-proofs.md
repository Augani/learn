# Reference — Common Proof Patterns

> Templates for the most common proof structures.
> Fill in the blanks for your specific problem.

## Template 1: Direct Proof

```
Claim: If [HYPOTHESIS], then [CONCLUSION].

Proof:
  Assume [HYPOTHESIS].
  [Use definitions to rewrite hypothesis formally]
  [Chain of logical/algebraic steps]
  ...
  Therefore [CONCLUSION].  QED
```

### Worked Example

```
Claim: If n is odd, then n^2 is odd.

Proof:
  Assume n is odd.
  By definition, n = 2k + 1 for some integer k.
  Then n^2 = (2k + 1)^2 = 4k^2 + 4k + 1 = 2(2k^2 + 2k) + 1.
  Let m = 2k^2 + 2k. Then n^2 = 2m + 1, which is odd.
  Therefore n^2 is odd.  QED
```

## Template 2: Proof by Contrapositive

```
Claim: If [P], then [Q].

Proof (by contrapositive):
  We prove: If [NOT Q], then [NOT P].
  Assume [NOT Q].
  [Chain of steps]
  Therefore [NOT P].
  Since the contrapositive is equivalent, if [P] then [Q].  QED
```

### Worked Example

```
Claim: If n^2 is even, then n is even.

Proof (by contrapositive):
  We prove: If n is NOT even (odd), then n^2 is NOT even (odd).
  Assume n is odd. Then n = 2k + 1 for some integer k.
  n^2 = (2k+1)^2 = 4k^2 + 4k + 1 = 2(2k^2 + 2k) + 1, which is odd.
  Therefore n^2 is odd.
  By contrapositive, if n^2 is even, then n is even.  QED
```

## Template 3: Proof by Contradiction

```
Claim: [STATEMENT].

Proof (by contradiction):
  Assume, for the sake of contradiction, that [NEGATION OF STATEMENT].
  [Chain of logical steps]
  This leads to [CONTRADICTION with known fact/assumption].
  Therefore our assumption was wrong, and [STATEMENT] is true.  QED
```

### Worked Example

```
Claim: There is no largest prime number.

Proof (by contradiction):
  Assume there are finitely many primes: p1, p2, ..., pk.
  Let N = p1 * p2 * ... * pk + 1.
  For each pi, N mod pi = 1 (since pi divides the product, and we add 1).
  So N is not divisible by any pi.
  But N > 1, so by the fundamental theorem, N has a prime factor.
  This prime factor is not in our list.
  This contradicts our assumption that the list contains ALL primes.
  Therefore there are infinitely many primes.  QED
```

## Template 4: Proof by Mathematical Induction

```
Claim: For all n >= [BASE], [PROPERTY P(n)].

Proof (by induction on n):

  Base case: n = [BASE].
    [Show P(BASE) is true directly.]

  Inductive step:
    Inductive hypothesis: Assume P(k) holds for some arbitrary k >= [BASE].
    Goal: Show P(k + 1) holds.

    [Start with P(k+1) expression]
    [Use the inductive hypothesis to substitute/simplify]
    [Arrive at the P(k+1) conclusion]

  By induction, P(n) holds for all n >= [BASE].  QED
```

### Worked Example

```
Claim: For all n >= 1, SUM(i=1 to n) of i^2 = n(n+1)(2n+1)/6.

Proof (by induction on n):

  Base case: n = 1.
    Left: 1^2 = 1.
    Right: 1(2)(3)/6 = 1.
    Base case holds.

  Inductive step:
    Assume SUM(i=1 to k) of i^2 = k(k+1)(2k+1)/6 for some k >= 1.

    SUM(i=1 to k+1) of i^2
    = [SUM(i=1 to k) of i^2] + (k+1)^2
    = k(k+1)(2k+1)/6 + (k+1)^2              [by inductive hypothesis]
    = (k+1)[k(2k+1)/6 + (k+1)]              [factor out (k+1)]
    = (k+1)[k(2k+1) + 6(k+1)] / 6
    = (k+1)[2k^2 + k + 6k + 6] / 6
    = (k+1)[2k^2 + 7k + 6] / 6
    = (k+1)(k+2)(2k+3) / 6
    = (k+1)((k+1)+1)(2(k+1)+1) / 6

    This is the formula with n = k+1.

  By induction, the claim holds for all n >= 1.  QED
```

## Template 5: Strong Induction

```
Claim: For all n >= [BASE], [PROPERTY P(n)].

Proof (by strong induction on n):

  Base case(s): [May need multiple base cases]
    Show P(BASE), P(BASE+1), ..., P(BASE+j) directly.

  Inductive step:
    Assume P(i) holds for ALL i where BASE <= i <= k.
    Goal: Show P(k + 1) holds.

    [Use ANY of P(BASE), ..., P(k) as needed]

  By strong induction, P(n) holds for all n >= [BASE].  QED
```

## Template 6: Proof by Cases

```
Claim: [STATEMENT].

Proof (by cases):
  [Note: Cases must be exhaustive — cover all possibilities]

  Case 1: [CONDITION 1].
    [Prove statement under this condition.]

  Case 2: [CONDITION 2].
    [Prove statement under this condition.]

  ...

  Case k: [CONDITION k].
    [Prove statement under this condition.]

  Since cases are exhaustive, [STATEMENT] holds.  QED
```

## Template 7: Existence Proof (Constructive)

```
Claim: There exists [OBJECT] with [PROPERTY].

Proof:
  Consider [SPECIFIC OBJECT].
  [Verify it has the required property]
  Therefore such an object exists.  QED
```

## Template 8: Existence Proof (Non-constructive)

```
Claim: There exists [OBJECT] with [PROPERTY].

Proof:
  Assume no such object exists.
  [Derive contradiction]
  Therefore such an object must exist.  QED
```

## Template 9: Uniqueness Proof

```
Claim: There exists a UNIQUE [OBJECT] with [PROPERTY].

Proof:
  Existence: [Show at least one such object exists]

  Uniqueness: Suppose x and y both have [PROPERTY].
  [Show x = y]
  Therefore the object is unique.  QED
```

## Template 10: Disproof by Counterexample

```
Claim: [UNIVERSAL STATEMENT] is FALSE.

Disproof:
  Consider [SPECIFIC COUNTEREXAMPLE].
  [Show it violates the claim]
  Therefore the claim is false.  QED
```

### Worked Example

```
Claim: "All primes are odd" is FALSE.

Disproof:
  Consider 2. It is prime (divisible only by 1 and itself).
  But 2 is even.
  Therefore not all primes are odd.  QED
```

## Template 11: Pigeonhole Principle

```
Claim: [In some scenario, at least two items share a property].

Proof:
  There are [N] items and [K] possible properties/categories.
  Since N > K, by the pigeonhole principle,
  at least two items share the same property.  QED
```

## Common Pitfalls

```
+----------------------------------+------------------------------------------+
| Pitfall                          | How to Avoid                             |
+----------------------------------+------------------------------------------+
| Assuming what you need to prove  | Clearly separate hypothesis from goal    |
| Circular reasoning               | Never use the conclusion as a step       |
| Forgetting base case in induction| Always verify base case explicitly        |
| Wrong direction of implication   | P -> Q is NOT Q -> P                     |
| Confusing "for all" and "exists" | ALL needs to work for every case;        |
|                                  | EXISTS only needs one                    |
| Proof by example                 | One example doesn't prove a universal    |
|                                  | (but one counterexample disproves it)    |
| Dividing by zero                 | Always check denominators                |
| Assuming integer when not stated | State the domain explicitly              |
+----------------------------------+------------------------------------------+
```

## Proof Strategy Decision Tree

```
What are you trying to prove?
  |
  +-- "If P then Q"
  |     |
  |     +-- Can you chain P to Q directly? --> Direct Proof
  |     +-- Is ~Q easier to work with?     --> Contrapositive
  |     +-- Neither works?                 --> Contradiction
  |
  +-- "For all n >= k, P(n)"
  |     |
  |     +-- P(k+1) only needs P(k)?       --> Induction
  |     +-- P(k+1) needs P(j) for j < k?  --> Strong Induction
  |
  +-- "There exists x with P(x)"
  |     |
  |     +-- Can you build one?             --> Constructive
  |     +-- Assume none exists?            --> Non-constructive
  |
  +-- "At least 2 share a property"        --> Pigeonhole
  |
  +-- Claim is FALSE                       --> Counterexample
  |
  +-- Natural split into subcases          --> Proof by Cases
```
