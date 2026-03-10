# Lesson 11: Proximal Policy Optimization (PPO)

> THE algorithm behind ChatGPT, Claude, and most modern RL.
> Simple, stable, and surprisingly effective.

---

## The Analogy

You're learning to throw darts. After each round of throws,
you adjust your technique. But if you change too much at once,
your aim gets worse. PPO says: "improve, but not too
aggressively. Stay close to what was already working."

```
  VANILLA POLICY GRADIENT:
  Big update -> performance tanks -> unstable training
  Small update -> safe but slow
  No principled way to pick the right step size.

  PPO:
  "Take the biggest step you can WITHOUT ruining performance."
  Clips the update to stay within a trust region.

  Performance
  |
  |        * PPO (steady climb)
  |       / \
  |      /   \  * Vanilla PG (unstable)
  |     /     \/
  |    /
  |   /
  |  *
  +---+---+---+---+---+---+--> updates
```

---

## Why Not Just Use Policy Gradients?

```
  PROBLEM 1: STEP SIZE SENSITIVITY

  Policy gradient: theta += alpha * gradient
  Too large alpha: policy changes drastically
                   -> enters bad region of policy space
                   -> performance collapses
                   -> hard to recover

  PROBLEM 2: SAMPLE EFFICIENCY

  REINFORCE: collect trajectory, compute gradient, discard data
  ONE gradient update per trajectory. Very wasteful!

  PPO: collect trajectory, compute gradient, UPDATE MULTIPLE TIMES
  on the same data (with clipping to stay safe).

  REINFORCE:  [collect] -> [1 update] -> [discard] -> [collect]
  PPO:        [collect] -> [K updates on same data] -> [collect]
              Much more efficient!
```

---

## The Importance Sampling Ratio

```
  PROBLEM: we collected data using policy pi_old.
  We want to update to pi_new.
  Can we reuse the old data?

  YES, with importance sampling:

  r_t(theta) = pi_new(a_t|s_t; theta) / pi_old(a_t|s_t; theta_old)

  This ratio tells us how much more (or less) likely
  the new policy is to take the same action.

  r_t > 1: new policy is MORE likely to take this action
  r_t < 1: new policy is LESS likely to take this action
  r_t = 1: new and old policy agree exactly

  THE SURROGATE OBJECTIVE:
  L(theta) = E[ r_t(theta) * A_t ]

  If A_t > 0 (good action): increase r_t (make more likely)
  If A_t < 0 (bad action): decrease r_t (make less likely)
```

---

## The Clipping Trick

```
  PROBLEM: r_t can become very large, causing huge updates.

  PPO-CLIP OBJECTIVE:
  L_CLIP(theta) = E[ min(
      r_t * A_t,                    (unclipped)
      clip(r_t, 1-eps, 1+eps) * A_t  (clipped)
  )]

  eps = 0.2 (typical)

  WHAT CLIP DOES:

  Case 1: A_t > 0 (good action, want to increase probability)
  r_t = 1.5 (new policy 50% more likely)
  clip(1.5, 0.8, 1.2) = 1.2
  min(1.5 * A_t, 1.2 * A_t) = 1.2 * A_t
  CLIPPED! Prevents too-aggressive increase.

  Case 2: A_t < 0 (bad action, want to decrease probability)
  r_t = 0.5 (new policy 50% less likely)
  clip(0.5, 0.8, 1.2) = 0.8
  min(0.5 * A_t, 0.8 * A_t) = 0.5 * A_t  (note: A_t < 0)
  NOT clipped. Let the policy move away from bad actions.

  GRAPHICALLY (A_t > 0):

  Objective
  |
  |           /  unclipped (no limit)
  |          /
  |     ----+ clipped (plateau at 1+eps)
  |    /
  |   /
  |  /
  +-+---+---+---+---+---+--> r_t
  0   0.8  1.0  1.2   1.5
      1-e       1+e
```

---

## Full PPO Algorithm

```
  FOR each iteration:
    1. Collect T timesteps of experience using current policy
       (run policy in N parallel environments)

    2. Compute advantages using GAE:
       A_t = SUM_{l=0}^{T-t} (gamma*lambda)^l * delta_{t+l}
       delta_t = r_t + gamma * V(s_{t+1}) - V(s_t)

    3. FOR epoch = 1 to K (typically K=3-10):
       FOR each mini-batch from the collected data:

         a. Compute ratio: r_t = pi(a_t|s_t) / pi_old(a_t|s_t)

         b. Compute clipped objective:
            L_CLIP = min(r_t * A_t, clip(r_t, 1-eps, 1+eps) * A_t)

         c. Compute value loss:
            L_VF = (V(s_t) - V_target_t)^2

         d. Compute entropy bonus:
            S = H(pi(.|s_t))

         e. Total loss:
            L = -L_CLIP + c1 * L_VF - c2 * S

         f. Gradient step on L

    4. Set pi_old = pi (for next iteration)
```

---

## PyTorch Implementation

```python
import torch
import torch.nn as nn
from torch.distributions import Categorical
import numpy as np

class PPONetwork(nn.Module):
    def __init__(self, state_dim, action_dim, hidden_dim=64):
        super().__init__()
        self.shared = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
        )
        self.actor = nn.Linear(hidden_dim, action_dim)
        self.critic = nn.Linear(hidden_dim, 1)

    def forward(self, state):
        features = self.shared(state)
        return self.actor(features), self.critic(features)

    def get_action(self, state):
        logits, value = self.forward(state)
        dist = Categorical(logits=logits)
        action = dist.sample()
        return action, dist.log_prob(action), value

class PPOBuffer:
    def __init__(self):
        self.states = []
        self.actions = []
        self.log_probs = []
        self.rewards = []
        self.values = []
        self.dones = []

    def store(self, state, action, log_prob, reward, value, done):
        self.states.append(state)
        self.actions.append(action)
        self.log_probs.append(log_prob)
        self.rewards.append(reward)
        self.values.append(value)
        self.dones.append(done)

    def compute_gae(self, last_value, gamma=0.99, lam=0.95):
        rewards = self.rewards + [last_value]
        values = self.values + [last_value]
        dones = self.dones + [False]
        advantages = []
        gae = 0
        for t in reversed(range(len(self.rewards))):
            delta = rewards[t] + gamma * values[t + 1] * (1 - dones[t]) - values[t]
            gae = delta + gamma * lam * (1 - dones[t]) * gae
            advantages.insert(0, gae)
        returns = [adv + val for adv, val in zip(advantages, self.values)]
        return advantages, returns

    def get_tensors(self, advantages, returns):
        return (
            torch.FloatTensor(np.array(self.states)),
            torch.LongTensor(self.actions),
            torch.FloatTensor(self.log_probs),
            torch.FloatTensor(advantages),
            torch.FloatTensor(returns),
        )

    def clear(self):
        self.__init__()

def ppo_update(
    model, optimizer, states, actions, old_log_probs,
    advantages, returns, clip_eps=0.2, epochs=4, batch_size=64,
    vf_coef=0.5, ent_coef=0.01,
):
    advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
    n = len(states)
    total_loss = 0

    for epoch in range(epochs):
        indices = np.random.permutation(n)
        for start in range(0, n, batch_size):
            end = start + batch_size
            idx = indices[start:end]

            batch_states = states[idx]
            batch_actions = actions[idx]
            batch_old_log_probs = old_log_probs[idx]
            batch_advantages = advantages[idx]
            batch_returns = returns[idx]

            logits, values = model(batch_states)
            dist = Categorical(logits=logits)
            new_log_probs = dist.log_prob(batch_actions)
            entropy = dist.entropy().mean()

            ratio = torch.exp(new_log_probs - batch_old_log_probs)
            surr1 = ratio * batch_advantages
            surr2 = torch.clamp(ratio, 1 - clip_eps, 1 + clip_eps) * batch_advantages
            actor_loss = -torch.min(surr1, surr2).mean()

            critic_loss = (values.squeeze() - batch_returns).pow(2).mean()

            loss = actor_loss + vf_coef * critic_loss - ent_coef * entropy

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 0.5)
            optimizer.step()

            total_loss += loss.item()

    return total_loss
```

---

## PPO Hyperparameters

```
  +-------------------+------------------+--------------------------+
  | Parameter         | Typical Value    | Effect                   |
  +-------------------+------------------+--------------------------+
  | clip_eps          | 0.1 - 0.3       | Trust region size        |
  |                   | (0.2 standard)   | Bigger = more aggressive |
  +-------------------+------------------+--------------------------+
  | gamma             | 0.99             | Discount factor          |
  +-------------------+------------------+--------------------------+
  | lambda (GAE)      | 0.95             | Bias-variance tradeoff   |
  +-------------------+------------------+--------------------------+
  | epochs per update | 3-10             | Reuse of collected data  |
  +-------------------+------------------+--------------------------+
  | batch size        | 32-4096          | Gradient estimate quality|
  +-------------------+------------------+--------------------------+
  | learning rate     | 3e-4             | Step size                |
  +-------------------+------------------+--------------------------+
  | vf_coef           | 0.5              | Critic loss weight       |
  +-------------------+------------------+--------------------------+
  | ent_coef          | 0.01             | Exploration bonus        |
  +-------------------+------------------+--------------------------+
  | num_envs          | 8-256            | Parallel data collection |
  +-------------------+------------------+--------------------------+
```

---

## PPO in RLHF

```
  THIS IS HOW CHATGPT/CLAUDE ARE FINE-TUNED:

  1. Train a REWARD MODEL from human preferences
     Human sees two responses, picks the better one.
     Train a model to predict human preference.

  2. Use PPO to optimize the language model against
     the reward model.

  STATE:   prompt + generated tokens so far
  ACTION:  next token to generate
  REWARD:  reward model score on completed response
           + KL penalty (don't drift too far from base model)

  L = E[r_t * A_t] - beta * KL(pi || pi_ref)

  The KL penalty is CRITICAL:
  Without it, the model finds "reward hacks" —
  outputs that score high on the reward model
  but are actually nonsensical.

  pi_ref = the supervised fine-tuned model (starting point)
  pi     = the model being optimized
  beta   = 0.01-0.2 (how much to penalize divergence)
```

---

## Exercises

### Exercise 1: Implement PPO for CartPole

Use the code above to train PPO on CartPole-v1:
1. Collect 2048 steps per iteration
2. Run 4 epochs per update
3. Plot episode reward over training
4. Compare with vanilla policy gradient (REINFORCE)

### Exercise 2: Clip Epsilon Ablation

Train PPO with different clip values:
- eps = 0.05 (very conservative)
- eps = 0.2 (standard)
- eps = 0.5 (aggressive)
- eps = 1.0 (effectively unclipped)
Plot training curves and compare stability.

### Exercise 3: PPO vs A2C

Compare PPO and A2C on the same environment:
1. Same network architecture
2. Same number of environment steps
3. Compare: final reward, training stability, wall-clock time

### Exercise 4: KL Penalty Exploration

Implement the KL-penalty version of PPO:
Instead of clipping, add a KL divergence penalty:
L = E[r_t * A_t] - beta * KL(pi_new || pi_old)
Adaptively adjust beta to target a specific KL value.

---

## Key Takeaways

```
  1. PPO clips the policy ratio to prevent destructive updates
  2. Importance sampling allows reusing data for multiple updates
  3. Clip epsilon (0.2) defines the trust region
  4. GAE (lambda=0.95) balances bias and variance in advantages
  5. Multiple epochs on same data = much more sample efficient
  6. Entropy bonus prevents premature convergence
  7. PPO is the default RL algorithm for most applications
  8. RLHF uses PPO to align language models with human preferences
  9. KL penalty prevents reward hacking in RLHF
  10. Normalize advantages for stable training
```

---

Next: [Lesson 12 — Multi-Armed Bandits](./12-multi-armed-bandits.md)
