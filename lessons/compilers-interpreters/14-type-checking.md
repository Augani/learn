# Lesson 14: Type Checking — Catching Errors Before Runtime

## What a Type Checker Does

A type checker walks your AST and verifies that every operation makes sense according to the type rules. It runs after parsing, before execution or compilation.

Without a type checker:

```
"hello" + 5   →   crash at runtime (or worse, silent wrong answer)
```

With a type checker:

```
"hello" + 5   →   compile error: cannot add string and integer
```

## The Manuscript Editor Analogy

A type checker is like an editor reviewing a manuscript before publication:

- **Nouns agree with verbs** — types match their operations. You do not "multiply" a name.
- **Pronouns have clear antecedents** — variables are declared before use, and their types are known.
- **The narrative is consistent** — a function that promises to return a number actually returns a number, not a string.
- **Metaphors do not mix** — you cannot use the result of a comparison (boolean) as a number in arithmetic.

The editor catches these problems *before* the book is printed. The reader (runtime) never sees them.

## Type Environments

Just like our interpreter used environments to track variable *values*, a type checker uses type environments to track variable *types*.

```
Value Environment (runtime):     Type Environment (compile time):
┌──────────────────────────┐     ┌──────────────────────────┐
│  x  →  42                │     │  x  →  int               │
│  y  →  "hello"           │     │  y  →  string            │
│  add → <function>        │     │  add → (int, int) → int  │
└──────────────────────────┘     └──────────────────────────┘
```

The type environment does not store values — it stores what *kind* of value each name holds. When you write `x + y`, the type checker looks up `x → int` and `y → string`, sees that `+` does not work on `(int, string)`, and reports an error.

## Type Rules

Type rules define what operations produce what types:

```
Integer Arithmetic:
  int + int → int
  int - int → int
  int * int → int
  int / int → int

String Operations:
  string + string → string    (concatenation)

Comparisons:
  int == int → bool
  int < int → bool
  string == string → bool

Boolean Logic:
  bool && bool → bool
  bool || bool → bool
  !bool → bool

Errors:
  int + string → TYPE ERROR
  int + bool → TYPE ERROR
  string - string → TYPE ERROR
```

These rules are the heart of the type checker. Every language defines its own rules. Go is strict (no implicit coercion). JavaScript is loose (`5 + "hello"` becomes `"5hello"`).

## Adding Type Annotations to Our Language

Let us extend the language we have been building. We will add type annotations to variable declarations and function signatures.

Before (untyped):

```
let x = 5;
let greet = fn(name) { return "hello " + name; };
```

After (typed):

```
let x: int = 5;
let greet = fn(name: string) -> string { return "hello " + name; };
```

### Extending the AST

We need new fields on our AST nodes to carry type information:

```go
package ast

type TypeAnnotation struct {
    Name string
}

type LetStatement struct {
    Token    token.Token
    Name     *Identifier
    TypeAnno *TypeAnnotation
    Value    Expression
}

type FunctionParameter struct {
    Name     *Identifier
    TypeAnno *TypeAnnotation
}

type FunctionLiteral struct {
    Token      token.Token
    Parameters []*FunctionParameter
    ReturnType *TypeAnnotation
    Body       *BlockStatement
}
```

## Defining Types

First, we define how types are represented inside the type checker:

```go
package typechecker

type Type interface {
    TypeName() string
    Equals(other Type) bool
}

type IntType struct{}

func (t *IntType) TypeName() string          { return "int" }
func (t *IntType) Equals(other Type) bool {
    _, ok := other.(*IntType)
    return ok
}

type StringType struct{}

func (t *StringType) TypeName() string          { return "string" }
func (t *StringType) Equals(other Type) bool {
    _, ok := other.(*StringType)
    return ok
}

type BoolType struct{}

func (t *BoolType) TypeName() string          { return "bool" }
func (t *BoolType) Equals(other Type) bool {
    _, ok := other.(*BoolType)
    return ok
}

type FunctionType struct {
    ParamTypes []Type
    ReturnType Type
}

func (t *FunctionType) TypeName() string {
    params := ""
    for i, p := range t.ParamTypes {
        if i > 0 {
            params += ", "
        }
        params += p.TypeName()
    }
    return "fn(" + params + ") -> " + t.ReturnType.TypeName()
}

func (t *FunctionType) Equals(other Type) bool {
    otherFn, ok := other.(*FunctionType)
    if !ok {
        return false
    }
    if len(t.ParamTypes) != len(otherFn.ParamTypes) {
        return false
    }
    for i, param := range t.ParamTypes {
        if !param.Equals(otherFn.ParamTypes[i]) {
            return false
        }
    }
    return t.ReturnType.Equals(otherFn.ReturnType)
}

type NullType struct{}

func (t *NullType) TypeName() string       { return "null" }
func (t *NullType) Equals(other Type) bool {
    _, ok := other.(*NullType)
    return ok
}
```

## The Type Environment

```go
package typechecker

import "fmt"

type TypeEnvironment struct {
    store  map[string]Type
    outer  *TypeEnvironment
}

func NewTypeEnvironment() *TypeEnvironment {
    return &TypeEnvironment{
        store: make(map[string]Type),
        outer: nil,
    }
}

func NewEnclosedTypeEnvironment(outer *TypeEnvironment) *TypeEnvironment {
    return &TypeEnvironment{
        store: make(map[string]Type),
        outer: outer,
    }
}

func (e *TypeEnvironment) Get(name string) (Type, error) {
    typ, ok := e.store[name]
    if !ok && e.outer != nil {
        return e.outer.Get(name)
    }
    if !ok {
        return nil, fmt.Errorf("undefined variable: %s", name)
    }
    return typ, nil
}

func (e *TypeEnvironment) Set(name string, typ Type) {
    e.store[name] = typ
}
```

This mirrors the environment from our interpreter (Lesson 9), but stores types instead of values.

## Building the Type Checker

The type checker is a visitor that walks the AST. For each node, it returns the type of that node or an error.

```go
package typechecker

import (
    "fmt"
    "monkey/ast"
)

type TypeError struct {
    Message string
    Line    int
    Column  int
}

func (e *TypeError) Error() string {
    return fmt.Sprintf("TypeError [%d:%d]: %s", e.Line, e.Column, e.Message)
}

type Checker struct {
    env    *TypeEnvironment
    errors []TypeError
}

func New() *Checker {
    return &Checker{
        env:    NewTypeEnvironment(),
        errors: []TypeError{},
    }
}

func (c *Checker) Errors() []TypeError {
    return c.errors
}

func (c *Checker) addError(msg string) {
    c.errors = append(c.errors, TypeError{Message: msg})
}

func (c *Checker) Check(node ast.Node) Type {
    switch node := node.(type) {
    case *ast.Program:
        return c.checkProgram(node)
    case *ast.ExpressionStatement:
        return c.Check(node.Expression)
    case *ast.IntegerLiteral:
        return &IntType{}
    case *ast.StringLiteral:
        return &StringType{}
    case *ast.Boolean:
        return &BoolType{}
    case *ast.PrefixExpression:
        return c.checkPrefix(node)
    case *ast.InfixExpression:
        return c.checkInfix(node)
    case *ast.LetStatement:
        return c.checkLet(node)
    case *ast.Identifier:
        return c.checkIdentifier(node)
    case *ast.IfExpression:
        return c.checkIf(node)
    case *ast.FunctionLiteral:
        return c.checkFunction(node)
    case *ast.CallExpression:
        return c.checkCall(node)
    case *ast.ReturnStatement:
        return c.Check(node.ReturnValue)
    default:
        c.addError(fmt.Sprintf("unknown node type: %T", node))
        return nil
    }
}
```

## Checking Individual Node Types

### Integer and String Literals

The simplest cases. An integer literal has type `int`. A string literal has type `string`.

```go
case *ast.IntegerLiteral:
    return &IntType{}
case *ast.StringLiteral:
    return &StringType{}
```

No checking needed — literals always have a known type.

### Infix Expressions (The Core Logic)

This is where the real type checking happens:

```go
func (c *Checker) checkInfix(node *ast.InfixExpression) Type {
    leftType := c.Check(node.Left)
    rightType := c.Check(node.Right)

    if leftType == nil || rightType == nil {
        return nil
    }

    switch node.Operator {
    case "+":
        return c.checkAddition(leftType, rightType)
    case "-", "*", "/":
        return c.checkArithmetic(node.Operator, leftType, rightType)
    case "==", "!=":
        return c.checkEquality(leftType, rightType)
    case "<", ">", "<=", ">=":
        return c.checkComparison(leftType, rightType)
    default:
        c.addError(fmt.Sprintf("unknown operator: %s", node.Operator))
        return nil
    }
}

func (c *Checker) checkAddition(left, right Type) Type {
    if _, ok := left.(*IntType); ok {
        if _, ok := right.(*IntType); ok {
            return &IntType{}
        }
    }

    if _, ok := left.(*StringType); ok {
        if _, ok := right.(*StringType); ok {
            return &StringType{}
        }
    }

    c.addError(fmt.Sprintf(
        "cannot use + with %s and %s",
        left.TypeName(), right.TypeName(),
    ))
    return nil
}

func (c *Checker) checkArithmetic(op string, left, right Type) Type {
    _, leftInt := left.(*IntType)
    _, rightInt := right.(*IntType)

    if !leftInt || !rightInt {
        c.addError(fmt.Sprintf(
            "cannot use %s with %s and %s",
            op, left.TypeName(), right.TypeName(),
        ))
        return nil
    }
    return &IntType{}
}

func (c *Checker) checkEquality(left, right Type) Type {
    if !left.Equals(right) {
        c.addError(fmt.Sprintf(
            "cannot compare %s and %s",
            left.TypeName(), right.TypeName(),
        ))
        return nil
    }
    return &BoolType{}
}

func (c *Checker) checkComparison(left, right Type) Type {
    _, leftInt := left.(*IntType)
    _, rightInt := right.(*IntType)

    if !leftInt || !rightInt {
        c.addError(fmt.Sprintf(
            "cannot compare %s and %s with ordering operators",
            left.TypeName(), right.TypeName(),
        ))
        return nil
    }
    return &BoolType{}
}
```

Now `"hello" + 5` is caught:

```
TypeError: cannot use + with string and int
```

### Prefix Expressions

```go
func (c *Checker) checkPrefix(node *ast.PrefixExpression) Type {
    rightType := c.Check(node.Right)
    if rightType == nil {
        return nil
    }

    switch node.Operator {
    case "-":
        if _, ok := rightType.(*IntType); !ok {
            c.addError(fmt.Sprintf("cannot negate %s", rightType.TypeName()))
            return nil
        }
        return &IntType{}
    case "!":
        if _, ok := rightType.(*BoolType); !ok {
            c.addError(fmt.Sprintf("cannot apply ! to %s", rightType.TypeName()))
            return nil
        }
        return &BoolType{}
    default:
        c.addError(fmt.Sprintf("unknown prefix operator: %s", node.Operator))
        return nil
    }
}
```

### Let Statements

When a variable is declared, we check that the value's type matches the annotation (if present) and record the type in the environment:

```go
func (c *Checker) checkLet(node *ast.LetStatement) Type {
    valueType := c.Check(node.Value)
    if valueType == nil {
        return nil
    }

    if node.TypeAnno != nil {
        declaredType := c.resolveTypeAnnotation(node.TypeAnno)
        if declaredType != nil && !declaredType.Equals(valueType) {
            c.addError(fmt.Sprintf(
                "type mismatch: declared %s but got %s",
                declaredType.TypeName(), valueType.TypeName(),
            ))
            return nil
        }
    }

    c.env.Set(node.Name.Value, valueType)
    return valueType
}

func (c *Checker) resolveTypeAnnotation(anno *ast.TypeAnnotation) Type {
    switch anno.Name {
    case "int":
        return &IntType{}
    case "string":
        return &StringType{}
    case "bool":
        return &BoolType{}
    default:
        c.addError(fmt.Sprintf("unknown type: %s", anno.Name))
        return nil
    }
}
```

### Identifiers

Look up the type in the environment:

```go
func (c *Checker) checkIdentifier(node *ast.Identifier) Type {
    typ, err := c.env.Get(node.Value)
    if err != nil {
        c.addError(err.Error())
        return nil
    }
    return typ
}
```

### If Expressions

The condition must be a boolean. Both branches must return the same type (since `if` is an expression in our language):

```go
func (c *Checker) checkIf(node *ast.IfExpression) Type {
    condType := c.Check(node.Condition)
    if condType != nil {
        if _, ok := condType.(*BoolType); !ok {
            c.addError(fmt.Sprintf(
                "condition must be bool, got %s",
                condType.TypeName(),
            ))
        }
    }

    consequenceType := c.checkBlockStatement(node.Consequence)

    if node.Alternative != nil {
        alternativeType := c.checkBlockStatement(node.Alternative)
        if consequenceType != nil && alternativeType != nil {
            if !consequenceType.Equals(alternativeType) {
                c.addError(fmt.Sprintf(
                    "if branches have different types: %s and %s",
                    consequenceType.TypeName(), alternativeType.TypeName(),
                ))
            }
        }
        return consequenceType
    }

    return consequenceType
}

func (c *Checker) checkBlockStatement(block *ast.BlockStatement) Type {
    var result Type
    for _, stmt := range block.Statements {
        result = c.Check(stmt)
    }
    return result
}
```

### Functions

Functions create a new scope. Parameters are added to the inner type environment. The body is checked in that new scope:

```go
func (c *Checker) checkFunction(node *ast.FunctionLiteral) Type {
    innerEnv := NewEnclosedTypeEnvironment(c.env)
    outerEnv := c.env
    c.env = innerEnv

    paramTypes := make([]Type, len(node.Parameters))
    for i, param := range node.Parameters {
        if param.TypeAnno == nil {
            c.addError(fmt.Sprintf(
                "parameter %s must have a type annotation",
                param.Name.Value,
            ))
            paramTypes[i] = nil
            continue
        }
        paramType := c.resolveTypeAnnotation(param.TypeAnno)
        paramTypes[i] = paramType
        if paramType != nil {
            c.env.Set(param.Name.Value, paramType)
        }
    }

    bodyType := c.checkBlockStatement(node.Body)

    var returnType Type
    if node.ReturnType != nil {
        returnType = c.resolveTypeAnnotation(node.ReturnType)
        if returnType != nil && bodyType != nil && !returnType.Equals(bodyType) {
            c.addError(fmt.Sprintf(
                "function declares return type %s but returns %s",
                returnType.TypeName(), bodyType.TypeName(),
            ))
        }
    } else {
        returnType = bodyType
    }

    c.env = outerEnv

    return &FunctionType{
        ParamTypes: paramTypes,
        ReturnType: returnType,
    }
}
```

### Function Calls

Check that the callee is a function, the argument count matches, and each argument type matches the parameter type:

```go
func (c *Checker) checkCall(node *ast.CallExpression) Type {
    calleeType := c.Check(node.Function)
    if calleeType == nil {
        return nil
    }

    fnType, ok := calleeType.(*FunctionType)
    if !ok {
        c.addError(fmt.Sprintf(
            "cannot call %s — not a function",
            calleeType.TypeName(),
        ))
        return nil
    }

    if len(node.Arguments) != len(fnType.ParamTypes) {
        c.addError(fmt.Sprintf(
            "expected %d arguments, got %d",
            len(fnType.ParamTypes), len(node.Arguments),
        ))
        return nil
    }

    for i, arg := range node.Arguments {
        argType := c.Check(arg)
        if argType == nil {
            continue
        }
        expectedType := fnType.ParamTypes[i]
        if expectedType != nil && !expectedType.Equals(argType) {
            c.addError(fmt.Sprintf(
                "argument %d: expected %s, got %s",
                i+1, expectedType.TypeName(), argType.TypeName(),
            ))
        }
    }

    return fnType.ReturnType
}

func (c *Checker) checkProgram(program *ast.Program) Type {
    var result Type
    for _, stmt := range program.Statements {
        result = c.Check(stmt)
    }
    return result
}
```

## Type Narrowing

TypeScript pioneered a powerful idea: if you check a type at runtime, the compiler narrows the type inside that branch.

```typescript
function process(value: string | number | null) {
    // Here, value is: string | number | null

    if (value === null) {
        return;
    }
    // Here, value is: string | number (null eliminated)

    if (typeof value === "string") {
        console.log(value.toUpperCase());
        // Here, value is: string
    } else {
        console.log(value * 2);
        // Here, value is: number
    }
}
```

The compiler tracks which types have been eliminated by each condition. This is possible because TypeScript has union types — a value can be "string or number."

### Implementing Simple Type Narrowing

We can add basic null-checking narrowing to our type checker:

```go
type NullableType struct {
    Inner Type
}

func (t *NullableType) TypeName() string {
    return t.Inner.TypeName() + "?"
}

func (t *NullableType) Equals(other Type) bool {
    otherNullable, ok := other.(*NullableType)
    if ok {
        return t.Inner.Equals(otherNullable.Inner)
    }
    return t.Inner.Equals(other)
}

func (c *Checker) checkIfWithNarrowing(node *ast.IfExpression) Type {
    if isNullCheck(node.Condition) {
        varName := extractCheckedVariable(node.Condition)
        currentType, err := c.env.Get(varName)
        if err == nil {
            if nullable, ok := currentType.(*NullableType); ok {
                innerEnv := NewEnclosedTypeEnvironment(c.env)
                innerEnv.Set(varName, nullable.Inner)
                outerEnv := c.env
                c.env = innerEnv
                result := c.checkBlockStatement(node.Consequence)
                c.env = outerEnv
                return result
            }
        }
    }
    return c.checkIf(node)
}
```

Inside the `if x != null` block, `x` is narrowed from `int?` to `int`, so you can use it without null checks.

## Generic Type Instantiation

When checking a call to a generic function, the type checker must **instantiate** the generic — replacing type parameters with concrete types.

Conceptually:

```
Generic definition:   fn max<T: Comparable>(a: T, b: T) -> T
Call:                  max(5, 10)
Instantiation:        T = int, so signature becomes fn(a: int, b: int) -> int
```

A basic implementation:

```go
type GenericType struct {
    Name        string
    TypeParams  []string
    ParamTypes  []Type
    ReturnType  Type
}

type TypeVariable struct {
    Name string
}

func (t *TypeVariable) TypeName() string       { return t.Name }
func (t *TypeVariable) Equals(other Type) bool {
    otherTV, ok := other.(*TypeVariable)
    return ok && t.Name == otherTV.Name
}

func instantiateGeneric(generic *GenericType, concreteArgs []Type) *FunctionType {
    bindings := make(map[string]Type)
    for i, param := range generic.ParamTypes {
        if tv, ok := param.(*TypeVariable); ok {
            if i < len(concreteArgs) {
                bindings[tv.Name] = concreteArgs[i]
            }
        }
    }

    resolvedParams := make([]Type, len(generic.ParamTypes))
    for i, param := range generic.ParamTypes {
        resolvedParams[i] = resolveTypeVars(param, bindings)
    }

    return &FunctionType{
        ParamTypes: resolvedParams,
        ReturnType: resolveTypeVars(generic.ReturnType, bindings),
    }
}

func resolveTypeVars(typ Type, bindings map[string]Type) Type {
    if tv, ok := typ.(*TypeVariable); ok {
        if bound, exists := bindings[tv.Name]; exists {
            return bound
        }
    }
    return typ
}
```

## Putting It All Together: Full Test

```go
package typechecker

import (
    "monkey/lexer"
    "monkey/parser"
    "testing"
)

func TestTypeChecker_IntegerArithmetic(t *testing.T) {
    input := `5 + 10`
    checker := checkInput(t, input)
    expectNoErrors(t, checker)
}

func TestTypeChecker_StringConcatenation(t *testing.T) {
    input := `"hello" + " world"`
    checker := checkInput(t, input)
    expectNoErrors(t, checker)
}

func TestTypeChecker_TypeMismatch(t *testing.T) {
    input := `"hello" + 5`
    checker := checkInput(t, input)
    expectError(t, checker, "cannot use + with string and int")
}

func TestTypeChecker_VariableUsage(t *testing.T) {
    input := `
    let x: int = 10;
    let y: int = 20;
    x + y
    `
    checker := checkInput(t, input)
    expectNoErrors(t, checker)
}

func TestTypeChecker_VariableTypeMismatch(t *testing.T) {
    input := `let x: int = "hello";`
    checker := checkInput(t, input)
    expectError(t, checker, "type mismatch: declared int but got string")
}

func TestTypeChecker_FunctionTypeCheck(t *testing.T) {
    input := `
    let add = fn(a: int, b: int) -> int { a + b };
    add(5, 10)
    `
    checker := checkInput(t, input)
    expectNoErrors(t, checker)
}

func TestTypeChecker_FunctionArgMismatch(t *testing.T) {
    input := `
    let add = fn(a: int, b: int) -> int { a + b };
    add(5, "hello")
    `
    checker := checkInput(t, input)
    expectError(t, checker, "argument 2: expected int, got string")
}

func TestTypeChecker_ConditionMustBeBool(t *testing.T) {
    input := `if (5 + 3) { 1 }`
    checker := checkInput(t, input)
    expectError(t, checker, "condition must be bool, got int")
}

func TestTypeChecker_ReturnTypeMismatch(t *testing.T) {
    input := `
    let f = fn(x: int) -> string { x + 1 };
    `
    checker := checkInput(t, input)
    expectError(t, checker, "function declares return type string but returns int")
}

func checkInput(t *testing.T, input string) *Checker {
    t.Helper()
    l := lexer.New(input)
    p := parser.New(l)
    program := p.ParseProgram()

    if len(p.Errors()) > 0 {
        t.Fatalf("parser errors: %v", p.Errors())
    }

    checker := New()
    checker.Check(program)
    return checker
}

func expectNoErrors(t *testing.T, c *Checker) {
    t.Helper()
    if len(c.Errors()) > 0 {
        t.Errorf("unexpected errors: %v", c.Errors())
    }
}

func expectError(t *testing.T, c *Checker, expected string) {
    t.Helper()
    for _, err := range c.Errors() {
        if err.Message == expected {
            return
        }
    }
    t.Errorf("expected error %q, got %v", expected, c.Errors())
}
```

## How Real Languages Do It

### Go's Type Checker

Go's type checker (`go/types` package) does exactly what we built, but handles many more cases: struct types, interface satisfaction, method sets, channel types, goroutine analysis, and more. The core algorithm is the same — walk the AST, look up types, check rules.

### TypeScript's Type Checker

TypeScript has one of the most sophisticated type checkers in production. It handles union types, intersection types, conditional types, mapped types, template literal types, and full type narrowing through control flow analysis. The `checker.ts` file in the TypeScript compiler is over 40,000 lines.

### Rust's Type Checker

Rust's type checker enforces ownership and borrowing rules in addition to standard type checking. It uses a trait-based system for generics (similar to Haskell's type classes) and performs lifetime analysis to ensure references are valid.

---

## Exercises

### Exercise 1: Add Boolean Operators

Extend the type checker to handle `&&`, `||` operators. Both operands must be `bool`, and the result is `bool`. Add tests.

### Exercise 2: Comparison Chains

Add support for comparing strings with `==` and `!=` (but not `<`, `>`, since string ordering is complex). Add tests for both valid and invalid comparisons.

### Exercise 3: Return Type Inference

Modify the function type checker so that if no return type annotation is given, it infers the return type from the body. The inferred return type should be the type of the last expression in the block.

### Exercise 4: Wrong Argument Count

Add a test that calls a function with the wrong number of arguments:

```
let f = fn(a: int, b: int) -> int { a + b };
f(1)
```

Verify the error message includes both expected and actual counts.

### Exercise 5: Nested Function Types

Make the type checker handle functions that take functions as arguments:

```
let apply = fn(f: fn(int) -> int, x: int) -> int { f(x) };
let double = fn(x: int) -> int { x * 2 };
apply(double, 5)
```

This requires extending `resolveTypeAnnotation` to parse function type annotations like `fn(int) -> int`.

### Exercise 6: Type Narrowing

Implement basic null narrowing. Given:

```
let x: int? = 5;
if (x != null) {
    x + 1     // should type check as int + int
}
x + 1         // should ERROR: cannot use + with int? and int
```

Track which variables have been narrowed inside conditional blocks.
