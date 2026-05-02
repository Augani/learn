# Lesson 13: Probability Basics

> **Analogy:** Weather forecasting — "70% chance of rain" is a
> probability. AI models output probabilities the same way.

---

## Why Probability Matters for AI

```
  GPT doesn't output "the answer." It outputs:

  "The capital of France is ___"

  +----------+-------+
  | Token    | Prob  |
  +----------+-------+
  | Paris    | 0.92  |
  | Lyon     | 0.03  |
  | London   | 0.02  |
  | Berlin   | 0.01  |
  | ...      | 0.02  |
  +----------+-------+
  | TOTAL    | 1.00  |
  +----------+-------+

  Every prediction is a probability distribution.
  Understanding probability = understanding AI output.
```

---

## Basic Rules

```
  RULE 1: Probabilities are between 0 and 1
  0 = impossible, 1 = certain

  RULE 2: All probabilities must sum to 1
  P(rain) + P(no rain) = 1.0

  RULE 3: P(not A) = 1 - P(A)
  If P(rain) = 0.7, then P(no rain) = 0.3

  Weather analogy:
  +----------------------------------+
  | Tomorrow's forecast:              |
  |   Sunny:  30%  |||               |
  |   Cloudy: 45%  ||||||            |
  |   Rainy:  25%  ||||              |
  |   Total: 100%                    |
  +----------------------------------+
```

---

## Joint Probability: Two Events Together

```
  P(A AND B) = probability that BOTH happen

  Weather forecast for the week:
  P(rain Monday AND rain Tuesday) = ?

  If independent:
  P(A AND B) = P(A) * P(B)

  P(rain Mon) = 0.3, P(rain Tue) = 0.4
  P(rain both) = 0.3 * 0.4 = 0.12

  +------------------+--------+-----------+
  |                  | Tue    | Tue       |
  |                  | Rain   | No Rain   |
  +------------------+--------+-----------+
  | Mon Rain   0.30  | 0.12   | 0.18      |
  | Mon NoRain 0.70  | 0.28   | 0.42      |
  +------------------+--------+-----------+
```

---

## Conditional Probability

```
  P(A | B) = "probability of A GIVEN that B happened"

  P(A | B) = P(A AND B) / P(B)

  Example:
  "What's the chance it rains Tuesday IF it rained Monday?"

  If weather is correlated (not independent):
  P(rain Tue | rain Mon) = 0.6  (higher than the base 0.4!)

  In AI:
  P(next_word | previous_words)  <-- this IS language modeling!
```

---

## Independence

```
  Two events are independent if knowing one tells you
  NOTHING about the other.

  Independent:
  - Coin flip 1 and coin flip 2
  - P(heads flip 2 | heads flip 1) = P(heads flip 2) = 0.5

  NOT independent:
  - Rain today and rain tomorrow (weather has patterns)
  - P(rain tomorrow | rain today) != P(rain tomorrow)

  Test for independence:
  P(A AND B) = P(A) * P(B)  ?

  If yes --> independent
  If no  --> dependent (correlated)
```

---

## Bayes' Theorem

The most important formula in probability:

```
  P(A | B) = P(B | A) * P(A) / P(B)

  In English:
  "Update your belief about A after seeing evidence B"

  SPAM FILTER EXAMPLE:

  Prior:     P(spam) = 0.3  (30% of emails are spam)
  Evidence:  email contains "FREE MONEY"
  Likelihood: P("FREE MONEY" | spam) = 0.8
  Likelihood: P("FREE MONEY" | not spam) = 0.01

  P(spam | "FREE MONEY")
  = P("FREE MONEY" | spam) * P(spam) / P("FREE MONEY")

  P("FREE MONEY") = 0.8 * 0.3 + 0.01 * 0.7 = 0.247

  P(spam | "FREE MONEY") = 0.8 * 0.3 / 0.247 = 0.972

  97.2% chance it's spam!
```

---

## Visual: Bayes' Theorem

```
  ALL EMAILS
  +------------------------------------------+
  |                                          |
  |   SPAM (30%)        NOT SPAM (70%)       |
  |   +----------+      +------------------+ |
  |   |          |      |                  | |
  |   | has      |      |                  | |
  |   | "FREE    |      | has "FREE MONEY" | |
  |   | MONEY"   |      | (tiny slice)     | |
  |   | (80%)    |      | (1%)             | |
  |   |**********|      |*                 | |
  |   |          |      |                  | |
  |   +----------+      +------------------+ |
  +------------------------------------------+

  Given "FREE MONEY" appeared:
  Most of the *** area is in the SPAM box!
  --> Very likely spam.
```

---

## Python: Bayes' Theorem

```python
import numpy as np

p_spam = 0.3
p_not_spam = 0.7
p_free_given_spam = 0.8
p_free_given_not_spam = 0.01

p_free = p_free_given_spam * p_spam + p_free_given_not_spam * p_not_spam
p_spam_given_free = p_free_given_spam * p_spam / p_free

print(f"P(spam | 'FREE MONEY') = {p_spam_given_free:.4f}")

def naive_bayes(features, p_feat_given_spam, p_feat_given_notspam, p_spam=0.3):
    log_spam = np.log(p_spam) + np.sum(np.log(
        features * p_feat_given_spam + (1 - features) * (1 - p_feat_given_spam)))
    log_notspam = np.log(1 - p_spam) + np.sum(np.log(
        features * p_feat_given_notspam + (1 - features) * (1 - p_feat_given_notspam)))

    max_log = max(log_spam, log_notspam)
    p_spam_posterior = np.exp(log_spam - max_log) / (
        np.exp(log_spam - max_log) + np.exp(log_notspam - max_log))
    return p_spam_posterior

features = np.array([1, 1, 0, 0, 1])
p_given_spam = np.array([0.8, 0.7, 0.2, 0.3, 0.6])
p_given_notspam = np.array([0.01, 0.05, 0.8, 0.7, 0.1])

result = naive_bayes(features, p_given_spam, p_given_notspam)
print(f"P(spam | features) = {result:.4f}")
```

---

## Probability in Language Models

```
  Input: "The cat sat on the ___"

  P(word | "The cat sat on the") for each word:

  mat   -> 0.15  |||||||
  floor -> 0.12  ||||||
  roof  -> 0.08  ||||
  table -> 0.07  |||
  chair -> 0.06  |||
  ...

  The model outputs a FULL probability distribution.

  TEMPERATURE controls the distribution shape:

  Low temp (0.1):     High temp (2.0):
  mat   0.85 |||||||| mat   0.08 ||||
  floor 0.10 |||||    floor 0.07 |||
  roof  0.03 |        roof  0.06 |||
  table 0.01 |        table 0.06 |||
  chair 0.01 |        chair 0.05 |||
  (very confident)     (very uncertain)
```

---

## Marginal Probability

```
  Marginalization: sum out variables you don't care about.

  Joint distribution P(weather, traffic):
  +--------+-------+-------+
  |        | Heavy | Light |
  +--------+-------+-------+
  | Rain   | 0.25  | 0.05  |  P(rain) = 0.30
  | Sun    | 0.10  | 0.60  |  P(sun)  = 0.70
  +--------+-------+-------+
             0.35    0.65

  P(heavy traffic) = P(heavy, rain) + P(heavy, sun)
                    = 0.25 + 0.10 = 0.35

  "Sum out" the weather variable to get just traffic.
```

---

## Python: Working with Distributions

```python
import numpy as np

def sample_from_distribution(probs, n=10):
    labels = [f"word_{i}" for i in range(len(probs))]
    counts = np.random.multinomial(n, probs)
    return dict(zip(labels, counts))

probs = np.array([0.4, 0.3, 0.15, 0.1, 0.05])
assert abs(probs.sum() - 1.0) < 1e-10

np.random.seed(42)
samples = sample_from_distribution(probs, n=1000)
print("Sampling 1000 times:")
for word, count in sorted(samples.items(), key=lambda x: -x[1]):
    bar = "#" * (count // 10)
    print(f"  {word}: {count:4d} {bar}")

def apply_temperature(logits, temperature):
    scaled = logits / temperature
    exp_scaled = np.exp(scaled - np.max(scaled))
    return exp_scaled / exp_scaled.sum()

logits = np.array([2.0, 1.5, 1.0, 0.5, 0.0])

for temp in [0.1, 0.5, 1.0, 2.0, 5.0]:
    probs = apply_temperature(logits, temp)
    print(f"\nTemp {temp}: {probs.round(3)}")
```

---

## The Law of Large Numbers

```
  Flip a coin 10 times:    HHTHTTHHTH  (6 heads = 60%)
  Flip a coin 100 times:                (53 heads = 53%)
  Flip a coin 10000 times:              (5012 heads = 50.1%)

  More samples --> closer to true probability

  This is why:
  - Large training sets work better
  - Larger batches give more stable gradients
  - Monte Carlo methods converge eventually
```

---

## Key Takeaways

```
  +------------------------------------------------------+
  |  PROBABILITY = measure of uncertainty (0 to 1)        |
  |  All probs sum to 1                                    |
  |  BAYES: P(A|B) = P(B|A)*P(A) / P(B)                  |
  |  CONDITIONAL: P(A|B) = what you know after seeing B   |
  |  INDEPENDENT: knowing B doesn't change P(A)           |
  |  Language models output probability distributions      |
  |  Temperature controls distribution sharpness           |
  +------------------------------------------------------+
```

---

## Exercises

**Exercise 1:** A medical test is 95% accurate (true positive) and
has a 3% false positive rate. If the disease affects 1% of the
population, what's the probability someone who tests positive
actually has the disease? (Use Bayes' theorem.)

**Exercise 2:** Implement a simple language model that predicts
the next character based on frequency counts from a training string.

```python
import numpy as np

text = "the cat sat on the mat the cat sat on the hat"

def build_model(text):
    pass

def predict_next(model, current_char):
    pass
```

**Exercise 3:** Generate 10,000 samples from the distribution
`[0.1, 0.2, 0.3, 0.25, 0.15]`. Verify the sample frequencies
match the probabilities.

**Exercise 4:** Implement temperature scaling. Given logits
`[3.0, 2.0, 1.0, 0.0, -1.0]`, compute the probability
distribution at temperatures 0.1, 0.5, 1.0, 2.0, and 10.0.

**Exercise 5:** Build a Naive Bayes spam classifier with 10
binary features. Generate synthetic training data and test
classification accuracy.

---

[Next: Lesson 14 - Distributions ->](14-distributions.md)
