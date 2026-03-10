# Lesson 18: Distributed Debugging

> "It worked on my machine" becomes "it worked on
> WHICH machine?" in distributed systems.

---

## The Analogy

Imagine debugging a conversation between 50 people at a
party, each in different rooms, communicating via notes
passed through hallways. Something went wrong. You need
to reconstruct WHO said WHAT to WHOM, in WHAT ORDER, and
figure out WHERE the miscommunication happened.

That's distributed debugging.

```
  MONOLITH DEBUGGING:
  1. Set breakpoint
  2. Step through code
  3. Inspect variables
  4. Found the bug

  DISTRIBUTED DEBUGGING:
  1. Which service had the error?
  2. What services did it call?
  3. What was the state of each service?
  4. What was the order of events across services?
  5. Was it a timing issue? Network issue? Data issue?
  6. Can you reproduce it? (probably not)
```

---

## Distributed Tracing

### The Core Idea

```
  Attach a TRACE ID to every request.
  Propagate it through every service call.
  Collect all spans into a single trace.

  User Request (trace_id=abc123)
  |
  +-> API Gateway (span 1, 0-500ms)
      |
      +-> Auth Service (span 2, 10-50ms)
      |
      +-> Product Service (span 3, 60-200ms)
      |   |
      |   +-> Database (span 4, 70-150ms)
      |   |
      |   +-> Cache (span 5, 65-68ms)
      |
      +-> Recommendation Service (span 6, 210-450ms)
          |
          +-> ML Model (span 7, 220-400ms)

  TIMELINE VIEW:
  0ms        100ms       200ms       300ms       400ms       500ms
  |-----------|-----------|-----------|-----------|-----------|
  [========== API Gateway ==========================================]
    [Auth]
              [====== Product =========]
                [=== DB ====]
               [Cache]
                           [======= Recommendation ================]
                             [======= ML Model ==========]
```

### OpenTelemetry Tracing

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    SimpleSpanProcessor,
    ConsoleSpanExporter,
)

provider = TracerProvider()
processor = SimpleSpanProcessor(ConsoleSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("order-service")

def process_order(order_id: str):
    with tracer.start_as_current_span("process_order") as span:
        span.set_attribute("order.id", order_id)

        with tracer.start_as_current_span("validate_order"):
            validate(order_id)

        with tracer.start_as_current_span("charge_payment") as payment_span:
            payment_span.set_attribute("payment.method", "credit_card")
            charge(order_id)

        with tracer.start_as_current_span("ship_order"):
            ship(order_id)

def validate(order_id: str):
    pass

def charge(order_id: str):
    pass

def ship(order_id: str):
    pass

process_order("ORD-12345")
```

---

## Context Propagation

```
  THE CRITICAL PIECE: passing trace context across services.

  HTTP: via headers
  +-----------------------------------------------+
  | GET /api/products HTTP/1.1                     |
  | traceparent: 00-abc123-span456-01              |
  | tracestate: vendor=value                       |
  +-----------------------------------------------+

  W3C Trace Context format:
  traceparent: {version}-{trace_id}-{parent_span_id}-{flags}

  gRPC: via metadata
  +-----------------------------------------------+
  | grpc-trace-bin: <binary encoded trace context> |
  +-----------------------------------------------+

  Message Queues: via message headers/properties
  +-----------------------------------------------+
  | kafka message:                                 |
  |   headers:                                     |
  |     traceparent: 00-abc123-span789-01          |
  |   body: { ... }                                |
  +-----------------------------------------------+

  WITHOUT PROPAGATION:
  Service A: trace_id=abc (knows about its own spans)
  Service B: trace_id=xyz (starts a NEW trace)
  Result: two disconnected traces, can't see full picture

  WITH PROPAGATION:
  Service A: trace_id=abc, span=1
  Service B: trace_id=abc, span=2, parent=1
  Result: one connected trace showing the full journey
```

---

## Structured Logging for Distributed Systems

```
  BAD: unstructured logs
  [2024-01-15 10:30:45] ERROR: Payment failed for order

  GOOD: structured + correlated
  {
    "timestamp": "2024-01-15T10:30:45.123Z",
    "level": "ERROR",
    "service": "payment-service",
    "trace_id": "abc123",
    "span_id": "span456",
    "order_id": "ORD-789",
    "error": "card_declined",
    "card_last4": "4242",
    "duration_ms": 342,
    "upstream_service": "order-service",
    "instance": "payment-service-pod-7b4f9"
  }

  NOW YOU CAN:
  1. Search by trace_id to see ALL logs for one request
  2. Search by order_id across ALL services
  3. Filter by error type across ALL instances
  4. Correlate with spans in your tracing system
```

```python
import json
import logging
import uuid
from contextvars import ContextVar

trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")
span_id_var: ContextVar[str] = ContextVar("span_id", default="")

class StructuredFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "service": "order-service",
            "trace_id": trace_id_var.get(""),
            "span_id": span_id_var.get(""),
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra_fields"):
            log_entry.update(record.extra_fields)
        return json.dumps(log_entry)

logger = logging.getLogger("distributed")
handler = logging.StreamHandler()
handler.setFormatter(StructuredFormatter())
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

def handle_request(request_data: dict):
    trace_id_var.set(request_data.get("trace_id", str(uuid.uuid4())))
    span_id_var.set(str(uuid.uuid4())[:8])
    logger.info("Processing request", extra={
        "extra_fields": {"order_id": request_data.get("order_id")}
    })
```

---

## Causal Profiling

Traditional profiling tells you which functions are slow.
Causal profiling tells you which functions, if made faster,
would actually speed up the overall system.

```
  TRADITIONAL PROFILING:
  Function A: 40% of total time
  Function B: 30% of total time
  Function C: 30% of total time

  Intuition says: "optimize A!"
  But what if A runs in parallel with B?
  Making A faster might not help at all.

  CAUSAL PROFILING (Coz profiler):
  "If we speed up Function A by 50%, total speedup = 0%"
  "If we speed up Function B by 50%, total speedup = 25%"
  "If we speed up Function C by 50%, total speedup = 10%"

  B is the actual bottleneck!

  HOW IT WORKS:
  Instead of speeding up a function (hard),
  SLOW DOWN everything else (easy).

  To test "what if A were 2x faster?":
  Pause all other threads for time = A's duration.
  This is equivalent to A being infinitely fast.
  Measure overall throughput change.

  +---A---+           +--A--+
  +-----B-----+  =>   +-----B-----+----pause----+
  +----C----+         +----C----+------pause------+
  Real execution      Simulated "A is 2x faster"
```

---

## Replay Debugging

Record everything, replay the exact execution later.

```
  RECORD PHASE:
  Capture all nondeterministic inputs:
  - Network messages (content + timing)
  - Thread scheduling decisions
  - Random number seeds
  - Clock values
  - File I/O results

  Service A log:
  T=0:   received msg from client: {order: 123}
  T=1:   sent request to Service B
  T=5:   received response from Service B: {ok: true}
  T=6:   read from DB: {user: "alice"}
  T=7:   random() = 0.4231
  T=8:   sent response to client

  REPLAY PHASE:
  Feed recorded inputs into the service.
  Execution follows EXACTLY the same path.
  Set breakpoints, inspect state, step through.
  THE BUG IS PERFECTLY REPRODUCIBLE.

  TOOLS:
  +------------------+-----------------------------------+
  | rr (Mozilla)     | Record/replay for Linux processes |
  | Hermit (Meta)    | Deterministic Linux container     |
  | FoundationDB     | Deterministic simulation testing  |
  | Antithesis       | Deterministic simulation platform |
  +------------------+-----------------------------------+
```

---

## Distributed Debugging Patterns

### Pattern 1: Correlation IDs

```
  Every external request gets a unique ID.
  Pass it through EVERY service, log, metric, and trace.

  User clicks "Buy":
  correlation_id = "req-abc-123"

  API Gateway:     [req-abc-123] Received POST /orders
  Order Service:   [req-abc-123] Created order ORD-789
  Payment Service: [req-abc-123] Charging $50.00
  Payment Service: [req-abc-123] ERROR: card declined
  Order Service:   [req-abc-123] Order failed, rolling back
  Notification:    [req-abc-123] Sending failure email

  grep "req-abc-123" across ALL service logs = full story
```

### Pattern 2: Distributed Breakpoints

```
  CAN'T pause a distributed system like a local debugger.
  INSTEAD: conditional logging + alerting.

  "When order total > $10000 AND payment retries > 2:"
  - Dump full request context
  - Dump service state
  - Dump recent related traces
  - Alert on-call engineer

  DYNAMIC INSTRUMENTATION:
  Inject logging at runtime without redeployment.
  Tools: Datadog Dynamic Instrumentation, Lightrun, Rookout
```

### Pattern 3: Canary Analysis

```
  BEFORE: deploy to everyone, discover bugs in production
  AFTER:  deploy to 1% of traffic, compare metrics

  +--- 99% ---> Old Version (baseline)
  |
  Traffic
  |
  +---  1% ---> New Version (canary)

  Compare:
  - Error rates (canary 5% vs baseline 0.1% = BAD)
  - Latency p99 (canary 500ms vs baseline 50ms = BAD)
  - Success rates per endpoint

  Automated rollback if canary metrics degrade.
```

---

## The Three Pillars: Logs, Metrics, Traces

```
  +----------+------------------+---------------------------+
  | Pillar   | What             | When to Use               |
  +----------+------------------+---------------------------+
  | Logs     | Discrete events  | "What happened?"          |
  |          | with context     | Debugging specific issues |
  +----------+------------------+---------------------------+
  | Metrics  | Aggregated       | "How is the system doing?"|
  |          | measurements     | Alerting, dashboards      |
  +----------+------------------+---------------------------+
  | Traces   | Request flow     | "Where is it slow?"       |
  |          | across services  | Performance debugging     |
  +----------+------------------+---------------------------+

  DEBUGGING WORKFLOW:
  1. METRICS alert you: "error rate spiked at 2:00 PM"
  2. LOGS tell you: "payment-service returning 500s"
  3. TRACES show you: "DB query in payment-service taking 30s"
  4. You find: missing index on payments table
```

---

## Debugging Checklist for Distributed Systems

```
  WHEN SOMETHING GOES WRONG:

  [ ] 1. Get the trace_id for the failing request
  [ ] 2. Pull the full trace (all spans across services)
  [ ] 3. Identify which service/span failed or was slow
  [ ] 4. Pull structured logs for that trace_id
  [ ] 5. Check metrics around the failure time
        - Error rates
        - Latency percentiles
        - Resource utilization (CPU, memory, connections)
  [ ] 6. Check for recent deployments
  [ ] 7. Check for infrastructure changes
  [ ] 8. Check for upstream dependency issues
  [ ] 9. Look for correlated failures across services
  [ ] 10. Reproduce in staging with recorded traffic
```

---

## Exercises

### Exercise 1: Build a Trace Collector

Implement a simple in-memory trace collector:
1. Accept spans with: trace_id, span_id, parent_span_id,
   service_name, operation, start_time, duration
2. Build a tree of spans per trace
3. Print a waterfall visualization (like the ASCII art above)
4. Identify the critical path (longest chain of spans)

### Exercise 2: Correlation ID Middleware

Write HTTP middleware (in Go or Python) that:
1. Extracts trace_id from incoming request header
2. Generates one if missing
3. Injects it into all outgoing HTTP calls
4. Attaches it to all log entries
5. Returns it in the response header

### Exercise 3: Log Aggregation Pipeline

Build a structured logging pipeline:
1. Multiple services write JSON logs to files
2. A collector reads all log files
3. Indexes by trace_id, service, timestamp, level
4. Query interface: "show all ERROR logs for trace abc123"

### Exercise 4: Anomaly Detection on Traces

Given a set of 1000 traces for the same endpoint:
1. Compute the normal latency distribution per span
2. Flag traces where any span is > 3 standard deviations
3. Report which service and operation is the outlier
4. Look for common patterns in anomalous traces

---

## Key Takeaways

```
  1. Distributed tracing: trace_id propagated across services
  2. Spans form a tree showing request flow and timing
  3. Context propagation is the critical piece (W3C headers)
  4. Structured logging with trace_id enables correlation
  5. Causal profiling: which bottleneck actually matters?
  6. Replay debugging: record nondeterminism, replay exactly
  7. Three pillars: metrics (alerting), logs (detail), traces (flow)
  8. Correlation IDs tie everything together
  9. Dynamic instrumentation avoids redeployment
  10. The debugging workflow: metrics -> logs -> traces -> fix
```

---

Next: [Lesson 19 — Patterns & Anti-Patterns](./19-patterns-and-antipatterns.md)
