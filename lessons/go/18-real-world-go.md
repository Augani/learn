# Lesson 18: Real-World Go

## Patterns from the Giants

Kubernetes, Docker, and Terraform are among the largest Go codebases
in the world. They've battle-tested patterns that you can apply in
your own projects. Let's study what works at scale.

---

## Kubernetes Patterns

### Controller Pattern (Reconciliation Loop)

The core of Kubernetes: observe desired state, observe actual state,
take action to converge them. Like a thermostat — it constantly
checks the temperature and adjusts.

```
+-------------------+
| Desired State     |  (e.g., 3 replicas)
+--------+----------+
         |
         v
+-------------------+
| Reconcile Loop    |  (runs continuously)
|                   |
| actual != desired?|---yes---> Take action
|                   |           (scale up/down)
| actual == desired?|---yes---> Do nothing
+--------+----------+
         |
         v
+-------------------+
| Actual State      |  (e.g., 2 replicas running)
+-------------------+
```

```go
package main

import (
    "context"
    "fmt"
    "time"
)

type DesiredState struct {
    Replicas int
}

type ActualState struct {
    Replicas int
}

type Controller struct {
    desired DesiredState
    actual  ActualState
}

func (c *Controller) Reconcile(ctx context.Context) error {
    if c.actual.Replicas < c.desired.Replicas {
        diff := c.desired.Replicas - c.actual.Replicas
        fmt.Printf("Scaling up: creating %d replicas\n", diff)
        c.actual.Replicas = c.desired.Replicas
    } else if c.actual.Replicas > c.desired.Replicas {
        diff := c.actual.Replicas - c.desired.Replicas
        fmt.Printf("Scaling down: removing %d replicas\n", diff)
        c.actual.Replicas = c.desired.Replicas
    } else {
        fmt.Println("State is reconciled")
    }
    return nil
}

func (c *Controller) Run(ctx context.Context) {
    ticker := time.NewTicker(2 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            fmt.Println("Controller stopping")
            return
        case <-ticker.C:
            if err := c.Reconcile(ctx); err != nil {
                fmt.Printf("Reconcile error: %v\n", err)
            }
        }
    }
}

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    ctrl := &Controller{
        desired: DesiredState{Replicas: 3},
        actual:  ActualState{Replicas: 1},
    }

    ctrl.Run(ctx)
}
```

### Informer/Lister Pattern

Kubernetes uses shared informers to watch resources efficiently.
Instead of polling the API server, informers maintain a local
cache that stays in sync.

```
API Server --watch--> Informer --> Local Cache
                                       |
                          Handler reads from cache
                          (fast, no API calls)
```

### Workqueue Pattern

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

type WorkQueue struct {
    items chan string
    seen  map[string]bool
    mu    sync.Mutex
}

func NewWorkQueue(size int) *WorkQueue {
    return &WorkQueue{
        items: make(chan string, size),
        seen:  make(map[string]bool),
    }
}

func (q *WorkQueue) Add(item string) {
    q.mu.Lock()
    defer q.mu.Unlock()
    if q.seen[item] {
        return
    }
    q.seen[item] = true
    q.items <- item
}

func (q *WorkQueue) Get() (string, bool) {
    item, ok := <-q.items
    return item, ok
}

func (q *WorkQueue) Done(item string) {
    q.mu.Lock()
    defer q.mu.Unlock()
    delete(q.seen, item)
}

func main() {
    queue := NewWorkQueue(100)

    ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
    defer cancel()

    go func() {
        for i := 0; i < 5; i++ {
            queue.Add(fmt.Sprintf("pod-%d", i))
            time.Sleep(200 * time.Millisecond)
        }
        close(queue.items)
    }()

    for {
        select {
        case <-ctx.Done():
            return
        default:
            item, ok := queue.Get()
            if !ok {
                return
            }
            fmt.Println("Processing:", item)
            queue.Done(item)
        }
    }
}
```

---

## Docker Patterns

### Builder Pattern (Options)

Docker uses functional options extensively:

```go
package main

import "fmt"

type Server struct {
    host         string
    port         int
    maxConns     int
    readTimeout  int
    writeTimeout int
}

type Option func(*Server)

func WithPort(port int) Option {
    return func(s *Server) {
        s.port = port
    }
}

func WithMaxConns(max int) Option {
    return func(s *Server) {
        s.maxConns = max
    }
}

func WithTimeouts(read, write int) Option {
    return func(s *Server) {
        s.readTimeout = read
        s.writeTimeout = write
    }
}

func NewServer(host string, opts ...Option) *Server {
    s := &Server{
        host:         host,
        port:         8080,
        maxConns:     100,
        readTimeout:  30,
        writeTimeout: 30,
    }
    for _, opt := range opts {
        opt(s)
    }
    return s
}

func main() {
    s := NewServer("localhost",
        WithPort(9090),
        WithMaxConns(500),
        WithTimeouts(10, 15),
    )
    fmt.Printf("%+v\n", s)
}
```

This pattern gives you:
- Sensible defaults
- Readable configuration
- Easy extensibility (add options without changing signatures)

### Plugin Architecture

Docker's storage, networking, and logging are all pluggable:

```go
package main

import "fmt"

type Driver interface {
    Name() string
    Start() error
    Stop() error
}

type Registry struct {
    drivers map[string]Driver
}

func NewRegistry() *Registry {
    return &Registry{drivers: make(map[string]Driver)}
}

func (r *Registry) Register(d Driver) {
    r.drivers[d.Name()] = d
}

func (r *Registry) Get(name string) (Driver, bool) {
    d, ok := r.drivers[name]
    return d, ok
}

type OverlayDriver struct{}

func (d OverlayDriver) Name() string  { return "overlay2" }
func (d OverlayDriver) Start() error  { fmt.Println("overlay2 started"); return nil }
func (d OverlayDriver) Stop() error   { fmt.Println("overlay2 stopped"); return nil }

type BtrfsDriver struct{}

func (d BtrfsDriver) Name() string  { return "btrfs" }
func (d BtrfsDriver) Start() error  { fmt.Println("btrfs started"); return nil }
func (d BtrfsDriver) Stop() error   { fmt.Println("btrfs stopped"); return nil }

func main() {
    reg := NewRegistry()
    reg.Register(OverlayDriver{})
    reg.Register(BtrfsDriver{})

    driver, ok := reg.Get("overlay2")
    if ok {
        driver.Start()
    }
}
```

---

## Terraform Patterns

### Provider/Resource Pattern

Terraform uses interfaces to define providers (AWS, GCP, Azure)
and resources (instances, databases, networks):

```go
package main

import "fmt"

type ResourceState struct {
    ID         string
    Attributes map[string]string
}

type Resource interface {
    Create() (*ResourceState, error)
    Read(id string) (*ResourceState, error)
    Update(id string, attrs map[string]string) error
    Delete(id string) error
}

type EC2Instance struct {
    Region       string
    InstanceType string
}

func (e *EC2Instance) Create() (*ResourceState, error) {
    fmt.Printf("Creating EC2 %s in %s\n", e.InstanceType, e.Region)
    return &ResourceState{
        ID:         "i-abc123",
        Attributes: map[string]string{"type": e.InstanceType},
    }, nil
}

func (e *EC2Instance) Read(id string) (*ResourceState, error) {
    return &ResourceState{ID: id}, nil
}

func (e *EC2Instance) Update(id string, attrs map[string]string) error {
    fmt.Printf("Updating %s\n", id)
    return nil
}

func (e *EC2Instance) Delete(id string) error {
    fmt.Printf("Deleting %s\n", id)
    return nil
}

func main() {
    resource := &EC2Instance{Region: "us-west-2", InstanceType: "t3.micro"}

    state, err := resource.Create()
    if err != nil {
        fmt.Println(err)
        return
    }
    fmt.Printf("Created: %s\n", state.ID)

    resource.Delete(state.ID)
}
```

### DAG Execution

Terraform builds a dependency graph and executes nodes in parallel
where possible:

```
        +--------+
        | VPC    |
        +---+----+
            |
     +------+------+
     |             |
+----+----+  +----+----+
| Subnet  |  | SecGroup|
+----+----+  +----+----+
     |             |
     +------+------+
            |
       +----+----+
       | Instance|
       +---------+
```

---

## Architecture Patterns Summary

```
+--------------------+------------------------------+
| Pattern            | Where Used                   |
+--------------------+------------------------------+
| Reconciliation     | Kubernetes controllers       |
| loop               | Any state management         |
+--------------------+------------------------------+
| Functional options | Docker, many Go libraries    |
| (WithXxx)          | Server/client configuration  |
+--------------------+------------------------------+
| Plugin registry    | Docker drivers, Terraform    |
|                    | providers                    |
+--------------------+------------------------------+
| Interface-based    | All three: testability +     |
| abstraction        | swappable implementations    |
+--------------------+------------------------------+
| Worker pool +      | Kubernetes scheduler,        |
| work queue         | any batch processing         |
+--------------------+------------------------------+
| DAG execution      | Terraform apply, build       |
|                    | systems                      |
+--------------------+------------------------------+
```

---

## Capstone Project: Build a Task Orchestrator

Combine everything you've learned into one project:

### Requirements

Build `taskrunner` — a CLI tool that reads a task definition file,
resolves dependencies, and executes tasks concurrently.

```yaml
tasks:
  build:
    command: "go build ./..."
    depends_on: []
  test:
    command: "go test ./..."
    depends_on: [build]
  lint:
    command: "golangci-lint run"
    depends_on: [build]
  deploy:
    command: "echo deploying..."
    depends_on: [test, lint]
```

### What to implement

1. **CLI** (cobra): `taskrunner run --file tasks.yaml`
2. **Parser**: Read YAML/JSON task definitions
3. **DAG builder**: Build a dependency graph, detect cycles
4. **Executor**: Run tasks concurrently respecting dependencies
5. **Context**: Cancel all tasks if any fails or timeout
6. **Output**: Structured logging with task status

### Architecture

```
main.go
  |
cmd/
  root.go
  run.go
  |
internal/
  task/
    task.go          -- Task struct, parsing
    dag.go           -- Dependency graph
    executor.go      -- Concurrent execution
    executor_test.go -- Table-driven tests
  output/
    formatter.go     -- Table/JSON output
```

### Key concepts used

- Structs, interfaces, methods (Lessons 4-5)
- Error handling with wrapping (Lesson 6)
- Goroutines and channels (Lessons 7-8)
- Worker pool, context cancellation (Lesson 9)
- Packages and modules (Lesson 10)
- Table-driven tests (Lesson 11)
- Standard library (Lesson 12)
- CLI with cobra (Lesson 14)
- Context propagation (Lesson 16)

---

## What's Next

You now have a solid Go foundation. Here's where to go from here:

```
+----------------------------------------+
| Deepen Your Go Knowledge               |
+----------------------------------------+
| - Read "The Go Programming Language"   |
|   (Donovan & Kernighan)                |
| - Study Go source code on GitHub       |
| - Contribute to open source Go projects|
| - Read the Go blog: go.dev/blog        |
+----------------------------------------+

+----------------------------------------+
| Explore the Ecosystem                  |
+----------------------------------------+
| - gRPC with Go                         |
| - Kubernetes operator development      |
| - WebAssembly with Go                  |
| - Generics patterns (Go 1.18+)        |
+----------------------------------------+
```

---

## Exercises

1. Implement the capstone task orchestrator described above

2. Study the Kubernetes `controller-runtime` repo. Identify the
   reconcile loop pattern in a real controller

3. Read Docker's `moby/moby` container create flow. Trace how
   functional options are used

4. Build a plugin system where drivers register themselves via
   `init()` functions (like database drivers)

5. Create a resource manager that implements Create/Read/Update/
   Delete with a reconciliation loop checking every 5 seconds

---

Congratulations! You've completed the Go track.

[Back to Roadmap](00-roadmap.md)
