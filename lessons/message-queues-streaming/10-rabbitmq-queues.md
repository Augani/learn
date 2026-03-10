# Lesson 10: RabbitMQ Queues and Routing

> **The one thing to remember**: A RabbitMQ queue is like a post
> office box. Messages wait there until someone picks them up. You
> can make the box permanent (durable) or temporary (transient),
> set a time limit on uncollected mail (TTL), prioritize urgent
> letters, and redirect undeliverable mail (dead letter). The queue
> is where messages live until they're consumed.

---

## Queue Types

### Classic Queues

The original queue type. Messages are stored on a single node.
Fast and simple, but not replicated by default.

```python
channel.queue_declare(
    queue='task-queue',
    durable=True
)
```

### Quorum Queues (Recommended for Production)

Replicated across multiple nodes using the Raft consensus protocol.
Tolerates node failures without losing messages.

```python
channel.queue_declare(
    queue='orders',
    durable=True,
    arguments={
        'x-queue-type': 'quorum'
    }
)
```

### Lazy Queues

Store messages on disk instead of RAM. Use when you expect queues
to grow very large (millions of messages).

```python
channel.queue_declare(
    queue='bulk-imports',
    durable=True,
    arguments={
        'x-queue-mode': 'lazy'
    }
)
```

---

## Durable vs Transient

**Durable queues** survive broker restarts. The queue definition
is written to disk. But for messages to survive, they must also
be marked as **persistent**.

```
DURABILITY MATRIX

  +--------------------+------------------+--------------------+
  | Queue              | Message          | Survives Restart?  |
  +--------------------+------------------+--------------------+
  | Transient          | Transient        | NO (all lost)      |
  | Transient          | Persistent       | NO (queue is gone) |
  | Durable            | Transient        | Queue: YES         |
  |                    |                  | Messages: NO       |
  | Durable            | Persistent       | YES (both survive) |
  +--------------------+------------------+--------------------+

  For data safety: durable queue + persistent messages.
```

```python
channel.queue_declare(queue='important-tasks', durable=True)

channel.basic_publish(
    exchange='',
    routing_key='important-tasks',
    body=json.dumps({'task': 'process_payment'}),
    properties=pika.BasicProperties(
        delivery_mode=2
    )
)
```

`delivery_mode=2` marks the message as persistent. Without this,
the queue is durable but messages inside it are not.

---

## TTL (Time-To-Live)

TTL controls how long messages stay in a queue before being
automatically discarded or dead-lettered.

### Per-Queue TTL

Every message in the queue expires after the same duration:

```python
channel.queue_declare(
    queue='short-lived-tasks',
    durable=True,
    arguments={
        'x-message-ttl': 60000
    }
)
```

Messages expire after 60 seconds (60,000 milliseconds).

### Per-Message TTL

Each message has its own expiration:

```python
channel.basic_publish(
    exchange='',
    routing_key='tasks',
    body=json.dumps({'task': 'send_reminder'}),
    properties=pika.BasicProperties(
        expiration='30000'
    )
)
```

This specific message expires after 30 seconds.

```
TTL BEHAVIOR

  Queue with 60s TTL:

  t=0s:   [msg-1] [msg-2] [msg-3]     All fresh
  t=30s:  [msg-1] [msg-2] [msg-3]     Still alive
  t=60s:  [msg-2] [msg-3]             msg-1 expired (removed)
  t=90s:  [msg-3] [msg-4]             msg-2 expired, msg-4 arrived
  t=120s: [msg-4] [msg-5]             msg-3 expired

  Expired messages are either discarded or sent to a
  dead-letter exchange (if configured).
```

### Queue TTL

The queue itself can expire if unused for a period:

```python
channel.queue_declare(
    queue='temporary-queue',
    arguments={
        'x-expires': 1800000
    }
)
```

The queue auto-deletes after 30 minutes with no consumers and no
new messages.

---

## Priority Queues

Priority queues let you assign importance levels to messages.
Higher-priority messages are delivered before lower-priority ones.

```python
channel.queue_declare(
    queue='notifications',
    durable=True,
    arguments={
        'x-max-priority': 10
    }
)

channel.basic_publish(
    exchange='',
    routing_key='notifications',
    body=json.dumps({'type': 'marketing', 'content': 'Sale this weekend!'}),
    properties=pika.BasicProperties(priority=1)
)

channel.basic_publish(
    exchange='',
    routing_key='notifications',
    body=json.dumps({'type': 'security', 'content': 'Suspicious login detected'}),
    properties=pika.BasicProperties(priority=9)
)
```

```
PRIORITY QUEUE BEHAVIOR

  Queue contents (before delivery):
  [marketing, p=1] [promo, p=2] [security, p=9] [alert, p=8]

  Delivery order:
  1. security  (priority 9 - highest)
  2. alert     (priority 8)
  3. promo     (priority 2)
  4. marketing (priority 1 - lowest)

  NOTE: Priority is best-effort. Under light load, messages
  might be delivered in arrival order because they're consumed
  immediately. Priority matters most when the queue has backlog.
```

**Warning**: Priority queues use more CPU and memory. Only use
`x-max-priority` of 5-10. Higher values waste resources without
much benefit.

---

## Queue Arguments Reference

```
+---------------------+------------------+---------------------------+
| Argument            | Example Value    | What It Does              |
+---------------------+------------------+---------------------------+
| x-message-ttl       | 60000 (ms)       | Auto-expire messages      |
| x-expires           | 1800000 (ms)     | Auto-delete idle queue    |
| x-max-length        | 10000            | Max messages in queue     |
| x-max-length-bytes  | 1048576          | Max total bytes in queue  |
| x-max-priority      | 10               | Enable priority (1-255)   |
| x-overflow          | "reject-publish" | What to do when full      |
|                     | or "drop-head"   |                           |
| x-dead-letter-      | "dlx-exchange"   | Where dead letters go     |
|  exchange           |                  |                           |
| x-dead-letter-      | "dlq"            | Routing key for DLQ       |
|  routing-key        |                  |                           |
| x-queue-type        | "quorum"         | Queue implementation      |
| x-queue-mode        | "lazy"           | Store messages on disk    |
+---------------------+------------------+---------------------------+
```

---

## Advanced Routing Patterns

### Request/Reply Pattern

RabbitMQ supports RPC-style communication using temporary reply
queues.

```
REQUEST/REPLY PATTERN

  Client                    Server
  +--------+    Request     +--------+
  |        |----[queue]---->|        |
  |        |                |        |
  |        |<---[reply-q]---|        |
  +--------+    Response    +--------+

  1. Client creates exclusive, auto-delete reply queue
  2. Client sends message with reply_to=reply-queue-name
  3. Server processes request
  4. Server publishes response to the reply queue
  5. Client reads response from reply queue
```

```python
result = channel.queue_declare(queue='', exclusive=True)
callback_queue = result.method.queue

correlation_id = str(uuid.uuid4())

channel.basic_publish(
    exchange='',
    routing_key='rpc_queue',
    properties=pika.BasicProperties(
        reply_to=callback_queue,
        correlation_id=correlation_id,
    ),
    body=json.dumps({'action': 'get_price', 'product_id': 'SKU-001'})
)
```

### Exchange-to-Exchange Binding

Exchanges can be bound to other exchanges, creating routing chains:

```
EXCHANGE CHAINING

  Producer --> [Exchange A] ---binding---> [Exchange B] ---binding---> [Queue]
                   |                           |
                   |                     More specific
                General                  routing here
                routing

  Example:
  [all-events] --order.*--> [order-events] --order.error--> [error-queue]
                                           --order.*------> [order-queue]
```

### Alternate Exchange

When a message can't be routed (no matching binding), send it to
an alternate exchange instead of silently dropping it:

```python
channel.exchange_declare(
    exchange='primary',
    exchange_type='direct',
    arguments={
        'alternate-exchange': 'unrouted-messages'
    }
)

channel.exchange_declare(
    exchange='unrouted-messages',
    exchange_type='fanout'
)

channel.queue_declare(queue='unrouted-collector')
channel.queue_bind(
    queue='unrouted-collector',
    exchange='unrouted-messages'
)
```

Now any message that can't be routed by the `primary` exchange
ends up in `unrouted-collector` instead of being lost.

---

## Consumer Prefetch

By default, RabbitMQ pushes all available messages to consumers
as fast as possible. This can overwhelm slow consumers. **Prefetch**
limits how many unacknowledged messages a consumer can hold.

```
PREFETCH BEHAVIOR

  prefetch_count=1:
  Queue: [1] [2] [3] [4] [5]
  Consumer A: processing [1]     (can't get more until ACK)
  Consumer B: processing [2]     (can't get more until ACK)

  Consumer A finishes, ACKs [1]:
  Consumer A: processing [3]     (gets next message)

  This ensures even work distribution among slow and fast workers.


  prefetch_count=10:
  Consumer gets 10 messages at once, processes them,
  ACKs them. Higher throughput but less even distribution.
```

```python
channel.basic_qos(prefetch_count=1)

channel.basic_consume(
    queue='tasks',
    on_message_callback=process_task
)
```

**Guidance**:
- `prefetch_count=1`: Best for uneven processing times
- `prefetch_count=10-50`: Good for fast, uniform processing
- `prefetch_count=0` (unlimited): Only if consumers are always fast

---

## Monitoring Queues

RabbitMQ's management UI (port 15672) shows critical metrics.
You can also query them via API:

```bash
curl -u guest:guest http://localhost:15672/api/queues/%2F/orders | python -m json.tool
```

Key metrics to watch:

```
QUEUE HEALTH METRICS

  +--------------------+----------+-----------------------------------+
  | Metric             | Healthy  | Problem                           |
  +--------------------+----------+-----------------------------------+
  | messages_ready     | Low/0    | Growing = consumers too slow      |
  | messages_unacked   | Low      | Growing = consumers hanging       |
  | consumers          | >= 1     | 0 = nobody is processing          |
  | memory             | Stable   | Growing = queue backing up        |
  | message_rate_in    | Stable   | Spikes may need more consumers    |
  | message_rate_out   | >= in    | Out < in means falling behind     |
  +--------------------+----------+-----------------------------------+
```

---

## Exercises

1. **Design queues**: You're building a document processing system.
   PDFs take 30s, images take 2s, text files take 0.1s. Would you
   use one queue or separate queues? Would you use priority? What
   prefetch count for each worker type?

2. **TTL strategy**: Design a coupon system where promotional offers
   expire after 24 hours. If a coupon isn't claimed in time, it
   should be logged. Use TTL and dead letter exchanges.

3. **Overflow handling**: Your queue has `x-max-length=10000`. What
   happens when message 10,001 arrives with `x-overflow=drop-head`?
   What about `x-overflow=reject-publish`? When would you use each?

4. **Build the routing**: Set up a RabbitMQ topic exchange. Create
   bindings for: `log.error` -> error-queue, `log.#` -> all-logs,
   `order.*.error` -> order-errors. Publish 20 messages with
   various routing keys. Verify each queue received the correct
   messages.

---

[Next: Lesson 11 — Dead Letter Queues](./11-dead-letter-queues.md)
