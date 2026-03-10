# Reference: Runbook Template

Use this template for every alert that pages on-call. A runbook turns a 3 AM panic into a step-by-step procedure.

---

## Runbook: [Alert Name]

```
+============================================================+
| RUNBOOK: [Alert Name]                                      |
| Service: [service-name]                                    |
| Severity: [Critical/High/Warning]                          |
| Last Updated: [YYYY-MM-DD]                                 |
| Author: [name]                                             |
+============================================================+
```

### Overview

**What this alert means**: One paragraph explaining what the alert detects and why it matters to users.

**Expected impact**: What users experience when this alert fires (slow requests, errors, feature unavailable, etc.).

### Quick Links

```
Dashboard:  https://grafana.internal/d/[dashboard-id]
Logs:       https://grafana.internal/explore?query={service="[name]"}
Traces:     https://grafana.internal/explore?query=traces
Status Page: https://status.company.com/admin
Slack:       #team-[name]
```

### Step 1: Triage

Determine if this is a real incident or a false alarm.

```
CHECK                              RESULT --> ACTION
+-----------------------------------+-------------------+
| Dashboard shows spike in errors?  | YES --> Step 2    |
|                                   | NO  --> Check if  |
|                                   |   alert is stale  |
+-----------------------------------+-------------------+
| Users reporting issues in         | YES --> Step 2    |
| support channel?                  | NO  --> Monitor   |
|                                   |   for 10 minutes  |
+-----------------------------------+-------------------+
| Multiple services affected?       | YES --> May be    |
|                                   |   infrastructure. |
|                                   |   Check #infra    |
+-----------------------------------+-------------------+
```

### Step 2: Diagnose

Find the root cause.

**Check the logs**:

```
# Loki query for recent errors
{service="[service-name]"} |= "error" | json | level="error"
```

**Check the traces**:

```
# Look for slow or failed spans
{service="[service-name]"} | duration > 5s | status = error
```

**Check dependencies**:

```
DEPENDENCY           HOW TO CHECK               STATUS
+-------------------+-------------------------+---------+
| Database          | SELECT 1 or dashboard   | OK / BAD|
| Redis cache       | redis-cli ping          | OK / BAD|
| External API      | Check their status page | OK / BAD|
| Message queue     | Queue depth dashboard   | OK / BAD|
+-------------------+-------------------------+---------+
```

**Common causes**:

```
SYMPTOM                        LIKELY CAUSE
+-----------------------------+----------------------------+
| Connection timeouts to DB   | DB overloaded or down      |
| Sudden error spike after    | Bad deploy, check recent   |
|   deploy                    |   changes                  |
| Gradual latency increase    | Resource exhaustion (mem,  |
|                             |   connections, disk)       |
| Errors from external API    | Dependency outage          |
+-----------------------------+----------------------------+
```

### Step 3: Mitigate

Stop the bleeding first. Root cause fix comes later.

**Option A: Rollback the last deploy**

```bash
kubectl rollout undo deployment/[service-name] -n production
```

Verify:

```bash
kubectl rollout status deployment/[service-name] -n production
```

**Option B: Scale up**

```bash
kubectl scale deployment/[service-name] --replicas=10 -n production
```

**Option C: Feature flag disable**

```bash
curl -X PATCH https://flags.internal/api/flags/[flag-name] \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled": false}'
```

**Option D: Restart pods**

```bash
kubectl rollout restart deployment/[service-name] -n production
```

### Step 4: Verify Resolution

```
CHECK                              EXPECTED RESULT
+-----------------------------------+-------------------+
| Error rate on dashboard           | Back to baseline  |
|                                   | (< 0.1%)         |
+-----------------------------------+-------------------+
| p99 latency on dashboard          | Back to baseline  |
|                                   | (< 200ms)        |
+-----------------------------------+-------------------+
| Alert resolved in PagerDuty       | Auto-resolved     |
+-----------------------------------+-------------------+
| Spot-check: manual request to     | Returns 200 with  |
| the service                       | correct data      |
+-----------------------------------+-------------------+
```

### Step 5: Escalation

```
ESCALATE IF:
+--------------------------------------------------+
| Mitigation steps did not work after 15 minutes   |
| You are unsure of the root cause                 |
| Multiple services are affected                   |
| Data loss is suspected                           |
| The issue is security-related                    |
+--------------------------------------------------+

WHO TO CONTACT:
+-------------------+-----------------------------------+
| Role              | Contact                           |
+-------------------+-----------------------------------+
| Secondary on-call | PagerDuty auto-escalation (5 min) |
| Team lead         | @[name] on Slack or phone         |
| Database team     | #dba-oncall on Slack              |
| Infrastructure    | #infra-oncall on Slack            |
| Security          | #security-oncall on Slack         |
+-------------------+-----------------------------------+
```

### Step 6: Post-Incident

```
AFTER THE INCIDENT IS RESOLVED:
+--------------------------------------------------+
| [ ] Update status page to "Resolved"             |
| [ ] Post summary in incident Slack channel       |
| [ ] Determine if postmortem is needed            |
|     (SEV1/2: always. SEV3: if novel failure)     |
| [ ] File ticket for root cause fix if not done   |
| [ ] Update this runbook with new learnings       |
+--------------------------------------------------+
```

---

## Example: Completed Runbook

```
+============================================================+
| RUNBOOK: HighErrorRate-Checkout                            |
| Service: checkout-api                                      |
| Severity: Critical                                         |
| Last Updated: 2025-03-10                                   |
| Author: Alice                                              |
+============================================================+
```

### Overview

**What this alert means**: The checkout service is returning HTTP 5xx errors at a rate exceeding 1% of total requests for more than 5 minutes. This directly impacts customers attempting to complete purchases.

**Expected impact**: Customers see error pages when trying to check out. Revenue loss is approximately $750 per minute of full outage.

### Quick Links

```
Dashboard:   https://grafana.internal/d/checkout-overview
Logs:        https://grafana.internal/explore?left={"queries":[{"expr":"{service=\"checkout-api\"} |= \"error\""}]}
Traces:      https://grafana.internal/explore?left={"queries":[{"query":"service.name=\"checkout-api\" status=error"}]}
Status Page: https://status.acme.com/admin
Slack:       #team-payments
Deploys:     https://argo.internal/applications/checkout-api
```

### Triage Checklist

```
1. Open dashboard (link above). Confirm error rate spike.
2. Check #incidents Slack for known ongoing issues.
3. Check deploy history: was there a recent deploy?
   kubectl rollout history deployment/checkout-api -n production
4. Check dependency status pages (Stripe, Redis, PostgreSQL).
```

### Common Causes and Fixes

```
CAUSE                    FIX
+----------------------+-------------------------------------+
| Bad deploy           | kubectl rollout undo                |
|                      |   deployment/checkout-api           |
|                      |   -n production                     |
+----------------------+-------------------------------------+
| DB connection pool   | Restart pods:                       |
| exhaustion           |   kubectl rollout restart            |
|                      |   deployment/checkout-api            |
|                      |   -n production                     |
|                      | Then investigate connection leak     |
+----------------------+-------------------------------------+
| Stripe API outage    | Check status.stripe.com             |
|                      | Enable offline payment queue:       |
|                      |   feature-flags set                 |
|                      |   payment-queue-mode true           |
+----------------------+-------------------------------------+
| Redis failure        | Check redis dashboard               |
|                      | Checkout works without cache        |
|                      | (slower but functional)             |
|                      | Page #infra-oncall if Redis is down |
+----------------------+-------------------------------------+
| High traffic spike   | Scale up:                           |
|                      |   kubectl scale                     |
|                      |   deployment/checkout-api           |
|                      |   --replicas=15 -n production       |
+----------------------+-------------------------------------+
```

### Verify Resolution

```bash
# Check error rate is back to normal
curl -s "http://prometheus:9090/api/v1/query?query=sum(rate(http_requests_total{service='checkout-api',code=~'5..'}[5m]))/sum(rate(http_requests_total{service='checkout-api'}[5m]))"

# Spot check the service
curl -w "%{http_code}" https://api.acme.com/checkout/health

# Check PagerDuty alert resolved
```

---

[Back to Track Overview](00-roadmap.md)
