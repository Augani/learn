# Lesson 14: Distributions

> **Analogy:** Bell curves in test scores — most students cluster
> around the average, with fewer at the extremes. Distributions
> describe the SHAPE of randomness.

---

## What Is a Distribution?

A distribution describes the likelihood of different outcomes.

```
  Dice roll distribution (uniform):

  P(x)
  0.17 |  *  *  *  *  *  *
       |  |  |  |  |  |  |
       +--+--+--+--+--+--+--> x
          1  2  3  4  5  6

  Each outcome equally likely = UNIFORM distribution.

  Test scores distribution (normal):

  P(x)
       |        ***
       |      **   **
       |    **       **
       |  **           **
       |**               **
       +----+----+----+-----> score
           60   75   90

  Most scores near the middle = NORMAL distribution.
```

---

## Uniform Distribution

Every value in a range is equally likely.

```
  Continuous uniform [a, b]:
  P(x) = 1/(b-a) for a <= x <= b

  Like randomly picking a point on a ruler:
  |==================|
  a                  b
  Every spot equally likely.

  AI uses:
  - Random weight initialization
  - Random sampling
  - Dropout masks
```

```python
import numpy as np

samples = np.random.uniform(low=0, high=10, size=10000)

print(f"Mean: {samples.mean():.2f} (expected: 5.0)")
print(f"Std:  {samples.std():.2f} (expected: {10/np.sqrt(12):.2f})")
print(f"Min:  {samples.min():.2f}")
print(f"Max:  {samples.max():.2f}")
```

---

## Normal (Gaussian) Distribution

The bell curve. The most important distribution in stats.

```
  Parameters: mean (mu) and standard deviation (sigma)

  P(x) = (1 / (sigma * sqrt(2*pi))) * exp(-(x-mu)^2 / (2*sigma^2))

                       mu
                        |
                    ****|****
                  **    |    **
                **      |      **
             ***        |        ***
          ***           |           ***
  --------              |              --------
      mu-3s  mu-2s  mu-s  mu  mu+s  mu+2s  mu+3s

  68% within 1 sigma   |===========|
  95% within 2 sigma  |===============|
  99.7% within 3 sigma |===================|
```

---

## Why the Normal Distribution Is Everywhere

```
  Central Limit Theorem:
  Average MANY random things --> always get a bell curve!

  Average of dice rolls:
  1 die:   flat (uniform)
  2 dice:  triangular
  5 dice:  starting to look like a bell
  30 dice: perfect bell curve!

  This is why:
  - Test scores are bell-shaped
  - Height is bell-shaped
  - Measurement errors are bell-shaped
  - Gradient averages are bell-shaped!
```

---

## Python: Normal Distribution

```python
import numpy as np

mu = 75
sigma = 10
samples = np.random.normal(mu, sigma, 10000)

print(f"Mean: {samples.mean():.2f} (expected: {mu})")
print(f"Std:  {samples.std():.2f} (expected: {sigma})")

within_1s = np.sum(np.abs(samples - mu) < sigma) / len(samples)
within_2s = np.sum(np.abs(samples - mu) < 2*sigma) / len(samples)
within_3s = np.sum(np.abs(samples - mu) < 3*sigma) / len(samples)

print(f"\nWithin 1 sigma: {within_1s:.1%} (expected: 68.3%)")
print(f"Within 2 sigma: {within_2s:.1%} (expected: 95.4%)")
print(f"Within 3 sigma: {within_3s:.1%} (expected: 99.7%)")
```

---

## Bernoulli & Binomial

```
  BERNOULLI: Single yes/no event
  Flip a coin once: P(heads) = p

  BINOMIAL: Count of successes in n trials
  Flip a coin 10 times: how many heads?

  n = 10, p = 0.5:
  P(k heads)
       |           ***
       |         **   **
       |        *       *
       |       *         *
       |     **           **
       +--*---+---+---+---*---> k
          0   2   4   6   8  10

  AI uses:
  - Dropout (each neuron is Bernoulli: keep or drop)
  - Binary classification (spam or not spam)
```

---

## Python: Binomial

```python
import numpy as np

n_flips = 10
p_heads = 0.5
n_experiments = 10000

results = np.random.binomial(n_flips, p_heads, n_experiments)

print(f"Mean heads: {results.mean():.2f} (expected: {n_flips * p_heads})")
print(f"Std:        {results.std():.2f}")

print("\nHistogram:")
for k in range(n_flips + 1):
    count = np.sum(results == k)
    bar = "#" * (count // 100)
    print(f"  {k:2d} heads: {count:4d} {bar}")
```

---

## Softmax: From Scores to Probabilities

Softmax converts ANY list of numbers into a probability distribution.

```
  Raw scores (logits): [3.0, 1.0, 0.2]

  Step 1: Exponentiate
  exp([3.0, 1.0, 0.2]) = [20.09, 2.72, 1.22]

  Step 2: Normalize (divide by sum)
  sum = 24.03
  [20.09/24.03, 2.72/24.03, 1.22/24.03]
  = [0.836, 0.113, 0.051]

  Properties:
  - All values between 0 and 1  ✓
  - Sum to 1.0                  ✓
  - Preserves ranking           ✓
  - Larger scores get more probability ✓

  This is the LAST layer of most classifiers!
```

---

## Python: Softmax

```python
import numpy as np

def softmax(logits):
    shifted = logits - np.max(logits)
    exp_vals = np.exp(shifted)
    return exp_vals / exp_vals.sum()

logits = np.array([3.0, 1.0, 0.2])
probs = softmax(logits)
print(f"Logits: {logits}")
print(f"Probs:  {probs.round(4)}")
print(f"Sum:    {probs.sum():.6f}")

def softmax_with_temperature(logits, temperature=1.0):
    return softmax(logits / temperature)

print("\nTemperature effects:")
for temp in [0.1, 0.5, 1.0, 2.0, 10.0]:
    p = softmax_with_temperature(logits, temp)
    print(f"  T={temp:4.1f}: {p.round(4)}")
```

---

## Categorical Distribution

Choose one option from a set with given probabilities.

```
  Next token prediction:

  P("the")   = 0.15  |||||||
  P("a")     = 0.10  |||||
  P("cat")   = 0.25  ||||||||||||
  P("dog")   = 0.20  ||||||||||
  P("house") = 0.30  |||||||||||||||

  Sample from this --> pick one token
  That's how LLMs generate text!
```

```python
import numpy as np

tokens = ["the", "a", "cat", "dog", "house"]
probs = np.array([0.15, 0.10, 0.25, 0.20, 0.30])

np.random.seed(42)
for i in range(5):
    idx = np.random.choice(len(tokens), p=probs)
    print(f"  Sample {i+1}: '{tokens[idx]}'")

samples = np.random.choice(len(tokens), size=10000, p=probs)
print("\nFrequencies over 10k samples:")
for i, token in enumerate(tokens):
    freq = np.sum(samples == i) / len(samples)
    print(f"  '{token}': {freq:.3f} (expected: {probs[i]:.3f})")
```

---

## Exponential Distribution

Time between events. "How long until the next bus?"

```
  P(x)
  |*
  | *
  |  **
  |    ***
  |       *****
  |            **********
  +--+--+--+--+--+--+--+--> time
     1  2  3  4  5  6  7

  Short waits are common, long waits are rare.

  AI uses: modeling event times, survival analysis
```

---

## Multivariate Normal

The bell curve in multiple dimensions:

```
  2D Normal:                Top-down view (contour):

        /\                        . . .
       /  \                     .       .
      / /\ \                   .    *    .
     / /  \ \                   .       .
    /_/    \_\                    . . .

  Parameters:
  - mu: center point (vector)
  - Sigma: covariance matrix (shape of the ellipse)

  Round contours = independent dimensions
  Tilted ellipses = correlated dimensions
```

---

## Python: Multivariate Normal

```python
import numpy as np

mu = np.array([0, 0])

cov_independent = np.array([[1, 0],
                              [0, 1]])

cov_correlated = np.array([[1, 0.8],
                             [0.8, 1]])

np.random.seed(42)
samples_ind = np.random.multivariate_normal(mu, cov_independent, 1000)
samples_cor = np.random.multivariate_normal(mu, cov_correlated, 1000)

print("Independent:")
print(f"  Correlation: {np.corrcoef(samples_ind.T)[0,1]:.4f}")
print(f"  Mean: {samples_ind.mean(axis=0).round(3)}")

print("\nCorrelated:")
print(f"  Correlation: {np.corrcoef(samples_cor.T)[0,1]:.4f}")
print(f"  Mean: {samples_cor.mean(axis=0).round(3)}")
```

---

## Distribution Summary for AI

```
  +-------------------+--------------------+--------------------+
  | Distribution      | Shape              | AI Use Case        |
  +-------------------+--------------------+--------------------+
  | Uniform           | Flat               | Weight init        |
  | Normal            | Bell curve         | Noise, init, VAE   |
  | Bernoulli         | 0 or 1             | Dropout            |
  | Categorical       | Pick from set      | Token generation   |
  | Softmax (output)  | Probs from scores  | Classification     |
  | Multivariate Norm | Multi-dim bell     | Latent spaces      |
  +-------------------+--------------------+--------------------+
```

---

## Key Takeaways

```
  +------------------------------------------------------+
  |  DISTRIBUTION = shape of randomness                    |
  |  NORMAL = bell curve, most common in nature            |
  |  SOFTMAX = convert scores to probabilities             |
  |  CATEGORICAL = sample one item from probabilities      |
  |  TEMPERATURE = control sharpness of distribution       |
  |  Central Limit Theorem: averages are always normal     |
  |  LLMs output categorical distributions over tokens     |
  +------------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Generate 10,000 samples from a normal distribution
with mean=100, std=15 (like IQ scores). What percentage falls
between 85 and 115?

**Exercise 2:** Implement softmax from scratch (with numerical
stability). Test with logits `[1000, 1001, 1002]` — does your
implementation handle large numbers?

**Exercise 3:** Demonstrate the Central Limit Theorem: take
the average of N uniform random samples for N = 1, 2, 5, 10, 30.
Show that the distribution of averages becomes more bell-shaped.

**Exercise 4:** Implement top-k sampling: given a probability
distribution, zero out all but the top k probabilities,
renormalize, and sample.

```python
import numpy as np

def top_k_sample(probs, k):
    pass

probs = np.array([0.3, 0.25, 0.2, 0.1, 0.05, 0.05, 0.03, 0.02])
```

**Exercise 5:** Create a 2D multivariate normal with strong positive
correlation (rho = 0.9). Sample 1000 points. Compute the sample
correlation and verify it's close to 0.9.

---

[Next: Lesson 15 - Expected Value & Variance ->](15-expected-value-variance.md)
