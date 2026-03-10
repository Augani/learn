# Lesson 2: Distributed Transactions

> Two-phase commit is the theory answer. Sagas are the production
> answer. Idempotency is what actually saves you at 3am.

---

## The Analogy

You're buying a house. Three things must happen atomically:

1. The bank releases the mortgage funds
2. The seller signs over the title
3. The government records the transfer

In practice, these don't happen "atomically." They happen in
sequence, with each step confirming the previous one, and each
step having a way to undo itself if something goes wrong. The
bank can recall funds. The title can be contested. The recording
can be voided.

That's a saga — not a transaction. And most "distributed
transactions" in real systems should be sagas too.

---

## Why 2PC Fails in Practice

You learned about two-phase commit in the distributed systems
track. Here's why production systems avoid it:

```
  2PC: The Happy Path

  Coordinator      Service A      Service B      Service C
       │               │              │              │
       │──PREPARE─────>│              │              │
       │──PREPARE──────│─────────────>│              │
       │──PREPARE──────│──────────────│─────────────>│
       │               │              │              │
       │<─YES──────────│              │              │
       │<─YES──────────│──────────────│              │
       │<─YES──────────│──────────────│──────────────│
       │               │              │              │
       │──COMMIT──────>│              │              │
       │──COMMIT───────│─────────────>│              │
       │──COMMIT───────│──────────────│─────────────>│


  2PC: The 3am Path

  Coordinator      Service A      Service B      Service C
       │               │              │              │
       │──PREPARE─────>│              │              │
       │──PREPARE──────│─────────────>│              │
       │──PREPARE──────│──────────────│─────────────>│
       │               │              │              │
       │<─YES──────────│              │              │
       │<─YES──────────│──────────────│              │
       │               │              │              │
       X (coordinator crashes)       │              │
                                     │              │
  Service A: "I voted YES. I'm holding locks."
  Service B: "I voted YES. I'm holding locks."
  Service C: "I never got the PREPARE. I'm fine."

  Services A and B are now BLOCKED.
  They can't commit (no decision).
  They can't abort (they voted YES).
  They're holding locks on data.
  Other transactions pile up behind them.
  Your pager goes off.
```

### The Real Problems with 2PC

1. **Blocking**: Participants hold locks during the entire protocol.
   If the coordinator dies, those locks are held indefinitely.

2. **Latency**: Every participant must respond before progress.
   Your transaction is as slow as your slowest participant.

3. **Availability**: If any participant is down, the entire
   transaction fails. Your availability is the *product* of all
   participants' availability.

```
  Availability math (independent failures):

  Single service:       99.9%
  2PC with 2 services:  99.9% × 99.9% = 99.8%
  2PC with 5 services:  99.9%^5 = 99.5%
  2PC with 10 services: 99.9%^10 = 99.0%

  You went from "three nines" to "two nines" just by
  adding coordination across 10 services.
```

4. **Operational complexity**: You need a recovery mechanism for
   the coordinator. Most implementations use a write-ahead log
   that must survive crashes. Now you're debugging transaction
   recovery at 3am.

---

## The Saga Pattern (Deep Dive)

A saga breaks a distributed transaction into a sequence of local
transactions, each with a compensating action.

```
  Transaction T: Book a trip

  Step 1: Reserve hotel      Compensate: Cancel reservation
  Step 2: Book flight        Compensate: Cancel booking
  Step 3: Charge credit card Compensate: Issue refund
  Step 4: Send confirmation  Compensate: Send cancellation email

  Happy path: 1 → 2 → 3 → 4 ✓

  Failure at step 3:
  1 → 2 → 3(FAIL) → compensate(2) → compensate(1)
```

### Orchestration vs Choreography

Two ways to coordinate saga steps:

```
  ORCHESTRATION: Central coordinator decides what happens next

  ┌───────────────┐
  │  Orchestrator  │
  │  (Saga State   │
  │   Machine)     │
  └───┬───┬───┬───┘
      │   │   │
      ▼   ▼   ▼
  ┌─────┐ ┌─────┐ ┌─────┐
  │Hotel│ │Flight│ │ Pay │
  └─────┘ └─────┘ └─────┘

  Pros: Easy to understand, central visibility
  Cons: Single point of failure, can become bottleneck


  CHOREOGRAPHY: Each service reacts to events

  ┌─────┐   event   ┌──────┐   event   ┌─────┐
  │Hotel│──────────>│Flight│──────────>│ Pay │
  └─────┘           └──────┘           └─────┘
     ▲                                     │
     └─────────── compensation event ──────┘

  Pros: Decoupled, no single point of failure
  Cons: Hard to understand flow, debugging is painful
```

### When to Use Which

```
  Use ORCHESTRATION when:
  - Steps have complex ordering or branching
  - You need clear visibility into saga state
  - Business logic requires conditional steps
  - You have < 10 steps

  Use CHOREOGRAPHY when:
  - Steps are loosely coupled
  - Teams own their services independently
  - You need maximum availability
  - The flow is simple and linear
```

---

## Saga State Machine

A production saga needs a state machine, not ad-hoc if/else:

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

type SagaState string

const (
	SagaStateStarted          SagaState = "STARTED"
	SagaStateHotelReserved    SagaState = "HOTEL_RESERVED"
	SagaStateFlightBooked     SagaState = "FLIGHT_BOOKED"
	SagaStatePaymentCharged   SagaState = "PAYMENT_CHARGED"
	SagaStateCompleted        SagaState = "COMPLETED"
	SagaStateCompensating     SagaState = "COMPENSATING"
	SagaStateFailed           SagaState = "FAILED"
)

type SagaLog struct {
	SagaID    string    `json:"saga_id"`
	State     SagaState `json:"state"`
	StepData  map[string]json.RawMessage `json:"step_data"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Attempts  int       `json:"attempts"`
}

type SagaStep struct {
	Name       string
	Execute    func(ctx context.Context, data map[string]json.RawMessage) error
	Compensate func(ctx context.Context, data map[string]json.RawMessage) error
	NextState  SagaState
}

type SagaOrchestrator struct {
	steps    []SagaStep
	store    SagaStore
	maxRetry int
}

type SagaStore interface {
	Save(ctx context.Context, log *SagaLog) error
	Load(ctx context.Context, sagaID string) (*SagaLog, error)
	ListIncomplete(ctx context.Context) ([]*SagaLog, error)
}

func (o *SagaOrchestrator) Execute(ctx context.Context, sagaID string) error {
	log := &SagaLog{
		SagaID:    sagaID,
		State:     SagaStateStarted,
		StepData:  make(map[string]json.RawMessage),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := o.store.Save(ctx, log); err != nil {
		return fmt.Errorf("failed to save initial saga state: %w", err)
	}

	for i, step := range o.steps {
		if err := step.Execute(ctx, log.StepData); err != nil {
			log.State = SagaStateCompensating
			log.UpdatedAt = time.Now()
			_ = o.store.Save(ctx, log)

			return o.compensate(ctx, log, i-1)
		}

		log.State = step.NextState
		log.UpdatedAt = time.Now()
		if err := o.store.Save(ctx, log); err != nil {
			return fmt.Errorf("failed to save saga state after %s: %w", step.Name, err)
		}
	}

	log.State = SagaStateCompleted
	log.UpdatedAt = time.Now()
	return o.store.Save(ctx, log)
}

func (o *SagaOrchestrator) compensate(ctx context.Context, log *SagaLog, fromStep int) error {
	for i := fromStep; i >= 0; i-- {
		step := o.steps[i]
		for attempt := 0; attempt < o.maxRetry; attempt++ {
			if err := step.Compensate(ctx, log.StepData); err != nil {
				time.Sleep(time.Duration(attempt+1) * time.Second)
				continue
			}
			break
		}
	}

	log.State = SagaStateFailed
	log.UpdatedAt = time.Now()
	return o.store.Save(ctx, log)
}

func (o *SagaOrchestrator) Recover(ctx context.Context) error {
	incomplete, err := o.store.ListIncomplete(ctx)
	if err != nil {
		return err
	}

	for _, log := range incomplete {
		switch log.State {
		case SagaStateCompensating:
			stepIdx := o.stateToStepIndex(log.State)
			_ = o.compensate(ctx, log, stepIdx)
		default:
			stepIdx := o.stateToStepIndex(log.State)
			if stepIdx >= 0 && stepIdx < len(o.steps) {
				_ = o.resumeFrom(ctx, log, stepIdx)
			}
		}
	}
	return nil
}

func (o *SagaOrchestrator) stateToStepIndex(state SagaState) int {
	for i, step := range o.steps {
		if step.NextState == state {
			return i
		}
	}
	return -1
}

func (o *SagaOrchestrator) resumeFrom(ctx context.Context, log *SagaLog, stepIdx int) error {
	for i := stepIdx; i < len(o.steps); i++ {
		step := o.steps[i]
		if err := step.Execute(ctx, log.StepData); err != nil {
			log.State = SagaStateCompensating
			_ = o.store.Save(ctx, log)
			return o.compensate(ctx, log, i-1)
		}
		log.State = step.NextState
		log.UpdatedAt = time.Now()
		_ = o.store.Save(ctx, log)
	}

	log.State = SagaStateCompleted
	log.UpdatedAt = time.Now()
	return o.store.Save(ctx, log)
}
```

The key insight: **persist the saga state before and after each step**.
When the orchestrator crashes and restarts, it can pick up exactly
where it left off. This is what makes sagas recoverable where 2PC
is not.

---

## Idempotency: The Unsung Hero

Every saga step, every compensation, every retry MUST be idempotent.
Without idempotency, retries create duplicates and compensations
over-correct.

```
  WITHOUT idempotency:

  Client ──> "Charge $50" ──> Payment Service (succeeds)
  Client ──> (timeout, didn't get response)
  Client ──> "Charge $50" ──> Payment Service (succeeds AGAIN)

  Customer charged $100. You have a support ticket.


  WITH idempotency:

  Client ──> "Charge $50, key=abc-123" ──> Payment Service (succeeds)
  Client ──> (timeout, didn't get response)
  Client ──> "Charge $50, key=abc-123" ──> Payment Service (sees key, returns cached result)

  Customer charged $50. No support ticket.
```

### Implementing Idempotency Keys

```go
type IdempotencyStore interface {
	Check(ctx context.Context, key string) (*Result, bool, error)
	Save(ctx context.Context, key string, result *Result, ttl time.Duration) error
}

func ProcessPayment(ctx context.Context, store IdempotencyStore, key string, amount int64) (*Result, error) {
	existing, found, err := store.Check(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("idempotency check failed: %w", err)
	}
	if found {
		return existing, nil
	}

	result, err := chargeCard(ctx, amount)
	if err != nil {
		return nil, err
	}

	saveErr := store.Save(ctx, key, result, 24*time.Hour)
	if saveErr != nil {
		// Log but don't fail — the charge succeeded.
		// Worst case: a retry will charge again.
		// This is where you need additional safeguards.
	}

	return result, nil
}
```

### The EXACTLY-ONCE Illusion

Exactly-once processing doesn't exist in distributed systems.
What you can achieve:

```
  AT-MOST-ONCE:  Fire and forget. May lose messages.
  AT-LEAST-ONCE: Retry until acknowledged. May duplicate.
  EFFECTIVELY-ONCE: At-least-once + idempotent processing.

  "Exactly-once" = at-least-once delivery + idempotent consumer
```

Kafka's "exactly-once semantics" (EOS) achieves this through:
1. Idempotent producers (dedup at the broker)
2. Transactional writes (atomic across partitions)
3. Consumer offset commits within the same transaction

But this only works **within Kafka**. The moment you write to an
external system (database, API), you need your own idempotency.

---

## Real Failure Scenarios

### Scenario 1: The Phantom Order

```
  1. User places order (saga starts)
  2. Inventory reserved ✓
  3. Payment charged ✓
  4. Order confirmation... service crashes
  5. Saga recovery kicks in
  6. Saga sees "PAYMENT_CHARGED" state
  7. Retries confirmation step
  8. But the confirmation service has a bug:
     it creates a NEW order record on retry
  9. User gets two confirmation emails
  10. Warehouse ships two items
```

Root cause: The confirmation service wasn't idempotent. It should
have checked for existing orders with the same saga ID.

### Scenario 2: The Compensation Race

```
  1. Saga step 3 fails
  2. Compensation starts: refund payment
  3. Meanwhile, a webhook from the payment provider
     fires: "Payment successful"
  4. Another service processes the webhook and
     marks the order as "paid"
  5. Compensation completes: payment refunded
  6. System state: order is "paid" but payment is refunded
```

Root cause: The webhook handler and the saga compensation are
concurrent and don't coordinate. You need either:
- A single source of truth for payment state (event log)
- Distributed locking on the order during compensation
- Saga state checks in the webhook handler

### Scenario 3: The Partial Compensation

```
  1. Saga: reserve hotel, book flight, charge card
  2. Card charge fails
  3. Compensate flight booking... ✓
  4. Compensate hotel reservation... hotel API is down
  5. Retry hotel compensation... still down
  6. Retry... still down
  7. Max retries exhausted
  8. Now what?
```

This is the "saga of the saga" problem. Options:
- **Dead letter queue**: Put failed compensations in a DLQ for
  manual resolution
- **Infinite retry with backoff**: Keep retrying with exponential
  backoff (but this can take hours)
- **Human escalation**: Alert an operator after N failures
- **Scheduled reconciliation**: A periodic job that detects and
  fixes inconsistencies

Most production systems use a combination: retry with backoff,
then dead letter queue, then human escalation, with a
reconciliation job as a safety net.

---

## The Outbox Pattern

How do you atomically update a database AND publish an event?

```
  WRONG: Two separate operations

  1. UPDATE orders SET status = 'confirmed'    (succeeds)
  2. PUBLISH event: "order.confirmed"          (fails — MQ is down)

  Database says confirmed, but nobody knows about it.


  RIGHT: Outbox pattern

  1. BEGIN TRANSACTION
     UPDATE orders SET status = 'confirmed'
     INSERT INTO outbox (event_type, payload) VALUES ('order.confirmed', {...})
     COMMIT

  2. Background process reads outbox, publishes events, marks as sent

  ┌──────────────┐     ┌─────────┐     ┌──────────────┐
  │   Service    │     │ Outbox  │     │  Message     │
  │  (writes to  │────>│  Table  │────>│  Broker      │
  │   DB + outbox│     │         │     │  (Kafka etc) │
  │   in one tx) │     │         │     │              │
  └──────────────┘     └─────────┘     └──────────────┘
```

The outbox reader (also called CDC — Change Data Capture) can be
implemented with Debezium, a polling query, or database triggers.
Debezium reads the database's write-ahead log directly, which is
the most reliable approach.

---

## Decision Matrix

```
  +---------------------+----------+---------+--------+----------+
  | Pattern             | Consis-  | Avail-  | Comp-  | Use When |
  |                     | tency    | ability | lexity |          |
  +---------------------+----------+---------+--------+----------+
  | 2PC                 | Strong   | Low     | Medium | Within a |
  |                     |          |         |        | single DB|
  |                     |          |         |        | cluster  |
  +---------------------+----------+---------+--------+----------+
  | Saga (orchestrated) | Eventual | High    | Medium | Complex  |
  |                     |          |         |        | business |
  |                     |          |         |        | flows    |
  +---------------------+----------+---------+--------+----------+
  | Saga (choreographed)| Eventual | Highest | High   | Loosely  |
  |                     |          |         |        | coupled  |
  |                     |          |         |        | teams    |
  +---------------------+----------+---------+--------+----------+
  | Outbox + CDC        | Eventual | High    | Low    | DB write |
  |                     |          |         |        | + event  |
  |                     |          |         |        | publish  |
  +---------------------+----------+---------+--------+----------+
  | No coordination     | None     | Highest | None   | When you |
  |                     |          |         |        | can avoid|
  |                     |          |         |        | it       |
  +---------------------+----------+---------+--------+----------+
```

---

## Exercises

1. **Design a saga.** An e-commerce order involves: validate cart,
   reserve inventory, calculate tax, charge payment, create
   shipment, send confirmation. Design the saga with compensating
   actions for each step. What happens if tax calculation changes
   between cart validation and payment?

2. **Idempotency audit.** Take an API you've built. List every
   endpoint that modifies state. For each one: is it idempotent?
   If not, what would it take to make it idempotent? What's the
   idempotency key?

3. **Outbox implementation.** Design the outbox table schema for
   a system that publishes events to Kafka. How do you handle
   ordering? How do you handle the outbox reader crashing mid-
   publish? How do you clean up old outbox entries?

4. **Failure analysis.** You discover that 0.01% of orders have
   inconsistent state between the payment service and the order
   service. Design a reconciliation system that detects and fixes
   these inconsistencies automatically. What alerts do you need?

---

[Next: Lesson 3 — Event Sourcing at Scale -->](03-event-sourcing-at-scale.md)
