# Lesson 15: Stream Processing

> **The one thing to remember**: Stream processing is analyzing
> data as it flows by, rather than waiting until it's all collected.
> Think of a lifeguard at the beach: they don't wait until the end
> of the day to review everyone's swimming. They watch continuously
> and react to problems in real time. Stream processing does the
> same with data — count, aggregate, filter, and join data as
> events arrive.

---

## Batch vs Stream Processing

Traditional data processing is batch: collect all the data, then
process it at once. Stream processing handles data as it arrives.

```
BATCH PROCESSING

  Events arrive all day:
  [e1] [e2] [e3] ... [e999] [e1000]

  At midnight, batch job runs:
  +---> Read all 1000 events
  +---> Calculate daily metrics
  +---> Write results
  +---> Done until tomorrow

  Results are always STALE (up to 24 hours old).
  Good for: data warehouse queries, monthly reports, ML training.


STREAM PROCESSING

  Events arrive continuously:
  [e1] --> process immediately --> result
  [e2] --> process immediately --> updated result
  [e3] --> process immediately --> updated result

  Results are near-real-time (seconds to minutes old).
  Good for: fraud detection, live dashboards, alerting.
```

```
LATENCY COMPARISON

  +-------------------+------------------+--------------------+
  | Processing Style  | Typical Latency  | Example            |
  +-------------------+------------------+--------------------+
  | Batch             | Hours to days    | Daily sales report |
  | Micro-batch       | Seconds to min   | Spark Streaming    |
  | True streaming    | Milliseconds     | Kafka Streams,     |
  |                   |                  | Apache Flink       |
  +-------------------+------------------+--------------------+
```

---

## Windowing: Grouping Events by Time

Raw events are infinite. You can't "sum all events" because they
never stop arriving. **Windowing** groups events into finite chunks
for processing.

### Tumbling Windows

Fixed-size, non-overlapping time intervals. Like 5-minute blocks.

```
TUMBLING WINDOW (5 minutes)

  Time:    0    5    10   15   20   25   30
           |----|----|----|----|----|----|
  Events:  eeee eeee eeee eeee eeee eeee

  Window 1: [0-5)   = count events in this window
  Window 2: [5-10)  = count events in this window
  Window 3: [10-15) = count events in this window

  Each event belongs to EXACTLY ONE window.
  No overlap. No gaps.
```

Use case: "How many orders per 5-minute interval?"

### Hopping (Sliding) Windows

Fixed-size windows that overlap. A 10-minute window that advances
every 5 minutes.

```
HOPPING WINDOW (size=10min, advance=5min)

  Time:    0    5    10   15   20   25
           |---------|
                |---------|
                     |---------|
                          |---------|

  Window 1: [0-10)   events in these 10 minutes
  Window 2: [5-15)   events in these 10 minutes (overlaps with 1)
  Window 3: [10-20)  events in these 10 minutes (overlaps with 2)

  Each event can belong to MULTIPLE windows.
  Window 2 contains events from both Window 1 and Window 3.
```

Use case: "What's the rolling 10-minute average?"

### Session Windows

Variable-size windows defined by activity. A session ends when
there's a gap of inactivity.

```
SESSION WINDOW (gap=5min)

  User clicks: X  X X    X X         X X X X      X
  Time:        0  1 2    7 8         20 21 22 23   35
               |------|  |---|        |---------|   |--|
               Session 1  Session 2   Session 3   Session 4

  Sessions are defined by INACTIVITY GAPS.
  If no event for 5+ minutes, the session ends.
  Each session can be a different length.
```

Use case: "Average user session duration," "events per session."

### Window Comparison

```
+------------------+------------+------------------+------------------+
| Window Type      | Size       | Overlap          | Use Case         |
+------------------+------------+------------------+------------------+
| Tumbling         | Fixed      | None             | Periodic counts  |
| Hopping          | Fixed      | Yes              | Rolling averages |
| Session          | Variable   | None             | User sessions    |
+------------------+------------+------------------+------------------+
```

---

## Aggregation: Summarizing Streams

Aggregations compute running summaries over windowed data.

```python
from kafka import KafkaConsumer
from collections import defaultdict
import time
import json

consumer = KafkaConsumer(
    'page-views',
    bootstrap_servers=['localhost:9092'],
    value_deserializer=lambda m: json.loads(m.decode('utf-8'))
)

WINDOW_SIZE_SECONDS = 60
windows = defaultdict(lambda: defaultdict(int))

for message in consumer:
    event = message.value
    window_start = (event['timestamp'] // WINDOW_SIZE_SECONDS) * WINDOW_SIZE_SECONDS
    page = event['page']

    windows[window_start][page] += 1

    current_window = (time.time() // WINDOW_SIZE_SECONDS) * WINDOW_SIZE_SECONDS
    for old_window in list(windows.keys()):
        if old_window < current_window - WINDOW_SIZE_SECONDS:
            results = windows.pop(old_window)
            emit_results(old_window, results)
```

Common aggregations:
- **Count**: How many events in this window?
- **Sum**: What's the total revenue in this window?
- **Average**: What's the average order size?
- **Min/Max**: What's the largest transaction?
- **Distinct count**: How many unique users?

---

## Stream Joins: Combining Streams

Real-world analysis often requires combining data from multiple
streams. Stream joins are like SQL joins, but on moving data.

### Stream-Stream Join

Join two event streams within a time window.

```
STREAM-STREAM JOIN

  Stream: "clicks"           Stream: "impressions"
  [click: ad-1, t=10:00]    [impression: ad-1, t=09:59]
  [click: ad-2, t=10:05]    [impression: ad-2, t=10:04]

  Join on: ad_id, within 5-minute window

  Result:
  [ad-1: impression at 09:59, click at 10:00] --> clicked within 1 min
  [ad-2: impression at 10:04, click at 10:05] --> clicked within 1 min

  Use case: Calculate ad click-through rates in real time
```

### Stream-Table Join (Enrichment)

Enrich stream events with data from a table or lookup store.

```
STREAM-TABLE JOIN (Enrichment)

  Stream: "orders"                  Table: "customers"
  [order: cust-123, total: 59.99]   [cust-123: name="Alice", tier="gold"]

  Join on: customer_id

  Result:
  [order: cust-123, total: 59.99, name="Alice", tier="gold"]

  Use case: Add customer info to order events for dashboards
```

```python
customer_cache = {}

def enrich_order(order_event):
    customer_id = order_event['customer_id']

    if customer_id not in customer_cache:
        customer_cache[customer_id] = lookup_customer(customer_id)

    customer = customer_cache[customer_id]

    return {
        **order_event,
        'customer_name': customer['name'],
        'customer_tier': customer['tier'],
        'customer_region': customer['region']
    }
```

---

## Kafka Streams

Kafka Streams is a Java library for building stream processing
applications. It runs inside your application — no separate
cluster needed.

```
KAFKA STREAMS ARCHITECTURE

  +----------------------------------------------------+
  | Your Application (JVM)                              |
  |                                                    |
  |  +-----+     +-----------+     +------+            |
  |  |Input |---->| Kafka     |---->|Output|            |
  |  |Topic |     | Streams   |     |Topic |            |
  |  +-----+     | Processing|     +------+            |
  |              +-----------+                         |
  |              | - filter   |                         |
  |              | - map      |                         |
  |              | - group    |                         |
  |              | - aggregate|                         |
  |              | - join     |                         |
  |              | - window   |                         |
  |              +-----------+                         |
  +----------------------------------------------------+

  No separate cluster. Runs in your app.
  Scales by running more instances of your app.
  State is backed by Kafka topics (fault-tolerant).
```

```java
StreamsBuilder builder = new StreamsBuilder();

KStream<String, String> orders = builder.stream("orders");

KTable<Windowed<String>, Long> orderCounts = orders
    .groupBy((key, value) -> extractRegion(value))
    .windowedBy(TimeWindows.of(Duration.ofMinutes(5)))
    .count(Materialized.as("order-counts"));

orderCounts.toStream()
    .map((windowedKey, count) -> {
        String region = windowedKey.key();
        long windowStart = windowedKey.window().start();
        return KeyValue.pair(region,
            String.format("{\"region\":\"%s\",\"count\":%d,\"window\":\"%d\"}",
                region, count, windowStart));
    })
    .to("order-count-results");

KafkaStreams streams = new KafkaStreams(builder.build(), props);
streams.start();
```

---

## Apache Flink

Flink is a distributed stream processing framework. Unlike Kafka
Streams, it runs on its own cluster and handles much larger
workloads.

```
FLINK ARCHITECTURE

  +------------------+
  | Flink Cluster    |
  |  +--------+      |
  |  | Job    |      |    +---------+
  |  | Manager|------+--->| Task    |
  |  +--------+      |    | Manager |
  |                   |    | (worker)|
  |                   |    +---------+
  |                   |    +---------+
  |                   +--->| Task    |
  |                   |    | Manager |
  |                   |    | (worker)|
  |                   |    +---------+
  +------------------+

  Job Manager: coordinates, schedules
  Task Managers: execute the processing
```

```python
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.window import TumblingProcessingTimeWindows
from pyflink.common.time import Time

env = StreamExecutionEnvironment.get_execution_environment()

orders = env.from_source(kafka_source, watermark_strategy, "orders")

revenue_per_region = (
    orders
    .key_by(lambda order: order['region'])
    .window(TumblingProcessingTimeWindows.of(Time.minutes(5)))
    .reduce(lambda a, b: {
        'region': a['region'],
        'total_revenue': a['total_revenue'] + b['total_revenue'],
        'order_count': a['order_count'] + b['order_count']
    })
)

revenue_per_region.sink_to(kafka_sink)
env.execute("Revenue by Region")
```

---

## Kafka Streams vs Flink: When to Use Which

```
+-------------------+--------------------+--------------------+
| Feature           | Kafka Streams      | Apache Flink       |
+-------------------+--------------------+--------------------+
| Deployment        | Library in your app| Separate cluster   |
| Scale             | Medium             | Very large         |
| Complexity        | Lower              | Higher             |
| Source/Sink        | Kafka only         | Many (Kafka, JDBC, |
|                   |                    | files, S3, etc.)   |
| Processing        | Event-at-a-time    | Event-at-a-time    |
| State management  | RocksDB + Kafka    | RocksDB + custom   |
| Exactly-once      | Yes (Kafka only)   | Yes (end-to-end)   |
| SQL support       | KSQL               | Flink SQL          |
| When to use       | Kafka ecosystem,   | Complex pipelines, |
|                   | simpler apps       | large scale, multi |
|                   |                    | source/sink        |
+-------------------+--------------------+--------------------+
```

---

## Real-Time Analytics: Putting It All Together

A real-time analytics pipeline for an e-commerce platform:

```
REAL-TIME ANALYTICS PIPELINE

  Web/App Events
       |
       v
  [Kafka: raw-events]
       |
       +---> [Stream Processor: Enrichment]
       |     Join with customer data
       |     Add geo-location
       |           |
       |           v
       |     [Kafka: enriched-events]
       |           |
       |           +---> [Stream Processor: Aggregation]
       |           |     5-min tumbling windows
       |           |     Revenue per region
       |           |     Orders per product category
       |           |           |
       |           |           v
       |           |     [Redis: live-dashboards]
       |           |
       |           +---> [Stream Processor: Anomaly Detection]
       |                 Session windows per user
       |                 Flag unusual patterns
       |                       |
       |                       v
       |                 [Kafka: alerts] --> [PagerDuty]
       |
       +---> [Kafka Connect: raw-events --> S3]
             For batch processing and ML training
```

---

## Late Events and Watermarks

Events don't always arrive in order. A mobile app might batch
events and send them minutes later. **Watermarks** handle this.

```
LATE EVENT PROBLEM

  Window: [10:00 - 10:05)

  Events arrive:
  t=10:01 --> event A (in window, processed)
  t=10:03 --> event B (in window, processed)
  t=10:06 --> Window closes! Emit result: count=2
  t=10:07 --> event C with timestamp 10:02 (LATE!)

  What do we do with event C?
  It SHOULD be in the [10:00-10:05) window, but that window
  already closed and emitted its result.
```

**Watermarks** are timestamps that say "no more events before this
time will arrive." They let the system know when it's safe to
close a window.

```
WATERMARK: "I guarantee no events with timestamp < 10:05
            will arrive after this point"

  Allowed lateness: 2 minutes

  t=10:06: Window [10:00-10:05) closes. Result emitted.
  t=10:07: Event C (timestamp 10:02) arrives. Within allowed
           lateness (10:06 + 2min = 10:08). Window REOPENS,
           updates result.
  t=10:09: Any event with timestamp < 10:05 is now DROPPED.
           Allowed lateness exceeded.
```

---

## Exercises

1. **Design windows**: You're monitoring website traffic. Design
   the windowing strategy for: (a) page views per minute, (b)
   rolling 1-hour unique visitors, (c) user session analytics.

2. **Build an aggregation**: Using Kafka and Python, build a
   stream processor that reads "purchase" events and maintains
   a running 5-minute window of: total revenue, average order
   size, and top-selling product.

3. **Late event strategy**: Your mobile app sends events in
   batches every 30 seconds. Some events can be 2 minutes late.
   How would you configure watermarks and allowed lateness?

4. **Join two streams**: You have an "ad-impressions" stream and
   an "ad-clicks" stream. Design a stream processor that joins
   them to calculate click-through rate per ad in 10-minute
   tumbling windows.

---

[Next: Lesson 16 — Build an Event-Driven Order System](./16-build-event-system.md)
