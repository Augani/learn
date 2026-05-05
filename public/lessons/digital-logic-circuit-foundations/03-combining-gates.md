# Lesson 03: Combining Gates

> **The one thing to remember**: Arithmetic does not require a special “math box.”
> It can be built from logic gates. Adders are the first major example of useful computation emerging from simple logic composition.

---

## Start With One-Bit Addition

What happens when you add one-bit values?

```text
0 + 0 = 0
0 + 1 = 1
1 + 0 = 1
1 + 1 = 10   (sum 0, carry 1)
```

That last case is the crucial one. A one-bit result is not enough. We also need a **carry**.

This is how arithmetic becomes circuit design.

---

## The Half Adder

A **half adder** adds two one-bit inputs and produces:

- a sum bit
- a carry bit

If you look at the truth table, something beautiful appears:

```
HALF ADDER

  A  B | SUM CARRY
  -----+----------
  0  0 |  0    0
  0  1 |  1    0
  1  0 |  1    0
  1  1 |  0    1
```

The sum column matches XOR.
The carry column matches AND.

So a half adder can be built from:

- one XOR gate for sum
- one AND gate for carry

---

## The Full Adder

A half adder is not enough for multi-bit addition because real addition also includes a carry coming in from the previous bit position.

A **full adder** takes three inputs:

- bit A
- bit B
- carry-in

and produces:

- sum
- carry-out

You can build a full adder from smaller gate combinations, often by combining half-adders plus extra logic.

---

## Why Carry Chains Matter

To add larger binary numbers, you line up one full adder per bit position.

```
MULTI-BIT ADDITION IDEA

  bit 0 adder -> carry -> bit 1 adder -> carry -> bit 2 adder -> ...
```

This is called a **ripple-carry adder** because the carry can ripple from lower bits to higher bits.

That works, but it also creates delay because higher bits may need to wait for lower-bit carries.

Already you can see hardware tradeoffs forming:

- simple design
- but slower propagation

---

## Logic Composition Becomes Arithmetic

This is a big mental unlock.

Addition is not “special math hardware” in some mysterious sense. It is a structured combination of simple logical relationships.

That means arithmetic emerges from the same gate primitives we already saw.

Once you accept that, higher hardware structures become more believable.

---

## Why Developers Should Care

Adders explain:

- why bitwise logic and arithmetic are deeply connected
- why carries matter in integer arithmetic
- why wider arithmetic hardware is built from repeated small units
- why hardware performance depends on propagation delay, not only on abstract correctness

This is the first place many learners really feel the magic disappear. Math turns out to be wiring.

---

## Common Misunderstandings

### “Addition is too advanced to come from gates”

No. Even addition emerges from simple logic composition.

### “A half adder is enough for real binary addition”

Not for multi-bit addition, because you need incoming carry handling.

### “Carry is just a software idea” 

No. Carry is a real hardware signal in arithmetic circuits.

---

## Hands-On Exercise

Build a half adder truth table and then identify its gates.

1. Write the four input combinations for A and B.
2. Fill in sum and carry.
3. Match sum to XOR and carry to AND.
4. If using a simulator, wire the half adder and test all four cases.

---

## Recap

- One-bit addition requires both a sum and sometimes a carry.
- A half adder can be built from XOR and AND.
- A full adder handles an incoming carry as well.
- Multi-bit addition chains adders together.
- Arithmetic emerges from gate composition, not from a separate magical principle.

Next, we bundle arithmetic and logical operations into a reusable hardware block: the arithmetic logic unit.