# Lesson 16: Context & Cancellation

## The Thread That Connects Everything

`context.Context` is the backbone of Go server programming. It
carries deadlines, cancellation signals, and request-scoped values
through your entire call chain.

Think of it as a relay baton passed from handler to handler. If
the race is cancelled, everyone holding a baton knows to stop.

```
HTTP Request arrives
       |
   ctx = r.Context()         <-- baton created
       |
   +---+--- Service Layer    <-- passes baton
   |
   +---+--- Database Query   <-- checks baton
   |
   +---+--- External API     <-- checks baton
   |
   Client disconnects!
       |
   ctx.Done() fires          <-- everyone stops
```

---

## Context Basics

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func main() {
    ctx := context.Background()
    fmt.Println("Background:", ctx)

    ctx = context.TODO()
    fmt.Println("TODO:", ctx)
}
```

```
+---------------------+------------------------------------+
| context.Background()| Root context. Use in main(), init()|
|                     | and top-level test code            |
+---------------------+------------------------------------+
| context.TODO()      | Placeholder when unsure which      |
|                     | context to use. Grep for these     |
|                     | before shipping                    |
+---------------------+------------------------------------+
```

---

## Cancellation

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func doWork(ctx context.Context, name string) {
    for i := 0; ; i++ {
        select {
        case <-ctx.Done():
            fmt.Printf("%s: stopped (%v)\n", name, ctx.Err())
            return
        default:
            fmt.Printf("%s: working (iteration %d)\n", name, i)
            time.Sleep(200 * time.Millisecond)
        }
    }
}

func main() {
    ctx, cancel := context.WithCancel(context.Background())

    go doWork(ctx, "worker-1")
    go doWork(ctx, "worker-2")

    time.Sleep(1 * time.Second)
    cancel()
    time.Sleep(300 * time.Millisecond)
}
```

```
context.WithCancel(parent)

  Parent ctx ----+----> Child ctx
                 |
            cancel() called
                 |
            ctx.Done() channel closes
                 |
            ALL children cancelled too
```

Always `defer cancel()` to prevent resource leaks.

---

## Timeouts and Deadlines

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func slowQuery(ctx context.Context) (string, error) {
    select {
    case <-time.After(3 * time.Second):
        return "query result", nil
    case <-ctx.Done():
        return "", ctx.Err()
    }
}

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
    defer cancel()

    result, err := slowQuery(ctx)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println("Result:", result)
}
```

```
WithTimeout(parent, duration)
  = WithDeadline(parent, time.Now().Add(duration))

+-------+-------+-------+-------+
| 0s    | 1s    | 2s    | 3s    |
| start | TIMEOUT       | query |
|       | ctx cancelled | would |
|       |               | finish|
+-------+-------+-------+-------+
```

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func main() {
    deadline := time.Now().Add(500 * time.Millisecond)
    ctx, cancel := context.WithDeadline(context.Background(), deadline)
    defer cancel()

    dl, ok := ctx.Deadline()
    if ok {
        fmt.Println("Deadline:", dl)
        fmt.Println("Time remaining:", time.Until(dl))
    }

    <-ctx.Done()
    fmt.Println("Context done:", ctx.Err())
}
```

---

## Context Values

Carry request-scoped data through the call chain:

```go
package main

import (
    "context"
    "fmt"
)

type contextKey string

const (
    requestIDKey contextKey = "requestID"
    userIDKey    contextKey = "userID"
)

func WithRequestID(ctx context.Context, id string) context.Context {
    return context.WithValue(ctx, requestIDKey, id)
}

func RequestID(ctx context.Context) string {
    id, ok := ctx.Value(requestIDKey).(string)
    if !ok {
        return "unknown"
    }
    return id
}

func processRequest(ctx context.Context) {
    fmt.Printf("[%s] Processing request\n", RequestID(ctx))
}

func main() {
    ctx := context.Background()
    ctx = WithRequestID(ctx, "req-abc-123")
    processRequest(ctx)
}
```

Important rules:
- Use custom types for keys (not bare strings)
- Don't store everything in context — only request-scoped data
- Good: request ID, user ID, trace ID
- Bad: database connections, loggers, configuration

```
+-------------------------------------------+
| What belongs in context.Value             |
+-------------------------------------------+
| YES: request ID, trace ID, auth token     |
| YES: deadline, cancellation signal        |
| NO:  database connection                  |
| NO:  logger instance                      |
| NO:  configuration                        |
| NO:  anything that affects business logic |
+-------------------------------------------+
```

---

## Context in HTTP Servers

Every `http.Request` carries a context:

```go
package main

import (
    "context"
    "fmt"
    "net/http"
    "time"
)

func handler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
    defer cancel()

    result, err := fetchData(ctx)
    if err != nil {
        if ctx.Err() == context.DeadlineExceeded {
            http.Error(w, "request timed out", http.StatusGatewayTimeout)
            return
        }
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    fmt.Fprint(w, result)
}

func fetchData(ctx context.Context) (string, error) {
    select {
    case <-time.After(1 * time.Second):
        return "data", nil
    case <-ctx.Done():
        return "", ctx.Err()
    }
}

func main() {
    http.HandleFunc("/", handler)
    http.ListenAndServe(":8080", nil)
}
```

When the client disconnects, `r.Context()` is cancelled. Your
database queries, API calls, and processing all stop.

---

## Cancellation Propagation

```
                    context.Background()
                           |
                   WithTimeout(5s)
                     /           \
            WithCancel()      WithValue(reqID)
               |                    |
          DB Query              API Call
               |                    |
          If parent            If parent
          cancels,             cancels,
          I cancel too         I cancel too
```

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

func fetchFromDB(ctx context.Context) (string, error) {
    select {
    case <-time.After(300 * time.Millisecond):
        return "db result", nil
    case <-ctx.Done():
        fmt.Println("DB query cancelled")
        return "", ctx.Err()
    }
}

func fetchFromAPI(ctx context.Context) (string, error) {
    select {
    case <-time.After(500 * time.Millisecond):
        return "api result", nil
    case <-ctx.Done():
        fmt.Println("API call cancelled")
        return "", ctx.Err()
    }
}

func handleRequest(ctx context.Context) {
    ctx, cancel := context.WithTimeout(ctx, 400*time.Millisecond)
    defer cancel()

    var wg sync.WaitGroup
    wg.Add(2)

    go func() {
        defer wg.Done()
        result, err := fetchFromDB(ctx)
        if err != nil {
            fmt.Println("DB error:", err)
            return
        }
        fmt.Println("DB:", result)
    }()

    go func() {
        defer wg.Done()
        result, err := fetchFromAPI(ctx)
        if err != nil {
            fmt.Println("API error:", err)
            return
        }
        fmt.Println("API:", result)
    }()

    wg.Wait()
}

func main() {
    ctx := context.Background()
    handleRequest(ctx)
}
```

The DB query finishes (300ms < 400ms timeout), but the API call
gets cancelled (500ms > 400ms timeout).

---

## Context Best Practices

```
+------------------------------------------------+
| Rule                                           |
+------------------------------------------------+
| 1. context.Context is always the first param   |
|    func DoThing(ctx context.Context, ...) error|
+------------------------------------------------+
| 2. Never store context in a struct             |
|    Pass it through function arguments          |
+------------------------------------------------+
| 3. Always defer cancel()                       |
|    Prevents goroutine and resource leaks       |
+------------------------------------------------+
| 4. Check ctx.Done() in loops and waits         |
|    Enables responsive cancellation             |
+------------------------------------------------+
| 5. Use context.Value sparingly                 |
|    Request-scoped data only                    |
+------------------------------------------------+
| 6. Don't pass nil context                      |
|    Use context.TODO() if unsure                |
+------------------------------------------------+
```

---

## AfterFunc (Go 1.21+)

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func main() {
    ctx, cancel := context.WithCancel(context.Background())

    stop := context.AfterFunc(ctx, func() {
        fmt.Println("Context was cancelled! Cleaning up...")
    })
    defer stop()

    time.Sleep(100 * time.Millisecond)
    cancel()
    time.Sleep(100 * time.Millisecond)
}
```

`AfterFunc` registers a callback that fires when the context is
done. Useful for cleanup without polling `ctx.Done()`.

---

## Exercises

1. Write an HTTP handler that uses `context.WithTimeout` to limit
   database queries to 2 seconds

2. Create a middleware that injects a request ID into the context
   and a helper to extract it

3. Build a function that makes 3 parallel API calls and cancels
   all remaining if any one fails

4. Implement a retry function that respects context cancellation:
   `retry(ctx context.Context, maxAttempts int, fn func() error) error`

5. Write a program demonstrating context propagation through 4
   layers: HTTP handler -> service -> repository -> external call.
   Cancel from the top and verify all layers stop

---

[Next: Lesson 17 - Performance ->](17-performance.md)
