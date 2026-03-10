# Lesson 12: Event-Driven Architecture — Events, Streams, and CQRS

Traditional architectures are built around state: what IS the current
balance? What IS the user's address? Event-driven architecture is built
around changes: what HAPPENED? An order was placed. A payment was
received. An address was updated.

The analogy is accounting. A traditional system is like checking your
bank balance on a screen — you see one number. An event-driven system is
like your bank statement — every transaction is recorded. You can always
replay transactions to get the current balance, audit the history, or
answer questions you didn't think to ask when you designed the system.

---

## Events vs Commands

These are different things that people constantly confuse.

### Commands: "Do this"

A command is a request to perform an action. It's directed at a specific
recipient and expects a result. Commands can fail.

```
"CreateOrder"       → someone should create an order
"SendEmail"         → someone should send an email
"ChargePayment"     → someone should process a payment
```

### Events: "This happened"

An event is a fact. Something already occurred. Events are immutable —
you can't un-ring a bell. Events are broadcast, not directed.

```
"OrderCreated"      → an order was created (fact)
"EmailSent"         → an email was sent (fact)
"PaymentCharged"    → a payment was processed (fact)
```

### Why this distinction matters

```
COMMAND-DRIVEN (tight coupling):

  OrderService ──"SendEmail"──► EmailService
  OrderService ──"UpdateInventory"──► InventoryService
  OrderService ──"NotifySales"──► SalesService

  OrderService KNOWS about all downstream services.
  Adding a new service means changing OrderService.

EVENT-DRIVEN (loose coupling):

  OrderService ──"OrderCreated"──► Event Bus
                                      │
                                      ├──► EmailService (listens)
                                      ├──► InventoryService (listens)
                                      ├──► SalesService (listens)
                                      └──► AnalyticsService (listens)

  OrderService doesn't know who's listening.
  Adding a new service means subscribing to the event.
  OrderService never changes.
```

```
┌────────────────────────────────────────────────────┐
│           COMMAND vs EVENT                          │
├─────────────────────┬──────────────────────────────┤
│     COMMAND         │     EVENT                    │
├─────────────────────┼──────────────────────────────┤
│ Imperative          │ Past tense                   │
│ "CreateOrder"       │ "OrderCreated"               │
│ Directed at someone │ Broadcast to everyone        │
│ Can be rejected     │ Already happened (fact)      │
│ Tight coupling      │ Loose coupling               │
│ Expects response    │ Fire and forget              │
└─────────────────────┴──────────────────────────────┘
```

---

## Event Sourcing: Store Events, Not State

In a traditional system, you store current state. When a user changes
their email, you UPDATE the row. The old email is gone forever.

With event sourcing, you store every event that ever happened. The
current state is derived by replaying events.

### The bank account analogy

```
TRADITIONAL (state-based):
  Account #123: Balance = $750
  (How did we get here? No idea.)

EVENT-SOURCED:
  Account #123 events:
  1. AccountOpened      { initial_deposit: $1000 }
  2. WithdrawalMade     { amount: $200 }
  3. DepositReceived    { amount: $500 }
  4. WithdrawalMade     { amount: $50 }
  5. FeeCharged         { amount: $25 }
  6. InterestApplied    { amount: $12.50 }
  7. TransferSent       { amount: $487.50 }

  Current balance: replay all events → $750
  Full audit trail. Every dollar accounted for.
```

### How event sourcing works

```
  Command                    Event Store                 Projection
  ┌─────┐                   ┌──────────┐               ┌──────────┐
  │Place │──validate──►     │Event #1  │──project──►   │Current   │
  │Order │   & append       │Event #2  │               │State     │
  └─────┘                   │Event #3  │               │(read     │
                            │Event #4  │               │ model)   │
                            │  ...     │               │          │
                            └──────────┘               └──────────┘
                            Append-only                 Derived,
                            Source of truth              rebuildable
```

1. A command arrives ("Place order for user 42")
2. The system validates the command against current state
3. If valid, an event is created and appended to the event store
4. The event is projected into a read-optimized view (the projection)
5. The event is published so other services can react

### Go implementation of an event-sourced aggregate

```go
type EventType string

const (
	OrderPlaced   EventType = "OrderPlaced"
	ItemAdded     EventType = "ItemAdded"
	ItemRemoved   EventType = "ItemRemoved"
	OrderShipped  EventType = "OrderShipped"
	OrderCanceled EventType = "OrderCanceled"
)

type Event struct {
	ID          string    `json:"id"`
	AggregateID string    `json:"aggregate_id"`
	Type        EventType `json:"type"`
	Data        []byte    `json:"data"`
	Version     int       `json:"version"`
	OccurredAt  time.Time `json:"occurred_at"`
}

type OrderState struct {
	ID        string
	UserID    string
	Items     []OrderItem
	Total     float64
	Status    string
	Version   int
}

type OrderItem struct {
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
}

func ReplayOrder(events []Event) (*OrderState, error) {
	order := &OrderState{}

	for _, event := range events {
		if err := applyEvent(order, event); err != nil {
			return nil, fmt.Errorf("apply event %s: %w", event.ID, err)
		}
		order.Version = event.Version
	}

	return order, nil
}

func applyEvent(order *OrderState, event Event) error {
	switch event.Type {
	case OrderPlaced:
		var data struct {
			OrderID string `json:"order_id"`
			UserID  string `json:"user_id"`
		}
		if err := json.Unmarshal(event.Data, &data); err != nil {
			return err
		}
		order.ID = data.OrderID
		order.UserID = data.UserID
		order.Status = "placed"
		order.Items = nil
		order.Total = 0

	case ItemAdded:
		var item OrderItem
		if err := json.Unmarshal(event.Data, &item); err != nil {
			return err
		}
		order.Items = append(order.Items, item)
		order.Total += item.Price * float64(item.Quantity)

	case ItemRemoved:
		var data struct {
			ProductID string `json:"product_id"`
		}
		if err := json.Unmarshal(event.Data, &data); err != nil {
			return err
		}
		for i, item := range order.Items {
			if item.ProductID == data.ProductID {
				order.Total -= item.Price * float64(item.Quantity)
				order.Items = append(order.Items[:i], order.Items[i+1:]...)
				break
			}
		}

	case OrderShipped:
		order.Status = "shipped"

	case OrderCanceled:
		order.Status = "canceled"
		order.Total = 0

	default:
		return fmt.Errorf("unknown event type: %s", event.Type)
	}

	return nil
}
```

### Event store in PostgreSQL

```sql
CREATE TABLE events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id TEXT NOT NULL,
    type         TEXT NOT NULL,
    data         JSONB NOT NULL,
    version      INT NOT NULL,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (aggregate_id, version)
);

CREATE INDEX idx_events_aggregate ON events (aggregate_id, version);
```

The UNIQUE constraint on `(aggregate_id, version)` provides optimistic
concurrency control. Two concurrent writes to the same aggregate with
the same version will cause one to fail — the loser retries with the
updated state.

```go
func AppendEvent(ctx context.Context, db *sql.DB, event Event) error {
	_, err := db.ExecContext(ctx,
		`INSERT INTO events (aggregate_id, type, data, version, occurred_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		event.AggregateID, event.Type, event.Data, event.Version, event.OccurredAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrConcurrencyConflict
		}
		return fmt.Errorf("append event: %w", err)
	}
	return nil
}

func LoadEvents(ctx context.Context, db *sql.DB, aggregateID string) ([]Event, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, aggregate_id, type, data, version, occurred_at
		 FROM events
		 WHERE aggregate_id = $1
		 ORDER BY version ASC`,
		aggregateID,
	)
	if err != nil {
		return nil, fmt.Errorf("load events: %w", err)
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.AggregateID, &e.Type, &e.Data, &e.Version, &e.OccurredAt); err != nil {
			return nil, fmt.Errorf("scan event: %w", err)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
```

### Snapshots: Don't replay millions of events

If an aggregate has thousands of events, replaying them all for every
read is slow. **Snapshots** save the state at a point in time, so you
only replay events after the snapshot.

```
Events: [1] [2] [3] [4] [5] [6] [7] [8] [9] [10] [11] [12]
                              ▲
                         Snapshot at v6
                         (saved state)

To get current state:
  Load snapshot (v6) → replay events 7-12 → current state
  Instead of replaying all 12 events.
```

---

## CQRS: Separate Read and Write Models

Command Query Responsibility Segregation. A fancy name for a simple
idea: use different models for reading and writing.

### Why separate them?

Reads and writes have fundamentally different needs:

```
WRITES (Commands):                    READS (Queries):
- Validate business rules            - Join data from many sources
- Ensure consistency                  - Filter, sort, paginate
- Append events                       - Denormalize for speed
- Need strong consistency             - Can tolerate staleness
- Low throughput (relatively)         - High throughput
- Complex domain logic                - Simple data retrieval
```

In a traditional system, one model serves both. This model is a
compromise — not great for either purpose.

### CQRS architecture

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         Commands                    Queries
              │                         │
              ▼                         ▼
     ┌────────────────┐       ┌────────────────┐
     │  Write Model   │       │  Read Model    │
     │                │       │                │
     │  Domain logic  │       │  Denormalized  │
     │  Validation    │       │  Pre-computed  │
     │  Event store   │       │  Optimized for │
     │                │       │  specific views│
     └───────┬────────┘       └────────────────┘
             │                         ▲
             │   Events published      │
             └─────────────────────────┘
                  Projections update
                  the read model
```

### TypeScript CQRS example

```typescript
interface PlaceOrderCommand {
  type: "PlaceOrder";
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
}

interface GetOrderQuery {
  type: "GetOrder";
  orderId: string;
}

interface GetUserOrdersQuery {
  type: "GetUserOrders";
  userId: string;
  page: number;
  limit: number;
}

class OrderCommandHandler {
  constructor(
    private eventStore: EventStore,
    private productService: ProductService
  ) {}

  async handle(cmd: PlaceOrderCommand): Promise<string> {
    const orderId = generateId();
    const products = await this.productService.getProducts(
      cmd.items.map((i) => i.productId)
    );

    for (const item of cmd.items) {
      const product = products.get(item.productId);
      if (!product) {
        throw new ValidationError(`Product ${item.productId} not found`);
      }
      if (product.stock < item.quantity) {
        throw new ValidationError(
          `Insufficient stock for ${product.name}`
        );
      }
    }

    const orderItems = cmd.items.map((item) => {
      const product = products.get(item.productId)!;
      return {
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      };
    });

    const total = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    await this.eventStore.append(orderId, {
      type: "OrderPlaced",
      data: {
        orderId,
        userId: cmd.userId,
        items: orderItems,
        total,
      },
    });

    return orderId;
  }
}

class OrderQueryHandler {
  constructor(private readDb: Pool) {}

  async getOrder(query: GetOrderQuery): Promise<OrderView | null> {
    const result = await this.readDb.query(
      `SELECT id, user_id, items, total, status, created_at
       FROM order_views WHERE id = $1`,
      [query.orderId]
    );
    return result.rows[0] ?? null;
  }

  async getUserOrders(
    query: GetUserOrdersQuery
  ): Promise<OrderView[]> {
    const offset = (query.page - 1) * query.limit;
    const result = await this.readDb.query(
      `SELECT id, user_id, items, total, status, created_at
       FROM order_views
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [query.userId, query.limit, offset]
    );
    return result.rows;
  }
}
```

### Projections: Building the read model

A projection listens to events and updates the read model. It transforms
the event stream into a query-optimized view.

```typescript
class OrderProjection {
  constructor(private readDb: Pool) {}

  async handle(event: Event): Promise<void> {
    switch (event.type) {
      case "OrderPlaced":
        await this.readDb.query(
          `INSERT INTO order_views (id, user_id, items, total, status, created_at)
           VALUES ($1, $2, $3, $4, 'placed', $5)`,
          [
            event.data.orderId,
            event.data.userId,
            JSON.stringify(event.data.items),
            event.data.total,
            event.occurredAt,
          ]
        );
        break;

      case "OrderShipped":
        await this.readDb.query(
          `UPDATE order_views SET status = 'shipped', shipped_at = $2
           WHERE id = $1`,
          [event.aggregateId, event.occurredAt]
        );
        break;

      case "OrderCanceled":
        await this.readDb.query(
          `UPDATE order_views SET status = 'canceled', canceled_at = $2
           WHERE id = $1`,
          [event.aggregateId, event.occurredAt]
        );
        break;
    }
  }
}
```

Projections can be rebuilt from scratch by replaying all events. This
means you can add a new read model later — answering questions you
didn't know you'd ask.

---

## Event Streaming with Kafka

Kafka is the backbone for most event-driven architectures at scale. It
acts as a durable, ordered, distributed log that multiple services can
read from independently.

```
┌─────────────────────────────────────────────────────────────────┐
│                    KAFKA AS EVENT BACKBONE                       │
│                                                                 │
│  Order         ┌─────────────┐                                  │
│  Service ────► │orders topic │──► Inventory Service              │
│                └─────────────┘──► Shipping Service               │
│                                ──► Analytics Service             │
│                                ──► Search Indexer                │
│  Payment       ┌─────────────┐                                  │
│  Service ────► │payments     │──► Order Service                  │
│                │topic        │──► Accounting Service             │
│                └─────────────┘──► Fraud Detection                │
│                                                                 │
│  Each service reads at its own pace.                            │
│  Each service maintains its own consumer offset.                │
│  Adding a new service = subscribing to existing topics.         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Kafka concepts for event-driven systems

**Topics and partitions**: Events are published to topics. Topics are
split into partitions for parallel processing. Events with the same key
(e.g., order ID) go to the same partition, preserving order for that
entity.

**Consumer groups**: Each service has its own consumer group. This means
the inventory service and shipping service both get every event, but
within the inventory service, events are load-balanced across instances.

**Retention**: Events are retained for a configurable period (or
forever). New services can read from the beginning of the log to build
their initial state.

---

## Saga Pattern: Distributed Transactions

In a microservices world, a single business operation (like placing an
order) might span multiple services. Traditional database transactions
don't work across services. Sagas coordinate multi-service operations
using a sequence of local transactions and compensating actions.

### The analogy: Planning a trip

You book a flight, then a hotel, then a rental car. If the rental car
isn't available, you cancel the hotel, then cancel the flight. Each step
is independent, and each has a "undo" action.

### Choreography-based saga

Services communicate through events. No central coordinator.

```
1. Order Service:  "OrderCreated"
        │
        ▼
2. Payment Service hears event → processes payment
   Success: "PaymentCompleted"
   Failure: "PaymentFailed" → Order Service cancels order
        │
        ▼
3. Inventory Service hears event → reserves stock
   Success: "StockReserved"
   Failure: "StockInsufficient" → Payment Service refunds
                                → Order Service cancels
        │
        ▼
4. Shipping Service hears event → schedules shipment
   Success: "ShipmentScheduled"
   Failure: "ShipmentFailed" → Inventory releases stock
                              → Payment refunds
                              → Order cancels
```

```
HAPPY PATH:

OrderCreated → PaymentCompleted → StockReserved → ShipmentScheduled
    │               │                  │                │
    ▼               ▼                  ▼                ▼
 Order DB       Payment DB        Inventory DB     Shipping DB

FAILURE (stock insufficient):

OrderCreated → PaymentCompleted → StockInsufficient
                     │                    │
                     ▼                    ▼
              PaymentRefunded        (compensating)
                     │
                     ▼
              OrderCanceled
              (compensating)
```

### Orchestration-based saga

A central orchestrator directs the flow. Simpler to understand and debug.

```
┌──────────────────────────────────────────────┐
│              SAGA ORCHESTRATOR               │
│                                              │
│  Step 1: Call Payment Service                │
│    ├── Success → Step 2                      │
│    └── Failure → Cancel order                │
│                                              │
│  Step 2: Call Inventory Service              │
│    ├── Success → Step 3                      │
│    └── Failure → Refund payment, cancel      │
│                                              │
│  Step 3: Call Shipping Service               │
│    ├── Success → Complete                    │
│    └── Failure → Release stock, refund, cancel│
└──────────────────────────────────────────────┘
```

### Go saga orchestrator

```go
type SagaStep struct {
	Name       string
	Execute    func(ctx context.Context, state *SagaState) error
	Compensate func(ctx context.Context, state *SagaState) error
}

type SagaState struct {
	OrderID   string
	UserID    string
	Items     []OrderItem
	Total     float64
	PaymentID string
	Results   map[string]interface{}
}

type SagaOrchestrator struct {
	steps []SagaStep
}

func NewOrderSaga(
	payments PaymentService,
	inventory InventoryService,
	shipping ShippingService,
) *SagaOrchestrator {
	return &SagaOrchestrator{
		steps: []SagaStep{
			{
				Name: "process_payment",
				Execute: func(ctx context.Context, state *SagaState) error {
					paymentID, err := payments.Charge(ctx, state.UserID, state.Total)
					if err != nil {
						return fmt.Errorf("charge payment: %w", err)
					}
					state.PaymentID = paymentID
					return nil
				},
				Compensate: func(ctx context.Context, state *SagaState) error {
					return payments.Refund(ctx, state.PaymentID)
				},
			},
			{
				Name: "reserve_inventory",
				Execute: func(ctx context.Context, state *SagaState) error {
					return inventory.Reserve(ctx, state.OrderID, state.Items)
				},
				Compensate: func(ctx context.Context, state *SagaState) error {
					return inventory.Release(ctx, state.OrderID)
				},
			},
			{
				Name: "schedule_shipping",
				Execute: func(ctx context.Context, state *SagaState) error {
					return shipping.Schedule(ctx, state.OrderID, state.UserID)
				},
				Compensate: func(ctx context.Context, state *SagaState) error {
					return shipping.Cancel(ctx, state.OrderID)
				},
			},
		},
	}
}

func (s *SagaOrchestrator) Execute(ctx context.Context, state *SagaState) error {
	completedSteps := make([]int, 0, len(s.steps))

	for i, step := range s.steps {
		if err := step.Execute(ctx, state); err != nil {
			compensateErr := s.compensate(ctx, state, completedSteps)
			if compensateErr != nil {
				return fmt.Errorf("step %s failed: %w; compensation also failed: %v",
					step.Name, err, compensateErr)
			}
			return fmt.Errorf("step %s failed (compensated): %w", step.Name, err)
		}
		completedSteps = append(completedSteps, i)
	}

	return nil
}

func (s *SagaOrchestrator) compensate(ctx context.Context, state *SagaState, completed []int) error {
	var errs []error
	for i := len(completed) - 1; i >= 0; i-- {
		stepIdx := completed[i]
		if err := s.steps[stepIdx].Compensate(ctx, state); err != nil {
			errs = append(errs, fmt.Errorf("compensate %s: %w",
				s.steps[stepIdx].Name, err))
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("compensation errors: %v", errs)
	}
	return nil
}
```

### Choreography vs Orchestration

```
┌──────────────────┬──────────────────┬──────────────────┐
│                  │  Choreography    │  Orchestration   │
├──────────────────┼──────────────────┼──────────────────┤
│ Coordination     │ Decentralized    │ Central          │
│ Coupling         │ Loose            │ Moderate         │
│ Visibility       │ Hard to trace    │ Easy to trace    │
│ Complexity       │ Grows fast       │ Contained        │
│ Single point     │ None             │ Orchestrator     │
│ of failure       │                  │                  │
│ Best for         │ Simple sagas     │ Complex sagas    │
│                  │ (2-3 steps)      │ (4+ steps)       │
└──────────────────┴──────────────────┴──────────────────┘
```

---

## Eventual Consistency: Embracing the Delay

In event-driven systems, the read model is always slightly behind the
write model. An event is published, and projections take time to process
it. This is eventual consistency and it's fundamental to event-driven
architecture.

### Handling it in the UI

```
User places order → API returns order ID immediately
User refreshes page → Read model might not have the order yet

Solutions:

1. RETURN THE RESULT DIRECTLY
   After writing, return the created object from the write
   path, not the read model.

2. OPTIMISTIC UI
   Client assumes success and shows the result immediately.
   Background sync confirms later.

3. POLLING WITH TIMEOUT
   Client polls the read model for a few seconds until the
   projection catches up.

4. WEBSOCKET NOTIFICATION
   Server pushes an update when the projection is ready.
```

### TypeScript: Optimistic response pattern

```typescript
async function placeOrder(
  commandHandler: OrderCommandHandler,
  queryHandler: OrderQueryHandler,
  cmd: PlaceOrderCommand
): Promise<OrderResponse> {
  const orderId = await commandHandler.handle(cmd);

  const optimisticResponse: OrderResponse = {
    id: orderId,
    userId: cmd.userId,
    items: cmd.items,
    status: "placed",
    createdAt: new Date().toISOString(),
  };

  return optimisticResponse;
}

async function getOrderWithRetry(
  queryHandler: OrderQueryHandler,
  orderId: string,
  maxRetries: number = 5,
  delayMs: number = 200
): Promise<OrderView | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const order = await queryHandler.getOrder({ type: "GetOrder", orderId });
    if (order) {
      return order;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}
```

---

## When to Use Event-Driven Architecture

### Good fit

- **Audit requirements**: You need a complete history of changes
  (financial systems, healthcare, compliance)
- **Multiple consumers**: Many services need to react to the same
  business events
- **Temporal queries**: "What was the state at 3 PM yesterday?"
- **Complex domains**: Where the sequence of events matters as much as
  the current state
- **Decoupled services**: You want services to evolve independently

### Bad fit

- **Simple CRUD**: A blog or landing page doesn't need event sourcing
- **Strong consistency required everywhere**: Event-driven systems are
  eventually consistent by nature
- **Small team**: The operational complexity of Kafka, event stores, and
  projections is significant
- **Low data volume**: Event sourcing adds overhead. If you have 1,000
  entities, just use PostgreSQL normally

---

## The Full Picture: Putting It Together

```
┌──────────────────────────────────────────────────────────────────┐
│                   EVENT-DRIVEN E-COMMERCE                        │
│                                                                  │
│  ┌──────────┐  cmd   ┌──────────────┐  event  ┌──────────────┐  │
│  │  API     │───────►│ Order Write  │────────►│  Kafka       │  │
│  │  Gateway │        │ Model        │         │  Event Bus   │  │
│  └────┬─────┘        │              │         └──────┬───────┘  │
│       │              │ Event Store  │                │          │
│       │              │ (PostgreSQL) │                │          │
│       │              └──────────────┘    ┌───────────┼────────┐ │
│       │                                 │           │        │ │
│       │  query                          ▼           ▼        ▼ │
│       │              ┌──────────┐  ┌────────┐ ┌────────┐ ┌───┐ │
│       └─────────────►│  Order   │  │Payment │ │Shipping│ │...│ │
│                      │  Read    │  │Service │ │Service │ │   │ │
│                      │  Model   │  └────────┘ └────────┘ └───┘ │
│                      │(Denorm.  │                               │
│                      │ Postgres │  Each service:                │
│                      │ or Redis)│  - Consumes events            │
│                      └──────────┘  - Has its own database       │
│                      ▲             - Publishes its own events   │
│                      │                                          │
│                      └── Projection (reads events,              │
│                          updates read model)                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Common Mistakes

### Mistake 1: Event sourcing everything

Event sourcing adds complexity. Use it where you need an audit trail,
temporal queries, or complex domain logic. Use simple CRUD everywhere
else.

### Mistake 2: Huge events

Events should carry the minimum data needed. Don't put the entire user
object in every event. Include the changed fields and an ID to look up
the rest.

```
BAD:  { type: "AddressChanged", user: { ...entire user object... } }
GOOD: { type: "AddressChanged", userId: "123", newAddress: { ... } }
```

### Mistake 3: Not handling projection failures

If a projection crashes, the read model is stale. You need monitoring,
alerting, and the ability to rebuild projections from the event store.

### Mistake 4: Treating events as commands

Events are facts about the past. Don't design events that tell other
services what to do. "OrderCreated" is correct. "ProcessPayment" is a
command, not an event.

### Mistake 5: Ignoring schema evolution

Events are stored forever. What happens when you add a field to an
event? Old events don't have it. You need a strategy for event schema
versioning (upcasting old events, supporting multiple versions).

---

## Key Takeaways

1. **Events record what happened.** Commands request actions. Events are
   immutable facts. This distinction drives the entire architecture.

2. **Event sourcing stores events, not state.** Current state is derived
   by replaying events. You get a full audit trail and can answer
   questions you didn't anticipate.

3. **CQRS separates reads from writes.** Write model optimized for
   validation and consistency. Read model optimized for queries and
   speed.

4. **Sagas handle distributed transactions.** Choreography for simple
   flows, orchestration for complex ones. Always have compensating
   actions.

5. **Eventual consistency is the trade-off.** Read models lag behind
   writes. Design your UI to handle this gracefully.

6. **Kafka is the de facto event bus** for event-driven architectures
   at scale. Its durability and replay capability are key.

7. **Don't use event-driven for simple CRUD.** The complexity is only
   justified when you need audit trails, event replay, or highly
   decoupled services.

8. **Projections are rebuildable.** If your read model gets corrupted,
   replay events from the store to rebuild it.

Next: [Lesson 13 — API Design: REST, GraphQL, gRPC, and Webhooks](./13-api-design.md)
