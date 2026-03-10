# Lesson 05: Structs and Methods

Structs let you group related data into one type. Methods let you attach
behavior to that type. Rust does this without classes or inheritance.

---

**Keywords in this lesson:** [`impl`](./reference-rust-glossary.md#impl),
[trait](./reference-rust-glossary.md#trait),
[move](./reference-rust-glossary.md#move)

## Why Rust Uses Structs and `impl`

Rust separates:

- the data shape (`struct`)
- the behavior attached to that shape (`impl`)

That keeps types simple and explicit. You can look at a struct and see what
data it stores, then look at its `impl` block and see what operations it
supports.

## Defining Structs

```rust
#[derive(Debug)]
struct User {
    name: String,
    email: String,
    age: u32,
    active: bool,
}
```

### Creating instances

```rust
fn main() {
    let user = User {
        name: String::from("Augustus"),
        email: String::from("aug@example.com"),
        age: 30,
        active: true,
    };
    println!("{:?}", user);
}
```

### Field init shorthand

```rust
fn new_user(name: String, email: String) -> User {
    User {
        name,       // same as name: name
        email,      // same as email: email
        age: 0,
        active: true,
    }
}
```

### Struct update syntax

```rust
let user2 = User {
    email: String::from("new@example.com"),
    ..user  // take remaining fields from `user`
};
// NOTE: `user.name` was MOVED to user2, so `user` is partially invalid
```

---

## Methods with `impl`

```rust
#[derive(Debug)]
struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    // Associated function (no self) — like a static method / constructor
    fn new(width: f64, height: f64) -> Self {
        Self { width, height }
    }

    fn square(size: f64) -> Self {
        Self { width: size, height: size }
    }

    // Method — takes &self (immutable borrow)
    fn area(&self) -> f64 {
        self.width * self.height
    }

    fn perimeter(&self) -> f64 {
        2.0 * (self.width + self.height)
    }

    // Method — takes &mut self (mutable borrow)
    fn scale(&mut self, factor: f64) {
        self.width *= factor;
        self.height *= factor;
    }

    // Method — takes self (consumes/moves)
    fn into_square(self) -> Rectangle {
        let side = (self.width + self.height) / 2.0;
        Rectangle { width: side, height: side }
    }
}

fn main() {
    let mut rect = Rectangle::new(10.0, 5.0);

    println!("Area: {}", rect.area());        // borrow
    rect.scale(2.0);                           // mutable borrow
    println!("Scaled area: {}", rect.area());

    let square = rect.into_square();           // rect is consumed/moved
    // rect is no longer valid here
    println!("Square: {:?}", square);
}
```

### The three `self` types

| Signature | Meaning |
|-----------|---------|
| `&self` | Immutable borrow — read only |
| `&mut self` | Mutable borrow — can modify |
| `self` | Takes ownership — consumes the value |

**Rule of thumb:** Use `&self` by default. Use `&mut self` when you need
to modify. Use `self` (consuming) only for transformations that invalidate
the original.

---

## Tuple Structs

Structs without named fields. Useful for newtypes.

```rust
struct Meters(f64);
struct Seconds(f64);

fn speed(distance: Meters, time: Seconds) -> f64 {
    distance.0 / time.0
}

fn main() {
    let d = Meters(100.0);
    let t = Seconds(9.58);
    println!("Speed: {:.2} m/s", speed(d, t));

    // speed(t, d);  // COMPILE ERROR: wrong types, even though both are f64
}
```

---

## Unit Structs

Structs with no fields. Used as markers or to implement traits.

```rust
struct Marker;

impl Marker {
    fn describe(&self) -> &str {
        "I'm a marker"
    }
}
```

---

## Builder Pattern (common in Rust)

Since Rust doesn't have default/optional parameters:

```rust
#[derive(Debug)]
struct Config {
    host: String,
    port: u16,
    max_connections: u32,
    timeout_ms: u64,
}

impl Config {
    fn builder(host: impl Into<String>) -> ConfigBuilder {
        ConfigBuilder {
            host: host.into(),
            port: 8080,
            max_connections: 100,
            timeout_ms: 5000,
        }
    }
}

struct ConfigBuilder {
    host: String,
    port: u16,
    max_connections: u32,
    timeout_ms: u64,
}

impl ConfigBuilder {
    fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    fn max_connections(mut self, max: u32) -> Self {
        self.max_connections = max;
        self
    }

    fn timeout_ms(mut self, timeout: u64) -> Self {
        self.timeout_ms = timeout;
        self
    }

    fn build(self) -> Config {
        Config {
            host: self.host,
            port: self.port,
            max_connections: self.max_connections,
            timeout_ms: self.timeout_ms,
        }
    }
}

fn main() {
    let config = Config::builder("localhost")
        .port(3000)
        .max_connections(50)
        .build();

    println!("{config:?}");
}
```

---

## Exercises

### Exercise 1: Create a Point struct
```rust
// Create a Point struct with x, y (f64)
// Add methods: new, distance_to(&self, other: &Point), translate(&mut self, dx, dy)
```

### Exercise 2: Create a newtype
```rust
// Create Celsius(f64) and Fahrenheit(f64) tuple structs
// Add a method to_fahrenheit() on Celsius
// Make sure you can't accidentally pass Fahrenheit where Celsius is expected
```

### Exercise 3: Builder
```rust
// Create a HttpRequest builder with: method, url, headers (Vec<(String,String)>), body (Option<String>)
// Defaults: method = "GET", no headers, no body
```

---

## Key Takeaways

1. **Structs store data, `impl` blocks attach behavior.**
2. **`Self`** is an alias for the current type inside `impl`.
3. **`&self` / `&mut self` / `self`** tell you whether a method reads, mutates, or consumes.
4. **Tuple structs** create distinct types from primitives (newtypes).
5. **Builder pattern** replaces optional/default parameters.
6. **`#[derive(Debug)]`** is your best friend — always add it.

Next: [Lesson 06 — Traits](./06-traits.md)
