# Lesson 09: Feature Stores

## Pre-Prepped Ingredients in a Restaurant Kitchen

```
  Without Feature Store              With Feature Store
  (cooking from scratch)             (mise en place)

  +------------------------+         +------------------------+
  | Every dish:            |         | Prep station:          |
  | - Chop onions          |         | - Pre-chopped onions   |
  | - Mince garlic         |         | - Pre-minced garlic    |
  | - Dice tomatoes        |         | - Pre-diced tomatoes   |
  | - Measure spices       |         | - Pre-measured spices  |
  |                        |         |                        |
  | 30 min per order       |         | Grab and cook          |
  | Inconsistent cuts      |         | 5 min per order        |
  | Duplicate work         |         | Consistent every time  |
  +------------------------+         +------------------------+
```

A feature store is like **mise en place** (everything in its
place) in a professional kitchen. Features are pre-computed,
pre-stored, and ready to grab -- whether you're training a model
(batch) or serving predictions (real-time).

---

## The Feature Problem

```
  Without a Feature Store:

  Team A (Fraud)          Team B (Recommendations)
  +-------------------+   +-------------------+
  | Compute:          |   | Compute:          |
  | user_avg_spend    |   | user_avg_spend    |  <-- same feature,
  | user_tx_count     |   | user_tx_count     |      computed twice,
  | user_location     |   | user_last_login   |      possibly different!
  +-------------------+   +-------------------+
  Uses: Python + Pandas    Uses: Spark + SQL

  Result: Different values for "user_avg_spend"
  because they compute it differently.
```

```
  With a Feature Store:

  Feature Store (single source of truth)
  +------------------------------------------+
  | user_avg_spend    | defined ONCE         |
  | user_tx_count     | computed ONCE        |
  | user_location     | consistent ALWAYS    |
  | user_last_login   |                      |
  +------------------------------------------+
       |                    |
       v                    v
  Team A (Fraud)     Team B (Recommendations)
  Just fetch features -- no recomputation.
```

---

## Online vs Offline Feature Stores

```
  Offline Store                    Online Store
  (warehouse / data lake)          (key-value store)

  +------------------------+       +------------------------+
  | Historical features    |       | Latest features        |
  | For training           |       | For real-time serving  |
  | High latency OK        |       | Low latency required   |
  | Batch queries          |       | Point lookups          |
  |                        |       |                        |
  | "What were this user's |       | "What are this user's  |
  |  features last month?" |       |  features RIGHT NOW?"  |
  |                        |       |                        |
  | Storage: Parquet, BQ   |       | Storage: Redis, DynamoDB|
  +------------------------+       +------------------------+

  Training:  Offline Store --> Historical features --> Model.fit()
  Serving:   Online Store  --> Current features   --> Model.predict()
```

---

## Feast: The Open-Source Feature Store

```
  Feast Architecture
  +--------------------------------------------------+
  |                                                    |
  |  Define features --> Materialize --> Serve          |
  |                                                    |
  |  feature_store.yaml                                |
  |       |                                            |
  |       v                                            |
  |  +----------+     +----------+     +----------+   |
  |  | Offline  | --> | Feast    | --> | Online   |   |
  |  | Store    |     | (mater.) |     | Store    |   |
  |  | (Parquet)|     |          |     | (Redis)  |   |
  |  +----------+     +----------+     +----------+   |
  |                                         |          |
  |                                    Serve features  |
  |                                    in < 10ms       |
  +--------------------------------------------------+
```

### Defining Features in Feast

```python
from datetime import timedelta
from feast import (
    Entity,
    FeatureView,
    Field,
    FileSource,
    ValueType,
)
from feast.types import Float32, Int64, String


user = Entity(
    name="user_id",
    value_type=ValueType.STRING,
    description="Unique user identifier",
)

user_features_source = FileSource(
    path="data/user_features.parquet",
    timestamp_field="event_timestamp",
    created_timestamp_column="created_timestamp",
)

user_features = FeatureView(
    name="user_features",
    entities=[user],
    ttl=timedelta(days=1),
    schema=[
        Field(name="avg_transaction_amount", dtype=Float32),
        Field(name="total_transactions", dtype=Int64),
        Field(name="account_age_days", dtype=Int64),
        Field(name="preferred_category", dtype=String),
    ],
    source=user_features_source,
    online=True,
)
```

### Feature Store Setup

```yaml
# feature_store.yaml
project: fraud_detection
registry: data/registry.db
provider: local
online_store:
  type: redis
  connection_string: "localhost:6379"
offline_store:
  type: file
entity_key_serialization_version: 2
```

### Materializing Features

```bash
feast apply

feast materialize-incremental $(date -u +"%Y-%m-%dT%H:%M:%S")
```

### Fetching Features for Training

```python
from feast import FeatureStore
import pandas as pd

store = FeatureStore(repo_path=".")

entity_df = pd.DataFrame({
    "user_id": ["user_001", "user_002", "user_003"],
    "event_timestamp": pd.to_datetime(["2024-01-15"] * 3),
})

training_df = store.get_historical_features(
    entity_df=entity_df,
    features=[
        "user_features:avg_transaction_amount",
        "user_features:total_transactions",
        "user_features:account_age_days",
    ],
).to_df()

print(training_df)
```

### Fetching Features for Serving

```python
online_features = store.get_online_features(
    features=[
        "user_features:avg_transaction_amount",
        "user_features:total_transactions",
        "user_features:account_age_days",
    ],
    entity_rows=[{"user_id": "user_001"}],
).to_dict()

print(online_features)
```

---

## Feature Engineering Pipeline

```
  Raw Events                 Feature Store
  +------------------+       +------------------+
  | user_id: u123    |       | user_id: u123    |
  | action: purchase |  -->  | avg_spend: 45.2  |
  | amount: 29.99    |       | tx_count: 142    |
  | timestamp: ...   |       | last_active: 2h  |
  +------------------+       +------------------+
  Raw, granular events        Aggregated, ready-to-use
```

### Computing Features with Pandas

```python
import pandas as pd
from datetime import datetime, timezone


def compute_user_features(
    transactions: pd.DataFrame,
    reference_time: datetime | None = None,
) -> pd.DataFrame:
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)

    user_groups = transactions.groupby("user_id")

    features = pd.DataFrame()
    features["avg_transaction_amount"] = user_groups["amount"].mean()
    features["total_transactions"] = user_groups["amount"].count()
    features["max_transaction_amount"] = user_groups["amount"].max()
    features["std_transaction_amount"] = user_groups["amount"].std().fillna(0)

    latest_tx = user_groups["timestamp"].max()
    features["days_since_last_tx"] = (
        (pd.Timestamp(reference_time) - latest_tx).dt.total_seconds() / 86400
    )

    features["event_timestamp"] = reference_time
    features = features.reset_index()

    return features
```

---

## Training-Serving Skew

The biggest danger a feature store prevents:

```
  Training-Serving Skew
  +--------------------------------------------------+
  |                                                    |
  | Training:  avg_spend = mean(last 30 days)          |
  | Serving:   avg_spend = mean(last 7 days)           |
  |                                                    |
  | Same name, different calculation!                   |
  | Model trained on one definition, served another.   |
  |                                                    |
  | Result: silently wrong predictions                  |
  |         (the worst kind of bug)                     |
  +--------------------------------------------------+

  Feature Store Fix:
  +--------------------------------------------------+
  | Define avg_spend ONCE in the feature store.        |
  | Training reads from offline store.                  |
  | Serving reads from online store.                   |
  | Same definition, guaranteed.                       |
  +--------------------------------------------------+
```

---

## Feature Store with FastAPI

```python
from fastapi import FastAPI, HTTPException
from feast import FeatureStore
from pydantic import BaseModel
import numpy as np

app = FastAPI()
store = FeatureStore(repo_path=".")


class PredictionRequest(BaseModel):
    user_id: str


class PredictionResponse(BaseModel):
    user_id: str
    fraud_score: float
    features_used: dict


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    feature_vector = store.get_online_features(
        features=[
            "user_features:avg_transaction_amount",
            "user_features:total_transactions",
            "user_features:account_age_days",
        ],
        entity_rows=[{"user_id": request.user_id}],
    ).to_dict()

    if feature_vector["avg_transaction_amount"][0] is None:
        raise HTTPException(status_code=404, detail="User features not found")

    features = np.array([[
        feature_vector["avg_transaction_amount"][0],
        feature_vector["total_transactions"][0],
        feature_vector["account_age_days"][0],
    ]])

    fraud_score = float(model.predict_proba(features)[0][1])

    return PredictionResponse(
        user_id=request.user_id,
        fraud_score=round(fraud_score, 4),
        features_used={
            "avg_transaction_amount": feature_vector["avg_transaction_amount"][0],
            "total_transactions": feature_vector["total_transactions"][0],
            "account_age_days": feature_vector["account_age_days"][0],
        },
    )
```

---

## Tool Comparison

```
  Feature      | Feast     | Tecton    | Hopsworks
  -------------|-----------|-----------|----------
  Open source  | Yes       | No        | Partial
  Real-time    | Yes       | Yes       | Yes
  Streaming    | Limited   | Yes       | Yes
  Managed      | No        | Yes       | Yes
  Complexity   | Low       | Medium    | Medium
  Best for     | Start here| Scale     | Full platform
```

---

## Exercises

1. **Feast Setup**: Install Feast, define 3 feature views
   for a user entity, materialize to a local store, and
   fetch features for training and serving.

2. **Feature Pipeline**: Write a feature computation pipeline
   that takes raw transaction data and produces user-level
   features. Store them in Feast.

3. **Skew Detection**: Compute features two different ways
   (intentionally). Write a test that catches when offline
   and online values diverge by more than 1%.

4. **End-to-End**: Build a FastAPI server that fetches
   features from Feast, runs a model, and returns predictions.
   Measure the latency of feature retrieval.

---

[Next: Lesson 10 - CI/CD for ML -->](10-cicd-for-ml.md)
