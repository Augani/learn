# Lesson 16: Trait Objects vs Generics (Dynamic vs Static Dispatch)

This is about how Rust calls methods when the concrete type isn't known
at compile time. You need this for plugin systems, collections of different
types, and returning different types from functions.

---

## The Problem

You have a trait `Animal` and want a list of different animals:

```rust
trait Animal {
    fn speak(&self) -> String;
}

struct Dog;
struct Cat;

impl Animal for Dog {
    fn speak(&self) -> String { "Woof!".to_string() }
}

impl Animal for Cat {
    fn speak(&self) -> String { "Meow!".to_string() }
}
```

This doesn't work:
```rust
// COMPILE ERROR: Vec needs one concrete type
let animals: Vec<???> = vec![Dog, Cat];
```

---

## Static Dispatch (Generics) — `impl Trait`

The compiler generates separate code for each concrete type. Fast (inlined),
but can't mix types.

```rust
fn make_speak(animal: &impl Animal) {
    println!("{}", animal.speak());
}

// Compiler generates:
// fn make_speak_dog(animal: &Dog) { ... }
// fn make_speak_cat(animal: &Cat) { ... }

fn main() {
    make_speak(&Dog);
    make_speak(&Cat);
}
```

**Go equivalent:** Go 1.18 generics with type constraints.

---

## Dynamic Dispatch (Trait Objects) — `dyn Trait`

Uses a vtable (pointer to method table) at runtime. Slightly slower but
allows mixing types.

```rust
fn make_speak(animal: &dyn Animal) {
    println!("{}", animal.speak());
}

fn main() {
    // Now we CAN have a mixed collection
    let animals: Vec<Box<dyn Animal>> = vec![
        Box::new(Dog),
        Box::new(Cat),
        Box::new(Dog),
    ];

    for animal in &animals {
        println!("{}", animal.speak());
    }
}
```

**Go equivalent:** Go interfaces are ALWAYS dynamic dispatch:
```go
var animals []Animal = []Animal{Dog{}, Cat{}}
for _, a := range animals {
    fmt.Println(a.Speak())
}
```

In Rust, you explicitly choose static vs dynamic. In Go, it's always dynamic.

---

## Returning Different Types

```rust
// Static dispatch — can only return ONE type
fn create_animal_static() -> impl Animal {
    Dog  // can only ever return Dog
}

// Dynamic dispatch — can return different types
fn create_animal(kind: &str) -> Box<dyn Animal> {
    match kind {
        "dog" => Box::new(Dog),
        "cat" => Box::new(Cat),
        _ => Box::new(Dog),
    }
}
```

---

## When to Use Which

| Situation | Use | Why |
|-----------|-----|-----|
| Function takes one type | `impl Trait` (generics) | Zero-cost, inlined |
| Collection of mixed types | `Box<dyn Trait>` | Different types in one vec |
| Return different types | `Box<dyn Trait>` | Type decided at runtime |
| Plugin/extensibility system | `Box<dyn Trait>` | Users add new types |
| Performance-critical hot path | Generics | No vtable overhead |
| Reducing compile time/binary size | `dyn Trait` | Less code duplication |

---

## Trait Object Limitations

Not all traits can be made into trait objects. The trait must be
"object-safe":

```rust
// OBJECT-SAFE (can use as dyn Trait):
trait Drawable {
    fn draw(&self);
    fn name(&self) -> String;
}

// NOT OBJECT-SAFE (cannot use as dyn Trait):
trait Clonable {
    fn clone_self(&self) -> Self;  // returns Self — size unknown
}

trait Generic {
    fn process<T>(&self, item: T);  // generic method — can't put in vtable
}
```

Rules for object safety:
- Methods can't return `Self`
- Methods can't have generic type parameters
- Trait can't require `Sized`

---

## Real-World Example: Handler Pattern

```rust
trait Handler {
    fn handle(&self, request: &str) -> String;
}

struct JsonHandler;
struct XmlHandler;
struct DefaultHandler;

impl Handler for JsonHandler {
    fn handle(&self, request: &str) -> String {
        format!("JSON response for: {request}")
    }
}

impl Handler for XmlHandler {
    fn handle(&self, request: &str) -> String {
        format!("<response>{request}</response>")
    }
}

impl Handler for DefaultHandler {
    fn handle(&self, request: &str) -> String {
        format!("Plain: {request}")
    }
}

struct Router {
    handlers: Vec<(&'static str, Box<dyn Handler>)>,
}

impl Router {
    fn new() -> Self {
        Self { handlers: vec![] }
    }

    fn add_route(&mut self, path: &'static str, handler: Box<dyn Handler>) {
        self.handlers.push((path, handler));
    }

    fn dispatch(&self, path: &str, request: &str) -> String {
        for (route, handler) in &self.handlers {
            if *route == path {
                return handler.handle(request);
            }
        }
        "404 Not Found".to_string()
    }
}

fn main() {
    let mut router = Router::new();
    router.add_route("/api", Box::new(JsonHandler));
    router.add_route("/xml", Box::new(XmlHandler));
    router.add_route("/", Box::new(DefaultHandler));

    println!("{}", router.dispatch("/api", "get users"));
    println!("{}", router.dispatch("/xml", "get config"));
}
```

---

## Exercises

### Exercise 1: Shape calculator
```rust
// Create a trait `Shape` with `area()` and `perimeter()`
// Implement for Circle, Rectangle, Triangle
// Create a function that takes Vec<Box<dyn Shape>> and prints totals
```

### Exercise 2: Plugin system
```rust
// Create a `Plugin` trait with `name()` and `execute()`
// Create several plugin implementations
// Create a `PluginManager` that stores and runs all plugins
```

---

## Key Takeaways

1. **Generics (`impl Trait`)** = static dispatch, zero cost, one type per call.
2. **Trait objects (`dyn Trait`)** = dynamic dispatch, mixed types, slight overhead.
3. **Go interfaces are always dynamic dispatch.** Rust lets you choose.
4. **`Box<dyn Trait>`** is the standard way to store trait objects.
5. **Object safety rules** restrict which traits can be used as `dyn`.
6. **Default to generics.** Use trait objects when you need mixed types.

Next: [Lesson 17 — Macros](./17-macros.md)
