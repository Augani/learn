# Lesson 10: Data Quality & Validation

## The Restaurant Health Inspector

Your data pipeline is a restaurant kitchen. Data quality checks are
the health inspector who visits to make sure nothing makes anyone sick.

```
  WITHOUT DATA QUALITY:          WITH DATA QUALITY:
  +--------+    +--------+       +--------+  +------+  +--------+
  | Raw    | -> | Model  |       | Raw    |->|CHECK |->| Model  |
  | Data   |    | trains |       | Data   |  |POINT |  | trains |
  | (???)  |    | on ???)|       | (known)|  +------+  | (safe) |
  +--------+    +--------+       +--------+            +--------+
  Bad data in = bad model out    Catch problems BEFORE they spread
```

---

## The Five Dimensions of Data Quality

```
  +---------------+--------------------------------------------+
  | Dimension     | Question It Answers                        |
  +---------------+--------------------------------------------+
  | Completeness  | Is all expected data present?              |
  | Accuracy      | Does data match reality?                   |
  | Consistency   | Do related values agree?                   |
  | Timeliness    | Is data fresh enough?                      |
  | Uniqueness    | Are there duplicates?                      |
  +---------------+--------------------------------------------+

  Think of a shipping manifest:
  +---------------+--------------------------------------------+
  | Completeness  | Are all 100 boxes listed?                  |
  | Accuracy      | Do weights match actual boxes?             |
  | Consistency   | Does total = sum of individual weights?    |
  | Timeliness    | Is this today's manifest, not last week's? |
  | Uniqueness    | Is each box listed only once?              |
  +---------------+--------------------------------------------+
```

---

## Great Expectations

The standard library for data validation. Define "expectations" about
your data, then run them against actual datasets.

```python
import great_expectations as gx

context = gx.get_context()

datasource = context.sources.add_pandas("my_datasource")
data_asset = datasource.add_dataframe_asset(name="orders")

batch_request = data_asset.build_batch_request(dataframe=orders_df)

expectation_suite = context.add_expectation_suite("orders_suite")
validator = context.get_validator(
    batch_request=batch_request,
    expectation_suite_name="orders_suite"
)

validator.expect_column_to_exist("order_id")
validator.expect_column_to_exist("user_id")
validator.expect_column_to_exist("amount")

validator.expect_column_values_to_not_be_null("order_id")
validator.expect_column_values_to_not_be_null("user_id")

validator.expect_column_values_to_be_unique("order_id")

validator.expect_column_values_to_be_between("amount", min_value=0, max_value=100000)

validator.expect_column_values_to_be_in_set(
    "status", ["pending", "completed", "cancelled", "refunded"]
)

validator.expect_table_row_count_to_be_between(min_value=1000, max_value=1000000)

results = validator.validate()
print(f"Success: {results.success}")
print(f"Results: {results.statistics}")
```

---

## Schema Validation

Catch structural problems before they cause downstream failures:

```python
import pandera as pa
import pandas as pd

schema = pa.DataFrameSchema({
    "order_id": pa.Column(str, nullable=False, unique=True),
    "user_id": pa.Column(int, nullable=False, checks=pa.Check.gt(0)),
    "amount": pa.Column(
        float,
        nullable=False,
        checks=[
            pa.Check.ge(0),
            pa.Check.le(100000),
        ]
    ),
    "status": pa.Column(
        str,
        nullable=False,
        checks=pa.Check.isin(["pending", "completed", "cancelled"])
    ),
    "order_date": pa.Column(pd.Timestamp, nullable=False),
})

try:
    validated_df = schema.validate(raw_df)
    print("Schema validation passed")
except pa.errors.SchemaError as exc:
    print(f"Validation failed: {exc}")
    print(f"Failure cases:\n{exc.failure_cases}")
```

```
  SCHEMA VALIDATION FLOW:
  +----------+    +--------+    +----------+    +----------+
  | Raw Data | -> | Schema | -> | Valid    | -> | Pipeline |
  |          |    | Check  |    | Data     |    | continues|
  +----------+    +---+----+    +----------+    +----------+
                      |
                      | FAIL
                      v
                  +--------+
                  | Alert  |
                  | Quarant|
                  | Log    |
                  +--------+
```

---

## Statistical Data Quality

Detect anomalies that pass schema checks but are still wrong:

```python
import pandas as pd
import numpy as np

class DataQualityMonitor:
    def __init__(self, baseline_stats):
        self.baseline = baseline_stats

    @staticmethod
    def compute_stats(df, column):
        return {
            "mean": df[column].mean(),
            "std": df[column].std(),
            "min": df[column].min(),
            "max": df[column].max(),
            "null_pct": df[column].isnull().mean(),
            "unique_count": df[column].nunique(),
            "p5": df[column].quantile(0.05),
            "p95": df[column].quantile(0.95),
        }

    def check_drift(self, df, column, threshold=3.0):
        current = self.compute_stats(df, column)
        baseline = self.baseline[column]
        alerts = []

        mean_diff = abs(current["mean"] - baseline["mean"])
        if mean_diff > threshold * baseline["std"]:
            alerts.append(
                f"Mean drift: {baseline['mean']:.2f} -> {current['mean']:.2f}"
            )

        if current["null_pct"] > baseline["null_pct"] * 2:
            alerts.append(
                f"Null spike: {baseline['null_pct']:.1%} -> {current['null_pct']:.1%}"
            )

        if current["unique_count"] < baseline["unique_count"] * 0.5:
            alerts.append(
                f"Cardinality drop: {baseline['unique_count']} -> {current['unique_count']}"
            )

        return alerts

baseline_df = pd.read_parquet("historical_orders.parquet")
monitor = DataQualityMonitor({
    "amount": DataQualityMonitor.compute_stats(baseline_df, "amount"),
    "user_id": DataQualityMonitor.compute_stats(baseline_df, "user_id"),
})

today_df = pd.read_parquet("today_orders.parquet")
for col in ["amount", "user_id"]:
    alerts = monitor.check_drift(today_df, col)
    if alerts:
        print(f"ALERT for {col}:")
        for alert in alerts:
            print(f"  - {alert}")
```

---

## dbt Tests for Data Quality

```yaml
# models/marts/_schema.yml

version: 2

models:
  - name: fct_orders
    tests:
      - dbt_utils.recency:
          datepart: day
          field: order_date
          interval: 1
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: amount
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: user_id
        tests:
          - not_null
          - relationships:
              to: ref('dim_users')
              field: user_key
```

Custom dbt test for row count stability:

```sql
-- tests/generic/row_count_stability.sql

{% test row_count_stability(model, min_rows, max_deviation_pct=20) %}

WITH current_count AS (
    SELECT COUNT(*) AS cnt FROM {{ model }}
),
expected AS (
    SELECT {{ min_rows }} AS min_expected
)

SELECT cnt
FROM current_count, expected
WHERE cnt < min_expected
   OR cnt > min_expected * (1 + {{ max_deviation_pct }} / 100.0)

{% endtest %}
```

---

## Data Quality Pipeline Pattern

```
  +----------+    +---------+    +---------+    +----------+
  | Extract  | -> | Validate| -> |Transform| -> | Validate |
  |          |    | Input   |    |         |    | Output   |
  +----------+    +----+----+    +---------+    +-----+----+
                       |                              |
                       v                              v
                  +----+----+                    +----+----+
                  |Quarantin|                    |Quarantin|
                  |bad rows |                    |bad rows |
                  +---------+                    +---------+
```

```python
from dataclasses import dataclass
from typing import Callable
import pandas as pd

@dataclass
class QualityCheck:
    name: str
    check_fn: Callable[[pd.DataFrame], pd.DataFrame]
    severity: str

class DataQualityGate:
    def __init__(self):
        self.checks = []
        self.results = []

    def add_check(self, name, check_fn, severity="error"):
        self.checks.append(QualityCheck(name, check_fn, severity))

    def run(self, df):
        failures = []
        for check in self.checks:
            bad_rows = check.check_fn(df)
            if len(bad_rows) > 0:
                failures.append({
                    "check": check.name,
                    "severity": check.severity,
                    "failed_rows": len(bad_rows),
                    "sample": bad_rows.head(5).to_dict(),
                })
        self.results = failures
        return failures

    def should_halt(self):
        return any(f["severity"] == "error" for f in self.results)


gate = DataQualityGate()
gate.add_check(
    "no_null_ids",
    lambda df: df[df["order_id"].isnull()],
    severity="error"
)
gate.add_check(
    "positive_amounts",
    lambda df: df[df["amount"] < 0],
    severity="error"
)
gate.add_check(
    "reasonable_amounts",
    lambda df: df[df["amount"] > 50000],
    severity="warning"
)
gate.add_check(
    "recent_dates",
    lambda df: df[pd.to_datetime(df["order_date"]) < "2020-01-01"],
    severity="warning"
)

failures = gate.run(orders_df)

if gate.should_halt():
    raise ValueError(f"Critical quality failures: {failures}")
else:
    for f in failures:
        print(f"WARNING: {f['check']} - {f['failed_rows']} rows")
```

---

## Freshness Monitoring

```
  Is our data current?

  Source DB      Pipeline      Warehouse
  +--------+    +--------+    +--------+
  | 10:00  | -> | 10:15  | -> | 10:30  |
  | latest |    | last   |    | latest |
  | record |    | run    |    | record |
  +--------+    +--------+    +--------+

  Freshness = NOW - latest record timestamp
  If freshness > threshold -> ALERT
```

```python
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text

def check_freshness(engine, table, timestamp_col, max_delay_hours):
    with engine.connect() as conn:
        result = conn.execute(
            text(f"SELECT MAX({timestamp_col}) FROM {table}")
        )
        latest = result.scalar()

    if latest is None:
        return {"status": "error", "message": f"No data in {table}"}

    delay = datetime.utcnow() - latest
    hours_stale = delay.total_seconds() / 3600

    if hours_stale > max_delay_hours:
        return {
            "status": "stale",
            "table": table,
            "latest_record": str(latest),
            "hours_stale": round(hours_stale, 1),
            "threshold": max_delay_hours,
        }

    return {"status": "fresh", "hours_stale": round(hours_stale, 1)}


engine = create_engine("postgresql://warehouse:5432/analytics")

tables_to_check = [
    ("raw.events", "event_time", 2),
    ("raw.orders", "created_at", 6),
    ("analytics.daily_metrics", "metric_date", 24),
]

for table, col, threshold in tables_to_check:
    result = check_freshness(engine, table, col, threshold)
    if result["status"] != "fresh":
        print(f"ALERT: {table} is {result.get('hours_stale', 'N/A')}h stale")
```

---

## Data Contracts

Agreements between producers and consumers about data shape:

```
  PRODUCER                  CONTRACT                  CONSUMER
  +--------+    +--------------------------+    +----------+
  | App DB | -> | Schema: (id INT, ...)    | -> | Pipeline |
  |        |    | SLA: < 2h latency        |    |          |
  |        |    | Volume: 10K-50K rows/day |    |          |
  |        |    | Owner: backend-team      |    |          |
  +--------+    +--------------------------+    +----------+
                If contract breaks -> alert both teams
```

```python
from dataclasses import dataclass

@dataclass
class DataContract:
    name: str
    owner: str
    schema: dict
    freshness_sla_hours: float
    min_row_count: int
    max_row_count: int

    def validate(self, df):
        violations = []

        for col, expected_type in self.schema.items():
            if col not in df.columns:
                violations.append(f"Missing column: {col}")

        row_count = len(df)
        if row_count < self.min_row_count:
            violations.append(f"Too few rows: {row_count} < {self.min_row_count}")
        if row_count > self.max_row_count:
            violations.append(f"Too many rows: {row_count} > {self.max_row_count}")

        return violations

orders_contract = DataContract(
    name="orders",
    owner="backend-team",
    schema={"order_id": "string", "user_id": "int", "amount": "float"},
    freshness_sla_hours=2.0,
    min_row_count=5000,
    max_row_count=100000,
)

violations = orders_contract.validate(orders_df)
if violations:
    print(f"Contract violations for {orders_contract.name}:")
    for v in violations:
        print(f"  - {v}")
```

---

## Exercises

1. **Expectations suite**: Using Great Expectations (or Pandera), write
   a validation suite for an orders table. Include at least 10
   expectations covering completeness, ranges, types, and uniqueness.

2. **Statistical monitor**: Build a data quality monitor that computes
   baseline statistics from historical data and alerts when new data
   deviates by more than 3 standard deviations on any metric.

3. **Quality gate pipeline**: Create an ETL pipeline with quality gates
   at input and output. Invalid rows should be quarantined to a
   separate table with the reason for rejection.

4. **Freshness dashboard**: Write a script that checks freshness of 5
   tables and outputs a summary table showing status (fresh/stale/
   missing), hours since last update, and SLA status.

5. **Data contract**: Define a data contract for a user events table.
   Write a validator that checks the contract and generates a report
   of all violations with severity levels.

---

[Next: Lesson 11 - Real-time ML Features ->](11-realtime-ml-features.md)
