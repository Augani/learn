# Data Engineering for ML - Track Roadmap

Welcome to the Data Engineering for ML track. This track takes you from
raw data fundamentals to building production-ready data platforms that
feed machine learning systems.

```
  YOU ARE HERE
      |
      v
  +---+---+    +---+---+    +---+---+    +---+---+
  |  DATA  | -> | PIPE- | -> |  ML   | -> | PROD  |
  | BASICS |    | LINES |    | INFRA |    | SCALE |
  +---+---+    +---+---+    +---+---+    +---+---+
      |            |            |            |
   Formats      ETL/ELT     Features     Platform
   SQL          Spark       Quality      Privacy
   Modeling     Streaming   Real-time    Unstructured
               Warehouses   dbt/Orch     Architecture
```

---

## Phase 1: Data Foundations

The building blocks. You can't engineer what you don't understand.

- [ ] [01 - Data Formats](01-data-formats.md)
  CSV, Parquet, Arrow, JSON, Protocol Buffers
- [ ] [02 - SQL for Data Engineers](02-sql-for-data-engineers.md)
  Window functions, CTEs, optimization, analytical queries
- [ ] [03 - ETL vs ELT](03-etl-vs-elt.md)
  Extract, transform, load pipelines and the modern data stack
- [ ] [04 - Data Modeling](07-data-modeling.md)
  Star schema, dimensional modeling, fact and dimension tables

```
  Phase 1 Checkpoint:
  +------------------------------------------+
  | Can you...                               |
  |  - Choose the right format for a task?   |
  |  - Write analytical SQL queries?         |
  |  - Design a star schema?                 |
  |  - Explain ETL vs ELT tradeoffs?         |
  +------------------------------------------+
```

---

## Phase 2: Pipeline Infrastructure

Now you build the highways that move data from A to B.

- [ ] [04 - Apache Spark](04-apache-spark.md)
  Distributed data processing, RDDs, DataFrames, PySpark
- [ ] [05 - Streaming Data](05-streaming-data.md)
  Kafka, event-driven pipelines, real-time processing
- [ ] [06 - Warehouses vs Lakes](06-warehouses-vs-lakes.md)
  BigQuery, Snowflake, S3, data lakehouse architecture
- [ ] [08 - dbt](08-dbt.md)
  Transforming data with SQL, version control, models, tests
- [ ] [09 - Orchestration](09-orchestration.md)
  Airflow DAGs, scheduling, dependencies, retries

```
  Phase 2 Checkpoint:
  +------------------------------------------+
  | Can you...                               |
  |  - Process data with PySpark?            |
  |  - Set up a Kafka consumer?              |
  |  - Choose warehouse vs lake vs lakehouse?|
  |  - Build dbt models with tests?          |
  |  - Orchestrate a DAG in Airflow?         |
  +------------------------------------------+
```

---

## Phase 3: ML-Specific Data Engineering

Where data engineering meets ML requirements.

- [ ] [10 - Data Quality & Validation](10-data-quality-validation.md)
  Testing data pipelines, expectations, schema enforcement
- [ ] [11 - Real-time ML Features](11-realtime-ml-features.md)
  Streaming feature computation, freshness, online/offline consistency
- [ ] [12 - Privacy & Compliance](12-privacy-compliance.md)
  GDPR, PII handling, anonymization, data governance

```
  Phase 3 Checkpoint:
  +------------------------------------------+
  | Can you...                               |
  |  - Write Great Expectations suites?      |
  |  - Build a streaming feature pipeline?   |
  |  - Implement PII anonymization?          |
  |  - Design for GDPR compliance?           |
  +------------------------------------------+
```

---

## Phase 4: Production Scale

Putting it all together for real-world ML systems.

- [ ] [13 - Unstructured Data](13-unstructured-data.md)
  Text, images, audio at scale, processing pipelines
- [ ] [14 - Building a Data Platform](14-building-data-platform.md)
  End-to-end architecture, choosing tools, team structure

```
  Phase 4 Checkpoint:
  +------------------------------------------+
  | Can you...                               |
  |  - Process unstructured data at scale?   |
  |  - Design an end-to-end data platform?   |
  |  - Choose the right tools for a team?    |
  |  - Present a platform architecture?      |
  +------------------------------------------+
```

---

## Reference Materials

- [Data Engineering Tools Comparison](reference-tools.md)
- [Common SQL Patterns](reference-sql-patterns.md)

---

## Suggested Timeline

```
  Week 1-2:  Phase 1 (Foundations)
  Week 3-4:  Phase 2 (Pipelines)
  Week 5-6:  Phase 3 (ML-Specific)
  Week 7-8:  Phase 4 (Production)

  +----+----+----+----+----+----+----+----+
  | W1 | W2 | W3 | W4 | W5 | W6 | W7 | W8 |
  +----+----+----+----+----+----+----+----+
  |<- Found ->|<- Pipes ->|<- ML  ->|<-Prod>|
```

---

## Prerequisites

- Python basics (functions, classes, pip)
- SQL fundamentals (SELECT, JOIN, GROUP BY)
- Command line comfort
- Optional: Docker basics

---

## How to Use This Track

1. Work through lessons in order within each phase
2. Run every code example yourself
3. Complete the exercises at the end of each lesson
4. Check off lessons as you complete them
5. Use reference files as quick-lookup guides

---

[Start with Lesson 01: Data Formats ->](01-data-formats.md)
