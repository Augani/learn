# Lesson 09: Consistent Hashing — Distributing Data Evenly

You have 5 cache servers and millions of keys to distribute among them.
How do you decide which server holds which key? And when you add a 6th
server or one crashes, how do you avoid reshuffling everything?

This is the problem consistent hashing solves.

---

## The Problem: Distributing Data Across Nodes

Imagine you run a web app with 3 Redis cache servers. When a user
requests their profile, you need to check the cache first. But which
cache server has their data?

```
┌──────────┐
│  Client  │──── "Get user:42" ──── Which server?
└──────────┘
                    ┌──────────────┐
                    │  Cache #0    │
                    ├──────────────┤
                    │  Cache #1    │   ← Is user:42 here?
                    ├──────────────┤
                    │  Cache #2    │
                    └──────────────┘
```

You need a deterministic function: given a key, always return the same
server. And ideally, distribute keys evenly.

---

## The Naive Approach: Modulo Hashing

The simplest solution: hash the key and take modulo N (number of servers).

```
server = hash(key) % N
```

With 3 servers:

```
hash("user:42")  = 7823741  →  7823741 % 3 = 1  →  Cache #1
hash("user:99")  = 2918374  →  2918374 % 3 = 2  →  Cache #2
hash("user:200") = 5541002  →  5541002 % 3 = 1  →  Cache #1
hash("user:7")   = 1203847  →  1203847 % 3 = 1  →  Cache #1
hash("user:55")  = 9982710  →  9982710 % 3 = 0  →  Cache #0
```

This works perfectly — until a server is added or removed.

### When N changes, everything breaks

Let's say you add a 4th cache server. Now N = 4 instead of 3.

```
BEFORE (N=3):                    AFTER (N=4):
hash("user:42")  % 3 = 1        hash("user:42")  % 4 = 1  ← same
hash("user:99")  % 3 = 2        hash("user:99")  % 4 = 2  ← same
hash("user:200") % 3 = 1        hash("user:200") % 4 = 2  ← MOVED
hash("user:7")   % 3 = 1        hash("user:7")   % 4 = 3  ← MOVED
hash("user:55")  % 3 = 0        hash("user:55")  % 4 = 2  ← MOVED
```

60% of keys mapped to different servers. For those keys, the cache is
now cold — requests go to the database, causing a **cache stampede**.

With millions of keys and hundreds of servers, adding a single node
remaps ~(N-1)/N of all keys. Add a server to a 100-node cluster and
99% of keys are disrupted.

```
Nodes changed:  1 added (or removed)
Keys disrupted: ~75% with 4 nodes
                ~90% with 10 nodes
                ~99% with 100 nodes

This is catastrophic for cache hit rates.
```

---

## Consistent Hashing: The Hash Ring

Consistent hashing solves this by making the number of disrupted keys
proportional to the number of changed nodes, not the total data.

### The analogy: Assigned seating at a round table

Imagine a round dinner table with seats. Guests are assigned to the
nearest empty seat clockwise from their name card position. When a new
guest arrives, they take a seat and only their immediate neighbors need
to adjust — everyone else stays put.

### How it works

**Step 1**: Map both servers AND keys onto a circular hash space (the
"ring"). The ring goes from 0 to 2^32 - 1 (the output range of a hash
function like SHA-256).

```
                    0 / 2^32
                      │
                ╔═════╧═════╗
            ╔═══╝           ╚═══╗
          ╔═╝     Server A       ╚═╗
         ║    (hash("ServerA"))    ║
        ╔╝                          ╚╗
        ║                            ║
       ║          THE RING            ║
        ║                            ║
        ╚╗   Server C               ╔╝
         ║  (hash("ServerC"))      ║
          ╚═╗                    ╔═╝
            ╚═══╗  Server B  ═══╝
                ╚════╤═════╝
                     │
```

**Step 2**: To find which server owns a key, hash the key and walk
clockwise around the ring until you hit a server.

```
                    0
                    │
               ╔════╧════╗
           ╔═══╝         ╚═══╗
         ╔═╝    A              ╚═╗
        ╔╝                       ╚╗
       ║   key4 •                  ║
       ║              • key1       ║
       ║                           ║
       ║                    B      ║
        ╚╗  • key3               ╔╝
         ║                     ║
          ╚═╗   C   • key2  ╔═╝
            ╚═══╗        ═══╝
                ╚════╤════╝
                     │

key1 → walks clockwise → hits B → stored on Server B
key2 → walks clockwise → hits C → stored on Server C
key3 → walks clockwise → hits C → stored on Server C
key4 → walks clockwise → hits A → stored on Server A
```

### When a node is added

New server D is placed on the ring. Only keys between D's predecessor
and D need to move. Everything else stays put.

```
              BEFORE                        AFTER adding D

         A                              A
        ╱ ╲                            ╱ ╲
      ╱     ╲                        ╱     ╲
    ╱    •k1  ╲                    ╱    •k1  ╲
   │           B                  │       D    B
   │    •k4     │                 │  •k4 ↑      │
   │            │                 │      │      │
    ╲   •k3   ╱                    ╲   •k3   ╱
      ╲     ╱                        ╲     ╱
        ╲ ╱                            ╲ ╱
         C                              C

Only k4 moves (from A to D).
k1, k2, k3 stay on their current servers.
```

**Keys moved**: only ~K/N (where K = total keys, N = total nodes).
Adding a node to a 100-node cluster moves ~1% of keys instead of 99%.

### When a node is removed

If Server B goes down, only B's keys need to move — they go to the next
server clockwise. All other keys are unaffected.

```
Server B goes down:
- B's keys move to C (next clockwise)
- A's keys: unchanged
- C's keys: unchanged (plus gains B's old keys)

Keys moved: ~K/N (about 1/N of total keys)
```

---

## Virtual Nodes: Solving Uneven Distribution

With only 3 real nodes on the ring, the arcs between them are likely
unequal. One server might own 60% of the ring while another owns 10%.

```
BAD distribution with 3 nodes:

         A ─────────────────── B
         │                     │   A owns a tiny arc
         │                     │   C owns a HUGE arc
         │                     │
         └─────── C ───────────┘
```

**Solution**: Give each physical server multiple positions on the ring.
These are called **virtual nodes** (vnodes). Instead of placing "Server A"
once, place "Server A-0", "Server A-1", "Server A-2", ... "Server A-99"
at 100 different positions.

```
With virtual nodes (3 servers, 6 vnodes each):

               A2    B1
              ╱        ╲
          C0 ╱          ╲ A0
            │            │
          B2│            │C1
            │            │
          A1 ╲          ╱ B0
              ╲        ╱
               C2    A0

Much more even distribution.
Each server's vnodes are spread across the ring.
```

### Why virtual nodes work

With more points on the ring, the law of large numbers kicks in. The
variance in load decreases as the number of vnodes increases:

```
Vnodes per server │ Load variance
──────────────────┼──────────────
        1         │   Very high (one server might get 60%)
       10         │   High (±20%)
       50         │   Moderate (±10%)
      100         │   Low (±5%)
      200         │   Very low (±2%)
```

100-200 vnodes per physical server is a common default.

### Other benefits of vnodes

**Proportional allocation**: A more powerful server can get more vnodes,
receiving proportionally more data and traffic.

**Smoother rebalancing**: When a node leaves, its vnodes are scattered
across the ring, so its data gets distributed across many nodes rather
than all landing on one neighbor.

---

## Implementation in Go

```go
package chash

import (
	"hash/crc32"
	"sort"
	"strconv"
	"sync"
)

type Ring struct {
	mu       sync.RWMutex
	nodes    map[uint32]string
	sorted   []uint32
	vnodes   int
	members  map[string]bool
}

func New(vnodes int) *Ring {
	if vnodes <= 0 {
		vnodes = 100
	}
	return &Ring{
		nodes:   make(map[uint32]string),
		vnodes:  vnodes,
		members: make(map[string]bool),
	}
}

func (r *Ring) hashKey(key string) uint32 {
	return crc32.ChecksumIEEE([]byte(key))
}

func (r *Ring) Add(node string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.members[node] {
		return
	}
	r.members[node] = true

	for i := 0; i < r.vnodes; i++ {
		vkey := node + ":" + strconv.Itoa(i)
		hash := r.hashKey(vkey)
		r.nodes[hash] = node
		r.sorted = append(r.sorted, hash)
	}

	sort.Slice(r.sorted, func(i, j int) bool {
		return r.sorted[i] < r.sorted[j]
	})
}

func (r *Ring) Remove(node string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.members[node] {
		return
	}
	delete(r.members, node)

	for i := 0; i < r.vnodes; i++ {
		vkey := node + ":" + strconv.Itoa(i)
		hash := r.hashKey(vkey)
		delete(r.nodes, hash)
	}

	newSorted := make([]uint32, 0, len(r.sorted)-r.vnodes)
	for _, h := range r.sorted {
		if _, exists := r.nodes[h]; exists {
			newSorted = append(newSorted, h)
		}
	}
	r.sorted = newSorted
}

func (r *Ring) Get(key string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if len(r.sorted) == 0 {
		return ""
	}

	hash := r.hashKey(key)
	idx := sort.Search(len(r.sorted), func(i int) bool {
		return r.sorted[i] >= hash
	})

	if idx >= len(r.sorted) {
		idx = 0
	}

	return r.nodes[r.sorted[idx]]
}

func (r *Ring) Members() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	members := make([]string, 0, len(r.members))
	for node := range r.members {
		members = append(members, node)
	}
	return members
}
```

### Using the ring

```go
func main() {
	ring := chash.New(150)

	ring.Add("cache-1.internal:6379")
	ring.Add("cache-2.internal:6379")
	ring.Add("cache-3.internal:6379")

	server := ring.Get("user:42")
	fmt.Printf("user:42 → %s\n", server)

	server = ring.Get("session:abc-def")
	fmt.Printf("session:abc-def → %s\n", server)

	ring.Add("cache-4.internal:6379")

	serverAfter := ring.Get("user:42")
	fmt.Printf("user:42 after adding node → %s\n", serverAfter)
}
```

### Testing distribution

```go
func TestDistribution(t *testing.T) {
	ring := chash.New(150)
	ring.Add("node-a")
	ring.Add("node-b")
	ring.Add("node-c")

	counts := make(map[string]int)
	total := 100_000

	for i := 0; i < total; i++ {
		key := fmt.Sprintf("key:%d", i)
		node := ring.Get(key)
		counts[node]++
	}

	expected := total / 3
	tolerance := float64(expected) * 0.10

	for node, count := range counts {
		diff := math.Abs(float64(count) - float64(expected))
		if diff > tolerance {
			t.Errorf("node %s: got %d keys, expected ~%d (±%.0f)",
				node, count, expected, tolerance)
		}
		t.Logf("node %s: %d keys (%.1f%%)", node, count,
			float64(count)/float64(total)*100)
	}
}
```

---

## How Consistent Hashing Handles Replication

In production systems, data isn't stored on just one node. It's
replicated to the next N-1 nodes clockwise on the ring (where N is the
replication factor).

```
Replication factor = 3
Key hashes to position P on the ring

    ╔════════════════════════╗
    ║                        ║
    ║    Node A              ║
    ║        ↑               ║
    ║        │ walks to      ║
    ║     •──┘ P             ║
    ║   (key)                ║
    ║              Node B    ║  ← replica 1 (next clockwise)
    ║                        ║
    ║         Node C         ║  ← replica 2 (next after B)
    ║                        ║
    ╚════════════════════════╝

Key is stored on: Node A (primary), Node B (replica), Node C (replica)
```

When Node A goes down, reads can be served from B or C. When A recovers,
it syncs from B or C.

---

## Real-World Systems Using Consistent Hashing

### Amazon DynamoDB

DynamoDB uses consistent hashing to distribute partition keys across
storage nodes. Each partition key maps to a position on the ring, and
data is replicated to 3 nodes.

### Apache Cassandra

Cassandra assigns each node a token range on the hash ring. When you
write data, the partition key is hashed and routed to the node owning
that token range. Virtual nodes (vnodes) are enabled by default
(num_tokens = 256).

### CDNs (Content Delivery Networks)

CDNs use consistent hashing to decide which edge server caches which
content. When a user requests `image.jpg`, the CDN hashes the URL to
find the edge server. If that server has it cached, great. If not, it
fetches from origin and caches it.

### Load balancers

Some load balancers use consistent hashing for sticky sessions. Hash
the client IP or session ID to consistently route the same client to
the same backend server.

### Memcached clients

The memcached client library (not the server) uses consistent hashing
to decide which memcached server to store each key on. This is why it's
called a "client-side sharding" approach.

---

## Comparing Approaches

```
┌────────────────────┬─────────────────────┬─────────────────────┐
│                    │   Modulo Hashing    │ Consistent Hashing  │
├────────────────────┼─────────────────────┼─────────────────────┤
│ Add a node         │ ~(N-1)/N keys move  │ ~K/N keys move      │
│ Remove a node      │ ~(N-1)/N keys move  │ ~K/N keys move      │
│ Distribution       │ Even (with good     │ Even (with enough   │
│                    │  hash function)     │  virtual nodes)     │
│ Implementation     │ Trivial             │ Moderate            │
│ Lookup speed       │ O(1)               │ O(log V) binary     │
│                    │                     │  search on vnodes   │
│ Memory overhead    │ None               │ O(V × N) for ring   │
└────────────────────┴─────────────────────┴─────────────────────┘

K = total keys, N = total nodes, V = vnodes per node
```

---

## Advanced: Bounded Load Consistent Hashing

Standard consistent hashing has a problem: even with virtual nodes, some
nodes can become hotspots if certain keys get disproportionate traffic.

Google introduced **bounded load consistent hashing**: when a node is
above a load threshold (e.g., 1.25x average), the algorithm continues
walking clockwise to the next node. This provides a better balance
between consistency (same key → same node) and load distribution.

```
Regular:        key → Node A (even if A is overloaded)
Bounded load:   key → Node A (if A has capacity)
                key → Node B (if A is over threshold)
```

---

## Common Interview Pattern

**Q**: "How would you design a distributed cache?"

Use consistent hashing as the foundation:

```
┌────────────┐
│  Client    │
└─────┬──────┘
      │ 1. hash("user:42")
      ▼
┌─────────────┐
│  Hash Ring  │─── 2. find owning node
│  (client    │
│   library)  │
└─────┬───────┘
      │ 3. connect to node
      ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Node A    │     │   Node B    │     │   Node C    │
│  (cache)    │     │  (cache)    │     │  (cache)    │
└─────────────┘     └─────────────┘     └─────────────┘

4. Node stores key locally
5. Replicate to next 2 nodes on ring for fault tolerance
```

Key design points:
- Client library contains the ring logic (no central router)
- Nodes join/leave the ring via a gossip protocol or coordination
  service (ZooKeeper, etcd)
- Virtual nodes ensure even distribution
- Replication to N-1 clockwise neighbors provides fault tolerance

---

## Key Takeaways

1. **Modulo hashing breaks when nodes change.** Adding or removing a
   node remaps almost every key.

2. **Consistent hashing minimizes disruption.** Only K/N keys move when
   a node joins or leaves.

3. **The hash ring** maps both keys and nodes to positions on a circle.
   Keys are assigned to the next node clockwise.

4. **Virtual nodes** solve uneven distribution by giving each physical
   node many positions on the ring.

5. **Replication** works naturally: copy data to the next N-1 nodes
   clockwise.

6. **Used everywhere**: DynamoDB, Cassandra, CDNs, load balancers,
   memcached clients.

7. **Implementation is simple**: a sorted array of hashes + binary
   search. The concept is more important than the code.

Next: [Lesson 10 — CAP Theorem and Distributed Consensus](./10-cap-theorem.md)
