# Lesson 17: Performance

## Measure First, Optimize Second

Go is fast by default. But when you need to squeeze out more
performance, Go gives you excellent profiling tools. Think of
profiling like an X-ray — you see exactly where the bottlenecks
are before operating.

```
Optimization without profiling = guessing
Optimization with profiling    = engineering

+----------+     +---------+     +----------+     +---------+
| Write    | --> | Profile | --> | Identify | --> | Fix     |
| code     |     | (pprof) |     | hotspot  |     | hotspot |
+----------+     +---------+     +----------+     +---------+
                                                       |
                                                  +---------+
                                                  | Verify  |
                                                  | (bench) |
                                                  +---------+
```

---

## Benchmarking

Always benchmark before and after changes:

```go
package main

import (
    "strings"
    "testing"
)

func ConcatPlus(strs []string) string {
    result := ""
    for _, s := range strs {
        result += s
    }
    return result
}

func ConcatBuilder(strs []string) string {
    var b strings.Builder
    for _, s := range strs {
        b.WriteString(s)
    }
    return b.String()
}

func BenchmarkConcatPlus(b *testing.B) {
    strs := make([]string, 100)
    for i := range strs {
        strs[i] = "hello"
    }
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        ConcatPlus(strs)
    }
}

func BenchmarkConcatBuilder(b *testing.B) {
    strs := make([]string, 100)
    for i := range strs {
        strs[i] = "hello"
    }
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        ConcatBuilder(strs)
    }
}
```

```bash
go test -bench=. -benchmem -count=5
```

```
BenchmarkConcatPlus-8       18837     63542 ns/op   53240 B/op   99 allocs
BenchmarkConcatBuilder-8   312456      3841 ns/op    1024 B/op    8 allocs
```

The Builder version is ~16x faster with ~12x fewer allocations.

### Comparing Benchmarks

```bash
go test -bench=. -count=10 > old.txt
# make changes
go test -bench=. -count=10 > new.txt
benchstat old.txt new.txt
```

`benchstat` (from `golang.org/x/perf`) gives you statistically
valid comparisons.

---

## pprof: CPU and Memory Profiling

### CPU Profile

```go
package main

import (
    "os"
    "runtime/pprof"
)

func main() {
    f, _ := os.Create("cpu.prof")
    defer f.Close()
    pprof.StartCPUProfile(f)
    defer pprof.StopCPUProfile()

    doExpensiveWork()
}

func doExpensiveWork() {
    result := 0
    for i := 0; i < 100000000; i++ {
        result += i * i
    }
}
```

```bash
go tool pprof cpu.prof
(pprof) top10
(pprof) web          # opens flame graph in browser
(pprof) list doExpensiveWork
```

### HTTP pprof (Production)

```go
package main

import (
    "fmt"
    "net/http"
    _ "net/http/pprof"
)

func main() {
    go func() {
        fmt.Println("pprof on :6060")
        http.ListenAndServe(":6060", nil)
    }()

    fmt.Println("App on :8080")
    http.ListenAndServe(":8080", nil)
}
```

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

go tool pprof http://localhost:6060/debug/pprof/heap

go tool pprof http://localhost:6060/debug/pprof/goroutine
```

```
pprof endpoints:

/debug/pprof/profile     -- CPU profile
/debug/pprof/heap        -- memory allocations
/debug/pprof/goroutine   -- goroutine stacks
/debug/pprof/allocs      -- past memory allocations
/debug/pprof/block       -- blocking operations
/debug/pprof/mutex       -- mutex contention
/debug/pprof/trace       -- execution trace
```

---

## Escape Analysis

Go's compiler decides whether a variable lives on the stack or
heap. Stack allocation is free; heap allocation costs (GC).

```
Stack (fast, free):          Heap (slower, GC pressure):
+------------------+         +------------------+
| Local variables  |         | Pointers that    |
| Small structs    |         |   escape the     |
| Known-size data  |         |   function       |
| No pointers out  |         | Large allocations|
+------------------+         | Interface values |
                             +------------------+
```

See what escapes:

```bash
go build -gcflags="-m" ./...
```

```
./main.go:10:6: moved to heap: result
./main.go:15:12: &User{...} escapes to heap
```

### Reducing Escapes

```go
func badReturn() *User {
    u := User{Name: "Alice"}
    return &u
}

func goodParam(u *User) {
    u.Name = "Alice"
}
```

Returning a pointer forces heap allocation. Passing a pointer to
pre-allocated memory keeps it on the stack. But don't over-optimize
here — readability matters more for most code.

---

## Reducing Allocations

### Pre-allocate Slices

```go
func bad(n int) []int {
    var result []int
    for i := 0; i < n; i++ {
        result = append(result, i)
    }
    return result
}

func good(n int) []int {
    result := make([]int, 0, n)
    for i := 0; i < n; i++ {
        result = append(result, i)
    }
    return result
}
```

### sync.Pool for Reusable Objects

```go
package main

import (
    "bytes"
    "fmt"
    "sync"
)

var bufPool = sync.Pool{
    New: func() any {
        return new(bytes.Buffer)
    },
}

func process(data string) string {
    buf := bufPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufPool.Put(buf)
    }()

    buf.WriteString("processed: ")
    buf.WriteString(data)
    return buf.String()
}

func main() {
    fmt.Println(process("hello"))
    fmt.Println(process("world"))
}
```

`sync.Pool` is used heavily in the standard library. It recycles
objects to avoid GC pressure.

### Avoid Interface Boxing

```go
func withInterface(vals []any) int {
    total := 0
    for _, v := range vals {
        total += v.(int)
    }
    return total
}

func withConcrete(vals []int) int {
    total := 0
    for _, v := range vals {
        total += v
    }
    return total
}
```

Interface values allocate because the concrete value must be boxed.
Use concrete types in hot paths.

---

## Struct Layout: Memory Alignment

```go
type Bad struct {
    a bool      // 1 byte + 7 padding
    b int64     // 8 bytes
    c bool      // 1 byte + 7 padding
}
// Size: 24 bytes

type Good struct {
    b int64     // 8 bytes
    a bool      // 1 byte
    c bool      // 1 byte + 6 padding
}
// Size: 16 bytes
```

```
Bad layout (24 bytes):
+--+-------+--------+--+-------+
|a | pad   |   b    |c | pad   |
+--+-------+--------+--+-------+
 1    7        8      1    7

Good layout (16 bytes):
+--------+--+--+------+
|   b    |a |c | pad  |
+--------+--+--+------+
    8     1  1    6
```

Order fields from largest to smallest to minimize padding.
Use `fieldalignment` from `go vet` to check.

---

## Common Performance Patterns

```
+-----------------------------------+----------------------------+
| Issue                             | Fix                        |
+-----------------------------------+----------------------------+
| String concatenation in loops     | strings.Builder            |
+-----------------------------------+----------------------------+
| Growing slices repeatedly         | Pre-allocate with make     |
+-----------------------------------+----------------------------+
| Creating objects in hot loops     | sync.Pool                  |
+-----------------------------------+----------------------------+
| Large struct copies               | Use pointers               |
+-----------------------------------+----------------------------+
| Map lookups in tight loops        | Consider sorted slices     |
+-----------------------------------+----------------------------+
| JSON encoding/decoding            | Use streaming or code gen  |
|                                   | (easyjson, sonic)          |
+-----------------------------------+----------------------------+
| Goroutine per request (millions)  | Worker pool with semaphore |
+-----------------------------------+----------------------------+
| Excessive GC pauses               | Reduce allocations,        |
|                                   | GOGC tuning                |
+-----------------------------------+----------------------------+
```

### GOGC Tuning

```bash
GOGC=200 ./myapp

GOMEMLIMIT=1GiB ./myapp
```

`GOGC` controls how aggressively the GC runs. Default 100 means
GC runs when heap doubles. Higher = fewer GCs, more memory.

`GOMEMLIMIT` (Go 1.19+) sets a soft memory limit. The GC works
harder to stay under this limit.

---

## Execution Tracer

For understanding goroutine scheduling and latency:

```bash
go test -trace=trace.out ./...
go tool trace trace.out
```

Opens a browser UI showing:
- Goroutine execution timeline
- Network/system call blocking
- GC pauses
- Scheduler latency

---

## Exercises

1. Write benchmarks comparing `fmt.Sprintf` vs `strconv.Itoa`
   for integer-to-string conversion

2. Profile a program with `pprof` and identify the top 3 CPU
   consumers

3. Analyze escape behavior with `-gcflags="-m"` for a function
   that returns a pointer vs one that doesn't

4. Optimize a struct's memory layout and verify the size reduction
   with `unsafe.Sizeof`

5. Implement a string interning pool using `sync.Pool` and
   benchmark it against plain allocation

---

[Next: Lesson 18 - Real-World Go ->](18-real-world-go.md)
