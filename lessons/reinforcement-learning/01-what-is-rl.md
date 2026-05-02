# Lesson 1: What is Reinforcement Learning?

## The Dog Training Analogy

Imagine training a puppy to sit:

```
  Round 1:                    Round 2:                    Round 50:

  You: "Sit!"                You: "Sit!"                 You: "Sit!"
  Dog: *stares blankly*      Dog: *half sits*            Dog: *sits immediately*
  You: (no treat)            You: "Good boy!" + treat    You: "Good boy!" + treat

  Dog learns: that           Dog learns: sitting         Dog learns: sitting
  didn't work                = treat = GOOD              on command is
                                                         always rewarding
```

This is reinforcement learning in a nutshell. The dog (agent) interacts with
the world (environment), tries things (actions), and learns from feedback
(rewards). No one shows the dog a dataset of "correct sits" -- it learns by
trial and error.

## The RL Loop

Every RL system follows this loop:

```
         +-------------------------------------------+
         |                                           |
         v                                           |
    +---------+    action     +-------------+        |
    |  AGENT  | -----------> | ENVIRONMENT |        |
    |         |              |             |        |
    | (brain) | <----------- | (the world) |        |
    +---------+  state +     +-------------+        |
                 reward                              |
         |                                           |
         +-------------------------------------------+
                    repeats every timestep
```

At each timestep:
1. Agent observes the current **state**
2. Agent chooses an **action**
3. Environment returns a new **state** and a **reward**
4. Agent updates its strategy based on the reward
5. Repeat

## How RL Differs from Other ML

```
+---------------------+------------------+-------------------+
| Supervised Learning | Unsupervised     | Reinforcement     |
|                     | Learning         | Learning          |
+---------------------+------------------+-------------------+
| "Here's the answer" | "Find patterns"  | "Figure it out,   |
|                     |                  |  I'll tell you    |
|                     |                  |  if you're warm"  |
+---------------------+------------------+-------------------+
| Labeled data        | No labels        | Rewards (delayed) |
| Teacher tells you   | No teacher       | Critic scores you |
| i.i.d. samples      | i.i.d. samples   | Sequential data   |
| Predict outputs     | Find structure   | Maximize reward   |
+---------------------+------------------+-------------------+
```

Key differences for RL:
- **No labeled examples** -- the agent discovers good behavior
- **Delayed rewards** -- a chess move might only pay off 20 moves later
- **Actions affect future states** -- what you do now changes what you see next
- **Exploration vs exploitation** -- try new things or stick with what works?

## Core Vocabulary

```
AGENT        = the learner/decision-maker (the dog)
ENVIRONMENT  = everything the agent interacts with (the room, you, the floor)
STATE (s)    = current situation (dog sees your hand signal)
ACTION (a)   = what the agent does (sit, bark, spin)
REWARD (r)   = feedback signal (treat = +1, scolding = -1)
POLICY (pi)  = agent's strategy: state -> action
EPISODE      = one complete run (one training session)
TIMESTEP (t) = one tick of the clock
```

## A Simple RL Agent in Code

Let's build a toy agent that learns which slot machine pays best:

```python
import numpy as np

num_actions = 3
true_rewards = [0.2, 0.5, 0.8]

q_values = np.zeros(num_actions)
action_counts = np.zeros(num_actions)

num_episodes = 1000
epsilon = 0.1

for episode in range(num_episodes):
    if np.random.random() < epsilon:
        action = np.random.randint(num_actions)
    else:
        action = np.argmax(q_values)

    reward = 1.0 if np.random.random() < true_rewards[action] else 0.0

    action_counts[action] += 1
    q_values[action] += (reward - q_values[action]) / action_counts[action]

print("Learned Q-values:", q_values)
print("True probabilities:", true_rewards)
print("Best action:", np.argmax(q_values))
```

Running this, you'll see the agent discovers that action 2 (index 2) pays
best, matching the true probability of 0.8.

## The Grid World Example

Grid worlds are the "Hello World" of RL:

```
+---+---+---+---+
|   |   |   | G |    G = Goal (+1 reward)
+---+---+---+---+    X = Pit  (-1 reward)
|   | # |   | X |    # = Wall (can't enter)
+---+---+---+---+    S = Start
| S |   |   |   |
+---+---+---+---+

Agent can move: UP, DOWN, LEFT, RIGHT
Each step costs -0.04 (encourages finding the goal quickly)
```

```python
import numpy as np

GRID = [
    [0,    0,    0,    1],
    [0,    None, 0,   -1],
    [0,    0,    0,    0],
]
ROWS, COLS = 3, 4
ACTIONS = [(0, 1), (0, -1), (1, 0), (-1, 0)]
ACTION_NAMES = ["RIGHT", "LEFT", "DOWN", "UP"]
START = (2, 0)
STEP_COST = -0.04

def is_terminal(state):
    row, col = state
    return GRID[row][col] is not None and GRID[row][col] != 0

def step(state, action_idx):
    row, col = state
    dr, dc = ACTIONS[action_idx]
    new_row = max(0, min(ROWS - 1, row + dr))
    new_col = max(0, min(COLS - 1, col + dc))

    if GRID[new_row][new_col] is None:
        new_row, new_col = row, col

    new_state = (new_row, new_col)
    cell_value = GRID[new_row][new_col]

    if cell_value == 1:
        return new_state, 1.0, True
    elif cell_value == -1:
        return new_state, -1.0, True
    else:
        return new_state, STEP_COST, False

q_table = np.zeros((ROWS, COLS, len(ACTIONS)))
epsilon = 0.3
alpha = 0.1
gamma = 0.9

for episode in range(5000):
    state = START
    done = False

    while not done:
        row, col = state
        if np.random.random() < epsilon:
            action = np.random.randint(len(ACTIONS))
        else:
            action = np.argmax(q_table[row, col])

        next_state, reward, done = step(state, action)
        nr, nc = next_state

        best_next = np.max(q_table[nr, nc])
        q_table[row, col, action] += alpha * (
            reward + gamma * best_next * (1 - done) - q_table[row, col, action]
        )
        state = next_state

print("Learned policy:")
for row in range(ROWS):
    row_str = ""
    for col in range(COLS):
        if GRID[row][col] is None:
            row_str += "  #   "
        elif GRID[row][col] == 1:
            row_str += "  G   "
        elif GRID[row][col] == -1:
            row_str += "  X   "
        else:
            best = np.argmax(q_table[row, col])
            row_str += f" {ACTION_NAMES[best]:>5} "
    print(row_str)
```

## Why RL Matters

```
+------------------+----------------------------------------+
| Domain           | What RL Does                           |
+------------------+----------------------------------------+
| Games            | AlphaGo, Atari, StarCraft              |
| Robotics         | Walk, grasp, navigate                  |
| LLMs             | RLHF makes ChatGPT helpful             |
| Recommendations  | Netflix, YouTube personalization       |
| Finance          | Portfolio optimization                 |
| Self-driving     | Lane keeping, intersection decisions   |
+------------------+----------------------------------------+
```

The biggest recent impact: **RLHF** (Reinforcement Learning from Human
Feedback) is what transforms a raw language model into a helpful assistant.
We'll cover this in depth in Lesson 14.

## Exercises

1. **Modify the slot machine code**: Add a 4th action with reward probability
   0.9. Verify the agent finds it. Try different epsilon values (0.01, 0.5)
   and see how learning speed changes.

2. **Grid world exploration**: Change the step cost from -0.04 to -0.5.
   How does the learned policy change? Why?

3. **Conceptual**: A chess AI wins a game after 40 moves. Which move gets
   the reward? How is this different from supervised learning where every
   input has a label? This is the "credit assignment problem."

4. **Real-world RL**: Pick an app you use daily (Spotify, YouTube, etc).
   Identify the agent, environment, states, actions, and rewards in their
   recommendation system.

---

[Next: Markov Decision Processes ->](02-markov-decision-processes.md)
