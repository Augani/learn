# Lesson 17: Building a Bytecode Compiler

## What the Compiler Does

The compiler walks the AST and emits bytecode — a flat sequence of bytes that the VM can execute. It translates the tree structure into a linear instruction stream.

```
AST:                           Bytecode:
  InfixExpression(+)           OpConstant 0    // push 5
  ├── IntLit(5)                OpConstant 1    // push 3
  └── IntLit(3)                OpAdd           // pop two, push 8
```

The compiler is the bridge between the parser's output and the VM's input.

## Step 1: Define Opcodes

Every instruction starts with a single byte — the **opcode** — that tells the VM what to do. Some opcodes are followed by operand bytes.

```go
package code

type Opcode byte

const (
    OpConstant Opcode = iota
    OpAdd
    OpSub
    OpMul
    OpDiv
    OpTrue
    OpFalse
    OpEqual
    OpNotEqual
    OpGreaterThan
    OpMinus
    OpBang
    OpPop
    OpJump
    OpJumpNotTruthy
    OpNull
    OpSetGlobal
    OpGetGlobal
    OpSetLocal
    OpGetLocal
    OpCall
    OpReturnValue
    OpReturn
    OpGetBuiltin
)
```

Each opcode needs metadata: how many operand bytes follow, and what they mean.

```go
package code

type Definition struct {
    Name          string
    OperandWidths []int
}

var definitions = map[Opcode]*Definition{
    OpConstant:      {"OpConstant", []int{2}},
    OpAdd:           {"OpAdd", []int{}},
    OpSub:           {"OpSub", []int{}},
    OpMul:           {"OpMul", []int{}},
    OpDiv:           {"OpDiv", []int{}},
    OpTrue:          {"OpTrue", []int{}},
    OpFalse:         {"OpFalse", []int{}},
    OpEqual:         {"OpEqual", []int{}},
    OpNotEqual:      {"OpNotEqual", []int{}},
    OpGreaterThan:   {"OpGreaterThan", []int{}},
    OpMinus:         {"OpMinus", []int{}},
    OpBang:          {"OpBang", []int{}},
    OpPop:           {"OpPop", []int{}},
    OpJump:          {"OpJump", []int{2}},
    OpJumpNotTruthy: {"OpJumpNotTruthy", []int{2}},
    OpNull:          {"OpNull", []int{}},
    OpSetGlobal:     {"OpSetGlobal", []int{2}},
    OpGetGlobal:     {"OpGetGlobal", []int{2}},
    OpSetLocal:      {"OpSetLocal", []int{1}},
    OpGetLocal:      {"OpGetLocal", []int{1}},
    OpCall:          {"OpCall", []int{1}},
    OpReturnValue:   {"OpReturnValue", []int{}},
    OpReturn:        {"OpReturn", []int{}},
    OpGetBuiltin:    {"OpGetBuiltin", []int{1}},
}

func Lookup(op Opcode) (*Definition, error) {
    def, ok := definitions[op]
    if !ok {
        return nil, fmt.Errorf("opcode %d undefined", op)
    }
    return def, nil
}
```

`OperandWidths` tells us how many bytes each operand takes. `OpConstant` has one operand that is 2 bytes wide (big-endian uint16, supporting up to 65535 constants). `OpAdd` has no operands.

## Step 2: Instruction Encoding

We need functions to encode opcodes + operands into bytes and decode them back.

```go
package code

import (
    "encoding/binary"
    "fmt"
)

type Instructions []byte

func Make(op Opcode, operands ...int) []byte {
    def, ok := definitions[op]
    if !ok {
        return []byte{}
    }

    instructionLen := 1
    for _, w := range def.OperandWidths {
        instructionLen += w
    }

    instruction := make([]byte, instructionLen)
    instruction[0] = byte(op)

    offset := 1
    for i, operand := range operands {
        width := def.OperandWidths[i]
        switch width {
        case 2:
            binary.BigEndian.PutUint16(instruction[offset:], uint16(operand))
        case 1:
            instruction[offset] = byte(operand)
        }
        offset += width
    }

    return instruction
}

func ReadOperands(def *Definition, ins Instructions) ([]int, int) {
    operands := make([]int, len(def.OperandWidths))
    offset := 0

    for i, width := range def.OperandWidths {
        switch width {
        case 2:
            operands[i] = int(ReadUint16(ins[offset:]))
        case 1:
            operands[i] = int(ins[offset])
        }
        offset += width
    }

    return operands, offset
}

func ReadUint16(ins Instructions) uint16 {
    return binary.BigEndian.Uint16(ins)
}
```

### Testing Instruction Encoding

```go
package code

import "testing"

func TestMake(t *testing.T) {
    tests := []struct {
        op       Opcode
        operands []int
        expected []byte
    }{
        {OpConstant, []int{65534}, []byte{byte(OpConstant), 255, 254}},
        {OpAdd, []int{}, []byte{byte(OpAdd)}},
        {OpGetLocal, []int{255}, []byte{byte(OpGetLocal), 255}},
    }

    for _, tt := range tests {
        instruction := Make(tt.op, tt.operands...)

        if len(instruction) != len(tt.expected) {
            t.Errorf("instruction has wrong length. want=%d, got=%d",
                len(tt.expected), len(instruction))
            continue
        }

        for i, b := range tt.expected {
            if instruction[i] != b {
                t.Errorf("wrong byte at pos %d. want=%d, got=%d",
                    i, b, instruction[i])
            }
        }
    }
}
```

## Step 3: Disassembler

For debugging, we need a way to read bytecode as human-readable text:

```go
package code

import "fmt"

func (ins Instructions) String() string {
    var out string
    i := 0

    for i < len(ins) {
        def, err := Lookup(Opcode(ins[i]))
        if err != nil {
            out += fmt.Sprintf("ERROR: %s\n", err)
            i++
            continue
        }

        operands, read := ReadOperands(def, ins[i+1:])
        out += fmt.Sprintf("%04d %s\n", i, formatInstruction(def, operands))
        i += 1 + read
    }

    return out
}

func formatInstruction(def *Definition, operands []int) string {
    operandCount := len(def.OperandWidths)

    if operandCount != len(operands) {
        return fmt.Sprintf("ERROR: operand len %d does not match defined %d",
            len(operands), operandCount)
    }

    switch operandCount {
    case 0:
        return def.Name
    case 1:
        return fmt.Sprintf("%s %d", def.Name, operands[0])
    case 2:
        return fmt.Sprintf("%s %d %d", def.Name, operands[0], operands[1])
    }

    return fmt.Sprintf("ERROR: unhandled operandCount for %s", def.Name)
}
```

Now we can print bytecode:

```
0000 OpConstant 0
0003 OpConstant 1
0006 OpAdd
0007 OpPop
```

## Step 4: The Compiler

### Compiled Object

The compiler produces a `Bytecode` struct containing the instructions and constants:

```go
package compiler

import (
    "monkey/code"
    "monkey/object"
)

type Bytecode struct {
    Instructions code.Instructions
    Constants    []object.Object
}
```

### Emitted Instruction Tracking

We need to track recently emitted instructions for optimization (like removing unnecessary `OpPop`):

```go
type EmittedInstruction struct {
    Opcode   code.Opcode
    Position int
}
```

### Compilation Scope

Functions have their own instruction streams. We use a scope stack:

```go
type CompilationScope struct {
    instructions        code.Instructions
    lastInstruction     EmittedInstruction
    previousInstruction EmittedInstruction
}
```

### The Compiler Struct

```go
package compiler

import (
    "fmt"
    "monkey/ast"
    "monkey/code"
    "monkey/object"
)

type Compiler struct {
    constants   []object.Object
    symbolTable *SymbolTable
    scopes      []CompilationScope
    scopeIndex  int
}

func New() *Compiler {
    mainScope := CompilationScope{
        instructions: code.Instructions{},
    }

    symbolTable := NewSymbolTable()

    return &Compiler{
        constants:   []object.Object{},
        symbolTable: symbolTable,
        scopes:      []CompilationScope{mainScope},
        scopeIndex:  0,
    }
}

func (c *Compiler) currentInstructions() code.Instructions {
    return c.scopes[c.scopeIndex].instructions
}

func (c *Compiler) Bytecode() *Bytecode {
    return &Bytecode{
        Instructions: c.currentInstructions(),
        Constants:    c.constants,
    }
}
```

### Emitting Instructions

```go
func (c *Compiler) emit(op code.Opcode, operands ...int) int {
    ins := code.Make(op, operands...)
    pos := c.addInstruction(ins)

    c.setLastInstruction(op, pos)
    return pos
}

func (c *Compiler) addInstruction(ins []byte) int {
    posNewInstruction := len(c.currentInstructions())
    updatedInstructions := append(c.currentInstructions(), ins...)
    c.scopes[c.scopeIndex].instructions = updatedInstructions
    return posNewInstruction
}

func (c *Compiler) setLastInstruction(op code.Opcode, pos int) {
    previous := c.scopes[c.scopeIndex].lastInstruction
    last := EmittedInstruction{Opcode: op, Position: pos}
    c.scopes[c.scopeIndex].previousInstruction = previous
    c.scopes[c.scopeIndex].lastInstruction = last
}
```

### Adding Constants

Constants (integer literals, string literals, compiled functions) go into the constants pool:

```go
func (c *Compiler) addConstant(obj object.Object) int {
    c.constants = append(c.constants, obj)
    return len(c.constants) - 1
}
```

The returned index is used as the operand to `OpConstant`.

## Step 5: Compiling Expressions

### The Main Compile Method

```go
func (c *Compiler) Compile(node ast.Node) error {
    switch node := node.(type) {
    case *ast.Program:
        for _, s := range node.Statements {
            if err := c.Compile(s); err != nil {
                return err
            }
        }

    case *ast.ExpressionStatement:
        if err := c.Compile(node.Expression); err != nil {
            return err
        }
        c.emit(code.OpPop)

    case *ast.IntegerLiteral:
        integer := &object.Integer{Value: node.Value}
        c.emit(code.OpConstant, c.addConstant(integer))

    case *ast.StringLiteral:
        str := &object.String{Value: node.Value}
        c.emit(code.OpConstant, c.addConstant(str))

    case *ast.Boolean:
        if node.Value {
            c.emit(code.OpTrue)
        } else {
            c.emit(code.OpFalse)
        }

    case *ast.InfixExpression:
        return c.compileInfix(node)

    case *ast.PrefixExpression:
        return c.compilePrefix(node)

    case *ast.IfExpression:
        return c.compileIf(node)

    case *ast.LetStatement:
        return c.compileLet(node)

    case *ast.Identifier:
        return c.compileIdentifier(node)

    case *ast.FunctionLiteral:
        return c.compileFunction(node)

    case *ast.CallExpression:
        return c.compileCall(node)

    case *ast.ReturnStatement:
        if err := c.Compile(node.ReturnValue); err != nil {
            return err
        }
        c.emit(code.OpReturnValue)

    case *ast.BlockStatement:
        for _, s := range node.Statements {
            if err := c.Compile(s); err != nil {
                return err
            }
        }
    }

    return nil
}
```

### Compiling Integer Literals

The simplest case. Create an `object.Integer`, add it to the constants pool, emit `OpConstant` with its index:

```go
case *ast.IntegerLiteral:
    integer := &object.Integer{Value: node.Value}
    c.emit(code.OpConstant, c.addConstant(integer))
```

For `5 + 3`:

```
Constants: [Integer(5), Integer(3)]
Bytecode:
  0000 OpConstant 0     // push 5
  0003 OpConstant 1     // push 3
  0006 OpAdd
```

### Compiling Infix Expressions

Compile left side, compile right side, emit the operator:

```go
func (c *Compiler) compileInfix(node *ast.InfixExpression) error {
    if node.Operator == "<" {
        if err := c.Compile(node.Right); err != nil {
            return err
        }
        if err := c.Compile(node.Left); err != nil {
            return err
        }
        c.emit(code.OpGreaterThan)
        return nil
    }

    if err := c.Compile(node.Left); err != nil {
        return err
    }
    if err := c.Compile(node.Right); err != nil {
        return err
    }

    switch node.Operator {
    case "+":
        c.emit(code.OpAdd)
    case "-":
        c.emit(code.OpSub)
    case "*":
        c.emit(code.OpMul)
    case "/":
        c.emit(code.OpDiv)
    case "==":
        c.emit(code.OpEqual)
    case "!=":
        c.emit(code.OpNotEqual)
    case ">":
        c.emit(code.OpGreaterThan)
    default:
        return fmt.Errorf("unknown operator %s", node.Operator)
    }

    return nil
}
```

Notice the `<` trick: instead of adding an `OpLessThan` opcode, we compile the operands in reverse order and use `OpGreaterThan`. `a < b` is the same as `b > a`. This keeps our instruction set smaller.

### Compiling Prefix Expressions

```go
func (c *Compiler) compilePrefix(node *ast.PrefixExpression) error {
    if err := c.Compile(node.Right); err != nil {
        return err
    }

    switch node.Operator {
    case "-":
        c.emit(code.OpMinus)
    case "!":
        c.emit(code.OpBang)
    default:
        return fmt.Errorf("unknown prefix operator %s", node.Operator)
    }

    return nil
}
```

## Step 6: Compiling If/Else (Forward Patching)

This is the trickiest part. When we compile `if (condition) { consequence } else { alternative }`, we need jump instructions — but we do not know the jump targets yet.

```
  0000  [compile condition]
  ????  OpJumpNotTruthy ????     ← we don't know where else starts
  ????  [compile consequence]
  ????  OpJump ????              ← we don't know where to jump after else
  ????  [compile alternative]
  ????  [continue]
```

The solution: **emit a placeholder**, then **patch it later**.

```go
func (c *Compiler) compileIf(node *ast.IfExpression) error {
    if err := c.Compile(node.Condition); err != nil {
        return err
    }

    jumpNotTruthyPos := c.emit(code.OpJumpNotTruthy, 9999)

    if err := c.Compile(node.Consequence); err != nil {
        return err
    }

    if c.lastInstructionIs(code.OpPop) {
        c.removeLastPop()
    }

    jumpPos := c.emit(code.OpJump, 9999)

    afterConsequencePos := len(c.currentInstructions())
    c.changeOperand(jumpNotTruthyPos, afterConsequencePos)

    if node.Alternative == nil {
        c.emit(code.OpNull)
    } else {
        if err := c.Compile(node.Alternative); err != nil {
            return err
        }

        if c.lastInstructionIs(code.OpPop) {
            c.removeLastPop()
        }
    }

    afterAlternativePos := len(c.currentInstructions())
    c.changeOperand(jumpPos, afterAlternativePos)

    return nil
}
```

### Helper Methods for Patching

```go
func (c *Compiler) changeOperand(opPos int, operand int) {
    op := code.Opcode(c.currentInstructions()[opPos])
    newInstruction := code.Make(op, operand)

    c.replaceInstruction(opPos, newInstruction)
}

func (c *Compiler) replaceInstruction(pos int, newInstruction []byte) {
    ins := c.currentInstructions()
    for i := 0; i < len(newInstruction); i++ {
        ins[pos+i] = newInstruction[i]
    }
}

func (c *Compiler) lastInstructionIs(op code.Opcode) bool {
    if len(c.currentInstructions()) == 0 {
        return false
    }
    return c.scopes[c.scopeIndex].lastInstruction.Opcode == op
}

func (c *Compiler) removeLastPop() {
    last := c.scopes[c.scopeIndex].lastInstruction
    previous := c.scopes[c.scopeIndex].previousInstruction

    old := c.currentInstructions()
    c.scopes[c.scopeIndex].instructions = old[:last.Position]
    c.scopes[c.scopeIndex].lastInstruction = previous
}
```

We remove trailing `OpPop` instructions from if/else branches because the if expression itself produces a value. Without this, the consequence's value would be popped before the if expression could use it.

## Step 7: Compiling Variables

### The Symbol Table

The compiler uses a symbol table to assign indices to variables:

```go
package compiler

type SymbolScope string

const (
    GlobalScope  SymbolScope = "GLOBAL"
    LocalScope   SymbolScope = "LOCAL"
    BuiltinScope SymbolScope = "BUILTIN"
)

type Symbol struct {
    Name  string
    Scope SymbolScope
    Index int
}

type SymbolTable struct {
    store          map[string]Symbol
    numDefinitions int
    Outer          *SymbolTable
}

func NewSymbolTable() *SymbolTable {
    return &SymbolTable{
        store: make(map[string]Symbol),
    }
}

func NewEnclosedSymbolTable(outer *SymbolTable) *SymbolTable {
    s := NewSymbolTable()
    s.Outer = outer
    return s
}

func (s *SymbolTable) Define(name string) Symbol {
    symbol := Symbol{Name: name, Index: s.numDefinitions}
    if s.Outer == nil {
        symbol.Scope = GlobalScope
    } else {
        symbol.Scope = LocalScope
    }
    s.store[name] = symbol
    s.numDefinitions++
    return symbol
}

func (s *SymbolTable) Resolve(name string) (Symbol, bool) {
    obj, ok := s.store[name]
    if !ok && s.Outer != nil {
        obj, ok = s.Outer.Resolve(name)
        return obj, ok
    }
    return obj, ok
}
```

### Compiling Let Statements

```go
func (c *Compiler) compileLet(node *ast.LetStatement) error {
    symbol := c.symbolTable.Define(node.Name.Value)

    if err := c.Compile(node.Value); err != nil {
        return err
    }

    if symbol.Scope == GlobalScope {
        c.emit(code.OpSetGlobal, symbol.Index)
    } else {
        c.emit(code.OpSetLocal, symbol.Index)
    }

    return nil
}
```

### Compiling Identifiers

```go
func (c *Compiler) compileIdentifier(node *ast.Identifier) error {
    symbol, ok := c.symbolTable.Resolve(node.Value)
    if !ok {
        return fmt.Errorf("undefined variable %s", node.Value)
    }

    c.loadSymbol(symbol)
    return nil
}

func (c *Compiler) loadSymbol(s Symbol) {
    switch s.Scope {
    case GlobalScope:
        c.emit(code.OpGetGlobal, s.Index)
    case LocalScope:
        c.emit(code.OpGetLocal, s.Index)
    case BuiltinScope:
        c.emit(code.OpGetBuiltin, s.Index)
    }
}
```

## Step 8: Compiling Functions

Functions get their own compilation scope. The body is compiled into a separate instruction stream, then wrapped in a `CompiledFunction` object and added to the constants pool.

```go
func (c *Compiler) enterScope() {
    scope := CompilationScope{
        instructions: code.Instructions{},
    }
    c.scopes = append(c.scopes, scope)
    c.scopeIndex++
    c.symbolTable = NewEnclosedSymbolTable(c.symbolTable)
}

func (c *Compiler) leaveScope() code.Instructions {
    instructions := c.currentInstructions()

    c.scopes = c.scopes[:len(c.scopes)-1]
    c.scopeIndex--
    c.symbolTable = c.symbolTable.Outer

    return instructions
}

func (c *Compiler) compileFunction(node *ast.FunctionLiteral) error {
    c.enterScope()

    for _, p := range node.Parameters {
        c.symbolTable.Define(p.Value)
    }

    if err := c.Compile(node.Body); err != nil {
        return err
    }

    if c.lastInstructionIs(code.OpPop) {
        c.replaceLastPopWithReturn()
    }
    if !c.lastInstructionIs(code.OpReturnValue) {
        c.emit(code.OpReturn)
    }

    numLocals := c.symbolTable.numDefinitions
    instructions := c.leaveScope()

    compiledFn := &object.CompiledFunction{
        Instructions:  instructions,
        NumLocals:     numLocals,
        NumParameters: len(node.Parameters),
    }

    c.emit(code.OpConstant, c.addConstant(compiledFn))
    return nil
}

func (c *Compiler) replaceLastPopWithReturn() {
    lastPos := c.scopes[c.scopeIndex].lastInstruction.Position
    c.replaceInstruction(lastPos, code.Make(code.OpReturnValue))
    c.scopes[c.scopeIndex].lastInstruction.Opcode = code.OpReturnValue
}
```

The `replaceLastPopWithReturn` handles implicit returns. In our language, the last expression in a function body is the return value. The compiler initially emits `OpPop` for expression statements, but for the last expression in a function, we replace `OpPop` with `OpReturnValue`.

### The CompiledFunction Object

```go
package object

import "monkey/code"

type CompiledFunction struct {
    Instructions  code.Instructions
    NumLocals     int
    NumParameters int
}

func (f *CompiledFunction) Type() ObjectType { return "COMPILED_FUNCTION" }
func (f *CompiledFunction) Inspect() string {
    return fmt.Sprintf("CompiledFunction[%p]", f)
}
```

## Step 9: Compiling Function Calls

```go
func (c *Compiler) compileCall(node *ast.CallExpression) error {
    if err := c.Compile(node.Function); err != nil {
        return err
    }

    for _, arg := range node.Arguments {
        if err := c.Compile(arg); err != nil {
            return err
        }
    }

    c.emit(code.OpCall, len(node.Arguments))
    return nil
}
```

The function is pushed onto the stack first, then each argument. `OpCall` tells the VM how many arguments to expect.

## Full Compiler Tests

```go
package compiler

import (
    "fmt"
    "monkey/ast"
    "monkey/code"
    "monkey/lexer"
    "monkey/object"
    "monkey/parser"
    "testing"
)

type compilerTestCase struct {
    input                string
    expectedConstants    []interface{}
    expectedInstructions []code.Instructions
}

func TestIntegerArithmetic(t *testing.T) {
    tests := []compilerTestCase{
        {
            input:             "1 + 2",
            expectedConstants: []interface{}{1, 2},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 0),
                code.Make(code.OpConstant, 1),
                code.Make(code.OpAdd),
                code.Make(code.OpPop),
            },
        },
        {
            input:             "1 - 2",
            expectedConstants: []interface{}{1, 2},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 0),
                code.Make(code.OpConstant, 1),
                code.Make(code.OpSub),
                code.Make(code.OpPop),
            },
        },
        {
            input:             "1 * 2",
            expectedConstants: []interface{}{1, 2},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 0),
                code.Make(code.OpConstant, 1),
                code.Make(code.OpMul),
                code.Make(code.OpPop),
            },
        },
        {
            input:             "2 / 1",
            expectedConstants: []interface{}{2, 1},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 0),
                code.Make(code.OpConstant, 1),
                code.Make(code.OpDiv),
                code.Make(code.OpPop),
            },
        },
    }

    runCompilerTests(t, tests)
}

func TestBooleanExpressions(t *testing.T) {
    tests := []compilerTestCase{
        {
            input:             "true",
            expectedConstants: []interface{}{},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpTrue),
                code.Make(code.OpPop),
            },
        },
        {
            input:             "false",
            expectedConstants: []interface{}{},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpFalse),
                code.Make(code.OpPop),
            },
        },
        {
            input:             "1 > 2",
            expectedConstants: []interface{}{1, 2},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 0),
                code.Make(code.OpConstant, 1),
                code.Make(code.OpGreaterThan),
                code.Make(code.OpPop),
            },
        },
        {
            input:             "1 < 2",
            expectedConstants: []interface{}{2, 1},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 0),
                code.Make(code.OpConstant, 1),
                code.Make(code.OpGreaterThan),
                code.Make(code.OpPop),
            },
        },
    }

    runCompilerTests(t, tests)
}

func TestGlobalLetStatements(t *testing.T) {
    tests := []compilerTestCase{
        {
            input:             "let one = 1; let two = 2;",
            expectedConstants: []interface{}{1, 2},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 0),
                code.Make(code.OpSetGlobal, 0),
                code.Make(code.OpConstant, 1),
                code.Make(code.OpSetGlobal, 1),
            },
        },
        {
            input:             "let one = 1; one;",
            expectedConstants: []interface{}{1},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 0),
                code.Make(code.OpSetGlobal, 0),
                code.Make(code.OpGetGlobal, 0),
                code.Make(code.OpPop),
            },
        },
    }

    runCompilerTests(t, tests)
}

func TestConditionals(t *testing.T) {
    tests := []compilerTestCase{
        {
            input:             "if (true) { 10 }; 3333;",
            expectedConstants: []interface{}{10, 3333},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpTrue),
                code.Make(code.OpJumpNotTruthy, 10),
                code.Make(code.OpConstant, 0),
                code.Make(code.OpJump, 11),
                code.Make(code.OpNull),
                code.Make(code.OpPop),
                code.Make(code.OpConstant, 1),
                code.Make(code.OpPop),
            },
        },
        {
            input:             "if (true) { 10 } else { 20 }; 3333;",
            expectedConstants: []interface{}{10, 20, 3333},
            expectedInstructions: []code.Instructions{
                code.Make(code.OpTrue),
                code.Make(code.OpJumpNotTruthy, 10),
                code.Make(code.OpConstant, 0),
                code.Make(code.OpJump, 13),
                code.Make(code.OpConstant, 1),
                code.Make(code.OpPop),
                code.Make(code.OpConstant, 2),
                code.Make(code.OpPop),
            },
        },
    }

    runCompilerTests(t, tests)
}

func TestFunctions(t *testing.T) {
    tests := []compilerTestCase{
        {
            input:             "fn() { return 5 + 10; }",
            expectedConstants: []interface{}{
                5, 10,
                []code.Instructions{
                    code.Make(code.OpConstant, 0),
                    code.Make(code.OpConstant, 1),
                    code.Make(code.OpAdd),
                    code.Make(code.OpReturnValue),
                },
            },
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 2),
                code.Make(code.OpPop),
            },
        },
    }

    runCompilerTests(t, tests)
}

func TestFunctionCalls(t *testing.T) {
    tests := []compilerTestCase{
        {
            input: "let noArg = fn() { 24 }; noArg();",
            expectedConstants: []interface{}{
                24,
                []code.Instructions{
                    code.Make(code.OpConstant, 0),
                    code.Make(code.OpReturnValue),
                },
            },
            expectedInstructions: []code.Instructions{
                code.Make(code.OpConstant, 1),
                code.Make(code.OpSetGlobal, 0),
                code.Make(code.OpGetGlobal, 0),
                code.Make(code.OpCall, 0),
                code.Make(code.OpPop),
            },
        },
    }

    runCompilerTests(t, tests)
}
```

### Test Helpers

```go
func runCompilerTests(t *testing.T, tests []compilerTestCase) {
    t.Helper()

    for _, tt := range tests {
        program := parse(tt.input)
        compiler := New()
        err := compiler.Compile(program)
        if err != nil {
            t.Fatalf("compiler error: %s", err)
        }

        bytecode := compiler.Bytecode()
        testInstructions(t, tt.expectedInstructions, bytecode.Instructions)
        testConstants(t, tt.expectedConstants, bytecode.Constants)
    }
}

func parse(input string) *ast.Program {
    l := lexer.New(input)
    p := parser.New(l)
    return p.ParseProgram()
}

func testInstructions(t *testing.T, expected []code.Instructions, actual code.Instructions) {
    t.Helper()
    concatted := concatInstructions(expected)

    if len(actual) != len(concatted) {
        t.Errorf("wrong instructions length.\nwant=%q\ngot =%q",
            concatted, actual)
        return
    }

    for i, ins := range concatted {
        if actual[i] != ins {
            t.Errorf("wrong instruction at %d.\nwant=%q\ngot =%q",
                i, concatted, actual)
        }
    }
}

func concatInstructions(s []code.Instructions) code.Instructions {
    out := code.Instructions{}
    for _, ins := range s {
        out = append(out, ins...)
    }
    return out
}

func testConstants(t *testing.T, expected []interface{}, actual []object.Object) {
    t.Helper()

    if len(expected) != len(actual) {
        t.Errorf("wrong number of constants. got=%d, want=%d",
            len(actual), len(expected))
        return
    }

    for i, constant := range expected {
        switch constant := constant.(type) {
        case int:
            testIntegerObject(t, int64(constant), actual[i])
        case []code.Instructions:
            fn, ok := actual[i].(*object.CompiledFunction)
            if !ok {
                t.Errorf("constant %d - not a function: %T", i, actual[i])
                continue
            }
            testInstructions(t, constant, fn.Instructions)
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
```

## The Complete Compilation Flow

Here is what happens when we compile `let x = 5 + 3; x * 2;`:

```
1. Parse → AST:
   Program
   ├── LetStatement(x, InfixExpr(5, +, 3))
   └── ExpressionStatement(InfixExpr(Ident(x), *, 2))

2. Compile:
   Visit LetStatement:
     Visit InfixExpr(5, +, 3):
       Visit IntLit(5): emit OpConstant 0, add 5 to constants
       Visit IntLit(3): emit OpConstant 1, add 3 to constants
       Operator "+":    emit OpAdd
     Define symbol x → global index 0
     emit OpSetGlobal 0

   Visit ExpressionStatement:
     Visit InfixExpr(x, *, 2):
       Visit Ident(x): resolve → global 0, emit OpGetGlobal 0
       Visit IntLit(2): emit OpConstant 2, add 2 to constants
       Operator "*":    emit OpMul
     emit OpPop

3. Output:
   Constants: [5, 3, 2]
   Bytecode:
     0000 OpConstant 0       // push 5
     0003 OpConstant 1       // push 3
     0006 OpAdd              // push 8
     0007 OpSetGlobal 0      // globals[0] = 8
     0010 OpGetGlobal 0      // push 8
     0013 OpConstant 2       // push 2
     0016 OpMul              // push 16
     0017 OpPop              // discard (expression statement)
```

This bytecode is ready for the VM, which we build in Lesson 18.

---

## Exercises

### Exercise 1: Compile and Inspect

Write a small program that takes a source string, compiles it, and prints the disassembled bytecode and constants pool. Use it to inspect the output for:

```
let x = 1 + 2 * 3;
let y = x - 1;
y
```

### Exercise 2: String Compilation

Add support for compiling string literals. The string `"hello"` should become an `object.String` in the constants pool, loaded with `OpConstant`. String concatenation with `+` should use `OpAdd` (the VM will handle the polymorphism).

### Exercise 3: Compile Nested If

Compile:

```
if (true) { if (false) { 1 } else { 2 } } else { 3 }
```

Draw the bytecode with jump targets annotated. Verify the jumps are correct by hand-tracing execution.

### Exercise 4: Local Variables in Functions

Compile:

```
let globalVar = 10;
let add = fn(a, b) {
    let sum = a + b;
    return sum + globalVar;
};
add(3, 4);
```

Verify that `a` and `b` use `OpGetLocal`, `globalVar` uses `OpGetGlobal`, and `sum` uses `OpSetLocal`/`OpGetLocal`.

### Exercise 5: Recursive Functions

Compile the fibonacci function:

```
let fib = fn(n) {
    if (n < 2) { return n; }
    return fib(n - 1) + fib(n - 2);
};
fib(10);
```

Inspect the bytecode. How does the recursive call to `fib` work? (Hint: `fib` is a global variable, so `OpGetGlobal` loads it.)

### Exercise 6: Constant Deduplication

Modify the compiler so that duplicate constants share the same index:

```
1 + 1    // should use index 0 for both 1s, not 0 and 1
```

Implement a lookup in `addConstant` that checks if an equal constant already exists.
