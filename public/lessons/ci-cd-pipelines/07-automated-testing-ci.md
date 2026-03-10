# Lesson 07: Automated Testing in CI

> **The one thing to remember**: Running tests in CI is like having a
> health inspector visit your restaurant every single day — not once a
> year when you're prepared, but every day, automatically. Problems get
> caught while they're small, not after 100 customers get food
> poisoning.

---

## The Health Inspector Analogy

```
MANUAL TESTING (Annual Health Inspection)

  Day 1-364: Cook however you want
  Day 365:   Inspector shows up
             Finds 47 violations
             Kitchen shut down for a week
             Costs $10,000 to fix everything

AUTOMATED TESTING IN CI (Daily Health Inspection)

  Every day:  Inspector checks automatically
              Finds 1 violation immediately
              Fix it in 10 minutes
              Never accumulates problems
              Kitchen never shuts down
```

The earlier you find a bug, the cheaper it is to fix. Automated tests
in CI are your earliest possible safety net after the code leaves
your editor.

---

## The Testing Pyramid in CI

Not all tests are equal. They vary in speed, scope, and reliability:

```
THE TESTING PYRAMID

                    /\
                   /  \
                  / E2E \          Slow, expensive, fragile
                 / Tests \         (5-30 min, browser automation)
                /----------\
               / Integration \     Medium speed, moderate scope
              /    Tests      \    (2-10 min, real DB/API calls)
             /----------------\
            /    Unit Tests     \   Fast, cheap, reliable
           /                    \  (seconds, pure logic)
          /______________________\

  QUANTITY:    Few ←──────────────→ Many
  SPEED:       Slow ←─────────────→ Fast
  COST:        Expensive ←────────→ Cheap
  RELIABILITY: Fragile ←──────────→ Stable
```

In CI, run them in this order: fast tests first, slow tests last.
If unit tests fail, there's no point waiting 30 minutes for E2E tests.

```
CI PIPELINE TEST ORDER

  Push code
      |
      v
  +-----------+
  | Unit Tests |  Fast (10 sec). Fail early.
  +-----------+
      | pass
      v
  +-----------+
  | Integration|  Medium (3 min). Test connections.
  |   Tests    |
  +-----------+
      | pass
      v
  +-----------+
  | E2E Tests  |  Slow (15 min). Test real user flows.
  +-----------+
      | pass
      v
  Ready to deploy
```

---

## Running Tests in GitHub Actions

### Basic Test Job

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

### Tests with a Database

Many integration tests need a real database. GitHub Actions supports
**service containers**:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379
```

```
SERVICE CONTAINERS IN CI

  Runner VM
  +------------------------------------------------+
  |                                                |
  |  Your job steps                                |
  |  (checkout, install, test)                     |
  |       |           |                            |
  |       | port 5432 | port 6379                  |
  |       v           v                            |
  |  +-----------+ +-----------+                   |
  |  | PostgreSQL | |   Redis   |                  |
  |  | container  | | container |                  |
  |  +-----------+ +-----------+                   |
  |                                                |
  +------------------------------------------------+

  Containers start before your steps run.
  Containers are destroyed when the job ends.
```

---

## Test Parallelization

Running tests sequentially is slow. Split them across parallel jobs:

### Strategy 1: Split by Test Type

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration
```

### Strategy 2: Shard Tests Across Runners

Split your test suite across N machines:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx vitest --shard=${{ matrix.shard }}/4
```

```
TEST SHARDING (4 shards)

  Total: 400 tests, ~4 minutes sequential

  Shard 1: Tests 1-100    ──┐
  Shard 2: Tests 101-200  ──┼── All run in PARALLEL
  Shard 3: Tests 201-300  ──┤
  Shard 4: Tests 301-400  ──┘

  Time: ~1 minute (4x faster!)
```

### Strategy 3: Jest with Shard Support

```yaml
- run: npx jest --shard=${{ matrix.shard }}/${{ strategy.job-total }}
```

---

## Flaky Test Detection

A flaky test is one that sometimes passes and sometimes fails with the
same code. Flaky tests are CI's worst enemy — they destroy trust.

```
THE FLAKY TEST PROBLEM

  Run 1: ✓ pass    "Code is good!"
  Run 2: ✗ fail    "Something broke!"
  Run 3: ✓ pass    "Wait, it's fine?"
  Run 4: ✗ fail    "Ugh, just re-run it"
  Run 5: ✓ pass    "See? It passes!"

  Result: Team stops trusting CI.
          Starts ignoring failures.
          Real bugs slip through.
```

**Common causes of flaky tests:**

```
FLAKY TEST CAUSES AND FIXES

  Cause                          Fix
  ----------------------------------------------------------
  Test depends on timing         Use retries with backoff,
  (setTimeout, API latency)      mock time, increase timeouts

  Test depends on order           Run tests in random order,
  (shared global state)           isolate state per test

  Test depends on external        Mock external services,
  service (API, database)         use test containers

  Race condition in async code    Await properly, use
                                  deterministic event ordering

  Date/time dependent             Mock Date.now(), use
  ("fails on Mondays")            fixed timestamps in tests
```

**Detecting flaky tests in CI:**

```yaml
- name: Run tests with retry
  uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: npm test
```

Better approach — quarantine known flaky tests:

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    retry: 2,
    reporters: ['default', 'json'],
    outputFile: 'test-results.json',
  },
});
```

Track tests that needed retries. If a test is retried more than 3
times in a week, quarantine it: move it to a separate test suite
that doesn't block merges, and fix it.

---

## Test Reporting

Raw test output in CI logs is hard to read. Test reporters make results
visible in PRs:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      - name: Run tests
        run: npx vitest --reporter=junit --outputFile=test-results.xml

      - name: Publish test results
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Test Results
          path: test-results.xml
          reporter: java-junit
```

### Code Coverage

```yaml
      - name: Run tests with coverage
        run: npx vitest --coverage --coverage.reporter=text --coverage.reporter=lcov

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
```

```
COVERAGE REPORT EXAMPLE

  File                  | Stmts | Branch | Funcs | Lines
  ---------------------------------------------------------
  src/auth/login.ts     | 95%   | 88%    | 100%  | 95%
  src/auth/register.ts  | 87%   | 75%    | 90%   | 87%
  src/utils/validate.ts | 100%  | 100%   | 100%  | 100%
  src/api/orders.ts     | 42%   | 30%    | 50%   | 42%   ← needs work
  ---------------------------------------------------------
  Total                 | 81%   | 73%    | 85%   | 81%
```

### Enforcing Coverage Thresholds

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

If coverage drops below the threshold, the CI job fails:

```
COVERAGE GATE

  Developer adds new code without tests
       |
       v
  Coverage drops from 82% to 78%
       |
       v
  CI fails: "Coverage below 80% threshold"
       |
       v
  Developer adds tests
       |
       v
  Coverage back to 83%
       |
       v
  CI passes
```

---

## A Complete Testing Pipeline

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  unit:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx vitest run --reporter=junit --outputFile=results.xml
      - uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Unit Test Results
          path: results.xml
          reporter: java-junit

  integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx vitest run --config vitest.integration.config.ts
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/postgres

  coverage:
    name: Coverage Check
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx vitest run --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

---

## Exercises

1. **Add tests to CI**: Take any project with tests. Create a GitHub
   Actions workflow that runs them on every push. Verify it catches
   a deliberately broken test.

2. **Add a service container**: Create a workflow that starts a
   PostgreSQL container and runs integration tests against it.

3. **Try test sharding**: If your test suite takes more than 30
   seconds, split it across 2 or 4 shards. Measure the speedup.

4. **Add coverage**: Set up code coverage reporting. Set a threshold
   of 80%. Remove a test file and verify CI fails due to low coverage.

5. **Find a flaky test**: Write a test that depends on `Date.now()`.
   Run it 10 times. Does it always pass? Fix it by mocking the date.

---

[Next: Lesson 08 — Linting & Quality Gates](./08-linting-quality-gates.md)
