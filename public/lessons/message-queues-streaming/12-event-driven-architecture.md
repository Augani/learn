# Lesson 12: Event-Driven Architecture

> **The one thing to remember**: Event-driven architecture is like
> a fire alarm system. No one calls each department individually
> when there's a fire. The alarm goes off (event), and everyone who
> cares — fire department, building management, security — responds
> independently. The alarm doesn't know or care who's listening.
> Each responder decides what to do on their own.

---

## What Is an Event?

An event is a record that something happened. Not a command to
do something, not a request for data — just a statement of fact.

```
EVENTS vs COMMANDS vs QUERIES

  EVENT:   "Order #789 was placed"        (something happened)
  COMMAND: "Process order #789"           (do this thing)
  QUERY:   "What's the status of #789?"  (give me information)

  Events are past tense: "was placed", "was shipped", "was cancelled"
  Commands are imperative: "process this", "send this", "charge this"

  The distinction matters:
  - Events are facts. They already happened. Can't be rejected.
  - Commands are requests. They can fail or be refused.
```

```
EVENT EXAMPLE

  {
    "event_type": "OrderPlaced",
    "event_id": "evt-abc-123",
    "timestamp": "2024-01-15T10:30:00Z",
    "aggregate_id": "order-789",
    "data": {
      "customer_id": "cust-456",
      "items": [
        {"sku": "SHOE-42", "quantity": 1, "price": 59.99}
      ],
      "total": 59.99
    },
    "metadata": {
      "correlation_id": "req-xyz-789",
      "source": "order-service",
      "version": 1
    }
  }
```

---

## Event Types

### Domain Events

Things that happen within a bounded context (a single service or
module). They represent business-meaningful occurrences.

```
DOMAIN EVENTS (internal to a service)

  Order Service:
    OrderPlaced
    OrderConfirmed
    OrderShipped
    OrderDelivered
    OrderCancelled

  Payment Service:
    PaymentInitiated
    PaymentAuthorized
    PaymentCaptured
    PaymentRefunded

  Inventory Service:
    ItemReserved
    ItemReleased
    StockLevelChanged
    ReorderPointReached
```

### Integration Events

Events published for OTHER services to consume. They cross service
boundaries. Usually a subset of domain events, with careful schema
design.

```
DOMAIN EVENT vs INTEGRATION EVENT

  Domain Event (internal):
  {
    "type": "PaymentCaptured",
    "payment_id": "pay-001",
    "stripe_charge_id": "ch_xxx",        <-- internal detail
    "processor_response_code": "00",     <-- internal detail
    "retry_count": 2,                    <-- internal detail
    "amount": 59.99,
    "customer_id": "cust-456"
  }

  Integration Event (published externally):
  {
    "type": "PaymentCompleted",
    "payment_id": "pay-001",
    "amount": 59.99,
    "customer_id": "cust-456",
    "order_id": "order-789"
  }

  The integration event hides internal details.
  Other services don't need to know about Stripe
  or retry counts. They just need the outcome.
```

---

## The Event Bus

The event bus is the infrastructure that carries events between
services. It could be Kafka, RabbitMQ, or a cloud service like
AWS EventBridge.

```
EVENT BUS ARCHITECTURE

  +----------+     +----------+     +----------+
  | Order    |     | Payment  |     | Inventory|
  | Service  |     | Service  |     | Service  |
  +----+-----+     +----+-----+     +----+-----+
       |                |                |
       v                v                v
  +-------------------------------------------------+
  |              EVENT BUS (Kafka / RabbitMQ)        |
  |                                                  |
  |  Topics:                                         |
  |    orders.*    payments.*    inventory.*          |
  +-------------------------------------------------+
       |                |                |
       v                v                v
  +----------+     +----------+     +----------+
  | Email    |     | Analytics|     | Audit    |
  | Service  |     | Service  |     | Service  |
  +----------+     +----------+     +----------+

  Any service can publish events.
  Any service can subscribe to events.
  Services don't know about each other.
```

---

## Choreography vs Orchestration

When multiple services need to work together (like processing an
order), who coordinates? There are two approaches.

### Choreography: Dance Without a Director

Each service listens for events and decides what to do. No central
coordinator. Like dancers who know their routine and respond to
the music.

```
CHOREOGRAPHY: Order Processing

  1. Order Service publishes: "OrderPlaced"

  2. Inventory Service hears "OrderPlaced"
     --> Reserves items
     --> Publishes "ItemsReserved"

  3. Payment Service hears "ItemsReserved"
     --> Charges customer
     --> Publishes "PaymentCompleted"

  4. Shipping Service hears "PaymentCompleted"
     --> Schedules shipment
     --> Publishes "ShipmentScheduled"

  5. Notification Service hears "ShipmentScheduled"
     --> Sends email to customer

  Each service independently reacts to events.
  No central coordinator telling anyone what to do.
```

```
CHOREOGRAPHY FLOW DIAGRAM

  Order        Inventory      Payment       Shipping     Notification
  Service      Service        Service       Service      Service
     |             |              |             |             |
     |--OrderPlaced-->|           |             |             |
     |             |              |             |             |
     |          [reserve]         |             |             |
     |             |              |             |             |
     |             |--ItemsReserved-->|         |             |
     |             |              |             |             |
     |             |           [charge]         |             |
     |             |              |             |             |
     |             |              |--PaymentCompleted-->|     |
     |             |              |             |             |
     |             |              |          [schedule]       |
     |             |              |             |             |
     |             |              |             |--Scheduled-->|
     |             |              |             |             |
     |             |              |             |         [send email]
```

**Pros of choreography**:
- No single point of failure
- Services are truly independent
- Easy to add new services (just subscribe)

**Cons of choreography**:
- Hard to understand the full flow
- Hard to monitor "where is my order?"
- Difficult to handle failures across services
- Can become a tangled web of event dependencies

### Orchestration: A Conductor Directs

A central service (the orchestrator) tells other services what to
do and when. Like a conductor leading an orchestra.

```
ORCHESTRATION: Order Processing

  Order Saga Orchestrator:
  1. Send command: "ReserveItems" --> Inventory Service
  2. Wait for response: "ItemsReserved"
  3. Send command: "ChargeCustomer" --> Payment Service
  4. Wait for response: "PaymentCompleted"
  5. Send command: "ScheduleShipment" --> Shipping Service
  6. Wait for response: "ShipmentScheduled"
  7. Send command: "SendConfirmation" --> Notification Service

  The orchestrator knows the full workflow.
  It tells each service what to do, one step at a time.
```

```
ORCHESTRATION FLOW DIAGRAM

  Orchestrator   Inventory    Payment     Shipping    Notification
       |             |           |            |            |
       |--Reserve--->|           |            |            |
       |<--Reserved--|           |            |            |
       |             |           |            |            |
       |--Charge---------------->|            |            |
       |<--Charged---------------|            |            |
       |             |           |            |            |
       |--Ship------------------------------>|            |
       |<--Shipped----------------------------            |
       |             |           |            |            |
       |--Notify------------------------------------------->|
       |<--Sent--------------------------------------------|
       |             |           |            |            |
     [DONE]
```

**Pros of orchestration**:
- Easy to understand the full flow
- Easy to monitor progress
- Clear error handling (orchestrator handles failures)

**Cons of orchestration**:
- Orchestrator is a single point of failure
- Services become coupled to the orchestrator
- Harder to add new steps (must modify orchestrator)

---

## When to Use Which

```
DECISION GUIDE

  Few services (2-4), simple flow?
  --> Choreography works fine

  Many services, complex flow with conditions?
  --> Orchestration is easier to manage

  Need to add new reactions without changing existing services?
  --> Choreography (just subscribe to events)

  Need to guarantee order of operations?
  --> Orchestration (orchestrator controls sequence)

  Need clear visibility into process state?
  --> Orchestration (orchestrator tracks state)

  HYBRID APPROACH (common in practice):
  Use orchestration for critical business processes (order flow)
  Use choreography for cross-cutting concerns (analytics, audit)
```

---

## The Saga Pattern

When a business process spans multiple services, you can't use
traditional database transactions. The **saga pattern** breaks
the process into steps, each with a compensating action for
rollback.

```
SAGA: Order Processing with Compensation

  Happy path:
  1. Reserve inventory       ✓
  2. Charge payment          ✓
  3. Schedule shipping       ✓
  --> Order complete!

  Failure at step 3:
  1. Reserve inventory       ✓
  2. Charge payment          ✓
  3. Schedule shipping       ✗ (failed!)
  --> COMPENSATE:
  2c. Refund payment         ✓ (undo step 2)
  1c. Release inventory      ✓ (undo step 1)
  --> Order cancelled, everything rolled back.
```

```
SAGA COMPENSATION TABLE

  +----+-------------------+------------------------+
  | #  | Action            | Compensating Action    |
  +----+-------------------+------------------------+
  | 1  | Reserve inventory | Release inventory      |
  | 2  | Charge payment    | Refund payment         |
  | 3  | Schedule shipping | Cancel shipment        |
  | 4  | Send confirmation | Send cancellation email|
  +----+-------------------+------------------------+

  If step N fails, run compensations for N-1, N-2, ... 1
  in reverse order.
```

```python
class OrderSaga:
    def __init__(self, order):
        self.order = order
        self.completed_steps = []

    def execute(self):
        steps = [
            ('reserve_inventory', 'release_inventory'),
            ('charge_payment', 'refund_payment'),
            ('schedule_shipping', 'cancel_shipment'),
            ('send_confirmation', 'send_cancellation'),
        ]

        for action, compensation in steps:
            try:
                getattr(self, action)()
                self.completed_steps.append(compensation)
            except Exception as e:
                self.compensate()
                raise SagaFailedError(f"Failed at {action}: {e}")

    def compensate(self):
        for compensation in reversed(self.completed_steps):
            try:
                getattr(self, compensation)()
            except Exception as e:
                log_compensation_failure(compensation, e)

    def reserve_inventory(self):
        publish_command('inventory.reserve', self.order)

    def release_inventory(self):
        publish_command('inventory.release', self.order)

    def charge_payment(self):
        publish_command('payment.charge', self.order)

    def refund_payment(self):
        publish_command('payment.refund', self.order)

    def schedule_shipping(self):
        publish_command('shipping.schedule', self.order)

    def cancel_shipment(self):
        publish_command('shipping.cancel', self.order)

    def send_confirmation(self):
        publish_command('notification.order_confirmed', self.order)

    def send_cancellation(self):
        publish_command('notification.order_cancelled', self.order)
```

---

## Event Schema Evolution

As your system evolves, event schemas change. Handling this without
breaking consumers is critical.

```
SCHEMA EVOLUTION STRATEGIES

  1. ADDITIVE ONLY (safest):
     v1: { "order_id": "789", "total": 59.99 }
     v2: { "order_id": "789", "total": 59.99, "currency": "USD" }

     Old consumers ignore the new field.
     New consumers use it if present, default if not.

  2. VERSION FIELD:
     { "version": 2, "order_id": "789", ... }

     Consumers check version and handle accordingly.

  3. SEPARATE TOPICS PER VERSION:
     orders-v1, orders-v2

     Clean separation but operational overhead.

  RULES:
  - Never remove a field
  - Never rename a field
  - Never change a field's type
  - Always add new fields as optional with defaults
```

---

## Exercises

1. **Design events**: You're building a food delivery app. Design
   the domain events for: restaurant, delivery driver, customer,
   and payment services. Which events are domain events and which
   become integration events?

2. **Choreography vs orchestration**: Draw both a choreography and
   orchestration diagram for a hotel booking system that involves:
   room reservation, payment, loyalty points, and confirmation
   email. Which approach would you choose and why?

3. **Saga design**: Design a saga for a flight + hotel booking
   system. What are the compensating actions if the hotel booking
   fails after the flight is booked?

4. **Schema evolution**: Your OrderPlaced event currently has
   `total` as a number. You need to add currency support. Design
   a backward-compatible schema change that works with both old
   and new consumers.

---

[Next: Lesson 13 — Event Sourcing](./13-event-sourcing.md)
