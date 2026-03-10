# Lesson 5: Consensus Deep Dive

> Getting N computers to agree on something is one of the hardest
> problems in computer science. Here's how it's done.

---

## The Analogy

Imagine planning a vacation with friends over group chat.
Some messages are delayed, some people go offline, and
everyone keeps proposing different destinations. You need
a protocol that guarantees everyone ends up at the SAME
place, even when communication is flaky.

That's consensus.

---

## What Is Consensus?

All correct nodes must agree on the same value, satisfying:

```
  +------------------+--------------------------------------+
  | Property         | Meaning                              |
  +------------------+--------------------------------------+
  | Agreement        | All correct nodes decide same value  |
  +------------------+--------------------------------------+
  | Validity         | The decided value was proposed by     |
  |                  | some node (no making stuff up)       |
  +------------------+--------------------------------------+
  | Termination      | All correct nodes eventually decide  |
  +------------------+--------------------------------------+
  | Integrity        | Each node decides at most once       |
  +------------------+--------------------------------------+
```

FLP Impossibility (1985): In an asynchronous system with
even ONE faulty node, consensus is **impossible** to guarantee.

So how do Paxos and Raft work? They use timeouts to break
the asynchrony assumption — they're "partially synchronous."

---

## Paxos: The OG Consensus Algorithm

Leslie Lamport, 1989. Notoriously hard to understand.
Let's break it down.

### Three Roles

```
  +----------+     +----------+     +----------+
  | Proposer |     | Acceptor |     |  Learner |
  +-----+----+     +-----+----+     +-----+----+
        |                |                |
  "I want to       "I vote on        "I learn
   propose a        proposals"        what was
   value"                             decided"
```

A node can play multiple roles simultaneously.

### Two Phases

```
  Phase 1: PREPARE / PROMISE

  Proposer                    Acceptors (A1, A2, A3)
     |                            |
     |--- Prepare(n=5) --------->|
     |                            |
     |<-- Promise(n=5, none) ----|  A1: "I promise not
     |<-- Promise(n=5, none) ----|       to accept anything
     |                           X|       numbered < 5"
     |  Got majority (2/3)        |  A3 is down, that's ok

  Phase 2: ACCEPT / ACCEPTED

  Proposer                    Acceptors
     |                            |
     |--- Accept(n=5, v="X") --->|
     |                            |
     |<-- Accepted(n=5, "X") ----|  A1 accepts
     |<-- Accepted(n=5, "X") ----|  A2 accepts
     |                            |
     |  Majority accepted!        |
     |  Value "X" is chosen.      |
```

### The Clever Part: Prior Values

What if an acceptor already accepted something?

```
  Proposer P1 (proposal 3):
    Phase 1: Prepare(3)
    Phase 2: Accept(3, "Red")
    --> A1 accepted "Red" at 3

  Proposer P2 (proposal 5):
    Phase 1: Prepare(5)
    A1 replies: Promise(5, accepted=(3, "Red"))
    A2 replies: Promise(5, none)

    P2 MUST use "Red" as its value!
    Phase 2: Accept(5, "Red")  <-- not its own value!
```

This guarantees that once a value is chosen, future
proposals converge to the same value.

---

## Multi-Paxos

Single-decree Paxos decides ONE value. That's not very
useful. Multi-Paxos chains decisions together:

```
  Slot 1:  Paxos instance -> decide "X=5"
  Slot 2:  Paxos instance -> decide "Y=3"
  Slot 3:  Paxos instance -> decide "X=7"
  ...

  This builds a replicated log:
  +------+------+------+------+------+
  | X=5  | Y=3  | X=7  | Z=1  | ... |
  +------+------+------+------+------+
    slot1  slot2  slot3  slot4
```

Optimization: A stable leader skips Phase 1 for
subsequent slots. This makes it much faster.

```
  Without optimization:    With stable leader:
  2 round-trips per slot   1 round-trip per slot
  (Prepare + Accept)       (Accept only)
```

---

## Raft: Consensus Made Understandable

You learned Raft election in Lesson 4 and the basics in
the System Design track. Now let's trace log replication.

### The Log

```
  Leader's log:
  +-------+-------+-------+-------+
  | T1:   | T1:   | T2:   | T2:   |
  | X=5   | Y=3   | X=7   | Z=1   |
  +-------+-------+-------+-------+
   idx 1    idx 2   idx 3   idx 4
                             ^
                         committed up to here
                         (majority has it)

  Follower A's log:
  +-------+-------+-------+-------+
  | T1:   | T1:   | T2:   | T2:   |
  | X=5   | Y=3   | X=7   | Z=1   |
  +-------+-------+-------+-------+

  Follower B's log (slow):
  +-------+-------+-------+
  | T1:   | T1:   | T2:   |
  | X=5   | Y=3   | X=7   |
  +-------+-------+-------+
  (hasn't received idx 4 yet)
```

### AppendEntries RPC

```
  Leader --> Follower:
    AppendEntries(
      term: 2,
      leaderId: A,
      prevLogIndex: 3,
      prevLogTerm: 2,
      entries: [{term:2, cmd:"Z=1"}],
      leaderCommit: 3
    )

  Follower checks:
    1. Is my term <= leader's term? Yes -> accept
    2. Do I have entry at index 3 with term 2?
       Yes -> append new entries
       No  -> reject (leader will back up)
```

### Log Repair After Leader Change

```
  Old leader crashed mid-replication:

  New Leader (B):  [1:X=5] [1:Y=3] [2:A=1]
  Follower C:      [1:X=5] [1:Y=3] [1:Q=9]  <-- conflict!

  B sends AppendEntries with prevLogIndex=2, prevLogTerm=1
  C matches at index 2.
  C deletes index 3 onward, replaces with B's entries:

  Follower C:      [1:X=5] [1:Y=3] [2:A=1]  <-- repaired
```

---

## Paxos vs Raft: Comparison

```
  +------------------+-----------------+------------------+
  | Aspect           | Paxos           | Raft             |
  +------------------+-----------------+------------------+
  | Understandability| Hard            | Designed to be   |
  |                  |                 | understandable   |
  +------------------+-----------------+------------------+
  | Leader           | Optional        | Required         |
  |                  | (optimization)  | (core design)    |
  +------------------+-----------------+------------------+
  | Log structure    | Gaps allowed    | No gaps, linear  |
  +------------------+-----------------+------------------+
  | Membership       | Complex         | Joint consensus  |
  | change           |                 | (clear protocol) |
  +------------------+-----------------+------------------+
  | Production use   | Chubby, Spanner | etcd, Consul,    |
  |                  |                 | CockroachDB      |
  +------------------+-----------------+------------------+
  | Safety           | Equivalent      | Equivalent       |
  +------------------+-----------------+------------------+
```

---

## Code: Simplified Raft Log Replication

```go
package main

import (
	"fmt"
)

type LogEntry struct {
	Term    int
	Command string
}

type RaftNode struct {
	id          int
	currentTerm int
	log         []LogEntry
	commitIndex int
	isLeader    bool
}

func NewRaftNode(id int) *RaftNode {
	return &RaftNode{
		id:          id,
		commitIndex: -1,
	}
}

type AppendEntriesArgs struct {
	Term         int
	LeaderID     int
	PrevLogIndex int
	PrevLogTerm  int
	Entries      []LogEntry
	LeaderCommit int
}

type AppendEntriesReply struct {
	Term    int
	Success bool
}

func (n *RaftNode) AppendEntries(args AppendEntriesArgs) AppendEntriesReply {
	if args.Term < n.currentTerm {
		return AppendEntriesReply{Term: n.currentTerm, Success: false}
	}

	n.currentTerm = args.Term

	if args.PrevLogIndex >= 0 {
		if args.PrevLogIndex >= len(n.log) {
			return AppendEntriesReply{Term: n.currentTerm, Success: false}
		}
		if n.log[args.PrevLogIndex].Term != args.PrevLogTerm {
			n.log = n.log[:args.PrevLogIndex]
			return AppendEntriesReply{Term: n.currentTerm, Success: false}
		}
	}

	insertIdx := args.PrevLogIndex + 1
	for i, entry := range args.Entries {
		logIdx := insertIdx + i
		if logIdx < len(n.log) {
			if n.log[logIdx].Term != entry.Term {
				n.log = n.log[:logIdx]
				n.log = append(n.log, args.Entries[i:]...)
				break
			}
		} else {
			n.log = append(n.log, args.Entries[i:]...)
			break
		}
	}

	if args.LeaderCommit > n.commitIndex {
		lastIdx := len(n.log) - 1
		if args.LeaderCommit < lastIdx {
			n.commitIndex = args.LeaderCommit
		} else {
			n.commitIndex = lastIdx
		}
	}

	return AppendEntriesReply{Term: n.currentTerm, Success: true}
}

func (n *RaftNode) PrintLog() {
	fmt.Printf("  Node %d (term=%d, commit=%d): ", n.id, n.currentTerm, n.commitIndex)
	for i, entry := range n.log {
		marker := " "
		if i <= n.commitIndex {
			marker = "*"
		}
		fmt.Printf("[%s%d:%s] ", marker, entry.Term, entry.Command)
	}
	fmt.Println()
}

func main() {
	leader := NewRaftNode(0)
	leader.isLeader = true
	leader.currentTerm = 1

	f1 := NewRaftNode(1)
	f2 := NewRaftNode(2)

	fmt.Println("=== Leader appends 'X=5' ===")
	leader.log = append(leader.log, LogEntry{Term: 1, Command: "X=5"})

	args := AppendEntriesArgs{
		Term:         1,
		LeaderID:     0,
		PrevLogIndex: -1,
		PrevLogTerm:  0,
		Entries:      []LogEntry{{Term: 1, Command: "X=5"}},
		LeaderCommit: -1,
	}

	f1.AppendEntries(args)
	f2.AppendEntries(args)

	leader.commitIndex = 0
	leader.PrintLog()
	f1.PrintLog()
	f2.PrintLog()

	fmt.Println("\n=== Leader appends 'Y=3' and commits ===")
	leader.log = append(leader.log, LogEntry{Term: 1, Command: "Y=3"})

	args2 := AppendEntriesArgs{
		Term:         1,
		LeaderID:     0,
		PrevLogIndex: 0,
		PrevLogTerm:  1,
		Entries:      []LogEntry{{Term: 1, Command: "Y=3"}},
		LeaderCommit: 0,
	}

	f1.AppendEntries(args2)
	f2.AppendEntries(args2)

	leader.commitIndex = 1
	leader.PrintLog()
	f1.PrintLog()
	f2.PrintLog()
}
```

---

## Exercises

1. **Trace Paxos.** Three acceptors, two proposers.
   P1 proposes "Red" with n=1, P2 proposes "Blue" with n=2.
   P2's Prepare arrives at all acceptors before P1's Accept.
   What value is chosen? Trace every message.

2. **Log conflict.** Extend the code: After the leader
   commits two entries, crash the leader. Create a new
   leader with a conflicting entry at index 1. Show how
   AppendEntries repairs the follower's log.

3. **Think about it.** Why does Raft require the leader
   to have the most up-to-date log? What goes wrong if
   a node with a stale log becomes leader?

4. **Compare.** What's the minimum number of messages
   for a single Paxos decision with 5 nodes? For Raft
   with a stable leader? Count request + response.

---

[Next: Lesson 6 — Replication Strategies -->](06-replication-strategies.md)
