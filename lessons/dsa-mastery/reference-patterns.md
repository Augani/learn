# DSA Mastery Reference: LeetCode Patterns Catalog

> This catalog is a fast pattern-recognition aid. Each entry tells you
> what the pattern is for, when to suspect it, and what kind of problem
> it typically solves.

---

## Sliding Window

Use when the problem asks about a contiguous subarray or substring and a
window property can be maintained incrementally while expanding or
shrinking. Strong signals are longest/shortest/maximum/minimum over
contiguous ranges. Sample problem family: longest substring without
repeating characters, minimum window substring.

## Two Pointers

Use when two indices can move with structure, usually on sorted arrays,
palindrome checks, partitioning, or inward scans. Signals include pair
sum relations, symmetry, deduplication, and left/right tradeoffs. Sample
problem family: two sum sorted, container with most water.

## Fast/Slow Pointers

Use when the data structure or process has a notion of different speeds,
especially linked lists and cycle-detection settings. Signals include
cycle detection, middle element, or repeated-state interpretation.
Sample problem family: linked list cycle, find duplicate number.

## Merge Intervals

Use when intervals can overlap and sorting by start time makes the local
interactions visible. Signals include schedule merging, interval
conflicts, coverage, and insertion into interval sets. Sample problem
family: merge intervals, insert interval.

## Monotonic Stack

Use when you need next greater, next smaller, previous greater, previous
smaller, or boundary information that resolves once a stronger/weaker
element appears. Signals include histogram, temperatures, skyline, and
nearest-boundary wording. Sample problem family: daily temperatures,
largest rectangle in histogram.

## Monotonic Queue

Use when you need the max or min over a moving window and stale elements
must be removed as the window advances. Signals include sliding-window
maximum/minimum or best candidate over a bounded recent range. Sample
problem family: sliding window maximum.

## Binary Search

Use when the search space is ordered and the answer can be discarded by
halves. Signals include sorted arrays, rotated arrays with preserved
structure, matrix search, and threshold testing. Sample problem family:
search insert position, search in rotated sorted array.

## Binary Search On Answer

Use when the prompt asks for a minimum feasible value or maximum feasible
value and feasibility is monotonic. Signals include “smallest rate,”
“minimum capacity,” or “maximize minimum.” Sample problem family: Koko
Eating Bananas, ship packages within D days.

## Prefix Sums

Use when repeated range totals or subarray properties can be expressed as
differences of cumulative values. Signals include subarray sums, many
range queries, or count problems over cumulative totals. Sample problem
family: subarray sum equals k, range sum query.

## Difference Arrays

Use when there are many range updates but the final array is what
matters. Signals include repeated interval increments/decrements and a
final reconstruction pass. Sample problem family: corporate flight
bookings.

## Hash Map / Frequency Counting

Use when equality, complements, counts, grouping, or repeated
membership/value lookup dominates the problem. Signals include anagrams,
pair sums, duplicates, and grouping by signature. Sample problem family:
two sum, group anagrams.

## Topological Sort Pattern

Use when the problem describes dependencies, prerequisites, or ordering
constraints and cycles imply impossibility. Signals include “must happen
before,” “course prerequisites,” or build ordering. Sample problem
family: Course Schedule, Alien Dictionary.

## Union-Find Pattern

Use when you need to merge components and query whether elements are in
the same set. Signals include connectivity under union operations,
dynamic grouping, redundant edges, and equivalence classes. Sample
problem family: number of connected components, accounts merge.

## BFS / DFS Graph Pattern

Use when the core task is reachability, traversal, connected components,
or shortest path in unweighted graphs. Signals include grids, islands,
flood fill, and simple path-length counting. Sample problem family:
number of islands, shortest path in binary matrix.

## State-Machine DP

Use when the answer depends on a small mode or status that changes over
time, such as holding/not holding, cooldown states, or transaction
counts. Signals include action constraints based on the previous step.
Sample problem family: stock with cooldown.

## Interval DP

Use when the natural subproblem is a contiguous interval `[l, r]` and a
split point or “last action inside the interval” matters. Signals include
burst balloons, matrix chain multiplication, or interval elimination.
Sample problem family: Burst Balloons.

## Digit DP

Use when counting numbers up to a bound under digit-level constraints.
Signals include “count numbers in range satisfying digit property” and
state tied to position, tightness, used digits, or digit sum. Sample
problem family: count numbers with repeated digits constraints.

## Bitmask DP

Use when the state is a small subset of items and exact combinatorial
reasoning is needed. Signals include `n <= 20`, visiting subsets, or
small-width placement/state constraints. Sample problem family:
traveling salesman on small graphs, seating problems.

## Tree DP

Use when subtree answers combine recursively and each node needs to send
structured information upward. Signals include global best path in a
tree, independent-set style selection, or rooted subtree optimization.
Sample problem family: binary tree maximum path sum, house robber III.

## Greedy + Proof Pattern

Use when a local choice seems promising and you can justify it with an
exchange argument, stays-ahead argument, or cut property. Signals
include scheduling, interval selection, Huffman-like merging, or minimum
resource assignment. Sample problem family: activity selection, Candy.

## Backtracking + Pruning

Use when the space is combinatorial but invalid or hopeless branches can
be cut early. Signals include constraint satisfaction, N-Queens, Sudoku,
combination generation with restrictions. Sample problem family:
N-Queens, combination sum.

---

## How To Use This Catalog

Ask three questions:

1. What is the input structure: array, graph, string, tree, subset state?
2. What repeated work or invariant defines the bottleneck?
3. Which pattern eliminates that specific bottleneck?

Pattern selection becomes faster when you tie it to signal recognition,
not title memorization.

---

**Previous**: [Data Structure and Algorithm Selection Guide](./reference-decision-guide.md)
**Next**: [Problem-Solving Checklist and Pattern Recognition](./reference-problem-solving.md)