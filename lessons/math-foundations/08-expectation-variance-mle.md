# Lesson 08: Expectation, Variance, and MLE — The Statistics Behind Training

When you train a model, you are implicitly doing statistics. The loss
function is an expected value. Overfitting is a variance problem.
Maximum likelihood estimation is the mathematical justification for
why we use cross-entropy loss. This lesson connects the dots.

---

## The Core Idea: Expected Value

The **expected value** (mean) is the average outcome you would get if
you repeated an experiment many times. It is the "center" of a
probability distribution.

**Analogy: Batting average.** A player who bats .300 does not get a hit
exactly 30% of the time in every game. But over a season, their average
converges to .300. That is the expected value of their hitting.

```
Expected value of a die roll:

    E[X] = Σ xᵢ × P(xᵢ)
         = 1×(1/6) + 2×(1/6) + 3×(1/6) + 4×(1/6) + 5×(1/6) + 6×(1/6)
         = 3.5

    You never actually roll 3.5, but it is the long-run average.

    For continuous distributions:
    E[X] = ∫ x × p(x) dx
```

```python
import numpy as np

# Expected value of a fair die
outcomes = np.array([1, 2, 3, 4, 5, 6])
probabilities = np.ones(6) / 6  # uniform

expected_value = np.sum(outcomes * probabilities)
print(f"E[die roll] = {expected_value}")  # 3.5

# Verify by simulation
np.random.seed(42)
rolls = np.random.choice(outcomes, size=100000)
print(f"Simulated mean (100k rolls): {rolls.mean():.4f}")  # ~3.5

# Expected value of a loaded die
loaded_probs = np.array([0.1, 0.1, 0.1, 0.1, 0.1, 0.5])  # biased toward 6
expected_loaded = np.sum(outcomes * loaded_probs)
print(f"E[loaded die] = {expected_loaded}")  # 4.5
```

---

## Variance and Standard Deviation

**Variance** measures how spread out values are from the mean.
**Standard deviation** is the square root of variance — same idea,
but in the original units.

```
Variance:  Var(X) = E[(X - μ)²] = E[X²] - (E[X])²

    Low variance:              High variance:
    Values clustered           Values spread out

    │    ╭──╮                  │  ╭──────────╮
    │  ╭─┤  ├─╮               │╭─┤          ├─╮
    │╭─┤ │  │ ├─╮             ├┤ │          │ ├╮
    └──────────────            └──────────────────
         μ                            μ

Standard deviation: σ = √Var(X)
```

```python
import numpy as np

# Two datasets with the same mean but different variance
np.random.seed(42)
low_var = np.random.normal(loc=50, scale=2, size=1000)   # σ = 2
high_var = np.random.normal(loc=50, scale=10, size=1000)  # σ = 10

print(f"Low variance:  mean={low_var.mean():.2f}, std={low_var.std():.2f}, var={low_var.var():.2f}")
print(f"High variance: mean={high_var.mean():.2f}, std={high_var.std():.2f}, var={high_var.var():.2f}")

# Manual computation
data = np.array([2, 4, 4, 4, 5, 5, 7, 9])
mean = data.mean()
variance = np.mean((data - mean) ** 2)
std = np.sqrt(variance)
print(f"\nData: {data}")
print(f"Mean: {mean}, Variance: {variance:.2f}, Std: {std:.2f}")
```

---

## Connection to ML: Bias-Variance Tradeoff

```
The bias-variance tradeoff:

    Underfitting                    Just right                   Overfitting
    (high bias, low variance)      (balanced)                   (low bias, high variance)

    │  ──────────                  │    ╭─╮                     │ ╭╮ ╭╮╭╮
    │                              │  ╭─┤ ├─╮                   │╭┤├─┤├┤├╮
    │  • •  •  •  •                │ •╭┤ •│ ├•╮                  │•┤•  •│•├•
    │                              │╭─┤   │   ├─╮               │ ╰╯ ╰╯╰╯
    └──────────────                └──────────────               └──────────────

    Model too simple:              Model complexity              Model too complex:
    misses the pattern             just right                    memorizes noise

    Training loss: high            Training loss: low            Training loss: very low
    Test loss: high                Test loss: low                Test loss: HIGH
```

---

## Maximum Likelihood Estimation (MLE)

**MLE** finds the parameters that make the observed data most likely.
It answers: "Given this data, what parameter values would have been
most likely to produce it?"

```
MLE intuition:

    You flip a coin 10 times and get 7 heads.
    What is the most likely value of P(heads)?

    Try P(heads) = 0.5:  likelihood = 0.5^7 × 0.5^3 = 0.00098
    Try P(heads) = 0.7:  likelihood = 0.7^7 × 0.3^3 = 0.00222  ← higher!
    Try P(heads) = 0.9:  likelihood = 0.9^7 × 0.1^3 = 0.00048

    MLE answer: P(heads) = 7/10 = 0.7 (the obvious answer!)

    In general: MLE(p) = number of heads / total flips
```

```python
import numpy as np

# MLE for a coin flip
heads = 7
total = 10

# Try different values of p
p_values = np.linspace(0.01, 0.99, 100)
likelihoods = p_values**heads * (1 - p_values)**(total - heads)

mle_p = p_values[np.argmax(likelihoods)]
print(f"MLE estimate: P(heads) = {mle_p:.2f}")  # ~0.70
print(f"Exact MLE:    P(heads) = {heads/total}")  # 0.70
```

---

## MLE for a Gaussian Distribution

The most common MLE in ML: fitting a Gaussian (normal distribution)
to data.

```
Given data points x₁, x₂, ..., xₙ from a Gaussian:

    MLE for mean:     μ̂ = (1/n) Σ xᵢ           (sample mean)
    MLE for variance: σ̂² = (1/n) Σ (xᵢ - μ̂)²   (sample variance)

    These are just the formulas you already know!
    MLE tells you WHY these are the right formulas.
```

```python
import numpy as np

# Generate data from a known Gaussian
np.random.seed(42)
true_mean = 5.0
true_std = 2.0
data = np.random.normal(loc=true_mean, scale=true_std, size=1000)

# MLE estimates
mle_mean = data.mean()
mle_var = np.mean((data - mle_mean) ** 2)
mle_std = np.sqrt(mle_var)

print(f"True:     μ = {true_mean}, σ = {true_std}")
print(f"MLE:      μ = {mle_mean:.4f}, σ = {mle_std:.4f}")
```

---

## Log-Likelihood: Why We Use Cross-Entropy Loss

In practice, we work with **log-likelihood** instead of likelihood
(products of small numbers underflow; sums of logs do not).

```
Likelihood:      L = P(x₁) × P(x₂) × ... × P(xₙ)
Log-likelihood:  ℓ = log P(x₁) + log P(x₂) + ... + log P(xₙ)

Maximizing log-likelihood = minimizing negative log-likelihood
Negative log-likelihood = CROSS-ENTROPY LOSS

    This is why cross-entropy is the standard loss for classification!
    Training with cross-entropy loss IS doing maximum likelihood estimation.
```

```python
import numpy as np

def softmax(logits):
    exp_l = np.exp(logits - np.max(logits))
    return exp_l / exp_l.sum()

# Model predicts probabilities for 3 classes
logits = np.array([2.0, 1.0, 0.5])
probs = softmax(logits)
true_class = 0  # the correct answer is class 0

# Cross-entropy loss = negative log-likelihood of the true class
cross_entropy = -np.log(probs[true_class])
print(f"Predicted probabilities: {probs}")
print(f"P(true class): {probs[true_class]:.4f}")
print(f"Cross-entropy loss: {cross_entropy:.4f}")

# If the model is more confident about the right answer, loss is lower
confident_logits = np.array([5.0, 1.0, 0.5])
confident_probs = softmax(confident_logits)
confident_loss = -np.log(confident_probs[true_class])
print(f"\nConfident P(true class): {confident_probs[true_class]:.4f}")
print(f"Confident loss: {confident_loss:.4f}")  # lower!
```

---

## Connection to ML: Loss Functions

```
Loss function          What it is                    MLE connection
──────────────────────────────────────────────────────────────────────
MSE (mean squared      Average squared error         MLE for Gaussian
error)                                               with fixed variance

Cross-entropy          Negative log probability      MLE for categorical
                       of the true class             distribution

Binary cross-entropy   -[y log(p) + (1-y)log(1-p)]  MLE for Bernoulli
                                                     distribution
```

```python
import numpy as np

# MSE loss = MLE for Gaussian
y_true = np.array([1.0, 2.0, 3.0])
y_pred = np.array([1.1, 2.2, 2.8])
mse = np.mean((y_true - y_pred) ** 2)
print(f"MSE loss: {mse:.4f}")

# Cross-entropy loss = MLE for categorical
def cross_entropy_loss(probs, true_labels):
    """Average negative log-likelihood."""
    n = len(true_labels)
    log_probs = -np.log(probs[np.arange(n), true_labels] + 1e-10)
    return log_probs.mean()

# Batch of 3 examples, 4 classes each
logits = np.array([[2.0, 1.0, 0.5, 0.1],
                   [0.1, 3.0, 0.5, 0.2],
                   [0.5, 0.2, 0.1, 2.5]])
true_labels = np.array([0, 1, 3])

probs = np.exp(logits - logits.max(axis=1, keepdims=True))
probs = probs / probs.sum(axis=1, keepdims=True)

loss = cross_entropy_loss(probs, true_labels)
print(f"Cross-entropy loss: {loss:.4f}")
```

---

## Exercises

### Exercise 1: Expected Value and Variance

```python
import numpy as np

# A weighted die with these probabilities:
outcomes = np.array([1, 2, 3, 4, 5, 6])
probs = np.array([0.05, 0.10, 0.15, 0.20, 0.25, 0.25])

# TODO: compute the expected value E[X]
# TODO: compute the variance Var(X) = E[X²] - (E[X])²
# TODO: compute the standard deviation
# TODO: simulate 100,000 rolls and compare with your calculations
```

### Exercise 2: MLE for a Gaussian

```python
import numpy as np
np.random.seed(42)

# Mystery data — find the parameters!
data = np.random.normal(loc=42, scale=7, size=500)

# TODO: compute the MLE estimates for μ and σ
# TODO: plot a histogram of the data
# TODO: overlay the fitted Gaussian PDF
# TODO: how close are your estimates to the true values?
```

### Exercise 3: Cross-Entropy Loss and MSE Loss

```python
import numpy as np

# Compare cross-entropy and MSE for a classification problem
# True label: class 2 (out of 5 classes)
true_class = 2

# Model A: somewhat confident
logits_A = np.array([0.5, 0.3, 2.0, 0.1, 0.2])

# Model B: very confident
logits_B = np.array([0.1, 0.1, 5.0, 0.1, 0.1])

# Model C: wrong answer
logits_C = np.array([3.0, 0.1, 0.5, 0.1, 0.2])

# TODO: for each model, compute softmax probabilities
# TODO: compute cross-entropy loss for each
# TODO: compute MSE loss (compare one-hot true label vs probabilities)
# TODO: which loss function penalizes the wrong answer (Model C) more harshly?
# TODO: why is cross-entropy preferred for classification?
```

---

Next: [Lesson 09: The Math-to-ML Map](./09-math-to-ml-map.md)
