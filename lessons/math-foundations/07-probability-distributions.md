# Lesson 07: Probability and Distributions — How Models Handle Uncertainty

Every time an LLM picks the next word, it is sampling from a probability
distribution. Every time a classifier says "90% cat, 10% dog," it is
outputting probabilities. Understanding probability is understanding
how models make decisions under uncertainty.

---

## The Core Idea

**Probability** measures how likely something is, on a scale from 0
(impossible) to 1 (certain). A **probability distribution** assigns
probabilities to all possible outcomes.

**Analogy: Weather forecasts.** When the forecast says "70% chance of
rain," that is a probability. The full forecast — 70% rain, 20% cloudy,
10% sunny — is a probability distribution. The probabilities must sum
to 1 (something has to happen).

```
Probability distribution (discrete):

    P(outcome)
    │
0.7 │ ████
    │ ████
0.2 │ ████  ████
0.1 │ ████  ████  ████
    │ ████  ████  ████
    └──────────────────
      Rain  Cloud  Sun

    P(Rain) + P(Cloud) + P(Sun) = 0.7 + 0.2 + 0.1 = 1.0
    All probabilities sum to 1.
```

```python
import numpy as np

# A simple probability distribution
outcomes = ["Rain", "Cloudy", "Sunny"]
probabilities = np.array([0.7, 0.2, 0.1])

print(f"Sum of probabilities: {probabilities.sum()}")  # 1.0

# Sampling from the distribution
np.random.seed(42)
samples = np.random.choice(outcomes, size=1000, p=probabilities)
for outcome in outcomes:
    count = (samples == outcome).sum()
    print(f"  {outcome}: {count}/1000 = {count/1000:.2f}")
```

---

## Conditional Probability and Bayes' Theorem

**Conditional probability** P(A|B) means "probability of A given that
B happened."

```
P(A|B) = P(A and B) / P(B)

Example: Medical test
    P(disease) = 0.01          (1% of people have it)
    P(positive | disease) = 0.95  (test catches 95% of cases)
    P(positive | no disease) = 0.05  (5% false positive rate)

    You test positive. What is P(disease | positive)?
```

**Bayes' theorem** flips conditional probabilities:

```
P(disease | positive) = P(positive | disease) × P(disease)
                        ─────────────────────────────────────
                                   P(positive)

P(positive) = P(pos|disease)×P(disease) + P(pos|no disease)×P(no disease)
            = 0.95 × 0.01 + 0.05 × 0.99
            = 0.0095 + 0.0495
            = 0.059

P(disease | positive) = 0.95 × 0.01 / 0.059 = 0.161

Only 16.1%! Even with a positive test, you probably don't have it.
The low base rate (1%) dominates.
```

```python
import numpy as np

# Bayes' theorem in code
p_disease = 0.01
p_positive_given_disease = 0.95
p_positive_given_no_disease = 0.05

p_positive = (p_positive_given_disease * p_disease +
              p_positive_given_no_disease * (1 - p_disease))

p_disease_given_positive = (p_positive_given_disease * p_disease) / p_positive

print(f"P(disease | positive test) = {p_disease_given_positive:.3f}")
print(f"Only {p_disease_given_positive*100:.1f}% — the base rate matters!")
```

---

## Common Distributions

### Uniform Distribution

Every outcome is equally likely.

```
Uniform distribution (rolling a fair die):

    P(x)
    │
1/6 │ ██  ██  ██  ██  ██  ██
    │ ██  ██  ██  ██  ██  ██
    └──────────────────────────
      1   2   3   4   5   6
```

### Normal (Gaussian) Distribution

The bell curve. Most values cluster around the mean.

```
Normal distribution (μ=0, σ=1):

    P(x)
    │        ╭──╮
    │      ╭─┤  ├─╮
    │    ╭─┤ │  │ ├─╮
    │  ╭─┤ │ │  │ │ ├─╮
    │╭─┤ │ │ │  │ │ │ ├─╮
    └──────────────────────── x
    -3  -2  -1   0   1   2   3

    68% of values within 1σ of mean
    95% of values within 2σ of mean
    99.7% of values within 3σ of mean
```

### Bernoulli Distribution

Two outcomes: success (1) or failure (0).

```
Bernoulli (p=0.3):

    P(x)
    │
0.7 │       ████
0.3 │ ████  ████
    │ ████  ████
    └────────────
      1(yes) 0(no)
```

```python
import numpy as np

np.random.seed(42)

# Uniform: all values equally likely
uniform_samples = np.random.uniform(0, 1, size=1000)
print(f"Uniform — mean: {uniform_samples.mean():.3f}, std: {uniform_samples.std():.3f}")

# Normal (Gaussian): bell curve
normal_samples = np.random.normal(loc=0, scale=1, size=1000)
print(f"Normal  — mean: {normal_samples.mean():.3f}, std: {normal_samples.std():.3f}")

# Bernoulli: coin flip (p=0.3)
bernoulli_samples = np.random.binomial(n=1, p=0.3, size=1000)
print(f"Bernoulli — mean: {bernoulli_samples.mean():.3f} (should be ~0.3)")
```

---

## Connection to ML: Softmax

The **softmax** function converts raw model outputs (logits) into a
probability distribution. Every classification model and every LLM
uses it.

```
Softmax converts logits to probabilities:

    Logits (raw scores):     Softmax output (probabilities):

    cat:   2.0               cat:   0.659
    dog:   1.0       →       dog:   0.242
    bird:  0.5               bird:  0.147
                                    ─────
                             sum:   1.000

    softmax(xᵢ) = e^xᵢ / Σ e^xⱼ

    Higher logit → higher probability
    All outputs are positive and sum to 1
```

```python
import numpy as np

def softmax(logits):
    """Convert logits to probabilities."""
    # Subtract max for numerical stability (prevents overflow)
    exp_logits = np.exp(logits - np.max(logits))
    return exp_logits / exp_logits.sum()

# Classification example
logits = np.array([2.0, 1.0, 0.5])
labels = ["cat", "dog", "bird"]
probs = softmax(logits)

print("Classification probabilities:")
for label, prob in zip(labels, probs):
    print(f"  {label}: {prob:.3f}")
print(f"  Sum: {probs.sum():.3f}")

# LLM next-token prediction
vocab = ["the", "a", "cat", "sat", "on"]
logits = np.array([3.2, 1.1, 2.8, 0.5, 1.9])
probs = softmax(logits)

print(f"\nNext token probabilities:")
for word, prob in zip(vocab, probs):
    print(f"  '{word}': {prob:.3f}")
```

---

## Temperature: Controlling Randomness

**Temperature** scales the logits before softmax, controlling how
"confident" or "random" the distribution is.

```
Temperature effect on softmax:

    Low temperature (T=0.1):     High temperature (T=2.0):
    Very peaked, very confident  Flat, more random

    P(x)                         P(x)
    │ ████                       │
    │ ████                       │ ████ ████
    │ ████                       │ ████ ████ ████
    │ ████ ██                    │ ████ ████ ████ ████
    │ ████ ██  █                 │ ████ ████ ████ ████
    └──────────────              └──────────────────────
      A    B   C                   A    B    C    D

    T → 0: always picks the highest logit (greedy)
    T → ∞: uniform random (all equally likely)
```

```python
import numpy as np

def softmax_with_temperature(logits, temperature=1.0):
    scaled = logits / temperature
    exp_scaled = np.exp(scaled - np.max(scaled))
    return exp_scaled / exp_scaled.sum()

logits = np.array([3.0, 1.5, 0.5])
labels = ["A", "B", "C"]

for temp in [0.1, 0.5, 1.0, 2.0, 5.0]:
    probs = softmax_with_temperature(logits, temp)
    print(f"T={temp:.1f}: {' '.join(f'{l}={p:.3f}' for l, p in zip(labels, probs))}")
```

---

## Sampling From Distributions

LLMs do not always pick the most likely token. They **sample** from
the probability distribution, which is why they can generate different
outputs for the same prompt.

```python
import numpy as np

def sample_token(logits, temperature=1.0):
    """Sample a token from logits with temperature."""
    probs = softmax_with_temperature(logits, temperature)
    return np.random.choice(len(logits), p=probs)

def softmax_with_temperature(logits, temperature=1.0):
    scaled = logits / temperature
    exp_scaled = np.exp(scaled - np.max(scaled))
    return exp_scaled / exp_scaled.sum()

np.random.seed(42)
vocab = ["the", "a", "cat", "sat", "on"]
logits = np.array([3.2, 1.1, 2.8, 0.5, 1.9])

# Sample 10 tokens at different temperatures
for temp in [0.1, 1.0, 2.0]:
    tokens = [vocab[sample_token(logits, temp)] for _ in range(10)]
    print(f"T={temp}: {tokens}")
```

---

## Exercises

### Exercise 1: Implement Softmax From Scratch

```python
import numpy as np

def my_softmax(logits):
    """Implement softmax from scratch.
    Remember: subtract max for numerical stability!"""
    # TODO: implement softmax
    pass

# Test cases
logits1 = np.array([1.0, 2.0, 3.0])
logits2 = np.array([1000.0, 1001.0, 1002.0])  # large numbers — needs stability trick

# TODO: verify your softmax outputs sum to 1
# TODO: verify it handles large numbers without overflow
# TODO: compare with the scipy or manual implementation
```

### Exercise 2: Bayes' Theorem for Spam Detection

```python
import numpy as np

# A spam filter:
#   P(spam) = 0.3 (30% of emails are spam)
#   P("free" | spam) = 0.8 (80% of spam contains "free")
#   P("free" | not spam) = 0.1 (10% of legit emails contain "free")

# TODO: compute P(spam | contains "free") using Bayes' theorem
# TODO: an email contains both "free" and "winner"
#        P("winner" | spam) = 0.6, P("winner" | not spam) = 0.02
#        Assuming independence, compute P(spam | "free" AND "winner")
```

### Exercise 3: Temperature and Sampling

```python
import numpy as np

# Simulate LLM token generation with different temperatures
vocab = ["I", "think", "believe", "know", "feel",
         "that", "the", "this", "it", "we"]
logits = np.array([2.5, 1.8, 1.2, 3.0, 0.8,
                   1.5, 2.0, 0.5, 1.0, 0.3])

# TODO: for temperatures [0.1, 0.5, 1.0, 2.0, 5.0]:
#   1. Compute the softmax probabilities
#   2. Sample 100 tokens
#   3. Count how often each token appears
#   4. What happens to the distribution as temperature increases?
# TODO: at what temperature does the model become essentially random?
```

---

Next: [Lesson 08: Expectation, Variance, and MLE](./08-expectation-variance-mle.md)
