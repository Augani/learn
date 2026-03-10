# Lesson 02: The Testing Pyramid

> **The one thing to remember**: The testing pyramid is a recipe for how
> many of each type of test to write. Lots of small, fast unit tests at
> the bottom. Fewer integration tests in the middle. A handful of
> end-to-end tests at the top. Like a pyramid — wide at the base,
> narrow at the peak.

---

## The Restaurant Analogy

Imagine you run a restaurant and you want to make sure every meal is
good. You have three ways to check quality:

```
TESTING AT A RESTAURANT

  Taste each ingredient (UNIT TEST)
    → "Is this tomato fresh? Is the salt right?"
    → Fast, cheap, catches most problems
    → But doesn't tell you if the whole dish works together

  Taste the combined dish (INTEGRATION TEST)
    → "Does the sauce work with the pasta?"
    → Takes more effort, but catches combination problems
    → Still done in the kitchen, before the customer sees it

  Have a customer eat the full meal (END-TO-END TEST)
    → "Did they enjoy the appetizer, main, dessert, and service?"
    → Tests the whole experience
    → Slow, expensive, hard to control
    → But it's the ultimate test of whether everything works
```

You wouldn't *only* taste the final meal (too late to fix problems).
You wouldn't *only* taste each ingredient (misses how things combine).
You need all three, but in different proportions.

---

## The Pyramid

```
THE TESTING PYRAMID

                    /\
                   /  \
                  / E2E \        Few:    Slow, expensive, brittle
                 /  Tests \      5-10%   Test full user journeys
                /----------\
               /            \
              / Integration  \   Some:   Medium speed, medium cost
             /    Tests       \  15-25%  Test components working together
            /------------------\
           /                    \
          /     Unit Tests       \  Most:  Fast, cheap, reliable
         /                        \ 60-80% Test individual functions
        /__________________________\

  SPEED:      Fast ←————————————————→ Slow
  COST:       Cheap ←———————————————→ Expensive
  QUANTITY:   Many ←————————————————→ Few
  CONFIDENCE: Low (isolated) ←——————→ High (realistic)
```

### Why This Shape?

Each level has tradeoffs:

```
TEST TYPE        SPEED      COST     RELIABILITY   COVERAGE

Unit             ~1ms       Low      Very stable   Single function
Integration      ~100ms     Medium   Mostly stable Components together
End-to-End       ~10s       High     Often flaky   Full user flow
```

If you flip the pyramid upside down (mostly E2E tests), you get:

```
THE ICE CREAM CONE ANTIPATTERN (Don't do this!)

        ____________________________
       /                            \
      /     Tons of E2E Tests        \    Slow CI: 2 hours
     /  (Cypress/Playwright scripts)  \   Flaky: 30% random failures
    /----------------------------------\  Hard to debug: "something broke"
     \            /
      \ Few unit \     Fast but shallow
       \ tests  /      Miss obvious bugs at the unit level
        \------/

  Result: Slow builds, flaky tests, developers ignore failures
```

---

## Unit Tests: The Foundation

A unit test checks one small piece of code in isolation.

```python
def calculate_discount(price, percentage):
    if price < 0:
        raise ValueError("Price cannot be negative")
    if not 0 <= percentage <= 100:
        raise ValueError("Percentage must be 0-100")
    return price * (percentage / 100)

def test_basic_discount():
    assert calculate_discount(100, 10) == 10.0

def test_zero_discount():
    assert calculate_discount(100, 0) == 0.0

def test_full_discount():
    assert calculate_discount(100, 100) == 100.0

def test_negative_price_raises():
    try:
        calculate_discount(-50, 10)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
```

**Characteristics of unit tests**:
- Test one function or method
- No database, no network, no file system
- Run in milliseconds
- Easy to understand what failed and why

---

## Integration Tests: The Middle Layer

Integration tests verify that multiple components work together. The key
word is "together" — you're testing the *seams* between pieces.

```
WHAT INTEGRATION TESTS CHECK

  Unit tests say:                    Integration tests say:
  "The engine works"                 "The engine connects to the
  "The transmission works"            transmission correctly"
  "The wheels spin"                  "Power flows from engine to wheels"

  Unit: each piece in isolation      Integration: pieces connected
```

Example — testing that your code actually talks to a database correctly:

```python
import sqlite3

class UserRepository:
    def __init__(self, db_path):
        self.conn = sqlite3.connect(db_path)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"
        )

    def create_user(self, name, email):
        cursor = self.conn.execute(
            "INSERT INTO users (name, email) VALUES (?, ?)", (name, email)
        )
        self.conn.commit()
        return cursor.lastrowid

    def get_user(self, user_id):
        row = self.conn.execute(
            "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if row is None:
            return None
        return {"id": row[0], "name": row[1], "email": row[2]}

def test_create_and_retrieve_user():
    repo = UserRepository(":memory:")
    user_id = repo.create_user("Alice", "alice@example.com")
    user = repo.get_user(user_id)

    assert user is not None
    assert user["name"] == "Alice"
    assert user["email"] == "alice@example.com"

def test_get_nonexistent_user():
    repo = UserRepository(":memory:")
    user = repo.get_user(999)
    assert user is None
```

This isn't a unit test because it uses a real database (SQLite). It's
testing that your SQL queries, your Python code, and the database all
work together.

---

## End-to-End Tests: The Top Layer

E2E tests simulate a real user interacting with your complete system.

```
E2E TEST: USER BUYS A PRODUCT

  1. Open browser
  2. Navigate to homepage
  3. Search for "wireless headphones"
  4. Click first result
  5. Click "Add to Cart"
  6. Click "Checkout"
  7. Fill in shipping info
  8. Click "Place Order"
  9. Verify "Order Confirmed" page appears
  10. Verify confirmation email is sent

  Time: 30-60 seconds
  Things that can break: browser rendering, JavaScript, API calls,
    database, payment gateway, email service, network latency...
```

In TypeScript with a testing library:

```typescript
test("user can search and add item to cart", async () => {
  await page.goto("https://mystore.example.com");
  await page.fill('[data-testid="search-input"]', "wireless headphones");
  await page.click('[data-testid="search-button"]');

  await page.waitForSelector('[data-testid="product-card"]');
  await page.click('[data-testid="product-card"]:first-child');

  await page.click('[data-testid="add-to-cart"]');

  const cartCount = await page.textContent('[data-testid="cart-count"]');
  expect(cartCount).toBe("1");
});
```

**E2E tests are valuable but expensive**:
- Slow to run (seconds to minutes each)
- Flaky (network issues, timing problems)
- Hard to debug (which of the 47 components broke?)
- Expensive to maintain (UI changes break tests)

---

## The Trophy Model: An Alternative View

Kent C. Dodds proposed the **Testing Trophy** as an alternative to the
pyramid, arguing that integration tests give the best return on
investment:

```
THE TESTING TROPHY

            _____
           / E2E \           A few: critical user paths
          |_______|
         /         \
        / Integration\       Most: test components together
       /   Tests      \      Best balance of speed + confidence
      |________________|
       \   Unit Tests /      Some: complex logic, edge cases
        \____________/
          |  Static |        Always: TypeScript, ESLint, etc.
          |  Types  |
          |_________|

  Static analysis catches typos and type errors for FREE.
  Integration tests catch the most real bugs per dollar spent.
  Unit tests handle complex business logic.
  E2E tests verify critical paths work.
```

The trophy model emphasizes:
- **Static analysis** (types, linting) catches bugs before tests run
- **Integration tests** provide the most value for web applications
- **Unit tests** are best for pure business logic
- **E2E tests** only for critical happy paths

---

## Choosing Your Mix

There's no single right answer. The mix depends on your project:

```
PROJECT TYPE              RECOMMENDED MIX

Pure library/algorithm    80% unit, 15% integration, 5% E2E
Web API/backend           40% unit, 40% integration, 20% E2E
Frontend web app          30% unit, 50% integration, 20% E2E
CLI tool                  60% unit, 30% integration, 10% E2E
Embedded/safety-critical  70% unit, 20% integration, 10% E2E + formal verification
```

### The Key Principle

**Write tests at the lowest level that gives you confidence.**

If a unit test can catch the bug, don't write an E2E test for it.
If only an integration test can catch the bug (like a wrong SQL query),
don't try to unit test it with mocks.

```
CHOOSING THE RIGHT TEST LEVEL

  "Does my math function compute correctly?"
    → Unit test

  "Does my API endpoint return the right data from the database?"
    → Integration test

  "Can a user sign up, log in, and place an order?"
    → End-to-end test

  "Is this variable the right type?"
    → Static analysis (TypeScript, mypy, etc.)
```

---

## Speed Matters

Here's why the pyramid shape matters for developer productivity:

```
TEST SUITE EXECUTION TIME

  100 unit tests      × 5ms each   = 0.5 seconds    :)
  50 integration tests × 200ms each = 10 seconds     :|
  20 E2E tests        × 30s each   = 10 minutes      :(

  Total: ~10.5 minutes

  If you flip the pyramid (100 E2E tests):
  100 E2E tests       × 30s each   = 50 minutes      >:(

  Developers stop running tests. Bugs sneak through.
  The test suite becomes "that thing CI runs overnight."
```

Fast tests get run. Slow tests get skipped. A test that nobody runs
catches zero bugs.

---

## Exercises

1. **Classify tests**: For each scenario, decide if you'd write a unit,
   integration, or E2E test:
   - Checking that a sort function works correctly
   - Verifying that a REST API stores data in the database
   - Confirming that a user can complete a checkout flow
   - Testing that a date formatting function handles timezones

2. **Design a test mix**: You're building a to-do app with a React
   frontend, a Node.js API, and a PostgreSQL database. List 5 tests at
   each level of the pyramid.

3. **Speed analysis**: Your CI pipeline runs 500 tests and takes 45
   minutes. You discover 400 of those are E2E tests. How would you
   restructure the test suite to bring CI under 5 minutes while
   maintaining confidence?

4. **Draw your own pyramid**: For a project you've worked on (or want to
   build), sketch out the testing pyramid with specific test examples at
   each level.

---

[Next: Lesson 03 - Unit Testing Fundamentals](./03-unit-testing.md)
