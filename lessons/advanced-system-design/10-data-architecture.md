# Lesson 10: Data Architecture

> At small scale, all your data lives in one database and life
> is simple. At large scale, your data is scattered across dozens
> of systems, and figuring out "what's the current state of X?"
> becomes a genuine engineering challenge.

---

## The Analogy

Imagine a hospital with 50 departments. Each department keeps
its own patient records: cardiology has heart data, radiology
has imaging, pharmacy has medication history, billing has
insurance claims.

When a patient arrives in the ER, the doctor needs a complete
picture — fast. But the data is scattered. Different departments
use different systems, different formats, and different IDs for
the same patient. Some records are on paper. Some are in legacy
systems from the 1990s.

That's data architecture at scale. Not a technology problem —
an organizational coordination problem disguised as a technology
problem.

---

## Data Architecture Paradigms

### Centralized Data Warehouse (Traditional)

```
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │ CRM  │ │ ERP  │ │ Web  │ │ App  │
  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
     │        │        │        │
     └────────┴────────┴────────┘
                  │
            ┌─────▼─────┐
            │   ETL     │  (Extract, Transform, Load)
            │  Pipeline │
            └─────┬─────┘
                  │
            ┌─────▼─────┐
            │   Data    │
            │ Warehouse │  (single source of truth)
            └─────┬─────┘
                  │
         ┌────────┼────────┐
         │        │        │
    ┌────▼──┐ ┌───▼───┐ ┌─▼──────┐
    │ BI    │ │Reports│ │ ML     │
    │ Tools │ │       │ │ Models │
    └───────┘ └───────┘ └────────┘

  Pros: Single source of truth, consistent definitions
  Cons: Central team bottleneck, slow to change, doesn't scale
        organizationally
```

### Data Lake

```
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │ CRM  │ │ ERP  │ │ Web  │ │ IoT  │
  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
     │        │        │        │
     └────────┴────────┴────────┘
                  │
            ┌─────▼─────┐
            │ Ingest    │
            │ (raw dump)│
            └─────┬─────┘
                  │
            ┌─────▼──────────────────────────┐
            │           Data Lake             │
            │                                │
            │  /raw/     (as-is from source)  │
            │  /cleaned/ (validated, typed)   │
            │  /curated/ (business-ready)     │
            └────────────────────────────────┘

  Pros: Stores everything, schema-on-read flexibility
  Cons: Becomes a "data swamp" without governance,
        no quality guarantees on raw data
```

### Data Lakehouse

The best parts of warehouses and lakes combined:

```
  ┌──────────────────────────────────────────┐
  │              Data Lakehouse               │
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  │  Storage Layer (S3/GCS/ADLS)     │    │
  │  │  Parquet/ORC files               │    │
  │  └──────────────────────────────────┘    │
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  │  Table Format (Delta/Iceberg/    │    │
  │  │  Hudi)                           │    │
  │  │  - ACID transactions             │    │
  │  │  - Schema evolution              │    │
  │  │  - Time travel                   │    │
  │  │  - Partition evolution            │    │
  │  └──────────────────────────────────┘    │
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  │  Query Engine                    │    │
  │  │  (Spark/Trino/Dremio/DuckDB)    │    │
  │  └──────────────────────────────────┘    │
  └──────────────────────────────────────────┘

  Like a data lake: cheap storage, any format
  Like a warehouse: ACID, schema enforcement, performance
```

---

## Data Mesh

Data mesh is an organizational approach, not a technology.
It treats data as a product owned by domain teams.

```
  Traditional (centralized):

  Domain Teams ──(throw data over the wall)──> Central Data Team
                                                      │
                                               ┌──────▼──────┐
                                               │ Data Platform│
                                               └─────────────┘
  Problems:
  - Central team is bottleneck
  - Domain knowledge is lost in translation
  - Central team doesn't understand the data


  Data Mesh (decentralized):

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Orders Team  │  │ Customer Team│  │ Shipping Team│
  │              │  │              │  │              │
  │ Owns:        │  │ Owns:        │  │ Owns:        │
  │ - Order svc  │  │ - Customer   │  │ - Shipping   │
  │ - Order data │  │   svc        │  │   svc        │
  │   PRODUCT    │  │ - Customer   │  │ - Shipping   │
  │              │  │   data PROD  │  │   data PROD  │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                  ┌────────▼────────┐
                  │ Self-serve Data │
                  │ Platform        │
                  │ (infra, tools,  │
                  │  standards)     │
                  └─────────────────┘

  Each team:
  1. Owns their data as a PRODUCT
  2. Publishes discoverable, documented datasets
  3. Guarantees quality SLOs on their data
  4. Uses shared platform infrastructure
```

### The Four Principles

```
  1. DOMAIN OWNERSHIP
     Data is owned by the team that produces it.
     Not by a central data team.

  2. DATA AS A PRODUCT
     Data products have:
     - Discoverable (in a catalog)
     - Addressable (clear access pattern)
     - Trustworthy (quality SLOs, documentation)
     - Self-describing (schema, metadata)
     - Interoperable (standard formats)
     - Secure (access control, compliance)

  3. SELF-SERVE DATA PLATFORM
     A platform team provides:
     - Storage infrastructure
     - Ingestion pipelines
     - Query engines
     - Data catalog
     - Access control
     - Monitoring

  4. FEDERATED COMPUTATIONAL GOVERNANCE
     Global standards enforced automatically:
     - Naming conventions
     - Schema standards
     - Privacy classification
     - Quality thresholds
     - Interoperability requirements
```

---

## Data Contracts

A data contract is a formal agreement between a data producer
and its consumers about the shape, quality, and semantics of
data.

```yaml
apiVersion: datacontract.com/v1.0.0
kind: DataContract
metadata:
  name: orders-completed
  owner: order-team
  domain: commerce
  tier: critical

schema:
  type: object
  properties:
    order_id:
      type: string
      format: uuid
      description: "Unique order identifier"
      pii: false
    customer_id:
      type: string
      format: uuid
      description: "Customer who placed the order"
      pii: true
      classification: RESTRICTED
    total_amount:
      type: number
      format: decimal
      description: "Order total in cents (USD)"
      minimum: 0
    status:
      type: string
      enum: [completed, refunded, partially_refunded]
    completed_at:
      type: string
      format: date-time
      description: "ISO 8601 timestamp of completion"
  required:
    - order_id
    - customer_id
    - total_amount
    - status
    - completed_at

quality:
  freshness:
    max_delay: "5 minutes"
    description: "Data available within 5 min of order completion"
  completeness:
    threshold: 99.9%
    description: "99.9% of completed orders must appear"
  uniqueness:
    field: order_id
    threshold: 100%
  validity:
    rules:
      - "total_amount >= 0"
      - "completed_at <= NOW()"

sla:
  availability: 99.9%
  support_channel: "#order-data-support"
  breaking_change_notice: "30 days minimum"

access:
  classification: RESTRICTED
  allowed_purposes:
    - analytics
    - reporting
    - ml_training
  requires_approval: true
```

### Enforcing Data Contracts

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import json

@dataclass
class ContractViolation:
    field: str
    rule: str
    actual_value: str
    severity: str

def validate_order_contract(record: dict) -> list[ContractViolation]:
    violations = []

    required_fields = ["order_id", "customer_id", "total_amount", "status", "completed_at"]
    for field in required_fields:
        if field not in record or record[field] is None:
            violations.append(ContractViolation(
                field=field,
                rule="required",
                actual_value="missing",
                severity="error"
            ))

    if "total_amount" in record and record["total_amount"] is not None:
        if record["total_amount"] < 0:
            violations.append(ContractViolation(
                field="total_amount",
                rule="minimum >= 0",
                actual_value=str(record["total_amount"]),
                severity="error"
            ))

    valid_statuses = {"completed", "refunded", "partially_refunded"}
    if "status" in record and record["status"] not in valid_statuses:
        violations.append(ContractViolation(
            field="status",
            rule=f"enum: {valid_statuses}",
            actual_value=str(record["status"]),
            severity="error"
        ))

    return violations

def check_freshness(latest_record_time: datetime, max_delay_minutes: int) -> bool:
    age = datetime.utcnow() - latest_record_time
    return age.total_seconds() <= max_delay_minutes * 60
```

---

## Schema Registry

A schema registry is the source of truth for all data schemas
across the organization.

```
  ┌─────────────────────────────────────────────────────┐
  │                  Schema Registry                     │
  │                                                     │
  │  ┌─────────────────────────────────────────┐        │
  │  │ orders.completed.v1  (Avro/Protobuf)   │        │
  │  │ orders.completed.v2  (added currency)   │        │
  │  │ customers.created.v1                    │        │
  │  │ shipments.updated.v1                    │        │
  │  └─────────────────────────────────────────┘        │
  │                                                     │
  │  Compatibility rules:                               │
  │  - BACKWARD: new schema can read old data           │
  │  - FORWARD: old schema can read new data            │
  │  - FULL: both backward and forward                  │
  │                                                     │
  │  Validation:                                        │
  │  - Schema registered BEFORE producing data          │
  │  - Compatibility check on every new version         │
  │  - Breaking changes require new subject             │
  └─────────────────────────────────────────────────────┘
```

```
  Producer ──> Schema Registry ──> "Is this schema compatible?"
     │              │                      │
     │              │                 YES: register
     │              │                 NO: reject
     │              │
     └──> Kafka ────┘──> Consumer ──> Schema Registry
                                      "How do I read this?"
                                           │
                                      Get schema for
                                      this message's
                                      schema ID
```

---

## Federated Data Platform Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                     DATA PLATFORM                           │
  │                                                             │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
  │  │ Ingestion│  │  Storage │  │  Query   │  │  Catalog  │  │
  │  │          │  │          │  │  Engine  │  │           │  │
  │  │ Kafka    │  │ S3/GCS   │  │ Trino    │  │ DataHub/  │  │
  │  │ Debezium │  │ Delta    │  │ Spark    │  │ Amundsen  │  │
  │  │ Fivetran │  │ Lake     │  │ DuckDB   │  │           │  │
  │  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
  │                                                             │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
  │  │  Schema  │  │  Access  │  │  Quality │  │  Lineage  │  │
  │  │ Registry │  │  Control │  │  Monitor │  │  Tracker  │  │
  │  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
  └─────────────────────────────────────────────────────────────┘

  Domain teams use these building blocks to create data products.
  The platform team maintains the infrastructure.
  Neither needs to understand the other's domain deeply.
```

### Data Discovery and Catalog

```
  Data Catalog Entry:

  ┌──────────────────────────────────────────────┐
  │ Dataset: orders.completed                     │
  │ Owner: order-team                             │
  │ Domain: commerce                              │
  │ Tier: critical                                │
  │                                               │
  │ Description: All completed orders with final  │
  │ amounts, customer references, and timestamps  │
  │                                               │
  │ Schema: 8 fields (see schema tab)             │
  │ Freshness: < 5 min (SLO: 99.9%)              │
  │ Volume: ~50K records/day                      │
  │ Retention: 7 years (regulatory)               │
  │                                               │
  │ Upstream: order-service DB (CDC)              │
  │ Downstream: analytics, ML pipeline, reporting │
  │                                               │
  │ PII: customer_id, shipping_address            │
  │ Classification: RESTRICTED                    │
  │                                               │
  │ Quality Score: 98.7%                          │
  │ Last checked: 2026-03-10 14:30 UTC            │
  └──────────────────────────────────────────────┘
```

---

## Data Governance

Governance isn't bureaucracy — it's the rules that keep data
trustworthy across an organization.

```
  Governance Dimensions:

  ┌────────────────────┬──────────────────────────────────┐
  │ Dimension          │ What It Covers                   │
  ├────────────────────┼──────────────────────────────────┤
  │ Data Quality       │ Accuracy, completeness,          │
  │                    │ consistency, timeliness           │
  ├────────────────────┼──────────────────────────────────┤
  │ Data Security      │ Encryption, access control,      │
  │                    │ audit logging                    │
  ├────────────────────┼──────────────────────────────────┤
  │ Data Privacy       │ PII handling, consent,           │
  │                    │ data residency, GDPR/CCPA        │
  ├────────────────────┼──────────────────────────────────┤
  │ Data Lineage       │ Where data came from, how it     │
  │                    │ was transformed, who uses it     │
  ├────────────────────┼──────────────────────────────────┤
  │ Data Lifecycle     │ Retention, archival, deletion    │
  │                    │ (right to be forgotten)          │
  ├────────────────────┼──────────────────────────────────┤
  │ Data Standards     │ Naming, formats, schemas,        │
  │                    │ compatibility rules              │
  └────────────────────┴──────────────────────────────────┘
```

### Automated Governance

```python
class DataGovernanceChecker:
    def check_pii_classification(self, schema: dict) -> list[str]:
        violations = []
        pii_patterns = ["email", "phone", "ssn", "address", "name", "dob"]

        for field_name, field_spec in schema.get("properties", {}).items():
            for pattern in pii_patterns:
                if pattern in field_name.lower():
                    if not field_spec.get("pii"):
                        violations.append(
                            f"Field '{field_name}' looks like PII "
                            f"but is not classified as such"
                        )
                    if field_spec.get("classification") not in ["RESTRICTED", "CONFIDENTIAL"]:
                        violations.append(
                            f"PII field '{field_name}' must be "
                            f"RESTRICTED or CONFIDENTIAL"
                        )
        return violations

    def check_retention_policy(self, contract: dict) -> list[str]:
        violations = []
        if "retention" not in contract:
            violations.append("Data contract must specify retention policy")
        if contract.get("has_pii") and "deletion_procedure" not in contract:
            violations.append(
                "Datasets with PII must have a deletion procedure "
                "for right-to-be-forgotten requests"
            )
        return violations
```

---

## Exercises

1. **Data mesh assessment.** Your organization has a central data
   team of 8 people serving 20 product teams. The data team has
   a 6-week backlog for new data requests. Evaluate whether data
   mesh is the right approach. What's the migration plan? What
   roles need to change? What are the risks?

2. **Data contract design.** You own the customer service. Other
   teams need: customer profiles for personalization, purchase
   history for ML, and account status for billing. Design data
   contracts for each use case. What SLOs do you guarantee?
   How do you handle schema changes?

3. **Schema evolution.** Your events are serialized with Avro and
   stored in Kafka. You need to add a required field to the
   `OrderCreated` event. This is a backward-incompatible change.
   Design the migration strategy. How do you coordinate producers
   and consumers? How long does the migration take?

4. **Lineage implementation.** Design a data lineage system that
   automatically tracks how data flows from source systems through
   transformations to final data products. What metadata do you
   capture? How do you handle real-time streaming lineage vs
   batch lineage? How does this help when investigating data
   quality issues?

---

[Next: Lesson 11 — Reliability Engineering -->](11-reliability-engineering.md)
