# Lesson 09: Support Vector Machines

## Drawing a Line in the Sand

Imagine you are at the beach with red and blue balls scattered on
the sand. You need to draw a line to separate the colors. There
are many possible lines, but the best one is the line with the
widest margin -- the most sand between the nearest red and blue
balls.

```
  BAD BOUNDARY               GOOD BOUNDARY (SVM)
  ============               ===================

  R R                        R R
  R   R    /                 R   R    |    B B
   R R    / B B               R R     |  B B
  R      / B B               R    <-->|    B B
   R    /    B                 R  margin   B
        /  B B                        |  B B
       / B                            | B

  Too close to red           Maximum margin
  Unstable, fragile          Robust, confident
```

The "support vectors" are the balls closest to the line. They are
the critical data points that define the boundary.

---

## The Margin Concept

```
  MAXIMUM MARGIN CLASSIFIER
  =========================

       R      |  margin  |      B
        R     |<-------->|     B
         R    |          |    B
    R     R   |          |   B    B
       R      |          |      B
         R    |          |     B
              |          |
         support       support
         vectors       vectors

  Margin = distance between decision boundary
           and nearest points from each class

  Wider margin = more confidence in classification
```

---

## Linear SVM

```python
import numpy as np
import pandas as pd
from sklearn.svm import SVC, LinearSVC
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report

from sklearn.datasets import make_classification

X, y = make_classification(
    n_samples=500, n_features=2, n_redundant=0,
    n_informative=2, n_clusters_per_class=1, random_state=42
)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

svm_linear = SVC(kernel="linear", C=1.0, random_state=42)
svm_linear.fit(X_train_scaled, y_train)

print(f"Accuracy: {svm_linear.score(X_test_scaled, y_test):.3f}")
print(f"Support vectors: {svm_linear.n_support_}")
```

**CRITICAL: Always scale your data before using SVMs.** SVMs use
distances, and unscaled features will dominate.

---

## The Kernel Trick

What if data is not linearly separable? Like red and blue balls
arranged in concentric circles -- no straight line can separate them.

```
  NOT LINEARLY SEPARABLE          AFTER KERNEL TRICK
  ========================        ==================

  In 2D:                          Project to 3D, then separate:

       B B B                              / plane
     B  R R  B                     B    /    B
    B  R   R  B                   B   /   B
     B  R R  B                      /  R R
       B B B                      / R   R
                                 /  R R
  No line works!                A plane works in 3D!
```

The kernel trick computes distances in a higher dimension without
actually transforming the data. It is math magic.

### RBF Kernel (Most Common)

```python
svm_rbf = SVC(kernel="rbf", C=1.0, gamma="scale", random_state=42)
svm_rbf.fit(X_train_scaled, y_train)

print(f"RBF Accuracy: {svm_rbf.score(X_test_scaled, y_test):.3f}")
```

```
  KERNEL COMPARISON
  =================

  Kernel      Shape of Boundary    When to Use
  ------      -----------------    -----------
  linear      Straight line/plane  Linearly separable data
  rbf         Flexible curves      General purpose (default)
  poly        Polynomial curves    When polynomial relationship
  sigmoid     S-shaped             Rarely used in practice

  DECISION BOUNDARIES
  ===================

  Linear:     /          RBF:     ~~~
             /                   /   \
            /                   |     |
           /                     \   /
                                  ~~~

  Poly:     ___                  Sigmoid:   ___/
           /   \                           /
          /     \                      ___/
```

---

## The C Parameter

C controls the trade-off between a wide margin and correctly
classifying training points. Like a strictness dial.

```
  LOW C (lenient)               HIGH C (strict)
  ===============               ================

  R   R  |     B B              R   R   |    B B
  R  X   |   B   B             R    R   |  B   B
  R   R  |  B  B               R   R    | B  B
  R    R |    B                R    R    |   B

  Wide margin                   Narrow margin
  Some misclassifications OK    Almost no misclassification
  Better generalization         May overfit

  C=0.01                        C=100
```

```python
for c_value in [0.01, 0.1, 1, 10, 100]:
    svm = SVC(kernel="rbf", C=c_value, random_state=42)
    svm.fit(X_train_scaled, y_train)
    train_acc = svm.score(X_train_scaled, y_train)
    test_acc = svm.score(X_test_scaled, y_test)
    print(f"C={c_value:6.2f} | Train: {train_acc:.3f} | Test: {test_acc:.3f}")
```

---

## The Gamma Parameter (RBF Kernel)

Gamma controls how far the influence of a single training example
reaches. Like the "zoom level" of the decision boundary.

```
  LOW GAMMA                     HIGH GAMMA
  =========                     ==========

  Smooth, broad boundary         Tight, wiggly boundary
  Each point influences widely   Each point influences locally

  ~~~~~~                         ~.~.~.~.~.~
        ~~~~~~                           ~.~.~
              ~~~~~~                          ~.~

  May underfit                   May overfit
```

```python
for gamma_value in [0.001, 0.01, 0.1, 1, 10]:
    svm = SVC(kernel="rbf", C=1.0, gamma=gamma_value, random_state=42)
    svm.fit(X_train_scaled, y_train)
    train_acc = svm.score(X_train_scaled, y_train)
    test_acc = svm.score(X_test_scaled, y_test)
    print(f"gamma={gamma_value:6.3f} | Train: {train_acc:.3f} | Test: {test_acc:.3f}")
```

---

## SVM on Real Data: Titanic

```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)

numeric_features = ["Age", "Fare", "SibSp", "Parch"]
categorical_features = ["Sex", "Embarked", "Pclass"]

numeric_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler())
])

categorical_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore"))
])

preprocessor = ColumnTransformer(transformers=[
    ("num", numeric_transformer, numeric_features),
    ("cat", categorical_transformer, categorical_features)
])

svm_pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("classifier", SVC(kernel="rbf", C=1.0, gamma="scale", random_state=42))
])

X = df[numeric_features + categorical_features]
y = df["Survived"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

svm_pipeline.fit(X_train, y_train)
print(f"SVM Pipeline accuracy: {svm_pipeline.score(X_test, y_test):.3f}")
```

---

## SVM for Probability Estimates

By default, SVM gives hard predictions. For probabilities, enable
`probability=True` (slower but sometimes needed).

```python
svm_prob = SVC(kernel="rbf", probability=True, random_state=42)
svm_prob.fit(X_train_scaled, y_train)

probabilities = svm_prob.predict_proba(X_test_scaled)
print(f"Sample probabilities:\n{probabilities[:5]}")
```

---

## When to Use SVMs

```
  GOOD FOR:                      BAD FOR:
  =========                      ========
  + Small to medium datasets     - Very large datasets (slow)
  + High-dimensional data        - Need probability outputs
  + Clear margin of separation   - Lots of noise/overlap
  + Text classification          - Need feature importance
  + Image classification         - Need fast training
  + Binary classification        - Interpretability needed

  SVM COMPLEXITY
  ==============

  Dataset Size    Training Time
  100             Instant
  1,000           Seconds
  10,000          Minutes
  100,000         Hours (consider LinearSVC)
  1,000,000       Don't use SVM
```

---

## LinearSVC for Large Datasets

```python
from sklearn.svm import LinearSVC

linear_svm = LinearSVC(C=1.0, max_iter=10000, random_state=42)
linear_svm.fit(X_train_scaled, y_train)
print(f"LinearSVC accuracy: {linear_svm.score(X_test_scaled, y_test):.3f}")
```

---

## Exercises

### Exercise 1: Kernel Comparison

Generate a non-linear dataset and compare all four kernels:

```python
from sklearn.datasets import make_moons

X, y = make_moons(n_samples=500, noise=0.2, random_state=42)
```

Train SVMs with linear, rbf, poly (degree=3), and sigmoid kernels.
Which performs best? Plot the decision boundaries if possible.

### Exercise 2: C and Gamma Grid Search

Using the Titanic pipeline above, tune C and gamma:

```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    "classifier__C": [0.01, 0.1, 1, 10, 100],
    "classifier__gamma": ["scale", "auto", 0.01, 0.1, 1]
}
```

What are the best values? How sensitive is accuracy to these params?

### Exercise 3: SVM vs Tree-Based Models

Compare SVM, Random Forest, and XGBoost on the digits dataset:

```python
from sklearn.datasets import load_digits
digits = load_digits()
X, y = digits.data, digits.target
```

Report accuracy and training time for each. When does SVM shine?

---

[Next: Lesson 10 - Clustering -->](10-clustering.md)
