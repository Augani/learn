# Lesson 06: Pandas

> Pandas is like Excel for programmers.
> You get rows, columns, formulas, and pivots - but scriptable and reproducible.

---

## Series and DataFrames

A Series is a single column. A DataFrame is a table of columns.
Think of a DataFrame like a filing cabinet: each drawer (column)
holds one type of document, and every document has the same row number.

```python
import pandas as pd
import numpy as np

scores = pd.Series([85, 92, 78, 95, 88], name="score")
print(scores)
print(f"Mean: {scores.mean()}, Max: {scores.max()}")
```

```python
import pandas as pd

df = pd.DataFrame({
    "name": ["Alice", "Bob", "Carol", "Dave", "Eve"],
    "score": [85, 92, 78, 95, 88],
    "department": ["ML", "NLP", "ML", "CV", "NLP"],
    "years": [3, 5, 2, 7, 4],
})
print(df)
print(f"\nShape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print(f"Dtypes:\n{df.dtypes}")
```

```
  DataFrame anatomy:
  ┌───────┬───────┬────────────┬───────┐
  │ name  │ score │ department │ years │  <- columns
  ├───────┼───────┼────────────┼───────┤
  │ Alice │  85   │     ML     │   3   │  <- row (index 0)
  │ Bob   │  92   │     NLP    │   5   │  <- row (index 1)
  │ Carol │  78   │     ML     │   2   │  <- row (index 2)
  │ Dave  │  95   │     CV     │   7   │  <- row (index 3)
  │ Eve   │  88   │     NLP    │   4   │  <- row (index 4)
  └───────┴───────┴────────────┴───────┘
```

---

## Reading Data

```python
import pandas as pd

df_csv = pd.read_csv("data.csv")
df_json = pd.read_json("data.json")
df_parquet = pd.read_parquet("data.parquet")

print(df_csv.head())
print(df_csv.info())
print(df_csv.describe())
```

### Quick Exploration

```python
import pandas as pd
import numpy as np

rng = np.random.default_rng(42)
df = pd.DataFrame({
    "feature_a": rng.standard_normal(1000),
    "feature_b": rng.integers(0, 100, 1000),
    "label": rng.choice(["cat", "dog", "bird"], 1000),
    "score": rng.uniform(0, 1, 1000),
})

print(df.head())
print(df.describe())
print(df["label"].value_counts())
print(df.isnull().sum())
```

---

## Selecting Data

Three ways to access data. Like three different ways to find a
book: by its position on the shelf, by its label, or by a condition.

```python
import pandas as pd

df = pd.DataFrame({
    "model": ["bert", "gpt2", "t5", "roberta", "distilbert"],
    "params_m": [110, 1500, 220, 125, 66],
    "accuracy": [0.89, 0.92, 0.91, 0.90, 0.87],
    "task": ["cls", "gen", "seq2seq", "cls", "cls"],
})

print(df["model"])
print(df[["model", "accuracy"]])

print(df.loc[0])
print(df.loc[0:2, ["model", "accuracy"]])

print(df.iloc[0])
print(df.iloc[0:2, 0:2])
```

### Boolean Filtering

Like SQL WHERE clauses, but in Python.

```python
import pandas as pd

df = pd.DataFrame({
    "model": ["bert", "gpt2", "t5", "roberta", "distilbert"],
    "params_m": [110, 1500, 220, 125, 66],
    "accuracy": [0.89, 0.92, 0.91, 0.90, 0.87],
    "task": ["cls", "gen", "seq2seq", "cls", "cls"],
})

big_models = df[df["params_m"] > 100]
print(big_models)

good_classifiers = df[(df["task"] == "cls") & (df["accuracy"] > 0.88)]
print(good_classifiers)

nlp_models = df[df["model"].isin(["bert", "gpt2", "roberta"])]
print(nlp_models)
```

---

## Data Cleaning

Real-world data is messy. Like sorting through a box of old receipts -
some are torn, some are duplicates, some have coffee stains.

```python
import pandas as pd
import numpy as np

df = pd.DataFrame({
    "name": ["Alice", "Bob", None, "Dave", "Eve", "Bob"],
    "score": [85, 92, 78, np.nan, 88, 92],
    "grade": ["A", "A+", "B", "A+", "A", "A+"],
})

print(f"Nulls:\n{df.isnull().sum()}\n")

df_clean = df.dropna()
print(f"After dropna:\n{df_clean}\n")

df_filled = df.fillna({"name": "Unknown", "score": df["score"].mean()})
print(f"After fillna:\n{df_filled}\n")

df_deduped = df.drop_duplicates(subset=["name"], keep="first")
print(f"After dedup:\n{df_deduped}")
```

### Type Conversion and String Operations

```python
import pandas as pd

df = pd.DataFrame({
    "price": ["$10.50", "$20.30", "$5.99"],
    "date": ["2024-01-15", "2024-02-20", "2024-03-10"],
    "name": ["  Alice  ", "BOB", "carol"],
})

df["price_clean"] = df["price"].str.replace("$", "", regex=False).astype(float)
df["date"] = pd.to_datetime(df["date"])
df["name"] = df["name"].str.strip().str.title()

print(df)
print(df.dtypes)
```

---

## Creating New Columns

```python
import pandas as pd
import numpy as np

df = pd.DataFrame({
    "model": ["bert", "gpt2", "t5"],
    "train_loss": [0.15, 0.08, 0.12],
    "val_loss": [0.22, 0.18, 0.20],
    "train_time_hrs": [4.5, 12.0, 8.0],
})

df["overfit_ratio"] = df["val_loss"] / df["train_loss"]

df["efficiency"] = np.where(
    df["train_time_hrs"] < 6,
    "fast",
    "slow",
)

df["loss_diff"] = df["val_loss"] - df["train_loss"]

print(df)
```

### Apply for Complex Transforms

```python
import pandas as pd

df = pd.DataFrame({
    "model": ["bert-base", "gpt2-large", "t5-small"],
    "params_m": [110, 774, 60],
})

def classify_size(row):
    if row["params_m"] > 500:
        return "large"
    if row["params_m"] > 100:
        return "medium"
    return "small"

df["size_class"] = df.apply(classify_size, axis=1)
print(df)
```

---

## GroupBy: Split-Apply-Combine

GroupBy is like sorting exam papers into piles by class,
grading each pile separately, then stacking them back together.

```
  Split          Apply          Combine
  ┌────────┐    ┌────────┐    ┌────────┐
  │ ML: 85 │    │ ML:    │    │ ML: 81 │
  │ ML: 78 │───>│ mean() │───>│ NLP: 90│
  │ NLP: 92│    │ = 81.5 │    │ CV: 95 │
  │ NLP: 88│    │        │    └────────┘
  │ CV: 95 │    │ NLP:   │
  └────────┘    │ mean() │
                │ = 90   │
                └────────┘
```

```python
import pandas as pd

df = pd.DataFrame({
    "department": ["ML", "NLP", "ML", "CV", "NLP", "CV", "ML"],
    "employee": ["A", "B", "C", "D", "E", "F", "G"],
    "score": [85, 92, 78, 95, 88, 91, 90],
    "years": [3, 5, 2, 7, 4, 6, 1],
})

dept_stats = df.groupby("department").agg(
    avg_score=("score", "mean"),
    max_score=("score", "max"),
    headcount=("employee", "count"),
    avg_years=("years", "mean"),
)
print(dept_stats)

dept_scores = df.groupby("department")["score"].describe()
print(dept_scores)
```

### Multi-Level GroupBy

```python
import pandas as pd
import numpy as np

rng = np.random.default_rng(42)
df = pd.DataFrame({
    "model": rng.choice(["bert", "gpt2"], 100),
    "dataset": rng.choice(["squad", "glue", "wnli"], 100),
    "accuracy": rng.uniform(0.7, 0.99, 100),
    "latency_ms": rng.uniform(10, 200, 100),
})

summary = df.groupby(["model", "dataset"]).agg(
    mean_acc=("accuracy", "mean"),
    mean_latency=("latency_ms", "mean"),
    runs=("accuracy", "count"),
).round(3)
print(summary)
```

---

## Merge and Join

Merging DataFrames is like matching puzzle pieces.
Each row finds its partner based on a shared key.

```python
import pandas as pd

models = pd.DataFrame({
    "model_id": [1, 2, 3],
    "name": ["bert", "gpt2", "t5"],
    "type": ["encoder", "decoder", "seq2seq"],
})

metrics = pd.DataFrame({
    "model_id": [1, 2, 2, 3, 4],
    "dataset": ["squad", "wikitext", "lambada", "cnn", "imdb"],
    "score": [0.89, 0.92, 0.88, 0.91, 0.85],
})

inner = pd.merge(models, metrics, on="model_id", how="inner")
print(f"Inner join:\n{inner}\n")

left = pd.merge(models, metrics, on="model_id", how="left")
print(f"Left join:\n{left}\n")

outer = pd.merge(models, metrics, on="model_id", how="outer")
print(f"Outer join:\n{outer}")
```

```
  Join Types:
  ─────────────────────────────────────────────────
  inner  Only matching rows from both sides
  left   All rows from left, matching from right
  right  All rows from right, matching from left
  outer  All rows from both sides
```

---

## Pivot Tables

Like creating a summary report. Rows become one dimension,
columns become another, and values get aggregated.

```python
import pandas as pd
import numpy as np

rng = np.random.default_rng(42)
df = pd.DataFrame({
    "model": rng.choice(["bert", "gpt2", "t5"], 50),
    "metric": rng.choice(["accuracy", "f1", "latency"], 50),
    "value": rng.uniform(0, 1, 50),
})

pivot = df.pivot_table(
    values="value",
    index="model",
    columns="metric",
    aggfunc="mean",
).round(3)
print(pivot)
```

---

## Method Chaining

Pandas supports method chaining for clean, readable pipelines.
Like an assembly line where each station does one thing.

```python
import pandas as pd
import numpy as np

rng = np.random.default_rng(42)
df = pd.DataFrame({
    "model": rng.choice(["bert", "gpt2", "t5", "roberta"], 200),
    "score": rng.uniform(0.5, 1.0, 200),
    "latency": rng.uniform(10, 500, 200),
    "valid": rng.choice([True, False], 200, p=[0.9, 0.1]),
})

result = (
    df
    .query("valid == True")
    .assign(efficiency=lambda x: x["score"] / x["latency"])
    .groupby("model")
    .agg(
        avg_score=("score", "mean"),
        avg_efficiency=("efficiency", "mean"),
        count=("score", "count"),
    )
    .sort_values("avg_efficiency", ascending=False)
    .round(4)
)
print(result)
```

---

## Saving Data

```python
import pandas as pd

df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

df.to_csv("output.csv", index=False)
df.to_parquet("output.parquet")
df.to_json("output.json", orient="records")
```

Parquet is best for ML: smaller files, preserves types, fast reads.

---

## Exercises

1. **Data Cleaning Pipeline**: Create a DataFrame with intentional
   problems (nulls, duplicates, wrong types, whitespace in strings).
   Write a cleaning pipeline using method chaining that fixes everything.

2. **GroupBy Analysis**: Generate a DataFrame of 1000 "experiment results"
   with columns: model, dataset, metric, value, timestamp. GroupBy
   model and dataset, compute mean/std/min/max of values.

3. **Merge Challenge**: Create three DataFrames (users, orders, products).
   Perform a multi-table join to answer: "What is the total spending
   per user, broken down by product category?"

4. **Pivot Report**: From experiment data, create a pivot table showing
   models as rows, metrics as columns, with mean values. Add a column
   for the "best metric" per model.

5. **Real Data**: Download any CSV from kaggle.com. Load it, explore
   with `describe()`, clean missing values, create 2 new derived columns,
   and group by a categorical column for summary stats.

---

[Next: Lesson 07 - Matplotlib & Visualization ->](07-matplotlib-visualization.md)
