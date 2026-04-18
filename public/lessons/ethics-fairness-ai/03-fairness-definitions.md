# Lesson 03: Fairness Definitions and Metrics

> "Fair" means different things to different people — and in ML, you mathematically can't satisfy all definitions at once.

---

## The Cake-Splitting Analogy

Three friends need to split a cake. What's "fair"?

- **Equal slices** — everyone gets the same amount (demographic parity)
- **Proportional to hunger** — the hungriest person gets more (equal opportunity)
- **Proportional to contribution** — whoever baked it gets more (calibration)
- **Everyone is equally satisfied** — adjust until nobody feels cheated (individual fairness)

Each definition sounds reasonable. But they can't all be satisfied
simultaneously. If you give equal slices, the hungriest person is
still hungry. If you give proportional slices, the baker feels
shortchanged. This is exactly the problem with fairness in ML.

```
  CAKE-SPLITTING = FAIRNESS DEFINITIONS

  Equal slices          = Demographic Parity
  (same outcome rate)     (same positive rate across groups)

  Proportional to need  = Equal Opportunity
  (based on true need)    (same TPR across groups)

  Based on contribution = Calibration
  (earned outcomes)       (same meaning for same score)

  Nobody feels cheated  = Individual Fairness
  (similar → similar)     (similar people get similar outcomes)
```

---

## The Major Fairness Definitions

### Demographic Parity (Statistical Parity)

The positive prediction rate should be the same across groups.

**Formula:** P(Ŷ = 1 | A = a) = P(Ŷ = 1 | A = b)

**In plain English:** The same proportion of each group should
receive positive outcomes (loans approved, jobs offered, etc.).

**When it makes sense:** When you want equal representation in
outcomes regardless of historical patterns.

**When it breaks:** If base rates genuinely differ between groups
(e.g., different disease prevalence), forcing equal prediction
rates means the model is wrong for at least one group.

### Equalized Odds

Both the true positive rate (TPR) and false positive rate (FPR)
should be the same across groups.

**Formula:**
- P(Ŷ = 1 | Y = 1, A = a) = P(Ŷ = 1 | Y = 1, A = b)  (equal TPR)
- P(Ŷ = 1 | Y = 0, A = a) = P(Ŷ = 1 | Y = 0, A = b)  (equal FPR)

**In plain English:** The model should be equally accurate for all
groups — equally good at catching positives and equally unlikely
to produce false alarms.

**When it makes sense:** When you want the model's errors to be
distributed fairly across groups.

### Equal Opportunity

A relaxation of equalized odds — only the true positive rate needs
to be equal across groups.

**Formula:** P(Ŷ = 1 | Y = 1, A = a) = P(Ŷ = 1 | Y = 1, A = b)

**In plain English:** Among people who truly deserve a positive
outcome, the model should be equally likely to give it to them
regardless of group membership.

**When it makes sense:** When the cost of false negatives is much
higher than false positives (e.g., missing a qualified candidate).

### Calibration

Among people who receive the same score, the actual positive rate
should be the same across groups.

**Formula:** P(Y = 1 | Ŷ = s, A = a) = P(Y = 1 | Ŷ = s, A = b)

**In plain English:** A risk score of 0.7 should mean a 70%
probability of the positive outcome for everyone, regardless of
group.

**When it makes sense:** When scores are used for decision-making
and need to mean the same thing for everyone.

### Individual Fairness

Similar individuals should receive similar predictions.

**Formula:** d(Ŷ(x₁), Ŷ(x₂)) ≤ L · d(x₁, x₂)

**In plain English:** If two people are similar in relevant ways,
the model should treat them similarly.

**When it makes sense:** When group-level fairness isn't enough
and you need person-level guarantees.

**Challenge:** Defining "similar" is itself a value judgment.

```
  FAIRNESS DEFINITIONS AT A GLANCE

  Definition          What's Equal?           Focuses On
  ─────────────────   ─────────────────────   ──────────────
  Demographic Parity  Positive prediction     Outcomes
                      rate across groups

  Equalized Odds      TPR and FPR across      Error rates
                      groups

  Equal Opportunity   TPR across groups       True positive
                                              detection

  Calibration         Meaning of scores       Score reliability
                      across groups

  Individual          Treatment of similar    Person-level
  Fairness            individuals             consistency
```

---

## The Impossibility Theorem

Here's the uncomfortable truth: you can't satisfy all fairness
definitions simultaneously (except in trivial cases).

Specifically, Chouldechova (2017) and Kleinberg, Mullainathan &
Raghavan (2016) proved that when base rates differ between groups,
you cannot simultaneously achieve:

1. Calibration
2. Equal false positive rates
3. Equal false negative rates

This isn't a limitation of current algorithms — it's a mathematical
impossibility.

```
  THE IMPOSSIBILITY TRIANGLE

         Calibration
            /\
           /  \
          /    \
         / PICK \
        /  TWO   \
       /          \
      /____________\
  Equal FPR    Equal FNR

  When base rates differ between groups,
  you CANNOT have all three.

  This means every fairness choice is a TRADE-OFF.
```

**What this means in practice:** You must choose which fairness
definition matters most for your specific application. There is no
"fair by default" — fairness requires deliberate choices.

---

## Computing Fairness Metrics

```python
import numpy as np
import pandas as pd
from sklearn.datasets import make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

# Create a synthetic dataset with a sensitive attribute
np.random.seed(42)
n_samples = 2000

X, y = make_classification(
    n_samples=n_samples, n_features=10, n_informative=5,
    random_state=42, class_sep=1.0
)

# Sensitive attribute: group A and group B with different base rates
sensitive = np.random.choice([0, 1], size=n_samples, p=[0.5, 0.5])
# Introduce correlation between sensitive attribute and label
y = np.where(
    (sensitive == 1) & (np.random.random(n_samples) < 0.15),
    0, y  # Group B has slightly lower positive rate
)

X_train, X_test, y_train, y_test, s_train, s_test = train_test_split(
    X, y, sensitive, test_size=0.3, random_state=42
)

# Train a model
model = LogisticRegression(random_state=42, max_iter=1000)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
```

```python
# Computing fairness metrics manually
def fairness_metrics(y_true, y_pred, sensitive):
    """Compute key fairness metrics for binary classification."""
    results = {}

    for group_val in [0, 1]:
        mask = sensitive == group_val
        group_true = y_true[mask]
        group_pred = y_pred[mask]

        # Positive prediction rate (for demographic parity)
        pos_rate = group_pred.mean()

        # True positive rate (for equal opportunity)
        tp_mask = group_true == 1
        tpr = group_pred[tp_mask].mean() if tp_mask.sum() > 0 else 0

        # False positive rate (for equalized odds)
        fp_mask = group_true == 0
        fpr = group_pred[fp_mask].mean() if fp_mask.sum() > 0 else 0

        results[f'group_{group_val}'] = {
            'positive_rate': pos_rate,
            'tpr': tpr,
            'fpr': fpr,
            'count': mask.sum()
        }

    return results

metrics = fairness_metrics(y_test, y_pred, s_test)
for group, vals in metrics.items():
    print(f"\n{group}:")
    for metric, value in vals.items():
        print(f"  {metric}: {value:.3f}")
```

```python
# Using fairlearn for fairness metrics
from fairlearn.metrics import (
    MetricFrame,
    demographic_parity_difference,
    equalized_odds_difference,
    demographic_parity_ratio,
)
from sklearn.metrics import accuracy_score, recall_score

# MetricFrame: compute any metric broken down by group
metric_frame = MetricFrame(
    metrics={
        'accuracy': accuracy_score,
        'positive_rate': lambda y, p: p.mean(),
        'recall': recall_score,
    },
    y_true=y_test,
    y_pred=y_pred,
    sensitive_features=s_test
)

print("Metrics by group:")
print(metric_frame.by_group)

print(f"\nDemographic parity difference: "
      f"{demographic_parity_difference(y_test, y_pred, sensitive_features=s_test):.3f}")
print(f"Equalized odds difference: "
      f"{equalized_odds_difference(y_test, y_pred, sensitive_features=s_test):.3f}")
print(f"Demographic parity ratio: "
      f"{demographic_parity_ratio(y_test, y_pred, sensitive_features=s_test):.3f}")
```

---

## Choosing the Right Fairness Definition

There's no universal answer. The right definition depends on context.

```
  DECISION GUIDE

  What matters most in your application?
  │
  ├── Equal representation in outcomes?
  │   └── Use DEMOGRAPHIC PARITY
  │       Example: hiring, lending (equal access)
  │
  ├── Equal accuracy across groups?
  │   └── Use EQUALIZED ODDS
  │       Example: medical diagnosis (equal error rates)
  │
  ├── Don't miss qualified individuals?
  │   └── Use EQUAL OPPORTUNITY
  │       Example: scholarship selection (catch all deserving)
  │
  ├── Scores mean the same thing for everyone?
  │   └── Use CALIBRATION
  │       Example: risk assessment (score = probability)
  │
  └── Similar people treated similarly?
      └── Use INDIVIDUAL FAIRNESS
          Example: insurance pricing (case-by-case)
```

---

## Exercises

### Exercise 1: Compute and Compare Fairness Metrics

Using the Adult Income dataset, train a classifier and compute all
five fairness metrics with respect to sex and race:

```python
# Starter code
from fairlearn.metrics import MetricFrame
from sklearn.ensemble import GradientBoostingClassifier

# Load Adult dataset, train model, then:
# 1. Compute demographic parity difference for sex
# 2. Compute equalized odds difference for sex
# 3. Compute the same metrics for race
# 4. Which fairness definition shows the largest disparity?
# 5. Can you improve one metric without worsening another?
```

### Exercise 2: The Impossibility Theorem in Practice

Create a synthetic dataset where group A has a 30% base rate and
group B has a 60% base rate. Train a well-calibrated model and show
that you cannot simultaneously achieve calibration and equal false
positive rates. Visualize the trade-off.

---

Next: [Lesson 04: Measuring Bias in Models](./04-measuring-bias.md)
