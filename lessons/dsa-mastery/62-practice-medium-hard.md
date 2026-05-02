# Lesson 62: Practice Problems — Medium to Hard Transition

> The jump from medium to hard is usually not about writing longer code.
> It is about the point where obvious patterns become insufficient and you
> need stronger modeling discipline. This lesson is about that boundary.

---

## Why This Matters

Many candidates can solve medium problems and then stall completely on
hard ones. The missing skill is often not knowledge, but transition:

- knowing when a familiar pattern is incomplete
- spotting hidden state dimensions
- recognizing dead ends earlier

This lesson includes:

- 3 medium problems at the harder end
- 3 hard problems

---

## Medium Problems

---

### Problem 1: Top K Frequent Elements

**Pattern:** frequency counting + heap or bucket structure

### Why this is a transition problem

The first move is easy: count frequencies.
The second move is where modeling starts:

- min-heap for top `k`
- bucket grouping by frequency

### Dead-end approach

Sorting all distinct values works, but may be more expensive than
necessary.

### Transition lesson

This is often the first time candidates seriously think about choosing a
data structure based on output requirements rather than raw input shape.

---

### Problem 2: Minimum Size Subarray Sum

**Pattern:** sliding window with positive values

### Why this is a transition problem

Sliding window works only because all values are positive, so expanding
the window can only increase the sum.

### Trap

Candidates often memorize the pattern but forget the assumption.

If negatives were allowed, this exact strategy could fail.

### Transition lesson

Harder problems punish pattern use without assumption checking.

---

### Problem 3: Course Schedule II

**Pattern:** topological sort

### Why this is a transition problem

You must not only detect whether the dependency graph is valid, but also
construct an ordering.

### Trap

Seeing a graph and blindly using BFS or DFS without recognizing the DAG
ordering structure.

### Transition lesson

Harder problems often ask for the constructive version of a familiar
decision problem.

---

## Hard Problems

---

### Problem 4: Word Break II

**Pattern:** backtracking + memoization

### Why this is hard

The decision version is easier.
The enumeration version can explode because many sentence decompositions
share the same suffix states.

### Dead end

Pure backtracking without caching repeated suffix computations.

### Better framing

Memoize results by starting index so each suffix is solved once and then
reused.

---

### Problem 5: Largest Rectangle In Histogram

**Pattern:** monotonic stack

### Why this is hard

The correct area for each bar depends on the first smaller bar to the
left and right. That structural dependency is not obvious on first read.

### Dead end

Expanding left and right from every bar.

### Better framing

Use a monotonic increasing stack so bars are resolved exactly when their
right boundary becomes known.

### Transition lesson

Hard problems often rely on a structural boundary interpretation, not a
literal interpretation of the prompt.

---

### Problem 6: Minimum Number Of Refueling Stops

**Pattern:** greedy + heap

### Why this is hard

The choice is not simply “take fuel whenever you see it.”
The right strategy is to defer commitment and, when needed, retroactively
take the largest fuel amount from the stations you have already passed.

### Better framing

As you move forward, push reachable station fuels into a max-heap.
Whenever you cannot proceed, refuel from the best previously available
option.

### Transition lesson

Hard greedy problems often depend on delayed choice, not immediate local
choice.

---

## What Makes The Transition So Difficult?

Usually one of these:

- the usual pattern has a hidden assumption
- the state needs an extra dimension
- the problem asks for construction instead of decision
- you must combine a pattern with a supporting data structure
- the proof of why the greedy or stack logic works is nontrivial

That is why the medium-to-hard jump feels sharp.

---

## Common Traps

- copying a familiar pattern without checking whether its assumptions hold
- mistaking a decision problem for an enumeration problem
- using DFS when the real issue is ordering or shortest path
- using greedy without proving why local choices are safe
- focusing on implementation details before the state is correct

---

## Exercises

1. Why is `Word Break II` much harder than `Word Break I`?
2. Why does `Largest Rectangle in Histogram` naturally lead to monotonic
   stack reasoning?
3. What makes `Minimum Number of Refueling Stops` a heap-greedy problem
   instead of a simple local greedy problem?
4. Why is assumption checking so important in transition problems?
5. What is one signal that a problem has crossed from medium into hard?

---

## Key Takeaways

- The medium-to-hard jump is mostly about modeling discipline.
- Harder problems often add construction, extra state, or proof burden.
- Familiar patterns still matter, but they usually need stronger framing.
- Dead-end recognition is an important skill at this level.
- Transition practice teaches you when “almost the right pattern” is not
  enough.

The next lesson moves fully into hard territory with problems that
combine techniques from multiple earlier phases.

---

**Previous**: [Lesson 61 — Practice Problems — Easy and Medium Patterns](./61-practice-easy-medium.md)
**Next**: [Lesson 63 — Practice Problems — Hard Combined Techniques](./63-practice-hard-combined.md)