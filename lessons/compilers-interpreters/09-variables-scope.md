# Lesson 09: Variables, Environments, and Scope

Up to now, our interpreter is a calculator. It evaluates expressions and forgets
everything immediately. It can't remember that `x` is `5`. That changes now.

## The Office Building

Environments are like floors in an office building. Your current floor (local scope)
has some information — desks with name tags and documents. If you need a document that
isn't on your floor, you take the elevator up to the next floor (outer scope). If it's
not there either, you keep going up to the lobby (global scope). If nobody in the
entire building has it, it doesn't exist — and you get an error.

When you create a new function, it's like opening a new floor. That floor has its own
desks, but the elevator still connects it to the floors above. This chain of floors,
connected by elevators, is the **scope chain**.

---

## The Environment

An environment is a map from names to values, with an optional pointer to an
outer environment. That's it. The simplest data structure in the whole interpreter,
and one of the most important.

```go
package object

type Environment struct {
    store map[string]Object
    outer *Environment
}

func NewEnvironment() *Environment {
    return &Environment{
        store: make(map[string]Object),
        outer: nil,
    }
}

func NewEnclosedEnvironment(outer *Environment) *Environment {
    env := NewEnvironment()
    env.outer = outer
    return env
}

func (e *Environment) Get(name string) (Object, bool) {
    obj, ok := e.store[name]
    if !ok && e.outer != nil {
        obj, ok = e.outer.Get(name)
    }
    return obj, ok
}

func (e *Environment) Set(name string, val Object) Object {
    e.store[name] = val
    return val
}
```

Look at `Get`. It checks the current environment first. If the name isn't there and
there's an outer environment, it recurses. This is the elevator going up floor by
floor. It's a linked list traversal — each environment points to its parent.

Compare this to how Go resolves variables. When you write a function inside another
function, the inner function can access the outer function's variables. Go's compiler
does this at compile time. We do it at runtime, walking the chain.

---

## AST Nodes for Variables

We need two new AST nodes from the parser (lesson 07):

```go
package ast

type LetStatement struct {
    Token token.Token
    Name  *Identifier
    Value Expression
}

func (ls *LetStatement) statementNode()       {}
func (ls *LetStatement) TokenLiteral() string  { return ls.Token.Literal }
func (ls *LetStatement) String() string {
    return ls.TokenLiteral() + " " + ls.Name.String() + " = " + ls.Value.String() + ";"
}

type Identifier struct {
    Token token.Token
    Value string
}

func (i *Identifier) expressionNode()      {}
func (i *Identifier) TokenLiteral() string { return i.Token.Literal }
func (i *Identifier) String() string       { return i.Value }

type ReturnStatement struct {
    Token       token.Token
    ReturnValue Expression
}

func (rs *ReturnStatement) statementNode()       {}
func (rs *ReturnStatement) TokenLiteral() string  { return rs.Token.Literal }
func (rs *ReturnStatement) String() string {
    return rs.TokenLiteral() + " " + rs.ReturnValue.String() + ";"
}
```

`LetStatement` binds a name to a value: `let x = 5;` creates an entry in the
environment mapping `"x"` to `Integer{5}`.

`Identifier` is a variable reference: when we see `x`, we look it up in the
environment chain.

---

## Updating the Evaluator

The `Eval` function now takes an environment parameter. Every call passes the
environment down, so variable lookups work at every level of the tree.

```go
func Eval(node ast.Node, env *object.Environment) object.Object {
    switch node := node.(type) {
    case *ast.Program:
        return evalProgram(node, env)

    case *ast.ExpressionStatement:
        return Eval(node.Expression, env)

    case *ast.BlockStatement:
        return evalBlockStatement(node, env)

    case *ast.LetStatement:
        val := Eval(node.Value, env)
        if isError(val) {
            return val
        }
        env.Set(node.Name.Value, val)
        return val

    case *ast.ReturnStatement:
        val := Eval(node.ReturnValue, env)
        if isError(val) {
            return val
        }
        return &object.ReturnValue{Value: val}

    case *ast.Identifier:
        return evalIdentifier(node, env)

    case *ast.IntegerLiteral:
        return &object.Integer{Value: node.Value}

    case *ast.BooleanLiteral:
        return nativeBoolToBooleanObject(node.Value)

    case *ast.PrefixExpression:
        right := Eval(node.Right, env)
        if isError(right) {
            return right
        }
        return evalPrefixExpression(node.Operator, right)

    case *ast.InfixExpression:
        left := Eval(node.Left, env)
        if isError(left) {
            return left
        }
        right := Eval(node.Right, env)
        if isError(right) {
            return right
        }
        return evalInfixExpression(node.Operator, left, right)

    case *ast.IfExpression:
        return evalIfExpression(node, env)

    default:
        return newError("unknown node type: %T", node)
    }
}
```

Three new cases: `LetStatement`, `ReturnStatement`, and `Identifier`.

### Let Bindings

```go
case *ast.LetStatement:
    val := Eval(node.Value, env)
    if isError(val) {
        return val
    }
    env.Set(node.Name.Value, val)
    return val
```

Evaluate the right-hand side, store the result in the current environment. That's it.
`let x = 5 + 3;` evaluates `5 + 3` to `Integer{8}`, then stores `"x" -> Integer{8}`
in the environment.

### Identifier Evaluation

```go
func evalIdentifier(node *ast.Identifier, env *object.Environment) object.Object {
    val, ok := env.Get(node.Value)
    if !ok {
        return newError("identifier not found: " + node.Value)
    }
    return val
}
```

Look up the name in the environment chain. If it's nowhere in the chain, that's an
error — the variable doesn't exist. This is like Go's "undefined: x" compile error,
except we catch it at runtime.

### Return Statements

```go
case *ast.ReturnStatement:
    val := Eval(node.ReturnValue, env)
    if isError(val) {
        return val
    }
    return &object.ReturnValue{Value: val}
```

Wrap the evaluated value in a `ReturnValue` object. This wrapper bubbles up through
block statements until it reaches the function or program level, where it gets unwrapped.
Think of it as a special envelope that says "stop evaluating and give this back."

Update `evalProgram` and `evalBlockStatement` to pass the environment:

```go
func evalProgram(program *ast.Program, env *object.Environment) object.Object {
    var result object.Object

    for _, statement := range program.Statements {
        result = Eval(statement, env)

        switch result := result.(type) {
        case *object.ReturnValue:
            return result.Value
        case *object.Error:
            return result
        }
    }

    return result
}

func evalBlockStatement(block *ast.BlockStatement, env *object.Environment) object.Object {
    var result object.Object

    for _, statement := range block.Statements {
        result = Eval(statement, env)

        if result != nil {
            rt := result.Type()
            if rt == object.RETURN_VALUE_OBJ || rt == object.ERROR_OBJ {
                return result
            }
        }
    }

    return result
}

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

---

## Lexical Scoping vs Dynamic Scoping

There are two ways to resolve variable names, and the difference matters enormously.

### Lexical Scoping (What We Use)

A variable is resolved based on *where the code is written*. The scope chain is
determined at parse/definition time. This is what Go, JavaScript, TypeScript,
Rust, and almost every modern language uses.

```
let x = 10;
let printX = fn() { x };
let callWithX = fn(f) {
    let x = 20;
    f();
};
callWithX(printX);
```

With lexical scoping, `printX` sees `x = 10` because that's what `x` was when
`printX` was *defined*. The `x = 20` inside `callWithX` is a different `x` in a
different scope. Result: `10`.

### Dynamic Scoping (What We Don't Use)

A variable is resolved based on *where the code is called from*. The scope chain
follows the call stack, not the definition location. Bash and old Lisp dialects
use this.

With dynamic scoping, `printX()` would see `x = 20` because it was called from
inside `callWithX`, where `x = 20`. Result: `20`.

### Why Lexical Wins

Lexical scoping is predictable. You can read the code and know what every variable
refers to without tracing the execution path. Dynamic scoping makes every function
call potentially change the meaning of your variables. It's like if the documents
on your office floor changed depending on who walked into the elevator — chaos.

Our interpreter implements lexical scoping because functions capture their *defining*
environment, not the *calling* environment. You'll see this in action in lesson 11
when we implement closures.

---

## Scope in Action

Let's trace through a concrete example:

```
let x = 5;
let y = 10;
if (x > 3) {
    let z = x + y;
    z;
}
```

Step by step:

1. Start with global environment: `{}`
2. `let x = 5;` → global env: `{x: 5}`
3. `let y = 10;` → global env: `{x: 5, y: 10}`
4. Evaluate `if` condition: `x > 3` → look up `x` in env → `5 > 3` → `true`
5. Enter consequence block (same env in this case)
6. `let z = x + y;` → look up `x` → `5`, look up `y` → `10`, store `z = 15`
7. `z;` → look up `z` → `15`

Note: in our current implementation, the `if` block shares the same environment
as the surrounding code. If you want block scoping (where `z` is only visible
inside the `if`), you'd create a new enclosed environment for the block. We'll
add that option in the exercises.

---

## Nested Scopes

When environments are nested, lookup walks the chain:

```
let x = 1;
let outer = fn() {
    let y = 2;
    let inner = fn() {
        let z = 3;
        x + y + z;
    };
    inner();
};
outer();
```

The environment chain when `x + y + z` executes:

```
inner's env:  { z: 3 }
     |
     v (outer pointer)
outer's env:  { y: 2, inner: <fn> }
     |
     v (outer pointer)
global env:   { x: 1, outer: <fn> }
```

Looking up `z`: found in inner's env. Done.
Looking up `y`: not in inner's env → follow outer pointer → found in outer's env.
Looking up `x`: not in inner's env → not in outer's env → found in global env.

Three floors. Three elevator rides for `x`. This is the scope chain in action.

---

## Closures Preview

A closure is a function bundled with its environment. Here's a taste — we'll go
deep in lesson 11:

```
let makeAdder = fn(x) {
    fn(y) { x + y };
};
let addFive = makeAdder(5);
addFive(3);
```

When `makeAdder(5)` runs:
1. Creates a new env with `x = 5`, enclosed by the global env
2. Returns the inner `fn(y)` — but that function remembers the env where `x = 5`
3. `addFive` is now that inner function, carrying its environment

When `addFive(3)` runs:
1. Creates a new env with `y = 3`, enclosed by makeAdder's env (where `x = 5`)
2. Evaluates `x + y` → looks up `x` → finds `5` in the outer env → `5 + 3 = 8`

The inner function "closed over" the variable `x`. That's a closure. The environment
chain is the mechanism that makes it work.

---

## Testing Variables and Scope

```go
func TestLetStatements(t *testing.T) {
    tests := []struct {
        input    string
        expected int64
    }{
        {"let a = 5; a;", 5},
        {"let a = 5 * 5; a;", 25},
        {"let a = 5; let b = a; b;", 5},
        {"let a = 5; let b = a; let c = a + b + 5; c;", 15},
    }

    for _, tt := range tests {
        testIntegerObject(t, testEval(tt.input), tt.expected)
    }
}

func TestReturnStatements(t *testing.T) {
    tests := []struct {
        input    string
        expected int64
    }{
        {"return 10;", 10},
        {"return 10; 9;", 10},
        {"return 2 * 5; 9;", 10},
        {"9; return 2 * 5; 9;", 10},
    }

    for _, tt := range tests {
        evaluated := testEval(tt.input)
        testIntegerObject(t, evaluated, tt.expected)
    }
}

func TestErrorHandlingWithVariables(t *testing.T) {
    tests := []struct {
        input           string
        expectedMessage string
    }{
        {"foobar", "identifier not found: foobar"},
    }

    for _, tt := range tests {
        evaluated := testEval(tt.input)
        errObj, ok := evaluated.(*object.Error)
        if !ok {
            t.Errorf("no error object returned. got=%T(%+v)", evaluated, evaluated)
            continue
        }
        if errObj.Message != tt.expectedMessage {
            t.Errorf("wrong error message. expected=%q, got=%q",
                tt.expectedMessage, errObj.Message)
        }
    }
}

func TestNestedScopes(t *testing.T) {
    input := `
    let x = 10;
    let y = 20;
    let result = if (x > 5) {
        let z = x + y;
        z;
    } else {
        0;
    };
    result;
    `

    evaluated := testEval(input)
    testIntegerObject(t, evaluated, 30)
}

func TestVariableShadowing(t *testing.T) {
    input := `
    let x = 5;
    let x = 10;
    x;
    `

    evaluated := testEval(input)
    testIntegerObject(t, evaluated, 10)
}

func TestReturnInNestedBlocks(t *testing.T) {
    input := `
    if (true) {
        if (true) {
            return 10;
        }
        return 1;
    }
    `

    evaluated := testEval(input)
    testIntegerObject(t, evaluated, 10)
}
```

The nested return test is important. `return 10` inside the inner `if` should stop
execution of everything — the inner block, the outer block, the program. That's why
`ReturnValue` wrapping exists: it bubbles up past all the block statements.

---

## The Environment as a Data Structure

Let's think about what the environment actually is from a data structures perspective.

It's a **linked list of hash maps**. Each node in the list is an environment (a hash map).
The `outer` pointer is the link to the next node. Variable lookup is a linear search
through the list.

```
[inner env] --> [outer env] --> [global env] --> nil
  {z: 3}         {y: 2}          {x: 1}
```

Lookup time: O(d * 1) where d is the depth of the scope chain and 1 is the average
hash map lookup. In practice, scope chains are shallow (3-5 levels), so this is fast
enough. Real language implementations optimize this with compile-time analysis that
turns variable lookups into array index accesses, but our approach works.

Compare to Go's implementation: Go resolves all variables at compile time and accesses
them by memory address. No runtime lookup at all. That's one reason compiled languages
are faster than interpreted ones.

---

## Exercises

1. **Block scoping**: Modify the evaluator so that `if` blocks create a new enclosed
   environment. Variables declared inside an `if` block should not be visible outside it.
   Test: `let x = 5; if (true) { let y = 10; }; y;` should produce "identifier not found."

2. **Variable reassignment**: Add support for reassigning variables without `let`.
   `let x = 5; x = 10; x;` should evaluate to `10`. You'll need a new AST node
   (`AssignExpression`) and a new `Set` method on Environment that walks the chain to
   find where the variable was originally defined.

3. **Const bindings**: Add `const` bindings that can't be reassigned. `const x = 5; x = 10;`
   should produce a runtime error. Hint: store metadata alongside the value in the
   environment.

4. **Multiple let bindings**: Support `let x = 1, y = 2;` in a single statement. How
   does this affect the parser and evaluator?

5. **Environment inspection**: Write a function `env.Debug() string` that prints all
   variables in the environment chain, formatted nicely with scope indicators:

   ```
   [scope 0] x = 5, y = 10
   [scope 1] z = 15
   ```

   This is useful for debugging the interpreter itself.

---

## Key Takeaways

- The environment is a linked list of hash maps — simple but powerful
- `Get` walks the scope chain from inner to outer; `Set` stores in the current scope
- Lexical scoping resolves variables based on where code is *written*, not where it *runs*
- Dynamic scoping resolves based on the call stack — unpredictable and mostly abandoned
- Closures work because functions carry a reference to their defining environment
- `ReturnValue` wrapping lets return statements bubble through nested blocks
- Variable lookup is O(depth) — shallow scope chains keep it fast

Next lesson: control flow — making our language make decisions and repeat things.
