# DSA Mastery Reference: Problem-Solving Checklist and Pattern Recognition

> Use this reference when you feel tempted to jump straight into code.
> The checklist exists to keep your reasoning stable, especially on
> medium and hard problems where early misclassification is expensive.

---

## The Core Checklist

### 1. Understand the problem

- What is the exact input?
- What is the exact output?
- Is this optimization, counting, decision, construction, or traversal?
- Are duplicates possible?
- Does order matter?
- Are there hidden constraints such as nonnegative numbers or tree/DAG
  assumptions?

### 2. Identify constraints and complexity target

- How large can `n` be?
- Is `O(n^2)` acceptable?
- Is the search space too large for brute force?
- Is preprocessing justified by many queries?

### 3. Consider brute force first

- What is the simplest correct solution?
- What repeated work does it do?
- Where does the blow-up come from?

### 4. Identify the bottleneck

- repeated membership checks?
- repeated range sums?
- repeated recursive states?
- repeated next-greater/nearest-boundary scans?
- repeated graph revisits without enough state?

### 5. Apply the pattern or data-structure upgrade

- hash map / set for repeated lookup
- prefix sums for repeated range totals
- sliding window for contiguous local invariants
- binary search for monotonic decision spaces
- DP for overlapping subproblems
- graph traversal for connectivity or shortest unweighted paths
- monotonic structures for nearest-boundary or moving extrema problems

### 6. Optimize only after naming the invariant

- what does the window represent?
- what does `dp[state]` mean?
- what does the queue/stack contain?
- what makes the greedy choice safe?

### 7. Verify with edge cases

- empty input
- one element
- all equal
- already sorted / reverse sorted
- duplicates
- smallest valid constraint
- largest stress-case shape

---

## Pattern Recognition Decision Tree

```
  contiguous range problem?
       |
       +-- repeated range totals?        -> prefix sums
       +-- maintain valid window?        -> sliding window

  ordered / monotonic search space?
       |
       +-- explicit sorted data?         -> binary search / two pointers
       +-- answer feasibility monotonic? -> binary search on answer

  graph / grid / dependencies?
       |
       +-- unweighted shortest path?     -> BFS
       +-- reachability / components?    -> DFS/BFS
       +-- prerequisites ordering?       -> topological sort

  repeated recursive states?
       |
       +-- overlapping subproblems?      -> DP / memoization

  subset state small?
       |
       +-- n roughly <= 20?              -> bitmask DP / backtracking

  next/previous greater-smaller?
       |
       +-- nearest boundary needed?      -> monotonic stack

  moving window extrema?
       |
       +-- max/min over sliding window?  -> monotonic queue
```

---

## Constraint Signals Cheat Sheet

| Signal | Likely Direction |
| --- | --- |
| `n <= 20` | bitmask DP, meet-in-the-middle, backtracking |
| `n <= 10^5` | usually `O(n)` or `O(n log n)` |
| many repeated range queries | preprocessing, prefix sums, Fenwick, segment tree |
| grid shortest path with uniform steps | BFS |
| dependency ordering | topological sort |
| “smallest feasible” / “largest feasible” | binary search on answer |
| same suffix/prefix/subtree revisited | memoization / DP |

---

## Common Misclassifications To Avoid

- Using sliding window when negative values break monotonicity.
- Using DFS when the problem is shortest path in an unweighted graph.
- Using binary search without a monotonic predicate.
- Using greedy when no proof of local safety exists.
- Using DP with an imprecise or oversized state.
- Treating the same node with different resources or history as the same
  graph state.

---

## Interview Workflow Template

1. Restate the problem precisely.
2. Mention the constraint-driven complexity target.
3. Outline a brute-force solution.
4. Name the bottleneck.
5. State the chosen pattern and why it addresses that bottleneck.
6. Define the invariant or state.
7. Give time and space complexity.
8. Mention one or two edge cases before coding.

This workflow is often stronger than jumping directly to code.

---

## Final Reminder

Most failures on medium and hard problems are not caused by missing one
rare trick. They are caused by:

- misunderstanding the prompt
- ignoring constraints
- choosing a pattern before identifying the bottleneck
- coding before the invariant is clear

Use the checklist to prevent those mistakes systematically.

---

**Previous**: [LeetCode Patterns Catalog](./reference-patterns.md)
**Next**: [DSA Mastery Roadmap](./00-roadmap.md)