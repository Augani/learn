# Lesson 01: Why Go

## The Elevator Pitch

Go is the language of cloud infrastructure. It compiles to a single
binary, starts instantly, handles thousands of concurrent connections,
and a junior dev can read a senior dev's code on day one.

Think of Go as a pickup truck: not the fastest, not the fanciest,
but it hauls anything, starts every morning, and anyone can drive it.

---

## Where Go Shines

```
+------------------+----------------------------+
| Domain           | Examples                   |
+------------------+----------------------------+
| Cloud infra      | Kubernetes, Docker, Istio  |
| CLI tools        | Terraform, gh, cobra       |
| Web servers      | API backends, microservices|
| DevOps           | Prometheus, Grafana agents |
| Networking       | CoreDNS, Caddy, Traefik   |
+------------------+----------------------------+
```

## Go vs Rust: Different Tools, Different Jobs

If you're coming from Rust, here's how to recalibrate your brain:

```
                Rust                          Go
         +----------------+           +----------------+
         | Zero-cost      |           | Fast-enough    |
         | abstractions   |           | abstractions   |
         |                |           |                |
         | Ownership &    |           | Garbage        |
         | borrowing      |           | collector      |
         |                |           |                |
         | Traits         |           | Interfaces     |
         |                |           |                |
         | Result<T, E>   |           | (T, error)     |
         |                |           |                |
         | Enums + match  |           | switch + types |
         |                |           |                |
         | Compile: mins  |           | Compile: secs  |
         +----------------+           +----------------+
              |                            |
              v                            v
         Systems, embedded,          Cloud, servers,
         performance-critical        team codebases
```

## Go's Philosophy

**1. Simplicity over cleverness**

Go has 25 keywords. Rust has 50+. There's usually one way to do
something in Go. No operator overloading, no macros, no generics
gymnastics (generics were only added in 1.18, and they're intentionally
limited).

**2. Readability over writability**

Code is read 10x more than it's written. Go optimizes for reading.
`gofmt` enforces a single style — no style debates, ever.

**3. Composition over inheritance**

No classes, no inheritance hierarchies. You compose behavior by
embedding structs and implementing interfaces. Like Rust's trait
system, but even simpler.

**4. Concurrency is a first-class citizen**

Goroutines are so cheap you can spawn millions. Channels let them
communicate safely. This is why Go dominates server-side code.

---

## Your First Go Program

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello from Go")
}
```

Run it:

```bash
go run main.go
```

Build a binary:

```bash
go build -o hello main.go
./hello
```

That binary is statically linked. Copy it to any machine with the same
OS/arch and it runs. No runtime to install. No dependency hell.

---

## The Go Toolchain

```
+----------+     +----------+     +----------+
|  go run  |     | go build |     |  go test |
| (run it) |     | (binary) |     | (test it)|
+----------+     +----------+     +----------+
      |                |                |
      v                v                v
+----------+     +----------+     +----------+
|  go fmt  |     |  go vet  |     | go mod   |
| (format) |     | (lint)   |     | (deps)   |
+----------+     +----------+     +----------+
```

Everything you need is built in:

- `go run` — compile and run
- `go build` — compile to binary
- `go test` — run tests
- `go fmt` — format code (non-negotiable)
- `go vet` — catch common mistakes
- `go mod` — dependency management

---

## Setting Up

```bash
# macOS
brew install go

# Verify
go version

# Create your first module
mkdir myproject && cd myproject
go mod init myproject
```

Your project structure:

```
myproject/
  go.mod          <-- like Cargo.toml
  main.go         <-- entry point
```

In Rust, you'd have `Cargo.toml` and `src/main.rs`. In Go, it's
`go.mod` and any `.go` file with `package main` and a `main()` func.

---

## The Go Playground

No setup needed to experiment: https://go.dev/play/

Shareable links, runs in the browser, perfect for testing ideas.

---

## Exercises

1. Install Go and run `go version`
2. Create a new module with `go mod init hello`
3. Write a `main.go` that prints your name
4. Build it with `go build` and run the binary directly
5. Try the Go Playground — write a program that prints the current
   time using `time.Now()`

---

[Next: Lesson 02 - Basics ->](02-basics.md)
