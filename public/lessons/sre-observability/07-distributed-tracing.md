# Lesson 07: Distributed Tracing

## Following a Package Through the Mail System

When you ship a package, the tracking number lets you follow it: pickup, sorting facility, transit hub, local depot, delivery truck, doorstep. At each stop, a timestamp and location are recorded.

Distributed tracing does the same for requests in your system. A **trace ID** follows a request through every service it touches, recording what happened and how long each step took.

```
PACKAGE TRACKING              DISTRIBUTED TRACE
+-----------------------+     +-----------------------+
| Pickup:    10:00 AM   |     | API Gateway:    0ms   |
| Sort:      10:45 AM   |     | Auth Service:   5ms   |
| Hub:       2:30 PM    |     | Order Service: 15ms   |
| Depot:     6:00 PM    |     | Payment API:   80ms   |
| Delivered: 9:15 AM+1  |     | DB Write:      12ms   |
+-----------------------+     +-----------------------+
  Tracking #: 1Z999AA10       Trace ID: abc-123-def
```

## Traces, Spans, and Context

```
TRACE: The entire journey of one request
+----------------------------------------------------------+
|  Trace ID: abc-123-def                                   |
|                                                          |
|  SPAN A: API Gateway (0ms - 120ms)                       |
|  |                                                       |
|  +-- SPAN B: Auth Service (5ms - 12ms)                   |
|  |                                                       |
|  +-- SPAN C: Order Service (15ms - 110ms)                |
|      |                                                   |
|      +-- SPAN D: Payment API (20ms - 95ms)               |
|      |   |                                               |
|      |   +-- SPAN E: External Payment Gateway (25-90ms)  |
|      |                                                   |
|      +-- SPAN F: DB Write (97ms - 109ms)                 |
|                                                          |
+----------------------------------------------------------+

VISUALIZED AS A TIMELINE (Gantt chart):

0ms     20ms    40ms    60ms    80ms    100ms   120ms
|-------|-------|-------|-------|-------|-------|
[=============== A: API Gateway =================]
 [B:Auth]
    [============= C: Order Service ============]
      [========== D: Payment API ==========]
        [======= E: Ext. Gateway ========]
                                          [F:DB]
```

A **span** represents one unit of work:
- Has a start time and duration
- Has a parent span (except the root span)
- Carries metadata (attributes/tags)
- Can have events (logs within the span)
- Can have a status (OK, Error)

## OpenTelemetry

OpenTelemetry (OTel) is the standard for collecting traces (and metrics and logs). It provides:

```
+-----------------------------------------------------------+
|                    OpenTelemetry                           |
|                                                           |
|  +----------+  +----------+  +----------+                 |
|  |  Traces  |  | Metrics  |  |   Logs   |                 |
|  +----------+  +----------+  +----------+                 |
|       |              |             |                      |
|       +------+-------+------+------+                      |
|              |              |                             |
|         +----v----+   +-----v-----+                       |
|         |   SDK   |   | Collector |                       |
|         +---------+   +-----------+                       |
|                            |                              |
|              +-------------+-------------+                |
|              |             |             |                 |
|         +----v----+  +-----v-----+ +----v----+            |
|         | Jaeger  |  |   Zipkin  | | Tempo   |            |
|         +---------+  +-----------+ +---------+            |
+-----------------------------------------------------------+
```

### OTel Collector Architecture

```
+-----------------------------------------------------------------+
|                    OTel Collector                                |
|                                                                 |
|  RECEIVERS          PROCESSORS          EXPORTERS               |
|  +----------+       +----------+        +----------+            |
|  | OTLP     |       | Batch    |        | Jaeger   |            |
|  | Jaeger   | ----> | Filter   | -----> | OTLP     |            |
|  | Zipkin   |       | Sample   |        | Zipkin   |            |
|  | Prometheus|      | Transform|        | Prometheus|           |
|  +----------+       +----------+        +----------+            |
+-----------------------------------------------------------------+
```

### OTel Collector Configuration

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
    send_batch_size: 1024

  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code:
          status_codes:
            - ERROR
      - name: slow-requests
        type: latency
        latency:
          threshold_ms: 1000
      - name: sample-rest
        type: probabilistic
        probabilistic:
          sampling_percentage: 10

exporters:
  otlp:
    endpoint: "tempo:4317"
    tls:
      insecure: true

  jaeger:
    endpoint: "jaeger:14250"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, tail_sampling]
      exporters: [otlp, jaeger]
```

## Instrumenting Your Code

### Go with OpenTelemetry

```go
package main

import (
    "context"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("checkout-service")

func ProcessOrder(ctx context.Context, orderID string) error {
    ctx, span := tracer.Start(ctx, "ProcessOrder",
        trace.WithAttributes(
            attribute.String("order.id", orderID),
        ),
    )
    defer span.End()

    if err := validateOrder(ctx, orderID); err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, "validation failed")
        return err
    }

    return chargePayment(ctx, orderID)
}

func validateOrder(ctx context.Context, orderID string) error {
    ctx, span := tracer.Start(ctx, "ValidateOrder")
    defer span.End()

    span.AddEvent("checking inventory")
    return nil
}
```

### Python with OpenTelemetry

```python
from opentelemetry import trace
from opentelemetry.trace import StatusCode

tracer = trace.get_tracer("checkout-service")

def process_order(order_id: str):
    with tracer.start_as_current_span(
        "ProcessOrder",
        attributes={"order.id": order_id}
    ) as span:
        try:
            validate_order(order_id)
            charge_payment(order_id)
        except Exception as e:
            span.set_status(StatusCode.ERROR, str(e))
            span.record_exception(e)
            raise

def validate_order(order_id: str):
    with tracer.start_as_current_span("ValidateOrder") as span:
        span.add_event("checking inventory")
```

## Context Propagation

The trace ID must travel across service boundaries. This is called **context propagation**.

```
SERVICE A                    SERVICE B
+-------------------+        +-------------------+
| span: "call B"    |  HTTP  | span: "handle"    |
|                   | -----> |                   |
| Injects trace     |        | Extracts trace    |
| context into      |        | context from      |
| HTTP headers      |        | HTTP headers      |
+-------------------+        +-------------------+

HTTP Headers:
  traceparent: 00-abc123def456-span789-01
  tracestate: vendor=value

W3C Trace Context format:
  version-trace_id-parent_span_id-trace_flags
  00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

### Propagation in Practice

```go
import "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

client := &http.Client{
    Transport: otelhttp.NewTransport(http.DefaultTransport),
}

resp, err := client.Get("http://order-service/api/orders")
```

```python
from opentelemetry.instrumentation.requests import RequestsInstrumentor

RequestsInstrumentor().instrument()

import requests
resp = requests.get("http://order-service/api/orders")
```

## Jaeger UI: Reading a Trace

```
JAEGER TRACE VIEW

Trace: abc-123-def    Duration: 245ms    Services: 4    Spans: 8

SERVICE          OPERATION          DURATION
+-------------------------------------------------------+
| api-gateway    | HTTP GET /checkout |==================| 245ms
|   auth-svc     | validate_token   |==|                   12ms
|   order-svc    | process_order    |    |==============|  198ms
|     order-svc  | validate_items   |    |===|             45ms
|     payment-svc| charge_card      |        |=========|  142ms
|       ext-api  | stripe.charge    |         |========|  130ms
|     order-svc  | save_order       |                |=|   11ms
|     order-svc  | send_event       |                 ||    3ms
+-------------------------------------------------------+
0ms              50ms   100ms  150ms   200ms   245ms

CLICK ON A SPAN TO SEE:
  - Attributes (order_id, user_id, etc.)
  - Events (log-like messages within the span)
  - Status (OK / Error)
  - Related logs (via trace_id correlation)
```

## Sampling Strategies

At high scale, tracing every request is too expensive:

```
STRATEGY         HOW IT WORKS                  WHEN TO USE
+----------------------------------------------------------------+
| Head-based     | Decide at request entry     | Simple, but you  |
| sampling       | "Sample 10% of requests"    | miss rare errors |
+----------------------------------------------------------------+
| Tail-based     | Decide after request ends   | Catches errors   |
| sampling       | "Keep all errors + 10%      | and slow requests|
|                |  of successful"             | More complex     |
+----------------------------------------------------------------+
| Adaptive       | Adjust rate based on load   | High-traffic     |
| sampling       | "Sample more when quiet,    | systems          |
|                |  less when busy"            |                  |
+----------------------------------------------------------------+
| Always-on      | Trace every request         | Low-traffic or   |
|                |                             | critical paths   |
+----------------------------------------------------------------+

            Head-based             Tail-based
Request --> [DECIDE] --> trace     [TRACE] --> [DECIDE] --> keep?
            (at start)             (always     (at end,
                                   trace)      discard or keep)
```

## Exercises

1. **Trace anatomy**: Draw a span tree for the following scenario: A user loads a product page. The frontend calls the API gateway, which calls the product service, which calls both the inventory service and the pricing service in parallel. The pricing service calls a cache, then falls back to a database.

2. **Instrument an app**: Add OpenTelemetry tracing to a simple HTTP server in your language of choice. Create at least three nested spans. Export to console output or Jaeger.

3. **Propagation test**: Set up two services that communicate via HTTP. Verify that the trace ID propagates from service A to service B by checking the `traceparent` header.

4. **Sampling design**: Your service handles 50,000 requests per second. You want to keep all error traces and all traces with latency above 500ms, plus 1% of everything else. Write the tail-sampling configuration for the OTel Collector.

5. **Trace analysis**: Given this trace timeline, identify the bottleneck and suggest an optimization:
   - API Gateway: 0-300ms
   - Auth: 5-10ms
   - Order Service: 15-290ms
   - DB Read: 20-25ms
   - External Payment API: 30-280ms
   - DB Write: 282-290ms

---

[Next: Lesson 08 - The Three Pillars Together -->](08-three-pillars.md)
