# Lesson 09: Concurrency Patterns

## Building Blocks into Architecture

You know goroutines and channels. Now let's compose them into
real patterns used in production Go code — the same patterns
powering Kubernetes controllers and Docker networking.

---

## Pipeline Pattern

A pipeline is a series of stages connected by channels. Like an
assembly line: each station does one job and passes work forward.

```
+----------+     +----------+     +----------+
| Generate |---->| Square   |---->| Print    |
| numbers  | ch1 | them     | ch2 | results  |
+----------+     +----------+     +----------+
```

```go
package main

import "fmt"

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
    nums := generate(2, 3, 4, 5)
    squares := square(nums)

    for result := range squares {
        fmt.Println(result)
    }
}
```

Each stage owns its output channel and closes it when done.
Stages can be composed freely.

---

## Fan-Out / Fan-In

Fan-out: multiple goroutines read from the same channel.
Fan-in: multiple channels merge into one.

Think of it like a post office: one bin of unsorted mail (fan-out
to workers), multiple workers sorting simultaneously, results
collected into one output bin (fan-in).

```
                Fan-Out                    Fan-In

   +--------+   +----------+     +----------+   +--------+
   |        |-->| Worker 1 |---->|          |   |        |
   | Source |-->| Worker 2 |---->|  Merge   |-->| Output |
   |        |-->| Worker 3 |---->|          |   |        |
   +--------+   +----------+     +----------+   +--------+
```

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

func producer(items []string) <-chan string {
    out := make(chan string)
    go func() {
        for _, item := range items {
            out <- item
        }
        close(out)
    }()
    return out
}

func worker(id int, jobs <-chan string) <-chan string {
    out := make(chan string)
    go func() {
        for job := range jobs {
            time.Sleep(50 * time.Millisecond)
            out <- fmt.Sprintf("worker %d processed %s", id, job)
        }
        close(out)
    }()
    return out
}

func merge(channels ...<-chan string) <-chan string {
    out := make(chan string)
    var wg sync.WaitGroup

    for _, ch := range channels {
        wg.Add(1)
        go func(c <-chan string) {
            defer wg.Done()
            for val := range c {
                out <- val
            }
        }(ch)
    }

    go func() {
        wg.Wait()
        close(out)
    }()

    return out
}

func main() {
    jobs := producer([]string{"A", "B", "C", "D", "E", "F"})

    w1 := worker(1, jobs)
    w2 := worker(2, jobs)
    w3 := worker(3, jobs)

    for result := range merge(w1, w2, w3) {
        fmt.Println(result)
    }
}
```

---

## Worker Pool

A bounded set of workers pulling from a shared job queue.
This limits concurrency — essential for resource-constrained
operations like database connections or API calls.

```
                    Job Queue (buffered channel)
                    +---+---+---+---+---+
                    | J | J | J | J | J |
                    +-+-+-+-+-+-+-+-+-+-+
                      |   |       |
              +-------+   |       +-------+
              v           v               v
         +--------+  +--------+      +--------+
         |Worker 1|  |Worker 2| ...  |Worker N|
         +---+----+  +---+----+      +---+----+
             |            |               |
             v            v               v
                  Results Channel
```

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type Job struct {
    ID   int
    Data string
}

type Result struct {
    JobID  int
    Output string
}

func workerPool(numWorkers int, jobs <-chan Job) <-chan Result {
    results := make(chan Result)
    var wg sync.WaitGroup

    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func(workerID int) {
            defer wg.Done()
            for job := range jobs {
                time.Sleep(100 * time.Millisecond)
                results <- Result{
                    JobID:  job.ID,
                    Output: fmt.Sprintf("worker %d handled: %s", workerID, job.Data),
                }
            }
        }(i)
    }

    go func() {
        wg.Wait()
        close(results)
    }()

    return results
}

func main() {
    jobs := make(chan Job, 10)
    go func() {
        for i := 0; i < 20; i++ {
            jobs <- Job{ID: i, Data: fmt.Sprintf("task-%d", i)}
        }
        close(jobs)
    }()

    for result := range workerPool(3, jobs) {
        fmt.Println(result.Output)
    }
}
```

---

## Context Cancellation

`context.Context` propagates cancellation signals through your
call chain. When a user disconnects or a timeout fires, all
downstream work stops.

```
HTTP Request arrives
       |
   context.WithTimeout(5s)
       |
       +---> Database query (checks ctx)
       |
       +---> External API call (checks ctx)
       |
       +---> File processing (checks ctx)
       |
   Timeout fires --> ALL cancel simultaneously
```

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func slowOperation(ctx context.Context, name string) error {
    select {
    case <-time.After(2 * time.Second):
        fmt.Println(name, "completed")
        return nil
    case <-ctx.Done():
        fmt.Println(name, "cancelled:", ctx.Err())
        return ctx.Err()
    }
}

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
    defer cancel()

    go slowOperation(ctx, "op-1")
    go slowOperation(ctx, "op-2")

    <-ctx.Done()
    fmt.Println("Main:", ctx.Err())
    time.Sleep(100 * time.Millisecond)
}
```

Always `defer cancel()` to release resources. Always check
`ctx.Done()` in long-running goroutines.

---

## Semaphore Pattern

Limit concurrent access to a resource using a buffered channel:

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type Semaphore chan struct{}

func NewSemaphore(max int) Semaphore {
    return make(Semaphore, max)
}

func (s Semaphore) Acquire() { s <- struct{}{} }
func (s Semaphore) Release() { <-s }

func main() {
    sem := NewSemaphore(3)
    var wg sync.WaitGroup

    for i := 0; i < 10; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            sem.Acquire()
            defer sem.Release()

            fmt.Printf("Worker %d: running\n", id)
            time.Sleep(500 * time.Millisecond)
            fmt.Printf("Worker %d: done\n", id)
        }(i)
    }

    wg.Wait()
}
```

The buffered channel acts as a token bucket. Only 3 goroutines
can hold a token at once.

---

## Error Group

`errgroup` from `golang.org/x/sync` runs goroutines and collects
the first error:

```go
package main

import (
    "context"
    "errors"
    "fmt"
    "time"

    "golang.org/x/sync/errgroup"
)

func fetchUser(ctx context.Context) (string, error) {
    time.Sleep(100 * time.Millisecond)
    return "Alice", nil
}

func fetchOrders(ctx context.Context) (int, error) {
    time.Sleep(200 * time.Millisecond)
    return 0, errors.New("orders service down")
}

func main() {
    ctx := context.Background()
    g, ctx := errgroup.WithContext(ctx)

    var user string
    g.Go(func() error {
        var err error
        user, err = fetchUser(ctx)
        return err
    })

    var orderCount int
    g.Go(func() error {
        var err error
        orderCount, err = fetchOrders(ctx)
        return err
    })

    if err := g.Wait(); err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println(user, orderCount)
}
```

When any goroutine fails, the context cancels, stopping the others.

---

## Pattern Summary

```
+-------------------+---------------------------+
| Pattern           | Use When                  |
+-------------------+---------------------------+
| Pipeline          | Sequential processing     |
|                   | stages                    |
+-------------------+---------------------------+
| Fan-out/Fan-in    | Parallelize CPU or I/O    |
|                   | bound work                |
+-------------------+---------------------------+
| Worker Pool       | Bounded concurrency       |
|                   | (DB, API rate limits)     |
+-------------------+---------------------------+
| Semaphore         | Limiting concurrent       |
|                   | access to resources       |
+-------------------+---------------------------+
| Context cancel    | Timeouts, user disconnect |
|                   | graceful shutdown         |
+-------------------+---------------------------+
| Error Group       | Multiple concurrent tasks |
|                   | where any failure = abort |
+-------------------+---------------------------+
```

---

## Exercises

1. Build a 3-stage pipeline: generate integers, filter evens,
   square them. Print the final output

2. Implement a worker pool with 5 workers that processes 50 jobs.
   Each job is a string to uppercase. Collect results

3. Write a program using `context.WithTimeout` that launches 3
   API calls (simulated) and cancels if any takes > 1 second

4. Implement fan-out/fan-in: one producer, 4 workers, merge
   results. Count total items processed

5. Build a rate limiter using a ticker and a semaphore that
   allows at most 5 operations per second

---

[Next: Lesson 10 - Packages & Modules ->](10-packages-modules.md)
