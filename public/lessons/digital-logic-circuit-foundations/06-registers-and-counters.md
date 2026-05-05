# Lesson 06: Registers and Counters

> **The one thing to remember**: A register is a group of bit-storage elements
> used together, and a counter is a circuit that changes its stored value in a structured way over time.

---

## Start With Several Flip-Flops Working Together

One flip-flop stores one bit.

But real values need more than one bit:

- 8-bit value
- 16-bit value
- 64-bit value

So hardware groups multiple storage elements into a **register**.

That is just organized bit memory.

---

## What a Register Is

A register is a fixed-size collection of stored bits that move together as one logical value.

Examples of what a register can hold:

- a number being computed
- a memory address
- the current instruction bits
- the program counter value

Registers are central because they keep active machine state close to the computation hardware.

---

## The Program Counter as a Register

One especially important register is the **program counter**.

It stores the address of the next instruction to fetch.

This is a beautiful example of hardware state becoming program behavior:

- the stored value changes
- fetch goes to a new location
- program flow moves forward or jumps elsewhere

---

## Counters

A **counter** is a circuit that updates its stored value in a regular counting pattern.

For example:

```text
0000 -> 0001 -> 0010 -> 0011 -> 0100 -> ...
```

Counters matter because many computing tasks involve stepping through positions:

- instruction sequence
- loop-like hardware behavior
- timing events
- addressing

---

## Why Registers and Counters Matter

At this point, hardware can:

- compute values with logic
- store values with memory elements
- update stored state across time

That combination is already most of what you need to start seeing a tiny computer emerge.

---

## Why Developers Should Care

Registers and counters explain:

- why CPUs have register sets
- why the program counter is such a fundamental concept
- how hardware keeps track of “where it is” in a process
- how repeated state updates become the basis for sequencing and execution

---

## Hands-On Exercise

Write a 3-bit counter sequence by hand.

1. Start at `000`.
2. Increment until you reach `111`.
3. Note what would happen next if the counter wraps around.
4. Explain how a program counter is conceptually a specialized counter.

---

## Recap

- Registers store groups of bits as one useful machine value.
- Counters update stored values in structured sequences.
- The program counter is one of the most important specialized registers.
- Registers and counters give hardware persistent, evolving state.

Next, we look at circuits that help choose among many inputs or identify one output destination: multiplexers and decoders.