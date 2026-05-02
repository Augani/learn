# Lesson 02: Basics

## Variables and Types

Go is statically typed like Rust, but with type inference that
feels lighter. Think of types as labels on boxes — the box shape
is fixed at compile time, but Go usually figures out the label
for you.

### Declaration Styles

```go
package main

import "fmt"

func main() {
    var name string = "Alice"
    var age int = 30
    var active bool = true

    city := "Portland"
    score := 98.5

    var count int
    fmt.Println(name, age, active, city, score, count)
}
```

The `:=` operator is short variable declaration — Go infers the
type. It only works inside functions.

```
Rust equivalent             Go equivalent
-----------------           -----------------
let name = "Alice";         name := "Alice"
let mut count = 0;          count := 0
let name: String = ...      var name string = ...
```

### Zero Values

Every type has a zero value. No `None`, no `null` surprises on
basic types.

```
+----------+------------+
| Type     | Zero Value |
+----------+------------+
| int      | 0          |
| float64  | 0.0        |
| string   | ""         |
| bool     | false      |
| pointer  | nil        |
| slice    | nil        |
| map      | nil        |
+----------+------------+
```

In Rust, you'd use `Option<T>` to represent absence. In Go, you
check for zero values or nil. This is a trade-off: less ceremony,
but you must be vigilant about nil.

---

## Basic Types

```go
package main

import "fmt"

func main() {
    var i int = 42
    var f float64 = 3.14
    var b bool = true
    var s string = "hello"
    var by byte = 'A'
    var r rune = 'Z'

    fmt.Printf("int: %d, float: %f, bool: %t, string: %s\n", i, f, b, s)
    fmt.Printf("byte: %d, rune: %d\n", by, r)
}
```

```
Go type       Size        Rust equivalent
---------     --------    ---------------
int           platform    isize
int8          1 byte      i8
int32         4 bytes     i32
int64         8 bytes     i64
uint          platform    usize
float32       4 bytes     f32
float64       8 bytes     f64
bool          1 byte      bool
string        varies      String (but immutable)
byte          1 byte      u8
rune          4 bytes     char
```

Important: Go strings are immutable, UTF-8 encoded byte sequences.
Like Rust's `&str`, but owned. A `rune` is a Unicode code point.

---

## Constants

```go
package main

import "fmt"

const Pi = 3.14159
const MaxRetries = 3

const (
    StatusOK    = 200
    StatusError = 500
)

func main() {
    fmt.Println(Pi, MaxRetries, StatusOK)
}
```

Go constants are untyped until used — they're more flexible than
Rust's `const` in that regard.

### Iota: Auto-incrementing Constants

```go
package main

import "fmt"

type Weekday int

const (
    Sunday Weekday = iota
    Monday
    Tuesday
    Wednesday
    Thursday
    Friday
    Saturday
)

func main() {
    fmt.Println(Monday, Friday)
}
```

Think of `iota` as Go's version of Rust's C-like enums. It auto-
increments starting from 0.

---

## Control Flow

### If / Else

```go
package main

import "fmt"

func classify(score int) string {
    if score >= 90 {
        return "A"
    } else if score >= 80 {
        return "B"
    } else {
        return "C"
    }
}

func main() {
    fmt.Println(classify(85))
}
```

Go's `if` can include an init statement:

```go
if err := doSomething(); err != nil {
    return err
}
```

This pattern is everywhere in Go. The `err` is scoped to the `if`.

### For Loops

Go has only `for`. No `while`, no `loop`. One keyword, three forms:

```go
package main

import "fmt"

func main() {
    for i := 0; i < 5; i++ {
        fmt.Println(i)
    }

    count := 0
    for count < 3 {
        fmt.Println(count)
        count++
    }

    for {
        fmt.Println("infinite")
        break
    }
}
```

```
Rust                    Go
----                    --
for i in 0..5           for i := 0; i < 5; i++
while cond {}           for cond {}
loop {}                 for {}
for item in vec {}      for i, item := range slice {}
```

### Switch

```go
package main

import "fmt"

func describe(x int) string {
    switch {
    case x < 0:
        return "negative"
    case x == 0:
        return "zero"
    default:
        return "positive"
    }
}

func main() {
    fmt.Println(describe(-5))
    fmt.Println(describe(0))
    fmt.Println(describe(42))
}
```

No `break` needed — Go switches don't fall through by default.
Use `fallthrough` explicitly if you want it (rare).

---

## Functions

```go
package main

import (
    "errors"
    "fmt"
)

func add(a, b int) int {
    return a + b
}

func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

func swap(a, b string) (string, string) {
    return b, a
}

func main() {
    sum := add(3, 4)
    fmt.Println(sum)

    result, err := divide(10, 3)
    if err != nil {
        fmt.Println("error:", err)
        return
    }
    fmt.Println(result)

    x, y := swap("hello", "world")
    fmt.Println(x, y)
}
```

Multiple return values are Go's answer to Rust's `Result<T, E>`.
You'll write `(value, error)` hundreds of times. Get used to it.

### Named Return Values

```go
func divide(a, b float64) (result float64, err error) {
    if b == 0 {
        err = errors.New("division by zero")
        return
    }
    result = a / b
    return
}
```

Named returns act as documentation. Use sparingly — naked returns
can hurt readability in long functions.

### First-Class Functions

```go
package main

import "fmt"

func apply(nums []int, fn func(int) int) []int {
    result := make([]int, len(nums))
    for i, n := range nums {
        result[i] = fn(n)
    }
    return result
}

func main() {
    doubled := apply([]int{1, 2, 3}, func(n int) int {
        return n * 2
    })
    fmt.Println(doubled)
}
```

Functions are values in Go, just like in Rust. But Go doesn't have
iterators or map/filter/reduce built in. You write loops.

---

## Pointers

Go has pointers but no pointer arithmetic. Think of them as Rust's
`&mut` references, but without the borrow checker.

```go
package main

import "fmt"

func increment(n *int) {
    *n++
}

func main() {
    x := 10
    increment(&x)
    fmt.Println(x)

    p := &x
    fmt.Println(*p)
}
```

```
Rust               Go
----               --
&x                 &x
&mut x             &x (no distinction)
*x                 *x
Box<T>             *T (heap via new or &)
```

No borrow checker means no lifetime annotations, but also no
compiler-enforced safety. Data races are possible.

---

## Exercises

1. Write a function `fizzBuzz(n int) string` that returns "Fizz",
   "Buzz", "FizzBuzz", or the number as a string

2. Write a function `celsiusToFahrenheit(c float64) float64`

3. Write a function `isPalindrome(s string) bool` that checks if a
   string reads the same forwards and backwards

4. Write a function `max(nums ...int) (int, error)` that returns the
   maximum of a variadic number of ints, or an error if empty

5. Rewrite #4 using a pointer parameter instead of returning the
   value

---

[Next: Lesson 03 - Slices & Maps ->](03-slices-maps.md)
