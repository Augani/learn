# Lesson 30: Geo-Distributed Systems

When your users span the globe, a single data center is not enough. A
user in Tokyo shouldn't wait 200ms for a round trip to a server in
Virginia. But having data in multiple regions means dealing with
consistency, latency trade-offs, and data sovereignty laws.

**Analogy:** A multinational bank with branches in New York, London, and
Tokyo. Each branch needs current account balances, but synchronizing
every transaction across three cities in real-time is slow and fragile.
The bank must decide: do all branches share one ledger (consistent but
slow) or keep local copies and reconcile later (fast but eventually
consistent)?

---

## Why Go Multi-Region?

```
Latency (speed of light + network overhead):

  Same region:         1-5 ms
  US East → US West:   60-80 ms
  US East → Europe:    80-120 ms
  US East → Asia:      150-250 ms

  For a single page load requiring 5 sequential API calls:
    Same region:  5 × 5ms = 25ms
    Cross-ocean:  5 × 200ms = 1000ms (1 full second)

  Users notice anything > 100ms. Users leave at > 3 seconds.
```

```
SINGLE REGION:
  ┌─────────┐                          ┌──────────┐
  │ User    │ ──── 200ms round trip ──▶│ us-east  │
  │ (Tokyo) │                          │ (only DC)│
  └─────────┘                          └──────────┘

MULTI-REGION:
  ┌─────────┐              ┌──────────┐
  │ User    │ ── 5ms ────▶│ ap-north │  (local!)
  │ (Tokyo) │              │ (Tokyo)  │
  └─────────┘              └──────────┘
```

---

## Multi-Region Architectures

### Active-Passive (Primary-Secondary)

One region handles all writes. Other regions are read-only replicas.

```
┌──────────────┐          ┌──────────────┐
│  us-east-1   │          │  eu-west-1   │
│  (PRIMARY)   │ ──────▶  │  (REPLICA)   │
│              │  async    │              │
│  reads +     │  repl.   │  reads only  │
│  writes      │          │              │
└──────────────┘          └──────────────┘
                          ┌──────────────┐
                 ──────▶  │  ap-north-1  │
                  async   │  (REPLICA)   │
                  repl.   │  reads only  │
                          └──────────────┘

Writes: always go to us-east-1 (high latency from other regions)
Reads:  served locally (low latency)
Failover: promote a replica if primary goes down
```

**Trade-offs:**
- **Pro:** Simple consistency model (one source of truth)
- **Con:** Write latency for non-primary regions
- **Con:** Failover complexity, risk of data loss

### Active-Active (Multi-Primary)

Every region accepts writes. Changes replicate to all other regions.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  us-east-1   │◀───▶│  eu-west-1   │◀───▶│  ap-north-1  │
│              │     │              │     │              │
│  reads +     │     │  reads +     │     │  reads +     │
│  writes      │     │  writes      │     │  writes      │
└──────────────┘     └──────────────┘     └──────────────┘

Every region is a primary.
Writes are local (fast) but must replicate to other regions.
```

**The hard part: write conflicts.**

```
CONFLICT SCENARIO:

  User edits profile name in us-east (t=0):
    name = "Alice Smith"

  User edits profile name in eu-west (t=0):
    name = "Alice Johnson"

  Both writes succeed locally.
  Replication delivers both to all regions.
  Which one wins?
```

---

## Conflict Resolution

### Last-Writer-Wins (LWW)

Attach a timestamp to every write. Highest timestamp wins.

```
us-east: SET name = "Alice Smith"   @ t=1000
eu-west: SET name = "Alice Johnson" @ t=1002

LWW: "Alice Johnson" wins (later timestamp)

Problem: clock skew. What if us-east's clock is 5ms ahead?
         Then "Alice Smith" might win incorrectly.
```

**Simple but lossy.** The losing write is silently discarded.

### Conflict-Free Replicated Data Types (CRDTs)

Data structures designed to merge without conflicts.

```
CRDT Counter Example:
  us-east increments by 5:  {us-east: 5, eu-west: 0}
  eu-west increments by 3:  {us-east: 0, eu-west: 3}

  Merge: {us-east: 5, eu-west: 3} → total = 8

  No conflict! Both increments are preserved.

CRDT Set Example (Add-wins):
  us-east adds "item_A":    {add: [item_A]}
  eu-west adds "item_B":    {add: [item_B]}

  Merge: {add: [item_A, item_B]}

  No conflict! Both adds preserved.
```

### Application-Level Resolution

Let the application or user decide.

```
Google Docs approach:
  Both edits are kept as operational transforms.
  Changes are merged at the character level.

Shopping cart approach:
  Merge carts by taking the union of items.
  If quantities conflict, take the maximum.
```

| Strategy | Pros | Cons | Best For |
|----------|------|------|----------|
| LWW | Simple | Data loss | Caches, non-critical data |
| CRDT | No conflicts | Limited data types | Counters, sets, flags |
| App-level | Most flexible | Complex code | Business-critical data |
| Manual | No data loss | Requires user action | Collaborative editing |

---

## Global Load Balancing

Route users to the nearest healthy region.

```
┌────────────────────────────────────────────────────┐
│                   DNS-Based Routing                  │
│                                                    │
│  User in Tokyo → DNS resolves api.example.com      │
│                  → GeoDNS returns Tokyo region IP   │
│                                                    │
│  User in London → DNS resolves api.example.com     │
│                   → GeoDNS returns London region IP │
└────────────────────────────────────────────────────┘

  ┌──────────┐
  │  GeoDNS  │
  │ (Route53 │
  │  Latency │
  │  Routing)│
  └────┬─────┘
       │
  ┌────┼─────────────────────────────┐
  │    │              │              │
  │  ┌─▼──────┐  ┌───▼──────┐  ┌──▼───────┐
  │  │us-east │  │eu-west   │  │ap-north  │
  │  │(Virginia)│ │(Ireland) │  │(Tokyo)   │
  │  └────────┘  └──────────┘  └──────────┘
```

### Failover

```
Normal: GeoDNS routes Tokyo users → ap-north-1
ap-north-1 goes down → health check fails
GeoDNS removes ap-north-1 from rotation
Tokyo users → next closest: us-west-2 (100ms instead of 5ms)

  ┌──────────┐     health check
  │  GeoDNS  │────────────────▶ ap-north-1 ✗ (down)
  │          │────────────────▶ us-east-1  ✓
  │          │────────────────▶ eu-west-1  ✓
  └──────────┘
       │
       ▼
  Tokyo users rerouted to us-west-2
```

---

## Data Sovereignty

Some countries require that citizen data stays within their borders.
GDPR (EU), PDPA (Singapore), data localization laws.

```
REQUIREMENT: EU user data must stay in EU

  ┌─────────────────────────────────────────────┐
  │              Routing Layer                    │
  │                                             │
  │  User signs up:                             │
  │    country = "Germany"                       │
  │    → assign to eu-west-1 region             │
  │    → data NEVER leaves EU region            │
  │                                             │
  │  User signs up:                             │
  │    country = "Japan"                         │
  │    → assign to ap-northeast-1               │
  └─────────────────────────────────────────────┘

  Global metadata (which region owns which user):
    user_123 → eu-west-1
    user_456 → ap-northeast-1
    user_789 → us-east-1

  Cross-region query for user_123:
    us-east-1 receives request
    → looks up: user_123 is in eu-west-1
    → proxies request to eu-west-1
    → returns response (data never stored in us-east-1)
```

---

## Edge Computing

Push computation to the edge, not just data.

```
TRADITIONAL:
  User (Tokyo) ──200ms──▶ Origin (Virginia) ──200ms──▶ Response

EDGE:
  User (Tokyo) ──5ms──▶ Edge (Tokyo) ──5ms──▶ Response
                         │
                         ├── Auth check (local)
                         ├── A/B test assignment (local)
                         ├── Rate limiting (local)
                         └── Cache hit → return immediately

  Cache miss only:
  Edge (Tokyo) ──200ms──▶ Origin (Virginia)
```

```
What to run at the edge:        What stays at origin:
  ✓ Auth token validation         ✗ Database writes
  ✓ Rate limiting                 ✗ Complex transactions
  ✓ Static content serving        ✗ Cross-user queries
  ✓ A/B test routing              ✗ Batch processing
  ✓ Geo-based personalization     ✗ ML model training
  ✓ Request transformation
```

---

## Back-of-Envelope: Multi-Region Costs

```
Single region (us-east-1):
  3 app servers:     $600/month
  1 DB cluster:      $1,500/month
  1 Redis cluster:   $500/month
  CDN:               $200/month
  Total:             $2,800/month

Three regions (us-east, eu-west, ap-north):
  9 app servers:     $1,800/month
  3 DB clusters:     $4,500/month
  3 Redis clusters:  $1,500/month
  Cross-region repl: $300/month (data transfer)
  CDN:               $200/month
  GeoDNS:            $50/month
  Total:             $8,350/month

  3x cost for global coverage.
  Worth it if p50 latency drops from 200ms to 20ms.
```

---

## Exercises

1. Design a multi-region architecture for a social media app. Users
   read locally but writes go to the user's home region. Draw the
   data flow for a user in Tokyo posting a photo that a user in London
   sees.

2. Implement a LWW (Last-Writer-Wins) register in Go with vector
   clocks instead of timestamps. Show how it resolves conflicts.

3. Calculate: your app has 10M users (40% US, 30% EU, 20% Asia, 10%
   other). With single-region in us-east, p50 latency is 5ms (US),
   100ms (EU), 200ms (Asia). What's the global p50? How does adding
   eu-west and ap-northeast change it?

4. Design a data sovereignty compliant system for an app operating in
   US, EU, and Singapore. Each region's user data must stay local.
   How do you handle a user who relocates from EU to US?

---

*This concludes Phase 5: Advanced Building Blocks. Next up is Phase 6,
where we apply everything to more real-world designs.*

*Next: [Lesson 31 — Design YouTube](./31-design-youtube.md), where we
tackle video upload, transcoding, and adaptive streaming at scale.*
