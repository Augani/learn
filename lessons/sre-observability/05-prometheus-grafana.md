# Lesson 05: Prometheus & Grafana

## The Weather Station and Display

A weather station collects temperature, humidity, and wind speed every few seconds. But raw numbers scrolling on a terminal are useless to most people. You need a display: a dashboard that turns data into insight.

**Prometheus is the weather station** (collects and stores metrics). **Grafana is the display** (visualizes and alerts on them).

```
+-------------+     +-------------+     +-------------+
|  Your App   |     | Prometheus  |     |   Grafana   |
|  /metrics   | <-- | (Scrape,    | --> | (Visualize, |
|  endpoint   |     |  Store,     |     |  Dashboard, |
|             |     |  Query)     |     |  Alert)     |
+-------------+     +-------------+     +-------------+
    Expose           Collect & Store     Display & Alert
```

## Prometheus Architecture

```
+----------------------------------------------------------+
|                    PROMETHEUS SERVER                      |
|                                                          |
|  +-----------+    +------------+    +-----------+        |
|  | Retrieval |    |   TSDB     |    | HTTP      |        |
|  | (Scraper) |--->| (Storage)  |<---| Server    |        |
|  +-----------+    +------------+    +-----------+        |
|       |                                   ^              |
|       v                                   |              |
|  +-----------+                    +-----------+          |
|  | Service   |                    | PromQL    |          |
|  | Discovery |                    | Queries   |          |
|  +-----------+                    +-----------+          |
|                                                          |
+----------------------------------------------------------+
       |                                    ^
       v                                    |
  +----------+  +----------+          +----------+
  | Target 1 |  | Target 2 |          | Grafana  |
  | /metrics |  | /metrics |          | Alertmgr |
  +----------+  +----------+          +----------+
```

Key concepts:
- **Pull model**: Prometheus scrapes targets (does not receive pushes)
- **TSDB**: Time-series database optimized for metric storage
- **Service discovery**: Automatically finds targets in Kubernetes, Consul, etc.
- **PromQL**: Query language for slicing and dicing metrics

## Prometheus Configuration

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alerts/*.yml"
  - "recording/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - "alertmanager:9093"

scrape_configs:
  - job_name: "app-server"
    static_configs:
      - targets: ["app:8080"]
    metrics_path: /metrics
    scrape_interval: 10s

  - job_name: "kubernetes-pods"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
```

## PromQL Essentials

PromQL is Prometheus's query language. Think of it as SQL for time-series data.

### Instant and Range Vectors

```
INSTANT VECTOR (single value per series at one point in time)
  http_requests_total{method="GET"}
  --> Returns current value for each matching series

RANGE VECTOR (multiple values per series over a time range)
  http_requests_total{method="GET"}[5m]
  --> Returns all values in the last 5 minutes

+--Time-->
|  * * * * * * * * * * *   <-- Range vector [5m]
|                      ^   <-- Instant vector (latest point)
+
```

### Core Functions

```promql
# rate(): Per-second rate of increase (use with counters)
rate(http_requests_total[5m])

# increase(): Total increase over a range
increase(http_requests_total[1h])

# histogram_quantile(): Calculate percentiles
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# sum() by: Aggregate across labels
sum by (status_code) (rate(http_requests_total[5m]))

# avg(), min(), max(): Aggregation functions
avg(rate(cpu_usage_percent[5m]))
```

### Practical PromQL Recipes

```promql
# Request rate per service
sum by (service) (rate(http_requests_total[5m]))

# Error percentage
sum(rate(http_requests_total{status_code=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
* 100

# p99 latency by endpoint
histogram_quantile(0.99,
  sum by (le, endpoint) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)

# Top 5 endpoints by request volume
topk(5, sum by (endpoint) (rate(http_requests_total[5m])))

# Memory usage percentage
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
/
node_memory_MemTotal_bytes * 100

# Disk space remaining (will fill in X hours)
predict_linear(node_filesystem_free_bytes[6h], 3600 * 24)
```

## Recording Rules

When a PromQL query is expensive, pre-compute it with recording rules:

```yaml
groups:
  - name: sli-recording-rules
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: sum by (job) (rate(http_requests_total[5m]))

      - record: job:http_errors:rate5m
        expr: sum by (job) (rate(http_requests_total{status_code=~"5.."}[5m]))

      - record: job:http_error_ratio:rate5m
        expr: |
          job:http_errors:rate5m
          /
          job:http_requests:rate5m

      - record: job:http_latency_p99:rate5m
        expr: |
          histogram_quantile(0.99,
            sum by (job, le) (rate(http_request_duration_seconds_bucket[5m]))
          )
```

## Alerting Rules

```yaml
groups:
  - name: service-alerts
    rules:
      - alert: HighErrorRate
        expr: job:http_error_ratio:rate5m > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.job }}"
          description: "Error rate is {{ $value | humanizePercentage }}"
          runbook: "https://wiki.internal/runbooks/high-error-rate"

      - alert: HighLatency
        expr: job:http_latency_p99:rate5m > 1.0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High p99 latency on {{ $labels.job }}"
          description: "p99 is {{ $value | humanizeDuration }}"

      - alert: DiskWillFill
        expr: predict_linear(node_filesystem_free_bytes[6h], 3600 * 24) < 0
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Disk will fill within 24 hours"
```

## Grafana Dashboard Design

```
DASHBOARD LAYOUT BEST PRACTICES

+----------------------------------------------------------+
|  SERVICE OVERVIEW: checkout-api                   [24h v] |
+----------------------------------------------------------+
|  [ Request Rate ]  [ Error Rate ]  [ p99 Latency ]       |
|  [   2.4k rps   ]  [   0.02%   ]  [    85ms     ]       |
+----------------------------------------------------------+
|                                                          |
|  REQUEST RATE                    ERROR RATE               |
|  +------------------------+     +------------------------+
|  |    ___/\____           |     |                  ___   |
|  |___/        \___        |     |_________________/   \_ |
|  +------------------------+     +------------------------+
|                                                          |
|  LATENCY DISTRIBUTION           SATURATION               |
|  +------------------------+     +------------------------+
|  | p99 -----              |     | CPU:  [====    ] 42%   |
|  | p95 ---                |     | Mem:  [======  ] 65%   |
|  | p50 --                 |     | Disk: [===     ] 31%   |
|  +------------------------+     +------------------------+
|                                                          |
+----------------------------------------------------------+
```

### Grafana Dashboard as Code (JSON model)

```json
{
  "dashboard": {
    "title": "Service Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "timeseries",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{service=\"checkout\"}[5m]))",
            "legendFormat": "requests/sec"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 }
      },
      {
        "title": "Error Rate",
        "type": "timeseries",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{service=\"checkout\",status=~\"5..\"}[5m])) / sum(rate(http_requests_total{service=\"checkout\"}[5m])) * 100",
            "legendFormat": "error %"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 }
      }
    ]
  }
}
```

## Alertmanager Configuration

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: "https://hooks.slack.com/services/xxx"

route:
  receiver: "default"
  group_by: ["alertname", "service"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: "pagerduty-critical"
      repeat_interval: 1h
    - match:
        severity: warning
      receiver: "slack-warnings"

receivers:
  - name: "default"
    slack_configs:
      - channel: "#alerts-default"

  - name: "pagerduty-critical"
    pagerduty_configs:
      - service_key: "<pagerduty-key>"

  - name: "slack-warnings"
    slack_configs:
      - channel: "#alerts-warnings"
        title: "{{ .GroupLabels.alertname }}"
        text: "{{ .CommonAnnotations.summary }}"
```

## Exercises

1. **PromQL drill**: Write queries for the following:
   - Total request rate across all services
   - Error rate for the `payment-service` only
   - p95 latency broken down by HTTP method
   - Predict when disk will be full based on the last 12 hours of data

2. **Recording rules**: Create recording rules that pre-compute the SLI for a service with a 99.9% availability SLO. The SLI should count requests with status < 500 as "good."

3. **Alert design**: Write alerting rules for:
   - Error budget burn rate exceeding 10x
   - Memory usage above 90% for 10 minutes
   - No metrics received from a target for 5 minutes (target down)

4. **Dashboard sketch**: On paper or in a tool, sketch a Grafana dashboard for a service. Include: stat panels for key numbers, time series for trends, and a heatmap for latency distribution.

5. **Config from scratch**: Write a complete `prometheus.yml` that scrapes three services running on ports 8080, 8081, and 8082, with a 10-second scrape interval and Kubernetes pod discovery.

---

[Next: Lesson 06 - Logging -->](06-logging.md)
