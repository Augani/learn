# Compilers & Interpreters — How Programming Languages Work

Every language you've used — TypeScript, Go, Rust, Python — goes through
the same fundamental pipeline: source code → tokens → tree → execution.
This track builds that pipeline from scratch so you understand what
happens between typing code and seeing results.

Think of it as: you've been driving cars (using languages) your whole career.
Now you're going to build an engine from pistons and crankshafts.

Prerequisites: Track 5 (Data Structures). Helpful: Track 1 (Rust)

---

## Reference Files

- [Grammar Notation Cheat Sheet](./reference-grammar.md) — BNF, EBNF, and how to read grammars
- [AST Node Reference](./reference-ast.md) — Common AST node types and patterns

---

## The Roadmap

### Phase 1: Scanning and Parsing (Hours 1–14)
- [ ] [Lesson 01: How languages work — the compilation pipeline](./01-compilation-pipeline.md)
- [ ] [Lesson 02: Lexical analysis — turning text into tokens](./02-lexer.md)
- [ ] [Lesson 03: Building a lexer from scratch](./03-build-lexer.md)
- [ ] [Lesson 04: Grammars — defining the rules of a language](./04-grammars.md)
- [ ] [Lesson 05: Recursive descent parsing — tokens to trees](./05-recursive-descent.md)
- [ ] [Lesson 06: Abstract Syntax Trees — the heart of every language](./06-ast.md)
- [ ] [Lesson 07: Building a parser from scratch](./07-build-parser.md)

### Phase 2: Interpretation (Hours 15–24)
- [ ] [Lesson 08: Tree-walk interpreters — executing the AST directly](./08-tree-walk-interpreter.md)
- [ ] [Lesson 09: Variables, environments, and scope](./09-variables-scope.md)
- [ ] [Lesson 10: Control flow — if, while, for](./10-control-flow.md)
- [ ] [Lesson 11: Functions and closures](./11-functions-closures.md)
- [ ] [Lesson 12: Error handling and reporting](./12-error-handling.md)

### Phase 3: Types and Semantics (Hours 25–34)
- [ ] [Lesson 13: Type systems — static vs dynamic, strong vs weak](./13-type-systems.md)
- [ ] [Lesson 14: Type checking — catching errors before runtime](./14-type-checking.md)
- [ ] [Lesson 15: Semantic analysis — resolving names, checking validity](./15-semantic-analysis.md)

### Phase 4: Compilation and Optimization (Hours 35–46)
- [ ] [Lesson 16: Bytecode and virtual machines — a faster path](./16-bytecode-vm.md)
- [ ] [Lesson 17: Building a bytecode compiler](./17-build-compiler.md)
- [ ] [Lesson 18: Building a stack-based VM](./18-build-vm.md)
- [ ] [Lesson 19: Optimization — constant folding, dead code, inlining](./19-optimization.md)
- [ ] [Lesson 20: Garbage collection — how memory gets reclaimed](./20-garbage-collection.md)

### Phase 5: Real-World Language Implementation (Hours 47–54)
- [ ] [Lesson 21: How real languages work — V8, Go compiler, rustc, CPython](./21-real-languages.md)
- [ ] [Lesson 22: LLVM — the backend behind Rust, Swift, and Clang](./22-llvm.md)

---

## How to use these lessons

Every lesson has:
1. Concept explained with everyday analogies
2. How TypeScript, Go, and Rust implement this concept (you already use these)
3. Code you build incrementally — by lesson 12 you'll have a working interpreter
4. By lesson 18 you'll have a bytecode compiler and VM
5. Exercises that extend what you built
