# Lesson 08: Observability as a Platform Service

## The Hospital Monitoring Analogy

In a hospital, every patient gets the same baseline monitoring: heart rate,
blood pressure, oxygen saturation, temperature. The monitors are standardized
— nurses don't build custom monitoring rigs for each patient. The readings
feed into a central station where staff can see every patient at once. Alarms
trigger automatically when readings fall outside normal ranges.

Now imagine if every patient's family had to bring their own monitoring
equipment, wire it up themselves, and watch the readings manually. That's
what happens when every engineering team builds their own observability
stack.

Observability as a platform service means: every service gets monitoring
automatically. Standard dashboards. Standard alerts. Standard on-call
routing. Teams focus on their application logic, not on configuring
Prometheus scrapers.

```
  WITHOUT OBSERVABILITY PLATFORM:

  Team A: Prometheus + Grafana (self-managed, 2019 config)
  Team B: Datadog (cloud, expensive)
  Team C: console.log("debugging payment flow...")
  Team D: "We check if it's working by trying the app"

  WITH OBSERVABILITY PLATFORM:

  +================================================================+
  |  OBSERVABILITY PLATFORM                                         |
  |                                                                |
  |  Every service automatically gets:                              |
  |  [Metrics] [Traces] [Logs] [Dashboard] [Alerts] [On-call]     |
  |                                                                |
  +================================================================+
       |          |          |          |          |
  Team A    Team B     Team C     Team D     Team E
  (all use the same platform — zero setup)
```

## The Three Pillars (Plus Two)

Observability has three classic pillars — metrics, traces, and logs — but
modern platforms add two more: profiling and error tracking.

```
  OBSERVABILITY PILLARS:

  +----------+  +----------+  +----------+  +----------+  +----------+
  | METRICS  |  | TRACES   |  | LOGS     |  | PROFILES |  | ERRORS   |
  +----------+  +----------+  +----------+  +----------+  +----------+
  | Numeric  |  | Request  |  | Event    |  | CPU/mem  |  | Exception|
  | time     |  | flow     |  | records  |  | flame    |  | tracking |
  | series   |  | across   |  | for      |  | graphs   |  | grouping |
  |          |  | services |  | debugging|  |          |  | alerting |
  | "What's  |  | "Where   |  | "What    |  | "Why is  |  | "What's  |
  |  broken?"|  |  is it   |  |  happened|  |  it      |  |  failing |
  |          |  |  slow?"  |  |  exactly?"|  |  slow?" |  |  now?"   |
  +----------+  +----------+  +----------+  +----------+  +----------+
       |              |              |              |              |
       +--------------+--------------+--------------+--------------+
                                |
                    +------------------------+
                    | CORRELATION ENGINE     |
                    | Link metrics to traces |
                    | to logs to profiles    |
                    +------------------------+
```

## Standardized Instrumentation

The platform's most important job: make instrumentation automatic. If
developers have to add instrumentation manually, they won't do it
consistently.

### OpenTelemetry as the Standard

OpenTelemetry (OTel) is the CNCF standard for telemetry collection. It's
vendor-neutral, which means you can switch backends without re-instrumenting.

```
  OPENTELEMETRY ARCHITECTURE:

  +-------------------+     +------------------+     +----------------+
  | Application       |     | OTel Collector   |     | Backends       |
  | (instrumented)    |     | (platform-managed)|    |                |
  +-------------------+     +------------------+     +----------------+
  | OTel SDK          |     |                  |     |                |
  | - Auto-instrument |---->| Receivers        |     | Metrics:       |
  | - Manual spans    |     | - OTLP           |---->| Prometheus/    |
  | - Metrics API     |     | - Prometheus     |     | Mimir          |
  |                   |     |                  |     |                |
  |                   |     | Processors       |     | Traces:        |
  |                   |     | - Batch          |---->| Tempo/Jaeger   |
  |                   |     | - Attributes     |     |                |
  |                   |     | - Tail sampling  |     | Logs:          |
  |                   |     |                  |---->| Loki           |
  |                   |     | Exporters        |     |                |
  |                   |     | - OTLP           |     | Profiles:      |
  |                   |     | - Prometheus     |---->| Pyroscope      |
  |                   |     | - Loki           |     |                |
  +-------------------+     +------------------+     +----------------+
```

### Auto-Instrumentation

The platform team can inject auto-instrumentation without developers changing
a single line of code. On Kubernetes, use the OpenTelemetry Operator:

```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: platform-auto-instrumentation
  namespace: opentelemetry-system
spec:
  exporter:
    endpoint: http://otel-collector.opentelemetry-system:4317
  propagators:
    - tracecontext
    - baggage
  sampler:
    type: parentbased_traceidratio
    argument: "0.1"

  go:
    image: ghcr.io/open-telemetry/opentelemetry-go-instrumentation/autoinstrumentation-go:latest
  java:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-java:latest
  python:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-python:latest
  nodejs:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-nodejs:latest
```

Developers opt in with a single annotation:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-service
spec:
  template:
    metadata:
      annotations:
        instrumentation.opentelemetry.io/inject-go: "true"
```

That's it. The service now emits traces, metrics, and spans — with no code
changes.

### Manual Instrumentation for Business Logic

Auto-instrumentation covers HTTP requests, database calls, and gRPC. But
business-specific spans need manual instrumentation. The platform provides
a thin wrapper:

```go
package platform

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

var (
	tracer = otel.Tracer("platform")
	meter  = otel.Meter("platform")
)

func StartSpan(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	return tracer.Start(ctx, name, trace.WithAttributes(attrs...))
}

func RecordDuration(ctx context.Context, name string, start time.Time, attrs ...attribute.KeyValue) {
	histogram, _ := meter.Float64Histogram(name + "_duration_seconds")
	histogram.Record(ctx, time.Since(start).Seconds(), metric.WithAttributes(attrs...))
}

func IncrementCounter(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	counter, _ := meter.Int64Counter(name + "_total")
	counter.Add(ctx, 1, metric.WithAttributes(attrs...))
}
```

Developers use it for business-critical paths:

```go
func (s *PaymentService) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResult, error) {
	ctx, span := platform.StartSpan(ctx, "process_payment",
		attribute.String("payment.method", req.Method),
		attribute.Float64("payment.amount", req.Amount),
	)
	defer span.End()
	start := time.Now()
	defer platform.RecordDuration(ctx, "payment_processing", start,
		attribute.String("method", req.Method),
	)

	result, err := s.gateway.Charge(ctx, req)
	if err != nil {
		span.RecordError(err)
		platform.IncrementCounter(ctx, "payment_failures",
			attribute.String("reason", classifyError(err)),
		)
		return nil, err
	}

	platform.IncrementCounter(ctx, "payment_successes",
		attribute.String("method", req.Method),
	)
	return result, nil
}
```

## OTel Collector Configuration

The OTel Collector is the central telemetry pipeline. The platform team
deploys and manages it:

```yaml
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: platform-collector
  namespace: opentelemetry-system
spec:
  mode: daemonset
  config:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
      prometheus:
        config:
          scrape_configs:
            - job_name: kubernetes-pods
              kubernetes_sd_configs:
                - role: pod
              relabel_configs:
                - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
                  action: keep
                  regex: "true"

    processors:
      batch:
        timeout: 5s
        send_batch_size: 1000
      attributes:
        actions:
          - key: cluster
            value: production-us-east-1
            action: upsert
          - key: platform.version
            value: "3.1"
            action: upsert
      tail_sampling:
        decision_wait: 10s
        policies:
          - name: errors
            type: status_code
            status_code:
              status_codes: [ERROR]
          - name: slow-requests
            type: latency
            latency:
              threshold_ms: 1000
          - name: sample-rest
            type: probabilistic
            probabilistic:
              sampling_percentage: 10
      memory_limiter:
        check_interval: 5s
        limit_mib: 512
        spike_limit_mib: 128

    exporters:
      prometheusremotewrite:
        endpoint: http://mimir:9009/api/v1/push
      otlp/tempo:
        endpoint: tempo:4317
        tls:
          insecure: true
      loki:
        endpoint: http://loki:3100/loki/api/v1/push

    service:
      pipelines:
        metrics:
          receivers: [otlp, prometheus]
          processors: [memory_limiter, batch, attributes]
          exporters: [prometheusremotewrite]
        traces:
          receivers: [otlp]
          processors: [memory_limiter, tail_sampling, batch, attributes]
          exporters: [otlp/tempo]
        logs:
          receivers: [otlp]
          processors: [memory_limiter, batch, attributes]
          exporters: [loki]
```

## Shared Dashboards

Every service registered in the platform gets a standard dashboard
automatically. This is generated from the service catalog metadata.

```
  STANDARD SERVICE DASHBOARD:

  +====================================================================+
  |  payments-service                    [staging] [production]        |
  +====================================================================+
  |                                                                    |
  |  REQUEST RATE          ERROR RATE           LATENCY (p99)          |
  |  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐    |
  |  │ 1,247 req/s    │   │ 0.3%            │   │ 142ms           │    |
  |  │ ▁▂▃▄▅▆▇█▇▆▅▄  │   │ ▁▁▁▁▂▁▁▁▁▁▁▁  │   │ ▂▂▃▃▂▂▃▂▂▃▂▂  │    |
  |  └────────────────┘   └────────────────┘   └────────────────┘    |
  |                                                                    |
  |  PODS                  CPU USAGE            MEMORY USAGE           |
  |  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐    |
  |  │ 5/5 running    │   │ 34% of limit   │   │ 62% of limit   │    |
  |  │ ✓✓✓✓✓          │   │ ▃▃▄▃▃▃▄▃▃▃▃▃  │   │ ▅▅▅▅▅▆▅▅▅▅▅▅  │    |
  |  └────────────────┘   └────────────────┘   └────────────────┘    |
  |                                                                    |
  |  DEPENDENCIES                                                      |
  |  +-------------------+--------+----------+----------+             |
  |  | Dependency        | Status | Latency  | Errors   |             |
  |  +-------------------+--------+----------+----------+             |
  |  | payments-db       | ✓ OK   | 3ms p99  | 0%       |             |
  |  | user-service      | ✓ OK   | 12ms p99 | 0.1%     |             |
  |  | fraud-detection   | ⚠ SLOW | 890ms p99| 0%       |             |
  |  | stripe-api        | ✓ OK   | 145ms p99| 0.2%     |             |
  |  +-------------------+--------+----------+----------+             |
  |                                                                    |
  |  RECENT DEPLOYMENTS                                                |
  |  2025-01-15 10:30 | v1.45.2 | deployed by: alice | ✓ healthy     |
  |  2025-01-14 14:22 | v1.45.1 | deployed by: bob   | ✓ healthy     |
  +====================================================================+
```

### Dashboard-as-Code with Grafana

Generate dashboards programmatically using Grafonnet (Jsonnet library):

```jsonnet
local grafana = import 'grafonnet/grafana.libsonnet';
local dashboard = grafana.dashboard;
local prometheus = grafana.prometheus;
local graphPanel = grafana.graphPanel;
local row = grafana.row;

local serviceDashboard(serviceName) =
  dashboard.new(
    title='%s Service Dashboard' % serviceName,
    tags=['platform', 'auto-generated'],
    editable=false,
    refresh='30s',
  )
  .addRow(
    row.new(title='Request Metrics')
    .addPanel(
      graphPanel.new(
        title='Request Rate',
        datasource='Mimir',
      )
      .addTarget(
        prometheus.target(
          'sum(rate(http_server_request_duration_seconds_count{service_name="%s"}[5m]))' % serviceName,
          legendFormat='requests/s',
        )
      )
    )
    .addPanel(
      graphPanel.new(
        title='Error Rate',
        datasource='Mimir',
      )
      .addTarget(
        prometheus.target(
          'sum(rate(http_server_request_duration_seconds_count{service_name="%s",http_status_code=~"5.."}[5m])) / sum(rate(http_server_request_duration_seconds_count{service_name="%s"}[5m]))' % [serviceName, serviceName],
          legendFormat='error rate',
        )
      )
    )
    .addPanel(
      graphPanel.new(
        title='Latency (p99)',
        datasource='Mimir',
      )
      .addTarget(
        prometheus.target(
          'histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket{service_name="%s"}[5m])) by (le))' % serviceName,
          legendFormat='p99',
        )
      )
    )
  );

serviceDashboard('payments-service')
```

### Automated Dashboard Provisioning

When a service registers in the catalog, a controller creates its dashboard:

```yaml
apiVersion: platform.acme.com/v1
kind: DashboardTemplate
metadata:
  name: standard-service-dashboard
spec:
  triggerOn:
    kind: Component
    type: service
    lifecycle: production

  grafana:
    folder: "Platform Auto-Generated"
    template: standard-service
    variables:
      serviceName: "{{ .metadata.name }}"
      team: "{{ .spec.owner }}"
      sloTarget: "99.9"
```

## Alert Routing

Standardized alerting means developers don't configure PagerDuty or Slack
integrations — the platform routes alerts based on service ownership.

```
  ALERT ROUTING FLOW:

  Prometheus Alert
       |
       v
  +----------+     +-----------+     +------------------+
  | Alert-   |---->| Routing   |---->| PagerDuty        |
  | manager  |     | rules     |     | (on-call team)   |
  +----------+     | (by team) |     +------------------+
                   |           |
                   |           |---->| Slack             |
                   |           |     | (#team-alerts)    |
                   |           |     +------------------+
                   |           |
                   |           |---->| Email             |
                   |           |     | (team DL)         |
                   +-----------+     +------------------+
```

### Alertmanager Configuration

```yaml
global:
  resolve_timeout: 5m
  pagerduty_url: https://events.pagerduty.com/v2/enqueue

route:
  receiver: platform-default
  group_by: [alertname, service, namespace]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: pagerduty-oncall
      continue: true
    - match:
        severity: critical
      receiver: slack-critical
    - match:
        severity: warning
      receiver: slack-warnings

receivers:
  - name: platform-default
    slack_configs:
      - channel: '#platform-alerts'
        api_url: https://hooks.slack.com/services/xxx
        title: '{{ .GroupLabels.alertname }}'
        text: >-
          *Service:* {{ .GroupLabels.service }}
          *Severity:* {{ .CommonLabels.severity }}
          *Description:* {{ .CommonAnnotations.description }}

  - name: pagerduty-oncall
    pagerduty_configs:
      - routing_key_file: /etc/alertmanager/pagerduty-key
        severity: '{{ .CommonLabels.severity }}'
        description: '{{ .CommonAnnotations.summary }}'
        details:
          service: '{{ .GroupLabels.service }}'
          namespace: '{{ .GroupLabels.namespace }}'
          runbook: '{{ .CommonAnnotations.runbook_url }}'

  - name: slack-critical
    slack_configs:
      - channel: '#incidents'
        api_url: https://hooks.slack.com/services/xxx
        color: danger
        title: 'CRITICAL: {{ .GroupLabels.alertname }}'

  - name: slack-warnings
    slack_configs:
      - channel: '#platform-warnings'
        api_url: https://hooks.slack.com/services/xxx
        color: warning
```

## Standard Alert Rules

The platform provides standard alerts for every service. Teams can add
custom alerts, but the baseline is automatic:

```yaml
groups:
  - name: platform-service-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_server_request_duration_seconds_count{http_status_code=~"5.."}[5m])) by (service_name)
          /
          sum(rate(http_server_request_duration_seconds_count[5m])) by (service_name)
          > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service_name }}"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"
          runbook_url: "https://runbooks.internal/high-error-rate"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_server_request_duration_seconds_bucket[5m])) by (service_name, le)
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High p99 latency on {{ $labels.service_name }}"
          description: "p99 latency is {{ $value | humanizeDuration }}"

      - alert: PodRestarts
        expr: |
          increase(kube_pod_container_status_restarts_total[1h]) > 3
        labels:
          severity: warning
        annotations:
          summary: "Pod {{ $labels.pod }} restarting frequently"

      - alert: HighMemoryUsage
        expr: |
          container_memory_working_set_bytes / container_spec_memory_limit_bytes > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.pod }} memory usage above 90%"

      - alert: SLOBurnRateHigh
        expr: |
          sum(rate(http_server_request_duration_seconds_count{http_status_code!~"5.."}[1h])) by (service_name)
          /
          sum(rate(http_server_request_duration_seconds_count[1h])) by (service_name)
          < 0.999
        for: 5m
        labels:
          severity: critical
          slo: availability
        annotations:
          summary: "SLO burn rate high for {{ $labels.service_name }}"
          description: "Availability is {{ $value | humanizePercentage }}, target: 99.9%"
```

## On-Call Automation

The platform can automate common on-call tasks based on alert type:

```
  ON-CALL AUTOMATION:

  Alert fires
       |
       v
  +-----------+
  | Classify  |
  | alert     |
  +-----------+
       |
       +-----> Known issue? ----> Auto-remediate
       |       (runbook exists)   (restart pod, scale up, failover)
       |
       +-----> Unknown? -------> Page on-call
       |                          + Context: dashboard link,
       |                            recent deploys, recent changes
       |
       +-----> Noise? ----------> Suppress, track for tuning
```

## Exercises

1. **Instrumentation audit.** Pick three services at your organization.
   For each: are they emitting metrics, traces, and logs? Are the formats
   consistent? Is there auto-instrumentation or is it all manual?

2. **Standard dashboard.** Design a standard service dashboard for your
   organization. What metrics should every service show? Build it as code
   using Grafonnet or Terraform.

3. **Alert rules.** Write five standard alert rules that should apply to
   every service: error rate, latency, resource usage, availability, and
   deployment health.

4. **OTel Collector config.** Design an OTel Collector pipeline for your
   organization. Choose receivers, processors, and exporters. Include
   tail sampling to control costs.
