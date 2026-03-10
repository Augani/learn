# Lesson 7: From Source Code to Running Program — Compilation and Interpretation

## The Big Question

You write text in a file. Somehow, your CPU — which only understands electrical signals
representing 1s and 0s — executes it. How does human-readable code become machine action?

There are two fundamental strategies, and understanding them deeply will change how you
think about every programming language you touch.

---

## The Translation Analogy

Imagine you wrote a novel in English, and you want French readers to enjoy it.

**Strategy 1 — Compilation (translate the whole book first):**
You hire a translator. They spend weeks converting every sentence into French. The result
is a standalone French book. From that point forward, any French reader picks it up and
reads at full speed. The translation effort is paid once.

**Strategy 2 — Interpretation (hire a live translator):**
You hire a person who sits next to each French reader and reads the English book aloud,
translating sentence by sentence in real time. No upfront wait, but every single reading
session requires the translator to do the work again.

```
  COMPILATION                          INTERPRETATION

  English Book                         English Book
      |                                    |
      v                                    v
  [Translator works for weeks]         [Live translator reads aloud]
      |                                    |
      v                                    v
  French Book (standalone)             French speech (ephemeral)
      |                                    |
      v                                    v
  Reader reads at full speed           Listener hears at translator's pace
  No translator needed anymore         Translator needed every time
```

This is the core trade-off:
- **Compiled languages** (Rust, C, Go): slow to build, fast to run.
- **Interpreted languages** (Python, Ruby): instant to start, slower to run.

---

## The Compilation Pipeline — A Factory Assembly Line

Compilation is not one step. It is a carefully designed pipeline, like a factory where
raw material enters one end and a finished product comes out the other.

```
 THE COMPILATION FACTORY
 ========================

 Source Code ("let x = 5 + 3;")
      |
      v
 +-------------+     +-----------+     +-------+     +-----------+     +---------------+
 |   LEXER     | --> |  PARSER   | --> |  AST  | --> | OPTIMIZER | --> |   CODE GEN    |
 | (Tokenizer) |     | (Grammar) |     | Tree  |     | (Improve) |     | (Machine Code)|
 +-------------+     +-----------+     +-------+     +-----------+     +---------------+
      |                    |               |               |                   |
 Breaks into          Checks if       Builds a        Simplifies         Produces
 words/tokens         sentence is     tree of         and speeds         actual CPU
 "let" "x" "="       grammatically   meaning         things up          instructions
 "5" "+" "3" ";"     correct                                             (mov, add...)
```

Let's walk through each stage with a real example.

### Stage 1: Lexing (Tokenization)

The lexer reads raw characters and groups them into meaningful tokens. Think of it like
a child learning to read — first you identify individual words before understanding the
sentence.

Input: `let x = 5 + 3;`

Output tokens:
```
[KEYWORD:"let"] [IDENT:"x"] [EQUALS:"="] [NUMBER:"5"] [PLUS:"+"] [NUMBER:"3"] [SEMICOLON:";"]
```

The lexer does not care about meaning. It just identifies the "words" of the language.
Whitespace is discarded (in most languages). Comments are stripped away.

### Stage 2: Parsing (Grammar Checking)

The parser takes the token stream and checks whether it follows the language's grammar
rules. This is exactly like checking whether an English sentence is grammatically correct.

"The cat sat on the mat" — valid grammar.
"Cat the on mat sat the" — same words, broken grammar.

Similarly:
- `let x = 5 + 3;` — valid syntax.
- `let = x 5 + 3` — the parser rejects this.

When you see "syntax error on line 42," that is the parser telling you your grammar is wrong.

### Stage 3: Abstract Syntax Tree (AST)

The parser produces a tree structure that represents the meaning of your code, stripped
of syntactic sugar like semicolons and parentheses.

```
        AST for "let x = 5 + 3;"

            LetBinding
           /         \
        name        value
         |            |
         x          Add
                   /   \
                  5     3
```

The AST is the compiler's internal understanding of what you meant. Every tool that
analyzes code — linters, formatters, IDEs giving you autocomplete — builds an AST.

### Stage 4: Optimization

The optimizer transforms the AST (or an intermediate representation) to make the code
faster without changing its meaning. Like an editor improving a novel without altering
the story.

Examples:
- **Constant folding**: `5 + 3` becomes `8` at compile time. Why compute it at runtime?
- **Dead code elimination**: Code that can never be reached is removed.
- **Inlining**: Small functions are copied into their call sites to avoid function call overhead.
- **Loop unrolling**: `for i in 0..4 { f(i) }` becomes `f(0); f(1); f(2); f(3);`

This is where compilers earn their keep. A good optimizer can make code 10-100x faster
than a naive translation.

### Stage 5: Code Generation

The final stage translates the optimized representation into actual machine instructions —
the binary language your CPU speaks.

```
  Optimized IR              x86-64 Machine Code
  -----------              --------------------
  store 8 -> x     --->    mov  DWORD PTR [rbp-4], 8
```

Notice: the compiler already computed `5 + 3 = 8`. The generated machine code just
stores the result directly.

---

## JIT Compilation — The Hybrid Approach

What if you could get the best of both worlds?

**JIT (Just-In-Time) compilation** is like a translator who starts by reading aloud
(interpretation), but memorizes phrases they keep repeating. After translating "Where is
the bathroom?" for the 50th time, they just recall the French from memory.

```
 JIT COMPILATION TIMELINE
 ========================

 Time ------>

 |--- Interpret (slow) ---|--- Compile hot paths ---|--- Run compiled (fast) ---|

 First few runs:    "This function is called a lot..."    Compiled version runs
 Execute bytecode    Compiler kicks in, optimizes it      at near-native speed
```

This is how:
- **Java** works: javac compiles to bytecode, then the JVM's JIT compiler optimizes hot paths to native code.
- **JavaScript** works: V8 interprets first, then TurboFan compiles frequently-executed functions.
- **C#/.NET** works: Roslyn compiles to IL (Intermediate Language), then the CLR JIT-compiles at runtime.

The JIT has an advantage that ahead-of-time compilers lack: it can observe the actual
runtime behavior and optimize based on real data. "This branch is taken 99% of the time?
Let me optimize for that case."

---

## Language Spectrum

Languages don't fall neatly into "compiled" or "interpreted." It is a spectrum:

```
 Fully Compiled                                              Fully Interpreted
 (ahead of time)                                             (line by line)

 |---------|---------|------------|------------|------------|-----------|
 C       Rust      Go          Java         Python       JavaScript   Bash
                               C#            Ruby         (V8 JIT)
                              (JIT)         (bytecode
                                          + interpreter)
```

The boundaries are blurry. Python compiles to bytecode. JavaScript has a JIT that
produces native code. Go compiles ahead of time but includes a runtime for garbage
collection. The important thing is understanding the trade-offs, not memorizing
categories.

---

## What Happens When You Type `cargo run`

Let's trace the full journey for a Rust program:

```rust
// main.rs
fn main() {
    let x = 5 + 3;
    println!("Result: {}", x);
}
```

```
 $ cargo run
      |
      v
 [1. Cargo reads Cargo.toml, checks dependencies]
      |
      v
 [2. rustc compiles main.rs]
      |   - Lexing, parsing, type checking
      |   - Borrow checker validates memory safety
      |   - Generates MIR (Mid-level IR)
      |   - Generates LLVM IR (intermediate representation)
      |
      v
 [3. LLVM backend]
      |   - Optimizes the IR (constant folding, inlining, etc.)
      |   - Generates machine code for YOUR specific CPU
      |   - Produces an object file (.o)
      |
      v
 [4. Linker]
      |   - Combines object file with standard library
      |   - Resolves external symbols
      |   - Produces final executable (ELF on Linux, Mach-O on macOS, PE on Windows)
      |
      v
 [5. OS loads executable into memory]
      |   - Maps text section (code) as read+execute
      |   - Maps data section as read+write
      |   - Sets up stack, heap
      |
      v
 [6. CPU executes starting from entry point]
      |   - _start → main()
      |   - mov DWORD PTR [rbp-4], 8    (the 5+3 was computed at compile time!)
      |   - syscall to write "Result: 8" to stdout
      |
      v
 "Result: 8"
```

Rust has an extra step that most compiled languages lack: the **borrow checker**. After
parsing, rustc analyzes every reference to ensure no dangling pointers, no data races,
no use-after-free. This is the step that makes Rust developers occasionally curse at
their screen — and the step that eliminates entire classes of bugs.

---

## What Happens When You Type `python script.py`

```python
# script.py
x = 5 + 3
print(f"Result: {x}")
```

```
 $ python script.py
      |
      v
 [1. Python reads source file]
      |
      v
 [2. Compiles to bytecode]          <-- Yes, Python DOES compile!
      |   - Lexing, parsing
      |   - Generates bytecode instructions
      |   - Optionally caches as .pyc file in __pycache__/
      |
      v
 [3. Python Virtual Machine (PVM) executes bytecode]
      |   - LOAD_CONST 8             (Python also folds 5+3 at compile time!)
      |   - STORE_NAME 'x'
      |   - LOAD_NAME 'print'
      |   - FORMAT_VALUE
      |   - CALL_FUNCTION
      |
      v
 "Result: 8"
```

A common misconception: Python is not "interpreted from source." It compiles to bytecode
first, then a virtual machine interprets that bytecode. The `.pyc` files in `__pycache__`
are the proof. The difference from Rust is that Python's bytecode runs on a virtual CPU
(the PVM), not directly on your hardware.

You can inspect the bytecode yourself:

```python
import dis

def example():
    x = 5 + 3
    return x

dis.dis(example)
# Output:
#   2    0 LOAD_CONST     1 (8)        <-- constant folded!
#        2 STORE_FAST     0 (x)
#   3    4 LOAD_FAST      0 (x)
#        6 RETURN_VALUE
```

---

## Linking — Assembling the Book

Real programs are not a single file. They are dozens, hundreds, or thousands of files,
plus external libraries. **Linking** is the process of combining these separately compiled
pieces into one executable.

Think of it like writing a book with multiple authors, each writing a chapter. Linking is
the editor who assembles the chapters, ensures cross-references work ("see Chapter 5"),
and produces the final bound book.

```
  file_a.o          file_b.o         libmath.a
  (Chapter 1)       (Chapter 2)      (Appendix)
       \                |               /
        \               |              /
         v              v             v
       +----------------------------+
       |         LINKER              |
       |  - Resolves "see Ch. 5"    |
       |  - Combines all sections   |
       |  - Assigns final addresses |
       +----------------------------+
                    |
                    v
              my_program (executable)
```

### Static vs Dynamic Linking

**Static linking** — baking everything into one file.

Like a cookbook that contains every recipe it references, including basics like "how to
boil water." The book is self-contained but thick.

- Pro: No external dependencies. Ship one file, it works everywhere.
- Con: Larger binary. If the boil-water recipe has a bug, every cookbook needs reprinting.

**Dynamic linking** — referencing external files at runtime.

Like a cookbook that says "for the bechamel sauce, see Julia Child's Mastering the Art
of French Cooking, page 42." The book is thinner, but the reader must own that other book.

- Pro: Smaller binaries. Fix the library once, every program benefits.
- Con: "DLL hell" — the referenced book might be a different edition, or missing entirely.

```
 STATIC LINKING                        DYNAMIC LINKING

 +------------------+                  +------------------+
 | my_program       |                  | my_program       |
 |                  |                  |                  |
 | [my code]        |                  | [my code]        |
 | [libmath code]   |  <-- baked in   | [ref: libmath]   |  <-- just a reference
 | [libcrypto code] |                  | [ref: libcrypto] |
 +------------------+                  +------------------+
                                              |    |
  One big self-contained file                 v    v
                                       libmath.so  libcrypto.so
                                       (separate files on disk)
```

In practice:
- **Go** statically links by default — Go binaries are single files with no dependencies.
- **Rust** statically links the Rust standard library but dynamically links system libraries (libc).
- **C/C++** programs on Linux typically dynamically link against libc, libpthread, etc.

---

## What an Executable File Actually Contains

When you compile a program, the output is not just machine code. It is a structured file
with headers, sections, and metadata. On Linux, this format is called **ELF**
(Executable and Linkable Format).

```
 SIMPLIFIED ELF BINARY LAYOUT
 =============================

 +---------------------------+  <-- Byte 0
 |      ELF HEADER           |
 |  - Magic: 0x7f "ELF"     |  <-- How the OS identifies it as executable
 |  - Architecture (x86-64)  |
 |  - Entry point address    |  <-- Where execution begins
 |  - Section table offset   |
 +---------------------------+
 |    PROGRAM HEADERS        |
 |  - How to load into memory|
 |  - Which sections go where|
 +---------------------------+
 |                           |
 |    .text SECTION          |  <-- YOUR CODE (machine instructions)
 |    (read + execute)       |      The CPU reads from here
 |                           |
 +---------------------------+
 |    .rodata SECTION        |  <-- Read-only data
 |    (read only)            |      String literals: "Result: %d"
 +---------------------------+
 |    .data SECTION          |  <-- Initialized global variables
 |    (read + write)         |      int counter = 42;
 +---------------------------+
 |    .bss SECTION           |  <-- Uninitialized global variables
 |    (read + write)         |      int buffer[1024]; (zeroed at startup)
 +---------------------------+
 |    .symtab SECTION        |  <-- Symbol table (for debugging)
 |                           |      Maps addresses to function names
 +---------------------------+
 |    SECTION HEADERS        |  <-- Table describing all sections
 +---------------------------+
```

You can examine a real binary:

```bash
# See the headers
readelf -h /usr/bin/ls

# See the sections
readelf -S /usr/bin/ls

# See the symbols (function names)
nm my_program

# Disassemble the .text section
objdump -d my_program
```

Why does this matter? When you debug a segfault, understanding that `.text` is read-execute
and `.data` is read-write helps you understand why writing to code memory crashes. When
you strip a binary for production, you are removing `.symtab` to make it smaller and harder
to reverse-engineer.

---

## Build Systems — Why They Exist

Imagine you are writing a book with 200 chapters. You fix a typo in Chapter 47. Do you
retranslate all 200 chapters into French? Of course not — you only retranslate Chapter 47.

Build systems solve this exact problem for code. They track which files changed and
only recompile those files plus anything that depends on them.

```
 WITHOUT A BUILD SYSTEM           WITH A BUILD SYSTEM (e.g., make, cargo)

 $ gcc *.c -o program             $ make
                                    - Checks timestamps
 Recompiles EVERYTHING             - file_a.c changed → recompile file_a.o
 every single time                 - file_b.c unchanged → skip
 (30 seconds)                      - Re-link final binary
                                    (2 seconds)
```

### Make (C/C++ world)

The grandfather of build systems. You write rules declaring dependencies:

```makefile
# Makefile
program: main.o utils.o math.o
	gcc -o program main.o utils.o math.o

main.o: main.c utils.h
	gcc -c main.c

utils.o: utils.c utils.h
	gcc -c utils.c

math.o: math.c math.h
	gcc -c math.c
```

Make checks timestamps: if `main.c` is newer than `main.o`, it recompiles. Otherwise, skip.

### Cargo (Rust)

Cargo handles everything: dependency management, compilation, testing, publishing.

```bash
cargo build          # Compile (debug mode, fast compile, slow binary)
cargo build --release  # Compile (slow compile, optimized fast binary)
cargo run            # Build + run
cargo test           # Build + run tests
cargo check          # Type-check without generating code (fastest feedback)
```

Cargo automatically tracks dependencies via `Cargo.toml` and caches intermediate results
in the `target/` directory. Incremental compilation means changing one function only
recompiles the affected parts.

### Go Build

Go has a built-in build system. No Makefile needed:

```bash
go build ./...       # Compile everything
go run main.go       # Compile and run
go test ./...        # Compile and run tests
```

Go caches compiled packages in `$GOPATH/pkg`. The toolchain is famously fast — large Go
projects compile in seconds where C++ projects take minutes.

---

## Cross-Compilation — Different Kitchen, Same Recipe

Cross-compilation means compiling code on one platform to run on a different one. Like
writing a recipe in an American kitchen (measuring cups) that will be cooked in a
European kitchen (scales and grams).

Your development machine is x86-64 Linux, but you need the program to run on ARM (a
Raspberry Pi, a phone, a cloud ARM instance). The instructions your CPU understands are
completely different from what ARM understands.

```
 CROSS-COMPILATION

 Your Machine (x86-64 Linux)          Target (ARM Linux)
 +-----------------------+            +--------------------+
 |  Source Code          |            |                    |
 |        |              |            |  Runs the ARM      |
 |        v              |            |  binary you built  |
 |  Cross-Compiler       |  ------>   |  on your x86 box   |
 |  (targets ARM)        |  (copy)    |                    |
 |        |              |            +--------------------+
 |        v              |
 |  ARM binary           |
 +-----------------------+
```

Go makes this remarkably easy:

```bash
# On your x86-64 Linux machine:
GOOS=linux GOARCH=arm64 go build -o myapp-arm64
GOOS=darwin GOARCH=arm64 go build -o myapp-macos
GOOS=windows GOARCH=amd64 go build -o myapp.exe
```

Three commands, three binaries for three completely different platforms. No extra toolchains
needed. This is one of Go's killer features.

Rust supports it too, though it requires installing the target toolchain:

```bash
rustup target add aarch64-unknown-linux-gnu
cargo build --target aarch64-unknown-linux-gnu
```

Cross-compilation is critical in the real world:
- Mobile app development (compile on macOS for Android ARM)
- Embedded systems (compile on your laptop for a microcontroller)
- CI/CD pipelines (build on x86 cloud servers, deploy to ARM servers)
- Docker multi-architecture images

---

## Compiler Optimizations — The Secret Sauce

Modern compilers are shockingly clever. Understanding a few key optimizations helps you
write code that cooperates with the compiler rather than fighting it.

### Constant Folding

```rust
// You write:
let seconds_per_day = 60 * 60 * 24;

// Compiler generates code for:
let seconds_per_day = 86400;
```

The multiplication never happens at runtime. The compiler computes it during compilation.

### Dead Code Elimination

```go
func process(x int) int {
    if false {
        // This entire block is removed by the compiler.
        // It never appears in the binary.
        return expensiveComputation(x)
    }
    return x + 1
}
```

### Function Inlining

```rust
// You write:
fn square(x: i32) -> i32 { x * x }
fn main() {
    let result = square(5);
}

// Compiler transforms to (conceptually):
fn main() {
    let result = 25;  // inlined AND constant-folded
}
```

The function call overhead (push args, jump, return) is eliminated entirely.

### Loop Unrolling

```python
# Conceptually, a compiler might transform:
for i in range(4):
    data[i] *= 2

# Into:
data[0] *= 2
data[1] *= 2
data[2] *= 2
data[3] *= 2
```

This eliminates the loop counter, the comparison, and the branch — all of which cost
CPU cycles.

---

## Debug vs Release Builds

Most compilers have at least two modes:

| Aspect              | Debug Build               | Release Build                |
|---------------------|---------------------------|------------------------------|
| Optimization level  | None or minimal (O0)      | Aggressive (O2, O3)         |
| Compile speed       | Fast                      | Slow                        |
| Runtime speed       | Slow (10-100x slower)     | Fast                        |
| Binary size         | Large (debug symbols)     | Small (stripped)             |
| Debugger support    | Full (step through code)  | Limited (code rearranged)   |
| Assertions/checks   | Enabled                   | Often disabled               |

```bash
# Rust
cargo build            # Debug: fast to compile, slow to run
cargo build --release  # Release: slow to compile, fast to run

# Go
go build               # Optimized by default
go build -gcflags="-N -l"  # Disable optimizations for debugging

# C/C++
gcc -O0 -g main.c      # Debug: no optimization, include debug info
gcc -O3 main.c          # Release: maximum optimization
```

A common trap for beginners: benchmarking a debug build and concluding a language is slow.
Rust debug builds are notoriously slow because bounds checking and overflow checking are
enabled. Always benchmark release builds.

---

## Exercises

### Exercise 1: Trace the Pipeline

Take this code and manually trace it through each compilation stage:

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn main() {
    let result = add(3, 4);
    println!("{}", result);
}
```

Write out:
1. What tokens the lexer produces for the `add` function.
2. What the AST looks like (draw a tree).
3. What optimizations the compiler might apply.
4. What the final machine code might look like (pseudocode is fine).

### Exercise 2: Inspect Real Bytecode

Run this Python script and explain each bytecode instruction:

```python
import dis

def greet(name):
    message = "Hello, " + name + "!"
    return message

dis.dis(greet)
```

Then try with constant expressions and see if Python folds them:

```python
import dis

def constants():
    x = 2 * 3 * 7
    y = "hello" + " " + "world"
    return x, y

dis.dis(constants)
```

### Exercise 3: Static vs Dynamic Linking

On a Linux machine, run:

```bash
# See what dynamic libraries /usr/bin/ls depends on:
ldd /usr/bin/ls

# Compare with a Go binary:
go build -o hello hello.go
ldd hello        # Likely says "not a dynamic executable"
file hello        # Shows it is statically linked
```

Why does the Go binary have no dynamic dependencies? What are the trade-offs?

### Exercise 4: Cross-Compilation

If you have Go installed, cross-compile a simple program for three platforms:

```go
package main

import (
    "fmt"
    "runtime"
)

func main() {
    fmt.Printf("Running on %s/%s\n", runtime.GOOS, runtime.GOARCH)
}
```

```bash
GOOS=linux   GOARCH=amd64 go build -o hello-linux
GOOS=darwin  GOARCH=arm64 go build -o hello-macos
GOOS=windows GOARCH=amd64 go build -o hello.exe

# Check that they are different binary formats:
file hello-linux hello-macos hello.exe
```

### Exercise 5: Optimization Impact

Write a Rust program that sums numbers from 1 to 1,000,000 in a loop. Compile it in
debug and release mode. Time both:

```bash
cargo build && time ./target/debug/myprogram
cargo build --release && time ./target/release/myprogram
```

How much faster is the release build? Why? (Hint: the compiler may eliminate the entire
loop via constant folding.)

---

## Key Takeaways

1. **Compilation is a pipeline**, not a single step. Lexer, parser, AST, optimizer, code generator — each does one job well.
2. **The compiled vs interpreted distinction is a spectrum.** Python compiles to bytecode. JavaScript has a JIT. The boundaries are blurry.
3. **JIT compilers observe runtime behavior** and can optimize based on actual data — an advantage over ahead-of-time compilers.
4. **Linking combines compiled pieces** into a final executable. Static linking is self-contained; dynamic linking is shared.
5. **Executables have structure** — headers, code sections, data sections. Understanding this helps with debugging and security.
6. **Build systems exist to avoid redundant work.** Only recompile what changed.
7. **Cross-compilation lets you build for any platform** from any platform. Go makes it trivially easy.
8. **Compiler optimizations are profound.** Constant folding, inlining, dead code elimination — your code and the executed machine code may look very different.
9. **Always benchmark release builds.** Debug builds are designed for developer convenience, not performance.
