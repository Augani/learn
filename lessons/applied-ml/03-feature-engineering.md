# Lesson 03: Feature Engineering

## Giving the Right Clues to a Detective

Imagine you are helping a detective solve a case. You could hand them
a pile of raw surveillance footage (raw data), or you could give them
a summary: "Suspect entered at 3pm, stayed 47 minutes, left through
the back door" (engineered features).

Both contain the same information, but the detective solves the case
much faster with the right clues.

```
  RAW DATA                    ENGINEERED FEATURES
  ========                    ===================
  timestamp: 2024-03-15       day_of_week: Friday
  14:30:00                    hour: 14
                              is_weekend: False
                              is_business_hours: True

  birth_date: 1990-05-20      age: 34
                              age_group: "30-39"
                              is_millennial: True

  lat: 40.7128                distance_to_store: 2.3km
  lon: -74.0060               neighborhood: "downtown"
```

Feature engineering is the art of transforming raw data into inputs
that help your model see patterns clearly.

---

## Why Features Matter More Than Algorithms

```
  MODEL PERFORMANCE BREAKDOWN
  ===========================

  |##################################|  Feature Quality (70%)
  |############|                        Algorithm Choice (20%)
  |####|                                Hyperparameter Tuning (10%)

  A simple model with great features beats
  a complex model with bad features. Every time.
```

---

## Numeric Transformations

### Creating New Features from Existing Ones

```python
import pandas as pd
import numpy as np

df = pd.DataFrame({
    "length": [10, 20, 15, 25],
    "width": [5, 8, 6, 10],
    "price": [100, 250, 150, 400],
    "quantity": [2, 5, 3, 8]
})

df["area"] = df["length"] * df["width"]

df["price_per_unit"] = df["price"] / df["quantity"]

df["log_price"] = np.log1p(df["price"])

df["price_squared"] = df["price"] ** 2
```

### Binning Continuous Variables

Turn a number into a category when the exact value matters less
than the range.

```python
df["age"] = [22, 35, 48, 67, 15, 55, 29, 71]

df["age_group"] = pd.cut(
    df["age"],
    bins=[0, 18, 30, 50, 65, 100],
    labels=["minor", "young_adult", "middle_aged", "senior", "elderly"]
)

df["age_quartile"] = pd.qcut(df["age"], q=4, labels=["Q1", "Q2", "Q3", "Q4"])
```

```
  BINNING VISUALIZED
  ==================

  Continuous:  15  22  29  35  48  55  67  71
               |   |   |   |   |   |   |   |
  Bins:     [minor][young ][ middle ][ senior][elderly]
            0---18  18--30  30----50  50---65  65--100
```

---

## Date and Time Features

Dates are gold mines for feature engineering. A single timestamp
can generate dozens of useful features.

```python
df = pd.DataFrame({
    "order_date": pd.to_datetime([
        "2024-01-15 14:30:00",
        "2024-03-22 09:15:00",
        "2024-07-04 18:45:00",
        "2024-12-25 11:00:00"
    ])
})

df["year"] = df["order_date"].dt.year
df["month"] = df["order_date"].dt.month
df["day_of_week"] = df["order_date"].dt.dayofweek
df["hour"] = df["order_date"].dt.hour
df["is_weekend"] = df["order_date"].dt.dayofweek >= 5
df["quarter"] = df["order_date"].dt.quarter
df["day_of_year"] = df["order_date"].dt.dayofyear

df["is_holiday"] = df["order_date"].dt.date.isin([
    pd.Timestamp("2024-07-04").date(),
    pd.Timestamp("2024-12-25").date()
])
```

```
  ONE TIMESTAMP --> MANY FEATURES
  ===============================

  "2024-07-04 18:45:00"
        |
        +---> year: 2024
        +---> month: 7
        +---> day_of_week: 3 (Thursday)
        +---> hour: 18
        +---> is_weekend: False
        +---> is_evening: True
        +---> quarter: Q3
        +---> is_holiday: True
        +---> days_since_last_order: 104
```

---

## Text Features

```python
df = pd.DataFrame({
    "review": [
        "Great product, love it!",
        "Terrible quality, broke on day one.",
        "OK for the price, nothing special.",
        "AMAZING! Best purchase ever!!!"
    ]
})

df["word_count"] = df["review"].str.split().str.len()
df["char_count"] = df["review"].str.len()
df["has_exclamation"] = df["review"].str.contains("!").astype(int)
df["uppercase_ratio"] = df["review"].apply(
    lambda x: sum(1 for c in x if c.isupper()) / len(x)
)
df["avg_word_length"] = df["review"].apply(
    lambda x: np.mean([len(w) for w in x.split()])
)
```

---

## Aggregation Features

When you have multiple records per entity, aggregate them into
meaningful summaries.

```python
transactions = pd.DataFrame({
    "customer_id": [1, 1, 1, 2, 2, 3, 3, 3, 3],
    "amount": [50, 120, 30, 200, 150, 10, 20, 15, 25],
    "category": ["food", "tech", "food", "tech", "tech",
                 "food", "food", "food", "food"]
})

customer_features = transactions.groupby("customer_id").agg(
    total_spend=("amount", "sum"),
    avg_spend=("amount", "mean"),
    max_spend=("amount", "max"),
    num_transactions=("amount", "count"),
    num_categories=("category", "nunique"),
    std_spend=("amount", "std")
).reset_index()

customer_features["std_spend"] = customer_features["std_spend"].fillna(0)
```

```
  RAW TRANSACTIONS        AGGREGATED FEATURES
  ================        ===================
  cust  amount  cat       cust  total  avg  max  n_txn  n_cat
  1     50      food      1     200    67   120  3      2
  1     120     tech      2     350    175  200  2      1
  1     30      food      3     70     18   25   4      1
  2     200     tech
  2     150     tech
  3     10      food
  ...
```

---

## Interaction Features

Sometimes the relationship between two features matters more than
either feature alone.

```python
df = pd.DataFrame({
    "bedrooms": [2, 3, 4, 2, 5],
    "bathrooms": [1, 2, 2, 1, 3],
    "sqft": [1000, 1500, 2000, 900, 3000],
    "lot_size": [5000, 7000, 10000, 4000, 15000]
})

df["bed_bath_ratio"] = df["bedrooms"] / df["bathrooms"].replace(0, 1)
df["sqft_per_bedroom"] = df["sqft"] / df["bedrooms"]
df["house_lot_ratio"] = df["sqft"] / df["lot_size"]
df["total_rooms"] = df["bedrooms"] + df["bathrooms"]
```

---

## Polynomial Features (Use Sparingly)

```python
from sklearn.preprocessing import PolynomialFeatures

X = df[["bedrooms", "sqft"]].values

poly = PolynomialFeatures(degree=2, include_bias=False, interaction_only=False)
X_poly = poly.fit_transform(X)
feature_names = poly.get_feature_names_out(["bedrooms", "sqft"])
print(feature_names)
```

```
  POLYNOMIAL EXPLOSION WARNING
  ============================

  Features  Degree  Output Features
  2         2       5
  5         2       20
  10        2       65
  10        3       285
  20        2       230

  More features != better model
  Use domain knowledge, not brute force
```

---

## Feature Engineering Pipeline

```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

def create_features(df):
    df = df.copy()
    df["family_size"] = df["SibSp"] + df["Parch"] + 1
    df["is_alone"] = (df["family_size"] == 1).astype(int)
    df["fare_per_person"] = df["Fare"] / df["family_size"]
    df["title"] = df["Name"].str.extract(r" ([A-Za-z]+)\.")
    df["title"] = df["title"].replace(
        ["Lady", "Countess", "Capt", "Col", "Don", "Dr",
         "Major", "Rev", "Sir", "Jonkheer", "Dona"], "Rare"
    )
    df["title"] = df["title"].replace(["Mlle", "Ms"], "Miss")
    df["title"] = df["title"].replace("Mme", "Mrs")
    return df
```

---

## Feature Selection After Engineering

More features is not always better. After creating features, prune
the weak ones.

```python
from sklearn.feature_selection import mutual_info_classif

X = df[feature_columns]
y = df["target"]

mi_scores = mutual_info_classif(X, y, random_state=42)
mi_ranking = pd.Series(mi_scores, index=feature_columns).sort_values(ascending=False)
print(mi_ranking)

threshold = 0.01
useful_features = mi_ranking[mi_ranking > threshold].index.tolist()
```

---

## Exercises

### Exercise 1: Titanic Feature Engineering

```python
df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)
```

Create these features:
1. `family_size` = SibSp + Parch + 1
2. `is_alone` = 1 if family_size == 1
3. `title` extracted from Name
4. `fare_per_person` = Fare / family_size
5. `age_group` binned into categories
6. `deck` extracted from Cabin (first letter)

### Exercise 2: E-Commerce Features

Given this transaction data, create customer-level features:

```python
orders = pd.DataFrame({
    "customer_id": [1,1,1,2,2,3,3,3,3,3],
    "order_date": pd.to_datetime([
        "2024-01-10", "2024-02-15", "2024-03-20",
        "2024-01-05", "2024-06-10",
        "2024-01-01", "2024-01-15", "2024-02-01",
        "2024-02-15", "2024-03-01"
    ]),
    "amount": [50, 75, 120, 200, 30, 10, 15, 20, 25, 30],
    "category": ["A","B","A","C","C","A","A","B","A","B"]
})
```

Create: `total_spend`, `avg_order_value`, `days_as_customer`,
`avg_days_between_orders`, `favorite_category`, `order_frequency`

### Exercise 3: Feature Impact

Take the Titanic dataset with your engineered features. Train a
simple `DecisionTreeClassifier` and compare accuracy with vs.
without your new features. Which features helped most?

---

[Next: Lesson 04 - Handling Messy Data -->](04-handling-messy-data.md)
