# Lesson 07: Random Forests & Boosting

## Wisdom of Crowds vs Expert Panels

Ask one person to guess how many jellybeans are in a jar and they
will probably be way off. Ask 100 people and average their guesses --
the average is remarkably close to the truth. This is the **wisdom
of crowds**, and it is exactly how Random Forests work.

Now imagine instead of random people, you hire experts who each
specialize in correcting the mistakes of the expert before them.
That is **boosting**.

```
  WISDOM OF CROWDS (Random Forest)
  ================================

  Tree 1: "I think 450"
  Tree 2: "I think 520"          Average = 487
  Tree 3: "I think 490"          (True = 500)
  Tree 4: "I think 510"
  Tree 5: "I think 460"

  EXPERT PANEL (Boosting)
  =======================

  Expert 1: "I think 400"        (error: +100)
  Expert 2: "Let me fix that     (error: +30)
             -> 470"
  Expert 3: "A bit more          (error: +8)
             -> 492"
  Expert 4: "Almost there        Final = 498
             -> 498"             (True = 500)
```

---

## Random Forests: Many Trees, One Answer

### How It Works

```
  RANDOM FOREST RECIPE
  ====================

  1. Take your training data
  2. Create N random samples (with replacement)
  3. For each sample, grow a decision tree
     - At each split, only consider sqrt(features)
  4. Combine predictions:
     - Classification: majority vote
     - Regression: average

  +----------+  +----------+  +----------+
  | Sample 1 |  | Sample 2 |  | Sample 3 |  ...N times
  +----+-----+  +----+-----+  +----+-----+
       |              |              |
  +----v-----+  +----v-----+  +----v-----+
  |  Tree 1  |  |  Tree 2  |  |  Tree 3  |
  | Predict: |  | Predict: |  | Predict: |
  |    A     |  |    B     |  |    A     |
  +----+-----+  +----+-----+  +----+-----+
       |              |              |
       +---------+----+----+---------+
                 |  VOTE   |
                 | A wins! |
                 +---------+
```

### Bagging: The Key Ingredient

Each tree sees a different random subset of the data. Like asking
different people who each read a different chapter of a book --
together they know the whole story.

```
  BOOTSTRAP SAMPLING
  ==================

  Original data: [A, B, C, D, E, F, G, H]

  Sample 1:      [A, A, C, D, F, F, G, H]  (B, E missing)
  Sample 2:      [B, C, C, D, E, G, G, H]  (A, F missing)
  Sample 3:      [A, B, D, D, E, F, H, H]  (C, G missing)

  ~63% of original data appears in each sample
  ~37% is left out (the "out-of-bag" samples)
```

---

## Building a Random Forest

```python
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score

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

rf = RandomForestClassifier(
    n_estimators=100,
    max_depth=8,
    min_samples_leaf=5,
    random_state=42
)
rf.fit(X_train, y_train)

print(f"Train accuracy: {rf.score(X_train, y_train):.3f}")
print(f"Test accuracy:  {rf.score(X_test, y_test):.3f}")

cv_scores = cross_val_score(rf, X, y, cv=5)
print(f"CV accuracy: {cv_scores.mean():.3f} +/- {cv_scores.std():.3f}")
```

---

## How Many Trees?

```python
import matplotlib.pyplot as plt

estimator_range = [10, 25, 50, 100, 200, 500]
scores = []

for n in estimator_range:
    rf_n = RandomForestClassifier(n_estimators=n, random_state=42)
    cv = cross_val_score(rf_n, X_train, y_train, cv=5)
    scores.append(cv.mean())

plt.plot(estimator_range, scores, "o-")
plt.xlabel("Number of Trees")
plt.ylabel("CV Accuracy")
plt.title("More Trees = Better (up to a point)")
plt.show()
```

```
  TREES vs ACCURACY
  =================

  Accuracy
  |              _______________
  |          ___/
  |      ___/
  |   __/
  |  /
  | /
  +----+----+----+----+----+---> n_estimators
      10   50  100  200  500

  Diminishing returns after ~100-200 trees
  More trees = more compute, not always more accuracy
```

---

## Feature Importance in Random Forests

```python
importances = pd.Series(
    rf.feature_importances_,
    index=features
).sort_values(ascending=True)

importances.plot(kind="barh", figsize=(10, 6))
plt.title("Random Forest Feature Importance")
plt.xlabel("Importance")
plt.show()
```

---

## Boosting: Learning from Mistakes

### The Idea

Instead of independent trees voting, boosting trains trees
sequentially. Each new tree focuses on the mistakes of the
previous ones.

```
  BOOSTING PROCESS
  ================

  Round 1:  Train Tree 1 on original data
            Misclassified: [X] [X] [ ] [ ] [X]

  Round 2:  Train Tree 2, giving MORE WEIGHT to misclassified
            Misclassified: [ ] [X] [ ] [X] [ ]

  Round 3:  Train Tree 3, focus on remaining errors
            Misclassified: [ ] [ ] [X] [ ] [ ]

  Final:    Weighted combination of all trees
            Most errors corrected!

  Each tree is WEAK (shallow), but together they are STRONG
```

### AdaBoost

```python
from sklearn.ensemble import AdaBoostClassifier
from sklearn.tree import DecisionTreeClassifier

ada = AdaBoostClassifier(
    estimator=DecisionTreeClassifier(max_depth=1),
    n_estimators=200,
    learning_rate=0.1,
    random_state=42
)
ada.fit(X_train, y_train)

print(f"AdaBoost test accuracy: {ada.score(X_test, y_test):.3f}")
```

### Gradient Boosting

```python
from sklearn.ensemble import GradientBoostingClassifier

gb = GradientBoostingClassifier(
    n_estimators=200,
    max_depth=3,
    learning_rate=0.1,
    random_state=42
)
gb.fit(X_train, y_train)

print(f"Gradient Boosting test accuracy: {gb.score(X_test, y_test):.3f}")
```

---

## Random Forest vs Boosting

```
  COMPARISON
  ==========

                    Random Forest         Gradient Boosting
                    =============         =================
  Strategy          Parallel trees        Sequential trees
  Tree depth        Deep (full)           Shallow (stumps)
  Overfitting       Resistant             Can overfit easily
  Speed             Fast (parallelizable) Slower (sequential)
  Tuning            Easier                More hyperparams
  Missing data      Tolerant              Less tolerant
  Interpretability  Feature importance    Feature importance

  WHEN TO USE WHAT
  ================

  Random Forest:               Boosting:
  - Quick baseline             - Maximum accuracy needed
  - Don't want to tune much    - Willing to tune carefully
  - Large datasets             - Competition/production
  - Want robustness            - Tabular data
```

---

## Out-of-Bag Score (Free Validation)

Remember that ~37% of data left out of each bootstrap sample? We
can use that for validation -- no separate test set needed.

```python
rf_oob = RandomForestClassifier(
    n_estimators=100,
    oob_score=True,
    random_state=42
)
rf_oob.fit(X_train, y_train)

print(f"OOB Score: {rf_oob.oob_score_:.3f}")
print(f"Test Score: {rf_oob.score(X_test, y_test):.3f}")
```

---

## Regression with Ensembles

```python
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.datasets import fetch_california_housing
from sklearn.metrics import mean_squared_error

housing = fetch_california_housing(as_frame=True)
X_h = housing.data
y_h = housing.target

X_tr, X_te, y_tr, y_te = train_test_split(
    X_h, y_h, test_size=0.2, random_state=42
)

rf_reg = RandomForestRegressor(n_estimators=100, random_state=42)
rf_reg.fit(X_tr, y_tr)
rf_rmse = mean_squared_error(y_te, rf_reg.predict(X_te), squared=False)

gb_reg = GradientBoostingRegressor(n_estimators=200, max_depth=4, random_state=42)
gb_reg.fit(X_tr, y_tr)
gb_rmse = mean_squared_error(y_te, gb_reg.predict(X_te), squared=False)

print(f"Random Forest RMSE:      {rf_rmse:.4f}")
print(f"Gradient Boosting RMSE:  {gb_rmse:.4f}")
```

---

## Exercises

### Exercise 1: Forest Size Experiment

Train Random Forests with 10, 50, 100, 200, 500, and 1000 trees on
the Titanic dataset. Plot CV accuracy vs number of trees. At what
point do additional trees stop helping?

### Exercise 2: RF vs Boosting Showdown

Using the Titanic dataset, compare:
1. Decision Tree (tuned)
2. Random Forest (100 trees)
3. AdaBoost (200 estimators)
4. GradientBoosting (200 estimators)

Report accuracy, precision, recall, and F1 for each. Which wins?

### Exercise 3: Feature Importance Comparison

Train both a Random Forest and GradientBoosting on the California
Housing dataset. Compare their feature importance rankings. Do they
agree on which features matter most?

---

[Next: Lesson 08 - XGBoost & LightGBM -->](08-xgboost-lightgbm.md)
