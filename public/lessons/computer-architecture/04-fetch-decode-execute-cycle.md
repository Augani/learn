# Lesson 04: The Fetch-Decode-Execute Cycle

> **The one thing to remember**: The CPU does not run a program all at once.
> It repeats a tiny loop over and over: fetch the next instruction, decode
> what it means, execute it, update state, and move on.

---

## Start With the Simplest Possible CPU Story

Imagine a worker standing next to a stack of instruction cards.

For each card, the worker does the same thing:

1. Pick up the next card
2. Read what it says
3. Perform the action
4. Put the next-card marker in the right place
5. Repeat

That loop is the core rhythm of computation.

```
THE BASIC CYCLE

  +---------+     +---------+     +---------+     +--------+
  | FETCH   |---->| DECODE  |---->| EXECUTE |---->| UPDATE |
  +---------+     +---------+     +---------+     +--------+
       ^                                                 |
       |                                                 |
       +-------------------------------------------------+
                         repeat forever
```

Real CPUs are much more complicated internally, but this simple loop is still
the right starting point.

---

## Step 1: Fetch

The CPU needs to get the next instruction from memory.

To do that, it uses a special register that tracks where the next instruction
lives. Depending on the ISA, you may hear this called the:

- **program counter**
- **instruction pointer**

Conceptually:

```
FETCH STEP

  Program Counter = address of next instruction
           |
           v
  Memory[address] -> instruction bytes
```

The CPU reads the bytes stored at that address. Those bytes are not useful yet
until the CPU interprets them according to the ISA.

---

## Step 2: Decode

Now the CPU asks:

- What instruction is this?
- Which registers does it use?
- Is there an immediate constant?
- Does it read or write memory?
- Is it a branch?

This is the **decode** step.

If the fetched bytes represent something like:

```asm
ADD R1, R2, R3
```

then the CPU must determine:

- this is an add operation
- the inputs are `R2` and `R3`
- the output goes to `R1`

Decoding is easy to describe and surprisingly important to CPU design.

If instruction encodings are irregular or variable-length, decoding can become
more complex. That is one reason ISA design and microarchitecture interact so closely.

---

## Step 3: Execute

Execution means carrying out the work the instruction requests.

Examples:

- arithmetic in the ALU
- loading data from memory
- storing data to memory
- comparing values
- deciding whether to branch

If the instruction is arithmetic, execution may be as simple as adding two
register values.

If the instruction is a load, execution includes computing an address and
retrieving data from memory.

If the instruction is a branch, execution includes evaluating a condition and
deciding which instruction should come next.

---

## Step 4: Update State

After execution, the CPU must update the machine state.

That can include:

- writing a result into a register
- writing data to memory
- updating status flags
- updating the program counter

The last item is crucial.

If the instruction was a normal one, the program counter usually advances to
the next instruction.

If the instruction was a branch or jump, the program counter may change to a
completely different address.

```
PROGRAM COUNTER MOVEMENT

  Normal instruction:
  PC -> next sequential address

  Branch taken:
  PC -> target address
```

This is how loops, conditionals, and function calls exist at the machine level.

---

## A Full Tiny Example

Suppose memory contains these conceptual instructions:

```asm
1000: LOAD R1, [x]
1004: ADD  R1, R1, #1
1008: STORE [x], R1
1012: HALT
```

Let us trace it.

### Cycle 1

- Program counter points to `1000`
- Fetch instruction at `1000`
- Decode: load from memory into `R1`
- Execute: read value of `x`
- Update: store loaded value into `R1`, advance PC to `1004`

### Cycle 2

- PC points to `1004`
- Fetch add instruction
- Decode operands
- Execute addition
- Update `R1`, advance PC to `1008`

### Cycle 3

- PC points to `1008`
- Fetch store instruction
- Decode destination address and source register
- Execute store
- Update memory, advance PC to `1012`

### Cycle 4

- PC points to `1012`
- Fetch halt instruction
- Decode halt
- Execute stop behavior

This tiny trace is the skeleton of all program execution.

---

## Why This Model Is Both Useful and Incomplete

For learning, this cycle is perfect because it explains:

- how instructions become actions
- how registers and memory interact
- how the program counter controls flow
- why code is really a sequence of machine steps

But it is also incomplete.

Modern CPUs often:

- overlap multiple instructions
- predict branches before knowing the answer
- fetch ahead of time
- reorder some work internally

So the fetch-decode-execute cycle is the logical model, not always the literal
one-instruction-at-a-time physical implementation.

That distinction matters. It lets beginners learn the basic truth first without
getting buried under advanced hardware details too soon.

---

## Where Clock Cycles Fit In

People often say: “A CPU does one thing per clock cycle.”

That is only approximately useful at the beginner stage.

The better statement is:

> Clock cycles are the rhythm that coordinates processor activity, but a modern
> instruction may take multiple cycles, and multiple instructions may overlap.

Still, the simple model remains valuable:

- fetch is one stage
- decode is another stage
- execute is another stage

That staged view is exactly what leads into pipelining next.

---

## Control Flow Is Just Changing the Next Instruction

High-level languages make control flow feel abstract:

- `if`
- `while`
- `for`
- `function call`

At the machine level, the key mechanism is simpler:

- decide what address the program counter should hold next

That is it.

An `if` statement is a conditional change to the next instruction address.
A loop is repeatedly setting the program counter back to an earlier address.
A function call is jumping to another address while remembering where to return.

This is a major mental unlock. Many “advanced” programming constructs reduce to
plain changes in instruction flow.

---

## Why Developers Should Care

Understanding the fetch-decode-execute cycle helps explain:

- why disassembly is readable as sequential instructions
- why branches matter so much for performance
- why instruction decoding can be a real hardware cost
- why profilers and debuggers think in terms of instruction pointers and call stacks
- why pipeline design is such a big deal in modern CPUs

It also gives you a stable mental frame before the track gets more realistic.
When pipelining appears next, you will see that the CPU is not abandoning this
cycle. It is overlapping different parts of it.

---

## Common Misunderstandings

### “One instruction always equals one clock cycle”

No. That is too simple for modern processors.

### “The CPU reads source code line by line”

No. The CPU fetches machine instructions by address.

### “Decode is just a minor detail” 

No. Decoding is a real part of the architecture-performance story, especially
for more complex instruction formats.

### “Programs flow downward naturally” 

Only when the program counter keeps moving sequentially. Branches, calls, and
returns can redirect it constantly.

---

## Hands-On Exercise

Trace a tiny program manually.

1. Write a toy snippet with one variable update and one conditional.
2. Translate it into a fake assembly sequence on paper.
3. Assign instruction addresses like `1000`, `1004`, `1008`.
4. Track the program counter after every instruction.
5. Mark when a branch changes the normal next step.

If you want a visual tool, use a simple CPU simulator or online assembly visualizer
and single-step through a few instructions while watching the instruction pointer.

---

## Recap

- The CPU repeatedly fetches, decodes, executes, and updates machine state.
- The program counter determines which instruction comes next.
- Sequential execution and control flow both reduce to how the next address is chosen.
- The simple cycle is the right logical model before learning pipelining.
- Modern CPUs still follow this model conceptually even when they overlap work internally.

Next, we make the first major leap into modern performance: if the CPU keeps
doing this loop, why not overlap stages from different instructions instead of
waiting for each one to finish completely?