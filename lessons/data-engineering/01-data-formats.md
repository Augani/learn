# Lesson 01: Data Formats

## The Shipping Container Analogy

Think of data formats like containers for shipping goods:

```
  SHIPPING GOODS                     SHIPPING DATA
  +-----------+                      +-----------+
  | Cardboard |  cheap, fragile,     |   CSV     |  simple, universal,
  |   Box     |  anyone can open     |           |  no types, slow
  +-----------+                      +-----------+
  | Wooden    |  structured,         |   JSON    |  nested, flexible,
  |   Crate   |  heavier, sturdy     |           |  human-readable
  +-----------+                      +-----------+
  | Steel     |  standardized,       |  Parquet  |  columnar, typed,
  | Container |  stackable, fast     |           |  compressed, fast
  +-----------+                      +-----------+
  | Vacuum    |  zero wasted         |   Arrow   |  in-memory, zero-copy,
  |  Sealed   |  space, specialized  |           |  blazing fast
  +-----------+                      +-----------+
  | Custom    |  exact fit,          | Protobuf  |  schema-enforced,
  |  Molded   |  needs blueprint     |           |  compact, versioned
  +-----------+                      +-----------+
```

---

## CSV: The Cardboard Box

Everyone has one. Everyone can open one. But don't stack too many.

CSV is plain text with commas separating values. No types, no schema,
no compression. It's the lowest common denominator.

```python
import csv
import pandas as pd

df = pd.DataFrame({
    "user_id": [1, 2, 3],
    "name": ["Alice", "Bob", "Charlie"],
    "signup_date": ["2024-01-15", "2024-02-20", "2024-03-10"],
    "revenue": [150.50, 230.00, 0.0]
})

df.to_csv("users.csv", index=False)

loaded = pd.read_csv("users.csv")
print(loaded.dtypes)
```

Notice the problem: `signup_date` loads as a string, not a date.
`revenue` might become an integer if all values are whole numbers.
CSV has no type information.

**When to use CSV:**
- Quick data exchange with non-technical people
- Small datasets under 100MB
- When the receiver has no special tooling

**When to avoid CSV:**
- Large datasets (no compression)
- When types matter (everything is a string)
- Nested or complex data structures

---

## JSON: The Wooden Crate

Flexible, can hold oddly shaped things, but bulky.

```python
import json

records = [
    {
        "user_id": 1,
        "name": "Alice",
        "preferences": {
            "theme": "dark",
            "notifications": True
        },
        "tags": ["premium", "early-adopter"]
    },
    {
        "user_id": 2,
        "name": "Bob",
        "preferences": {
            "theme": "light",
            "notifications": False
        },
        "tags": ["free-tier"]
    }
]

with open("users.json", "w") as f:
    json.dump(records, f, indent=2)
```

JSON Lines (JSONL) is the data engineering variant -- one JSON object
per line, which makes it splittable for parallel processing:

```python
with open("users.jsonl", "w") as f:
    for record in records:
        f.write(json.dumps(record) + "\n")
```

**When to use JSON/JSONL:**
- API responses and web data
- Nested or semi-structured data
- Configuration files
- Event logs (JSONL)

**When to avoid:**
- Analytical workloads (not columnar)
- Large-scale processing (verbose, slow to parse)

---

## Parquet: The Steel Container

The workhorse of modern data engineering. Columnar, compressed, typed.

```
  ROW-ORIENTED (CSV)           COLUMN-ORIENTED (Parquet)
  +----+-------+-----+        +----+----+----+
  | id | name  | rev |        | 1  | 2  | 3  |  <- id column
  +----+-------+-----+        +----+----+----+
  | 1  | Alice | 150 |        | Al | Bo | Ch |  <- name column
  | 2  | Bob   | 230 |        +----+----+----+
  | 3  | Charl | 0   |        |150 |230 | 0  |  <- rev column
  +----+-------+-----+        +----+----+----+

  Reading "rev" column:        Reading "rev" column:
  Must scan ALL rows           Jump directly to rev block
  and skip other columns       Read only what you need
```

```python
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

df = pd.DataFrame({
    "user_id": range(1_000_000),
    "category": ["A", "B", "C", "D"] * 250_000,
    "revenue": [float(x) * 1.5 for x in range(1_000_000)]
})

df.to_csv("big_data.csv", index=False)
df.to_parquet("big_data.parquet", index=False)

import os
csv_size = os.path.getsize("big_data.csv")
parquet_size = os.path.getsize("big_data.parquet")
print(f"CSV: {csv_size / 1e6:.1f} MB")
print(f"Parquet: {parquet_size / 1e6:.1f} MB")
print(f"Compression ratio: {csv_size / parquet_size:.1f}x")
```

Reading a single column from Parquet only loads that column:

```python
table = pq.read_table("big_data.parquet", columns=["revenue"])
print(table.to_pandas().head())
```

**Parquet features:**
- Column pruning (read only needed columns)
- Predicate pushdown (skip row groups that don't match filters)
- Rich type system (timestamps, decimals, nested types)
- Built-in compression (snappy, gzip, zstd)

---

## Apache Arrow: The Vacuum-Sealed Pack

Arrow is not a file format -- it's an in-memory format. Think of it
as a universal language that different tools speak without translation.

```
  WITHOUT ARROW:
  +--------+     convert     +--------+     convert     +--------+
  | Pandas | -------------> | Spark  | -------------> | DuckDB |
  +--------+   (serialize)  +--------+  (serialize)   +--------+
                 SLOW                      SLOW

  WITH ARROW:
  +--------+                 +--------+                 +--------+
  | Pandas |     shared      | Spark  |     shared      | DuckDB |
  +--------+ <-- memory  --> +--------+ <-- memory  --> +--------+
                 FAST                      FAST
                      (zero-copy reads)
```

```python
import pyarrow as pa

arr = pa.array([1, 2, 3, 4, 5])
table = pa.table({
    "id": [1, 2, 3],
    "value": [10.5, 20.3, 30.1]
})

df = table.to_pandas()
print(df)

back_to_arrow = pa.Table.from_pandas(df)
```

**When Arrow matters:**
- Moving data between tools (Pandas, Spark, DuckDB, Polars)
- High-performance analytics
- Real-time feature computation for ML

---

## Protocol Buffers: The Custom Mold

Protobuf is like a custom-molded container: you define the exact shape
first, then everything must fit that shape. Compact, fast, versioned.

First, define a schema (`.proto` file):

```protobuf
syntax = "proto3";

message UserEvent {
  int64 user_id = 1;
  string action = 2;
  double timestamp = 3;
  map<string, string> metadata = 4;
}
```

Then use it in Python:

```python
from google.protobuf import descriptor_pb2
import struct

user_id = 42
action = "click"
timestamp = 1709856000.0

payload = struct.pack("!q", user_id) + action.encode() + struct.pack("!d", timestamp)
print(f"Binary size: {len(payload)} bytes")

json_payload = f'{{"user_id":{user_id},"action":"{action}","timestamp":{timestamp}}}'
print(f"JSON size: {len(json_payload)} bytes")
```

**When to use Protobuf:**
- Microservice communication (gRPC)
- Event streaming (Kafka messages)
- When schema evolution matters (adding fields without breaking)
- When payload size matters (mobile, IoT)

---

## Format Comparison

```
  +----------+--------+-------+--------+--------+---------+
  | Feature  |  CSV   | JSON  |Parquet | Arrow  | Protobuf|
  +----------+--------+-------+--------+--------+---------+
  | Human    |  Yes   |  Yes  |  No    |  No    |   No    |
  | readable |        |       |        |        |         |
  +----------+--------+-------+--------+--------+---------+
  | Typed    |  No    | Some  |  Yes   |  Yes   |  Yes    |
  +----------+--------+-------+--------+--------+---------+
  | Nested   |  No    |  Yes  |  Yes   |  Yes   |  Yes    |
  +----------+--------+-------+--------+--------+---------+
  | Columnar |  No    |  No   |  Yes   |  Yes   |   No    |
  +----------+--------+-------+--------+--------+---------+
  | Compress |  No    |  No   |  Yes   | N/A    |  Yes    |
  +----------+--------+-------+--------+--------+---------+
  | Schema   |  No    |  No   |  Yes   |  Yes   |  Yes    |
  | enforced |        |       |        |        |         |
  +----------+--------+-------+--------+--------+---------+
  | Best for | Share  | APIs  | Analyt | In-mem | Streaming|
  |          | small  | web   | ics    | proc   | services|
  +----------+--------+-------+--------+--------+---------+
```

---

## Decision Flowchart

```
  Need to share with non-technical people?
    |
    +-- YES --> CSV
    |
    +-- NO --> Is the data nested/semi-structured?
                |
                +-- YES --> Will it be used for analytics?
                |             |
                |             +-- YES --> Parquet (with nested types)
                |             +-- NO  --> JSON/JSONL
                |
                +-- NO --> Is it for service-to-service comms?
                            |
                            +-- YES --> Protobuf
                            +-- NO  --> Will it be queried analytically?
                                          |
                                          +-- YES --> Parquet
                                          +-- NO  --> JSON or CSV
```

---

## Exercises

1. **Size comparison**: Create a DataFrame with 500,000 rows and 10
   columns. Save it as CSV, JSON, and Parquet. Compare file sizes and
   read times using `time.time()`.

2. **Column pruning**: Using a Parquet file with 20 columns, measure
   the time to read all columns vs reading just 2 columns. What
   speedup do you see?

3. **Schema evolution**: Write a Parquet file with columns (id, name).
   Try reading it with code that expects (id, name, email). What
   happens? How would you handle this?

4. **Format conversion pipeline**: Write a Python script that reads
   JSONL from stdin, validates each record has required fields
   (user_id, timestamp, event_type), and writes valid records to
   Parquet. Track and report how many records were invalid.

5. **Arrow zero-copy**: Create a PyArrow table, convert it to Pandas,
   then to a Polars DataFrame. Measure the conversion times and
   compare with CSV-based conversion.

---

[Next: Lesson 02 - SQL for Data Engineers ->](02-sql-for-data-engineers.md)
