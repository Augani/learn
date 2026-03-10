# Lesson 13: API Design — REST, GraphQL, gRPC, and Webhooks

Your backend is built. Your database is humming. Now other systems need to
talk to it — mobile apps, web frontends, partner services, internal tools.
The API is the contract between your system and the outside world. Get it
wrong and you'll spend years maintaining backward compatibility for a bad
interface. Get it right and your API becomes the product.

---

## The Restaurant Analogy

Think of three ways to get food:

**REST is like a restaurant menu.** Fixed items, clearly described. You pick
"GET /menu/burger" and get exactly what the kitchen defined. Want fries? That's
a separate order. The menu is the same for everyone.

**GraphQL is like a buffet.** All the food is available. You grab exactly what
you want — a little salad, some pasta, skip the bread. You never get more than
you asked for, never less. But the kitchen has to prepare everything in advance.

**gRPC is like a drive-through intercom.** Fast, structured, minimal overhead.
You speak in a predefined script ("combo #3, no pickles"), the response comes
back instantly in a sealed bag. Not flexible for browsing, but incredibly
efficient when you know exactly what you want.

---

## REST: Resource-Oriented Design

REST (Representational State Transfer) treats everything as a **resource**
identified by a URL. You interact with resources using HTTP verbs.

### The Core Principles

```
Resources are nouns, not verbs:

  GOOD:  GET /users/42/posts
  BAD:   GET /getUserPosts?userId=42

  GOOD:  DELETE /posts/99
  BAD:   POST /deletePost
```

### HTTP Verbs and Their Meaning

```
┌──────────┬────────────────────┬─────────────┬──────────────┐
│  Verb    │  Meaning           │  Idempotent │  Safe        │
├──────────┼────────────────────┼─────────────┼──────────────┤
│  GET     │  Read a resource   │  Yes        │  Yes         │
│  POST    │  Create a resource │  No         │  No          │
│  PUT     │  Replace entirely  │  Yes        │  No          │
│  PATCH   │  Update partially  │  No*        │  No          │
│  DELETE  │  Remove a resource │  Yes        │  No          │
└──────────┴────────────────────┴─────────────┴──────────────┘

Idempotent = calling it 10 times has the same effect as calling it once
Safe = doesn't change server state (read-only)
*PATCH can be made idempotent depending on implementation
```

### Status Codes That Matter

Don't return 200 for everything. Status codes are part of your API contract.

```
2xx — Success
  200 OK              → Standard success
  201 Created         → New resource created (return Location header)
  204 No Content      → Success, nothing to return (DELETE)

3xx — Redirection
  301 Moved Permanently → Resource URL changed forever
  304 Not Modified      → Cache is still fresh

4xx — Client Errors (your fault, caller)
  400 Bad Request     → Malformed request body/params
  401 Unauthorized    → Not authenticated (who are you?)
  403 Forbidden       → Authenticated but not allowed (you can't do this)
  404 Not Found       → Resource doesn't exist
  409 Conflict        → State conflict (duplicate, version mismatch)
  422 Unprocessable   → Valid JSON but invalid data (email format wrong)
  429 Too Many Requests → Rate limited

5xx — Server Errors (our fault)
  500 Internal Server Error → Something broke
  502 Bad Gateway           → Upstream service failed
  503 Service Unavailable   → Overloaded or in maintenance
  504 Gateway Timeout       → Upstream didn't respond in time
```

### REST for a Social Media App

```
Users:
  GET    /api/v1/users/:id          → Get user profile
  PATCH  /api/v1/users/:id          → Update profile
  DELETE /api/v1/users/:id          → Delete account

Posts:
  GET    /api/v1/posts              → List posts (with pagination)
  POST   /api/v1/posts              → Create a post
  GET    /api/v1/posts/:id          → Get single post
  PUT    /api/v1/posts/:id          → Replace post
  DELETE /api/v1/posts/:id          → Delete post

Relationships:
  GET    /api/v1/users/:id/followers    → List followers
  POST   /api/v1/users/:id/follow      → Follow a user
  DELETE /api/v1/users/:id/follow      → Unfollow a user

Feed:
  GET    /api/v1/feed                   → Get personalized feed
```

### HATEOAS: Hypermedia as the Engine of Application State

The idea: API responses include links to related actions. The client doesn't
hardcode URLs — it discovers them from the response.

```json
{
  "id": 42,
  "name": "Alice",
  "email": "alice@example.com",
  "_links": {
    "self":      { "href": "/api/v1/users/42" },
    "posts":     { "href": "/api/v1/users/42/posts" },
    "followers": { "href": "/api/v1/users/42/followers" },
    "follow":    { "href": "/api/v1/users/42/follow", "method": "POST" }
  }
}
```

Think of HATEOAS like a website — you don't memorize every URL, you follow
links. In practice, most APIs skip full HATEOAS because clients are usually
tightly coupled to the API anyway. But pagination links (`next`, `prev`) are
the one piece of HATEOAS that everyone actually uses.

### REST Trade-Offs

```
Strengths                          Weaknesses
─────────────────────────────────  ─────────────────────────────────
Simple, well-understood            Over-fetching (get 20 fields,
HTTP native (caching, CDNs)          need 3)
Stateless                         Under-fetching (need 3 requests
Huge ecosystem                      to build one screen)
Browser-friendly                  No standard query language
Easy to cache with HTTP headers   Versioning is painful
```

---

## GraphQL: Query Exactly What You Need

GraphQL is a query language for your API. Instead of the server deciding what
fields to return, the client specifies exactly what it needs.

### Schema-First Design

GraphQL starts with a schema — a typed contract between client and server.

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  bio: String
  posts(first: Int, after: String): PostConnection!
  followers: [User!]!
  followersCount: Int!
}

type Post {
  id: ID!
  content: String!
  author: User!
  likes: Int!
  comments(first: Int): [Comment!]!
  createdAt: DateTime!
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}

type Query {
  user(id: ID!): User
  feed(first: Int, after: String): PostConnection!
  post(id: ID!): Post
}

type Mutation {
  createPost(content: String!): Post!
  followUser(userId: ID!): User!
  likePost(postId: ID!): Post!
}
```

### The Client Controls the Shape

```graphql
query {
  user(id: "42") {
    name
    bio
    posts(first: 5) {
      edges {
        node {
          content
          likes
          createdAt
        }
      }
    }
  }
}
```

One request. Exactly the fields you need. No over-fetching, no under-fetching.
Compare this to REST where you'd need:

```
GET /users/42           → Get name and bio
GET /users/42/posts     → Get posts (returns ALL fields per post)
```

### The N+1 Problem

The biggest trap in GraphQL. Imagine this query:

```graphql
query {
  feed(first: 20) {
    edges {
      node {
        content
        author {         # ← This triggers a DB query per post
          name
          avatar
        }
      }
    }
  }
}
```

Without optimization, the server executes:

```
1 query  → fetch 20 posts
20 queries → fetch author for each post (one per post!)
─────────
21 total queries
```

The fix is **DataLoader** — a batching utility that collects all the author
IDs from the 20 posts and fetches them in a single query:

```
1 query → fetch 20 posts
1 query → fetch all 20 authors at once (WHERE id IN (...))
─────────
2 total queries
```

```typescript
import DataLoader from "dataloader";

const userLoader = new DataLoader(async (userIds: readonly string[]) => {
  const users = await db.query(
    "SELECT * FROM users WHERE id = ANY($1)",
    [userIds]
  );

  const userMap = new Map(users.map((u) => [u.id, u]));
  return userIds.map((id) => userMap.get(id) ?? new Error(`User ${id} not found`));
});

const resolvers = {
  Post: {
    author: (post: Post) => userLoader.load(post.authorId),
  },
};
```

### When GraphQL Shines

- **Mobile apps** with limited bandwidth (fetch exactly what the screen needs)
- **Multiple client types** (web gets more data, watch app gets minimal)
- **Rapid frontend iteration** (frontend changes queries without backend changes)
- **Complex nested data** (user → posts → comments → replies)

### When GraphQL Hurts

- **Simple CRUD APIs** — REST is simpler
- **File uploads** — awkward in GraphQL
- **Caching** — HTTP caching doesn't work (every request is POST to /graphql)
- **Rate limiting** — hard to cost a query before executing it

---

## gRPC: Fast, Typed, Internal Communication

gRPC uses Protocol Buffers (protobuf) for serialization and HTTP/2 for
transport. It's designed for service-to-service communication where
performance and type safety matter more than browser compatibility.

### Protobuf Definition

```protobuf
syntax = "proto3";
package social;

service SocialService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreatePost(CreatePostRequest) returns (Post);
  rpc GetFeed(FeedRequest) returns (stream Post);  // Server streaming
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);  // Bidirectional
}

message GetUserRequest {
  string user_id = 1;
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
  int32 followers_count = 4;
}

message CreatePostRequest {
  string content = 1;
  repeated string media_urls = 2;
}

message Post {
  string id = 1;
  string author_id = 2;
  string content = 3;
  int64 created_at = 4;
  int32 likes = 5;
}

message FeedRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message ChatMessage {
  string sender_id = 1;
  string content = 2;
  int64 timestamp = 3;
}
```

### gRPC Communication Patterns

```
┌─────────────────────────────────────────────────────┐
│              gRPC Communication Patterns             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Unary (simple request-response)                  │
│     Client ──request──> Server                       │
│     Client <──response── Server                      │
│                                                      │
│  2. Server Streaming (one request, many responses)   │
│     Client ──request──> Server                       │
│     Client <──response── Server                      │
│     Client <──response── Server                      │
│     Client <──response── Server                      │
│                                                      │
│  3. Client Streaming (many requests, one response)   │
│     Client ──request──> Server                       │
│     Client ──request──> Server                       │
│     Client ──request──> Server                       │
│     Client <──response── Server                      │
│                                                      │
│  4. Bidirectional Streaming (many-to-many)           │
│     Client ──request──> Server                       │
│     Client <──response── Server                      │
│     Client ──request──> Server                       │
│     Client <──response── Server                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### When to Use gRPC

- **Internal microservice communication** — type-safe, fast, code-generated
- **Streaming data** — stock prices, live feeds, chat
- **Polyglot services** — generate clients for Go, TypeScript, Python, Rust
- **Service mesh** — Istio and Linkerd speak gRPC natively

### When NOT to Use gRPC

- **Browser clients** — requires gRPC-Web proxy (extra complexity)
- **Simple REST CRUD** — overkill for basic APIs
- **Public-facing APIs** — REST/GraphQL are more developer-friendly
- **Quick prototyping** — the .proto → codegen → build cycle is heavier

### gRPC in a Service Mesh

```
                    ┌─────────────────────────┐
                    │       Istio / Linkerd    │
                    │    (Control Plane)       │
                    └────────┬────────────────┘
                             │ Config
                    ┌────────▼────────────────┐
     ┌──────────────┤    Envoy Sidecar Proxy  ├──────────────┐
     │              └─────────────────────────┘              │
     │                                                       │
┌────▼─────┐  gRPC   ┌─────────────┐  gRPC   ┌─────────────▼┐
│ User     │────────> │ Post        │────────> │ Feed         │
│ Service  │         │ Service     │         │ Service      │
└──────────┘         └─────────────┘         └──────────────┘
     │                     │                       │
     │  Each service has   │                       │
     │  an Envoy sidecar   │                       │
     │  that handles:      │                       │
     │  - mTLS             │                       │
     │  - Load balancing   │                       │
     │  - Retry logic      │                       │
     │  - Observability    │                       │
```

---

## Webhooks: Push vs Poll

Sometimes your system needs to notify another system when something happens.
Two approaches:

### Polling (Pull)

```
Client: "Any new notifications?"  → Server: "No."
Client: "Any new notifications?"  → Server: "No."
Client: "Any new notifications?"  → Server: "No."
Client: "Any new notifications?"  → Server: "Yes, here's one!"

Problem: Wasted requests. Most return nothing.
```

### Webhooks (Push)

```
Client: "Here's my URL. Call me when something happens."
  ...time passes...
Server: POST https://client.com/webhook/payments
        { "event": "payment.completed", "data": { ... } }

Problem: Client must be reachable. What if it's down?
```

### Webhook Design for the Social Media App

```
POST /api/v1/webhooks
{
  "url": "https://partner.com/hooks/social",
  "events": ["post.created", "user.followed", "post.liked"],
  "secret": "whsec_abc123..."
}
```

The server signs every webhook payload so the receiver can verify authenticity:

```go
package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"
)

type Payload struct {
	Event     string    `json:"event"`
	Data      any       `json:"data"`
	Timestamp time.Time `json:"timestamp"`
	ID        string    `json:"id"`
}

func Send(url, secret string, payload Payload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	signature := hex.EncodeToString(mac.Sum(nil))

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Signature", signature)
	req.Header.Set("X-Webhook-ID", payload.ID)
	req.Header.Set("X-Webhook-Timestamp", payload.Timestamp.Format(time.RFC3339))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook delivery failed: status %d", resp.StatusCode)
	}

	return nil
}
```

### Webhook Reliability

Webhooks fail. The receiver might be down, slow, or return errors. You need:

```
┌────────────────────────────────────────────────┐
│           Webhook Delivery Pipeline             │
│                                                 │
│  Event ──> Queue ──> Deliver ──> Success?       │
│                         │                       │
│                         ├── Yes ──> Done         │
│                         │                       │
│                         └── No ──> Retry Queue   │
│                                      │          │
│                              ┌───────▼───────┐  │
│                              │ Retry with    │  │
│                              │ exponential   │  │
│                              │ backoff:      │  │
│                              │  1s, 5s, 30s, │  │
│                              │  5m, 30m, 2h  │  │
│                              └───────────────┘  │
│                                                 │
│  After N failures ──> Mark endpoint as dead     │
│                       Notify the owner          │
└────────────────────────────────────────────────┘
```

---

## API Versioning

Your API will change. How do you avoid breaking existing clients?

### Strategy 1: URL Path Versioning

```
GET /api/v1/users/42
GET /api/v2/users/42
```

**Pros:** Obvious, easy to route, easy to test.
**Cons:** URL changes break bookmarks. Feels like a different resource.

This is the most common approach. GitHub, Stripe, and Twilio use it.

### Strategy 2: Header Versioning

```
GET /api/users/42
Accept: application/vnd.social.v2+json
```

**Pros:** Clean URLs. Resource identity doesn't change.
**Cons:** Harder to test (can't just paste a URL). Easy to forget the header.

### Strategy 3: Query Parameter

```
GET /api/users/42?version=2
```

**Pros:** Easy to add.
**Cons:** Pollutes query string. Optional params are easy to forget.

### Which to Use?

```
┌──────────────────┬─────────────────────┬─────────────────┐
│  Strategy        │  Best For           │  Used By        │
├──────────────────┼─────────────────────┼─────────────────┤
│  URL path        │  Public APIs        │  Stripe, GitHub │
│  Header          │  Internal APIs      │  Azure          │
│  Query param     │  Quick experiments  │  Google Maps    │
└──────────────────┴─────────────────────┴─────────────────┘

Rule of thumb: URL path for public APIs. Header for internal.
Query param if you must, but it's the weakest option.
```

---

## Pagination: Cursor vs Offset

Every list endpoint needs pagination. There are two main strategies.

### Offset-Based Pagination

```
GET /api/v1/posts?offset=20&limit=10

"Give me 10 posts, starting from position 20."
```

```sql
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 20;
```

**The problem:** If a new post is inserted while the user is paginating,
posts shift positions. Page 3 might show a post that was already on page 2.
Also, large offsets are slow — the database still scans and discards rows.

### Cursor-Based Pagination

```
GET /api/v1/posts?after=post_abc123&limit=10

"Give me 10 posts created after post_abc123."
```

```sql
SELECT * FROM posts
WHERE created_at < (SELECT created_at FROM posts WHERE id = 'post_abc123')
ORDER BY created_at DESC
LIMIT 10;
```

The cursor is typically an opaque, base64-encoded value:

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNC0wMS0xNVQxMDozMDowMFoiLCJpZCI6InBvc3RfYWJjMTIzIn0=",
    "has_more": true
  }
}
```

### Cursor vs Offset Trade-Offs

```
┌─────────────────┬──────────────────────┬──────────────────────┐
│                 │  Offset              │  Cursor              │
├─────────────────┼──────────────────────┼──────────────────────┤
│  Performance    │  Degrades at high    │  Constant O(1) seek  │
│                 │  offsets             │  with proper index    │
│  Consistency    │  Items can shift     │  Stable — always     │
│                 │  between pages       │  picks up where left │
│  Jump to page   │  Easy (offset=N*10)  │  Not possible        │
│  Implementation │  Simple              │  More complex        │
│  Best for       │  Admin dashboards,   │  Infinite scroll,    │
│                 │  small datasets      │  feeds, real-time    │
└─────────────────┴──────────────────────┴──────────────────────┘
```

---

## Idempotency Keys

Network requests fail. Clients retry. Without idempotency, a retry might
create a duplicate payment, duplicate post, or duplicate order.

An idempotency key lets the server recognize a retry and return the original
result instead of executing the operation again.

```
POST /api/v1/posts
Idempotency-Key: req_8f14e45f-ceea-367f-a27f-c790

{
  "content": "Hello world!"
}
```

The server's logic:

```
┌──────────────────────────────────────────────┐
│  Receive request with idempotency key        │
│                                              │
│  Key exists in cache/DB?                     │
│    ├── Yes → Return cached response          │
│    └── No  → Execute operation               │
│              Store result with key            │
│              Return response                 │
│                                              │
│  Keys expire after 24-48 hours typically     │
└──────────────────────────────────────────────┘
```

```go
func CreatePost(w http.ResponseWriter, r *http.Request) {
	idempotencyKey := r.Header.Get("Idempotency-Key")
	if idempotencyKey == "" {
		http.Error(w, "Idempotency-Key header required", http.StatusBadRequest)
		return
	}

	cached, err := redis.Get(ctx, "idem:"+idempotencyKey).Bytes()
	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Idempotent-Replayed", "true")
		w.Write(cached)
		return
	}

	post, err := db.CreatePost(r.Context(), parsePostRequest(r))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response, _ := json.Marshal(post)
	redis.Set(ctx, "idem:"+idempotencyKey, response, 24*time.Hour)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	w.Write(response)
}
```

---

## Rate Limiting Headers

When your API rate limits a client, tell them what's happening:

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100          ← Max requests per window
X-RateLimit-Remaining: 67       ← Requests left in this window
X-RateLimit-Reset: 1705312800   ← Unix timestamp when window resets

HTTP/1.1 429 Too Many Requests
Retry-After: 30                 ← Seconds to wait before retrying
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705312800
```

Good clients read these headers and back off. Bad clients ignore them and
get blocked. Your API should handle both.

---

## OpenAPI / Swagger

OpenAPI is a specification for describing REST APIs in YAML/JSON. It's the
blueprint that generates documentation, client SDKs, and server stubs.

```yaml
openapi: 3.0.3
info:
  title: Social Media API
  version: 1.0.0

paths:
  /api/v1/posts:
    get:
      summary: List posts
      parameters:
        - name: after
          in: query
          schema:
            type: string
          description: Cursor for pagination
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        "200":
          description: A list of posts
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Post"
                  pagination:
                    $ref: "#/components/schemas/Pagination"

    post:
      summary: Create a post
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [content]
              properties:
                content:
                  type: string
                  maxLength: 280
      responses:
        "201":
          description: Post created
        "429":
          description: Rate limited

components:
  schemas:
    Post:
      type: object
      properties:
        id:
          type: string
        content:
          type: string
        author_id:
          type: string
        likes:
          type: integer
        created_at:
          type: string
          format: date-time

    Pagination:
      type: object
      properties:
        next_cursor:
          type: string
        has_more:
          type: boolean
```

From this spec you get:
- **Auto-generated docs** (Swagger UI, Redoc)
- **Client SDKs** (openapi-generator for TypeScript, Go, Python, etc.)
- **Server stubs** (generate route handlers from the spec)
- **Validation** (ensure request/response matches the schema)
- **Testing** (Postman can import OpenAPI specs directly)

---

## Choosing the Right API Style

```
┌─────────────────────────────────────────────────────────────────┐
│                   API Style Decision Tree                       │
│                                                                 │
│  Who is the consumer?                                           │
│  ├── External developers / public API                           │
│  │   └── REST with OpenAPI                                      │
│  │       (familiar, cacheable, well-tooled)                     │
│  │                                                              │
│  ├── Your own frontend (web + mobile)                           │
│  │   ├── Many different screens with different data needs?      │
│  │   │   └── GraphQL                                            │
│  │   │       (one endpoint, flexible queries)                   │
│  │   └── Simple CRUD with few screens?                          │
│  │       └── REST                                               │
│  │                                                              │
│  └── Internal microservices                                     │
│      ├── Need streaming or high throughput?                     │
│      │   └── gRPC                                               │
│      │       (binary, typed, streaming built-in)                │
│      └── Simple service-to-service calls?                       │
│          └── REST or gRPC (team preference)                     │
│                                                                 │
│  Need to notify external systems of events?                     │
│  └── Webhooks (push) with polling fallback                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary: The Quick Reference

| Dimension | REST | GraphQL | gRPC |
|-----------|------|---------|------|
| Format | JSON | JSON | Protobuf (binary) |
| Transport | HTTP/1.1 | HTTP/1.1 (POST) | HTTP/2 |
| Caching | HTTP cache headers | Custom (Apollo) | No built-in |
| Schema | OpenAPI (optional) | Required (SDL) | Required (.proto) |
| Streaming | SSE, WebSocket | Subscriptions | Native streaming |
| Browser | Native | Native | Needs gRPC-Web |
| Learning curve | Low | Medium | Medium-High |
| Best for | Public APIs | Flexible frontends | Internal services |

The best APIs aren't about choosing the trendiest technology. They're about
making life easy for the consumer. A well-designed REST API beats a poorly
designed GraphQL API every time. Start with the consumer's needs and work
backward.
