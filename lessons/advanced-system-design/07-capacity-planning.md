# Lesson 7: Capacity Planning

> The best time to plan capacity is six months before you need it.
> The second best time is right now, before the next traffic spike.

---

## The Analogy

Think about highway planning. A city needs to decide how many
lanes a highway should have. Build too few and you get traffic
jams during rush hour. Build too many and you've wasted billions
on empty asphalt.

The planner studies traffic patterns: daily rush hours, weekend
differences, holiday spikes, growth trends from new housing
developments, and the occasional concert at the nearby stadium.
They also need headroom — if a highway is at 100% capacity, one
fender bender creates a 2-hour backup.

Capacity planning for software systems is the same problem.
Replace "lanes" with "servers," "rush hour" with "peak traffic,"
and "stadium concert" with "Black Friday."

---

## The Capacity Planning Methodology

```
  Step 1: MEASURE current usage
          ↓
  Step 2: MODEL the workload
          ↓
  Step 3: PROJECT future growth
          ↓
  Step 4: CALCULATE required capacity
          ↓
  Step 5: PLAN the provisioning
          ↓
  Step 6: VALIDATE with load tests
          ↓
  Step 7: MONITOR and iterate
```

### Step 1: Measure Current Usage

You need baseline numbers for every resource:

```
  ┌────────────────────┬────────────┬────────────┬────────────┐
  │ Resource           │ Current    │ Peak       │ Capacity   │
  ├────────────────────┼────────────┼────────────┼────────────┤
  │ API servers        │ 12 pods    │ 18 pods    │ 30 pods    │
  │ CPU utilization    │ 35% avg    │ 65% peak   │ 100%       │
  │ Memory utilization │ 60% avg    │ 72% peak   │ 100%       │
  │ Database IOPS      │ 5K avg     │ 15K peak   │ 30K (max)  │
  │ Database connections│ 200 avg   │ 450 peak   │ 500 (max)  │
  │ Kafka throughput   │ 20K msg/s  │ 80K msg/s  │ 200K msg/s │
  │ Redis memory       │ 8 GB       │ 10 GB      │ 16 GB      │
  │ Network bandwidth  │ 500 Mbps   │ 1.2 Gbps   │ 10 Gbps   │
  └────────────────────┴────────────┴────────────┴────────────┘
```

### Step 2: Model the Workload

Map business metrics to infrastructure metrics:

```
  Business metric: 100K orders/day
  Peak hours: 10am-2pm (60% of daily orders)

  Orders per peak hour: 60K orders / 4 hours = 15K orders/hour
  Orders per peak second: 15K / 3600 = ~4.2 orders/second

  Per order:
  - 1 API call (auth + validation)
  - 3 DB reads (user, product, inventory)
  - 2 DB writes (order, inventory update)
  - 1 Kafka message (order event)
  - 1 cache read (pricing)
  - 1 external API call (payment)

  Peak infrastructure load per second:
  - API calls:      4.2/s × 1 = 4.2 req/s
  - DB reads:       4.2/s × 3 = 12.6 reads/s
  - DB writes:      4.2/s × 2 = 8.4 writes/s
  - Kafka messages: 4.2/s × 1 = 4.2 msg/s
  - Cache reads:    4.2/s × 1 = 4.2 reads/s
  - Payment calls:  4.2/s × 1 = 4.2 calls/s
```

### Step 3: Project Future Growth

```
  Historical growth: 15% month-over-month

  Month    Orders/Day    Peak Orders/Sec
  ─────────────────────────────────────────
  Now      100K          4.2
  +3 mo    152K          6.4
  +6 mo    230K          9.6
  +12 mo   535K          22.3
  +18 mo   1.23M         51.3
  +24 mo   2.84M         118.3

  At 15% MoM growth, you hit 10x in 18 months.
  Your current infrastructure handles 4.2/s peak.
  At +6 months you need 2.3x current capacity.
  At +12 months you need 5.3x.
```

Growth projection isn't a straight line. Account for:
- **Seasonal patterns**: E-commerce peaks in Q4
- **Step functions**: Launching in a new country doubles users
- **Viral events**: A social media mention spikes traffic 10x
- **Platform changes**: Moving to mobile increases API calls 3x

---

## Headroom Calculations

Running at 100% capacity means zero room for error. The key
question: how much headroom do you need?

```
  ┌─────────────────┬──────────────┬──────────────────────────┐
  │ Utilization     │ Risk Level   │ What Happens             │
  ├─────────────────┼──────────────┼──────────────────────────┤
  │ < 40%           │ Wasteful     │ Over-provisioned ($$)    │
  │ 40-60%          │ Healthy      │ Room for spikes          │
  │ 60-75%          │ Cautious     │ Can absorb 2x spike      │
  │ 75-85%          │ Tight        │ Limited spike absorption │
  │ 85-95%          │ Dangerous    │ One spike away from      │
  │                 │              │ degradation              │
  │ > 95%           │ Critical     │ Active degradation       │
  └─────────────────┴──────────────┴──────────────────────────┘

  Target: 60% utilization at PEAK.
  This gives you ~67% headroom for unexpected spikes.
```

### The Headroom Formula

```
  Required Capacity = Peak Load / Target Utilization

  Example:
  Peak load: 15K DB IOPS
  Target utilization: 60%
  Required capacity: 15K / 0.60 = 25K IOPS

  Current capacity: 30K IOPS
  Headroom: (30K - 15K) / 30K = 50%
  Spike absorption: 30K / 15K = 2x peak

  Time until capacity needed:
  At 15% MoM growth, 25K IOPS reached in ~4 months
  At 15% MoM growth, 30K IOPS reached in ~5 months
  Order new capacity by month 3 (lead time buffer)
```

---

## Load Testing at Scale

### Types of Load Tests

```
  ┌────────────────────┬──────────────────────────────────────┐
  │ Test Type          │ Purpose                              │
  ├────────────────────┼──────────────────────────────────────┤
  │ Baseline           │ Measure current performance          │
  │ (steady load)      │ under normal conditions              │
  ├────────────────────┼──────────────────────────────────────┤
  │ Stress test        │ Find the breaking point              │
  │ (increasing load)  │ (where does it fall over?)           │
  ├────────────────────┼──────────────────────────────────────┤
  │ Spike test         │ Simulate sudden traffic burst        │
  │ (sudden jump)      │ (flash sale, viral moment)           │
  ├────────────────────┼──────────────────────────────────────┤
  │ Soak test          │ Find memory leaks, connection leaks  │
  │ (sustained load)   │ (run for 24-72 hours)                │
  ├────────────────────┼──────────────────────────────────────┤
  │ Capacity test      │ Verify projected growth capacity     │
  │ (target load)      │ ("can we handle 3x current?")        │
  └────────────────────┴──────────────────────────────────────┘
```

### k6 Load Test Example

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const orderLatency = new Trend('order_latency');

export const options = {
  scenarios: {
    steady_state: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '30m',
      preAllocatedVUs: 200,
      maxVUs: 500,
    },
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      stages: [
        { duration: '5m', target: 100 },
        { duration: '1m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '1m', target: 100 },
        { duration: '5m', target: 100 },
      ],
      preAllocatedVUs: 1000,
      maxVUs: 2000,
      startTime: '30m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
    order_latency: ['p(99)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.staging.example.com';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${__ENV.AUTH_TOKEN}`,
  };

  const browseRes = http.get(`${BASE_URL}/products?page=1&limit=20`, { headers });
  check(browseRes, { 'browse 200': (r) => r.status === 200 });
  errorRate.add(browseRes.status !== 200);
  sleep(Math.random() * 2);

  const productRes = http.get(`${BASE_URL}/products/${randomProductId()}`, { headers });
  check(productRes, { 'product 200': (r) => r.status === 200 });
  sleep(Math.random() * 3);

  if (Math.random() < 0.3) {
    const start = Date.now();
    const orderRes = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({
        items: [{ product_id: randomProductId(), quantity: 1 }],
      }),
      { headers }
    );
    orderLatency.add(Date.now() - start);
    check(orderRes, { 'order 201': (r) => r.status === 201 });
    errorRate.add(orderRes.status !== 201);
  }
}

function randomProductId() {
  return `prod-${Math.floor(Math.random() * 10000)}`;
}
```

### Realistic Load Testing Principles

```
  Common mistakes:

  ✗ Testing a single endpoint in isolation
    (real traffic hits many endpoints)

  ✗ Using uniform request patterns
    (real traffic has hot spots)

  ✗ Testing from a single region
    (real traffic comes from everywhere)

  ✗ Ignoring think time between requests
    (real users don't fire 1000 requests/second)

  ✗ Testing with empty caches
    (production caches are warm)

  ✗ Testing with synthetic data
    (production data has different distributions)
```

---

## Traffic Modeling

Real traffic is not uniform. Model it accurately:

```
  Daily traffic pattern (typical e-commerce):

  Requests
  per second
    ^
    │                    ╭──────╮
  600│                  ╭╯      ╰╮
    │                ╭╯          ╰╮
  400│              ╭╯              ╰╮
    │            ╭╯                  ╰╮
  200│          ╭╯                      ╰╮
    │        ╭╯                          ╰──╮
  100│  ──────╯                                ╰────
    │
    └──────────────────────────────────────────────>
     12am  4am  8am  12pm  4pm  8pm  12am

  Peak is ~6x trough.
  Your capacity plan must handle the peak.

  Weekly pattern:
  Mon: 90% of average
  Tue-Thu: 100% of average
  Fri: 110% of average
  Sat: 130% of average
  Sun: 80% of average
```

### Seasonal Patterns

```
  Monthly pattern (e-commerce):

  Jan  ███████░░░░░░░░░░░░░░░░░░  70% (post-holiday lull)
  Feb  ████████░░░░░░░░░░░░░░░░░  80%
  Mar  ████████░░░░░░░░░░░░░░░░░  80%
  Apr  █████████░░░░░░░░░░░░░░░░  90%
  May  █████████░░░░░░░░░░░░░░░░  90%
  Jun  █████████░░░░░░░░░░░░░░░░  90%
  Jul  █████████░░░░░░░░░░░░░░░░  90%
  Aug  █████████░░░░░░░░░░░░░░░░  90%
  Sep  ██████████░░░░░░░░░░░░░░░  100%
  Oct  ███████████░░░░░░░░░░░░░░  110%
  Nov  ████████████████████░░░░░  200% (Black Friday)
  Dec  ██████████████████░░░░░░░  180% (holiday shopping)
```

---

## Black Friday Planning

The canonical capacity planning challenge. Traffic can spike
3-10x normal peaks.

```
  Black Friday Planning Timeline:

  T-6 months: Review last year's data
               Identify bottlenecks from last year
               Set this year's traffic projections

  T-4 months: Architecture review
               Identify scaling limits in each component
               Start load testing at projected levels

  T-3 months: Order additional infrastructure
               (hardware/reserved instances lead time)
               Begin performance optimization

  T-2 months: Full-scale load test at 2x projected peak
               Fix discovered bottlenecks
               Test auto-scaling policies

  T-1 month:  Final load test at projected peak
               Freeze non-critical deployments
               Prepare runbooks for known failure modes

  T-1 week:   Pre-scale infrastructure
               Warm caches
               Verify monitoring and alerting
               Staff on-call coverage

  T-Day:      Execute prepared playbook
               Monitor everything
               Be ready to toggle feature flags
               (disable non-critical features under load)
```

### Feature Degradation Plan

Under extreme load, you sacrifice non-critical features to
protect critical paths:

```
  Load Level    What Gets Disabled
  ────────────────────────────────────────────────────
  Normal        Everything on
  High (150%)   Recommendation engine → static fallback
                Search autocomplete → disabled
                Analytics tracking → sampled 10%

  Critical      Product reviews → cached only
  (200%)        Recently viewed → disabled
                Wishlist → read-only
                Email notifications → queued (delayed)

  Emergency     Non-essential APIs → 503
  (300%+)       Background jobs → paused
                Admin panel → restricted
                Checkout only mode
```

```go
type LoadLevel int

const (
	LoadNormal   LoadLevel = iota
	LoadHigh
	LoadCritical
	LoadEmergency
)

type DegradationConfig struct {
	Level             LoadLevel
	RecommendationsOn bool
	SearchAutoOn      bool
	AnalyticsSample   float64
	ReviewsLive       bool
	WishlistWritable  bool
	BackgroundJobsOn  bool
}

var degradationLevels = map[LoadLevel]DegradationConfig{
	LoadNormal: {
		RecommendationsOn: true,
		SearchAutoOn:      true,
		AnalyticsSample:   1.0,
		ReviewsLive:       true,
		WishlistWritable:  true,
		BackgroundJobsOn:  true,
	},
	LoadHigh: {
		RecommendationsOn: false,
		SearchAutoOn:      false,
		AnalyticsSample:   0.1,
		ReviewsLive:       true,
		WishlistWritable:  true,
		BackgroundJobsOn:  true,
	},
	LoadCritical: {
		RecommendationsOn: false,
		SearchAutoOn:      false,
		AnalyticsSample:   0.0,
		ReviewsLive:       false,
		WishlistWritable:  false,
		BackgroundJobsOn:  true,
	},
	LoadEmergency: {
		RecommendationsOn: false,
		SearchAutoOn:      false,
		AnalyticsSample:   0.0,
		ReviewsLive:       false,
		WishlistWritable:  false,
		BackgroundJobsOn:  false,
	},
}
```

---

## Auto-Scaling: Not a Silver Bullet

Auto-scaling helps but has real limitations:

```
  Auto-scaling timeline:

  0s:   Traffic spike starts
  30s:  Metrics detect increased load
  60s:  Scaling decision made
  90s:  New instances ordered
  120s: Instances booting (container: 30s, VM: 2-5min)
  150s: Health checks pass
  180s: New instances receiving traffic

  Total: 3+ minutes from spike to relief.

  If your spike saturates capacity in 30 seconds,
  auto-scaling won't save you.
```

### Pre-scaling vs Reactive Scaling

```
  Reactive (auto-scaling):
  - Scale UP when CPU > 70% for 2 minutes
  - Scale DOWN when CPU < 40% for 10 minutes

  Good for: Gradual load changes, daily patterns
  Bad for: Sudden spikes, Black Friday

  Pre-scaling (scheduled):
  - Scale to 2x at 8am, back to 1x at 10pm
  - Scale to 3x on Black Friday morning

  Good for: Predictable patterns, planned events
  Bad for: Unexpected traffic, cost optimization

  Best: Combine both.
  Pre-scale for known patterns.
  Auto-scale for unexpected variance.
```

---

## Capacity Planning Spreadsheet

A practical template:

```
  ┌─────────────────┬────────┬────────┬────────┬────────┬────────┐
  │ Resource        │ Now    │ +3 mo  │ +6 mo  │ +12 mo │ Action │
  ├─────────────────┼────────┼────────┼────────┼────────┼────────┤
  │ API pods        │ 12     │ 18     │ 25     │ 50     │ Auto   │
  │ DB IOPS         │ 15K    │ 23K    │ 35K ⚠ │ 70K ✗  │ Shard  │
  │ DB connections  │ 200    │ 300    │ 450 ⚠ │ 900 ✗  │ PgBnc  │
  │ Redis memory    │ 8 GB   │ 12 GB  │ 18 GB ⚠│ 36 GB  │ Cluster│
  │ Kafka partns    │ 24     │ 24     │ 48     │ 96     │ Expand │
  │ CDN bandwidth   │ 1 Gbps │ 1.5    │ 2.2    │ 5 Gbps │ OK     │
  │ S3 storage      │ 2 TB   │ 3 TB   │ 5 TB   │ 10 TB  │ OK     │
  └─────────────────┴────────┴────────┴────────┴────────┴────────┘

  ⚠ = Approaching limit (> 75% of capacity)
  ✗ = Exceeds current capacity

  DB is the bottleneck. Must shard before +6 months.
  PgBouncer needed before +6 months for connection limit.
  Redis cluster needed before +6 months.
```

---

## Exercises

1. **Capacity model.** You run a video streaming service. Each
   user session generates: 1 API call to start, 1 heartbeat
   every 30s, average session is 45 minutes. You have 500K
   concurrent users at peak. Calculate the API, database, and
   CDN capacity needed. What happens when a popular show
   premieres and peak doubles?

2. **Load test design.** Design a load test plan for an e-commerce
   checkout flow. What scenarios do you test? What are your pass/
   fail criteria? How do you safely run this against production
   without affecting real users?

3. **Growth projection.** Your SaaS product has 10K daily active
   users growing at 20% MoM. Each user makes 50 API calls/day
   on average, with a 5x peak-to-average ratio. When do you hit
   the limits of a single PostgreSQL instance (30K IOPS)? What's
   your scaling plan?

4. **Black Friday plan.** You're the staff engineer responsible for
   Black Friday readiness. Current peak is 500 orders/minute.
   Marketing expects 3-5x normal peak. Write the complete
   preparation plan: what to pre-scale, what to test, what
   feature degradation flags to prepare, and what the on-call
   runbook looks like.

---

[Next: Lesson 8 — Service Mesh Deep Dive -->](08-service-mesh-deep-dive.md)
