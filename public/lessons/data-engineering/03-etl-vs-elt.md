# Lesson 03: ETL vs ELT

## The Factory Analogy

Imagine raw materials arriving at a factory:

```
  ETL: Process BEFORE storing
  ==============================
  Raw       +----------+    Clean     +-----------+
  Materials | FACTORY  | --------->  | WAREHOUSE |
  --------> | (clean,  |   Ready     | (organized|
            | reshape) |   goods     |  storage) |
            +----------+             +-----------+

  ELT: Store FIRST, process LATER
  ==============================
  Raw       +-----------+    Raw      +----------+    Clean
  Materials | WAREHOUSE | --------> | TRANSFORM | --------->
  --------> | (dump     |   stored  | (in-place |   Ready
            | everything|           |  process) |   goods
            +-----------+           +----------+
```

**ETL** = Extract, Transform, Load (traditional)
**ELT** = Extract, Load, Transform (modern)

The difference? Where the heavy processing happens.

---

## ETL: The Traditional Approach

Like a factory that cleans, shapes, and packages raw materials before
they enter the warehouse. Nothing messy goes in.

```
  Source DBs     ETL Tool        Data Warehouse
  +------+      +--------+      +------------+
  | MySQL| ---> |        | ---> |            |
  +------+      |  Info- |      |  Teradata  |
  +------+      | matica |      |  Oracle DW |
  | Oracle ---> |  SSIS  | ---> |  Netezza   |
  +------+      |  Talend|      |            |
  +------+      |        |      +------------+
  | Files| ---> |        |
  +------+      +--------+
                Transform
                happens HERE
```

```python
import pandas as pd
from sqlalchemy import create_engine

def extract(source_conn):
    return pd.read_sql("SELECT * FROM raw_orders", source_conn)

def transform(df):
    df = df.dropna(subset=["user_id", "amount"])
    df["amount"] = df["amount"].clip(lower=0)
    df["order_date"] = pd.to_datetime(df["order_date"])
    df["order_month"] = df["order_date"].dt.to_period("M")
    df = df[df["status"] != "cancelled"]
    return df

def load(df, target_conn):
    df.to_sql("clean_orders", target_conn, if_exists="append", index=False)

source = create_engine("postgresql://source_db:5432/app")
target = create_engine("postgresql://warehouse:5432/analytics")

raw_data = extract(source)
clean_data = transform(raw_data)
load(clean_data, target)
```

**ETL characteristics:**
- Transform before loading
- Data enters the warehouse clean
- Processing happens on a separate server
- Schema-on-write (define structure before storing)

---

## ELT: The Modern Approach

Like dumping all raw materials into a giant warehouse, then processing
them inside the warehouse using its powerful machinery.

```
  Sources          Raw Landing Zone        Transformed
  +------+         +--------------+        +----------+
  | APIs | ------> |              |        |          |
  +------+  load   |   BigQuery   | -----> | Curated  |
  | DBs  | ------> |   Snowflake  | trans- | tables   |
  +------+  raw    |   Redshift   | form   | views    |
  | Files| ------> |              | in DB  | marts    |
  +------+         +--------------+        +----------+
                   Transform happens HERE
                   (using SQL + dbt)
```

```python
import pandas as pd
from sqlalchemy import create_engine

def extract_and_load(source_conn, target_conn, table_name):
    df = pd.read_sql(f"SELECT * FROM {table_name}", source_conn)
    df.to_sql(
        f"raw_{table_name}",
        target_conn,
        if_exists="replace",
        index=False
    )

source = create_engine("postgresql://source_db:5432/app")
warehouse = create_engine("snowflake://warehouse/analytics")

for table in ["orders", "users", "products"]:
    extract_and_load(source, warehouse, table)
```

Then transform inside the warehouse with SQL:

```sql
CREATE TABLE analytics.clean_orders AS
SELECT
    o.order_id,
    o.user_id,
    u.segment,
    o.amount,
    o.order_date,
    DATE_TRUNC('month', o.order_date) AS order_month
FROM raw_orders o
JOIN raw_users u ON o.user_id = u.id
WHERE o.amount > 0
AND o.status != 'cancelled'
AND o.user_id IS NOT NULL;
```

---

## Side-by-Side Comparison

```
  +------------------+------------------+------------------+
  | Aspect           | ETL              | ELT              |
  +------------------+------------------+------------------+
  | Transform where  | External server  | Inside warehouse |
  +------------------+------------------+------------------+
  | Raw data kept?   | Often discarded  | Always preserved |
  +------------------+------------------+------------------+
  | Schema approach  | Schema-on-write  | Schema-on-read   |
  +------------------+------------------+------------------+
  | Flexibility      | Must plan ahead  | Transform later  |
  +------------------+------------------+------------------+
  | Scale bottleneck | ETL server       | Warehouse compute|
  +------------------+------------------+------------------+
  | Cost model       | Server + license | Warehouse compute|
  +------------------+------------------+------------------+
  | Typical tools    | Informatica,     | Fivetran, dbt,   |
  |                  | SSIS, Talend     | Airbyte, Stitch  |
  +------------------+------------------+------------------+
  | Best for         | Regulated data,  | Analytics, ML,   |
  |                  | legacy systems   | modern stack     |
  +------------------+------------------+------------------+
```

---

## The Modern Data Stack

The ELT approach gave rise to the "modern data stack":

```
  +------------+    +----------+    +----------+    +----------+
  | EXTRACT &  |    | WAREHOUSE|    | TRANSFORM|    | CONSUME  |
  |   LOAD     |    |          |    |          |    |          |
  | Fivetran   | -> | Snowflake| -> | dbt      | -> | Looker   |
  | Airbyte    |    | BigQuery |    | (SQL)    |    | Tableau  |
  | Stitch     |    | Redshift |    |          |    | Metabase |
  | Meltano    |    | Databrick|    |          |    | ML models|
  +------------+    +----------+    +----------+    +----------+
       |                                                 |
       |    +----------+    +----------+                 |
       +--> | ORCHESTR |    | QUALITY  | <---------------+
            | Airflow  |    | Great Ex |
            | Dagster  |    | dbt tests|
            | Prefect  |    | Soda     |
            +----------+    +----------+
```

---

## Building an ELT Pipeline

A complete example extracting from an API, loading to a database, and
transforming with SQL:

```python
import requests
import pandas as pd
from sqlalchemy import create_engine, text
from datetime import datetime, timedelta

def extract_from_api(base_url, start_date, end_date):
    all_records = []
    current = start_date

    while current <= end_date:
        response = requests.get(
            f"{base_url}/events",
            params={"date": current.strftime("%Y-%m-%d")},
            timeout=30
        )
        response.raise_for_status()
        all_records.extend(response.json()["data"])
        current += timedelta(days=1)

    return pd.DataFrame(all_records)

def load_raw(df, engine, table_name):
    df["_loaded_at"] = datetime.utcnow()
    df.to_sql(
        table_name,
        engine,
        if_exists="append",
        index=False,
        method="multi",
        chunksize=5000
    )
    return len(df)

def transform(engine):
    transforms = [
        """
        CREATE TABLE IF NOT EXISTS analytics.daily_metrics AS
        SELECT
            DATE(event_time) AS event_date,
            event_type,
            COUNT(*) AS event_count,
            COUNT(DISTINCT user_id) AS unique_users
        FROM raw.events
        GROUP BY 1, 2
        """,
        """
        CREATE TABLE IF NOT EXISTS analytics.user_summary AS
        SELECT
            user_id,
            MIN(event_time) AS first_seen,
            MAX(event_time) AS last_seen,
            COUNT(*) AS total_events,
            COUNT(DISTINCT DATE(event_time)) AS active_days
        FROM raw.events
        GROUP BY user_id
        """
    ]
    with engine.connect() as conn:
        for sql in transforms:
            conn.execute(text(sql))
        conn.commit()

engine = create_engine("postgresql://localhost:5432/warehouse")
yesterday = datetime.now() - timedelta(days=1)

raw_df = extract_from_api("https://api.example.com", yesterday, yesterday)
rows = load_raw(raw_df, engine, "raw.events")
print(f"Loaded {rows} raw records")

transform(engine)
print("Transforms complete")
```

---

## Incremental Loading

Full refreshes waste time. Load only what's new:

```
  Full Refresh:                    Incremental:
  +---+---+---+---+---+          +---+---+---+---+---+
  | * | * | * | * | * |          |   |   |   | * | * |
  +---+---+---+---+---+          +---+---+---+---+---+
  Reload everything               Only new/changed rows
  SLOW for big tables             FAST, but more complex
```

```python
from sqlalchemy import create_engine, text

def get_high_watermark(engine, table_name, column):
    with engine.connect() as conn:
        result = conn.execute(
            text(f"SELECT MAX({column}) FROM {table_name}")
        )
        return result.scalar()

def incremental_extract(source_engine, watermark_value):
    query = """
        SELECT * FROM orders
        WHERE updated_at > :watermark
        ORDER BY updated_at
    """
    return pd.read_sql(query, source_engine, params={"watermark": watermark_value})

def upsert_load(df, target_engine, table_name, key_column):
    temp_table = f"_temp_{table_name}"
    df.to_sql(temp_table, target_engine, if_exists="replace", index=False)

    merge_sql = f"""
        INSERT INTO {table_name}
        SELECT t.* FROM {temp_table} t
        ON CONFLICT ({key_column})
        DO UPDATE SET
            amount = EXCLUDED.amount,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
    """
    with target_engine.connect() as conn:
        conn.execute(text(merge_sql))
        conn.execute(text(f"DROP TABLE {temp_table}"))
        conn.commit()

target = create_engine("postgresql://warehouse:5432/analytics")
watermark = get_high_watermark(target, "orders", "updated_at")
new_data = incremental_extract(source, watermark)

if len(new_data) > 0:
    upsert_load(new_data, target, "orders", "order_id")
    print(f"Upserted {len(new_data)} records")
```

---

## Common Pipeline Patterns

```
  FULL REFRESH          APPEND-ONLY          UPSERT/MERGE
  +-------+             +-------+            +-------+
  | Drop  |             |       |            | Match |
  | table |             | old   |            | on key|
  | Reload|             | data  |            |       |
  | all   |             | + new |            | Insert|
  |       |             | data  |            | or    |
  +-------+             +-------+            | Update|
                                             +-------+
  Simple                Audit trail          Most complex
  Slow for big tables   Table grows forever  Maintains current state
  Best < 10M rows       Best for events      Best for dimensions
```

---

## When to Choose What

```
  Greenfield project with modern warehouse?
    |
    +-- YES --> ELT with modern data stack
    |
    +-- NO --> Legacy systems with strict schemas?
                |
                +-- YES --> ETL (traditional tools)
                |
                +-- NO --> Hybrid: ELT for analytics,
                           ETL for regulated data flows
```

---

## Exercises

1. **Build a mini ETL**: Write a Python script that extracts data from
   a CSV file, transforms it (clean nulls, normalize dates, add a
   computed column), and loads it into a SQLite database.

2. **Convert to ELT**: Take your ETL from exercise 1 and convert it to
   ELT. Load the raw CSV into SQLite first, then write SQL to create
   a clean version.

3. **Incremental pipeline**: Build an incremental loader that tracks a
   high watermark in a metadata table. On each run, it should only
   extract records newer than the watermark, load them, and update the
   watermark.

4. **Upsert implementation**: Create a pipeline that handles both new
   records (INSERT) and updated records (UPDATE) using a merge/upsert
   pattern. Test with a dataset that has both new and changed rows.

5. **Pipeline comparison**: Run both your full-refresh and incremental
   pipelines on a dataset of 1M rows. Measure and compare execution
   time, memory usage, and final row counts.

---

[Next: Lesson 04 - Apache Spark ->](04-apache-spark.md)
