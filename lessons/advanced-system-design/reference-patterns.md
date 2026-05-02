# Advanced Architecture Patterns Quick Reference

Quick reference for patterns covered in this track, with
tradeoffs and when to use each.

---

## Decomposition Patterns

```
┌──────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Pattern              │ Use When          │ Tradeoffs         │ Lesson            │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Monolith             │ < 10 engineers,   │ Simple but hard   │ 1: Architecture   │
│                      │ single domain     │ to scale teams    │ at Scale          │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Modular Monolith     │ 10-30 engineers,  │ Domain boundaries │ 1: Architecture   │
│                      │ clear domains     │ without network   │ at Scale          │
│                      │                   │ overhead          │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Microservices        │ 30+ engineers,    │ Team autonomy but │ 1: Architecture   │
│                      │ independent teams │ operational cost  │ at Scale          │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Cell-Based           │ 1000x scale,      │ Isolation but     │ 1: Architecture   │
│ Architecture         │ blast radius      │ data partitioning │ at Scale          │
│                      │ concerns          │ constraints       │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Strangler Fig        │ Migrating from    │ Incremental but   │ 1: Architecture   │
│                      │ monolith          │ slow, proxy layer │ at Scale          │
│                      │                   │ complexity        │                   │
└──────────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## Transaction & Consistency Patterns

```
┌──────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Pattern              │ Use When          │ Tradeoffs         │ Lesson            │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Two-Phase Commit     │ Strong atomicity  │ Blocking, low     │ 2: Distributed    │
│ (2PC)                │ across few nodes  │ availability      │ Transactions      │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Saga (Orchestrated)  │ Complex business  │ Eventually        │ 2: Distributed    │
│                      │ workflows         │ consistent,       │ Transactions      │
│                      │                   │ compensation      │                   │
│                      │                   │ complexity        │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Saga (Choreographed) │ Loosely coupled   │ Hard to debug,    │ 2: Distributed    │
│                      │ domains           │ implicit flow     │ Transactions      │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Outbox Pattern       │ DB write + event  │ Extra table,      │ 2: Distributed    │
│                      │ publish atomicity │ polling/CDC       │ Transactions      │
│                      │                   │ infrastructure    │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Idempotency Keys     │ Safe retries on   │ Storage for keys, │ 2: Distributed    │
│                      │ any mutation      │ key generation    │ Transactions      │
│                      │                   │ responsibility    │                   │
└──────────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## Event & Data Patterns

```
┌──────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Pattern              │ Use When          │ Tradeoffs         │ Lesson            │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Event Sourcing       │ Audit trail, temp │ Complex queries,  │ 3: Event Sourcing │
│                      │ queries, replay   │ eventual          │ at Scale          │
│                      │                   │ consistency       │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ CQRS                 │ Different read/   │ Two models to     │ 3: Event Sourcing │
│                      │ write models      │ maintain,         │ at Scale          │
│                      │                   │ eventual          │                   │
│                      │                   │ consistency       │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Projections          │ Read-optimized    │ Rebuild time,     │ 3: Event Sourcing │
│                      │ views from events │ eventual          │ at Scale          │
│                      │                   │ consistency       │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Snapshots            │ Fast aggregate    │ Snapshot storage, │ 3: Event Sourcing │
│                      │ loading           │ rebuild strategy  │ at Scale          │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Schema Registry      │ Multiple services │ Infrastructure    │ 10: Data          │
│                      │ sharing data      │ overhead, team    │ Architecture      │
│                      │ formats           │ adoption          │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Data Contracts       │ Cross-team data   │ Governance        │ 10: Data          │
│                      │ dependencies      │ overhead, culture │ Architecture      │
│                      │                   │ change            │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Data Mesh            │ Large org, many   │ Organizational    │ 10: Data          │
│                      │ data-producing    │ change, platform  │ Architecture      │
│                      │ teams             │ investment        │                   │
└──────────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## Multi-Region Patterns

```
┌──────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Pattern              │ Use When          │ Tradeoffs         │ Lesson            │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Active-Passive       │ DR, regulatory    │ Failover time,    │ 4: Multi-Region   │
│                      │ compliance        │ standby cost      │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Active-Active        │ Global low latency│ Conflict          │ 4: Multi-Region   │
│                      │ zero-downtime     │ resolution,       │                   │
│                      │ failover          │ 10x complexity    │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ CRDTs                │ Conflict-free     │ Limited data      │ 4: Multi-Region   │
│                      │ multi-region data │ types, eventually │                   │
│                      │                   │ consistent        │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Last-Writer-Wins     │ Simple conflict   │ Silent data loss  │ 4: Multi-Region   │
│                      │ resolution        │ on concurrent     │                   │
│                      │                   │ writes            │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Regional Partitioning│ Data residency,   │ Cross-region      │ 4: Multi-Region   │
│                      │ inventory mgmt    │ operations are    │ 13: Capstone      │
│                      │                   │ expensive         │                   │
└──────────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## Migration Patterns

```
┌──────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Pattern              │ Use When          │ Tradeoffs         │ Lesson            │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Expand-Contract      │ Any schema change │ Multiple deploys, │ 5: Zero-Downtime  │
│                      │ without downtime  │ longer timeline   │ Migrations        │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Dual Writes          │ Migrating data    │ Code complexity,  │ 5: Zero-Downtime  │
│                      │ between stores    │ consistency risk  │ Migrations        │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Shadow Reads         │ Validating new    │ Extra read load,  │ 5: Zero-Downtime  │
│                      │ data source       │ comparison logic  │ Migrations        │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Ghost Table          │ Large table       │ Disk space, binlog│ 5: Zero-Downtime  │
│ (gh-ost)             │ schema changes    │ reading overhead  │ Migrations        │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Feature Flags        │ Decoupling deploy │ Flag cleanup      │ 5: Zero-Downtime  │
│ for Migrations       │ from activation   │ debt, testing     │ Migrations        │
│                      │                   │ combinatorial     │                   │
│                      │                   │ explosion         │                   │
└──────────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## Reliability Patterns

```
┌──────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Pattern              │ Use When          │ Tradeoffs         │ Lesson            │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Circuit Breaker      │ Protecting from   │ Open state means  │ 11: Reliability   │
│                      │ failing deps      │ reduced function  │ Engineering       │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Bulkhead             │ Isolating failure │ Resource waste    │ 11: Reliability   │
│                      │ domains           │ from partitioning │ Engineering       │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Shuffle Sharding     │ Reducing blast    │ Routing           │ 11: Reliability   │
│                      │ radius per tenant │ complexity,       │ Engineering       │
│                      │                   │ capacity planning │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Graceful Degradation │ Maintaining core  │ Feature           │ 11: Reliability   │
│                      │ function during   │ prioritization    │ Engineering       │
│                      │ partial failure   │ decisions, UX     │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Error Budgets        │ Balancing         │ Requires SLO      │ 11: Reliability   │
│                      │ reliability vs    │ buy-in, budget    │ Engineering       │
│                      │ velocity          │ tracking infra    │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Chaos Engineering    │ Discovering       │ Risk of real      │ 11: Reliability   │
│                      │ unknown failure   │ impact, cultural  │ Engineering       │
│                      │ modes             │ resistance        │                   │
└──────────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## API Patterns

```
┌──────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Pattern              │ Use When          │ Tradeoffs         │ Lesson            │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ URL Versioning       │ External APIs     │ URL clutter,      │ 9: API Evolution  │
│ (/v1/, /v2/)         │                   │ all endpoints     │                   │
│                      │                   │ versioned         │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Additive Evolution   │ Internal APIs,    │ Fields accumulate │ 9: API Evolution  │
│ (no versioning)      │ controlled        │ over time         │                   │
│                      │ consumers         │                   │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Consumer-Driven      │ Multiple teams    │ Contract test     │ 9: API Evolution  │
│ Contracts            │ consuming your API│ maintenance       │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ GraphQL Federation   │ Multiple teams    │ Gateway           │ 9: API Evolution  │
│                      │ owning parts of   │ complexity,       │                   │
│                      │ the data graph    │ N+1 across        │                   │
│                      │                   │ subgraphs         │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Backend for Frontend │ Different client  │ Multiple BFFs     │ 9: API Evolution  │
│ (BFF)                │ needs, dedicated  │ to maintain       │                   │
│                      │ frontend teams    │                   │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ API Gateway          │ Cross-cutting     │ Single point of   │ 8: Service Mesh   │
│ Transformation       │ concerns, version │ failure, latency  │ 9: API Evolution  │
│                      │ translation       │ overhead          │                   │
└──────────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## Observability Patterns

```
┌──────────────────────┬───────────────────┬───────────────────┬───────────────────┐
│ Pattern              │ Use When          │ Tradeoffs         │ Lesson            │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ RED Method           │ Monitoring any    │ Service-level     │ 6: Observability  │
│ (Rate/Error/Duration)│ request-driven    │ only, no resource │ at Scale          │
│                      │ service           │ insight           │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ USE Method           │ Monitoring any    │ Resource-level    │ 6: Observability  │
│ (Util/Sat/Errors)    │ infrastructure    │ only, no business │ at Scale          │
│                      │ resource          │ insight           │                   │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Tail-Based Sampling  │ Capturing all     │ Collector memory  │ 6: Observability  │
│                      │ error/slow traces │ and compute cost  │ at Scale          │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Tiered Log Storage   │ Managing log cost │ Query latency     │ 6: Observability  │
│                      │ at scale          │ for cold data     │ at Scale          │
├──────────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ SLO-Based Alerting   │ Reducing alert    │ Requires SLO      │ 6: Observability  │
│                      │ fatigue           │ definition,       │ 11: Reliability   │
│                      │                   │ error budget      │                   │
│                      │                   │ tracking          │                   │
└──────────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## Pattern Selection Cheat Sheet

When faced with a design decision, ask these questions:

```
  1. How many teams are involved?
     1 team    → Keep it simple (monolith, single DB)
     2-5 teams → Service-oriented with clear boundaries
     5+ teams  → Microservices + platform team

  2. What consistency do you need?
     Strong → Single database, 2PC (last resort)
     Eventual → Sagas, events, CRDTs
     None → Fire and forget, best effort

  3. What's your availability target?
     99%    → Single region, basic redundancy
     99.9%  → Multi-AZ, auto-failover
     99.99% → Multi-region active-active

  4. What's your latency target?
     < 50ms  → In-memory, local cache
     < 200ms → Same-region, warm cache
     < 500ms → Cross-region acceptable
     < 2s    → External dependencies acceptable

  5. Can you reverse this decision in 6 months?
     Yes → Make it, move fast
     No  → Write an ADR, review carefully
```

---

[Back to Roadmap](00-roadmap.md)
