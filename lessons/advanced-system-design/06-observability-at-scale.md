# Lesson 6: Observability at Scale

> Monitoring tells you THAT something is wrong.
> Observability tells you WHY.

---

## The Analogy

A doctor monitoring a patient's heart rate is monitoring.
If the heart rate spikes, they know something is wrong — but not
what. They need blood work, imaging, patient history, and the
ability to ask new questions they didn't plan for.

That's the difference between monitoring and observability.
Monitoring is dashboards with predefined metrics. Observability
is the ability to understand any system state by examining its
outputs — even states you never anticipated.

At scale, this distinction matters enormously. You can't
predefine a dashboard for every failure mode of a system with
500 microservices, 50 databases, and 200 million daily requests.
You need the ability to ask arbitrary questions about your system
in production.

---

## The Three Pillars (And Why They're Not Enough)

```
  ┌─────────┐    ┌──────────┐    ┌──────────────┐
  │  Logs   │    │ Metrics  │    │   Traces     │
  │         │    │          │    │              │
  │ What    │    │ Aggregate│    │ Per-request  │
  │ happened│    │ numbers  │    │ journey      │
  │ (text)  │    │ over time│    │ across       │
  │         │    │          │    │ services     │
  └─────────┘    └──────────┘    └──────────────┘

  This is the traditional model. It's incomplete.

  Missing:
  - Events (structured records of significant occurrences)
  - Profiles (CPU, memory, goroutine analysis)
  - Exceptions (structured error tracking)
  - User sessions (request sequences from a single user)
```

### What Each Pillar Actually Costs at Scale

```
  ┌──────────┬───────────────────┬──────────────────┬────────────┐
  │ Signal   │ Volume (1M RPM)   │ Monthly Cost     │ Retention  │
  ├──────────┼───────────────────┼──────────────────┼────────────┤
  │ Logs     │ ~10 TB/day        │ $30K-100K (DD)   │ 15-30 days │
  │ Metrics  │ ~50K time series  │ $5K-20K          │ 13 months  │
  │ Traces   │ ~100M spans/day   │ $10K-50K         │ 15 days    │
  └──────────┴───────────────────┴──────────────────┴────────────┘

  These numbers are real. Observability at scale is a
  significant line item in your infrastructure budget.
  A medium-sized company can easily spend $500K-2M/year.
```

---

## Distributed Tracing Architecture

A trace follows a single request across every service it touches:

```
  User Request (trace_id: abc-123)

  ┌─────────────── 250ms total ─────────────────────────┐
  │ API Gateway [span 1]                                │
  │  ├── Auth Service [span 2]  ██ 20ms                 │
  │  ├── Order Service [span 3] ████████ 80ms           │
  │  │    ├── Inventory [span 4]  ███ 30ms              │
  │  │    ├── Pricing [span 5]    ██ 15ms               │
  │  │    └── DB Query [span 6]   █ 10ms                │
  │  └── Payment Service [span 7] █████████████ 130ms   │
  │       ├── Fraud Check [span 8]  ████ 40ms           │
  │       ├── Card Network [span 9] ████████ 80ms       │
  │       └── DB Write [span 10]    █ 8ms               │
  └─────────────────────────────────────────────────────┘

  This trace tells you:
  - Payment service is the bottleneck (130ms / 250ms)
  - Card network call dominates payment time
  - If this request was slow, you know exactly where
```

### Trace Propagation

Every service must propagate trace context:

```go
import (
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

func OrderHandler(w http.ResponseWriter, r *http.Request) {
	ctx := otel.GetTextMapPropagator().Extract(r.Context(),
		propagation.HeaderCarrier(r.Header))

	tracer := otel.Tracer("order-service")
	ctx, span := tracer.Start(ctx, "CreateOrder",
		trace.WithAttributes(
			attribute.String("order.customer_id", customerID),
			attribute.Int("order.item_count", len(items)),
		))
	defer span.End()

	inventoryResult, err := callInventoryService(ctx, items)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "inventory check failed")
		http.Error(w, "inventory error", http.StatusServiceUnavailable)
		return
	}

	span.AddEvent("inventory_checked", trace.WithAttributes(
		attribute.Bool("all_available", inventoryResult.AllAvailable),
	))
}

func callInventoryService(ctx context.Context, items []Item) (*InventoryResult, error) {
	tracer := otel.Tracer("order-service")
	ctx, span := tracer.Start(ctx, "CheckInventory")
	defer span.End()

	req, _ := http.NewRequestWithContext(ctx, "POST", inventoryURL, body)

	otel.GetTextMapPropagator().Inject(ctx,
		propagation.HeaderCarrier(req.Header))

	resp, err := httpClient.Do(req)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))
	return parseResponse(resp)
}
```

### Sampling Strategies

You can't trace every request at scale. Sampling is essential:

```
  ┌─────────────────┬─────────────┬─────────────────────┐
  │ Strategy        │ How It Works│ When to Use          │
  ├─────────────────┼─────────────┼─────────────────────┤
  │ Head-based      │ Decide at   │ Simple, predictable  │
  │ (probabilistic) │ request     │ cost. Miss rare      │
  │                 │ entry (10%) │ errors.              │
  ├─────────────────┼─────────────┼─────────────────────┤
  │ Tail-based      │ Decide after│ Captures all errors  │
  │                 │ request     │ and slow requests.   │
  │                 │ completes   │ Expensive collector.  │
  ├─────────────────┼─────────────┼─────────────────────┤
  │ Error-biased    │ Always trace│ Best error coverage. │
  │                 │ errors. 1%  │ Cost-effective.      │
  │                 │ of success  │                      │
  ├─────────────────┼─────────────┼─────────────────────┤
  │ Priority-based  │ Higher rate │ Critical paths get   │
  │                 │ for critical│ full coverage.       │
  │                 │ endpoints   │                      │
  └─────────────────┴─────────────┴─────────────────────┘
```

```go
type PrioritySampler struct {
	criticalPaths map[string]float64
	defaultRate   float64
}

func (s *PrioritySampler) ShouldSample(params trace.SamplingParameters) trace.SamplingResult {
	spanName := params.Name

	rate := s.defaultRate
	if pathRate, exists := s.criticalPaths[spanName]; exists {
		rate = pathRate
	}

	if rand.Float64() < rate {
		return trace.SamplingResult{Decision: trace.RecordAndSample}
	}
	return trace.SamplingResult{Decision: trace.Drop}
}

sampler := &PrioritySampler{
	defaultRate: 0.01,
	criticalPaths: map[string]float64{
		"ProcessPayment":  1.0,
		"CreateOrder":     0.1,
		"HealthCheck":     0.001,
	},
}
```

---

## Log Aggregation at Petabyte Scale

### The Cost Problem

At 10TB/day of logs, storing everything in Datadog or Splunk
costs a fortune. The solution: tiered logging.

```
  Tier 1: Hot (searchable, 7 days)
  - Error logs, request logs for critical services
  - Stored in Elasticsearch / Loki / Datadog
  - Cost: $$$

  Tier 2: Warm (searchable with delay, 30 days)
  - Info logs, audit logs
  - Stored in S3 + Athena / BigQuery
  - Cost: $$

  Tier 3: Cold (archival, 1+ years)
  - All logs compressed
  - Stored in S3 Glacier / GCS Coldline
  - Cost: $

  ┌───────────────┐
  │  Application  │
  │  (structured  │
  │   JSON logs)  │
  └──────┬────────┘
         │
  ┌──────▼────────┐
  │   Log Router  │──────> Tier 1 (Elasticsearch)
  │   (Vector /   │──────> Tier 2 (S3 + Athena)
  │    Fluentbit) │──────> Tier 3 (S3 Glacier)
  └───────────────┘
```

### Structured Logging

Unstructured logs are useless at scale. You can't search
"error processing request" across 10TB/day.

```go
type RequestLog struct {
	Timestamp   time.Time         `json:"ts"`
	Level       string            `json:"level"`
	Service     string            `json:"service"`
	TraceID     string            `json:"trace_id"`
	SpanID      string            `json:"span_id"`
	Method      string            `json:"method"`
	Path        string            `json:"path"`
	StatusCode  int               `json:"status"`
	DurationMs  float64           `json:"duration_ms"`
	UserID      string            `json:"user_id,omitempty"`
	Error       string            `json:"error,omitempty"`
	Attributes  map[string]string `json:"attrs,omitempty"`
}

func LogRequest(r *http.Request, statusCode int, duration time.Duration, err error) {
	log := RequestLog{
		Timestamp:  time.Now().UTC(),
		Level:      levelForStatus(statusCode),
		Service:    "order-service",
		TraceID:    trace.SpanFromContext(r.Context()).SpanContext().TraceID().String(),
		SpanID:     trace.SpanFromContext(r.Context()).SpanContext().SpanID().String(),
		Method:     r.Method,
		Path:       r.URL.Path,
		StatusCode: statusCode,
		DurationMs: float64(duration.Microseconds()) / 1000.0,
		UserID:     getUserID(r),
	}

	if err != nil {
		log.Error = err.Error()
	}

	jsonBytes, _ := json.Marshal(log)
	fmt.Println(string(jsonBytes))
}
```

Every log line should have `trace_id` so you can correlate logs
with traces. This is the single most useful observability practice.

---

## Custom Metrics and SLIs

### The RED Method (for services)

```
  R - Rate:     Requests per second
  E - Errors:   Error rate (% of requests that fail)
  D - Duration: Latency distribution (p50, p95, p99)

  Every service should expose RED metrics.
```

### The USE Method (for resources)

```
  U - Utilization: % of resource capacity in use
  S - Saturation:  Queue depth, waiters
  E - Errors:      Error count for the resource

  Every resource (CPU, memory, disk, connection pool)
  should expose USE metrics.
```

### SLI/SLO Implementation

```go
var (
	requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration",
			Buckets: []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0},
		},
		[]string{"service", "method", "path", "status_class"},
	)

	requestTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests",
		},
		[]string{"service", "method", "path", "status_class"},
	)
)

func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, statusCode: 200}

		next.ServeHTTP(recorder, r)

		duration := time.Since(start).Seconds()
		statusClass := fmt.Sprintf("%dxx", recorder.statusCode/100)
		path := normalizePath(r.URL.Path)

		requestDuration.WithLabelValues("order-service", r.Method, path, statusClass).Observe(duration)
		requestTotal.WithLabelValues("order-service", r.Method, path, statusClass).Inc()
	})
}
```

### SLO Definition in Prometheus

```yaml
groups:
  - name: slos
    rules:
      - record: sli:availability:ratio_rate5m
        expr: |
          sum(rate(http_requests_total{status_class!="5xx"}[5m]))
          /
          sum(rate(http_requests_total[5m]))

      - record: sli:latency:p99_5m
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m]))
            by (le))

      - alert: SLOAvailabilityBreach
        expr: sli:availability:ratio_rate5m < 0.999
        for: 5m
        labels:
          severity: page
        annotations:
          summary: "Availability SLO breach: {{ $value | humanizePercentage }}"

      - alert: SLOLatencyBreach
        expr: sli:latency:p99_5m > 0.5
        for: 5m
        labels:
          severity: page
        annotations:
          summary: "P99 latency SLO breach: {{ $value }}s"
```

---

## Anomaly Detection

Dashboards don't scale. With 50,000 time series, no human can
watch them all. You need automated anomaly detection.

```
  Static thresholds (Level 1):
  Alert if error_rate > 5%
  Alert if p99_latency > 500ms

  Problem: What about gradual degradation?
  Error rate creeping from 0.1% to 2% over 6 hours
  won't trigger a 5% threshold.


  Dynamic thresholds (Level 2):
  Alert if metric deviates > 3 standard deviations
  from its rolling 7-day average

  Problem: Seasonal patterns (Monday != Saturday)


  ML-based anomaly detection (Level 3):
  Train models on historical patterns
  Account for time-of-day, day-of-week, holidays
  Alert on anomalous *combinations* of metrics

  Problem: False positives, training data, complexity
```

### Practical Anomaly Detection

Start with Level 2. It catches 80% of issues:

```yaml
groups:
  - name: anomaly_detection
    rules:
      - record: metric:error_rate:avg_over_time_7d
        expr: avg_over_time(sli:availability:ratio_rate5m[7d])

      - record: metric:error_rate:stddev_over_time_7d
        expr: stddev_over_time(sli:availability:ratio_rate5m[7d])

      - alert: ErrorRateAnomaly
        expr: |
          (
            sli:availability:ratio_rate5m
            - metric:error_rate:avg_over_time_7d
          )
          / metric:error_rate:stddev_over_time_7d
          < -3
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Error rate is 3+ std devs above normal"
```

---

## The Cost of Observability

```
  Common cost traps:

  1. High-cardinality labels
     BAD:  request_duration{user_id="12345"}
     GOOD: request_duration{customer_tier="enterprise"}
     (user_id creates millions of time series)

  2. Logging everything at DEBUG level
     BAD:  log.Debug("Processing item", item)  (in a loop)
     GOOD: Sample debug logs or use dynamic log levels

  3. Tracing every request
     BAD:  100% sampling on health checks
     GOOD: 0.1% on health checks, 100% on errors

  4. Retaining everything forever
     BAD:  90-day retention on all metrics
     GOOD: 7 days hot, 30 days warm, 1 year cold
```

### Cost Optimization Strategies

```
  ┌─────────────────────────┬────────────┬────────────────┐
  │ Strategy                │ Savings    │ Tradeoff       │
  ├─────────────────────────┼────────────┼────────────────┤
  │ Reduce log verbosity    │ 30-50%     │ Less debug info│
  │ Trace sampling (10%)    │ 90%        │ Miss some spans│
  │ Metric aggregation      │ 40-60%     │ Less granular  │
  │ Tiered retention        │ 50-70%     │ Slower queries │
  │ Self-hosted (Grafana    │ 60-80%     │ Ops burden     │
  │  stack)                 │            │                │
  └─────────────────────────┴────────────┴────────────────┘
```

---

## Observability Architecture at Scale

```
  ┌──────────────────────────────────────────────────────────────┐
  │                     Applications (500 services)               │
  │  [OTel SDK] ──> traces, metrics, logs                        │
  └──────────┬───────────────────────────────────────────────────┘
             │
  ┌──────────▼───────────────────────────────────────────────────┐
  │                  OpenTelemetry Collector                      │
  │  (sampling, filtering, routing, enrichment)                  │
  └──────┬──────────┬──────────┬──────────┬─────────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
  ┌──────────┐ ┌─────────┐ ┌──────┐ ┌───────────┐
  │  Tempo   │ │ Mimir   │ │ Loki │ │ S3 (cold) │
  │ (traces) │ │(metrics)│ │(logs)│ │           │
  └──────────┘ └─────────┘ └──────┘ └───────────┘
         │          │          │
         └──────────┼──────────┘
                    ▼
              ┌──────────┐
              │ Grafana  │ ──> Dashboards, Alerts, Explore
              └──────────┘
```

The OpenTelemetry Collector is the key component. It decouples
applications from backends, handles sampling, enriches data
with metadata, and routes signals to appropriate storage.

---

## Exercises

1. **Trace a request.** Pick a service you own. Instrument it with
   OpenTelemetry to produce traces for the three most critical
   endpoints. What attributes do you add to spans? How do you
   propagate context to downstream services?

2. **Cost analysis.** Your team generates 5TB of logs/day, 100K
   metric time series, and 50M trace spans/day. Calculate the
   monthly cost using Datadog pricing vs self-hosted Grafana
   stack (Loki + Mimir + Tempo on Kubernetes). What's the
   break-even point on engineering time?

3. **SLO design.** Define SLIs and SLOs for a payment processing
   service. What's the error budget? How do you alert when the
   error budget is being consumed too quickly? Design the
   Prometheus recording rules and alerts.

4. **Anomaly detection.** Your service has a "normal" latency
   pattern: higher during business hours (9am-5pm), lower at
   night, with a spike every Monday morning. Design an anomaly
   detection system that accounts for these patterns. What's
   your false positive rate? How do you tune it?

---

[Next: Lesson 7 — Capacity Planning -->](07-capacity-planning.md)
