# Lesson 06: Decision Trees

## The 20 Questions Game

Remember the game "20 Questions"? You ask yes/no questions to narrow
down the answer. "Is it alive?" "Is it bigger than a breadbox?"
"Can you eat it?"

A decision tree works exactly the same way. It learns the best
questions to ask about your data to make predictions.

```
  20 QUESTIONS vs DECISION TREE
  =============================

  Game:                        Tree:
  "Is it alive?"               "Is income > 50k?"
     |           |                |              |
    Yes         No               Yes            No
     |           |                |              |
  "Does it      "Is it          "Is age         "Is credit
   have legs?"   electronic?"    > 30?"          score > 700?"
     |    |       |     |         |    |           |      |
    Yes  No     Yes    No       Yes   No         Yes    No
     |    |       |     |         |    |           |      |
   Dog  Fish   Phone  Book    Approve Approve   Approve Deny
```

---

## How Trees Make Decisions

### The Splitting Process

```
  STEP 1: Start with all data
  ===========================

  All passengers (891)
  Survived: 342 (38%)  Died: 549 (62%)

  STEP 2: Find the best question to split on
  ===========================================

  Try "Is Sex == female?"
      Yes (314)                    No (577)
      Survived: 233 (74%)         Survived: 109 (19%)
      Died: 81 (26%)              Died: 468 (81%)
      --> Very informative!

  Try "Is Age > 30?"
      Yes (332)                    No (559)
      Survived: 120 (36%)         Survived: 222 (40%)
      Died: 212 (64%)             Died: 337 (60%)
      --> Not very informative...

  Tree picks Sex because it separates the classes best.
```

### Measuring Split Quality: Gini Impurity

Gini measures how "mixed" a group is. A group of all cats has Gini=0
(pure). A 50/50 mix of cats and dogs has Gini=0.5 (maximally impure).

```
  GINI IMPURITY
  =============

  Gini = 1 - sum(p_i^2) for each class i

  Pure node:     All survived -> 1 - 1.0^2 = 0.0
  Mixed node:    50/50 split  -> 1 - (0.5^2 + 0.5^2) = 0.5
  Mostly one:    80/20 split  -> 1 - (0.8^2 + 0.2^2) = 0.32

  PURITY SCALE:
  0.0          0.25          0.5
  |=============|=============|
  Pure        Somewhat       Maximum
  (great!)    mixed          impurity
```

---

## Building Your First Tree

```python
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)

df["Sex_encoded"] = (df["Sex"] == "male").astype(int)
df["Age"] = df["Age"].fillna(df["Age"].median())
df["Embarked"] = df["Embarked"].fillna("S")
df["Embarked_encoded"] = df["Embarked"].map({"S": 0, "C": 1, "Q": 2})

features = ["Pclass", "Sex_encoded", "Age", "SibSp", "Parch",
            "Fare", "Embarked_encoded"]
X = df[features]
y = df["Survived"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

tree = DecisionTreeClassifier(random_state=42)
tree.fit(X_train, y_train)

train_acc = tree.score(X_train, y_train)
test_acc = tree.score(X_test, y_test)
print(f"Train accuracy: {train_acc:.3f}")
print(f"Test accuracy:  {test_acc:.3f}")
```

---

## Visualizing the Tree

```python
from sklearn.tree import export_text

tree_rules = export_text(tree, feature_names=features, max_depth=3)
print(tree_rules)
```

```python
import matplotlib.pyplot as plt
from sklearn.tree import plot_tree

plt.figure(figsize=(20, 10))
plot_tree(
    tree,
    feature_names=features,
    class_names=["Died", "Survived"],
    filled=True,
    rounded=True,
    max_depth=3
)
plt.tight_layout()
plt.show()
```

---

## Overfitting: The Tree's Weakness

An unrestricted tree will memorize the training data perfectly --
like a student who memorizes answers instead of understanding concepts.

```
  OVERFITTING VISUALIZED
  ======================

  Unrestricted Tree:
  Train accuracy: 100%     <-- memorized everything
  Test accuracy:  72%      <-- fails on new data

  Pruned Tree:
  Train accuracy: 84%      <-- slight underfitting on train
  Test accuracy:  81%      <-- generalizes much better

  DEPTH vs ACCURACY
  =================

  Accuracy
  |                  ___________
  |          ______/            Train accuracy
  |   _____/
  |  /
  |        ____
  |  _____/    \____           Test accuracy
  | /               \________
  +----------------------------> Tree Depth
       2    4    6    8   10+

  Sweet spot is where test accuracy peaks
```

---

## Controlling Tree Complexity

```python
tree_pruned = DecisionTreeClassifier(
    max_depth=5,
    min_samples_split=20,
    min_samples_leaf=10,
    max_features="sqrt",
    random_state=42
)
tree_pruned.fit(X_train, y_train)

print(f"Pruned train acc: {tree_pruned.score(X_train, y_train):.3f}")
print(f"Pruned test acc:  {tree_pruned.score(X_test, y_test):.3f}")
```

```
  HYPERPARAMETERS
  ===============

  Parameter           What it does            Typical range
  ---------           ------------            -------------
  max_depth           Max levels in tree      3-20
  min_samples_split   Min samples to split    2-50
  min_samples_leaf    Min samples in leaf     1-20
  max_features        Features per split      "sqrt", "log2"
  criterion           Split measure           "gini", "entropy"

  More restrictive = simpler tree = less overfitting
  Less restrictive = complex tree = more overfitting
```

---

## Finding the Best Depth

```python
from sklearn.model_selection import cross_val_score

depths = range(1, 21)
train_scores = []
test_scores = []

for depth in depths:
    tree_d = DecisionTreeClassifier(max_depth=depth, random_state=42)
    tree_d.fit(X_train, y_train)
    train_scores.append(tree_d.score(X_train, y_train))
    cv_score = cross_val_score(tree_d, X_train, y_train, cv=5).mean()
    test_scores.append(cv_score)

best_depth = depths[np.argmax(test_scores)]
print(f"Best depth: {best_depth} (CV accuracy: {max(test_scores):.3f})")

plt.figure(figsize=(10, 6))
plt.plot(depths, train_scores, "o-", label="Train")
plt.plot(depths, test_scores, "o-", label="CV Score")
plt.xlabel("Max Depth")
plt.ylabel("Accuracy")
plt.legend()
plt.title("Finding the Sweet Spot")
plt.show()
```

---

## Feature Importance

Trees tell you which questions mattered most.

```python
importances = pd.Series(
    tree_pruned.feature_importances_,
    index=features
).sort_values(ascending=False)

print(importances)

importances.plot(kind="barh", figsize=(10, 6))
plt.title("Feature Importance")
plt.xlabel("Importance")
plt.show()
```

```
  FEATURE IMPORTANCE (Titanic)
  ============================

  Sex_encoded  |############################|  0.62
  Fare         |########|                      0.15
  Age          |######|                        0.11
  Pclass       |####|                          0.07
  SibSp        |##|                            0.03
  Parch        |#|                             0.01
  Embarked     |#|                             0.01
```

---

## Decision Trees for Regression

Trees can predict numbers too, not just classes.

```python
from sklearn.tree import DecisionTreeRegressor
from sklearn.datasets import fetch_california_housing

housing = fetch_california_housing(as_frame=True)
X = housing.data
y = housing.target

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

reg_tree = DecisionTreeRegressor(max_depth=6, random_state=42)
reg_tree.fit(X_train, y_train)

from sklearn.metrics import mean_squared_error

y_pred = reg_tree.predict(X_test)
rmse = mean_squared_error(y_test, y_pred, squared=False)
print(f"RMSE: {rmse:.3f}")
```

---

## Pros and Cons

```
  PROS                           CONS
  ====                           ====
  + Easy to understand           - Prone to overfitting
  + No scaling needed            - Unstable (small data
  + Handles mixed types            changes -> different tree)
  + Built-in feature importance  - Biased toward features
  + Fast to train                  with many values
  + Interpretable predictions    - Can't capture linear
                                   relationships well
```

---

## Exercises

### Exercise 1: Tree Depth Experiment

Using the Titanic dataset, train decision trees with depths
1 through 20. Plot train vs. cross-validation accuracy. What
depth gives the best generalization?

### Exercise 2: Iris Classification Tree

```python
from sklearn.datasets import load_iris

iris = load_iris(as_frame=True)
X, y = iris.data, iris.target
```

1. Train a decision tree with max_depth=3
2. Visualize it using `plot_tree`
3. Print the text rules using `export_text`
4. What is the most important feature?

### Exercise 3: Regression Tree

Using California Housing, compare a deep tree (max_depth=20) vs.
a shallow tree (max_depth=4). Which has better test RMSE? Plot
predicted vs. actual values for both.

---

[Next: Lesson 07 - Random Forests & Boosting -->](07-random-forests-boosting.md)
