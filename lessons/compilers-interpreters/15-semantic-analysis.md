# Lesson 15: Semantic Analysis — Resolving Names, Checking Validity

## What the Parser Cannot Catch

The parser verifies **syntax** — the code follows the grammar rules. But many errors are syntactically valid yet meaningless. The parser accepts all of these:

```
x + 1;              // What is x? Never declared.
let x = 5;
let x = 10;         // Declared twice in the same scope.
break;              // Not inside a loop.
return 5;           // Not inside a function.
let y = 10;         // y is never used.
if (true) {
    return 1;
    let z = 2;      // Unreachable code after return.
}
```

Each of these parses into a valid AST. The grammar has no opinion about whether `x` was declared, whether `break` is inside a loop, or whether code after `return` is reachable.

**Semantic analysis** catches these errors. It is the bridge between parsing (structure) and execution (behavior).

## The Building Inspector Analogy

The architect (parser) drew valid blueprints (AST). The blueprints follow all the drafting rules — dimensions are labeled, lines are straight, pages are numbered. But the building inspector checks deeper things:

- **The plumbing connects to real pipes** — every variable use refers to an actual declaration.
- **Doors lead somewhere** — every function call targets a function that exists.
- **The building code is met** — `break` only appears inside loops, `return` only inside functions.
- **No wasted materials** — unused variables and unreachable code are flagged.
- **Electrical circuits do not conflict** — no two declarations with the same name in the same scope.

The inspector does not execute the building. They verify it *could* work before construction begins.

## Name Resolution

The most fundamental semantic check: every identifier use must refer to a declaration. This is called **name resolution** or **binding**.

```
let x = 5;
let y = x + 10;    // "x" here must resolve to the declaration on line 1
let z = w + 1;     // ERROR: "w" is never declared
```

### How Name Resolution Works

For each identifier in the AST, we search outward through scopes to find a matching declaration:

```
┌─────────────────────────────────── Global Scope ───────────────────────────────────┐
│  let x = 5;                                                                        │
│  let add = fn(a, b) {  ┌────────── Function Scope ──────────────┐                 │
│                         │  let result = a + b;  ← a, b from      │                 │
│                         │                         params          │                 │
│                         │  return result;        ← result from    │                 │
│                         │                         this scope      │                 │
│                         └────────────────────────────────────────┘                 │
│  let y = add(x, 10);   ← add from global, x from global                           │
└────────────────────────────────────────────────────────────────────────────────────┘
```

When we encounter `a` inside the function, we search: function scope first (found — it is a parameter), then global scope if not found.

## Symbol Tables

A **symbol table** is the compile-time version of an environment. Instead of mapping names to values (runtime), it maps names to metadata about declarations.

```go
package semantic

type SymbolScope int

const (
    GlobalScope SymbolScope = iota
    LocalScope
    FunctionScope
    BuiltinScope
)

type Symbol struct {
    Name       string
    Scope      SymbolScope
    Index      int
    IsUsed     bool
    IsMutable  bool
    DefinedAt  Position
}

type Position struct {
    Line   int
    Column int
}

type SymbolTable struct {
    store     map[string]*Symbol
    numDefs   int
    outer     *SymbolTable
}

func NewSymbolTable() *SymbolTable {
    return &SymbolTable{
        store: make(map[string]*Symbol),
    }
}

func NewEnclosedSymbolTable(outer *SymbolTable) *SymbolTable {
    return &SymbolTable{
        store: make(map[string]*Symbol),
        outer: outer,
    }
}

func (s *SymbolTable) Define(name string) (*Symbol, error) {
    if _, exists := s.store[name]; exists {
        return nil, fmt.Errorf("variable %q already declared in this scope", name)
    }

    symbol := &Symbol{
        Name:  name,
        Index: s.numDefs,
    }

    if s.outer == nil {
        symbol.Scope = GlobalScope
    } else {
        symbol.Scope = LocalScope
    }

    s.store[name] = symbol
    s.numDefs++
    return symbol, nil
}

func (s *SymbolTable) Resolve(name string) (*Symbol, bool) {
    sym, ok := s.store[name]
    if !ok && s.outer != nil {
        sym, ok = s.outer.Resolve(name)
        return sym, ok
    }
    return sym, ok
}
```

The symbol table does double duty. During semantic analysis, it checks that names are valid. Later, during compilation (Lesson 17), it provides the information needed to emit correct bytecode — which scope a variable is in, what index it occupies.

## The Semantic Analyzer

```go
package semantic

import (
    "fmt"
    "monkey/ast"
)

type SemanticError struct {
    Message string
    Pos     Position
}

func (e *SemanticError) Error() string {
    return fmt.Sprintf("[%d:%d] %s", e.Pos.Line, e.Pos.Column, e.Message)
}

type Analyzer struct {
    symbols    *SymbolTable
    errors     []SemanticError
    inLoop     int
    inFunction int
}

func NewAnalyzer() *Analyzer {
    return &Analyzer{
        symbols: NewSymbolTable(),
    }
}

func (a *Analyzer) Errors() []SemanticError {
    return a.errors
}

func (a *Analyzer) addError(msg string) {
    a.errors = append(a.errors, SemanticError{Message: msg})
}

func (a *Analyzer) Analyze(node ast.Node) {
    switch node := node.(type) {
    case *ast.Program:
        a.analyzeProgram(node)
    case *ast.LetStatement:
        a.analyzeLet(node)
    case *ast.Identifier:
        a.analyzeIdentifier(node)
    case *ast.FunctionLiteral:
        a.analyzeFunction(node)
    case *ast.CallExpression:
        a.analyzeCall(node)
    case *ast.IfExpression:
        a.analyzeIf(node)
    case *ast.BlockStatement:
        a.analyzeBlock(node)
    case *ast.ReturnStatement:
        a.analyzeReturn(node)
    case *ast.InfixExpression:
        a.Analyze(node.Left)
        a.Analyze(node.Right)
    case *ast.PrefixExpression:
        a.Analyze(node.Right)
    case *ast.ExpressionStatement:
        a.Analyze(node.Expression)
    case *ast.IntegerLiteral, *ast.StringLiteral, *ast.Boolean:
        return
    }
}
```

## Checking: Undeclared Variables

```go
func (a *Analyzer) analyzeIdentifier(node *ast.Identifier) {
    sym, ok := a.symbols.Resolve(node.Value)
    if !ok {
        a.addError(fmt.Sprintf("undeclared variable: %s", node.Value))
        return
    }
    sym.IsUsed = true
}
```

Every time we see an identifier used as a value, we resolve it. If resolution fails, the variable was never declared.

## Checking: Duplicate Declarations

```go
func (a *Analyzer) analyzeLet(node *ast.LetStatement) {
    a.Analyze(node.Value)

    _, err := a.symbols.Define(node.Name.Value)
    if err != nil {
        a.addError(err.Error())
    }
}
```

We analyze the value *first* (so `let x = x + 1` correctly resolves the right-hand `x` from an outer scope), then define the new variable. If `Define` finds a duplicate name in the current scope, it returns an error.

## Checking: Break Outside a Loop

We track whether we are inside a loop with a counter (not a boolean — loops can be nested):

```go
func (a *Analyzer) analyzeWhile(node *ast.WhileExpression) {
    a.Analyze(node.Condition)

    a.inLoop++
    a.analyzeBlock(node.Body)
    a.inLoop--
}

func (a *Analyzer) analyzeBreak(node *ast.BreakStatement) {
    if a.inLoop == 0 {
        a.addError("break outside of loop")
    }
}

func (a *Analyzer) analyzeContinue(node *ast.ContinueStatement) {
    if a.inLoop == 0 {
        a.addError("continue outside of loop")
    }
}
```

## Checking: Return Outside a Function

Same pattern with a function depth counter:

```go
func (a *Analyzer) analyzeFunction(node *ast.FunctionLiteral) {
    innerSymbols := NewEnclosedSymbolTable(a.symbols)
    outerSymbols := a.symbols
    a.symbols = innerSymbols

    for _, param := range node.Parameters {
        _, err := a.symbols.Define(param.Name.Value)
        if err != nil {
            a.addError(err.Error())
        }
    }

    a.inFunction++
    a.analyzeBlock(node.Body)
    a.inFunction--

    a.checkUnusedVariables(innerSymbols)
    a.symbols = outerSymbols
}

func (a *Analyzer) analyzeReturn(node *ast.ReturnStatement) {
    if a.inFunction == 0 {
        a.addError("return outside of function")
    }
    if node.ReturnValue != nil {
        a.Analyze(node.ReturnValue)
    }
}
```

## Checking: Unused Variables

After analyzing a scope, we check for variables that were defined but never used:

```go
func (a *Analyzer) checkUnusedVariables(table *SymbolTable) {
    for name, sym := range table.store {
        if !sym.IsUsed && sym.Scope != BuiltinScope {
            a.addError(fmt.Sprintf("unused variable: %s", name))
        }
    }
}
```

Go enforces this rule — unused local variables are compile errors. Most other languages just warn.

## Checking: Unreachable Code

After a `return` statement in a block, any subsequent statements are unreachable:

```go
func (a *Analyzer) analyzeBlock(node *ast.BlockStatement) {
    returnSeen := false

    for _, stmt := range node.Statements {
        if returnSeen {
            a.addError("unreachable code after return")
            break
        }

        a.Analyze(stmt)

        if _, ok := stmt.(*ast.ReturnStatement); ok {
            returnSeen = true
        }
    }
}
```

A full implementation would also check after `break` and `continue`, and handle all code paths through `if/else`.

## Scope Analysis: Nested Scopes

Scopes nest. A block inside a function creates a new scope. Variables in the inner scope can shadow those in the outer scope:

```go
func (a *Analyzer) analyzeBlockWithScope(node *ast.BlockStatement) {
    innerSymbols := NewEnclosedSymbolTable(a.symbols)
    outerSymbols := a.symbols
    a.symbols = innerSymbols

    for _, stmt := range node.Statements {
        a.Analyze(stmt)
    }

    a.checkUnusedVariables(innerSymbols)
    a.symbols = outerSymbols
}
```

This handles code like:

```
let x = 5;
{
    let x = 10;    // shadows outer x, no error
    let y = x + 1; // uses inner x (10)
}
let z = x + 1;     // uses outer x (5)
```

### Shadowing vs Redeclaration

Shadowing (in a nested scope) is typically allowed. Redeclaration (in the same scope) is an error.

```
let x = 5;
let x = 10;     // ERROR: redeclaration in same scope

let x = 5;
{
    let x = 10;  // OK: shadowing in inner scope
}
```

Our `Define` method on `SymbolTable` only checks the *current* scope, not outer scopes, so shadowing works naturally.

## Constant Folding

Constant folding is an optimization that happens during semantic analysis. If an expression involves only constants, we can evaluate it at compile time:

```
let x = 2 + 3;       →  let x = 5;
let y = 10 * 2 + 1;  →  let y = 21;
let z = true && false; → let z = false;
```

This is both an optimization (less work at runtime) and a simplification (the compiler or VM sees simpler code).

```go
package semantic

import "monkey/ast"

func FoldConstants(node ast.Node) ast.Node {
    switch node := node.(type) {
    case *ast.InfixExpression:
        left := FoldConstants(node.Left)
        right := FoldConstants(node.Right)

        leftInt, leftOk := left.(*ast.IntegerLiteral)
        rightInt, rightOk := right.(*ast.IntegerLiteral)

        if leftOk && rightOk {
            return foldIntegerInfix(node.Operator, leftInt, rightInt)
        }

        node.Left = left.(ast.Expression)
        node.Right = right.(ast.Expression)
        return node

    case *ast.PrefixExpression:
        right := FoldConstants(node.Right)

        if rightInt, ok := right.(*ast.IntegerLiteral); ok && node.Operator == "-" {
            return &ast.IntegerLiteral{
                Token: node.Token,
                Value: -rightInt.Value,
            }
        }

        if rightBool, ok := right.(*ast.Boolean); ok && node.Operator == "!" {
            return &ast.Boolean{
                Token: node.Token,
                Value: !rightBool.Value,
            }
        }

        node.Right = right.(ast.Expression)
        return node

    default:
        return node
    }
}

func foldIntegerInfix(op string, left, right *ast.IntegerLiteral) ast.Node {
    var result int64
    switch op {
    case "+":
        result = left.Value + right.Value
    case "-":
        result = left.Value - right.Value
    case "*":
        result = left.Value * right.Value
    case "/":
        if right.Value == 0 {
            return &ast.InfixExpression{
                Left:     left,
                Operator: op,
                Right:    right,
            }
        }
        result = left.Value / right.Value
    default:
        return &ast.InfixExpression{
            Left:     left,
            Operator: op,
            Right:    right,
        }
    }

    return &ast.IntegerLiteral{
        Token: left.Token,
        Value: result,
    }
}
```

Notice the division-by-zero check — we do not fold `x / 0` because that is a runtime error, not a compile-time constant.

### How Far Can Folding Go?

Simple constant folding handles literal expressions. More advanced forms include:

**Constant propagation**: if a variable is assigned a constant and never reassigned, replace all uses with the constant:

```
let x = 5;
let y = x + 3;   →   let y = 8;
```

**Dead code elimination**: if a branch is known at compile time, remove the dead branch:

```
if (true) {
    doSomething();
} else {
    neverReached();  →  removed entirely
}
```

These optimizations are covered more in Lesson 19.

## Putting It All Together

Here is the complete analysis pipeline:

```go
func AnalyzeProgram(program *ast.Program) []SemanticError {
    analyzer := NewAnalyzer()

    defineBuiltins(analyzer.symbols)

    analyzer.analyzeProgram(program)

    analyzer.checkUnusedVariables(analyzer.symbols)

    return analyzer.Errors()
}

func defineBuiltins(symbols *SymbolTable) {
    builtins := []string{"len", "print", "first", "last", "rest", "push"}
    for _, name := range builtins {
        sym, _ := symbols.Define(name)
        if sym != nil {
            sym.Scope = BuiltinScope
            sym.IsUsed = true
        }
    }
}

func (a *Analyzer) analyzeProgram(node *ast.Program) {
    for _, stmt := range node.Statements {
        a.Analyze(stmt)
    }
}
```

## Testing the Semantic Analyzer

```go
package semantic

import (
    "monkey/lexer"
    "monkey/parser"
    "testing"
)

func TestUndeclaredVariable(t *testing.T) {
    input := `x + 1;`
    errors := analyzeInput(t, input)
    expectSemanticError(t, errors, "undeclared variable: x")
}

func TestDuplicateDeclaration(t *testing.T) {
    input := `
    let x = 5;
    let x = 10;
    `
    errors := analyzeInput(t, input)
    expectSemanticError(t, errors, `variable "x" already declared in this scope`)
}

func TestBreakOutsideLoop(t *testing.T) {
    input := `break;`
    errors := analyzeInput(t, input)
    expectSemanticError(t, errors, "break outside of loop")
}

func TestReturnOutsideFunction(t *testing.T) {
    input := `return 5;`
    errors := analyzeInput(t, input)
    expectSemanticError(t, errors, "return outside of function")
}

func TestUnusedVariable(t *testing.T) {
    input := `let x = 5;`
    errors := analyzeInput(t, input)
    expectSemanticError(t, errors, "unused variable: x")
}

func TestUnreachableCode(t *testing.T) {
    input := `
    let f = fn() {
        return 1;
        let x = 2;
    };
    `
    errors := analyzeInput(t, input)
    expectSemanticError(t, errors, "unreachable code after return")
}

func TestValidProgram(t *testing.T) {
    input := `
    let x = 5;
    let y = x + 10;
    let add = fn(a, b) { return a + b; };
    let result = add(x, y);
    `
    errors := analyzeInput(t, input)
    if len(errors) > 0 {
        t.Errorf("expected no errors, got: %v", errors)
    }
}

func TestShadowingAllowed(t *testing.T) {
    input := `
    let x = 5;
    let f = fn() {
        let x = 10;
        return x;
    };
    let y = f() + x;
    `
    errors := analyzeInput(t, input)
    if len(errors) > 0 {
        t.Errorf("expected no errors for shadowing, got: %v", errors)
    }
}

func TestConstantFolding(t *testing.T) {
    input := `2 + 3 * 4`
    l := lexer.New(input)
    p := parser.New(l)
    program := p.ParseProgram()

    stmt := program.Statements[0].(*ast.ExpressionStatement)
    folded := FoldConstants(stmt.Expression)

    intLit, ok := folded.(*ast.IntegerLiteral)
    if !ok {
        t.Fatalf("expected IntegerLiteral, got %T", folded)
    }
    if intLit.Value != 14 {
        t.Errorf("expected 14, got %d", intLit.Value)
    }
}

func analyzeInput(t *testing.T, input string) []SemanticError {
    t.Helper()
    l := lexer.New(input)
    p := parser.New(l)
    program := p.ParseProgram()

    if len(p.Errors()) > 0 {
        t.Fatalf("parser errors: %v", p.Errors())
    }

    return AnalyzeProgram(program)
}

func expectSemanticError(t *testing.T, errors []SemanticError, expected string) {
    t.Helper()
    for _, err := range errors {
        if err.Message == expected {
            return
        }
    }
    t.Errorf("expected error %q, got %v", expected, errors)
}
```

## How Real Languages Do Semantic Analysis

### Go

The `go/types` package performs semantic analysis along with type checking. Go catches:
- Undeclared variables
- Unused imports (unique to Go — most languages just warn)
- Unused variables in function scope
- `break`/`continue` outside loops
- `fallthrough` in wrong position
- Dead code after `return`

Go's semantic analysis is fast because the language was designed for it — no circular imports, explicit types, simple scoping rules.

### TypeScript

TypeScript's semantic analysis is more complex because it handles:
- Control flow analysis for type narrowing
- Exhaustiveness checking in switch statements
- Definite assignment analysis (variable used before assigned)
- Reachability analysis

### Rust

Rust's semantic analysis is the most thorough of the three:
- Ownership and borrowing rules
- Lifetime analysis
- Exhaustive pattern matching
- Move semantics
- Unused variable/import warnings
- Dead code detection

Rust's borrow checker is essentially a semantic analysis pass that checks something no other mainstream language checks: memory safety without a garbage collector.

## The Full Compilation Pipeline So Far

```
Source Code
    │
    ▼
┌──────────┐
│  Lexer   │  "let x = 5 + 3;" → [LET, IDENT("x"), ASSIGN, INT(5), PLUS, INT(3), SEMICOLON]
└──────────┘
    │
    ▼
┌──────────┐
│  Parser  │  tokens → LetStatement { name: "x", value: InfixExpr(5, +, 3) }
└──────────┘
    │
    ▼
┌──────────────────┐
│ Semantic Analysis │  Check: x not already declared, 5+3 is valid, etc.
└──────────────────┘
    │
    ▼
┌──────────────────┐
│  Type Checking   │  Check: 5 is int, 3 is int, int+int=int, x declared as int
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Constant Folding │  5 + 3 → 8
└──────────────────┘
    │
    ▼
  Validated, optimized AST ready for interpretation or compilation
```

In Lessons 16-18, we will take this validated AST and compile it to bytecode, then execute it on a virtual machine.

---

## Exercises

### Exercise 1: Full Analyzer Integration

Wire the semantic analyzer into the language pipeline. After parsing, run the analyzer. If there are errors, print them and stop (do not run the interpreter). Test with programs that have semantic errors.

### Exercise 2: Definite Assignment

Implement a check that variables are assigned before use:

```
let x: int;
let y = x + 1;  // ERROR: x used before assignment
```

This requires distinguishing between "declared" and "assigned" in the symbol table.

### Exercise 3: Exhaustive Return Checking

A function that declares a return type must return on all code paths:

```
let f = fn(x: int) -> int {
    if (x > 0) {
        return x;
    }
    // ERROR: not all code paths return a value
};
```

Implement a pass that walks the control flow and verifies all paths end with a return.

### Exercise 4: Constant Folding with Strings

Extend the constant folder to handle string concatenation:

```
let greeting = "hello" + " " + "world";  →  let greeting = "helloworld";
```

And boolean operations:

```
let x = true && false;  →  let x = false;
let y = !true;          →  let y = false;
```

### Exercise 5: Scope Visualization

Write a function that takes a program and prints its scope tree:

```
Global Scope
├── x: int
├── add: fn(int, int) -> int
│   └── Function Scope
│       ├── a: int (param)
│       └── b: int (param)
└── result: int
```

This is useful for debugging scope resolution issues.

### Exercise 6: Cyclic Dependency Detection

If your language supports modules or mutual recursion, detect cycles:

```
let a = fn() { return b(); };
let b = fn() { return a(); };
```

This is valid at runtime (mutual recursion works) but:

```
let x = y + 1;
let y = x + 1;  // ERROR: cyclic dependency in initialization
```

This is invalid — `x` depends on `y` which depends on `x`. Implement detection for initialization cycles.
