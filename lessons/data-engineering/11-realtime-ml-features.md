# Lesson 11: Real-Time ML Features

> Imagine a fraud detection system. It's not enough to know a user's
> average spending from last month. You need to know: "Has this user
> made 5 transactions in the last 10 minutes?" That's a real-time
> feature -- computed on live data as events happen, not from
> yesterday's batch job.

---

## Batch vs Real-Time Features

```
  BATCH FEATURES:                   REAL-TIME FEATURES:
  Computed periodically              Computed on every event

  Daily job at 2am:                 On each transaction:
  "User's avg spend last 30 days"   "Transactions in last 5 min"

  +--------+    +--------+          +--------+    +--------+
  | Data   | -> | Batch  | -> DB   | Event  | -> | Stream | -> Cache
  | Lake   |    | Job    |          | Stream |    | Proc.  |
  +--------+    +--------+          +--------+    +--------+

  Freshness: hours to days           Freshness: seconds to minutes
  Cost: cheap (run once)             Cost: expensive (always running)
  Complexity: low                    Complexity: high

  +-------------------+------------------+-------------------+
  | Feature Type      | Example          | Freshness Needed  |
  +-------------------+------------------+-------------------+
  | Batch             | User lifetime    | Daily              |
  |                   | spend            |                    |
  | Near-real-time    | Items in cart    | Minutes            |
  | Real-time         | Transactions in  | Seconds            |
  |                   | last 5 minutes   |                    |
  +-------------------+------------------+-------------------+
```

---

## Streaming Feature Architecture

```
  +------------------------------------------------------------------+
  |                                                                    |
  |  Events --> [Kafka/Kinesis] --> [Stream Processor] --> [Feature    |
  |  (clicks,     (message         (Flink/Spark          Store]       |
  |   purchases,   bus)              Streaming)            |           |
  |   logins)                                              v           |
  |                                                   [ML Model]      |
  |                                                   (reads features |
  |                                                    at prediction  |
  |                                                    time)          |
  |                                                                    |
  |  Batch pipeline also writes to Feature Store:                     |
  |  [Data Lake] --> [Spark Batch] --> [Feature Store]                |
  |                                                                    |
  +------------------------------------------------------------------+

  The Feature Store serves BOTH:
  - Batch features (updated daily/hourly)
  - Real-time features (updated per event)

  At prediction time, the model gets ALL features from one place.
```

---

## Windowed Aggregations

The core pattern for real-time features.

```
  Events over time:
  t=0   t=1   t=2   t=3   t=4   t=5   t=6   t=7   t=8
  $10   $20   $5    $50   $10   $100  $30   $15   $200

  Tumbling window (5 min, non-overlapping):
  [---window 1---][---window 2---]
  [$10 $20 $5 $50 $10]  [$100 $30 $15 $200 ...]
  sum=95                 sum=345

  Sliding window (5 min, updates every event):
  At t=5: [$10 $20 $5 $50 $10] sum=95
  At t=6: [$20 $5 $50 $10 $100] sum=185
  At t=7: [$5 $50 $10 $100 $30] sum=195

  Session window (gap-based):
  [$10 $20 $5] --gap-- [$50 $10 $100 $30] --gap-- [$15 $200]
  session 1            session 2                   session 3
```

```python
from collections import defaultdict
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import bisect


@dataclass
class Event:
    user_id: str
    amount: float
    timestamp: datetime


class SlidingWindowAggregator:
    def __init__(self, window_size: timedelta):
        self.window_size = window_size
        self.events: dict[str, list[tuple[datetime, float]]] = defaultdict(list)

    def add_event(self, event: Event):
        self.events[event.user_id].append((event.timestamp, event.amount))
        self._evict(event.user_id, event.timestamp)

    def _evict(self, user_id: str, current_time: datetime):
        cutoff = current_time - self.window_size
        events = self.events[user_id]
        while events and events[0][0] < cutoff:
            events.pop(0)

    def get_features(self, user_id: str, current_time: datetime) -> dict:
        self._evict(user_id, current_time)
        events = self.events.get(user_id, [])

        if not events:
            return {
                "count": 0,
                "sum": 0.0,
                "avg": 0.0,
                "max": 0.0,
                "min": 0.0,
            }

        amounts = [e[1] for e in events]
        return {
            "count": len(amounts),
            "sum": sum(amounts),
            "avg": sum(amounts) / len(amounts),
            "max": max(amounts),
            "min": min(amounts),
        }


aggregator = SlidingWindowAggregator(window_size=timedelta(minutes=5))

now = datetime.utcnow()
events = [
    Event("user_1", 10.0, now - timedelta(minutes=4)),
    Event("user_1", 50.0, now - timedelta(minutes=3)),
    Event("user_1", 200.0, now - timedelta(minutes=1)),
    Event("user_1", 500.0, now),
]

for event in events:
    aggregator.add_event(event)

features = aggregator.get_features("user_1", now)
print(features)
```

---

## Apache Flink for Streaming Features

```
  Flink concepts:

  +---[Source]---+---[Transform]---+---[Sink]---+
  | Kafka topic  |  Window + Agg   | Feature    |
  | (events)     |  (count, sum)   | Store      |
  +-------------+------------------+-----------+

  Flink handles:
  - Exactly-once processing
  - Event time vs processing time
  - Watermarks (handling late events)
  - State management (keeps window state)
  - Fault tolerance (checkpointing)
```

```python
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import StreamTableEnvironment, EnvironmentSettings


def create_streaming_features():
    env = StreamExecutionEnvironment.get_execution_environment()
    t_env = StreamTableEnvironment.create(env)

    t_env.execute_sql("""
        CREATE TABLE transactions (
            user_id STRING,
            amount DOUBLE,
            event_time TIMESTAMP(3),
            WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
        ) WITH (
            'connector' = 'kafka',
            'topic' = 'transactions',
            'properties.bootstrap.servers' = 'localhost:9092',
            'format' = 'json'
        )
    """)

    t_env.execute_sql("""
        CREATE TABLE user_features (
            user_id STRING,
            window_start TIMESTAMP(3),
            window_end TIMESTAMP(3),
            tx_count BIGINT,
            tx_sum DOUBLE,
            tx_avg DOUBLE,
            tx_max DOUBLE
        ) WITH (
            'connector' = 'jdbc',
            'url' = 'jdbc:postgresql://localhost:5432/features',
            'table-name' = 'user_features'
        )
    """)

    t_env.execute_sql("""
        INSERT INTO user_features
        SELECT
            user_id,
            window_start,
            window_end,
            COUNT(*) as tx_count,
            SUM(amount) as tx_sum,
            AVG(amount) as tx_avg,
            MAX(amount) as tx_max
        FROM TABLE(
            TUMBLE(TABLE transactions, DESCRIPTOR(event_time), INTERVAL '5' MINUTE)
        )
        GROUP BY user_id, window_start, window_end
    """)
```

---

## Feature Freshness

```
  Feature freshness = time since feature was last updated

  +------------------+-----------+---------------------------+
  | Feature          | Freshness | Impact if stale           |
  +------------------+-----------+---------------------------+
  | User age         | Daily     | Minimal                   |
  | Account balance  | Hourly    | Medium                    |
  | Recent tx count  | Seconds   | Critical (fraud detect.)  |
  | Cart contents    | Real-time | High (recommendations)    |
  | Click history    | Real-time | High (personalization)    |
  +------------------+-----------+---------------------------+

  Freshness monitoring:

  Event occurs at T=0
       |
       v
  Stream processor receives at T+50ms
       |
       v
  Feature computed at T+100ms
       |
       v
  Written to store at T+150ms
       |
       v
  Available for serving at T+200ms

  End-to-end latency: 200ms
  If this exceeds SLA (e.g., 500ms) --> alert!
```

```python
from datetime import datetime, timedelta


class FreshnessMonitor:
    def __init__(self, max_staleness: dict[str, timedelta]):
        self.max_staleness = max_staleness
        self.last_updated: dict[str, datetime] = {}

    def record_update(self, feature_name: str, timestamp: datetime):
        self.last_updated[feature_name] = timestamp

    def check_freshness(self, current_time: datetime) -> list[dict]:
        alerts = []
        for feature_name, max_stale in self.max_staleness.items():
            last = self.last_updated.get(feature_name)
            if last is None:
                alerts.append({
                    "feature": feature_name,
                    "status": "never_updated",
                    "severity": "critical",
                })
                continue

            staleness = current_time - last
            if staleness > max_stale:
                alerts.append({
                    "feature": feature_name,
                    "status": "stale",
                    "staleness_seconds": staleness.total_seconds(),
                    "max_allowed_seconds": max_stale.total_seconds(),
                    "severity": "warning" if staleness < max_stale * 2 else "critical",
                })

        return alerts


monitor = FreshnessMonitor({
    "user_tx_count_5min": timedelta(seconds=30),
    "user_avg_spend_daily": timedelta(hours=2),
    "user_lifetime_value": timedelta(hours=24),
})
```

---

## Online vs Offline Feature Consistency

```
  The training-serving skew problem:

  TRAINING (offline):
  - Features computed in Spark on historical data
  - Python code: df.groupBy("user").agg(avg("amount"))

  SERVING (online):
  - Features computed in Flink on live streams
  - Java code: window.aggregate(new AvgFunction())

  If these compute DIFFERENT values for the same input:
  YOUR MODEL WILL PERFORM WORSE IN PRODUCTION!

  Solution: compute features ONCE, store in feature store

  +-------------------+
  | Feature Store     |
  | (single source    |
  |  of truth)        |
  +--------+----------+
           |
     +-----+-----+
     |           |
     v           v
  Training    Serving
  (reads       (reads
   historical   latest
   features)    features)

  Same code computes both --> no skew!
```

---

## Feast for Real-Time Features

```python
from feast import Entity, FeatureView, Field, FileSource
from feast.types import Float64, Int64
from datetime import timedelta

user = Entity(
    name="user_id",
    join_keys=["user_id"],
)

user_transaction_stats = FeatureView(
    name="user_transaction_stats",
    entities=[user],
    ttl=timedelta(hours=1),
    schema=[
        Field(name="tx_count_5min", dtype=Int64),
        Field(name="tx_sum_5min", dtype=Float64),
        Field(name="tx_avg_5min", dtype=Float64),
        Field(name="tx_max_5min", dtype=Float64),
    ],
    source=FileSource(
        path="data/user_features.parquet",
        timestamp_field="event_timestamp",
    ),
)
```

```python
from feast import FeatureStore

store = FeatureStore(repo_path=".")

training_df = store.get_historical_features(
    entity_df=entity_df,
    features=[
        "user_transaction_stats:tx_count_5min",
        "user_transaction_stats:tx_sum_5min",
        "user_transaction_stats:tx_avg_5min",
    ],
).to_df()

online_features = store.get_online_features(
    features=[
        "user_transaction_stats:tx_count_5min",
        "user_transaction_stats:tx_sum_5min",
    ],
    entity_rows=[{"user_id": "user_123"}],
).to_dict()
```

---

## Exercises

1. **Sliding window**: Implement a sliding window aggregator that
   computes count, sum, avg, min, max over a configurable window.
   Test with synthetic event streams.

2. **Feature freshness**: Build a freshness monitor for 5 features
   with different SLAs. Simulate stale features and verify alerts
   fire correctly.

3. **Streaming pipeline**: Using Kafka (or a mock), create a
   pipeline that reads transaction events, computes 5-minute
   windowed features, and writes them to Redis.

4. **Training-serving consistency**: Compute features with both
   batch (pandas) and streaming (your aggregator) code on the
   same data. Verify they produce identical results.

5. **Feature store**: Set up Feast with both batch and online
   features. Write training code that reads historical features
   and serving code that reads online features.

---

**Next**: [Lesson 12 - Privacy & Compliance](./12-privacy-compliance.md)
