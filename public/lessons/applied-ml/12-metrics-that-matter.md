# Lesson 12: Metrics That Matter

## Why Accuracy Lies

Imagine a hospital that screens 10,000 people for a rare disease
(1% prevalence). A "model" that says "nobody has the disease" is
99% accurate -- and completely useless. It misses every sick person.

Accuracy is the most popular metric and the most misleading one.

```
  THE ACCURACY TRAP
  =================

  Dataset: 9,900 healthy, 100 sick

  Model: "Everyone is healthy"
  Accuracy: 9,900 / 10,000 = 99%

  But: 0 sick people detected
  Recall for sick class: 0%

  This model is DANGEROUS despite 99% accuracy.
```

---

## The Confusion Matrix

The foundation of all classification metrics.

```
  CONFUSION MATRIX
  ================

                    PREDICTED
                 Positive  Negative
  ACTUAL  Pos   [  TP  ]  [  FN  ]
          Neg   [  FP  ]  [  TN  ]

  TP (True Positive):   Correctly predicted positive
  TN (True Negative):   Correctly predicted negative
  FP (False Positive):  Predicted positive, actually negative
                        (Type I error, "false alarm")
  FN (False Negative):  Predicted negative, actually positive
                        (Type II error, "missed detection")

  REAL-WORLD ANALOGIES
  ====================

  Spam filter:
  TP = Spam caught          FN = Spam in inbox (annoying)
  FP = Good email in spam   TN = Good email delivered
       (dangerous!)

  Medical test:
  TP = Sick person found    FN = Sick person missed (deadly!)
  FP = Healthy false alarm  TN = Healthy confirmed
```

### Computing the Confusion Matrix

```python
import numpy as np
import pandas as pd
from sklearn.metrics import (
    confusion_matrix, classification_report, accuracy_score,
    precision_score, recall_score, f1_score, roc_auc_score,
    roc_curve, precision_recall_curve
)
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)

df["Sex_encoded"] = (df["Sex"] == "male").astype(int)
df["Age"] = df["Age"].fillna(df["Age"].median())

features = ["Pclass", "Sex_encoded", "Age", "SibSp", "Parch", "Fare"]
X = df[features]
y = df["Survived"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

cm = confusion_matrix(y_test, y_pred)
print("Confusion Matrix:")
print(cm)
```

```
  READING THE MATRIX
  ==================

                Pred: Died  Pred: Survived
  Actual Died   [  95  ]    [  10  ]
  Actual Surv   [  18  ]    [  56  ]

  95 correctly predicted deaths (TN)
  56 correctly predicted survivals (TP)
  10 predicted survived but actually died (FP)
  18 predicted died but actually survived (FN)
```

---

## Precision: "When I Say Positive, Am I Right?"

```
  PRECISION = TP / (TP + FP)

  Of all the times I predicted "positive,"
  how many were actually positive?

  Spam filter precision:
  "Of all emails I flagged as spam,
   what percentage were actually spam?"

  High precision = few false alarms
  Low precision  = lots of false alarms
```

## Recall: "Did I Find All the Positives?"

```
  RECALL = TP / (TP + FN)

  Of all actual positives,
  how many did I catch?

  Disease screening recall:
  "Of all sick patients,
   what percentage did I detect?"

  High recall = few missed positives
  Low recall  = many missed positives
```

## The Precision-Recall Trade-off

```
  THRESHOLD EFFECT
  ================

  Threshold   Precision    Recall
  (strict)    (high)       (low)
  0.9         0.95         0.30    "Only flag if very sure"
  0.7         0.85         0.55
  0.5         0.75         0.72    Default
  0.3         0.55         0.88
  0.1         0.30         0.97    "Flag everything suspicious"
  (lenient)   (low)        (high)

  You CANNOT maximize both simultaneously.
  The question is: what costs more?

  FP expensive (spam filter): Favor PRECISION
  -> Don't want good emails in spam folder

  FN expensive (cancer screening): Favor RECALL
  -> Don't want to miss a sick patient
```

---

## F1 Score: The Balanced Metric

```
  F1 = 2 * (precision * recall) / (precision + recall)

  Harmonic mean of precision and recall.
  Only high when BOTH are high.

  Precision=0.90, Recall=0.90 -> F1=0.90  (great)
  Precision=0.99, Recall=0.10 -> F1=0.18  (terrible)
  Precision=0.10, Recall=0.99 -> F1=0.18  (terrible)
```

### Computing All Metrics

```python
print(f"Accuracy:  {accuracy_score(y_test, y_pred):.3f}")
print(f"Precision: {precision_score(y_test, y_pred):.3f}")
print(f"Recall:    {recall_score(y_test, y_pred):.3f}")
print(f"F1:        {f1_score(y_test, y_pred):.3f}")

print("\nFull Classification Report:")
print(classification_report(y_test, y_pred, target_names=["Died", "Survived"]))
```

---

## ROC Curve and AUC

The ROC curve shows how the model performs across ALL possible
thresholds.

```python
import matplotlib.pyplot as plt

y_proba = model.predict_proba(X_test)[:, 1]
fpr, tpr, thresholds = roc_curve(y_test, y_proba)
auc = roc_auc_score(y_test, y_proba)

plt.figure(figsize=(8, 6))
plt.plot(fpr, tpr, label=f"Model (AUC = {auc:.3f})")
plt.plot([0, 1], [0, 1], "k--", label="Random (AUC = 0.500)")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate (Recall)")
plt.title("ROC Curve")
plt.legend()
plt.show()
```

```
  ROC CURVE
  =========

  TPR (Recall)
  1.0 |        ___________
      |      _/
      |    _/
      |   /
  0.5 |  /    Perfect model: hugs top-left corner
      | /     Random model:  diagonal line
      |/      Bad model:     below diagonal
  0.0 +----------------------
      0.0    0.5    1.0
          FPR (False Alarm Rate)

  AUC INTERPRETATION
  ==================
  1.0       Perfect classifier
  0.9-1.0   Excellent
  0.8-0.9   Good
  0.7-0.8   Fair
  0.5-0.7   Poor
  0.5       Random guessing
  <0.5      Worse than random (flip predictions!)
```

---

## Precision-Recall Curve

Better than ROC for imbalanced datasets.

```python
precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)

plt.figure(figsize=(8, 6))
plt.plot(recalls, precisions)
plt.xlabel("Recall")
plt.ylabel("Precision")
plt.title("Precision-Recall Curve")
plt.show()
```

---

## Regression Metrics

```
  REGRESSION METRICS
  ==================

  Metric    Formula                   Interpretation
  ------    -------                   --------------
  MAE       mean(|y - y_hat|)         Avg error in units
  MSE       mean((y - y_hat)^2)       Penalizes large errors
  RMSE      sqrt(MSE)                 Error in original units
  R^2       1 - SS_res/SS_tot         % variance explained

  EXAMPLE
  =======
  True prices:      [100, 200, 300, 400, 500]
  Predicted prices: [110, 190, 320, 380, 530]

  MAE  = mean(10, 10, 20, 20, 30) = 18
  RMSE = sqrt(mean(100, 100, 400, 400, 900)) = 19.5
  R^2  = 0.97 (97% variance explained)
```

```python
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

y_true = np.array([100, 200, 300, 400, 500])
y_pred_reg = np.array([110, 190, 320, 380, 530])

print(f"MAE:  {mean_absolute_error(y_true, y_pred_reg):.2f}")
print(f"RMSE: {mean_squared_error(y_true, y_pred_reg, squared=False):.2f}")
print(f"R^2:  {r2_score(y_true, y_pred_reg):.3f}")
```

---

## Choosing the Right Metric

```
  METRIC DECISION GUIDE
  =====================

  Classification:
  +--> Balanced classes?
  |     Yes --> Accuracy or F1
  |     No  --> F1, AUC-ROC, or Precision-Recall AUC
  |
  +--> FP more costly? (spam filter)
  |     --> Optimize Precision
  |
  +--> FN more costly? (disease detection)
  |     --> Optimize Recall
  |
  +--> Need to rank predictions?
        --> AUC-ROC

  Regression:
  +--> Want interpretable error?
  |     --> MAE (same units as target)
  |
  +--> Penalize large errors more?
  |     --> RMSE
  |
  +--> Want relative measure?
        --> R^2 (0 to 1 scale)
```

---

## Exercises

### Exercise 1: Metric Sensitivity

Create an imbalanced dataset (95/5 split) and compare a naive
"predict majority" classifier against a real model using accuracy,
precision, recall, F1, and AUC.

```python
from sklearn.datasets import make_classification

X, y = make_classification(
    n_samples=10000, weights=[0.95, 0.05], random_state=42
)
```

### Exercise 2: Threshold Tuning

Train a model on the Titanic dataset and plot precision and recall
as a function of the decision threshold. Find the threshold that
gives F1 > 0.75 with the highest possible recall.

### Exercise 3: Regression Metrics

Using California Housing, train three models (Linear Regression,
Random Forest, XGBoost) and compare them using MAE, RMSE, and R^2.
Which model is best? Does the "best" model depend on which metric
you use?

---

[Next: Lesson 13 - Cross-Validation -->](13-cross-validation.md)
