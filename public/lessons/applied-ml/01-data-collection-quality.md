# Lesson 01: Data Collection & Quality

## Garbage In, Garbage Out

Think of building an ML model like cooking a meal. You can have the
best recipe in the world (algorithm), the fanciest kitchen (hardware),
and a Michelin-star chef (you) -- but if your ingredients are rotten,
the dish will be terrible.

```
  FRESH INGREDIENTS          ROTTEN INGREDIENTS
  +---------------+          +---------------+
  |  Clean data   |          | Messy data    |
  |  Complete     |          | Missing vals  |
  |  Accurate     |          | Wrong labels  |
  |  Relevant     |          | Duplicates    |
  +-------+-------+          +-------+-------+
          |                          |
          v                          v
  +---------------+          +---------------+
  |  Great model  |          | Trash model   |
  |  Reliable     |          | Unreliable    |
  |  Trustworthy  |          | Dangerous     |
  +---------------+          +---------------+
```

Your model is only as good as the data you feed it.

---

## Where Does Data Come From?

```
  DATA SOURCES
  ============

  Internal                    External
  +------------------+        +------------------+
  | Databases (SQL)  |        | Public datasets  |
  | Application logs |        | APIs             |
  | User events      |        | Web scraping     |
  | CRM systems      |        | Government data  |
  | Spreadsheets     |        | Purchased data   |
  +------------------+        +------------------+

  Generated
  +------------------+
  | Surveys          |
  | Experiments      |
  | Simulations      |
  | Synthetic data   |
  +------------------+
```

---

## Loading Data in Practice

```python
import pandas as pd
import numpy as np

csv_data = pd.read_csv("customers.csv")

json_data = pd.read_json("events.json")

sql_data = pd.read_sql("SELECT * FROM orders", connection)

excel_data = pd.read_excel("report.xlsx", sheet_name="Q4")

from sklearn.datasets import load_iris
iris = load_iris(as_frame=True)
df = iris.frame
```

---

## The Data Quality Checklist

Before you even think about modeling, run through this checklist.
Think of it as inspecting your ingredients before cooking.

```
  DATA QUALITY CHECKLIST
  ======================
  [ ] Shape: How many rows and columns?
  [ ] Types: Are columns the right data type?
  [ ] Missing: What percentage of values are missing?
  [ ] Duplicates: Are there repeated rows?
  [ ] Ranges: Do numeric values make sense?
  [ ] Categories: Are categorical values consistent?
  [ ] Target: Is the label column clean?
  [ ] Freshness: How old is this data?
  [ ] Bias: Does it represent the real population?
```

---

## Running Quality Checks

```python
import pandas as pd

df = pd.read_csv("customers.csv")

print(f"Shape: {df.shape}")
print(f"Rows: {df.shape[0]}, Columns: {df.shape[1]}")

print(df.dtypes)

print(df.info())

missing = df.isnull().sum()
missing_pct = (missing / len(df)) * 100
print(pd.DataFrame({"missing": missing, "pct": missing_pct}))
```

```
  MISSING DATA HEATMAP (conceptual)

  Feature    0%         50%        100%
  age        |##########|          |     12% missing
  income     |######    |          |     38% missing
  email      |##########|##########|    100% complete
  zip_code   |##########|#######   |     85% complete
```

---

## Checking for Duplicates

```python
print(f"Duplicate rows: {df.duplicated().sum()}")

print(f"Duplicate IDs: {df['customer_id'].duplicated().sum()}")

df_clean = df.drop_duplicates()

df_clean = df.drop_duplicates(subset=["customer_id"], keep="last")
```

---

## Validating Value Ranges

Like checking if your milk has expired -- some values just should not
exist.

```python
print(df.describe())

assert df["age"].between(0, 120).all(), "Invalid ages found!"

assert df["price"].ge(0).all(), "Negative prices found!"

invalid_ages = df[~df["age"].between(0, 120)]
print(f"Found {len(invalid_ages)} invalid age records")
```

---

## Checking Categorical Consistency

```python
print(df["status"].value_counts())

print(df["country"].nunique())

df["status"] = df["status"].str.lower().str.strip()

status_map = {"active": "active", "Active": "active", "ACTIVE": "active"}
df["status"] = df["status"].replace(status_map)
```

```
  BEFORE CLEANUP          AFTER CLEANUP
  ==============          =============
  Active     120          active    245
  active     100          inactive   85
  ACTIVE      25          pending    30
  inactive    60
  Inactive    25
  pending     30
```

---

## Automated Quality Report

```python
def data_quality_report(df):
    report = pd.DataFrame({
        "dtype": df.dtypes,
        "non_null": df.notnull().sum(),
        "null_count": df.isnull().sum(),
        "null_pct": (df.isnull().sum() / len(df) * 100).round(2),
        "unique": df.nunique(),
        "sample": df.iloc[0]
    })
    return report

report = data_quality_report(df)
print(report)
```

---

## Common Data Quality Problems

```
  PROBLEM               SYMPTOM                FIX
  =========             =======                ===
  Missing values        NaN, None, ""          Impute or drop
  Duplicates            Repeated rows          Deduplicate
  Wrong types           "123" as string        Cast types
  Inconsistent cats     "NY", "ny", "New York" Standardize
  Outliers              Age = 999              Validate ranges
  Stale data            2015 records in 2024   Filter by date
  Label errors          Wrong classifications  Manual review
  Leakage               Future info in train   Careful splits
```

---

## Data Leakage: The Silent Killer

Data leakage is like accidentally seeing the answers before an exam.
Your model looks brilliant in testing but fails in production.

```
  LEAKAGE EXAMPLE
  ===============

  Predicting: Will customer churn?

  BAD feature:  "cancellation_date"
                (only exists AFTER they churn!)

  BAD feature:  "support_ticket_resolution"
                (created because they were churning)

  GOOD feature: "days_since_last_login"
                (observable before the event)
```

```python
leakage_suspects = [
    col for col in df.columns
    if df[col].nunique() == df["target"].nunique()
    or df[col].corr(df["target"]) > 0.95
]
print(f"Possible leakage columns: {leakage_suspects}")
```

---

## Sample Size Considerations

```
  HOW MUCH DATA DO YOU NEED?

  Task Complexity          Minimum Rows
  ===============          ============
  Simple (2-3 features)    100-500
  Medium (10-20 features)  1,000-10,000
  Complex (100+ features)  10,000-100,000
  Deep learning            100,000+

  Rule of thumb: 10x samples per feature
  (at minimum)
```

---

## Exercises

### Exercise 1: Quality Audit

Download the Titanic dataset and run a full quality audit.

```python
import pandas as pd

df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)
```

Tasks:
1. Print the shape and data types
2. Calculate missing value percentages for each column
3. Find and remove duplicate rows
4. Identify columns with suspicious value ranges
5. Check categorical columns for inconsistencies
6. Write a `data_quality_report()` function and run it

### Exercise 2: Leakage Detection

Given this feature list for a loan default prediction model, identify
which features might cause data leakage:

- `credit_score` (at time of application)
- `loan_amount`
- `collection_agency_assigned`
- `annual_income`
- `number_of_late_payments`
- `bankruptcy_filed_date`
- `employment_length`

### Exercise 3: Data Source Comparison

Load the same dataset from CSV and JSON formats. Verify they produce
identical DataFrames:

```python
df_csv = pd.read_csv("data.csv")
df_json = pd.read_json("data.json")
assert df_csv.equals(df_json), "DataFrames differ!"
```

---

[Next: Lesson 02 - Exploratory Data Analysis -->](02-exploratory-data-analysis.md)
