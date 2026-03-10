# Lesson 12: Testing

Rust has testing built into the toolchain. You can write unit tests,
integration tests, and doc tests without adopting a separate testing
framework first.

---

## Unit Tests (same file)

```rust
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        return Err("division by zero".to_string());
    }
    Ok(a / b)
}

#[cfg(test)]          // only compiled during `cargo test`
mod tests {
    use super::*;     // import everything from parent module

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }

    #[test]
    fn test_add_negative() {
        assert_eq!(add(-1, 1), 0);
    }

    #[test]
    fn test_divide() {
        assert_eq!(divide(10.0, 2.0), Ok(5.0));
    }

    #[test]
    fn test_divide_by_zero() {
        assert!(divide(10.0, 0.0).is_err());
    }
}
```

**Go equivalent:**
```go
// In add_test.go
func TestAdd(t *testing.T) {
    if add(2, 3) != 5 {
        t.Error("expected 5")
    }
}
```

**Key difference:** Rust tests live in the SAME file as the code they test,
inside a `#[cfg(test)] mod tests` block. Go uses separate `_test.go` files.

---

## Assert Macros

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn assert_examples() {
        assert!(true);
        assert!(1 + 1 == 2);

        assert_eq!(4, 2 + 2);           // left == right
        assert_ne!(4, 2 + 1);           // left != right

        // With custom messages
        assert_eq!(4, 2 + 2, "math is broken");
        assert!(true, "the universe is wrong");

        // Approximate float comparison
        let result = 0.1 + 0.2;
        assert!((result - 0.3).abs() < f64::EPSILON);
    }
}
```

---

## Testing Results and Errors

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Test that returns Result (no need for unwrap)
    #[test]
    fn test_with_result() -> Result<(), String> {
        let result = divide(10.0, 2.0)?;
        assert_eq!(result, 5.0);
        Ok(())
    }

    // Test that should panic
    #[test]
    #[should_panic]
    fn test_index_out_of_bounds() {
        let v = vec![1, 2, 3];
        let _ = v[99];
    }

    // should_panic with expected message
    #[test]
    #[should_panic(expected = "index out of bounds")]
    fn test_panic_message() {
        let v = vec![1, 2, 3];
        let _ = v[99];
    }
}
```

---

## Integration Tests

Live in a `tests/` directory at the project root. Each file is a separate
crate that can only test your library's public API.

```
project/
├── src/
│   └── lib.rs
└── tests/
    ├── user_tests.rs
    └── integration_test.rs
```

**`tests/integration_test.rs`:**
```rust
use my_crate::add;  // import from your library's public API

#[test]
fn test_add_integration() {
    assert_eq!(add(100, 200), 300);
}
```

**Go equivalent:** Go doesn't distinguish unit vs integration tests by
convention. You'd use build tags or separate directories.

---

## Test Organization Patterns

### Testing private functions

Rust allows testing private functions (Go doesn't via separate test files):

```rust
fn private_helper(x: i32) -> i32 {
    x * x
}

pub fn public_fn(x: i32) -> i32 {
    private_helper(x) + 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_private_helper() {
        assert_eq!(private_helper(3), 9);  // can test private fns!
    }
}
```

### Test fixtures and setup

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> Vec<User> {
        vec![
            User { name: "Alice".to_string(), age: 30 },
            User { name: "Bob".to_string(), age: 25 },
        ]
    }

    #[test]
    fn test_find_oldest() {
        let users = setup();
        let oldest = find_oldest(&users);
        assert_eq!(oldest.unwrap().name, "Alice");
    }
}
```

### Ignoring tests

```rust
#[test]
#[ignore]
fn expensive_test() {
    // only runs with: cargo test -- --ignored
    // or: cargo test -- --include-ignored
}
```

---

## Running Tests

```bash
cargo test                        # run all tests
cargo test test_add               # run tests matching "test_add"
cargo test -- --nocapture         # show println! output
cargo test -- --test-threads=1    # run tests sequentially
cargo test -- --ignored           # run only #[ignore] tests
cargo test --lib                  # only unit tests
cargo test --test integration     # only integration tests
cargo test --doc                  # only doc tests
```

---

## Doc Tests

Code in documentation comments is compiled and tested:

```rust
/// Adds two numbers together.
///
/// ```
/// use my_crate::add;
/// assert_eq!(add(2, 3), 5);
/// assert_eq!(add(-1, 1), 0);
/// ```
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

`cargo test` runs these examples as tests. This ensures your docs never
go stale.

---

## Exercises

### Exercise 1: Write tests for a function
```rust
pub fn is_palindrome(s: &str) -> bool {
    let cleaned: String = s.chars()
        .filter(|c| c.is_alphanumeric())
        .map(|c| c.to_lowercase().next().unwrap())
        .collect();
    cleaned == cleaned.chars().rev().collect::<String>()
}

// Write at least 4 tests: empty string, single char, palindrome, non-palindrome
```

### Exercise 2: Test error cases
```rust
pub fn parse_port(s: &str) -> Result<u16, String> {
    let port: u16 = s.parse().map_err(|_| format!("invalid port: {s}"))?;
    if port == 0 {
        return Err("port cannot be zero".to_string());
    }
    Ok(port)
}

// Write tests for: valid port, zero, negative, non-numeric, overflow
```

---

## Key Takeaways

1. **Tests are in the same file** — `#[cfg(test)] mod tests { ... }`.
2. **`assert_eq!`, `assert!`, `assert_ne!`** are your main tools.
3. **`#[should_panic]`** for testing panics.
4. **Integration tests** go in `tests/` directory, test only public API.
5. **`cargo test`** runs everything — unit, integration, and doc tests.
6. **Coming from Go:** No `t.Helper()`, no `t.Run()` for subtests (use
   separate `#[test]` functions). No `testify` needed — stdlib is enough.

Next: [Lesson 13 — Serialization with Serde](./13-serde.md)
