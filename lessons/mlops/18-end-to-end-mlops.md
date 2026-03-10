# Lesson 18: End-to-End MLOps Project

> Building a production ML system is like building a self-driving
> car factory. It's not just about making one good car (model).
> It's about the entire assembly line: sourcing parts (data),
> quality control (validation), manufacturing (training),
> testing (evaluation), shipping (deployment), and recalls
> when something goes wrong (monitoring + retraining).

---

## The Full Lifecycle

```
  +------------------------------------------------------------------+
  |                    ML Production Lifecycle                         |
  |                                                                    |
  |  1. DEFINE        2. DATA          3. TRAIN        4. EVALUATE    |
  |  +--------+      +--------+       +--------+      +--------+     |
  |  | Problem|  --> | Collect|   --> | Train  |  --> | Test   |     |
  |  | & KPIs |      | Clean  |       | Tune   |      | Compare|     |
  |  +--------+      | Version|       | Track  |      | Approve|     |
  |                   +--------+       +--------+      +--------+     |
  |                                                         |         |
  |  8. RETRAIN       7. MONITOR       6. SERVE       5. DEPLOY      |
  |  +--------+      +--------+       +--------+      +--------+     |
  |  | Trigger|  <-- | Drift  |   <-- | Predict|  <-- | CI/CD  |     |
  |  | Retrain|      | Perf.  |       | Scale  |      | Canary |     |
  |  +--------+      | Alert  |       | Cache  |      | Release|     |
  |                   +--------+       +--------+      +--------+     |
  +------------------------------------------------------------------+
```

---

## Project: Fraud Detection System

We'll build a complete MLOps pipeline for transaction fraud detection.

```
  System overview:

  Transactions --> [Feature Store] --> [Model] --> Fraud/Not Fraud
  (real-time)      (streaming +       (served      |
                    batch features)    via API)     v
                                                  [Alert]
                                                  [Block]
```

---

## Step 1: Data Pipeline

```python
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import hashlib
import json


@dataclass
class DataVersion:
    version: str
    created_at: datetime
    row_count: int
    schema_hash: str
    source: str
    description: str

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "row_count": self.row_count,
            "schema_hash": self.schema_hash,
            "source": self.source,
            "description": self.description,
        }


class DataPipeline:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def ingest(self, source_path: str, version: str) -> DataVersion:
        import pandas as pd

        df = pd.read_parquet(source_path)

        df = self._validate(df)
        df = self._clean(df)

        output_path = self.data_dir / f"transactions_v{version}.parquet"
        df.to_parquet(output_path, index=False)

        schema_hash = hashlib.md5(
            str(list(df.dtypes.items())).encode()
        ).hexdigest()

        data_version = DataVersion(
            version=version,
            created_at=datetime.utcnow(),
            row_count=len(df),
            schema_hash=schema_hash,
            source=source_path,
            description=f"Fraud detection dataset v{version}",
        )

        meta_path = self.data_dir / f"metadata_v{version}.json"
        with open(meta_path, "w") as f:
            json.dump(data_version.to_dict(), f, indent=2)

        return data_version

    def _validate(self, df):
        required_columns = [
            "transaction_id", "amount", "merchant_category",
            "timestamp", "user_id", "is_fraud",
        ]
        missing = set(required_columns) - set(df.columns)
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        if df["transaction_id"].duplicated().any():
            raise ValueError("Duplicate transaction IDs found")

        return df

    def _clean(self, df):
        df = df.dropna(subset=["transaction_id", "amount", "user_id"])
        df = df[df["amount"] > 0]
        df = df[df["amount"] < 1_000_000]
        return df
```

---

## Step 2: Feature Engineering

```python
import pandas as pd
import numpy as np


class FeatureEngineer:
    def __init__(self):
        self.feature_names: list[str] = []

    def compute_features(self, transactions: pd.DataFrame) -> pd.DataFrame:
        features = transactions.copy()

        features["hour_of_day"] = pd.to_datetime(
            features["timestamp"]
        ).dt.hour
        features["day_of_week"] = pd.to_datetime(
            features["timestamp"]
        ).dt.dayofweek
        features["is_weekend"] = features["day_of_week"].isin([5, 6]).astype(int)
        features["is_night"] = features["hour_of_day"].isin(
            range(0, 6)
        ).astype(int)

        user_stats = features.groupby("user_id")["amount"].agg(
            user_avg_amount="mean",
            user_std_amount="std",
            user_tx_count="count",
        ).reset_index()

        features = features.merge(user_stats, on="user_id", how="left")

        features["amount_zscore"] = (
            (features["amount"] - features["user_avg_amount"])
            / features["user_std_amount"].clip(lower=1e-6)
        )

        features["log_amount"] = np.log1p(features["amount"])

        self.feature_names = [
            "amount", "log_amount", "hour_of_day", "day_of_week",
            "is_weekend", "is_night", "user_avg_amount",
            "user_std_amount", "user_tx_count", "amount_zscore",
        ]

        return features[self.feature_names + ["is_fraud", "transaction_id"]]
```

---

## Step 3: Training Pipeline

```python
import json
from datetime import datetime
from pathlib import Path
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score,
)
import joblib


class TrainingPipeline:
    def __init__(self, experiment_dir: str):
        self.experiment_dir = Path(experiment_dir)
        self.experiment_dir.mkdir(parents=True, exist_ok=True)

    def train(
        self,
        features_df,
        feature_names: list[str],
        run_name: str,
        hyperparams: dict | None = None,
    ) -> dict:
        if hyperparams is None:
            hyperparams = {
                "n_estimators": 200,
                "max_depth": 6,
                "learning_rate": 0.1,
                "subsample": 0.8,
                "min_samples_leaf": 50,
            }

        X = features_df[feature_names].values
        y = features_df["is_fraud"].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        model = GradientBoostingClassifier(**hyperparams)
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]

        metrics = {
            "precision": float(precision_score(y_test, y_pred)),
            "recall": float(recall_score(y_test, y_pred)),
            "f1": float(f1_score(y_test, y_pred)),
            "auc_roc": float(roc_auc_score(y_test, y_prob)),
            "avg_precision": float(average_precision_score(y_test, y_prob)),
            "test_size": len(y_test),
            "fraud_rate": float(y_test.mean()),
        }

        run_dir = self.experiment_dir / run_name
        run_dir.mkdir(parents=True, exist_ok=True)

        joblib.dump(model, run_dir / "model.joblib")

        run_metadata = {
            "run_name": run_name,
            "timestamp": datetime.utcnow().isoformat(),
            "hyperparams": hyperparams,
            "metrics": metrics,
            "feature_names": feature_names,
            "training_rows": len(X_train),
        }

        with open(run_dir / "metadata.json", "w") as f:
            json.dump(run_metadata, f, indent=2)

        return run_metadata
```

---

## Step 4: Model Registry

```python
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
import json
import shutil


class ModelStage(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    ARCHIVED = "archived"


@dataclass
class RegisteredModel:
    name: str
    version: str
    stage: ModelStage
    metrics: dict
    artifact_path: str
    registered_at: str


class ModelRegistry:
    def __init__(self, registry_dir: str):
        self.registry_dir = Path(registry_dir)
        self.registry_dir.mkdir(parents=True, exist_ok=True)
        self.registry_file = self.registry_dir / "registry.json"
        self._load()

    def _load(self):
        if self.registry_file.exists():
            with open(self.registry_file) as f:
                self.models = json.load(f)
        else:
            self.models = {}

    def _save(self):
        with open(self.registry_file, "w") as f:
            json.dump(self.models, f, indent=2)

    def register(
        self,
        name: str,
        version: str,
        artifact_path: str,
        metrics: dict,
    ) -> RegisteredModel:
        dest = self.registry_dir / name / version
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(artifact_path, dest / "model.joblib")

        entry = {
            "name": name,
            "version": version,
            "stage": ModelStage.DEVELOPMENT.value,
            "metrics": metrics,
            "artifact_path": str(dest / "model.joblib"),
            "registered_at": datetime.utcnow().isoformat(),
        }

        key = f"{name}/{version}"
        self.models[key] = entry
        self._save()

        return RegisteredModel(**entry)

    def promote(self, name: str, version: str, stage: ModelStage):
        key = f"{name}/{version}"
        if key not in self.models:
            raise ValueError(f"Model {key} not found")

        if stage == ModelStage.PRODUCTION:
            for k, v in self.models.items():
                if k.startswith(f"{name}/") and v["stage"] == ModelStage.PRODUCTION.value:
                    v["stage"] = ModelStage.ARCHIVED.value

        self.models[key]["stage"] = stage.value
        self._save()

    def get_production_model(self, name: str) -> RegisteredModel | None:
        for k, v in self.models.items():
            if k.startswith(f"{name}/") and v["stage"] == ModelStage.PRODUCTION.value:
                return RegisteredModel(**v)
        return None
```

---

## Step 5: Serving

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
import joblib
import numpy as np

app = FastAPI(title="Fraud Detection API")


class Transaction(BaseModel):
    amount: float
    hour_of_day: int
    day_of_week: int
    is_weekend: int
    is_night: int
    user_avg_amount: float
    user_std_amount: float
    user_tx_count: int
    amount_zscore: float
    log_amount: float

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class PredictionResponse(BaseModel):
    fraud_probability: float
    is_fraud: bool
    model_version: str


model = None
model_version = "unknown"


@app.on_event("startup")
def load_model():
    global model, model_version
    model = joblib.load("model.joblib")
    model_version = "v1.0"


@app.post("/predict", response_model=PredictionResponse)
def predict(transaction: Transaction):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    features = np.array([[
        transaction.amount, transaction.log_amount,
        transaction.hour_of_day, transaction.day_of_week,
        transaction.is_weekend, transaction.is_night,
        transaction.user_avg_amount, transaction.user_std_amount,
        transaction.user_tx_count, transaction.amount_zscore,
    ]])

    probability = model.predict_proba(features)[0][1]

    return PredictionResponse(
        fraud_probability=float(probability),
        is_fraud=probability > 0.5,
        model_version=model_version,
    )


@app.get("/health")
def health():
    return {"status": "healthy", "model_loaded": model is not None}
```

---

## Step 6: Monitoring

```python
from collections import deque
from datetime import datetime, timedelta
import numpy as np


class ModelMonitor:
    def __init__(self, window_size: int = 1000):
        self.predictions = deque(maxlen=window_size)
        self.actuals = deque(maxlen=window_size)
        self.latencies = deque(maxlen=window_size)
        self.feature_distributions: dict[str, deque] = {}
        self.alerts: list[dict] = []

    def log_prediction(
        self,
        features: dict,
        prediction: float,
        latency_ms: float,
        actual: float | None = None,
    ):
        self.predictions.append(prediction)
        self.latencies.append(latency_ms)
        if actual is not None:
            self.actuals.append(actual)

        for name, value in features.items():
            if name not in self.feature_distributions:
                self.feature_distributions[name] = deque(maxlen=1000)
            self.feature_distributions[name].append(value)

    def check_prediction_drift(self, baseline_mean: float, threshold: float = 0.1):
        if len(self.predictions) < 100:
            return None

        current_mean = np.mean(list(self.predictions))
        drift = abs(current_mean - baseline_mean)

        if drift > threshold:
            alert = {
                "type": "prediction_drift",
                "timestamp": datetime.utcnow().isoformat(),
                "baseline_mean": baseline_mean,
                "current_mean": float(current_mean),
                "drift": float(drift),
            }
            self.alerts.append(alert)
            return alert
        return None

    def check_latency(self, p99_threshold_ms: float = 100.0):
        if len(self.latencies) < 50:
            return None

        p99 = float(np.percentile(list(self.latencies), 99))
        if p99 > p99_threshold_ms:
            alert = {
                "type": "high_latency",
                "timestamp": datetime.utcnow().isoformat(),
                "p99_latency_ms": p99,
                "threshold_ms": p99_threshold_ms,
            }
            self.alerts.append(alert)
            return alert
        return None

    def get_metrics(self) -> dict:
        return {
            "prediction_count": len(self.predictions),
            "mean_prediction": float(np.mean(list(self.predictions))) if self.predictions else 0,
            "mean_latency_ms": float(np.mean(list(self.latencies))) if self.latencies else 0,
            "p99_latency_ms": float(np.percentile(list(self.latencies), 99)) if len(self.latencies) > 1 else 0,
            "alert_count": len(self.alerts),
        }
```

---

## Step 7: Retraining Trigger

```python
class RetrainingTrigger:
    def __init__(
        self,
        performance_threshold: float = 0.8,
        drift_threshold: float = 0.15,
        staleness_days: int = 30,
    ):
        self.performance_threshold = performance_threshold
        self.drift_threshold = drift_threshold
        self.staleness_days = staleness_days

    def should_retrain(
        self,
        current_f1: float | None,
        prediction_drift: float,
        days_since_training: int,
    ) -> tuple[bool, str]:
        if current_f1 is not None and current_f1 < self.performance_threshold:
            return True, f"F1 dropped to {current_f1:.3f} (threshold: {self.performance_threshold})"

        if prediction_drift > self.drift_threshold:
            return True, f"Prediction drift: {prediction_drift:.3f} (threshold: {self.drift_threshold})"

        if days_since_training > self.staleness_days:
            return True, f"Model is {days_since_training} days old (threshold: {self.staleness_days})"

        return False, "No retraining needed"
```

---

## Putting It All Together

```
  Automated MLOps cycle:

  +-------+    +----------+    +---------+    +----------+
  | Data  | -> | Feature  | -> | Train   | -> | Evaluate |
  | Ingest|    | Engineer |    |         |    |          |
  +-------+    +----------+    +---------+    +-----+----+
                                                     |
       +---------------------------------------------+
       |
       v
  +---------+    +---------+    +---------+    +----------+
  | Register| -> | Deploy  | -> | Monitor | -> | Retrain? |
  | Model   |    | (Canary)|    |         |    | Trigger  |
  +---------+    +---------+    +---------+    +-----+----+
                                                     |
                                                     v
                                              YES: go to Train
                                              NO: continue monitoring
```

---

## Exercises

1. **Full pipeline**: Implement all 7 steps above for a dataset
   of your choice (fraud, churn, spam, etc.). Generate synthetic
   data if needed.

2. **CI/CD**: Create a GitHub Actions workflow that runs data
   validation, trains the model, evaluates metrics, and deploys
   if metrics pass a threshold.

3. **Canary deployment**: Implement canary deployment that routes
   5% of traffic to the new model. Compare metrics between old
   and new models before full rollout.

4. **Automated retraining**: Set up a cron job that checks
   monitoring metrics daily. If retraining triggers fire,
   automatically run the training pipeline and deploy.

5. **Dashboard**: Build a monitoring dashboard (Streamlit or
   Grafana) showing real-time metrics: prediction distribution,
   latency percentiles, feature drift, and model performance
   over time.

---

**Next**: [Reference - MLOps Tools](./reference-tools.md)
