# Advanced System Design Track

> You've built systems that work. Now learn to build systems
> that work at scale, survive failures, and evolve gracefully.

---

## Who This Is For

You're a senior or staff-level backend engineer. You've designed
services, operated databases in production, and debugged distributed
systems at 3am. You know what CAP theorem says — now you want to
know what to do about it in practice.

This track is about the **hard decisions** — the ones where every
option has tradeoffs and the "right" answer depends on context you
have to discover yourself.

---

## Track Phases

### Phase 1: Architecture Foundations (Lessons 1-3)
- [ ] Architecture at Scale — What breaks at 10x/100x/1000x
- [ ] Distributed Transactions — Sagas, 2PC limits, idempotency
- [ ] Event Sourcing at Scale — Billions of events in production

### Phase 2: Global Infrastructure (Lessons 4-6)
- [ ] Multi-Region Architecture — Active-active, CRDTs, failover
- [ ] Zero-Downtime Migrations — Expand-contract, ghost tables
- [ ] Observability at Scale — Tracing, logs, metrics at petabyte scale

### Phase 3: Operational Excellence (Lessons 7-9)
- [ ] Capacity Planning — Load testing, traffic modeling, headroom
- [ ] Service Mesh Deep Dive — Istio/Linkerd internals, when to avoid
- [ ] API Evolution — Versioning, deprecation, federation

### Phase 4: Data & Reliability (Lessons 10-12)
- [ ] Data Architecture — Data mesh, lakehouse, governance
- [ ] Reliability Engineering — Failure modes, chaos engineering
- [ ] Tech Strategy — Build vs buy, ADRs, managing tech debt

### Phase 5: Capstone (Lesson 13)
- [ ] Design a Global-Scale E-Commerce Platform

---

## How to Use This Track

```
Each lesson has:

  +----------------------------+
  |  Analogy / Why It Matters  |  <-- Connects to real experience
  +----------------------------+
  |  Deep Dive / Diagrams      |  <-- ASCII art, architecture
  +----------------------------+
  |  Code / Config Examples    |  <-- Production-grade patterns
  +----------------------------+
  |  Failure Scenarios         |  <-- What actually goes wrong
  +----------------------------+
  |  Exercises                 |  <-- Staff-level design problems
  +----------------------------+
```

These aren't tutorials. They're deep dives into decisions you'll
face when operating systems that serve millions of users across
regions. Every lesson includes real failure scenarios because
that's where the actual learning happens.

---

## Prerequisites

- Distributed Systems track (consensus, replication, CRDTs)
- Cloud Architecture track (multi-region basics, IaC)
- Production experience operating backend services
- Familiarity with at least one: Go, Rust, Java, or Python

---

## Recommended Reading

These books are companions to this track. You don't need to read
them first, but they'll deepen your understanding significantly.

### Designing Data-Intensive Applications
**Martin Kleppmann** (O'Reilly, 2017)

The single best book on data systems engineering. Covers
replication, partitioning, transactions, and stream processing
with unmatched clarity. If you read one book on this list,
make it this one. Chapters 7-9 (Transactions, Distributed
Systems, Consistency) map directly to Lessons 2-4.

### Building Microservices
**Sam Newman** (O'Reilly, 2nd Edition 2021)

The definitive guide to microservice architecture. The second
edition covers service mesh, container orchestration, and the
organizational challenges of microservices. Chapters on
decomposition and data ownership connect to Lessons 8-10.

### Staff Engineer: Leadership Beyond the Management Track
**Will Larson** (independently published, 2021)

Not a technical book — a book about how staff engineers
operate. Covers writing technical strategy, managing technical
debt, and communicating architecture decisions. Essential
context for Lesson 12 on tech strategy and ADRs.

---

## Reference Materials

- [Architecture Pattern Quick Reference](reference-patterns.md)
- [ADR Template and Examples](reference-adrs.md)

---

## A Note on "Best Practices"

At this level, there are no best practices — only tradeoffs.
Every pattern in this track has failure modes. Every architecture
decision optimizes for some quality at the expense of another.

The goal isn't to learn "the right way." It's to develop the
judgment to choose the least-wrong way for your specific context.

---

[Start: Lesson 1 — Architecture at Scale -->](01-architecture-at-scale.md)
