# Lesson 34: Design a Search Engine

A search engine takes a query like "best Italian restaurants nearby,"
searches billions of web pages, and returns the most relevant results
in under 200 milliseconds. The system has three main parts: crawl the
web, build an index, and rank results.

**Analogy:** Imagine building the world's largest library. First, you
send scouts (crawlers) to visit every building in every city and copy
every document. Then, you build a massive card catalog (inverted index)
so you can look up any word and find which documents contain it. Finally,
when someone asks a question, a librarian (ranking algorithm) picks the
10 best documents out of millions of matches.

---

## Step 1: Requirements

### Functional Requirements

1. **Crawl** — Discover and download web pages
2. **Index** — Build searchable index of all crawled pages
3. **Search** — Return ranked results for text queries
4. **Freshness** — Re-crawl pages to keep index current

### Non-Functional Requirements

1. **Query latency < 200 ms** for any query
2. **Freshness** — News pages re-indexed within minutes
3. **Scale** — Index 50+ billion web pages
4. **Availability** — Search must always work

### Scale Estimation

```
Web pages:           50 billion
Average page size:   100 KB (HTML)
Raw web:             50B × 100 KB = 5 PB
Index size:          typically 30% of raw = 1.5 PB
Queries per day:     8 billion
QPS:                 8B / 86400 ≈ 93,000
Peak QPS:            ~200,000

Crawl rate:
  Re-crawl all 50B pages every 30 days:
  50B / 30 / 86400 ≈ 20,000 pages/second
```

---

## Step 2: High-Level Design

```
┌───────────────────────────────────────────────────────────┐
│                     WEB CRAWLER                            │
│  ┌────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │  URL   │─▶│ Fetcher  │─▶│  Parser   │─▶│  URL     │  │
│  │Frontier│  │(download)│  │(extract   │  │Extractor │  │
│  └────────┘  └──────────┘  │ content)  │  └──────────┘  │
│                            └───────────┘       │         │
│                                           new URLs back  │
│                                           to frontier    │
└──────────────────────────────┬────────────────────────────┘
                               │ raw pages
                        ┌──────▼──────┐
                        │  Indexing   │
                        │  Pipeline  │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │  Inverted  │
                        │   Index    │
                        └──────┬──────┘
                               │
┌──────────────────────────────▼────────────────────────────┐
│                     QUERY ENGINE                           │
│  ┌────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │ Query  │─▶│  Index   │─▶│  Ranking  │─▶│ Results  │  │
│  │ Parser │  │  Lookup  │  │ (PageRank │  │ (top 10) │  │
│  └────────┘  └──────────┘  │  + TF-IDF)│  └──────────┘  │
│                            └───────────┘                  │
└───────────────────────────────────────────────────────────┘
```

---

## Step 3: Web Crawler

### URL Frontier

The frontier is a prioritized queue of URLs to crawl.

```
┌────────────────────────────────────────────────┐
│                URL FRONTIER                     │
│                                                │
│  Priority queues:                              │
│  ┌──────────────────┐                          │
│  │ High priority    │  news.com (re-crawl hourly)│
│  │ (fresh/important)│  cnn.com, bbc.com        │
│  ├──────────────────┤                          │
│  │ Medium priority  │  popular blogs, forums   │
│  │ (re-crawl daily) │                          │
│  ├──────────────────┤                          │
│  │ Low priority     │  static pages            │
│  │ (re-crawl weekly)│  personal sites          │
│  └──────────────────┘                          │
│                                                │
│  Per-host queues (politeness):                 │
│  ┌──────────────────┐                          │
│  │ example.com queue│  max 1 req/sec to host   │
│  │ other.com queue  │  respect robots.txt      │
│  └──────────────────┘                          │
└────────────────────────────────────────────────┘
```

### Politeness

```
robots.txt for example.com:
  User-agent: *
  Disallow: /private/
  Crawl-delay: 2

Rules:
  1. Always check robots.txt before crawling a domain
  2. Respect Crawl-delay (wait between requests to same host)
  3. Don't overwhelm small servers
  4. Identify your crawler in User-Agent header
```

### Deduplication

The web is full of duplicate content. Don't index the same page twice.

```
URL-level dedup:
  Normalize URLs:
    http://Example.COM/page → https://example.com/page
    https://example.com/page?a=1&b=2 → canonical form
  Store seen URLs in a Bloom filter (space-efficient)

Content-level dedup:
  Compute content fingerprint: SimHash or MinHash
  If fingerprint matches existing page → skip indexing

  SimHash: represents page as a 64-bit fingerprint
  Two pages with Hamming distance < 3 → near-duplicate

  Bloom filter for 50B URLs:
    50B entries, 0.1% false positive rate
    Size: ~72 GB (fits in memory across a cluster)
```

---

## Step 4: Inverted Index

See Lesson 24 for inverted index fundamentals. At web scale:

```
Term "restaurant":
  Posting list: [doc_1, doc_47, doc_892, ..., doc_49B]
  Length: 500 million documents

Storage:
  50B documents × average 200 unique terms = 10 trillion postings
  Each posting: doc_id (4 bytes) + term_frequency (2 bytes) = 6 bytes
  Raw index: 10T × 6 = 60 TB

  With compression (variable-byte encoding, delta encoding):
  Compressed: ~15 TB

Sharding:
  15 TB / 500 GB per shard = 30 index shards
  Each shard: subset of documents (document-partitioned)
  OR: subset of terms (term-partitioned)
```

### Document-Partitioned vs Term-Partitioned

```
DOCUMENT-PARTITIONED:
  Shard 1: docs 1-1.6B      (all terms for these docs)
  Shard 2: docs 1.6B-3.2B
  ...
  Shard 30: docs 48.4B-50B

  Query: scatter to ALL 30 shards, gather top results
  Pro: balanced load, easy to add documents
  Con: every query hits every shard

TERM-PARTITIONED:
  Shard 1: terms A-C    (all docs for these terms)
  Shard 2: terms D-F
  ...

  Query: only hit shards containing query terms
  Pro: fewer shards per query
  Con: hot terms create hot shards ("the" shard is huge)
```

Google uses **document-partitioned** — simpler, more predictable.

---

## Step 5: PageRank

TF-IDF finds relevant pages, but which relevant page is most important?
PageRank measures importance by counting incoming links.

```
PAGERANK INTUITION:

  A page is important if other important pages link to it.

  Page A has 3 incoming links from important sites → high PageRank
  Page B has 100 incoming links from spam sites → low PageRank

  ┌─────┐     ┌─────┐
  │ CNN │────▶│  A  │◀────┌─────┐
  └─────┘     └─────┘     │ BBC │
              ▲            └─────┘
              │
         ┌────┘
         │
  ┌──────┴──┐
  │ NYTimes │
  └─────────┘

  Page A: linked by CNN, BBC, NYTimes → very high PageRank

  ┌──────┐     ┌─────┐
  │spam1 │────▶│  B  │◀────┌──────┐
  └──────┘     └─────┘     │spam2 │
  ┌──────┐       ▲         └──────┘
  │spam3 │───────┘
  └──────┘

  Page B: linked by spam sites → low PageRank
```

### Simplified Formula

```
PR(A) = (1-d) + d × Σ(PR(T) / outlinks(T))

Where:
  d = damping factor (0.85)
  T = pages that link to A
  outlinks(T) = number of outgoing links from T

Computed iteratively:
  1. Initialize all pages with PR = 1/N
  2. For each page, recalculate PR using formula
  3. Repeat until convergence (~50-100 iterations)

At 50B pages, this is a massive distributed computation.
MapReduce or Pregel (graph processing) handles it.
```

---

## Step 6: Query Processing

```
User searches: "best Italian restaurants NYC"

  ┌────────────┐
  │ 1. Parse   │  tokens: ["best", "italian", "restaurants", "nyc"]
  └─────┬──────┘  remove stop words, stem, spell-correct
        │
  ┌─────▼──────┐
  │ 2. Lookup  │  "italian"     → posting list: [d1, d5, d9, d22, ...]
  │    Index   │  "restaurants" → posting list: [d1, d3, d5, d14, ...]
  └─────┬──────┘  "nyc"         → posting list: [d1, d5, d8, d22, ...]
        │
  ┌─────▼──────┐
  │ 3. Intersect│  All three terms: [d1, d5, ...]
  │   & Score   │  Score = TF-IDF × PageRank × freshness × location
  └─────┬──────┘
        │
  ┌─────▼──────┐
  │ 4. Rank    │  Sort by score, return top 10
  │   & Return │  Total time budget: < 200ms
  └────────────┘
```

### Ranking Signals

```
  Signal           │ Weight │ Description
  ─────────────────┼────────┼────────────────────────
  TF-IDF relevance │ High   │ How well content matches query
  PageRank         │ High   │ Page authority/importance
  Freshness        │ Medium │ When was page last updated
  Click-through    │ Medium │ Do users click this result
  Domain authority  │ Medium │ Overall site quality
  Mobile-friendly  │ Low    │ Is page mobile-optimized
  Page speed       │ Low    │ How fast does page load
  Exact match      │ High   │ Query appears in title/URL
```

---

## Back-of-Envelope: Query Latency Budget

```
200ms total budget:

  DNS + network:         20ms
  Query parsing:          5ms
  Index lookup (30 shards, parallel): 50ms
  Intersect + score:     30ms
  Re-rank top 1000:      20ms
  Snippet generation:    30ms
  Response serialization: 10ms
  Network return:        20ms
  Overhead:              15ms
  ─────────────────────────────
  Total:                200ms
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Index sharding | Document-partitioned | Term-partitioned | Document (simpler, balanced) |
| Ranking | TF-IDF only | TF-IDF + PageRank + ML | Multi-signal (quality) |
| Freshness | Re-crawl everything equally | Priority-based re-crawl | Priority (news hourly, static weekly) |
| Dedup | Exact hash | SimHash/MinHash | SimHash (catches near-dupes) |
| Index storage | In-memory | SSD + memory cache | Hot terms in memory, rest on SSD |

---

## Exercises

1. Implement a basic PageRank algorithm for a graph of 100 pages.
   Run 50 iterations and verify convergence.

2. Design the URL frontier for a crawler doing 20K pages/second.
   How do you enforce politeness (max 1 req/sec per host) while
   maintaining throughput? What data structures?

3. Calculate: 50B pages, 200 unique terms average, posting list entry
   = 6 bytes. What's the uncompressed index size? How many shards at
   500 GB each? How many replicas for 200K QPS?

4. A query has 3 terms with posting lists of 10M, 500K, and 50K
   documents. Design an efficient intersection algorithm. What's the
   time complexity?

---

*Next: [Lesson 35 — Design a Payment System](./35-design-payment-system.md),
where correctness matters more than speed and every cent must be accounted for.*
