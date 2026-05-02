# Lesson 59: Solution Analysis and Optimization

> **Analogy**: A good engineer does not only build a bridge. They inspect
> where stress accumulates, which beams are redundant, and which design
> choices are carrying the load. A good algorithmist should inspect a
> solution the same way: where time is spent, where space is spent, where
> correctness could break, and where the next optimization opportunity is
> hiding.

---

## Why This Matters

A candidate can write a correct solution and still perform poorly if they
cannot explain:

- the time complexity
- the space complexity
- the real bottleneck
- the edge cases
- whether a better approach exists

This lesson is about turning “I coded something” into “I understand why
this solution is appropriate.”

---

## Step 1: Analyze The Dominant Work

Do not count syntax lines. Count the expensive structure.

### Questions to ask

- How many states, nodes, windows, or intervals exist?
- How many times can each element be pushed, popped, visited, or updated?
- Are there nested loops, and are they independent or amortized?
- Does recursion branch exponentially or reuse states?

### Example

Two nested loops do not always imply $O(n^2)$ if each element is removed
from a deque at most once.

This is why reasoning by syntax shape alone is dangerous.

---

## Step 2: Separate Time And Space Clearly

### Time complexity

How the number of operations grows with input size.

### Space complexity

How much extra memory beyond the input is required.

### Common mistake

People often say “space is $O(1)$” while ignoring recursion depth,
auxiliary arrays, heaps, maps, or queues.

### Reminder

If recursion depth can reach `n`, that stack usage is space.

---

## Step 3: Identify Redundant Work

Optimization almost always starts with the same question:

> What am I computing, checking, or storing more than once?

### Common redundancy patterns

- recomputing interval sums
- rescanning a prefix or suffix repeatedly
- recomputing the same recursive state
- checking all pairs when only a summary is needed
- exploring dominated candidates that can be removed monotonically

This is where the next optimization idea usually comes from.

---

## Step 4: Check Whether Precomputation Helps

Precomputation is useful when:

- the same query shape appears repeatedly
- the upfront cost can be reused many times

Examples:

- prefix sums
- suffix arrays or prefix-function structures
- sparse tables
- frequency tables
- graph preprocessing for repeated queries

### Tradeoff

You pay extra setup time or memory to reduce later query cost.

---

## Step 5: Verify Correctness With Invariants

Correctness arguments become much easier if you name the invariant.

Examples:

- sliding window invariant: window always satisfies property `P`
- BFS invariant: queue processes nodes in nondecreasing distance layers
- heap invariant: top is the best current candidate under the ordering
- DP invariant: `dp[state]` stores the optimal answer for exactly that
  state definition

If you cannot state the invariant, your reasoning is usually not stable
yet.

---

## Annotated Complexity Breakdown Example

Consider a standard sliding-window maximum solution with a monotonic
deque.

At first glance, there are nested loops:

```text
for each element:
  while deque tail is worse:
    pop tail
```

Some people incorrectly call this $O(n^2)$.

### Correct reasoning

Each element:

- enters the deque once
- leaves the deque at most once

So the total number of deque operations across the whole algorithm is
linear.

That makes the total runtime:

$$
O(n)
$$

This is a classic example of amortized counting.

---

## Memoization Opportunities

Whenever recursion revisits the same state, memoization should be on your
radar.

### Recognition questions

- What variables fully determine the future answer?
- Do different branches revisit the same combination of those variables?
- Is the state count small enough to cache?

### Common mistake

Caching too much state because the state was defined imprecisely.

DP quality depends heavily on state design.

---

## Precomputation Opportunities

Some problems do not need DP. They need a reusable summary.

### Examples

- prefix sums for repeated range totals
- sorted arrays plus binary search for repeated threshold queries
- precomputed neighbor maps for grid or graph transitions

Optimization is not only about faster asymptotics. It is often about the
right reusable summary.

---

## Common Complexity Analysis Mistakes

- counting nested loops without considering amortization
- ignoring sorting cost
- ignoring recursion stack space
- claiming binary search without proving monotonicity
- calling hash-map operations “always $O(1)$” instead of average-case
- failing to distinguish worst-case, amortized, and expected analysis

These mistakes matter because they signal shallow understanding.

---

## How To Present Analysis In Interviews

A clear analysis often sounds like this:

1. Define what each data structure stores.
2. State what each loop or recursion branch does.
3. Bound how many times each element can participate.
4. Summarize total time and total extra space.
5. Mention the key invariant or monotonicity that makes the method valid.

That is much stronger than saying “I think it is probably $O(n \log n)$.”

---

## Exercises

1. Why do nested loops not automatically imply quadratic time?
2. What should you check before claiming a solution is $O(1)$ space?
3. Why is naming the invariant helpful for correctness reasoning?
4. What kinds of problems suggest precomputation?
5. Why is “hash map is $O(1)$” an incomplete statement?

---

## Key Takeaways

- Solution analysis is about counting dominant work, not lines of code.
- Time and space must be analyzed separately and explicitly.
- Redundant work points directly to optimization opportunities.
- Invariants make both correctness and complexity explanations cleaner.
- Strong candidates can justify not only what works, but why it is the
  right cost tradeoff.

The next lesson focuses on how hard problems force you to combine
multiple paradigms instead of relying on one familiar pattern.

---

**Previous**: [Lesson 58 — Advanced LeetCode Patterns](./58-advanced-patterns.md)
**Next**: [Lesson 60 — Hard Problem Strategies](./60-hard-problem-strategies.md)