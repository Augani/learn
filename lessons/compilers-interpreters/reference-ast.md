# AST Node Reference

This is your lookup table for every AST node type we'll implement. Each node is shown as
a Go struct with its fields. Use this as a reference while building the parser.

---

## The Node Interfaces

Every AST node implements one of these interfaces. The marker methods (`statementNode()`
and `expressionNode()`) exist only to enforce type safety at compile time — they prevent
you from accidentally using a statement where an expression is expected.

```go
type Node interface {
    TokenLiteral() string
    String() string
}

type Statement interface {
    Node
    statementNode()
}

type Expression interface {
    Node
    expressionNode()
}
```

Think of `Node` as the base "shape" — everything in the tree is a node. `Statement` and
`Expression` are the two flavors: statements DO things, expressions PRODUCE values.

---

## Program (Root Node)

The top-level node. Every AST has exactly one Program node, and it contains all the
statements in the source file. This is where the tree starts.

```go
type Program struct {
    Statements []Statement
}
```

Analogy: if the AST is a family tree, Program is the oldest ancestor at the very top.

---

## Statements

### LetStatement

`let x = 5;` — binds a value to a name.

```go
type LetStatement struct {
    Token token.Token
    Name  *Identifier
    Value Expression
}
```

- `Token`: the `let` token (for error reporting)
- `Name`: the identifier being bound (`x`)
- `Value`: the expression producing the value (`5`, or `2 + 3`, or `fn(x) { x }`)

### ReturnStatement

`return x + 1;` — exits a function with a value.

```go
type ReturnStatement struct {
    Token       token.Token
    ReturnValue Expression
}
```

### ExpressionStatement

`add(1, 2);` — a bare expression used as a statement. Most lines in a REPL are these.

```go
type ExpressionStatement struct {
    Token      token.Token
    Expression Expression
}
```

Why does this exist? Because `5 + 3;` is valid code — it's an expression used as a
statement. The expression is evaluated, the result is discarded (or in a REPL, printed).

### BlockStatement

`{ ... }` — a sequence of statements inside braces. Used by if expressions and functions.

```go
type BlockStatement struct {
    Token      token.Token
    Statements []Statement
}
```

---

## Expressions — Literals

### Identifier

`foo`, `myVariable`, `add` — a name that refers to a value.

```go
type Identifier struct {
    Token token.Token
    Value string
}
```

Yes, identifiers are expressions. `x` in `x + 1` is an expression that produces whatever
value `x` is bound to.

### IntegerLiteral

`5`, `100`, `999` — a whole number.

```go
type IntegerLiteral struct {
    Token token.Token
    Value int64
}
```

### StringLiteral

`"hello"`, `"world"` — a string value.

```go
type StringLiteral struct {
    Token token.Token
    Value string
}
```

### BooleanLiteral

`true`, `false` — a boolean value.

```go
type BooleanLiteral struct {
    Token token.Token
    Value bool
}
```

### ArrayLiteral

`[1, 2, 3]` — an ordered collection.

```go
type ArrayLiteral struct {
    Token    token.Token
    Elements []Expression
}
```

### HashLiteral

`{"name": "Alice", "age": 30}` — key-value pairs. Like a Go map or JS object.

```go
type HashLiteral struct {
    Token token.Token
    Pairs map[Expression]Expression
}
```

---

## Expressions — Compound

### PrefixExpression

`-5`, `!true` — an operator before its operand.

```go
type PrefixExpression struct {
    Token    token.Token
    Operator string
    Right    Expression
}
```

### InfixExpression

`5 + 3`, `x == y`, `a * b` — an operator between two operands.

```go
type InfixExpression struct {
    Token    token.Token
    Left     Expression
    Operator string
    Right    Expression
}
```

### IfExpression

`if (x > 5) { x } else { y }` — conditional. It's an EXPRESSION because it produces a
value (the last expression in the chosen branch).

```go
type IfExpression struct {
    Token       token.Token
    Condition   Expression
    Consequence *BlockStatement
    Alternative *BlockStatement
}
```

### FunctionLiteral

`fn(x, y) { x + y }` — an anonymous function value.

```go
type FunctionLiteral struct {
    Token      token.Token
    Parameters []*Identifier
    Body       *BlockStatement
}
```

### CallExpression

`add(1, 2)` or `fn(x) { x }(5)` — calling a function.

```go
type CallExpression struct {
    Token     token.Token
    Function  Expression
    Arguments []Expression
}
```

`Function` is an Expression because the thing being called can be any expression that
evaluates to a function — an identifier (`add`), a function literal (`fn(x) { x }`),
or even another call expression that returns a function.

### IndexExpression

`myArray[0]` or `myHash["key"]` — accessing an element by index or key.

```go
type IndexExpression struct {
    Token token.Token
    Left  Expression
    Index Expression
}
```

---

## Visual Example: `let x = 2 + 3 * 4;`

Here's what the AST looks like as a tree. The parser must build this structure from a
flat sequence of tokens.

```
                    Program
                       |
                 LetStatement
                /      |      \
           Name("x")  "="   InfixExpression
                            /      |       \
                    IntLit(2)     "+"    InfixExpression
                                        /      |       \
                                 IntLit(3)    "*"    IntLit(4)
```

Notice how `3 * 4` is nested deeper than `2 + ...`. This is how the AST encodes operator
precedence — multiplication binds tighter, so it's lower in the tree and gets evaluated
first.

If we printed the tree with indentation:

```
Program
  LetStatement
    Name: x
    Value: InfixExpression
      Left: IntegerLiteral(2)
      Operator: +
      Right: InfixExpression
        Left: IntegerLiteral(3)
        Operator: *
        Right: IntegerLiteral(4)
```

The Go structs for this tree:

```go
program := &Program{
    Statements: []Statement{
        &LetStatement{
            Name: &Identifier{Value: "x"},
            Value: &InfixExpression{
                Left:     &IntegerLiteral{Value: 2},
                Operator: "+",
                Right: &InfixExpression{
                    Left:     &IntegerLiteral{Value: 3},
                    Operator: "*",
                    Right:    &IntegerLiteral{Value: 4},
                },
            },
        },
    },
}
```

---

## More AST Examples

### `if (x > 5) { return true; } else { return false; }`

```
            Program
               |
        ExpressionStatement
               |
         IfExpression
        /      |       \
  Condition  Consequence  Alternative
      |          |            |
 InfixExpr  BlockStmt    BlockStmt
  /  |  \       |            |
 x  ">"  5  ReturnStmt  ReturnStmt
                |            |
            BoolLit(true)  BoolLit(false)
```

### `let add = fn(x, y) { x + y; };`

```
               Program
                  |
            LetStatement
           /      |      \
      Name("add") "="  FunctionLiteral
                        /            \
                 Parameters          Body
                /        \             |
           Ident("x")  Ident("y")  BlockStatement
                                       |
                                ExpressionStatement
                                       |
                                 InfixExpression
                                 /      |       \
                            Ident("x") "+"  Ident("y")
```

### `add(1, 2 * 3)`

```
            Program
               |
        ExpressionStatement
               |
         CallExpression
         /            \
    Function       Arguments
       |           /        \
  Ident("add")  IntLit(1)  InfixExpression
                            /      |       \
                     IntLit(2)    "*"    IntLit(3)
```

### `myArray[1 + 2]`

```
            Program
               |
        ExpressionStatement
               |
         IndexExpression
          /           \
       Left          Index
         |             |
  Ident("myArray")  InfixExpression
                     /      |      \
               IntLit(1)   "+"   IntLit(2)
```

---

## Node Type Summary Table

| Node                | Kind       | Key Fields                                  |
|---------------------|------------|---------------------------------------------|
| Program             | Root       | Statements []Statement                      |
| LetStatement        | Statement  | Name, Value                                 |
| ReturnStatement     | Statement  | ReturnValue                                 |
| ExpressionStatement | Statement  | Expression                                  |
| BlockStatement      | Statement  | Statements []Statement                      |
| Identifier          | Expression | Value string                                |
| IntegerLiteral      | Expression | Value int64                                 |
| StringLiteral       | Expression | Value string                                |
| BooleanLiteral      | Expression | Value bool                                  |
| PrefixExpression    | Expression | Operator, Right                             |
| InfixExpression     | Expression | Left, Operator, Right                       |
| IfExpression        | Expression | Condition, Consequence, Alternative         |
| FunctionLiteral     | Expression | Parameters, Body                            |
| CallExpression      | Expression | Function, Arguments                         |
| ArrayLiteral        | Expression | Elements []Expression                       |
| IndexExpression     | Expression | Left, Index                                 |
| HashLiteral         | Expression | Pairs map[Expression]Expression             |

---

## How Nodes Connect to Parsing

Each node type corresponds to a parsing function (or a branch in one):

- See `let` token → parse a `LetStatement`
- See `return` token → parse a `ReturnStatement`
- See `if` token → parse an `IfExpression`
- See `fn` token → parse a `FunctionLiteral`
- See an integer → create an `IntegerLiteral`
- See a prefix operator (`-`, `!`) → parse a `PrefixExpression`
- See an infix operator (`+`, `*`, `==`) → parse an `InfixExpression`
- See `(` after an expression → parse a `CallExpression`
- See `[` after an expression → parse an `IndexExpression`

The parser lesson (07) will implement all of these. This reference exists so you can
look up the exact struct shape while writing parsing code.
