# Reference: Messaging Patterns

> Quick reference for the most common messaging patterns. Each
> pattern includes when to use it, how it works, and a typical
> implementation approach.

---

## Point-to-Point (Competing Consumers)

```
PATTERN: One message, one consumer

  Producer --> [Queue] --> Consumer A
                           Consumer B (waiting)
                           Consumer C (waiting)

  Each message goes to exactly one consumer.
  Consumers compete for messages.
```

**When to use**: Task distribution, background jobs, work queues.
Send an email, process an image, run a report.

**Implementation**: RabbitMQ direct queue, SQS, Kafka consumer group.

---

## Publish/Subscribe (Fan-Out)

```
PATTERN: One message, all subscribers get a copy

  Producer --> [Topic] --> Consumer A (gets copy)
                       --> Consumer B (gets copy)
                       --> Consumer C (gets copy)
```

**When to use**: Event notification, broadcasting changes.
Order placed, user registered, config changed.

**Implementation**: Kafka topics, RabbitMQ fanout exchange, SNS.

---

## Request/Reply

```
PATTERN: Synchronous-style RPC over async messaging

  Client --> [Request Queue] --> Server
  Client <-- [Reply Queue]   <-- Server

  Client sends request with reply_to address.
  Server processes and sends response to reply queue.
  Client correlates using correlation_id.
```

**When to use**: When you need a response but want to decouple
via messaging. Pricing lookups, validation checks.

**Implementation**: RabbitMQ with exclusive reply queues and
correlation IDs.

---

## Saga (Choreography)

```
PATTERN: Distributed transaction via events

  Service A publishes event -->
    Service B reacts, publishes event -->
      Service C reacts, publishes event

  On failure at any step:
    Compensating events undo previous steps
```

**When to use**: Multi-service transactions where you can't use
a single database transaction. Order processing, booking systems.

**Implementation**: Each service listens for events and publishes
results. Compensating events undo completed steps on failure.

---

## Saga (Orchestration)

```
PATTERN: Centralized coordinator for distributed transactions

  Orchestrator --> Command --> Service A --> Response
  Orchestrator --> Command --> Service B --> Response
  Orchestrator --> Command --> Service C --> Response

  Orchestrator tracks state and handles failures.
```

**When to use**: Same as choreography saga, but when you want
clear visibility into the process state. Complex workflows with
many steps and conditions.

**Implementation**: State machine or workflow engine. Sends
commands and waits for responses. Tracks progress in a database.

---

## Dead Letter Queue

```
PATTERN: Failed messages go to a separate queue

  [Main Queue] --> Consumer --> FAIL
                      |
                      v
              [Dead Letter Queue] --> Investigate / Retry
```

**When to use**: Always. Every production queue should have a DLQ.
Prevents message loss and infinite retry loops.

**Implementation**: RabbitMQ dead letter exchange, Kafka DLQ topic,
SQS dead letter queue.

---

## Content-Based Router

```
PATTERN: Route messages based on content

  Message { type: "pdf" } --> [PDF Queue]
  Message { type: "csv" } --> [CSV Queue]
  Message { type: "xml" } --> [XML Queue]
```

**When to use**: When different message types need different
processing. Different document formats, priority levels, regions.

**Implementation**: RabbitMQ topic/headers exchange, custom routing
logic in consumer, AWS EventBridge rules.

---

## Message Filter

```
PATTERN: Drop messages that don't match criteria

  All messages --> [Filter: region = "US"] --> US-only consumer
                   Messages from EU, APAC are dropped/ignored.
```

**When to use**: When a consumer only cares about a subset of
messages. Regional processing, priority filtering.

**Implementation**: Consumer-side filtering, RabbitMQ binding keys,
Kafka Streams filter(), SNS filter policies.

---

## Splitter

```
PATTERN: Break one message into multiple messages

  Message: { order with 5 items }
      |
      v
  [Splitter]
      |
      +--> { item 1 }
      +--> { item 2 }
      +--> { item 3 }
      +--> { item 4 }
      +--> { item 5 }
```

**When to use**: When a message contains a collection and each
element needs independent processing. Order items, batch records.

**Implementation**: Consumer reads one message, publishes N
messages (one per element).

---

## Aggregator

```
PATTERN: Combine multiple messages into one

  { item 1 result } --+
  { item 2 result } --+--> [Aggregator] --> { combined order result }
  { item 3 result } --+

  Waits for all expected messages, then emits combined result.
```

**When to use**: When you split messages and need to combine
results. Order completion (all items shipped), batch processing.

**Implementation**: Stateful consumer that tracks received messages
by correlation ID and emits when complete. Use timeouts for
missing messages.

---

## Claim Check

```
PATTERN: Store large payloads separately

  Producer:
  1. Upload 50MB file to S3
  2. Send message: { "file_ref": "s3://bucket/file.pdf" }

  Consumer:
  1. Receive message with reference
  2. Download file from S3
  3. Process file
```

**When to use**: When messages would be too large for the broker.
File processing, large documents, media files.

**Implementation**: Store payload in S3/blob storage. Put reference
in the message.

---

## Event Sourcing

```
PATTERN: Store events, derive state

  Events: [Created] [Updated] [Updated] [Shipped]
      |
      v
  Current State: { status: "shipped", ... }

  State is always derivable from events.
  Events are the source of truth.
```

**When to use**: Audit requirements, temporal queries, complex
domain logic where history matters.

**Implementation**: Append-only event store (Kafka, EventStoreDB,
custom). Projections for read models.

---

## CQRS

```
PATTERN: Separate read and write models

  Commands --> [Write Model] --> Events --> [Read Model] --> Queries

  Write: optimized for consistency and validation
  Read: optimized for query performance
```

**When to use**: When read and write patterns are very different.
High-read systems, complex queries, multiple view requirements.

**Implementation**: Write to a normalized database, publish events,
build denormalized read models (potentially in different databases).

---

## Outbox Pattern

```
PATTERN: Reliable event publishing with database transactions

  1. Write to database AND outbox table in one transaction
  2. Background process reads outbox, publishes to message broker
  3. Mark outbox entries as published

  Database:
  +-- orders table (business data) --+  SINGLE
  +-- outbox table (events to send) -+  TRANSACTION

  Outbox relay:
  [outbox table] --> read --> [Kafka] --> mark as sent
```

**When to use**: When you need to update a database AND publish
an event atomically. Prevents the dual-write problem (database
updated but event not published, or vice versa).

**Implementation**: Debezium CDC, custom polling relay, or
transaction log tailing.

---

## Pattern Selection Guide

```
+---------------------------+----------------------------------+
| Need                      | Pattern                          |
+---------------------------+----------------------------------+
| Distribute work           | Competing Consumers              |
| Notify multiple services  | Publish/Subscribe                |
| Multi-step transaction    | Saga (Choreography/Orchestration)|
| Handle failures           | Dead Letter Queue + Retry        |
| Full audit trail          | Event Sourcing                   |
| Fast reads, safe writes   | CQRS                             |
| Large payloads            | Claim Check                      |
| Route by content          | Content-Based Router             |
| Reliable event publishing | Outbox Pattern                   |
| Break up batch messages   | Splitter                         |
| Combine related messages  | Aggregator                       |
+---------------------------+----------------------------------+
```
