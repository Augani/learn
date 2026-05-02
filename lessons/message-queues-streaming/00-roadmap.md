# Message Queues & Event Streaming

> **What this module covers**: How modern systems communicate without
> waiting for each other. From simple message queues to full event-driven
> architectures, you'll learn how Netflix processes millions of events,
> how banks ensure no transaction is lost, and how to build systems
> that scale to millions of users.

---

## Why Learn This?

Every large system eventually outgrows direct function calls. When
Service A needs to tell Service B something happened, you have two
choices: call it directly and wait (synchronous), or drop a message
in a queue and move on (asynchronous). This module teaches you the
second approach — and why it changes everything.

---

## Learning Path

### Foundations
- [ ] [01 — Why Async Messaging](./01-why-async-messaging.md)
- [ ] [02 — Queues vs Streams](./02-queues-vs-streams.md)
- [ ] [03 — Publish/Subscribe](./03-pub-sub.md)
- [ ] [04 — Point-to-Point Messaging](./04-point-to-point.md)

### Apache Kafka Deep Dive
- [ ] [05 — Kafka Architecture](./05-kafka-architecture.md)
- [ ] [06 — Kafka Producers & Consumers](./06-kafka-producers-consumers.md)
- [ ] [07 — Consumer Groups](./07-kafka-consumer-groups.md)
- [ ] [08 — Exactly-Once Semantics](./08-kafka-exactly-once.md)

### RabbitMQ Deep Dive
- [ ] [09 — RabbitMQ Architecture](./09-rabbitmq-architecture.md)
- [ ] [10 — RabbitMQ Queues & Routing](./10-rabbitmq-queues.md)

### Patterns & Architecture
- [ ] [11 — Dead Letter Queues](./11-dead-letter-queues.md)
- [ ] [12 — Event-Driven Architecture](./12-event-driven-architecture.md)
- [ ] [13 — Event Sourcing](./13-event-sourcing.md)
- [ ] [14 — CQRS](./14-cqrs.md)
- [ ] [15 — Stream Processing](./15-stream-processing.md)

### Capstone Project
- [ ] [16 — Build an Event-Driven Order System](./16-build-event-system.md)

### Quick References
- [ ] [Messaging Patterns Reference](./reference-patterns.md)
- [ ] [Tools Comparison Reference](./reference-tools.md)

---

## Prerequisites

You should be comfortable with:
- Basic programming (any language — examples use Python, Java, Go)
- What an API is and how HTTP requests work
- Basic understanding of databases (read/write data)

No prior messaging or streaming experience required.

---

## Recommended Reading

These books go deeper than this module can. If you want mastery,
these are the gold standard:

1. **Designing Data-Intensive Applications** by Martin Kleppmann
   (O'Reilly, 2017) — The single best book on distributed systems
   and data infrastructure. Covers replication, partitioning,
   stream processing, and batch processing with extraordinary clarity.

2. **Enterprise Integration Patterns** by Gregor Hohpe and Bobby Woolf
   (Addison-Wesley, 2003) — The definitive catalog of messaging patterns.
   Every pattern in this module traces back to this book. Still relevant
   two decades later.

3. **Kafka: The Definitive Guide** by Gwen Shapira, Todd Palino,
   Rajini Sivaram, and Krit Petty (O'Reilly, 2nd Edition 2021) —
   Everything about Kafka from the people who built it. Covers
   architecture, operations, and real-world deployment.

---

## How to Use This Module

1. **Read each lesson in order** — concepts build on each other
2. **Run the code examples** — reading code isn't the same as running it
3. **Do the exercises** — they're designed to expose misunderstandings
4. **Build the capstone** — it ties everything together

Estimated time: 20-30 hours for the full module.

---

[Start: Lesson 01 — Why Async Messaging](./01-why-async-messaging.md)
