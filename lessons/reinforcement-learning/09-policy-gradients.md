# Lesson 9: Policy Gradients

## The A/B Testing Analogy

You're running a website and want to maximize click-through rate:

```
  APPROACH 1 (Value-based, like DQN):
  "Let me estimate the value of every possible page layout,
   then pick the best one."

  APPROACH 2 (Policy gradient):
  "Let me directly adjust the probability of showing each layout
   based on how many clicks it gets."

  +-- Layout A shown 60% ----> Got 100 clicks ----> Increase to 65%
  |
  +-- Layout B shown 30% ----> Got 150 clicks ----> Increase to 35%
  |
  +-- Layout C shown 10% ----> Got 10 clicks  ----> Decrease to 0%

  Policy gradients directly optimize the POLICY (probabilities)
  without bothering to estimate values.
```

## Why Policy Gradients?

```
  VALUE METHODS (DQN):               POLICY METHODS:

  Learn Q(s,a)                       Learn pi(a|s) directly
  Derive policy from Q               No need for Q values
  Deterministic output               Naturally stochastic

  STRUGGLES WITH:                    HANDLES EASILY:
  +---------------------------+      +---------------------------+
  | Continuous actions        |      | Continuous actions        |
  | (infinite Q values to     |      | (output mean + std of     |
  |  compute max over)        |      |  a Gaussian)              |
  +---------------------------+      +---------------------------+
  | Stochastic policies       |      | Stochastic policies       |
  | (Q gives deterministic    |      | (it's a probability       |
  |  argmax)                  |      |  distribution!)           |
  +---------------------------+      +---------------------------+
  | High-dimensional actions  |      | High-dimensional actions  |
  | (exponential combinations)|      | (scales linearly)         |
  +---------------------------+      +---------------------------+
```

## The Policy Gradient Theorem

```
  OBJECTIVE: maximize expected return

  J(theta) = E[SUM_t gamma^t * r_t]

  GRADIENT:

  nabla J(theta) = E[ SUM_t nabla log pi(a_t|s_t; theta) * G_t ]

                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   ^^^
                    "score function" / log-prob gradient       return
                    (which direction to push the policy)    (how good)

  INTUITION:
  +----------------------------------------------------+
  |  If an action led to HIGH return:                  |
  |    increase its probability (positive gradient)    |
  |                                                    |
  |  If an action led to LOW return:                   |
  |    decrease its probability (negative gradient)    |
  |                                                    |
  |  The return WEIGHTS the gradient:                  |
  |    good outcomes push harder than bad ones         |
  +----------------------------------------------------+
```

## The REINFORCE Algorithm

```
  FOR each episode:
      1. Generate full episode using pi(a|s; theta)
      2. For each timestep t:
         a. Compute return G_t = SUM_{k=t}^{T} gamma^{k-t} * r_k
         b. Update: theta += alpha * nabla log pi(a_t|s_t) * G_t

  +----------+    sample     +----------+    compute    +--------+
  | Policy   | -----------> | Episode  | -----------> | Returns|
  | pi(theta)|              | s,a,r... |              | G_t    |
  +-----+----+              +----------+              +---+----+
        ^                                                  |
        |              gradient ascent                      |
        +----------------------<---------------------------+
                theta += alpha * grad
```

## REINFORCE Implementation

```python
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np


class PolicyNetwork(nn.Module):
    def __init__(self, state_dim, action_dim, hidden_dim=32):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, action_dim),
            nn.Softmax(dim=-1),
        )

    def forward(self, state):
        return self.network(state)


class SimpleCartPole:
    def __init__(self):
        self.gravity = 9.8
        self.cart_mass = 1.0
        self.pole_mass = 0.1
        self.total_mass = self.cart_mass + self.pole_mass
        self.pole_length = 0.5
        self.force_mag = 10.0
        self.dt = 0.02

    def reset(self):
        self.state = np.random.uniform(-0.05, 0.05, size=4)
        return self.state.copy()

    def step(self, action):
        x, x_dot, theta, theta_dot = self.state
        force = self.force_mag if action == 1 else -self.force_mag

        cos_theta = np.cos(theta)
        sin_theta = np.sin(theta)
        temp = (force + self.pole_mass * self.pole_length * theta_dot**2 * sin_theta) / self.total_mass
        theta_acc = (self.gravity * sin_theta - cos_theta * temp) / (
            self.pole_length * (4/3 - self.pole_mass * cos_theta**2 / self.total_mass))
        x_acc = temp - self.pole_mass * self.pole_length * theta_acc * cos_theta / self.total_mass

        x += self.dt * x_dot
        x_dot += self.dt * x_acc
        theta += self.dt * theta_dot
        theta_dot += self.dt * theta_acc
        self.state = np.array([x, x_dot, theta, theta_dot])

        done = abs(x) > 2.4 or abs(theta) > 0.2095
        reward = 1.0 if not done else 0.0
        return self.state.copy(), reward, done


def reinforce(num_episodes=1000, gamma=0.99, lr=0.01):
    env = SimpleCartPole()
    policy = PolicyNetwork(state_dim=4, action_dim=2)
    optimizer = optim.Adam(policy.parameters(), lr=lr)
    reward_history = []

    for ep in range(num_episodes):
        state = env.reset()
        log_probs = []
        rewards = []
        done = False

        while not done:
            state_tensor = torch.FloatTensor(state)
            action_probs = policy(state_tensor)
            dist = torch.distributions.Categorical(action_probs)
            action = dist.sample()
            log_probs.append(dist.log_prob(action))

            state, reward, done = env.step(action.item())
            rewards.append(reward)

        returns = []
        g = 0
        for r in reversed(rewards):
            g = r + gamma * g
            returns.insert(0, g)

        returns = torch.FloatTensor(returns)
        returns = (returns - returns.mean()) / (returns.std() + 1e-8)

        loss = 0
        for log_prob, g_t in zip(log_probs, returns):
            loss -= log_prob * g_t

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        reward_history.append(sum(rewards))
        if (ep + 1) % 100 == 0:
            avg = np.mean(reward_history[-100:])
            print(f"Episode {ep+1}: avg reward = {avg:.1f}")

    return policy, reward_history


policy, history = reinforce()
```

## The Baseline Trick

Raw REINFORCE has high variance. A baseline reduces it:

```
  WITHOUT BASELINE:                  WITH BASELINE:

  Good action (G=100):               Good action (G=100, b=80):
    grad = log_pi * 100                grad = log_pi * 20
  Mediocre action (G=50):            Mediocre action (G=50, b=80):
    grad = log_pi * 50                 grad = log_pi * (-30)
  Bad action (G=10):                 Bad action (G=10, b=80):
    grad = log_pi * 10                 grad = log_pi * (-70)

  ALL actions get positive           Only actions BETTER than
  gradient (just different            average get positive
  magnitudes). Slow learning.         gradient. Clear signal!

  Baseline b is typically the average return or a learned V(s).
  Subtracting it doesn't change the expected gradient (unbiased)
  but dramatically reduces variance.
```

```python
def reinforce_with_baseline(num_episodes=1000, gamma=0.99, lr=0.01):
    env = SimpleCartPole()
    policy = PolicyNetwork(state_dim=4, action_dim=2)
    value_net = nn.Sequential(
        nn.Linear(4, 32),
        nn.ReLU(),
        nn.Linear(32, 1),
    )

    policy_optimizer = optim.Adam(policy.parameters(), lr=lr)
    value_optimizer = optim.Adam(value_net.parameters(), lr=lr)
    reward_history = []

    for ep in range(num_episodes):
        state = env.reset()
        log_probs = []
        rewards = []
        values = []
        done = False

        while not done:
            state_tensor = torch.FloatTensor(state)
            action_probs = policy(state_tensor)
            dist = torch.distributions.Categorical(action_probs)
            action = dist.sample()

            log_probs.append(dist.log_prob(action))
            values.append(value_net(state_tensor).squeeze())

            state, reward, done = env.step(action.item())
            rewards.append(reward)

        returns = []
        g = 0
        for r in reversed(rewards):
            g = r + gamma * g
            returns.insert(0, g)

        returns = torch.FloatTensor(returns)
        values_tensor = torch.stack(values)

        advantages = returns - values_tensor.detach()

        policy_loss = 0
        for log_prob, adv in zip(log_probs, advantages):
            policy_loss -= log_prob * adv

        value_loss = nn.MSELoss()(values_tensor, returns)

        policy_optimizer.zero_grad()
        policy_loss.backward()
        policy_optimizer.step()

        value_optimizer.zero_grad()
        value_loss.backward()
        value_optimizer.step()

        reward_history.append(sum(rewards))
        if (ep + 1) % 100 == 0:
            avg = np.mean(reward_history[-100:])
            print(f"Episode {ep+1}: avg reward = {avg:.1f}")

    return policy, reward_history


policy_bl, history_bl = reinforce_with_baseline()
```

## Policy Gradient Landscape

```
  Think of the policy as a point in parameter space:

       HIGH RETURN
          |
          |    * <-- optimal policy
          |   / \
          |  /   \
          | /     \
  --------+--------+-----> theta
          |    ^
          |    |
          |  gradient points uphill
          |
       LOW RETURN

  Unlike supervised learning, the "landscape" changes as we
  explore (different trajectories = different gradients).
  This makes training noisy and is why variance reduction
  (baselines, etc.) matters so much.
```

## Exercises

1. **Variance comparison**: Run REINFORCE with and without the baseline
   for 1000 episodes. Plot the reward curves. How much faster does the
   baseline version converge?

2. **Learning rate sensitivity**: Try lr = 0.001, 0.01, 0.1. Policy
   gradients are very sensitive to learning rate -- which works best
   and what happens with too-high learning rate?

3. **Entropy bonus**: Add an entropy term to the loss: `loss -= 0.01 *
   dist.entropy()`. This encourages exploration. How does it affect
   learning speed and final performance?

4. **Continuous actions**: Modify the policy network to output a mean
   and log_std for a Gaussian distribution (for continuous action spaces).
   Test on a simple environment where the action is a float in [-1, 1].

5. **Conceptual**: Why does REINFORCE need complete episodes (like MC)
   while DQN can learn from single transitions (like TD)? What would
   happen if we tried to use REINFORCE with incomplete episodes?

---

[Next: Actor-Critic Methods ->](10-actor-critic.md)
