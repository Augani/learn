# Lesson 09: RabbitMQ Architecture

> **The one thing to remember**: RabbitMQ is a post office. When you
> send a letter, you don't throw it directly at someone's house.
> You put it in a mailbox, the post office sorts it (exchange), then
> routes it to the right mailbox (queue) based on the address
> (routing key). RabbitMQ is a smart broker — it does the routing
> work so your applications don't have to.

---

## Kafka vs RabbitMQ: Different Philosophies

Before diving in, understand the fundamental difference:

**Kafka** is a dumb pipe with smart endpoints. The broker just stores
messages in a log. Consumers track their own position. The broker
does minimal routing.

**RabbitMQ** is a smart broker with simple endpoints. The broker
routes messages, manages queues, handles acknowledgments, and even
transforms messages. Producers and consumers are simpler.

```
KAFKA: "I just store messages. You figure out the rest."
  Producer --> [Append to log] --> Consumer pulls when ready

RABBITMQ: "Tell me where you want it. I'll handle delivery."
  Producer --> [Exchange] --> [Routing] --> [Queue] --> Push to consumer
```

Neither is "better." They solve different problems.

---

## The AMQP Protocol

RabbitMQ implements **AMQP** (Advanced Message Queuing Protocol),
an open standard for messaging. AMQP defines three core concepts:

```
AMQP MODEL

  Producer ---> Exchange ---> Binding ---> Queue ---> Consumer
                   |             |           |
                   |     "routing rules"     |
                   |                         |
            Receives messages          Stores messages
            and routes them            until consumed
```

1. **Exchange**: Receives messages from producers. Decides which
   queues should get copies. Never stores messages itself.

2. **Queue**: Stores messages. Delivers them to consumers. This is
   where messages wait.

3. **Binding**: A rule connecting an exchange to a queue. Says
   "messages matching THIS pattern go to THAT queue."

---

## Exchanges: The Sorting Office

The exchange is the heart of RabbitMQ's routing. A producer never
sends directly to a queue. It always sends to an exchange, which
decides where the message goes.

### Direct Exchange

Routes messages to queues where the routing key exactly matches
the binding key. Like addressing a letter to a specific person.

```
DIRECT EXCHANGE

  Producer sends: routing_key="payment.success"

                    +------------------+
                    | Direct Exchange  |
  msg ------------>|                  |
  key="payment     | Bindings:        |
   .success"       | payment.success  |---> [payment-queue]
                   | payment.failed   |---> [error-queue]
                   | order.created    |---> [order-queue]
                   +------------------+

  Only the payment-queue gets this message (exact match).
```

```python
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

channel.exchange_declare(exchange='payments', exchange_type='direct')
channel.queue_declare(queue='payment-success-handler')
channel.queue_bind(
    queue='payment-success-handler',
    exchange='payments',
    routing_key='payment.success'
)

channel.basic_publish(
    exchange='payments',
    routing_key='payment.success',
    body=json.dumps({'order_id': 'ord-789', 'amount': 59.99})
)
```

### Topic Exchange

Routes based on pattern matching with wildcards. Like subscribing
to all mail from a certain zip code.

```
TOPIC EXCHANGE

  Wildcard rules:
    *  matches exactly one word
    #  matches zero or more words

  Bindings:
    "order.*"       --> [order-queue]      (any order event)
    "*.error"       --> [error-queue]      (errors from any service)
    "payment.#"     --> [payment-queue]    (all payment events)
    "#"             --> [audit-queue]      (EVERYTHING)

  Examples:
    "order.created"   --> order-queue, audit-queue
    "order.error"     --> order-queue, error-queue, audit-queue
    "payment.success" --> payment-queue, audit-queue
    "payment.retry.3" --> payment-queue, audit-queue
    "user.created"    --> audit-queue only
```

```python
channel.exchange_declare(exchange='events', exchange_type='topic')

channel.queue_bind(
    queue='order-processor',
    exchange='events',
    routing_key='order.*'
)

channel.queue_bind(
    queue='error-handler',
    exchange='events',
    routing_key='*.error'
)

channel.queue_bind(
    queue='audit-log',
    exchange='events',
    routing_key='#'
)
```

### Fanout Exchange

Ignores routing keys completely. Sends a copy of every message to
every bound queue. Pure broadcast.

```
FANOUT EXCHANGE

  Producer sends: (routing key is ignored)

                    +------------------+
                    | Fanout Exchange  |
  msg ------------>|                  |
                   | Queues bound:    |
                   |   queue-A ------+--> [queue-A] (gets copy)
                   |   queue-B ------+--> [queue-B] (gets copy)
                   |   queue-C ------+--> [queue-C] (gets copy)
                   +------------------+

  EVERY bound queue gets EVERY message. No filtering.
```

```python
channel.exchange_declare(exchange='notifications', exchange_type='fanout')

channel.basic_publish(
    exchange='notifications',
    routing_key='',
    body=json.dumps({
        'type': 'system_alert',
        'message': 'Database maintenance in 30 minutes'
    })
)
```

### Headers Exchange

Routes based on message headers instead of routing keys. Like
sorting mail by the special handling stickers rather than the
address.

```
HEADERS EXCHANGE

  Message headers: { "format": "pdf", "priority": "high" }

  Binding on queue-A: match ALL of { "format": "pdf", "priority": "high" }
  Binding on queue-B: match ANY of { "format": "pdf", "priority": "high" }
  Binding on queue-C: match ALL of { "format": "csv" }

  Message goes to: queue-A (both match), queue-B (at least one matches)
  NOT queue-C (format doesn't match)
```

```python
channel.exchange_declare(exchange='reports', exchange_type='headers')

channel.queue_bind(
    queue='pdf-processor',
    exchange='reports',
    arguments={
        'x-match': 'all',
        'format': 'pdf',
        'priority': 'high'
    }
)
```

---

## Exchange Type Comparison

```
+----------+------------------+-------------------+------------------+
| Type     | Routing          | Use Case          | Performance      |
+----------+------------------+-------------------+------------------+
| Direct   | Exact match on   | Point-to-point,   | Fastest          |
|          | routing key      | RPC-style calls   |                  |
+----------+------------------+-------------------+------------------+
| Topic    | Pattern match    | Event routing,    | Fast             |
|          | with wildcards   | flexible dispatch |                  |
+----------+------------------+-------------------+------------------+
| Fanout   | Ignores routing  | Broadcast to all  | Very fast        |
|          | key entirely     | subscribers       | (no matching)    |
+----------+------------------+-------------------+------------------+
| Headers  | Match on message | Complex routing   | Slowest          |
|          | header values    | by metadata       | (header parsing) |
+----------+------------------+-------------------+------------------+
```

---

## The Full Architecture

```
RABBITMQ ARCHITECTURE

  +------------------------------------------------------------------+
  |                      RabbitMQ Broker                              |
  |                                                                  |
  |  Producer -----> [Exchange] ----binding----> [Queue] ----> Consumer
  |                      |                         |                 |
  |                      |       +-- binding ---> [Queue] ----> Consumer
  |                      |       |                 |                 |
  |  Producer -----> [Exchange] -+                 |                 |
  |                      |       |                 |                 |
  |                      |       +-- binding ---> [Queue] ----> Consumer
  |                      |                                          |
  |  +----------------------------------------------------------+   |
  |  |                  Virtual Host (vhost)                     |   |
  |  |  Isolation boundary: separate exchanges, queues, users    |   |
  |  |  Like a database schema — same server, separate namespaces|   |
  |  +----------------------------------------------------------+   |
  |                                                                  |
  |  Connection:  TCP connection from client to broker               |
  |  Channel:     Lightweight virtual connection within a connection |
  |               (multiplexed over one TCP connection)              |
  +------------------------------------------------------------------+
```

### Connections and Channels

A **connection** is a TCP connection between your application and
RabbitMQ. Creating TCP connections is expensive, so RabbitMQ uses
**channels** — lightweight virtual connections multiplexed over
a single TCP connection.

```
CONNECTION vs CHANNEL

  Your Application           RabbitMQ Broker
  +--------------+           +--------------+
  |              |           |              |
  | Thread 1 ----Channel 1--|-->           |
  |              |           |              |
  | Thread 2 ----Channel 2--|-->           |
  |              |  (one     |              |
  | Thread 3 ----Channel 3--|-->  TCP      |
  |              |  connection)             |
  +--------------+           +--------------+

  One TCP connection, multiple channels.
  Each thread gets its own channel.
  Channels are NOT thread-safe — one per thread.
```

### Virtual Hosts (vhosts)

Virtual hosts provide logical separation within a single RabbitMQ
instance. Each vhost has its own exchanges, queues, bindings, and
permissions. Think of them like schemas in a database.

```
VIRTUAL HOSTS

  RabbitMQ Server
  +------------------------------------------+
  |                                          |
  |  vhost: /production                      |
  |  +------------------------------------+  |
  |  | exchanges: orders, payments, users |  |
  |  | queues: order-q, payment-q, user-q |  |
  |  | users: app-prod (full access)      |  |
  |  +------------------------------------+  |
  |                                          |
  |  vhost: /staging                         |
  |  +------------------------------------+  |
  |  | exchanges: orders, payments        |  |
  |  | queues: order-q, payment-q         |  |
  |  | users: app-staging (full access)   |  |
  |  +------------------------------------+  |
  |                                          |
  |  vhost: /development                     |
  |  +------------------------------------+  |
  |  | exchanges: test-exchange           |  |
  |  | queues: test-queue                 |  |
  |  | users: dev-team (full access)      |  |
  |  +------------------------------------+  |
  |                                          |
  +------------------------------------------+
```

---

## Message Flow: End to End

Let's trace a message from producer to consumer:

```
COMPLETE MESSAGE FLOW

  1. Producer creates a message
     { "order_id": "789", "action": "created" }

  2. Producer publishes to exchange "events"
     with routing_key "order.created"

  3. Exchange "events" (type: topic) checks bindings:
     - "order.*" --> order-queue         MATCH
     - "payment.*" --> payment-queue     NO MATCH
     - "#" --> audit-queue               MATCH

  4. Exchange copies message to:
     - order-queue
     - audit-queue

  5. Consumers pull from their queues:
     - Order service reads from order-queue
     - Audit service reads from audit-queue

  6. After processing, each consumer sends ACK
     - RabbitMQ removes the message from that queue
```

---

## Clustering and High Availability

RabbitMQ can run as a cluster of multiple nodes for reliability.

```
RABBITMQ CLUSTER

  +--------+     +--------+     +--------+
  | Node 1 |<--->| Node 2 |<--->| Node 3 |
  +--------+     +--------+     +--------+

  Metadata (exchange definitions, bindings, vhosts)
  is replicated to ALL nodes automatically.

  Queue data is on ONE node by default.
  For HA, you configure queue mirroring or use quorum queues.
```

**Quorum queues** (recommended for production) use the Raft
consensus algorithm to replicate queue contents across multiple
nodes. If the leader node fails, a follower takes over.

```
QUORUM QUEUE

  Node 1: [Leader]    order-queue  <-- writes go here
  Node 2: [Follower]  order-queue  <-- replicates from leader
  Node 3: [Follower]  order-queue  <-- replicates from leader

  If Node 1 dies:
  Node 2: [NEW Leader] order-queue  <-- automatic failover
  Node 3: [Follower]   order-queue

  No messages lost. Automatic recovery.
```

---

## Exercises

1. **Design the routing**: You have an e-commerce system with these
   events: order.created, order.shipped, order.cancelled,
   payment.success, payment.failed, user.registered. Design
   exchanges and bindings so that: the order service gets all order
   events, the analytics service gets everything, and the alert
   service gets only failures.

2. **Exchange type selection**: For each scenario, which exchange
   type would you use?
   - Sending a task to one of many workers
   - Broadcasting a cache invalidation to all services
   - Routing logs by severity (error, warning, info)
   - Routing documents by format AND language

3. **Connection efficiency**: Your application has 50 threads
   producing messages. Should you create 50 TCP connections or 50
   channels? Why? What's the cost of each approach?

4. **Build it**: Using Docker, set up RabbitMQ with the management
   plugin. Create a topic exchange with three queues. Publish
   messages with different routing keys and verify the routing
   through the management UI.

---

[Next: Lesson 10 — RabbitMQ Queues & Routing](./10-rabbitmq-queues.md)
