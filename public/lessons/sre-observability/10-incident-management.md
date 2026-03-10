# Lesson 10: Incident Management

## The Emergency Room

When a patient arrives at the ER, chaos does not help. There is a protocol: triage nurse assesses severity, a doctor takes charge, specialists are called as needed, and someone keeps the family informed. Everyone has a role, and there is a clear process.

Incident management is the ER protocol for your systems.

```
WITHOUT INCIDENT MANAGEMENT    WITH INCIDENT MANAGEMENT
+-------------------------+    +-------------------------+
| "The site is down!"     |    | IC: "SEV1 declared.     |
| "Who is looking at it?" |    |  I am Incident          |
| "I restarted something" |    |  Commander.              |
| "Wait, that made it     |    |  Alice: investigate DB.  |
|  worse"                 |    |  Bob: comms to status    |
| "Who told the customer?"|    |  page. Carol: standby    |
| 3 hours later...        |    |  for rollback."          |
|                         |    |  45 minutes later...     |
+-------------------------+    +-------------------------+
    Chaos                          Structured response
```

## Incident Lifecycle

```
+--------+     +---------+     +---------+     +----------+
|DETECT  | --> |RESPOND  | --> |RESOLVE  | --> | LEARN    |
|        |     |         |     |         |     |          |
|Alert   |     |Triage   |     |Mitigate |     |Postmortem|
|fires   |     |Assign   |     |Fix      |     |Action    |
|User    |     |roles    |     |Verify   |     |items     |
|reports |     |Comms    |     |Close    |     |Improve   |
+--------+     +---------+     +---------+     +----------+
   |                                                |
   +------- feedback loop (prevent next time) ------+
```

### Phase 1: Detection

```
HOW INCIDENTS ARE DETECTED:

  Automated (preferred):
    [Alert] --> PagerDuty --> On-call engineer

  Manual (still common):
    [Customer tweet] --> Support team --> Engineering
    [Status check] --> Dashboard --> Engineer notices

  MTTD = Mean Time to Detect
  Goal: Detect before customers notice
```

### Phase 2: Response

```
FIRST 5 MINUTES:

  1. Acknowledge the page
  2. Assess severity (SEV1/2/3)
  3. Open incident channel (#inc-YYYY-MM-DD-short-desc)
  4. Declare yourself Incident Commander (or hand off)
  5. Post initial assessment to channel

  "I am IC for this incident. Checkout is returning 500s
   for ~30% of requests. SEV1 declared. Starting investigation.
   Status page updated. Next update in 15 minutes."
```

## Severity Levels

```
+------+---------------------------+----------------------+
| SEV  | CRITERIA                  | RESPONSE             |
+------+---------------------------+----------------------+
| SEV1 | Complete service outage   | All hands.           |
|      | Revenue-impacting         | Page leadership.     |
|      | Data loss risk            | Status page update.  |
|      | Security breach           | 15-min update cycle. |
+------+---------------------------+----------------------+
| SEV2 | Major degradation         | On-call + backup.    |
|      | Significant user impact   | Status page update.  |
|      | SLO breach imminent       | 30-min update cycle. |
+------+---------------------------+----------------------+
| SEV3 | Minor degradation         | On-call handles.     |
|      | Small user impact         | Internal comms only.  |
|      | Workaround exists         | 1-hour update cycle. |
+------+---------------------------+----------------------+
| SEV4 | No user impact yet        | Business hours only. |
|      | Potential future issue    | Track in ticket.     |
|      | Cosmetic issue            |                      |
+------+---------------------------+----------------------+
```

## Incident Roles

```
+------------------------------------------------------------+
|                    INCIDENT ROLES                          |
+------------------------------------------------------------+
|                                                            |
|  INCIDENT COMMANDER (IC)                                   |
|  +------------------------------------------------------+ |
|  | - Owns the incident end-to-end                        | |
|  | - Delegates tasks, does NOT debug                     | |
|  | - Makes decisions (rollback? escalate?)               | |
|  | - Keeps everyone focused and unblocked                | |
|  +------------------------------------------------------+ |
|                                                            |
|  COMMUNICATIONS LEAD (COMMS)                               |
|  +------------------------------------------------------+ |
|  | - Updates status page                                 | |
|  | - Posts regular updates to incident channel           | |
|  | - Handles questions from stakeholders                 | |
|  | - Shields the IC from interruptions                   | |
|  +------------------------------------------------------+ |
|                                                            |
|  OPERATIONS LEAD (OPS)                                     |
|  +------------------------------------------------------+ |
|  | - Hands-on debugging and investigation                | |
|  | - Executes mitigation actions                         | |
|  | - Reports findings to IC                              | |
|  +------------------------------------------------------+ |
|                                                            |
|  SCRIBE                                                    |
|  +------------------------------------------------------+ |
|  | - Records timeline of events                          | |
|  | - Notes decisions and their rationale                 | |
|  | - Captures action items                               | |
|  | - Makes postmortem writing easier                     | |
|  +------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Why the IC Does Not Debug

```
BAD: IC debugging
  IC is heads-down in logs
       |
       v
  Nobody coordinating --> People duplicate work
  Nobody deciding     --> Rollback delayed 20 min
  Nobody communicating --> Stakeholders panicking

GOOD: IC coordinating
  IC: "Alice, check the DB logs for the last 10 minutes"
  IC: "Bob, update status page: investigating checkout errors"
  IC: "Carol, prepare a rollback to version 2.3.1"
  IC: "Alice, what did you find?"
  Alice: "Connection pool exhausted"
  IC: "Carol, execute the rollback. Bob, update: mitigating."
```

## The War Room

For SEV1 incidents, create a focused space:

```
VIRTUAL WAR ROOM SETUP

  #inc-2025-03-15-checkout-outage (Slack/Teams)
  |
  +-- Pinned: Incident summary, severity, IC name
  +-- Pinned: Status page link
  +-- Pinned: Relevant dashboards
  +-- Pinned: Timeline doc
  |
  Video call link for voice coordination
  |
  RULES:
    - Only incident-related messages
    - Use threads for side discussions
    - IC makes final decisions
    - Update every 15 minutes (even if no change)
```

## Communication Templates

### Internal Status Update

```
INCIDENT UPDATE - [TIME]
Status: INVESTIGATING / IDENTIFIED / MITIGATING / RESOLVED
Severity: SEV1
IC: Alice
Duration: 35 minutes

CURRENT STATE:
Checkout service returning 500 errors for ~30% of requests.

WHAT WE KNOW:
- DB connection pool exhausted on primary
- Started after deploy of v2.4.0 at 14:15 UTC

ACTIONS IN PROGRESS:
- Rolling back to v2.3.1 (ETA: 5 minutes)
- DB team scaling connection pool

NEXT UPDATE: 15:00 UTC
```

### External Status Page Update

```
[15:00 UTC] Investigating - We are investigating increased
error rates on our checkout system. Some customers may
experience failures when completing purchases. Our team
is actively working on a fix.

[15:20 UTC] Identified - We have identified the cause
as a database configuration issue. A fix is being deployed.

[15:35 UTC] Monitoring - A fix has been deployed. We are
monitoring to confirm the issue is resolved.

[16:00 UTC] Resolved - The issue has been resolved. All
systems are operating normally. We apologize for the
inconvenience.
```

## Incident Timeline

```
TIME (UTC)  EVENT
---------   -----
14:15       Deploy v2.4.0 to production
14:28       Monitoring alert: error rate > 1% on checkout
14:30       On-call acknowledges page
14:32       SEV1 declared, IC: Alice, channel created
14:35       Status page updated: Investigating
14:38       Ops lead identifies DB connection pool exhaustion
14:40       IC decides: rollback to v2.3.1
14:42       Rollback initiated
14:45       Status page updated: Fix deploying
14:48       Rollback complete, error rate dropping
14:55       Error rate back to baseline (0.02%)
15:00       Status page updated: Monitoring
15:30       SEV1 resolved, monitoring stable
15:35       Status page updated: Resolved
            Total duration: 67 minutes
            Time to detect: 13 minutes
            Time to mitigate: 20 minutes (from declaration)
```

## Incident Metrics

```
+--MTTD--+--MTTA--+-------MTTR-------+
|        |        |                   |
v        v        v                   v
DETECT   ACK      MITIGATE           RESOLVE
|--------|--------|---------|---------|
t=0      t=2m     t=5m      t=20m    t=67m

MTTD: Mean Time to Detect (when you find out)
MTTA: Mean Time to Acknowledge (when someone responds)
MTTM: Mean Time to Mitigate (when bleeding stops)
MTTR: Mean Time to Resolve (when fully fixed)

Track these over time. They should trend DOWN.
```

## Exercises

1. **Incident simulation**: Walk through this scenario as IC: Your payment service is returning 503 errors. You have three engineers available. Write out your first 10 minutes of commands, delegations, and communications.

2. **Severity assessment**: Classify each scenario as SEV1-4:
   - Marketing website CSS is broken on mobile
   - Login system is down for all users
   - Search results are 10 seconds slow
   - A background batch job failed to run overnight
   - Customer PII was exposed in a public log

3. **Communication practice**: Write status page updates for a 45-minute SEV2 incident where your API returns stale data due to a cache that failed to invalidate. Write updates at the 0, 15, 30, and 45 minute marks.

4. **War room design**: Create a checklist for setting up a virtual war room. Include: channels, roles, pinned information, escalation contacts, and communication cadence.

5. **Metrics tracking**: Design a spreadsheet or dashboard that tracks MTTD, MTTA, MTTM, and MTTR for your team's incidents over the past quarter. What trends would you look for?

---

[Next: Lesson 11 - Postmortems -->](11-postmortems.md)
