# Reference & Glossary

Terms, concepts, and mental models used throughout these lessons.
Come back here whenever a lesson uses a term you're unsure about.

---

## Memory Management Concepts

### Garbage Collector (GC)
A runtime component that automatically frees memory that's no longer in use.
Both Go and JavaScript/TypeScript have a GC. It periodically scans your
program's memory, finds objects nothing points to anymore, and frees them.

**Tradeoff:** Convenient (no manual memory management) but adds latency
(GC pauses) and memory overhead (GC needs to track everything).

**Go:** Uses a concurrent, tri-color mark-and-sweep GC. Low-latency but
still has pauses.

**Rust:** Has NO garbage collector. Instead, the compiler inserts
deterministic `drop()` calls at compile time. When an owner goes out of
scope, memory is freed immediately. Zero runtime overhead.

### Stack
Fast, fixed-size memory region. Each function call gets a "stack frame".
When the function returns, its frame is popped — instant cleanup.

- **What goes on the stack:** integers, booleans, floats, fixed-size arrays,
  tuples, references/pointers, structs that contain only stack types
- **Stack allocation is free** — just moving a pointer
- **Limitation:** size must be known at compile time

```rust
let x: i32 = 42;          // stack
let point: (f64, f64) = (1.0, 2.0);  // stack
let arr: [u8; 4] = [0; 4]; // stack
```

### Heap
Slower, dynamically-sized memory. You request memory at runtime, use it,
and must eventually free it.

- **What goes on the heap:** `String`, `Vec<T>`, `Box<T>`, anything
  dynamically sized
- **Heap allocation is expensive** — OS has to find free space
- **Who frees it?** In Go: GC. In Rust: the owner when it goes out of scope.

```rust
let name = String::from("Augustus");  // heap (string data)
let nums = vec![1, 2, 3];            // heap (vector data)
let boxed = Box::new(42);            // heap (boxed integer)
```

### RAII (Resource Acquisition Is Initialization)
A pattern from C++ that Rust uses. When an object is created, it acquires
its resources. When it's destroyed (goes out of scope), it releases them.

```rust
{
    let file = File::open("data.txt")?;  // file handle acquired
    // use file...
}  // file handle closed automatically — drop() called
```

**Go equivalent:** `defer file.Close()` — but you can forget the defer.
In Rust, it's impossible to forget.

---

## Ownership & Borrowing Concepts

### Owner
The variable that is responsible for a piece of data. When the owner goes
out of scope, the data is freed (dropped).

```rust
let owner = String::from("hello");  // `owner` owns this String
```

### Move
Transferring ownership from one variable to another. The original variable
becomes invalid.

```rust
let a = String::from("hello");
let b = a;   // MOVE: ownership transfers from a to b
// a is now invalid
```

### Copy
Some types are small and live entirely on the stack. These are copied
instead of moved. Types that implement the `Copy` trait: integers, floats,
booleans, chars, tuples of Copy types.

```rust
let x = 42;
let y = x;   // COPY: both x and y are valid
```

### Clone
An explicit deep copy. Used when you want a duplicate of heap data.

```rust
let a = String::from("hello");
let b = a.clone();  // both a and b are valid, separate allocations
```

### Borrow
Temporarily accessing data without taking ownership. Uses references (`&`).

```rust
let s = String::from("hello");
let len = calculate_length(&s);  // borrow s
// s is still valid here
```

### Lifetime
A compile-time concept that tracks how long a reference is valid. Written
as `'a`, `'b`, etc. The compiler usually infers these automatically.

```rust
fn longer<'a>(a: &'a str, b: &'a str) -> &'a str { ... }
```

### Drop
Rust's destructor. Called automatically when a value goes out of scope.
Frees heap memory, closes file handles, etc. You rarely implement this
yourself.

```rust
impl Drop for MyType {
    fn drop(&mut self) {
        println!("cleaning up!");
    }
}
```

---

## Type System Concepts

### Trait
Rust's version of interfaces. Defines shared behavior.

```go
// Go interface           // Rust trait
type Stringer interface { // trait Display {
    String() string       //     fn fmt(&self, ...) -> fmt::Result;
}                         // }
```

Key difference: Rust traits can have default implementations, associated
types, and generic parameters.

### Enum (Algebraic Data Type)
Not like Go/TS enums. Rust enums can carry data in each variant.
Also called "sum types" or "tagged unions".

```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

### Generics
Type parameters. Same concept as Go generics or TS generics.

```rust
fn first<T>(items: &[T]) -> Option<&T> {
    items.first()
}
```

### Trait Bound
A constraint saying "this generic type must implement this trait."

```rust
fn print_it<T: Display>(item: T) { ... }
// Go equivalent: func PrintIt[T fmt.Stringer](item T) { ... }
```

### Zero-Cost Abstraction
An abstraction that has no runtime overhead compared to writing the
low-level code by hand. Rust's iterators, generics, and traits are all
zero-cost — the compiler optimizes them to the same assembly as hand-written
loops and direct function calls.

---

## Concurrency Concepts

### Send
A marker trait. A type is `Send` if it's safe to transfer to another thread.
Most types are Send. `Rc` is not (use `Arc` instead for multi-threaded code).

### Sync
A marker trait. A type is `Sync` if it's safe to share references across
threads. `&T` is Sync if `T` is Sync.

### Arc (Atomic Reference Count)
Thread-safe reference counting smart pointer. Like Go's sharing data
between goroutines, but with compile-time safety.

```rust
use std::sync::Arc;
let shared = Arc::new(vec![1, 2, 3]);
let clone = Arc::clone(&shared);  // both point to same data, ref count = 2
```

### Mutex
Mutual exclusion lock. Same as `sync.Mutex` in Go, but Rust forces you
to lock before accessing the data.

```rust
use std::sync::Mutex;
let data = Mutex::new(0);
let mut val = data.lock().unwrap();
*val += 1;
```

---

## Common Rust Syntax Quick Reference

| Syntax | Meaning |
|--------|---------|
| `let x = 5;` | Immutable variable binding |
| `let mut x = 5;` | Mutable variable binding |
| `&x` | Immutable reference (borrow) |
| `&mut x` | Mutable reference |
| `*x` | Dereference |
| `x?` | Return early if Err/None |
| `x.unwrap()` | Get value or panic |
| `::` | Path separator (like `.` in Go for packages) |
| `self` | Current instance (like `this` in TS, receiver in Go) |
| `Self` | Current type |
| `impl` | Implementation block (methods on a type) |
| `pub` | Public visibility (like uppercase in Go) |
| `mod` | Module declaration |
| `use` | Import (like `import` in Go) |
| `crate` | Current package root |
| `super` | Parent module |
| `'a` | Lifetime annotation |
| `<T>` | Generic type parameter |
| `where T: Display` | Trait bound (alternative syntax) |
| `dyn Trait` | Trait object (dynamic dispatch) |
| `impl Trait` | Opaque type (static dispatch) |
| `#[derive(...)]` | Auto-implement traits |
| `#[cfg(test)]` | Conditional compilation (test only) |
| `todo!()` | Placeholder, panics at runtime |
| `unimplemented!()` | Marks unfinished code |
| `unreachable!()` | Marks logically impossible code |
| `vec![1,2,3]` | Vector literal macro |
| `println!("{x}")` | Print with format (macros end with `!`) |
| `{:?}` | Debug format |
| `{:#?}` | Pretty-printed debug format |

---

## Cargo Commands (Rust's Toolchain)

| Command | What it does | Go equivalent |
|---------|-------------|---------------|
| `cargo new myapp` | Create new project | `go mod init myapp` |
| `cargo build` | Compile | `go build` |
| `cargo run` | Build and run | `go run .` |
| `cargo test` | Run tests | `go test ./...` |
| `cargo check` | Type-check without building | - |
| `cargo clippy` | Linter | `golangci-lint` |
| `cargo fmt` | Format code | `gofmt` |
| `cargo add serde` | Add dependency | `go get serde` |
| `cargo doc --open` | Generate and view docs | `go doc` |
| `cargo bench` | Run benchmarks | `go test -bench` |

---

## Common Derive Macros

These auto-generate trait implementations:

| Derive | What it does | When to use |
|--------|-------------|-------------|
| `Debug` | Enables `{:?}` formatting | Almost always |
| `Clone` | Enables `.clone()` | When you need copies |
| `Copy` | Enables implicit copying | Small, stack-only types |
| `PartialEq` | Enables `==` comparison | When you compare values |
| `Eq` | Full equality (no NaN weirdness) | Non-float types |
| `Hash` | Enables use as HashMap key | With Eq |
| `Default` | Enables `Type::default()` | Config structs |
| `Serialize` / `Deserialize` | JSON/YAML/etc (serde) | API types |

```rust
#[derive(Debug, Clone, PartialEq)]
struct User {
    name: String,
    age: u32,
}
```

---

## Comparison Cheat Sheet: Rust vs Go vs TypeScript

| Concept | Rust | Go | TypeScript |
|---------|------|----|------------|
| Null/nil | `Option<T>` | `nil` | `null`/`undefined` |
| Error handling | `Result<T,E>` + `?` | `(val, error)` | `try/catch` |
| Interfaces | `trait` | `interface` | `interface` |
| Generics | `<T: Bound>` | `[T Constraint]` | `<T extends X>` |
| Inheritance | None (composition) | None (embedding) | `extends` |
| Package manager | Cargo | Go modules | npm/yarn |
| Concurrency | `async/await` + tokio | goroutines + channels | `async/await` + Promises |
| Memory | Ownership + borrowing | Garbage collected | Garbage collected |
| Immutability | Default (use `mut`) | Default mutable | `const`/`let` |
| String types | `String` / `&str` | `string` | `string` |
| Array types | `Vec<T>` / `[T; N]` | `[]T` / `[N]T` | `T[]` |
| Map types | `HashMap<K,V>` | `map[K]V` | `Map<K,V>` / `Record` |
| Closures | `\|args\| body` | `func(args) { body }` | `(args) => body` |
| Tests | `#[cfg(test)]` mod | `_test.go` files | Jest/Vitest |
| Build | `cargo build` | `go build` | `tsc` / bundler |
