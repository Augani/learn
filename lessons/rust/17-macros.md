# Lesson 17: Macros (The Basics)

Macros are code that writes code. You've already used them: `println!`,
`vec!`, `format!`, `derive`. The `!` at the end means "this is a macro."

Macros matter in Rust because they remove boilerplate while still expanding
to ordinary Rust code before compilation.

---

## Macro Types Overview

| Type | Example | What it does |
|------|---------|-------------|
| Declarative (`macro_rules!`) | `vec![]`, `println!()` | Pattern matching on syntax |
| Derive macros | `#[derive(Debug)]` | Auto-implement traits |
| Attribute macros | `#[tokio::main]` | Transform annotated items |
| Function-like proc macros | `sql!("SELECT...")` | Custom parsing |

You'll primarily USE macros (not write them). This lesson covers reading
and using them, plus writing simple declarative macros.

---

## Macros You Already Know

```rust
fn main() {
    // println! — formatted print
    let name = "Augustus";
    println!("Hello, {name}!");           // string interpolation
    println!("{:?}", vec![1, 2, 3]);      // debug format
    println!("{:#?}", vec![1, 2, 3]);     // pretty debug format
    println!("{:>10}", "right");          // right-align, width 10
    println!("{:.2}", 3.14159);           // 2 decimal places

    // format! — same as println but returns String
    let msg = format!("Hello, {name}!");

    // vec! — create vectors
    let v = vec![1, 2, 3];
    let zeros = vec![0; 10];

    // dbg! — debug print with file:line info (great for debugging)
    let x = 42;
    dbg!(x);         // [src/main.rs:17] x = 42
    dbg!(&v);        // prints with location info

    // todo! — placeholder that panics
    // todo!("implement this later");

    // assert macros
    assert!(true);
    assert_eq!(1 + 1, 2);
    assert_ne!(1, 2);

    // include_str! — embed file contents at compile time
    // let sql = include_str!("queries/users.sql");

    // env! — read environment variable at compile time
    // let version = env!("CARGO_PKG_VERSION");

    // cfg! — check compile-time configuration
    if cfg!(target_os = "macos") {
        println!("Running on macOS");
    }
}
```

---

## Writing Simple Declarative Macros

### Basic syntax

```rust
macro_rules! say_hello {
    () => {
        println!("Hello!");
    };
}

fn main() {
    say_hello!();  // prints "Hello!"
}
```

### With parameters

```rust
macro_rules! create_map {
    ($($key:expr => $value:expr),* $(,)?) => {
        {
            let mut map = std::collections::HashMap::new();
            $(map.insert($key, $value);)*
            map
        }
    };
}

fn main() {
    let scores = create_map! {
        "Alice" => 95,
        "Bob" => 87,
        "Charlie" => 92,
    };
    println!("{scores:?}");
}
```

### Breaking down the syntax

```
$($key:expr => $value:expr),*
│ │     │              │     │
│ │     │              │     └─ * = zero or more repetitions
│ │     │              └─ value is an expression
│ │     └─ key is an expression
│ └─ $key = capture variable
└─ $(...) = repetition group

$(,)? = optional trailing comma
```

### Common fragment types

| Fragment | Matches | Example |
|----------|---------|---------|
| `$x:expr` | Any expression | `42`, `foo()`, `a + b` |
| `$x:ident` | Identifier | `my_var`, `String` |
| `$x:ty` | Type | `i32`, `String`, `Vec<u8>` |
| `$x:pat` | Pattern | `Some(x)`, `_`, `1..=5` |
| `$x:stmt` | Statement | `let x = 5` |
| `$x:block` | Block | `{ ... }` |
| `$x:literal` | Literal value | `42`, `"hello"`, `true` |
| `$x:tt` | Token tree (anything) | Any single token or `(...)` group |

### Practical example: quick struct constructor

```rust
macro_rules! new_struct {
    ($name:ident { $($field:ident: $type:ty = $default:expr),* $(,)? }) => {
        struct $name {
            $($field: $type,)*
        }

        impl $name {
            fn new() -> Self {
                Self {
                    $($field: $default,)*
                }
            }
        }
    };
}

new_struct!(Config {
    host: String = String::from("localhost"),
    port: u16 = 8080,
    debug: bool = false,
});

fn main() {
    let config = Config::new();
    println!("{}:{} (debug: {})", config.host, config.port, config.debug);
}
```

---

## Derive Macros (you use these daily)

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct User {
    name: String,
    age: u32,
}

// With serde
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse {
    status: String,
    data: Vec<String>,
}
```

Derive macros are proc macros — they run Rust code at compile time to
generate impl blocks. You rarely write them, but you use them constantly.

---

## Attribute Macros

```rust
// tokio::main transforms your main into an async runtime
#[tokio::main]
async fn main() {
    println!("async main!");
}

// What it expands to (roughly):
fn main() {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            println!("async main!");
        })
}

// Test attributes
#[test]
fn my_test() { }

#[cfg(test)]
mod tests { }

// Conditional compilation
#[cfg(target_os = "linux")]
fn linux_only() { }
```

---

## When to Write Macros vs Functions

| Use a function when | Use a macro when |
|--------------------|-----------------|
| Normal logic | You need to accept variable number of args |
| Type safety matters | You need to generate code/types |
| Readability | Reducing boilerplate across many similar items |
| Most of the time | The pattern can't be expressed as a function |

**Rule of thumb:** Start with functions. Only reach for macros when a
function literally can't do what you need.

---

## Exercises

### Exercise 1: min!/max! macro
```rust
// Create a macro that works like:
// min!(1, 2, 3)       => 1
// max!(10, 20, 5, 15) => 20
// Should work with any number of arguments
```

### Exercise 2: hashset! macro
```rust
// Create a hashset! macro similar to vec!
// let s = hashset!{1, 2, 3};
// assert!(s.contains(&1));
```

---

## Key Takeaways

1. **`!` means macro** — `println!`, `vec!`, `format!` are all macros.
2. **`dbg!()` is your best debugging friend** — prints value + location.
3. **`#[derive(...)]`** is the most common macro you'll use.
4. **`macro_rules!`** for simple declarative macros.
5. **Prefer functions over macros** — only use macros for things functions can't do.
6. **Coming from Go/TS:** Neither language has true macros. This is new
   territory, but you mostly just USE macros, not write them.

Next: [Lesson 18 — CLI with Clap](./18-cli-clap.md)
