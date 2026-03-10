# Lesson 02: Message Queues vs Event Streams

> **The one thing to remember**: A message queue is like a to-do list —
> once a task is done, you cross it off and it's gone. An event stream
> is like a journal — you write down everything that happens, and anyone
> can read through the history at any time. Both move data between
> services, but they have fundamentally different philosophies.

---

## The To-Do List vs The Journal

**Message Queue (To-Do List)**:
You write "buy milk" on a sticky note and put it on the fridge. Your
roommate sees it, buys the milk, and throws away the sticky note.
The task is done. The note is gone. If someone else comes along,
they won't know milk was ever on the list.

**Event Stream (Journal)**:
You write in a shared household journal: "Jan 15: We need milk."
Your roommate reads it and buys milk. But the entry stays in the
journal forever. A new roommate can read through the journal and
understand the full history of what happened. Another roommate
can read the same entry and update the grocery budget spreadsheet.

```
MESSAGE QUEUE (To-Do List)

  Producer         Queue              Consumer
     |              |                    |
     |-- "buy milk" -->|                 |
     |              | [buy milk]         |
     |              |                    |
     |              |-- "buy milk" ----->|
     |              |    (DELETED)       | (processes it)
     |              | [ empty ]          |
     |              |                    |
  Message is GONE after consumption.
  Only ONE consumer gets each message.


EVENT STREAM (Journal)

  Producer         Stream             Consumer A
     |              |                    |
     |-- "need milk" ->|                 |
     |              | [need milk]        |
     |              |-- "need milk" ---->| (reads it)
     |              | [need milk]        |  Consumer B
     |              |-- "need milk" ----------->| (also reads it)
     |              | [need milk]        |      |
     |              |                    |      |
  Message STAYS in the stream.
  MULTIPLE consumers can read the same message.
  New consumers can read OLD messages.
```

---

## The Core Differences

### 1. Message Lifetime

```
QUEUE: Messages are consumed and deleted

  Time 0:  [msg1] [msg2] [msg3]
  Time 1:  [msg2] [msg3]           <- msg1 consumed, gone
  Time 2:  [msg3]                  <- msg2 consumed, gone
  Time 3:  [ empty ]               <- msg3 consumed, gone


STREAM: Messages persist (for a configured duration)

  Time 0:  [msg1] [msg2] [msg3]
  Time 1:  [msg1] [msg2] [msg3]   <- msg1 read, still there
  Time 2:  [msg1] [msg2] [msg3]   <- msg2 read, still there
  Time 3:  [msg1] [msg2] [msg3]   <- all still there
            ^              ^
            |              |
         Consumer A     Consumer B
         is here        is here
         (reading       (reading
          from start)    latest)
```

In a queue, once a message is acknowledged by a consumer, it's
removed. In a stream, messages stay for a retention period (hours,
days, or forever). Each consumer tracks its own position.

### 2. Consumer Model

```
QUEUE: Competing Consumers (one winner)

  Queue: [order-1] [order-2] [order-3]
            |           |           |
            v           v           v
        Worker A    Worker B    Worker C

  Each message goes to exactly ONE worker.
  Workers compete for messages.
  Great for distributing work.


STREAM: Independent Consumers (everyone gets everything)

  Stream: [event-1] [event-2] [event-3]
             |  |       |  |       |  |
             v  v       v  v       v  v
          Consumer   Consumer   Consumer
          Group A    Group B    Group C
          (Orders)   (Analytics) (Audit)

  Each consumer group gets ALL messages.
  Groups read independently at their own pace.
  Great for multiple subscribers.
```

### 3. Replay Capability

This is the biggest practical difference. With a queue, once a
message is consumed, you can't re-read it. With a stream, you
can rewind to any point and re-process messages.

Why does this matter? Because sometimes you need to:
- Fix a bug in your consumer and reprocess old messages
- Add a new service that needs historical data
- Rebuild a database from scratch using the event history
- Audit what happened last Tuesday at 3 PM

```
STREAM REPLAY: Consumer can rewind

  Stream: [e1] [e2] [e3] [e4] [e5] [e6] [e7]
                                          ^
                                          |
                              Consumer position (normal)

  "Wait, our analytics had a bug since e3!"

  Stream: [e1] [e2] [e3] [e4] [e5] [e6] [e7]
                      ^
                      |
          Consumer REWINDS to e3 and reprocesses
```

---

## Comparison Table

```
+------------------+-------------------+--------------------+
| Property         | Message Queue     | Event Stream       |
+------------------+-------------------+--------------------+
| Message lifetime | Deleted after     | Retained for       |
|                  | consumption       | configured period  |
+------------------+-------------------+--------------------+
| Consumer model   | Competing (1 gets | Independent (all   |
|                  | each message)     | get all messages)  |
+------------------+-------------------+--------------------+
| Replay           | No (gone is gone) | Yes (rewind to     |
|                  |                   | any offset)        |
+------------------+-------------------+--------------------+
| Ordering         | Best-effort FIFO  | Strict per-        |
|                  |                   | partition ordering  |
+------------------+-------------------+--------------------+
| Routing          | Rich (exchanges,  | Simple (topics,    |
|                  | bindings, headers)| partitions)        |
+------------------+-------------------+--------------------+
| Typical use      | Task distribution,| Event log, audit   |
|                  | work queues       | trail, analytics   |
+------------------+-------------------+--------------------+
| Backpressure     | Queue depth grows | Consumers track    |
|                  |                   | their own offset   |
+------------------+-------------------+--------------------+
| Examples         | RabbitMQ, SQS,    | Kafka, Pulsar,     |
|                  | ActiveMQ          | Kinesis, Redpanda  |
+------------------+-------------------+--------------------+
```

---

## When to Use a Queue

Queues are the right choice when you have **work to distribute**.
Think of them as a task list shared among workers.

**Email sending**: 1000 users sign up. Drop 1000 "send welcome
email" messages in the queue. Five email workers pull messages and
send them. Each email is sent exactly once.

**Image processing**: Users upload photos. Each upload goes into a
queue. Worker processes resize, thumbnail, and compress. You scale
workers up during peak hours, down at night.

**Order fulfillment**: Each order needs to be packed and shipped.
Workers in the warehouse pull one order at a time from the queue.

```python
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()
channel.queue_declare(queue='email_tasks', durable=True)

channel.basic_publish(
    exchange='',
    routing_key='email_tasks',
    body=json.dumps({
        'to': 'user@example.com',
        'template': 'welcome',
        'user_name': 'Alice'
    }),
    properties=pika.BasicProperties(delivery_mode=2)
)
```

---

## When to Use a Stream

Streams are the right choice when you have **events that multiple
systems care about** and you might need history.

**User activity tracking**: Every click, page view, and purchase
is an event. Analytics reads it. Recommendation engine reads it.
Fraud detection reads it. Each at their own pace.

**Financial transactions**: Every trade, deposit, and withdrawal
is logged. Compliance needs to audit last quarter. A new reporting
service needs to backfill two years of data.

**Microservice coordination**: When an order is placed, the
inventory service, payment service, notification service, and
analytics service all need to know. Each reads from the same
stream independently.

```python
from kafka import KafkaProducer, KafkaConsumer
import json

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

producer.send('user-activity', value={
    'user_id': 'u-123',
    'event': 'page_view',
    'page': '/products/shoes',
    'timestamp': '2024-01-15T10:30:00Z'
})

analytics_consumer = KafkaConsumer(
    'user-activity',
    group_id='analytics-team',
    bootstrap_servers=['localhost:9092'],
    auto_offset_reset='earliest'
)

recommendations_consumer = KafkaConsumer(
    'user-activity',
    group_id='recommendations-engine',
    bootstrap_servers=['localhost:9092'],
    auto_offset_reset='earliest'
)
```

Both consumers read ALL messages from the `user-activity` stream,
independently. Analytics might be processing real-time. The
recommendation engine might batch-process every hour. Neither
blocks the other.

---

## The Hybrid Reality

In practice, most systems use both. Here's a typical e-commerce
architecture:

```
ORDER PLACED
     |
     v
+----------+
| Kafka    |  Event Stream: "order.created" event
| (Stream) |  Multiple services subscribe
+----+-----+
     |
     +----------+-----------+-----------+
     |          |           |           |
     v          v           v           v
  Inventory  Payment   Notification  Analytics
  Service    Service    Service      Service
     |          |           |
     v          v           v
 +--------+ +--------+ +--------+
 |RabbitMQ| |RabbitMQ| |RabbitMQ|   Work Queues: internal tasks
 |(Queue) | |(Queue) | |(Queue) |   within each service
 +--------+ +--------+ +--------+
     |          |           |
     v          v           v
  Workers    Workers     Workers
```

The event stream (Kafka) handles the big-picture coordination:
"something happened, whoever cares should know." The work queues
(RabbitMQ) handle the internal task distribution within each
service.

---

## A Mental Model for Choosing

Ask yourself these questions:

```
DECISION FLOWCHART

  Should more than one service process this message?
  |
  +-- YES --> Do you need message history / replay?
  |           |
  |           +-- YES --> EVENT STREAM (Kafka, Kinesis)
  |           |
  |           +-- NO  --> PUB/SUB (RabbitMQ fanout, SNS)
  |
  +-- NO  --> Is this a task that needs to be done once?
              |
              +-- YES --> MESSAGE QUEUE (RabbitMQ, SQS)
              |
              +-- NO  --> Probably a direct API call
```

---

## Exercises

1. **Classify these**: For each scenario, decide if you'd use a
   queue or a stream. Explain why.
   - Processing credit card refunds
   - Tracking GPS positions of delivery trucks
   - Sending password reset emails
   - Recording audit logs for compliance
   - Distributing video encoding jobs

2. **Design the data flow**: You're building a food delivery app.
   Draw a diagram showing which parts use queues and which use
   streams. Consider: order placement, restaurant notification,
   driver assignment, live tracking, analytics.

3. **Replay scenario**: Your recommendation engine had a bug for
   the past week. With a queue-based system, what would you do?
   With a stream-based system, what would you do?

4. **Code exploration**: Run a local Kafka and RabbitMQ instance
   using Docker. Send 10 messages to each. Consume them. Then try
   to consume them again. What happens in each case?

---

[Next: Lesson 03 — Publish/Subscribe](./03-pub-sub.md)
