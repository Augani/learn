# Lesson 04: Apache Spark

## The Restaurant Kitchen Analogy

A single chef (your laptop) can cook for 10 people. But a restaurant
serving 10,000 needs a kitchen with many chefs working in parallel.

Spark is that kitchen.

```
  SINGLE MACHINE                   SPARK CLUSTER
  +-----------+                    +-----------+
  | One Chef  |                    | Head Chef |  (Driver)
  | does      |                    +-----+-----+
  | everything|                          |
  +-----------+                    +-----+-----+-----+
  Limit: RAM                       |     |     |     |
  of one machine                   v     v     v     v
                                 +---+ +---+ +---+ +---+
                                 |Chef| |Chef| |Chef| |Chef|  (Workers)
                                 +---+ +---+ +---+ +---+
                                 Each handles a portion of data
```

---

## Core Concepts

### Driver and Executors

```
  +-------------------+
  |   DRIVER          |   Your main program
  |   (SparkContext)  |   Plans the work
  +---------+---------+   Coordinates everything
            |
     +------+------+
     |      |      |
  +--+--+ +-+--+ +-+--+
  |Exec1| |Exec2| |Exec3|   Workers that do the actual work
  | 4GB | | 4GB | | 4GB |   Each has its own memory
  | 2CPU| | 2CPU| | 2CPU|   Each processes a partition
  +-----+ +-----+ +-----+
```

### Lazy Evaluation

Spark doesn't execute anything until you ask for a result. It builds
a plan first, then optimizes and runs it.

Think of it like writing a shopping list vs actually going shopping:

```
  TRANSFORMATIONS (lazy - just planning)     ACTIONS (trigger execution)
  +------------------+                       +------------------+
  | .filter()        |                       | .count()         |
  | .select()        |   No work done yet!   | .collect()       |
  | .groupBy()       | --------------------> | .show()          |
  | .join()          |   Until an action     | .write()         |
  | .withColumn()    |   is called           | .first()         |
  +------------------+                       +------------------+
```

---

## PySpark Basics

### Starting a Session

```python
from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .appName("DataEngineeringLesson") \
    .master("local[*]") \
    .config("spark.sql.shuffle.partitions", "8") \
    .getOrCreate()
```

### Creating DataFrames

```python
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType

schema = StructType([
    StructField("user_id", IntegerType(), nullable=False),
    StructField("name", StringType(), nullable=True),
    StructField("age", IntegerType(), nullable=True),
    StructField("revenue", DoubleType(), nullable=True)
])

data = [
    (1, "Alice", 30, 150.50),
    (2, "Bob", 25, 230.00),
    (3, "Charlie", 35, 0.0),
    (4, "Diana", 28, 445.75)
]

df = spark.createDataFrame(data, schema=schema)
df.show()
df.printSchema()
```

### Reading Data

```python
csv_df = spark.read \
    .option("header", "true") \
    .option("inferSchema", "true") \
    .csv("data/users.csv")

parquet_df = spark.read.parquet("data/events.parquet")

json_df = spark.read \
    .option("multiline", "true") \
    .json("data/records.json")
```

---

## Transformations

### Select, Filter, Add Columns

```python
from pyspark.sql import functions as F

result = df \
    .select("user_id", "name", "revenue") \
    .filter(F.col("revenue") > 0) \
    .withColumn("revenue_tier",
        F.when(F.col("revenue") > 200, "high")
         .when(F.col("revenue") > 50, "medium")
         .otherwise("low")
    )

result.show()
```

### GroupBy and Aggregations

```python
summary = df \
    .groupBy("revenue_tier") \
    .agg(
        F.count("*").alias("user_count"),
        F.sum("revenue").alias("total_revenue"),
        F.avg("revenue").alias("avg_revenue"),
        F.max("revenue").alias("max_revenue")
    )

summary.show()
```

### Joins

```python
orders = spark.createDataFrame([
    (1, 100, "2024-01-15"),
    (1, 200, "2024-02-20"),
    (2, 150, "2024-01-25"),
    (3, 50, "2024-03-10")
], ["user_id", "amount", "order_date"])

enriched = orders.join(df, on="user_id", how="left")
enriched.show()
```

### Window Functions in PySpark

```python
from pyspark.sql.window import Window

user_window = Window.partitionBy("user_id").orderBy("order_date")

orders_ranked = orders \
    .withColumn("order_num", F.row_number().over(user_window)) \
    .withColumn("running_total", F.sum("amount").over(user_window))

orders_ranked.show()
```

---

## RDDs vs DataFrames

```
  RDDs (old way)                DataFrames (modern way)
  +-------------------+         +-------------------+
  | Low-level API     |         | High-level API    |
  | You control       |         | Spark optimizes   |
  | everything        |         | for you           |
  | .map(), .reduce() |         | .select(), .agg() |
  | No optimization   |         | Catalyst optimizer|
  | Python objects    |         | Columnar storage  |
  +-------------------+         +-------------------+
       |                              |
       v                              v
  Use only when you                Use this 99% of
  need custom logic                the time
  that SQL can't express
```

```python
rdd = spark.sparkContext.parallelize([1, 2, 3, 4, 5])
squared = rdd.map(lambda x: x ** 2)
total = squared.reduce(lambda a, b: a + b)
print(total)

df = spark.range(1, 6).toDF("number")
result = df.withColumn("squared", F.col("number") ** 2)
total_df = result.agg(F.sum("squared")).collect()[0][0]
print(total_df)
```

---

## Partitioning and Shuffles

```
  NARROW TRANSFORMATION (no shuffle - fast)
  +--------+     +--------+
  |Part 1  | --> |Part 1  |   Each partition processes
  +--------+     +--------+   independently
  |Part 2  | --> |Part 2  |   Examples: filter, select,
  +--------+     +--------+   map, withColumn
  |Part 3  | --> |Part 3  |
  +--------+     +--------+

  WIDE TRANSFORMATION (shuffle - expensive)
  +--------+     +--------+
  |Part 1  | -+->|Part A  |   Data must move between
  +--------+  |  +--------+   partitions (network I/O)
  |Part 2  | -+->|Part B  |   Examples: groupBy, join,
  +--------+  |  +--------+   distinct, repartition
  |Part 3  | -+->|Part C  |
  +--------+     +--------+
     Shuffle: data crosses the network
```

**Controlling partitions:**

```python
print(f"Current partitions: {df.rdd.getNumPartitions()}")

df_repartitioned = df.repartition(10, "user_id")

df_coalesced = df.coalesce(2)
```

---

## Writing Data

```python
df.write \
    .mode("overwrite") \
    .partitionBy("order_date") \
    .parquet("output/orders")

df.write \
    .mode("append") \
    .format("jdbc") \
    .option("url", "jdbc:postgresql://localhost:5432/warehouse") \
    .option("dbtable", "public.orders") \
    .option("user", "admin") \
    .option("password", "secret") \
    .save()
```

Write modes:

```
  +----------+-------------------------------------------+
  | Mode     | Behavior                                  |
  +----------+-------------------------------------------+
  | overwrite| Delete existing data, write new           |
  | append   | Add to existing data                      |
  | ignore   | Skip if data already exists               |
  | error    | Throw error if data exists (default)      |
  +----------+-------------------------------------------+
```

---

## Spark SQL

You can use plain SQL with Spark:

```python
df.createOrReplaceTempView("users")
orders.createOrReplaceTempView("orders")

result = spark.sql("""
    SELECT
        u.name,
        COUNT(o.amount) AS order_count,
        SUM(o.amount) AS total_spent
    FROM users u
    LEFT JOIN orders o ON u.user_id = o.user_id
    GROUP BY u.name
    HAVING SUM(o.amount) > 100
    ORDER BY total_spent DESC
""")

result.show()
```

---

## Performance Tips

```
  +-----------------------------+------------------------------+
  | Problem                     | Solution                     |
  +-----------------------------+------------------------------+
  | Small files (< 128MB each) | Coalesce before writing      |
  +-----------------------------+------------------------------+
  | Skewed joins (one key has   | Salt the key or broadcast    |
  | 90% of data)                | the small table              |
  +-----------------------------+------------------------------+
  | Out of memory               | Increase partitions,         |
  |                             | reduce data earlier          |
  +-----------------------------+------------------------------+
  | Slow joins                  | Broadcast small tables       |
  |                             | (< 10MB)                     |
  +-----------------------------+------------------------------+
  | Reading too much data       | Use partition pruning,       |
  |                             | push filters to read         |
  +-----------------------------+------------------------------+
```

**Broadcast join for small tables:**

```python
from pyspark.sql.functions import broadcast

small_lookup = spark.read.parquet("lookup_table.parquet")
big_table = spark.read.parquet("events.parquet")

result = big_table.join(broadcast(small_lookup), on="key")
```

**Caching for reused DataFrames:**

```python
df.cache()
df.count()

summary_1 = df.groupBy("category").count()
summary_2 = df.filter(F.col("amount") > 100).count()

df.unpersist()
```

---

## A Complete PySpark ETL Job

```python
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, LongType, DoubleType, TimestampType

spark = SparkSession.builder \
    .appName("DailyEventProcessing") \
    .config("spark.sql.shuffle.partitions", "20") \
    .getOrCreate()

events_schema = StructType([
    StructField("event_id", LongType()),
    StructField("user_id", LongType()),
    StructField("event_type", StringType()),
    StructField("event_time", TimestampType()),
    StructField("properties", StringType()),
    StructField("amount", DoubleType())
])

raw_events = spark.read \
    .schema(events_schema) \
    .parquet("s3://data-lake/raw/events/date=2024-03-01/")

cleaned = raw_events \
    .filter(F.col("user_id").isNotNull()) \
    .filter(F.col("event_type").isin("purchase", "view", "click")) \
    .withColumn("event_hour", F.hour("event_time")) \
    .withColumn("event_date", F.to_date("event_time")) \
    .dropDuplicates(["event_id"])

user_metrics = cleaned \
    .groupBy("user_id", "event_date") \
    .agg(
        F.count("*").alias("total_events"),
        F.sum(F.when(F.col("event_type") == "purchase", F.col("amount")).otherwise(0)).alias("daily_spend"),
        F.countDistinct("event_type").alias("event_types"),
        F.min("event_time").alias("first_event"),
        F.max("event_time").alias("last_event")
    )

user_metrics.write \
    .mode("overwrite") \
    .partitionBy("event_date") \
    .parquet("s3://data-lake/curated/user_daily_metrics/")

print(f"Processed {cleaned.count()} events")
print(f"Generated metrics for {user_metrics.select('user_id').distinct().count()} users")

spark.stop()
```

---

## Exercises

1. **First Spark job**: Create a PySpark session locally. Generate a
   DataFrame with 1 million rows (user_id, category, amount, date).
   Compute the top 10 users by total amount per category.

2. **Partition analysis**: Write a job that reads a large Parquet file,
   checks the number of partitions, and repartitions by a date column.
   Compare query performance before and after.

3. **Join optimization**: Create two DataFrames: a large one (10M rows)
   and a small lookup (1000 rows). Measure join time with and without
   broadcast. What's the speedup?

4. **Window functions**: Using PySpark window functions, compute for
   each user: their rank by total spending, their running total of
   purchases, and the days since their previous purchase.

5. **End-to-end pipeline**: Build a PySpark job that reads raw CSV
   event data, cleans it (remove nulls, deduplicate, validate types),
   enriches it with a user lookup table, computes daily aggregates,
   and writes the results as partitioned Parquet.

---

[Next: Lesson 05 - Streaming Data ->](05-streaming-data.md)
