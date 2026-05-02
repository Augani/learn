# Lesson 11: Testing

## Testing Is Built In

Go's testing story is simple: `_test.go` files, the `testing`
package, and `go test`. No external framework required.

Think of testing like a quality control line at a factory. Each
test is an inspector checking one thing. Table-driven tests are
like a checklist the inspector runs through.

```
Rust:                        Go:
#[test]                      func TestXxx(t *testing.T)
fn test_add() { ... }        _test.go files
cargo test                   go test ./...
```

---

## Your First Test

```go
package math

func Add(a, b int) int {
    return a + b
}

func Multiply(a, b int) int {
    return a * b
}
```

```go
package math

import "testing"

func TestAdd(t *testing.T) {
    result := Add(2, 3)
    if result != 5 {
        t.Errorf("Add(2, 3) = %d, want 5", result)
    }
}

func TestMultiply(t *testing.T) {
    result := Multiply(3, 4)
    if result != 12 {
        t.Errorf("Multiply(3, 4) = %d, want 12", result)
    }
}
```

```bash
go test -v ./...
```

Rules:
- File must end in `_test.go`
- Function must start with `Test`
- Takes `*testing.T` as parameter
- Same package or `_test` suffix package

---

## Table-Driven Tests

The idiomatic Go testing pattern. Instead of writing separate test
functions, define a table of inputs and expected outputs:

```go
package math

import "testing"

func TestAdd_Table(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive numbers", 2, 3, 5},
        {"negative numbers", -1, -2, -3},
        {"zero", 0, 0, 0},
        {"mixed signs", -5, 10, 5},
        {"large numbers", 1000000, 2000000, 3000000},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := Add(tt.a, tt.b)
            if result != tt.expected {
                t.Errorf("Add(%d, %d) = %d, want %d", tt.a, tt.b, result, tt.expected)
            }
        })
    }
}
```

```
Table-driven test structure:

+--------+------+------+----------+
| Name   | In A | In B | Expected |
+--------+------+------+----------+
| pos    |  2   |  3   |    5     |
| neg    | -1   | -2   |   -3     |
| zero   |  0   |  0   |    0     |
| mixed  | -5   | 10   |    5     |
+--------+------+------+----------+
          |
          v
   for _, tt := range tests {
       t.Run(tt.name, func(t *testing.T) { ... })
   }
```

`t.Run` creates subtests — you can run individual cases:

```bash
go test -run TestAdd_Table/positive
```

---

## Testing Errors

```go
package validator

import (
    "errors"
    "testing"
)

var ErrEmpty = errors.New("empty input")

func Validate(s string) error {
    if s == "" {
        return ErrEmpty
    }
    return nil
}

func TestValidate(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr error
    }{
        {"valid input", "hello", nil},
        {"empty input", "", ErrEmpty},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := Validate(tt.input)
            if !errors.Is(err, tt.wantErr) {
                t.Errorf("Validate(%q) error = %v, want %v", tt.input, err, tt.wantErr)
            }
        })
    }
}
```

---

## Test Helpers

```go
package server

import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func setupTestServer(t *testing.T) *httptest.Server {
    t.Helper()
    mux := http.NewServeMux()
    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("ok"))
    })
    return httptest.NewServer(mux)
}

func TestHealthEndpoint(t *testing.T) {
    srv := setupTestServer(t)
    defer srv.Close()

    resp, err := http.Get(srv.URL + "/health")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusOK)
    }
}
```

`t.Helper()` marks a function as a test helper — error messages
point to the caller, not the helper.

`t.Fatal` stops the test immediately. `t.Error` records a failure
but continues.

```
+-------------------+----------------------------+
| Method            | Behavior                   |
+-------------------+----------------------------+
| t.Error/Errorf    | Record failure, continue   |
| t.Fatal/Fatalf    | Record failure, STOP test  |
| t.Skip/Skipf      | Skip this test             |
| t.Helper()        | Mark as helper function    |
| t.Parallel()      | Run test in parallel       |
| t.Cleanup(fn)     | Run fn when test finishes  |
+-------------------+----------------------------+
```

---

## Benchmarks

```go
package math

import "testing"

func BenchmarkAdd(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Add(42, 58)
    }
}

func BenchmarkMultiply(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Multiply(42, 58)
    }
}
```

```bash
go test -bench=. -benchmem ./...
```

Output:

```
BenchmarkAdd-8         1000000000    0.2900 ns/op    0 B/op    0 allocs/op
BenchmarkMultiply-8    1000000000    0.2800 ns/op    0 B/op    0 allocs/op
```

`b.N` is automatically adjusted by the framework to get stable
measurements.

---

## Fuzzing

Go 1.18 added built-in fuzzing. The fuzzer generates random inputs
to find edge cases:

```go
package validator

import "testing"

func FuzzValidate(f *testing.F) {
    f.Add("hello")
    f.Add("")
    f.Add("a")

    f.Fuzz(func(t *testing.T, input string) {
        err := Validate(input)
        if input == "" && err == nil {
            t.Error("expected error for empty input")
        }
        if input != "" && err != nil {
            t.Errorf("unexpected error for %q: %v", input, err)
        }
    })
}
```

```bash
go test -fuzz=FuzzValidate -fuzztime=10s
```

In Rust, you'd use `cargo-fuzz`. Go has it built in.

---

## Testify (Popular Testing Library)

```go
package math

import (
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestWithTestify(t *testing.T) {
    assert.Equal(t, 5, Add(2, 3))
    assert.NotEqual(t, 0, Add(1, 1))
    assert.True(t, Add(1, 1) > 0)

    result := Add(2, 3)
    require.Equal(t, 5, result)
}
```

`assert` records failures and continues. `require` stops the test.
Like `t.Error` vs `t.Fatal`.

---

## Test Organization

```
myapp/
  user/
    user.go
    user_test.go           <-- same package tests
    user_integration_test.go
  server/
    server.go
    server_test.go
  testdata/                <-- special directory
    fixture.json           <-- ignored by go build
    golden.txt
```

### Build Tags for Integration Tests

```go
//go:build integration

package store

import "testing"

func TestDatabaseConnection(t *testing.T) {
    // ...
}
```

```bash
go test -tags=integration ./...
```

### TestMain for Setup/Teardown

```go
package store

import (
    "os"
    "testing"
)

func TestMain(m *testing.M) {
    setup()
    code := m.Run()
    teardown()
    os.Exit(code)
}

func setup()    {}
func teardown() {}
```

---

## Test Coverage

```bash
go test -cover ./...

go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

The HTML report shows which lines are covered (green) and which
aren't (red).

---

## Exercises

1. Write table-driven tests for a `Fibonacci(n int) int` function
   with at least 5 cases including edge cases

2. Write a benchmark comparing string concatenation with `+` vs
   `strings.Builder` for 1000 iterations

3. Create an HTTP handler and test it using `httptest.NewServer`

4. Write a fuzz test for a function that parses integers from
   strings

5. Achieve 100% test coverage on a small package (3-4 functions)
   and generate the HTML coverage report

---

[Next: Lesson 12 - Standard Library ->](12-standard-library.md)
