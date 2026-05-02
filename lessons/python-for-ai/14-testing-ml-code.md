# Lesson 14: Testing ML Code

> Testing ML code is like quality control in a factory.
> You don't ship products without checking them.

---

## Why ML Code Is Hard to Test

```
  TRADITIONAL CODE:             ML CODE:
  ================              ========
  Input: 2 + 2                  Input: image of a cat
  Expected: 4                   Expected: "cat" (probably)
  Exact match: YES              Exact match: MAYBE

  Deterministic                 Stochastic
  Same output every time        Output varies by:
  Easy to assert                - Random seeds
                                - Data order
                                - Floating point drift
                                - GPU vs CPU differences
```

---

## Setting Up pytest

```bash
pip install pytest pytest-cov
```

```
  Project structure:
  ├── src/
  │   └── my_ml/
  │       ├── __init__.py
  │       ├── data.py
  │       ├── features.py
  │       ├── model.py
  │       └── evaluate.py
  ├── tests/
  │   ├── conftest.py
  │   ├── test_data.py
  │   ├── test_features.py
  │   ├── test_model.py
  │   └── test_evaluate.py
  └── pyproject.toml
```

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --tb=short"
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "gpu: marks tests requiring GPU",
]
```

---

## Testing Data Pipelines

The most valuable tests in ML guard your data pipeline.
Garbage in, garbage out -- so test the "in" part rigorously.

```python
import pytest
import numpy as np
import pandas as pd


def load_and_clean(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    df = df.dropna(subset=["target"])
    df["age"] = df["age"].clip(0, 120)
    df["income"] = df["income"].fillna(df["income"].median())
    return df


def test_clean_removes_null_targets(tmp_path):
    csv_path = tmp_path / "data.csv"
    csv_path.write_text("age,income,target\n25,50000,1\n30,60000,\n35,70000,0\n")

    result = load_and_clean(str(csv_path))

    assert len(result) == 2
    assert result["target"].notna().all()


def test_clean_clips_age(tmp_path):
    csv_path = tmp_path / "data.csv"
    csv_path.write_text("age,income,target\n-5,50000,1\n200,60000,0\n")

    result = load_and_clean(str(csv_path))

    assert result["age"].min() >= 0
    assert result["age"].max() <= 120


def test_clean_fills_missing_income(tmp_path):
    csv_path = tmp_path / "data.csv"
    csv_path.write_text("age,income,target\n25,50000,1\n30,,0\n35,70000,1\n")

    result = load_and_clean(str(csv_path))

    assert result["income"].notna().all()
```

---

## Fixtures: Reusable Test Data

Fixtures are like prep stations in a kitchen. Set up once,
use across many tests.

```python
import pytest
import numpy as np
import pandas as pd
from sklearn.datasets import make_classification


@pytest.fixture
def sample_dataset():
    X, y = make_classification(
        n_samples=200,
        n_features=10,
        n_informative=5,
        random_state=42,
    )
    return X, y


@pytest.fixture
def sample_dataframe():
    rng = np.random.RandomState(42)
    return pd.DataFrame({
        "feature_a": rng.randn(100),
        "feature_b": rng.choice(["cat", "dog", "bird"], 100),
        "feature_c": rng.randint(0, 100, 100),
        "target": rng.choice([0, 1], 100),
    })


@pytest.fixture
def trained_model(sample_dataset):
    from sklearn.ensemble import RandomForestClassifier

    X, y = sample_dataset
    model = RandomForestClassifier(n_estimators=10, random_state=42)
    model.fit(X, y)
    return model


def test_model_predicts_correct_shape(trained_model, sample_dataset):
    X, _ = sample_dataset
    predictions = trained_model.predict(X)
    assert predictions.shape == (200,)


def test_model_probabilities_sum_to_one(trained_model, sample_dataset):
    X, _ = sample_dataset
    probas = trained_model.predict_proba(X)
    sums = probas.sum(axis=1)
    np.testing.assert_allclose(sums, 1.0, atol=1e-10)
```

---

## Testing Feature Engineering

```python
import numpy as np
import pandas as pd


def create_interaction_features(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    result = df.copy()
    for i, col_a in enumerate(columns):
        for col_b in columns[i + 1:]:
            name = f"{col_a}_x_{col_b}"
            result[name] = result[col_a] * result[col_b]
    return result


def normalize_features(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    result = df.copy()
    for col in columns:
        col_min = result[col].min()
        col_max = result[col].max()
        if col_max - col_min == 0:
            result[col] = 0.0
        else:
            result[col] = (result[col] - col_min) / (col_max - col_min)
    return result


def test_interaction_features_count():
    df = pd.DataFrame({"a": [1, 2], "b": [3, 4], "c": [5, 6]})
    result = create_interaction_features(df, ["a", "b", "c"])
    assert "a_x_b" in result.columns
    assert "a_x_c" in result.columns
    assert "b_x_c" in result.columns
    assert len(result.columns) == 6


def test_normalize_range():
    df = pd.DataFrame({"x": [10, 20, 30, 40, 50]})
    result = normalize_features(df, ["x"])
    assert result["x"].min() == pytest.approx(0.0)
    assert result["x"].max() == pytest.approx(1.0)


def test_normalize_constant_column():
    df = pd.DataFrame({"x": [5, 5, 5, 5]})
    result = normalize_features(df, ["x"])
    assert (result["x"] == 0.0).all()
```

---

## Approximate Assertions

ML outputs are rarely exact. Use tolerances.

```python
import numpy as np
import pytest


def test_model_accuracy_reasonable(trained_model, sample_dataset):
    from sklearn.metrics import accuracy_score

    X, y = sample_dataset
    preds = trained_model.predict(X)
    accuracy = accuracy_score(y, preds)
    assert accuracy > 0.7, f"Accuracy {accuracy:.3f} below threshold"


def test_loss_decreases():
    losses = [2.5, 2.1, 1.8, 1.5, 1.3, 1.1, 0.9]
    for i in range(1, len(losses)):
        assert losses[i] < losses[i - 1], f"Loss increased at step {i}"


def test_embeddings_normalized():
    embeddings = np.random.randn(100, 64)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    normalized = embeddings / norms

    actual_norms = np.linalg.norm(normalized, axis=1)
    np.testing.assert_allclose(actual_norms, 1.0, atol=1e-7)


def test_softmax_output():
    logits = np.array([2.0, 1.0, 0.1])
    exp_logits = np.exp(logits - np.max(logits))
    softmax = exp_logits / exp_logits.sum()

    assert softmax.sum() == pytest.approx(1.0, abs=1e-10)
    assert all(s >= 0 for s in softmax)
    assert np.argmax(softmax) == 0
```

---

## Snapshot Testing for ML

Like photographing your dish so you can tell if the recipe
changed. Save model outputs and compare later.

```python
import json
import numpy as np
from pathlib import Path


def save_snapshot(data: dict, path: Path) -> None:
    serializable = {}
    for key, value in data.items():
        if isinstance(value, np.ndarray):
            serializable[key] = value.tolist()
        else:
            serializable[key] = value
    path.write_text(json.dumps(serializable, indent=2))


def load_snapshot(path: Path) -> dict:
    return json.loads(path.read_text())


def test_model_output_snapshot(trained_model, tmp_path):
    X_test = np.array([[0.5, -0.3, 1.2, 0.0, 0.8, -1.1, 0.3, 0.0, -0.5, 1.0]])
    prediction = trained_model.predict(X_test)
    probas = trained_model.predict_proba(X_test)

    snapshot_path = tmp_path / "snapshot.json"
    current = {"prediction": prediction.tolist(), "probas": probas.tolist()}

    if snapshot_path.exists():
        saved = load_snapshot(snapshot_path)
        np.testing.assert_allclose(
            current["probas"], saved["probas"], atol=1e-5,
            err_msg="Model output changed from snapshot",
        )
    else:
        save_snapshot(current, snapshot_path)
```

---

## Testing with Parametrize

```python
import pytest
import numpy as np


def relu(x: np.ndarray) -> np.ndarray:
    return np.maximum(0, x)


@pytest.mark.parametrize("input_val,expected", [
    (np.array([1.0, 2.0, 3.0]), np.array([1.0, 2.0, 3.0])),
    (np.array([-1.0, -2.0, -3.0]), np.array([0.0, 0.0, 0.0])),
    (np.array([-1.0, 0.0, 1.0]), np.array([0.0, 0.0, 1.0])),
    (np.array([0.0]), np.array([0.0])),
])
def test_relu(input_val, expected):
    np.testing.assert_array_equal(relu(input_val), expected)


@pytest.mark.parametrize("n_samples,n_features", [
    (100, 10),
    (1000, 50),
    (10, 100),
])
def test_model_handles_different_shapes(n_samples, n_features):
    from sklearn.ensemble import RandomForestClassifier

    X = np.random.randn(n_samples, n_features)
    y = np.random.choice([0, 1], n_samples)

    model = RandomForestClassifier(n_estimators=5, random_state=42)
    model.fit(X, y)
    preds = model.predict(X)

    assert preds.shape == (n_samples,)
```

---

## Marking Slow Tests

```python
import pytest
import time


@pytest.mark.slow
def test_full_training_pipeline():
    from sklearn.datasets import make_classification
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.model_selection import cross_val_score

    X, y = make_classification(n_samples=5000, n_features=50, random_state=42)
    model = GradientBoostingClassifier(n_estimators=200, random_state=42)
    scores = cross_val_score(model, X, y, cv=5)

    assert scores.mean() > 0.8


@pytest.mark.gpu
def test_torch_model_on_gpu():
    pytest.importorskip("torch")
    import torch

    if not torch.cuda.is_available():
        pytest.skip("No GPU available")

    tensor = torch.randn(100, 10).cuda()
    assert tensor.device.type == "cuda"
```

```bash
pytest -m "not slow"

pytest -m "slow"

pytest -m "not gpu"
```

---

## Testing Data Contracts

```
  DATA CONTRACT
  =============

  Your pipeline expects:
  ┌─────────────────────────────────────┐
  │  Column    Type     Range    Nulls  │
  │  ──────    ────     ─────    ─────  │
  │  age       int      0-120    No     │
  │  income    float    > 0      < 5%   │
  │  target    int      0 or 1   No     │
  └─────────────────────────────────────┘

  If upstream data changes, your tests catch it.
```

```python
import pandas as pd
import numpy as np


def validate_schema(df: pd.DataFrame) -> list[str]:
    errors = []

    required = {"age", "income", "target"}
    missing = required - set(df.columns)
    if missing:
        errors.append(f"Missing columns: {missing}")

    if "age" in df.columns:
        if df["age"].min() < 0 or df["age"].max() > 120:
            errors.append("Age out of range [0, 120]")

    if "income" in df.columns:
        null_pct = df["income"].isna().mean()
        if null_pct > 0.05:
            errors.append(f"Income null rate {null_pct:.1%} exceeds 5%")

    if "target" in df.columns:
        if not set(df["target"].unique()).issubset({0, 1}):
            errors.append("Target contains values other than 0, 1")

    return errors


def test_valid_data_passes():
    df = pd.DataFrame({
        "age": [25, 30, 35],
        "income": [50000.0, 60000.0, 70000.0],
        "target": [0, 1, 1],
    })
    assert validate_schema(df) == []


def test_invalid_age_caught():
    df = pd.DataFrame({
        "age": [25, -5, 200],
        "income": [50000.0, 60000.0, 70000.0],
        "target": [0, 1, 1],
    })
    errors = validate_schema(df)
    assert any("Age" in e for e in errors)
```

---

## Running Tests

```bash
pytest

pytest tests/test_data.py

pytest -v --tb=long

pytest --cov=src --cov-report=term-missing

pytest -x

pytest -k "test_model"
```

---

## Exercises

**Exercise 1:** Write a test suite for a feature engineering function
that creates one-hot encoded columns from a categorical column.
Test edge cases: unknown categories, empty DataFrames, single-value columns.

**Exercise 2:** Create a conftest.py with fixtures for a train/test split
dataset, a fitted scaler, and a trained model. Write 5 tests that use
these fixtures in combination.

**Exercise 3:** Implement snapshot testing for a scikit-learn pipeline.
Save predictions on a fixed test set. Verify that retraining with the
same seed produces identical results.

**Exercise 4:** Write parametrized tests for three different activation
functions (relu, sigmoid, tanh) checking their expected ranges
and edge case behavior.

**Exercise 5:** Build a data validation function for a real dataset
(Titanic or Iris). Write tests for every column's type, range, and
null constraints. Then intentionally corrupt the data and verify
your tests catch it.

---

[Next: Lesson 15 - Profiling & Optimization ->](15-profiling-optimization.md)
