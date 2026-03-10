# Lesson 38: Design a Recommendation Engine

Recommendations drive 35% of Amazon's revenue and 80% of Netflix views.
The system must suggest items a user will like, even if they've never
seen them before, and do it in under 100 milliseconds.

**Analogy:** Imagine a personal shopper who knows your taste. They
recommend a jacket because (1) you bought similar jackets before
(content-based), (2) people with similar taste bought this jacket
(collaborative filtering), and (3) this jacket is trending right now
(popularity). A great recommendation engine combines all three signals.

---

## Step 1: Requirements

### Functional Requirements

1. **Personalized recommendations** — Tailored to each user
2. **Similar items** — "People who bought X also bought Y"
3. **Real-time signals** — Adapt to what user just clicked/viewed
4. **Diverse results** — Don't just show the same category repeatedly
5. **New user handling** — Useful recommendations for first-time users

### Non-Functional Requirements

1. **Latency < 100ms** for recommendation API
2. **Freshness** — New items appear in recommendations within hours
3. **Scale** — 100M users, 10M items
4. **Offline training** — Models retrained daily or hourly

### Scale Estimation

```
Users:              100M
Items:              10M
Interactions/day:   1B (views, clicks, purchases)
Recommendation requests/sec: 50,000
Candidates to score per request: 1000 → return top 20
```

---

## Step 2: High-Level Design

```
┌────────────────────────────────────────────────────────────┐
│                    OFFLINE PIPELINE                          │
│                  (runs daily/hourly)                        │
│                                                            │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────┐      │
│  │ User     │─▶│  Training   │─▶│  Model Store     │      │
│  │ Events   │  │  Pipeline   │  │  (embeddings,    │      │
│  │ (Kafka)  │  │  (Spark)    │  │   model weights) │      │
│  └──────────┘  └─────────────┘  └──────────────────┘      │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    ONLINE SERVING                           │
│                  (real-time, < 100ms)                       │
│                                                            │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌───────┐ │
│  │ Candidate│─▶│  Feature   │─▶│  Scoring   │─▶│ Re-   │ │
│  │Generation│  │  Assembly  │  │  Model     │  │ Rank  │ │
│  │(1000     │  │(user+item  │  │(predict    │  │& Filt.│ │
│  │ items)   │  │ features)  │  │ score)     │  │(top20)│ │
│  └──────────┘  └────────────┘  └────────────┘  └───────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## Step 3: Recommendation Approaches

### Collaborative Filtering

Find users similar to you. Recommend what they liked.

```
USER-ITEM INTERACTION MATRIX:

              Item1  Item2  Item3  Item4  Item5
  User A:      5      3      -      1      -
  User B:      4      -      -      1      -
  User C:      1      1      -      5      4
  User D:      -      -      5      4      -
  User E:      -      3      4      -      5

  User A and User B have similar ratings → similar taste
  User B hasn't seen Item2. User A rated Item2 as 3.
  → Recommend Item2 to User B.

  Two types:
    User-based: find similar users → recommend their items
    Item-based: find similar items → recommend based on user's history
```

**Item-based is preferred at scale:**

```
Why item-based > user-based at scale:
  - User tastes change rapidly, item properties are stable
  - 100M users but only 10M items → smaller similarity matrix
  - Item similarities can be precomputed
  - Amazon uses item-based collaborative filtering
```

### Content-Based Filtering

Recommend items similar to what the user already liked, based on item
attributes.

```
User liked: "The Matrix" (sci-fi, action, Keanu Reeves)

Content features of "The Matrix":
  genre: [sci-fi, action]
  actors: [Keanu Reeves, Laurence Fishburne]
  themes: [AI, dystopia, hacking]

Find items with similar features:
  "John Wick"     → action, Keanu Reeves        → score: 0.7
  "Blade Runner"  → sci-fi, dystopia             → score: 0.8
  "Inception"     → sci-fi, action, mind-bending → score: 0.75

  ┌────────────────────────────────────────────────┐
  │  Content feature vector per item:               │
  │                                                │
  │  Matrix:     [1, 1, 0, 1, 0, 1, 1, 0, ...]   │
  │  Blade Runner: [1, 0, 0, 0, 0, 1, 1, 0, ...]  │
  │                                                │
  │  Cosine similarity(Matrix, Blade Runner) = 0.8 │
  └────────────────────────────────────────────────┘
```

### Hybrid Approach (What Real Systems Do)

```
┌──────────────────────────────────────────────────────┐
│              HYBRID RECOMMENDATION                    │
│                                                      │
│  ┌──────────────┐  Score: 0.4                        │
│  │ Collaborative│──────┐                             │
│  │ Filtering    │      │                             │
│  └──────────────┘      │                             │
│                        ├──▶ Final Score = weighted   │
│  ┌──────────────┐      │    combination              │
│  │ Content-Based│──────┤                             │
│  │ Filtering    │      │    0.4 × CF + 0.3 × CB     │
│  └──────────────┘      │    + 0.2 × Pop + 0.1 × RT  │
│                        │                             │
│  ┌──────────────┐      │                             │
│  │  Popularity  │──────┤                             │
│  │  (trending)  │      │                             │
│  └──────────────┘      │                             │
│                        │                             │
│  ┌──────────────┐      │                             │
│  │ Real-Time    │──────┘                             │
│  │ Signals      │                                    │
│  │ (just viewed)│                                    │
│  └──────────────┘                                    │
└──────────────────────────────────────────────────────┘
```

---

## Step 4: The Cold Start Problem

New users have no history. New items have no interactions.

```
COLD START: NEW USER
  No click history, no purchases, no ratings.

  Solutions (in order of quality):
  1. Popular items (everyone likes bestsellers)
  2. Ask preferences at signup (pick 5 genres you like)
  3. Use demographic info (age, location → similar cohort)
  4. Contextual: device, time, referral source
  5. Explore: show diverse items, learn from reactions

  ┌───────────────────────────────────────────┐
  │  New user signup flow:                     │
  │                                           │
  │  Step 1: Show trending items              │
  │  Step 2: User clicks on 3 items           │
  │  Step 3: Use those 3 items for content-   │
  │          based recommendations            │
  │  Step 4: After 20+ interactions,          │
  │          collaborative filtering kicks in │
  └───────────────────────────────────────────┘

COLD START: NEW ITEM
  No user has interacted with it yet.

  Solutions:
  1. Content-based: use item metadata (category, description)
  2. Boost new items: give them extra exposure for discovery
  3. Similar items: if metadata matches existing popular items,
     show alongside them
  4. Creator reputation: new video from popular YouTuber → boost
```

---

## Step 5: Two-Stage Architecture

Scoring all 10M items for every request is too slow. Use a funnel.

```
STAGE 1: CANDIDATE GENERATION (broad, fast)
  Goal: 10M items → 1000 candidates
  Time budget: 20ms

  Sources:
  ├── Collaborative filtering: 300 candidates
  ├── Content-based (similar to history): 300 candidates
  ├── Trending/popular: 200 candidates
  └── New items (exploration): 200 candidates

STAGE 2: SCORING (precise, slower per item)
  Goal: 1000 candidates → ranked list
  Time budget: 50ms

  For each candidate, compute:
  ├── User-item affinity score
  ├── Recency of item
  ├── Engagement prediction (will user click/buy?)
  └── Business rules (boost sponsored items, diversity)

STAGE 3: RE-RANKING (business logic)
  Goal: Final ordering, top 20
  Time budget: 10ms

  Apply:
  ├── Diversity (don't show 20 shoes in a row)
  ├── Remove already-seen items
  ├── Freshness boost
  └── Business rules (margin, inventory, sponsorship)
```

```go
package recommendations

import (
	"context"
	"sort"
)

type Item struct {
	ID       string
	Category string
	Score    float64
}

type Recommender struct {
	collabFilter  CandidateSource
	contentFilter CandidateSource
	trending      CandidateSource
	scorer        Scorer
}

func (r *Recommender) Recommend(ctx context.Context, userID string, limit int) ([]Item, error) {
	candidates := make(map[string]Item)

	sources := []CandidateSource{r.collabFilter, r.contentFilter, r.trending}
	for _, source := range sources {
		items, err := source.GetCandidates(ctx, userID, 300)
		if err != nil {
			continue
		}
		for _, item := range items {
			candidates[item.ID] = item
		}
	}

	candidateList := make([]Item, 0, len(candidates))
	for _, item := range candidates {
		candidateList = append(candidateList, item)
	}

	scored, err := r.scorer.Score(ctx, userID, candidateList)
	if err != nil {
		return nil, err
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	diversified := diversify(scored, limit)

	return diversified, nil
}

func diversify(items []Item, limit int) []Item {
	result := make([]Item, 0, limit)
	categoryCounts := make(map[string]int)
	maxPerCategory := limit / 4

	for _, item := range items {
		if len(result) >= limit {
			break
		}
		if categoryCounts[item.Category] >= maxPerCategory {
			continue
		}
		result = append(result, item)
		categoryCounts[item.Category]++
	}

	return result
}
```

---

## Step 6: Real-Time Features

Don't just use historical data. What the user is doing RIGHT NOW matters.

```
REAL-TIME FEATURE PIPELINE:

  User views product → event published to Kafka

  ┌───────────┐     ┌──────────────┐     ┌──────────────┐
  │  Event    │────▶│ Feature      │────▶│ Feature      │
  │  Stream   │     │ Processor    │     │ Store        │
  │  (Kafka)  │     │ (Flink)      │     │ (Redis)      │
  └───────────┘     └──────────────┘     └──────────────┘

  Real-time features:
    - Items viewed in last 10 minutes
    - Categories browsed in current session
    - Price range of recent views
    - Search queries in session

  These features boost recommendations for related items:
    User just viewed 3 running shoes →
    Boost running shoes, running accessories, running shorts
```

---

## Step 7: Evaluation Metrics

```
OFFLINE METRICS (measured on test set):
  Precision@K:   of the top K recommendations, how many were relevant?
  Recall@K:      of all relevant items, how many appeared in top K?
  NDCG:          do relevant items appear near the top?
  Coverage:      what % of catalog gets recommended to anyone?

ONLINE METRICS (measured in A/B tests):
  Click-through rate (CTR): did users click recommended items?
  Conversion rate:          did users buy recommended items?
  Revenue per session:      business impact
  Diversity:                are recommendations varied?
  Serendipity:              did users discover something unexpected?
```

---

## Back-of-Envelope: Embedding Storage

```
Embeddings for collaborative filtering:

  Users: 100M × 128-dim embedding × 4 bytes = 51 GB
  Items: 10M × 128-dim embedding × 4 bytes = 5.1 GB
  Total: ~56 GB

  Fits in a Redis cluster or in-memory on serving machines.

  Nearest-neighbor lookup (for candidate generation):
    Brute force: O(100M) comparisons → too slow
    Approximate NN (FAISS, ScaNN): O(log n) → ~5ms for top 300
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Approach | Collaborative only | Hybrid (CF + content + popular) | Hybrid (handles cold start) |
| Candidate gen | Brute force | ANN index (FAISS) | ANN (fast enough for real-time) |
| Features | Batch only | Batch + real-time | Both (real-time is huge for engagement) |
| Training | Daily | Hourly / streaming | Daily for models, hourly for features |
| Diversity | None | Category cap + exploration | Always diversify (prevents filter bubble) |
| Cold start | Popular items | Progressive (popular → content → collab) | Progressive (best UX) |

---

## Exercises

1. Implement item-based collaborative filtering for a movie dataset.
   Build the item-item similarity matrix and generate recommendations
   for a user given their watch history.

2. Design the two-stage pipeline: candidate generation (return 1000
   items in < 20ms) and scoring (rank 1000 items in < 50ms). What
   data structures support this latency?

3. Handle the cold start problem: a new user signs up and immediately
   asks for recommendations. Design the flow from first visit through
   their first 100 interactions. How does the recommendation strategy
   evolve?

4. Calculate: 100M users, 10M items, 128-dim embeddings. How large
   is the embedding space? Can you fit it in memory? What's the cost
   of a FAISS approximate nearest neighbor lookup for top 300?

---

*This concludes Phase 6: More Real-World Designs. You now have a
comprehensive toolkit for designing systems at any scale — from
foundational building blocks to complex real-world architectures.
Keep practicing by designing systems you use every day.*
