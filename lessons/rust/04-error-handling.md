# Lesson 04: Error Handling Patterns

Rust uses `Result<T, E>` for recoverable failures and reserves panics for
truly exceptional situations. This lesson covers the error-handling patterns
you will actually use in real projects.

---

**Keywords in this lesson:** [Result](./reference-rust-glossary.md#result),
[trait](./reference-rust-glossary.md#trait),
[`impl`](./reference-rust-glossary.md#impl)

## Why Rust Handles Errors This Way

Rust wants ordinary failures to be visible in function signatures.

That means:

- callers can see that an operation might fail
- the compiler can force you to deal with failure
- error handling stays explicit instead of hiding in exceptions

This style can feel verbose at first, but it scales well because failure
paths are part of the type system rather than hidden control flow.

## Custom Error Types

### The manual way

```rust
use std::fmt;

#[derive(Debug)]
enum AppError {
    NotFound(String),
    Unauthorized,
    Database(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::NotFound(item) => write!(f, "{item} not found"),
            AppError::Unauthorized => write!(f, "unauthorized access"),
            AppError::Database(msg) => write!(f, "database error: {msg}"),
        }
    }
}

impl std::error::Error for AppError {}
```

### The easy way with `thiserror` (use this in real projects)

```rust
use thiserror::Error;

#[derive(Debug, Error)]
enum AppError {
    #[error("{0} not found")]
    NotFound(String),

    #[error("unauthorized access")]
    Unauthorized,

    #[error("database error: {0}")]
    Database(String),

    #[error("io error")]
    Io(#[from] std::io::Error),  // auto-converts io::Error → AppError
}

fn find_user(id: u64) -> Result<String, AppError> {
    if id == 0 {
        return Err(AppError::NotFound(format!("user {id}")));
    }
    Ok(String::from("Augustus"))
}
```

The `#[from]` attribute lets `?` automatically convert errors:

```rust
fn load_config() -> Result<String, AppError> {
    let content = std::fs::read_to_string("config.toml")?;  // io::Error → AppError
    Ok(content)
}
```

### `anyhow` — for applications (not libraries)

When you don't care about specific error types and just want error handling
to work:

```rust
use anyhow::{Context, Result};

fn load_config(path: &str) -> Result<String> {  // anyhow::Result
    let content = std::fs::read_to_string(path)
        .context(format!("failed to read config from {path}"))?;

    let parsed = content.parse::<i32>()
        .context("config must be a number")?;

    Ok(format!("Config value: {parsed}"))
}

fn main() -> Result<()> {
    let config = load_config("config.txt")?;
    println!("{config}");
    Ok(())
}
```

### When to use which

| Tool | Use for |
|------|---------|
| `thiserror` | Libraries and APIs where callers may match on error variants |
| `anyhow` | Applications, CLIs, and scripts where you mostly propagate errors |
| Manual `impl` | Learning, low-dependency examples, or very custom behavior |

---

## Converting Between Error Types

```rust
use std::num::ParseIntError;
use std::io;

#[derive(Debug, thiserror::Error)]
enum MyError {
    #[error("parse error: {0}")]
    Parse(#[from] ParseIntError),

    #[error("io error: {0}")]
    Io(#[from] io::Error),
}

fn do_stuff() -> Result<i32, MyError> {
    let content = std::fs::read_to_string("number.txt")?;  // io::Error → MyError
    let num: i32 = content.trim().parse()?;                 // ParseIntError → MyError
    Ok(num * 2)
}
```

Without `#[from]`, you'd use `.map_err()`:

```rust
fn do_stuff_manual() -> Result<i32, String> {
    let content = std::fs::read_to_string("number.txt")
        .map_err(|e| format!("read error: {e}"))?;
    let num: i32 = content.trim().parse()
        .map_err(|e| format!("parse error: {e}"))?;
    Ok(num * 2)
}
```

---

## Error Handling Cheat Sheet

```rust
// Propagate with ?
let val = might_fail()?;

// Propagate with context (anyhow)
let val = might_fail().context("what we were doing")?;

// Convert error type
let val = might_fail().map_err(MyError::from)?;
let val = might_fail().map_err(|e| format!("oops: {e}"))?;

// Provide default on error
let val = might_fail().unwrap_or(default);
let val = might_fail().unwrap_or_else(|_| compute_default());

// Handle specific errors
match might_fail() {
    Ok(val) => use_val(val),
    Err(MyError::NotFound(_)) => handle_not_found(),
    Err(e) => return Err(e),
}
```

---

## `main()` returning Result

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string("hello.txt")?;
    println!("{content}");
    Ok(())
}

// Or with anyhow (cleaner):
fn main() -> anyhow::Result<()> {
    let content = std::fs::read_to_string("hello.txt")?;
    println!("{content}");
    Ok(())
}
```

This lets you use `?` in main instead of `.unwrap()`.

---

## Exercises

### Exercise 1: Create a custom error enum
Create an error type for a user service with variants:
- `NotFound { id: u64 }`
- `InvalidEmail(String)`
- `DatabaseError(String)`

Implement it with `thiserror`.

### Exercise 2: Chain errors with ?
Write a function that reads a file, parses each line as an integer,
and returns the sum. Use `?` for all error handling.

### Exercise 3: Use anyhow with context
Rewrite Exercise 2 using `anyhow` and add `.context()` to each
fallible operation.

---

## Key Takeaways

1. **`thiserror`** for libraries where callers match on error variants.
2. **`anyhow`** for applications where you just propagate and display errors.
3. **`#[from]`** lets `?` auto-convert between error types.
4. **`.context()`** adds human-readable messages to error chains.
5. **`?` in main** works when main returns `Result`.
6. **Rust treats recoverable failure as data.** That is why `Result` appears everywhere.

Next: [Lesson 05 — Structs and Methods](./05-structs-methods.md)
