# Lesson 10: Packages & Modules

## How Go Organizes Code

Think of packages as rooms in a house. Each room has a purpose
(kitchen, bedroom) and contains related things. Modules are the
house itself — they bundle rooms together and manage dependencies.

```
Module (house):  github.com/you/myapp
                 +----------------------------+
                 |                            |
                 |  +--------+  +--------+   |
                 |  | main   |  | models |   |
                 |  | (entry)|  | (data) |   |
                 |  +--------+  +--------+   |
                 |                            |
                 |  +--------+  +--------+   |
                 |  | server |  | utils  |   |
                 |  | (HTTP) |  | (help) |   |
                 |  +--------+  +--------+   |
                 |                            |
                 +----------------------------+
                 go.mod (the blueprint)
```

In Rust, you have crates (modules) and `mod` declarations
(packages). Go's system is simpler: directory = package.

---

## go.mod: Your Module File

```bash
go mod init github.com/you/myapp
```

Creates:

```
module github.com/you/myapp

go 1.22
```

Like Rust's `Cargo.toml` but minimalist. After adding dependencies:

```
module github.com/you/myapp

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/jmoiron/sqlx v1.3.5
)
```

`go.sum` is the lockfile (like `Cargo.lock`). Commit both files.

---

## Package Basics

One directory = one package. All files in a directory must have
the same `package` declaration.

```
myapp/
  go.mod
  main.go             package main
  server/
    server.go          package server
    middleware.go       package server
  models/
    user.go            package models
    order.go           package models
```

```go
package server

import "net/http"

func NewRouter() http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("/health", healthHandler)
    return mux
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("ok"))
}
```

```go
package main

import (
    "fmt"
    "net/http"

    "github.com/you/myapp/server"
)

func main() {
    router := server.NewRouter()
    fmt.Println("Starting on :8080")
    http.ListenAndServe(":8080", router)
}
```

---

## Visibility: The Uppercase Rule

```
+-------------------------------------------+
|  Exported (public)    = Uppercase start    |
|  NewServer, UserName, MaxRetries           |
+-------------------------------------------+
|  Unexported (private) = lowercase start    |
|  newServer, userName, maxRetries           |
+-------------------------------------------+
```

This is the ONLY visibility mechanism in Go. No `pub`, no
`public`, no access modifiers. Just case.

```go
package models

type User struct {
    Name  string
    Email string
    age   int
}

func NewUser(name, email string, age int) *User {
    return &User{Name: name, Email: email, age: age}
}

func (u *User) IsAdult() bool {
    return u.age >= 18
}
```

Other packages can access `Name`, `Email`, `NewUser`, `IsAdult`.
They cannot access `age` directly — it's encapsulated.

---

## Import Patterns

```go
import "fmt"

import (
    "fmt"
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"

    "github.com/you/myapp/models"
)
```

Convention: group imports in three blocks separated by blank lines:

1. Standard library
2. External packages
3. Internal packages

### Import Aliases

```go
import (
    "encoding/json"

    httpSwagger "github.com/swaggo/http-swagger"
    myJson "github.com/you/myapp/json"
)
```

### Blank Import (Side Effects)

```go
import _ "github.com/lib/pq"
```

Imports the package for its `init()` function only. Common for
database drivers that register themselves.

---

## The init() Function

```go
package config

import "os"

var DatabaseURL string

func init() {
    DatabaseURL = os.Getenv("DATABASE_URL")
    if DatabaseURL == "" {
        DatabaseURL = "localhost:5432"
    }
}
```

`init()` runs automatically when the package is imported. Rules:

- Multiple `init()` per file allowed (but discouraged)
- Runs once per package
- Runs before `main()`
- Use sparingly — prefer explicit initialization

```
Execution order:

  1. Package-level variables initialized
  2. init() functions run (in dependency order)
  3. main() runs
```

---

## The Go Toolchain

```
+-------------------+----------------------------------+
| Command           | What it does                     |
+-------------------+----------------------------------+
| go mod init       | Create new module                |
| go mod tidy       | Add missing, remove unused deps  |
| go get pkg@v1.2.3 | Add/update a dependency          |
| go build ./...    | Build all packages               |
| go test ./...     | Test all packages                |
| go vet ./...      | Static analysis                  |
| go fmt ./...      | Format all code                  |
| go run .          | Build and run                    |
| go install        | Build and install binary         |
+-------------------+----------------------------------+
```

### Adding Dependencies

```bash
go get github.com/gin-gonic/gin@latest

go mod tidy
```

`go mod tidy` is your friend. Run it often — it cleans up `go.mod`
and `go.sum`.

---

## Project Layout

Small project:

```
myapp/
  go.mod
  main.go
  handler.go
  store.go
```

Medium project:

```
myapp/
  go.mod
  cmd/
    server/
      main.go
    cli/
      main.go
  internal/
    server/
      handler.go
      middleware.go
    store/
      user.go
      order.go
  pkg/
    validate/
      validate.go
```

### Special Directories

```
+------------+-------------------------------------------+
| Directory  | Purpose                                   |
+------------+-------------------------------------------+
| cmd/       | Entry points (each subdir = one binary)   |
| internal/  | Private code (cannot be imported outside  |
|            | the module — enforced by Go)              |
| pkg/       | Public library code (importable)          |
+------------+-------------------------------------------+
```

The `internal/` directory is special in Go. Code inside it can
only be imported by code in the parent tree. The compiler enforces
this.

```
myapp/
  internal/
    secret/      <-- only myapp code can import this
      secret.go
```

---

## Vendoring

```bash
go mod vendor
```

Copies all dependencies into a `vendor/` directory. Useful for:
- Reproducible builds without network
- Auditing dependencies
- CI/CD environments

Most projects use modules without vendoring today.

---

## Comparing with Rust

```
+-------------------+-------------------+
| Rust              | Go                |
+-------------------+-------------------+
| Cargo.toml        | go.mod            |
| Cargo.lock        | go.sum            |
| crate             | module            |
| mod (in file)     | directory         |
| pub               | Uppercase         |
| pub(crate)        | internal/         |
| cargo build       | go build          |
| cargo test        | go test           |
| cargo add         | go get            |
| crates.io         | proxy.golang.org  |
+-------------------+-------------------+
```

---

## Exercises

1. Create a module with two packages: `mathutil` (with `Add`,
   `Multiply`) and `main`. Import and use `mathutil` from `main`

2. Create an `internal/config` package that reads from environment
   variables. Verify it can't be imported from outside the module

3. Set up a project with `cmd/server/main.go` and
   `cmd/cli/main.go`. Build both binaries

4. Add an external dependency (e.g., `github.com/fatih/color`),
   use it, then run `go mod tidy`

5. Create a package with exported and unexported types. Write a
   test in another package to verify visibility rules

---

[Next: Lesson 11 - Testing ->](11-testing.md)
