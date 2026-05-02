# Lesson 16: Bytecode and Virtual Machines — A Faster Path

## Why Tree-Walking Is Slow

In Lessons 8-12, we built a tree-walk interpreter. It works — you can run programs with it. But it is slow. Here is why.

An AST is a tree of heap-allocated nodes connected by pointers:

```
         InfixExpression
        /       |       \
   IntLit(1)   "+"    InfixExpression
                      /       |       \
                 IntLit(2)   "*"    IntLit(3)
```

To evaluate `1 + 2 * 3`, the interpreter:

1. Follows a pointer to the `InfixExpression` node
2. Follows a pointer to the left child (`IntLit(1)`)
3. Evaluates it, wraps result in an `object.Integer`
4. Goes back up to the parent
5. Follows a pointer to the right child (another `InfixExpression`)
6. Follows a pointer to *its* left child (`IntLit(2)`)
7. Evaluates, wraps in `object.Integer`
8. Goes back up
9. Follows a pointer to the right child (`IntLit(3)`)
10. Evaluates, wraps in `object.Integer`
11. Performs multiplication
12. Goes back up to the original node
13. Performs addition

That is a lot of pointer chasing. Every pointer follow is potentially a **cache miss** — the CPU has to fetch data from main memory (~100ns) instead of the fast cache (~1ns). Tree nodes are scattered across the heap, so the CPU's prefetcher cannot help.

Additionally, every intermediate result creates a new `object.Integer` on the heap, which the garbage collector must later clean up.

## The Recipe Analogy

If tree-walking is **reading a recipe step by step** — constantly flipping between pages, re-reading ingredients, and looking around the kitchen — then bytecode is **pre-measuring all ingredients and laying them out in order** on the counter.

The recipe says "add 2 cups flour, then 1 cup sugar, then 3 eggs." With the tree-walk approach, you read "add flour," walk to the pantry, find flour, measure 2 cups, walk back. Read "add sugar," walk to the pantry, find sugar, measure 1 cup, walk back.

With bytecode, you read the entire recipe first, pre-measure everything, line it up: flour, sugar, eggs. Then execution is just grabbing the next thing in line. Linear. Fast. No searching.

The VM is the chef executing the pre-arranged steps.

## What Is Bytecode?

Bytecode is a compact binary representation of your program — a sequence of bytes where each byte (or group of bytes) represents an instruction.

```
Source:        1 + 2 * 3
AST:           InfixExpression(1, +, InfixExpression(2, *, 3))

Bytecode:
  00: OpConstant 0    // push constant[0] (which is 1)
  03: OpConstant 1    // push constant[1] (which is 2)
  06: OpConstant 2    // push constant[2] (which is 3)
  09: OpMul           // pop 2 and 3, push 6
  10: OpAdd           // pop 1 and 6, push 7

Constants Pool: [1, 2, 3]
```

Each instruction is 1-3 bytes. No pointers. No tree. No heap-allocated nodes. Just a flat array of bytes that the CPU can stream through linearly.

## Stack-Based vs Register-Based VMs

There are two main approaches to VM architecture.

### Stack-Based VMs

All operations use an implicit **stack**. Operands are pushed onto the stack, operators pop them and push the result.

```
Expression: 2 + 3

Instructions:         Stack (top on right):
  push 2              [2]
  push 3              [2, 3]
  add                 [5]         ← popped 2 and 3, pushed 5
```

**Used by:** JVM (Java), CPython (Python), Lua's original VM, WebAssembly, our VM.

**Pros:** Simple to implement. Instructions are compact (no operand registers to encode). Easy to generate code for.

**Cons:** More instructions needed (explicit push/pop for everything). Lots of stack manipulation.

### Register-Based VMs

Operations specify source and destination **registers** (named slots):

```
Expression: 2 + 3

Instructions:
  load r0, 2          // r0 = 2
  load r1, 3          // r1 = 3
  add r2, r0, r1      // r2 = r0 + r1 = 5
```

**Used by:** Dalvik (Android's old VM), LuaJIT, most hardware CPUs.

**Pros:** Fewer instructions (one `add` instead of push-push-add). Avoids redundant stack operations.

**Cons:** More complex instruction encoding. Harder to generate code for. Register allocation is a hard problem.

### Side-by-Side Comparison

```
Expression: (a + b) * (c - d)

Stack-Based:                Register-Based:
  push a                      load r0, a
  push b                      load r1, b
  add                         add r2, r0, r1
  push c                      load r3, c
  push d                      load r4, d
  sub                         sub r5, r3, r4
  mul                         mul r6, r2, r5

  7 instructions               7 instructions (same here)
  But each is 1-3 bytes        Each is 4+ bytes (register indices)
```

For this curriculum, we build a **stack-based VM** because it is simpler to implement and understand.

## The Instruction Set

Here is the instruction set we will implement in Lessons 17-18:

```
Opcode              Operands     Description
──────────────────────────────────────────────────────────────
OpConstant          index(2)     Push constants[index] onto stack
OpAdd               -            Pop two, push sum
OpSub               -            Pop two, push difference
OpMul               -            Pop two, push product
OpDiv               -            Pop two, push quotient
OpTrue              -            Push true
OpFalse             -            Push false
OpEqual             -            Pop two, push equality result
OpNotEqual          -            Pop two, push inequality result
OpGreaterThan       -            Pop two, push comparison result
OpMinus             -            Pop one, push negation
OpBang              -            Pop one, push logical not
OpPop               -            Pop top of stack (discard)
OpJump              target(2)    Unconditional jump to target
OpJumpNotTruthy     target(2)    Pop, jump if not truthy
OpNull              -            Push null
OpSetGlobal         index(2)     Pop value, store in globals[index]
OpGetGlobal         index(2)     Push globals[index] onto stack
OpSetLocal          index(1)     Pop value, store in locals[index]
OpGetLocal          index(1)     Push locals[index] onto stack
OpCall              argCount(1)  Call function with argCount arguments
OpReturn            -            Return from function
OpReturnValue       -            Pop value, return from function
```

The number in parentheses is how many bytes the operand takes. `OpConstant` has a 2-byte operand (so it can index up to 65,535 constants). `OpAdd` has no operands — it always pops two values and pushes one.

## How the Stack Works

Let us trace through `1 + 2 * 3` step by step.

The compiler must respect operator precedence. `*` binds tighter than `+`, so `2 * 3` is computed first. The bytecode reflects this:

```
Constants Pool: [1, 2, 3]

Bytecode:
  Offset  Instruction         Stack After
  ──────  ──────────────────  ─────────────
  00      OpConstant 0        [1]
  03      OpConstant 1        [1, 2]
  06      OpConstant 2        [1, 2, 3]
  09      OpMul               [1, 6]
  10      OpAdd               [7]
```

Step by step:

1. `OpConstant 0`: Look up constants[0] = 1, push onto stack. Stack: `[1]`
2. `OpConstant 1`: Look up constants[1] = 2, push. Stack: `[1, 2]`
3. `OpConstant 2`: Look up constants[2] = 3, push. Stack: `[1, 2, 3]`
4. `OpMul`: Pop 3 and 2, compute 2*3=6, push 6. Stack: `[1, 6]`
5. `OpAdd`: Pop 6 and 1, compute 1+6=7, push 7. Stack: `[7]`

The final result (7) is on top of the stack.

## Control Flow with Jumps

How does `if/else` work in bytecode? There are no blocks or braces — just a flat stream of instructions. We use **jump instructions** to skip over code.

```
Source: if (condition) { consequenceStmts } else { alternativeStmts }

Bytecode:
  0000: [compile condition]
  0005: OpJumpNotTruthy 0013     ← if condition is false, jump to else
  0008: [compile consequence]
  0011: OpJump 0018              ← skip over else
  0013: [compile alternative]    ← else branch starts here
  0018: [continue]               ← both branches merge here
```

This is called **forward patching** — when we emit `OpJumpNotTruthy`, we do not yet know the target address (we have not compiled the consequence yet). We emit a placeholder, compile the consequence, then go back and patch the correct address.

## Variables in Bytecode

Variables are not stored by name in bytecode. The compiler assigns each variable an **index** — a number.

```
Source:
  let x = 5;     // x → global index 0
  let y = 10;    // y → global index 1
  let z = x + y; // z → global index 2

Bytecode:
  OpConstant 0       // push 5
  OpSetGlobal 0      // globals[0] = 5 (x)
  OpConstant 1       // push 10
  OpSetGlobal 1      // globals[1] = 10 (y)
  OpGetGlobal 0      // push globals[0] (x = 5)
  OpGetGlobal 1      // push globals[1] (y = 10)
  OpAdd              // push 15
  OpSetGlobal 2      // globals[2] = 15 (z)
```

The symbol table from Lesson 15 provides the mapping from names to indices. By the time we have bytecode, names are gone — everything is indices.

## Function Calls

Function calls use **call frames** to manage the stack:

```
Source:
  let add = fn(a, b) { return a + b; };
  add(3, 4);

Bytecode for add's body:
  OpGetLocal 0       // push a
  OpGetLocal 1       // push b
  OpAdd              // push a + b
  OpReturnValue      // return top of stack

Bytecode for the call site:
  OpGetGlobal 0      // push the function (add)
  OpConstant 0       // push 3
  OpConstant 1       // push 4
  OpCall 2           // call with 2 arguments
```

When `OpCall` executes:
1. A new **call frame** is pushed
2. The frame records where to return to and where locals start on the stack
3. Arguments become locals (index 0 = first arg, index 1 = second arg)
4. The VM starts executing the function's bytecode

When `OpReturnValue` executes:
1. The return value is saved
2. The call frame is popped
3. The stack is restored to its state before the call
4. The return value is pushed onto the stack

## Tracing a Complete Conditional

Let us trace `if (true) { 10 } else { 20 }` step by step:

```
Constants Pool: [10, 20]

Bytecode:
  Offset  Instruction              Stack After
  ──────  ───────────────────────  ─────────────
  0000    OpTrue                   [true]
  0001    OpJumpNotTruthy 0008     []         ← pop true, it IS truthy, don't jump
  0004    OpConstant 0             [10]       ← consequence
  0007    OpJump 0011              [10]       ← skip alternative
  ---- (we jump over this) ----
  0008    OpConstant 1             (not reached)
  0011    OpPop                    []         ← expression statement discards value

Result: 10
```

Now trace the same code with a false condition — imagine the condition is `1 > 2`:

```
Constants Pool: [1, 2, 10, 20]

Bytecode:
  Offset  Instruction              Stack After
  ──────  ───────────────────────  ─────────────
  0000    OpConstant 0             [1]
  0003    OpConstant 1             [1, 2]
  0006    OpGreaterThan            [false]     ← 1 > 2 is false
  0007    OpJumpNotTruthy 0014     []          ← pop false, it is NOT truthy, JUMP!
  ---- (we jump over consequence) ----
  0014    OpConstant 3             [20]        ← alternative
  0017    OpPop                    []

Result: 20
```

The key insight: `OpJumpNotTruthy` **always pops** the condition off the stack, then conditionally jumps. This is important — the condition must not remain on the stack regardless of which branch is taken.

## Variables: From Names to Numbers

In your Go or TypeScript code, variables have names. In bytecode, variables have **indices** — just numbers. The compiler's symbol table translates names to indices.

Global variables are stored in a separate array. Local variables (inside functions) live directly on the stack.

```
Source:
  let greeting = "hello";     // global index 0
  let count = 42;             // global index 1
  let message = greeting;     // read global 0, store global 2

Bytecode:                          Globals Array After:
  OpConstant 0                     ┌───────────┬──────────┬─────────┐
  OpSetGlobal 0  ← store           │ 0: "hello" │ 1: 42   │ 2: ???  │
  OpConstant 1                     └───────────┴──────────┴─────────┘
  OpSetGlobal 1  ← store           (index 2 not yet set)
  OpGetGlobal 0  ← read globals[0], pushes "hello"
  OpSetGlobal 2  ← store
```

Local variables work differently — they occupy slots on the stack relative to the current call frame. This is faster than a global lookup because it is direct array indexing:

```
Source (inside a function):
  fn(a, b) {
      let sum = a + b;
      return sum;
  }

Bytecode:
  OpGetLocal 0       // push stack[basePointer + 0] = a
  OpGetLocal 1       // push stack[basePointer + 1] = b
  OpAdd              // push a + b
  OpSetLocal 2       // stack[basePointer + 2] = sum
  OpGetLocal 2       // push sum
  OpReturnValue      // return top of stack
```

Parameters are just the first locals. `a` is local 0, `b` is local 1, `sum` is local 2.

## Tracing a Function Call

Here is a complete trace of calling a function:

```
Source:
  let double = fn(x) { x * 2 };
  double(21);

Constants Pool:
  0: CompiledFunction { instructions: [OpGetLocal 0, OpConstant ?, OpMul, OpReturnValue] }
  1: Integer(21)
  2: Integer(2)  (used inside the function)

Main Bytecode:
  0000  OpConstant 0        // push the compiled function
  0003  OpSetGlobal 0       // store as globals[0] ("double")
  0006  OpGetGlobal 0       // push globals[0] (the function)
  0009  OpConstant 1        // push 21 (the argument)
  0012  OpCall 1            // call with 1 argument
  0014  OpPop               // discard the result

Function's Bytecode:
  0000  OpGetLocal 0        // push x (= 21)
  0002  OpConstant 2        // push 2
  0005  OpMul               // 21 * 2 = 42
  0006  OpReturnValue       // return 42

Trace:
  ip=0000  OpConstant 0      Stack: [fn]           Frames: [main]
  ip=0003  OpSetGlobal 0     Stack: []              globals[0] = fn
  ip=0006  OpGetGlobal 0     Stack: [fn]
  ip=0009  OpConstant 1      Stack: [fn, 21]
  ip=0012  OpCall 1          Stack: [fn, 21]        Push frame, basePointer=1
                                                     Frames: [main, double]
  ── inside double ──
  ip=0000  OpGetLocal 0      Stack: [fn, 21, 21]    stack[basePointer+0] = 21
  ip=0002  OpConstant 2      Stack: [fn, 21, 21, 2]
  ip=0005  OpMul             Stack: [fn, 21, 42]
  ip=0006  OpReturnValue     Save 42, pop frame, sp = basePointer-1 = 0
                             Push 42
                             Stack: [42]             Frames: [main]
  ── back in main ──
  ip=0014  OpPop             Stack: []

Result: 42
```

Notice how the call frame's `basePointer` lets the function access its arguments by index. The function does not know the variable's name — just that its first parameter is at stack position `basePointer + 0`.

## Comparison: Real-World Bytecode

### JVM Bytecode

```java
public static int add(int a, int b) {
    return a + b;
}
```

Compiles to:

```
  iload_0        // push local 0 (a)
  iload_1        // push local 1 (b)
  iadd           // pop two, push sum
  ireturn        // return int on top of stack
```

Almost identical to what we will build. The JVM has type-specific opcodes (`iadd` for int, `fadd` for float, `dadd` for double).

### CPython Bytecode

```python
def add(a, b):
    return a + b
```

You can see CPython's bytecode with the `dis` module:

```python
import dis
dis.dis(add)
```

Output:

```
  2           0 LOAD_FAST                0 (a)
              2 LOAD_FAST                1 (b)
              4 BINARY_ADD
              6 RETURN_VALUE
```

Same pattern: load operands, apply operator, return.

### V8's Ignition Bytecode

V8 (Chrome's JavaScript engine) uses a register-based bytecode interpreter called Ignition as its first tier. Hot functions are later compiled to native code by TurboFan.

```javascript
function add(a, b) {
    return a + b;
}
```

Ignition bytecode (simplified):

```
  Ldar a0          // load argument 0 into accumulator
  Add a1           // add argument 1 to accumulator
  Return           // return accumulator
```

V8 uses an **accumulator** — a special register that holds the current result. This is a hybrid between stack-based and register-based.

## Performance: Why Bytecode Wins

```
Approach             Memory Layout      Cache Behavior     Overhead
──────────────────────────────────────────────────────────────────────
Tree-walk            Scattered (heap)   Cache misses       Object allocation per operation
                     Pointer-heavy      Unpredictable      GC pressure from intermediates

Bytecode + VM        Linear ([]byte)    Cache friendly      Minimal allocation
                     Flat array         Predictable         Stack operations are fast
```

The key advantages:

1. **Linear memory access**: Bytecode is a `[]byte` — the CPU prefetcher loves sequential access patterns.
2. **No pointer chasing**: Instructions are adjacent in memory. No need to follow pointers to find the next operation.
3. **Minimal allocation**: Stack operations use a pre-allocated array. No heap allocation per operation.
4. **Small instruction size**: Each opcode is 1 byte plus 0-2 bytes of operands. An AST node might be 50+ bytes with pointers, type tags, and padding.

In Lesson 18, we will benchmark both approaches on fibonacci(35) and see the concrete speed difference (typically 5-30x faster for bytecode).

## The Compilation and Execution Pipeline

```
Source Code → Lexer → Parser → AST → Compiler → Bytecode → VM → Result
                                         │                    │
                                    Lessons 17           Lesson 18
```

The compiler (Lesson 17) walks the AST once and emits bytecode. The VM (Lesson 18) executes the bytecode. No AST is needed at runtime — it is discarded after compilation.

This is the same architecture used by Java (javac → JVM), Python (compile → CPython VM), Lua (luac → Lua VM), and many others.

---

## Exercises

### Exercise 1: Trace Bytecode by Hand

For each expression, write the bytecode and trace the stack state after each instruction:

```
a) 5 + 3 * 2
b) (5 + 3) * 2
c) -5 + 10
d) 10 - 3 - 2  (left-to-right associativity)
```

### Exercise 2: Variable Bytecode

Write the bytecode for:

```
let x = 10;
let y = 20;
let z = x * y + 5;
```

Show the constants pool, the bytecode instructions, and the final state of the globals array.

### Exercise 3: If/Else Bytecode

Write the bytecode for:

```
let result = if (x > 0) { x * 2 } else { x * -1 };
```

Show the jump targets and trace execution for both `x = 5` and `x = -3`.

### Exercise 4: Function Call Bytecode

Write the bytecode for:

```
let double = fn(x) { return x * 2; };
let result = double(21);
```

Show both the function's bytecode and the call site bytecode. Trace the call frame stack.

### Exercise 5: Compare Bytecode Formats

Install Python and run:

```python
import dis
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

dis.dis(fib)
```

Compare the output to the bytecode you would generate for the same function using our instruction set. What are the similarities and differences?

### Exercise 6: Instruction Encoding

Design the binary encoding for our instruction set. Each opcode is 1 byte. Operands follow. Write a Go function:

```go
func Encode(op Opcode, operands ...int) []byte
func Decode(instructions []byte) (Opcode, []int, int)
```

`Encode` produces the byte sequence. `Decode` reads one instruction from a byte slice and returns the opcode, operands, and number of bytes consumed. Test round-trip: `Decode(Encode(OpConstant, 65534))` should return `OpConstant, [65534], 3`.
