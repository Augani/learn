# Lesson 11: Model Monitoring

## Check Engine Light for Your Model

```
  Your Car                         Your Model
  +------------------------+       +------------------------+
  | Dashboard lights:      |       | Monitoring alerts:     |
  | - Check engine         |       | - Prediction drift     |
  | - Low oil              |       | - Data drift           |
  | - Battery              |       | - Latency spike        |
  | - Tire pressure        |       | - Error rate           |
  |                        |       |                        |
  | Without them: engine   |       | Without them: model    |
  | seizes on the highway  |       | fails silently for     |
  |                        |       | weeks before anyone    |
  |                        |       | notices                |
  +------------------------+       +------------------------+
```

A model in production is like a car engine. It can degrade
slowly and silently. By the time someone notices, the damage is
done. Monitoring is your **dashboard** -- it catches problems
before they become disasters.

---

## What to Monitor

```
  +----------------------------------------------------------+
  |                  ML Monitoring Stack                       |
  |                                                          |
  | Layer 1: Infrastructure                                   |
  | +------------------------------------------------------+ |
  | | CPU/GPU usage | Memory | Latency | Error rate | QPS  | |
  | +------------------------------------------------------+ |
  |                                                          |
  | Layer 2: Data Quality                                     |
  | +------------------------------------------------------+ |
  | | Schema changes | Missing values | Distribution shift | |
  | +------------------------------------------------------+ |
  |                                                          |
  | Layer 3: Model Performance                                |
  | +------------------------------------------------------+ |
  | | Prediction drift | Accuracy decay | Confidence dist  | |
  | +------------------------------------------------------+ |
  |                                                          |
  | Layer 4: Business Metrics                                 |
  | +------------------------------------------------------+ |
  | | Click-through | Conversion | Revenue | User feedback  | |
  | +------------------------------------------------------+ |
  +----------------------------------------------------------+
```

---

## Data Drift Detection

Data drift is when your input data changes over time.

```
  Training Data Distribution     Production Data (3 months later)

  Amount ($):                    Amount ($):
  ........                       .......
  ........:::                    ...::::::::
  ....::::::::.                  ..:::::::::::::
  ..:::::::::::::                ::::::::::::::::::::
  +---------+-------+            +----------+----------+
  0        100     200           0         200        500

  The data has shifted right -- users spend more now.
  Your model was trained on the old distribution.
  It may not perform well on the new one.
```

### Detecting Drift with Statistics

```python
import numpy as np
from scipy import stats
from dataclasses import dataclass


@dataclass
class DriftResult:
    feature_name: str
    statistic: float
    p_value: float
    is_drifted: bool
    method: str


def detect_drift_ks(
    reference: np.ndarray,
    current: np.ndarray,
    feature_name: str,
    threshold: float = 0.05,
) -> DriftResult:
    statistic, p_value = stats.ks_2samp(reference, current)
    return DriftResult(
        feature_name=feature_name,
        statistic=statistic,
        p_value=p_value,
        is_drifted=p_value < threshold,
        method="kolmogorov-smirnov",
    )


def detect_drift_psi(
    reference: np.ndarray,
    current: np.ndarray,
    feature_name: str,
    n_bins: int = 10,
    threshold: float = 0.2,
) -> DriftResult:
    breakpoints = np.linspace(
        min(reference.min(), current.min()),
        max(reference.max(), current.max()),
        n_bins + 1,
    )

    ref_counts = np.histogram(reference, bins=breakpoints)[0] / len(reference)
    cur_counts = np.histogram(current, bins=breakpoints)[0] / len(current)

    ref_counts = np.clip(ref_counts, 1e-6, None)
    cur_counts = np.clip(cur_counts, 1e-6, None)

    psi = np.sum((cur_counts - ref_counts) * np.log(cur_counts / ref_counts))

    return DriftResult(
        feature_name=feature_name,
        statistic=psi,
        p_value=0.0,
        is_drifted=psi > threshold,
        method="population-stability-index",
    )


def monitor_all_features(
    reference_df,
    current_df,
    numerical_columns: list[str],
) -> list[DriftResult]:
    results = []
    for col in numerical_columns:
        result = detect_drift_ks(
            reference_df[col].values,
            current_df[col].values,
            feature_name=col,
        )
        results.append(result)
    return results
```

---

## Prediction Drift

```
  Week 1:  Positive: 60%  Negative: 40%   (normal)
  Week 2:  Positive: 62%  Negative: 38%   (normal)
  Week 3:  Positive: 58%  Negative: 42%   (normal)
  Week 4:  Positive: 85%  Negative: 15%   (ALERT!)

  The model's prediction distribution changed dramatically.
  Something is wrong -- either the data or the model.
```

```python
from collections import Counter
from datetime import datetime, timezone


class PredictionMonitor:
    def __init__(self, window_size: int = 1000):
        self.window_size = window_size
        self.predictions: list[dict] = []
        self.reference_distribution: dict[str, float] = {}

    def set_reference(self, distribution: dict[str, float]):
        self.reference_distribution = distribution

    def log_prediction(self, label: str, confidence: float):
        self.predictions.append({
            "label": label,
            "confidence": confidence,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        if len(self.predictions) > self.window_size * 2:
            self.predictions = self.predictions[-self.window_size:]

    def get_current_distribution(self) -> dict[str, float]:
        recent = self.predictions[-self.window_size:]
        if not recent:
            return {}
        counts = Counter(p["label"] for p in recent)
        total = sum(counts.values())
        return {label: count / total for label, count in counts.items()}

    def check_prediction_drift(self, threshold: float = 0.1) -> dict:
        current = self.get_current_distribution()
        if not current or not self.reference_distribution:
            return {"drifted": False, "reason": "insufficient data"}

        drifts = {}
        for label in set(list(current.keys()) + list(self.reference_distribution.keys())):
            ref_pct = self.reference_distribution.get(label, 0)
            cur_pct = current.get(label, 0)
            diff = abs(cur_pct - ref_pct)
            drifts[label] = {"reference": ref_pct, "current": cur_pct, "diff": diff}

        max_drift = max(d["diff"] for d in drifts.values())

        return {
            "drifted": max_drift > threshold,
            "max_drift": max_drift,
            "details": drifts,
        }
```

---

## Performance Monitoring with Prometheus

```
  Application        Prometheus         Grafana
  +----------+       +----------+       +----------+
  | Expose   | <---- | Scrape   | ----> | Visualize|
  | /metrics |       | metrics  |       | Dashboard|
  | endpoint |       | every 15s|       | Alerts   |
  +----------+       +----------+       +----------+
```

```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server


PREDICTION_COUNT = Counter(
    "model_predictions_total",
    "Total number of predictions",
    ["model_name", "label"],
)

PREDICTION_LATENCY = Histogram(
    "model_prediction_duration_seconds",
    "Time spent on prediction",
    ["model_name"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)

PREDICTION_CONFIDENCE = Histogram(
    "model_prediction_confidence",
    "Distribution of prediction confidence",
    ["model_name", "label"],
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99],
)

MODEL_LOADED = Gauge(
    "model_loaded",
    "Whether model is loaded",
    ["model_name", "version"],
)


def predict_with_metrics(model, inputs: dict, model_name: str) -> dict:
    import time

    start = time.perf_counter()
    result = model.predict(inputs)
    duration = time.perf_counter() - start

    PREDICTION_COUNT.labels(
        model_name=model_name,
        label=result["label"],
    ).inc()

    PREDICTION_LATENCY.labels(model_name=model_name).observe(duration)

    PREDICTION_CONFIDENCE.labels(
        model_name=model_name,
        label=result["label"],
    ).observe(result["confidence"])

    return result


start_http_server(9090)
```

---

## Alerting Rules

```
  Alert Level     Condition                    Action
  +--------------+---------------------------+------------------+
  | INFO         | Confidence avg < 0.7      | Log, investigate |
  | WARNING      | Data drift detected       | Notify team      |
  | CRITICAL     | Error rate > 5%           | Page on-call     |
  | CRITICAL     | Latency p99 > 500ms       | Page on-call     |
  | EMERGENCY    | Model returns same answer | Rollback now     |
  |              | for all inputs            |                  |
  +--------------+---------------------------+------------------+
```

```python
from enum import Enum
from dataclasses import dataclass


class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


@dataclass
class Alert:
    level: AlertLevel
    message: str
    metric_name: str
    current_value: float
    threshold: float


class AlertManager:
    def __init__(self):
        self.rules: list[dict] = []
        self.fired_alerts: list[Alert] = []

    def add_rule(
        self,
        metric_name: str,
        threshold: float,
        comparison: str,
        level: AlertLevel,
        message: str,
    ):
        self.rules.append({
            "metric_name": metric_name,
            "threshold": threshold,
            "comparison": comparison,
            "level": level,
            "message": message,
        })

    def evaluate(self, metrics: dict[str, float]) -> list[Alert]:
        alerts = []
        for rule in self.rules:
            value = metrics.get(rule["metric_name"])
            if value is None:
                continue

            triggered = False
            if rule["comparison"] == ">" and value > rule["threshold"]:
                triggered = True
            elif rule["comparison"] == "<" and value < rule["threshold"]:
                triggered = True

            if triggered:
                alert = Alert(
                    level=rule["level"],
                    message=rule["message"],
                    metric_name=rule["metric_name"],
                    current_value=value,
                    threshold=rule["threshold"],
                )
                alerts.append(alert)

        self.fired_alerts.extend(alerts)
        return alerts
```

---

## Monitoring Dashboard Layout

```
  +----------------------------------------------------------+
  | Model: fraud-detector v2.3           Status: HEALTHY     |
  +----------------------------------------------------------+
  |                                                          |
  | Request Rate          Latency (p50/p95/p99)              |
  | +-------------------+ +-------------------+              |
  | |     ___           | |  p99  ___         |              |
  | |   _/   \_         | |      /   \        |              |
  | |  /      \___      | |  p95/     \___    |              |
  | | /           \     | |  p50           \  |              |
  | +-------------------+ +-------------------+              |
  |                                                          |
  | Prediction Distribution   Data Drift Score               |
  | +-------------------+     +-------------------+          |
  | | pos: 58% neg: 42% |     | Feature A: 0.02  |          |
  | | [========|======]  |     | Feature B: 0.15  |          |
  | |                   |     | Feature C: 0.45* |<-- ALERT  |
  | +-------------------+     +-------------------+          |
  |                                                          |
  | Error Rate                Confidence Distribution        |
  | +-------------------+     +-------------------+          |
  | |              _    |     |    ___             |          |
  | |             / \   |     |   /   \            |          |
  | |  __________/   \  |     |  /     \___        |          |
  | +-------------------+     +-------------------+          |
  +----------------------------------------------------------+
```

---

## Exercises

1. **Drift Detector**: Generate two synthetic datasets where one
   is shifted. Run KS-test and PSI drift detection. Verify both
   methods detect the drift.

2. **Prediction Monitor**: Implement the `PredictionMonitor`
   class. Feed it 1000 normal predictions, then 100 anomalous
   ones. Verify it triggers a drift alert.

3. **Prometheus Metrics**: Add Prometheus metrics to a FastAPI
   model server. Use `curl localhost:9090/metrics` to verify
   counters and histograms are updating.

4. **Alert Rules**: Configure 5 alert rules for a model server
   (error rate, latency, drift, confidence, throughput). Write
   a test that simulates each condition and verifies the alert.

---

[Next: Lesson 12 - A/B Testing for ML -->](12-ab-testing-ml.md)
