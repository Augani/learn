# Lesson 6: Abstract Syntax Trees — The Heart of Every Language Tool

The parser's job is to take a flat stream of tokens and build a tree that captures the
structure and meaning of your code. That tree is the **Abstract Syntax Tree** (AST). It's
the single most important data structure in language tooling. Every tool you use daily --
ESLint, Prettier, the TypeScript compiler, `go vet`, `rustfmt` -- works by building an
AST and then walking it.

---

## The Family Tree Analogy

Think of source code as a sentence: `let x = 2 + 3 * 4;`

The tokens are individual words: `let`, `x`, `=`, `2`, `+`, `3`, `*`, `4`, `;`

But words alone don't capture meaning. "The dog bit the man" and "The man bit the dog"
have the same words but very different meanings. What matters is **relationships** --
which words connect to which, and how.

An AST is like a family tree for your code. It captures parent-child relationships
between the parts of your program. The `let` statement is the parent. Its children are
the variable name `x` and the value expression `2 + 3 * 4`. That value expression is
itself a parent with children -- the `+` node has `2` on the left and `3 * 4` on the
right.

Just like a family tree doesn't include the commas and "and" from a sentence like "Alice,
Bob, and Carol are siblings," the AST doesn't include the semicolons, parentheses, and
other punctuation from your source code. It captures the **meaning**, not the **noise**.

---

## Concrete Syntax Tree vs Abstract Syntax Tree

There are actually two kinds of trees a parser could build.

### Concrete Syntax Tree (CST) -- AKA Parse Tree

A CST is a literal representation of the grammar. It includes **everything**: every
parenthesis, every semicolon, every keyword. It's a direct mirror of the grammar rules
that matched during parsing.

For `let x = 2 + 3;`, a CST might look like:

```
            LetStatement
           /    |    |   \    \
        "let"  "x"  "="  Expr  ";"
                          |
                     InfixExpr
                    /    |    \
                  "2"   "+"   "3"
```

Every token is preserved. The `"let"` keyword, the `"="` sign, the `";"` at the end --
they're all nodes in the tree.

### Abstract Syntax Tree (AST) -- What We Actually Use

An AST strips away the syntactic sugar. It keeps only what matters for understanding the
**meaning** of the code.

For the same `let x = 2 + 3;`:

```
         LetStatement
         /          \
    Name("x")    InfixExpression
                 /      |      \
           IntLit(2)   "+"   IntLit(3)
```

The `"let"` keyword is gone -- the node type `LetStatement` already tells us this is a
let binding. The `"="` is gone -- it's implied by the structure. The `";"` is gone -- it
was just a delimiter for the parser.

### Why ASTs Win

CSTs are useful for tools that need to reproduce source code exactly (like formatters that
preserve your style choices). But for most tools -- compilers, interpreters, linters,
type checkers -- the CST carries too much baggage. You don't care about semicolons when
you're type-checking an expression.

Think of it this way: a CST is a court transcript (every "um" and "uh" preserved). An AST
is the summary that the judge reads (just the facts that matter for the ruling).

| Feature             | CST                      | AST                        |
|---------------------|--------------------------|----------------------------|
| Parentheses         | Preserved as nodes       | Encoded in tree structure  |
| Semicolons          | Preserved as nodes       | Removed                    |
| Keywords like `let` | Preserved as nodes       | Implied by node type       |
| Whitespace          | Sometimes preserved      | Never preserved            |
| Operator precedence | Implicit in parse order  | Explicit in tree depth     |
| Use case            | Formatters, refactoring  | Compilers, linters, interp |

---

## Expressions vs Statements

Every node in our AST falls into one of two categories. This distinction is fundamental
and shows up in every language.

### Expressions -- Things That Produce Values

An expression evaluates to something. You can use it anywhere a value is expected.

```
5                   --> produces 5
2 + 3               --> produces 5
x                   --> produces whatever x is bound to
add(1, 2)           --> produces the return value of add
fn(x) { x * 2 }    --> produces a function value
if (x > 0) { x }   --> produces x (in our language, if is an expression!)
```

Analogy: an expression is like an ATM transaction -- you walk up, do something, and walk
away with a value in hand.

### Statements -- Things That Perform Actions

A statement does something but doesn't produce a value you can use in another expression.

```
let x = 5;          --> binds 5 to x (no value produced)
return 42;          --> exits the function (no value produced)
```

Analogy: a statement is like mailing a letter -- you perform an action (dropping it in the
mailbox) but you don't get something back to use immediately.

### The Gray Area

In our language, some things that look like statements are actually expression statements
-- a bare expression used as a statement:

```
add(1, 2);
```

This is an expression (`add(1, 2)` produces a value) used as a statement (the value is
discarded). The AST wraps it in an `ExpressionStatement` node.

Also in our language, `if/else` is an EXPRESSION -- it produces a value. This is like how
the ternary operator works in JS/Go (`x > 5 ? "big" : "small"`), except with full
if/else blocks.

---

## Designing the AST: The Node Interfaces

Every AST node needs to implement a common interface so the rest of the system (parser,
interpreter, compiler) can work with nodes generically.

### The Base Node Interface

```go
type Node interface {
    TokenLiteral() string
    String() string
}
```

`TokenLiteral()` returns the literal value of the token associated with this node. It's
mainly useful for debugging -- when something goes wrong, you want to know what token
caused it.

`String()` returns a string representation of the node and its children. This lets you
print the entire AST as readable text to verify the parser built it correctly.

### Statement and Expression Interfaces

```go
type Statement interface {
    Node
    statementNode()
}

type Expression interface {
    Node
    expressionNode()
}
```

The `statementNode()` and `expressionNode()` methods are **marker methods**. They don't
do anything at runtime. They exist purely for type safety at compile time.

Why? Without them, Go's type system can't distinguish between statements and expressions
-- they'd both just be `Node`. The marker methods let the compiler catch mistakes like
accidentally putting a `LetStatement` where an `Expression` is expected. It's like
putting different shaped plugs on power cables so you can't plug a 220V device into a
110V outlet.

---

## The Root: Program Node

Every AST has exactly one root node. For us, it's `Program`, which holds a list of
statements:

```go
type Program struct {
    Statements []Statement
}

func (p *Program) TokenLiteral() string {
    if len(p.Statements) > 0 {
        return p.Statements[0].TokenLiteral()
    }
    return ""
}

func (p *Program) String() string {
    var out bytes.Buffer
    for _, s := range p.Statements {
        out.WriteString(s.String())
    }
    return out.String()
}
```

A source file is just a sequence of statements. The `Program` node is the container that
holds them all. If the AST is a family tree, `Program` is the oldest ancestor at the top.

---

## Statement Nodes

### LetStatement

`let x = 5 + 3;` -- binds a value to a name.

```go
type LetStatement struct {
    Token token.Token
    Name  *Identifier
    Value Expression
}
```

- `Token` -- the `let` token (kept for error reporting and `TokenLiteral()`)
- `Name` -- the identifier being bound (`x`)
- `Value` -- any expression that produces the value (`5 + 3`, `fn(a) { a }`, `add(1, 2)`)

The `Value` field is typed as `Expression` (the interface), not a specific struct. This
means a let statement can bind ANY expression to a name -- integers, function calls,
if expressions, even other identifiers.

### ReturnStatement

`return x + 1;` -- exits a function with a value.

```go
type ReturnStatement struct {
    Token       token.Token
    ReturnValue Expression
}
```

Simple: a `return` keyword and the expression to return.

### ExpressionStatement

`add(1, 2);` -- a bare expression used as a statement.

```go
type ExpressionStatement struct {
    Token      token.Token
    Expression Expression
}
```

This exists because expressions can stand alone as statements. In a REPL, almost
everything you type is an expression statement: `5 + 3`, `add(1, 2)`, `if (x > 5) { x }`.

### BlockStatement

`{ stmt1; stmt2; stmt3; }` -- a sequence of statements in braces.

```go
type BlockStatement struct {
    Token      token.Token
    Statements []Statement
}
```

Block statements show up as the body of `if` expressions and function literals. They're
like `Program` but scoped -- a mini-program inside braces.

---

## Expression Nodes -- Literals

Literals are the simplest expressions. They represent values that appear directly in
source code.

### Identifier

`foo`, `myVariable`, `add` -- a name that refers to a value.

```go
type Identifier struct {
    Token token.Token
    Value string
}
```

Yes, identifiers are expressions. When you write `x + 1`, the `x` is an expression that
produces whatever value `x` is currently bound to in the environment.

### IntegerLiteral

`5`, `100`, `999` -- a whole number.

```go
type IntegerLiteral struct {
    Token token.Token
    Value int64
}
```

The `Value` field is `int64`, not `string`. The parser converts the string `"42"` from
the token into the number `42` when building this node.

### StringLiteral

`"hello"`, `"world"` -- a string value.

```go
type StringLiteral struct {
    Token token.Token
    Value string
}
```

### BooleanLiteral

`true`, `false` -- boolean values.

```go
type BooleanLiteral struct {
    Token token.Token
    Value bool
}
```

---

## Expression Nodes -- Compound

Compound expressions combine other expressions using operators or structural constructs.

### PrefixExpression

`-5`, `!true` -- an operator before its operand.

```go
type PrefixExpression struct {
    Token    token.Token
    Operator string
    Right    Expression
}
```

The `Right` field is the operand. It's an `Expression`, so you can negate anything:
`-5`, `-x`, `-(a + b)`, `!!true`.

### InfixExpression

`5 + 3`, `x == y`, `a * b` -- an operator between two operands.

```go
type InfixExpression struct {
    Token    token.Token
    Left     Expression
    Operator string
    Right    Expression
}
```

This is the workhorse of the AST. Most operations -- arithmetic, comparison, equality --
are infix expressions. The `Left` and `Right` fields can be any expression, which is how
complex expressions like `(a + b) * (c - d)` get represented as nested trees.

### IfExpression

`if (x > 5) { x } else { y }` -- conditional branching.

```go
type IfExpression struct {
    Token       token.Token
    Condition   Expression
    Consequence *BlockStatement
    Alternative *BlockStatement
}
```

In our language, `if` is an EXPRESSION -- it produces a value. The value is the result
of whichever branch executes. `Alternative` is a pointer because the `else` clause is
optional (it can be `nil`).

### FunctionLiteral

`fn(x, y) { x + y }` -- an anonymous function value.

```go
type FunctionLiteral struct {
    Token      token.Token
    Parameters []*Identifier
    Body       *BlockStatement
}
```

Functions are values in our language, just like in JavaScript. You can assign them to
variables, pass them as arguments, return them from other functions.

### CallExpression

`add(1, 2)` or `fn(x) { x }(5)` -- calling a function.

```go
type CallExpression struct {
    Token     token.Token
    Function  Expression
    Arguments []Expression
}
```

`Function` is an `Expression` because the thing being called doesn't have to be a simple
name. It can be any expression that evaluates to a function: an identifier (`add`), a
function literal (`fn(x) { x }`), or even another call that returns a function
(`getHandler()(request)`).

---

## Visualizing an AST

Let's look at a real piece of code and its AST. This is the most important skill for
working with language tools -- being able to mentally picture the tree that code produces.

### Example: `if (x > 5) { return x * 2; } else { return x + 1; }`

```
                              Program
                                 |
                         ExpressionStatement
                                 |
                           IfExpression
                          /      |       \
                   Condition  Consequence  Alternative
                      |          |            |
                 InfixExpr   BlockStmt    BlockStmt
                /    |   \       |            |
          Ident   ">"  IntLit  ReturnStmt  ReturnStmt
          ("x")         (5)      |            |
                            InfixExpr    InfixExpr
                           /    |    \   /    |    \
                     Ident  "*"  IntLit Ident "+"  IntLit
                     ("x")        (2)  ("x")        (1)
```

Read this tree from top to bottom:

1. The program contains one expression statement
2. That expression is an `if` with a condition, consequence, and alternative
3. The condition is `x > 5` -- an infix expression with `>` operator
4. The consequence block contains `return x * 2` -- a return statement whose value is
   an infix expression
5. The alternative block contains `return x + 1` -- same pattern, different operator
   and operand

Notice how the tree captures everything we need to evaluate this code. We know the
condition to check, which block to execute for each outcome, and exactly what expression
to compute in each branch. We don't need the parentheses, braces, or semicolons anymore
-- the tree structure encodes all of that.

### Example: `let add = fn(x, y) { x + y; };`

```
                    Program
                       |
                 LetStatement
                /      |      \
          Name("add")  "="  FunctionLiteral
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

### Example: `add(1, 2 * 3)`

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

### Example: Operator Precedence -- `1 + 2 * 3`

This is where the tree structure really shines. The parser MUST build the tree so that
`*` binds tighter than `+`:

```
                InfixExpression
                /      |       \
          IntLit(1)   "+"    InfixExpression
                              /      |       \
                       IntLit(2)    "*"    IntLit(3)
```

The `*` node is DEEPER in the tree, which means it gets evaluated FIRST. When the
interpreter walks this tree bottom-up, it computes `2 * 3 = 6` first, then `1 + 6 = 7`.
The tree structure IS the precedence -- no lookup table needed at evaluation time.

If the parser got it wrong and built left-to-right without precedence:

```
                InfixExpression        <-- WRONG!
                /      |       \
          InfixExpression  "*"  IntLit(3)
          /      |       \
    IntLit(1)   "+"    IntLit(2)
```

This tree would compute `(1 + 2) * 3 = 9`. Same tokens, different tree, different result.
The parser's job is to build the RIGHT tree.

---

## Why ASTs Matter: Your Daily Tools

You already work with ASTs every day -- you just don't see them.

- **ESLint**: when it reports "no-unused-vars," it's walking the AST looking for
  `Identifier` nodes in declarations that never appear in expression nodes.
- **Prettier**: parses your code to an AST (throwing away all whitespace), then re-emits
  it with its own formatting rules. Your style goes in, Prettier's style comes out.
- **TypeScript compiler**: when `tsc` reports a type error, it's walking the AST with
  type annotations. The type checker never looks at source text -- only the tree.
- **go vet**: walks the AST to find `CallExpression` nodes for `fmt.Printf`, then checks
  that format verbs match argument types.
- **rustfmt**: like Prettier -- parses to AST, re-emits with standard formatting.
- **Babel / SWC**: JSX transformation is an AST rewrite. `<Button />` becomes a
  `CallExpression` for `React.createElement`.

---

## How Nodes Connect to Each Other

The power of the AST is in how nodes nest inside each other. Every field typed as
`Expression` or `Statement` can hold ANY concrete type that implements that interface.

- A `LetStatement`'s `Value` can be an `IntegerLiteral`, an `InfixExpression`, a
  `FunctionLiteral`, a `CallExpression`, or any other expression
- An `InfixExpression`'s `Left` and `Right` can themselves be `InfixExpression`s,
  creating arbitrary nesting depth
- A `CallExpression`'s `Function` can be a `FunctionLiteral` (immediately invoked
  function), an `Identifier`, or even another `CallExpression` (higher-order functions)

Think of it like LEGO bricks: each brick type (node type) has specific connectors (fields),
but any brick that fits a connector can go there. You can build arbitrarily complex
structures from simple, composable pieces.

---

## The String() Method and Testing

Every AST node implements `String()` to produce a readable text representation. The
`InfixExpression.String()` wraps itself in parentheses, so when you print `1 + 2 * 3`,
the output is `(1 + (2 * 3))` -- making precedence unambiguous.

This is your primary testing strategy. Feed source code to the parser, check the AST's
`String()` output:

```go
input := "1 + 2 * 3"

// Parser should produce: (1 + (2 * 3))
// NOT: ((1 + 2) * 3)
```

If the parenthesized output matches what you expect, the tree structure is correct. If it
doesn't, the parser has a precedence bug.

---

## Key Takeaways

- A **CST** preserves every token (parentheses, semicolons, keywords). An **AST** keeps
  only the meaningful structure.

- AST nodes are either **expressions** (produce values) or **statements** (perform
  actions). Marker methods enforce this distinction at compile time.

- The **Node**, **Statement**, and **Expression** interfaces let the parser, interpreter,
  and compiler work generically with any node type.

- Operator **precedence** is encoded in tree **depth** -- deeper nodes bind tighter and
  evaluate first.

- Every tool you use works on ASTs: ESLint walks them to find patterns, Prettier
  rebuilds formatting from them, TypeScript annotates them with types.

- The `String()` method on every node is your primary debugging tool for verifying the
  parser builds the correct tree.

---

## What's Next

In the next lesson, we build a complete **Pratt parser** from scratch. You'll implement
every AST node from this lesson, handle operator precedence with an elegant table-driven
approach, and parse complex expressions like `if (x > 5) { fn(a) { a * 2 }(x) }`. It's
the biggest implementation lesson in this track -- and the most rewarding.
