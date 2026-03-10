# Lesson 13: Design a Global-Scale E-Commerce Platform

> This is the capstone. Everything from the previous 12 lessons
> comes together. You're not designing for a whiteboard interview
> — you're designing for production.

---

## The Brief

Design a global e-commerce platform with the following
requirements:

```
  Scale:
  - 50 million monthly active users
  - 5 million orders per day (peak: 3x during events)
  - 200 million product catalog
  - Present in 3 regions: US, EU, Asia-Pacific

  Business Requirements:
  - Users can browse, search, and purchase from any region
  - Checkout must complete in < 3 seconds (P99)
  - Order status must be visible within 5 seconds
  - Product catalog updates visible within 30 seconds
  - Support for flash sales (10x traffic spike in minutes)
  - GDPR compliance for EU users

  Non-Functional Requirements:
  - 99.95% availability (monthly SLO)
  - Multi-region active-active
  - Zero-downtime deployments
  - Full audit trail for orders and payments
  - Cost-efficient at scale
```

---

## Step 1: Domain Decomposition

Before choosing technologies, define the domains:

```
  ┌──────────────────────────────────────────────────────┐
  │                 Business Domains                      │
  │                                                      │
  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
  │  │ Customer │  │ Catalog  │  │ Inventory        │   │
  │  │          │  │          │  │                  │   │
  │  │ - Profile│  │ - Products│  │ - Stock levels   │   │
  │  │ - Auth   │  │ - Search │  │ - Reservations   │   │
  │  │ - Prefs  │  │ - Browse │  │ - Warehouse ops  │   │
  │  └──────────┘  └──────────┘  └──────────────────┘   │
  │                                                      │
  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
  │  │ Order    │  │ Payment  │  │ Shipping         │   │
  │  │          │  │          │  │                  │   │
  │  │ - Cart   │  │ - Charge │  │ - Fulfillment    │   │
  │  │ - Checkout│ │ - Refund │  │ - Tracking       │   │
  │  │ - History│  │ - Fraud  │  │ - Returns        │   │
  │  └──────────┘  └──────────┘  └──────────────────┘   │
  │                                                      │
  │  ┌──────────┐  ┌──────────┐                          │
  │  │ Pricing  │  │ Marketing│                          │
  │  │          │  │          │                          │
  │  │ - Rules  │  │ - Promos │                          │
  │  │ - Tax    │  │ - Notifs │                          │
  │  │ - Currency│ │ - Recs   │                          │
  │  └──────────┘  └──────────┘                          │
  └──────────────────────────────────────────────────────┘
```

Each domain maps to a team. Each team owns their data, their
services, and their SLOs.

---

## Step 2: Multi-Region Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    Global Load Balancer                      │
  │                 (Cloudflare / AWS Global Accelerator)        │
  └────────┬──────────────────┬──────────────────┬──────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
  │   US-EAST       │ │   EU-WEST       │ │   AP-SOUTHEAST  │
  │                 │ │                 │ │                 │
  │ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │
  │ │ API Gateway │ │ │ │ API Gateway │ │ │ │ API Gateway │ │
  │ └──────┬──────┘ │ │ └──────┬──────┘ │ │ └──────┬──────┘ │
  │        │        │ │        │        │ │        │        │
  │ ┌──────┴──────┐ │ │ ┌──────┴──────┐ │ │ ┌──────┴──────┐ │
  │ │  Services   │ │ │ │  Services   │ │ │ │  Services   │ │
  │ │ (all        │ │ │ │ (all        │ │ │ │ (all        │ │
  │ │  domains)   │ │ │ │  domains)   │ │ │ │  domains)   │ │
  │ └──────┬──────┘ │ │ └──────┬──────┘ │ │ └──────┬──────┘ │
  │        │        │ │        │        │ │        │        │
  │ ┌──────┴──────┐ │ │ ┌──────┴──────┐ │ │ ┌──────┴──────┐ │
  │ │  Data Tier  │ │ │ │  Data Tier  │ │ │ │  Data Tier  │ │
  │ │ - CockroachDB│ │ │ │ - CockroachDB│ │ │ │ - CockroachDB│ │
  │ │ - Redis     │ │ │ │ - Redis     │ │ │ │ - Redis     │ │
  │ │ - Elastic   │ │ │ │ - Elastic   │ │ │ │ - Elastic   │ │
  │ │ - Kafka     │ │ │ │ - Kafka     │ │ │ │ - Kafka     │ │
  │ └─────────────┘ │ │ └─────────────┘ │ │ └─────────────┘ │
  └─────────────────┘ └─────────────────┘ └─────────────────┘
           │                  │                  │
           └──────── Cross-region replication ───┘
```

### Regional Data Strategy

Not all data needs to be everywhere:

```
  ┌──────────────────┬────────────────┬──────────────────────┐
  │ Data             │ Strategy       │ Reasoning            │
  ├──────────────────┼────────────────┼──────────────────────┤
  │ Product catalog  │ Full replica   │ Browse must be local │
  │                  │ (all regions)  │ Low write rate       │
  ├──────────────────┼────────────────┼──────────────────────┤
  │ User profiles    │ Home region +  │ GDPR: EU data stays  │
  │                  │ cache in others│ in EU. Read from     │
  │                  │                │ cache elsewhere.     │
  ├──────────────────┼────────────────┼──────────────────────┤
  │ Inventory        │ Partitioned    │ 100 units in US,     │
  │                  │ by region      │ 50 in EU, 30 in AP.  │
  │                  │                │ No cross-region txn. │
  ├──────────────────┼────────────────┼──────────────────────┤
  │ Orders           │ Home region    │ Order lives where    │
  │                  │ (user's region)│ user's data lives.   │
  │                  │                │ Event sourced.       │
  ├──────────────────┼────────────────┼──────────────────────┤
  │ Search index     │ Full replica   │ Search must be local.│
  │                  │ (all regions)  │ Updated via events.  │
  ├──────────────────┼────────────────┼──────────────────────┤
  │ Session/cart     │ Home region +  │ Cart must follow     │
  │                  │ Redis replica  │ user across regions. │
  └──────────────────┴────────────────┴──────────────────────┘
```

---

## Step 3: Checkout Flow (The Critical Path)

Checkout is the highest-value path. It must be fast, reliable,
and correct.

```
  Checkout Flow:

  User clicks "Place Order"
       │
       ▼
  ┌──────────────┐
  │ 1. Validate  │  (cart valid? items available? prices current?)
  │    Cart      │  Local region, ~20ms
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 2. Reserve   │  (deduct from regional inventory)
  │    Inventory │  Local region, ~30ms
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 3. Calculate │  (tax rules, shipping cost, discounts)
  │    Total     │  Local region, ~15ms
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 4. Process   │  (charge card via payment provider)
  │    Payment   │  External call, ~500-1500ms
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 5. Create    │  (event sourced, append events)
  │    Order     │  Local region, ~20ms
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 6. Confirm   │  (send confirmation, trigger fulfillment)
  │    (async)   │  Async via events, non-blocking
  └──────────────┘

  Total synchronous: ~600-1600ms (dominated by payment)
  Well within 3s P99 budget.
```

### Checkout as a Saga

```
  OrderSaga:

  Step 1: ValidateCart
    Execute:    Verify cart items exist, prices match
    Compensate: N/A (read-only)

  Step 2: ReserveInventory
    Execute:    Decrement regional inventory
    Compensate: Release reserved inventory

  Step 3: CalculateTotal
    Execute:    Compute tax, shipping, discounts
    Compensate: N/A (read-only)

  Step 4: ProcessPayment
    Execute:    Charge card via payment provider
    Compensate: Refund payment

  Step 5: CreateOrder
    Execute:    Append OrderCreated event
    Compensate: Append OrderCancelled event

  Step 6: TriggerFulfillment (async)
    Execute:    Publish fulfillment event
    Compensate: Publish cancellation event

  Failure at Step 4 (payment fails):
  → Compensate Step 2 (release inventory)
  → Return error to user with reason
```

---

## Step 4: Event Architecture

Events connect all the domains:

```
  ┌─────────────────────────────────────────────────────────┐
  │                    Event Backbone (Kafka)                │
  │                                                         │
  │  Topics:                                                │
  │  ┌─────────────────────────────────────────────────┐    │
  │  │ orders.created       (partitioned by user_id)   │    │
  │  │ orders.confirmed     (partitioned by user_id)   │    │
  │  │ orders.cancelled     (partitioned by user_id)   │    │
  │  │ inventory.reserved   (partitioned by product_id)│    │
  │  │ inventory.released   (partitioned by product_id)│    │
  │  │ payments.charged     (partitioned by order_id)  │    │
  │  │ payments.refunded    (partitioned by order_id)  │    │
  │  │ catalog.updated      (partitioned by product_id)│    │
  │  │ shipping.dispatched  (partitioned by order_id)  │    │
  │  │ shipping.delivered   (partitioned by order_id)  │    │
  │  └─────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────┘

  Cross-region replication:
  Kafka MirrorMaker 2 replicates critical topics
  between regional Kafka clusters.

  US-EAST Kafka ←──MM2──→ EU-WEST Kafka ←──MM2──→ AP-SOUTHEAST Kafka
```

### Order Event Store (PostgreSQL)

```sql
CREATE TABLE order_events (
    global_position  BIGSERIAL PRIMARY KEY,
    stream_id        TEXT NOT NULL,
    stream_position  INTEGER NOT NULL,
    event_type       TEXT NOT NULL,
    data             JSONB NOT NULL,
    metadata         JSONB NOT NULL DEFAULT '{}',
    region           TEXT NOT NULL DEFAULT 'us-east',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (stream_id, stream_position)
) PARTITION BY RANGE (created_at);

CREATE TABLE order_events_2026_q1 PARTITION OF order_events
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
```

Event types for a single order:

```
  stream: order-a1b2c3d4

  pos  event                  data
  ───────────────────────────────────────────────────
  0    CartValidated          {items: [...], total: 149.99}
  1    InventoryReserved      {reservations: [...]}
  2    TotalCalculated        {subtotal: 149.99, tax: 12.00,
                               shipping: 5.99, total: 167.98}
  3    PaymentProcessed       {provider: "stripe",
                               charge_id: "ch_xxx"}
  4    OrderCreated           {order_id: "ORD-12345",
                               status: "confirmed"}
  5    FulfillmentRequested   {warehouse: "us-east-1"}
  6    ItemShipped            {tracking: "1Z999..."}
  7    DeliveryConfirmed      {signed_by: "Alice"}
```

---

## Step 5: Search and Browse

Product search must be fast and local:

```
  Catalog Update Flow:

  Catalog Service ──> PostgreSQL (writes)
       │
       └──> Outbox ──> Kafka (catalog.updated)
                          │
                ┌─────────┼──────────┐
                │         │          │
                ▼         ▼          ▼
         US Elastic  EU Elastic  AP Elastic
         (search)    (search)    (search)

  Each region has a complete search index.
  Updates propagate via Kafka events.
  Consistency: ~10-30 seconds (well within 30s requirement).
```

### Search Architecture

```
  User query: "wireless headphones under $50"
       │
       ▼
  ┌────────────────┐
  │ Search Gateway │  (parse query, apply filters)
  └──────┬─────────┘
         │
  ┌──────▼─────────┐
  │ Elasticsearch  │  (full-text search + filters)
  │ (local region) │
  └──────┬─────────┘
         │
  ┌──────▼─────────┐
  │ Enrich results │  (prices, availability, images)
  │ from Redis     │  (cached, local)
  └──────┬─────────┘
         │
  ┌──────▼─────────┐
  │ Personalize    │  (ML model, user history)
  │ (optional,     │  (degradable)
  │  degradable)   │
  └────────────────┘
```

---

## Step 6: Inventory Management

Inventory is partitioned by region to avoid cross-region
transactions:

```
  Product SKU-12345: 500 total units

  ┌──────────────────────────────────────────────┐
  │ Regional Allocation:                          │
  │                                              │
  │ US-EAST:       250 units (50% — primary mkt) │
  │ EU-WEST:       150 units (30%)               │
  │ AP-SOUTHEAST:  100 units (20%)               │
  │                                              │
  │ Rebalancing (daily batch job):               │
  │ If US-EAST < 10% remaining                   │
  │   AND EU-WEST > 50% remaining                │
  │   THEN transfer 50 units EU → US             │
  └──────────────────────────────────────────────┘
```

### Flash Sale Handling

Flash sales create extreme inventory pressure:

```
  Normal: 100 orders/minute for this product
  Flash sale: 10,000 orders/minute for 5 minutes

  Strategy:
  1. PRE-ALLOCATE: Move extra inventory to expected hot regions
  2. QUEUE: Accept orders into a queue, process asynchronously
  3. LIMIT: Per-user purchase limits
  4. DEGRADE: Disable recommendations, reviews during sale
  5. SEPARATE: Route flash sale traffic to dedicated pods

  ┌──────────────┐     ┌──────────────────┐
  │ Normal traffic│────>│ Normal pods      │
  │              │     │ (standard scale) │
  └──────────────┘     └──────────────────┘

  ┌──────────────┐     ┌──────────────────┐
  │ Flash sale   │────>│ Flash sale pods  │
  │ traffic      │     │ (pre-scaled 10x) │
  └──────────────┘     └──────────────────┘

  Routing: Feature flag + URL prefix (/flash-sale/*)
```

---

## Step 7: Observability

```
  SLOs for the Platform:

  ┌─────────────────────┬─────────────┬───────────────────┐
  │ SLI                 │ SLO         │ Error Budget      │
  ├─────────────────────┼─────────────┼───────────────────┤
  │ Availability        │ 99.95%      │ 21.6 min/month    │
  │ Checkout P99 latency│ < 3 seconds │ 0.05% can exceed  │
  │ Search P99 latency  │ < 500ms     │ 0.05% can exceed  │
  │ Order visibility    │ < 5 seconds │ 99.9% within 5s   │
  │ Catalog freshness   │ < 30 seconds│ 99.9% within 30s  │
  └─────────────────────┴─────────────┴───────────────────┘

  Key Dashboards:

  1. Business health: Orders/min, revenue/min, cart abandonment
  2. System health: Error rates, latency, saturation per service
  3. Regional health: Per-region availability, replication lag
  4. Event health: Kafka lag, event processing latency, DLQ depth
```

### Distributed Trace for Checkout

```
  Trace: checkout-abc-123 (total: 1.8s)

  ├── API Gateway (45ms)
  │   ├── Auth (15ms)
  │   └── Rate limit check (2ms)
  ├── Cart Validation (25ms)
  │   ├── Product lookup [cache hit] (3ms)
  │   └── Price verification (8ms)
  ├── Inventory Reserve (35ms)
  │   ├── Check availability (10ms)
  │   └── Reserve units (25ms)
  ├── Price Calculation (18ms)
  │   ├── Tax rules (8ms)
  │   └── Shipping cost (5ms)
  ├── Payment Processing (1.6s) ← BOTTLENECK
  │   ├── Fraud check (200ms)
  │   ├── Stripe charge (1.3s) ← EXTERNAL
  │   └── Record payment (50ms)
  └── Order Creation (30ms)
      ├── Append events (15ms)
      └── Publish to Kafka (10ms)
```

---

## Step 8: Graceful Degradation Plan

```
  ┌──────────────────┬──────────────┬──────────────────────┐
  │ Failure          │ Impact       │ Degradation          │
  ├──────────────────┼──────────────┼──────────────────────┤
  │ Search down      │ Can't search │ Show category pages  │
  │                  │              │ (pre-cached).        │
  │                  │              │ Basic text search    │
  │                  │              │ from DB.             │
  ├──────────────────┼──────────────┼──────────────────────┤
  │ Recommendation   │ No personal- │ Show trending items  │
  │ service down     │ ization      │ (cached list,        │
  │                  │              │ updated hourly).     │
  ├──────────────────┼──────────────┼──────────────────────┤
  │ Payment provider │ Can't charge │ Queue orders for     │
  │ down             │              │ retry. Show "order   │
  │                  │              │ pending" status.     │
  ├──────────────────┼──────────────┼──────────────────────┤
  │ One region down  │ Regional     │ Route traffic to     │
  │                  │ outage       │ nearest healthy      │
  │                  │              │ region. Higher       │
  │                  │              │ latency but works.   │
  ├──────────────────┼──────────────┼──────────────────────┤
  │ Kafka down       │ Events       │ Buffer locally.      │
  │                  │ delayed      │ Outbox pattern.      │
  │                  │              │ Order still created. │
  │                  │              │ Confirmation delayed.│
  ├──────────────────┼──────────────┼──────────────────────┤
  │ Database slow    │ All ops slow │ Read from cache.     │
  │                  │              │ Write-behind queue.  │
  │                  │              │ Circuit break slow   │
  │                  │              │ queries.             │
  └──────────────────┴──────────────┴──────────────────────┘
```

---

## Step 9: Data Residency and Compliance

```
  GDPR Implementation:

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │ 1. Data Classification:                              │
  │    PII: name, email, address, phone, payment info    │
  │    Non-PII: order counts, product views, preferences │
  │                                                      │
  │ 2. Storage Rules:                                    │
  │    EU user PII: EU-WEST ONLY                         │
  │    EU user non-PII: can replicate globally            │
  │    Non-EU user PII: home region + encrypted replicas │
  │                                                      │
  │ 3. Right to Deletion:                                │
  │    - Customer requests deletion                      │
  │    - Mark account as "pending_deletion"              │
  │    - Async job removes PII within 30 days            │
  │    - Event store: tombstone events (PII redacted)    │
  │    - Backups: flagged for next expiry cycle          │
  │                                                      │
  │ 4. Data Access Logging:                              │
  │    - Every PII access logged to audit trail          │
  │    - Audit trail retention: 7 years                  │
  │    - Quarterly access review                         │
  └──────────────────────────────────────────────────────┘
```

---

## Step 10: Technology Choices (ADR Summary)

```
  ┌──────────────────┬────────────────┬──────────────────────┐
  │ Component        │ Technology     │ Rationale            │
  ├──────────────────┼────────────────┼──────────────────────┤
  │ Compute          │ Kubernetes     │ Portable, autoscale  │
  │ Database (OLTP)  │ CockroachDB    │ Multi-region, ACID   │
  │ Event store      │ PostgreSQL     │ Team expertise       │
  │ Event streaming  │ Kafka          │ High throughput,     │
  │                  │                │ proven at scale      │
  │ Cache            │ Redis          │ Sub-ms latency       │
  │                  │ (Enterprise)   │ Active-active CRDT   │
  │ Search           │ Elasticsearch  │ Full-text, facets    │
  │ API Gateway      │ Kong / Envoy   │ Rate limit, auth,    │
  │                  │                │ observability        │
  │ Service mesh     │ Linkerd        │ Low overhead mTLS    │
  │ Observability    │ Grafana stack  │ Cost-effective at    │
  │                  │ (Mimir/Loki/   │ scale vs SaaS        │
  │                  │  Tempo)        │                      │
  │ IaC              │ Terraform      │ Multi-cloud ready    │
  │ CI/CD            │ GitHub Actions │ Team familiarity     │
  │ Feature flags    │ LaunchDarkly   │ Buy (not core)       │
  └──────────────────┴────────────────┴──────────────────────┘
```

---

## Cost Estimate

```
  Monthly cost estimate (production):

  Compute (K8s):
  - 3 regions × 50 nodes × m6i.2xlarge = ~$65K/mo

  Databases:
  - CockroachDB (3-region): ~$15K/mo
  - PostgreSQL event stores (3 regions): ~$8K/mo

  Kafka:
  - 3-region managed Kafka: ~$12K/mo

  Redis:
  - 3-region Enterprise: ~$6K/mo

  Elasticsearch:
  - 3-region: ~$10K/mo

  Observability:
  - Self-hosted Grafana stack: ~$8K/mo (compute + storage)

  CDN + Load Balancing:
  - Cloudflare Enterprise: ~$5K/mo

  Storage (S3/GCS):
  - Events, backups, logs: ~$3K/mo

  ──────────────────────────────────────
  Total: ~$132K/month (~$1.6M/year)

  At 5M orders/day: ~$0.0009 per order
  At $50 average order value: infrastructure is 0.002% of GMV
```

---

## Exercises

This is your final exercise set. Each one requires synthesizing
multiple lessons.

1. **Full design.** Take the architecture above and design ONE
   domain in complete detail. Pick the Order domain: schema,
   events, API, saga, projections, failover strategy, and
   monitoring. Create the ADR for your key technology choices.

2. **Failure scenario.** The EU-WEST region has a complete database
   outage during a flash sale. Walk through exactly what happens:
   which requests fail, which degrade, how does traffic reroute,
   what data is at risk, and what's the recovery procedure. Write
   the incident runbook.

3. **Scale challenge.** Traffic has grown 5x in 6 months. The
   current architecture handles it, but costs have grown 5x too.
   Design the efficiency improvements: what can you cache more
   aggressively? Where can you use cheaper storage tiers? Where
   is compute over-provisioned? Target: handle 5x traffic at 3x
   cost (60% cost efficiency improvement).

4. **Migration plan.** You inherited this system as a monolith
   and need to migrate to the architecture above. The monolith
   handles 2M orders/day and has 800K lines of code. Design the
   18-month migration plan using the strangler fig pattern.
   What do you extract first? What's the riskiest phase?

5. **Present the design.** Write a 2-page executive summary of
   this architecture for the VP of Engineering. Focus on business
   outcomes: cost, reliability, time to market, and risk. Include
   one architecture diagram (Level 2 C4).

---

## What You've Learned

This track covered the decisions and tradeoffs that staff+ engineers
face when building systems at scale:

```
  Lesson 1:  Architecture evolves with scale and organization
  Lesson 2:  Distributed transactions are about compensation, not atomicity
  Lesson 3:  Event sourcing trades write simplicity for read flexibility
  Lesson 4:  Multi-region is a tradeoff between latency and consistency
  Lesson 5:  Zero-downtime requires incremental, reversible changes
  Lesson 6:  Observability is asking questions you didn't anticipate
  Lesson 7:  Capacity planning is prediction with safety margins
  Lesson 8:  Service mesh is powerful but not always worth the cost
  Lesson 9:  APIs are contracts, not just endpoints
  Lesson 10: Data architecture is an organizational problem
  Lesson 11: Reliability comes from designing for failure
  Lesson 12: Strategy is choosing what NOT to do
  Lesson 13: Real systems combine all of the above with judgment
```

The consistent theme: **there are no right answers, only tradeoffs**.
Your job as a staff engineer is to understand the tradeoffs deeply
enough to make the least-wrong choice for your context, communicate
that choice clearly, and build systems that can evolve when
the context changes.

---

[Back to Roadmap](00-roadmap.md)
