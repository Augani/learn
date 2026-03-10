# Lesson 4: Multi-Region Architecture

> Single-region is a single point of failure. Multi-region
> is a distributed systems problem you've chosen to have.

---

## The Analogy

Imagine you run a chain of libraries. Each library has a complete
catalog, staff, and checkout system. A patron can walk into any
location and check out a book.

Now the hard question: when someone checks out a book in the
downtown branch, how quickly does the uptown branch know that
book is unavailable? If both branches try to check out the last
copy simultaneously, who wins?

Single-region is one library. Simple but fragile — if it floods,
everyone loses access. Multi-region is the chain: resilient, but
now you're managing inventory synchronization, conflicting
checkouts, and the question of which branch is the "source of
truth."

---

## Active-Passive vs Active-Active

```
  ACTIVE-PASSIVE (Warm Standby)

  ┌────────────────┐         ┌────────────────┐
  │   US-EAST      │ ──────> │   EU-WEST      │
  │   (PRIMARY)    │  async  │   (STANDBY)    │
  │                │  repli- │                │
  │ ┌────────────┐ │  cation │ ┌────────────┐ │
  │ │  App (RW)  │ │         │ │  App (RO)  │ │
  │ └────────────┘ │         │ └────────────┘ │
  │ ┌────────────┐ │         │ ┌────────────┐ │
  │ │  DB (RW)   │ │─────────│>│ DB (Replica)│ │
  │ └────────────┘ │         │ └────────────┘ │
  └────────────────┘         └────────────────┘

  Failover: promote EU-WEST to primary (minutes to hours)
  Data loss: RPO = replication lag (seconds to minutes)


  ACTIVE-ACTIVE (Multi-Master)

  ┌────────────────┐         ┌────────────────┐
  │   US-EAST      │ <─────> │   EU-WEST      │
  │                │  bi-dir │                │
  │ ┌────────────┐ │  repli- │ ┌────────────┐ │
  │ │  App (RW)  │ │  cation │ │  App (RW)  │ │
  │ └────────────┘ │         │ └────────────┘ │
  │ ┌────────────┐ │         │ ┌────────────┐ │
  │ │  DB (RW)   │ │<────────│>│  DB (RW)   │ │
  │ └────────────┘ │         │ └────────────┘ │
  └────────────────┘         └────────────────┘

  Failover: DNS update (seconds to minutes)
  Data loss: conflicts must be resolved
  Complexity: 10x harder than active-passive
```

### When to Use Which

```
  Active-Passive:
  - Disaster recovery (not performance)
  - Regulatory compliance (data in specific region)
  - Simpler operational model
  - Acceptable RTO: minutes to hours

  Active-Active:
  - Low-latency requirements globally
  - Zero-downtime failover requirement
  - Users distributed across regions
  - RTO: seconds
```

---

## Conflict Resolution

Active-active means two regions can modify the same data
simultaneously. Conflicts WILL happen. You need a strategy.

### Last-Writer-Wins (LWW)

```
  US-EAST: UPDATE user SET name = 'Alice' WHERE id = 1  (T=100)
  EU-WEST: UPDATE user SET name = 'Alicia' WHERE id = 1 (T=101)

  LWW: EU-WEST wins (higher timestamp)
  Result: name = 'Alicia' everywhere

  Problem: US-EAST's write is silently lost.
  The user who typed 'Alice' never knows.
```

LWW is simple and works for data where "most recent" is
genuinely correct (user profile updates, preferences). It's
dangerous for anything where losing a write matters (inventory
counts, account balances).

### Application-Level Resolution

```
  US-EAST: Add item X to cart
  EU-WEST: Add item Y to cart

  Merge strategy: Union of both → cart has {X, Y}
  This is domain-specific logic. No generic solution works.

  US-EAST: Set quantity of item X to 3
  EU-WEST: Set quantity of item X to 5

  Merge strategy: ??? (depends on business rules)
  - Take the higher? (customer might get extra items)
  - Take the lower? (customer might not get enough)
  - Flag for human review? (slow)
```

### CRDTs (Conflict-Free Replicated Data Types)

CRDTs are data structures that mathematically guarantee
convergence without coordination. Every replica independently
applies operations and they all converge to the same state.

```
  G-Counter (Grow-only Counter):

  Each region maintains its own counter.
  Total = sum of all regions.

  US-EAST: [US=5, EU=0]  →  Total = 5
  EU-WEST: [US=0, EU=3]  →  Total = 3

  After sync:
  US-EAST: [US=5, EU=3]  →  Total = 8
  EU-WEST: [US=5, EU=3]  →  Total = 8

  No conflicts. Ever.


  PN-Counter (Positive-Negative Counter):

  Two G-Counters: one for increments, one for decrements.
  Value = sum(increments) - sum(decrements)


  OR-Set (Observed-Remove Set):

  Add and remove elements without conflicts.
  Add("X") in US-EAST + Remove("X") in EU-WEST:
  If add happened after the observed state of remove → X stays
  If remove saw the specific add → X is removed
```

```go
type GCounter struct {
	counts map[string]int64
}

func NewGCounter(nodeID string) *GCounter {
	return &GCounter{counts: map[string]int64{nodeID: 0}}
}

func (c *GCounter) Increment(nodeID string, amount int64) {
	if amount <= 0 {
		return
	}
	c.counts[nodeID] += amount
}

func (c *GCounter) Value() int64 {
	var total int64
	for _, v := range c.counts {
		total += v
	}
	return total
}

func (c *GCounter) Merge(other *GCounter) {
	for nodeID, otherCount := range other.counts {
		if current, exists := c.counts[nodeID]; !exists || otherCount > current {
			c.counts[nodeID] = otherCount
		}
	}
}
```

### Conflict Resolution Decision Matrix

```
  ┌────────────────────┬──────────────┬───────────────────────┐
  │ Data Type          │ Strategy     │ Example               │
  ├────────────────────┼──────────────┼───────────────────────┤
  │ User preferences   │ LWW          │ Theme, language       │
  │ Shopping cart       │ OR-Set CRDT  │ Add/remove items      │
  │ View counts        │ G-Counter    │ Page views, likes     │
  │ Inventory          │ Reserve per  │ 100 units per region  │
  │                    │ region       │ (no cross-region tx)  │
  │ Account balance    │ Centralized  │ Route to primary      │
  │                    │ writes       │ region for writes     │
  │ User content       │ Operational  │ Google Docs-style OT  │
  │ (collaborative)    │ transform    │ or CRDT               │
  └────────────────────┴──────────────┴───────────────────────┘
```

---

## Global Load Balancing

Routing users to the right region is the first problem to solve:

```
  Tier 1: DNS-based (GeoDNS)

  User in Tokyo ──DNS──> api.example.com
                         └──> 203.0.113.1 (AP-NORTHEAST)

  User in London ──DNS──> api.example.com
                          └──> 198.51.100.1 (EU-WEST)

  Pros: Simple, no infrastructure needed
  Cons: DNS caching (TTL), no health checks, imprecise


  Tier 2: Anycast + Edge (Cloudflare, AWS Global Accelerator)

  User in Tokyo ──Anycast──> Edge POP (Tokyo)
                              └──> Origin (AP-NORTHEAST)

  User in London ──Anycast──> Edge POP (London)
                               └──> Origin (EU-WEST)

  Pros: Fast failover, health checks, precise routing
  Cons: Cost, complexity, debugging difficulty


  Tier 3: Application-level routing

  User ──> Edge ──> Route based on:
                    - User's home region (in JWT/session)
                    - Data residency requirements
                    - Current region health
                    - Feature flag per region
```

### Latency Budgets

Every request has a latency budget. Multi-region means you need
to track where time is spent:

```
  Request latency budget: 200ms

  ┌─────────────────────────────────────────────────────┐
  │ Component              │ Budget  │ Actual │ Status  │
  ├─────────────────────────────────────────────────────┤
  │ Edge → Origin          │  30ms   │  25ms  │ ✓      │
  │ Auth check             │  20ms   │  15ms  │ ✓      │
  │ Business logic         │  10ms   │   8ms  │ ✓      │
  │ Database query         │  50ms   │  45ms  │ ✓      │
  │ Cross-region read      │ 100ms   │ 120ms  │ ✗ OVER │
  │ Response serialization │  10ms   │   5ms  │ ✓      │
  ├─────────────────────────────────────────────────────┤
  │ TOTAL                  │ 200ms   │ 218ms  │ ✗ OVER │
  └─────────────────────────────────────────────────────┘

  The cross-region read blew the budget.
  Fix: cache locally, or eliminate the cross-region call.
```

Cross-region network latency is physics, not engineering:

```
  US-EAST to US-WEST:     ~60-80ms RTT
  US-EAST to EU-WEST:     ~80-120ms RTT
  US-EAST to AP-SOUTHEAST: ~200-250ms RTT
  EU-WEST to AP-NORTHEAST: ~250-300ms RTT
```

---

## Data Residency

Some data must stay in specific regions by law:

```
  GDPR (EU):     EU user data processed/stored in EU
  LGPD (Brazil): Brazilian user data in Brazil
  PDPA (Thailand): Thai citizen data in Thailand
  PIPL (China):  Chinese user data in China

  Architecture implication:

  ┌─────────────────────────────────────────────┐
  │              Global Router                   │
  │  (routes based on user's data residency)     │
  └─────┬──────────┬──────────┬────────────────┘
        │          │          │
        ▼          ▼          ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐
  │ EU Cell │ │ US Cell │ │ AP Cell │
  │         │ │         │ │         │
  │ EU user │ │ US user │ │ AP user │
  │ data    │ │ data    │ │ data    │
  │ ONLY    │ │ ONLY    │ │ ONLY    │
  └─────────┘ └─────────┘ └─────────┘
```

Data residency requirements often conflict with active-active
designs. If EU user data must stay in EU, you can't replicate
it to US for low-latency reads. Solutions:

1. **Cell-per-region**: Each region is a complete, independent cell.
   Cross-region requests are proxied, not replicated.
2. **Metadata global, PII local**: Replicate non-PII metadata
   globally, keep PII in the home region.
3. **Tokenization**: Replace PII with tokens globally, resolve
   tokens in the home region.

---

## Failover Testing

Untested failover is not failover — it's a hope.

```
  Failover Testing Maturity Levels:

  Level 0: "We have a standby region" (never tested)
  Level 1: Annual DR test (scheduled, announced)
  Level 2: Quarterly failover tests (scheduled)
  Level 3: Monthly chaos experiments (unannounced)
  Level 4: Continuous failover (Netflix-style)

  Most companies are at Level 0 or 1.
  You should aim for Level 2 minimum.
```

### Failover Runbook

```yaml
failover_runbook:
  trigger: "Primary region health check fails for 5 minutes"

  automated_steps:
    - name: "Update DNS"
      action: "Route53 failover record activates"
      expected_time: "30-60 seconds"

    - name: "Warm up standby"
      action: "Scale standby compute to match primary"
      expected_time: "2-5 minutes"

    - name: "Verify standby health"
      action: "Run synthetic transactions"
      expected_time: "1-2 minutes"

  manual_steps:
    - name: "Verify data consistency"
      action: "Check replication lag, identify lost writes"
      owner: "on-call DBA"

    - name: "Notify stakeholders"
      action: "Post in #incidents, page leadership if P1"
      owner: "incident commander"

  rollback:
    - name: "Verify primary recovery"
      action: "Health checks passing for 10 minutes"
    - name: "Resync data"
      action: "Replicate writes from standby back to primary"
    - name: "Gradual traffic shift"
      action: "10% → 25% → 50% → 100% over 30 minutes"

  metrics_to_watch:
    - replication_lag_seconds
    - error_rate_by_region
    - latency_p99_by_region
    - active_connections_by_region
```

### Game Day Template

```
  Scenario: US-EAST database becomes unavailable

  Pre-conditions:
  - All regions healthy
  - Replication lag < 1 second
  - On-call team aware this is a drill

  Execution:
  1. Block all DB connections in US-EAST (iptables rule)
  2. Observe: Does traffic shift to EU-WEST?
  3. Observe: What's the error rate during transition?
  4. Observe: Do dependent services degrade gracefully?
  5. After 30 minutes: restore US-EAST DB
  6. Observe: Does traffic shift back?
  7. Observe: Is data consistent across regions?

  Success criteria:
  - Error rate < 1% during failover
  - Failover completes in < 2 minutes
  - Zero data loss
  - All services recover without manual intervention
```

---

## Multi-Region Database Options

```
  ┌────────────────────┬──────────────┬───────────┬───────────────┐
  │ Database           │ Multi-Region │ Conflict  │ Latency       │
  │                    │ Mode         │ Strategy  │               │
  ├────────────────────┼──────────────┼───────────┼───────────────┤
  │ CockroachDB        │ Active-active│ Serializ- │ Cross-region  │
  │                    │ (consensus)  │ able txns │ for writes    │
  ├────────────────────┼──────────────┼───────────┼───────────────┤
  │ Spanner            │ Active-active│ TrueTime  │ Cross-region  │
  │                    │ (consensus)  │ (global)  │ for writes    │
  ├────────────────────┼──────────────┼───────────┼───────────────┤
  │ DynamoDB Global    │ Active-active│ LWW       │ Local reads   │
  │ Tables             │ (replication)│           │ & writes      │
  ├────────────────────┼──────────────┼───────────┼───────────────┤
  │ PostgreSQL +       │ Active-active│ Custom    │ Local reads   │
  │ BDR (EDB)          │ (logical rep)│ conflict  │ & writes      │
  │                    │              │ handlers  │               │
  ├────────────────────┼──────────────┼───────────┼───────────────┤
  │ Redis Enterprise   │ Active-active│ CRDTs     │ Sub-ms local  │
  │                    │ (CRDB)       │           │               │
  ├────────────────────┼──────────────┼───────────┼───────────────┤
  │ PostgreSQL +       │ Active-      │ N/A       │ Local reads,  │
  │ Streaming Replica  │ passive      │ (single   │ cross-region  │
  │                    │              │  writer)  │ writes        │
  └────────────────────┴──────────────┴───────────┴───────────────┘
```

---

## Exercises

1. **Region design.** You're deploying an active-active system
   in US-EAST and EU-WEST. Users can update their profile (name,
   email, preferences) from any region. Design the conflict
   resolution strategy. What happens when the same user updates
   their name in both regions within 100ms?

2. **Latency budget.** Your API has a 150ms P99 latency SLO. The
   request flow is: auth (20ms) → user service (15ms) → order
   service (25ms) → payment service (35ms) → database (40ms).
   What happens when you add a cross-region call? Where do you
   add caching to stay within budget?

3. **Failover simulation.** Design a game day exercise for failing
   over your primary database from US-EAST to EU-WEST. What
   metrics do you monitor? What's your rollback plan? How do you
   handle the writes that happened during the split-brain window?

4. **Data residency architecture.** Your SaaS product serves
   customers in EU, US, and Southeast Asia. EU customers require
   GDPR compliance, US has no data residency requirements, and
   Singapore requires data to stay in-country. Design the data
   architecture. How do you handle a US company with EU employees?

---

[Next: Lesson 5 — Zero-Downtime Migrations -->](05-zero-downtime-migrations.md)
