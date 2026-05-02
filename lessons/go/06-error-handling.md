# Lesson 06: Error Handling

## Errors Are Values

Go's most controversial and most praised design decision: errors are
just values. No exceptions, no try/catch, no panic/recover (well,
there is, but it's for truly exceptional cases).

Think of it like a restaurant order. The kitchen doesn't throw your
plate across the room when they're out of salmon. They send back a
note: "Sorry, no salmon today." You decide what to do.

```
Rust:                           Go:
Result<T, E>                    (T, error)

match result {                  val, err := doThing()
    Ok(val) => ...              if err != nil {
    Err(e) => ...                   return err
}                               }
```

---

## The Error Interface

```go
type error interface {
    Error() string
}
```

That's it. Any type with an `Error() string` method is an error.

```go
package main

import (
    "errors"
    "fmt"
)

func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("cannot divide by zero")
    }
    return a / b, nil
}

func main() {
    result, err := divide(10, 0)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println(result)
}
```

The pattern you'll write a thousand times:

```
val, err := someFunction()
if err != nil {
    return ..., err    // or handle it
}
// use val
```

---

## Custom Error Types

```go
package main

import "fmt"

type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed on %s: %s", e.Field, e.Message)
}

type NotFoundError struct {
    Resource string
    ID       string
}

func (e *NotFoundError) Error() string {
    return fmt.Sprintf("%s with id %q not found", e.Resource, e.ID)
}

func findUser(id string) (string, error) {
    if id == "" {
        return "", &ValidationError{Field: "id", Message: "cannot be empty"}
    }
    if id != "123" {
        return "", &NotFoundError{Resource: "user", ID: id}
    }
    return "Alice", nil
}

func main() {
    name, err := findUser("456")
    if err != nil {
        fmt.Println(err)
        return
    }
    fmt.Println(name)
}
```

In Rust, you'd define an enum with variants. In Go, you create
separate error structs. Each carries structured data about what
went wrong.

---

## Sentinel Errors

Sentinel errors are pre-defined error values used for comparison.

```go
package main

import (
    "errors"
    "fmt"
    "io"
    "strings"
)

var ErrInsufficientFunds = errors.New("insufficient funds")
var ErrAccountLocked = errors.New("account locked")

func withdraw(balance, amount float64) (float64, error) {
    if amount > balance {
        return balance, ErrInsufficientFunds
    }
    return balance - amount, nil
}

func main() {
    balance, err := withdraw(100, 200)
    if errors.Is(err, ErrInsufficientFunds) {
        fmt.Println("Not enough money!")
    }
    fmt.Println("Balance:", balance)

    reader := strings.NewReader("")
    buf := make([]byte, 10)
    _, err = reader.Read(buf)
    if errors.Is(err, io.EOF) {
        fmt.Println("End of input")
    }
}
```

```
Common sentinel errors in the stdlib:

io.EOF              -- end of stream
io.ErrUnexpectedEOF -- stream ended too early
os.ErrNotExist      -- file doesn't exist
os.ErrPermission    -- permission denied
sql.ErrNoRows       -- query returned no rows
context.Canceled    -- context was canceled
context.DeadlineExceeded -- timeout
```

---

## Error Wrapping

Wrapping adds context as errors propagate up the call stack.

```
+------------------+
| readConfig()     |  "open config.yaml: no such file"
+------------------+
         |  wraps
+------------------+
| loadApp()        |  "load app: open config.yaml: no such file"
+------------------+
         |  wraps
+------------------+
| main()           |  "startup failed: load app: open config.yaml: ..."
+------------------+
```

```go
package main

import (
    "errors"
    "fmt"
    "os"
)

func readConfig(path string) ([]byte, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("read config %s: %w", path, err)
    }
    return data, nil
}

func loadApp() error {
    _, err := readConfig("config.yaml")
    if err != nil {
        return fmt.Errorf("load app: %w", err)
    }
    return nil
}

func main() {
    err := loadApp()
    if err != nil {
        fmt.Println(err)

        if errors.Is(err, os.ErrNotExist) {
            fmt.Println("The config file is missing!")
        }
    }
}
```

The `%w` verb in `fmt.Errorf` wraps the error. `errors.Is` can
then unwrap the chain and find the original error.

---

## errors.Is and errors.As

```
errors.Is  -- checks if any error in the chain MATCHES a value
errors.As  -- checks if any error in the chain MATCHES a type
```

```go
package main

import (
    "errors"
    "fmt"
)

type HTTPError struct {
    Code    int
    Message string
}

func (e *HTTPError) Error() string {
    return fmt.Sprintf("HTTP %d: %s", e.Code, e.Message)
}

func fetchData() error {
    return fmt.Errorf("fetch failed: %w", &HTTPError{Code: 404, Message: "not found"})
}

func main() {
    err := fetchData()

    var httpErr *HTTPError
    if errors.As(err, &httpErr) {
        fmt.Println("HTTP status:", httpErr.Code)
        fmt.Println("Message:", httpErr.Message)
    }
}
```

```
errors.Is(err, target)     -- "is this error (or any wrapped
                              error) equal to target?"

errors.As(err, &target)    -- "is this error (or any wrapped
                              error) of type *target? If so,
                              assign it."
```

---

## Why No Exceptions?

```
Exception-based (Java/Python):     Value-based (Go):

try {                              val, err := doA()
    a = doA()                      if err != nil {
    b = doB(a)                         return err
    c = doC(b)                     }
} catch (ExA e) {                  val2, err := doB(val)
    ...                            if err != nil {
} catch (ExB e) {                      return err
    ...                            }
} catch (Exception e) {
    ...
}

Hidden control flow.               Explicit control flow.
You can't see which                Every error point is visible.
line might throw.                  Verbose but predictable.
```

Go's approach is verbose. You'll write `if err != nil` constantly.
But you always know exactly where errors can occur and how they
flow. In Rust terms, it's like `?` but more explicit.

---

## Panic and Recover

Panic is for truly unrecoverable situations — programmer errors,
not runtime conditions.

```go
package main

import "fmt"

func safeDivide(a, b int) (result int, err error) {
    defer func() {
        if r := recover(); r != nil {
            err = fmt.Errorf("recovered from panic: %v", r)
        }
    }()

    return a / b, nil
}

func main() {
    result, err := safeDivide(10, 0)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println(result)
}
```

Rules:
- **panic**: only for programming errors (index out of bounds, nil
  pointer on something that should never be nil)
- **recover**: only in deferred functions, only at package boundaries
  (like HTTP handlers recovering from panics in user code)
- For normal error handling, always use error values

---

## Practical Error Handling Patterns

### Fail Fast with Guard Clauses

```go
func processOrder(order *Order) error {
    if order == nil {
        return errors.New("order is nil")
    }
    if order.Total <= 0 {
        return fmt.Errorf("invalid total: %.2f", order.Total)
    }
    if len(order.Items) == 0 {
        return errors.New("order has no items")
    }

    return chargeCustomer(order)
}
```

### Error Type Hierarchy

```go
package main

import (
    "errors"
    "fmt"
)

var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrInternal     = errors.New("internal error")
)

func handleError(err error) {
    switch {
    case errors.Is(err, ErrNotFound):
        fmt.Println("404 - Resource not found")
    case errors.Is(err, ErrUnauthorized):
        fmt.Println("401 - Please log in")
    case errors.Is(err, ErrInternal):
        fmt.Println("500 - Something went wrong")
    default:
        fmt.Println("Unknown error:", err)
    }
}

func main() {
    err := fmt.Errorf("getting user: %w", ErrNotFound)
    handleError(err)
}
```

---

## Exercises

1. Create a custom `ParseError` with `Line`, `Column`, and
   `Message` fields. Implement the `error` interface

2. Write a chain of three functions that each wrap errors with
   context. Use `errors.Is` at the top to check the original error

3. Write a function that reads a file and returns a custom error
   type if the file doesn't exist, is empty, or is too large

4. Implement a `MultiError` type that collects multiple errors
   and implements the `error` interface

5. Write a function that uses `recover` to safely call a
   potentially panicking function and returns an error instead

---

[Next: Lesson 07 - Goroutines ->](07-goroutines.md)
