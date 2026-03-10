# Lesson 02 — Predicate Logic

> **Analogy:** SQL `WHERE` clauses are predicate logic.
> `SELECT * FROM users WHERE age > 18 AND active = true`
> translates to: "For all x in users, if age(x) > 18 and active(x), return x."

## From Propositions to Predicates

Propositional logic can say "it is raining." But it can't say "ALL days in March are rainy"
or "SOME student passed the exam." We need **quantifiers**.

A **predicate** is a proposition with variables:

```
P(x) = "x is prime"

P(7) = True
P(4) = False
P(x) = depends on x
```

A predicate becomes a proposition once you plug in a value or quantify it.

## The Two Quantifiers

```
Symbol   Name               English              Code Analogy
------   ----               -------              -----------
  ALL    Universal          "For all x ..."      all() in Python
  EX     Existential        "There exists x ..." any() in Python
```

### Universal Quantifier (ALL)

"For ALL x in domain D, P(x) is true."

```
ALL x in Integers, x + 0 = x           True (additive identity)
ALL x in Integers, x > 0               False (negatives exist)
```

**Think of it as a giant AND:**

```
If domain = {1, 2, 3}:
ALL x, P(x)  means  P(1) ^ P(2) ^ P(3)
```

### Existential Quantifier (EX)

"There EXISTS at least one x in domain D such that P(x) is true."

```
EX x in Integers, x^2 = 4              True (x = 2 or x = -2)
EX x in Integers, x > x + 1            False (impossible)
```

**Think of it as a giant OR:**

```
If domain = {1, 2, 3}:
EX x, P(x)  means  P(1) v P(2) v P(3)
```

## Python Connection

```python
numbers = [2, 4, 6, 8, 10]

all_even = all(n % 2 == 0 for n in numbers)

has_ten = any(n == 10 for n in numbers)
```

## Nested Quantifiers

Order matters! Like nested loops:

```
ALL x, EX y, x + y = 0
"For every number, there exists a negative."
True for integers.

EX y, ALL x, x + y = 0
"There exists one number that is the negative of ALL numbers."
False! No single y satisfies x + y = 0 for every x.
```

Visualize it as nested loops:

```
ALL x, EX y, P(x, y)        |    EX y, ALL x, P(x, y)
                              |
for x in domain:              |    found = False
    found = False             |    for y in domain:
    for y in domain:          |        if all(P(x,y) for x in domain):
        if P(x, y):           |            found = True
            found = True      |            break
            break             |
    if not found:             |
        return False          |
return True                   |
```

## Negating Quantifiers — De Morgan's for Quantifiers

```
 ~(ALL x, P(x))  ===  EX x, ~P(x)
 ~(EX x, P(x))   ===  ALL x, ~P(x)
```

**Everyday examples:**

```
Statement:  "ALL students passed"
Negation:   "There EXISTS a student who did NOT pass"
  (NOT "All students failed")

Statement:  "There EXISTS a bug in the code"
Negation:   "ALL code is bug-free"
```

## Translating English to Logic

```
English: "Every user with admin access can delete files"

Domain: Users
Let A(x) = "x has admin access"
Let D(x) = "x can delete files"

Logic: ALL x, A(x) -> D(x)

Note: NOT "ALL x, A(x) ^ D(x)"
That would mean "Every user has admin access AND can delete files."
```

Common pattern:

```
"All P are Q"       ->  ALL x, P(x) -> Q(x)
"Some P are Q"      ->  EX x, P(x) ^ Q(x)
"No P are Q"        ->  ALL x, P(x) -> ~Q(x)
                    or  ~EX x, P(x) ^ Q(x)
```

## Multiple Predicates

```
English: "Every student is enrolled in some course"

S(x) = "x is a student"
E(x, y) = "x is enrolled in y"
C(y) = "y is a course"

Logic: ALL x, S(x) -> EX y, C(y) ^ E(x, y)
```

## SQL as Predicate Logic

```
SQL:
SELECT name FROM employees
WHERE department = 'Engineering'
AND salary > 100000

Logic:
{ name(x) | Employee(x) ^ dept(x) = 'Engineering' ^ salary(x) > 100000 }
```

```
SQL:
SELECT * FROM orders o
WHERE EXISTS (
    SELECT 1 FROM returns r WHERE r.order_id = o.id
)

Logic:
{ o | Order(o) ^ EX r, Return(r) ^ order_id(r) = id(o) }
```

## Free vs Bound Variables

```
ALL x, P(x, y)
     ^       ^
     |       |
   bound    free

x is bound by the quantifier ALL.
y is free — it needs a value for the statement to be a proposition.
```

A formula with NO free variables is called a **sentence** — it has a definite truth value.

## Logical Equivalences with Quantifiers

```
ALL x, (P(x) ^ Q(x))  ===  (ALL x, P(x)) ^ (ALL x, Q(x))

EX x, (P(x) v Q(x))   ===  (EX x, P(x)) v (EX x, Q(x))

WARNING — these do NOT distribute:
ALL x, (P(x) v Q(x))  =/=  (ALL x, P(x)) v (ALL x, Q(x))
EX x, (P(x) ^ Q(x))   =/=  (EX x, P(x)) ^ (EX x, Q(x))
```

## Exercises

1. Translate to predicate logic:
   "There is a prime number greater than 100"

2. Negate: "For every epsilon > 0, there exists a delta > 0 such that |f(x) - L| < epsilon"
   (This is the formal definition of a limit!)

3. Are these equivalent? Explain why or why not:
   - `ALL x, EX y, x < y`
   - `EX y, ALL x, x < y`

4. Write Python to verify: "For all x in range(1, 100), there exists y such that x * y = 100"

5. Translate this SQL to predicate logic:
   ```sql
   SELECT * FROM students s
   WHERE NOT EXISTS (
       SELECT 1 FROM courses c
       WHERE c.required = true
       AND NOT EXISTS (
           SELECT 1 FROM enrollments e
           WHERE e.student_id = s.id AND e.course_id = c.id
       )
   )
   ```
   (Hint: this finds students enrolled in ALL required courses)

---

[Next: Lesson 03 — Proof Techniques](03-proof-techniques.md)
