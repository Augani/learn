# Lesson 28: Idempotency and Exactly-Once Semantics

Networks fail. Clients retry. Servers crash mid-response. Without
idempotency, a user clicking "Pay" twice gets charged twice. A retry
after a timeout creates duplicate orders. This lesson is about making
sure things happen exactly once.

**Analogy:** You mail a letter to your bank asking them to transfer
$500. The letter gets lost, so you send another copy. Without
idempotency, the bank transfers $1000. With idempotency, the bank
checks: "We already processed transfer #4472. Ignoring the duplicate."
The letter has a unique ID, and the bank remembers what it already did.

---

## The Duplicate Problem

```
SCENARIO: Client pays for an order

  ┌────────┐  1. POST /pay  ┌──────────┐
  │ Client │───────────────▶│  Server  │──▶ charges $50
  └────────┘                └──────────┘
       │                         │
       │  2. Response lost       │  (server DID process it)
       │     (network timeout)   │
       │                         │
       │  3. Client retries!     │
  ┌────────┐  POST /pay     ┌──────────┐
  │ Client │───────────────▶│  Server  │──▶ charges $50 AGAIN
  └────────┘                └──────────┘

  User charged $100 instead of $50. Very bad.
```

This happens more often than you think:

```
Causes of duplicate requests:
  - Network timeout → client retries
  - Load balancer retry → backend got it twice
  - User double-clicks button
  - Mobile app retry on network switch (WiFi → cellular)
  - Message queue redelivery after consumer crash
  - Webhook retry from payment provider
```

---

## Idempotency Keys

The solution: every mutating request includes a **unique idempotency key**.
The server stores the result of each key and returns the cached result for
duplicates.

```
Request 1 (first attempt):
  POST /api/v1/payments
  Idempotency-Key: "idk_abc123"
  Body: { "amount": 50, "currency": "USD" }

  Server: key "idk_abc123" not seen before
          → process payment
          → store: idk_abc123 → {status: 200, body: {payment_id: "pay_789"}}
          → return 200

Request 2 (retry, same key):
  POST /api/v1/payments
  Idempotency-Key: "idk_abc123"
  Body: { "amount": 50, "currency": "USD" }

  Server: key "idk_abc123" already exists
          → return CACHED response: 200, {payment_id: "pay_789"}
          → NO second charge
```

### Implementation in Go

```go
package idempotency

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type CachedResponse struct {
	StatusCode int             `json:"status_code"`
	Body       json.RawMessage `json:"body"`
	CreatedAt  time.Time       `json:"created_at"`
}

type IdempotencyStore struct {
	client *redis.Client
	ttl    time.Duration
}

func NewIdempotencyStore(client *redis.Client, ttl time.Duration) *IdempotencyStore {
	return &IdempotencyStore{client: client, ttl: ttl}
}

func (s *IdempotencyStore) Check(ctx context.Context, key string) (*CachedResponse, error) {
	data, err := s.client.Get(ctx, "idemp:"+key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("check idempotency key: %w", err)
	}
	var resp CachedResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal cached response: %w", err)
	}
	return &resp, nil
}

func (s *IdempotencyStore) Store(ctx context.Context, key string, resp CachedResponse) error {
	data, err := json.Marshal(resp)
	if err != nil {
		return fmt.Errorf("marshal response: %w", err)
	}
	return s.client.Set(ctx, "idemp:"+key, data, s.ttl).Err()
}

func (s *IdempotencyStore) Lock(ctx context.Context, key string) (bool, error) {
	return s.client.SetNX(ctx, "idemp_lock:"+key, "1", 30*time.Second).Result()
}

func (s *IdempotencyStore) Unlock(ctx context.Context, key string) {
	s.client.Del(ctx, "idemp_lock:"+key)
}
```

### Handling Concurrent Duplicates

What if two identical requests arrive at the same time?

```
Request A (t=0ms):   POST /pay, key="abc123"
Request B (t=5ms):   POST /pay, key="abc123"

WITHOUT lock:
  A: check cache → miss → process payment
  B: check cache → miss → process payment   ← DUPLICATE!

WITH lock:
  A: check cache → miss → acquire lock → process → store → unlock
  B: check cache → miss → try lock → BLOCKED → wait
  B: lock released → check cache → HIT → return cached result
```

---

## The Outbox Pattern

When you need to update a database AND publish an event atomically.
The problem: what if the DB write succeeds but the event publish fails?

```
PROBLEM: Dual Write

  ┌──────────┐
  │  Service  │── 1. INSERT order ──▶ Database ✓
  │           │── 2. Publish event ──▶ Kafka ✗ (broker down)
  └──────────┘

  Database has the order, but no event was published.
  Downstream services never learn about the order.
```

**Solution: Outbox table**

```
Instead of publishing directly, write the event to an outbox table
in the SAME database transaction as the business data.

  ┌──────────┐
  │  Service  │── BEGIN TRANSACTION
  │           │     INSERT INTO orders (...)
  │           │     INSERT INTO outbox (event_type, payload, ...)
  │           │── COMMIT (atomic — both or neither)
  └──────────┘

  ┌──────────────┐     ┌─────────────┐     ┌───────┐
  │ Outbox Poller│────▶│ outbox table│────▶│ Kafka │
  │ (background) │     │ (read new   │     │       │
  │              │     │  events)    │     │       │
  └──────────────┘     └─────────────┘     └───────┘
```

```go
package outbox

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type OutboxEntry struct {
	EventType string
	Payload   json.RawMessage
}

func CreateOrderWithOutbox(
	ctx context.Context,
	pool *pgxpool.Pool,
	order Order,
) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		"INSERT INTO orders (id, user_id, total, status) VALUES ($1, $2, $3, $4)",
		order.ID, order.UserID, order.Total, "pending",
	)
	if err != nil {
		return fmt.Errorf("insert order: %w", err)
	}

	payload, _ := json.Marshal(order)
	_, err = tx.Exec(ctx,
		"INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)",
		"order.created", order.ID, payload,
	)
	if err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}

	return tx.Commit(ctx)
}
```

### Outbox Poller

```
┌──────────────────────────────────────────────────────────┐
│                    Outbox Pattern Flow                     │
│                                                          │
│  1. App writes to DB + outbox (single transaction)       │
│                                                          │
│  2. Poller reads unsent events from outbox               │
│     SELECT * FROM outbox WHERE published = false         │
│     ORDER BY created_at LIMIT 100                        │
│                                                          │
│  3. Poller publishes each event to Kafka                 │
│                                                          │
│  4. Poller marks events as published                     │
│     UPDATE outbox SET published = true WHERE id IN (...)│
│                                                          │
│  5. If step 3 fails, event stays unpublished             │
│     → poller retries next cycle                          │
│     → consumer must be idempotent (dedup by event ID)    │
└──────────────────────────────────────────────────────────┘
```

---

## Exactly-Once Semantics

True exactly-once is impossible in distributed systems. What we actually
achieve is **effectively exactly-once** through idempotent consumers.

```
AT-MOST-ONCE:    Send and forget. May lose messages.
AT-LEAST-ONCE:   Retry until ACK. May duplicate messages.
EXACTLY-ONCE:    Each message processed exactly once.
                  (really: at-least-once + idempotent consumer)

  Producer ──▶ Kafka ──▶ Consumer

  Kafka guarantees at-least-once delivery.
  Consumer guarantees idempotent processing.
  Together: effectively exactly-once.
```

### Consumer Deduplication

```
┌──────────────────────────────────────────────────┐
│                Idempotent Consumer                 │
│                                                  │
│  1. Receive message (event_id = "evt_456")       │
│  2. Check: has "evt_456" been processed?         │
│     → Yes: ACK and skip                          │
│     → No: process, then mark "evt_456" as done   │
│  3. ACK the message                              │
│                                                  │
│  Storage for processed IDs:                      │
│    Option A: Database table (durable, slow)      │
│    Option B: Redis set with TTL (fast, bounded)  │
│    Option C: Same transaction as processing      │
└──────────────────────────────────────────────────┘
```

```typescript
interface Event {
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
}

async function handleEvent(event: Event): Promise<void> {
    const processed = await redis.sismember("processed_events", event.eventId);
    if (processed) {
        return;
    }

    await processBusinessLogic(event);

    await redis.sadd("processed_events", event.eventId);
    await redis.expire("processed_events", 7 * 24 * 60 * 60);
}
```

---

## Naturally Idempotent Operations

Some operations are idempotent by nature — no extra work needed.

```
IDEMPOTENT (safe to retry):
  SET balance = 500            (same result every time)
  DELETE FROM orders WHERE id=1 (deleting twice is fine)
  PUT /users/123 {name: "Bob"} (overwrite with same data)

NOT IDEMPOTENT (dangerous to retry):
  balance = balance + 50       (adds $50 each time!)
  INSERT INTO orders (...)     (creates duplicate rows!)
  POST /transfer {amount: 50}  (transfers $50 each time!)

FIX: make non-idempotent operations idempotent:
  balance += 50  →  "Set balance to 550 if current version is 7"
  INSERT order   →  "INSERT ... ON CONFLICT (idempotency_key) DO NOTHING"
  POST transfer  →  "Transfer $50 with key txn_abc123"
```

---

## Trade-Off Summary

| Approach | Durability | Latency Overhead | Complexity |
|----------|-----------|-----------------|------------|
| Idempotency key in Redis | Volatile (TTL) | ~1ms | Low |
| Idempotency key in DB | Durable | ~5ms | Medium |
| Outbox pattern | Durable + events | ~10ms (polling) | High |
| DB unique constraint | Durable | ~5ms | Low |
| Versioned updates (CAS) | Durable | ~5ms | Medium |

---

## Exercises

1. Add idempotency key middleware to a Go HTTP server. Cache responses
   in Redis for 24 hours. Handle concurrent duplicate requests with
   a lock.

2. Implement the outbox pattern: write an order to a database and an
   event to an outbox table in one transaction. Build a poller that
   publishes events to a message queue.

3. Make this operation idempotent: "Transfer $50 from account A to
   account B." Design the schema and the transfer function.

4. Estimate Redis memory for idempotency keys: 10M API requests/day,
   48-hour retention, 100-byte key + 500-byte cached response.

---

*Next: [Lesson 29 — Multi-Tenancy](./29-multi-tenancy.md), where we
design systems that serve many customers on shared infrastructure.*
