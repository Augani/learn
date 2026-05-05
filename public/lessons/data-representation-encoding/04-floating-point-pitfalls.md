# Lesson 04: Floating Point Pitfalls

> **The one thing to remember**: Floating point is usually good enough for
> measurement and approximation, but dangerous when you expect exact decimal
> answers or exact equality. Most floating-point bugs are really expectation bugs.

---

## The Famous Surprise

In many languages:

```text
0.1 + 0.2 != 0.3
```

This feels absurd at first.

But now you know the reason:

- `0.1` is not represented exactly
- `0.2` is not represented exactly
- `0.3` is not represented exactly
- the rounded approximations do not line up exactly the way human decimal intuition expects

So the machine is not being random. It is being consistent with finite binary approximation.

---

## Equality Is the First Trap

With integers, exact equality usually means what you think it means.

With floats, exact equality can be fragile because tiny rounding differences may appear.

That means this style can be dangerous:

```python
if result == expected:
    ...
```

for values produced through real floating-point arithmetic.

Instead, many programs compare using a tolerance:

```text
abs(a - b) < small_threshold
```

The exact threshold depends on the domain.

---

## Accumulated Error

Tiny rounding differences become more visible when:

- many operations are chained
- subtraction loses significant digits
- values of very different magnitudes are combined

This is why a long-running simulation, aggregation, or iterative optimization can drift slightly over time.

The error is often small relative to the workload, but sometimes it is large enough to matter.

---

## Catastrophic Cancellation

One especially nasty case is subtracting two nearly equal floating-point numbers.

When this happens, many leading digits cancel out, and the remaining result may carry much less reliable precision.

You do not need to derive the full numerical-analysis theory here. The practical lesson is:

> Some formulas are numerically unstable even when they are mathematically correct.

This is why scientific and graphics libraries sometimes rewrite formulas in less obvious but more stable forms.

---

## Order of Operations Can Change the Result

With exact arithmetic, addition is nicely associative:

```text
(a + b) + c = a + (b + c)
```

With floating point, finite rounding means the grouping can change the result slightly.

That matters in:

- parallel reductions
- distributed aggregates
- ML training
- financial reports if floats were used incorrectly

This is one reason reproducibility in numeric software can be surprisingly hard.

---

## Money Is the Classic “Use Something Else” Case

If you are storing currency, exact decimal rules usually matter.

Binary floating point is often the wrong tool because decimal fractions like `0.01` are not always exact in binary.

Common alternatives include:

- integer cents
- fixed-point representation
- decimal numeric types

The right choice depends on the domain, but the principle is stable:

> Use floating point for approximate real quantities, not for exact decimal accounting unless you truly know what you are doing.

---

## NaN Is Weird on Purpose

`NaN` has behaviors that surprise many developers.

One especially important one is:

```text
NaN != NaN
```

That looks bizarre, but it reflects the fact that NaN means “this is not a meaningful numeric result,” not “this is a normal value with a name.”

That means code that deals with NaN often needs explicit checks instead of ordinary equality logic.

---

## Floating Point in ML, Graphics, and Simulation

These fields tolerate floating-point approximation because:

- the quantities already come from measurement or approximation
- exact decimal semantics are not the goal
- speed and throughput matter heavily

That does not mean floating point is harmless there. It just means the tradeoff is acceptable and often expected.

This is why you will see:

- `float16`
- `bfloat16`
- `float32`
- `float64`

used differently depending on performance, memory, and accuracy needs.

---

## Why Developers Should Care

This lesson explains:

- why float equality checks are risky
- why numeric bugs can be intermittent or data-dependent
- why financial systems often avoid binary floating point
- why distributed and parallel numeric code can produce slightly different results between runs
- why choosing the right numeric type is a design decision, not a syntax detail

Understanding these pitfalls prevents a whole class of “the computer is wrong” debugging sessions.

---

## Common Misunderstandings

### “Floating point is broken”

No. It is a deliberate engineering tradeoff for approximate real-number work.

### “Just use more precision and the problem disappears”

More precision helps, but type choice and algorithm stability still matter.

### “Exact equality is always wrong for floats” 

Not always. It can be fine in some controlled cases. The danger is assuming it is always safe after general arithmetic.

---

## Hands-On Exercise

Try these in a REPL or small program.

1. Print `0.1 + 0.2` and compare it to `0.3`.
2. Compare two float values using exact equality and then using a small tolerance.
3. Sum a list of many tiny floating-point values in different orders and compare the results.
4. If your language has decimal types, compare float behavior with decimal behavior on money-like values.

---

## Recap

- Floating-point bugs usually come from expecting exact decimal behavior from approximate binary representation.
- Equality checks on computed floats are often risky.
- Rounding error can accumulate and formula choice can affect numerical stability.
- Financial and exact-decimal domains often need fixed-point, integer, or decimal representations instead.
- Choosing the right numeric representation is part of correct software design.

Next, we leave numbers and move to one of the most visible representation problems in everyday software: text encoding.