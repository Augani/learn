# Lesson 12: Code Coverage Metrics

> **The one thing to remember**: Code coverage tells you which lines of
> code your tests actually execute. It's like a highlighter showing which
> paragraphs of a book you've read. High coverage doesn't mean you
> understood the book — it just means your eyes passed over the words.
> Coverage is a useful guide, but a terrible goal.

---

## The Map Analogy

Imagine you're exploring a cave system. Code coverage is your map
showing which tunnels you've walked through:

```
CAVE MAP (CODE COVERAGE)

  ████████  Explored (tested)
  ░░░░░░░░  Unexplored (untested)

  Entry ██████████████████████████████░░░░░░░░ Dead End
                  │                        │
                  ██████████████           ░░░░░░░░
                  │           │           │
                  ██████      ░░░░░░░░░░  ░░░░
                  │                       │
                  ██████████████████████  Treasure!

  You've explored 60% of the cave.
  But the treasure is in the 40% you haven't explored yet.

  Coverage tells you WHERE you haven't looked.
  It doesn't tell you if you FOUND anything where you did look.
```

---

## Types of Coverage

### Line Coverage (Statement Coverage)

The simplest measure: what percentage of lines were executed?

```python
def categorize_age(age):        # Line 1
    if age < 0:                 # Line 2
        return "invalid"        # Line 3  ░░ Not executed
    if age < 13:                # Line 4
        return "child"          # Line 5
    if age < 18:                # Line 6
        return "teenager"       # Line 7  ░░ Not executed
    return "adult"              # Line 8

def test_child_and_adult():
    assert categorize_age(5) == "child"
    assert categorize_age(25) == "adult"

# Line coverage: 6/8 = 75%
# Lines 3 and 7 were never executed.
# We never tested negative ages or teenagers.
```

### Branch Coverage

Did every `if/else` branch get taken? This catches more than line
coverage.

```python
def calculate_price(base, is_member, has_coupon):
    price = base
    if is_member:           # Branch A: True or False?
        price *= 0.9        # 10% member discount
    if has_coupon:           # Branch B: True or False?
        price -= 5.00       # $5 coupon
    return max(price, 0)

def test_member_with_coupon():
    assert calculate_price(100, True, True) == 85.0

# Line coverage: 100% (every line executed!)
# Branch coverage: 50% (only True branches tested)
# We never tested: non-member, no coupon
```

```
BRANCH COVERAGE TABLE

  Branch A    Branch B    Tested?
  ────────────────────────────────
  True        True        ✓ (our one test)
  True        False       ✗
  False       True        ✗
  False       False       ✗

  4 branch combinations, only 1 tested = 25% branch coverage
```

### Path Coverage

Every possible path through the code. The most thorough but grows
exponentially.

```
PATH COVERAGE FOR CALCULATE_PRICE

  Path 1: is_member=T, has_coupon=T  →  base * 0.9 - 5
  Path 2: is_member=T, has_coupon=F  →  base * 0.9
  Path 3: is_member=F, has_coupon=T  →  base - 5
  Path 4: is_member=F, has_coupon=F  →  base

  With 2 conditions: 4 paths (2^2)
  With 5 conditions: 32 paths (2^5)
  With 10 conditions: 1024 paths (2^10)

  Full path coverage is often impractical for complex code.
```

---

## Measuring Coverage

### Python (pytest-cov)

```
$ pytest --cov=myproject --cov-report=term-missing

---------- coverage: platform linux, python 3.12 ----------
Name                      Stmts   Miss  Cover   Missing
---------------------------------------------------------
myproject/calculator.py      25      3    88%    14, 27-28
myproject/validator.py       40      0   100%
myproject/database.py        60     15    75%    33-45, 52-53
---------------------------------------------------------
TOTAL                       125     18    86%
```

The `Missing` column tells you exactly which lines aren't tested.

### TypeScript (Vitest / c8 / istanbul)

```
$ npx vitest --coverage

 % Coverage report
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   85.71 |    72.22 |   90.00 |   85.71 |
 calculator.ts      |  100.00 |   100.00 |  100.00 |  100.00 |
 validator.ts       |   75.00 |    50.00 |  100.00 |   75.00 |
 database.ts        |   70.00 |    60.00 |   66.67 |   70.00 |
--------------------|---------|----------|---------|---------|
```

### Go

```
$ go test -coverprofile=coverage.out ./...
$ go tool cover -func=coverage.out

mypackage/calculator.go:12:   Add             100.0%
mypackage/calculator.go:20:   Divide          85.7%
mypackage/validator.go:8:     ValidateEmail   66.7%
total:                        (statements)    80.0%

$ go tool cover -html=coverage.out
# Opens an HTML report with highlighted source code
```

### Rust

```
$ cargo tarpaulin --out Html

|| Tested/Total Lines:
|| src/calculator.rs: 25/28 (89.29%)
|| src/validator.rs: 18/22 (81.82%)
||
|| 86.00% coverage, 43/50 lines covered
```

---

## What Coverage Tells You (and Doesn't)

```
WHAT COVERAGE TELLS YOU               WHAT IT DOESN'T TELL YOU

Which lines were executed              Whether those lines are correct
Which branches were taken              Whether assertions are meaningful
Where you have NO tests               Whether edge cases are covered
Untested error handling paths          Whether the tests are any good

High coverage + bad tests = false confidence
Low coverage on critical code = real risk
```

### The 100% Coverage Trap

```python
def divide(a, b):
    return a / b

def test_divide():
    result = divide(10, 2)

# Coverage: 100%! Every line executed!
# But did we test division by zero? No.
# Did we test negative numbers? No.
# Did we test floating point edge cases? No.
# 100% coverage, terrible test quality.
```

Worse still:

```python
def test_divide_no_assertion():
    divide(10, 2)

# Coverage: 100%
# But we didn't even CHECK the result!
# This test can never fail (except on exceptions).
```

---

## Coverage as a Guide, Not a Target

```
THE COVERAGE MINDSET

  BAD MINDSET:
    "We need 90% coverage!"
    → Developers write useless tests to hit the number
    → Tests assert nothing meaningful
    → False sense of security

  GOOD MINDSET:
    "Coverage shows us where we haven't looked."
    → Run coverage report
    → Look at uncovered lines
    → Ask: "Could a bug hide here?"
    → If yes, write a meaningful test
    → If no, move on

  COVERAGE IS A THERMOMETER, NOT A THERMOSTAT.
  It measures the temperature. It doesn't set it.
```

### Reasonable Coverage Targets

```
COVERAGE GUIDELINES BY CODE TYPE

  Code Type                    Reasonable Target
  ─────────────────────────────────────────────────
  Business logic / algorithms  90%+
  API handlers / controllers   80%+
  Utilities / helpers          85%+
  Data access / repositories   70%+ (integration tests)
  UI components                60-70%
  Configuration / glue code    50%+ (low value to test)
  Generated code               0% (don't test generated code)
  Third-party wrappers         Low (test the integration, not wrapper)
```

---

## Using Coverage Reports Effectively

### Finding Important Gaps

```python
def process_payment(amount, method, currency="USD"):
    if amount <= 0:
        raise ValueError("Amount must be positive")     # ░░ UNCOVERED

    if method == "credit_card":
        result = charge_credit_card(amount, currency)
    elif method == "paypal":
        result = charge_paypal(amount, currency)
    elif method == "crypto":
        result = charge_crypto(amount, currency)         # ░░ UNCOVERED
    else:
        raise ValueError(f"Unknown payment method: {method}")  # ░░ UNCOVERED

    if not result.success:
        handle_payment_failure(result)                   # ░░ UNCOVERED
        return {"status": "failed", "error": result.error}  # ░░ UNCOVERED

    return {"status": "success", "transaction_id": result.id}
```

The coverage report shows five uncovered lines. Looking at them:

- **Negative amount**: Important validation — add a test
- **Crypto payment**: Entire code path untested — risky
- **Unknown method**: Error handling — add a test
- **Payment failure**: Critical path — definitely add tests

This is coverage used well: it pointed us to real gaps.

### Coverage in CI

```yaml
# Example CI configuration concept
steps:
  - run: pytest --cov=myproject --cov-fail-under=80
  # CI fails if coverage drops below 80%
  # Prevents adding untested code
```

But be careful: this can incentivize gaming the metric. A better approach
is to fail on coverage *regression* — if new code is less covered than
existing code.

---

## Branch Coverage Deep Dive

```python
def shipping_cost(weight, express, member):
    if weight > 50:
        base = 25.00
    elif weight > 10:
        base = 15.00
    else:
        base = 5.00

    if express:
        base *= 2

    if member:
        base *= 0.8

    return base
```

```
BRANCH COVERAGE ANALYSIS

  Branch 1: weight > 50     (True / False)
  Branch 2: weight > 10     (True / False)
  Branch 3: express          (True / False)
  Branch 4: member           (True / False)

  Minimum tests for full branch coverage:

  test_heavy_express_member:      weight=60, express=T, member=T
  test_medium_standard_nonmember: weight=20, express=F, member=F
  test_light:                     weight=5,  express=F, member=F

  3 tests cover all branches. But do they cover all PATHS?
  No — there are 12 unique paths (3 weight * 2 express * 2 member).
```

---

## Exercises

1. **Measure coverage**: Run coverage on a project you've been working
   with. What's the overall percentage? Which files have the lowest
   coverage? Are those files important?

2. **Coverage vs quality**: Write a test suite that gets 100% line
   coverage on a function but has zero useful assertions. Then write a
   suite with 80% coverage that catches real bugs. Which is better?

3. **Branch analysis**: For a function with 3 if-statements, calculate
   how many tests you need for full branch coverage vs full path
   coverage.

4. **Gap hunting**: Run a coverage report. Find the 3 most important
   uncovered lines (where a bug would hurt most). Write tests for them.

---

[Next: Lesson 13 - Mutation Testing](./13-mutation-testing.md)
