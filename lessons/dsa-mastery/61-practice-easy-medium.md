# Lesson 61: Practice Problems — Easy and Medium Patterns

> This lesson is about disciplined repetition. The goal is not only to
> solve these problems. The goal is to sharpen the speed with which you
> map a prompt to a pattern, justify the choice, and rule out slower
> alternatives.

---

## Why This Matters

Easy and medium problems are where your recognition system gets trained.
If your pattern selection is slow here, hard problems will feel chaotic.

This lesson includes:

- 4 easy problems
- 4 medium problems

Each problem is framed around the signal that should trigger the pattern.

---

## Easy Problems

---

### Problem 1: Maximum Average Subarray I

**Pattern:** sliding window

### Why this pattern fits

The subarray length is fixed, so adjacent candidate windows overlap by
all but two elements.

### Brute-force instinct

Compute every length-`k` sum from scratch.

### Better framing

Carry the window sum forward by:

- removing the outgoing element
- adding the incoming element

---

### Problem 2: Valid Palindrome

**Pattern:** two pointers

### Why this pattern fits

You compare corresponding characters from both ends while skipping
non-alphanumeric characters.

### Key signal

The prompt asks whether a symmetric property holds across the whole
string.

That should make you think inward pointers immediately.

---

### Problem 3: Running Sum Of 1D Array

**Pattern:** prefix sums

### Why this pattern fits

The prompt is directly asking for cumulative totals.

### Important habit

Treat this as more than a trivial task. It is the most basic form of a
pattern that later powers subarray sum problems and difference arrays.

---

### Problem 4: Next Greater Element I

**Pattern:** monotonic stack

### Why this pattern fits

The phrase “next greater” is one of the loudest monotonic-stack signals
in the entire problem ecosystem.

### Brute-force instinct

For each element, scan to the right until you find a larger one.

### Better framing

Maintain a decreasing stack so each element resolves the waiting smaller
elements behind it.

---

## Medium Problems

---

### Problem 5: Koko Eating Bananas

**Pattern:** binary search on answer

### Why this pattern fits

If a speed `k` works, every larger speed works too.
That monotonic feasibility condition is the whole reason binary search is
legal.

### Common trap

People see an array and search for an array-based pattern.
The real search space is the answer space.

---

### Problem 6: Merge Intervals

**Pattern:** interval sorting and merging

### Why this pattern fits

The only intervals that can interact after sorting by start point are
adjacent ones in the sorted order.

### Key invariant

Maintain one current merged interval and extend or flush it.

---

### Problem 7: Best Time To Buy And Sell Stock With Cooldown

**Pattern:** state-machine DP

### Why this pattern fits

Your choices depend on whether you are:

- holding stock
- free to buy
- cooling down after selling

That “mode” language is the key state-machine DP signal.

---

### Problem 8: Shortest Path In Binary Matrix

**Pattern:** BFS on grid

### Why this pattern fits

The prompt asks for the minimum number of steps in an unweighted grid.
That is textbook BFS.

### Common trap

Some candidates reach for DFS because the input is a matrix.
DFS explores reachability well, but not shortest unweighted paths.

---

## Pattern Identification Table

```
  PROBLEM                                 PATTERN

  Maximum average subarray                sliding window
  Valid palindrome                        two pointers
  Running sum                             prefix sums
  Next greater element                    monotonic stack
  Koko eating bananas                     binary search on answer
  Merge intervals                         interval sorting/merging
  Stock with cooldown                     state-machine DP
  Shortest path in binary matrix          BFS on grid
```

---

## Brute Force To Better Thinking

- fixed-size windows -> carry window totals incrementally
- symmetric scans -> move inward from both sides
- repeated cumulative additions -> keep running prefix state
- repeated “next greater” scans -> store unresolved candidates in order
- answer optimization with monotonic feasibility -> binary search on
  answer
- interval overlap -> sort then merge locally
- action-history dependence -> add DP modes
- shortest steps in unweighted graph -> BFS layers

---

## Exercises

1. Why is fixed window size such a strong sliding-window clue?
2. Why does “next greater element” almost immediately suggest a monotonic
   stack?
3. What makes `Koko Eating Bananas` a binary-search-on-answer problem?
4. Why is stock with cooldown better modeled as modes than as raw greedy
   choices?
5. Why is BFS the right tool for shortest path in an unweighted grid?

---

## Key Takeaways

- Easy and medium problems are where pattern recognition should become
  automatic.
- The strongest clue is usually the bottleneck or invariant, not the data
  type alone.
- Binary search, monotonic stack, BFS, and DP all solve very different
  structural problems.
- Repeated exposure matters most when you consciously name the signal
  that triggered the pattern.

The next lesson focuses on the medium-to-hard transition and the traps
that make those problems feel qualitatively harder.

---

**Previous**: [Lesson 60 — Hard Problem Strategies](./60-hard-problem-strategies.md)
**Next**: [Lesson 62 — Practice Problems — Medium to Hard Transition](./62-practice-medium-hard.md)