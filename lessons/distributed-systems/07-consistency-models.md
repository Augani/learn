# Lesson 7: Consistency Models

> You learned about CAP in the System Design track.
> Now let's explore the full spectrum of consistency — it's
> not just "strong" vs "eventual."

---

## The Analogy

**Analogy — A chain of bookstores updating their inventory system:**

Imagine you own five bookstores across the country. Each store has its own copy of the inventory database. When a book sells at Store A, that sale needs to propagate to all other stores.

- **Linearizable**: When Store A sells the last copy of a book, ALL stores immediately show "out of stock." A customer walking into Store B one second later cannot buy that book. It's as if there's one global inventory. **Cost**: every sale requires a phone call to ALL stores before confirming the purchase. Slow, but perfectly accurate.

- **Sequential**: All stores agree on the same ORDER of sales, but there might be a small delay. If Store A and Store B both sell a book at 2:00 PM, all stores will agree on who sold "first" — but that ordering might not match the actual clock times. Like a judge watching a race replay to determine the winner.

- **Causal**: If Alice buys a book at Store A, and then Alice's friend Bob (who saw Alice's purchase) tries to buy the same book at Store B, Bob must see that Alice already bought it. But Charlie at Store C, who has no connection to Alice, might still see the book as available — until the update reaches him. **Key insight**: only causally-related events need ordering.

- **Read-your-writes**: You sell a book at Store A, then immediately walk to the computer and check inventory. YOU always see the updated count. But a customer at Store B might still see the old count for a few seconds.

- **Eventual**: All stores will eventually have the same inventory. But for a while after a sale, different stores might show different stock counts. The popular books might briefly show "in stock" at Store C even though they're sold out everywhere else.

---

## The Consistency Spectrum

```
  Strongest                                    Weakest
     |                                            |
     v                                            v

  Lineariz-  Sequential  Causal   Read-your-  Eventual
  ability    Consistency Consist. Writes

     |          |          |         |           |
  "Behaves   "One       "Cause   "You see    "Replicas
   like one   global     before    your own    converge
   machine"   order"     effect"   writes"     someday"

     |          |          |         |           |
  SLOW       FAST-ish   FAST     FAST        FASTEST
  but safe              and       and good    but wild
                        practical enough
```

---

## Linearizability

The gold standard. Once a write completes, ALL subsequent
reads see that write. The system behaves as if there's
ONE copy of the data.

```
  Timeline (real time -->)

  Client A:  |--write(X=1)--|
  Client B:         |---read(X)---|  must return 1
  Client C:    |---read(X)---|       could return 0 or 1
                                     (overlaps with write)

  KEY RULE: Once ANY read returns 1, ALL future reads
  must return 1. No going back.

  Linearizable:
    C reads 0, B reads 1         OK
    C reads 1, B reads 1         OK
    B reads 1, then D reads 0    VIOLATION!
```

### How to Get It

```
  1. Single node (trivial, no fault tolerance)
  2. Consensus (Raft/Paxos) — reads go through leader
  3. Single-leader with sync replication
```

### Cost of Linearizability

```
  +----------------------------------------------+
  | CAP theorem revisited:                       |
  |                                              |
  | During a network partition, you MUST choose: |
  |                                              |
  |   CP: Linearizable but some nodes            |
  |       refuse requests (unavailable)          |
  |                                              |
  |   AP: Available but reads might return       |
  |       stale data (not linearizable)          |
  |                                              |
  | No partition? You can have both.             |
  +----------------------------------------------+
```

### Linearizability in the Real World: Why It's Expensive

**Analogy — a synchronized swimming team:**

Every swimmer must move in perfect unison. To achieve this, they must constantly watch the lead swimmer and adjust. If one swimmer can't see the lead (network partition), the whole routine stops — they can't risk being out of sync.

This is why linearizability requires consensus protocols like Raft or Paxos. Every write must be acknowledged by a majority of nodes before it's considered committed. In a 5-node cluster spread across continents:

```
Write request arrives at leader in Virginia
  → Replicate to Virginia replica:  1ms    ✓
  → Replicate to Ohio replica:      15ms   ✓  (majority achieved!)
  → Replicate to Ireland replica:   85ms   (still in flight)
  → Replicate to Tokyo replica:     150ms  (still in flight)

Client gets response after: 15ms (waited for majority)

Compare eventual consistency:
  Client gets response after: <1ms (wrote locally, replicate later)
```

That 15x latency difference is why most systems don't use linearizability for every operation. Banks use it for transfers. Social media uses eventual consistency for likes.

---

## Sequential Consistency

All operations appear in SOME total order that's
consistent with each process's local order. But this
order doesn't have to match real-time.

```
  Real time:
  Client A:  write(X=1) -------- write(X=3)
  Client B:       write(X=2) -----------

  Sequentially consistent orderings:
    X=1, X=2, X=3   (valid)
    X=2, X=1, X=3   (valid - respects A's order and B's)
    X=1, X=3, X=2   (INVALID - doesn't respect A's order)
```

Weaker than linearizable because it ignores real time.
But all nodes agree on the SAME order.

---

## Causal Consistency

Operations that are causally related must be seen in
order. Concurrent operations can be seen in any order.

```
  Alice posts: "I got the job!"
  Bob (sees Alice's post) replies: "Congrats!"

  Causal requirement:
  Everyone must see Alice's post before Bob's reply.

  Carol (independently) posts: "Nice weather today"

  Carol's post vs Alice's post? No causal link.
  Different nodes can show them in different orders.
```

### Why Causal Consistency Is Practical

```
  Linearizable:
    - Requires coordination on EVERY operation
    - Cross-datacenter latency penalty

  Causal:
    - Only tracks dependencies
    - Can be achieved without global coordination
    - Fast in multi-datacenter setups

  This is why many systems target causal consistency.
```

### Implementing Causal Consistency: Vector Clocks

**Analogy — a group of friends passing notes in class:**

Each friend keeps a tally of how many notes they've written. When they pass a note, they include their tally AND the tallies they've seen from others. This way, if Friend A's note #3 references Friend B's note #2, anyone reading A's note knows they need B's note #2 first.

```
Vector clock example with 3 nodes:

Node A sends message m1:     A=[1,0,0]
Node B receives m1:          B=[1,1,0]  (merged A's clock, incremented own)
Node B sends reply m2:       B=[1,2,0]
Node C receives m2:          C=[1,2,1]

Now Node C knows:
  m1 happened before m2 (because m2's clock includes m1's)

  Any message from Node A with clock [0,0,1] is
  CONCURRENT with m1 — no causal relationship.
```

The size of vector clocks grows with the number of nodes — which is why they work for small clusters but not for millions of clients. Systems like DynamoDB use **version vectors** (a similar but bounded concept) instead.

---

## Read-Your-Writes

A specific guarantee: after you write something, your
subsequent reads will reflect that write (but others
might not see it yet).

```
  Without read-your-writes:

  You: write(profile="new photo") --> Node A
  You: read(profile) -----------> Node B (stale!)
  You see: old photo. Confusion!

  With read-your-writes:

  Approach 1: Always read from the node you wrote to
  Approach 2: Track your last write timestamp,
              only read from replicas that are caught up
```

---

## Monotonic Reads

Once you've seen a value, you never see an older value
on subsequent reads.

```
  Without monotonic reads:

  Read 1 --> Node A --> "balance: $100" (up to date)
  Read 2 --> Node B --> "balance: $80"  (stale!)

  "Where did my $20 go?!"

  With monotonic reads:

  Stick to the same replica, or track version numbers
  and reject stale responses.
```

---

## Session Guarantees: The Practical Middle Ground

Real applications rarely need linearizability everywhere. Instead, they combine weaker guarantees per-session:

**Analogy — your personal assistant who keeps notes:**

Imagine your assistant follows you to different store locations. They keep a notebook of everything you've done. When you check inventory at any store, your assistant says "wait — you sold that book 5 minutes ago, this store hasn't caught up yet. Let me find a store that has." Your experience is consistent, even if the global system isn't.

```
Session guarantees combine:

  ┌─────────────────┐
  │ Read-your-writes │ → You see your own updates
  ├─────────────────┤
  │ Monotonic reads  │ → Time doesn't go backwards
  ├─────────────────┤
  │ Monotonic writes │ → Your writes apply in order
  ├─────────────────┤
  │ Writes-follow-   │ → Your writes reflect what
  │ reads            │   you've previously read
  └─────────────────┘

Together: "causal consistency within a session"

This is what MongoDB sessions, DynamoDB consistent reads,
and most modern databases actually provide.
```

---

## Code: Simulating Consistency Levels

```go
package main

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

type Store struct {
	mu       sync.RWMutex
	value    int
	version  int
	replicas []*Replica
}

type Replica struct {
	mu      sync.RWMutex
	value   int
	version int
	delay   time.Duration
}

func NewStore(numReplicas int) *Store {
	s := &Store{}
	for i := 0; i < numReplicas; i++ {
		s.replicas = append(s.replicas, &Replica{
			delay: time.Duration(rand.Intn(100)) * time.Millisecond,
		})
	}
	return s
}

func (s *Store) LinearizableWrite(val int) {
	s.mu.Lock()
	s.value = val
	s.version++
	v := s.version

	var wg sync.WaitGroup
	for _, r := range s.replicas {
		wg.Add(1)
		go func(replica *Replica) {
			defer wg.Done()
			time.Sleep(replica.delay)
			replica.mu.Lock()
			replica.value = val
			replica.version = v
			replica.mu.Unlock()
		}(r)
	}
	wg.Wait()
	s.mu.Unlock()
	fmt.Printf("  [linearizable] write(%d) committed to ALL replicas\n", val)
}

func (s *Store) LinearizableRead() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	fmt.Printf("  [linearizable] read() = %d\n", s.value)
	return s.value
}

func (s *Store) EventualWrite(val int) {
	s.mu.Lock()
	s.value = val
	s.version++
	v := s.version
	s.mu.Unlock()

	fmt.Printf("  [eventual] write(%d) committed to primary\n", val)

	for _, r := range s.replicas {
		go func(replica *Replica) {
			time.Sleep(replica.delay)
			replica.mu.Lock()
			replica.value = val
			replica.version = v
			replica.mu.Unlock()
		}(r)
	}
}

func (s *Store) EventualRead() int {
	r := s.replicas[rand.Intn(len(s.replicas))]
	r.mu.RLock()
	val := r.value
	r.mu.RUnlock()
	fmt.Printf("  [eventual] read() = %d (from random replica)\n", val)
	return val
}

func main() {
	fmt.Println("=== Linearizable ===")
	store := NewStore(3)
	store.LinearizableWrite(42)
	store.LinearizableRead()
	store.LinearizableRead()

	fmt.Println("\n=== Eventual Consistency ===")
	store2 := NewStore(3)
	store2.EventualWrite(42)
	store2.EventualRead()
	store2.EventualRead()
	store2.EventualRead()

	time.Sleep(200 * time.Millisecond)
	fmt.Println("\n  (after replication delay)")
	store2.EventualRead()
	store2.EventualRead()
}
```

---

## Consistency vs Performance

```
  Consistency     Coordination   Latency    Availability
  Level           Required       Impact     During Partition
  +-----------+   +----------+   +------+   +-----------+
  |Linearize  |   | Every op |   | High |   | Reduced   |
  +-----------+   +----------+   +------+   +-----------+
  |Sequential |   | Ordering |   | Med  |   | Reduced   |
  +-----------+   +----------+   +------+   +-----------+
  |Causal     |   | Tracked  |   | Low  |   | Good      |
  +-----------+   +----------+   +------+   +-----------+
  |RYW        |   | Per-user |   | Low  |   | Good      |
  +-----------+   +----------+   +------+   +-----------+
  |Eventual   |   | None     |   | None |   | Full      |
  +-----------+   +----------+   +------+   +-----------+
```

---

## What Real Systems Choose

```
  +-------------------+---------------------------+
  | System            | Default Consistency       |
  +-------------------+---------------------------+
  | Google Spanner    | Linearizable (external)   |
  | CockroachDB       | Serializable              |
  | PostgreSQL        | Serializable (configurable)|
  | Cassandra         | Tunable (quorum settings) |
  | DynamoDB          | Eventual (strong optional)|
  | MongoDB           | Causal (sessions)         |
  | Redis             | Eventual (single-leader)  |
  +-------------------+---------------------------+
```

---

## Exercises

1. **Spot the violation.** Two clients observe these
   operations. Which consistency models are violated?
   ```
   Client A: write(X=1), write(X=2)
   Client B: read(X)=2, read(X)=1
   ```

2. **Design.** A banking app needs to show account
   balances. What consistency level do you need? What
   if it's just "likes" on a social media post?

3. **Causal tracking.** How would you implement causal
   consistency using vector clocks from Lesson 3?
   Sketch the design — when does a replica apply a
   write vs. buffer it?

4. **Run the code.** Modify the eventual consistency
   example to add monotonic reads (track the last
   version seen, reject stale responses).

---

[Next: Lesson 8 — Distributed Transactions -->](08-distributed-transactions.md)
