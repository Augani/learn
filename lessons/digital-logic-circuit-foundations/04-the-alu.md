# Lesson 04: The ALU

> **The one thing to remember**: An ALU, or arithmetic logic unit, is the part
> of a processor that performs core operations such as addition, subtraction,
> comparison, and bitwise logic.

---

## Start With a Workshop Tool Bench

Imagine a workbench with several tools:

- a cutter
- a drill
- a measuring tool
- a clamp

You bring in the same piece of material, choose one tool, and get the result you need.

The ALU works similarly:

- it receives input values
- a control signal selects the operation
- the chosen logical or arithmetic result comes out

---

## What the ALU Does

At a conceptual level, an ALU can perform operations like:

- addition
- subtraction
- AND
- OR
- XOR
- comparisons such as equals or less-than

These operations are built from the kinds of gate-level circuits we already started discussing.

The ALU is not one magical gate. It is a composed circuit that offers multiple behaviors.

---

## Inputs, Outputs, and Control

A simplified ALU has:

- input A
- input B
- control signal saying which operation to perform
- output result

```
SIMPLIFIED ALU VIEW

   A ----\
          >--- ALU ---> result
   B ----/

   control signal selects: add, subtract, and, or, xor, compare...
```

This control input is what makes the ALU reusable.

---

## Bitwise Logic in the ALU

Operations like AND, OR, and XOR are very natural inside an ALU because they are already gate-level behaviors.

If two 8-bit inputs go into a bitwise AND operation, the ALU effectively applies AND to each corresponding bit position.

That is why bitwise operations feel so “close to the metal” in programming languages. They really are.

---

## Subtraction Is Not a Completely Different World

Subtraction can often be implemented using addition-related logic, especially with two's complement representation.

That is another place where data representation and logic design meet:

- signed integer encoding
- adder circuits
- ALU behavior

All of these layers reinforce each other.

---

## Comparisons Produce Control Information

An ALU may also help determine conditions such as:

- is the result zero?
- is one value less than another?
- was there an overflow?

These outcomes often feed into status flags or control logic.

That is how an arithmetic result eventually influences branches and decisions in a CPU.

---

## Why the ALU Matters So Much

The ALU is one of the main places where “computation” becomes visible in hardware.

When a processor:

- adds numbers
- masks bits
- compares values
- updates counters

the ALU or closely related execution logic is often involved.

This is why understanding the ALU is a major step toward understanding the CPU as a whole.

---

## Why Developers Should Care

The ALU explains:

- why arithmetic and bitwise operations are central machine instructions
- why control-flow decisions often depend on comparison results and flags
- why the CPU's “core work” is not abstract magic but repeated ALU-like behavior coordinated with memory and control

The more you understand the ALU, the easier it is to believe that a whole CPU can be built from understandable pieces.

---

## Common Misunderstandings

### “The ALU is a separate chip in modern CPUs”

Conceptually it is a functional unit; physically it is part of the processor's internal hardware.

### “Arithmetic and logic are unrelated in hardware”

No. The ALU exists precisely because both can be organized in one operational unit.

### “The ALU alone is the whole CPU” 

No. A CPU also needs control, registers, sequencing, memory interaction, and more.

---

## Hands-On Exercise

Sketch a toy ALU menu.

1. Choose two 4-bit inputs A and B.
2. Define four operations: AND, OR, XOR, ADD.
3. Compute the output of each operation for one example input pair.
4. Add one line explaining that the control signal chooses which output becomes the ALU result.

If you use a logic simulator, try wiring a simple multi-operation circuit with a selector input.

---

## Recap

- The ALU performs core arithmetic and logic operations in the processor.
- It takes inputs plus a control signal that selects the desired operation.
- Bitwise logic and arithmetic both fit naturally into ALU behavior.
- Comparison results often feed control logic and flags.
- The ALU is one of the core building blocks of a CPU.

Next, we move from computing values to storing them. How can hardware remember a bit instead of only reacting instantly to current inputs?