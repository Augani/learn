# Lesson 02: Instruction Set Architecture

> **The one thing to remember**: The instruction set architecture, or ISA,
> is the contract between software and hardware. It defines what operations
> the CPU understands, what registers exist, how instructions are encoded,
> and how programs talk to the machine.

---

## Start With an Analogy

Imagine you hire workers from different countries to assemble furniture.
You can only communicate through a fixed phrasebook.

If the phrasebook includes:

- “pick up item from shelf 4”
- “add these two numbers”
- “jump to step 12 if zero”

then every instruction must be expressed using those allowed phrases.

The workers may have different muscles, different tools, and different ways
of organizing their day, but as long as they all follow the same phrasebook,
your instructions still work.

That phrasebook is the **ISA**.

---

## What an ISA Defines

An ISA defines the programmer-visible machine model.

It answers questions like:

- What instructions exist?
- What registers can software use?
- How many bits wide are values and addresses?
- How are instructions encoded into bytes?
- How do loads, stores, branches, and arithmetic work?
- What is the calling convention or system interface around it?

It does **not** fully define how the CPU is built internally.

That distinction matters.

```
SOFTWARE VIEW VS HARDWARE IMPLEMENTATION

  Software writes to the ISA
            |
            v
   +-----------------------+
   |          ISA          |
   | add, load, store,     |
   | branch, registers     |
   +-----------------------+
            |
            v
   +-----------------------+
   |   Microarchitecture   |
   | pipeline, cache, OOO, |
   | branch predictor      |
   +-----------------------+
```

If two CPUs implement the same ISA, the same compiled program can run on
both, even if one is simple and one is extremely advanced internally.

---

## ISA vs Microarchitecture

This is one of the most important distinctions in the whole track.

### ISA

The external contract.

Examples:

- x86-64
- ARMv8-A
- RISC-V

### Microarchitecture

The internal design used to implement that contract.

Examples of microarchitectural choices:

- how deep the pipeline is
- whether execution is in-order or out-of-order
- cache sizes and policies
- branch predictor design
- number of execution units

Two chips can share the same ISA but have very different performance,
power use, and complexity because their microarchitectures differ.

That is why one x86 laptop can feel completely different from another even
though both run the same operating system and binaries.

---

## What Instructions Look Like

At the ISA level, instructions are simple machine operations.

Examples:

- add two numbers
- move data between memory and a register
- compare two values
- jump to another instruction address

Here is a simplified pseudo-assembly example:

```asm
LOAD R1, [count]
ADD  R1, R1, #1
STORE [count], R1
```

Read that as:

1. Load the value at memory location `count` into register `R1`
2. Add `1` to `R1`
3. Store the result back to memory

The exact syntax differs by ISA, but the idea is the same.

---

## Instructions Need Encoding

The CPU does not read words like `ADD` or `LOAD`. It reads bits.

So the ISA also defines how instructions are encoded into binary.

```
HUMAN-FRIENDLY VS MACHINE-FRIENDLY

  Assembly:   ADD R1, R2, R3
  Encoding:   0001 0001 0010 0011  (illustrative only)

  Assembly is for humans.
  Encoded bits are for the processor.
```

This matters because instruction formats affect:

- decoder complexity
- code density
- how many operands fit in one instruction
- how easy it is to pipeline and optimize execution

Even the shape of the bits influences performance and chip design.

---

## The Core Instruction Categories

Most ISAs provide instructions in a few broad categories.

### Data Movement

Move data between:

- memory and registers
- one register and another
- immediate constant and register

Examples: `LOAD`, `STORE`, `MOV`

### Arithmetic and Logic

Perform math and logic:

- add, subtract, multiply
- and, or, xor, shift
- compare values

Examples: `ADD`, `SUB`, `AND`, `CMP`

### Control Flow

Change which instruction runs next:

- unconditional jump
- conditional branch
- function call
- return

Examples: `JMP`, `BEQ`, `CALL`, `RET`

### System / Special Instructions

Used for privileged or machine-specific operations:

- traps and syscalls
- cache or barrier instructions
- interrupt control
- mode switching

Most application code spends most of its time in the first three categories.

---

## Registers Are Part of the ISA Too

The ISA defines which registers software can use and what some of them mean.

For example, an ISA may define:

- general-purpose registers for arithmetic
- a stack pointer
- a program counter or instruction pointer
- status flags
- vector registers for SIMD

This affects compilers directly.

If an ISA provides many general-purpose registers, the compiler can keep more
values close to the CPU and reduce memory traffic. If there are fewer registers,
the compiler must “spill” values to memory more often.

That means the ISA influences performance even before microarchitecture enters
the picture.

---

## RISC vs CISC

One of the most common ISA discussions is **RISC vs CISC**.

These labels are useful, but beginners often hear them in a distorted way.

### CISC: Complex Instruction Set Computer

Historically associated with instructions that can be:

- variable length
- more complex
- able to do multiple things in one instruction

x86 is the classic example.

### RISC: Reduced Instruction Set Computer

Historically associated with instructions that are:

- simpler
- more regular
- often fixed length
- easier to decode and pipeline cleanly

ARM and RISC-V are common modern examples.

```
VERY ROUGH INTUITION

  CISC: "Give me a richer, denser instruction vocabulary"
  RISC: "Give me a smaller, cleaner instruction vocabulary"
```

But do not turn this into mythology.

Modern CPUs blur the line:

- x86 chips often decode complex instructions into simpler internal operations
- ARM chips can support quite sophisticated behavior too

So the practical lesson is not “RISC good, CISC bad.”
The practical lesson is:

> ISA design shapes decoding, compilation, power, compatibility, and performance tradeoffs.

---

## x86 vs ARM at a High Level

You do not need to memorize instruction syntax, but you should understand why
these names matter.

### x86-64

- Dominant on desktops, laptops, and many servers for years
- Strong backward compatibility
- Variable-length instructions
- Historically complex decoding

### ARM

- Dominant in phones, tablets, and many embedded systems
- Strong power-efficiency reputation
- Simpler instruction encoding in many variants
- Now increasingly important in laptops and servers too

Why do developers care?

- binary compatibility differs
- performance characteristics differ
- energy usage differs
- compilation targets differ

If you have ever downloaded separate installers for Apple Silicon and Intel,
you have already touched this reality.

---

## ISA Compatibility Is Why Software Ports Matter

A compiled binary targets a specific ISA.

That means:

- an x86 binary does not run natively on ARM
- an ARM binary does not run natively on x86

unless you use:

- recompilation
- emulation
- binary translation

This explains why language runtimes, package managers, and build systems care
so much about architecture targets.

When you see labels like:

- `x86_64`
- `arm64`
- `aarch64`

you are seeing ISA-level compatibility concerns surface in normal software work.

---

## A Small Example: One Operation, Different ISAs

Suppose you want to add two integers.

At the source-code level:

```go
sum := a + b
```

At the machine level, the compiler must translate that into instructions the
target ISA understands.

A simplified version may look like:

```asm
LOAD R1, [a]
LOAD R2, [b]
ADD  R3, R1, R2
STORE [sum], R3
```

Another ISA may use different register names, operand order, or encoding, but
the same conceptual work still happens.

This is why compilers have backends for different target architectures.

---

## Why ISA Design Affects Real Performance

Even though microarchitecture handles most of the performance magic, ISA still
matters in real ways.

### Instruction Density

Smaller encodings can reduce instruction-cache pressure.

### Register Count

More registers can reduce spilling to memory.

### SIMD Extensions

An ISA may include vector instructions that allow one instruction to operate on
multiple data elements.

### Memory Model Rules

The ISA may define which reorderings are visible and what barriers are available.

### Atomic Operations

Concurrency libraries depend on the primitives the ISA exposes.

So when high-performance libraries have architecture-specific code paths, they
are often responding to ISA differences directly.

---

## Common Misunderstandings

### “ISA and CPU are the same thing”

No. The ISA is the contract. The CPU is a specific implementation.

### “RISC means fast and CISC means slow”

Too simplistic. Real performance comes from the whole design, including the
microarchitecture, compiler, memory system, and workload.

### “Assembly language is the ISA”

Assembly is a human-readable representation of ISA instructions. The actual
machine consumes encoded bits.

### “If two CPUs share an ISA, they perform the same” 

No. They are compatible, not identical in speed or efficiency.

---

## Why Developers Should Care

Understanding ISA explains:

- why software ships different binaries for different architectures
- why compilers have architecture targets and optimization flags
- why vector intrinsics are architecture-specific
- why low-level debugging and performance tools often show assembly
- why portability sometimes breaks at the binary layer even when source code is portable

It also gives you the right mental split:

- ISA explains what software can ask the machine to do
- microarchitecture explains how efficiently a particular chip does it

That distinction prevents a lot of confusion later.

---

## Hands-On Exercise

Pick one small program and inspect its target architecture.

1. Compile or install a tiny program on your machine.
2. Use a tool like `file`, `otool -hv`, `objdump`, or your IDE’s binary inspector.
3. Find the architecture label, such as `arm64` or `x86_64`.
4. If possible, disassemble one small function and notice that your high-level code became ISA-specific instructions.

If you cannot do this locally, use Compiler Explorer online.
Write a tiny function in C, Rust, or Go and compare the output for x86-64 and ARM64.

---

## Recap

- The ISA is the software-visible contract for a processor family.
- It defines instructions, registers, encodings, and key machine behaviors.
- Microarchitecture is the internal implementation of that contract.
- RISC vs CISC is about design tradeoffs, not a cartoon of good vs bad.
- ISA differences are why binaries, compilers, and optimization strategies vary by architecture.

Next, we narrow the lens again. If the ISA tells software what registers exist,
why are registers so important, and why does every performance discussion seem
to come back to them?