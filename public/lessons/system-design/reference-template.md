# System Design Interview / Problem Template

This is your battle plan for approaching any system design problem — whether it's
an interview, a design doc at work, or a side project you're scaling up.

Think of this template like a pilot's pre-flight checklist. Pilots don't wing it
(pun intended). They follow a checklist every single time, even with 30 years of
experience. System design works the same way.

---

## The Five Steps

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   1. CLARIFY REQUIREMENTS           (5 min)             │
│      What are we actually building?                     │
│                         │                               │
│                         ▼                               │
│   2. BACK-OF-ENVELOPE ESTIMATION    (5 min)             │
│      How big is this thing?                             │
│                         │                               │
│                         ▼                               │
│   3. HIGH-LEVEL DESIGN              (10 min)            │
│      Boxes and arrows — the 30,000 ft view              │
│                         │                               │
│                         ▼                               │
│   4. DEEP DIVE                      (15 min)            │
│      Pick 2-3 components and go deep                    │
│                         │                               │
│                         ▼                               │
│   5. TRADE-OFFS & BOTTLENECKS       (5 min)             │
│      What breaks? What would you change?                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Clarify Requirements (5 minutes)

You wouldn't start building a house without blueprints. Don't start designing a
system without knowing what it needs to do.

### Functional Requirements — What Does It Do?

These are the features. The verbs. What users can *do* with the system.

**Questions to ask:**

- What are the core features we need to support?
- Who are the users? (end users, internal tools, other services?)
- What are the main use cases? Walk me through a user flow.
- What does the API look like? What are the main endpoints?
- Do we need real-time updates or is polling okay?
- Do we need search? If so, what kind? (full-text, geospatial, etc.)
- What data do we need to store?
- Are there any features we should explicitly NOT build?

**Example — Design Twitter:**
```
Functional Requirements:
  - Post tweets (280 chars, images, videos)
  - Follow/unfollow users
  - Home timeline (tweets from people you follow)
  - User timeline (all tweets by one user)
  - Like and retweet
  - Search tweets

NOT in scope (for now):
  - Direct messages
  - Trending topics
  - Ads
  - Analytics
```

### Non-Functional Requirements — How Well Does It Do It?

These are the quality attributes. The adjectives. *How* the system behaves.

**Questions to ask:**

- How many users? DAU/MAU?
- What's the expected read:write ratio?
- What latency is acceptable? (p50, p99)
- What availability do we need? (99.9%? 99.99%?)
- Do we need strong consistency or is eventual consistency okay?
- What are the data retention requirements?
- Are there any compliance or regulatory requirements?
- What's the expected growth rate?
- What's our budget / cost sensitivity?
- Is this a global service or single region?

**Example — Design Twitter:**
```
Non-Functional Requirements:
  - 300M DAU
  - Read-heavy: ~100:1 read:write ratio
  - Timeline load: < 200ms p99
  - Tweet post: < 500ms p99
  - 99.99% availability
  - Eventual consistency is acceptable for timeline
  - Strong consistency for tweet counts/likes
  - Global service (users worldwide)
  - 5-year data retention
```

---

## Step 2: Back-of-Envelope Estimation (5 minutes)

Now you know WHAT you're building. Figure out HOW BIG it is. This determines
whether you need 3 servers or 3,000.

**Calculate these:**

| Metric | Formula | Your Estimate |
|---|---|---|
| QPS (average) | DAU × actions_per_user / 86,400 | |
| QPS (peak) | Average × 5 | |
| Read QPS | Total QPS × read_ratio | |
| Write QPS | Total QPS × write_ratio | |
| Storage (daily) | New objects/day × avg size | |
| Storage (5 years) | Daily × 365 × 5 × replication_factor | |
| Bandwidth (in) | Write QPS × avg write size | |
| Bandwidth (out) | Read QPS × avg response size | |
| Memory for cache | Daily active data × 20% (80/20 rule) | |

**Example — Design Twitter:**
```
Users: 300M DAU

Tweets:
  - 300M DAU × 2 tweets/day = 600M tweets/day
  - Write QPS: 600M / 100K = 6,000 QPS avg → 30,000 peak

Timeline reads:
  - 300M DAU × 10 timeline loads/day = 3B reads/day
  - Read QPS: 3B / 100K = 30,000 QPS avg → 150,000 peak

Storage:
  - Tweet: ~1 KB (text + metadata)
  - Media: ~2 MB average (photos, but not all tweets have media)
  - Text storage: 600M × 1KB = 600 GB/day → ~220 TB/year
  - Media storage: 100M media tweets × 2MB = 200 TB/day → ~73 PB/year
  - With 3x replication: ~220 PB/year for media alone

Bandwidth:
  - Write: 30,000 peak × 1 KB = 30 MB/s text
  - Read: 150,000 peak × 10 KB (timeline page) = 1.5 GB/s
  - Media: separate CDN handles this

Cache:
  - Hot tweets (last 24h): 600M × 1 KB = 600 GB
  - Cache 20% of that: ~120 GB → fits in a few Redis nodes
```

---

## Step 3: High-Level Design (10 minutes)

Draw the boxes and arrows. This is the architecture at 30,000 feet.

**Components to consider:**

- Client (web, mobile, API consumers)
- Load balancer
- API gateway
- Application servers
- Database(s) — which type? SQL vs NoSQL?
- Cache layer
- CDN
- Message queue / event bus
- Search service
- Notification service
- Object storage (S3, etc.)
- Monitoring / logging

**Rules of thumb:**

- Start simple. One box per logical service.
- Show the data flow with arrows.
- Label what protocol/data moves on each arrow.
- Show where data is stored.
- Note synchronous vs asynchronous flows.

**Example — Twitter High-Level Design:**

```
                        ┌──────────┐
                        │   CDN    │ (static assets, media)
                        └────┬─────┘
                             │
┌──────────┐           ┌────┴─────┐
│  Client  │──HTTPS───▶│    LB    │
│(web/mob) │           └────┬─────┘
└──────────┘                │
                    ┌───────┴───────┐
                    │  API Gateway  │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────┴────┐ ┌─────┴────┐ ┌──────┴─────┐
        │  Tweet    │ │ Timeline │ │   User     │
        │ Service   │ │ Service  │ │  Service   │
        └─────┬────┘ └─────┬────┘ └──────┬─────┘
              │             │             │
              │        ┌────┴────┐        │
              │        │  Cache  │        │
              │        │ (Redis) │        │
              │        └────┬────┘        │
              │             │             │
        ┌─────┴──────┐ ┌───┴────┐ ┌──────┴─────┐
        │ Tweet DB   │ │Timeline│ │  User DB   │
        │ (writes)   │ │  DB    │ │            │
        └─────┬──────┘ └────────┘ └────────────┘
              │
        ┌─────┴──────┐     ┌──────────────┐
        │  Message   │────▶│  Fan-out     │
        │   Queue    │     │  Service     │
        └────────────┘     └──────────────┘
              │
        ┌─────┴──────┐
        │   Object   │
        │  Storage   │ (media files)
        └────────────┘
```

---

## Step 4: Deep Dive (15 minutes)

Pick 2-3 of the most interesting or challenging components and go deep.

**For each component, discuss:**

- Data model (what does the schema look like?)
- API design (endpoints, request/response)
- Scaling strategy (replication, sharding, caching)
- Failure modes (what happens when this component goes down?)
- Technology choices (and why)

**What to deep-dive on depends on the problem:**

| Problem Type | Good Deep Dives |
|---|---|
| Social media feed | Fan-out strategy, timeline generation, caching |
| Chat system | Message delivery, presence, WebSocket management |
| URL shortener | Hash generation, redirect performance, analytics |
| File storage | Chunking, deduplication, metadata management |
| Search engine | Indexing, ranking, query parsing |
| Rate limiter | Algorithm choice, distributed counting, sliding window |
| Notification system | Delivery guarantees, prioritization, templating |

**Questions to drive the deep dive:**

- How does data flow through this component?
- What's the most common query pattern?
- What happens at 10x the current load?
- What's the failure mode? How do we recover?
- Where's the bottleneck?
- What would you monitor/alert on?

**Example Deep Dive — Twitter Timeline Generation:**

```
Approach 1: Fan-out on Write (Push)
  When user posts tweet → push to all followers' timelines

  ┌────────┐    ┌────────┐    ┌──────────────┐
  │ User A │───▶│ Tweet  │───▶│ Message Queue │
  │ posts  │    │ DB     │    └──────┬───────┘
  └────────┘    └────────┘           │
                                     ▼
                              ┌──────────────┐
                              │  Fan-out     │
                              │  Workers     │
                              └──────┬───────┘
                                     │
                    ┌────────────────┬┴───────────────┐
                    ▼                ▼                 ▼
              ┌──────────┐   ┌──────────┐      ┌──────────┐
              │Follower 1│   │Follower 2│ ...  │Follower N│
              │ Timeline │   │ Timeline │      │ Timeline │
              │  Cache   │   │  Cache   │      │  Cache   │
              └──────────┘   └──────────┘      └──────────┘

  Pros: Timeline reads are instant (pre-computed)
  Cons: Celebrity with 50M followers = 50M writes per tweet

Approach 2: Fan-out on Read (Pull)
  When user loads timeline → fetch tweets from all followed users

  Pros: Writes are simple (just store the tweet)
  Cons: Timeline reads are slow (join across many users)

Approach 3: Hybrid (what Twitter actually does)
  - Regular users: fan-out on write
  - Celebrities (>10K followers): fan-out on read
  - Timeline = cached pre-computed feed + merge celebrity tweets on read
```

---

## Step 5: Trade-offs and Bottlenecks (5 minutes)

No design is perfect. Show you know what could break.

**Discuss:**

- Single points of failure — what has no redundancy?
- Bottlenecks — where will you hit limits first?
- Trade-offs you made — what did you sacrifice and why?
- Future improvements — what would you add with more time?
- Cost considerations — is this design expensive? Where?
- Operational complexity — is this hard to operate? Debug?

**Questions to ask yourself:**

- What happens if [component X] goes down?
- What happens at 10x the traffic?
- What's the most expensive part of this system?
- What would a junior engineer struggle to debug here?
- Are there any data consistency issues?
- What monitoring would you set up on day one?

**Example — Twitter Trade-offs:**
```
Made these trade-offs:
  1. Eventual consistency for timelines (acceptable — users won't
     notice a 5-second delay in timeline updates)
  2. Hybrid fan-out adds complexity but handles celebrity problem
  3. Separate media storage adds a service but keeps tweet DB lean

Bottlenecks:
  1. Fan-out for users with millions of followers
  2. Cache invalidation when tweets are deleted
  3. Timeline cache size for very active users

Future improvements:
  1. ML-based timeline ranking (not just chronological)
  2. Real-time streaming for breaking news
  3. Multi-region deployment for global latency
```

---

## Blank Template — Copy and Use

```
================================================================
SYSTEM DESIGN: [Problem Name]
================================================================

STEP 1: REQUIREMENTS
─────────────────────

Functional Requirements:
  1.
  2.
  3.
  4.
  5.

Non-Functional Requirements:
  - DAU/MAU:
  - Read:Write ratio:
  - Latency target (p99):
  - Availability target:
  - Consistency model:
  - Data retention:
  - Geographic scope:

Out of Scope:
  -
  -

================================================================

STEP 2: ESTIMATION
──────────────────

Users:
  - DAU:
  - Actions per user per day:

QPS:
  - Average:         DAU × actions / 100,000 =
  - Peak (5x):
  - Read QPS:
  - Write QPS:

Storage:
  - Object size:
  - New objects per day:
  - Daily storage:
  - Yearly storage:
  - 5-year storage (with 3x replication):

Bandwidth:
  - Ingress (write):    Write QPS × avg size =
  - Egress (read):      Read QPS × avg size =

Cache:
  - Hot data size:
  - 20% cache:

Servers:
  - QPS per server:
  - Servers needed:     Peak QPS / QPS per server =
  - With redundancy:

================================================================

STEP 3: HIGH-LEVEL DESIGN
──────────────────────────

[Draw your architecture here]

Components:
  -
  -
  -
  -

Data flow:
  Write path:
    1.
    2.
    3.

  Read path:
    1.
    2.
    3.

Database choices:
  -
  -

================================================================

STEP 4: DEEP DIVE
──────────────────

Component 1: [Name]
  Data model:

  API:

  Scaling:

  Failure mode:


Component 2: [Name]
  Data model:

  API:

  Scaling:

  Failure mode:


Component 3: [Name]
  Data model:

  API:

  Scaling:

  Failure mode:

================================================================

STEP 5: TRADE-OFFS & BOTTLENECKS
─────────────────────────────────

Trade-offs made:
  1.
  2.
  3.

Bottlenecks:
  1.
  2.

Single points of failure:
  1.
  2.

Monitoring/Alerts:
  1.
  2.

Future improvements:
  1.
  2.
  3.

================================================================
```

---

## Common Mistakes to Avoid

### 1. Jumping Straight to the Solution
Bad: "We'll use Kafka and Redis and shard the database..."
Good: "First, let me understand the requirements..."

### 2. Over-Engineering
Bad: Designing for 1B users when the problem says 10K
Good: Design for the stated scale, mention how you'd evolve

### 3. Ignoring the Numbers
Bad: "We'll cache everything in memory"
Good: "Our hot data is ~500GB, so we need ~5 Redis nodes with 128GB each"

### 4. Not Discussing Trade-offs
Bad: "This is the optimal design"
Good: "I chose X over Y because of Z, but we sacrifice W"

### 5. Going Too Deep Too Early
Bad: Spending 20 minutes on the database schema before drawing the architecture
Good: Get the big picture first, then zoom in

---

## Connecting to Your Experience

If you're a Go engineer, you already think about systems — goroutines, channels,
and interfaces are system design concepts at the code level. Zoom out:

- A goroutine sending on a channel → a service publishing to a message queue
- An interface decoupling packages → an API contract between services
- A sync.Mutex protecting shared state → a distributed lock (Redis, Zookeeper)
- A buffered channel → a rate limiter or work queue

If you're a TypeScript engineer, you know about event-driven patterns:

- EventEmitter → Pub/Sub systems (Kafka, SNS/SQS)
- Promises and async/await → async processing with message queues
- Middleware in Express → API gateway and cross-cutting concerns
- npm packages → microservices (each package is a deployable unit)

System design is just your existing mental models applied at a bigger scale.

---

## Practice Problem List

Start with these. Use the template above for each one.

| # | Problem | Key Challenges |
|---|---|---|
| 1 | URL Shortener | Hashing, redirect speed, analytics |
| 2 | Paste Bin | Storage, expiration, rate limiting |
| 3 | Rate Limiter | Distributed counting, sliding window |
| 4 | Key-Value Store | Partitioning, replication, consistency |
| 5 | Twitter/Feed | Fan-out, timeline, caching |
| 6 | Instagram | Photo storage, feed ranking |
| 7 | Chat System | Real-time delivery, presence, history |
| 8 | YouTube | Video storage, transcoding, streaming |
| 9 | Google Drive | File sync, conflict resolution, chunking |
| 10 | Search Engine | Indexing, ranking, crawling |
| 11 | Notification System | Delivery, templating, preferences |
| 12 | Uber/Lyft | Geospatial matching, real-time tracking |
