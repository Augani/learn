# Lesson 12: Error Handling and Reporting

You've cursed at bad error messages. "Unexpected token" with no line number. "Cannot
read property of undefined" with a stack trace pointing to minified code. A good
error message is the difference between fixing a bug in 10 seconds and wasting an
hour.

## The GPS Analogy

Error handling is like a GPS recalculating. When you take a wrong turn (error),
a good GPS tells you exactly where you went wrong, what you should have done, and
reroutes you. A bad GPS just says "error" and shuts down. Our interpreter has been
the bad GPS — it produces errors, but they're vague. This lesson fixes that.

We'll add:
- Source location tracking (line and column numbers)
- Error recovery in the parser (don't die at the first mistake)
- Runtime error propagation with context
- Error messages that actually help

---

## The Three Types of Errors

### 1. Syntax Errors (Parser)

The code isn't valid. The structure is wrong.

```
let x = ;
```

The parser expected an expression after `=` but got `;`. This is caught during
parsing, before any code runs.

### 2. Runtime Errors (Evaluator)

The code is structurally valid but does something illegal at runtime.

```
let x = 5 / 0;
let y = true + 1;
```

The parser is fine with these. The evaluator catches them when it tries to execute.

### 3. Type Errors (A Subset of Runtime Errors)

Operations on incompatible types.

```
let x = "hello" - 5;
```

Subtracting an integer from a string makes no sense. In a statically typed language,
the compiler catches this. In our dynamically typed language, the evaluator catches it.

---

## Step 1: Position Tracking in the Lexer

Every token needs to know where it came from. We add line and column information:

```go
package token

type Position struct {
    Line   int
    Column int
}

type Token struct {
    Type    TokenType
    Literal string
    Pos     Position
}
```

Update the lexer to track position. The lexer already reads character by character.
We just need a counter:

```go
package lexer

import "monkey/token"

type Lexer struct {
    input        string
    position     int
    readPosition int
    ch           byte
    line         int
    column       int
}

func New(input string) *Lexer {
    l := &Lexer{
        input:  input,
        line:   1,
        column: 0,
    }
    l.readChar()
    return l
}

func (l *Lexer) readChar() {
    if l.readPosition >= len(l.input) {
        l.ch = 0
    } else {
        l.ch = l.input[l.readPosition]
    }
    l.position = l.readPosition
    l.readPosition++

    if l.ch == '\n' {
        l.line++
        l.column = 0
    } else {
        l.column++
    }
}

func (l *Lexer) currentPosition() token.Position {
    return token.Position{Line: l.line, Column: l.column}
}
```

Now every token carries its birth certificate — where in the source code it was born.

When producing tokens, capture the position before building the token:

```go
func (l *Lexer) NextToken() token.Token {
    l.skipWhitespace()
    pos := l.currentPosition()

    switch l.ch {
    case '+':
        tok := token.Token{Type: token.PLUS, Literal: "+", Pos: pos}
        l.readChar()
        return tok
    ...
    }
}
```

Every case in the switch now includes `Pos: pos`. The only change to `NextToken`
is capturing `pos` at the top and threading it into every token constructor.

---

## Step 2: Positions in AST Nodes

AST nodes should carry position information too. The simplest approach: every node
already has a `Token` field. Since tokens now have positions, nodes automatically
have positions:

Add `Pos() token.Position` to the `Node` interface. Every node implements it by
returning `n.Token.Pos`. Now every AST node knows exactly where in the source
code it came from.

---

## Step 3: Better Parser Errors

Our parser currently collects errors as strings. Let's make them structured:

```go
package parser

import (
    "fmt"
    "monkey/token"
)

type ParseError struct {
    Position token.Position
    Message  string
    Token    token.Token
}

func (pe *ParseError) Error() string {
    return fmt.Sprintf("line %d, column %d: %s", pe.Position.Line, pe.Position.Column, pe.Message)
}

type Parser struct {
    l         *lexer.Lexer
    errors    []*ParseError
    curToken  token.Token
    peekToken token.Token
    source    string

    prefixParseFns map[token.TokenType]prefixParseFn
    infixParseFns  map[token.TokenType]infixParseFn
}

func New(l *lexer.Lexer, source string) *Parser {
    p := &Parser{
        l:      l,
        errors: []*ParseError{},
        source: source,
    }

    p.nextToken()
    p.nextToken()

    return p
}

func (p *Parser) Errors() []*ParseError {
    return p.errors
}
```

We pass the source code to the parser so we can show the offending line in errors.

### Better Error Messages

Instead of "expected next token to be INT, got SEMICOLON", say something useful:

```go
func (p *Parser) peekError(expected token.TokenType) {
    msg := fmt.Sprintf("expected %s, got %s instead", expected, p.peekToken.Type)

    switch {
    case expected == token.RPAREN && p.peekToken.Type == token.LBRACE:
        msg = "missing closing parenthesis ')' before '{'"
    case expected == token.SEMICOLON && p.peekToken.Type == token.RBRACE:
        msg = "missing semicolon at end of statement"
    case expected == token.ASSIGN && p.peekToken.Type == token.SEMICOLON:
        msg = "incomplete let statement — missing '=' and value"
    }

    p.errors = append(p.errors, &ParseError{
        Position: p.peekToken.Pos,
        Message:  msg,
        Token:    p.peekToken,
    })
}

func (p *Parser) noPrefixParseFnError(t token.Token) {
    var msg string

    switch t.Type {
    case token.EOF:
        msg = "unexpected end of input"
    case token.RBRACE:
        msg = "unexpected '}' — possibly an extra closing brace"
    case token.RPAREN:
        msg = "unexpected ')' — possibly an extra closing parenthesis"
    default:
        msg = fmt.Sprintf("unexpected token '%s'", t.Literal)
    }

    p.errors = append(p.errors, &ParseError{
        Position: t.Pos,
        Message:  msg,
        Token:    t,
    })
}
```

---

## Step 4: Error Recovery (Synchronization)

When the parser hits an error, it shouldn't die. It should recover and keep parsing
to find more errors. This is called **synchronization** — the parser skips tokens
until it finds a safe place to resume.

Think of it like a reader encountering a garbled paragraph in a book. Instead of
throwing the book away, they skip to the next paragraph and keep reading. They might
miss some plot points from the garbled section, but they can still report problems
in later sections.

```go
func (p *Parser) synchronize() {
    for p.curToken.Type != token.EOF {
        if p.curToken.Type == token.SEMICOLON {
            p.nextToken()
            return
        }

        switch p.peekToken.Type {
        case token.LET, token.RETURN, token.IF, token.WHILE, token.FOR:
            p.nextToken()
            return
        }

        p.nextToken()
    }
}
```

The strategy: skip forward until we hit a semicolon (end of statement) or a keyword
that starts a new statement (`let`, `return`, `if`, etc.). At that point, we're
probably at the start of a valid statement and can resume parsing.

Use it in `parseProgram`:

```go
func (p *Parser) ParseProgram() *ast.Program {
    program := &ast.Program{}
    program.Statements = []ast.Statement{}

    for !p.curTokenIs(token.EOF) {
        stmt := p.parseStatement()
        if stmt != nil {
            program.Statements = append(program.Statements, stmt)
        } else {
            p.synchronize()
        }
    }

    return program
}
```

If `parseStatement` returns nil (it encountered an error), we synchronize and try
the next statement. This means one syntax error doesn't prevent us from finding
the next three. Users get all their errors at once instead of fixing them one by one.

Compare: Go's compiler reports multiple errors. TypeScript's compiler reports multiple
errors. Rust's compiler reports multiple errors with suggestions. A compiler that
reports one error and quits is hostile.

---

## Step 5: Formatting Error Messages with Source Context

The best error messages show the code, point to the problem, and suggest a fix.
Let's build a formatter:

```go
package errors

import (
    "fmt"
    "strings"
    "monkey/token"
)

func FormatError(source string, pos token.Position, message string) string {
    lines := strings.Split(source, "\n")

    if pos.Line < 1 || pos.Line > len(lines) {
        return fmt.Sprintf("error: %s", message)
    }

    line := lines[pos.Line-1]
    lineNum := fmt.Sprintf("%d", pos.Line)
    padding := strings.Repeat(" ", len(lineNum))

    var b strings.Builder

    fmt.Fprintf(&b, "error: %s\n", message)
    fmt.Fprintf(&b, " %s |\n", padding)
    fmt.Fprintf(&b, " %s | %s\n", lineNum, line)
    fmt.Fprintf(&b, " %s | %s^\n", padding, strings.Repeat(" ", maxInt(0, pos.Column-1)))

    return b.String()
}

func FormatErrorWithHint(source string, pos token.Position, message string, hint string) string {
    base := FormatError(source, pos, message)
    return base + fmt.Sprintf(" = hint: %s\n", hint)
}

func FormatMultipleErrors(source string, errs []*ParseError) string {
    var b strings.Builder

    for i, err := range errs {
        if i > 0 {
            b.WriteString("\n")
        }
        b.WriteString(FormatError(source, err.Position, err.Message))
    }

    if len(errs) > 1 {
        fmt.Fprintf(&b, "\nfound %d errors\n", len(errs))
    }

    return b.String()
}

func maxInt(a, b int) int {
    if a > b {
        return a
    }
    return b
}
```

Here's what the output looks like:

```
error: expected ), got { instead
  |
3 | if (x > 5 {
  |            ^

error: identifier not found: y
  |
7 | let result = x + y;
  |                   ^
```

Suddenly your interpreter is helpful. The user sees exactly where the problem is.

---

## Step 6: Runtime Errors with Position

The evaluator's errors also benefit from position information. Update the Error
object to carry a position:

```go
package object

import (
    "fmt"
    "monkey/token"
)

type Error struct {
    Message  string
    Position token.Position
}

func (e *Error) Type() ObjectType { return ERROR_OBJ }
func (e *Error) Inspect() string {
    if e.Position.Line > 0 {
        return fmt.Sprintf("ERROR at line %d, column %d: %s",
            e.Position.Line, e.Position.Column, e.Message)
    }
    return "ERROR: " + e.Message
}
```

Update error creation in the evaluator to include position from the AST node:

```go
func newErrorAtNode(node ast.Node, format string, a ...interface{}) *object.Error {
    return &object.Error{
        Message:  fmt.Sprintf(format, a...),
        Position: node.Pos(),
    }
}
```

Use it:

```go
case *ast.InfixExpression:
    left := Eval(node.Left, env)
    if isError(left) {
        return left
    }
    right := Eval(node.Right, env)
    if isError(right) {
        return right
    }
    result := evalInfixExpression(node.Operator, left, right)
    if errObj, ok := result.(*object.Error); ok {
        errObj.Position = node.Pos()
    }
    return result
```

Now runtime errors tell you exactly which line of source code caused them.

---

## Step 7: Stack Traces

When an error occurs inside a function, you want to know the call chain. Add a
simple stack trace by tracking function calls:

```go
type CallFrame struct {
    FunctionName string
    Position     token.Position
}

type Error struct {
    Message    string
    Position   token.Position
    StackTrace []CallFrame
}

func (e *Error) Inspect() string {
    var b strings.Builder

    fmt.Fprintf(&b, "ERROR at line %d, column %d: %s\n",
        e.Position.Line, e.Position.Column, e.Message)

    if len(e.StackTrace) > 0 {
        b.WriteString("\nstack trace:\n")
        for i := len(e.StackTrace) - 1; i >= 0; i-- {
            frame := e.StackTrace[i]
            fmt.Fprintf(&b, "  at %s (line %d, column %d)\n",
                frame.FunctionName, frame.Position.Line, frame.Position.Column)
        }
    }

    return b.String()
}
```

In `applyFunction`, when an error bubbles up from a function call, append a
`CallFrame` to the error's stack trace with the function name and the call site
position. Each level of function calls adds a frame. The result:

```
ERROR at line 8, column 5: division by zero

stack trace:
  at anonymous (line 12, column 1)
  at anonymous (line 15, column 1)
```

---

## Comparing Error Messages

The same error (undefined variable) across languages:

- **Go**: `./main.go:5:14: undefined: x` — position only, no source context
- **TypeScript**: shows the source line and a `^` pointer, plus an error code (TS2304)
- **Rust** (the gold standard): shows source, points to the error, AND suggests a fix with a "help:" hint
- **Our language** (after this lesson): source line, pointer, and "did you mean?" suggestions

Rust's error messages are famously good because the compiler team spent years
polishing them. Study them. The `rustc --explain E0425` pattern is worth emulating.

---

## Implementing "Did You Mean?"

One of the most helpful error features: suggesting similar variable names when
a lookup fails.

```go
func findSimilar(name string, env *object.Environment) string {
    bestMatch := ""
    bestDistance := 3

    for _, candidate := range env.AllNames() {
        dist := levenshteinDistance(name, candidate)
        if dist < bestDistance {
            bestDistance = dist
            bestMatch = candidate
        }
    }
    return bestMatch
}
```

The `levenshteinDistance` function computes the edit distance between two strings
using the classic dynamic programming approach (a 2D matrix where each cell is the
minimum of insert, delete, or substitute). If the distance is under 3 edits, we
suggest it. Add an `AllNames()` method to Environment that collects all keys from
the current scope and all outer scopes.

Use it in `evalIdentifier`:

```go
func evalIdentifier(node *ast.Identifier, env *object.Environment) object.Object {
    if val, ok := env.Get(node.Value); ok {
        return val
    }

    if builtin, ok := builtins[node.Value]; ok {
        return builtin
    }

    errMsg := "identifier not found: " + node.Value

    if similar := findSimilar(node.Value, env); similar != "" {
        errMsg += fmt.Sprintf(" (did you mean '%s'?)", similar)
    }

    return &object.Error{
        Message:  errMsg,
        Position: node.Pos(),
    }
}
```

Now: `let count = 5; cont;` produces "identifier not found: cont (did you mean 'count'?)".

---

## Testing Error Handling

```go
func TestPositionTracking(t *testing.T) {
    input := "let x = 5;\nlet y = true + 1;"
    l := lexer.New(input)
    p := parser.New(l, input)
    program := p.ParseProgram()

    result := Eval(program, object.NewEnvironment())
    errObj := result.(*object.Error)

    if errObj.Position.Line != 2 {
        t.Errorf("expected error on line 2, got line %d", errObj.Position.Line)
    }
}

func TestParserErrorRecovery(t *testing.T) {
    input := "let x = ;\nlet y = 10;\nlet z = ;"
    l := lexer.New(input)
    p := parser.New(l, input)
    p.ParseProgram()

    if len(p.Errors()) < 2 {
        t.Fatalf("expected at least 2 parse errors, got %d", len(p.Errors()))
    }
}

func TestSimilarNameSuggestion(t *testing.T) {
    input := "let counter = 0; let result = conter + 1;"
    errObj := testEval(input).(*object.Error)

    if !strings.Contains(errObj.Message, "did you mean") ||
        !strings.Contains(errObj.Message, "counter") {
        t.Errorf("expected 'did you mean counter', got=%q", errObj.Message)
    }
}

func TestErrorFormatting(t *testing.T) {
    source := "let x = 5;\nlet y = x + z;\nlet w = 10;"
    formatted := errors.FormatError(source, token.Position{Line: 2, Column: 13}, "identifier not found: z")

    if !strings.Contains(formatted, "let y = x + z;") || !strings.Contains(formatted, "^") {
        t.Error("formatted error should contain source line and position marker")
    }
}
```

---

## Exercises

1. **Warning system**: Add warnings for non-fatal issues. Unused variables:
   `let x = 5;` where `x` is never read should produce "warning: unused variable 'x'."
   Track which variables are read in the environment.

2. **Multi-line error context**: Show 1-2 lines before and after the error line
   for better context:
   ```
   error: identifier not found: z
     |
   1 | let x = 5;
   2 | let y = x + z;
     |              ^
   3 | let w = 10;
   ```

3. **Error codes**: Assign numeric codes to errors (like TypeScript's TS2304 or
   Rust's E0425). Create a lookup table where users can get detailed explanations
   for each code.

4. **Source maps**: When your interpreter reads from a file, track the filename
   in positions. Update `Position` to include a `Filename string` field. Errors
   should show `main.monkey:5:13` instead of just `line 5, column 13`.

5. **Panic recovery**: Add a `try/catch` mechanism:
   ```
   let result = try {
       riskyOperation();
   } catch (err) {
       "fallback value";
   };
   ```
   Design the AST nodes, parser rules, and evaluator logic.

---

## Key Takeaways

- Three error types: syntax (parser), runtime (evaluator), type (subset of runtime)
- Position tracking starts in the lexer and flows through tokens to AST nodes to errors
- Error recovery (synchronization) lets the parser report multiple errors at once
- Good error messages show source code, point to the exact character, and suggest fixes
- Levenshtein distance enables "did you mean?" suggestions
- Stack traces show the call chain that led to an error
- Rust's error messages are the gold standard — study them

This completes Phase 2: Interpretation. You now have a working interpreter that can:
- Evaluate expressions (arithmetic, boolean, comparison)
- Store and look up variables with lexical scoping
- Execute control flow (if/else, while, for, break, continue)
- Define and call functions with closures
- Report errors with source context and suggestions

Next phase: type systems and semantic analysis — catching errors before they happen.
