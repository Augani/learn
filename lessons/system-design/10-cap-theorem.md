# Lesson 10: CAP Theorem and Distributed Consensus

You have data on 3 servers in different datacenters. A network cable gets
cut between datacenter 1 and datacenter 2. Users are hitting both
datacenters. What do you do?

This is the fundamental problem of distributed systems, and the CAP
theorem tells you that you can't have everything.

---

## The Analogy: Phone Tree During an Emergency

Imagine your neighborhood has an emergency phone tree. When there's a
wildfire warning, the coordinator calls people, who call others, until
everyone knows.

**Consistency**: Everyone gets the EXACT SAME message. If the
coordinator says "evacuate north", nobody hears "evacuate south".

**Availability**: Everyone gets A message, even if it takes a while or
some people get slightly different details.

**Partition tolerance**: The phone tree works even when some phone lines
are down.

When phone lines are working, you get both consistency and availability.
But when lines go down (partition), you have to choose:
- Tell people to wait until lines are restored to get the RIGHT message
  (consistency over availability)
- Let people pass along whatever version they heard, even if it's
  slightly wrong (availability over consistency)

---

## CAP Theorem: The Three Properties

### C — Consistency

Every read receives the most recent write or an error. All nodes see the
same data at the same time.

```
Client writes X=5 to Node A

Node A: X=5   ←── Write happens here
Node B: X=5   ←── Must see X=5 immediately
Node C: X=5   ←── Must see X=5 immediately

Any client reading from ANY node gets X=5.
No stale data. No "it depends which server you hit."
```

This is **linearizable consistency**, the strongest form. It means the
system behaves as if there's a single copy of the data.

### A — Availability

Every request receives a non-error response, even if some nodes are
down. The system always answers.

```
Client sends request ──► Any healthy node MUST respond
                         (cannot say "sorry, I'm not sure")

Even if Node A is unreachable, Nodes B and C
must still serve requests with whatever data they have.
```

### P — Partition Tolerance

The system continues to operate despite network partitions (messages
between nodes being lost or delayed).

```
┌──────────┐          NETWORK          ┌──────────┐
│  Node A  │     ████PARTITION████     │  Node B  │
│  Node C  │          SPLIT            │  Node D  │
└──────────┘                           └──────────┘

Left side can't talk to right side.
Both sides must still do SOMETHING.
```

---

## You Can Only Pick 2 (But You Must Pick P)

The CAP theorem says you can have at most 2 of the 3 properties.

```
                    Consistency
                       ╱╲
                      ╱  ╲
                     ╱    ╲
                    ╱ PICK ╲
                   ╱  TWO   ╲
                  ╱          ╲
                 ╱            ╲
   Availability ╱──────────────╲ Partition
                                 Tolerance
```

But here's the key insight: in any real distributed system, network
partitions WILL happen. Cables get cut. Switches fail. Cloud regions
have outages. You don't get to choose "no partitions."

So P is mandatory. The real choice is **C vs A during a partition**.

```
┌──────────────┬──────────────────────┬──────────────────────┐
│              │   CP (Consistency +  │   AP (Availability + │
│              │   Partition Tolerance)│   Partition Tolerance)│
├──────────────┼──────────────────────┼──────────────────────┤
│ During       │ Some requests get    │ All requests get     │
│ partition    │ ERRORS (unavailable) │ ANSWERS (maybe stale)│
├──────────────┼──────────────────────┼──────────────────────┤
│ Guarantee    │ If you get an answer │ You always get an    │
│              │ it's correct         │ answer, might be old │
├──────────────┼──────────────────────┼──────────────────────┤
│ Trade-off    │ Downtime for some    │ Stale or conflicting │
│              │ operations           │ data possible        │
└──────────────┴──────────────────────┴──────────────────────┘
```

---

## CP Systems: Correct or Nothing

A CP system refuses to serve requests if it can't guarantee the data is
current. It chooses to be unavailable rather than wrong.

### Example: Bank account balance

```
                 PARTITION
Node A ◄════════════╳═══════════► Node B
Balance: $500                     Balance: $500

User at Node A: "Withdraw $400"
User at Node B: "Withdraw $400"

CP SYSTEM:
  Node A: Processes withdrawal → $100
  Node B: "Sorry, I can't reach Node A to verify.
           Transaction denied. Try again later."
  Result: $100 remaining. No overdraft.

AP SYSTEM:
  Node A: Processes withdrawal → $100
  Node B: Processes withdrawal → $100
  Result: $200 withdrawn from a $500 account.
          When partition heals: -$300. Overdraft!
```

For financial systems, CP is the only sane choice. An error is better
than stealing money.

### CP database examples

| Database      | How it provides CP                              |
|--------------|--------------------------------------------------|
| PostgreSQL    | Single-primary replication, rejects writes if    |
|              | primary is unreachable                           |
| MongoDB       | With `w:majority` write concern, rejects writes  |
| (strong mode) | if majority of replicas are unreachable           |
| HBase         | Uses ZooKeeper for coordination, unavailable if  |
|              | ZooKeeper quorum is lost                         |
| etcd          | Raft consensus, stops accepting writes if leader |
|              | can't reach majority                             |
| CockroachDB   | Serializable transactions, unavailable over      |
|              | consistency                                      |

---

## AP Systems: Always Answer, Eventually Correct

An AP system always responds, even if the response might be stale. It
prioritizes being available and resolves conflicts later.

### Example: Social media "likes" counter

```
                 PARTITION
Node A ◄════════════╳═══════════► Node B
Likes: 1000                       Likes: 1000

User at Node A: "Like this post" → 1001
User at Node B: "Like this post" → 1001

Partition heals:
Node A says 1001, Node B says 1001
Conflict resolution: merge → 1002 (both likes counted)

During partition: users at Node A saw 1001, users at
Node B saw 1001. Neither saw 1002. But nobody got an error.
```

For a likes counter, this is fine. Off by one for a few seconds? Users
won't notice or care.

### AP database examples

| Database      | How it provides AP                              |
|--------------|--------------------------------------------------|
| Cassandra     | Any node accepts writes, syncs later. Tunable   |
|              | consistency per query                            |
| DynamoDB      | Eventually consistent reads by default.          |
|              | Always accepts writes                            |
| CouchDB       | Multi-master replication with conflict detection  |
| Riak          | Vector clocks for conflict resolution            |

### Eventual consistency

AP systems promise **eventual consistency**: if no new writes occur,
eventually all nodes will converge to the same value. "Eventually" can
mean milliseconds or minutes depending on the system and conditions.

```
Timeline of an eventually consistent system:

T=0:  Write X=5 to Node A
T=1:  Node A: X=5,  Node B: X=3  (stale)
T=2:  Node A: X=5,  Node B: X=3  (still replicating)
T=3:  Node A: X=5,  Node B: X=5  (converged)
      ↑
      Eventually consistent
```

---

## It's a Spectrum, Not a Binary

Real systems don't pick "CP" or "AP" and call it a day. They tune
consistency per operation.

### Cassandra's tunable consistency

Cassandra lets you choose consistency level per query:

```
Cluster: 3 replicas per key

Write Consistency Levels:
  ONE:      Write to 1 replica, return success    (fast, risky)
  QUORUM:   Write to 2/3 replicas, return success (balanced)
  ALL:      Write to 3/3 replicas, return success (slow, safe)

Read Consistency Levels:
  ONE:      Read from 1 replica                   (fast, maybe stale)
  QUORUM:   Read from 2/3 replicas, return latest (balanced)
  ALL:      Read from 3/3 replicas                (slow, always fresh)
```

The key insight: **if read consistency + write consistency > replication
factor, you get strong consistency**.

```
R + W > N  →  Strong consistency

Examples with N=3:
  W=QUORUM(2) + R=QUORUM(2) = 4 > 3  →  STRONG  ✓
  W=ONE(1)    + R=ALL(3)    = 4 > 3  →  STRONG  ✓
  W=ALL(3)    + R=ONE(1)    = 4 > 3  →  STRONG  ✓
  W=ONE(1)    + R=ONE(1)    = 2 < 3  →  EVENTUAL ✗
```

```
Why R + W > N guarantees consistency:

With N=3 replicas, W=2 (QUORUM), R=2 (QUORUM):

Write X=5 goes to replicas A and B (2 of 3).

   A: X=5  ✓ (got the write)
   B: X=5  ✓ (got the write)
   C: X=3    (missed it)

Read contacts replicas B and C (2 of 3).

   B: X=5  ← read sees the new value
   C: X=3  ← read sees old value

Since R=2, the read sees BOTH values.
It returns X=5 (the latest).

The overlap is guaranteed: at least one replica
in the read set also received the write.
```

---

## PACELC Theorem: What Happens When There's No Partition?

CAP only describes behavior during a partition. But most of the time
your network is fine. The PACELC theorem extends CAP:

**If Partition → choose Consistency or Availability.
Else → choose Consistency or Latency.**

```
┌────────────────────────────────────────────┐
│              PACELC                        │
│                                            │
│  IF partition:                             │
│     Choose C or A  (same as CAP)           │
│                                            │
│  ELSE (normal operation):                  │
│     Choose C or L  (consistency vs speed)  │
│                                            │
└────────────────────────────────────────────┘
```

Even without partitions, replicating data takes time. Waiting for all
replicas to acknowledge a write is consistent but slow (high latency).
Acknowledging after one replica is fast but potentially inconsistent.

### PACELC classification of real systems

```
┌──────────────┬───────────────────┬───────────────────────┐
│   System     │  During Partition │  Normal Operation     │
│              │  (PA or PC)       │  (EL or EC)           │
├──────────────┼───────────────────┼───────────────────────┤
│ PostgreSQL   │  PC (unavailable) │  EC (sync replication)│
│ MongoDB      │  PC (unavailable) │  EL (async default)   │
│ Cassandra    │  PA (available)   │  EL (fast, eventual)  │
│ DynamoDB     │  PA (available)   │  EL (eventual default)│
│ CockroachDB  │  PC (unavailable) │  EC (serializable)    │
│ Spanner      │  PC (unavailable) │  EC (TrueTime)        │
└──────────────┴───────────────────┴───────────────────────┘

PC/EC = Always consistent (PostgreSQL, CockroachDB, Spanner)
PA/EL = Always fast (Cassandra, DynamoDB)
PC/EL = Consistent during partitions, fast normally (MongoDB default)
```

---

## Consensus Algorithms: How Nodes Agree

When a CP system needs nodes to agree on a value (who's the leader?
what's the latest write?), it uses a consensus algorithm. These
algorithms solve the fundamental problem: how do N nodes agree on
something when messages can be lost or delayed?

### The problem

```
Node 1: "The value should be A"
Node 2: "The value should be B"
Node 3: "The value should be A"

Who wins? How do they agree?
What if Node 2 can't hear Node 1?
What if messages arrive out of order?
```

### Paxos: The Theoretical Foundation

Paxos was the first proven consensus algorithm (Leslie Lamport, 1989).
It's mathematically proven correct but notoriously hard to understand
and implement.

The core idea: a **proposer** suggests a value, **acceptors** vote on
it, and once a **majority** accepts the same value, consensus is reached.

```
Phase 1: PREPARE
  Proposer → All Acceptors: "I'm proposal #5, anyone promised higher?"
  Acceptors → Proposer: "No, #5 is the highest I've seen"
                         (or "I already promised #7, go away")

Phase 2: ACCEPT
  Proposer → All Acceptors: "Accept value V for proposal #5"
  Acceptors → Proposer: "Accepted" (if they haven't promised higher)

  If majority accept → CONSENSUS REACHED on value V
```

Paxos is important historically, but almost nobody implements raw Paxos.
It's complex, hard to get right, and has poor performance in practice.

### Raft: Consensus for Humans

Raft was designed explicitly to be understandable (Diego Ongaro, 2013).
It provides the same safety guarantees as Paxos but with a clearer
structure. It's used in etcd, CockroachDB, TiKV, and Consul.

**The analogy**: Raft is like electing a class president. One person is
the leader, and everyone follows their decisions. If the leader is
absent, the class holds a new election.

### Raft's three roles

```
┌─────────────────────────────────────────────────┐
│                RAFT CLUSTER                     │
│                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  LEADER  │    │ FOLLOWER │    │ FOLLOWER │  │
│  │          │───►│          │    │          │  │
│  │ Accepts  │    │ Replicates    │ Replicates  │
│  │ writes   │───►│ from     │    │ from     │  │
│  │          │    │ leader   │    │ leader   │  │
│  └──────────┘    └──────────┘    └──────────┘  │
│                                                 │
│  If leader fails → election → new leader        │
│  Need majority (2/3) to commit anything         │
└─────────────────────────────────────────────────┘
```

### Raft's lifecycle

**1. Leader election**

Followers have a randomized election timeout. If a follower doesn't hear
from the leader before the timeout, it becomes a **candidate** and
requests votes.

```
Time ────────────────────────────────────────────►

Node A (Leader):  ♥ ♥ ♥ ♥ ♥ ✗  (crashes)
Node B (Follower): . . . . . . timeout! → CANDIDATE
Node C (Follower): . . . . . . . . .

Node B: "I'm running for leader (term 2). Vote for me."
Node C: "OK, you have my vote for term 2."
Node B: Received majority (2/3) → becomes LEADER

Node B (Leader):  ♥ ♥ ♥ ♥ ♥ ♥
Node C (Follower): . . . . . .
Node A (Recovering): . . joins as follower
```

**2. Log replication**

The leader receives writes from clients, appends to its log, and
replicates to followers.

```
Client: "Set X=5"

Leader log:    [Set X=5]  ← appended
               │
               ├──── replicate to Follower B
               └──── replicate to Follower C

Follower B: "Got it, appended to my log"  ← ACK
Follower C: "Got it, appended to my log"  ← ACK

Leader: Majority acknowledged (2/3 including self)
        → COMMIT entry
        → Respond to client: "Success"
        → Tell followers to commit
```

**3. Safety guarantees**

- Only the leader handles writes
- A log entry is committed only when replicated to a majority
- A candidate can't win an election unless its log is at least as
  up-to-date as a majority of nodes
- Once committed, an entry is never lost (even across leader changes)

### Go example: Simulating Raft state

```go
type NodeState int

const (
	Follower NodeState = iota
	Candidate
	Leader
)

type RaftNode struct {
	mu          sync.Mutex
	id          string
	state       NodeState
	currentTerm uint64
	votedFor    string
	log         []LogEntry
	commitIndex uint64
	peers       []string
}

type LogEntry struct {
	Term    uint64
	Command string
	Value   []byte
}

func (n *RaftNode) RequestVote(candidateID string, candidateTerm uint64, lastLogIndex uint64) (bool, uint64) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if candidateTerm < n.currentTerm {
		return false, n.currentTerm
	}

	if candidateTerm > n.currentTerm {
		n.currentTerm = candidateTerm
		n.state = Follower
		n.votedFor = ""
	}

	if n.votedFor == "" || n.votedFor == candidateID {
		if lastLogIndex >= uint64(len(n.log)) {
			n.votedFor = candidateID
			return true, n.currentTerm
		}
	}

	return false, n.currentTerm
}

func (n *RaftNode) AppendEntries(leaderTerm uint64, entries []LogEntry) (bool, uint64) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if leaderTerm < n.currentTerm {
		return false, n.currentTerm
	}

	n.currentTerm = leaderTerm
	n.state = Follower

	n.log = append(n.log, entries...)
	return true, n.currentTerm
}
```

---

## Practical Implications for System Design

### Choosing between CP and AP

```
┌────────────────────────────────────────┐
│ What happens if data is wrong?         │
├────────────────────────────────────────┤
│                                        │
│ Money disappears, medical records      │
│ are wrong, security is breached        │
│ → CP (consistency)                     │
│                                        │
│ A like count is off by 1, a page       │
│ shows stale content for 2 seconds      │
│ → AP (availability)                    │
│                                        │
│ Usually: mix both in one system.       │
│ Payments = CP, news feed = AP          │
└────────────────────────────────────────┘
```

### Real-world example: E-commerce checkout

```
┌──────────────────────────────────────────────────────┐
│               E-COMMERCE SYSTEM                      │
│                                                      │
│  Product catalog browsing:  AP                       │
│  ├── Show cached prices (might be 30s stale)         │
│  ├── Show cached inventory counts                    │
│  └── If one DB is down, serve from replica           │
│                                                      │
│  Shopping cart:  AP                                   │
│  ├── Store in Redis (fast, available)                │
│  └── Cart survives temporary DB issues               │
│                                                      │
│  Checkout / Payment:  CP                             │
│  ├── Verify exact inventory (not cached)             │
│  ├── Process payment with strong consistency         │
│  ├── If DB is unreachable → "try again later"        │
│  └── NEVER charge without confirming inventory       │
│                                                      │
│  Order confirmation email:  AP                       │
│  ├── Queue the email, send when possible             │
│  └── Delayed email is fine, lost payment is not      │
└──────────────────────────────────────────────────────┘
```

### TypeScript: Handling consistency in application code

```typescript
interface ReadOptions {
  consistency: "strong" | "eventual";
}

class ProductService {
  constructor(
    private primary: Pool,
    private replica: Pool,
    private cache: RedisClient
  ) {}

  async getProduct(id: string, opts: ReadOptions): Promise<Product> {
    if (opts.consistency === "eventual") {
      const cached = await this.cache.get(`product:${id}`);
      if (cached) {
        return JSON.parse(cached) as Product;
      }

      const result = await this.replica.query(
        "SELECT * FROM products WHERE id = $1",
        [id]
      );
      if (result.rows.length === 0) {
        throw new NotFoundError(`Product ${id}`);
      }
      await this.cache.set(
        `product:${id}`,
        JSON.stringify(result.rows[0]),
        "EX",
        30
      );
      return result.rows[0] as Product;
    }

    const result = await this.primary.query(
      "SELECT * FROM products WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError(`Product ${id}`);
    }
    return result.rows[0] as Product;
  }

  async checkoutProduct(id: string, quantity: number): Promise<void> {
    const client = await this.primary.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        "SELECT stock FROM products WHERE id = $1 FOR UPDATE",
        [id]
      );
      if (result.rows.length === 0) {
        throw new NotFoundError(`Product ${id}`);
      }

      const stock = result.rows[0].stock as number;
      if (stock < quantity) {
        throw new InsufficientStockError(id, stock, quantity);
      }

      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [quantity, id]
      );

      await client.query("COMMIT");
      await this.cache.del(`product:${id}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
```

---

## Common Misconceptions

### "CAP means you pick exactly 2"

Not really. During normal operation (no partition), you get all 3. CAP
only constrains you during a partition. And since partitions are
temporary, most of the time your system has consistency AND availability.

### "MongoDB is CP" or "Cassandra is AP"

These are defaults, not absolutes. MongoDB with `w:1` read from
secondaries behaves like AP. Cassandra with `QUORUM` read + `QUORUM`
write behaves like CP. Most databases are configurable.

### "Eventual consistency means unreliable"

Eventual consistency has a precise definition: if writes stop, all
replicas will eventually converge. In practice, "eventually" is usually
under a second. DNS is eventually consistent and the entire internet
depends on it.

### "We need strong consistency for everything"

You almost certainly don't. Ask: "What's the actual impact if a user
sees data that's 500ms stale?" For most features, the answer is
"nothing."

---

## Key Takeaways

1. **CAP theorem**: In a distributed system, during a network partition,
   you must choose between consistency and availability.

2. **Partitions are inevitable.** The real choice is C vs A during
   failures.

3. **CP systems** refuse requests rather than serve stale data. Use for
   financial transactions, inventory, anything where wrong data causes
   real harm.

4. **AP systems** always respond, even with potentially stale data. Use
   for social feeds, analytics, caches, anything where staleness is
   tolerable.

5. **PACELC** extends CAP: even without partitions, there's a trade-off
   between consistency and latency.

6. **Raft** is the practical consensus algorithm. Used in etcd,
   CockroachDB, and many modern distributed systems.

7. **Mix CP and AP in one system.** Payment processing is CP. News feed
   is AP. Different features have different needs.

8. **Most systems don't need strong consistency everywhere.** Default to
   eventual consistency and use strong consistency only where the cost
   of stale data is unacceptable.

Next: [Lesson 11 — Message Queues: Decoupling with Async Communication](./11-message-queues.md)
