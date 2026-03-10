# Lesson 08: Tree-Walk Interpreters — Executing the AST Directly

You've got a lexer that turns source code into tokens and a parser that turns tokens
into an AST. Now you need something that actually *runs* the tree. That's the
interpreter.

## The Museum Tour Guide

A tree-walk interpreter is like a tour guide walking through a museum (the AST).
At each room (node), the guide explains what's there (evaluates it) and moves to
the next room in order. A room with a painting of the number `5` is easy — the guide
just says "this is 5." A room with a math problem `3 + 4` means the guide has to
visit the left room (3), the right room (4), combine them, and report "this is 7."

The guide doesn't skip rooms. They don't rearrange the museum. They walk the tree
top-down, left-to-right, evaluating as they go. That's tree-walking.

It's the simplest way to execute code. It's also the slowest — but it's where every
language implementation journey starts.

---

## What We're Building

By the end of this lesson, you'll have an evaluator that handles:
- Integer literals (`42`)
- Boolean literals (`true`, `false`)
- Prefix expressions (`!true`, `-5`)
- Infix expressions (`3 + 4`, `5 == 5`, `10 > 3`)
- Grouped expressions (`(2 + 3) * 4`)
- If/else expressions

We need two things: an **object system** (what values look like at runtime) and an
**Eval function** (what walks the tree and produces those values).

---

## Quick Recap: The AST from Lesson 07

Your parser produces these AST node types. Here are the key ones we'll evaluate:

```go
package ast

type Node interface {
    TokenLiteral() string
    String() string
}

type Statement interface { Node; statementNode() }
type Expression interface { Node; expressionNode() }

type Program struct { Statements []Statement }

type ExpressionStatement struct {
    Token      token.Token
    Expression Expression
}

type IntegerLiteral struct {
    Token token.Token
    Value int64
}

type BooleanLiteral struct {
    Token token.Token
    Value bool
}

type PrefixExpression struct {
    Token    token.Token
    Operator string
    Right    Expression
}

type InfixExpression struct {
    Token    token.Token
    Left     Expression
    Operator string
    Right    Expression
}

type IfExpression struct {
    Token       token.Token
    Condition   Expression
    Consequence *BlockStatement
    Alternative *BlockStatement
}

type BlockStatement struct {
    Token      token.Token
    Statements []Statement
}
```

Each type implements the `Node` interface methods (`TokenLiteral()`, `String()`).
If this is unfamiliar, revisit lesson 07. The parser builds these. Now we evaluate them.

---

## The Object System

When Go evaluates `3 + 4`, the result isn't an AST node — it's the value `7`.
We need a type system for runtime values. In Go, you'd use `int`, `bool`, `string`.
In our interpreter, we use our own object system.

Think of AST nodes as the *recipe* and objects as the *food*. The parser writes
the recipe. The evaluator follows it and produces food.

```go
package object

import "fmt"

type ObjectType string

const (
    INTEGER_OBJ      ObjectType = "INTEGER"
    BOOLEAN_OBJ      ObjectType = "BOOLEAN"
    NULL_OBJ         ObjectType = "NULL"
    RETURN_VALUE_OBJ ObjectType = "RETURN_VALUE"
    ERROR_OBJ        ObjectType = "ERROR"
    FUNCTION_OBJ     ObjectType = "FUNCTION"
    STRING_OBJ       ObjectType = "STRING"
    ARRAY_OBJ        ObjectType = "ARRAY"
    HASH_OBJ         ObjectType = "HASH"
)

type Object interface {
    Type() ObjectType
    Inspect() string
}

type Integer struct {
    Value int64
}

func (i *Integer) Type() ObjectType { return INTEGER_OBJ }
func (i *Integer) Inspect() string  { return fmt.Sprintf("%d", i.Value) }

type Boolean struct {
    Value bool
}

func (b *Boolean) Type() ObjectType { return BOOLEAN_OBJ }
func (b *Boolean) Inspect() string  { return fmt.Sprintf("%t", b.Value) }

type Null struct{}

func (n *Null) Type() ObjectType { return NULL_OBJ }
func (n *Null) Inspect() string  { return "null" }

type ReturnValue struct {
    Value Object
}

func (rv *ReturnValue) Type() ObjectType { return RETURN_VALUE_OBJ }
func (rv *ReturnValue) Inspect() string  { return rv.Value.Inspect() }

type Error struct {
    Message string
}

func (e *Error) Type() ObjectType { return ERROR_OBJ }
func (e *Error) Inspect() string  { return "ERROR: " + e.Message }

type String struct {
    Value string
}

func (s *String) Type() ObjectType { return STRING_OBJ }
func (s *String) Inspect() string  { return s.Value }
```

We'll add `Function`, `Array`, and `Hash` in later lessons when we need them.

### Singleton Objects

For `true`, `false`, and `null`, we don't need new instances every time. One `true`
is the same as every other `true`. We use singletons:

```go
var (
    TRUE  = &Boolean{Value: true}
    FALSE = &Boolean{Value: false}
    NULL  = &Null{}
)
```

This is like how Go's `true` and `false` are built-in constants. Every time your
code says `true`, it's the same `true`. We do the same thing.

---

## The Eval Function

This is the heart of the interpreter. It takes an AST node and returns an object.
Every node type gets its own evaluation logic.

```go
package evaluator

import (
    "fmt"
    "monkey/ast"
    "monkey/object"
)

func Eval(node ast.Node) object.Object {
    switch node := node.(type) {
    case *ast.Program:
        return evalProgram(node)

    case *ast.ExpressionStatement:
        return Eval(node.Expression)

    case *ast.IntegerLiteral:
        return &object.Integer{Value: node.Value}

    case *ast.BooleanLiteral:
        return nativeBoolToBooleanObject(node.Value)

    case *ast.PrefixExpression:
        right := Eval(node.Right)
        if isError(right) {
            return right
        }
        return evalPrefixExpression(node.Operator, right)

    case *ast.InfixExpression:
        left := Eval(node.Left)
        if isError(left) {
            return left
        }
        right := Eval(node.Right)
        if isError(right) {
            return right
        }
        return evalInfixExpression(node.Operator, left, right)

    case *ast.BlockStatement:
        return evalBlockStatement(node)

    case *ast.IfExpression:
        return evalIfExpression(node)

    default:
        return newError("unknown node type: %T", node)
    }
}
```

Notice the pattern: for simple nodes (integers, booleans), we produce values directly.
For compound nodes (prefix, infix), we evaluate the children first, then combine them.
This is the tree-walk — recursion does the walking for us.

---

## Evaluating Programs and Blocks

A program is a list of statements. We evaluate them in order and return the last result:

```go
func evalProgram(program *ast.Program) object.Object {
    var result object.Object

    for _, statement := range program.Statements {
        result = Eval(statement)

        switch result := result.(type) {
        case *object.ReturnValue:
            return result.Value
        case *object.Error:
            return result
        }
    }

    return result
}

func evalBlockStatement(block *ast.BlockStatement) object.Object {
    var result object.Object

    for _, statement := range block.Statements {
        result = Eval(statement)

        if result != nil {
            rt := result.Type()
            if rt == object.RETURN_VALUE_OBJ || rt == object.ERROR_OBJ {
                return result
            }
        }
    }

    return result
}
```

The difference between `evalProgram` and `evalBlockStatement` is subtle but critical.
`evalProgram` *unwraps* return values — it extracts the inner value. `evalBlockStatement`
does *not* unwrap — it passes the `ReturnValue` wrapper up so it can bubble through
nested blocks. Think of `ReturnValue` as a package marked "urgent" that gets passed
up the chain until it reaches the top floor (the program level), where it gets opened.

---

## Prefix Expressions

Prefix operators go in front: `!true`, `-5`. Two operators, two behaviors:

```go
func evalPrefixExpression(operator string, right object.Object) object.Object {
    switch operator {
    case "!":
        return evalBangOperatorExpression(right)
    case "-":
        return evalMinusPrefixOperatorExpression(right)
    default:
        return newError("unknown operator: %s%s", operator, right.Type())
    }
}

func evalBangOperatorExpression(right object.Object) object.Object {
    switch right {
    case object.TRUE:
        return object.FALSE
    case object.FALSE:
        return object.TRUE
    case object.NULL:
        return object.TRUE
    default:
        return object.FALSE
    }
}

func evalMinusPrefixOperatorExpression(right object.Object) object.Object {
    if right.Type() != object.INTEGER_OBJ {
        return newError("unknown operator: -%s", right.Type())
    }

    value := right.(*object.Integer).Value
    return &object.Integer{Value: -value}
}
```

The bang operator (`!`) flips booleans and treats `null` as falsy. Everything else
is truthy — `!5` is `false`, `!0` is `false`. This matches JavaScript's behavior
(and annoys people who want `!0` to be `true`). We'll revisit truthiness in lesson 10.

The minus operator (`-`) only works on integers. `-true` is an error. Defensive
programming: check the type before you cast.

---

## Infix Expressions

Infix operators sit between two values: `3 + 4`, `5 == true`. We handle three
categories: integer arithmetic, integer comparisons, and boolean comparisons.

```go
func evalInfixExpression(
    operator string,
    left, right object.Object,
) object.Object {
    switch {
    case left.Type() == object.INTEGER_OBJ && right.Type() == object.INTEGER_OBJ:
        return evalIntegerInfixExpression(operator, left, right)

    case operator == "==":
        return nativeBoolToBooleanObject(left == right)

    case operator == "!=":
        return nativeBoolToBooleanObject(left != right)

    case left.Type() != right.Type():
        return newError("type mismatch: %s %s %s",
            left.Type(), operator, right.Type())

    default:
        return newError("unknown operator: %s %s %s",
            left.Type(), operator, right.Type())
    }
}
```

The `==` and `!=` cases use Go's pointer comparison. Since we use singletons for
`TRUE`, `FALSE`, and `NULL`, pointer comparison works: `TRUE == TRUE` is `true`
because they're the same pointer. For integers, we need value comparison, so we
handle them separately.

This is a trick you've seen in Go: `nil == nil` works because it's pointer comparison.
Same idea here.

```go
func evalIntegerInfixExpression(
    operator string,
    left, right object.Object,
) object.Object {
    leftVal := left.(*object.Integer).Value
    rightVal := right.(*object.Integer).Value

    switch operator {
    case "+":
        return &object.Integer{Value: leftVal + rightVal}
    case "-":
        return &object.Integer{Value: leftVal - rightVal}
    case "*":
        return &object.Integer{Value: leftVal * rightVal}
    case "/":
        if rightVal == 0 {
            return newError("division by zero")
        }
        return &object.Integer{Value: leftVal / rightVal}
    case "<":
        return nativeBoolToBooleanObject(leftVal < rightVal)
    case ">":
        return nativeBoolToBooleanObject(leftVal > rightVal)
    case "==":
        return nativeBoolToBooleanObject(leftVal == rightVal)
    case "!=":
        return nativeBoolToBooleanObject(leftVal != rightVal)
    default:
        return newError("unknown operator: %s %s %s",
            left.Type(), operator, right.Type())
    }
}
```

Division by zero returns an error instead of panicking. Defensive programming.
In Go, integer division by zero panics. In our language, it returns a clean error.

---

## If/Else Expressions

In our language, `if/else` is an expression — it produces a value. Like Go's
ternary operator that doesn't exist, except ours does:

```
if (10 > 5) { 1 } else { 2 }
```

This evaluates to `1`.

```go
func evalIfExpression(ie *ast.IfExpression) object.Object {
    condition := Eval(ie.Condition)
    if isError(condition) {
        return condition
    }

    if isTruthy(condition) {
        return Eval(ie.Consequence)
    } else if ie.Alternative != nil {
        return Eval(ie.Alternative)
    } else {
        return object.NULL
    }
}

func isTruthy(obj object.Object) bool {
    switch obj {
    case object.NULL:
        return false
    case object.TRUE:
        return true
    case object.FALSE:
        return false
    default:
        return true
    }
}
```

If there's no `else` branch and the condition is false, we return `NULL`. This is
like how a Go function returns the zero value if you don't explicitly return — our
zero value is `null`.

---

## Helper Functions

```go
func nativeBoolToBooleanObject(input bool) *object.Boolean {
    if input {
        return object.TRUE
    }
    return object.FALSE
}

func newError(format string, a ...interface{}) *object.Error {
    return &object.Error{Message: fmt.Sprintf(format, a...)}
}

func isError(obj object.Object) bool {
    if obj != nil {
        return obj.Type() == object.ERROR_OBJ
    }
    return false
}
```

`isError` checks before every recursive Eval call. Errors propagate upward like
Go's `if err != nil { return err }` pattern. Same idea, different syntax.

---

## Testing the Evaluator

Testing an evaluator follows the same pattern every time: parse the input, evaluate
the AST, check the result. Here's the test helper and tests:

```go
package evaluator

import (
    "monkey/lexer"
    "monkey/object"
    "monkey/parser"
    "testing"
)

func testEval(input string) object.Object {
    l := lexer.New(input)
    p := parser.New(l)
    program := p.ParseProgram()
    return Eval(program)
}

func testIntegerObject(t *testing.T, obj object.Object, expected int64) bool {
    t.Helper()
    result, ok := obj.(*object.Integer)
    if !ok {
        t.Errorf("object is not Integer. got=%T (%+v)", obj, obj)
        return false
    }
    if result.Value != expected {
        t.Errorf("object has wrong value. got=%d, want=%d", result.Value, expected)
        return false
    }
    return true
}

func TestEvalIntegerExpression(t *testing.T) {
    tests := []struct {
        input    string
        expected int64
    }{
        {"5", 5},
        {"-5", -5},
        {"5 + 5 + 5 + 5 - 10", 10},
        {"2 * 2 * 2 * 2 * 2", 32},
        {"5 + 2 * 10", 25},
        {"2 * (5 + 10)", 30},
        {"(5 + 10 * 2 + 15 / 3) * 2 + -10", 50},
    }

    for _, tt := range tests {
        testIntegerObject(t, testEval(tt.input), tt.expected)
    }
}

func TestEvalBooleanExpression(t *testing.T) {
    tests := []struct {
        input    string
        expected bool
    }{
        {"true", true},
        {"false", false},
        {"1 < 2", true},
        {"1 == 1", true},
        {"1 != 2", true},
        {"true == true", true},
        {"true == false", false},
        {"(1 < 2) == true", true},
    }

    for _, tt := range tests {
        result := testEval(tt.input).(*object.Boolean)
        if result.Value != tt.expected {
            t.Errorf("for %q: expected %t, got %t", tt.input, tt.expected, result.Value)
        }
    }
}

func TestBangOperator(t *testing.T) {
    tests := []struct {
        input    string
        expected bool
    }{
        {"!true", false},
        {"!false", true},
        {"!5", false},
        {"!!true", true},
    }

    for _, tt := range tests {
        result := testEval(tt.input).(*object.Boolean)
        if result.Value != tt.expected {
            t.Errorf("for %q: expected %t, got %t", tt.input, tt.expected, result.Value)
        }
    }
}

func TestIfElseExpressions(t *testing.T) {
    tests := []struct {
        input    string
        expected interface{}
    }{
        {"if (true) { 10 }", 10},
        {"if (false) { 10 }", nil},
        {"if (1 < 2) { 10 }", 10},
        {"if (1 > 2) { 10 } else { 20 }", 20},
        {"if (1 < 2) { 10 } else { 20 }", 10},
    }

    for _, tt := range tests {
        evaluated := testEval(tt.input)
        if integer, ok := tt.expected.(int); ok {
            testIntegerObject(t, evaluated, int64(integer))
        } else if evaluated != object.NULL {
            t.Errorf("expected NULL, got %T", evaluated)
        }
    }
}

func TestErrorHandling(t *testing.T) {
    tests := []struct {
        input           string
        expectedMessage string
    }{
        {"5 + true;", "type mismatch: INTEGER + BOOLEAN"},
        {"-true", "unknown operator: -BOOLEAN"},
        {"true + false;", "unknown operator: BOOLEAN + BOOLEAN"},
    }

    for _, tt := range tests {
        errObj := testEval(tt.input).(*object.Error)
        if errObj.Message != tt.expectedMessage {
            t.Errorf("wrong error message. expected=%q, got=%q",
                tt.expectedMessage, errObj.Message)
        }
    }
}
```

---

## How It All Connects

For `3 + 4 * 2`: the parser already built a tree where `4 * 2` is a subtree of
the `+` node (because `*` has higher precedence). The evaluator walks this tree:
evaluate left (`3`), evaluate right (which recurses: evaluate `4`, evaluate `2`,
multiply to get `8`), add to get `11`. The evaluator doesn't know about precedence.
It just walks the tree the parser built. Separation of concerns.

---

## Exercises

1. **Add modulo operator**: Support `%` for integer modulo. `10 % 3` should evaluate
   to `1`. You'll need to add it to the lexer (new token), parser (infix operator with
   same precedence as `*` and `/`), and evaluator.

2. **String concatenation**: Add support for `"hello" + " " + "world"`. You need
   a `StringLiteral` AST node and a case in `evalInfixExpression` for when both
   operands are strings.

3. **Comparison chains**: What happens with `1 < 2 < 3`? Trace through the evaluator
   by hand. Why does it evaluate to `true` even though our language doesn't support
   chained comparisons? (Hint: `1 < 2` is `true`, and `true < 3` is... what?)

4. **Power operator**: Add `**` for exponentiation. `2 ** 10` should evaluate to
   `1024`. Think about what precedence it should have (higher than `*`?).

5. **Negative division**: What does `-7 / 2` evaluate to in our interpreter? What
   does it evaluate to in Go? In Python? Why are they different? Add a test for
   this case.

---

## Key Takeaways

- A tree-walk interpreter evaluates the AST by recursively visiting each node
- The object system represents runtime values (Integer, Boolean, Null, Error)
- Singleton objects (TRUE, FALSE, NULL) avoid unnecessary allocations
- Errors propagate upward through `isError` checks — same pattern as Go's error handling
- The evaluator doesn't know about precedence — the parser already encoded it in the tree structure
- If/else is an expression that returns a value; no else branch returns null

Next lesson: variables, environments, and scope — making our language remember things.
