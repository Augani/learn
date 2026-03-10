# Lesson 07: Kafka Consumer Groups

> **The one thing to remember**: A consumer group is a team of
> workers reading from the same topic. Kafka divides the partitions
> among the team members so each message is processed by exactly one
> worker. Add a team member and Kafka automatically redistributes
> the work. It's like adding another cashier when the line gets long.

---

## The Grocery Store Analogy

Imagine a grocery store with 6 checkout lanes (partitions) and
customers flowing through them.

- **1 cashier**: One person runs between all 6 lanes. Slow.
- **3 cashiers**: Each handles 2 lanes. 3x faster.
- **6 cashiers**: Each handles 1 lane. Maximum speed.
- **8 cashiers**: Only 6 lanes, so 2 cashiers sit idle.

This is exactly how Kafka consumer groups work.

```
CONSUMER GROUP SCALING

  Topic: "orders" (6 partitions)

  1 Consumer:
  P0 P1 P2 P3 P4 P5 --> [Consumer 1]
  (One consumer reads ALL partitions)

  3 Consumers:
  P0 P1 --> [Consumer 1]
  P2 P3 --> [Consumer 2]
  P4 P5 --> [Consumer 3]
  (Each consumer reads 2 partitions)

  6 Consumers:
  P0 --> [Consumer 1]
  P1 --> [Consumer 2]
  P2 --> [Consumer 3]
  P3 --> [Consumer 4]
  P4 --> [Consumer 5]
  P5 --> [Consumer 6]
  (Maximum parallelism)

  8 Consumers:
  P0 --> [Consumer 1]
  P1 --> [Consumer 2]
  P2 --> [Consumer 3]
  P3 --> [Consumer 4]
  P4 --> [Consumer 5]
  P5 --> [Consumer 6]
       [Consumer 7]  (IDLE - no partition to read)
       [Consumer 8]  (IDLE - no partition to read)
```

**Key rule**: A partition can only be assigned to ONE consumer
within a group. This means the maximum useful consumers equals
the number of partitions.

---

## What Is a Consumer Group?

A consumer group is identified by a `group.id` string. All
consumers with the same `group.id` form a group and coordinate:

```python
consumer_1 = KafkaConsumer(
    'orders',
    group_id='order-processor',
    bootstrap_servers=['localhost:9092']
)

consumer_2 = KafkaConsumer(
    'orders',
    group_id='order-processor',
    bootstrap_servers=['localhost:9092']
)
```

These two consumers share the work. Each gets some partitions.

---

## Multiple Groups: Independent Readers

Different groups read the same topic independently. Each group
maintains its own offsets. This is how you get both point-to-point
(within a group) and pub/sub (across groups).

```
MULTIPLE CONSUMER GROUPS ON THE SAME TOPIC

  Topic: "orders" (4 partitions)

  Group: "order-processor"           Group: "analytics"
  +------------------------+        +------------------------+
  | Consumer 1: P0, P1     |        | Consumer A: P0, P1, P2 |
  | Consumer 2: P2, P3     |        | Consumer B: P3         |
  +------------------------+        +------------------------+
          |                                   |
          v                                   v
   Processes each order                Tracks order metrics
   (exactly once per order)            (also reads every order)

  Group: "audit-log"
  +------------------------+
  | Consumer X: P0, P1, P2, P3 |
  +------------------------+
          |
          v
   Writes to audit database
   (also reads every order)

  Each group gets ALL messages independently.
  Within each group, messages are divided among consumers.
```

This is the fundamental model:
- **Within a group**: Competing consumers (each message to one consumer)
- **Across groups**: Independent readers (each group gets all messages)

---

## Rebalancing: Redistributing Work

When a consumer joins or leaves a group, Kafka must redistribute
partitions. This is called a **rebalance**.

### When Does Rebalancing Happen?

```
REBALANCE TRIGGERS

  1. New consumer joins the group
     Before: Consumer 1 has [P0, P1, P2, P3]
     After:  Consumer 1 has [P0, P1]
             Consumer 2 has [P2, P3]

  2. Consumer leaves (graceful shutdown)
     Before: Consumer 1 has [P0, P1], Consumer 2 has [P2, P3]
     After:  Consumer 1 has [P0, P1, P2, P3]

  3. Consumer crashes (heartbeat timeout)
     Before: Consumer 1 has [P0, P1], Consumer 2 has [P2, P3]
     (Consumer 2 stops sending heartbeats)
     After ~10 seconds:
             Consumer 1 has [P0, P1, P2, P3]

  4. Partitions added to the topic
     Existing partitions stay, new ones are assigned.
```

### The Rebalance Process

```
REBALANCE FLOW (Eager Protocol)

  1. Broker detects change (new consumer, dead consumer, etc.)

  2. Broker sends "rebalance" signal to all consumers in group

  3. ALL consumers STOP processing and revoke their partitions
     +------------+    +------------+
     | Consumer 1 |    | Consumer 2 |
     | STOP!      |    | STOP!      |
     | Give up    |    | Give up    |
     | P0, P1     |    | P2, P3     |
     +------------+    +------------+

  4. Group coordinator assigns partitions using strategy

  5. Consumers resume with new assignments
     +------------+    +------------+    +------------+
     | Consumer 1 |    | Consumer 2 |    | Consumer 3 |
     | Gets P0,P1 |    | Gets P2    |    | Gets P3    |
     +------------+    +------------+    +------------+

  PROBLEM: During steps 3-5, NO messages are processed!
  This "stop the world" pause can last seconds.
```

### Cooperative Rebalancing (Better)

Modern Kafka supports **cooperative (incremental) rebalancing**
which avoids the full stop:

```
COOPERATIVE REBALANCE (Incremental)

  Before: Consumer 1 [P0, P1], Consumer 2 [P2, P3]
  New:    Consumer 3 joins

  Step 1: Only MOVE partitions that need to change
     Consumer 1: keeps P0, gives up P1
     Consumer 2: keeps P2, keeps P3
     Consumer 3: gets P1

  Step 2: Consumer 1 and 2 keep processing their remaining
          partitions during the rebalance

  Result: Only P1 experiences a brief pause.
  P0, P2, P3 are processed continuously.
```

```python
consumer = KafkaConsumer(
    'orders',
    group_id='order-processor',
    partition_assignment_strategy=[CooperativeStickyAssignor]
)
```

---

## Partition Assignment Strategies

How does Kafka decide which consumer gets which partitions?

### Range Assignor (Default)

```
RANGE ASSIGNOR

  Topic: "orders" (6 partitions), 3 consumers

  Partitions sorted: P0, P1, P2, P3, P4, P5
  Consumers sorted:  C0, C1, C2

  6 partitions / 3 consumers = 2 each

  C0: P0, P1
  C1: P2, P3
  C2: P4, P5

  Problem: With multiple topics, C0 always gets the "first" ones,
  leading to uneven load if topics have different partition counts.
```

### Round-Robin Assignor

```
ROUND-ROBIN ASSIGNOR

  Partitions: P0, P1, P2, P3, P4, P5
  Consumers:  C0, C1, C2

  P0 --> C0
  P1 --> C1
  P2 --> C2
  P3 --> C0
  P4 --> C1
  P5 --> C2

  Evenly distributed. Better for multiple topics.
```

### Sticky Assignor (Recommended)

Like round-robin, but during rebalance it tries to keep existing
assignments and only move what's necessary. This minimizes partition
movements and reduces rebalance time.

```
STICKY ASSIGNOR DURING REBALANCE

  Before (3 consumers):
  C0: P0, P1
  C1: P2, P3
  C2: P4, P5

  C2 leaves.

  Round-robin would reassign everything.
  Sticky keeps C0 and C1's assignments, just moves C2's:

  After:
  C0: P0, P1, P4   (kept P0, P1 — added P4)
  C1: P2, P3, P5   (kept P2, P3 — added P5)

  Minimal disruption.
```

---

## Delivery Guarantees

Consumer groups interact with delivery semantics — how many times
each message is processed.

### At-Most-Once

Commit the offset BEFORE processing. If processing fails, the
message is skipped. Each message is processed zero or one times.

```
AT-MOST-ONCE

  1. Consumer reads message at offset 5
  2. Consumer commits offset 5   <-- "I'm done with 5"
  3. Consumer processes message
  4. Processing CRASHES
  5. Consumer restarts at offset 6
  6. Message at offset 5 is LOST (never processed)

  Use when: Losing occasional messages is acceptable
  Example: Metrics, logging, click tracking
```

### At-Least-Once

Process the message BEFORE committing. If processing succeeds but
commit fails, the message is processed again. Each message is
processed one or more times.

```
AT-LEAST-ONCE

  1. Consumer reads message at offset 5
  2. Consumer processes message    <-- Do the work first
  3. Consumer tries to commit offset 5
  4. CRASH before commit completes
  5. Consumer restarts at offset 5
  6. Message at offset 5 is processed AGAIN

  Use when: Duplicates are acceptable or handled with idempotency
  Example: Most business logic (with idempotent consumers)
```

### Exactly-Once

The holy grail. Each message is processed exactly one time. This
requires special support from Kafka (transactions, idempotent
producers). We cover this in the next lesson.

```
DELIVERY GUARANTEES SUMMARY

  +------------------+----------+-----------+------------+
  | Guarantee        | Speed    | Data Loss | Duplicates |
  +------------------+----------+-----------+------------+
  | At-most-once     | Fastest  | Possible  | None       |
  | At-least-once    | Fast     | None      | Possible   |
  | Exactly-once     | Slowest  | None      | None       |
  +------------------+----------+-----------+------------+
```

---

## Monitoring Consumer Groups

Kafka tracks a critical metric: **consumer lag** — the difference
between the latest offset in a partition and the consumer's
committed offset.

```
CONSUMER LAG

  Partition 0:
  Latest offset:    1,000,050
  Consumer offset:  1,000,045
  Lag:              5 messages (healthy)

  Partition 1:
  Latest offset:    2,500,000
  Consumer offset:  2,400,000
  Lag:              100,000 messages (PROBLEM!)

  If lag keeps growing, the consumer can't keep up.
  Solutions:
  - Add more consumers (up to partition count)
  - Speed up processing
  - Add more partitions (then add consumers)
```

Check consumer lag with the Kafka CLI:

```bash
kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group order-processor \
  --describe

GROUP           TOPIC    PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
order-processor orders   0          1000045         1000050         5
order-processor orders   1          2400000         2500000         100000
order-processor orders   2          800000          800010          10
```

---

## Common Pitfalls

### 1. Too Few Partitions

If you have 12 consumers but only 4 partitions, 8 consumers are
idle. Plan partition count based on expected maximum consumers.

### 2. Rebalance Storms

Consumers that take too long to process and exceed
`max.poll.interval.ms` get kicked from the group, causing a
rebalance. When they rejoin, another rebalance. This loop is
called a "rebalance storm."

```
REBALANCE STORM

  Consumer is slow --> exceeds max.poll.interval
  --> kicked from group --> rebalance
  --> consumer reconnects --> rebalance again
  --> consumer is slow again --> kicked again
  --> repeat forever

  Fix: Increase max.poll.interval.ms or reduce max.poll.records
```

### 3. Uneven Partition Load

If one partition has 10x more data than others, the consumer
assigned to it becomes the bottleneck. Use consistent key hashing
to distribute evenly.

---

## Exercises

1. **Design for scale**: Your e-commerce platform processes 100,000
   orders per minute during Black Friday. Each order takes 50ms
   to process. How many partitions and consumers do you need?

2. **Rebalance scenario**: You have 4 consumers in a group reading
   from 8 partitions (2 each). Consumer 3 crashes. Walk through
   the rebalance step by step with each assignment strategy.

3. **Monitor lag**: Set up a Kafka topic with a fast producer
   (1000 msg/s) and a slow consumer (100 msg/s). Watch the lag
   grow. Then add more consumers and watch it shrink.

4. **Multiple groups**: Create three consumer groups reading from
   the same topic. Verify that each group receives all messages
   independently. Delete one group's offset and restart — what
   happens?

---

[Next: Lesson 08 — Exactly-Once Semantics](./08-kafka-exactly-once.md)
