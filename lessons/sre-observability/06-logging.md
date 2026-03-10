# Lesson 06: Logging

## The Flight Black Box

After a plane incident, investigators recover the black box. It records everything: altitude, speed, engine readings, pilot communications. Without it, understanding what happened would be guesswork.

**Logs are the black box of your system.** They record what happened, when, and in what context. When something goes wrong at 3 AM, logs are often the first thing you reach for.

```
UNSTRUCTURED LOG (guesswork)
"Error processing order for user john, timeout after 30s"

STRUCTURED LOG (searchable, parseable)
{
  "timestamp": "2025-03-15T03:42:18Z",
  "level": "error",
  "service": "order-processor",
  "event": "order_processing_failed",
  "user_id": "u-12345",
  "order_id": "ord-98765",
  "error": "database_timeout",
  "duration_ms": 30000,
  "trace_id": "abc123def456"
}
```

## Structured vs Unstructured Logging

```
UNSTRUCTURED                    STRUCTURED
+--------------------------+    +--------------------------+
| Free-form text strings   |    | Key-value pairs / JSON   |
| Hard to search           |    | Easy to search & filter  |
| Hard to aggregate        |    | Easy to aggregate        |
| Human-readable only      |    | Machine + human readable |
| Regex-dependent parsing  |    | Consistent schema        |
+--------------------------+    +--------------------------+

Search: "Find all timeout errors for user u-12345"

Unstructured: grep "timeout" | grep "u-12345"
  --> May miss: "user u-12345 experienced a time out"
  --> May false-match: "timeout value set to 12345ms"

Structured: user_id="u-12345" AND error="timeout"
  --> Exact. No guesswork.
```

## Log Levels

```
+----------+-------------------------------------------+
| LEVEL    | WHEN TO USE                               |
+----------+-------------------------------------------+
| FATAL    | System is unusable. Process will exit.     |
|          | "Database connection pool exhausted"       |
+----------+-------------------------------------------+
| ERROR    | Something failed. Needs attention.         |
|          | "Payment processing failed for order X"    |
+----------+-------------------------------------------+
| WARN     | Something unexpected but recoverable.     |
|          | "Retry attempt 3 of 5 for external API"   |
+----------+-------------------------------------------+
| INFO     | Normal operational events.                |
|          | "Order ord-123 completed successfully"     |
+----------+-------------------------------------------+
| DEBUG    | Detailed diagnostic info.                 |
|          | "Cache miss for key user:profile:456"      |
+----------+-------------------------------------------+
| TRACE    | Very fine-grained, step-by-step.          |
|          | "Entering function processPayment()"       |
+----------+-------------------------------------------+

PRODUCTION:  INFO and above (WARN, ERROR, FATAL)
DEBUGGING:   DEBUG and above
DEVELOPMENT: TRACE and above

           Volume
TRACE    |########################################|
DEBUG    |############################            |
INFO     |###################                     |
WARN     |########                                |
ERROR    |###                                     |
FATAL    |#                                       |
```

## Structured Logging in Code

### Go (using slog)

```go
package main

import (
    "log/slog"
    "os"
)

func main() {
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    }))

    logger.Info("order processed",
        slog.String("order_id", "ord-98765"),
        slog.String("user_id", "u-12345"),
        slog.Int("items", 3),
        slog.Float64("total", 149.99),
        slog.Duration("duration", elapsed),
    )
}
```

### Python (using structlog)

```python
import structlog

logger = structlog.get_logger()

logger.info(
    "order_processed",
    order_id="ord-98765",
    user_id="u-12345",
    items=3,
    total=149.99,
    duration_ms=245,
)
```

### Node.js (using pino)

```javascript
const pino = require("pino");
const logger = pino({ level: "info" });

logger.info({
  event: "order_processed",
  orderId: "ord-98765",
  userId: "u-12345",
  items: 3,
  total: 149.99,
  durationMs: 245,
});
```

## Log Aggregation Stacks

### The ELK Stack

```
+----------+     +-------------+     +---------------+
|          |     |             |     |               |
| Your App | --> | Logstash /  | --> | Elasticsearch |
| (logs)   |     | Filebeat    |     | (Store &      |
|          |     | (Collect &  |     |  Index)       |
+----------+     |  Transform) |     +-------+-------+
                 +-------------+             |
                                             v
                                     +---------------+
                                     |    Kibana     |
                                     | (Visualize &  |
                                     |  Search)      |
                                     +---------------+

E = Elasticsearch (search engine / storage)
L = Logstash (collection / transformation)
K = Kibana (UI / visualization)
```

### Grafana Loki

```
+----------+     +-------------+     +---------------+
|          |     |             |     |               |
| Your App | --> |  Promtail   | --> |     Loki      |
| (logs)   |     | (Agent)     |     | (Store, does  |
|          |     |             |     |  NOT index    |
+----------+     +-------------+     |  log content) |
                                     +-------+-------+
                                             |
                                             v
                                     +---------------+
                                     |   Grafana     |
                                     | (Same UI as   |
                                     |  metrics!)    |
                                     +---------------+

Key difference from ELK:
  - Loki indexes LABELS only, not log content
  - Much cheaper to run at scale
  - Uses same label model as Prometheus
  - Queries use LogQL (similar to PromQL)
```

### Loki Configuration

```yaml
# promtail-config.yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: kubernetes
    kubernetes_sd_configs:
      - role: pod
    pipeline_stages:
      - json:
          expressions:
            level: level
            msg: msg
      - labels:
          level:
      - timestamp:
          source: timestamp
          format: RFC3339
```

### LogQL Examples

```logql
# All error logs from the checkout service
{service="checkout"} |= "error"

# Parse JSON and filter by status code
{service="checkout"} | json | status_code >= 500

# Count errors per minute
count_over_time({service="checkout"} |= "error" [1m])

# Top 10 error messages
topk(10, count by (msg) (
  {service="checkout"} | json | level="error"
))

# Latency from log fields
{service="checkout"}
  | json
  | duration_ms > 1000
  | line_format "Slow request: {{.path}} took {{.duration_ms}}ms"
```

## What to Log (and What Not To)

```
+--DO LOG--+                      +--DO NOT LOG--+
| Request IDs, trace IDs         | Passwords, tokens        |
| User IDs (not PII)             | Credit card numbers      |
| Error messages + stack traces  | Personal health data     |
| Latency and status codes       | Full request bodies      |
| Business events (order placed) |   (may contain PII)      |
| Configuration changes          | Secrets, API keys        |
| Authentication events          | Excessive debug in prod  |
+-------------------------------+  +-------------------------+

COMPLIANCE NOTE:
  GDPR, HIPAA, PCI-DSS all restrict what you can log.
  When in doubt, hash or redact sensitive fields.
```

## Log Correlation

The power of logs increases when you can connect them across services:

```
Request arrives at API Gateway
  trace_id: abc-123
       |
       v
API Gateway log:
  {"trace_id":"abc-123", "event":"request_received", "path":"/checkout"}
       |
       v
Order Service log:
  {"trace_id":"abc-123", "event":"order_created", "order_id":"ord-456"}
       |
       v
Payment Service log:
  {"trace_id":"abc-123", "event":"payment_failed", "reason":"card_declined"}

Searching Loki for trace_id="abc-123" shows the ENTIRE journey.
```

## Log Sampling and Cost Control

At scale, logging everything is expensive:

```
1,000 requests/sec * 1 KB/log * 86,400 sec/day = 82 GB/day

STRATEGIES TO CONTROL COSTS:
+--------------------------------+------------------+
| Strategy                       | Cost Reduction   |
+--------------------------------+------------------+
| Sample debug/info logs (1:10)  | ~70%             |
| Drop health check logs         | ~10-30%          |
| Shorter retention (7d vs 30d)  | ~75%             |
| Compress before shipping       | ~60-80%          |
| Log only on error for some     | Variable         |
|   endpoints                    |                  |
+--------------------------------+------------------+
```

## Exercises

1. **Convert to structured**: Take these unstructured log lines and convert them to structured JSON:
   - `"2025-03-15 ERROR: Failed to connect to database after 3 retries"`
   - `"User john@example.com logged in from 192.168.1.1"`
   - `"Order #4521 shipped to warehouse B, 3 items, $89.99"`

2. **LogQL practice**: Write LogQL queries for:
   - All logs from the `payment-service` with level `error`
   - Count of 5xx errors per service over the last hour
   - Logs where duration exceeds 2 seconds, formatted to show path and duration

3. **Logging library**: Add structured logging to a small application in your preferred language. Ensure every log line includes: timestamp, level, service name, and a trace_id field.

4. **Cost estimation**: Your service produces 500 log lines per second, averaging 500 bytes each. Calculate daily storage needs. Design a sampling strategy that reduces cost by 60% while preserving all error logs.

5. **Sensitive data audit**: Review log output from an application you work on. Identify any fields that might contain PII or sensitive data. Propose a redaction or hashing strategy.

---

[Next: Lesson 07 - Distributed Tracing -->](07-distributed-tracing.md)
