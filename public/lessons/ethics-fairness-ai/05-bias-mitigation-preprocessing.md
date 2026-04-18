# Lesson 05: Bias Mitigation: Pre-processing

> Fix the data before the model sees it — because a model trained on biased data will learn biased patterns, no matter how sophisticated the algorithm.

---

## The Water Filter Analogy

If your water supply is contaminated, you have two choices: filter
the water before it reaches your house, or install a purifier at
every faucet. Pre-processing bias mitigation is the water filter
approach — clean the data before the model ever touches it.

The advantage: any model trained on the cleaned data benefits. The
disadvantage: you might filter out useful signal along with the
bias. Getting the balance right is the art of fair ML.

```
  WATER FILTRATION                  DATA PRE-PROCESSING
  +------------------+              +------------------+
  | Contaminated     |              | Biased training  |
  |  water supply    |              |  data            |
  +--------+---------+              +--------+---------+
           |                                 |
           v                                 v
  +------------------+              +------------------+
  | Filter at source |              | Reweight, resample|
  | (remove toxins)  |              | (reduce bias)     |
  +--------+---------+              +--------+---------+
           |                                 |
           v                                 v
  +------------------+              +------------------+
  | Clean water to   |              | Fairer data to   |
  |  every faucet    |              |  any model       |
  +------------------+              +------------------+
```

---

## Pre-processing Techniques Overview

```
  PRE-PROCESSING MITIGATION METHODS

  +-----------------+     +-----------------+     +-----------------+
  |   Resampling    |     |   Reweighting   |     |  Proxy Removal  |
  | Over/undersample|     | Assign instance |     | Remove features |
  | to balance      |     | weights to      |     | correlated with |
  | group outcomes  |     | equalize impact |     | sensitive attr  |
  +-----------------+     +-----------------+     +-----------------+
         |                       |                       |
         v                       v                       v
  +-----------------+     +-----------------+
  | Data            |     | Fair Represen-  |
  | Augmentation    |     | tation Learning |
  | Generate fair   |     | Transform data  |
  | synthetic data  |     | to remove bias  |
  +-----------------+     +-----------------+
```

---

## Resampling

Adjust the dataset so that positive outcomes are equally
distributed across groups.

**Oversampling:** Duplicate instances from the disadvantaged group
that received positive outcomes.

**Undersampling:** Remove instances from the advantaged group that
received positive outcomes.

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score

# Create biased dataset
np.random.seed(42)
n = 2000

data = pd.DataFrame({
    'feature_1': np.random.randn(n),
    'feature_2': np.random.randn(n),
    'feature_3': np.random.randn(n),
    'group': np.random.choice(['A', 'B'], n, p=[0.5, 0.5]),
})

# Biased labels: Group B has lower positive rate
score = data['feature_1'] + 0.5 * data['feature_2'] + np.random.randn(n) * 0.5
bias = np.where(data['group'] == 'B', -0.8, 0)
data['label'] = ((score + bias) > 0).astype(int)

print("Before resampling:")
print(data.groupby('group')['label'].mean())
# Group A: ~65%, Group B: ~45%
```

```python
# Resampling to equalize positive rates
def resample_for_fairness(df, group_col, label_col, target_rate=None):
    """Oversample positive instances in disadvantaged group."""
    groups = df[group_col].unique()
    rates = df.groupby(group_col)[label_col].mean()

    if target_rate is None:
        target_rate = rates.max()

    resampled_parts = []
    for group in groups:
        group_df = df[df[group_col] == group]
        current_rate = rates[group]

        if current_rate < target_rate:
            # Oversample positive instances
            pos = group_df[group_df[label_col] == 1]
            neg = group_df[group_df[label_col] == 0]

            n_pos_needed = int(target_rate * len(group_df) / (1 - target_rate + 1e-10)) * 1
            n_to_add = max(0, n_pos_needed - len(pos))

            if n_to_add > 0 and len(pos) > 0:
                oversampled = pos.sample(n=n_to_add, replace=True, random_state=42)
                group_df = pd.concat([group_df, oversampled])

        resampled_parts.append(group_df)

    return pd.concat(resampled_parts).reset_index(drop=True)

resampled = resample_for_fairness(data, 'group', 'label')
print("\nAfter resampling:")
print(resampled.groupby('group')['label'].mean())
```

---

## Reweighting

Instead of changing the data, assign weights to each instance so
that the weighted distribution is fair.

```python
# Reweighting with aif360
from collections import defaultdict

def compute_reweights(df, group_col, label_col):
    """Compute instance weights to achieve demographic parity."""
    n = len(df)
    weights = np.ones(n)

    # Expected probability of each (group, label) combination
    # under independence assumption
    for group in df[group_col].unique():
        for label in [0, 1]:
            mask = (df[group_col] == group) & (df[label_col] == label)
            observed = mask.sum() / n

            # Expected under independence
            p_group = (df[group_col] == group).sum() / n
            p_label = (df[label_col] == label).sum() / n
            expected = p_group * p_label

            if observed > 0:
                weights[mask] = expected / observed

    return weights

weights = compute_reweights(data, 'group', 'label')

# Verify: weighted positive rates should be closer
for group in ['A', 'B']:
    mask = data['group'] == group
    weighted_rate = np.average(data.loc[mask, 'label'], weights=weights[mask])
    print(f"Group {group} weighted positive rate: {weighted_rate:.3f}")
```

```python
# Train with sample weights
features = ['feature_1', 'feature_2', 'feature_3']
X_train, X_test, y_train, y_test, s_train, s_test, w_train, w_test = \
    train_test_split(
        data[features], data['label'], data['group'], weights,
        test_size=0.3, random_state=42
    )

# Without weights
model_unweighted = GradientBoostingClassifier(n_estimators=100, random_state=42)
model_unweighted.fit(X_train, y_train)
pred_unweighted = model_unweighted.predict(X_test)

# With weights
model_weighted = GradientBoostingClassifier(n_estimators=100, random_state=42)
model_weighted.fit(X_train, y_train, sample_weight=w_train)
pred_weighted = model_weighted.predict(X_test)

# Compare fairness
for name, preds in [('Unweighted', pred_unweighted), ('Weighted', pred_weighted)]:
    rates = {}
    for group in ['A', 'B']:
        mask = s_test == group
        rates[group] = preds[mask].mean()
    dir_ratio = min(rates.values()) / max(rates.values())
    acc = accuracy_score(y_test, preds)
    print(f"{name}: Acc={acc:.3f}, DIR={dir_ratio:.3f}, "
          f"Rate A={rates['A']:.3f}, Rate B={rates['B']:.3f}")
```

---

## Removing Proxies

Even if you remove the sensitive attribute, other features may
serve as proxies (e.g., zip code correlates with race, name
correlates with gender).

```python
# Identifying proxy features
from sklearn.ensemble import RandomForestClassifier

# Can we predict the sensitive attribute from other features?
proxy_model = RandomForestClassifier(n_estimators=50, random_state=42)
group_encoded = (data['group'] == 'B').astype(int)
proxy_model.fit(data[features], group_encoded)

proxy_accuracy = proxy_model.score(data[features], group_encoded)
print(f"Can predict group from features with {proxy_accuracy:.1%} accuracy")

# Feature importance for predicting group membership
importances = pd.Series(
    proxy_model.feature_importances_, index=features
).sort_values(ascending=False)
print("\nProxy strength (feature importance for predicting group):")
print(importances)

# Features with high importance are potential proxies
# Consider removing or transforming them
```

```
  PROXY DETECTION

  Sensitive attribute: Race (not in features)

  But these features correlate with race:
  ┌──────────────────┬────────────────┐
  │ Feature          │ Proxy Strength │
  ├──────────────────┼────────────────┤
  │ Zip code         │ ████████░░ 0.82│
  │ Last name        │ ██████░░░░ 0.61│
  │ School attended  │ █████░░░░░ 0.54│
  │ Income           │ ████░░░░░░ 0.43│
  │ Credit history   │ ███░░░░░░░ 0.31│
  └──────────────────┴────────────────┘

  Removing "race" alone doesn't remove racial bias.
  The proxies carry the signal.
```

---

## Fair Representation Learning

Transform the feature space so that the sensitive attribute cannot
be predicted from the transformed features, while preserving as
much useful information as possible.

```python
# Simplified fair representation: project out the sensitive direction
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()
X_scaled = scaler.fit_transform(data[features])

# Find the direction most correlated with the sensitive attribute
group_binary = (data['group'] == 'B').astype(float).values
# Project out the component correlated with group
correlation = X_scaled.T @ group_binary / len(group_binary)
correlation = correlation / np.linalg.norm(correlation)

# Remove the projection onto the sensitive direction
X_fair = X_scaled - np.outer(X_scaled @ correlation, correlation)

# Verify: can we still predict group from fair features?
proxy_model_fair = RandomForestClassifier(n_estimators=50, random_state=42)
proxy_model_fair.fit(X_fair, group_encoded)
fair_proxy_acc = proxy_model_fair.score(X_fair, group_encoded)
print(f"Proxy accuracy after fair projection: {fair_proxy_acc:.1%}")
# Should be closer to 50% (random chance)
```

---

## The Fairness-Accuracy Trade-off

Every pre-processing technique involves a trade-off. Removing bias
often means removing some predictive signal.

```
  THE TRADE-OFF

  Accuracy
  100% |*
       | *
   95% |  *  *
       |      *
   90% |        *  *
       |              *
   85% |                 *
       |
   80% +--+--+--+--+--+--+---> Fairness
       0  0.2 0.4 0.6 0.8 1.0
       (unfair)          (fair)

  The Pareto frontier: you can't improve fairness
  without some accuracy cost (and vice versa).

  The goal: find the sweet spot for your application.
```

```python
# Measuring the trade-off
from fairlearn.metrics import demographic_parity_difference

results = []
# Try different reweighting strengths
for alpha in [0, 0.2, 0.4, 0.6, 0.8, 1.0]:
    # Blend original weights with fairness weights
    blended = (1 - alpha) * np.ones(len(w_train)) + alpha * w_train

    model = GradientBoostingClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train, sample_weight=blended)
    preds = model.predict(X_test)

    acc = accuracy_score(y_test, preds)
    dpd = abs(demographic_parity_difference(y_test, preds, sensitive_features=s_test))

    results.append({'alpha': alpha, 'accuracy': acc, 'dp_diff': dpd})

results_df = pd.DataFrame(results)
print(results_df.to_string(index=False))
```

---

## Exercises

### Exercise 1: Reweighting Pipeline

Apply reweighting to the Adult Income dataset and measure the
impact on both accuracy and fairness:

```python
# 1. Load Adult dataset, identify sensitive attribute (sex)
# 2. Compute reweighting factors
# 3. Train models with and without weights
# 4. Compare: accuracy, demographic parity, equalized odds
# 5. Plot the fairness-accuracy trade-off curve
```

### Exercise 2: Proxy Analysis

Using the Adult Income dataset:

1. Remove the `sex` column from features
2. Train a model to predict `sex` from remaining features
3. Which features are the strongest proxies?
4. Remove the top 2 proxies and retrain the original model
5. How does this affect fairness metrics? Accuracy?

---

Next: [Lesson 06: Bias Mitigation: In-processing and Post-processing](./06-bias-mitigation-inprocessing.md)
