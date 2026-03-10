# Lesson 24: Search Systems

Searching a billion documents in under 100 milliseconds seems impossible
if you think about scanning every word. The trick: don't scan — build an
index and look things up directly.

**Analogy:** Imagine a textbook with no index. To find every mention of
"photosynthesis," you'd read every page — that's a full table scan. Now
add an index at the back: "photosynthesis: pages 12, 45, 89, 201." You
jump straight to those pages. An **inverted index** is this idea, scaled
to billions of documents.

---

## The Inverted Index

A regular index maps documents to words (what words does doc 7 contain?).
An inverted index maps words to documents (which documents contain
"photosynthesis"?).

```
FORWARD INDEX (what a database stores):
  Doc 1: "the cat sat on the mat"
  Doc 2: "the dog sat on the log"
  Doc 3: "the cat and the dog"

INVERTED INDEX (what a search engine builds):
  "the" → [Doc 1, Doc 2, Doc 3]
  "cat" → [Doc 1, Doc 3]
  "sat" → [Doc 1, Doc 2]
  "on"  → [Doc 1, Doc 2]
  "mat" → [Doc 1]
  "dog" → [Doc 2, Doc 3]
  "log" → [Doc 2]
  "and" → [Doc 3]
```

### Searching with an Inverted Index

Query: `"cat AND sat"`

```
1. Look up "cat" → [Doc 1, Doc 3]
2. Look up "sat" → [Doc 1, Doc 2]
3. Intersect    → [Doc 1]

Time: O(n + m) where n and m are posting list lengths
      NOT O(total documents)
```

### Back-of-Envelope: Why This Matters

```
1 billion documents, average 1000 words each

Full scan approach:
  1B docs × 1000 words × comparison = 1 trillion operations
  At 1 GHz: ~1000 seconds per query

Inverted index approach:
  Look up term in hash map: O(1)
  Intersect two posting lists of ~10K docs: O(10K)
  Total: < 1 millisecond
```

---

## Building a Simple Search Engine

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Document   │────▶│   Indexing    │────▶│   Inverted   │
│   Ingestion  │     │   Pipeline   │     │    Index     │
└──────────────┘     └──────────────┘     └──────────────┘
                           │
                     ┌─────▼─────┐
                     │ Tokenize  │
                     │ Lowercase │
                     │ Stem      │
                     │ Remove    │
                     │ stopwords │
                     └───────────┘

Query flow:
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
│  Query   │──▶ │  Parse   │──▶ │  Lookup   │──▶ │  Rank    │
│ "fast    │    │  & Analyze│   │  posting  │    │  results │
│  cars"   │    │  tokens  │    │  lists    │    │  by TF-  │
└──────────┘    └──────────┘    └───────────┘    │  IDF     │
                                                  └──────────┘
```

### Implementation in Go

```go
package search

import (
	"sort"
	"strings"
	"math"
)

type Document struct {
	ID      int
	Content string
}

type Index struct {
	postings  map[string][]int
	docCount  int
	docLengths map[int]int
}

func NewIndex() *Index {
	return &Index{
		postings:   make(map[string][]int),
		docLengths: make(map[int]int),
	}
}

func (idx *Index) Add(doc Document) {
	tokens := tokenize(doc.Content)
	idx.docLengths[doc.ID] = len(tokens)
	idx.docCount++

	seen := make(map[string]bool)
	for _, token := range tokens {
		if seen[token] {
			continue
		}
		seen[token] = true
		idx.postings[token] = append(idx.postings[token], doc.ID)
	}
}

func (idx *Index) Search(query string, limit int) []SearchResult {
	tokens := tokenize(query)
	if len(tokens) == 0 {
		return nil
	}

	scores := make(map[int]float64)
	for _, token := range tokens {
		postingList, exists := idx.postings[token]
		if !exists {
			continue
		}
		idf := math.Log(float64(idx.docCount) / float64(len(postingList)))
		for _, docID := range postingList {
			scores[docID] += idf
		}
	}

	results := make([]SearchResult, 0, len(scores))
	for docID, score := range scores {
		results = append(results, SearchResult{DocID: docID, Score: score})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if len(results) > limit {
		results = results[:limit]
	}
	return results
}

type SearchResult struct {
	DocID int
	Score float64
}

func tokenize(text string) []string {
	text = strings.ToLower(text)
	words := strings.Fields(text)
	tokens := make([]string, 0, len(words))
	for _, word := range words {
		cleaned := strings.Trim(word, ".,!?;:\"'()[]{}")
		if len(cleaned) > 1 && !isStopWord(cleaned) {
			tokens = append(tokens, cleaned)
		}
	}
	return tokens
}

var stopWords = map[string]bool{
	"the": true, "a": true, "an": true, "is": true,
	"in": true, "on": true, "at": true, "to": true,
	"and": true, "or": true, "of": true, "for": true,
}

func isStopWord(word string) bool {
	return stopWords[word]
}
```

---

## TF-IDF Ranking

Not all matches are equal. If "the" appears in every document, matching
on "the" is useless. TF-IDF captures this intuition.

```
TF (Term Frequency):
  How often does the term appear in THIS document?
  TF = count(term in doc) / total words in doc

IDF (Inverse Document Frequency):
  How rare is this term across ALL documents?
  IDF = log(total docs / docs containing term)

TF-IDF = TF × IDF

Example:
  "the"    appears in 999,000 of 1,000,000 docs → IDF ≈ 0.001 (useless)
  "quantum" appears in 50 of 1,000,000 docs     → IDF ≈ 9.9 (very useful)
```

---

## Autocomplete

Users expect suggestions after typing 2-3 characters. You need sub-10ms
response times.

```
User types: "pho"

┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│  "pho"   │────▶│  Trie/       │────▶│  phone (850K)    │
│          │     │  Prefix      │     │  photo (720K)    │
│          │     │  Index       │     │  photosynthesis  │
└──────────┘     └──────────────┘     │  phoenix (120K)  │
                                      └──────────────────┘
                                       ranked by popularity
```

### Trie for Prefix Search

```
          (root)
         /  |  \
        p   c   d
        |   |   |
        h   a   o
       / \  |   |
      o   i t   g
     /|   |
    n  t  c
    |  |  |
    e  o  k
```

**Trade-off: Trie vs Sorted Array with Binary Search**

| Approach | Lookup Time | Memory | Update Cost |
|----------|------------|--------|-------------|
| Trie | O(prefix length) | High (pointer overhead) | O(prefix length) |
| Sorted array + binary search | O(log n) | Low | O(n) for insert |
| Redis sorted set | O(log n) | Medium | O(log n) |

For most production autocomplete systems, a **precomputed sorted list in
Redis** beats a trie because Redis handles persistence, replication, and
expiration.

---

## Fuzzy Search

Users misspell things. "phtosynthesis" should still find "photosynthesis."

**Edit distance (Levenshtein):** The minimum number of single-character
edits (insert, delete, replace) to transform one string into another.

```
"phtosynthesis" → "photosynthesis"

  phto → phot (swap h and t: 1 edit)
  Result: edit distance = 1

Common approach: allow matches within edit distance 2.
```

**N-gram index:** Break words into overlapping chunks and index those.

```
"photosynthesis" → 3-grams: [pho, hot, oto, tos, osy, syn, ynt, nth, the, hes, esi, sis]

Query "phtosynthesis" → 3-grams: [pht, hto, tos, osy, syn, ...]

Overlapping 3-grams between query and "photosynthesis":
  [tos, osy, syn, ynt, nth, the, hes, esi, sis] → 9 matches

Threshold: if > 60% of 3-grams match, it's a fuzzy match.
```

---

## Elasticsearch Architecture

Elasticsearch is the de facto search engine for most companies. It wraps
Lucene (inverted index engine) with distribution and an API layer.

```
┌─────────────────────────────────────────────────────────┐
│                    ES Cluster                            │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │  Node 1  │    │  Node 2  │    │  Node 3  │          │
│  │          │    │          │    │          │          │
│  │ Shard 0  │    │ Shard 1  │    │ Shard 2  │          │
│  │ (primary)│    │ (primary)│    │ (primary)│          │
│  │          │    │          │    │          │          │
│  │ Shard 1  │    │ Shard 2  │    │ Shard 0  │          │
│  │ (replica)│    │ (replica)│    │ (replica)│          │
│  └──────────┘    └──────────┘    └──────────┘          │
│                                                         │
│  Query: search across ALL shards, merge results         │
└─────────────────────────────────────────────────────────┘

Index "products" → 3 primary shards, 1 replica each
  Shard 0: doc IDs hashing to 0
  Shard 1: doc IDs hashing to 1
  Shard 2: doc IDs hashing to 2
```

### Scaling Search: Scatter-Gather

```
Query "fast cars" hits the cluster:

  ┌──────────┐
  │  Client  │
  └────┬─────┘
       │
  ┌────▼─────┐     scatter
  │  Coord.  │────────────────┐
  │  Node    │─────────┐      │
  └────┬─────┘         │      │
       │          ┌────▼──┐ ┌─▼──────┐
       │          │Shard 0│ │Shard 1 │ ...
       │          │search │ │search  │
       │          │top 10 │ │top 10  │
       │          └───┬───┘ └───┬────┘
       │     gather   │         │
       │◀─────────────┴─────────┘
       │
  Merge top 10 from each shard
  Re-rank, return global top 10
```

---

## Back-of-Envelope: Search System Sizing

```
10 million products, average 500 bytes each

Raw data:         10M × 500B = 5 GB
Inverted index:   typically 30-50% of raw data = 2 GB
Total per replica: ~7 GB

3 shards, 1 replica each: 7 GB × 6 = 42 GB
Each node needs: ~14 GB disk, 8 GB RAM (for caching hot segments)

Query throughput:
  Single shard handles ~2000 QPS for simple queries
  3-shard scatter-gather: ~2000 QPS total (limited by slowest shard)
  Add replicas: 2 replicas per shard → ~6000 QPS
```

---

## Exercises

1. Build the inverted index from the Go example above. Add 1000
   documents and measure query time vs a brute-force string scan.

2. Implement autocomplete using a Redis sorted set. Store terms with
   their popularity as scores. Return the top 5 suggestions for any
   prefix.

3. Calculate the index size for 100 million documents with average 200
   unique terms each. How many Elasticsearch nodes do you need?

4. Implement edit-distance search: given a misspelled word, find all
   dictionary words within edit distance 2. Compare brute force vs
   n-gram pre-filtering.

---

*Next: [Lesson 25 — Blob Storage](./25-blob-storage.md), where we
design object storage systems like S3.*
