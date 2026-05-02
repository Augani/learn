# Lesson 11: Postmortems

## Airline Crash Investigations

When a plane crashes, the investigation does not blame the pilot and move on. Investigators ask: Why did the instruments not warn them? Why did the training not cover this scenario? Why did the design allow this failure mode?

This approach has made aviation the safest form of travel. The same principle applies to software: **blame fixes nothing; systems thinking fixes everything**.

```
BLAME CULTURE                  BLAMELESS CULTURE
+-------------------------+    +-------------------------+
| "Who broke production?" |    | "What allowed this to   |
| "John deployed without  |    |  happen?"               |
|  testing"               |    | "The deploy pipeline    |
| "John gets a warning"   |    |  lacked integration     |
|                         |    |  tests. Anyone could    |
| RESULT:                 |    |  have deployed this."   |
| People hide mistakes    |    |                         |
| Same bugs recur         |    | RESULT:                 |
| Culture of fear         |    | People report honestly  |
+-------------------------+    | Root causes get fixed   |
                               | System improves         |
                               +-------------------------+
```

## What Is a Postmortem?

A postmortem is a written document created after an incident. Its purpose:

1. Record what happened (so institutional knowledge is preserved)
2. Identify root causes (not just symptoms)
3. Define action items (concrete improvements)
4. Share learnings (so other teams benefit)

```
POSTMORTEM IS NOT:
  - A blame document
  - A punishment mechanism
  - A formality to file and forget
  - A novel (keep it focused)

POSTMORTEM IS:
  - A learning tool
  - A system improvement driver
  - A record for future engineers
  - A way to build resilience
```

## When to Write a Postmortem

```
ALWAYS write one when:
  [x] SEV1 or SEV2 incident
  [x] Data loss occurred
  [x] Customer-facing impact lasted > 15 minutes
  [x] On-call was paged outside business hours
  [x] A novel failure mode was discovered
  [x] The incident required heroics to resolve

CONSIDER writing one when:
  [ ] Near-miss that could have been worse
  [ ] SEV3 that reveals systemic risk
  [ ] Interesting debugging journey worth documenting
```

## Postmortem Template

```
+============================================================+
|                      POSTMORTEM                            |
+============================================================+

TITLE: Checkout Service Outage Due to DB Connection Pool
DATE: 2025-03-15
SEVERITY: SEV1
DURATION: 67 minutes (14:28 - 15:35 UTC)
AUTHORS: Alice (IC), Bob (Ops Lead)
STATUS: Action items in progress

+------------------------------------------------------------+
| SUMMARY                                                    |
+------------------------------------------------------------+
2-3 sentences describing what happened and the impact.

"On March 15, the checkout service experienced a 67-minute
outage affecting approximately 30% of checkout requests.
The root cause was an unbounded connection pool in a new
code path introduced in v2.4.0. Estimated revenue impact:
$45,000."

+------------------------------------------------------------+
| IMPACT                                                     |
+------------------------------------------------------------+
- Duration: 67 minutes
- User impact: ~30% of checkout requests failed (HTTP 500)
- Revenue impact: ~$45,000 in lost transactions
- SLO impact: Error budget consumed 38 of remaining 40 min
- Support tickets: 127 customer complaints

+------------------------------------------------------------+
| TIMELINE                                                   |
+------------------------------------------------------------+
(See Lesson 10 for the detailed timeline format)

14:15 - Deploy v2.4.0
14:28 - Alert fires
14:32 - SEV1 declared
14:40 - Root cause identified
14:48 - Rollback complete
15:35 - Incident resolved

+------------------------------------------------------------+
| ROOT CAUSES                                                |
+------------------------------------------------------------+
(Multiple contributing factors, not just one)

1. New code path in v2.4.0 opened a new DB connection for
   each retry attempt without closing the previous one.

2. Integration tests did not cover the retry path under
   load.

3. The connection pool had no upper bound configured.

4. The canary deployment only ran for 5 minutes with
   synthetic traffic, missing the connection leak that
   manifests under real load patterns.

+------------------------------------------------------------+
| WHAT WENT WELL                                             |
+------------------------------------------------------------+
- Alert fired within 13 minutes of the deploy
- IC declared SEV1 quickly and assigned roles
- Rollback was smooth and completed in 8 minutes
- Status page was updated within 7 minutes

+------------------------------------------------------------+
| WHAT WENT POORLY                                           |
+------------------------------------------------------------+
- Canary period was too short to catch this
- No alert on DB connection count
- Rollback playbook was slightly outdated
- Internal communication took too long to reach support team

+------------------------------------------------------------+
| WHERE WE GOT LUCKY                                         |
+------------------------------------------------------------+
- The leak was fast enough to trigger alerts before
  exhausting the entire cluster
- An engineer who wrote the original connection code
  happened to be online and identified the issue quickly

+------------------------------------------------------------+
| ACTION ITEMS                                               |
+------------------------------------------------------------+
(Each has an owner and due date)

| # | Action                          | Owner | Due    | Status |
|---|---------------------------------|-------|--------|--------|
| 1 | Add connection pool limit       | Alice | Mar 18 | Done   |
| 2 | Add DB connection count alert   | Bob   | Mar 20 | Open   |
| 3 | Extend canary to 30 min minimum | Carol | Mar 22 | Open   |
| 4 | Add load test for retry paths   | Dave  | Mar 25 | Open   |
| 5 | Update rollback playbook        | Alice | Mar 18 | Done   |
| 6 | Add support team to SEV1 notif  | Eve   | Mar 19 | Open   |

+============================================================+
```

## The Five Whys

A technique for digging past symptoms to root causes:

```
WHY #1: Why did checkout fail?
  --> DB connection pool was exhausted.

WHY #2: Why was the connection pool exhausted?
  --> New code opened connections without closing them.

WHY #3: Why did the code not close connections?
  --> The retry logic created new connections in a loop.

WHY #4: Why was this not caught in testing?
  --> Integration tests did not simulate retries under load.

WHY #5: Why did the canary not catch it?
  --> Canary ran for 5 minutes with low synthetic traffic,
      not long enough for the leak to manifest.

ROOT CAUSES (not just one!):
  - Missing connection cleanup in retry path (code bug)
  - Insufficient test coverage (process gap)
  - Inadequate canary configuration (deployment gap)
```

```
WARNING: Five Whys can lead to "blame the human" if misused

BAD FIVE WHYS:
  Why? --> Engineer wrote buggy code
  Why? --> Engineer did not test enough
  Why? --> Engineer was careless
  (This is blame, not systems thinking)

GOOD FIVE WHYS:
  Why? --> The system allowed buggy code to reach production
  Why? --> No automated check for connection leaks
  Why? --> We have no static analysis for resource management
  (This focuses on SYSTEM improvements)
```

## Writing Effectively

```
BAD POSTMORTEM LANGUAGE          GOOD POSTMORTEM LANGUAGE
+----------------------------+   +----------------------------+
| "John failed to test       |   | "The deploy pipeline did   |
|  his code properly"        |   |  not include integration   |
|                            |   |  tests for this code path" |
+----------------------------+   +----------------------------+
| "The team should have      |   | "The monitoring gap meant  |
|  known better"             |   |  the connection leak was   |
|                            |   |  not detected"             |
+----------------------------+   +----------------------------+
| "Operator error caused     |   | "The runbook did not cover |
|  the outage"               |   |  this scenario, leading to |
|                            |   |  a longer resolution time" |
+----------------------------+   +----------------------------+
```

## Tracking Action Items

Action items are the whole point. If they do not get done, the postmortem was wasted.

```
ACTION ITEM LIFECYCLE

  Written in postmortem
       |
       v
  Converted to tickets (Jira/Linear/GitHub Issues)
       |
       v
  Assigned to owners with due dates
       |
       v
  Tracked in weekly SRE review
       |
       v
  Completed and verified
       |
       v
  Postmortem status updated to "Action items complete"


COMMON FAILURE MODES:
  - Action items stay in the doc, never become tickets
  - No owner assigned ("the team" is not an owner)
  - No due date ("eventually" means never)
  - No follow-up process
```

## Postmortem Review Meeting

```
MEETING FORMAT (45-60 minutes)

  1. READING (10 min)
     Everyone reads the postmortem silently.
     (Not everyone will have read it beforehand)

  2. TIMELINE WALKTHROUGH (10 min)
     Author walks through the timeline.
     Participants ask clarifying questions.

  3. ROOT CAUSE DISCUSSION (15 min)
     "Are we confident in the root causes?"
     "Are we missing any contributing factors?"

  4. ACTION ITEMS REVIEW (10 min)
     "Are these the right fixes?"
     "Are we missing any action items?"
     "Are the priorities and deadlines realistic?"

  5. BROADER LEARNINGS (5 min)
     "Does this apply to other services?"
     "Should we share this more broadly?"

RULES:
  - No blame, no finger-pointing
  - Focus on systems, not people
  - Everyone's perspective is valued
  - The goal is learning, not punishment
```

## Measuring Postmortem Effectiveness

```
METRICS TO TRACK:

  Action item completion rate
    Target: > 90% completed on time

  Repeat incidents
    "Did the same failure mode recur?"
    Target: < 5% repeat rate

  Time from incident to postmortem published
    Target: < 5 business days

  Postmortem coverage
    "What % of SEV1/2 incidents have postmortems?"
    Target: 100%

  TRENDING:
  +--Q1--+--Q2--+--Q3--+--Q4--+
  |  60% |  75% |  88% |  94% |  Action item completion
  |  15% |  10% |   5% |   3% |  Repeat incident rate
  +------+------+------+------+
        Getting better over time
```

## Exercises

1. **Write a postmortem**: Using the template above, write a postmortem for this scenario: A DNS change propagation took 4 hours instead of the expected 5 minutes, causing a 2-hour partial outage of your API for users in Europe.

2. **Five Whys practice**: Apply the Five Whys to this incident: "A customer received another customer's order confirmation email." Find at least two distinct root cause chains.

3. **Action item audit**: Review the last 5 postmortems your team wrote (or use hypothetical ones). Check: Does each action item have an owner? A due date? A ticket? What is the completion rate?

4. **Language review**: Rewrite these blame-oriented statements as systems-focused statements:
   - "The junior developer deployed without approval"
   - "Operations failed to monitor the service properly"
   - "Nobody bothered to update the documentation"

5. **Process design**: Design a postmortem process for your team. Include: trigger criteria, template, review meeting format, action item tracking, and follow-up schedule.

---

[Next: Lesson 12 - Chaos Engineering -->](12-chaos-engineering.md)
