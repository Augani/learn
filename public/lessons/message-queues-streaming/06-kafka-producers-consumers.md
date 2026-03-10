# Lesson 06: Kafka Producers and Consumers

> **The one thing to remember**: A Kafka producer is like a mail
> carrier dropping letters into mailboxes (partitions). They choose
> which mailbox based on the address (key). A Kafka consumer is
> like someone checking their mailbox — they keep a bookmark
> (offset) so they know which letters they've already read.

---

## Producers: Writing Messages to Kafka

A producer's job is simple: take a message and write it to a Kafka
topic. But the details matter enormously for performance and
reliability.

### The Anatomy of a Kafka Message

Every message (also called a **record**) has these parts:

```
KAFKA MESSAGE STRUCTURE

  +-------------------+
  | Topic: "orders"   |  Which topic to write to
  +-------------------+
  | Partition: 3      |  Which partition (optional, auto-assigned)
  +-------------------+
  | Key: "cust-789"   |  Used for partitioning (optional)
  +-------------------+
  | Value: {...}       |  The actual data (your payload)
  +-------------------+
  | Timestamp          |  When it was produced
  +-------------------+
  | Headers            |  Key-value metadata (optional)
  +-------------------+
```

### Producing a Message: Step by Step

```
PRODUCER SEND FLOW

  1. Serialize          2. Partition           3. Batch
  +----------+          +----------+          +----------+
  | Convert  |--------->| Choose   |--------->| Add to   |
  | key and  |          | which    |          | partition |
  | value to |          | partition|          | batch    |
  | bytes    |          | to send  |          |          |
  +----------+          +----------+          +----------+
                                                   |
                                                   v
  5. Ack/Retry          4. Send               +----------+
  +----------+          +----------+          | When batch|
  | Handle   |<---------| Network  |<---------| is full   |
  | response |          | send to  |          | or timer  |
  | from     |          | broker   |          | fires,    |
  | broker   |          |          |          | send it   |
  +----------+          +----------+          +----------+
```

### Partitioning Strategies

The producer decides which partition a message goes to. This
choice affects ordering, performance, and data distribution.

```python
from kafka import KafkaProducer
import json

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    key_serializer=lambda k: k.encode('utf-8') if k else None,
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

producer.send(
    'orders',
    key='customer-789',
    value={
        'order_id': 'ord-456',
        'customer_id': 'customer-789',
        'total': 59.99,
        'items': ['SKU-001', 'SKU-002']
    }
)
```

**Key-based partitioning** (default when key is provided):
```
hash("customer-789") % 6 = partition 3

All messages for customer-789 go to partition 3.
All messages for customer-123 go to partition 1.

Guarantees: all events for the same customer are
in the same partition, so they're ordered.
```

**Round-robin** (when no key is provided):
```
msg1 --> partition 0
msg2 --> partition 1
msg3 --> partition 2
msg4 --> partition 0
...

Even distribution, no ordering guarantee per entity.
```

**Custom partitioner** (when you need control):
```python
def geo_partitioner(key, all_partitions, available_partitions):
    if key and key.startswith(b'US'):
        return 0
    elif key and key.startswith(b'EU'):
        return 1
    else:
        return 2

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    partitioner=geo_partitioner
)
```

---

## Producer Acknowledgments (acks)

When the producer sends a message, how long does it wait to confirm
the message was stored? The `acks` setting controls this.

```
acks=0: "Fire and forget"

  Producer ----msg----> Broker
  Producer: "Sent! Moving on."
  (doesn't wait for ANY confirmation)

  FASTEST. But if the broker crashes, message is lost.
  Use for: metrics, logs where occasional loss is acceptable.


acks=1: "Leader acknowledged"

  Producer ----msg----> Broker (Leader)
  Broker: "Got it, written to my log"
  Broker ----ack-----> Producer

  MODERATE speed. Message is on one broker.
  If the leader crashes BEFORE replicating, message is lost.
  Use for: most applications.


acks=all (or acks=-1): "All replicas acknowledged"

  Producer ----msg----> Broker (Leader)
  Leader ----replicate----> Follower 1
  Leader ----replicate----> Follower 2
  Leader: "All in-sync replicas have it"
  Leader ----ack-----> Producer

  SLOWEST. But message survives any single broker failure.
  Use for: financial transactions, anything that must not be lost.
```

```python
producer_fast = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    acks=0
)

producer_safe = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    acks='all'
)
```

---

## Batching: Why Kafka Is Fast

Producers don't send one message at a time. They batch messages
together and send them in bulk. This is a huge performance win.

```
WITHOUT BATCHING:
  msg1 --> [network round trip] --> ack
  msg2 --> [network round trip] --> ack
  msg3 --> [network round trip] --> ack
  Total: 3 network round trips

WITH BATCHING:
  [msg1, msg2, msg3] --> [one network round trip] --> ack
  Total: 1 network round trip, 3x less overhead
```

Two settings control batching:

```python
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    batch_size=16384,
    linger_ms=5
)
```

- `batch_size`: Maximum bytes per batch (default 16KB). When the
  batch buffer is full, send immediately.
- `linger_ms`: Maximum time to wait for more messages before
  sending (default 0ms). Setting to 5ms means "wait up to 5ms to
  fill the batch."

```
BATCHING BEHAVIOR

  linger_ms=0 (default):
  Message arrives --> Send immediately (no batching benefit)

  linger_ms=5:
  Message arrives --> Wait up to 5ms for more messages
                  --> Send batch (could be 1 or 100 messages)

  Higher linger_ms = bigger batches = better throughput
  Lower linger_ms = lower latency = smaller batches
```

---

## Consumers: Reading Messages from Kafka

A consumer reads messages from partitions and tracks its position
using **offsets**.

### Offsets: Your Bookmark

Every message in a partition has an offset — a sequential number
starting at 0. The consumer tracks which offset it has processed.

```
CONSUMER OFFSET TRACKING

  Partition 0: [0] [1] [2] [3] [4] [5] [6] [7] [8]
                                    ^
                                    |
                             Consumer's committed
                             offset: 4

  "I've processed messages 0 through 4.
   Next time I read, start at offset 5."
```

Offsets are stored in a special Kafka topic called
`__consumer_offsets`. When a consumer commits its offset, it's
saying: "I've successfully processed everything up to this point."

### Basic Consumer Code

```python
from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    'orders',
    bootstrap_servers=['localhost:9092'],
    group_id='order-processor',
    auto_offset_reset='earliest',
    value_deserializer=lambda m: json.loads(m.decode('utf-8'))
)

for message in consumer:
    print(f"Partition: {message.partition}")
    print(f"Offset: {message.offset}")
    print(f"Key: {message.key}")
    print(f"Value: {message.value}")
    process_order(message.value)
```

```java
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
props.put("group.id", "order-processor");
props.put("auto.offset.reset", "earliest");
props.put("key.deserializer",
    "org.apache.kafka.common.serialization.StringDeserializer");
props.put("value.deserializer",
    "org.apache.kafka.common.serialization.StringDeserializer");

KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
consumer.subscribe(Arrays.asList("orders"));

while (true) {
    ConsumerRecords<String, String> records = consumer.poll(
        Duration.ofMillis(100)
    );
    for (ConsumerRecord<String, String> record : records) {
        System.out.printf("partition=%d, offset=%d, key=%s, value=%s%n",
            record.partition(), record.offset(),
            record.key(), record.value());
        processOrder(record.value());
    }
    consumer.commitSync();
}
```

### auto.offset.reset: Where to Start

When a consumer reads a topic for the first time (no previous
offset stored), where should it start?

```
auto.offset.reset options:

  "earliest" - Start from the very beginning
  Partition: [0] [1] [2] [3] [4] [5] [6] [7] [8]
              ^
              Start here (read all historical messages)

  "latest" - Start from the end (new messages only)
  Partition: [0] [1] [2] [3] [4] [5] [6] [7] [8]
                                                  ^
                                          Start here (skip history)

  "none" - Throw an error if no previous offset exists
```

---

## Offset Commit Strategies

When do you tell Kafka "I've processed this message"? Getting this
wrong leads to either lost messages or duplicate processing.

### Auto-Commit (Default)

```python
consumer = KafkaConsumer(
    'orders',
    group_id='order-processor',
    enable_auto_commit=True,
    auto_commit_interval_ms=5000
)
```

Every 5 seconds, the consumer automatically commits the latest
offset. Problem: if you crash between commits, you'll reprocess
some messages.

```
AUTO-COMMIT PROBLEM

  Offset: [0] [1] [2] [3] [4] [5] [6] [7]
                    ^                 ^
                    |                 |
               Last commit     Consumer crashes here
               (offset 2)     (processing offset 6)

  On restart, consumer starts at offset 2.
  Messages 2-5 are processed AGAIN.
```

### Manual Commit (Recommended for Important Data)

```python
consumer = KafkaConsumer(
    'orders',
    group_id='order-processor',
    enable_auto_commit=False
)

for message in consumer:
    process_order(message.value)
    consumer.commit()
```

You commit after processing each message (or batch). If you crash,
you only reprocess the uncommitted messages.

### Commit Strategies Compared

```
COMMIT AFTER EACH MESSAGE:
  Process msg 5 --> Commit offset 5 --> Process msg 6 --> Commit 6
  Safest. Slowest. At-most-once-duplicate per message.

COMMIT AFTER BATCH:
  Process [5,6,7,8,9] --> Commit offset 9
  Good balance. May reprocess a partial batch on crash.

COMMIT BEFORE PROCESSING:
  Commit offset 5 --> Process msg 5
  Fastest. But if processing fails, message is LOST.
  (at-most-once delivery)
```

---

## The Consumer Poll Loop

Kafka consumers use a **poll model**, not a push model. The
consumer actively asks the broker for messages.

```
CONSUMER POLL LOOP

  while (running) {
      records = consumer.poll(timeout=100ms)
      for record in records:
          process(record)
      consumer.commit()
  }

  poll() returns a batch of messages (could be 0 if nothing new).
  The timeout is how long to wait if there's nothing to read.
  Kafka sends messages in batches for efficiency.
```

Important: if `poll()` isn't called within `max.poll.interval.ms`
(default 5 minutes), the broker assumes the consumer is dead and
reassigns its partitions to another consumer.

```
MAX POLL INTERVAL TIMEOUT

  Consumer polls      Long processing...     Broker: "You're dead!"
  |                   |                      |
  v                   v                      v
  poll() -----------> process(msg) -------> (5 min passes)
  t=0                 (taking too long)      Broker reassigns
                                             partitions!

  Solution: Keep processing time per poll < max.poll.interval.ms
  Or increase max.poll.interval.ms for slow consumers.
```

---

## Serialization and Deserialization

Kafka stores bytes. Your producer converts objects to bytes
(serialize), and your consumer converts bytes back to objects
(deserialize).

```
SERIALIZATION FLOW

  Producer side:                    Consumer side:
  Order object                      Bytes from Kafka
       |                                 |
       v                                 v
  Serializer                        Deserializer
  (JSON, Avro,                      (JSON, Avro,
   Protobuf)                         Protobuf)
       |                                 |
       v                                 v
  Bytes to Kafka                    Order object
```

Common serialization formats:

| Format | Pros | Cons |
|---|---|---|
| JSON | Human-readable, universal | Large, no schema enforcement |
| Avro | Compact, schema evolution | Needs Schema Registry |
| Protobuf | Compact, fast, typed | Needs .proto files |
| String | Simplest | No structure |

---

## Producer and Consumer Configuration Cheat Sheet

### Critical Producer Settings

| Setting | Default | Recommendation |
|---|---|---|
| `acks` | 1 | `all` for important data |
| `retries` | 2147483647 | Leave as default |
| `batch.size` | 16384 | 32768-65536 for throughput |
| `linger.ms` | 0 | 5-100 for throughput |
| `compression.type` | none | `snappy` or `lz4` |
| `max.in.flight.requests` | 5 | 1 if ordering matters and retries enabled |

### Critical Consumer Settings

| Setting | Default | Recommendation |
|---|---|---|
| `group.id` | none | Always set for production |
| `auto.offset.reset` | latest | `earliest` for new consumers |
| `enable.auto.commit` | true | `false` for important data |
| `max.poll.records` | 500 | Tune based on processing speed |
| `max.poll.interval.ms` | 300000 | Increase for slow processing |

---

## Exercises

1. **Partitioning design**: You have an order processing system.
   Orders belong to customers. You need all orders for the same
   customer processed in order. How would you set the message key?
   What happens if you add more partitions later?

2. **Acks tradeoff**: Calculate the latency difference between
   `acks=0`, `acks=1`, and `acks=all` assuming: network latency
   is 2ms, disk write is 5ms, replication is 8ms per follower,
   and you have replication factor 3.

3. **Batch math**: You produce 10,000 messages/second, each 500
   bytes. With `linger.ms=10`, how many messages per batch? What's
   the network savings compared to sending individually?

4. **Build it**: Write a producer that sends 1 million messages to
   a topic. Measure throughput with different `acks`, `batch_size`,
   and `linger.ms` settings. Create a table of results.

---

[Next: Lesson 07 — Consumer Groups](./07-kafka-consumer-groups.md)
