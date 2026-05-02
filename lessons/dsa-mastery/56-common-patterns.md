# Lesson 56: Recognizing Common LeetCode Patterns

> **Analogy**: An experienced musician does not read every note as a new
> event. They recognize scales, chords, and progressions. Strong problem
> solvers do the same: they do not parse each coding question from
> scratch. They recognize patterns in the structure of the prompt.

---

## Why This Matters

Interview preparation becomes much more efficient when you stop seeing
problems as isolated titles and start seeing families:

- sliding window
- two pointers
- fast/slow pointers
- merge intervals
- monotonic stack
- monotonic queue
- binary search variations
- prefix sums
- difference arrays

The point of this lesson is not to memorize labels. The point is to know
what signals each pattern and why it works.

---

## Pattern Recognition Decision Tree

```
  contiguous subarray / substring?
          |
     yes--+--> window condition changes locally? -> sliding window
          |
          +--> range totals reused often?        -> prefix sums

  sorted data / answer space?
          |
          +--> monotonic condition?              -> binary search

  pairwise movement inward?
          |
          +--> order matters with left/right?    -> two pointers

  need next greater / previous smaller?
          |
          +--> monotonic stack

  need best value in moving window?
          |
          +--> monotonic queue
```

---

## Sliding Window

### Signal

Look for:

- contiguous subarray or substring
- a condition that can be maintained as you expand or shrink the window
- optimization over windows, such as longest, shortest, maximum, minimum

### Why it works

Instead of recomputing each candidate range from scratch, you update the
window incrementally.

### Typical examples

- longest substring without repeating characters
- minimum window substring
- max consecutive ones with flips

### Warning

Sliding window is easiest when the window validity behaves locally and,
often, monotonically.
If negative numbers break that monotonicity, the pattern may fail.

---

## Two Pointers

### Signal

Look for:

- sorted arrays
- pair sums or pair relations
- inward scanning from both ends
- deduplication during traversal

### Why it works

Sorted structure gives order information, so moving one pointer changes
the candidate space predictably.

### Typical examples

- two sum in sorted array
- container with most water
- remove duplicates from sorted array

### Distinction from sliding window

Every sliding window uses pointers, but not every two-pointer problem is
a sliding window. A window is about maintaining a contiguous interval
with an invariant. General two-pointer problems may simply coordinate two
indices over structured data.

---

## Fast/Slow Pointers

### Signal

Look for linked lists or repeated-state processes where one traversal can
move faster than another.

### Why it works

If a faster pointer laps a slower one inside a cycle, they eventually
meet.

### Typical examples

- cycle detection in linked list
- finding middle of linked list
- duplicate number via cycle interpretation

This pattern matters because it solves problems with constant extra space
that a hash-set solution would otherwise use.

---

## Merge Intervals

### Signal

Look for interval overlap, scheduling, or coverage.

### Why sorting is first

Sorting by start time brings potentially interacting intervals next to
each other.

### Core invariant

Maintain the current merged interval. If the next interval overlaps,
extend it. Otherwise, flush the current one and start a new interval.

### Typical examples

- merge intervals
- insert interval
- non-overlapping intervals

---

## Monotonic Stack

### Signal

Look for:

- next greater / next smaller element
- previous greater / previous smaller element
- histogram or skyline style structure

### Why it works

The stack maintains candidates in monotonic order, so useless elements
are popped once and never revisited.

### Typical examples

- daily temperatures
- next greater element
- largest rectangle in histogram

---

## Monotonic Queue

### Signal

Look for a moving window where you need the maximum or minimum value in
that window.

### Why it works

The deque keeps elements in monotonic order, removing values that can no
longer become the optimum.

### Typical examples

- sliding window maximum
- shortest subarray with certain constraints in advanced variants

This is a pattern many candidates underuse because they stop at heaps.
Heaps help, but they often leave stale elements around. Monotonic queues
maintain exactly the useful frontier.

---

## Binary Search Variations

### Signal

Look for a monotonic yes/no condition.

That monotonic condition might live in:

- a sorted array
- the answer space itself
- a rotated array with structure
- a matrix with ordered rows/columns

### Binary search on answer

This is one of the most important upgrades beyond basic binary search.

Instead of searching an array element, search the smallest or largest
answer satisfying a monotonic feasibility check.

Examples:

- minimum eating speed
- ship packages within `d` days
- split array largest sum

---

## Prefix Sums

### Signal

Look for repeated range-sum queries or places where subarray properties
can be expressed as differences of cumulative totals.

### Why it works

If:

$$
prefix[i] = a_0 + a_1 + \cdots + a_i
$$

then any range sum becomes a subtraction.

### Typical examples

- subarray sum equals `k`
- range sum query
- count of range sum

This is one of the most reusable transformations in the track.

---

## Difference Arrays

### Signal

Look for many range updates where the final array is what matters.

### Why it works

Instead of applying an update to every element in the interval, mark the
start and end boundaries, then reconstruct the final values with a prefix
sum pass.

### Typical examples

- range increment operations
- flight bookings
- interval painting/counting variants

---

## Pattern Catalog Summary

```
  PATTERN             MAIN SIGNAL

  Sliding window      contiguous region + maintainable local condition
  Two pointers        structured pair scanning or inward traversal
  Fast/slow           linked/cyclic process with relative speed insight
  Merge intervals     overlap after sorting
  Monotonic stack     next/previous greater-smaller relationships
  Monotonic queue     moving-window extrema
  Binary search       monotonic decision space
  Prefix sums         repeated range aggregation
  Difference arrays   many range updates, final state matters
```

---

## Exercises

1. Why is "contiguous" such a strong clue for sliding window or prefix
   sums? What distinguishes when sliding window applies versus prefix sums?
2. What makes binary search on the answer different from normal binary
   search? Explain the monotonic feasibility condition with an example.
3. Why is sorting often the first move in interval problems? What
   invariant does sorting establish that makes merge or count operations
   linear?
4. What kind of prompt should make you think monotonic stack immediately?
   What is the structural property of "next greater element" problems?
5. When is a difference array better than directly applying updates?
   Calculate the runtime difference for `m` range updates on an array of
   size `n`.
6. For each pattern in this lesson (sliding window, two pointers, prefix
   sums, difference array, merge intervals, monotonic stack, monotonic
   queue, binary search on answer), name one classic LeetCode problem
   that uses it and explain the signal that triggered the pattern.
7. A problem asks for the "minimum size subarray sum." Is this sliding
   window, prefix sums, or binary search on answer? Explain when each
   applies and what constraints determine the choice.
8. Design a problem that looks like it needs nested loops but is actually
   solvable with two pointers. What property must the input have?

---

## Key Takeaways

- Patterns are recurring structural responses to recurring bottlenecks.
- The best pattern usually reveals itself through the prompt’s signals.
- Binary search, sliding window, and prefix sums solve very different
  bottlenecks despite all looking simple on the surface.
- Monotonic structures are specialized but extremely powerful.
- Recognizing the right pattern early saves more time than coding fast.

The next lesson shows how to move systematically from brute force to an
optimal solution instead of waiting for a flash of insight.

---

**Previous**: [Lesson 55 — Problem-Solving Methodology](./55-problem-solving-methodology.md)
**Next**: [Lesson 57 — The Brute-Force-to-Optimal Methodology](./57-brute-force-to-optimal.md)