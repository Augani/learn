# Lesson 22: Design a News Feed

A news feed aggregates posts from everyone you follow, ranks them, and
delivers a personalized stream. It sounds simple — "just query all posts
from people I follow and sort by time." But when a user follows 500 people,
and 300 million users are refreshing their feeds simultaneously, that naive
query brings your database to its knees.

**Analogy:** Imagine a newspaper that's personalized for every single
reader. Each of the 300 million subscribers gets a unique front page based
on which journalists they follow. You can't print 300 million different
newspapers on demand every morning — you need a smarter strategy. Maybe you
pre-assemble common sections, maybe you keep hot stories pre-sorted, maybe
you treat a journalist with 50 million followers differently than one with
50. That's the news feed problem.

---

## Step 1: Requirements

### Functional Requirements

1. **Post creation** — Users can create text posts with optional media
   (images, videos, links)
2. **News feed generation** — Each user sees a feed of posts from people
   they follow
3. **Follow/unfollow** — Users can follow and unfollow other users
4. **Feed ranking** — Support both chronological and algorithmic ranking
5. **Media support** — Images, videos, link previews in posts
6. **Interactions** — Like, comment, share (but full implementation is
   out of scope)

### Non-Functional Requirements

1. **Feed generation < 500ms** — Users expect instant refresh
2. **High availability** — Feed must always load
3. **Eventually consistent** — A new post can take a few seconds to appear
   in all followers' feeds (this is acceptable)
4. **Scalable** — Handle celebrity accounts with 100M+ followers

### Scale Estimation

```
DAU:                    300M
Average follows:        200 people per user
Posts per day:          500M new posts
Feed refreshes/day:     300M users * 5 refreshes = 1.5B feed requests/day
Feed requests/second:   1.5B / 86,400 ≈ 17,000 req/sec
Peak (5x):              ~85,000 req/sec

Storage (posts):
  Average post:         500 bytes (text + metadata)
  Media pointers:       100 bytes (URLs to CDN)
  500M posts/day * 600 bytes = 300 GB/day
  Per year: ~110 TB
```

---

## Step 2: High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                 │
│                  (mobile apps, web browsers)                     │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
    Create post                         Get my feed
           │                                  │
    ┌──────▼───────┐                   ┌──────▼───────┐
    │  Post        │                   │    Feed      │
    │  Service     │                   │   Service    │
    └──────┬───────┘                   └──────┬───────┘
           │                                  │
    ┌──────▼───────┐                   ┌──────▼───────┐
    │  Fan-Out     │                   │  Feed Cache  │
    │  Service     │                   │  (Redis)     │
    └──────┬───────┘                   └──────────────┘
           │
    ┌──────▼───────┐
    │  Feed Cache  │
    │  (write to   │
    │  followers'  │
    │  feeds)      │
    └──────┬───────┘
           │
    ┌──────▼───────┐
    │   Post       │
    │   Database   │
    └──────────────┘
```

### Core APIs

```
POST /api/v1/posts
  Request:  { "content": "Hello world!", "media_ids": ["img_123"] }
  Response: { "post_id": "post_789", "created_at": "..." }

GET /api/v1/feed?cursor=<cursor>&limit=20
  Response: {
    "posts": [ { "post_id": "...", "author": {...}, "content": "...", ... } ],
    "next_cursor": "eyJ0cyI6MTcwNTMxMjIwMH0="
  }

POST /api/v1/follow
  Request:  { "followee_id": "user_456" }

DELETE /api/v1/follow/{followee_id}
```

**Cursor-based pagination** (not offset-based):
Why? With offset pagination (`?page=3&limit=20`), if new posts arrive while
the user is scrolling, they'll see duplicates or miss posts. Cursor
pagination uses the last seen post's timestamp/ID as a bookmark, which is
stable even as new content arrives.

---

## Step 3: The Fan-Out Problem (The Core Challenge)

When User A creates a post, how does it appear in the feeds of all their
followers? This is the central design decision.

### Approach 1: Fan-Out on Write (Push Model)

**Analogy:** Like a mail carrier who delivers a copy of the newsletter to
every subscriber's mailbox the moment it's published. Delivery takes work,
but when subscribers check their mailbox, the newsletter is already there.

```
Alice posts "Hello!"
Alice has 3 followers: Bob, Carol, Dave

┌───────┐     ┌───────────┐
│ Alice │────▶│  Post     │──▶ Store post in posts table
│ posts │     │  Service  │
└───────┘     └─────┬─────┘
                    │
              ┌─────▼─────┐
              │  Fan-Out  │──▶ Look up Alice's followers: [Bob, Carol, Dave]
              │  Service  │
              └─────┬─────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
  ┌────▼────┐  ┌───▼────┐  ┌───▼─────┐
  │  Bob's  │  │ Carol's│  │ Dave's  │
  │  feed   │  │ feed   │  │ feed    │
  │  cache  │  │ cache  │  │ cache   │
  └─────────┘  └────────┘  └─────────┘
  Add post_id  Add post_id  Add post_id
```

**Feed cache structure** (Redis sorted set per user):

```
Key:    feed:user_bob
Type:   Sorted Set
Score:  timestamp (for chronological) or rank score (for algorithmic)
Value:  post_id

ZADD feed:user_bob 1705312200 post_abc123
ZADD feed:user_bob 1705312100 post_def456
ZADD feed:user_bob 1705312000 post_ghi789
...

When Bob opens his feed:
ZREVRANGE feed:user_bob 0 19   → top 20 post IDs (newest first)
Then: batch-fetch post details from post database/cache
```

**Trade-offs:**
- **Pro:** Reading the feed is blazing fast — just read from cache
- **Pro:** Simple feed retrieval logic
- **Con:** Write amplification — if Alice has 10,000 followers, creating one
  post triggers 10,000 cache writes
- **Con:** Wasted work for inactive users (writing to feeds that nobody reads)
- **Con:** IMPOSSIBLE for celebrities — Justin Bieber has 100M followers.
  One post = 100M writes. That takes minutes, not milliseconds.

---

### Approach 2: Fan-Out on Read (Pull Model)

**Analogy:** Like a newspaper that isn't pre-assembled. When you sit down to
read, a staff member runs around collecting articles from all the journalists
you follow and assembles your personal newspaper on the spot.

```
Bob opens his feed

┌───────┐     ┌───────────┐
│  Bob  │────▶│   Feed    │──▶ Look up who Bob follows: [Alice, Eve, Frank]
│ reads │     │  Service  │
└───────┘     └─────┬─────┘
                    │
              Query each followee's recent posts:
                    │
       ┌────────────┼────────────┐
       │            │            │
  ┌────▼────┐  ┌───▼────┐  ┌───▼─────┐
  │ Alice's │  │ Eve's  │  │ Frank's │
  │ posts   │  │ posts  │  │ posts   │
  └─────────┘  └────────┘  └─────────┘

  Merge + sort + rank → return top 20 to Bob
```

**Trade-offs:**
- **Pro:** No write amplification — posting is cheap
- **Pro:** Works for celebrities (no fan-out needed)
- **Con:** Reading is slow — must query N sources and merge
- **Con:** If Bob follows 500 people, that's 500 queries + merge
- **Con:** Hard to add algorithmic ranking (need all candidates first)

---

### Approach 3: Hybrid (What Real Systems Do)

**Analogy:** The newspaper pre-assembles sections for most subscribers, but
for the celebrity columnist whose articles everyone wants, they post it on
a central bulletin board that readers check themselves.

```
┌──────────────────────────────────────────────────────┐
│                    Hybrid Fan-Out                     │
│                                                      │
│  Celebrity posts          Normal user posts           │
│  (> 10K followers)        (< 10K followers)           │
│                                                      │
│  Fan-out on READ          Fan-out on WRITE            │
│  ┌──────────────┐         ┌──────────────────┐       │
│  │ Store post   │         │ Push post_id to  │       │
│  │ in celebrity │         │ each follower's  │       │
│  │ posts cache  │         │ feed cache       │       │
│  └──────────────┘         └──────────────────┘       │
│                                                      │
│  When reading feed:                                  │
│  1. Read pre-built feed cache (from write fan-out)   │
│  2. Fetch recent posts from followed celebrities     │
│  3. Merge, rank, return top N                        │
└──────────────────────────────────────────────────────┘
```

```
Feed retrieval with hybrid approach:

┌───────┐
│  Bob  │
│ reads │
└───┬───┘
    │
    ▼
┌────────────────────────────────┐
│        Feed Service            │
│                                │
│  Step 1: Read Bob's feed cache │
│  (pre-built from write fan-out)│
│  → [post_1, post_2, ...,      │
│     post_15]                   │
│                                │
│  Step 2: Bob follows 3         │
│  celebrities. Fetch their      │
│  recent posts:                 │
│  → [celeb_post_A, celeb_post_B│
│     celeb_post_C]              │
│                                │
│  Step 3: Merge all posts       │
│  Step 4: Rank (time + score)   │
│  Step 5: Return top 20         │
└────────────────────────────────┘
```

**The Celebrity Problem (Justin Bieber Problem):**
If Justin Bieber has 100M followers and posts once, fan-out on write means
100M cache writes. At 100K writes/second, that's 1,000 seconds (~17
minutes) for one post to reach everyone. By then, he's posted again.

Solution: Don't fan out for celebrities. Their posts are stored separately,
and followers pull them at read time. Since most users follow only a handful
of celebrities, the extra read-time queries are manageable.

```
Classification:

  followersCount < 10,000     → Normal user (fan-out on write)
  followersCount >= 10,000    → Celebrity (fan-out on read)

This threshold is tunable. Twitter reportedly uses ~500K.
```

---

## Step 4: Deep Dives

### Deep Dive 1: Feed Ranking

#### Chronological Feed (Twitter-style, circa 2012)

Simple: sort by timestamp, newest first.

```
SELECT post_id FROM feed_cache
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20;
```

**Pro:** Simple, predictable, users understand it.
**Con:** Misses good content posted at odd hours. Overwhelmed by prolific
posters.

#### Algorithmic Feed (Facebook, TikTok, modern Twitter)

Each post gets a **relevance score** based on multiple signals:

```
Score = w1 * affinity + w2 * recency + w3 * engagement + w4 * content_type

Where:
  affinity:     How often does this user interact with the poster?
                (likes, comments, DMs, profile visits)
  recency:      How new is the post? (exponential decay)
  engagement:   How are OTHER users reacting? (likes, shares, comments)
  content_type: Does this user prefer images? videos? text?
```

```
Scoring pipeline:

┌────────────┐     ┌────────────┐     ┌────────────┐     ┌──────────┐
│ Candidate  │────▶│  Feature   │────▶│  Scoring   │────▶│  Filter  │
│ Generation │     │ Extraction │     │  Model     │     │ & Rank   │
│            │     │            │     │ (ML or     │     │          │
│ Get 500    │     │ For each   │     │  heuristic)│     │ Top 20   │
│ candidate  │     │ candidate, │     │            │     │ posts    │
│ posts      │     │ compute    │     │ Score each │     │ returned │
│            │     │ features   │     │ candidate  │     │          │
└────────────┘     └────────────┘     └────────────┘     └──────────┘
```

**For interviews, you don't need to build an ML model.** A simple heuristic
scoring function demonstrates the concept:

```go
package feed

import (
	"math"
	"sort"
	"time"
)

type Post struct {
	ID          string
	AuthorID    string
	CreatedAt   time.Time
	LikeCount   int
	CommentCount int
	ShareCount  int
	ContentType string
}

type ScoredPost struct {
	Post  Post
	Score float64
}

type UserAffinity struct {
	InteractionCount int
	LastInteraction  time.Time
}

func RankFeed(
	candidates []Post,
	affinities map[string]UserAffinity,
	userPrefs map[string]float64,
	now time.Time,
) []Post {
	scored := make([]ScoredPost, 0, len(candidates))

	for _, post := range candidates {
		score := computeScore(post, affinities[post.AuthorID], userPrefs, now)
		scored = append(scored, ScoredPost{Post: post, Score: score})
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	ranked := make([]Post, 0, len(scored))
	for _, sp := range scored {
		ranked = append(ranked, sp.Post)
	}

	return ranked
}

func computeScore(
	post Post,
	affinity UserAffinity,
	userPrefs map[string]float64,
	now time.Time,
) float64 {
	hoursAgo := now.Sub(post.CreatedAt).Hours()
	recencyScore := 1.0 / (1.0 + math.Log1p(hoursAgo))

	affinityScore := math.Min(float64(affinity.InteractionCount)/100.0, 1.0)

	engagementScore := math.Log1p(float64(post.LikeCount+post.CommentCount*2+post.ShareCount*3))
	engagementScore = math.Min(engagementScore/10.0, 1.0)

	contentBoost := userPrefs[post.ContentType]
	if contentBoost == 0 {
		contentBoost = 0.5
	}

	return (recencyScore * 0.3) + (affinityScore * 0.3) + (engagementScore * 0.2) + (contentBoost * 0.2)
}
```

---

### Deep Dive 2: Feed Cache Structure

Each user's feed is stored as a Redis sorted set. The score is the ranking
value (timestamp for chronological, computed score for algorithmic).

```
Redis structure for Bob's feed:

Key:     feed:user_bob
Type:    Sorted Set (ZSET)
Members: post IDs
Scores:  timestamps or rank scores

┌──────────────────────────────────────────────────┐
│  feed:user_bob                                    │
│                                                  │
│  Score (timestamp)    │  Member (post_id)        │
│  ─────────────────────┼─────────────────────     │
│  1705312200           │  post_abc123             │
│  1705312100           │  post_def456             │
│  1705312000           │  post_ghi789             │
│  1705311900           │  post_jkl012             │
│  ...                  │  ...                     │
│  (keep only last 500) │                          │
└──────────────────────────────────────────────────┘
```

**Memory calculation:**
```
Each feed entry:   post_id (20 bytes) + score (8 bytes) = ~28 bytes
Entries per user:  500 (keep last 500 posts)
Per user:          500 * 28 = 14 KB
Total (300M DAU):  300M * 14 KB = 4.2 TB

That's a lot! But:
  - Not all users are active (cache only active users)
  - Cache 50M active users: 50M * 14 KB = 700 GB
  - A Redis cluster can handle this
```

**Feed retrieval in Go:**

```go
package feed

import (
	"context"
	"fmt"
	"strconv"

	"github.com/redis/go-redis/v9"
)

type FeedService struct {
	cache    *redis.Client
	postRepo PostRepository
}

type PostRepository interface {
	GetPosts(ctx context.Context, postIDs []string) ([]Post, error)
	GetRecentByAuthor(ctx context.Context, authorID string, limit int) ([]Post, error)
}

func (fs *FeedService) GetFeed(
	ctx context.Context,
	userID string,
	cursor string,
	limit int,
) ([]Post, string, error) {
	maxScore := "+inf"
	if cursor != "" {
		maxScore = cursor
	}

	feedKey := fmt.Sprintf("feed:%s", userID)
	postIDs, err := fs.cache.ZRevRangeByScore(ctx, feedKey, &redis.ZRangeBy{
		Min: "-inf", Max: maxScore, Offset: 0, Count: int64(limit + 1),
	}).Result()
	if err != nil {
		return nil, "", fmt.Errorf("cache read failed: %w", err)
	}

	celebIDs, _ := fs.cache.SMembers(ctx, fmt.Sprintf("follows:celebrities:%s", userID)).Result()
	for _, celID := range celebIDs {
		celPosts, _ := fs.postRepo.GetRecentByAuthor(ctx, celID, 5)
		for _, p := range celPosts {
			postIDs = append(postIDs, p.ID)
		}
	}

	postIDs = dedup(postIDs)
	hasMore := len(postIDs) > limit
	if hasMore {
		postIDs = postIDs[:limit]
	}

	posts, err := fs.postRepo.GetPosts(ctx, postIDs)
	if err != nil {
		return nil, "", fmt.Errorf("post fetch failed: %w", err)
	}

	nextCursor := ""
	if hasMore && len(posts) > 0 {
		nextCursor = strconv.FormatInt(posts[len(posts)-1].CreatedAt.UnixMilli(), 10)
	}

	return posts, nextCursor, nil
}

func dedup(ids []string) []string {
	seen := make(map[string]bool, len(ids))
	result := make([]string, 0, len(ids))
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			result = append(result, id)
		}
	}
	return result
}
```

---

### Deep Dive 3: Fan-Out Service

When a normal user posts, the fan-out service pushes the post ID to every
follower's feed cache: `ZADD feed:{follower_id} {timestamp} {post_id}`,
then trims to the latest 500 entries with `ZREMRANGEBYRANK`.

For a user with 5,000 followers, that's 5,000 ZADD operations. At Redis
speed (~100K ops/sec), about 50ms. The fan-out service processes
asynchronously via Kafka — the post API enqueues a fan-out event, and
multiple fan-out workers consume batches of followers in parallel, using
Redis pipelines for efficiency. It also skips inactive followers (not
logged in for 30+ days) to avoid wasted writes.

---

### Deep Dive 4: Media and Social Graph

**Media handling:** Store media separately from posts. Client uploads
images/videos to an upload service that stores them in S3. The post database
stores only a media URL (pointer to CDN). CDN serves the actual binary.
This separation matters because post text is < 1 KB while images are 1-10
MB — different storage, different caching, different scaling needs.

**Social graph:** Maintain two Redis sets per user — `following:user_123`
(who I follow) and `followers:user_123` (who follows me). On follow, SADD
to both. On unfollow, SREM from both. For users with millions of followers,
store the follower list in a database and page through it during fan-out.

---

## Step 5: Scaling

### Database Sharding

```
Posts database: Shard by author_id
  → All posts by one user on the same shard
  → Fan-out reads from one shard per followee

Social graph: Shard by user_id
  → All follow relationships for a user on the same shard

Feed cache: Shard by user_id
  → All feed entries for a user on the same Redis node
```

### Cache Warming

When a user opens the app after being inactive, their feed cache might be
cold (expired). Instead of showing an empty feed while fan-out catches up:

```
1. User opens app → feed cache is empty
2. Feed service detects cold cache
3. Fetch recent posts from top 50 followed accounts (parallel queries)
4. Merge, score, populate feed cache
5. Return feed to user
6. Background job: full fan-out catch-up for remaining followed accounts
```

---

## Complete Architecture

```
  CLIENTS (mobile, web)
       │                │
  POST /posts       GET /feed
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│ Post Service│  │ Feed Service│
│ validate,   │  │ read cache, │
│ store,      │  │ fetch celeb │
│ enqueue     │  │ posts, rank │
└──────┬──────┘  └──────┬──────┘
       │                │
┌──────▼──────┐  ┌──────▼──────┐    ┌──────────────┐
│   Kafka     │  │ Feed Cache  │    │  Post Cache  │
│  (fan-out)  │  │ (Redis ZSET │    │   (Redis)    │
└──────┬──────┘  │  per user)  │    └──────┬───────┘
       │         └─────────────┘           │
┌──────▼──────┐                     ┌──────▼───────┐
│  Fan-Out    │────────────────────▶│   Post DB    │
│  Workers    │                     │  (sharded)   │
└─────────────┘                     └──────────────┘

Supporting: Social Graph DB, Media (S3 + CDN)
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Fan-out | On write (push) | On read (pull) | Hybrid — push for normal, pull for celebrities |
| Ranking | Chronological | Algorithmic | Both (let users choose) |
| Feed cache | In-memory per server | Redis sorted set | Redis (shared across servers) |
| Post storage | SQL (PostgreSQL) | NoSQL (Cassandra) | Either works — SQL for smaller scale, NoSQL for massive |
| Pagination | Offset-based | Cursor-based | Cursor — stable under concurrent writes |
| Media | Inline in post DB | Separate object store + CDN | Separate — different access patterns |

---

## Common Interview Follow-Ups

**Q: How do you handle a user unfollowing someone?**
Remove the unfollowed user's posts from the follower's feed cache. Run a
background job: `ZREM feed:user_bob post_id` for each post by the
unfollowed user. This doesn't need to be instant.

**Q: How do you prevent duplicate posts in the feed?**
The feed cache is a Redis sorted set where the member is post_id. Sets
naturally deduplicate — adding the same post_id twice is a no-op.

**Q: How do you handle deleted posts?**
1. Mark the post as deleted in the database (soft delete)
2. Fan-out a "delete" event to all followers' feed caches
3. Remove the post_id from each feed cache
4. If a client still has the post cached locally, the next API call for
   post details returns a "deleted" status

**Q: How do you implement "Suggested Posts" (from non-followed users)?**
Inject posts from a recommendation service into the feed. After merging
followed-user posts, the ranking step mixes in recommended posts based on
interests, interactions, and trending content. Label them as "Suggested."

**Q: What about real-time feed updates (new posts appearing while scrolling)?**
Two approaches: (1) Pull — client polls every 30 seconds. (2) Push — use
a WebSocket to notify the client "3 new posts available" and let the user
tap to refresh. Most apps use approach (2) with the notification badge.

---

## Hands-On Exercise

Build a minimal news feed:

1. Create a simple in-memory social graph (follow/unfollow)
2. Implement post creation that triggers fan-out to followers
3. Build the feed retrieval endpoint with cursor-based pagination
4. Add a celebrity threshold — skip fan-out for users with > 100 followers
5. Implement a basic scoring function (recency + interaction count)
6. Swap the in-memory cache for Redis sorted sets
7. Measure: how long does fan-out take for a user with 1,000 followers?

---

## Key Takeaways

1. **The hybrid fan-out approach solves the celebrity problem** — push for
   normal users (fast reads), pull for celebrities (manageable writes)
2. **Feed cache is a Redis sorted set** — O(log N) insert, O(log N + M)
   range query, natural dedup
3. **Cursor pagination is essential** — offset pagination breaks in
   feeds with constant new content
4. **Separate media from content** — different storage, different access
   patterns, different caching (CDN for media)
5. **Ranking is a spectrum** — start with chronological, add simple
   heuristics, evolve toward ML when you have the data
6. **Eventual consistency is acceptable** — a post appearing 2 seconds
   late in a friend's feed is fine. Correctness and availability matter
   more than instant propagation

---

*This concludes Phase 4: Real-World Designs. Next up is Phase 5, where
we dive into advanced building blocks that power modern distributed systems.*

*Next: [Lesson 23 — Proxies and Service Discovery](./23-proxies-service-discovery.md),
where we explore how services find each other and how traffic gets routed
in a microservices world.*
