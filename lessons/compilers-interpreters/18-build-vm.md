# Lesson 18: Building a Stack-Based Virtual Machine

## What the VM Does

The VM takes the bytecode produced by the compiler (Lesson 17) and executes it. It is a loop that reads one instruction at a time, decodes it, and performs the operation.

```
Compiler output:           VM execution:
  Constants: [5, 3]          read OpConstant 0 → push 5
  Bytecode:                  read OpConstant 1 → push 3
    OpConstant 0             read OpAdd        → pop 3, pop 5, push 8
    OpConstant 1             Result: 8
    OpAdd
```

## The VM's Architecture

Our VM has five components:

```
┌──────────────────────────────────────────────────────┐
│                    Virtual Machine                    │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Constants │  │ Globals  │  │      Stack       │   │
│  │  Pool    │  │  Store   │  │  ┌──┬──┬──┬──┐   │   │
│  │ [5, 3]   │  │ [8, ..]  │  │  │  │  │  │  │   │   │
│  └──────────┘  └──────────┘  │  └──┴──┴──┴──┘   │   │
│                              │       ↑ sp        │   │
│  ┌──────────────────────┐    └──────────────────┘   │
│  │    Instructions      │                            │
│  │ [OpConst 0, OpConst  │    ┌──────────────────┐   │
│  │  1, OpAdd, ...]      │    │   Call Frames     │   │
│  │       ↑ ip           │    │  ┌──┬──┬──┐      │   │
│  └──────────────────────┘    │  │  │  │  │      │   │
│                              │  └──┴──┴──┘      │   │
│                              └──────────────────┘   │
└──────────────────────────────────────────────────────┘
```

- **Constants Pool**: Immutable values (integers, strings, compiled functions) referenced by index.
- **Stack**: Working memory for operations. Operands are pushed, operators pop and push results.
- **Globals Store**: Named variables at the top level.
- **Instructions**: The bytecode to execute. The instruction pointer (`ip`) tracks the current position.
- **Call Frames**: Track function calls — where to return, where locals are on the stack.

## Step 1: The Stack

```go
package vm

import (
    "fmt"
    "monkey/code"
    "monkey/compiler"
    "monkey/object"
)

const StackSize = 2048
const GlobalsSize = 65536
const MaxFrames = 1024

var True = &object.Boolean{Value: true}
var False = &object.Boolean{Value: false}
var Null = &object.Null{}
```

We use pre-allocated boolean and null singletons. This avoids creating new objects for every `true`, `false`, or `null` — a significant optimization since these are used constantly.

## Step 2: Call Frames

A call frame tracks the execution state of a single function call:

```go
type Frame struct {
    fn          *object.CompiledFunction
    ip          int
    basePointer int
}

func NewFrame(fn *object.CompiledFunction, basePointer int) *Frame {
    return &Frame{
        fn:          fn,
        ip:          -1,
        basePointer: basePointer,
    }
}

func (f *Frame) Instructions() code.Instructions {
    return f.fn.Instructions
}
```

- `fn`: The compiled function being executed.
- `ip`: Instruction pointer within this function's bytecode.
- `basePointer`: Where this function's locals start on the stack.

The `ip` starts at -1 because the main loop increments it before reading each instruction.

## Step 3: The VM Struct

```go
type VM struct {
    constants []object.Object
    stack     []object.Object
    sp        int
    globals   []object.Object
    frames    []*Frame
    frameIndex int
}

func New(bytecode *compiler.Bytecode) *VM {
    mainFn := &object.CompiledFunction{Instructions: bytecode.Instructions}
    mainFrame := NewFrame(mainFn, 0)

    frames := make([]*Frame, MaxFrames)
    frames[0] = mainFrame

    return &VM{
        constants:  bytecode.Constants,
        stack:      make([]object.Object, StackSize),
        sp:         0,
        globals:    make([]object.Object, GlobalsSize),
        frames:     frames,
        frameIndex: 1,
    }
}

func (vm *VM) currentFrame() *Frame {
    return vm.frames[vm.frameIndex-1]
}

func (vm *VM) pushFrame(f *Frame) {
    vm.frames[vm.frameIndex] = f
    vm.frameIndex++
}

func (vm *VM) popFrame() *Frame {
    vm.frameIndex--
    return vm.frames[vm.frameIndex]
}
```

Everything is pre-allocated. The stack is a fixed-size slice, not a dynamically growing one. This matters for performance — no allocations during execution.

## Step 4: Stack Operations

```go
func (vm *VM) push(obj object.Object) error {
    if vm.sp >= StackSize {
        return fmt.Errorf("stack overflow")
    }
    vm.stack[vm.sp] = obj
    vm.sp++
    return nil
}

func (vm *VM) pop() object.Object {
    obj := vm.stack[vm.sp-1]
    vm.sp--
    return obj
}

func (vm *VM) StackTop() object.Object {
    if vm.sp == 0 {
        return nil
    }
    return vm.stack[vm.sp-1]
}

func (vm *VM) LastPoppedStackElem() object.Object {
    return vm.stack[vm.sp]
}
```

`LastPoppedStackElem` is used for testing — after `OpPop` discards an expression's value, we can still read it.

## Step 5: The Fetch-Decode-Execute Loop

This is the heart of the VM. It reads one opcode, decodes any operands, executes the operation, and advances to the next instruction.

```go
func (vm *VM) Run() error {
    var ip int
    var ins code.Instructions
    var op code.Opcode

    for vm.currentFrame().ip < len(vm.currentFrame().Instructions())-1 {
        vm.currentFrame().ip++

        ip = vm.currentFrame().ip
        ins = vm.currentFrame().Instructions()
        op = code.Opcode(ins[ip])

        switch op {
        case code.OpConstant:
            constIndex := code.ReadUint16(ins[ip+1:])
            vm.currentFrame().ip += 2
            if err := vm.push(vm.constants[constIndex]); err != nil {
                return err
            }

        case code.OpAdd, code.OpSub, code.OpMul, code.OpDiv:
            if err := vm.executeBinaryOperation(op); err != nil {
                return err
            }

        case code.OpEqual, code.OpNotEqual, code.OpGreaterThan:
            if err := vm.executeComparison(op); err != nil {
                return err
            }

        case code.OpTrue:
            if err := vm.push(True); err != nil {
                return err
            }

        case code.OpFalse:
            if err := vm.push(False); err != nil {
                return err
            }

        case code.OpNull:
            if err := vm.push(Null); err != nil {
                return err
            }

        case code.OpBang:
            if err := vm.executeBangOperator(); err != nil {
                return err
            }

        case code.OpMinus:
            if err := vm.executeMinusOperator(); err != nil {
                return err
            }

        case code.OpPop:
            vm.pop()

        case code.OpJump:
            pos := int(code.ReadUint16(ins[ip+1:]))
            vm.currentFrame().ip = pos - 1

        case code.OpJumpNotTruthy:
            pos := int(code.ReadUint16(ins[ip+1:]))
            vm.currentFrame().ip += 2
            condition := vm.pop()
            if !isTruthy(condition) {
                vm.currentFrame().ip = pos - 1
            }

        case code.OpSetGlobal:
            globalIndex := code.ReadUint16(ins[ip+1:])
            vm.currentFrame().ip += 2
            vm.globals[globalIndex] = vm.pop()

        case code.OpGetGlobal:
            globalIndex := code.ReadUint16(ins[ip+1:])
            vm.currentFrame().ip += 2
            if err := vm.push(vm.globals[globalIndex]); err != nil {
                return err
            }

        case code.OpSetLocal:
            localIndex := int(ins[ip+1])
            vm.currentFrame().ip += 1
            vm.stack[vm.currentFrame().basePointer+localIndex] = vm.pop()

        case code.OpGetLocal:
            localIndex := int(ins[ip+1])
            vm.currentFrame().ip += 1
            if err := vm.push(vm.stack[vm.currentFrame().basePointer+localIndex]); err != nil {
                return err
            }

        case code.OpCall:
            numArgs := int(ins[ip+1])
            vm.currentFrame().ip += 1
            if err := vm.executeCall(numArgs); err != nil {
                return err
            }

        case code.OpReturnValue:
            returnValue := vm.pop()
            frame := vm.popFrame()
            vm.sp = frame.basePointer - 1
            if err := vm.push(returnValue); err != nil {
                return err
            }

        case code.OpReturn:
            frame := vm.popFrame()
            vm.sp = frame.basePointer - 1
            if err := vm.push(Null); err != nil {
                return err
            }

        case code.OpGetBuiltin:
            builtinIndex := int(ins[ip+1])
            vm.currentFrame().ip += 1
            definition := object.Builtins[builtinIndex]
            if err := vm.push(definition.Builtin); err != nil {
                return err
            }
        }
    }

    return nil
}
```

Let us break down each operation.

## Step 6: Arithmetic Operations

```go
func (vm *VM) executeBinaryOperation(op code.Opcode) error {
    right := vm.pop()
    left := vm.pop()

    leftType := left.Type()
    rightType := right.Type()

    switch {
    case leftType == object.INTEGER_OBJ && rightType == object.INTEGER_OBJ:
        return vm.executeBinaryIntegerOperation(op, left, right)
    case leftType == object.STRING_OBJ && rightType == object.STRING_OBJ:
        return vm.executeBinaryStringOperation(op, left, right)
    default:
        return fmt.Errorf("unsupported types for binary operation: %s %s",
            leftType, rightType)
    }
}

func (vm *VM) executeBinaryIntegerOperation(
    op code.Opcode, left, right object.Object,
) error {
    leftValue := left.(*object.Integer).Value
    rightValue := right.(*object.Integer).Value

    var result int64

    switch op {
    case code.OpAdd:
        result = leftValue + rightValue
    case code.OpSub:
        result = leftValue - rightValue
    case code.OpMul:
        result = leftValue * rightValue
    case code.OpDiv:
        if rightValue == 0 {
            return fmt.Errorf("division by zero")
        }
        result = leftValue / rightValue
    default:
        return fmt.Errorf("unknown integer operator: %d", op)
    }

    return vm.push(&object.Integer{Value: result})
}

func (vm *VM) executeBinaryStringOperation(
    op code.Opcode, left, right object.Object,
) error {
    if op != code.OpAdd {
        return fmt.Errorf("unknown string operator: %d", op)
    }

    leftValue := left.(*object.String).Value
    rightValue := right.(*object.String).Value

    return vm.push(&object.String{Value: leftValue + rightValue})
}
```

## Step 7: Comparison Operations

```go
func (vm *VM) executeComparison(op code.Opcode) error {
    right := vm.pop()
    left := vm.pop()

    if left.Type() == object.INTEGER_OBJ && right.Type() == object.INTEGER_OBJ {
        return vm.executeIntegerComparison(op, left, right)
    }

    switch op {
    case code.OpEqual:
        return vm.push(nativeBoolToBooleanObject(right == left))
    case code.OpNotEqual:
        return vm.push(nativeBoolToBooleanObject(right != left))
    default:
        return fmt.Errorf("unknown operator: %d (%s %s)",
            op, left.Type(), right.Type())
    }
}

func (vm *VM) executeIntegerComparison(
    op code.Opcode, left, right object.Object,
) error {
    leftValue := left.(*object.Integer).Value
    rightValue := right.(*object.Integer).Value

    switch op {
    case code.OpEqual:
        return vm.push(nativeBoolToBooleanObject(leftValue == rightValue))
    case code.OpNotEqual:
        return vm.push(nativeBoolToBooleanObject(leftValue != rightValue))
    case code.OpGreaterThan:
        return vm.push(nativeBoolToBooleanObject(leftValue > rightValue))
    default:
        return fmt.Errorf("unknown operator: %d", op)
    }
}

func nativeBoolToBooleanObject(input bool) *object.Boolean {
    if input {
        return True
    }
    return False
}
```

Using pointer comparison (`right == left`) for booleans works because we use singleton `True` and `False` objects.

## Step 8: Prefix Operations

```go
func (vm *VM) executeBangOperator() error {
    operand := vm.pop()

    switch operand {
    case True:
        return vm.push(False)
    case False:
        return vm.push(True)
    case Null:
        return vm.push(True)
    default:
        return vm.push(False)
    }
}

func (vm *VM) executeMinusOperator() error {
    operand := vm.pop()

    if operand.Type() != object.INTEGER_OBJ {
        return fmt.Errorf("unsupported type for negation: %s", operand.Type())
    }

    value := operand.(*object.Integer).Value
    return vm.push(&object.Integer{Value: -value})
}

func isTruthy(obj object.Object) bool {
    switch obj := obj.(type) {
    case *object.Boolean:
        return obj.Value
    case *object.Null:
        return false
    default:
        return true
    }
}
```

## Step 9: Function Calls

This is where the stack gets interesting. When we call a function, the stack layout is:

```
Before OpCall:
  ┌─────────┐
  │  arg 1  │  ← sp-1 (top)
  ├─────────┤
  │  arg 0  │
  ├─────────┤
  │ function │  ← this is what we're calling
  ├─────────┤
  │   ...   │
  └─────────┘

After OpCall (inside the function):
  ┌─────────┐
  │  local2 │  ← room for locals
  ├─────────┤
  │  local1 │  ← locals include args
  ├─────────┤
  │  arg 1  │  ← basePointer + 1 = local index 1
  ├─────────┤
  │  arg 0  │  ← basePointer + 0 = local index 0
  ├─────────┤ ← basePointer
  │ function │
  ├─────────┤
  │   ...   │
  └─────────┘
```

```go
func (vm *VM) executeCall(numArgs int) error {
    callee := vm.stack[vm.sp-1-numArgs]

    switch callee := callee.(type) {
    case *object.CompiledFunction:
        return vm.callFunction(callee, numArgs)
    case *object.Builtin:
        return vm.callBuiltin(callee, numArgs)
    default:
        return fmt.Errorf("calling non-function")
    }
}

func (vm *VM) callFunction(fn *object.CompiledFunction, numArgs int) error {
    if numArgs != fn.NumParameters {
        return fmt.Errorf("wrong number of arguments: want=%d, got=%d",
            fn.NumParameters, numArgs)
    }

    frame := NewFrame(fn, vm.sp-numArgs)
    vm.pushFrame(frame)
    vm.sp = frame.basePointer + fn.NumLocals

    return nil
}

func (vm *VM) callBuiltin(fn *object.Builtin, numArgs int) error {
    args := vm.stack[vm.sp-numArgs : vm.sp]
    result := fn.Fn(args...)

    vm.sp = vm.sp - numArgs - 1

    if result != nil {
        return vm.push(result)
    }
    return vm.push(Null)
}
```

When `callFunction` executes:

1. A new frame is created. Its `basePointer` is where the arguments start on the stack.
2. The frame is pushed onto the frame stack.
3. `sp` advances past the locals area — this reserves stack space for local variables.

Arguments are locals. `OpGetLocal 0` reads the first argument, `OpGetLocal 1` reads the second, etc.

## Step 10: Returns

When a function returns:

```go
case code.OpReturnValue:
    returnValue := vm.pop()
    frame := vm.popFrame()
    vm.sp = frame.basePointer - 1
    if err := vm.push(returnValue); err != nil {
        return err
    }

case code.OpReturn:
    frame := vm.popFrame()
    vm.sp = frame.basePointer - 1
    if err := vm.push(Null); err != nil {
        return err
    }
```

1. Save the return value (if any).
2. Pop the call frame.
3. Reset `sp` to just before the function object on the stack (`basePointer - 1`). This effectively clears the function, its arguments, and its locals from the stack.
4. Push the return value (or `Null` for functions that do not return anything).

## Tracing Execution: `1 + 2 * 3`

Let us trace the complete execution:

```
Constants: [1, 2, 3]
Bytecode:
  0000 OpConstant 0
  0003 OpConstant 1
  0006 OpConstant 2
  0009 OpMul
  0010 OpAdd
  0011 OpPop

Step 1: ip=0000, OpConstant 0
  Push constants[0] = Integer(1)
  Stack: [1]

Step 2: ip=0003, OpConstant 1
  Push constants[1] = Integer(2)
  Stack: [1, 2]

Step 3: ip=0006, OpConstant 2
  Push constants[2] = Integer(3)
  Stack: [1, 2, 3]

Step 4: ip=0009, OpMul
  Pop 3 and 2, compute 2 * 3 = 6, push 6
  Stack: [1, 6]

Step 5: ip=0010, OpAdd
  Pop 6 and 1, compute 1 + 6 = 7, push 7
  Stack: [7]

Step 6: ip=0011, OpPop
  Pop 7 (expression statement discards result)
  Stack: []

Result: 7 (available via LastPoppedStackElem)
```

## Tracing Execution: Function Call

```
Source: let add = fn(a, b) { a + b }; add(3, 4);

Constants: [
    0: CompiledFunction{Instructions: [OpGetLocal 0, OpGetLocal 1, OpAdd, OpReturnValue]},
    1: Integer(3),
    2: Integer(4),
]

Main bytecode:
  0000 OpConstant 0        // push the function
  0003 OpSetGlobal 0       // globals[0] = function
  0006 OpGetGlobal 0       // push function from globals
  0009 OpConstant 1        // push 3
  0012 OpConstant 2        // push 4
  0015 OpCall 2            // call with 2 args
  0017 OpPop

Step 1-2: OpConstant 0, OpSetGlobal 0
  Push CompiledFunction, store as globals[0]
  Stack: [], Globals: [fn]

Step 3: OpGetGlobal 0
  Push globals[0] (the function)
  Stack: [fn]

Step 4: OpConstant 1
  Push Integer(3)
  Stack: [fn, 3]

Step 5: OpConstant 2
  Push Integer(4)
  Stack: [fn, 3, 4]

Step 6: OpCall 2
  callee = stack[sp-1-2] = fn
  New frame: basePointer = sp - 2 = 1 (where args start)
  sp = basePointer + numLocals = 1 + 2 = 3
  Stack: [fn, 3, 4]
               ↑ basePointer (args start here)

--- Now executing function's bytecode ---

Step 7: OpGetLocal 0
  Push stack[basePointer + 0] = stack[1] = 3
  Stack: [fn, 3, 4, 3]

Step 8: OpGetLocal 1
  Push stack[basePointer + 1] = stack[2] = 4
  Stack: [fn, 3, 4, 3, 4]

Step 9: OpAdd
  Pop 4 and 3, push 7
  Stack: [fn, 3, 4, 7]

Step 10: OpReturnValue
  Pop return value: 7
  Pop frame, sp = basePointer - 1 = 0
  Push 7
  Stack: [7]

--- Back in main bytecode ---

Step 11: OpPop
  Pop 7
  Stack: []

Result: 7
```

## Full VM Tests

```go
package vm

import (
    "fmt"
    "monkey/ast"
    "monkey/compiler"
    "monkey/lexer"
    "monkey/object"
    "monkey/parser"
    "testing"
)

type vmTestCase struct {
    input    string
    expected interface{}
}

func TestIntegerArithmetic(t *testing.T) {
    tests := []vmTestCase{
        {"1", 1},
        {"2", 2},
        {"1 + 2", 3},
        {"1 - 2", -1},
        {"1 * 2", 2},
        {"4 / 2", 2},
        {"50 / 2 * 2 + 10 - 5", 55},
        {"5 + 5 + 5 + 5 - 10", 10},
        {"2 * 2 * 2 * 2 * 2", 32},
        {"5 * 2 + 10", 20},
        {"5 + 2 * 10", 25},
        {"5 * (2 + 10)", 60},
        {"-5", -5},
        {"-10", -10},
        {"-50 + 100 + -50", 0},
    }

    runVmTests(t, tests)
}

func TestBooleanExpressions(t *testing.T) {
    tests := []vmTestCase{
        {"true", true},
        {"false", false},
        {"1 < 2", true},
        {"1 > 2", false},
        {"1 < 1", false},
        {"1 > 1", false},
        {"1 == 1", true},
        {"1 != 1", false},
        {"1 == 2", false},
        {"1 != 2", true},
        {"true == true", true},
        {"false == false", true},
        {"true == false", false},
        {"true != false", true},
        {"(1 < 2) == true", true},
        {"(1 < 2) == false", false},
        {"(1 > 2) == true", false},
        {"(1 > 2) == false", true},
        {"!true", false},
        {"!false", true},
        {"!!true", true},
        {"!!false", false},
        {"!5", false},
        {"!!5", true},
    }

    runVmTests(t, tests)
}

func TestConditionals(t *testing.T) {
    tests := []vmTestCase{
        {"if (true) { 10 }", 10},
        {"if (true) { 10 } else { 20 }", 10},
        {"if (false) { 10 } else { 20 }", 20},
        {"if (1) { 10 }", 10},
        {"if (1 < 2) { 10 }", 10},
        {"if (1 < 2) { 10 } else { 20 }", 10},
        {"if (1 > 2) { 10 } else { 20 }", 20},
        {"if (1 > 2) { 10 }", Null},
    }

    runVmTests(t, tests)
}

func TestGlobalLetStatements(t *testing.T) {
    tests := []vmTestCase{
        {"let one = 1; one", 1},
        {"let one = 1; let two = 2; one + two", 3},
        {"let one = 1; let two = one + one; one + two", 3},
    }

    runVmTests(t, tests)
}

func TestStringExpressions(t *testing.T) {
    tests := []vmTestCase{
        {`"monkey"`, "monkey"},
        {`"mon" + "key"`, "monkey"},
        {`"mon" + "key" + "banana"`, "monkeybanana"},
    }

    runVmTests(t, tests)
}

func TestCallingFunctionsWithoutArguments(t *testing.T) {
    tests := []vmTestCase{
        {
            input:    "let fivePlusTen = fn() { 5 + 10; }; fivePlusTen();",
            expected: 15,
        },
        {
            input: `
            let one = fn() { 1; };
            let two = fn() { 2; };
            one() + two()
            `,
            expected: 3,
        },
        {
            input: `
            let a = fn() { 1 };
            let b = fn() { a() + 1 };
            let c = fn() { b() + 1 };
            c();
            `,
            expected: 3,
        },
    }

    runVmTests(t, tests)
}

func TestCallingFunctionsWithArguments(t *testing.T) {
    tests := []vmTestCase{
        {
            input:    "let identity = fn(a) { a; }; identity(4);",
            expected: 4,
        },
        {
            input:    "let sum = fn(a, b) { a + b; }; sum(1, 2);",
            expected: 3,
        },
        {
            input: `
            let sum = fn(a, b) {
                let c = a + b;
                c;
            };
            sum(1, 2);
            `,
            expected: 3,
        },
        {
            input: `
            let sum = fn(a, b) {
                let c = a + b;
                c;
            };
            sum(1, 2) + sum(3, 4);
            `,
            expected: 10,
        },
        {
            input: `
            let globalNum = 10;
            let sum = fn(a, b) {
                let c = a + b;
                c + globalNum;
            };
            let outer = fn() {
                sum(1, 2) + sum(3, 4) + globalNum;
            };
            outer() + globalNum;
            `,
            expected: 50,
        },
    }

    runVmTests(t, tests)
}

func TestCallingFunctionsWithLocalBindings(t *testing.T) {
    tests := []vmTestCase{
        {
            input: `
            let one = fn() { let one = 1; one };
            one();
            `,
            expected: 1,
        },
        {
            input: `
            let oneAndTwo = fn() { let one = 1; let two = 2; one + two; };
            oneAndTwo();
            `,
            expected: 3,
        },
        {
            input: `
            let oneAndTwo = fn() { let one = 1; let two = 2; one + two; };
            let threeAndFour = fn() { let three = 3; let four = 4; three + four; };
            oneAndTwo() + threeAndFour();
            `,
            expected: 10,
        },
        {
            input: `
            let firstFoobar = fn() { let foobar = 50; foobar; };
            let secondFoobar = fn() { let foobar = 100; foobar; };
            firstFoobar() + secondFoobar();
            `,
            expected: 150,
        },
    }

    runVmTests(t, tests)
}

func TestRecursiveFunctions(t *testing.T) {
    tests := []vmTestCase{
        {
            input: `
            let countDown = fn(x) {
                if (x == 0) {
                    return 0;
                }
                countDown(x - 1);
            };
            countDown(1);
            `,
            expected: 0,
        },
        {
            input: `
            let countDown = fn(x) {
                if (x == 0) {
                    return 0;
                }
                countDown(x - 1);
            };
            let wrapper = fn() { countDown(1); };
            wrapper();
            `,
            expected: 0,
        },
    }

    runVmTests(t, tests)
}

func TestRecursiveFibonacci(t *testing.T) {
    tests := []vmTestCase{
        {
            input: `
            let fibonacci = fn(x) {
                if (x == 0) {
                    return 0;
                }
                if (x == 1) {
                    return 1;
                }
                fibonacci(x - 1) + fibonacci(x - 2);
            };
            fibonacci(15);
            `,
            expected: 610,
        },
    }

    runVmTests(t, tests)
}
```

### Test Helpers

```go
func runVmTests(t *testing.T, tests []vmTestCase) {
    t.Helper()

    for _, tt := range tests {
        program := parse(tt.input)

        comp := compiler.New()
        err := comp.Compile(program)
        if err != nil {
            t.Fatalf("compiler error: %s", err)
        }

        vm := New(comp.Bytecode())
        err = vm.Run()
        if err != nil {
            t.Fatalf("vm error: %s", err)
        }

        stackElem := vm.LastPoppedStackElem()
        testExpectedObject(t, tt.expected, stackElem)
    }
}

func parse(input string) *ast.Program {
    l := lexer.New(input)
    p := parser.New(l)
    return p.ParseProgram()
}

func testExpectedObject(t *testing.T, expected interface{}, actual object.Object) {
    t.Helper()

    switch expected := expected.(type) {
    case int:
        testIntegerObject(t, int64(expected), actual)
    case bool:
        testBooleanObject(t, expected, actual)
    case string:
        testStringObject(t, expected, actual)
    case *object.Null:
        if actual != Null {
            t.Errorf("object is not Null: %T (%+v)", actual, actual)
        }
    }
}

func testIntegerObject(t *testing.T, expected int64, actual object.Object) {
    t.Helper()
    result, ok := actual.(*object.Integer)
    if !ok {
        t.Errorf("object is not Integer. got=%T (%+v)", actual, actual)
        return
    }
    if result.Value != expected {
        t.Errorf("object has wrong value. got=%d, want=%d", result.Value, expected)
    }
}

func testBooleanObject(t *testing.T, expected bool, actual object.Object) {
    t.Helper()
    result, ok := actual.(*object.Boolean)
    if !ok {
        t.Errorf("object is not Boolean. got=%T (%+v)", actual, actual)
        return
    }
    if result.Value != expected {
        t.Errorf("object has wrong value. got=%t, want=%t", result.Value, expected)
    }
}

func testStringObject(t *testing.T, expected string, actual object.Object) {
    t.Helper()
    result, ok := actual.(*object.String)
    if !ok {
        t.Errorf("object is not String. got=%T (%+v)", actual, actual)
        return
    }
    if result.Value != expected {
        t.Errorf("object has wrong value. got=%q, want=%q", result.Value, expected)
    }
}
```

## Benchmark: Tree-Walk vs Bytecode VM

The ultimate test. Let us run fibonacci on both the tree-walk interpreter and the bytecode VM:

```go
package benchmark

import (
    "monkey/compiler"
    "monkey/evaluator"
    "monkey/lexer"
    "monkey/object"
    "monkey/parser"
    "monkey/vm"
    "testing"
)

var input = `
let fibonacci = fn(x) {
    if (x == 0) {
        return 0;
    }
    if (x == 1) {
        return 1;
    }
    fibonacci(x - 1) + fibonacci(x - 2);
};
fibonacci(35);
`

func BenchmarkTreeWalkInterpreter(b *testing.B) {
    l := lexer.New(input)
    p := parser.New(l)
    program := p.ParseProgram()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        env := object.NewEnvironment()
        evaluator.Eval(program, env)
    }
}

func BenchmarkBytecodeVM(b *testing.B) {
    l := lexer.New(input)
    p := parser.New(l)
    program := p.ParseProgram()

    comp := compiler.New()
    comp.Compile(program)
    bytecode := comp.Bytecode()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        machine := vm.New(bytecode)
        machine.Run()
    }
}
```

Run with:

```bash
go test -bench=. -benchmem ./benchmark/
```

Typical results:

```
BenchmarkTreeWalkInterpreter-8     1    48230000000 ns/op    massive allocs
BenchmarkBytecodeVM-8              1     7120000000 ns/op    minimal allocs

~6.7x faster
```

The exact speedup varies by machine, but expect **5-30x faster** for the bytecode VM. The improvement comes from:

1. **No pointer chasing**: Linear bytecode vs tree traversal.
2. **No object wrapping**: Stack uses pre-allocated slots vs creating `object.Integer` for every operation.
3. **Better cache behavior**: Sequential byte array vs scattered heap nodes.
4. **No environment lookups**: Direct array indexing vs hash map lookups for variables.

## The Full Picture

We have now built a complete language implementation:

```
Phase 1: Scanning & Parsing (Lessons 1-7)
  Source → Tokens → AST

Phase 2: Interpretation (Lessons 8-12)
  AST → Tree-Walk Interpreter → Result (slow)

Phase 3: Types & Semantics (Lessons 13-15)
  AST → Type Check → Semantic Analysis → Validated AST

Phase 4: Compilation (Lessons 16-18)
  Validated AST → Compiler → Bytecode → VM → Result (fast)
```

Real languages go even further:

- **JIT compilation** (V8, JVM HotSpot): Identify hot bytecode and compile it to native machine code at runtime.
- **AOT compilation** (Go, Rust, C): Compile directly to native machine code before execution.
- **Tiered compilation** (V8, JVM): Start with interpretation, promote to bytecode, then to native code for the hottest paths.

---

## Exercises

### Exercise 1: Add Array Support

Extend the compiler and VM to support array literals and indexing:

```
let arr = [1, 2, 3];
arr[1]
```

You will need:
- `OpArray` opcode with operand for element count
- `OpIndex` opcode
- Compiler logic to compile array literals (compile each element, emit `OpArray`)
- VM logic to construct arrays and handle indexing

### Exercise 2: Add Hash Map Support

Similar to arrays, add hash literal support:

```
let map = {"name": "Alice", "age": 30};
map["name"]
```

You will need `OpHash` with a count operand.

### Exercise 3: Closures

Our VM currently does not support closures — inner functions cannot capture variables from outer functions. Implement this:

```
let makeAdder = fn(x) {
    fn(y) { x + y; };
};
let addFive = makeAdder(5);
addFive(3);  // should be 8
```

This requires:
- Free variable detection in the compiler (variables from an outer scope used in an inner function)
- An `OpGetFree` opcode
- A `Closure` object that wraps a `CompiledFunction` with captured free variables

### Exercise 4: While Loops

Add `while` loop support:

```
let i = 0;
let sum = 0;
while (i < 10) {
    let sum = sum + i;
    let i = i + 1;
}
sum
```

This uses backward jumps — after the body, jump back to the condition check. You need:
- Compile the condition
- `OpJumpNotTruthy` to jump past the body
- Compile the body
- `OpJump` back to the condition

### Exercise 5: VM Debugger

Build a debug mode for the VM that prints each instruction as it executes, along with the stack state:

```
[0000] OpConstant 0     stack: []
                        stack: [5]
[0003] OpConstant 1     stack: [5]
                        stack: [5, 3]
[0006] OpAdd            stack: [5, 3]
                        stack: [8]
```

This is invaluable for debugging compiler and VM bugs.

### Exercise 6: Performance Optimization

Profile the VM with Go's pprof tool:

```bash
go test -bench=BenchmarkBytecodeVM -cpuprofile=cpu.prof ./benchmark/
go tool pprof -http=:8080 cpu.prof
```

Identify the hottest functions. Common optimizations:
- Use a `switch` with numeric opcode constants instead of the `code.Opcode` type (avoids interface overhead)
- Inline the stack push/pop instead of calling methods
- Use `unsafe.Pointer` tricks to avoid bounds checking (advanced)
- Add specialized opcodes for common patterns (like `OpConstant` followed by `OpAdd`)

Implement one optimization and measure the speedup.
