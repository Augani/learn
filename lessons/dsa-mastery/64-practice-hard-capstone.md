# Lesson 64: Capstone Assessment — Hard Problems

> This lesson is the final exam for the track. The goal is not only to
> know techniques in isolation, but to recognize them under pressure,
> avoid dead ends, and explain why the chosen model is the right one.

---

## How To Use This Capstone

Each problem includes:

- the main combined technique
- the common dead end
- a hint ladder
- the full-solution framing
- common mistakes

This set includes 8 hard problems spanning the whole track.

---

## Problem 1: Substring With Concatenation Of All Words

**Category:** hash table + sliding window

### Dead end

Generate every substring and compare multisets from scratch.

### Hints

1. All words have equal length.
2. That means valid matches align on word boundaries.
3. Try running windows separately for each offset modulo word length.

### Full-solution framing

Use a frequency map for the target words and slide a word-sized window in
chunks, maintaining current word counts.

### Common mistakes

- sliding character by character instead of by word length
- failing to reset correctly on invalid words
- forgetting duplicate words in the target multiset

---

## Problem 2: Binary Tree Cameras

**Category:** tree DP / greedy state classification

### Dead end

Treat each node independently and greedily place cameras too early.

### Hints

1. A node can be in one of a small number of coverage states.
2. Decisions at a parent depend on child coverage.
3. Postorder traversal is natural because children decide parent needs.

### Full-solution framing

Classify each node as:

- has camera
- covered
- needs camera

Process bottom-up and place a camera when a child needs one.

### Common mistakes

- forgetting to handle the root after traversal
- not separating “covered” from “has camera”

---

## Problem 3: Cheapest Flights Within K Stops

**Category:** graph shortest-path variant with extra state

### Dead end

Use standard Dijkstra on node-only state.

### Hints

1. Reaching the same city with a different number of stops left is not
   the same state.
2. Add the resource dimension to the search.
3. Think in terms of `(node, stops_used)` or layered relaxation.

### Full-solution framing

Use BFS-like layered relaxation, Bellman-Ford by stops, or stateful
priority search where stop count is part of the state.

### Common mistakes

- pruning by node alone
- treating fewer cost immediately as always dominant without considering
  remaining stops

---

## Problem 4: Minimum Cost To Connect Two Groups Of Points

**Category:** advanced DP with bitmask state

### Dead end

Try greedy pairings or exhaustive matching without shared state reuse.

### Hints

1. One group is usually small enough for subset state.
2. The DP state should encode which nodes in the second group are already
   connected.
3. Precompute fallback costs for any still-unconnected second-group node.

### Full-solution framing

Use DP over the first group index and a mask covering the second group.
The mask is the expensive but manageable part because one side is small.

### Common mistakes

- missing the small-side-state clue
- failing to account for leftover uncovered nodes after the main DP

---

## Problem 5: Find The Shortest Palindrome

**Category:** string algorithm / prefix-function reasoning

### Dead end

Check every prefix to see whether it is a palindrome.

### Hints

1. You want the longest prefix that is already a palindrome.
2. Convert the problem into matching the string against its reverse.
3. KMP prefix-function ideas can help identify the reusable overlap.

### Full-solution framing

Build a combined string such as:

```
  s + '#' + reverse(s)
```

and compute the prefix-function / LPS array to find the longest
palindromic prefix.

### Common mistakes

- confusing general palindrome matching with prefix palindrome structure
- forgetting to isolate the halves with a separator

---

## Problem 6: Candy

**Category:** greedy + proof

### Dead end

Try assigning candies locally in one left-to-right pass only.

### Hints

1. Each child depends on left and right comparisons.
2. One directional pass captures only one side of the inequality.
3. Use two passes or equivalent local constraints.

### Full-solution framing

Do a left-to-right pass to satisfy left-neighbor constraints and a
right-to-left pass to satisfy right-neighbor constraints, then take the
maximum requirement at each child.

### Common mistakes

- assuming one pass is enough
- failing to justify why the combined assignment is minimal

---

## Problem 7: Path With Minimum Effort

**Category:** combined paradigm

### Dead end

Treat it as ordinary path sum minimization.

### Hints

1. The path cost is the maximum edge effort along the path, not the sum.
2. That suggests threshold feasibility.
3. Binary search a threshold and test reachability.

### Full-solution framing

Use binary search on the maximum allowed effort and check whether the end
cell is reachable using only edges within that threshold.

### Common mistakes

- optimizing the wrong path cost definition
- forgetting that threshold feasibility is monotonic

---

## Problem 8: Design Search Autocomplete System

**Category:** design problem

### Dead end

Re-scan all previous sentences for every character typed.

### Hints

1. This is not only a string problem. It is a repeated-query design
   problem.
2. You need a structure supporting prefix lookup.
3. Ranking and update behavior must be part of the design.

### Full-solution framing

Use a trie keyed by characters, storing or deriving the top candidate
sentences for each prefix, plus frequency information for ranking.

### Common mistakes

- optimizing lookup without considering updates
- storing too much or too little ranking information per node

---

## What This Capstone Is Testing

This set tests whether you can:

- classify a hard problem correctly
- avoid common dead ends early
- exploit cross-phase knowledge
- explain not only the algorithm, but the modeling decision

That is the real end goal of DSA mastery.

---

## Final Exercises

1. Which capstone problem required the biggest transformation before the
   true structure became visible?
2. Which ones depended most on adding the correct state dimension?
3. Which dead ends were appealing but fundamentally wrong?
4. Which problem most clearly required proof rather than only coding?
5. Which category still feels least automatic to you, and why?

---

## Key Takeaways

- Hard problems are usually hard because the model is hidden, not because
  the syntax is complex.
- Hint ladders work best when they expose structure progressively.
- Dead-end analysis is valuable because it teaches what to reject early.
- Cross-phase fluency is the defining feature of strong hard-problem
  performance.
- If you can reason through this capstone, you are operating at the
  level this track was built to reach.

The final lesson closes the track with a roadmap for what to study next
and how to keep improving after completion.

---

**Previous**: [Lesson 63 — Practice Problems — Hard Combined Techniques](./63-practice-hard-combined.md)
**Next**: [Lesson 65 — What's Next — Beyond This Track](./65-what-next.md)