# Distributed Systems Algorithm Comparison

Quick reference for choosing the right algorithm.

---

## Consensus Algorithms

```
+-------------+----------+-----------+----------+-----------+------------------+
| Algorithm   | Fault    | Msg per   | Latency  | Leader    | Used By          |
|             | Model    | Decision  | (rounds) | Required? |                  |
+-------------+----------+-----------+----------+-----------+------------------+
| Paxos       | Crash    | O(N)      | 2        | No*       | Chubby, Spanner  |
| Multi-Paxos | Crash    | O(N)      | 1        | Yes       | Chubby, Spanner  |
| Raft        | Crash    | O(N)      | 1        | Yes       | etcd, Consul,    |
|             |          |           |          |           | CockroachDB      |
| ZAB         | Crash    | O(N)      | 1        | Yes       | ZooKeeper        |
| EPaxos      | Crash    | O(N)      | 1-2      | No        | Research         |
| PBFT        | Byzantine| O(N^2)    | 3        | Yes       | Permissioned BC  |
| HotStuff    | Byzantine| O(N)      | 3        | Yes       | Diem/Libra       |
| Tendermint  | Byzantine| O(N^2)    | 2        | Yes       | Cosmos           |
| Nakamoto    | Byzantine| O(N)      | Prob.    | No        | Bitcoin          |
+-------------+----------+-----------+----------+-----------+------------------+
* Basic Paxos has no fixed leader; Multi-Paxos uses a stable leader.
```

---

## Replication Strategies

```
+-------------------+-------------+-----------+-----------+------------------+
| Strategy          | Consistency | Write     | Read      | Failure          |
|                   |             | Latency   | Latency   | Tolerance        |
+-------------------+-------------+-----------+-----------+------------------+
| Single-leader     | Strong      | 1 RTT     | 1 hop     | Leader failover  |
| (Raft, Paxos)     |             | (majority)|           | (election delay) |
+-------------------+-------------+-----------+-----------+------------------+
| Multi-leader      | Eventual    | 1 hop     | 1 hop     | Any leader down  |
| (active-active)   | (conflicts) | (local)   | (local)   | = still works    |
+-------------------+-------------+-----------+-----------+------------------+
| Leaderless        | Tunable     | W hops    | R hops    | Up to N-W or     |
| (Dynamo-style)    | (quorum)    |           |           | N-R failures     |
+-------------------+-------------+-----------+-----------+------------------+
| Chain replication  | Strong      | N hops    | 1 hop     | Head/tail/mid    |
|                   |             | (serial)  | (tail)    | simple recovery  |
+-------------------+-------------+-----------+-----------+------------------+
| CRAQ              | Strong      | N hops    | 1 hop     | Same as chain    |
|                   |             | (serial)  | (any node)|                  |
+-------------------+-------------+-----------+-----------+------------------+
```

---

## Failure Detection

```
+-------------------+-----------+---------------+-------------+--------------+
| Method            | Messages  | Detection     | False       | Adaptive?    |
|                   | per Round | Speed         | Positives   |              |
+-------------------+-----------+---------------+-------------+--------------+
| All-to-all        | O(N^2)    | Fast (1 miss) | Fixed rate  | No           |
| heartbeat         |           |               |             |              |
+-------------------+-----------+---------------+-------------+--------------+
| SWIM              | O(N)      | Fast (1 round)| Low         | No           |
| (direct+indirect) |           |               |             |              |
+-------------------+-----------+---------------+-------------+--------------+
| Phi accrual       | O(N)      | Adaptive      | Very low    | Yes          |
|                   |           |               |             | (learns dist)|
+-------------------+-----------+---------------+-------------+--------------+
| Gossip-based      | O(N)      | O(log N)      | Low         | No           |
|                   |           | rounds        |             |              |
+-------------------+-----------+---------------+-------------+--------------+
```

---

## Partitioning Strategies

```
+-------------------+-------------+-------------+-------------+--------------+
| Strategy          | Range       | Distribution | Rebalancing | Used By      |
|                   | Queries?    |              | Cost        |              |
+-------------------+-------------+-------------+-------------+--------------+
| Range             | Yes         | Uneven       | Move ranges | HBase,       |
|                   |             | (hot spots)  |             | CockroachDB  |
+-------------------+-------------+-------------+-------------+--------------+
| Hash              | No          | Even         | Rehash all  | DynamoDB     |
| (mod N)           |             |              | (N/(N+1))   |              |
+-------------------+-------------+-------------+-------------+--------------+
| Consistent hash   | No          | Good         | Move K/N    | Cassandra,   |
|                   |             | (with vnodes)|             | DynamoDB     |
+-------------------+-------------+-------------+-------------+--------------+
| Directory-based   | Depends     | Configurable | Move entries| HBase        |
|                   |             |              | in directory|              |
+-------------------+-------------+-------------+-------------+--------------+
```

---

## Consistency Models (Strongest to Weakest)

```
+----------------------+--------------------------------------------------+
| Model                | Guarantee                                        |
+----------------------+--------------------------------------------------+
| Strict consistency   | Reads always return most recent write            |
|                      | (requires global clock — impossible)             |
+----------------------+--------------------------------------------------+
| Linearizability      | Operations appear atomic at some point           |
|                      | between invocation and response                  |
+----------------------+--------------------------------------------------+
| Sequential           | All nodes see the same order of operations       |
| consistency          | (but not necessarily real-time order)            |
+----------------------+--------------------------------------------------+
| Causal consistency   | Causally related operations seen in order;       |
|                      | concurrent operations may differ                 |
+----------------------+--------------------------------------------------+
| Read-your-writes     | A process always sees its own writes             |
+----------------------+--------------------------------------------------+
| Monotonic reads      | Once you see a value, you never see older        |
+----------------------+--------------------------------------------------+
| Eventual consistency | All replicas converge given no new writes        |
+----------------------+--------------------------------------------------+
```

---

## CRDT Types

```
+-------------------+-------------+------------------+-----------------------+
| Type              | Operations  | Merge Strategy   | Use Case              |
+-------------------+-------------+------------------+-----------------------+
| G-Counter         | Increment   | Element-wise max | View counts           |
+-------------------+-------------+------------------+-----------------------+
| PN-Counter        | Inc / Dec   | Two G-Counters   | Like counts           |
+-------------------+-------------+------------------+-----------------------+
| G-Set             | Add         | Union            | Tag collections       |
+-------------------+-------------+------------------+-----------------------+
| 2P-Set            | Add/Remove  | Add\Remove sets  | One-time removals     |
|                   | (once)      |                  |                       |
+-------------------+-------------+------------------+-----------------------+
| OR-Set            | Add/Remove  | Tagged elements  | Shopping carts        |
|                   | (re-add OK) |                  |                       |
+-------------------+-------------+------------------+-----------------------+
| LWW-Register      | Write       | Highest timestamp| Simple KV             |
+-------------------+-------------+------------------+-----------------------+
| MV-Register       | Write       | Keep all concur. | Conflict-aware apps   |
+-------------------+-------------+------------------+-----------------------+
| Sequence CRDT     | Insert/Del  | Position-based   | Collaborative editing |
+-------------------+-------------+------------------+-----------------------+
```

---

## Distributed Transaction Approaches

```
+-------------------+-------------+-----------+-------------+--------------+
| Approach          | Consistency | Latency   | Availability| Complexity   |
+-------------------+-------------+-----------+-------------+--------------+
| 2PC               | Strong      | 2 RTT     | Blocking    | Medium       |
|                   |             |           | (coord fail)|              |
+-------------------+-------------+-----------+-------------+--------------+
| 3PC               | Strong      | 3 RTT     | Non-blocking| High         |
|                   |             |           | (in theory) |              |
+-------------------+-------------+-----------+-------------+--------------+
| Saga (choreo)     | Eventual    | N steps   | High        | Medium       |
|                   |             |           |             | (compensate) |
+-------------------+-------------+-----------+-------------+--------------+
| Saga (orchestr)   | Eventual    | N steps   | High        | Medium       |
|                   |             |           |             | (coordinator)|
+-------------------+-------------+-----------+-------------+--------------+
| Calvin            | Strong      | 1 RTT     | High        | High         |
| (deterministic)   |             | (batch)   |             | (det. exec)  |
+-------------------+-------------+-----------+-------------+--------------+
```

---

## Decision Flowchart

```
  Need distributed agreement?
  |
  +-- Trusted nodes only? (datacenter)
  |   |
  |   +-- Need strong consistency?
  |   |   |
  |   |   +-- YES --> Raft / Multi-Paxos
  |   |   +-- NO  --> Gossip + CRDTs
  |   |
  |   +-- Read-heavy workload?
  |       |
  |       +-- YES --> Chain replication (CRAQ)
  |       +-- NO  --> Raft (leader handles all)
  |
  +-- Untrusted / adversarial nodes?
      |
      +-- Permissioned (known set)?
      |   |
      |   +-- YES --> PBFT / HotStuff / Tendermint
      |
      +-- Permissionless (anyone can join)?
          |
          +-- YES --> Nakamoto (PoW) / PoS consensus
```
