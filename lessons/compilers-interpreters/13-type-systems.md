# Lesson 13: Type Systems — Static vs Dynamic, Strong vs Weak

## What Is a Type?

A type is a classification that tells you what operations are valid on a piece of data. The integer `42` supports addition, subtraction, comparison. The string `"hello"` supports concatenation, length, substring. Try to subtract a string from an integer and you have a meaningless operation.

Every programming language has types. The question is *when* and *how* those types get checked.

## The Electrical Outlet Analogy

Think of types as electrical outlet standards around the world.

```
US Plug (Type A)        European Plug (Type C)       UK Plug (Type G)
  | |                      o o                        | | |
  | |                      o o                        |_|_|
```

A US plug (integer) physically cannot fit into a European socket (string function). The **shape** determines what connections are valid. You would not try to jam a US plug into a European socket and hope for the best — that is what happens when you add a number to a string in an untyped language.

**Static typing** checks at the factory — before the appliance ships, someone verifies that the plug matches the outlets in the destination country. If they do not match, the appliance never leaves the factory (the code never compiles).

**Dynamic typing** checks when you try to plug in — you ship the appliance, carry it to the wall, and only discover the mismatch when you try to use it (at runtime).

## Static vs Dynamic Typing

### Static Typing: Checked at Compile Time

The compiler examines your code *before* it runs and rejects programs with type errors.

**Go** — statically typed:

```go
package main

func add(a int, b int) int {
    return a + b
}

func main() {
    result := add(5, "hello")
    _ = result
}
```

This fails at compile time:

```
cannot use "hello" (untyped string constant) as int value in argument to add
```

You never run the program. The error is caught before any code executes.

**TypeScript** — statically typed:

```typescript
function add(a: number, b: number): number {
    return a + b;
}

add(5, "hello");  // Error at compile time
```

**Rust** — statically typed:

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn main() {
    add(5, "hello"); // Error at compile time
}
```

### Dynamic Typing: Checked at Runtime

The interpreter does not examine types until it actually executes the operation.

**Python** — dynamically typed:

```python
def add(a, b):
    return a + b

add(5, 10)       # Works fine — returns 15
add(5, "hello")  # TypeError at runtime: unsupported operand type(s)
```

**JavaScript** — dynamically typed:

```javascript
function add(a, b) {
    return a + b;
}

add(5, 10);       // 15
add(5, "hello");  // "5hello" — no error, just coercion (more on this below)
```

### The Tradeoff

```
Static Typing                          Dynamic Typing
─────────────────────────────────────  ─────────────────────────────────────
Errors caught before runtime           Errors only caught when code runs
More verbose (sometimes)               Less boilerplate
Compiler can optimize based on types   Flexibility for rapid prototyping
Refactoring is safer                   Smaller scripts are quicker to write
Go, Rust, TypeScript, Java, C          Python, JavaScript, Ruby, Lua
```

## Strong vs Weak Typing

This is a *separate* axis from static/dynamic. Strong vs weak describes how a language handles operations between mismatched types.

### Strong Typing: No Implicit Coercion

The language refuses to silently convert one type to another. If you mix types, you get an error.

**Go** — strongly typed:

```go
package main

import "fmt"

func main() {
    var x int = 5
    var y float64 = 3.14

    fmt.Println(x + y)
}
```

```
invalid operation: x + y (mismatched types int and float64)
```

Go will not silently convert `int` to `float64`. You must be explicit:

```go
package main

import "fmt"

func main() {
    var x int = 5
    var y float64 = 3.14

    fmt.Println(float64(x) + y)
}
```

**Python** — strongly typed (yes, dynamic but strong):

```python
5 + "hello"  # TypeError — Python refuses to coerce
```

### Weak Typing: Implicit Coercion

The language silently converts types to make operations work, even when the result is surprising.

**JavaScript** — weakly typed:

```javascript
5 + "hello"     // "5hello"  — number coerced to string
"5" - 3         // 2         — string coerced to number
true + true     // 2         — booleans coerced to numbers
[] + {}         // "[object Object]"
"" == false     // true
```

**C** — weakly typed:

```c
int x = 5;
float y = 3.14;
int result = x + y;  // y silently truncated to 3, result = 8
```

### The Two Axes Together

```
                    Strong                 Weak
                ┌──────────────────┬──────────────────┐
    Static      │  Go, Rust, Java  │  C, C++          │
                ├──────────────────┼──────────────────┤
    Dynamic     │  Python, Ruby    │  JavaScript, PHP │
                └──────────────────┴──────────────────┘
```

Go is in the safest quadrant: static (catches errors at compile time) and strong (no implicit coercion). JavaScript is in the least safe: dynamic (errors at runtime) and weak (silent coercion).

## Type Inference

Type inference means the compiler figures out types without you writing them explicitly. You get the safety of static typing with less verbosity.

**Go** — infers types with `:=`:

```go
package main

import "fmt"

func main() {
    x := 42          // compiler infers int
    name := "Alice"  // compiler infers string
    pi := 3.14       // compiler infers float64

    fmt.Printf("x: %T, name: %T, pi: %T\n", x, name, pi)
}
```

You did not write `var x int = 42`. The compiler sees `42` and infers `int`. But the type is still checked at compile time — `x` cannot later hold a string.

**TypeScript** — aggressive type inference:

```typescript
let x = 42;           // inferred as number
let name = "Alice";   // inferred as string

function add(a: number, b: number) {
    return a + b;     // return type inferred as number
}
```

**Rust** — infers types in most contexts:

```rust
fn main() {
    let x = 42;          // inferred as i32
    let name = "Alice";  // inferred as &str
    let nums: Vec<_> = vec![1, 2, 3]; // inferred element type i32
}
```

### How Inference Works (Simplified)

The compiler collects **constraints** from how values are used:

```go
x := getValue()      // x has type = return type of getValue
y := x + 10          // x must support +, 10 is int, so x must be int
z := fmt.Sprintf(x)  // x must be compatible with Sprintf's argument type
```

If constraints conflict, the compiler reports an error. If they are consistent, the compiler assigns the most specific type that satisfies all constraints.

## Structural Typing vs Nominal Typing

### Nominal Typing: Types Match by Name

Two types are the same only if they have the same declared name.

**Java** — nominal typing:

```java
class Dog { String name; }
class Cat { String name; }

Dog d = new Cat();  // ERROR — even though Dog and Cat have identical structure
```

Even though `Dog` and `Cat` have the exact same fields, Java treats them as different types because they have different names.

**Rust** — nominal typing for structs:

```rust
struct Meters(f64);
struct Feet(f64);

fn walk(distance: Meters) { }

fn main() {
    let d = Feet(100.0);
    walk(d); // ERROR — Feet is not Meters, even though both wrap f64
}
```

This is powerful for preventing unit-mixing bugs.

### Structural Typing: Types Match by Shape

Two types are compatible if they have the same structure (fields, methods), regardless of their declared names.

**TypeScript** — structural typing:

```typescript
interface Dog { name: string; speak(): void; }
interface Cat { name: string; speak(): void; }

function greet(animal: Dog) {
    console.log(animal.name);
}

const kitty: Cat = { name: "Whiskers", speak() { } };
greet(kitty);  // WORKS — Cat has the same shape as Dog
```

**Go interfaces** — structural typing:

```go
package main

import "fmt"

type Speaker interface {
    Speak() string
}

type Dog struct{ Name string }

func (d Dog) Speak() string {
    return "Woof!"
}

type Cat struct{ Name string }

func (c Cat) Speak() string {
    return "Meow!"
}

func greet(s Speaker) {
    fmt.Println(s.Speak())
}

func main() {
    greet(Dog{Name: "Rex"})
    greet(Cat{Name: "Whiskers"})
}
```

Neither `Dog` nor `Cat` explicitly declares "I implement Speaker." They just happen to have a `Speak() string` method, and that is enough. This is implicit interface satisfaction — a hallmark of Go's structural typing.

### Analogy

**Nominal typing** is like a formal invitation — you must have the right name on the guest list. **Structural typing** is like a dress code — anyone wearing a suit and tie gets in, regardless of who they are.

## Generics

Generics let you write code that works with any type while still being type-safe.

Without generics, you write the same function for every type:

```go
func MaxInt(a, b int) int {
    if a > b {
        return a
    }
    return b
}

func MaxFloat(a, b float64) float64 {
    if a > b {
        return a
    }
    return b
}

func MaxString(a, b string) string {
    if a > b {
        return a
    }
    return b
}
```

With generics (Go 1.18+):

```go
package main

import (
    "cmp"
    "fmt"
)

func Max[T cmp.Ordered](a, b T) T {
    if a > b {
        return a
    }
    return b
}

func main() {
    fmt.Println(Max(10, 20))
    fmt.Println(Max(3.14, 2.71))
    fmt.Println(Max("banana", "apple"))
}
```

`T` is a **type parameter**. `cmp.Ordered` is a **constraint** — it limits `T` to types that support `<`, `>`, `==`. The compiler generates specialized code for each type used.

**Rust generics**:

```rust
fn max<T: PartialOrd>(a: T, b: T) -> T {
    if a > b { a } else { b }
}
```

**TypeScript generics**:

```typescript
function max<T>(a: T, b: T): T {
    return a > b ? a : b;
}
```

### How Generics Are Compiled

Two strategies:

**Monomorphization** (Go, Rust): The compiler generates a separate copy of the function for each concrete type used. `Max[int]` becomes one function, `Max[float64]` becomes another. Fast at runtime, but increases binary size.

**Type erasure** (Java): Generic type information is removed at compile time. Everything becomes `Object` with casts. Smaller binary, but some runtime overhead and you cannot inspect generic types at runtime.

## Union Types and Sum Types

### Union Types (TypeScript)

A value that can be one of several types:

```typescript
type Result = string | number | null;

function process(value: Result) {
    if (typeof value === "string") {
        console.log(value.toUpperCase());
    } else if (typeof value === "number") {
        console.log(value * 2);
    } else {
        console.log("null value");
    }
}
```

The compiler tracks which type the value could be at each point and narrows it through control flow.

### Algebraic Data Types (Rust Enums)

Rust enums are sum types — each variant can carry different data:

```rust
enum Shape {
    Circle(f64),
    Rectangle(f64, f64),
    Triangle(f64, f64, f64),
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle(w, h) => w * h,
        Shape::Triangle(a, b, c) => {
            let s = (a + b + c) / 2.0;
            (s * (s - a) * (s - b) * (s - c)).sqrt()
        }
    }
}
```

The `match` is **exhaustive** — the compiler forces you to handle every variant. If you add a new variant to `Shape`, every `match` on `Shape` across your codebase will fail to compile until updated.

### Encoding Sum Types in Go

Go does not have native union types or algebraic data types. The common pattern uses interfaces:

```go
package main

import (
    "fmt"
    "math"
)

type Shape interface {
    Area() float64
}

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return math.Pi * c.Radius * c.Radius
}

type Rectangle struct {
    Width, Height float64
}

func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

func describe(s Shape) {
    switch v := s.(type) {
    case Circle:
        fmt.Printf("Circle with radius %.2f, area %.2f\n", v.Radius, v.Area())
    case Rectangle:
        fmt.Printf("Rectangle %0.f x %.0f, area %.2f\n", v.Width, v.Height, v.Area())
    default:
        fmt.Printf("Unknown shape, area %.2f\n", v.Area())
    }
}

func main() {
    shapes := []Shape{
        Circle{Radius: 5},
        Rectangle{Width: 4, Height: 6},
    }

    for _, s := range shapes {
        describe(s)
    }
}
```

The downside: Go's type switch is not exhaustive. Adding a new `Shape` implementation does not force you to update existing switch statements. Rust's `match` catches this; Go's does not.

## The Hindley-Milner Type System (Brief)

Hindley-Milner (HM) is a type inference algorithm used by Haskell, OCaml, F#, and (partially) Rust and TypeScript. It can infer the types of an entire program without any type annotations.

The core idea: every expression generates **constraints** (equations between types). The algorithm solves these equations using **unification** — finding the most general type that satisfies all constraints.

```
Example inference:

let f = fun x -> x + 1

Step 1: x has unknown type T1
Step 2: (+) requires (int, int) -> int
Step 3: x + 1 means T1 must be int
Step 4: f has type int -> int
```

For our purposes, HM is important because it shows that type inference is not guessing — it is solving equations. The more complex the type system, the harder (or impossible) full inference becomes. That is why Rust sometimes needs type annotations where Haskell does not, and Go took a simpler approach with inference only for local variables.

## Type Systems in Language Design: Tradeoffs

```
Feature            Benefit                      Cost
──────────────────────────────────────────────────────────────────
Static typing      Catch errors early            More verbose
Dynamic typing     Rapid prototyping             Errors at runtime
Strong typing      No surprise coercions         Must convert explicitly
Weak typing        Fewer conversions to write    Subtle bugs
Type inference     Less boilerplate              Harder error messages
Generics           Code reuse with safety        Complex syntax/errors
Union types        Model "one of" cleanly        Need exhaustive handling
Nominal typing     Prevent unit-mixing bugs      Rigid, need adapters
Structural typing  Flexible, implicit contracts  Less explicit intent
```

Every language makes different choices along these axes. Go chose static + strong + structural interfaces + limited inference + generics (added later). TypeScript chose static + structural + aggressive inference + union types + generics. Rust chose static + strong + nominal + inference + generics + algebraic data types.

## How This Connects to Our Language

In lessons 14 and 15, we will add a type system to the language we have been building. We will:

1. Add type annotations to our AST (`let x: int = 5`)
2. Build a type checker that walks the AST and verifies types match
3. Implement type inference for simple cases
4. Catch errors like `"hello" + 5` at compile time

This is the bridge between the interpreter we built (Phase 2) and the compiler we will build (Phase 4).

---

## Exercises

### Exercise 1: Type Classification

For each expression, predict whether it would be accepted or rejected in Go, TypeScript, JavaScript, and Python:

```
a) 5 + 3.14
b) "hello" + 5
c) true + 1
d) 5 / 0
e) "5" == 5
```

Build a table:

```
Expression    | Go      | TypeScript | JavaScript | Python
─────────────────────────────────────────────────────────────
5 + 3.14      | ???     | ???        | ???        | ???
"hello" + 5   | ???     | ???        | ???        | ???
...
```

### Exercise 2: Structural vs Nominal

Write a Go program with two structs — `Email` and `SMS` — that both have a `Send(to string, body string) error` method. Create an interface `Notifier` without either struct explicitly implementing it. Demonstrate that both work with a function that takes a `Notifier`.

Then write the Rust equivalent showing how you would need explicit `impl Notifier for Email` and `impl Notifier for SMS`.

### Exercise 3: Generic Stack

Implement a generic stack in Go:

```go
type Stack[T any] struct {
    items []T
}

func (s *Stack[T]) Push(item T) { ... }
func (s *Stack[T]) Pop() (T, bool) { ... }
func (s *Stack[T]) Peek() (T, bool) { ... }
func (s *Stack[T]) Len() int { ... }
```

Test it with `Stack[int]`, `Stack[string]`, and `Stack[Shape]` where `Shape` is the interface from earlier.

### Exercise 4: Type Inference Trace

For the following Go code, trace what the compiler infers for each variable:

```go
func mystery() {
    a := 42
    b := a + 8
    c := float64(b) / 3.0
    d := fmt.Sprintf("%.2f", c)
    e := len(d)
    f := e > 5
    g := map[string]bool{d: f}
    _ = g
}
```

Write the inferred type of `a` through `g`.

### Exercise 5: Design Your Type System

If you were designing a new language, which choices would you make for each axis? Write a one-paragraph justification for each:

1. Static or dynamic?
2. Strong or weak?
3. Structural or nominal?
4. Type inference — how much?
5. Generics — yes or no? Constraints?
6. Union types / algebraic data types?

Consider what kinds of programs you typically write and what bugs you most commonly encounter.
