# Lesson 12: Privacy & Compliance

> Think of personal data like someone's mail. You can handle it to
> deliver it (processing for a purpose), but you can't open it, copy
> it, or share it without permission. Data privacy laws formalize
> exactly what you can and can't do with people's information --
> and the penalties for getting it wrong are severe.

---

## Why Engineers Must Care

```
  GDPR fine: up to 4% of global annual revenue or 20M euros
  CCPA fine: $2,500 per unintentional violation, $7,500 per intentional

  Meta (Facebook):  1.2B euro fine (2023)
  Amazon:           746M euro fine (2021)
  Google:           50M euro fine (2019)

  +--------------------------------------------------+
  | It's not just legal's problem.                     |
  | Engineers BUILD the systems that handle data.      |
  | If the system leaks PII, the engineer's design    |
  | is part of the problem.                            |
  +--------------------------------------------------+
```

---

## Key Regulations

```
  +--------+-------------+-------+------------------------------+
  | Law    | Region      | Year  | Key Rights                   |
  +--------+-------------+-------+------------------------------+
  | GDPR   | EU/EEA      | 2018  | Right to erasure,            |
  |        |             |       | data portability,            |
  |        |             |       | consent, DPO required        |
  +--------+-------------+-------+------------------------------+
  | CCPA/  | California  | 2020/ | Right to know, delete,       |
  | CPRA   |             | 2023  | opt-out of sale              |
  +--------+-------------+-------+------------------------------+
  | HIPAA  | USA         | 1996  | Protected health info,       |
  |        |             |       | de-identification required   |
  +--------+-------------+-------+------------------------------+
  | PIPEDA | Canada      | 2000  | Consent, access, accuracy    |
  +--------+-------------+-------+------------------------------+
  | LGPD   | Brazil      | 2020  | Similar to GDPR              |
  +--------+-------------+-------+------------------------------+

  Common thread: users have rights over their data,
  organizations must handle it responsibly.
```

---

## PII -- Personally Identifiable Information

```
  DIRECT PII (identifies a person alone):
  +----------------------------------+
  | Full name                        |
  | Email address                    |
  | Phone number                     |
  | Social security number           |
  | Passport number                  |
  | Credit card number               |
  | IP address                       |
  | Biometric data                   |
  +----------------------------------+

  INDIRECT PII (identifies when combined):
  +----------------------------------+
  | Date of birth + ZIP code + gender|
  | Job title + company + city       |
  | Device ID + browsing history     |
  +----------------------------------+

  87% of the US population can be uniquely identified
  by just: ZIP code + birth date + gender
```

---

## PII Detection

```python
import re
from dataclasses import dataclass
from enum import Enum


class PIIType(str, Enum):
    EMAIL = "email"
    PHONE = "phone"
    SSN = "ssn"
    CREDIT_CARD = "credit_card"
    IP_ADDRESS = "ip_address"
    NAME = "name"


@dataclass
class PIIMatch:
    pii_type: PIIType
    value: str
    column: str
    row_index: int


PII_PATTERNS = {
    PIIType.EMAIL: re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
    PIIType.PHONE: re.compile(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b"),
    PIIType.SSN: re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    PIIType.CREDIT_CARD: re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"),
    PIIType.IP_ADDRESS: re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"),
}


def scan_dataframe_for_pii(df, sample_size=1000):
    matches = []
    sample = df.head(sample_size)

    for col in sample.columns:
        if sample[col].dtype != "object":
            continue

        for idx, value in sample[col].items():
            if not isinstance(value, str):
                continue

            for pii_type, pattern in PII_PATTERNS.items():
                if pattern.search(value):
                    matches.append(PIIMatch(
                        pii_type=pii_type,
                        value=value[:20] + "...",
                        column=col,
                        row_index=idx,
                    ))

    return matches


def generate_pii_report(matches):
    report = {"total_matches": len(matches), "by_type": {}, "by_column": {}}

    for match in matches:
        pii_type = match.pii_type.value
        report["by_type"][pii_type] = report["by_type"].get(pii_type, 0) + 1
        report["by_column"][match.column] = report["by_column"].get(match.column, 0) + 1

    return report
```

---

## Anonymization Techniques

```
  ORIGINAL DATA:
  +--------+------------------+-------+------+
  | Name   | Email            | Age   | City |
  +--------+------------------+-------+------+
  | Alice  | alice@mail.com   | 32    | NYC  |
  | Bob    | bob@work.com     | 45    | LA   |
  +--------+------------------+-------+------+

  TECHNIQUE 1: Masking
  +--------+------------------+-------+------+
  | A****  | a****@m***.com   | 32    | NYC  |
  | B**    | b**@w***.com     | 45    | LA   |
  +--------+------------------+-------+------+

  TECHNIQUE 2: Pseudonymization (reversible with key)
  +--------+------------------+-------+------+
  | USR_A1 | hash_a1@anon.com | 32    | NYC  |
  | USR_B2 | hash_b2@anon.com | 45    | LA   |
  +--------+------------------+-------+------+

  TECHNIQUE 3: Generalization
  +--------+------------------+-------+------+
  | [removed]| [removed]      | 30-39 | NY*  |
  | [removed]| [removed]      | 40-49 | CA*  |
  +--------+------------------+-------+------+

  TECHNIQUE 4: K-Anonymity (k=2: every record matches 1+ others)
  +-------+------+
  | 30-39 | NY*  |   At least 2 people match
  | 30-39 | NY*  |   each combination
  | 40-49 | CA*  |
  | 40-49 | CA*  |
  +-------+------+
```

```python
import hashlib
from typing import Callable


class Anonymizer:
    def __init__(self, salt: str):
        self.salt = salt

    def hash_value(self, value: str) -> str:
        salted = f"{self.salt}:{value}"
        return hashlib.sha256(salted.encode()).hexdigest()[:16]

    def mask_email(self, email: str) -> str:
        if "@" not in email:
            return "***"
        local, domain = email.split("@", 1)
        masked_local = local[0] + "*" * (len(local) - 1) if local else "*"
        return f"{masked_local}@{domain}"

    def mask_phone(self, phone: str) -> str:
        digits = re.sub(r"\D", "", phone)
        if len(digits) < 4:
            return "***"
        return "*" * (len(digits) - 4) + digits[-4:]

    def generalize_age(self, age: int, bucket_size: int = 10) -> str:
        lower = (age // bucket_size) * bucket_size
        upper = lower + bucket_size - 1
        return f"{lower}-{upper}"

    def anonymize_dataframe(self, df, column_strategies: dict[str, Callable]):
        result = df.copy()
        for column, strategy in column_strategies.items():
            if column in result.columns:
                result[column] = result[column].apply(strategy)
        return result


anonymizer = Anonymizer(salt="my-secret-salt-2024")

strategies = {
    "name": anonymizer.hash_value,
    "email": anonymizer.mask_email,
    "phone": anonymizer.mask_phone,
    "age": lambda x: anonymizer.generalize_age(x, bucket_size=10),
}
```

---

## Right to Erasure (GDPR Article 17)

```
  User request: "Delete all my data"

  +--------------------------------------------------+
  |  Data erasure cascade:                             |
  |                                                    |
  |  1. Production DB: DELETE WHERE user_id = X       |
  |  2. Data warehouse: Overwrite/purge partitions    |
  |  3. ML training data: Remove from datasets        |
  |  4. Feature store: Delete user features           |
  |  5. Model artifacts: Retrain if needed            |
  |  6. Logs: Redact PII from logs                    |
  |  7. Backups: Schedule for deletion                |
  |  8. Third parties: Notify to delete               |
  +--------------------------------------------------+

  This is HARD because data is everywhere.
```

```python
from dataclasses import dataclass
from datetime import datetime


@dataclass
class DeletionRequest:
    request_id: str
    user_id: str
    requested_at: datetime
    systems: list[str]
    completed: dict[str, bool]
    deadline: datetime


class DeletionService:
    def __init__(self):
        self.requests: dict[str, DeletionRequest] = {}

    def create_request(self, user_id: str, deadline_days: int = 30) -> DeletionRequest:
        import uuid
        request = DeletionRequest(
            request_id=str(uuid.uuid4()),
            user_id=user_id,
            requested_at=datetime.utcnow(),
            systems=[
                "production_db",
                "data_warehouse",
                "feature_store",
                "ml_training_data",
                "logs",
                "backups",
            ],
            completed={},
            deadline=datetime.utcnow() + timedelta(days=deadline_days),
        )
        self.requests[request.request_id] = request
        return request

    def mark_completed(self, request_id: str, system: str):
        request = self.requests[request_id]
        request.completed[system] = True

    def is_fully_deleted(self, request_id: str) -> bool:
        request = self.requests[request_id]
        return all(
            request.completed.get(system, False)
            for system in request.systems
        )

    def overdue_requests(self) -> list[DeletionRequest]:
        now = datetime.utcnow()
        return [
            req for req in self.requests.values()
            if not self.is_fully_deleted(req.request_id) and now > req.deadline
        ]
```

---

## Data Governance Framework

```
  +------------------------------------------------------------------+
  |  Data Governance Pillars                                          |
  |                                                                    |
  |  CLASSIFICATION     ACCESS CONTROL     LINEAGE        AUDIT       |
  |  +--------+         +--------+         +--------+    +--------+  |
  |  | What   |         | Who    |         | Where  |    | What   |  |
  |  | data   |         | can    |         | did    |    | happened|  |
  |  | is     |         | access |         | data   |    | and    |  |
  |  | sensitive|       | what   |         | come   |    | when   |  |
  |  +--------+         +--------+         | from   |    +--------+  |
  |                                        +--------+                 |
  |                                                                    |
  |  DATA CLASSIFICATION LEVELS:                                      |
  |  +---------------+----------------------------------------+       |
  |  | Public        | Can be shared freely                    |       |
  |  | Internal      | Company employees only                 |       |
  |  | Confidential  | Need-to-know basis                     |       |
  |  | Restricted    | Legal/regulatory protection required   |       |
  |  +---------------+----------------------------------------+       |
  +------------------------------------------------------------------+
```

```python
from enum import Enum
from dataclasses import dataclass


class DataClassification(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


@dataclass
class ColumnMetadata:
    name: str
    classification: DataClassification
    contains_pii: bool
    retention_days: int | None
    anonymization_required: bool


@dataclass
class DataCatalogEntry:
    table_name: str
    owner: str
    columns: list[ColumnMetadata]
    purpose: str
    legal_basis: str
    retention_policy: str

    def restricted_columns(self) -> list[str]:
        return [
            col.name for col in self.columns
            if col.classification == DataClassification.RESTRICTED
        ]

    def pii_columns(self) -> list[str]:
        return [col.name for col in self.columns if col.contains_pii]


users_table = DataCatalogEntry(
    table_name="users",
    owner="backend-team",
    purpose="User account management",
    legal_basis="Contract performance",
    retention_policy="Delete 30 days after account closure",
    columns=[
        ColumnMetadata("user_id", DataClassification.INTERNAL, False, None, False),
        ColumnMetadata("email", DataClassification.CONFIDENTIAL, True, None, True),
        ColumnMetadata("full_name", DataClassification.CONFIDENTIAL, True, None, True),
        ColumnMetadata("ssn", DataClassification.RESTRICTED, True, 365, True),
        ColumnMetadata("created_at", DataClassification.INTERNAL, False, None, False),
    ],
)
```

---

## Differential Privacy

```
  Idea: add calibrated noise so individual records can't be
  identified, but aggregate statistics remain accurate.

  Without differential privacy:
  Query: "How many users in NYC earn > $100K?"
  Answer: 1,247

  Query: "How many users in NYC earn > $100K, excluding user_42?"
  Answer: 1,246

  Conclusion: user_42 earns > $100K!  (privacy breach)

  With differential privacy:
  Query 1 answer: 1,247 + noise = 1,251
  Query 2 answer: 1,246 + noise = 1,243

  Can't determine user_42's salary from the difference.
```

```python
import numpy as np


def laplace_mechanism(true_value: float, sensitivity: float, epsilon: float) -> float:
    scale = sensitivity / epsilon
    noise = np.random.laplace(0, scale)
    return true_value + noise


true_count = 1247
dp_count = laplace_mechanism(true_count, sensitivity=1.0, epsilon=0.1)
print(f"True: {true_count}, DP: {dp_count:.0f}")
```

---

## Exercises

1. **PII scanner**: Run the PII detection code on a sample
   dataset. Identify all PII columns and generate a report.

2. **Anonymization pipeline**: Build a pipeline that reads raw
   data, anonymizes PII columns using appropriate techniques,
   and writes the anonymized data. Verify the output.

3. **Deletion cascade**: Implement a deletion service that tracks
   which systems have completed deletion for a user. Add alerts
   for overdue requests.

4. **Data catalog**: Create catalog entries for 3 tables in a
   system you know. Classify each column. Identify which columns
   need anonymization for analytics use.

5. **Differential privacy**: Implement the Laplace mechanism.
   Run 1000 queries with different epsilon values (0.01, 0.1,
   1.0, 10.0). Plot the tradeoff between privacy (epsilon) and
   accuracy (error from true value).

---

**Next**: [Lesson 13 - Unstructured Data](./13-unstructured-data.md)
