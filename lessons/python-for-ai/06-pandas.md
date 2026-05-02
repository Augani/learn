# Lesson 06: Pandas

> Pandas is like Excel for programmers.
> You get rows, columns, formulas, and pivots - but scriptable and reproducible.

---

## Series and DataFrames

A Series is a single column. A DataFrame is a table of columns.
Think of a DataFrame like a filing cabinet: each drawer (column)
holds one type of document, and every document has the same row number.

**Analogy — a spreadsheet that remembers everything:**

Imagine a smart spreadsheet. In Excel, you click cells, type formulas, and pray you don't overwrite something. In pandas, every operation creates a RECORD of what you did. You can chain operations like a recipe: "take the data → filter rows → group by category → compute averages → sort descending." If something goes wrong, you can see exactly which step broke.

The key mental model: a DataFrame is NOT just a table. It's a **table with superpowers**:
- Every column has a strict type (no mixing strings and numbers accidentally)
- Every row has an index (like a primary key in a database)
- Operations return NEW DataFrames (the original is preserved, like git commits)

```
NumPy array:               Pandas DataFrame:
  Just numbers               Numbers + labels + types
  [[1, 2, 3],               name    score   dept
   [4, 5, 6]]               Alice   85      ML
                             Bob     92      NLP

  Access: arr[0, 1]          Access: df.loc["Alice", "score"]
  No labels. No types.       Labels, types, and missing value handling.
  Fast math on blocks.       Fast math on labeled, heterogeneous data.
```

**When to use NumPy vs Pandas:**
- Pure numerical computation (matrices, linear algebra, neural nets) → **NumPy**
- Labeled, mixed-type data with missing values (CSV files, experiment logs, feature engineering) → **Pandas**

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

### Join Types Visualized

**Analogy — matching students to test scores:**

You have two lists: a class roster (names) and a grade sheet (names + scores). Some students on the roster didn't take the test. Some scores belong to students who transferred out.

```
  Roster:     [Alice, Bob, Carol]
  Grades:     [Bob: 92, Carol: 85, Dave: 78]

  INNER JOIN (only matches):
  ┌─────────────────────────┐
  │    Roster    │  Grades   │
  │  ┌───────┐  │           │
  │  │ Alice │  │           │
  │  │       │ ╔═══════════╗│
  │  │  Bob ─┼─║─ Bob: 92  ║│
  │  │ Carol ┼─║─Carol: 85 ║│
  │  │       │ ║ Dave: 78  ║│
  │  └───────┘ ╚═══════════╝│
  └─────────────────────────┘
  Result: Bob (92), Carol (85)  ← only students in BOTH lists

  LEFT JOIN (all from left):
  Result: Alice (NaN), Bob (92), Carol (85)  ← all roster students

  OUTER JOIN (everyone):
  Result: Alice (NaN), Bob (92), Carol (85), Dave (78)  ← everyone
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

### Why Method Chaining Matters: Debugging and Reproducibility

**Analogy — a cooking recipe vs ad-hoc cooking:**

Without method chaining, your data pipeline looks like a messy kitchen — ingredients everywhere, half-finished steps, no clear order. WITH chaining, it reads like a recipe: step 1, step 2, step 3. If the dish tastes wrong, you can pinpoint exactly which step to fix.

```
Without chaining (hard to debug):
  df2 = df[df["valid"] == True]
  df3 = df2.copy()
  df3["efficiency"] = df3["score"] / df3["latency"]
  df4 = df3.groupby("model").agg(avg=("score", "mean"))
  result = df4.sort_values("avg", ascending=False)
  # 5 intermediate variables. Which one broke?

With chaining (clear pipeline):
  result = (
      df
      .query("valid == True")
      .assign(efficiency=lambda x: x["score"] / x["latency"])
      .groupby("model")
      .agg(avg=("score", "mean"))
      .sort_values("avg", ascending=False)
  )
  # One pipeline. Comment out any line to debug.
```

### Performance: When Pandas Gets Slow

Pandas is single-threaded and operates in memory. Here's when it breaks:

```
Data size guide:
  < 100MB    → Pandas is great. No worries.
  100MB - 1GB → Pandas works but watch memory (2-5x data size)
  1GB - 10GB  → Consider chunking or Polars
  > 10GB      → Use Spark, DuckDB, or Polars

Common performance traps:
  ✗ Looping with iterrows()        → 100x slower than vectorized
  ✗ apply(func, axis=1)            → Still a Python loop under the hood
  ✓ Vectorized operations           → Uses C/NumPy, fast
  ✓ .query() for filtering          → Optimized, avoids temp arrays

  # SLOW (Python loop):
  for idx, row in df.iterrows():
      df.loc[idx, "new"] = row["a"] * 2

  # FAST (vectorized):
  df["new"] = df["a"] * 2
  # 100x faster for 1M rows
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

### Why Parquet Over CSV?

**Analogy — a filing cabinet vs a text file:**

CSV is like writing everything on a long scroll of paper. To find one column, you have to read the entire scroll. Parquet is like a filing cabinet with labeled drawers — you can pull out just the drawer you need.

```
CSV:                          Parquet:
  Row-oriented                  Column-oriented
  name,score,dept               name: [Alice,Bob,Carol...]
  Alice,85,ML                   score: [85,92,78...]
  Bob,92,NLP                    dept: [ML,NLP,ML...]
  Carol,78,ML

  Read "score" column:          Read "score" column:
  → read ENTIRE file            → read ONLY the score block
  → parse every row             → skip name and dept entirely

  1GB CSV of 50 columns →       1GB Parquet, read 1 column →
  reads 1GB                      reads ~20MB (1/50th)

  Also: Parquet compresses 5-10x better than CSV
  Also: Parquet preserves exact types (no "is 42 a string or int?")
```

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
