# Lesson 13: Event Sourcing

> **The one thing to remember**: Instead of storing what things ARE
> (current state), event sourcing stores what HAPPENED (history).
> It's like a bank account: you don't just store "balance = $500."
> You store every deposit, withdrawal, and transfer. The balance
> is calculated from the history. You can always explain WHY the
> balance is $500 and replay history to any point in time.

---

## The Bank Account Analogy

Traditional database approach (state-based):

```
TRADITIONAL: Store current state

  accounts table:
  +------------+---------+
  | account_id | balance |
  +------------+---------+
  | acc-001    | 500.00  |
  +------------+---------+

  Questions you CAN answer:  "What's the balance?"
  Questions you CAN'T answer:
    "How did we get to $500?"
    "What was the balance on January 10th?"
    "Was there a suspicious withdrawal last week?"
    "Why does the customer think their balance is wrong?"
```

Event sourcing approach (history-based):

```
EVENT SOURCING: Store what happened

  events table:
  +-----+------------------+------------------+--------+-----------+
  | seq | timestamp        | event_type       | amount | balance   |
  +-----+------------------+------------------+--------+-----------+
  | 1   | 2024-01-01 09:00 | AccountOpened    | 0.00   | 0.00     |
  | 2   | 2024-01-05 14:30 | MoneyDeposited   | 1000   | 1000.00  |
  | 3   | 2024-01-10 11:00 | MoneyWithdrawn   | 200    | 800.00   |
  | 4   | 2024-01-15 16:45 | MoneyWithdrawn   | 50     | 750.00   |
  | 5   | 2024-01-20 09:15 | MoneyDeposited   | 250    | 1000.00  |
  | 6   | 2024-01-25 13:00 | MoneyWithdrawn   | 500    | 500.00   |
  +-----+------------------+------------------+--------+-----------+

  Current balance: replay all events = $500
  Balance on Jan 10: replay events 1-3 = $800
  Full audit trail: every transaction is recorded forever
```

---

## How Event Sourcing Works

### The Event Store

The event store is an append-only log of events. You never update
or delete events — you only add new ones.

```
EVENT STORE RULES

  1. Events are IMMUTABLE (never change an event)
  2. Events are APPEND-ONLY (only add to the end)
  3. Events are ORDERED (per aggregate/entity)
  4. Events are the SOURCE OF TRUTH (not a cache, not a copy)

  +-----+  +-----+  +-----+  +-----+  +-----+
  | e1  |  | e2  |  | e3  |  | e4  |  | e5  |  --> time
  +-----+  +-----+  +-----+  +-----+  +-----+
  You can only append here ----------------------->
  You CANNOT modify e1, e2, e3, etc.
```

### Aggregates: Grouping Events

Events are grouped by **aggregate** — a cluster of related objects
treated as a unit. An order aggregate might include the order and
its line items.

```
AGGREGATE: Order #789

  Events for aggregate "order-789":
  1. OrderCreated      { items: ["shoe", "hat"], total: 89.99 }
  2. PaymentReceived   { amount: 89.99, method: "visa" }
  3. ItemShipped       { item: "shoe", tracking: "UPS-123" }
  4. ItemShipped       { item: "hat", tracking: "UPS-124" }
  5. OrderCompleted    { }

  Current state (rebuilt from events):
  {
    order_id: "789",
    status: "completed",
    items: [
      { name: "shoe", status: "shipped", tracking: "UPS-123" },
      { name: "hat", status: "shipped", tracking: "UPS-124" }
    ],
    payment: { amount: 89.99, method: "visa" },
    total: 89.99
  }
```

### Rebuilding State from Events

To get the current state, you replay all events for an aggregate:

```python
class Order:
    def __init__(self):
        self.order_id = None
        self.status = None
        self.items = []
        self.payment = None
        self.total = 0

    def apply(self, event):
        if event['type'] == 'OrderCreated':
            self.order_id = event['order_id']
            self.status = 'created'
            self.items = [
                {'name': i, 'status': 'pending'}
                for i in event['data']['items']
            ]
            self.total = event['data']['total']

        elif event['type'] == 'PaymentReceived':
            self.status = 'paid'
            self.payment = {
                'amount': event['data']['amount'],
                'method': event['data']['method']
            }

        elif event['type'] == 'ItemShipped':
            for item in self.items:
                if item['name'] == event['data']['item']:
                    item['status'] = 'shipped'
                    item['tracking'] = event['data']['tracking']

            if all(i['status'] == 'shipped' for i in self.items):
                self.status = 'all_shipped'

        elif event['type'] == 'OrderCompleted':
            self.status = 'completed'

    @classmethod
    def from_events(cls, events):
        order = cls()
        for event in events:
            order.apply(event)
        return order


events = event_store.get_events(aggregate_id='order-789')
order = Order.from_events(events)
```

---

## Projections: Read-Optimized Views

Replaying events every time you need to read data is slow.
**Projections** solve this by building read-optimized views from
the event stream.

```
PROJECTIONS: Building Views from Events

  Event Stream:                    Projections:
  +------------------+
  | OrderCreated     |---+-------> [Orders Table]
  | PaymentReceived  |   |         order_id | status | total
  | ItemShipped      |   |         789      | shipped| 89.99
  | OrderCompleted   |   |
  +------------------+   |
                         +-------> [Revenue Dashboard]
                         |         date       | revenue
                         |         2024-01-15 | 12,450.00
                         |
                         +-------> [Customer Order History]
                                   customer | orders | lifetime_value
                                   cust-456 | 23     | 2,340.00

  One event stream feeds MULTIPLE projections.
  Each projection is optimized for its specific query pattern.
```

```python
class OrderSummaryProjection:
    def __init__(self, database):
        self.db = database

    def handle(self, event):
        if event['type'] == 'OrderCreated':
            self.db.execute(
                "INSERT INTO order_summary (order_id, status, total, customer_id) "
                "VALUES (%s, %s, %s, %s)",
                (event['aggregate_id'], 'created',
                 event['data']['total'], event['data']['customer_id'])
            )

        elif event['type'] == 'PaymentReceived':
            self.db.execute(
                "UPDATE order_summary SET status = 'paid' WHERE order_id = %s",
                (event['aggregate_id'],)
            )

        elif event['type'] == 'OrderCompleted':
            self.db.execute(
                "UPDATE order_summary SET status = 'completed' WHERE order_id = %s",
                (event['aggregate_id'],)
            )
```

**Key insight**: Projections are disposable. If one is wrong or
needs to change, you delete it and rebuild it by replaying all
events from the beginning. The event stream is the truth;
projections are just views.

```
REBUILDING A PROJECTION

  1. Drop the projection table
  2. Create the new schema
  3. Replay ALL events through the new projection handler
  4. Switch traffic to the new projection

  This is like rebuilding an index in a database —
  the data isn't lost, just reorganized.
```

---

## Snapshots: Performance Optimization

For aggregates with thousands of events, replaying from the
beginning is slow. **Snapshots** save the state at a point in time.

```
SNAPSHOTS

  Without snapshot:
  [e1] [e2] [e3] ... [e9997] [e9998] [e9999] [e10000]
  ^--- replay all 10,000 events to get current state ---^

  With snapshot (taken at event 9900):
  [e1] ... [e9900] --> SNAPSHOT: { balance: 4250.00, ... }
                       [e9901] [e9902] ... [e10000]
                       ^--- replay only 100 events ---^

  Load snapshot + replay events after snapshot = current state
  MUCH faster for long-lived aggregates.
```

```python
class AccountRepository:
    def load(self, account_id):
        snapshot = self.snapshot_store.get_latest(account_id)

        if snapshot:
            account = Account.from_snapshot(snapshot)
            events = self.event_store.get_events(
                aggregate_id=account_id,
                after_version=snapshot['version']
            )
        else:
            account = Account()
            events = self.event_store.get_events(
                aggregate_id=account_id
            )

        for event in events:
            account.apply(event)

        return account

    def save(self, account, new_events):
        self.event_store.append(account.id, new_events)

        if account.version % 100 == 0:
            self.snapshot_store.save(account.id, account.to_snapshot())
```

---

## When to Use Event Sourcing

```
GOOD FIT:

  Audit requirements    - Financial systems, healthcare, compliance
                         "Show me exactly what happened and when"

  Temporal queries      - "What was the state on March 15th?"
                         "Show me the state before this bug"

  Complex domains       - Where the history IS the business logic
                         Insurance claims, legal proceedings

  Event-driven systems  - You're already publishing events;
                         storing them is a natural extension

  Debugging             - "Why is this account in this state?"
                         Replay events to reproduce the bug


BAD FIT:

  Simple CRUD           - Blog posts, user profiles, settings
                         Just use a regular database

  High-frequency updates- IoT sensors writing 1000x/second per device
                         Event store grows too fast

  Simple queries        - "Give me user by ID"
                         The projection overhead isn't worth it

  Small team            - Event sourcing adds complexity
                         Make sure the benefits justify the cost
```

---

## Common Pitfalls

### 1. Modifying Events

Never change an event after it's stored. If you made a mistake,
add a new compensating event:

```
WRONG: Edit the event
  Event 3: MoneyWithdrawn { amount: 200 } --> change to 150

RIGHT: Add a compensating event
  Event 3: MoneyWithdrawn { amount: 200 }
  Event 7: WithdrawalCorrected { original: 200, corrected: 150 }
```

### 2. Giant Events

Don't store large blobs in events. Store references:

```
WRONG: { type: "PhotoUploaded", image_data: "<10MB base64>" }
RIGHT: { type: "PhotoUploaded", image_url: "s3://bucket/photo.jpg" }
```

### 3. Using Events as the Only Read Model

Without projections, every read requires replaying events. Build
projections for your query patterns.

### 4. Forgetting Schema Evolution

Events are stored forever. Version 1 events will be replayed
alongside version 5 events. Your replay logic must handle all
versions.

```python
def apply(self, event):
    if event['type'] == 'OrderCreated':
        if event.get('version', 1) == 1:
            self.total = event['data']['total']
            self.currency = 'USD'
        elif event['version'] == 2:
            self.total = event['data']['total']
            self.currency = event['data']['currency']
```

---

## Exercises

1. **Model an aggregate**: Design events for a shopping cart.
   Include: add item, remove item, change quantity, apply coupon,
   checkout. Show how to rebuild the cart state from events.

2. **Build projections**: Given the shopping cart events above,
   design three projections: (a) current cart contents, (b)
   abandoned cart report, (c) most popular items this week.

3. **Snapshot strategy**: Your bank account aggregate has 50,000
   events. Design a snapshot strategy. How often do you take
   snapshots? What data goes in the snapshot? How do you handle
   snapshot + events consistency?

4. **Time travel**: Using your shopping cart model, write a
   function that returns the cart state at any given timestamp.
   Test it by rebuilding the cart at 3 different points in time.

---

[Next: Lesson 14 — CQRS](./14-cqrs.md)
