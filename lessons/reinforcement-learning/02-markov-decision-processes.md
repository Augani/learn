# Lesson 2: Markov Decision Processes

## The Board Game Analogy

Think of a board game like Monopoly:

```
  +--------+    Roll dice    +--------+    Pay rent    +--------+
  | On GO  | -------------> | Park Pl | ------------> | Broke?  |
  | $1500  |                | Owe $35 |               | Check   |
  +--------+                +--------+                +--------+

  STATE:          ACTION:         TRANSITION:        REWARD:
  Your position   Roll, buy,      Where you land     Money gained
  + money +       trade, etc.     (probabilistic!)   or lost
  properties
```

The key insight: **where you land next depends only on where you are now and
what you roll** -- not on how you got there. This is the Markov Property.

## The Markov Property

```
  WITHOUT Markov Property:          WITH Markov Property:

  "To predict tomorrow's            "To predict tomorrow's
   weather, I need to know           weather, I just need
   the weather for the               TODAY's weather."
   last 30 days."

  Past ----> Future                  Present ----> Future
  (all of it matters)                (only now matters)
```

Formally: the future is independent of the past given the present.

```
P(s_{t+1} | s_t, a_t, s_{t-1}, a_{t-1}, ...) = P(s_{t+1} | s_t, a_t)
```

This simplification is what makes RL tractable.

## MDP: The Full Definition

An MDP is a tuple (S, A, P, R, gamma):

```
+------------------------------------------------------------------+
|                    MARKOV DECISION PROCESS                        |
+------------------------------------------------------------------+
|                                                                  |
|  S = {s1, s2, ...}          Set of all possible states           |
|                                                                  |
|  A = {a1, a2, ...}          Set of all possible actions          |
|                                                                  |
|  P(s'|s,a)                  Transition probability:              |
|                              probability of reaching s'          |
|                              from s by taking action a           |
|                                                                  |
|  R(s,a,s')                  Reward function:                     |
|                              reward for transitioning             |
|                              from s to s' via action a           |
|                                                                  |
|  gamma in [0, 1]            Discount factor:                     |
|                              how much we value future             |
|                              rewards vs immediate ones            |
|                                                                  |
+------------------------------------------------------------------+
```

## Visualizing Transitions

```
                       P=0.8
         +----------- action: GO_RIGHT ----------+
         |                                        |
         |             P=0.1                      v
  +------+------+  action: GO_RIGHT  -----> +----+-------+
  | State: LEFT |                           | State: MID  |
  | reward: 0   |  <----- P=0.1 ---------- | reward: 0   |
  +------+------+     action: GO_RIGHT      +----+--------+
                                                  |
                                                  | P=0.9
                                          action: GO_RIGHT
                                                  |
                                                  v
                                          +-------+------+
                                          | State: RIGHT |
                                          | reward: +1   |
                                          +--------------+
```

Notice: even when you choose GO_RIGHT, there's a chance you slip sideways.
This is what makes RL challenging -- **transitions are stochastic**.

## The Discount Factor (gamma)

Why discount future rewards? Same reason $100 today beats $100 next year.

```
  gamma = 0.9

  Reward now:        1.0  * 0.9^0  =  1.000
  Reward in 1 step:  1.0  * 0.9^1  =  0.900
  Reward in 2 steps: 1.0  * 0.9^2  =  0.810
  Reward in 5 steps: 1.0  * 0.9^5  =  0.590
  Reward in 10 steps:1.0  * 0.9^10 =  0.349

  +----+----+----+----+----+----+----+----+----+----+----+
  | t=0| t=1| t=2| t=3| t=4| t=5| t=6| t=7| t=8| t=9|t=10|
  +----+----+----+----+----+----+----+----+----+----+----+
  |####|### |### |##  |##  |##  |#   |#   |#   |#   |#   |
  |####|### |### |### |##  |##  |##  |#   |#   |#   |#   |
  |####|####|### |### |### |##  |##  |##  |#   |#   |#   |
  |####|####|####|### |### |### |##  |##  |##  |#   |#   |
  |####|####|####|####|### |### |### |##  |##  |##  |#   |
  +----+----+----+----+----+----+----+----+----+----+----+
        value of 1.0 received at each future timestep
```

```
gamma = 1.0  -->  "I care about ALL future rewards equally"
                   (can diverge -- dangerous!)

gamma = 0.0  -->  "I only care about the IMMEDIATE reward"
                   (totally greedy, no planning)

gamma = 0.9  -->  Sweet spot: care about the future, but not
                   too far out. Most common default.
```

## Return: The Total Discounted Reward

The **return** G_t is what the agent maximizes:

```
G_t = r_{t+1} + gamma * r_{t+2} + gamma^2 * r_{t+3} + ...

    = SUM_{k=0}^{inf} gamma^k * r_{t+k+1}
```

Example episode with gamma = 0.9:

```
  Step:     1      2      3      4 (terminal)
  Reward:  -1      0     -1     +10

  G_0 = -1 + 0.9*0 + 0.81*(-1) + 0.729*10
      = -1 + 0 + (-0.81) + 7.29
      = 5.48
```

## Building an MDP in Code

```python
import numpy as np

states = ["sunny", "cloudy", "rainy"]
actions = ["stay_in", "go_out"]

transitions = {
    ("sunny", "go_out"): [("sunny", 0.6), ("cloudy", 0.3), ("rainy", 0.1)],
    ("sunny", "stay_in"): [("sunny", 0.7), ("cloudy", 0.2), ("rainy", 0.1)],
    ("cloudy", "go_out"): [("sunny", 0.3), ("cloudy", 0.4), ("rainy", 0.3)],
    ("cloudy", "stay_in"): [("sunny", 0.2), ("cloudy", 0.5), ("rainy", 0.3)],
    ("rainy", "go_out"): [("sunny", 0.1), ("cloudy", 0.3), ("rainy", 0.6)],
    ("rainy", "stay_in"): [("sunny", 0.1), ("cloudy", 0.4), ("rainy", 0.5)],
}

rewards = {
    ("sunny", "go_out"): 2.0,
    ("sunny", "stay_in"): 1.0,
    ("cloudy", "go_out"): 0.5,
    ("cloudy", "stay_in"): 1.0,
    ("rainy", "go_out"): -1.0,
    ("rainy", "stay_in"): 0.5,
}

def simulate_episode(start_state, policy, num_steps, gamma=0.9):
    state = start_state
    total_return = 0.0
    discount = 1.0
    trajectory = []

    for step in range(num_steps):
        action = policy(state)
        reward = rewards[(state, action)]
        total_return += discount * reward
        discount *= gamma

        next_states = transitions[(state, action)]
        probs = [p for _, p in next_states]
        names = [s for s, _ in next_states]
        next_state = np.random.choice(names, p=probs)

        trajectory.append((state, action, reward))
        state = next_state

    return total_return, trajectory


def always_go_out(state):
    return "go_out"

def weather_aware(state):
    if state == "rainy":
        return "stay_in"
    return "go_out"


np.random.seed(42)
num_trials = 10000

returns_go_out = [simulate_episode("sunny", always_go_out, 10)[0] for _ in range(num_trials)]
returns_smart = [simulate_episode("sunny", weather_aware, 10)[0] for _ in range(num_trials)]

print(f"Always go out:  avg return = {np.mean(returns_go_out):.3f}")
print(f"Weather aware:  avg return = {np.mean(returns_smart):.3f}")
```

## Policies: The Agent's Strategy

A **policy** maps states to actions. It's the agent's complete strategy.

```
  DETERMINISTIC POLICY              STOCHASTIC POLICY
  pi(s) = a                         pi(a|s) = probability

  "In state s, always do a"         "In state s, do a with prob p"

  +-------+--------+                +-------+--------+------+
  | State | Action |                | State | Action | Prob |
  +-------+--------+                +-------+--------+------+
  | sunny | go_out |                | sunny | go_out | 0.8  |
  | cloudy| go_out |                | sunny | stay_in| 0.2  |
  | rainy | stay_in|                | cloudy| go_out | 0.5  |
  +-------+--------+                | cloudy| stay_in| 0.5  |
                                    | rainy | go_out | 0.1  |
                                    | rainy | stay_in| 0.9  |
                                    +-------+--------+------+
```

## State Representations

What counts as a "state"? It must capture everything needed to decide:

```
  CHESS:                    SELF-DRIVING CAR:         LLM CHATBOT:
  +--+--+--+--+--+--+--+   +-----------+             +-------------+
  |r |n |b |q |k |b |n |   | Speed     |             | Conversation|
  +--+--+--+--+--+--+--+   | Position  |             | history     |
  |p |p |p |p |p |p |p |   | Lane      |             | User query  |
  +--+--+--+--+--+--+--+   | Obstacles |             | Model state |
  |  |  |  |  |  |  |  |   | Traffic   |             +-------------+
  ...                       | signals   |
  Board position +          +-----------+             Token sequence
  whose turn +                                        + attention
  castling rights +                                   weights
  en passant
```

## Exercises

1. **Verify Markov**: For the weather MDP above, verify that each row of
   transition probabilities sums to 1.0. Why must this be true?

2. **Discount factor experiment**: Modify the simulation code to try
   gamma = 0.1, 0.5, 0.99. How does the average return change? Which
   gamma makes the agent most "short-sighted"?

3. **Design an MDP**: Model your morning routine as an MDP. Define:
   - States (in bed, showering, eating, commuting, at work)
   - Actions (snooze, get up, skip breakfast, etc.)
   - Transitions (snooze has 30% chance of falling back asleep)
   - Rewards (on time = +5, late = -3, skipped breakfast = -1)

4. **Markov violation**: Give an example where the Markov property doesn't
   hold. Hint: think about a game where the history of moves matters,
   not just the current position. How would you fix this by expanding
   the state?

5. **Code challenge**: Add a new state "stormy" to the weather MDP with
   appropriate transitions and rewards. Verify your transitions sum to 1.

---

[Next: Bellman Equations ->](03-bellman-equations.md)
