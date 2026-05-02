# Lesson 36: Design a Web Crawler

A web crawler systematically downloads web pages at scale. It's the
engine behind search engines, archive.org, price comparison sites, and
SEO tools. The challenge: crawl billions of pages efficiently while
being polite to web servers.

**Analogy:** Imagine sending 10,000 researchers to visit every library
in the world and copy every book. Each researcher needs a map of which
libraries to visit (URL frontier), rules about visiting hours and
capacity (politeness), a way to avoid copying the same book twice
(deduplication), and a central catalog where copies are stored.

---

## Step 1: Requirements

### Functional Requirements

1. **Discover pages** — Start from seeds, follow links
2. **Download pages** — Fetch HTML, respect robots.txt
3. **Extract links** — Parse HTML for new URLs to crawl
4. **Store content** — Save page content for processing
5. **Re-crawl** — Revisit pages to detect changes

### Non-Functional Requirements

1. **Throughput** — 20,000 pages/second
2. **Politeness** — Don't overwhelm any single host
3. **Deduplication** — Don't crawl the same page twice
4. **Scalability** — Distribute across hundreds of machines
5. **Robustness** — Handle malformed HTML, infinite loops, spider traps

### Scale Estimation

```
Target: 1 billion pages/month
Pages per second:  1B / (30 × 86400) ≈ 400 pages/sec (minimum)
With headroom:     20,000 pages/sec target

Average page: 100 KB
Bandwidth:    20,000 × 100 KB = 2 GB/sec = 16 Gbps
Storage:      1B × 100 KB = 100 TB/month (raw)
```

---

## Step 2: High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                     WEB CRAWLER                          │
│                                                         │
│  ┌──────────────┐                                       │
│  │  Seed URLs   │                                       │
│  │ (initial set)│                                       │
│  └──────┬───────┘                                       │
│         │                                               │
│  ┌──────▼───────┐     ┌──────────────┐                  │
│  │     URL      │◀────│ Link         │                  │
│  │   Frontier   │     │ Extractor    │                  │
│  │  (priority   │     └──────────────┘                  │
│  │   queue)     │            ▲                          │
│  └──────┬───────┘            │                          │
│         │                    │                          │
│  ┌──────▼───────┐     ┌─────┴────────┐                  │
│  │   Fetcher    │────▶│   HTML       │                  │
│  │  (download)  │     │   Parser     │                  │
│  └──────┬───────┘     └──────────────┘                  │
│         │                                               │
│  ┌──────▼───────┐     ┌──────────────┐                  │
│  │   Content    │────▶│  Dedup       │                  │
│  │   Store      │     │  Filter      │                  │
│  └──────────────┘     └──────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

---

## Step 3: URL Frontier (The Brain)

The frontier decides WHAT to crawl and WHEN.

```
┌────────────────────────────────────────────────────────┐
│                    URL FRONTIER                         │
│                                                        │
│  ┌─────────────────────────────────────────────┐       │
│  │           Prioritizer                        │       │
│  │                                             │       │
│  │  Input URL → compute priority score:        │       │
│  │    - PageRank of URL                        │       │
│  │    - Domain authority                        │       │
│  │    - Freshness requirement                  │       │
│  │    - Update frequency history               │       │
│  │                                             │       │
│  │  Output → assign to priority bucket         │       │
│  └─────────────────┬───────────────────────────┘       │
│                    │                                   │
│  ┌─────────────────▼───────────────────────────┐       │
│  │       Priority Queues                        │       │
│  │                                             │       │
│  │  P0 (highest): news sites, high-PageRank    │       │
│  │  P1: popular blogs, e-commerce              │       │
│  │  P2: regular websites                        │       │
│  │  P3 (lowest): low-traffic, static sites     │       │
│  └─────────────────┬───────────────────────────┘       │
│                    │                                   │
│  ┌─────────────────▼───────────────────────────┐       │
│  │       Politeness Queues (per-host)          │       │
│  │                                             │       │
│  │  example.com:  [url1, url2, url3]           │       │
│  │  other.org:    [url4, url5]                 │       │
│  │  blog.net:     [url6]                       │       │
│  │                                             │       │
│  │  Each host queue has a minimum delay         │       │
│  │  (from robots.txt Crawl-delay or default)   │       │
│  └─────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────┘
```

### Politeness Implementation

```go
package crawler

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"
)

type PolitenessEnforcer struct {
	mu          sync.Mutex
	lastAccess  map[string]time.Time
	defaultWait time.Duration
	hostWaits   map[string]time.Duration
}

func NewPolitenessEnforcer(defaultWait time.Duration) *PolitenessEnforcer {
	return &PolitenessEnforcer{
		lastAccess:  make(map[string]time.Time),
		defaultWait: defaultWait,
		hostWaits:   make(map[string]time.Duration),
	}
}

func (pe *PolitenessEnforcer) WaitForHost(ctx context.Context, rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("parse url: %w", err)
	}
	host := parsed.Host

	pe.mu.Lock()
	last, exists := pe.lastAccess[host]
	wait := pe.defaultWait
	if hw, ok := pe.hostWaits[host]; ok {
		wait = hw
	}
	pe.lastAccess[host] = time.Now()
	pe.mu.Unlock()

	if exists {
		elapsed := time.Since(last)
		if elapsed < wait {
			sleepDuration := wait - elapsed
			select {
			case <-time.After(sleepDuration):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}

	return nil
}
```

---

## Step 4: robots.txt

```
Every website can publish crawling rules at /robots.txt:

  User-agent: *
  Disallow: /admin/
  Disallow: /private/
  Crawl-delay: 2

  User-agent: MyBot
  Allow: /public/
  Disallow: /

RULES:
  1. ALWAYS fetch and cache robots.txt before crawling a domain
  2. Cache for 24 hours (re-fetch daily)
  3. Respect Disallow directives
  4. Respect Crawl-delay (seconds between requests)
  5. If robots.txt returns 5xx, treat as "allow all" temporarily
  6. If robots.txt returns 4xx, treat as "no restrictions"
```

```
robots.txt cache:

  ┌──────────────┬──────────────────┬────────────┐
  │ host         │ rules            │ fetched_at │
  ├──────────────┼──────────────────┼────────────┤
  │ example.com  │ Disallow: /admin │ 2024-01-15 │
  │ blog.org     │ Crawl-delay: 5   │ 2024-01-15 │
  │ news.com     │ (no restrictions)│ 2024-01-15 │
  └──────────────┴──────────────────┴────────────┘
```

---

## Step 5: Fetcher (Distributed Downloads)

```
DISTRIBUTED FETCHER ARCHITECTURE:

  ┌────────────────────────────────────────────────────┐
  │              Fetcher Fleet                          │
  │                                                    │
  │  ┌──────────┐  ┌──────────┐       ┌──────────┐   │
  │  │Fetcher 1 │  │Fetcher 2 │  ...  │Fetcher N │   │
  │  │(handles  │  │(handles  │       │(handles  │   │
  │  │ hosts    │  │ hosts    │       │ hosts    │   │
  │  │ A-F)     │  │ G-M)     │       │ T-Z)     │   │
  │  └──────────┘  └──────────┘       └──────────┘   │
  │                                                    │
  │  Each fetcher "owns" a set of hosts.              │
  │  This ensures politeness per host                 │
  │  (one fetcher manages the delay for its hosts).   │
  └────────────────────────────────────────────────────┘

Why host-based assignment?
  If two fetchers both crawl example.com,
  they can't coordinate the delay between them.
  Assign each host to exactly one fetcher → simple politeness.
```

### Handling Edge Cases

```
SPIDER TRAPS:
  URL: /page/1/page/2/page/3/page/4/... (infinite depth)
  Solution: max URL depth (e.g., 15 levels)

DYNAMIC PAGES:
  URL: /products?session=abc123&timestamp=1234567890
  Every visit generates a unique URL → infinite crawl
  Solution: URL normalization, strip session params

LARGE FILES:
  URL points to a 5 GB video file
  Solution: check Content-Length header before downloading
             skip files > 10 MB (or configurable)

SLOW SERVERS:
  Server takes 30 seconds to respond
  Solution: timeout after 10 seconds, move to next URL
```

---

## Step 6: Deduplication

### URL Deduplication

```
Before adding a URL to the frontier, check if we've seen it.

  Bloom filter approach:
    - Probabilistic set membership (may have false positives)
    - 1B URLs, 0.1% FP rate → ~1.5 GB memory
    - O(1) lookup, O(1) insert

  ┌──────────────────────┐
  │    URL Normalizer    │
  │                      │
  │ http://Example.COM/  │
  │ → https://example.com│  (normalize scheme, host, path)
  │                      │
  │ /page?b=2&a=1        │
  │ → /page?a=1&b=2      │  (sort query params)
  └──────────┬───────────┘
             │
  ┌──────────▼───────────┐
  │    Bloom Filter      │
  │                      │
  │  Seen before?        │
  │  → Yes: skip         │
  │  → No: add to        │
  │    frontier + filter  │
  └──────────────────────┘
```

### Content Deduplication

Different URLs can serve identical content (mirrors, syndication).

```
Content fingerprinting:

  Page HTML → strip tags → extract text → compute SimHash

  SimHash: 64-bit fingerprint
  Two pages with Hamming distance < 3 → near-duplicate

  ┌─────────────────────────────────────────────┐
  │  URL: example.com/article                    │
  │  SimHash: 1010110011...0101 (64 bits)       │
  │                                             │
  │  URL: mirror.com/same-article               │
  │  SimHash: 1010110011...0100 (64 bits)       │
  │                                             │
  │  Hamming distance: 1 → NEAR DUPLICATE       │
  │  → Don't index mirror.com version           │
  └─────────────────────────────────────────────┘
```

---

## Step 7: Re-Crawling Strategy

```
Not all pages change at the same rate.

  NEWS SITE:  homepage changes every 5 minutes
  BLOG:       new posts weekly
  DOCS SITE:  changes monthly

Adaptive re-crawl:
  Track how often each URL's content changes.
  Adjust re-crawl frequency accordingly.

  ┌──────────────┬──────────────┬──────────────────┐
  │ URL          │ Change Rate  │ Re-crawl Interval│
  ├──────────────┼──────────────┼──────────────────┤
  │ cnn.com      │ 95% daily    │ every 1 hour     │
  │ blog.com/p1  │ 5% daily     │ every 7 days     │
  │ docs.lib.org │ 0.1% daily   │ every 30 days    │
  └──────────────┴──────────────┴──────────────────┘
```

---

## Complete Architecture

```
  Seed URLs
     │
┌────▼─────────────────────────────────────────────────┐
│                   URL FRONTIER                        │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Priority  │─▶│  Politeness  │─▶│  Bloom Filter │ │
│  │ Queues    │  │  Queues      │  │  (dedup)      │ │
│  └───────────┘  └──────────────┘  └───────────────┘ │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│               FETCHER FLEET (N nodes)                 │
│  robots.txt cache │ HTTP client │ Timeout handling    │
└──────────────────────────┬───────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
  ┌──────▼──────┐  ┌──────▼──────┐  ┌───────▼─────┐
  │ HTML Parser │  │  Content    │  │  Content    │
  │ (extract    │  │  Store     │  │  Dedup      │
  │  links)     │  │  (S3)     │  │  (SimHash)  │
  └──────┬──────┘  └────────────┘  └─────────────┘
         │
         │  new URLs
         │
  ┌──────▼──────┐
  │ URL Filter  │  (normalize, validate, check scope)
  └──────┬──────┘
         │
         └──▶ back to URL Frontier
```

---

## Back-of-Envelope: Infrastructure

```
Target: 20,000 pages/second

Fetchers:
  Each fetcher handles ~100-500 pages/sec (limited by network I/O)
  Need: 20,000 / 200 = 100 fetcher nodes

Bandwidth:
  20,000 pages × 100 KB = 2 GB/sec ingress

URL Frontier:
  Bloom filter: ~2 GB for 1B URLs
  Priority queues: distributed (Redis or Kafka)

Storage:
  1B pages × 100 KB = 100 TB/month
  Object storage (S3): $0.023/GB = $2,300/month

DNS resolution:
  20,000 pages/sec = 20,000 DNS lookups/sec
  Local DNS cache is essential (cache TTL: 1 hour)
```

---

## Exercises

1. Implement a robots.txt parser in Go. Parse User-agent, Disallow,
   Allow, and Crawl-delay directives. Test with real robots.txt files.

2. Build a URL normalizer that handles: scheme normalization, host
   case, path normalization, query parameter sorting, fragment removal,
   and trailing slash normalization.

3. Design the URL frontier for 20,000 pages/second with per-host
   politeness. How do you partition hosts across fetcher nodes? What
   happens when a fetcher node dies?

4. Calculate: crawling 10B pages, average page links to 50 other
   URLs. How many URLs enter the frontier per crawl cycle? How large
   does the Bloom filter need to be for 0.01% false positive rate?

---

*Next: [Lesson 37 — Design an AI Inference Platform](./37-design-ai-inference-platform.md),
where we serve ML models at scale with GPU management and request batching.*
