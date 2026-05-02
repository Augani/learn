# Lesson 06: Bias Mitigation: In-processing and Post-processing

> If you can't clean the water before it enters the pipes, you can filter it during processing or purify it at the tap.

---

## The Assembly Line Analogy

Imagine a car factory. Pre-processing is quality-checking parts
before assembly. In-processing is adjusting the assembly line
itself — adding constraints so the machine builds fairly. Post-
processing is inspecting finished cars and adjusting them before
they leave the factory.

Each approach has trade-offs. In-processing changes how the model
learns. Post-processing changes what the model outputs. Both can
improve fairness without touching the training data.

```
  MITIGATION STAGES

  Pre-processing          In-processing           Post-processing
  (fix the data)          (fix the training)      (fix the output)
  +------------+          +------------+          +------------+
  | Before     |          | During     |          | After      |
  | model sees | -------> | model      | -------> | model      |
  | the data   |          | training   |          | predicts   |
  +------------+          +------------+          +------------+
  Reweighting             Constraints             Threshold
  Resampling              Adversarial             adjustment
  Proxy removal           Regularization          Calibration
```

---

## In-processing: Fairness Constraints During Training

### The Idea

Add fairness as a constraint or regularization term to the
optimization objective. The model learns to be accurate *and* fair
simultaneously.

**Standard training:** minimize Loss(y, ŷ)

**Fair training:** minimize Loss(y, ŷ) + λ · FairnessViolation(ŷ, A)

The hyperparameter λ controls the fairness-accuracy trade-off.

```
  CONSTRAINED OPTIMIZATION

  Standard:    min  Loss(predictions, labels)

  Fair:        min  Loss(predictions, labels)
               s.t. FairnessMetric(predictions, groups) ≤ ε

  Or equivalently:

  Fair:        min  Loss + λ × FairnessViolation

  λ = 0  → ignore fairness (standard training)
  λ = ∞  → ignore accuracy (perfectly fair, useless model)
  λ = ?  → the sweet spot you need to find
```

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.linear_model import LogisticRegression

# Create biased dataset
np.random.seed(42)
n = 2000

X = np.random.randn(n, 5)
sensitive = np.random.choice([0, 1], n, p=[0.5, 0.5])
# Bias: sensitive attribute influences the label
y = ((X[:, 0] + 0.5 * X[:, 1] - 0.6 * sensitive +
      np.random.randn(n) * 0.5) > 0).astype(int)

X_train, X_test, y_train, y_test, s_train, s_test = train_test_split(
    X, y, sensitive, test_size=0.3, random_state=42
)
```

### Fairness Constraints with fairlearn

```python
from fairlearn.reductions import (
    ExponentiatedGradient,
    DemographicParity,
    EqualizedOdds,
)

# Exponentiated Gradient: reduces fair classification to a
# sequence of cost-sensitive classification problems
constraint = DemographicParity()
mitigator = ExponentiatedGradient(
    estimator=LogisticRegression(max_iter=1000),
    constraints=constraint,
)
mitigator.fit(X_train, y_train, sensitive_features=s_train)
pred_fair = mitigator.predict(X_test)

# Compare with unconstrained model
model_std = LogisticRegression(max_iter=1000)
model_std.fit(X_train, y_train)
pred_std = model_std.predict(X_test)

# Results
for name, preds in [('Standard', pred_std), ('Fair (DP)', pred_fair)]:
    acc = accuracy_score(y_test, preds)
    rates = {}
    for g in [0, 1]:
        mask = s_test == g
        rates[g] = preds[mask].mean()
    gap = abs(rates[0] - rates[1])
    print(f"{name}: Acc={acc:.3f}, Rate_0={rates[0]:.3f}, "
          f"Rate_1={rates[1]:.3f}, Gap={gap:.3f}")
```

```python
# Try different fairness constraints
constraints = {
    'Demographic Parity': DemographicParity(),
    'Equalized Odds': EqualizedOdds(),
}

results = []
for name, constraint in constraints.items():
    mitigator = ExponentiatedGradient(
        estimator=LogisticRegression(max_iter=1000),
        constraints=constraint,
    )
    mitigator.fit(X_train, y_train, sensitive_features=s_train)
    preds = mitigator.predict(X_test)

    acc = accuracy_score(y_test, preds)
    rates = {g: preds[s_test == g].mean() for g in [0, 1]}
    results.append({
        'constraint': name,
        'accuracy': acc,
        'rate_gap': abs(rates[0] - rates[1]),
    })

print(pd.DataFrame(results).to_string(index=False))
```

---

## Adversarial Debiasing

Train two models simultaneously: a predictor that tries to be
accurate, and an adversary that tries to predict the sensitive
attribute from the predictor's output. The predictor learns to
make predictions that the adversary can't distinguish by group.

```
  ADVERSARIAL DEBIASING

  Input ──> Predictor ──> Predictions ──> Loss (accuracy)
                |                            ↑
                |                     Minimize this
                v
            Adversary ──> Group prediction ──> Loss (group detection)
                                                 ↑
                                          Maximize this
                                          (confuse adversary)

  The predictor learns to be accurate while hiding
  group membership from the adversary.
```

```python
# Adversarial debiasing concept with PyTorch
import torch
import torch.nn as nn
import torch.optim as optim

class Predictor(nn.Module):
    def __init__(self, input_dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.net(x)

class Adversary(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(1, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid()
        )

    def forward(self, pred):
        return self.net(pred)

# Training loop (simplified)
def train_adversarial(X_train, y_train, s_train, epochs=100, lam=1.0):
    predictor = Predictor(X_train.shape[1])
    adversary = Adversary()

    pred_optimizer = optim.Adam(predictor.parameters(), lr=0.001)
    adv_optimizer = optim.Adam(adversary.parameters(), lr=0.001)
    criterion = nn.BCELoss()

    X_t = torch.FloatTensor(X_train)
    y_t = torch.FloatTensor(y_train).unsqueeze(1)
    s_t = torch.FloatTensor(s_train).unsqueeze(1)

    for epoch in range(epochs):
        # Step 1: Train adversary to predict group from predictions
        pred_out = predictor(X_t).detach()
        adv_out = adversary(pred_out)
        adv_loss = criterion(adv_out, s_t)
        adv_optimizer.zero_grad()
        adv_loss.backward()
        adv_optimizer.step()

        # Step 2: Train predictor to be accurate AND fool adversary
        pred_out = predictor(X_t)
        pred_loss = criterion(pred_out, y_t)
        adv_out = adversary(pred_out)
        adv_loss = criterion(adv_out, s_t)

        # Minimize prediction loss, maximize adversary loss
        total_loss = pred_loss - lam * adv_loss
        pred_optimizer.zero_grad()
        total_loss.backward()
        pred_optimizer.step()

    return predictor

predictor = train_adversarial(X_train, y_train, s_train, epochs=200, lam=1.0)

# Evaluate
with torch.no_grad():
    preds = (predictor(torch.FloatTensor(X_test)) > 0.5).numpy().flatten()

acc = accuracy_score(y_test, preds)
rates = {g: preds[s_test == g].mean() for g in [0, 1]}
print(f"Adversarial: Acc={acc:.3f}, Rate_0={rates[0]:.3f}, "
      f"Rate_1={rates[1]:.3f}, Gap={abs(rates[0]-rates[1]):.3f}")
```

---

## Post-processing: Threshold Adjustment

The simplest post-processing technique: use different decision
thresholds for different groups to equalize outcomes.

```
  THRESHOLD ADJUSTMENT

  Standard: threshold = 0.5 for everyone

  Group A: P(positive) = 0.65  (advantaged)
  Group B: P(positive) = 0.45  (disadvantaged)

  Adjusted thresholds:
  Group A: threshold = 0.55  (raise bar slightly)
  Group B: threshold = 0.42  (lower bar slightly)

  Result: equalized positive rates across groups
```

```python
from sklearn.ensemble import GradientBoostingClassifier

# Train a standard model
model = GradientBoostingClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
y_prob = model.predict_proba(X_test)[:, 1]

# Find optimal thresholds for demographic parity
def find_fair_thresholds(y_prob, sensitive, target_rate=None):
    """Find group-specific thresholds for demographic parity."""
    groups = np.unique(sensitive)

    if target_rate is None:
        # Target the overall positive rate
        target_rate = (y_prob > 0.5).mean()

    thresholds = {}
    for group in groups:
        mask = sensitive == group
        group_probs = np.sort(y_prob[mask])[::-1]
        n_positive = int(target_rate * mask.sum())
        if n_positive > 0 and n_positive <= len(group_probs):
            thresholds[group] = group_probs[n_positive - 1]
        else:
            thresholds[group] = 0.5

    return thresholds

thresholds = find_fair_thresholds(y_prob, s_test)
print(f"Fair thresholds: {thresholds}")

# Apply group-specific thresholds
y_pred_fair = np.zeros_like(y_prob, dtype=int)
for group, thresh in thresholds.items():
    mask = s_test == group
    y_pred_fair[mask] = (y_prob[mask] >= thresh).astype(int)

# Compare
y_pred_std = (y_prob >= 0.5).astype(int)
for name, preds in [('Standard (0.5)', y_pred_std), ('Fair thresholds', y_pred_fair)]:
    acc = accuracy_score(y_test, preds)
    rates = {g: preds[s_test == g].mean() for g in [0, 1]}
    print(f"{name}: Acc={acc:.3f}, Rate_0={rates[0]:.3f}, "
          f"Rate_1={rates[1]:.3f}, Gap={abs(rates[0]-rates[1]):.3f}")
```

---

## Post-processing with fairlearn

```python
from fairlearn.postprocessing import ThresholdOptimizer

# ThresholdOptimizer finds optimal thresholds for a fairness constraint
postprocessor = ThresholdOptimizer(
    estimator=model,
    constraints="demographic_parity",
    prefit=True,
)
postprocessor.fit(X_test, y_test, sensitive_features=s_test)
y_pred_post = postprocessor.predict(X_test, sensitive_features=s_test)

acc = accuracy_score(y_test, y_pred_post)
rates = {g: y_pred_post[s_test == g].mean() for g in [0, 1]}
print(f"ThresholdOptimizer: Acc={acc:.3f}, Rate_0={rates[0]:.3f}, "
      f"Rate_1={rates[1]:.3f}, Gap={abs(rates[0]-rates[1]):.3f}")
```

---

## Comparing All Approaches

```
  METHOD COMPARISON

  Approach          When to Use              Pros                 Cons
  ────────────────  ─────────────────────    ──────────────────   ──────────────────
  Pre-processing    Any model, early stage   Model-agnostic       May lose signal
  (Lesson 05)       Data is clearly biased   Easy to understand   Can't guarantee
                                                                  model fairness

  In-processing     Training from scratch    Directly optimizes   Model-specific
  (constraints)     Need strong guarantees   fairness             Slower training
                                             Principled           Complex to tune

  In-processing     Neural networks          Powerful             Requires careful
  (adversarial)     Complex bias patterns    Flexible             tuning of λ
                                                                  Training instability

  Post-processing   Can't retrain model      Simple to apply      Requires group
  (thresholds)      Quick fix needed         No retraining        labels at inference
                    Model already deployed   Preserves model      May feel arbitrary
```

---

## Exercises

### Exercise 1: Constraint Comparison

Using the Adult Income dataset:

```python
# 1. Train a standard LogisticRegression
# 2. Apply ExponentiatedGradient with DemographicParity
# 3. Apply ExponentiatedGradient with EqualizedOdds
# 4. Apply ThresholdOptimizer with demographic_parity
# 5. Compare all four models: accuracy, DP difference, EO difference
# 6. Which approach gives the best fairness-accuracy trade-off?
```

### Exercise 2: Adversarial Debiasing Tuning

Experiment with the adversarial debiasing approach:

1. Train with λ values of 0.1, 0.5, 1.0, 2.0, 5.0
2. For each λ, measure accuracy and demographic parity gap
3. Plot the trade-off curve
4. At what λ does the model become "fair enough" (DIR ≥ 0.8)?
5. How much accuracy do you lose at that point?

---

Next: [Lesson 07: Model Interpretability Basics](./07-interpretability-basics.md)
