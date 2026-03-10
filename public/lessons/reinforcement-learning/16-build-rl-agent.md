# Lesson 16: Build an RL Agent (Capstone)

> Build a PPO agent from scratch that solves CartPole.
> No libraries except PyTorch and Gymnasium.

---

## The Environment: CartPole-v1

```
  A pole is attached to a cart on a frictionless track.
  Balance the pole by pushing the cart left or right.

        |
        |   <-- pole (keep this upright!)
        |
  ======+======
  [    cart    ]  <-- push left or right
  ~~~~~~~~~~~~~~~

  STATE (4 values):
  [cart_position, cart_velocity, pole_angle, pole_angular_velocity]

  ACTIONS (2):
  0 = push left
  1 = push right

  REWARD: +1 for every timestep the pole stays up

  TERMINATION:
  - Pole angle > 12 degrees
  - Cart position > 2.4 from center
  - Episode length > 500 steps (solved!)

  GOAL: average reward > 475 over 100 episodes
```

---

## Step 1: The Neural Network

```python
import torch
import torch.nn as nn
from torch.distributions import Categorical
import numpy as np

class PPONet(nn.Module):
    def __init__(self, state_dim=4, action_dim=2, hidden=64):
        super().__init__()
        self.shared = nn.Sequential(
            nn.Linear(state_dim, hidden),
            nn.Tanh(),
            nn.Linear(hidden, hidden),
            nn.Tanh(),
        )
        self.policy_head = nn.Linear(hidden, action_dim)
        self.value_head = nn.Linear(hidden, 1)

    def forward(self, x):
        if not isinstance(x, torch.Tensor):
            x = torch.FloatTensor(x)
        features = self.shared(x)
        logits = self.policy_head(features)
        value = self.value_head(features)
        return logits, value

    def act(self, state):
        logits, value = self.forward(state)
        dist = Categorical(logits=logits)
        action = dist.sample()
        return action.item(), dist.log_prob(action).item(), value.item()

    def evaluate(self, states, actions):
        logits, values = self.forward(states)
        dist = Categorical(logits=logits)
        log_probs = dist.log_prob(actions)
        entropy = dist.entropy()
        return log_probs, values.squeeze(-1), entropy
```

---

## Step 2: Experience Buffer

```python
class RolloutBuffer:
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

    def compute_returns_and_advantages(self, last_value, gamma=0.99, lam=0.95):
        values = self.values + [last_value]
        advantages = []
        gae = 0.0

        for t in reversed(range(len(self.rewards))):
            next_non_terminal = 1.0 - self.dones[t]
            delta = (
                self.rewards[t]
                + gamma * values[t + 1] * next_non_terminal
                - values[t]
            )
            gae = delta + gamma * lam * next_non_terminal * gae
            advantages.insert(0, gae)

        returns = [adv + val for adv, val in zip(advantages, self.values)]

        return {
            "states": torch.FloatTensor(np.array(self.states)),
            "actions": torch.LongTensor(self.actions),
            "old_log_probs": torch.FloatTensor(self.log_probs),
            "advantages": torch.FloatTensor(advantages),
            "returns": torch.FloatTensor(returns),
        }

    def clear(self):
        self.__init__()
```

---

## Step 3: PPO Update

```python
def ppo_update(net, optimizer, data, clip_eps=0.2, vf_coef=0.5, ent_coef=0.01, epochs=4, batch_size=64):
    states = data["states"]
    actions = data["actions"]
    old_log_probs = data["old_log_probs"]
    advantages = data["advantages"]
    returns = data["returns"]

    advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)

    n = len(states)
    total_actor_loss = 0.0
    total_critic_loss = 0.0
    total_entropy = 0.0
    num_updates = 0

    for epoch in range(epochs):
        indices = np.random.permutation(n)

        for start in range(0, n, batch_size):
            end = min(start + batch_size, n)
            idx = indices[start:end]

            batch_states = states[idx]
            batch_actions = actions[idx]
            batch_old_lp = old_log_probs[idx]
            batch_adv = advantages[idx]
            batch_returns = returns[idx]

            new_log_probs, values, entropy = net.evaluate(batch_states, batch_actions)

            ratio = torch.exp(new_log_probs - batch_old_lp)

            surr1 = ratio * batch_adv
            surr2 = torch.clamp(ratio, 1.0 - clip_eps, 1.0 + clip_eps) * batch_adv
            actor_loss = -torch.min(surr1, surr2).mean()

            critic_loss = (values - batch_returns).pow(2).mean()

            entropy_loss = -entropy.mean()

            loss = actor_loss + vf_coef * critic_loss + ent_coef * entropy_loss

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(net.parameters(), 0.5)
            optimizer.step()

            total_actor_loss += actor_loss.item()
            total_critic_loss += critic_loss.item()
            total_entropy += entropy.mean().item()
            num_updates += 1

    return {
        "actor_loss": total_actor_loss / max(num_updates, 1),
        "critic_loss": total_critic_loss / max(num_updates, 1),
        "entropy": total_entropy / max(num_updates, 1),
    }
```

---

## Step 4: Training Loop

```python
import gymnasium as gym

def train_cartpole(
    total_timesteps=100_000,
    steps_per_rollout=2048,
    gamma=0.99,
    lam=0.95,
    lr=3e-4,
    clip_eps=0.2,
    epochs=4,
    batch_size=64,
):
    env = gym.make("CartPole-v1")
    net = PPONet(state_dim=4, action_dim=2, hidden=64)
    optimizer = torch.optim.Adam(net.parameters(), lr=lr)
    buffer = RolloutBuffer()

    state, _ = env.reset()
    episode_reward = 0
    episode_rewards = []
    timestep = 0

    while timestep < total_timesteps:
        for _ in range(steps_per_rollout):
            action, log_prob, value = net.act(state)
            next_state, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated

            buffer.store(state, action, log_prob, reward, value, float(done))
            episode_reward += reward
            timestep += 1

            if done:
                episode_rewards.append(episode_reward)
                episode_reward = 0
                state, _ = env.reset()
            else:
                state = next_state

        with torch.no_grad():
            _, last_value = net.forward(torch.FloatTensor(state))
            last_value = last_value.item()

        data = buffer.compute_returns_and_advantages(last_value, gamma, lam)
        losses = ppo_update(net, optimizer, data, clip_eps, epochs=epochs, batch_size=batch_size)
        buffer.clear()

        if len(episode_rewards) > 0:
            recent = episode_rewards[-10:]
            avg = sum(recent) / len(recent)
            print(
                f"Timestep {timestep:>6d} | "
                f"Avg Reward (last 10): {avg:>6.1f} | "
                f"Actor Loss: {losses['actor_loss']:>8.4f} | "
                f"Critic Loss: {losses['critic_loss']:>8.4f} | "
                f"Entropy: {losses['entropy']:>6.3f}"
            )

            if len(episode_rewards) >= 100:
                avg_100 = sum(episode_rewards[-100:]) / 100
                if avg_100 >= 475:
                    print(f"\nSOLVED at timestep {timestep}!")
                    print(f"Average reward over last 100 episodes: {avg_100:.1f}")
                    break

    env.close()
    return net, episode_rewards

net, rewards = train_cartpole()
```

---

## Step 5: Evaluate the Trained Agent

```python
def evaluate(net, n_episodes=20, render=False):
    env_name = "CartPole-v1"
    if render:
        env = gym.make(env_name, render_mode="human")
    else:
        env = gym.make(env_name)

    episode_rewards = []

    for ep in range(n_episodes):
        state, _ = env.reset()
        total_reward = 0
        done = False

        while not done:
            with torch.no_grad():
                logits, _ = net.forward(torch.FloatTensor(state))
                action = torch.argmax(logits).item()

            state, reward, terminated, truncated, _ = env.step(action)
            total_reward += reward
            done = terminated or truncated

        episode_rewards.append(total_reward)
        print(f"Episode {ep + 1}: reward = {total_reward:.0f}")

    avg = sum(episode_rewards) / len(episode_rewards)
    print(f"\nAverage over {n_episodes} episodes: {avg:.1f}")
    print(f"Min: {min(episode_rewards):.0f}, Max: {max(episode_rewards):.0f}")

    env.close()
    return episode_rewards

evaluate(net, n_episodes=20)
```

---

## Understanding the Training Dynamics

```
  WHAT TO WATCH:

  1. EPISODE REWARD: should increase over training
     Early: ~20 (pole falls immediately)
     Middle: ~200 (learning to balance)
     Solved: ~500 (balanced for full episode)

  2. ACTOR LOSS: should be small and stable
     Large swings = unstable policy updates
     Consistently large = clip_eps too big or lr too high

  3. CRITIC LOSS: should decrease over training
     Critic learns to predict returns more accurately

  4. ENTROPY: should decrease gradually
     High (early): exploring many actions
     Low (late): confident in policy
     Too low too fast: premature convergence (increase ent_coef)
     Not decreasing: not learning (check lr, architecture)

  TRAINING CURVE:
  Reward
  500 |                        _______________
      |                   ____/
      |              ____/
  250 |         ____/
      |     ___/
      | ___/
    0 |/
      +---+---+---+---+---+---+---+---+---+-->
      0  10K 20K 30K 40K 50K 60K 70K 80K  timesteps
```

---

## Hyperparameter Tuning Guide

```
  IF TRAINING IS UNSTABLE (reward oscillates):
  -> Reduce learning rate (3e-4 -> 1e-4)
  -> Reduce clip_eps (0.2 -> 0.1)
  -> Increase batch_size
  -> Reduce epochs per update (4 -> 2)

  IF TRAINING IS TOO SLOW:
  -> Increase learning rate (3e-4 -> 1e-3)
  -> Increase steps_per_rollout (2048 -> 4096)
  -> Increase epochs per update (4 -> 10)

  IF POLICY COLLAPSES (always picks same action):
  -> Increase entropy coefficient (0.01 -> 0.05)
  -> Check that advantage normalization is working
  -> Verify network outputs are reasonable (not saturated)

  IF CRITIC LOSS STAYS HIGH:
  -> Increase vf_coef (0.5 -> 1.0)
  -> Use separate optimizer for critic with higher lr
  -> Use more hidden units
```

---

## Exercises

### Exercise 1: Train and Analyze

Run the full training script. Plot:
1. Episode rewards over time
2. Actor loss over time
3. Critic loss over time
4. Policy entropy over time
Document what you observe at each phase of training.

### Exercise 2: Hyperparameter Sensitivity

Train with each of these changes (one at a time):
1. lr = 1e-5 vs 3e-4 vs 1e-3
2. clip_eps = 0.05 vs 0.2 vs 0.5
3. epochs = 1 vs 4 vs 20
4. hidden_dim = 16 vs 64 vs 256
Record timesteps to solve and final performance.

### Exercise 3: Extend to LunarLander

Modify the agent to solve LunarLander-v2:
- State: 8-dimensional (position, velocity, angle, leg contact)
- Actions: 4 (nothing, left engine, main engine, right engine)
- Reward: complex (landing pad bonus, crash penalty, fuel cost)
- Solved: average reward > 200

What hyperparameters need to change? Why?

### Exercise 4: Add Logging and Visualization

Extend the training loop with:
1. TensorBoard or wandb logging
2. Periodic evaluation (every 10K steps, run 10 eval episodes)
3. Model checkpointing (save best model)
4. Learning rate scheduling (linear decay)
5. Training time and FPS (frames per second) tracking

---

## Key Takeaways

```
  1. PPO network: shared trunk + actor head + critic head
  2. Rollout buffer: collect steps, compute GAE, then update
  3. Advantage normalization stabilizes training
  4. Gradient clipping prevents catastrophic updates
  5. Multiple epochs on same data = PPO's efficiency trick
  6. Entropy bonus prevents premature convergence
  7. Monitor: reward, actor loss, critic loss, entropy
  8. CartPole solves in ~50K-100K timesteps with PPO
  9. Hyperparameters matter: lr, clip_eps, epochs, batch_size
  10. This same code structure scales to much harder problems
```

---

Congratulations! You've built a complete RL agent from
scratch. The PPO algorithm you implemented here is
essentially the same one used to train ChatGPT and other
language models through RLHF — just at a smaller scale.
