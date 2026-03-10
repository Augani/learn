# Back-of-Envelope Estimation

A contractor doesn't measure every nail before quoting a job. They look at the
house, check the blueprints, and say "that's about a $50K job." Their estimate
might be off by 10-20%, but it's close enough to decide if the project is
feasible, how many workers to hire, and how long it'll take.

Back-of-envelope estimation is the same skill for engineers. You're not trying
to get an exact number. You're trying to figure out the order of magnitude:
is this a 1-server problem or a 1,000-server problem? Do we need 10 GB of
storage or 10 PB?

Getting within 10x of the real answer is usually good enough to make the right
architectural decisions.

---

## Powers of 2 — Your Foundation

Everything in computing comes back to powers of 2. Memorize this table the way
a carpenter knows standard lumber sizes.

| Power | Value | Approx | Name | Analogy |
|---|---|---|---|---|
| 2^10 | 1,024 | ~1 Thousand | 1 KB | A paragraph of text |
| 2^20 | 1,048,576 | ~1 Million | 1 MB | A high-res photo |
| 2^30 | ~1.07 Billion | ~1 Billion | 1 GB | A movie |
| 2^40 | ~1.1 Trillion | ~1 Trillion | 1 TB | A library |
| 2^50 | ~1.1 Quadrillion | ~1 Quadrillion | 1 PB | A warehouse of libraries |

### The Quick Trick

Each jump of 10 powers = multiply by ~1,000. So:

```
1 KB × 1,000 = 1 MB
1 MB × 1,000 = 1 GB
1 GB × 1,000 = 1 TB
1 TB × 1,000 = 1 PB
```

When someone says "we store 500 million rows at 1 KB each," your brain should
instantly go:

```
500 million × 1 KB = 500 × 10^6 × 10^3 bytes = 500 × 10^9 bytes = 500 GB
```

That's a single-disk problem. Not scary at all.

---

## The Core Formulas

You need exactly four formulas for 90% of estimation problems.

### Formula 1: QPS from DAU

```
Average QPS = (DAU × actions_per_user) / seconds_per_day

seconds_per_day = 86,400 ≈ 100,000 (10^5)

Simplified: QPS ≈ DAU × actions / 100,000
```

### Formula 2: Peak QPS

```
Peak QPS = Average QPS × peak_multiplier

Typical peak multiplier: 2x to 5x (use 3x if unsure)
Flash sale / viral event: 10x to 100x
```

### Formula 3: Storage

```
Daily storage = new_objects_per_day × avg_object_size

Monthly storage = daily × 30
Yearly storage = daily × 365

Total storage = yearly × years × replication_factor
```

### Formula 4: Bandwidth

```
Bandwidth = QPS × avg_response_size

Convert to bits: multiply bytes by 8
1 MB/s = 8 Mbps
```

---

## The 80/20 Rule for Traffic

Most systems follow the Pareto principle: 80% of traffic hits 20% of the data.

This has massive implications:

```
Total data: 100 GB
Hot data (20%): 20 GB ← This is what you need to cache
Cold data (80%): 80 GB ← This can stay on disk

If you cache the hot 20%, you handle 80% of requests from cache.
Cache hit rate: ~80% with just 20% of data in memory.
```

In practice, it's often even more extreme. For social media, 1% of content
(viral posts) might serve 50%+ of reads.

### Traffic Distribution Through the Day

Traffic isn't uniform. The 80/20 rule applies to time too:

```
                    Peak hours (20% of the day)
                    handle 80% of traffic
                          │
                          ▼
Requests  ████
per       ████ ████
second    ████ ████ ████
          ████ ████ ████ ████
          ████ ████ ████ ████ ████
          ████ ████ ████ ████ ████ ████
     ─────┴────┴────┴────┴────┴────┴────── Time
     12am  4am  8am  12pm  4pm  8pm  12am
```

This is why peak QPS matters more than average QPS. Your system must handle the
peak without falling over.

---

## Read-to-Write Ratios

Most applications are read-heavy. This fundamentally shapes your architecture.

| Application Type | Read:Write Ratio | Implications |
|---|---|---|
| Social media feed | 100:1 | Cache aggressively, read replicas |
| E-commerce product page | 100:1 | CDN + cache, reads are simple lookups |
| Chat / messaging | 1:1 to 5:1 | Need write-optimized storage |
| Analytics / logging | 1:100 (write-heavy!) | Append-only storage, batch writes |
| Wiki / documentation | 50:1 | Aggressive caching, occasional writes |
| Banking | 1:1 | Strong consistency, can't cache much |
| Search engine | 1000:1 | Index once, serve many times |

**Why this matters:**

If your app is 100:1 read-heavy, optimizing writes matters much less than
optimizing reads. Put a cache in front of your database and you've solved 99%
of your performance problems.

If your app is write-heavy (like logging), you need a fundamentally different
approach: append-only logs, write-ahead logs, batch inserts, time-series
databases.

**In Go:** For a read-heavy service, you might use a `sync.RWMutex` so multiple
goroutines can read concurrently. For write-heavy, you'd use channels to batch
writes.

**In TypeScript:** For read-heavy APIs, you'd put Redis in front of your
database. For write-heavy, you'd use a message queue to buffer writes and
process them in batches.

---

## Worked Example 1: Estimate Storage for Twitter

**Given:**
- 500 million tweets per day
- Average tweet: 280 characters (UTF-8, so ~280 bytes text)
- Each tweet has metadata: user ID, timestamp, geo, reply info → ~500 bytes
- Total tweet size: ~1 KB (text + metadata)
- 20% of tweets have images (average 2 MB each)
- 5% of tweets have video (average 10 MB each)

**Step 1: Text storage per day**

```
500M tweets × 1 KB = 500 GB/day
```

That's it. 500 GB per day for all tweet text and metadata. A single modern
server has 1-2 TB of SSD. Tweet text is not the storage problem.

**Step 2: Image storage per day**

```
20% of 500M = 100M tweets with images
100M × 2 MB = 200 TB/day
```

Now we're talking. 200 TB per day for images.

**Step 3: Video storage per day**

```
5% of 500M = 25M tweets with video
25M × 10 MB = 250 TB/day
```

250 TB per day for video.

**Step 4: Total daily storage**

```
Text:   500 GB   ← barely registers
Image:  200 TB   ← the real cost
Video:  250 TB   ← the real real cost
────────────────
Total:  ~450 TB/day
```

**Step 5: Annual storage (with 3x replication)**

```
450 TB/day × 365 days = ~164 PB/year
With 3x replication: ~492 PB/year ≈ 500 PB/year
```

**Step 6: Cost estimate**

```
500 PB on S3 Standard: 500,000 TB × $23/TB/month = $11.5M/month
500 PB on S3 Glacier:  500,000 TB × $4/TB/month  = $2M/month

Strategy: keep recent data on Standard, archive old data to Glacier
Maybe 30 days on Standard, rest on Glacier:
  30 days: 450 TB × 30 × 3 = ~40 PB × $23 = ~$920K/month
  Rest on Glacier: ~460 PB × $4 = ~$1.8M/month
  Total: ~$2.7M/month for storage
```

**Key insight:** The text data (what people think of as "tweets") is nothing.
Media dominates everything. This is why Twitter invested heavily in media
infrastructure and CDNs.

---

## Worked Example 2: Estimate Bandwidth for YouTube

**Given:**
- 1 billion video views per day
- Average video quality: 720p
- Average video length: 5 minutes
- Average bitrate at 720p: ~2.5 Mbps
- Average video file size: 5 minutes × 2.5 Mbps = ~95 MB ≈ 100 MB

Wait, let's reconsider. The problem said "avg 5MB video" — but that seems low.
Let's use a more realistic estimate and then show both.

**Scenario A: 5 MB average (compressed, shorter clips)**

```
1B views × 5 MB = 5,000 PB/day = 5 EB/day (exabytes!)

Per second: 5 EB / 86,400 = ~58 PB/s ... that's absurd.
```

Hmm, that's way too high. Users don't download full videos — they stream, and
many don't finish. Let's adjust.

**Scenario B: More realistic estimate**

```
Assumptions:
- 1B views/day
- Average bytes actually streamed per view: ~50 MB
  (some watch 10 seconds, some watch 30 minutes)
- CDN cache hit rate: ~95% (popular videos)

Total egress from origin: 1B × 50 MB × 5% (cache miss) = 2.5 PB/day from origin
Total egress from CDN: 1B × 50 MB × 95% = 47.5 PB/day from CDN edge

Origin bandwidth: 2.5 PB / 86,400 = ~29 GB/s = ~232 Gbps
CDN bandwidth: 47.5 PB / 86,400 = ~550 GB/s = ~4.4 Tbps

Peak (3x average): ~13 Tbps from CDN
```

That's why YouTube has CDN servers in almost every major ISP worldwide.

**Step-by-step estimation approach:**

```
Start with knowns:
  1B views/day ✓

Estimate unknowns:
  Avg bytes per view → 50 MB (educated guess)

Calculate raw:
  1B × 50 MB = 50 PB/day total bandwidth

Apply reality factors:
  CDN absorbs 95% → only 5% hits origin
  Origin: 2.5 PB/day
  CDN: 47.5 PB/day

Convert to bandwidth:
  Origin: 2.5 PB / 100K seconds = 25 GB/s ≈ 200 Gbps
  Peak: 200 Gbps × 3 = 600 Gbps origin bandwidth needed
```

**Key insight:** The CDN is not optional for a video platform. Without it,
you'd need 4+ Tbps of bandwidth from a single data center — that's physically
impractical.

---

## The Estimation Process — Step by Step

Here's the process you should follow for any estimation problem:

```
┌────────────────────────────────────────────────────────────┐
│                 ESTIMATION PROCESS                         │
│                                                            │
│  1. IDENTIFY what you need to estimate                     │
│     (storage? bandwidth? QPS? servers?)                    │
│                                                            │
│  2. LIST your assumptions                                  │
│     State them clearly. Round aggressively.                │
│                                                            │
│  3. COMPUTE with simple math                               │
│     Use powers of 10. Multiplication only.                 │
│     500M × 1KB = 500M × 10^3 = 5 × 10^11 = 500 GB       │
│                                                            │
│  4. REALITY CHECK                                          │
│     Does the answer make sense?                            │
│     Is it within known bounds?                             │
│     Compare to known systems.                              │
│                                                            │
│  5. APPLY safety margins                                   │
│     Storage: 3x for replication                            │
│     Compute: 2x for headroom                               │
│     Bandwidth: peak, not average                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Rounding Rules

The key to fast estimation is aggressive rounding:

| Actual | Round To | Close Enough? |
|---|---|---|
| 86,400 seconds/day | 100,000 (10^5) | Within 15% — yes |
| 2,592,000 seconds/month | 2.5 × 10^6 | Within 3% — yes |
| 31,536,000 seconds/year | 3 × 10^7 | Within 5% — yes |
| 365 days/year | 400 | Within 10% — yes |
| 1,024 bytes per KB | 1,000 | Within 2.4% — yes |

In estimation, being within 2x of the real answer is excellent. Within 10x is
acceptable. You're determining order of magnitude, not exact figures.

---

## QPS Estimation — Deeper Dive

### From Users to QPS

```
                    ┌──────────┐
                    │   MAU    │  Monthly Active Users
                    │  100M    │
                    └────┬─────┘
                         │ × 0.5 (50% daily active)
                         ▼
                    ┌──────────┐
                    │   DAU    │  Daily Active Users
                    │   50M    │
                    └────┬─────┘
                         │ × 10 (actions per user per day)
                         ▼
                    ┌──────────┐
                    │  Daily   │
                    │ Actions  │  500M actions/day
                    │          │
                    └────┬─────┘
                         │ ÷ 100,000 (seconds in a day)
                         ▼
                    ┌──────────┐
                    │   QPS    │  5,000 QPS average
                    │          │
                    └────┬─────┘
                         │ × 3-5 (peak multiplier)
                         ▼
                    ┌──────────┐
                    │  Peak    │  15,000-25,000 QPS
                    │  QPS     │
                    └──────────┘
```

### Actions Per User — Estimates by App Type

| App Type | Typical Actions/User/Day | What Counts as an "Action" |
|---|---|---|
| Social media (browsing) | 20-50 | Feed loads, profile views, likes |
| Social media (posting) | 1-3 | Creating posts, comments |
| E-commerce (browsing) | 10-30 | Product views, searches, filter |
| E-commerce (purchasing) | 0.01-0.1 | Add to cart, checkout |
| Messaging | 50-200 | Send message, read message, typing indicator |
| SaaS tool | 20-100 | Page loads, API calls, saves |
| News/Content site | 5-15 | Article views, scroll, share |

### Worked Example: SaaS Dashboard

```
Given: 500K paying users, typical SaaS tool

Step 1: DAU
  500K users × 40% daily active = 200K DAU
  (SaaS apps typically have 30-50% DAU/MAU ratio)

Step 2: Actions
  200K DAU × 50 actions/user = 10M actions/day

Step 3: QPS
  10M / 100K = 100 QPS average

Step 4: Peak
  100 × 5 = 500 QPS peak
  (SaaS peaks during business hours, so 3-5x is reasonable)

Step 5: Read vs Write
  Typical SaaS: 10:1 read:write
  Read QPS: 450 peak
  Write QPS: 50 peak

Conclusion: A single Go or Node.js server handles this easily.
            You need 2-3 for redundancy, not performance.
```

---

## Storage Growth Estimation

Storage is one of the most important things to estimate because it drives
database choices, infrastructure costs, and backup strategies.

### The Growth Formula

```
Year N storage = Year 1 daily × 365 × N × replication × overhead

Where:
  replication = 3 (typical for databases)
  overhead = 1.5-2x (indexes, metadata, tombstones, fragmentation)
```

### Worked Example: Chat Application

```
Given:
  - 10M DAU
  - Average 40 messages sent per user per day
  - Average message size: 500 bytes (text + metadata)
  - 10% of messages include images: average 200 KB

Step 1: Messages per day
  10M × 40 = 400M messages/day

Step 2: Text storage per day
  400M × 500 bytes = 200 GB/day

Step 3: Image storage per day
  400M × 10% = 40M images
  40M × 200 KB = 8 TB/day

Step 4: Total daily
  Text: 200 GB
  Images: 8 TB
  Total: ~8.2 TB/day

Step 5: Yearly (with replication and overhead)
  8.2 TB × 365 = ~3 PB/year raw
  × 3 (replication) = ~9 PB/year
  × 1.5 (overhead) = ~13.5 PB/year

Step 6: 5-year projection
  Year 1: ~14 PB
  Year 2: ~28 PB (cumulative)
  Year 3: ~42 PB
  Year 4: ~56 PB
  Year 5: ~70 PB (assuming no growth in users)

  With 20% YoY user growth:
  Year 1: 14 PB
  Year 2: 14 + 17 = 31 PB
  Year 3: 31 + 20 = 51 PB
  Year 4: 51 + 24 = 75 PB
  Year 5: 75 + 29 = 104 PB
```

That's over 100 PB in 5 years. You need a solid data lifecycle strategy:
archive old messages, compress, tier storage.

---

## Bandwidth Estimation

### The Formula

```
Bandwidth = QPS × average_response_size

For reads (egress):  Read QPS × avg read response size
For writes (ingress): Write QPS × avg write payload size
```

### Worked Example: Photo Sharing API

```
Given:
  - 50M DAU
  - 5 photo uploads per day per user (average)
  - Average photo: 3 MB (original) → 500 KB (optimized for web)
  - 20 feed loads per day per user
  - Average feed: 10 photos × 200 KB thumbnail = 2 MB

Upload bandwidth (ingress):
  50M × 5 photos / 100K seconds = 2,500 uploads/sec
  2,500 × 3 MB = 7.5 GB/s ingress
  Peak (3x): 22.5 GB/s = 180 Gbps

Feed bandwidth (egress):
  50M × 20 loads / 100K seconds = 10,000 feed loads/sec
  10,000 × 2 MB = 20 GB/s egress
  Peak (3x): 60 GB/s = 480 Gbps

  With CDN (95% cache hit):
  Origin egress: 60 × 5% = 3 GB/s = 24 Gbps
  CDN egress: 60 × 95% = 57 GB/s = 456 Gbps
```

**Key takeaway:** Even with the CDN handling 95% of egress, the origin still
needs 24 Gbps. That's at least 3x 10Gbps network links at peak.

---

## Server Count Estimation

### How Many Machines?

```
Servers needed = Peak QPS / QPS per server

QPS per server depends on:
  - Language/runtime (Go > Node.js > Python for raw QPS)
  - Request complexity (simple read vs complex computation)
  - I/O pattern (cached reads vs database queries)
  - Response size (1 KB vs 1 MB)
```

### QPS Per Server — Rules of Thumb

| Scenario | QPS per Server | Why |
|---|---|---|
| Simple cached read (Go) | 50,000-100,000 | CPU-bound, minimal I/O |
| Simple cached read (Node.js) | 10,000-30,000 | Single-threaded, event loop |
| Database read (Go, indexed) | 5,000-20,000 | I/O bound, DB is bottleneck |
| Database read (Node.js, indexed) | 2,000-10,000 | Same I/O bound + single thread |
| Complex computation (any) | 100-1,000 | CPU-heavy work per request |
| File upload processing | 100-500 | Large payload, disk I/O |

### Worked Example: API Service

```
Given:
  - 10M DAU
  - 30 API calls per user per day
  - Read:write = 10:1
  - 90% of reads hit cache
  - Go service

Step 1: QPS
  Average: 10M × 30 / 100K = 3,000 QPS
  Peak: 3,000 × 3 = 9,000 QPS

Step 2: Read vs Write
  Read: 9,000 × (10/11) ≈ 8,200 read QPS peak
  Write: 9,000 × (1/11) ≈ 800 write QPS peak

Step 3: Cache breakdown
  Cached reads: 8,200 × 90% = 7,380 QPS (served from Redis)
  DB reads: 8,200 × 10% = 820 QPS (hit database)
  DB writes: 800 QPS

Step 4: Server count
  App servers (handling 9,000 QPS, mostly cached):
    Go server handles ~50,000 cached reads → need 1 server
    But add redundancy → 3 servers

  Database (handling 820 reads + 800 writes):
    PostgreSQL handles ~5,000 simple queries/sec → 1 primary is fine
    Add 2 read replicas for redundancy

  Redis (handling 7,380 QPS):
    Single Redis handles 100,000+ QPS → 1 node
    Add replica for redundancy → 2 nodes

Total: 3 app servers + 1 DB primary + 2 DB replicas + 2 Redis nodes = 8 machines
```

8 machines. For 10 million daily active users. That's the power of good
architecture and estimation.

---

## Memory Estimation for Caching

### How Much RAM for Your Cache?

```
Cache size = hot_data_size × cache_overhead

hot_data_size = total_daily_requests × avg_response_size × (1 / read_ratio)

Or simpler: cache the 20% most-accessed data (80/20 rule)
```

### Worked Example: E-Commerce Product Cache

```
Given:
  - 1M products in catalog
  - Average product data: 5 KB (name, price, description, image URLs)
  - Top 20% of products get 80% of views

Step 1: Total catalog in memory
  1M × 5 KB = 5 GB

Step 2: Hot products (20%)
  200K × 5 KB = 1 GB

Step 3: With overhead (hash table, pointers, etc.)
  1 GB × 1.5 = 1.5 GB

Conclusion: A single Redis node with 4-8 GB RAM handles this comfortably.
```

Now compare that to the alternative — hitting the database for every product
view. At 10,000 product views per second, that's 10,000 DB queries/sec.
With a 95% cache hit rate on 1.5 GB of cache, you only send 500 queries/sec
to the database.

---

## Quick Estimation Reference Card

```
┌──────────────────────────────────────────────────────────────┐
│              ESTIMATION CHEAT SHEET                          │
│                                                              │
│  USERS → QPS                                                 │
│  QPS = DAU × actions / 100,000                               │
│  Peak = Average × 3-5                                        │
│                                                              │
│  STORAGE                                                     │
│  Daily = objects/day × size                                  │
│  Yearly = Daily × 365                                        │
│  Total = Yearly × years × 3 (replication) × 1.5 (overhead)  │
│                                                              │
│  BANDWIDTH                                                   │
│  BW = QPS × response_size                                    │
│  1 MB/s = 8 Mbps                                             │
│                                                              │
│  CACHE                                                       │
│  Size = 20% of hot data                                      │
│  Handles 80% of reads                                        │
│                                                              │
│  SERVERS                                                     │
│  Count = Peak QPS / QPS_per_server                           │
│  Add 2-3x for redundancy                                     │
│                                                              │
│  QUICK NUMBERS                                               │
│  1 char = 1 byte (ASCII) or 1-4 bytes (UTF-8)               │
│  1 integer = 4-8 bytes                                       │
│  1 UUID = 16 bytes (binary) or 36 bytes (string)             │
│  1 timestamp = 8 bytes                                       │
│  1 IP address = 4 bytes (IPv4) or 16 bytes (IPv6)            │
│                                                              │
│  ROUNDING                                                    │
│  86,400 → 100,000                                            │
│  365 → 400                                                   │
│  1,024 → 1,000                                               │
│  2,592,000 → 2,500,000                                       │
│                                                              │
│  SANITY CHECKS                                               │
│  A single modern server: 10K-100K simple QPS                 │
│  A single PostgreSQL: 5K-20K simple queries/sec              │
│  A single Redis: 100K+ operations/sec                        │
│  1 Gbps network: 125 MB/s                                    │
│  1 SSD: 3 GB/s sequential read (NVMe)                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Practice Problems

Try these on your own before checking the solutions.

### Problem 1: Estimate Storage for Instagram Stories

- 500M DAU
- 30% post at least one story per day (150M stories/day)
- Average story: 15-second video clip = ~5 MB
- Stories expire after 24 hours (but highlights persist)
- How much storage do you need?

<details>
<summary>Solution</summary>

```
Daily new stories: 150M × 5 MB = 750 TB/day

Active storage (last 24 hours only):
  750 TB (just today's stories are "live")

But you need to keep them for replay/highlights:
  Assume 10% get saved to highlights
  Daily persistent: 75 TB
  Yearly: 75 TB × 365 = ~27 PB
  With 3x replication: ~81 PB/year

For serving (CDN):
  750 TB of content, accessed for only 24 hours
  This is a CDN problem, not a storage problem
  CDN should cache all of today's stories
```

</details>

### Problem 2: Estimate QPS for a Ride-Sharing App

- 20M DAU
- Average 2 rides per day per active user
- Each ride involves: search (1), price quote (3), booking (1), GPS updates (60/min × 15 min = 900)
- How much QPS do you need?

<details>
<summary>Solution</summary>

```
Per ride: 1 + 3 + 1 + 900 = 905 actions
  (GPS updates dominate everything!)

Total actions/day: 20M × 2 rides × 905 = 36.2B actions/day

But not all 20M users ride simultaneously.
Peak concurrent riders: maybe 5% at any moment = 1M riders

Peak QPS from GPS alone: 1M × (1 update/sec) = 1M QPS
  (GPS updates once per second per active ride)

Peak QPS from other actions: negligible compared to GPS

Total peak QPS: ~1M QPS

This is why ride-sharing backends need massive infrastructure
for location tracking, even with relatively few users.

At ~50K QPS per Go server: need ~20 location servers
```

</details>

### Problem 3: Bandwidth for a Video Conferencing App

- 10M concurrent users during peak
- Average 3 participants per call
- Video: 1.5 Mbps per stream (720p)
- Audio: 64 Kbps per stream
- Each participant sends 1 stream and receives (N-1) streams

<details>
<summary>Solution</summary>

```
Calls: 10M users / 3 per call = 3.3M concurrent calls

Per user uploads: 1 video (1.5 Mbps) + 1 audio (64 Kbps) = ~1.6 Mbps
Per user downloads: 2 video + 2 audio = ~3.2 Mbps
Per user total: ~4.8 Mbps

Total bandwidth: 10M × 4.8 Mbps = 48 Tbps

With SFU (Selective Forwarding Unit) architecture:
  Ingress: 10M × 1.6 Mbps = 16 Tbps
  Egress: 10M × 3.2 Mbps = 32 Tbps
  Total: 48 Tbps through servers

That's massive. This is why Zoom has data centers worldwide
and uses adaptive bitrate to reduce quality when bandwidth is tight.

Server count (assuming 10Gbps per server):
  48 Tbps / 10 Gbps = 4,800 media relay servers
```

</details>

---

## Common Estimation Mistakes

### 1. Forgetting Replication
Raw storage × 3 (at minimum) for replicated databases. Sometimes × 5 with
indexes and overhead.

### 2. Using Average Instead of Peak
Your system doesn't crash at average load. It crashes at peak. Always size for
peak with headroom.

### 3. Ignoring Metadata
A 1 KB tweet needs more than 1 KB of storage. Add indexes, foreign keys,
timestamps, and database overhead. Typically 2-3x the raw data size.

### 4. Confusing Bits and Bytes
Network speeds are in bits (Gbps). Storage is in bytes (GB). There are 8 bits
in a byte. Getting this wrong means your estimate is off by 8x.

### 5. Not Accounting for Growth
A system designed for today's load with no headroom fails in 6 months. Plan for
at least 2x growth per year, more for fast-growing products.

### 6. Precision Overkill
Don't spend 5 minutes calculating that you need exactly 37.4 servers. Round to
40. The point is knowing you need dozens, not hundreds.

---

## The Contractor's Mindset

Come back to the analogy. A good contractor can walk into a house and say:

- "That's a load-bearing wall" (critical path)
- "This kitchen needs about 200 amps" (capacity planning)
- "Budget $50K for the renovation" (cost estimation)
- "It'll take about 3 months" (timeline)

They can do this because they've done it hundreds of times and they know the
reference numbers — lumber costs, labor rates, time per task.

You're building the same intuition for digital systems. After enough practice,
you'll hear "10 million daily users" and immediately know:

- That's about 1,000-10,000 QPS depending on the app
- You need 3-10 servers, not 100
- You need caching, probably Redis
- A CDN is probably necessary
- A single PostgreSQL primary with read replicas works
- Total infrastructure cost: roughly $5,000-$20,000/month

That intuition is worth more than any memorized algorithm. Build it through
practice.
