# Rust Reference Glossary

The Rust terms in this track that beginners usually trip over, explained in
plain language.

Use this file in two ways:

1. If a lesson links a keyword here, read just that term and return.
2. If several Rust words are blurring together, read the whole sheet once.

---

## Ownership

Ownership is Rust's rule for deciding **who is responsible for cleaning up a
value**.

If a `String` or `Vec<T>` allocates memory, some variable must own it. When
that owner goes out of scope, Rust runs cleanup automatically.

**Why it exists:** Rust wants memory safety without a garbage collector.

---

## Owner

The owner is the variable currently responsible for a value.

```rust
let name = String::from("Ada");
```

Here, `name` is the owner of that `String`.

---

## Scope

Scope is the region of code where a name is valid.

```rust
{
    let x = 5;
} // x goes out of scope here
```

When an owner leaves scope, Rust drops the value it owns.

---

## Move

A move transfers ownership from one place to another.

```rust
let a = String::from("hi");
let b = a; // move
```

Now `b` owns the string. `a` no longer does.

**Important:** A move often does **not** copy all the heap data. It usually
moves the small ownership metadata that points to that data.

---

## Clone

`clone()` makes an explicit duplicate.

```rust
let a = String::from("hi");
let b = a.clone();
```

Now both `a` and `b` have their own copy of the string data.

**Why it exists:** Rust wants expensive duplication to be visible in code.

---

## Copy

`Copy` is a trait for small simple values that can be duplicated
implicitly.

Examples:
- integers
- booleans
- chars
- many small fixed-size types

If a type is `Copy`, assignment copies it automatically instead of moving it.

---

## Borrow

Borrowing means giving access to a value **without transferring ownership**.

You borrow with references:

- `&T` for shared read-only access
- `&mut T` for exclusive mutable access

---

## Reference

A reference is a safe pointer to a value.

```rust
let x = 5;
let r = &x;
```

`r` refers to `x` without owning it.

---

## Mutable Reference

A mutable reference (`&mut T`) lets you change a value through the reference.

Rust only allows one active mutable reference at a time because that prevents
many bugs and data races.

---

## Borrow Checker

The borrow checker is the part of the compiler that enforces Rust's rules
about references and aliasing.

It answers questions like:
- Is this reference still valid?
- Are there conflicting mutable and immutable borrows?
- Could this code create a dangling reference?

---

## Drop

`Drop` is Rust's cleanup step when a value goes out of scope.

For many types, dropping means:
- free heap memory
- close a file
- release a lock
- clean up some other resource

---

## Slice

A slice is a borrowed view into contiguous data.

Examples:
- `&str` = borrowed view into UTF-8 text
- `&[T]` = borrowed view into a sequence of elements

Slices let you read part or all of a collection without copying it.

---

## Lifetime

A lifetime describes how long a reference is valid.

Most of the time Rust infers lifetimes for you. When you write them
explicitly, you are usually describing how input references and output
references are related.

**Why it exists:** to prevent dangling references.

---

## Static Lifetime (`'static`)

`'static` means "valid for the entire program run".

String literals like `"hello"` are `&'static str` because the bytes are baked
into the compiled program.

---

## Enum

An enum is a type that can be one of several named variants.

Rust enums can also carry data:

```rust
enum Message {
    Quit,
    Write(String),
}
```

---

## Pattern Matching

Pattern matching means checking the shape of a value and unpacking it.

Rust does this with `match`, `if let`, `while let`, and destructuring.

---

## Option

`Option<T>` means "a value might be present or absent".

Variants:
- `Some(T)`
- `None`

Use `Option` instead of null.

---

## Result

`Result<T, E>` means "this operation either succeeded with a value or failed
with an error".

Variants:
- `Ok(T)`
- `Err(E)`

Use `Result` for ordinary recoverable failures.

---

## Trait

A trait describes shared behavior.

If a type implements a trait, it promises to provide certain methods or
capabilities.

Examples:
- formatting with `Display`
- cloning with `Clone`
- iteration with `Iterator`

---

## impl

`impl` is where you define methods for a type or implement a trait for a
type.

Examples:

```rust
impl User {
    fn new() -> Self { ... }
}

impl Display for User {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result { ... }
}
```

---

## Generic

A generic lets code work with many types while staying type-safe.

```rust
fn first<T>(items: &[T]) -> Option<&T> { ... }
```

`T` is a type parameter.

---

## Trait Bound

A trait bound says a generic type must support certain behavior.

```rust
fn print_item<T: Display>(item: T) { ... }
```

This means: "`T` can be any type, as long as it implements `Display`."

---

## Module

A module organizes code inside a crate.

Modules help you group related functions, types, and constants.

---

## Crate

A crate is a Rust compilation unit or package target.

Examples:
- a binary crate
- a library crate

When people say "add a crate", they usually mean "add a dependency from
crates.io to `Cargo.toml`."

---

## Macro

A macro is code that expands into more code before normal compilation.

Examples:
- `println!`
- `vec!`
- `format!`
- `#[derive(Debug)]`

Macros are powerful, but you can learn a lot of Rust before writing your own.

---

## Quick Reference: Own vs Borrow vs Clone

| Action | What happens |
|--------|--------------|
| Move | Ownership changes hands |
| Borrow | Someone else gets temporary access |
| Clone | A real duplicate is created |

If Rust feels strict, ask:

1. Who owns this value?
2. Am I moving it, borrowing it, or cloning it?
3. When does the original data get cleaned up?
