# Lesson 19: Compiler Optimizations — Doing Work Now So You Don't Do It Later

## The Chef Prep Analogy

Walk into any professional kitchen and you'll see **prep work**: onions diced, sauces
reduced, herbs chopped — all done before dinner service. Why? Because doing it during the
rush (runtime) would be catastrophically slow.

Compiler optimization is the same idea. The compiler asks: "What work can I do now, at
compile time, so the program doesn't have to do it at runtime?" It rewrites your code to be
faster **without changing what it does**. The behavior stays identical — outputs, side
effects, everything — but the machine does less work.

---

## Why Optimize?

**1. Humans write for readability, not speed.** Small functions, named constants, and
intermediate variables all add overhead the compiler can remove.

**2. The compiler sees patterns you can't.** It finds redundancies across thousands of
instructions that no human would spot in code review.

**3. It's free performance.** You write clean code. The compiler makes it fast.

```
What you write (clear):          What the compiler produces (fast):
─────────────────────            ──────────────────────────────────
const TAX_RATE = 0.08            total = price * 1.08
let tax = price * TAX_RATE       (one multiplication instead of
let total = price + tax           a load, multiply, and add)
```

---

## Optimization Levels

C and Rust compilers let you choose how aggressively to optimize:

```
Level    What it does                              When to use it
─────    ────────────────────────────────────────   ──────────────────────
-O0      No optimization. Code maps 1:1.           Debugging.
-O1      Basic optimizations. Low compile cost.     Quick dev builds.
-O2      Standard: inlining, CSE, loop opts.       Production builds.
-O3      Aggressive: unrolling, vectorization.     Max speed. Larger binary.
-Os      Optimize for size over speed.             Embedded, WASM.
```

Think of prep levels: **-O0** is no prep (everything to order). **-O2** is full mise en
place. **-O3** also pre-plates garnishes (fastest, but uses more counter space).

In Go, the compiler always optimizes. Disable with `go build -gcflags='-N -l'` for debugging.

---

## Constant Folding

If all operands are known at compile time, compute the result immediately.

```
Before:                         After:
x = 2 + 3                      x = 5
y = 60 * 60 * 24               y = 86400
```

That `2 + 3` would otherwise be an ADD instruction at runtime. With folding, it's a single
constant load. Like a chef computing 750ml total (500ml stock + 250ml wine) instead of
measuring each separately every time.

---

## Constant Propagation

If a variable holds a known constant, replace every use with that constant. Then those uses
become foldable — it cascades.

```
Before:                     After propagation:        After folding:
let x = 5                  let x = 5                 let y = 6
let y = x + 1              let y = 5 + 1             let z = 12
let z = y * 2              let z = (5 + 1) * 2
```

Now `x` is never read — it becomes dead code. Propagation enables folding, folding creates
dead code, dead code elimination cleans up. Optimizations feed each other.

---

## Dead Code Elimination (DCE)

Removes code that can never execute or whose result is never used.

**Unreachable code** — after a return:
```
func process(x int) int {
    return x * 2
    fmt.Println("done")    // DEAD: unreachable
}
```

**Unused variables** — computed but never read:
```
x := expensiveCompute()    // DEAD: x never used (if no side effects)
y := cheapCompute()
return y
```

**Dead branches** — conditions always true or false:
```
const debug = false
if debug { logVerbose() }   // DEAD: entire branch removed
```

Like a restaurant still prepping ingredients for a removed menu item. DCE stops the waste.

---

## Function Inlining

Calling a function has overhead: push arguments, save return address, jump, execute, jump
back. **Inlining** replaces the call with the function body, eliminating that overhead.

```
Before inlining:                    After inlining:
func square(x int) int {            result := n * n
    return x * x
}
result := square(n)
```

Analogy: instead of walking to the sous chef's station (function call) for minced garlic,
the sous chef comes to your station (inlined).

**Trade-off**: inlining a large function called from 50 places creates 50 copies — more
instruction cache misses. Compilers inline small functions, skip large ones.

```bash
$ go build -gcflags='-m' ./...
./main.go:5:6: can inline square
./main.go:10:15: inlining call to square
```

---

## Common Subexpression Elimination (CSE)

Same expression computed multiple times with unchanged inputs? Compute once, reuse.

```
Before:                         After CSE:
a := (x * y) + z               tmp := x * y
b := (x * y) - z               a := tmp + z
c := (x * y) * 2               b := tmp - z
                                c := tmp * 2
```

Three multiplications become one. Like dicing onions once for three dishes.

---

## Loop Optimizations

Loops are where programs spend most time, so loop optimizations have outsized impact.

**Loop-Invariant Code Motion (LICM)** — move computations that don't change per-iteration
outside the loop:

```
Before:                              After LICM:
for i := 0; i < n; i++ {            lenX := len(x)
    result[i] = data[i] * len(x)    for i := 0; i < n; i++ {
}                                        result[i] = data[i] * lenX
                                     }
```

**Loop Unrolling** — do multiple iterations per loop body to reduce branch overhead:

```
Before:                              After unrolling (factor 4):
for i := 0; i < 100; i++ {          for i := 0; i < 100; i += 4 {
    sum += data[i]                       sum += data[i]
}                                        sum += data[i+1]
                                         sum += data[i+2]
                                         sum += data[i+3]
                                     }
```

100 branch checks become 25. Trade-off: larger code, bigger instruction cache footprint.

---

## Peephole Optimization

A small window slides over the instruction stream, replacing sequences with faster equivalents:

```
MUL R1, 2     →    SHL R1, 1        (shift is faster than multiply)
ADD R1, 0     →    (deleted)         (adding zero does nothing)
STORE x, R1   →    ADD R1, 1        (removed redundant store/load)
LOAD R1, x
ADD R1, 1
```

Like proofreading a recipe: "Add salt. Remove salt. Add salt." becomes "Add salt."

---

## SSA Form (Static Single Assignment)

SSA is a **representation** that makes optimizations easier: every variable is assigned
exactly once.

```
Normal form:                    SSA form:
x = 1                          x₁ = 1
x = x + 1                      x₂ = x₁ + 1
y = x * 2                      y₁ = x₂ * 2
```

Why this helps: **Def-use chains are trivial** (x₂ has one definition). **Constant
propagation is trivial** (if x₁ = 5, replace x₁ everywhere). **Dead code detection is
trivial** (if x₁ is never used, its assignment is dead).

When control flow merges, SSA uses **phi functions**:

```
if condition:                   if condition:
    x = 1                          x₁ = 1
else:                           else:
    x = 2                          x₂ = 2
print(x)                       x₃ = φ(x₁, x₂)    // "pick whichever branch ran"
                                print(x₃)
```

Go uses SSA internally: `GOSSAFUNC=main go build main.go` generates an HTML visualization.

---

## Implementation: Constant Folding and DCE for Our Bytecode Compiler

Let's add optimization to the compiler from lessons 17-18. We scan for patterns like
`OpConstant, OpConstant, ADD` and replace with `OpConstant result`.

```go
type Optimizer struct {
    instructions []Instruction
    constants    []interface{}
}

func NewOptimizer(instructions []Instruction, constants []interface{}) *Optimizer {
    return &Optimizer{instructions: instructions, constants: constants}
}

func (opt *Optimizer) Optimize() []Instruction {
    changed := true
    for changed {
        changed = false
        changed = opt.foldConstants() || changed
        changed = opt.eliminateDeadCode() || changed
    }
    return opt.instructions
}
```

The outer loop runs passes repeatedly because one optimization enables another. We stop
when nothing changes.

### Constant Folding Pass

```go
func (opt *Optimizer) foldConstants() bool {
    changed := false
    result := make([]Instruction, 0, len(opt.instructions))

    for i := 0; i < len(opt.instructions); i++ {
        if i+2 < len(opt.instructions) && opt.isFoldable(i) {
            folded, ok := opt.fold(i)
            if ok {
                constIdx := len(opt.constants)
                opt.constants = append(opt.constants, folded)
                result = append(result, Instruction{Op: OpConstant, Operand: constIdx})
                i += 2
                changed = true
                continue
            }
        }
        result = append(result, opt.instructions[i])
    }

    opt.instructions = result
    return changed
}

func (opt *Optimizer) isFoldable(index int) bool {
    if opt.instructions[index].Op != OpConstant ||
        opt.instructions[index+1].Op != OpConstant {
        return false
    }
    switch opt.instructions[index+2].Op {
    case OpAdd, OpSub, OpMul, OpDiv:
        return true
    default:
        return false
    }
}

func (opt *Optimizer) fold(index int) (interface{}, bool) {
    leftNum, leftOk := toFloat64(opt.constants[opt.instructions[index].Operand])
    rightNum, rightOk := toFloat64(opt.constants[opt.instructions[index+1].Operand])
    if !leftOk || !rightOk {
        return nil, false
    }

    switch opt.instructions[index+2].Op {
    case OpAdd:
        return leftNum + rightNum, true
    case OpSub:
        return leftNum - rightNum, true
    case OpMul:
        return leftNum * rightNum, true
    case OpDiv:
        if rightNum == 0 {
            return nil, false
        }
        return leftNum / rightNum, true
    default:
        return nil, false
    }
}

func toFloat64(val interface{}) (float64, bool) {
    switch v := val.(type) {
    case float64:
        return v, true
    case int:
        return float64(v), true
    default:
        return 0, false
    }
}
```

Notice the guard clause for division by zero — we never fold it. That would change the
program's behavior (it should produce a runtime error), and optimizations must never change
observable behavior.

### Dead Code Elimination Pass

```go
func (opt *Optimizer) eliminateDeadCode() bool {
    changed := false
    result := make([]Instruction, 0, len(opt.instructions))
    jumpTargets := opt.findJumpTargets()

    unreachable := false
    for i, instr := range opt.instructions {
        if jumpTargets[i] {
            unreachable = false
        }
        if unreachable {
            changed = true
            continue
        }
        if instr.Op == OpReturn || instr.Op == OpHalt {
            result = append(result, instr)
            unreachable = true
            continue
        }
        if opt.isPushThenPop(i) {
            changed = true
            continue
        }
        result = append(result, instr)
    }

    opt.instructions = result
    return changed
}

func (opt *Optimizer) findJumpTargets() map[int]bool {
    targets := make(map[int]bool)
    for _, instr := range opt.instructions {
        if instr.Op == OpJump || instr.Op == OpJumpIfFalse {
            targets[instr.Operand] = true
        }
    }
    return targets
}

func (opt *Optimizer) isPushThenPop(index int) bool {
    if index+1 >= len(opt.instructions) {
        return false
    }
    return opt.instructions[index].Op == OpConstant &&
        opt.instructions[index+1].Op == OpPop
}
```

Jump target tracking is critical: code after a return is unreachable UNLESS something jumps
to it.

### Entry Point and Jump Fix-up

```go
func OptimizeBytecode(instructions []Instruction, constants []interface{}) ([]Instruction, []interface{}) {
    instCopy := make([]Instruction, len(instructions))
    copy(instCopy, instructions)
    constCopy := make([]interface{}, len(constants))
    copy(constCopy, constants)

    opt := NewOptimizer(instCopy, constCopy)
    optimized := opt.Optimize()
    return optimized, opt.constants
}
```

### Testing

```go
func TestConstantFolding(t *testing.T) {
    constants := []interface{}{2.0, 3.0}
    instructions := []Instruction{
        {Op: OpConstant, Operand: 0}, {Op: OpConstant, Operand: 1},
        {Op: OpAdd}, {Op: OpPrint}, {Op: OpHalt},
    }
    optimized, newConst := OptimizeBytecode(instructions, constants)
    if len(optimized) != 3 {
        t.Fatalf("expected 3 instructions, got %d", len(optimized))
    }
    if newConst[optimized[0].Operand].(float64) != 5.0 {
        t.Fatal("expected folded value 5.0")
    }
}

func TestDeadCodeElimination(t *testing.T) {
    instructions := []Instruction{
        {Op: OpConstant, Operand: 0}, {Op: OpReturn},
        {Op: OpConstant, Operand: 1}, {Op: OpPrint}, {Op: OpHalt},
    }
    optimized, _ := OptimizeBytecode(instructions, []interface{}{1.0, 2.0})
    if len(optimized) != 2 {
        t.Fatalf("expected 2 instructions (dead code removed), got %d", len(optimized))
    }
}

func TestChainedFolding(t *testing.T) {
    constants := []interface{}{2.0, 3.0, 10.0}
    instructions := []Instruction{
        {Op: OpConstant, Operand: 0}, {Op: OpConstant, Operand: 1}, {Op: OpAdd},
        {Op: OpConstant, Operand: 2}, {Op: OpMul},
        {Op: OpPrint}, {Op: OpHalt},
    }
    optimized, newConst := OptimizeBytecode(instructions, constants)
    if newConst[optimized[0].Operand].(float64) != 50.0 {
        t.Fatal("expected chained fold to 50.0")
    }
}
```

The chained test verifies cascading: first pass folds `2+3=5`, second pass folds `5*10=50`.

---

## Seeing Optimizations in Action

```bash
go build -gcflags='-m' ./...

go build -gcflags='-m -m' ./...

GOSSAFUNC=functionName go build main.go
```

The SSA HTML shows every pass: constant propagation, dead code elimination, register
allocation, final machine code.

For C/Rust comparison:

```bash
echo 'int square(int x) { return x * x; }
int main() { return square(5); }' > /tmp/test.c
gcc -O0 -S -o /tmp/test_O0.s /tmp/test.c
gcc -O2 -S -o /tmp/test_O2.s /tmp/test.c
diff /tmp/test_O0.s /tmp/test_O2.s
```

At -O2, the compiler inlines `square` and folds the result to `return 25`.

---

## How Optimizations Interact

```
Constant Propagation  →  x=5; y=x+1  becomes  y=5+1
         ↓
Constant Folding      →  y=5+1  becomes  y=6
         ↓
Dead Code Elimination →  x=5 (unused) removed
         ↓
CSE                   →  duplicate expressions merged
         ↓
Loop-Invariant Motion →  invariant computations hoisted
         ↓
Inlining              →  small functions pasted into callers
         ↓
Peephole              →  mul x,2 → shl x,1
         ↓
Register Allocation   →  virtual → physical registers
```

GCC runs 200+ passes. LLVM orders passes to maximize cascade effects.

---

## The Correctness Constraint

The most important rule: **never change observable behavior** (the "as-if rule").

Observable: output, return values, side effects, panics.
NOT observable: execution time, memory layout, number of function calls, temporary values.

This is why division-by-zero can't be folded — the panic IS observable.

---

## Exercises

1. **Extend folding to comparisons.** Fold `OpEqual`, `OpGreater`, `OpLess` when both
   operands are constants. `5 > 3` should fold to `true`.

2. **Add strength reduction.** Replace `x * 2` with `x + x`, `x * 1` with `x`, `x * 0`
   with `0`.

3. **Implement constant propagation.** Track which locals hold constants. Replace
   `OpGetLocal` with `OpConstant` when the local's value is known.

4. **Try GOSSAFUNC.** Generate SSA HTML for a Go function. Identify which passes perform
   folding, DCE, and inlining. Find the phi functions.

---

## Key Takeaways

- Compiler optimizations make code faster without changing behavior
- Optimization levels trade compile time and code size for runtime speed
- Constant folding evaluates expressions at compile time
- Constant propagation replaces variable reads with known values
- Dead code elimination removes unreachable or unused code
- Inlining replaces calls with function bodies (speed vs size trade-off)
- Loop optimizations target where programs spend most time
- SSA form makes optimizations easier by giving each assignment a unique name
- Optimizations cascade — each pass enables others

---

## What's Next

Our VM allocates memory but never frees it. Next: garbage collection — the automatic memory
manager that finds and reclaims dead objects.
