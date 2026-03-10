# Lesson 7: Building a Pratt Parser From Scratch

This is the big one. By the end of this lesson you'll have a working parser that takes
tokens from the lexer and builds a complete AST. The technique we're using -- **Pratt
parsing** (also called "top-down operator precedence") -- is elegant, extensible, and
used in real-world tools. The TypeScript compiler, ESLint's parser, and Rust's early
parser all use variations of this approach.

---

## Why Pratt Parsing?

In the grammar lesson, we saw how operator precedence can be encoded in grammar rules --
one rule per precedence level (`addition`, `multiplication`, etc.). That works, but it
means adding a new operator requires adding a new grammar rule AND a new parsing function.

Pratt parsing takes a different approach. Instead of encoding precedence in the grammar
structure, it uses a **precedence table** -- a simple map from token types to numbers.
Higher number means tighter binding.

Analogy: imagine a group of people fighting over who gets to "own" an operand. In
`1 + 2 * 3`, both `+` and `*` want to own `2`. The `*` operator has a higher precedence
number (stronger grip), so it wins -- `2` belongs to the `*` expression, not the `+`.
The Pratt parser simulates this tug-of-war by comparing precedence numbers.

---

## Part 1: Define the AST Node Interfaces

First, we need the interfaces and types that the parser will build. These go in the `ast`
package.

### The Core Interfaces

```go
package ast

import (
    "bytes"
    "monkey/token"
    "strings"
)

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

### The Program Root

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

---

## Part 2: Implement Statement Nodes

Every node implements the marker method (`statementNode()` or `expressionNode()`),
`TokenLiteral()`, and `String()`. The pattern is the same for all of them, so we'll show
the full implementations here. See the [AST reference](./reference-ast.md) for struct
field explanations.

```go
type LetStatement struct {
    Token token.Token
    Name  *Identifier
    Value Expression
}

func (ls *LetStatement) statementNode()       {}
func (ls *LetStatement) TokenLiteral() string { return ls.Token.Literal }

func (ls *LetStatement) String() string {
    var out bytes.Buffer
    out.WriteString(ls.TokenLiteral() + " ")
    out.WriteString(ls.Name.String())
    out.WriteString(" = ")
    if ls.Value != nil {
        out.WriteString(ls.Value.String())
    }
    out.WriteString(";")
    return out.String()
}

type ReturnStatement struct {
    Token       token.Token
    ReturnValue Expression
}

func (rs *ReturnStatement) statementNode()       {}
func (rs *ReturnStatement) TokenLiteral() string { return rs.Token.Literal }

func (rs *ReturnStatement) String() string {
    var out bytes.Buffer
    out.WriteString(rs.TokenLiteral() + " ")
    if rs.ReturnValue != nil {
        out.WriteString(rs.ReturnValue.String())
    }
    out.WriteString(";")
    return out.String()
}

type ExpressionStatement struct {
    Token      token.Token
    Expression Expression
}

func (es *ExpressionStatement) statementNode()       {}
func (es *ExpressionStatement) TokenLiteral() string { return es.Token.Literal }

func (es *ExpressionStatement) String() string {
    if es.Expression != nil {
        return es.Expression.String()
    }
    return ""
}

type BlockStatement struct {
    Token      token.Token
    Statements []Statement
}

func (bs *BlockStatement) statementNode()       {}
func (bs *BlockStatement) TokenLiteral() string { return bs.Token.Literal }

func (bs *BlockStatement) String() string {
    var out bytes.Buffer
    for _, s := range bs.Statements {
        out.WriteString(s.String())
    }
    return out.String()
}
```

---

## Part 3: Implement Expression Nodes

Simple literals return their token literal for `String()`. Compound expressions wrap
themselves in parentheses so precedence is visible when debugging.

```go
type Identifier struct {
    Token token.Token
    Value string
}

func (i *Identifier) expressionNode()      {}
func (i *Identifier) TokenLiteral() string { return i.Token.Literal }
func (i *Identifier) String() string       { return i.Value }

type IntegerLiteral struct {
    Token token.Token
    Value int64
}

func (il *IntegerLiteral) expressionNode()      {}
func (il *IntegerLiteral) TokenLiteral() string { return il.Token.Literal }
func (il *IntegerLiteral) String() string       { return il.Token.Literal }

type StringLiteral struct {
    Token token.Token
    Value string
}

func (sl *StringLiteral) expressionNode()      {}
func (sl *StringLiteral) TokenLiteral() string { return sl.Token.Literal }
func (sl *StringLiteral) String() string       { return sl.Token.Literal }

type BooleanLiteral struct {
    Token token.Token
    Value bool
}

func (b *BooleanLiteral) expressionNode()      {}
func (b *BooleanLiteral) TokenLiteral() string { return b.Token.Literal }
func (b *BooleanLiteral) String() string       { return b.Token.Literal }

type PrefixExpression struct {
    Token    token.Token
    Operator string
    Right    Expression
}

func (pe *PrefixExpression) expressionNode()      {}
func (pe *PrefixExpression) TokenLiteral() string { return pe.Token.Literal }

func (pe *PrefixExpression) String() string {
    var out bytes.Buffer
    out.WriteString("(")
    out.WriteString(pe.Operator)
    out.WriteString(pe.Right.String())
    out.WriteString(")")
    return out.String()
}

type InfixExpression struct {
    Token    token.Token
    Left     Expression
    Operator string
    Right    Expression
}

func (ie *InfixExpression) expressionNode()      {}
func (ie *InfixExpression) TokenLiteral() string { return ie.Token.Literal }

func (ie *InfixExpression) String() string {
    var out bytes.Buffer
    out.WriteString("(")
    out.WriteString(ie.Left.String())
    out.WriteString(" " + ie.Operator + " ")
    out.WriteString(ie.Right.String())
    out.WriteString(")")
    return out.String()
}

type IfExpression struct {
    Token       token.Token
    Condition   Expression
    Consequence *BlockStatement
    Alternative *BlockStatement
}

func (ie *IfExpression) expressionNode()      {}
func (ie *IfExpression) TokenLiteral() string { return ie.Token.Literal }

func (ie *IfExpression) String() string {
    var out bytes.Buffer
    out.WriteString("if")
    out.WriteString(ie.Condition.String())
    out.WriteString(" ")
    out.WriteString(ie.Consequence.String())
    if ie.Alternative != nil {
        out.WriteString("else ")
        out.WriteString(ie.Alternative.String())
    }
    return out.String()
}

type FunctionLiteral struct {
    Token      token.Token
    Parameters []*Identifier
    Body       *BlockStatement
}

func (fl *FunctionLiteral) expressionNode()      {}
func (fl *FunctionLiteral) TokenLiteral() string { return fl.Token.Literal }

func (fl *FunctionLiteral) String() string {
    var out bytes.Buffer
    params := []string{}
    for _, p := range fl.Parameters {
        params = append(params, p.String())
    }
    out.WriteString(fl.TokenLiteral())
    out.WriteString("(")
    out.WriteString(strings.Join(params, ", "))
    out.WriteString(")")
    out.WriteString(fl.Body.String())
    return out.String()
}

type CallExpression struct {
    Token     token.Token
    Function  Expression
    Arguments []Expression
}

func (ce *CallExpression) expressionNode()      {}
func (ce *CallExpression) TokenLiteral() string { return ce.Token.Literal }

func (ce *CallExpression) String() string {
    var out bytes.Buffer
    args := []string{}
    for _, a := range ce.Arguments {
        args = append(args, a.String())
    }
    out.WriteString(ce.Function.String())
    out.WriteString("(")
    out.WriteString(strings.Join(args, ", "))
    out.WriteString(")")
    return out.String()
}
```

---

## Part 4: The Parser Struct

Now the real work begins. The parser reads tokens from the lexer and builds AST nodes.

### Precedence Levels

These constants define how tightly each operator binds. Higher numbers bind tighter.
Think of it like gravity: `CALL` has the strongest pull, `LOWEST` has almost none.

```go
package parser

import (
    "fmt"
    "monkey/ast"
    "monkey/lexer"
    "monkey/token"
    "strconv"
)

const (
    _ int = iota
    LOWEST      // 1 - default
    EQUALS      // 2 - ==, !=
    LESSGREATER // 3 - <, >
    SUM         // 4 - +, -
    PRODUCT     // 5 - *, /
    PREFIX      // 6 - -x, !x
    CALL        // 7 - fn()
)
```

### Token-to-Precedence Map

```go
var precedences = map[token.TokenType]int{
    token.EQ:       EQUALS,
    token.NOT_EQ:   EQUALS,
    token.LT:       LESSGREATER,
    token.GT:       LESSGREATER,
    token.PLUS:     SUM,
    token.MINUS:    SUM,
    token.SLASH:    PRODUCT,
    token.ASTERISK: PRODUCT,
    token.LPAREN:   CALL,
}
```

### Parse Function Types

Pratt parsing uses two kinds of parse functions. **Prefix** functions handle tokens at the
START of an expression (numbers, identifiers, `-`, `!`, `(`). **Infix** functions handle
tokens BETWEEN expressions (`+`, `*`, `(` for calls) -- they receive the already-parsed
left side.

```go
type (
    prefixParseFn func() ast.Expression
    infixParseFn  func(ast.Expression) ast.Expression
)
```

### The Parser Struct

```go
type Parser struct {
    l      *lexer.Lexer
    errors []string

    curToken  token.Token
    peekToken token.Token

    prefixParseFns map[token.TokenType]prefixParseFn
    infixParseFns  map[token.TokenType]infixParseFn
}
```

The parser has two token windows: `curToken` (what we're looking at) and `peekToken`
(what's coming next). The peek lets you make decisions: "I see a `(` next, so this
identifier must be a function call."

### Constructor and Token Advancement

```go
func New(l *lexer.Lexer) *Parser {
    p := &Parser{
        l:      l,
        errors: []string{},
    }

    p.prefixParseFns = make(map[token.TokenType]prefixParseFn)
    p.registerPrefix(token.IDENT, p.parseIdentifier)
    p.registerPrefix(token.INT, p.parseIntegerLiteral)
    p.registerPrefix(token.STRING, p.parseStringLiteral)
    p.registerPrefix(token.BANG, p.parsePrefixExpression)
    p.registerPrefix(token.MINUS, p.parsePrefixExpression)
    p.registerPrefix(token.TRUE, p.parseBoolean)
    p.registerPrefix(token.FALSE, p.parseBoolean)
    p.registerPrefix(token.LPAREN, p.parseGroupedExpression)
    p.registerPrefix(token.IF, p.parseIfExpression)
    p.registerPrefix(token.FUNCTION, p.parseFunctionLiteral)

    p.infixParseFns = make(map[token.TokenType]infixParseFn)
    p.registerInfix(token.PLUS, p.parseInfixExpression)
    p.registerInfix(token.MINUS, p.parseInfixExpression)
    p.registerInfix(token.SLASH, p.parseInfixExpression)
    p.registerInfix(token.ASTERISK, p.parseInfixExpression)
    p.registerInfix(token.EQ, p.parseInfixExpression)
    p.registerInfix(token.NOT_EQ, p.parseInfixExpression)
    p.registerInfix(token.LT, p.parseInfixExpression)
    p.registerInfix(token.GT, p.parseInfixExpression)
    p.registerInfix(token.LPAREN, p.parseCallExpression)

    p.nextToken()
    p.nextToken()

    return p
}

func (p *Parser) nextToken() {
    p.curToken = p.peekToken
    p.peekToken = p.l.NextToken()
}

func (p *Parser) Errors() []string {
    return p.errors
}
```

We call `nextToken()` twice so both `curToken` and `peekToken` are set before parsing.
The registration maps are the heart of Pratt parsing -- when the parser encounters a
token, it looks up the function that knows how to parse it. Adding a new operator is as
simple as writing a parse function and registering it.

### Helper Methods

```go
func (p *Parser) curTokenIs(t token.TokenType) bool {
    return p.curToken.Type == t
}

func (p *Parser) peekTokenIs(t token.TokenType) bool {
    return p.peekToken.Type == t
}

func (p *Parser) expectPeek(t token.TokenType) bool {
    if p.peekTokenIs(t) {
        p.nextToken()
        return true
    }
    p.peekError(t)
    return false
}

func (p *Parser) peekError(t token.TokenType) {
    msg := fmt.Sprintf("expected next token to be %s, got %s instead",
        t, p.peekToken.Type)
    p.errors = append(p.errors, msg)
}

func (p *Parser) noPrefixParseFnError(t token.TokenType) {
    msg := fmt.Sprintf("no prefix parse function for %s found", t)
    p.errors = append(p.errors, msg)
}

func (p *Parser) peekPrecedence() int {
    if p, ok := precedences[p.peekToken.Type]; ok {
        return p
    }
    return LOWEST
}

func (p *Parser) curPrecedence() int {
    if p, ok := precedences[p.curToken.Type]; ok {
        return p
    }
    return LOWEST
}

func (p *Parser) registerPrefix(tokenType token.TokenType, fn prefixParseFn) {
    p.prefixParseFns[tokenType] = fn
}

func (p *Parser) registerInfix(tokenType token.TokenType, fn infixParseFn) {
    p.infixParseFns[tokenType] = fn
}
```

`expectPeek` is the key pattern: "I expect the next token to be X. If it is, advance
and return true. If not, record an error and return false."

---

## Part 5: The Main Parsing Loop

### ParseProgram

```go
func (p *Parser) ParseProgram() *ast.Program {
    program := &ast.Program{}
    program.Statements = []ast.Statement{}

    for !p.curTokenIs(token.EOF) {
        stmt := p.parseStatement()
        if stmt != nil {
            program.Statements = append(program.Statements, stmt)
        }
        p.nextToken()
    }

    return program
}
```

Simple loop: keep parsing statements until we hit EOF. Each statement gets added to the
program's list.

### parseStatement

```go
func (p *Parser) parseStatement() ast.Statement {
    switch p.curToken.Type {
    case token.LET:
        return p.parseLetStatement()
    case token.RETURN:
        return p.parseReturnStatement()
    default:
        return p.parseExpressionStatement()
    }
}
```

Three choices based on the current token:
- See `let` --> parse a let statement
- See `return` --> parse a return statement
- Anything else --> it must be an expression statement

### parseLetStatement

```go
func (p *Parser) parseLetStatement() *ast.LetStatement {
    stmt := &ast.LetStatement{Token: p.curToken}

    if !p.expectPeek(token.IDENT) {
        return nil
    }

    stmt.Name = &ast.Identifier{Token: p.curToken, Value: p.curToken.Literal}

    if !p.expectPeek(token.ASSIGN) {
        return nil
    }

    p.nextToken()

    stmt.Value = p.parseExpression(LOWEST)

    if p.peekTokenIs(token.SEMICOLON) {
        p.nextToken()
    }

    return stmt
}
```

Trace through `let x = 5;`:
1. `curToken` is `let`. Create the `LetStatement`, save the token.
2. `expectPeek(IDENT)` -- peek is `x`, so advance. Now `curToken` is `x`.
3. Build the `Identifier` with value `"x"`.
4. `expectPeek(ASSIGN)` -- peek is `=`, so advance. Now `curToken` is `=`.
5. `nextToken()` -- advance past `=`. Now `curToken` is `5`.
6. `parseExpression(LOWEST)` -- parse the value expression (returns `IntegerLiteral(5)`).
7. If there's a semicolon, skip it.

### parseReturnStatement

```go
func (p *Parser) parseReturnStatement() *ast.ReturnStatement {
    stmt := &ast.ReturnStatement{Token: p.curToken}

    p.nextToken()

    stmt.ReturnValue = p.parseExpression(LOWEST)

    if p.peekTokenIs(token.SEMICOLON) {
        p.nextToken()
    }

    return stmt
}
```

### parseExpressionStatement

```go
func (p *Parser) parseExpressionStatement() *ast.ExpressionStatement {
    stmt := &ast.ExpressionStatement{Token: p.curToken}

    stmt.Expression = p.parseExpression(LOWEST)

    if p.peekTokenIs(token.SEMICOLON) {
        p.nextToken()
    }

    return stmt
}
```

Semicolons are optional in expression statements. This makes the REPL nicer -- you can
type `5 + 3` without a semicolon.

---

## Part 6: The Heart -- parseExpression

This is the core of Pratt parsing. Every expression in the language flows through this
single function.

```go
func (p *Parser) parseExpression(precedence int) ast.Expression {
    prefix := p.prefixParseFns[p.curToken.Type]
    if prefix == nil {
        p.noPrefixParseFnError(p.curToken.Type)
        return nil
    }
    leftExp := prefix()

    for !p.peekTokenIs(token.SEMICOLON) && precedence < p.peekPrecedence() {
        infix := p.infixParseFns[p.peekToken.Type]
        if infix == nil {
            return leftExp
        }
        p.nextToken()
        leftExp = infix(leftExp)
    }

    return leftExp
}
```

This is only 15 lines but it's dense. Two phases:

**Phase 1** -- look up the current token in the prefix map, call the function to get the
left-hand expression. For `5 + 3 * 2`, `parseIntegerLiteral` returns `IntLit(5)`.

**Phase 2** -- the precedence climbing loop: "While the next token's precedence is higher
than my current precedence, absorb it into a bigger expression." The `precedence`
parameter is the key. When parsing the right side of `+` (precedence 4), the loop keeps
going for `*` (precedence 5 > 4) but stops for another `+` (4 is NOT > 4).

### Walkthrough: `5 + 3 * 2`

Let's trace through this step by step.

**Call: `parseExpression(LOWEST)`** -- precedence = 1

1. `curToken` = `5`. Prefix: `parseIntegerLiteral` --> `leftExp = IntLit(5)`
2. Loop check: peek is `+` (precedence 4). Is `1 < 4`? Yes. Enter loop.
3. Advance. `curToken` = `+`. Call `parseInfixExpression(IntLit(5))`.

**Inside `parseInfixExpression`, it calls `parseExpression(SUM)`** -- precedence = 4

1. `curToken` = `3`. Prefix: `parseIntegerLiteral` --> `leftExp = IntLit(3)`
2. Loop check: peek is `*` (precedence 5). Is `4 < 5`? Yes. Enter loop.
3. Advance. `curToken` = `*`. Call `parseInfixExpression(IntLit(3))`.

**Inside `parseInfixExpression`, it calls `parseExpression(PRODUCT)`** -- precedence = 5

1. `curToken` = `2`. Prefix: `parseIntegerLiteral` --> `leftExp = IntLit(2)`
2. Loop check: peek is `;` (or EOF). Stop.
3. Return `IntLit(2)`.

**Back in the `*` infix call**: builds `InfixExpr(IntLit(3), *, IntLit(2))`. Returns it.

**Back in the inner `parseExpression(SUM)`**: `leftExp` is now `InfixExpr(3 * 2)`.
Loop check: peek is `;`. Is `4 < 1`? No. Stop. Return `InfixExpr(3 * 2)`.

**Back in the `+` infix call**: builds `InfixExpr(IntLit(5), +, InfixExpr(3 * 2))`.

**Final result**: `(5 + (3 * 2))` -- correct precedence!

The magic is in the recursive calls with different precedence levels. Each call says
"parse everything that binds tighter than me." Lower-precedence operators stop the inner
loops, creating the correct nesting.

---

## Part 7: Prefix Parse Functions

These functions handle tokens that appear at the START of an expression.

### parseIdentifier

```go
func (p *Parser) parseIdentifier() ast.Expression {
    return &ast.Identifier{Token: p.curToken, Value: p.curToken.Literal}
}
```

The simplest prefix function. See an identifier, make an `Identifier` node.

### parseIntegerLiteral

```go
func (p *Parser) parseIntegerLiteral() ast.Expression {
    lit := &ast.IntegerLiteral{Token: p.curToken}

    value, err := strconv.ParseInt(p.curToken.Literal, 0, 64)
    if err != nil {
        msg := fmt.Sprintf("could not parse %q as integer", p.curToken.Literal)
        p.errors = append(p.errors, msg)
        return nil
    }

    lit.Value = value
    return lit
}
```

Convert the string `"42"` to the integer `42`. If the conversion fails (shouldn't happen
if the lexer is correct, but defensive programming demands we check), report an error.

### parseStringLiteral

```go
func (p *Parser) parseStringLiteral() ast.Expression {
    return &ast.StringLiteral{Token: p.curToken, Value: p.curToken.Literal}
}
```

### parseBoolean

```go
func (p *Parser) parseBoolean() ast.Expression {
    return &ast.BooleanLiteral{
        Token: p.curToken,
        Value: p.curTokenIs(token.TRUE),
    }
}
```

Neat trick: `curTokenIs(token.TRUE)` returns `true` if the token is `TRUE`, `false` if
it's `FALSE`. That boolean IS the value we want.

### parsePrefixExpression

```go
func (p *Parser) parsePrefixExpression() ast.Expression {
    expression := &ast.PrefixExpression{
        Token:    p.curToken,
        Operator: p.curToken.Literal,
    }

    p.nextToken()

    expression.Right = p.parseExpression(PREFIX)

    return expression
}
```

For `-5`: save the `-` operator, advance past it, then parse what comes next with
`PREFIX` precedence (very high, so only atoms and calls can be absorbed). The result is
`PrefixExpr(-, IntLit(5))`.

For `!true`: same pattern. `PrefixExpr(!, BoolLit(true))`.

For `-a * b`: the `PREFIX` precedence is higher than `PRODUCT`, so `parseExpression`
returns just `a` (not `a * b`). The result is `((-a) * b)`, which is correct -- negation
binds tighter than multiplication.

### parseGroupedExpression

```go
func (p *Parser) parseGroupedExpression() ast.Expression {
    p.nextToken()

    exp := p.parseExpression(LOWEST)

    if !p.expectPeek(token.RPAREN) {
        return nil
    }

    return exp
}
```

Parentheses override precedence by starting a fresh `parseExpression(LOWEST)` call.
Everything inside the parens gets parsed as a single expression. The tokens `(` and `)`
are consumed but don't appear in the AST -- their effect is encoded in the tree structure.
For `(1 + 2) * 3`, the parens force `1 + 2` to be grouped first, producing
`InfixExpr(InfixExpr(1 + 2), *, 3)` instead of `InfixExpr(1, +, InfixExpr(2 * 3))`.

### parseIfExpression

```go
func (p *Parser) parseIfExpression() ast.Expression {
    expression := &ast.IfExpression{Token: p.curToken}

    if !p.expectPeek(token.LPAREN) {
        return nil
    }

    p.nextToken()
    expression.Condition = p.parseExpression(LOWEST)

    if !p.expectPeek(token.RPAREN) {
        return nil
    }

    if !p.expectPeek(token.LBRACE) {
        return nil
    }

    expression.Consequence = p.parseBlockStatement()

    if p.peekTokenIs(token.ELSE) {
        p.nextToken()

        if !p.expectPeek(token.LBRACE) {
            return nil
        }

        expression.Alternative = p.parseBlockStatement()
    }

    return expression
}
```

For `if (x > 5) { x } else { y }`: save `if`, expect and advance past `(`, parse the
condition, expect `)`, expect `{`, parse consequence block. If `else` follows, advance
past it, expect `{`, parse alternative block.

### parseBlockStatement

```go
func (p *Parser) parseBlockStatement() *ast.BlockStatement {
    block := &ast.BlockStatement{Token: p.curToken}
    block.Statements = []ast.Statement{}

    p.nextToken()

    for !p.curTokenIs(token.RBRACE) && !p.curTokenIs(token.EOF) {
        stmt := p.parseStatement()
        if stmt != nil {
            block.Statements = append(block.Statements, stmt)
        }
        p.nextToken()
    }

    return block
}
```

A block is just like `ParseProgram` but stops at `}` instead of EOF. The EOF check
prevents infinite loops if the source is missing a closing brace.

### parseFunctionLiteral

```go
func (p *Parser) parseFunctionLiteral() ast.Expression {
    lit := &ast.FunctionLiteral{Token: p.curToken}

    if !p.expectPeek(token.LPAREN) {
        return nil
    }

    lit.Parameters = p.parseFunctionParameters()

    if !p.expectPeek(token.LBRACE) {
        return nil
    }

    lit.Body = p.parseBlockStatement()

    return lit
}

func (p *Parser) parseFunctionParameters() []*ast.Identifier {
    identifiers := []*ast.Identifier{}

    if p.peekTokenIs(token.RPAREN) {
        p.nextToken()
        return identifiers
    }

    p.nextToken()

    ident := &ast.Identifier{Token: p.curToken, Value: p.curToken.Literal}
    identifiers = append(identifiers, ident)

    for p.peekTokenIs(token.COMMA) {
        p.nextToken()
        p.nextToken()
        ident := &ast.Identifier{Token: p.curToken, Value: p.curToken.Literal}
        identifiers = append(identifiers, ident)
    }

    if !p.expectPeek(token.RPAREN) {
        return nil
    }

    return identifiers
}
```

The parameter parsing handles three cases: `fn()` (peek is `)` immediately), `fn(x)`
(single param), and `fn(x, y, z)` (multiple params separated by commas).

---

## Part 8: Infix Parse Functions

These handle tokens that appear BETWEEN two expressions.

### parseInfixExpression

```go
func (p *Parser) parseInfixExpression(left ast.Expression) ast.Expression {
    expression := &ast.InfixExpression{
        Token:    p.curToken,
        Operator: p.curToken.Literal,
        Left:     left,
    }

    precedence := p.curPrecedence()
    p.nextToken()
    expression.Right = p.parseExpression(precedence)

    return expression
}
```

It receives the already-parsed left side, saves the operator, advances, then parses the
right side with the CURRENT operator's precedence. This creates left-associativity: when
parsing the right of `+`, another `+` at the same level won't be absorbed (`4 < 4` is
false). So `1 + 2 + 3` produces `((1 + 2) + 3)` -- left-associative.

### parseCallExpression

```go
func (p *Parser) parseCallExpression(function ast.Expression) ast.Expression {
    exp := &ast.CallExpression{Token: p.curToken, Function: function}
    exp.Arguments = p.parseExpressionList(token.RPAREN)
    return exp
}

func (p *Parser) parseExpressionList(end token.TokenType) []ast.Expression {
    list := []ast.Expression{}

    if p.peekTokenIs(end) {
        p.nextToken()
        return list
    }

    p.nextToken()
    list = append(list, p.parseExpression(LOWEST))

    for p.peekTokenIs(token.COMMA) {
        p.nextToken()
        p.nextToken()
        list = append(list, p.parseExpression(LOWEST))
    }

    if !p.expectPeek(end) {
        return nil
    }

    return list
}
```

Call expressions are INFIX because `(` appears after an expression. In `add(1, 2)`, the
parser first parses `add` as an identifier (prefix), then sees `(` and calls
`parseCallExpression` with `Identifier("add")` as the left side. `CALL` has the highest
precedence so that `a + b(2)` parses as `a + (b(2))`, not `(a + b)(2)`.

`parseExpressionList` is a reusable helper for comma-separated expressions between
delimiters. We use it for call arguments and (later) array literals.

---

## Part 9: Testing the Parser

The best way to test a Pratt parser is with a table of inputs and expected `String()`
outputs. The parenthesized output makes precedence unambiguous:

```go
func TestOperatorPrecedenceParsing(t *testing.T) {
    tests := []struct {
        input    string
        expected string
    }{
        {"-a * b", "((-a) * b)"},
        {"!-a", "(!(-a))"},
        {"a + b + c", "((a + b) + c)"},
        {"a * b / c", "((a * b) / c)"},
        {"a + b / c", "(a + (b / c))"},
        {"a + b * c + d / e - f", "(((a + (b * c)) + (d / e)) - f)"},
        {"5 > 4 == 3 < 4", "((5 > 4) == (3 < 4))"},
        {"3 + 4 * 5 == 3 * 1 + 4 * 5", "((3 + (4 * 5)) == ((3 * 1) + (4 * 5)))"},
        {"1 + (2 + 3) + 4", "((1 + (2 + 3)) + 4)"},
        {"(5 + 5) * 2", "((5 + 5) * 2)"},
        {"-(5 + 5)", "(-(5 + 5))"},
        {"!(true == true)", "(!(true == true))"},
        {"a + add(b * c) + d", "((a + add((b * c))) + d)"},
        {"add(a, b, 1, 2 * 3, 4 + 5, add(6, 7 * 8))", "add(a, b, 1, (2 * 3), (4 + 5), add(6, (7 * 8)))"},
    }

    for _, tt := range tests {
        l := lexer.New(tt.input)
        p := New(l)
        program := p.ParseProgram()
        checkParserErrors(t, p)

        actual := program.String()
        if actual != tt.expected {
            t.Errorf("expected=%q, got=%q", tt.expected, actual)
        }
    }
}

func checkParserErrors(t *testing.T, p *Parser) {
    errors := p.Errors()
    if len(errors) == 0 {
        return
    }
    t.Errorf("parser has %d errors", len(errors))
    for _, msg := range errors {
        t.Errorf("parser error: %q", msg)
    }
    t.FailNow()
}
```

Look at `"a + b * c + d / e - f"` --> `"(((a + (b * c)) + (d / e)) - f)"`. This
verifies that `*` and `/` bind tighter than `+` and `-`, and that operators at the same
level are left-associative.

For individual node types, use type assertions to verify the AST structure directly:

```go
func TestCallExpressionParsing(t *testing.T) {
    input := "add(1, 2 * 3, 4 + 5)"

    l := lexer.New(input)
    p := New(l)
    program := p.ParseProgram()
    checkParserErrors(t, p)

    stmt, ok := program.Statements[0].(*ast.ExpressionStatement)
    if !ok {
        t.Fatalf("not *ast.ExpressionStatement, got %T", program.Statements[0])
    }

    exp, ok := stmt.Expression.(*ast.CallExpression)
    if !ok {
        t.Fatalf("not *ast.CallExpression, got %T", stmt.Expression)
    }

    if exp.Function.String() != "add" {
        t.Errorf("function: expected 'add', got %q", exp.Function.String())
    }

    if len(exp.Arguments) != 3 {
        t.Fatalf("expected 3 args, got %d", len(exp.Arguments))
    }
}
```

Apply the same pattern for `TestLetStatements`, `TestReturnStatements`,
`TestIfExpression`, and `TestFunctionLiteralParsing` -- parse input, assert the statement
count and type, then check the node's fields.

---

## Part 10: Tracing Through a Complex Example

For `let result = add(1, 2 * 3);`, the parser produces:

```
Program
  LetStatement
    Name: Identifier("result")
    Value: CallExpression
             Function: Identifier("add")
             Arguments:
               IntegerLiteral(1)
               InfixExpression(2 * 3)
```

The flow: `ParseProgram` sees `LET`, calls `parseLetStatement`. It reads the name
`result`, advances past `=`, then calls `parseExpression(LOWEST)`. That sees `add` (an
identifier, via prefix), then peeks `(` (precedence CALL = 7, which is > LOWEST = 1), so
it enters the infix loop and calls `parseCallExpression`. Inside, `parseExpressionList`
reads each argument: `1` is straightforward, `2 * 3` triggers another precedence
comparison that groups correctly.

---

## Why Pratt Parsing Is Elegant

Compare what we built to a grammar-driven recursive descent parser:

**Grammar-driven**: one function per precedence level. Adding a new operator at a new
precedence level means adding a new grammar rule and a new function. Six precedence levels
means six functions that call each other in a chain.

**Pratt**: one `parseExpression` function handles ALL precedence levels. Adding a new
operator means writing a parse function and adding one entry to the precedence table and
one entry to the registration map. Three lines of code.

The Pratt approach also handles things that are awkward in grammar-driven parsers:
- Prefix operators (`-x`) are just another prefix parse function
- Postfix operators (if we added `x++`) would be infix functions with no right operand
- Mixfix operators (like ternary `a ? b : c`) can be implemented as an infix function
  that parses `b` and `c` internally

The core loop is always the same: parse a prefix, then loop over infix operators ordered
by precedence. Everything else is just registering new functions in the maps.

---

## Key Takeaways

- **Pratt parsing** uses a precedence table instead of grammar-level rules. Higher
  precedence = tighter binding = deeper in the tree.

- **Prefix parse functions** handle tokens at the start of an expression (identifiers,
  numbers, `-`, `!`, `(`, `if`, `fn`).

- **Infix parse functions** handle tokens between expressions (`+`, `*`, `==`, `(`
  for calls). They receive the already-parsed left side.

- **`parseExpression(precedence)`** is the core. It parses a prefix, then loops over
  infix operators that bind tighter than `precedence`. The recursive calls with different
  precedence levels create the correct nesting.

- **Left-associativity** comes from using the current operator's precedence for the
  right-side parse. Same-precedence tokens don't get absorbed into the right side.

- **The registration maps** make the parser extensible. Adding new syntax means writing
  a parse function and registering it -- no structural changes needed.

---

## What's Next

You have a parser that builds an AST from source code. In the next lesson, we'll build
a **tree-walk interpreter** that evaluates that AST directly -- walking the tree node by
node and computing results. You'll be able to type `let x = 5; let y = x + 3; y` and
get back `8`.
