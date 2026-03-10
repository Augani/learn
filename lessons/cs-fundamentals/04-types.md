# Lesson 4: Types and Type Systems

## What Is a Type, Really?

Imagine you're hiring movers to relocate your apartment. You label every box:
"BOOKS — Heavy, 50 lbs" or "GLASSES — Fragile, this side up." The label tells
the movers two things: **how to handle it** and **what to expect inside**.

A type in programming does exactly the same thing. It tells the compiler (or
runtime) two facts about a piece of data:

1. **How much memory does it occupy?** (the size of the box)
2. **What operations are valid?** (can you stack other boxes on top, or is it fragile?)

That's it. Every type system in every language boils down to answering those
two questions.

```
  ┌──────────────────────────────────────────┐
  │  TYPE = Memory Layout + Valid Operations  │
  │                                           │
  │  i32:   4 bytes,  can add/sub/mul/div     │
  │  bool:  1 byte,   can AND/OR/NOT          │
  │  &str:  pointer,  can search/slice/print  │
  └──────────────────────────────────────────┘
```

---

## The Size Table: How Big Are Common Types?

Think of memory like a warehouse with numbered shelves. Each type needs a
certain number of shelf slots:

```
  Type          Size        Analogy
  ─────────────────────────────────────────────────
  bool          1 byte      A light switch (on/off)
  u8 / i8       1 byte      A single mailbox slot
  i32 / u32     4 bytes     A shoebox
  i64 / u64     8 bytes     A boot box
  f32           4 bytes     A shoebox (but stores decimals)
  f64           8 bytes     A boot box (but stores decimals)
  pointer       8 bytes     A sticky note with an address
  String        24 bytes*   An index card (ptr + len + capacity)
                            *on the stack — actual text lives on the heap
```

The `String` one surprises people. On the stack, a Rust `String` is 24 bytes:
an 8-byte pointer to heap data, an 8-byte length, and an 8-byte capacity. The
actual characters live somewhere else in memory (the heap). It's like a
library catalog card — the card is small and fixed-size, but it points to a
book that could be any length.

```
  Stack (24 bytes)              Heap (variable)
  ┌──────────────────┐         ┌─────────────────────┐
  │ ptr:  0x7f3a...  │────────▶│ H e l l o ,   w o r │
  │ len:  12         │         │ l d !               │
  │ cap:  16         │         └─────────────────────┘
  └──────────────────┘
```

---

## Static vs Dynamic Typing: The Immigration Checkpoint

**Static typing** (Rust, Go, TypeScript, Java) is like an immigration
checkpoint at the border. Your passport (type) is checked **once when you
enter the country** (at compile time). If it's invalid, you don't get in. But
once you're inside, nobody stops you to ask for ID — you've already been
verified.

**Dynamic typing** (Python, JavaScript, Ruby) is like a country with no border
checkpoint. Anyone can enter freely. But every time you walk into a store, a
bar, a hotel, someone asks to see your ID. Types are checked **at runtime**,
every time an operation happens.

```
  STATIC TYPING (Rust, Go)
  ┌─────────┐     ✓ passport       ┌───────────────────┐
  │ Program │───── checked at ─────▶│ Running program   │
  │ source  │     compile time      │ (no more checks)  │
  └─────────┘                       └───────────────────┘

  DYNAMIC TYPING (Python)
  ┌─────────┐     no passport       ┌───────────────────┐
  │ Program │───── needed ──────────▶│ Running program   │
  │ source  │                       │ (ID at every door) │
  └─────────┘                       └───────────────────┘
```

Neither is "better" — they're tradeoffs. Static typing catches errors earlier
but requires more upfront ceremony. Dynamic typing is faster to prototype with
but lets bugs hide until runtime.

```python
# Python (dynamic): this runs fine... until line 3 actually executes
def greet(name):
    return "Hello, " + name

greet(42)  # Runtime error: can't concatenate str and int
```

```rust
// Rust (static): the compiler catches this before any code runs
fn greet(name: &str) -> String {
    format!("Hello, {}", name)
}

// greet(42);  // Compile error: expected &str, found integer
```

```go
// Go (static): same idea
func greet(name string) string {
    return "Hello, " + name
}

// greet(42)  // Compile error: cannot use 42 (int) as string
```

---

## Type Inference: The Compiler as Detective

You might think static typing means writing types everywhere. Not so. Modern
compilers are like detectives who deduce the type from context.

If you hand a detective a glass of red liquid at a crime scene and say "analyze
this," they don't need you to write "WINE" on the label. They figure it out.

```rust
// Rust: the compiler infers types from context
let x = 42;          // inferred as i32 (default integer type)
let y = 3.14;        // inferred as f64 (default float type)
let name = "Alice";  // inferred as &str
let nums = vec![1, 2, 3];  // inferred as Vec<i32>

// You CAN be explicit when you want to:
let z: u8 = 255;
```

```go
// Go: short variable declarations infer the type
x := 42          // inferred as int
y := 3.14        // inferred as float64
name := "Alice"  // inferred as string
```

```python
# Python: types are inferred at runtime (dynamic typing)
x = 42          # int
y = 3.14        # float
name = "Alice"  # str

# Type hints exist but are optional and not enforced:
age: int = 30
```

```typescript
// TypeScript: excellent inference
let x = 42;          // inferred as number
let name = "Alice";  // inferred as string
let nums = [1, 2, 3]; // inferred as number[]
```

Type inference gives you the safety of static typing with much of the
convenience of dynamic typing. The detective does the work for you.

---

## Strong vs Weak Typing: The Strict Teacher vs the Lenient One

This is a different axis from static/dynamic. It's about how much a language
**coerces** (automatically converts) types.

**Strong typing** is the strict teacher who says: "You wrote '5' as a string
and 3 as a number. I refuse to add these. Be explicit about what you want."

**Weak typing** is the lenient teacher who says: "You probably meant the
number 5, so I'll convert it for you. '5' + 3 = '53'. Wait, is that what
you wanted?"

```python
# Python (strong + dynamic): refuses to guess
result = "5" + 3    # TypeError: can only concatenate str to str
result = int("5") + 3  # 8 — you must be explicit
```

```javascript
// JavaScript (weak + dynamic): guesses (often wrong)
"5" + 3     // "53"  (concatenates strings)
"5" - 3     // 2     (suddenly does math)
"5" * "3"   // 15    (why not)
true + true // 2     (sure, booleans are numbers now)
```

```
  ┌───────────────────────────────────────────────┐
  │              Strong          Weak              │
  │            ┌────────────┬────────────┐         │
  │   Static  │ Rust, Go,  │ C          │         │
  │           │ TypeScript │            │         │
  │           ├────────────┼────────────┤         │
  │   Dynamic │ Python,    │ JavaScript,│         │
  │           │ Ruby       │ PHP, Perl  │         │
  │           └────────────┴────────────┘         │
  └───────────────────────────────────────────────┘
```

The two axes are independent. Rust is static + strong. JavaScript is dynamic +
weak. Python is dynamic + strong.

---

## Generics: The Universal Vending Machine

Imagine a vending machine at a gym. It dispenses drinks. You want one machine
that works for **any drink size** — small cans, large bottles, juice boxes.
The constraint is that the item must **fit in the slot**. You don't build a
separate machine for each drink.

Generics are that universal vending machine. You write one function or data
structure that works with **any type** meeting certain constraints.

```rust
// Rust: a function that works with any type that can be displayed
fn print_item<T: std::fmt::Display>(item: T) {
    println!("Item: {}", item);
}

print_item(42);        // T = i32
print_item("hello");   // T = &str
print_item(3.14);      // T = f64

// A generic struct: a box that holds anything
struct Box<T> {
    contents: T,
}

let int_box = Box { contents: 42 };
let str_box = Box { contents: "hello" };
```

```go
// Go: generics (added in Go 1.18)
func PrintItem[T any](item T) {
    fmt.Println("Item:", item)
}

// With constraints:
func Max[T interface{ int | float64 | string }](a, b T) T {
    if a > b {
        return a
    }
    return b
}
```

```typescript
// TypeScript: generics
function printItem<T>(item: T): void {
    console.log("Item:", item);
}

// With constraints:
function longest<T extends { length: number }>(a: T, b: T): T {
    return a.length >= b.length ? a : b;
}
```

```python
# Python: type hints with generics (3.12+ syntax)
def first[T](items: list[T]) -> T:
    return items[0]

# Older syntax:
from typing import TypeVar
T = TypeVar('T')
def first(items: list[T]) -> T:
    return items[0]
```

The key insight: generics let you write code once and reuse it for many types,
while still keeping type safety. The compiler generates specialized code for
each concrete type you use — no runtime cost.

---

## Sum Types and Enums: This OR That, Never Both

Imagine a mailroom. A package arrives and it's **either** a letter **or** a
parcel — never both at the same time. You handle each differently: letters go
to the mail slot, parcels go to the shelf.

Sum types model this "one of several possibilities" idea. Rust's `enum` is the
gold standard here.

```rust
// A value is either an integer or a float or a string — one at a time
enum Value {
    Integer(i32),
    Float(f64),
    Text(String),
}

// Rust's built-in Option: a value is either present or absent
// enum Option<T> {
//     Some(T),
//     None,
// }

// Rust's built-in Result: an operation either succeeded or failed
// enum Result<T, E> {
//     Ok(T),
//     Err(E),
// }

fn divide(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 {
        None              // No result — division by zero
    } else {
        Some(a / b)       // Here's your answer
    }
}

// The compiler FORCES you to handle both cases:
match divide(10.0, 3.0) {
    Some(result) => println!("Result: {}", result),
    None => println!("Cannot divide by zero"),
}
```

### Memory Layout of Option<i32>

This is where it gets interesting. How does the computer store "either a value
or nothing"?

```
  Option<i32> = 8 bytes total (4 for tag + 4 for data)

  None:                          Some(42):
  ┌──────────┬──────────┐       ┌──────────┬──────────┐
  │ tag: 0   │ unused   │       │ tag: 1   │ 42       │
  │ (4 bytes)│ (4 bytes)│       │ (4 bytes)│ (4 bytes)│
  └──────────┴──────────┘       └──────────┴──────────┘
     "empty"                       "has a value"

  The "tag" (also called "discriminant") tells you which variant
  is active. It's like the label on the mailroom package.
```

Go and Python don't have true sum types, but they approximate them:

```go
// Go: uses interfaces or pointer nilability (less safe)
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, fmt.Errorf("division by zero")
    }
    return a / b, nil
}

result, err := divide(10.0, 3.0)
if err != nil {
    fmt.Println("Error:", err)
} else {
    fmt.Println("Result:", result)
}
```

```python
# Python: uses None or exceptions (less type-safe)
def divide(a: float, b: float) -> float | None:
    if b == 0:
        return None
    return a / b

result = divide(10.0, 3.0)
if result is not None:
    print(f"Result: {result}")
else:
    print("Cannot divide by zero")
```

The advantage of Rust's approach: the **compiler won't let you forget** to
handle the `None` or `Err` case. In Go and Python, you can accidentally ignore
the error and your program will happily continue with bad data.

---

## Zero-Cost Abstractions: Nice Syntax, No Performance Penalty

Imagine a restaurant where the menu is in plain English ("grilled salmon with
lemon butter") but the kitchen ticket is in terse shorthand ("GS-LB-86P").
The customer gets a nice readable experience. The kitchen gets efficiency.
Nobody pays extra for the translation — the waiter does it automatically.

That's a zero-cost abstraction. You write high-level, readable code, and the
compiler translates it into the same machine code you'd get from writing
low-level code by hand.

```rust
// This high-level iterator chain:
let sum: i32 = (1..=100)
    .filter(|x| x % 2 == 0)
    .map(|x| x * x)
    .sum();

// Compiles to essentially the same machine code as:
let mut sum: i32 = 0;
let mut i = 1;
while i <= 100 {
    if i % 2 == 0 {
        sum += i * i;
    }
    i += 1;
}

// The abstraction (iterators, closures) costs ZERO at runtime.
// The compiler optimizes it all away.
```

This is a core design principle of Rust and C++: you should never have to
choose between readable code and fast code. The compiler bridges the gap.

---

## Common Type Pitfalls

### Pitfall 1: Integer Overflow

Integers have a maximum value. When you exceed it, the number "wraps around"
like a car odometer rolling from 999999 to 000000.

```rust
// Rust (debug mode): panics on overflow — catches the bug
let x: u8 = 255;
// let y = x + 1;  // panic: attempt to add with overflow

// Rust (release mode): wraps silently by default
// 255 + 1 = 0 for u8
```

```go
// Go: wraps silently — be careful!
var x uint8 = 255
x = x + 1
fmt.Println(x) // 0
```

```python
# Python: integers have unlimited size — no overflow!
x = 2 ** 1000  # a number with 302 digits. No problem.
```

### Pitfall 2: Floating Point Imprecision

Computers store decimals in binary, and most decimal fractions can't be
represented exactly. It's like trying to write 1/3 in decimal — you get
0.33333... forever, never exact.

```python
# This is true in EVERY language that uses IEEE 754 floats:
print(0.1 + 0.2)         # 0.30000000000000004
print(0.1 + 0.2 == 0.3)  # False!
```

```rust
fn main() {
    let x = 0.1_f64 + 0.2_f64;
    println!("{}", x);           // 0.30000000000000004
    println!("{}", x == 0.3);    // false

    // Compare with an epsilon instead:
    let epsilon = 1e-10;
    println!("{}", (x - 0.3).abs() < epsilon);  // true
}
```

```go
package main

import (
    "fmt"
    "math"
)

func main() {
    x := 0.1 + 0.2
    fmt.Println(x)          // 0.30000000000000004
    fmt.Println(x == 0.3)   // false

    // Use an epsilon for comparison:
    fmt.Println(math.Abs(x-0.3) < 1e-10)  // true
}
```

**Rule of thumb**: never compare floats with `==`. Always use an epsilon
(small tolerance). For money, use integers (cents) or a decimal library.

---

## Putting It All Together

```
  ┌─────────────────────────────────────────────────────────┐
  │               THE TYPE SYSTEM LANDSCAPE                 │
  │                                                         │
  │  Static ◄─────────────────────────────────► Dynamic     │
  │  (check at compile time)       (check at runtime)       │
  │     Rust, Go, TS, Java         Python, Ruby, JS         │
  │                                                         │
  │  Strong ◄─────────────────────────────────► Weak        │
  │  (no implicit coercion)        (implicit coercion)      │
  │     Rust, Python, Go           JavaScript, C, PHP       │
  │                                                         │
  │  Inferred ◄───────────────────────────────► Explicit    │
  │  (compiler deduces types)      (you annotate everything)│
  │     Rust, TS, Kotlin           Java (older), C          │
  │                                                         │
  │  Sum types ◄──────────────────────────────► No sum types│
  │  (Option, Result, enum)        (null, exceptions)       │
  │     Rust, Haskell, TS          Go, Java (older), C      │
  └─────────────────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Type Sizes
Without running the code, predict the stack size of each Rust type. Then
verify with `std::mem::size_of::<T>()`:
- `bool`
- `i32`
- `f64`
- `(i32, i32)`
- `Option<i32>`
- `Option<bool>`
- `&str`

### Exercise 2: Spot the Type Error
Which of these will fail at compile time (static) vs runtime (dynamic)?
```python
# Python
x = "hello"
y = x + 5
```
```rust
// Rust
let x = "hello";
let y = x + 5;
```
```javascript
// JavaScript
let x = "hello";
let y = x + 5;
```

### Exercise 3: Build a Generic
Write a generic function `max_of_three` that returns the largest of three
values. Implement it in Rust (with `PartialOrd` constraint), Go (with
`constraints.Ordered`), and Python (with type hints).

### Exercise 4: Option Handling
Write a Rust function `safe_divide(a: f64, b: f64) -> Option<f64>` that
returns `None` for division by zero. Then write a caller that uses `match`,
`if let`, and `unwrap_or` to handle the result — three different ways.

### Exercise 5: Float Comparison
Write a function `approx_equal(a: f64, b: f64, epsilon: f64) -> bool` in
Rust. Test it with `0.1 + 0.2` and `0.3`. Then try with increasingly small
epsilon values and observe when it starts returning `false`.

### Exercise 6: Enum Design
Design a Rust enum `Shape` with variants `Circle(f64)` (radius),
`Rectangle(f64, f64)` (width, height), and `Triangle(f64, f64, f64)` (three
sides). Write an `area()` method for it. What happens if you add a new variant
later — does the compiler help you find all the places that need updating?
