# Lesson 01: What is SRE?

## The Building Maintenance Crew

Think of a large office building. The architects designed it, the construction crew built it, and now tenants move in. But who keeps the elevators running, the HVAC humming, and the fire systems tested?

That is the **building maintenance crew**. They do not just react when the pipes burst. They run preventive checks, replace parts before they fail, and have emergency plans for when things go wrong. They also tell the architects, "If you design the plumbing this way, it will be a nightmare to maintain."

**Site Reliability Engineering (SRE) is the maintenance crew for software systems.**

```
  TRADITIONAL OPS              SRE
  +--------------+          +--------------+
  | Manual work  |          | Automate it  |
  | React to     |          | Prevent      |
  |   failures   |          |   failures   |
  | Ticket-based |          | Engineering- |
  |   requests   |          |   driven     |
  | "Keep it     |          | "Make it     |
  |   running"   |          |   reliable"  |
  +--------------+          +--------------+
         |                        |
         v                        v
    Burnout &               Sustainable &
    firefighting            scalable ops
```

## Google's SRE Model

Google coined the term in 2003 when Ben Treynor Sloss was asked to run a production team. His approach: **treat operations as a software engineering problem**.

Core principles:

1. **SREs are software engineers** who happen to work on reliability
2. **Toil has a cap** - no more than 50% of time on operational work
3. **Error budgets** govern the balance between reliability and velocity
4. **Monitoring is not optional** - you cannot improve what you cannot measure
5. **Automation over manual intervention** - if you do it twice, automate it

```
THE SRE EQUATION
+-------------------------------------------+
|                                           |
|  SRE = Software Engineering + Operations  |
|                                           |
|  Focus: Reliability at scale              |
|  Method: Engineering, not heroics         |
|  Goal: Sustainable, measurable systems    |
|                                           |
+-------------------------------------------+
```

## SRE vs DevOps

DevOps and SRE are not competitors. Think of DevOps as the philosophy and SRE as one concrete implementation of that philosophy.

```
+-------------------------------------------------+
|                  DevOps                          |
|  (Culture, practices, movement)                 |
|                                                 |
|   "Break down silos between Dev and Ops"        |
|                                                 |
|  +-------------------------------------------+  |
|  |              SRE                           |  |
|  |  (Specific role, practices, metrics)       |  |
|  |                                            |  |
|  |  "Here is HOW we break down those silos,   |  |
|  |   with error budgets, SLOs, and toil       |  |
|  |   tracking"                                |  |
|  +-------------------------------------------+  |
+-------------------------------------------------+
```

| Aspect | DevOps | SRE |
|--------|--------|-----|
| Origin | Community movement | Google |
| Focus | Collaboration and flow | Reliability and engineering |
| Failure handling | "Fail fast, learn" | "Error budgets decide" |
| Toil | Reduce via CI/CD | Cap at 50%, measure it |
| Metrics | Deployment frequency, lead time | SLIs, SLOs, error budgets |

## The 50% Rule

An SRE team should spend no more than 50% of their time on toil (repetitive, manual, automatable work). The other 50% goes to engineering projects that improve reliability.

```
SRE TIME ALLOCATION
+========================+
|                        |
|  [######### 50% ######]  <-- Engineering projects
|  [######### 50% ######]  <-- Operational work (toil)
|                        |
+========================+

IF TOIL EXCEEDS 50%:
+========================+
|                        |
|  [#### 30% ###########]  <-- Engineering (shrinking!)
|  [############## 70% #]  <-- Toil (growing!)
|                        |
+========================+
  ^-- This means the team is underwater.
      Escalate. Redirect dev teams to fix root causes.
```

When toil exceeds 50%, the team is drowning. The fix is not more people; it is pushing back to development teams to fix the systems generating toil.

## What SREs Actually Do

A week in the life of an SRE:

```
MONDAY    - On-call handoff, review weekend incidents
TUESDAY   - Build automation to replace manual deploy step
WEDNESDAY - Capacity review meeting, resize cluster
THURSDAY  - Write postmortem for Tuesday's outage
FRIDAY    - Chaos testing in staging, update runbooks
```

Day-to-day responsibilities:

- Define and track SLIs/SLOs
- Build monitoring and alerting
- Respond to and manage incidents
- Write postmortems and drive action items
- Automate toil away
- Capacity planning and performance tuning
- Consult on architecture for reliability

## Error Budgets (Preview)

The most powerful SRE concept is the **error budget**. If your SLO says 99.9% availability, you have a 0.1% budget for failure. That 0.1% is not waste; it is fuel for innovation.

```
100% availability
  |
  |  <-- 0.1% error budget
  |      (43 minutes/month of allowed downtime)
  |
99.9% SLO target
  |
  |  ABOVE THE LINE = Room to ship fast
  |  BELOW THE LINE = Freeze releases, fix reliability
  |
  0%
```

We will cover error budgets in depth in Lesson 03.

## Why Not Just Hire More Ops People?

Because operations work grows linearly with system size, but engineering solutions scale:

```
WORKLOAD vs TEAM SIZE

Manual Ops:             SRE Approach:
Work |    /             Work |      ___
     |   /                   |    /
     |  /                    |   /
     | /                     |  /
     |/______                | /______
      Team Size               Team Size

Linear growth =          Sublinear growth =
unsustainable            sustainable
```

## Key Vocabulary

| Term | Definition |
|------|-----------|
| **SRE** | Software engineer focused on reliability |
| **Toil** | Manual, repetitive, automatable operational work |
| **Error Budget** | Allowed amount of unreliability over a time window |
| **SLI** | Service Level Indicator - a measurement of service behavior |
| **SLO** | Service Level Objective - a target for an SLI |
| **Postmortem** | Written analysis of an incident, focused on learning |

## Exercises

1. **Identify toil**: List five repetitive tasks in your current workflow. Which could be automated? Estimate how many hours per week they consume.

2. **SRE vs Ops audit**: Look at your team's last month of work. What percentage was reactive (responding to issues) vs proactive (building systems to prevent issues)?

3. **Thought experiment**: Your team spends 80% of time on manual deployments and firefighting. Using the SRE model, write a one-paragraph proposal to leadership explaining why you need to invest in automation.

4. **Role design**: Draft a job description for an SRE at your company. What skills would you require? What would the first 90 days look like?

---

[Next: Lesson 02 - SLIs, SLOs, and SLAs -->](02-slis-slos-slas.md)
