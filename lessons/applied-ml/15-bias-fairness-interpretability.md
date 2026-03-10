# Lesson 15: Bias, Fairness & Interpretability

## When Models Make Unfair Decisions

A model is only as fair as the data it learns from. If a hiring
model is trained on a decade of resumes from a company that mostly
hired men, it will learn to prefer men -- not because men are better
candidates, but because the historical data is biased.

```
  THE BIAS PIPELINE
  =================

  Biased              Biased              Biased
  History  ---------> Data  -----------> Model  -----------> Decisions
  (past    unfairness (reflects past)    (learns the bias)  (amplifies it)
   world)

  A model does not know right from wrong.
  It copies patterns. Including unfair ones.
```

---

## Sources of Bias

```
  WHERE BIAS HIDES
  ================

  1. HISTORICAL BIAS
     Past decisions were biased, model learns them
     Example: Loan data reflects past discrimination

  2. REPRESENTATION BIAS
     Some groups underrepresented in training data
     Example: Medical data mostly from one demographic

  3. MEASUREMENT BIAS
     Features measured differently across groups
     Example: "Number of arrests" != "Criminal activity"

  4. LABEL BIAS
     Labels themselves reflect bias
     Example: "Good employee" rated by biased managers

  5. AGGREGATION BIAS
     One model for diverse populations
     Example: Same medical model for all age groups

  6. EVALUATION BIAS
     Test data not representative
     Example: Facial recognition tested mostly on
              one skin tone
```

---

## Detecting Bias

```python
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

np.random.seed(42)
n = 2000

df = pd.DataFrame({
    "gender": np.random.choice(["M", "F"], n),
    "experience": np.random.randint(0, 20, n),
    "education": np.random.choice(["HS", "BS", "MS", "PhD"], n),
    "skill_score": np.random.uniform(0, 100, n),
})

bias_factor = (df["gender"] == "M").astype(float) * 0.15
df["hired"] = (
    (df["skill_score"] / 100 * 0.5) +
    (df["experience"] / 20 * 0.3) +
    bias_factor +
    np.random.uniform(0, 0.2, n)
    > 0.5
).astype(int)

print("Hiring rates by gender:")
print(df.groupby("gender")["hired"].mean())
```

### Measuring Fairness Metrics

```python
def fairness_metrics(df, protected_col, target_col, pred_col):
    groups = df[protected_col].unique()
    metrics = {}

    for group in groups:
        mask = df[protected_col] == group
        group_df = df[mask]
        metrics[group] = {
            "selection_rate": group_df[pred_col].mean(),
            "accuracy": accuracy_score(group_df[target_col], group_df[pred_col]),
            "positive_rate": group_df[target_col].mean(),
            "count": len(group_df)
        }

    result = pd.DataFrame(metrics).T
    selection_rates = result["selection_rate"]
    result["disparate_impact"] = selection_rates.min() / selection_rates.max()
    return result

features = ["experience", "skill_score"]
X = df[features]
y = df["hired"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

df_test = df.iloc[X_test.index].copy()
df_test["prediction"] = model.predict(X_test)

metrics = fairness_metrics(df_test, "gender", "hired", "prediction")
print(metrics)
```

```
  FAIRNESS METRICS
  ================

  Metric                  Definition                  Fair When
  ------                  ----------                  ---------
  Disparate Impact        min(rate) / max(rate)       > 0.80
  Equal Opportunity       TPR equal across groups     TPR_A ~ TPR_B
  Equalized Odds          TPR and FPR equal           Both equal
  Demographic Parity      Selection rate equal        Rates similar
  Calibration             P(Y=1|score) same           Same per group
```

---

## Model Interpretability: Why Did It Decide That?

### Feature Importance (Global)

```python
importances = pd.Series(
    model.feature_importances_,
    index=features
).sort_values(ascending=False)

print("Feature Importance:")
print(importances)
```

### SHAP: SHapley Additive exPlanations

SHAP explains individual predictions. Like asking "why did the
model deny THIS loan application?"

```python
import shap

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

shap.summary_plot(shap_values[1], X_test, feature_names=features)
```

```
  SHAP VALUES EXPLAINED
  =====================

  For a single prediction:

  Base value (average prediction): 0.45
  + skill_score = 85:              +0.25  (high skill helps)
  + experience = 12:               +0.15  (good experience)
  = Final prediction:               0.85  (likely hired)

  SHAP WATERFALL
  ==============

  Base: 0.45  |========|
  +skill:     |========|#####|        +0.25
  +exp:       |========|#####|###|    +0.15
  Final: 0.85 |========|#####|###|
```

### SHAP for Individual Predictions

```python
idx = 0
shap.force_plot(
    explainer.expected_value[1],
    shap_values[1][idx],
    X_test.iloc[idx],
    feature_names=features,
    matplotlib=True
)
```

### LIME: Local Interpretable Model-agnostic Explanations

LIME explains any model by fitting a simple model locally around
the prediction.

```python
try:
    from lime.lime_tabular import LimeTabularExplainer

    lime_explainer = LimeTabularExplainer(
        X_train.values,
        feature_names=features,
        class_names=["Not Hired", "Hired"],
        mode="classification"
    )

    idx = 0
    explanation = lime_explainer.explain_instance(
        X_test.iloc[idx].values,
        model.predict_proba,
        num_features=len(features)
    )

    print("LIME Explanation:")
    for feature, weight in explanation.as_list():
        print(f"  {feature}: {weight:+.3f}")
except ImportError:
    print("Install lime: pip install lime")
```

---

## SHAP vs LIME

```
  COMPARISON
  ==========

  Feature         SHAP                LIME
  -------         ----                ----
  Theory          Game theory         Local approximation
  Consistency     Mathematically      Approximate
                  guaranteed
  Speed           Fast for trees      Model-agnostic (slower)
  Global view     Yes (summary plot)  No (local only)
  Model types     Trees (fast),       Any model
                  Any (slow)
  Interpretation  Additive contrib.   Linear approx.
```

---

## Mitigating Bias

```
  BIAS MITIGATION STRATEGIES
  ==========================

  PRE-PROCESSING (fix the data):
  - Rebalance training data
  - Remove or decorrelate protected attributes
  - Augment underrepresented groups

  IN-PROCESSING (fix the model):
  - Add fairness constraints to the loss function
  - Adversarial debiasing
  - Fair-aware algorithms

  POST-PROCESSING (fix the output):
  - Adjust thresholds per group
  - Calibrate probabilities per group
  - Reject option classification
```

### Threshold Adjustment

```python
from sklearn.metrics import f1_score

y_proba = model.predict_proba(X_test)[:, 1]

for group in ["M", "F"]:
    mask = df_test["gender"] == group
    best_threshold = 0.5
    best_f1 = 0

    for threshold in np.arange(0.3, 0.7, 0.01):
        preds = (y_proba[mask] >= threshold).astype(int)
        f1 = f1_score(y_test[mask], preds)
        if f1 > best_f1:
            best_f1 = f1
            best_threshold = threshold

    print(f"Group {group}: Best threshold = {best_threshold:.2f}, F1 = {best_f1:.3f}")
```

---

## The Interpretability-Accuracy Trade-off

```
  INTERPRETABILITY SPECTRUM
  =========================

  More Interpretable                    Less Interpretable
  <------------------------------------------>

  Linear        Decision    Random     XGBoost    Neural
  Regression    Tree        Forest                Network

  |============|===========|==========|=========|
  Easy to       Human-      Feature    SHAP/     Black
  explain       readable    importance LIME      box
  to anyone     rules       available  needed

  Regulated industries (banking, healthcare)
  often REQUIRE interpretable models.
```

---

## Exercises

### Exercise 1: Bias Detection

Create a synthetic loan approval dataset with bias against a
protected group. Train a model and measure disparate impact. Is
the model fair by the 80% rule?

### Exercise 2: SHAP Analysis

Train an XGBoost model on the Titanic dataset and generate:
1. A SHAP summary plot (global feature importance)
2. SHAP force plots for 3 individual passengers
3. Explain in plain English why each passenger was classified
   the way they were

### Exercise 3: Fairness Mitigation

Using your biased loan model from Exercise 1:
1. Measure fairness metrics before mitigation
2. Apply threshold adjustment per group
3. Apply rebalancing the training data
4. Compare fairness metrics after each mitigation
5. Did accuracy change? Is the trade-off worth it?

---

[Next: Lesson 16 - Time Series -->](16-time-series.md)
