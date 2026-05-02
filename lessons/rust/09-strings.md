# Lesson 09: Strings (The Full Picture)

Strings trip up almost every Rust beginner because Rust separates owned
strings from borrowed string slices. Once you understand why that split
exists, string APIs start making sense.

---

## The Two Main String Types

| Type | What it is | Analogy |
|------|-----------|---------|
| `String` | Owned, heap-allocated, growable UTF-8 string | Go `strings.Builder` result |
| `&str` | Borrowed view into a string (a "string slice") | Go `string` (read-only) |

```rust
fn main() {
    let owned: String = String::from("hello");   // heap, you own it
    let literal: &str = "hello";                  // baked into binary, &'static str
    let slice: &str = &owned[0..3];              // view into owned: "hel"
}
```

### When to use which

| Situation | Use | Why |
|-----------|-----|-----|
| Struct fields | `String` | Struct needs to own its data |
| Function parameters | `&str` | Accepts both `String` and `&str` |
| Function return (new string) | `String` | Caller needs to own the result |
| String literals | `&str` | They're already `&'static str` |
| Building/modifying strings | `String` | It's mutable and growable |

---

## Creating Strings

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = "hello".to_string();
    let s3 = "hello".to_owned();
    let s4: String = "hello".into();
    let s5 = format!("{} {}", "hello", "world");

    let s6 = String::new();
    let s7 = String::with_capacity(100);
}
```

All of `String::from`, `.to_string()`, `.to_owned()`, and `.into()` do the
same thing. Convention: use `String::from()` or `.to_string()`.

---

## String Operations

### Concatenation

```rust
fn main() {
    // format! — cleanest, always use this
    let greeting = format!("{} {}", "hello", "world");

    // push_str — appending
    let mut s = String::from("hello");
    s.push_str(" world");
    s.push('!');

    // + operator (takes ownership of left side — awkward)
    let s1 = String::from("hello");
    let s2 = String::from(" world");
    let s3 = s1 + &s2;  // s1 is moved, s2 is borrowed
    // println!("{s1}");  // COMPILE ERROR: s1 was moved
}
```

**Recommendation:** Use `format!()` for combining strings. Use `push_str()`
for building up a string in a loop.

### Slicing

```rust
fn main() {
    let s = String::from("hello world");
    let hello = &s[0..5];    // &str
    let world = &s[6..];     // &str

    // WARNING: indices are BYTE positions, not character positions
    let emoji = String::from("hello 🌍");
    // let bad = &emoji[0..7];  // PANIC: 7 is in the middle of the emoji's bytes
}
```

**Rust strings are UTF-8.** Indexing by byte can split a multi-byte character.
This is why `s[0]` doesn't compile — Rust prevents you from making this mistake.

### Iterating

```rust
fn main() {
    let s = "hello 🌍";

    // By character (what you usually want)
    for ch in s.chars() {
        print!("{ch} ");
    }
    // h e l l o   🌍

    // By byte
    for b in s.bytes() {
        print!("{b} ");
    }

    // With index
    for (i, ch) in s.char_indices() {
        println!("{i}: {ch}");
    }
}
```

**Go equivalent:**
```go
for i, ch := range "hello 🌍" {  // Go iterates by rune
    fmt.Printf("%d: %c\n", i, ch)
}
```

---

## Common String Methods

```rust
fn main() {
    let s = String::from("  Hello, World!  ");

    s.len();                          // byte length
    s.is_empty();                     // bool
    s.contains("World");              // bool
    s.starts_with("  He");            // bool
    s.ends_with("!  ");               // bool
    s.trim();                         // "Hello, World!" (&str)
    s.to_lowercase();                 // new String
    s.to_uppercase();                 // new String
    s.replace("World", "Rust");       // new String
    s.split(',');                     // iterator of &str
    s.split_whitespace();             // iterator of &str
    s.lines();                        // iterator of &str

    // Parsing
    let n: i32 = "42".parse().unwrap();

    // Repeating
    let dashes = "-".repeat(20);
}
```

---

## String Conversion Patterns

```rust
// &str → String
let owned: String = "hello".to_string();
let owned: String = String::from("hello");

// String → &str
let s = String::from("hello");
let borrowed: &str = &s;           // auto-deref
let borrowed: &str = s.as_str();   // explicit

// &str → &[u8]
let bytes: &[u8] = "hello".as_bytes();

// &[u8] → &str (can fail — must be valid UTF-8)
let s = std::str::from_utf8(bytes).unwrap();

// &[u8] → String
let s = String::from_utf8(vec![104, 101, 108, 108, 111]).unwrap();

// number → String
let s = 42.to_string();
let s = format!("{}", 42);

// String → number
let n: i32 = "42".parse().unwrap();
```

---

## The `impl Into<String>` Pattern

Functions that accept both `&str` and `String`:

```rust
fn greet(name: impl Into<String>) {
    let name: String = name.into();
    println!("Hello, {name}!");
}

fn main() {
    greet("Augustus");                    // &str
    greet(String::from("Augustus"));      // String
}
```

For read-only access, prefer `&str`:

```rust
fn greet(name: &str) {
    println!("Hello, {name}!");
}
```

---

## Other String Types (you'll encounter these)

| Type | When you'll see it |
|------|-------------------|
| `OsString` / `&OsStr` | File paths on non-UTF-8 systems |
| `CString` / `&CStr` | FFI with C libraries |
| `PathBuf` / `&Path` | File system paths (cross-platform) |
| `Cow<'a, str>` | Might be owned or borrowed (optimization) |

You don't need these yet, but know they exist.

---

## Exercises

### Exercise 1: Word counter
```rust
fn word_count(text: &str) -> usize {
    // Count the number of words (split by whitespace)
    todo!()
}
```

### Exercise 2: Capitalize first letter
```rust
fn capitalize(s: &str) -> String {
    // "hello world" → "Hello world"
    todo!()
}
```

### Exercise 3: Truncate with ellipsis
```rust
fn truncate(s: &str, max_chars: usize) -> String {
    // If s has more than max_chars characters, truncate and add "..."
    // Must not split multi-byte characters
    todo!()
}
```

---

## Key Takeaways

1. **`String` = owned, `&str` = borrowed.** Use `&str` in function params.
2. **Use `format!()` for concatenation** — cleanest approach.
3. **Strings are UTF-8.** You can't index by position. Use `.chars()`.
4. **`.to_string()`, `String::from()`, `.into()`** all do the same thing.
5. **Coming from Go:** Go `string` ≈ Rust `&str`. Both are UTF-8. But Rust
   makes you think about ownership.

Next: [Lesson 10 — Collections](./10-collections.md)
