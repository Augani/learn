# Lesson 16: Building Reliable Systems

## Putting It All Together

Imagine you are building a house in an earthquake zone. You do not just build it and hope for the best. You design foundations that flex, use materials that absorb shock, install sensors to detect tremors, have evacuation plans, and carry insurance. Reliability is not one thing; it is everything working together.

This lesson ties together every concept from the track into a unified approach to building systems that stay up.

```
THE RELIABLE SYSTEM STACK

  +================================================+
  |           DESIGN FOR FAILURE                    |
  |  (Assume everything breaks. Build accordingly.) |
  +================================================+
  |                                                |
  |  +------------------------------------------+  |
  |  | Graceful Degradation                     |  |
  |  | Circuit Breakers                         |  |
  |  | Retries with Backoff                     |  |
  |  | Timeouts on Everything                   |  |
  |  +------------------------------------------+  |
  |                                                |
  |  +------------------------------------------+  |
  |  | Observability (Lessons 04-08)            |  |
  |  | Metrics + Logs + Traces                  |  |
  |  +------------------------------------------+  |
  |                                                |
  |  +------------------------------------------+  |
  |  | Alerting + Incident Response (09-11)     |  |
  |  | On-Call + Postmortems                    |  |
  |  +------------------------------------------+  |
  |                                                |
  |  +------------------------------------------+  |
  |  | Release Engineering (14)                 |  |
  |  | Canary + Feature Flags + Rollback        |  |
  |  +------------------------------------------+  |
  |                                                |
  |  +------------------------------------------+  |
  |  | Chaos Engineering (12) + Capacity (13)   |  |
  |  | Test it. Plan for it. Prove it.          |  |
  |  +------------------------------------------+  |
  |                                                |
  +================================================+
```

## Design for Failure

The first principle: **everything fails**. Networks partition. Disks fill. Services crash. Databases corrupt. Cloud providers have outages. Design accordingly.

```
WHAT CAN FAIL               HOW TO HANDLE IT
+------------------------+  +----------------------------+
| Network call           |  | Timeout + retry + circuit  |
|                        |  | breaker                    |
+------------------------+  +----------------------------+
| Single instance        |  | Multiple replicas behind   |
|                        |  | load balancer              |
+------------------------+  +----------------------------+
| Availability zone      |  | Multi-AZ deployment        |
+------------------------+  +----------------------------+
| Entire region          |  | Multi-region (if critical) |
+------------------------+  +----------------------------+
| Database               |  | Read replicas, failover,   |
|                        |  | backups                    |
+------------------------+  +----------------------------+
| External dependency    |  | Circuit breaker, fallback, |
|                        |  | cache                      |
+------------------------+  +----------------------------+
| Bad deploy             |  | Canary, rollback, feature  |
|                        |  | flags                      |
+------------------------+  +----------------------------+
```

## Timeouts

Every external call must have a timeout. No exceptions.

```
WITHOUT TIMEOUT              WITH TIMEOUT
+------------------+         +------------------+
| Call service B   |         | Call service B   |
| ...              |         | Timeout: 2s      |
| ...waiting...    |         |                  |
| ...still waiting |         | 2s passes:       |
| ...30 seconds... |         | Return error or  |
| ...thread stuck  |         | fallback value   |
| ...cascade fail  |         |                  |
+------------------+         +------------------+
  One slow service            Fail fast. Protect
  takes down everything       the calling service.
```

```go
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel()

resp, err := httpClient.Do(req.WithContext(ctx))
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        return fallbackResponse(), nil
    }
    return nil, err
}
```

## Retries with Exponential Backoff

```
NAIVE RETRY                  EXPONENTIAL BACKOFF
Fail -> Retry immediately    Fail -> Wait 100ms -> Retry
Fail -> Retry immediately    Fail -> Wait 200ms -> Retry
Fail -> Retry immediately    Fail -> Wait 400ms -> Retry
Fail -> Retry immediately    Fail -> Wait 800ms -> Retry (give up)
(Hammers the failing         (Gives the service time to recover)
 service harder)

WITH JITTER (even better):
  Wait = base_delay * 2^attempt + random(0, base_delay)

  Attempt 1: 100ms + random(0-100ms) = 137ms
  Attempt 2: 200ms + random(0-100ms) = 258ms
  Attempt 3: 400ms + random(0-100ms) = 441ms

  Jitter prevents "thundering herd" where all
  clients retry at the exact same moment.
```

```python
import time
import random

def retry_with_backoff(func, max_retries=4, base_delay=0.1):
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0, base_delay)
            time.sleep(delay)
```

## Circuit Breakers

Like an electrical circuit breaker that trips to prevent a house fire, a software circuit breaker stops calling a failing service to prevent cascade failures.

```
CIRCUIT BREAKER STATES

  +--------+    failures > threshold    +--------+
  | CLOSED | ========================> |  OPEN  |
  | (normal| <---+                     | (fail  |
  |  flow) |     |                     |  fast) |
  +--------+     |                     +--------+
                 |                          |
                 |  success                 | timeout expires
                 |                          |
                 |    +-----------+         |
                 +--- | HALF-OPEN | <-------+
                      | (test one |
                      |  request) |
                      +-----------+

  CLOSED:    Requests flow normally. Count failures.
  OPEN:      All requests fail immediately. No calls made.
             Return fallback or error.
  HALF-OPEN: Allow ONE request through.
             If it succeeds: back to CLOSED.
             If it fails: back to OPEN.
```

```go
type CircuitBreaker struct {
    failures    int
    threshold   int
    state       string
    lastFailure time.Time
    cooldown    time.Duration
}

func (cb *CircuitBreaker) Call(fn func() error) error {
    if cb.state == "open" {
        if time.Since(cb.lastFailure) > cb.cooldown {
            cb.state = "half-open"
        } else {
            return ErrCircuitOpen
        }
    }

    err := fn()
    if err != nil {
        cb.failures++
        cb.lastFailure = time.Now()
        if cb.failures >= cb.threshold {
            cb.state = "open"
        }
        return err
    }

    cb.failures = 0
    cb.state = "closed"
    return nil
}
```

## Graceful Degradation

When a dependency fails, do not fail entirely. Degrade gracefully.

```
FULL FUNCTIONALITY          DEGRADED FUNCTIONALITY
+---------------------+    +---------------------+
| Product page with:  |    | Product page with:  |
| - Product details   |    | - Product details   |
| - Recommendations   |    | - "Recommendations  |
| - Reviews           |    |    unavailable"      |
| - Live inventory    |    | - Cached reviews    |
| - Dynamic pricing   |    | - "In stock" (cached)|
+---------------------+    | - Standard pricing  |
                           +---------------------+
                            Recommendation service
                            is down, but users can
                            still buy products.
```

```
DEGRADATION HIERARCHY

  Level 0: Full functionality (everything works)
       |
  Level 1: Non-critical features disabled
       |   (recommendations off, analytics delayed)
       |
  Level 2: Read-only mode
       |   (can browse, cannot purchase)
       |
  Level 3: Static fallback
       |   (serve cached version of pages)
       |
  Level 4: Maintenance page
       |   ("We will be right back")
       |
  Level 5: Complete outage
```

### Load Shedding

When overloaded, deliberately drop low-priority requests to protect high-priority ones:

```
INCOMING REQUESTS AT 150% CAPACITY

  Without load shedding:
  ALL requests slow --> timeout --> users retry --> worse

  With load shedding:
  +--Priority--+
  | CRITICAL   | Checkout, payment     --> SERVED (always)
  | HIGH       | Product pages, search --> SERVED (if capacity)
  | LOW        | Analytics, recs       --> SHED (503 response)
  +------------+

  Result: Critical requests stay fast.
  Low-priority callers get a clear "try later" signal.
```

## Bulkheads

Named after ship compartments that prevent a hull breach from sinking the entire ship:

```
WITHOUT BULKHEADS:
  +-----------------------------------+
  | Shared thread pool: 100 threads   |
  |                                   |
  | Service A calls: 90 threads stuck |
  | Service B calls: 10 threads left  | <-- B starved
  | Service C calls: 0 threads        | <-- C dead
  +-----------------------------------+

WITH BULKHEADS:
  +-----------------------------------+
  | Service A pool: 40 threads        |
  |   (A is slow, 40 threads stuck)   |
  |                                   |
  | Service B pool: 40 threads        |
  |   (B is fine, working normally)   |
  |                                   |
  | Service C pool: 20 threads        |
  |   (C is fine, working normally)   |
  +-----------------------------------+
  A failing does not affect B or C.
```

## The Reliability Checklist

Before shipping any service to production, verify:

```
+============================================================+
|           PRODUCTION READINESS CHECKLIST                   |
+============================================================+

OBSERVABILITY
  [ ] Metrics exposed (RED: Rate, Errors, Duration)
  [ ] Structured logging with trace IDs
  [ ] Distributed tracing instrumented
  [ ] Dashboard created with golden signals
  [ ] SLIs and SLOs defined and tracked

ALERTING
  [ ] Symptom-based alerts configured
  [ ] Burn rate alerts for SLO
  [ ] Runbooks written for each alert
  [ ] PagerDuty/escalation configured

RESILIENCE
  [ ] Timeouts on all external calls
  [ ] Retries with exponential backoff + jitter
  [ ] Circuit breakers on critical dependencies
  [ ] Graceful degradation for non-critical features
  [ ] Health check endpoints (liveness + readiness)

DEPLOYMENT
  [ ] Canary or blue-green deployment configured
  [ ] Automated rollback on metric degradation
  [ ] Feature flags for risky changes
  [ ] Database migrations are forward-compatible

CAPACITY
  [ ] Load tested at 2x expected peak
  [ ] Auto-scaling configured and tested
  [ ] Resource limits set (CPU, memory)
  [ ] Capacity plan documented for next quarter

INCIDENT RESPONSE
  [ ] On-call rotation established
  [ ] Incident response process documented
  [ ] Postmortem process in place
  [ ] At least one chaos experiment completed

+============================================================+
```

## Architecture Pattern: Reliable Service

```
+----------------------------------------------------------+
|                   API GATEWAY                             |
|  Rate limiting, auth, routing                            |
+--+---+---+---+---+---+---+---+---+---+---+---+---+---+--+
   |   |   |   |   |   |   |   |   |   |   |   |   |   |
   v   v   v   v   v   v   v   v   v   v   v   v   v   v
+----------------------------------------------------------+
|                   LOAD BALANCER                           |
|  Health checks, circuit breaking                         |
+--+----------+----------+---------------------------------+
   |          |          |
   v          v          v
+------+  +------+  +------+
|Pod 1 |  |Pod 2 |  |Pod 3 |    <-- Horizontal scaling
|      |  |      |  |      |        HPA: CPU + custom metrics
+--+---+  +--+---+  +--+---+
   |         |         |
   +----+----+----+----+
        |         |
        v         v
   +--------+ +--------+
   |Primary | |Replica |    <-- Database with failover
   |  DB    | |   DB   |
   +--------+ +--------+

   +--------+
   | Cache  |    <-- Redis for hot data
   | (Redis)|        Fallback: serve from DB (slower)
   +--------+

EACH POD CONTAINS:
+----------------------------------+
| Application                      |
| +------------------------------+ |
| | Timeout: 2s on all ext calls | |
| | Retry: 3x with backoff      | |
| | Circuit breaker: per dep     | |
| | Bulkhead: isolated pools     | |
| +------------------------------+ |
| | OTel SDK: traces + metrics   | |
| | Structured logger            | |
| +------------------------------+ |
| | /health/live (liveness)      | |
| | /health/ready (readiness)    | |
| | /metrics (Prometheus)        | |
| +------------------------------+ |
+----------------------------------+
```

## The SRE Maturity Model

```
LEVEL 1: REACTIVE
  "We fix things when they break"
  - Manual monitoring (someone watches dashboards)
  - No SLOs defined
  - Ad-hoc incident response
  - No postmortems

LEVEL 2: PROACTIVE
  "We have monitoring and alerting"
  - Basic metrics and dashboards
  - Alerts configured (but maybe noisy)
  - Incident process exists
  - Postmortems written (sometimes)

LEVEL 3: MEASURED
  "We track SLOs and error budgets"
  - SLIs and SLOs defined per service
  - Error budget tracking and policies
  - Structured incident management
  - Regular postmortem reviews

LEVEL 4: ENGINEERED
  "We design for reliability"
  - Chaos engineering in practice
  - Automated canary analysis
  - Toil tracked and reduced quarterly
  - On-call health metrics reviewed monthly

LEVEL 5: OPTIMIZED
  "Reliability is a competitive advantage"
  - Error budgets drive product decisions
  - Continuous chaos in production
  - Near-zero toil
  - Self-healing systems
  - Reliability culture across the org
```

## Where to Go from Here

```
RESOURCES:
+-----------------------------------------------------------+
| "Site Reliability Engineering" (Google SRE Book)          |
|   - Free online: sre.google/sre-book                     |
|                                                           |
| "The Site Reliability Workbook" (Google)                  |
|   - Practical exercises and examples                     |
|                                                           |
| "Implementing Service Level Objectives" (Alex Hidalgo)   |
|   - Deep dive on SLOs and error budgets                  |
|                                                           |
| "Chaos Engineering" (Casey Rosenthal, Nora Jones)         |
|   - Theory and practice of chaos                         |
|                                                           |
| OpenTelemetry documentation: opentelemetry.io             |
| Prometheus documentation: prometheus.io/docs              |
+-----------------------------------------------------------+
```

## Exercises

1. **Production readiness review**: Take the production readiness checklist above and evaluate a service you work on. Score each item (0 = not done, 1 = partial, 2 = complete). Identify the three biggest gaps and create a plan to address them.

2. **Resilience design**: Design the resilience patterns for an e-commerce checkout flow that calls: inventory service, pricing service, payment gateway (Stripe), and notification service. For each dependency, specify: timeout, retry policy, circuit breaker config, and fallback behavior.

3. **Degradation plan**: Write a degradation plan for your service with 5 levels (full functionality down to maintenance page). For each level, specify: what triggers it, what features are disabled, and how users are notified.

4. **End-to-end architecture**: Draw the complete architecture of a reliable microservice including: load balancing, health checks, observability instrumentation, database failover, caching, and auto-scaling. Label each resilience pattern used.

5. **SRE maturity assessment**: Using the maturity model above, assess your team's current level. For each gap between your current level and the next, write a specific action item with an owner and timeline.

6. **Capstone project**: Design a complete SRE practice for a new service from scratch. Include: SLO document, monitoring and alerting configuration, incident response process, on-call rotation, postmortem template, chaos experiment plan, and capacity plan. This is your portfolio piece.

---

[Back to Track Overview](00-roadmap.md)

## Congratulations

You have completed the SRE & Observability track. You now have the vocabulary, tools, and frameworks to keep systems reliable at scale. The next step is practice: apply these concepts to real systems, run your first chaos experiment, write your first SLO document, and build a culture of reliability on your team.

Reliability is not a destination. It is a practice.
