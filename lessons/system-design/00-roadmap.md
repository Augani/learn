# System Design — Building Systems That Scale

How to design systems that handle millions of users, stay up when things
break, and don't cost a fortune. This track covers the building blocks
(load balancers, caches, queues, databases) and how to combine them into
real architectures.

Think of it as: you know how to build a house (code). Now learn how to
plan a city (system) — roads, plumbing, electricity, zoning, and what
happens when 10x more people move in.

Prerequisites: Track 2 (Databases), Track 6 (Networking). Helpful: Track 9 (Docker), Track 10 (Kubernetes)

---

## Reference Files

- [Numbers Every Engineer Should Know](./reference-numbers.md) — Latency, throughput, storage estimates
- [System Design Template](./reference-template.md) — Step-by-step framework for any design problem

---

## The Roadmap

### Phase 1: Foundations (Hours 1–12)
- [ ] [Lesson 01: How to think about system design — it's about trade-offs](./01-thinking-in-tradeoffs.md)
- [ ] [Lesson 02: Back-of-envelope estimation — napkin math that matters](./02-estimation.md)
- [ ] [Lesson 03: Single server to millions — the scaling journey](./03-scaling-journey.md)
- [ ] [Lesson 04: Load balancing — distributing traffic](./04-load-balancing.md)
- [ ] [Lesson 05: Caching — the fastest code is code that doesn't run](./05-caching.md)
- [ ] [Lesson 06: CDNs — serving content from the edge](./06-cdns.md)

### Phase 2: Data at Scale (Hours 13–24)
- [ ] [Lesson 07: Database scaling — replication, partitioning, sharding](./07-database-scaling.md)
- [ ] [Lesson 08: SQL vs NoSQL — when to use what](./08-sql-vs-nosql.md)
- [ ] [Lesson 09: Consistent hashing — distributing data evenly](./09-consistent-hashing.md)
- [ ] [Lesson 10: CAP theorem and distributed consensus](./10-cap-theorem.md)
- [ ] [Lesson 11: Message queues — decoupling with async communication](./11-message-queues.md)
- [ ] [Lesson 12: Event-driven architecture — events, streams, and CQRS](./12-event-driven.md)

### Phase 3: Reliability and Performance (Hours 25–34)
- [ ] [Lesson 13: API design — REST, GraphQL, gRPC, and webhooks](./13-api-design.md)
- [ ] [Lesson 14: Rate limiting and throttling — protecting your system](./14-rate-limiting.md)
- [ ] [Lesson 15: Microservices vs monoliths — the real trade-offs](./15-microservices.md)
- [ ] [Lesson 16: Distributed systems pitfalls — network partitions, clock skew, idempotency](./16-distributed-pitfalls.md)
- [ ] [Lesson 17: Observability — metrics, logs, traces at scale](./17-observability.md)

### Phase 4: Real-World Designs (Hours 35–48)
- [ ] [Lesson 18: Design a URL shortener — your first end-to-end design](./18-url-shortener.md)
- [ ] [Lesson 19: Design a chat system — real-time at scale](./19-chat-system.md)
- [ ] [Lesson 20: Design a notification system — push, email, SMS](./20-notification-system.md)
- [ ] [Lesson 21: Design a rate limiter — algorithms and distributed implementation](./21-design-rate-limiter.md)
- [ ] [Lesson 22: Design a news feed — fan-out, ranking, caching](./22-news-feed.md)

### Phase 5: Advanced Building Blocks (Hours 49–64)
- [ ] [Lesson 23: Proxies and service discovery — routing traffic in a microservices world](./23-proxies-service-discovery.md)
- [ ] [Lesson 24: Search systems — inverted indexes, ranking, and autocomplete](./24-search-systems.md)
- [ ] [Lesson 25: Blob storage — object storage, chunking, dedup, and CDN integration](./25-blob-storage.md)
- [ ] [Lesson 26: Time-series and analytics — TSDB, OLAP, columnar storage](./26-time-series-analytics.md)
- [ ] [Lesson 27: Workflow engines — orchestrating long-running processes](./27-workflow-engines.md)
- [ ] [Lesson 28: Idempotency and exactly-once semantics — making sure things happen once](./28-idempotency-exactly-once.md)
- [ ] [Lesson 29: Multi-tenancy — shared infrastructure, isolated experience](./29-multi-tenancy.md)
- [ ] [Lesson 30: Geo-distributed systems — multi-region, edge, and data sovereignty](./30-geo-distributed-systems.md)

### Phase 6: More Real-World Designs (Hours 65–80)
- [ ] [Lesson 31: Design YouTube — video upload, transcoding, adaptive streaming](./31-design-youtube.md)
- [ ] [Lesson 32: Design Uber — matching, geospatial indexing, surge pricing](./32-design-uber.md)
- [ ] [Lesson 33: Design Dropbox — file sync, chunking, conflict resolution](./33-design-dropbox.md)
- [ ] [Lesson 34: Design a search engine — crawling, indexing, PageRank](./34-design-search-engine.md)
- [ ] [Lesson 35: Design a payment system — ledger, idempotency, reconciliation](./35-design-payment-system.md)
- [ ] [Lesson 36: Design a web crawler — politeness, dedup, distributed crawling](./36-design-web-crawler.md)
- [ ] [Lesson 37: Design an AI inference platform — GPU serving, batching, A/B testing](./37-design-ai-inference-platform.md)
- [ ] [Lesson 38: Design a recommendation engine — collaborative filtering, cold start](./38-design-recommendation-engine.md)

---

## How to use these lessons

Every lesson has:
1. Concept explained with everyday analogies
2. Architecture diagrams in ASCII art
3. Trade-off analysis (not just "use X", but "X vs Y and when")
4. Back-of-envelope calculations where relevant
5. How you'd implement key pieces in Go/TypeScript/Rust
6. Interview-style walkthrough for the design problems

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **System Design Interview** by Alex Xu (Volume 1: 2020, Volume 2: 2022) — Practical system design walkthroughs
- **Designing Data-Intensive Applications** by Martin Kleppmann (O'Reilly, 2017) — The foundation for system design thinking
- **Building Microservices** by Sam Newman (O'Reilly, 2nd Edition 2021) — Microservices architecture patterns
