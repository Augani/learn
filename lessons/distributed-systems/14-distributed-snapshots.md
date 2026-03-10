# Lesson 14: Distributed Snapshots

> How do you take a group photo when everyone is moving?
> You need everyone to freeze at a "consistent" moment.

---

## The Analogy

Imagine 5 people playing catch with 3 balls in a park.
You want to photograph everyone and account for all balls.
If you snap the photo while balls are mid-air, you might
count a ball twice (sender thinks they threw it, receiver
hasn't caught it yet) or miss it entirely.

A distributed snapshot captures the state of ALL processes
and ALL channels at a "consistent" moment — even though
there's no global clock.

```
  THE PROBLEM:

  Process A                    Process B
  balance: $100               balance: $50
       |                           |
       +--- send $30 ------------->|
       |   (message in channel)    |
       |                           |
  balance: $70                balance: $50

  SNAPSHOT AT THIS MOMENT:
  A: $70 + B: $50 + channel: $30 = $150  (CORRECT total)

  BAD SNAPSHOT (A before send, B after receive):
  A: $100 + B: $80 = $180  (WRONG! $30 appeared from nowhere)

  BAD SNAPSHOT (A after send, B before receive):
  A: $70 + B: $50 = $120  (WRONG! $30 disappeared)
```

---

## What Is a Consistent Cut?

```
  A CUT divides events into PAST and FUTURE.

  Process A:  e1 -----> e2 -----> e3 -----> e4
                              /
  Process B:  f1 -----> f2 -------> f3 -----> f4
                   \
  Process C:  g1 ------> g2 -----> g3 -----> g4

  CONSISTENT CUT: if an event is in the past,
  all events that CAUSED it are also in the past.

  CONSISTENT:                    INCONSISTENT:
  Past | Future                  Past | Future
  -----+-------                  -----+-------
  e1 e2|e3 e4                    e1   |e2 e3 e4
  f1 f2|f3 f4                    f1 f2 f3|f4
  g1 g2|g3 g4                    g1 g2|g3 g4
                                      ^
                                 f3 is in past but
                                 e2 (which caused f3
                                 via message) is in future!

  RULE: if event e is in the cut and e -> f (happens-before),
  then f must also be in the cut.
```

---

## The Chandy-Lamport Algorithm

Published in 1985. Still the foundation for distributed
snapshots in modern systems (Flink, Spark).

### Assumptions
1. Channels are FIFO (messages arrive in order)
2. Channels are reliable (no lost messages)
3. Strongly connected graph (every process reachable)

### The Algorithm

```
  MARKER RULE:

  Step 1: INITIATOR
  - Process P decides to take a snapshot
  - P records its own state
  - P sends a MARKER on every outgoing channel

  Step 2: RECEIVING A MARKER (first time on channel C)
  - Process Q records its own state
  - Records channel C state as EMPTY
  - Sends MARKER on all its outgoing channels
  - Starts recording messages on all OTHER incoming channels

  Step 3: RECEIVING A MARKER (again, on channel D)
  - Q already recorded its state
  - Q stops recording on channel D
  - Channel D's state = all messages recorded since step 2

  DONE when every process has received markers on ALL channels.
```

### Visual Walkthrough

```
  SYSTEM: P1, P2, P3 in a ring

  P1 initiates snapshot:

  TIME -->

  P1: [record state] --MARKER--> P2
      [record state] --MARKER--> P3
      start recording P2->P1 and P3->P1

  P2: receives MARKER from P1
      [record state]
      channel P1->P2 state: EMPTY
      --MARKER--> P1
      --MARKER--> P3
      start recording P3->P2

  P3: receives MARKER from P1
      [record state]
      channel P1->P3 state: EMPTY
      --MARKER--> P1
      --MARKER--> P2
      start recording P2->P3

  P1: receives MARKER from P2
      stop recording P2->P1
      channel P2->P1 state: [any messages received between
                              P1's record and this marker]

  P1: receives MARKER from P3
      stop recording P3->P1
      channel P3->P1 state: [any messages recorded]

  (similar for P2 and P3 receiving remaining markers)

  SNAPSHOT COMPLETE:
  +----------------------------+
  | P1 state: ...              |
  | P2 state: ...              |
  | P3 state: ...              |
  | Channel P1->P2: []         |
  | Channel P1->P3: []         |
  | Channel P2->P1: [msg1]     |
  | Channel P2->P3: []         |
  | Channel P3->P1: [msg2]     |
  | Channel P3->P2: []         |
  +----------------------------+
```

---

## Implementation

```python
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
from enum import Enum
from collections import defaultdict

@dataclass
class Message:
    sender: str
    content: str
    is_marker: bool = False

@dataclass
class ProcessSnapshot:
    state: dict
    channel_states: Dict[str, List[Message]] = field(default_factory=dict)

class SnapshotProcess:
    def __init__(self, pid: str, neighbors: List[str]):
        self.pid = pid
        self.neighbors = neighbors
        self.state: dict = {}
        self.inbox: Dict[str, List[Message]] = defaultdict(list)

        self.has_recorded_state = False
        self.snapshot: Optional[ProcessSnapshot] = None
        self.recording_channels: Set[str] = set()
        self.marker_received_from: Set[str] = set()
        self.outbox: List[Message] = []

    def initiate_snapshot(self):
        self.has_recorded_state = True
        self.snapshot = ProcessSnapshot(
            state=dict(self.state),
            channel_states={},
        )
        for neighbor in self.neighbors:
            self.outbox.append(Message(
                sender=self.pid,
                content="MARKER",
                is_marker=True,
            ))
        incoming = [n for n in self.neighbors]
        self.recording_channels = set(incoming)

    def receive_marker(self, from_pid: str):
        self.marker_received_from.add(from_pid)

        if not self.has_recorded_state:
            self.has_recorded_state = True
            self.snapshot = ProcessSnapshot(
                state=dict(self.state),
                channel_states={},
            )
            self.snapshot.channel_states[from_pid] = []

            for neighbor in self.neighbors:
                self.outbox.append(Message(
                    sender=self.pid,
                    content="MARKER",
                    is_marker=True,
                ))

            incoming = [n for n in self.neighbors if n != from_pid]
            self.recording_channels = set(incoming)
        else:
            if from_pid in self.recording_channels:
                self.recording_channels.remove(from_pid)
            recorded = self.snapshot.channel_states.get(from_pid, [])
            self.snapshot.channel_states[from_pid] = recorded

    def receive_message(self, msg: Message):
        if msg.is_marker:
            self.receive_marker(msg.sender)
            return

        if self.has_recorded_state and msg.sender in self.recording_channels:
            if msg.sender not in self.snapshot.channel_states:
                self.snapshot.channel_states[msg.sender] = []
            self.snapshot.channel_states[msg.sender].append(msg)

    def is_snapshot_complete(self) -> bool:
        if not self.has_recorded_state:
            return False
        return len(self.recording_channels) == 0
```

---

## Why Consistent Snapshots Matter

```
  USE CASE 1: FAILURE RECOVERY (Checkpointing)

  Take periodic snapshots.
  On failure, restore from last snapshot.
  Replay messages since snapshot.

  Normal:    S1 ---- S2 ---- S3 ---- CRASH
  Recovery:  Restore S3, replay messages after S3.

  USE CASE 2: DEADLOCK DETECTION

  Snapshot the wait-for graph.
  If there's a cycle: deadlock detected.

  P1 waits for P2
  P2 waits for P3
  P3 waits for P1  --> CYCLE = DEADLOCK

  USE CASE 3: GARBAGE COLLECTION

  Snapshot to find objects with no references.
  Must account for in-flight messages (might contain refs).

  USE CASE 4: GLOBAL PREDICATE EVALUATION

  "Is the total money in the system conserved?"
  "Are there any orphan transactions?"
  Need a consistent view to answer these.
```

---

## Snapshots in Stream Processing (Apache Flink)

```
  FLINK'S ASYNCHRONOUS BARRIER SNAPSHOTTING (ABS):
  Based on Chandy-Lamport, adapted for streaming.

  Source --> Op1 --> Op2 --> Sink

  BARRIERS (like markers) flow through the stream:

  Source: injects barrier N into the stream
  [..., data, data, BARRIER_N, data, data, ...]

  Op1: receives BARRIER_N
  - Snapshots its state
  - Forwards BARRIER_N downstream

  Op2: has multiple inputs? ALIGN barriers:
  - Buffer records from fast input
  - Wait for BARRIER_N on all inputs
  - Snapshot state
  - Forward BARRIER_N

  Input 1: [data, BARRIER_N, data, data ...]
  Input 2: [data, data, data, BARRIER_N ...]
                                    ^
                        Op2 aligns here

  EXACTLY-ONCE: if operator crashes, restore from
  last completed barrier snapshot and replay.
```

---

## Challenges and Limitations

```
  PROBLEM 1: NON-FIFO CHANNELS
  Chandy-Lamport requires FIFO.
  Solution: add sequence numbers, reorder at receiver.

  PROBLEM 2: LARGE STATE
  Snapshotting GBs of state is expensive.
  Solution: incremental snapshots (only diff since last).

  PROBLEM 3: SNAPSHOT FREQUENCY
  Too often: performance overhead.
  Too rare: too much replay on recovery.
  Solution: adaptive frequency based on throughput.

  PROBLEM 4: COORDINATED VS UNCOORDINATED
  +-------------------+---------------------------+
  | Coordinated       | Chandy-Lamport style      |
  | (markers/barriers)| Consistent, some overhead |
  +-------------------+---------------------------+
  | Uncoordinated     | Each process checkpoints  |
  | (independent)     | independently. Risk of    |
  |                   | domino effect on recovery  |
  +-------------------+---------------------------+

  DOMINO EFFECT:
  P1: ----C1----------C2--------CRASH
  P2: --------C1----------C2----
  P3: ------C1--------C2--------

  If C2s are inconsistent, roll back to C1.
  But C1s might also be inconsistent!
  Cascade all the way back to start. BAD.
```

---

## Exercises

### Exercise 1: Chandy-Lamport on Paper

Three processes A, B, C with the following events:
1. A sends m1 to B
2. B sends m2 to C
3. A initiates snapshot
4. B receives m1 (after marker from A)
5. C receives m2 (before marker from B)

Draw the timeline and determine:
- What state does each process record?
- What is the state of each channel?
- Is the snapshot consistent?

### Exercise 2: Implement Channel Recording

Extend the Python implementation to track messages
recorded on each channel between marker receipt. Simulate
3 processes sending regular messages, then run a snapshot
and verify the total "money" is conserved.

### Exercise 3: Flink-Style Barrier Alignment

Implement barrier alignment for a streaming operator with
2 inputs:
1. Buffer messages from the fast input
2. When both barriers arrive, snapshot state
3. Release buffered messages
4. Measure how much buffering occurs under skew

### Exercise 4: Incremental Snapshots

Implement incremental snapshots where each checkpoint only
stores the delta from the previous checkpoint:
1. Full snapshot at time 0
2. Delta snapshots at times 1, 2, 3
3. Restore by applying base + deltas
4. Compare storage cost vs full snapshots

---

## Key Takeaways

```
  1. Distributed snapshot = consistent cut of all states
  2. Consistent: if effect is in snapshot, cause must be too
  3. Chandy-Lamport: markers propagate through FIFO channels
  4. Each process records state on first marker
  5. Channel state = messages between own marker and received marker
  6. Used for: checkpointing, deadlock detection, debugging
  7. Flink uses barrier-based variant for stream processing
  8. Non-FIFO channels need sequence numbers
  9. Incremental snapshots reduce overhead
  10. Coordinated snapshots avoid domino effect
```

---

Next: [Lesson 15 — Byzantine Fault Tolerance](./15-byzantine-fault-tolerance.md)
