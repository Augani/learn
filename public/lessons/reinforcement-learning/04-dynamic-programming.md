# Lesson 4: Dynamic Programming

## When You Know the Rules

Imagine you have the complete rulebook for a board game -- every possible
move, every probability, every reward. Dynamic Programming (DP) methods
solve MDPs when you have this perfect knowledge.

```
  +-------------------------------------------+
  |  DP Methods require:                      |
  |                                           |
  |  - Complete model of the environment      |
  |  - All transition probabilities P(s'|s,a) |
  |  - All rewards R(s,a,s')                  |
  |  - Finite state and action spaces         |
  +-------------------------------------------+
         |
         | "But in the real world, we rarely know all this!"
         |
         v
  +-------------------------------------------+
  |  That's why we need MC and TD methods     |
  |  (Lessons 5-6). But DP gives us the       |
  |  foundation to understand everything else.|
  +-------------------------------------------+
```

## Policy Evaluation: How Good Is This Policy?

Given a fixed policy, compute its value function by iterating:

```
  POLICY EVALUATION ALGORITHM:

  Initialize V(s) = 0 for all states
  Repeat until convergence:
      For each state s:
          V(s) <-- SUM_a pi(a|s) * SUM_s' P(s'|s,a) * [R + gamma * V(s')]

  +--------+    +--------+    +--------+         +--------+
  | V = 0  | -> | V ~ 1  | -> | V ~ 2  | -> ... | V = V* |
  | (init) |    | (iter1)|    | (iter2)|         | (done) |
  +--------+    +--------+    +--------+         +--------+
```

Analogy: like asking friends "how far is the goal?" and updating your
estimate based on their answers. After enough rounds, everyone agrees.

## Policy Iteration: Find the Best Policy

Two steps that repeat:

```
  +------------------+          +--------------------+
  | POLICY           |          | POLICY             |
  | EVALUATION       | -------> | IMPROVEMENT        |
  |                  |          |                    |
  | "Given this      |          | "Given these       |
  |  policy, what    |          |  values, what's    |
  |  are the values?"|          |  a better policy?" |
  +--------+---------+          +----------+---------+
           ^                               |
           |                               |
           +---------- repeat -------------+

  pi_0 --> V^{pi_0} --> pi_1 --> V^{pi_1} --> pi_2 --> ... --> pi*
  (random)  (evaluate)  (greedy)  (evaluate)  (greedy)         (optimal)
```

```python
import numpy as np

ROWS, COLS = 4, 4
GAMMA = 1.0
TERMINAL_STATES = [(0, 0), (3, 3)]
ACTIONS = [(-1, 0), (1, 0), (0, -1), (0, 1)]
ACTION_NAMES = ["UP", "DOWN", "LEFT", "RIGHT"]


def get_next_state(state, action):
    row, col = state
    dr, dc = action
    new_row = max(0, min(ROWS - 1, row + dr))
    new_col = max(0, min(COLS - 1, col + dc))
    return (new_row, new_col)


def policy_evaluation(policy, theta=1e-6):
    values = np.zeros((ROWS, COLS))

    while True:
        delta = 0
        for row in range(ROWS):
            for col in range(COLS):
                if (row, col) in TERMINAL_STATES:
                    continue

                state = (row, col)
                action_idx = policy[row, col]
                action = ACTIONS[action_idx]
                next_state = get_next_state(state, action)
                reward = -1

                old_value = values[row, col]
                values[row, col] = reward + GAMMA * values[next_state]
                delta = max(delta, abs(old_value - values[row, col]))

        if delta < theta:
            break

    return values


def policy_improvement(values):
    policy = np.zeros((ROWS, COLS), dtype=int)
    stable = True

    for row in range(ROWS):
        for col in range(COLS):
            if (row, col) in TERMINAL_STATES:
                continue

            state = (row, col)
            old_action = policy[row, col]
            action_values = []

            for action_idx, action in enumerate(ACTIONS):
                next_state = get_next_state(state, action)
                value = -1 + GAMMA * values[next_state]
                action_values.append(value)

            best_action = np.argmax(action_values)
            policy[row, col] = best_action

            if old_action != best_action:
                stable = False

    return policy, stable


def policy_iteration():
    policy = np.zeros((ROWS, COLS), dtype=int)

    iteration = 0
    while True:
        iteration += 1
        values = policy_evaluation(policy)
        policy, stable = policy_improvement(values)

        print(f"Iteration {iteration}:")
        print_policy(policy)
        print()

        if stable:
            break

    return policy, values


def print_policy(policy):
    symbols = ["^", "v", "<", ">"]
    for row in range(ROWS):
        row_str = ""
        for col in range(COLS):
            if (row, col) in TERMINAL_STATES:
                row_str += "  *  "
            else:
                row_str += f"  {symbols[policy[row, col]]}  "
        print(row_str)


optimal_policy, optimal_values = policy_iteration()
print("Optimal values:")
print(np.round(optimal_values, 1))
```

## Value Iteration: The Shortcut

Why alternate between evaluation and improvement? Just combine them:

```
  POLICY ITERATION:                VALUE ITERATION:

  Evaluate (many sweeps)           Update V AND pick best
  Improve (one sweep)              action in ONE sweep
  Evaluate (many sweeps)
  Improve (one sweep)              V(s) <-- max_a SUM_s' P(s'|s,a)
  ...                                       * [R + gamma * V(s')]

  Slow but clear                   Fast and practical
```

```python
def value_iteration(theta=1e-6):
    values = np.zeros((ROWS, COLS))

    iteration = 0
    while True:
        iteration += 1
        delta = 0

        for row in range(ROWS):
            for col in range(COLS):
                if (row, col) in TERMINAL_STATES:
                    continue

                state = (row, col)
                old_value = values[row, col]
                action_values = []

                for action in ACTIONS:
                    next_state = get_next_state(state, action)
                    value = -1 + GAMMA * values[next_state]
                    action_values.append(value)

                values[row, col] = max(action_values)
                delta = max(delta, abs(old_value - values[row, col]))

        if delta < theta:
            break

    policy = np.zeros((ROWS, COLS), dtype=int)
    for row in range(ROWS):
        for col in range(COLS):
            if (row, col) in TERMINAL_STATES:
                continue
            state = (row, col)
            action_values = []
            for action in ACTIONS:
                next_state = get_next_state(state, action)
                value = -1 + GAMMA * values[next_state]
                action_values.append(value)
            policy[row, col] = np.argmax(action_values)

    print(f"Value iteration converged in {iteration} iterations")
    return policy, values


vi_policy, vi_values = value_iteration()
print("\nOptimal policy (value iteration):")
print_policy(vi_policy)
print("\nOptimal values:")
print(np.round(vi_values, 1))
```

## Comparing the Two Methods

```
+--------------------+-------------------------+----------------------+
| Feature            | Policy Iteration        | Value Iteration      |
+--------------------+-------------------------+----------------------+
| Each iteration     | Full policy evaluation  | Single sweep of      |
|                    | (many sweeps) + one     | max operation        |
|                    | improvement step        |                      |
+--------------------+-------------------------+----------------------+
| Convergence speed  | Fewer outer iterations  | More iterations but  |
|                    | (each is expensive)     | each is cheap        |
+--------------------+-------------------------+----------------------+
| When to use        | Small state spaces      | Large state spaces   |
+--------------------+-------------------------+----------------------+
| Guarantee          | Finds optimal policy    | Finds optimal policy |
+--------------------+-------------------------+----------------------+
```

## Frozen Lake Example

A classic DP problem -- navigate an icy lake:

```
  S  F  F  F         S = Start
  F  H  F  H         F = Frozen (safe)
  F  F  F  H         H = Hole (fall in, episode ends)
  H  F  F  G         G = Goal (reward = 1)

  The ice is slippery! When you choose a direction,
  you have:
    1/3 chance of going where you intended
    1/3 chance of going left of intended
    1/3 chance of going right of intended
```

```python
import numpy as np

GRID_SIZE = 4
HOLES = [(1, 1), (1, 3), (2, 3), (3, 0)]
GOAL = (3, 3)
START = (0, 0)
ACTIONS = [(-1, 0), (1, 0), (0, -1), (0, 1)]
ACTION_NAMES = ["UP", "DOWN", "LEFT", "RIGHT"]

PERPENDICULAR = {
    0: [2, 3],
    1: [2, 3],
    2: [0, 1],
    3: [0, 1],
}


def is_terminal(state):
    return state in HOLES or state == GOAL


def get_next(state, action_idx):
    row, col = state
    dr, dc = ACTIONS[action_idx]
    nr = max(0, min(GRID_SIZE - 1, row + dr))
    nc = max(0, min(GRID_SIZE - 1, col + dc))
    return (nr, nc)


def get_transitions(state, action_idx):
    if is_terminal(state):
        return [(state, 1.0, 0.0)]

    results = []
    intended = get_next(state, action_idx)
    reward = 1.0 if intended == GOAL else 0.0
    results.append((intended, 1/3, reward))

    for perp in PERPENDICULAR[action_idx]:
        side = get_next(state, perp)
        side_reward = 1.0 if side == GOAL else 0.0
        results.append((side, 1/3, side_reward))

    return results


def solve_frozen_lake(gamma=0.99, theta=1e-8):
    values = np.zeros((GRID_SIZE, GRID_SIZE))

    while True:
        delta = 0
        for row in range(GRID_SIZE):
            for col in range(GRID_SIZE):
                state = (row, col)
                if is_terminal(state):
                    continue

                old_val = values[row, col]
                action_vals = []

                for a_idx in range(len(ACTIONS)):
                    val = 0
                    for next_s, prob, reward in get_transitions(state, a_idx):
                        val += prob * (reward + gamma * values[next_s])
                    action_vals.append(val)

                values[row, col] = max(action_vals)
                delta = max(delta, abs(old_val - values[row, col]))

        if delta < theta:
            break

    policy = np.zeros((GRID_SIZE, GRID_SIZE), dtype=int)
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            state = (row, col)
            if is_terminal(state):
                continue
            action_vals = []
            for a_idx in range(len(ACTIONS)):
                val = 0
                for next_s, prob, reward in get_transitions(state, a_idx):
                    val += prob * (reward + gamma * values[next_s])
                action_vals.append(val)
            policy[row, col] = np.argmax(action_vals)

    return policy, values


policy, values = solve_frozen_lake()
symbols = ["^", "v", "<", ">"]
print("Optimal policy for Frozen Lake:")
for row in range(GRID_SIZE):
    line = ""
    for col in range(GRID_SIZE):
        if (row, col) in HOLES:
            line += "  H  "
        elif (row, col) == GOAL:
            line += "  G  "
        else:
            line += f"  {symbols[policy[row, col]]}  "
    print(line)

print("\nState values:")
print(np.round(values, 3))
```

## Limitations of DP

```
  DP works great when:              DP falls apart when:
  +------------------------+        +----------------------------+
  | Small state space      |        | Millions of states         |
  | Known transitions      |        | Unknown environment        |
  | Known rewards          |        | Must learn from experience |
  | Discrete states/actions|        | Continuous spaces          |
  +------------------------+        +----------------------------+
         |                                    |
         v                                    v
    Grid worlds,                        Games, robotics,
    toy problems                        real-world RL
                                        --> Use MC, TD, DQN
```

## Exercises

1. **Policy evaluation by hand**: For a 3-state chain (s0 -> s1 -> s2)
   with reward -1 per step and gamma = 0.9, compute V(s0), V(s1), V(s2)
   using the always-go-right policy. Do 5 iterations by hand.

2. **Value iteration speed**: Count how many iterations value iteration
   takes to converge on the 4x4 grid. Try gamma = 0.5 vs gamma = 0.99.
   Which converges faster and why?

3. **Frozen lake variants**: Make the ice less slippery (80% intended
   direction, 10% each side). How does the optimal policy change?

4. **Code challenge**: Implement policy iteration for the Frozen Lake
   problem. Verify you get the same optimal policy as value iteration.

5. **Scaling thought experiment**: The 4x4 grid has 16 states. A 100x100
   grid has 10,000. How many states does a chess board have? (Hint: it's
   roughly 10^44.) Why does this make DP impractical for chess?

---

[Next: Monte Carlo Methods ->](05-monte-carlo-methods.md)
