# Lesson 48: Randomized Algorithms

> **Analogy**: Shuffling a deck before dealing prevents someone from
> arranging the cards to exploit your strategy. Randomized algorithms do
> something similar: they use randomness to avoid structured worst-case
> inputs or to make strong guarantees in expectation.

---

## Why This Matters

Randomization appears in:

- randomized quicksort
- skip lists
- reservoir sampling
- hashing and load balancing
- approximation and streaming algorithms

Its purpose is often not magic speed. It is robustness against bad
input structure.

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
   with a fixed pivot rule?
2. What is the difference between Monte Carlo and Las Vegas algorithms?
3. How does a skip list use randomness to simulate balancing?
4. Why does reservoir sampling work when the stream length is unknown?
5. Give an example where randomness helps avoid adversarial structure.

---

## Key Takeaways

- Randomization often improves robustness more than raw asymptotic
  complexity.
- Monte Carlo and Las Vegas algorithms differ in whether correctness or
  runtime is random.
- Randomized quicksort, skip lists, and reservoir sampling are classic
  patterns worth knowing deeply.
- Expected analysis is the right tool for many randomized algorithms.
- Randomness can neutralize predictable worst-case inputs.

The next lesson moves to computational geometry, where spatial structure
drives the algorithms.

---

**Previous**: [Lesson 47 — Bit Manipulation](./47-bit-manipulation.md)
**Next**: [Lesson 49 — Computational Geometry](./49-computational-geometry.md)