# Lesson 03: Unit Testing Fundamentals

> **The one thing to remember**: A unit test follows three steps —
> **Arrange** (set up the inputs), **Act** (call the function),
> **Assert** (check the result). If you can remember this pattern,
> you can write any unit test. It's like cooking: gather ingredients,
> cook the dish, taste it.

---

## The Spell-Checker Analogy

A unit test is like a spell-checker for your code's behavior. It doesn't
check if your essay is *good* — it checks if individual words are
spelled correctly. You still need a human to review the essay (that's
integration and E2E testing), but catching spelling errors automatically
saves enormous amounts of time.

```
UNIT TEST = SPELL CHECKER FOR CODE

  Spell-checker:
    Input: a word
    Check: is it spelled correctly?
    Result: yes or no

  Unit test:
    Input: function arguments
    Check: does the function return the right value?
    Result: pass or fail

  Both catch small mistakes automatically,
  before they become embarrassing problems.
```

---

## The Arrange-Act-Assert Pattern

Every unit test follows this structure. Always.

```
THE AAA PATTERN

  +-------------------+
  |     ARRANGE       |  Set up the world
  |  Create inputs    |  Build objects, define variables
  |  Set up state     |  Whatever your function needs
  +-------------------+
          |
          v
  +-------------------+
  |       ACT         |  Do the thing
  |  Call the function |  ONE function call
  |  or method        |  This is what you're testing
  +-------------------+
          |
          v
  +-------------------+
  |     ASSERT        |  Check the result
  |  Verify output    |  Did it return the right thing?
  |  Check side effects|  Did it change what it should?
  +-------------------+
```

### Python Example (pytest)

```python
import pytest

def calculate_tax(price, tax_rate):
    if price < 0:
        raise ValueError("Price cannot be negative")
    if tax_rate < 0 or tax_rate > 1:
        raise ValueError("Tax rate must be between 0 and 1")
    return round(price * tax_rate, 2)

def test_basic_tax_calculation():
    price = 100.00
    tax_rate = 0.08

    tax = calculate_tax(price, tax_rate)

    assert tax == 8.00

def test_zero_tax_rate():
    tax = calculate_tax(50.00, 0.0)
    assert tax == 0.0

def test_negative_price_raises():
    with pytest.raises(ValueError, match="Price cannot be negative"):
        calculate_tax(-10.00, 0.08)

def test_rounding():
    tax = calculate_tax(10.00, 0.075)
    assert tax == 0.75
```

### TypeScript Example (Vitest)

```typescript
import { describe, it, expect } from "vitest";

function calculateTax(price: number, taxRate: number): number {
  if (price < 0) throw new Error("Price cannot be negative");
  if (taxRate < 0 || taxRate > 1) throw new Error("Tax rate must be between 0 and 1");
  return Math.round(price * taxRate * 100) / 100;
}

describe("calculateTax", () => {
  it("calculates basic tax correctly", () => {
    const price = 100.0;
    const taxRate = 0.08;

    const tax = calculateTax(price, taxRate);

    expect(tax).toBe(8.0);
  });

  it("returns zero for zero tax rate", () => {
    expect(calculateTax(50.0, 0.0)).toBe(0.0);
  });

  it("throws for negative price", () => {
    expect(() => calculateTax(-10.0, 0.08)).toThrow("Price cannot be negative");
  });

  it("rounds to two decimal places", () => {
    expect(calculateTax(10.0, 0.075)).toBe(0.75);
  });
});
```

Notice how each test is three clear sections: setup, action, check. Even
when they're short enough to be one-liners, the pattern is there.

---

## What Makes a Good Unit Test

Think of the **FIRST** principles:

```
F.I.R.S.T. PRINCIPLES

  F - Fast        Runs in milliseconds. You should run hundreds
                   without thinking about it.

  I - Isolated    Tests don't depend on each other. Running test #5
                   shouldn't require test #4 to run first.
                   Test A's failure shouldn't cause Test B to fail.

  R - Repeatable  Same result every time. No randomness, no dependency
                   on the current date, no network calls.

  S - Self-       The test itself tells you if it passed or failed.
      Validating  No human needs to read output and decide.

  T - Timely      Written close in time to the code being tested.
                   Ideally before or during, not months later.
```

### Isolated: The Key Property

```
BAD: Tests depend on each other

  test_1: creates a user "Alice"
  test_2: looks up "Alice" ← breaks if test_1 didn't run first
  test_3: deletes "Alice"  ← breaks if test_2 didn't run

  If you run test_2 alone, it fails.
  If you run tests in a different order, they fail.
  This is a nightmare.

GOOD: Each test is independent

  test_1: creates a user, verifies creation (cleans up after)
  test_2: creates its OWN user, looks it up (cleans up after)
  test_3: creates its OWN user, deletes it (cleans up after)

  Any test can run alone, in any order. Beautiful.
```

---

## What to Test and What Not to Test

```
TEST THIS                              DON'T TEST THIS

Your business logic                    Framework/library code
  calculate_shipping()                   React's useState
  validate_user_input()                  Express's routing
  apply_discount()                       SQLAlchemy's ORM

Edge cases and boundaries              Trivial getters/setters
  empty list, null input                 getName() { return name }
  boundary values (0, max)               setAge(a) { age = a }

Error handling                         Private implementation details
  what if the API is down?               internal helper functions
  what if input is malformed?            (test through public interface)

Complex conditional logic              Third-party API responses
  if/else chains                         (mock these instead)
  state machines
```

### The Private Method Question

Should you test private methods? Almost never directly.

```
WHY NOT TO TEST PRIVATE METHODS

  class ShoppingCart:
      def total(self):           ← PUBLIC: test this
          return self._subtotal() + self._calculate_tax()

      def _subtotal(self):       ← PRIVATE: don't test directly
          ...

      def _calculate_tax(self):  ← PRIVATE: don't test directly
          ...

  Test the public method (total). If _subtotal or _calculate_tax
  have bugs, the test for total() will catch them.

  If a private method is SO complex it needs its own tests,
  that's a sign it should be extracted into its own class/function.
```

---

## Naming Your Tests

A good test name tells you what broke without reading the code.

```
BAD NAMES                          GOOD NAMES

test_1()                           test_empty_cart_has_zero_total()
test_add()                         test_add_returns_sum_of_two_numbers()
test_error()                       test_negative_quantity_raises_value_error()
testIt()                           test_discount_applies_before_tax()
```

Common naming patterns:

```
NAMING CONVENTIONS

  Pattern 1: test_[what]_[condition]_[expected]
    test_calculate_tax_with_zero_rate_returns_zero
    test_login_with_wrong_password_returns_401

  Pattern 2: test_[scenario]
    test_empty_cart_total_is_zero
    test_expired_coupon_is_rejected

  Pattern 3: should_[expected]_when_[condition]  (common in JS/TS)
    should_return_zero_when_cart_is_empty
    should_throw_when_password_is_too_short
```

---

## Testing Error Cases

Testing the happy path is easy. Testing what happens when things go
wrong is where the real value lives.

```python
import pytest

def divide(a, b):
    if b == 0:
        raise ZeroDivisionError("Cannot divide by zero")
    return a / b

def test_divide_normal():
    assert divide(10, 2) == 5.0

def test_divide_by_zero():
    with pytest.raises(ZeroDivisionError, match="Cannot divide by zero"):
        divide(10, 0)

def test_divide_negative_numbers():
    assert divide(-10, 2) == -5.0
    assert divide(10, -2) == -5.0
    assert divide(-10, -2) == 5.0

def test_divide_floating_point():
    result = divide(1, 3)
    assert abs(result - 0.333333) < 0.001
```

```typescript
import { describe, it, expect } from "vitest";

function divide(a: number, b: number): number {
  if (b === 0) throw new Error("Cannot divide by zero");
  return a / b;
}

describe("divide", () => {
  it("divides two positive numbers", () => {
    expect(divide(10, 2)).toBe(5);
  });

  it("throws when dividing by zero", () => {
    expect(() => divide(10, 0)).toThrow("Cannot divide by zero");
  });

  it("handles negative numbers", () => {
    expect(divide(-10, 2)).toBe(-5);
    expect(divide(10, -2)).toBe(-5);
    expect(divide(-10, -2)).toBe(5);
  });

  it("handles floating point results", () => {
    expect(divide(1, 3)).toBeCloseTo(0.3333, 3);
  });
});
```

---

## One Assert Per Concept

A test should verify one behavior. That doesn't mean literally one
`assert` statement — it means one *logical concept*.

```python
def test_create_user():
    user = create_user("Alice", "alice@example.com")

    assert user.name == "Alice"
    assert user.email == "alice@example.com"
    assert user.id is not None
    assert user.created_at is not None
```

This has four asserts but tests one concept: "creating a user populates
all fields correctly." That's fine.

```python
def test_everything_about_users():
    user = create_user("Alice", "alice@example.com")
    assert user.name == "Alice"

    updated = update_user(user.id, name="Bob")
    assert updated.name == "Bob"

    delete_user(user.id)
    assert get_user(user.id) is None
```

This tests three concepts (create, update, delete) and should be three
separate tests. If the update fails, you don't know if delete works.

---

## Running Tests

```
RUNNING TESTS BY LANGUAGE

  Python (pytest):
    $ pytest                         Run all tests
    $ pytest test_math.py            Run one file
    $ pytest -k "test_divide"        Run tests matching a name
    $ pytest -x                      Stop on first failure
    $ pytest -v                      Verbose output

  TypeScript (Vitest):
    $ npx vitest                     Run all tests (watch mode)
    $ npx vitest run                 Run once and exit
    $ npx vitest run math.test.ts    Run one file
    $ npx vitest -t "divide"         Run tests matching a name

  Rust:
    $ cargo test                     Run all tests
    $ cargo test test_divide         Run tests matching a name
    $ cargo test -- --nocapture      Show println! output

  Go:
    $ go test ./...                  Run all tests in all packages
    $ go test -run TestDivide        Run tests matching a name
    $ go test -v                     Verbose output
```

---

## A Complete Example: String Calculator

Let's build a string calculator with tests, showing the full workflow.

```python
def string_calculator(expression):
    expression = expression.strip()
    if not expression:
        return 0

    parts = expression.split("+")
    total = 0
    for part in parts:
        part = part.strip()
        if not part.lstrip("-").isdigit():
            raise ValueError(f"Invalid number: '{part}'")
        total += int(part)
    return total

class TestStringCalculator:
    def test_empty_string_returns_zero(self):
        assert string_calculator("") == 0

    def test_single_number(self):
        assert string_calculator("5") == 5

    def test_two_numbers(self):
        assert string_calculator("2 + 3") == 5

    def test_multiple_numbers(self):
        assert string_calculator("1 + 2 + 3 + 4") == 10

    def test_negative_numbers(self):
        assert string_calculator("-5 + 3") == -2

    def test_whitespace_handling(self):
        assert string_calculator("  2 +  3  ") == 5

    def test_invalid_input_raises(self):
        with pytest.raises(ValueError, match="Invalid number"):
            string_calculator("abc")

    def test_whitespace_only_returns_zero(self):
        assert string_calculator("   ") == 0
```

Each test is small, focused, and named clearly. If any test fails, you
know *exactly* what behavior is broken.

---

## Exercises

1. **Write AAA tests**: Pick a function from any project. Write 5 tests
   using the Arrange-Act-Assert pattern. Label each section with a
   comment.

2. **Name audit**: Look at tests you've written before. Would someone
   who's never seen the code know what each test checks just from the
   name? Rename any unclear tests.

3. **Edge case challenge**: Write a function `clamp(value, min, max)`
   that restricts a number to a range. Write tests for: normal values,
   values at boundaries, values outside boundaries, min equals max,
   and invalid inputs (min > max).

4. **FIRST audit**: Review a test suite (yours or open source). Does
   each test follow the FIRST principles? Find one that violates a
   principle and explain how you'd fix it.

---

[Next: Lesson 04 - Writing Good Assertions](./04-assertions.md)
