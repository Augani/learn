# Lesson 01 — Propositional Logic

> **Analogy:** Every `if` statement you've ever written is propositional logic.
> `if logged_in and has_permission` — that's conjunction. You already think in logic.

## What Is a Proposition?

A proposition is a statement that is either **true** or **false**. Not both. Not neither.

```
Proposition:       "7 is prime"           -> True
Proposition:       "The sky is green"     -> False
NOT a proposition: "What time is it?"     -> It's a question
NOT a proposition: "x + 5"               -> Depends on x
```

## The Logical Connectives

Think of these as the operators in your boolean expressions:

```
Symbol  Name          Code Equivalent    English
------  ----          ---------------    -------
  ~     NOT           not p              "it is not the case that"
  ^     AND           p and q            "both ... and ..."
  v     OR            p or q             "either ... or ... (or both)"
  ->    IMPLICATION   if p then q        "if ... then ..."
  <->   BICONDITIONAL p == q             "if and only if"
```

## Truth Tables — The Complete Picture

A truth table lists every possible input and the resulting output.
Just like testing every branch of your code.

### NOT (~p)

```
 p  | ~p
----|----
 T  |  F
 F  |  T
```

### AND (p ^ q)

```
 p  | q  | p ^ q
----|----|-----
 T  | T  |  T
 T  | F  |  F
 F  | T  |  F
 F  | F  |  F
```

Only true when BOTH are true. Like `if has_ticket and has_id: enter()`.

### OR (p v q)

```
 p  | q  | p v q
----|----|-----
 T  | T  |  T
 T  | F  |  T
 F  | T  |  T
 F  | F  |  F
```

True when AT LEAST ONE is true. This is inclusive OR (not XOR).

### Implication (p -> q)

This is the tricky one. "If it rains, the ground is wet."

```
 p  | q  | p -> q
----|----|-----
 T  | T  |  T       Rain, wet ground. Promise kept.
 T  | F  |  F       Rain, dry ground. Promise BROKEN.
 F  | T  |  T       No rain, wet ground. Promise not violated.
 F  | F  |  T       No rain, dry ground. Promise not violated.
```

**Key insight:** A false premise makes the implication vacuously true.
"If pigs fly, I'll give you a million dollars" is technically true — pigs don't fly.

### Biconditional (p <-> q)

```
 p  | q  | p <-> q
----|----|-----
 T  | T  |  T
 T  | F  |  F
 F  | T  |  F
 F  | F  |  T
```

True when both sides have the SAME truth value. Like `==` for booleans.

## Building Complex Expressions

Just like code, you can combine operators:

```
Expression: ~p v (q ^ r)

 p | q | r | ~p | q^r | ~p v (q^r)
---|---|---|----|-----|----------
 T | T | T |  F |  T  |     T
 T | T | F |  F |  F  |     F
 T | F | T |  F |  F  |     F
 T | F | F |  F |  F  |     F
 F | T | T |  T |  T  |     T
 F | T | F |  T |  F  |     T
 F | F | T |  T |  F  |     T
 F | F | F |  T |  F  |     T
```

## Tautologies, Contradictions, Contingencies

```
Tautology:     ALWAYS true    p v ~p        "It rains or it doesn't"
Contradiction: ALWAYS false   p ^ ~p        "It rains and it doesn't"
Contingency:   SOMETIMES true p ^ q         Depends on values
```

## Logical Equivalences — Your Refactoring Toolkit

These let you simplify expressions, just like refactoring code:

```
De Morgan's Laws:
  ~(p ^ q)  ===  ~p v ~q       not (A and B) == (not A) or (not B)
  ~(p v q)  ===  ~p ^ ~q       not (A or B)  == (not A) and (not B)

Double Negation:
  ~~p  ===  p

Implication Elimination:
  p -> q  ===  ~p v q

Contrapositive:
  p -> q  ===  ~q -> ~p
```

## Python: Truth Table Generator

```python
from itertools import product

def truth_table(variables, expression):
    headers = variables + [expression]
    print(" | ".join(f"{h:^5}" for h in headers))
    print("-" * (7 * len(headers)))

    for values in product([True, False], repeat=len(variables)):
        env = dict(zip(variables, values))
        result = eval(expression, {}, env)
        row = list(values) + [result]
        print(" | ".join(f"{'T' if v else 'F':^5}" for v in row))

truth_table(["p", "q"], "not p or (p and q)")
```

## The Contrapositive — A Proof Powerhouse

The contrapositive of `p -> q` is `~q -> ~p`. They are logically equivalent.

```
Original:       "If it rains, the ground is wet"
Contrapositive: "If the ground is NOT wet, it did NOT rain"

Same meaning! This is used constantly in proofs.

  NOT the same as:
  Converse:  q -> p   "If ground is wet, it rained" (sprinklers exist!)
  Inverse:  ~p -> ~q  "If no rain, ground not wet"  (also wrong)
```

## Exercises

1. Build the truth table for `(p -> q) ^ (q -> r) -> (p -> r)`
   Is it a tautology?

2. Use De Morgan's Law to simplify `~(~p ^ q)`

3. Write a Python function that checks if two expressions are logically equivalent
   by comparing their truth tables.

4. The "exclusive or" (XOR) is true when exactly one input is true.
   Express XOR using only AND, OR, and NOT.

5. Prove that `p -> q` is equivalent to `~p v q` using a truth table.

---

[Next: Lesson 02 — Predicate Logic](02-predicate-logic.md)
