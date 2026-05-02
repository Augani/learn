# SRE & Observability Track

## Your Path to Keeping Systems Alive at Scale

```
  YOU ARE HERE
      |
      v
+==========================================+
|        SRE & OBSERVABILITY TRACK         |
+==========================================+
|                                          |
|  FOUNDATIONS                             |
|  ---------                               |
|  01. What is SRE?                        |
|  02. SLIs, SLOs, and SLAs               |
|  03. Error Budgets                       |
|                                          |
|  OBSERVABILITY PILLARS                   |
|  --------------------                    |
|  04. Metrics                             |
|  05. Prometheus & Grafana                |
|  06. Logging                             |
|  07. Distributed Tracing                 |
|  08. Three Pillars Together              |
|                                          |
|  INCIDENT RESPONSE                       |
|  -----------------                       |
|  09. Alerting                            |
|  10. Incident Management                 |
|  11. Postmortems                         |
|                                          |
|  RELIABILITY ENGINEERING                 |
|  -----------------------                 |
|  12. Chaos Engineering                   |
|  13. Capacity Planning                   |
|  14. Release Engineering                 |
|  15. On-Call                             |
|  16. Building Reliable Systems           |
|                                          |
+==========================================+
```

## Who This Track Is For

You build or operate software systems and want to move beyond "it works on my machine" to "it works reliably for millions of users." You may have touched monitoring before, but you want the full picture.

## Prerequisites

- Basic understanding of distributed systems (System Design track, Lesson 01)
- Familiarity with containers and Kubernetes (Kubernetes track, Lessons 01-03)
- Comfortable reading YAML and basic command-line usage

## What You Will Learn

```
BEFORE THIS TRACK          AFTER THIS TRACK
+------------------+       +---------------------------+
| "The server is   |       | "Latency p99 spiked on    |
|  down again"     | ----> |  the checkout service.     |
|                  |       |  Traces show a slow DB     |
|                  |       |  query. Deploying fix via  |
|                  |       |  canary with error budget  |
|                  |       |  still at 40%."            |
+------------------+       +---------------------------+
```

## Lesson Map

| #  | Lesson | Key Takeaway |
|----|--------|-------------|
| 01 | What is SRE? | SRE is what happens when you treat operations as a software problem |
| 02 | SLIs, SLOs, SLAs | Reliability is a feature you measure, not a feeling |
| 03 | Error Budgets | You spend reliability like money |
| 04 | Metrics | The four golden signals tell you how your system feels |
| 05 | Prometheus & Grafana | Collect, query, visualize, alert |
| 06 | Logging | Structured logs are searchable; unstructured logs are noise |
| 07 | Distributed Tracing | Follow a request across 20 services |
| 08 | Three Pillars | Metrics, logs, and traces work together |
| 09 | Alerting | If everything alerts, nothing alerts |
| 10 | Incident Management | Structured chaos beats unstructured panic |
| 11 | Postmortems | Blame fixes nothing; systems thinking fixes everything |
| 12 | Chaos Engineering | Break things on purpose before they break by accident |
| 13 | Capacity Planning | Plan for the traffic you will have, not the traffic you have |
| 14 | Release Engineering | Ship fast without breaking things |
| 15 | On-Call | Sustainable on-call keeps people and systems healthy |
| 16 | Building Reliable Systems | Design for failure from day one |

## Reference Materials

- [Tools Comparison](reference-tools.md) - SRE and observability tool landscape
- [Runbook Template](reference-runbook-template.md) - Template for incident runbooks

## How to Use This Track

Each lesson is 5-10 minutes of reading. Do one per day or binge them all. The exercises at the end of each lesson reinforce the concepts. You do not need a cluster to start; many exercises are thought experiments or config-writing practice.

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Site Reliability Engineering** by Betsy Beyer, Chris Jones, Jennifer Petoff, and Niall Richard Murphy (O'Reilly, 2016) — How Google runs production. *Free at sre.google/books*
- **Observability Engineering** by Charity Majors, Liz Fong-Jones, and George Miranda (O'Reilly, 2022) — Modern observability practices

---

[Start with Lesson 01: What is SRE? -->](01-what-is-sre.md)
