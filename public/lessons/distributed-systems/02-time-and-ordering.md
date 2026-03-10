# Lesson 2: Time and Ordering

> In a distributed system, "what time is it?" is a trick question.

---

## The Analogy

You and three friends went to different events on Saturday.
On Sunday, you meet to share stories:

- Alice: "I saw the fireworks"
- Bob: "I was at the concert when the fireworks started"
- Carol: "I left the park before the fireworks"

Nobody has a synchronized watch. But you CAN figure out
some ordering from **causal relationships**:

- Carol left the park BEFORE the fireworks
- Bob was at the concert WHEN fireworks started
- Some events? You just can't tell which happened first

This is exactly the problem in distributed systems.

---

## Why Wall Clocks Don't Work

```
  Node A clock:  10:00:00.000
  Node B clock:  10:00:00.003   (3ms ahead)
  Node C clock:  09:59:59.998   (2ms behind)

  Event X on A at 10:00:00.001
  Event Y on B at 10:00:00.002

  Did X happen before Y?

  A thinks: X at 10:00:00.001
  B thinks: Y at 10:00:00.002

  Looks like X before Y. But B's clock is 3ms fast.
  B's real time was 09:59:59.999.
  Y actually happened BEFORE X.
```

NTP (Network Time Protocol) keeps clocks within
~1-10ms of each other. That's not good enough when
events happen microseconds apart.

---

## The Happens-Before Relation

Leslie Lamport (1978) defined a partial order without
using physical clocks.

### Rules

**Rule 1:** If events A and B happen on the same process,
and A comes before B, then A -> B (A happens-before B).

**Rule 2:** If A is "send message" and B is "receive that
message," then A -> B.

**Rule 3:** If A -> B and B -> C, then A -> C (transitivity).

```
  Process P1:     a ---------> b ---------> c
                               |
                        send msg M
                               |
  Process P2:     d ---------> e ---------> f
                               ^
                          receive M

  We know:
    a -> b  (same process)
    b -> e  (send/receive)
    a -> e  (transitivity)
    e -> f  (same process)
    a -> f  (transitivity)

  We DON'T know:
    a vs d  (concurrent - no causal link)
    c vs d  (concurrent)
```

### Concurrent Events

If neither A -> B nor B -> A, the events are
**concurrent** (written A || B). This doesn't mean
"at the same time" — it means we have **no way to
order them**.

---

## Lamport Timestamps

The simplest logical clock. One integer per process.

### Algorithm

```
  1. Each process has a counter C, starting at 0
  2. Before each event: C = C + 1
  3. When sending a message: attach C to the message
  4. When receiving message with timestamp T:
     C = max(C, T) + 1
```

### Example

```
  P1: C=0        C=1         C=2         C=5
       |    evt    |    send    |    recv    |
       +---------->+----------->+-----------+
                   |     msg(2)              ^
                   +----------+    msg(4)    |
                              |              |
  P2: C=0        C=1         C=3    C=4     |
       |    evt    |    recv    |    send    |
       +---------->+-----------+------------>+

  P1 events: 1, 2, 5
  P2 events: 1, 3, 4
```

### What Lamport Timestamps Give You

- If A -> B, then C(A) < C(B)  (guaranteed)
- If C(A) < C(B), does A -> B?  **NO!**

The converse is NOT true. Equal or higher timestamps
don't prove causality.

---

## Vector Clocks

To track causality precisely, each process keeps a
vector of counters — one per process in the system.

### Algorithm

For a system with N processes:

```
  1. Each process Pi has vector V[0..N-1], all zeros
  2. Before each event: V[i] = V[i] + 1
  3. When sending: attach V to the message
  4. When receiving message with vector W:
     For each j: V[j] = max(V[j], W[j])
     Then V[i] = V[i] + 1
```

### Example with Three Processes

```
  P0:  [1,0,0] ----> [2,0,0] ----> [3,2,0]
              send msg           recv from P1
                \                    ^
                 \                  /
  P1:  [0,1,0] ---> [1,2,0] ----/---> [1,3,0]
              recv          send          evt
                                \
                                 \
  P2:  [0,0,1] ----> [0,0,2] ----> [1,3,3]
              evt            evt    recv from P1
```

### Comparing Vector Clocks

```
  V <= W  means  V[i] <= W[i] for all i
  V < W   means  V <= W and V != W
  V || W  means  neither V < W nor W < V

  Example:
  [2,3,1] < [2,4,1]   (P1 happens-before)
  [2,3,1] || [1,4,1]  (concurrent!)
```

This is the key advantage: vector clocks detect
concurrency. Lamport timestamps cannot.

---

## Code: Lamport Clock in Go

```go
package main

import (
	"fmt"
	"sync"
)

type LamportClock struct {
	mu    sync.Mutex
	value uint64
}

func NewLamportClock() *LamportClock {
	return &LamportClock{}
}

func (lc *LamportClock) Tick() uint64 {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	lc.value++
	return lc.value
}

func (lc *LamportClock) Send() uint64 {
	return lc.Tick()
}

func (lc *LamportClock) Receive(remoteTime uint64) uint64 {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	if remoteTime > lc.value {
		lc.value = remoteTime
	}
	lc.value++
	return lc.value
}

func (lc *LamportClock) Current() uint64 {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	return lc.value
}

func main() {
	alice := NewLamportClock()
	bob := NewLamportClock()

	t1 := alice.Tick()
	fmt.Printf("Alice local event:   time=%d\n", t1)

	msgTime := alice.Send()
	fmt.Printf("Alice sends message: time=%d\n", msgTime)

	t2 := bob.Tick()
	fmt.Printf("Bob local event:     time=%d\n", t2)

	t3 := bob.Receive(msgTime)
	fmt.Printf("Bob receives msg:    time=%d\n", t3)

	t4 := bob.Send()
	fmt.Printf("Bob sends reply:     time=%d\n", t4)

	t5 := alice.Receive(t4)
	fmt.Printf("Alice receives reply: time=%d\n", t5)
}
```

Output:
```
Alice local event:   time=1
Alice sends message: time=2
Bob local event:     time=1
Bob receives msg:    time=3
Bob sends reply:     time=4
Alice receives reply: time=5
```

---

## Physical Time Still Matters

Logical clocks tell you about causality but not about
real-world time. Sometimes you need both:

```
  Use logical clocks when:
    - Ordering events for consistency
    - Detecting concurrent writes
    - Building replicated logs

  Use physical clocks when:
    - TTLs and lease expiration
    - User-facing timestamps
    - Cache invalidation timeouts
    - Debugging (which event was "first" in real time)
```

We'll see **Hybrid Logical Clocks** in the next lesson,
which combine both.

---

## The Ordering Spectrum

```
  Strictest                              Loosest
     |                                      |
     v                                      v

  Real-time    Lamport    Vector    No
  ordering     order      clocks    ordering
     |            |          |         |
  Needs GPS   One counter  N counters  Chaos
  or atomic   per node     per node
  clocks
     |            |          |         |
  Google       Simple     Detect     YOLO
  Spanner     ordering   concurrency
```

---

## Exercises

1. **Trace it.** Three processes exchange messages.
   Draw the Lamport timestamps for each event:
   - P1 sends to P2
   - P2 sends to P3
   - P1 sends to P3
   Can you find two events with the same Lamport time?

2. **Vector clock exercise.** With 3 processes, compute
   the vector clock for each event in this sequence:
   - P0 does local event
   - P0 sends msg to P1
   - P1 does local event
   - P1 sends msg to P2
   - P0 sends msg to P2
   Are the two messages P2 receives concurrent?

3. **Run the code.** Modify the Lamport clock example to
   simulate 3 processes. Create a scenario where two
   events have the same Lamport timestamp.

4. **Think about it.** Why can't you use vector clocks
   in a system with 10,000 nodes? What's the overhead?

---

[Next: Lesson 3 — Logical Clocks Implementation -->](03-logical-clocks.md)
