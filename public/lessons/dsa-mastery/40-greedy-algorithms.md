# Lesson 40: Greedy Algorithms

> **Analogy**: Imagine making change with coins by always taking the
> largest coin available. Sometimes that is perfect. Sometimes it fails
> badly. Greedy algorithms are about making the best local choice now and
> hoping it leads to a globally optimal answer. The hard part is not
> making the local choice. It is proving that the local choice is safe.

---

## Why This Matters

Greedy algorithms are seductive because they feel simple.

- choose the best-looking option now
- never revisit it
- keep moving forward

When greedy works, it often gives elegant and fast algorithms.
When it fails, it can produce answers that look plausible but are wrong.

This lesson is about understanding both sides:

- why greedy succeeds in some problems
- why it fails in others
- how to reason about correctness using greedy choice and exchange
  arguments

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

1. Why does earliest finishing time solve activity selection?
2. Why does value density solve fractional knapsack but not 0/1
   knapsack?
3. What is the greedy choice in Huffman coding?
4. Explain the farthest-reach invariant in Jump Game.
5. Give a small problem where a natural greedy rule fails.
6. For one greedy algorithm in this lesson, outline an exchange
   argument.

---

## Key Takeaways

- Greedy algorithms commit to local decisions without backtracking.
- Greedy works only when a locally optimal choice is globally safe.
- Correctness usually depends on an exchange or stays-ahead proof.
- Fractional knapsack, activity selection, Huffman coding, and Jump Game
  are classic examples where greedy succeeds.
- Greedy is powerful, but only with a proof.

The next lesson turns from irrevocable local choices to full recursive
search with undoing: backtracking.

---

**Previous**: [Lesson 39 — Advanced Dynamic Programming](./39-dp-advanced.md)
**Next**: [Lesson 41 — Backtracking](./41-backtracking.md)