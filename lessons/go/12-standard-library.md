# Lesson 12: Standard Library

## Batteries Included

Go's standard library is massive and production-quality. You can
build web servers, parse JSON, handle crypto, compress files — all
without a single external dependency.

Think of it as a well-stocked toolbox. Before reaching for a
third-party package, check if the stdlib already does it.

```
+----------------------------------------------------+
|                Go Standard Library                  |
+----------------------------------------------------+
| net/http     -- HTTP client and server              |
| encoding/json -- JSON encode/decode                 |
| io           -- Reader/Writer interfaces            |
| os           -- File system, env vars               |
| fmt          -- Formatted I/O                       |
| strings      -- String manipulation                 |
| strconv      -- String conversions                  |
| context      -- Cancellation and deadlines          |
| sync         -- Mutexes, WaitGroups                 |
| time         -- Time and duration                   |
| log/slog     -- Structured logging                  |
| crypto       -- Hashing, encryption                 |
| testing      -- Tests and benchmarks                |
+----------------------------------------------------+
```

---

## encoding/json

```go
package main

import (
    "encoding/json"
    "fmt"
)

type User struct {
    Name  string   `json:"name"`
    Email string   `json:"email"`
    Age   int      `json:"age,omitempty"`
    Tags  []string `json:"tags"`
}

func main() {
    user := User{
        Name:  "Alice",
        Email: "alice@example.com",
        Tags:  []string{"admin", "active"},
    }

    data, err := json.Marshal(user)
    if err != nil {
        fmt.Println("marshal error:", err)
        return
    }
    fmt.Println(string(data))

    pretty, _ := json.MarshalIndent(user, "", "  ")
    fmt.Println(string(pretty))

    var decoded User
    err = json.Unmarshal(data, &decoded)
    if err != nil {
        fmt.Println("unmarshal error:", err)
        return
    }
    fmt.Printf("%+v\n", decoded)
}
```

In Rust, you'd use `serde_json`. Go's `encoding/json` uses struct
tags instead of derive macros.

### Streaming JSON

```go
package main

import (
    "encoding/json"
    "os"
)

type Event struct {
    Type    string `json:"type"`
    Message string `json:"message"`
}

func main() {
    encoder := json.NewEncoder(os.Stdout)
    encoder.SetIndent("", "  ")

    events := []Event{
        {Type: "info", Message: "started"},
        {Type: "error", Message: "connection failed"},
    }

    for _, event := range events {
        encoder.Encode(event)
    }
}
```

Encoders/decoders work with `io.Reader`/`io.Writer`. Stream JSON
directly to/from files, HTTP responses, or any writer.

---

## io Package

The foundation of Go I/O. Everything is a Reader or Writer.

```
+-----------+         +-----------+
| io.Reader |         | io.Writer |
+-----------+         +-----------+
      |                     |
  +---+---+---+        +---+---+---+
  |   |   |   |        |   |   |   |
 File Net Str Buf     File Net Buf Hash
```

```go
package main

import (
    "fmt"
    "io"
    "strings"
)

func main() {
    reader := strings.NewReader("Hello, Go standard library!")

    data, err := io.ReadAll(reader)
    if err != nil {
        fmt.Println(err)
        return
    }
    fmt.Println(string(data))
}
```

### Composing Readers and Writers

```go
package main

import (
    "compress/gzip"
    "io"
    "os"
    "strings"
)

func main() {
    input := strings.NewReader("Hello, compressed world! " +
        "This text will be gzip compressed.")

    file, err := os.Create("/tmp/test.gz")
    if err != nil {
        panic(err)
    }
    defer file.Close()

    gzWriter := gzip.NewWriter(file)
    defer gzWriter.Close()

    io.Copy(gzWriter, input)
}
```

`io.Copy` connects any Reader to any Writer. Composable,
reusable, elegant.

---

## os Package

```go
package main

import (
    "fmt"
    "os"
)

func main() {
    data, err := os.ReadFile("config.txt")
    if err != nil {
        fmt.Println("Read error:", err)
    } else {
        fmt.Println(string(data))
    }

    err = os.WriteFile("output.txt", []byte("hello"), 0644)
    if err != nil {
        fmt.Println("Write error:", err)
        return
    }

    home, _ := os.UserHomeDir()
    fmt.Println("Home:", home)

    dbURL := os.Getenv("DATABASE_URL")
    fmt.Println("DB:", dbURL)

    entries, _ := os.ReadDir(".")
    for _, entry := range entries {
        fmt.Println(entry.Name(), entry.IsDir())
    }
}
```

---

## strings and strconv

```go
package main

import (
    "fmt"
    "strconv"
    "strings"
)

func main() {
    fmt.Println(strings.Contains("hello world", "world"))
    fmt.Println(strings.HasPrefix("hello", "hel"))
    fmt.Println(strings.Split("a,b,c", ","))
    fmt.Println(strings.Join([]string{"a", "b", "c"}, "-"))
    fmt.Println(strings.TrimSpace("  hello  "))
    fmt.Println(strings.ReplaceAll("foo bar foo", "foo", "baz"))

    n, _ := strconv.Atoi("42")
    fmt.Println(n)

    s := strconv.Itoa(42)
    fmt.Println(s)

    f, _ := strconv.ParseFloat("3.14", 64)
    fmt.Println(f)
}
```

### strings.Builder

```go
package main

import (
    "fmt"
    "strings"
)

func buildCSV(rows [][]string) string {
    var b strings.Builder
    for _, row := range rows {
        b.WriteString(strings.Join(row, ","))
        b.WriteByte('\n')
    }
    return b.String()
}

func main() {
    rows := [][]string{
        {"name", "age", "city"},
        {"Alice", "30", "Portland"},
        {"Bob", "25", "Seattle"},
    }
    fmt.Print(buildCSV(rows))
}
```

`strings.Builder` is efficient for string concatenation. Like
Rust's `String::push_str` pattern.

---

## time Package

```go
package main

import (
    "fmt"
    "time"
)

func main() {
    now := time.Now()
    fmt.Println("Now:", now)

    formatted := now.Format("2006-01-02 15:04:05")
    fmt.Println("Formatted:", formatted)

    parsed, _ := time.Parse("2006-01-02", "2024-06-15")
    fmt.Println("Parsed:", parsed)

    future := now.Add(24 * time.Hour)
    fmt.Println("Tomorrow:", future)

    duration := future.Sub(now)
    fmt.Println("Duration:", duration)

    start := time.Now()
    time.Sleep(100 * time.Millisecond)
    elapsed := time.Since(start)
    fmt.Println("Elapsed:", elapsed)
}
```

Go's reference time is `Mon Jan 2 15:04:05 MST 2006` — the
numbers 1, 2, 3, 4, 5, 6, 7 in order. Weird but memorable.

---

## log/slog (Structured Logging)

```go
package main

import (
    "log/slog"
    "os"
)

func main() {
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelDebug,
    }))

    logger.Info("server starting",
        "port", 8080,
        "env", "production",
    )

    logger.Error("connection failed",
        "host", "db.example.com",
        "retries", 3,
    )

    logger.Debug("request processed",
        "method", "GET",
        "path", "/api/users",
        "duration_ms", 42,
    )
}
```

`slog` (Go 1.21+) is the standard structured logging package.
Before `slog`, most projects used `logrus` or `zap`.

---

## net/http (Client)

```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

func main() {
    client := &http.Client{
        Timeout: 10 * time.Second,
    }

    resp, err := client.Get("https://httpbin.org/json")
    if err != nil {
        fmt.Println("error:", err)
        return
    }
    defer resp.Body.Close()

    var result map[string]any
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Println(result)
}
```

Always set a timeout on `http.Client`. The default has no timeout,
which can hang forever.

---

## Stdlib Decision Tree

```
Need to...                          Use...
+------------------------------------+-------------------+
| Parse/create JSON                  | encoding/json     |
| Make HTTP requests                 | net/http (client)  |
| Build HTTP servers                 | net/http (server)  |
| Read/write files                   | os                 |
| String manipulation                | strings            |
| Number/string conversion           | strconv            |
| Time and dates                     | time               |
| Structured logging                 | log/slog           |
| Concurrent synchronization         | sync               |
| Cancellation/timeouts              | context            |
| Buffered I/O                       | bufio              |
| Regular expressions                | regexp             |
| Sorting                            | sort / slices      |
| Command-line flags                 | flag               |
| Templates                          | text/template      |
| Cryptographic hashing              | crypto/sha256      |
| Embedding files in binary          | embed              |
+------------------------------------+-------------------+
```

---

## Exercises

1. Write a program that reads a JSON file, modifies a field, and
   writes it back with pretty formatting

2. Build a simple file search tool using `os.ReadDir` that
   recursively finds files matching a pattern

3. Use `strings.Builder` to generate an HTML table from a slice
   of structs

4. Create a program that fetches JSON from an API, parses it, and
   prints selected fields (use `net/http` client)

5. Write a structured logger using `slog` that outputs JSON and
   includes request metadata

---

[Next: Lesson 13 - HTTP Servers ->](13-http-servers.md)
