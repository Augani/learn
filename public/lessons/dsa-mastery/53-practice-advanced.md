# Lesson 53: Practice Problems — Advanced Topics

> **Analogy**: Early in a course, problems usually announce their
> technique. A hash-table problem looks like a hash-table problem. An
> advanced problem is more like a locked room mystery: the important part
> is not seeing the furniture, but noticing the hidden mechanism. This
> lesson is about recognizing those hidden mechanisms quickly.

---

## Why This Matters

By the time you reach advanced practice, difficulty is less about syntax
and more about misclassification.

Strong candidates usually fail advanced problems for one of three
reasons:

- they use the wrong abstraction entirely
- they identify the right abstraction too late
- they find the technique but cannot justify why it works

This lesson is designed to strengthen all three failure points.

We will use the required practice distribution:

- 3 easy problems
- 3 medium problems
- 2 hard problems

For each one, the goal is not just “know the answer.” The goal is to
train the recognition step that turns panic into structure.

---

## How To Read Advanced Practice Problems

Before diving into the set, use this quick checklist:

1. Is the state naturally a subset? Think bitmask.
2. Is cancellation or parity hiding in the prompt? Think XOR.
3. Is the input streaming or probabilistic? Think sampling or expected
   analysis.
4. Are coordinates or boundaries doing the real work? Think geometry or
   sweep line.
5. Does the “exact” solution feel combinatorial and explosive? Suspect
   NP-hardness or bounded-state DP.
6. Is wall-clock performance dominated by memory layout rather than pure
   operation count? Think cache-aware design.

That checklist is your bridge from intermediate DSA to advanced DSA.

---

## Easy Problems

---

### Problem 1: Single Number

**Pattern:** XOR cancellation

### Prompt

Every element appears twice except one. Find the unique element.

### Brute-force instinct

Count frequencies with a hash map.

That works, but it misses the structure.

### Better observation

XOR has the exact cancellation law you want:

$$
a \oplus a = 0, \qquad a \oplus 0 = a
$$

So duplicates erase themselves.

### Trace

```
  values = [4, 1, 2, 1, 2]

  result = 0
  result ^= 4 -> 4
  result ^= 1 -> 5
  result ^= 2 -> 7
  result ^= 1 -> 6
  result ^= 2 -> 4
```

The survivor is the answer.

#### Python

```python
def single_number(values: list[int]) -> int:
    result = 0
    for value in values:
        result ^= value
    return result
```

### Why this problem matters

It trains a deep advanced habit:

> Sometimes an algebraic invariant replaces auxiliary data structures.

---

### Problem 2: Reverse Bits

**Pattern:** bit extraction and reconstruction

### Prompt

Reverse the bits of a 32-bit unsigned integer.

### Brute-force instinct

Convert to a string, reverse the characters, convert back.

That is acceptable for understanding, but the real point is bit-level
state manipulation.

### Better framing

Read the least significant bit of the input and append it to the left of
the output as the output shifts.

```
  input bits  -> peel rightmost bit repeatedly
  output bits -> shift left and append peeled bit
```

#### TypeScript

```typescript
function reverseBits(value: number): number {
  let result = 0;

  for (let bit = 0; bit < 32; bit += 1) {
    result = (result << 1) | (value & 1);
    value >>>= 1;
  }

  return result >>> 0;
}
```

### Recognition signal

When the prompt explicitly asks about machine-word structure rather than
integer meaning, think bitwise operations first.

---

### Problem 3: Hamming Distance

**Pattern:** XOR + popcount

### Prompt

Find how many bit positions differ between two integers.

### Insight

XOR marks exactly the differing positions.
Then count the set bits.

```
  x = 101110
  y = 100100
  x ^ y = 001010
  answer = 2
```

#### Rust

```rust
fn hamming_distance(left: u32, right: u32) -> u32 {
    let mut diff = left ^ right;
    let mut count = 0;

    while diff != 0 {
        diff &= diff - 1;
        count += 1;
    }

    count
}
```

### Recognition signal

When a problem asks “how many bits differ,” you should immediately think:

- XOR isolates the difference
- popcount measures it

---

## Medium Problems

---

### Problem 4: Subsets

**Pattern:** bitmask enumeration

### Prompt

Return all subsets of an array.

### Brute-force instinct

Use backtracking.

That is fine, but this problem is equally valuable as a bitmask lesson.

### Better framing

An array of length `n` has `2^n` subsets. A mask from `0` to `2^n - 1`
encodes which elements are included.

For `nums = [a, b, c]`:

```
  000 -> {}
  001 -> {a}
  010 -> {b}
  011 -> {a, b}
  100 -> {c}
  101 -> {a, c}
  110 -> {b, c}
  111 -> {a, b, c}
```

#### Python

```python
def subsets(values: list[int]) -> list[list[int]]:
    result: list[list[int]] = []
    n = len(values)

    for mask in range(1 << n):
        subset: list[int] = []
        for bit in range(n):
            if mask & (1 << bit):
                subset.append(values[bit])
        result.append(subset)

    return result
```

### Why this is an advanced stepping stone

This is the cleanest gateway to bitmask DP. Once you understand subsets
as bit patterns, `dp[mask]` stops feeling mysterious.

---

### Problem 5: Random Pick With Weight

**Pattern:** prefix sums + random sampling

### Prompt

Pick an index with probability proportional to its weight.

### Brute-force instinct

Materialize the weighted population explicitly:

```
weights [1, 3, 2] -> [0, 1, 1, 1, 2, 2]
```

That works only when weights are tiny.

### Better framing

Convert weights to prefix sums and sample a random point in the cumulative
range.

For weights `[1, 3, 2]`:

```
  prefix = [1, 4, 6]

  sampled value in [1, 6]
  1     -> index 0
  2..4  -> index 1
  5..6  -> index 2
```

### Why binary search appears

Once the prefix array partitions the random range, binary search finds
the first prefix sum at least as large as the sampled value.

#### TypeScript

```typescript
class WeightedPicker {
  private readonly prefix: number[];
  private readonly total: number;

  constructor(weights: number[]) {
    this.prefix = [];
    let running = 0;

    for (const weight of weights) {
      running += weight;
      this.prefix.push(running);
    }

    this.total = running;
  }

  pickIndex(): number {
    const target = Math.floor(Math.random() * this.total) + 1;
    let left = 0;
    let right = this.prefix.length - 1;

    while (left < right) {
      const middle = left + Math.floor((right - left) / 2);
      if (this.prefix[middle] >= target) {
        right = middle;
      } else {
        left = middle + 1;
      }
    }

    return left;
  }
}
```

### Recognition signal

If the problem says “sample proportionally,” think cumulative intervals,
not repeated values.

---

### Problem 6: Maximum XOR Of Two Numbers In An Array

**Pattern:** greedy bit reasoning / binary trie insight

### Prompt

Find the maximum XOR value between any two numbers.

### Brute-force instinct

Check every pair in $O(n^2)$.

### Better framing

XOR is maximized when high-order bits differ. So we want to decide the
answer from the most significant bit downward.

One elegant strategy uses prefixes of numbers and greedily tests whether
the current candidate bit can be `1`.

### High-level idea

1. build the answer bit by bit from left to right
2. at each step, assume the next bit can be `1`
3. check whether two prefixes exist that make that assumption possible

This is a beautiful example of reasoning about the answer space instead
of enumerating pairs.

---

## Hard Problems

---

### Problem 7: Maximum Students Taking Exam

**Pattern:** bitmask DP with row-by-row state transitions

### Why this is hard

The difficulty is not just that the search space is big. The difficulty
is that constraints are local but interact across rows.

Each row state must satisfy:

- no student sits in a broken seat
- no adjacent students sit in the same row
- no cheating diagonally with the previous row

### State design

Let:

$$
dp[row][mask]
$$

mean the maximum students seated up to `row`, where `mask` describes the
placement on that row.

### Why bitmasks are natural

Each seat is binary:

- student sits there
- student does not

So a row configuration is literally a bit pattern.

### Transition idea

For each valid `current_mask`, try every valid `previous_mask` that does
not conflict diagonally.

```
  previous row:  0 1 0 1
  current row:   1 0 0 0

  invalid if a student sees upper-left or upper-right
```

### Why this belongs in advanced practice

This is one of the most important advanced-recognition moments in the
entire track:

> small width + combinatorial local constraints = bitmask DP is likely

---

### Problem 8: Count Of Range Sum

**Pattern:** prefix sums + divide and conquer / ordered counting

### Problem intuition

We want the number of subarray sums in a target interval `[lower, upper]`.

Brute force checks all subarrays, which is quadratic.

### Key transformation

If `prefix[j] - prefix[i]` is in `[lower, upper]`, then for each `j` we
need to count earlier prefix sums in:

$$
[prefix[j] - upper,\; prefix[j] - lower]
$$

That turns a subarray-sum problem into a counting-over-ordered-prefixes
problem.

### Why the solution is advanced

The data structure or divide-and-conquer layer is not the first idea you
see. The real skill is spotting the prefix-sum transformation first.

Once you make that transformation, the problem becomes one of ordered
counting, and merge-sort-style counting or balanced structures become
natural.

---

## Pattern Identification Table

```
  PROBLEM                              PRIMARY SIGNAL

  Single number                        duplicates cancel algebraically
  Reverse bits                         machine-word manipulation
  Hamming distance                     differing bits -> XOR
  Subsets                              subset state is binary
  Random pick with weight              probability as cumulative intervals
  Maximum XOR of two numbers           optimize high bits first
  Maximum students taking exam         small-width constrained states
  Count of range sum                   prefix transformation + ordered counting
```

---

## Brute Force To Better Framing

- `single number`: counting becomes algebraic cancellation.
- `reverse bits`: string manipulation becomes direct bit movement.
- `hamming distance`: explicit comparison becomes XOR plus popcount.
- `subsets`: recursion becomes direct state enumeration.
- `random pick with weight`: repeated-value expansion becomes prefix-sum
  sampling.
- `maximum XOR`: all pairs becomes greedy bit reasoning.
- `maximum students`: exponential seat placement becomes row-state DP.
- `count of range sum`: all subarrays becomes ordered prefix counting.

That progression is the actual value of advanced practice.

---

## What Makes A Problem Feel “Advanced”?

Usually one of these:

- the natural state is non-obvious
- the surface wording hides the real structure
- the right abstraction is more important than the implementation
- complexity theory or probability changes how you think about the goal

If you feel stuck, ask not “which code trick am I missing?” but:

> What is the correct model of the problem?

That question fixes more advanced problems than any memorized pattern
list.

---

## Exercises

1. Why is XOR the right abstraction for `single number` but not for most
   duplicate-detection problems?
2. Why does `subsets` serve as a gateway to bitmask DP?
3. Why is weighted random picking naturally a prefix-sum problem?
4. What clue in `maximum students taking exam` should make you consider
   row-state masks?
5. Why is `count of range sum` really a transformed prefix problem rather
   than a direct subarray problem?

---

## Key Takeaways

- Advanced practice is primarily about representation choice.
- XOR, bitmasks, prefix sums, and ordered counting repeatedly turn hard
  prompts into structured problems.
- Many advanced questions are solved by transforming the problem before
  optimizing it.
- If the state space is small but combinatorial, bitmask techniques are
  often the right lens.
- The strongest interview skill at this level is rapid pattern
  recognition under noisy wording.

The next lesson closes the phase by studying two deeper ways of talking
about algorithm cost: amortized analysis and probabilistic analysis.

---

**Previous**: [Lesson 52 — Cache-Friendly Algorithms](./52-cache-friendly-algorithms.md)
**Next**: [Lesson 54 — Amortized and Probabilistic Analysis](./54-amortized-and-probabilistic.md)