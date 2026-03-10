# Lesson 13: Data Quality Monitoring

## Food Safety Inspections for Your Data

```
  Restaurant Kitchen                ML Pipeline
  +----------------------------+   +----------------------------+
  | Health inspector checks:   |   | Data quality checks:       |
  | - Temperature of fridge    |   | - Schema validation        |
  | - Expiration dates         |   | - Freshness checks         |
  | - Cleanliness              |   | - Null/missing values      |
  | - Cross-contamination      |   | - Value range checks       |
  |                            |   |                            |
  | Fail inspection = shut     |   | Fail quality = stop        |
  | down kitchen               |   | pipeline                   |
  +----------------------------+   +----------------------------+
```

Garbage in, garbage out. If your model is a five-star chef, bad
data is like rotten ingredients -- no amount of cooking skill
will save the dish. Data quality monitoring catches bad data
**before** it reaches your model.

---

## What Can Go Wrong

```
  +----------------------------------------------------------+
  |  Data Quality Issues (ordered by how sneaky they are)     |
  |                                                          |
  |  OBVIOUS (caught quickly)                                 |
  |  - Missing columns / schema changes                       |
  |  - Empty datasets                                         |
  |  - Wrong data types                                       |
  |                                                          |
  |  SUBTLE (caught with checks)                              |
  |  - Increased null rates                                   |
  |  - Values outside expected range                          |
  |  - Duplicate records                                      |
  |                                                          |
  |  SILENT KILLERS (caught only with monitoring)             |
  |  - Gradual distribution shift                             |
  |  - Upstream system changes                                |
  |  - Label corruption                                       |
  |  - Encoding changes                                       |
  +----------------------------------------------------------+
```

---

## Great Expectations: Data Validation Framework

```
  Great Expectations
  +--------------------------------------------------+
  |  1. Define "Expectations" (rules about your data) |
  |  2. Run validation against actual data            |
  |  3. Get a pass/fail report                        |
  |  4. Integrate into pipelines                      |
  +--------------------------------------------------+

  Think of Expectations as a contract:
  "I expect this column to always have values between 0 and 100"
```

### Setting Up Great Expectations

```python
import great_expectations as gx

context = gx.get_context()

datasource = context.sources.add_pandas("my_datasource")

data_asset = datasource.add_dataframe_asset(name="transactions")

suite = context.add_expectation_suite("transactions_quality")
```

### Defining Expectations

```python
import great_expectations as gx
from great_expectations.core.expectation_configuration import ExpectationConfiguration


def build_transaction_suite(context):
    suite = context.add_expectation_suite("transactions_quality")

    suite.add_expectation(
        ExpectationConfiguration(
            expectation_type="expect_table_row_count_to_be_between",
            kwargs={"min_value": 1000, "max_value": 10000000},
        )
    )

    suite.add_expectation(
        ExpectationConfiguration(
            expectation_type="expect_table_columns_to_match_set",
            kwargs={
                "column_set": [
                    "transaction_id", "user_id", "amount",
                    "timestamp", "category", "is_fraud",
                ],
                "exact_match": True,
            },
        )
    )

    suite.add_expectation(
        ExpectationConfiguration(
            expectation_type="expect_column_values_to_not_be_null",
            kwargs={"column": "transaction_id"},
        )
    )

    suite.add_expectation(
        ExpectationConfiguration(
            expectation_type="expect_column_values_to_be_between",
            kwargs={"column": "amount", "min_value": 0, "max_value": 1000000},
        )
    )

    suite.add_expectation(
        ExpectationConfiguration(
            expectation_type="expect_column_values_to_be_unique",
            kwargs={"column": "transaction_id"},
        )
    )

    suite.add_expectation(
        ExpectationConfiguration(
            expectation_type="expect_column_values_to_be_in_set",
            kwargs={
                "column": "category",
                "value_set": ["food", "electronics", "clothing", "travel", "other"],
            },
        )
    )

    return suite
```

---

## Building Your Own Validators

When you need more control than Great Expectations provides:

```python
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np


class CheckSeverity(str, Enum):
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class CheckResult:
    name: str
    passed: bool
    severity: CheckSeverity
    message: str
    details: dict = field(default_factory=dict)


class DataQualityChecker:
    def __init__(self):
        self.checks: list[callable] = []

    def add_check(self, check_fn: callable):
        self.checks.append(check_fn)

    def run_all(self, df: pd.DataFrame) -> list[CheckResult]:
        results = []
        for check_fn in self.checks:
            result = check_fn(df)
            results.append(result)
        return results

    def has_failures(self, results: list[CheckResult]) -> bool:
        return any(
            not r.passed and r.severity in (CheckSeverity.ERROR, CheckSeverity.CRITICAL)
            for r in results
        )


def check_no_nulls(column: str, severity: CheckSeverity = CheckSeverity.ERROR):
    def _check(df: pd.DataFrame) -> CheckResult:
        null_count = df[column].isnull().sum()
        null_pct = null_count / len(df) if len(df) > 0 else 0
        return CheckResult(
            name=f"no_nulls_{column}",
            passed=null_count == 0,
            severity=severity,
            message=f"{column}: {null_count} nulls ({null_pct:.1%})",
            details={"null_count": int(null_count), "null_pct": float(null_pct)},
        )
    return _check


def check_value_range(
    column: str,
    min_val: float,
    max_val: float,
    severity: CheckSeverity = CheckSeverity.ERROR,
):
    def _check(df: pd.DataFrame) -> CheckResult:
        out_of_range = ((df[column] < min_val) | (df[column] > max_val)).sum()
        return CheckResult(
            name=f"range_{column}",
            passed=out_of_range == 0,
            severity=severity,
            message=f"{column}: {out_of_range} values outside [{min_val}, {max_val}]",
            details={"out_of_range_count": int(out_of_range)},
        )
    return _check


def check_no_duplicates(
    columns: list[str],
    severity: CheckSeverity = CheckSeverity.ERROR,
):
    def _check(df: pd.DataFrame) -> CheckResult:
        dup_count = df.duplicated(subset=columns).sum()
        return CheckResult(
            name=f"no_duplicates_{'_'.join(columns)}",
            passed=dup_count == 0,
            severity=severity,
            message=f"Found {dup_count} duplicate rows on {columns}",
            details={"duplicate_count": int(dup_count)},
        )
    return _check


def check_freshness(
    timestamp_column: str,
    max_age_hours: float,
    severity: CheckSeverity = CheckSeverity.CRITICAL,
):
    def _check(df: pd.DataFrame) -> CheckResult:
        from datetime import datetime, timezone

        latest = pd.to_datetime(df[timestamp_column]).max()
        now = pd.Timestamp(datetime.now(timezone.utc))
        age_hours = (now - latest).total_seconds() / 3600

        return CheckResult(
            name=f"freshness_{timestamp_column}",
            passed=age_hours <= max_age_hours,
            severity=severity,
            message=f"Latest record is {age_hours:.1f} hours old (max: {max_age_hours}h)",
            details={"age_hours": float(age_hours)},
        )
    return _check
```

### Using the Checker

```python
checker = DataQualityChecker()
checker.add_check(check_no_nulls("transaction_id"))
checker.add_check(check_no_nulls("amount"))
checker.add_check(check_value_range("amount", 0, 1_000_000))
checker.add_check(check_no_duplicates(["transaction_id"]))
checker.add_check(check_freshness("timestamp", max_age_hours=24))

results = checker.run_all(df)

for result in results:
    status = "PASS" if result.passed else "FAIL"
    print(f"[{status}] [{result.severity.value}] {result.message}")

if checker.has_failures(results):
    raise RuntimeError("Data quality checks failed -- pipeline halted")
```

---

## Data Contracts

```
  Data Contract = Agreement between data producer and consumer

  Producer (Backend Team)         Consumer (ML Team)
  +-------------------------+     +-------------------------+
  | "We guarantee:          |     | "We depend on:          |
  |  - user_id is never null|     |  - user_id for joins    |
  |  - amount is positive   |     |  - amount for features  |
  |  - schema won't change  |     |  - consistent schema    |
  |    without notice"      |     |  - data within 1 hour"  |
  +-------------------------+     +-------------------------+
```

```python
from dataclasses import dataclass


@dataclass
class ColumnContract:
    name: str
    dtype: str
    nullable: bool
    min_value: float | None = None
    max_value: float | None = None
    allowed_values: list | None = None


@dataclass
class DataContract:
    name: str
    version: str
    owner: str
    columns: list[ColumnContract]
    min_rows: int = 1
    max_staleness_hours: float = 24.0


def validate_contract(df: pd.DataFrame, contract: DataContract) -> list[str]:
    violations = []

    if len(df) < contract.min_rows:
        violations.append(f"Row count {len(df)} < minimum {contract.min_rows}")

    expected_cols = {c.name for c in contract.columns}
    actual_cols = set(df.columns)

    missing = expected_cols - actual_cols
    if missing:
        violations.append(f"Missing columns: {missing}")

    extra = actual_cols - expected_cols
    if extra:
        violations.append(f"Unexpected columns: {extra}")

    for col_contract in contract.columns:
        if col_contract.name not in df.columns:
            continue

        col = df[col_contract.name]

        if not col_contract.nullable and col.isnull().any():
            violations.append(f"{col_contract.name}: contains nulls but contract says non-nullable")

        if col_contract.min_value is not None:
            below = (col.dropna() < col_contract.min_value).sum()
            if below > 0:
                violations.append(f"{col_contract.name}: {below} values below {col_contract.min_value}")

        if col_contract.max_value is not None:
            above = (col.dropna() > col_contract.max_value).sum()
            if above > 0:
                violations.append(f"{col_contract.name}: {above} values above {col_contract.max_value}")

        if col_contract.allowed_values is not None:
            invalid = ~col.dropna().isin(col_contract.allowed_values)
            if invalid.any():
                violations.append(
                    f"{col_contract.name}: {invalid.sum()} values not in allowed set"
                )

    return violations


transaction_contract = DataContract(
    name="transactions",
    version="2.0",
    owner="backend-team",
    min_rows=1000,
    max_staleness_hours=1.0,
    columns=[
        ColumnContract("transaction_id", "string", nullable=False),
        ColumnContract("user_id", "string", nullable=False),
        ColumnContract("amount", "float64", nullable=False, min_value=0),
        ColumnContract("timestamp", "datetime64", nullable=False),
        ColumnContract(
            "category", "string", nullable=False,
            allowed_values=["food", "electronics", "clothing", "travel", "other"],
        ),
    ],
)
```

---

## Schema Validation

```
  Schema v1                  Schema v2 (breaking!)
  +-------------------+      +-------------------+
  | transaction_id    |      | txn_id            | <-- renamed!
  | user_id           |      | user_id           |
  | amount (float)    |      | amount (string)   | <-- type change!
  | timestamp         |      | timestamp         |
  | category          |      | category          |
  |                   |      | region            | <-- new column
  +-------------------+      +-------------------+

  Without schema checks: your pipeline silently breaks.
  With schema checks: immediate alert and halt.
```

```python
def detect_schema_changes(
    expected_schema: dict[str, str],
    actual_df: pd.DataFrame,
) -> dict:
    actual_schema = {col: str(dtype) for col, dtype in actual_df.dtypes.items()}

    added = set(actual_schema.keys()) - set(expected_schema.keys())
    removed = set(expected_schema.keys()) - set(actual_schema.keys())

    type_changes = {}
    for col in set(expected_schema.keys()) & set(actual_schema.keys()):
        if expected_schema[col] != actual_schema[col]:
            type_changes[col] = {
                "expected": expected_schema[col],
                "actual": actual_schema[col],
            }

    has_breaking_changes = bool(removed or type_changes)

    return {
        "has_breaking_changes": has_breaking_changes,
        "added_columns": list(added),
        "removed_columns": list(removed),
        "type_changes": type_changes,
    }
```

---

## Pipeline Integration

```
  +--------+     +--------+     +--------+     +--------+
  | Ingest | --> | Quality| --> | Train  | --> | Deploy |
  |        |     | Gate   |     |        |     |        |
  +--------+     +--------+     +--------+     +--------+
                      |
                      v
                 PASS? --> Continue
                 FAIL? --> Alert team, halt pipeline
```

---

## Exercises

1. **Quality Checker**: Build a `DataQualityChecker` with 5
   checks for a dataset of your choice. Generate a clean
   dataset (all pass) and a dirty one (some fail).

2. **Data Contract**: Define a `DataContract` for a dataset
   your team produces. Write validation code and test it
   against valid and invalid data.

3. **Schema Drift**: Write a monitoring script that saves
   today's schema and compares it to yesterday's. Alert
   on any breaking changes.

4. **Pipeline Gate**: Integrate data quality checks into a
   training pipeline. If checks fail, the pipeline should
   halt and log which checks failed and why.

---

[Next: Lesson 14 - Incident Response for ML -->](14-incident-response-ml.md)
