# Lesson 15: Non-Blocking I/O, Event Loops, and Why Async Matters

In Lesson 13, we saw that the multi-threaded echo server fails at scale
because each connection needs its own OS thread. This lesson explains the
deeper problem and the solution that makes modern servers handle hundreds
of thousands of concurrent connections on a single machine.

---

## Blocking I/O: The Problem

When you call `stream.read()` on a blocking socket, the OS puts your thread
to sleep until data arrives. The thread cannot do anything else.

### The Analogy

**Blocking I/O is standing at the front door waiting for a pizza delivery.**
You opened the door, you are staring at the street, and you are doing nothing
until the delivery person appears. If you ordered from two restaurants, you
would need two people standing at two doors.

**Non-blocking I/O is giving your phone number so they call when it arrives.**
You go about your business -- watch TV, do laundry, read a book -- and when
the phone rings, you know the pizza is here. One person can handle deliveries
from ten restaurants.

---

## Why Blocking I/O Doesn't Scale

Consider a web server handling chat connections. Most of the time, a
connection is idle -- the user is reading, typing, or doing nothing. The
server is just waiting for the next message.

```
Thread per connection (blocking):

Thread 1: [ read() ... waiting ... waiting ... data! ... process ... read() ... waiting ]
Thread 2: [ read() ... waiting ... waiting ... waiting ... waiting ... waiting ... data! ]
Thread 3: [ read() ... data! ... process ... read() ... waiting ... waiting ... waiting ]
Thread 4: [ read() ... waiting ... waiting ... waiting ... waiting ... waiting ... wait ]

4 threads, but only ~10% of the time is spent doing actual work.
The other 90% is threads sleeping, wasting memory and OS resources.
```

With 10,000 connections:
- 10,000 OS threads
- ~4 MB stack per thread = 40 GB of memory just for stacks
- OS scheduler must track 10,000 threads
- Context switching between threads costs CPU cycles

This is the **C10K problem**: how do you handle 10,000 concurrent connections
without drowning in threads?

---

## Non-Blocking I/O: The Building Block

In non-blocking mode, `read()` never waits. If data is available, it returns
the data. If not, it returns immediately with an error code meaning "not
ready yet" (EAGAIN or EWOULDBLOCK on Unix).

```
Blocking read():                   Non-blocking read():

read() called                      read() called
   |                                  |
   | (no data yet)                    | (no data yet)
   | ... thread sleeps ...            |--> returns EWOULDBLOCK immediately
   | ... thread sleeps ...            |
   | ... thread sleeps ...            read() called again
   | (data arrives)                   |--> returns EWOULDBLOCK
   |--> returns data                  |
                                      read() called again
                                      |--> data arrived! returns data
```

But raw non-blocking I/O by itself is not useful. If you just call `read()`
in a tight loop (busy-waiting), you waste CPU:

```rust
// DON'T DO THIS -- burns 100% CPU
loop {
    match stream.read(&mut buffer) {
        Ok(n) => handle_data(&buffer[..n]),
        Err(ref e) if e.kind() == ErrorKind::WouldBlock => {
            continue; // spin, spin, spin
        }
        Err(e) => break,
    }
}
```

What you need is a way to say: "OS, tell me when any of these 10,000 sockets
has data ready, and I'll sleep until then."

---

## Event Notification: select, poll, epoll, kqueue

The OS provides system calls that let you monitor multiple file descriptors
(sockets) and wake up only when something is ready.

### select (1983) -- The Original

```
select(max_fd, read_fds, write_fds, error_fds, timeout)
```

You give the OS a set of file descriptors. The OS blocks until at least one
is ready, then tells you which ones.

```
Your code:
  "OS, watch sockets 3, 7, 12, 19, and 42 for readability"

OS:
  ... checks socket 3: not ready
  ... checks socket 7: not ready
  ... checks socket 12: DATA READY
  ... checks socket 19: not ready
  ... checks socket 42: not ready

  Returns: "socket 12 is ready to read"
```

Problems:
- Limited to 1024 file descriptors (FD_SETSIZE)
- O(n) -- OS must scan every fd every time you call select
- You must rebuild the fd set after every call

### poll (1986) -- Slightly Better

Removes the 1024 fd limit, but still O(n). Same idea: pass a list of fds,
get back which are ready.

### epoll (Linux, 2002) -- The Modern Way

Instead of passing your entire fd list every time, you register fds once.
The OS maintains the list and notifies you only about changes.

```
1. epoll_create()         -- create an epoll instance
2. epoll_ctl(ADD, fd)     -- register a socket
3. epoll_wait()           -- block until events occur (returns ONLY ready fds)
4. ... handle ready fds ...
5. goto 3
```

```
select/poll approach:            epoll approach:

Every call:                      Setup (once):
  "Watch fds 3,7,12,19,42"        epoll_ctl(ADD, fd=3)
  OS scans all 5 fds               epoll_ctl(ADD, fd=7)
  Returns ready ones               epoll_ctl(ADD, fd=12)
                                    epoll_ctl(ADD, fd=19)
                                    epoll_ctl(ADD, fd=42)

                                  Every call:
                                    epoll_wait()
                                    OS returns ONLY ready fds
                                    Work scales with ready fds, not all watched fds
```

Key advantage: epoll_wait returns only the ready file descriptors. With
10,000 connections where 5 have data ready, select scans all 10,000. epoll
returns just those 5.

### kqueue (macOS/BSD, 2000)

The macOS equivalent of epoll. Same concept, different API:

```
1. kqueue()                      -- create a kqueue instance
2. kevent(changelist=[fd,...])    -- register interest
3. kevent(eventlist)             -- block until events, returns ready fds
```

### The Unified View

```
                +------ Linux ------+
                |      epoll        |
                +-------------------+
 Application                           OS Kernel
    Code      ---> Event Loop --->  +------ macOS ------+
                                    |      kqueue       |
                                    +-------------------+
                                    +------ Windows ----+
                                    |      IOCP         |
                                    +-------------------+
```

Rust's `mio` crate abstracts over all of these, providing a single API.
tokio is built on top of mio.

---

## The Event Loop Pattern

With epoll/kqueue, a single thread can handle thousands of connections:

```
One thread, many connections:

  +-- Event Loop (single thread) --------------------------------+
  |                                                               |
  |  epoll_wait()  -->  [socket 12 readable, socket 42 readable]  |
  |                                                               |
  |  handle socket 12:                                            |
  |    read data                                                  |
  |    process it                                                 |
  |    write response                                             |
  |                                                               |
  |  handle socket 42:                                            |
  |    read data                                                  |
  |    process it                                                 |
  |    write response                                             |
  |                                                               |
  |  epoll_wait()  -->  [socket 7 readable]                       |
  |                                                               |
  |  handle socket 7:                                             |
  |    read data                                                  |
  |    ...                                                        |
  +---------------------------------------------------------------+
```

The thread is never idle while there is work to do. It processes whichever
connections are ready and goes back to sleep only when nothing is ready.

---

## How tokio Works Under the Hood

tokio is Rust's most popular async runtime. Here is what happens when you
write `stream.read(&mut buf).await`:

```
Your async code                 tokio runtime                   OS kernel
     |                              |                              |
     | stream.read().await          |                              |
     |---> "I want to read"        |                              |
     |     returns Poll::Pending    |                              |
     |                              |                              |
     | (task yields, other tasks    |                              |
     |  can run on this thread)     |                              |
     |                              | epoll_wait() / kqueue()      |
     |                              |----------------------------->|
     |                              |                              |
     |                              | (blocks until something      |
     |                              |  is ready)                   |
     |                              |                              |
     |                              | <--- socket is readable -----|
     |                              |                              |
     | (task is woken up)           |                              |
     |<--- "your socket is ready"   |                              |
     | stream.read() succeeds       |                              |
     | data is returned             |                              |
```

### tokio's Architecture

```
+-------------------------------------------------------+
|  Your async tasks (thousands of them)                  |
|  +------+ +------+ +------+ +------+ +------+        |
|  |Task 1| |Task 2| |Task 3| |Task 4| |Task N|        |
|  +------+ +------+ +------+ +------+ +------+        |
+-------------------------------------------------------+
|  Task scheduler (picks which task to run next)         |
+-------------------------------------------------------+
|  Worker threads (one per CPU core, typically 4-16)     |
|  +----------+ +----------+ +----------+ +----------+  |
|  | Thread 1 | | Thread 2 | | Thread 3 | | Thread 4 | |
|  +----------+ +----------+ +----------+ +----------+  |
+-------------------------------------------------------+
|  I/O driver (mio: wraps epoll/kqueue/IOCP)            |
+-------------------------------------------------------+
|  OS kernel (epoll/kqueue/IOCP)                         |
+-------------------------------------------------------+
```

1. Your code creates async tasks with `tokio::spawn`.
2. Each task runs on a worker thread until it hits an `.await`.
3. At `.await`, if the operation is not ready, the task yields.
4. The worker thread picks up another ready task.
5. The I/O driver (epoll/kqueue) monitors all registered sockets.
6. When a socket becomes ready, the corresponding task is woken up.
7. A worker thread picks up the woken task and resumes it.

This is why 4 OS threads can handle 100,000 connections: each thread runs
whichever task is ready, and tasks are incredibly lightweight (a few KB of
state, no OS thread stack).

---

## Rust Futures and Polling

In Rust, async functions compile down to state machines that implement the
`Future` trait:

```rust
trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}

enum Poll<T> {
    Ready(T),
    Pending,
}
```

When you write:

```rust
async fn read_message(stream: &mut TcpStream) -> String {
    let mut buf = [0u8; 1024];
    let n = stream.read(&mut buf).await.unwrap();
    String::from_utf8_lossy(&buf[..n]).to_string()
}
```

The compiler transforms it into something like:

```rust
enum ReadMessageState {
    Start,
    WaitingForRead { buf: [u8; 1024], read_future: ReadFuture },
    Done,
}

impl Future for ReadMessageState {
    type Output = String;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<String> {
        match self.state {
            Start => {
                // set up buffer, create read future
                self.state = WaitingForRead { ... };
                // poll the read future
                self.poll(cx)
            }
            WaitingForRead { buf, read_future } => {
                match read_future.poll(cx) {
                    Poll::Pending => Poll::Pending,  // not ready, yield
                    Poll::Ready(Ok(n)) => {
                        let result = String::from_utf8_lossy(&buf[..n]).to_string();
                        Poll::Ready(result)
                    }
                    Poll::Ready(Err(_)) => panic!(),
                }
            }
            Done => panic!("polled after completion"),
        }
    }
}
```

Each `.await` point becomes a state in the state machine. The task stores its
state in a few bytes on the heap instead of a full thread stack.

---

## io_uring: The Newest I/O Model (Linux 5.1+)

epoll tells you when a socket is ready, then you perform the read/write
yourself. io_uring goes further: you tell the kernel what operations to
perform, and the kernel does them for you.

```
epoll approach:                      io_uring approach:

1. Register socket                   1. Submit: "read 1024 bytes from fd 7
2. epoll_wait() -> "fd 7 readable"       into this buffer"
3. read(fd 7, buf, 1024) yourself    2. Wait for completion
4. Process data                      3. Buffer already has data (kernel filled it)
                                     4. Process data
```

Advantages:
- Fewer system calls (submit batches of operations)
- Zero-copy in some cases (kernel reads directly into your buffer)
- Works for disk I/O too (epoll only works for network sockets)

io_uring is still maturing. The `tokio-uring` crate provides experimental
support. For now, epoll-based tokio is the standard choice.

---

## Why Go Doesn't Need This

Go has goroutines: lightweight green threads managed by the Go runtime. When
a goroutine calls `conn.Read()`, the Go runtime:

1. Marks the goroutine as "waiting for I/O"
2. Registers the socket with the runtime's netpoller (which uses epoll/kqueue)
3. Runs other goroutines on the same OS thread
4. When data arrives, the runtime resumes the goroutine

The programmer writes blocking-looking code, but the runtime handles the
async I/O underneath.

```go
// Looks blocking, but the Go runtime makes it async internally
func handleConn(conn net.Conn) {
    buf := make([]byte, 1024)
    n, err := conn.Read(buf) // goroutine yields here, but you don't see it
    // ...
}
```

Go's approach is simpler for the programmer but less flexible than Rust's.
You cannot choose a different runtime, and you have less control over task
scheduling.

---

## Why Rust's Async Is More Explicit

Rust chose a different path: make async explicit in the type system.

```rust
// This is a synchronous function (blocks the thread)
fn read_sync(stream: &mut TcpStream) -> Vec<u8> { ... }

// This is an async function (yields the task, doesn't block the thread)
async fn read_async(stream: &mut TcpStream) -> Vec<u8> { ... }
```

Advantages of Rust's approach:
- **No runtime overhead:** If you don't use async, you pay zero cost.
- **Choose your runtime:** tokio, async-std, smol, or your own.
- **No hidden allocations:** You see exactly where tasks are created.
- **Compile-time verification:** The borrow checker ensures safety across
  await points.

Disadvantages:
- **More complex:** You must think about async vs sync, pinning, Send bounds.
- **Colored functions:** Async functions can only be called from async
  contexts (or with `block_on`).
- **Ecosystem split:** Some libraries are sync-only, some async-only.

---

## Comparison Table

```
+-------------------+-------------+-------------+------------------+
|                   | Blocking    | epoll +     | io_uring         |
|                   | (thread/    | event loop  |                  |
|                   |  conn)      | (tokio)     |                  |
+-------------------+-------------+-------------+------------------+
| Threads needed    | 1 per conn  | Few (cores) | Few (cores)      |
| Memory per conn   | ~4 MB       | ~few KB     | ~few KB          |
| Max connections   | ~2,000      | 100,000+    | 100,000+         |
| System calls      | 1 per I/O   | 1 per batch | Batched, fewer   |
| Disk I/O support  | Yes         | No (epoll)  | Yes              |
| Code complexity   | Simple      | Moderate    | Complex          |
| Maturity          | Decades     | Mature      | Maturing         |
+-------------------+-------------+-------------+------------------+
```

---

## Seeing It In Action: Blocking vs Async

Here is a concrete comparison. Both servers handle connections, but watch
what happens under load.

### Blocking Server (1 thread per connection)

```rust
use std::io::{Read, Write};
use std::net::TcpListener;
use std::thread;
use std::time::Duration;

fn main() {
    let listener = TcpListener::bind("127.0.0.1:7878").unwrap();

    for stream in listener.incoming() {
        let mut stream = stream.unwrap();
        thread::spawn(move || {
            thread::sleep(Duration::from_secs(1)); // simulate work
            let mut buf = [0u8; 1024];
            let n = stream.read(&mut buf).unwrap_or(0);
            stream.write_all(&buf[..n]).ok();
        });
    }
}
```

### Async Server (all connections on a few threads)

```rust
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("127.0.0.1:7878").await.unwrap();

    loop {
        let (mut stream, _) = listener.accept().await.unwrap();
        tokio::spawn(async move {
            sleep(Duration::from_secs(1)).await; // simulate work (non-blocking!)
            let mut buf = [0u8; 1024];
            let n = stream.read(&mut buf).await.unwrap_or(0);
            stream.write_all(&buf[..n]).await.ok();
        });
    }
}
```

The critical difference: `thread::sleep(1s)` blocks the OS thread.
`tokio::time::sleep(1s).await` yields the task so other tasks can run on
the same thread.

With 1,000 concurrent connections each sleeping 1 second:
- Blocking: needs 1,000 threads, each sleeping
- Async: needs ~4 threads, 1,000 tasks scheduled across them

---

## Exercises

1. **Measure thread count.** Run the blocking server from Lesson 13 (v2).
   Connect 50 clients simultaneously (write a Rust program that opens 50
   TCP connections). While they are connected, check the thread count:
   `ps -M <pid> | wc -l` on macOS or `ls /proc/<pid>/task | wc -l` on
   Linux.

2. **Measure with async.** Do the same with the async server (v3). Compare
   the thread counts.

3. **Throughput benchmark.** Write a load generator that opens N connections,
   sends one message per connection, and measures total time. Run it with
   N = 10, 100, 1000, 5000 against both the threaded and async servers.
   At what N does the threaded server start failing or slowing down?

4. **Raw epoll (advanced).** On Linux, use the `nix` or `mio` crate to write
   a simple event loop that monitors two TCP connections using epoll. When
   data arrives on either connection, print it. This is what tokio does
   internally.

5. **Simulate slow clients.** Modify the async server to add a 100ms delay
   before echoing. Connect 1000 clients that each send 10 messages.
   Measure total throughput. Then try the same with the threaded server.
   The async version should be dramatically better.

---

Next: [Lesson 16: Serialization Formats](./16-serialization.md)
