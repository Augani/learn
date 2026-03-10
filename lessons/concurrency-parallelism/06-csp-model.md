# 06 - CSP Model

## The Analogy

Imagine a classroom where students can only communicate by **passing notes**.

No shouting across the room (shared memory). No raising hands and waiting
for the teacher (locks). Just fold a note, pass it to your neighbor, and
they read it when they're ready.

If your neighbor isn't ready to receive, you wait with your arm extended.
If you're waiting for a note and nobody's sending, you sit quietly.

This is **Communicating Sequential Processes** (CSP).

```
  SHARED MEMORY                     CSP (MESSAGE PASSING)

  Thread A                          Process A
  Thread B  --> [shared variable]   Process B
  Thread C      (need locks!)       Process C
                                         |       |       |
                                    [channel] [channel] [channel]
                                         |       |       |
                                    Process D  Process E  Process F

  "Don't communicate by             "Communicate by sharing
   sharing memory"                    ... wait, that's backwards"

  Go proverb: "Do not communicate by sharing memory;
               instead, share memory by communicating."
```

## CSP: The Theory

Tony Hoare published CSP in 1978. The key ideas:

1. **Processes** are independent, sequential units of execution
2. **Channels** are the only way processes communicate
3. **Synchronization** happens at the channel operation (send/receive)
4. No shared state between processes

```
  CSP Process Algebra (simplified)
  =================================

  P = (send!v -> P')       Process P sends value v, then becomes P'
  Q = (recv?x -> Q')       Process Q receives into x, then becomes Q'

  P || Q                   P and Q run in parallel
                           They synchronize on matching send/recv

  When P does send!v and Q does recv?x:
    - Both block until the other is ready
    - v is transferred to x atomically
    - Both proceed to P' and Q'
```

## Channels

The core primitive. A typed conduit between processes.

```
  UNBUFFERED CHANNEL (synchronous)
  ================================

  Sender                Channel              Receiver
  ------                -------              --------
  send(42)  ---------> |      | <---------  recv()
  BLOCKS               |  42  |             BLOCKS
  until recv           |      |             until send
  ...matched!          |      |             ...matched!
  continues            | done |             got 42, continues

  Both sides must be ready. This is a RENDEZVOUS.

  BUFFERED CHANNEL (asynchronous, up to capacity)
  ================================================

  Sender               Channel [cap=3]       Receiver
  ------               ----------------      --------
  send(1) ----------> | 1 |   |   |
  send(2) ----------> | 1 | 2 |   |
  send(3) ----------> | 1 | 2 | 3 |
  send(4) ----------> BLOCKS (full!)         recv() -> 1
                      | 2 | 3 | 4 |         recv() -> 2
  continues           | 3 | 4 |   |
```

### Go: Channels Are First-Class

```go
func producer(ch chan<- int) {
    for i := 0; i < 10; i++ {
        ch <- i
    }
    close(ch)
}

func consumer(ch <-chan int, done chan<- bool) {
    for val := range ch {
        fmt.Printf("Got: %d\n", val)
    }
    done <- true
}

func main() {
    ch := make(chan int, 5)
    done := make(chan bool)

    go producer(ch)
    go consumer(ch, done)

    <-done
}
```

Go channels have directional types (`chan<-` send-only, `<-chan` recv-only).
This is enforced at compile time. See: **Go Track** for channel patterns.

### Rust: Channels via std::sync::mpsc

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    let producer = thread::spawn(move || {
        for i in 0..10 {
            tx.send(i).unwrap();
        }
    });

    let consumer = thread::spawn(move || {
        for val in rx {
            println!("Got: {}", val);
        }
    });

    producer.join().unwrap();
    consumer.join().unwrap();
}
```

Rust's `mpsc` = Multiple Producer, Single Consumer. For multi-consumer,
use `crossbeam::channel` or `tokio::sync::mpsc`.

### Python: queue.Queue and multiprocessing.Queue

```python
import multiprocessing as mp

def producer(q):
    for i in range(10):
        q.put(i)
    q.put(None)

def consumer(q):
    while True:
        val = q.get()
        if val is None:
            break
        print(f"Got: {val}")

if __name__ == "__main__":
    q = mp.Queue(maxsize=5)
    p = mp.Process(target=producer, args=(q,))
    c = mp.Process(target=consumer, args=(q,))

    p.start()
    c.start()
    p.join()
    c.join()
```

Python's `multiprocessing.Queue` gives true CSP-style isolation
because processes don't share memory.

## Channel Patterns

### Fan-Out: One sender, many receivers

```
                  +-> Worker 1 -> results
  Producer --ch--+-> Worker 2 -> results
                  +-> Worker 3 -> results

  Multiple goroutines reading from the same channel.
  Go distributes values round-robin.
```

```go
func fanOut() {
    jobs := make(chan int, 100)
    results := make(chan int, 100)

    for w := 0; w < 3; w++ {
        go worker(w, jobs, results)
    }

    for j := 0; j < 9; j++ {
        jobs <- j
    }
    close(jobs)

    for r := 0; r < 9; r++ {
        fmt.Println(<-results)
    }
}

func worker(id int, jobs <-chan int, results chan<- int) {
    for j := range jobs {
        results <- j * j
    }
}
```

### Fan-In: Many senders, one receiver

```
  Source 1 --+
  Source 2 --+--> merged channel --> Consumer
  Source 3 --+
```

```go
func fanIn(channels ...<-chan string) <-chan string {
    merged := make(chan string)
    var wg sync.WaitGroup

    for _, ch := range channels {
        wg.Add(1)
        go func(c <-chan string) {
            defer wg.Done()
            for val := range c {
                merged <- val
            }
        }(ch)
    }

    go func() {
        wg.Wait()
        close(merged)
    }()

    return merged
}
```

### Pipeline: Stages connected by channels

```
  [Generate] --ch1--> [Square] --ch2--> [Print]

  Each stage: reads from input channel, processes, writes to output channel
```

```go
func generate(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums {
            out <- n
        }
        close(out)
    }()
    return out
}

func square(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- n * n
        }
        close(out)
    }()
    return out
}

func main() {
    ch := generate(2, 3, 4, 5)
    out := square(ch)

    for v := range out {
        fmt.Println(v)
    }
}
```

### Select: Non-deterministic choice

```
  select waits on multiple channels simultaneously.
  Whichever is ready first wins.

  select {           +-- ch1 ready? --> handle ch1
  case <-ch1:        |
  case <-ch2:   -----+-- ch2 ready? --> handle ch2
  case <-time:       |
  }                  +-- timeout?   --> handle timeout
```

```go
func main() {
    ch1 := make(chan string)
    ch2 := make(chan string)

    go func() { time.Sleep(1 * time.Second); ch1 <- "one" }()
    go func() { time.Sleep(2 * time.Second); ch2 <- "two" }()

    for i := 0; i < 2; i++ {
        select {
        case msg := <-ch1:
            fmt.Println("From ch1:", msg)
        case msg := <-ch2:
            fmt.Println("From ch2:", msg)
        case <-time.After(3 * time.Second):
            fmt.Println("Timeout")
        }
    }
}
```

## CSP vs Shared Memory

```
  +-------------------+------------------+-------------------+
  |                   | CSP              | Shared Memory     |
  +-------------------+------------------+-------------------+
  | Communication     | Channels         | Shared variables  |
  | Synchronization   | Channel ops      | Locks/atomics     |
  | Data races        | Impossible*      | Possible          |
  | Deadlocks         | Possible         | Possible          |
  | Composability     | High             | Low               |
  | Debugging         | Trace messages   | Trace memory      |
  | Performance       | Copy overhead    | No copy           |
  +-------------------+------------------+-------------------+

  * If you truly share nothing. Go lets you send pointers over
    channels, which reintroduces shared memory risks.
```

## When CSP Shines

1. **Pipeline processing**: data flows through stages
2. **Fan-out/fan-in**: distribute work, collect results
3. **Event-driven systems**: react to messages from multiple sources
4. **Microservices** (at a larger scale): services communicate via messages

## Exercises

1. **Build**: Implement a pipeline with 3 stages: generate numbers,
   filter evens, square them. Use channels to connect stages.

2. **Pattern**: Implement a "first response wins" pattern: send the
   same request to 3 redundant services, return the first response.

3. **Design**: You're building a log aggregation system. Multiple
   services produce logs, one service stores them. Design it with
   channels. Handle backpressure (what if the store is slow?).

4. **Compare**: Rewrite lesson 03's producer-consumer using channels
   instead of mutexes + condition variables. Which is clearer?

---

**Next** -> [07 - Actor Model](07-actor-model.md)
