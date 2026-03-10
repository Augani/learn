# Lesson 17: Chain Replication

> A deceptively simple idea: arrange replicas in a line.
> Writes enter at the head, reads come from the tail.

---

## The Analogy

Think of a factory assembly line. Raw material enters at
one end, each worker does their part, and the finished
product comes out the other end. If any worker confirms
the product left their station, you know everyone before
them also processed it.

```
  TRADITIONAL REPLICATION:          CHAIN REPLICATION:

  Client --> Leader                 Client --> Head
              |                                 |
         +---------+                           v
         |    |    |                         Node 2
         v    v    v                           |
       F1   F2   F3                           v
                                             Node 3
  Leader sends to ALL                          |
  followers in parallel.                      v
  Leader handles reads too.               Tail (reads)

  One node does everything.            Work is split:
                                       Head: accepts writes
                                       Tail: serves reads
```

---

## How Chain Replication Works

```
  CHAIN: Head -> Node2 -> Node3 -> Tail

  WRITE OPERATION:
  1. Client sends write to HEAD
  2. Head applies write, forwards to Node2
  3. Node2 applies write, forwards to Node3
  4. Node3 applies write, forwards to Tail
  5. Tail applies write, sends ACK to client

  Client                Head    Node2   Node3   Tail
    |--- write(x=5) ---->|        |       |       |
    |                     |--fwd->|       |       |
    |                     |       |--fwd->|       |
    |                     |       |       |--fwd->|
    |<----- ACK ----------------------------------|

  READ OPERATION:
  Client sends read to TAIL.
  Tail responds immediately.

  Client                Head    Node2   Node3   Tail
    |--- read(x) ---------------------------------------->|
    |<--- x=5 --------------------------------------------|

  THAT'S IT. No quorums. No voting. No consensus for reads.
```

---

## Why This Works: Strong Consistency

```
  KEY INSIGHT: The tail has the LATEST COMMITTED state.

  A write is only "committed" when it reaches the tail.
  The tail only returns committed data.
  Therefore: every read returns the latest committed write.

  LINEARIZABILITY PROOF (informal):
  1. Write completes when tail ACKs (tail has it)
  2. Read goes to tail (which has all committed writes)
  3. Reads always see all completed writes
  4. No stale reads possible!

  Compare with Raft:
  - Raft leader might have uncommitted entries
  - Raft reads need "read index" or lease for linearizability
  - Chain: tail is ALWAYS consistent, reads are trivially safe
```

---

## Failure Handling

```
  CASE 1: HEAD FAILS

  Chain: [HEAD] -> B -> C -> Tail
         CRASH!

  Recovery: B becomes new head.
  Chain: B -> C -> Tail

  In-flight writes to old head are LOST.
  Client retries to new head.
  Simple.

  CASE 2: TAIL FAILS

  Chain: Head -> B -> C -> [Tail]
                            CRASH!

  Recovery: C becomes new tail.
  Chain: Head -> B -> C

  C already has all writes that C forwarded.
  Some writes may not have reached old Tail yet.
  Those writes are now committed at C (new tail).
  Simple.

  CASE 3: MIDDLE NODE FAILS

  Chain: Head -> [B] -> C -> Tail
                CRASH!

  Recovery: skip B. Head -> C -> Tail
  PROBLEM: B may have forwarded some writes to C
  that C already has, and some that C doesn't.

  Solution: C tells Head "my latest is seq=47"
  Head re-sends seq 48, 49, ... to C.

  +------------------------------------------------+
  | HEAD and TAIL failures are trivial.             |
  | MIDDLE failures need retransmission.            |
  +------------------------------------------------+
```

---

## Chain Replication vs Raft

```
  +---------------------+------------------+-------------------+
  |                     | CHAIN REP        | RAFT              |
  +---------------------+------------------+-------------------+
  | Write path          | Sequential       | Parallel fan-out  |
  | Write latency       | O(N) hops        | O(1) round        |
  | Read path           | Tail only        | Leader only*      |
  | Read latency        | 1 hop            | 1 hop             |
  | Read throughput     | Tail's capacity  | Leader's capacity |
  | Write throughput    | Chain's capacity | Leader's capacity |
  | Consistency         | Linearizable     | Linearizable*     |
  | Failure complexity  | Simple           | Complex election  |
  | Message complexity  | O(N) sequential  | O(N) parallel     |
  +---------------------+------------------+-------------------+
  * Raft needs extra work for linearizable reads

  WRITE LATENCY COMPARISON (3 replicas):
  Raft:  Client -> Leader -> (Fan-out to 2 followers) -> ACK
         Latency = 1 RTT (parallel replication)

  Chain: Client -> Head -> Mid -> Tail -> ACK (back to client)
         Latency = 3 hops (sequential)

  Chain has HIGHER write latency but can split
  read/write load across different nodes.
```

---

## CRAQ: Chain Replication with Apportioned Queries

The key improvement: allow reads from ANY node in the chain,
not just the tail.

```
  CRAQ INSIGHT:

  Each node stores TWO versions of each object:
  - CLEAN: latest version committed by tail
  - DIRTY: latest version received but not yet committed

  READ FROM MIDDLE NODE:
  If object is CLEAN: return it immediately
  If object is DIRTY: ask the TAIL for the latest version number,
                      then return that version

  Head        Node2       Node3       Tail
  x=5(dirty)  x=5(dirty)  x=3(clean)  x=3(clean)
  x=5(dirty)  x=5(dirty)  x=5(dirty)  x=3(clean)
  x=5(dirty)  x=5(dirty)  x=5(dirty)  x=5(clean) <- committed!
  x=5(clean)  x=5(clean)  x=5(clean)  x=5(clean) <- ACK propagates back

  READ from Node2 while x=5 is dirty:
  Node2: "x is dirty, let me ask Tail"
  Tail: "latest committed version is 3"
  Node2: returns x=3

  READ from Node2 after x=5 is clean:
  Node2: "x is clean, value is 5"
  Returns x=5 immediately (no tail contact)

  RESULT: reads from ANY node, still linearizable!
```

```
  CRAQ READ THROUGHPUT SCALING:

  Chain length = N
  Read load distributed across N nodes.

  Chain of 5:
  +------+------+------+------+------+
  | Head | Mid1 | Mid2 | Mid3 | Tail |
  | 20%  | 20%  | 20%  | 20%  | 20%  |
  +------+------+------+------+------+

  5x read throughput vs single-node reads!

  (In practice, dirty reads still hit tail,
   so benefit depends on read/write ratio.)

  READ-HEAVY WORKLOADS:
  +---------------------------------------------------+
  | If 95% of objects are clean (low write rate),      |
  | 95% of reads are served locally = massive speedup  |
  +---------------------------------------------------+
```

---

## Implementation Sketch

```python
from dataclasses import dataclass, field
from typing import Dict, Optional, List, Tuple
from enum import Enum

class VersionState(Enum):
    CLEAN = "clean"
    DIRTY = "dirty"

@dataclass
class VersionedValue:
    value: object
    version: int
    state: VersionState

class CRAQNode:
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.data: Dict[str, List[VersionedValue]] = {}
        self.next_node: Optional['CRAQNode'] = None
        self.prev_node: Optional['CRAQNode'] = None

    @property
    def is_head(self) -> bool:
        return self.prev_node is None

    @property
    def is_tail(self) -> bool:
        return self.next_node is None

    def write(self, key: str, value: object, version: int):
        entry = VersionedValue(
            value=value,
            version=version,
            state=VersionState.DIRTY,
        )
        if key not in self.data:
            self.data[key] = []
        self.data[key].append(entry)

        if self.is_tail:
            self._commit(key, version)
            if self.prev_node:
                self.prev_node._propagate_commit(key, version)
        elif self.next_node:
            self.next_node.write(key, value, version)

    def _commit(self, key: str, version: int):
        if key not in self.data:
            return
        committed = None
        for entry in self.data[key]:
            if entry.version == version:
                entry.state = VersionState.CLEAN
                committed = entry
        if committed:
            self.data[key] = [committed]

    def _propagate_commit(self, key: str, version: int):
        self._commit(key, version)
        if self.prev_node:
            self.prev_node._propagate_commit(key, version)

    def read(self, key: str) -> Optional[object]:
        if key not in self.data:
            return None

        latest = self.data[key][-1]

        if latest.state == VersionState.CLEAN:
            return latest.value

        if self.is_tail:
            return latest.value

        tail = self._find_tail()
        committed_version = tail._get_committed_version(key)
        for entry in self.data[key]:
            if entry.version == committed_version:
                return entry.value
        return None

    def _get_committed_version(self, key: str) -> int:
        if key not in self.data:
            return -1
        for entry in reversed(self.data[key]):
            if entry.state == VersionState.CLEAN:
                return entry.version
        return -1

    def _find_tail(self) -> 'CRAQNode':
        node = self
        while node.next_node:
            node = node.next_node
        return node


def build_chain(node_ids: List[str]) -> List[CRAQNode]:
    nodes = [CRAQNode(nid) for nid in node_ids]
    for i in range(len(nodes) - 1):
        nodes[i].next_node = nodes[i + 1]
        nodes[i + 1].prev_node = nodes[i]
    return nodes


chain = build_chain(["head", "mid1", "mid2", "tail"])
head = chain[0]
mid1 = chain[1]
tail = chain[3]

head.write("x", "hello", version=1)

assert tail.read("x") == "hello"
assert mid1.read("x") == "hello"
assert head.read("x") == "hello"
```

---

## Chain Replication in Production

```
  +---------------------+-------------------------------+
  | System              | How They Use Chains           |
  +---------------------+-------------------------------+
  | HDFS                | Pipeline replication (write    |
  |                     | path is a chain)              |
  +---------------------+-------------------------------+
  | Microsoft Azure     | Chain replication for blob     |
  | Storage             | storage                       |
  +---------------------+-------------------------------+
  | FaunaDB             | Calvin + chain replication    |
  +---------------------+-------------------------------+
  | CORFU               | Shared log with chain layout  |
  +---------------------+-------------------------------+
  | Facebook (Delos)    | Shared log for control plane  |
  +---------------------+-------------------------------+
```

---

## When to Use Chain Replication

```
  USE CHAIN REPLICATION WHEN:
  +---------------------------------------------------+
  | Read-heavy workloads (CRAQ scales reads linearly) |
  | Need strong consistency without complexity        |
  | Can tolerate slightly higher write latency        |
  | Want simple failure handling                      |
  +---------------------------------------------------+

  USE RAFT/PAXOS INSTEAD WHEN:
  +---------------------------------------------------+
  | Write latency is critical                         |
  | Need fast leader election                         |
  | Dynamic membership changes are frequent           |
  | Want battle-tested production implementations     |
  +---------------------------------------------------+
```

---

## Exercises

### Exercise 1: Chain vs Raft Latency

Calculate the write latency for:
- Chain of 5 nodes, 1ms per hop
- Raft with 5 nodes, 1ms per message

Account for the full round trip (client to commit to ACK).

### Exercise 2: CRAQ Dirty Read Rate

Simulate a CRAQ chain of 5 nodes with:
- 100 writes/sec
- 1000 reads/sec
- 2ms propagation per hop
- Measure: what percentage of reads hit a dirty object
  and must contact the tail?

### Exercise 3: Failure Recovery

Implement middle-node failure recovery:
1. Build a chain of 5 nodes
2. Crash node 3
3. Node 2 reconnects to node 4
4. Node 4 reports its latest committed version
5. Node 2 re-sends any missing writes

### Exercise 4: Hybrid Architecture

Design a system that uses:
- Raft for metadata and leader election
- Chain replication for data replication
Draw the architecture and explain how they interact.

---

## Key Takeaways

```
  1. Chain: writes at head, reads at tail
  2. Strong consistency without quorum reads
  3. Write latency = O(N) sequential hops
  4. Head/tail failures: trivial recovery
  5. Middle failures: need retransmission
  6. CRAQ: reads from any node (dirty check with tail)
  7. CRAQ scales read throughput linearly with chain length
  8. Clean objects served locally, dirty objects check tail
  9. Best for read-heavy, strong-consistency workloads
  10. Used by Azure Storage, HDFS pipeline, Facebook Delos
```

---

Next: [Lesson 18 — Distributed Debugging](./18-distributed-debugging.md)
