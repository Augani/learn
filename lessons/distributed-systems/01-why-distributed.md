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

## The Eight Fallacies — Explained With Everyday Life

These aren't abstract principles. They're the specific wrong assumptions
that cause real outages. Let's walk through each one with analogies:

### 1. "The network is reliable" — FALSE

**Analogy:** You assume your phone will always have signal. Then you
drive through a tunnel and your call drops. Networks fail — cables get
cut by construction crews, routers crash, switches get misconfigured.
AWS had a major outage in 2017 because an engineer mistyped a command
and took too many S3 servers offline.

### 2. "Latency is zero" — FALSE

**Analogy:** You text a friend and assume they see it instantly. But
they're on a plane with spotty Wi-Fi. Your message arrives 45 seconds
later. In distributed systems, a "fast" network call takes 0.5-1ms in
the same data center, but 50-150ms across continents. Code that makes
100 sequential network calls now takes 5-15 SECONDS.

### 3. "Bandwidth is infinite" — FALSE

**Analogy:** A highway has a speed limit AND a number of lanes. Even if
each car is fast, you can only fit so many cars. Transfer 1TB of data
over a 1Gbps link and it takes 2+ hours. Now multiply by 1000 servers
all trying to replicate data simultaneously.

### 4. "The network is secure" — FALSE

**Analogy:** You assume nobody's reading your postcards. But every mail
carrier between you and the recipient can read a postcard. Unencrypted
network traffic can be read, modified, or redirected by anyone along
the path — your ISP, a compromised router, a rogue Wi-Fi access point.

### 5. "Topology doesn't change" — FALSE

**Analogy:** You memorize the route to work, then one day a bridge
closes and you have to find a new path. Network routes change as
routers go down, links get added, providers change peering agreements.
Your "fast path" today might not exist tomorrow.

### 6. "There is one administrator" — FALSE

**Analogy:** You own your apartment, but your landlord controls the
building, the city controls the water supply, and a separate company
handles the electricity. When the water stops, whose problem is it?
In distributed systems, your app might span AWS, a CDN, a third-party
API, and your own data center — each with different admins, policies,
and SLAs.

### 7. "Transport cost is zero" — FALSE

**Analogy:** Shipping is "free" on Amazon, but someone is paying for it.
Every network call has CPU cost (serialization, deserialization,
encryption), memory cost (buffers), and dollar cost (cloud egress
charges). AWS charges $0.09/GB for data leaving a region. Move 100TB
and that's a $9,000 monthly bill just for bandwidth.

### 8. "The network is homogeneous" — FALSE

**Analogy:** You assume every road is a highway, but your data crosses
highways, dirt roads, and suspension bridges. Different parts of the
network have different speeds, protocols, MTU sizes, and reliability
characteristics. Your internal 10Gbps network connects to a partner's
100Mbps link through a VPN running over the public internet.

---

## A Taste of the Challenges

### The Consistency Problem

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

**Analogy — a chain of restaurants updating their menu:**

Imagine you own three restaurant locations. You decide to change the
price of the burger from $12 to $15. You call Location A and tell them.
They update their menu. But Locations B and C haven't gotten the call
yet. A customer at Location B sees $12. A customer at Location A sees
$15. Another customer calls Location C and asks — what's the price?

This is the consistency problem. You have three options:

1. **Strong consistency**: Don't serve ANY customers at ANY location
   until ALL menus are updated. Customers wait, but nobody ever sees
   a stale price. (Like a database with synchronous replication.)

2. **Eventual consistency**: Let each location serve customers with
   whatever menu they currently have. Eventually, all locations will
   get the update. Some customers will briefly see the old price.
   (Like DNS propagation, or social media feeds.)

3. **Causal consistency**: Make sure that if a customer CAUSED the
   price change, they always see the new price. Other customers might
   still see the old one temporarily. (A middle ground.)

### The Split Brain Problem

What happens when your network breaks in half?

**Analogy — two managers of the same store, out of contact:**

```
  ┌─────────────────┐         ┌─────────────────┐
  │   Node A         │         │   Node B         │
  │   "I'm the       │  XXXX   │   "I'm the       │
  │    leader!"      │ network │    leader!"      │
  │                  │  down   │                  │
  │   Accepts writes │         │   Accepts writes │
  └─────────────────┘         └─────────────────┘

  Both think they're in charge. Both accept conflicting changes.
  When the network heals, whose changes win?
```

Imagine two store managers lose phone contact. Both start making
decisions independently — one orders more inventory, the other
runs a clearance sale. When they reconnect, the store is a mess:
too much inventory that's already on sale. This is "split brain,"
and it's one of the hardest problems in distributed systems.

Solutions include:
- **Leader election** (pick ONE leader, others defer)
- **Quorum writes** (require a majority to agree before accepting)
- **Conflict resolution** (accept both, merge later — like Google Docs)

We'll cover all of these in this track.

---

## The CAP Theorem: You Can't Have It All

The most famous constraint in distributed systems. You can only guarantee
two of these three:

- **Consistency**: Every read returns the most recent write
- **Availability**: Every request gets a response (even if stale)
- **Partition tolerance**: The system works despite network failures

**Analogy — a phone tree during a disaster:**

Your neighborhood has a phone tree for emergencies. When a disaster
happens, the coordinator calls neighbors to spread the word.

- **CA (Consistent + Available, no Partition tolerance):** The phone
  tree works perfectly... as long as all phone lines are up. The moment
  one line goes down, the whole system stops. This is a single-server
  database — great until the network breaks.

- **CP (Consistent + Partition tolerant, reduced Availability):** If
  some phone lines go down, the coordinator waits until they can reach
  EVERYONE before confirming the message. Some people might not get a
  response for hours. But when they do, it's accurate.

- **AP (Available + Partition tolerant, reduced Consistency):** If
  phone lines go down, neighbors who CAN be reached get the message
  immediately. Those who can't might get an outdated version later.
  Everyone gets a response, but it might be stale.

```
The CAP Triangle:

         Consistency
            /\
           /  \
          / CP \
         /      \
        /________\
       /\   CA   /\
      /  \      /  \
     / AP \    /    \
    /______\  /______\
  Availability  Partition
                Tolerance

In practice, network partitions WILL happen (you can't prevent physics).
So the real choice is: when the network splits,
do you sacrifice Consistency or Availability?
```

Most real systems aren't strictly one or the other. They make nuanced
tradeoffs: strong consistency for financial transactions, eventual
consistency for social media likes. The art is knowing when each matters.

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
