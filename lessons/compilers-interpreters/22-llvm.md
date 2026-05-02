# Lesson 22: LLVM — The Universal Backend Behind Rust, Swift, and Clang

## The UN Translator Analogy

Imagine the United Nations. Diplomats speak French, Mandarin, Arabic, Spanish. They all need
to communicate. The solution: translators convert each language to a **common intermediate
form**, then from that to whatever the listener needs.

Without this, you need N x M translations. With it, you need N + M.

```
Without LLVM (N x M):                 With LLVM (N + M):
Rust ──→ x86                           Rust ──┐
Rust ──→ ARM                           Swift ──┤
Swift ──→ x86                          C ──────┼──→ LLVM IR ──┬──→ x86
Swift ──→ ARM                          Zig ────┤              ├──→ ARM
6 langs x 4 targets = 24 compilers    Julia ──┘              ├──→ WASM
                                                              └──→ RISC-V
                                       6 frontends + 4 backends = 10 components
```

LLVM is that universal translator. Build a **frontend** that generates LLVM IR, and LLVM
handles optimization and code generation for every supported CPU.

---

## What LLVM Actually Is

LLVM is a **compiler infrastructure** — reusable libraries for building compilers. Not a
compiler itself. The name originally stood for "Low Level Virtual Machine" but the acronym
meaning was dropped years ago.

Languages using LLVM as their backend:

```
Language     Frontend       Status
Rust         rustc          Primary backend
Swift        swiftc         Primary backend
C/C++        Clang          Built by the LLVM project
Zig          zig compiler   Primary backend
Julia        Julia JIT      JIT via LLVM
Kotlin/Nat   Kotlin/Native  Compiles to native
Haskell      GHC            Optional LLVM backend
```

---

## LLVM IR: The Intermediate Representation

LLVM IR is a typed, SSA-based intermediate language. It exists in three equivalent forms:
in-memory (for the optimizer), bitcode (.bc, compact binary), and text (.ll, human-readable).

### A Simple Function

```llvm
define i32 @add(i32 %a, i32 %b) {
entry:
    %result = add i32 %a, %b
    ret i32 %result
}
```

- `define i32 @add(i32 %a, i32 %b)` — function taking two 32-bit ints, returning one
- `entry:` — basic block label
- `%result = add i32 %a, %b` — add two values, store in `%result`
- `ret i32 %result` — return

It's SSA: `%result` is assigned exactly once. `%` = local, `@` = global.

### A More Complex Example

```llvm
define i32 @factorial(i32 %n) {
entry:
    %is_base = icmp eq i32 %n, 0
    br i1 %is_base, label %base_case, label %recursive_case

base_case:
    ret i32 1

recursive_case:
    %n_minus_1 = sub i32 %n, 1
    %sub_result = call i32 @factorial(i32 %n_minus_1)
    %result = mul i32 %n, %sub_result
    ret i32 %result
}
```

Key instructions: `icmp` (integer compare), `br` (branch), `call` (function call). Types
are explicit everywhere.

### LLVM IR Types

```llvm
i1, i8, i16, i32, i64, i128    ; integer types
float, double                    ; floating point
ptr                              ; opaque pointer (LLVM 15+)
[10 x i32]                      ; array of 10 i32s
{ i32, double }                  ; struct
%Point = type { i32, i32 }      ; named struct
void                             ; no return value
```

---

## The Three-Phase Design

```
Phase 1: FRONTEND              Phase 2: OPTIMIZER            Phase 3: BACKEND
(language-specific)             (language-independent)         (target-specific)

rustc: parsing, types,          Constant folding               x86-64 codegen
borrow checking, MIR            Dead code elimination          ARM64 codegen
                                Inlining                       WASM codegen
        │                       Loop vectorization             RISC-V codegen
        ▼                       Mem2Reg, SROA, CSE
     LLVM IR ──────────────→ Optimized IR ──────────────→ Machine code
```

**Why this matters**: You build Phase 1 (the hard part for your language). LLVM provides
Phase 2 and 3 for free. World-class optimization and codegen for every architecture.

---

## Key LLVM Optimization Passes

### mem2reg (Memory to Register Promotion)

Frontends generate verbose IR using alloca/load/store. mem2reg promotes to SSA registers:

```llvm
; Before:                              ; After mem2reg:
%a.addr = alloca i32                   %result = add i32 %a, %b
store i32 %a, ptr %a.addr             ret i32 %result
%0 = load i32, ptr %a.addr
%result = add i32 %0, %b
ret i32 %result
```

### SROA (Scalar Replacement of Aggregates)

Breaks structs into individual scalars that fit in registers:

```llvm
; Before:                              ; After SROA:
%point = alloca %Point                 ; struct disappears entirely
store {i32 1, i32 2}, ptr %point       ; fields become SSA values
```

### Inlining

LLVM's inliner uses a cost model considering function size, call frequency, whether
arguments are constants (enabling further optimization), and loop context.

### Loop Vectorization

Converts scalar loops to SIMD: one instruction processes 4-16 elements at once.

```
Scalar: for i in 0..1000: a[i] = b[i] + c[i]     (1000 additions)
Vector: for i in 0..1000 step 4: a[i:i+4] = b[i:i+4] + c[i:i+4]  (250 SIMD adds)
```

---

## LLVM Backends

```
Target      Description                 Used by
x86-64      Intel/AMD desktop/server    Most desktop software
AArch64     Apple Silicon, phones       iOS, macOS, Android
WASM        WebAssembly                 Browser, edge computing
RISC-V      Open-source ISA             Embedded, growing
NVPTX       NVIDIA GPUs                 CUDA computing
AMDGPU      AMD GPUs                    GPU computing
```

Cross-compile from Rust:

```bash
rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown

rustup target add aarch64-apple-darwin
cargo build --target aarch64-apple-darwin
```

---

## How Rust Uses LLVM

```
Rust source → AST → HIR → MIR → LLVM IR → LLVM optimizer → machine code
              └─── rustc ──────────┘       └──── LLVM ──────────┘
```

By the time code reaches LLVM IR, ownership, borrowing, and lifetimes are resolved. LLVM
sees straightforward typed code and optimizes the same way it would optimize C. This is why
Rust and C have similar runtime performance.

```bash
echo 'pub fn add(a: i32, b: i32) -> i32 { a + b }' > /tmp/add.rs
rustc --emit=llvm-ir --crate-type=lib -C opt-level=0 /tmp/add.rs -o /tmp/add_O0.ll
rustc --emit=llvm-ir --crate-type=lib -C opt-level=2 /tmp/add.rs -o /tmp/add_O2.ll
```

At -O0: alloca, store, load. At -O2: a single add and return.

---

## Compiling LLVM IR to Machine Code

You can write IR by hand and compile it:

```bash
cat > /tmp/hello.ll << 'EOF'
@greeting = private constant [14 x i8] c"Hello, LLVM!\0A\00"
declare i32 @printf(ptr, ...)

define i32 @main() {
entry:
    %0 = call i32 (ptr, ...) @printf(ptr @greeting)
    ret i32 0
}
EOF

llc /tmp/hello.ll -o /tmp/hello.s        # IR → assembly
clang /tmp/hello.s -o /tmp/hello         # assembly → executable
/tmp/hello                               # Hello, LLVM!
```

Target different architectures from the same IR:

```bash
llc /tmp/hello.ll -march=x86-64 -o /tmp/hello_x86.s
llc /tmp/hello.ll -march=aarch64 -o /tmp/hello_arm.s
```

### The opt Tool

Run optimization passes on IR:

```bash
opt -O2 -S /tmp/unoptimized.ll -o /tmp/optimized.ll
opt -passes='mem2reg,instcombine,simplifycfg' -S input.ll -o output.ll
```

---

## LLVM Optimization in Action

Start with unoptimized IR that computes `(5 + 3) * n`:

```llvm
define i32 @compute(i32 %n) {
entry:
    %x = alloca i32
    store i32 5, ptr %x
    %x.val = load i32, ptr %x
    %y = add i32 %x.val, 3
    %result = mul i32 %y, %n
    %unused = add i32 42, 0
    ret i32 %result
}
```

After `opt -O2`:

```llvm
define i32 @compute(i32 %n) {
entry:
    %result = shl i32 %n, 3
    ret i32 %result
}
```

LLVM: promoted alloca to register, folded `5 + 3 = 8`, recognized `n * 8 = n << 3`,
eliminated the unused computation. Six instructions became one.

---

## Writing a Frontend: Emitting LLVM IR from Go

The simplest approach — print `.ll` text. No LLVM library dependency:

```go
type LLVMEmitter struct {
    output    strings.Builder
    tempCount int
}

func NewLLVMEmitter() *LLVMEmitter {
    return &LLVMEmitter{}
}

func (e *LLVMEmitter) nextTemp() string {
    e.tempCount++
    return fmt.Sprintf("%%t%d", e.tempCount)
}

func (e *LLVMEmitter) emit(format string, args ...interface{}) {
    fmt.Fprintf(&e.output, format+"\n", args...)
}

func (e *LLVMEmitter) EmitFunction(name string) {
    e.emit("define i32 @%s(i32 %%a, i32 %%b) {", name)
    e.emit("entry:")
    result := e.nextTemp()
    e.emit("    %s = add i32 %%a, %%b", result)
    e.emit("    ret i32 %s", result)
    e.emit("}")
}

func (e *LLVMEmitter) EmitMain() {
    e.emit("")
    e.emit("@fmt = private constant [4 x i8] c\"%%d\\0A\\00\"")
    e.emit("declare i32 @printf(ptr, ...)")
    e.emit("")
    e.emit("define i32 @main() {")
    e.emit("entry:")
    result := e.nextTemp()
    e.emit("    %s = call i32 @add(i32 3, i32 4)", result)
    printResult := e.nextTemp()
    e.emit("    %s = call i32 (ptr, ...) @printf(ptr @fmt, i32 %s)", printResult, result)
    e.emit("    ret i32 0")
    e.emit("}")
}

func main() {
    emitter := NewLLVMEmitter()
    emitter.EmitFunction("add")
    emitter.EmitMain()
    fmt.Print(emitter.output.String())
}
```

Save the output to a `.ll` file, then: `llc output.ll -o output.s && clang output.s -o output`

For programmatic IR construction, use `tinygo-org/go-llvm` (Go bindings to LLVM's C API).

---

## Alternatives to LLVM

### Cranelift

Built by the Bytecode Alliance (Wasmtime). Fast compilation, good-enough optimization.

```
LLVM:       Compile slow, run fast. Best for release/AOT builds.
Cranelift:  Compile fast, run almost-as-fast. Best for JIT and debug builds.
```

Used by Wasmtime and experimentally by Rust for debug builds
(`-Zcodegen-backend=cranelift`).

### GCC

Predates LLVM. Uses GENERIC -> GIMPLE -> RTL pipeline. Similar output quality for most
workloads. Supports some targets LLVM doesn't (and vice versa).

### QBE

Lightweight backend (~12,000 lines of C). Good for hobby languages where LLVM is overkill.

---

## Hands-On: Exploring LLVM Tools

```bash
# Check installation
llc --version
opt --version

# Install if needed
brew install llvm        # macOS
sudo apt install llvm    # Ubuntu

# C to LLVM IR
echo 'int factorial(int n) { return n <= 1 ? 1 : n * factorial(n-1); }' > /tmp/fact.c
clang -S -emit-llvm -O0 /tmp/fact.c -o /tmp/fact_O0.ll
clang -S -emit-llvm -O2 /tmp/fact.c -o /tmp/fact_O2.ll

# Cross-compile to different targets
llc /tmp/fact_O2.ll -march=x86-64 -o /tmp/fact_x86.s
llc /tmp/fact_O2.ll -march=aarch64 -o /tmp/fact_arm.s

# Convert between formats
llvm-as /tmp/fact_O2.ll -o /tmp/fact.bc   # text → bitcode
llvm-dis /tmp/fact.bc -o /tmp/fact.ll      # bitcode → text

# See Rust's LLVM IR
echo 'pub fn sum(data: &[i32]) -> i64 {
    data.iter().map(|&x| x as i64).sum()
}' > /tmp/sum.rs
rustc --emit=llvm-ir --crate-type=lib -C opt-level=2 /tmp/sum.rs -o /tmp/sum.ll
```

---

## Why LLVM Changed Everything

Before LLVM, language designers had to: write their own backend (huge effort), compile to C
(hacky, loses debug info), or target JVM/CLR (adds runtime dependency).

LLVM gave a fourth option: generate IR, get production-quality native code for free. This
directly enabled Rust, Swift, Zig, and Julia to focus on language design instead of code
generation. Improvements to LLVM benefit every language. When LLVM adds a target (RISC-V),
every LLVM-based language gets it automatically.

---

## Exercises

1. **Write LLVM IR by hand.** Implement iterative Fibonacci with a loop and phi nodes.
   Compile with `llc` and run it.

2. **Compare optimization levels.** Run the factorial IR through `opt` at -O0, -O1, -O2,
   -O3. Diff each pair and identify what changed.

3. **Extend the Go emitter.** Add if/else (using `icmp` + `br`), while loops (basic blocks
   + `br`), and local variables (`alloca`/`store`/`load`).

4. **Cross-compile.** Write a C function, compile to IR, use `llc` to target x86-64, ARM64,
   and WASM. Compare the three outputs.

5. **Rust monomorphization.** Write a generic Rust function, call it with three types, emit
   LLVM IR. Count the monomorphized copies.

---

## Key Takeaways

- LLVM separates language frontends from machine code backends via LLVM IR
- LLVM IR is typed, SSA-based — like portable assembly
- Language designers build a frontend; LLVM provides optimization and codegen for free
- Rust, Swift, Clang, Zig, and Julia all use LLVM
- Key passes: mem2reg, inlining, vectorization, constant folding, DCE
- `llc` compiles IR to machine code, `opt` runs optimization passes
- Cranelift is a faster-compiling alternative for JIT and debug builds

---

## Track Summary

Over 22 lessons, you built a complete language implementation: lexer, parser, tree-walk
interpreter, type checker, bytecode compiler, VM, optimizer, and garbage collector. Then
you saw how V8, Go, Rust, CPython, and TypeScript put the same pieces together, and how
LLVM provides a shared backend for dozens of languages.

Every `go build`, `cargo build`, `tsc`, every time V8 runs your JavaScript — follows this
pipeline. Now you understand what happens between typing code and seeing results.
