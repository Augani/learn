# Lesson 05: Streaming Data

## Assembly Line vs Batch Delivery

Imagine two ways to get packages from a factory to customers:

```
  BATCH PROCESSING (truck delivery)
  +--------+   wait   +--------+   wait   +--------+
  |Produce | -------> |Collect | -------> |Deliver |
  |all day |  24 hrs  |into    |  hours   |all at  |
  |        |          |truck   |          |once    |
  +--------+          +--------+          +--------+
  Latency: hours to days
  Throughput: very high

  STREAM PROCESSING (assembly line + conveyor belt)
  +--------+  +--------+  +--------+  +--------+
  |Produce |->|Process |->|Package |->|Deliver |
  | item 1 |  | item 1 |  | item 1 |  | item 1 |
  +--------+  +--------+  +--------+  +--------+
  |Produce |->|Process |->|Package |->|Deliver |
  | item 2 |  | item 2 |  | item 2 |  | item 2 |
  +--------+  +--------+  +--------+  +--------+
  Latency: milliseconds to seconds
  Throughput: moderate (but continuous)
```

---

## Apache Kafka: The Backbone

Kafka is a distributed message broker. Think of it as a conveyor belt
system where producers put items on belts, and consumers take them off.

```
  PRODUCERS                  KAFKA CLUSTER                 CONSUMERS
  +-------+                 +-----------+                  +--------+
  | App 1 | ---publish----> | Topic:    | ---subscribe---> | Spark  |
  +-------+                 | "orders"  |                  +--------+
  +-------+                 |           |                  +--------+
  | App 2 | ---publish----> | Partition | ---subscribe---> | Flink  |
  +-------+                 | 0 | 1 | 2|                  +--------+
  +-------+                 +-----------+                  +--------+
  | App 3 | ---publish----> | Topic:    | ---subscribe---> | Python |
  +-------+                 | "clicks"  |                  +--------+
                            +-----------+
```

### Topics and Partitions

```
  TOPIC: "user-events"
  +-----------------------------------------------------+
  |                                                     |
  | Partition 0: [msg1] [msg4] [msg7] [msg10] [msg13]  |
  |                                                     |
  | Partition 1: [msg2] [msg5] [msg8] [msg11] [msg14]  |
  |                                                     |
  | Partition 2: [msg3] [msg6] [msg9] [msg12] [msg15]  |
  |                                                     |
  +-----------------------------------------------------+
  Messages with same key always go to same partition
  (e.g., user_id=42 always -> Partition 1)

  Each partition is an ordered, immutable log:
  +---+---+---+---+---+---+---+
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 |  <- offsets
  +---+---+---+---+---+---+---+
  oldest                  newest
                          ^
                          Consumer reads here
```

---

## Kafka with Python

### Producer

```python
from kafka import KafkaProducer
import json
import time

producer = KafkaProducer(
    bootstrap_servers=["localhost:9092"],
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
    key_serializer=lambda k: k.encode("utf-8")
)

events = [
    {"user_id": 1, "action": "click", "page": "/home", "timestamp": time.time()},
    {"user_id": 2, "action": "purchase", "amount": 49.99, "timestamp": time.time()},
    {"user_id": 1, "action": "view", "page": "/product/42", "timestamp": time.time()},
]

for event in events:
    key = str(event["user_id"])
    producer.send("user-events", key=key, value=event)

producer.flush()
producer.close()
```

### Consumer

```python
from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    "user-events",
    bootstrap_servers=["localhost:9092"],
    group_id="my-consumer-group",
    auto_offset_reset="earliest",
    value_deserializer=lambda m: json.loads(m.decode("utf-8"))
)

for message in consumer:
    event = message.value
    partition = message.partition
    offset = message.offset
    print(f"Partition {partition}, Offset {offset}: {event}")
```

---

## Consumer Groups

```
  Without consumer groups (all consumers get all messages):
  +-------+     +----------+     +-----+
  |       | --> | Topic    | --> | C1  |  gets ALL messages
  | Prod  |     | 3 parts  | --> | C2  |  gets ALL messages
  |       |     |          | --> | C3  |  gets ALL messages
  +-------+     +----------+     +-----+

  With consumer groups (messages split among group members):
  +-------+     +----------+     Group A:
  |       |     | Part 0   | --> | C1 |  gets Part 0
  | Prod  | --> | Part 1   | --> | C2 |  gets Part 1
  |       |     | Part 2   | --> | C3 |  gets Part 2
  +-------+     +----------+
                                  Group B:
                | Part 0   | --> | C4 |  gets Part 0,1
                | Part 1   | --> |    |
                | Part 2   | --> | C5 |  gets Part 2
```

---

## Stream Processing Patterns

### Windowed Aggregations

Like counting cars passing a bridge in 5-minute windows:

```
  TUMBLING WINDOW (fixed, non-overlapping)
  |----W1----|----W2----|----W3----|
  0          5          10         15  (minutes)

  SLIDING WINDOW (overlapping)
  |------W1------|
       |------W2------|
            |------W3------|
  0    2    4    6    8    10  (minutes)

  SESSION WINDOW (gap-based)
  |--W1--|       |----W2----|    |W3|
  events  gap>5m  events    gap  event
```

```python
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder \
    .appName("StreamProcessor") \
    .getOrCreate()

stream_df = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "localhost:9092") \
    .option("subscribe", "user-events") \
    .load()

parsed = stream_df \
    .selectExpr("CAST(value AS STRING) as json_str") \
    .select(F.from_json("json_str", "user_id INT, action STRING, timestamp DOUBLE").alias("data")) \
    .select("data.*") \
    .withColumn("event_time", F.from_unixtime("timestamp").cast("timestamp"))

windowed_counts = parsed \
    .withWatermark("event_time", "10 minutes") \
    .groupBy(
        F.window("event_time", "5 minutes"),
        "action"
    ) \
    .count()

query = windowed_counts.writeStream \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .start()

query.awaitTermination()
```

---

## Event-Driven Architecture

```
  TRADITIONAL (request/response):
  +-------+  request  +-------+  request  +-------+
  | Svc A | --------> | Svc B | --------> | Svc C |
  |       | <-------- |       | <-------- |       |
  +-------+  response +-------+  response +-------+
  Tight coupling: A must know about B and C

  EVENT-DRIVEN:
  +-------+  publish  +--------+  subscribe +-------+
  | Svc A | --------> |  Event | ---------> | Svc B |
  +-------+           |  Bus   | ---------> | Svc C |
                      | (Kafka)| ---------> | Svc D |
                      +--------+
  Loose coupling: A publishes events, doesn't know who listens
```

### Event Schema Design

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import json

@dataclass
class OrderEvent:
    event_id: str
    event_type: str
    timestamp: str
    order_id: str
    user_id: int
    amount: float
    currency: str
    items: list
    metadata: Optional[dict] = None

    def to_json(self):
        return json.dumps(self.__dict__)

    @classmethod
    def from_json(cls, json_str):
        data = json.loads(json_str)
        return cls(**data)

event = OrderEvent(
    event_id="evt_001",
    event_type="order.created",
    timestamp=datetime.utcnow().isoformat(),
    order_id="ord_123",
    user_id=42,
    amount=99.99,
    currency="USD",
    items=[{"sku": "WIDGET-1", "qty": 2}]
)

print(event.to_json())
```

---

## Exactly-Once Processing

The three delivery guarantees:

```
  AT-MOST-ONCE:      Fire and forget
  +---+    +---+
  | P | -> | C |     Message might be lost
  +---+    +---+     No retries

  AT-LEAST-ONCE:     Retry until confirmed
  +---+    +---+
  | P | -> | C |     Message might be duplicated
  +---+ -> +---+     Consumer must be idempotent
       retry

  EXACTLY-ONCE:      Guaranteed one delivery
  +---+    +---+
  | P | -> | C |     Most expensive, uses transactions
  +---+    +---+     Kafka supports this natively
```

**Idempotent consumer pattern:**

```python
import redis

redis_client = redis.Redis(host="localhost", port=6379)

def process_event(event):
    event_id = event["event_id"]

    if redis_client.sismember("processed_events", event_id):
        return

    handle_event(event)

    redis_client.sadd("processed_events", event_id)
    redis_client.expire(f"processed_events", 86400 * 7)

def handle_event(event):
    print(f"Processing: {event['event_type']} for order {event['order_id']}")
```

---

## Dead Letter Queues

When messages fail processing, don't lose them:

```
  Main Topic                    Consumer              Dead Letter Queue
  +--------+    consume    +-----------+   failed    +-----------+
  | msg 1  | -----------> |           | ----------> | msg 2     |
  | msg 2  | -----------> | Processor |             | (+ error  |
  | msg 3  | -----------> |           |             |  details) |
  +--------+              +-----------+             +-----------+
                               |                         |
                          success for                 Retry later
                          msg 1, msg 3               or investigate
```

```python
from kafka import KafkaProducer, KafkaConsumer
import json
import traceback

producer = KafkaProducer(
    bootstrap_servers=["localhost:9092"],
    value_serializer=lambda v: json.dumps(v).encode("utf-8")
)

consumer = KafkaConsumer(
    "orders",
    bootstrap_servers=["localhost:9092"],
    group_id="order-processor",
    value_deserializer=lambda m: json.loads(m.decode("utf-8"))
)

MAX_RETRIES = 3

for message in consumer:
    event = message.value
    retries = event.get("_retry_count", 0)

    try:
        process_order(event)
    except Exception as exc:
        if retries < MAX_RETRIES:
            event["_retry_count"] = retries + 1
            producer.send("orders", value=event)
        else:
            dead_letter = {
                "original_event": event,
                "error": str(exc),
                "traceback": traceback.format_exc(),
                "partition": message.partition,
                "offset": message.offset
            }
            producer.send("orders-dlq", value=dead_letter)
```

---

## Streaming vs Batch: When to Use What

```
  +--------------------+-------------------+-------------------+
  | Factor             | Batch             | Streaming         |
  +--------------------+-------------------+-------------------+
  | Latency need       | Hours OK          | Seconds/minutes   |
  +--------------------+-------------------+-------------------+
  | Data volume        | Very large        | Continuous flow   |
  +--------------------+-------------------+-------------------+
  | Complexity         | Lower             | Higher            |
  +--------------------+-------------------+-------------------+
  | Cost               | Lower (on-demand) | Higher (always-on)|
  +--------------------+-------------------+-------------------+
  | Error handling     | Rerun entire job  | Complex retries   |
  +--------------------+-------------------+-------------------+
  | Use cases          | Reports, ML train | Fraud detection,  |
  |                    | backfills         | real-time features |
  +--------------------+-------------------+-------------------+
```

```
  Freshness requirement?
    |
    +-- Seconds --> Streaming (Kafka + Flink/Spark Streaming)
    |
    +-- Minutes --> Micro-batch (Spark Structured Streaming)
    |
    +-- Hours   --> Batch (Spark, SQL, dbt)
    |
    +-- Daily   --> Scheduled batch (Airflow + SQL)
```

---

## Exercises

1. **Local Kafka setup**: Using Docker, start a Kafka cluster. Write a
   producer that generates 1000 random user events and a consumer that
   counts events per user. Verify no messages are lost.

2. **Windowed aggregation**: Using Spark Structured Streaming (or
   Faust/python), consume events from Kafka and compute 1-minute
   tumbling window counts of events per action type.

3. **Dead letter queue**: Build a consumer that intentionally fails on
   10% of messages. Implement a DLQ pattern that captures failures
   with full error context. Write a script that retries DLQ messages.

4. **Idempotent consumer**: Create a consumer that processes payment
   events. Implement idempotency using Redis so that replaying the
   same events produces the same result.

5. **Batch vs stream comparison**: Process the same dataset (1M events)
   using both a batch Spark job and Spark Structured Streaming.
   Compare latency to first result, throughput, and code complexity.

---

[Next: Lesson 06 - Warehouses vs Lakes ->](06-warehouses-vs-lakes.md)
