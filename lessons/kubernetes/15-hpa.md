# Lesson 15: Horizontal Pod Autoscaler — Scaling on Metrics

## The Big Picture

Imagine a restaurant with a smart manager. During the lunch rush, tables fill
up fast. The manager watches table occupancy. When 80% of tables are full, she
calls in extra waiters. When the rush dies down and only 30% of tables are
occupied, she sends waiters home. She doesn't react to every single customer
— she waits a few minutes to make sure the trend is real before hiring or
firing. She also won't fire all waiters at once, even if the restaurant
empties suddenly, because another rush could come any moment.

That's the Horizontal Pod Autoscaler (HPA). It monitors metrics (CPU, memory,
custom metrics), and automatically scales your Deployment up or down based on
targets you set. It's a control loop that checks metrics every 15 seconds and
adjusts replica counts to keep utilization near your target.

---

## Prerequisites

- Lesson 04 (Deployments)
- Lesson 16 (Resource Requests and Limits — read the requests section)
- A running kind cluster

```bash
kind create cluster --name hpa-lab
```

### Install Metrics Server

The HPA needs a Metrics Server to read CPU and memory usage. kind doesn't
include one by default.

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

Metrics Server needs a tweak for kind (it can't verify kubelet certificates):

```bash
kubectl patch deployment metrics-server -n kube-system --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/args/-",
    "value": "--kubelet-insecure-tls"
  }
]'
```

Wait for it:

```bash
kubectl wait --for=condition=ready pod -l k8s-app=metrics-server -n kube-system --timeout=120s
```

Verify it works:

```bash
kubectl top nodes
```

You should see CPU and memory usage for your nodes. If you get "metrics not
available," wait 60 seconds and try again — Metrics Server needs time to
collect its first round of data.

---

## How HPA Works

The HPA is a control loop. Every 15 seconds (configurable via
`--horizontal-pod-autoscaler-sync-period` on the controller manager), it:

1. **Reads metrics** from the Metrics Server (or custom metrics API)
2. **Calculates desired replicas** using the formula:
   ```
   desiredReplicas = ceil(currentReplicas × (currentMetricValue / targetMetricValue))
   ```
3. **Scales the Deployment** if the desired count differs from current

### The Math

Say you have 3 replicas, each using 80% CPU, and your target is 50%:

```
desiredReplicas = ceil(3 × (80 / 50)) = ceil(4.8) = 5
```

Scale up to 5 replicas.

After scaling, each replica uses roughly 48% CPU (the load is spread across 5
instead of 3). That's under the 50% target, so no more scaling.

If traffic drops and each replica uses 20% CPU:

```
desiredReplicas = ceil(5 × (20 / 50)) = ceil(2.0) = 2
```

Scale down to 2 replicas.

---

## Deploy a Scalable Application

We need an app that actually consumes CPU so we can watch the HPA react.

```yaml
# file: hpa-demo-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: load-generator-target
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cpu-burner
  template:
    metadata:
      labels:
        app: cpu-burner
    spec:
      containers:
      - name: cpu-burner
        image: registry.k8s.io/hpa-example
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 200m
          limits:
            cpu: 500m
---
apiVersion: v1
kind: Service
metadata:
  name: cpu-burner
spec:
  selector:
    app: cpu-burner
  ports:
  - port: 80
    targetPort: 80
```

The `hpa-example` image is a PHP app that does CPU-intensive computation on
each request. Each request consumes a calculable amount of CPU.

```bash
kubectl apply -f hpa-demo-app.yaml
kubectl wait --for=condition=ready pod -l app=cpu-burner --timeout=60s
```

**Important**: the `resources.requests.cpu: 200m` is critical. The HPA
calculates CPU percentage relative to the request. Without a request, the HPA
can't compute utilization percentages.

---

## Create an HPA

### Using kubectl

```bash
kubectl autoscale deployment load-generator-target \
  --cpu-percent=50 \
  --min=1 \
  --max=10
```

This creates an HPA that:
- Targets 50% average CPU utilization across all Pods
- Won't scale below 1 replica
- Won't scale above 10 replicas

### Using YAML (More Control)

```yaml
# file: hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cpu-burner-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: load-generator-target
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
```

```bash
kubectl apply -f hpa.yaml
```

Check the HPA:

```bash
kubectl get hpa
```

```
NAME              REFERENCE                          TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
cpu-burner-hpa    Deployment/load-generator-target   0%/50%    1         10        1          30s
```

`0%/50%` means current CPU is 0% and target is 50%. The app is idle.

---

## Generate Load and Watch It Scale

Open a second terminal and watch the HPA:

```bash
kubectl get hpa cpu-burner-hpa -w
```

In the first terminal, generate load:

```bash
kubectl run load-generator --image=busybox --restart=Never -- /bin/sh -c \
  "while true; do wget -q -O- http://cpu-burner; done"
```

This sends continuous requests to the CPU-burning app.

### Watch the HPA React

In the second terminal, you'll see something like:

```
NAME              TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
cpu-burner-hpa    0%/50%    1         10        1          60s
cpu-burner-hpa    125%/50%  1         10        1          75s
cpu-burner-hpa    125%/50%  1         10        3          90s
cpu-burner-hpa    85%/50%   1         10        3          105s
cpu-burner-hpa    85%/50%   1         10        4          120s
cpu-burner-hpa    52%/50%   1         10        4          135s
```

The sequence:
1. CPU jumps to 125% (relative to the 200m request)
2. HPA calculates: `ceil(1 × 125/50) = ceil(2.5) = 3` — scales to 3
3. CPU drops to 85% spread across 3 Pods
4. Still above 50%, so: `ceil(3 × 85/50) = ceil(5.1) = 6` (or similar)
5. Eventually stabilizes near the 50% target

### Stop the Load

```bash
kubectl delete pod load-generator
```

Watch the HPA scale down (this takes longer — there's a default 5-minute
stabilization window):

```
cpu-burner-hpa    52%/50%   1         10        6          300s
cpu-burner-hpa    0%/50%    1         10        6          315s
cpu-burner-hpa    0%/50%    1         10        6          600s
cpu-burner-hpa    0%/50%    1         10        1          615s
```

After about 5 minutes of low utilization, it scales back to 1.

---

## Scaling Behavior: Fine-Tuning

The HPA's default behavior is conservative to avoid flapping (rapid scale
up/down oscillation). You can customize this.

### Stabilization Windows

```yaml
# file: hpa-tuned.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cpu-burner-hpa-tuned
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: load-generator-target
  minReplicas: 1
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      selectPolicy: Max
```

Breaking this down:

**scaleUp**:
- **stabilizationWindowSeconds: 30** — wait 30 seconds of sustained high
  metrics before scaling up (default is 0 — scale up immediately)
- **policies** — up to 100% increase or 4 Pods, whichever is larger (`Max`),
  every 15 seconds
- This means: if you have 3 Pods, you can add up to 4 Pods (the larger of
  100% of 3 = 3 or flat 4)

**scaleDown**:
- **stabilizationWindowSeconds: 300** — wait 5 minutes of low metrics before
  scaling down (this is the default)
- **policies** — remove at most 10% of Pods per minute
- This means slow, gradual scale-down. If you have 20 Pods, you lose at most
  2 per minute

The asymmetry is intentional: scale up fast (to handle load), scale down slow
(to avoid flapping if load returns).

### Aggressive Scale-Down

If you want faster scale-down (e.g., for cost savings in dev):

```yaml
behavior:
  scaleDown:
    stabilizationWindowSeconds: 60
    policies:
    - type: Percent
      value: 50
      periodSeconds: 30
```

Scale down 50% every 30 seconds after 1 minute of low usage.

### Disable Scale-Down Entirely

For apps that should only grow:

```yaml
behavior:
  scaleDown:
    selectPolicy: Disabled
```

---

## Scaling on Memory

```yaml
# file: hpa-memory.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: memory-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: memory-hungry-app
  minReplicas: 2
  maxReplicas: 8
  metrics:
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70
```

**Warning about memory scaling**: memory-based HPA is less useful than
CPU-based. Many applications (especially Go and Java apps) allocate memory and
don't release it. The garbage collector may not free memory just because load
decreases. This means the HPA scales up but never scales down, because memory
stays high even when the app is idle.

CPU-based scaling is generally more predictable because CPU usage directly
correlates with request load.

### Multiple Metrics

You can combine CPU and memory targets:

```yaml
metrics:
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 50
- type: Resource
  resource:
    name: memory
    target:
      type: Utilization
      averageUtilization: 70
```

When multiple metrics are specified, the HPA calculates the desired replica
count for each metric and takes the **maximum**. So if CPU says you need 4
replicas and memory says you need 6, you get 6.

---

## Custom Metrics

Resource metrics (CPU, memory) are built-in. For more sophisticated scaling,
you need custom metrics — things like:

- Requests per second
- Queue depth
- Active connections
- Business-specific metrics (orders per minute, etc.)

### Architecture

```
Your App → exposes /metrics → Prometheus scrapes → Prometheus Adapter → HPA reads
```

1. Your app exposes Prometheus metrics (e.g., `http_requests_total`)
2. Prometheus scrapes those metrics
3. The Prometheus Adapter translates Prometheus queries into the Kubernetes
   custom metrics API
4. The HPA reads from the custom metrics API

### Custom Metric HPA Example

```yaml
# file: hpa-custom.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rps-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
```

This scales so each Pod handles roughly 100 requests per second. If total load
is 500 RPS, you get 5 replicas.

### External Metrics

For scaling based on metrics outside the cluster (like an AWS SQS queue depth):

```yaml
metrics:
- type: External
  external:
    metric:
      name: sqs_queue_length
      selector:
        matchLabels:
          queue: order-processing
    target:
      type: AverageValue
      averageValue: "30"
```

Scale up when the queue has more than 30 messages per Pod.

---

## The Metrics Pipeline

```
kubelet (cAdvisor) → Metrics Server → HPA (Resource metrics)
App (/metrics)     → Prometheus     → Prometheus Adapter → HPA (Custom metrics)
AWS CloudWatch     → CloudWatch Adapter → HPA (External metrics)
```

### Metrics Server

Provides real-time CPU and memory for Pods and nodes. Stores only the latest
data point (not historical). This is what `kubectl top` uses.

```bash
kubectl top pods
kubectl top nodes
```

### When Metrics Server Isn't Enough

Metrics Server only provides CPU and memory. For request rates, queue depths,
latency percentiles, or any business metric, you need the Prometheus +
Prometheus Adapter stack.

---

## Relating to Go/TypeScript Patterns

### Go: Scaling Worker Pools

In Go, you might dynamically size a worker pool:

```go
func autoScale(pool *WorkerPool, metricsCh <-chan float64) {
    for load := range metricsCh {
        desired := int(math.Ceil(float64(pool.Size()) * (load / targetLoad)))
        desired = clamp(desired, minWorkers, maxWorkers)
        pool.Resize(desired)
    }
}
```

The HPA does exactly this, but for Pods instead of goroutines. Same concept:
measure load, calculate desired workers, adjust.

### TypeScript: PM2 Cluster Mode

If you've used PM2 in cluster mode:

```bash
pm2 start app.js -i max
```

PM2 scales Node processes based on CPU cores. The HPA scales Pods based on
metrics. The HPA is more sophisticated — it scales on actual usage, not just
available cores.

### The Connection

In your Go/TypeScript apps, expose meaningful metrics:

```go
var httpRequestsTotal = prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "http_requests_total",
        Help: "Total HTTP requests",
    },
    []string{"method", "path", "status"},
)
```

```typescript
const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
});
```

These metrics feed into Prometheus, which feeds the Prometheus Adapter, which
feeds the HPA. Your app's instrumentation directly drives its scaling.

---

## Exercises

### Exercise 1: Basic CPU Scaling

1. Deploy the `hpa-example` app with `cpu: 200m` request
2. Create an HPA targeting 50% CPU with min=1, max=10
3. Generate load with a `while wget` loop
4. Watch the HPA scale up — record timestamps and replica counts
5. Stop load and watch it scale down — note the stabilization delay
6. Plot the scaling behavior (time vs replicas)

### Exercise 2: Tuning Scale Behavior

1. Start with Exercise 1's setup
2. Create an HPA with aggressive scale-up (0s stabilization, 200% per period)
3. Generate load and compare scale-up speed with the default
4. Create an HPA with aggressive scale-down (30s stabilization, 50% per period)
5. Stop load and compare scale-down speed
6. Find a balance that handles a realistic traffic pattern (gradual increase,
   sudden spike, gradual decrease)

### Exercise 3: Memory-Based Scaling

1. Deploy an app that allocates memory based on request count
2. Create an HPA targeting 70% memory utilization
3. Generate load and watch it scale
4. Stop load — does it scale back down? Why or why not?
5. Compare with CPU-based scaling for the same app

### Exercise 4: Scaling Simulation

Build a script that simulates a day of traffic:

```bash
#!/bin/bash
echo "Simulating morning ramp-up"
for i in $(seq 1 5); do
    kubectl run "load-$i" --image=busybox --restart=Never -- \
        /bin/sh -c "while true; do wget -q -O- http://cpu-burner; done"
    sleep 60
done

echo "Simulating peak"
sleep 300

echo "Simulating afternoon decline"
for i in $(seq 5 -1 1); do
    kubectl delete pod "load-$i"
    sleep 60
done
```

Monitor the HPA throughout and observe how it reacts to gradual vs sudden
changes.

---

## What Would Happen If...

**Q: Metrics Server goes down?**
A: The HPA can't read metrics and stops scaling. Existing replicas stay at
their current count. The HPA logs errors and retries. Once Metrics Server
recovers, scaling resumes based on current metrics.

**Q: You set minReplicas to 0?**
A: Starting with Kubernetes 1.27+, HPA can scale to zero if you use custom
metrics and enable the `HPAScaleToZero` feature gate. With resource metrics
(CPU/memory), min must be at least 1.

**Q: Two HPAs target the same Deployment?**
A: They'll fight each other. One scales up, the other scales down. Don't do
this. Use a single HPA with multiple metrics instead.

**Q: Your Pods don't have resource requests set?**
A: CPU utilization can't be calculated (there's nothing to calculate percentage
against). The HPA will show `<unknown>/50%` for targets and won't scale. Always
set resource requests when using HPA.

**Q: The HPA keeps scaling up but performance doesn't improve?**
A: The bottleneck is elsewhere — database, external API, network. Adding more
Pods doesn't help if they're all waiting on the same database connection pool.
Profile your app to find the actual bottleneck.

**Q: Pods take 60 seconds to start but the HPA scales up every 15 seconds?**
A: The HPA sees high CPU, scales up, but the new Pods aren't ready yet. Next
check, CPU is still high, so it scales up again. Use `stabilizationWindowSeconds`
on scale-up to wait for new Pods to become ready. Also ensure your Pods have
proper readiness probes so the HPA doesn't count them until they're actually
serving traffic.

---

## Key Takeaways

1. **HPA is a control loop**: checks metrics every 15 seconds, adjusts replicas
   toward the target
2. **Requires Metrics Server**: for CPU/memory. Requires Prometheus Adapter for
   custom metrics
3. **Resource requests are mandatory**: HPA calculates utilization as a
   percentage of the request
4. **Scale up fast, scale down slow**: the default behavior prevents flapping
5. **Customizable behavior**: stabilization windows and policies let you tune
   aggressiveness
6. **CPU > memory for scaling**: CPU correlates with load better than memory
7. **Multiple metrics**: HPA takes the maximum recommended replicas across all
   metrics
8. **Custom metrics are powerful**: scale on RPS, queue depth, or any business
   metric your app exposes

---

## Cleanup

```bash
kubectl delete hpa --all
kubectl delete deployment load-generator-target
kubectl delete svc cpu-burner
kubectl delete pod load-generator 2>/dev/null
kind delete cluster --name hpa-lab
```

---

Next: [Lesson 16: Resource Requests, Limits, and QoS →](./16-resources-qos.md)
