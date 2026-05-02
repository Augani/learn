# Lesson 04: Handling Messy Data

## Filling Gaps in a Puzzle

Imagine doing a jigsaw puzzle. Some pieces are missing, some pieces
are from a completely different puzzle (outliers), and some sections
have way more pieces than others (imbalanced classes).

You have three choices: find reasonable replacements, remove the
broken pieces, or account for the gaps in your final picture.

```
  THE MESSY DATA PUZZLE
  =====================

  +----+----+----+----+
  | OK | OK | ?? | OK |   ?? = Missing
  +----+----+----+----+
  | OK | !! | OK | OK |   !! = Outlier
  +----+----+----+----+
  | OK | OK | OK | OK |
  +----+----+----+----+
  | OK | OK | ?? | ?? |
  +----+----+----+----+
```

---

## Part 1: Missing Data

### Why Data Goes Missing

```
  TYPES OF MISSING DATA
  =====================

  MCAR (Missing Completely At Random)
  -> Survey respondent skipped a question by accident
  -> Random sensor failure
  -> Safe to drop or impute simply

  MAR (Missing At Random)
  -> Older people less likely to report income
  -> Missingness depends on OTHER observed variables
  -> Use model-based imputation

  MNAR (Missing Not At Random)
  -> High earners refuse to report income
  -> Missingness depends on the MISSING VALUE ITSELF
  -> Hardest to handle, may need domain tricks
```

### Detecting Missing Data

```python
import pandas as pd
import numpy as np
from sklearn.datasets import fetch_openml

df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)

print(df.isnull().sum())
print(df.isnull().mean().round(3) * 100)

missing_patterns = df.isnull().groupby(
    df.isnull().apply(lambda x: tuple(x), axis=1)
).size().sort_values(ascending=False)
print(missing_patterns.head(10))
```

### Strategy 1: Drop Missing Data

```python
df_dropped_rows = df.dropna()
print(f"Before: {len(df)}, After: {len(df_dropped_rows)}")

threshold = 0.5
cols_to_drop = df.columns[df.isnull().mean() > threshold]
df_dropped_cols = df.drop(columns=cols_to_drop)
print(f"Dropped columns: {cols_to_drop.tolist()}")
```

```
  WHEN TO DROP vs IMPUTE
  ======================

  Drop rows when:              Impute when:
  - Very few missing (<5%)    - Significant missing (>5%)
  - Large dataset              - Small dataset
  - Missing is random          - Pattern in missingness
  - Row has many NaN           - Just 1-2 cols missing
```

### Strategy 2: Simple Imputation

```python
from sklearn.impute import SimpleImputer

num_imputer = SimpleImputer(strategy="median")
df["Age"] = num_imputer.fit_transform(df[["Age"]])

cat_imputer = SimpleImputer(strategy="most_frequent")
df["Embarked"] = cat_imputer.fit_transform(df[["Embarked"]]).ravel()

df["Cabin_known"] = df["Cabin"].notna().astype(int)
```

### Strategy 3: Smart Imputation

```python
from sklearn.impute import KNNImputer

knn_imputer = KNNImputer(n_neighbors=5)
numeric_cols = df.select_dtypes(include=[np.number]).columns
df[numeric_cols] = knn_imputer.fit_transform(df[numeric_cols])
```

```
  KNN IMPUTATION VISUALIZED
  =========================

  Finding 5 nearest neighbors to fill Age = ???

  Passenger   Age  Fare  Class  -> Distance
  similar_1   28   50    2         0.12
  similar_2   32   48    2         0.15
  similar_3   30   55    2         0.18
  similar_4   27   52    2         0.20
  similar_5   31   49    2         0.22

  Imputed Age = mean(28,32,30,27,31) = 29.6
```

---

## Part 2: Outliers

### What Makes an Outlier?

Like finding a piece from a different puzzle -- it might be a
genuine oddity or a data entry error.

```
  OUTLIER TYPES
  =============

  Legitimate:                  Erroneous:
  - CEO salary in company      - Age = -5
    salary data                - Temperature = 999
  - Mansion in housing data    - Typo: $10000 -> $100000
  - Viral post in social data  - Sensor malfunction

  Keep and handle              Fix or remove
```

### Detecting Outliers

```python
def detect_outliers_iqr(df, column):
    q1 = df[column].quantile(0.25)
    q3 = df[column].quantile(0.75)
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    outliers = df[(df[column] < lower) | (df[column] > upper)]
    return outliers, lower, upper

def detect_outliers_zscore(df, column, threshold=3):
    z_scores = np.abs((df[column] - df[column].mean()) / df[column].std())
    outliers = df[z_scores > threshold]
    return outliers

fare_outliers, lower, upper = detect_outliers_iqr(df, "Fare")
print(f"Fare outliers (IQR): {len(fare_outliers)}")
print(f"Bounds: [{lower:.2f}, {upper:.2f}]")
```

### Handling Outliers

```python
df["Fare_capped"] = df["Fare"].clip(lower=lower, upper=upper)

df["Fare_log"] = np.log1p(df["Fare"])

from sklearn.preprocessing import RobustScaler
scaler = RobustScaler()
df["Fare_robust"] = scaler.fit_transform(df[["Fare"]])
```

```
  OUTLIER HANDLING STRATEGIES
  ===========================

  Strategy       When to use           Effect
  ----------     ---------------       ------
  Remove         Clearly erroneous     Lose data
  Cap/Clip       Legitimate extremes   Reduce impact
  Log transform  Right-skewed data     Compress range
  RobustScaler   General purpose       Scale by IQR
  Keep as-is     Tree-based models     Trees handle it
```

---

## Part 3: Imbalanced Classes

### The Problem

Like a party with 95 introverts and 5 extroverts. If you guess
"introvert" for everyone, you are 95% accurate but completely
useless at finding extroverts.

```
  IMBALANCED DATASET
  ==================

  Class 0 (Majority):  ########################### 95%
  Class 1 (Minority):  #                            5%

  Naive model predicts all Class 0: 95% accuracy!
  But 0% recall on the class we actually care about.
```

### Detecting Imbalance

```python
print(df["target"].value_counts())
print(df["target"].value_counts(normalize=True))

ratio = df["target"].value_counts().min() / df["target"].value_counts().max()
print(f"Imbalance ratio: {ratio:.3f}")
```

### Strategy 1: Resampling

```python
from sklearn.utils import resample

majority = df[df["target"] == 0]
minority = df[df["target"] == 1]

minority_upsampled = resample(
    minority,
    replace=True,
    n_samples=len(majority),
    random_state=42
)

df_balanced = pd.concat([majority, minority_upsampled])
print(df_balanced["target"].value_counts())
```

```
  OVERSAMPLING vs UNDERSAMPLING
  =============================

  Original:     ########  ##
                Major(8)  Minor(2)

  Oversample:   ########  ########
                Major(8)  Minor(8, with repeats)
                -> More data, risk of overfitting

  Undersample:  ##        ##
                Major(2)  Minor(2)
                -> Less data, may lose patterns
```

### Strategy 2: SMOTE

```python
from imblearn.over_sampling import SMOTE

smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X_train, y_train)

print(f"Before SMOTE: {pd.Series(y_train).value_counts().to_dict()}")
print(f"After SMOTE:  {pd.Series(y_resampled).value_counts().to_dict()}")
```

```
  HOW SMOTE WORKS
  ===============

  1. Pick a minority sample         x
  2. Find its k nearest neighbors   x  o  o
  3. Create synthetic point              *
     between them

  Original:    x     x     x
  After SMOTE: x  *  x  *  x  *
               (synthetic points fill gaps)
```

### Strategy 3: Class Weights

```python
from sklearn.ensemble import RandomForestClassifier

model = RandomForestClassifier(
    class_weight="balanced",
    random_state=42
)
model.fit(X_train, y_train)
```

### Strategy 4: Threshold Tuning

```python
from sklearn.metrics import precision_recall_curve

y_proba = model.predict_proba(X_test)[:, 1]

precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)

target_recall = 0.8
idx = np.argmin(np.abs(recalls - target_recall))
best_threshold = thresholds[idx]
print(f"Threshold for {target_recall} recall: {best_threshold:.3f}")

y_pred_tuned = (y_proba >= best_threshold).astype(int)
```

---

## Putting It All Together: A Messy Data Pipeline

```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.ensemble import RandomForestClassifier

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

pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(
        class_weight="balanced", random_state=42
    ))
])

pipeline.fit(X_train, y_train)
score = pipeline.score(X_test, y_test)
print(f"Accuracy: {score:.3f}")
```

---

## Exercises

### Exercise 1: Missing Data Strategies

Using the Titanic dataset, compare these imputation strategies for
the `Age` column:

1. Drop rows with missing Age
2. Fill with median
3. Fill with mean
4. KNN imputation (k=5)

For each, train a `RandomForestClassifier` and compare accuracy.
Which strategy works best?

### Exercise 2: Outlier Impact

Using California Housing data:
```python
from sklearn.datasets import fetch_california_housing
data = fetch_california_housing(as_frame=True)
df = data.frame
```

1. Identify outliers in each numeric column
2. Train a model with and without outlier treatment
3. Compare performance using RMSE

### Exercise 3: Imbalanced Classification

Create an imbalanced dataset and compare strategies:

```python
from sklearn.datasets import make_classification

X, y = make_classification(
    n_samples=10000, n_features=20, n_informative=10,
    weights=[0.95, 0.05], random_state=42
)
```

Compare: baseline, class_weight="balanced", SMOTE, undersampling.
Use F1-score (not accuracy) to evaluate.

---

[Next: Lesson 05 - Feature Scaling & Encoding -->](05-feature-scaling-encoding.md)
