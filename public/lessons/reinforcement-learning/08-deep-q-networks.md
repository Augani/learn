# Lesson 8: Deep Q-Networks

## The Problem with Q-Tables

Q-tables worked for tic-tac-toe. But what about Atari games?

```
  TIC-TAC-TOE:                    ATARI BREAKOUT:

  States: ~5,000                   States: 256^(210*160*3)
  Actions: 9                       = basically infinite
  Q-table: fits in memory          Q-table: would need more
                                   atoms than exist in the
                                   universe

  +-------+                        +---------------------------+
  | Tiny  |                        | 210 x 160 pixel screen    |
  | board |                        | 3 color channels          |
  +-------+                        | 256 values per pixel      |
                                   +---------------------------+

  Solution: instead of a TABLE, use a NEURAL NETWORK
  to APPROXIMATE Q(s,a).
```

## DQN: The Core Idea

```
  Q-TABLE APPROACH:                  DQN APPROACH:

  State -> lookup table -> Q(s,a)    State -> neural net -> Q(s,a)
                                                  |
  +---+---+---+---+                    +----------+---------+
  |s0 | 1 | 2 | 0 |                    | Input: state       |
  |s1 | 3 | 1 | 2 |                    | (e.g., pixels)     |
  |s2 | 0 | 4 | 1 |                    +--------------------+
  |...|...|...|...|                    | Hidden layers      |
  +---+---+---+---+                    | (learn features)   |
  exact, but doesn't                   +--------------------+
  scale                                | Output: Q-value    |
                                       | for EACH action    |
                                       +----+----+----+-----+
                                       |Q(s,a0)|Q(s,a1)|Q(s,a2)|
                                       +-------+-------+-------+
                                       generalizes to unseen states!
```

## Two Key Innovations

DeepMind's 2015 DQN paper introduced two tricks that made this work:

```
  PROBLEM 1: Correlated samples      SOLUTION: EXPERIENCE REPLAY

  Sequential game frames are          Store transitions in a buffer
  highly correlated. Neural nets      Sample RANDOM batches to train
  hate correlated training data.      Breaks correlations!

  Without replay:                     With replay:
  [frame1, frame2, frame3, ...]       Buffer: [f1, f47, f23, f99, ...]
  ^^^^^^^^^^^^^^^^^^^^^^^^^            Random sample each batch
  highly correlated!

  PROBLEM 2: Moving target            SOLUTION: TARGET NETWORK

  We update Q toward:                 Keep a SEPARATE "target" network
  r + gamma * max Q(s',a')            that we only update every N steps
  But Q is changing every step!
  It's like a dog chasing its tail.   Stable target to aim at.

  +--------+     updates      +--------+
  | Online |  <-------------- | Train  |
  | Network|                  | on     |
  +--------+                  | batches|
      |                       +--------+
      | copy weights                ^
      | every N steps               |
      v                             |
  +--------+                  +--------+
  | Target |  ------------>   | TD     |
  | Network|  provides target | Target |
  +--------+                  +--------+
```

## Experience Replay Buffer

```python
import numpy as np
from collections import deque
import random


class ReplayBuffer:
    def __init__(self, capacity=10000):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size):
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        return (np.array(states), np.array(actions), np.array(rewards),
                np.array(next_states), np.array(dones))

    def __len__(self):
        return len(self.buffer)
```

## DQN Implementation

```python
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from collections import deque
import random


class DQN(nn.Module):
    def __init__(self, state_dim, action_dim, hidden_dim=64):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, action_dim),
        )

    def forward(self, x):
        return self.network(x)


class DQNAgent:
    def __init__(self, state_dim, action_dim, lr=1e-3, gamma=0.99,
                 epsilon_start=1.0, epsilon_end=0.01, epsilon_decay=0.995,
                 buffer_size=10000, batch_size=64, target_update=10):
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.gamma = gamma
        self.epsilon = epsilon_start
        self.epsilon_end = epsilon_end
        self.epsilon_decay = epsilon_decay
        self.batch_size = batch_size
        self.target_update = target_update

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.policy_net = DQN(state_dim, action_dim).to(self.device)
        self.target_net = DQN(state_dim, action_dim).to(self.device)
        self.target_net.load_state_dict(self.policy_net.state_dict())
        self.target_net.eval()

        self.optimizer = optim.Adam(self.policy_net.parameters(), lr=lr)
        self.buffer = deque(maxlen=buffer_size)
        self.steps = 0

    def choose_action(self, state):
        if random.random() < self.epsilon:
            return random.randint(0, self.action_dim - 1)

        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            q_values = self.policy_net(state_tensor)
            return q_values.argmax(dim=1).item()

    def store_transition(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def train_step(self):
        if len(self.buffer) < self.batch_size:
            return 0.0

        batch = random.sample(self.buffer, self.batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)

        states = torch.FloatTensor(np.array(states)).to(self.device)
        actions = torch.LongTensor(actions).to(self.device)
        rewards = torch.FloatTensor(rewards).to(self.device)
        next_states = torch.FloatTensor(np.array(next_states)).to(self.device)
        dones = torch.FloatTensor(dones).to(self.device)

        current_q = self.policy_net(states).gather(1, actions.unsqueeze(1)).squeeze(1)

        with torch.no_grad():
            next_q = self.target_net(next_states).max(dim=1)[0]
            target_q = rewards + self.gamma * next_q * (1 - dones)

        loss = nn.MSELoss()(current_q, target_q)

        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.policy_net.parameters(), 1.0)
        self.optimizer.step()

        self.steps += 1
        if self.steps % self.target_update == 0:
            self.target_net.load_state_dict(self.policy_net.state_dict())

        self.epsilon = max(self.epsilon_end, self.epsilon * self.epsilon_decay)

        return loss.item()
```

## Testing DQN on CartPole

```python
class SimpleCartPole:
    def __init__(self):
        self.gravity = 9.8
        self.cart_mass = 1.0
        self.pole_mass = 0.1
        self.total_mass = self.cart_mass + self.pole_mass
        self.pole_length = 0.5
        self.force_mag = 10.0
        self.dt = 0.02
        self.state = None

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

        done = (abs(x) > 2.4 or abs(theta) > 0.2095)
        reward = 1.0 if not done else 0.0

        return self.state.copy(), reward, done


def train_dqn_cartpole(num_episodes=500):
    env = SimpleCartPole()
    agent = DQNAgent(state_dim=4, action_dim=2, lr=1e-3, gamma=0.99,
                     epsilon_start=1.0, epsilon_end=0.01, epsilon_decay=0.995,
                     buffer_size=10000, batch_size=64, target_update=10)

    reward_history = []

    for ep in range(num_episodes):
        state = env.reset()
        total_reward = 0
        done = False

        while not done:
            action = agent.choose_action(state)
            next_state, reward, done = env.step(action)
            agent.store_transition(state, action, reward, next_state, done)
            agent.train_step()
            state = next_state
            total_reward += reward

        reward_history.append(total_reward)

        if (ep + 1) % 50 == 0:
            avg = np.mean(reward_history[-50:])
            print(f"Episode {ep+1}: avg reward = {avg:.1f}, epsilon = {agent.epsilon:.3f}")

    return agent, reward_history


agent, history = train_dqn_cartpole()
```

## DQN Architecture for Atari

```
  For Atari, DeepMind used a CNN:

  Input: 4 stacked grayscale frames (84 x 84 x 4)
         ^^^^^^^^
         Why 4? Because one frame doesn't show velocity/direction

  +-------------------+
  | 84x84x4 frames    |
  +-------------------+
           |
  +-------------------+
  | Conv2D 32 8x8 s4  |  32 filters, 8x8 kernel, stride 4
  | ReLU               |
  +-------------------+
           |
  +-------------------+
  | Conv2D 64 4x4 s2  |  64 filters, 4x4 kernel, stride 2
  | ReLU               |
  +-------------------+
           |
  +-------------------+
  | Conv2D 64 3x3 s1  |
  | ReLU               |
  +-------------------+
           |
  +-------------------+
  | Flatten            |
  | Linear 512        |
  | ReLU               |
  +-------------------+
           |
  +-------------------+
  | Linear num_actions |  One Q-value per action
  +-------------------+
```

## Key DQN Improvements

```
  +---------------------+----------------------------------------+
  | Improvement          | What It Does                          |
  +---------------------+----------------------------------------+
  | Double DQN           | Fixes overestimation: use online net  |
  |                      | to SELECT action, target net to       |
  |                      | EVALUATE it                           |
  +---------------------+----------------------------------------+
  | Dueling DQN          | Separate V(s) and A(s,a) streams     |
  |                      | Q(s,a) = V(s) + A(s,a) - mean(A)     |
  +---------------------+----------------------------------------+
  | Prioritized Replay   | Sample important transitions more     |
  |                      | often (high TD error = important)     |
  +---------------------+----------------------------------------+
  | Noisy Nets           | Add learnable noise to weights for    |
  |                      | exploration (replaces epsilon-greedy) |
  +---------------------+----------------------------------------+
  | Rainbow DQN          | Combine ALL the above improvements    |
  +---------------------+----------------------------------------+
```

## Exercises

1. **CartPole tuning**: Experiment with different hyperparameters for the
   CartPole DQN. Try changing the learning rate, batch size, and target
   update frequency. Which has the biggest impact?

2. **Double DQN**: Modify the `train_step` method to implement Double DQN.
   Instead of `target_net(next_states).max()`, use the policy net to select
   the action and the target net to evaluate it.

3. **Replay buffer analysis**: Track the TD error for each transition in
   the buffer. Plot a histogram of TD errors after training. What does the
   distribution look like?

4. **Network architecture**: Try different hidden layer sizes (32, 128, 256)
   and depths (1, 2, 3 hidden layers). How does CartPole performance change?

5. **Visualization**: After training, record an episode and print the state
   and Q-values at each step. When is the agent most "confident" (large
   Q-value gap between actions)?

---

[Next: Policy Gradients ->](09-policy-gradients.md)
