# Lesson 02: Exploratory Data Analysis

## The Detective at the Crime Scene

Before a detective builds a theory about what happened, they walk
through the crime scene. They look at everything. They take notes.
They notice what is there -- and what is missing.

EDA is exactly this. You are the detective, and the dataset is your
crime scene.

```
  THE EDA PROCESS
  ===============

  +----------+    +----------+    +----------+    +----------+
  | Look at  | -> | Study    | -> | Find     | -> | Form     |
  | the big  |    | each     |    | relation-|    | hypo-    |
  | picture  |    | variable |    | ships    |    | theses   |
  +----------+    +----------+    +----------+    +----------+
      |               |               |               |
   Shape,          Distribs,      Correlations,    What to
   types,          outliers,      patterns,        model,
   summary         missing        groups           features
```

---

## Step 1: The Big Picture

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)

print(df.shape)
print(df.columns.tolist())
print(df.dtypes)
print(df.head())
print(df.describe())
print(df.describe(include="object"))
```

Like a detective's first walk-through: how big is the scene, what
evidence is present, what jumps out immediately?

---

## Step 2: Univariate Analysis

Examine each variable in isolation. Like inspecting each piece of
evidence on its own before connecting them.

### Numeric Variables

```python
numeric_cols = df.select_dtypes(include=[np.number]).columns

for col in numeric_cols:
    print(f"\n--- {col} ---")
    print(f"  Mean:   {df[col].mean():.2f}")
    print(f"  Median: {df[col].median():.2f}")
    print(f"  Std:    {df[col].std():.2f}")
    print(f"  Min:    {df[col].min():.2f}")
    print(f"  Max:    {df[col].max():.2f}")
    print(f"  Skew:   {df[col].skew():.2f}")
```

```
  DISTRIBUTION SHAPES
  ====================

  Normal (Bell)     Right Skewed      Left Skewed
      __                 _
    /    \             /   \__           __/   \
   /      \           /       \___    __/       \
  /________\         /____________\  /___________\

  Heights,          Income,          Test scores
  Errors            House prices     (easy test)
```

### Visualizing Distributions

```python
fig, axes = plt.subplots(2, 3, figsize=(15, 10))
axes = axes.flatten()

for idx, col in enumerate(numeric_cols[:6]):
    axes[idx].hist(df[col].dropna(), bins=30, edgecolor="black")
    axes[idx].set_title(col)
    axes[idx].axvline(df[col].mean(), color="red", linestyle="--")
    axes[idx].axvline(df[col].median(), color="green", linestyle="--")

plt.tight_layout()
plt.show()
```

### Categorical Variables

```python
cat_cols = df.select_dtypes(include=["object"]).columns

for col in cat_cols:
    print(f"\n--- {col} ---")
    print(df[col].value_counts())
    print(f"  Unique: {df[col].nunique()}")
```

```python
fig, axes = plt.subplots(1, 3, figsize=(15, 5))

for idx, col in enumerate(cat_cols[:3]):
    df[col].value_counts().plot(kind="bar", ax=axes[idx])
    axes[idx].set_title(col)

plt.tight_layout()
plt.show()
```

---

## Step 3: Bivariate Analysis

Now connect the evidence. How do variables relate to each other
and to the target?

### Numeric vs. Target

```python
survived = df.groupby("Survived").mean(numeric_only=True)
print(survived)

fig, axes = plt.subplots(1, 3, figsize=(15, 5))

df.boxplot(column="Age", by="Survived", ax=axes[0])
df.boxplot(column="Fare", by="Survived", ax=axes[1])
df.boxplot(column="Pclass", by="Survived", ax=axes[2])

plt.tight_layout()
plt.show()
```

### Categorical vs. Target

```python
survival_by_sex = pd.crosstab(df["Sex"], df["Survived"], normalize="index")
print(survival_by_sex)

survival_by_class = pd.crosstab(df["Pclass"], df["Survived"], normalize="index")
print(survival_by_class)
```

```
  SURVIVAL BY SEX
  ===============
           Died    Survived
  Female   |###    |#########  ~74% survived
  Male     |#####  |###        ~19% survived

  SURVIVAL BY CLASS
  =================
           Died    Survived
  1st      |###    |######     ~63% survived
  2nd      |#####  |####       ~47% survived
  3rd      |#######|##         ~24% survived
```

---

## Step 4: Correlation Analysis

```python
corr_matrix = df.select_dtypes(include=[np.number]).corr()
print(corr_matrix)

plt.figure(figsize=(10, 8))
sns.heatmap(corr_matrix, annot=True, cmap="coolwarm", center=0,
            fmt=".2f", square=True)
plt.title("Correlation Matrix")
plt.show()
```

```
  CORRELATION STRENGTH GUIDE
  ==========================

  -1.0          -0.5          0.0          +0.5         +1.0
  |=============|=============|=============|============|
  Strong        Moderate      None/Weak     Moderate    Strong
  Negative      Negative                    Positive    Positive

  Examples:
  -0.95  Height vs weight of water displaced (physics)
  -0.30  Exercise frequency vs body fat
   0.00  Shoe size vs intelligence
  +0.45  Study hours vs exam score
  +0.85  Ice cream sales vs temperature
```

---

## Step 5: Missing Data Patterns

A detective notices what is *absent* from the crime scene.

```python
missing = df.isnull().sum()
missing_pct = (missing / len(df) * 100).round(1)
missing_report = missing_pct[missing_pct > 0].sort_values(ascending=False)
print(missing_report)

plt.figure(figsize=(10, 6))
sns.heatmap(df.isnull(), cbar=True, yticklabels=False, cmap="viridis")
plt.title("Missing Data Pattern")
plt.show()
```

```
  MISSING DATA PATTERNS
  =====================

  Random (MCAR)     Systematic (MAR)     Not Random (MNAR)
  .  X  .  .        .  X  .  .           .  .  .  .
  .  .  .  X        .  X  .  .           .  .  .  .
  X  .  .  .        .  .  .  .           X  .  .  .
  .  .  X  .        .  X  .  .           X  .  .  .
  .  .  .  .        .  .  .  .           X  .  .  .

  Scattered          Tied to another      The missing value
  randomly           variable             itself matters
```

---

## Step 6: Outlier Detection

```python
from scipy import stats

for col in numeric_cols:
    q1 = df[col].quantile(0.25)
    q3 = df[col].quantile(0.75)
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    outliers = df[(df[col] < lower) | (df[col] > upper)]
    if len(outliers) > 0:
        print(f"{col}: {len(outliers)} outliers ({len(outliers)/len(df)*100:.1f}%)")
```

```
  BOX PLOT ANATOMY
  ================
                          outliers
                            o  o
         +--------+------+
  -------|   Q1   | Med  |  Q3  |-------
         +--------+------+
         |<--- IQR --->|

  Lower fence = Q1 - 1.5 * IQR
  Upper fence = Q3 + 1.5 * IQR
  Anything outside = potential outlier
```

---

## The EDA Summary Template

After your investigation, write up your findings:

```
  EDA SUMMARY FOR: [Dataset Name]
  ================================
  Rows: ___    Columns: ___

  TARGET VARIABLE: ___
    - Type: classification / regression
    - Balance: ___ / ___

  KEY FINDINGS:
    1. ___
    2. ___
    3. ___

  STRONGEST PREDICTORS:
    1. ___ (correlation: ___)
    2. ___ (correlation: ___)

  DATA ISSUES:
    - Missing: ___
    - Outliers: ___
    - Imbalance: ___

  RECOMMENDED NEXT STEPS:
    1. ___
    2. ___
```

---

## Quick EDA Function

```python
def quick_eda(df, target=None):
    print(f"Shape: {df.shape}")
    print(f"\nData Types:\n{df.dtypes.value_counts()}")
    print(f"\nMissing Values:\n{df.isnull().sum()[df.isnull().sum() > 0]}")
    print(f"\nNumeric Summary:\n{df.describe().round(2)}")

    if target and target in df.columns:
        print(f"\nTarget Distribution:\n{df[target].value_counts()}")
        print(f"\nCorrelations with {target}:")
        numeric_df = df.select_dtypes(include=[np.number])
        if target in numeric_df.columns:
            correlations = numeric_df.corr()[target].drop(target)
            print(correlations.sort_values(ascending=False))

quick_eda(df, target="Survived")
```

---

## Exercises

### Exercise 1: Full EDA on Titanic

Perform a complete EDA on the Titanic dataset:

```python
df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)
```

Tasks:
1. What is the overall survival rate?
2. Which features have the strongest relationship with survival?
3. What are the missing data patterns?
4. Create at least 3 visualizations that reveal insights
5. Fill out the EDA Summary Template above

### Exercise 2: California Housing EDA

```python
from sklearn.datasets import fetch_california_housing

housing = fetch_california_housing(as_frame=True)
df = housing.frame
```

Tasks:
1. This is a regression problem. What is the target variable?
2. Which features correlate most with the target?
3. Are there any outliers that might cause problems?
4. Create a correlation heatmap
5. What feature engineering ideas does the EDA suggest?

### Exercise 3: Write Your Own quick_eda()

Extend the `quick_eda` function to also:
- Plot histograms for all numeric columns
- Plot bar charts for all categorical columns
- Flag columns with more than 30% missing data
- Detect potential outliers using IQR method

---

[Next: Lesson 03 - Feature Engineering -->](03-feature-engineering.md)
