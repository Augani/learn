# Lesson 06: Branch Prediction

> **The one thing to remember**: Branch prediction exists because pipelines
> hate uncertainty. When the CPU reaches a branch, it often guesses the most
> likely next path so the pipeline can keep moving instead of waiting.

---

## Start With a Fork in the Road

Imagine driving at highway speed toward a fork in the road.

You have two choices:

- slow down and wait until the sign is perfectly readable
- make your best guess early so you keep moving

Modern CPUs usually choose the second strategy.

Branches create a question:

- continue to the next sequential instruction?
- jump to a different target?

If the CPU waited every time, the pipeline would keep losing momentum.
So it predicts.

---

## Why Branches Are a Pipeline Problem

In straight-line code, the next instruction address is predictable:

- current instruction ends
- program counter advances normally

But with a conditional branch:

```asm
CMP R1, #0
BEQ target
```

the processor does not immediately know which instruction to fetch next.

```
CONTROL UNCERTAINTY

           branch instruction
                  |
          +-------+-------+
          |               |
          v               v
      next sequential   branch target
```

If fetch pauses until the condition is fully known, the pipeline stalls.

---

## The Basic Idea of Prediction

The CPU predicts:

1. whether the branch will be taken
2. where execution should continue if it is taken

Then it starts fetching and often decoding along that predicted path.

If the guess is correct, the pipeline keeps flowing.
If the guess is wrong, the CPU throws away the incorrect in-flight work and restarts on the correct path.

That discard is called a **pipeline flush**.

---

## The Cost of a Wrong Guess

A misprediction is expensive because the CPU may have already spent cycles on:

- fetching wrong instructions
- decoding them
- maybe even partially executing them speculatively

```
MISPREDICTION

  predict path A
       |
       v
  fetch/decode wrong instructions
       |
       v
  discover actual path was B
       |
       v
  flush wrong work and restart
```

The deeper the pipeline, the more work may need to be discarded.

This is why branches matter so much for performance, especially in tight loops
and highly branchy code.

---

## Static Prediction

The simplest approach is **static prediction**.

That means using a fixed rule, such as:

- always predict not-taken
- backward branches are likely taken
- forward branches are likely not-taken

This is simple and cheap, but limited. Real programs have behavior patterns,
and static rules cannot learn them.

---

## Dynamic Prediction

Modern CPUs use **dynamic branch prediction**, which means they learn from past behavior.

The intuitive idea is straightforward:

- if this branch was taken many times before, predict taken again
- if it usually falls through, predict that instead

One beginner-friendly way to think about it is a tiny memory attached to the predictor:

```
BRANCH HISTORY IDEA

  Branch at address X
  Past outcomes: taken, taken, taken, not taken, taken

  Predictor uses history to guess the next outcome
```

Real predictors are much more sophisticated, but the central idea is pattern learning.

---

## Why Loops Are Predictor-Friendly

Loops often create a branch that is:

- taken many times
- not taken once at the end

That makes them highly predictable.

Example:

```c
for (int i = 0; i < 1000; i++) {
    work();
}
```

The branch at the loop end is taken over and over, then finally not taken.

Predictors love regularity like this.

---

## Why Unpredictable Branches Hurt

Suppose a branch depends on random-looking data:

```python
if value_from_random_input > threshold:
    fast_path()
else:
    slow_path()
```

If the outcome changes in a hard-to-learn way, the predictor may guess badly.

That creates repeated flushes, which can destroy throughput.

This is why performance-aware code sometimes favors:

- more regular control flow
- branchless techniques in hot loops
- data layouts that create predictable behavior

Not because branches are evil in general, but because unpredictable branches are costly.

---

## Branch Target Prediction

It is not enough to know whether a branch is taken. The CPU also wants to know
where to fetch next.

For a taken branch, that means predicting the target address quickly.

This is part of what branch-target structures help with. Again, the details can
be elaborate, but the simple mental model is enough:

- outcome prediction: taken or not taken?
- target prediction: if taken, where do we go?

---

## Speculation and Correctness

Prediction is often tied to **speculative execution**.

The CPU may start doing work down the predicted path before it knows for sure
that the path is correct.

That sounds dangerous, so here is the key rule:

> Speculative work only becomes architecturally visible if the prediction turns out to be correct.

If the prediction was wrong, the speculative results are discarded.

This allows the CPU to chase performance without changing the logical behavior
of the program.

---

## Branches and Software Design

Developers usually do not micromanage branch prediction directly, but they do
write code that interacts with it.

Examples:

- tight loops over predictable data often run very well
- data-dependent branching in hot code can be expensive
- sorted data may branch more predictably than unsorted data
- lookup-table or vectorized approaches can sometimes avoid branch costs

This is one reason performance advice can sound strange at first. You are not
just writing logic. You are writing logic for a speculative, pipelined machine.

---

## Security Side Note

Branch prediction and speculation are not only performance topics. They also
matter for security.

Some side-channel attacks, such as Spectre-class ideas, exploit the fact that
speculative execution can leave measurable traces in microarchitectural state
even when the wrong-path work is later discarded architecturally.

You do not need the full attack details yet. The useful takeaway is:

- architectural correctness is one thing
- microarchitectural side effects are another

That distinction becomes very important in modern systems security.

---

## Common Misunderstandings

### “The CPU just waits at every branch”

Not usually. Modern processors predict aggressively to avoid that.

### “Correctness depends on good prediction”

No. Good prediction affects performance. Wrong predictions get rolled back.

### “All branches are equally bad” 

No. Highly predictable branches can be cheap compared with unpredictable ones.

---

## Hands-On Exercise

Compare predictable and unpredictable branching.

1. Write one loop whose branch outcome is regular, such as counting to a limit.
2. Write another where the branch depends on randomized or shuffled data.
3. Time both versions in a language you know, or inspect benchmark discussions online.
4. If available, use a profiler or hardware counters to look for branch-miss differences.

If you do not want to code, search for a branch-prediction visualizer and step through predictable versus random patterns.

---

## Recap

- Branches create uncertainty about the next instruction.
- Prediction lets the pipeline keep moving by guessing the likely path.
- Correct guesses preserve throughput; wrong guesses cause flushes and wasted work.
- Dynamic predictors learn patterns and work especially well on regular code such as loops.
- Unpredictable branches can become a major performance cost.

Next, we go further. If the CPU can predict and speculate, can it also change
the order of some instructions internally to stay busy? Yes, and that leads to
out-of-order execution.