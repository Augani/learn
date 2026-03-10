# Lesson 3: Event Sourcing at Scale

> Instead of storing where you are, store every step you took
> to get there. Then replay the journey whenever you need.

---

## The Analogy

Your bank doesn't store "your balance is $1,247.63" and call it
done. It stores every transaction: every deposit, withdrawal,
transfer, and fee — forever. Your balance is computed by replaying
those transactions from the beginning (or from a checkpoint).

That's event sourcing. And the reason banks do it isn't because
it's trendy — it's because when there's a dispute about a
$500 charge, you need the full history to resolve it. The current
state alone doesn't tell you anything useful.

Now imagine doing this for a system that processes 50,000 events
per second across 200 microservices. That's event sourcing at
scale.

---

## Event Sourcing vs Event-Driven

These are not the same thing:

```
  EVENT-DRIVEN ARCHITECTURE:
  Services communicate through events. Events are notifications.
  After processing, the event can be discarded.

  Order Service ──"order.created"──> Email Service
                                     (sends email, forgets event)


  EVENT SOURCING:
  Events ARE the data. The event log is the source of truth.
  Current state is derived by replaying events.

  Event Store:
  ┌────┬────────────────────┬──────────────────────┐
  │ #  │ Event Type         │ Data                 │
  ├────┼────────────────────┼──────────────────────┤
  │ 1  │ OrderCreated       │ {items: [...]}       │
  │ 2  │ PaymentReceived    │ {amount: 50.00}      │
  │ 3  │ ItemShipped        │ {tracking: "XY123"}  │
  │ 4  │ DeliveryConfirmed  │ {signed_by: "Alice"} │
  └────┴────────────────────┴──────────────────────┘

  Current order state = replay(events 1..4)
```

You can use event-driven architecture without event sourcing.
You can use event sourcing without event-driven architecture
(though you'd be missing opportunities). Most large systems
use event-driven, and apply event sourcing selectively to
domains where auditability, temporal queries, or debugging
justify the complexity.

---

## The Event Store

An event store is fundamentally an append-only log organized
by streams (usually one stream per aggregate/entity).

```
  Stream: order-12345

  Position  Event              Timestamp            Version
  ────────────────────────────────────────────────────────────
  0         OrderCreated       2024-01-15 10:30:00  1
  1         ItemAdded          2024-01-15 10:30:05  2
  2         ItemAdded          2024-01-15 10:31:00  3
  3         ItemRemoved        2024-01-15 10:31:30  4
  4         OrderSubmitted     2024-01-15 10:32:00  5
  5         PaymentProcessed   2024-01-15 10:32:15  6

  Stream: order-67890

  Position  Event              Timestamp            Version
  ────────────────────────────────────────────────────────────
  0         OrderCreated       2024-01-15 11:00:00  1
  1         ItemAdded          2024-01-15 11:00:10  2
  2         OrderCancelled     2024-01-15 11:05:00  3
```

### Implementation Options

```
  ┌──────────────────┬───────────────────┬────────────────────┐
  │ Option           │ Pros              │ Cons               │
  ├──────────────────┼───────────────────┼────────────────────┤
  │ EventStoreDB     │ Purpose-built,    │ Operational burden,│
  │                  │ subscriptions,    │ smaller community  │
  │                  │ projections       │                    │
  ├──────────────────┼───────────────────┼────────────────────┤
  │ PostgreSQL       │ You know it,      │ Not optimized for  │
  │                  │ ACID guarantees,  │ append-only, need  │
  │                  │ mature tooling    │ careful indexing    │
  ├──────────────────┼───────────────────┼────────────────────┤
  │ Kafka            │ High throughput,  │ Not a database,    │
  │                  │ built-in pub/sub, │ retention limits,  │
  │                  │ partitioned       │ no per-stream query│
  ├──────────────────┼───────────────────┼────────────────────┤
  │ DynamoDB         │ Serverless scale, │ Cost at volume,    │
  │                  │ streams support   │ 400KB item limit   │
  └──────────────────┴───────────────────┴────────────────────┘
```

### PostgreSQL as Event Store

For most teams, PostgreSQL is the right starting choice:

```sql
CREATE TABLE events (
    global_position  BIGSERIAL PRIMARY KEY,
    stream_id        TEXT NOT NULL,
    stream_position  INTEGER NOT NULL,
    event_type       TEXT NOT NULL,
    data             JSONB NOT NULL,
    metadata         JSONB NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (stream_id, stream_position)
);

CREATE INDEX idx_events_stream ON events (stream_id, stream_position);
CREATE INDEX idx_events_type ON events (event_type);

-- Optimistic concurrency: append only if expected version matches
CREATE OR REPLACE FUNCTION append_event(
    p_stream_id TEXT,
    p_expected_version INTEGER,
    p_event_type TEXT,
    p_data JSONB,
    p_metadata JSONB DEFAULT '{}'
) RETURNS BIGINT AS $$
DECLARE
    v_current_version INTEGER;
    v_global_position BIGINT;
BEGIN
    SELECT COALESCE(MAX(stream_position), -1)
    INTO v_current_version
    FROM events
    WHERE stream_id = p_stream_id;

    IF v_current_version != p_expected_version THEN
        RAISE EXCEPTION 'Concurrency conflict: expected %, got %',
            p_expected_version, v_current_version;
    END IF;

    INSERT INTO events (stream_id, stream_position, event_type, data, metadata)
    VALUES (p_stream_id, p_expected_version + 1, p_event_type, p_data, p_metadata)
    RETURNING global_position INTO v_global_position;

    RETURN v_global_position;
END;
$$ LANGUAGE plpgsql;
```

The `global_position` gives total ordering across all streams.
The `stream_position` gives ordering within a single entity.
The `append_event` function enforces optimistic concurrency —
two concurrent writes to the same stream will conflict, and one
will retry with the updated version.

---

## Projections: Making Events Useful

Nobody wants to replay 10 million events to answer "what's the
order status?" Projections transform the event log into read-
optimized views.

```
  Event Stream          Projection (Read Model)
  ─────────────         ──────────────────────────

  OrderCreated     ──>  INSERT INTO order_summary
  ItemAdded        ──>  UPDATE order_summary SET item_count += 1
  PaymentReceived  ──>  UPDATE order_summary SET status = 'paid'
  ItemShipped      ──>  UPDATE order_summary SET status = 'shipped'

  ┌─────────────────────────────────────────────────────┐
  │               Event Store (source of truth)          │
  ├─────────────────────────────────────────────────────┤
  │ Projection A: order_summary (SQL table)              │
  │ Projection B: customer_order_history (Elasticsearch) │
  │ Projection C: revenue_dashboard (Redis)              │
  │ Projection D: shipping_manifest (flat file)          │
  └─────────────────────────────────────────────────────┘

  Each projection reads from the same event stream
  but builds a different view optimized for its use case.
```

### Projection Implementation

```go
type Projection interface {
	Handle(ctx context.Context, event Event) error
	Position() int64
}

type OrderSummaryProjection struct {
	db       *sql.DB
	position int64
}

func (p *OrderSummaryProjection) Handle(ctx context.Context, event Event) error {
	switch event.Type {
	case "OrderCreated":
		var data OrderCreatedData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			return fmt.Errorf("unmarshal OrderCreated: %w", err)
		}
		_, err := p.db.ExecContext(ctx, `
			INSERT INTO order_summary (order_id, customer_id, status, item_count, created_at, projection_position)
			VALUES ($1, $2, 'created', 0, $3, $4)
			ON CONFLICT (order_id) DO NOTHING`,
			data.OrderID, data.CustomerID, event.CreatedAt, event.GlobalPosition)
		if err != nil {
			return err
		}

	case "ItemAdded":
		var data ItemAddedData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			return fmt.Errorf("unmarshal ItemAdded: %w", err)
		}
		_, err := p.db.ExecContext(ctx, `
			UPDATE order_summary
			SET item_count = item_count + 1, total = total + $2, projection_position = $3
			WHERE order_id = $1 AND projection_position < $3`,
			data.OrderID, data.Price, event.GlobalPosition)
		if err != nil {
			return err
		}

	case "PaymentReceived":
		var data PaymentReceivedData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			return fmt.Errorf("unmarshal PaymentReceived: %w", err)
		}
		_, err := p.db.ExecContext(ctx, `
			UPDATE order_summary
			SET status = 'paid', projection_position = $2
			WHERE order_id = $1 AND projection_position < $2`,
			data.OrderID, event.GlobalPosition)
		if err != nil {
			return err
		}
	}

	p.position = event.GlobalPosition
	return nil
}

func (p *OrderSummaryProjection) Position() int64 {
	return p.position
}
```

Notice the `AND projection_position < $3` guard. This makes the
projection idempotent — replaying the same event twice has no
effect. This is essential for recovery after crashes.

---

## Snapshots: Taming Replay Cost

When an entity has 100,000 events, replaying from the beginning
to compute current state is too slow. Snapshots cache the state
at a point in time.

```
  Without snapshots:

  Events:  1 ─ 2 ─ 3 ─ ... ─ 99,999 ─ 100,000
  Replay:  ████████████████████████████████████████
  Time:    ~10 seconds

  With snapshots (every 1000 events):

  Events:  1 ─ ... ─ 99,000 ─ 99,001 ─ ... ─ 100,000
                       ▲
                   Snapshot
  Replay:              ████████████████
  Time:    ~100ms
```

### Snapshot Strategy

```go
type AggregateRoot struct {
	ID       string
	Version  int
	state    interface{}
	snapshot *Snapshot
}

type Snapshot struct {
	StreamID  string
	Version   int
	State     json.RawMessage
	CreatedAt time.Time
}

func LoadAggregate(ctx context.Context, store EventStore, snapshotStore SnapshotStore, streamID string) (*AggregateRoot, error) {
	agg := &AggregateRoot{ID: streamID}

	snapshot, err := snapshotStore.Latest(ctx, streamID)
	if err != nil {
		return nil, err
	}

	startVersion := 0
	if snapshot != nil {
		if err := agg.RestoreFromSnapshot(snapshot); err != nil {
			return nil, err
		}
		startVersion = snapshot.Version + 1
	}

	events, err := store.ReadStream(ctx, streamID, startVersion)
	if err != nil {
		return nil, err
	}

	for _, event := range events {
		agg.Apply(event)
	}

	if agg.Version-startVersion > 1000 {
		snap, err := agg.TakeSnapshot()
		if err == nil {
			_ = snapshotStore.Save(ctx, snap)
		}
	}

	return agg, nil
}
```

Snapshot every N events (1000 is a common choice). Take snapshots
asynchronously to avoid slowing down the write path. Keep the last
2-3 snapshots per stream for safety.

---

## Schema Evolution: The Hard Part

Events are immutable. But your understanding of the domain evolves.
How do you handle events written with an old schema?

### Upcasting Strategy

```
  Event v1 (2023):
  {
    "type": "CustomerRegistered",
    "data": { "name": "Alice Smith", "email": "alice@example.com" }
  }

  Event v2 (2024 — split name into first/last):
  {
    "type": "CustomerRegistered",
    "data": {
      "first_name": "Alice",
      "last_name": "Smith",
      "email": "alice@example.com"
    }
  }
```

Option 1: **Upcaster** — Transform old events to new schema on read:

```go
type Upcaster interface {
	CanUpcast(eventType string, version int) bool
	Upcast(event RawEvent) (RawEvent, error)
}

type CustomerRegisteredUpcaster struct{}

func (u *CustomerRegisteredUpcaster) CanUpcast(eventType string, version int) bool {
	return eventType == "CustomerRegistered" && version < 2
}

func (u *CustomerRegisteredUpcaster) Upcast(event RawEvent) (RawEvent, error) {
	var oldData struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.Unmarshal(event.Data, &oldData); err != nil {
		return event, err
	}

	parts := strings.SplitN(oldData.Name, " ", 2)
	firstName := parts[0]
	lastName := ""
	if len(parts) > 1 {
		lastName = parts[1]
	}

	newData, _ := json.Marshal(map[string]string{
		"first_name": firstName,
		"last_name":  lastName,
		"email":      oldData.Email,
	})

	event.Data = newData
	event.SchemaVersion = 2
	return event, nil
}
```

Option 2: **Weak schema** — Use JSONB and handle missing fields:

```go
func (e *CustomerRegisteredEvent) FirstName() string {
	if e.Data.FirstName != "" {
		return e.Data.FirstName
	}
	parts := strings.SplitN(e.Data.Name, " ", 2)
	return parts[0]
}
```

Option 3: **Copy-transform** — Migrate the event store by writing
transformed events to a new store. This is the nuclear option —
expensive but gives you a clean slate.

### Schema Registry

At scale, you need a schema registry to track event versions:

```
  Schema Registry

  ┌────────────────────────┬─────────┬────────────┐
  │ Event Type             │ Version │ Schema     │
  ├────────────────────────┼─────────┼────────────┤
  │ CustomerRegistered     │ 1       │ {name,...} │
  │ CustomerRegistered     │ 2       │ {first_...}│
  │ OrderCreated           │ 1       │ {items,...}│
  │ OrderCreated           │ 2       │ {items,   │
  │                        │         │  currency} │
  └────────────────────────┴─────────┴────────────┘

  Rules:
  - New versions must be backward compatible
  - Removing a field requires a new event type
  - Schema validation on write prevents bad events
```

---

## Handling Billions of Events

At high volume, naive approaches break. Here's what changes:

### Partitioning the Event Store

```
  Single event store:

  ┌─────────────────────────────────────────┐
  │  events table: 5 billion rows           │
  │  SELECT is slow. Disk is full.          │
  └─────────────────────────────────────────┘

  Partitioned by time:

  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ events_2024  │ │ events_2025  │ │ events_2026  │
  │ Q1 Q2 Q3 Q4 │ │ Q1 Q2 Q3 Q4 │ │ Q1           │
  └──────────────┘ └──────────────┘ └──────────────┘

  Old partitions: read-only, compressed, archived
  Current partition: active writes
```

```sql
CREATE TABLE events (
    global_position  BIGINT GENERATED ALWAYS AS IDENTITY,
    stream_id        TEXT NOT NULL,
    stream_position  INTEGER NOT NULL,
    event_type       TEXT NOT NULL,
    data             JSONB NOT NULL,
    metadata         JSONB NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_q1 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE events_2026_q2 PARTITION OF events
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
```

### Projection Scaling

```
  Single projection consumer: bottleneck at ~5K events/sec

  ┌──────────┐     ┌────────────┐
  │  Event   │────>│ Projection │────> Read DB
  │  Store   │     │  Consumer  │
  └──────────┘     └────────────┘

  Partitioned consumers: scales linearly

  ┌──────────┐     ┌────────────┐
  │  Event   │────>│ Consumer 0 │────> Read DB (shard 0)
  │  Store   │────>│ Consumer 1 │────> Read DB (shard 1)
  │  (Kafka) │────>│ Consumer 2 │────> Read DB (shard 2)
  └──────────┘     └────────────┘

  Partition key = stream_id
  (ensures all events for one entity go to same consumer)
```

### Archival Strategy

Not all events need to be instantly accessible:

```
  Hot tier (< 30 days):   PostgreSQL / DynamoDB
  Warm tier (30d - 1yr):  S3 + Parquet files
  Cold tier (> 1 year):   S3 Glacier

  ┌─────────┐     ┌──────────┐     ┌──────────┐
  │   Hot   │────>│   Warm   │────>│   Cold   │
  │ (fast)  │     │ (cheap)  │     │(cheapest)│
  └─────────┘     └──────────┘     └──────────┘

  Projections only need the hot tier.
  Auditing/compliance uses warm.
  Legal holds use cold.
```

---

## When NOT to Use Event Sourcing

Event sourcing adds real complexity. Don't use it when:

```
  ✗ Simple CRUD with no audit requirements
  ✗ Team has no experience with event-driven systems
  ✗ Domain has no temporal queries ("what was state at time T?")
  ✗ Low write volume (< 100 events/sec)
  ✗ No business need for replay or reprocessing
  ✗ Strong consistency required everywhere (event sourcing
    is inherently eventually consistent for read models)
```

Use it when:

```
  ✓ Audit trail is a regulatory requirement
  ✓ Business needs temporal queries
  ✓ Multiple teams consume the same events
  ✓ You need to retroactively add analytics
  ✓ Domain has complex state transitions (orders, claims)
  ✓ You need to debug production issues by replaying events
```

---

## Exercises

1. **Design an event store.** You're building an event-sourced
   order management system. Design the event schema for the full
   order lifecycle: creation, item changes, payment, fulfillment,
   returns. What events do you need? How do you handle concurrent
   modifications to the same order?

2. **Projection design.** For the order system above, design three
   projections: (a) order status lookup, (b) customer order
   history with search, (c) real-time revenue dashboard. What
   technology would you use for each? How do you handle projection
   failures?

3. **Schema migration.** Your `OrderCreated` event originally had a
   `total` field in USD. Now you need multi-currency support. Design
   a migration strategy that doesn't require rewriting existing events.
   How does this affect existing projections?

4. **Scale planning.** Your event store receives 10,000 events/sec
   and currently has 500 million events. Project the storage needs
   for the next 2 years. Design the partitioning, archival, and
   snapshot strategy. What's the cost estimate for AWS?

---

[Next: Lesson 4 — Multi-Region Architecture -->](04-multi-region-architecture.md)
