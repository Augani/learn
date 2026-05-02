# Lesson 6: Temporal Difference Learning

## The GPS Analogy

You're driving from LA to Vegas. Your GPS updates your ETA as you drive:

```
  At home:    "ETA: 4 hours"     (initial estimate)
  Highway on: "ETA: 3.5 hours"   (updated: traffic is light!)
  Barstow:    "ETA: 2 hours"     (updated: halfway there)
  Traffic:    "ETA: 2.5 hours"   (updated: construction zone)
  Arrive:     "Actual: 3.8 hrs"

  GPS updates estimate at EVERY step, not just at the end.
  It uses the NEW estimate to correct the OLD estimate.
  This is bootstrapping -- the core idea of TD learning.
```

## MC vs TD: The Key Difference

```
  MONTE CARLO:                     TEMPORAL DIFFERENCE:

  Wait until episode ends          Update after EVERY step
  Use actual return G              Use estimated return r + gamma*V(s')

  V(s) += alpha * (G - V(s))      V(s) += alpha * (r + gamma*V(s') - V(s))
                   ^                                 ^^^^^^^^^^^^^^^^^
                   |                                 |
              actual total                      "TD target"
              (must wait)                       (estimate, available now)

  +------+------+------+------+    +------+------+------+------+
  | s0   | s1   | s2   | GOAL |    | s0   | s1   | s2   | GOAL |
  +------+------+------+------+    +------+------+------+------+
  Wait for GOAL, then              Update s0 immediately using
  update ALL states at once        estimate of s1
```

## TD(0): The Simplest TD Method

```
  TD ERROR (delta):

  delta = r + gamma * V(s') - V(s)
          |                   |
          +-- TD target --+   +-- current estimate
                          |
          "What I got +   |
           what I think   |
           is coming"     |

  UPDATE:
  V(s) += alpha * delta

  If delta > 0: reality was better than expected, increase V(s)
  If delta < 0: reality was worse than expected, decrease V(s)
```

## TD Prediction Code

```python
import numpy as np
from collections import defaultdict

GRID_SIZE = 4
GOAL = (0, 3)
PIT = (1, 3)
WALL = (1, 1)
ACTIONS = [(0, 1), (0, -1), (1, 0), (-1, 0)]
GAMMA = 0.9
ALPHA = 0.1


def step(state, action_idx):
    row, col = state
    dr, dc = ACTIONS[action_idx]
    nr = max(0, min(GRID_SIZE - 1, row + dr))
    nc = max(0, min(GRID_SIZE - 1, col + dc))

    if (nr, nc) == WALL:
        nr, nc = row, col

    next_state = (nr, nc)
    if next_state == GOAL:
        return next_state, 1.0, True
    elif next_state == PIT:
        return next_state, -1.0, True
    return next_state, -0.04, False


def td_prediction(num_episodes=10000):
    values = defaultdict(float)

    for ep in range(num_episodes):
        state = (2, 0)
        done = False
        steps = 0

        while not done and steps < 100:
            action = np.random.randint(len(ACTIONS))
            next_state, reward, done = step(state, action)

            td_target = reward + GAMMA * values[next_state] * (1 - done)
            td_error = td_target - values[state]
            values[state] += ALPHA * td_error

            state = next_state
            steps += 1

    return values


np.random.seed(42)
values = td_prediction()

print("TD(0) state values (random policy):")
for row in range(GRID_SIZE):
    line = ""
    for col in range(GRID_SIZE):
        s = (row, col)
        if s == WALL:
            line += " WALL  "
        elif s == GOAL:
            line += " GOAL  "
        elif s == PIT:
            line += "  PIT  "
        else:
            line += f"{values[s]:6.3f} "
    print(line)
```

## SARSA: TD Control (On-Policy)

SARSA stands for: **S**tate, **A**ction, **R**eward, **S**tate, **A**ction

```
  At time t:     (S_t, A_t)  -->  R_{t+1}, S_{t+1}  --> choose A_{t+1}
                   ^    ^           ^        ^                 ^
                   S    A           R        S                 A
                   |    |           |        |                 |
                   +----+-----------+--------+-----------------+
                              S  A  R  S  A  =  SARSA

  Update:
  Q(S,A) += alpha * (R + gamma * Q(S',A') - Q(S,A))
                                    ^
                                    |
                           Uses the action A' that the
                           policy ACTUALLY chose (on-policy)
```

```python
def sarsa(num_episodes=20000, epsilon=0.1):
    q_values = defaultdict(lambda: np.zeros(len(ACTIONS)))

    def epsilon_greedy(state):
        if np.random.random() < epsilon:
            return np.random.randint(len(ACTIONS))
        return np.argmax(q_values[state])

    episode_rewards = []

    for ep in range(num_episodes):
        state = (2, 0)
        action = epsilon_greedy(state)
        done = False
        total_reward = 0
        steps = 0

        while not done and steps < 100:
            next_state, reward, done = step(state, action)
            total_reward += reward

            next_action = epsilon_greedy(next_state)

            td_target = reward + GAMMA * q_values[next_state][next_action] * (1 - done)
            td_error = td_target - q_values[state][action]
            q_values[state][action] += ALPHA * td_error

            state = next_state
            action = next_action
            steps += 1

        episode_rewards.append(total_reward)

    return q_values, episode_rewards


np.random.seed(42)
q_vals, rewards = sarsa()

symbols = [">", "<", "v", "^"]
print("SARSA learned policy:")
for row in range(GRID_SIZE):
    line = ""
    for col in range(GRID_SIZE):
        s = (row, col)
        if s == WALL:
            line += "  #  "
        elif s == GOAL:
            line += "  G  "
        elif s == PIT:
            line += "  X  "
        else:
            line += f"  {symbols[np.argmax(q_vals[s])]}  "
    print(line)
```

## On-Policy vs Off-Policy

```
  ON-POLICY (SARSA):                OFF-POLICY (Q-Learning):

  "I learn from what I              "I learn the BEST policy
   actually DO"                      even while exploring"

  Q(s,a) += alpha *                 Q(s,a) += alpha *
    (r + gamma*Q(s',a') - Q(s,a))    (r + gamma*max_a'Q(s',a') - Q(s,a))
                  ^                                  ^^^^^^^
                  |                                  |
           action I took                     best possible action
           (might be random)                 (regardless of what I did)

  Safer: avoids cliffs               Bolder: finds optimal path
  because it accounts for            but might fall off cliffs
  its own exploration                during training
```

## The Cliff Walking Example

```
  +---+---+---+---+---+---+---+---+---+---+---+---+
  |   |   |   |   |   |   |   |   |   |   |   |   |
  +---+---+---+---+---+---+---+---+---+---+---+---+
  |   |   |   |   |   |   |   |   |   |   |   |   |
  +---+---+---+---+---+---+---+---+---+---+---+---+
  |   |   |   |   |   |   |   |   |   |   |   |   |
  +---+---+---+---+---+---+---+---+---+---+---+---+
  | S | C | C | C | C | C | C | C | C | C | C | G |
  +---+---+---+---+---+---+---+---+---+---+---+---+

  S = Start, G = Goal, C = Cliff (reward = -100, reset to S)
  Normal step reward = -1

  SARSA (on-policy):     Takes the SAFE path (top row)
                         because it knows it will sometimes
                         randomly step into the cliff

  Q-Learning (off-policy): Takes the OPTIMAL path (bottom row)
                           which is right next to the cliff --
                           risky during training but optimal
                           for a deterministic policy
```

## Bootstrapping: The Big Idea

```
  TD methods use ESTIMATES to update ESTIMATES.
  This is called "bootstrapping."

  Without bootstrapping (MC):        With bootstrapping (TD):

  Must experience                    Can update immediately
  s0 -> s1 -> ... -> terminal       s0 -> s1 is enough!
  THEN update                        Update V(s0) using V(s1)

  +--------+                         +--------+
  |Complete|                         |One step|
  |episode |                         |is      |
  |needed  |                         |enough  |
  +--------+                         +--------+

  Advantage: unbiased                Advantage: low variance,
  Disadvantage: high variance,       fast learning, works for
  must wait for episode end          continuing tasks
                                     Disadvantage: biased
                                     (using estimate of V(s'))
```

## TD vs MC vs DP: The Spectrum

```
  NEEDS MODEL?          BOOTSTRAPS?       SAMPLES?

  DP:    YES             YES               NO (full sweep)
  MC:    NO              NO                YES (episodes)
  TD:    NO              YES               YES (one step)

  +----------------------------------------------------+
  |                                                    |
  |          DP                                        |
  |          (model-based,                             |
  |           bootstrapping,                           |
  |           full backup)                             |
  |              |                                     |
  |         +----+----+                                |
  |         |         |                                |
  |        TD         MC                               |
  |   (model-free,  (model-free,                       |
  |    bootstrap,    no bootstrap,                     |
  |    sample)       sample)                           |
  |                                                    |
  +----------------------------------------------------+

  TD = "best of both worlds" for many practical problems
```

## Exercises

1. **TD vs MC convergence**: Run both TD prediction and MC prediction
   (from Lesson 5) for 100, 1000, and 10000 episodes. Compare the
   estimated values. Which converges faster?

2. **Alpha sensitivity**: Run TD(0) with alpha = 0.01, 0.1, 0.5, 0.9.
   Which learns fastest? Which is most stable? What happens with
   alpha = 1.0?

3. **Cliff walking**: Implement the cliff walking environment and compare
   SARSA vs Q-learning policies. Plot the cumulative reward per episode
   for both. You should see SARSA's safe path vs Q-learning's optimal
   but risky path.

4. **TD error analysis**: Print the TD error for the first 100 steps of
   learning. How does the error magnitude change over time? What does
   it mean when TD errors are consistently near zero?

5. **Conceptual**: TD uses V(s') to estimate the return, but V(s') is also
   an estimate that might be wrong. Why doesn't this cause TD to diverge
   to completely wrong values? (Hint: think about what happens as the
   agent visits states repeatedly)

---

[Next: Q-Learning ->](07-q-learning.md)
