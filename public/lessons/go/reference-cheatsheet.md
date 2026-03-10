# Go Syntax Quick Reference

## Variables

```go
var x int = 10
x := 10
var x int              // zero value: 0
const Pi = 3.14159
```

## Types

```
int, int8, int16, int32, int64
uint, uint8, uint16, uint32, uint64
float32, float64
bool
string
byte (= uint8)
rune (= int32)
```

## Zero Values

```
int     -> 0
float64 -> 0.0
bool    -> false
string  -> ""
pointer -> nil
slice   -> nil
map     -> nil
```

## Control Flow

```go
if x > 0 {
}

if err := do(); err != nil {
}

for i := 0; i < 10; i++ {
}

for condition {
}

for {
}

for i, v := range slice {
}

for k, v := range myMap {
}

switch x {
case 1:
case 2:
default:
}

switch {
case x > 0:
case x < 0:
}
```

## Functions

```go
func add(a, b int) int {
    return a + b
}

func divide(a, b float64) (float64, error) {
    return a / b, nil
}

func greet(names ...string) {
}
```

## Structs

```go
type User struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

func (u User) Greet() string {
    return "Hi, " + u.Name
}

func (u *User) SetName(name string) {
    u.Name = name
}

u := User{Name: "Alice"}
u := &User{Name: "Alice"}
```

## Interfaces

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

// Implicit satisfaction - no "implements" keyword
```

## Slices

```go
s := []int{1, 2, 3}
s := make([]int, 5)
s := make([]int, 0, 10)
s = append(s, 4, 5)
copy(dst, src)
sub := s[1:3]
len(s)
cap(s)
```

## Maps

```go
m := map[string]int{"a": 1}
m := make(map[string]int)
m["key"] = value
val := m["key"]
val, ok := m["key"]
delete(m, "key")
len(m)
```

## Error Handling

```go
if err != nil {
    return fmt.Errorf("context: %w", err)
}

errors.Is(err, target)
errors.As(err, &target)

var ErrNotFound = errors.New("not found")
```

## Goroutines & Channels

```go
go func() { }()

ch := make(chan int)
ch := make(chan int, 10)   // buffered
ch <- value                // send
val := <-ch                // receive
close(ch)

select {
case v := <-ch1:
case ch2 <- val:
case <-time.After(1 * time.Second):
default:
}
```

## Concurrency Primitives

```go
var wg sync.WaitGroup
wg.Add(1)
go func() { defer wg.Done() }()
wg.Wait()

var mu sync.Mutex
mu.Lock()
defer mu.Unlock()

var once sync.Once
once.Do(func() { })
```

## Context

```go
ctx := context.Background()
ctx, cancel := context.WithCancel(parent)
ctx, cancel := context.WithTimeout(parent, 5*time.Second)
ctx, cancel := context.WithDeadline(parent, deadline)
defer cancel()
<-ctx.Done()
ctx.Err()
```

## Testing

```go
func TestFoo(t *testing.T) {
    t.Run("subtest", func(t *testing.T) {
        t.Error("failed")
        t.Fatal("stop now")
    })
}

func BenchmarkFoo(b *testing.B) {
    for i := 0; i < b.N; i++ { }
}
```

## Common Commands

```bash
go run .
go build -o app .
go test ./...
go test -v -run TestName ./...
go test -bench=. -benchmem ./...
go test -race ./...
go test -cover ./...
go fmt ./...
go vet ./...
go mod init module/name
go mod tidy
go get package@version
```

## Import Groups

```go
import (
    "fmt"              // stdlib
    "net/http"

    "github.com/pkg"   // external

    "mymod/internal"    // internal
)
```

## String Operations

```go
strings.Contains(s, sub)
strings.HasPrefix(s, pre)
strings.HasSuffix(s, suf)
strings.Split(s, sep)
strings.Join(parts, sep)
strings.TrimSpace(s)
strings.ToLower(s)
strings.ReplaceAll(s, old, new)

strconv.Atoi(s)            // string -> int
strconv.Itoa(n)            // int -> string
strconv.ParseFloat(s, 64)  // string -> float64
fmt.Sprintf("%d", n)       // formatted string
```

## JSON

```go
data, err := json.Marshal(v)
err := json.Unmarshal(data, &v)
json.NewEncoder(w).Encode(v)
json.NewDecoder(r).Decode(&v)
```

## File Operations

```go
data, err := os.ReadFile("path")
err := os.WriteFile("path", data, 0644)
f, err := os.Open("path")
f, err := os.Create("path")
defer f.Close()
```

---

[Back to Roadmap](00-roadmap.md)
