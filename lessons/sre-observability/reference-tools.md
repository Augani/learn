# Reference: SRE & Observability Tools Comparison

## Metrics

```
+------------------+----------+----------+----------+----------+
| Feature          |Prometheus| Datadog  | New Relic| Grafana  |
|                  |          |          |          | Mimir    |
+------------------+----------+----------+----------+----------+
| Type             | OSS      | SaaS     | SaaS     | OSS      |
| Query Language   | PromQL   | Custom   | NRQL     | PromQL   |
| Storage          | Local    | Managed  | Managed  | Object   |
|                  | TSDB     |          |          | store    |
| Long-term store  | Limited  | Yes      | Yes      | Yes      |
| Cost model       | Infra    | Per host | Per GB   | Infra    |
| K8s integration  | Excellent| Good     | Good     | Excellent|
| Alerting         | Built-in | Built-in | Built-in | Grafana  |
+------------------+----------+----------+----------+----------+

WHEN TO USE:
  Prometheus:   Default choice for Kubernetes-native stacks
  Grafana Mimir: Prometheus-compatible, scales to billions of series
  Datadog:      All-in-one SaaS, strong integrations, higher cost
  New Relic:    APM-focused, good for application performance
```

## Logging

```
+------------------+----------+----------+----------+----------+
| Feature          | ELK      | Loki     | Splunk   | Datadog  |
|                  | Stack    |          |          | Logs     |
+------------------+----------+----------+----------+----------+
| Type             | OSS      | OSS      | SaaS/On- | SaaS     |
|                  |          |          | prem     |          |
| Full-text search | Yes      | No       | Yes      | Yes      |
| Index strategy   | Full     | Labels   | Full     | Full     |
|                  | content  | only     | content  | content  |
| Storage cost     | High     | Low      | Very high| High     |
| Query language   | KQL/     | LogQL    | SPL      | Custom   |
|                  | Lucene   |          |          |          |
| Grafana native   | Plugin   | Built-in | Plugin   | Plugin   |
| Scale            | Medium   | High     | High     | High     |
+------------------+----------+----------+----------+----------+

WHEN TO USE:
  Loki:     Budget-friendly, Grafana-native, label-based queries
  ELK:      Need full-text search across log content
  Splunk:   Enterprise, compliance requirements, deep analytics
  Datadog:  Already using Datadog for metrics
```

## Tracing

```
+------------------+----------+----------+----------+----------+
| Feature          | Jaeger   | Tempo    | Zipkin   | Datadog  |
|                  |          |          |          | APM      |
+------------------+----------+----------+----------+----------+
| Type             | OSS      | OSS      | OSS      | SaaS     |
| Backend storage  | ES/Cass/ | Object   | ES/Cass/ | Managed  |
|                  | Kafka    | store    | MySQL    |          |
| OTel native      | Yes      | Yes      | Yes      | Yes      |
| Sampling         | Head     | Head +   | Head     | Head +   |
|                  |          | Tail     |          | Tail     |
| Grafana native   | Plugin   | Built-in | Plugin   | No       |
| Service map      | Yes      | Via      | Yes      | Yes      |
|                  |          | Grafana  |          |          |
| Cost             | Infra    | Low      | Infra    | High     |
+------------------+----------+----------+----------+----------+

WHEN TO USE:
  Tempo:    Grafana stack, cost-effective, scales well
  Jaeger:   Mature OSS option, CNCF graduated
  Zipkin:   Simpler setup, good for smaller deployments
  Datadog:  Already using Datadog ecosystem
```

## Incident Management

```
+------------------+----------+----------+----------+----------+
| Feature          |PagerDuty | OpsGenie | Rootly   |incident. |
|                  |          |          |          |io        |
+------------------+----------+----------+----------+----------+
| Alerting         | Yes      | Yes      | Via      | Via      |
|                  |          |          | integr.  | integr.  |
| Escalation       | Yes      | Yes      | Yes      | Yes      |
| Slack integration| Yes      | Yes      | Excellent| Excellent|
| Postmortems      | Basic    | Basic    | Built-in | Built-in |
| Status pages     | Yes      | Yes      | Yes      | Yes      |
| Runbooks         | Basic    | Basic    | Yes      | Yes      |
| Pricing          | Per user | Per user | Per user | Per user |
+------------------+----------+----------+----------+----------+

WHEN TO USE:
  PagerDuty:  Industry standard, broadest integrations
  OpsGenie:   Atlassian ecosystem (Jira, Confluence)
  Rootly:     Slack-native incident management
  incident.io: Modern, developer-friendly, strong automation
```

## Chaos Engineering

```
+------------------+----------+----------+----------+----------+
| Feature          | Litmus   | Gremlin  | Chaos    | Chaos    |
|                  | Chaos    |          | Toolkit  | Mesh     |
+------------------+----------+----------+----------+----------+
| Type             | OSS      | SaaS     | OSS      | OSS      |
| K8s native       | Yes      | Yes      | Plugin   | Yes      |
| Network chaos    | Yes      | Yes      | Yes      | Yes      |
| Pod/container    | Yes      | Yes      | Yes      | Yes      |
| Cloud provider   | Limited  | Yes      | Yes      | No       |
| GameDay support  | Yes      | Yes      | No       | No       |
| Cost             | Free     | High     | Free     | Free     |
+------------------+----------+----------+----------+----------+

WHEN TO USE:
  Litmus Chaos: Kubernetes-native, CNCF project, free
  Gremlin:      Enterprise features, managed GameDays
  Chaos Toolkit: Scriptable, CI/CD-friendly, lightweight
  Chaos Mesh:    Kubernetes-focused, fine-grained control
```

## Load Testing

```
+------------------+----------+----------+----------+----------+
| Feature          | k6       | Locust   | Gatling  | JMeter   |
+------------------+----------+----------+----------+----------+
| Language         |JavaScript| Python   | Scala/   | GUI/XML  |
|                  |          |          | Java     |          |
| Protocol         | HTTP,    | HTTP,    | HTTP,    | HTTP,    |
|                  | gRPC,    | Custom   | WebSocket| JMS,     |
|                  | WebSocket|          |          | FTP,...  |
| Cloud option     | k6 Cloud | None     | Gatling  | BlazeMtr |
|                  |          |          | Cloud    |          |
| CI/CD friendly   | Excellent| Good     | Good     | Poor     |
| Learning curve   | Low      | Low      | Medium   | Medium   |
+------------------+----------+----------+----------+----------+

WHEN TO USE:
  k6:      Modern, developer-friendly, CI/CD native
  Locust:  Python teams, custom protocols
  Gatling: JVM shops, detailed reports
  JMeter:  Legacy, broadest protocol support
```

## The Grafana Stack (LGTM)

```
A popular open-source observability stack:

  L = Loki    (Logs)
  G = Grafana (Visualization)
  T = Tempo   (Traces)
  M = Mimir   (Metrics)

  +-----------------------------------------------------------+
  |                      GRAFANA                               |
  |  (Unified dashboard for all signals)                      |
  +---+-------------------+-------------------+---------------+
      |                   |                   |
      v                   v                   v
  +--------+         +--------+          +--------+
  |  Mimir |         |  Loki  |          | Tempo  |
  |(Metrics)|        | (Logs) |          |(Traces)|
  +--------+         +--------+          +--------+
      ^                   ^                   ^
      |                   |                   |
  +---+-------------------+-------------------+---+
  |              OTel Collector                    |
  |  (Receives, processes, exports all signals)   |
  +-----------------------------------------------+
      ^         ^         ^         ^         ^
      |         |         |         |         |
    App 1     App 2     App 3     App 4     App 5

  ADVANTAGES:
    - Single query language family (PromQL / LogQL / TraceQL)
    - Native correlation between signals
    - Open-source, avoid vendor lock-in
    - Cost-effective at scale
```

## Decision Tree

```
CHOOSING YOUR STACK

  Budget < $500/month?
    |
    YES --> Grafana LGTM stack (self-hosted)
    |
    NO --> Team size < 5?
              |
              YES --> Grafana Cloud (free tier + paid)
              |
              NO --> Need compliance/enterprise?
                        |
                        YES --> Datadog or Splunk + PagerDuty
                        |
                        NO --> Grafana LGTM + PagerDuty
                               or incident.io
```

---

[Back to Track Overview](00-roadmap.md)
