# Lesson 09: Alerting

## The Boy Who Cried Wolf

The shepherd boy cried "Wolf!" so many times that when the real wolf came, nobody responded. This is **alert fatigue**: when your pager goes off 50 times a day, you stop caring about page 51, even if that one is the real production outage.

```
ALERT FATIGUE CYCLE

  Too many alerts --> Engineers ignore alerts
        ^                      |
        |                      v
  Add more alerts <-- Outage gets missed
  "to catch everything"

THE FIX:
  Fewer, better alerts --> Engineers trust alerts
        ^                        |
        |                        v
  Remove noisy alerts <-- Respond quickly to real issues
```

## What Makes a Good Alert?

Every alert must pass this test:

```
+---------------------------------------------------+
|           THE ALERT QUALITY CHECKLIST              |
+---------------------------------------------------+
|                                                   |
|  [ ] ACTIONABLE: Someone needs to do something    |
|      RIGHT NOW when this fires                    |
|                                                   |
|  [ ] URGENT: It cannot wait until morning         |
|      (if paging on-call)                          |
|                                                   |
|  [ ] REAL: It indicates actual user impact,       |
|      not just a number crossing a line            |
|                                                   |
|  [ ] CLEAR: The alert tells you what is wrong     |
|      and where to start investigating             |
|                                                   |
|  [ ] RARE ENOUGH: If it fires daily, it is not    |
|      an alert; it is normal behavior              |
|                                                   |
+---------------------------------------------------+

If an alert fails ANY of these, it should be:
  - A dashboard metric (not an alert)
  - A ticket (not a page)
  - Removed entirely
```

## Alert Severity Levels

```
+----------+------------------+---------------------------+
| SEVERITY | RESPONSE         | EXAMPLE                   |
+----------+------------------+---------------------------+
| P1/SEV1  | Page on-call     | Checkout is down for all  |
| CRITICAL | immediately.     | users. Revenue impact.    |
|          | Wake people up.  |                           |
+----------+------------------+---------------------------+
| P2/SEV2  | Page during      | Latency 5x normal.       |
| HIGH     | business hours.  | Some users affected.      |
|          | Respond in 30min.|                           |
+----------+------------------+---------------------------+
| P3/SEV3  | Slack channel.   | Disk at 80%. Will fill    |
| WARNING  | Respond same day.| in ~3 days.               |
+----------+------------------+---------------------------+
| P4/SEV4  | Ticket/backlog.  | Certificate expires in    |
| INFO     | Respond this     | 30 days.                  |
|          | sprint.          |                           |
+----------+------------------+---------------------------+
```

## Symptom-Based vs Cause-Based Alerts

```
CAUSE-BASED (fragile, noisy):
  "CPU > 80%"
  "Memory > 90%"
  "Disk IOPS > 5000"
  --> CPU might be 85% and everything is fine.
  --> You get paged for things that are not problems.

SYMPTOM-BASED (reliable, actionable):
  "Error rate > 1% for 5 minutes"
  "p99 latency > 2 seconds for 10 minutes"
  "Error budget burn rate > 10x"
  --> These mean USERS are affected.
  --> You get paged for real problems.

PREFER THIS:
  Symptoms  ---alert--->  Human investigates causes
  (not)
  Causes    ---alert--->  Human guesses if users care
```

## Multi-Window Burn Rate Alerts

The most effective alerting strategy for SLO-based services:

```
ERROR BUDGET: 43.2 minutes over 30 days

BURN RATE = (errors now) / (sustainable error rate)

If burn_rate = 1:   You will exactly exhaust budget in 30 days
If burn_rate = 10:  You will exhaust budget in 3 days
If burn_rate = 14.4: You will exhaust budget in 2 days
If burn_rate = 36:  You will exhaust budget in 20 hours

MULTI-WINDOW APPROACH:
+-------+------------+-----------+------------------+
| Alert | Long Window| Short Win | Catches          |
+-------+------------+-----------+------------------+
| Page  | 1h > 14.4x | 5m > 14.4x| Complete outage |
| Page  | 6h > 6x    | 30m > 6x  | Major degradation|
| Ticket| 3d > 1x    | 6h > 1x   | Slow burn       |
+-------+------------+-----------+------------------+

Why two windows?
  Long window: Reduces false positives (sustained issue)
  Short window: Ensures the problem is CURRENT, not historical
```

### Prometheus Implementation

```yaml
groups:
  - name: slo-burn-rate-alerts
    rules:
      - alert: ErrorBudgetFastBurn
        expr: |
          (
            job:slo_errors_per_request:ratio_rate1h{job="checkout"} > (14.4 * 0.001)
          and
            job:slo_errors_per_request:ratio_rate5m{job="checkout"} > (14.4 * 0.001)
          )
        labels:
          severity: critical
          team: checkout
        annotations:
          summary: "Checkout error budget burning fast (14.4x)"
          runbook: "https://runbooks.internal/checkout/high-error-rate"
          dashboard: "https://grafana.internal/d/checkout-slo"

      - alert: ErrorBudgetSlowBurn
        expr: |
          (
            job:slo_errors_per_request:ratio_rate6h{job="checkout"} > (6 * 0.001)
          and
            job:slo_errors_per_request:ratio_rate30m{job="checkout"} > (6 * 0.001)
          )
        labels:
          severity: high
          team: checkout
        annotations:
          summary: "Checkout error budget burning (6x)"
          runbook: "https://runbooks.internal/checkout/elevated-errors"
```

## Alert Routing with Alertmanager

```yaml
global:
  resolve_timeout: 5m

route:
  receiver: "default-slack"
  group_by: ["alertname", "service"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    - match:
        severity: critical
      receiver: "pagerduty-primary"
      repeat_interval: 15m
      continue: false

    - match:
        severity: high
      receiver: "pagerduty-low-urgency"
      repeat_interval: 1h

    - match:
        severity: warning
      receiver: "slack-warnings"
      repeat_interval: 12h

    - match:
        severity: info
      receiver: "slack-info"
      repeat_interval: 24h

inhibit_rules:
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: ["service"]

receivers:
  - name: "default-slack"
    slack_configs:
      - channel: "#alerts"

  - name: "pagerduty-primary"
    pagerduty_configs:
      - service_key: "<key>"
        severity: critical

  - name: "pagerduty-low-urgency"
    pagerduty_configs:
      - service_key: "<key>"
        severity: warning

  - name: "slack-warnings"
    slack_configs:
      - channel: "#alerts-warnings"

  - name: "slack-info"
    slack_configs:
      - channel: "#alerts-info"
```

## Runbooks

Every alert should link to a runbook. A runbook is a step-by-step guide for investigating and resolving the issue.

```
ALERT WITHOUT RUNBOOK:
  "HighErrorRate on checkout-service"
  --> On-call stares at screen at 3 AM. Where do I start?

ALERT WITH RUNBOOK:
  "HighErrorRate on checkout-service"
  Runbook: https://wiki/runbooks/checkout-high-errors
  --> On-call follows steps. Issue resolved in 10 minutes.

RUNBOOK STRUCTURE:
+----------------------------------------+
| 1. TRIAGE: Is this real user impact?   |
|    - Check dashboard: <link>           |
|    - Check status page: <link>         |
|                                        |
| 2. DIAGNOSE: What is causing it?       |
|    - Check logs: <query>               |
|    - Check traces: <link>              |
|    - Check dependencies: <list>        |
|                                        |
| 3. MITIGATE: Stop the bleeding         |
|    - Rollback: <command>               |
|    - Scale up: <command>               |
|    - Feature flag off: <command>       |
|                                        |
| 4. ESCALATE: When to wake someone up   |
|    - If step 3 does not work in 15 min |
|    - Contact: <team> via <channel>     |
+----------------------------------------+
```

## PagerDuty Integration

```
ESCALATION POLICY

  Alert fires
       |
       v
  [On-Call Primary] ---(acknowledge in 5 min?)---> YES: Investigating
       |                                               |
       NO (5 min timeout)                              v
       |                                          [RESOLVE]
       v
  [On-Call Secondary] ---(acknowledge in 5 min?)---> YES: Investigating
       |
       NO (5 min timeout)
       |
       v
  [Engineering Manager] ---(acknowledge in 10 min?)
       |
       NO
       |
       v
  [VP Engineering] (something is very wrong)
```

## Silencing and Maintenance Windows

```yaml
# Alertmanager silence (via API or UI)
{
  "matchers": [
    {"name": "service", "value": "checkout", "isRegex": false},
    {"name": "alertname", "value": "HighLatency", "isRegex": false}
  ],
  "startsAt": "2025-03-15T02:00:00Z",
  "endsAt": "2025-03-15T04:00:00Z",
  "createdBy": "alice",
  "comment": "Planned DB migration window"
}
```

## Alert Hygiene

Run this audit quarterly:

```
FOR EACH ALERT, ASK:
+---------------------------------------------------+
| 1. How many times did it fire last quarter?        |
|    0 times --> Consider removing (dead alert)      |
|    50+ times --> Noisy, fix the root cause or tune |
|                                                    |
| 2. What percentage were actionable?                |
|    < 50% --> Too noisy, tighten thresholds         |
|    > 90% --> Good alert                            |
|                                                    |
| 3. Does it have a runbook?                         |
|    No --> Write one or remove the alert            |
|                                                    |
| 4. Is it symptom-based or cause-based?             |
|    Cause-based --> Convert to symptom-based         |
|                                                    |
| 5. Did it ever wake someone up unnecessarily?      |
|    Yes --> Downgrade severity or fix threshold      |
+---------------------------------------------------+
```

## Exercises

1. **Alert audit**: List five alerts in your current system. For each, evaluate: Is it actionable? Symptom-based? Does it have a runbook? Score each 0-3 and identify the worst offender.

2. **Burn rate alerts**: Your SLO is 99.9% over 30 days. Write multi-window burn rate alert rules for: (a) fast burn (page immediately), (b) slow burn (ticket during business hours).

3. **Alertmanager config**: Write an Alertmanager configuration with three receivers (PagerDuty for critical, Slack for warnings, email for info) and an inhibition rule that suppresses warnings when a critical alert is firing for the same service.

4. **Runbook writing**: Pick an alert from your system and write a complete runbook with triage, diagnosis, mitigation, and escalation sections. Include specific commands and links.

5. **Noise reduction**: You receive 200 alerts per week. 150 are "DiskSpaceWarning" across 30 servers and 40 are "HighCPU" that auto-resolve in 2 minutes. Design a strategy to reduce alert volume by 80%.

---

[Next: Lesson 10 - Incident Management -->](10-incident-management.md)
