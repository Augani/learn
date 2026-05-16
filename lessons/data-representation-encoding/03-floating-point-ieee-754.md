# Lesson 03: Floating Point (IEEE 754)

> **The one thing to remember**: Floating point is a compact scientific-notation-like
> way to represent a huge range of real-number approximations using a fixed number of bits.
> It gives you scale and speed, but not exact decimal behavior.

---

## Start With Scientific Notation

Humans already use a compressed notation for very large or very small numbers:

```text
6,500,000   = 6.5 × 10^6
0.00042     = 4.2 × 10^-4
```

Floating point does something similar in binary.

Instead of storing every digit directly, it stores pieces that mean roughly:

- sign
- scale
- significant digits

That lets a fixed number of bits represent values across a very wide range.

---

## The Three Main Parts

IEEE 754 floating point is usually described in terms of:

- **sign bit**
- **exponent**
- **fraction** or **mantissa/significand field**

For a 32-bit float:

```
  [ sign | exponent | fraction ]
    1 bit   8 bits     23 bits
```

The sign says positive or negative.
The exponent sets the scale.
The fraction stores the significant digits.

---

## The Binary Scientific-Notation Idea

Very roughly, a normalized floating-point number behaves like:

$$
(-1)^{sign} \times 1.fraction \times 2^{exponent-bias}
$$

You do not need to memorize the formula immediately. The important intuition is:

- the exponent changes the size range
- the fraction controls precision within that range

This is why floating point can represent huge and tiny values, but only approximately.

---

## Range vs Precision

Floating point is always balancing two goals:

- represent numbers across a wide range
- retain enough precision to be useful

You do not get infinite accuracy. You get finite precision spread across a broad scale.

That is a major tradeoff.

Integers give exact whole-number results within a limited range.
Floating point gives approximate real-number results across a much larger range.

---

## Why Some Numbers Are Exact and Others Are Not

Some fractions are easy in binary.

Example:

```text
0.5  = 1/2   = exact in binary
0.25 = 1/4   = exact in binary
```

Some decimal fractions are not finite in binary.

Example:

```text
0.1 in decimal is repeating in binary
```

That means the stored float is the closest representable approximation, not perfect `0.1`.

This is the root of many floating-point surprises.

---

## 32-bit vs 64-bit Floats

Two common formats are:

### 32-bit float

- smaller
- faster or more memory-efficient in some contexts
- less precision

### 64-bit float

- larger
- more precision
- much more common for general-purpose application calculations where accuracy matters more

More bits do not make floating point exact for all decimals. They just reduce the error and enlarge the available range.

---

## Special Values

IEEE 754 also reserves patterns for special cases.

### Infinity

Represents overflow-like extremes such as dividing a nonzero finite value by zero in many environments.

### NaN

**Not a Number** values represent undefined numeric results such as:

- `0/0`
- invalid operations

### Denormals / Subnormals

These help represent values very close to zero more gradually instead of dropping suddenly to zero.

You do not need all the edge-case details yet, but it helps to know floating point includes explicit special cases.

---

## Rounding Happens All the Time

Because many real numbers are not exactly representable, operations often involve rounding to the nearest representable value.

That means tiny errors can accumulate across many operations.

This is not a bug in your computer. It is the normal behavior of finite-precision representation.

---

## Why Developers Should Care

Floating point explains:

- why money usually should not be stored in binary floating point
- why ML and scientific computing often accept approximate arithmetic
- why repeated arithmetic can drift slightly
- why equality comparisons on floats can be dangerous
- why `float32` and `float64` lead to different accuracy and memory tradeoffs

If your code deals with measurements, graphics, simulations, ML, finance, or geometry, floating point matters directly.

---

## Common Misunderstandings

### “Floating point stores decimals exactly”

No. It stores binary approximations of many real-number values.

### “More bits means no floating point problems”

No. More bits reduce error but do not eliminate the representation tradeoff.

### “NaN is just another ordinary number” 

No. It represents undefined or invalid numeric results.

---

## Hands-On Exercise

Inspect floating-point values in your language of choice.

1. Print `0.1` with high precision.
2. Print `0.1 + 0.2` with high precision.
3. Compare `float32` and `float64` if your language makes both easy.
4. Try operations that produce very large, very small, or invalid results and observe `inf` or `NaN` behavior if exposed.

If you want a visual tool, use an IEEE 754 explorer that shows sign, exponent, and fraction bits for a number.

---

## Recap

- Floating point is binary scientific notation with finite precision.
- IEEE 754 stores sign, exponent, and fraction bits.
- It provides huge range but only approximate representation for many values.
- Some decimals are not exact in binary, so rounding is unavoidable.
- Floating point includes special values such as infinity and NaN.

Next, we turn these ideas into the practical bugs developers actually see: surprising sums, failed equality checks, and when to use decimal or integer representations instead.