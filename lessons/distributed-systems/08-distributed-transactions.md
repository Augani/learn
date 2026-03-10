# Lesson 8: Distributed Transactions

> Making multiple things happen atomically across machines — or none at all.

---

## The Analogy

You're planning a group dinner at a fancy restaurant.
Three things must ALL happen or NONE:

1. Restaurant confirms the reservation
2. Everyone confirms they can come
3. Someone puts down the deposit

If the restaurant is booked, nobody should drive there.
If one friend cancels, you cancel the deposit.
Everything or nothing. That's a distributed transaction.

---

## The Problem

```
  Transfer $100 from Account A (Bank 1) to Account B (Bank 2)

  Bank 1: A = A - 100
  Bank 2: B = B + 100

  What if Bank 1 succeeds but Bank 2 crashes?
  $100 vanished! That's not acceptable.

  +--------+         +--------+
  | Bank 1 |         | Bank 2 |
  | A -= 100 |       | B += 100 |
  |   OK!   |        |  CRASH! |
  +--------+         +--------+
      $100 gone forever
```

We need atomicity across machines.

---

## Two-Phase Commit (2PC)

The classic solution. A coordinator drives the process.

### Phase 1: Prepare (Voting)

```
  Coordinator          Participant A     Participant B
       |                    |                  |
       |--- PREPARE ------->|                  |
       |--- PREPARE ---------|---------------->|
       |                    |                  |
       |<-- VOTE YES -------|                  |
       |<-- VOTE YES ---------|----------------|
       |                    |                  |
  All voted YES!
```

### Phase 2: Commit (Decision)

```
  Coordinator          Participant A     Participant B
       |                    |                  |
       |--- COMMIT -------->|                  |
       |--- COMMIT ----------|---------------->|
       |                    |                  |
       |<-- ACK ------------|                  |
       |<-- ACK --------------|----------------|
       |                    |                  |
  Done!
```

### If Any Participant Votes NO

```
  Coordinator          Participant A     Participant B
       |                    |                  |
       |--- PREPARE ------->|                  |
       |--- PREPARE ---------|---------------->|
       |                    |                  |
       |<-- VOTE YES -------|                  |
       |<-- VOTE NO ----------|----------------|
       |                    |                  |
       |--- ABORT ---------->|                  |
       |--- ABORT -----------|---------------->|
```

### The Blocking Problem

```
  What if the coordinator crashes AFTER collecting
  votes but BEFORE sending the decision?

  Coordinator: *crashes*

  Participant A: "I voted YES... now what?"
  Participant B: "I voted YES... now what?"

  Both are STUCK. They can't commit (what if the
  other voted NO?). They can't abort (what if the
  coordinator will send COMMIT when it recovers?).

  They must WAIT. This is the blocking problem.

  +------+       +------+       +------+
  |Coord |       | P_A  |       | P_B  |
  | DEAD |       | WAIT |       | WAIT |
  +------+       +------+       +------+
                 holding        holding
                 locks...       locks...
```

---

## Three-Phase Commit (3PC)

Adds a pre-commit phase to avoid the blocking problem.

```
  Phase 1: Can-Commit?  (same as 2PC prepare)
  Phase 2: Pre-Commit   (tell everyone to get ready)
  Phase 3: Do-Commit    (actually commit)

  Coordinator   P_A          P_B
       |          |            |
       |--CanCom->|            |
       |--CanCom--|----------->|
       |<-YES-----|            |
       |<-YES------|-----------|
       |          |            |
       |--PreCom->|            |   NEW PHASE
       |--PreCom--|----------->|
       |<-ACK-----|            |
       |<-ACK------|-----------|
       |          |            |
       |--DoCom-->|            |
       |--DoCom---|----------->|
```

If the coordinator dies after Phase 2, participants
know everyone agreed. They can proceed to commit.

**But:** 3PC doesn't work with network partitions.
Partitioned nodes might decide differently. So 3PC
is rarely used in practice.

---

## Saga Pattern

Instead of one big transaction, break it into a
sequence of local transactions with compensating
actions.

```
  +--------+     +--------+     +--------+
  | Step 1 |---->| Step 2 |---->| Step 3 |
  | Book   |     | Charge |     | Send   |
  | Hotel  |     | Card   |     | Confirm|
  +--------+     +--------+     +--------+
      |               |
  +--------+     +--------+
  | Undo 1 |<----| Undo 2 |
  | Cancel  |     | Refund |
  | Hotel   |     | Card   |
  +--------+     +--------+

  If Step 3 fails:
    Run Undo 2 (refund card)
    Run Undo 1 (cancel hotel)
```

### Choreography vs Orchestration

```
  Choreography (event-driven):

  Book Hotel --> event: "hotel.booked"
                    |
                    v
               Charge Card --> event: "card.charged"
                                  |
                                  v
                             Send Confirmation

  Each service listens for events and acts.
  Simple but hard to track overall progress.

  Orchestration (central controller):

  +------------+
  | Saga       |
  | Orchestrator|
  +-----+------+
        |
        +--> Book Hotel
        +--> Charge Card
        +--> Send Confirmation

  Central coordinator tells each service what to do.
  Easier to track but single point of knowledge.
```

---

## Code: Simple 2PC Coordinator

```go
package main

import (
	"fmt"
	"math/rand"
)

type Participant struct {
	name      string
	prepared  bool
	committed bool
	willFail  bool
}

func NewParticipant(name string, willFail bool) *Participant {
	return &Participant{name: name, willFail: willFail}
}

func (p *Participant) Prepare() bool {
	if p.willFail {
		fmt.Printf("  [%s] VOTE NO (prepare failed)\n", p.name)
		return false
	}
	p.prepared = true
	fmt.Printf("  [%s] VOTE YES (prepared)\n", p.name)
	return true
}

func (p *Participant) Commit() bool {
	if !p.prepared {
		return false
	}
	p.committed = true
	fmt.Printf("  [%s] COMMITTED\n", p.name)
	return true
}

func (p *Participant) Abort() {
	p.prepared = false
	p.committed = false
	fmt.Printf("  [%s] ABORTED\n", p.name)
}

type Coordinator struct {
	participants []*Participant
	txID         int
}

func NewCoordinator(participants []*Participant) *Coordinator {
	return &Coordinator{
		participants: participants,
		txID:         rand.Intn(10000),
	}
}

func (c *Coordinator) Execute() bool {
	fmt.Printf("=== Transaction %d: Phase 1 (Prepare) ===\n", c.txID)

	allPrepared := true
	for _, p := range c.participants {
		if !p.Prepare() {
			allPrepared = false
			break
		}
	}

	if !allPrepared {
		fmt.Printf("=== Transaction %d: ABORT (not all prepared) ===\n", c.txID)
		for _, p := range c.participants {
			p.Abort()
		}
		return false
	}

	fmt.Printf("=== Transaction %d: Phase 2 (Commit) ===\n", c.txID)
	for _, p := range c.participants {
		p.Commit()
	}

	fmt.Printf("=== Transaction %d: SUCCESS ===\n", c.txID)
	return true
}

type SagaStep struct {
	name       string
	execute    func() error
	compensate func() error
}

type SagaOrchestrator struct {
	steps []SagaStep
}

func (s *SagaOrchestrator) Run() error {
	completed := []int{}

	for i, step := range s.steps {
		fmt.Printf("  Executing: %s\n", step.name)
		if err := step.execute(); err != nil {
			fmt.Printf("  FAILED: %s (%v)\n", step.name, err)
			fmt.Println("  Running compensations...")
			for j := len(completed) - 1; j >= 0; j-- {
				idx := completed[j]
				fmt.Printf("  Compensating: %s\n", s.steps[idx].name)
				if cerr := s.steps[idx].compensate(); cerr != nil {
					fmt.Printf("  COMPENSATION FAILED: %v\n", cerr)
				}
			}
			return err
		}
		completed = append(completed, i)
	}

	fmt.Println("  Saga completed successfully!")
	return nil
}

func main() {
	fmt.Println("--- 2PC: All succeed ---")
	p1 := NewParticipant("BankA", false)
	p2 := NewParticipant("BankB", false)
	c := NewCoordinator([]*Participant{p1, p2})
	c.Execute()

	fmt.Println("\n--- 2PC: One fails ---")
	p3 := NewParticipant("BankA", false)
	p4 := NewParticipant("BankB", true)
	c2 := NewCoordinator([]*Participant{p3, p4})
	c2.Execute()

	fmt.Println("\n--- Saga: Step 3 fails ---")
	saga := &SagaOrchestrator{
		steps: []SagaStep{
			{
				name:       "Book Hotel",
				execute:    func() error { return nil },
				compensate: func() error { fmt.Println("    -> Hotel cancelled"); return nil },
			},
			{
				name:       "Charge Card",
				execute:    func() error { return nil },
				compensate: func() error { fmt.Println("    -> Card refunded"); return nil },
			},
			{
				name:       "Send Confirmation",
				execute:    func() error { return fmt.Errorf("email service down") },
				compensate: func() error { return nil },
			},
		},
	}
	saga.Run()
}
```

---

## When to Use What

```
  +----------+-------------------+------------------------+
  | Pattern  | Use When          | Examples               |
  +----------+-------------------+------------------------+
  | 2PC      | Strong atomicity  | Database sharding,     |
  |          | across few nodes  | XA transactions        |
  +----------+-------------------+------------------------+
  | Saga     | Long-running      | E-commerce orders,     |
  |          | business processes| travel booking         |
  +----------+-------------------+------------------------+
  | Avoid    | You can redesign  | Most microservice      |
  | dist tx  | to not need them  | architectures          |
  +----------+-------------------+------------------------+
```

---

## Exercises

1. **Coordinator failure.** In the 2PC code, add a
   scenario where the coordinator crashes between
   Phase 1 and Phase 2. What state are participants in?
   How would you recover?

2. **Saga ordering.** What happens if the "Charge Card"
   compensation fails? Design a retry strategy.

3. **Think about it.** Can you implement Saga with
   exactly-once semantics? What's needed at each step
   to make compensations idempotent?

4. **Design.** You're building a food delivery app.
   An order involves: restaurant accepts, driver assigned,
   payment processed. Design this as a Saga with
   compensating actions for each failure point.

---

[Next: Lesson 9 — Distributed Locking -->](09-distributed-locking.md)
