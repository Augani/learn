# Lesson 08: Exactly-Once Semantics

> **The one thing to remember**: Exactly-once is the guarantee that
> every message is processed once and only once — no lost messages,
> no duplicates. It's like a bank transfer: you want money to move
> exactly once, not zero times (lost) and definitely not twice
> (double charge). Achieving this is harder than it sounds, because
> networks can fail at any moment.

---

## Why Exactly-Once Is Hard

The Two Generals Problem explains why. Imagine two generals on
opposite sides of a valley need to coordinate an attack. They
send messengers through enemy territory. The messenger might get
captured. So General A sends a message: "Attack at dawn." Did
General B get it? A doesn't know. B sends back a confirmation.
Did A get the confirmation? B doesn't know.

```
THE TWO GENERALS PROBLEM

  General A                  Enemy Territory               General B
     |                            |                           |
     |--- "Attack at dawn" ----> ??? --->  (received?)        |
     |                            |                           |
     |     (did B get it?)  <--- ??? <--- "Got it" ----------|
     |                            |                           |
     |--- "Got your ack" ------> ??? --->  (received?)        |
     |                            |                           |
     ...infinite regress...

  No matter how many confirmations you send,
  you can NEVER be 100% sure the other side got the message.
```

In distributed systems, networks fail. Messages get lost. Servers
crash mid-operation. This means:

- Producer sends message, Kafka stores it, but the acknowledgment
  gets lost. Producer retries. Now you have a duplicate.
- Consumer processes a message, but crashes before committing the
  offset. When it restarts, it processes the message again.

Exactly-once semantics solve both of these problems.

---

## The Three Pieces of Exactly-Once in Kafka

### 1. Idempotent Producers

An idempotent producer ensures that even if a message is sent
multiple times (due to retries), Kafka stores it only once.

```
WITHOUT IDEMPOTENT PRODUCER:

  Producer --> "msg-1" --> Broker stores msg-1
  Broker sends ACK ... but ACK is lost!
  Producer (timeout) --> retries "msg-1" --> Broker stores msg-1 AGAIN

  Result: Two copies of msg-1 in the partition!


WITH IDEMPOTENT PRODUCER:

  Producer --> "msg-1" (PID=5, Seq=0) --> Broker stores msg-1
  Broker sends ACK ... but ACK is lost!
  Producer (timeout) --> retries "msg-1" (PID=5, Seq=0) --> Broker:
    "I already have PID=5, Seq=0. Ignoring duplicate."

  Result: Exactly one copy of msg-1.
```

How it works: Each producer gets a **Producer ID (PID)** and
assigns a **sequence number** to each message per partition. The
broker tracks the latest sequence number for each PID. If it
receives a message with a sequence number it's already seen,
it discards the duplicate.

```python
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    enable_idempotence=True
)
```

That's it — one configuration flag. Kafka handles everything
internally.

What idempotent producers guarantee:
- No duplicate messages within a single partition
- Messages arrive in order within a partition
- No messages are lost (retries are safe)

What they DON'T guarantee:
- Exactly-once across multiple partitions
- Exactly-once across produce + consume together

For that, you need transactions.

---

### 2. Transactional Messaging

Transactions let you atomically write messages to multiple
partitions. Either ALL messages are written, or NONE are.

```
TRANSACTION: Atomic Multi-Partition Write

  WITHOUT TRANSACTIONS:
  Write to partition 0: SUCCESS
  Write to partition 1: SUCCESS
  Write to partition 2: FAIL (broker crash)

  Result: Partitions 0 and 1 have the message.
          Partition 2 doesn't. Inconsistent state.


  WITH TRANSACTIONS:
  Begin transaction
  Write to partition 0: (pending)
  Write to partition 1: (pending)
  Write to partition 2: FAIL

  Transaction ABORTED.
  Result: NONE of the partitions have the message.
  Retry the entire transaction.
```

```java
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
props.put("transactional.id", "order-processor-1");
props.put("enable.idempotence", "true");

KafkaProducer<String, String> producer = new KafkaProducer<>(props);
producer.initTransactions();

try {
    producer.beginTransaction();

    producer.send(new ProducerRecord<>(
        "orders", orderId, orderJson
    ));
    producer.send(new ProducerRecord<>(
        "inventory-updates", itemId, reservationJson
    ));
    producer.send(new ProducerRecord<>(
        "notifications", customerId, emailJson
    ));

    producer.commitTransaction();
} catch (Exception e) {
    producer.abortTransaction();
    throw e;
}
```

All three messages are committed atomically. Either all three
topics get the message, or none of them do.

---

### 3. Consume-Transform-Produce (The Full Pattern)

The most common exactly-once pattern is: read from one topic,
process the data, write to another topic — all in a single
transaction.

```
CONSUME-TRANSFORM-PRODUCE PATTERN

  Input Topic          Consumer/Producer          Output Topic
  +---------+          +-----------+              +---------+
  | msg-1   |---read-->|           |---write----->| result-1|
  | msg-2   |          | Process   |              | result-2|
  | msg-3   |          | & commit  |              | result-3|
  +---------+          | offsets   |              +---------+
                       +-----------+

  The transaction includes:
  1. Reading from the input topic
  2. Writing to the output topic
  3. Committing the consumer offset

  ALL THREE happen atomically.
  If any fail, everything is rolled back.
```

```java
producer.initTransactions();

while (true) {
    ConsumerRecords<String, String> records = consumer.poll(
        Duration.ofMillis(100)
    );

    if (records.isEmpty()) continue;

    producer.beginTransaction();

    try {
        for (ConsumerRecord<String, String> record : records) {
            String result = processOrder(record.value());

            producer.send(new ProducerRecord<>(
                "processed-orders",
                record.key(),
                result
            ));
        }

        Map<TopicPartition, OffsetAndMetadata> offsets = new HashMap<>();
        for (TopicPartition partition : records.partitions()) {
            List<ConsumerRecord<String, String>> partRecords =
                records.records(partition);
            long lastOffset = partRecords.get(
                partRecords.size() - 1).offset();
            offsets.put(partition,
                new OffsetAndMetadata(lastOffset + 1));
        }

        producer.sendOffsetsToTransaction(offsets, consumerGroupId);
        producer.commitTransaction();
    } catch (Exception e) {
        producer.abortTransaction();
    }
}
```

---

## The Idempotency Key Pattern

Even with Kafka's exactly-once, your downstream services (databases,
APIs) might not be transactional with Kafka. The idempotency key
pattern handles this.

The idea: give every operation a unique key. Before processing,
check if you've already processed this key. If yes, skip it.

```
IDEMPOTENCY KEY PATTERN

  Message: { "idempotency_key": "order-789-payment", ... }

  Consumer receives message:
  1. Check: "Have I processed order-789-payment before?"
  2. Look up key in database/cache
  3a. Key NOT found: Process the message, store the key
  3b. Key FOUND: Skip (already processed), commit offset

  Result: Even if the message is delivered twice,
  the operation only happens once.
```

```python
import redis
import json

redis_client = redis.Redis()

def process_with_idempotency(message):
    data = json.loads(message.value)
    idempotency_key = data['idempotency_key']

    if redis_client.exists(f"processed:{idempotency_key}"):
        print(f"Skipping duplicate: {idempotency_key}")
        return

    process_payment(data)

    redis_client.setex(
        f"processed:{idempotency_key}",
        86400 * 7,
        "1"
    )
```

```go
func processWithIdempotency(msg *kafka.Message) error {
    var data OrderEvent
    if err := json.Unmarshal(msg.Value, &data); err != nil {
        return err
    }

    key := fmt.Sprintf("processed:%s", data.IdempotencyKey)

    exists, err := redisClient.Exists(ctx, key).Result()
    if err != nil {
        return err
    }
    if exists == 1 {
        log.Printf("Skipping duplicate: %s", data.IdempotencyKey)
        return nil
    }

    if err := processPayment(data); err != nil {
        return err
    }

    return redisClient.SetEX(ctx, key, "1", 7*24*time.Hour).Err()
}
```

### Generating Good Idempotency Keys

The key must uniquely identify the operation, not just the message:

```
GOOD IDEMPOTENCY KEYS:

  "order-789-payment"          (order ID + operation)
  "user-123-welcome-email"     (user ID + action)
  "transfer-456-debit"         (transfer ID + side)
  "invoice-2024-001-line-3"    (document + line item)

BAD IDEMPOTENCY KEYS:

  "uuid-random-new-each-time"  (different each retry = not idempotent)
  "payment"                    (not specific enough)
  "12345"                      (what does this mean?)
```

---

## Making Downstream Operations Idempotent

### Database Writes

Use upserts (insert or update) instead of plain inserts:

```sql
-- NOT idempotent (second insert fails or creates duplicate)
INSERT INTO orders (id, customer_id, total) VALUES ('ord-789', 'cust-123', 59.99);

-- Idempotent (second execution updates the same row)
INSERT INTO orders (id, customer_id, total) VALUES ('ord-789', 'cust-123', 59.99)
ON CONFLICT (id) DO UPDATE SET customer_id = EXCLUDED.customer_id, total = EXCLUDED.total;
```

### API Calls

Pass idempotency keys to external APIs. Most payment processors
support this:

```python
import stripe

stripe.PaymentIntent.create(
    amount=5999,
    currency='usd',
    customer='cust-123',
    idempotency_key='order-789-payment'
)
```

### Counter Increments

Incrementing a counter is NOT idempotent. Processing the same
message twice means counting twice. Instead, use **set-based**
operations:

```
NOT IDEMPOTENT:
  UPDATE products SET view_count = view_count + 1  (doubles on retry)

IDEMPOTENT:
  INSERT INTO product_views (product_id, view_id) VALUES ('prod-1', 'view-789')
  ON CONFLICT (view_id) DO NOTHING;

  Then: SELECT COUNT(*) FROM product_views WHERE product_id = 'prod-1'
```

---

## The Cost of Exactly-Once

Exactly-once semantics have a performance cost:

```
PERFORMANCE COMPARISON (approximate)

  +-------------------+-----------+-------------------+
  | Guarantee         | Throughput| Latency           |
  +-------------------+-----------+-------------------+
  | At-most-once      | 100%      | Lowest            |
  | (acks=0)          |           |                   |
  +-------------------+-----------+-------------------+
  | At-least-once     | 80-90%    | Low               |
  | (acks=all)        |           |                   |
  +-------------------+-----------+-------------------+
  | Exactly-once      | 50-70%    | Higher            |
  | (transactions)    |           | (transaction      |
  |                   |           |  overhead)        |
  +-------------------+-----------+-------------------+

  Exactly-once adds:
  - Transaction coordination overhead
  - Extra broker communication
  - Fencing of zombie producers
```

**Rule of thumb**: Use exactly-once for financial transactions,
inventory changes, and anything where duplicates cause real harm.
Use at-least-once with idempotent consumers for everything else.

---

## Exercises

1. **Spot the problem**: This code processes payments. Find the
   scenario where it processes a payment twice:
   ```python
   for message in consumer:
       charge_credit_card(message.value)
       consumer.commit()
   ```

2. **Design idempotency**: You're building a notification service
   that sends SMS messages. Design an idempotency strategy that
   prevents sending the same SMS twice, even if the Kafka message
   is delivered multiple times.

3. **Transaction design**: You read from an "orders" topic, update
   inventory in a database, and write to a "shipments" topic. The
   database is NOT Kafka. How do you ensure exactly-once across
   both Kafka and the database?

4. **Benchmark**: Set up a Kafka producer with and without
   transactions. Send 100,000 messages with each configuration.
   Measure throughput and latency differences.

---

[Next: Lesson 09 — RabbitMQ Architecture](./09-rabbitmq-architecture.md)
