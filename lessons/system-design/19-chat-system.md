# Lesson 19: Design a Chat System

Real-time messaging is one of the hardest problems in system design. You
need messages to arrive instantly, handle millions of simultaneous
connections, guarantee delivery even when users go offline, and store
billions of messages efficiently.

**Analogy:** Think of a chat system like a postal service that also has to
work like a telephone. Some messages are phone calls (real-time, both people
online), some are letters (recipient is offline, deliver when they return),
and some are loudspeaker announcements (group messages). You need all three
modes working simultaneously, with nothing getting lost.

---

## Step 1: Requirements

### Functional Requirements

1. **1-on-1 chat** — Send messages between two users in real-time
2. **Group chat** — Support groups of up to 500 members
3. **Online presence** — Show who's online/offline/away
4. **Message history** — Persist all messages, scroll back through them
5. **Push notifications** — Alert offline users about new messages
6. **Read receipts** — Show when messages have been delivered and read
7. **Media support** — Images, files, links (but not video/voice calls)

### Non-Functional Requirements

1. **Real-time** — Messages delivered in < 200ms between online users
2. **Reliable delivery** — No messages lost, ever
3. **Ordering** — Messages appear in the correct order within a conversation
4. **Scalable** — Support 50M daily active users

### Out of Scope

- End-to-end encryption (important but a separate deep dive)
- Voice/video calls
- Message search (could be its own lesson)

---

## Step 2: Back-of-Envelope Estimation

### Traffic

```
DAU:                     50M users
Messages per user/day:   40 messages sent
Total messages/day:      50M * 40 = 2 billion messages/day
Messages per second:     2B / 86,400 ≈ 23,000 messages/second
Peak (3x average):       ~70,000 messages/second
```

### Connections

```
Concurrent online users: ~10% of DAU = 5M simultaneous connections
Each WebSocket connection: ~10 KB memory on the server
Total memory for connections: 5M * 10 KB = 50 GB

If each server handles 50K connections:
  5M / 50K = 100 WebSocket servers
```

### Storage

```
Average message size:    200 bytes (text + metadata)
Daily storage:           2B * 200 bytes = 400 GB/day
Yearly:                  400 GB * 365 = ~146 TB/year
With media metadata:     ~200 TB/year
```

### Bandwidth

```
Messages per second:     23,000
Average message size:    200 bytes
Inbound bandwidth:       23K * 200 = 4.6 MB/s
Outbound (fan-out):      Much higher for group messages
```

---

## Step 3: High-Level Design

Here's the critical insight: **chat needs two different protocols**. HTTP is
fine for fetching history, updating profiles, and searching. But for
real-time messaging, you need WebSockets — persistent, bidirectional
connections.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
│               (mobile apps, web browsers)                    │
└────────────┬──────────────────────────────┬─────────────────┘
             │                              │
      HTTP requests                  WebSocket connections
    (history, search,                (real-time messages,
     profile, auth)                   typing indicators,
             │                        presence)
             │                              │
      ┌──────▼───────┐              ┌───────▼──────┐
      │   HTTP API   │              │  WebSocket   │
      │   Servers    │              │  Servers     │
      │  (stateless) │              │  (stateful!) │
      └──────┬───────┘              └───────┬──────┘
             │                              │
             │              ┌───────────────┤
             │              │               │
             │       ┌──────▼──────┐  ┌─────▼──────┐
             │       │  Message    │  │  Presence  │
             │       │  Service    │  │  Service   │
             │       └──────┬──────┘  └─────┬──────┘
             │              │               │
             │       ┌──────▼──────┐  ┌─────▼──────┐
             │       │  Message    │  │  Redis     │
             │       │  Queue      │  │ (presence  │
             │       │  (Kafka)    │  │  + pubsub) │
             │       └──────┬──────┘  └────────────┘
             │              │
      ┌──────▼──────────────▼──────┐
      │      Message Database      │
      │    (Cassandra / ScyllaDB)  │
      └────────────────────────────┘
```

### Why WebSockets?

**Analogy:** HTTP is like sending a letter — you write it, mail it, wait
for a reply. If you want to know if someone sent YOU a letter, you have
to walk to the mailbox and check. WebSockets are like a phone line — once
connected, either side can talk at any time. No checking, no polling.

```
HTTP (request-response):
  Client: "Any new messages?"  →  Server: "No"
  Client: "Any new messages?"  →  Server: "No"
  Client: "Any new messages?"  →  Server: "Yes, here's one"
  (wasteful — most requests return nothing)

WebSocket (bidirectional):
  Client ←──── persistent connection ────→ Server
  Server pushes messages the instant they arrive
  No polling, no wasted requests
```

---

## Step 4: Deep Dives

### Deep Dive 1: WebSocket Connection Management

The WebSocket servers are **stateful** — each server knows which users are
connected to it. This is fundamentally different from stateless HTTP servers
where any server can handle any request.

**The problem:** User A is connected to WebSocket Server 3. User B is
connected to WebSocket Server 7. A sends a message to B. How does Server 3
know to send it to Server 7?

**Solution:** A connection registry that maps user IDs to server instances.

```
┌────────────────────────────────────────────────────┐
│              Connection Registry (Redis)            │
│                                                    │
│   user_123 → ws-server-3                           │
│   user_456 → ws-server-7                           │
│   user_789 → ws-server-3                           │
│   user_012 → ws-server-1                           │
└────────────────────────────────────────────────────┘
```

Here's how a WebSocket server manages connections in Go:

```go
package chat

import (
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

type ConnectionManager struct {
	connections map[string]*websocket.Conn
	mu          sync.RWMutex
	upgrader    websocket.Upgrader
}

func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[string]*websocket.Conn),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
	}
}

func (cm *ConnectionManager) HandleConnection(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	conn, err := cm.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	cm.mu.Lock()
	cm.connections[userID] = conn
	cm.mu.Unlock()

	defer func() {
		cm.mu.Lock()
		delete(cm.connections, userID)
		cm.mu.Unlock()
		conn.Close()
	}()

	for {
		var msg Message
		if err := conn.ReadJSON(&msg); err != nil {
			return
		}
		cm.routeMessage(msg)
	}
}

func (cm *ConnectionManager) routeMessage(msg Message) {
	cm.mu.RLock()
	recipientConn, online := cm.connections[msg.RecipientID]
	cm.mu.RUnlock()

	if online {
		recipientConn.WriteJSON(msg)
		return
	}

	enqueueForOfflineDelivery(msg)
}

func (cm *ConnectionManager) SendToUser(userID string, msg Message) bool {
	cm.mu.RLock()
	conn, exists := cm.connections[userID]
	cm.mu.RUnlock()

	if !exists {
		return false
	}

	return conn.WriteJSON(msg) == nil
}

type Message struct {
	ID          string `json:"id"`
	SenderID    string `json:"sender_id"`
	RecipientID string `json:"recipient_id"`
	ChannelID   string `json:"channel_id"`
	Content     string `json:"content"`
	Timestamp   int64  `json:"timestamp"`
	Type        string `json:"type"`
}

func enqueueForOfflineDelivery(msg Message) {
	// push to message queue for later delivery
}
```

**Handling 1M concurrent connections** across servers:

```
Strategy: Consistent hashing for user → server assignment

         ┌────────────┐
         │   Client   │
         └──────┬─────┘
                │
         ┌──────▼─────┐
         │    Load    │  hash(user_id) → server
         │  Balancer  │  (sticky sessions)
         └──────┬─────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼───┐  ┌───▼───┐  ┌───▼───┐
│ WS-1  │  │ WS-2  │  │ WS-3  │
│ 50K   │  │ 50K   │  │ 50K   │
│ conns │  │ conns │  │ conns │
└───────┘  └───────┘  └───────┘
```

Each server handles ~50K connections. For 1M users: 20 servers. For 5M: 100
servers. Servers communicate via a message bus (Redis Pub/Sub or Kafka).

---

### Deep Dive 2: Message Delivery Flow

#### Case 1: Both Users Online

```
┌─────────┐                                           ┌─────────┐
│ Alice   │                                           │  Bob    │
│(online) │                                           │(online) │
└────┬────┘                                           └────┬────┘
     │                                                     │
     │  1. Send "Hey Bob!"                                 │
     │──────────────▶┌──────────┐                          │
     │               │  WS      │  2. Look up Bob's       │
     │               │ Server A │     server                │
     │               └────┬─────┘                          │
     │                    │                                │
     │               3. Bob is on                          │
     │                  Server B                           │
     │                    │                                │
     │               ┌────▼─────┐                          │
     │               │ Message  │  4. Persist to DB        │
     │               │ Service  │  5. Publish to Server B  │
     │               └────┬─────┘                          │
     │                    │                                │
     │               ┌────▼─────┐                          │
     │               │  WS      │  6. Push to Bob's        │
     │               │ Server B │     WebSocket             │
     │               └────┬─────┘                          │
     │                    │         7. "Hey Bob!"           │
     │                    │────────────────────────────▶    │
     │                                                     │
     │  8. Delivery ack ◀──────────────────────────────    │
```

#### Case 2: Recipient Offline

```
┌─────────┐                                           ┌─────────┐
│ Alice   │                                           │  Bob    │
│(online) │                                           │(offline)│
└────┬────┘                                           └────┬────┘
     │                                                     │
     │  1. Send "Hey Bob!"                                 │
     │──────────────▶┌──────────┐                          │
     │               │  WS      │  2. Look up Bob          │
     │               │ Server A │     → NOT CONNECTED      │
     │               └────┬─────┘                          │
     │                    │                                │
     │               ┌────▼─────┐                          │
     │               │ Message  │  3. Persist to DB        │
     │               │ Service  │  4. Add to Bob's         │
     │               └────┬─────┘     unread queue         │
     │                    │                                │
     │               ┌────▼─────┐                          │
     │               │  Push    │  5. Send push            │
     │               │ Service  │     notification         │
     │               └──────────┘                          │
     │                                                     │
     │           ... Bob comes online later ...            │
     │                                                     │
     │                                            6. Bob   │
     │                              connects ──────────▶   │
     │                              7. Fetch unread ◀──    │
     │                              8. Mark delivered ──▶  │
```

**Key insight:** Every message gets persisted to the database FIRST, then
delivered in real-time. The database is the source of truth. The WebSocket
delivery is an optimization for speed, not the only delivery path.

---

### Deep Dive 3: Group Message Fan-Out

This is where it gets tricky. When Alice sends "Hello!" to a group with
200 members, how do you deliver it?

#### Small Groups (< 500 members): Write-Time Fan-Out

**Analogy:** Like a teacher making 30 copies of a handout and putting one
in each student's folder. More work upfront, but each student just opens
their folder.

```
Alice sends "Hello!" to group

┌──────────┐     ┌──────────────┐
│  Alice   │────▶│  Message     │
│          │     │  Service     │
└──────────┘     └──────┬───────┘
                        │
              Write to each member's inbox:
                        │
        ┌───────────────┼───────────────┐
        │               │               │
  ┌─────▼─────┐   ┌─────▼─────┐   ┌────▼──────┐
  │ Bob's     │   │ Carol's   │   │ Dave's    │
  │ inbox     │   │ inbox     │   │ inbox     │
  │ queue     │   │ queue     │   │ queue     │
  └───────────┘   └───────────┘   └───────────┘
```

- **Pro:** Reading your inbox is fast — just read your own queue
- **Con:** Sending is slow and expensive — 200 members = 200 writes
- **Use when:** Group size is small (< 500 members)

#### Large Channels (1,000+ members): Read-Time Fan-Out

**Analogy:** Like posting a notice on a bulletin board. You write it once,
and everyone checks the board when they want to see updates. The message
is stored once in the channel log. When a member opens the channel, they
query the log directly.

- **Pro:** Sending is fast — just one write
- **Con:** Reading is more work — each user queries the channel log
- **Use when:** Channel is large (1,000+ members)

#### Hybrid Approach (What Real Systems Do)

```
if group.size < 500 {
    // write-time fan-out: copy to each member's inbox
    fanOutOnWrite(message, group.members)
} else {
    // read-time fan-out: write once to channel log
    appendToChannelLog(message, group.channelID)
}
```

---

### Deep Dive 4: Message Storage

Chat messages have a very specific access pattern:

1. **Recent messages** are read constantly (last 50 in a conversation)
2. **Old messages** are rarely accessed (scroll-back)
3. **Messages are never updated** (append-only)
4. **Reads are by conversation** (give me messages in channel X)

This pattern screams **wide-column store** (Cassandra or ScyllaDB).

```
Partition key:  channel_id
Clustering key: message_timestamp (descending)

┌────────────────────────────────────────────────────────────┐
│ Partition: channel_abc123                                   │
├───────────────┬───────────┬───────────┬────────────────────┤
│ timestamp     │ sender_id │ msg_type  │ content            │
├───────────────┼───────────┼───────────┼────────────────────┤
│ 1705312200000 │ user_456  │ text      │ "See you tomorrow" │
│ 1705312180000 │ user_123  │ text      │ "Sounds good!"     │
│ 1705312150000 │ user_456  │ image     │ {url: "s3://..."}  │
│ 1705312100000 │ user_123  │ text      │ "Check this out"   │
│ ...           │ ...       │ ...       │ ...                │
└───────────────┴───────────┴───────────┴────────────────────┘
```

**Why Cassandra over PostgreSQL for messages?**

| Feature | PostgreSQL | Cassandra |
|---------|-----------|-----------|
| Write throughput | Good with tuning | Excellent (distributed) |
| Read by partition | Needs index | Native (partition key) |
| Horizontal scaling | Complex (sharding) | Built-in |
| Time-range queries | Good | Excellent (clustering key) |
| Transactions | Full ACID | Limited |
| Schema changes | Migrations | Flexible |

**For 50M DAU generating 2B messages/day, Cassandra is the better fit.**
You don't need transactions for chat messages (they're append-only), and
you need massive write throughput and easy horizontal scaling.

---

### Deep Dive 5: Presence Service

Showing who's online seems simple but is surprisingly hard at scale.

**Analogy:** Imagine a huge office building. You want a board in the lobby
showing who's currently in the building. With 10 people, easy. With 50,000
people entering and leaving every minute, that board needs constant
updating and everyone looking at it needs a fresh view.

#### Heartbeat-Based Presence

```
1. When user connects via WebSocket → mark as "online" in Redis
2. Client sends a heartbeat every 30 seconds
3. If no heartbeat for 60 seconds → mark as "offline"
4. On explicit disconnect → mark as "offline" immediately
```

```
Redis structure:

HSET presence:user_123 status "online" last_seen 1705312200
HSET presence:user_456 status "online" last_seen 1705312195
HSET presence:user_789 status "away"   last_seen 1705312100

TTL on each key: 90 seconds (auto-expire if no heartbeat)
```

#### The Scale Problem

If user A has 200 friends, and A comes online, do you notify all 200
friends? That's fine. But if 5M users are constantly connecting and
disconnecting, the number of "presence update" messages explodes.

```
5M online users * average 200 friends = 1 billion presence
subscriptions to maintain

Even 1% of users changing status per minute:
  50,000 changes * 200 notifications = 10M presence notifications/minute
```

**Solution:** Don't push presence updates for every change. Instead:

1. **Lazy presence:** Only check presence when a user opens a conversation
   (pull, not push)
2. **Subscribe on view:** Only subscribe to presence updates for users
   currently visible on screen
3. **Batch updates:** Accumulate changes and push every 30 seconds instead
   of instantly

```
┌─────────────────────────────────────────────────────┐
│                 Presence Service                     │
│                                                     │
│  ┌────────────┐    ┌────────────┐   ┌────────────┐  │
│  │ Heartbeat  │    │  Status    │   │ Subscriber │  │
│  │ Receiver   │───▶│  Store     │──▶│ Notifier   │  │
│  │            │    │  (Redis)   │   │ (batched)  │  │
│  └────────────┘    └────────────┘   └────────────┘  │
│                                                     │
│  Heartbeat interval: 30s                            │
│  Offline threshold:  60s (2 missed heartbeats)      │
│  Notification batch: every 30s                      │
└─────────────────────────────────────────────────────┘
```

---

## Step 5: Scaling and Trade-Offs

### Message Ordering

Messages must appear in order within a conversation. But with distributed
servers, two messages might arrive at different servers at slightly different
times.

**Solution:** Use server-side timestamps (not client timestamps) and a
monotonically increasing message ID per channel. Cassandra's clustering key
on timestamp handles this naturally.

For strict ordering within a channel, route all messages for a given channel
through the same partition (consistent hashing on channel_id).

### What Happens When a WebSocket Server Dies?

```
1. All connections to that server drop
2. Clients detect disconnect and reconnect (to a different server)
3. On reconnect, client sends "last message ID I saw"
4. Server sends all messages after that ID (from database)
5. No messages lost — database is the source of truth
```

### End-to-End Delivery Guarantee

```
Sender                    Server                    Recipient
  │                         │                          │
  │── msg (id: 42) ───────▶│                          │
  │                         │── persist to DB ──▶      │
  │◀── server_ack (42) ────│                          │
  │                         │── deliver ──────────────▶│
  │                         │◀── delivery_ack (42) ───│
  │◀── delivered (42) ─────│                          │
  │                         │                          │
  │  (sender sees ✓✓)       │                    (Bob reads)
  │                         │◀── read_ack (42) ──────│
  │◀── read (42) ──────────│                          │
  │  (sender sees blue ✓✓) │                          │
```

Three levels of acknowledgment:
1. **Sent** (✓) — Server received and persisted the message
2. **Delivered** (✓✓) — Recipient's device received the message
3. **Read** (blue ✓✓) — Recipient opened the conversation

### Multi-Device Sync

Users might be on phone AND laptop simultaneously. The connection registry
stores multiple entries per user (one per device). When a message arrives,
deliver to ALL active connections. The first device to send a read_ack
marks it read for all devices.

---

## Complete Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                │
│        (iOS, Android, Web — each maintains WebSocket)          │
└───────────┬──────────────────────────────────┬─────────────────┘
            │                                  │
     HTTP (REST API)                    WebSocket
     (auth, history,                    (messages, typing,
      groups, search)                    presence, receipts)
            │                                  │
     ┌──────▼───────┐                   ┌──────▼───────┐
     │  API Gateway │                   │   WS Load   │
     │              │                   │   Balancer   │
     └──────┬───────┘                   │(sticky sess) │
            │                           └──────┬───────┘
     ┌──────▼───────┐                          │
     │  HTTP API    │              ┌───────────┼───────────┐
     │  Servers     │              │           │           │
     └──────┬───────┘         ┌────▼───┐  ┌───▼────┐ ┌───▼────┐
            │                 │  WS-1  │  │  WS-2  │ │  WS-N  │
            │                 │  50K   │  │  50K   │ │  50K   │
            │                 └────┬───┘  └───┬────┘ └───┬────┘
            │                      └──────────┼──────────┘
            │                                 │
            │                    ┌─────────────┤
            │                    │             │
     ┌──────▼────────────────────▼──┐   ┌─────▼──────┐
     │       Message Service        │   │  Presence  │
     │  (routing, fan-out, persist) │   │  Service   │
     └──────┬───────────────────────┘   └─────┬──────┘
            │                                 │
     ┌──────▼──────┐                   ┌──────▼──────┐
     │   Kafka     │                   │   Redis     │
     │ (message    │                   │ (presence,  │
     │  queue)     │                   │  conn map,  │
     └──────┬──────┘                   │  pub/sub)   │
            │                          └─────────────┘
     ┌──────▼──────┐
     │  Cassandra  │
     │ (messages)  │
     └──────┬──────┘
            │
     ┌──────▼──────┐
     │    Push     │
     │ Notification│──▶ APNs / FCM
     │  Service    │
     └─────────────┘
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Protocol | HTTP long polling | WebSocket | WebSocket for real-time |
| Group fan-out | Write-time (to inboxes) | Read-time (from channel log) | Hybrid based on group size |
| Message store | PostgreSQL | Cassandra | Cassandra for write throughput |
| Presence | Push every change | Pull on demand | Hybrid — push for active views |
| Ordering | Client timestamps | Server timestamps + seq IDs | Server-side |
| Delivery | At-most-once | At-least-once | At-least-once with dedup |

---

## Common Interview Follow-Ups

**Q: How do you handle message search?**
Store messages in Elasticsearch alongside Cassandra. Write to both (or use
CDC from Cassandra to ES). Search queries go to ES, conversation views go
to Cassandra.

**Q: How do you handle typing indicators?**
Send via WebSocket but DON'T persist them. They're ephemeral. Route them
directly through the pub/sub layer (Redis) without hitting the database.

**Q: What about message editing and deletion?**
Soft delete (mark as deleted, don't remove). For edits, store a new version
with a reference to the original message ID. Clients fetch the latest
version.

**Q: How do you handle rate limiting in chat?**
Per-user rate limit: 30 messages per minute per channel. If exceeded, queue
messages server-side and deliver with delay rather than dropping them.

---

## Hands-On Exercise

Build a minimal chat server:

1. Create a WebSocket server in Go that accepts connections
2. Implement a connection manager (map of user ID to connection)
3. Route messages between two connected users
4. Add an in-memory message store (slice of messages per channel)
5. Handle disconnection: queue messages for offline users
6. Swap the in-memory store for Redis pub/sub between server instances

---

## Key Takeaways

1. **WebSockets for real-time, HTTP for everything else** — don't force
   everything through one protocol
2. **The database is the source of truth**, not the WebSocket. Messages
   survive server crashes because they're persisted first
3. **Fan-out strategy depends on group size** — write-time for small groups,
   read-time for large channels
4. **Presence is harder than it looks** — naive push-based presence creates
   a notification storm at scale
5. **Stateful servers need special handling** — WebSocket servers can't be
   load-balanced the same way as stateless HTTP servers
6. **Three levels of delivery acknowledgment** — sent, delivered, read —
   each requires different infrastructure

---

*Next: [Lesson 20 — Design a Notification System](./20-notification-system.md),
where we tackle multi-channel delivery, user preferences, and retry logic.*
