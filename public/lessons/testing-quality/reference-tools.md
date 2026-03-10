# Quick Reference: Testing Tools by Language

> A practical lookup table for testing tools. Find the right tool for
> your language and testing need.

---

## Python

```
CATEGORY              TOOL                 NOTES

Unit testing          pytest               The standard. Use this.
                      unittest             Built-in, more verbose.

Assertions            pytest assert        Enhanced assert with diffs.
                      assertpy             Fluent assertion library.

Mocking               unittest.mock        Built-in. Mock, patch, MagicMock.
                      pytest-mock          Thin wrapper over unittest.mock.
                      responses            Mock HTTP requests.
                      moto                 Mock AWS services.

Fixtures              pytest fixtures      @pytest.fixture, conftest.py.
                      factory_boy          ORM-aware test factories.
                      faker                Generate realistic fake data.

Property-based        hypothesis           Best-in-class PBT for Python.

Snapshot              syrupy               Snapshot testing for pytest.
                      pytest-snapshot      Alternative snapshot plugin.

Coverage              pytest-cov           Coverage plugin for pytest.
                      coverage.py          Underlying coverage library.

Mutation              mutmut               Mutation testing for Python.

Async                 pytest-asyncio       Test async/await code.
                      anyio                Test with multiple async backends.

Performance           pytest-benchmark     Benchmarking within pytest.
                      locust               Load testing framework.

Database              testcontainers       Docker-based test databases.

E2E                   playwright           Browser automation (recommended).
                      selenium             Browser automation (legacy).

Linting               flake8               Style and error checking.
                      mypy                 Static type checking.
                      ruff                 Fast linter and formatter.
```

### Minimal pytest Setup

```
pip install pytest pytest-cov pytest-asyncio

# pytest.ini or pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

# Run
pytest                          # All tests
pytest --cov=myproject          # With coverage
pytest -x                       # Stop on first failure
pytest -k "test_auth"           # Filter by name
```

---

## TypeScript / JavaScript

```
CATEGORY              TOOL                 NOTES

Unit testing          vitest               Fast, Vite-native. Recommended.
                      jest                 Widely used, heavier.
                      node:test            Built-in (Node 18+).

Assertions            vitest expect        Built-in with Vitest.
                      chai                 BDD/TDD assertion library.

Mocking               vi.fn() / vi.mock()  Vitest built-in mocking.
                      jest.fn()            Jest built-in mocking.
                      msw                  Mock Service Worker (HTTP mocks).
                      nock                 HTTP request mocking.

Fixtures              beforeEach/afterEach  Framework built-in.
                      fishery              TypeScript factory library.
                      faker-js             Generate realistic fake data.

Property-based        fast-check           Property-based testing.

Snapshot              toMatchSnapshot()    Built into Vitest/Jest.
                      toMatchInlineSnapshot()  Inline variant.

Coverage              c8 / istanbul        Built into Vitest via v8/istanbul.

Mutation              stryker-mutator      Mutation testing framework.

Async                 async/await          Native support in Vitest/Jest.
                      vi.useFakeTimers()   Control time in tests.

Performance           vitest bench         Built-in benchmarking.
                      k6                   Load testing (JS scripts).
                      autocannon           HTTP benchmarking.

Database              testcontainers       Docker-based test databases.

E2E                   playwright           Browser automation (recommended).
                      cypress              Browser E2E testing.
                      puppeteer            Chrome automation.

Linting               eslint               Linting and style.
                      typescript           Static type checking (tsc).
                      biome                Fast linter + formatter.
```

### Minimal Vitest Setup

```
npm install -D vitest

# vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    globals: true,
    coverage: { provider: 'v8' },
  },
})

# Run
npx vitest              # Watch mode
npx vitest run          # Single run
npx vitest --coverage   # With coverage
npx vitest -t "auth"    # Filter by name
```

---

## Go

```
CATEGORY              TOOL                 NOTES

Unit testing          testing              Built-in. No framework needed.

Assertions            testing              if x != expected { t.Errorf(...) }
                      testify              assert/require/mock packages.
                      is                   Minimalist assertion helper.

Mocking               interfaces + fakes   Idiomatic Go: write your own.
                      gomock               Code generation for mocks.
                      testify/mock         Mock from testify suite.

Fixtures              TestMain             Per-package setup/teardown.
                      t.Cleanup()          Per-test cleanup.

Property-based        rapid                Property-based testing.
                      gopter               Alternative PBT library.

Snapshot              go-snaps             Snapshot testing for Go.
                      cupaloy              Alternative snapshot library.

Coverage              go test -cover       Built-in coverage tool.
                      go tool cover        HTML coverage reports.

Mutation              go-mutesting         Mutation testing for Go.
                      gremlins             Alternative mutation tool.

Async                 channels + select    Test goroutines with channels.
                      context.WithTimeout  Timeout-based testing.

Performance           testing.B            Built-in benchmarking.
                      pprof                Built-in CPU/memory profiling.
                      k6                   Load testing.
                      vegeta               HTTP load testing.

Database              testcontainers-go    Docker-based test databases.

E2E                   net/http/httptest    Built-in HTTP test server.
                      playwright-go        Browser automation.

Linting               go vet               Built-in static analysis.
                      golangci-lint        Meta-linter (runs many linters).
                      staticcheck          Advanced static analysis.
```

### Minimal Go Test Setup

```
# No setup needed! Go has built-in testing.

# File: calculator_test.go
func TestAdd(t *testing.T) {
    result := Add(2, 3)
    if result != 5 {
        t.Errorf("Add(2, 3) = %d, want 5", result)
    }
}

# Run
go test ./...                    # All tests
go test -v ./...                 # Verbose
go test -cover ./...             # With coverage
go test -run TestAdd ./...       # Filter by name
go test -bench=. ./...           # Run benchmarks
go test -race ./...              # Race condition detector
```

---

## Rust

```
CATEGORY              TOOL                 NOTES

Unit testing          #[test]              Built-in. No framework needed.

Assertions            assert! / assert_eq! Built-in macros.
                      pretty_assertions    Better diff output.
                      spectral             Fluent assertions.

Mocking               trait + impl         Idiomatic: manual fakes via traits.
                      mockall              Procedural macro for auto-mocks.
                      mockito              Alternative mock framework.

Fixtures              #[test] fn setup     Each test function is independent.
                      rstest               Parameterized tests, fixtures.
                      test-case            Table-driven test macro.

Property-based        proptest             Property-based testing.
                      quickcheck           Port of Haskell QuickCheck.

Snapshot              insta                Snapshot testing with review CLI.

Coverage              cargo-tarpaulin      Code coverage for Rust.
                      cargo-llvm-cov       LLVM-based coverage.

Mutation              cargo-mutants        Mutation testing.

Async                 #[tokio::test]       Test async functions with Tokio.
                      actix-rt::test       Test with Actix runtime.

Performance           criterion            Statistical benchmarking.
                      divan                Newer benchmarking library.

Database              sqlx (test mode)     SQLx has test transaction support.
                      testcontainers       Docker-based test databases.

E2E                   reqwest              HTTP client for API testing.
                      actix-test           Test server for Actix apps.

Linting               cargo clippy         Built-in linter (highly recommended).
                      cargo fmt            Built-in formatter.
```

### Minimal Rust Test Setup

```rust
// No setup needed! Rust has built-in testing.

// In src/lib.rs or any file:
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }

    #[test]
    #[should_panic(expected = "divide by zero")]
    fn test_divide_by_zero() {
        divide(1, 0);
    }
}

// Run
// cargo test                  # All tests
// cargo test test_add         # Filter by name
// cargo test -- --nocapture   # Show println output
// cargo test -- --test-threads=1  # Run sequentially
```

---

## Cross-Language Tool Comparison

```
NEED                 PYTHON        TYPESCRIPT     GO              RUST

Test runner          pytest        vitest         go test         cargo test
Assertions           assert        expect()       if + t.Errorf   assert_eq!
Mocking              mock          vi.fn()        interfaces      traits
HTTP mocking         responses     msw            httptest        wiremock
Property testing     hypothesis    fast-check     rapid           proptest
Snapshots            syrupy        built-in       go-snaps        insta
Coverage             pytest-cov    v8/istanbul    -cover          tarpaulin
Mutation             mutmut        stryker        go-mutesting    cargo-mutants
Load testing         locust        k6             vegeta          criterion
Browser E2E          playwright    playwright     playwright-go   (use TS/Py)
Containers           testcontainers testcontainers testcontainers  testcontainers
Fake data            faker         faker-js       (write your own) fake
Linter               ruff          eslint         golangci-lint   clippy
Type checker         mypy          tsc            (built-in)      (built-in)
```

---

## Installation Cheat Sheet

### Python

```
pip install pytest pytest-cov pytest-asyncio hypothesis pytest-mock responses faker
```

### TypeScript

```
npm install -D vitest @vitest/coverage-v8 msw fast-check @faker-js/faker
npx playwright install   # For E2E
```

### Go

```
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
# Most Go tools are built-in — no install needed for basic testing
```

### Rust

```
cargo install cargo-tarpaulin cargo-mutants
# Add to Cargo.toml [dev-dependencies]:
# criterion, proptest, insta, mockall, pretty_assertions
```

---

[Back to Roadmap](./00-roadmap.md)
