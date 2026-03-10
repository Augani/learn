# Reference: Messaging Tools Comparison

> Quick reference comparing the major messaging and streaming
> platforms. Use this to choose the right tool for your project.

---

## Overview

```
TOOL LANDSCAPE

  +-----------------------------------------------------------+
  |                                                           |
  |   EVENT STREAMS              MESSAGE QUEUES               |
  |   (log-based)               (broker-based)                |
  |                                                           |
  |   Apache Kafka              RabbitMQ                      |
  |   Amazon Kinesis            Amazon SQS                    |
  |   Apache Pulsar             ActiveMQ                      |
  |   Redpanda                  Azure Service Bus             |
  |                                                           |
  |                 HYBRID                                    |
  |                 Redis Streams                              |
  |                 NATS JetStream                             |
  |                 Apache Pulsar                              |
  |                                                           |
  +-----------------------------------------------------------+
```

---

## Apache Kafka

```
TYPE:        Event stream (distributed commit log)
PROTOCOL:    Custom binary protocol
WRITTEN IN:  Java/Scala
LICENSE:     Apache 2.0 (open source)
```

**Architecture**: Distributed cluster of brokers. Topics split into
partitions. Append-only log with configurable retention.

**Strengths**:
- Extremely high throughput (millions of messages/second)
- Message replay (consumers can rewind to any offset)
- Strong ordering guarantees per partition
- Exactly-once semantics with transactions
- Massive ecosystem (Connect, Streams, Schema Registry)
- Long-term message retention (days, weeks, forever)

**Weaknesses**:
- Complex to operate (though KRaft mode simplifies)
- No built-in message routing (just topics and partitions)
- Consumer must manage offsets
- Minimum 3 brokers recommended for production

**Best for**: Event sourcing, streaming analytics, high-throughput
data pipelines, microservice event buses, audit logs.

**Typical scale**: 100K to millions of messages/second.

```
KAFKA AT A GLANCE

  Producers --> [Topic: Partition 0] --> Consumer Group A
                [Topic: Partition 1] --> Consumer Group A
                [Topic: Partition 2] --> Consumer Group A
                                     --> Consumer Group B (independent)

  Retention: configurable (default 7 days)
  Replay: yes (any offset)
  Ordering: per partition
```

---

## RabbitMQ

```
TYPE:        Message queue (smart broker)
PROTOCOL:    AMQP 0.9.1 (also MQTT, STOMP)
WRITTEN IN:  Erlang
LICENSE:     Mozilla Public License 2.0 (open source)
```

**Architecture**: Smart broker with exchanges, bindings, and queues.
Broker handles routing, filtering, and delivery.

**Strengths**:
- Rich routing (direct, topic, fanout, headers exchanges)
- Priority queues
- Message TTL and dead letter exchanges
- Multiple protocols (AMQP, MQTT, STOMP)
- Excellent management UI
- Mature, well-documented, battle-tested
- Lower operational complexity than Kafka

**Weaknesses**:
- No message replay (consumed = deleted)
- Lower throughput than Kafka at scale
- Performance degrades with large queue backlogs
- No built-in stream processing

**Best for**: Task queues, RPC, complex routing, IoT (via MQTT),
traditional enterprise messaging.

**Typical scale**: 10K to 100K messages/second.

```
RABBITMQ AT A GLANCE

  Producers --> [Exchange] --binding--> [Queue] --> Consumer
                           --binding--> [Queue] --> Consumer

  Routing: exchanges with pattern matching
  Delivery: push to consumers
  Consumed messages: deleted from queue
```

---

## Amazon SQS

```
TYPE:        Managed message queue
PROTOCOL:    HTTP/HTTPS (AWS API)
MANAGED BY:  AWS
```

**Architecture**: Fully managed, serverless queue service. Two types:
Standard (best-effort ordering) and FIFO (strict ordering).

**Strengths**:
- Zero operations (fully managed by AWS)
- Scales automatically (virtually unlimited throughput)
- Pay per message (no idle cost)
- Dead letter queue support built-in
- Integrates with Lambda, SNS, EventBridge
- 14-day message retention

**Weaknesses**:
- No message replay
- No pub/sub (need SNS for fan-out)
- AWS lock-in
- Limited message size (256KB)
- Standard queues: at-least-once, possible duplicates
- Higher latency than self-hosted options

**Best for**: AWS-native applications, serverless architectures,
simple task queues where operational simplicity is priority.

```
SQS AT A GLANCE

  Standard Queue:            FIFO Queue:
  - Nearly unlimited TPS     - 3000 msg/s (with batching)
  - At-least-once delivery   - Exactly-once processing
  - Best-effort ordering     - Strict ordering
  - May have duplicates      - No duplicates
```

---

## NATS / NATS JetStream

```
TYPE:        Messaging system (core NATS) + stream (JetStream)
PROTOCOL:    Custom text-based protocol
WRITTEN IN:  Go
LICENSE:     Apache 2.0 (open source)
```

**Architecture**: Lightweight, high-performance messaging. Core NATS
is fire-and-forget pub/sub. JetStream adds persistence and
streaming.

**Strengths**:
- Extremely low latency (sub-millisecond)
- Very lightweight (single binary, minimal config)
- Simple to operate
- Built-in request/reply pattern
- JetStream: persistence, replay, exactly-once
- Edge and IoT friendly
- Leaf nodes for hub-and-spoke topologies

**Weaknesses**:
- Smaller ecosystem than Kafka or RabbitMQ
- JetStream is relatively newer
- Less enterprise tooling
- Fewer integrations with other systems

**Best for**: Microservice communication, IoT, edge computing,
low-latency messaging, service mesh communication.

**Typical scale**: 10K to millions of messages/second.

```
NATS AT A GLANCE

  Core NATS:                 JetStream:
  - Fire and forget          - Persistent
  - No guarantees            - At-least-once / exactly-once
  - Fastest possible         - Replay support
  - Sub-millisecond latency  - Consumer groups
```

---

## Redis Streams

```
TYPE:        Stream data structure in Redis
PROTOCOL:    RESP (Redis protocol)
WRITTEN IN:  C
LICENSE:     BSD 3-Clause (Redis core)
```

**Architecture**: Append-only log data structure within Redis.
Consumer groups for parallel processing. Built into Redis, so no
separate infrastructure if you already use Redis.

**Strengths**:
- No additional infrastructure if you use Redis already
- Consumer groups with acknowledgment
- Message replay (by ID)
- Very fast (in-memory)
- Simple API
- Trimming by size or time

**Weaknesses**:
- Limited by Redis memory
- Not designed for very high throughput streaming
- Less mature than Kafka for streaming use cases
- No built-in dead letter queue
- Clustering adds complexity

**Best for**: Lightweight event streaming when you already use Redis,
real-time feeds, activity streams, notification systems.

**Typical scale**: 10K to 500K messages/second.

```
REDIS STREAMS AT A GLANCE

  XADD mystream * field value    (produce)
  XREADGROUP GROUP grp consumer  (consume with group)
  XACK mystream grp id           (acknowledge)
  XRANGE mystream - +            (replay)
```

---

## Side-by-Side Comparison

```
+------------------+----------+---------+------+------+--------+
| Feature          | Kafka    | RabbitMQ| SQS  | NATS | Redis  |
|                  |          |         |      | JS   | Streams|
+------------------+----------+---------+------+------+--------+
| Throughput       | Very High| High    | High | Very | High   |
|                  | (M/s)   | (100K/s)|(auto)| High |        |
+------------------+----------+---------+------+------+--------+
| Latency          | Low      | Low     | Med  | Very | Very   |
|                  | (ms)     | (ms)    | (ms) | Low  | Low    |
+------------------+----------+---------+------+------+--------+
| Message Replay   | Yes      | No      | No   | Yes  | Yes    |
+------------------+----------+---------+------+------+--------+
| Ordering         | Per-     | Per-    | FIFO | Per- | Per-   |
|                  | partition| queue   | only | subj | stream |
+------------------+----------+---------+------+------+--------+
| Routing          | Basic    | Rich    | None | Subj | None   |
|                  | (topics) | (exch)  |      | based|        |
+------------------+----------+---------+------+------+--------+
| Dead Letter Q    | Manual   | Built-in| Yes  | Yes  | Manual |
+------------------+----------+---------+------+------+--------+
| Exactly Once     | Yes      | No*     | FIFO | Yes  | No     |
+------------------+----------+---------+------+------+--------+
| Operations       | Complex  | Medium  | None | Easy | Easy** |
+------------------+----------+---------+------+------+--------+
| Protocol         | Binary   | AMQP    | HTTP | Text | RESP   |
+------------------+----------+---------+------+------+--------+
| Persistence      | Disk     | Disk/RAM| AWS  | Disk | Memory |
+------------------+----------+---------+------+------+--------+
| Stream Proc.     | KStreams | No      | No   | No   | No     |
+------------------+----------+---------+------+------+--------+

* RabbitMQ has at-least-once. Consumer idempotency needed.
** Easy if you already run Redis. Clustering adds complexity.
```

---

## Decision Guide

```
CHOOSING THE RIGHT TOOL

  Need event replay / audit trail?
  --> Kafka (or NATS JetStream, Redis Streams)

  Need complex routing (topic, headers, priority)?
  --> RabbitMQ

  Using AWS and want zero operations?
  --> SQS + SNS (or Amazon MSK for managed Kafka)

  Need sub-millisecond latency?
  --> NATS (or Redis Streams)

  Already running Redis?
  --> Redis Streams (for lighter workloads)

  Need stream processing (windowing, joins)?
  --> Kafka + Kafka Streams (or Flink)

  Small team, simple needs?
  --> SQS (managed) or NATS (simple to run)

  Enterprise with existing Java stack?
  --> Kafka (ecosystem and tooling)

  IoT / MQTT needed?
  --> RabbitMQ (MQTT plugin) or NATS

  "I just need a simple task queue"?
  --> SQS (if AWS) or RabbitMQ (if self-hosted)
```

---

## Cost Comparison (Approximate)

```
OPERATIONAL COST AT 100K MESSAGES/SECOND

  +------------------+----------------+---------------------------+
  | Tool             | Infrastructure | Notes                     |
  +------------------+----------------+---------------------------+
  | Kafka (self)     | 3+ servers     | Significant ops overhead  |
  | Kafka (managed)  | $500-2000/mo   | Confluent, MSK, etc.      |
  | RabbitMQ (self)  | 1-3 servers    | Moderate ops overhead     |
  | RabbitMQ (cloud) | $100-500/mo    | CloudAMQP, etc.           |
  | SQS              | ~$40-100/mo    | Pay per request           |
  | NATS (self)      | 1-3 servers    | Low ops overhead          |
  | Redis Streams    | Existing Redis | No additional cost        |
  +------------------+----------------+---------------------------+

  These are rough estimates. Actual costs depend on message size,
  retention period, replication, and throughput patterns.
```

---

## Migration Paths

```
COMMON MIGRATION PATHS

  Starting simple:
  SQS ---------> Kafka          (when you need replay + streaming)
  RabbitMQ ----> Kafka          (when you need higher throughput)
  Redis PubSub-> Redis Streams  (when you need persistence)

  Scaling up:
  Single RabbitMQ -> RabbitMQ cluster (add nodes)
  Kafka 3 brokers -> Kafka 10+ brokers (add brokers, rebalance)
  NATS single -> NATS cluster (add nodes)

  Going managed:
  Self-hosted Kafka -> Confluent Cloud / AWS MSK
  Self-hosted RabbitMQ -> CloudAMQP / AWS MQ
  Self-hosted Redis -> AWS ElastiCache / Redis Cloud
```
