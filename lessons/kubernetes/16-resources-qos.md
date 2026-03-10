# Lesson 16: Resource Requests, Limits, and QoS Classes

## The Big Picture

Think of a hotel. When you book a room, the hotel **guarantees** that room is
yours — that's a **request**. Even if the hotel is half-empty, your room is
reserved. The room also has a maximum occupancy sign on the door — "Max 4
guests." That's a **limit**. You can't exceed it, period.

Now imagine the hotel is overbooked during a holiday. The manager has to decide
who gets bumped. Guests with guaranteed premium reservations (Guaranteed tier)
never get bumped. Guests with standard reservations that asked for late checkout
(Burstable tier) might get bumped if things get tight. Walk-ins with no
reservation (BestEffort tier) are the first to go.

That's exactly how Kubernetes handles resources. Requests guarantee minimum
resources for your Pod. Limits cap the maximum. QoS classes determine who gets
evicted when the node runs out of resources.

---

## Prerequisites

- Lesson 04 (Deployments)
- Lesson 03 (Pods)

```bash
kind create cluster --name resources-lab
```

---

## CPU and Memory Units

### CPU: Millicores

CPU is measured in **millicores** (or millicpu). 1 CPU = 1000 millicores = one
full CPU core.

| Value | Meaning |
|-------|---------|
| `1000m` or `1` | One full CPU core |
| `500m` or `0.5` | Half a CPU core |
| `250m` | Quarter core |
| `100m` | One-tenth of a core |
| `50m` | A tiny slice — enough for a sidecar |

CPU is **compressible**. If a container tries to use more CPU than its limit,
Kubernetes **throttles** it — the container gets slower but doesn't get killed.
It's like bandwidth throttling: your download still works, just slower.

### Memory: Bytes with Suffixes

Memory uses standard byte suffixes:

| Value | Meaning |
|-------|---------|
| `128Mi` | 128 mebibytes (134,217,728 bytes) |
| `1Gi` | 1 gibibyte (1,073,741,824 bytes) |
| `256M` | 256 megabytes (256,000,000 bytes) |
| `1G` | 1 gigabyte (1,000,000,000 bytes) |

**Mi/Gi** are binary (powers of 1024). **M/G** are decimal (powers of 1000).
Use **Mi/Gi** — they match what `free -m` shows on Linux and avoid confusing
off-by-one-percent errors.

Memory is **incompressible**. If a container exceeds its memory limit,
Kubernetes **kills it** (OOMKilled). There's no "memory throttling." The
container either fits in the limit or dies.

This is the fundamental asymmetry:
- **CPU exceeded** → throttled (slowed down)
- **Memory exceeded** → killed (OOMKilled)

---

## Requests vs. Limits

### Requests: The Guarantee

A **request** is the minimum amount of CPU/memory guaranteed to your container.
The Kubernetes scheduler uses requests to decide where to place Pods. A Pod
with `cpu: 500m` request will only be scheduled on a node that has at least
500m available.

```yaml
resources:
  requests:
    cpu: 250m
    memory: 128Mi
```

This says: "I need at least 250 millicores and 128Mi memory. Don't put me on a
node that can't provide this."

Think of it as a dinner reservation: the restaurant guarantees your table even
if they're busy.

### Limits: The Ceiling

A **limit** is the maximum amount of CPU/memory a container can use.

```yaml
resources:
  limits:
    cpu: 500m
    memory: 256Mi
```

This says: "Even if the node has spare resources, this container can never use
more than 500m CPU or 256Mi memory."

### Together

```yaml
resources:
  requests:
    cpu: 250m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi
```

This container is guaranteed 250m CPU and 128Mi memory. It can burst up to
500m CPU and 256Mi memory if the node has spare capacity.

The **burstable range** (250m-500m CPU, 128Mi-256Mi memory) is available but
not guaranteed. If another Pod needs those resources, your container gets
throttled back to its request.

### What Happens Without Requests or Limits

| Scenario | Behavior |
|----------|----------|
| No requests, no limits | Pod gets whatever is available (BestEffort) |
| Requests only | Guaranteed minimum, can burst unlimited |
| Limits only | Kubernetes auto-sets requests = limits (Guaranteed) |
| Requests < limits | Guaranteed minimum, can burst to limit (Burstable) |
| Requests = limits | Exactly that amount, no bursting (Guaranteed) |

---

## Seeing Resources in Action

### Deploy Pods with Different Resource Configs

```yaml
# file: resource-demo.yaml
apiVersion: v1
kind: Pod
metadata:
  name: guaranteed-pod
  labels:
    qos: guaranteed
spec:
  containers:
  - name: app
    image: busybox
    command: ["sh", "-c", "sleep infinity"]
    resources:
      requests:
        cpu: 200m
        memory: 128Mi
      limits:
        cpu: 200m
        memory: 128Mi
---
apiVersion: v1
kind: Pod
metadata:
  name: burstable-pod
  labels:
    qos: burstable
spec:
  containers:
  - name: app
    image: busybox
    command: ["sh", "-c", "sleep infinity"]
    resources:
      requests:
        cpu: 100m
        memory: 64Mi
      limits:
        cpu: 500m
        memory: 256Mi
---
apiVersion: v1
kind: Pod
metadata:
  name: besteffort-pod
  labels:
    qos: besteffort
spec:
  containers:
  - name: app
    image: busybox
    command: ["sh", "-c", "sleep infinity"]
```

```bash
kubectl apply -f resource-demo.yaml
kubectl wait --for=condition=ready pod --all --timeout=60s
```

### Check QoS Classes

```bash
kubectl get pods -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass
```

```
NAME              QOS
guaranteed-pod    Guaranteed
burstable-pod     Burstable
besteffort-pod    BestEffort
```

Kubernetes automatically assigned QoS classes based on the resource
configuration. You don't set QoS directly — it's derived.

### Verify with Describe

```bash
kubectl describe pod guaranteed-pod | grep -A 6 "QoS Class"
```

```
QoS Class:       Guaranteed
```

---

## QoS Classes Deep Dive

### Guaranteed

**Requirements**: every container in the Pod must have both requests and limits
set, and requests must equal limits, for both CPU and memory.

```yaml
resources:
  requests:
    cpu: 500m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 256Mi
```

**Behavior**: these Pods are the last to be evicted. They get exactly what they
asked for, no more, no less. The container is never throttled below its request
(because request = limit, it's always at its "limit").

**Use for**: databases, critical API servers, anything that can't tolerate
resource variability.

**The hotel analogy**: premium guests with confirmed reservations. They paid
full price and will never be bumped.

### Burstable

**Requirements**: at least one container has a request or limit set, but
requests don't equal limits.

```yaml
resources:
  requests:
    cpu: 100m
    memory: 64Mi
  limits:
    cpu: 500m
    memory: 256Mi
```

**Behavior**: guaranteed the requested resources. Can burst above requests up
to limits when spare capacity exists. Evicted after BestEffort Pods if the node
is under pressure.

**Use for**: most workloads. Web servers, API gateways, background workers
that have variable load.

**The hotel analogy**: standard reservation guests. Their room is guaranteed
but they requested late checkout — they might lose that perk if the hotel is
overbooked.

### BestEffort

**Requirements**: no container in the Pod has any requests or limits set.

```yaml
resources: {}
```

**Behavior**: can use whatever resources are available. First to be evicted
when the node is under memory pressure. No guarantees at all.

**Use for**: development environments, batch jobs where you don't care about
reliability, non-critical workloads you're willing to sacrifice.

**The hotel analogy**: walk-ins with no reservation. They get a room if one is
free, but they're the first asked to leave during a busy night.

### Eviction Priority

When a node runs low on memory, the kubelet evicts Pods in this order:

1. **BestEffort** — first to go, always
2. **Burstable** — evicted next, starting with Pods using the most memory
   relative to their request
3. **Guaranteed** — evicted last, only in extreme scenarios

Within the Burstable tier, the Pod using the most memory above its request gets
evicted first.

---

## OOMKilled: The Memory Limit Enforcer

When a container exceeds its memory limit, the kernel's OOM killer terminates
it. Kubernetes records this as `OOMKilled`.

### Triggering an OOMKill

```yaml
# file: oom-demo.yaml
apiVersion: v1
kind: Pod
metadata:
  name: oom-victim
spec:
  containers:
  - name: eater
    image: polinux/stress
    command: ["stress"]
    args: ["--vm", "1", "--vm-bytes", "200M", "--vm-hang", "1"]
    resources:
      requests:
        memory: 64Mi
      limits:
        memory: 128Mi
```

This container tries to allocate 200Mi of memory but has a 128Mi limit.

```bash
kubectl apply -f oom-demo.yaml
```

Wait a few seconds:

```bash
kubectl get pod oom-victim
```

```
NAME         READY   STATUS      RESTARTS      AGE
oom-victim   0/1     OOMKilled   3 (12s ago)   30s
```

```bash
kubectl describe pod oom-victim | grep -A 5 "Last State"
```

```
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
```

Exit code 137 = 128 + 9 (SIGKILL). The kernel killed the process with signal 9.

The Pod enters `CrashLoopBackOff` — Kubernetes keeps restarting it, it keeps
getting OOMKilled, Kubernetes backs off with increasing delays.

### Preventing OOMKill

Set memory limits higher than your app's peak usage. Profile your app first:

For Go apps:
```bash
GOMEMLIMIT=200MiB ./my-app
```

Go 1.19+ respects `GOMEMLIMIT` and adjusts the garbage collector to stay within
the limit. Set the container limit slightly above `GOMEMLIMIT` for safety.

For Node.js apps:
```bash
node --max-old-space-size=200 app.js
```

Set the container limit to the `max-old-space-size` plus some headroom for the
V8 overhead (usually 50-100Mi extra).

---

## CPU Throttling: The Silent Performance Killer

Unlike memory (which kills), CPU limits **throttle** the container. This means
your app runs slower without any obvious error. No crash, no log entry, just
latency.

### How CPU Throttling Works

Kubernetes uses the Linux CFS (Completely Fair Scheduler). A container with a
500m CPU limit gets 50ms of CPU time in every 100ms period. If it uses its
50ms quota early, it sits idle until the next period.

This creates a nasty pattern with multi-threaded apps. A Go app with 8
goroutines and a 500m limit: each goroutine gets ~6ms per 100ms period. A
single request that does 10ms of CPU work takes 200ms of wall clock time due
to throttling.

### Detecting CPU Throttling

```bash
kubectl exec guaranteed-pod -- cat /sys/fs/cgroup/cpu.stat
```

Look for `nr_throttled` and `throttled_usec`. Non-zero values mean the
container is being throttled.

### The "No CPU Limits" Debate

Many teams remove CPU limits entirely and only use requests:

```yaml
resources:
  requests:
    cpu: 500m
```

This guarantees 500m CPU but allows bursting to whatever the node has
available. The argument: CPU throttling causes more latency problems than CPU
contention would. If the node has spare CPU, why not let the app use it?

The counterargument: without limits, one noisy Pod can starve other Pods on the
same node.

There's no universal answer. For latency-sensitive APIs: consider removing CPU
limits. For batch workloads sharing nodes with critical services: keep limits.

---

## LimitRanges: Namespace-Level Defaults

You can set default requests and limits for a namespace so developers don't
have to remember:

```yaml
# file: limit-range.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: default
spec:
  limits:
  - default:
      cpu: 500m
      memory: 256Mi
    defaultRequest:
      cpu: 100m
      memory: 128Mi
    max:
      cpu: "2"
      memory: 1Gi
    min:
      cpu: 50m
      memory: 32Mi
    type: Container
```

- **default**: limits applied to containers that don't specify limits
- **defaultRequest**: requests applied to containers that don't specify requests
- **max**: no container can request more than this
- **min**: no container can request less than this

```bash
kubectl apply -f limit-range.yaml
```

Now deploy a Pod with no resources specified:

```bash
kubectl run no-resources --image=busybox --command -- sleep infinity
kubectl describe pod no-resources | grep -A 10 "Limits"
```

```
    Limits:
      cpu:     500m
      memory:  256Mi
    Requests:
      cpu:     100m
      memory:  128Mi
```

The LimitRange filled in the defaults.

---

## ResourceQuotas: Namespace-Level Budgets

While LimitRanges set per-Pod defaults, ResourceQuotas limit the total
resources a namespace can consume:

```yaml
# file: resource-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-budget
  namespace: default
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 4Gi
    limits.cpu: "8"
    limits.memory: 8Gi
    pods: "20"
```

This says: all Pods in this namespace combined can request at most 4 CPUs and
4Gi memory, with limits totaling at most 8 CPUs and 8Gi memory, and no more
than 20 Pods.

```bash
kubectl apply -f resource-quota.yaml
```

Check usage:

```bash
kubectl describe quota team-budget
```

```
Name:            team-budget
Namespace:       default
Resource         Used   Hard
--------         ----   ----
limits.cpu       1200m  8
limits.memory    640Mi  8Gi
pods             4      20
requests.cpu     650m   4
requests.memory  384Mi  4Gi
```

If someone tries to create a Pod that would exceed the quota, it's rejected:

```
Error: forbidden: exceeded quota: team-budget
```

This prevents one team from consuming an entire cluster. Think of it as a
departmental budget — accounting can't spend engineering's money.

---

## Right-Sizing: How to Choose Values

### Step 1: Deploy Without Limits (in Dev)

Run your app without limits to see its natural resource usage:

```bash
kubectl top pods
```

```
NAME       CPU(cores)   MEMORY(bytes)
api-abc    45m          120Mi
api-def    52m          118Mi
api-ghi    48m          122Mi
```

### Step 2: Observe Under Load

Run load tests and record peak usage:

```
Idle:    50m CPU,  120Mi memory
Normal:  200m CPU, 150Mi memory
Peak:    400m CPU, 180Mi memory
```

### Step 3: Set Requests and Limits

```yaml
resources:
  requests:
    cpu: 200m
    memory: 150Mi
  limits:
    cpu: 800m
    memory: 256Mi
```

- **Request** = normal usage (so the scheduler packs nodes efficiently)
- **Limit** = 2-4x the request for CPU (room to burst), 1.5-2x for memory
  (room for spikes, but catch leaks)

### Step 4: Monitor in Production

Use Prometheus metrics to track actual usage vs requests:

```
container_cpu_usage_seconds_total
container_memory_working_set_bytes
```

If usage consistently stays at 10% of request, you're wasting money. If usage
regularly hits 90% of limit, you need more headroom.

### Language-Specific Guidance

**Go applications**:
- Go's GC is efficient. Memory usage is fairly predictable.
- Use `GOMEMLIMIT` to hint the GC.
- CPU: Go is great at using multiple cores. Set limits based on your GOMAXPROCS
  preference.

```yaml
env:
- name: GOMEMLIMIT
  value: "200MiB"
- name: GOMAXPROCS
  value: "2"
resources:
  requests:
    cpu: 500m
    memory: 128Mi
  limits:
    cpu: "2"
    memory: 256Mi
```

**Node.js/TypeScript applications**:
- Node is single-threaded. More than 1 CPU core doesn't help a single process.
- Memory: V8 heap + native allocations. Use `--max-old-space-size`.

```yaml
env:
- name: NODE_OPTIONS
  value: "--max-old-space-size=200"
resources:
  requests:
    cpu: 250m
    memory: 200Mi
  limits:
    cpu: "1"
    memory: 300Mi
```

---

## Exercises

### Exercise 1: QoS Class Exploration

1. Create one Pod of each QoS class (Guaranteed, Burstable, BestEffort)
2. Verify QoS classes with `kubectl get pods -o custom-columns=...`
3. Use `kubectl describe` to see the full resource allocations
4. Try creating a Pod with limits but no requests — what QoS does it get?
5. Try creating a Pod with CPU request but no memory request — what happens?

### Exercise 2: OOMKill and Recovery

1. Deploy a Pod with `memory limit: 64Mi`
2. Use a stress container that tries to allocate 128Mi
3. Watch the OOMKill → CrashLoopBackOff cycle
4. Check the restart count and backoff timing
5. Fix the limit (set to 256Mi) and watch the Pod stabilize

### Exercise 3: CPU Throttling Detection

1. Deploy a CPU-intensive app with `cpu limit: 100m`
2. Generate load
3. Check `/sys/fs/cgroup/cpu.stat` for throttling counters
4. Remove the CPU limit (keep only request)
5. Compare response times with and without CPU limits

### Exercise 4: LimitRange Enforcement

1. Create a LimitRange with `min cpu: 100m`, `max cpu: 1000m`
2. Try creating a Pod requesting 50m CPU — observe rejection
3. Try creating a Pod requesting 2000m CPU — observe rejection
4. Create a Pod requesting 500m CPU — observe success
5. Create a Pod with no resource spec — observe defaults applied

### Exercise 5: ResourceQuota Exhaustion

1. Create a ResourceQuota: `requests.cpu: 1`, `pods: 5`
2. Deploy Pods until you hit each limit
3. Observe the error messages
4. Delete a Pod and verify you can create new ones
5. Think about how this would work in a multi-tenant cluster

---

## What Would Happen If...

**Q: A Pod requests more CPU than any node has?**
A: The Pod stays in `Pending` forever. The scheduler can't find a node with
enough capacity. `kubectl describe pod` will show
`FailedScheduling: Insufficient cpu`. Either reduce the request or add bigger
nodes.

**Q: Every Pod on a node uses its full CPU limit simultaneously?**
A: The CPU is overcommitted. The CFS scheduler distributes CPU proportionally
based on requests. A Pod requesting 500m gets twice as much as one requesting
250m. Everyone is throttled, but proportionally. This is why setting reasonable
requests matters even when limits are higher.

**Q: A Go app leaks memory slowly?**
A: Memory grows until it hits the container limit, then OOMKill. The Pod
restarts and the cycle repeats. You'll see steadily increasing restart counts.
Set memory limits close to expected usage so leaks are caught early rather than
building up for hours.

**Q: You set CPU requests very low to pack more Pods per node?**
A: Under-provisioning. Everything works fine at idle. Under load, all Pods
compete for CPU, everyone gets throttled, latency spikes. Requests should
reflect actual normal usage, not be gamed to fit more Pods.

**Q: A Burstable Pod consistently uses more than its request but less than its
limit?**
A: It works fine — until the node is under pressure. Then the kubelet may
throttle or evict it to protect Guaranteed Pods. The Pod's actual resource usage
fluctuates based on what else is running on the node. This is the "burstable
bargain": cheaper but less predictable.

---

## Key Takeaways

1. **Requests = minimum guarantee**, used by the scheduler for placement
2. **Limits = maximum allowed**, enforced by the kernel
3. **CPU exceeded limit → throttled** (slower), **memory exceeded limit →
   killed** (OOMKilled)
4. **QoS classes**: Guaranteed (requests = limits), Burstable (requests <
   limits), BestEffort (nothing set)
5. **Eviction order**: BestEffort first, then Burstable, then Guaranteed
6. **Always set requests**: without them, the scheduler can't do its job and
   the HPA can't calculate utilization
7. **LimitRanges** set per-container defaults and constraints per namespace
8. **ResourceQuotas** set total resource budgets per namespace
9. **Right-size iteratively**: start generous, observe, tighten based on data

---

## Cleanup

```bash
kubectl delete pod guaranteed-pod burstable-pod besteffort-pod oom-victim no-resources 2>/dev/null
kubectl delete limitrange default-limits 2>/dev/null
kubectl delete resourcequota team-budget 2>/dev/null
kind delete cluster --name resources-lab
```

---

Next: [Lesson 17: Helm →](./17-helm.md)
