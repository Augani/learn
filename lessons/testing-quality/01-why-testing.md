# Lesson 01: Why Testing Matters

> **The one thing to remember**: Testing is like proofreading a letter
> before you mail it. You *could* skip it, but you'll eventually send
> something embarrassing to the wrong person. The later you find a
> mistake, the more expensive it is to fix.

---

## The Seatbelt Analogy

Imagine you're building a bridge. Would you:

A) Build the whole bridge, then test it by driving a truck across
B) Test each beam, each joint, each cable as you go

Option A is how most beginners write code. Option B is how professionals
build software. Testing isn't a phase at the end — it's woven into
every step.

```
THE COST OF FINDING BUGS

  When found:          Relative cost to fix:

  While writing code   $1          |||
  In code review       $5          |||||||
  During QA testing    $15         |||||||||||||||||
  After release        $100+       ||||||||||||||||||||||||||||||||||||||||||

  A bug caught in development might take 10 minutes to fix.
  The same bug in production might take a week:
  - Customer reports it
  - Support triages it
  - Developer reproduces it
  - Developer finds the root cause
  - Developer fixes it
  - QA verifies the fix
  - Deploy the fix
  - Apologize to affected customers
```

This isn't theoretical. NASA's Mars Climate Orbiter crashed because one
team used metric units and another used imperial. A simple unit test
checking the conversion function would have caught it. The spacecraft
cost $327 million.

---

## What Testing Actually Is

Testing means writing code that checks your other code. That's it.

Think of it like a recipe taste-test. You're the chef (developer) and
you have a helper (test) who tastes every dish before it goes out:

```
WITHOUT TESTS                    WITH TESTS

  Write code                      Write code
  "Looks right to me"             Write test that exercises code
  Ship it                         Run test: does it pass?
  Customer finds bug              No → fix code, run test again
  Panic and hotfix                Yes → ship with confidence
  Repeat                          Customer happy. You sleep well.
```

Here's the simplest possible test in Python:

```python
def add(a, b):
    return a + b

def test_add():
    result = add(2, 3)
    assert result == 5, f"Expected 5, got {result}"

test_add()
print("Test passed!")
```

And in TypeScript:

```typescript
function add(a: number, b: number): number {
  return a + b;
}

function testAdd(): void {
  const result = add(2, 3);
  if (result !== 5) {
    throw new Error(`Expected 5, got ${result}`);
  }
}

testAdd();
console.log("Test passed!");
```

That's a test. You call your function, check the result, and complain
loudly if it's wrong. Testing frameworks add convenience, but the core
idea is exactly this.

---

## The Four Reasons to Test

### 1. Catch Bugs Early

```
BUG TIMELINE

  Day 1:  You write a function that handles prices
  Day 1:  Test catches: negative prices aren't rejected  ← CHEAP FIX

  vs.

  Day 1:  You write a function that handles prices
  Day 30: Code ships to production
  Day 45: Customer is charged -$50 (they GET money)
  Day 46: Accounting notices $10,000 discrepancy           ← EXPENSIVE
  Day 47: Emergency meeting, hotfix, post-mortem
```

### 2. Confidence to Change Code

This is the big one. Without tests, changing code feels like:

```
REFACTORING WITHOUT TESTS

  "I need to change this function..."
  "But what if I break something?"
  "I'll just leave it alone."
  "Now I have two functions that do almost the same thing."
  "Now I have five."
  "The codebase is unmaintainable."
  "Let's rewrite everything from scratch."
```

With tests, changing code feels like:

```
REFACTORING WITH TESTS

  "I need to change this function..."
  *makes the change*
  *runs tests*
  "Two tests failed — I broke the discount calculation."
  *fixes it*
  *all tests pass*
  "Ship it."
```

Tests are a **safety net**. Trapeze artists don't fall less often with a
net — they attempt more daring moves. Tests let you be bold with your
code.

### 3. Tests Are Documentation

Consider this function:

```python
def calculate_shipping(weight, destination, is_prime):
    ...
```

What does it do? You could read the implementation. Or you could read
the tests:

```python
def test_free_shipping_for_prime_members():
    cost = calculate_shipping(weight=5.0, destination="US", is_prime=True)
    assert cost == 0.0

def test_flat_rate_for_light_packages():
    cost = calculate_shipping(weight=0.5, destination="US", is_prime=False)
    assert cost == 4.99

def test_weight_based_for_heavy_packages():
    cost = calculate_shipping(weight=50.0, destination="US", is_prime=False)
    assert cost == 24.99

def test_international_surcharge():
    cost = calculate_shipping(weight=5.0, destination="UK", is_prime=False)
    assert cost == 15.99
```

The tests tell you *exactly* what the function does in every scenario.
And unlike comments, **tests can't go stale** — if the behavior changes
and the test isn't updated, it fails loudly.

### 4. Better Design

Code that's hard to test is usually badly designed. If you can't test a
function without setting up a database, a network connection, and three
other services, that function is doing too much.

```
HARD TO TEST (badly designed)

  calculatePrice():
    → connects to database
    → calls pricing API
    → checks user's membership
    → applies discount
    → logs to analytics
    → sends email
    → returns price

EASY TO TEST (well designed)

  calculatePrice(basePrice, discount, taxRate):
    → applies discount to base price
    → adds tax
    → returns final price

  (Database, API, email, etc. are handled elsewhere)
```

Writing tests forces you to separate concerns. This is why many
experienced developers say "testing improves design" — it pushes you
toward smaller, focused functions with clear inputs and outputs.

---

## What Happens Without Tests

Real-world horror stories:

```
COMPANY                WHAT HAPPENED                    COST

Knight Capital (2012)  Deployed untested code that      $440 million
                       bought stocks at wrong prices.   in 45 minutes
                       Company went bankrupt.

Therac-25 (1985-87)   Medical radiation machine with    6 patients
                       untested race condition.          received lethal
                       No integration tests.            radiation doses.

British Post Office    Buggy accounting software         700+ wrongful
(1999-2015)            with no regression tests.         prosecutions of
                       False shortfall reports.          postal workers.
```

You don't need to be building medical devices for testing to matter.
Every web app, every API, every script that handles real data benefits
from tests.

---

## The Testing Mindset

Beginning programmers ask: "Does my code work?"
They try it once manually and call it done.

Experienced programmers ask: "How could my code break?"
They write tests for:

```
THE TESTING CHECKLIST

  Normal cases:     Does it work with typical input?
  Edge cases:       What about empty input? Huge input? Zero?
  Error cases:      What happens with invalid input?
  Boundary cases:   What about the limits? Off-by-one errors?

  Example for a function that divides two numbers:

  ✓ divide(10, 2) == 5           Normal case
  ✓ divide(0, 5) == 0            Zero numerator
  ✓ divide(5, 0) raises error    Division by zero
  ✓ divide(-10, 2) == -5         Negative numbers
  ✓ divide(1, 3) ≈ 0.333...     Repeating decimal
  ✓ divide(MAX_INT, 1) works     Very large numbers
```

---

## Your First Real Test

Here's a slightly more realistic example. Suppose you have a function
that validates email addresses:

```python
import re

def is_valid_email(email):
    if not email or not isinstance(email, str):
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def test_valid_emails():
    assert is_valid_email("user@example.com") is True
    assert is_valid_email("first.last@company.co.uk") is True
    assert is_valid_email("user+tag@gmail.com") is True

def test_invalid_emails():
    assert is_valid_email("") is False
    assert is_valid_email("not-an-email") is False
    assert is_valid_email("@no-local-part.com") is False
    assert is_valid_email("spaces in@email.com") is False

def test_edge_cases():
    assert is_valid_email(None) is False
    assert is_valid_email(42) is False
    assert is_valid_email("a@b.co") is True

test_valid_emails()
test_invalid_emails()
test_edge_cases()
print("All email validation tests passed!")
```

Notice the pattern: normal cases, invalid cases, edge cases. This is how
professional developers think about testing.

---

## Exercises

1. **Cost thinking**: You're building a checkout flow. A bug causes
   prices to be calculated 1 cent off. How much does this cost if you
   find it in development vs. after 100,000 transactions?

2. **Write your first tests**: Pick any small function you've written.
   Write at least 5 tests for it: two normal cases, two edge cases,
   and one error case.

3. **Read tests as docs**: Find an open-source project on GitHub. Read
   its test files before reading the source code. What did you learn
   about what the code does just from reading the tests?

4. **Break your code**: Write a function, then write a test. Now
   intentionally introduce a bug. Does your test catch it? If not,
   what test would catch it?

---

[Next: Lesson 02 - The Testing Pyramid](./02-testing-pyramid.md)
