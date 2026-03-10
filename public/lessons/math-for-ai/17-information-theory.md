# Lesson 17: Information Theory

> **Analogy:** Compressing messages. If someone always says
> "hello," that message carries zero information. A surprise
> message carries a lot. Information theory quantifies surprise.

---

## Entropy: Measuring Surprise

```
  WEATHER IN THE SAHARA VS LONDON
  ================================

  Sahara forecast:           London forecast:
  Sunny: 99%                 Sunny: 25%
  Rainy:  1%                 Cloudy: 35%
                             Rainy: 25%
  Low entropy!               Drizzle: 15%
  Very predictable.
  "Sunny" is boring.         High entropy!
                             Very unpredictable.
                             Each forecast is informative.

  ┌────────────────────────────────────────────────────┐
  │  Entropy H(X) = -sum P(x) * log2(P(x))            │
  │                                                     │
  │  Measures average surprise / uncertainty            │
  │  Units: bits (with log2) or nats (with ln)          │
  │                                                     │
  │  Minimum: H = 0 (completely certain)                │
  │  Maximum: H = log2(n) (uniform over n outcomes)     │
  └────────────────────────────────────────────────────┘
```

---

## Computing Entropy

```python
import numpy as np

def entropy(probs):
    probs = np.array(probs)
    probs = probs[probs > 0]
    return -np.sum(probs * np.log2(probs))

sahara = [0.99, 0.01]
london = [0.25, 0.35, 0.25, 0.15]
fair_coin = [0.5, 0.5]
loaded_coin = [0.9, 0.1]
uniform_die = [1/6] * 6

print(f"Sahara weather:  H = {entropy(sahara):.3f} bits")
print(f"London weather:  H = {entropy(london):.3f} bits")
print(f"Fair coin:       H = {entropy(fair_coin):.3f} bits")
print(f"Loaded coin:     H = {entropy(loaded_coin):.3f} bits")
print(f"Fair die:        H = {entropy(uniform_die):.3f} bits")

temps = np.linspace(0.1, 5.0, 50)
logits = np.array([2.0, 1.0, 0.5, 0.1])
entropies = []
for t in temps:
    scaled = logits / t
    probs = np.exp(scaled) / np.exp(scaled).sum()
    entropies.append(entropy(probs))

print(f"\nLow temperature (0.1):  H = {entropies[0]:.3f}")
print(f"High temperature (5.0): H = {entropies[-1]:.3f}")
```

---

## Entropy in AI

```
  WHERE ENTROPY APPEARS
  =====================

  1. LANGUAGE MODELS
     Low entropy output  --> model is confident ("Paris")
     High entropy output --> model is uncertain ("um...")
     Temperature controls entropy of the output distribution

  2. DECISION TREES
     Split criterion: choose the split that REDUCES entropy most
     Information Gain = H(parent) - weighted_avg(H(children))

  3. ACTIVE LEARNING
     Pick the sample the model is most uncertain about
     = the sample with highest prediction entropy

  4. INFORMATION BOTTLENECK
     Compress input while preserving relevant information
     = minimize H(representation) while maximizing H(output|input)
```

---

## Cross-Entropy: Comparing Distributions

```
  You have TRUE distribution P and MODEL distribution Q.
  Cross-entropy measures how well Q encodes data from P.

  ┌──────────────────────────────────────────────────────┐
  │  H(P, Q) = -sum P(x) * log Q(x)                     │
  │                                                       │
  │  If Q = P:  H(P, Q) = H(P)  (minimum possible)       │
  │  If Q != P: H(P, Q) > H(P)  (always worse)           │
  │                                                       │
  │  Cross-entropy = entropy + KL divergence              │
  │  H(P, Q) = H(P) + D_KL(P || Q)                       │
  └──────────────────────────────────────────────────────┘

  MESSAGE COMPRESSION ANALOGY:
  ============================

  True letter frequencies (P): e=25%, t=20%, a=15%, ...
  Your assumed frequencies (Q): all letters equal (4%)

  Using Q to encode P:
  - Common letters get too-long codes (wasteful)
  - Cross-entropy is HIGH (bad compression)

  Using P to encode P:
  - Common letters get short codes (efficient)
  - Cross-entropy = entropy (optimal compression)
```

---

## Cross-Entropy Loss in Classification

```
  THIS IS THE MOST COMMON LOSS FUNCTION IN ML

  True label (one-hot):     P = [0, 0, 1]  (class 2)
  Model prediction:         Q = [0.1, 0.2, 0.7]

  Cross-entropy loss:
  H(P, Q) = -(0*log(0.1) + 0*log(0.2) + 1*log(0.7))
           = -log(0.7)
           = 0.357

  Only the TRUE class probability matters!

  ┌─────────────────────────────────────────────┐
  │  For classification:                         │
  │  CE loss = -log(predicted prob of true class)│
  │                                              │
  │  Perfect prediction (Q=1.0): loss = 0        │
  │  Bad prediction (Q=0.01):    loss = 4.6      │
  │  Terrible (Q->0):            loss -> infinity │
  └─────────────────────────────────────────────┘
```

```python
import numpy as np

def cross_entropy(p_true, q_pred):
    q_pred = np.clip(q_pred, 1e-15, 1.0)
    return -np.sum(p_true * np.log(q_pred))

true_label = np.array([0, 0, 1])

good_pred = np.array([0.05, 0.05, 0.90])
okay_pred = np.array([0.10, 0.20, 0.70])
bad_pred = np.array([0.60, 0.30, 0.10])

print(f"Good prediction:  CE = {cross_entropy(true_label, good_pred):.4f}")
print(f"Okay prediction:  CE = {cross_entropy(true_label, okay_pred):.4f}")
print(f"Bad prediction:   CE = {cross_entropy(true_label, bad_pred):.4f}")

def binary_cross_entropy(y_true, y_pred):
    y_pred = np.clip(y_pred, 1e-15, 1 - 1e-15)
    return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))

y_true = np.array([1, 0, 1, 1, 0])
y_pred = np.array([0.9, 0.1, 0.8, 0.7, 0.3])
print(f"\nBinary CE: {binary_cross_entropy(y_true, y_pred):.4f}")
```

---

## KL Divergence: Distance Between Distributions

```
  KL DIVERGENCE
  =============

  D_KL(P || Q) = sum P(x) * log(P(x) / Q(x))

  "How much information is LOST when using Q to
   approximate P"

  ┌──────────────────────────────────────────────┐
  │  D_KL(P || Q) >= 0          (always)         │
  │  D_KL(P || Q) = 0  iff P = Q                │
  │  D_KL(P || Q) != D_KL(Q || P) (asymmetric!) │
  └──────────────────────────────────────────────┘

  NOT a true distance (not symmetric).
  But extremely useful anyway.

  WHERE KL DIVERGENCE APPEARS:
  - VAE loss (reconstruction + KL regularizer)
  - Policy optimization (TRPO, PPO)
  - Knowledge distillation (teacher vs student)
  - Bayesian inference (variational methods)
```

```python
import numpy as np

def kl_divergence(p, q):
    p = np.array(p, dtype=np.float64)
    q = np.array(q, dtype=np.float64)
    mask = p > 0
    return np.sum(p[mask] * np.log(p[mask] / q[mask]))

p = [0.4, 0.3, 0.2, 0.1]
q_close = [0.35, 0.30, 0.25, 0.10]
q_far = [0.1, 0.1, 0.1, 0.7]

print(f"KL(P || Q_close) = {kl_divergence(p, q_close):.4f}")
print(f"KL(P || Q_far)   = {kl_divergence(p, q_far):.4f}")

print(f"\nKL(P || Q_close) = {kl_divergence(p, q_close):.4f}")
print(f"KL(Q_close || P) = {kl_divergence(q_close, p):.4f}")
print("(asymmetric!)")
```

---

## Mutual Information

```
  MUTUAL INFORMATION
  ==================

  I(X; Y) = H(X) + H(Y) - H(X, Y)
           = H(X) - H(X|Y)

  "How much does knowing Y tell you about X?"

  ┌───────────────────────────────────────────┐
  │  I(X;Y) = 0: X and Y are independent     │
  │  I(X;Y) > 0: Y carries info about X      │
  │  I(X;Y) = H(X): Y completely determines X│
  └───────────────────────────────────────────┘

  Uses in ML:
  - Feature selection: pick features with high MI to target
  - Clustering evaluation: adjusted mutual information
  - Representation learning: maximize MI between
    input and learned representation
```

```python
import numpy as np
from sklearn.feature_selection import mutual_info_classif
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=1000, n_features=10, n_informative=3, random_state=42)

mi_scores = mutual_info_classif(X, y, random_state=42)
for i, score in enumerate(mi_scores):
    bar = "#" * int(score * 50)
    print(f"Feature {i:2d}: MI = {score:.3f}  {bar}")
```

---

## Putting It All Together

```
  RELATIONSHIP MAP
  ================

  Entropy H(P):
  - Uncertainty in distribution P
  - Lower bound on compression

  Cross-Entropy H(P, Q):
  - Cost of encoding P using code designed for Q
  - H(P, Q) = H(P) + D_KL(P || Q)

  KL Divergence D_KL(P || Q):
  - Extra cost of using Q instead of P
  - D_KL = H(P, Q) - H(P)

  ┌─────────────────────────────────────┐
  │  H(P, Q) = H(P) + D_KL(P || Q)     │
  │                                     │
  │  Since H(P) is constant w.r.t. Q:   │
  │  min_Q H(P, Q) = min_Q D_KL(P||Q)  │
  │                                     │
  │  Minimizing cross-entropy loss IS   │
  │  minimizing KL divergence to the    │
  │  true distribution!                 │
  └─────────────────────────────────────┘
```

---

## Exercises

**Exercise 1:** Compute the entropy of the English alphabet using
letter frequency data. Compare with the maximum possible entropy
(uniform over 26 letters). How much redundancy does English have?

**Exercise 2:** Implement cross-entropy loss from scratch for
multi-class classification. Verify it matches
`torch.nn.CrossEntropyLoss` on random inputs and targets.

**Exercise 3:** Generate two distributions P and Q. Compute
D_KL(P||Q) and D_KL(Q||P). Verify they differ. Plot both
distributions and explain intuitively why KL is asymmetric.

**Exercise 4:** Use mutual information for feature selection on
a real dataset. Select the top 5 features by MI. Train a model
with all features vs top 5. Compare accuracy.

**Exercise 5:** Implement the VAE loss function:
reconstruction_loss + beta * KL(q(z|x) || p(z)).
Show how changing beta trades off reconstruction quality
vs latent space regularity.

---

[Next: Lesson 18 - Statistical Testing ->](18-statistical-testing.md)
