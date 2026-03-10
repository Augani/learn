# Lesson 09: Scikit-Learn

> Scikit-learn is like a well-organized toolbox.
> Every tool (algorithm) has the same handle (API), so once you learn
> to use one, you can use them all.

---

## The Estimator API

Every scikit-learn model follows the same pattern. Like how every
car has a steering wheel, gas pedal, and brake - regardless of make.

```
  The Universal API:
  ──────────────────
  model = SomeModel(params)     # Create
  model.fit(X_train, y_train)   # Train
  predictions = model.predict(X_test)  # Predict
  score = model.score(X_test, y_test)  # Evaluate
```

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split

X, y = make_classification(n_samples=1000, n_features=20,
                           n_informative=10, random_state=42)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42,
)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

print(f"Accuracy: {model.score(X_test, y_test):.3f}")
```

---

## Data Splitting

Like shuffling a deck of cards and dealing separate hands
for practice (train), mock exam (validation), and final exam (test).

```
  Full Dataset (1000 samples)
  ┌──────────────────────────────────────────────────┐
  │ Train (640)      │ Val (160)  │ Test (200)       │
  │ Learn patterns   │ Tune knobs│ Final grade       │
  └──────────────────────────────────────────────────┘
       64%                16%          20%
```

```python
from sklearn.model_selection import train_test_split
import numpy as np

X = np.random.default_rng(42).standard_normal((1000, 10))
y = np.random.default_rng(42).integers(0, 3, 1000)

X_temp, X_test, y_temp, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y,
)
X_train, X_val, y_train, y_val = train_test_split(
    X_temp, y_temp, test_size=0.2, random_state=42, stratify=y_temp,
)

print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")
```

### Cross-Validation

Like taking the same exam 5 times with different questions each time.
More reliable than a single train/test split.

```python
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)
model = RandomForestClassifier(n_estimators=100, random_state=42)

scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
print(f"Scores: {scores}")
print(f"Mean: {scores.mean():.3f} +/- {scores.std():.3f}")
```

---

## Preprocessing: Transformers

Transformers (not the neural network kind) prepare your data.
Like prepping ingredients before cooking - washing, chopping, measuring.

```python
from sklearn.preprocessing import StandardScaler, MinMaxScaler
import numpy as np

data = np.array([[1.0, 200.0, 0.001],
                 [2.0, 400.0, 0.002],
                 [3.0, 100.0, 0.003]])

scaler = StandardScaler()
scaled = scaler.fit_transform(data)
print(f"Means: {scaled.mean(axis=0).round(4)}")
print(f"Stds:  {scaled.std(axis=0).round(4)}")

minmax = MinMaxScaler()
normalized = minmax.fit_transform(data)
print(f"Min: {normalized.min(axis=0)}")
print(f"Max: {normalized.max(axis=0)}")
```

### Encoding Categorical Data

```python
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
import numpy as np

labels = ["cat", "dog", "bird", "cat", "bird"]

le = LabelEncoder()
encoded = le.fit_transform(labels)
print(f"Encoded: {encoded}")
print(f"Classes: {le.classes_}")
print(f"Decoded: {le.inverse_transform(encoded)}")

ohe = OneHotEncoder(sparse_output=False)
one_hot = ohe.fit_transform(np.array(labels).reshape(-1, 1))
print(f"One-hot:\n{one_hot}")
```

---

## Pipelines

Pipelines chain preprocessing and modeling steps together.
Like a factory assembly line where each station does one thing,
and parts flow from start to finish automatically.

```
  Pipeline:
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Imputer  │───>│ Scaler   │───>│ PCA      │───>│ Classifier│
  │ fill NaN │    │ normalize│    │ reduce   │    │ predict  │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split

X, y = make_classification(n_samples=1000, n_features=50, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("pca", PCA(n_components=20)),
    ("clf", RandomForestClassifier(n_estimators=100, random_state=42)),
])

pipe.fit(X_train, y_train)
print(f"Accuracy: {pipe.score(X_test, y_test):.3f}")
```

### Column Transformer for Mixed Data

```python
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import GradientBoostingClassifier
import numpy as np
import pandas as pd

df = pd.DataFrame({
    "age": [25, 30, 35, 40, 45, 50, 55, 60],
    "income": [30000, 50000, 70000, 80000, 90000, 100000, 60000, 75000],
    "city": ["NYC", "LA", "NYC", "SF", "LA", "SF", "NYC", "LA"],
    "education": ["BS", "MS", "PhD", "BS", "MS", "PhD", "BS", "MS"],
})
y = np.array([0, 1, 1, 0, 1, 1, 0, 0])

preprocessor = ColumnTransformer([
    ("num", StandardScaler(), ["age", "income"]),
    ("cat", OneHotEncoder(drop="first", sparse_output=False), ["city", "education"]),
])

pipe = Pipeline([
    ("preprocess", preprocessor),
    ("clf", GradientBoostingClassifier(random_state=42)),
])

pipe.fit(df, y)
print(f"Training accuracy: {pipe.score(df, y):.3f}")
```

---

## Common Algorithms

```
  Algorithm               Use When                    Speed
  ───────────────────     ─────────────────────────   ─────
  LogisticRegression      Binary/multi classification Fast
  RandomForest            Tabular data, few features  Medium
  GradientBoosting        Competitions, tabular       Medium
  SVM                     Small datasets, kernels     Slow
  KNeighbors              Similarity-based tasks      Fast*
  LinearRegression        Simple regression           Fast
  KMeans                  Clustering, unsupervised    Fast
  DBSCAN                  Density-based clustering    Medium
  PCA                     Dimensionality reduction    Fast

  * KNN is fast to train, slow to predict on large data
```

```python
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
)
from sklearn.datasets import make_classification
from sklearn.model_selection import cross_val_score

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)

models = {
    "Logistic": LogisticRegression(max_iter=1000),
    "KNN": KNeighborsClassifier(),
    "SVM": SVC(),
    "RandomForest": RandomForestClassifier(random_state=42),
    "GradientBoosting": GradientBoostingClassifier(random_state=42),
}

for name, model in models.items():
    scores = cross_val_score(model, X, y, cv=5)
    print(f"{name:20s} {scores.mean():.3f} +/- {scores.std():.3f}")
```

---

## Hyperparameter Tuning

Like tuning a guitar - you try different tensions until it sounds right.
Grid search tries every combination. Random search samples randomly
(often faster and just as good).

```python
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)

param_grid = {
    "n_estimators": [50, 100, 200],
    "max_depth": [5, 10, 20, None],
    "min_samples_split": [2, 5, 10],
}

grid = GridSearchCV(
    RandomForestClassifier(random_state=42),
    param_grid,
    cv=3,
    scoring="accuracy",
    n_jobs=-1,
    verbose=1,
)
grid.fit(X, y)

print(f"Best params: {grid.best_params_}")
print(f"Best score: {grid.best_score_:.3f}")
```

---

## Evaluation Metrics

```python
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    mean_squared_error,
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
import numpy as np

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

print(classification_report(y_test, y_pred))
print(f"ROC AUC: {roc_auc_score(y_test, y_proba):.3f}")
print(f"Confusion Matrix:\n{confusion_matrix(y_test, y_pred)}")
```

---

## Feature Importance

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
import numpy as np

X, y = make_classification(
    n_samples=1000, n_features=10,
    n_informative=5, random_state=42,
)
feature_names = [f"feature_{i}" for i in range(10)]

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X, y)

importances = model.feature_importances_
indices = np.argsort(importances)[::-1]

print("Feature ranking:")
for i, idx in enumerate(indices):
    print(f"  {i + 1}. {feature_names[idx]}: {importances[idx]:.4f}")
```

---

## Saving and Loading Models

```python
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=100, n_features=10, random_state=42)
model = RandomForestClassifier(random_state=42)
model.fit(X, y)

joblib.dump(model, "model.joblib")
loaded_model = joblib.load("model.joblib")
print(f"Loaded model score: {loaded_model.score(X, y):.3f}")
```

---

## Exercises

1. **Full Pipeline**: Build a pipeline with imputation, scaling,
   feature selection (`SelectKBest`), and classification. Use
   `GridSearchCV` to tune the classifier and feature count.

2. **Model Comparison**: Using the wine or iris dataset, compare 5
   different classifiers with 5-fold cross-validation. Report mean
   and std for accuracy, precision, recall, and F1.

3. **Mixed Data Pipeline**: Create a dataset with numeric and
   categorical columns. Build a `ColumnTransformer` pipeline that
   handles both types and feeds into a classifier.

4. **Custom Transformer**: Write a custom scikit-learn transformer
   (inherit from `BaseEstimator`, `TransformerMixin`) that performs
   log transformation on skewed features. Use it in a pipeline.

5. **End-to-End**: Load a dataset, explore it, clean it, build a
   pipeline, tune hyperparameters, evaluate on a held-out test set,
   and save the best model. Generate a classification report.

---

[Next: Lesson 10 - PyTorch Deep Dive ->](10-pytorch-deep-dive.md)
