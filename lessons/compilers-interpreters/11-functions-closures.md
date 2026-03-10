# Lesson 11: Functions and Closures

Functions are where your language stops being a calculator and starts being a
*language*. Everything else — variables, control flow, expressions — is the
supporting cast. Functions are the lead.

## The Backpack

A closure is like a backpack. When a function is created, it packs up the local
variables around it into a backpack (the captured environment). When that function
is called later — maybe in a completely different context — it opens the backpack
and still has access to those variables.

The function doesn't copy the variables. It keeps a reference to the environment
where it was born. The backpack doesn't have photocopies of documents; it has
keys to the filing cabinet on the floor where the function was defined.

This is the single most important concept in this entire track. If you understand
closures, you understand how every modern language handles scope, callbacks,
and higher-order functions.

---

## The Function Object

A function at runtime needs three things:

1. **Parameters**: the names of the arguments it accepts
2. **Body**: the block of code to execute
3. **Environment**: the scope where the function was defined (for closures)

```go
package object

import (
    "monkey/ast"
    "strings"
)

type Function struct {
    Parameters []*ast.Identifier
    Body       *ast.BlockStatement
    Env        *Environment
}

func (f *Function) Type() ObjectType { return FUNCTION_OBJ }
func (f *Function) Inspect() string {
    params := make([]string, len(f.Parameters))
    for i, p := range f.Parameters {
        params[i] = p.String()
    }
    return "fn(" + strings.Join(params, ", ") + ") { " + f.Body.String() + " }"
}
```

The `Env` field is the backpack. It's a pointer to the environment that existed
when `fn(...)` was evaluated. Not when the function is called — when it's *defined*.

This is the key difference between lexical and dynamic scoping from lesson 09.
Lexical scoping = capture the defining environment. Dynamic scoping = use the
calling environment.

---

## AST Nodes

The parser (lesson 07) produces these nodes for function literals and calls:

```go
package ast

type FunctionLiteral struct {
    Token      token.Token
    Parameters []*Identifier
    Body       *BlockStatement
}

func (fl *FunctionLiteral) expressionNode()      {}
func (fl *FunctionLiteral) TokenLiteral() string  { return fl.Token.Literal }
func (fl *FunctionLiteral) String() string {
    params := make([]string, len(fl.Parameters))
    for i, p := range fl.Parameters {
        params[i] = p.String()
    }
    return fl.TokenLiteral() + "(" + strings.Join(params, ", ") + ") " + fl.Body.String()
}

type CallExpression struct {
    Token     token.Token
    Function  Expression
    Arguments []Expression
}

func (ce *CallExpression) expressionNode()      {}
func (ce *CallExpression) TokenLiteral() string  { return ce.Token.Literal }
func (ce *CallExpression) String() string {
    args := make([]string, len(ce.Arguments))
    for i, a := range ce.Arguments {
        args[i] = a.String()
    }
    return ce.Function.String() + "(" + strings.Join(args, ", ") + ")"
}
```

`FunctionLiteral` is the definition: `fn(x, y) { x + y }`.
`CallExpression` is the invocation: `add(3, 4)` or even `fn(x) { x }(5)`.

Note that `CallExpression.Function` is an `Expression`, not an `Identifier`. This
means you can call any expression that evaluates to a function. `myArray[0](5)` or
`getCallback()(10)` — any expression that returns a function can be called immediately.

---

## Evaluating Function Literals

When we encounter a function definition, we don't execute the body. We wrap it
in a Function object and capture the current environment:

```go
case *ast.FunctionLiteral:
    params := node.Parameters
    body := node.Body
    return &object.Function{Parameters: params, Body: body, Env: env}
```

Three lines. That's it. The function body doesn't run until someone calls it.
The environment gets captured — this is where the backpack gets packed.

---

## Evaluating Function Calls

Calling a function is where the magic happens. Here's the sequence:

1. Evaluate the function expression (get the Function object)
2. Evaluate each argument expression (get the argument values)
3. Create a new environment enclosed by the function's captured environment
4. Bind argument values to parameter names in the new environment
5. Evaluate the function body in the new environment
6. Unwrap any ReturnValue wrapper

```go
case *ast.CallExpression:
    function := Eval(node.Function, env)
    if isError(function) {
        return function
    }

    args := evalExpressions(node.Arguments, env)
    if len(args) == 1 && isError(args[0]) {
        return args[0]
    }

    return applyFunction(function, args)
```

```go
func evalExpressions(exps []ast.Expression, env *object.Environment) []object.Object {
    var result []object.Object

    for _, exp := range exps {
        evaluated := Eval(exp, env)
        if isError(evaluated) {
            return []object.Object{evaluated}
        }
        result = append(result, evaluated)
    }

    return result
}

func applyFunction(fn object.Object, args []object.Object) object.Object {
    switch fn := fn.(type) {
    case *object.Function:
        if len(args) != len(fn.Parameters) {
            return newError("wrong number of arguments: expected %d, got %d",
                len(fn.Parameters), len(args))
        }

        extendedEnv := extendFunctionEnv(fn, args)
        evaluated := Eval(fn.Body, extendedEnv)
        return unwrapReturnValue(evaluated)

    case *object.Builtin:
        result := fn.Fn(args...)
        if result != nil {
            return result
        }
        return object.NULL

    default:
        return newError("not a function: %s", fn.Type())
    }
}

func extendFunctionEnv(fn *object.Function, args []object.Object) *object.Environment {
    env := object.NewEnclosedEnvironment(fn.Env)

    for paramIdx, param := range fn.Parameters {
        env.Set(param.Value, args[paramIdx])
    }

    return env
}

func unwrapReturnValue(obj object.Object) object.Object {
    if returnValue, ok := obj.(*object.ReturnValue); ok {
        return returnValue.Value
    }
    return obj
}
```

The critical line is `NewEnclosedEnvironment(fn.Env)`. The new environment's outer
pointer is the *function's* captured environment, NOT the calling environment. This
is what makes lexical scoping work.

Let's trace through an example:

```
let x = 10;
let add = fn(a, b) { a + b + x };
add(3, 4);
```

1. Global env: `{x: 10, add: Function{params: [a, b], body: a+b+x, env: globalEnv}}`
2. Call `add(3, 4)`:
   - Evaluate args: `[Integer{3}, Integer{4}]`
   - Create new env, enclosed by `fn.Env` (which is globalEnv): `{a: 3, b: 4} -> {x: 10, add: fn}`
   - Evaluate `a + b + x`:
     - `a` → found in current env → `3`
     - `b` → found in current env → `4`
     - `x` → not in current env → check outer → found in global env → `10`
   - Result: `17`

---

## Closures in Action

### Counter Factory

The classic closure example — a function that returns a function, and the inner
function remembers state:

```
let makeCounter = fn() {
    let count = 0;
    fn() {
        count = count + 1;
        count;
    };
};

let counter = makeCounter();
counter();
counter();
counter();
```

Trace:

1. `makeCounter()` runs:
   - Creates env `{count: 0}` enclosed by global env
   - Returns inner `fn()` that captures this env
   - `makeCounter`'s env stays alive because the inner function holds a reference

2. First `counter()`:
   - Creates new env enclosed by makeCounter's env: `{} -> {count: 0} -> global`
   - Evaluates `count = count + 1`: looks up `count` → finds `0` in outer env → updates to `1`
   - Evaluates `count` → `1`

3. Second `counter()`:
   - Creates new env enclosed by makeCounter's env: `{} -> {count: 1} -> global`
   - `count` is now `1` → updates to `2`

4. Third `counter()`:
   - `count` is now `2` → updates to `3`

The `count` variable survives between calls because the inner function keeps a reference
to the environment where `count` lives. This is the backpack in action.

In Go, you'd write this as:

```go
func makeCounter() func() int {
    count := 0
    return func() int {
        count++
        return count
    }
}
```

Same concept. Go's closures work the same way — the anonymous function captures
`count` from the enclosing scope. Go's compiler does it with heap allocation.
Our interpreter does it with environment chains.

### Partial Application

```
let partial = fn(f, x) {
    fn(y) { f(x, y) };
};
let add = fn(a, b) { a + b };
let addFive = partial(add, 5);
addFive(10);
```

`partial` takes a two-argument function and one argument, returns a new function
that supplies the second argument later. The inner `fn(y)` captures both `f` and
`x` from the enclosing scope. Result: `15`.

---

## Recursion

Functions can call themselves. Nothing special is needed in the evaluator — it
already works because the function is stored in the environment before the body
executes.

```
let fibonacci = fn(n) {
    if (n < 2) {
        return n;
    };
    fibonacci(n - 1) + fibonacci(n - 2);
};

fibonacci(10);
```

Wait — does this actually work? Let's check. When `fibonacci` is called:

1. The global env has `fibonacci` bound to the Function object
2. A new env is created enclosed by the function's captured env (the global env)
3. Inside the body, `fibonacci` is looked up → not in the local env → found in the
   global env → it works

Yes, it works. The function was defined in the global scope and captures the global
environment. When it references itself by name, it walks up to the global env and
finds itself there.

This wouldn't work if we tried to define an anonymous recursive function:

```
fn(n) {
    if (n < 2) { return n; };
    ???(n - 1) + ???(n - 2);
}
```

There's no name to reference. Some languages have a `recur` keyword or Y-combinator
for this. We'd need named function expressions or `let rec` — exercises for later.

### Factorial

```
let factorial = fn(n) {
    if (n == 0) { return 1; };
    n * factorial(n - 1);
};

factorial(5);
```

`5 * 4 * 3 * 2 * 1 * 1 = 120`.

Each recursive call creates a new environment with its own `n`. The call stack
for `factorial(3)`:

```
factorial(3):  env {n: 3} -> global
  factorial(2):  env {n: 2} -> global
    factorial(1):  env {n: 1} -> global
      factorial(0):  env {n: 0} -> global
        returns 1
      returns 1 * 1 = 1
    returns 2 * 1 = 2
  returns 3 * 2 = 6
```

Each call has its own `n` because each call creates a new enclosed environment.
The environments don't interfere with each other. This is why functional
programming works — immutable bindings in isolated scopes.

---

## Higher-Order Functions

Functions that take other functions as arguments. This is where the language gets
powerful.

### Built-in Functions

We need a way to define functions in Go that our language can call. These are
built-in functions (like `len()` in Go or `console.log()` in JavaScript):

```go
package object

type BuiltinFunction func(args ...Object) Object

type Builtin struct {
    Fn BuiltinFunction
}

func (b *Builtin) Type() ObjectType { return BUILTIN_OBJ }
func (b *Builtin) Inspect() string  { return "builtin function" }
```

Now define some built-ins. Here's `len`, `puts`, and `map` — the pattern is
the same for `filter`, `reduce`, `first`, `last`, and `push`:

```go
package evaluator

import (
    "fmt"
    "monkey/object"
)

var builtins = map[string]*object.Builtin{
    "len": {
        Fn: func(args ...object.Object) object.Object {
            if len(args) != 1 {
                return newError("wrong number of arguments to `len`: expected 1, got %d", len(args))
            }
            switch arg := args[0].(type) {
            case *object.String:
                return &object.Integer{Value: int64(len(arg.Value))}
            case *object.Array:
                return &object.Integer{Value: int64(len(arg.Elements))}
            default:
                return newError("argument to `len` not supported, got %s", args[0].Type())
            }
        },
    },

    "puts": {
        Fn: func(args ...object.Object) object.Object {
            for _, arg := range args {
                fmt.Println(arg.Inspect())
            }
            return object.NULL
        },
    },

    "map": {
        Fn: func(args ...object.Object) object.Object {
            if len(args) != 2 {
                return newError("wrong number of arguments to `map`: expected 2, got %d", len(args))
            }
            arr, ok := args[0].(*object.Array)
            if !ok {
                return newError("first argument to `map` must be ARRAY, got %s", args[0].Type())
            }
            fn, ok := args[1].(*object.Function)
            if !ok {
                return newError("second argument to `map` must be FUNCTION, got %s", args[1].Type())
            }
            elements := make([]object.Object, len(arr.Elements))
            for i, el := range arr.Elements {
                env := object.NewEnclosedEnvironment(fn.Env)
                if len(fn.Parameters) > 0 {
                    env.Set(fn.Parameters[0].Value, el)
                }
                result := Eval(fn.Body, env)
                if isError(result) {
                    return result
                }
                elements[i] = unwrapReturnValue(result)
            }
            return &object.Array{Elements: elements}
        },
    },
}
```

The `filter` built-in follows the same pattern as `map` but collects elements where
the callback returns a truthy value. `reduce` takes three args (array, function,
initial value) and threads an accumulator through each element. `first`, `last`, and
`push` are straightforward array utilities.

Update `evalIdentifier` to check built-ins:

```go
func evalIdentifier(node *ast.Identifier, env *object.Environment) object.Object {
    if val, ok := env.Get(node.Value); ok {
        return val
    }

    if builtin, ok := builtins[node.Value]; ok {
        return builtin
    }

    return newError("identifier not found: " + node.Value)
}
```

User-defined variables take priority over built-ins. If someone writes `let len = 5;`,
that shadows the built-in `len`. Same as Go — you can shadow built-in names (don't).

---

## The Array Object

To make map/filter/reduce work, we need arrays:

```go
package object

type Array struct {
    Elements []Object
}

func (a *Array) Type() ObjectType { return ARRAY_OBJ }
func (a *Array) Inspect() string {
    elements := make([]string, len(a.Elements))
    for i, el := range a.Elements {
        elements[i] = el.Inspect()
    }
    return "[" + strings.Join(elements, ", ") + "]"
}
```

AST node and evaluation:

```go
type ArrayLiteral struct {
    Token    token.Token
    Elements []Expression
}

func (al *ArrayLiteral) expressionNode()      {}
func (al *ArrayLiteral) TokenLiteral() string  { return al.Token.Literal }
func (al *ArrayLiteral) String() string {
    elements := make([]string, len(al.Elements))
    for i, el := range al.Elements {
        elements[i] = el.String()
    }
    return "[" + strings.Join(elements, ", ") + "]"
}
```

```go
case *ast.ArrayLiteral:
    elements := evalExpressions(node.Elements, env)
    if len(elements) == 1 && isError(elements[0]) {
        return elements[0]
    }
    return &object.Array{Elements: elements}
```

---

## Using Higher-Order Functions

Now the payoff:

```
let numbers = [1, 2, 3, 4, 5];

let doubled = map(numbers, fn(x) { x * 2 });

let evens = filter(numbers, fn(x) {
    let remainder = x - (x / 2) * 2;
    remainder == 0;
});

let sum = reduce(numbers, fn(acc, x) { acc + x }, 0);
```

`doubled` is `[2, 4, 6, 8, 10]`.
`evens` is `[2, 4]`.
`sum` is `15`.

This works because functions are first-class values. You can pass them as arguments,
return them from other functions, store them in variables. They're just another
object type, like integers or strings.

---

## Testing Functions and Closures

```go
func TestFunctionApplication(t *testing.T) {
    tests := []struct {
        input    string
        expected int64
    }{
        {"let identity = fn(x) { x; }; identity(5);", 5},
        {"let double = fn(x) { x * 2; }; double(5);", 10},
        {"let add = fn(x, y) { x + y; }; add(5, 5);", 10},
        {"let add = fn(x, y) { x + y; }; add(5 + 5, add(5, 5));", 20},
        {"fn(x) { x; }(5)", 5},
    }

    for _, tt := range tests {
        testIntegerObject(t, testEval(tt.input), tt.expected)
    }
}

func TestClosures(t *testing.T) {
    input := `
    let newAdder = fn(x) { fn(y) { x + y }; };
    let addTwo = newAdder(2);
    addTwo(3);
    `
    testIntegerObject(t, testEval(input), 5)
}

func TestClosureCounter(t *testing.T) {
    input := `
    let makeCounter = fn() {
        let count = 0;
        fn() { count = count + 1; count; };
    };
    let c = makeCounter();
    c(); c(); c();
    `
    testIntegerObject(t, testEval(input), 3)
}

func TestRecursiveFibonacci(t *testing.T) {
    input := `
    let fib = fn(n) {
        if (n < 2) { return n; };
        fib(n - 1) + fib(n - 2);
    };
    fib(10);
    `
    testIntegerObject(t, testEval(input), 55)
}

func TestHigherOrderFunctions(t *testing.T) {
    input := `
    let apply = fn(f, x) { f(x) };
    let double = fn(x) { x * 2 };
    apply(double, 5);
    `
    testIntegerObject(t, testEval(input), 10)
}
```

Note: our call stack is Go's call stack. Each `Eval` call is a Go function call,
so our language's recursion depth is limited by Go's stack size. Real interpreters
maintain their own call stack — we'll do that when we build the VM in lesson 18.

---

## Exercises

1. **Named function expressions**: Support `let add = fn add(x, y) { ... }` where
   the function knows its own name. This enables recursive anonymous functions:
   `fn fib(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } }(10)`.

2. **Default parameter values**: Support `fn(x, y = 10) { x + y }`. Call with one
   arg: `f(5)` should return `15`. Call with two: `f(5, 20)` returns `25`.

3. **Rest parameters**: Support `fn(first, ...rest) { len(rest) }`. `f(1, 2, 3)`
   should return `2` (rest is `[2, 3]`).

4. **Implement map/filter/reduce in the language** instead of as built-ins:
   ```
   let map = fn(arr, f) {
       let iter = fn(arr, accumulated) {
           if (len(arr) == 0) { return accumulated; };
           iter(rest(arr), push(accumulated, f(first(arr))));
       };
       iter(arr, []);
   };
   ```
   You'll need a `rest` built-in that returns all elements except the first.

5. **Memoization**: Implement a `memoize` higher-order function that caches results:
   ```
   let memoize = fn(f) {
       let cache = {};
       fn(n) {
           if (cache[n] != null) { return cache[n]; };
           let result = f(n);
           cache[n] = result;
           result;
       };
   };
   let fastFib = memoize(fn(n) {
       if (n < 2) { return n; };
       fastFib(n - 1) + fastFib(n - 2);
   });
   ```
   You'll need hash/dictionary support (lesson 08 exercise) to make this work.

---

## Key Takeaways

- Functions are first-class objects: they can be passed as arguments, returned, and stored
- A closure captures the environment where it was defined — the backpack metaphor
- Function calls create a new environment enclosed by the function's captured env, not the calling env
- Recursion works because functions find themselves in the outer environment
- Built-in functions bridge Go code and our language
- map/filter/reduce show the power of higher-order functions
- Our call stack is Go's call stack — simple but limited

Next lesson: error handling — making our language tell users what went wrong and where.
