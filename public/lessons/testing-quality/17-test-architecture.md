# Lesson 17: Test Organization and Architecture

> **The one thing to remember**: A well-organized test suite is like a
> well-organized toolbox — you can find the right tool instantly, each
> tool has its place, and adding new tools is obvious. A messy test
> suite is a junk drawer: everything's in there somewhere, but nobody
> can find anything, and nobody wants to add to the mess.

---

## The Library Analogy

```
A GOOD TEST SUITE IS LIKE A LIBRARY

  Fiction → Alphabetical by author
  Non-Fiction → Organized by subject
  Reference → Quick-access shelf

  Mapped to testing:

  tests/
  ├── unit/          → "Fiction" — self-contained stories
  │                     Fast, isolated, independent
  ├── integration/   → "Non-Fiction" — connected to reality
  │                     Slower, uses real dependencies
  ├── e2e/           → "Reference" — the full picture
  │                     Slow, covers whole journeys
  └── helpers/       → "Librarian's tools" — shared utilities
```

---

## Project Structure Patterns

### Pattern 1: Tests Next to Source (Common in Go, Rust)

```
src/
├── calculator/
│   ├── calculator.go
│   ├── calculator_test.go    ← Test lives next to source
│   ├── parser.go
│   └── parser_test.go
├── auth/
│   ├── auth.go
│   ├── auth_test.go
│   └── token.go
│   └── token_test.go
```

**Pros**: Easy to find tests. Easy to see untested files.
**Cons**: Test files mixed with source. Harder to run only tests.

### Pattern 2: Separate Test Directory (Common in Python, TypeScript)

```
src/
├── calculator.py
├── auth.py
└── models.py

tests/
├── unit/
│   ├── test_calculator.py
│   └── test_auth.py
├── integration/
│   ├── test_api.py
│   └── test_database.py
├── e2e/
│   └── test_checkout_flow.py
├── fixtures/
│   └── sample_data.json
├── factories/
│   ├── user_factory.py
│   └── order_factory.py
└── conftest.py               ← Shared fixtures
```

**Pros**: Clear separation by test type. Easy to run specific levels.
**Cons**: Navigation between source and test takes more effort.

### Pattern 3: Mirror Structure (Common in TypeScript)

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx       ← Test mirrors source location
├── services/
│   ├── auth.ts
│   └── auth.test.ts
├── utils/
│   ├── format.ts
│   └── format.test.ts
└── __tests__/                ← Integration tests
    ├── api.test.ts
    └── setup.ts
```

---

## Naming Conventions

```
NAMING CONVENTIONS BY LANGUAGE

  Python:
    File:   test_calculator.py    (prefix: test_)
    Class:  TestCalculator        (prefix: Test)
    Method: test_add_two_numbers  (prefix: test_)

  TypeScript:
    File:   calculator.test.ts    (suffix: .test.ts)
    Suite:  describe("Calculator")
    Test:   it("adds two numbers")

  Go:
    File:   calculator_test.go    (suffix: _test.go)
    Func:   TestAddTwoNumbers     (prefix: Test)
    Bench:  BenchmarkAdd          (prefix: Benchmark)

  Rust:
    Module: #[cfg(test)] mod tests
    Func:   #[test] fn test_add()
```

### Descriptive Test Names

```
NAMING HIERARCHY

  describe("ShoppingCart")                       ← What class/module
    describe("addItem")                          ← What method
      it("increases item count by one")          ← What behavior
      it("updates total price")
      it("throws when item is out of stock")

  Result when a test fails:
    "ShoppingCart > addItem > throws when item is out of stock"

  You know EXACTLY what's broken without reading the test code.
```

```python
class TestShoppingCart:
    class TestAddItem:
        def test_increases_item_count_by_one(self):
            ...

        def test_updates_total_price(self):
            ...

        def test_raises_when_out_of_stock(self):
            ...
```

---

## Shared Test Utilities

### The conftest.py Pattern (Python)

```python
# tests/conftest.py — available to ALL tests

import pytest

@pytest.fixture
def api_client():
    from myapp import create_app
    app = create_app(testing=True)
    with app.test_client() as client:
        yield client

@pytest.fixture
def db_session():
    from myapp.database import get_session
    session = get_session(":memory:")
    yield session
    session.close()

@pytest.fixture
def sample_user():
    return {"name": "Alice", "email": "alice@example.com", "role": "user"}
```

```python
# tests/integration/conftest.py — only for integration tests

import pytest

@pytest.fixture(scope="module")
def docker_postgres():
    container = start_postgres_container()
    yield container
    container.stop()
```

Fixtures in `conftest.py` are automatically discovered by pytest. No
imports needed in test files.

### Shared Setup in TypeScript

```typescript
// tests/helpers/setup.ts

import { beforeAll, afterAll, beforeEach } from "vitest";

export function setupTestDatabase() {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
    await runMigrations(db);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.exec("BEGIN");
  });

  afterEach(async () => {
    await db.exec("ROLLBACK");
  });

  return () => db;
}

// tests/integration/users.test.ts
import { setupTestDatabase } from "../helpers/setup";

const getDb = setupTestDatabase();

it("creates a user", async () => {
  const db = getDb();
  // test code
});
```

### Go: Test Helpers

```go
// testutil/testutil.go

package testutil

import "testing"

func SetupTestDB(t *testing.T) *sql.DB {
    t.Helper()

    db, err := sql.Open("sqlite3", ":memory:")
    if err != nil {
        t.Fatalf("failed to open test db: %v", err)
    }

    t.Cleanup(func() {
        db.Close()
    })

    RunMigrations(db)
    return db
}

func MakeUser(t *testing.T, db *sql.DB, name string) int64 {
    t.Helper()

    result, err := db.Exec("INSERT INTO users (name) VALUES (?)", name)
    if err != nil {
        t.Fatalf("failed to create user: %v", err)
    }

    id, _ := result.LastInsertId()
    return id
}
```

---

## Test Configuration

### Running Different Test Levels

```
RUNNING TESTS SELECTIVELY

  Python:
    pytest tests/unit           # Only unit tests
    pytest tests/integration    # Only integration tests
    pytest -m "not slow"        # Skip tests marked @pytest.mark.slow
    pytest -k "test_auth"       # Only tests matching "test_auth"

  TypeScript:
    npx vitest run src          # Tests colocated with source
    npx vitest run tests/e2e    # Only E2E tests
    npx vitest --reporter=verbose

  Go:
    go test ./...                        # All tests
    go test -run TestAuth ./auth/...     # Only auth tests
    go test -short ./...                 # Skip tests with t.Skip() in short mode
    go test -tags=integration ./...      # Only integration-tagged tests

  Rust:
    cargo test                           # All tests
    cargo test --lib                     # Only library tests
    cargo test --test integration        # Only integration tests
    cargo test auth                      # Tests matching "auth"
```

### Marking Tests

```python
import pytest

@pytest.mark.slow
def test_complex_migration():
    ...

@pytest.mark.integration
def test_api_endpoint():
    ...

@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("world", "WORLD"),
    ("", ""),
])
def test_uppercase(input, expected):
    assert to_uppercase(input) == expected
```

---

## CI Integration

```
CI PIPELINE STRUCTURE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Stage 1: FAST CHECKS (1-2 minutes)                 │
  │  ├── Linting (ESLint, Clippy, flake8)               │
  │  ├── Type checking (TypeScript, mypy)                │
  │  └── Unit tests                                      │
  │                                                      │
  │  Stage 2: INTEGRATION (3-5 minutes)                  │
  │  ├── Start test databases (Docker)                   │
  │  ├── Run migrations                                  │
  │  └── Integration tests                               │
  │                                                      │
  │  Stage 3: E2E (5-15 minutes)                         │
  │  ├── Build the application                           │
  │  ├── Start the full stack                            │
  │  └── E2E tests (Playwright)                          │
  │                                                      │
  │  Stage 4: QUALITY GATES                              │
  │  ├── Coverage report (fail if < threshold)           │
  │  └── Performance benchmarks (fail if regression)     │
  │                                                      │
  └──────────────────────────────────────────────────────┘

  Fast feedback first. Expensive tests only if fast tests pass.
```

### Example CI Configuration (Concept)

```yaml
steps:
  - name: Lint and Type Check
    run: |
      npm run lint
      npm run typecheck

  - name: Unit Tests
    run: npm run test:unit -- --coverage

  - name: Integration Tests
    services:
      postgres:
        image: postgres:16
    run: npm run test:integration

  - name: E2E Tests
    run: |
      npm run build
      npm run test:e2e

  - name: Check Coverage
    run: |
      npx vitest --coverage --reporter=json
      # Fail if coverage decreased
```

---

## Test Suite Health

```
SIGNS OF A HEALTHY TEST SUITE

  ✓ Tests run in < 5 minutes locally
  ✓ Tests run in < 15 minutes in CI
  ✓ No flaky tests (or flaky tests are quarantined)
  ✓ Developers run tests before pushing
  ✓ Test failures block merging
  ✓ New features come with new tests
  ✓ Bug fixes come with regression tests

SIGNS OF AN UNHEALTHY TEST SUITE

  ✗ Tests take > 30 minutes
  ✗ "Just re-run CI" is a common phrase
  ✗ Developers skip tests locally
  ✗ Tests are disabled or commented out
  ✗ Nobody knows what half the tests check
  ✗ Adding a test is harder than the feature it tests
```

### Quarantining Flaky Tests

```
FLAKY TEST STRATEGY

  1. Detect: Track tests that fail intermittently
  2. Quarantine: Move to a "flaky" suite that doesn't block PRs
  3. Fix: Prioritize fixing quarantined tests
  4. Restore: Move fixed tests back to the main suite

  Never: Ignore flaky tests (they erode trust)
  Never: Delete flaky tests without understanding why
  Never: Let quarantine grow indefinitely
```

---

## Exercises

1. **Reorganize**: Take a project with a flat test directory. Reorganize
   it into unit/, integration/, and e2e/ directories. Update your test
   runner configuration.

2. **Naming audit**: Review your test names. Can someone understand what
   each test checks without reading the code? Rename unclear tests.

3. **CI pipeline**: Design a CI pipeline for a project with unit,
   integration, and E2E tests. What runs first? What can run in
   parallel? What's the expected total time?

4. **Shared utilities**: Identify duplicated setup code across your
   tests. Extract it into a shared helper module or conftest.py.

---

[Next: Lesson 18 - Build a Complete Test Suite](./18-build-test-suite.md)
