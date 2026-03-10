# Lesson 21: How Real Languages Work — V8, Go, Rust, CPython, TypeScript

## The Car Manufacturer Analogy

Every language implementation makes different trade-offs:

- **V8 (JavaScript)**: A sports car with a turbocharger (JIT) that kicks in on the highway
  (hot functions). Complex engine, amazing speed when everything aligns.
- **Go compiler**: A reliable truck. Simple engine, predictable performance, handles heavy
  loads (concurrency) without fuss. No turbo, but you always know what you're getting.
- **Rust (rustc)**: A Formula 1 car. Maximum performance, strict safety checks before every
  race (borrow checker). Longer in the pit (compile times), nothing faster on the track.
- **CPython**: A bicycle. Gets you there, simple to understand. Not winning races, but you
  can add a motor (C extensions) for specific hills.
- **TypeScript**: A GPS system. Tells you where the potholes are (type errors), then hands
  off to the vehicle (JavaScript engine).

---

## V8: The JavaScript Engine

V8 powers Chrome, Node.js, Deno, and Bun.

### The Pipeline

```
JavaScript source → Parser → AST
    → Ignition (bytecode interpreter, every function starts here)
    → TurboFan (optimizing JIT compiler, for hot functions)
    → Deoptimization (fall back to Ignition if assumptions break)
```

### Ignition: The Interpreter

Every function compiles to bytecode first — fast to compile, slow to execute vs native code.

```bash
node --print-bytecode --print-bytecode-filter=add script.js
```

For `function add(a, b) { return a + b; }` you'll see:

```
         0 : 25 02             Ldar a1
         2 : 39 03 00          Add a0, [0]
         5 : a9                Return
```

Simple stack-machine bytecode — very similar to what we built in lesson 18.

### TurboFan: Speculative Optimization

When a function is hot (called frequently), TurboFan compiles it to optimized machine code
using **speculative optimization** — it makes assumptions based on what it has seen so far:

```javascript
function add(a, b) { return a + b; }
add(1, 2);       // integers
add(3, 4);       // TurboFan: "always integers" → compile with fast int addition
add("hello", " world");  // STRING?! Assumption violated → deoptimize back to Ignition
```

TurboFan saw integers every time, so it compiled `add` assuming integer inputs. When a
string shows up, the assumption is wrong. V8 **deoptimizes** — throws away the optimized
machine code and falls back to Ignition's bytecode. This is called **OSR** (On-Stack
Replacement) — the function switches execution strategy mid-flight.

### Hidden Classes and Inline Caches

V8 assigns each object a **hidden class** (shape) describing its layout. Objects with the
same properties in the same order share a hidden class.

**Inline caches (ICs)** remember the hidden class from the last property access. Same class
next time? Skip the lookup — direct memory read.

```javascript
function getX(obj) { return obj.x; }
getX({x: 1, y: 2});  // IC miss → lookup → cache shape
getX({x: 3, y: 4});  // IC HIT (same shape) → fast
getX({y: 5, x: 6});  // IC MISS (different order = different shape) → slow
```

This is why JavaScript guides say: always initialize objects with the same properties in the
same order.

### Seeing V8 Internals

```bash
node --trace-opt --trace-deopt script.js
node --trace-ic script.js
node --allow-natives-syntax -e "
function add(a, b) { return a + b; }
add(1, 2); add(3, 4);
%OptimizeFunctionOnNextCall(add);
add(5, 6);
console.log(%GetOptimizationStatus(add));
"
```

---

## The Go Compiler

Go takes the opposite philosophy: simplicity and predictability.

### The Pipeline

```
Go source → Parser → AST → Type Checker
    → SSA Builder → SSA Optimization Passes
    → Code Generation → Assembler → Machine Code
```

### Escape Analysis

The compiler determines whether a value can live on the stack (fast, no GC) or must escape
to the heap:

```go
func createPoint() *Point {
    p := Point{X: 1, Y: 2}
    return &p   // p escapes → heap allocated
}
```

```bash
$ go build -gcflags='-m' ./...
./main.go:5:2: moved to heap: p
```

The reverse matters too: if a value doesn't escape, it stays on the stack. Zero heap
allocation, zero GC work. This is why Go performs well despite having a GC — the compiler
keeps most short-lived values off the heap entirely.

```go
func distance(a, b Point) float64 {
    dx := a.X - b.X
    dy := a.Y - b.Y
    return math.Sqrt(dx*dx + dy*dy)
}
```

Here `a`, `b`, `dx`, `dy` all live on the stack. No heap allocation, no GC pressure.

### Goroutine Scheduling

Go's M:N scheduler multiplexes goroutines (G) onto OS threads (M) via processors (P):

```
P0: [G1, G2, G3]    P1: [G4, G5, G6]    P2: [G7, G8, G9]
     ↓                    ↓                    ↓
    M0 (OS thread)       M1                   M2
```

Goroutines start with 2KB stacks (vs 1-8MB for OS threads). Work stealing: idle Ps steal
from busy Ps. GOMAXPROCS controls the number of Ps.

### Interface Method Dispatch

Interfaces use **itabs** — cached lookup tables mapping interface methods to concrete
implementations. Repeated calls through the same interface type use fast direct function
pointers.

### Seeing Go Internals

```bash
go build -gcflags='-m' ./...
go build -gcflags='-m -m' ./...
GOSSAFUNC=FunctionName go build main.go
go build -gcflags='-S' ./...
```

`GOSSAFUNC` generates an HTML file showing every SSA pass.

---

## Rustc: The Rust Compiler

### The Pipeline

```
Rust source → Parser → AST
    → Name Resolution + Macro Expansion → HIR (High-level IR, desugaring)
    → Type Checking + Trait Resolution
    → MIR (Mid-level IR, borrow checker runs HERE)
    → LLVM IR → LLVM Optimization → Machine Code
```

### The Borrow Checker at MIR Level

The borrow checker operates on MIR — a simplified control-flow graph. At this level, borrows
and drops are explicit, making lifetime analysis tractable.

### Monomorphization

Generic code gets a separate copy for each concrete type:

```rust
fn max<T: Ord>(a: T, b: T) -> T { if a > b { a } else { b } }

max(1i32, 2i32);     // generates max_i32
max(1.0f64, 2.0f64); // generates max_f64
max("a", "b");       // generates max_str
```

No runtime dispatch, no type erasure. Trade-off: binary bloat for speed. Go's interfaces
take the opposite approach — one copy, runtime dispatch.

### Seeing Rust Internals

```bash
rustc --emit=mir main.rs
rustc --emit=llvm-ir main.rs
rustc --emit=asm -C opt-level=2 main.rs
cargo rustc -- -Z time-passes 2>&1 | head -40
```

The time-passes output shows LLVM optimization often dominates compile time.

---

## CPython: The Python Interpreter

### The Pipeline

```
Python source → PEG Parser → AST → Compiler → Bytecode → Interpreter (ceval.c)
```

No JIT in standard CPython. The bytecode interpreter is a giant C switch statement in a
file called `ceval.c`. That's the entire execution engine.

### Why Python Is "Slow"

**Everything is an object.** `1 + 2` is a method call, not a CPU instruction. Look up
`__add__`, check types, allocate result object.

**Dynamic typing.** Every operation checks types at runtime. `a + b` could be int addition,
string concatenation, or a custom `__add__`.

**The GIL** (Global Interpreter Lock). Only one thread executes bytecode at a time. No
multi-core CPU parallelism. (Python 3.13 has an experimental free-threaded build.)

### Seeing CPython Internals

```bash
python3 -m dis script.py
python3 -c "import dis; dis.dis(lambda a, b: a + b)"
```

Output for `a + b`: `LOAD_FAST 0`, `LOAD_FAST 1`, `BINARY_ADD`, `RETURN_VALUE`. Same
concepts as our bytecode VM.

Faster alternatives: **PyPy** (tracing JIT, 5-10x faster), **Cython** (compiles to C),
**Mojo** (compiles via MLIR/LLVM).

---

## TypeScript: The Type Eraser

TypeScript is a static analysis tool that emits JavaScript. It's not a runtime.

### The Pipeline

```
TypeScript source → Parser → AST → Binder (symbol table)
    → Type Checker → Emitter → JavaScript (types stripped)
```

**Type erasure**: all type information is removed. At runtime, zero trace of your types.

```typescript
function add(a: number, b: number): number { return a + b; }
// Becomes: function add(a, b) { return a + b; }
```

TypeScript can never make code faster — runtime performance depends entirely on the
JavaScript engine. TypeScript's value is catching bugs at compile time, not speeding up
execution.

Tools like `esbuild` (Go-based) and `swc` (Rust-based) skip type checking and just strip
types, making them 10-100x faster for the emit step. But they don't catch type errors.

```bash
tsc --diagnostics    # shows time spent in type checking vs emit
```

Type checking dominates: a typical project spends 90%+ of compile time checking types and
under 10% emitting JavaScript.

---

## Side-by-Side Comparison

```
              V8            Go compiler    rustc           CPython        tsc
Input         JavaScript    Go             Rust            Python         TypeScript
Output        Machine code  Machine code   Machine code    Bytecode       JavaScript
              (JIT)         (AOT)          (AOT via LLVM)  (interpreted)  (transpiled)

Optimization  TurboFan JIT  SSA passes     rustc + LLVM    Almost none    None
              (speculative) (conservative)  (aggressive)

GC            Generational  Concurrent     None            RefCount +     N/A
              (Orinoco)     tri-color      (ownership)     cycle detect

Concurrency   Event loop    Goroutines     Threads         GIL            N/A
                            (M:N)          (Send/Sync)
```

---

## Commands Summary

### V8 / Node.js
```bash
node --print-bytecode script.js
node --trace-opt --trace-deopt script.js
node --trace-ic script.js
```

### Go
```bash
go build -gcflags='-m' ./...
GOSSAFUNC=FunctionName go build main.go
go build -gcflags='-S' ./...
```

### Rust
```bash
rustc --emit=mir main.rs
rustc --emit=llvm-ir main.rs
rustc --emit=asm -C opt-level=2 main.rs
```

### Python
```bash
python3 -m dis script.py
```

### TypeScript
```bash
tsc --diagnostics
```

---

## What Each Language Teaches You

**V8**: Initialize objects consistently. Avoid polymorphic call sites. Don't change shapes.
These help hidden classes, ICs, and TurboFan.

**Go**: Reduce allocations (escape analysis). Prefer values over pointers for small structs.
Understand interface dispatch overhead.

**Rust**: Generics are monomorphized (code bloat). Use `dyn Trait` for single-copy dispatch.
Trust LLVM to optimize — write clear code, not clever code.

**Python**: Use C extensions or NumPy for hot loops. GIL limits CPU parallelism. Every
operation has object overhead.

**TypeScript**: Types are erased. Performance depends on the JS engine. TypeScript catches
bugs, not speed problems.

---

## Exercises

1. **V8 bytecode.** Write three functions: consistent types, changing types, megamorphic.
   Use `--print-bytecode` and `--trace-opt` to see how V8 treats each.

2. **Go escape analysis.** Pass a struct by value vs pointer. Use `-gcflags='-m'` to see
   what escapes. Benchmark both.

3. **Rust MIR.** Write a function, emit MIR, identify borrow and drop operations.

4. **Python bytecode.** Disassemble a for loop, list comprehension, and generator.
   Compare bytecode for each.

5. **Cross-language benchmark.** Implement the same algorithm in Go, Rust, Python, JS.
   Explain performance differences from implementation knowledge.

---

## Key Takeaways

- V8 uses interpret-first (Ignition), optimize-hot-paths (TurboFan)
- Go compiles through SSA with escape analysis as a key optimization
- Rust uses rustc frontend + LLVM backend, borrow checker at MIR level
- CPython interprets bytecode with no JIT
- TypeScript erases types — it's analysis, not a runtime
- Every language's performance advice traces back to its implementation

---

## What's Next

In the final lesson: LLVM — the compiler backend powering Rust, Swift, Clang, Julia, and
Zig. How separating frontend from backend was a revolutionary idea, and how you could use
LLVM for your own language.
