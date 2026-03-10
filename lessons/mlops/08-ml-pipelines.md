# Lesson 08: ML Pipelines

## Factory Assembly Lines

```
  Car Factory Assembly Line
  +--------+   +--------+   +--------+   +--------+   +--------+
  | Weld   |-->| Paint  |-->| Engine |-->| Test   |-->| Ship   |
  | Frame  |   | Body   |   | Install|   | Drive  |   |        |
  +--------+   +--------+   +--------+   +--------+   +--------+

  ML Pipeline
  +--------+   +--------+   +--------+   +--------+   +--------+
  | Ingest |-->| Clean  |-->| Train  |-->| Eval   |-->| Deploy |
  | Data   |   | & Feat |   | Model  |   | Model  |   | Model  |
  +--------+   +--------+   +--------+   +--------+   +--------+
```

An ML pipeline is like a **factory assembly line**. Each station
does one job, passes the result to the next station, and the whole
thing runs reliably without someone manually carrying parts around.

Without a pipeline, you're carrying car parts by hand between
stations. It works for one car, but not for thousands.

---

## What is a DAG?

Most pipelines are structured as Directed Acyclic Graphs (DAGs).

```
  DAG = Directed Acyclic Graph
  "Directed" = tasks flow one way (arrows)
  "Acyclic"  = no loops (can't go back to start)

  Simple linear:
  A --> B --> C --> D

  With parallel branches:
        +--> B --+
  A --> |        +--> D --> E
        +--> C --+

  With fan-out:
        +--> B
  A --> +--> C
        +--> D

  Think of it like a recipe:
  You can chop onions and boil water at the same time,
  but you can't eat dinner before cooking it.
```

---

## Apache Airflow

The most widely used pipeline orchestrator. Originally built
by Airbnb.

```
  Airflow Architecture
  +--------------------------------------------------+
  |  Web UI          Scheduler        Workers         |
  |  +----------+    +----------+    +----------+    |
  |  | View DAGs|    | Trigger  |    | Execute  |    |
  |  | Logs     |    | tasks    |    | tasks    |    |
  |  | Status   |    | on time  |    | in queue |    |
  |  +----------+    +----------+    +----------+    |
  |                       |               ^           |
  |                       v               |           |
  |                  +----------+         |           |
  |                  | Metadata |         |           |
  |                  | DB       |---------+           |
  |                  +----------+                     |
  +--------------------------------------------------+
```

### Airflow ML Pipeline

```python
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator


default_args = {
    "owner": "ml-team",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

dag = DAG(
    dag_id="ml_training_pipeline",
    default_args=default_args,
    description="Daily model retraining pipeline",
    schedule_interval="0 6 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["ml", "training"],
)


def validate_data(**kwargs):
    import pandas as pd

    df = pd.read_parquet("s3://data-lake/daily/latest.parquet")
    row_count = len(df)

    if row_count < 1000:
        raise ValueError(f"Too few rows: {row_count}")

    null_pct = df.isnull().sum().sum() / (row_count * len(df.columns))
    if null_pct > 0.1:
        raise ValueError(f"Too many nulls: {null_pct:.1%}")

    kwargs["ti"].xcom_push(key="row_count", value=row_count)


def train_model(**kwargs):
    import mlflow
    from sklearn.ensemble import GradientBoostingClassifier

    row_count = kwargs["ti"].xcom_pull(key="row_count")

    with mlflow.start_run():
        model = GradientBoostingClassifier(n_estimators=200)
        mlflow.log_param("input_rows", row_count)


def evaluate_model(**kwargs):
    accuracy = 0.92
    threshold = 0.85

    if accuracy < threshold:
        raise ValueError(f"Model accuracy {accuracy} below threshold {threshold}")

    kwargs["ti"].xcom_push(key="accuracy", value=accuracy)


validate = PythonOperator(
    task_id="validate_data",
    python_callable=validate_data,
    dag=dag,
)

train = PythonOperator(
    task_id="train_model",
    python_callable=train_model,
    dag=dag,
)

evaluate = PythonOperator(
    task_id="evaluate_model",
    python_callable=evaluate_model,
    dag=dag,
)

deploy = BashOperator(
    task_id="deploy_model",
    bash_command="python deploy.py --model-version latest",
    dag=dag,
)

validate >> train >> evaluate >> deploy
```

---

## Prefect

A more modern, Python-native alternative to Airflow.

```
  Airflow                          Prefect
  +----------------------------+   +----------------------------+
  | DAG files on disk          |   | Python scripts anywhere    |
  | Separate scheduler         |   | Built-in orchestration     |
  | Complex setup              |   | pip install prefect        |
  | Battle-tested at scale     |   | Great developer experience |
  +----------------------------+   +----------------------------+
```

### Prefect ML Pipeline

```python
from prefect import flow, task
from prefect.tasks import task_input_hash
from datetime import timedelta


@task(
    retries=3,
    retry_delay_seconds=60,
    cache_key_fn=task_input_hash,
    cache_expiration=timedelta(hours=1),
)
def fetch_data(source: str) -> dict:
    import pandas as pd

    df = pd.read_parquet(source)
    return {"data": df, "rows": len(df)}


@task(retries=2)
def preprocess(data_info: dict) -> dict:
    df = data_info["data"]
    df = df.dropna()
    df = df.drop_duplicates()
    return {"data": df, "rows": len(df)}


@task(log_prints=True)
def train(data_info: dict, learning_rate: float) -> dict:
    import mlflow

    df = data_info["data"]
    print(f"Training on {len(df)} rows with lr={learning_rate}")

    with mlflow.start_run():
        mlflow.log_param("lr", learning_rate)
        mlflow.log_metric("accuracy", 0.93)

    return {"model_id": "abc123", "accuracy": 0.93}


@task
def evaluate(model_info: dict, threshold: float) -> bool:
    if model_info["accuracy"] < threshold:
        raise ValueError(f"Accuracy {model_info['accuracy']} below {threshold}")
    return True


@task
def deploy(model_info: dict) -> str:
    return f"Deployed model {model_info['model_id']}"


@flow(name="ml-training-pipeline")
def training_pipeline(
    data_source: str = "s3://data/latest.parquet",
    learning_rate: float = 0.001,
    accuracy_threshold: float = 0.85,
):
    raw_data = fetch_data(data_source)
    clean_data = preprocess(raw_data)
    model = train(clean_data, learning_rate)
    passed = evaluate(model, accuracy_threshold)
    if passed:
        deploy(model)


if __name__ == "__main__":
    training_pipeline()
```

---

## Kubeflow Pipelines

Built for Kubernetes. Each step runs in its own container.

```
  Kubeflow Pipeline
  +--------------------------------------------------+
  |  Kubernetes Cluster                               |
  |                                                    |
  |  +--------+   +--------+   +--------+             |
  |  | Pod:   |-->| Pod:   |-->| Pod:   |            |
  |  | data   |   | train  |   | eval   |            |
  |  | prep   |   | (GPU)  |   |        |            |
  |  +--------+   +--------+   +--------+            |
  |                                                    |
  |  Each pod = separate container with its own        |
  |  dependencies, resources, and isolation            |
  +--------------------------------------------------+
```

### Kubeflow Pipeline Definition

```python
from kfp import dsl
from kfp.dsl import Input, Output, Dataset, Model, Metrics


@dsl.component(
    base_image="python:3.11-slim",
    packages_to_install=["pandas", "pyarrow"],
)
def prepare_data(
    input_path: str,
    output_data: Output[Dataset],
):
    import pandas as pd

    df = pd.read_parquet(input_path)
    df = df.dropna()
    df.to_parquet(output_data.path)


@dsl.component(
    base_image="pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime",
    packages_to_install=["scikit-learn"],
)
def train_model(
    training_data: Input[Dataset],
    model_output: Output[Model],
    learning_rate: float = 0.001,
):
    import pickle
    import pandas as pd
    from sklearn.ensemble import GradientBoostingClassifier

    df = pd.read_parquet(training_data.path)
    X = df.drop("label", axis=1)
    y = df["label"]

    model = GradientBoostingClassifier(learning_rate=learning_rate)
    model.fit(X, y)

    with open(model_output.path, "wb") as f:
        pickle.dump(model, f)


@dsl.component(base_image="python:3.11-slim", packages_to_install=["scikit-learn"])
def evaluate_model(
    model_input: Input[Model],
    test_data: Input[Dataset],
    metrics_output: Output[Metrics],
    threshold: float = 0.85,
):
    import pickle
    import pandas as pd
    from sklearn.metrics import accuracy_score

    with open(model_input.path, "rb") as f:
        model = pickle.load(f)

    df = pd.read_parquet(test_data.path)
    X = df.drop("label", axis=1)
    y = df["label"]

    accuracy = accuracy_score(y, model.predict(X))
    metrics_output.log_metric("accuracy", accuracy)

    if accuracy < threshold:
        raise ValueError(f"Below threshold: {accuracy:.3f} < {threshold}")


@dsl.pipeline(name="ml-training-pipeline")
def ml_pipeline(
    data_path: str = "gs://bucket/data.parquet",
    learning_rate: float = 0.001,
):
    prep_task = prepare_data(input_path=data_path)
    train_task = train_model(
        training_data=prep_task.outputs["output_data"],
        learning_rate=learning_rate,
    )
    evaluate_model(
        model_input=train_task.outputs["model_output"],
        test_data=prep_task.outputs["output_data"],
    )
```

---

## Pipeline Patterns

```
  Pattern 1: Linear
  A --> B --> C --> D
  Simple, easy to debug.

  Pattern 2: Fan-out / Fan-in
        +--> B (GPU train) --+
  A --> |                     +--> E (compare)
        +--> C (GPU train) --+
        |                     |
        +--> D (GPU train) --+
  Train multiple models in parallel.

  Pattern 3: Conditional
  A --> B --> [accuracy > 0.9?]
                  |          |
                 YES         NO
                  |          |
                  v          v
              Deploy     Alert team

  Pattern 4: Retry with backoff
  A --> B --> [failed?] --> wait --> B (retry)
                  |
                 NO
                  v
                  C
```

---

## Choosing an Orchestrator

```
  Tool      | Best For             | Complexity | K8s Required
  ----------|----------------------|------------|-------------
  Airflow   | Large teams, complex | High       | No (optional)
  Prefect   | Python teams, simple | Low        | No (optional)
  Kubeflow  | K8s-native ML        | High       | Yes
  Dagster   | Data engineering     | Medium     | No (optional)
  Argo      | K8s workflows        | Medium     | Yes
```

---

## Exercises

1. **Prefect Pipeline**: Build a 4-stage Prefect pipeline
   (ingest, preprocess, train, evaluate) that logs metrics
   to MLflow. Run it locally.

2. **Airflow DAG**: Write an Airflow DAG that runs daily,
   validates data quality, trains a model, and sends an
   alert (print) if accuracy drops below threshold.

3. **Parallel Training**: Create a pipeline that trains 3
   models in parallel with different hyperparameters, then
   picks the best one in a comparison step.

4. **Error Handling**: Add retry logic, timeouts, and
   failure notifications to your pipeline. Simulate a
   failure in the training step and verify recovery.

---

[Next: Lesson 09 - Feature Stores -->](09-feature-stores.md)
