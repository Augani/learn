# Lesson 08: Channels

## Conveyor Belts Between Goroutines

Channels are typed conduits for passing data between goroutines.
Think of a conveyor belt in a factory: one worker puts items on,
another takes them off. The belt synchronizes their work.

```
Goroutine A                          Goroutine B
+-----------+     channel (belt)     +-----------+
|           | --> [===item===] -->   |           |
| Producer  |                        | Consumer  |
+-----------+                        +-----------+
```

Go proverb: "Don't communicate by sharing memory; share memory by
communicating." Channels ARE the communication.

In Rust, you'd use `std::sync::mpsc` or `tokio::sync::mpsc`.
Go channels are built into the language itself.

---

## Channel Basics

```go
package main

import "fmt"

func main() {
    ch := make(chan string)

    go func() {
        ch <- "hello from goroutine"
    }()

    msg := <-ch
    fmt.Println(msg)
}
```

```
ch := make(chan T)     -- create a channel of type T
ch <- value            -- send value into channel
value := <-ch          -- receive value from channel
close(ch)              -- close the channel
```

Sends and receives on an unbuffered channel block until both
sides are ready. This is the synchronization.

---

## Unbuffered vs Buffered

```
Unbuffered (make(chan T)):
+---------+          +---------+
| Sender  |--block-->| waiting |
| ready   |          | for     |
|         |<--data-->| receiver|
+---------+          +---------+
Both must be ready. Like a hand-off.

Buffered (make(chan T, 3)):
+---------+   +---+---+---+   +---------+
| Sender  |-->| _ | _ | _ |-->| Receiver|
+---------+   +---+---+---+   +---------+
Sender blocks only when buffer is FULL.
Receiver blocks only when buffer is EMPTY.
Like a conveyor belt with 3 slots.
```

```go
package main

import "fmt"

func main() {
    unbuffered := make(chan int)
    go func() {
        unbuffered <- 42
    }()
    fmt.Println(<-unbuffered)

    buffered := make(chan int, 3)
    buffered <- 1
    buffered <- 2
    buffered <- 3
    fmt.Println(<-buffered)
    fmt.Println(<-buffered)
    fmt.Println(<-buffered)
}
```

Buffered channels decouple sender and receiver timing. Use them
when the producer is bursty or faster than the consumer.

---

## Channel Direction

Functions can declare whether they send or receive:

```go
package main

import "fmt"

func producer(out chan<- int) {
    for i := 0; i < 5; i++ {
        out <- i
    }
    close(out)
}

func consumer(in <-chan int) {
    for val := range in {
        fmt.Println("Received:", val)
    }
}

func main() {
    ch := make(chan int)
    go producer(ch)
    consumer(ch)
}
```

```
chan<- T   -- send-only channel
<-chan T   -- receive-only channel
chan T     -- bidirectional
```

Direction constraints catch bugs at compile time. The producer
can't accidentally read, and the consumer can't accidentally write.

---

## Ranging Over Channels

`range` on a channel reads until the channel is closed:

```go
package main

import "fmt"

func fibonacci(n int, ch chan<- int) {
    a, b := 0, 1
    for i := 0; i < n; i++ {
        ch <- a
        a, b = b, a+b
    }
    close(ch)
}

func main() {
    ch := make(chan int)
    go fibonacci(10, ch)

    for num := range ch {
        fmt.Println(num)
    }
}
```

Always close channels from the sender side. Never close from the
receiver. Sending to a closed channel panics.

```
+----------------------------------+
| Channel Rules                    |
+----------------------------------+
| Close from sender, not receiver  |
| Send to closed channel = PANIC   |
| Receive from closed = zero value |
| Range stops when channel closes  |
| Close is NOT required (GC works) |
+----------------------------------+
```

---

## Select: Multiplexing Channels

`select` lets you wait on multiple channels simultaneously. It's
like standing at a fork in multiple conveyor belts — you grab
whichever item arrives first.

```go
package main

import (
    "fmt"
    "time"
)

func main() {
    ch1 := make(chan string)
    ch2 := make(chan string)

    go func() {
        time.Sleep(100 * time.Millisecond)
        ch1 <- "from channel 1"
    }()

    go func() {
        time.Sleep(200 * time.Millisecond)
        ch2 <- "from channel 2"
    }()

    for i := 0; i < 2; i++ {
        select {
        case msg := <-ch1:
            fmt.Println(msg)
        case msg := <-ch2:
            fmt.Println(msg)
        }
    }
}
```

### Select with Timeout

```go
package main

import (
    "fmt"
    "time"
)

func main() {
    ch := make(chan string)

    go func() {
        time.Sleep(2 * time.Second)
        ch <- "result"
    }()

    select {
    case msg := <-ch:
        fmt.Println("Got:", msg)
    case <-time.After(500 * time.Millisecond):
        fmt.Println("Timed out!")
    }
}
```

### Non-blocking Select with Default

```go
package main

import "fmt"

func main() {
    ch := make(chan int, 1)

    select {
    case val := <-ch:
        fmt.Println("Got:", val)
    default:
        fmt.Println("Channel empty, moving on")
    }
}
```

---

## Done Channel Pattern

A common pattern for signaling goroutines to stop:

```go
package main

import (
    "fmt"
    "time"
)

func worker(done <-chan struct{}) {
    for {
        select {
        case <-done:
            fmt.Println("Worker stopping")
            return
        default:
            fmt.Println("Working...")
            time.Sleep(200 * time.Millisecond)
        }
    }
}

func main() {
    done := make(chan struct{})

    go worker(done)

    time.Sleep(1 * time.Second)
    close(done)
    time.Sleep(100 * time.Millisecond)
}
```

`struct{}` takes zero bytes. Closing the channel signals ALL
listeners simultaneously — it's a broadcast.

---

## Channel of Channels

Channels can carry channels. This enables request/response patterns:

```go
package main

import "fmt"

type Request struct {
    Query    string
    Response chan<- string
}

func server(requests <-chan Request) {
    for req := range requests {
        req.Response <- "Result for: " + req.Query
    }
}

func main() {
    requests := make(chan Request)
    go server(requests)

    response := make(chan string)
    requests <- Request{Query: "find users", Response: response}
    fmt.Println(<-response)

    close(requests)
}
```

---

## Common Mistakes

```
+------------------------------------------+
| Mistake              | Fix               |
+------------------------------------------+
| Goroutine leak       | Use done channel  |
| (blocked forever)    | or context        |
+------------------------------------------+
| Send on closed chan  | Only sender closes |
| (panic!)             |                   |
+------------------------------------------+
| Deadlock: all        | Ensure someone    |
| goroutines asleep    | can send/receive  |
+------------------------------------------+
| Forgetting close()  | Range will block   |
| with range           | forever            |
+------------------------------------------+
| Buffer size = fix    | Buffers smooth     |
| for slow consumers   | bursts, not speed  |
+------------------------------------------+
```

---

## When to Use What

```
+------------------+----------------------------+
| Use channels     | When passing ownership of  |
|                  | data between goroutines    |
+------------------+----------------------------+
| Use mutexes      | When protecting shared     |
|                  | state accessed by multiple |
|                  | goroutines                 |
+------------------+----------------------------+
| Use WaitGroups   | When waiting for a group   |
|                  | of goroutines to finish    |
+------------------+----------------------------+
| Use atomic ops   | For simple counters and    |
|                  | flags (sync/atomic)        |
+------------------+----------------------------+
```

---

## Exercises

1. Create a ping-pong between two goroutines using channels.
   Each sends a count back and forth, stopping at 10

2. Write a function that merges two channels into one: values from
   either input appear on the output

3. Implement a timeout wrapper: `withTimeout(fn func() string,
   d time.Duration) (string, error)` that runs `fn` in a goroutine
   and returns an error if it takes too long

4. Build a simple job queue: one goroutine sends jobs (strings)
   into a buffered channel, three worker goroutines process them

5. Use `select` with three channels and a quit channel. Print
   which channel fires first on each iteration

---

[Next: Lesson 09 - Concurrency Patterns ->](09-concurrency-patterns.md)
