# Lesson 02: References, Slices, and Lifetimes

Lifetimes are Rust's way of ensuring references never outlive the data they
point to. This topic scares people mostly because of the syntax, but the core
idea is simple: a reference must never outlive the thing it refers to.

---

**Keywords in this lesson:** [reference](./reference-rust-glossary.md#reference),
[slice](./reference-rust-glossary.md#slice),
[lifetime](./reference-rust-glossary.md#lifetime),
[static lifetime (`'static`)](./reference-rust-glossary.md#static-lifetime-static),
[borrow checker](./reference-rust-glossary.md#borrow-checker)

## Why References, Slices, and Lifetimes Exist

Rust wants to let you pass data around efficiently **without** copying it
all the time.

That means the language needs safe ways to say:

- "look at this value, but do not take ownership"
- "look at just this part of the value"
- "prove this reference stays valid long enough"

References solve the first problem. Slices solve the second. Lifetimes solve
the third.

## Slices — Views Into Data

A slice is a reference to a contiguous section of a collection. You already
use this idea whenever you work with part of a string or part of an array.

### String slices (`&str`)

```rust
fn main() {
    let sentence = String::from("hello world");

    let hello = &sentence[0..5];   // &str — a view into `sentence`
    let world = &sentence[6..11];

    println!("{hello} {world}");
}
```

### Array/Vec slices (`&[T]`)

```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];

    let middle = &numbers[1..4];  // &[i32] — borrows elements 1,2,3
    println!("{middle:?}");       // [2, 3, 4]

    print_slice(&numbers);        // borrow the whole vec as a slice
}

fn print_slice(data: &[i32]) {
    for item in data {
        println!("{item}");
    }
}
```

### The `&str` vs `String` decision

This confuses everyone at first. Simple rule:

| Use this | When |
|----------|------|
| `String` | You need to own/modify the string |
| `&str` | You just need to read it (function params, especially) |

```rust
// GOOD: accepts both String and &str via automatic deref
fn greet(name: &str) {
    println!("Hello, {name}!");
}

fn main() {
    let owned = String::from("Augustus");
    let literal = "World";              // string literals are &str

    greet(&owned);   // &String auto-coerces to &str
    greet(literal);  // already &str
}
```

**Rule of thumb:** Function parameters should often take `&str` instead of
`String` when they only need to read text. That makes the function more
flexible and avoids unnecessary ownership transfer.

---

## Lifetimes — The Scary Part (that isn't actually scary)

A lifetime is the compiler asking: "How long does this reference stay valid?"

### You usually DON'T write lifetimes

```rust
// The compiler infers lifetimes here — no annotation needed
fn first_word(s: &str) -> &str {
    match s.find(' ') {
        Some(i) => &s[..i],
        None => s,
    }
}
```

The compiler knows the returned `&str` lives as long as the input `&str`.
This is called **lifetime elision** — the compiler fills in the obvious cases.

### When you DO need explicit lifetimes

When the compiler can't figure out which input a returned reference comes
from:

```rust
// This tells the compiler: the returned reference lives as long as
// BOTH input references (the shorter of the two)
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let s1 = String::from("long string");
    let result;
    {
        let s2 = String::from("hi");
        result = longest(&s1, &s2);
        println!("{result}");  // works — both s1 and s2 are alive
    }
    // println!("{result}");   // COMPILE ERROR if uncommented
    //                         // s2 was dropped, result might reference it
}
```

### Reading lifetime syntax

`'a` is pronounced "lifetime a". Think of it as a label.

```
&'a str    →  "a reference to a str that lives at least as long as 'a"
&'a mut T  →  "a mutable reference to T that lives at least as long as 'a"
```

### The `'static` lifetime

`'static` means "lives for the entire program". String literals have this.

```rust
let s: &'static str = "I live forever";  // baked into the binary
```

---

## Lifetime Rules of Thumb

1. **Start without annotations.** The compiler will tell you when it needs them.
2. **Function returns a reference?** It must come from an input reference.
3. **Two reference inputs, one reference output?** You probably need `'a`.
4. **Struct holds a reference?** It needs a lifetime annotation.
5. **Confused?** Return an owned type (`String` instead of `&str`) — it's
   fine, especially while learning.

### Struct with a lifetime

```rust
struct Excerpt<'a> {
    text: &'a str,  // this struct borrows data — can't outlive the source
}

fn main() {
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first_sentence = &novel[..16];

    let excerpt = Excerpt { text: first_sentence };
    println!("Excerpt: {}", excerpt.text);
}
```

### When to use owned types vs references in structs

```rust
// PREFER THIS when the struct needs to own its data
struct User {
    name: String,    // owns the string — simpler, no lifetime needed
    email: String,
}

// USE THIS when you explicitly want to borrow (e.g., zero-copy parsing)
struct UserRef<'a> {
    name: &'a str,   // borrows — struct can't outlive the source data
    email: &'a str,
}
```

**Beginner advice:** Use owned types (`String`, `Vec<T>`) in structs.
Only use references in structs when you have a specific performance reason.

---

## Exercises

### Exercise 1: Fix the dangling reference
```rust
fn main() {
    let r;
    {
        let x = 5;
        r = &x;
    }
    println!("{r}");
}
```

### Exercise 2: Add lifetime annotations
```rust
fn first_of(a: &str, b: &str) -> &str {
    if a.len() >= b.len() { a } else { b }
}
```

### Exercise 3: Make this struct work
```rust
struct Config {
    name: &str,
    version: &str,
}

fn main() {
    let config = Config {
        name: "myapp",
        version: "1.0",
    };
    println!("{} v{}", config.name, config.version);
}
```
Hint: either add lifetimes or change to owned types.

---

## Key Takeaways

1. **Slices (`&[T]`, `&str`) are borrowed views** into existing data.
2. **Prefer `&str` over `String` in function params** — accepts both.
3. **Lifetimes are usually inferred** — don't annotate until the compiler asks.
4. **`'a` just means "these references are connected"** — the compiler uses
   it to prevent dangling references.
5. **When in doubt, use owned types** — `String` over `&str` in structs.
   Optimize later.
6. **Lifetimes are a safety proof.** They exist so references can stay cheap.

Next: [Lesson 03 — Pattern Matching, Enums, Option, Result](./03-enums-pattern-matching.md)
