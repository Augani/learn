# Lesson 03: Error Budgets

## Spending Reliability Like Money

You have a monthly budget of $1,000 for dining out. You do not starve yourself to save every penny, and you do not blow it all on day one. You make deliberate choices about how to spend it.

Error budgets work the same way. If your SLO is 99.9% availability, that 0.1% of allowed failure is your budget. You **spend** it on things that matter: shipping features, running experiments, migrating infrastructure.

```
YOUR ERROR BUDGET = A SPENDING ACCOUNT

  +-----------------------------------+
  |  SLO: 99.9% over 30 days         |
  |                                   |
  |  Total minutes in 30 days: 43,200 |
  |  Allowed failure: 0.1% = 43.2 min|
  |                                   |
  |  +-----------------------------+  |
  |  | ERROR BUDGET: 43.2 minutes  |  |
  |  +-----------------------------+  |
  |                                   |
  |  Spent so far:                    |
  |    Deploy rollback:    5 min      |
  |    DB failover:       12 min      |
  |    Network blip:       2 min      |
  |                       --------    |
  |    Total spent:       19 min      |
  |    Remaining:         24.2 min    |
  |                                   |
  +-----------------------------------+
```

## The Core Idea

Error budgets resolve the fundamental tension between development velocity and system reliability.

```
WITHOUT ERROR BUDGETS:

  Dev Team                    Ops Team
  "Ship faster!"  <-------> "Don't break things!"
       |                          |
       v                          v
  Endless conflict. No objective way to decide.


WITH ERROR BUDGETS:

  Dev Team                    Ops Team
       |                          |
       +--------+  +---------+   |
                |  |              |
                v  v              |
         ERROR BUDGET             |
         (Objective data)    <----+
                |
                v
     Budget remaining? --> Ship features
     Budget exhausted? --> Fix reliability
```

## How Error Budgets Are Calculated

```
Error Budget = 1 - SLO Target

  SLO = 99.9%
  Error Budget = 100% - 99.9% = 0.1%

Apply to time window:

  30-day window = 43,200 minutes
  Budget = 43,200 * 0.001 = 43.2 minutes

Apply to request count:

  1,000,000 requests per month
  Budget = 1,000,000 * 0.001 = 1,000 failed requests
```

### Budget by SLO Level

| SLO | Error Budget | Monthly Downtime | Monthly Failed Requests (per 1M) |
|-----|-------------|-----------------|----------------------------------|
| 99% | 1% | 7.3 hours | 10,000 |
| 99.5% | 0.5% | 3.6 hours | 5,000 |
| 99.9% | 0.1% | 43.2 minutes | 1,000 |
| 99.95% | 0.05% | 21.6 minutes | 500 |
| 99.99% | 0.01% | 4.32 minutes | 100 |

## Error Budget Policies

An error budget policy defines what happens when the budget runs low or runs out. This is where the magic happens: decisions become data-driven.

```
ERROR BUDGET POLICY

  Budget Status          Actions
  +------------------+  +--------------------------------+
  | > 50% remaining  |  | Ship freely. Run experiments.  |
  |                  |  | Aggressive feature development.|
  +------------------+  +--------------------------------+
  | 25-50% remaining |  | Ship with caution. Extra       |
  |                  |  | review on risky changes.       |
  +------------------+  +--------------------------------+
  | 5-25% remaining  |  | Freeze non-critical deploys.   |
  |                  |  | Focus on reliability fixes.    |
  +------------------+  +--------------------------------+
  | < 5% remaining   |  | Full freeze. All engineering   |
  |                  |  | effort on reliability.         |
  +------------------+  +--------------------------------+
  | EXHAUSTED        |  | No deploys until budget        |
  |                  |  | replenishes. Incident review.  |
  +------------------+  +--------------------------------+
```

### Sample Policy Document

```yaml
service: checkout-api
slo: 99.95%
window: rolling 30 days
budget_total: 21.6 minutes

policy:
  green:
    condition: "budget_remaining > 50%"
    actions:
      - "Normal release cadence"
      - "Experiments and migrations allowed"

  yellow:
    condition: "25% < budget_remaining <= 50%"
    actions:
      - "Extra code review for risky changes"
      - "No large migrations without SRE approval"

  orange:
    condition: "5% < budget_remaining <= 25%"
    actions:
      - "Freeze non-critical deployments"
      - "Prioritize reliability improvements"
      - "Notify engineering leadership"

  red:
    condition: "budget_remaining <= 5%"
    actions:
      - "Complete deployment freeze"
      - "All hands on reliability"
      - "Daily SLO review meetings"

  exhausted:
    condition: "budget_remaining <= 0"
    actions:
      - "No changes except reliability fixes"
      - "Postmortem required for every incident"
      - "Executive review of service roadmap"
```

## Tracking Budget Burn Rate

It is not just about how much budget remains, but how fast you are burning it.

```
HEALTHY BURN RATE
Budget |============================|
       |========================    |  <-- Day 15, 80% left
       |                            |      On track
       0%                        100%

DANGEROUS BURN RATE
Budget |============================|
       |========                    |  <-- Day 5, 30% left
       |                            |      Burning too fast!
       0%                        100%

BURN RATE FORMULA:
  burn_rate = budget_consumed / time_elapsed

  If burn_rate > 1.0, you will exhaust the budget
  before the window ends.
```

### Prometheus Alert for Budget Burn

```yaml
groups:
  - name: slo-burn-rate
    rules:
      - alert: HighErrorBudgetBurn
        expr: |
          (
            1 - (
              sum(rate(http_requests_total{code!~"5.."}[1h]))
              /
              sum(rate(http_requests_total[1h]))
            )
          ) > (14.4 * 0.001)
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error budget burning 14.4x faster than sustainable"

      - alert: SlowErrorBudgetBurn
        expr: |
          (
            1 - (
              sum(rate(http_requests_total{code!~"5.."}[6h]))
              /
              sum(rate(http_requests_total[6h]))
            )
          ) > (6 * 0.001)
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Error budget burning 6x faster than sustainable"
```

## Multi-Window, Multi-Burn-Rate Alerts

Google's approach uses multiple windows to catch both fast burns and slow burns:

```
FAST BURN (catch outages quickly):
  Short window: 1 hour at 14.4x burn rate
  --> Alerts within minutes of a major incident

SLOW BURN (catch degradations):
  Long window: 6 hours at 6x burn rate
  --> Catches sustained issues that slip under the radar

+---Time--->
|
|  XXXXXXXXX         <-- Fast burn: Spike in errors
|  X       X             Caught in ~2 minutes
|  X       X
|  X       XXXXX...
|
|     xxxxxxxxxxxxxxxxxxxx  <-- Slow burn: Gradual degradation
|     x                         Caught in ~30 minutes
|     x
+---
```

## Error Budgets and Release Velocity

The relationship between error budgets and shipping speed:

```
BUDGET HEALTHY           BUDGET EXHAUSTED
+-----------------+      +-----------------+
| Deploy 5x/day  |      | Deploy 0x/day   |
| Run experiments |      | Fix reliability |
| Migrate DBs    |      | Write tests     |
| A/B tests      |      | Add monitoring  |
+-----------------+      +-----------------+
      |                        |
      v                        v
  Innovation                Stability
  (spending budget)         (replenishing budget)
```

This creates a natural oscillation:
1. Ship features, consume error budget
2. Budget gets low, slow down
3. Fix reliability, budget replenishes
4. Resume shipping features
5. Repeat

## Who Owns the Error Budget?

```
+--------------------------------------------------+
|                                                  |
|  Product Team: Decides WHAT to build             |
|       |                                          |
|       v                                          |
|  Dev Team: Decides HOW to build it               |
|       |                                          |
|       v                                          |
|  SRE Team: Measures reliability, tracks budget   |
|       |                                          |
|       v                                          |
|  Everyone: Agrees on error budget POLICY         |
|                                                  |
+--------------------------------------------------+

The error budget belongs to the PRODUCT TEAM.
They decide how to spend it.
SRE tracks it and enforces the policy.
```

## Common Pitfalls

**Pitfall 1: Gaming the budget**
Teams exclude certain errors to make the budget look healthier. Fix: Define what counts as a "valid event" clearly in the SLO spec.

**Pitfall 2: No policy enforcement**
The budget hits zero and nothing changes. Fix: Get leadership buy-in before the first budget exhaustion.

**Pitfall 3: One-size-fits-all budgets**
A login service and an analytics dashboard should not have the same SLO. Fix: Different services get different SLOs based on user impact.

**Pitfall 4: Ignoring dependencies**
Your service is at 99.99% but your database is at 99.9%. Your real reliability is bounded by the weakest link.

```
YOUR SERVICE: 99.99%
       |
       +---> DB: 99.9%
       |
       +---> Cache: 99.95%
       |
       +---> Auth: 99.99%

REAL AVAILABILITY <= min(99.99%, 99.9%, 99.95%, 99.99%)
                   = 99.9% (bounded by DB)
```

## Exercises

1. **Budget math**: Your service handles 10 million requests per day. Your SLO is 99.95% over 30 days. How many failed requests can you have per month? Per day (on average)?

2. **Write a policy**: Create an error budget policy for a service you work on. Define at least four tiers (green/yellow/orange/red) with specific actions for each.

3. **Burn rate alert**: Your 30-day error budget is 43.2 minutes. You have consumed 20 minutes in the first 5 days. What is your burn rate? Will you exhaust the budget before the window ends? At what day will you run out?

4. **Dependency analysis**: Map out the dependencies of a service you own. If each dependency has an SLO, what is the theoretical maximum reliability of your service?

5. **Scenario planning**: Your error budget just hit zero with 10 days left in the window. Product wants to ship a major feature next week. Write the email you would send to the product manager explaining the situation.

---

[Next: Lesson 04 - Metrics -->](04-metrics.md)
