# Lesson 16: Partitioning & Sharding

> One machine can't hold all the data.
> Split it across many machines, but do it smartly.

---

## The Analogy

A library has 10 million books. One room can hold 100,000.
How do you organize 100 rooms so people can find any book?

- By author last name (A-C in room 1, D-F in room 2...)
- By genre (fiction room, science room, history room...)
- By a code computed from the ISBN (hash-based)

Each approach has tradeoffs for finding books, adding new
ones, and keeping rooms balanced.

```
  PARTITIONING = splitting data across nodes
  SHARDING     = same concept (term used by MongoDB, etc.)

  +----------+    +----------+    +----------+
  | Shard 1  |    | Shard 2  |    | Shard 3  |
  | A-H      |    | I-P      |    | Q-Z      |
  | 3.2M rows|    | 3.5M rows|    | 3.3M rows|
  +----------+    +----------+    +----------+

  GOALS:
  1. Spread data EVENLY (no hot spots)
  2. Spread QUERIES evenly (no hot nodes)
  3. Minimize CROSS-SHARD operations
  4. Allow GROWTH (add more shards easily)
```

---

## Strategy 1: Range Partitioning

Assign contiguous ranges of the key to each partition.

```
  KEY: user_id (integer)

  Shard 1: user_id 0 - 999,999
  Shard 2: user_id 1,000,000 - 1,999,999
  Shard 3: user_id 2,000,000 - 2,999,999

  LOOKUP: user_id = 1,500,000 -> Shard 2 (simple math)

  +----------+----------+----------+
  | 0 - 999K | 1M - 2M  | 2M - 3M |
  | Shard 1  | Shard 2  | Shard 3  |
  +----------+----------+----------+

  PROS:
  + Range queries are efficient (scan one shard)
  + Simple to understand
  + Good for time-series data (partition by date)

  CONS:
  - HOT SPOTS: new users all go to the latest shard
  - UNEVEN: some ranges may have way more data
  - Celebrity problem: popular user's shard gets hammered
```

### Time-Series Example

```
  SENSOR DATA: partition by time range

  2024-01: Shard 1   (historical, cold)
  2024-02: Shard 2   (historical, cold)
  2024-03: Shard 3   (historical, cold)
  ...
  2024-12: Shard 12  (current, HOT!)

  ALL writes go to the latest shard!
  Solution: compound key (sensor_id + timestamp)
  Spreads writes across shards.
```

---

## Strategy 2: Hash Partitioning

Hash the key, mod by number of partitions.

```
  hash(key) % num_partitions = shard_id

  hash("alice") % 3 = 1  -> Shard 1
  hash("bob")   % 3 = 0  -> Shard 0
  hash("carol") % 3 = 2  -> Shard 2

  +--------+   hash   +--------+   mod 3   +--------+
  | "alice"|  ------> | 0x7F.. |  -------> | Shard 1|
  +--------+          +--------+           +--------+

  PROS:
  + Excellent distribution (no hot spots)
  + Works for any key type
  + Simple to implement

  CONS:
  - Range queries impossible (adjacent keys scattered)
  - Adding shards = rehash EVERYTHING (N/(N+1) keys move)
  - Must query ALL shards for range scans
```

---

## Strategy 3: Consistent Hashing

Solves the "adding shards" problem. Only K/N keys move
when adding a node (K = keys, N = nodes).

```
  THE HASH RING:

  Imagine a circle from 0 to 2^32.
  Place nodes at positions on the ring.
  Each key hashes to a position, assigned to next node clockwise.

            Node A (pos 100)
           /
  0 ------+----------+-------+----------+------ 2^32
                     Node B   Node C
                     (pos 400) (pos 700)

  key "alice" hashes to 250 -> assigned to Node B (next CW)
  key "bob" hashes to 550   -> assigned to Node C

  ADDING Node D at position 300:
  Only keys between 100-300 move (from B to D).
  Everything else stays put!

            Node A     Node D    Node B    Node C
           /          /
  0 ------+----------+----------+----------+------ 2^32
          100        300        400        700
```

### Virtual Nodes for Balance

```
  PROBLEM: with few nodes, distribution is uneven.

  SOLUTION: each physical node gets many virtual positions.

  Physical Node A -> vnodes at: 100, 350, 800, 950
  Physical Node B -> vnodes at: 200, 450, 650, 880
  Physical Node C -> vnodes at: 50, 300, 550, 750

  More vnodes = more even distribution.

  Cassandra default: 256 vnodes per physical node.
```

---

## Strategy 4: Directory-Based Partitioning

A lookup table maps each key (or key range) to a shard.

```
  DIRECTORY SERVICE:
  +----------+---------+
  | Key/Range| Shard   |
  +----------+---------+
  | user:1   | Shard A |
  | user:2   | Shard B |
  | user:3   | Shard A |
  | user:4   | Shard C |
  +----------+---------+

  PROS:
  + Maximum flexibility (any mapping)
  + Can optimize for access patterns
  + Can move individual keys without rehashing

  CONS:
  - Directory is a single point of failure
  - Directory lookup adds latency
  - Directory itself needs to be distributed
  - Must be kept in sync

  USED BY: HBase (via ZooKeeper), Azure Table Storage
```

---

## Partitioning Secondary Indexes

Primary key determines the partition. But what about
queries on other fields?

```
  DATA: {user_id, name, city, age}
  Partitioned by user_id.

  Query: "Find all users in New York"
  Problem: NYC users are scattered across ALL shards!

  TWO APPROACHES:
```

### Local (Document-Based) Indexes

```
  Each shard maintains its OWN index for its data.

  Shard 1: users 0-999K         Shard 2: users 1M-2M
  +------------------+          +------------------+
  | city_index:      |          | city_index:      |
  |   NYC: [23, 456] |          |   NYC: [1.2M]    |
  |   LA:  [789]     |          |   LA:  [1.5M]    |
  +------------------+          +------------------+

  Query "city=NYC":
  Must query ALL shards and merge results. (scatter-gather)

  PROS: writes are fast (update local index only)
  CONS: reads are slow (fan out to every shard)

  USED BY: MongoDB, Elasticsearch, Cassandra
```

### Global (Term-Based) Indexes

```
  Partition the INDEX itself across nodes.

  Index Shard 1: cities A-M     Index Shard 2: cities N-Z
  +------------------+          +------------------+
  | LA: [Shard1:789, |          | NYC: [Shard1:23, |
  |      Shard2:1.5M]|          |       Shard1:456,|
  +------------------+          |       Shard2:1.2M]|
                                +------------------+

  Query "city=NYC": go to Index Shard 2, get all results.
  Single shard read! But:

  PROS: reads are fast (single index shard)
  CONS: writes are slow (must update remote index shard)
        index updates are often asynchronous (eventual consistency)

  USED BY: DynamoDB global secondary indexes, Riak
```

---

## Rebalancing Strategies

When you add or remove nodes, data must move.

```
  STRATEGY 1: FIXED NUMBER OF PARTITIONS

  Create many more partitions than nodes.
  Assign multiple partitions per node.
  New node steals some partitions.

  Before (3 nodes, 12 partitions):
  Node A: [P1, P2, P3, P4]
  Node B: [P5, P6, P7, P8]
  Node C: [P9, P10, P11, P12]

  Add Node D (steal one from each):
  Node A: [P1, P2, P3]
  Node B: [P5, P6, P7]
  Node C: [P9, P10, P11]
  Node D: [P4, P8, P12]

  USED BY: Elasticsearch, Couchbase, Voldemort

  STRATEGY 2: DYNAMIC PARTITIONING

  Split partitions when they get too big.
  Merge when they get too small.
  Like a B-tree for partitions.

  P1 (10GB) -> split -> P1a (5GB), P1b (5GB)
  P3 (100MB) + P4 (50MB) -> merge -> P3 (150MB)

  USED BY: HBase, MongoDB

  STRATEGY 3: PROPORTIONAL TO NODES

  Fixed number of partitions per node.
  New node splits existing partitions.

  USED BY: Cassandra (256 vnodes per node)
```

---

## Cross-Shard Operations

```
  THE HARD PART: operations that span multiple shards.

  TRANSFER $100 FROM USER 1 (Shard A) TO USER 2 (Shard B):

  Can't use a single transaction!

  OPTION 1: Two-phase commit (2PC)
  Coordinator asks both shards to prepare.
  Both say yes -> coordinator says commit.
  Slow. Coordinator is single point of failure.

  OPTION 2: Saga pattern
  Shard A: debit $100 from User 1
  Shard B: credit $100 to User 2
  If Shard B fails: compensate by crediting $100 back to User 1

  OPTION 3: Avoid cross-shard operations
  Partition by account_id so both users are on same shard.
  Not always possible.

  RULE OF THUMB:
  +---------------------------------------------------+
  | Design your partition key so that 90%+ of queries  |
  | hit a SINGLE shard. Cross-shard = last resort.     |
  +---------------------------------------------------+
```

---

## Choosing a Partition Key

```python
class PartitionKeyAnalyzer:
    def __init__(self, num_shards: int):
        self.num_shards = num_shards

    def hash_partition(self, key: str) -> int:
        return hash(key) % self.num_shards

    def range_partition(self, key: int, boundaries: list) -> int:
        for i, boundary in enumerate(boundaries):
            if key < boundary:
                return i
        return len(boundaries)

    def compound_key_partition(self, tenant_id: str, record_id: str) -> int:
        return hash(tenant_id) % self.num_shards

    def analyze_distribution(self, keys: list) -> dict:
        distribution = {}
        for key in keys:
            shard = self.hash_partition(str(key))
            distribution[shard] = distribution.get(shard, 0) + 1
        total = len(keys)
        ideal = total / self.num_shards
        skew = max(distribution.values()) / ideal if ideal > 0 else 0
        return {
            "distribution": distribution,
            "ideal_per_shard": ideal,
            "max_shard": max(distribution.values()),
            "min_shard": min(distribution.values()),
            "skew_ratio": skew,
        }


analyzer = PartitionKeyAnalyzer(num_shards=4)

user_ids = [f"user_{i}" for i in range(10000)]
result = analyzer.analyze_distribution(user_ids)
print(f"Hash distribution skew: {result['skew_ratio']:.2f}")
print(f"Per-shard counts: {result['distribution']}")
```

---

## Partitioning in Production

```
  +------------------+--------------------+-------------------+
  | System           | Partitioning       | Rebalancing       |
  +------------------+--------------------+-------------------+
  | Cassandra        | Consistent hash    | Vnodes, streaming |
  | MongoDB          | Range or hash      | Balancer process  |
  | DynamoDB         | Hash               | Automatic split   |
  | CockroachDB      | Range              | Automatic split   |
  | Elasticsearch    | Hash (fixed #)     | Shard allocation  |
  | Kafka            | Hash (partitions)  | Reassignment      |
  | Redis Cluster    | Hash slots (16384) | Manual/auto       |
  | Spanner          | Range (hierarchy)  | Auto-split        |
  +------------------+--------------------+-------------------+
```

---

## Exercises

### Exercise 1: Implement Consistent Hashing

```python
import hashlib
from bisect import bisect_right

class ConsistentHash:
    def __init__(self, vnodes_per_node: int = 150):
        self.vnodes_per_node = vnodes_per_node
        self.ring = []
        self.node_map = {}

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)

    def add_node(self, node: str):
        for i in range(self.vnodes_per_node):
            vnode_key = f"{node}:vnode{i}"
            position = self._hash(vnode_key)
            self.ring.append(position)
            self.node_map[position] = node
        self.ring.sort()

    def remove_node(self, node: str):
        positions_to_remove = [
            pos for pos, n in self.node_map.items() if n == node
        ]
        for pos in positions_to_remove:
            self.ring.remove(pos)
            del self.node_map[pos]

    def get_node(self, key: str) -> str:
        if not self.ring:
            raise ValueError("No nodes in the ring")
        position = self._hash(key)
        idx = bisect_right(self.ring, position) % len(self.ring)
        return self.node_map[self.ring[idx]]


ring = ConsistentHash(vnodes_per_node=150)
for node in ["node-A", "node-B", "node-C"]:
    ring.add_node(node)

distribution = {"node-A": 0, "node-B": 0, "node-C": 0}
for i in range(10000):
    node = ring.get_node(f"key-{i}")
    distribution[node] += 1

print("Before adding node:", distribution)

ring.add_node("node-D")
new_distribution = {"node-A": 0, "node-B": 0, "node-C": 0, "node-D": 0}
for i in range(10000):
    node = ring.get_node(f"key-{i}")
    new_distribution[node] += 1

print("After adding node:", new_distribution)
```

### Exercise 2: Hot Spot Detection

Write a monitor that tracks query counts per shard and
alerts when one shard receives 3x more queries than average.
Suggest a re-partitioning strategy.

### Exercise 3: Cross-Shard Transaction

Implement a simple 2PC coordinator for a money transfer
between two shards. Handle the case where one shard
crashes after prepare but before commit.

### Exercise 4: Partition Key Design

For each scenario, choose the best partition key and explain:
1. E-commerce orders (queries by user, by date, by status)
2. Social media posts (queries by author, by hashtag, by time)
3. IoT sensor data (queries by sensor, by region, by time)
4. Chat messages (queries by conversation, by user, by time)

---

## Key Takeaways

```
  1. Range partitioning: good for scans, bad for hot spots
  2. Hash partitioning: even spread, no range queries
  3. Consistent hashing: minimal data movement on rebalance
  4. Virtual nodes improve consistent hash balance
  5. Local indexes: fast writes, scatter-gather reads
  6. Global indexes: fast reads, slow writes
  7. Fixed partition count: simplest rebalancing
  8. Design partition key for single-shard queries
  9. Cross-shard operations are expensive, minimize them
  10. Most systems use hash or range, not directory
```

---

Next: [Lesson 17 — Chain Replication](./17-chain-replication.md)
