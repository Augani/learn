# Lesson 6: Replication Strategies

> One copy is fragile. Multiple copies is reliability.
> But keeping them in sync? That's the hard part.

---

## The Analogy

**One teacher (single-leader):** One teacher writes notes
on the board. Students copy. If the teacher is absent,
class stops.

**Multiple teachers (multi-leader):** Two teachers at
different campuses teach the same class. They sync notes
at night. Conflicts happen when both cover the same topic
differently.

**Study groups (leaderless):** Students share notes
directly. No one is "in charge." When you need the latest
info, you ask several students and take the best answer.

---

## Single-Leader Replication

```
  Writes           Reads
    |                 |
    v                 v
  +--------+     +--------+     +--------+
  | Leader |---->|Follower|     |Follower|
  | (read/ |     | (read  |     | (read  |
  |  write)|     |  only) |     |  only) |
  +--------+     +--------+     +--------+
       |              ^              ^
       +--------------+--------------+
         replication stream
```

### Sync vs Async Replication

```
  Synchronous:
  Client --> Leader --> Follower --> ACK --> Leader --> Client
                                             "committed"
  Latency: HIGH (wait for follower)
  Durability: HIGH (data on multiple nodes)

  Asynchronous:
  Client --> Leader --> Client ("committed")
                  \--> Follower (eventually)
  Latency: LOW
  Durability: RISK (leader crash = data loss)

  Semi-synchronous:
  Wait for ONE follower, rest are async.
  Best of both worlds for most systems.
```

### Replication Log Formats

```
  +-------------------+----------------------------------+
  | Format            | Example                          |
  +-------------------+----------------------------------+
  | Statement-based   | "INSERT INTO t VALUES (1, 'a')"  |
  |                   | Problem: NOW(), RAND()           |
  +-------------------+----------------------------------+
  | Write-ahead log   | Byte-level: "page 5, offset 12,  |
  | (WAL)             | write 0xFF"                      |
  |                   | Problem: version-coupled         |
  +-------------------+----------------------------------+
  | Logical/row-based | "Row (id=1): set name='a'"       |
  |                   | Best: decoupled, clear           |
  +-------------------+----------------------------------+
```

---

## Multi-Leader Replication

```
  DC-West                          DC-East
  +--------+                      +--------+
  | Leader |<--- async sync ----->| Leader |
  | (read/ |                      | (read/ |
  |  write)|                      |  write)|
  +---+----+                      +---+----+
      |                               |
  +---+----+                      +---+----+
  |Follower|                      |Follower|
  +--------+                      +--------+
```

### When to Use Multi-Leader

```
  Good for:
  - Multi-datacenter deployments (local writes)
  - Offline-capable clients (phone = its own leader)
  - Collaborative editing (each user = leader)

  Bad for:
  - Strong consistency requirements
  - Simple applications that don't need it
```

### The Conflict Problem

```
  DC-West writes: SET name = "Alice"  at T=100
  DC-East writes: SET name = "Bob"    at T=100

  Both succeed locally. Replication carries both to both.
  Now what?

  +--------+    "Alice"    +--------+
  | West   |-------------->| East   |
  |"Alice" |<--------------| "Bob"  |
  +--------+    "Bob"      +--------+

  Conflict! We'll cover resolution in Lesson 10.
```

---

## Leaderless Replication

No leader. Any node can accept writes. Reads go to
multiple nodes.

```
  Client writes to N nodes, requires W acknowledgments.
  Client reads from N nodes, requires R responses.

  If W + R > N, at least one node in the read set
  has the latest write. This is a QUORUM.

  Example: N=3, W=2, R=2

  Write "X=5":
  +--------+  write  +--------+
  | Client |-------->| Node A |  ACK (1 of 2)
  |        |-------->| Node B |  ACK (2 of 2) DONE
  |        |----X--->| Node C |  failed/slow
  +--------+         +--------+

  Read X:
  +--------+  read   +--------+
  | Client |-------->| Node B |  "X=5" (1 of 2)
  |        |-------->| Node C |  "X=3" (2 of 2) stale!
  +--------+         +--------+

  Client picks the newest value: X=5
```

### Quorum Math

```
  N = total replicas
  W = write quorum
  R = read quorum

  Strict quorum:    W + R > N

  +------+------+------+----------------------------+
  | N    | W    | R    | Guarantees                 |
  +------+------+------+----------------------------+
  | 3    | 2    | 2    | Read-your-writes           |
  | 3    | 3    | 1    | Fast reads, slow writes    |
  | 3    | 1    | 3    | Fast writes, slow reads    |
  | 5    | 3    | 3    | Tolerates 2 failures       |
  +------+------+------+----------------------------+
```

### Sloppy Quorums and Hinted Handoff

When nodes are down, strict quorums block writes.
Sloppy quorums allow writes to ANY available node:

```
  Normal: write to nodes A, B, C
  Node C down: write to A, B, D (D holds hint for C)
  When C recovers: D sends hinted write to C

  +---+     +---+     +---+     +---+
  | A |     | B |     | C |     | D |
  | W |     | W |     | X |     | W |<-- hint
  +---+     +---+     +---+     +---+
                        |
                     (down)
                        |
                     (recovers)
                        |
                +---+   v   +---+
                | D |------>| C |
                +---+ hint  +---+
```

---

## Anti-Entropy and Read Repair

Two ways to converge stale replicas:

```
  Read Repair:
  Client reads from A, B, C
  A has version 5, B has version 5, C has version 3
  Client writes version 5 back to C

  Anti-Entropy (background):
  Separate process compares replicas periodically
  Syncs missing data using Merkle trees

  +---+         +---+
  | A | compare | B |
  |   |<------->|   |
  | v5|  diff?  | v3|
  +---+   yes   +---+
    |     sync    ^
    +-------------+
```

---

## Code: Quorum Read/Write

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

type VersionedValue struct {
	Value     string
	Version   int
	Timestamp time.Time
}

type Replica struct {
	mu   sync.Mutex
	id   int
	data map[string]VersionedValue
	alive bool
}

func NewReplica(id int) *Replica {
	return &Replica{
		id:    id,
		data:  make(map[string]VersionedValue),
		alive: true,
	}
}

func (r *Replica) Write(key, value string, version int) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.alive {
		return false
	}

	existing, exists := r.data[key]
	if !exists || version > existing.Version {
		r.data[key] = VersionedValue{
			Value:     value,
			Version:   version,
			Timestamp: time.Now(),
		}
	}
	return true
}

func (r *Replica) Read(key string) (VersionedValue, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.alive {
		return VersionedValue{}, false
	}

	val, exists := r.data[key]
	return val, exists
}

type QuorumClient struct {
	replicas []*Replica
	n        int
	w        int
	r        int
}

func NewQuorumClient(replicas []*Replica, w, r int) *QuorumClient {
	return &QuorumClient{
		replicas: replicas,
		n:        len(replicas),
		w:        w,
		r:        r,
	}
}

func (qc *QuorumClient) Put(key, value string, version int) error {
	acks := 0
	for _, replica := range qc.replicas {
		if replica.Write(key, value, version) {
			acks++
		}
	}

	if acks < qc.w {
		return fmt.Errorf("write quorum not met: got %d, need %d", acks, qc.w)
	}

	fmt.Printf("  PUT %s=%s (v%d) -> %d/%d acks (need %d)\n",
		key, value, version, acks, qc.n, qc.w)
	return nil
}

func (qc *QuorumClient) Get(key string) (string, error) {
	var best VersionedValue
	responses := 0
	staleReplicas := []*Replica{}

	for _, replica := range qc.replicas {
		val, ok := replica.Read(key)
		if ok {
			responses++
			if val.Version > best.Version {
				best = val
			}
		}
	}

	if responses < qc.r {
		return "", fmt.Errorf("read quorum not met: got %d, need %d", responses, qc.r)
	}

	for _, replica := range qc.replicas {
		val, ok := replica.Read(key)
		if ok && val.Version < best.Version {
			staleReplicas = append(staleReplicas, replica)
			replica.Write(key, best.Value, best.Version)
		}
	}

	if len(staleReplicas) > 0 {
		fmt.Printf("  Read repair: updated %d stale replicas\n", len(staleReplicas))
	}

	fmt.Printf("  GET %s -> %s (v%d) from %d/%d responses (need %d)\n",
		key, best.Value, best.Version, responses, qc.n, qc.r)
	return best.Value, nil
}

func main() {
	replicas := make([]*Replica, 3)
	for i := range replicas {
		replicas[i] = NewReplica(i)
	}

	client := NewQuorumClient(replicas, 2, 2)

	fmt.Println("=== Normal write and read ===")
	client.Put("name", "Alice", 1)
	client.Get("name")

	fmt.Println("\n=== Write with one replica down ===")
	replicas[2].mu.Lock()
	replicas[2].alive = false
	replicas[2].mu.Unlock()

	client.Put("name", "Bob", 2)

	fmt.Println("\n=== Replica recovers, read triggers repair ===")
	replicas[2].mu.Lock()
	replicas[2].alive = true
	replicas[2].mu.Unlock()

	client.Get("name")
}
```

---

## Strategy Comparison

```
  +------------------+----------+----------+----------+
  |                  | Single   | Multi    | Leader-  |
  |                  | Leader   | Leader   | less     |
  +------------------+----------+----------+----------+
  | Write path       | Leader   | Any      | Any      |
  |                  | only     | leader   | node     |
  +------------------+----------+----------+----------+
  | Consistency      | Strong   | Eventual | Tunable  |
  |                  | possible |          | (quorum) |
  +------------------+----------+----------+----------+
  | Write latency    | Higher   | Low      | Low      |
  |                  | (1 path) | (local)  | (W=1)    |
  +------------------+----------+----------+----------+
  | Conflict         | None     | Yes      | Yes      |
  | handling         |          |          |          |
  +------------------+----------+----------+----------+
  | Failover         | Election | Continue | Continue |
  |                  | needed   | writing  | writing  |
  +------------------+----------+----------+----------+
  | Used by          | Postgres | CouchDB  | Dynamo   |
  |                  | MySQL    | Tungsten | Cassandra|
  |                  | MongoDB  |          | Riak     |
  +------------------+----------+----------+----------+
```

---

## Exercises

1. **Quorum failure.** In a 5-node system with W=3, R=3,
   two nodes go down. Can you still read? Write? What if
   W=2, R=4?

2. **Read repair race.** Two clients read the same key
   simultaneously. Both detect stale replicas and try
   read repair. Can this cause problems? How?

3. **Design choice.** You're building a user profile
   service. Users update their profile rarely but read
   it on every page load. Single-leader, multi-leader,
   or leaderless? What quorum settings?

4. **Extend the code.** Add a version vector (instead of
   a single integer version) to support concurrent writes
   from multiple clients. Detect conflicts instead of
   silently overwriting.

---

[Next: Lesson 7 — Consistency Models -->](07-consistency-models.md)
