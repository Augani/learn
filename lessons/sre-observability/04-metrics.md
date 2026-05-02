# Lesson 04: Metrics

## The Dashboard on Your Car

Your car dashboard gives you a few critical numbers: speed, fuel, engine temperature, RPM. You do not need to know the pressure in every cylinder to drive safely. You need the **right signals at the right level**.

System metrics work the same way. Too few and you are driving blind. Too many and you cannot find the important ones.

```
CAR DASHBOARD               SYSTEM DASHBOARD
+-------------------+       +-------------------+
| Speed: 65 mph     |       | Latency: 45ms     |
| Fuel: 3/4         |       | Error rate: 0.01% |
| Temp: Normal      |       | Traffic: 2.4k rps |
| RPM: 2500         |       | Saturation: 62%   |
+-------------------+       +-------------------+
     Just enough               Just enough
     to drive safely           to operate safely
```

## The Four Golden Signals

Google's SRE book defines four golden signals that apply to every service:

```
+============================================+
|         THE FOUR GOLDEN SIGNALS            |
+============================================+
|                                            |
|  1. LATENCY                                |
|     How long requests take                 |
|     (Distinguish success vs error latency) |
|                                            |
|  2. TRAFFIC                                |
|     How much demand is on your system      |
|     (Requests/sec, sessions, reads/writes) |
|                                            |
|  3. ERRORS                                 |
|     Rate of failed requests                |
|     (Explicit 5xx, implicit wrong content) |
|                                            |
|  4. SATURATION                             |
|     How "full" your system is              |
|     (CPU, memory, disk, connections)       |
|                                            |
+============================================+
```

### Why These Four?

```
User hits your API
       |
       v
  [TRAFFIC] How much load? -----> Capacity issue?
       |
       v
  [LATENCY] How fast? ----------> Performance issue?
       |
       v
  [ERRORS] Did it work? --------> Correctness issue?
       |
       v
  [SATURATION] How stressed? ---> Resource issue?
```

Together, they answer: "Is the system healthy, and if not, where is the problem?"

## The RED Method

For request-driven services (most microservices, APIs):

```
R - Rate      (requests per second)
E - Errors    (failed requests per second)
D - Duration  (distribution of request latency)

+-----------+     +-----------+     +-----------+
|   RATE    |     |  ERRORS   |     | DURATION  |
|           |     |           |     |           |
|  req/sec  |     | err/sec   |     |  p50, p95 |
|  by route |     | by type   |     |  p99      |
+-----------+     +-----------+     +-----------+
     |                 |                 |
     +-----------------+-----------------+
                       |
            "How is my service doing
             from the USER perspective?"
```

### RED in Prometheus

```promql
# Rate: requests per second
rate(http_requests_total[5m])

# Errors: error rate
rate(http_requests_total{status_code=~"5.."}[5m])

# Duration: latency percentiles
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))
```

## The USE Method

For infrastructure resources (CPU, memory, disk, network):

```
U - Utilization  (% of resource in use)
S - Saturation   (work queued beyond capacity)
E - Errors       (hardware/software error events)

For EACH resource:
+--------------------------------------------------+
| Resource  | Utilization | Saturation | Errors     |
+--------------------------------------------------+
| CPU       | % busy      | Run queue  | MCE errors |
| Memory    | % used      | Swap usage | OOM kills  |
| Disk I/O  | % busy      | Wait queue | I/O errors |
| Network   | Bandwidth % | Dropped    | CRC errors |
+--------------------------------------------------+
```

Think of USE like checking a highway:
- **Utilization**: What percent of lanes are occupied?
- **Saturation**: Is there a traffic jam (queue forming)?
- **Errors**: Are there accidents (failures)?

## Metric Types

Prometheus defines four core metric types:

```
COUNTER
  Only goes up. Resets on restart.
  Use for: total requests, total errors, bytes sent

  Value |      /
        |    /
        |  /
        |/
        +---------> Time

GAUGE
  Goes up and down.
  Use for: temperature, memory usage, queue depth

  Value |   /\    /\
        |  /  \  /  \
        | /    \/    \
        +---------> Time

HISTOGRAM
  Counts observations in configurable buckets.
  Use for: request latency, response sizes

  Count |  ##
        |  ##  ##
        |  ##  ##  ##
        |  ##  ##  ##  ##
        +--+---+---+---+--> Buckets (ms)
          10  50  100 500

SUMMARY
  Like histogram but calculates percentiles client-side.
  Use when: you need exact percentiles, not aggregatable
```

### Choosing the Right Type

```
"How many total requests?"      --> COUNTER
"What is the current CPU?"      --> GAUGE
"What is p99 latency?"          --> HISTOGRAM
"How many items in the queue?"  --> GAUGE
"Total bytes transferred?"      --> COUNTER
"Request size distribution?"    --> HISTOGRAM
```

## Instrumentation Basics

Adding metrics to your application (Go example with Prometheus client):

```go
package main

import (
    "net/http"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    requestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total HTTP requests",
        },
        []string{"method", "path", "status"},
    )

    requestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "Request latency distribution",
            Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0},
        },
        []string{"method", "path"},
    )

    activeConnections = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "http_active_connections",
            Help: "Currently active connections",
        },
    )
)

func init() {
    prometheus.MustRegister(requestsTotal, requestDuration, activeConnections)
}

func main() {
    http.Handle("/metrics", promhttp.Handler())
    http.ListenAndServe(":8080", nil)
}
```

Python example with the Prometheus client:

```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server

requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"]
)

request_duration = Histogram(
    "http_request_duration_seconds",
    "Request latency distribution",
    ["method", "path"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

active_connections = Gauge(
    "http_active_connections",
    "Currently active connections"
)

start_http_server(8080)
```

## Naming Conventions

Good metric names follow a pattern:

```
[namespace]_[subsystem]_[name]_[unit]

Examples:
  http_server_requests_total          (counter)
  http_server_request_duration_seconds (histogram)
  node_memory_available_bytes          (gauge)
  process_cpu_seconds_total            (counter)

Rules:
  - Use snake_case
  - Include unit as suffix (_seconds, _bytes, _total)
  - _total suffix for counters
  - Use base units (seconds not milliseconds, bytes not kilobytes)
```

## Percentiles vs Averages

Never use averages for latency. They hide problems.

```
AVERAGE HIDES THE TRUTH

  Requests:  2ms, 3ms, 2ms, 1ms, 2ms, 500ms, 2ms, 3ms, 1ms, 2ms
  Average:   51.8ms  (looks bad but misleading)
  Median:    2ms     (most users are fine)
  p99:       500ms   (1% of users wait 500ms!)

  +--Distribution--+
  |  ##             |
  |  ##             |
  |  ##             |
  |  ##             |           #
  +--+--+--+--+----+---+---+--+--> ms
     1  2  3  5   50  100 200 500

  The average says "52ms" but reality is bimodal:
  most requests at 2ms, a few at 500ms.
  p99 catches this. Average does not.
```

## Exercises

1. **Golden signals audit**: Pick a service you work on. For each of the four golden signals, identify what specific metric you would use and how you would measure it.

2. **RED dashboard**: Write PromQL queries for a `user-service` that expose: total request rate by endpoint, error rate by status code, and p50/p95/p99 latency.

3. **USE checklist**: For a Linux server running your application, fill out the USE method table: what specific metric would you check for utilization, saturation, and errors for CPU, memory, disk, and network?

4. **Instrumentation**: Add Prometheus metrics to a small HTTP handler in your language of choice. Expose a counter for total requests, a histogram for duration, and a gauge for active connections.

5. **Percentile analysis**: You have 1000 requests with the following latency distribution: 900 at 10ms, 90 at 100ms, 9 at 500ms, 1 at 5000ms. Calculate p50, p90, p99, p99.9, and the average. Which metric best represents the user experience?

---

[Next: Lesson 05 - Prometheus & Grafana -->](05-prometheus-grafana.md)
