# Lesson 14: Monitoring Deployments

> **The one thing to remember**: Deploying without monitoring is like
> launching a rocket and closing your eyes. You need to WATCH the
> rocket after launch — is it on course? Is the engine running? Are
> the astronauts alive? Deployment monitoring answers: "did this deploy
> make things better, worse, or the same?"

---

## The Hospital Analogy

When a patient comes out of surgery, they don't just go home. They go
to a recovery room with monitors:

```
POST-SURGERY MONITORING (= Post-Deploy Monitoring)

  +------------------------------------------+
  |  RECOVERY ROOM                            |
  |                                          |
  |  Heart rate:    72 bpm  ✓ normal         |  = Request rate
  |  Blood pressure: 120/80 ✓ normal         |  = Latency
  |  Temperature:   98.6°F  ✓ normal         |  = Error rate
  |  Oxygen:        98%     ✓ normal         |  = CPU/Memory
  |  Pain level:    3/10    ✓ acceptable     |  = User complaints
  |                                          |
  |  If ANY metric goes critical:            |
  |  → Alert the doctor (page on-call)       |
  |  → Take immediate action (rollback)      |
  +------------------------------------------+
```

The same principle applies to deployments. After every deploy, you
monitor key metrics for a window of time before declaring success.

---

## The Four Golden Signals

Google's SRE (Site Reliability Engineering) team identified four key
metrics to monitor:

```
THE FOUR GOLDEN SIGNALS

  1. LATENCY
     How long requests take.
     Track both successful and failed request latency.
     Example: p50 = 50ms, p95 = 200ms, p99 = 500ms

  2. TRAFFIC
     How much demand is hitting your system.
     Example: 1,500 requests per second

  3. ERRORS
     How many requests are failing.
     Example: Error rate = 0.5% (HTTP 5xx responses)

  4. SATURATION
     How "full" your system is.
     Example: CPU at 65%, Memory at 72%, Disk at 45%
```

```
GOLDEN SIGNALS DASHBOARD (ASCII)

  Latency (p95)                    Error Rate
  250ms|          ____             5%|
  200ms|    __---     \--          4%|
  150ms|---              \__       3%|
  100ms|                    ---    2%|
   50ms|                           1%|____________________
      0+-----|-----|-----|----     0%+-----|-----|-----|----
       -15m  -10m  -5m   now        -15m  -10m  -5m   now
                    ↑                              ↑
              deploy here                    deploy here

  Traffic (req/s)                  CPU Usage
  2000|    _____                   100%|
  1500|---      ----               80%|
  1000|             \____          60%|____    _____
   500|                            40%|    ---
      0+-----|-----|-----|----     20%|
       -15m  -10m  -5m   now        0+-----|-----|-----|----
                                     -15m  -10m  -5m   now
```

After a deployment, you're looking for:
- **Latency spike**: Did the new version make things slower?
- **Error spike**: Did the new version introduce bugs?
- **Traffic drop**: Are users hitting errors and giving up?
- **Saturation jump**: Is the new version using more resources?

---

## Health Checks

A health check is an endpoint that tells you if your application is
alive and working:

```javascript
// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: process.env.APP_VERSION });
});

// Deep health check (checks dependencies)
app.get('/health/ready', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    externalApi: false,
  };

  try {
    await db.query('SELECT 1');
    checks.database = true;
  } catch (e) { /* db down */ }

  try {
    await redis.ping();
    checks.redis = true;
  } catch (e) { /* redis down */ }

  try {
    await fetch('https://api.stripe.com/v1', { method: 'HEAD' });
    checks.externalApi = true;
  } catch (e) { /* api down */ }

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
    checks,
  });
});
```

```
HEALTH CHECK TYPES

  Type          Endpoint         Checks                Use
  ---------------------------------------------------------------
  Liveness      /health/live     "Is the process       Restart if
                                  running?"             dead

  Readiness     /health/ready    "Can it serve          Route traffic
                                  traffic? Are           only when
                                  dependencies up?"      ready

  Startup       /health/startup  "Has it finished       Wait for slow
                                  initializing?"         startups

  Deep health   /health/deep     All of the above       Dashboard,
                                  plus detailed info     debugging
```

```
HEALTH CHECK FLOW IN DEPLOYMENT

  Deploy new version
       |
       v
  Startup check: Is the new instance running?
       |
       ├── Not running after 60s → KILL and rollback
       └── Running → continue
              |
              v
  Readiness check: Can it handle traffic?
       |
       ├── Not ready after 30s → KILL and rollback
       └── Ready → route traffic to it
              |
              v
  Liveness check: Still running? (every 10 seconds)
       |
       ├── Dead → Restart instance
       └── Alive → Keep going
```

---

## Automatic Rollback Triggers

Define clear criteria for when a deployment should be automatically
rolled back:

```
ROLLBACK TRIGGERS

  Metric                    Threshold            Action
  ---------------------------------------------------------------
  Error rate (5xx)          > 5% for 2 minutes   Auto rollback
  Latency (p95)             > 2x baseline        Auto rollback
  Health check              3 failures in a row  Auto rollback
  CPU usage                 > 90% for 5 minutes  Alert + manual
  Memory usage              > 85% for 5 minutes  Alert + manual
  Request rate drop         > 30% sudden drop    Alert + manual
```

### Implementing Auto-Rollback in CI/CD

```yaml
name: Deploy with Monitoring

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy new version
        run: ./scripts/deploy.sh ${{ github.sha }}

      - name: Post-deploy monitoring
        run: |
          BASELINE_ERROR_RATE=0.01
          MONITORING_DURATION=300
          CHECK_INTERVAL=30

          END_TIME=$(($(date +%s) + MONITORING_DURATION))

          while [ $(date +%s) -lt $END_TIME ]; do
            CURRENT_ERROR_RATE=$(curl -s http://metrics.internal/error-rate)

            if (( $(echo "$CURRENT_ERROR_RATE > 0.05" | bc -l) )); then
              echo "ERROR RATE TOO HIGH: $CURRENT_ERROR_RATE (threshold: 0.05)"
              echo "TRIGGERING ROLLBACK"
              ./scripts/rollback.sh
              exit 1
            fi

            HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://app.internal/health)
            if [ "$HEALTH" != "200" ]; then
              echo "HEALTH CHECK FAILED: HTTP $HEALTH"
              echo "TRIGGERING ROLLBACK"
              ./scripts/rollback.sh
              exit 1
            fi

            echo "Check passed: error_rate=$CURRENT_ERROR_RATE, health=$HEALTH"
            sleep $CHECK_INTERVAL
          done

          echo "Monitoring period complete. Deployment successful."
```

---

## Deployment Metrics (DORA)

Track these metrics to measure your deployment health over time:

```
DORA METRICS

  Metric                    What It Measures           Target
  ---------------------------------------------------------------
  Deployment Frequency      How often you deploy       Daily+
  Lead Time for Changes     Code commit → production   < 1 hour
  Change Failure Rate       % of deploys causing       < 5%
                            incidents
  Time to Restore Service   Incident → resolved        < 1 hour

  TRACKING EXAMPLE (Monthly):

  Month     Deploys   Lead Time   Failures   MTTR
  -----------------------------------------------
  January   22        4 hours     3 (14%)    2 hours
  February  35        2 hours     2 (6%)     1 hour
  March     48        45 min      1 (2%)     30 min
  April     62        30 min      2 (3%)     15 min

  More deploys → smaller changes → fewer failures → faster recovery
```

---

## Deployment Observability Stack

```
OBSERVABILITY STACK

  +---------+    +----------+    +----------+
  | Metrics |    |   Logs   |    |  Traces  |
  | (numbers)|   | (text)   |    | (flow)   |
  +---------+    +----------+    +----------+
       |              |               |
       v              v               v
  Prometheus     Loki/ELK        Jaeger/Zipkin
  Grafana        Kibana          Tempo
       |              |               |
       +------+-------+-------+------+
              |               |
              v               v
       +-----------+    +-----------+
       |  Alerting |    | Dashboard |
       |  PagerDuty|    |  Grafana  |
       +-----------+    +-----------+

  Metrics: WHAT is happening (error rate = 5%)
  Logs:    WHY it's happening (NullPointerException at line 42)
  Traces:  WHERE it's happening (request took 2s in database query)
```

### Deployment Annotations

Mark deployments on your dashboards to correlate changes with metrics:

```yaml
- name: Annotate deployment in Grafana
  run: |
    curl -X POST http://grafana.internal/api/annotations \
      -H "Authorization: Bearer $GRAFANA_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "text": "Deploy ${{ github.sha }}",
        "tags": ["deployment", "production"],
        "time": '$(date +%s000)'
      }'
```

```
DEPLOYMENT ANNOTATION ON DASHBOARD

  Error Rate
  5%|
  4%|
  3%|                     |← deploy v2.1
  2%|          |← deploy  |
  1%|          | v2.0     |    _____
   0|__________↓__________↓___/     \____
    +-----|-----|-----|-----|-----|-----|---->
     Mon   Tue   Wed   Thu   Fri   Sat

  The vertical lines mark deployments.
  Easy to see: "did this deploy cause the error spike?"
```

---

## Smoke Tests After Deploy

Smoke tests are quick, critical-path tests run against the live
production environment immediately after a deploy:

```javascript
// smoke-test.js
const BASE_URL = process.env.PRODUCTION_URL;

async function smokeTest() {
  const tests = [
    { name: 'Homepage loads', url: '/', expectedStatus: 200 },
    { name: 'API responds', url: '/api/health', expectedStatus: 200 },
    { name: 'Login page loads', url: '/login', expectedStatus: 200 },
    { name: 'Static assets', url: '/favicon.ico', expectedStatus: 200 },
  ];

  let failures = 0;

  for (const test of tests) {
    const response = await fetch(`${BASE_URL}${test.url}`);
    if (response.status !== test.expectedStatus) {
      console.error(`FAIL: ${test.name} - got ${response.status}`);
      failures++;
    } else {
      console.log(`PASS: ${test.name}`);
    }
  }

  if (failures > 0) {
    console.error(`${failures} smoke test(s) failed!`);
    process.exit(1);
  }

  console.log('All smoke tests passed!');
}

smokeTest();
```

```yaml
      - name: Run smoke tests
        run: node smoke-test.js
        env:
          PRODUCTION_URL: https://myapp.com

      - name: Rollback on smoke test failure
        if: failure()
        run: ./scripts/rollback.sh
```

---

## Exercises

1. **Build a health endpoint**: Add `/health`, `/health/ready`, and
   `/health/live` endpoints to any application. The ready check should
   verify database connectivity.

2. **Create a monitoring script**: Write a script that polls your
   health endpoint every 10 seconds for 5 minutes after a deploy.
   Report the results.

3. **Dashboard design**: Sketch a post-deploy monitoring dashboard.
   What four metrics would you display? What thresholds trigger
   alerts?

4. **Smoke test suite**: Write 5 smoke tests for a web application
   you maintain. Run them after your next deploy.

5. **Track DORA metrics**: For your next 10 deployments, record
   deployment frequency, lead time, failure rate, and MTTR. Are you
   improving?

---

[Next: Lesson 15 — Multi-Environment Pipelines](./15-multi-env-pipelines.md)
