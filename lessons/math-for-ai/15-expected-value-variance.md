# Lesson 15: Expected Value & Variance

> **Analogy:** Casino math. The house always wins because it
> understands expected value. Variance is why individual gamblers
> sometimes walk away rich.

---

## Expected Value: The Long-Run Average

```
  COIN FLIP BET
  =============

  You flip a fair coin:
  Heads: you win $10
  Tails: you lose $8

  Expected Value = P(heads) * $10 + P(tails) * (-$8)
                 = 0.5 * 10 + 0.5 * (-8)
                 = 5 - 4
                 = $1

  On average, you win $1 per flip.
  Play 1000 times --> expect ~$1000 profit.

  ┌────────────────────────────────────────┐
  │  E[X] = sum of (value * probability)   │
  │                                        │
  │  E[X] = Σ x_i * P(x_i)   (discrete)  │
  │                                        │
  │  E[X] = ∫ x * f(x) dx    (continuous) │
  └────────────────────────────────────────┘
```

---

## Expected Value in AI

```
  CLASSIFICATION LOSS
  ===================

  Model predicts class probabilities: [0.7, 0.2, 0.1]
  True class: 0

  Cross-entropy loss = -log(P(true class))
                     = -log(0.7)
                     = 0.357

  Expected loss over the dataset:
  E[loss] = (1/N) * Σ loss_i

  This IS the training objective.
  Minimizing expected loss = training the model.

  REWARD IN REINFORCEMENT LEARNING
  ================================

  E[total reward] = Σ P(trajectory) * reward(trajectory)

  The agent maximizes EXPECTED reward, not
  the reward of any single episode.
```

---

## Computing Expected Value

```python
import numpy as np

outcomes = np.array([10, -8])
probabilities = np.array([0.5, 0.5])

expected_value = np.sum(outcomes * probabilities)
print(f"E[X] = ${expected_value:.2f}")

die_outcomes = np.array([1, 2, 3, 4, 5, 6])
die_probs = np.ones(6) / 6

ev_die = np.sum(die_outcomes * die_probs)
print(f"E[die] = {ev_die:.2f}")

np.random.seed(42)
rolls = np.random.choice(die_outcomes, size=100_000)
empirical_mean = rolls.mean()
print(f"Empirical mean (100k rolls) = {empirical_mean:.3f}")
print(f"Theoretical E[X] = {ev_die:.3f}")
```

---

## Properties of Expected Value

```
  LINEARITY (the most useful property)
  =====================================

  E[aX + b] = a * E[X] + b

  E[X + Y] = E[X] + E[Y]   (ALWAYS, even if dependent!)

  Example:
  Portfolio with 3 stocks:
  E[total return] = E[stock_A] + E[stock_B] + E[stock_C]

  You can compute expected return of a portfolio
  without knowing correlations between stocks!

  In ML:
  E[total_loss] = E[loss_sample_1] + E[loss_sample_2] + ...
  That's why mini-batch gradient is unbiased.
```

---

## Variance: Measuring Spread

```
  TWO GAMES, SAME EXPECTED VALUE
  ===============================

  Game A: Win $1 always.            E[A] = $1, Var = 0
  Game B: Win $1000 or lose $998.   E[B] = $1, Var = huge

  Both have E[X] = $1, but they feel VERY different.

  ┌─────────────────────────────────────────────────┐
  │  Var(X) = E[(X - E[X])^2]                       │
  │         = E[X^2] - (E[X])^2                      │
  │                                                   │
  │  Standard deviation: σ = sqrt(Var(X))             │
  │                                                   │
  │  σ has the same units as X                        │
  │  Var has squared units                            │
  └─────────────────────────────────────────────────┘

  Low variance:                High variance:
  ──── ─ ── ── ─ ────          ─        ──    ───      ─
       ████████                   ██        ████   ██
  Predictions are consistent   Predictions are all over
```

---

## Computing Variance

```python
import numpy as np

game_a = np.array([1])
prob_a = np.array([1.0])

game_b = np.array([1000, -998])
prob_b = np.array([0.5, 0.5])

def expected_value(outcomes, probs):
    return np.sum(outcomes * probs)

def variance(outcomes, probs):
    ev = expected_value(outcomes, probs)
    return np.sum(probs * (outcomes - ev) ** 2)

print(f"Game A: E={expected_value(game_a, prob_a)}, Var={variance(game_a, prob_a)}")
print(f"Game B: E={expected_value(game_b, prob_b)}, Var={variance(game_b, prob_b)}")

data = np.random.randn(10_000)
print(f"\nStandard normal:")
print(f"  Mean: {data.mean():.3f} (expected: 0)")
print(f"  Var:  {data.var():.3f} (expected: 1)")
print(f"  Std:  {data.std():.3f} (expected: 1)")
```

---

## Variance in ML

```
  BIAS-VARIANCE TRADEOFF
  ======================

  Total Error = Bias^2 + Variance + Irreducible Noise

  ┌───────────────────────────────────────────────┐
  │ Model Complexity -->                           │
  │                                                │
  │ Error                                          │
  │  |  \                    /                     │
  │  |   \    ___          /     Variance          │
  │  |    \  /   \       /                         │
  │  |     \/     \    /                           │
  │  |    SWEET    \  /                            │
  │  |    SPOT      \/                             │
  │  |         Bias                                │
  │  +────────────────────────>                    │
  │     Simple            Complex                  │
  └───────────────────────────────────────────────┘

  High bias:     model is too simple (underfitting)
  High variance: model is too complex (overfitting)
```

```python
import numpy as np
from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=500, n_features=20, random_state=42)

depths = [1, 3, 5, 10, 20, None]
for depth in depths:
    model = DecisionTreeClassifier(max_depth=depth, random_state=42)
    scores = cross_val_score(model, X, y, cv=10)
    print(f"Depth={str(depth):>4s}: mean={scores.mean():.3f}, std={scores.std():.3f}")
```

---

## Covariance and Correlation

```
  COVARIANCE: Do two variables move together?
  ============================================

  Cov(X, Y) = E[(X - E[X]) * (Y - E[Y])]

  Cov > 0: X goes up, Y tends to go up
  Cov < 0: X goes up, Y tends to go down
  Cov = 0: No linear relationship

  CORRELATION: Normalized covariance (-1 to +1)
  ==============================================

  Corr(X, Y) = Cov(X, Y) / (σ_X * σ_Y)

  +1: perfect positive linear relationship
   0: no linear relationship
  -1: perfect negative linear relationship
```

```python
import numpy as np

np.random.seed(42)
n = 1000

x = np.random.randn(n)
y_positive = 2 * x + np.random.randn(n) * 0.5
y_negative = -x + np.random.randn(n) * 0.5
y_none = np.random.randn(n)

print("Correlations:")
print(f"  Positive: {np.corrcoef(x, y_positive)[0, 1]:.3f}")
print(f"  Negative: {np.corrcoef(x, y_negative)[0, 1]:.3f}")
print(f"  None:     {np.corrcoef(x, y_none)[0, 1]:.3f}")

cov_matrix = np.cov(np.stack([x, y_positive, y_negative]))
print(f"\nCovariance matrix shape: {cov_matrix.shape}")
print(cov_matrix.round(3))
```

---

## Standard Error: Uncertainty of Estimates

```
  You measure the average height of 30 people: 170 cm
  How confident are you in that number?

  Standard Error = σ / sqrt(n)

  σ = 10 cm, n = 30
  SE = 10 / sqrt(30) = 1.83 cm

  95% confidence: 170 ± 1.96 * 1.83 = [166.4, 173.6]

  More samples --> smaller SE --> more confident

  ┌───────────────────────────────────────┐
  │  n = 10:   SE = 3.16   wide range    │
  │  n = 100:  SE = 1.00   tighter       │
  │  n = 1000: SE = 0.32   very precise  │
  │  n = 10000: SE = 0.10  pinpoint      │
  └───────────────────────────────────────┘
```

```python
import numpy as np

np.random.seed(42)
population = np.random.normal(loc=100, scale=15, size=1_000_000)
true_mean = population.mean()

for n in [10, 50, 100, 500, 1000, 10000]:
    sample = np.random.choice(population, size=n, replace=False)
    se = sample.std(ddof=1) / np.sqrt(n)
    ci_low = sample.mean() - 1.96 * se
    ci_high = sample.mean() + 1.96 * se
    print(f"n={n:>5d}: mean={sample.mean():.2f}, SE={se:.2f}, "
          f"95% CI=[{ci_low:.1f}, {ci_high:.1f}]")

print(f"\nTrue population mean: {true_mean:.2f}")
```

---

## Practical: Estimating Model Performance

```python
import numpy as np
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)

model = RandomForestClassifier(n_estimators=100, random_state=42)
scores = cross_val_score(model, X, y, cv=10)

mean_acc = scores.mean()
std_acc = scores.std()
se_acc = std_acc / np.sqrt(len(scores))

print(f"Accuracy: {mean_acc:.3f} +/- {std_acc:.3f}")
print(f"Standard Error: {se_acc:.3f}")
print(f"95% CI: [{mean_acc - 1.96 * se_acc:.3f}, {mean_acc + 1.96 * se_acc:.3f}]")
```

---

## Key Formulas

```
  ┌──────────────────────────────────────────────────┐
  │  E[X] = Σ x_i * P(x_i)                          │
  │  E[aX + b] = a*E[X] + b                          │
  │  E[X + Y] = E[X] + E[Y]                          │
  │                                                    │
  │  Var(X) = E[X^2] - (E[X])^2                       │
  │  Var(aX + b) = a^2 * Var(X)                       │
  │  Var(X + Y) = Var(X) + Var(Y) + 2*Cov(X,Y)       │
  │  If independent: Var(X + Y) = Var(X) + Var(Y)     │
  │                                                    │
  │  SE = σ / sqrt(n)                                  │
  │  95% CI = mean ± 1.96 * SE                        │
  └──────────────────────────────────────────────────┘
```

---

## Exercises

**Exercise 1:** A casino game costs $5 to play. You roll two dice.
If the sum is 7, you win $20. Otherwise you win nothing. Calculate
the expected value per game. Is it profitable for the player?

**Exercise 2:** Generate 10,000 samples from a normal distribution
with mean=50 and std=10. Compute the empirical mean, variance, and
standard deviation. Compare with theoretical values.

**Exercise 3:** Train a classifier using 5-fold, 10-fold, and
20-fold cross-validation. Compare the mean and standard error of
accuracy across the three strategies. Which gives tighter estimates?

**Exercise 4:** Simulate the bias-variance tradeoff: generate noisy
data from a known function, fit polynomial models of degree 1 through
15, and plot training error vs test error vs model complexity.

**Exercise 5:** Compute the covariance matrix of 5 features from any
dataset. Identify the most correlated and least correlated pairs.
Verify that correlation matches your visual intuition with scatter plots.

---

[Next: Lesson 16 - Maximum Likelihood Estimation ->](16-maximum-likelihood.md)
