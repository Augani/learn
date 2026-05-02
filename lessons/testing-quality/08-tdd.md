# Lesson 08: Test-Driven Development

> **The one thing to remember**: TDD means writing the test *before* the
> code. It sounds backwards, like writing the answer key before the exam
> questions. But it works because it forces you to think about *what*
> your code should do before you think about *how* to do it.

---

## The Blueprint Analogy

Building a house without blueprints is possible, but messy. You'd build
a room, realize the door is in the wrong place, tear it down, and start
over. Blueprints (tests) come first because they define what "correct"
looks like before you start building.

```
TRADITIONAL DEVELOPMENT           TEST-DRIVEN DEVELOPMENT

  1. Think about the problem       1. Think about the problem
  2. Write the code                2. Write a test that DEFINES success
  3. Manually try it               3. Run test — it FAILS (RED)
  4. "Looks right"                 4. Write MINIMAL code to pass
  5. Months later: "Wait,          5. Run test — it PASSES (GREEN)
     what was this supposed         6. Clean up the code (REFACTOR)
     to do?"                       7. Run test — still passes
                                   8. Repeat with next behavior
```

---

## Red-Green-Refactor

TDD follows a tight cycle called **Red-Green-Refactor**:

```
THE TDD CYCLE

       ┌─────────────────┐
       │   1. RED         │  Write a failing test
       │   Test fails     │  (defines what you want)
       └────────┬────────┘
                │
                v
       ┌─────────────────┐
       │   2. GREEN       │  Write the simplest code
       │   Test passes    │  that makes the test pass
       └────────┬────────┘
                │
                v
       ┌─────────────────┐
       │   3. REFACTOR    │  Clean up the code
       │   Still passes   │  (tests protect you)
       └────────┬────────┘
                │
                └──→ Back to RED with the next test

  Each cycle should take 1-10 minutes.
  If it takes longer, you're taking too big a step.
```

The key rules:

1. **Never write production code without a failing test first**
2. **Write only enough test to fail** (one assertion, one behavior)
3. **Write only enough code to pass** (resist the urge to add extras)

---

## TDD by Example: Building a Password Validator

Let's build a password validator step by step using TDD. Each cycle
adds one requirement.

### Cycle 1: Password must be at least 8 characters

**RED** — Write the test first:

```python
import pytest

def test_password_too_short():
    assert validate_password("abc") == False

def test_password_long_enough():
    assert validate_password("abcdefgh") == True
```

Run it — it fails because `validate_password` doesn't exist yet.

**GREEN** — Write the minimum code to pass:

```python
def validate_password(password):
    return len(password) >= 8
```

Run tests — they pass.

**REFACTOR** — Nothing to clean up yet. Move on.

### Cycle 2: Must contain at least one uppercase letter

**RED**:

```python
def test_password_needs_uppercase():
    assert validate_password("abcdefgh") == False

def test_password_with_uppercase():
    assert validate_password("Abcdefgh") == True
```

Wait — the first test now contradicts our earlier test! That's fine.
We update the earlier test to include an uppercase letter:

```python
def test_password_long_enough_with_uppercase():
    assert validate_password("Abcdefgh") == True

def test_password_missing_uppercase():
    assert validate_password("abcdefgh") == False
```

**GREEN**:

```python
def validate_password(password):
    if len(password) < 8:
        return False
    if not any(c.isupper() for c in password):
        return False
    return True
```

### Cycle 3: Must contain at least one digit

**RED**:

```python
def test_password_missing_digit():
    assert validate_password("Abcdefgh") == False

def test_password_with_digit():
    assert validate_password("Abcdefg1") == True
```

**GREEN**:

```python
def validate_password(password):
    if len(password) < 8:
        return False
    if not any(c.isupper() for c in password):
        return False
    if not any(c.isdigit() for c in password):
        return False
    return True
```

**REFACTOR** — The pattern is repetitive. Let's clean up:

```python
def validate_password(password):
    checks = [
        len(password) >= 8,
        any(c.isupper() for c in password),
        any(c.isdigit() for c in password),
    ]
    return all(checks)
```

Run all tests — still pass. The refactored code is cleaner and easy to
extend.

### Cycle 4: Return error messages instead of True/False

**RED**:

```python
def test_returns_errors_for_short_password():
    errors = validate_password("Ab1")
    assert "at least 8 characters" in errors

def test_returns_multiple_errors():
    errors = validate_password("abc")
    assert len(errors) >= 2

def test_returns_empty_list_for_valid():
    errors = validate_password("Abcdefg1")
    assert errors == []
```

**GREEN**:

```python
def validate_password(password):
    errors = []
    if len(password) < 8:
        errors.append("Password must be at least 8 characters")
    if not any(c.isupper() for c in password):
        errors.append("Password must contain at least one uppercase letter")
    if not any(c.isdigit() for c in password):
        errors.append("Password must contain at least one digit")
    return errors
```

Notice: the return type changed from `bool` to `list[str]`. TDD made
this transition smooth because we had tests guiding us.

---

## TDD in TypeScript

```typescript
import { describe, it, expect } from "vitest";

function fizzBuzz(n: number): string {
  throw new Error("Not implemented");
}

describe("fizzBuzz", () => {
  it("returns the number as string for regular numbers", () => {
    expect(fizzBuzz(1)).toBe("1");
    expect(fizzBuzz(2)).toBe("2");
  });
});
```

**RED**: Test fails with "Not implemented."

**GREEN**:

```typescript
function fizzBuzz(n: number): string {
  return String(n);
}
```

Next test:

```typescript
it("returns Fizz for multiples of 3", () => {
  expect(fizzBuzz(3)).toBe("Fizz");
  expect(fizzBuzz(6)).toBe("Fizz");
  expect(fizzBuzz(9)).toBe("Fizz");
});
```

**GREEN**:

```typescript
function fizzBuzz(n: number): string {
  if (n % 3 === 0) return "Fizz";
  return String(n);
}
```

Next test:

```typescript
it("returns Buzz for multiples of 5", () => {
  expect(fizzBuzz(5)).toBe("Buzz");
  expect(fizzBuzz(10)).toBe("Buzz");
});
```

**GREEN**:

```typescript
function fizzBuzz(n: number): string {
  if (n % 3 === 0) return "Fizz";
  if (n % 5 === 0) return "Buzz";
  return String(n);
}
```

Final test:

```typescript
it("returns FizzBuzz for multiples of both 3 and 5", () => {
  expect(fizzBuzz(15)).toBe("FizzBuzz");
  expect(fizzBuzz(30)).toBe("FizzBuzz");
});
```

**GREEN**:

```typescript
function fizzBuzz(n: number): string {
  if (n % 15 === 0) return "FizzBuzz";
  if (n % 3 === 0) return "Fizz";
  if (n % 5 === 0) return "Buzz";
  return String(n);
}
```

Each cycle: write test, see it fail, make it pass, move on. Small steps.

---

## When TDD Helps Most

```
TDD SHINES WHEN:

  ✓ Building business logic with clear rules
    "If the order total exceeds $100, shipping is free"

  ✓ Working on code you'll refactor later
    Tests give you a safety net for restructuring

  ✓ Implementing algorithms with known inputs/outputs
    "Given this input, I expect this output"

  ✓ Fixing bugs
    Write a test that reproduces the bug FIRST,
    then fix it. The test prevents regression.

  ✓ Designing new APIs
    Writing tests first forces you to think about
    how the API will be USED, not just implemented.
```

```
TDD IS HARDER WHEN:

  ✗ Exploring / prototyping (you don't know what you want yet)
    Spike first, write tests after for the keeper code

  ✗ UI layout and styling
    Visual testing tools work better here

  ✗ Integration with external systems you don't control
    You can't TDD the weather API's behavior

  ✗ Performance optimization
    Benchmarks guide optimization, not unit tests

  ✗ One-off scripts you'll use once
    The test would take longer than the script
```

---

## The TDD Bug-Fix Workflow

One of the most powerful TDD applications: fixing bugs.

```
THE TDD BUG-FIX PROCESS

  1. Customer reports: "Discount isn't applied for orders over $500"

  2. Write a test that REPRODUCES the bug:
     def test_discount_for_large_orders():
         order = create_order(total=600.00)
         apply_discount(order)
         assert order.discount == 60.00  # 10% of 600

  3. Run the test — it FAILS (confirming the bug exists)

  4. Fix the code

  5. Run the test — it PASSES (confirming the fix works)

  6. The test stays in the suite FOREVER,
     preventing this bug from ever coming back.
```

This is called a **regression test**. Every bug fix should add one.

---

## Common TDD Mistakes

```
MISTAKE                              SOLUTION

Taking too big a step                Start with the simplest case.
"I'll write all 20 tests first"      One test at a time.

Writing the code first               Discipline. Write the test FIRST,
"I'll add tests after"               even when it feels slow.

Testing implementation details       Test WHAT it does, not HOW.
"It should call helper method X"     "Given X, it should return Y."

Not refactoring in GREEN phase       The refactor step is NOT optional.
"Tests pass, I'm done"               Clean code is part of TDD.

Making the test pass by hardcoding   Add more test cases to force
"return 42"                          real implementation.
```

---

## TDD Rhythm: A Mental Checklist

```
BEFORE EACH CYCLE:
  □ What's the next simplest behavior to add?
  □ Can I describe it in one sentence?
  □ What's the smallest test that verifies it?

RED PHASE:
  □ Write ONE test
  □ Run it — does it FAIL?
  □ Does it fail for the RIGHT reason?

GREEN PHASE:
  □ Write the MINIMUM code to pass
  □ Don't add anything extra
  □ All tests pass?

REFACTOR PHASE:
  □ Any duplication to remove?
  □ Any names to improve?
  □ Run tests — still pass?
  □ Ready for next cycle
```

---

## Exercises

1. **TDD kata**: Build a `StringCalculator` using TDD. Start with:
   empty string returns 0, single number returns that number, two
   comma-separated numbers return their sum. Add features one test
   at a time.

2. **Bug-fix TDD**: Find a bug in any code you've written (or introduce
   one intentionally). Write a failing test first, then fix the bug.

3. **Refactoring with TDD**: Take a working but messy function. Write
   tests that capture its current behavior. Then refactor the function
   with confidence.

4. **TDD a data structure**: Build a `Stack` class using TDD. Start
   with: `push`, `pop`, `peek`, `isEmpty`, and `size`. Handle the
   edge case of popping from an empty stack.

---

[Next: Lesson 09 - Property-Based Testing](./09-property-based-testing.md)
