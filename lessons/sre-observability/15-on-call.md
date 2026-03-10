# Lesson 15: On-Call

## The Night Shift Doctor

Hospitals have night shift doctors. They do not treat every ailment; they handle emergencies. They have protocols for common cases, escalation paths for specialists, and they hand off to day staff with clear notes. Good hospitals also make sure night shifts are shared fairly and that doctors are not burned out.

On-call engineering follows the same model.

```
GOOD ON-CALL                   BAD ON-CALL
+-------------------------+    +-------------------------+
| Clear escalation paths  |    | "You are on your own"   |
| Runbooks for common     |    | No documentation        |
| issues                  |    |                         |
| Shared rotation         |    | Same person every week  |
| Quiet nights (most of   |    | Paged 10x per night     |
| the time)               |    |                         |
| Compensated fairly      |    | "Part of the job"       |
| Leads to system         |    | Leads to burnout        |
| improvements            |    | and attrition           |
+-------------------------+    +-------------------------+
```

## On-Call Rotation Design

```
ROTATION SCHEDULE (example: 4-person team)

  Week 1: Alice (primary), Bob (secondary)
  Week 2: Bob (primary), Carol (secondary)
  Week 3: Carol (primary), Dave (secondary)
  Week 4: Dave (primary), Alice (secondary)

  PRIMARY: First responder. Gets paged.
  SECONDARY: Backup if primary does not acknowledge
             within 5 minutes. Also available for help.

  HANDOFF: Monday 10:00 AM
  +--------------------------------------------+
  | Outgoing on-call briefs incoming:          |
  | - Active incidents or ongoing issues       |
  | - Recent deploys or config changes         |
  | - Known risks or upcoming maintenance      |
  | - Pages received and their resolutions     |
  +--------------------------------------------+
```

### Rotation Rules

```
MINIMUM TEAM SIZE FOR ON-CALL:
  4 engineers = minimum for sustainable rotation
  (Each person on-call ~1 week per month)

  Fewer than 4? Options:
    - Share rotation with another team
    - Use follow-the-sun across time zones
    - Invest in automation to reduce pages

FOLLOW-THE-SUN (3 time zones):
  +--------+  +--------+  +--------+
  |  US    |  | Europe |  |  APAC  |
  | 8am-4pm|  | 4pm-12am| | 12am-8am|
  +--------+  +--------+  +--------+
  Nobody gets woken up at 3 AM.
```

## On-Call Expectations

```
WHEN ON-CALL, YOU SHOULD:
+---------------------------------------------------+
| Acknowledge pages within 5 minutes                |
| Have laptop and internet access at all times      |
| Be within cell service range                      |
| Not be impaired (alcohol, extreme fatigue)        |
| Know how to access runbooks and dashboards        |
| Know the escalation path                          |
+---------------------------------------------------+

WHEN ON-CALL, YOU SHOULD NOT:
+---------------------------------------------------+
| Fix every problem yourself (escalate!)            |
| Make major changes without approval               |
| Ignore secondary duties (like documentation)      |
| Stay up all night debugging a non-critical issue  |
| Skip the handoff briefing                         |
+---------------------------------------------------+
```

## Reducing Toil

Toil is the enemy of sustainable on-call. If most pages require the same manual steps, automate them.

```
TOIL IDENTIFICATION

  Review last month's pages:
  +----------------------------------------+--------+
  | Page                                   | Count  |
  +----------------------------------------+--------+
  | Disk space > 90% on log volume         | 23     |
  | Certificate expiring                   | 8      |
  | Pod OOMKilled                          | 12     |
  | Deployment rollback needed             | 3      |
  | Actual production incident             | 2      |
  +----------------------------------------+--------+
  | TOTAL                                  | 48     |
  +----------------------------------------+--------+

  Only 2 of 48 pages were real incidents!
  The other 46 are TOIL that should be automated.
```

### Automation Examples

```
BEFORE: Manual disk cleanup (23 pages/month)
  On-call gets paged
  SSH into server
  Find and delete old log files
  Verify disk space recovered

AFTER: Automated log rotation
  Logrotate configured to rotate at 80%
  Old logs shipped to cold storage
  Auto-cleanup of logs > 7 days
  Alert only if automation fails
  Pages/month: 0

BEFORE: Certificate renewal (8 pages/month)
  On-call gets paged 7 days before expiry
  Manually renews certificate
  Updates Kubernetes secret
  Restarts affected pods

AFTER: cert-manager with auto-renewal
  cert-manager watches certificates
  Renews automatically at 30 days before expiry
  Updates secrets automatically
  Pages/month: 0 (alert only if renewal fails)
```

## On-Call Handoff

```
HANDOFF DOCUMENT (Updated weekly)

+============================================+
| ON-CALL HANDOFF: Week of March 10, 2025   |
| From: Alice  To: Bob                       |
+============================================+

ACTIVE ISSUES:
  - Payment service intermittent 504s
    (tracked in INC-2345, auto-retries masking it)
  - Node pool scaling event scheduled for Wed 2am

RECENT CHANGES:
  - v2.4.1 deployed Monday (connection pool fix)
  - New Prometheus alerting rules for DB latency
  - Redis cluster expanded from 3 to 5 nodes

KNOWN RISKS:
  - Black Friday load test on Thursday 2pm
  - AWS maintenance window: Friday 3-5am US-East

PAGES THIS WEEK:
  - Mon 2:15am: Disk space on log-server-3 (manual cleanup,
    automation ticket filed: INFRA-789)
  - Wed 10:30am: High error rate on search (resolved:
    Elasticsearch node came back after GC pause)
  - No other pages

TIPS:
  - If payment-service alerts, check Redis first
    (it was the root cause 3 of last 5 times)
+============================================+
```

## Compensation and Fairness

```
ON-CALL COMPENSATION MODELS:

  MODEL 1: FLAT STIPEND
  +----------------------------------+
  | $X per week of on-call duty      |
  | Simple, predictable              |
  | Does not account for page volume |
  +----------------------------------+

  MODEL 2: STIPEND + PER-PAGE
  +----------------------------------+
  | Base: $X per week                |
  | Plus: $Y per page after hours    |
  | Incentivizes reducing pages      |
  +----------------------------------+

  MODEL 3: COMP TIME
  +----------------------------------+
  | Time off proportional to pages   |
  | Paged at 3am? Take Monday off   |
  | Ensures rest and recovery        |
  +----------------------------------+

  MODEL 4: HYBRID
  +----------------------------------+
  | Base stipend + comp time for     |
  | off-hours pages                  |
  | Most balanced approach           |
  +----------------------------------+

FAIRNESS PRINCIPLES:
  - Rotate evenly (no "volunteers" who always take it)
  - Track page load per person over time
  - Adjust rotation if one shift is consistently worse
  - Holidays and weekends count extra
  - No on-call during vacation or personal leave
```

## Measuring On-Call Health

```
ON-CALL HEALTH METRICS

  +----------------------------------+----------+---------+
  | Metric                           | Current  | Target  |
  +----------------------------------+----------+---------+
  | Pages per week                   | 12       | < 5     |
  | Pages per on-call shift          | 3        | < 2     |
  | Off-hours pages per week         | 4        | < 1     |
  | % pages that were actionable     | 60%      | > 90%   |
  | Mean time to acknowledge         | 3 min    | < 5 min |
  | Mean time to resolve             | 45 min   | < 30 min|
  | Toil ratio (automatable pages)   | 70%      | < 20%   |
  +----------------------------------+----------+---------+

  REVIEW MONTHLY. If metrics are bad:
    - Invest in automation (reduce toil pages)
    - Tune alert thresholds (reduce noise)
    - Fix root causes (reduce repeat pages)
    - Add runbooks (reduce resolution time)
```

## Building a Page-Free Future

```
THE TOIL REDUCTION FLYWHEEL

  Pages happen
       |
       v
  Postmortem / review
       |
       v
  Identify automatable work
       |
       v
  Build automation
       |
       v
  Fewer pages
       |
       v
  More time for engineering
       |
       v
  Better systems, fewer failures
       |
       +------> back to top (fewer pages each cycle)


  QUARTER 1: 48 pages/month
  QUARTER 2: 28 pages/month (automated disk + certs)
  QUARTER 3: 15 pages/month (fixed OOM issues, better HPA)
  QUARTER 4:  5 pages/month (mostly real incidents)
```

## On-Call Onboarding

```
NEW ENGINEER ON-CALL ONBOARDING

  WEEK 1-2: SHADOW
  +----------------------------------------+
  | Shadow the current on-call             |
  | Read all runbooks                      |
  | Access all dashboards and tools        |
  | Practice: respond to a simulated page  |
  +----------------------------------------+

  WEEK 3-4: REVERSE SHADOW
  +----------------------------------------+
  | You are primary, mentor is secondary   |
  | Mentor is available but you drive      |
  | Mentor reviews your incident responses |
  +----------------------------------------+

  WEEK 5+: INDEPENDENT
  +----------------------------------------+
  | Full on-call rotation                  |
  | Secondary is still available as backup |
  | Debrief after first solo rotation      |
  +----------------------------------------+

  BEFORE GOING ON-CALL, VERIFY:
  [ ] PagerDuty/OpsGenie account configured
  [ ] Can access all dashboards
  [ ] Can access all runbooks
  [ ] Can SSH/kubectl to production
  [ ] Has VPN access from home
  [ ] Phone notifications work (test page)
  [ ] Knows escalation path
  [ ] Has completed at least one incident simulation
```

## Exercises

1. **Toil audit**: Review your team's last 30 days of pages. Categorize each as: real incident, automatable toil, noisy alert, or misrouted. Calculate the percentage in each category and identify the top 3 automation opportunities.

2. **Rotation design**: Your team has 6 engineers across US-East and US-West time zones. Design an on-call rotation that ensures no one is on-call more than one week per month, includes primary and secondary roles, and has a clear handoff process.

3. **Handoff document**: Write a handoff document for your current team using the template above. Include at least: 2 active issues, 3 recent changes, 1 known risk, and tips for the incoming on-call.

4. **Automation plan**: Pick the most frequent page your team receives. Design an automation that eliminates it. Include: trigger condition, automated action, verification step, and fallback alert if automation fails.

5. **On-call health review**: Design a monthly on-call health review meeting. What metrics would you present? What questions would you ask? What actions would you take if pages per week exceeded 10?

---

[Next: Lesson 16 - Building Reliable Systems -->](16-building-reliable-systems.md)
