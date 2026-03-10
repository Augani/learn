# Lesson 15: Real-World RL Applications

> RL works in games. But the real world is messier.
> Here's where it's actually deployed — and why it's hard.

---

## Robotics

```
  THE CHALLENGE:
  - Real robot = expensive, slow, breakable
  - Can't reset to start state easily
  - Continuous action space (joint angles, forces)
  - Partial observability (sensor noise, occlusion)
  - Safety constraints (don't break the robot or the world)

  SIM-TO-REAL TRANSFER:
  1. Train in simulation (fast, safe, unlimited resets)
  2. Transfer to real robot

  PROBLEM: sim and real are different!
  Physics is approximate. Sensor noise differs.
  Friction, lighting, dynamics all differ.

  SOLUTION: DOMAIN RANDOMIZATION
  Randomize simulation parameters during training:
  - Friction: 0.1 to 1.0 (random each episode)
  - Mass: +/- 30% from nominal
  - Sensor noise: 0 to 5% gaussian
  - Lighting: random colors and positions

  Policy learns to be robust to ALL these variations.
  Real world is just another variation!

  SUCCESSES:
  +-------------------+-----------------------------------+
  | OpenAI Rubik's    | Dexterous hand solves Rubik's     |
  | Cube              | cube. Trained entirely in sim.     |
  +-------------------+-----------------------------------+
  | Boston Dynamics    | RL for locomotion controllers     |
  +-------------------+-----------------------------------+
  | Google RT-2       | Vision-language-action model       |
  +-------------------+-----------------------------------+
  | Figure robotics   | Humanoid robot manipulation       |
  +-------------------+-----------------------------------+
```

---

## Recommendation Systems

```
  WHY RL FOR RECOMMENDATIONS?

  Traditional: predict what user will click (supervised).
  Problem: optimizes for immediate click, not long-term engagement.

  RL approach:
  STATE:   user history (past clicks, watches, skips)
  ACTION:  which item to recommend
  REWARD:  user engagement (watch time, satisfaction score)

  RL optimizes for LONG-TERM engagement, not just next click.

  YOUTUBE EXAMPLE:
  Supervised: recommend clickbait (high CTR)
  RL: recommend content that keeps users watching over
      the full session (higher total watch time)

  BANDIT APPROACH (simpler):
  Each item = an arm.
  Thompson sampling to balance explore/exploit.
  Update based on click/no-click.

  FULL RL APPROACH (more complex):
  Sequential decision: recommend item 1, observe reaction,
  recommend item 2 based on updated state.
  Models the full user session as an episode.

  +-------------------+-----------------------------------+
  | Company           | RL Application                    |
  +-------------------+-----------------------------------+
  | YouTube           | Reinforcement learning for video  |
  |                   | recommendations                   |
  +-------------------+-----------------------------------+
  | Spotify           | Bandits for playlist generation   |
  +-------------------+-----------------------------------+
  | Netflix           | Contextual bandits for artwork    |
  |                   | personalization                   |
  +-------------------+-----------------------------------+
  | Amazon            | Bandits for product ranking       |
  +-------------------+-----------------------------------+
```

---

## Game AI

```
  THE SHOWCASE FOR RL:

  +-------------------+------+-----------------------------------+
  | System            | Year | Achievement                       |
  +-------------------+------+-----------------------------------+
  | TD-Gammon         | 1992 | Expert-level backgammon           |
  +-------------------+------+-----------------------------------+
  | Atari DQN         | 2013 | Superhuman on many Atari games    |
  +-------------------+------+-----------------------------------+
  | AlphaGo           | 2016 | Beat world champion at Go         |
  +-------------------+------+-----------------------------------+
  | AlphaZero         | 2017 | Chess, Go, Shogi from scratch     |
  +-------------------+------+-----------------------------------+
  | OpenAI Five       | 2019 | Beat pro team at Dota 2           |
  +-------------------+------+-----------------------------------+
  | AlphaStar         | 2019 | Grandmaster level StarCraft II    |
  +-------------------+------+-----------------------------------+
  | MuZero            | 2020 | Learn game rules AND play well    |
  +-------------------+------+-----------------------------------+

  ALPHAZERO APPROACH:
  1. Self-play: agent plays against itself
  2. MCTS + neural network for move selection
  3. Train network to predict: win probability + best moves
  4. No human game data needed (tabula rasa)
  5. Discovers novel strategies humans never considered

  WHY GAMES WORK WELL FOR RL:
  + Perfect simulator (game engine)
  + Clear reward (win/lose)
  + Fast episodes (millions of games per day)
  + No safety concerns
```

---

## Autonomous Vehicles

```
  STATE:  camera images, lidar, radar, GPS, map
  ACTION: steering, acceleration, braking
  REWARD: progress + safety + comfort + efficiency

  CHALLENGES:
  1. SAFETY: can't explore randomly on real roads
  2. RARE EVENTS: must handle edge cases (child runs into road)
  3. MULTI-AGENT: other drivers are part of the environment
  4. PARTIAL OBSERVABILITY: occlusion, sensor limits

  APPROACH: mostly NOT pure RL
  +---------------------------------------------------+
  | Perception (supervised learning) -> detect objects |
  | Prediction (supervised) -> predict other agents    |
  | Planning (classical + RL) -> decide actions        |
  | Control (classical) -> execute actions             |
  +---------------------------------------------------+

  RL is used for:
  - Lane change decisions
  - Merging onto highways
  - Parking in tight spaces
  - Handling unstructured environments

  Waymo, Tesla, and others use RL for specific modules,
  not end-to-end driving (yet).

  SIMULATION IS CRITICAL:
  Waymo's simulator runs billions of miles per year.
  Real driving data + procedurally generated scenarios.
```

---

## Data Center Optimization

```
  GOOGLE'S DATA CENTER COOLING:
  DeepMind used RL to optimize cooling in Google's data centers.

  STATE:  temperature sensors, power consumption, weather
  ACTION: cooling system settings (fan speeds, valve positions)
  REWARD: minimize energy while keeping servers cool

  RESULT: 40% reduction in cooling energy.
  Saved millions of dollars.

  WHY RL WORKS HERE:
  + Complex system with many interacting variables
  + Traditional controllers use simple heuristics
  + RL finds non-obvious strategies humans wouldn't try
  + Safety: servers have temperature alarms as hard limits

  CHIP DESIGN:
  Google used RL to design chip floor plans.
  STATE: current chip layout
  ACTION: place next component
  REWARD: minimize wire length + power + area

  RL found layouts competitive with human experts
  in hours vs months of human design.
```

---

## Challenges of Real-World RL

```
  +---------------------------+--------------------------------------+
  | Challenge                 | Why It's Hard                        |
  +---------------------------+--------------------------------------+
  | Sample efficiency         | Real-world data is expensive/slow    |
  |                           | Can't run millions of episodes       |
  +---------------------------+--------------------------------------+
  | Safety                    | Exploration can cause harm           |
  |                           | (crash robot, lose money)            |
  +---------------------------+--------------------------------------+
  | Partial observability     | Agent can't see full state           |
  |                           | (sensor noise, occlusion)            |
  +---------------------------+--------------------------------------+
  | Non-stationarity          | Environment changes over time        |
  |                           | (user preferences, traffic patterns) |
  +---------------------------+--------------------------------------+
  | Reward specification      | Hard to define what "good" means     |
  |                           | (reward hacking, misalignment)       |
  +---------------------------+--------------------------------------+
  | Sim-to-real gap           | Simulation doesn't match reality     |
  +---------------------------+--------------------------------------+
  | Multi-agent               | Other agents are also learning       |
  |                           | (non-stationary from agent's view)   |
  +---------------------------+--------------------------------------+
  | Delayed rewards           | Consequences appear much later       |
  |                           | (treatment outcomes in weeks)        |
  +---------------------------+--------------------------------------+

  SAFE RL APPROACHES:
  1. Constrained optimization (don't violate safety constraints)
  2. Conservative policy updates (small steps, verify safety)
  3. Sim-to-real with safety shields
  4. Human-in-the-loop (human can override)
```

---

## Offline RL (Batch RL)

```
  PROBLEM: can't interact with environment.
  Have a fixed dataset of past experiences.
  Learn a policy from the dataset only.

  EXAMPLE: healthcare
  Dataset: 10,000 patient treatment records.
  Can't experiment on patients (ethical constraints).
  Learn best treatment policy from historical data.

  CHALLENGE: distributional shift.
  Policy might want to try actions not in the dataset.
  No data to evaluate those actions!

  SOLUTION: conservative Q-learning (CQL)
  Penalize Q-values for actions not in the dataset.
  Stay close to the behavior policy that collected the data.

  USED IN:
  - Healthcare treatment optimization
  - Education (personalized tutoring from past student data)
  - Industrial control (from historical sensor logs)
  - Dialogue systems (from conversation logs)
```

---

## Exercises

### Exercise 1: Domain Randomization

Implement domain randomization for CartPole:
1. Randomize pole length (0.5x to 2x)
2. Randomize cart mass (0.5x to 2x)
3. Randomize force magnitude (5 to 15)
4. Train one policy across all variations
5. Test on a fixed "real" CartPole. Does it generalize?

### Exercise 2: Recommendation Bandit

Build a simple recommendation system:
1. 20 items, each with a hidden quality score
2. 5 user types, each preferring different item categories
3. Use contextual bandits (context = user type)
4. Compare: random, epsilon-greedy, Thompson Sampling, LinUCB
5. Plot cumulative reward over 10,000 recommendations

### Exercise 3: Safe Exploration

Implement constrained RL for a grid world:
1. Goal: reach the target
2. Constraint: never enter "lava" cells
3. Use Lagrangian relaxation to enforce constraints
4. Compare with unconstrained RL (does it visit lava?)

### Exercise 4: Offline RL Experiment

From a fixed dataset of CartPole episodes (collected by
a random policy), train a policy using:
1. Behavioral cloning (supervised, imitate the dataset)
2. Conservative Q-learning (penalize OOD actions)
3. Compare with online RL (normal DQN)

---

## Key Takeaways

```
  1. Sim-to-real transfer: train in simulation, deploy on real robot
  2. Domain randomization makes policies robust to real-world variation
  3. Recommendations: bandits for simple, full RL for sequential
  4. Game AI: RL's biggest successes (AlphaGo, AlphaZero, OpenAI Five)
  5. Autonomous driving: RL for specific modules, not end-to-end
  6. Data centers: RL found 40% cooling energy savings
  7. Safety is THE challenge for real-world RL
  8. Offline RL: learn from fixed datasets without interaction
  9. Sample efficiency limits real-world applications
  10. Most deployed RL is simpler than research papers suggest
```

---

Next: [Lesson 16 — Build an RL Agent (Capstone)](./16-build-rl-agent.md)
