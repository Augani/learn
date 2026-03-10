# Thinking in Trade-offs

Here's the biggest secret about system design: there is no right answer.

Every experienced engineer you've ever admired didn't get there by memorizing
"the correct architecture." They got there by deeply understanding trade-offs —
knowing what you gain and what you give up with every decision.

System design is not a math test with one correct solution. It's more like city
planning.

---

## The City Planning Analogy

Imagine you're the city planner for a growing town. Every decision you make has
ripple effects:

- **One-way streets** speed up traffic flow in one direction but make it harder
  to reach certain destinations.
- **Highway on-ramps** bring people into the city faster but create bottleneck
  exits that back up during rush hour.
- **Zoning laws** that separate residential from commercial areas are clean and
  organized but force everyone to commute.
- **Mixed-use zoning** puts shops and homes together, reducing commute times but
  increasing noise and complexity.
- **Wide roads** handle more traffic but cost more to build, take longer to cross
  on foot, and eat into building space.
- **Public transit** reduces car traffic but requires massive upfront investment
  and ongoing maintenance.

None of these are "wrong." They're all trade-offs. The best city planners don't
argue that one-way streets are universally better — they understand *when* and
*where* one-way streets make sense given the constraints.

System design is exactly the same. You're building a city for data.

```
CITY PLANNING                    SYSTEM DESIGN
─────────────                    ─────────────
Roads                    →       Network connections
Intersections            →       Load balancers / routers
Buildings                →       Servers / services
Water/Power grid         →       Databases / storage
Mail system              →       Message queues
Emergency services       →       Monitoring / alerting
Zoning laws              →       Service boundaries
Public transit           →       CDN / caching layers
Population growth        →       Traffic/user growth
```

---

## The Four Fundamental Trade-offs

Almost every system design decision boils down to one of these four tensions.

### 1. Consistency vs Availability

This is the CAP theorem in disguise, but forget the theory for a moment. Think
about it practically.

**Consistency** means every read gets the most recent write. When you update your
profile picture, everyone immediately sees the new one.

**Availability** means the system always responds, even if the data might be
slightly stale. Your profile picture might show the old one for a few seconds on
some servers.

```
STRONG CONSISTENCY                    HIGH AVAILABILITY
       │                                      │
       ▼                                      ▼
 "Is my balance                        "Is the site
  exactly right?"                       always up?"

  ┌─────────┐                          ┌─────────┐
  │ Bank    │  ← Must be correct       │ Twitter │  ← Must be available
  │ Account │     at all times         │ Feed    │     even if slightly stale
  └─────────┘                          └─────────┘
       │                                      │
 • Financial data                      • Social feeds
 • Inventory counts                    • Like counts
 • Seat reservations                   • View counts
 • Medical records                     • Search results
```

**Real-world example in Go:**

When you build a Go service that reads from a database, you choose between:
- Reading from the primary (consistent, but the primary is a bottleneck)
- Reading from a replica (available, but might be milliseconds behind)

In TypeScript/Node, this shows up when you decide whether your API returns
cached data (available, fast, possibly stale) or always hits the database
(consistent, slower, can fail).

**When to pick which:**

| Pick Consistency | Pick Availability |
|---|---|
| Financial transactions | Social media feeds |
| Inventory/booking systems | Analytics dashboards |
| User authentication | Search results |
| Medical records | Recommendation engines |
| Distributed locks | Content pages |

### 2. Latency vs Throughput

**Latency** is how fast one request completes. "How long does the user wait?"

**Throughput** is how many requests you handle per second. "How many users can
we serve simultaneously?"

These often conflict:

```
LOW LATENCY                           HIGH THROUGHPUT
     │                                       │
     ▼                                       ▼
  Process each                          Batch requests
  request ASAP                          for efficiency

  ┌────────────┐                       ┌────────────┐
  │ Handle one │                       │ Collect 100│
  │ request    │                       │ requests   │
  │ immediately│                       │ process as │
  │            │                       │ one batch  │
  └────────────┘                       └────────────┘

  Latency: 1ms                         Latency: 50ms
  Throughput: 1000/s                    Throughput: 10,000/s
```

**Analogy:** Think about grocery store checkout lines.
- **Low latency:** Every customer gets their own cashier. Fast for each person,
  but expensive (lots of cashiers).
- **High throughput:** Batch scanning. Wait until 10 people are in line, then
  process them together efficiently. Each person waits longer, but the store
  handles more customers per hour.

**In Go:** This shows up when you decide between processing each message from a
channel immediately vs batching them:

```go
func processStream(items <-chan Item, db *sql.DB) {
    batch := make([]Item, 0, 100)
    ticker := time.NewTicker(100 * time.Millisecond)
    defer ticker.Stop()

    for {
        select {
        case item := <-items:
            batch = append(batch, item)
            if len(batch) >= 100 {
                insertBatch(db, batch)
                batch = batch[:0]
            }
        case <-ticker.C:
            if len(batch) > 0 {
                insertBatch(db, batch)
                batch = batch[:0]
            }
        }
    }
}
```

Individual inserts = low latency, low throughput.
Batched inserts = higher latency, much higher throughput.

**In TypeScript:** Same concept with `dataloader` batching:

```typescript
const userLoader = new DataLoader<string, User>(async (userIds) => {
    const users = await db.query(
        `SELECT * FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
        [...userIds]
    );
    const userMap = new Map(users.map(u => [u.id, u]));
    return userIds.map(id => userMap.get(id) ?? new Error(`No user: ${id}`));
});
```

Instead of N individual queries, DataLoader collects all requests within a tick
of the event loop and fires one query. Latency goes up slightly, throughput
goes way up.

### 3. Simplicity vs Scalability

The simplest architecture handles the least load. The most scalable architecture
is the most complex to build and operate.

```
SIMPLE                                        SCALABLE
  │                                               │
  ▼                                               ▼

  ┌──────────┐                    ┌──────────────────────────────┐
  │          │                    │         Load Balancer         │
  │  Single  │                    └──────┬──────────┬────────────┘
  │  Server  │                           │          │
  │          │                    ┌──────┴───┐ ┌────┴─────┐
  │  App +   │                    │ App Srv 1│ │ App Srv 2│ ...
  │  DB +    │                    └──────┬───┘ └────┬─────┘
  │  Cache   │                           │          │
  │          │                    ┌──────┴──────────┴────────┐
  └──────────┘                    │     Message Queue        │
                                  └──────┬──────────┬────────┘
  1 thing to deploy                      │          │
  1 thing to monitor               ┌─────┴──┐ ┌────┴───┐
  1 thing to debug                 │Worker 1│ │Worker 2│ ...
  Handles ~10K users               └────────┘ └────────┘

                                   20+ things to deploy
                                   20+ things to monitor
                                   Distributed debugging
                                   Handles ~100M users
```

**The trap:** Engineers love building complex, scalable systems. It feels
impressive. But if you're serving 1,000 users, a single Go binary with SQLite
is the *correct* architecture. The complex version is wrong — it wastes time,
money, and introduces failure modes you don't need.

**In Go terms:** A single `go build` producing one binary that serves HTTP,
manages state in memory, and writes to a local SQLite file is *beautiful*
engineering for small scale. Don't apologize for it.

**In TypeScript terms:** A single Express server with a PostgreSQL database is
not "un-scalable." It's the right tool for the right scale. Premature
optimization is the root of all evil.

### 4. Cost vs Performance

Faster costs more. Always.

```
COST                                          PERFORMANCE
  │                                               │
  ▼                                               ▼

  One t3.micro ($8/mo)                 10x c5.4xlarge ($2,400/mo)
  Shared database ($0)                 Dedicated RDS ($3,000/mo)
  No CDN                               Global CDN ($500/mo)
  No caching                           Redis cluster ($1,000/mo)

  Total: ~$8/month                     Total: ~$7,000/month
  Latency: 200-500ms                   Latency: 20-50ms
  Handles: ~1K users                   Handles: ~10M users
```

The question is never "what's the fastest?" — it's "what's fast *enough* for
our budget and users?"

**A startup with 1,000 users** spending $7,000/month on infrastructure is
burning money. A $50/month setup works fine.

**A company with 10M users** generating $1M/month in revenue can easily justify
$7,000/month in infrastructure if it means better user experience and lower churn.

---

## The "It Depends" Mindset

When someone asks "should I use SQL or NoSQL?" the correct answer is "it depends."

This isn't a cop-out. It's the hallmark of an experienced engineer. Here's what
it depends ON:

```
┌─────────────────────────────────────────────────────────────┐
│                     "Should I use X?"                       │
│                                                             │
│  Depends on:                                                │
│                                                             │
│  1. SCALE          How many users/requests/data?            │
│  2. REQUIREMENTS   Consistency? Latency? Availability?      │
│  3. TEAM           What does the team know? Hiring pool?    │
│  4. BUDGET         Startup vs enterprise budget?            │
│  5. TIMELINE       Ship in 2 weeks or 2 years?              │
│  6. EVOLUTION      Where will this be in 3 years?           │
│  7. OPERATIONS     Who maintains this at 3am?               │
│                                                             │
│  The answer changes when ANY of these change.               │
└─────────────────────────────────────────────────────────────┘
```

### SQL vs NoSQL — It Depends

| Factor | Favors SQL | Favors NoSQL |
|---|---|---|
| Data has relationships | Strong foreign keys, joins | Denormalized, embedded docs |
| Schema changes often | Migrations are annoying | Schema-less is flexible |
| Need transactions | ACID guarantees | Limited transaction support |
| Read patterns are varied | Flexible queries with SQL | Optimized for known access patterns |
| Scale to billions of rows | Sharding is hard | Built-in horizontal scaling |
| Team expertise | Most devs know SQL | Varies by NoSQL flavor |
| Consistency needs | Strong by default | Eventual by default |

### Monolith vs Microservices — It Depends

| Factor | Favors Monolith | Favors Microservices |
|---|---|---|
| Team size | < 20 engineers | > 50 engineers |
| Deploy frequency | Weekly/monthly | Multiple times per day |
| Code coupling | High coupling is fine | Teams need independence |
| Operational maturity | No k8s expertise | Strong DevOps culture |
| Time to market | Need to ship fast | Can invest in platform |
| Debugging | Simple stack traces | Need distributed tracing |

---

## The Same App at Different Scales

Let's design a todo app. Yes, a humble todo app. Watch how *everything* changes
as the user count grows.

### 100 Users — The Side Project

```
┌──────────┐      ┌────────────────────────┐
│  Browser │─────▶│   Single Server         │
└──────────┘      │                        │
                  │  ┌──────────────────┐  │
                  │  │   Go/Node App    │  │
                  │  └────────┬─────────┘  │
                  │           │            │
                  │  ┌────────┴─────────┐  │
                  │  │    SQLite        │  │
                  │  └──────────────────┘  │
                  │                        │
                  │  $5/month VPS          │
                  └────────────────────────┘
```

**Architecture decisions:**
- Single process, single file database
- No caching needed (100 users barely generate load)
- Deploy with `scp` or a simple git pull
- Backups: just copy the SQLite file
- Auth: simple JWT, maybe even just sessions in a cookie

**In Go:** One binary. `net/http` + `database/sql` + `mattn/go-sqlite3`. Done.

**In TypeScript:** Express + better-sqlite3. One `npm start`. Done.

**Why this is correct:** Anything more complex is wasted effort. Your time is
better spent building features.

### 1M Users — The Startup

```
                        ┌──────────┐
                        │   CDN    │ (static files)
                        └────┬─────┘
                             │
┌──────────┐           ┌────┴─────┐
│ Clients  │──────────▶│   LB     │
└──────────┘           └────┬─────┘
                            │
                   ┌────────┴────────┐
                   │                 │
             ┌─────┴────┐      ┌────┴─────┐
             │  App 1   │      │  App 2   │
             └─────┬────┘      └────┬─────┘
                   │                │
                   └───────┬────────┘
                           │
                   ┌───────┴───────┐
                   │    Redis      │ (sessions + cache)
                   └───────┬───────┘
                           │
                   ┌───────┴───────┐
                   │  PostgreSQL   │
                   │  Primary +    │
                   │  Read Replica │
                   └───────────────┘

                   ~$500-2,000/month
```

**What changed and why:**
- **Load balancer:** One server can technically handle 1M users, but you need
  redundancy. If that server dies, everyone is down.
- **Multiple app servers:** For redundancy, not for performance (yet).
- **PostgreSQL:** SQLite doesn't handle concurrent writes well. You need a real
  database server.
- **Redis:** Sessions can't live in process memory anymore (multiple servers).
  Also good for caching hot queries.
- **CDN:** Users are geographically distributed. Serve static assets from edge.
- **Read replica:** Most reads can go to the replica, keeping the primary free
  for writes.

**In Go:** Same app code, but now behind a load balancer. Use `pgx` for
PostgreSQL, `go-redis` for Redis. Config changes, not code changes.

**In TypeScript:** Same Express app, but switch from SQLite to `pg` pool,
add `ioredis`. Minimal code changes.

### 100M Users — The Platform

```
                    ┌────────────┐
                    │ Global DNS │ (geo-routing)
                    └─────┬──────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
      ┌─────┴────┐ ┌─────┴────┐ ┌─────┴────┐
      │  US-East │ │ US-West  │ │  EU      │
      │  Region  │ │  Region  │ │  Region  │
      └─────┬────┘ └─────┬────┘ └─────┬────┘
            │             │             │
      ┌─────┴─────────────┴─────────────┴─────┐
      │                                        │
      │  Per Region:                           │
      │  ┌────────────┐  ┌──────────────────┐  │
      │  │    CDN     │  │  API Gateway     │  │
      │  └────────────┘  └────────┬─────────┘  │
      │                           │             │
      │         ┌─────────────────┤             │
      │         │                 │             │
      │  ┌──────┴──────┐  ┌──────┴──────┐     │
      │  │ Todo Service│  │ User Service│     │
      │  │  (10 pods)  │  │  (5 pods)  │     │
      │  └──────┬──────┘  └──────┬──────┘     │
      │         │                │             │
      │  ┌──────┴──────┐  ┌─────┴───────┐    │
      │  │   Redis     │  │ PostgreSQL  │    │
      │  │   Cluster   │  │  Cluster    │    │
      │  └─────────────┘  │  (sharded)  │    │
      │                    └─────────────┘    │
      │                                        │
      │  ┌──────────────┐  ┌──────────────┐   │
      │  │ Kafka/SQS   │  │ Search       │   │
      │  │ Event Bus   │  │ (Elastic)    │   │
      │  └──────────────┘  └──────────────┘   │
      │                                        │
      └────────────────────────────────────────┘

      ~$50,000-200,000/month
```

**What changed and why:**
- **Multi-region:** 100M users means global presence. Latency matters.
- **Microservices:** Todo logic and User logic are separate services owned by
  separate teams. They deploy independently.
- **Database sharding:** 100M users generate too much data for one database.
  Shard by user ID.
- **Event bus (Kafka/SQS):** Services communicate asynchronously. When a todo is
  completed, an event fires to update analytics, send notifications, etc.
- **Search service:** Users want to search their todos. Full-text search requires
  a separate indexing system.
- **API Gateway:** Rate limiting, auth, routing, versioning — all centralized.
- **Kubernetes:** Managing 50+ service instances requires orchestration.

**What's the same:** The core business logic — creating and completing todos —
is fundamentally unchanged. A function that validates a todo item looks the same
at 100 users and 100M users. What changed is everything *around* it.

---

## Trade-off Decision Framework

When you face a design decision, run through this mental framework:

```
┌──────────────────────────────────────────────────────┐
│           THE TRADE-OFF DECISION FRAMEWORK           │
│                                                      │
│  1. What are we optimizing for?                      │
│     (latency? cost? developer speed? reliability?)   │
│                                                      │
│  2. What are the options?                            │
│     (list at least 2, preferably 3)                  │
│                                                      │
│  3. For each option:                                 │
│     - What do we GAIN?                               │
│     - What do we LOSE?                               │
│     - What's the COST? (money, time, complexity)     │
│     - What's the RISK?                               │
│     - Is it REVERSIBLE?                              │
│                                                      │
│  4. Given our constraints, which trade-off is        │
│     acceptable?                                      │
│                                                      │
│  5. Document WHY we chose this, not just WHAT.       │
└──────────────────────────────────────────────────────┘
```

### Example: Choosing a Message Queue

Your Go service needs to process background jobs. Options:

| | In-Memory Channel | Redis Queue | Kafka |
|---|---|---|---|
| **Gain** | Simple, fast, no deps | Persistent, shared across instances | Durable, replayable, ordered |
| **Lose** | Jobs lost on restart | Limited ordering | Complexity, ops overhead |
| **Cost** | $0, 0 deps | $50/mo Redis | $500/mo+ managed Kafka |
| **Risk** | Data loss | Redis is SPOF without cluster | Over-engineering |
| **Reversible?** | Easy to swap out | Easy to swap out | Hard to remove once adopted |
| **Good for** | Dev/prototype | Small-medium production | Large-scale, event-driven |

If you're a startup with 5 engineers: Redis queue. Ship today, scale later.
If you're a platform team at a large company: Kafka. The investment pays off.
If you're prototyping: In-memory channel. Don't waste time on infrastructure.

---

## How Go/TypeScript Projects Make Architecture Decisions

You already make trade-off decisions in your code every day. Let's connect
those to system design.

### Go Architecture Trade-offs

| Decision | Trade-off |
|---|---|
| Goroutines vs thread pool | Simplicity vs control over resource limits |
| `interface{}` vs generics | Flexibility vs type safety |
| Monorepo vs multi-repo | Simple imports vs independent deployments |
| `sync.Mutex` vs channels | Familiar locking vs Go-idiomatic communication |
| Embedding vs composition | Convenience vs explicit dependencies |
| stdlib `net/http` vs framework | Control vs productivity |

### TypeScript Architecture Trade-offs

| Decision | Trade-off |
|---|---|
| Monorepo (Turborepo) vs multi-repo | Shared code vs independent deploys |
| REST vs GraphQL | Simplicity vs flexibility for clients |
| ORM (Prisma) vs raw SQL | Productivity vs performance control |
| SSR vs SPA vs SSG | SEO/perf vs interactivity vs build time |
| Zod vs io-ts vs manual validation | Runtime safety vs bundle size vs effort |
| Express vs Fastify vs Hono | Ecosystem vs performance vs edge compat |

Notice: every row has "vs" in it. There is no row that says "always use X."
That's the trade-off mindset.

---

## The Reversibility Principle

Not all decisions are created equal.

```
ONE-WAY DOORS (Hard to reverse)        TWO-WAY DOORS (Easy to reverse)
─────────────────────────────          ──────────────────────────────
• Programming language choice           • Web framework choice
• Database engine (Postgres vs Mongo)   • Caching strategy
• Cloud provider (AWS vs GCP)           • API versioning scheme
• Monolith vs microservices split       • Background job library
• Data model fundamentals               • Logging library
• Wire protocol (REST vs gRPC)          • CI/CD tool
```

**Spend time on one-way doors.** Agonize over them. Get input from the team.
Prototype both options. These are the decisions that are expensive to change later.

**Move fast on two-way doors.** Pick something reasonable, ship it, change it
later if needed. Spending a week choosing between logging libraries is a waste.

**Amazon calls this "Type 1 vs Type 2 decisions."** Type 1 decisions are
irreversible — be careful. Type 2 decisions are reversible — move fast.

---

## Common False Trade-offs

Sometimes people present false dichotomies. Watch out for these:

### "We need to choose between fast and correct"
Usually false. You can have both with proper engineering. The real trade-off
is fast-and-correct vs time-to-market.

### "Microservices are more scalable than monoliths"
Not inherently. A well-architected monolith can scale further than poorly
designed microservices. The trade-off is organizational scaling (team
independence), not technical scaling.

### "NoSQL is faster than SQL"
Depends entirely on the access pattern. PostgreSQL with proper indexes can
outperform MongoDB for many workloads. The trade-off is between flexible
queries (SQL) and flexible schemas (NoSQL).

### "Caching always helps performance"
Not if your cache hit rate is low. If users mostly access unique data (like
their own dashboard), caching doesn't help much. The trade-off is between
added complexity and actual performance gain.

---

## Exercises

### Exercise 1: Trade-off Analysis
For each pair, write down when you'd pick A vs B:
1. WebSockets vs Server-Sent Events vs Polling
2. JWT vs Session cookies
3. PostgreSQL vs DynamoDB for a new project
4. Single region vs Multi-region deployment
5. Sync processing vs Async queue

### Exercise 2: Scale Reasoning
Pick an app you use daily. Sketch its architecture at:
- 100 users (your friends)
- 1M users (a small startup)
- 100M users (a major platform)

What changes at each level? What stays the same?

### Exercise 3: Real-World Trade-off
Think about a technical decision you made recently in Go or TypeScript. Write
down:
- What were the options?
- What did you choose?
- What did you gain?
- What did you give up?
- Would you make the same decision again?

---

## Key Takeaways

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. There is no "right" architecture. Only trade-offs.      │
│                                                             │
│  2. The best answer always starts with "it depends."        │
│                                                             │
│  3. Design for your CURRENT scale, not your fantasy scale.  │
│                                                             │
│  4. Spend time on irreversible decisions,                   │
│     move fast on reversible ones.                           │
│                                                             │
│  5. Every system design decision has costs you can't see    │
│     until you operate it at 3am.                            │
│                                                             │
│  6. The simplest design that meets requirements              │
│     is the best design.                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The goal isn't to know every design pattern. It's to develop the judgment to
know which pattern fits which situation. That judgment comes from understanding
trade-offs at a deep level.

Next up: we'll learn how to do the math that drives these decisions.
