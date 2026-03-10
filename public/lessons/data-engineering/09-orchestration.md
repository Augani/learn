# Lesson 09: Orchestration

## The Project Manager Analogy

An orchestrator is like a project manager who:
- Knows what tasks need to happen
- Knows the order (dependencies)
- Assigns tasks to workers
- Handles failures and retries
- Sends alerts when things go wrong

```
  WITHOUT ORCHESTRATION:        WITH ORCHESTRATION:
  +-------+                     +------------------+
  | cron  |                     |   Orchestrator   |
  | job 1 | 2:00 AM             |   (Airflow)      |
  +-------+                     +--------+---------+
  | cron  |                              |
  | job 2 | 2:30 AM (hope 1 is done)    +--- Task A (extract)
  +-------+                              |     |
  | cron  |                              +--- Task B (depends on A)
  | job 3 | 3:00 AM (hope 2 is done)    |     |
  +-------+                              +--- Task C (depends on B)
                                         |
  Fingers crossed                        +--- Task D (depends on A)
  they run in order                           |
                                         Guaranteed order, retries,
                                         monitoring, alerting
```

---

## Apache Airflow Basics

Airflow organizes work into DAGs (Directed Acyclic Graphs).

```
  DAG = Collection of tasks with dependencies

  extract_users ---+
                   |
  extract_orders --+--> transform --> load_warehouse --> run_tests
                   |                                       |
  extract_products-+                                  send_report

  Airflow guarantees:
  - extract_* run first (in parallel)
  - transform waits for ALL extracts
  - load waits for transform
  - tests wait for load
  - report waits for tests
```

### Your First DAG

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "email_on_failure": True,
    "email": ["team@company.com"],
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
}

dag = DAG(
    "daily_etl_pipeline",
    default_args=default_args,
    description="Daily ETL for analytics warehouse",
    schedule_interval="0 6 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["etl", "daily"],
)


def extract_users(**context):
    execution_date = context["ds"]
    print(f"Extracting users for {execution_date}")
    return {"rows_extracted": 5000}


def extract_orders(**context):
    execution_date = context["ds"]
    print(f"Extracting orders for {execution_date}")
    return {"rows_extracted": 15000}


def transform(**context):
    ti = context["ti"]
    users = ti.xcom_pull(task_ids="extract_users")
    orders = ti.xcom_pull(task_ids="extract_orders")
    print(f"Transforming {users['rows_extracted']} users and {orders['rows_extracted']} orders")


extract_users_task = PythonOperator(
    task_id="extract_users",
    python_callable=extract_users,
    dag=dag,
)

extract_orders_task = PythonOperator(
    task_id="extract_orders",
    python_callable=extract_orders,
    dag=dag,
)

transform_task = PythonOperator(
    task_id="transform",
    python_callable=transform,
    dag=dag,
)

run_dbt = BashOperator(
    task_id="run_dbt",
    bash_command="cd /opt/dbt && dbt run --select marts.*",
    dag=dag,
)

test_dbt = BashOperator(
    task_id="test_dbt",
    bash_command="cd /opt/dbt && dbt test --select marts.*",
    dag=dag,
)

[extract_users_task, extract_orders_task] >> transform_task >> run_dbt >> test_dbt
```

---

## Task Dependencies

```
  SYNTAX                          MEANING
  A >> B                          A runs before B
  A << B                          A runs after B
  [A, B] >> C                     Both A and B must finish before C
  A >> [B, C]                     A must finish before B and C start

  DEPENDENCY PATTERNS:
  Sequential:    A >> B >> C >> D
  Fan-out:       A >> [B, C, D]
  Fan-in:        [A, B, C] >> D
  Diamond:       A >> [B, C] >> D

  Diamond example:
       A
      / \
     B   C
      \ /
       D
```

---

## Operators

Airflow has operators for different types of work:

```
  +---------------------+---------------------------------------+
  | Operator            | What It Does                          |
  +---------------------+---------------------------------------+
  | PythonOperator      | Run a Python function                 |
  | BashOperator        | Run a shell command                   |
  | SQLOperator         | Execute SQL against a database        |
  | S3ToRedshiftOp      | Copy S3 files to Redshift             |
  | BigQueryOperator    | Run BigQuery SQL                      |
  | SparkSubmitOperator | Submit a Spark job                    |
  | HttpOperator        | Make HTTP requests                    |
  | EmailOperator       | Send emails                           |
  | DbtOperator         | Run dbt commands                      |
  +---------------------+---------------------------------------+
```

### Sensor: Wait for a Condition

```python
from airflow.sensors.s3_key_sensor import S3KeySensor
from airflow.sensors.external_task import ExternalTaskSensor
from airflow.sensors.sql import SqlSensor

wait_for_file = S3KeySensor(
    task_id="wait_for_file",
    bucket_name="data-landing",
    bucket_key="events/date={{ ds }}/data.parquet",
    timeout=3600,
    poke_interval=60,
    dag=dag,
)

wait_for_upstream = ExternalTaskSensor(
    task_id="wait_for_upstream",
    external_dag_id="upstream_pipeline",
    external_task_id="final_task",
    timeout=7200,
    dag=dag,
)

wait_for_data = SqlSensor(
    task_id="wait_for_data",
    conn_id="warehouse",
    sql="SELECT COUNT(*) FROM raw.events WHERE date = '{{ ds }}'",
    success=lambda count: count[0][0] > 0,
    timeout=3600,
    dag=dag,
)
```

---

## XComs: Passing Data Between Tasks

```
  Task A                      Task B
  +--------+   xcom_push     +--------+
  |        | ----value-----> |        |
  | extract|   (small data)  | transf |
  | return |                 | xcom_  |
  | value  |                 | pull() |
  +--------+                 +--------+

  XComs are for METADATA, not large datasets!
  Pass: row counts, file paths, status flags
  Don't pass: actual data (use files/tables instead)
```

```python
def extract(**context):
    rows = run_extraction()
    output_path = "s3://bucket/staging/users_20240301.parquet"
    return {"rows": rows, "path": output_path}

def transform(**context):
    ti = context["ti"]
    extract_result = ti.xcom_pull(task_ids="extract")
    path = extract_result["path"]
    row_count = extract_result["rows"]
    print(f"Processing {row_count} rows from {path}")
```

---

## Scheduling

```
  CRON SYNTAX:
  * * * * *
  | | | | |
  | | | | +-- Day of week (0-6, Sun=0)
  | | | +---- Month (1-12)
  | | +------ Day of month (1-31)
  | +-------- Hour (0-23)
  +---------- Minute (0-59)

  EXAMPLES:
  "0 6 * * *"      Every day at 6:00 AM
  "0 */2 * * *"    Every 2 hours
  "0 6 * * 1"      Every Monday at 6:00 AM
  "0 6 1 * *"      First day of each month at 6:00 AM
  "30 8 * * 1-5"   Weekdays at 8:30 AM

  AIRFLOW PRESETS:
  @daily       = "0 0 * * *"
  @hourly      = "0 * * * *"
  @weekly      = "0 0 * * 0"
  @monthly     = "0 0 1 * *"
```

### Execution Date vs Run Date

```
  Schedule: @daily (midnight)

  Timeline:
  |---Jan 1---|---Jan 2---|---Jan 3---|
              ^                       ^
              |                       |
              execution_date=Jan1     execution_date=Jan2
              (processes Jan 1 data)  (processes Jan 2 data)
              runs at midnight Jan 2  runs at midnight Jan 3

  The execution_date is the START of the interval,
  NOT when the DAG actually runs!
```

---

## Error Handling and Retries

```python
from airflow.operators.python import PythonOperator
from datetime import timedelta

def unreliable_api_call(**context):
    import requests
    response = requests.get("https://api.example.com/data", timeout=30)
    response.raise_for_status()
    return response.json()

api_task = PythonOperator(
    task_id="call_api",
    python_callable=unreliable_api_call,
    retries=5,
    retry_delay=timedelta(minutes=2),
    retry_exponential_backoff=True,
    max_retry_delay=timedelta(minutes=30),
    dag=dag,
)
```

### Callbacks and Alerts

```python
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator

def on_failure_callback(context):
    task_instance = context["task_instance"]
    dag_id = context["dag"].dag_id
    task_id = task_instance.task_id
    execution_date = context["ds"]
    log_url = task_instance.log_url

    message = (
        f"Task FAILED: {dag_id}.{task_id}\n"
        f"Date: {execution_date}\n"
        f"Logs: {log_url}"
    )

    SlackWebhookOperator(
        task_id="slack_alert",
        http_conn_id="slack_webhook",
        message=message,
    ).execute(context=context)

dag = DAG(
    "monitored_pipeline",
    on_failure_callback=on_failure_callback,
    default_args=default_args,
)
```

---

## Dynamic DAGs

Generate tasks programmatically:

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime

TABLES = ["users", "orders", "products", "events", "payments"]

dag = DAG(
    "dynamic_extract_pipeline",
    schedule_interval="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
)

def extract_table(table_name, **context):
    print(f"Extracting {table_name} for {context['ds']}")


extract_tasks = []
for table in TABLES:
    task = PythonOperator(
        task_id=f"extract_{table}",
        python_callable=extract_table,
        op_kwargs={"table_name": table},
        dag=dag,
    )
    extract_tasks.append(task)

transform = PythonOperator(
    task_id="transform_all",
    python_callable=lambda: print("Transforming all tables"),
    dag=dag,
)

extract_tasks >> transform
```

---

## TaskFlow API (Airflow 2+)

The modern, Pythonic way to write DAGs:

```python
from airflow.decorators import dag, task
from datetime import datetime

@dag(
    schedule_interval="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["modern"],
)
def modern_etl_pipeline():

    @task()
    def extract_users(ds=None):
        return {"count": 5000, "path": f"s3://lake/users/{ds}.parquet"}

    @task()
    def extract_orders(ds=None):
        return {"count": 15000, "path": f"s3://lake/orders/{ds}.parquet"}

    @task()
    def transform(users_meta, orders_meta):
        print(f"Users: {users_meta['count']}, Orders: {orders_meta['count']}")
        return {"status": "success", "total_rows": users_meta["count"] + orders_meta["count"]}

    @task()
    def load(transform_result):
        print(f"Loading {transform_result['total_rows']} rows")

    @task()
    def notify(load_result):
        print("Pipeline complete!")

    users = extract_users()
    orders = extract_orders()
    transformed = transform(users, orders)
    loaded = load(transformed)
    notify(loaded)

modern_etl_pipeline()
```

---

## Alternatives to Airflow

```
  +----------+---------------------------------------------------+
  | Tool     | Key Difference from Airflow                       |
  +----------+---------------------------------------------------+
  | Dagster  | Asset-centric (focus on data, not tasks)          |
  |          | Better local dev, type-safe, built-in testing     |
  +----------+---------------------------------------------------+
  | Prefect  | Simpler setup, Python-native, hosted option       |
  |          | Dynamic workflows, no DAG definition needed       |
  +----------+---------------------------------------------------+
  | Mage     | UI-first, real-time pipelines, built-in notebook  |
  +----------+---------------------------------------------------+
  | Luigi    | Simpler than Airflow, target-based (like Make)    |
  +----------+---------------------------------------------------+
  | Temporal | For long-running workflows, microservice-friendly |
  +----------+---------------------------------------------------+
```

---

## Exercises

1. **First DAG**: Write an Airflow DAG that extracts data from 3
   sources (mock with Python functions), transforms them, loads to a
   database, and sends a completion notification. Use proper retry
   and timeout settings.

2. **Dynamic DAG**: Create a DAG that reads a config file listing
   tables to extract and dynamically generates one extract task per
   table, all feeding into a single transform task.

3. **Sensor pattern**: Build a DAG that uses a sensor to wait for a
   file to appear in a directory, then processes it. Include a timeout
   and failure callback.

4. **Error handling**: Write a DAG where one task intentionally fails
   50% of the time. Configure retries, exponential backoff, and a
   Slack-style alert callback. Verify the retry behavior.

5. **End-to-end pipeline**: Combine Airflow with dbt: create a DAG
   that runs `dbt run`, then `dbt test`, then generates a summary
   report. If tests fail, send an alert but don't block the summary.

---

[Next: Lesson 10 - Data Quality & Validation ->](10-data-quality-validation.md)
