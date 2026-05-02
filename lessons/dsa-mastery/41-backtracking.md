# Lesson 41: Backtracking

> **Analogy**: Backtracking is like exploring a maze by walking until you
> hit a dead end, then returning to the most recent fork to try another
> path. It is systematic trial and error, but disciplined by pruning.

---

## Why This Matters

Backtracking is the paradigm for problems where:

- you must search a space of possibilities
- partial choices can later be undone
- pruning can kill large parts of the search tree early

It powers classic problems such as:

- N-Queens
- Sudoku
- permutations and subsets
- combination sum
- many constraint-satisfaction tasks

Backtracking is recursive search with state changes plus undo.

---

## The General Template

```python
def backtrack(state):
    if goal_reached(state):
        record_answer(state)
        return

    for choice in valid_choices(state):
        apply(choice, state)
        backtrack(state)
        undo(choice, state)
```

This template captures the essence:

- choose
- recurse
- undo

The undo step is what separates backtracking from simple branching
recursion.

---

## Why Pruning Is Essential

Without pruning, backtracking often degenerates into brute-force search.

Pruning means:

> Stop exploring a branch as soon as you can prove it cannot lead to a
> valid or better solution.

That is where most of the power comes from.

---

## Example 1: Subset Generation

For each element, you have two choices:

- include it
- exclude it

This creates a binary decision tree.

#### Python

```python
def subsets(values: list[int]) -> list[list[int]]:
    result: list[list[int]] = []
    current: list[int] = []

    def dfs(index: int) -> None:
        if index == len(values):
            result.append(current.copy())
            return

        current.append(values[index])
        dfs(index + 1)
        current.pop()

        dfs(index + 1)

    dfs(0)
    return result
```

### Search tree

```
  values = [1, 2, 3]

                []
              /    \
           [1]      []
          /   \    /  \
      [1,2] [1] [2]   []
       ...
```

This is the cleanest backtracking example because the structure is easy
to see.

---

## Example 2: Permutations

Here the choice is not include/exclude. It is:

- choose one unused element for the next position

#### TypeScript

```typescript
function permute(values: number[]): number[][] {
  const result: number[][] = [];
  const current: number[] = [];
  const used = new Array<boolean>(values.length).fill(false);

  function backtrack(): void {
    if (current.length === values.length) {
      result.push([...current]);
      return;
    }

    for (let index = 0; index < values.length; index += 1) {
      if (used[index]) {
        continue;
      }

      used[index] = true;
      current.push(values[index]);
      backtrack();
      current.pop();
      used[index] = false;
    }
  }

  backtrack();
  return result;
}
```

The state here includes both:

- current partial permutation
- which values are already used

---

## Example 3: Combination Sum

### Problem

Choose numbers that sum to a target, allowing repeated use.

### Key pruning rule

If the remaining target becomes negative, stop immediately.

That one pruning rule kills huge parts of the search tree.

---

## N-Queens

### Problem

Place `n` queens on an `n x n` board so that no two attack each other.

### State

You place queens row by row.

For each row, try a legal column.

### Pruning

Reject any position sharing:

- a column
- a main diagonal
- an anti-diagonal

### ASCII search intuition

```
  Row 0: try each column
  Row 1: try only non-attacking columns
  Row 2: continue
  If a row has no legal column, backtrack immediately
```

This is where pruning turns exponential chaos into something manageable.

#### Rust

```rust
fn solve_n_queens(n: usize) -> Vec<Vec<String>> {
    fn backtrack(
        row: usize,
        n: usize,
        columns: &mut [bool],
        diagonals: &mut [bool],
        anti_diagonals: &mut [bool],
        board: &mut Vec<Vec<char>>,
        result: &mut Vec<Vec<String>>,
    ) {
        if row == n {
            result.push(board.iter().map(|line| line.iter().collect()).collect());
            return;
        }

        for col in 0..n {
            let diagonal = row + col;
            let anti_diagonal = row + (n - 1 - col);
            if columns[col] || diagonals[diagonal] || anti_diagonals[anti_diagonal] {
                continue;
            }

            columns[col] = true;
            diagonals[diagonal] = true;
            anti_diagonals[anti_diagonal] = true;
            board[row][col] = 'Q';

            backtrack(row + 1, n, columns, diagonals, anti_diagonals, board, result);

            board[row][col] = '.';
            columns[col] = false;
            diagonals[diagonal] = false;
            anti_diagonals[anti_diagonal] = false;
        }
    }

    let mut result = Vec::new();
    let mut columns = vec![false; n];
    let mut diagonals = vec![false; 2 * n - 1];
    let mut anti_diagonals = vec![false; 2 * n - 1];
    let mut board = vec![vec!['.'; n]; n];

    backtrack(0, n, &mut columns, &mut diagonals, &mut anti_diagonals, &mut board, &mut result);
    result
}
```

---

## Sudoku Solver

Sudoku is backtracking plus constraint propagation.

At each empty cell:

- try a valid digit
- recurse
- undo if needed

The smarter your pruning and validity bookkeeping, the faster the solver.

This is a good example of how engineering details matter in
backtracking-heavy problems.

---

## What If We Generated Everything And Filtered Afterward?

That is usually the naive brute-force version.

Backtracking is better because it filters **during generation**.

That means:

- invalid prefixes die early
- useless branches never fully materialize

This is the single most important conceptual win in backtracking.

---

## How To Recognize Backtracking Problems

Signals:

- "find all solutions"
- "construct all valid combinations"
- "choose subject to constraints"
- "try possibilities until one works"
- large search space, but many branches can be cut early

If the problem sounds like controlled exploration with undo, think
backtracking.

---

## Exercises

1. What is the purpose of the undo step in backtracking? Why is it
   conceptually different from simply not saving changes in the first place?
2. Why is pruning more important than recursion syntax in these problems?
   Explain the difference in search space size between naive generation and
   pruned backtracking for a concrete example.
3. Explain why subset generation is backtracking even though it has no
   explicit invalid states. What is the choose/unchoose pattern doing here?
4. What state must be tracked in permutations? Explain why a `used`
   boolean array is sufficient and how it prevents duplicates.
5. For N-Queens, what conditions allow immediate pruning? Explain the
   column, diagonal, and anti-diagonal constraints and how checking all
   three is necessary.
6. Give an example where backtracking is the right first approach but a
   more optimized method might exist later. Describe the optimization
   technique and why it does not invalidate the backtracking reasoning.
7. In combination sum, explain why sorting candidates and skipping
   duplicates during recursion is correct. What would go wrong if you
   skipped duplicates before sorting?
8. Compare the recursive tree depth of subset generation (2^n leaves)
   versus permutation generation (n! leaves) for n = 5. Which grows faster
   as n increases?

---

## Key Takeaways

- Backtracking is recursive search plus undo.
- The core loop is choose, recurse, undo.
- Pruning is the real performance lever.
- Many combinatorial search problems are naturally modeled this way.
- Generating and filtering afterward is usually much worse than pruning
  during generation.

The next lesson turns these paradigms into interview-style practice
problems.

---

**Previous**: [Lesson 40 — Greedy Algorithms](./40-greedy-algorithms.md)
**Next**: [Lesson 42 — Practice Problems — Algorithm Design Paradigms](./42-practice-paradigms.md)