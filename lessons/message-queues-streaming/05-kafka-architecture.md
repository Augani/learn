# Lesson 05: Apache Kafka Architecture

> **The one thing to remember**: Kafka is a distributed commit log.
> Think of it as an append-only notebook that multiple people can
> write to and read from simultaneously. Unlike a queue where
> messages disappear after reading, Kafka keeps everything written
> down. Readers just track which page they're on.

---

## Why Kafka Exists

Traditional message queues (RabbitMQ, ActiveMQ) were designed for
relatively low throughput — thousands of messages per second. But
companies like LinkedIn needed to process millions of events per
second: every page view, every click, every search, every profile
update.

LinkedIn engineers built Kafka because existing systems couldn't
handle their scale. The key insight: instead of building a smart
broker that routes messages, build a dumb broker that just stores
messages in an append-only log. Push all the intelligence to the
producers and consumers.

---

## The Commit Log: Kafka's Foundation

A commit log is simply an ordered, append-only sequence of records.
New records go at the end. You can't modify or delete existing
records. Each record gets a sequential number called an **offset**.

```
THE COMMIT LOG

  Offset:  0     1     2     3     4     5     6     7
         +-----+-----+-----+-----+-----+-----+-----+-----+
         | msg | msg | msg | msg | msg | msg | msg | msg |
         |  0  |  1  |  2  |  3  |  4  |  5  |  6  |  7  |
         +-----+-----+-----+-----+-----+-----+-----+-----+
                                                      ^
                                                      |
                                                New messages
                                                append here

  - You can ONLY add to the end
  - You can NEVER modify or delete a record
  - Each record has a unique offset (sequential number)
  - Readers track their own offset ("I've read up to 5")
```

This is similar to how databases work internally. A database's
write-ahead log (WAL) is a commit log. Kafka took this idea and
made it the primary data structure.

---

## Brokers: The Servers

A Kafka **broker** is a single Kafka server. In production, you
run a **cluster** of brokers (typically 3 or more) for reliability.

```
KAFKA CLUSTER

  +-------------+     +-------------+     +-------------+
  |  Broker 1   |     |  Broker 2   |     |  Broker 3   |
  |  (Server)   |<--->|  (Server)   |<--->|  (Server)   |
  |             |     |             |     |             |
  | Partitions: |     | Partitions: |     | Partitions: |
  | orders-0    |     | orders-1    |     | orders-2    |
  | users-1     |     | users-0     |     | users-2     |
  | clicks-2    |     | clicks-0    |     | clicks-1    |
  +-------------+     +-------------+     +-------------+

  Brokers share the load. Each broker stores some partitions.
  If Broker 2 dies, Brokers 1 and 3 have replicas of its data.
```

Each broker handles:
- Accepting messages from producers
- Storing messages to disk
- Serving messages to consumers
- Replicating data to other brokers

---

## Topics: Organizing Messages

A **topic** is a named category of messages. Think of it as a
table in a database, or a folder in a file system.

```
TOPICS IN A TYPICAL E-COMMERCE SYSTEM

  Topic: "orders"          Topic: "payments"       Topic: "users"
  +------------------+     +------------------+    +------------------+
  | order created    |     | payment received |    | user registered  |
  | order updated    |     | payment failed   |    | user updated     |
  | order shipped    |     | refund issued    |    | user deleted     |
  | order delivered  |     | chargeback       |    | login event      |
  +------------------+     +------------------+    +------------------+
```

You create topics for each category of data. Producers write to
topics. Consumers read from topics.

---

## Partitions: How Kafka Scales

Here's where Kafka gets interesting. Each topic is split into
**partitions**. A partition is a single commit log. When you say
"the orders topic has 6 partitions," you mean there are 6
independent commit logs that together make up the orders topic.

```
TOPIC "orders" WITH 3 PARTITIONS

  Partition 0:  [0] [1] [2] [3] [4] [5]
  Partition 1:  [0] [1] [2] [3]
  Partition 2:  [0] [1] [2] [3] [4] [5] [6] [7]

  Each partition is an independent commit log.
  Offsets are per-partition (partition 0 has its own offset 0,
  partition 1 has its own offset 0, etc.)
  Messages are distributed across partitions.
```

Why split a topic into partitions?

**Parallelism**: Each partition can be read by a different consumer
simultaneously. 6 partitions = up to 6 consumers reading in
parallel.

**Throughput**: Each partition lives on a specific broker. More
partitions = more brokers involved = more disk I/O bandwidth.

**Ordering**: Messages within a partition are strictly ordered.
Messages across partitions have no ordering guarantee.

```
HOW PARTITIONS ENABLE PARALLEL CONSUMPTION

  Topic: "orders" (3 partitions)

  Partition 0: [o1] [o4] [o7] [o10] --> Consumer 1
  Partition 1: [o2] [o5] [o8] [o11] --> Consumer 2
  Partition 2: [o3] [o6] [o9] [o12] --> Consumer 3

  Three consumers read in parallel.
  Each gets ~1/3 of the messages.
  Total throughput = 3x a single consumer.
```

### How Messages Get to Partitions

When a producer sends a message, which partition does it go to?

```
PARTITION ASSIGNMENT STRATEGIES

  1. KEY-BASED (most common):
     partition = hash(message_key) % num_partitions

     Key: "customer-123" --> hash --> partition 1
     Key: "customer-456" --> hash --> partition 2
     Key: "customer-123" --> hash --> partition 1 (SAME customer,
                                                   SAME partition)

     All messages with the same key go to the same partition.
     This guarantees ordering per key.

  2. ROUND-ROBIN (no key):
     msg1 --> partition 0
     msg2 --> partition 1
     msg3 --> partition 2
     msg4 --> partition 0
     ...

     Even distribution but no ordering guarantee.

  3. CUSTOM PARTITIONER:
     You write code to decide. Example: US orders to partition 0-2,
     EU orders to partition 3-5.
```

---

## Replication: Surviving Failures

Each partition is replicated across multiple brokers. One replica
is the **leader** (handles all reads and writes). The others are
**followers** (keep copies for backup).

```
REPLICATION (replication factor = 3)

  Topic: "orders", Partition 0

  Broker 1: [Leader]    Partition 0  <-- Producers write here
  Broker 2: [Follower]  Partition 0  <-- Copies from leader
  Broker 3: [Follower]  Partition 0  <-- Copies from leader

  If Broker 1 dies:
  Broker 2: [NEW Leader] Partition 0  <-- Promoted automatically
  Broker 3: [Follower]   Partition 0  <-- Still copying

  No data loss. No downtime. Automatic failover.
```

```
PARTITION LEADERSHIP ACROSS BROKERS

  Broker 1            Broker 2            Broker 3
  +-----------+       +-----------+       +-----------+
  | orders-0  |       | orders-0  |       | orders-0  |
  | (LEADER)  |       | (follower)|       | (follower)|
  +-----------+       +-----------+       +-----------+
  | orders-1  |       | orders-1  |       | orders-1  |
  | (follower)|       | (LEADER)  |       | (follower)|
  +-----------+       +-----------+       +-----------+
  | orders-2  |       | orders-2  |       | orders-2  |
  | (follower)|       | (follower)|       | (LEADER)  |
  +-----------+       +-----------+       +-----------+

  Leadership is distributed across brokers for load balancing.
  Each broker leads some partitions and follows others.
```

The **In-Sync Replicas (ISR)** set tracks which followers are
caught up with the leader. If a follower falls too far behind,
it's removed from the ISR. Only ISR members can be elected as
the new leader.

---

## The Complete Picture

Here's how all the pieces fit together:

```
KAFKA ARCHITECTURE - COMPLETE VIEW

  Producers                    Kafka Cluster                    Consumers
  +---------+          +---------------------------+          +-----------+
  | Order   |---msg--->| Broker 1                  |          | Inventory |
  | Service |          |  orders-P0 (leader)       |---msg--->| Service   |
  +---------+          |  orders-P1 (follower)     |          +-----------+
                       |  payments-P2 (leader)     |
  +---------+          +---------------------------+          +-----------+
  | Payment |---msg--->|                           |          | Analytics |
  | Service |          | Broker 2                  |---msg--->| Service   |
  +---------+          |  orders-P0 (follower)     |          +-----------+
                       |  orders-P1 (leader)       |
  +---------+          |  payments-P0 (leader)     |          +-----------+
  | Web App |---msg--->|                           |          | Email     |
  |         |          +---------------------------+---msg--->| Service   |
  +---------+          |                           |          +-----------+
                       | Broker 3                  |
                       |  orders-P0 (follower)     |
                       |  orders-P1 (follower)     |
                       |  payments-P1 (leader)     |
                       +---------------------------+

  +---------------------------+
  | Controller                |
  | (one broker is elected)   |
  | Manages partition leaders |
  | Handles broker failures   |
  +---------------------------+
```

### The Controller

One broker in the cluster is elected as the **controller**. It's
responsible for:
- Electing partition leaders when brokers join or fail
- Assigning partitions to brokers
- Monitoring broker health

If the controller broker fails, another broker is elected. In
newer Kafka versions (3.0+), the controller uses the KRaft
consensus protocol instead of ZooKeeper.

---

## Kafka's Storage Model

Kafka stores messages on disk. This sounds slow, but Kafka makes
it fast through two key techniques:

**Sequential I/O**: Kafka only appends to the end of files. Hard
drives (and SSDs) are incredibly fast at sequential writes. No
random seeks.

**Zero-copy transfers**: When a consumer reads data, Kafka tells
the OS to send the file data directly to the network socket,
bypassing the application entirely. This is called `sendfile()`.

```
TRADITIONAL DATA TRANSFER (4 copies):
  Disk -> OS Buffer -> App Buffer -> Socket Buffer -> Network

KAFKA ZERO-COPY (2 copies):
  Disk -> OS Buffer -> Network

  Result: 2-3x faster, almost no CPU usage
```

Each partition on disk looks like this:

```
PARTITION STORAGE ON DISK

  /kafka-logs/orders-0/
    00000000000000000000.log    (messages 0 - 999,999)
    00000000000000000000.index  (offset-to-position mapping)
    00000000000001000000.log    (messages 1,000,000 - 1,999,999)
    00000000000001000000.index
    ...

  Each .log file is a segment (default 1GB).
  Old segments are deleted when retention period expires.
  Default retention: 7 days (configurable).
```

---

## Key Configuration Numbers

| Setting | Default | What It Means |
|---|---|---|
| `num.partitions` | 1 | Partitions per new topic |
| `replication.factor` | 1 | Copies of each partition |
| `log.retention.hours` | 168 (7 days) | How long to keep messages |
| `log.segment.bytes` | 1 GB | Max size of a log segment file |
| `message.max.bytes` | 1 MB | Max message size |
| `min.insync.replicas` | 1 | Min replicas for a write to succeed |

---

## Exercises

1. **Draw the architecture**: You have 4 brokers, a topic with 8
   partitions, and replication factor 3. Draw which partitions
   live on which brokers. Mark leaders and followers.

2. **Calculate capacity**: Each message is 1 KB. You receive 100,000
   messages/second. With 7-day retention, how much total storage
   do you need? (Don't forget the replication factor.)

3. **Partition count**: Your topic receives 50,000 messages/second.
   Each consumer processes 5,000 messages/second. How many
   partitions do you need? What if each consumer only handles 2,000?

4. **Failure scenario**: Broker 2 in a 3-broker cluster crashes.
   It was the leader for partitions 1, 4, and 7. Walk through
   what happens step by step.

---

[Next: Lesson 06 — Kafka Producers & Consumers](./06-kafka-producers-consumers.md)
