# Lesson 10: Control Flow — If, While, For

Your interpreter can evaluate expressions and remember variables. But it can only
go forward, one statement at a time. It can't loop. It can't skip. It's a train
on a straight track. Control flow gives it switches and roundabouts.

## The Choose-Your-Own-Adventure Book

Control flow is like a choose-your-own-adventure book. At each decision point (if),
you evaluate the condition and turn to the right page (branch). Loops are pages
that say "go back to page X until something changes." Break is ripping out the
page that sends you back. Continue is skipping the rest of the current page and
going back to the decision point early.

Every program you've ever written is a choose-your-own-adventure book. The
language runtime is the reader.

---

## If/Else: What We Already Have

We implemented basic if/else in lesson 08. Let's revisit and deepen it.

```go
func evalIfExpression(ie *ast.IfExpression, env *object.Environment) object.Object {
    condition := Eval(ie.Condition, env)
    if isError(condition) {
        return condition
    }

    if isTruthy(condition) {
        return Eval(ie.Consequence, env)
    } else if ie.Alternative != nil {
        return Eval(ie.Alternative, env)
    } else {
        return object.NULL
    }
}
```

The key question: what counts as truthy?

---

## Truthiness Rules

In our language, truthiness is simple:

- `false` is falsy
- `null` is falsy
- Everything else is truthy (including `0`, empty strings, empty arrays)

```go
func isTruthy(obj object.Object) bool {
    switch obj {
    case object.NULL:
        return false
    case object.FALSE:
        return false
    case object.TRUE:
        return true
    default:
        return true
    }
}
```

This is a deliberate design choice. Compare:

| Value     | Our Language | JavaScript | Python | Ruby |
|-----------|-------------|------------|--------|------|
| `0`       | truthy      | falsy      | falsy  | truthy |
| `""`      | truthy      | falsy      | falsy  | truthy |
| `null`    | falsy       | falsy      | falsy  | falsy  |
| `false`   | falsy       | falsy      | falsy  | falsy  |
| `[]`      | truthy      | truthy     | falsy  | truthy |

Our rules match Ruby's approach: only `false` and `null`/`nil` are falsy. This
avoids the JavaScript gotchas where `0 == false` is `true` and `"" == false` is
`true`. Simpler mental model.

You could make `0` falsy if you wanted — just add a case to `isTruthy`. Language
design is a series of trade-offs.

---

## Extending the Language: While Loops

Our language doesn't have loops yet. Let's add `while`. First, the AST node:

```go
package ast

type WhileExpression struct {
    Token     token.Token
    Condition Expression
    Body      *BlockStatement
}

func (we *WhileExpression) expressionNode()      {}
func (we *WhileExpression) TokenLiteral() string  { return we.Token.Literal }
func (we *WhileExpression) String() string {
    return "while (" + we.Condition.String() + ") " + we.Body.String()
}
```

The parser needs to handle the `while` keyword (you'd register it the same way
you registered `if` in lesson 07 — as a prefix parser for the `WHILE` token).

### Parser Addition

```go
func (p *Parser) parseWhileExpression() ast.Expression {
    expression := &ast.WhileExpression{Token: p.curToken}

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

    expression.Body = p.parseBlockStatement()

    return expression
}
```

Register it in the parser initialization:

```go
p.registerPrefix(token.WHILE, p.parseWhileExpression)
```

### Evaluator Addition

```go
func evalWhileExpression(we *ast.WhileExpression, env *object.Environment) object.Object {
    var result object.Object = object.NULL

    for {
        condition := Eval(we.Condition, env)
        if isError(condition) {
            return condition
        }

        if !isTruthy(condition) {
            break
        }

        result = Eval(we.Body, env)

        if isError(result) {
            return result
        }

        if result != nil && result.Type() == object.RETURN_VALUE_OBJ {
            return result
        }

        if isBreak(result) {
            return object.NULL
        }

        if isContinue(result) {
            continue
        }
    }

    return result
}
```

Add the case to `Eval`:

```go
case *ast.WhileExpression:
    return evalWhileExpression(node, env)
```

The structure mirrors Go's `for` loop with a condition. Evaluate the condition.
If truthy, execute the body. Repeat. If the condition becomes falsy, stop.

Notice the break and continue checks — we'll implement those shortly.

---

## For Loops

A `for` loop is syntactic sugar over a `while` loop with initialization and
an update step. `for (let i = 0; i < 10; i = i + 1) { ... }` is equivalent to
`let i = 0; while (i < 10) { ...; i = i + 1; }`.

But having dedicated syntax is nicer. The AST node has four fields: `Init` (statement),
`Condition` (expression), `Update` (expression), and `Body` (block statement). The
parser follows the same pattern as `while` — parse the three parts between
parentheses, then parse the body block.

### Evaluating For Loops

The for loop creates its own scope (so `let i = 0` doesn't leak) and desugars
to the while pattern:

```go
func evalForExpression(fe *ast.ForExpression, env *object.Environment) object.Object {
    forEnv := object.NewEnclosedEnvironment(env)

    if fe.Init != nil {
        initResult := Eval(fe.Init, forEnv)
        if isError(initResult) {
            return initResult
        }
    }

    var result object.Object = object.NULL

    for {
        if fe.Condition != nil {
            condition := Eval(fe.Condition, forEnv)
            if isError(condition) {
                return condition
            }
            if !isTruthy(condition) {
                break
            }
        }

        result = Eval(fe.Body, forEnv)

        if isError(result) {
            return result
        }

        if result != nil && result.Type() == object.RETURN_VALUE_OBJ {
            return result
        }

        if isBreak(result) {
            return object.NULL
        }

        if isContinue(result) {
            result = object.NULL
        }

        if fe.Update != nil {
            updateResult := Eval(fe.Update, forEnv)
            if isError(updateResult) {
                return updateResult
            }
        }
    }

    return result
}
```

Critical detail: `NewEnclosedEnvironment(env)` creates a new scope for the loop.
The loop variable `i` lives in this scope, not the outer scope. After the loop,
`i` is gone. This matches JavaScript's `for (let i ...)` behavior, where `i` is
scoped to the loop.

Another critical detail: the update expression runs *after* a continue. In
`for (let i = 0; i < 10; i = i + 1)`, if the body hits `continue`, we still
need to run `i = i + 1` or we'd loop forever. Compare this to Go's `for` loop —
the post statement always runs, even after `continue`.

Wait — but our update runs after the continue check, which means `continue` would
skip the update. Let's fix that. The continue result needs to skip the rest of
the body but NOT the update:

Looking at the code again — we handle this correctly. When `isContinue(result)` is
true, we set `result = object.NULL` (clearing the continue signal) and fall through
to the update. The `continue` statement in Go's `for` loop works the same way.

---

## Break and Continue

These need new object types to signal the evaluator:

```go
package object

const (
    BREAK_OBJ    ObjectType = "BREAK"
    CONTINUE_OBJ ObjectType = "CONTINUE"
)

type Break struct{}

func (b *Break) Type() ObjectType { return BREAK_OBJ }
func (b *Break) Inspect() string  { return "break" }

type Continue struct{}

func (c *Continue) Type() ObjectType { return CONTINUE_OBJ }
func (c *Continue) Inspect() string  { return "continue" }
```

The AST nodes (`BreakStatement`, `ContinueStatement`) are simple — just a Token
field and the standard interface methods. Evaluator cases:

```go
case *ast.BreakStatement:
    return &object.Break{}

case *ast.ContinueStatement:
    return &object.Continue{}
```

Helper functions:

```go
func isBreak(obj object.Object) bool {
    if obj != nil {
        return obj.Type() == object.BREAK_OBJ
    }
    return false
}

func isContinue(obj object.Object) bool {
    if obj != nil {
        return obj.Type() == object.CONTINUE_OBJ
    }
    return false
}
```

Break and continue work like return values — they're signal objects that bubble up
through block evaluation. The loop checks for them after each iteration. The
`evalBlockStatement` function also needs to propagate them:

```go
func evalBlockStatement(block *ast.BlockStatement, env *object.Environment) object.Object {
    var result object.Object

    for _, statement := range block.Statements {
        result = Eval(statement, env)

        if result != nil {
            rt := result.Type()
            if rt == object.RETURN_VALUE_OBJ || rt == object.ERROR_OBJ ||
                rt == object.BREAK_OBJ || rt == object.CONTINUE_OBJ {
                return result
            }
        }
    }

    return result
}
```

Now break and continue bubble up through nested blocks to the enclosing loop,
just like return values bubble up to the enclosing function.

---

## Short-Circuit Evaluation

Logical AND (`&&`) and OR (`||`) don't evaluate both sides. `&&` stops at the
first falsy value. `||` stops at the first truthy value. This isn't just an
optimization — it's a feature. You rely on it:

```go
// In Go:
if user != nil && user.IsAdmin() { ... }

// The short-circuit prevents a nil pointer dereference.
// If user is nil, user.IsAdmin() never runs.
```

In our language:

```
let x = false && expensiveComputation();
```

`expensiveComputation()` never runs because `false && anything` is `false`.

### Implementation

We handle `&&` and `||` as special infix operators that don't evaluate the
right side eagerly:

```go
case *ast.InfixExpression:
    if node.Operator == "&&" || node.Operator == "||" {
        return evalShortCircuit(node, env)
    }

    left := Eval(node.Left, env)
    if isError(left) {
        return left
    }
    right := Eval(node.Right, env)
    if isError(right) {
        return right
    }
    return evalInfixExpression(node.Operator, left, right)
```

```go
func evalShortCircuit(node *ast.InfixExpression, env *object.Environment) object.Object {
    left := Eval(node.Left, env)
    if isError(left) {
        return left
    }

    if node.Operator == "&&" {
        if !isTruthy(left) {
            return left
        }
        return Eval(node.Right, env)
    }

    if isTruthy(left) {
        return left
    }
    return Eval(node.Right, env)
}
```

Important: `&&` and `||` return the *value*, not a boolean. `5 && 10` returns `10`.
`null || 42` returns `42`. This matches JavaScript's behavior and is useful for
default values: `let name = input || "anonymous";`.

This is different from Go, where `&&` and `||` require booleans and return booleans.
Our approach is more flexible.

---

## Variable Reassignment for Loops

Loops are useless without the ability to change variables. We need assignment
(not just `let` bindings). The `AssignExpression` AST node has a `Name` (Identifier) and a `Value` (Expression).
The parser produces it when it sees `identifier = expression` outside of a `let`.

The environment needs a method that updates an existing variable instead of
creating a new one:

```go
func (e *Environment) Update(name string, val Object) (Object, bool) {
    _, ok := e.store[name]
    if ok {
        e.store[name] = val
        return val, true
    }
    if e.outer != nil {
        return e.outer.Update(name, val)
    }
    return nil, false
}
```

`Update` walks the chain to find where the variable was originally defined and
changes it there. This is crucial for closures — if a closure modifies a variable
from its outer scope, the change needs to happen in the right environment.

Evaluator case:

```go
case *ast.AssignExpression:
    val := Eval(node.Value, env)
    if isError(val) {
        return val
    }
    _, ok := env.Update(node.Name.Value, val)
    if !ok {
        return newError("identifier not found: " + node.Name.Value)
    }
    return val
```

Now loops work properly:

```
let sum = 0;
let i = 0;
while (i < 10) {
    sum = sum + i;
    i = i + 1;
}
sum;
```

This evaluates to `45` (sum of 0 through 9).

---

## Testing Control Flow

```go
func TestWhileExpression(t *testing.T) {
    tests := []struct {
        input    string
        expected int64
    }{
        {
            "let x = 0; while (x < 5) { x = x + 1; }; x;",
            5,
        },
        {
            "let sum = 0; let i = 1; while (i < 4) { sum = sum + i; i = i + 1; }; sum;",
            6,
        },
    }

    for _, tt := range tests {
        testIntegerObject(t, testEval(tt.input), tt.expected)
    }
}

func TestForExpression(t *testing.T) {
    tests := []struct {
        input    string
        expected int64
    }{
        {
            "let sum = 0; for (let i = 0; i < 5; i = i + 1) { sum = sum + i; }; sum;",
            10,
        },
        {
            "let sum = 0; for (let i = 10; i > 0; i = i - 1) { sum = sum + i; }; sum;",
            55,
        },
    }

    for _, tt := range tests {
        testIntegerObject(t, testEval(tt.input), tt.expected)
    }
}

func TestForLoopScoping(t *testing.T) {
    input := "for (let i = 0; i < 3; i = i + 1) { i; }; i;"

    evaluated := testEval(input)
    errObj, ok := evaluated.(*object.Error)
    if !ok {
        t.Fatalf("expected error for accessing loop variable outside loop, got=%T", evaluated)
    }
    if errObj.Message != "identifier not found: i" {
        t.Errorf("wrong error message. got=%q", errObj.Message)
    }
}

func TestBreakStatement(t *testing.T) {
    tests := []struct {
        input    string
        expected int64
    }{
        {
            "let x = 0; while (true) { if (x == 5) { break; }; x = x + 1; }; x;",
            5,
        },
        {
            "let sum = 0; for (let i = 0; i < 100; i = i + 1) { if (i == 3) { break; }; sum = sum + i; }; sum;",
            3,
        },
    }

    for _, tt := range tests {
        testIntegerObject(t, testEval(tt.input), tt.expected)
    }
}

func TestContinueStatement(t *testing.T) {
    input := `
    let sum = 0;
    for (let i = 0; i < 10; i = i + 1) {
        if (i == 3) { continue; };
        if (i == 7) { continue; };
        sum = sum + i;
    };
    sum;
    `

    evaluated := testEval(input)
    testIntegerObject(t, evaluated, 35)
}

func TestShortCircuit(t *testing.T) {
    tests := []struct {
        input    string
        expected interface{}
    }{
        {"true && 10", 10},
        {"false && 10", false},
        {"true || 10", true},
        {"false || 10", 10},
        {"null || 42", 42},
        {"5 && 0", 0},
        {"0 && 5", 5},
    }

    for _, tt := range tests {
        evaluated := testEval(tt.input)
        switch expected := tt.expected.(type) {
        case int:
            testIntegerObject(t, evaluated, int64(expected))
        case bool:
            testBooleanObject(t, evaluated, expected)
        }
    }
}

func TestTruthiness(t *testing.T) {
    tests := []struct {
        input    string
        expected bool
    }{
        {"if (0) { true } else { false }", true},
        {"if (1) { true } else { false }", true},
        {"if (null) { true } else { false }", false},
        {"if (false) { true } else { false }", false},
        {"if (true) { true } else { false }", true},
    }

    for _, tt := range tests {
        evaluated := testEval(tt.input)
        testBooleanObject(t, evaluated, tt.expected)
    }
}
```

The `TestContinueStatement` test skips `i == 3` and `i == 7`. Sum of 0-9 is 45.
Minus 3 and 7 is 45 - 3 - 7 = 35. That confirms continue works correctly.

Note: `0` is truthy in our language (only `false` and `null` are falsy). So
`0 && 5` returns `5` (left is truthy, evaluate and return right). And `5 && 0`
returns `0` (same logic). Both sides get evaluated because both `5` and `0` are
truthy. The `&&` operator with a truthy left always evaluates and returns the right.

---

## Exercises

1. **Else-if chains**: Support `if (x) { ... } else if (y) { ... } else { ... }`.
   This might already work if the parser parses `else if` as `else { if ... }`. Verify
   with tests.

2. **Switch/match expression**: Add a `match` expression:
   ```
   match (x) {
       1 => "one",
       2 => "two",
       _ => "other"
   }
   ```
   Design the AST node, parser rule, and evaluator logic.

3. **Loop labels and nested break**: Support breaking out of an outer loop:
   ```
   outer: while (true) {
       while (true) {
           break outer;
       }
   }
   ```
   This requires labeled loops and labeled break/continue.

4. **Do-while loop**: Add `do { ... } while (condition);` that always executes the
   body at least once.

5. **Range-based for**: Add `for (let x in [1, 2, 3]) { ... }` that iterates over
   array elements. You'll need arrays first (exercise from lesson 08) or you can
   implement a simple range: `for (let i in range(0, 10)) { ... }`.

---

## Key Takeaways

- Truthiness defines what counts as a "true" condition — our language uses only `false` and `null` as falsy
- While loops: evaluate condition, execute body, repeat
- For loops: init, condition, update — desugars to while with an extra scope
- Break and continue are signal objects that bubble up through blocks, same pattern as return values
- Short-circuit `&&` and `||` don't evaluate the right side if the left side determines the result
- They return values, not booleans — useful for defaults (`input || "fallback"`)
- For loop variables live in their own scope — they don't leak
- Variable reassignment walks the scope chain to find the original binding

Next lesson: functions and closures — the most powerful feature in any language.
