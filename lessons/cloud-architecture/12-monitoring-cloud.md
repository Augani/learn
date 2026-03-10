# Lesson 12: Monitoring in the Cloud

## The Big Analogy: Car Dashboard

```
YOUR CAR DASHBOARD                    CLOUD MONITORING

  [RPM] [Speed] [Fuel] [Temp]        [CPU] [Latency] [Errors] [Cost]
     |      |      |      |              |       |        |       |
     v      v      v      v              v       v        v       v
  Warning lights when                  Alerts when thresholds
  something goes wrong                 are breached

  Check engine light =                 CloudWatch alarm =
  "something is wrong,                 "something is wrong,
   look deeper"                         look deeper"
```

## CloudWatch: AWS Native Monitoring

```
CLOUDWATCH ARCHITECTURE

  EC2  Lambda  RDS  ECS  ALB  ...
   |     |      |    |    |
   +-----+------+----+----+
                |
                v
        +----------------+
        |   CloudWatch   |
        |                |
        | Metrics -----> Alarms -----> SNS -----> PagerDuty
        | Logs --------> Insights     Email
        | Dashboards     Filters      Slack
        +----------------+
```

### CloudWatch Metrics and Alarms

```hcl
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "high-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "CPU above 80% for 15 minutes"

  dimensions = {
    InstanceId = aws_instance.web.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "api_errors" {
  alarm_name          = "high-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "More than 50 5xx errors per minute"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
```

### Custom Metrics

```python
import boto3

cloudwatch = boto3.client("cloudwatch")

def publish_queue_depth(queue_name: str, depth: int) -> None:
    cloudwatch.put_metric_data(
        Namespace="MyApp/Queues",
        MetricData=[
            {
                "MetricName": "QueueDepth",
                "Dimensions": [
                    {"Name": "QueueName", "Value": queue_name},
                ],
                "Value": depth,
                "Unit": "Count",
            },
        ],
    )

def publish_business_metric(metric: str, value: float) -> None:
    cloudwatch.put_metric_data(
        Namespace="MyApp/Business",
        MetricData=[
            {
                "MetricName": metric,
                "Value": value,
                "Unit": "None",
            },
        ],
    )
```

### CloudWatch Logs Insights

```
LOGS INSIGHTS QUERY LANGUAGE

  fields @timestamp, @message
  | filter @message like /ERROR/
  | stats count(*) as errorCount by bin(5m)
  | sort errorCount desc
  | limit 20
```

```
fields @timestamp, @message, @logStream
| filter @message like /timeout/
| parse @message "Request * timed out after *ms" as requestId, duration
| stats avg(duration), max(duration), count() by bin(1h)
```

## AWS X-Ray: Distributed Tracing

```
X-RAY SERVICE MAP

  Client --> API GW --> Lambda --> DynamoDB
                |                    |
                |                    +---> S3
                |
                +--> SQS --> Lambda --> RDS

  Each arrow = a traced segment
  X-Ray stitches them into a full trace
  Shows latency at every hop
```

```python
from aws_xray_sdk.core import xray_recorder, patch_all

patch_all()

@xray_recorder.capture("process_order")
def process_order(order_id: str) -> dict:
    subsegment = xray_recorder.begin_subsegment("validate_order")
    subsegment.put_annotation("order_id", order_id)

    validated = validate(order_id)

    xray_recorder.end_subsegment()

    subsegment = xray_recorder.begin_subsegment("charge_payment")
    result = charge(validated)
    xray_recorder.end_subsegment()

    return result
```

## Prometheus + Grafana on Cloud

```
PROMETHEUS ON EKS

  +--------+  +--------+  +--------+
  | Pod A  |  | Pod B  |  | Pod C  |
  |/metrics|  |/metrics|  |/metrics|
  +---+----+  +---+----+  +---+----+
      |            |            |
      +------+-----+------+----+
             |             |
      +------v------+ +---v--------+
      | Prometheus  | | Prometheus |
      | (scrapes)   | | (scrapes)  |
      +------+------+ +---+--------+
             |             |
             v             v
      +------------------------+
      |    Thanos / Cortex     |
      | (long-term storage,    |
      |  deduplication)        |
      +----------+-------------+
                 |
                 v
          +-----------+
          |  Grafana  |
          | Dashboards|
          +-----------+
```

### Amazon Managed Prometheus/Grafana

```hcl
resource "aws_prometheus_workspace" "main" {
  alias = "production-metrics"

  logging_configuration {
    log_group_arn = "${aws_cloudwatch_log_group.prometheus.arn}:*"
  }
}

resource "aws_grafana_workspace" "main" {
  name                     = "production-dashboards"
  account_access_type      = "CURRENT_ACCOUNT"
  authentication_providers = ["AWS_SSO"]
  permission_type          = "SERVICE_MANAGED"
  role_arn                 = aws_iam_role.grafana.arn

  data_sources = ["PROMETHEUS", "CLOUDWATCH", "XRAY"]
}
```

## Alerting Strategy

```
ALERT SEVERITY LEVELS

  P1 (Critical)     Revenue impact, data loss
  +-----------+     Response: Immediate, page on-call
  | WAKE UP!  |     Example: Database down, payment failures
  +-----------+

  P2 (High)         Degraded service, partial outage
  +-----------+     Response: Within 30 min, page during hours
  | ACT NOW   |     Example: High error rate, queue backlog
  +-----------+

  P3 (Medium)       Performance degradation
  +-----------+     Response: Next business day
  | PLAN FIX  |     Example: Slow queries, disk 70%
  +-----------+

  P4 (Low)          Informational
  +-----------+     Response: Sprint planning
  | NICE TO   |     Example: Certificate expiring in 30d
  | KNOW      |
  +-----------+
```

### Composite Alarms

```hcl
resource "aws_cloudwatch_composite_alarm" "service_health" {
  alarm_name = "service-unhealthy"

  alarm_rule = join(" AND ", [
    "ALARM(${aws_cloudwatch_metric_alarm.high_errors.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.high_latency.alarm_name})",
  ])

  alarm_actions = [aws_sns_topic.pagerduty.arn]
}
```

## The Four Golden Signals Dashboard

```
+--------------------------------------------------+
|            SERVICE HEALTH DASHBOARD               |
|                                                   |
|  Latency (p50/p95/p99)    Error Rate (%)         |
|  +------------------+     +------------------+   |
|  |    ___           |     |          ___     |   |
|  |   /   \__        |     |         /        |   |
|  |  /       \___    |     |    ____/         |   |
|  | /            \   |     |   /              |   |
|  +------------------+     +------------------+   |
|                                                   |
|  Traffic (req/sec)         Saturation (%)         |
|  +------------------+     +------------------+   |
|  |       ___        |     |              ___ |   |
|  |      /   \       |     |          ___/    |   |
|  |  ___/     \___   |     |      ___/        |   |
|  | /             \  |     |  ___/            |   |
|  +------------------+     +------------------+   |
+--------------------------------------------------+
```

## Exercises

1. Create CloudWatch alarms for an ECS service that alert on:
   - CPU > 80% for 10 minutes
   - Memory > 85% for 10 minutes
   - Healthy host count < 2

2. Write a CloudWatch Logs Insights query to find the slowest API endpoints from structured JSON logs.

3. Set up a Prometheus ServiceMonitor for a Kubernetes deployment that scrapes `/metrics` every 15 seconds.

4. Design a Grafana dashboard JSON model with panels for the four golden signals.

5. Create a composite CloudWatch alarm that fires only when both error rate AND latency are elevated.

## Key Takeaways

```
+-------------------------------------------+
| CLOUD MONITORING ESSENTIALS               |
|                                           |
| 1. CloudWatch = native AWS monitoring     |
| 2. X-Ray = distributed tracing in AWS     |
| 3. Prometheus+Grafana = k8s standard      |
| 4. Alert on symptoms, not causes          |
| 5. Use composite alarms to reduce noise   |
| 6. Dashboard the four golden signals      |
+-------------------------------------------+
```
