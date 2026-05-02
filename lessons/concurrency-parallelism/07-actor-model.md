# 07 - Actor Model

## The Analogy

Imagine an office full of independent workers, each at their own desk.

Each worker has:
- A **mailbox** (inbox) where messages pile up
- **Private state** (their own notes, files -- nobody else touches them)
- The ability to **send letters** to any other worker's mailbox

No worker ever walks to another's desk. No shared whiteboards. Everything
happens through mail. If a worker crashes, their supervisor reassigns work.

```
  +--------+    +--------+    +--------+
  | Actor  |    | Actor  |    | Actor  |
  |   A    |    |   B    |    |   C    |
  | [state]|    | [state]|    | [state]|
  +---+----+    +---+----+    +---+----+
      |             |             |
  [mailbox]     [mailbox]     [mailbox]
   msg msg       msg           msg msg msg

  A sends to B's mailbox. B processes one at a time.
  No locks needed -- B is the only one touching B's state.
```

## Actor Model: The Rules

Carl Hewitt defined the Actor Model in 1973. Each actor can:

1. **Receive** a message from its mailbox
2. **Send** messages to other actors it knows about
3. **Create** new actors
4. **Decide** what to do with the next message (change behavior)

That's it. No shared state. No locks. No direct function calls between actors.

```
  Actor Lifecycle
  ===============

  create --> [idle] --> receive msg --> [processing]
                ^                           |
                |                           +-- send messages
                |                           +-- create actors
                |                           +-- update own state
                |                           |
                +------ [idle] <------------+
```

## CSP vs Actor Model

Both are message-passing models, but they differ in important ways:

```
  +-------------------+-------------------+-------------------+
  |                   | CSP               | Actor Model       |
  +-------------------+-------------------+-------------------+
  | Communication     | Named channels    | Named actors      |
  | Addressing        | Send to channel   | Send to actor     |
  | Mailbox           | Channel IS the    | Actor HAS a       |
  |                   | buffer            | mailbox            |
  | Synchronization   | Rendezvous        | Async (fire &     |
  |                   | (can be sync)     | forget)            |
  | Topology          | Fixed channels    | Dynamic (actors   |
  |                   |                   | discover each     |
  |                   |                   | other)             |
  | Distribution      | Hard              | Natural (actors   |
  |                   |                   | can be anywhere)   |
  +-------------------+-------------------+-------------------+
```

Key difference: in CSP, you send to a *channel*. In actors, you send
to an *actor*. This makes actors naturally distributable across machines.

## Erlang/OTP: The Gold Standard

Erlang was built for telecom switches that must never go down. Its
actor model (called "processes") is the most battle-tested implementation.

```erlang
-module(counter).
-export([start/0, increment/1, get/1]).

start() ->
    spawn(fun() -> loop(0) end).

loop(Count) ->
    receive
        {increment} ->
            loop(Count + 1);
        {get, Caller} ->
            Caller ! {count, Count},
            loop(Count)
    end.

increment(Pid) ->
    Pid ! {increment}.

get(Pid) ->
    Pid ! {get, self()},
    receive
        {count, N} -> N
    end.
```

Each Erlang process is ~2KB. A single machine can run millions.
Processes are fully isolated -- one crashing cannot corrupt another.

## Supervision Trees

The killer feature of Erlang/OTP. Actors are organized in a tree.
Parent actors (supervisors) watch their children. If a child crashes,
the supervisor restarts it.

```
  Supervision Tree
  ================

          [App Supervisor]
          /       |        \
    [Web Sup]  [DB Sup]   [Cache Sup]
    /    \      /    \        |
  [W1]  [W2] [Conn1][Conn2] [C1]

  Restart Strategies:
  -------------------
  one_for_one:   Restart only the crashed child
  one_for_all:   Restart ALL children if one crashes
  rest_for_one:  Restart crashed child and all started after it

  If [Conn1] crashes:
    [DB Sup] restarts it (one_for_one)
    [Conn2] is unaffected
    [Web Sup] and [Cache Sup] don't even know

  If [DB Sup] itself crashes:
    [App Supervisor] restarts the entire DB subtree
```

This is "let it crash" philosophy. Don't try to handle every error.
Let actors crash and let supervisors clean up.

## Actor Model in Other Languages

### Go: Simulating Actors with Goroutines

```go
type CounterMsg struct {
    kind  string
    reply chan int
}

func counterActor(mailbox <-chan CounterMsg) {
    count := 0
    for msg := range mailbox {
        switch msg.kind {
        case "increment":
            count++
        case "get":
            msg.reply <- count
        }
    }
}

func main() {
    mailbox := make(chan CounterMsg, 100)
    go counterActor(mailbox)

    mailbox <- CounterMsg{kind: "increment"}
    mailbox <- CounterMsg{kind: "increment"}
    mailbox <- CounterMsg{kind: "increment"}

    reply := make(chan int)
    mailbox <- CounterMsg{kind: "get", reply: reply}
    fmt.Println("Count:", <-reply)
}
```

Go doesn't have actors built in, but goroutine + channel + select
gives you the building blocks. See: **Go Track** on goroutine patterns.

### Rust: Actix Framework

```rust
use tokio::sync::mpsc;

enum CounterMsg {
    Increment,
    Get(tokio::sync::oneshot::Sender<i64>),
}

async fn counter_actor(mut rx: mpsc::Receiver<CounterMsg>) {
    let mut count: i64 = 0;
    while let Some(msg) = rx.recv().await {
        match msg {
            CounterMsg::Increment => count += 1,
            CounterMsg::Get(reply) => {
                let _ = reply.send(count);
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let (tx, rx) = mpsc::channel(100);
    tokio::spawn(counter_actor(rx));

    tx.send(CounterMsg::Increment).await.unwrap();
    tx.send(CounterMsg::Increment).await.unwrap();

    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    tx.send(CounterMsg::Get(reply_tx)).await.unwrap();
    println!("Count: {}", reply_rx.await.unwrap());
}
```

### Python: Simple Actor Pattern

```python
import asyncio

class Actor:
    def __init__(self):
        self._mailbox = asyncio.Queue()
        self._running = False

    async def start(self):
        self._running = True
        while self._running:
            msg = await self._mailbox.get()
            await self.handle(msg)

    async def send(self, msg):
        await self._mailbox.put(msg)

    async def handle(self, msg):
        raise NotImplementedError

class Counter(Actor):
    def __init__(self):
        super().__init__()
        self._count = 0

    async def handle(self, msg):
        if msg["type"] == "increment":
            self._count += 1
        elif msg["type"] == "get":
            msg["reply"].set_result(self._count)

async def main():
    counter = Counter()
    task = asyncio.create_task(counter.start())

    await counter.send({"type": "increment"})
    await counter.send({"type": "increment"})

    future = asyncio.get_event_loop().create_future()
    await counter.send({"type": "get", "reply": future})
    print(f"Count: {await future}")

    task.cancel()

asyncio.run(main())
```

## When Actors Shine

```
  USE ACTORS WHEN:                   AVOID ACTORS WHEN:
  ================                   ==================
  - Distributed systems              - Tight coupling needed
  - Fault tolerance required         - Low-latency shared state
  - Independent entities (users,     - Simple request/response
    devices, game objects)            - Small, synchronous code
  - Long-lived stateful processes
  - "Let it crash" is acceptable
```

## Actor Model Pitfalls

```
  1. MAILBOX OVERFLOW               2. DEADLOCK BY REQUEST-REPLY

  Fast sender --> [msg msg msg       Actor A: send request to B
                   msg msg msg         wait for B's reply
                   msg msg ...]      Actor B: send request to A
  Slow receiver                        wait for A's reply
  --> memory grows unbounded!           --> both waiting forever

  FIX: bounded mailbox              FIX: async fire-and-forget
       + backpressure                    or timeout on replies

  3. ORDERING ASSUMPTIONS           4. DISTRIBUTED DEBUGGING

  A sends msg1 to C                 Where did the message go?
  A sends msg2 to C                 Which actor has the bug?
  C receives msg1, msg2 (OK)        Tracing across actors is HARD

  A sends msg1 to B, B forwards     FIX: structured logging
  A sends msg2 to C                      correlation IDs
  C may get msg2 before msg1!            distributed tracing
```

## Exercises

1. **Build**: Implement a chat room as actors. One "room" actor manages
   the member list. Multiple "user" actors send/receive messages via
   the room. Handle user join/leave.

2. **Design**: Design a supervision tree for a web scraping system:
   - A coordinator assigns URLs to workers
   - Workers fetch pages and may crash (bad URLs, timeouts)
   - Results go to a storage actor
   Draw the tree and specify restart strategies.

3. **Compare**: Rewrite lesson 06's pipeline example using actors
   instead of CSP channels. Which feels more natural?

4. **Think**: Why is the actor model natural for distributed systems
   but CSP is not? What changes when actors are on different machines?

---

**Next** -> [08 - Async/Await](08-async-await.md)
