# Lesson 05: Interfaces

## The Power Outlet Analogy

Think of an interface as a power outlet. Any device with the right
plug shape can connect — it doesn't need to register, inherit, or
declare anything. It just needs the right prongs.

```
    Interface (outlet)         Implementations (plugs)
    +-----------+
    |  o   o    |  <--------  Laptop charger   [has right prongs]
    |     o     |  <--------  Phone charger    [has right prongs]
    +-----------+  <--------  Toaster          [has right prongs]

    Any type that has the right methods "plugs in" automatically.
```

In Rust, you'd write `impl Trait for Type`. In Go, there's no
explicit declaration. If your type has the methods, it satisfies the
interface. This is called **structural typing** or **implicit
interface satisfaction**.

---

## Defining Interfaces

```go
package main

import (
    "fmt"
    "math"
)

type Shape interface {
    Area() float64
    Perimeter() float64
}

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return math.Pi * c.Radius * c.Radius
}

func (c Circle) Perimeter() float64 {
    return 2 * math.Pi * c.Radius
}

type Rectangle struct {
    Width, Height float64
}

func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

func (r Rectangle) Perimeter() float64 {
    return 2 * (r.Width + r.Height)
}

func printShape(s Shape) {
    fmt.Printf("Area: %.2f, Perimeter: %.2f\n", s.Area(), s.Perimeter())
}

func main() {
    printShape(Circle{Radius: 5})
    printShape(Rectangle{Width: 3, Height: 4})
}
```

Neither `Circle` nor `Rectangle` mentions `Shape` anywhere. They
just happen to have the right methods. The plug fits the outlet.

```
Rust:                             Go:
trait Shape {                     type Shape interface {
    fn area(&self) -> f64;            Area() float64
}                                     Perimeter() float64
                                  }
impl Shape for Circle {
    fn area(&self) -> f64 { ... } // No impl block needed.
}                                 // Just have the methods.
```

---

## The io.Reader and io.Writer Interfaces

These are Go's most important interfaces. Almost everything in the
standard library uses them.

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}
```

```
              io.Reader                    io.Writer
           +------------+              +------------+
           |  Read()    |              |  Write()   |
           +------+-----+              +------+-----+
                  |                           |
     +------------+----------+     +----------+----------+
     |            |          |     |          |          |
  os.File    http.Body   strings  os.File  net.Conn  bytes.Buffer
                        .NewReader
```

One interface, dozens of implementations. Read from a file, an HTTP
response, a string, a compressed stream — all through the same
`Read()` method.

```go
package main

import (
    "fmt"
    "io"
    "strings"
)

func countBytes(r io.Reader) (int, error) {
    buf := make([]byte, 1024)
    total := 0
    for {
        n, err := r.Read(buf)
        total += n
        if err == io.EOF {
            return total, nil
        }
        if err != nil {
            return total, err
        }
    }
}

func main() {
    r := strings.NewReader("Hello, Go interfaces!")
    n, err := countBytes(r)
    if err != nil {
        fmt.Println("error:", err)
        return
    }
    fmt.Printf("Read %d bytes\n", n)
}
```

---

## Interface Composition

Small interfaces compose into larger ones. This is the Lego principle
applied to behavior.

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type ReadWriter interface {
    Reader
    Writer
}
```

```
+--------+     +--------+
| Reader |     | Writer |
+---+----+     +----+---+
    |               |
    +-------+-------+
            |
     +------+------+
     | ReadWriter   |
     +-------------+
```

Go proverb: "The bigger the interface, the weaker the abstraction."
Keep interfaces small — one or two methods is ideal.

---

## The Empty Interface

```go
interface{}
```

Or since Go 1.18:

```go
any
```

The empty interface has zero methods, so every type satisfies it.
It's Go's equivalent of Rust's `dyn Any` or a void pointer, but
type-safe at runtime.

```go
package main

import "fmt"

func printAnything(v any) {
    fmt.Printf("Type: %T, Value: %v\n", v, v)
}

func main() {
    printAnything(42)
    printAnything("hello")
    printAnything(true)
    printAnything([]int{1, 2, 3})
}
```

Use `any` sparingly. It throws away type safety. Prefer concrete
types or specific interfaces.

---

## Type Assertions and Type Switches

When you have an `any` or interface value, you can recover the
concrete type:

```go
package main

import "fmt"

func describe(val any) string {
    switch v := val.(type) {
    case int:
        return fmt.Sprintf("integer: %d", v)
    case string:
        return fmt.Sprintf("string: %q (len %d)", v, len(v))
    case bool:
        return fmt.Sprintf("boolean: %t", v)
    default:
        return fmt.Sprintf("unknown: %T", v)
    }
}

func main() {
    fmt.Println(describe(42))
    fmt.Println(describe("hello"))
    fmt.Println(describe(true))
    fmt.Println(describe(3.14))
}
```

Type assertion (single type):

```go
package main

import "fmt"

func main() {
    var val any = "hello"

    s, ok := val.(string)
    if ok {
        fmt.Println("It's a string:", s)
    }

    n, ok := val.(int)
    if !ok {
        fmt.Println("Not an int, got zero:", n)
    }
}
```

Always use the comma-ok form. A failed assertion without it panics.

---

## Interface Best Practices

```
+------------------------------------------+
| Go Interface Guidelines                  |
+------------------------------------------+
| 1. Keep interfaces small (1-3 methods)   |
| 2. Define interfaces where used, not     |
|    where implemented                     |
| 3. Accept interfaces, return structs     |
| 4. Don't export interfaces for types     |
|    only you implement                    |
| 5. Name single-method interfaces with    |
|    -er suffix: Reader, Writer, Stringer  |
+------------------------------------------+
```

### Accept Interfaces, Return Structs

```go
package main

import (
    "fmt"
    "io"
    "strings"
)

type Processor struct {
    processed int
}

func NewProcessor() *Processor {
    return &Processor{}
}

func (p *Processor) Process(r io.Reader) error {
    buf := make([]byte, 1024)
    for {
        n, err := r.Read(buf)
        p.processed += n
        if err == io.EOF {
            return nil
        }
        if err != nil {
            return err
        }
    }
}

func main() {
    proc := NewProcessor()
    proc.Process(strings.NewReader("some data"))
    fmt.Println("Processed bytes:", proc.processed)
}
```

The function accepts `io.Reader` (interface) but returns
`*Processor` (concrete struct). This gives callers flexibility on
input while giving you control over the return type.

---

## The Stringer Interface

```go
package main

import "fmt"

type Color struct {
    R, G, B uint8
}

func (c Color) String() string {
    return fmt.Sprintf("#%02x%02x%02x", c.R, c.G, c.B)
}

func main() {
    red := Color{R: 255, G: 0, B: 0}
    fmt.Println(red)
}
```

Implement `String() string` and `fmt.Println` automatically uses
it. Like Rust's `impl Display for Type`.

---

## Exercises

1. Define a `Measurable` interface with `Area() float64`. Create
   `Triangle` and `Circle` types that satisfy it. Write a function
   `totalArea(shapes []Measurable) float64`

2. Write a function `copyData(dst io.Writer, src io.Reader) error`
   that copies data in 512-byte chunks (don't use `io.Copy`)

3. Implement the `Stringer` interface for a `Temperature` struct
   that prints like "72.5 F" or "22.5 C"

4. Create a `Cache` interface with `Get(key string) (any, bool)`
   and `Set(key string, value any)`. Implement it with a map

5. Write a type switch function that handles `int`, `string`,
   `[]int`, and `map[string]int` with formatted output for each

---

[Next: Lesson 06 - Error Handling ->](06-error-handling.md)
