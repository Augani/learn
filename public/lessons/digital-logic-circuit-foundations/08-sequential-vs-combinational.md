# Lesson 08: Sequential vs Combinational Logic

> **The one thing to remember**: Combinational logic depends only on current
> inputs. Sequential logic depends on current inputs plus stored past state.

---

## Start With Two Kinds of Machines

Imagine two devices.

The first is a calculator key that instantly outputs a result based only on what you press right now.

The second is a vending machine that behaves differently depending on whether you already inserted a coin earlier.

The first is like combinational logic.
The second is like sequential logic.

---

## Combinational Logic

Combinational logic has no memory of the past.

The output depends only on current inputs.

Examples:

- AND gate
- OR gate
- XOR gate
- half adder
- many ALU sub-operations

If the inputs change, the output changes according to the circuit's logic.

---

## Sequential Logic

Sequential logic includes state.

That means the output or next behavior depends on:

- current inputs
- stored previous state

Examples:

- registers
- counters
- finite-state machines
- control sequencing circuits

This is how hardware can remember what happened before.

---

## Why the Distinction Matters

This is not just vocabulary. It is a deep architectural split.

Combinational logic is about transforming values.
Sequential logic is about evolving state over time.

You need both to build computers.

Without combinational logic, you cannot compute.
Without sequential logic, you cannot remember, sequence, or execute programs.

---

## Finite-State-Machine Intuition

A **finite-state machine** is a model where the system is in one of a limited number of states, and inputs can cause transitions.

That sounds abstract, but the idea is everywhere:

- traffic lights
- protocol handshakes
- CPU control steps
- hardware controllers

Sequential logic is what makes finite-state behavior possible in hardware.

---

## Why Developers Should Care

This distinction explains:

- why some hardware blocks are just “compute now” logic
- why other blocks track progress over time
- why state machines show up in hardware, protocols, UI flows, and distributed systems

It is one of the cleanest bridges between digital circuits and higher-level software thinking.

---

## Hands-On Exercise

Classify each example as combinational or sequential:

1. AND gate
2. 4-bit adder
3. Register storing a value until next clock
4. Counter that increments every tick
5. Traffic-light controller with timed phases

Then explain why each belongs in that category.

---

## Recap

- Combinational logic depends only on current inputs.
- Sequential logic depends on current inputs plus stored state.
- Computers need both types of circuits.
- State machines are a useful way to think about sequential behavior.

Next, we add the coordinator that tells stateful circuits when to update together: the clock.