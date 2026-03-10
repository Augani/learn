# Lesson 20: Build a Distributed Key-Value Store (Capstone)

> Put it all together. Build a distributed KV store
> that handles partitioning, replication, and failures.

---

## What We're Building

```
  A distributed key-value store with:

  +--------------------------------------------------+
  | FEATURES                                          |
  +--------------------------------------------------+
  | - Hash-partitioned across N nodes                 |
  | - Replicated (replication factor = 3)             |
  | - Consistent hashing with virtual nodes           |
  | - Quorum reads and writes (W=2, R=2)              |
  | - Vector clocks for conflict detection            |
  | - Gossip-based failure detection                  |
  | - Anti-entropy for replica synchronization        |
  +--------------------------------------------------+

  ARCHITECTURE:
  +--------+
  | Client | --- PUT/GET ---> Any Node (coordinator)
  +--------+
       |
  +----+----+----+----+----+
  | N1 | N2 | N3 | N4 | N5 |
  +----+----+----+----+----+
  Each node:
  - Stores a portion of the data
  - Can coordinate any request
  - Knows about all other nodes via gossip
```

---

## Step 1: Consistent Hashing Ring

```python
import hashlib
from bisect import bisect_right, insort
from typing import List, Optional

class HashRing:
    def __init__(self, vnodes_per_node: int = 64):
        self.vnodes_per_node = vnodes_per_node
        self.ring: List[int] = []
        self.ring_to_node: dict = {}
        self.nodes: set = set()

    def _hash(self, key: str) -> int:
        digest = hashlib.sha256(key.encode()).hexdigest()
        return int(digest[:16], 16)

    def add_node(self, node_id: str):
        self.nodes.add(node_id)
        for i in range(self.vnodes_per_node):
            vnode_hash = self._hash(f"{node_id}:vn{i}")
            insort(self.ring, vnode_hash)
            self.ring_to_node[vnode_hash] = node_id

    def remove_node(self, node_id: str):
        self.nodes.discard(node_id)
        to_remove = [
            h for h, n in self.ring_to_node.items() if n == node_id
        ]
        for h in to_remove:
            self.ring.remove(h)
            del self.ring_to_node[h]

    def get_node(self, key: str) -> str:
        if not self.ring:
            raise ValueError("Empty ring")
        key_hash = self._hash(key)
        idx = bisect_right(self.ring, key_hash) % len(self.ring)
        return self.ring_to_node[self.ring[idx]]

    def get_preference_list(self, key: str, count: int) -> List[str]:
        if not self.ring:
            return []
        key_hash = self._hash(key)
        idx = bisect_right(self.ring, key_hash) % len(self.ring)
        result = []
        seen = set()
        for i in range(len(self.ring)):
            candidate_idx = (idx + i) % len(self.ring)
            node = self.ring_to_node[self.ring[candidate_idx]]
            if node not in seen:
                result.append(node)
                seen.add(node)
            if len(result) >= count:
                break
        return result
```

---

## Step 2: Vector Clocks

```python
from typing import Dict

class VectorClock:
    def __init__(self):
        self.clock: Dict[str, int] = {}

    def increment(self, node_id: str):
        self.clock[node_id] = self.clock.get(node_id, 0) + 1

    def merge(self, other: 'VectorClock'):
        all_nodes = set(self.clock.keys()) | set(other.clock.keys())
        for node in all_nodes:
            self.clock[node] = max(
                self.clock.get(node, 0),
                other.clock.get(node, 0),
            )

    def dominates(self, other: 'VectorClock') -> bool:
        if not other.clock:
            return bool(self.clock)
        all_nodes = set(self.clock.keys()) | set(other.clock.keys())
        at_least_one_greater = False
        for node in all_nodes:
            mine = self.clock.get(node, 0)
            theirs = other.clock.get(node, 0)
            if mine < theirs:
                return False
            if mine > theirs:
                at_least_one_greater = True
        return at_least_one_greater

    def concurrent_with(self, other: 'VectorClock') -> bool:
        return not self.dominates(other) and not other.dominates(self) and self.clock != other.clock

    def copy(self) -> 'VectorClock':
        vc = VectorClock()
        vc.clock = dict(self.clock)
        return vc

    def __repr__(self):
        return f"VC({self.clock})"
```

---

## Step 3: Storage Engine

```python
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

@dataclass
class VersionedValue:
    value: bytes
    vector_clock: VectorClock
    timestamp: float

class StorageEngine:
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.data: Dict[str, List[VersionedValue]] = {}

    def put(
        self,
        key: str,
        value: bytes,
        context: Optional[VectorClock] = None,
    ) -> VectorClock:
        new_vc = context.copy() if context else VectorClock()
        new_vc.increment(self.node_id)

        new_entry = VersionedValue(
            value=value,
            vector_clock=new_vc,
            timestamp=time.time(),
        )

        if key not in self.data:
            self.data[key] = [new_entry]
        else:
            surviving = []
            for existing in self.data[key]:
                if not new_vc.dominates(existing.vector_clock):
                    surviving.append(existing)
            surviving.append(new_entry)
            self.data[key] = surviving

        return new_vc

    def get(self, key: str) -> List[VersionedValue]:
        return self.data.get(key, [])

    def get_all_keys(self) -> List[str]:
        return list(self.data.keys())

    def merge_remote(self, key: str, remote_versions: List[VersionedValue]):
        local = self.data.get(key, [])
        all_versions = local + remote_versions
        surviving = []
        for candidate in all_versions:
            dominated = False
            for other in all_versions:
                if other is candidate:
                    continue
                if other.vector_clock.dominates(candidate.vector_clock):
                    dominated = True
                    break
            if not dominated:
                already_present = any(
                    v.vector_clock.clock == candidate.vector_clock.clock
                    for v in surviving
                )
                if not already_present:
                    surviving.append(candidate)
        self.data[key] = surviving if surviving else local
```

---

## Step 4: Gossip-Based Membership

```python
import random
from dataclasses import dataclass
from enum import Enum

class MemberStatus(Enum):
    ALIVE = "alive"
    SUSPECT = "suspect"
    DEAD = "dead"

@dataclass
class MemberInfo:
    node_id: str
    address: str
    heartbeat: int = 0
    status: MemberStatus = MemberStatus.ALIVE
    last_update: float = 0.0

class MembershipService:
    def __init__(self, node_id: str, address: str):
        self.node_id = node_id
        self.members: Dict[str, MemberInfo] = {}
        self.members[node_id] = MemberInfo(
            node_id=node_id,
            address=address,
            heartbeat=0,
            last_update=time.time(),
        )

    def heartbeat(self):
        me = self.members[self.node_id]
        me.heartbeat += 1
        me.last_update = time.time()

    def get_alive_members(self) -> List[str]:
        return [
            nid for nid, info in self.members.items()
            if info.status != MemberStatus.DEAD
        ]

    def pick_gossip_target(self) -> Optional[str]:
        candidates = [
            nid for nid in self.get_alive_members()
            if nid != self.node_id
        ]
        if not candidates:
            return None
        return random.choice(candidates)

    def prepare_gossip(self) -> Dict[str, MemberInfo]:
        return dict(self.members)

    def receive_gossip(self, remote: Dict[str, MemberInfo]):
        for nid, remote_info in remote.items():
            local_info = self.members.get(nid)
            if local_info is None:
                self.members[nid] = MemberInfo(
                    node_id=remote_info.node_id,
                    address=remote_info.address,
                    heartbeat=remote_info.heartbeat,
                    last_update=time.time(),
                )
            elif remote_info.heartbeat > local_info.heartbeat:
                local_info.heartbeat = remote_info.heartbeat
                local_info.last_update = time.time()
                local_info.status = MemberStatus.ALIVE

    def detect_failures(self, suspect_timeout: float = 5.0, dead_timeout: float = 15.0):
        now = time.time()
        for nid, info in self.members.items():
            if nid == self.node_id:
                continue
            age = now - info.last_update
            if age > dead_timeout:
                info.status = MemberStatus.DEAD
            elif age > suspect_timeout:
                info.status = MemberStatus.SUSPECT
```

---

## Step 5: The Coordinator (Putting It Together)

```python
from typing import Tuple

class QuorumConfig:
    def __init__(self, n: int = 3, r: int = 2, w: int = 2):
        self.n = n
        self.r = r
        self.w = w

class KVNode:
    def __init__(self, node_id: str, address: str, quorum: QuorumConfig = None):
        self.node_id = node_id
        self.storage = StorageEngine(node_id)
        self.membership = MembershipService(node_id, address)
        self.ring = HashRing(vnodes_per_node=64)
        self.quorum = quorum or QuorumConfig()
        self.ring.add_node(node_id)
        self.cluster: Dict[str, 'KVNode'] = {node_id: self}

    def join_cluster(self, other_node: 'KVNode'):
        self.ring.add_node(other_node.node_id)
        self.cluster[other_node.node_id] = other_node
        self.membership.members[other_node.node_id] = MemberInfo(
            node_id=other_node.node_id,
            address=other_node.membership.members[other_node.node_id].address,
            last_update=time.time(),
        )
        other_node.ring.add_node(self.node_id)
        other_node.cluster[self.node_id] = self
        other_node.membership.members[self.node_id] = MemberInfo(
            node_id=self.node_id,
            address=self.membership.members[self.node_id].address,
            last_update=time.time(),
        )

    def put(self, key: str, value: bytes, context: Optional[VectorClock] = None) -> Tuple[bool, VectorClock]:
        preference_list = self.ring.get_preference_list(key, self.quorum.n)
        alive_nodes = [
            nid for nid in preference_list
            if nid in self.cluster
        ]

        if len(alive_nodes) < self.quorum.w:
            return False, VectorClock()

        responses = []
        for nid in alive_nodes[:self.quorum.n]:
            node = self.cluster[nid]
            vc = node.storage.put(key, value, context)
            responses.append(vc)
            if len(responses) >= self.quorum.w:
                break

        if len(responses) >= self.quorum.w:
            return True, responses[0]
        return False, VectorClock()

    def get(self, key: str) -> Tuple[bool, List[VersionedValue]]:
        preference_list = self.ring.get_preference_list(key, self.quorum.n)
        alive_nodes = [
            nid for nid in preference_list
            if nid in self.cluster
        ]

        if len(alive_nodes) < self.quorum.r:
            return False, []

        all_versions = []
        read_count = 0
        for nid in alive_nodes[:self.quorum.n]:
            node = self.cluster[nid]
            versions = node.storage.get(key)
            all_versions.extend(versions)
            read_count += 1
            if read_count >= self.quorum.r:
                break

        if read_count < self.quorum.r:
            return False, []

        merged = self._reconcile(all_versions)
        return True, merged

    def _reconcile(self, versions: List[VersionedValue]) -> List[VersionedValue]:
        if not versions:
            return []
        surviving = []
        for candidate in versions:
            dominated = any(
                other.vector_clock.dominates(candidate.vector_clock)
                for other in versions
                if other is not candidate
            )
            if not dominated:
                already = any(
                    v.vector_clock.clock == candidate.vector_clock.clock
                    for v in surviving
                )
                if not already:
                    surviving.append(candidate)
        return surviving

    def anti_entropy_sync(self, peer_id: str):
        if peer_id not in self.cluster:
            return
        peer = self.cluster[peer_id]
        my_keys = set(self.storage.get_all_keys())
        peer_keys = set(peer.storage.get_all_keys())

        all_keys = my_keys | peer_keys
        for key in all_keys:
            my_versions = self.storage.get(key)
            peer_versions = peer.storage.get(key)
            if my_versions:
                peer.storage.merge_remote(key, my_versions)
            if peer_versions:
                self.storage.merge_remote(key, peer_versions)
```

---

## Step 6: Test It

```python
def test_basic_operations():
    nodes = []
    for i in range(5):
        node = KVNode(f"node-{i}", f"localhost:{9000+i}")
        nodes.append(node)

    for i in range(1, len(nodes)):
        nodes[i].join_cluster(nodes[0])
        for j in range(1, i):
            nodes[i].join_cluster(nodes[j])

    ok, vc = nodes[0].put("user:1", b"Alice")
    assert ok, "Put should succeed"
    print(f"PUT user:1 = Alice, vc={vc}")

    ok, versions = nodes[2].get("user:1")
    assert ok, "Get should succeed"
    assert len(versions) > 0
    print(f"GET user:1 from node-2: {versions[0].value}")

    ok, vc2 = nodes[1].put("user:1", b"Alice Updated", context=vc)
    assert ok
    print(f"PUT user:1 = Alice Updated, vc={vc2}")

    ok, versions = nodes[3].get("user:1")
    assert ok
    latest = max(versions, key=lambda v: v.timestamp)
    print(f"GET user:1 from node-3: {latest.value}")


def test_concurrent_writes():
    nodes = []
    for i in range(5):
        node = KVNode(f"node-{i}", f"localhost:{9000+i}")
        nodes.append(node)
    for i in range(1, len(nodes)):
        for j in range(i):
            nodes[i].join_cluster(nodes[j])

    ok, vc = nodes[0].put("counter", b"0")
    assert ok

    ok, vc_a = nodes[0].put("counter", b"1", context=vc)
    ok, vc_b = nodes[2].put("counter", b"2", context=vc)

    ok, versions = nodes[1].get("counter")
    print(f"Concurrent writes produced {len(versions)} versions:")
    for v in versions:
        print(f"  value={v.value}, vc={v.vector_clock}")

    if len(versions) > 1:
        print("CONFLICT DETECTED - application must resolve")


def test_anti_entropy():
    nodes = []
    for i in range(3):
        node = KVNode(f"node-{i}", f"localhost:{9000+i}", QuorumConfig(n=3, r=1, w=1))
        nodes.append(node)
    for i in range(1, len(nodes)):
        for j in range(i):
            nodes[i].join_cluster(nodes[j])

    nodes[0].storage.put("key-a", b"value-a")
    nodes[1].storage.put("key-b", b"value-b")

    assert len(nodes[0].storage.get("key-b")) == 0
    assert len(nodes[1].storage.get("key-a")) == 0

    nodes[0].anti_entropy_sync("node-1")

    assert len(nodes[0].storage.get("key-b")) > 0
    assert len(nodes[1].storage.get("key-a")) > 0
    print("Anti-entropy sync successful")


test_basic_operations()
print("---")
test_concurrent_writes()
print("---")
test_anti_entropy()
```

---

## Architecture Diagram

```
  CLIENT REQUEST FLOW:
  +--------+
  | Client |
  +---+----+
      |
      | PUT("user:42", "Alice")
      v
  +----------+  1. Hash key      +----------+
  | Any Node |  2. Find pref list| Hash Ring|
  | (coord)  | <--------------->  |          |
  +----------+                   +----------+
      |
      | 3. Forward to N replicas
      |
  +---+---+---+
  |   |   |   |
  v   v   v   (wait for W responses)
  N1  N2  N3
  |   |   |
  v   v   v
  Store locally with vector clock

  READ FLOW:
  1. Hash key -> preference list
  2. Read from R replicas
  3. Reconcile versions (vector clock comparison)
  4. Return latest (or multiple if conflict)
  5. Read repair: send latest to stale replicas
```

---

## Extensions & Challenges

### Challenge 1: Add Read Repair

After a read, if some replicas have stale data, send
them the latest version. Implement this in the `get` method.

### Challenge 2: Add Hinted Handoff

When a replica node is down, store the write temporarily
on another node with a "hint" about the intended recipient.
When the target comes back, deliver the hinted writes.

### Challenge 3: Add Merkle Tree Anti-Entropy

Instead of comparing all keys, use Merkle trees to
efficiently find which key ranges differ between replicas.

### Challenge 4: Add a Real Network Layer

Replace the in-process `self.cluster` dict with actual
HTTP or gRPC calls between nodes running as separate
processes.

### Challenge 5: Benchmark

Measure:
- Write throughput (ops/sec) vs number of nodes
- Read throughput vs number of nodes
- Latency at p50, p95, p99
- Impact of node failure on throughput

---

## Key Takeaways

```
  1. Consistent hashing distributes keys evenly
  2. Virtual nodes improve balance
  3. Preference list determines replica placement
  4. Quorum (W+R > N) ensures consistency overlap
  5. Vector clocks detect concurrent writes
  6. Gossip detects failures without a coordinator
  7. Anti-entropy synchronizes replicas in background
  8. Coordinator can be ANY node (no single point of failure)
  9. This architecture mirrors DynamoDB and Cassandra
  10. Production systems add: compaction, bloom filters,
      Merkle trees, hinted handoff, read repair
```

---

You've built a simplified version of what powers some of
the most important databases in the world. The concepts
from all 20 lessons come together here: clocks, consensus,
replication, partitioning, failure detection, and more.
