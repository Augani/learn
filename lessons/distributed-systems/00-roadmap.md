# Distributed Systems Track

> You've seen the big picture in System Design.
> Now we go deep — algorithms, proofs, and working code.

---

## Who This Is For

You understand basic system design concepts like CAP theorem,
consistent hashing, and load balancing. Now you want to know
**how** these things actually work under the hood.

---

## Track Phases

### Phase 1: Foundations (Lessons 1-3)
- [ ] Why Distributed Systems
- [ ] Time and Ordering
- [ ] Logical Clocks (Implementation)

### Phase 2: Coordination (Lessons 4-6)
- [ ] Leader Election Algorithms
- [ ] Consensus Deep Dive (Paxos & Raft)
- [ ] Replication Strategies

### Phase 3: Consistency & Transactions (Lessons 7-9)
- [ ] Consistency Models (Full Spectrum)
- [ ] Distributed Transactions
- [ ] Distributed Locking

### Phase 4: Conflict & Convergence (Lessons 10-12)
- [ ] Conflict Resolution
- [ ] CRDTs
- [ ] Gossip Protocols

### Phase 5: Reliability & Observability (Lessons 13-15)
- [ ] Failure Detection
- [ ] Distributed Snapshots
- [ ] Byzantine Fault Tolerance

### Phase 6: Advanced Patterns (Lessons 16-19)
- [ ] Partitioning & Sharding
- [ ] Chain Replication
- [ ] Distributed Debugging
- [ ] Patterns and Anti-patterns

### Phase 7: Capstone (Lesson 20)
- [ ] Build a Distributed Key-Value Store

---

## How to Use This Track

```
Each lesson has:

  +-------------------+
  |  Analogy / Why    |  <-- Real-world intuition
  +-------------------+
  |  Theory / Diagram |  <-- ASCII art, no fluff
  +-------------------+
  |  Code Example     |  <-- Go or Rust, runnable
  +-------------------+
  |  Exercises        |  <-- Test your understanding
  +-------------------+
```

Read on your phone. Try the code on your laptop.
Check boxes above as you finish each lesson.

---

## Prerequisites

- System Design track (especially CAP, Raft basics,
  consistent hashing, message queues)
- Basic Go or Rust knowledge
- Comfort with networking concepts (TCP, HTTP, RPC)

---

## References

- [Glossary](reference-glossary.md) — All terms in one place
- [Algorithm Comparison](reference-algorithms.md) — Side-by-side table

---

## Time Estimate

| Phase | Lessons | Estimated Time |
|-------|---------|----------------|
| Foundations | 1-3 | 3-4 hours |
| Coordination | 4-6 | 4-5 hours |
| Consistency | 7-9 | 4-5 hours |
| Conflict | 10-12 | 3-4 hours |
| Reliability | 13-15 | 3-4 hours |
| Advanced | 16-19 | 4-5 hours |
| Capstone | 20 | 6-8 hours |

Total: ~30-35 hours at a comfortable pace.

---

[Start with Lesson 1: Why Distributed Systems -->](01-why-distributed.md)
