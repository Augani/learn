# Lesson 10: Actor-Critic Methods

> Combine the best of value methods and policy methods.
> The actor decides what to do. The critic says how good it was.

---

## The Analogy

A comedian (actor) performs on stage. A coach (critic)
sits in the audience and gives feedback: "that joke killed"
or "that fell flat." The comedian adjusts their routine
based on the coach's feedback.

The actor doesn't need to figure out how good each joke was
by themselves — the critic provides a running evaluation.

```
  POLICY GRADIENT (no critic):
  Actor: "I told joke A, got 5 laughs total tonight"
  Problem: was joke A good, or was the audience just easy?
  HIGH VARIANCE in the feedback signal.

  ACTOR-CRITIC:
  Actor: "I told joke A"
  Critic: "Joke A got 3 laughs, but the audience averages 2.
           So joke A was +1 above average."
  LOWER VARIANCE because critic provides a baseline.

  +-------+                    +--------+
  | Actor |  action a_t        | Environ|
  | pi(a|s| -----------------> | ment   |
  | theta)|                    |        |
  +---+---+                    +---+----+
      ^                            |
      | policy gradient            | s_{t+1}, r_t
      | (adjusted by critic)       |
      |                            v
  +---+---+                    +--------+
  | Critic|  "advantage = +1"  | State  |
  | V(s;w)|  <----- TD error   | s_t    |
  +-------+                    +--------+
```

---

## The Advantage Function

```
  THE KEY INSIGHT: we don't care about absolute return.
  We care about HOW MUCH BETTER an action is than average.

  ADVANTAGE:
  A(s, a) = Q(s, a) - V(s)

  Q(s, a) = expected return if we take action a in state s
  V(s)    = expected return from state s (following policy)

  A(s, a) > 0: action a is BETTER than average
  A(s, a) < 0: action a is WORSE than average
  A(s, a) = 0: action a is exactly average

  WHY THIS HELPS:

  REINFORCE gradient: nabla J = E[log pi(a|s) * G_t]
  G_t has high variance (depends on entire future trajectory)

  Actor-Critic gradient: nabla J = E[log pi(a|s) * A(s,a)]
  A(s,a) has lower variance (critic estimates the baseline)

  Same expected gradient, much less noise!
```

---

## How Actor-Critic Works

```
  TWO NETWORKS:

  ACTOR:  pi(a|s; theta)
  Takes state, outputs action probabilities.
  Updated by POLICY GRADIENT.

  CRITIC: V(s; w)
  Takes state, outputs value estimate.
  Updated by TD ERROR.

  AT EACH STEP:
  1. Actor selects action: a ~ pi(a|s; theta)
  2. Environment returns: r, s'
  3. Critic computes TD error:
     delta = r + gamma * V(s'; w) - V(s; w)
  4. Update critic: w += alpha_w * delta * nabla_w V(s; w)
  5. Update actor:  theta += alpha_theta * delta * nabla_theta log pi(a|s; theta)

  THE TD ERROR IS THE ADVANTAGE ESTIMATE:
  delta = r + gamma * V(s') - V(s)
        ≈ Q(s,a) - V(s)
        ≈ A(s,a)
```

---

## A2C: Advantage Actor-Critic

```
  A2C = synchronous version with multiple environments.

  PARALLEL ENVIRONMENTS:
  Env 0:  s0 -> a0 -> r0, s0'
  Env 1:  s1 -> a1 -> r1, s1'
  Env 2:  s2 -> a2 -> r2, s2'
  ...
  Env N:  sN -> aN -> rN, sN'

  Collect batch of experiences from ALL environments.
  Compute advantages for the whole batch.
  Single gradient update using the batch.

  WHY MULTIPLE ENVIRONMENTS?
  - More diverse experiences per update
  - Better gradient estimate (less variance)
  - Better GPU utilization (batched forward passes)
```

---

## Implementation

```python
import numpy as np

class ActorCriticAgent:
    def __init__(self, state_dim, action_dim, lr_actor=0.001, lr_critic=0.005, gamma=0.99):
        self.gamma = gamma
        self.lr_actor = lr_actor
        self.lr_critic = lr_critic

        self.actor_weights = np.random.randn(state_dim, action_dim) * 0.01
        self.critic_weights = np.random.randn(state_dim, 1) * 0.01

    def _softmax(self, logits):
        exp_logits = np.exp(logits - np.max(logits))
        return exp_logits / exp_logits.sum()

    def get_action_probs(self, state):
        logits = state @ self.actor_weights
        return self._softmax(logits)

    def get_value(self, state):
        return (state @ self.critic_weights)[0]

    def select_action(self, state):
        probs = self.get_action_probs(state)
        action = np.random.choice(len(probs), p=probs)
        return action, probs[action]

    def update(self, state, action, reward, next_state, done):
        value = self.get_value(state)
        next_value = 0.0 if done else self.get_value(next_state)

        td_error = reward + self.gamma * next_value - value

        self.critic_weights += self.lr_critic * td_error * state.reshape(-1, 1)

        probs = self.get_action_probs(state)
        action_onehot = np.zeros(len(probs))
        action_onehot[action] = 1.0
        grad_log_pi = state.reshape(-1, 1) @ (action_onehot - probs).reshape(1, -1)
        self.actor_weights += self.lr_actor * td_error * grad_log_pi


def run_episode(agent, env_fn, max_steps=500):
    state = env_fn.reset()
    total_reward = 0

    for step in range(max_steps):
        action, prob = agent.select_action(state)
        next_state, reward, done = env_fn.step(action)
        agent.update(state, action, reward, next_state, done)
        total_reward += reward
        state = next_state
        if done:
            break

    return total_reward
```

---

## PyTorch Actor-Critic

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.distributions import Categorical

class ActorCritic(nn.Module):
    def __init__(self, state_dim, action_dim, hidden_dim=64):
        super().__init__()
        self.shared = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
        )
        self.actor_head = nn.Linear(hidden_dim, action_dim)
        self.critic_head = nn.Linear(hidden_dim, 1)

    def forward(self, state):
        features = self.shared(state)
        action_logits = self.actor_head(features)
        value = self.critic_head(features)
        return action_logits, value

    def select_action(self, state):
        state_tensor = torch.FloatTensor(state).unsqueeze(0)
        logits, value = self.forward(state_tensor)
        dist = Categorical(logits=logits)
        action = dist.sample()
        return action.item(), dist.log_prob(action), value

def train_step(model, optimizer, states, actions, rewards, next_states, dones, gamma=0.99):
    states_t = torch.FloatTensor(states)
    actions_t = torch.LongTensor(actions)
    rewards_t = torch.FloatTensor(rewards)
    next_states_t = torch.FloatTensor(next_states)
    dones_t = torch.FloatTensor(dones)

    logits, values = model(states_t)
    _, next_values = model(next_states_t)

    advantages = rewards_t + gamma * next_values.squeeze() * (1 - dones_t) - values.squeeze()

    dist = Categorical(logits=logits)
    log_probs = dist.log_prob(actions_t)
    actor_loss = -(log_probs * advantages.detach()).mean()

    critic_loss = advantages.pow(2).mean()

    entropy = dist.entropy().mean()

    loss = actor_loss + 0.5 * critic_loss - 0.01 * entropy

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    return loss.item()
```

---

## Variance Reduction Techniques

```
  TECHNIQUE 1: BASELINE SUBTRACTION
  Instead of: nabla J = E[log pi * G_t]
  Use:         nabla J = E[log pi * (G_t - b)]
  Where b = V(s) is the baseline.
  This is exactly what actor-critic does!

  TECHNIQUE 2: GENERALIZED ADVANTAGE ESTIMATION (GAE)
  Instead of 1-step TD error, blend multiple n-step returns:

  delta_t = r_t + gamma * V(s_{t+1}) - V(s_t)

  A^GAE(gamma, lambda) = SUM_{l=0}^{inf} (gamma*lambda)^l * delta_{t+l}

  lambda=0: just 1-step TD (low variance, high bias)
  lambda=1: full Monte Carlo (high variance, low bias)
  lambda=0.95: sweet spot in practice

  +--------+          bias-variance tradeoff          +--------+
  |lambda=0|...................................|lambda=1|
  | low var|                                   |high var|
  |high bias|                                  |low bias|
  +--------+                                   +--------+

  TECHNIQUE 3: ENTROPY BONUS
  Add entropy of the policy to the loss:
  L = L_actor + c1 * L_critic - c2 * H(pi)

  Entropy encourages exploration.
  Without it, policy collapses to deterministic too fast.
```

---

## Actor-Critic Variants

```
  +-------------------+------------------------------------------+
  | Variant           | Key Difference                           |
  +-------------------+------------------------------------------+
  | A2C               | Synchronous parallel environments        |
  | A3C               | Asynchronous parallel (deprecated)       |
  | PPO               | Clipped objective (next lesson!)         |
  | SAC               | Maximum entropy + continuous actions     |
  | TD3               | Twin critics + delayed actor updates     |
  | IMPALA            | Off-policy correction for distributed    |
  +-------------------+------------------------------------------+
```

---

## Exercises

### Exercise 1: Actor-Critic for CartPole

Implement the PyTorch actor-critic above and train on
CartPole-v1. Track:
- Episode reward over time
- Actor loss and critic loss separately
- Value estimation accuracy (compare V(s) with actual return)

### Exercise 2: GAE Implementation

Implement Generalized Advantage Estimation:
1. Collect a trajectory of (s, a, r, s') tuples
2. Compute GAE advantages with lambda=0.95
3. Compare training speed with lambda=0 vs lambda=0.95 vs lambda=1

### Exercise 3: Shared vs Separate Networks

Compare two architectures:
1. Shared trunk with actor/critic heads (as above)
2. Completely separate actor and critic networks
Measure training speed and final performance on CartPole.

### Exercise 4: Entropy Bonus Ablation

Train actor-critic on CartPole with entropy coefficient:
- c2 = 0 (no entropy bonus)
- c2 = 0.01 (standard)
- c2 = 0.1 (high exploration)
Plot the policy entropy over training for each.

---

## Key Takeaways

```
  1. Actor selects actions, critic evaluates them
  2. Advantage = Q(s,a) - V(s) = how much better than average
  3. TD error approximates the advantage
  4. Lower variance than REINFORCE (baseline subtraction)
  5. Two networks (or shared trunk): actor and critic
  6. GAE blends n-step returns with lambda parameter
  7. Entropy bonus prevents premature convergence
  8. A2C uses parallel environments for diverse experiences
  9. Critic loss is MSE, actor loss is policy gradient * advantage
  10. Foundation for PPO, SAC, and most modern RL algorithms
```

---

Next: [Lesson 11 — Proximal Policy Optimization](./11-ppo.md)
