# Digital Logic & Circuit Foundations — No Degree Required

This track explains how hardware performs logic, stores bits, and builds up from
simple gates to the core parts of a CPU. If “the processor adds numbers” feels
like magic, this is the missing layer.

You do not need electrical engineering training. We stay focused on intuition,
truth tables, simple circuit composition, and the mental model a software
developer needs.

---

## Why This Track Matters

Every abstraction above hardware depends on this layer:

- arithmetic depends on gates
- registers depend on state-holding circuits
- CPUs depend on ALUs, counters, decoders, and control signals

Without this level, architecture can feel like a black box. With it, hardware
starts to feel built rather than magical.

---

## How This Track Is Organized

```
Phase 1: From Signals to Arithmetic   (Lessons 01-04)
Phase 2: Storing and Routing Bits     (Lessons 05-08)
Phase 3: Timing, CPU Assembly, Silicon (Lessons 09-12)
```

Each lesson starts with a concrete mental model, then introduces the logic idea,
then connects it upward to computers, CPUs, or software.

---

## Phase 1: From Signals to Arithmetic (Lessons 01–04)

- [ ] **01 - From Switches to Logic**
      Transistors as switches, high and low voltage, why digital systems simplify analog reality
- [ ] **02 - Logic Gates**
      AND, OR, NOT, XOR, NAND, truth tables, universality of NAND
- [ ] **03 - Combining Gates**
      Half adders, full adders, building arithmetic from logic
- [ ] **04 - The ALU**
      Addition, subtraction, comparison, bitwise ops as circuit behavior

```
  +----------+     +-------+     +--------+     +------+
  | Switches |---->| Gates |---->| Adders |---->| ALU  |
  +----------+     +-------+     +--------+     +------+
       01             02            03          04
```

---

## Phase 2: Storing and Routing Bits (Lessons 05–08)

- [ ] **05 - Flip-Flops and Memory**
      Latches, D flip-flops, storing one bit, clocked state
- [ ] **06 - Registers and Counters**
      Grouping bits, program counter, instruction register, counting over time
- [ ] **07 - Multiplexers and Decoders**
      Selecting inputs, routing outputs, addressing intuition
- [ ] **08 - Sequential vs Combinational Logic**
      Stateless logic vs stateful logic, finite-state-machine intuition

```
  +------------+     +-----------+     +------------+     +------------+
  | Flip-Flops |---->| Registers |---->| Mux/Decode |---->| Seq vs Comb |
  +------------+     +-----------+     +------------+     +------------+
       05                06              07                08
```

---

## Phase 3: Timing, CPU Assembly, Silicon (Lessons 09–12)

- [ ] **09 - The Clock**
      Clock cycles, synchronization, frequency, why timing matters
- [ ] **10 - Building a Simple CPU**
      ALU, registers, control unit, fetch/decode/execute at the circuit level
- [ ] **11 - From Diagram to Silicon**
      Gates to chips, fabrication at a high level, abstraction boundaries
- [ ] **12 - Why This Matters**
      Connecting logic design to CPU limits, power, performance, and higher-level systems

```
  +--------+     +------------+     +---------+     +--------------+
  | Clock  |---->| Simple CPU |---->| Silicon |---->| Why It Matters|
  +--------+     +------------+     +---------+     +--------------+
      09              10             11               12
```

---

## Who This Track Is For

- Self-taught developers who want to understand how hardware can compute at all
- Systems programmers who want stronger intuition for what the CPU is built from
- Curious learners bridging the gap between “electricity” and “architecture”

## Prerequisites

You should be comfortable with:

- basic binary numbers
- simple conditionals like true/false logic
- the idea that computers use bits and bytes

Helpful but not required:

- [CS Fundamentals](../cs-fundamentals/00-roadmap.md)
- [Data Representation & Encoding](../data-representation-encoding/00-roadmap.md)

---

## What You Will Be Able To Explain After This Track

- how logic gates compute yes/no decisions
- how binary addition emerges from gate combinations
- how one bit can be stored over time
- how registers, counters, and control signals help build a simple CPU
- why hardware timing and circuit design shape performance limits higher up the stack

---

## Time Estimate

```
Phase 1:  ~8 hours   (logic and arithmetic)
Phase 2:  ~8 hours   (state and routing)
Phase 3:  ~7 hours   (timing, simple CPU, physical chips)
          --------
Total:    ~23 hours
```

Use paper, truth tables, and simple logic simulators actively. This material is
much easier when you draw and trace circuits rather than only reading passively.

---

## Recommended Reading

These books are optional — the lessons stand on their own.

- **Code: The Hidden Language of Computer Hardware and Software** by Charles Petzold (Microsoft Press, 2nd Edition 2022) — Best beginner-friendly bridge from simple switches to real computers
- **The Elements of Computing Systems** by Noam Nisan and Shimon Schocken (MIT Press, 2nd Edition 2021) — Build a computer from NAND gates upward; also known as Nand2Tetris
- **Digital Design and Computer Architecture** by Sarah Harris and David Harris (Morgan Kaufmann, 2nd Edition 2012) — Clear treatment of logic and architecture together

---

*Track version: 2026.05*