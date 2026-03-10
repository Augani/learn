# Lesson 1: How Languages Work — The Compilation Pipeline

Every programming language you've ever used — TypeScript, Go, Python, Rust — goes through
the same fundamental pipeline to turn your source code into something a computer can
execute. Understanding this pipeline is the single most important mental model for
everything else in this module.

---

## The Pipeline

```
Source Code → Lexer → Parser → Semantic Analysis → Code Generation → Execution
                |        |            |                   |
             Tokens     AST     Annotated AST      Target Code
```

Think of it like translating a book from English to Japanese:

1. **Lexer (Scanning)**: Split the text into individual words and punctuation marks. You
   don't understand meaning yet — you're just identifying the building blocks. "The cat
   sat." becomes `["The", "cat", "sat", "."]`.

2. **Parser (Parsing)**: Arrange those words into sentence structures. "The cat sat" is
   a sentence with a subject ("the cat") and a verb ("sat"). You're building a tree of
   meaning, not just a flat list. This tree is called an **Abstract Syntax Tree (AST)**.

3. **Semantic Analysis**: Check that the sentences actually make sense. "The cat sat" is
   grammatically correct. "The sat cat the" is not — even though the individual words are
   fine. This is where type checking happens (you can't add a string to an integer).

4. **Code Generation**: Translate each sentence into Japanese. Now that you understand
   the structure and meaning, you can produce equivalent output in the target language
   (machine code, bytecode, JavaScript, etc.).

5. **Execution**: The reader (CPU, VM, interpreter) reads the translated text.

---

## Following `let x = 2 + 3;` Through the Pipeline

Let's trace a single line of code through every stage.

### Stage 1: Lexing (Source → Tokens)

The lexer reads characters one by one and groups them into tokens:

```
Source: let x = 2 + 3;

Tokens:
  [LET, "let"]
  [IDENT, "x"]
  [ASSIGN, "="]
  [INT, "2"]
  [PLUS, "+"]
  [INT, "3"]
  [SEMICOLON, ";"]
```

The lexer doesn't know what `let` means. It just knows it's a keyword token. It doesn't
know that `2 + 3` is addition — it just sees three separate tokens. Whitespace is
consumed and discarded (in most languages).

Analogy: the mail room sorting machine reads labels on packages and puts them in
categorized bins. It doesn't open the packages or know what's inside.

### Stage 2: Parsing (Tokens → AST)

The parser reads the token stream and builds a tree structure:

```
Program
  └── LetStatement
        ├── Name: Identifier("x")
        └── Value: InfixExpression
                     ├── Left: IntegerLiteral(2)
                     ├── Operator: "+"
                     └── Right: IntegerLiteral(3)
```

Now we have structure. The parser knows that `x` is being bound to the result of `2 + 3`.
It knows that `+` operates on `2` and `3`. The tree captures the relationships between
parts of the code.

Analogy: the parser is like diagramming a sentence in grammar class. "The big cat sat on
the mat" becomes a tree: sentence → subject ("the big cat") + predicate ("sat on the
mat") → and so on.

### Stage 3: Semantic Analysis (AST → Annotated AST)

The semantic analyzer walks the tree and checks things the parser can't:

- Does `x` already exist in this scope? (If so, is redeclaration allowed?)
- What type is `2 + 3`? (Integer + Integer = Integer, so `x` is an Integer.)
- Is `+` defined for these operand types?

```
Program
  └── LetStatement
        ├── Name: Identifier("x") [type: int]
        └── Value: InfixExpression [type: int]
                     ├── Left: IntegerLiteral(2) [type: int]
                     ├── Operator: "+" [int + int → int]
                     └── Right: IntegerLiteral(3) [type: int]
```

The tree is the same shape, but now nodes are annotated with type information.

Analogy: a copy editor who checks that the translated sentences make sense. "The cat
barked" is grammatically correct but semantically wrong — cats don't bark.

### Stage 4: Code Generation (Annotated AST → Target Code)

The code generator walks the annotated tree and emits target code. What that target is
depends on the language:

**If targeting machine code (like Go):**
```asm
MOV  R1, #2        ; load 2 into register 1
MOV  R2, #3        ; load 3 into register 2
ADD  R3, R1, R2    ; R3 = R1 + R2
STORE R3, [x]      ; store result in memory location for x
```

**If targeting bytecode (like Python or Java):**
```
LOAD_CONST 2
LOAD_CONST 3
BINARY_ADD
STORE_NAME x
```

**If targeting another language (like TypeScript → JavaScript):**
```js
var x = 2 + 3;
```

### Stage 5: Execution

The target code runs. For machine code, the CPU executes it directly. For bytecode, a
virtual machine interprets it. For JavaScript output, V8 takes over and does its own
compilation pipeline.

---

## Compiled vs Interpreted (The Line Is Blurry)

You were probably taught "compiled languages are fast, interpreted languages are slow."
That's an oversimplification. The real picture:

### Pure Compilation (Ahead-of-Time / AOT)

The entire source code is translated to machine code BEFORE the program runs.

**Go**: `go build main.go` → produces a native binary → CPU runs it directly.
**Rust**: `cargo build` → produces a native binary.
**C**: `gcc main.c` → produces a native binary.

The compilation happens once. The resulting binary runs without needing the compiler.

Analogy: translating an entire book before publishing it. Readers get the finished
Japanese version and never see the English original.

### Pure Interpretation

Source code is read and executed line by line, with no separate compilation step.

**Early JavaScript**: the browser read JS source and executed it directly.
**Shell scripts**: bash reads and executes each line.

Analogy: a live interpreter at a conference, translating each sentence as the speaker
says it.

### The Blurry Middle: Bytecode Compilation + VM

Most "interpreted" languages actually compile to an intermediate bytecode first:

**Python**: source → bytecode (`.pyc` files) → Python VM interprets the bytecode.
**Java**: source → bytecode (`.class` files) → JVM interprets/compiles the bytecode.
**Ruby**: source → bytecode → YARV (Yet Another Ruby VM).

The bytecode is not machine code — it's a simpler instruction set that a virtual machine
can execute. Think of it as translating English to Esperanto (a simpler language) and
then having an Esperanto-to-Japanese interpreter.

### JIT Compilation (Just-In-Time)

The most complex approach — and what makes modern JavaScript fast:

**V8 (Chrome/Node.js)**: JS source → bytecode → interpreter runs it → if a function is
called many times ("hot"), compile it to optimized machine code ON THE FLY.

**Java HotSpot**: bytecode → interpreter runs it → hot paths get JIT-compiled to native.

JIT is like an interpreter who, after translating the same sentence 100 times, memorizes
the translation so they can say it instantly next time.

### Where Your Tools Actually Fall

| Language    | Pipeline                                                    |
|-------------|-------------------------------------------------------------|
| **Go**      | Source → Lexer → Parser → Type Check → SSA → Machine Code  |
| **TypeScript** | Source → Lexer → Parser → Type Check → JavaScript (text)  |
| **JavaScript** | Source → Bytecode → Interpreter → JIT → Machine Code     |
| **Rust**    | Source → HIR → MIR → LLVM IR → Machine Code                |
| **Python**  | Source → Bytecode → Interpreter (CPython VM)                |
| **Java**    | Source → Bytecode → Interpreter + JIT (JVM)                 |

TypeScript is particularly interesting: it compiles to JavaScript (another high-level
language), and then JavaScript goes through V8's entire pipeline. So TypeScript code
goes through TWO compilation pipelines before it runs.

---

## AOT vs JIT — Tradeoffs

**Ahead-of-Time (AOT)**:
- Compilation happens before the program runs
- Slow build times, fast execution from the start
- Can optimize globally (the compiler sees all the code)
- The binary is self-contained — no runtime compiler needed
- Go, Rust, C, C++

**Just-in-Time (JIT)**:
- Compilation happens WHILE the program runs
- Fast startup, gets faster over time as hot paths are compiled
- Can optimize based on runtime behavior (actual data patterns, branch frequencies)
- Requires a runtime compiler (bigger memory footprint)
- JavaScript (V8), Java (HotSpot), C# (.NET)

Go chose AOT because it values fast, predictable performance and simple deployment (one
binary). JavaScript uses JIT because it needs fast startup (web pages) and handles
dynamic types that benefit from runtime optimization.

---

## The Pipeline in Tools You Already Use

This pipeline isn't just for language compilers. Every tool that reads code uses some
version of it:

### TypeScript Compiler (`tsc`)

Full pipeline: lex → parse → type-check → emit JavaScript. When you see a type error,
that's the semantic analysis stage catching a problem. The AST is exposed via the
TypeScript Compiler API — you can write custom tools that walk it.

### Go Compiler (`go build`)

Full pipeline: lex → parse → type-check → SSA (intermediate form) → machine code. Go
also exposes its pipeline: `go/scanner` (lexer), `go/parser` (parser), `go/ast` (AST
types), `go/types` (type checker). You can use these packages directly.

### ESLint

Partial pipeline: lex → parse → walk AST → report violations. ESLint doesn't generate
code. It uses a parser (Espree, or TypeScript's parser) to build an AST, then runs your
lint rules as visitors that walk the tree looking for patterns.

### Prettier

Partial pipeline: lex → parse → walk AST → emit formatted code. Same idea as ESLint but
instead of checking rules, it re-emits the code with consistent formatting. It doesn't
care about your original whitespace — it rebuilds it from the AST.

### Babel

Full pipeline: lex → parse → transform AST → emit JavaScript. Babel plugins are AST
transformations. JSX, for example, is transformed from `<Component />` AST nodes into
`React.createElement(Component)` AST nodes. The code generation stage turns the
transformed AST back into JavaScript text.

### `go vet`, `staticcheck`

Partial pipeline: use Go's built-in parser to get an AST, then analyze it for common
mistakes. When `go vet` warns about `fmt.Printf` format strings, it's walking the AST
and checking that the format specifiers match the argument types.

---

## Why This Matters For You

Understanding the pipeline gives you:

1. **Better error messages understanding**: "Unexpected token" = lexer/parser stage.
   "Type 'string' is not assignable to type 'number'" = semantic analysis stage.

2. **Tool-building ability**: need a code formatter? Parse to AST, walk it, emit
   formatted text. Need a linter rule? Walk the AST looking for a pattern. Need a
   codemod? Parse, transform the AST, re-emit.

3. **Language design intuition**: when you understand how the pipeline works, you
   understand WHY languages make certain design choices. Go's grammar is simple because
   it makes the parser fast. TypeScript's type system is complex because the semantic
   analysis stage has to model JavaScript's dynamic behavior.

4. **Performance intuition**: knowing that V8 JIT-compiles hot functions explains why
   JavaScript benchmarks improve over time. Knowing Go is AOT-compiled explains why Go
   programs have consistent, predictable performance.

---

## What We're Building

In this module, we'll implement the first three stages ourselves:

```
Source Code → [Lexer] → Tokens → [Parser] → AST → [Evaluator] → Result
              lesson 3           lesson 7           (future)
```

We won't build a full compiler — instead, we'll build an **interpreter** that walks the
AST and evaluates it directly (a tree-walking interpreter). This is the simplest approach
and the best way to understand the pipeline.

After building the interpreter, you'll understand enough to:
- Read and modify real compiler code (Go's compiler, TypeScript's compiler)
- Build developer tools (linters, formatters, codemods)
- Understand JIT compilation at a deeper level
- Move on to bytecode compilation and virtual machines

The language we'll implement is called **Monkey** (from Thorsten Ball's books). It has:
- Variables (`let x = 5;`)
- Functions as first-class values (`let add = fn(x, y) { x + y; };`)
- Integers, strings, booleans, arrays, hash maps
- If/else expressions
- Closures

It's small enough to build in a few lessons but rich enough to teach real concepts.

---

## Key Takeaways

- Every language goes through: source → tokens → AST → (analysis) → target code
- "Compiled" vs "interpreted" is a spectrum, not a binary
- TypeScript compiles to JS which is JIT-compiled — code goes through multiple pipelines
- Go compiles directly to machine code (AOT)
- Python compiles to bytecode interpreted by a VM
- Every dev tool you use (ESLint, Prettier, Babel, go vet) uses this pipeline
- We're building a lexer (lesson 3) and parser (lesson 7) from scratch
