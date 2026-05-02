# Lesson 14: Building a Data Platform

> A data platform is like a city's infrastructure. You need roads
> (pipelines), warehouses (storage), post offices (APIs), traffic
> lights (orchestration), and building codes (governance). No single
> tool does everything. The art is choosing the right tools and
> connecting them well.

---

## What Is a Data Platform?

```
  A data platform is NOT just a database.
  It's the entire system that:

  1. INGESTS data from many sources
  2. STORES it reliably
  3. TRANSFORMS it into useful shapes
  4. SERVES it to consumers (analysts, ML, apps)
  5. GOVERNS who can access what

  +------------------------------------------------------------------+
  |                     DATA PLATFORM                                  |
  |                                                                    |
  |  SOURCES        INGESTION      STORAGE        TRANSFORM    SERVE  |
  |  +------+       +------+       +------+       +------+    +----+  |
  |  | Apps | ----> |      |       |      |       |      |    | BI |  |
  |  | APIs | ----> | Batch| ----> | Lake | ----> | dbt  |--> | ML |  |
  |  | DBs  | ----> | Stream       | House|       | Spark|    | API|  |
  |  | Files| ----> |      |       |      |       |      |    |    |  |
  |  | SaaS | ----> |      |       |      |       |      |    |    |  |
  |  +------+       +------+       +------+       +------+    +----+  |
  |                                                                    |
  |  ORCHESTRATION: Airflow / Dagster / Prefect                       |
  |  GOVERNANCE: Catalog + Access Control + Lineage                   |
  |  MONITORING: Data Quality + Freshness + Costs                     |
  +------------------------------------------------------------------+
```

---

## Architecture Patterns

```
  PATTERN 1: Modern Data Stack (most startups)

  Sources --> [Fivetran/Airbyte] --> [Snowflake/BigQuery] --> [dbt] --> [Looker/Metabase]
              (EL)                   (warehouse)             (T)      (BI)

  Pros: Fast to set up, low ops overhead, scales well
  Cons: Cost grows with data volume, vendor lock-in


  PATTERN 2: Lakehouse (medium to large companies)

  Sources --> [Spark/Flink] --> [Delta Lake / Iceberg] --> [Spark/Trino] --> [BI + ML]
              (ELT)            (object store + table      (query engine)
                                format)

  Pros: Unified batch + streaming, cost-effective storage
  Cons: More complex to operate


  PATTERN 3: Data Mesh (large enterprises)

  +-------------+  +-------------+  +-------------+
  | Domain A    |  | Domain B    |  | Domain C    |
  | (owns data) |  | (owns data) |  | (owns data) |
  | +--------+  |  | +--------+  |  | +--------+  |
  | |Pipeline|  |  | |Pipeline|  |  | |Pipeline|  |
  | |Storage |  |  | |Storage |  |  | |Storage |  |
  | |Quality |  |  | |Quality |  |  | |Quality |  |
  | +--------+  |  | +--------+  |  | +--------+  |
  +------+------+  +------+------+  +------+------+
         |                |                |
         +--------+-------+-------+--------+
                  |               |
           [Data Catalog]   [Governance]
           (discover data)  (access, quality)

  Pros: Scales with org, domain ownership
  Cons: Coordination overhead, needs mature org
```

---

## Choosing a Storage Layer

```
  +---------------------+-----------+----------+---------+----------+
  | Technology          | Best For  | Cost     | Query   | Schema   |
  +---------------------+-----------+----------+---------+----------+
  | Snowflake           | Analytics | $$$$     | Fast    | Required |
  | BigQuery            | Analytics | $$$      | Fast    | Required |
  | Redshift            | Analytics | $$$      | Fast    | Required |
  | Databricks (Delta)  | Analytics | $$$      | Fast    | Flexible |
  |                     | + ML      |          |         |          |
  | S3/GCS + Iceberg    | Lake      | $        | Medium  | Flexible |
  | S3/GCS + Delta      | Lake      | $        | Medium  | Flexible |
  | PostgreSQL          | OLTP+some | $$       | OK      | Required |
  |                     | analytics |          |         |          |
  | ClickHouse          | Real-time | $$       | Fast    | Required |
  |                     | analytics |          |         |          |
  +---------------------+-----------+----------+---------+----------+

  Decision framework:
  - Team < 5, mostly analytics --> Snowflake or BigQuery
  - Team < 5, analytics + ML --> Databricks
  - Cost-sensitive, large data --> S3 + Iceberg + Trino
  - Real-time dashboards --> ClickHouse or Druid
  - Small scale, PostgreSQL already in use --> just use Postgres
```

---

## Choosing an Ingestion Layer

```
  +------------------+---------+---------+----------+--------------+
  | Tool             | Type    | Free    | SaaS     | Best For     |
  +------------------+---------+---------+----------+--------------+
  | Fivetran         | EL      | No      | Yes      | SaaS sources |
  | Airbyte          | EL      | OSS     | Yes      | Custom conn. |
  | Stitch           | EL      | No      | Yes      | Simple ETL   |
  | Debezium         | CDC     | OSS     | No       | DB replication|
  | Kafka Connect    | Stream  | OSS     | Confluent| Event streams|
  | AWS DMS          | CDC     | No      | AWS      | DB migration |
  | Custom scripts   | Any     | Free    | No       | Full control |
  +------------------+---------+---------+----------+--------------+

  CDC = Change Data Capture (captures DB changes in real-time)

  Recommendation:
  - SaaS sources (Salesforce, Stripe): Fivetran or Airbyte
  - Database replication: Debezium
  - Event streams: Kafka + Kafka Connect
  - Custom APIs: Custom Python + Airflow/Prefect
```

---

## End-to-End Platform Build

```python
from dataclasses import dataclass, field
from enum import Enum


class ComponentType(str, Enum):
    INGESTION = "ingestion"
    STORAGE = "storage"
    TRANSFORMATION = "transformation"
    SERVING = "serving"
    ORCHESTRATION = "orchestration"
    GOVERNANCE = "governance"
    MONITORING = "monitoring"


@dataclass
class PlatformComponent:
    name: str
    component_type: ComponentType
    tool: str
    purpose: str
    dependencies: list[str] = field(default_factory=list)
    estimated_monthly_cost: float = 0.0


@dataclass
class DataPlatform:
    name: str
    components: list[PlatformComponent]

    def total_monthly_cost(self) -> float:
        return sum(c.estimated_monthly_cost for c in self.components)

    def dependency_order(self) -> list[str]:
        built: set[str] = set()
        order: list[str] = []

        remaining = {c.name: c for c in self.components}
        while remaining:
            ready = [
                name for name, comp in remaining.items()
                if all(dep in built for dep in comp.dependencies)
            ]
            if not ready:
                raise ValueError(f"Circular dependency: {list(remaining.keys())}")

            for name in ready:
                order.append(name)
                built.add(name)
                del remaining[name]

        return order


startup_platform = DataPlatform(
    name="startup-analytics",
    components=[
        PlatformComponent(
            "ingestion", ComponentType.INGESTION, "Airbyte",
            "Extract from SaaS tools and databases",
            estimated_monthly_cost=0,
        ),
        PlatformComponent(
            "warehouse", ComponentType.STORAGE, "BigQuery",
            "Central analytical storage",
            dependencies=["ingestion"],
            estimated_monthly_cost=500,
        ),
        PlatformComponent(
            "transforms", ComponentType.TRANSFORMATION, "dbt",
            "SQL transformations and data models",
            dependencies=["warehouse"],
            estimated_monthly_cost=100,
        ),
        PlatformComponent(
            "orchestration", ComponentType.ORCHESTRATION, "Prefect",
            "Schedule and monitor pipelines",
            dependencies=["ingestion"],
            estimated_monthly_cost=0,
        ),
        PlatformComponent(
            "bi_tool", ComponentType.SERVING, "Metabase",
            "Dashboards and self-service analytics",
            dependencies=["transforms"],
            estimated_monthly_cost=85,
        ),
        PlatformComponent(
            "quality", ComponentType.MONITORING, "dbt tests + Soda",
            "Data quality checks",
            dependencies=["transforms"],
            estimated_monthly_cost=0,
        ),
        PlatformComponent(
            "catalog", ComponentType.GOVERNANCE, "dbt docs + DataHub",
            "Data discovery and documentation",
            dependencies=["transforms"],
            estimated_monthly_cost=0,
        ),
    ],
)

build_order = startup_platform.dependency_order()
total_cost = startup_platform.total_monthly_cost()
print(f"Build order: {build_order}")
print(f"Estimated monthly cost: ${total_cost}")
```

---

## Platform Evolution Stages

```
  STAGE 1: "Just get data flowing" (Month 1-3)
  +-----------------------------------------------------+
  | Airbyte --> BigQuery --> dbt --> Metabase             |
  | One person, ~$500/month                               |
  +-----------------------------------------------------+

  STAGE 2: "Make it reliable" (Month 3-6)
  +-----------------------------------------------------+
  | Add: Orchestration (Prefect/Airflow)                  |
  | Add: Data quality tests (dbt tests, Great Expect.)    |
  | Add: Alerting (PagerDuty/Slack)                       |
  | Add: Basic monitoring dashboards                      |
  | Two people, ~$1,500/month                              |
  +-----------------------------------------------------+

  STAGE 3: "Scale and govern" (Month 6-12)
  +-----------------------------------------------------+
  | Add: CDC for real-time (Debezium)                     |
  | Add: Feature store (Feast)                            |
  | Add: Data catalog (DataHub)                           |
  | Add: Access controls and PII handling                 |
  | Three people, ~$5,000/month                            |
  +-----------------------------------------------------+

  STAGE 4: "Platform team" (Year 2+)
  +-----------------------------------------------------+
  | Add: Streaming layer (Kafka)                          |
  | Add: ML platform integration                         |
  | Add: Self-service data tools                          |
  | Add: Cost optimization and chargeback                 |
  | Five+ people, ~$20,000+/month                         |
  +-----------------------------------------------------+
```

---

## Common Mistakes

```
  +---------------------------------------+----------------------------+
  | Mistake                               | Better Approach            |
  +---------------------------------------+----------------------------+
  | Build everything at once              | Start minimal, iterate     |
  | Custom-build commodity tools          | Use managed/OSS tools      |
  | No data quality from day 1            | Add tests with first model |
  | Single person bus factor              | Document everything        |
  | Ignore costs until bill arrives       | Set budget alerts early    |
  | Over-engineer for scale you don't have| Design for 10x, not 1000x |
  | Skip data modeling ("just dump it")   | Invest in dbt models       |
  | No access controls                    | Column-level security      |
  | Treat it as a one-time project        | It's a product, maintain it|
  +---------------------------------------+----------------------------+
```

---

## Exercises

1. **Platform design**: For a company with 5 SaaS tools (Stripe,
   Salesforce, Hubspot, GA4, internal Postgres), design a data
   platform. Document each component, why you chose it, and
   estimated cost.

2. **Build Stage 1**: Using Airbyte + DuckDB + dbt, build a
   minimal data platform that ingests data from 2 sources,
   transforms it, and produces a dashboard-ready dataset.

3. **Dependency graph**: Implement the dependency_order function
   and test it with a platform that has 10 components. Detect
   circular dependencies.

4. **Cost model**: Build a cost calculator that takes data volume,
   query frequency, and team size as inputs and recommends a
   storage layer (Snowflake vs BigQuery vs S3+Iceberg).

5. **Migration plan**: You have a legacy platform (data in MySQL,
   transformations in cron scripts, reports in Excel). Design a
   migration plan to a modern stack. Include timeline, risks,
   and rollback strategy.

---

**Next**: [Reference - Data Engineering Tools](./reference-tools.md)
