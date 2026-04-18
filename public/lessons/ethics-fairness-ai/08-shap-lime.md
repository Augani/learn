# Lesson 08: SHAP and LIME

> SHAP tells you exactly how much each feature contributed to a prediction — like fairly splitting a restaurant bill based on what everyone ordered.

---

## The Restaurant Bill Analogy

Five friends eat dinner. The bill is $200. How do you split it
fairly? You could split equally ($40 each), but Alice only had a
salad while Bob ordered lobster. The fair approach: figure out each
person's marginal contribution — what would the bill have been
without them?

SHAP values work the same way. The prediction is the "bill," and
each feature is a "diner." SHAP computes each feature's marginal
contribution to the prediction by considering every possible
combination of features — just like computing what the bill would
be for every possible subset of diners.

```
  RESTAURANT BILL = MODEL PREDICTION

  Total bill: $200                  Prediction: 0.85 (approved)
  Base (empty table): $0            Base (average): 0.50

  Alice (salad):    +$15            Income (high):     +0.15
  Bob (lobster):    +$65            Debt ratio (low):  +0.10
  Carol (pasta):    +$35            Credit years (20): +0.08
  Dave (steak):     +$50            Accounts (5):      +0.01
  Eve (fish):       +$35            Age (45):          +0.01

  Sum: $200 ✓                       Sum: 0.85 ✓
  Each person's fair share          Each feature's fair contribution
```

---

## SHAP: SHapley Additive exPlanations

SHAP values come from cooperative game theory (Shapley values,
1953). For each feature, SHAP computes the average marginal
contribution across all possible feature orderings.

```
  HOW SHAP VALUES ARE COMPUTED (simplified)

  For feature "income" with 3 other features:

  Ordering 1: {} → {income} → {income, debt} → {income, debt, age} → all
  Ordering 2: {debt} → {debt, income} → {debt, income, age} → all
  Ordering 3: {age} → {age, income} → {age, income, debt} → all
  ... (all permutations)

  SHAP(income) = average of income's marginal contribution
                 across ALL orderings

  This guarantees:
  ✓ Efficiency: SHAP values sum to (prediction - base value)
  ✓ Symmetry: features with equal contribution get equal SHAP
  ✓ Null: features that don't contribute get SHAP = 0
```

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
import shap
import matplotlib.pyplot as plt

# Create dataset
np.random.seed(42)
n = 1500
X = pd.DataFrame({
    'income': np.random.lognormal(10.5, 0.5, n),
    'debt_ratio': np.random.beta(2, 5, n),
    'credit_years': np.random.exponential(8, n).clip(0, 30),
    'num_accounts': np.random.poisson(4, n),
    'employment_years': np.random.exponential(5, n).clip(0, 25),
    'age': np.random.normal(40, 12, n).clip(18, 75),
})

y = ((0.3 * (X['income'] / X['income'].max()) +
      0.25 * (1 - X['debt_ratio']) +
      0.2 * (X['credit_years'] / 30) +
      0.15 * (X['employment_years'] / 25) +
      0.1 * np.random.random(n)) > 0.45).astype(int)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42
)

model = GradientBoostingClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# Compute SHAP values
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

print(f"SHAP values shape: {shap_values.shape}")
print(f"Base value: {explainer.expected_value:.3f}")
print(f"First prediction: {model.predict_proba(X_test.iloc[:1])[:, 1][0]:.3f}")
print(f"Base + SHAP sum: {explainer.expected_value + shap_values[0].sum():.3f}")
```

### SHAP Waterfall Plot

Explains a single prediction by showing each feature's contribution.

```python
# Waterfall plot for one instance
shap.plots.waterfall(shap.Explanation(
    values=shap_values[0],
    base_values=explainer.expected_value,
    data=X_test.iloc[0],
    feature_names=X_test.columns.tolist()
))
```

```
  SHAP WATERFALL (single prediction)

  Base value = 0.50
  ─────────────────────────────────────────
  income = 85000        ████████░  +0.12
  debt_ratio = 0.15     ██████░░░  +0.09
  credit_years = 18     ████░░░░░  +0.06
  employment_years = 12 ███░░░░░░  +0.04
  age = 52              █░░░░░░░░  +0.02
  num_accounts = 3      ░░░░░░░░░  +0.01
  ─────────────────────────────────────────
  Prediction = 0.84
```

### SHAP Summary Plot

Global view: shows feature importance and direction of effect.

```python
# Summary plot (global view)
shap.summary_plot(shap_values, X_test, plot_type='dot')
```

```
  SHAP SUMMARY PLOT

  Feature          Low ◄──────────► High SHAP value
  ─────────────────────────────────────────────────
  income           ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●
  debt_ratio       ●●●●●●●●●●●●●●●●●●●●●●
  credit_years     ●●●●●●●●●●●●●●●●●
  employment_yrs   ●●●●●●●●●●●●●
  age              ●●●●●●●●
  num_accounts     ●●●●●

  Color = feature value (red = high, blue = low)
  Position = SHAP value (right = pushes prediction up)
```

### SHAP Dependence Plot

Shows how a feature's SHAP value changes with its actual value.

```python
# Dependence plot: income colored by debt_ratio
shap.dependence_plot('income', shap_values, X_test, interaction_index='debt_ratio')
```

---

## LIME: Local Interpretable Model-agnostic Explanations

LIME explains individual predictions by fitting a simple
interpretable model (usually linear) in the neighborhood of the
instance being explained.

```
  HOW LIME WORKS

  1. Pick the instance to explain
  2. Generate perturbed samples nearby
  3. Get the black box's predictions for perturbations
  4. Fit a simple linear model weighted by proximity
  5. The linear model's coefficients = explanation

  +─────────────────────────────────+
  |  Black Box Model                |
  |  (complex decision boundary)    |
  |         ╱                       |
  |        ╱  ● instance            |
  |       ╱  ○○○ perturbations      |
  |      ╱  ─── local linear fit    |
  |     ╱                           |
  +─────────────────────────────────+

  Globally complex, locally simple.
```

```python
import lime
import lime.lime_tabular

# Create LIME explainer
lime_explainer = lime.lime_tabular.LimeTabularExplainer(
    training_data=X_train.values,
    feature_names=X_train.columns.tolist(),
    class_names=['rejected', 'approved'],
    mode='classification',
    random_state=42
)

# Explain a single prediction
instance_idx = 0
explanation = lime_explainer.explain_instance(
    X_test.iloc[instance_idx].values,
    model.predict_proba,
    num_features=6
)

# Print the explanation
print(f"Prediction: {model.predict(X_test.iloc[instance_idx:instance_idx+1])[0]}")
print(f"Probability: {model.predict_proba(X_test.iloc[instance_idx:instance_idx+1])}")
print("\nLIME explanation:")
for feature, weight in explanation.as_list():
    direction = "↑" if weight > 0 else "↓"
    print(f"  {direction} {feature}: {weight:+.3f}")
```

```python
# Visualize LIME explanation
explanation.as_pyplot_figure()
plt.tight_layout()
plt.savefig('lime_explanation.png', dpi=150)
plt.show()
```

---

## SHAP vs LIME: When to Use Each

```
  SHAP vs LIME COMPARISON

  Property          SHAP                    LIME
  ────────────────  ──────────────────────  ──────────────────────
  Theory            Game theory (Shapley)   Local linear approx
  Consistency       Mathematically          Approximate, can vary
                    guaranteed              between runs
  Global view       Yes (summary plots)     No (local only)
  Speed             Fast for trees,         Fast for any model
                    slow for others
  Additivity        Values sum to           No guarantee
                    prediction
  Model support     Tree, kernel, deep,     Any model (model-
                    gradient                agnostic)
  Best for          Detailed analysis,      Quick explanations,
                    auditing, reports       any model type
```

```python
# Comparing SHAP and LIME on the same instance
instance = X_test.iloc[0]

# SHAP explanation
shap_explanation = dict(zip(X_test.columns, shap_values[0]))

# LIME explanation
lime_exp = lime_explainer.explain_instance(
    instance.values, model.predict_proba, num_features=6
)
lime_explanation = dict(lime_exp.as_list())

print("Feature contributions (SHAP vs LIME):")
print(f"{'Feature':<20} {'SHAP':>8} {'LIME':>8}")
print("-" * 38)
for feature in X_test.columns:
    shap_val = shap_explanation.get(feature, 0)
    # LIME uses ranges, so we match by feature name
    lime_val = 0
    for lime_feat, lime_weight in lime_exp.as_list():
        if feature in lime_feat:
            lime_val = lime_weight
            break
    print(f"{feature:<20} {shap_val:>+8.3f} {lime_val:>+8.3f}")
```

---

## Practical Tips

```
  WHEN TO USE WHAT

  ┌─────────────────────────────────────────────┐
  │ Need to explain ONE prediction?             │
  │ → SHAP waterfall or LIME                    │
  │                                             │
  │ Need to understand the model OVERALL?       │
  │ → SHAP summary plot                         │
  │                                             │
  │ Need to audit for BIAS?                     │
  │ → SHAP values grouped by sensitive attribute│
  │                                             │
  │ Need to explain to NON-TECHNICAL audience?  │
  │ → LIME (simpler to explain)                 │
  │                                             │
  │ Need GUARANTEED consistency?                │
  │ → SHAP (mathematical properties)            │
  │                                             │
  │ Working with a TREE model?                  │
  │ → SHAP TreeExplainer (fast + exact)         │
  │                                             │
  │ Working with ANY model?                     │
  │ → LIME or SHAP KernelExplainer              │
  └─────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: SHAP Deep Dive

Train a GradientBoostingClassifier on the Adult Income dataset and:

```python
# 1. Compute SHAP values for the test set
# 2. Create a summary plot — which features matter most?
# 3. Create waterfall plots for 3 different predictions:
#    - One approved with high confidence
#    - One rejected with high confidence
#    - One borderline case
# 4. Create dependence plots for the top 2 features
# 5. Do the SHAP values reveal any potential bias?
```

### Exercise 2: SHAP vs LIME Comparison

Using the same model:

1. Pick 10 test instances
2. Compute both SHAP and LIME explanations for each
3. Do they agree on the most important feature for each instance?
4. Where do they disagree? Why might that happen?
5. Which explanation would you show to a loan applicant? Why?

---

Next: [Lesson 09: Interpreting Deep Learning Models](./09-deep-learning-interpretability.md)
