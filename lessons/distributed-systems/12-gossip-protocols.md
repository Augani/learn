# Lesson 12: Gossip Protocols

> How rumors spread through a network — and how distributed
> systems use the same principle to share state.

---

## The Analogy

You hear a juicy rumor at a party. You tell two friends.
Each of them tells two more friends. Within minutes, everyone
at the party knows — even though nobody made an announcement.

No coordinator. No broadcast. Just peer-to-peer sharing.
That's gossip (epidemic) protocols.

```
  Round 0:  Only Alice knows
            [A]

  Round 1:  Alice tells Bob and Carol
            [A] --> [B]
            [A] --> [C]

  Round 2:  Bob tells Dave, Carol tells Eve
            [B] --> [D]
            [C] --> [E]

  Round 3:  Everyone knows (exponential spread)

  SPREAD RATE: O(log N) rounds for N nodes
  100 nodes? ~7 rounds. 1000 nodes? ~10 rounds.
```

---

## Why Gossip?

```
  APPROACH         MSGS PER UPDATE  FAULT TOLERANCE  CONSISTENCY
  ==============   ===============  ===============  ===========
  Central server   O(N)             Single point     Strong
  Broadcast        O(N)             Any sender       Unreliable
  Gossip           O(N log N)       Any subset       Eventual

  GOSSIP WINS WHEN:
  +-----------------------------------------------+
  | Nodes join/leave frequently                   |
  | No reliable broadcast available               |
  | Fault tolerance is critical                   |
  | Exact consistency timing doesn't matter       |
  | Scale is large (100s to 1000s of nodes)       |
  +-----------------------------------------------+
```

---

## Three Gossip Styles

```
  1. PUSH GOSSIP
  +---------+                    +---------+
  | Node A  | --- "I have X" -> | Node B  |
  | has X   |                    | now has X|
  +---------+                    +---------+
  Good for: spreading new information fast

  2. PULL GOSSIP
  +---------+                    +---------+
  | Node A  | <- "What's new?" -| Node B  |
  | has X   | --- "Here's X" -> | gets X  |
  +---------+                    +---------+
  Good for: catching up after being offline

  3. PUSH-PULL GOSSIP
  +---------+                    +---------+
  | Node A  | <-- exchange --->  | Node B  |
  | has X   |     state          | has Y   |
  +---------+                    +---------+
  Both now have {X, Y}
  Good for: rapid convergence
```

---

## Anti-Entropy Protocol

Periodically, each node picks a random peer and reconciles
all differences. This is the "background cleanup" protocol.

```
  ANTI-ENTROPY ROUND:

  Node A state: {key1: v1, key2: v2, key3: v3}
  Node B state: {key1: v1, key2: v2_old, key4: v4}

  A picks B randomly:
  - Compare states
  - A sends: key3 (B missing), key2 update
  - B sends: key4 (A missing)

  After:
  Node A: {key1: v1, key2: v2, key3: v3, key4: v4}
  Node B: {key1: v1, key2: v2, key3: v3, key4: v4}

  CONVERGENCE: guaranteed if every node is eventually
  picked by some other node (random selection ensures this).
```

---

## Rumor Mongering

More efficient than anti-entropy for fresh updates.

```
  STATE MACHINE FOR A RUMOR:

  +------------+    tell random    +----------+
  | SUSCEPTIBLE| <-- peer hears -- | INFECTED |
  +------------+                   +----------+
                                       |
                      too many peers   |  picked peer
                      already know it  |  already knows
                                       v
                                   +----------+
                                   | REMOVED  |
                                   +----------+
                                   (stop spreading)

  Each infected node:
  1. Pick random peer
  2. Send the rumor
  3. If peer already knew it, increment "stale" counter
  4. If stale counter > threshold, stop spreading (REMOVED)

  This prevents infinite gossiping about old news.
```

---

## Failure Detection with Gossip

### SWIM Protocol (Scalable Weakly-consistent Infection-style Membership)

Used by Consul, Serf, Memberlist (HashiCorp).

```
  BASIC SWIM:

  Every T seconds, node A:
  1. Pick random node B
  2. Send PING to B
  3. If B responds: B is alive
  4. If B doesn't respond within timeout:
     a. Pick K random other nodes
     b. Ask them to PING B (indirect probe)
     c. If any succeed: B is alive
     d. If ALL fail: suspect B is dead

  +---+  ping   +---+
  | A | ------> | B |  (no response)
  +---+         +---+
    |
    |  ping-req  +---+  ping  +---+
    +----------> | C | -----> | B |  (no response)
    |            +---+        +---+
    |  ping-req  +---+  ping  +---+
    +----------> | D | -----> | B |  (no response)
                 +---+        +---+

  All indirect probes fail -> B is SUSPECT
```

### SWIM + Gossip Dissemination

```
  KEY INSIGHT: piggyback membership updates on SWIM messages

  Instead of sending separate "Node B is dead" messages,
  attach membership updates to every PING and ACK:

  PING from A to C:
  +------------------+
  | PING             |
  | piggyback:       |
  |   B: SUSPECT     |
  |   E: JOINED      |
  |   F: LEFT        |
  +------------------+

  ACK from C to A:
  +------------------+
  | ACK              |
  | piggyback:       |
  |   G: ALIVE       |
  |   H: SUSPECT     |
  +------------------+

  ZERO extra network overhead for membership updates!
```

---

## Crdt + Gossip = Distributed State

```
  POWERFUL COMBINATION:

  Each node maintains CRDTs for shared state.
  Gossip periodically exchanges CRDT states.
  CRDTs handle merge automatically.

  Node A            Gossip            Node B
  +--------+    push-pull state    +--------+
  | Counter|  <================>   | Counter|
  | Set    |    every 200ms        | Set    |
  | Map    |                       | Map    |
  +--------+                       +--------+

  Result: eventually consistent shared state
  with no leader, no consensus, no coordination.
```

---

## Implementing a Gossip Protocol

```python
import random
import time
from dataclasses import dataclass, field
from typing import Dict, Set, Optional

@dataclass
class NodeState:
    node_id: str
    heartbeat: int = 0
    timestamp: float = 0.0
    status: str = "ALIVE"

class GossipNode:
    def __init__(self, node_id: str, all_nodes: list):
        self.node_id = node_id
        self.all_nodes = all_nodes
        self.membership: Dict[str, NodeState] = {}
        self.membership[node_id] = NodeState(
            node_id=node_id,
            heartbeat=0,
            timestamp=time.time(),
        )

    def heartbeat(self):
        self.membership[self.node_id].heartbeat += 1
        self.membership[self.node_id].timestamp = time.time()

    def pick_random_peer(self) -> Optional[str]:
        peers = [n for n in self.all_nodes if n != self.node_id]
        if not peers:
            return None
        return random.choice(peers)

    def prepare_digest(self) -> Dict[str, NodeState]:
        return dict(self.membership)

    def receive_digest(self, remote_state: Dict[str, NodeState]):
        for node_id, remote_info in remote_state.items():
            local_info = self.membership.get(node_id)
            if local_info is None:
                self.membership[node_id] = NodeState(
                    node_id=remote_info.node_id,
                    heartbeat=remote_info.heartbeat,
                    timestamp=time.time(),
                )
            elif remote_info.heartbeat > local_info.heartbeat:
                local_info.heartbeat = remote_info.heartbeat
                local_info.timestamp = time.time()
                local_info.status = remote_info.status

    def detect_failures(self, timeout: float = 5.0):
        now = time.time()
        for node_id, state in self.membership.items():
            if node_id == self.node_id:
                continue
            if now - state.timestamp > timeout:
                state.status = "SUSPECT"
            if now - state.timestamp > timeout * 3:
                state.status = "DEAD"

    def gossip_round(self, cluster: dict):
        self.heartbeat()
        peer_id = self.pick_random_peer()
        if peer_id is None or peer_id not in cluster:
            return
        peer = cluster[peer_id]
        my_digest = self.prepare_digest()
        peer_digest = peer.prepare_digest()
        self.receive_digest(peer_digest)
        peer.receive_digest(my_digest)


nodes = ["A", "B", "C", "D", "E"]
cluster = {n: GossipNode(n, nodes) for n in nodes}

for round_num in range(10):
    for node_id in nodes:
        cluster[node_id].gossip_round(cluster)

for node_id in nodes:
    known = list(cluster[node_id].membership.keys())
    print(f"Node {node_id} knows about: {sorted(known)}")
```

---

## Convergence Speed

```
  HOW FAST DOES GOSSIP CONVERGE?

  N nodes, each round picks 1 random peer (push-pull):

  +----------+-------------------+
  | Nodes    | Rounds to 100%   |
  +----------+-------------------+
  | 10       | ~5               |
  | 100      | ~7               |
  | 1,000    | ~10              |
  | 10,000   | ~14              |
  | 100,000  | ~17              |
  +----------+-------------------+

  O(log N) convergence!

  WHY: each round, the number of informed nodes roughly
  doubles (exponential growth until saturation).

  PROBABILITY OF A NODE NOT HEARING:
  After c*log(N) rounds: (1/N)^c

  With c=3: probability < 1/N^3
  For N=1000: < 0.000000001
```

---

## Gossip in Production

```
  +------------------+---------------------+-----------------------+
  | System           | Gossip Used For     | Protocol              |
  +------------------+---------------------+-----------------------+
  | Cassandra        | Membership, schema  | Custom gossip         |
  | Consul           | Membership, health  | SWIM + gossip         |
  | DynamoDB         | Membership, routing | Gossip                |
  | CockroachDB      | Node liveness       | Custom gossip         |
  | Redis Cluster    | Cluster state       | Gossip bus            |
  | Serf (HashiCorp) | Membership, events  | SWIM                  |
  +------------------+---------------------+-----------------------+
```

---

## Exercises

### Exercise 1: Simulate Gossip Spread

Using the Python code above, modify it to track how many
rounds it takes for ALL nodes to learn about a new node "F"
that joins mid-simulation. Plot the convergence.

### Exercise 2: Implement Failure Detection

Extend the GossipNode class to:
1. Simulate a node going offline (stop heartbeating)
2. Detect it as SUSPECT after 3 missed rounds
3. Declare it DEAD after 9 missed rounds
4. Handle the case where it comes back (ALIVE again)

### Exercise 3: Bandwidth Optimization

The naive approach sends the FULL membership list every round.
Implement a digest-based approach:
1. Send only (node_id, heartbeat) pairs as a digest
2. Receiver responds with only the entries where its info is newer
3. Measure the bandwidth savings vs full-state exchange

### Exercise 4: Partition Simulation

Split 10 nodes into two groups of 5 (simulating a network
partition). Run gossip within each group. Then heal the
partition. How many rounds until full convergence?

---

## Key Takeaways

```
  1. Gossip spreads information in O(log N) rounds
  2. Three styles: push, pull, push-pull
  3. Anti-entropy: periodic full-state reconciliation
  4. Rumor mongering: efficient for fresh updates
  5. SWIM: gossip-based failure detection
  6. Piggyback membership updates on protocol messages
  7. Combine CRDTs + gossip for coordination-free state
  8. Probabilistic guarantee: not 100%, but very close
  9. Scales to thousands of nodes
  10. Used in Cassandra, Consul, DynamoDB, Redis Cluster
```

---

Next: [Lesson 13 — Failure Detection](./13-failure-detection.md)
