# Reference: Data Engineering Tools

A comparison of tools for each layer of a data engineering stack.

---

## Ingestion

```
  +------------------+---------+----------+----------+-----------------+
  | Tool             | Type    | Pricing  | Managed  | Best For        |
  +------------------+---------+----------+----------+-----------------+
  | Fivetran         | EL      | Per row  | Yes      | SaaS connectors |
  | Airbyte          | EL      | OSS/Paid | Both     | Custom sources   |
  | Stitch           | EL      | Per row  | Yes      | Simple setups    |
  | Meltano          | EL      | OSS      | No       | Singer ecosystem |
  | Debezium         | CDC     | OSS      | No       | DB replication   |
  | Kafka Connect    | Stream  | OSS/Conf.| Both     | Event streaming  |
  | AWS DMS          | CDC     | Usage    | Yes      | AWS migrations   |
  | Striim           | CDC     | Paid     | Both     | Enterprise CDC   |
  +------------------+---------+----------+----------+-----------------+
```

---

## Storage

```
  WAREHOUSES (structured, SQL-first):
  +------------------+----------+----------+--------------------------+
  | Tool             | Pricing  | Best For | Separation of Compute?   |
  +------------------+----------+----------+--------------------------+
  | Snowflake        | Usage    | General  | Yes                      |
  | BigQuery         | Usage    | GCP      | Yes                      |
  | Redshift         | Instance | AWS      | Serverless option        |
  | Databricks SQL   | Usage    | Lakehouse| Yes                      |
  +------------------+----------+----------+--------------------------+

  DATA LAKES (flexible, multi-format):
  +------------------+----------+----------+--------------------------+
  | Tool             | Pricing  | Best For | Table Format             |
  +------------------+----------+----------+--------------------------+
  | S3 + Iceberg     | Storage  | Cost     | Apache Iceberg           |
  | S3 + Delta Lake  | Storage  | Databricks| Delta Lake              |
  | GCS + Hudi       | Storage  | Streaming| Apache Hudi              |
  | ADLS + Iceberg   | Storage  | Azure    | Apache Iceberg           |
  +------------------+----------+----------+--------------------------+

  REAL-TIME ANALYTICS:
  +------------------+----------+----------+--------------------------+
  | Tool             | Pricing  | Best For | Latency                  |
  +------------------+----------+----------+--------------------------+
  | ClickHouse       | OSS/Paid | Analytics| Sub-second               |
  | Apache Druid     | OSS      | OLAP     | Sub-second               |
  | Apache Pinot     | OSS      | User-facing| Sub-second             |
  | StarRocks        | OSS      | Analytics| Sub-second               |
  +------------------+----------+----------+--------------------------+
```

---

## Transformation

```
  +------------------+----------+----------+--------------------------+
  | Tool             | Language | Type     | Best For                 |
  +------------------+----------+----------+--------------------------+
  | dbt              | SQL      | Batch    | Analytics transforms     |
  | Apache Spark     | Python/  | Batch +  | Large-scale processing   |
  |                  | Scala/SQL| Stream   |                          |
  | Apache Flink     | Java/SQL | Stream   | Real-time processing     |
  | Apache Beam      | Python/  | Both     | Portable pipelines       |
  |                  | Java     |          |                          |
  | Pandas           | Python   | Batch    | Small datasets (<10GB)   |
  | Polars           | Python/  | Batch    | Medium datasets          |
  |                  | Rust     |          |                          |
  | DuckDB           | SQL      | Batch    | Local analytics          |
  | SQLMesh          | SQL      | Batch    | dbt alternative          |
  +------------------+----------+----------+--------------------------+
```

---

## Orchestration

```
  +------------------+----------+----------+--------------------------+
  | Tool             | Pricing  | UI       | Best For                 |
  +------------------+----------+----------+--------------------------+
  | Apache Airflow   | OSS      | Good     | General-purpose, mature  |
  | Prefect          | OSS/Paid | Great    | Modern, Python-native    |
  | Dagster          | OSS/Paid | Great    | Asset-oriented, data-aware|
  | Mage             | OSS/Paid | Good     | Simple pipelines         |
  | Temporal         | OSS/Paid | Basic    | Complex workflows        |
  | Argo Workflows   | OSS      | Basic    | Kubernetes-native        |
  +------------------+----------+----------+--------------------------+

  Comparison:
  - Airflow: most connectors, largest community, can be complex
  - Prefect: easier than Airflow, great DX, less enterprise features
  - Dagster: best for data teams, asset-aware, good testing
```

---

## Data Quality

```
  +------------------+----------+----------+--------------------------+
  | Tool             | Pricing  | Type     | Best For                 |
  +------------------+----------+----------+--------------------------+
  | Great Expectations| OSS     | Python   | Custom validation        |
  | dbt tests        | OSS      | SQL      | In-pipeline testing      |
  | Soda             | OSS/Paid | YAML/SQL | Easy setup               |
  | Monte Carlo      | Paid     | Automated| Enterprise monitoring    |
  | Anomalo          | Paid     | ML-based | Automated anomaly detect |
  | Pandera          | OSS      | Python   | Pandas/Spark validation  |
  | Elementary       | OSS      | dbt      | dbt-native monitoring    |
  +------------------+----------+----------+--------------------------+
```

---

## Data Catalog & Governance

```
  +------------------+----------+----------+--------------------------+
  | Tool             | Pricing  | Type     | Best For                 |
  +------------------+----------+----------+--------------------------+
  | DataHub          | OSS      | Catalog  | General-purpose          |
  | OpenMetadata     | OSS      | Catalog  | Modern, full-featured    |
  | Amundsen         | OSS      | Discovery| Search-focused           |
  | Atlan            | Paid     | Catalog  | Enterprise governance    |
  | Collibra         | Paid     | Governance| Enterprise compliance   |
  | dbt docs         | OSS      | Docs     | dbt ecosystems           |
  | Unity Catalog    | OSS      | Catalog  | Databricks ecosystem     |
  +------------------+----------+----------+--------------------------+
```

---

## Streaming

```
  +------------------+----------+----------+--------------------------+
  | Tool             | Pricing  | Type     | Best For                 |
  +------------------+----------+----------+--------------------------+
  | Apache Kafka     | OSS/Conf.| Pub/Sub  | Event backbone           |
  | AWS Kinesis      | Usage    | Stream   | AWS-native               |
  | GCP Pub/Sub      | Usage    | Pub/Sub  | GCP-native               |
  | Apache Pulsar    | OSS      | Pub/Sub  | Multi-tenancy            |
  | Redpanda         | OSS/Paid | Pub/Sub  | Kafka-compatible, faster |
  | AWS MSK          | Instance | Managed  | Managed Kafka on AWS     |
  +------------------+----------+----------+--------------------------+
```

---

## Recommended Stacks by Scale

```
  SOLO / STARTUP (< 100GB, 1-2 people):
  +--------------------------------------------------+
  | Airbyte + DuckDB/Postgres + dbt + Metabase       |
  | Cost: ~$100/month                                 |
  +--------------------------------------------------+

  GROWING COMPANY (100GB-10TB, 3-5 people):
  +--------------------------------------------------+
  | Airbyte + Snowflake/BigQuery + dbt + Looker       |
  | + Prefect + Great Expectations                     |
  | Cost: ~$2,000-5,000/month                          |
  +--------------------------------------------------+

  SCALE (10TB+, 5+ people):
  +--------------------------------------------------+
  | Kafka + Spark + Delta Lake + dbt + Airflow        |
  | + DataHub + Monte Carlo + Superset                 |
  | Cost: ~$10,000-50,000/month                        |
  +--------------------------------------------------+

  ENTERPRISE (100TB+, dedicated platform team):
  +--------------------------------------------------+
  | Confluent + Databricks + Airflow + Atlan          |
  | + Monte Carlo + Custom tooling                     |
  | Cost: $50,000+/month                               |
  +--------------------------------------------------+
```
