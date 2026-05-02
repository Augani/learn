# Lesson 54: Amortized and Probabilistic Analysis

> **Analogy**: If one grocery trip is expensive because you buy in bulk,
> that does not mean each meal is expensive. One large cost is being
> spread over many later uses. Amortized analysis formalizes that idea.
> Probabilistic analysis asks a different question: if randomness is part
> of the process, what can we say about expected behavior and how rarely
> bad outcomes occur?

---

## Why This Matters

By now, you have seen several structures and algorithms whose true
performance story is not captured by “worst-case cost of one step.”

Examples:

- dynamic arrays occasionally resize expensively
- splay trees occasionally perform many rotations
- Fibonacci heaps delay work and pay later
- randomized quicksort can get unlucky but is fast in expectation
- skip lists are not deterministically balanced but behave well with high
  probability

This lesson ties those ideas together.

The goal is to understand two different lenses:

- **amortized analysis**: average over an operation sequence
- **probabilistic analysis**: average or concentration over randomness

If you confuse them, you lose an important part of advanced algorithmic
reasoning.

---

## First Distinction: What Are We Averaging Over?

This is the cleanest way to separate the two ideas.

```
  ANALYSIS TYPE        AVERAGES OVER

  Amortized            a sequence of operations
  Probabilistic        random choices / random inputs
```

Amortized analysis needs no randomness.
Probabilistic analysis does.

That one distinction prevents many common mistakes.

---

## Amortized Analysis

### Core question

If some operations are expensive, can the entire sequence still have low
average cost per operation?

The point is not that every operation is cheap.
The point is that expensive operations happen infrequently enough that
the total sequence cost stays controlled.

---

## Dynamic Array Append: The Canonical Example

### Surface-level confusion

Appending to a dynamic array is usually $O(1)$, but when the array is
full, resizing and copying may cost $O(n)$.

At first glance this looks contradictory.

### Growth trace

Suppose capacity doubles on each resize:

```
  append into capacity 1
  append into capacity 2
  append into capacity 4
  append into capacity 8
  append into capacity 16
```

Copy work across the expansion sequence looks like:

$$
1 + 2 + 4 + 8 + \cdots < 2n
$$

So after `n` appends, the **total** copying work is still linear.

That gives:

$$
\frac{O(n)}{n} = O(1)
$$

amortized per append.

### What this really teaches

Amortized analysis is about proving that rare expensive events are paid
for by many cheap events around them.

---

## Three Standard Amortized Methods

### 1. Aggregate method

Add the total cost of a long operation sequence, then divide.

This is often the most intuitive method.

### 2. Accounting method

Pretend each cheap operation pays a little extra. Save that extra as
credits that will pay for future expensive operations.

For dynamic arrays, each append can be imagined to deposit a few tokens
to pay for later copying.

### 3. Potential method

Define a potential function $\Phi$ measuring stored “future work” or
“imbalance” in the data structure.

The amortized cost of an operation is:

$$
\text{actual cost} + \Delta \Phi
$$

This is the most abstract method, but also the most powerful.

---

## Potential Method Deep Dive

The potential method often feels mysterious because the potential is not
a physical quantity. It is a bookkeeping device.

### Intuition

If the structure becomes more “tense” or “prepared for future work,” the
potential rises.
If an expensive cleanup happens, the potential can fall and help pay for
that work.

### Dynamic-array intuition with potential

When the array is partly full, there is not much immediate pressure.
As the array fills, pressure rises because a resize is approaching.

After a resize, there is lots of free capacity again, so that pressure
drops.

That rise-and-fall is exactly what potential is trying to encode.

### Why this method matters

It lets you prove strong sequence guarantees for structures where local
cost fluctuates wildly.

---

## Splay Trees And Why Amortization Matters

Splay trees are the classic example where per-operation worst-case cost
does not tell the real story.

A single `find` can trigger many rotations.
That sounds bad.

But across a long sequence of accesses, especially with locality, splay
trees perform very well.

### Big lesson

Splay trees are not selling:

> every operation is cheap

They are selling:

> the sequence behaves well enough that the average cost per operation is
> logarithmic in the amortized sense

This is a major conceptual upgrade from beginner complexity thinking.

---

## Fibonacci Heaps And Deferred Work

Fibonacci heaps are another excellent amortized-analysis case study.

### Design philosophy

Do not consolidate aggressively after every small change.
Delay restructuring and pay for it later when `extract-min` happens.

This gives operations like `insert` and `decrease-key` very low
amortized cost.

### What this teaches

Sometimes the fastest structure is not the one that keeps itself clean at
every moment. Sometimes it is the one that postpones work until it must
be done.

That design philosophy is fundamentally amortized.

---

## Probabilistic Analysis

### Core question

If random choices are part of the algorithm or model, what can we say
about average behavior and rare bad outcomes?

This is a different kind of “average” from amortized analysis.

---

## Expected-Time Analysis

The main object here is the expected value:

$$
E[T]
$$

for a random running time `T`.

### Example: randomized quicksort

Worst-case partitions are still possible.
Nothing about randomization forbids unlucky pivots.

What randomization changes is this:

- consistently terrible pivots become unlikely
- the expected split behavior is balanced enough to produce

$$
O(n \log n)
$$

expected runtime.

### Why this matters in practice

Randomization often protects an algorithm against adversarial or highly
structured input.

---

## Skip Lists And Probabilistic Balance

Skip lists do not use rigid rotations like AVL or red-black trees.
They rely on random tower heights.

That means their guarantees are naturally probabilistic:

- expected search is logarithmic
- very tall or very imbalanced structures are unlikely

The analysis story is therefore about random structure, not sequence
averaging.

---

## Expectation vs High Probability

Expected performance is useful, but sometimes you want stronger control
over bad events.

### Expectation

Tells you the average outcome.

### High probability

Tells you that large deviations from the good behavior are extremely
unlikely.

Those are not the same thing.

An algorithm can have a good expectation but still occasionally behave
very badly with non-negligible probability.

---

## Chernoff Bounds Overview

At a high level, Chernoff bounds are tools that say:

> When many independent random events are summed, the probability of a
> large deviation away from the mean drops exponentially fast.

### Why they matter algorithmically

They let us move from:

- “the expected number of bad events is small”

to stronger statements like:

- “the chance of seeing far too many bad events is tiny”

### Intuition example

If a randomized structure expects about `k` promoted nodes at some level,
Chernoff-style reasoning helps justify that seeing wildly more than `k`
is very unlikely.

You do not need to derive the full inequalities here. What matters is
knowing what they are for:

- concentration around expectation
- bounding tail events
- upgrading “average” intuition into “rarely deviates much” reasoning

---

## Amortized vs Probabilistic Side By Side

```
  EXAMPLE                            RIGHT LENS

  dynamic-array append               amortized
  splay tree access sequence         amortized
  Fibonacci heap operations          amortized
  randomized quicksort               probabilistic
  skip list search                   probabilistic
  reservoir sampling guarantees      probabilistic
```

This table is worth internalizing.

When you pick the wrong lens, your explanation becomes confused even if
your intuition is vaguely correct.

---

## What If We Only Used Worst-Case Per-Operation Analysis?

We would misread several powerful structures.

- dynamic arrays would look suspicious because resize is expensive
- splay trees would look worse than their real sequence behavior
- Fibonacci heaps would hide the value of deferred work
- randomized algorithms would lose the language needed to explain their
  strength

This is why advanced DSA requires more than one notion of efficiency.

---

## Final Mental Model

When you see a new structure or algorithm, ask:

1. Is the cost fluctuating across a sequence without randomness?
   That suggests amortized analysis.
2. Is randomness part of the process?
   That suggests expected-value or concentration analysis.
3. Do I care only about the mean, or also about how unlikely large
   deviations are?
   That suggests high-probability tools like Chernoff-style bounds.

Those three questions give you the right analytical lens surprisingly
often.

---

## Exercises

1. Why is dynamic-array append amortized $O(1)$ even though resizing can
   cost $O(n)$? Use the accounting method: how many "coins" do you deposit
   per append, and how do you pay for the expensive resize?
2. What does the potential function conceptually represent? In the context
   of a dynamic array, what is the potential when the array is half full
   versus completely full?
3. Why are splay trees more naturally explained with amortized analysis
   than strict worst-case per-operation analysis? Describe a sequence of
   operations where a single splay is expensive but the total sequence is
   cheap.
4. Why is randomized quicksort analyzed probabilistically rather than
   amortized? What is the fundamental difference between averaging over
   random input order versus averaging over random pivot choices?
5. What problem does a Chernoff bound solve that expectation alone does
   not? Explain with a concrete example: if a skip list level expects 2
   promoted nodes, why might you care about the probability of seeing 20?
6. A data structure has operations that cost either 1 or 100 units. After
   every expensive operation, the next 50 operations are guaranteed cheap.
   Use aggregate or accounting analysis to show the amortized cost per
   operation is $O(1)$.
7. In reservoir sampling, prove by induction that after processing `i` items,
   each item has probability `1/i` of being stored. Why is this a
   probabilistic invariant rather than an amortized guarantee?
8. Compare amortized analysis and probabilistic analysis for a hash table
   with chaining. Which analysis is appropriate for the cost of a single
   insert? Which is appropriate for the cost of rehashing the entire table?

---

## Key Takeaways

- Amortized analysis averages over operation sequences without requiring
  randomness.
- Probabilistic analysis averages over random choices or inputs.
- The aggregate, accounting, and potential methods are the main tools of
  amortized reasoning.
- Expected value explains typical randomized performance, while
  concentration tools explain why bad deviations are rare.
- Advanced algorithm design requires choosing the right analysis lens,
  not just computing a single worst-case bound.

This completes Phase 7 and the advanced DSA mastery sequence.

---

**Previous**: [Lesson 53 — Practice Problems — Advanced Topics](./53-practice-advanced.md)
**Next**: [Lesson 55 — Problem-Solving Methodology](./55-problem-solving-methodology.md)