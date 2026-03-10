# Lesson 11: Dead Letter Queues

> **The one thing to remember**: A dead letter queue is the "return
> to sender" pile at the post office. When a letter can't be
> delivered — wrong address, recipient moved, unclaimed — it
> doesn't get thrown away. It goes to a special bin where someone
> investigates what went wrong. Dead letter queues keep your failed
> messages safe so you can fix the problem and try again.

---

## Why Messages Fail

In a perfect world, every message is processed successfully. In
the real world, messages fail for many reasons:

```
REASONS MESSAGES FAIL

  1. BAD DATA (Poison Message)
     Message: { "amount": "not-a-number" }
     Consumer: crashes trying to parse

  2. TRANSIENT FAILURE
     Consumer tries to write to database: connection timeout
     Will probably work if tried again later

  3. DEPENDENCY DOWN
     Consumer calls payment API: service is having an outage
     Nothing wrong with the message itself

  4. BUG IN CONSUMER
     Consumer has a null pointer exception on a valid message
     Needs a code fix, not a retry

  5. MESSAGE EXPIRED
     TTL exceeded before consumer could process it

  6. QUEUE OVERFLOW
     Queue is full, new messages have nowhere to go
```

Without dead letter queues, failed messages either:
- Block the queue (consumer keeps trying, failing, retrying forever)
- Get discarded (lost forever)

Both are terrible outcomes.

---

## What Is a Dead Letter Queue?

A dead letter queue (DLQ) is a separate queue where failed messages
are sent. The original queue is configured to redirect failures
to the DLQ instead of discarding them.

```
DEAD LETTER FLOW

  Normal path:
  Producer --> [Exchange] --> [Main Queue] --> Consumer --> Success!

  Failure path:
  Producer --> [Exchange] --> [Main Queue] --> Consumer --> FAIL!
                                    |
                                    v
                              [DL Exchange] --> [Dead Letter Queue]
                                                      |
                                                      v
                                              Investigate later
                                              Fix and reprocess
```

### Setting Up a DLQ in RabbitMQ

```python
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

channel.exchange_declare(exchange='dlx', exchange_type='direct')
channel.queue_declare(queue='dead-letters', durable=True)
channel.queue_bind(queue='dead-letters', exchange='dlx', routing_key='failed')

channel.queue_declare(
    queue='orders',
    durable=True,
    arguments={
        'x-dead-letter-exchange': 'dlx',
        'x-dead-letter-routing-key': 'failed'
    }
)
```

When a message in the `orders` queue is rejected (NACKed without
requeue) or expires, it's automatically routed to the `dead-letters`
queue via the `dlx` exchange.

### When Messages Are Dead-Lettered

```
DEAD LETTER TRIGGERS

  1. Message is REJECTED (basic_nack or basic_reject with requeue=false)
  2. Message TTL expires
  3. Queue max-length exceeded (overflow)

  The dead-lettered message carries headers showing:
  - x-death: why it was dead-lettered
  - x-first-death-reason: the original reason
  - x-first-death-queue: which queue it came from
  - x-first-death-exchange: which exchange it was in
```

---

## Poison Messages

A **poison message** is a message that can never be processed
successfully. No matter how many times you retry, it will always
fail. Common causes: malformed data, schema mismatch, missing
required fields.

```
POISON MESSAGE PROBLEM

  Without DLQ:
  Queue: [good] [POISON] [good] [good]
                    ^
                    |
  Consumer reads POISON
  --> fails
  --> requeued
  --> Consumer reads POISON again
  --> fails again
  --> requeued again
  --> INFINITE LOOP

  The poison message BLOCKS all messages behind it.
  This is called "head-of-line blocking."


  With DLQ:
  Queue: [good] [POISON] [good] [good]
                    |
                    v (after N retries)
              [Dead Letter Queue]

  Queue: [good] [good] [good]  (continues normally)
```

---

## Retry Strategies

Not every failure deserves a dead letter. Transient failures (network
timeout, service briefly down) should be retried. The question is
how.

### Immediate Retry

The simplest approach. Retry right away. Usually wrong.

```
IMMEDIATE RETRY (usually bad)

  Attempt 1: Call payment API --> timeout (API is overloaded)
  Attempt 2: Call payment API --> timeout (still overloaded)
  Attempt 3: Call payment API --> timeout (making it WORSE)

  You're hammering a struggling service.
  This turns a temporary problem into a permanent one.
```

### Fixed Delay Retry

Wait a fixed time between retries. Better, but not great.

```
FIXED DELAY RETRY

  Attempt 1: fail --> wait 5 seconds
  Attempt 2: fail --> wait 5 seconds
  Attempt 3: fail --> wait 5 seconds
  Attempt 4: success!

  Better, but if 1000 consumers all retry at the same intervals,
  they create "retry storms" that hit the downstream service
  in synchronized waves.
```

### Exponential Backoff

Double the wait time between each retry. The gold standard.

```
EXPONENTIAL BACKOFF

  Attempt 1: fail --> wait 1 second
  Attempt 2: fail --> wait 2 seconds
  Attempt 3: fail --> wait 4 seconds
  Attempt 4: fail --> wait 8 seconds
  Attempt 5: fail --> wait 16 seconds
  Attempt 6: fail --> DEAD LETTER (max retries exceeded)

  Each retry waits LONGER, giving the failing service
  more time to recover. Total wait: 31 seconds.
```

### Exponential Backoff with Jitter

Add randomness to prevent synchronized retries:

```
EXPONENTIAL BACKOFF WITH JITTER

  Base delay: 1 second, multiplier: 2

  Attempt 1: fail --> wait 1s * random(0.5, 1.5) = 0.7s
  Attempt 2: fail --> wait 2s * random(0.5, 1.5) = 2.3s
  Attempt 3: fail --> wait 4s * random(0.5, 1.5) = 3.1s
  Attempt 4: fail --> wait 8s * random(0.5, 1.5) = 11.2s

  Random jitter SPREADS retries across time.
  Prevents 1000 consumers from all retrying simultaneously.
```

```python
import time
import random

def process_with_retry(message, max_retries=5):
    for attempt in range(max_retries):
        try:
            process_message(message)
            return True
        except TransientError:
            if attempt == max_retries - 1:
                return False
            delay = (2 ** attempt) * (0.5 + random.random())
            time.sleep(delay)

    return False
```

---

## Implementing Retries with RabbitMQ

RabbitMQ doesn't have built-in retry delays. But you can implement
them using TTL and dead-letter chaining:

```
RETRY QUEUE PATTERN

  [Main Queue] --> Consumer FAILS --> [Retry Queue (TTL=5s)]
       ^                                      |
       |                                      v (after 5s)
       +---------- [Retry Exchange] ----------+

  The retry queue has a TTL. When messages expire,
  they're dead-lettered BACK to the main exchange.
  This creates a delay between retries.
```

```python
channel.exchange_declare(exchange='main', exchange_type='direct')
channel.exchange_declare(exchange='retry', exchange_type='direct')

channel.queue_declare(
    queue='main-queue',
    durable=True,
    arguments={
        'x-dead-letter-exchange': 'retry',
        'x-dead-letter-routing-key': 'retry'
    }
)

channel.queue_declare(
    queue='retry-queue',
    durable=True,
    arguments={
        'x-message-ttl': 5000,
        'x-dead-letter-exchange': 'main',
        'x-dead-letter-routing-key': 'main'
    }
)

channel.queue_bind(queue='main-queue', exchange='main', routing_key='main')
channel.queue_bind(queue='retry-queue', exchange='retry', routing_key='retry')
```

For exponential backoff, create multiple retry queues with
increasing TTLs:

```
MULTI-LEVEL RETRY

  [Main Queue] --> fail --> [Retry-1s Queue (TTL=1s)]
       ^                          |
       +--- expired ----<---------+
       |
       v --> fail again --> [Retry-5s Queue (TTL=5s)]
       ^                          |
       +--- expired ----<---------+
       |
       v --> fail again --> [Retry-30s Queue (TTL=30s)]
       ^                          |
       +--- expired ----<---------+
       |
       v --> fail AGAIN --> [Dead Letter Queue] (give up)
```

### Tracking Retry Count

Use message headers to track how many times a message has been
retried:

```python
def on_message(channel, method, properties, body):
    headers = properties.headers or {}
    retry_count = headers.get('x-retry-count', 0)

    try:
        process(body)
        channel.basic_ack(delivery_tag=method.delivery_tag)
    except TransientError:
        if retry_count >= 5:
            channel.basic_reject(delivery_tag=method.delivery_tag, requeue=False)
            return

        channel.basic_publish(
            exchange='retry',
            routing_key='retry',
            body=body,
            properties=pika.BasicProperties(
                headers={'x-retry-count': retry_count + 1},
                delivery_mode=2
            )
        )
        channel.basic_ack(delivery_tag=method.delivery_tag)
```

---

## Circuit Breaker Pattern

If a downstream service is completely down, retrying every message
is wasteful. The circuit breaker pattern stops trying entirely
when failure rates are too high.

```
CIRCUIT BREAKER STATES

  [CLOSED] -----> too many failures -----> [OPEN]
     ^                                        |
     |                                        |
  success rate                          timer expires
  recovers                                    |
     |                                        v
     +-------- test succeeds <---------- [HALF-OPEN]
               (close circuit)          (try one request)
               |
               +--- test fails --> [OPEN] (stay open)


  CLOSED:    Normal operation. Requests flow through.
  OPEN:      All requests fail immediately. Don't even try.
             Messages go to DLQ or are held for later.
  HALF-OPEN: Try ONE request. If it succeeds, close.
             If it fails, open again.
```

```python
import time

class CircuitBreaker:
    def __init__(self, failure_threshold=5, reset_timeout=30):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failure_count = 0
        self.state = 'CLOSED'
        self.last_failure_time = 0

    def can_execute(self):
        if self.state == 'CLOSED':
            return True
        if self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.reset_timeout:
                self.state = 'HALF_OPEN'
                return True
            return False
        if self.state == 'HALF_OPEN':
            return True
        return False

    def record_success(self):
        self.failure_count = 0
        self.state = 'CLOSED'

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'


payment_breaker = CircuitBreaker(failure_threshold=5, reset_timeout=30)

def process_payment(message):
    if not payment_breaker.can_execute():
        requeue_with_delay(message)
        return

    try:
        call_payment_api(message)
        payment_breaker.record_success()
    except Exception:
        payment_breaker.record_failure()
        requeue_with_delay(message)
```

---

## DLQ Processing: What to Do with Dead Letters

Dead letters need attention. Common approaches:

```
DLQ PROCESSING STRATEGIES

  1. MANUAL REVIEW
     Alert on-call engineer. They inspect the message,
     fix the issue, and replay it.

  2. AUTOMATIC REPLAY
     A scheduled job reads the DLQ every 5 minutes and
     moves messages back to the main queue.
     (Be careful: don't replay poison messages infinitely)

  3. FIX AND REPLAY
     Fix the consumer bug, deploy the fix, then replay
     all messages from the DLQ.

  4. COMPENSATING ACTION
     For messages that can't be reprocessed, trigger a
     compensating action (refund, notification, manual task).

  5. ARCHIVE
     Move to long-term storage for compliance or debugging.
     Some messages are informational — no action needed.
```

```python
def process_dead_letters():
    consumer = KafkaConsumer(
        'dead-letters',
        group_id='dlq-processor',
        bootstrap_servers=['localhost:9092']
    )

    for message in consumer:
        dead_letter = json.loads(message.value)

        if is_poison_message(dead_letter):
            archive_to_database(dead_letter)
            alert_team(dead_letter)
        elif is_transient_failure(dead_letter):
            republish_to_main_queue(dead_letter)
        else:
            create_support_ticket(dead_letter)
```

---

## Monitoring DLQs

A growing DLQ is a warning sign. Monitor these metrics:

```
DLQ HEALTH DASHBOARD

  +-------------------------+---------+---------------------------+
  | Metric                  | Alert   | Action                    |
  +-------------------------+---------+---------------------------+
  | DLQ message count       | > 100   | Investigate failures      |
  | DLQ growth rate         | > 10/min| Check consumer health     |
  | DLQ message age         | > 1 hour| Process or archive        |
  | Same message retried    | > 3x    | Likely poison message     |
  | DLQ has consumer        | No      | Set up DLQ processor      |
  +-------------------------+---------+---------------------------+
```

---

## Exercises

1. **Classify the failure**: For each scenario, is it a transient
   failure (retry) or a poison message (dead letter)?
   - Database connection timeout
   - JSON parse error
   - Payment API returns 500
   - Message missing required field "customer_id"
   - External service rate limit (429)

2. **Design the retry**: Build a retry system with 3 levels of
   backoff: 1s, 10s, 60s. After the third retry, messages go
   to a DLQ. Implement using RabbitMQ TTL queues.

3. **Circuit breaker**: Implement a circuit breaker that opens
   after 5 failures in 30 seconds, stays open for 60 seconds,
   then half-opens. Write tests for all state transitions.

4. **DLQ processing**: You have 500 messages in a DLQ from a bug
   that was just fixed. Write a script that: reads each message,
   validates it, republishes valid messages to the main queue,
   and archives invalid ones to a database.

---

[Next: Lesson 12 — Event-Driven Architecture](./12-event-driven-architecture.md)
