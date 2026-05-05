# Lesson 07: Multiplexers and Decoders

> **The one thing to remember**: Multiplexers select one input from many, and
> decoders turn a compact control input into one-of-many output selection.
> Together they are key routing tools in digital systems.

---

## Start With a Railway Switchyard

Imagine trains arriving on several tracks, but only one should continue onto the outgoing line depending on a control decision.

That is the intuition behind a **multiplexer**.

Now imagine the reverse: one compact control code decides which destination gate opens.
That is the intuition behind a **decoder**.

---

## Multiplexer: One of Many Inputs

A **multiplexer**, often called a **mux**, chooses one input signal from several candidates and forwards it to the output.

```
MUX IDEA

  in0 ---\
  in1 ----> [ mux ] ---> out
  in2 ---/

  select lines choose which input wins
```

This is useful whenever hardware needs to say, “Use source A now, source B later.”

---

## Decoder: One Control Value, Many Possible Outputs

A **decoder** does roughly the opposite kind of job.

It takes a smaller binary control input and activates one corresponding output line.

Example intuition:

- input `00` activates output 0
- input `01` activates output 1
- input `10` activates output 2
- input `11` activates output 3

This is useful for selecting registers, memory rows, or control destinations.

---

## Why Routing Matters

So far we have talked about computing and storing values. But systems also need to **route** values:

- which register feeds the ALU?
- which result gets written back?
- which memory cell is being addressed?

Muxes and decoders are major pieces of that routing story.

---

## Addressing Intuition

When hardware uses an address to choose one location among many, decoding is often part of the story.

For beginners, the mental model is:

- a binary value is presented
- logic expands that value into a selection of one target among many

That is a core pattern in memory addressing and control logic.

---

## Why Developers Should Care

Multiplexers and decoders explain:

- how hardware selects among alternative data paths
- how addresses can choose one location or register among many
- why control signals are such a central part of processor design

These are the routing primitives that let the same hardware resources be reused flexibly.

---

## Hands-On Exercise

Sketch a 2-to-1 mux.

1. Label two inputs: `A` and `B`.
2. Add one select line `S`.
3. Write which input reaches the output when `S = 0` and when `S = 1`.
4. Then draw a 2-bit decoder truth table with four outputs.

---

## Recap

- Multiplexers select one input from many.
- Decoders expand a control value into one-of-many selection outputs.
- These circuits route data and control throughout digital systems.
- Addressing, register selection, and control logic all depend heavily on these ideas.

Next, we step back and distinguish two big categories of digital circuits: combinational and sequential logic.