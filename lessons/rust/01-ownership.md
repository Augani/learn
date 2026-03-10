# Lesson 01: Ownership, Moves, and Borrowing

The single most important concept in Rust. This is what replaces the garbage
collector. Once this clicks, the rest of Rust falls into place.

---

**Keywords in this lesson:** [ownership](./reference-rust-glossary.md#ownership),
[move](./reference-rust-glossary.md#move),
[borrow](./reference-rust-glossary.md#borrow),
[clone](./reference-rust-glossary.md#clone),
[drop](./reference-rust-glossary.md#drop)

If stack and heap still feel fuzzy, pause here and read
[CS Fundamentals](../reference-cs-fundamentals.md) first.

## Why Rust Has Ownership

Most languages get memory safety in one of two ways:

- a garbage collector cleans things up later
- the programmer manages memory manually

Rust takes a third path:

- the compiler proves who owns each value
- the compiler proves when cleanup happens
- the compiler proves when references are safe

That is why Rust can be memory-safe **without** a garbage collector and
without asking you to call `free()` yourself.

Ownership is not there to make the language harder. It is there so the
compiler can answer three hard questions before your code runs:

1. Who cleans up this value?
2. Can two parts of the program mutate it unsafely at the same time?
3. Could any reference outlive the data it points to?

---

## The Three Rules

```
1. Each value has exactly ONE owner
2. When the owner goes out of scope, the value is dropped (freed)
3. You can either have ONE mutable reference OR any number of immutable references
```

No GC. No manual malloc/free. The compiler enforces these rules at compile
time. If your code compiles, it's memory-safe. Period.

---

## Stack vs Heap (quick refresher)

Rust talks about ownership a lot because many common Rust values are split
across stack metadata and heap data.

| Type | Where the important data lives | What assignment usually does |
|------|-------------------------------|------------------------------|
| `i32`, `f64`, `bool`, `char` | Entire value lives inline | Copies the value |
| `String` | Small header inline, text on heap | Moves ownership of the string |
| `Vec<T>` | Small header inline, elements on heap | Moves ownership of the vector |
| `&str` | Reference inline, data lives elsewhere | Copies the reference |

---

## Ownership and Moves

### Heap-owning values move by default

```rust
fn main() {
    let name = String::from("Augustus");
    let other = name;           // ownership MOVES to `other`
    // println!("{name}");      // COMPILE ERROR: value used after move
    println!("{other}");        // works — `other` is the new owner
}
```

**Why?** If both `name` and `other` pointed to the same heap memory, who
frees it? Rust has no GC, so it enforces single ownership. When `other`
goes out of scope, the memory is freed. Done.

### Stack types copy, heap types move

```rust
fn main() {
    // integers live on the stack — they COPY
    let x = 42;
    let y = x;
    println!("{x} {y}");   // both valid — i32 implements Copy

    // Strings live on the heap — they MOVE
    let s1 = String::from("hello");
    let s2 = s1;
    // println!("{s1}");    // COMPILE ERROR
    println!("{s2}");       // fine
}
```

**Analogy — the library book:** Think of a `String` like a library book.
When you check out a book, YOU are responsible for returning it. You can't
just hand it to your friend and walk away — the library doesn't know your
friend has it, and nobody will return it. In Rust, a "move" is like
officially transferring your checkout to someone else. The library updates
its records: now THEY are responsible. The old borrower's library card
shows nothing checked out.

**What actually happens in memory:**
```
Before move (let s1 = String::from("hello")):

  Stack (s1):           Heap:
  ┌──────────┐         ┌───┬───┬───┬───┬───┐
  │ ptr  ────┼────────>│ h │ e │ l │ l │ o │
  │ len: 5   │         └───┴───┴───┴───┴───┘
  │ cap: 5   │
  └──────────┘

After move (let s2 = s1):

  Stack (s1):           Heap:
  ┌──────────┐         ┌───┬───┬───┬───┬───┐
  │ INVALID  │    ┌───>│ h │ e │ l │ l │ o │
  └──────────┘    │    └───┴───┴───┴───┴───┘
                  │
  Stack (s2):     │
  ┌──────────┐    │
  │ ptr  ────┼────┘
  │ len: 5   │
  │ cap: 5   │
  └──────────┘

The heap data NEVER moves. Only the stack metadata (pointer, length,
capacity) gets copied. Then the old variable is marked invalid.
This is why moves are cheap — it's just copying 24 bytes on the stack.
```

This is fundamentally different from a language like Python or Java, where
`s2 = s1` makes both variables point to the same object. In those languages,
a garbage collector figures out when nobody points to it anymore. Rust
doesn't have a GC, so it enforces that exactly ONE variable owns each piece
of heap memory at any time.

### Explicit clone when you actually want a copy

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1.clone();       // deep copy — both valid now
    println!("{s1} and {s2}"); // works
}
```

`.clone()` is intentional and visible in the code. Rust wants duplication of
heap data to be explicit because it can be expensive.

---

## Functions and Ownership

Passing a value to a function is the same as assignment — it moves.

```rust
fn main() {
    let name = String::from("Augustus");
    greet(name);                // ownership moves INTO greet()
    // println!("{name}");      // COMPILE ERROR: name was moved
}

fn greet(person: String) {
    println!("Hello, {person}!");
}   // `person` is dropped here — memory freed
```

### Returning gives ownership back

```rust
fn main() {
    let name = String::from("Augustus");
    let greeting = make_greeting(name);  // name moves in, new String moves out
    println!("{greeting}");
}

fn make_greeting(person: String) -> String {
    format!("Hello, {person}!")  // format! creates a new String
}
```

**This is annoying.** Moving into every function and getting values back is
tedious. That's where borrowing comes in.

---

## Borrowing with References

Instead of moving ownership, you can **lend** a value using `&`.

### Immutable borrow (`&T`)

```rust
fn main() {
    let name = String::from("Augustus");
    let len = calculate_length(&name);  // lend name, don't give it away
    println!("{name} is {len} chars");  // name still valid!
}

fn calculate_length(s: &str) -> usize {
    s.len()
}
```

In Rust, `&` makes the lending explicit. The function gets read-only access.

### Mutable borrow (`&mut T`)

```rust
fn main() {
    let mut name = String::from("Augustus");  // must be `mut` to allow mutation
    add_title(&mut name);
    println!("{name}");  // "Mr. Augustus"
}

fn add_title(s: &mut String) {
    s.insert_str(0, "Mr. ");
}
```

### The borrowing rules (Rule #3 in detail)

```rust
fn main() {
    let mut s = String::from("hello");

    // Multiple immutable borrows — OK
    let r1 = &s;
    let r2 = &s;
    println!("{r1} {r2}");

    // Mutable borrow — OK (r1, r2 no longer used after this point)
    let r3 = &mut s;
    r3.push_str(" world");
    println!("{r3}");

    // This would NOT compile:
    // let r4 = &s;
    // let r5 = &mut s;
    // println!("{r4} {r5}");  // can't have immutable AND mutable at same time
}
```

**Why this rule?** If one part of the program can mutate a value while other
parts are reading it, you can get stale reads, invalid references, and data
races. Rust prevents that entire category of bugs by making aliasing rules
part of the type system.

---

## Quick Reference Table

| Rust term | Meaning |
|-----------|---------|
| `let x = 5;` | Immutable binding |
| `let mut x = 5;` | Mutable binding |
| `String` | Owned growable string |
| `&str` | Borrowed string slice |
| `&T` | Shared reference |
| `&mut T` | Exclusive mutable reference |
| `x.clone()` | Explicit duplicate |
| move | Ownership transfer |
| `drop(x)` | Run cleanup now |

---

## Exercises

### Exercise 1: Fix the compile error
```rust
fn main() {
    let s = String::from("hello");
    let s2 = s;
    println!("{s}");
}
```

### Exercise 2: Make this work without clone
```rust
fn main() {
    let s = String::from("hello");
    print_string(s);
    println!("Original: {s}");
}

fn print_string(s: String) {
    println!("{s}");
}
```
Hint: change `print_string` to borrow instead of taking ownership.

### Exercise 3: Fix the borrowing conflict
```rust
fn main() {
    let mut data = vec![1, 2, 3];
    let first = &data[0];
    data.push(4);
    println!("First: {first}");
}
```
Hint: think about when `first` is used relative to the mutation.

---

## RAII: Ownership Is About More Than Memory

Rust's ownership model is actually an implementation of **RAII** (Resource
Acquisition Is Initialization) — a concept from C++ that Rust perfects.

The idea: every resource (memory, file handle, network socket, mutex lock)
is tied to a variable's lifetime. When the variable goes out of scope, the
resource is automatically released.

**Analogy — the hotel key card:** When you check into a hotel, you get a key
card. That card IS your access. When you check out, the card is deactivated
and the room is cleaned for the next guest. You don't have to remember to
"release the room" — it happens automatically when your stay ends.

```rust
fn process_file() -> std::io::Result<()> {
    let file = File::open("data.txt")?;  // file handle acquired
    // ... use the file ...
    Ok(())
}   // file goes out of scope here → file handle is automatically closed
    // No need for file.close() — the OS file descriptor is released
    // Even if an error occurs above, the file is still properly closed
```

This matters because resource leaks are insidious. In languages without
RAII, forgetting to close a file handle or release a database connection
doesn't crash your program — it slowly degrades until you run out of
resources hours or days later. Rust makes this impossible. If a type holds
a resource, it MUST be cleaned up when dropped. The compiler guarantees it.

**Real bugs ownership prevents:**

1. **Use-after-free** — In C, you can free memory and then accidentally read
   from it. Rust won't compile this — once ownership moves, the old variable
   is dead.

2. **Double-free** — In C, two parts of code might both try to free the same
   memory. Rust's single-owner rule makes this structurally impossible.

3. **Data races** — Two threads mutating the same data simultaneously. The
   borrowing rules prevent this at compile time: you can't have two `&mut`
   references, period.

4. **Iterator invalidation** — Pushing to a vector while iterating over it
   can reallocate the vector's memory, leaving the iterator pointing at freed
   memory. Rust's borrow checker catches this: you can't mutate a collection
   while something borrows it.

---

## Key Takeaways

1. **Move is the default for heap types.** After `let b = a`, `a` is gone.
2. **Use `&` to borrow** instead of moving — most functions should borrow.
3. **`&mut` for mutable access** — only one at a time, no concurrent readers.
4. **Ownership answers "who cleans this up?"** before the program runs.
5. **The borrow rules are about safety, not ceremony.** They prevent bugs by design.
6. **The compiler is part of the learning loop.** Rust error messages teach the model.

Next: [Lesson 02 — References, Slices, and Lifetimes](./02-references-slices-lifetimes.md)
