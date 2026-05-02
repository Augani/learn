# Lesson 10: Conflict Resolution

> When two people edit the same thing at the same time,
> someone has to decide what wins.

---

## The Analogy

You and a friend both edit the same Google Doc paragraph
at the same time. Google Docs handles this gracefully —
you see both edits merge in real-time. But what if you
were both editing OFFLINE? When you reconnect, whose
version wins? That's conflict resolution.

---

## When Do Conflicts Happen?

```
  Single-leader:  Almost never (leader serializes writes)
  Multi-leader:   When two leaders accept concurrent writes
  Leaderless:     When concurrent writes hit different nodes

  Client A --> DC-West: SET name = "Alice"
  Client B --> DC-East: SET name = "Bob"

  Both succeed locally. When they replicate:

  DC-West has: "Alice" then "Bob" arrives
  DC-East has: "Bob" then "Alice" arrives

  CONFLICT: which one is correct?
```

---

## Strategy 1: Last-Write-Wins (LWW)

Attach a timestamp to each write. Highest timestamp wins.

```
  Write 1: name="Alice"  timestamp=100
  Write 2: name="Bob"    timestamp=102

  Conflict resolution: Bob wins (102 > 100)

  Simple. But:
  - Requires synchronized clocks (they're not)
  - Silently drops data (Alice's write is GONE)
  - "Last" might not mean what you think
```

### The Silent Data Loss Problem

```
  Client A and B write different KEYS concurrently:

  Client A: SET X=1 at T=100
  Client B: SET Y=2 at T=101

  With LWW on the same node:
  Both writes are fine (different keys).

  Client A and B write the SAME KEY:
  Client A: SET X=1 at T=100
  Client B: SET X=2 at T=101

  LWW keeps X=2, silently discards X=1.
  Client A has no idea their write was lost.
```

Cassandra uses LWW by default. It works IF you know
and accept that concurrent writes to the same key
will lose data.

---

## Strategy 2: Vector Clocks + Application Resolution

From Lessons 2-3, you know vector clocks detect
concurrent writes. Use them to keep ALL conflicting
versions and let the application (or user) decide.

```
  Write 1: name="Alice"  vc={A:1}
  Write 2: name="Bob"    vc={B:1}

  {A:1} || {B:1}  -- concurrent!

  Store BOTH versions (siblings):
  name = ["Alice" @ {A:1}, "Bob" @ {B:1}]

  On next read:
  Client sees both. Application merges them.
  Client writes: name="Alice & Bob"  vc={A:1, B:1, C:1}

  Now both old versions are ancestors of the new one.
```

Amazon's Dynamo used this approach. Riak exposed it
to application developers.

---

## Strategy 3: CRDTs

Conflict-free Replicated Data Types. Data structures
that ALWAYS merge deterministically with no conflicts.
We'll cover these in depth in Lesson 11.

```
  G-Counter (grow-only counter):
  Node A: {A:3, B:0}  value = 3
  Node B: {A:0, B:5}  value = 5

  Merge: {A:3, B:5}   value = 8

  No conflict. No data loss. Mathematically guaranteed.
```

---

## Strategy 4: Operational Transformation (OT)

Used in Google Docs. Transform concurrent operations
against each other.

```
  Document: "ABC"

  User 1: Insert "X" at position 1 -> "AXBC"
  User 2: Delete at position 2     -> "AC"

  These happened concurrently. Apply naively:

  Start with "ABC"
  Apply User 1: Insert X at 1 -> "AXBC"
  Apply User 2: Delete at 2 -> "AXBC" delete pos 2 -> "AXC"

  Start with "ABC"
  Apply User 2: Delete at 2 -> "AC"
  Apply User 1: Insert X at 1 -> "AXC"

  Same result! But only because we TRANSFORMED the
  operations to account for each other's effects.

  Without transformation:
  Apply User 2's original "delete at 2" to "AXBC"
  -> deletes 'B' -> "AXC"  (happens to be correct)

  But more complex cases break without transformation.
```

---

## Code: Multi-Strategy Conflict Resolution

```go
package main

import (
	"fmt"
	"strings"
)

type Version struct {
	Value string
	Clock map[string]int
}

func newVersion(value string, clock map[string]int) Version {
	c := make(map[string]int)
	for k, v := range clock {
		c[k] = v
	}
	return Version{Value: value, Clock: c}
}

func happensBefore(a, b map[string]int) bool {
	atLeastOneLess := false
	allKeys := mergeKeys(a, b)
	for _, k := range allKeys {
		if a[k] > b[k] {
			return false
		}
		if a[k] < b[k] {
			atLeastOneLess = true
		}
	}
	return atLeastOneLess
}

func isConcurrent(a, b map[string]int) bool {
	return !happensBefore(a, b) && !happensBefore(b, a)
}

func mergeKeys(a, b map[string]int) []string {
	seen := map[string]bool{}
	for k := range a {
		seen[k] = true
	}
	for k := range b {
		seen[k] = true
	}
	keys := make([]string, 0, len(seen))
	for k := range seen {
		keys = append(keys, k)
	}
	return keys
}

func resolveLWW(versions []Version) string {
	best := versions[0]
	bestTotal := 0
	for _, k := range mergeKeys(best.Clock, nil) {
		bestTotal += best.Clock[k]
	}

	for _, v := range versions[1:] {
		total := 0
		for _, k := range mergeKeys(v.Clock, nil) {
			total += v.Clock[k]
		}
		if total > bestTotal {
			best = v
			bestTotal = total
		}
	}
	return best.Value
}

func resolveKeepAll(versions []Version) []string {
	var concurrent []string
	for i, v := range versions {
		isConcurrentWithAll := true
		for j, other := range versions {
			if i != j && happensBefore(v.Clock, other.Clock) {
				isConcurrentWithAll = false
				break
			}
		}
		if isConcurrentWithAll {
			concurrent = append(concurrent, v.Value)
		}
	}
	return concurrent
}

func resolveMerge(versions []Version) string {
	all := resolveKeepAll(versions)
	return strings.Join(all, " + ")
}

func main() {
	v1 := newVersion("Alice", map[string]int{"A": 1})
	v2 := newVersion("Bob", map[string]int{"B": 1})
	v3 := newVersion("Carol", map[string]int{"A": 1, "B": 1, "C": 1})

	fmt.Println("=== Conflict Detection ===")
	fmt.Printf("v1 || v2 (concurrent)? %v\n", isConcurrent(v1.Clock, v2.Clock))
	fmt.Printf("v1 -> v3 (happens-before)? %v\n", happensBefore(v1.Clock, v3.Clock))

	conflict := []Version{v1, v2}

	fmt.Println("\n=== Resolution Strategies ===")
	fmt.Printf("LWW:       %s\n", resolveLWW(conflict))
	fmt.Printf("Keep All:  %v\n", resolveKeepAll(conflict))
	fmt.Printf("Merge:     %s\n", resolveMerge(conflict))

	fmt.Println("\n=== With causal successor ===")
	withSuccessor := []Version{v1, v2, v3}
	fmt.Printf("Keep All:  %v\n", resolveKeepAll(withSuccessor))
	fmt.Printf("v3 supersedes v1 and v2\n")
}
```

---

## Comparison of Strategies

```
  +------------------+----------+----------+-----------+
  | Strategy         | Data     | Correct- | Complex-  |
  |                  | Loss?    | ness     | ity       |
  +------------------+----------+----------+-----------+
  | LWW              | YES      | Weak     | Very low  |
  +------------------+----------+----------+-----------+
  | Vector clock +   | No       | App      | Medium    |
  | app resolution   |          | decides  |           |
  +------------------+----------+----------+-----------+
  | CRDTs            | No       | Auto     | High      |
  |                  |          | merge    | (design)  |
  +------------------+----------+----------+-----------+
  | OT               | No       | Good     | Very high |
  +------------------+----------+----------+-----------+
```

---

## Real-World Choices

```
  Cassandra:     LWW (default), custom resolvers
  DynamoDB:      LWW
  Riak:          Vector clocks + siblings
  CouchDB:       Revision tree, app resolves
  Google Docs:   Operational transformation
  Figma:         CRDTs
  Redis (CRDT):  CRDTs for active-active replication
```

---

## Exercises

1. **LWW data loss.** Two clients add items to a
   shopping cart. Client A adds "milk", Client B adds
   "eggs". With LWW, one item is lost. Show how vector
   clocks + merge preserves both.

2. **Three-way conflict.** Three nodes write different
   values concurrently. Draw the vector clocks. Design
   a merge function that combines all three.

3. **Run the code.** Add a fourth version that is a
   causal successor of v1 but concurrent with v2.
   Verify the detection logic.

4. **Design.** You're building a notes app with offline
   support. A user edits a note on their phone and
   laptop simultaneously. What resolution strategy do
   you use?

---

[Next: Lesson 11 — CRDTs -->](11-crdts.md)
