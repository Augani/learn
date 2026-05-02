# Lesson 03: Pattern Matching, Enums, Option, Result

This is where Rust's type system starts feeling expressive instead of strict.
Enums let values have rich shapes, and pattern matching lets you handle each
shape explicitly and safely.

---

**Keywords in this lesson:** [enum](./reference-rust-glossary.md#enum),
[pattern matching](./reference-rust-glossary.md#pattern-matching),
[Option](./reference-rust-glossary.md#option),
[Result](./reference-rust-glossary.md#result)

## Why Enums and Pattern Matching Matter

Programs constantly deal with values that can be in different states:

- a request succeeded or failed
- a user exists or does not
- a message is text, binary data, or a disconnect signal

Many languages represent those states loosely with `null`, flags, magic
strings, or comments. Rust prefers making the states explicit in the type.

That is why enums and `match` show up everywhere in Rust code.

## Enums — Not Your Grandma's Enums

In some languages, enums are just named constants. In Rust, enums can
**carry data**. This changes everything.

### Basic enum

```rust
enum Direction {
    North,
    South,
    East,
    West,
}

fn describe(dir: Direction) -> &'static str {
    match dir {
        Direction::North => "Going up",
        Direction::South => "Going down",
        Direction::East => "Going right",
        Direction::West => "Going left",
    }
}
```

### Enums with data (Rust superpower)

```rust
enum Shape {
    Circle(f64),                    // radius
    Rectangle(f64, f64),            // width, height
    Triangle { a: f64, b: f64, c: f64 },  // named fields
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle(w, h) => w * h,
        Shape::Triangle { a, b, c } => {
            let s = (a + b + c) / 2.0;
            (s * (s - a) * (s - b) * (s - c)).sqrt()
        }
    }
}
```

The key idea is that one type can represent several well-defined cases,
and the compiler can force you to handle them all.

---

## Pattern Matching with `match`

`match` is a supercharged switch statement. It MUST be exhaustive — you
must handle every possible case.

```rust
fn describe_number(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1..=9 => "single digit",
        10 | 20 | 30 => "round tens",
        _ => "something else",      // _ is the catch-all (like default)
    }
}
```

### Destructuring in match

```rust
fn process_point(point: (i32, i32)) {
    match point {
        (0, 0) => println!("origin"),
        (x, 0) => println!("on x-axis at {x}"),
        (0, y) => println!("on y-axis at {y}"),
        (x, y) => println!("at ({x}, {y})"),
    }
}
```

### `if let` — when you only care about one case

```rust
let value = Some(42);

// Instead of a full match:
if let Some(n) = value {
    println!("Got: {n}");
}
// else branch is optional

```

---

## Option<T> — Rust's Type for "Maybe There Is a Value"

There is NO null in Rust. Instead, the type system tells you when a value
might be absent.

```rust
enum Option<T> {     // this is built into the language
    Some(T),         // there's a value
    None,            // there's no value
}
```

### Using Option

```rust
fn find_user(id: u64) -> Option<String> {
    if id == 1 {
        Some(String::from("Augustus"))
    } else {
        None
    }
}

fn main() {
    match find_user(1) {
        Some(name) => println!("Found: {name}"),
        None => println!("Not found"),
    }

    // Or more concisely:
    if let Some(name) = find_user(1) {
        println!("Found: {name}");
    }
}
```

**The difference:** In Rust, you literally CANNOT access the inner value
without handling the None case. The compiler forces you.

### Option methods (the good stuff)

```rust
fn main() {
    let maybe_name: Option<String> = Some(String::from("Augustus"));

    // unwrap_or — provide a default
    let name = maybe_name.unwrap_or(String::from("Anonymous"));

    // map — transform the inner value if present
    let maybe_len: Option<usize> = Some("hello").map(|s| s.len());

    // and_then — chain operations that return Option (flatMap)
    let result = Some("42")
        .and_then(|s| s.parse::<i32>().ok());  // Some(42)

    // unwrap — get the value or PANIC (use sparingly!)
    let value = Some(42).unwrap();  // 42
    // None.unwrap();               // PANIC at runtime — avoid this

    // ? operator in functions returning Option
    let first_char = get_first_char("hello");
    println!("{first_char:?}");
}

fn get_first_char(s: &str) -> Option<char> {
    let ch = s.chars().next()?;  // returns None early if empty
    Some(ch.to_uppercase().next()?)
}
```

---

## Result<T, E> — Rust's Success-or-Error Type

This is how Rust handles errors. No exceptions, no panics (usually).

```rust
enum Result<T, E> {    // built into the language
    Ok(T),             // success with value
    Err(E),            // failure with error
}
```

### Basic usage

```rust
use std::num::ParseIntError;

fn parse_age(input: &str) -> Result<u32, ParseIntError> {
    input.parse::<u32>()
}

fn main() {
    match parse_age("25") {
        Ok(age) => println!("Age: {age}"),
        Err(e) => println!("Error: {e}"),
    }
}
```

### The ? operator — Rust's killer feature for error handling

This means: "if this failed, return the error early; otherwise unwrap the
successful value and keep going."

```rust
use std::fs;
use std::io;

fn read_username() -> Result<String, io::Error> {
    let content = fs::read_to_string("username.txt")?;  // ? = return Err early
    Ok(content.trim().to_string())
}

// What ? expands to:
fn read_username_verbose() -> Result<String, io::Error> {
    let content = match fs::read_to_string("username.txt") {
        Ok(c) => c,
        Err(e) => return Err(e),   // early return on error
    };
    Ok(content.trim().to_string())
}
```

### Chaining with ?

```rust
use std::fs;
use std::io;

fn get_first_line(path: &str) -> Result<String, io::Error> {
    let content = fs::read_to_string(path)?;
    let line = content
        .lines()
        .next()
        .ok_or(io::Error::new(io::ErrorKind::NotFound, "empty file"))?;
    Ok(line.to_string())
}
```

Every `?` is a potential early return, but the surrounding function
signature makes that behavior explicit.

---

## Why This Style Helps

`Option` and `Result` work well together because they force you to model:

- what states are possible
- which states are expected
- what the caller must handle

That tends to produce code that is easier to read later, because the control
flow is visible in the types instead of hidden in special sentinel values.

## `unwrap()` vs `expect()` vs `?`

| Method | What it does | When to use |
|--------|-------------|-------------|
| `?` | Return error to caller | Production code — always prefer this |
| `.unwrap()` | Panic on None/Err | Tests, prototyping, truly impossible cases |
| `.expect("msg")` | Panic with message | Same as unwrap but with context |
| `.unwrap_or(default)` | Use default on None/Err | When you have a sensible fallback |
| `.unwrap_or_else(fn)` | Compute default lazily | When default is expensive to create |

---

## Exercises

### Exercise 1: Implement a safe division function
```rust
fn safe_divide(a: f64, b: f64) -> Option<f64> {
    // return None if b is 0, Some(result) otherwise
    todo!()
}
```

### Exercise 2: Chain Option operations
```rust
fn parse_and_double(input: &str) -> Option<i32> {
    // parse the string as i32, then double it
    // return None if parsing fails
    todo!()
}
```

### Exercise 3: Use ? to simplify this
```rust
use std::num::ParseIntError;

fn add_strings(a: &str, b: &str) -> Result<i32, ParseIntError> {
    let x = match a.parse::<i32>() {
        Ok(v) => v,
        Err(e) => return Err(e),
    };
    let y = match b.parse::<i32>() {
        Ok(v) => v,
        Err(e) => return Err(e),
    };
    Ok(x + y)
}
```

### Exercise 4: Match on an enum with data
```rust
enum Command {
    Quit,
    Echo(String),
    Move { x: i32, y: i32 },
    Color(u8, u8, u8),
}

fn process(cmd: Command) {
    // match on cmd and print a description for each variant
    todo!()
}
```

---

## Key Takeaways

1. **Rust enums carry data** — one type can represent multiple explicit states.
2. **`match` is exhaustive** — the compiler ensures you handle every case.
3. **`Option<T>` replaces null** — you can't forget to check for absence.
4. **`Result<T, E>` makes failure part of the type** — success and error are explicit.
5. **`?` operator** — propagates errors early without boilerplate.
6. **Never use `.unwrap()` in production** — use `?` or provide defaults.

Next: [Lesson 04 — Error Handling Patterns](./04-error-handling.md)
