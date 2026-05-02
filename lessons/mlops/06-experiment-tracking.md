# Lesson 06: Experiment Tracking

## A Lab Notebook for Scientists

```
  Without Tracking               With Tracking
  +------------------------+     +------------------------+
  | model_v2_final.pt      |     | Run #47                |
  | model_v2_final2.pt     |     |  lr=0.001, bs=32       |
  | model_REALLY_final.pt  |     |  acc=0.94, loss=0.12   |
  | model_v3_test.pt       |     |  dataset: v3.2         |
  | which_one_worked.pt    |     |  commit: a3f2b1c       |
  +------------------------+     +------------------------+
  3 AM you                        Professional you
```

Imagine a scientist who never writes in their lab notebook. They
run experiments, see results, but three weeks later have no idea
what worked or why. Experiment tracking is that **lab notebook**
-- it records every detail of every experiment automatically.

---

## What to Track

```
  +----------------------------------------------------------+
  |                     Experiment Run                        |
  |                                                          |
  |  Parameters (inputs)      Metrics (outputs)              |
  |  +-------------------+    +-------------------+          |
  |  | learning_rate     |    | accuracy          |          |
  |  | batch_size        |    | loss              |          |
  |  | num_epochs        |    | f1_score          |          |
  |  | model_type        |    | latency_ms        |          |
  |  | dropout_rate      |    | memory_usage_mb   |          |
  |  +-------------------+    +-------------------+          |
  |                                                          |
  |  Artifacts (files)        Metadata (context)             |
  |  +-------------------+    +-------------------+          |
  |  | model weights     |    | git commit        |          |
  |  | config files      |    | dataset version   |          |
  |  | plots/charts      |    | hardware info     |          |
  |  | requirements.txt  |    | timestamp         |          |
  |  +-------------------+    +-------------------+          |
  +----------------------------------------------------------+
```

---

## MLflow: The Open-Source Standard

```
  MLflow Components
  +--------------------------------------------------+
  |                                                    |
  |  Tracking       Models        Registry             |
  |  +----------+   +----------+   +----------+       |
  |  | Log runs |   | Package  |   | Version  |       |
  |  | metrics  |   | models   |   | Stage    |       |
  |  | params   |   | flavors  |   | Promote  |       |
  |  +----------+   +----------+   +----------+       |
  |                                                    |
  |  Projects       Evaluate                           |
  |  +----------+   +----------+                       |
  |  | Package  |   | Compare  |                       |
  |  | code     |   | models   |                       |
  |  +----------+   +----------+                       |
  +--------------------------------------------------+
```

### Basic MLflow Tracking

```python
import mlflow
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score

mlflow.set_tracking_uri("http://localhost:5000")
mlflow.set_experiment("fraud-detection")

X, y = make_classification(n_samples=10000, n_features=20, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

params = {
    "n_estimators": 100,
    "max_depth": 10,
    "min_samples_split": 5,
}

with mlflow.start_run(run_name="rf-baseline"):
    mlflow.log_params(params)

    model = RandomForestClassifier(**params, random_state=42)
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    f1 = f1_score(y_test, predictions)

    mlflow.log_metric("accuracy", accuracy)
    mlflow.log_metric("f1_score", f1)
    mlflow.log_metric("train_samples", len(X_train))

    mlflow.sklearn.log_model(model, "model")
```

### Logging Metrics Over Time

```python
import numpy as np


def train_with_tracking(model, train_loader, val_loader, epochs: int):
    with mlflow.start_run():
        mlflow.log_param("epochs", epochs)
        mlflow.log_param("model_type", model.__class__.__name__)

        for epoch in range(epochs):
            train_loss = train_one_epoch(model, train_loader)
            val_loss, val_acc = evaluate(model, val_loader)

            mlflow.log_metrics(
                {
                    "train_loss": train_loss,
                    "val_loss": val_loss,
                    "val_accuracy": val_acc,
                },
                step=epoch,
            )

            if val_loss < best_loss:
                best_loss = val_loss
                mlflow.log_metric("best_val_loss", best_loss)
                mlflow.pytorch.log_model(model, "best_model")
```

### MLflow Model Registry

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

result = mlflow.register_model(
    model_uri="runs:/abc123def/model",
    name="fraud-detector",
)

client.transition_model_version_stage(
    name="fraud-detector",
    version=result.version,
    stage="Staging",
)

client.transition_model_version_stage(
    name="fraud-detector",
    version=result.version,
    stage="Production",
)
```

```
  Model Lifecycle in Registry

  None --> Staging --> Production --> Archived
           (test)      (live)        (retired)

  Like a restaurant dish:
  Recipe Dev --> Taste Test --> On the Menu --> Off the Menu
```

---

## Weights & Biases (W&B)

The more feature-rich (and commercial) alternative.

```
  W&B Features
  +--------------------------------------------------+
  | - Real-time dashboards                             |
  | - Hyperparameter sweep                             |
  | - Dataset versioning (Artifacts)                   |
  | - Collaborative reports                            |
  | - Model registry                                   |
  | - GPU/system monitoring built-in                   |
  +--------------------------------------------------+
```

### Basic W&B Logging

```python
import wandb


def train_with_wandb(config: dict):
    wandb.init(
        project="fraud-detection",
        name="rf-experiment-1",
        config=config,
    )

    model = build_model(config)

    for epoch in range(config["epochs"]):
        train_loss = train_one_epoch(model)
        val_loss, val_acc = evaluate(model)

        wandb.log({
            "epoch": epoch,
            "train_loss": train_loss,
            "val_loss": val_loss,
            "val_accuracy": val_acc,
        })

    wandb.finish()
```

### W&B Sweeps (Hyperparameter Search)

```python
sweep_config = {
    "method": "bayes",
    "metric": {"name": "val_accuracy", "goal": "maximize"},
    "parameters": {
        "learning_rate": {"min": 0.0001, "max": 0.01},
        "batch_size": {"values": [16, 32, 64, 128]},
        "dropout": {"min": 0.1, "max": 0.5},
        "hidden_size": {"values": [128, 256, 512]},
    },
}


def sweep_train():
    wandb.init()
    config = wandb.config

    model = build_model(config)
    train_and_evaluate(model, config)

    wandb.finish()


sweep_id = wandb.sweep(sweep_config, project="fraud-detection")
wandb.agent(sweep_id, function=sweep_train, count=50)
```

---

## Building a Tracking Wrapper

For consistency across tools, wrap your tracking calls:

```python
from abc import ABC, abstractmethod
from typing import Any


class ExperimentTracker(ABC):
    @abstractmethod
    def log_params(self, params: dict[str, Any]) -> None:
        ...

    @abstractmethod
    def log_metrics(self, metrics: dict[str, float], step: int | None = None) -> None:
        ...

    @abstractmethod
    def log_artifact(self, local_path: str, name: str) -> None:
        ...

    @abstractmethod
    def end_run(self) -> None:
        ...


class MLflowTracker(ExperimentTracker):
    def __init__(self, experiment_name: str):
        mlflow.set_experiment(experiment_name)
        mlflow.start_run()

    def log_params(self, params: dict[str, Any]) -> None:
        mlflow.log_params(params)

    def log_metrics(self, metrics: dict[str, float], step: int | None = None) -> None:
        mlflow.log_metrics(metrics, step=step)

    def log_artifact(self, local_path: str, name: str) -> None:
        mlflow.log_artifact(local_path)

    def end_run(self) -> None:
        mlflow.end_run()


class WandbTracker(ExperimentTracker):
    def __init__(self, project: str, config: dict | None = None):
        wandb.init(project=project, config=config)

    def log_params(self, params: dict[str, Any]) -> None:
        wandb.config.update(params)

    def log_metrics(self, metrics: dict[str, float], step: int | None = None) -> None:
        if step is not None:
            metrics["step"] = step
        wandb.log(metrics)

    def log_artifact(self, local_path: str, name: str) -> None:
        artifact = wandb.Artifact(name, type="model")
        artifact.add_file(local_path)
        wandb.log_artifact(artifact)

    def end_run(self) -> None:
        wandb.finish()
```

---

## Comparing Experiments

```
  Run   | lr      | batch | accuracy | f1    | loss
  ------|---------|-------|----------|-------|------
  #1    | 0.001   | 32    | 0.89     | 0.87  | 0.31
  #2    | 0.0001  | 64    | 0.92     | 0.91  | 0.22
  #3    | 0.001   | 64    | 0.91     | 0.90  | 0.24
  #4    | 0.0005  | 32    | 0.93     | 0.92  | 0.19  <-- best
  #5    | 0.0005  | 128   | 0.90     | 0.88  | 0.28

  Tracking lets you see this table instead of
  scrolling through terminal output.
```

### Querying Past Runs

```python
runs = mlflow.search_runs(
    experiment_names=["fraud-detection"],
    filter_string="metrics.accuracy > 0.9",
    order_by=["metrics.f1_score DESC"],
    max_results=10,
)

print(runs[["params.learning_rate", "metrics.accuracy", "metrics.f1_score"]])

best_run = runs.iloc[0]
best_model = mlflow.sklearn.load_model(f"runs:/{best_run.run_id}/model")
```

---

## Self-Hosted MLflow Setup

```
  +----------+     +----------+     +----------+
  | Training |---->| MLflow   |---->| Postgres |
  | Scripts  |     | Server   |     | (metadata|
  +----------+     +----------+     |  store)  |
                        |           +----------+
                        |
                        v
                   +----------+
                   | S3/MinIO |
                   | (artifact|
                   |  store)  |
                   +----------+
```

```bash
mlflow server \
  --backend-store-uri postgresql://user:pass@localhost/mlflow \
  --default-artifact-root s3://mlflow-artifacts/ \
  --host 0.0.0.0 \
  --port 5000
```

---

## Exercises

1. **MLflow Basics**: Set up a local MLflow server. Train 5
   variations of a model (different hyperparams), log everything,
   and use the UI to find the best run.

2. **Auto-Logging**: Use `mlflow.autolog()` with sklearn and
   PyTorch. Compare what gets logged automatically vs manually.

3. **Model Registry**: Register your best model, promote it
   through Staging to Production, then load it from the registry
   in a separate script.

4. **Tracker Abstraction**: Implement the `ExperimentTracker`
   interface above. Write a training loop that works with either
   MLflow or W&B by swapping one line.

---

[Next: Lesson 07 - Data Versioning -->](07-data-versioning.md)
