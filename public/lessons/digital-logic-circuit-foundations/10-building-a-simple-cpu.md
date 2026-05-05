# Lesson 10: Building a Simple CPU

> **The one thing to remember**: A simple CPU can be understood as a coordinated
> combination of registers, an ALU, control logic, and a program counter working in a repeated fetch-decode-execute cycle.

---

## Start With the Pieces We Already Have

By now we have seen enough building blocks to sketch a tiny CPU:

- logic gates for decisions
- adders and ALU behavior for computation
- flip-flops and registers for stored state
- counters for stepping through instructions
- muxes and decoders for routing and selection
- a clock for coordinated timing

What changes now is not the pieces. It is how they are organized together.

---

## The Minimum Useful CPU Story

A tiny CPU needs at least:

- a **program counter** to know which instruction comes next
- an **instruction register** or equivalent place to hold the current instruction
- an **ALU** to do arithmetic and logic
- some **registers** to hold active values
- **control logic** to decide what operation should happen this cycle

```
SIMPLE CPU SKETCH

  program counter -> fetch instruction -> decode/control -> ALU/register actions
```

That simple sketch is enough to connect logic design to computer architecture.

---

## Fetch, Decode, Execute as Circuit Behavior

At this lower level, the familiar cycle means:

- fetch: use the program counter to select instruction memory
- decode: interpret the instruction bits and generate control signals
- execute: route operands, perform ALU work, update registers or memory

This is no longer abstract. Each step is supported by actual circuit structures.

---

## Control Signals Are the Glue

One of the most important beginner insights is that a CPU is not just “ALU plus memory.”

It also needs **control**.

Control signals answer questions like:

- which register should be read?
- which ALU operation should be used?
- should the result be written back?
- should the program counter increment or jump?

Without control, the hardware pieces would exist but not coordinate into meaningful instruction execution.

---

## Why This Matters

This lesson is the moment where the whole track should click.

You are no longer looking at isolated gates and counters. You are looking at the beginnings of a real computing machine.

That is the bridge to the full Computer Architecture track.

---

## Why Developers Should Care

Building a simple CPU explains:

- why instruction execution is a control-and-data-flow process
- why registers, ALUs, and counters exist in the first place
- why CPU architecture is not arbitrary naming but organized hardware function

---

## Hands-On Exercise

Draw a block diagram of a toy CPU with:

1. program counter
2. instruction memory
3. control logic
4. register bank
5. ALU

Then trace one imaginary “add two registers” instruction through the blocks.

---

## Recap

- A simple CPU is built from the same logic, storage, routing, and timing ideas already covered.
- The program counter, registers, ALU, and control unit are central pieces.
- Fetch, decode, and execute are implemented through real hardware coordination.
- Control signals are what make the pieces behave like a processor instead of isolated circuits.

Next, we step from logic diagrams to the physical reality of chips.