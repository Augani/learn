# Lesson 13: Failure Detection

> Is the other node dead, or just slow? This question
> haunts every distributed system ever built.

---

## The Analogy

You call your friend. No answer. Are they:
- Dead? (crashed)
- In the shower? (slow, will respond soon)
- Phone is off? (network partition)
- Screening your calls? (overloaded, dropping requests)

You can't tell. All you know is: no response YET.
This is the **fundamental problem** of failure detection
in distributed systems.

```
  +--------+   request   +--------+
  | Node A | ----------> | Node B |
  +--------+             +--------+
       |
       | waiting...
       | waiting...
       | waiting...
       |
       v
  Is B dead or slow?
  IMPOSSIBLE TO KNOW FOR CERTAIN.
  (FLP impossibility result)
```

---

## Perfect vs Imperfect Detectors

```
  PERFECT FAILURE DETECTOR (impossible in async systems):
  - Never suspects a correct node     (no false positives)
  - Eventually suspects every failed node (completeness)

  REAL-WORLD FAILURE DETECTORS:
  - May suspect correct nodes          (false positives happen)
  - Eventually detect real failures    (completeness)

  TWO PROPERTIES WE CARE ABOUT:
  +-------------------+----------------------------------------+
  | Completeness      | Every failed node is eventually        |
  |                   | detected by every correct node         |
  +-------------------+----------------------------------------+
  | Accuracy          | No correct node is ever suspected      |
  |                   | (unreachable in async systems)         |
  +-------------------+----------------------------------------+

  WE MUST TRADE OFF:
  - Aggressive detection -> fast but many false positives
  - Conservative detection -> slow but few false positives
```

---

## Method 1: Heartbeat-Based Detection

The simplest approach. Every node sends periodic "I'm alive"
messages.

```
  PUSH HEARTBEATS:

  Node B --> Node A:  heartbeat (every 1s)
  Node B --> Node A:  heartbeat
  Node B --> Node A:  heartbeat
  Node B --> Node A:  ........  (missed)
  Node B --> Node A:  ........  (missed)
  Node B --> Node A:  ........  (missed)
                      ^
                      A declares B dead after 3 missed beats

  PARAMETERS:
  +-------------------+----------------------------------------+
  | Heartbeat interval| How often to send (e.g., 1 second)    |
  | Timeout           | How long before declaring dead         |
  |                   | (e.g., 3 * interval = 3 seconds)      |
  +-------------------+----------------------------------------+

  TRADEOFF:
  Short timeout -> fast detection, more false positives
  Long timeout  -> slow detection, fewer false positives
```

```python
import time
from dataclasses import dataclass
from typing import Dict, Optional

@dataclass
class HeartbeatRecord:
    last_seen: float
    status: str = "ALIVE"

class HeartbeatDetector:
    def __init__(self, timeout: float = 3.0):
        self.timeout = timeout
        self.records: Dict[str, HeartbeatRecord] = {}

    def receive_heartbeat(self, node_id: str):
        self.records[node_id] = HeartbeatRecord(
            last_seen=time.time(),
            status="ALIVE",
        )

    def check_nodes(self) -> Dict[str, str]:
        now = time.time()
        results = {}
        for node_id, record in self.records.items():
            elapsed = now - record.last_seen
            if elapsed > self.timeout:
                record.status = "DEAD"
            elif elapsed > self.timeout * 0.6:
                record.status = "SUSPECT"
            else:
                record.status = "ALIVE"
            results[node_id] = record.status
        return results
```

---

## The Problem with Fixed Timeouts

```
  SCENARIO: Network congestion causes 200ms jitter

  Normal RTT: 50ms
  During congestion: 50ms to 250ms

  Fixed timeout = 150ms:
  +--+--+--+--+--+--+--+--+--+--+--+--+--+--> time
  |  HB |  HB |  HB |  HB |     HB      |
  50ms  50ms  50ms  50ms  250ms (congestion)
                           ^
                           FALSE POSITIVE!
                           Node was alive but slow.

  Fixed timeout = 500ms:
  Node actually crashes at T=0.
  Detected at T=500ms.
  500ms of serving stale data!

  PROBLEM: no single fixed timeout works for all conditions.
```

---

## Method 2: Phi Accrual Failure Detector

Used by Akka and Cassandra. Instead of binary alive/dead,
outputs a SUSPICION LEVEL (phi) that increases over time.

```
  CORE IDEA:
  Track the DISTRIBUTION of heartbeat arrival times.
  Use it to compute probability of failure.

  Heartbeat arrivals (intervals in ms):
  100, 102, 98, 101, 99, 103, 100, 97, 101, 100

  Mean = 100.1ms
  Std  = 1.8ms

  Now, if 150ms pass with no heartbeat:
  How likely is this given the normal distribution?

  phi = -log10(P(interval > 150ms | mean=100, std=1.8))
  phi ≈ very high -> definitely suspicious

  If 105ms pass:
  phi = -log10(P(interval > 105ms | mean=100, std=1.8))
  phi ≈ low -> probably just normal jitter

  +----+
  |    |
  | ph |  HIGH phi --> likely dead
  | i  |  /
  |    | /
  |    |/     LOW phi --> probably alive
  +----+----+----+----+----+
       100  120  140  160  time since last HB (ms)
```

```python
import math
from collections import deque

class PhiAccrualDetector:
    def __init__(self, threshold: float = 8.0, window_size: int = 100):
        self.threshold = threshold
        self.window_size = window_size
        self.intervals = deque(maxlen=window_size)
        self.last_heartbeat: float = 0.0

    def heartbeat(self, now: float):
        if self.last_heartbeat > 0:
            interval = now - self.last_heartbeat
            self.intervals.append(interval)
        self.last_heartbeat = now

    def _mean(self) -> float:
        if not self.intervals:
            return 0.0
        return sum(self.intervals) / len(self.intervals)

    def _variance(self) -> float:
        if len(self.intervals) < 2:
            return 0.0
        mean = self._mean()
        return sum((x - mean) ** 2 for x in self.intervals) / len(self.intervals)

    def _std(self) -> float:
        return max(math.sqrt(self._variance()), 0.001)

    def phi(self, now: float) -> float:
        if not self.intervals or self.last_heartbeat == 0:
            return 0.0

        elapsed = now - self.last_heartbeat
        mean = self._mean()
        std = self._std()

        y = (elapsed - mean) / std
        prob_alive = 1.0 / (1.0 + math.exp(y))

        if prob_alive < 1e-15:
            return 15.0
        return -math.log10(prob_alive)

    def is_alive(self, now: float) -> bool:
        return self.phi(now) < self.threshold


detector = PhiAccrualDetector(threshold=8.0)

for t in range(0, 10000, 100):
    detector.heartbeat(t / 1000.0)

print(f"Normal (100ms later): phi={detector.phi(10.1):.2f}")
print(f"Late (200ms later):   phi={detector.phi(10.2):.2f}")
print(f"Very late (500ms):    phi={detector.phi(10.5):.2f}")
print(f"Dead? (2s later):     phi={detector.phi(12.0):.2f}")
```

---

## Method 3: SWIM Failure Detection

Scalable Weakly-consistent Infection-style Membership.
Combines direct and indirect probes.

```
  SWIM PROTOCOL ROUND (every T seconds):

  Step 1: DIRECT PROBE
  +---+  ping  +---+
  | A | -----> | B |
  +---+        +---+
               timeout?
                 |
                 v
  Step 2: INDIRECT PROBE (ask K helpers)
  +---+ ping-req +---+ ping +---+
  | A | -------> | C | ---> | B |
  +---+          +---+      +---+
  | A | -------> | D | ---> | B |
  +---+          +---+      +---+

  If ANY indirect probe gets a response: B is ALIVE
  If ALL fail: B is SUSPECT

  Step 3: SUSPICION
  B marked SUSPECT. Gossip this to all nodes.
  If B sends any message: back to ALIVE.
  If suspicion timeout expires: B is DEAD.

  +-------+              +---------+           +------+
  | ALIVE | --timeout--> | SUSPECT | --time--> | DEAD |
  +-------+              +---------+           +------+
      ^                       |
      +---heard from B--------+
```

### Why SWIM Is Better Than All-to-All Heartbeats

```
  ALL-TO-ALL HEARTBEATS:
  Every node sends to every other node.
  N nodes -> N*(N-1) messages per round.
  100 nodes -> 9,900 messages per round!

  +---+     +---+
  | A | <-> | B |     N=5: 20 messages/round
  | A | <-> | C |
  | A | <-> | D |
  | A | <-> | E |
  | B | <-> | C |     (fully connected)
  | B | <-> | D |
  ... etc ...

  SWIM:
  Each node probes ONE random node per round.
  N nodes -> N messages per round.
  100 nodes -> 100 messages per round!

  +---+ --> random +---+
  | A |            | ? |     N=5: 5 messages/round
  +---+            +---+

  SWIM: O(N) messages
  All-to-All: O(N^2) messages
```

---

## Suspicion Mechanism

```
  WHY NOT DECLARE DEAD IMMEDIATELY?

  False positives are expensive:
  - Trigger unnecessary data migration
  - Cause client reconnections
  - May split the cluster

  SUSPICION SUBPROTOCOL:
  1. Mark node as SUSPECT (not DEAD yet)
  2. Gossip the suspicion to all nodes
  3. The suspected node can REFUTE by sending an ALIVE message
     with a higher incarnation number
  4. If no refutation within timeout: declare DEAD

  INCARNATION NUMBERS:
  Node B suspected -> B increments incarnation to 5
  B sends: "I'm alive, incarnation=5"
  This overrides "B suspect, incarnation=4"

  Higher incarnation always wins.
```

---

## Failure Detection in Practice

```
  +-----------------+---------------------+------------------+
  | System          | Detector            | Timeout          |
  +-----------------+---------------------+------------------+
  | ZooKeeper       | Session heartbeat   | tickTime * 2     |
  | Cassandra       | Phi accrual         | phi > 8          |
  | Akka Cluster    | Phi accrual         | configurable     |
  | Consul          | SWIM + gossip       | 5s probe + 3s    |
  | etcd            | Heartbeat + lease   | election timeout  |
  | Kubernetes      | kubelet heartbeat   | 40s default      |
  +-----------------+---------------------+------------------+

  KUBERNETES NODE DETECTION:
  kubelet sends heartbeat every 10s
  Node controller checks every 5s
  Marks NotReady after 40s (4 missed)
  Pods evicted after 5 minutes
  TOTAL: up to 5+ minutes to recover from node failure!
```

---

## Building a Complete Detector

```python
import time
import random
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

class NodeStatus(Enum):
    ALIVE = "ALIVE"
    SUSPECT = "SUSPECT"
    DEAD = "DEAD"

@dataclass
class MemberInfo:
    node_id: str
    status: NodeStatus = NodeStatus.ALIVE
    incarnation: int = 0
    suspect_time: Optional[float] = None
    last_heartbeat: float = 0.0

class SWIMDetector:
    def __init__(
        self,
        node_id: str,
        probe_interval: float = 1.0,
        probe_timeout: float = 0.5,
        suspect_timeout: float = 5.0,
        indirect_probes: int = 3,
    ):
        self.node_id = node_id
        self.probe_interval = probe_interval
        self.probe_timeout = probe_timeout
        self.suspect_timeout = suspect_timeout
        self.indirect_probes = indirect_probes
        self.members: Dict[str, MemberInfo] = {}
        self.incarnation = 0

    def add_member(self, node_id: str):
        self.members[node_id] = MemberInfo(
            node_id=node_id,
            last_heartbeat=time.time(),
        )

    def receive_ack(self, from_node: str):
        if from_node in self.members:
            member = self.members[from_node]
            member.last_heartbeat = time.time()
            if member.status == NodeStatus.SUSPECT:
                member.status = NodeStatus.ALIVE
                member.suspect_time = None

    def suspect_node(self, node_id: str):
        if node_id not in self.members:
            return
        member = self.members[node_id]
        if member.status == NodeStatus.ALIVE:
            member.status = NodeStatus.SUSPECT
            member.suspect_time = time.time()

    def refute_suspicion(self):
        self.incarnation += 1
        return {
            "node_id": self.node_id,
            "status": "ALIVE",
            "incarnation": self.incarnation,
        }

    def process_suspicion_timeout(self):
        now = time.time()
        for node_id, member in self.members.items():
            if member.status == NodeStatus.SUSPECT:
                if member.suspect_time and (now - member.suspect_time) > self.suspect_timeout:
                    member.status = NodeStatus.DEAD

    def select_probe_target(self) -> Optional[str]:
        alive = [
            nid for nid, m in self.members.items()
            if m.status != NodeStatus.DEAD
        ]
        if not alive:
            return None
        return random.choice(alive)

    def select_indirect_probers(self, exclude: str) -> List[str]:
        candidates = [
            nid for nid, m in self.members.items()
            if m.status == NodeStatus.ALIVE and nid != exclude
        ]
        k = min(self.indirect_probes, len(candidates))
        return random.sample(candidates, k)

    def get_status_summary(self) -> Dict[str, str]:
        return {
            nid: member.status.value
            for nid, member in self.members.items()
        }
```

---

## Exercises

### Exercise 1: Implement Phi Accrual Detector

Extend the PhiAccrualDetector to:
1. Use an exponential distribution instead of normal
2. Handle the cold-start problem (not enough data yet)
3. Add adaptive threshold based on network conditions

### Exercise 2: SWIM Simulation

Build a full SWIM simulation with 20 nodes:
1. Run the probe protocol for 50 rounds
2. Crash 3 nodes at round 25
3. Measure time to detection for each crashed node
4. Count false positives

### Exercise 3: Compare Detection Strategies

Implement all three strategies (heartbeat, phi-accrual, SWIM)
and compare:
- Detection latency (how fast do they detect real failures?)
- False positive rate (how often do they wrongly suspect?)
- Network overhead (how many messages per round?)

Run with simulated network jitter (add random 0-100ms delay).

### Exercise 4: Suspicion Protocol

Implement the full SWIM suspicion subprotocol:
1. SUSPECT -> gossip to all
2. Suspected node sends ALIVE with incremented incarnation
3. If incarnation is higher, cancel suspicion
4. If timeout expires before refutation, declare DEAD

---

## Key Takeaways

```
  1. You cannot reliably distinguish crash from slow
  2. Fixed timeouts: simple but fragile under jitter
  3. Phi accrual: adapts to network conditions automatically
  4. SWIM: O(N) messages instead of O(N^2)
  5. Suspicion mechanism prevents premature declarations
  6. Incarnation numbers let nodes refute false suspicions
  7. Fast detection = more false positives (fundamental tradeoff)
  8. Piggyback membership changes on probe messages
  9. Real systems use 5s-40s timeouts (seconds, not ms)
  10. Kubernetes takes up to 5 minutes for full recovery
```

---

Next: [Lesson 14 — Distributed Snapshots](./14-distributed-snapshots.md)
