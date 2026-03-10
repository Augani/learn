# Lesson 04: Structs & Methods

## Structs: Your Building Blocks

Think of structs as Lego bricks. Each brick has a specific shape
(fields), and you build complex structures by snapping them together
(composition). There's no inheritance hierarchy — just bricks.

In Rust, you have `struct` + `impl` blocks. Go is identical in
concept, just different syntax.

```
Rust:                      Go:
struct User {              type User struct {
    name: String,              Name string
    age:  u32,                 Age  int
}                          }

impl User {                func (u User) Greet() string {
    fn greet(&self) -> ... }
}
```

---

## Defining Structs

```go
package main

import "fmt"

type Point struct {
    X float64
    Y float64
}

type User struct {
    Name  string
    Email string
    Age   int
}

func main() {
    p := Point{X: 3.0, Y: 4.0}
    fmt.Println(p)

    u := User{
        Name:  "Alice",
        Email: "alice@example.com",
        Age:   30,
    }
    fmt.Println(u)

    var empty User
    fmt.Println(empty)
}
```

Struct fields starting with uppercase are exported (public).
Lowercase fields are unexported (package-private). This is Go's
only visibility mechanism.

```
+---------------------------+
|  Exported   = Uppercase   |
|  Name, Age, Process()     |
+---------------------------+
|  Unexported = lowercase   |
|  name, age, process()     |
+---------------------------+
```

---

## Methods

Methods are functions with a receiver — the struct they operate on.

```go
package main

import (
    "fmt"
    "math"
)

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return math.Pi * c.Radius * c.Radius
}

func (c Circle) Perimeter() float64 {
    return 2 * math.Pi * c.Radius
}

func main() {
    c := Circle{Radius: 5}
    fmt.Printf("Area: %.2f\n", c.Area())
    fmt.Printf("Perimeter: %.2f\n", c.Perimeter())
}
```

### Value vs Pointer Receivers

```
Value receiver:    func (c Circle) Area() float64
                   Gets a COPY. Cannot modify the original.

Pointer receiver:  func (c *Circle) Scale(factor float64)
                   Gets a POINTER. Can modify the original.
```

```go
package main

import "fmt"

type Counter struct {
    Count int
}

func (c Counter) Value() int {
    return c.Count
}

func (c *Counter) Increment() {
    c.Count++
}

func (c *Counter) Reset() {
    c.Count = 0
}

func main() {
    c := Counter{}
    c.Increment()
    c.Increment()
    c.Increment()
    fmt.Println(c.Value())
    c.Reset()
    fmt.Println(c.Value())
}
```

Rule of thumb: if the method modifies the receiver or the struct is
large, use a pointer receiver. Be consistent — if one method uses
a pointer receiver, all should.

```
                  Use value receiver when:
                  +---------------------------+
                  | - Struct is small          |
                  | - Method doesn't mutate    |
                  | - You want immutability    |
                  +---------------------------+

                  Use pointer receiver when:
                  +---------------------------+
                  | - Method mutates state     |
                  | - Struct is large          |
                  | - Consistency with others  |
                  +---------------------------+
```

---

## Constructors (by Convention)

Go has no constructors. By convention, you write a `New` function:

```go
package main

import (
    "errors"
    "fmt"
)

type Server struct {
    host string
    port int
}

func NewServer(host string, port int) (*Server, error) {
    if host == "" {
        return nil, errors.New("host cannot be empty")
    }
    if port < 1 || port > 65535 {
        return nil, errors.New("invalid port")
    }
    return &Server{host: host, port: port}, nil
}

func (s *Server) Address() string {
    return fmt.Sprintf("%s:%d", s.host, s.port)
}

func main() {
    srv, err := NewServer("localhost", 8080)
    if err != nil {
        fmt.Println(err)
        return
    }
    fmt.Println(srv.Address())
}
```

Returning `*Server` (pointer) is standard. The struct escapes to
the heap — Go's compiler figures this out for you.

---

## Embedding: Go's Composition

This is where the Lego analogy comes alive. Instead of inheritance,
you embed one struct inside another. The inner struct's methods
get "promoted" to the outer struct.

```
Traditional inheritance:         Go embedding:

    Animal                       +------------------+
      |                          | Engine           |
    +---+---+                    |   Start()        |
    |       |                    |   Stop()         |
   Dog     Cat                   +------------------+
                                         |
                                 +------------------+
                                 | Car              |
                                 |   Engine  (embed)|
                                 |   Brand          |
                                 +------------------+
                                 Car.Start() works!
```

```go
package main

import "fmt"

type Engine struct {
    Horsepower int
}

func (e Engine) Start() string {
    return fmt.Sprintf("Engine started (%d HP)", e.Horsepower)
}

func (e Engine) Stop() string {
    return "Engine stopped"
}

type Car struct {
    Engine
    Brand string
    Model string
}

func main() {
    car := Car{
        Engine: Engine{Horsepower: 200},
        Brand:  "Toyota",
        Model:  "Camry",
    }

    fmt.Println(car.Start())
    fmt.Println(car.Stop())
    fmt.Println(car.Horsepower)
    fmt.Println(car.Brand, car.Model)
}
```

`car.Start()` works because `Engine` is embedded — its methods are
promoted. This is NOT inheritance. Car IS NOT an Engine. Car HAS an
Engine. In Rust terms, it's like deriving behavior through
composition, not subtyping.

### Multiple Embedding

```go
package main

import "fmt"

type Logger struct{}

func (l Logger) Log(msg string) {
    fmt.Println("[LOG]", msg)
}

type Metrics struct{}

func (m Metrics) Record(name string, value float64) {
    fmt.Printf("[METRIC] %s=%.2f\n", name, value)
}

type Service struct {
    Logger
    Metrics
    Name string
}

func main() {
    svc := Service{Name: "api-gateway"}
    svc.Log("starting service: " + svc.Name)
    svc.Record("uptime", 99.9)
}
```

Snap multiple Lego bricks together. The service gains logging AND
metrics capabilities through composition.

---

## Struct Tags

Tags attach metadata to fields. The standard library uses them for
JSON serialization, database mapping, and validation.

```go
package main

import (
    "encoding/json"
    "fmt"
)

type User struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Age      int    `json:"age,omitempty"`
    Password string `json:"-"`
}

func main() {
    u := User{
        Name:     "Alice",
        Email:    "alice@example.com",
        Password: "secret123",
    }

    data, _ := json.Marshal(u)
    fmt.Println(string(data))
}
```

`json:"-"` means "never serialize this field." Essential for keeping
secrets out of API responses.

---

## Comparison with Rust

```
+---------------------+------------------------+
| Concept             | Rust vs Go             |
+---------------------+------------------------+
| Define type         | struct {} + impl {}    |
|                     | type T struct {} +     |
|                     | func methods           |
+---------------------+------------------------+
| Visibility          | pub keyword            |
|                     | Uppercase first letter  |
+---------------------+------------------------+
| Composition         | Traits + generics      |
|                     | Embedding              |
+---------------------+------------------------+
| Constructors        | T::new()               |
|                     | NewT()                 |
+---------------------+------------------------+
| Immutability        | Default (use mut)      |
|                     | Value receiver = copy  |
+---------------------+------------------------+
```

---

## Exercises

1. Create a `Rectangle` struct with `Width` and `Height`. Add methods
   `Area()`, `Perimeter()`, and `IsSquare() bool`

2. Create a `Stack` struct backed by a slice with `Push`, `Pop`,
   `Peek`, and `IsEmpty` methods. Handle the empty-stack case

3. Build a `Person` struct that embeds an `Address` struct. Access
   address fields directly through `Person`

4. Create a `Config` struct with JSON tags. Write a function that
   marshals it to JSON and back. Verify round-trip correctness

5. Build a `LinkedList` using structs and pointers with `Append`,
   `Prepend`, and `Print` methods

---

[Next: Lesson 05 - Interfaces ->](05-interfaces.md)
