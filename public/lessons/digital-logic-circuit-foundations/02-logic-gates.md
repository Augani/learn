# Lesson 02: Logic Gates

> **The one thing to remember**: Logic gates are tiny decision-making circuits.
> They take one or more binary inputs and produce a binary output according to a simple rule.

---

## Start With Questions

Suppose you want a circuit to answer questions like:

- are both switches on?
- is at least one switch on?
- is this switch off?

Those questions correspond to logic gates.

Logic gates are the alphabet of digital hardware.

---

## AND Gate

The **AND** gate outputs `1` only if both inputs are `1`.

```
AND TRUTH TABLE

  A  B | OUT
  -----+----
  0  0 |  0
  0  1 |  0
  1  0 |  0
  1  1 |  1
```

Intuition: both conditions must be true.

---

## OR Gate

The **OR** gate outputs `1` if at least one input is `1`.

```
OR TRUTH TABLE

  A  B | OUT
  -----+----
  0  0 |  0
  0  1 |  1
  1  0 |  1
  1  1 |  1
```

Intuition: one or both conditions are true.

---

## NOT Gate

The **NOT** gate flips one input.

```
NOT TRUTH TABLE

  A | OUT
  --+----
  0 |  1
  1 |  0
```

Intuition: true becomes false, false becomes true.

---

## XOR Gate

The **XOR** gate outputs `1` when the inputs are different.

```
XOR TRUTH TABLE

  A  B | OUT
  -----+----
  0  0 |  0
  0  1 |  1
  1  0 |  1
  1  1 |  0
```

This gate is especially important for addition circuits because it behaves like “one or the other, but not both.”

---

## NAND Gate

The **NAND** gate means “NOT AND.”

It outputs `0` only when both inputs are `1`.

```
NAND TRUTH TABLE

  A  B | OUT
  -----+----
  0  0 |  1
  0  1 |  1
  1  0 |  1
  1  1 |  0
```

Why care so much about NAND?

Because NAND is **universal**.

That means you can build all the other basic gates from NAND combinations.

---

## Truth Tables Are the Language of Logic

A **truth table** lists every possible input combination and the resulting output.

This makes logic behavior precise.

Truth tables are extremely helpful because they let you reason about circuits without staring at voltages or transistor layouts.

For software developers, they are the perfect abstraction level.

---

## Gates Compose

The real power of gates is not in a single AND or OR gate. It is in composition.

You can wire gate outputs into other gates' inputs and build larger behaviors.

That is how we eventually get:

- adders
- comparators
- selectors
- memory elements
- full CPUs

This is the key pattern of the whole track:

> Simple components become powerful through composition.

---

## Why Developers Should Care

Logic gates explain:

- why boolean logic maps so naturally onto hardware
- why bitwise operations have real physical analogs
- why truth tables are a direct bridge between abstract logic and circuits

This is the layer where “if,” “and,” and “or” stop being only language keywords and start being actual machine behavior.

---

## Common Misunderstandings

### “A gate understands meaning like a human rule”

No. It is just a circuit whose output follows a consistent binary relationship.

### “Truth tables are only a teaching trick”

No. They are a real way of specifying logic behavior clearly.

### “NAND being universal is just trivia” 

No. It shows that a surprisingly small primitive can build all digital logic.

---

## Hands-On Exercise

Draw truth tables for AND, OR, NOT, XOR, and NAND.

1. Fill in every input combination.
2. Identify which gates output `1` in the fewest cases and which in the most.
3. If you use a logic simulator, wire two switches into an XOR gate and watch how its output differs from OR.

---

## Recap

- Logic gates map binary inputs to binary outputs through fixed rules.
- AND, OR, NOT, XOR, and NAND are foundational gates.
- Truth tables make gate behavior precise.
- NAND is universal, meaning larger logic can be built from it alone.
- Complex digital systems emerge by composing gates.

Next, we use those gates to build something more impressive: arithmetic.