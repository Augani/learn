# Lesson 13: Mutation Testing

> **The one thing to remember**: Mutation testing answers the question
> "Are my tests actually catching bugs?" It works by deliberately
> introducing small bugs (mutations) into your code, then checking if
> your tests catch them. If a test suite lets a bug survive, those tests
> are weaker than they appear.

---

## The Proofreader Test Analogy

Imagine you've hired a proofreader to check your essay. How do you know
if they're any good? Deliberately insert typos and see if they catch
them:

```
TESTING THE PROOFREADER

  Original:  "The cat sat on the mat."
  Mutation 1: "The cat sat on the bat."    Proofreader caught it? ✓
  Mutation 2: "The cat sat in the mat."    Proofreader caught it? ✓
  Mutation 3: "The cat sit on the mat."    Proofreader caught it? ✗ MISSED!

  The proofreader missed mutation 3.
  Your proofreader is 66% effective (2 out of 3 caught).

  Mutation testing does this to your TEST SUITE.
  It introduces bugs into your CODE and checks if TESTS catch them.
```

---

## How Mutation Testing Works

```
MUTATION TESTING PROCESS

  Step 1: Take your original code
    def add(a, b):
        return a + b

  Step 2: Create MUTANTS (versions with small changes)
    Mutant 1: return a - b      (changed + to -)
    Mutant 2: return a * b      (changed + to *)
    Mutant 3: return a + 0      (replaced b with 0)
    Mutant 4: return 0           (replaced everything with 0)

  Step 3: Run your tests against EACH mutant
    Mutant 1: tests FAIL → mutant KILLED ✓ (tests caught it)
    Mutant 2: tests FAIL → mutant KILLED ✓
    Mutant 3: tests FAIL → mutant KILLED ✓
    Mutant 4: tests PASS → mutant SURVIVED ✗ (tests missed it!)

  Step 4: Calculate mutation score
    Killed: 3, Survived: 1, Total: 4
    Mutation score: 75%

  A surviving mutant means your tests have a blind spot.
```

```
MUTATION TESTING FLOW

  ┌──────────────┐
  │ Source Code   │──── Create mutants ────┐
  └──────────────┘                         │
                                    ┌──────┴──────┐
                                    │  Mutant 1    │
                                    │  Mutant 2    │
                                    │  Mutant 3    │
                                    │  ...         │
                                    └──────┬──────┘
                                           │
                              Run tests against each
                                           │
                                    ┌──────┴──────┐
                                    │  Killed? ✓   │ Tests caught bug
                                    │  Survived? ✗ │ Tests missed bug
                                    └─────────────┘
```

---

## Types of Mutations

Mutation tools apply these common operators:

```
MUTATION OPERATORS

  OPERATOR               ORIGINAL    MUTANT
  ───────────────────────────────────────────────
  Arithmetic             a + b       a - b
                         a * b       a / b

  Comparison             a > b       a >= b
                         a == b      a != b
                         a < b       a <= b

  Boolean                a and b     a or b
                         not x       x
                         True        False

  Return values          return x    return None
                         return x    return 0
                         return x    return ""

  Conditional            if x > 0    if True
  boundary               if x > 0    if x >= 0

  Negate                 x           -x
                         +x          -x

  Remove                 statement   (deleted)
  statement              x = 1       (line removed)
```

### Why These Mutations Matter

```python
def is_adult(age):
    return age >= 18

# Mutant: return age > 18  (changed >= to >)
# If no test checks age=18 specifically, this mutant SURVIVES.
# That means you have an off-by-one blind spot!

def test_adult():
    assert is_adult(25) == True
    assert is_adult(10) == False

# These tests PASS for both >= 18 and > 18.
# The boundary (age=18) is never tested.
# Mutation testing reveals this weakness.

def test_adult_boundary():
    assert is_adult(18) == True    # THIS kills the mutant
    assert is_adult(17) == False   # Extra safety
```

---

## Tools by Language

### Python: mutmut

```
$ pip install mutmut
$ mutmut run --paths-to-mutate=myproject/

── mutmut results ──
Survived: 12
Killed: 88
Total: 100
Mutation score: 88%

$ mutmut results

Survived mutants:
  myproject/calculator.py line 15: changed + to -
  myproject/validator.py line 28: changed >= to >
  myproject/validator.py line 42: removed statement

$ mutmut show 3
--- a/myproject/validator.py
+++ b/myproject/validator.py
@@ -28 @@
-    if len(password) >= 8:
+    if len(password) > 8:
```

This tells you: no test checks a password of exactly 8 characters.

### TypeScript: Stryker

```
$ npx stryker init
$ npx stryker run

  All tests
    ✓ Killed:   145
    ✗ Survived: 23
    ◌ No Coverage: 5
    ◑ Timeout:  2

  Mutation score: 82.86%
  Score based on covered code: 86.31%
```

Stryker generates an HTML report showing each surviving mutant in
context, making it easy to see what tests you need to add.

### Rust: cargo-mutants

```
$ cargo install cargo-mutants
$ cargo mutants

Found 87 mutants to test
  67 caught (killed)
  15 missed (survived)
  5 unviable (compile error)

Missed mutants:
  src/lib.rs:42 replace > with >=
  src/lib.rs:67 replace + with -
```

---

## Interpreting Results

```
WHAT SURVIVING MUTANTS TELL YOU

  Survived: changed + to -
    → Your tests don't verify the arithmetic operation

  Survived: changed > to >=
    → Your tests don't test boundary values

  Survived: removed return statement
    → Return value isn't checked (assertion missing?)

  Survived: changed True to False
    → Boolean logic path isn't tested

  Survived: removed function call
    → Side effect isn't verified
```

### Not All Survivors Are Problems

```
EQUIVALENT MUTANTS (false alarms)

  Original:    x = x + 0
  Mutant:      x = x - 0
  These are identical — the mutant can never be killed.

  Original:    if items:          (truthy check)
  Mutant:      if len(items) > 0  (explicit check)
  Semantically equivalent in most languages.

  Equivalent mutants inflate the "survived" count.
  Ignore them — focus on the genuine blind spots.
```

---

## A Complete Example

```python
def calculate_shipping(weight, distance, is_express):
    if weight <= 0 or distance <= 0:
        raise ValueError("Weight and distance must be positive")

    base_rate = 5.00
    weight_charge = weight * 0.50
    distance_charge = distance * 0.10

    total = base_rate + weight_charge + distance_charge

    if is_express:
        total *= 1.5

    if total > 50.00:
        total = 50.00

    return round(total, 2)

def test_basic_shipping():
    assert calculate_shipping(10, 100, False) == 20.0

def test_express_shipping():
    assert calculate_shipping(10, 100, True) == 30.0

def test_invalid_weight():
    with pytest.raises(ValueError):
        calculate_shipping(-1, 100, False)
```

Running mutation testing reveals:

```
SURVIVING MUTANTS:

  1. Changed distance <= 0 to distance < 0
     → No test for distance=0 specifically

  2. Changed total > 50.00 to total >= 50.00
     → No test for total exactly $50.00

  3. Changed 50.00 cap to 0
     → No test hits the cap at all

  4. Removed round(total, 2)
     → No test produces a result needing rounding
```

Adding tests to kill these mutants:

```python
def test_zero_distance_raises():
    with pytest.raises(ValueError):
        calculate_shipping(10, 0, False)

def test_shipping_cap():
    result = calculate_shipping(100, 500, False)
    assert result == 50.00

def test_exactly_at_cap():
    cost = calculate_shipping(40, 100, False)
    assert cost <= 50.00

def test_rounding():
    result = calculate_shipping(3, 7, False)
    assert result == round(result, 2)
```

---

## Mutation Testing vs Code Coverage

```
COMPARISON

  CODE COVERAGE                    MUTATION TESTING
  ─────────────────────────────────────────────────────
  "Did my tests run this line?"    "Did my tests VERIFY this line?"
  Fast to compute                  Slow (runs tests many times)
  Cheap metric                     Expensive metric
  Can be gamed easily              Very hard to game
  Measures effort                  Measures effectiveness

  Coverage: 100% is possible with zero assertions
  Mutation score: 100% means every line matters to a test

  Use coverage to find UNTESTED code.
  Use mutation testing to find POORLY tested code.
```

---

## Practical Considerations

```
MUTATION TESTING TRADEOFFS

  BENEFITS:
    ✓ Finds weak tests that give false confidence
    ✓ Reveals missing boundary tests
    ✓ Impossible to game (unlike coverage)
    ✓ Teaches you to write better tests

  CHALLENGES:
    ✗ Slow: runs full test suite per mutant
      100 mutants × 30s test suite = 50 minutes
    ✗ Noisy: equivalent mutants create false positives
    ✗ Resource-intensive: CPU and memory heavy
    ✗ Not practical to run on every commit

  PRACTICAL APPROACH:
    - Run mutation testing weekly or before releases
    - Focus on critical business logic, not all code
    - Use it as a learning tool, not a gate
    - Set a mutation score FLOOR, not a ceiling
```

---

## Exercises

1. **Manual mutations**: Take a function with tests. Manually change
   one operator (+ to -, > to >=, etc.) and run the tests. Did they
   catch it? Try 5 different mutations.

2. **Run a tool**: Install mutmut (Python) or Stryker (TypeScript) on a
   project. Run it and analyze the surviving mutants. Write tests to
   kill at least 3 survivors.

3. **Boundary analysis**: Write a function with at least 2 comparison
   operators. Write tests. Then run mutation testing. Did your tests
   catch all boundary mutations?

4. **Coverage vs mutation**: Find a function with 100% line coverage.
   Run mutation testing. What's the mutation score? The gap between
   these numbers shows how much your tests miss despite full coverage.

---

[Next: Lesson 14 - Testing Async Code](./14-testing-async.md)
