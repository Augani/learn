# Lesson 5: Monte Carlo Methods

## The Poker Analogy

You're learning poker. Nobody gives you the math -- you just play:

```
  Game 1: Bluffed with bad hand --> Lost $50
  Game 2: Played tight          --> Won $20
  Game 3: Bluffed with bad hand --> Lost $30
  Game 4: Played tight          --> Won $15
  Game 5: Bluffed with bad hand --> Won $100   (it worked once!)
  ...

  After 100 games:
  Avg return when bluffing:  -$12 per game
  Avg return when tight:     +$18 per game

  Conclusion: play tight (usually)
```

Monte Carlo (MC) methods learn exactly this way: **play complete episodes,
observe total returns, average them.**

## MC vs DP: The Key Difference

```
  DYNAMIC PROGRAMMING:              MONTE CARLO:

  "I know all the rules.            "I don't know the rules.
   Let me calculate the              Let me play 10,000 games
   optimal answer."                  and see what works."

  Needs: P(s'|s,a), R(s,a,s')      Needs: just experience
  Works: offline, in your head       Works: by trial and error
  Like: solving a maze on paper      Like: walking through a maze
```

## The MC Prediction Algorithm

Goal: estimate V(s) for a given policy by averaging observed returns.

```
  Episode 1:  s0 -> s1 -> s2 -> terminal    G(s0) = 5
  Episode 2:  s0 -> s1 -> s0 -> terminal    G(s0) = 3
  Episode 3:  s0 -> s2 -> terminal          G(s0) = 8

  V(s0) = average(5, 3, 8) = 5.33

  As episodes --> infinity, this converges to the true V^pi(s0)
```

## First-Visit vs Every-Visit

What if a state appears multiple times in one episode?

```
  Episode: s0 -> s1 -> s0 -> s1 -> s2 -> terminal
                              ^
                              s0 appears TWICE

  FIRST-VISIT MC:                    EVERY-VISIT MC:
  Only count the FIRST               Count EVERY time s0
  time s0 appears                    appears

  Use G from step 0 only             Use G from step 0 AND step 2

  Unbiased estimator                 Also unbiased, sometimes
  Standard choice                    converges faster
```

## MC Prediction Code

```python
import numpy as np
from collections import defaultdict

GRID_SIZE = 4
GOAL = (0, 3)
PIT = (1, 3)
WALL = (1, 1)
ACTIONS = [(0, 1), (0, -1), (1, 0), (-1, 0)]
ACTION_NAMES = ["RIGHT", "LEFT", "DOWN", "UP"]
GAMMA = 0.9


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


def generate_episode(policy):
    state = (2, 0)
    episode = []
    done = False
    steps = 0

    while not done and steps < 100:
        action = policy(state)
        next_state, reward, done = step(state, action)
        episode.append((state, action, reward))
        state = next_state
        steps += 1

    return episode


def random_policy(state):
    return np.random.randint(len(ACTIONS))


def first_visit_mc_prediction(policy, num_episodes=10000):
    returns = defaultdict(list)
    values = defaultdict(float)

    for ep in range(num_episodes):
        episode = generate_episode(policy)
        visited = set()
        g = 0

        for t in range(len(episode) - 1, -1, -1):
            state, action, reward = episode[t]
            g = reward + GAMMA * g

            if state not in visited:
                visited.add(state)
                returns[state].append(g)
                values[state] = np.mean(returns[state])

    return values


np.random.seed(42)
values = first_visit_mc_prediction(random_policy)

print("State values under random policy:")
for row in range(GRID_SIZE):
    line = ""
    for col in range(GRID_SIZE):
        state = (row, col)
        if state == WALL:
            line += " WALL  "
        elif state == GOAL:
            line += " GOAL  "
        elif state == PIT:
            line += "  PIT  "
        else:
            line += f"{values.get(state, 0):6.3f} "
    print(line)
```

## MC Control: Finding the Best Policy

MC prediction tells us how good a policy is. MC control finds the best one:

```
  +-------------------+        +-------------------+
  | Generate episodes |        | Improve policy    |
  | using current     | -----> | to be greedy w.r.t|
  | policy            |        | estimated Q-values|
  +-------------------+        +-------------------+
           ^                            |
           |                            |
           +------- repeat -------------+
```

The trick: we need **exploring starts** or **epsilon-greedy** to make sure
we try all state-action pairs.

```python
def mc_control_epsilon_greedy(num_episodes=50000, epsilon=0.1):
    q_values = defaultdict(lambda: np.zeros(len(ACTIONS)))
    returns_count = defaultdict(lambda: np.zeros(len(ACTIONS)))
    returns_sum = defaultdict(lambda: np.zeros(len(ACTIONS)))

    def epsilon_greedy_policy(state):
        if np.random.random() < epsilon:
            return np.random.randint(len(ACTIONS))
        return np.argmax(q_values[state])

    for ep in range(num_episodes):
        episode = generate_episode(epsilon_greedy_policy)
        visited_pairs = set()
        g = 0

        for t in range(len(episode) - 1, -1, -1):
            state, action, reward = episode[t]
            g = reward + GAMMA * g

            pair = (state, action)
            if pair not in visited_pairs:
                visited_pairs.add(pair)
                returns_sum[state][action] += g
                returns_count[state][action] += 1
                q_values[state][action] = (
                    returns_sum[state][action] / returns_count[state][action]
                )

    policy = {}
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            state = (row, col)
            if state != WALL:
                policy[state] = np.argmax(q_values[state])

    return policy, q_values


np.random.seed(42)
policy, q_vals = mc_control_epsilon_greedy()

print("\nLearned policy (MC Control):")
symbols = [">", "<", "v", "^"]
for row in range(GRID_SIZE):
    line = ""
    for col in range(GRID_SIZE):
        state = (row, col)
        if state == WALL:
            line += "  #  "
        elif state == GOAL:
            line += "  G  "
        elif state == PIT:
            line += "  X  "
        elif state in policy:
            line += f"  {symbols[policy[state]]}  "
        else:
            line += "  ?  "
    print(line)
```

## Incremental Mean Update

Instead of storing all returns, update incrementally:

```
  Storing all returns:           Incremental update:

  returns = [5, 3, 8, 2]        V(s) += (1/N) * (G - V(s))
  V(s) = mean(returns)
                                 Or with fixed learning rate:
  Memory: O(episodes)            V(s) += alpha * (G - V(s))
  Slow for many episodes
                                 Memory: O(1)
                                 Works with non-stationary
```

```
  The update rule V(s) += alpha * (G - V(s)) has a nice intuition:

  +--------+     error = G - V(s)     +---------+
  | V(s)   | -----------------------> | G       |
  | (old   |     "How wrong was I?"   | (actual |
  |  guess) |                         |  return)|
  +--------+                          +---------+

  New V(s) = Old V(s) + alpha * error

  If G > V(s): I underestimated, increase V
  If G < V(s): I overestimated, decrease V
  alpha controls how fast we update
```

## MC Strengths and Weaknesses

```
  STRENGTHS:                        WEAKNESSES:
  +---------------------------+     +---------------------------+
  | No model needed           |     | Must wait for episode end |
  | Simple to understand      |     | High variance             |
  | Works with black-box envs |     | Only for episodic tasks   |
  | Unbiased estimates        |     | Slow convergence          |
  | Can focus on important    |     | Needs many episodes       |
  |   states                  |     |                           |
  +---------------------------+     +---------------------------+
```

## Exercises

1. **First vs every visit**: Modify the MC prediction code to implement
   every-visit MC. Compare the convergence speed against first-visit by
   plotting the value of state (2,0) over episodes.

2. **Epsilon sensitivity**: Run MC control with epsilon = 0.01, 0.1, 0.3,
   and 0.5. Which finds the optimal policy fastest? Which explores too
   much or too little?

3. **Blackjack**: Implement a simple blackjack environment (player vs
   dealer, player can hit or stick). Use MC control to learn the optimal
   policy. Compare against basic strategy charts.

4. **Variance reduction**: Generate 1000 episodes and compute the standard
   deviation of returns from state (2,0). Now try 10,000 episodes. How
   does the variance of the mean estimate decrease?

5. **Conceptual**: Why can't MC methods work for continuing (non-episodic)
   tasks? What would G_t equal if the episode never ends?

---

[Next: Temporal Difference Learning ->](06-temporal-difference.md)
