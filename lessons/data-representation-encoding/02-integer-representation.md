# Lesson 02: Integer Representation

> **The one thing to remember**: Integers are stored in a fixed number of bits,
> which means they have a limited range. Unsigned integers use all bits for size,
> while signed integers usually use two's complement so positive and negative values are easy for hardware to handle.

---

## Start With Boxes That Can Hold Only So Much

Imagine you have exactly 8 boxes to store a number, and each box can hold only `0` or `1`.

That means there are only so many distinct patterns possible.

With 8 bits, there are:

```text
2^8 = 256
```

possible bit patterns.

So the first rule of integer representation is simple:

> A fixed number of bits means a fixed representable range.

---

## Unsigned Integers

An **unsigned integer** uses all bits to represent non-negative magnitude.

For an 8-bit unsigned value:

- minimum = `0`
- maximum = `255`

Why 255?

```text
11111111
= 128 + 64 + 32 + 16 + 8 + 4 + 2 + 1
= 255
```

In general, an unsigned $n$-bit integer ranges from:

$$
0 \text{ to } 2^n - 1
$$

---

## Signed Integers Need a Way to Represent Negatives

Unsigned integers are easy because all patterns represent zero or positive numbers.

But programming also needs negative values:

- temperatures
- offsets
- debts
- differences

There are several possible encodings for signed integers, but modern systems almost always use **two's complement**.

---

## Two's Complement Intuition

Two's complement is clever because it makes addition and subtraction hardware simpler.

Instead of treating negative numbers as a totally separate format, it encodes them so normal binary addition still mostly works.

For 8-bit signed integers, the range is:

$$
-128 \text{ to } 127
$$

That is one of the first asymmetries beginners notice:

- there is one more negative value than positive value

That happens because zero uses one pattern, and the remaining patterns split slightly unevenly.

---

## How to Read Two's Complement

For positive values, two's complement looks normal.

Example:

```text
00000101 = 5
```

For negative values, the top bit is set, and the pattern is interpreted differently.

Example:

```text
11111111 = -1
11111110 = -2
10000000 = -128
```

One useful way to get a negative number's representation is:

1. write the positive version in binary
2. flip all bits
3. add 1

Example for `-5` in 8 bits:

```text
 5  = 00000101
flip = 11111010
+1   = 11111011

so -5 = 11111011
```

---

## Why Hardware Likes Two's Complement

The big win is that the same adder hardware can handle both positive and negative values.

Example:

```text
  5  = 00000101
 -5  = 11111011
----------------
       00000000   (ignoring overflow carry out)
```

This is much simpler than designing one system for positives and a totally different one for negatives.

That is why two's complement became the dominant signed integer representation.

---

## Overflow

Because the bit width is fixed, arithmetic can exceed the representable range.

That is **overflow**.

For 8-bit unsigned integers:

```text
255 + 1 = 0   (wraps around modulo 256)
```

For signed integers, overflow means the mathematical result no longer fits in the available bit width.

This can cause surprising behavior depending on the language and compiler.

---

## Sign Extension

Suppose you store `-5` in 8 bits and then widen it to 16 bits.

You need to preserve the meaning of the value, not just copy bits blindly.

This process is called **sign extension**.

For signed two's complement values, you extend by copying the top bit into the new higher bits.

Example:

```text
8-bit  -5: 11111011
16-bit -5: 11111111 11111011
```

That preserves the value.

---

## Signed vs Unsigned Is About Interpretation

This is a crucial rule:

```
BITS: 11111111

Unsigned interpretation: 255
Signed interpretation:   -1
```

Same bits, different meaning.

This is why mixing signed and unsigned values in code can be dangerous. The machine does not tag the bits with human intent. The operations and type system decide how to interpret them.

---

## Why Developers Should Care

Integer representation explains:

- why fixed-width types have limits
- why integer overflow bugs happen
- why signed/unsigned mismatches are dangerous
- why low-level binary protocols must specify width and signedness clearly
- why bit masks and flags use integers so naturally

If you ignore width and signedness, bugs become easy to write and hard to diagnose.

---

## Common Misunderstandings

### “An int can represent any whole number”

No. It only represents the range allowed by its bit width.

### “Negative numbers have a minus sign stored somewhere”

Not in ordinary binary integer representation. The bits themselves encode the value.

### “Overflow means the hardware made a mistake” 

No. Overflow is the natural result of doing arithmetic in a fixed-size representation.

---

## Hands-On Exercise

Work with 8-bit integers manually.

1. Write the 8-bit unsigned binary forms of `13` and `200`.
2. Write the 8-bit two's complement form of `-5` and `-12`.
3. Add `250 + 10` as unsigned 8-bit arithmetic and note the wraparound.
4. Interpret `11111111` as both signed and unsigned.

If you want a tool, use a binary calculator that shows two's complement and fixed-width overflow.

---

## Recap

- Integers live in a fixed number of bits, so they have finite ranges.
- Unsigned integers use all bits for magnitude.
- Signed integers usually use two's complement for efficient hardware arithmetic.
- Overflow happens when the result does not fit the available width.
- Signedness is an interpretation rule, not a separate magic kind of bits.

Next, we move from exact whole numbers to the trickier world of approximate real numbers: floating point.