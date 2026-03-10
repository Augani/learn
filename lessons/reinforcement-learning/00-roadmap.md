# Reinforcement Learning Track

## Overview

This track takes you from zero to building RL agents that learn from experience.
You'll understand every major algorithm family and build toward RLHF -- the
technique that makes modern LLMs helpful and safe.

```
  YOU ARE HERE
      |
      v
+-----+------+     +-------+     +---------+     +---------+
| Foundations | --> | Tabular | --> | Deep RL | --> | Applied |
+-----+------+     +-------+     +---------+     +---------+
      |                |               |               |
  01-03            04-07           08-11           12-16
  What is RL?      DP, MC,        DQN, Policy    Bandits,
  MDPs,            TD, Q-Learn    Gradients,     RLHF,
  Bellman                         Actor-Critic,  Real World,
                                  PPO            Capstone
```

## Prerequisites

- Python basics (functions, classes, loops)
- NumPy fundamentals
- Basic probability (what's an expected value?)
- ML Fundamentals track recommended (but not required)

## Lessons

| # | Lesson | Key Concept |
|---|--------|-------------|
| 01 | [What is RL?](01-what-is-rl.md) | Agent, environment, reward |
| 02 | [Markov Decision Processes](02-markov-decision-processes.md) | States, actions, transitions |
| 03 | [Bellman Equations](03-bellman-equations.md) | Value functions, Q-values |
| 04 | [Dynamic Programming](04-dynamic-programming.md) | Policy & value iteration |
| 05 | [Monte Carlo Methods](05-monte-carlo-methods.md) | Learning from episodes |
| 06 | [Temporal Difference](06-temporal-difference.md) | TD(0), SARSA |
| 07 | [Q-Learning](07-q-learning.md) | Off-policy, epsilon-greedy |
| 08 | [Deep Q-Networks](08-deep-q-networks.md) | DQN, experience replay |
| 09 | [Policy Gradients](09-policy-gradients.md) | REINFORCE algorithm |
| 10 | [Actor-Critic](10-actor-critic.md) | A2C, advantage function |
| 11 | [PPO](11-ppo.md) | Clipped objective, RLHF backbone |
| 12 | [Multi-Armed Bandits](12-multi-armed-bandits.md) | UCB, Thompson sampling |
| 13 | [Reward Shaping](13-reward-shaping.md) | Reward design, reward hacking |
| 14 | [RLHF Deep Dive](14-rlhf-deep-dive.md) | Reward models, KL penalty |
| 15 | [Real-World RL](15-real-world-rl.md) | Robotics, games, recommenders |
| 16 | [Build an RL Agent](16-build-rl-agent.md) | Capstone project |

## Reference

- [Algorithm Comparison](reference-algorithms.md) - When to use what
- [Glossary](reference-glossary.md) - All RL terminology

## How to Use This Track

```
  +------------------+
  | Read the lesson  |
  +--------+---------+
           |
           v
  +------------------+
  | Study the ASCII  |
  | diagrams         |
  +--------+---------+
           |
           v
  +------------------+
  | Run the code     |<---+
  | examples         |    |
  +--------+---------+    |
           |              |
           v              |
  +------------------+    |
  | Do the exercises |    |
  +--------+---------+    |
           |              |
           v              |
  +------------------+    |
  | Stuck? Re-read   +----+
  +------------------+
```

Each lesson builds on the previous one. The code examples are runnable --
copy them into a Python file or Jupyter notebook and experiment.

## Time Estimate

- **Quick pass**: 8-10 hours (read + run examples)
- **Deep dive**: 20-25 hours (read + exercises + capstone)
- **Mastery**: 40+ hours (all above + modify examples + extra projects)

---

[Start the track: What is RL? ->](01-what-is-rl.md)
