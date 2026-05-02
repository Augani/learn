# Lesson 55: Problem-Solving Methodology

> **Analogy**: Solving a difficult programming problem is like detective
> work. Strong problem solvers do not rush to arrest the first suspect.
> They gather clues, reconstruct the timeline, eliminate bad theories,
> and only then commit to an explanation. Algorithmic problem solving is
> the same: understand first, model second, optimize third, code last.

---

## Why This Matters

Many people do not struggle with LeetCode because they lack syntax.
They struggle because they start coding before they understand the
problem.

This lesson gives you a deliberate process:

1. understand the prompt precisely
2. identify constraints and complexity targets
3. generate examples and edge cases
4. derive a brute-force solution
5. locate the bottleneck
6. upgrade the approach
7. code and verify carefully

That process matters more than any one pattern.

---

## Step 1: Understand The Problem Precisely

Before thinking about algorithms, answer these questions:

- What exactly is the input?
- What exactly must be returned?
- Is the answer unique?
- Are duplicates allowed?
- Are negative numbers possible?
- Does order matter?
- Is this optimization, counting, existence, construction, or traversal?

### Common failure mode

People read a familiar-looking prompt and silently substitute a different
problem they already know.

That is one of the fastest ways to fail medium and hard questions.

### Example

If a problem says “return the length of the longest substring,” that is
not the same as “return the substring itself.”

That difference changes both state and implementation.

---

## Step 2: Translate Constraints Into Complexity Targets

Constraints are not decoration. They are the strongest clue in the whole
prompt.

### Quick mental table

```
  INPUT SIZE                    TYPICAL TARGET

  n <= 20                       exponential / bitmask may be okay
  n <= 10^3                     O(n^2) may be okay
  n <= 10^5                     usually O(n log n) or O(n)
  grid up to 200 x 200          BFS/DFS often okay
  many range queries            preprocessing is likely needed
```

### Why this matters

Once you know the target runtime, you can reject bad approaches early.

If `n = 100000`, then a quadratic idea is almost certainly dead.

This saves enormous time in interviews.

---

## Step 3: Build Small Concrete Examples

Do not skip examples, especially if the prompt feels abstract.

Examples help you discover:

- hidden invariants
- edge cases
- whether order matters
- what the state actually needs to remember

### Example habit

If the prompt involves intervals, draw intervals.
If it involves a tree, draw a tree.
If it involves state transitions, simulate them manually.

### Why examples matter

Examples are where many patterns reveal themselves:

- sliding window invariants
- BFS layers
- prefix-sum transformations
- DP states

---

## Step 4: Write The Brute-Force Version First

The brute-force solution is not a waste of time.
It is the map that tells you what the optimized solution must improve.

### Ask these questions

- What am I recomputing?
- What nested loop is too expensive?
- What state am I scanning repeatedly?
- Which part of the solution is causing the blow-up?

### Example

If you check every subarray, you may discover that the repeated work is:

- summing ranges again and again
- checking the same characters repeatedly
- re-searching for a property that could be maintained incrementally

That observation often leads directly to prefix sums, sliding windows, or
hash-based state tracking.

---

## Step 5: Identify The Bottleneck

This is the transition point from “I have a solution” to “I have a good
solution.”

### Common bottleneck categories

- repeated membership tests -> hash set or hash map
- repeated range sums -> prefix sums
- repeated minimum/maximum in a moving window -> monotonic deque
- repeated revisits of the same recursive state -> DP / memoization
- repeated full scans over ordered data -> binary search or two pointers

### ASCII optimization flow

```
  understand prompt
         |
         v
    brute force works
         |
         v
   find repeated work
         |
         v
  choose data structure / pattern
         |
         v
   optimized solution
```

---

## Step 6: Choose The Right Upgrade

Once you know the bottleneck, you do not need magic. You need the right
pattern.

### Upgrade examples

```
  NESTED LOOPS OVER SUBARRAYS      -> prefix sums / sliding window
  REPEATED LOOKUP                  -> hash map / hash set
  ORDERED SEARCH SPACE             -> binary search
  SAME RECURSIVE STATE REPEATED    -> DP
  CONNECTIVITY OVER NODES          -> BFS / DFS / DSU
  INTERVAL OVERLAP                 -> sorting / sweep line / heap
```

The key is not memorizing the table. It is learning to see when a prompt
matches one of these recurring upgrade paths.

---

## Step 7: Code Last, Verify Lasting Invariants

Once the idea is clear, coding becomes transcription of reasoning.

While coding, keep one eye on the invariant.

Examples:

- sliding window: is the window still valid?
- BFS: does the queue represent the current frontier?
- DP: does `dp[state]` still mean exactly what I said it means?
- heap: does the top element truly represent the best current candidate?

### Final checks before submission

- empty input
- single element
- duplicates
- all equal values
- already sorted / reverse sorted
- minimal and maximal constraints

---

## A Full Worked Mini Example

### Problem shape

“Find the length of the longest subarray with sum at most `k`” is not a
generic template you should guess blindly.

### Methodology walk

1. Understand:
   Are numbers non-negative or can they be negative?
2. Constraints:
   Is quadratic too slow?
3. Brute force:
   Check all subarrays.
4. Bottleneck:
   Too many repeated range sums.
5. Upgrade:
   If values are non-negative, a sliding window may work because the sum
   changes monotonically as the window expands or shrinks.

### Lesson

The correct pattern depends on properties like non-negativity, not only
on the fact that it is an array problem.

---

## Common Mistakes In Problem Solving

- coding before clarifying the problem
- ignoring constraints
- memorizing patterns without checking assumptions
- skipping the brute-force formulation
- choosing a technique without identifying the bottleneck
- failing to define the DP state or window invariant precisely

These are methodology failures, not knowledge failures.

---

## Exercises

1. Why are constraints often the strongest clue in a problem statement?
2. Why should you derive a brute-force solution even when you know it is
   too slow?
3. What is the difference between a pattern and an invariant?
4. Why can two array problems require completely different techniques?
5. What should you verify before writing the first line of code?

---

## Key Takeaways

- Strong problem solving is a process, not a flash of inspiration.
- Constraints tell you what complexity is even worth considering.
- Brute force is valuable because it reveals the bottleneck.
- Patterns are upgrades to specific bottlenecks, not random guesses.
- Coding should happen after the reasoning is stable, not before.

The next lesson catalogs the common patterns that appear again and again
in interview problems.

---

**Previous**: [Lesson 54 — Amortized and Probabilistic Analysis](./54-amortized-and-probabilistic.md)
**Next**: [Lesson 56 — Recognizing Common LeetCode Patterns](./56-common-patterns.md)