# Lesson 06: Traits — Shared Behavior and Interfaces

If you get one concept from this lesson: **traits describe shared behavior**.
They let Rust say "any type that can do X" without giving up static type
checking.

---

**Keywords in this lesson:** [trait](./reference-rust-glossary.md#trait),
[`impl`](./reference-rust-glossary.md#impl),
[generic](./reference-rust-glossary.md#generic),
[trait bound](./reference-rust-glossary.md#trait-bound)

## Why Traits Exist

Without traits, every function would have to name one concrete type.

Traits let you write APIs around capabilities instead:

- anything that can be displayed
- anything that can be cloned
- anything that can be iterated
- anything that can summarize itself

That is how Rust gets polymorphism while keeping types explicit.

---

## Basic Traits

```rust
trait Summary {
    fn summarize(&self) -> String;
}

struct Article {
    title: String,
    content: String,
}

struct Tweet {
    username: String,
    body: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        format!("{}: {}...", self.title, &self.content[..20])
    }
}

impl Summary for Tweet {
    fn summarize(&self) -> String {
        format!("@{}: {}", self.username, self.body)
    }
}
```

The important part is the `impl Summary for Article` and
`impl Summary for Tweet` lines. That is Rust making the relationship explicit.

---

## Default Implementations

Traits can provide default method bodies. That is useful when a trait wants
to require a small core behavior and derive other behavior from it.

```rust
trait Summary {
    fn summarize_author(&self) -> String;

    fn summarize(&self) -> String {
        format!("(Read more from {}...)", self.summarize_author())
    }
}

impl Summary for Tweet {
    fn summarize_author(&self) -> String {
        format!("@{}", self.username)
    }
    // summarize() uses the default implementation
}
```

## Traits as Parameters (the powerful part)

### Using `impl Trait` (simple, opaque — use this most of the time)

```rust
fn notify(item: &impl Summary) {
    println!("Breaking: {}", item.summarize());
}
```

### Using trait bounds (more explicit)

```rust
fn notify<T: Summary>(item: &T) {
    println!("Breaking: {}", item.summarize());
}
```

### Multiple trait bounds

```rust
use std::fmt::{Debug, Display};

fn print_and_summarize(item: &(impl Summary + Display)) {
    println!("Display: {item}");
    println!("Summary: {}", item.summarize());
}

// Or with where clause (cleaner for complex bounds)
fn complex_function<T>(item: &T) -> String
where
    T: Summary + Display + Debug + Clone,
{
    format!("{:?}: {}", item, item.summarize())
}
```

---

## Returning Traits

```rust
// Return a concrete type that implements Summary (static dispatch)
fn create_tweet() -> impl Summary {
    Tweet {
        username: String::from("rust_lang"),
        body: String::from("Rust 2024 edition is here!"),
    }
}
```

**Limitation:** `impl Trait` return type means you can only return ONE
concrete type. This won't work:

```rust
// COMPILE ERROR: returning different concrete types
fn create_summary(is_tweet: bool) -> impl Summary {
    if is_tweet {
        Tweet { ... }      // type A
    } else {
        Article { ... }    // type B — different type!
    }
}
```

For that, you need trait objects (Lesson 16).

---

## Common Standard Library Traits

### Display — for user-facing output

```rust
use std::fmt;

struct Point {
    x: f64,
    y: f64,
}

impl fmt::Display for Point {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}

// Now you can: println!("{point}");
```

### From/Into — type conversions

```rust
struct Meters(f64);

impl From<f64> for Meters {
    fn from(val: f64) -> Self {
        Meters(val)
    }
}

fn main() {
    let m: Meters = 42.0.into();        // uses Into (auto from From)
    let m2 = Meters::from(100.0);       // uses From directly
}
```

### Iterator

```rust
struct Counter {
    count: u32,
    max: u32,
}

impl Counter {
    fn new(max: u32) -> Self {
        Counter { count: 0, max }
    }
}

impl Iterator for Counter {
    type Item = u32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.count < self.max {
            self.count += 1;
            Some(self.count)
        } else {
            None
        }
    }
}

fn main() {
    let sum: u32 = Counter::new(5).sum();
    println!("Sum: {sum}");  // 15
}
```

### Other traits you'll see often

| Trait | Purpose | Auto-derive? |
|-------|---------|-------------|
| `Debug` | `{:?}` formatting | Yes |
| `Display` | `{}` formatting | No — write manually |
| `Clone` | `.clone()` deep copy | Yes |
| `Copy` | Implicit copy for stack types | Yes |
| `PartialEq`/`Eq` | `==` comparison | Yes |
| `PartialOrd`/`Ord` | `<`, `>`, sorting | Yes |
| `Hash` | Use as HashMap key | Yes |
| `Default` | `Type::default()` | Yes |
| `From`/`Into` | Type conversion | No |
| `Iterator` | For-loop support | No |
| `Drop` | Custom destructor | No |

---

## Derive Macros (auto-implement traits)

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct User {
    name: String,
    age: u32,
}

fn main() {
    let u1 = User { name: "Augustus".into(), age: 30 };
    let u2 = u1.clone();
    println!("{u1:?}");              // Debug
    println!("equal: {}", u1 == u2); // PartialEq
}
```

`derive` is one of Rust's main ways to remove boilerplate for standard traits.

---

## Exercises

### Exercise 1: Define and implement a trait

```rust
// Define a trait `Area` with a method `area(&self) -> f64`
// Implement it for Circle { radius: f64 } and Rectangle { width: f64, height: f64 }
// Write a function that takes &impl Area and prints the area
```

### Exercise 2: Implement Display

```rust
// Create a Color { r: u8, g: u8, b: u8 } struct
// Implement Display to format as "#RRGGBB" hex string
// println!("{}", color) should output something like "#FF0000"
```

### Exercise 3: Implement From

```rust
// Create Celsius(f64) and Fahrenheit(f64) types
// Implement From<Celsius> for Fahrenheit (and vice versa)
// let f: Fahrenheit = Celsius(100.0).into();
```

---

## Key Takeaways

1. **Traits describe capabilities, not data layout.**
2. **Explicit implementation** with `impl Trait for Type` makes relationships clear.
3. **`impl Trait` in params** is the simple way to accept any implementing type.
4. **`#[derive(...)]`** auto-implements common traits — use generously.
5. **`From`/`Into`** is Rust's idiomatic type conversion.
6. **Traits power a huge part of Rust's design.** Formatting, iteration, cloning, and more all use them.

Next: [Lesson 07 — Generics and Trait Bounds](./07-generics.md)
