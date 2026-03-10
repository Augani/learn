# Lesson 08: The Three Pillars Together

## The Doctor's Toolkit

A doctor does not rely on one tool. They use vital signs (metrics), patient history notes (logs), and imaging scans (traces) together. Each tells a different part of the story. Combined, they form a diagnosis.

```
METRICS              LOGS                 TRACES
(Vital Signs)        (Medical Notes)      (Body Scan)

Heart rate: 120      "Patient reports     Scan shows
BP: 150/95           chest pain at 2pm,   blockage in
Temp: 98.6           radiating to left    left coronary
O2: 97%              arm. Aspirin given." artery.

"Something is        "Here is what        "Here is
 wrong"              happened"            exactly where"
```

## What Each Pillar Tells You

```
+----------------------------------------------------------+
|  SIGNAL   | ANSWERS                  | EXAMPLE            |
+----------------------------------------------------------+
|  METRICS  | Is something wrong?      | Error rate spiked  |
|           | How bad is it?           | to 5% at 14:32     |
|           | Is it getting worse?     |                    |
+----------------------------------------------------------+
|  LOGS     | What happened?           | "Connection refused |
|           | In what context?         |  to db-primary at  |
|           | What was the error?      |  14:32:05"         |
+----------------------------------------------------------+
|  TRACES   | Where in the system?     | Span shows 30s     |
|           | Which service is slow?   | timeout on DB call  |
|           | What is the call path?   | in order-service    |
+----------------------------------------------------------+
```

## Correlating Signals

The real power is linking them together. A trace ID is the thread that connects all three:

```
1. METRIC ALERT fires: "Error rate > 1% on checkout-service"
        |
        | "Let me look at the logs..."
        v
2. LOGS filtered by service=checkout, level=error, time=14:30-14:35
   --> {"trace_id":"abc-123", "error":"payment_timeout", ...}
        |
        | "Let me see the full trace..."
        v
3. TRACE abc-123 shows:
   checkout-service --> payment-service --> stripe-api (TIMEOUT 30s)
        |
        | "Stripe is slow. Let me check their metrics..."
        v
4. METRICS for stripe-api calls: p99 latency jumped from 200ms to 30s
   at 14:28. Correlates with Stripe status page incident.
        |
        v
5. ROOT CAUSE: External dependency degradation
```

```
THE CORRELATION FLOW

+--------+     trace_id     +--------+     trace_id     +--------+
|METRICS | ===============> |  LOGS  | ===============> | TRACES |
|        |                  |        |                  |        |
| "What  |                  | "What  |                  | "Where |
|  is    | <=============== |  hap-  | <=============== |  exactly|
|  wrong"|    exemplars     |  pened"|    span context  |  is it?"|
+--------+                  +--------+                  +--------+
```

## Exemplars: Linking Metrics to Traces

An exemplar is a specific trace ID attached to a metric data point. When a metric spikes, you can jump directly to an example trace.

```
ERROR RATE GRAPH
  5% |            *
     |           * *
  2% |       *  *   *
  1% |  * *  *       * *
     +--+--+--+--+--+--+--> Time
           ^
           |
     This data point has an exemplar:
     trace_id = "abc-123-def-456"

     Click it --> Jump to trace view
     --> See exactly what went wrong in that request
```

### Prometheus Exemplar Configuration

```go
requestDuration.With(prometheus.Labels{
    "method": "POST",
    "path":   "/checkout",
}).Observe(duration.Seconds())
```

```promql
# Query with exemplars in Grafana
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

In Grafana, enable "Exemplars" toggle on the panel to see trace links on the graph.

## Building an Observability Pipeline

```
+-----+  +-----+  +-----+
| App |  | App |  | App |
|  1  |  |  2  |  |  3  |
+--+--+  +--+--+  +--+--+
   |        |        |
   v        v        v
+------------------------------+
|     OTel Collector           |
|  (Receives all signals)      |
|                              |
|  +--------+ +------+ +----+ |
|  | Traces | |Metrics| |Logs| |
|  +---+----+ +--+---+ +-+--+ |
+------|---------|--------|----+
       |         |        |
       v         v        v
  +---------+ +------+ +------+
  | Tempo / | |Prom/ | |Loki/ |
  | Jaeger  | |Mimir | |Elastic|
  +---------+ +------+ +------+
       |         |        |
       +----+----+--------+
            |
            v
      +-----------+
      |  Grafana  |
      | (Unified  |
      |  View)    |
      +-----------+
```

### OTel Collector for All Three Signals

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s

  resource:
    attributes:
      - key: environment
        value: production
        action: upsert

exporters:
  otlp/tempo:
    endpoint: "tempo:4317"

  prometheusremotewrite:
    endpoint: "http://mimir:9009/api/v1/push"

  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [otlp/tempo]

    metrics:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [prometheusremotewrite]

    logs:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [loki]
```

## The Investigation Workflow

```
INCIDENT INVESTIGATION PATTERN

  STEP 1: DETECT (Metrics)
  +------------------------------------------+
  | Alert: "p99 latency > 2s on order-svc"  |
  | Dashboard shows spike starting 14:28     |
  +------------------------------------------+
              |
              v
  STEP 2: SCOPE (Metrics + Logs)
  +------------------------------------------+
  | Which endpoints? /checkout (not /browse) |
  | Which pods? pod-3 and pod-7 only         |
  | Error type? "connection_timeout"          |
  +------------------------------------------+
              |
              v
  STEP 3: TRACE (Traces)
  +------------------------------------------+
  | Pick an exemplar trace from the spike    |
  | Trace shows: order-svc -> payment-svc    |
  |   -> DB call taking 28 seconds           |
  +------------------------------------------+
              |
              v
  STEP 4: DIAGNOSE (Logs + Traces)
  +------------------------------------------+
  | DB logs show: "max connections reached"  |
  | payment-svc logs: "connection pool       |
  |   exhausted, waiting for available conn" |
  +------------------------------------------+
              |
              v
  STEP 5: RESOLVE
  +------------------------------------------+
  | Increase DB connection pool limit        |
  | Scale payment-svc replicas               |
  | Add circuit breaker for DB calls         |
  +------------------------------------------+
```

## Grafana: Unified Observability

Grafana can query all three backends from one dashboard:

```
GRAFANA DASHBOARD WITH CORRELATED SIGNALS

+----------------------------------------------------------+
| Service: checkout-api           Time: Last 1 hour        |
+----------------------------------------------------------+
|                                                          |
| METRICS (Prometheus/Mimir)                               |
| [Request Rate Graph]  [Error Rate Graph]  [Latency Graph]|
|                            ^                             |
|                            | exemplar link               |
| TRACES (Tempo/Jaeger)      |                             |
| [Trace ID: abc-123]  [Span Timeline View]                |
|                            |                             |
|                            | trace_id filter             |
| LOGS (Loki)                v                             |
| [Filtered log lines for trace_id=abc-123]                |
|                                                          |
+----------------------------------------------------------+
```

### Grafana Data Source Links

In Grafana, you set up "derived fields" in Loki to link trace IDs to Tempo:

```yaml
# In Grafana Loki data source config
derivedFields:
  - name: TraceID
    matcherRegex: "trace_id=(\\w+)"
    url: "$${__value.raw}"
    datasourceUid: tempo-datasource
```

## Beyond Three Pillars: Events and Profiles

Modern observability adds more signals:

```
+----------+  +--------+  +--------+  +--------+  +----------+
| Metrics  |  |  Logs  |  | Traces |  | Events |  | Profiles |
+----------+  +--------+  +--------+  +--------+  +----------+
| Numbers  |  | Text   |  | Spans  |  | Deploy |  | CPU flame|
| over     |  | entries|  | across |  | config |  | Memory   |
| time     |  |        |  | svc    |  | change |  | allocation|
+----------+  +--------+  +--------+  +--------+  +----------+

Events: Deployment markers, config changes, feature flag toggles
Profiles: Continuous profiling (CPU, memory, goroutines)
```

## Anti-Patterns

```
ANTI-PATTERN 1: "Three silos, not three pillars"
  Metrics team uses Datadog
  Logging team uses Splunk
  Tracing team uses Honeycomb
  --> No correlation between them. Just expensive tools.

ANTI-PATTERN 2: "Metrics-only observability"
  "We have Grafana dashboards!"
  --> But when something breaks, you cannot explain WHY.

ANTI-PATTERN 3: "Trace everything, query nothing"
  100% sampling, petabytes of traces stored.
  --> No one looks at them. $50k/month in storage.

ANTI-PATTERN 4: "Log and pray"
  Console.log everywhere, no structure, no correlation.
  --> Searching logs takes longer than the outage.
```

## Exercises

1. **Correlation walkthrough**: Describe how you would investigate this alert using all three pillars: "Checkout success rate dropped to 94% at 15:00 UTC." Write out each step, what signal you use, and what query you run.

2. **Pipeline design**: Design an observability pipeline for a system with 5 microservices. Draw the architecture showing how metrics, logs, and traces flow from applications to storage to visualization.

3. **OTel Collector config**: Write a complete OTel Collector configuration that receives OTLP data and exports traces to Tempo, metrics to Prometheus remote write, and logs to Loki. Include a batch processor and a resource processor that adds an environment label.

4. **Exemplar setup**: Explain how you would set up exemplars in Prometheus so that when an error rate metric spikes, you can click through to a specific trace in Jaeger or Tempo.

5. **Cost analysis**: Your observability stack costs $10,000/month. Metrics are 20%, logs are 60%, traces are 20%. Logs are mostly debug-level from one chatty service. Design a plan to cut costs by 40% without losing visibility into errors and performance.

---

[Next: Lesson 09 - Alerting -->](09-alerting.md)
