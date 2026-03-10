# Lesson 13: Cross-Validation

## Practice Exams from Different Teachers

If you only take practice exams from one teacher, you might get
lucky (or unlucky) depending on which questions they pick. But if
you take practice exams from five different teachers, your average
score is a much better estimate of how you will do on the real exam.

Cross-validation works the same way: instead of one train/test
split, you evaluate on multiple different splits.

```
  ONE SPLIT (unreliable)          CROSS-VALIDATION (robust)
  ======================          ========================

  [Train Train Train | Test]      Fold 1: [Test|Train Train Train]
                                  Fold 2: [Train|Test|Train Train]
  Accuracy: 85%                   Fold 3: [Train Train|Test|Train]
  (lucky split? unlucky split?)   Fold 4: [Train Train Train|Test]

                                  Average: 83.5% +/- 2.1%
                                  (confident estimate)
```

---

## K-Fold Cross-Validation

```
  5-FOLD CROSS-VALIDATION
  =======================

  Data: [===========================================]

  Fold 1: [TEST] [train] [train] [train] [train]  -> 82%
  Fold 2: [train] [TEST] [train] [train] [train]  -> 85%
  Fold 3: [train] [train] [TEST] [train] [train]  -> 81%
  Fold 4: [train] [train] [train] [TEST] [train]  -> 84%
  Fold 5: [train] [train] [train] [train] [TEST]  -> 83%

  Average: 83.0%  Std: 1.6%

  Every data point gets to be in the test set exactly ONCE.
```

### Basic Cross-Validation

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import cross_val_score, KFold
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

model = RandomForestClassifier(n_estimators=100, random_state=42)

scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
print(f"Fold scores: {scores}")
print(f"Mean: {scores.mean():.3f} +/- {scores.std():.3f}")
```

---

## Why Not Just One Train/Test Split?

```python
from sklearn.model_selection import train_test_split

single_scores = []
for seed in range(20):
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=seed
    )
    model.fit(X_tr, y_tr)
    single_scores.append(model.score(X_te, y_te))

print(f"Single split scores: {[f'{s:.3f}' for s in single_scores[:5]]}")
print(f"Range: {min(single_scores):.3f} to {max(single_scores):.3f}")
print(f"Spread: {max(single_scores) - min(single_scores):.3f}")
```

```
  VARIANCE IN SINGLE SPLITS
  =========================

  Accuracy
  0.85 |          *
  0.84 |    *           *
  0.83 |       *     *     *
  0.82 | *                    *
  0.81 |                         *
  0.80 |    *
  0.79 |                *
       +--+--+--+--+--+--+--+--+--> Random seed
         0  2  4  6  8 10 12 14

  Same model, same data, different splits = different answers!
  CV gives you the mean AND the uncertainty.
```

---

## Types of Cross-Validation

### Stratified K-Fold (Default for Classification)

Preserves class proportions in each fold. Essential for imbalanced
datasets.

```python
from sklearn.model_selection import StratifiedKFold

skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

for fold, (train_idx, test_idx) in enumerate(skf.split(X, y)):
    y_test_fold = y.iloc[test_idx]
    class_dist = y_test_fold.value_counts(normalize=True)
    print(f"Fold {fold}: {class_dist.to_dict()}")

scores = cross_val_score(model, X, y, cv=skf, scoring="accuracy")
print(f"\nStratified CV: {scores.mean():.3f} +/- {scores.std():.3f}")
```

```
  STRATIFIED vs REGULAR K-FOLD
  ============================

  Dataset: 70% class 0, 30% class 1

  Regular K-Fold:
  Fold 1: 75% / 25%   <- imbalanced fold!
  Fold 2: 68% / 32%
  Fold 3: 72% / 28%

  Stratified K-Fold:
  Fold 1: 70% / 30%   <- preserved!
  Fold 2: 70% / 30%
  Fold 3: 70% / 30%
```

### Leave-One-Out (LOO)

Every single sample gets its own fold. Maximum use of data but very
slow.

```python
from sklearn.model_selection import LeaveOneOut

loo = LeaveOneOut()
print(f"LOO folds: {loo.get_n_splits(X)}")
```

### Repeated K-Fold

Run K-Fold multiple times with different shuffles for even more
robust estimates.

```python
from sklearn.model_selection import RepeatedStratifiedKFold

rskf = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=42)
scores = cross_val_score(model, X, y, cv=rskf, scoring="accuracy")
print(f"Repeated CV ({len(scores)} folds): {scores.mean():.3f} +/- {scores.std():.3f}")
```

### Group K-Fold

When data has groups that should not be split. For example, multiple
records per patient -- all records from one patient must be in the
same fold.

```python
from sklearn.model_selection import GroupKFold

groups = df["PassengerId"] % 5

gkf = GroupKFold(n_splits=5)
scores = cross_val_score(model, X, y, cv=gkf, groups=groups)
print(f"Group CV: {scores.mean():.3f} +/- {scores.std():.3f}")
```

```
  CROSS-VALIDATION TYPES
  ======================

  Type              Folds    Best For
  ----              -----    --------
  KFold             K        General purpose
  StratifiedKFold   K        Imbalanced classes
  RepeatedKFold     K*R      More reliable estimates
  LeaveOneOut       N        Very small datasets
  GroupKFold        K        Grouped data
  TimeSeriesSplit   K        Time-ordered data
```

---

## Time Series Cross-Validation

Never use random splits for time series. Future data must not leak
into training.

```python
from sklearn.model_selection import TimeSeriesSplit

tss = TimeSeriesSplit(n_splits=5)

for fold, (train_idx, test_idx) in enumerate(tss.split(X)):
    print(f"Fold {fold}: Train[{train_idx[0]}:{train_idx[-1]}] "
          f"Test[{test_idx[0]}:{test_idx[-1]}]")
```

```
  TIME SERIES SPLIT
  =================

  Fold 1: [Train] [Test] [    ] [    ] [    ] [    ]
  Fold 2: [Train] [Train] [Test] [    ] [    ] [    ]
  Fold 3: [Train] [Train] [Train] [Test] [    ] [    ]
  Fold 4: [Train] [Train] [Train] [Train] [Test] [    ]
  Fold 5: [Train] [Train] [Train] [Train] [Train] [Test]

  Training window ALWAYS before test window.
  No future data leaks into the past!
```

---

## Getting More Than Just Accuracy

```python
from sklearn.model_selection import cross_validate

scoring = {
    "accuracy": "accuracy",
    "precision": "precision",
    "recall": "recall",
    "f1": "f1",
    "roc_auc": "roc_auc"
}

cv_results = cross_validate(
    model, X, y, cv=5, scoring=scoring, return_train_score=True
)

for metric in scoring:
    train = cv_results[f"train_{metric}"].mean()
    test = cv_results[f"test_{metric}"].mean()
    std = cv_results[f"test_{metric}"].std()
    print(f"{metric:12s} | Train: {train:.3f} | Test: {test:.3f} +/- {std:.3f}")
```

---

## Comparing Models with CV

```python
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression

models = {
    "Decision Tree": DecisionTreeClassifier(max_depth=5, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
    "Gradient Boost": GradientBoostingClassifier(n_estimators=100, random_state=42),
    "Logistic Reg": LogisticRegression(max_iter=1000, random_state=42),
}

print(f"{'Model':<20} {'Accuracy':>10} {'Std':>8}")
print("-" * 40)

for name, model in models.items():
    scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
    print(f"{name:<20} {scores.mean():>10.3f} {scores.std():>8.3f}")
```

---

## Nested Cross-Validation

When you tune hyperparameters AND evaluate, you need two levels
of CV. Otherwise you are peeking at the test set during tuning.

```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    "n_estimators": [50, 100, 200],
    "max_depth": [3, 5, 7, None]
}

inner_cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
outer_cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

grid_search = GridSearchCV(
    RandomForestClassifier(random_state=42),
    param_grid,
    cv=inner_cv,
    scoring="accuracy",
    n_jobs=-1
)

nested_scores = cross_val_score(grid_search, X, y, cv=outer_cv, scoring="accuracy")
print(f"Nested CV: {nested_scores.mean():.3f} +/- {nested_scores.std():.3f}")
```

```
  NESTED CROSS-VALIDATION
  =======================

  Outer loop (evaluation):
  +--[Test]--[  Train  ]--[  Train  ]--[  Train  ]--+
                |              |              |
                Inner loop (tuning):
                [Val][T][T]   [T][Val][T]   [T][T][Val]

  Inner loop finds best hyperparameters.
  Outer loop gives unbiased performance estimate.
```

---

## Exercises

### Exercise 1: CV Stability

Compare the stability of 3-fold, 5-fold, 10-fold, and LOO
cross-validation on the Iris dataset. Which gives the lowest
standard deviation?

### Exercise 2: Model Comparison

Use 5-fold stratified CV to compare at least 5 different classifiers
on the Titanic dataset. Report accuracy, F1, and AUC for each.
Which model wins on each metric?

### Exercise 3: Nested CV

Implement nested cross-validation for an XGBoost model with a
hyperparameter grid. Compare the nested CV score to a simple
train/test split score. How different are they?

---

[Next: Lesson 14 - Hyperparameter Tuning -->](14-hyperparameter-tuning.md)
