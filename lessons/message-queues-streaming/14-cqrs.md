# Lesson 14: CQRS — Command Query Responsibility Segregation

> **The one thing to remember**: CQRS means using a different model
> to read data than the one you use to write data. Think of a
> restaurant: the kitchen (write side) has raw ingredients, prep
> stations, and recipes. The menu (read side) has photos, prices,
> and descriptions. They represent the same food, but they're
> organized completely differently because they serve different
> purposes.

---

## The Problem CQRS Solves

In a traditional application, the same database model handles both
reads and writes:

```
TRADITIONAL: One Model for Everything

  User Request --> [Application] --> [Database]
                     |     ^
                     |     |
                   Write  Read
                     |     |
                     v     |
               Same table, same schema,
               same indexes, same model

  Problem: The best structure for WRITING data
  is rarely the best structure for READING data.
```

Consider an e-commerce order:

**For writing**, you need normalized tables: orders, order_items,
customers, products, addresses. Each table has one responsibility.
Writes are fast and consistent.

**For reading**, you need the order summary page: order status,
customer name, all items with names and prices, shipping address,
tracking number — all in one query. This requires joining 6 tables.

```sql
-- READING: Needs data from everywhere (slow, complex)
SELECT o.id, o.status, o.total,
       c.name, c.email,
       a.street, a.city, a.state,
       GROUP_CONCAT(p.name) as items
FROM orders o
JOIN customers c ON o.customer_id = c.id
JOIN addresses a ON o.shipping_address_id = a.id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE o.id = 'ord-789'
GROUP BY o.id;

-- WRITING: Simple, targeted (fast)
INSERT INTO orders (id, customer_id, status, total)
VALUES ('ord-789', 'cust-456', 'created', 59.99);
```

CQRS says: don't force one model to do both jobs.

---

## Separating Reads and Writes

```
CQRS: Two Models

  Commands (Writes)                    Queries (Reads)
  +-----------------+                  +-----------------+
  | "PlaceOrder"    |                  | "GetOrderView"  |
  | "CancelOrder"   |                  | "ListOrders"    |
  | "UpdateAddress" |                  | "SearchOrders"  |
  +--------+--------+                  +--------+--------+
           |                                    |
           v                                    v
  +--------+--------+                  +--------+--------+
  | Write Model     |                  | Read Model      |
  | (Normalized,    |  ----events--->  | (Denormalized,  |
  | optimized for   |                  | optimized for   |
  | consistency)    |                  | fast queries)   |
  +-----------------+                  +-----------------+
  |  orders table   |                  | order_views     |
  |  items table    |                  | (all data in    |
  |  customers table|                  |  one document)  |
  +-----------------+                  +-----------------+
```

The write side handles commands: PlaceOrder, CancelOrder,
UpdateAddress. It uses a normalized relational model optimized
for data integrity and consistency.

The read side handles queries: GetOrderDetails, ListOrders,
SearchByCustomer. It uses a denormalized model (or multiple
models) optimized for specific query patterns.

---

## How the Read Model Stays Updated

The read model is updated asynchronously when the write model
changes. This is where event-driven architecture connects.

```
DATA FLOW IN CQRS

  1. Command arrives: "PlaceOrder"
  2. Write model validates and processes
  3. Write model publishes event: "OrderPlaced"
  4. Read model handler receives event
  5. Read model updates its denormalized view

  +----------+    Command     +------------+
  | Client   |--------------->| Write Side |
  +----------+                +-----+------+
       |                            |
       |                       Event: "OrderPlaced"
       |                            |
       |                            v
       |                      +-----+------+
       |                      | Event Bus  |
       |                      +-----+------+
       |                            |
       |                            v
       |                      +-----+------+
       |    Query             | Read Side  |
       +--------------------->| (Updated   |
                              |  view)     |
                              +------------+
```

```python
class OrderCommandHandler:
    def handle_place_order(self, command):
        order = Order.create(
            customer_id=command['customer_id'],
            items=command['items']
        )
        self.write_db.save(order)

        self.event_bus.publish({
            'type': 'OrderPlaced',
            'order_id': order.id,
            'customer_id': order.customer_id,
            'items': order.items,
            'total': order.total,
            'timestamp': datetime.utcnow().isoformat()
        })


class OrderReadModelHandler:
    def handle_order_placed(self, event):
        customer = self.read_db.get_customer(event['customer_id'])

        self.read_db.upsert('order_views', {
            'order_id': event['order_id'],
            'customer_name': customer['name'],
            'customer_email': customer['email'],
            'items': event['items'],
            'total': event['total'],
            'status': 'placed',
            'placed_at': event['timestamp']
        })

    def handle_order_shipped(self, event):
        self.read_db.update('order_views',
            {'order_id': event['order_id']},
            {'status': 'shipped', 'tracking': event['tracking']}
        )
```

---

## Eventual Consistency: The Tradeoff

With CQRS, there's a delay between a write and the read model
being updated. This is **eventual consistency**.

```
EVENTUAL CONSISTENCY TIMELINE

  t=0ms:    User places order (write)
  t=1ms:    Write model updated
  t=5ms:    Event published
  t=50ms:   Read model handler receives event
  t=55ms:   Read model updated

  During t=1ms to t=55ms, the read model is STALE.
  If the user queries immediately, they might not see their order.
```

This sounds scary, but it's actually very common. Think about:
- You post on social media. It takes a few seconds to appear.
- You transfer money between bank accounts. It takes hours.
- You ship a package. Tracking updates take hours.

Most systems already deal with eventual consistency — CQRS just
makes it explicit.

### Handling the Consistency Gap

**Strategy 1: Read-your-writes consistency**

After a write, redirect the user to a page that reads from the
write model (or includes the data they just submitted):

```python
def place_order(request):
    order = create_order(request.data)

    return Response({
        'order_id': order.id,
        'status': 'placed',
        'message': 'Your order has been placed!'
    })
```

**Strategy 2: Optimistic UI**

The frontend shows the expected result immediately, without waiting
for the read model:

```javascript
async function placeOrder(orderData) {
  const response = await fetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify(orderData)
  });
  const result = await response.json();

  addToOrdersList({
    id: result.order_id,
    status: 'placed',
    items: orderData.items,
    total: orderData.total
  });
}
```

**Strategy 3: Polling or websockets**

Wait for the read model to catch up:

```javascript
async function waitForOrderView(orderId, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`/api/orders/${orderId}`);
    if (response.ok) return response.json();
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Order view not ready');
}
```

---

## Multiple Read Models

One of CQRS's biggest advantages: you can create multiple read
models optimized for different query patterns. All fed from the
same events.

```
MULTIPLE READ MODELS

  Write Model (events)
       |
       +---> [Order List View]
       |     For: "Show me my recent orders"
       |     Store: PostgreSQL, sorted by date
       |
       +---> [Order Search Index]
       |     For: "Search orders by product name"
       |     Store: Elasticsearch
       |
       +---> [Revenue Dashboard]
       |     For: "Revenue by region this month"
       |     Store: Redis (pre-aggregated)
       |
       +---> [Customer Order History]
             For: "All orders for customer X"
             Store: DynamoDB (partition by customer_id)
```

Each read model uses the ideal database technology for its access
pattern. This is sometimes called **polyglot persistence**.

---

## CQRS + Event Sourcing

CQRS and event sourcing are often used together, but they're
independent concepts. You can use either one without the other.

```
CQRS + EVENT SOURCING COMBINED

  Command: "PlaceOrder"
      |
      v
  [Command Handler]
      |
      v
  [Event Store]  <-- append event: OrderPlaced
      |
      |--- event ---> [Projection: Order View]     (read model 1)
      |--- event ---> [Projection: Revenue Stats]  (read model 2)
      |--- event ---> [Projection: Search Index]   (read model 3)

  The event store IS the write model.
  Projections ARE the read models.
  Events connect them.
```

```
CQRS WITHOUT Event Sourcing:
  Write to PostgreSQL --> publish change event --> update read models
  (write model is a regular database)

Event Sourcing WITHOUT CQRS:
  Write events to event store --> replay events to get state
  (one model for both reads and writes, just stored as events)

CQRS WITH Event Sourcing:
  Write events to event store --> project into read-optimized models
  (best of both: full history + fast reads)
```

---

## When to Use CQRS

```
GOOD FIT:

  Read/write asymmetry   - Reads are 100x more frequent than writes
                          - Read patterns are very different from write patterns

  Multiple read patterns  - Dashboard, search, list, detail views
                           all need different data shapes

  Performance at scale    - Read and write sides can scale independently
                           10 read replicas, 1 write primary

  Combined with events    - You're already publishing events
                           Adding read models is natural

BAD FIT:

  Simple CRUD             - Blog, todo app, settings page
                           CQRS adds complexity for no benefit

  Strong consistency      - "User must see their change immediately"
                           Eventual consistency adds complexity

  Small team              - CQRS means more code, more infrastructure
                           Make sure the complexity pays for itself

  Simple queries          - If one SQL query gives you what you need,
                           you don't need a separate read model
```

---

## Architecture Patterns

### Simple CQRS (Same Database, Different Tables)

```
SIMPLE CQRS

  Write Table: orders (id, customer_id, status, total)
  Read Table:  order_views (id, customer_name, items_json, total, status)

  Same database. A trigger or background job keeps them in sync.
  Low complexity. Good starting point.
```

### Separate Databases

```
SEPARATE DATABASE CQRS

  Write DB: PostgreSQL (normalized, ACID transactions)
       |
       | (events via Kafka)
       v
  Read DB: Elasticsearch (denormalized, full-text search)
           Redis (pre-computed aggregations)
           MongoDB (flexible document queries)
```

### Full Event Sourcing + CQRS

```
FULL CQRS + EVENT SOURCING

  Commands --> [Command Handler] --> [Event Store (write)]
                                          |
                                    [Event Bus]
                                          |
                    +---------------------+---------------------+
                    |                     |                     |
              [Projection A]       [Projection B]        [Projection C]
              PostgreSQL           Elasticsearch          Redis
              (list views)         (search)               (dashboards)
```

---

## Exercises

1. **Identify read/write patterns**: For a social media platform,
   list 5 write operations and 10 read operations. Which reads
   would benefit from separate read models?

2. **Design read models**: An online bookstore has these reads:
   "books by author," "bestsellers this week," "books similar to
   X," "customer purchase history." Design the read model schema
   for each.

3. **Handle the gap**: A user places an order and immediately
   refreshes the "My Orders" page. The read model hasn't caught
   up. Design three different strategies to handle this gracefully.

4. **Build it**: Implement a simple CQRS system for a to-do list.
   Write side: add, complete, delete tasks. Read side: list all
   tasks, list completed tasks, count pending tasks. Use events
   to sync the read model.

---

[Next: Lesson 15 — Stream Processing](./15-stream-processing.md)
