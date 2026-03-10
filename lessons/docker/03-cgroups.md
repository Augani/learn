# Lesson 03: Control Groups (cgroups)

---

## The Building Manager Analogy

You live in an apartment building. Without rules, one tenant could run
every faucet at full blast, crank the AC to arctic levels, and leave every
light on 24/7. The building's infrastructure would collapse. Other tenants
would suffer.

The building manager sets limits: each apartment gets a maximum of 30
amps of electricity, 50 gallons of water per hour, and heating up to 75
degrees. Go over your electricity limit, and the breaker trips. Go over
your water limit, and the flow restrictor kicks in.

That's exactly what Linux cgroups do. While **namespaces** give each
container its own isolated VIEW of the system, **cgroups** set LIMITS on
how much of the system's resources each container can actually use.

Without cgroups, one rogue container could eat all the CPU, exhaust all
the memory, and bring down every other container on the host. With cgroups,
each container gets a resource budget, and the kernel enforces it.

---

## What Are cgroups?

Control groups (cgroups) are a Linux kernel feature that limits, accounts
for, and isolates resource usage of process groups. They control:

| Resource | What It Limits |
|----------|---------------|
| CPU | How much processing time |
| Memory | How much RAM |
| I/O | Disk read/write bandwidth |
| Network | Network bandwidth (via tc) |
| PIDs | Maximum number of processes |
| Devices | Access to hardware devices |

Every process on a Linux system belongs to a cgroup. By default, processes
are in the root cgroup with no limits. When Docker creates a container,
it creates a new cgroup for the container's processes and applies whatever
limits you've specified.

---

## CPU Limits

### The CPU Is a Time-Shared Resource

CPU isn't like memory — you don't "use 2 CPUs worth of RAM." Instead,
CPU time is sliced up. If your host has 4 CPUs and gives a container
1 CPU, that container gets 25% of total CPU time. It can use any of the
4 physical cores, but the scheduler ensures it doesn't exceed its budget.

Think of it like meeting room time. The building has 4 conference rooms.
Your department is allowed 1 room's worth of time per day. You might use
room A in the morning and room C in the afternoon, but your total
occupancy never exceeds 1 room.

### Setting CPU Limits

```bash
docker run -d --name cpu-hog --cpus 1.5 ubuntu bash -c "while true; do :; done"
```

This container can use at most 1.5 CPUs worth of time. On a 4-CPU host,
that's 37.5% of total CPU capacity.

Monitor it:

```bash
docker stats cpu-hog --no-stream
```

```
CONTAINER ID  NAME     CPU %    MEM USAGE / LIMIT    MEM %
a1b2c3d4e5f6  cpu-hog  150.00%  1.2MiB / 7.77GiB    0.02%
```

CPU 150% means it's using 1.5 CPUs. The limit works.

### CPU Shares (Relative Weights)

```bash
docker run -d --name high-priority --cpu-shares 1024 ubuntu bash -c "while true; do :; done"
docker run -d --name low-priority --cpu-shares 256 ubuntu bash -c "while true; do :; done"
```

CPU shares are **relative**, not absolute. With shares 1024 vs 256,
high-priority gets 4x more CPU than low-priority **when both are
competing**. If low-priority is idle, high-priority can use all available
CPU.

Think of it like a lunch buffet with a limited line. If two departments
send people, the bigger department gets proportionally more food. But if
only one department shows up, they get everything.

### CPU Period and Quota (Advanced)

Under the hood, `--cpus 1.5` translates to:

```bash
docker run -d --cpu-period 100000 --cpu-quota 150000 myapp
```

This means: in every 100ms period, the container can use 150ms of CPU
time across all cores. That's 1.5 CPUs.

### Pinning to Specific CPUs

```bash
docker run -d --cpuset-cpus "0,1" myapp
```

This container can ONLY use CPU 0 and CPU 1. Useful for NUMA-aware
workloads or isolating noisy neighbors.

Clean up:

```bash
docker rm -f cpu-hog high-priority low-priority 2>/dev/null
```

---

## Memory Limits

### Memory Is a Hard Boundary

Unlike CPU (which is throttled — slowed down), memory is a cliff. When a
process tries to use more memory than its cgroup allows, the kernel's
OOM (Out Of Memory) killer terminates the process. No warning, no
graceful shutdown. Dead.

Think of it like your apartment's breaker box. Pull too much electricity
and the breaker trips instantly. Your lights go out, your dinner stops
cooking, your TV shuts off. No gradual dimming.

### Setting Memory Limits

```bash
docker run -d --name mem-limited --memory 256m ubuntu bash -c "sleep 3600"
```

This container cannot use more than 256MB of memory.

Check the limit:

```bash
docker inspect --format '{{.HostConfig.Memory}}' mem-limited
```

```
268435456
```

That's 256MB in bytes.

### Triggering an OOM Kill

Let's deliberately exceed a memory limit to see what happens:

```bash
docker run --rm --memory 50m ubuntu bash -c \
  "dd if=/dev/zero of=/dev/null bs=1M count=1000 & \
   cat /dev/urandom | head -c 100m > /dev/null"
```

Or more dramatically with a stress tool:

```bash
docker run --rm --memory 100m --name oom-test ubuntu bash -c \
  "apt-get update && apt-get install -y stress && stress --vm 1 --vm-bytes 200M"
```

The container gets killed. Check why:

```bash
docker inspect --format '{{.State.OOMKilled}}' oom-test
```

```
true
```

The kernel's OOM killer identified this container as exceeding its memory
cgroup limit and terminated it.

### Memory + Swap

```bash
docker run -d --memory 256m --memory-swap 512m myapp
```

- `--memory 256m` — 256MB of RAM
- `--memory-swap 512m` — 512MB total (RAM + swap), meaning 256MB swap

If you set `--memory-swap` equal to `--memory`, there's no swap. If you
omit `--memory-swap`, the container gets 2x `--memory` as total (so 256MB
swap).

```bash
docker run -d --memory 256m --memory-swap 256m myapp
```

This means: 256MB RAM, zero swap. Exceed 256MB and you're dead.

### Memory Reservation (Soft Limit)

```bash
docker run -d --memory 512m --memory-reservation 256m myapp
```

Reservation is a soft limit. Docker tries to keep the container under
256MB but allows bursts up to 512MB. When the host is under memory
pressure, containers are pushed toward their reservation.

Clean up:

```bash
docker rm -f mem-limited 2>/dev/null
```

---

## What Happens When the OOM Killer Strikes

The OOM killer is one of the most important things to understand when
running containers in production.

### The Kill Chain

1. Container process requests memory beyond its cgroup limit
2. Kernel cannot reclaim enough memory within the cgroup
3. Kernel invokes the OOM killer for that cgroup
4. OOM killer selects a process to kill (usually the biggest memory user)
5. Process receives SIGKILL (uncatchable, immediate death)
6. Container crashes with exit code 137 (128 + 9, where 9 = SIGKILL)

### Detecting OOM Kills

```bash
docker run --rm --name oom-demo --memory 10m ubuntu bash -c \
  "head -c 20m /dev/urandom > /tmp/bigfile"
```

```bash
docker inspect --format '{{.State.ExitCode}}' oom-demo
```

```
137
```

Exit code 137 = OOM killed.

On the host:

```bash
dmesg | grep -i "oom\|killed"
```

```
[12345.678] Memory cgroup out of memory: Killed process 98765 (bash) total-vm:25000kB
```

### In Your Go Applications

A Go program that leaks memory in a container:

```go
var leaks [][]byte

func leakMemory() {
    for {
        chunk := make([]byte, 10*1024*1024)
        leaks = append(leaks, chunk)
        time.Sleep(100 * time.Millisecond)
    }
}
```

If this runs in a container with `--memory 256m`, after ~25 iterations
(250MB), the OOM killer fires. Your Go process dies with no chance to run
deferred functions, close connections, or flush logs.

To protect against this:
1. Set realistic memory limits
2. Monitor memory usage with `docker stats`
3. Implement health checks that alert on high memory usage
4. In Go, use `runtime.MemStats` to track your own memory
5. In Node.js, use `process.memoryUsage()`

### In Your Node.js Applications

Node.js has its own memory limit: the V8 heap. By default, V8 limits the
old generation heap to ~1.5GB. If your container limit is 512MB but V8
tries to use 1.5GB, the OOM killer will fire long before V8 hits its own
limit.

Set Node's heap to match the container:

```bash
docker run --memory 512m -e NODE_OPTIONS="--max-old-space-size=384" myapp
```

Leave headroom between `--max-old-space-size` and `--memory` for the
Node.js runtime overhead, stack, and external buffers.

---

## PID Limits

### Why Limit Process Count?

A fork bomb is a program that recursively creates new processes until the
system runs out of PIDs:

```bash
:(){ :|:& };:
```

Without PID limits, one container running a fork bomb could exhaust the
host's PID space, affecting ALL containers and host processes.

### Setting PID Limits

```bash
docker run -d --name pid-limited --pids-limit 50 ubuntu bash -c "sleep 3600"
```

This container can have at most 50 processes. A fork bomb would hit the
limit and fail to create more processes instead of taking down the host.

Test it:

```bash
docker exec pid-limited bash -c "for i in $(seq 1 60); do sleep 3600 & done"
```

After 50 processes, additional `sleep` commands fail with
"Resource temporarily unavailable."

Clean up: `docker rm -f pid-limited`

---

## I/O Limits

### Disk Throughput

```bash
docker run -d --name io-limited \
  --device-read-bps /dev/sda:10mb \
  --device-write-bps /dev/sda:10mb \
  myapp
```

This limits the container to 10MB/s read and write on `/dev/sda`.

### I/O Weight (Relative Priority)

```bash
docker run -d --blkio-weight 100 --name low-io myapp
docker run -d --blkio-weight 900 --name high-io myapp
```

When both compete for disk I/O, high-io gets 9x the throughput.

---

## cgroups v1 vs v2

### cgroups v1 (Legacy)

cgroups v1 uses separate hierarchies for each resource controller:

```
/sys/fs/cgroup/
├── cpu/
│   └── docker/
│       └── <container-id>/
│           ├── cpu.shares
│           └── cpu.cfs_quota_us
├── memory/
│   └── docker/
│       └── <container-id>/
│           ├── memory.limit_in_bytes
│           └── memory.usage_in_bytes
├── blkio/
│   └── docker/
│       └── <container-id>/
└── pids/
    └── docker/
        └── <container-id>/
```

Each resource type is its own tree. This leads to configuration
inconsistencies and complex management.

### cgroups v2 (Unified)

cgroups v2 uses a single unified hierarchy:

```
/sys/fs/cgroup/
└── system.slice/
    └── docker-<container-id>.scope/
        ├── cpu.max
        ├── memory.max
        ├── memory.current
        ├── io.max
        └── pids.max
```

All resource controllers share one tree. Settings are simpler and more
consistent.

### Which Are You Using?

```bash
mount | grep cgroup
```

If you see `cgroup2` — you're on v2. If you see separate mounts for
`cgroup/cpu`, `cgroup/memory`, etc. — you're on v1.

Most modern distributions (Ubuntu 22.04+, Fedora 31+, Debian 11+) use
cgroups v2 by default.

### Why It Matters

- cgroups v2 has better memory accounting (includes kernel memory)
- cgroups v2 has pressure stall information (PSI) for monitoring
- cgroups v2 has unified resource limits that work together
- Kubernetes moved to cgroups v2 as the default in version 1.25

If you're running containers in production, cgroups v2 is the path
forward. v1 still works but is considered legacy.

---

## Monitoring Resource Usage

### docker stats

The most basic monitoring:

```bash
docker stats
```

```
CONTAINER ID  NAME    CPU %  MEM USAGE / LIMIT    MEM %   NET I/O        BLOCK I/O      PIDS
a1b2c3d4e5f6  api     2.5%   45.2MiB / 512MiB     8.83%   1.2kB / 648B   8.19kB / 0B    12
b2c3d4e5f6a7  db      15.3%  128MiB / 1GiB        12.5%   5.4kB / 3.2kB  1.2MB / 45kB   28
```

One-shot (no stream):

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

### Reading cgroup Files Directly

For cgroups v2:

```bash
docker run -d --name cg-demo --memory 256m ubuntu sleep 3600
CONTAINER_ID=$(docker inspect --format '{{.Id}}' cg-demo)

cat /sys/fs/cgroup/system.slice/docker-${CONTAINER_ID}.scope/memory.max
cat /sys/fs/cgroup/system.slice/docker-${CONTAINER_ID}.scope/memory.current
cat /sys/fs/cgroup/system.slice/docker-${CONTAINER_ID}.scope/cpu.max
```

For cgroups v1:

```bash
cat /sys/fs/cgroup/memory/docker/${CONTAINER_ID}/memory.limit_in_bytes
cat /sys/fs/cgroup/memory/docker/${CONTAINER_ID}/memory.usage_in_bytes
cat /sys/fs/cgroup/cpu/docker/${CONTAINER_ID}/cpu.cfs_quota_us
```

These files are the source of truth. `docker stats` reads from these
files.

Clean up: `docker rm -f cg-demo`

---

## Relation to Go's GOMAXPROCS

### The Problem

Go uses `runtime.GOMAXPROCS` to determine how many OS threads to use for
goroutine scheduling. By default, it equals the number of CPUs returned
by `runtime.NumCPU()`.

Here's the catch: on Linux, `runtime.NumCPU()` reads from
`/proc/cpuinfo` or `sched_getaffinity()`, which returns the **host's**
CPU count, not the cgroup limit.

If your host has 8 CPUs and you run:

```bash
docker run --cpus 2 mygoapp
```

Go sees 8 CPUs, sets GOMAXPROCS=8, creates 8 OS threads, and tries to
schedule goroutines across all of them. But the cgroup only allows 2 CPUs
worth of time. The result: excessive context switching and poor
performance.

### The Fix

Use `uber-go/automaxprocs`:

```go
import _ "go.uber.org/automaxprocs"
```

This package reads the cgroup limits and sets GOMAXPROCS correctly. It's
one import that should be in every Go service running in containers.

Or set it manually:

```bash
docker run --cpus 2 -e GOMAXPROCS=2 mygoapp
```

But `automaxprocs` is better because it adapts automatically.

### Verify It Works

```go
package main

import (
    "fmt"
    "runtime"
)

func main() {
    fmt.Printf("NumCPU: %d\n", runtime.NumCPU())
    fmt.Printf("GOMAXPROCS: %d\n", runtime.GOMAXPROCS(0))
}
```

Without automaxprocs in a `--cpus 2` container on an 8-CPU host:

```
NumCPU: 8
GOMAXPROCS: 8
```

With automaxprocs:

```
NumCPU: 8
GOMAXPROCS: 2
```

---

## Relation to Node.js Memory

### The Problem

Node.js (V8) has its own heap size limit. If the container memory limit
is lower than V8's default, the OOM killer fires before V8 can garbage
collect.

### The Fix

```bash
docker run --memory 512m -e NODE_OPTIONS="--max-old-space-size=384" myapp
```

Rule of thumb: set `--max-old-space-size` to about 75% of `--memory` to
leave room for the runtime, native code, and buffers.

### Node.js Worker Threads

If you use Worker threads in Node.js, each worker has its own V8 heap.
Four workers at 384MB each = 1.5GB of heap. Make sure your container
memory limit accounts for all workers.

```bash
docker run --memory 2g -e NODE_OPTIONS="--max-old-space-size=384" myapp
```

---

## Production Recommendations

### Always Set Memory Limits

```bash
docker run --memory 512m --memory-swap 512m myapp
```

Without memory limits, a leaking container will eat all host RAM and
trigger the host's OOM killer, which might kill ANYTHING — including
your database, your load balancer, even systemd.

### Set CPU Limits for Predictability

```bash
docker run --cpus 2 myapp
```

Without CPU limits, your app might work great in testing (where it gets
all the CPU) and terribly in production (where 20 containers compete).

### Set PID Limits

```bash
docker run --pids-limit 100 myapp
```

Prevents fork bombs and runaway process creation.

### Monitor Everything

```bash
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}"
```

In production, pipe metrics to Prometheus/Grafana. Docker exposes cgroup
metrics that monitoring agents can scrape.

---

## Exercises

### Exercise 1: CPU Throttling

Create two containers competing for CPU:

```bash
docker run -d --name fast --cpus 2 ubuntu bash -c "while true; do :; done"
docker run -d --name slow --cpus 0.5 ubuntu bash -c "while true; do :; done"
```

Run `docker stats` and observe the CPU percentages. `fast` should use
roughly 4x the CPU of `slow`.

What happens if you remove the limits?

```bash
docker rm -f fast slow
docker run -d --name unlimited1 ubuntu bash -c "while true; do :; done"
docker run -d --name unlimited2 ubuntu bash -c "while true; do :; done"
```

Both should split available CPU roughly equally (CPU shares are equal
by default).

Clean up: `docker rm -f fast slow unlimited1 unlimited2 2>/dev/null`

### Exercise 2: OOM Kill Investigation

```bash
docker run -d --name leak --memory 50m ubuntu bash -c \
  "dd if=/dev/zero bs=1M count=100 of=/tmp/bigfile"
```

Wait a moment, then:

```bash
docker inspect --format '{{.State.OOMKilled}}' leak
docker inspect --format '{{.State.ExitCode}}' leak
docker logs leak
```

Questions:
1. Was it OOM killed?
2. What was the exit code?
3. What do the logs show?

Clean up: `docker rm -f leak`

### Exercise 3: PID Limit Testing

```bash
docker run -d --name pid-test --pids-limit 20 ubuntu bash -c "sleep 3600"
```

Try to create many processes inside:

```bash
docker exec pid-test bash -c 'for i in $(seq 1 30); do sleep 100 & echo "Started $i"; done'
```

At what point do new processes fail? Check the actual count:

```bash
docker exec pid-test bash -c "ls /proc | grep -E '^[0-9]+$' | wc -l"
```

Clean up: `docker rm -f pid-test`

### Exercise 4: Memory Monitoring Over Time

```bash
docker run -d --name mem-watch --memory 256m ubuntu bash -c \
  "apt-get update && apt-get install -y stress && stress --vm 1 --vm-bytes 100M --vm-hang 0"
```

In another terminal, watch memory grow:

```bash
docker stats mem-watch
```

How close to the 256MB limit does it get? What happens if you change
`--vm-bytes` to 300M?

Clean up: `docker rm -f mem-watch`

### Exercise 5: GOMAXPROCS Container Awareness

Create a simple Go program that prints runtime info:

```go
package main

import (
    "fmt"
    "runtime"
)

func main() {
    fmt.Printf("NumCPU: %d\n", runtime.NumCPU())
    fmt.Printf("GOMAXPROCS: %d\n", runtime.GOMAXPROCS(0))
}
```

Build and run it in a container with CPU limits:

```bash
docker run --cpus 1 golang:1.22 go run /dev/stdin <<'EOF'
package main

import (
    "fmt"
    "runtime"
)

func main() {
    fmt.Printf("NumCPU: %d\n", runtime.NumCPU())
    fmt.Printf("GOMAXPROCS: %d\n", runtime.GOMAXPROCS(0))
}
EOF
```

Notice that NumCPU and GOMAXPROCS don't match the `--cpus 1` limit. This
is the exact problem `automaxprocs` solves.

---

## What Would Happen If...

**Q: You set `--memory 0` (or don't set memory)?**

No memory limit. The container can use all available host RAM. A memory
leak will eventually trigger the host's OOM killer, which could kill
any process on the system — including other containers.

**Q: You set `--cpus` higher than the host has?**

Docker allows it but it's meaningless. A `--cpus 16` limit on an 8-CPU
host just means "no effective limit."

**Q: A container hits its memory limit but has swap?**

The container starts using swap, which means disk I/O for memory
operations. Performance degrades dramatically. Your Go or Node.js API
response times go from 5ms to 500ms as memory pages are swapped in and
out.

**Q: Two containers each set `--memory 4g` on a host with 4GB RAM?**

Docker allows this (it doesn't validate against total host memory). Both
containers might run fine if they don't actually use 4GB each. But if
both try to use their full allocation, one or both get OOM killed.

**Q: You set CPU limits but the host is idle?**

The container is still limited. Even if no other process wants the CPU,
your container can't exceed its `--cpus` limit. CPU shares (`--cpu-shares`)
behave differently — they only limit when there's competition.

---

## Key Takeaways

1. cgroups limit how much of a resource a container can use. Namespaces
   provide isolation (what you can see); cgroups provide limits (how much
   you can use).

2. Memory limits are hard walls enforced by the OOM killer. Exceed them
   and your process dies with SIGKILL (exit code 137).

3. CPU limits are throttles. The scheduler slows your container down but
   doesn't kill it.

4. Go's GOMAXPROCS doesn't automatically respect cgroup CPU limits. Use
   `automaxprocs` or set it manually.

5. Node.js's V8 heap doesn't automatically respect cgroup memory limits.
   Set `--max-old-space-size` explicitly.

6. Always set resource limits in production. Running without limits is
   like having no circuit breakers in an apartment building.

---

## Next Lesson

You now know how containers are isolated (namespaces) and limited
(cgroups). But where does the container's filesystem come from? How can
you have hundreds of containers running the same image without copying
the filesystem hundreds of times? Lesson 04 covers **OverlayFS** — the
union filesystem that makes container images efficient.
