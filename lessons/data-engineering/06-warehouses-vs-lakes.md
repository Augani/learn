# Lesson 06: Warehouses vs Lakes

## The Storage Yard Analogy

Think about storing physical goods:

```
  DATA WAREHOUSE                      DATA LAKE
  (Organized Warehouse)               (Storage Yard)
  +-------------------------+         +-------------------------+
  |  [Aisle A: Electronics] |         |  Boxes everywhere       |
  |  [Aisle B: Clothing]    |         |  Pallets stacked        |
  |  [Aisle C: Food]        |         |  Some labeled           |
  |                         |         |  Some not               |
  |  Everything labeled     |         |  Raw materials dumped   |
  |  Everything in its      |         |  in bulk                |
  |  place                  |         |                         |
  |  Find anything fast     |         |  Cheap to store         |
  |  Expensive to maintain  |         |  Hard to find things    |
  +-------------------------+         +-------------------------+

  DATA LAKEHOUSE
  (Organized Storage Yard)
  +-------------------------+
  |  Zones: Raw | Clean | Gold
  |  +-------+-------+------+
  |  | Raw   | Clean | Gold |
  |  | dump  | org'd | fast |
  |  +-------+-------+------+
  |  Catalog knows where    |
  |  everything is          |
  |  Best of both worlds    |
  +-------------------------+
```

---

## Data Warehouses

Structured, optimized for analytical queries. Like a library with a
card catalog -- everything has a place, and finding it is fast.

### Key Characteristics

```
  +--------------------+
  | DATA WAREHOUSE     |
  +--------------------+
  | Schema-on-write    |  Define structure BEFORE loading
  | Columnar storage   |  Optimized for analytics
  | SQL interface      |  Query with standard SQL
  | Managed compute    |  Pay for queries/storage
  | Strong consistency |  ACID transactions
  +--------------------+
```

### BigQuery (Google)

```python
from google.cloud import bigquery

client = bigquery.Client()

query = """
    SELECT
        DATE(event_timestamp) AS event_date,
        event_type,
        COUNT(*) AS event_count,
        COUNT(DISTINCT user_id) AS unique_users
    FROM `project.dataset.events`
    WHERE DATE(event_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY 1, 2
    ORDER BY 1 DESC, 3 DESC
"""

df = client.query(query).to_dataframe()
print(df.head())
```

```
  BigQuery Architecture:
  +----------------------------------+
  | Dremel Query Engine              |
  | (massively parallel SQL)         |
  +----------+-----------+-----------+
  | Worker 1 | Worker 2  | Worker N  |
  +----------+-----------+-----------+
             |
  +----------+-----------+-----------+
  | Colossus Distributed Storage     |
  | (columnar, compressed)           |
  +----------------------------------+
  Compute and storage are separated
  Scale each independently
```

### Snowflake

```python
import snowflake.connector

conn = snowflake.connector.connect(
    user="admin",
    password="secret",
    account="my_account",
    warehouse="COMPUTE_WH",
    database="ANALYTICS",
    schema="PUBLIC"
)

cursor = conn.cursor()
cursor.execute("""
    SELECT
        user_segment,
        COUNT(*) AS user_count,
        AVG(lifetime_value) AS avg_ltv
    FROM user_profiles
    GROUP BY user_segment
    ORDER BY avg_ltv DESC
""")

for row in cursor:
    print(row)

cursor.close()
conn.close()
```

```
  Snowflake Architecture:
  +-------------------+
  | Cloud Services    |  Metadata, optimization,
  | (shared layer)    |  security, management
  +---+-------+---+---+
      |       |       |
  +---+---+ +-+---+ +-+---+
  | XS WH | | M WH| | XL WH|  Virtual Warehouses
  | (dev) | |(prod)| |(ML)  |  (independent compute)
  +-------+ +-----+ +------+
      |       |       |
  +---+-------+-------+---+
  | Centralized Storage    |  S3/Azure Blob/GCS
  | (shared data)          |  One copy of data
  +------------------------+
```

---

## Data Lakes

Store everything, figure out the structure later. Cheap storage,
flexible formats, but needs governance or it becomes a "data swamp."

```
  DATA LAKE ZONES:
  +-------------+-------------+-------------+
  |   BRONZE    |   SILVER    |    GOLD     |
  |   (Raw)     |   (Clean)   |   (Curated) |
  +-------------+-------------+-------------+
  | Raw JSON    | Deduped     | Aggregated  |
  | Raw CSV     | Typed       | Joined      |
  | Raw Parquet | Validated   | Business-   |
  | As-is from  | Standardized| ready       |
  | source      | format      | tables      |
  +-------------+-------------+-------------+
  | s3://lake/  | s3://lake/  | s3://lake/  |
  | bronze/     | silver/     | gold/       |
  +-------------+-------------+-------------+
```

### S3 as a Data Lake

```python
import boto3
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from io import BytesIO

s3 = boto3.client("s3")

def write_to_lake(df, bucket, key):
    table = pa.Table.from_pandas(df)
    buffer = BytesIO()
    pq.write_table(table, buffer)
    buffer.seek(0)
    s3.put_object(Bucket=bucket, Key=key, Body=buffer.getvalue())

def read_from_lake(bucket, key):
    response = s3.get_object(Bucket=bucket, Key=key)
    buffer = BytesIO(response["Body"].read())
    return pq.read_table(buffer).to_pandas()

df = pd.DataFrame({
    "user_id": range(1000),
    "event": ["click"] * 500 + ["purchase"] * 500,
    "amount": [0.0] * 500 + [float(x) for x in range(500)]
})

write_to_lake(df, "my-data-lake", "bronze/events/date=2024-03-01/part-0.parquet")
```

### Organizing a Data Lake

```
  s3://company-data-lake/
  |
  +-- bronze/
  |   +-- source=app_db/
  |   |   +-- table=users/
  |   |   |   +-- date=2024-03-01/
  |   |   |       +-- part-00000.parquet
  |   |   +-- table=orders/
  |   |       +-- date=2024-03-01/
  |   +-- source=kafka/
  |       +-- topic=user-events/
  |           +-- date=2024-03-01/
  |               +-- hour=00/
  |               +-- hour=01/
  |
  +-- silver/
  |   +-- users_cleaned/
  |   +-- orders_validated/
  |   +-- events_deduped/
  |
  +-- gold/
      +-- user_daily_metrics/
      +-- revenue_by_segment/
      +-- ml_training_features/
```

---

## Data Lakehouse

The best of both: lake's cheap storage and flexibility, warehouse's
performance and ACID transactions.

```
  Traditional separation:
  +----------+         +----------+
  | Data     | ------> | Data     |
  | Lake     |  copy   | Warehouse|
  | (cheap)  |         | (fast)   |
  +----------+         +----------+
  Two copies of data. Syncing is painful.

  Lakehouse:
  +------------------------------+
  |          Lakehouse           |
  | +----------+ +-------------+ |
  | | Open file| | Query engine| |
  | | formats  | | (SQL, fast) | |
  | | (Parquet)| | ACID trans  | |
  | +----------+ +-------------+ |
  +------------------------------+
  One copy. Best of both.
```

### Delta Lake (Databricks)

```python
from delta import DeltaTable
from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .appName("DeltaLakeDemo") \
    .config("spark.jars.packages", "io.delta:delta-spark_2.12:3.0.0") \
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
    .getOrCreate()

df = spark.createDataFrame([
    (1, "Alice", 100.0),
    (2, "Bob", 200.0),
    (3, "Charlie", 150.0)
], ["id", "name", "amount"])

df.write.format("delta").mode("overwrite").save("/tmp/delta-table")

delta_df = spark.read.format("delta").load("/tmp/delta-table")
delta_df.show()

delta_table = DeltaTable.forPath(spark, "/tmp/delta-table")

updates = spark.createDataFrame([
    (2, "Bob", 250.0),
    (4, "Diana", 300.0)
], ["id", "name", "amount"])

delta_table.alias("target").merge(
    updates.alias("source"),
    "target.id = source.id"
).whenMatchedUpdateAll() \
 .whenNotMatchedInsertAll() \
 .execute()
```

### Apache Iceberg

```python
spark.sql("""
    CREATE TABLE catalog.db.events (
        event_id BIGINT,
        user_id BIGINT,
        event_type STRING,
        event_time TIMESTAMP,
        amount DOUBLE
    )
    USING iceberg
    PARTITIONED BY (days(event_time))
""")

spark.sql("""
    INSERT INTO catalog.db.events VALUES
    (1, 42, 'purchase', TIMESTAMP '2024-03-01 10:00:00', 99.99),
    (2, 43, 'click', TIMESTAMP '2024-03-01 10:05:00', 0.0)
""")

spark.sql("SELECT * FROM catalog.db.events.snapshots").show()

spark.sql("""
    SELECT * FROM catalog.db.events
    TIMESTAMP AS OF '2024-03-01 09:00:00'
""")
```

---

## Comparison Matrix

```
  +-----------+------------+------------+------------+
  | Feature   | Warehouse  | Lake       | Lakehouse  |
  +-----------+------------+------------+------------+
  | Storage   | Proprietary| Open files | Open files |
  | cost      | $$$        | $          | $          |
  +-----------+------------+------------+------------+
  | Query     | Very fast  | Slow (raw) | Fast       |
  | speed     |            |            |            |
  +-----------+------------+------------+------------+
  | Data types| Structured | Any        | Any        |
  +-----------+------------+------------+------------+
  | Schema    | On write   | On read    | Both       |
  +-----------+------------+------------+------------+
  | ACID      | Yes        | No         | Yes        |
  +-----------+------------+------------+------------+
  | Time      | Limited    | Manual     | Built-in   |
  | travel    |            |            |            |
  +-----------+------------+------------+------------+
  | ML support| Export     | Native     | Native     |
  |           | needed     |            |            |
  +-----------+------------+------------+------------+
  | Vendor    | High       | Low        | Low-Medium |
  | lock-in   |            |            |            |
  +-----------+------------+------------+------------+
```

---

## Choosing the Right Architecture

```
  What's your primary use case?
    |
    +-- Pure BI/reporting with SQL users?
    |     --> Data Warehouse (BigQuery, Snowflake)
    |
    +-- ML training on massive unstructured data?
    |     --> Data Lake (S3 + Spark)
    |
    +-- Both analytics AND ML on same data?
    |     --> Lakehouse (Delta Lake, Iceberg)
    |
    +-- Small team, limited budget?
    |     --> Start with warehouse, add lake later
    |
    +-- Enterprise with diverse needs?
          --> Lakehouse with warehouse for BI layer
```

---

## Modern Patterns

### Medallion Architecture

```
  +--------+      +--------+      +--------+
  | BRONZE |  --> | SILVER |  --> |  GOLD  |
  | Raw    |      | Clean  |      | Business|
  | Append |      | Dedup  |      | Aggreg  |
  | only   |      | Type   |      | Join    |
  +--------+      +--------+      +--------+
      |               |               |
   Landing         Validated       Ready for
   zone            zone            consumption
```

```python
bronze = spark.read.json("s3://lake/bronze/events/")

silver = bronze \
    .dropDuplicates(["event_id"]) \
    .filter("user_id IS NOT NULL") \
    .withColumn("event_time", F.to_timestamp("event_time"))

silver.write.format("delta").mode("overwrite").save("s3://lake/silver/events/")

gold = silver \
    .groupBy(F.to_date("event_time").alias("event_date"), "event_type") \
    .agg(
        F.count("*").alias("event_count"),
        F.countDistinct("user_id").alias("unique_users"),
        F.sum("amount").alias("total_amount")
    )

gold.write.format("delta").mode("overwrite").save("s3://lake/gold/daily_metrics/")
```

---

## Query Engines for Lakes

When your data lives in a lake but you want warehouse-like speed:

```
  +-------------+    +----------+    +----------+
  | Athena      |    | Trino    |    | DuckDB   |
  | (AWS)       |    | (Presto) |    | (local)  |
  +------+------+    +----+-----+    +----+-----+
         |                |               |
         v                v               v
  +------+------+    +----+-----+    +----+-----+
  | Query S3    |    | Query    |    | Query    |
  | directly    |    | anything |    | locally  |
  | Pay per scan|    | federated|    | blazing  |
  +-------------+    +----------+    +----------+
```

```python
import duckdb

con = duckdb.connect()

result = con.execute("""
    SELECT
        event_type,
        COUNT(*) AS cnt,
        AVG(amount) AS avg_amount
    FROM read_parquet('s3://lake/silver/events/*.parquet')
    WHERE event_date >= '2024-03-01'
    GROUP BY event_type
    ORDER BY cnt DESC
""").fetchdf()

print(result)
```

---

## Exercises

1. **Warehouse query**: Using DuckDB (local), create a star schema
   with a fact_orders table and dim_users, dim_products dimension
   tables. Write 5 analytical queries typical of a data warehouse.

2. **Lake organization**: Design a data lake folder structure for an
   e-commerce company with data from: web events, mobile app, payment
   processor, CRM, and product catalog. Define bronze/silver/gold.

3. **Medallion pipeline**: Using PySpark or Pandas, build a bronze ->
   silver -> gold pipeline. Bronze reads raw JSON, silver deduplicates
   and validates, gold produces daily aggregates.

4. **Delta Lake time travel**: Create a Delta table, make 5 updates,
   then use time travel to query the state at each version. Show how
   to roll back to a previous version.

5. **Cost analysis**: For a dataset of 10TB with 100 analysts running
   50 queries/day, estimate monthly costs for BigQuery, Snowflake, and
   S3+Athena. Which is cheapest? Which is fastest?

---

[Next: Lesson 07 - Data Modeling ->](07-data-modeling.md)
