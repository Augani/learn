# Lesson 18: End-to-End ML Project

## From Question to Deployed Model

This lesson walks through a complete ML project. Not just
the modeling part -- the whole thing. Like building a house:
the foundation matters more than the paint color.

```
  THE ML PROJECT LIFECYCLE
  ========================

  1. Problem Definition    ──>  What are we solving? Why?
  2. Data Collection       ──>  Where does data come from?
  3. EDA                   ──>  What does the data look like?
  4. Feature Engineering   ──>  Create useful signals
  5. Model Selection       ──>  Which algorithm fits?
  6. Training & Tuning     ──>  Optimize performance
  7. Evaluation            ──>  Does it actually work?
  8. Deployment            ──>  Put it in production
  9. Monitoring            ──>  Keep it working

  ┌─────────────────────────────────────────────┐
  │  80% of the work is steps 1-4.              │
  │  The model is the easy part.                │
  │  Data quality determines the ceiling.       │
  └─────────────────────────────────────────────┘
```

---

## Step 1: Problem Definition

```
  ASK THESE QUESTIONS FIRST
  =========================

  1. What business problem are we solving?
     "Reduce customer churn by 10%"

  2. What does success look like?
     "Identify 80% of churners before they leave"

  3. What decision will this model inform?
     "Send retention offers to predicted churners"

  4. What data do we have?
     "Customer transactions, support tickets, demographics"

  5. What are the constraints?
     "Must predict weekly, <100ms latency, explainable"

  ┌─────────────────────────────────────────────┐
  │  A perfectly accurate model that doesn't    │
  │  change any business decision is worthless. │
  └─────────────────────────────────────────────┘
```

---

## Step 2-3: Data Collection and EDA

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

np.random.seed(42)
n = 5000

tenure = np.random.exponential(24, n).clip(1, 72).astype(int)
monthly_charges = np.random.normal(65, 20, n).clip(20, 120)
total_charges = monthly_charges * tenure + np.random.randn(n) * 50
support_tickets = np.random.poisson(2, n)
contract_type = np.random.choice(["month-to-month", "one-year", "two-year"], n, p=[0.5, 0.3, 0.2])

churn_prob = 1 / (1 + np.exp(-(
    -2.0
    + 0.05 * support_tickets
    - 0.03 * tenure
    + 0.01 * monthly_charges
    + 1.5 * (contract_type == "month-to-month").astype(float)
    - 0.8 * (contract_type == "two-year").astype(float)
)))
churned = np.random.binomial(1, churn_prob)

df = pd.DataFrame({
    "tenure": tenure,
    "monthly_charges": monthly_charges,
    "total_charges": total_charges,
    "support_tickets": support_tickets,
    "contract_type": contract_type,
    "churned": churned,
})

print("Dataset shape:", df.shape)
print("\nClass distribution:")
print(df["churned"].value_counts(normalize=True))
print("\nBasic statistics:")
print(df.describe())
print("\nMissing values:")
print(df.isnull().sum())
print("\nChurn rate by contract type:")
print(df.groupby("contract_type")["churned"].mean())
```

---

## Step 4: Feature Engineering

```python
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()

    result["avg_monthly_charge"] = result["total_charges"] / result["tenure"]

    result["tickets_per_month"] = result["support_tickets"] / result["tenure"]

    result["is_new_customer"] = (result["tenure"] <= 6).astype(int)
    result["is_loyal"] = (result["tenure"] >= 36).astype(int)

    result["high_charges"] = (result["monthly_charges"] > result["monthly_charges"].median()).astype(int)

    le = LabelEncoder()
    result["contract_encoded"] = le.fit_transform(result["contract_type"])

    result = pd.get_dummies(result, columns=["contract_type"], drop_first=True)

    return result


df_featured = engineer_features(df)
print("Features created:")
print(df_featured.columns.tolist())
```

---

## Step 5-6: Model Selection and Training

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import classification_report, roc_auc_score

feature_cols = [c for c in df_featured.columns if c not in ["churned"]]
X = df_featured[feature_cols]
y = df_featured["churned"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

models = {
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
    "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, random_state=42),
}

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

print("Cross-Validation Results:")
print("-" * 50)
for name, model in models.items():
    data = X_train_scaled if "Logistic" in name else X_train
    scores = cross_val_score(model, data, y_train, cv=cv, scoring="roc_auc")
    print(f"{name:25s}: AUC = {scores.mean():.3f} (+/- {scores.std():.3f})")
```

---

## Step 7: Evaluation

```python
from sklearn.metrics import (
    classification_report,
    roc_auc_score,
    confusion_matrix,
    precision_recall_curve,
)

best_model = GradientBoostingClassifier(n_estimators=200, max_depth=5, random_state=42)
best_model.fit(X_train, y_train)

y_pred = best_model.predict(X_test)
y_proba = best_model.predict_proba(X_test)[:, 1]

print("Classification Report:")
print(classification_report(y_test, y_pred))

print(f"ROC AUC: {roc_auc_score(y_test, y_proba):.3f}")

cm = confusion_matrix(y_test, y_pred)
print(f"\nConfusion Matrix:")
print(f"  TN={cm[0,0]:4d}  FP={cm[0,1]:4d}")
print(f"  FN={cm[1,0]:4d}  TP={cm[1,1]:4d}")

precision, recall, thresholds = precision_recall_curve(y_test, y_proba)

target_recall = 0.80
idx = np.argmin(np.abs(recall - target_recall))
print(f"\nAt {target_recall:.0%} recall:")
print(f"  Precision: {precision[idx]:.3f}")
print(f"  Threshold: {thresholds[idx]:.3f}")
```

---

## Step 8: Deployment

```python
import pickle
from pathlib import Path


def save_model(model, scaler, feature_cols, path="model_artifacts"):
    artifact_dir = Path(path)
    artifact_dir.mkdir(exist_ok=True)

    with open(artifact_dir / "model.pkl", "wb") as f:
        pickle.dump(model, f)

    with open(artifact_dir / "scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)

    with open(artifact_dir / "features.txt", "w") as f:
        f.write("\n".join(feature_cols))

    print(f"Model saved to {artifact_dir}")


def load_and_predict(input_data: dict, path="model_artifacts") -> dict:
    artifact_dir = Path(path)

    with open(artifact_dir / "model.pkl", "rb") as f:
        model = pickle.load(f)

    with open(artifact_dir / "features.txt") as f:
        feature_cols = f.read().strip().split("\n")

    input_df = pd.DataFrame([input_data])
    input_featured = engineer_features(input_df)

    for col in feature_cols:
        if col not in input_featured.columns:
            input_featured[col] = 0

    X_input = input_featured[feature_cols]

    proba = model.predict_proba(X_input)[0, 1]
    prediction = int(proba >= 0.5)

    return {
        "churn_probability": float(proba),
        "will_churn": bool(prediction),
        "risk_level": "high" if proba > 0.7 else "medium" if proba > 0.3 else "low",
    }
```

### FastAPI Endpoint

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class CustomerInput(BaseModel):
    tenure: int
    monthly_charges: float
    total_charges: float
    support_tickets: int
    contract_type: str


@app.post("/predict")
def predict_churn(customer: CustomerInput):
    result = load_and_predict(customer.model_dump())
    return result
```

---

## Step 9: Monitoring

```
  WHAT TO MONITOR
  ===============
  ┌───┬─────────────────────────────────────────────┐
  │ 1 │ Input data drift (feature distributions)     │
  │ 2 │ Prediction distribution (is it shifting?)    │
  │ 3 │ Model performance (when labels arrive)       │
  │ 4 │ Latency and error rates                      │
  │ 5 │ Feature importance stability                 │
  └───┴─────────────────────────────────────────────┘

  DATA DRIFT DETECTION
  ====================
  Compare training data distribution to production data.
  If distributions diverge, model may degrade.

  Alert when:
  - Feature means shift > 2 standard deviations
  - New categories appear in categorical features
  - Null rate increases significantly
  - Prediction distribution changes shape
```

```python
import numpy as np
from scipy import stats


def detect_drift(reference: np.ndarray, current: np.ndarray, threshold: float = 0.05) -> dict:
    ks_stat, p_value = stats.ks_2samp(reference, current)

    ref_mean, cur_mean = reference.mean(), current.mean()
    ref_std = reference.std()
    z_score = abs(cur_mean - ref_mean) / (ref_std + 1e-10)

    return {
        "ks_statistic": float(ks_stat),
        "p_value": float(p_value),
        "drift_detected": p_value < threshold,
        "mean_shift_z": float(z_score),
    }
```

---

## Project Checklist

```
  ┌───┬────────────────────────────────────────────────┐
  │   │ BEFORE MODELING                                 │
  │ 1 │ Problem defined with clear success metric       │
  │ 2 │ Data collected and understood                   │
  │ 3 │ EDA completed, no surprises in production data  │
  │ 4 │ Features engineered and validated               │
  │ 5 │ Train/validation/test split created properly    │
  ├───┼────────────────────────────────────────────────┤
  │   │ MODELING                                        │
  │ 6 │ Multiple models compared with cross-validation  │
  │ 7 │ Hyperparameters tuned systematically            │
  │ 8 │ Best model evaluated on held-out test set       │
  │ 9 │ Results are statistically significant           │
  ├───┼────────────────────────────────────────────────┤
  │   │ DEPLOYMENT                                      │
  │10 │ Model serialized with all artifacts             │
  │11 │ Prediction API with input validation            │
  │12 │ Monitoring for data drift and performance       │
  │13 │ Retraining pipeline documented                  │
  │14 │ Stakeholder report with business impact         │
  └───┴────────────────────────────────────────────────┘
```

---

## Exercises

**Exercise 1:** Complete the churn prediction project end-to-end
using the code in this lesson. Save the model, build the FastAPI
endpoint, and test it with 5 sample customers.

**Exercise 2:** Choose a different dataset (fraud detection, loan
approval, or house price prediction). Execute all 9 steps of the
ML lifecycle. Document your decisions at each step.

**Exercise 3:** Implement a retraining pipeline: detect data drift
on simulated new data, retrain the model if drift is detected,
compare new model performance with the deployed model, and only
deploy if the new model is better.

**Exercise 4:** Create a stakeholder report for your model. Include:
business context, methodology, results, limitations, and
recommended actions. Aim for a non-technical audience.

---

[Next: Reference - Algorithm Comparison -->](reference-algorithms.md)
