# Quick Reference: Deployment Patterns

> A compact comparison of deployment strategies. Use this to decide
> which pattern fits your application and risk tolerance.

---

## Strategy Overview

```
DEPLOYMENT STRATEGY SPECTRUM

  Simple ←───────────────────────────────→ Complex
  Risky  ←───────────────────────────────→ Safe

  Recreate    Rolling    Blue-Green    Canary    Progressive
  |           |          |             |         |
  v           v          v             v         v
  Kill old,   Replace    Two envs,     Small %   Automated
  start new   one by     instant       first,    canary with
              one        switch        grow      metrics
```

---

## At a Glance

```
COMPARISON TABLE

                  Recreate   Rolling   Blue-Green   Canary   Progressive
  -----------------------------------------------------------------------
  Downtime        YES        Near-zero  Zero        Zero     Zero
  Rollback speed  Slow       Slow       Instant     Fast     Fast
  Infra cost      1x         1x         2x          1x+1    1x+1
  Complexity      Lowest     Low        Medium      Medium   High
  Risk exposure   100%       Gradual    100% or 0%  Gradual  Gradual
  Mixed versions  No         Yes        No          Yes      Yes
  DB migrations   Simple     Careful    Careful     Careful  Careful
  Best for        Dev/test   General    Critical    Large    Enterprise
                  envs       purpose    apps        scale    grade
```

---

## Recreate (Stop, Then Start)

```
RECREATE DEPLOYMENT

  Time 1: v1 running     [████████████]
  Time 2: v1 stopped     [            ]  ← DOWNTIME
  Time 3: v2 starting    [░░░░░░░░░░░░]  ← DOWNTIME
  Time 4: v2 running     [████████████]

  Downtime: Minutes (depends on startup time)
```

**How it works:**
1. Stop all instances of the old version
2. Deploy the new version
3. Start all new instances

**Use when:**
- Development/testing environments
- Applications that can't handle two versions running simultaneously
- When downtime is acceptable (maintenance windows)

**Avoid when:**
- Users expect 24/7 availability
- Downtime has business cost

---

## Rolling Update

```
ROLLING UPDATE (4 instances)

  Time 1: [v1] [v1] [v1] [v1]     All old
  Time 2: [v2] [v1] [v1] [v1]     1 updated
  Time 3: [v2] [v2] [v1] [v1]     2 updated
  Time 4: [v2] [v2] [v2] [v1]     3 updated
  Time 5: [v2] [v2] [v2] [v2]     All new

  At any point, some traffic hits v1, some hits v2
  Capacity never drops below 3/4 instances
```

**How it works:**
1. Take one instance out of the load balancer
2. Deploy the new version to it
3. Health check the new instance
4. Add it back to the load balancer
5. Repeat for each instance

**Key parameters:**
```
maxUnavailable: 1    → At most 1 instance updating at a time
maxSurge: 1          → Can temporarily have 1 extra instance
minReadySeconds: 30  → Wait 30s after healthy before continuing
```

**Use when:**
- Running on Kubernetes or container orchestration
- Need zero downtime without extra infrastructure cost
- Acceptable for both versions to serve traffic briefly

**Avoid when:**
- Breaking changes between v1 and v2 (they'll coexist!)
- Need instant rollback (rolling back = rolling forward to old)

---

## Blue-Green

```
BLUE-GREEN DEPLOYMENT

  Before switch:
  Users → [Load Balancer] → BLUE (v1.0) ← LIVE
                             GREEN (v2.0) ← Testing

  After switch:
  Users → [Load Balancer] → BLUE (v1.0) ← Standby
                             GREEN (v2.0) ← LIVE

  Switch is instant (change load balancer target)
  Rollback is instant (switch back)
```

**How it works:**
1. Two identical environments: Blue (live) and Green (idle)
2. Deploy new version to Green
3. Test Green thoroughly
4. Switch load balancer from Blue to Green
5. Blue becomes the rollback target

**Use when:**
- Zero downtime is required
- Instant rollback is critical
- You can afford 2x infrastructure (temporarily)
- Database changes are backward-compatible

**Avoid when:**
- Budget doesn't allow double infrastructure
- Stateful applications with local storage
- Database schema changes are not backward-compatible

---

## Canary

```
CANARY DEPLOYMENT

  Phase 1:  95% → [v1.0]    5% → [v2.0]   Monitoring...
  Phase 2:  90% → [v1.0]   10% → [v2.0]   Metrics look good
  Phase 3:  75% → [v1.0]   25% → [v2.0]   Still monitoring
  Phase 4:  50% → [v1.0]   50% → [v2.0]   Looking great
  Phase 5:   0% → [v1.0]  100% → [v2.0]   Full rollout!

  If problems at any phase:
  ROLLBACK: 100% → [v1.0]    0% → [v2.0]  Only small % affected
```

**How it works:**
1. Deploy new version alongside old version
2. Route a small percentage of traffic to the new version
3. Monitor error rates, latency, and business metrics
4. Gradually increase traffic to the new version
5. If metrics degrade, route all traffic back to old version

**Traffic routing methods:**
```
METHOD              HOW                         STICKY?
--------------------------------------------------------------
Random %            Hash of request ID          No (per request)
User ID hash        Hash of user ID             Yes (per user)
IP hash             Hash of client IP           Yes (per IP)
Cookie-based        Set cookie on first visit   Yes (per browser)
Header-based        Custom header routing       No (per request)
Geographic          Route by region             Yes (per region)
```

**Use when:**
- Large user base (need statistical significance)
- Want to detect issues before full exposure
- Business metrics (conversion, revenue) matter
- Risk-averse deployment strategy needed

**Avoid when:**
- Very small user base (<100 active users for canary)
- Simple applications where blue-green suffices
- No monitoring infrastructure to compare versions

---

## Progressive Delivery

```
PROGRESSIVE DELIVERY (Automated Canary)

  Deploy → 1% traffic → Auto-analyze (5 min)
                              |
                    +---------+---------+
                    |                   |
               Metrics OK          Metrics BAD
                    |                   |
                    v                   v
           10% traffic          AUTO ROLLBACK
           Auto-analyze (10 min)
                    |
           +--------+--------+
           |                 |
      Metrics OK        Metrics BAD
           |                 |
           v                 v
     50% → 100%        AUTO ROLLBACK

  Key difference from Canary:
  AUTOMATED decisions based on metric comparison
  No human in the loop for each phase
```

**Tools:**
```
PROGRESSIVE DELIVERY TOOLS

  Tool              Platform       Features
  --------------------------------------------------
  Argo Rollouts     Kubernetes     Canary, blue-green,
                                   metric analysis
  Flagger           Kubernetes     Canary + Istio/Linkerd
  Spinnaker         Multi-cloud    Full delivery platform
  AWS CodeDeploy    AWS            Blue-green, canary
  LaunchDarkly      Any            Feature flag based
```

**Use when:**
- Operating at scale (thousands of instances)
- Have mature monitoring and alerting
- Need hands-free deployment
- Want to deploy continuously (multiple times per day)

**Avoid when:**
- Don't have metrics infrastructure
- Small team that can't support the tooling
- Simple applications that don't need this sophistication

---

## Decision Flowchart

```
WHICH STRATEGY SHOULD I USE?

  Is downtime acceptable?
     |                |
    YES               NO
     |                 |
  RECREATE         Need instant rollback?
  (simplest)          |              |
                     YES             NO
                      |              |
                 BLUE-GREEN     How many users?
                                    |
                        +-----------+-----------+
                        |                       |
                     < 1000                  > 1000
                        |                       |
                     ROLLING              Need automated
                     UPDATE               analysis?
                                            |          |
                                           YES        NO
                                            |          |
                                        PROGRESSIVE  CANARY
                                        DELIVERY
```

---

## Database Migration Compatibility

```
DATABASE + DEPLOYMENT STRATEGY

  Strategy        v1 and v2 coexist?    DB Migration Rule
  ---------------------------------------------------------------
  Recreate        No                    Any migration works
  Rolling         Yes (during roll)     Must be backward-compatible
  Blue-Green      No (but rollback!)    Must be backward-compatible
  Canary          Yes (during canary)   Must be backward-compatible

  BACKWARD-COMPATIBLE MIGRATIONS:
  ✓ Add a column (with default value)
  ✓ Add a table
  ✓ Add an index
  ✗ Remove a column (v1 still reads it)
  ✗ Rename a column (v1 uses old name)
  ✗ Change column type (v1 expects old type)

  For destructive changes, use EXPAND-CONTRACT:
  Step 1: Add new column (both versions work)
  Step 2: Migrate data old → new
  Step 3: App uses new column (deploy)
  Step 4: Remove old column (next deploy)
```

---

## Rollback Speed Comparison

```
ROLLBACK TIME BY STRATEGY

  Strategy          Rollback Method              Time
  -------------------------------------------------------
  Blue-Green        Switch load balancer         Seconds
  Canary            Route 100% to old version    Seconds
  Progressive       Automated metric-based       Seconds
  Rolling           Roll back one-by-one         Minutes
  Recreate          Redeploy old version         Minutes
  "Fix Forward"     Write and deploy a fix       Hours
  Restore Backup    Restore DB + deploy old      Hours
```

---

## Cost Comparison

```
INFRASTRUCTURE COST

  Strategy        During Deploy    After Deploy    Rollback Ready
  ---------------------------------------------------------------
  Recreate        1x               1x              0x (redeploy)
  Rolling         1x + surge       1x              0x (redeploy)
  Blue-Green      2x               1x (or 2x)     1x (idle env)
  Canary          1x + canary      1x              0x (just remove)
  Progressive     1x + canary      1x              0x (just remove)
```

---

## Health Check Requirements

Every strategy depends on health checks to know if the new version is
working:

```
HEALTH CHECK ENDPOINTS

  Endpoint            Purpose              Check Frequency
  ---------------------------------------------------------
  /health/live        Process is running   Every 10s
  /health/ready       Can serve traffic    Every 5s
  /health/startup     Finished init        Once at start

  Health Check Response:
  {
    "status": "healthy",
    "version": "2.0.0",
    "uptime": 3600,
    "checks": {
      "database": true,
      "cache": true,
      "external-api": true
    }
  }
```

---

## Quick Decision Matrix

Use this when picking a strategy for a new project:

```
YOUR SITUATION                          RECOMMENDED STRATEGY
--------------------------------------------------------------
Hobby project, low traffic              Recreate or Rolling
Startup, <10 deploys/week               Blue-Green
Growing company, daily deploys          Blue-Green or Canary
Large scale, continuous deployment      Canary or Progressive
Regulated industry, audit required      Blue-Green with manual gates
Mobile app backend, gradual rollout     Canary
Microservices with Kubernetes           Rolling or Canary (Argo)
Static site / CDN                       Blue-Green (atomic deploy)
```

---

[Back to Roadmap](./00-roadmap.md)
