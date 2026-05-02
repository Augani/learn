# Lesson 48: Randomized Algorithms

> **Analogy**: Shuffling a deck before dealing prevents someone from
> arranging the cards to exploit your strategy. Randomized algorithms do
> something similar: they use randomness to avoid structured worst-case
> inputs or to make strong guarantees in expectation.

---

## Why This Matters

Randomization is one of the most powerful and underappreciated tools in
algorithm design. Its purpose is often not raw speed — it is
**robustness against adversarial inputs** and **simplicity of analysis**.

Randomization appears in many practical systems:

- **Randomized quicksort**: picking pivots randomly defeats adversarial
  inputs that would make deterministic quicksort hit `O(n^2)` worst case
- **Skip lists**: probabilistic balancing replaces complex tree rotations
  with coin flips, yielding simpler code with expected logarithmic
  performance
- **Reservoir sampling**: selecting a random sample from a stream of
  unknown length in a single pass, essential for real-time analytics
- **Hashing and load balancing**: randomized hash functions spread keys
  evenly, preventing worst-case collision clusters
- **Approximation algorithms**: randomized rounding and sampling often
  yield provable approximations for NP-hard problems in polynomial time
- **Streaming algorithms**: when data is too large to store, random
  sketches (like Count-Min Sketch) estimate frequencies with small
  bounded error

Understanding the difference between Monte Carlo (fast, possibly wrong)
and Las Vegas (always correct, random runtime) algorithms is essential
for choosing the right tool in systems where correctness guarantees vary.

---

## Monte Carlo vs Las Vegas

Two major categories:

- **Monte Carlo**: always fast, may be wrong with small probability
- **Las Vegas**: always correct, running time is random

Randomized quicksort is Las Vegas-style: correct output, random runtime.
Probabilistic primality tests are classic Monte Carlo examples.

---

## Randomized Quicksort

### Why randomization helps

Deterministic quicksort can be attacked by adversarial input if the pivot
rule is predictable.

Randomly selecting the pivot breaks that structure.

### Expected recurrence

The exact split varies, but on average the partitions are balanced well
enough that runtime becomes:

$$
O(n \log n)
$$

even though worst-case partitions are still possible.

#### Python

```python
import random


def randomized_quicksort(values: list[int]) -> list[int]:
    if len(values) <= 1:
        return values

    pivot = random.choice(values)
    less = [value for value in values if value < pivot]
    equal = [value for value in values if value == pivot]
    greater = [value for value in values if value > pivot]
    return randomized_quicksort(less) + equal + randomized_quicksort(greater)
```

---

## Skip Lists

Skip lists are probabilistically balanced ordered structures.

### Idea

Each element may appear on multiple levels with decreasing probability.

```
  Level 3:  1 ----------- 9
  Level 2:  1 ----- 5 --- 9 --- 13
  Level 1:  1 - 3 - 5 - 7 - 9 - 13 - 15
  Level 0:  1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
```

Higher levels let you skip large ranges quickly.

Expected search, insert, delete:

$$
O(\log n)
$$

The balancing is randomized instead of rotation-based like AVL or
red-black trees.

---

## Reservoir Sampling

### Problem

Choose one item uniformly at random from a stream of unknown length.

### Algorithm

Keep the first item.
When the `i`th item arrives, replace the stored item with probability
$1/i$.

#### TypeScript

```typescript
function reservoirSample(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  let choice = values[0];
  for (let index = 1; index < values.length; index += 1) {
    if (Math.floor(Math.random() * (index + 1)) === 0) {
      choice = values[index];
    }
  }

  return choice;
}
```

### Why it works

After processing `i` items, every item has equal probability `1/i` of
being stored.

This is a beautiful example of probabilistic invariants.

---

## Why Randomization Can Defeat Worst-Case Inputs

If an adversary knows your deterministic rule, it can often craft bad
inputs.

Randomization prevents the input from consistently steering the
algorithm into its worst structural behavior.

This is especially important in:

- pivot selection
- hashing
- probabilistic balancing

---

## Probabilistic Analysis Intuition

Randomized algorithms are usually analyzed in expectation.

That means we ask for:

$$
E[T(n)]
$$

instead of a strict worst-case time for every random outcome.

Expected-time guarantees are often strong enough in practice when bad
random outcomes are sufficiently unlikely.

---

## Exercises

1. Why is randomized quicksort more robust than deterministic quicksort
   with a fixed pivot rule? Construct a specific adversarial input that
   breaks deterministic quicksort.
2. What is the difference between Monte Carlo and Las Vegas algorithms?
   Give one example of each from this lesson.
3. How does a skip list use randomness to simulate balancing? Why does
   the expected height remain logarithmic?
4. Why does reservoir sampling work when the stream length is unknown?
   Prove by induction that after processing `i` items, each item has
   probability `1/i` of being stored.
5. Give an example where randomness helps avoid adversarial structure.
   How does hashing use this principle?
6. A Las Vegas algorithm always produces a correct answer but its
   runtime is a random variable. Why is expected runtime analysis the
   right tool rather than worst-case analysis?
7. What would go wrong if a skip list used a fixed height for every node
   instead of random heights?
8. In a distributed system, load balancing assigns requests to servers.
   Why might randomized assignment outperform round-robin under certain
   adversarial load patterns?

---

## Key Takeaways

- **Randomization** often improves robustness more than raw asymptotic
  complexity by defeating adversarial input structure.
- **Monte Carlo algorithms** are always fast but may be wrong with small
  probability. **Las Vegas algorithms** are always correct but have
  random runtime.
- **Randomized quicksort** picks random pivots to guarantee `O(n log n)`
  expected time regardless of input ordering.
- **Skip lists** use random tower heights to achieve expected
  `O(log n)` search/insert/delete with simpler code than balanced trees.
- **Reservoir sampling** selects a uniform random sample from a stream of
  unknown length in a single pass using a simple probability update rule.
- **Expected analysis** is the right tool for randomized algorithms
  because it averages over random choices, not worst-case inputs.
- **Randomness neutralizes predictable worst-case inputs** in hashing,
  load balancing, and randomized algorithms by making behavior
  independent of input structure.

The next lesson moves to computational geometry, where spatial structure
drives the algorithms.

---

**Previous**: [Lesson 47 — Bit Manipulation](./47-bit-manipulation.md)
**Next**: [Lesson 49 — Computational Geometry](./49-computational-geometry.md)