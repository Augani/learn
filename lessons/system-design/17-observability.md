# Lesson 17: Observability at Scale — Metrics, Logs, and Traces

You've built a distributed system with microservices, rate limiters, and
message queues. It's running in production. A user reports that the feed is
slow. Where do you look? The API gateway? The feed service? The cache? The
database? The network between them? Without observability, you're debugging
blindfolded.

---

## The Hospital Analogy

Think of observability like a hospital:

**Metrics are vital signs monitors.** Heart rate, blood pressure, oxygen
levels — numbers that update every few seconds. You don't know WHY blood
pressure is high, but you know something is wrong and which patient to check.

**Logs are patient charts.** Detailed notes about what happened, when, and
in what order. "Patient complained of chest pain at 14:23. Administered
aspirin at 14:25. Blood draw at 14:30." Detailed, contextual, but you have
to read through them to find what matters.

**Traces follow a patient through departments.** The patient arrived at
reception (2min), moved to triage (5min), waited for a doctor (15min),
got an X-ray (10min), saw the doctor (8min). A trace shows you the full
journey and where the bottleneck was.

**SLOs are treatment goals.** "This patient's blood pressure should stay
below 140/90." If it exceeds that, we intervene. Not every metric
fluctuation requires a response — only the ones that breach our defined
goals.

---

## The Three Pillars

```
┌────────────────────────────────────────────────────────────┐
│                 THE THREE PILLARS                           │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   METRICS    │  │    LOGS      │  │   TRACES     │      │
│  │              │  │              │  │              │      │
│  │ What: numbers│  │ What: events │  │ What: request│      │
│  │ over time    │  │ with context │  │ flow across  │      │
│  │              │  │              │  │ services     │      │
│  │ When: always │  │ When: always │  │ When: sampled│      │
│  │ (aggregated) │  │ (every event)│  │ (percentage) │      │
│  │              │  │              │  │              │      │
│  │ Cost: low    │  │ Cost: high   │  │ Cost: medium │      │
│  │              │  │              │  │              │      │
│  │ Tools:       │  │ Tools:       │  │ Tools:       │      │
│  │ Prometheus   │  │ ELK Stack    │  │ Jaeger       │      │
│  │ Datadog      │  │ Loki         │  │ Zipkin       │      │
│  │ Grafana      │  │ Splunk       │  │ Tempo        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                            │
│  Metrics tell you SOMETHING is wrong.                      │
│  Logs tell you WHAT went wrong.                            │
│  Traces tell you WHERE it went wrong (across services).    │
│                                                            │
│  You need all three. None is sufficient alone.             │
└────────────────────────────────────────────────────────────┘
```

---

## Metrics: Numbers Over Time

A metric is a numeric measurement collected at regular intervals.
"Request count per second", "p99 latency", "CPU usage percentage",
"queue depth."

### Metric Types

```
┌────────────────────────────────────────────────────────────┐
│                    METRIC TYPES                             │
│                                                            │
│  Counter:  Only goes up. Resets on restart.                 │
│            Example: total_requests, total_errors            │
│            "We've served 1,234,567 requests total."         │
│                                                            │
│  Gauge:    Goes up and down. Current value.                 │
│            Example: cpu_usage, queue_depth, active_conns    │
│            "There are currently 42 active connections."     │
│                                                            │
│  Histogram: Distribution of values in buckets.             │
│             Example: request_duration_seconds               │
│             "50% of requests < 100ms, 99% < 500ms"         │
│                                                            │
│  Summary:  Similar to histogram but calculates             │
│            percentiles on the client side.                  │
│            Example: request_duration_seconds{quantile="0.99"}│
└────────────────────────────────────────────────────────────┘
```

### Prometheus Metrics in Go

```go
package metrics

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	requestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	requestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0},
		},
		[]string{"method", "path"},
	)

	activeConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_active_connections",
			Help: "Number of active HTTP connections",
		},
	)
)

func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		activeConnections.Inc()
		defer activeConnections.Dec()

		start := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, statusCode: 200}

		next.ServeHTTP(recorder, r)

		duration := time.Since(start).Seconds()
		status := http.StatusText(recorder.statusCode)

		requestsTotal.WithLabelValues(r.Method, r.URL.Path, status).Inc()
		requestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(duration)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func Handler() http.Handler {
	return promhttp.Handler()
}
```

### The RED Method (For Services)

```
┌──────────────────────────────────────────────────────┐
│                THE RED METHOD                         │
│                                                      │
│  For every service, measure:                         │
│                                                      │
│  R — Rate:      Requests per second                  │
│                 "How busy is this service?"           │
│                                                      │
│  E — Errors:    Error rate (errors / total requests) │
│                 "How often does it fail?"             │
│                                                      │
│  D — Duration:  Latency distribution (p50, p95, p99) │
│                 "How slow is it?"                     │
│                                                      │
│  These three metrics catch 90% of service problems.  │
│  If Rate drops → less traffic arriving (upstream?)    │
│  If Errors spike → something is broken               │
│  If Duration increases → performance degradation     │
└──────────────────────────────────────────────────────┘
```

### The USE Method (For Resources)

```
┌──────────────────────────────────────────────────────┐
│                THE USE METHOD                         │
│                                                      │
│  For every resource (CPU, memory, disk, network):    │
│                                                      │
│  U — Utilization: Percentage of resource in use      │
│                   "CPU is at 85%"                     │
│                                                      │
│  S — Saturation:  Work waiting because resource is   │
│                   full. Queue depth, thread pool.     │
│                   "42 requests queued for DB conn"    │
│                                                      │
│  E — Errors:      Error count for this resource      │
│                   "5 disk I/O errors in last minute"  │
│                                                      │
│  RED is for services (what your users call).         │
│  USE is for infrastructure (what your services use). │
│  Together they give you full coverage.               │
└──────────────────────────────────────────────────────┘
```

---

## Logs: What Happened

Structured logging is non-negotiable. Free-text logs like
`"Error processing request"` are useless at scale. You can't search,
filter, or aggregate them.

### Structured Logging in Go

```go
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"
)

func setupLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
}

func LoggingMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		traceID := r.Header.Get("X-Trace-ID")

		reqLogger := logger.With(
			slog.String("trace_id", traceID),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.String("remote_addr", r.RemoteAddr),
		)

		recorder := &statusRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(recorder, r)

		duration := time.Since(start)
		reqLogger.Info("request completed",
			slog.Int("status", recorder.statusCode),
			slog.Duration("duration", duration),
			slog.Int64("bytes", recorder.bytesWritten),
		)

		if recorder.statusCode >= 500 {
			reqLogger.Error("server error",
				slog.Int("status", recorder.statusCode),
				slog.Duration("duration", duration),
			)
		}
	})
}
```

Output:

```json
{
  "time": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "msg": "request completed",
  "trace_id": "abc123def456",
  "method": "GET",
  "path": "/api/v1/feed",
  "remote_addr": "10.0.1.50:43210",
  "status": 200,
  "duration": "45.2ms",
  "bytes": 12450
}
```

### Structured Logging in TypeScript

```typescript
import pino from "pino";
import { Request, Response, NextFunction } from "express";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const traceId = req.headers["x-trace-id"] as string ?? crypto.randomUUID();

  const reqLogger = logger.child({
    traceId,
    method: req.method,
    path: req.path,
    remoteAddr: req.ip,
  });

  req.log = reqLogger;

  res.on("finish", () => {
    const duration = Date.now() - start;

    const logData = {
      status: res.statusCode,
      durationMs: duration,
      contentLength: res.getHeader("content-length"),
    };

    if (res.statusCode >= 500) {
      reqLogger.error(logData, "server error");
    } else if (res.statusCode >= 400) {
      reqLogger.warn(logData, "client error");
    } else {
      reqLogger.info(logData, "request completed");
    }
  });

  next();
}
```

### Log Aggregation Architecture

```
┌────────────────────────────────────────────────────────────┐
│              LOG AGGREGATION                                │
│                                                            │
│  Service A ──┐                                             │
│  Service B ──┤──> Log Collector ──> Log Store ──> Query UI │
│  Service C ──┘    (Fluentd,         (Elastic-    (Kibana,  │
│                    Vector,           search,      Grafana)  │
│                    Filebeat)         Loki)                  │
│                                                            │
│  ELK Stack: Elasticsearch + Logstash + Kibana              │
│  Lightweight: Loki + Promtail + Grafana                    │
│                                                            │
│  Loki is "like Prometheus but for logs" — it indexes       │
│  labels (service, level, trace_id) not the full text,      │
│  making it much cheaper to run than Elasticsearch.         │
└────────────────────────────────────────────────────────────┘
```

### What to Log (and What NOT to Log)

```
DO log:                              DON'T log:
──────                               ─────────
Request start/end with duration      Passwords or tokens
Error details with stack traces      Credit card numbers
Business events (user signed up)     Full request bodies (PII)
External API call results            Health check successes
State transitions                    High-volume debug in prod
Slow query warnings                  Duplicate info already in metrics
```

---

## Traces: Request Flow Across Services

A trace follows a single request as it flows through multiple services.
Each step in the journey is a "span."

```
┌──────────────────────────────────────────────────────────────┐
│                    DISTRIBUTED TRACE                          │
│                                                              │
│  Trace ID: abc-123-def-456                                   │
│                                                              │
│  ├── API Gateway (2ms)                                       │
│  │   ├── Auth Service (5ms)                                  │
│  │   │   └── Token validation (3ms)                          │
│  │   └── Feed Service (150ms)          ← BOTTLENECK          │
│  │       ├── User Service (8ms)                              │
│  │       ├── Post Service (12ms)                             │
│  │       ├── Cache lookup (1ms) MISS                         │
│  │       ├── Database query (120ms)    ← SLOW QUERY          │
│  │       └── Cache write (2ms)                               │
│  │                                                           │
│  Total: 157ms                                                │
│                                                              │
│  Without the trace: "The feed is slow."                      │
│  With the trace: "The feed DB query takes 120ms. The cache   │
│  missed. Let's check the query plan and cache invalidation." │
└──────────────────────────────────────────────────────────────┘
```

### OpenTelemetry: The Standard

OpenTelemetry (OTel) is the vendor-neutral standard for instrumentation.
It provides APIs and SDKs for metrics, logs, and traces. You instrument
your code once with OTel, then export to any backend (Jaeger, Zipkin,
Datadog, Grafana Tempo).

```
┌────────────────────────────────────────────────────────────┐
│              OPENTELEMETRY ARCHITECTURE                      │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Service  │  │ Service  │  │ Service  │                  │
│  │  + OTel  │  │  + OTel  │  │  + OTel  │                  │
│  │  SDK     │  │  SDK     │  │  SDK     │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │              │              │                       │
│       └──────────────┼──────────────┘                       │
│                      │                                      │
│              ┌───────▼────────┐                              │
│              │  OTel          │                              │
│              │  Collector     │                              │
│              │  (receives,    │                              │
│              │   processes,   │                              │
│              │   exports)     │                              │
│              └───┬───┬───┬───┘                              │
│                  │   │   │                                   │
│          ┌───────┘   │   └───────┐                          │
│          ▼           ▼           ▼                          │
│      ┌────────┐ ┌────────┐ ┌─────────┐                     │
│      │ Jaeger │ │Promethe│ │  Loki   │                     │
│      │(traces)│ │us      │ │ (logs)  │                     │
│      │        │ │(metrics│ │         │                     │
│      └────────┘ └────────┘ └─────────┘                     │
└────────────────────────────────────────────────────────────┘
```

### OpenTelemetry in Go

```go
package telemetry

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
)

func InitTracer(ctx context.Context, serviceName string) (func(), error) {
	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint("otel-collector:4317"),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
			semconv.ServiceVersionKey.String("1.0.0"),
			attribute.String("environment", "production"),
		),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.TraceIDRatioBased(0.1)),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	shutdown := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		tp.Shutdown(ctx)
	}

	return shutdown, nil
}

var tracer = otel.Tracer("feed-service")

func GetFeed(ctx context.Context, userID string) ([]Post, error) {
	ctx, span := tracer.Start(ctx, "GetFeed",
		trace.WithAttributes(
			attribute.String("user_id", userID),
		),
	)
	defer span.End()

	user, err := getUser(ctx, userID)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	posts, err := fetchPosts(ctx, user.FollowingIDs)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(attribute.Int("post_count", len(posts)))
	return posts, nil
}

func fetchPosts(ctx context.Context, userIDs []string) ([]Post, error) {
	ctx, span := tracer.Start(ctx, "fetchPosts",
		trace.WithAttributes(
			attribute.Int("user_count", len(userIDs)),
		),
	)
	defer span.End()

	cached, err := checkCache(ctx, userIDs)
	if err == nil {
		span.SetAttributes(attribute.Bool("cache_hit", true))
		return cached, nil
	}

	span.SetAttributes(attribute.Bool("cache_hit", false))
	posts, err := queryDatabase(ctx, userIDs)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	writeCache(ctx, userIDs, posts)
	return posts, nil
}
```

### OpenTelemetry in TypeScript

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "feed-service",
    [ATTR_SERVICE_VERSION]: "1.0.0",
    environment: "production",
  }),
  traceExporter: new OTLPTraceExporter({
    url: "http://otel-collector:4317",
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: "http://otel-collector:4317",
    }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new PgInstrumentation(),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown().then(() => process.exit(0));
});
```

### Adding Custom Spans in TypeScript

```typescript
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("feed-service");

async function getFeed(userId: string): Promise<Post[]> {
  return tracer.startActiveSpan("getFeed", async (span) => {
    span.setAttribute("user_id", userId);

    try {
      const user = await getUser(userId);
      const posts = await fetchPosts(user.followingIds);

      span.setAttribute("post_count", posts.length);
      span.setStatus({ code: SpanStatusCode.OK });
      return posts;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function fetchPosts(userIds: string[]): Promise<Post[]> {
  return tracer.startActiveSpan("fetchPosts", async (span) => {
    span.setAttribute("user_count", userIds.length);

    const cached = await checkCache(userIds);
    if (cached) {
      span.setAttribute("cache_hit", true);
      span.end();
      return cached;
    }

    span.setAttribute("cache_hit", false);
    const posts = await queryDatabase(userIds);
    await writeCache(userIds, posts);

    span.end();
    return posts;
  });
}
```

### Sampling

You can't trace every request — the storage cost would be enormous. Common
sampling strategies:

```
┌──────────────────────────────────────────────────────────┐
│               SAMPLING STRATEGIES                         │
│                                                          │
│  Head-based (decide at the start):                       │
│    - 10% of requests: TraceIDRatioBased(0.1)             │
│    - All error requests: always sample on error          │
│    - All slow requests: always sample if > 1s            │
│                                                          │
│  Tail-based (decide at the end):                         │
│    - Collect all spans, but only export "interesting"     │
│      ones (errors, slow, specific endpoints)             │
│    - More expensive but catches rare problems            │
│                                                          │
│  Production recommendation:                              │
│    - 1-10% of normal requests (head-based)               │
│    - 100% of error requests                              │
│    - 100% of requests slower than SLO threshold          │
└──────────────────────────────────────────────────────────┘
```

---

## SLIs, SLOs, and SLAs

These three terms sound similar but mean very different things.

```
┌──────────────────────────────────────────────────────────┐
│                SLI → SLO → SLA                            │
│                                                          │
│  SLI (Service Level Indicator):                          │
│    A measurement. A number.                              │
│    "99.2% of requests completed in under 200ms"          │
│    "99.95% of requests returned a non-error response"    │
│                                                          │
│  SLO (Service Level Objective):                          │
│    A target for the SLI. An internal goal.               │
│    "99.9% of requests should complete in under 200ms"    │
│    "99.99% of requests should return non-error"          │
│                                                          │
│  SLA (Service Level Agreement):                          │
│    A contract with consequences. External promise.       │
│    "If uptime drops below 99.9%, customer gets credits"  │
│    SLAs are always less strict than SLOs (buffer).       │
│                                                          │
│  Relationship:                                           │
│  SLI measures → SLO targets → SLA promises               │
│  (what we measure) (what we aim for) (what we guarantee) │
└──────────────────────────────────────────────────────────┘
```

### Error Budgets

An SLO of 99.9% availability means you can be down for 0.1% of the time.
That's your error budget.

```
┌──────────────────────────────────────────────────────┐
│              ERROR BUDGET                             │
│                                                      │
│  SLO: 99.9% availability                             │
│                                                      │
│  Per month (30 days):                                │
│    Total minutes: 43,200                             │
│    Error budget: 43,200 * 0.001 = 43.2 minutes       │
│                                                      │
│  You can be down for 43 minutes per month.           │
│                                                      │
│  Budget remaining this month:                        │
│  ████████████████████░░░░ 32 min left (used 11 min)  │
│                                                      │
│  When budget is nearly exhausted:                    │
│    - Freeze deployments                              │
│    - Focus on reliability work                       │
│    - No risky changes until next month               │
│                                                      │
│  When budget is healthy:                             │
│    - Ship features faster                            │
│    - Take risks with new deployments                 │
│    - Error budget exists to be spent                 │
└──────────────────────────────────────────────────────┘
```

### Choosing SLIs

```
┌────────────────────────────────────────────────────┐
│           COMMON SLIs BY SERVICE TYPE               │
│                                                     │
│  HTTP API:                                          │
│    Availability: % of non-5xx responses             │
│    Latency: % of requests < threshold               │
│    (e.g., 99% of requests under 200ms)              │
│                                                     │
│  Data pipeline:                                     │
│    Freshness: age of newest processed record        │
│    Completeness: % of expected records present      │
│    Throughput: records processed per second          │
│                                                     │
│  Storage system:                                    │
│    Durability: % of data that survives failures     │
│    Availability: % of successful read/write ops     │
│    Latency: p99 read and write latency              │
│                                                     │
│  Message queue:                                     │
│    Delivery latency: time from publish to consume   │
│    Loss rate: % of messages lost                    │
│    Processing rate: messages consumed per second     │
└────────────────────────────────────────────────────┘
```

---

## Alerting Strategies

### Symptom-Based vs Cause-Based

```
┌──────────────────────────────────────────────────────────┐
│          ALERTING APPROACHES                              │
│                                                          │
│  Cause-based (bad):                                      │
│    Alert: "CPU usage above 90%"                          │
│    Problem: CPU might be 95% and everything is fine.     │
│    You get paged, check, find nothing wrong. Repeat.     │
│    Alert fatigue → you start ignoring alerts.            │
│                                                          │
│  Symptom-based (good):                                   │
│    Alert: "Error rate above 1% for 5 minutes"            │
│    Alert: "p99 latency above 500ms for 10 minutes"       │
│    Alert: "Error budget burn rate exceeds 10x normal"     │
│    These alert on things USERS experience.                │
│    If users are happy, you shouldn't be paged.           │
│                                                          │
│  Rule of thumb:                                          │
│    Page on symptoms. Dashboard on causes.                │
│    When a symptom alert fires, look at the dashboard     │
│    of causes to diagnose.                                │
└──────────────────────────────────────────────────────────┘
```

### Multi-Window, Multi-Burn-Rate Alerts

The Google SRE approach to alerting on SLO breaches:

```
┌──────────────────────────────────────────────────────────┐
│         BURN RATE ALERTING                                │
│                                                          │
│  Error budget: 43 minutes per month                      │
│                                                          │
│  If we burn at 1x rate: budget lasts exactly 1 month     │
│  If we burn at 10x rate: budget gone in 3 days           │
│  If we burn at 100x rate: budget gone in 7 hours         │
│                                                          │
│  Alert rules:                                            │
│                                                          │
│  PAGE (wake someone up):                                 │
│    Burn rate > 14x over 1 hour  AND                      │
│    Burn rate > 14x over 5 minutes                        │
│    → Severe. Will exhaust budget in 2 days.              │
│                                                          │
│  TICKET (fix during business hours):                     │
│    Burn rate > 3x over 6 hours  AND                      │
│    Burn rate > 3x over 30 minutes                        │
│    → Concerning. Will exhaust budget in 10 days.         │
│                                                          │
│  The two-window check prevents false positives from      │
│  brief spikes.                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Dashboards That Actually Help

### The Four Golden Signals Dashboard

For every service, put these on one dashboard:

```
┌────────────────────────────────────────────────────────────┐
│        FEED SERVICE DASHBOARD                               │
│                                                            │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ Traffic (req/sec)      │  │ Error Rate (%)          │    │
│  │                        │  │                        │    │
│  │  ╱╲    ╱╲              │  │            ╱╲          │    │
│  │ ╱  ╲╱╱  ╲─────        │  │ ──────────╱  ╲──      │    │
│  │                        │  │                        │    │
│  │ Current: 1,234 req/s   │  │ Current: 0.3%          │    │
│  └────────────────────────┘  └────────────────────────┘    │
│                                                            │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ Latency (ms)           │  │ Saturation             │    │
│  │ — p50  — p95  — p99    │  │                        │    │
│  │              ──── p99   │  │ CPU: ████████░░ 80%    │    │
│  │        ───── p95        │  │ Mem: ██████░░░░ 60%    │    │
│  │  ───── p50              │  │ DB:  ████░░░░░░ 40%    │    │
│  │                        │  │ Queue: ██░░░░░░░ 20%   │    │
│  └────────────────────────┘  └────────────────────────┘    │
│                                                            │
│  Error Budget: ████████████████████░░░░ 75% remaining      │
└────────────────────────────────────────────────────────────┘
```

### Dashboard Anti-Patterns

```
BAD:  20 graphs nobody looks at
GOOD: 4 graphs that answer "is the service healthy?"

BAD:  Raw metrics without context (CPU at 85% — is that normal?)
GOOD: Metrics with thresholds and baselines

BAD:  One dashboard for everything
GOOD: Layered dashboards:
      1. Overview (are SLOs being met?)
      2. Service-level (RED metrics per service)
      3. Infrastructure (USE metrics per resource)
      4. Debug (detailed when investigating)
```

---

## On-Call Best Practices

```
┌──────────────────────────────────────────────────────────┐
│              ON-CALL THAT DOESN'T BURN PEOPLE OUT         │
│                                                          │
│  1. Every alert must be actionable                       │
│     If you can't do anything about it at 3am, don't     │
│     page for it. Make it a ticket instead.               │
│                                                          │
│  2. Runbooks for every alert                             │
│     When paged, the on-call engineer should find:        │
│     - What this alert means                              │
│     - What to check first                                │
│     - Common fixes                                       │
│     - Escalation path                                    │
│                                                          │
│  3. Post-incident reviews (blameless)                    │
│     - What happened?                                     │
│     - What was the impact?                               │
│     - What did we learn?                                 │
│     - What will we change to prevent recurrence?         │
│                                                          │
│  4. Error budget drives on-call load                     │
│     Too many pages? Error budget is being burned too     │
│     fast. Invest in reliability before new features.     │
│                                                          │
│  5. Target: < 2 pages per on-call shift                  │
│     If consistently higher, something is structurally    │
│     wrong — fix it, don't just rotate faster.            │
└──────────────────────────────────────────────────────────┘
```

---

## Putting It All Together

```
┌─────────────────────────────────────────────────────────────┐
│           OBSERVABILITY IMPLEMENTATION ORDER                  │
│                                                              │
│  Week 1: Structured logging                                  │
│    - JSON logs with trace_id, service, level                 │
│    - Ship to a central log store (Loki or Elasticsearch)     │
│    - This alone solves 50% of debugging problems             │
│                                                              │
│  Week 2: Basic metrics                                       │
│    - RED metrics on every service (rate, errors, duration)   │
│    - USE metrics on infrastructure (CPU, memory, disk)       │
│    - Prometheus + Grafana dashboards                         │
│                                                              │
│  Week 3: Distributed tracing                                 │
│    - OpenTelemetry SDK in every service                      │
│    - Propagate trace context across service calls            │
│    - Jaeger or Grafana Tempo for trace visualization         │
│    - Sample at 10% initially, increase for errors            │
│                                                              │
│  Week 4: SLOs and alerting                                   │
│    - Define SLIs for each service                            │
│    - Set SLO targets (start conservative, tighten later)     │
│    - Burn-rate alerts for SLO breaches                       │
│    - Error budget dashboard                                  │
│                                                              │
│  Ongoing: Refine                                             │
│    - Reduce alert noise (symptom-based only)                 │
│    - Write runbooks for every page                           │
│    - Blameless post-mortems for every incident               │
│    - Track mean time to detection (MTTD) and recovery (MTTR) │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

```
┌─────────────────────────────────────────────────────────┐
│          OBSERVABILITY QUICK REFERENCE                    │
│                                                          │
│  Metrics → Is something wrong? (Prometheus/Datadog)      │
│  Logs    → What went wrong? (ELK/Loki)                   │
│  Traces  → Where did it go wrong? (Jaeger/Tempo)         │
│                                                          │
│  RED → Rate, Errors, Duration (for services)             │
│  USE → Utilization, Saturation, Errors (for resources)   │
│                                                          │
│  SLI measures → SLO targets → SLA promises               │
│                                                          │
│  Alert on symptoms, dashboard on causes.                 │
│  Page only when users are affected.                      │
│  Every alert needs a runbook.                            │
│                                                          │
│  Start with structured logging. It's the highest         │
│  ROI observability investment you can make.              │
└─────────────────────────────────────────────────────────┘
```
