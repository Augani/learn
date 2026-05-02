# RL Algorithm Comparison & Selection Guide

---

## Algorithm Categories

```
+---------------------+--------------------+-------------------------------+
| Category            | Algorithms         | Key Idea                      |
+---------------------+--------------------+-------------------------------+
| Dynamic Programming | Value Iteration,   | Full model of environment     |
|                     | Policy Iteration   | known. Compute optimal policy.|
+---------------------+--------------------+-------------------------------+
| Monte Carlo         | First-visit MC,    | Learn from complete episodes. |
|                     | Every-visit MC     | No model needed.              |
+---------------------+--------------------+-------------------------------+
| Temporal Difference | TD(0), TD(lambda)  | Learn from partial episodes.  |
|                     |                    | Bootstrap from estimates.     |
+---------------------+--------------------+-------------------------------+
| Value-Based         | Q-Learning, DQN,   | Learn Q(s,a), derive policy.  |
|                     | Double DQN, Dueling| Discrete actions.             |
+---------------------+--------------------+-------------------------------+
| Policy Gradient     | REINFORCE, PPO,    | Directly optimize the policy. |
|                     | TRPO, A2C, A3C     | Continuous or discrete.       |
+---------------------+--------------------+-------------------------------+
| Actor-Critic        | A2C, PPO, SAC,     | Actor (policy) + Critic       |
|                     | TD3, DDPG          | (value). Best of both worlds. |
+---------------------+--------------------+-------------------------------+
| Model-Based         | Dyna, MuZero,      | Learn environment model.      |
|                     | World Models,      | Plan using the model.         |
|                     | DreamerV3          |                               |
+---------------------+--------------------+-------------------------------+
| Bandit              | UCB, Thompson,     | No state transitions.         |
|                     | LinUCB, Exp3       | Explore vs exploit.           |
+---------------------+--------------------+-------------------------------+
```

---

## Detailed Algorithm Comparison

```
+---------------+--------+-----------+--------+---------+----------------+
| Algorithm     | Action | On/Off    | Sample | Stable? | Best For       |
|               | Space  | Policy    | Effic. |         |                |
+---------------+--------+-----------+--------+---------+----------------+
| Q-Learning    | Disc.  | Off       | Low    | Medium  | Simple, tabular|
+---------------+--------+-----------+--------+---------+----------------+
| DQN           | Disc.  | Off       | Medium | Medium  | Atari, discrete|
+---------------+--------+-----------+--------+---------+----------------+
| Double DQN    | Disc.  | Off       | Medium | Better  | Fix DQN overest|
+---------------+--------+-----------+--------+---------+----------------+
| Dueling DQN   | Disc.  | Off       | Medium | Better  | State-dependent|
|               |        |           |        |         | values         |
+---------------+--------+-----------+--------+---------+----------------+
| REINFORCE     | Both   | On        | Low    | Low     | Simple problems|
+---------------+--------+-----------+--------+---------+----------------+
| A2C           | Both   | On        | Low    | Medium  | Parallel envs  |
+---------------+--------+-----------+--------+---------+----------------+
| PPO           | Both   | On        | Medium | High    | DEFAULT CHOICE |
+---------------+--------+-----------+--------+---------+----------------+
| TRPO          | Both   | On        | Medium | High    | Theoretical    |
|               |        |           |        |         | guarantees     |
+---------------+--------+-----------+--------+---------+----------------+
| DDPG          | Cont.  | Off       | High   | Low     | Continuous ctrl|
+---------------+--------+-----------+--------+---------+----------------+
| TD3           | Cont.  | Off       | High   | Medium  | Fix DDPG issues|
+---------------+--------+-----------+--------+---------+----------------+
| SAC           | Cont.  | Off       | High   | High    | Continuous,    |
|               |        |           |        |         | exploration    |
+---------------+--------+-----------+--------+---------+----------------+
| MuZero        | Both   | Off       | High   | High    | Games, planning|
+---------------+--------+-----------+--------+---------+----------------+
| DreamerV3     | Both   | Off       | High   | High    | General, model |
|               |        |           |        |         | based          |
+---------------+--------+-----------+--------+---------+----------------+
```

---

## Selection Flowchart

```
  What's your action space?

  DISCRETE (finite choices):
  |
  +-- Small state space? (< 10K states)
  |   +-- YES --> Q-Learning (tabular)
  |   +-- NO  --> DQN (or PPO)
  |
  +-- Need sample efficiency?
      +-- YES --> DQN + replay buffer
      +-- NO  --> PPO (simpler, more stable)

  CONTINUOUS (real-valued):
  |
  +-- Need exploration?
  |   +-- YES --> SAC (maximum entropy)
  |
  +-- Need stability?
  |   +-- YES --> PPO (clip, on-policy)
  |
  +-- Need sample efficiency?
      +-- YES --> SAC or TD3 (off-policy, replay)
      +-- NO  --> PPO

  DON'T KNOW? --> Start with PPO.
  It works for discrete and continuous.
  It's stable and well-understood.
  It's the default choice for a reason.
```

---

## Hyperparameter Quick Reference

```
  PPO:
  +-------------------+------------------+
  | learning_rate     | 3e-4             |
  | clip_eps          | 0.2              |
  | gamma             | 0.99             |
  | lambda (GAE)      | 0.95             |
  | epochs            | 3-10             |
  | batch_size        | 32-2048          |
  | entropy_coef      | 0.01             |
  | value_coef        | 0.5              |
  +-------------------+------------------+

  DQN:
  +-------------------+------------------+
  | learning_rate     | 1e-4             |
  | epsilon_start     | 1.0              |
  | epsilon_end       | 0.01             |
  | epsilon_decay     | 100K steps       |
  | gamma             | 0.99             |
  | replay_size       | 100K-1M          |
  | batch_size        | 32               |
  | target_update     | every 1K steps   |
  +-------------------+------------------+

  SAC:
  +-------------------+------------------+
  | learning_rate     | 3e-4             |
  | gamma             | 0.99             |
  | tau (soft update) | 0.005            |
  | alpha (entropy)   | auto-tuned       |
  | replay_size       | 1M               |
  | batch_size        | 256              |
  +-------------------+------------------+
```

---

## Performance Benchmarks (Approximate)

```
  CARTPOLE-V1 (solve = avg reward > 475):
  +---------------+--------------------------+
  | Algorithm     | Timesteps to Solve       |
  +---------------+--------------------------+
  | DQN           | ~20K-50K                 |
  | PPO           | ~50K-100K                |
  | A2C           | ~50K-150K                |
  | REINFORCE     | ~200K-500K               |
  +---------------+--------------------------+

  HALFCHEETAH-V4 (continuous control):
  +---------------+--------------------------+
  | Algorithm     | 1M Step Performance      |
  +---------------+--------------------------+
  | SAC           | ~11000                   |
  | TD3           | ~10000                   |
  | PPO           | ~6000                    |
  | DDPG          | ~8000 (unstable)         |
  +---------------+--------------------------+
```
