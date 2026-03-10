# Lesson 3: Logical Clocks Implementation

> Lesson 2 was the theory. Now we build them.

---

## The Analogy

Think of logical clocks like version numbers on a
shared document. Every time someone edits, the version
goes up. Vector clocks are like tracking WHO made
each edit and WHEN — so you can merge correctly.

---

## Vector Clock Implementation

A vector clock is a map from node IDs to counters.

```go
package main

import (
	"fmt"
	"sort"
	"strings"
)

type VectorClock map[string]uint64

func NewVectorClock() VectorClock {
	return make(VectorClock)
}

func (vc VectorClock) Tick(nodeID string) {
	vc[nodeID]++
}

func (vc VectorClock) Send(nodeID string) VectorClock {
	vc.Tick(nodeID)
	return vc.Copy()
}

func (vc VectorClock) Receive(nodeID string, remote VectorClock) {
	for k, v := range remote {
		if v > vc[k] {
			vc[k] = v
		}
	}
	vc[nodeID]++
}

func (vc VectorClock) Copy() VectorClock {
	c := NewVectorClock()
	for k, v := range vc {
		c[k] = v
	}
	return c
}

func (vc VectorClock) HappensBefore(other VectorClock) bool {
	allKeys := vc.mergeKeys(other)
	atLeastOneLess := false

	for _, k := range allKeys {
		if vc[k] > other[k] {
			return false
		}
		if vc[k] < other[k] {
			atLeastOneLess = true
		}
	}
	return atLeastOneLess
}

func (vc VectorClock) IsConcurrent(other VectorClock) bool {
	return !vc.HappensBefore(other) && !other.HappensBefore(vc) && !vc.Equals(other)
}

func (vc VectorClock) Equals(other VectorClock) bool {
	allKeys := vc.mergeKeys(other)
	for _, k := range allKeys {
		if vc[k] != other[k] {
			return false
		}
	}
	return true
}

func (vc VectorClock) mergeKeys(other VectorClock) []string {
	seen := make(map[string]bool)
	for k := range vc {
		seen[k] = true
	}
	for k := range other {
		seen[k] = true
	}
	keys := make([]string, 0, len(seen))
	for k := range seen {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func (vc VectorClock) String() string {
	keys := make([]string, 0, len(vc))
	for k := range vc {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s:%d", k, vc[k]))
	}
	return "{" + strings.Join(parts, ", ") + "}"
}

func main() {
	alice := NewVectorClock()
	bob := NewVectorClock()
	carol := NewVectorClock()

	alice.Tick("alice")
	fmt.Printf("Alice local event:   %s\n", alice)

	msgFromAlice := alice.Send("alice")
	fmt.Printf("Alice sends to Bob:  %s\n", alice)

	bob.Tick("bob")
	fmt.Printf("Bob local event:     %s\n", bob)

	bob.Receive("bob", msgFromAlice)
	fmt.Printf("Bob receives Alice:  %s\n", bob)

	carol.Tick("carol")
	fmt.Printf("Carol local event:   %s\n", carol)

	fmt.Printf("\nCausality checks:\n")
	fmt.Printf("Alice -> Bob?    %v\n", msgFromAlice.HappensBefore(bob))
	fmt.Printf("Carol || Alice?  %v\n", carol.IsConcurrent(alice))
	fmt.Printf("Carol || Bob?    %v\n", carol.IsConcurrent(bob))
}
```

Output:
```
Alice local event:   {alice:1}
Alice sends to Bob:  {alice:2}
Bob local event:     {bob:1}
Bob receives Alice:  {alice:2, bob:2}
Carol local event:   {carol:1}

Causality checks:
Alice -> Bob?    true
Carol || Alice?  true
Carol || Bob?    true
```

---

## Vector Clock Size Problem

```
  Nodes    Vector Size    Per-Message Overhead
  -----    -----------    --------------------
     3      24 bytes       tiny
    10      80 bytes       small
   100     800 bytes       noticeable
  1000    8000 bytes       painful
 10000   80 KB             unacceptable
```

In large systems, vector clocks don't scale. Every
node needs an entry. Solutions:

1. **Pruning** — remove entries older than threshold
2. **Hash-based** — use consistent hashing to limit
   tracked nodes
3. **Hybrid logical clocks** — combine physical time
   with logical counters

---

## Hybrid Logical Clocks (HLC)

HLCs combine physical timestamps with a logical counter.
Used by CockroachDB and others.

### The Idea

```
  HLC = (physical_time, logical_counter)

  Comparison: first by physical_time,
              then by logical_counter

  +------------------------------------------+
  |  physical time  |  logical  |  node ID   |
  |  (48 bits)      |  (16 bits)|  (for tie) |
  +------------------------------------------+
```

### Rules

```
  On local or send event:
    pt = max(local.pt, physical_clock())
    if pt == local.pt:
        lc = local.lc + 1
    else:
        lc = 0
    local = (pt, lc)

  On receive event with remote HLC:
    pt = max(local.pt, remote.pt, physical_clock())
    if pt == local.pt == remote.pt:
        lc = max(local.lc, remote.lc) + 1
    elif pt == local.pt:
        lc = local.lc + 1
    elif pt == remote.pt:
        lc = remote.lc + 1
    else:
        lc = 0
    local = (pt, lc)
```

### Why HLCs Are Useful

```
  Vector Clocks     HLCs
  +------------+    +------------------+
  | O(N) size  |    | O(1) size        |
  | Detect     |    | Close to real    |
  | concurrency|    | time             |
  | No real    |    | Can't detect     |
  | time info  |    | all concurrency  |
  +------------+    +------------------+

  HLCs: good enough for most production systems.
  Vector clocks: necessary when you MUST detect
  all concurrent events.
```

---

## Code: Hybrid Logical Clock in Go

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

type HLC struct {
	mu      sync.Mutex
	pt      int64
	lc      uint32
	nodeID  string
}

func NewHLC(nodeID string) *HLC {
	return &HLC{nodeID: nodeID}
}

type Timestamp struct {
	PT     int64
	LC     uint32
	NodeID string
}

func (t Timestamp) Before(other Timestamp) bool {
	if t.PT != other.PT {
		return t.PT < other.PT
	}
	if t.LC != other.LC {
		return t.LC < other.LC
	}
	return t.NodeID < other.NodeID
}

func (t Timestamp) String() string {
	return fmt.Sprintf("(pt:%d, lc:%d, node:%s)", t.PT, t.LC, t.NodeID)
}

func (h *HLC) Now() Timestamp {
	h.mu.Lock()
	defer h.mu.Unlock()

	physicalNow := time.Now().UnixMilli()

	if physicalNow > h.pt {
		h.pt = physicalNow
		h.lc = 0
	} else {
		h.lc++
	}

	return Timestamp{PT: h.pt, LC: h.lc, NodeID: h.nodeID}
}

func (h *HLC) Receive(remote Timestamp) Timestamp {
	h.mu.Lock()
	defer h.mu.Unlock()

	physicalNow := time.Now().UnixMilli()

	if physicalNow > h.pt && physicalNow > remote.PT {
		h.pt = physicalNow
		h.lc = 0
	} else if h.pt == remote.PT {
		if remote.LC > h.lc {
			h.lc = remote.LC + 1
		} else {
			h.lc++
		}
	} else if remote.PT > h.pt {
		h.pt = remote.PT
		h.lc = remote.LC + 1
	} else {
		h.lc++
	}

	return Timestamp{PT: h.pt, LC: h.lc, NodeID: h.nodeID}
}

func main() {
	node1 := NewHLC("node1")
	node2 := NewHLC("node2")

	t1 := node1.Now()
	fmt.Printf("Node1 event:   %s\n", t1)

	t2 := node1.Now()
	fmt.Printf("Node1 event:   %s\n", t2)

	t3 := node2.Now()
	fmt.Printf("Node2 event:   %s\n", t3)

	t4 := node2.Receive(t2)
	fmt.Printf("Node2 receive: %s\n", t4)

	t5 := node1.Receive(t4)
	fmt.Printf("Node1 receive: %s\n", t5)

	fmt.Printf("\nt1 before t4? %v\n", t1.Before(t4))
	fmt.Printf("t3 before t2? %v\n", t3.Before(t2))
}
```

---

## When to Use What

```
  +------------------+-------------------+------------------+
  | Clock Type       | Use Case          | Example System   |
  +------------------+-------------------+------------------+
  | Lamport          | Total ordering    | Lamport's bakery |
  |                  | of events         | algorithm        |
  +------------------+-------------------+------------------+
  | Vector           | Detecting all     | Dynamo-style     |
  |                  | concurrent writes | databases        |
  +------------------+-------------------+------------------+
  | HLC              | Ordering with     | CockroachDB,     |
  |                  | real-time approx  | Cassandra        |
  +------------------+-------------------+------------------+
  | TrueTime (GPS)   | Real-time bounds  | Google Spanner   |
  +------------------+-------------------+------------------+
```

Google Spanner uses GPS and atomic clocks to get
physical time uncertainty down to ~7ms. Then it
**waits** that uncertainty period before committing.
Expensive hardware, but linearizable without logical
clocks.

---

## Exercises

1. **Implement version history.** Extend the vector clock
   code to store a list of (vector_clock, value) pairs.
   Write a function that returns all conflicting versions.

2. **HLC drift.** What happens to the HLC if the physical
   clock jumps backward by 1 second? Trace through the
   algorithm. How does the logical counter compensate?

3. **Compare.** Run both Lamport and vector clocks on this
   sequence and compare what you can determine:
   - P0 sends to P1
   - P1 sends to P2
   - P0 sends to P2
   Which clock type tells you more about P0's messages?

4. **Design question.** You're building a collaborative
   text editor with 50 simultaneous users. Which clock
   would you choose and why?

---

[Next: Lesson 4 — Leader Election -->](04-leader-election.md)
