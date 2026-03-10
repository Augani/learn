# Lesson 15: Microservices vs Monoliths — The Real Trade-Offs

Every few years the industry swings between "monoliths are dead" and
"microservices were a mistake." The truth is neither architecture is
universally better. The right choice depends on your team size, your
operational maturity, and how well you understand your domain boundaries.
This lesson cuts through the hype and gives you the real trade-offs.

---

## The Food Analogy

**A monolith is like one big restaurant.** One kitchen, one menu, every chef
can reach every ingredient. Need to add a new dish? Walk to the right shelf
and grab what you need. Communication is instant — just yell across the
kitchen. But if the stove breaks, the entire restaurant shuts down. And as
the menu grows to 500 items, chefs start bumping into each other.

**Microservices is like a food court.** Each stall is independent — the
sushi place, the pizza place, the taco place. Each manages their own
ingredients, their own staff, their own hours. If the pizza oven breaks, you
can still get sushi. But ordering a multi-course meal across stalls is
harder — someone has to coordinate timing, and the sushi might arrive cold
while you're waiting for the tacos.

---

## The Monolith

A monolith is a single deployable unit. All your code — user management,
billing, notifications, feed generation — lives in one repository, one
process, one deployment pipeline.

```
┌─────────────────────────────────────────────────┐
│                  MONOLITH                        │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Users   │ │  Posts   │ │  Notifications   │ │
│  │  Module  │ │  Module  │ │  Module          │ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │             │               │            │
│       └─────────────┼───────────────┘            │
│                     │                            │
│              ┌──────▼──────┐                     │
│              │  Shared DB  │                     │
│              └─────────────┘                     │
│                                                  │
│  One process. One deploy. Function calls between │
│  modules. Shared database. Shared memory.        │
└─────────────────────────────────────────────────┘
```

### Monolith Strengths

**Simple development.** One repo, one build, one test suite. A new developer
clones the repo and can run the entire application locally.

**Function calls, not network calls.** Calling another module is a function
call — nanoseconds, type-checked, no serialization, no network failure modes.
Compare this to a network call: milliseconds, can fail, needs retry logic,
needs serialization.

```
Monolith:  userService.GetUser(42)         → ~100ns, always succeeds
Microservice: http.Get("user-service/42")  → ~5ms, might fail, might timeout
```

**Easy data consistency.** One database means you can use transactions across
all your data. Transfer money between two accounts? One transaction. In
microservices, that's a distributed transaction nightmare.

**Simple debugging.** One process means one set of logs, one debugger session,
one stack trace that shows the full request path.

### Monolith Weaknesses

**Scaling is all-or-nothing.** If the image processing module needs 10x more
CPU but the user module is fine, you still scale the entire application.

**Deployment coupling.** One broken module blocks the deployment of everything.
A bug in notifications prevents shipping a fix to billing.

**Team coupling.** As teams grow, merge conflicts increase. Everyone touches
the same codebase. Coordinating 50 developers on one repo requires discipline.

**Technology lock-in.** The whole application uses one language, one framework,
one version. Want to try Rust for the hot path? You'd have to rewrite
everything or create messy FFI boundaries.

---

## Microservices

Microservices decompose the application into small, independently deployable
services. Each owns its own data, its own codebase, and its own deployment
pipeline.

```
┌────────────────────────────────────────────────────────────┐
│                     MICROSERVICES                           │
│                                                            │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐      │
│  │  Users   │    │  Posts   │    │  Notifications   │      │
│  │  Service │    │  Service │    │  Service         │      │
│  └────┬─────┘    └────┬─────┘    └────────┬─────────┘      │
│       │               │                   │                │
│  ┌────▼─────┐    ┌────▼─────┐    ┌────────▼─────────┐      │
│  │ Users DB │    │ Posts DB │    │ Notifications DB │      │
│  └──────────┘    └──────────┘    └──────────────────┘      │
│                                                            │
│  Separate processes. Network calls between services.       │
│  Each service owns its data. Independent deploys.          │
└────────────────────────────────────────────────────────────┘
```

### Microservices Strengths

**Independent deployment.** Ship the user service without touching
notifications. Deploy 10 times a day per service without coordinating
with other teams.

**Independent scaling.** The feed service needs 20 instances during peak
hours but the settings service needs one. Scale each independently.

**Team autonomy.** The notifications team owns their service end-to-end:
code, tests, deployment, on-call. No merge conflicts with the billing team.

**Technology flexibility.** Write the ML recommendation service in Python,
the real-time chat in Go, the admin dashboard in TypeScript. Each team picks
the best tool for their problem.

**Fault isolation.** If the notification service crashes, users can still
browse posts and update profiles. The blast radius of any failure is limited
to one service (if designed correctly).

### Microservices Weaknesses (The REAL Ones)

This is where most "intro to microservices" content falls short. The
weaknesses are not theoretical — they're the reason experienced engineers
often choose monoliths.

#### 1. Network Calls Replace Function Calls

```
┌────────────────────────────────────────────────────┐
│           FUNCTION CALL vs NETWORK CALL             │
│                                                     │
│  Monolith:                                          │
│    result = userModule.GetProfile(42)               │
│    Latency: ~100ns                                  │
│    Failure modes: none (same process)               │
│    Serialization: none                              │
│                                                     │
│  Microservice:                                      │
│    result = httpClient.Get("user-svc/users/42")     │
│    Latency: 1-50ms                                  │
│    Failure modes:                                   │
│      - Network timeout                              │
│      - DNS resolution failure                       │
│      - Service is down                              │
│      - Service is overloaded                        │
│      - Response is corrupted                        │
│      - TLS handshake failure                        │
│      - Load balancer routing error                  │
│    Serialization: JSON encode → transmit → decode   │
└────────────────────────────────────────────────────┘
```

Every inter-service call needs: timeout handling, retry logic, circuit
breaking, fallback behavior, and observability. Multiply that by every
service-to-service interaction in your system.

#### 2. Distributed Transactions

In a monolith, creating a post and notifying followers is one transaction:

```go
tx, _ := db.Begin()
tx.Exec("INSERT INTO posts ...")
tx.Exec("INSERT INTO notifications ...")
tx.Commit()
```

In microservices, this becomes a distributed coordination problem:

```
Post Service: creates the post     ← succeeds
     │
     ▼ (sends event)
Notification Service: creates notifications  ← fails!

Now what? The post exists but nobody was notified.
Do you roll back the post? How? It's in a different service's database.
```

Solutions exist (sagas, event sourcing, eventual consistency) but they're
dramatically more complex than a database transaction.

#### 3. Data Consistency

Each service owns its data. But what if the feed service needs user profile
data? It can't join across databases. Options:

```
Option A: API Call
  Feed service calls User service for every request.
  Problem: latency, coupling, what if User service is down?

Option B: Data Duplication
  Feed service keeps a copy of user data.
  Problem: data can be stale. How do you sync updates?

Option C: Event-Driven
  User service publishes "user.updated" events.
  Feed service consumes them and updates its local copy.
  Problem: eventual consistency. For a brief window, data is stale.
```

None of these are as simple as a SQL JOIN.

#### 4. Operational Complexity

```
Monolith ops:                    Microservice ops:
─────────────                    ─────────────────
1 repo                          20+ repos
1 CI pipeline                   20+ CI pipelines
1 deployment                    20+ deployments
1 set of logs                   20+ log streams (need aggregation)
1 database to back up           20+ databases to back up
1 thing to monitor              20+ dashboards
1 on-call rotation              Cross-service incident debugging
```

You need: container orchestration (Kubernetes), service discovery,
centralized logging, distributed tracing, service mesh, secrets management,
and a team that knows how to operate all of it.

#### 5. Debugging

A single request in a microservices system might touch 7 services. When it
fails, which service was the problem? You need distributed tracing (Jaeger,
Zipkin) to follow a request across service boundaries. In a monolith, it's
one stack trace.

---

## Conway's Law

> "Organizations which design systems are constrained to produce designs
> which are copies of the communication structures of these organizations."
> — Melvin Conway, 1967

This isn't just an observation — it's a natural law of software engineering.

```
┌────────────────────────────────────────────────────────┐
│                  CONWAY'S LAW                           │
│                                                        │
│  Team structure:          System architecture:         │
│                                                        │
│  ┌──────────────┐         ┌──────────────┐             │
│  │ One big team │   →     │  Monolith    │             │
│  └──────────────┘         └──────────────┘             │
│                                                        │
│  ┌──────┐ ┌──────┐        ┌──────┐ ┌──────┐           │
│  │Team A│ │Team B│   →    │Svc A │ │Svc B │           │
│  └──────┘ └──────┘        └──────┘ └──────┘           │
│                                                        │
│  The reverse is also true — if you want microservices, │
│  you need independent teams. Microservices with one    │
│  team is all the complexity with none of the benefits. │
└────────────────────────────────────────────────────────┘
```

If you have 3 developers, microservices will slow you down. If you have 30
developers across 6 teams, microservices let each team move independently.

---

## The Modular Monolith: The Middle Ground

What if you could have the simplicity of a monolith with the clean
boundaries of microservices?

```
┌─────────────────────────────────────────────────────┐
│               MODULAR MONOLITH                       │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Users   │  │  Posts   │  │  Notifications   │   │
│  │  Module  │  │  Module  │  │  Module          │   │
│  ├──────────┤  ├──────────┤  ├──────────────────┤   │
│  │  Public  │  │  Public  │  │  Public          │   │
│  │  API     │  │  API     │  │  API             │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │                │              │
│  Modules communicate ONLY through public APIs.       │
│  No reaching into another module's internals.        │
│  No shared database tables across modules.           │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Users     │  │Posts     │  │Notifications     │   │
│  │ tables   │  │ tables   │  │ tables           │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                      │
│  Same database, but each module owns its tables.     │
│  No cross-module JOINs. Feels like microservices     │
│  but deploys as one unit.                            │
└─────────────────────────────────────────────────────┘
```

### Modular Monolith in Go

```go
package main

import (
	"myapp/modules/notifications"
	"myapp/modules/posts"
	"myapp/modules/users"
)

func main() {
	db := connectDB()

	userModule := users.New(db)
	postModule := posts.New(db, userModule)
	notifModule := notifications.New(db, userModule)

	router := setupRouter(userModule, postModule, notifModule)
	router.ListenAndServe(":8080")
}
```

Each module exposes only a public interface:

```go
package users

type Module struct {
	repo *repository
}

func New(db *sql.DB) *Module {
	return &Module{repo: newRepository(db)}
}

func (m *Module) GetUser(ctx context.Context, id string) (User, error) {
	return m.repo.findByID(ctx, id)
}

func (m *Module) ListFollowers(ctx context.Context, userID string) ([]User, error) {
	return m.repo.findFollowers(ctx, userID)
}
```

The posts module cannot access users' internal repository, SQL queries, or
database tables directly. It can only call the public `Module` methods.
This is the same boundary a microservice would enforce, but without
the network.

### Why Modular Monolith Works

1. **Start fast** — no distributed systems complexity
2. **Enforce boundaries** — modules can't reach into each other's internals
3. **Easy to extract** — when a module needs to become its own service,
   the boundary is already clean. Replace the function call with an HTTP/gRPC
   call and move the module to its own repo.
4. **Transactions still work** — same database means ACID across modules
5. **One deploy** — but modules are independently testable

---

## The Monolith-First Approach

Martin Fowler's advice (and the experience of most successful companies):

```
┌─────────────────────────────────────────────────────────┐
│              THE MONOLITH-FIRST APPROACH                  │
│                                                          │
│  Phase 1: Start with a monolith                          │
│    - You don't know your domain boundaries yet            │
│    - Small team, fast iteration                          │
│    - Ship the product, find product-market fit            │
│                                                          │
│  Phase 2: Modular monolith                               │
│    - Establish clear module boundaries                   │
│    - Each module owns its tables                         │
│    - Communicate through public APIs only                │
│    - Team starts growing                                 │
│                                                          │
│  Phase 3: Extract services (only where it helps)         │
│    - The feed service needs separate scaling             │
│    - The ML recommendation team wants to use Python      │
│    - The payment module needs different SLA              │
│    - Extract ONLY the modules that need independence     │
│                                                          │
│  Most companies never need Phase 3 for all modules.      │
│  Shopify runs one of the world's largest monoliths.      │
│  Many modules are fine staying in the monolith forever.  │
└─────────────────────────────────────────────────────────┘
```

---

## Service Decomposition Example

Let's say you're building the social media app and have outgrown the
monolith. How do you decide what becomes a service?

### Step 1: Identify Domain Boundaries

```
┌────────────────────────────────────────────────────┐
│              DOMAIN BOUNDARIES                      │
│                                                     │
│  ┌───────────────┐  ┌───────────────┐               │
│  │ User Identity │  │ Social Graph  │               │
│  │ - signup      │  │ - follow      │               │
│  │ - login       │  │ - unfollow    │               │
│  │ - profile     │  │ - block       │               │
│  │ - settings    │  │ - suggest     │               │
│  └───────────────┘  └───────────────┘               │
│                                                     │
│  ┌───────────────┐  ┌───────────────┐               │
│  │ Content       │  │ Feed          │               │
│  │ - create post │  │ - generate    │               │
│  │ - edit post   │  │ - rank        │               │
│  │ - delete post │  │ - paginate    │               │
│  │ - media       │  │ - cache       │               │
│  └───────────────┘  └───────────────┘               │
│                                                     │
│  ┌───────────────┐  ┌───────────────┐               │
│  │ Notifications │  │ Search        │               │
│  │ - push        │  │ - index       │               │
│  │ - email       │  │ - query       │               │
│  │ - in-app      │  │ - autocomplete│               │
│  └───────────────┘  └───────────────┘               │
└────────────────────────────────────────────────────┘
```

### Step 2: Determine What NEEDS to Be Separate

Ask these questions for each boundary:

```
┌─────────────────────────────────────────────────────────┐
│  Does this module need...          │  Extract?          │
├─────────────────────────────────────┼────────────────────┤
│  Different scaling characteristics  │  Strong signal     │
│  A different team to own it        │  Strong signal     │
│  A different technology stack      │  Strong signal     │
│  A different deployment cadence    │  Moderate signal   │
│  A different SLA                   │  Moderate signal   │
│  Its own data isolation            │  Moderate signal   │
│  None of the above                 │  Keep in monolith  │
└─────────────────────────────────────┴────────────────────┘
```

### Step 3: The Resulting Architecture

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                    API Gateway                              │
│                       │                                    │
│        ┌──────────────┼──────────────┐                     │
│        │              │              │                     │
│        ▼              ▼              ▼                     │
│   ┌─────────┐   ┌──────────┐   ┌──────────┐               │
│   │ Core    │   │ Feed     │   │ Search   │               │
│   │ Mono-   │   │ Service  │   │ Service  │               │
│   │ lith    │   │ (Go)     │   │ (Go +    │               │
│   │         │   │          │   │ Elastic) │               │
│   │ Users   │   │ Ranking  │   │          │               │
│   │ Posts   │   │ Caching  │   │ Indexing │               │
│   │ Social  │   │ Fanout   │   │ Query    │               │
│   │ Notif.  │   │          │   │          │               │
│   └────┬────┘   └────┬─────┘   └────┬─────┘               │
│        │             │              │                      │
│   ┌────▼────┐   ┌────▼─────┐   ┌────▼──────┐              │
│   │Postgres │   │ Redis +  │   │Elastic-   │              │
│   │         │   │ Postgres │   │search     │              │
│   └─────────┘   └──────────┘   └───────────┘              │
│                                                            │
│   Core stays monolithic — it's simpler.                    │
│   Feed is extracted — needs separate scaling and caching.  │
│   Search is extracted — needs Elasticsearch, different     │
│   indexing pipeline, different team.                       │
└────────────────────────────────────────────────────────────┘
```

Notice: we didn't extract everything. Users, Posts, Social Graph, and
Notifications stayed in the core monolith because they don't need
independent scaling or different technology.

---

## Service Mesh

When you have many microservices, you need infrastructure to handle:
service discovery, load balancing, TLS encryption, retries, circuit
breaking, and observability. A service mesh handles all of this at the
infrastructure level so your application code doesn't have to.

```
┌────────────────────────────────────────────────────────────┐
│                    SERVICE MESH                             │
│                                                            │
│  ┌────────────────────────────────────────────┐            │
│  │            Control Plane (Istio/Linkerd)   │            │
│  │  - Configuration                           │            │
│  │  - Certificate management                  │            │
│  │  - Policy enforcement                      │            │
│  └────────────────────────────────────────────┘            │
│          │                │                │               │
│          ▼                ▼                ▼               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │       │
│  │ │ Service  │ │ │ │ Service  │ │ │ │ Service  │ │       │
│  │ │    A     │ │ │ │    B     │ │ │ │    C     │ │       │
│  │ └────┬─────┘ │ │ └────┬─────┘ │ │ └────┬─────┘ │       │
│  │ ┌────▼─────┐ │ │ ┌────▼─────┐ │ │ ┌────▼─────┐ │       │
│  │ │ Sidecar  │ │ │ │ Sidecar  │ │ │ │ Sidecar  │ │       │
│  │ │ Proxy    │◄├─┤►│ Proxy    │◄├─┤►│ Proxy    │ │       │
│  │ │ (Envoy)  │ │ │ │ (Envoy)  │ │ │ │ (Envoy)  │ │       │
│  │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │       │
│  │    Pod A     │ │    Pod B     │ │    Pod C     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                            │
│  The sidecar proxy intercepts ALL network traffic.         │
│  Your service code just makes normal HTTP/gRPC calls.      │
│  The proxy adds mTLS, retries, load balancing, metrics.    │
└────────────────────────────────────────────────────────────┘
```

**Istio** is the most popular (and most complex). **Linkerd** is simpler
and lighter. Both deploy an Envoy sidecar proxy alongside every service pod.

You need a service mesh when:
- You have 10+ microservices
- You need mutual TLS between all services
- You want consistent retry/timeout policies without changing application code
- You need traffic splitting for canary deployments

---

## When to Migrate from Monolith to Microservices

```
┌───────────────────────────────────────────────────────────┐
│  MIGRATE when:                    STAY when:              │
├───────────────────────────────────┼───────────────────────┤
│  Team > 20 engineers              │ Team < 10 engineers   │
│  Deploy takes hours               │ Deploy takes minutes  │
│  One module's scaling blocks all  │ Uniform load          │
│  Teams block each other on PRs    │ One team, fast PRs    │
│  Different modules need different │ One tech stack works  │
│  tech stacks                      │                       │
│  You have the ops team to run K8s │ Ops is 1-2 people     │
│  Domain boundaries are well       │ Still figuring out    │
│  understood                       │ the product           │
└───────────────────────────────────┴───────────────────────┘
```

---

## The Strangler Fig Migration Pattern

Don't rewrite the monolith from scratch. That fails almost every time.
Instead, gradually grow the new services around the old monolith, like a
strangler fig tree growing around its host.

```
┌────────────────────────────────────────────────────────────┐
│              STRANGLER FIG PATTERN                          │
│                                                            │
│  Step 1: Proxy all traffic through a gateway               │
│                                                            │
│  Client ──> Gateway ──> Monolith (everything)              │
│                                                            │
│  Step 2: Extract one service, route its traffic            │
│                                                            │
│  Client ──> Gateway ──┬──> Monolith (most things)          │
│                       └──> Feed Service (feed only)         │
│                                                            │
│  Step 3: Extract more services over months/years           │
│                                                            │
│  Client ──> Gateway ──┬──> Monolith (core)                 │
│                       ├──> Feed Service                     │
│                       ├──> Search Service                   │
│                       └──> Notification Service             │
│                                                            │
│  Step 4: (Maybe) Monolith shrinks to nothing               │
│          (Or maybe it stays — that's fine too)              │
└────────────────────────────────────────────────────────────┘
```

### Implementing the Strangler in Go (API Gateway)

```go
package gateway

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

type RouteConfig struct {
	PathPrefix string
	Target     string
}

func NewGateway(monolithURL string, overrides []RouteConfig) http.Handler {
	monolith, _ := url.Parse(monolithURL)
	monolithProxy := httputil.NewSingleHostReverseProxy(monolith)

	serviceProxies := make(map[string]*httputil.ReverseProxy)
	for _, route := range overrides {
		target, _ := url.Parse(route.Target)
		serviceProxies[route.PathPrefix] = httputil.NewSingleHostReverseProxy(target)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for prefix, proxy := range serviceProxies {
			if strings.HasPrefix(r.URL.Path, prefix) {
				proxy.ServeHTTP(w, r)
				return
			}
		}

		monolithProxy.ServeHTTP(w, r)
	})
}
```

```go
func main() {
	gateway := NewGateway("http://monolith:8080", []RouteConfig{
		{PathPrefix: "/api/v1/feed", Target: "http://feed-service:8081"},
		{PathPrefix: "/api/v1/search", Target: "http://search-service:8082"},
	})

	http.ListenAndServe(":80", gateway)
}
```

Feed and search traffic goes to the new services. Everything else goes to
the monolith. You can migrate one endpoint at a time.

---

## Summary: The Decision Framework

```
┌─────────────────────────────────────────────────────────┐
│            ARCHITECTURE DECISION FRAMEWORK               │
│                                                          │
│  "Should we use microservices?"                          │
│                                                          │
│  Ask:                                                    │
│  1. Do we have more than 3 independent teams?            │
│  2. Do different components need different scaling?       │
│  3. Do we have the ops maturity for distributed systems?  │
│  4. Are our domain boundaries well understood?            │
│  5. Is deployment coupling actively blocking us?          │
│                                                          │
│  If YES to most → Microservices (start with modular      │
│                    monolith, extract incrementally)       │
│                                                          │
│  If NO to most  → Monolith (modular if possible)         │
│                                                          │
│  If UNSURE      → Monolith. You can always extract       │
│                   later. You can never easily merge       │
│                   microservices back into a monolith.     │
│                                                          │
│  The most expensive mistake is premature decomposition.  │
│  The second most expensive is never decomposing when     │
│  you need to.                                            │
└─────────────────────────────────────────────────────────┘
```
