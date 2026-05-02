# Lesson 13: Capacity Planning

## The Highway Analogy

A three-lane highway handles 6,000 cars per hour comfortably. At 8,000 cars per hour, traffic slows. At 10,000, it is gridlock. City planners do not wait for gridlock to add lanes. They look at growth trends and build capacity ahead of demand.

Capacity planning for systems works the same way: measure current usage, forecast growth, and provision resources before you hit the wall.

```
REACTIVE (bad)                  PROACTIVE (good)
+--Capacity--+                  +--Capacity--+
|            |  /               |    ________|__ Headroom
|            | /                |   /        |
|            |/ <-- OUTAGE!     |  /         |
|           /|                  | /          |
|          / |                  |/           |
|         /  |                  +            |
|        /   |                  |            |
+--------+---+--> Time          +------------+--> Time
                                 ^
                                 Scale up BEFORE
                                 you need it
```

## The Capacity Planning Process

```
+-----------------------------------------------------------+
|              CAPACITY PLANNING CYCLE                      |
+-----------------------------------------------------------+
|                                                           |
|  1. MEASURE current utilization                           |
|     "Where are we today?"                                 |
|              |                                            |
|              v                                            |
|  2. FORECAST future demand                                |
|     "Where will we be in 3/6/12 months?"                  |
|              |                                            |
|              v                                            |
|  3. PLAN resource allocation                              |
|     "What do we need to provision?"                       |
|              |                                            |
|              v                                            |
|  4. PROVISION (or auto-scale)                             |
|     "Deploy the resources"                                |
|              |                                            |
|              v                                            |
|  5. VALIDATE                                              |
|     "Load test to confirm capacity"                       |
|              |                                            |
|              +-----> Back to step 1 (continuous)          |
+-----------------------------------------------------------+
```

## Measuring Current Capacity

Key metrics to track:

```
PER-SERVICE CAPACITY METRICS
+-----------------------------------------------------------+
| Metric              | Current | Limit    | Utilization    |
+-----------------------------------------------------------+
| CPU (cores)         | 12/40   | 40       | 30%            |
| Memory (GB)         | 48/128  | 128      | 37.5%          |
| Requests/sec        | 2,400   | ~8,000   | 30%            |
| DB connections      | 45/200  | 200      | 22.5%          |
| Disk IOPS           | 3,000   | 10,000   | 30%            |
| Network bandwidth   | 400Mbps | 1 Gbps   | 40%            |
+-----------------------------------------------------------+

WHICH IS THE BOTTLENECK?
  The resource that will hit its limit first
  under load growth = your bottleneck.

  In this case: Network bandwidth (40%) will
  likely be the first constraint as traffic grows.
```

### Prometheus Queries for Capacity

```promql
# CPU utilization per node
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory utilization
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
/ node_memory_MemTotal_bytes * 100

# Disk usage trending
predict_linear(node_filesystem_avail_bytes[7d], 30 * 24 * 3600)

# Request capacity (current vs theoretical max from load test)
sum(rate(http_requests_total[5m])) / 8000 * 100
```

## Headroom

Headroom is the buffer between current usage and capacity limit. You need it for:

```
WHY HEADROOM MATTERS

  +--100%--+
  |        | <-- Limit (bad things happen here)
  |========| <-- Peak traffic spike
  |        | <-- Headroom for spikes
  |########| <-- Normal peak (daily max)
  |########|
  |########| <-- Average utilization
  |########|
  +--------+

  RULE OF THUMB:
  +----------------------------------------+
  | Average utilization < 50%              |
  | Peak utilization < 70%                 |
  | Headroom for failure (N-1): survive    |
  |   losing one instance/zone             |
  +----------------------------------------+

  N+1 REDUNDANCY:
  If you need 3 instances at peak load,
  run 4 so you survive losing one.
```

## Forecasting

### Linear Growth

```
SIMPLE LINEAR FORECAST

  Traffic |
  (rps)   |                          * (forecast)
    4000  |                       *
    3500  |                    *
    3000  |                 *  <-- You are here (Month 6)
    2500  |              *
    2000  |           *
    1500  |        *
    1000  |     *
     500  |  *
          +--+--+--+--+--+--+--+--+--+--+--> Months
             1  2  3  4  5  6  7  8  9 10

  Growth rate: ~500 rps/month
  Current capacity: 8,000 rps
  Time to capacity: (8000 - 3000) / 500 = 10 months

  Action: Provision additional capacity by month 8
  (2 months of headroom before hitting the wall)
```

### Seasonal Patterns

```
E-COMMERCE TRAFFIC PATTERN

  Traffic |
          |              *
          |             * *     <-- Black Friday
          |            *   *
          |     *     *     *
          |    * *   *       *
          |   *   * *         * *
          |  *     *           * *
          | *                     *
          +--+--+--+--+--+--+--+--+--> Months
             J  F  M  A  M  J  J  A  S  O  N  D

  You must plan for the PEAK, not the average.
  If November traffic is 3x July, your capacity
  must handle 3x (or auto-scale to handle it).
```

## Load Testing

Load testing validates your capacity model:

```
LOAD TEST TYPES

  STRESS TEST:
  Load |          ___
       |         /   \      Find the breaking point
       |        /     \
       |       /       \
       |______/         \______
       +----> Time

  SOAK TEST:
  Load |     ______________
       |    |              |    Run at peak for hours
       |    |              |    Find memory leaks, etc.
       |____|              |___
       +----> Time (hours)

  SPIKE TEST:
  Load |         |
       |         |  |       Sudden traffic burst
       |         |  |
       |_________|  |______
       +----> Time

  RAMP TEST:
  Load |              /
       |            /        Gradually increase
       |          /          until failure
       |        /
       |      /
       |    /
       |  /
       +----> Time
```

### Load Testing with k6

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 100 },
    { duration: "5m", target: 500 },
    { duration: "5m", target: 1000 },
    { duration: "5m", target: 2000 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(99)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const res = http.get("https://api.example.com/checkout");
  check(res, {
    "status is 200": (r) => r.status === 200,
    "latency < 500ms": (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

## Auto-Scaling Strategies

```
HORIZONTAL POD AUTOSCALER (Kubernetes)

  Current: 3 pods
  CPU target: 60%

  Load increases --> CPU hits 70%
       |
       v
  HPA scales to 4 pods --> CPU drops to 52%

  Load decreases --> CPU drops to 30%
       |
       v
  HPA scales to 3 pods --> CPU rises to 40%


  +---Pods--->
  5 |            ________
  4 |        ___/        \____
  3 |_______/                 \________
  2 |
    +---+---+---+---+---+---+---+---+---> Time
        ^           ^                ^
        Scale up    Peak             Scale down
```

### Kubernetes HPA Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: checkout-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 4
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60
```

### Vertical Pod Autoscaler

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: checkout-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout
  updatePolicy:
    updateMode: Auto
  resourcePolicy:
    containerPolicies:
      - containerName: checkout
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 4
          memory: 8Gi
```

## Capacity Planning Document

```
+============================================================+
| CAPACITY PLAN: Checkout Service                            |
| Period: Q2 2025                                            |
+============================================================+

CURRENT STATE (March 2025):
  Traffic: 3,000 rps peak, 1,500 rps average
  Infrastructure: 6 pods, 2 cores / 4GB each
  Bottleneck: CPU at 65% during peak
  DB connections: 120/500 at peak

FORECAST (June 2025):
  Expected traffic: 4,500 rps peak (+50% from marketing push)
  Seasonal factor: 1.2x (summer sale)
  Adjusted peak: 5,400 rps

CAPACITY NEEDED:
  CPU: 6 pods * (5400/3000) = 11 pods at current sizing
  Add N+1: 12 pods minimum
  DB connections: 120 * (5400/3000) = 216 (within 500 limit)

ACTIONS:
  1. Scale deployment max to 15 pods (with HPA)
  2. Increase node pool from 4 to 8 nodes
  3. Run load test at 6,000 rps to validate
  4. Review DB connection pool settings

COST ESTIMATE:
  Current: $2,400/month
  Projected: $4,800/month
  Approved by: Engineering Manager

+============================================================+
```

## Exercises

1. **Capacity audit**: For a service you run, measure current utilization of CPU, memory, disk, and network. Identify the bottleneck resource and calculate how much headroom you have.

2. **Forecast exercise**: Your service grows 20% month-over-month. Current peak is 5,000 rps and your tested capacity is 15,000 rps. When will you need to scale? Include N+1 redundancy in your calculation.

3. **Load test design**: Write a k6 load test script that ramps from 0 to 3x your current peak traffic over 10 minutes, holds for 5 minutes, then ramps down. Define thresholds for p99 latency and error rate.

4. **Auto-scaling config**: Write an HPA configuration for a service that scales on both CPU utilization (target 60%) and custom metric `requests_per_second` (target 500 per pod). Set min replicas to 3 and max to 25.

5. **Capacity plan**: Write a capacity planning document for the next quarter. Include current state, growth forecast, required resources, cost estimate, and action items with owners and deadlines.

---

[Next: Lesson 14 - Release Engineering -->](14-release-engineering.md)
