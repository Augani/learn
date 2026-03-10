# Lesson 7: Q-Learning

## The Algorithm That Changed Everything

Q-learning was proposed by Watkins in 1989 and it's deceptively simple:
learn the value of every state-action pair, then always pick the best.

```
  THE Q-LEARNING UPDATE:

  Q(s,a) += alpha * (r + gamma * max_a' Q(s',a') - Q(s,a))
                      |         ^^^^^^^^^^^^^^^
                      |         |
                      |         Best possible future value
                      |         (regardless of what we actually do)
                      |
                      Immediate reward

  This is OFF-POLICY: we can explore randomly but still learn
  the OPTIMAL policy. That's the magic.
```

## Exploration vs Exploitation

```
  THE DILEMMA:

  You're in a new city. Do you:

  A) Go to the restaurant you tried        B) Try the new place
     yesterday (it was good)?                  you walked past?

  EXPLOITATION:                              EXPLORATION:
  "Stick with what works"                    "Maybe something better
                                              exists"

  +-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
  | All explore                    All exploit                   |
  | (random)                       (greedy)                      |
  |                                                              |
  | Tries everything               Never discovers better        |
  | Never settles                  options                       |
  | Wastes time                    Gets stuck in local optima    |
  +-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
                         ^
                    SWEET SPOT
               (epsilon-greedy, UCB,
                Boltzmann, etc.)
```

## Epsilon-Greedy Strategy

```
  With probability epsilon:    choose RANDOM action  (explore)
  With probability 1-epsilon:  choose BEST action    (exploit)

  epsilon = 1.0:  ++++++++++++++++++++++++++++  (all random)
  epsilon = 0.5:  +++++++++++++++|=============  (half and half)
  epsilon = 0.1:  +++|=========================  (mostly greedy)
  epsilon = 0.0:  =============================  (always greedy)

  Common strategy: start with high epsilon, decay over time

  epsilon(t) = max(epsilon_min, epsilon_start * decay^t)
```

## Q-Learning: Full Algorithm

```
  INITIALIZE Q(s,a) = 0 for all s, a

  FOR each episode:
      s = start state
      WHILE s is not terminal:
          a = epsilon_greedy(s)           <-- BEHAVIOR policy (explores)
          s', r = environment.step(a)
          Q(s,a) += alpha * (r + gamma * max_a' Q(s',a') - Q(s,a))
                                           ^
                                           TARGET policy (always greedy)
          s = s'

  The behavior policy (what we do) differs from the target policy
  (what we learn). This is what makes it OFF-POLICY.
```

## Building a Tic-Tac-Toe Agent

```python
import numpy as np
from collections import defaultdict


class TicTacToe:
    def __init__(self):
        self.board = [0] * 9
        self.current_player = 1

    def reset(self):
        self.board = [0] * 9
        self.current_player = 1
        return self.get_state()

    def get_state(self):
        return tuple(self.board)

    def available_actions(self):
        return [i for i in range(9) if self.board[i] == 0]

    def step(self, action):
        if self.board[action] != 0:
            return self.get_state(), -10, True

        self.board[action] = self.current_player
        winner = self.check_winner()

        if winner == self.current_player:
            return self.get_state(), 1, True
        elif winner == -self.current_player:
            return self.get_state(), -1, True
        elif len(self.available_actions()) == 0:
            return self.get_state(), 0.5, True

        self.current_player *= -1
        return self.get_state(), 0, False

    def check_winner(self):
        lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6],
        ]
        for line in lines:
            vals = [self.board[i] for i in line]
            if vals[0] != 0 and vals[0] == vals[1] == vals[2]:
                return vals[0]
        return 0

    def render(self):
        symbols = {0: ".", 1: "X", -1: "O"}
        for row in range(3):
            cells = [symbols[self.board[row * 3 + col]] for col in range(3)]
            print(" ".join(cells))
        print()


class QLearningAgent:
    def __init__(self, alpha=0.1, gamma=0.9, epsilon=0.3):
        self.q_values = defaultdict(lambda: defaultdict(float))
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon

    def choose_action(self, state, available_actions):
        if not available_actions:
            return None

        if np.random.random() < self.epsilon:
            return np.random.choice(available_actions)

        q_vals = {a: self.q_values[state][a] for a in available_actions}
        max_q = max(q_vals.values())
        best_actions = [a for a, q in q_vals.items() if q == max_q]
        return np.random.choice(best_actions)

    def update(self, state, action, reward, next_state, next_available, done):
        if done:
            td_target = reward
        else:
            next_q_vals = [self.q_values[next_state][a] for a in next_available]
            max_next_q = max(next_q_vals) if next_q_vals else 0
            td_target = reward + self.gamma * max_next_q

        td_error = td_target - self.q_values[state][action]
        self.q_values[state][action] += self.alpha * td_error


def train_agents(num_episodes=100000):
    env = TicTacToe()
    agent_x = QLearningAgent(epsilon=0.3)
    agent_o = QLearningAgent(epsilon=0.3)

    stats = {"X": 0, "O": 0, "draw": 0}

    for ep in range(num_episodes):
        state = env.reset()
        done = False

        while not done:
            if env.current_player == 1:
                agent = agent_x
            else:
                agent = agent_o

            available = env.available_actions()
            action = agent.choose_action(state, available)
            next_state, reward, done = env.step(action)

            if env.current_player == -1 or done:
                agent.update(state, action, reward, next_state,
                           env.available_actions(), done)

                if done and reward != 0:
                    other = agent_o if agent == agent_x else agent_x
                    other_reward = -reward
                    if hasattr(other, '_last_state'):
                        other.update(other._last_state, other._last_action,
                                   other_reward, next_state, [], True)

            agent._last_state = state
            agent._last_action = action
            state = next_state

        winner = env.check_winner()
        if winner == 1:
            stats["X"] += 1
        elif winner == -1:
            stats["O"] += 1
        else:
            stats["draw"] += 1

        if (ep + 1) % 20000 == 0:
            total = stats["X"] + stats["O"] + stats["draw"]
            print(f"Episode {ep+1}: X={stats['X']/total:.1%} "
                  f"O={stats['O']/total:.1%} Draw={stats['draw']/total:.1%}")

    return agent_x, agent_o, env


np.random.seed(42)
agent_x, agent_o, env = train_agents()

print(f"\nQ-table size: {sum(len(v) for v in agent_x.q_values.values())} entries")

agent_x.epsilon = 0
agent_o.epsilon = 0

print("\nSample game (trained agents):")
state = env.reset()
done = False
while not done:
    if env.current_player == 1:
        action = agent_x.choose_action(state, env.available_actions())
    else:
        action = agent_o.choose_action(state, env.available_actions())
    state, reward, done = env.step(action)

env.render()
winner = env.check_winner()
result = {1: "X wins", -1: "O wins", 0: "Draw"}
print(f"Result: {result[winner]}")
```

## Epsilon Decay Strategies

```python
def constant_epsilon(episode, epsilon=0.1):
    return epsilon

def linear_decay(episode, start=1.0, end=0.01, decay_episodes=50000):
    return max(end, start - (start - end) * episode / decay_episodes)

def exponential_decay(episode, start=1.0, end=0.01, decay_rate=0.9999):
    return max(end, start * (decay_rate ** episode))


print("Epsilon decay comparison (at episode milestones):")
print(f"{'Episode':>10} {'Constant':>10} {'Linear':>10} {'Exponential':>12}")
for ep in [0, 1000, 5000, 10000, 50000, 100000]:
    print(f"{ep:>10} {constant_epsilon(ep):>10.4f} "
          f"{linear_decay(ep):>10.4f} {exponential_decay(ep):>12.4f}")
```

## Q-Learning Convergence

Q-learning converges to optimal Q-values under these conditions:

```
  +--------------------------------------------------+
  | CONVERGENCE GUARANTEES:                          |
  |                                                  |
  | 1. Every state-action pair is visited infinitely |
  |    often (exploration never fully stops)         |
  |                                                  |
  | 2. Learning rate satisfies:                      |
  |    SUM alpha_t = infinity                        |
  |    SUM alpha_t^2 < infinity                      |
  |                                                  |
  |    (e.g., alpha_t = 1/t works, constant doesn't  |
  |     but constant works well in practice)         |
  |                                                  |
  | 3. The MDP has finite states and actions         |
  +--------------------------------------------------+
```

## Q-Learning vs SARSA Side by Side

```
  SAME setup, SAME environment, DIFFERENT updates:

  +---------------------------+---------------------------+
  | SARSA (on-policy)         | Q-Learning (off-policy)   |
  +---------------------------+---------------------------+
  | Choose a' with epsilon    | Find max Q(s', a')        |
  | Q(s,a) += alpha *         | Q(s,a) += alpha *         |
  |  (r + g*Q(s',a') - Q(s,a))|  (r + g*max Q(s',.) - Q) |
  +---------------------------+---------------------------+
  | Learns value of the       | Learns value of the       |
  | policy it's FOLLOWING     | OPTIMAL policy            |
  | (including exploration)   | (ignoring exploration)    |
  +---------------------------+---------------------------+
  | Conservative near cliffs  | Optimal but riskier       |
  | (avoids edges)            | (walks along edges)       |
  +---------------------------+---------------------------+
```

## Exercises

1. **Play the agent**: Modify the tic-tac-toe code so you can play against
   the trained agent. Input your moves as 0-8. Can you beat it?

2. **Epsilon schedule**: Train the tic-tac-toe agent with linear decay
   (start=1.0, end=0.01). Compare win rates against the constant epsilon
   version. Which produces a stronger agent?

3. **Q-table analysis**: After training, find the state with the highest
   Q-value spread (max Q - min Q). What does this state look like? Why
   is the choice so clear-cut there?

4. **Connect Four**: Extend the tic-tac-toe implementation to a simplified
   4x4 Connect Four. How much longer does training take? Does Q-learning
   still converge?

5. **Double Q-learning**: Q-learning can overestimate values (maximization
   bias). Implement Double Q-learning: maintain two Q-tables, randomly
   pick which one to update, use the other to select the best action.
   Compare against standard Q-learning on the grid world.

---

[Next: Deep Q-Networks ->](08-deep-q-networks.md)
