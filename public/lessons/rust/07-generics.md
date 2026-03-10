# Lesson 07: Generics and Trait Bounds

Generics let you write reusable code without giving up static type checking.
Trait bounds let you say what a generic type must be able to do. In Rust,
this usually compiles down with no runtime dispatch cost.

---

## Basic Generics

```rust
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in &list[1..] {
        if item > largest {
            largest = item;
        }
    }
    largest
}

fn main() {
    let numbers = vec![34, 50, 25, 100, 65];
    println!("Largest: {}", largest(&numbers));

    let chars = vec!['y', 'm', 'a', 'q'];
    println!("Largest: {}", largest(&chars));
}
```

**Go equivalent:**
```go
func Largest[T constraints.Ordered](list []T) T { ... }
```

**TS equivalent:**
```typescript
function largest<T extends { valueOf(): number }>(list: T[]): T { ... }
```

---

## Generic Structs

```rust
#[derive(Debug)]
struct Pair<T> {
    first: T,
    second: T,
}

#[derive(Debug)]
struct KeyValue<K, V> {
    key: K,
    value: V,
}

impl<K: std::fmt::Display, V: std::fmt::Debug> KeyValue<K, V> {
    fn describe(&self) -> String {
        format!("{}: {:?}", self.key, self.value)
    }
}

fn main() {
    let kv = KeyValue { key: "name", value: String::from("Augustus") };
    println!("{}", kv.describe());
}
```

---

## Trait Bounds Syntax

Three equivalent ways to write them:

```rust
// 1. Inline (simple cases)
fn process(item: &impl Summary) { ... }

// 2. Angle bracket bounds
fn process<T: Summary>(item: &T) { ... }

// 3. Where clause (complex cases — preferred for readability)
fn process<T>(item: &T)
where
    T: Summary + Display + Clone,
{ ... }
```

### Multiple generics with different bounds

```rust
fn mix<A, B>(a: &A, b: &B) -> String
where
    A: Display + Clone,
    B: Debug + Summary,
{
    format!("{} and {:?}", a, b)
}
```

---

## Monomorphization (why Rust generics are zero-cost)

When you write:

```rust
fn add<T: std::ops::Add<Output = T>>(a: T, b: T) -> T {
    a + b
}

let x = add(1i32, 2i32);
let y = add(1.0f64, 2.0f64);
```

The compiler generates two concrete functions at compile time:

```rust
fn add_i32(a: i32, b: i32) -> i32 { a + b }
fn add_f64(a: f64, b: f64) -> f64 { a + b }
```

No runtime cost. No vtable. No indirection. This is different from Go's
generics which can use runtime dictionaries.

---

## Generic Enums (you already use these!)

```rust
// Option and Result are generic enums:
enum Option<T> {
    Some(T),
    None,
}

enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

---

## Impl blocks can be conditional on trait bounds

```rust
#[derive(Debug)]
struct Wrapper<T> {
    value: T,
}

// Available for ALL Wrapper<T>
impl<T> Wrapper<T> {
    fn new(value: T) -> Self {
        Self { value }
    }
}

// Only available when T implements Display
impl<T: std::fmt::Display> Wrapper<T> {
    fn display(&self) {
        println!("Value: {}", self.value);
    }
}

// Only available when T implements PartialOrd
impl<T: PartialOrd> Wrapper<T> {
    fn is_greater_than(&self, other: &T) -> bool {
        self.value > *other
    }
}
```

**TS equivalent:** This is like conditional types, but for methods.

---

## Exercises

### Exercise 1: Generic min function
```rust
// Write a function `min` that returns the smaller of two values
// It should work with any type that can be compared
fn min<T>(a: T, b: T) -> T {
    todo!()
}
```

### Exercise 2: Generic Stack
```rust
// Implement a Stack<T> with push, pop (returns Option<T>), and is_empty
struct Stack<T> {
    elements: Vec<T>,
}
```

### Exercise 3: Conditional methods
```rust
// Create a Container<T> struct
// Add a `sum` method that only works when T: std::ops::Add + Copy + Default
// Add a `print_all` method that only works when T: Display
```

---

## Key Takeaways

1. **Same concept as Go/TS generics** but with richer trait bounds.
2. **Monomorphization** = zero runtime cost. Compiler generates concrete code.
3. **`where` clauses** keep complex bounds readable.
4. **Conditional `impl` blocks** let you add methods only for certain types.
5. **You already use generics:** `Option<T>`, `Result<T, E>`, `Vec<T>`.

Next: [Lesson 08 — Iterators and Closures](./08-iterators-closures.md)
