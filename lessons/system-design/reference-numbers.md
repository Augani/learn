# Numbers Every Engineer Should Know

Think of these numbers like a contractor knows lumber prices or a chef knows cooking
times. You don't memorize them to the nanosecond — you internalize the *order of
magnitude* so you can reason about systems without running benchmarks every time.

These numbers are your "gut feeling" for system design. When someone proposes a design,
you should be able to smell whether it's fast or slow before writing a single line of code.

---

## Latency Numbers

Imagine your CPU is a person sitting at a desk. Here's how long it takes to get
information from different places:

| Operation | Latency | Analogy |
|---|---|---|
| L1 cache reference | ~1 ns | Grabbing a pen from your desk |
| L2 cache reference | ~4 ns | Opening your desk drawer |
| L3 cache reference | ~10 ns | Standing up and reaching the filing cabinet next to you |
| RAM access | ~100 ns | Walking to the bookshelf across the room |
| SSD random read | ~16 μs | Driving to the library across town |
| HDD seek | ~2-10 ms | Flying to another city to get a book |
| Same datacenter round-trip | ~0.5 ms | Calling your coworker in the next building |
| DNS lookup | ~1-10 ms | Looking up someone's phone number in a directory |
| TCP handshake | ~1-3 ms (same DC) | "Hey, are you there?" "Yes." "Great, let's talk." |
| TLS handshake | ~5-15 ms (same DC) | TCP handshake + exchanging secret decoder rings |
| Cross-country round-trip (US) | ~30-70 ms | Sending a letter coast to coast by express courier |
| Cross-continent round-trip | ~100-200 ms | Sending that letter overseas |
| Cross-Pacific round-trip | ~150-300 ms | Sending that letter to the other side of the world |

### Latency Comparison — Visual Scale

If L1 cache access = 1 second (grabbing a pen):

```
L1 cache        |                                              1 second
L2 cache        |                                              4 seconds
L3 cache        |                                              10 seconds
RAM             |                                              1.5 minutes
SSD random read |                                              4.5 hours
HDD seek        |                                              3-12 days
Same DC network |                                              6 hours
Cross-country   |                                              1-2 years
Cross-continent |                                              3-6 years
```

That's not a typo. If an L1 cache hit is 1 second, a cross-continent round trip
is *years*. This is why caching matters so much and why data locality is everything.

---

## Throughput Numbers

How much data can you push through different pipes:

| Medium | Sequential Throughput | Analogy |
|---|---|---|
| SSD sequential read | ~500 MB/s - 3 GB/s (NVMe) | Firehose |
| SSD sequential write | ~400 MB/s - 2 GB/s (NVMe) | Slightly smaller firehose |
| HDD sequential read | ~100-200 MB/s | Garden hose |
| HDD sequential write | ~80-150 MB/s | Slightly kinked garden hose |
| 1 Gbps network | ~125 MB/s | Kitchen faucet |
| 10 Gbps network | ~1.25 GB/s | Fire hydrant |
| 100 Gbps network | ~12.5 GB/s | River |
| Memory bandwidth (DDR4) | ~25-50 GB/s | Niagara Falls |
| PCIe 4.0 x16 | ~32 GB/s | Also Niagara Falls |

### Key Insight: Random vs Sequential

```
SSD Sequential Read:  ████████████████████████████████  3,000 MB/s
SSD Random Read:      ██                                  200 MB/s

HDD Sequential Read:  ██████                              200 MB/s
HDD Random Read:      (barely visible)                      1 MB/s
```

This is why databases optimize for sequential access patterns. Random I/O kills
performance, especially on spinning disks. SSDs are much better at random access
but sequential is still 10-15x faster.

If you're coming from Go or TypeScript, think about it this way: iterating through
a slice/array sequentially is always faster than jumping around a linked list,
because the CPU prefetcher can predict sequential access and load data into cache
before you need it.

---

## Storage Estimates

### Powers of 2 — Your Best Friends

| Power | Exact | Approx | Name |
|---|---|---|---|
| 2^10 | 1,024 | ~1 Thousand | 1 KB (Kilobyte) |
| 2^20 | 1,048,576 | ~1 Million | 1 MB (Megabyte) |
| 2^30 | 1,073,741,824 | ~1 Billion | 1 GB (Gigabyte) |
| 2^40 | ~1.1 Trillion | ~1 Trillion | 1 TB (Terabyte) |
| 2^50 | ~1.1 Quadrillion | ~1 Quadrillion | 1 PB (Petabyte) |

### How Much Is That in Real Life?

| Amount | What It Holds | Physical Analogy |
|---|---|---|
| 1 KB | A short email, a few paragraphs of text | A post-it note |
| 1 MB | A high-res photo, a minute of MP3 audio | A thick paperback book |
| 1 GB | A movie (compressed), ~1000 high-res photos | A small bookshelf |
| 1 TB | ~250,000 photos, ~500 hours of video | A whole library branch |
| 1 PB | ~1,000 TBs, all the X-rays in a large hospital chain | A warehouse of libraries |
| 1 EB | ~1,000 PBs, roughly all words ever spoken by humans | An unimaginable amount |

### Storage Cost (Approximate, 2024)

| Medium | Cost per TB | Use Case |
|---|---|---|
| RAM (DDR4) | ~$3,000-5,000 | Hot data, caches |
| NVMe SSD | ~$50-80 | Databases, active data |
| SATA SSD | ~$30-50 | General purpose storage |
| HDD | ~$15-25 | Cold storage, archives |
| S3 Standard | ~$23/month | Cloud object storage |
| S3 Glacier | ~$4/month | Long-term archives |

---

## QPS Estimates — From Users to Requests

This is the bread and butter of back-of-envelope calculations.

### The Core Formula

```
Average QPS = (DAU × actions_per_user_per_day) / 86,400

Peak QPS = Average QPS × peak_multiplier (typically 2x-10x)
```

86,400 = seconds in a day (round to ~100,000 for napkin math)

### Quick Reference Table

| DAU | Actions/User/Day | Avg QPS | Peak QPS (5x) |
|---|---|---|---|
| 100K | 10 | ~12 | ~60 |
| 500K | 10 | ~58 | ~290 |
| 1M | 10 | ~116 | ~580 |
| 5M | 10 | ~580 | ~2,900 |
| 10M | 10 | ~1,160 | ~5,800 |
| 50M | 10 | ~5,800 | ~29,000 |
| 100M | 10 | ~11,600 | ~58,000 |
| 1B | 10 | ~116,000 | ~580,000 |

### The 1M DAU Rule of Thumb

```
1M DAU with 1 action per user per day ≈ 12 QPS average

That's it. That's the number to memorize.

Then scale linearly:
  - 10 actions/user → ~120 QPS avg
  - 1M DAU, 10 actions → ~120 QPS avg, ~600 QPS peak
```

A single modern server (Go/Node.js) can handle 10,000-50,000+ QPS for simple
requests. This means 1M DAU is often a single-server problem. Let that sink in.

### Where Go and TypeScript Land

| Setup | Approx QPS (simple JSON API) |
|---|---|
| Single Node.js (Express) | ~5,000-15,000 |
| Single Node.js (Fastify) | ~15,000-30,000 |
| Single Go (net/http) | ~30,000-100,000+ |
| Single Go (fasthttp) | ~100,000-300,000+ |

---

## Data Size Estimates

### Common Objects

| Object | Size Estimate | Breakdown |
|---|---|---|
| Tweet/Short post | ~1 KB | 280 chars UTF-8 + metadata (user ID, timestamp, IDs) |
| User profile | ~1-5 KB | Name, email, bio, settings, avatar URL |
| Photo (original) | ~2-5 MB | Smartphone camera, JPEG |
| Photo (thumbnail) | ~10-50 KB | 200x200 compressed |
| Photo (web-optimized) | ~200-500 KB | 1080px wide, compressed |
| 1-min video (1080p) | ~10-20 MB | H.264 compressed |
| 1-min video (4K) | ~40-80 MB | H.265 compressed |
| Chat message | ~200 bytes - 1 KB | Text + metadata |
| Email | ~5-50 KB | Text + headers (no attachments) |
| Log line | ~200-500 bytes | Timestamp + structured fields |
| Database row (typical) | ~100 bytes - 1 KB | Depends on columns |
| JSON API response | ~1-10 KB | Typical list/detail endpoint |

### Scaling Example — How Much Storage for 1 Year?

| Service | Volume | Object Size | Daily Storage | Yearly Storage |
|---|---|---|---|---|
| Twitter-like (tweets) | 500M tweets/day | 1 KB | 500 GB | ~180 TB |
| Instagram-like (photos) | 100M photos/day | 3 MB | 300 TB | ~110 PB |
| YouTube-like (video) | 500K hours/day | 1 GB/hour | 500 TB | ~180 PB |
| Chat app (messages) | 10B messages/day | 500 bytes | 5 TB | ~1.8 PB |

---

## Quick Estimation Cheat Sheet

Cut this out and tape it to your monitor.

### Time Conversions

| Period | Seconds |
|---|---|
| 1 minute | 60 |
| 1 hour | 3,600 |
| 1 day | 86,400 → round to **100,000** (10^5) |
| 1 month | 2,592,000 → round to **2.5 × 10^6** |
| 1 year | 31,536,000 → round to **3 × 10^7** |

### Napkin Math Rules

```
Rule 1: DAU to QPS
         QPS ≈ DAU / 100,000  (for 1 action per user per day)

Rule 2: Peak traffic
         Peak ≈ Average × 3 to 5  (use 5x if unsure)

Rule 3: Storage growth
         Daily storage = objects_per_day × avg_object_size
         Yearly = Daily × 365 (or × 400 for safety margin)

Rule 4: Bandwidth
         Bandwidth = QPS × avg_response_size
         e.g., 1000 QPS × 10 KB = 10 MB/s ≈ 80 Mbps

Rule 5: The 80/20 Rule
         80% of traffic hits 20% of data
         Cache that 20% and you handle most of your load

Rule 6: Read:Write Ratio
         Most apps are read-heavy (10:1 to 100:1)
         Social media: ~100:1
         Messaging: ~5:1
         E-commerce: ~50:1

Rule 7: Machines needed
         Machines ≈ Peak QPS / QPS_per_machine
         Add 30% headroom for safety

Rule 8: Replication factor
         Usually 3x storage for replicated databases
         Sometimes 5x with indexes and overhead
```

### Bandwidth Conversions

| Rate | Equivalent |
|---|---|
| 1 Mbps | 125 KB/s → ~10 GB/day |
| 100 Mbps | 12.5 MB/s → ~1 TB/day |
| 1 Gbps | 125 MB/s → ~10 TB/day |
| 10 Gbps | 1.25 GB/s → ~100 TB/day |

### How Many Servers Do I Need?

```
Scenario: 10M DAU, 20 actions/user/day, 10 KB avg response

Step 1: QPS = (10M × 20) / 100,000 = 2,000 QPS avg
Step 2: Peak = 2,000 × 5 = 10,000 QPS peak
Step 3: One Go server handles ~50,000 QPS
Step 4: 10,000 / 50,000 = 0.2 → 1 server technically works
Step 5: But you need redundancy → 3 servers minimum
Step 6: Bandwidth = 10,000 × 10 KB = 100 MB/s = 800 Mbps
Step 7: One 1Gbps link handles it (but get 10Gbps for headroom)
```

---

## The Hierarchy of Speed

Memorize this order. When someone proposes a design, think about where each
operation falls on this spectrum.

```
FAST                                                           SLOW
 │                                                               │
 ▼                                                               ▼
 L1 → L2 → L3 → RAM → SSD → HDD → Same DC → Cross-country → Overseas
 1ns   4ns  10ns  100ns  16μs  5ms   0.5ms     50ms           200ms
      │              │              │                    │
      └── CPU work ──┘              └── Network work ────┘
      (nanoseconds)                   (milliseconds)
```

The gap between RAM and network is **5 orders of magnitude**. That's the
difference between 1 second and 1 day. This is why:

- In-process caches beat remote caches
- Remote caches beat database queries
- Database queries beat API calls to other services
- Same-region calls beat cross-region calls

Every hop you can eliminate is a massive win.

---

## Putting It All Together — Mental Model

When you hear a system design requirement, your brain should automatically run
through this checklist:

```
"We need to serve 50M users"

→ QPS: 50M DAU × 10 actions / 100K = 5,000 QPS avg, 25,000 peak
→ Can one server handle it? Probably yes for simple reads.
→ Storage: depends on data model, but let's estimate
→ Bandwidth: 25,000 × 5 KB = 125 MB/s = 1 Gbps — need 10Gbps link
→ Database: 25,000 reads/sec — need read replicas or caching
→ Cache hit rate at 95%: only 1,250 QPS hit the database — manageable
```

These numbers give you a *framework* for reasoning. They're not meant to be
exact — they're meant to tell you whether you need 1 server or 1,000, whether
you need caching or not, whether you need a CDN or not.

In Go terms: this is like knowing that a goroutine costs ~2KB of stack space,
so you can spin up millions of them. That single number changes how you design
concurrent systems.

In TypeScript/Node terms: knowing the event loop is single-threaded tells you
that CPU-heavy work blocks everything, so you know to use worker threads or
move compute-heavy work to a separate service.

The numbers are your intuition. Build it.
