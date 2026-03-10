# Lesson 9: Distributed Locking

> Mutual exclusion across machines: harder than it sounds.

---

## The Analogy

A bathroom on an airplane. The "Occupied" sign is your
lock. But what if:

- The sign breaks (lock server crashes)?
- Someone falls asleep inside (lock holder dies)?
- Two people see "Vacant" at the same time?

Distributed locks need to handle ALL of these.

---

## Why We Need Distributed Locks

```
  Without lock:

  Worker A: read counter (=10)
  Worker B: read counter (=10)
  Worker A: write counter = 11
  Worker B: write counter = 11   <-- lost update!

  With lock:

  Worker A: acquire lock
  Worker A: read counter (=10), write 11
  Worker A: release lock
  Worker B: acquire lock
  Worker B: read counter (=11), write 12
  Worker B: release lock
```

Use cases: cron job dedup, resource access control,
leader election, rate limiting.

---

## Naive Lock with Redis

```
  SET mylock "owner1" NX EX 30

  NX = only set if not exists
  EX = expire after 30 seconds

  Problem 1: Clock skew
  Problem 2: Redis crashes after SET, before replication
  Problem 3: Lock expires while holder is still working
```

### The GC Pause Problem

```
  Time -->

  Client A: acquire lock  [===GC PAUSE===]  do work (expired!)
  Client B:               acquire lock       do work

  Both think they have the lock!

  +---------+-----------+-----------+
  |  A gets | A paused  | A's lock  |
  |  lock   | by GC     | expired   |
  +---------+-----------+-----------+
                         |
              +---------+-----------+
              | B gets  | B works   |
              | lock    |           |
              +---------+-----------+
```

---

## Fencing Tokens

Every time a lock is acquired, the server issues a
monotonically increasing token. The protected resource
rejects operations with old tokens.

```
  Lock Server issues token 33 to Client A
  Client A pauses (GC)
  Lock expires
  Lock Server issues token 34 to Client B
  Client B writes to storage: "token 34, set X=5" -> OK
  Client A wakes up: "token 33, set X=3" -> REJECTED (33 < 34)

  +----------+     token 33     +----------+
  | Client A |----------------->| Storage  |
  +----------+                  | rejects  |
                                | 33 < 34  |
  +----------+     token 34     |          |
  | Client B |----------------->| accepts  |
  +----------+                  +----------+
```

This is the ONLY way to make distributed locks truly safe.

---

## Redlock Algorithm

Martin Kleppmann and Salvatore Sanfilippo debated this
extensively. Here's how Redlock works:

### Setup: N Independent Redis Instances (typically 5)

```
  +-------+  +-------+  +-------+  +-------+  +-------+
  | Redis |  | Redis |  | Redis |  | Redis |  | Redis |
  |   1   |  |   2   |  |   3   |  |   4   |  |   5   |
  +-------+  +-------+  +-------+  +-------+  +-------+

  NOT replicas of each other. Completely independent.
```

### Algorithm

```
  1. Get current time T1
  2. Try to acquire lock on ALL N instances
     (with short timeout per instance)
  3. Get current time T2
  4. Lock is acquired if:
     - Majority (N/2 + 1) instances locked
     - Time elapsed (T2 - T1) < lock TTL
  5. Effective TTL = original TTL - (T2 - T1)
  6. If failed: release lock on ALL instances
```

### Why Majority?

```
  5 instances. You lock 3 of them.

  Another client can lock at most 2 (the others).
  That's NOT a majority. Safe!

  If 2 Redis instances crash:
  You still have 3 locked. Still a majority.

  If 3 crash: You lose majority. Lock fails.
  That's correct — you SHOULD fail.
```

---

## Lease-Based Locks

A lock with a built-in expiration. The holder must
renew before it expires.

```
  acquire(key, ttl=10s) -> lease_id

  Time: 0s     5s      10s      15s
         |------|--------|---------|
         ^      ^        ^
       acquire  renew    expire
                (reset   (if not
                 to 10s)  renewed)
```

### Renewal Strategy

```
  TTL = 10 seconds
  Renew every TTL/3 = 3.3 seconds

  |----renew----renew----renew----|
  0    3.3      6.6      10

  If one renewal fails, you have ~6.7s to retry
  before the lock expires.
```

---

## Code: Distributed Lock with Fencing

```go
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

type LockServer struct {
	mu           sync.Mutex
	locks        map[string]*lockEntry
	fencingToken uint64
}

type lockEntry struct {
	owner   string
	token   uint64
	expires time.Time
}

func NewLockServer() *LockServer {
	return &LockServer{
		locks: make(map[string]*lockEntry),
	}
}

func (ls *LockServer) Acquire(key, owner string, ttl time.Duration) (uint64, bool) {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	existing, exists := ls.locks[key]
	if exists && time.Now().Before(existing.expires) {
		return 0, false
	}

	token := atomic.AddUint64(&ls.fencingToken, 1)
	ls.locks[key] = &lockEntry{
		owner:   owner,
		token:   token,
		expires: time.Now().Add(ttl),
	}
	return token, true
}

func (ls *LockServer) Release(key, owner string) bool {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	existing, exists := ls.locks[key]
	if !exists || existing.owner != owner {
		return false
	}

	delete(ls.locks, key)
	return true
}

func (ls *LockServer) Renew(key, owner string, ttl time.Duration) bool {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	existing, exists := ls.locks[key]
	if !exists || existing.owner != owner {
		return false
	}

	if time.Now().After(existing.expires) {
		return false
	}

	existing.expires = time.Now().Add(ttl)
	return true
}

type FencedStorage struct {
	mu        sync.Mutex
	data      map[string]string
	lastToken map[string]uint64
}

func NewFencedStorage() *FencedStorage {
	return &FencedStorage{
		data:      make(map[string]string),
		lastToken: make(map[string]uint64),
	}
}

func (fs *FencedStorage) Write(key, value string, token uint64) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	if last, exists := fs.lastToken[key]; exists && token <= last {
		return fmt.Errorf("stale token %d <= %d", token, last)
	}

	fs.data[key] = value
	fs.lastToken[key] = token
	return nil
}

func main() {
	server := NewLockServer()
	storage := NewFencedStorage()
	ttl := 2 * time.Second

	fmt.Println("=== Normal lock/unlock ===")
	token1, ok := server.Acquire("resource", "worker-A", ttl)
	fmt.Printf("Worker-A acquire: ok=%v token=%d\n", ok, token1)

	_, ok = server.Acquire("resource", "worker-B", ttl)
	fmt.Printf("Worker-B acquire (should fail): ok=%v\n", ok)

	err := storage.Write("data", "from-A", token1)
	fmt.Printf("Worker-A write: err=%v\n", err)

	server.Release("resource", "worker-A")
	fmt.Println("Worker-A released")

	token2, ok := server.Acquire("resource", "worker-B", ttl)
	fmt.Printf("Worker-B acquire: ok=%v token=%d\n", ok, token2)

	err = storage.Write("data", "from-B", token2)
	fmt.Printf("Worker-B write: err=%v\n", err)

	fmt.Println("\n=== Stale token rejected ===")
	err = storage.Write("data", "stale-from-A", token1)
	fmt.Printf("Worker-A stale write: err=%v\n", err)

	fmt.Println("\n=== Lock expiry ===")
	token3, _ := server.Acquire("timer-test", "worker-C", 1*time.Second)
	fmt.Printf("Worker-C acquired timer-test: token=%d\n", token3)
	fmt.Println("Waiting for expiry...")
	time.Sleep(1100 * time.Millisecond)

	token4, ok := server.Acquire("timer-test", "worker-D", ttl)
	fmt.Printf("Worker-D acquire after expiry: ok=%v token=%d\n", ok, token4)
}
```

---

## Lock Comparison

```
  +------------------+-----------+-----------+-----------+
  | Approach         | Safety    | Liveness  | Complexity|
  +------------------+-----------+-----------+-----------+
  | Single Redis     | Weak      | Good      | Low       |
  | + NX + EX        | (no fence)| (fast)    |           |
  +------------------+-----------+-----------+-----------+
  | Redlock          | Better    | Good      | Medium    |
  |                  | (majority)|           |           |
  +------------------+-----------+-----------+-----------+
  | ZooKeeper        | Strong    | Good      | Medium    |
  | (ephemeral nodes)| (consensus)|          |           |
  +------------------+-----------+-----------+-----------+
  | etcd             | Strong    | Good      | Medium    |
  | (lease + Raft)   | (consensus)|          |           |
  +------------------+-----------+-----------+-----------+
  | Fencing token    | Strongest | Good      | High      |
  | + any of above   | (end-to- |           | (storage  |
  |                  |  end)     |           |  must     |
  |                  |           |           |  check)   |
  +------------------+-----------+-----------+-----------+
```

---

## Exercises

1. **Implement Redlock.** Write a mock with 5 lock
   servers. Simulate one server being slow (500ms) and
   one being down. Verify the lock still works.

2. **Renewal race.** What happens if a lock holder's
   renewal request arrives 1ms AFTER expiry, and another
   client acquired the lock? How do you handle this?

3. **Think about it.** Why is fencing the ONLY approach
   that's truly safe? Can you construct a scenario where
   Redlock fails without fencing tokens?

4. **Design.** You need a distributed cron: only one
   instance runs a scheduled job at a time. Design the
   locking strategy, including what happens when the
   job takes longer than expected.

---

[Next: Lesson 10 — Conflict Resolution -->](10-conflict-resolution.md)
