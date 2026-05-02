# Lesson 12: Multi-Armed Bandits

> You're in a casino with 10 slot machines. Each has a
> different (unknown) payout rate. How do you maximize
> your winnings? Explore new machines or exploit the best?

---

## The Exploration-Exploitation Dilemma

```
  YOU'VE PLAYED 100 ROUNDS:
  Machine A: played 50 times, average reward = $8
  Machine B: played 5 times, average reward = $12
  Machine C: played 45 times, average reward = $6

  WHICH DO YOU PLAY NEXT?

  EXPLOIT: Play B (highest average = $12)
  But: only 5 samples! Could be lucky.

  EXPLORE: Play C more (maybe it's actually better)
  But: C looks bad so far. Why waste pulls?

  EXPLORE: Try a new machine D (no data at all)
  But: opportunity cost of not playing B.

  THE TRADEOFF:
  +--explore---+---exploit---+
  |            |             |
  | Try new    | Play the    |
  | things to  | current     |
  | learn more | best to     |
  |            | earn more   |
  +------------+-------------+
  Too much explore = never capitalize on knowledge
  Too much exploit = stuck with suboptimal choice
```

---

## Formal Setup

```
  K arms (actions), each with unknown reward distribution.

  At each round t:
  1. Agent selects arm a_t
  2. Receives reward r_t ~ R(a_t)
  3. Updates estimates

  GOAL: maximize total reward over T rounds.

  REGRET: how much worse you do vs always picking the best arm.
  Regret(T) = T * mu* - SUM_{t=1}^{T} E[r_t]

  mu* = expected reward of the BEST arm
  Lower regret = better strategy.
  Optimal regret grows as O(log T) — you can't do better!
```

---

## Strategy 1: Epsilon-Greedy

```
  With probability epsilon: explore (random arm)
  With probability 1-epsilon: exploit (best arm)

  epsilon = 0.1 means:
  10% of the time: pick a random arm
  90% of the time: pick the arm with highest average reward

  SIMPLE. But:
  - Explores uniformly (wastes time on clearly bad arms)
  - Fixed exploration rate (even after 10,000 rounds)
  - Doesn't account for uncertainty
```

```python
import numpy as np

class EpsilonGreedy:
    def __init__(self, n_arms, epsilon=0.1):
        self.n_arms = n_arms
        self.epsilon = epsilon
        self.counts = np.zeros(n_arms)
        self.values = np.zeros(n_arms)

    def select_arm(self):
        if np.random.random() < self.epsilon:
            return np.random.randint(self.n_arms)
        return np.argmax(self.values)

    def update(self, arm, reward):
        self.counts[arm] += 1
        n = self.counts[arm]
        self.values[arm] += (reward - self.values[arm]) / n
```

---

## Strategy 2: Upper Confidence Bound (UCB1)

```
  IDEA: be optimistic about uncertain arms.

  For each arm, compute:
  UCB(a) = Q(a) + c * sqrt(ln(t) / N(a))
           ^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^
           exploit      explore bonus
           (average     (high when arm is
            reward)      underexplored)

  Select arm with highest UCB.

  NEW ARM (N=1):   UCB = Q + c * sqrt(ln(1000)/1) = Q + c*2.6
  WELL-KNOWN (N=500): UCB = Q + c * sqrt(ln(1000)/500) = Q + c*0.12

  Uncertain arm gets a HUGE bonus.
  As you explore it, bonus shrinks.
  Natural, automatic balancing of explore/exploit!

  c = sqrt(2) is the theoretical optimal.
```

```python
import numpy as np

class UCB1:
    def __init__(self, n_arms, c=np.sqrt(2)):
        self.n_arms = n_arms
        self.c = c
        self.counts = np.zeros(n_arms)
        self.values = np.zeros(n_arms)
        self.total_count = 0

    def select_arm(self):
        for arm in range(self.n_arms):
            if self.counts[arm] == 0:
                return arm

        ucb_values = self.values + self.c * np.sqrt(
            np.log(self.total_count) / self.counts
        )
        return np.argmax(ucb_values)

    def update(self, arm, reward):
        self.counts[arm] += 1
        self.total_count += 1
        n = self.counts[arm]
        self.values[arm] += (reward - self.values[arm]) / n
```

---

## Strategy 3: Thompson Sampling

```
  IDEA: maintain a probability distribution over each arm's
  true reward. Sample from the distribution. Play the arm
  with the highest sample.

  FOR BERNOULLI REWARDS (0 or 1):
  Each arm has a Beta(alpha, beta) distribution.
  alpha = successes + 1
  beta = failures + 1

  At each round:
  1. Sample theta_a ~ Beta(alpha_a, beta_a) for each arm
  2. Play arm with highest theta_a
  3. Update: if success, alpha_a += 1; if failure, beta_a += 1

  WHY THIS WORKS:
  - Uncertain arms: wide distribution, sometimes samples high
    -> gets explored
  - Certain good arms: narrow distribution, usually samples high
    -> gets exploited
  - Certain bad arms: narrow distribution, samples low
    -> naturally ignored

  ROUND 1:  All arms Beta(1,1) = uniform
  ROUND 100: Good arm Beta(45,6) = peaked near 0.88
             Bad arm Beta(3,22) = peaked near 0.12
             Untested arm Beta(1,1) = still uniform (explores!)
```

```python
import numpy as np

class ThompsonSampling:
    def __init__(self, n_arms):
        self.n_arms = n_arms
        self.alpha = np.ones(n_arms)
        self.beta = np.ones(n_arms)

    def select_arm(self):
        samples = np.random.beta(self.alpha, self.beta)
        return np.argmax(samples)

    def update(self, arm, reward):
        if reward > 0.5:
            self.alpha[arm] += 1
        else:
            self.beta[arm] += 1
```

---

## Comparison

```python
def run_bandit_experiment(strategy, true_probs, n_rounds=10000):
    n_arms = len(true_probs)
    rewards = np.zeros(n_rounds)
    best_arm = np.argmax(true_probs)
    optimal_count = 0

    for t in range(n_rounds):
        arm = strategy.select_arm()
        reward = np.random.binomial(1, true_probs[arm])
        strategy.update(arm, reward)
        rewards[t] = reward
        if arm == best_arm:
            optimal_count += 1

    cumulative_regret = np.cumsum(
        np.max(true_probs) - np.array([true_probs[0]] * n_rounds)
    )

    return {
        "total_reward": rewards.sum(),
        "optimal_pct": optimal_count / n_rounds * 100,
        "avg_reward": rewards.mean(),
    }


true_probs = [0.1, 0.3, 0.5, 0.7, 0.2]

for name, strategy in [
    ("Epsilon-Greedy", EpsilonGreedy(5, epsilon=0.1)),
    ("UCB1", UCB1(5)),
    ("Thompson Sampling", ThompsonSampling(5)),
]:
    results = run_bandit_experiment(strategy, true_probs)
    print(f"{name:20s}: reward={results['total_reward']:.0f}, "
          f"optimal={results['optimal_pct']:.1f}%")
```

---

## Real-World Applications

```
  +---------------------------+-----------------------------------+
  | Application               | How Bandits Are Used              |
  +---------------------------+-----------------------------------+
  | A/B Testing               | Each variant is an arm.           |
  |                           | Bandit adapts traffic to winner.  |
  +---------------------------+-----------------------------------+
  | Ad Placement              | Each ad is an arm.                |
  |                           | Maximize click-through rate.      |
  +---------------------------+-----------------------------------+
  | Recommendation            | Each item is an arm.              |
  |                           | Balance showing known-good items  |
  |                           | vs discovering user preferences.  |
  +---------------------------+-----------------------------------+
  | Clinical Trials           | Each treatment is an arm.         |
  |                           | Minimize patient exposure to      |
  |                           | worse treatments.                 |
  +---------------------------+-----------------------------------+
  | Hyperparameter Tuning     | Each configuration is an arm.     |
  |                           | Allocate compute to promising     |
  |                           | configurations.                   |
  +---------------------------+-----------------------------------+
```

---

## Contextual Bandits

```
  STANDARD BANDIT: reward depends only on arm.

  CONTEXTUAL BANDIT: reward depends on arm AND context.

  EXAMPLE: news recommendation
  Context: user features (age, location, interests)
  Arms: news articles to show
  Reward: click or no click

  Different users respond differently to the same article!

  User A (sports fan):  article about football -> high reward
  User B (tech reader): article about football -> low reward

  ALGORITHM: LinUCB
  For each arm a, model reward as:
  r = x^T * theta_a  (linear in context features x)

  UCB for each arm:
  UCB_a = x^T * theta_a + alpha * sqrt(x^T * A_a^{-1} * x)

  Select arm with highest UCB.
```

---

## Exercises

### Exercise 1: Strategy Comparison

Run all three strategies (epsilon-greedy, UCB1, Thompson)
on the same 10-arm problem for 10,000 rounds.
Plot cumulative regret over time for each.
Which converges fastest?

### Exercise 2: Nonstationary Bandits

The true reward probabilities change over time:
- Every 1000 rounds, each arm's probability shifts by +/- 0.1
- Modify epsilon-greedy to use a sliding window (last 200 rewards)
- Compare with standard epsilon-greedy and Thompson Sampling
- Which adapts best to changing rewards?

### Exercise 3: A/B Testing vs Bandit

Simulate a website with 3 page designs:
- Design A: 5% conversion rate
- Design B: 7% conversion rate
- Design C: 3% conversion rate
Compare total conversions over 10,000 visitors:
1. Traditional A/B test (equal split, pick winner at end)
2. Epsilon-greedy bandit
3. Thompson Sampling

### Exercise 4: Contextual Bandit for Recommendations

Implement a simple contextual bandit:
- 5 items to recommend
- User features: [age_bucket, gender, device]
- Reward: 1 (click) or 0 (no click)
- Use a linear model per arm
- Show that the bandit learns different preferences

---

## Key Takeaways

```
  1. Explore vs exploit: the fundamental RL tradeoff
  2. Epsilon-greedy: simple but wastes exploration
  3. UCB1: optimism in face of uncertainty (explore uncertain arms)
  4. Thompson Sampling: sample from posterior, naturally balances
  5. Thompson Sampling often wins in practice
  6. Optimal regret is O(log T) — can't do better
  7. Contextual bandits condition on user/situation features
  8. Used in A/B testing, ads, recommendations, clinical trials
  9. Bandits are RL without state transitions
  10. Great starting point when you don't need full RL
```

---

Next: [Lesson 13 — Reward Shaping](./13-reward-shaping.md)
