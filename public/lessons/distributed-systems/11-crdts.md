# Lesson 11: CRDTs — Conflict-Free Replicated Data Types

> Data structures that mathematically guarantee convergence
> without coordination. No consensus needed.

---

## The Analogy

You and three friends each have a whiteboard tracking
who came to the party. Everyone writes names independently.
When you compare whiteboards, you just take the UNION of
all names. No conflicts, no voting, no coordinator.

That's a CRDT. The merge operation is designed so that
no matter what order updates arrive, everyone converges
to the same result.

```
  WITHOUT CRDTs:                    WITH CRDTs:
  Node A: {Alice, Bob}              Node A: {Alice, Bob}
  Node B: {Alice, Carol}            Node B: {Alice, Carol}
  Node C: {Bob, Carol}              Node C: {Bob, Carol}

  Who has the "right" set?          Merge = Union:
  Need consensus!                   {Alice, Bob, Carol}
  Need a leader!                    Every node converges.
  Need coordination!                No coordination needed.
```

---

## Mathematical Foundation

CRDTs rely on **semilattices** — structures with a merge
operation that is:

```
  REQUIRED PROPERTIES OF MERGE:

  1. Commutative:  merge(A, B) = merge(B, A)
     Order doesn't matter.

  2. Associative:  merge(A, merge(B, C)) = merge(merge(A, B), C)
     Grouping doesn't matter.

  3. Idempotent:   merge(A, A) = A
     Applying the same update twice is harmless.

  These three guarantee CONVERGENCE regardless of:
  - Message ordering
  - Message duplication
  - Network partitions (as long as messages eventually arrive)
```

---

## Two Flavors of CRDTs

```
  STATE-BASED (CvRDT)              OPERATION-BASED (CmRDT)
  =====================            =======================

  Send entire state                Send just the operation
  Receiver merges states           Receiver applies operation

  +-------+    full state    +-------+
  | Node A| --------------> | Node B|
  +-------+                  +-------+

  Pros:                           Pros:
  - Simple to implement           - Small messages
  - Tolerates message loss        - Lower bandwidth
  - Tolerates duplication

  Cons:                           Cons:
  - Large messages                - Needs reliable delivery
  - Bandwidth intensive           - Needs exactly-once or
                                    causal delivery
```

---

## G-Counter (Grow-Only Counter)

The simplest useful CRDT. Each node increments its own slot.
Total = sum of all slots.

```
  3 NODES: A, B, C
  Each maintains a vector: [A_count, B_count, C_count]

  Initial state:
  Node A: [0, 0, 0]    Node B: [0, 0, 0]    Node C: [0, 0, 0]

  Node A increments twice:
  Node A: [2, 0, 0]    Node B: [0, 0, 0]    Node C: [0, 0, 0]

  Node B increments once:
  Node A: [2, 0, 0]    Node B: [0, 1, 0]    Node C: [0, 0, 0]

  Merge (element-wise max):
  Node A: [2, 1, 0]    Node B: [2, 1, 0]    Node C: [2, 1, 0]

  Value = 2 + 1 + 0 = 3 everywhere
```

### Python Implementation

```python
class GCounter:
    def __init__(self, node_id, num_nodes):
        self.node_id = node_id
        self.counts = [0] * num_nodes

    def increment(self):
        self.counts[self.node_id] += 1

    def value(self):
        return sum(self.counts)

    def merge(self, other):
        for i in range(len(self.counts)):
            self.counts[i] = max(self.counts[i], other.counts[i])


a = GCounter(node_id=0, num_nodes=3)
b = GCounter(node_id=1, num_nodes=3)

a.increment()
a.increment()
b.increment()

a.merge(b)
b.merge(a)

assert a.value() == 3
assert b.value() == 3
```

---

## PN-Counter (Positive-Negative Counter)

Two G-Counters: one for increments, one for decrements.

```
  PN-COUNTER = P (increments) - N (decrements)

  Node A increments 5 times, decrements 2 times:
  P: [5, 0, 0]    N: [2, 0, 0]    Value = 5 - 2 = 3

  Node B increments 3 times, decrements 1 time:
  P: [0, 3, 0]    N: [0, 1, 0]    Value = 3 - 1 = 2

  Merged:
  P: [5, 3, 0]    N: [2, 1, 0]    Value = 8 - 3 = 5
```

```python
class PNCounter:
    def __init__(self, node_id, num_nodes):
        self.positive = GCounter(node_id, num_nodes)
        self.negative = GCounter(node_id, num_nodes)

    def increment(self):
        self.positive.increment()

    def decrement(self):
        self.negative.increment()

    def value(self):
        return self.positive.value() - self.negative.value()

    def merge(self, other):
        self.positive.merge(other.positive)
        self.negative.merge(other.negative)


a = PNCounter(node_id=0, num_nodes=2)
b = PNCounter(node_id=1, num_nodes=2)

a.increment()
a.increment()
a.decrement()
b.increment()

a.merge(b)
b.merge(a)

assert a.value() == 2
assert b.value() == 2
```

---

## G-Set (Grow-Only Set)

Add elements, never remove. Merge = union.

```
  Node A: {apple, banana}
  Node B: {banana, cherry}

  Merge: {apple, banana, cherry}

  Idempotent?   union(S, S) = S                 YES
  Commutative?  union(A, B) = union(B, A)       YES
  Associative?  union(A, union(B,C)) = ...       YES
```

---

## 2P-Set (Two-Phase Set)

Two G-Sets: one for adds, one for removes.
Once removed, an element can NEVER be re-added.

```
  Add-Set: {apple, banana, cherry}
  Remove-Set: {banana}

  Value = Add-Set \ Remove-Set = {apple, cherry}

  LIMITATION: can't re-add banana!
  This is the "remove wins" semantic.
```

---

## OR-Set (Observed-Remove Set)

The most practical set CRDT. Each add gets a unique tag.
Remove only removes observed tags.

```
  Node A adds "milk":
  A: {("milk", tag1)}

  Replicate to B:
  B: {("milk", tag1)}

  B removes "milk" (removes tag1):
  B: {}

  Meanwhile A adds "milk" again:
  A: {("milk", tag1), ("milk", tag2)}

  Merge:
  A: {("milk", tag2)}   <-- tag1 removed, tag2 survives
  B: {("milk", tag2)}   <-- "add wins" for concurrent add+remove
```

```python
import uuid

class ORSet:
    def __init__(self):
        self.elements = {}
        self.tombstones = set()

    def add(self, element):
        tag = str(uuid.uuid4())
        if element not in self.elements:
            self.elements[element] = set()
        self.elements[element].add(tag)
        return tag

    def remove(self, element):
        if element in self.elements:
            self.tombstones.update(self.elements[element])
            del self.elements[element]

    def lookup(self, element):
        if element not in self.elements:
            return False
        live_tags = self.elements[element] - self.tombstones
        return len(live_tags) > 0

    def value(self):
        result = set()
        for elem, tags in self.elements.items():
            if tags - self.tombstones:
                result.add(elem)
        return result

    def merge(self, other):
        all_elements = set(self.elements.keys()) | set(other.elements.keys())
        for elem in all_elements:
            my_tags = self.elements.get(elem, set())
            their_tags = other.elements.get(elem, set())
            self.elements[elem] = my_tags | their_tags
        self.tombstones = self.tombstones | other.tombstones


a = ORSet()
b = ORSet()

a.add("milk")
a.add("eggs")
b.add("bread")

a.merge(b)
b.merge(a)

assert a.value() == {"milk", "eggs", "bread"}
assert b.value() == {"milk", "eggs", "bread"}
```

---

## LWW-Register (Last-Writer-Wins Register)

A single value. Each write gets a timestamp.
Highest timestamp wins on merge.

```
  Node A writes "hello" at T=10
  Node B writes "world" at T=12

  Merge: "world" wins (12 > 10)

  CAUTION: requires reasonably synchronized clocks
  CAUTION: concurrent writes silently lose data

  +--------+     +--------+
  | A: T10 |     | B: T12 |
  | "hello"|     | "world"|
  +--------+     +--------+
       \            /
        \  merge   /
         v        v
       +------------+
       | T12        |
       | "world"    |
       +------------+
```

---

## MV-Register (Multi-Value Register)

Keeps ALL concurrent values. Application decides.

```
  Node A writes "hello" at V=[1,0]
  Node B writes "world" at V=[0,1]

  Neither dominates (concurrent):
  Merge keeps BOTH: {"hello", "world"}

  Application must resolve (show both to user, etc.)

  This is what Amazon's Dynamo shopping cart does.
  "Your cart has conflicting items — please choose."
```

---

## Sequence CRDTs (for Collaborative Editing)

Used in Google Docs, Figma, and similar tools.

```
  THE PROBLEM:
  Two users type at position 3 simultaneously:

  User A: insert 'X' at position 3
  User B: insert 'Y' at position 3

  Array index won't work — positions shift!

  SOLUTION: give each character a UNIQUE ID
  that defines a total order.

  TREEDOC / LSEQ / RGA:
  Assign fractional positions between existing chars.

  "HELLO"
  H(0.1) E(0.2) L(0.3) L(0.4) O(0.5)

  Insert X between E and L:
  H(0.1) E(0.2) X(0.25) L(0.3) L(0.4) O(0.5)

  Insert Y between E and L (concurrently):
  H(0.1) E(0.2) Y(0.22) L(0.3) L(0.4) O(0.5)

  Merge by sorting on position:
  H E Y X L L O   (0.22 < 0.25)
```

---

## CRDTs in the Real World

```
  +-------------------+------------------+---------------------------+
  | System            | CRDT Used        | Purpose                   |
  +-------------------+------------------+---------------------------+
  | Redis (CRDB)      | OR-Set, Counter  | Multi-region replication  |
  | Riak              | OR-Set, Map      | Distributed database      |
  | Automerge         | Sequence CRDT    | Collaborative editing     |
  | Yjs               | Sequence CRDT    | Real-time collaboration   |
  | Figma             | Custom CRDTs     | Design collaboration      |
  | Apple Notes       | Sequence CRDT    | Cross-device sync         |
  | SoundCloud        | G-Counter        | Play counts               |
  +-------------------+------------------+---------------------------+
```

---

## CRDTs vs Consensus

```
  WHEN TO USE WHAT:

  CRDTs:                              Consensus (Raft/Paxos):
  +---------------------------------+ +---------------------------------+
  | No coordination needed          | | Strong consistency required     |
  | Tolerate any partition          | | Need linearizability            |
  | Eventual consistency is fine    | | Financial transactions          |
  | High availability required      | | Inventory with hard limits      |
  | Counters, sets, text editing    | | Leader election                 |
  +---------------------------------+ +---------------------------------+

  CRDTs trade precision for availability.
  Consensus trades availability for precision.
```

---

## Exercises

### Exercise 1: Implement a G-Counter in Rust

```rust
use std::collections::HashMap;

struct GCounter {
    node_id: String,
    counts: HashMap<String, u64>,
}

impl GCounter {
    fn new(node_id: &str) -> Self {
        GCounter {
            node_id: node_id.to_string(),
            counts: HashMap::new(),
        }
    }

    fn increment(&mut self) {
        let entry = self.counts.entry(self.node_id.clone()).or_insert(0);
        *entry += 1;
    }

    fn value(&self) -> u64 {
        self.counts.values().sum()
    }

    fn merge(&mut self, other: &GCounter) {
        for (node, &count) in &other.counts {
            let entry = self.counts.entry(node.clone()).or_insert(0);
            *entry = (*entry).max(count);
        }
    }
}

fn main() {
    let mut a = GCounter::new("A");
    let mut b = GCounter::new("B");

    a.increment();
    a.increment();
    b.increment();
    b.increment();
    b.increment();

    a.merge(&b);
    b.merge(&a);

    assert_eq!(a.value(), 5);
    assert_eq!(b.value(), 5);
    println!("Both nodes agree: {}", a.value());
}
```

### Exercise 2: Build an OR-Set with Proper Merge

Extend the Python OR-Set above to handle this scenario:

1. Node A adds "milk"
2. Replicate A -> B
3. Node B removes "milk"
4. Node A concurrently adds "milk" again
5. Merge A and B
6. Verify "milk" exists (add wins for concurrent add+remove)

### Exercise 3: Design a CRDT Shopping Cart

Design a shopping cart CRDT that supports:
- Add item (with quantity)
- Remove item
- Update quantity
- Merge two carts

Hint: use a map where keys are item IDs and values are
PN-Counters for quantities, combined with an OR-Set for
the set of active items.

### Exercise 4: Discuss the Tradeoffs

For each scenario, decide if a CRDT or consensus is better:
1. Like counter on social media posts
2. Bank account balance
3. Collaborative text editor
4. Distributed lock
5. Shopping cart across multiple devices
6. Unique username registration

---

## Key Takeaways

```
  1. CRDTs guarantee convergence WITHOUT coordination
  2. The math: commutative + associative + idempotent merge
  3. State-based: send full state, merge with lattice join
  4. Operation-based: send operations, need reliable delivery
  5. Common types: counters, sets, registers, sequences
  6. OR-Set is the practical workhorse for set operations
  7. Sequence CRDTs power collaborative editing
  8. CRDTs trade precision for availability
  9. Use CRDTs when eventual consistency is acceptable
  10. Use consensus when you need strong consistency
```

---

Next: [Lesson 12 — Gossip Protocols](./12-gossip-protocols.md)
