# Lesson 47: Bit Manipulation

> **Analogy**: Think of each bit as a light switch: on or off. Bit
> manipulation is the art of flipping, checking, combining, and masking
> those switches directly. Many operations that look like loops at the
> integer level become constant-time logic at the bit level.

---

## Why This Matters

Bit manipulation matters because it lets you operate on data at the
lowest level of abstraction — individual bits instead of whole values.
This unlocks:

- **Compact state representation**: a 32-bit integer can represent a
  subset of 32 items as a bitmask, replacing boolean arrays in DP
- **Fast constant-time operations**: checking, setting, clearing, and
  toggling bits are all single CPU instructions
- **Elegant parity and XOR tricks**: finding the unique element in a
  duplicate array, swapping variables without temporary storage,
  detecting odd counts
- **Bitmask DP and subset iteration**: iterating over all subsets of a
  set of size `n` in `O(2^n)` time with simple bitwise loops
- **Memory efficiency**: in high-performance systems, packing multiple
  boolean flags into a single integer reduces cache misses
- **Algorithmic speedups**: Brian Kernighan's bit counting runs in time
  proportional to set bits, not word size

This lesson covers the operators, tricks, and patterns that make bit
manipulation a practical tool, not just a theoretical curiosity.

---

## Binary Representation Refresher

```
  Decimal 13 = binary 1101

  bit positions:
  8 4 2 1
  1 1 0 1
```

Each bit represents whether a power of two is present.

---

## Core Operators

### AND `&`

Bit stays `1` only if both bits are `1`.

### OR `|`

Bit becomes `1` if either input bit is `1`.

### XOR `^`

Bit becomes `1` if the inputs differ.

### NOT `~`

Flips all bits.

### Shifts `<<` and `>>`

Left shift usually multiplies by powers of two.
Right shift usually divides by powers of two, for non-negative numbers.

### XOR truth table

```
  A B | A ^ B
  0 0 |   0
  0 1 |   1
  1 0 |   1
  1 1 |   0
```

---

## Common Bit Tricks

### Check whether the `k`th bit is set

#### Python

```python
def is_set(value: int, bit: int) -> bool:
    return ((value >> bit) & 1) == 1
```

### Set a bit

```python
def set_bit(value: int, bit: int) -> int:
    return value | (1 << bit)
```

### Clear a bit

```python
def clear_bit(value: int, bit: int) -> int:
    return value & ~(1 << bit)
```

### Toggle a bit

```python
def toggle_bit(value: int, bit: int) -> int:
    return value ^ (1 << bit)
```

### Remove the lowest set bit

```python
def drop_lowest_set_bit(value: int) -> int:
    return value & (value - 1)
```

This works because subtracting `1` flips the lowest set bit and all bits
to its right.

---

## Power Of Two Check

For positive `n`, `n` is a power of two iff it has exactly one set bit.

That means:

$$
n \& (n - 1) = 0
$$

#### TypeScript

```typescript
function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}
```

### Why this works

```
  8  = 1000
  7  = 0111
  8 & 7 = 0000

  10 = 1010
   9 = 1001
  10 & 9 = 1000 != 0
```

---

## Count Set Bits

### Brian Kernighan's trick

Repeatedly remove the lowest set bit.

#### Rust

```rust
fn popcount(mut value: u32) -> u32 {
    let mut count = 0;
    while value != 0 {
        value &= value - 1;
        count += 1;
    }
    count
}
```

This runs in time proportional to the number of set bits, not the word
size.

---

## XOR Properties

These are worth memorizing because they show up constantly.

```
  a ^ a = 0
  a ^ 0 = a
  XOR is commutative and associative
```

### Classic use: single number

If every number appears twice except one, XOR of all values gives the
unique value because duplicates cancel.

---

## Bitmasks As Sets

A bitmask can represent membership in a small set.

Example with items `{A, B, C, D}`:

```
  mask 0101 means {A, C}
```

This is useful for:

- subset iteration
- visited-state compression
- bitmask DP

### What if we used a boolean array instead of a bitmask?

A boolean array is more explicit, but a bitmask is often:

- more compact
- faster to copy/compare/hash
- easier to combine with bit operations

For very small state spaces, bitmasks are often the right abstraction.

---

## Exercises

1. Why does `n & (n - 1)` remove the lowest set bit?
2. Why does XOR cancel duplicate values?
3. How would you represent the set `{0, 2, 4}` as a bitmask?
4. Why can bitmasks be more efficient than boolean arrays for small sets?
5. Give a problem where bitmask DP would be natural.

---

## Key Takeaways

- Bit manipulation treats integers as structured binary state.
- Many useful operations become constant-time with masks and shifts.
- XOR has unusually strong algebraic properties and appears in many
  interview problems.
- Bitmasks compactly represent small subsets and states.
- Understanding bits often simplifies problems that look more complex at
  the array or integer level.

The next lesson explores randomized algorithms and why probabilistic
choices can defeat adversarial inputs.

---

**Previous**: [Lesson 46 — Practice Problems — Strings](./46-practice-strings.md)
**Next**: [Lesson 48 — Randomized Algorithms](./48-randomized-algorithms.md)