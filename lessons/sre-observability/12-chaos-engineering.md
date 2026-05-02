# Lesson 12: Chaos Engineering

## Fire Drills

Buildings have fire drills not because they expect a fire every week, but because when a fire does happen, everyone needs to know what to do. You discover problems with the evacuation plan during the drill, not during the actual emergency.

Chaos engineering is a **fire drill for your systems**. You break things on purpose, in a controlled way, to find weaknesses before they find you.

```
WITHOUT CHAOS ENGINEERING      WITH CHAOS ENGINEERING
+-------------------------+    +-------------------------+
| "We think our system    |    | "We KNOW our system     |
|  handles failures"      |    |  handles failures       |
|                         |    |  because we tested it"  |
| PRODUCTION:             |    |                         |
| "Oh no, the DB failed   |    | PRODUCTION:             |
|  over and nothing       |    | "DB failed over.        |
|  happened like we       |    |  Failover completed in  |
|  expected"              |    |  12 seconds as expected"|
+-------------------------+    +-------------------------+
    Hope                           Confidence
```

## The Chaos Engineering Process

```
+------------------------------------------------------------+
|              CHAOS ENGINEERING CYCLE                        |
+------------------------------------------------------------+
|                                                            |
|   1. DEFINE STEADY STATE                                   |
|      "What does normal look like?"                         |
|      (Latency < 100ms, error rate < 0.1%)                 |
|              |                                             |
|              v                                             |
|   2. HYPOTHESIZE                                           |
|      "If we kill a pod, the system will continue           |
|       serving requests with < 200ms latency"               |
|              |                                             |
|              v                                             |
|   3. INTRODUCE CHAOS                                       |
|      Kill the pod. Inject latency. Drop network packets.  |
|              |                                             |
|              v                                             |
|   4. OBSERVE                                               |
|      Did the system maintain steady state?                 |
|      What happened to latency, errors, throughput?         |
|              |                                             |
|              v                                             |
|   5. LEARN AND FIX                                         |
|      If hypothesis was wrong: fix the weakness             |
|      If hypothesis was right: increase blast radius        |
|                                                            |
+------------------------------------------------------------+
```

## Types of Chaos Experiments

```
INFRASTRUCTURE FAILURES
+----------------------------------+
| Kill a container/pod             |
| Kill a VM/node                   |
| Fill up disk space               |
| Exhaust memory                   |
| Saturate CPU                     |
+----------------------------------+

NETWORK FAILURES
+----------------------------------+
| Add latency (50ms, 500ms, 5s)   |
| Drop packets (1%, 10%, 50%)     |
| Partition network segments       |
| DNS resolution failure           |
| Block specific ports             |
+----------------------------------+

APPLICATION FAILURES
+----------------------------------+
| Kill a specific process          |
| Return errors from dependencies  |
| Inject slow responses            |
| Corrupt cache entries            |
| Simulate clock skew              |
+----------------------------------+

CLOUD/PLATFORM FAILURES
+----------------------------------+
| Fail an availability zone        |
| Revoke IAM permissions           |
| Delete a load balancer           |
| Simulate region failover         |
+----------------------------------+
```

## Chaos Monkey and the Netflix Simian Army

Netflix pioneered chaos engineering with tools named after primates:

```
THE SIMIAN ARMY

  +------------------+------------------------------------------+
  | Chaos Monkey     | Randomly kills production instances      |
  | Latency Monkey   | Injects artificial delays               |
  | Conformity Monkey| Finds instances not following best       |
  |                  | practices                                |
  | Chaos Gorilla    | Takes down an entire availability zone  |
  | Chaos Kong       | Simulates entire region failure          |
  +------------------+------------------------------------------+

  The philosophy: If your system cannot survive a monkey
  randomly pulling cables, it is not resilient enough.
```

## Tools for Chaos Engineering

### Litmus Chaos (Kubernetes)

```yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: checkout-chaos
  namespace: production
spec:
  appinfo:
    appns: production
    applabel: "app=checkout"
    appkind: deployment
  engineState: active
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "30"
            - name: CHAOS_INTERVAL
              value: "10"
            - name: FORCE
              value: "false"
```

### Chaos Toolkit

```json
{
  "title": "Checkout resilience to pod failure",
  "description": "Verify checkout maintains 99.9% availability when a pod is killed",
  "steady-state-hypothesis": {
    "title": "Checkout is healthy",
    "probes": [
      {
        "type": "probe",
        "name": "checkout-responds",
        "tolerance": 200,
        "provider": {
          "type": "http",
          "url": "http://checkout-service/health",
          "timeout": 3
        }
      },
      {
        "type": "probe",
        "name": "error-rate-normal",
        "tolerance": {
          "type": "range",
          "range": [0, 0.01]
        },
        "provider": {
          "type": "python",
          "module": "prometheus_query",
          "func": "query_error_rate",
          "arguments": {
            "service": "checkout"
          }
        }
      }
    ]
  },
  "method": [
    {
      "type": "action",
      "name": "kill-checkout-pod",
      "provider": {
        "type": "python",
        "module": "chaosk8s.pod.actions",
        "func": "terminate_pods",
        "arguments": {
          "label_selector": "app=checkout",
          "ns": "production",
          "qty": 1
        }
      }
    }
  ],
  "rollbacks": [
    {
      "type": "action",
      "name": "ensure-checkout-scaled",
      "provider": {
        "type": "python",
        "module": "chaosk8s.deployment.actions",
        "func": "scale_deployment",
        "arguments": {
          "name": "checkout",
          "replicas": 3,
          "ns": "production"
        }
      }
    }
  ]
}
```

## GameDays

A GameDay is a planned chaos event where the team runs experiments together:

```
GAMEDAY SCHEDULE

  BEFORE (1 week prior):
  +----------------------------------------+
  | Choose experiments                      |
  | Define steady state metrics             |
  | Prepare rollback procedures             |
  | Notify stakeholders                     |
  | Ensure observability is in place        |
  +----------------------------------------+

  DURING (2-4 hours):
  +----------------------------------------+
  | 09:00 - Kickoff, review plan            |
  | 09:15 - Experiment 1: Kill one pod      |
  |         Observe, record findings        |
  | 09:45 - Experiment 2: Add 500ms latency |
  |         to database calls               |
  |         Observe, record findings        |
  | 10:30 - Experiment 3: Network partition |
  |         between AZ-a and AZ-b          |
  |         Observe, record findings        |
  | 11:15 - Review all findings             |
  | 11:45 - Prioritize fixes               |
  +----------------------------------------+

  AFTER (next sprint):
  +----------------------------------------+
  | Write up findings                       |
  | Create tickets for fixes                |
  | Schedule next GameDay                   |
  +----------------------------------------+
```

## Blast Radius Control

```
PROGRESSIVE BLAST RADIUS

  START SMALL                       GROW WITH CONFIDENCE
  +----------+    +----------+    +----------+    +----------+
  | Dev/Test |    | Staging  |    | Prod:    |    | Prod:    |
  | environ- | -> | environ- | -> | Single   | -> | Full AZ  |
  | ment     |    | ment     |    | instance |    | failure  |
  +----------+    +----------+    +----------+    +----------+
   Low risk        Medium risk    Controlled risk  High value

  SAFETY CONTROLS:
  +----------------------------------------------+
  | - Automatic abort if error rate > threshold  |
  | - Time-bounded experiments (max 5 minutes)   |
  | - Manual kill switch always available        |
  | - Run during business hours (people awake)   |
  | - Avoid peak traffic periods                 |
  | - Notify support team before starting        |
  +----------------------------------------------+
```

## What to Test First

```
PRIORITY MATRIX

  HIGH IMPACT, LIKELY TO FAIL:
  +------------------------------------------+
  | Database failover                        |  <-- Test this first
  | Cache failure (Redis/Memcached goes down)|
  | External API timeout (Stripe, AWS, etc.) |
  +------------------------------------------+

  HIGH IMPACT, SHOULD WORK (BUT DOES IT?):
  +------------------------------------------+
  | Load balancer failover                   |
  | Auto-scaling under sudden load spike     |
  | Kubernetes pod rescheduling              |
  +------------------------------------------+

  LOWER PRIORITY (BUT STILL VALUABLE):
  +------------------------------------------+
  | Disk full on logging volume              |
  | DNS resolution failure                   |
  | Clock skew between services              |
  +------------------------------------------+
```

## Measuring Chaos Experiment Results

```
EXPERIMENT REPORT

  Experiment: Kill 1 of 3 checkout pods
  Date: 2025-03-15
  Duration: 5 minutes

  Hypothesis: "System maintains < 200ms p99 and < 0.1% errors"

  RESULTS:
  +------------------+-----------+----------+---------+
  | Metric           | Before    | During   | Verdict |
  +------------------+-----------+----------+---------+
  | p99 latency      | 85ms      | 142ms    | PASS    |
  | Error rate       | 0.01%     | 0.8%     | FAIL    |
  | Request rate     | 2400 rps  | 2400 rps | PASS    |
  | Recovery time    | N/A       | 45 sec   | PASS    |
  +------------------+-----------+----------+---------+

  FINDING: 0.8% error spike during pod reschedule.
  Kubernetes readiness probe passes before app is truly ready.

  ACTION: Add startup probe with 10-second initial delay.
```

## Exercises

1. **Experiment design**: Design three chaos experiments for a service you work on. For each: define the steady state, write the hypothesis, describe the chaos action, and list what you will observe.

2. **GameDay plan**: Plan a 3-hour GameDay for your team. Include: pre-GameDay preparation checklist, 4 experiments with progressive blast radius, safety controls, and a post-GameDay action plan.

3. **Blast radius analysis**: Your checkout service has 5 pods across 2 availability zones. Map out the blast radius of these experiments: (a) kill 1 pod, (b) kill all pods in one AZ, (c) add 2s latency to DB calls, (d) revoke S3 permissions.

4. **Tool setup**: Using Chaos Toolkit or Litmus Chaos, write an experiment definition (JSON or YAML) that kills a pod and verifies the health endpoint still responds within 5 seconds.

5. **Findings report**: After running this experiment - "inject 500ms latency on all database calls for 2 minutes" - the results show p99 latency went from 100ms to 8 seconds and error rate spiked to 5%. Write up the finding, root cause analysis, and three action items to improve resilience.

---

[Next: Lesson 13 - Capacity Planning -->](13-capacity-planning.md)
