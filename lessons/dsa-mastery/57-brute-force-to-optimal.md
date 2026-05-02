# Lesson 57: The Brute-Force-to-Optimal Methodology

> **Analogy**: Climbing a mountain in fog is easier when you first find
> any trail and then improve your route, instead of trying to leap
> directly to the summit. Problem solving works the same way. Start with
> something correct, then use the structure of that solution to discover
> the optimization.

---

## Why This Matters

Many candidates treat brute force as failure.
That is backward.

Brute force is often the fastest path to the optimized solution because
it exposes:

- repeated work
- missing invariants
- the exact source of the time explosion

This lesson gives you a repeatable methodology for moving from naive to
efficient.

---

## The Core Pipeline

```
  understand prompt
       |
       v
  write a correct brute-force solution
       |
       v
  measure the bottleneck precisely
       |
       v
  replace repeated work with structure
       |
       v
  prove the optimized invariant
```

The key phrase is “replace repeated work with structure.”

---

## Upgrade Pattern 1: Nested Loops -> Hash Map

### Example: Two Sum

Brute force checks every pair.

```python
def two_sum_bruteforce(values: list[int], target: int) -> tuple[int, int] | None:
    for left in range(len(values)):
        for right in range(left + 1, len(values)):
            if values[left] + values[right] == target:
                return (left, right)
    return None
```

### Bottleneck

Repeatedly scanning for the complement.

### Upgrade

Store seen values in a hash map so complement lookup becomes constant
time on average.

```python
def two_sum(values: list[int], target: int) -> tuple[int, int] | None:
    seen: dict[int, int] = {}
    for index, value in enumerate(values):
        need = target - value
        if need in seen:
            return (seen[need], index)
        seen[value] = index
    return None
```

### Transformation summary

```
  repeated search for partner -> direct lookup by complement
```

---

## Upgrade Pattern 2: Recomputed Range Sums -> Prefix Sums

### Example: Subarray Sum Query

Suppose you need many range sums.

Brute force recomputes each range from scratch.

### Bottleneck

Repeated aggregation over overlapping intervals.

### Upgrade

Precompute cumulative sums once.

If:

$$
prefix[i] = a_0 + a_1 + \cdots + a_i
$$

then:

$$
sum(l, r) = prefix[r] - prefix[l - 1]
$$

### Transformation summary

```
  repeated interval accumulation -> one precompute + O(1) queries
```

---

## Upgrade Pattern 3: Enumerate All Windows -> Sliding Window

### Example: Longest Substring Without Repeating Characters

Brute force checks every substring and tests uniqueness.

### Bottleneck

Adjacent candidate windows overlap heavily, but brute force throws away
that overlap.

### Upgrade

Maintain one moving window and a data structure representing which
characters are currently inside it.

The optimized insight is not “use two pointers.”
It is:

> adjacent windows share almost all of their work

That is the correct reason sliding window works.

---

## Upgrade Pattern 4: Repeated Recursive States -> Dynamic Programming

### Example: Climbing Stairs

Brute-force recursion repeatedly solves the same smaller stair counts.

### Bottleneck

Overlapping subproblems.

### Upgrade

Memoize or tabulate states so each subproblem is solved once.

### Transformation summary

```
  recursion tree with repeats -> state cache
```

---

## Worked Example 1: Best Time To Buy And Sell Stock

### Brute force

Try every buy day and every sell day after it.

$$
O(n^2)
$$

### Bottleneck

For each sell day, brute force re-searches all earlier buy days.

### Key observation

You do not need all earlier prices. You only need the minimum price seen
so far.

### Upgrade

Maintain:

- `min_price_so_far`
- `best_profit_so_far`

#### TypeScript

```typescript
function maxProfit(prices: number[]): number {
  let minPrice = Number.POSITIVE_INFINITY;
  let best = 0;

  for (const price of prices) {
    minPrice = Math.min(minPrice, price);
    best = Math.max(best, price - minPrice);
  }

  return best;
}
```

### Real lesson

The optimized algorithm came from asking:

> What summary of the past do I really need?

That is one of the most important optimization questions in the track.

---

## Worked Example 2: Product Of Array Except Self

### Brute force

For each position, multiply every other element.

$$
O(n^2)
$$

### Bottleneck

The same prefix and suffix products are recomputed repeatedly.

### Upgrade

Precompute prefix and suffix contributions.

#### Python

```python
def product_except_self(values: list[int]) -> list[int]:
    n = len(values)
    result = [1] * n

    prefix = 1
    for index in range(n):
        result[index] = prefix
        prefix *= values[index]

    suffix = 1
    for index in range(n - 1, -1, -1):
        result[index] *= suffix
        suffix *= values[index]

    return result
```

### Real lesson

Many optimizations are really about factoring shared work into forward
and backward summaries.

---

## Worked Example 3: Koko Eating Bananas

### Brute force

Try all possible eating speeds and simulate each one.

### Bottleneck

The answer space is large, but the feasibility condition is monotonic:

- if speed `k` works, then any larger speed also works

### Upgrade

Binary search on the answer.

### Real lesson

This is a critical “harder than it looks” pattern.
The array itself is not sorted, but the answer space is ordered by
feasibility.

That is what makes binary search legal.

---

## The Optimization Questions You Should Always Ask

After writing brute force, ask:

1. What work am I repeating?
2. What summary of the past or future would avoid that repetition?
3. Is the state small enough to cache?
4. Is there monotonicity I can search over?
5. Is the problem really about ranges, prefixes, intervals, or graph
   connectivity instead of the surface story?

Those questions generate optimizations much more reliably than trying to
memorize 500 problems.

---

## Common Mistakes

- jumping to a pattern before locating the bottleneck
- optimizing the wrong part of the solution
- using DP when a greedy or running-summary invariant is enough
- using binary search without proving monotonicity
- using sliding window when the invariant is not locally maintainable

---

## Exercises

1. Why is brute force useful even when it is obviously too slow?
2. What kind of repeated work suggests prefix sums?
3. What kind of repeated work suggests DP?
4. Why must binary search on the answer have a monotonic feasibility
   function?
5. In the stock-profit example, why is the minimum-so-far summary enough?

---

## Key Takeaways

- Brute force is the first draft of the optimal algorithm.
- Optimization comes from identifying repeated work precisely.
- Hash maps, prefix sums, sliding windows, DP, and binary search are all
  specific upgrades for specific bottlenecks.
- The right summary of the past or future often collapses a slower
  algorithm into a faster one.
- The best problem solvers optimize systematically, not by guessing.

The next lesson catalogs advanced patterns that show up in harder
problems once the basics are no longer enough.

---

**Previous**: [Lesson 56 — Recognizing Common LeetCode Patterns](./56-common-patterns.md)
**Next**: [Lesson 58 — Advanced LeetCode Patterns](./58-advanced-patterns.md)