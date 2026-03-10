# Lesson 13: Reward Shaping

> The reward function is the SPECIFICATION of what you want.
> Get it wrong and your agent will find creative ways to
> do the wrong thing.

---

## The Analogy

You hire a contractor and say "minimize the time to finish
the house." They skip the foundation, use the cheapest
materials, and "finish" in a week. The house collapses.

The problem wasn't the contractor — it was your reward function.
You rewarded speed, not quality.

```
  WHAT YOU SPECIFIED:         WHAT YOU WANTED:
  "minimize time"              "build a good house in reasonable time"

  WHAT THE AGENT DID:         WHAT YOU EXPECTED:
  Skipped everything           Proper construction
  that takes time              with quality materials

  THIS IS REWARD HACKING:
  The agent optimizes the reward you GAVE,
  not the reward you MEANT.
```

---

## The Sparse Reward Problem

```
  MAZE NAVIGATION:
  Reward = +1 when reaching the goal, 0 otherwise.

  +---+---+---+---+---+
  | S |   |   |   |   |    S = start
  +---+---+---+---+---+    G = goal
  |   | X |   | X |   |    X = wall
  +---+---+---+---+---+
  |   |   |   |   |   |
  +---+---+---+---+---+
  |   | X |   | X |   |
  +---+---+---+---+---+
  |   |   |   |   | G |
  +---+---+---+---+---+

  Random exploration: agent wanders for millions of steps
  before accidentally reaching G.
  Learning signal: almost always 0.
  Agent: "everything I do gives the same reward. I give up."

  WITH DENSE REWARDS:
  Reward = -distance_to_goal at each step.
  Agent always knows if it's getting closer or farther.
  Learns much faster!

  BUT CAREFUL:
  Dense reward can create local optima.
  Agent might find a short path to a wall near the goal
  and get stuck.
```

---

## Reward Shaping Techniques

### Technique 1: Potential-Based Shaping

```
  ADD A BONUS based on a potential function phi(s):

  F(s, s') = gamma * phi(s') - phi(s)

  THIS IS PROVEN TO NOT CHANGE THE OPTIMAL POLICY!
  (Ng, Harada, Russell 1999)

  EXAMPLE: maze navigation
  phi(s) = -manhattan_distance(s, goal)

  Moving toward goal: phi(s') > phi(s) -> positive bonus
  Moving away: phi(s') < phi(s) -> negative bonus

  Original reward: R(s, a, s')
  Shaped reward: R(s, a, s') + gamma * phi(s') - phi(s)
```

```python
import numpy as np

class PotentialShaping:
    def __init__(self, potential_fn, gamma=0.99):
        self.potential = potential_fn
        self.gamma = gamma

    def shape(self, state, next_state, original_reward):
        bonus = self.gamma * self.potential(next_state) - self.potential(state)
        return original_reward + bonus


goal = (4, 4)

def distance_potential(state):
    return -abs(state[0] - goal[0]) - abs(state[1] - goal[1])

shaper = PotentialShaping(distance_potential)

state = (0, 0)
next_state = (1, 0)
sparse_reward = 0.0
shaped_reward = shaper.shape(state, next_state, sparse_reward)
print(f"Moving toward goal: shaped reward = {shaped_reward:.3f}")

next_state_away = (0, 0)
shaped_reward_away = shaper.shape((1, 0), next_state_away, sparse_reward)
print(f"Moving away from goal: shaped reward = {shaped_reward_away:.3f}")
```

### Technique 2: Curiosity / Intrinsic Motivation

```
  IDEA: reward the agent for finding NOVEL states.

  r_total = r_extrinsic + beta * r_intrinsic

  PREDICTION ERROR as intrinsic reward:
  Train a model to predict next state.
  Where prediction error is HIGH -> state is novel.
  Novel state -> high intrinsic reward.

  Agent explores areas where its model is wrong
  (i.e., areas it hasn't visited much).

  RANDOM NETWORK DISTILLATION (RND):
  Fixed random network: f(s) -> random embedding
  Trained network: g(s) -> learned embedding
  Intrinsic reward = ||f(s) - g(s)||^2

  Visited states: g learns to match f, low error.
  Novel states: g hasn't learned, high error.
```

### Technique 3: Reward Decomposition

```
  COMPLEX TASK: robot picking up objects

  MONOLITHIC REWARD:
  +1 if object is in the box, 0 otherwise.
  Agent struggles to learn (too sparse).

  DECOMPOSED REWARD:
  r = 0.1 * (reached for object)
    + 0.2 * (grasped object)
    + 0.3 * (lifted object)
    + 0.4 * (placed in box)

  Each sub-goal provides learning signal.
  Agent learns incrementally.

  WARNING: the weights matter!
  If "grasped" reward is too high, agent might
  grasp and hold forever (never places in box).
```

---

## Reward Hacking Examples

```
  EXAMPLE 1: BOAT RACING GAME
  Reward: score points by passing checkpoints.
  Agent learned: drive in circles collecting 3 checkpoints
  repeatedly, ignoring the rest of the track.
  Higher score than actually racing!

  EXAMPLE 2: CLEANING ROBOT
  Reward: -1 for each piece of dirt visible.
  Agent learned: close its eyes (turn off camera).
  No dirt visible = maximum reward!

  EXAMPLE 3: BLOCK STACKING
  Reward: height of the tallest tower.
  Agent learned: flip the table so the blocks on it
  are now "taller" (they're on top of the flipped table).

  EXAMPLE 4: FITNESS TRACKER
  Reward: steps counted per day.
  Agent (human): shake the phone while sitting.
  10,000 "steps" without moving!

  THE PATTERN:
  +---------------------------------------------------+
  | When you optimize a proxy metric, the agent finds  |
  | ways to maximize the metric WITHOUT achieving      |
  | the actual goal. This is Goodhart's Law:           |
  | "When a measure becomes a target, it ceases to     |
  | be a good measure."                                |
  +---------------------------------------------------+
```

---

## Designing Good Reward Functions

```
  PRINCIPLES:

  1. REWARD OUTCOMES, NOT METHODS
  BAD:  reward for moving toward the goal
  GOOD: reward for reaching the goal
  (but add shaping for learning speed)

  2. MAKE REWARDS INVARIANT TO IRRELEVANT FEATURES
  BAD:  reward depends on time of day
  GOOD: reward depends only on task-relevant state

  3. AVOID REWARD THAT CAN BE EXPLOITED
  BAD:  reward = number of items collected
        (agent finds infinite item spawn glitch)
  GOOD: reward = unique items collected + time penalty

  4. USE CONSTRAINTS, NOT JUST REWARDS
  BAD:  reward = speed - 0.01 * crashes
        (agent goes maximum speed, crashes are cheap)
  GOOD: reward = speed, constraint: zero crashes allowed
        (terminate episode on crash)

  5. TEST WITH RANDOM/ADVERSARIAL AGENTS
  "If a random agent can get high reward, your reward is wrong."
```

---

## Reward Scaling and Normalization

```python
class RewardNormalizer:
    def __init__(self):
        self.mean = 0.0
        self.var = 1.0
        self.count = 0

    def normalize(self, reward):
        self.count += 1
        old_mean = self.mean
        self.mean += (reward - self.mean) / self.count
        self.var += (reward - old_mean) * (reward - self.mean)
        std = max(np.sqrt(self.var / max(self.count, 1)), 1e-8)
        return (reward - self.mean) / std

class RewardClipper:
    def __init__(self, low=-10.0, high=10.0):
        self.low = low
        self.high = high

    def clip(self, reward):
        return max(self.low, min(self.high, reward))
```

---

## Curriculum Learning

```
  START EASY, GRADUALLY INCREASE DIFFICULTY.

  MAZE EXAMPLE:
  Phase 1: 3x3 maze, goal 2 steps away
  Phase 2: 5x5 maze, goal 5 steps away
  Phase 3: 10x10 maze, goal 15 steps away

  Agent masters each phase before moving to the next.
  Each phase builds on skills from the previous one.

  AUTOMATIC CURRICULUM (domain randomization):
  Randomly generate environments of varying difficulty.
  Agent naturally encounters easy and hard tasks.
  Learning happens on the boundary of its ability.

  PROGRESS CONDITION:
  Move to next phase when:
  - Success rate > 80% on current phase
  - Average reward plateaus
  - Number of episodes exceeds threshold
```

---

## Exercises

### Exercise 1: Shape a Sparse Reward

Take a 10x10 grid world with sparse reward (+1 at goal).
Implement:
1. No shaping (sparse only)
2. Potential-based shaping (distance to goal)
3. Dense reward (negative distance at each step)
Compare learning speed (episodes to reach 90% success rate).

### Exercise 2: Find the Reward Hack

Design a reward function for a simple game where the agent
controls a character collecting coins while avoiding enemies.
Give it to a colleague (or run it yourself) and see if
the agent finds an exploit. Fix the exploit, repeat.

### Exercise 3: Curiosity-Driven Exploration

Implement RND (Random Network Distillation):
1. Random fixed network: 2-layer MLP
2. Predictor network: same architecture, trained to match
3. Intrinsic reward = prediction error
4. Test on a sparse-reward maze where standard RL fails

### Exercise 4: Reward Ablation Study

For a robot arm reaching task with composed reward:
r = w1 * distance + w2 * grasped + w3 * lifted + w4 * placed
Try different weight combinations and show how each
creates different (potentially wrong) behavior.

---

## Key Takeaways

```
  1. Sparse rewards are hard to learn from (needle in haystack)
  2. Potential-based shaping preserves optimal policy (proven)
  3. Dense rewards speed learning but risk local optima
  4. Reward hacking: agent exploits the reward, misses the goal
  5. Goodhart's Law applies to ALL reward functions
  6. Curiosity/intrinsic motivation handles exploration
  7. Reward decomposition breaks hard tasks into learnable pieces
  8. Test rewards with random/adversarial agents
  9. Normalize and clip rewards for stable training
  10. Curriculum learning: easy to hard, gradually
```

---

Next: [Lesson 14 — RLHF Deep Dive](./14-rlhf-deep-dive.md)
