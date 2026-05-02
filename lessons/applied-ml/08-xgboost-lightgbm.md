# Lesson 08: XGBoost & LightGBM

## The Industry Workhorses

If Random Forest is a reliable Toyota Camry, XGBoost and LightGBM
are Formula 1 cars. They win Kaggle competitions, power fraud
detection at banks, and drive recommendation engines at tech
companies. They are the go-to tools for tabular data.

```
  KAGGLE COMPETITION WINNERS (TABULAR DATA)
  ==========================================

  Algorithm          Win Rate
  ---------          --------
  XGBoost            |##########################|  ~60%
  LightGBM           |################|            ~25%
  Neural Nets         |####|                        ~8%
  Random Forest       |###|                         ~5%
  Other               |#|                           ~2%

  For tabular data, gradient boosted trees dominate.
```

---

## XGBoost: eXtreme Gradient Boosting

### What Makes It Special

```
  XGBOOST vs SKLEARN GRADIENT BOOSTING
  =====================================

  Feature              sklearn GB    XGBoost
  -------              ----------    -------
  Regularization       None          L1 + L2
  Missing values       Manual        Built-in
  Parallelism          No            Yes (within tree)
  Column subsampling   No            Yes
  Custom objectives    Limited       Full support
  Speed                Slow          Fast
  Early stopping       Manual        Built-in
```

### Basic XGBoost

```python
import xgboost as xgb
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)

df["Sex_encoded"] = (df["Sex"] == "male").astype(int)
df["Age"] = df["Age"].fillna(df["Age"].median())
df["Embarked_encoded"] = df["Embarked"].fillna("S").map(
    {"S": 0, "C": 1, "Q": 2}
)

features = ["Pclass", "Sex_encoded", "Age", "SibSp", "Parch",
            "Fare", "Embarked_encoded"]
X = df[features]
y = df["Survived"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = xgb.XGBClassifier(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    eval_metric="logloss"
)

model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=False
)

print(f"Accuracy: {model.score(X_test, y_test):.3f}")
print(classification_report(y_test, model.predict(X_test)))
```

### Early Stopping

Stop training when the model stops improving. Like knowing when
to stop studying -- more hours do not always help.

```python
model_es = xgb.XGBClassifier(
    n_estimators=1000,
    max_depth=4,
    learning_rate=0.05,
    random_state=42,
    eval_metric="logloss",
    early_stopping_rounds=20
)

model_es.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=False
)

print(f"Best iteration: {model_es.best_iteration}")
print(f"Best score: {model_es.best_score:.4f}")
```

```
  EARLY STOPPING VISUALIZED
  =========================

  Loss
  |
  |\
  | \
  |  \___
  |      \___          ______ <-- overfitting starts
  |          \________/
  |               ^
  |               |
  |          STOP HERE
  +---------------------------------> Iterations
  0    100   200   300   400   500
```

---

## LightGBM: Light Gradient Boosting Machine

### What Makes It Different

```
  XGBOOST vs LIGHTGBM TREE GROWTH
  ================================

  XGBoost: Level-wise (breadth-first)
  Grows all nodes at same depth, then goes deeper

  Level 0:        [Root]
  Level 1:    [Left]  [Right]
  Level 2:  [L][L]    [R][R]    <- all nodes at depth 2

  LightGBM: Leaf-wise (best-first)
  Grows the leaf with highest loss reduction

  Step 1:        [Root]
  Step 2:    [Left]  [Right]
  Step 3:    [L]  [L-deep]       <- grows where it helps most
  Step 4:         [L-deeper]

  Leaf-wise = fewer nodes for same accuracy = faster
```

### Basic LightGBM

```python
import lightgbm as lgb

lgb_model = lgb.LGBMClassifier(
    n_estimators=200,
    max_depth=-1,
    num_leaves=31,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    verbose=-1
)

lgb_model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    callbacks=[lgb.early_stopping(20, verbose=False)]
)

print(f"LightGBM accuracy: {lgb_model.score(X_test, y_test):.3f}")
```

---

## Hyperparameter Guide

```
  XGBOOST / LIGHTGBM KEY HYPERPARAMETERS
  =======================================

  Parameter         XGBoost Name       LightGBM Name    Range
  ---------         ------------       -------------    -----
  Learning rate     learning_rate      learning_rate    0.01-0.3
  Trees             n_estimators       n_estimators     100-10000
  Tree depth        max_depth          max_depth        3-10 / -1
  Leaf nodes        -                  num_leaves       15-255
  Min child wt      min_child_weight   min_child_wt     1-10
  Row sampling      subsample          subsample        0.5-1.0
  Col sampling      colsample_bytree   colsample_bytree 0.5-1.0
  L1 reg            reg_alpha          reg_alpha        0-10
  L2 reg            reg_lambda         reg_lambda       0-10

  TUNING PRIORITY (start with these)
  ===================================

  1. learning_rate + n_estimators (with early stopping)
  2. max_depth / num_leaves
  3. subsample + colsample_bytree
  4. reg_alpha + reg_lambda
```

---

## Systematic Hyperparameter Tuning

```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    "max_depth": [3, 5, 7],
    "learning_rate": [0.01, 0.05, 0.1],
    "n_estimators": [100, 200, 500],
    "subsample": [0.7, 0.8, 1.0],
    "colsample_bytree": [0.7, 0.8, 1.0]
}

xgb_model = xgb.XGBClassifier(
    random_state=42,
    eval_metric="logloss"
)

grid_search = GridSearchCV(
    xgb_model,
    param_grid,
    cv=5,
    scoring="accuracy",
    n_jobs=-1,
    verbose=0
)
grid_search.fit(X_train, y_train)

print(f"Best params: {grid_search.best_params_}")
print(f"Best CV score: {grid_search.best_score_:.3f}")
print(f"Test score: {grid_search.best_estimator_.score(X_test, y_test):.3f}")
```

### Faster: RandomizedSearchCV

```python
from sklearn.model_selection import RandomizedSearchCV
from scipy.stats import uniform, randint

param_distributions = {
    "max_depth": randint(3, 10),
    "learning_rate": uniform(0.01, 0.29),
    "n_estimators": randint(100, 1000),
    "subsample": uniform(0.6, 0.4),
    "colsample_bytree": uniform(0.6, 0.4),
    "reg_alpha": uniform(0, 5),
    "reg_lambda": uniform(0, 5)
}

random_search = RandomizedSearchCV(
    xgb.XGBClassifier(random_state=42, eval_metric="logloss"),
    param_distributions,
    n_iter=50,
    cv=5,
    scoring="accuracy",
    n_jobs=-1,
    random_state=42
)
random_search.fit(X_train, y_train)

print(f"Best params: {random_search.best_params_}")
print(f"Best score: {random_search.best_score_:.3f}")
```

---

## Handling Missing Values Natively

One superpower of XGBoost and LightGBM: they handle missing data
without imputation.

```python
df_with_missing = df[features].copy()
print(f"Missing values:\n{df_with_missing.isnull().sum()}")

model_native = xgb.XGBClassifier(
    n_estimators=100,
    random_state=42,
    eval_metric="logloss"
)
model_native.fit(X_train, y_train)
print(f"Works with NaN: {model_native.score(X_test, y_test):.3f}")
```

---

## XGBoost Feature Importance

```python
import matplotlib.pyplot as plt

xgb.plot_importance(model, importance_type="gain", max_num_features=10)
plt.title("XGBoost Feature Importance (Gain)")
plt.tight_layout()
plt.show()
```

```
  IMPORTANCE TYPES
  ================

  Type      Meaning
  ----      -------
  weight    Number of times feature is used in splits
  gain      Average gain when feature is used
  cover     Average coverage (samples affected)

  "gain" is usually most informative
```

---

## XGBoost for Regression

```python
from sklearn.datasets import fetch_california_housing
from sklearn.metrics import mean_squared_error

housing = fetch_california_housing(as_frame=True)
X_h, y_h = housing.data, housing.target

X_tr, X_te, y_tr, y_te = train_test_split(
    X_h, y_h, test_size=0.2, random_state=42
)

xgb_reg = xgb.XGBRegressor(
    n_estimators=500,
    max_depth=5,
    learning_rate=0.05,
    early_stopping_rounds=20,
    random_state=42
)
xgb_reg.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)

rmse = mean_squared_error(y_te, xgb_reg.predict(X_te), squared=False)
print(f"XGBoost RMSE: {rmse:.4f}")
```

---

## Speed Comparison

```python
import time

models = {
    "XGBoost": xgb.XGBClassifier(n_estimators=200, random_state=42,
                                   eval_metric="logloss"),
    "LightGBM": lgb.LGBMClassifier(n_estimators=200, random_state=42,
                                     verbose=-1),
}

for name, model in models.items():
    start = time.time()
    model.fit(X_train, y_train)
    elapsed = time.time() - start
    acc = model.score(X_test, y_test)
    print(f"{name:10s} | Time: {elapsed:.3f}s | Accuracy: {acc:.3f}")
```

---

## Exercises

### Exercise 1: XGBoost vs LightGBM

Train both XGBoost and LightGBM on the Titanic dataset with
identical hyperparameters. Compare accuracy, training time, and
feature importance rankings.

### Exercise 2: Hyperparameter Tuning

Use `RandomizedSearchCV` to tune an XGBoost model on California
Housing. Search over at least 5 hyperparameters with 100 iterations.
Report the best parameters and RMSE improvement over defaults.

### Exercise 3: Early Stopping Analysis

Train an XGBoost model with n_estimators=2000 and learning_rate=0.01
using early stopping. Plot the training and validation loss curves.
At what iteration does overfitting begin?

---

[Next: Lesson 09 - Support Vector Machines -->](09-svms.md)
