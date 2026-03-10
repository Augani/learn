# Lesson 15: Byzantine Fault Tolerance

> What if nodes don't just crash — what if they LIE?

---

## The Analogy

You're a general in a war council with 8 other generals.
You need to coordinate an attack. But some generals are
TRAITORS — they might vote "attack" to one general and
"retreat" to another, trying to cause chaos.

How do you reach agreement when some participants are
actively trying to sabotage the process?

```
  CRASH FAULT:                    BYZANTINE FAULT:
  "General didn't show up"        "General showed up and LIED"

  +--------+                      +--------+
  | Node A | --- crashes ---X     | Node A | --"attack"--> B
  +--------+                      |        | --"retreat"--> C
  Silent. Detectable.             +--------+
  At most sends nothing.          Active deception.
                                  May send conflicting messages.
```

---

## The Byzantine Generals Problem

Published by Lamport, Shostak, and Pease in 1982.

```
  SETUP:
  N generals, F are traitors (Byzantine).
  Goal: all LOYAL generals agree on the same plan.

  REQUIREMENTS:
  1. AGREEMENT: all loyal generals decide the same value
  2. VALIDITY: if all loyal generals start with the same
     value, they must decide that value

  THE IMPOSSIBILITY RESULT:
  +---------------------------------------------------+
  | Byzantine agreement is IMPOSSIBLE if N <= 3F       |
  | You need N >= 3F + 1 nodes to tolerate F faults    |
  +---------------------------------------------------+

  F=1: need 4+ nodes
  F=2: need 7+ nodes
  F=3: need 10+ nodes
```

### Why 3F+1? The N=3 Impossibility

```
  3 generals, 1 traitor. Can they agree?

  SCENARIO 1: C is the traitor
  A says "attack" to B and C
  B says "attack" to A and C
  C says "attack" to A, "retreat" to B

  A sees: A=attack, B=attack, C=attack -> attack (2/3)
  B sees: A=attack, B=attack, C=retreat -> attack (2/3)
  Loyal generals agree! But only by luck...

  SCENARIO 2: A is the traitor
  A says "attack" to B, "retreat" to C
  B says "attack" to A and C
  C says "retreat" to A and B

  B sees: A=attack, B=attack, C=retreat -> attack (2/3)
  C sees: A=retreat, B=attack, C=retreat -> retreat (2/3)
  DISAGREEMENT! Loyal generals B and C decided differently.

  B cannot distinguish:
  "C is lying" vs "A told C something different"
```

---

## Practical Byzantine Fault Tolerance (PBFT)

Published by Castro and Liskov in 1999. The first practical
BFT algorithm for real systems.

```
  PBFT OVERVIEW:
  - N = 3F + 1 replicas (tolerates F Byzantine faults)
  - One PRIMARY (leader), rest are BACKUPS
  - Clients send requests to the primary
  - Three-phase protocol: PRE-PREPARE, PREPARE, COMMIT

  CLIENT         PRIMARY (0)      BACKUP 1      BACKUP 2      BACKUP 3
    |                |               |              |              |
    |--- request --->|               |              |              |
    |                |               |              |              |
    |          PRE-PREPARE           |              |              |
    |                |--msg--------->|              |              |
    |                |--msg------------------------->|             |
    |                |--msg--------------------------------------->|
    |                |               |              |              |
    |            PREPARE (all-to-all)               |              |
    |                |<--prepare-----|              |              |
    |                |<--prepare-------------------->|             |
    |                |<--prepare-----------------------------------)|
    |                |               |              |              |
    |             COMMIT (all-to-all)               |              |
    |                |--commit------>|              |              |
    |                |<--commit------|              |              |
    |                (all exchange commits)          |              |
    |                |               |              |              |
    |<---reply-------|               |              |              |
    |<---reply-----------------------|              |              |
    |<---reply--------------------------------------|              |
    |<---reply------------------------------------------------------|
    |                |               |              |              |
    | Client accepts result with F+1 matching replies              |
```

### The Three Phases

```
  PHASE 1: PRE-PREPARE
  Primary assigns sequence number to request.
  Sends <PRE-PREPARE, view, seq, digest> to all backups.
  Backups accept if:
  - They're in the same view
  - Sequence number hasn't been used
  - Digest matches the request

  PHASE 2: PREPARE
  Each backup broadcasts <PREPARE, view, seq, digest> to all.
  A node is "prepared" when it has:
  - The pre-prepare message
  - 2F matching prepare messages from different replicas
  This proves the request is ordered consistently.

  PHASE 3: COMMIT
  Each node broadcasts <COMMIT, view, seq, digest> to all.
  A node "commits" when it has:
  - 2F + 1 matching commit messages
  Execute the operation and reply to client.

  WHY 3 PHASES?
  Phase 1: establish ordering (primary proposes)
  Phase 2: verify ordering (quorum agrees on order)
  Phase 3: verify the verification (quorum agrees to commit)
```

---

## View Change (When the Primary Is Byzantine)

```
  PROBLEM: What if the primary is the traitor?
  It might:
  - Not forward client requests
  - Assign conflicting sequence numbers
  - Just stop responding

  SOLUTION: VIEW CHANGE PROTOCOL

  Backup suspects primary (timeout on pending requests):

  1. Backup sends <VIEW-CHANGE, v+1, ...> to all
  2. When new primary (node v+1 mod N) gets 2F view-changes:
     - Sends <NEW-VIEW, v+1, ...> to all
     - Includes proof of all committed operations
  3. Normal operation resumes with new primary

  View 0: Primary = Node 0 (Byzantine!)
           timeout...
  View 1: Primary = Node 1 (honest)
           resume operations
```

---

## PBFT Cost

```
  MESSAGE COMPLEXITY:
  +------------------+----------------------------+
  | Phase            | Messages                   |
  +------------------+----------------------------+
  | Pre-prepare      | N - 1 (primary to backups) |
  | Prepare          | (N-1) * (N-1) = O(N^2)    |
  | Commit           | N * (N-1) = O(N^2)         |
  +------------------+----------------------------+
  | TOTAL per request| O(N^2)                     |
  +------------------+----------------------------+

  FOR N=4 (F=1):   ~36 messages per request
  FOR N=7 (F=2):   ~84 messages per request
  FOR N=13 (F=4):  ~312 messages per request

  PBFT does NOT scale to hundreds of nodes.
  Practical limit: ~20 nodes.
```

---

## Byzantine Faults vs Crash Faults

```
  +-------------------+------------------+-------------------+
  |                   | CRASH FAULTS     | BYZANTINE FAULTS  |
  +-------------------+------------------+-------------------+
  | Behavior          | Stop responding  | Arbitrary         |
  | Detectable?       | Eventually (HB)  | Maybe not         |
  | Nodes needed      | 2F + 1           | 3F + 1            |
  | Algorithm         | Raft, Paxos      | PBFT, HotStuff    |
  | Msg complexity    | O(N)             | O(N^2)            |
  | Performance       | High             | Lower             |
  | Use case          | Datacenter       | Untrusted nodes   |
  +-------------------+------------------+-------------------+

  MOST REAL SYSTEMS ONLY HANDLE CRASH FAULTS:
  - Databases (Raft/Paxos consensus)
  - Coordination (ZooKeeper, etcd)
  - Stream processing (Flink checkpoints)

  BFT IS NEEDED WHEN:
  - Nodes are controlled by different parties
  - Nodes might be compromised (security)
  - Financial systems with regulatory requirements
  - Blockchain / cryptocurrency
```

---

## The Blockchain Connection

```
  BITCOIN'S APPROACH: NAKAMOTO CONSENSUS

  Instead of PBFT (N known, permissioned):
  - Unknown number of participants
  - Anyone can join (permissionless)
  - Sybil resistance via Proof of Work

  PBFT:                         NAKAMOTO:
  +---------------------------+ +---------------------------+
  | Fixed set of N nodes      | | Anyone can participate    |
  | Instant finality          | | Probabilistic finality    |
  | O(N^2) messages           | | One block broadcast       |
  | Tolerates N/3 Byzantine   | | Tolerates <50% hashpower |
  | ~1000 tx/sec              | | ~7 tx/sec (Bitcoin)       |
  +---------------------------+ +---------------------------+

  ETHEREUM'S APPROACH:
  Moved from Proof of Work to Proof of Stake.
  Uses BFT-style finality (Casper FFG) on top of
  fork-choice rule (LMD-GHOST).
```

---

## Modern BFT: HotStuff

Used by Facebook's (Meta's) Diem/Libra blockchain.

```
  HOTSTUFF IMPROVEMENTS OVER PBFT:

  PBFT: O(N^2) communication per phase
  HotStuff: O(N) communication per phase (linear!)

  HOW: threshold signatures
  Instead of all-to-all, leader collects signatures
  and creates a single "quorum certificate" (QC).

  PBFT:                           HOTSTUFF:
  All <---> All (O(N^2))          All ---> Leader ---> All (O(N))

  +---+    +---+    +---+         +---+
  | 1 |<-->| 2 |<-->| 3 |         | 1 |---+
  +---+    +---+    +---+         +---+   |   +--------+    +---+
    ^        ^        ^           +---+   +-->| Leader |-->| 1 |
    |        |        |           | 2 |------>|   QC   |-->| 2 |
    v        v        v           +---+   +-->|        |-->| 3 |
  +---+    +---+    +---+         +---+   |   +--------+    +---+
  | 4 |<-->| 5 |<-->| 6 |         | 3 |---+
  +---+    +---+    +---+         +---+
```

---

## Detecting Byzantine Behavior

```
  STRATEGY 1: SIGNED MESSAGES
  Every message is cryptographically signed.
  A traitor cannot forge another node's message.
  A traitor cannot deny sending a message (non-repudiation).

  STRATEGY 2: VERIFIABLE COMPUTATION
  Include proofs with results.
  Other nodes verify the proof, not the computation.

  STRATEGY 3: REDUNDANT EXECUTION
  Run the same computation on 3F+1 nodes.
  Take majority result.
  Expensive but catches any deviation.

  STRATEGY 4: AUDITING
  Record all messages and decisions.
  Periodically audit for inconsistencies.
  Detect Byzantine behavior after the fact.
```

---

## Exercises

### Exercise 1: PBFT Message Counting

For N=7 (F=2), calculate:
1. Messages in pre-prepare phase
2. Messages in prepare phase
3. Messages in commit phase
4. Total messages for one client request
5. How many matching replies does the client need?

### Exercise 2: Byzantine Generals Simulation

```python
import random

def simulate_byzantine(num_generals, num_traitors, loyal_value):
    generals = []
    for i in range(num_generals):
        if i < num_traitors:
            generals.append({"id": i, "traitor": True, "value": None})
        else:
            generals.append({"id": i, "traitor": False, "value": loyal_value})

    received = {i: [] for i in range(num_generals)}

    for sender in generals:
        for receiver in generals:
            if sender["id"] == receiver["id"]:
                continue
            if sender["traitor"]:
                msg = random.choice(["ATTACK", "RETREAT"])
            else:
                msg = sender["value"]
            received[receiver["id"]].append(msg)

    decisions = {}
    for gen in generals:
        if gen["traitor"]:
            continue
        votes = received[gen["id"]]
        attack_count = votes.count("ATTACK")
        retreat_count = votes.count("RETREAT")
        decisions[gen["id"]] = "ATTACK" if attack_count > retreat_count else "RETREAT"

    return decisions


for trial in range(5):
    result = simulate_byzantine(
        num_generals=7,
        num_traitors=2,
        loyal_value="ATTACK",
    )
    values = list(result.values())
    agreement = len(set(values)) == 1
    print(f"Trial {trial}: {result} -> Agreement: {agreement}")
```

Run with different ratios of traitors to generals and find
the threshold where agreement breaks down.

### Exercise 3: Implement Simple PBFT

Build a simplified PBFT with:
1. 4 nodes (tolerating 1 Byzantine)
2. Pre-prepare, prepare, commit phases
3. Simulate a Byzantine primary that sends conflicting orders
4. Trigger a view change
5. Verify that honest nodes still agree

### Exercise 4: Compare BFT Approaches

Research and compare:
- PBFT: message complexity, finality, scalability
- Nakamoto (PoW): energy cost, finality time, scalability
- HotStuff: linear communication, threshold signatures
- Tendermint: PBFT + gossip, used in Cosmos

---

## Key Takeaways

```
  1. Byzantine faults: nodes can lie, not just crash
  2. Need 3F+1 nodes to tolerate F Byzantine faults
  3. PBFT: 3-phase protocol with O(N^2) messages
  4. View change handles Byzantine primary
  5. Client needs F+1 matching replies
  6. Blockchain = BFT for permissionless networks
  7. HotStuff achieves linear message complexity
  8. Most datacenter systems only handle crash faults
  9. BFT is expensive: use only when needed
  10. Signed messages prevent forgery and repudiation
```

---

Next: [Lesson 16 — Partitioning & Sharding](./16-partitioning-sharding.md)
