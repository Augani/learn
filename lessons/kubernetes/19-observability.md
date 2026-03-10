# Lesson 19: Observability in Kubernetes

## The Big Picture

Imagine a hospital. Every patient has three monitoring systems:

1. **Vitals monitors** (metrics): heart rate, blood pressure, oxygen levels —
   continuous numerical readings displayed on dashboards. Nurses glance at the
   screen and instantly know if something is wrong. "Heart rate spiked to 140
   at 2:15 PM."

2. **Patient charts** (logs): detailed written records of everything that
   happened. "2:15 PM — patient reported chest pain. Administered aspirin.
   2:20 PM — pain subsided." These tell the story of what happened and why.

3. **Patient journey tracking** (traces): tracking a patient's path through
   departments. "Arrived at ER at 1:00 PM → triaged at 1:10 → blood work at
   1:30 → X-ray at 2:00 → diagnosis at 2:30 → admitted at 3:00." This shows
   how long each step took and where bottlenecks are.

In Kubernetes, observability means having all three: **metrics** (what's the
system's state right now?), **logs** (what happened?), and **traces** (how did a
request flow through the system?). Without all three, you're flying blind.

---

## Prerequisites

- Lesson 05 (Services)
- Lesson 14 (DaemonSets)
- Lesson 15 (HPA — metrics overview)

```bash
kind create cluster --name observability-lab
```

---

## The Three Pillars

### Pillar 1: Metrics

Numeric measurements over time. Time-series data.

- CPU usage of each Pod
- Memory consumption
- Request rate (requests per second)
- Error rate (5xx responses per second)
- Latency (p50, p95, p99 response times)
- Queue depth

Metrics answer: **"What is happening right now?"** and **"What's the trend?"**

### Pillar 2: Logs

Text records of events. Structured or unstructured.

- Application stdout/stderr
- HTTP access logs
- Error stack traces
- Audit logs
- System events

Logs answer: **"What happened?"** and **"Why did it happen?"**

### Pillar 3: Traces

Records of a request's journey through multiple services.

- HTTP request enters the API gateway → calls auth service → calls user
  service → calls database → returns response
- Each hop is a "span" with a start time, duration, and metadata
- All spans for one request share a "trace ID"

Traces answer: **"Where is the bottleneck?"** and **"Which service is slow?"**

---

## Built-in Kubernetes Metrics

### kubectl top

The simplest metrics tool. Shows real-time CPU and memory usage:

```bash
kubectl top nodes
```

```
NAME                              CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
observability-lab-control-plane   150m         7%     620Mi           15%
```

```bash
kubectl top pods --all-namespaces
```

```
NAMESPACE     NAME                      CPU(cores)   MEMORY(bytes)
kube-system   coredns-5d78c9869d-abc    5m           15Mi
kube-system   etcd-control-plane        25m          45Mi
kube-system   kube-apiserver            50m          280Mi
```

Requires Metrics Server (installed in Lesson 15).

### kube-state-metrics

While Metrics Server provides resource usage (CPU, memory),
**kube-state-metrics** provides object state metrics:

- How many Pods are in each phase (Running, Pending, Failed)?
- How many Deployments have available replicas != desired replicas?
- How many Nodes are NotReady?
- How many CronJobs have failed recently?

These are the "business metrics" of Kubernetes itself.

Install kube-state-metrics:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/master/examples/standard/cluster-role.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/master/examples/standard/cluster-role-binding.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/master/examples/standard/service-account.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/master/examples/standard/deployment.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/master/examples/standard/service.yaml
```

---

## Prometheus: The Metrics Engine

Prometheus is the standard for Kubernetes metrics. It's a time-series database
that **pulls** (scrapes) metrics from your applications and infrastructure.

### How Prometheus Works

```
Your App (/metrics endpoint)
     ↑ scrape every 15s
Prometheus Server (stores time-series data)
     ↑ query (PromQL)
Grafana (dashboards)
  or
HPA (autoscaling)
  or
Alertmanager (alerts)
```

1. Your app exposes a `/metrics` endpoint in Prometheus format
2. Prometheus scrapes that endpoint on a schedule (default: every 15s)
3. Data is stored as time-series (metric name + labels + timestamp + value)
4. You query the data using PromQL
5. Grafana visualizes it, Alertmanager fires alerts on it

### Deploy Prometheus in kind

We'll use the kube-prometheus-stack Helm chart, which installs Prometheus,
Grafana, and Alertmanager together:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword=admin
```

Wait for everything to come up:

```bash
kubectl wait --for=condition=ready pods --all -n monitoring --timeout=300s
```

### Access Prometheus UI

```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```

Open `http://localhost:9090` in your browser.

### PromQL Basics

PromQL is the query language for Prometheus. Think of it as SQL for time-series.

**Get a raw metric**:
```
container_cpu_usage_seconds_total
```

**Filter by label**:
```
container_cpu_usage_seconds_total{namespace="default"}
```

**Rate of change** (most useful for counters):
```
rate(container_cpu_usage_seconds_total{namespace="default"}[5m])
```

"How many CPU seconds per second (i.e., CPU cores) were used in the last 5
minutes?"

**Aggregate across Pods**:
```
sum(rate(container_cpu_usage_seconds_total{namespace="default"}[5m])) by (pod)
```

**Common queries for Kubernetes**:

CPU usage per Pod:
```
sum(rate(container_cpu_usage_seconds_total{namespace="default", container!=""}[5m])) by (pod)
```

Memory usage per Pod:
```
sum(container_memory_working_set_bytes{namespace="default", container!=""}) by (pod)
```

Pod restart count:
```
kube_pod_container_status_restarts_total{namespace="default"}
```

Number of running Pods per Deployment:
```
kube_deployment_status_replicas_available
```

---

## Instrumenting Your Application

### Go Application with Prometheus Metrics

```go
package main

import (
	"math/rand"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	activeConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "active_connections",
			Help: "Number of active connections",
		},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
	prometheus.MustRegister(activeConnections)
}

func main() {
	http.Handle("/metrics", promhttp.Handler())

	http.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		activeConnections.Inc()
		defer activeConnections.Dec()

		time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"users": []}`))

		duration := time.Since(start).Seconds()
		httpRequestsTotal.WithLabelValues(r.Method, "/api/users", "200").Inc()
		httpRequestDuration.WithLabelValues(r.Method, "/api/users").Observe(duration)
	})

	http.ListenAndServe(":8080", nil)
}
```

### TypeScript Application with Prometheus Metrics

```typescript
import express from "express";
import promClient from "prom-client";

const httpRequestsTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status"],
});

const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "path"],
  buckets: promClient.exponentialBuckets(0.001, 2, 15),
});

const activeConnections = new promClient.Gauge({
  name: "active_connections",
  help: "Active connections",
});

promClient.collectDefaultMetrics();

const app = express();

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.get("/api/users", (_req, res) => {
  const end = httpRequestDuration.startTimer({ method: "GET", path: "/api/users" });
  activeConnections.inc();

  setTimeout(() => {
    res.json({ users: [] });
    httpRequestsTotal.inc({ method: "GET", path: "/api/users", status: "200" });
    activeConnections.dec();
    end();
  }, Math.random() * 100);
});

app.listen(8080);
```

### Tell Prometheus to Scrape Your App

Create a ServiceMonitor (the Prometheus Operator way):

```yaml
# file: service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-metrics
  namespace: default
  labels:
    release: monitoring
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
  - port: http
    interval: 15s
    path: /metrics
```

Or use Pod annotations (the classic way):

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
```

---

## Grafana: Dashboards

Grafana turns Prometheus data into visual dashboards.

### Access Grafana

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

Login at `http://localhost:3000` with `admin`/`admin`.

### Pre-Built Dashboards

The kube-prometheus-stack includes dashboards for:
- Cluster overview (CPU, memory, network across all nodes)
- Namespace resource usage
- Pod-level metrics
- Node-level metrics
- API server performance

### Creating a Dashboard for Your App

1. Click "+" → "New Dashboard" → "Add visualization"
2. Select the Prometheus data source
3. Add panels:

**Request Rate**:
```
sum(rate(http_requests_total{namespace="default"}[5m])) by (path)
```

**Error Rate**:
```
sum(rate(http_requests_total{namespace="default", status=~"5.."}[5m]))
  /
sum(rate(http_requests_total{namespace="default"}[5m]))
```

**P95 Latency**:
```
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="default"}[5m])) by (le, path))
```

**Active Connections**:
```
active_connections{namespace="default"}
```

### The RED Method

For every service, track three things:

- **R**ate — requests per second
- **E**rrors — error rate (percentage of requests that fail)
- **D**uration — latency distribution (p50, p95, p99)

```
Rate:     sum(rate(http_requests_total[5m]))
Errors:   sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
Duration: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

This gives you a complete picture of your service's health at a glance.

---

## Logging

### Where Do Kubernetes Logs Live?

Every container writes to stdout and stderr. Kubernetes captures these and
stores them on the node's filesystem:

```
/var/log/containers/<pod-name>_<namespace>_<container-name>-<container-id>.log
```

### kubectl logs

The simplest way to read logs:

```bash
kubectl logs deploy/myapp

kubectl logs deploy/myapp --previous

kubectl logs deploy/myapp -f

kubectl logs deploy/myapp --since=10m

kubectl logs deploy/myapp --tail=100

kubectl logs deploy/myapp -c sidecar
```

### The Problem with kubectl logs

`kubectl logs` only works for running Pods. When a Pod dies, its logs may
disappear. And you can't search across all Pods or correlate logs from
different services. You need a centralized logging system.

### Logging Architecture

```
Pod stdout/stderr → Node filesystem → Log collector (DaemonSet) → Central store → Query UI
```

Common stacks:

| Collector | Store | Query UI |
|-----------|-------|----------|
| Fluent Bit | Elasticsearch | Kibana |
| Fluent Bit | Loki | Grafana |
| Fluentd | Elasticsearch | Kibana |
| Vector | ClickHouse | Grafana |

### Loki: The Prometheus of Logs

Loki is designed to work with Grafana and follows similar principles to
Prometheus — it indexes log metadata (labels) rather than the full text,
making it much cheaper to run than Elasticsearch.

Install Loki with the Helm chart:

```bash
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set promtail.enabled=true \
  --set loki.persistence.enabled=false
```

Promtail is a log collector that runs as a DaemonSet (one per node), reads
container logs from the node filesystem, and ships them to Loki.

### Structured Logging

Always use structured (JSON) logging in your apps. This makes logs searchable
and parseable.

**Go**:
```go
slog.Info("request handled",
    "method", r.Method,
    "path", r.URL.Path,
    "status", statusCode,
    "duration_ms", duration.Milliseconds(),
    "trace_id", traceID,
)
```

Output:
```json
{"time":"2024-01-15T10:30:00Z","level":"INFO","msg":"request handled","method":"GET","path":"/api/users","status":200,"duration_ms":45,"trace_id":"abc123"}
```

**TypeScript**:
```typescript
logger.info({
  msg: "request handled",
  method: req.method,
  path: req.path,
  status: res.statusCode,
  durationMs: Date.now() - startTime,
  traceId: req.headers["x-trace-id"],
});
```

### Log Levels

Use consistent log levels:

| Level | When to Use |
|-------|-------------|
| ERROR | Something failed. Needs attention. Alert-worthy. |
| WARN | Something unexpected but handled. Monitor it. |
| INFO | Normal operations. Request handled, job completed. |
| DEBUG | Detailed diagnostic info. Off in production. |

---

## Distributed Tracing

### Why Traces Matter

A user request hits your API gateway, which calls the auth service, which
calls the user service, which calls the database. The total request takes 2
seconds. Which service is slow?

Without tracing, you're guessing. With tracing, you see:

```
[API Gateway]  ─────────────────────────── 2000ms
  [Auth Service] ──── 50ms
  [User Service]      ──────────── 1800ms
    [Database Query]    ────────── 1750ms
```

The database query is the bottleneck. Obvious.

### How Tracing Works

1. The first service creates a **trace ID** and a **span** (the root span)
2. When it calls another service, it passes the trace ID in an HTTP header
   (`traceparent` or `X-B3-TraceId`)
3. Each service creates its own span with the same trace ID
4. All spans are sent to a tracing backend (Jaeger, Zipkin, Tempo)
5. The backend reconstructs the full trace from the spans

### OpenTelemetry

OpenTelemetry (OTel) is the standard for instrumentation. It provides SDKs for
Go, TypeScript, Python, Java, and more.

**Go with OpenTelemetry**:

```go
import (
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

func handleRequest(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("myapp").Start(r.Context(), "handleRequest")
	defer span.End()

	users, err := fetchUsers(ctx)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		http.Error(w, "internal error", 500)
		return
	}

	json.NewEncoder(w).Encode(users)
}

func fetchUsers(ctx context.Context) ([]User, error) {
	_, span := otel.Tracer("myapp").Start(ctx, "fetchUsers")
	defer span.End()

	span.SetAttributes(attribute.String("db.system", "postgresql"))
	return db.QueryUsers(ctx)
}
```

**TypeScript with OpenTelemetry**:

```typescript
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("myapp");

app.get("/api/users", async (req, res) => {
  const span = tracer.startSpan("handleRequest");
  try {
    const users = await tracer.startActiveSpan("fetchUsers", async (dbSpan) => {
      dbSpan.setAttribute("db.system", "postgresql");
      const result = await db.query("SELECT * FROM users");
      dbSpan.end();
      return result;
    });
    res.json(users);
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    res.status(500).json({ error: "internal error" });
  } finally {
    span.end();
  }
});
```

### Tracing Backends

| Backend | Description |
|---------|-------------|
| **Jaeger** | Full-featured, CNCF graduated, good UI |
| **Zipkin** | Simpler, lighter, compatible with Jaeger |
| **Grafana Tempo** | Integrates with Grafana, cost-effective |

---

## Connecting All Three Pillars

The real power comes from connecting metrics, logs, and traces:

1. **Alert fires** (metric): "Error rate above 5% for the last 5 minutes"
2. **Check dashboard** (metrics): which endpoint has high errors?
   `/api/payments`
3. **Search logs** (logs): filter by `path=/api/payments` and `level=ERROR`.
   Find: "payment gateway timeout"
4. **Find trace** (traces): look up the trace ID from the error log. See that
   the payment-gateway service takes 30 seconds to respond.
5. **Root cause**: the payment gateway is overloaded.

### Correlating with Trace IDs

The key to connecting all three is the **trace ID**. Include it in:
- **Metrics labels**: `http_requests_total{trace_id="abc123"}`
- **Log entries**: `{"trace_id": "abc123", "msg": "payment failed"}`
- **Trace spans**: automatically included

In Grafana, you can click from a metric → to logs filtered by time range → to
the trace that caused the error.

---

## Kubernetes Events

Don't forget about Kubernetes-native events:

```bash
kubectl get events --sort-by=.metadata.creationTimestamp
```

```
LAST SEEN   TYPE      REASON              OBJECT                 MESSAGE
30s         Normal    Scheduled           pod/myapp-abc          Successfully assigned...
29s         Normal    Pulling             pod/myapp-abc          Pulling image "myapp:v2"
25s         Normal    Pulled              pod/myapp-abc          Successfully pulled image
25s         Normal    Created             pod/myapp-abc          Created container myapp
24s         Normal    Started             pod/myapp-abc          Started container myapp
5s          Warning   BackOff             pod/myapp-abc          Back-off restarting failed container
```

Events are the "security camera footage" of your cluster. They show what
Kubernetes itself did and why. They're ephemeral (default retention: 1 hour),
so for production, export them to your logging system.

---

## Exercises

### Exercise 1: Prometheus Exploration

1. Install kube-prometheus-stack in your kind cluster
2. Port-forward to the Prometheus UI
3. Write PromQL queries for:
   - Total CPU usage across all Pods
   - Memory usage per namespace
   - Pod restart count in the last hour
   - API server request rate
4. Explore the pre-built targets and see what Prometheus is scraping

### Exercise 2: Build a Dashboard

1. Access Grafana
2. Create a dashboard with four panels:
   - Cluster CPU usage (%) over time
   - Cluster memory usage (%) over time
   - Number of Pods per namespace
   - Pod restarts in the last 24 hours
3. Set up a 30-second auto-refresh
4. Export the dashboard as JSON for version control

### Exercise 3: Application Instrumentation

1. Deploy a simple HTTP server (use any language)
2. Add Prometheus metrics: request count, latency histogram, error counter
3. Create a ServiceMonitor to tell Prometheus to scrape it
4. Verify the metrics appear in Prometheus
5. Create a Grafana dashboard showing RED metrics for your app
6. Generate load and watch the dashboard update

### Exercise 4: Log Aggregation

1. Deploy 3 replicas of an app that logs in JSON format
2. Generate varied traffic (200s, 400s, 500s)
3. Use `kubectl logs` to find errors (painful across 3 replicas)
4. Install Loki + Promtail
5. Query logs in Grafana — filter by namespace, Pod, log level
6. Compare the experience

### Exercise 5: End-to-End Debugging

1. Deploy a two-service app (frontend calls backend)
2. Instrument both with metrics and structured logging
3. Introduce a bug in the backend (random 500 errors, 10% of the time)
4. Using only the observability stack, find:
   - Which service has errors (metrics)
   - What the error message is (logs)
   - Which specific requests failed (trace IDs in logs)
5. Fix the bug and verify through the same observability tools

---

## What Would Happen If...

**Q: Prometheus itself runs out of disk space?**
A: Prometheus stops ingesting new data. Old data is still queryable until it's
expired. The HPA stops scaling (no metrics). Alerts stop firing. This is why
Prometheus storage must be monitored (meta-monitoring). Set up alerting on
Prometheus's own `prometheus_tsdb_storage_*` metrics.

**Q: Your Pods don't have a /metrics endpoint?**
A: Prometheus scrapes fail silently. You'll see `target down` in the Prometheus
UI. The HPA can't use custom metrics. You lose visibility into your app's
behavior and are left with only infrastructure metrics.

**Q: Logs fill up the node's disk?**
A: The kubelet has log rotation built-in (default: 10Mi per container, 5 files).
But if logs are extremely verbose, they can still fill disk before rotation
kicks in. Use `resources.limits` and log volume monitoring. Some CNI/runtime
configurations also enforce log quotas.

**Q: You have 100 microservices but no tracing?**
A: Debugging cross-service issues becomes guesswork. You check logs in each
service hoping to correlate by timestamp. This doesn't scale. Tracing is
essential for microservices architectures.

---

## Key Takeaways

1. **Three pillars**: metrics (what's happening now), logs (what happened),
   traces (how a request flows)
2. **Prometheus** is the standard for metrics in Kubernetes — scrape-based,
   PromQL queries, integrates with HPA
3. **Grafana** visualizes everything — Prometheus metrics, Loki logs, Tempo
   traces
4. **Structured JSON logging** is non-negotiable for production
5. **OpenTelemetry** is the standard for instrumenting Go/TypeScript apps
6. **RED method**: Rate, Errors, Duration — the three metrics every service
   needs
7. **Trace IDs connect the pillars**: from metric alert → to error logs → to
   the exact failing trace
8. **kubectl top** and **kubectl get events** are your quick-check tools before
   diving into the full observability stack

---

## Cleanup

```bash
helm uninstall monitoring -n monitoring 2>/dev/null
helm uninstall loki -n monitoring 2>/dev/null
kubectl delete namespace monitoring 2>/dev/null
kind delete cluster --name observability-lab
```

---

Next: [Lesson 20: Debugging Kubernetes →](./20-debugging.md)
