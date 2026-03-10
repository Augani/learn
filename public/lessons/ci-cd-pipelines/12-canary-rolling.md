# Lesson 12: Canary & Rolling Deployments

> **The one thing to remember**: A canary deployment is like taste-testing
> a new recipe on 5 customers before serving it to 500. If those 5 get
> sick, you stop immediately. A rolling deployment is like replacing
> floor tiles one at a time while people keep walking — no one notices,
> and you can stop if a tile doesn't fit.

---

## The Coal Mine Canary

Miners used to carry canaries into coal mines. If the air was toxic,
the canary would react first — an early warning system. Canary
deployments work the same way: send a small percentage of traffic to
the new version first. If it's "toxic" (errors, slowness), you detect
it before it affects everyone.

```
CANARY DEPLOYMENT TIMELINE

  Time    v1.0 (old)    v2.0 (canary)    Traffic Split
  ----    ----------    -------------    -------------
  T+0     100%          0%               All old
  T+1     95%           5%               Canary gets 5%
  T+5     95%           5%               Monitoring...
  T+10    90%           10%              Looks good, increase
  T+20    75%           25%              Still good
  T+30    50%           50%              Half and half
  T+45    25%           75%              Almost there
  T+60    0%            100%             Full rollout!

  If problems detected at any point:
  T+5     95%           5%               Error rate high!
  T+6     100%          0%               ROLLBACK (only 5% affected)
```

---

## Canary Deployment Architecture

```
CANARY ARCHITECTURE

                    +-------------------+
  Users ──────────> |   Load Balancer   |
                    | (traffic routing) |
                    +--------+----------+
                             |
                    Weight: 95% / 5%
                             |
              +--------------+--------------+
              |                             |
              v                             v
     +----------------+           +----------------+
     | v1.0 (stable)  |           | v2.0 (canary)  |
     |                |           |                |
     | 10 instances   |           | 1 instance     |
     |                |           |                |
     | Serves 95%     |           | Serves 5%      |
     | of traffic     |           | of traffic     |
     +----------------+           +----------------+
              |                             |
              v                             v
     +----------------+           +----------------+
     | Metrics:        |           | Metrics:        |
     | Error rate: 0.1%|           | Error rate: 0.1%|
     | Latency: 50ms  |           | Latency: 55ms  |
     +----------------+           +----------------+
                    |                   |
                    v                   v
              +---------------------------+
              | Compare metrics           |
              | If canary is worse → STOP |
              | If canary is same → GROW  |
              +---------------------------+
```

---

## Canary with Nginx

```nginx
# nginx.conf — weighted traffic splitting
upstream stable {
    server app-v1:3000;
}

upstream canary {
    server app-v2:3000;
}

split_clients "${remote_addr}" $upstream_variant {
    95%   stable;
    5%    canary;
}

server {
    listen 80;

    location / {
        proxy_pass http://$upstream_variant;
        proxy_set_header X-Canary-Group $upstream_variant;
    }
}
```

The `split_clients` directive hashes the client IP address and sends
95% of unique IPs to stable and 5% to canary. The same user always
hits the same version (sticky routing).

---

## Canary with GitHub Actions

```yaml
name: Canary Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t myapp:${{ github.sha }} .
      - run: docker push myapp:${{ github.sha }}

  canary:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy canary (5% traffic)
        run: |
          kubectl set image deployment/myapp-canary \
            app=myapp:${{ github.sha }}
          kubectl scale deployment/myapp-canary --replicas=1

      - name: Wait and monitor (5 minutes)
        run: |
          sleep 300
          ERROR_RATE=$(curl -s http://metrics/api/v1/query \
            --data-urlencode 'query=rate(http_errors{version="canary"}[5m])' \
            | jq '.data.result[0].value[1]')
          if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
            echo "Canary error rate too high: $ERROR_RATE"
            exit 1
          fi

      - name: Promote canary to full rollout
        if: success()
        run: |
          kubectl set image deployment/myapp \
            app=myapp:${{ github.sha }}
          kubectl rollout status deployment/myapp

      - name: Rollback canary on failure
        if: failure()
        run: |
          kubectl rollout undo deployment/myapp-canary
          echo "Canary failed! Rolled back."
```

---

## Rolling Deployments

A rolling deployment replaces instances one at a time. At any point,
some instances run the old version and some run the new version.

```
ROLLING DEPLOYMENT (4 instances)

  Time    Instance 1    Instance 2    Instance 3    Instance 4
  ----    ----------    ----------    ----------    ----------
  T+0     v1.0          v1.0          v1.0          v1.0
  T+1     UPDATING      v1.0          v1.0          v1.0
  T+2     v2.0          v1.0          v1.0          v1.0
  T+3     v2.0          UPDATING      v1.0          v1.0
  T+4     v2.0          v2.0          v1.0          v1.0
  T+5     v2.0          v2.0          UPDATING      v1.0
  T+6     v2.0          v2.0          v2.0          v1.0
  T+7     v2.0          v2.0          v2.0          UPDATING
  T+8     v2.0          v2.0          v2.0          v2.0

  During update:
  - Some users hit v1.0, some hit v2.0
  - Always at least 3 instances handling traffic
  - If v2.0 fails health check, stop the rollout
```

```
ROLLING UPDATE PARAMETERS

  Parameter              What It Controls
  -----------------------------------------------
  maxUnavailable: 1      At most 1 instance down at a time
  maxSurge: 1            Can temporarily have 1 extra instance
  minReadySeconds: 30    Wait 30s after healthy before continuing
  progressDeadlineSeconds: 300  Fail if rollout takes >5 min
```

### Rolling Deployment with Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    spec:
      containers:
        - name: app
          image: myapp:2.0.0
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

The `readinessProbe` is critical — Kubernetes won't send traffic to a
new instance until it passes the health check. If the health check
never passes, the rollout stops automatically.

---

## Progressive Delivery

Progressive delivery combines canary, feature flags, and automated
analysis:

```
PROGRESSIVE DELIVERY PIPELINE

  Deploy to 1% of users
       |
       v
  Automated analysis (5 min)
  Compare: error rate, latency, CPU
       |
       ├── Worse than baseline → AUTO ROLLBACK
       └── Same or better → Continue
              |
              v
  Deploy to 10% of users
       |
       v
  Automated analysis (10 min)
       |
       ├── Worse → AUTO ROLLBACK
       └── Good → Continue
              |
              v
  Deploy to 50% of users
       |
       v
  Automated analysis (15 min)
       |
       ├── Worse → AUTO ROLLBACK
       └── Good → Continue
              |
              v
  Deploy to 100% of users
       |
       v
  Full rollout complete
```

---

## Traffic Shifting Patterns

```
TRAFFIC SHIFTING STRATEGIES

  LINEAR:
  0% → 10% → 20% → 30% → ... → 100%
  Even steps, predictable timing
  Good for: Low-risk changes

  EXPONENTIAL:
  0% → 1% → 5% → 25% → 50% → 100%
  Starts cautious, accelerates when confident
  Good for: Medium-risk changes

  MANUAL GATES:
  0% → 5% (human approval) → 50% (human approval) → 100%
  Human decides when to proceed
  Good for: High-risk changes, regulated industries

  ALL-AT-ONCE (Blue-Green):
  0% → 100%
  Instant switch, rely on fast rollback
  Good for: Simple applications, when you trust your tests
```

---

## Comparing Deployment Strategies

```
STRATEGY COMPARISON

  Factor            Blue-Green     Canary        Rolling
  -----------------------------------------------------------
  Downtime          Zero           Zero          Near-zero
  Rollback speed    Instant        Fast          Slow (roll back
                                                 one by one)
  Risk exposure     100% or 0%     Gradual       Gradual
  Infrastructure    2x (doubled)   1x + 1 extra  1x (same)
  Complexity        Low            Medium        Low-Medium
  Mixed versions    No             Yes (brief)   Yes (during roll)
  Database risk     Medium         Medium        Medium
  Best for          Simple apps,   Large apps,   Container
                    fast rollback  risk-averse   orchestration
```

```
DECISION GUIDE

  How much traffic risk can you tolerate?

  "Zero — I want all-or-nothing"
  → Blue-Green

  "I want to test on a few users first"
  → Canary

  "I just want to replace instances gradually"
  → Rolling

  "I want automated progressive delivery with metrics"
  → Canary + automated analysis (Argo Rollouts, Flagger)
```

---

## Common Pitfalls

```
PITFALL                                  FIX
---------------------------------------------------------------
No health checks on new instances        Add readiness probes
Both versions need different DB schema   Use backward-compatible migrations
Sticky sessions route canary users       Use request-level routing
to old version after expansion           not session-level
Canary too small to generate             Use at least 1-5% traffic
meaningful metrics                       for statistical significance
Rolling update goes too fast             Add minReadySeconds: 30+
No automated rollback criteria           Define SLO thresholds upfront
```

---

## Exercises

1. **Canary simulation**: Deploy two versions of a simple app behind
   Nginx with weighted routing. Use `split_clients` to send 10% to
   the new version.

2. **Rolling update**: If you have access to Kubernetes (or minikube),
   deploy an app with 4 replicas and do a rolling update. Watch the
   pods transition with `kubectl get pods -w`.

3. **Metric comparison**: Define what metrics you would compare between
   canary and stable for your application. Error rate? Latency?
   Business metrics (conversion rate)?

4. **Rollback practice**: Deploy a deliberately broken version as a
   canary. Practice detecting the problem and rolling back.

---

[Next: Lesson 13 — Feature Flags](./13-feature-flags.md)
