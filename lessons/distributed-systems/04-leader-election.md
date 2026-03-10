# Lesson 4: Leader Election

> Someone has to be in charge. The question is: how do you pick them,
> and what happens when they disappear?

---

## The Analogy

A group project at school. Nobody wants to coordinate,
but someone must. Options:

- **Bully method:** The biggest kid says "I'm in charge."
  If they're absent, the next biggest takes over.
- **Ring method:** Pass a note around the circle. Everyone
  writes their name. The "best" name wins.
- **Raft method:** Someone proposes themselves. If a majority
  agrees, they're the leader. If two people propose at
  once, one backs off and tries again.

---

## Why We Need Leaders

```
  Without a leader:          With a leader:

  Client --> Node A          Client --> Leader
  Client --> Node B             |
  Client --> Node C             v
                             Leader --> Followers
  "Who handles this?"       "Leader handles everything"
  "Who has the latest?"     "Leader has the latest"
  "Conflicts everywhere"    "One source of truth"
```

Leaders simplify consistency. But they create a single
point of failure, so you need election algorithms.

---

## The Bully Algorithm

Created by Garcia-Molina (1982). Simple idea: the node
with the highest ID wins.

### How It Works

```
  1. Node detects leader is down
  2. Sends ELECTION to all nodes with higher IDs
  3. If any higher node responds: back off, let them handle it
  4. If NO higher node responds: declare yourself leader
  5. Send COORDINATOR message to all lower nodes
```

### Example

```
  Nodes: [1] [2] [3] [4] [5]
  Current leader: 5 (crashed)

  Step 1: Node 3 detects leader 5 is down
          Node 3 sends ELECTION to 4, 5

  Step 2: Node 4 responds OK to 3
          Node 5 doesn't respond (dead)
          Node 3 backs off

  Step 3: Node 4 sends ELECTION to 5
          Node 5 doesn't respond
          Node 4 declares itself leader

  Step 4: Node 4 sends COORDINATOR to 1, 2, 3

  Result: [1] [2] [3] [4*] [X]
                         ^leader
```

### Problems with Bully

```
  +-----------------------------------+
  | Issue           | Impact          |
  +-----------------------------------+
  | O(n^2) messages | Slow in large   |
  |                 | clusters        |
  +-----------------------------------+
  | Split brain     | If 5 comes back |
  |                 | while 4 leads   |
  +-----------------------------------+
  | No majority     | Network split   |
  | requirement     | = two leaders   |
  +-----------------------------------+
```

---

## Ring Election

Nodes are arranged in a logical ring. Election message
travels around collecting candidates.

```
  1. Initiator sends ELECTION with its own ID
  2. Each node adds its ID and forwards the message
  3. When message returns to initiator:
     highest ID in the list becomes leader
  4. Initiator sends LEADER announcement around ring

      [3]--->[5]--->[1]
       ^              |
       |              v
      [4]<---[2]<---[7*]  <-- 7 wins
```

Better: only O(n) messages. But requires a ring
topology and breaks if a node in the ring crashes
during election.

---

## Raft Election Deep Dive

You learned Raft basics in System Design. Now let's
trace through an election step by step.

### Key Concepts

```
  Term: monotonically increasing election number
  State: each node is Follower, Candidate, or Leader

  +----------+     timeout      +----------+
  | Follower |----------------->| Candidate|
  +-----+----+                  +----+-----+
        ^                            |
        | discovers leader           | wins majority
        | or higher term             v
        |                      +----------+
        +<---------------------| Leader   |
           steps down          +----------+
```

### Election Walkthrough

```
  Term 1: Node A is leader, B and C are followers.

  Time -->

  A: [Leader T1]  heartbeat  heartbeat  **crashes**
       |            |           |            X
  B: [Follow T1]  ack        ack       ...timeout!
       |            |           |            |
  C: [Follow T1]  ack        ack       ...timeout!

  --- Election starts ---

  B: [Candidate T2] "Vote for me in term 2!"
       |                  \
       |                   \----> C
       |
  C: [Follow T1] "Haven't voted in T2 yet. OK, voted B!"
       |
  B: [Leader T2]  Got majority (self + C = 2/3)
       |
  B starts sending heartbeats as leader.
```

### The Election Timer

Each follower has a randomized timeout (150-300ms).
This randomization prevents split votes:

```
  B timeout: 180ms   <-- fires first!
  C timeout: 250ms   <-- B already started election

  If both were 200ms:
  B: "Vote for me!" ---> C: "Already voted for myself"
  C: "Vote for me!" ---> B: "Already voted for myself"

  Neither wins. Wait for next timeout. (Split vote)
```

### Pre-Vote Extension

Problem: A disconnected node keeps incrementing its
term. When it reconnects, its high term disrupts the
cluster.

```
  Normal flow:

  Node D disconnected, increments term to 15
  Reconnects to cluster at term 3
  Everyone sees term 15, steps down
  D triggers unnecessary election

  With pre-vote:

  Node D asks: "Would you vote for me?"
  Other nodes: "No, we have a working leader"
  D doesn't disrupt anything
```

---

## Code: Simple Leader Election

```go
package main

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

type NodeState int

const (
	Follower NodeState = iota
	Candidate
	Leader
)

type Node struct {
	mu              sync.Mutex
	id              int
	state           NodeState
	currentTerm     int
	votedFor        int
	peers           []*Node
	electionTimeout time.Duration
	lastHeartbeat   time.Time
}

func NewNode(id int) *Node {
	return &Node{
		id:              id,
		state:           Follower,
		votedFor:        -1,
		electionTimeout: time.Duration(150+rand.Intn(150)) * time.Millisecond,
		lastHeartbeat:   time.Now(),
	}
}

func (n *Node) RequestVote(candidateID int, term int) (bool, int) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if term < n.currentTerm {
		return false, n.currentTerm
	}

	if term > n.currentTerm {
		n.currentTerm = term
		n.state = Follower
		n.votedFor = -1
	}

	if n.votedFor == -1 || n.votedFor == candidateID {
		n.votedFor = candidateID
		n.lastHeartbeat = time.Now()
		return true, n.currentTerm
	}

	return false, n.currentTerm
}

func (n *Node) StartElection() bool {
	n.mu.Lock()
	n.state = Candidate
	n.currentTerm++
	n.votedFor = n.id
	term := n.currentTerm
	n.mu.Unlock()

	votes := 1
	total := len(n.peers) + 1
	needed := total/2 + 1

	fmt.Printf("  Node %d: starting election for term %d\n", n.id, term)

	for _, peer := range n.peers {
		granted, _ := peer.RequestVote(n.id, term)
		if granted {
			votes++
			fmt.Printf("  Node %d: got vote from Node %d (votes: %d/%d)\n",
				n.id, peer.id, votes, needed)
		}
		if votes >= needed {
			break
		}
	}

	if votes >= needed {
		n.mu.Lock()
		n.state = Leader
		n.mu.Unlock()
		fmt.Printf("  Node %d: WON election for term %d\n", n.id, term)
		return true
	}

	n.mu.Lock()
	n.state = Follower
	n.mu.Unlock()
	fmt.Printf("  Node %d: lost election for term %d\n", n.id, term)
	return false
}

func (n *Node) Heartbeat(leaderID int, term int) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if term >= n.currentTerm {
		n.currentTerm = term
		n.state = Follower
		n.votedFor = leaderID
		n.lastHeartbeat = time.Now()
	}
}

func main() {
	nodes := make([]*Node, 5)
	for i := range nodes {
		nodes[i] = NewNode(i)
	}

	for i, node := range nodes {
		peers := make([]*Node, 0, len(nodes)-1)
		for j, other := range nodes {
			if i != j {
				peers = append(peers, other)
			}
		}
		node.peers = peers
	}

	fmt.Println("=== Scenario 1: Normal election ===")
	nodes[2].StartElection()

	fmt.Println("\n=== Scenario 2: Competing candidates ===")
	for _, n := range nodes {
		n.mu.Lock()
		n.votedFor = -1
		n.state = Follower
		n.mu.Unlock()
	}
	nodes[1].StartElection()

	fmt.Println()
	for _, n := range nodes {
		n.mu.Lock()
		n.votedFor = -1
		n.state = Follower
		n.mu.Unlock()
	}
	nodes[4].StartElection()
}
```

---

## Election in Production

Real systems add these on top:

```
  +-------------------+----------------------------+
  | Feature           | Why                        |
  +-------------------+----------------------------+
  | Pre-vote          | Prevent term inflation     |
  +-------------------+----------------------------+
  | Leader lease      | Fast reads without         |
  |                   | contacting followers       |
  +-------------------+----------------------------+
  | Priority election | Prefer nodes in same DC    |
  +-------------------+----------------------------+
  | Leadership        | Move leader to less-loaded |
  | transfer          | node gracefully            |
  +-------------------+----------------------------+
```

---

## Exercises

1. **Simulate the bully algorithm** with 5 nodes. Node 5
   crashes, then node 3 and node 4 detect it simultaneously.
   Trace all messages exchanged.

2. **Split vote.** Modify the code so two nodes start
   elections at the same time with the same term. Verify
   neither wins. How does the real Raft handle this?

3. **Think about it.** In a 5-node cluster, what's the
   minimum number of nodes that must be alive for an
   election to succeed? What about a 7-node cluster?

4. **Design.** You have a 3-node cluster across two data
   centers (2 nodes in DC-A, 1 in DC-B). If the network
   between DCs goes down, which DC can elect a leader?
   Is this a good setup?

---

[Next: Lesson 5 — Consensus Deep Dive -->](05-consensus-deep-dive.md)
