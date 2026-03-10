# Lesson 1: Architecture at Scale

> The architecture that got you to 1 million users will not get you
> to 10 million. And the one for 10 million will actively hurt you
> at 100 million.

---

## The Analogy

Think about how a restaurant operates at different scales.

A food truck (startup): one person takes orders, cooks, and serves.
Communication is instant — it's all in your head.

A small restaurant (early growth): a kitchen, wait staff, a host.
You shout orders. Everyone can see everything. Problems are visible.

A restaurant chain (scale): central menu design, regional supply
chains, training programs, franchise owners making local decisions.
The CEO doesn't decide when to restock napkins at location #47.

Now imagine trying to run 500 locations with the food truck model.
That's what happens when you try to scale a monolith past its
breaking point. And trying to run a food truck with the franchise
model? That's premature microservices.

---

## What Breaks First

Systems don't break uniformly. They break in a predictable order,
and knowing this order saves you from premature optimization.

```
Scale         What Breaks                    What You Do
──────────────────────────────────────────────────────────────────

1x            Nothing (if you're lucky)      Ship features
(launch)

10x           Database reads                 Read replicas, caching
              Session management             Stateless services
              Deployment speed               CI/CD pipeline

100x          Database writes                Sharding, write queues
              Service coupling               Domain boundaries
              Team velocity                  Service decomposition
              Monitoring noise               Structured observability

1000x         Cross-service transactions     Sagas, eventual consistency
              Regional latency               Multi-region deployment
              Organizational coordination    Platform teams
              Failure blast radius           Cell-based architecture
              Cost proportionality           Efficiency engineering

10000x        Everything you thought         Custom infrastructure
              was "fine"                     (see: Google, Meta)
```

### The Database Wall

Almost every scaling story starts here. Your single PostgreSQL
instance handles reads and writes beautifully — until it doesn't.

```
  Phase 1: Single DB (works to ~10K QPS)

  ┌──────────┐     ┌──────────┐
  │  App (1) │────>│ Postgres │
  └──────────┘     └──────────┘

  Phase 2: Read replicas (works to ~100K QPS reads)

  ┌──────────┐     ┌──────────┐
  │  App (N) │────>│ Primary  │
  └──────────┘     └──────────┘
       │                │
       │           ┌────┴────┐
       │           │ Replica │ (async)
       └──────────>│  (1..N) │
      reads        └─────────┘

  Phase 3: Sharding (works to ~1M+ QPS writes)

  ┌──────────┐     ┌─────────┐
  │  App (N) │────>│ Shard 0 │  (user_id % 4 == 0)
  └──────────┘     ├─────────┤
       │           │ Shard 1 │  (user_id % 4 == 1)
       │           ├─────────┤
       │           │ Shard 2 │  (user_id % 4 == 2)
       │           ├─────────┤
       │           │ Shard 3 │  (user_id % 4 == 3)
       │           └─────────┘
```

The tricky part: each phase requires **different code, different
operational practices, and different mental models**. Read replicas
introduce replication lag. Sharding eliminates cross-shard joins.
You're not just adding capacity — you're changing how you think
about your data.

---

## Conway's Law (The Real Version)

> "Any organization that designs a system will produce a design
> whose structure is a copy of the organization's communication
> structure." — Melvin Conway, 1967

This isn't a suggestion. It's a **law of nature** for software.
And the inverse is equally powerful: if you want a particular
system architecture, you need the organizational structure to match.

### How It Plays Out

```
  Org Structure                   System Architecture
  ────────────────────────────────────────────────────

  One team, 8 engineers     =>    Monolith (or should be)

  3 teams, shared DB        =>    Distributed monolith
                                  (worst of both worlds)

  5 teams, clear domains    =>    Service-oriented
                                  architecture

  15 teams, platform team   =>    Microservices +
                                  internal platform

  50+ teams, no coordination =>   Chaos (or cell-based
                                  architecture if lucky)
```

### The Inverse Conway Maneuver

Smart organizations use this deliberately. Want microservices?
Reorganize teams around business domains first. The architecture
will follow.

```
  WRONG: "We need microservices, let's split the code"

  Team A        Team B        Team C
    │             │             │
    ▼             ▼             ▼
  ┌─────────────────────────────────┐
  │         Shared Database          │
  └─────────────────────────────────┘

  Everyone still coupled through the database.
  You didn't get microservices. You got a distributed monolith.


  RIGHT: "We need independent teams, let's split the domains"

  Team A           Team B           Team C
  (Payments)       (Inventory)      (Shipping)
    │                │                │
    ▼                ▼                ▼
  ┌──────┐        ┌──────┐        ┌──────┐
  │ Pay  │        │ Inv  │        │ Ship │
  │  DB  │        │  DB  │        │  DB  │
  └──────┘        └──────┘        └──────┘

  Teams own their data. APIs are the contracts.
  Now you actually have microservices.
```

---

## Architecture Decision Framework

At staff level, you're not just making architecture decisions —
you're creating frameworks for others to make decisions.

### The Four Questions

Before any architecture change, answer these:

1. **What's the forcing function?** (Why now? What broke?)
2. **What are we optimizing for?** (Latency? Team velocity? Cost?)
3. **What are we willing to sacrifice?** (Consistency? Simplicity?)
4. **What's the reversibility?** (Can we undo this in 6 months?)

### Reversibility Spectrum

```
  Easy to Reverse              Hard to Reverse
  ◄──────────────────────────────────────────────►

  Feature flag     API addition    Database        Programming
  Config change    New service     schema change   language change
  Cache strategy   New queue       Sharding key    Data model
                                   choice          redesign
```

Prefer reversible decisions. When you must make irreversible ones,
invest proportionally more time in getting them right.

---

## Cell-Based Architecture

At extreme scale (1000x+), even well-designed microservices hit
limits. The blast radius of a failure in a shared service takes
down everything.

Cell-based architecture isolates failures by partitioning the
entire stack into independent cells.

```
  Traditional: Shared Everything

  ┌─────────────────────────────────────────┐
  │              Load Balancer               │
  ├────────┬────────┬────────┬──────────────┤
  │ Auth   │ Orders │ Search │ Payments     │
  ├────────┴────────┴────────┴──────────────┤
  │              Shared Database             │
  └─────────────────────────────────────────┘

  If Auth dies, EVERYTHING dies.


  Cell-Based: Independent Stacks

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │   Cell A     │  │   Cell B     │  │   Cell C     │
  │  (US-East)   │  │  (US-West)   │  │  (EU)        │
  ├──────────────┤  ├──────────────┤  ├──────────────┤
  │ Auth         │  │ Auth         │  │ Auth         │
  │ Orders       │  │ Orders       │  │ Orders       │
  │ Payments     │  │ Payments     │  │ Payments     │
  │ Database     │  │ Database     │  │ Database     │
  └──────────────┘  └──────────────┘  └──────────────┘

  Cell A dies? Cells B and C keep serving.
  Blast radius = 1/3 of traffic, not 100%.
```

### Cell Routing

The hard part is routing users to cells consistently:

```python
import hashlib

def cell_for_user(user_id: str, num_cells: int) -> int:
    hash_val = int(hashlib.sha256(user_id.encode()).hexdigest(), 16)
    return hash_val % num_cells

def route_request(user_id: str, cells: list[str]) -> str:
    cell_idx = cell_for_user(user_id, len(cells))
    return cells[cell_idx]

cells = ["cell-us-east", "cell-us-west", "cell-eu"]
print(route_request("user-12345", cells))
```

The key constraint: a user's data must live entirely within one
cell. Cross-cell operations are expensive and defeat the purpose.
This means you need to think carefully about your cell assignment
strategy — geographic, hash-based, or customer-tier-based.

---

## The Strangler Fig Pattern (At Scale)

You rarely get to build a new system from scratch. Usually you're
evolving a monolith. The Strangler Fig pattern is how you do it
without a rewrite.

```
  Phase 1: Proxy in front of monolith

  ┌─────────┐     ┌────────────┐     ┌───────────┐
  │ Clients │────>│   Proxy    │────>│ Monolith  │
  └─────────┘     └────────────┘     └───────────┘

  Phase 2: Route some traffic to new service

  ┌─────────┐     ┌────────────┐────>┌───────────┐
  │ Clients │────>│   Proxy    │     │ Monolith  │
  └─────────┘     └────────────┘     └───────────┘
                        │
                        └───────────>┌───────────┐
                        /orders/*    │ Order Svc │
                                     └───────────┘

  Phase 3: Most traffic to new services

  ┌─────────┐     ┌────────────┐────>┌───────────┐
  │ Clients │────>│   Proxy    │     │ Monolith  │ (shrinking)
  └─────────┘     └────────────┘     └───────────┘
                    │       │
                    │       └───────>┌───────────┐
                    │                │ Order Svc │
                    └───────────────>┌───────────┐
                                     │ User Svc  │
                                     └───────────┘

  Phase 4: Monolith gone

  ┌─────────┐     ┌────────────┐────>┌───────────┐
  │ Clients │────>│ API GW /   │     │ Order Svc │
  └─────────┘     │  Mesh      │     └───────────┘
                  └────────────┘────>┌───────────┐
                                     │ User Svc  │
                                     └───────────┘
```

### Why Rewrites Fail

The strangler fig works because it's incremental. Big-bang
rewrites fail for predictable reasons:

1. **Moving target**: The old system keeps getting features while
   you rewrite. You're always behind.
2. **Hidden behavior**: The old system has years of edge cases
   encoded in code nobody understands. The rewrite misses them.
3. **Political risk**: A rewrite that takes 18 months with no
   visible progress will get cancelled at month 12.

---

## Real-World Failure: The Distributed Monolith

The most common architecture mistake at scale: splitting a
monolith into services without splitting the data or the coupling.

```
  Symptoms of a Distributed Monolith:

  ✗ Services share a database
  ✗ Deploying Service A requires deploying Service B
  ✗ A single request touches 6+ services synchronously
  ✗ "We need to coordinate releases across teams"
  ✗ Latency is worse than the monolith it replaced
  ✗ You need a spreadsheet to track service dependencies
```

You've taken a monolith's problems (tight coupling) and added
network unreliability, serialization overhead, and operational
complexity. You now have all the downsides of both architectures
and the benefits of neither.

### How to Fix It

1. Identify true domain boundaries (hint: where data doesn't
   need to cross)
2. Give each domain its own data store
3. Replace synchronous calls with events where possible
4. Accept eventual consistency where the business allows it
5. Merge services that are always deployed together

---

## Exercises

1. **Scale audit.** Take a system you've worked on. Map it to the
   "What Breaks First" table. What's the next breaking point?
   What would you do about it? Write an ADR for the change.

2. **Conway's Law analysis.** Draw your organization's team
   structure. Now draw your system architecture. Where do they
   match? Where don't they? What does the mismatch tell you?

3. **Cell design.** You're building a multi-tenant SaaS platform
   with 500 enterprise customers. Design a cell-based architecture.
   How do you assign tenants to cells? How do you handle a tenant
   that outgrows their cell? What about cross-tenant features?

4. **Strangler planning.** You have a 500K-line monolith that
   handles user management, billing, content delivery, and
   analytics. Plan a strangler fig migration. What do you extract
   first and why? What's your rollback strategy for each phase?

5. **Distributed monolith detection.** List five concrete metrics
   you could track to detect if your microservices architecture
   is actually a distributed monolith. How would you instrument
   these?

---

[Next: Lesson 2 — Distributed Transactions -->](02-distributed-transactions.md)
