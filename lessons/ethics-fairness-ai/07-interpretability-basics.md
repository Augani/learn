# Lesson 07: Model Interpretability Basics

> A model that can't explain itself is like a doctor who says "trust me" — sometimes you need to see the reasoning.

---

## The Doctor's Diagnosis Analogy

You visit a doctor with a cough. Doctor A says: "You have
bronchitis. Take these antibiotics." Doctor B says: "Based on your
persistent cough for 3 weeks, the crackling sounds in your lower
left lung, and your slightly elevated white blood cell count, I
believe you have bronchitis. Here's why I'm recommending
antibiotics over other treatments..."

Both doctors might be equally accurate. But Doctor B lets you
understand, question, and trust the diagnosis. Model
interpretability is about building Doctor B models — or at least
being able to ask Doctor A to explain after the fact.

```
  DOCTOR A (Black Box)              DOCTOR B (Interpretable)
  +------------------+              +------------------+
  | Input: symptoms  |              | Input: symptoms  |
  |                  |              |                  |
  | [BLACK BOX]      |              | Cough: 3 weeks   |
  |                  |              | Lung sounds: ✗    |
  | Output: diagnosis|              | WBC: elevated     |
  +------------------+              | → Bronchitis (87%)|
                                    +------------------+
  "Trust me"                        "Here's why"
```

---

## Why Interpretability Matters

1. **Trust** — Stakeholders need to understand why a model makes
   decisions before they'll rely on it
2. **Debugging** — If a model is wrong, you need to know *why* to
   fix it
3. **Fairness** — You can't detect bias if you can't see what the
   model is using
4. **Regulation** — Laws like GDPR include a "right to explanation"
5. **Science** — Understanding what the model learned can generate
   new hypotheses

---

## Intrinsic vs Post-hoc Interpretability

```
  INTERPRETABILITY APPROACHES

  INTRINSIC                         POST-HOC
  (built into the model)            (applied after training)
  +------------------+              +------------------+
  | Linear regression|              | Feature importance|
  | Decision trees   |              | Partial dependence|
  | Rule lists       |              | SHAP values      |
  | GAMs             |              | LIME             |
  +------------------+              +------------------+
        |                                  |
        v                                  v
  "The model IS the                "We EXPLAIN the
   explanation"                     model's behavior"

  Simple models you can             Any model, explained
  read directly                     after the fact
```

**Intrinsic:** The model structure itself is interpretable. You can
read the coefficients, follow the tree, or inspect the rules.

**Post-hoc:** The model is a black box, but we apply techniques
after training to understand its behavior.

---

## Global vs Local Explanations

```
  GLOBAL                            LOCAL
  (how the model works overall)     (why this specific prediction)
  +------------------+              +------------------+
  | "Income is the   |              | "For THIS person,|
  |  most important  |              |  high debt ratio |
  |  feature across  |              |  was the main    |
  |  all predictions"|              |  reason for      |
  |                  |              |  rejection"      |
  +------------------+              +------------------+

  Feature importance                SHAP for one instance
  Partial dependence plots          LIME for one instance
  Global surrogate models           Counterfactual explanations
```

---

## Feature Importance

### Impurity-based Importance (Tree Models)

How much each feature reduces impurity (Gini or entropy) across
all splits in the tree ensemble.

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.datasets import fetch_openml
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt

# Load a real dataset
np.random.seed(42)
n = 1500
feature_names = ['income', 'debt_ratio', 'credit_years', 'num_accounts',
                 'employment_years', 'age', 'loan_amount', 'monthly_payment']

X = pd.DataFrame({
    'income': np.random.lognormal(10.5, 0.5, n),
    'debt_ratio': np.random.beta(2, 5, n),
    'credit_years': np.random.exponential(8, n).clip(0, 30),
    'num_accounts': np.random.poisson(4, n),
    'employment_years': np.random.exponential(5, n).clip(0, 25),
    'age': np.random.normal(40, 12, n).clip(18, 75),
    'loan_amount': np.random.lognormal(9, 0.8, n),
    'monthly_payment': np.random.lognormal(6, 0.5, n),
})

y = ((0.3 * (X['income'] / X['income'].max()) +
      0.25 * (1 - X['debt_ratio']) +
      0.2 * (X['credit_years'] / 30) +
      0.15 * (X['employment_years'] / 25) +
      0.1 * np.random.random(n)) > 0.45).astype(int)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42
)

# Train a Random Forest
rf = RandomForestClassifier(n_estimators=100, random_state=42)
rf.fit(X_train, y_train)

# Impurity-based feature importance
importances = pd.Series(rf.feature_importances_, index=X.columns)
importances = importances.sort_values(ascending=True)

fig, ax = plt.subplots(figsize=(8, 5))
importances.plot(kind='barh', ax=ax)
ax.set_title('Feature Importance (Impurity-based)')
ax.set_xlabel('Importance')
plt.tight_layout()
plt.savefig('feature_importance.png', dpi=150)
plt.show()
```

### Permutation Importance

Shuffle one feature at a time and measure how much accuracy drops.
More reliable than impurity-based importance because it doesn't
favor high-cardinality features.

```python
from sklearn.inspection import permutation_importance

# Permutation importance on test set
perm_result = permutation_importance(
    rf, X_test, y_test, n_repeats=10, random_state=42
)

perm_importances = pd.Series(
    perm_result.importances_mean, index=X.columns
).sort_values(ascending=True)

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

importances.plot(kind='barh', ax=axes[0])
axes[0].set_title('Impurity-based Importance')

perm_importances.plot(kind='barh', ax=axes[1])
axes[1].set_title('Permutation Importance')

plt.tight_layout()
plt.savefig('importance_comparison.png', dpi=150)
plt.show()
```

```
  IMPURITY vs PERMUTATION IMPORTANCE

  Impurity-based:                   Permutation:
  - Fast (computed during training) - Slower (requires re-evaluation)
  - Biased toward high-cardinality  - Unbiased
  - Can be misleading with          - Works with any model
    correlated features             - Measured on test set
  - Only for tree models            - More reliable
```

---

## Partial Dependence Plots (PDP)

Show the marginal effect of one or two features on the model's
prediction, averaging over all other features.

```python
from sklearn.inspection import PartialDependenceDisplay

# Partial dependence for top features
fig, axes = plt.subplots(1, 3, figsize=(15, 4))

features_to_plot = ['income', 'debt_ratio', 'credit_years']
for i, feature in enumerate(features_to_plot):
    PartialDependenceDisplay.from_estimator(
        rf, X_train, [feature], ax=axes[i],
        kind='average', random_state=42
    )
    axes[i].set_title(f'PDP: {feature}')

plt.tight_layout()
plt.savefig('partial_dependence.png', dpi=150)
plt.show()
```

```
  PARTIAL DEPENDENCE PLOT: income

  P(approved)
  0.8 |                          ___________
      |                    _____/
  0.6 |               ____/
      |          ____/
  0.4 |     ___/
      |  __/
  0.2 |_/
      +--+--+--+--+--+--+--+--+--+--+--> Income
      20k  40k  60k  80k 100k 120k 140k

  Reading: As income increases, the probability of
  approval increases, with diminishing returns above ~100k.
```

```python
# 2D Partial Dependence (interaction between two features)
fig, ax = plt.subplots(figsize=(8, 6))
PartialDependenceDisplay.from_estimator(
    rf, X_train, [('income', 'debt_ratio')], ax=ax,
    kind='average', random_state=42
)
ax.set_title('2D PDP: Income × Debt Ratio')
plt.tight_layout()
plt.savefig('pdp_2d.png', dpi=150)
plt.show()
```

---

## Individual Conditional Expectation (ICE) Plots

Like PDP but shows the effect for each individual instance, not
just the average. Reveals heterogeneity that PDP hides.

```python
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# PDP (average)
PartialDependenceDisplay.from_estimator(
    rf, X_train, ['income'], ax=axes[0],
    kind='average', random_state=42
)
axes[0].set_title('PDP (Average Effect)')

# ICE (individual effects)
PartialDependenceDisplay.from_estimator(
    rf, X_train.sample(50, random_state=42), ['income'], ax=axes[1],
    kind='individual', random_state=42
)
axes[1].set_title('ICE (Individual Effects)')

plt.tight_layout()
plt.savefig('pdp_vs_ice.png', dpi=150)
plt.show()
```

```
  PDP vs ICE

  PDP (average):                    ICE (individual):
  P(y)                              P(y)
  0.8 |        ___                  0.8 |    ___  ___  ___
      |    ___/                         |___/ __/  __/
  0.4 |___/                         0.4 |  _/ __/___
      |                                 |_/ _/
  0.0 +---------> feature           0.0 +---------> feature

  Shows the average                 Shows each instance
  effect (smooth)                   (may reveal subgroups)
```

---

## Choosing the Right Interpretability Method

```
  DECISION GUIDE

  Need to understand the model overall?
  │
  ├── Which features matter most?
  │   └── Permutation importance (any model)
  │       Impurity importance (tree models, fast)
  │
  ├── How does a feature affect predictions?
  │   └── Partial Dependence Plots (average effect)
  │       ICE Plots (individual effects)
  │
  └── Need to explain one specific prediction?
      └── See Lesson 08: SHAP and LIME
```

---

## Exercises

### Exercise 1: Feature Importance Analysis

Train a GradientBoostingClassifier on the Adult Income dataset and:

```python
# 1. Compute impurity-based feature importance
# 2. Compute permutation importance
# 3. Do they agree on the top 3 features?
# 4. Which features might be proxies for protected attributes?
# 5. What does this tell you about potential bias?
```

### Exercise 2: Partial Dependence Exploration

Using the same model:

1. Create PDP plots for the top 4 features
2. Create ICE plots for the same features
3. Do the ICE plots reveal any subgroups with different patterns?
4. Create a 2D PDP for the two most important features
5. What interactions does the 2D plot reveal?

---

Next: [Lesson 08: SHAP and LIME](./08-shap-lime.md)
