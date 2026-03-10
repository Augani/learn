# Lesson 11: Message Queues — Decoupling with Async Communication

A user signs up for your app. You need to: send a welcome email, resize
their profile picture, create their account in a billing system, add
them to your analytics pipeline, and notify the sales team.

Do you make the user wait for ALL of that before showing "Account
Created"? Of course not. You put those tasks on a queue and respond
immediately. The tasks run in the background.

That's what message queues are for.

---

## The Analogy: Restaurant Kitchen

A restaurant doesn't work synchronously. The waiter doesn't walk to the
kitchen, stand there while the chef cooks, then bring food back. Instead:

1. **Waiter** (producer) writes the order on a ticket
2. **Ticket** goes on the rail (queue)
3. **Cook** (consumer) grabs tickets in order
4. If the kitchen is slammed, tickets stack up but none get lost
5. If a cook finishes one dish, they grab the next ticket
6. If a ticket is illegible, it goes to a "problem" pile (dead letter queue)

The waiter and cook are **decoupled**. The waiter doesn't need to know
which cook handles the order. The cook doesn't need to know which waiter
placed it. They communicate through the queue.

```
┌─────────┐     ┌─────────────────┐     ┌─────────┐
│ Waiter  │     │    Ticket Rail  │     │  Cook   │
│(Producer)│────►│     (Queue)     │────►│(Consumer)│
└─────────┘     └─────────────────┘     └─────────┘
                 Orders stack up         Grabs next
                 if kitchen is           ticket when
                 busy                    ready
```

---

## Why Async Matters

### Synchronous: Everything waits

```
User signup request ──► Create account (50ms)
                        ──► Send welcome email (200ms)
                            ──► Resize profile pic (500ms)
                                ──► Update billing (300ms)
                                    ──► Notify sales (100ms)
                                        ──► Return "Created"

Total response time: 1,150ms
If email service is down: ENTIRE signup fails
```

### Asynchronous with queues: Return immediately

```
User signup request ──► Create account (50ms)
                        ──► Queue: send email
                        ──► Queue: resize pic
                        ──► Queue: update billing
                        ──► Queue: notify sales
                        ──► Return "Created" (60ms)

Total response time: 60ms
If email service is down: email retries later, signup succeeds
```

The user's experience went from 1.15 seconds to 60 milliseconds. And
the system is more resilient — a downstream failure doesn't break the
critical path.

---

## Queue vs Topic: Two Distribution Models

### Queue (Point-to-Point)

One message goes to exactly ONE consumer. Like a work queue where tasks
are distributed among workers. Once a worker processes a message, it's
gone.

```
Producer ──► ┌─────────────────┐ ──► Consumer A (gets msg 1)
             │ Queue            │
Producer ──► │  [msg4][msg3]   │ ──► Consumer B (gets msg 2)
             │  [msg2][msg1]   │
             └─────────────────┘ ──► Consumer C (gets msg 3)

Each message processed by exactly one consumer.
Consumers compete for messages (competing consumers pattern).
```

**Use case**: Background job processing (image resize, PDF generation,
email sending). You want each job done once, not by every worker.

### Topic (Pub-Sub)

One message goes to ALL subscribers. Like a broadcast. Every interested
consumer gets a copy.

```
                              ┌──► Subscriber A (gets ALL messages)
                              │
Producer ──► ┌──────────┐ ───┼──► Subscriber B (gets ALL messages)
             │  Topic   │    │
             └──────────┘ ───┼──► Subscriber C (gets ALL messages)
                              │
                              └──► Subscriber D (gets ALL messages)
```

**Use case**: Event broadcasting. When an order is placed, the
inventory service, shipping service, analytics service, and notification
service ALL need to know.

### Consumer groups: The hybrid

Kafka and similar systems support consumer groups: within a group,
messages are distributed like a queue (one consumer per message). Across
groups, messages are broadcast like a topic.

```
                    ┌──► Consumer A1 ┐
                    │                │ Group A (each msg to ONE)
Topic ──► ┌─────┐ ─┼──► Consumer A2 ┘
          │     │  │
          │     │  ├──► Consumer B1 ┐
          └─────┘  │                │ Group B (each msg to ONE)
                   └──► Consumer B2 ┘

Every message reaches Group A AND Group B.
Within each group, messages are load-balanced.
```

---

## Delivery Guarantees

When a producer sends a message, what guarantee do you get that the
consumer actually processes it?

### At-most-once delivery

Fire and forget. Message might be lost, but will never be processed
twice.

```
Producer ──► Queue ──► Consumer
                       │
                       ├── Success: done
                       └── Failure: message lost forever

"I'll throw the ball. If you don't catch it, too bad."
```

**Use case**: Metrics, logging. Losing one data point is acceptable.
Processing it twice would skew numbers.

### At-least-once delivery

Message is guaranteed to be delivered, but might be delivered more than
once. Consumer must handle duplicates.

```
Producer ──► Queue ──► Consumer
                       │
                       ├── Success: ACK → message removed
                       └── Failure: no ACK → message redelivered
                                            ──► Consumer (again)

"I'll keep throwing until you catch one. You might catch two."
```

**Use case**: Most systems. Send an email (sending twice is annoying but
not catastrophic). Process a payment (MUST be idempotent — processing
twice must not charge twice).

### Exactly-once delivery

Each message processed exactly once. The holy grail, but extremely hard
to achieve in distributed systems. Most "exactly-once" systems are
actually "at-least-once with idempotent processing."

```
Producer ──► Queue ──► Consumer
                       │
                       ├── Deduplicate using message ID
                       ├── Process
                       └── ACK

"I'll keep throwing. You catch them all but only count unique ones."
```

**Use case**: Financial transactions. Kafka Streams provides exactly-once
semantics within its own processing, but only within Kafka's ecosystem.

### Making at-least-once feel like exactly-once

The practical approach: accept at-least-once delivery and make your
consumers **idempotent**.

```go
func ProcessPayment(ctx context.Context, db *sql.DB, msg PaymentMessage) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var exists bool
	err = tx.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM processed_messages WHERE id = $1)",
		msg.MessageID,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check duplicate: %w", err)
	}
	if exists {
		return nil
	}

	_, err = tx.ExecContext(ctx,
		"INSERT INTO payments (order_id, amount, status) VALUES ($1, $2, 'completed')",
		msg.OrderID, msg.Amount,
	)
	if err != nil {
		return fmt.Errorf("insert payment: %w", err)
	}

	_, err = tx.ExecContext(ctx,
		"INSERT INTO processed_messages (id, processed_at) VALUES ($1, NOW())",
		msg.MessageID,
	)
	if err != nil {
		return fmt.Errorf("record message: %w", err)
	}

	return tx.Commit()
}
```

The `processed_messages` table acts as a deduplication log. If the same
message arrives twice, the second attempt sees it's already processed
and returns immediately.

---

## Dead Letter Queues

What happens when a message can't be processed? Maybe the payload is
malformed, or a dependent service is permanently down, or there's a bug
in the consumer.

A dead letter queue (DLQ) catches messages that fail after N retries.

```
                                   Retry 1, 2, 3...
Producer ──► Main Queue ──► Consumer ──────────┐
                                               │ Failed N times
                                               ▼
                                    ┌───────────────────┐
                                    │ Dead Letter Queue  │
                                    │                   │
                                    │ Failed messages   │
                                    │ for investigation │
                                    └───────────────────┘
                                               │
                                    Alert team, manual review,
                                    fix bug, replay messages
```

DLQs prevent poison messages from blocking the queue forever. Without a
DLQ, one bad message stops all processing behind it (head-of-line
blocking).

---

## Backpressure

What happens when producers generate messages faster than consumers can
process them? The queue grows. Memory fills up. Eventually: crash.

**Backpressure** is the mechanism for slowing down producers when
consumers can't keep up.

```
Without backpressure:
  Producer (1000 msg/s) ──► Queue (growing!) ──► Consumer (100 msg/s)
                             ↑
                        Eventually: OOM

With backpressure:
  Producer (1000 msg/s) ──► Queue (full!) ──X── "Slow down!"
  Producer (100 msg/s)  ──► Queue (stable) ──► Consumer (100 msg/s)
```

### Backpressure strategies

| Strategy          | How it works                                |
|------------------|---------------------------------------------|
| Block producer    | Producer blocks until queue has space        |
| Drop messages     | Oldest or newest messages dropped            |
| Rate limit        | Producer throttled to N messages/sec         |
| Scale consumers   | Auto-scale consumers to match load           |
| Buffering         | Spill to disk when memory is full            |

---

## Popular Message Queue Systems

### RabbitMQ — The Traditional Queue

```
┌──────────────────────────────────────────────────────┐
│                    RabbitMQ                           │
│                                                      │
│  Producer ──► Exchange ──► Queue ──► Consumer         │
│                  │                                    │
│          Routing rules:                              │
│          - Direct: exact routing key match           │
│          - Fanout: broadcast to all queues           │
│          - Topic: pattern matching on routing key    │
└──────────────────────────────────────────────────────┘
```

**Strengths**: Flexible routing, mature protocol (AMQP), great for
task queues, built-in DLQ support, message acknowledgment, priority
queues.

**Weaknesses**: Single-node performance ceiling, complex clustering,
messages are deleted after consumption (not replayable).

**Use when**: Traditional job queues, complex routing needs, RPC-style
communication. Small to medium scale.

### Apache Kafka — The Distributed Log

Kafka isn't really a queue. It's a distributed, append-only log.
Messages are written to partitioned topics and retained for a
configurable period (hours, days, forever).

```
┌──────────────────────────────────────────────────────┐
│                    KAFKA TOPIC                        │
│                                                      │
│  Partition 0: [msg0][msg1][msg2][msg3][msg4]──►      │
│  Partition 1: [msg0][msg1][msg2]──►                  │
│  Partition 2: [msg0][msg1][msg2][msg3]──►            │
│                                                      │
│  Consumers track their position (offset).            │
│  Messages stay in the log.                           │
│  Multiple consumer groups read independently.        │
└──────────────────────────────────────────────────────┘
```

**Strengths**: Massive throughput (millions of messages/sec), messages
are durable and replayable, consumer groups, exactly-once semantics
within Kafka Streams, natural fit for event-driven architecture.

**Weaknesses**: Operational complexity (ZooKeeper dependency, now being
replaced by KRaft), overkill for simple task queues, higher latency
than RabbitMQ for individual messages.

**Use when**: Event streaming, high-throughput data pipelines, audit
logs, event sourcing, anything where you need to replay history.

### AWS SQS — Managed and Simple

```
┌──────────────────────────────────────────────────────┐
│                    AWS SQS                           │
│                                                      │
│  Standard Queue:                                     │
│  - At-least-once delivery                           │
│  - Best-effort ordering                             │
│  - Nearly unlimited throughput                       │
│                                                      │
│  FIFO Queue:                                         │
│  - Exactly-once processing                          │
│  - Strict ordering                                   │
│  - 3,000 msg/sec with batching                      │
└──────────────────────────────────────────────────────┘
```

**Strengths**: Zero ops (fully managed), scales automatically, pay per
message, integrates with all AWS services, built-in DLQ.

**Weaknesses**: AWS lock-in, polling-based (not push), 256 KB message
size limit, limited to AWS ecosystem.

**Use when**: You're on AWS and want a queue without operating one.
Background jobs, decoupling microservices.

### Redis Streams — Lightweight and Fast

Redis Streams adds log-based messaging to Redis. Lighter weight than
Kafka, more capable than simple pub-sub.

```
┌──────────────────────────────────────────────────────┐
│                    REDIS STREAMS                      │
│                                                      │
│  Stream: "orders"                                    │
│  ┌──────────────────────────────────────────┐        │
│  │ 1-0: {user: "alice", total: 59.99}      │        │
│  │ 2-0: {user: "bob", total: 24.50}        │        │
│  │ 3-0: {user: "charlie", total: 199.00}   │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  Consumer groups with acknowledgment                 │
│  Automatic ID generation (timestamp-based)           │
│  Capped streams (max length)                         │
└──────────────────────────────────────────────────────┘
```

**Strengths**: If you already have Redis, no new infrastructure.
Consumer groups, message acknowledgment, lightweight.

**Weaknesses**: Not as durable as Kafka (Redis persistence caveats),
limited throughput compared to Kafka, single-node bottleneck.

**Use when**: Small to medium scale messaging, you already run Redis,
you need something between pub-sub and a full message broker.

### Comparison matrix

```
┌──────────────┬───────────┬───────────┬──────────┬──────────┐
│              │ RabbitMQ  │  Kafka    │ AWS SQS  │ Redis    │
│              │           │           │          │ Streams  │
├──────────────┼───────────┼───────────┼──────────┼──────────┤
│ Throughput   │  ~50K/s   │  ~1M/s   │ ~∞ (std) │  ~100K/s │
│ Latency      │  ~1ms     │  ~5ms    │ ~20ms    │  <1ms    │
│ Replay       │  No       │  Yes     │  No      │  Yes     │
│ Ordering     │  Yes      │  Per     │  FIFO    │  Yes     │
│              │           │  partition│  only    │          │
│ Ops burden   │  Medium   │  High    │  None    │  Low     │
│ Max msg size │  ~128MB   │  1MB     │  256KB   │  ~512MB  │
│ DLQ          │  Built-in │  Manual  │ Built-in │  Manual  │
│ Best for     │  Tasks    │  Events  │  AWS jobs│  Light   │
│              │           │  streams │          │  queues  │
└──────────────┴───────────┴───────────┴──────────┴──────────┘
```

---

## Go Example: Producer/Consumer with NATS

NATS is a lightweight, high-performance messaging system popular in the
Go ecosystem. Simple to set up, easy to understand.

### Producer

```go
package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
)

type OrderEvent struct {
	OrderID   string    `json:"order_id"`
	UserID    string    `json:"user_id"`
	Total     float64   `json:"total"`
	CreatedAt time.Time `json:"created_at"`
}

func main() {
	nc, err := nats.Connect(nats.DefaultURL)
	if err != nil {
		panic(fmt.Sprintf("connect to NATS: %v", err))
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		panic(fmt.Sprintf("create JetStream context: %v", err))
	}

	_, err = js.AddStream(&nats.StreamConfig{
		Name:      "ORDERS",
		Subjects:  []string{"orders.>"},
		Retention: nats.WorkQueuePolicy,
		MaxAge:    24 * time.Hour,
	})
	if err != nil {
		panic(fmt.Sprintf("create stream: %v", err))
	}

	event := OrderEvent{
		OrderID:   "ord_abc123",
		UserID:    "usr_456",
		Total:     59.99,
		CreatedAt: time.Now(),
	}

	data, err := json.Marshal(event)
	if err != nil {
		panic(fmt.Sprintf("marshal event: %v", err))
	}

	ack, err := js.Publish("orders.created", data)
	if err != nil {
		panic(fmt.Sprintf("publish: %v", err))
	}

	fmt.Printf("Published order event, seq: %d\n", ack.Sequence)
}
```

### Consumer

```go
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/nats-io/nats.go"
)

func main() {
	nc, err := nats.Connect(nats.DefaultURL)
	if err != nil {
		panic(fmt.Sprintf("connect to NATS: %v", err))
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		panic(fmt.Sprintf("create JetStream context: %v", err))
	}

	sub, err := js.QueueSubscribe("orders.created", "email-workers",
		func(msg *nats.Msg) {
			var event OrderEvent
			if err := json.Unmarshal(msg.Data, &event); err != nil {
				fmt.Printf("bad message, sending to DLQ: %v\n", err)
				msg.Ack()
				return
			}

			fmt.Printf("Sending welcome email for order %s (user: %s, total: $%.2f)\n",
				event.OrderID, event.UserID, event.Total)

			if err := sendEmail(event); err != nil {
				fmt.Printf("email failed, will retry: %v\n", err)
				msg.Nak()
				return
			}

			msg.Ack()
		},
		nats.Durable("email-processor"),
		nats.ManualAck(),
		nats.AckWait(30*1000*1000*1000),
		nats.MaxDeliver(5),
	)
	if err != nil {
		panic(fmt.Sprintf("subscribe: %v", err))
	}
	defer sub.Unsubscribe()

	fmt.Println("Consumer running. Press Ctrl+C to stop.")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
}

func sendEmail(event OrderEvent) error {
	fmt.Printf("  → Email sent to user %s for order %s\n",
		event.UserID, event.OrderID)
	return nil
}
```

---

## Architecture Patterns

### Pattern 1: Work queue (fan-out)

Multiple workers process tasks from a shared queue. Tasks are
distributed evenly. Good for CPU-intensive background jobs.

```
                    ┌──────────────┐
Producer ──────────►│    Queue     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │Worker 1│  │Worker 2│  │Worker 3│
         └────────┘  └────────┘  └────────┘
```

### Pattern 2: Event fan-out (pub-sub)

One event triggers multiple independent actions. Each service gets its
own copy and processes independently.

```
                          ┌────► Email Service
                          │
"Order Created" ──► Topic ├────► Inventory Service
                          │
                          ├────► Analytics Service
                          │
                          └────► Shipping Service
```

### Pattern 3: Request-reply

Use a message queue for async RPC. Producer sends a request with a
reply-to address. Consumer processes and sends response back.

```
Service A ──[request]──► Queue ──► Service B
    ▲                                  │
    └──────[response]──── Queue ◄──────┘
```

### Pattern 4: Priority queue

Different priorities get different queues. High-priority consumers are
faster or have more workers.

```
              ┌──► High Priority Queue ──► 5 workers (fast)
              │
Dispatcher ───┼──► Normal Queue ────────► 2 workers
              │
              └──► Low Priority Queue ──► 1 worker (slow)
```

---

## When to Use Which Queue

```
Decision tree:

Need message replay / event log?
├── YES → Kafka
└── NO
    ├── On AWS and want zero ops?
    │   └── YES → SQS
    ├── Need complex routing (headers, patterns)?
    │   └── YES → RabbitMQ
    ├── Already running Redis, small scale?
    │   └── YES → Redis Streams
    ├── Go ecosystem, need simplicity + speed?
    │   └── YES → NATS
    └── Default → Start with SQS (if AWS) or RabbitMQ
```

---

## Common Mistakes

### Mistake 1: Not handling consumer failures

If your consumer crashes mid-processing without acknowledging, the
message must be redelivered. Always use manual acknowledgment and ensure
your processing is idempotent.

### Mistake 2: Putting too much in the message

Messages should be small pointers, not large payloads. Don't put a 50MB
image in a message. Put the image in S3 and put the S3 URL in the
message.

```
BAD:  { "image": "<base64 encoded 50MB image>" }
GOOD: { "image_url": "s3://bucket/uploads/abc123.jpg" }
```

### Mistake 3: No dead letter queue

Without a DLQ, poison messages block your queue forever. Always
configure max retries and a DLQ for failed messages.

### Mistake 4: Ignoring ordering

Most queues don't guarantee ordering across partitions. If message B
depends on message A being processed first, you need to ensure they go
to the same partition (use the same partition key).

### Mistake 5: Using a queue when you don't need one

Not every inter-service call needs a queue. If the caller needs an
immediate response (like a user login check), use a direct HTTP/gRPC
call. Queues add latency and complexity. Use them for truly async work.

---

## Key Takeaways

1. **Message queues decouple producers and consumers.** The producer
   doesn't wait for the consumer. The consumer doesn't need the producer
   to be alive.

2. **Queue (point-to-point) vs Topic (pub-sub).** Queue for work
   distribution, topic for event broadcasting.

3. **At-least-once + idempotent consumers** is the practical standard.
   True exactly-once is nearly impossible across systems.

4. **Dead letter queues** catch poison messages. Always configure them.

5. **Backpressure** prevents queues from growing unbounded. Have a
   strategy before you need one.

6. **Kafka for event streaming** (replay, high throughput). **RabbitMQ
   for task queues** (routing, priorities). **SQS for managed
   simplicity**. **NATS/Redis for lightweight** needs.

7. **Keep messages small.** Pointer to data, not the data itself.

8. **Don't use queues for synchronous needs.** If the caller needs an
   immediate answer, use a direct call.

Next: [Lesson 12 — Event-Driven Architecture: Events, Streams, and CQRS](./12-event-driven.md)
