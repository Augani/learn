# Lesson 10: CI/CD for ML

## Quality Gates for Models

```
  Traditional CI/CD                ML CI/CD
  +------------------------+       +------------------------+
  | Code changed?          |       | Code OR data changed?  |
  | Run unit tests         |       | Run unit tests         |
  | Run integration tests  |       | Run model tests        |
  | Lint + format          |       | Validate data quality  |
  | Build artifact         |       | Train model            |
  | Deploy                 |       | Evaluate model         |
  +------------------------+       | Compare to baseline    |
                                   | Shadow deploy          |
                                   | Canary release         |
                                   +------------------------+
```

In software CI/CD, tests are binary: pass or fail. In ML, you
also need to test that your **model** is good enough, your
**data** is clean, and your **predictions** make sense. It's
like quality control at a factory -- you test the product, not
just the machines.

---

## What to Test in ML

```
  Test Layer        What                     When
  +---------------+------------------------+-------------------+
  | Unit Tests    | Data transforms,       | Every commit      |
  |               | feature functions,     |                   |
  |               | preprocessing logic    |                   |
  +---------------+------------------------+-------------------+
  | Data Tests    | Schema, distributions, | Every data change |
  |               | completeness, freshness|                   |
  +---------------+------------------------+-------------------+
  | Model Tests   | Accuracy, latency,     | Every training    |
  |               | bias, edge cases       | run               |
  +---------------+------------------------+-------------------+
  | Integration   | API contract, end-to-  | Every deploy      |
  |               | end prediction flow    |                   |
  +---------------+------------------------+-------------------+
  | Shadow Tests  | Compare new vs old     | Before promotion  |
  |               | model on live traffic  |                   |
  +---------------+------------------------+-------------------+
```

---

## Unit Tests for ML Code

```python
import pytest
import numpy as np
import pandas as pd


def normalize_features(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    result = df.copy()
    for col in columns:
        if col not in result.columns:
            raise KeyError(f"Column '{col}' not found")
        col_std = result[col].std()
        if col_std == 0:
            result[col] = 0.0
        else:
            result[col] = (result[col] - result[col].mean()) / col_std
    return result


class TestNormalizeFeatures:
    def test_output_has_zero_mean(self):
        df = pd.DataFrame({"a": [1.0, 2.0, 3.0, 4.0, 5.0]})
        result = normalize_features(df, ["a"])
        assert abs(result["a"].mean()) < 1e-10

    def test_output_has_unit_variance(self):
        df = pd.DataFrame({"a": [1.0, 2.0, 3.0, 4.0, 5.0]})
        result = normalize_features(df, ["a"])
        assert abs(result["a"].std() - 1.0) < 1e-10

    def test_constant_column_returns_zeros(self):
        df = pd.DataFrame({"a": [5.0, 5.0, 5.0]})
        result = normalize_features(df, ["a"])
        assert (result["a"] == 0.0).all()

    def test_missing_column_raises(self):
        df = pd.DataFrame({"a": [1.0, 2.0]})
        with pytest.raises(KeyError, match="not found"):
            normalize_features(df, ["nonexistent"])

    def test_preserves_other_columns(self):
        df = pd.DataFrame({"a": [1.0, 2.0], "b": [10, 20]})
        result = normalize_features(df, ["a"])
        assert list(result["b"]) == [10, 20]
```

---

## Model Validation Tests

```python
import numpy as np
from dataclasses import dataclass


@dataclass
class ModelValidationResult:
    passed: bool
    metrics: dict
    failures: list[str]


def validate_model(
    model,
    X_test: np.ndarray,
    y_test: np.ndarray,
    baseline_metrics: dict,
    thresholds: dict,
) -> ModelValidationResult:
    from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

    predictions = model.predict(X_test)

    metrics = {
        "accuracy": accuracy_score(y_test, predictions),
        "f1": f1_score(y_test, predictions, average="weighted"),
        "precision": precision_score(y_test, predictions, average="weighted"),
        "recall": recall_score(y_test, predictions, average="weighted"),
    }

    failures = []

    for metric_name, min_value in thresholds.items():
        if metrics.get(metric_name, 0) < min_value:
            failures.append(
                f"{metric_name}: {metrics[metric_name]:.4f} < {min_value} (threshold)"
            )

    for metric_name, baseline_value in baseline_metrics.items():
        current = metrics.get(metric_name, 0)
        if current < baseline_value * 0.95:
            failures.append(
                f"{metric_name}: {current:.4f} regressed from baseline {baseline_value:.4f}"
            )

    return ModelValidationResult(
        passed=len(failures) == 0,
        metrics=metrics,
        failures=failures,
    )
```

---

## Model-Specific Tests

```python
def test_model_invariance(model, tokenizer):
    pairs = [
        ("The food was great", "The food was great!"),
        ("I love this product", "I LOVE this product"),
        ("good service", "Good Service"),
    ]

    for text_a, text_b in pairs:
        pred_a = predict(model, tokenizer, text_a)
        pred_b = predict(model, tokenizer, text_b)
        assert pred_a["label"] == pred_b["label"], (
            f"Invariance failed: '{text_a}' -> {pred_a['label']}, "
            f"'{text_b}' -> {pred_b['label']}"
        )


def test_model_directional(model, tokenizer):
    positive_texts = ["amazing product", "absolutely love it", "best purchase ever"]
    negative_texts = ["terrible quality", "waste of money", "completely broken"]

    for text in positive_texts:
        pred = predict(model, tokenizer, text)
        assert pred["label"] == "positive", f"Expected positive for '{text}'"

    for text in negative_texts:
        pred = predict(model, tokenizer, text)
        assert pred["label"] == "negative", f"Expected negative for '{text}'"


def test_model_latency(model, tokenizer):
    import time

    texts = ["Sample input text for latency testing"] * 100
    start = time.perf_counter()
    for text in texts:
        predict(model, tokenizer, text)
    elapsed = time.perf_counter() - start

    avg_ms = (elapsed / len(texts)) * 1000
    assert avg_ms < 50, f"Average latency {avg_ms:.1f}ms exceeds 50ms threshold"


def test_model_size(model_path: str, max_size_mb: float = 500):
    import os
    size_mb = os.path.getsize(model_path) / (1024 * 1024)
    assert size_mb < max_size_mb, f"Model size {size_mb:.1f}MB exceeds {max_size_mb}MB"
```

---

## GitHub Actions for ML

```yaml
# .github/workflows/ml-ci.yml
name: ML CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-code:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - run: pytest tests/unit/ -v
      - run: ruff check src/

  test-data:
    runs-on: ubuntu-latest
    needs: test-code
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - run: python scripts/validate_data.py
      - run: pytest tests/data/ -v

  train-and-validate:
    runs-on: ubuntu-latest
    needs: test-data
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - run: python scripts/train.py --config config/ci.yaml
      - run: python scripts/validate_model.py
      - uses: actions/upload-artifact@v4
        with:
          name: model-artifact
          path: outputs/model/

  shadow-deploy:
    runs-on: ubuntu-latest
    needs: train-and-validate
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: model-artifact
          path: outputs/model/
      - run: python scripts/shadow_deploy.py
```

---

## Shadow Deployments

```
  Live Traffic
       |
       +--> Production Model (v1) --> Response to user
       |
       +--> Shadow Model (v2)     --> Log only (user never sees)

  Compare v1 vs v2 predictions offline.
  If v2 is better --> promote to production.
  If v2 is worse  --> discard, no user impact.

  Like a new chef cooking alongside the current one.
  Customers eat the current chef's food.
  Management tastes both to decide who stays.
```

```python
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ShadowResult:
    production_prediction: dict
    shadow_prediction: dict
    agree: bool


class ShadowDeployment:
    def __init__(self, production_model, shadow_model):
        self.production = production_model
        self.shadow = shadow_model
        self.total_requests = 0
        self.agreement_count = 0

    def predict(self, features: dict) -> dict:
        prod_result = self.production.predict(features)

        try:
            shadow_result = self.shadow.predict(features)
            agree = prod_result["label"] == shadow_result["label"]

            self.total_requests += 1
            if agree:
                self.agreement_count += 1

            logger.info(
                "shadow_comparison prod=%s shadow=%s agree=%s",
                prod_result["label"],
                shadow_result["label"],
                agree,
            )
        except Exception as exc:
            logger.error("Shadow model failed: %s", exc)

        return prod_result

    @property
    def agreement_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.agreement_count / self.total_requests
```

---

## Model Validation Gates

```
  Gate 1: Absolute Thresholds
  +----------------------------------+
  | accuracy >= 0.85        PASS     |
  | latency_p99 <= 100ms   PASS     |
  | model_size <= 500MB     PASS     |
  +----------------------------------+

  Gate 2: Relative to Baseline
  +----------------------------------+
  | accuracy >= baseline - 2%  PASS  |
  | latency <= baseline * 1.1  PASS  |
  +----------------------------------+

  Gate 3: Bias & Fairness
  +----------------------------------+
  | demographic_parity >= 0.8  PASS  |
  | equal_opportunity >= 0.8   PASS  |
  +----------------------------------+

  ALL gates must pass to deploy.
```

```python
@dataclass
class ValidationGate:
    name: str
    check_fn: callable
    required: bool = True


def run_validation_gates(
    model,
    test_data: dict,
    gates: list[ValidationGate],
) -> tuple[bool, list[dict]]:
    results = []
    all_passed = True

    for gate in gates:
        try:
            passed = gate.check_fn(model, test_data)
            results.append({
                "gate": gate.name,
                "passed": passed,
                "required": gate.required,
            })
            if not passed and gate.required:
                all_passed = False
        except Exception as exc:
            results.append({
                "gate": gate.name,
                "passed": False,
                "required": gate.required,
                "error": str(exc),
            })
            if gate.required:
                all_passed = False

    return all_passed, results
```

---

## Exercises

1. **Unit Test Suite**: Write unit tests for 3 feature
   engineering functions. Include edge cases (empty input,
   NaN values, wrong types). Run with pytest.

2. **Model Validation**: Implement the `validate_model`
   function above. Train two models, run validation on
   both, and verify the better model passes.

3. **CI Pipeline**: Set up a GitHub Actions workflow that
   runs unit tests, trains a small model, and validates it.
   Make it fail if accuracy drops below a threshold.

4. **Shadow Deploy**: Implement the shadow deployment
   pattern. Route 100 requests through both models,
   log the comparison, and report agreement rate.

---

[Next: Lesson 11 - Model Monitoring -->](11-model-monitoring.md)
