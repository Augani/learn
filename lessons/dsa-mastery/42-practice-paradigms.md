# Lesson 42: Practice Problems — Algorithm Design Paradigms

> This lesson is about paradigm selection under pressure. The hard part
> is often not implementing the recurrence or loop. It is deciding
> whether the problem wants greedy, dynamic programming, divide and
> conquer, or backtracking in the first place.

---

## How to Use This Lesson

Each problem includes:

- the paradigm signal it tests
- the brute-force instinct
- the better framing
- a concise optimal solution or recurrence

This lesson includes:

- 3 easy problems
- 3 medium problems
- 2 hard problems

---

## Easy Problems

---

### Problem 1: House Robber

**Paradigm signal:** linear DP with take/skip decisions

**Brute-force instinct:**
At each house, choose rob or skip and recursively branch.

**Better framing:**
The state is just the index. The future only depends on where you are.

Recurrence:

$$
dp[i] = \max(nums[i] + dp[i + 2], dp[i + 1])
$$

#### Python

```python
def rob(nums: list[int]) -> int:
    next_one = 0
    next_two = 0

    for value in reversed(nums):
        next_one, next_two = max(value + next_two, next_one), next_one

    return next_one
```

---

### Problem 2: Best Time to Buy and Sell Stock

**Paradigm signal:** greedy invariant over a single pass

**Brute-force instinct:**
Try every buy/sell pair.

**Better framing:**
Track the minimum price seen so far and the best profit achievable at
each day.

This is greedy because the best earlier buy price is the only past
information that matters.

---

### Problem 3: Maximum Subarray

**Paradigm signal:** DP or greedy over prefixes

**Better framing:**
Either extend the previous subarray or start a new one.

Recurrence:

$$
bestEndingHere = \max(nums[i], nums[i] + bestEndingHere)
$$

This is Kadane's algorithm.

---

## Medium Problems

---

### Problem 4: Coin Change

**Paradigm signal:** unbounded DP over amount state

**Brute-force instinct:**
Try every coin combination recursively.

**Optimal framing:**
For each amount, use previously solved smaller amounts.

This is one of the cleanest examples of brute force turning into DP.

---

### Problem 5: Longest Palindromic Substring

**Paradigm signal:** interval reasoning, expand-around-center, or DP

The key decision is that not every problem with substrings needs DP.
Expand-around-center is often simpler and equally good here.

That is exactly why this belongs in a paradigm lesson.

---

### Problem 6: Partition Equal Subset Sum

**Paradigm signal:** subset DP / knapsack flavor

The problem asks whether a subset can sum to half the total.

That means it is really a 0/1 knapsack-style reachability problem.

#### TypeScript

```typescript
function canPartition(nums: number[]): boolean {
  const total = nums.reduce((sum, value) => sum + value, 0);
  if (total % 2 !== 0) {
    return false;
  }

  const target = total / 2;
  const dp = new Array<boolean>(target + 1).fill(false);
  dp[0] = true;

  for (const value of nums) {
    for (let current = target; current >= value; current -= 1) {
      dp[current] = dp[current] || dp[current - value];
    }
  }

  return dp[target];
}
```

---

## Hard Problems

---

### Problem 7: Edit Distance

**Paradigm signal:** 2D DP over two progressing strings

**Brute-force instinct:**
Try all edit sequences.

**Optimal framing:**
State is a pair of indices `(i, j)` and recurrence compares the current
characters.

This is hard because the recurrence is easy to write incorrectly unless
you define the state precisely.

---

### Problem 8: Burst Balloons

**Paradigm signal:** interval DP with counterintuitive ordering

The trick is not to think about which balloon to burst first.
Think about which balloon is burst **last** within an interval.

That redefines the problem into independent left and right intervals.

This is exactly the kind of reframing that separates average DP skills
from strong DP skills.

---

## Pattern Identification Table

```
  PROBLEM                         PARADIGM SIGNAL

  House robber                    linear DP, take/skip state
  Best stock profit               greedy running invariant
  Maximum subarray                DP/greedy over prefixes
  Coin change                     unbounded DP
  Longest palindromic substring   interval reasoning / center expansion
  Partition equal subset sum      0/1 knapsack-style DP
  Edit distance                   2D DP over two strings
  Burst balloons                  interval DP, last-action framing
```

---

## Brute Force To Optimal Thinking

- `house robber`: branching recursion becomes 1D DP.
- `best stock profit`: pair enumeration becomes a single greedy pass.
- `coin change`: combination search becomes DP over amount.
- `partition equal subset sum`: subset exploration becomes boolean DP.
- `burst balloons`: naive order search becomes interval DP by changing
  the question from first burst to last burst.

This lesson is less about specific code and more about seeing the right
paradigm hiding beneath the surface problem.

---

## Exercises

1. Why is `best time to buy and sell stock` greedy rather than DP in its
   simplest form? What past information is sufficient, and why does
   tracking only the minimum-so-far work?
2. Why is `partition equal subset sum` really a knapsack-style problem?
   Explain the reduction from subset selection to boolean reachability on
   a sum state.
3. What state defines `edit distance`? Explain why the recurrence
   compares three possibilities and how the base cases handle empty
   prefixes.
4. Why does `burst balloons` become easier when you think in terms of
   the last balloon burst in an interval? How does this reframe break
   the problem into independent left/right subproblems?
5. Give one problem from this lesson that could tempt you into the wrong
   paradigm at first glance. Describe the wrong paradigm, why it seems
   natural, and what signal should redirect you.
6. In `house robber`, explain why the recurrence `dp[i] = max(nums[i] +
   dp[i+2], dp[i+1])` captures all valid choices. Why is there no need
   to track which specific houses were robbed?
7. For `coin change`, contrast the brute-force recursive tree with the
   memoized version. How many distinct states exist, and what is the
   branching factor of the naive recursion?
8. `maximum subarray` can be solved with either DP or greedy reasoning.
   Explain both perspectives and why they lead to the same Kadane's
   algorithm implementation.

---

## Key Takeaways

- Paradigm selection is often the real challenge in interview problems.
- Similar-looking problems can belong to different paradigms.
- Many hard DP problems become manageable after a better state or
  interval reframing.
- Greedy solutions often depend on a strong invariant rather than a full
  state table.
- Practice should focus on recognizing the underlying structure, not
  memorizing titles.

The next lesson turns that recognition skill into an explicit decision
framework.

---

**Previous**: [Lesson 41 — Backtracking](./41-backtracking.md)
**Next**: [Lesson 43 — Choosing the Right Paradigm](./43-paradigm-selection.md)