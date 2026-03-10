# Lesson 3: Bellman Equations

## The Road Trip Analogy

You're planning a drive from New York to San Francisco and want to minimize
gas costs:

```
              $50          $40           $60
  New York ---------> Chicago -------> Denver --------> San Francisco
      |                  |                                    ^
      |     $80          |           $90                      |
      +---> Nashville ---+---------> Dallas -----> $30 -------+
              $70                      $50
```

Key insight: **The cost from Chicago = cost of Chicago-to-Denver + cost from
Denver onward.** You don't need to recalculate the entire trip -- just the
next step plus the remaining value. This is the Bellman equation.

## Value Function: How Good Is a State?

The **state-value function** V(s) answers: "How much total reward can I
expect starting from state s, following policy pi?"

```
  V^pi(s) = E[ G_t | S_t = s, following pi ]

  where G_t = r_{t+1} + gamma * r_{t+2} + gamma^2 * r_{t+3} + ...
```

Think of it as a "heat map" of the grid world:

```
  State values for optimal policy (gamma=0.9):

  +------+------+------+------+
  | 0.81 | 0.87 | 0.94 | 1.00 |  <-- Goal
  +------+------+------+------+
  | 0.75 | WALL | 0.66 |-1.00 |  <-- Pit
  +------+------+------+------+
  | 0.68 | 0.62 | 0.57 | 0.38 |
  +------+------+------+------+

  Higher value = better position to be in
  The values "flow" outward from the goal
```

## The Bellman Equation for V

The Bellman equation breaks the value into **immediate reward + discounted
future value**:

```
  V^pi(s) = SUM_a pi(a|s) * SUM_s' P(s'|s,a) * [ R(s,a,s') + gamma * V^pi(s') ]

  Unpacked:
  +------------------------------------------------------------------+
  |                                                                  |
  |  Value of    =  For each action    *  For each next state:       |
  |  state s        (weighted by          (weighted by transition    |
  |                  policy prob):         probability):              |
  |                                                                  |
  |                                       [ immediate   +  gamma *  |
  |                                         reward        future    |
  |                                                       value  ]  |
  +------------------------------------------------------------------+
```

Visually:

```
           pi(a|s)
  V(s) = ----+----
             |
         +---+---+
         |       |
         a1      a2
         |       |
     P(s'|s,a)   P(s'|s,a)
     +---+---+   +---+---+
     |       |   |       |
    s'1     s'2 s'3     s'4
     |       |   |       |
  R+gV(s'1) R+gV(s'2)  ...
```

## Q-Function: How Good Is an Action?

The **action-value function** Q(s,a) answers: "How much total reward can I
expect if I take action a in state s, then follow policy pi?"

```
  Q^pi(s,a) = SUM_s' P(s'|s,a) * [ R(s,a,s') + gamma * V^pi(s') ]

  Relationship:
  V^pi(s) = SUM_a pi(a|s) * Q^pi(s,a)

  Or for optimal policy:
  V*(s) = max_a Q*(s,a)
```

```
  Q-values for a grid cell:

       Q(s, UP) = 0.87
            ^
            |
  Q(s,LEFT) |  Q(s,RIGHT)
  = 0.75 <--+-->  = 0.94    <-- best action!
            |
            v
      Q(s, DOWN) = 0.62
```

## The Bellman Optimality Equations

The **optimal** value function satisfies:

```
  V*(s) = max_a SUM_s' P(s'|s,a) * [ R(s,a,s') + gamma * V*(s') ]

  Q*(s,a) = SUM_s' P(s'|s,a) * [ R(s,a,s') + gamma * max_a' Q*(s',a') ]
```

The optimal policy simply picks the action with the highest Q-value:

```
  pi*(s) = argmax_a Q*(s,a)
```

## Computing Value Functions

```python
import numpy as np

GAMMA = 0.9
STATES = ["s0", "s1", "s2", "terminal"]
ACTIONS = ["left", "right"]

TRANSITIONS = {
    ("s0", "right"): [("s1", 1.0)],
    ("s0", "left"):  [("s0", 1.0)],
    ("s1", "right"): [("s2", 0.8), ("s0", 0.2)],
    ("s1", "left"):  [("s0", 1.0)],
    ("s2", "right"): [("terminal", 1.0)],
    ("s2", "left"):  [("s1", 1.0)],
}

REWARDS = {
    ("s0", "right", "s1"): 0,
    ("s0", "left", "s0"): 0,
    ("s1", "right", "s2"): 0,
    ("s1", "right", "s0"): 0,
    ("s1", "left", "s0"): 0,
    ("s2", "right", "terminal"): 10,
    ("s2", "left", "s1"): 0,
}

POLICY = {
    "s0": "right",
    "s1": "right",
    "s2": "right",
}


def evaluate_policy(policy, num_iterations=100):
    values = {s: 0.0 for s in STATES}

    for iteration in range(num_iterations):
        new_values = {s: 0.0 for s in STATES}

        for state in ["s0", "s1", "s2"]:
            action = policy[state]
            value = 0.0

            for next_state, prob in TRANSITIONS[(state, action)]:
                reward = REWARDS.get((state, action, next_state), 0)
                value += prob * (reward + GAMMA * values[next_state])

            new_values[state] = value

        values = new_values

    return values


values = evaluate_policy(POLICY)
print("State values under always-right policy:")
for state in ["s0", "s1", "s2"]:
    print(f"  V({state}) = {values[state]:.3f}")
```

## Q-Values from V-Values

```python
def compute_q_values(values):
    q_values = {}

    for state in ["s0", "s1", "s2"]:
        for action in ACTIONS:
            key = (state, action)
            if key not in TRANSITIONS:
                continue

            q_val = 0.0
            for next_state, prob in TRANSITIONS[key]:
                reward = REWARDS.get((state, action, next_state), 0)
                q_val += prob * (reward + GAMMA * values[next_state])
            q_values[key] = q_val

    return q_values


q_vals = compute_q_values(values)
print("\nQ-values:")
for (state, action), q in sorted(q_vals.items()):
    print(f"  Q({state}, {action:>5}) = {q:.3f}")

print("\nOptimal actions:")
for state in ["s0", "s1", "s2"]:
    state_qs = {a: q_vals[(state, a)] for a in ACTIONS if (state, a) in q_vals}
    best_action = max(state_qs, key=state_qs.get)
    print(f"  {state}: {best_action} (Q = {state_qs[best_action]:.3f})")
```

## Backup Diagrams

RL textbooks use "backup diagrams" to visualize Bellman equations:

```
  STATE-VALUE BACKUP:           ACTION-VALUE BACKUP:

       V(s)                          Q(s,a)
      / | \                           |
     /  |  \  (actions, pi)       (next states, P)
    /   |   \                    /    |    \
  Q(s,a1) Q(s,a2) ...        (s'1) (s'2) (s'3)
    |       |                   |     |     |
  (next states, P)           R+gV  R+gV  R+gV
  / \     / \
s'  s'   s'  s'
|    |   |    |
R+gV R+gV R+gV R+gV

  Circles = states     Dots = actions
  Arrows = transitions
```

## Why Bellman Equations Matter

```
  +-------------------------------------------+
  | Without Bellman:                           |
  | "Simulate a million episodes and average"  |
  | O(very slow)                               |
  +-------------------------------------------+
             |
             v
  +-------------------------------------------+
  | With Bellman:                              |
  | "Solve a system of equations"              |
  | Value of each state depends on neighbors   |
  | Iterative methods converge fast            |
  +-------------------------------------------+
```

Every RL algorithm you'll learn is, at its core, trying to solve or
approximate the Bellman equations.

## Exercises

1. **Hand calculation**: For the chain s0 -> s1 -> s2 -> terminal with
   reward +10 at the end and gamma = 0.9, compute V(s0), V(s1), V(s2)
   by hand. Verify against the code.

2. **Q-value intuition**: In the grid world from Lesson 1, if V(goal) = 1
   and gamma = 0.9, what is Q(adjacent_cell, move_toward_goal)? Assume
   deterministic transitions.

3. **Code challenge**: Modify the code to find the optimal policy using
   the Bellman optimality equation. Hint: instead of using a fixed policy,
   at each state pick the action with the highest Q-value.

4. **Discount factor**: Rerun the value computation with gamma = 0.1 and
   gamma = 0.99. How do the values change? When gamma is small, does
   the agent care about the +10 reward at the end?

5. **Conceptual**: Why can't we directly solve V*(s) = max_a [...] as a
   system of linear equations? What makes this harder than the policy
   evaluation version? (Hint: the max operator)

---

[Next: Dynamic Programming ->](04-dynamic-programming.md)
