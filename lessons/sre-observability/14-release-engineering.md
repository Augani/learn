# Lesson 14: Release Engineering

## The Restaurant Soft Opening

A new restaurant does not open to full capacity on day one. First, friends and family come. Then a small public group. Then larger groups. They work out kinks at each stage. If the kitchen cannot keep up, they slow the rollout before the Yelp reviews pile up.

Release engineering is the discipline of shipping software the same way: **gradually, with feedback at each stage, and the ability to pull back instantly**.

```
RISKY RELEASE              PROGRESSIVE RELEASE
+-----------------+        +-----------------+
| Deploy to ALL   |        | Deploy to 1%    |
| servers at once | ---->  |    |             |
| Hope for the    |        |    v  OK?        |
| best            |        | Deploy to 10%   |
|                 |        |    |             |
| If broken:      |        |    v  OK?        |
| EVERYONE is     |        | Deploy to 50%   |
| affected        |        |    |             |
+-----------------+        |    v  OK?        |
                           | Deploy to 100%  |
                           +-----------------+
                           If broken at 1%:
                           only 1% affected.
```

## Deployment Strategies

### Blue-Green Deployment

```
BLUE-GREEN

  Load Balancer
       |
  +----+----+
  |         |
  v         v
+------+  +------+
| BLUE |  |GREEN |
| v2.3 |  | v2.4 |
|(live) |  |(idle)|
+------+  +------+

Step 1: Deploy v2.4 to GREEN (BLUE still serving)
Step 2: Test GREEN internally
Step 3: Switch load balancer to GREEN
Step 4: GREEN is now live, BLUE is idle
Step 5: If problems: switch back to BLUE instantly

  +--------+  Switch  +--------+
  | BLUE   | =======> | GREEN  |
  | (live) |          | (live) |
  +--------+          +--------+
  Rollback: just switch back. Takes seconds.
```

### Canary Deployment

```
CANARY DEPLOYMENT

  Load Balancer
       |
  +----+---------+
  |              |
  v              v
+------+      +------+
| v2.3 |      | v2.4 |
| 95%  |      |  5%  |  <-- Canary
+------+      +------+

Phase 1: 5% traffic to canary
  Monitor: latency, errors, business metrics
  Duration: 15 minutes

Phase 2: 25% traffic to canary
  Monitor: same metrics at higher traffic
  Duration: 30 minutes

Phase 3: 50% traffic
  Duration: 1 hour

Phase 4: 100% rollout

AUTOMATIC ROLLBACK if:
  - Error rate > 2x baseline
  - p99 latency > 2x baseline
  - Any business metric degrades
```

### Rolling Update

```
ROLLING UPDATE (3 replicas)

  Time 0: [v2.3] [v2.3] [v2.3]

  Time 1: [v2.4] [v2.3] [v2.3]
           ^-- First pod updated

  Time 2: [v2.4] [v2.4] [v2.3]
                   ^-- Second pod updated

  Time 3: [v2.4] [v2.4] [v2.4]
                          ^-- All updated

  Kubernetes config:
  maxSurge: 1       (at most 1 extra pod during update)
  maxUnavailable: 0 (never fewer than 3 healthy pods)
```

### Kubernetes Deployment Strategy

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
        - name: checkout
          image: checkout:v2.4.0
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 10
```

## Feature Flags

Feature flags decouple deployment from release. You deploy code to production but only activate it for specific users.

```
WITHOUT FLAGS              WITH FLAGS
+-----------------+        +-----------------+
| Deploy = Release|        | Deploy: code    |
| Code goes live  |        |   is on servers |
| for everyone    |        |                 |
| immediately     |        | Release: flag   |
|                 |        |   controls who  |
|                 |        |   sees it       |
+-----------------+        +-----------------+

PROGRESSIVE ROLLOUT WITH FLAGS:

  Day 1: Internal employees only (flag: internal_users)
  Day 2: 1% of users (flag: percentage_rollout = 1)
  Day 3: 10% of users
  Day 5: 50% of users
  Day 7: 100% of users
  Day 14: Remove flag, clean up old code path
```

### Feature Flag Implementation

```python
from feature_flags import FeatureFlags

flags = FeatureFlags(provider="launchdarkly")

def checkout(user, cart):
    if flags.is_enabled("new-payment-flow", user):
        return new_payment_flow(user, cart)
    return legacy_payment_flow(user, cart)
```

```yaml
# Feature flag configuration
flags:
  new-payment-flow:
    description: "New Stripe-based payment flow"
    default: false
    rules:
      - condition: "user.email ends_with @company.com"
        value: true
      - condition: "user.id in beta_users"
        value: true
      - condition: "random_percent < 10"
        value: true
```

## Canary Analysis with Metrics

```
AUTOMATED CANARY ANALYSIS

  Baseline (v2.3)          Canary (v2.4)
  +------------------+     +------------------+
  | Error rate: 0.1% |     | Error rate: 0.3% |
  | p99: 120ms       |     | p99: 180ms       |
  | Success: 99.9%   |     | Success: 99.7%   |
  +------------------+     +------------------+
          |                         |
          +--------+  +------------+
                   |  |
                   v  v
          +------------------+
          | CANARY ANALYSIS  |
          +------------------+
          | Error rate diff: |
          |   0.2% (>0.1%   |
          |   threshold)     |
          |                  |
          | VERDICT: FAIL    |
          | ACTION: ROLLBACK |
          +------------------+
```

### Argo Rollouts Canary

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: checkout
spec:
  replicas: 5
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: { duration: 10m }
        - analysis:
            templates:
              - templateName: success-rate
            args:
              - name: service-name
                value: checkout
        - setWeight: 25
        - pause: { duration: 30m }
        - analysis:
            templates:
              - templateName: success-rate
        - setWeight: 50
        - pause: { duration: 1h }
        - setWeight: 100
      rollbackWindow:
        revisions: 2

---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
    - name: service-name
  metrics:
    - name: success-rate
      interval: 5m
      successCondition: result[0] >= 0.999
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{
              service="{{args.service-name}}",
              status!~"5.."
            }[5m]))
            /
            sum(rate(http_requests_total{
              service="{{args.service-name}}"
            }[5m]))
```

## Release Safeguards

```
RELEASE PIPELINE WITH SAFEGUARDS

  Code merged to main
       |
       v
  [CI: Build + Unit Tests]
       |
       v
  [Integration Tests]
       |
       v
  [Deploy to Staging]
       |
       v
  [Smoke Tests on Staging]
       |
       v
  [Deploy Canary (5%)] -----> [Monitor 15 min]
       |                            |
       | (metrics OK)               | (metrics BAD)
       v                            v
  [Increase to 25%]            [Auto-rollback]
       |
       | (metrics OK)
       v
  [Full rollout]
       |
       v
  [Post-deploy verification]
```

## Rollback Strategies

```
INSTANT ROLLBACK
  Keep previous version ready:
  - Blue-green: switch traffic back
  - Kubernetes: kubectl rollout undo
  - Feature flag: disable the flag

  SPEED: Seconds to minutes

DATABASE ROLLBACK (harder)
  Schema changes are tricky:
  - Forward-compatible migrations only
  - Never drop columns immediately
  - Use expand-contract pattern:
    1. Add new column
    2. Write to both old and new
    3. Migrate data
    4. Read from new column
    5. Stop writing to old column
    6. Drop old column (weeks later)

  SPEED: Cannot "undo" easily. Must roll forward.
```

```
EXPAND-CONTRACT MIGRATION

  v1: [user_name column]
       |
  v2: [user_name] + [first_name, last_name]  <-- Expand
       Write to all three columns
       |
  v3: Read from [first_name, last_name]       <-- Migrate
       Still write to user_name for rollback safety
       |
  v4: Stop writing to [user_name]             <-- Contract
       |
  v5: Drop [user_name] column                 <-- Cleanup
       (weeks after v4, once no rollback risk)
```

## Exercises

1. **Strategy selection**: For each scenario, choose the best deployment strategy (blue-green, canary, rolling, feature flag) and explain why:
   - Database schema migration
   - New payment provider integration
   - UI redesign
   - Performance optimization with no behavior change
   - Risky algorithm change in recommendation engine

2. **Canary config**: Write an Argo Rollouts manifest for a service that does a 5-step canary (5%, 10%, 25%, 50%, 100%) with automated analysis at each step. Define the AnalysisTemplate that checks both error rate and p99 latency.

3. **Feature flag design**: Design a feature flag system for a new checkout flow. Define: flag name, targeting rules (internal users, beta users, percentage rollout), metrics to monitor, and rollback criteria.

4. **Rollback plan**: Your latest deploy introduced a database migration. Write a rollback plan that covers: how to detect the problem, how to roll back the application code, and how to handle the database change (forward-only migration).

5. **Release pipeline**: Design a complete release pipeline from code merge to production. Include at least 5 stages with specific checks at each stage. Define what triggers an automatic rollback.

---

[Next: Lesson 15 - On-Call -->](15-on-call.md)
