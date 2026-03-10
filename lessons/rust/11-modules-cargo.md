# Lesson 11: Modules, Crates, and Cargo

Modules organize code inside a project. Crates and Cargo organize how Rust
code is packaged, built, tested, and shared. This lesson explains the
vocabulary and file layout that make Rust projects feel structured instead of mysterious.

---

## Terminology

| Rust | Go | TS |
|------|----|----|
| Crate | Module (as in `go.mod`) | Package (npm) |
| Module (`mod`) | Package (directory) | Module (file) |
| `Cargo.toml` | `go.mod` | `package.json` |
| `cargo add` | `go get` | `npm install` |
| crates.io | pkg.go.dev | npmjs.com |

A **crate** is a compilation unit — either a binary or a library.
A **module** is a namespace within a crate.

---

## Module System

### Declaring modules

```
src/
├── main.rs          # crate root (binary)
├── lib.rs           # crate root (library) — optional
├── models.rs        # module file
├── routes/          # module directory
│   ├── mod.rs       # module declaration (old style)
│   ├── users.rs     # submodule
│   └── posts.rs     # submodule
└── utils/
    └── helpers.rs   # submodule
```

**In `main.rs`:**
```rust
mod models;          // loads from src/models.rs
mod routes;          // loads from src/routes/mod.rs OR src/routes.rs
mod utils;           // loads from src/utils/mod.rs OR src/utils.rs

fn main() {
    let user = models::User::new("Augustus");
    routes::users::list_users();
}
```

### Modern file layout (preferred since Rust 2018)

Instead of `routes/mod.rs`, you can use `routes.rs` alongside a `routes/` directory:

```
src/
├── main.rs
├── routes.rs        # declares submodules
└── routes/
    ├── users.rs
    └── posts.rs
```

**`src/routes.rs`:**
```rust
pub mod users;
pub mod posts;
```

This is equivalent to the `mod.rs` approach but avoids having many files
named `mod.rs` in your editor.

**Go equivalent:** Go uses directories as packages. Every `.go` file in a
directory is part of the same package. Rust requires explicit `mod`
declarations.

---

## Visibility (`pub`)

Everything is private by default. Use `pub` to make items visible.

```rust
mod database {
    pub struct Connection {
        pub host: String,
        port: u16,       // private — only accessible within this module
    }

    impl Connection {
        pub fn new(host: &str, port: u16) -> Self {
            Self { host: host.to_string(), port }
        }

        pub fn connect(&self) {
            println!("Connecting to {}:{}", self.host, self.port);
        }

        fn internal_check(&self) {
            // private — only callable within this module
        }
    }

    pub fn default_connection() -> Connection {
        Connection::new("localhost", 5432)
    }

    fn private_helper() {
        // not visible outside `database` module
    }
}

fn main() {
    let conn = database::default_connection();
    conn.connect();
    println!("Host: {}", conn.host);
    // println!("Port: {}", conn.port);  // COMPILE ERROR: port is private
}
```

**Go equivalent:** Go uses capitalization (uppercase = public). Rust uses
`pub` keyword. Same concept, different syntax.

### Visibility levels

| Syntax | Visible to |
|--------|-----------|
| (nothing) | Current module only |
| `pub` | Everyone |
| `pub(crate)` | Current crate only |
| `pub(super)` | Parent module |
| `pub(in crate::path)` | Specific module path |

---

## `use` — Importing Items

```rust
use std::collections::HashMap;
use std::io::{self, Read, Write};   // multiple from same path
use std::fmt;

// Renaming
use std::collections::HashMap as Map;

// Glob import (avoid in production, fine in tests/preludes)
use std::collections::*;

fn main() {
    let mut map = HashMap::new();
    map.insert("key", "value");
}
```

**Go equivalent:**
```go
import (
    "fmt"
    "io"
    "os"
)
```

### Re-exporting with `pub use`

```rust
// In src/lib.rs
mod internal_models;

// Re-export so users can do `mycrate::User` instead of `mycrate::internal_models::User`
pub use internal_models::User;
```

This is like Go's type aliasing for public API design.

---

## Cargo.toml — Package Configuration

```toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
anyhow = "1"
thiserror = "2"

[dev-dependencies]
assert_cmd = "2"
tempfile = "3"

[[bin]]
name = "my-app"
path = "src/main.rs"
```

**Go equivalent:** `go.mod` + `go.sum`
**TS equivalent:** `package.json` + `package-lock.json`

### Adding dependencies

```bash
cargo add serde --features derive    # add with features
cargo add tokio -F full              # -F is short for --features
cargo add thiserror
cargo remove some-crate              # remove dependency
```

---

## Workspaces (monorepo)

Like Go workspaces or npm/yarn workspaces:

```toml
# Cargo.toml at project root
[workspace]
members = [
    "api",
    "cli",
    "shared",
]
```

```
project/
├── Cargo.toml          # workspace root
├── api/
│   ├── Cargo.toml      # depends on shared
│   └── src/main.rs
├── cli/
│   ├── Cargo.toml      # depends on shared
│   └── src/main.rs
└── shared/
    ├── Cargo.toml
    └── src/lib.rs
```

---

## Practical Module Example

```
src/
├── main.rs
├── config.rs
├── db.rs
└── handlers/
    ├── mod.rs (or handlers.rs at src level)
    ├── users.rs
    └── health.rs
```

**`src/main.rs`:**
```rust
mod config;
mod db;
mod handlers;

fn main() {
    let cfg = config::Config::from_env();
    let pool = db::connect(&cfg.database_url);
    handlers::users::list(&pool);
}
```

**`src/config.rs`:**
```rust
pub struct Config {
    pub database_url: String,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://localhost/mydb".to_string()),
            port: std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),
        }
    }
}
```

**`src/handlers/mod.rs`:**
```rust
pub mod users;
pub mod health;
```

---

## Useful Cargo Commands

```bash
cargo new my-project          # create binary project
cargo new my-lib --lib        # create library project
cargo build                   # compile (debug)
cargo build --release         # compile (optimized)
cargo run                     # build + run
cargo run -- --arg1 val       # pass args to your program
cargo check                   # type-check without building (fast!)
cargo clippy                  # linter
cargo fmt                     # format code
cargo doc --open              # generate + view docs
cargo tree                    # dependency tree
cargo update                  # update deps within semver bounds
cargo audit                   # check for security vulnerabilities
```

---

## Exercises

### Exercise 1: Create a module structure
Create a project with:
- `src/main.rs`
- `src/models/user.rs` — `pub struct User { pub name: String, pub email: String }`
- `src/models/mod.rs` — re-exports User
- `src/services/user_service.rs` — function that creates a User
- `src/services/mod.rs` — re-exports user_service

### Exercise 2: Visibility
Make a module with a struct where some fields are public and some are private.
Provide a constructor (`new`) and getter methods for private fields.

---

## Key Takeaways

1. **`mod` declares a module** — you must explicitly declare them (unlike Go).
2. **Everything is private by default** — use `pub` to export.
3. **`use` for imports** — like Go's `import`.
4. **`pub use` for re-exporting** — clean up your public API.
5. **`cargo add`** is your `go get` / `npm install`.
6. **Coming from Go:** biggest difference is explicit `mod` declarations
   and `pub` instead of uppercase naming.

Next: [Lesson 12 — Testing](./12-testing.md)
