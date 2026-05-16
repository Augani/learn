# Lesson 05: Pipelining

> **The one thing to remember**: Pipelining makes a CPU faster not by making
> one instruction finish instantly, but by overlapping different stages of
> many instructions at the same time.

---

## Start With an Assembly Line

Imagine a bakery making sandwiches.

If one worker does every step for one sandwich before starting the next,
throughput is low:

1. slice bread
2. add filling
3. wrap sandwich
4. start over

Now imagine an assembly line:

- worker 1 slices bread for sandwich A
- worker 2 adds filling to sandwich A while worker 1 slices bread for sandwich B
- worker 3 wraps sandwich A while the earlier stages work on B and C

No individual sandwich became magically free. But many sandwiches are in flight
at once, so the number finished per minute goes up.

That is pipelining.

```
WITHOUT PIPELINING

  Cycle:   1   2   3   4   5   6
  Instr A  F   D   E   -   -   -
  Instr B  -   -   -   F   D   E

WITH PIPELINING

  Cycle:   1   2   3   4   5   6
  Instr A  F   D   E   -   -   -
  Instr B  -   F   D   E   -   -
  Instr C  -   -   F   D   E   -
```

`F` is fetch, `D` is decode, `E` is execute.

---

## From the Basic Cycle to a Pipeline

Last lesson, we used the logical sequence:

1. fetch
2. decode
3. execute
4. update state

That is still correct, but a real CPU can treat these as stages and overlap them.

```
SIMPLIFIED PIPELINE

  +--------+   +--------+   +--------+   +---------+
  | Fetch  |-->| Decode |-->| Execute|-->| Writeback|
  +--------+   +--------+   +--------+   +---------+
```

Once the pipeline is full:

- one instruction is being fetched
- another is being decoded
- another is being executed
- another is writing its result back

This is why pipelines improve **throughput**.

---

## Latency vs Throughput

This is the first important distinction.

### Latency

How long one instruction takes from start to finish.

### Throughput

How many instructions can be completed in a period of time.

Pipelining mainly improves throughput.

That means a single instruction may still need several stages to finish, but
the processor can complete instructions more frequently once the line is full.

Think of it as:

- latency: time for one sandwich
- throughput: sandwiches per minute

---

## Why Pipelining Works

Different kinds of hardware work are needed at different times.

- instruction fetch uses front-end fetch logic and instruction memory path
- decode interprets instruction fields
- execute uses ALUs, load/store units, or branch units
- writeback stores results into architectural state

If those stages can operate partly independently, the CPU can keep more of its
hardware busy instead of letting one part wait while another works.

That is the big idea:

> Idle hardware is wasted potential. Pipelines keep more of the processor active.

---

## A Simple Pipeline Trace

Suppose we have three instructions:

```asm
LOAD R1, [x]
ADD  R2, R1, #1
STORE [x], R2
```

In a simplified pipeline:

```
Cycle   LOAD          ADD           STORE
-----   ----          ---           -----
1       Fetch
2       Decode        Fetch
3       Execute       Decode        Fetch
4       Writeback     Execute       Decode
5                     Writeback     Execute
6                                   Writeback
```

Once instruction 1 moves forward, the next stages can start accepting new work.

---

## Pipelines Create Hazards

Overlapping work is good until one instruction depends on another, or the CPU
does not yet know what should happen next.

Those problems are called **hazards**.

There are three big categories worth knowing.

### 1. Data Hazards

An instruction needs a value that a previous instruction has not finished producing yet.

Example:

```asm
ADD R1, R2, R3
SUB R4, R1, R5
```

The `SUB` depends on the result of the `ADD`.

### 2. Control Hazards

The CPU does not know which instruction comes next because of a branch.

Example:

```asm
CMP R1, #0
BEQ target
```

Until the condition is resolved, the next fetch may be uncertain.

### 3. Structural Hazards

Two operations need the same hardware resource at the same time.

Example:

- one instruction wants a memory access
- another wants the same unit simultaneously

---

## Stalls and Bubbles

When the CPU cannot safely advance an instruction through the pipeline,
it may need to wait.

That wait is a **stall**.

The empty slot created in the pipeline is often called a **bubble**.

```
PIPELINE WITH A BUBBLE

  Cycle:   1   2   3   4   5
  Instr A  F   D   E   W
  Instr B  -   F   D   stall E   W
```

Each bubble reduces throughput. The pipeline is still useful, but less efficient.

---

## Forwarding: A Key Fix for Data Hazards

One common optimization is **forwarding** or **bypassing**.

Instead of waiting until a result is fully written back to the register file,
the CPU can route the just-produced result directly to a later stage that needs it.

```
WITHOUT FORWARDING

  ADD produces result -> write back later -> next instruction reads it

WITH FORWARDING

  ADD produces result -> send directly to dependent instruction
```

This reduces some stalls, though not all of them.

Loads are a common case where the data may still arrive late enough to create
load-use delays.

---

## Deeper Pipelines: Good and Bad

You might think: if pipelining helps, just add more stages.

Sometimes that works. Splitting work into smaller stages can allow a higher
clock frequency.

But deeper pipelines also make some penalties worse:

- branch mispredictions cost more because more wrong-path work is in flight
- hazard handling becomes more complex
- pipeline refill costs increase

This is a recurring architecture tradeoff:

> A design that improves one metric can worsen another.

---

## Why Developers Should Care

Pipelining explains several real performance facts:

- why instruction order can matter
- why dependent operations can slow a hot loop
- why branches can hurt throughput
- why the CPU is always trying to keep useful work in flight

It also explains why modern profilers and hardware counters talk about:

- pipeline stalls
- front-end bottlenecks
- back-end bottlenecks
- branch misses

Those are not random diagnostic terms. They describe how well the pipeline is being fed and used.

---

## Common Misunderstandings

### “Pipelining means one instruction finishes in one cycle”

No. It means multiple instructions overlap across stages.

### “A pipeline is always full”

No. Hazards, cache misses, branches, and other delays can leave it underused.

### “More stages always means better performance” 

No. Deeper pipelines can increase branch penalties and complexity.

---

## Hands-On Exercise

Take three simple pseudo-instructions and draw a pipeline chart by hand.

1. Write one sequence with no dependencies.
2. Write another where instruction 2 depends on instruction 1.
3. Mark where the stall or forwarding path would be needed.
4. Compare total cycles in both cases.

If you want a tool, use a basic pipeline simulator or any CPU architecture teaching visualizer online.

---

## Recap

- Pipelining improves throughput by overlapping instruction stages.
- It does not make a single instruction magically free.
- Hazards create stalls and bubbles that reduce efficiency.
- Forwarding helps resolve some data dependencies.
- Pipeline design is one of the core reasons modern CPUs are fast.

Next, we follow the most famous pipeline problem: branches. When the processor
does not know what instruction comes next, it has to guess or wait.