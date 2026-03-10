# Lesson 1: Why Distributed Systems

> One server is a single point of everything — failure, bottleneck, limit.

---

## The Analogy

Imagine a restaurant with one chef. Great food, but:

- If the chef gets sick, the restaurant closes
- During rush hour, customers wait forever
- The kitchen can only hold so much equipment

Now imagine **five kitchens** across town, coordinated
by walkie-talkies. More capacity, but now you have
new problems: who makes what? What if a walkie-talkie
breaks? What if two kitchens make the same order?

**That's distributed systems.** You trade simple problems
for complex ones — but you gain things a single server
can never give you.

---

## Why Not Just One Big Server?

```
The Scaling Wall
                                          |
  Requests/sec                            | WALL
        ^                                 |
   100K |                          -------+
        |                    -----/       |
    50K |              -----/             |
        |         ----/                   |
    10K |    ----/                        |
        | --/                             |
        +------------------------------------>
          RAM/CPU you throw at it

  Vertical scaling hits a ceiling.
  You can't buy an infinitely big computer.
```

### The Three Limits

**1. Physics** — Light travels 1 foot per nanosecond.
A user in Tokyo can't get sub-millisecond responses
from a server in New York. You need servers closer.

**2. Money** — A 128-core machine costs 10x more than
four 32-core machines with the same total cores.
Commodity hardware wins on cost.

**3. Availability** — One server has one power supply,
one network card, one disk controller. Any single
failure kills everything.

---

## Failure Is the Norm

At Google-scale (~15,000 machines in early 2000s):

```
  +--------------------------------------------------+
  | In a cluster of 10,000 machines per year:        |
  |                                                  |
  |   ~1,000 hard drive failures                     |
  |   ~20 rack failures (network/power)              |
  |   ~5 network partitions                          |
  |   ~1 data center brownout                        |
  +--------------------------------------------------+
```

At scale, failure isn't exceptional — it's **Tuesday**.

Your system must work WHILE things are broken. Not after
you fix them. During.

---

## What "Distributed" Actually Means

A distributed system is a group of computers that:

1. Communicate over a network
2. Have no shared memory or clock
3. Can fail independently

```
  Node A          Node B          Node C
  +------+        +------+        +------+
  | CPU  |        | CPU  |        | CPU  |
  | RAM  |        | RAM  |        | RAM  |
  | Disk |        | Disk |        | Disk |
  +--+---+        +--+---+        +--+---+
     |               |               |
  ===+===============+===============+===
              Unreliable Network
```

Key insight: **the network is a participant, not just
a pipe.** It can delay, reorder, duplicate, or drop
messages. Your design must handle all of these.

---

## The Eight Fallacies

Things developers wrongly assume:

```
  1. The network is reliable        FALSE
  2. Latency is zero                FALSE
  3. Bandwidth is infinite          FALSE
  4. The network is secure          FALSE
  5. Topology doesn't change        FALSE
  6. There is one administrator     FALSE
  7. Transport cost is zero         FALSE
  8. The network is homogeneous     FALSE
```

Every distributed systems bug traces back to
violating one of these.

---

## A Taste of the Challenges

```
  Client writes X=5 to Node A
  Client writes X=7 to Node B
  Client reads X from Node C

  What does C return?

  +--------+     X=5     +--------+
  | Client +------------>| Node A |
  +---+----+             +---+----+
      |                      |
      | X=7    +--------+   |  ???
      +------->| Node B |   |
               +---+----+   |
                   |         |
               +---+---------+---+
               |    Node C       |
               |    X = ???      |
               +-----------------+
```

The answer depends on your **consistency model**, your
**replication strategy**, and how you handle **time**.

We'll cover all of these in this track.

---

## What You Already Know

From the System Design track, you learned:

- **CAP theorem** — pick two of three (we'll go deeper
  in Lesson 7 on consistency models)
- **Consistent hashing** — distributing data across nodes
  (we'll build on this in Lesson 16 on partitioning)
- **Raft basics** — leader election and log replication
  (we'll implement it fully in Lessons 4-5)
- **Message queues** — async communication between services
  (we'll see how gossip protocols relate in Lesson 12)

This track assumes that foundation and builds on it.

---

## Code: A Minimal Distributed System

Two nodes sending messages over UDP:

```go
package main

import (
	"fmt"
	"net"
	"os"
	"time"
)

func startNode(name string, listenPort string, peerPort string) {
	addr, err := net.ResolveUDPAddr("udp", "127.0.0.1:"+listenPort)
	if err != nil {
		fmt.Fprintf(os.Stderr, "resolve error: %v\n", err)
		return
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen error: %v\n", err)
		return
	}
	defer conn.Close()

	go func() {
		buf := make([]byte, 1024)
		for {
			n, remote, err := conn.ReadFromUDP(buf)
			if err != nil {
				continue
			}
			fmt.Printf("[%s] received from %s: %s\n", name, remote, string(buf[:n]))
		}
	}()

	peerAddr, err := net.ResolveUDPAddr("udp", "127.0.0.1:"+peerPort)
	if err != nil {
		fmt.Fprintf(os.Stderr, "peer resolve error: %v\n", err)
		return
	}

	for i := 0; i < 5; i++ {
		msg := fmt.Sprintf("hello #%d from %s", i, name)
		conn.WriteToUDP([]byte(msg), peerAddr)
		time.Sleep(time.Second)
	}

	time.Sleep(2 * time.Second)
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: go run main.go [alice|bob]")
		return
	}

	switch os.Args[1] {
	case "alice":
		startNode("alice", "9001", "9002")
	case "bob":
		startNode("bob", "9002", "9001")
	default:
		fmt.Println("choose alice or bob")
	}
}
```

Run in two terminals:
```
terminal 1:  go run main.go alice
terminal 2:  go run main.go bob
```

Notice: messages can arrive out of order. Welcome to
distributed systems.

---

## Exercises

1. **Run the code.** Start Bob 2 seconds after Alice.
   Do all messages arrive? Why or why not?

2. **Break it.** Add a random sleep (0-500ms) before each
   send. Do messages arrive in the order they were sent?

3. **Think about it.** If Alice sends message 1 then
   message 2, can Bob receive message 2 first? With UDP?
   With TCP?

4. **List three services** you use daily that would break
   if they ran on a single server. What property do they
   need — availability, capacity, or latency?

---

[Next: Lesson 2 — Time and Ordering -->](02-time-and-ordering.md)
