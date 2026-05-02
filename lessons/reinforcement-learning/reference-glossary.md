# Reinforcement Learning Glossary

---

## A

**Action** — A choice the agent makes at each timestep. Can be discrete (left, right) or continuous (force = 3.7N).

**Actor** — The component that selects actions (the policy network). In actor-critic methods, paired with a critic.

**Actor-Critic** — Architecture combining a policy (actor) and value function (critic). Actor decides actions, critic evaluates them.

**Advantage Function A(s,a)** — How much better action a is compared to the average action in state s. A(s,a) = Q(s,a) - V(s).

**Agent** — The learner and decision maker that interacts with the environment.

---

## B

**Bandit** — Simplified RL with no state transitions. Agent picks from K arms, each with unknown reward distribution.

**Batch RL / Offline RL** — Learning from a fixed dataset of past experiences without further interaction with the environment.

**Bellman Equation** — Recursive relationship defining optimal values: V*(s) = max_a [R(s,a) + gamma * V*(s')].

**Bootstrap** — Using an estimate to update an estimate. TD methods bootstrap (use V(s') to update V(s)). Monte Carlo does not.

---

## C

**Clipping (PPO)** — Limiting the policy ratio to [1-eps, 1+eps] to prevent destructive updates.

**Contextual Bandit** — Bandit where reward depends on both the action and a context (features).

**Continuous Action Space** — Actions are real-valued vectors (e.g., torque, velocity). Requires policy gradient or SAC/TD3.

**Critic** — The component that evaluates states or actions (the value network). Provides learning signal to the actor.

**Curiosity** — Intrinsic reward based on prediction error. Encourages exploring novel states.

---

## D

**DDPG (Deep Deterministic Policy Gradient)** — Off-policy actor-critic for continuous actions. Uses a deterministic policy.

**Discount Factor (gamma)** — How much the agent values future rewards vs immediate. gamma=0.99: long-term planning. gamma=0: greedy.

**DPO (Direct Preference Optimization)** — Method to align language models from human preferences without a separate reward model.

**DQN (Deep Q-Network)** — Q-learning with neural networks. Uses experience replay and target networks for stability.

---

## E

**Entropy** — Measure of randomness in the policy. High entropy = more exploration. Entropy bonus in loss prevents premature convergence.

**Environment** — Everything the agent interacts with. Provides states and rewards in response to actions.

**Episode** — One complete sequence from start to terminal state. Training happens over many episodes.

**Epsilon-Greedy** — Exploration strategy: with probability epsilon pick random action, otherwise pick best known action.

**Experience Replay** — Store past transitions in a buffer. Sample randomly for training. Breaks correlations between consecutive samples.

**Exploration** — Taking suboptimal actions to gather information about the environment.

**Exploitation** — Taking the best-known action to maximize immediate reward.

---

## G

**GAE (Generalized Advantage Estimation)** — Method to compute advantages that balances bias and variance using parameter lambda.

**Gradient Clipping** — Limiting the magnitude of gradients to prevent catastrophic updates. Used in PPO.

---

## I

**Importance Sampling** — Technique to reuse data collected under a different policy. Ratio = pi_new(a|s) / pi_old(a|s).

**Intrinsic Motivation** — Reward generated internally by the agent (curiosity, surprise) rather than from the environment.

---

## K

**KL Divergence (Kullback-Leibler)** — Measure of how different two probability distributions are. Used in RLHF to prevent policy from drifting too far from reference.

---

## M

**Markov Decision Process (MDP)** — Formal framework for sequential decision-making: (States, Actions, Transitions, Rewards, Discount).

**Markov Property** — The future depends only on the current state, not the history. P(s'|s,a) doesn't depend on s_{t-2}, s_{t-3}, etc.

**Model-Based RL** — Learning a model of the environment (transition + reward functions) and using it for planning.

**Model-Free RL** — Learning directly from experience without building an environment model. DQN, PPO, SAC are model-free.

**Monte Carlo Methods** — Estimate values by averaging complete episode returns. No bootstrapping.

---

## O

**Off-Policy** — Learning from data collected by a different policy. DQN, SAC, TD3 are off-policy. More sample efficient.

**On-Policy** — Learning only from data collected by the current policy. REINFORCE, PPO, A2C are on-policy. Must discard old data.

**Optimal Policy (pi*)** — The policy that maximizes expected cumulative reward from any state.

---

## P

**Policy (pi)** — Mapping from states to actions (or action probabilities). pi(a|s) = probability of action a in state s.

**Policy Gradient** — Directly optimizing the policy by computing gradients of expected return with respect to policy parameters.

**PPO (Proximal Policy Optimization)** — Policy gradient with clipped objective for stable updates. The default RL algorithm.

---

## Q

**Q-Function Q(s,a)** — Expected cumulative reward from taking action a in state s and following the policy thereafter.

**Q-Learning** — Off-policy algorithm that learns Q(s,a) using the Bellman optimality equation. Q(s,a) += alpha * (r + gamma * max Q(s',a') - Q(s,a)).

---

## R

**Regret** — Cumulative difference between the optimal arm's reward and the chosen arm's reward (bandits).

**Reward** — Scalar signal from the environment indicating how good the last action was.

**Reward Hacking** — Agent optimizes the given reward in unintended ways that don't achieve the actual goal.

**Reward Model** — Neural network trained on human preferences to predict reward scores. Used in RLHF.

**Reward Shaping** — Adding auxiliary rewards to guide learning without changing the optimal policy.

**RLHF (RL from Human Feedback)** — Training a reward model from human preferences, then using PPO to optimize a policy against it.

**Rollout** — Executing a policy in the environment to collect a sequence of experiences.

---

## S

**SAC (Soft Actor-Critic)** — Off-policy actor-critic that maximizes entropy alongside reward. Robust exploration for continuous control.

**Sample Efficiency** — How much data (interactions) the algorithm needs to learn a good policy. Off-policy methods are more efficient.

**Self-Play** — Agent trains against copies of itself. Used in AlphaGo, AlphaZero.

**Sparse Reward** — Reward signal only at specific events (reaching goal). Hard to learn from.

**State** — Observation of the environment at a given timestep.

---

## T

**TD Error (Temporal Difference)** — delta = r + gamma * V(s') - V(s). The surprise signal: actual reward + bootstrapped future vs expected.

**TD3 (Twin Delayed DDPG)** — Improved DDPG with twin critics, delayed policy updates, and target policy smoothing.

**Thompson Sampling** — Bandit strategy: sample from posterior distribution of each arm's reward, play the highest sample.

**Trajectory** — Complete sequence of (state, action, reward) tuples for one episode.

**Trust Region** — Constraint on how much the policy can change in one update. TRPO enforces explicitly, PPO approximates via clipping.

---

## U

**UCB (Upper Confidence Bound)** — Bandit strategy: pick arm with highest (estimated value + exploration bonus). Optimism in face of uncertainty.

---

## V

**Value Function V(s)** — Expected cumulative reward from state s following the current policy. V(s) = E[sum of discounted rewards | s].

---

## W

**World Model** — Learned simulation of the environment. Agent can "imagine" outcomes without real interaction.
