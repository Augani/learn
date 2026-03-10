# Lesson 11: Reliability Engineering

> Reliable systems aren't built by preventing failures.
> They're built by designing for failure and recovering fast.

---

## The Analogy

Consider a modern passenger aircraft. It doesn't avoid failures
— it's designed so that any single failure (and many combinations)
won't cause a crash. The engines are redundant. The flight
computers are tripled. The hydraulic systems have multiple paths.
Even the wiring runs through different routes in the fuselage.

When an engine fails at 35,000 feet, the plane keeps flying.
The pilots follow a checklist. The passengers might not even
notice. Not because nothing went wrong, but because the system
was designed to handle things going wrong.

Your distributed system needs the same philosophy. Not "how do
we prevent the database from going down?" but "when the database
goes down, what happens to the user's request?"

---

## Failure Mode Analysis

Before you can handle failures, you must catalog them.

### Failure Mode and Effects Analysis (FMEA)

```
  ┌──────────────┬────────────┬────────────┬──────────┬────────┐
  │ Component    │ Failure    │ Effect     │ Severity │ Miti-  │
  │              │ Mode       │            │ (1-10)   │ gation │
  ├──────────────┼────────────┼────────────┼──────────┼────────┤
  │ Primary DB   │ Crashes    │ All writes │ 10       │ Auto   │
  │              │            │ fail       │          │ failovr│
  ├──────────────┼────────────┼────────────┼──────────┼────────┤
  │ Primary DB   │ Slow       │ Request    │ 8        │ Timeout│
  │              │ queries    │ timeouts,  │          │ circuit│
  │              │            │ cascade    │          │ breaker│
  ├──────────────┼────────────┼────────────┼──────────┼────────┤
  │ Cache (Redis)│ OOM killed │ DB overload│ 7        │ Rate   │
  │              │            │ from cache │          │ limit, │
  │              │            │ stampede   │          │ stampde│
  │              │            │            │          │ protect│
  ├──────────────┼────────────┼────────────┼──────────┼────────┤
  │ Kafka        │ Partition  │ Event      │ 6        │ Retry  │
  │              │ leader     │ processing │          │ with   │
  │              │ election   │ delayed    │          │ backoff│
  ├──────────────┼────────────┼────────────┼──────────┼────────┤
  │ Payment      │ Timeout    │ Order in   │ 9        │ Saga + │
  │ provider     │            │ uncertain  │          │ recon- │
  │              │            │ state      │          │ cile   │
  ├──────────────┼────────────┼────────────┼──────────┼────────┤
  │ DNS          │ Resolution │ All        │ 10       │ DNS    │
  │              │ failure    │ services   │          │ caching│
  │              │            │ unreachable│          │ local  │
  │              │            │            │          │ fallbck│
  └──────────────┴────────────┴────────────┴──────────┴────────┘
```

### Dependency Mapping

Every service has dependencies. Map them with their failure
characteristics:

```
  Order Service Dependencies:

  ┌──────────────┐
  │ Order Service │
  └──────┬───────┘
         │
  ┌──────┴────────────────────────────────────────┐
  │                                               │
  │  HARD dependencies (can't function without):  │
  │  ├── PostgreSQL (primary)                     │
  │  │   Failure: orders can't be created/read    │
  │  ├── Auth service                             │
  │  │   Failure: no requests authenticated       │
  │  └── Kafka (for outbox processing)            │
  │      Failure: events queue locally, process   │
  │               when Kafka returns              │
  │                                               │
  │  SOFT dependencies (degrade without):         │
  │  ├── Recommendation service                   │
  │  │   Failure: show static recommendations     │
  │  ├── Analytics service                        │
  │  │   Failure: events dropped, no impact       │
  │  └── Email service                            │
  │      Failure: confirmations delayed            │
  └───────────────────────────────────────────────┘
```

---

## Blast Radius Reduction

When something fails, how much breaks? Blast radius reduction
makes the answer "as little as possible."

### Bulkhead Pattern

Named after ship bulkheads — compartments that contain flooding:

```
  WITHOUT bulkheads:

  ┌──────────────────────────────────────────────────┐
  │              Shared Thread Pool (100 threads)     │
  │                                                  │
  │  Order API ─────────┐                            │
  │  User API  ──────── │──> Shared pool             │
  │  Search API ────────┘                            │
  │                                                  │
  │  If Search API gets slow (all threads blocked),  │
  │  Order and User APIs also starve.                │
  └──────────────────────────────────────────────────┘


  WITH bulkheads:

  ┌──────────────────────────────────────────────────┐
  │  Order API  ──> [Pool: 40 threads] ─────┐       │
  │  User API   ──> [Pool: 40 threads] ─────┤       │
  │  Search API ──> [Pool: 20 threads] ─────┘       │
  │                                                  │
  │  If Search pool is exhausted,                    │
  │  Order and User pools still have threads.        │
  └──────────────────────────────────────────────────┘
```

```go
type Bulkhead struct {
	name     string
	sem      chan struct{}
	timeout  time.Duration
	rejected prometheus.Counter
}

func NewBulkhead(name string, maxConcurrent int, timeout time.Duration) *Bulkhead {
	return &Bulkhead{
		name:    name,
		sem:     make(chan struct{}, maxConcurrent),
		timeout: timeout,
		rejected: prometheus.NewCounter(prometheus.CounterOpts{
			Name:        "bulkhead_rejected_total",
			ConstLabels: prometheus.Labels{"bulkhead": name},
		}),
	}
}

func (b *Bulkhead) Execute(ctx context.Context, fn func() error) error {
	select {
	case b.sem <- struct{}{}:
		defer func() { <-b.sem }()
		return fn()
	case <-time.After(b.timeout):
		b.rejected.Inc()
		return fmt.Errorf("bulkhead %s: rejected (at capacity)", b.name)
	case <-ctx.Done():
		return ctx.Err()
	}
}
```

### Shuffle Sharding

Regular sharding: all customers on shard X fail when shard X
fails. Shuffle sharding: each customer is assigned to a unique
combination of nodes, so no two customers share the same failure
blast radius.

```
  Regular sharding (4 shards, 100 customers each):

  Shard 1: Customers 1-100     (shard fails = 100 affected)
  Shard 2: Customers 101-200
  Shard 3: Customers 201-300
  Shard 4: Customers 301-400

  Shuffle sharding (8 nodes, each customer uses 2):

  Customer A: Nodes {1, 4}
  Customer B: Nodes {2, 7}
  Customer C: Nodes {3, 5}
  Customer D: Nodes {1, 6}

  Node 1 fails: Only customers assigned to node 1 are affected
  AND they still have their second node.
  Customer A: Node 4 still works.
  Customer D: Node 6 still works.

  For both Customer A AND Customer D to fail,
  nodes 1+4 AND 1+6 all need to fail simultaneously.
```

---

## Graceful Degradation

When a dependency fails, don't fail entirely. Degrade gracefully.

```
  Service health levels:

  HEALTHY:     All features work normally
  DEGRADED:    Core features work, non-critical features off
  EMERGENCY:   Minimal features, read-only mode
  UNAVAILABLE: Service is down (should be very rare)

  ┌──────────────────────────────────────────────────────┐
  │ Feature              │ Healthy │ Degraded │ Emergency│
  ├──────────────────────┼─────────┼──────────┼──────────┤
  │ Place orders         │ ✓       │ ✓        │ ✗        │
  │ View orders          │ ✓       │ ✓        │ ✓ (cached│
  │ Recommendations      │ ✓ (live)│ ✗(static)│ ✗        │
  │ Search               │ ✓ (full)│ ✓(basic) │ ✗        │
  │ User reviews         │ ✓       │ ✗        │ ✗        │
  │ Analytics tracking   │ ✓       │ ✗        │ ✗        │
  │ Admin panel          │ ✓       │ ✓        │ ✓(read)  │
  └──────────────────────┴─────────┴──────────┴──────────┘
```

```go
type ServiceHealth int

const (
	HealthHealthy     ServiceHealth = iota
	HealthDegraded
	HealthEmergency
)

type HealthAwareHandler struct {
	healthCheck     func() ServiceHealth
	primaryHandler  http.Handler
	degradedHandler http.Handler
	cachedHandler   http.Handler
}

func (h *HealthAwareHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	health := h.healthCheck()

	w.Header().Set("X-Service-Health", healthToString(health))

	switch health {
	case HealthHealthy:
		h.primaryHandler.ServeHTTP(w, r)
	case HealthDegraded:
		h.degradedHandler.ServeHTTP(w, r)
	case HealthEmergency:
		h.cachedHandler.ServeHTTP(w, r)
	}
}
```

---

## Circuit Breakers at Scale

The basic circuit breaker pattern is covered in other tracks.
At scale, the challenges are different.

### Per-Endpoint Circuit Breakers

```
  WRONG: One circuit breaker per service

  Payment Service CB: OPEN
  → ALL payment endpoints blocked
  → Can't even check payment status (which works fine)


  RIGHT: Circuit breaker per endpoint (or per operation)

  POST /payments       CB: OPEN    (creating payments is broken)
  GET  /payments/:id   CB: CLOSED  (reading payments works)
  POST /refunds        CB: CLOSED  (refunds work)
```

### Adaptive Circuit Breakers

Static thresholds don't work well. An endpoint that normally
has 0.01% errors shouldn't open at 1% — but one that normally
has 0.5% errors might be fine at 1%.

```go
type AdaptiveCircuitBreaker struct {
	name              string
	windowDuration    time.Duration
	baselineErrorRate float64
	multiplier        float64
	minSamples        int
	state             CircuitState
	metrics           *slidingWindow
}

func (cb *AdaptiveCircuitBreaker) shouldTrip() bool {
	samples := cb.metrics.Count()
	if samples < cb.minSamples {
		return false
	}

	currentErrorRate := cb.metrics.ErrorRate()
	threshold := cb.baselineErrorRate * cb.multiplier

	if threshold < 0.05 {
		threshold = 0.05
	}

	return currentErrorRate > threshold
}

func (cb *AdaptiveCircuitBreaker) updateBaseline() {
	cb.baselineErrorRate = cb.metrics.ErrorRatePercentile(0.95)
}
```

### Circuit Breaker Coordination

At scale, individual circuit breakers can oscillate or disagree:

```
  Pod 1 CB: OPEN   (saw 5 failures)
  Pod 2 CB: CLOSED (saw 0 failures — got lucky)
  Pod 3 CB: OPEN   (saw 3 failures)

  Problem: Pod 2 is still sending traffic to a broken
  dependency, contributing to its overload.

  Solution: Shared circuit breaker state

  ┌──────────┐     ┌──────────────────┐
  │  Pod 1   │────>│ Redis (shared    │
  │  Pod 2   │────>│  circuit breaker │
  │  Pod 3   │────>│  state)          │
  └──────────┘     └──────────────────┘

  All pods agree: dependency is broken.
  All pods stop sending traffic simultaneously.
```

---

## Chaos Engineering: Advanced Patterns

Basic chaos: kill a pod and see what happens. Advanced chaos:
systematically explore failure modes.

### Chaos Maturity Model

```
  Level 1: Ad-hoc experiments
  - Kill pods manually
  - "Let's see what happens if..."
  - No formal process

  Level 2: Planned experiments
  - Defined hypotheses
  - Controlled experiments in staging
  - Results documented

  Level 3: Automated experiments
  - Continuous chaos in production
  - Automated rollback on SLO violation
  - Part of CI/CD pipeline

  Level 4: Advanced patterns
  - Multi-service failure combinations
  - Network partition simulation
  - State-corrupting experiments
  - Organizational chaos (pager rotation)
```

### Experiment Design Template

```yaml
experiment:
  name: "Payment service failure during checkout"
  hypothesis: >
    When the payment service returns errors, the checkout
    service will queue the payment for retry and return a
    202 Accepted to the user instead of a 500 error.

  steady_state:
    metrics:
      - checkout_success_rate > 99.5%
      - checkout_p99_latency < 2000ms
      - payment_queue_depth < 100

  method:
    - action: inject_fault
      target: payment-service
      fault_type: http_error
      error_code: 503
      percentage: 50
      duration: 300s

  abort_conditions:
    - checkout_success_rate < 95%
    - checkout_p99_latency > 5000ms
    - payment_queue_depth > 10000
    - error_budget_consumed > 10%

  rollback:
    - action: remove_fault
      target: payment-service
      verify: checkout_success_rate > 99% within 60s

  observations:
    - metric: checkout_success_rate
      expected: "> 98%"
    - metric: payment_queue_depth
      expected: "increases proportionally to fault %"
    - metric: retry_success_rate
      expected: "> 99% within 5 minutes of fault removal"
```

### Litmus Chaos (Kubernetes-native)

```yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: payment-service-chaos
spec:
  appinfo:
    appns: production
    applabel: app=payment-service
    appkind: deployment
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-network-latency
      spec:
        components:
          env:
            - name: NETWORK_INTERFACE
              value: eth0
            - name: NETWORK_LATENCY
              value: "200"
            - name: TOTAL_CHAOS_DURATION
              value: "300"
            - name: PODS_AFFECTED_PERC
              value: "50"
```

### Combining Failures

The most valuable (and terrifying) experiments combine failures:

```
  Experiment: "Monday Morning"

  Simultaneously inject:
  1. 30% packet loss between services (network degradation)
  2. 2x normal latency on primary database
  3. Kill 1 of 3 Redis pods
  4. Increase request rate by 50% (simulating morning spike)

  Hypothesis: System degrades gracefully, no cascading failure

  This tests the interaction between failures — the
  combinatorial space that single-failure tests miss.
```

---

## Error Budgets

Error budgets connect reliability to velocity:

```
  SLO: 99.9% availability (monthly)
  Error budget: 0.1% = ~43 minutes of downtime/month

  ┌──────────────────────────────────────────────────────┐
  │              Error Budget Status                      │
  │                                                      │
  │  Month: March 2026                                   │
  │  SLO: 99.9%                                          │
  │  Budget: 43.2 minutes                                │
  │                                                      │
  │  Consumed:                                           │
  │  Mar 2:  DB failover        3.5 min  ████░░░░░░      │
  │  Mar 7:  Bad deploy         8.0 min  █████████░      │
  │  Mar 10: Cache stampede     2.0 min  ██░░░░░░░░      │
  │  ─────────────────────────────────                   │
  │  Total consumed:           13.5 min                  │
  │  Remaining:                29.7 min  (68.75%)        │
  │                                                      │
  │  Burn rate: 4.5 min/week                             │
  │  At this rate: budget exhausted by Mar 28            │
  │                                                      │
  │  Action: SLOW DOWN releases, focus on reliability    │
  └──────────────────────────────────────────────────────┘
```

### Error Budget Policies

```
  Budget > 75% remaining:
  → Ship features freely
  → Run chaos experiments
  → Take calculated risks

  Budget 50-75% remaining:
  → Require extra review for risky changes
  → Increase test coverage for new features
  → Prioritize reliability work

  Budget 25-50% remaining:
  → Only ship critical features
  → Dedicate engineering time to reliability
  → Increase monitoring

  Budget < 25% remaining:
  → Feature freeze
  → All hands on reliability
  → Post-mortem required for any new incident
  → Rollback risky recent changes

  Budget exhausted:
  → Full deployment freeze until next month
  → Reliability sprint
  → Architecture review for systemic issues
```

---

## Exercises

1. **FMEA exercise.** Pick a service you own. Create a complete
   FMEA table: every component, every failure mode, every effect.
   For each entry, determine the current mitigation and whether
   it's sufficient. What's the highest unmitigated risk?

2. **Graceful degradation.** Design the degradation strategy for
   an e-commerce checkout flow when: (a) the recommendation
   service is down, (b) the inventory service is slow, (c) the
   payment provider is returning 50% errors. What does the user
   experience at each degradation level?

3. **Chaos experiment.** Design three chaos experiments for a
   system you operate. For each: define the hypothesis, steady
   state, injection method, abort conditions, and expected
   observations. Start with the highest-severity failure mode
   from your FMEA.

4. **Error budget analysis.** Your service has a 99.95% monthly
   SLO. Last month you consumed 80% of your error budget. Break
   down: what caused the budget consumption? What systematic
   changes would reduce consumption by 50%? Write the error
   budget policy for your team.

---

[Next: Lesson 12 — Tech Strategy -->](12-tech-strategy.md)
