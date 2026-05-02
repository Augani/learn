# Lesson 40: Greedy Algorithms

> **Analogy**: Imagine making change with coins by always taking the
> largest coin available. Sometimes that is perfect. Sometimes it fails
> badly. Greedy algorithms are about making the best local choice now and
> hoping it leads to a globally optimal answer. The hard part is not
> making the local choice. It is proving that the local choice is safe.

---

## Why This Matters

Greedy algorithms are seductive because they feel simple. At each step,
you make the locally best choice and never look back. No recursion, no
backtracking, no complex state — just pick what looks best right now.

When greedy works, it often gives:
- **Elegant, short code**: activity selection is 5 lines; Huffman coding
  is a simple priority queue loop
- **Fast runtime**: sorting plus a linear scan beats dynamic programming
  for the same problem when the greedy choice property holds
- **Natural intuition**: the solution often matches how humans would
  reason about the problem

When it fails, it can produce answers that look plausible but are wrong:
- **0/1 knapsack**: picking the highest value-density item first can
  block a better combination of smaller items
- **Shortest path with negative edges**: Dijkstra's greedy shortest-first
  approach fails because a longer initial path might lead to a much
  shorter total
- **Set cover**: the greedy approach of picking the set covering the
  most uncovered elements achieves a logarithmic approximation, not
  the optimal solution

This lesson is about understanding both sides:

- Why greedy succeeds in some problems (greedy choice property, optimal
  substructure)
- Why it fails in others (local optima trap, irreversible decisions)
- How to reason about correctness using exchange arguments and
  stays-ahead proofs

---

## The Core Idea

A greedy algorithm builds a solution incrementally and commits to local
decisions without backtracking.

For greedy to be correct, two ideas usually matter:

- **greedy choice property**: some locally optimal choice can be part of
  a globally optimal solution
- **optimal substructure**: after making that choice, the remaining
  problem is still optimally solvable in the same spirit

Without a proof, greedy is just optimism.

---

## Activity Selection

### Problem

Select the maximum number of non-overlapping activities.

### Greedy rule

Always pick the activity that finishes earliest.

### Why this works

Finishing early leaves as much room as possible for future choices.

### Exchange argument intuition

If an optimal solution starts with an activity that finishes later than
the earliest-finishing one, replace it with the earliest-finishing one.
The replacement cannot reduce the number of remaining compatible
activities, so an optimal solution still exists after the swap.

#### Python

```python
def activity_selection(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    intervals = sorted(intervals, key=lambda interval: interval[1])
    chosen: list[tuple[int, int]] = []
    current_end = float("-inf")

    for start, end in intervals:
        if start >= current_end:
            chosen.append((start, end))
            current_end = end

    return chosen
```

### ASCII timeline

```
  Activities:
  A: [1----4]
  B:   [3--5]
  C:      [4--6]
  D:        [5------9]
  E:           [6--8]

  Greedy picks earliest finish each time:
  A -> C -> E
```

---

## Fractional Knapsack

### Problem

Items can be split fractionally. Maximize value under capacity.

### Greedy rule

Pick items in descending order of value density:

$$
value / weight
$$

This works because fractional splitting preserves the density ordering.

#### TypeScript

```typescript
function fractionalKnapsack(items: Array<[number, number]>, capacity: number): number {
  let remaining = capacity;
  let totalValue = 0;

  items
    .slice()
    .sort((first, second) => second[0] / second[1] - first[0] / first[1])
    .forEach(([value, weight]) => {
      if (remaining <= 0) {
        return;
      }
      const takeWeight = Math.min(weight, remaining);
      totalValue += (value / weight) * takeWeight;
      remaining -= takeWeight;
    });

  return totalValue;
}
```

### Why this differs from 0/1 knapsack

The ability to split items removes the combinatorial trap. Greedy can
always use the best density next.

---

## Huffman Coding

### Problem

Build a prefix code minimizing the weighted average code length.

### Greedy rule

Repeatedly merge the two least frequent symbols.

This gives shorter codes to more frequent characters.

### ASCII construction

```
  Frequencies:
  A: 5, B: 9, C: 12, D: 13, E: 16, F: 45

  Merge 5 and 9   -> 14
  Merge 12 and 13 -> 25
  Merge 14 and 16 -> 30
  Merge 25 and 30 -> 55
  Merge 45 and 55 -> 100
```

The repeated choice of the two smallest weights is the greedy heart of
the algorithm.

---

## Interval Scheduling Variants

Greedy often appears in interval problems, but the sorting rule changes
by objective.

- maximize count of non-overlapping intervals -> earliest finish time
- minimize arrows for balloons -> sort by interval end
- merge intervals -> sort by start

This is a useful reminder that greedy is not one trick. It is a proof
pattern plus a problem-specific ordering rule.

---

## Jump Game

### Problem

Each array entry tells how far you can jump. Can you reach the end?

### Greedy insight

Track the farthest reachable index seen so far.

If you ever arrive at an index beyond that reach, you are stuck.

#### Rust

```rust
fn can_jump(values: &[i32]) -> bool {
    let mut farthest = 0usize;

    for (index, &jump) in values.iter().enumerate() {
        if index > farthest {
            return false;
        }

        farthest = farthest.max(index + jump.max(0) as usize);
    }

    true
}
```

This is greedy because you do not simulate all jump sequences. You only
maintain the strongest frontier reachable so far.

---

## Why Greedy Fails Sometimes

### What if we used greedy for 0/1 knapsack?

It can fail because a locally best item can block a better combination
of slightly worse-looking items.

### Another failure shape

Greedy often fails when:

- future consequences are hard to repair
- choices interact globally
- there is no exchange argument validating the local rule

If you cannot justify the greedy step formally, you should be suspicious.

---

## How To Prove A Greedy Algorithm

Common proof strategies:

1. **Exchange argument**:
   show any optimal solution can be transformed to include the greedy
   choice without becoming worse.
2. **Stays-ahead argument**:
   show the greedy solution is never behind any competitor at any stage.
3. **Cut/property style reasoning**:
   common in MSTs and related graph problems.

Greedy algorithms are easy to invent and hard to justify. The proof is
the algorithm.

---

## Exercises

1. Why does earliest finishing time solve activity selection? Give the
   exchange argument in your own words.
2. Why does value density solve fractional knapsack but not 0/1
   knapsack? Construct a concrete counterexample for 0/1 knapsack.
3. What is the greedy choice in Huffman coding? Why does merging the two
   least frequent symbols lead to an optimal prefix code?
4. Explain the farthest-reach invariant in Jump Game. Prove that if you
   can reach index `i`, and `i + nums[i]` extends the farthest reach,
   you will never get stuck before reaching the end.
5. Give a small problem where a natural greedy rule fails. Explain why
   the failure occurs — is it missing the greedy choice property or
   optimal substructure?
6. For activity selection, outline a full exchange argument proving that
   replacing the first interval in any optimal solution with the
   earliest-finishing interval preserves optimality.
7. Why might a greedy algorithm fail for shortest path on a graph with
   negative edge weights? How does Dijkstra's assumption break?
8. In interval scheduling, what happens if you sort by start time
   instead of finish time? Does greedy still work? Prove or give a
   counterexample.

---

## Key Takeaways

- **Greedy algorithms** commit to local decisions without backtracking.
  They are fast and elegant but only correct when the problem structure
  supports them.
- **Greedy works only when a locally optimal choice is globally safe**.
  This requires two properties: the **greedy choice property** (some
  optimal solution includes the greedy pick) and **optimal
  substructure** (the remaining problem after the greedy pick is still
  optimally solvable).
- **Correctness usually depends on an exchange or stays-ahead proof**.
  Without a proof, a greedy algorithm is just an optimistic heuristic.
- **Fractional knapsack, activity selection, Huffman coding, and Jump
  Game** are classic examples where greedy succeeds because the local
  choice cannot block a better global solution.
- **Greedy often fails** when choices interact globally (0/1 knapsack),
  when future consequences are hard to repair (set cover), or when
  negative weights break monotonicity (Dijkstra with negatives).
- **Exchange argument**: show any optimal solution can be transformed to
  include the greedy choice without becoming worse.
- **Stays-ahead argument**: show the greedy solution is never behind any
  competitor at any stage.

The next lesson turns from irrevocable local choices to full recursive
search with undoing: backtracking.

---

**Previous**: [Lesson 39 — Advanced Dynamic Programming](./39-dp-advanced.md)
**Next**: [Lesson 41 — Backtracking](./41-backtracking.md)