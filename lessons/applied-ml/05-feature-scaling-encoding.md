# Lesson 05: Feature Scaling & Encoding

## Speaking the Model's Language

Models only understand numbers. If you have "red", "blue", "green" --
that means nothing to an algorithm. And if one feature ranges from 0
to 1 while another ranges from 0 to 1,000,000 -- the big one will
dominate, like a loud person drowning out everyone in a meeting.

```
  THE PROBLEM
  ===========

  Feature     Range           Model Sees
  -------     -----           ----------
  age         [0, 100]        Tiny signal
  income      [0, 1000000]    HUGE signal  <-- dominates!
  color       [red, blue]     ???          <-- can't read!

  AFTER SCALING & ENCODING
  ========================

  Feature     Range           Model Sees
  -------     -----           ----------
  age_scaled  [-2, 2]         Fair signal
  income_sc   [-2, 2]         Fair signal
  color_red   [0, 1]          Clear signal
  color_blue  [0, 1]          Clear signal
```

---

## Part 1: Feature Scaling

### Why Scale?

```
  ALGORITHMS THAT NEED SCALING    ALGORITHMS THAT DON'T
  ============================    =====================
  Linear Regression               Decision Trees
  Logistic Regression             Random Forests
  SVM                             XGBoost / LightGBM
  KNN                             Naive Bayes
  Neural Networks
  K-Means Clustering
  PCA

  Rule: If it uses DISTANCE or GRADIENT, scale it.
```

### Min-Max Normalization (0 to 1)

Squishes values into [0, 1]. Like fitting all students' heights
onto the same ruler.

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

data = np.array([[25, 50000], [35, 80000], [45, 120000], [55, 40000]])
df = pd.DataFrame(data, columns=["age", "income"])

scaler = MinMaxScaler()
df_scaled = pd.DataFrame(
    scaler.fit_transform(df),
    columns=df.columns
)
print(df_scaled)
```

```
  MIN-MAX FORMULA
  ===============

  X_scaled = (X - X_min) / (X_max - X_min)

  Example: age=35, min=25, max=55
  scaled = (35 - 25) / (55 - 25) = 10/30 = 0.333

  Before:  25 |----35----------45---------| 55
  After:   0  |--0.33--------0.67---------| 1.0
```

### Standardization (Z-score)

Centers at 0 with standard deviation of 1. Like grading on a curve.

```python
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()
df_standard = pd.DataFrame(
    scaler.fit_transform(df),
    columns=df.columns
)
print(df_standard)
print(f"Mean: {df_standard.mean().round(4).tolist()}")
print(f"Std:  {df_standard.std().round(4).tolist()}")
```

```
  STANDARDIZATION FORMULA
  =======================

  X_scaled = (X - mean) / std

  Result: mean=0, std=1 for all features

  Before:  [25, 35, 45, 55]  mean=40, std=12.9
  After:   [-1.16, -0.39, 0.39, 1.16]
```

### Robust Scaling (Outlier-Resistant)

Uses median and IQR instead of mean and std. Like using the median
house price instead of the mean (which gets skewed by mansions).

```python
from sklearn.preprocessing import RobustScaler

scaler = RobustScaler()
df_robust = pd.DataFrame(
    scaler.fit_transform(df),
    columns=df.columns
)
```

```
  WHEN TO USE WHAT
  ================

  Method          Best When                  Formula
  ------          ---------                  -------
  MinMaxScaler    Bounded data, no outliers  (X-min)/(max-min)
  StandardScaler  Gaussian-like, few out.    (X-mean)/std
  RobustScaler    Many outliers              (X-median)/IQR
```

---

## Part 2: Encoding Categorical Variables

### One-Hot Encoding

Each category becomes its own binary column.

```python
from sklearn.preprocessing import OneHotEncoder

df = pd.DataFrame({
    "color": ["red", "blue", "green", "red", "blue"],
    "size": ["S", "M", "L", "XL", "M"]
})

encoder = OneHotEncoder(sparse_output=False, drop="first")
encoded = encoder.fit_transform(df[["color"]])
encoded_df = pd.DataFrame(
    encoded,
    columns=encoder.get_feature_names_out(["color"])
)
print(encoded_df)
```

```
  ONE-HOT ENCODING
  ================

  color    -> color_blue  color_green  color_red
  red         0            0            1
  blue        1            0            0
  green       0            1            0
  red         0            0            1

  With drop="first" (avoid multicollinearity):
  color    -> color_green  color_red
  red         0            1
  blue        0            0          <- "blue" is the baseline
  green       1            0
```

### Pandas get_dummies (Quick and Easy)

```python
df_encoded = pd.get_dummies(df, columns=["color", "size"], drop_first=True)
print(df_encoded)
```

### Label Encoding (Ordinal)

When categories have a natural order.

```python
from sklearn.preprocessing import OrdinalEncoder

size_order = [["S", "M", "L", "XL"]]

encoder = OrdinalEncoder(categories=size_order)
df["size_encoded"] = encoder.fit_transform(df[["size"]])
print(df[["size", "size_encoded"]])
```

```
  ORDINAL vs NOMINAL
  ==================

  Ordinal (has order):         Nominal (no order):
  S < M < L < XL              red, blue, green
  low < medium < high          cat, dog, fish
  cold < warm < hot            USA, UK, Japan

  Use OrdinalEncoder           Use OneHotEncoder
  (preserves order)            (no false ordering)
```

### Target Encoding (High-Cardinality)

When you have too many categories for one-hot (like zip codes or
city names).

```python
import pandas as pd
import numpy as np

df = pd.DataFrame({
    "city": ["NYC", "LA", "NYC", "Chicago", "LA", "NYC",
             "Chicago", "LA", "NYC", "Chicago"],
    "price": [500, 300, 450, 200, 350, 480, 220, 310, 520, 190]
})

city_means = df.groupby("city")["price"].mean()
df["city_encoded"] = df["city"].map(city_means)
print(df)
```

```
  TARGET ENCODING
  ===============

  city      avg_price   encoded
  NYC       487.5       487.5
  LA        320.0       320.0
  Chicago   203.3       203.3

  WARNING: Risk of data leakage!
  Always compute on training data only.
```

---

## Part 3: Pipelines

### Why Pipelines?

Without a pipeline, you have to remember the exact order of
transformations and apply them identically to train and test data.
It is like cooking without a recipe -- you will forget a step.

```
  WITHOUT PIPELINE              WITH PIPELINE
  ================              =============
  1. Impute train               pipeline.fit(X_train)
  2. Scale train                pipeline.predict(X_test)
  3. Encode train
  4. Fit model                  That's it.
  5. Impute test (same params!)
  6. Scale test (same params!)
  7. Encode test (same params!)
  8. Predict

  Error-prone, messy            Clean, reproducible
```

### Building a Full Pipeline

```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, OrdinalEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

numeric_features = ["Age", "Fare", "SibSp", "Parch"]
categorical_features = ["Sex", "Embarked"]
ordinal_features = ["Pclass"]

numeric_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler())
])

categorical_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore"))
])

ordinal_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OrdinalEncoder())
])

preprocessor = ColumnTransformer(transformers=[
    ("num", numeric_transformer, numeric_features),
    ("cat", categorical_transformer, categorical_features),
    ("ord", ordinal_transformer, ordinal_features)
])

full_pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(random_state=42))
])
```

### Using the Pipeline

```python
df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)

feature_cols = numeric_features + categorical_features + ordinal_features
X = df[feature_cols]
y = df["Survived"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

full_pipeline.fit(X_train, y_train)
score = full_pipeline.score(X_test, y_test)
print(f"Accuracy: {score:.3f}")
```

### Inspecting Pipeline Steps

```python
preprocessor_fitted = full_pipeline.named_steps["preprocessor"]

cat_encoder = (preprocessor_fitted
               .named_transformers_["cat"]
               .named_steps["encoder"])
print(cat_encoder.get_feature_names_out(categorical_features))

X_transformed = preprocessor_fitted.transform(X_test)
print(f"Transformed shape: {X_transformed.shape}")
```

---

## Common Pitfalls

```
  PITFALL                          FIX
  =======                          ===
  Fitting scaler on test data      Always fit on train only
  One-hot with many categories     Use target encoding
  Ordinal encoding nominals        Check if order exists
  Forgetting to scale at predict   Use pipelines!
  Scaling the target variable      Usually don't scale y
  Scaling after train/test split   Scale separately
```

---

## Exercises

### Exercise 1: Scaling Comparison

Using California Housing:

```python
from sklearn.datasets import fetch_california_housing
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error

data = fetch_california_housing(as_frame=True)
X, y = data.data, data.target
```

Train a `LinearRegression` with: no scaling, MinMaxScaler,
StandardScaler, RobustScaler. Compare RMSE for each.

### Exercise 2: Encoding Strategies

Create a dataset with mixed types and build a `ColumnTransformer`
that applies the right encoding to each column type:

```python
df = pd.DataFrame({
    "age": [25, 35, np.nan, 45],
    "income": [50000, np.nan, 70000, 90000],
    "education": ["high_school", "bachelors", "masters", "phd"],
    "city": ["NYC", "LA", "NYC", "Chicago"],
    "subscribed": [1, 0, 1, 1]
})
```

### Exercise 3: Full Pipeline

Build a complete pipeline for the Titanic dataset that includes:
1. Numeric imputation + scaling
2. Categorical encoding
3. A classifier of your choice

Use `cross_val_score` to evaluate with 5-fold CV.

---

[Next: Lesson 06 - Decision Trees -->](06-decision-trees.md)
