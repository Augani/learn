# Reference: All Metrics Explained

> Every evaluation metric you need, with formulas,
> intuition, and when to use each one.

---

## Confusion Matrix Foundation

```
  ┌──────────────────────────────────────────────┐
  │              PREDICTED                        │
  │              Positive    Negative              │
  │  ACTUAL                                       │
  │  Positive    TP          FN                    │
  │  Negative    FP          TN                    │
  └──────────────────────────────────────────────┘

  TP = True Positive:   correctly predicted positive
  TN = True Negative:   correctly predicted negative
  FP = False Positive:  predicted positive, actually negative (Type I)
  TN = False Negative:  predicted negative, actually positive (Type II)

  ANALOGY:
  TP = fire alarm goes off AND there's a fire (correct alert)
  FP = fire alarm goes off but NO fire (false alarm)
  FN = fire doesn't alarm but there IS a fire (missed!)
  TN = no alarm, no fire (correctly quiet)
```

---

## Classification Metrics

```
  ACCURACY
  ========
  = (TP + TN) / (TP + TN + FP + FN)

  "What fraction of predictions were correct?"

  Good when: classes are balanced
  Bad when: classes are imbalanced
  (99% accuracy on 1% fraud = just predicting "no fraud")


  PRECISION
  =========
  = TP / (TP + FP)

  "Of everything we flagged, how many were correct?"

  High precision = few false alarms
  Use when: false positives are costly
  (e.g., spam filter -- don't lose real emails)


  RECALL (Sensitivity, TPR)
  =========================
  = TP / (TP + FN)

  "Of everything that was positive, how many did we find?"

  High recall = few misses
  Use when: false negatives are costly
  (e.g., cancer screening -- don't miss cancer)


  F1 SCORE
  ========
  = 2 * (Precision * Recall) / (Precision + Recall)

  Harmonic mean of precision and recall.
  Use when: you need to balance both.


  F-BETA SCORE
  ============
  = (1 + beta^2) * (P * R) / (beta^2 * P + R)

  beta < 1: weight precision more
  beta = 1: standard F1
  beta > 1: weight recall more
  beta = 2: recall is twice as important as precision
```

---

## Formulas in Python

```python
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    classification_report,
)

y_true = np.array([1, 1, 0, 1, 0, 1, 0, 0, 1, 0])
y_pred = np.array([1, 0, 0, 1, 0, 1, 1, 0, 1, 0])
y_prob = np.array([0.9, 0.4, 0.2, 0.8, 0.1, 0.7, 0.6, 0.3, 0.85, 0.15])

print(f"Accuracy:  {accuracy_score(y_true, y_pred):.3f}")
print(f"Precision: {precision_score(y_true, y_pred):.3f}")
print(f"Recall:    {recall_score(y_true, y_pred):.3f}")
print(f"F1:        {f1_score(y_true, y_pred):.3f}")
print(f"ROC AUC:   {roc_auc_score(y_true, y_prob):.3f}")
print(f"PR AUC:    {average_precision_score(y_true, y_prob):.3f}")

print("\nClassification Report:")
print(classification_report(y_true, y_pred))

print("Confusion Matrix:")
print(confusion_matrix(y_true, y_pred))
```

---

## Threshold-Independent Metrics

```
  ROC AUC
  =======
  Area Under the ROC Curve (True Positive Rate vs False Positive Rate)

  AUC = 0.5:  random classifier (no better than coin flip)
  AUC = 1.0:  perfect classifier
  AUC < 0.5:  worse than random (check if labels are flipped!)

  ┌──────────────────────────────────────────┐
  │  TPR                                      │
  │  1.0 ┌──────────────────*                │
  │      │              *                     │
  │      │          *       Perfect (AUC=1.0) │
  │  0.5 │      *                             │
  │      │  *         Random (AUC=0.5)        │
  │      │*. . . . . . . . . .                │
  │  0.0 └──────────────────── FPR            │
  │      0.0              1.0                  │
  └──────────────────────────────────────────┘

  Good when: balanced classes, care about ranking
  Bad when: heavily imbalanced (use PR AUC instead)


  PR AUC (Average Precision)
  ==========================
  Area Under the Precision-Recall Curve

  Better than ROC AUC for imbalanced datasets.
  Focuses on positive class performance.

  Baseline = prevalence (proportion of positives)
```

---

## Regression Metrics

```
  MSE (Mean Squared Error)
  ========================
  = (1/n) * sum((y - y_hat)^2)

  Penalizes large errors heavily (squared).
  Units: squared units of target.


  RMSE (Root Mean Squared Error)
  ==============================
  = sqrt(MSE)

  Same as MSE but in original units.
  Most commonly reported regression metric.


  MAE (Mean Absolute Error)
  =========================
  = (1/n) * sum(|y - y_hat|)

  Robust to outliers (no squaring).
  Units: same as target.


  MAPE (Mean Absolute Percentage Error)
  =====================================
  = (1/n) * sum(|y - y_hat| / |y|) * 100

  Scale-independent (percentage).
  Undefined when y = 0.


  R-SQUARED (Coefficient of Determination)
  =========================================
  = 1 - (SS_res / SS_total)
  = 1 - sum((y - y_hat)^2) / sum((y - y_mean)^2)

  R^2 = 1.0: perfect prediction
  R^2 = 0.0: predicting the mean
  R^2 < 0.0: worse than predicting the mean
```

```python
from sklearn.metrics import (
    mean_squared_error,
    mean_absolute_error,
    r2_score,
    mean_absolute_percentage_error,
)
import numpy as np

y_true = np.array([3.0, 5.0, 2.5, 7.0, 4.5])
y_pred = np.array([2.8, 5.2, 2.1, 6.5, 4.8])

print(f"MSE:   {mean_squared_error(y_true, y_pred):.4f}")
print(f"RMSE:  {np.sqrt(mean_squared_error(y_true, y_pred)):.4f}")
print(f"MAE:   {mean_absolute_error(y_true, y_pred):.4f}")
print(f"MAPE:  {mean_absolute_percentage_error(y_true, y_pred):.4f}")
print(f"R^2:   {r2_score(y_true, y_pred):.4f}")
```

---

## Ranking Metrics

```
  NDCG (Normalized Discounted Cumulative Gain)
  =============================================

  Measures quality of ranking, accounting for position.
  Top positions matter more than bottom ones.

  DCG@k  = sum(relevance_i / log2(i + 1))  for i = 1..k
  NDCG@k = DCG@k / IDCG@k   (normalized by ideal ranking)


  MAP (Mean Average Precision)
  ============================

  Average precision across all relevant items.
  AP = sum(P@k * rel(k)) / num_relevant_items
  MAP = mean(AP) across all queries


  Precision@K / Recall@K
  ======================

  P@K: of top K recommendations, how many relevant?
  R@K: of all relevant items, how many in top K?

  Hit Rate@K: did any relevant item appear in top K?
```

---

## Metric Selection Guide

```
  ┌────────────────────┬────────────────────────────────────┐
  │ Situation          │ Recommended Metric                 │
  ├────────────────────┼────────────────────────────────────┤
  │ Balanced classes   │ Accuracy, F1, ROC AUC              │
  │ Imbalanced classes │ PR AUC, F1, Precision, Recall      │
  │ Cost-sensitive     │ Custom cost matrix                  │
  │ Ranking            │ NDCG, MAP, MRR                     │
  │ Regression         │ RMSE (general), MAE (robust)       │
  │ Business metric    │ Revenue, conversion rate, churn     │
  │ Recommendations    │ Precision@K, NDCG@K, Hit Rate      │
  │ NLP generation     │ BLEU, ROUGE, BERTScore             │
  │ Clustering         │ Silhouette, ARI, NMI               │
  └────────────────────┴────────────────────────────────────┘

  RULE OF THUMB:
  1. Start with the business metric
  2. Find the ML metric that correlates most with it
  3. Optimize that ML metric
  4. Verify improvement in business metric
```

---

## Multi-Class Metrics

```
  AVERAGING STRATEGIES
  ====================

  macro:    compute metric per class, then average
            (treats all classes equally)

  micro:    compute globally (sum TP, FP, FN across classes)
            (dominated by frequent classes)

  weighted: like macro, but weighted by class frequency
            (accounts for imbalance)

  When in doubt, use macro for balanced, weighted for imbalanced.
```

```python
from sklearn.metrics import f1_score
import numpy as np

y_true = np.array([0, 0, 0, 1, 1, 2, 2, 2, 2, 2])
y_pred = np.array([0, 0, 1, 1, 0, 2, 2, 2, 1, 2])

print(f"F1 macro:    {f1_score(y_true, y_pred, average='macro'):.3f}")
print(f"F1 micro:    {f1_score(y_true, y_pred, average='micro'):.3f}")
print(f"F1 weighted: {f1_score(y_true, y_pred, average='weighted'):.3f}")
```

---

## Clustering Metrics

```
  ┌──────────────────┬─────────────────────────────────────┐
  │ Metric           │ What It Measures                    │
  ├──────────────────┼─────────────────────────────────────┤
  │ Silhouette Score │ Cohesion vs separation (-1 to +1)   │
  │                  │ Higher = better defined clusters    │
  ├──────────────────┼─────────────────────────────────────┤
  │ Calinski-Harabasz│ Ratio of between/within variance    │
  │                  │ Higher = better (no upper bound)    │
  ├──────────────────┼─────────────────────────────────────┤
  │ ARI              │ Agreement with ground truth          │
  │                  │ Adjusted for chance (-1 to +1)      │
  ├──────────────────┼─────────────────────────────────────┤
  │ NMI              │ Mutual information with ground truth│
  │                  │ Normalized (0 to 1)                 │
  ├──────────────────┼─────────────────────────────────────┤
  │ Inertia          │ Sum of distances to cluster centers │
  │                  │ Lower = tighter clusters            │
  └──────────────────┴─────────────────────────────────────┘

  No ground truth? -> Silhouette, Calinski-Harabasz
  Have ground truth? -> ARI, NMI
```
