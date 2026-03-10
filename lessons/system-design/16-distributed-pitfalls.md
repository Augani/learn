# Lesson 16: Distributed Systems Pitfalls — What Goes Wrong Across the Network

Distributed systems are like a group project where every member is in a
different time zone, can only communicate by unreliable mail, and might lie
about their progress. Everything that could go wrong will go wrong — and
the failure modes are creative in ways you've never imagined.

This lesson covers the assumptions that will betray you, the problems
that have no perfect solutions, and the patterns that keep your system
running despite all of it.

---

## The 8 Fallacies of Distributed Computing

In 1994, Peter Deutsch (and later James Gosling) listed assumptions that
developers new to distributed systems always make — and that always turn
out to be wrong.

```
┌─────────────────────────────────────────────────────────┐
│         THE 8 FALLACIES                                  │
│                                                          │
│  1. The network is reliable                              │
│  2. Latency is zero                                      │
│  3. Bandwidth is infinite                                │
│  4. The network is secure                                │
│  5. Topology doesn't change                              │
│  6. There is one administrator                           │
│  7. Transport cost is zero                               │
│  8. The network is homogeneous                           │
│                                                          │
│  Every fallacy you believe becomes a production outage   │
│  you'll experience.                                      │
└─────────────────────────────────────────────────────────┘
```

### Fallacy 1: The Network Is Reliable

This is the big one. In a monolith, function calls always succeed (barring
bugs). In distributed systems, the network between services can and will:

- Drop packets silently
- Deliver packets out of order
- Duplicate packets
- Corrupt packets
- Partition entirely (Service A can reach Service C, but not Service B)
- Work fine for 364 days then fail spectacularly on the 365th

```
What you expect:
  Service A ──request──> Service B ──response──> Service A

What actually happens (sometimes):
  Service A ──request──> ???
  Service A: ...waiting...
  Service A: ...still waiting...
  Service A: Did the request arrive? Did B process it? Is B dead?
             Is the network dead? Did B respond but the response got lost?
```

**The critical question:** When a network call times out, you don't know
if the operation happened or not. The server might have processed your
request and the response was lost. Or the request never arrived. You
genuinely cannot tell the difference.

### Fallacy 2: Latency Is Zero

A function call within a process takes nanoseconds. A network call to a
service in the same data center takes milliseconds. Across regions, it
takes tens of milliseconds. Every service-to-service call adds latency
that compounds.

```
┌──────────────────────────────────────────────────────┐
│              LATENCY CHAIN                            │
│                                                      │
│  API Gateway ──> Auth Service ──> User Service       │
│     2ms            5ms              3ms              │
│                                                      │
│  User Service ──> Post Service ──> Feed Service      │
│                       4ms              6ms           │
│                                                      │
│  Total: 2 + 5 + 3 + 4 + 6 = 20ms minimum            │
│  Plus: serialization, TLS, DNS, load balancer        │
│  Real-world: 50-100ms for a "simple" request          │
│                                                      │
│  In a monolith: the same logic runs in ~1ms          │
└──────────────────────────────────────────────────────┘
```

### Fallacy 3: Bandwidth Is Infinite

Sending a 10KB JSON payload between two services is fine. Sending 10MB
responses 10,000 times per second is not. Internal APIs often over-fetch,
returning entire objects when the caller needs two fields. In a monolith
this is free (same memory space). Across the network, every byte costs.

---

## Network Partitions

A network partition is when two parts of your system can't talk to each
other, even though both are running fine.

```
┌──────────────────────────────────────────────────────────┐
│                 NETWORK PARTITION                          │
│                                                          │
│  ┌──────────────────┐      X      ┌──────────────────┐   │
│  │  Data Center A   │    BREAK    │  Data Center B   │   │
│  │                  │             │                  │   │
│  │  Service 1 ✓     │  ╳╳╳╳╳╳╳╳  │  Service 3 ✓     │   │
│  │  Service 2 ✓     │  network    │  Service 4 ✓     │   │
│  │  DB Replica A ✓  │  cable cut  │  DB Replica B ✓  │   │
│  │                  │             │                  │   │
│  └──────────────────┘             └──────────────────┘   │
│                                                          │
│  Both sides are healthy. Both accept writes.             │
│  When the partition heals, which writes win?             │
└──────────────────────────────────────────────────────────┘
```

Partitions happen more than you think: a misconfigured firewall rule,
a failed router, a botched network upgrade, a cloud provider AZ issue.

This is why the CAP theorem matters: during a partition, you must choose
between consistency (reject writes to prevent conflicts) and availability
(accept writes and resolve conflicts later).

---

## Clock Skew: Why You Can't Trust Timestamps

In your Go or TypeScript application, `time.Now()` or `Date.now()` gives
you the wall clock time. Across multiple machines, these clocks are NOT
synchronized — they drift apart.

```
┌──────────────────────────────────────────────────────────┐
│                  CLOCK SKEW                               │
│                                                          │
│  Machine A's clock: 10:00:00.000                         │
│  Machine B's clock: 10:00:00.347  (347ms ahead)          │
│  Machine C's clock: 09:59:59.891  (109ms behind)          │
│                                                          │
│  Event happens on A at 10:00:00.100                      │
│  Event happens on B at 10:00:00.050                      │
│                                                          │
│  By A's clock: A happened first (10:00:00.100)           │
│  By B's clock: B happened first (10:00:00.050)            │
│  In reality:   B happened first (it was 347ms ahead)     │
│                                                          │
│  Timestamps CANNOT determine ordering across machines.   │
└──────────────────────────────────────────────────────────┘
```

### NTP: Necessary but Not Sufficient

NTP (Network Time Protocol) synchronizes clocks, but only to within
milliseconds. Google's Spanner uses atomic clocks and GPS receivers
to get clock uncertainty down to microseconds — and even then, they
explicitly model the uncertainty bounds.

For most systems, NTP drift of 10-100ms is normal. This means:

- **Don't use wall clock timestamps to determine event ordering across services**
- **Don't use timestamp comparison for distributed locks**
- **Don't rely on "happened before" based on timestamps alone**

### Lamport Timestamps

A logical clock that doesn't try to measure real time. Instead, it
tracks the causal order of events — if event A could have influenced
event B, Lamport timestamps guarantee A's timestamp is lower.

```
┌──────────────────────────────────────────────────────────┐
│               LAMPORT TIMESTAMPS                          │
│                                                          │
│  Rules:                                                  │
│  1. Each process has a counter, starts at 0               │
│  2. Before any event, increment the counter              │
│  3. When sending a message, include your counter         │
│  4. When receiving, set counter = max(yours, theirs) + 1 │
│                                                          │
│  Process A          Process B         Process C          │
│  ─────────          ─────────         ─────────          │
│  (1) send ────────> (2) receive                          │
│                     (3) work                             │
│                     (4) send ──────> (5) receive          │
│  (6) work                            (7) send ──> A      │
│  (8) receive <──────────────────────────────────┘        │
│                                                          │
│  We know: event 1 → 2 → 3 → 4 → 5 → 7 → 8             │
│  We DON'T know: order of (6) vs (3) vs (5)              │
│  (concurrent events — no causal relationship)            │
└──────────────────────────────────────────────────────────┘
```

### Vector Clocks

An extension of Lamport timestamps. Each process maintains a vector of
counters (one per process). Vector clocks can detect concurrent events
that Lamport timestamps cannot.

```
Process A: [A:1, B:0, C:0]  → sends to B
Process B: [A:1, B:1, C:0]  → receives, merges, increments own
Process B: [A:1, B:2, C:0]  → does work, increments own
Process C: [A:0, B:0, C:1]  → does work independently

Can we order B's [A:1, B:2, C:0] vs C's [A:0, B:0, C:1]?
  B > C on A and B dimensions, but C > B on C dimension.
  → They are CONCURRENT. Neither happened before the other.
```

Vector clocks are used in systems like Amazon's Dynamo to detect conflicting
writes and prompt conflict resolution.

---

## Split Brain Problem

When a cluster loses communication between its members, both sides might
think they're the leader. This is "split brain."

```
┌──────────────────────────────────────────────────────────┐
│                   SPLIT BRAIN                             │
│                                                          │
│  Before partition:                                       │
│  ┌────────┐    ┌────────┐    ┌────────┐                  │
│  │ Node A │◄──►│ Node B │◄──►│ Node C │                  │
│  │ LEADER │    │Follower│    │Follower│                  │
│  └────────┘    └────────┘    └────────┘                  │
│                                                          │
│  After partition:                                        │
│  ┌────────┐    ┌────────┐ ╳╳ ┌────────┐                  │
│  │ Node A │◄──►│ Node B │    │ Node C │                  │
│  │ LEADER │    │Follower│    │ LEADER │ ← elected itself  │
│  └────────┘    └────────┘    └────────┘                  │
│                                                          │
│  Now BOTH A and C accept writes.                         │
│  When the partition heals: conflicting data.             │
└──────────────────────────────────────────────────────────┘
```

**Solution: quorum-based consensus.** Require a majority of nodes to agree
before accepting a write. With 3 nodes, you need 2 to agree. In the split
above, the {A, B} side has a quorum (2 out of 3). Node C alone does not.
C should reject writes until it can reach the others.

This is what Raft and Paxos consensus algorithms do — they guarantee that
only one leader exists at any time, even during partitions.

---

## The Two Generals' Problem

The fundamental impossibility result that explains why distributed systems
are hard.

```
┌──────────────────────────────────────────────────────────┐
│              THE TWO GENERALS' PROBLEM                    │
│                                                          │
│  Two armies on opposite hills must attack simultaneously. │
│  They can only communicate by messenger through enemy     │
│  territory (unreliable channel).                          │
│                                                          │
│  General A: "Attack at dawn"                              │
│       ──messenger──>                                     │
│  General B: "Got it, I'll attack at dawn"                 │
│       <──messenger──                                     │
│  General A: "Good, confirmed"                             │
│       ──messenger──>                                     │
│  General B: "Did A get my confirmation?"                  │
│  ...                                                     │
│                                                          │
│  Neither general can ever be CERTAIN the other will       │
│  attack. Each confirmation needs its own confirmation.    │
│  It's turtles all the way down.                          │
│                                                          │
│  PROVEN IMPOSSIBLE: No protocol using unreliable          │
│  messages can guarantee both sides reach agreement.       │
└──────────────────────────────────────────────────────────┘
```

**Real-world impact:** You cannot guarantee that two services both commit
or both abort a distributed transaction using only network messages. This
is why distributed transactions are so hard, and why most systems settle
for eventual consistency.

---

## Idempotency: Why Every Operation Should Be Safe to Retry

Given that networks are unreliable and clients will retry, every operation
should be safe to execute multiple times.

```
┌──────────────────────────────────────────────────────────┐
│               WHY IDEMPOTENCY MATTERS                     │
│                                                          │
│  Client sends: "Transfer $100 from A to B"               │
│  Server processes it: ✓                                  │
│  Response gets lost in the network: ✗                    │
│  Client doesn't know if it worked                        │
│  Client retries: "Transfer $100 from A to B"             │
│                                                          │
│  Without idempotency: $200 transferred (DOUBLE CHARGE!)  │
│  With idempotency: server recognizes the retry,          │
│                    returns the original result            │
└──────────────────────────────────────────────────────────┘
```

### Idempotency Key Pattern in Go

```go
package idempotency

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

var ErrConflict = errors.New("request already in progress")

type StoredResult struct {
	StatusCode int
	Body       []byte
	CreatedAt  time.Time
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Execute(
	ctx context.Context,
	key string,
	fn func(ctx context.Context) (int, any, error),
) (int, []byte, error) {
	existing, err := s.getExisting(ctx, key)
	if err == nil {
		return existing.StatusCode, existing.Body, nil
	}

	locked, err := s.tryLock(ctx, key)
	if err != nil {
		return 0, nil, fmt.Errorf("lock failed: %w", err)
	}
	if !locked {
		return 0, nil, ErrConflict
	}
	defer s.unlock(ctx, key)

	statusCode, result, execErr := fn(ctx)

	body, _ := json.Marshal(result)

	if execErr == nil {
		s.storeResult(ctx, key, statusCode, body)
	}

	if execErr != nil {
		return 0, nil, execErr
	}

	return statusCode, body, nil
}

func (s *Store) getExisting(ctx context.Context, key string) (*StoredResult, error) {
	var result StoredResult
	err := s.db.QueryRowContext(ctx,
		"SELECT status_code, body, created_at FROM idempotency_keys WHERE key = $1 AND created_at > $2",
		key, time.Now().Add(-24*time.Hour),
	).Scan(&result.StatusCode, &result.Body, &result.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Store) tryLock(ctx context.Context, key string) (bool, error) {
	_, err := s.db.ExecContext(ctx,
		"INSERT INTO idempotency_keys (key, status, created_at) VALUES ($1, 'processing', $2) ON CONFLICT DO NOTHING",
		key, time.Now(),
	)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) storeResult(ctx context.Context, key string, statusCode int, body []byte) {
	s.db.ExecContext(ctx,
		"UPDATE idempotency_keys SET status = 'complete', status_code = $1, body = $2 WHERE key = $3",
		statusCode, body, key,
	)
}

func (s *Store) unlock(ctx context.Context, key string) {
	s.db.ExecContext(ctx,
		"DELETE FROM idempotency_keys WHERE key = $1 AND status = 'processing'",
		key,
	)
}
```

### Using the Idempotency Store

```go
func (h *Handler) TransferMoney(w http.ResponseWriter, r *http.Request) {
	idempotencyKey := r.Header.Get("Idempotency-Key")
	if idempotencyKey == "" {
		http.Error(w, "Idempotency-Key required", http.StatusBadRequest)
		return
	}

	var req TransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	statusCode, body, err := h.idempotencyStore.Execute(
		r.Context(),
		idempotencyKey,
		func(ctx context.Context) (int, any, error) {
			result, err := h.transferService.Execute(ctx, req)
			if err != nil {
				return 500, nil, err
			}
			return 200, result, nil
		},
	)

	if errors.Is(err, idempotency.ErrConflict) {
		http.Error(w, "Request already in progress", http.StatusConflict)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(body)
}
```

### Idempotency in TypeScript

```typescript
import { Redis } from "ioredis";

interface IdempotencyResult<T> {
  statusCode: number;
  body: T;
  replayed: boolean;
}

async function withIdempotency<T>(
  redis: Redis,
  key: string,
  ttlSeconds: number,
  fn: () => Promise<{ statusCode: number; body: T }>
): Promise<IdempotencyResult<T>> {
  const cacheKey = `idempotency:${key}`;

  const existing = await redis.get(cacheKey);
  if (existing) {
    const parsed = JSON.parse(existing);
    return { ...parsed, replayed: true };
  }

  const locked = await redis.set(cacheKey, "processing", "EX", 30, "NX");
  if (!locked) {
    throw new Error("Request already in progress");
  }

  try {
    const result = await fn();
    const stored = { statusCode: result.statusCode, body: result.body };
    await redis.set(cacheKey, JSON.stringify(stored), "EX", ttlSeconds);
    return { ...stored, replayed: false };
  } catch (error) {
    await redis.del(cacheKey);
    throw error;
  }
}
```

---

## Exactly-Once Delivery Is (Almost) Impossible

Three delivery guarantees:

```
┌──────────────────────────────────────────────────────────┐
│            MESSAGE DELIVERY GUARANTEES                     │
│                                                          │
│  At-most-once:  Send and forget. Message might be lost.  │
│                 Simple. Used when loss is acceptable.     │
│                 Example: metrics, analytics events        │
│                                                          │
│  At-least-once: Retry until acknowledged. Message might  │
│                 be delivered multiple times.              │
│                 Example: most event-driven systems        │
│                                                          │
│  Exactly-once:  Each message processed exactly one time. │
│                 EXTREMELY hard to achieve in practice.    │
│                 Requires: idempotent consumers +          │
│                 at-least-once delivery + deduplication    │
│                                                          │
│  In practice: at-least-once + idempotent processing      │
│  = effectively exactly-once (good enough for everyone)   │
└──────────────────────────────────────────────────────────┘
```

Why exactly-once is almost impossible:

1. Producer sends message to broker. Broker stores it. Ack gets lost.
   Producer retries. Broker now has two copies.
2. Consumer processes message. Sends ack to broker. Ack gets lost.
   Broker resends. Consumer processes it again.

The only real solution is making every consumer idempotent — processing
the same message twice has the same effect as processing it once. This
pushes exactly-once semantics from the infrastructure into the application.

```
┌──────────────────────────────────────────────────────────┐
│         EFFECTIVELY EXACTLY-ONCE                          │
│                                                          │
│  Producer ──> Message Queue ──> Consumer                  │
│                  │                 │                      │
│                  │  at-least-once  │  idempotent          │
│                  │  delivery       │  processing          │
│                  │                 │                      │
│                  │                 ├─ Check: have I       │
│                  │                 │  processed this      │
│                  │                 │  message ID before?  │
│                  │                 │                      │
│                  │                 ├─ Yes → skip (ack)    │
│                  │                 └─ No  → process,      │
│                  │                         store ID,      │
│                  │                         ack            │
└──────────────────────────────────────────────────────────┘
```

---

## Byzantine Fault Tolerance (Brief)

Most distributed systems assume nodes are honest but might crash.
Byzantine fault tolerance handles nodes that might actively lie or
send conflicting information to different peers.

```
Normal fault: "I'm dead." (crash-stop)
Byzantine fault: "I'm alive and the answer is 42."
                 (to another node: "The answer is 99.")
```

**Where it matters:**
- Blockchain networks (nodes are untrusted by design)
- Safety-critical systems (aerospace, medical devices)
- Multi-party computation

**Where it doesn't matter:**
- Your typical web application
- Internal microservices (you control all nodes)
- Most databases

BFT requires 3f+1 nodes to tolerate f faulty nodes (compared to 2f+1 for
crash faults). The overhead is high, which is why most systems don't use it.

---

## Practical Patterns for Surviving Distributed Systems

### Pattern 1: Timeouts on Everything

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

resp, err := httpClient.Do(req.WithContext(ctx))
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        // Handle timeout — DON'T assume the operation failed
        // It might have succeeded and the response was lost
    }
}
```

### Pattern 2: Circuit Breaker

Stop calling a service that's failing. Give it time to recover.

```
┌──────────────────────────────────────────────────────────┐
│                CIRCUIT BREAKER                            │
│                                                          │
│  States:                                                 │
│                                                          │
│  CLOSED ──(failures exceed threshold)──> OPEN            │
│    │                                       │             │
│    │                              (timer expires)        │
│    │                                       │             │
│    │                                       ▼             │
│    │                                   HALF-OPEN         │
│    │                                    │     │          │
│    │                            (success) (failure)      │
│    │                                │          │         │
│    ◄────────────────────────────────┘          │         │
│                                                ▼         │
│                                              OPEN        │
│                                                          │
│  CLOSED: requests flow normally                          │
│  OPEN: all requests fail immediately (no network call)   │
│  HALF-OPEN: let ONE request through to test recovery     │
└──────────────────────────────────────────────────────────┘
```

### Pattern 3: Retry with Idempotency

Always pair retries with idempotency. Retrying a non-idempotent operation
is dangerous — you might create duplicate charges, send duplicate emails,
or insert duplicate records.

```
Safe to retry:
  GET  /users/42              (reads are always idempotent)
  PUT  /users/42  {name: "A"} (replaces entire resource)
  DELETE /users/42            (deleting twice = same as once)

NOT safe to retry (without idempotency key):
  POST /payments {amount: 100}  (could charge twice!)
  POST /emails   {to: "..."}   (could send twice!)
  POST /orders   {items: [...]} (could create two orders!)

Safe with idempotency key:
  POST /payments
  Idempotency-Key: req_abc123
  {amount: 100}
  → Server checks: already processed req_abc123? Return cached result.
```

### Pattern 4: Compensating Transactions (Sagas)

When you can't use distributed transactions, use a saga: a sequence of
local transactions with compensating actions for rollback.

```
┌──────────────────────────────────────────────────────────┐
│                    SAGA PATTERN                           │
│                                                          │
│  Book a trip: flight + hotel + car rental                 │
│                                                          │
│  Step 1: Reserve flight    ← Compensate: Cancel flight   │
│  Step 2: Reserve hotel     ← Compensate: Cancel hotel    │
│  Step 3: Reserve car       ← Compensate: Cancel car      │
│                                                          │
│  If Step 3 fails:                                        │
│    Run compensations in reverse:                         │
│    Cancel hotel (undo step 2)                            │
│    Cancel flight (undo step 1)                           │
│                                                          │
│  NOT a real transaction — there's a window where          │
│  flight is booked but hotel isn't. But it's the          │
│  best we can do across independent services.             │
└──────────────────────────────────────────────────────────┘
```

---

## The Practical Checklist

Before deploying a distributed system, ask yourself:

```
┌─────────────────────────────────────────────────────────┐
│          DISTRIBUTED SYSTEMS CHECKLIST                    │
│                                                          │
│  □ Every network call has a timeout                      │
│  □ Every write operation is idempotent (or has an        │
│    idempotency key)                                      │
│  □ Retries use exponential backoff with jitter           │
│  □ Circuit breakers protect against cascading failures   │
│  □ No business logic depends on wall clock ordering      │
│    across machines                                       │
│  □ Every service can handle receiving duplicate messages  │
│  □ Graceful degradation — what happens when each         │
│    dependency is unavailable?                            │
│  □ Health checks and liveness probes on every service    │
│  □ Distributed tracing to follow requests across         │
│    service boundaries                                    │
│  □ Alerts on error rates, not just individual errors     │
│                                                          │
│  If you can check all of these, your distributed system  │
│  won't be perfect — but it will survive most of what     │
│  the network throws at it.                               │
└─────────────────────────────────────────────────────────┘
```
