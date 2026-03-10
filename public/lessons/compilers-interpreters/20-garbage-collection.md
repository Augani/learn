# Lesson 20: Garbage Collection — How Memory Gets Reclaimed

## The Problem: Who Cleans Up?

Every time your program creates an object, it allocates heap memory. That memory is finite.
If you allocate and never free, you eventually run out — a memory leak.

So somebody has to free memory when it's no longer needed. Who?

```
Strategy              Who frees it?           Languages
──────────────────    ──────────────────      ─────────────────────
Manual                You (the programmer)    C, C++
Reference counting    The runtime (counter)   Python, Swift
Tracing GC            The runtime (tracer)    Go, Java, JavaScript
Ownership             The compiler (rules)    Rust
```

---

## Manual Memory Management (C)

In C, you explicitly allocate and free:

```c
char *name = malloc(64);
strcpy(name, "Augustus");
free(name);
```

The bugs are legendary: **use-after-free** (accessing freed memory), **double free**
(freeing twice corrupts the allocator), **memory leak** (forgetting to free), **dangling
pointer** (returning a pointer to stack memory). These are security vulnerabilities.

Like renting storage units — the company gives you a unit (malloc), you return the key
(free). They don't check whether someone else has a copy of your key.

---

## Reference Counting

Each object tracks how many references point to it. Count drops to zero? Free immediately.

```
a = new Object()    // refcount: 1
b = a               // refcount: 2
a = nil             // refcount: 1
b = nil             // refcount: 0 → FREE
```

Simple and deterministic, but has a fatal flaw — **cycles**:

```
a = new Object()    // a.refcount = 1
b = new Object()    // b.refcount = 1
a.friend = b        // b.refcount = 2
b.friend = a        // a.refcount = 2
a = nil             // a.refcount = 1 (b still references a)
b = nil             // b.refcount = 1 (a still references b)
// Both have refcount 1 but NEITHER is reachable. Leaked forever.
```

Like two people each holding the other's house key. Neither can be evicted, but nobody
outside can reach either of them. Python adds a cycle detector. Swift uses `weak` references.

---

## Tracing GC: Mark-and-Sweep

Instead of counting references, tracing GC periodically finds all **reachable** objects
and frees everything else. An object is alive if you can reach it from **roots** — stack
variables, globals, CPU registers.

### The Office Janitor Analogy

The night janitor (GC) works like this:

1. **Mark phase**: Start at the front desk (roots). Visit each referenced desk. Each desk
   may reference others — visit those too. Put a "KEEP" sticker on every desk you reach.

2. **Sweep phase**: Walk through every desk in the building. No "KEEP" sticker? Clear it.

3. Remove all stickers (reset for next cycle).

```
Roots: [ref→A] [ref→B]

Objects:  A ──→ C ──→ D     E ──→ F     G     H
          B ──→ C

Mark from roots: A✓  B✓  C✓  D✓
Not reached:     E✗  F✗  G✗  H✗  → all swept (freed)
```

E and F have a reference between them, but neither is reachable from any root. Unlike
reference counting, tracing GC handles cycles naturally.

---

## Implementing Mark-and-Sweep for Our VM

Let's build a GC for the VM from lesson 18.

### Object Representation

Every GC-managed object has a header with a mark flag and a link to form an intrusive list:

```go
type ObjectType byte

const (
    ObjString ObjectType = iota
    ObjArray
    ObjClosure
)

type Object struct {
    Type   ObjectType
    Marked bool
    Next   *Object
    Value  interface{}
}

type ObjString struct{ Chars string }
type ObjArray struct{ Elements []*Object }
type ObjClosure struct {
    Function *Function
    Upvalues []*Object
}
```

### The GC Structure

```go
type GC struct {
    allObjects  *Object
    objectCount int
    threshold   int
    vm          *VM
}

func NewGC(vm *VM) *GC {
    return &GC{
        allObjects:  nil,
        objectCount: 0,
        threshold:   256,
        vm:          vm,
    }
}
```

The `threshold` controls when GC runs. After collection, we set it to twice the surviving
count — adaptive pacing.

### Allocation

```go
func (gc *GC) Allocate(objType ObjectType, value interface{}) *Object {
    if gc.objectCount >= gc.threshold {
        gc.Collect()
    }

    obj := &Object{
        Type:   objType,
        Marked: false,
        Next:   gc.allObjects,
        Value:  value,
    }
    gc.allObjects = obj
    gc.objectCount++
    return obj
}
```

New objects prepend to the list (O(1)). `Marked` starts false — if GC runs before anything
references this object, it gets swept.

### Finding Roots

Roots are everything the VM can directly reach: the value stack and global variables.

```go
func (gc *GC) markRoots() {
    for i := 0; i < gc.vm.stackTop; i++ {
        gc.markValue(gc.vm.stack[i])
    }
    for _, value := range gc.vm.globals {
        gc.markValue(value)
    }
    for _, frame := range gc.vm.frames[:gc.vm.frameCount] {
        if frame.closure != nil {
            gc.markObject(frame.closure)
        }
    }
}
```

Missing a root means the GC might free a live object — a catastrophic use-after-free bug.

### The Mark Phase

```go
func (gc *GC) markValue(value Value) {
    if value.IsObject() {
        gc.markObject(value.AsObject())
    }
}

func (gc *GC) markObject(obj *Object) {
    if obj == nil || obj.Marked {
        return
    }

    obj.Marked = true

    switch obj.Type {
    case ObjArray:
        for _, elem := range obj.Value.(*ObjArray).Elements {
            gc.markObject(elem)
        }
    case ObjClosure:
        for _, upval := range obj.Value.(*ObjClosure).Upvalues {
            gc.markObject(upval)
        }
    case ObjString:
        // strings don't reference other objects
    }
}
```

The `if obj.Marked { return }` prevents infinite loops on cycles. Object A references B, B
references A — without this check we'd bounce forever.

For deep reference chains, production GCs use an explicit worklist instead of recursion to
avoid stack overflow:

```go
func (gc *GC) markObjectIterative(root *Object) {
    if root == nil || root.Marked {
        return
    }
    worklist := []*Object{root}
    root.Marked = true

    for len(worklist) > 0 {
        current := worklist[len(worklist)-1]
        worklist = worklist[:len(worklist)-1]

        for _, ref := range gc.getReferences(current) {
            if ref != nil && !ref.Marked {
                ref.Marked = true
                worklist = append(worklist, ref)
            }
        }
    }
}
```

### The Sweep Phase

Walk the object list. Free unmarked objects. Reset marks on survivors.

```go
func (gc *GC) sweep() {
    var previous *Object
    current := gc.allObjects

    for current != nil {
        if current.Marked {
            current.Marked = false
            previous = current
            current = current.Next
        } else {
            unreached := current
            current = current.Next
            if previous != nil {
                previous.Next = current
            } else {
                gc.allObjects = current
            }
            unreached.Value = nil
            gc.objectCount--
        }
    }
}
```

This is a "remove while iterating" linked list pattern. The `previous` pointer lets us
stitch the list back together when removing a node.

### Full Collection Cycle

```go
func (gc *GC) Collect() int {
    before := gc.objectCount
    gc.markRoots()
    gc.sweep()
    gc.threshold = gc.objectCount * 2
    if gc.threshold < 256 {
        gc.threshold = 256
    }
    return before - gc.objectCount
}
```

### Testing

```go
func TestGCFreesUnreachableObjects(t *testing.T) {
    vm := NewVM()
    gc := NewGC(vm)
    gc.Allocate(ObjString, &ObjString{Chars: "hello"})
    gc.Allocate(ObjString, &ObjString{Chars: "world"})

    freed := gc.Collect()
    if freed != 2 {
        t.Fatalf("expected 2 freed, got %d", freed)
    }
}

func TestGCKeepsReachableObjects(t *testing.T) {
    vm := NewVM()
    gc := NewGC(vm)
    obj := gc.Allocate(ObjString, &ObjString{Chars: "keep me"})
    gc.Allocate(ObjString, &ObjString{Chars: "lose me"})
    vm.Push(Value{obj: obj})

    freed := gc.Collect()
    if freed != 1 {
        t.Fatalf("expected 1 freed, got %d", freed)
    }
}

func TestGCHandlesCycles(t *testing.T) {
    vm := NewVM()
    gc := NewGC(vm)
    objA := gc.Allocate(ObjArray, &ObjArray{})
    objB := gc.Allocate(ObjArray, &ObjArray{})
    objA.Value.(*ObjArray).Elements = []*Object{objB}
    objB.Value.(*ObjArray).Elements = []*Object{objA}

    freed := gc.Collect()
    if freed != 2 {
        t.Fatalf("expected 2 freed (cycle), got %d", freed)
    }
}
```

The cycle test proves tracing GC handles the case that breaks reference counting.

---

## Generational GC

Most objects die young. Temporary strings, loop variables, request objects — 80-95% become
garbage within milliseconds. **Generational GC** exploits this: check the nursery more often.

```
┌──────────────┐  ┌──────────────┐
│  Young Gen    │  │  Old Gen      │
│  (Nursery)    │  │  (Tenured)    │
│               │  │               │
│  GC: frequent │  │  GC: rare     │
│  (minor GC)   │  │  (major GC)   │
└──────────────┘  └──────────────┘
```

Analogy: checking intern desks (young objects) every week, senior employee desks (old
objects) once a quarter. Interns come and go fast.

**Minor GC**: collect young generation only. Fast, most objects are dead. Survivors get
**promoted** to old generation.

**Major GC**: collect entire heap. Slower but necessary.

**Write barrier problem**: if an old object references a young object, a minor GC would miss
it. Solution: a **write barrier** runs on every pointer write, recording cross-generational
references in a **remembered set**.

V8 and Java's G1 GC are generational.

---

## Go's Garbage Collector

Go's GC is **concurrent, tri-color mark-and-sweep**, optimized for **low latency** (pauses
under 1ms). It's NOT generational.

### Tri-Color Marking

Three colors instead of marked/unmarked:

- **White**: not visited, potentially garbage
- **Gray**: visited, but references not yet scanned
- **Black**: visited and all references scanned

```
1. All objects start white
2. Mark roots gray
3. Pick a gray object → scan its references → mark white refs gray → mark it black
4. Repeat until no gray objects remain
5. All remaining white objects are garbage → sweep
```

Why three colors? It enables **concurrent collection**. While your goroutines run, GC scans
in the background. The invariant: **a black object must never point to a white object**.
If your program stores a white reference in a black object, the **write barrier** catches
it and marks the white object gray.

### Go GC Phases

```
1. Sweep Termination     STW (brief). Find roots.
2. Mark Phase            CONCURRENT. Background goroutines trace heap.
3. Mark Termination      STW (brief). Drain remaining grays.
4. Sweep Phase           CONCURRENT. Reclaim white objects.
```

The two STW (stop-the-world) phases are typically under 500 microseconds.

---

## Tuning Go's GC

### GOGC (GC Percentage)

Controls heap growth before next GC. Default 100 = GC when heap doubles.

```
GOGC=100:  100MB live → next GC at 200MB
GOGC=50:   100MB live → next GC at 150MB (more frequent, less memory)
GOGC=200:  100MB live → next GC at 300MB (less frequent, more memory)
```

### GOMEMLIMIT (Memory Limit)

Sets a soft memory cap (Go 1.19+). More intuitive: "stay under Y bytes."

```bash
GOMEMLIMIT=1GiB ./myserver
```

### Observing GC

```bash
GODEBUG=gctrace=1 ./myserver
```

Prints per-cycle stats: heap sizes, pause times, CPU percentage.

```go
func printGCStats() {
    var stats debug.GCStats
    debug.ReadGCStats(&stats)
    fmt.Printf("GC cycles: %d\n", stats.NumGC)
    fmt.Printf("Last pause: %v\n", stats.Pause[0])

    var memStats runtime.MemStats
    runtime.ReadMemStats(&memStats)
    fmt.Printf("Heap alloc: %d MB\n", memStats.HeapAlloc/1024/1024)
    fmt.Printf("Next GC at: %d MB\n", memStats.NextGC/1024/1024)
}
```

---

## Rust's Approach: No GC At All

Rust uses **ownership and borrowing** — the compiler inserts `drop()` calls at exactly the
right points. No runtime overhead, no pauses.

```rust
fn process() {
    let name = String::from("Augustus");  // heap allocated
}   // name dropped here → memory freed
```

For shared ownership, Rust has `Rc<T>` (reference counting, single-threaded) and `Arc<T>`
(atomic, multi-threaded). These can leak cycles, so there's `Weak<T>`.

Analogy: Rust makes everyone clean up after themselves (ownership). No janitor needed, but
strict rules about who can use what. More discipline for the cook, but the kitchen runs
faster because nobody waits for cleaning crew.

---

## Comparing Strategies

```
                Manual    RefCount   Mark-Sweep   Generational   Go Tri-Color   Rust
Throughput      Best      Good       Good         Best           Good           Best
Latency         Best      Best       Bad          OK             Best           Best
Handles cycles  N/A       NO         Yes          Yes            Yes            N/A
Pause times     None      None       Long         Medium         <1ms           None
Safety          Low       Medium     High         High           High           Highest
Programmer      HIGH      Low        None         None           None           Medium
effort
```

---

## Exercises

1. **Stress test the GC.** Set threshold to 0 (collect on every allocation). If the program
   still works, your root tracking is correct.

2. **Add GC statistics.** Track total allocated, total freed, number of GC cycles, time in
   mark phase, time in sweep phase, peak heap size.

3. **Implement weak references.** An object type that doesn't keep its target alive. If the
   target is collected, the weak reference becomes nil.

4. **Try Go's GC tuning.** Write a program that allocates in a loop. Run with
   `GODEBUG=gctrace=1` and different GOGC values. Graph GC frequency vs memory usage.

5. **Implement generational collection.** Split the heap into young/old. Promote after two
   collections. Measure performance with mostly short-lived objects.

---

## Key Takeaways

- Memory must be freed eventually, or your program leaks
- Manual management is fast but dangerously error-prone
- Reference counting is simple but can't handle cycles
- Mark-and-sweep finds all reachable objects and frees the rest
- Generational GC exploits the fact that most objects die young
- Go's GC is concurrent, tri-color, optimized for sub-millisecond pauses
- Rust eliminates GC entirely through compile-time ownership rules
- GOGC and GOMEMLIMIT are Go's two primary GC tuning knobs

---

## What's Next

We've built a lexer, parser, interpreter, compiler, VM, optimizer, and garbage collector.
Next: how real-world language implementations (V8, Go, Rust, CPython) put all these pieces
together — and how they go far beyond what we've built.
