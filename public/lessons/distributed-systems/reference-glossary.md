# Distributed Systems Glossary

Quick reference for all distributed systems terms.

---

## A

**Anti-Entropy** — Background process that compares replicas and reconciles differences. Ensures eventual consistency even when gossip misses updates.

**Availability** — The system responds to every request (no errors), though the response may not contain the most recent data. The "A" in CAP.

**Atomic Broadcast** — A broadcast protocol where all correct processes deliver the same messages in the same order. Equivalent to consensus.

---

## B

**Byzantine Fault** — A fault where a node behaves arbitrarily (sends wrong data, lies, acts maliciously). Harder to handle than crash faults.

**Bulkhead** — Isolation pattern that prevents failure in one component from cascading to others. Named after ship compartments.

---

## C

**CAP Theorem** — In a network partition, a distributed system must choose between Consistency and Availability. You can't have both.

**Causal Consistency** — If operation A causally precedes B, then every node sees A before B. Concurrent operations may be seen in any order.

**Chain Replication** — Replication where writes go to a head node and propagate down a chain. Reads served by the tail. Provides strong consistency.

**Chandy-Lamport Algorithm** — Algorithm for taking consistent distributed snapshots using marker messages on FIFO channels.

**Circuit Breaker** — Pattern that stops calling a failing service after a threshold of failures. Prevents cascading failures.

**Clock Skew** — The difference between clocks on different machines. Can be milliseconds to seconds.

**Conflict-Free Replicated Data Type (CRDT)** — Data structure that can be replicated across nodes and merged automatically without coordination.

**Consensus** — Agreement among distributed nodes on a single value. Solved by Paxos, Raft, Zab.

**Consistent Cut** — A snapshot of a distributed system where if an effect is included, its cause is also included.

**Consistent Hashing** — Hashing scheme where adding/removing a node only moves K/N keys (K=total keys, N=nodes).

**Coordinator** — A node that orchestrates a distributed operation (e.g., 2PC coordinator, request coordinator).

**CRAQ** — Chain Replication with Apportioned Queries. Allows reads from any chain node while maintaining strong consistency.

---

## D

**Distributed Transaction** — A transaction that spans multiple nodes or services. Can use 2PC, 3PC, or Sagas.

**Domino Effect** — In uncoordinated checkpointing, a failure causes cascading rollbacks across all processes back to the initial state.

---

## E

**Epoch** — A logical time period in a distributed system. New epoch typically starts with a new leader.

**Eventual Consistency** — If no new updates are made, all replicas will eventually converge to the same value.

---

## F

**Failure Detector** — A component that monitors other nodes and reports suspected failures. Can be heartbeat-based, gossip-based, or adaptive.

**Fencing Token** — A monotonically increasing number attached to a lock/lease, used to prevent stale lock holders from making writes.

**FLP Impossibility** — Proven result that deterministic consensus is impossible in an asynchronous system with even one possible crash failure.

---

## G

**Gossip Protocol** — Epidemic-style protocol where nodes randomly exchange information with peers. Spreads updates in O(log N) rounds.

**G-Counter** — Grow-only CRDT counter. Each node has its own counter; total = sum of all.

---

## H

**Happens-Before (→)** — Lamport's partial ordering of events. A → B means A could have caused B.

**Heartbeat** — Periodic "I'm alive" message sent between nodes for failure detection.

**Hinted Handoff** — When a replica is down, another node temporarily stores writes with a "hint" to deliver them when the target recovers.

---

## I

**Idempotent** — An operation that produces the same result when applied multiple times. Critical for retry safety.

**Incarnation Number** — A counter a node increments to refute false suspicion in SWIM-style protocols.

---

## L

**Lamport Clock** — Logical clock that assigns a monotonically increasing counter to events. Provides causal ordering.

**Lease** — A time-limited lock. If the holder dies, the lease expires automatically.

**Leader Election** — Process of choosing one node as the leader/primary among a group. Used in Raft, Paxos, ZAB.

**Linearizability** — Strongest consistency model. Every operation appears to execute atomically at some point between invocation and response.

---

## M

**Merkle Tree** — Hash tree where each leaf is a hash of a data block and each internal node is a hash of its children. Efficient difference detection between replicas.

**Multi-Paxos** — Extension of Paxos that elects a stable leader to avoid the prepare phase for subsequent proposals.

---

## N

**Network Partition** — When some nodes cannot communicate with others due to network failure. The "P" in CAP.

---

## O

**OR-Set (Observed-Remove Set)** — CRDT set that supports both add and remove. Each element gets a unique tag; remove only removes observed tags.

---

## P

**PBFT (Practical Byzantine Fault Tolerance)** — Algorithm tolerating up to N/3 Byzantine nodes. Three-phase: pre-prepare, prepare, commit.

**Paxos** — Consensus algorithm by Leslie Lamport. Guarantees agreement among a majority of nodes.

**Phi Accrual Failure Detector** — Adaptive failure detector that outputs a suspicion level (phi) based on heartbeat arrival time distribution.

**PN-Counter** — CRDT counter supporting both increment and decrement. Uses two G-Counters.

**Preference List** — Ordered list of nodes responsible for a given key in consistent hashing.

---

## Q

**Quorum** — The minimum number of nodes that must participate for an operation to succeed. Typically, W + R > N for consistency.

---

## R

**Raft** — Consensus algorithm designed for understandability. Uses leader election, log replication, and safety.

**Read Repair** — During a read, if some replicas return stale data, the coordinator sends them the latest version.

**Replica** — A copy of data stored on a different node for fault tolerance and read scalability.

---

## S

**Saga** — Pattern for distributed transactions using a sequence of local transactions with compensating actions for rollback.

**Shard** — A horizontal partition of data. Same as a partition.

**Sidecar** — A helper process deployed alongside the main service to handle cross-cutting concerns (logging, proxy, etc).

**Split Brain** — When a network partition causes two groups of nodes to each believe they are the leader. Can cause data divergence.

**SWIM** — Scalable Weakly-consistent Infection-style Membership protocol. O(N) failure detection using direct and indirect probes.

---

## T

**Two-Phase Commit (2PC)** — Protocol where a coordinator asks all participants to prepare, then commit. Blocking if coordinator fails.

**Two-Phase Locking (2PL)** — Concurrency control where locks are acquired in a growing phase and released in a shrinking phase.

---

## V

**Vector Clock** — Logical clock that tracks causal relationships between events across multiple nodes. Each node maintains a vector of counters.

**Version Vector** — Similar to vector clock but tracks versions of data items rather than events.

**Virtual Node (VNode)** — Multiple hash ring positions assigned to a single physical node. Improves balance in consistent hashing.

---

## W

**Write-Ahead Log (WAL)** — Log where changes are written before being applied to the main data structure. Enables crash recovery.

---

## Z

**ZAB (ZooKeeper Atomic Broadcast)** — Protocol used by ZooKeeper for consensus. Similar to Paxos but optimized for primary-backup.
