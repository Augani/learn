# Lesson 11: Platform Team Dynamics

## The City Planning Analogy

A city planner doesn't build every building. They create zoning laws, design
road networks, plan utilities, and ensure buildings have fire escapes. They
work with construction companies (product teams) who build the actual
structures.

A bad city planner dictates everything — mandatory building colors, required
furniture, approved carpet patterns. Builders hate them and find loopholes.

A good city planner provides infrastructure that makes building easy, safety
standards that prevent disasters, and flexibility for builders to create
what their customers need.

Platform teams are city planners for your engineering organization.

```
  CITY PLANNING / PLATFORM ENGINEERING PARALLELS:

  City Planning              Platform Engineering
  +---------------------+   +-------------------------+
  | Roads & highways     |   | CI/CD pipelines         |
  | Water & electricity  |   | Databases & caches      |
  | Building codes       |   | Security standards      |
  | Zoning laws          |   | Golden paths            |
  | Fire stations        |   | Observability & on-call |
  | Public transit       |   | Developer portal        |
  | Permits office       |   | Self-service infra      |
  +---------------------+   +-------------------------+
  | City planner does NOT|   | Platform team does NOT  |
  | build houses         |   | build features          |
  | choose furniture     |   | choose frameworks       |
  | pick paint colors    |   | write business logic    |
  +---------------------+   +-------------------------+
```

## Team Topologies

Team Topologies, by Matthew Skelton and Manuel Pais, provides the
foundational model for how platform teams should be organized and how they
interact with other teams. If you read one book on this topic, make it
Team Topologies.

The model defines four team types:

```
  TEAM TOPOLOGY TYPES:

  +------------------------------------------------------------------+
  |                                                                  |
  |  STREAM-ALIGNED TEAMS (most teams)                               |
  |  +---------------------------+                                   |
  |  | Aligned to a flow of work |   Payments team, Search team,    |
  |  | (feature, product, user   |   Checkout team, Mobile team     |
  |  |  journey)                  |                                   |
  |  | They build and run their  |   These are your customers.      |
  |  | own services              |                                   |
  |  +---------------------------+                                   |
  |                                                                  |
  |  PLATFORM TEAMS (you)                                            |
  |  +---------------------------+                                   |
  |  | Provide self-service      |   Build capabilities that        |
  |  | capabilities that reduce  |   stream-aligned teams consume.  |
  |  | cognitive load on stream- |   Your "product" is the          |
  |  | aligned teams             |   platform itself.               |
  |  +---------------------------+                                   |
  |                                                                  |
  |  ENABLING TEAMS                                                  |
  |  +---------------------------+                                   |
  |  | Help stream-aligned teams |   SRE coaches, security          |
  |  | adopt new capabilities    |   champions, architecture guild  |
  |  | Temporary engagement,     |                                   |
  |  | not permanent dependency  |                                   |
  |  +---------------------------+                                   |
  |                                                                  |
  |  COMPLICATED SUBSYSTEM TEAMS                                     |
  |  +---------------------------+                                   |
  |  | Own components requiring  |   ML platform, real-time         |
  |  | deep specialist knowledge |   streaming engine, compiler     |
  |  +---------------------------+                                   |
  |                                                                  |
  +------------------------------------------------------------------+
```

## Interaction Modes

How a platform team interacts with stream-aligned teams is as important as
what they build. Team Topologies defines three interaction modes:

```
  INTERACTION MODES:

  1. X-AS-A-SERVICE (most common for mature platforms)
  +-------------------+           +-------------------+
  | Stream-aligned    |  consumes | Platform          |
  | team              |---------->| team              |
  |                   |  via API  |                   |
  | Uses self-service |           | Provides tools,   |
  | capabilities      |           | APIs, templates   |
  +-------------------+           +-------------------+

  2. COLLABORATION (for new capabilities)
  +-------------------+           +-------------------+
  | Stream-aligned    |<--------->| Platform          |
  | team              | work      | team              |
  |                   | together  |                   |
  | Provides feedback,|           | Builds capability |
  | co-designs        |           | with team input   |
  +-------------------+           +-------------------+

  3. FACILITATING (for adoption)
  +-------------------+           +-------------------+
  | Stream-aligned    |  guided   | Platform          |
  | team              |<--------- | team              |
  |                   |  by       |                   |
  | Learns to use     |           | Teaches, coaches, |
  | new capabilities  |           | unblocks          |
  +-------------------+           +-------------------+
```

### When to Use Each Mode

**X-as-a-Service** is the steady state. The platform team publishes
capabilities (CI/CD templates, database provisioning, observability stack).
Stream-aligned teams consume them through well-defined interfaces. Low
interaction overhead, high scalability.

**Collaboration** is for building new capabilities. When you're building
self-service database provisioning, you work closely with two or three
stream-aligned teams. They tell you what they need, you prototype together,
they give feedback. This is intense but temporary — usually 4-8 weeks.

**Facilitating** is for adoption. When you launch a new capability, some
teams need help adopting it. You pair with them, help them migrate, answer
questions. Again, temporary — the goal is self-sufficiency.

```
  INTERACTION MODE LIFECYCLE:

  Time ──────────────────────────────────────────>

  New Capability:
  [Collaboration] ──> [Facilitating] ──> [X-as-a-Service]
   (build together)   (help adopt)       (self-service)
   4-8 weeks           2-4 weeks         ongoing

  Example: Database self-service
  Week 1-6:  Collaborate with payments & orders teams
             to design the database CRD and CLI
  Week 7-10: Facilitate adoption for 5 more teams,
             pair on migrations
  Week 11+:  X-as-a-Service — teams provision databases
             independently
```

## Product Management for Platforms

A platform without product management is a team building features nobody
asked for. You need someone (not necessarily a full-time PM) who owns:

**Discovery.** What do developers need? Not what they say they need — what
they actually need. Watch them work. Measure their pain points. Track
support tickets.

**Prioritization.** You can't build everything. Prioritize by developer
impact, not technical elegance.

**Roadmap communication.** Developers need to know what's coming. A
public roadmap builds trust and reduces "build it ourselves" decisions.

**Feedback loops.** Close the loop on requests. "We heard you, it's
planned for Q3" or "We considered this but decided against it because..."

```
  PLATFORM PRODUCT MANAGEMENT CYCLE:

  +----------+     +-----------+     +-----------+     +---------+
  | Discover |---->| Prioritize|---->| Build     |---->| Measure |
  |          |     |           |     |           |     |         |
  | Surveys  |     | Impact vs |     | Collab-   |     | Adoption|
  | Tickets  |     | effort    |     | orate     |     | NPS     |
  | Observe  |     | matrix    |     | with 2-3  |     | DORA    |
  | User     |     |           |     | teams     |     | Surveys |
  | research |     | Roadmap   |     |           |     |         |
  +----------+     +-----------+     +-----------+     +---------+
       ^                                                     |
       |                                                     |
       +-----------------------------------------------------+
```

### Prioritization Framework

```
  IMPACT vs EFFORT MATRIX:

                    HIGH EFFORT
                    |
            +-------+-------+
            | MAYBE | YES!  |
            | (plan | (high |
            | for   | impact|
            | later)| worth |
            |       | it)   |
  LOW  -----+-------+-------+----- HIGH
  IMPACT    | NO    | QUICK |     IMPACT
            | (don't| WIN   |
            | do)   | (do   |
            |       | now)  |
            +-------+-------+
                    |
                    LOW EFFORT

  Example classifications:
  QUICK WIN:  "Add JSON output to CLI" (2 days, all teams benefit)
  YES:        "Self-service database provisioning" (2 months, huge impact)
  MAYBE:      "Multi-cloud support" (6 months, 3 teams need it)
  NO:         "Custom dashboard builder" (3 months, one team asked)
```

### Platform Roadmap Communication

```yaml
platform_roadmap:
  last_updated: "2025-01-15"
  published_at: "https://backstage.internal/platform-roadmap"

  now:
    theme: "Self-service everything"
    items:
      - title: "Self-service Kafka topics"
        status: in_progress
        eta: "Feb 2025"
        teams_requesting: ["analytics", "notifications", "billing"]
      - title: "Pipeline template v4 (SBOM, cosign)"
        status: in_progress
        eta: "Jan 2025"

  next:
    theme: "Observable by default"
    items:
      - title: "Auto-generated SLO dashboards"
        status: planned
        eta: "Q2 2025"
      - title: "Continuous profiling with Pyroscope"
        status: planned
        eta: "Q2 2025"

  later:
    theme: "Developer self-service nirvana"
    items:
      - title: "One-click production environment cloning"
        status: exploring
      - title: "AI-assisted incident response"
        status: exploring

  not_doing:
    items:
      - title: "Multi-cloud abstraction"
        reason: "95% of workloads on AWS. Complexity not justified."
      - title: "Custom build system"
        reason: "GitHub Actions meets our needs. Building our own adds burden."
```

The "not doing" section is as important as the "doing" section. It shows
you've considered requests and made deliberate choices.

## Stakeholder Management

Platform teams serve multiple stakeholders with different needs:

```
  STAKEHOLDER MAP:

  +------------------------------------------------------------------+
  |                                                                  |
  |  DEVELOPERS (primary customers)                                  |
  |  Need: Easy self-service, fast feedback, good docs              |
  |  Channel: Slack, office hours, surveys                           |
  |                                                                  |
  |  ENGINEERING MANAGERS                                            |
  |  Need: Team productivity data, adoption metrics                  |
  |  Channel: Monthly reports, team dashboards                       |
  |                                                                  |
  |  VP OF ENGINEERING / CTO                                         |
  |  Need: ROI, delivery metrics, strategic alignment               |
  |  Channel: Quarterly reviews, executive summaries                 |
  |                                                                  |
  |  SECURITY TEAM                                                   |
  |  Need: Compliance, policy enforcement, audit trails             |
  |  Channel: Policy reviews, shared standards                       |
  |                                                                  |
  |  FINANCE                                                         |
  |  Need: Cost attribution, cloud spend optimization               |
  |  Channel: Monthly cost reports, budget planning                  |
  |                                                                  |
  +------------------------------------------------------------------+
```

### Communication Cadence

```yaml
communication_cadence:
  weekly:
    - channel: "#platform-updates (Slack)"
      content: "What shipped this week, what's in progress"
      owner: "rotating team member"

    - channel: "Platform office hours"
      content: "30-min open Q&A, demos of new features"
      owner: "rotating team member"

  monthly:
    - channel: "Engineering newsletter"
      content: "Platform highlights, adoption metrics, tips"
      owner: "platform PM"

    - channel: "Engineering all-hands"
      content: "3-minute platform update, demo of headline feature"
      owner: "platform lead"

  quarterly:
    - channel: "Developer experience survey"
      content: "Quantitative + qualitative feedback"
      owner: "platform PM"

    - channel: "Executive review"
      content: "DORA metrics, NPS, ROI, roadmap"
      owner: "platform lead"

    - channel: "Platform retrospective"
      content: "What worked, what didn't, what to change"
      owner: "entire platform team"
```

## Team Structure

How you organize the platform team depends on your organization's size and
the platform's scope.

### Small Organization (3-5 platform engineers)

```
  SMALL PLATFORM TEAM:

  +------------------------------------------+
  | Platform Team (3-5 people)               |
  |                                          |
  | Everyone does a bit of everything:       |
  | - CI/CD templates                        |
  | - Infrastructure automation              |
  | - Observability                          |
  | - Developer portal                       |
  | - Support & documentation                |
  |                                          |
  | Key: Prioritize ruthlessly.              |
  | You can't build everything.              |
  +------------------------------------------+
```

### Medium Organization (6-12 platform engineers)

```
  MEDIUM PLATFORM TEAM:

  +--------------------------------------------------+
  | Platform Team Lead / PM                          |
  +--------------------------------------------------+
       |              |               |
  +---------+   +-----------+   +-----------+
  | Build & |   | Infra &   |   | Developer |
  | Deploy  |   | Runtime   |   | Experience|
  | (3 eng) |   | (3 eng)   |   | (2 eng)   |
  +---------+   +-----------+   +-----------+
  | CI/CD    |   | Crossplane |   | Backstage |
  | Pipeline |   | Databases  |   | Docs      |
  | templates|   | Secrets    |   | CLI tools |
  | GitOps   |   | Observ.    |   | Templates |
  +---------+   +-----------+   +-----------+
```

### Large Organization (12+ platform engineers)

```
  LARGE PLATFORM ORGANIZATION:

  +----------------------------------------------------------+
  | Head of Platform Engineering                             |
  +----------------------------------------------------------+
       |           |           |           |           |
  +--------+ +--------+ +--------+ +--------+ +--------+
  | Build  | | Infra  | | Observe| | Portal | | Enablem|
  | (4 eng)| | (4 eng)| | (3 eng)| | (3 eng)| | (2 eng)|
  +--------+ +--------+ +--------+ +--------+ +--------+
  | CI/CD  | | K8s    | | Metrics| | Backstage| Help   |
  | Builds | | DBaaS  | | Traces | | Catalog | teams  |
  | Supply | | Secrets| | Logs   | | Templates adopt  |
  | chain  | | IaC    | | Alerts | | API docs| new    |
  +--------+ +--------+ +--------+ +--------+ capabi- |
                                              | lities |
                                              +--------+
```

## Common Anti-Patterns

### The Ticket Queue Anti-Pattern

```
  ANTI-PATTERN: Platform team becomes a ticket queue

  Developer -> Jira ticket -> Platform team -> 3-day wait -> Done

  WHY IT HAPPENS:
  - Platform can't scale with demand
  - Not enough self-service capabilities
  - Team confused about build vs operate

  FIX:
  - Every ticket is a signal that self-service is missing
  - Track ticket categories: top 3 become self-service projects
  - Goal: reduce tickets to zero for standard operations
```

### The Ivory Tower Anti-Pattern

```
  ANTI-PATTERN: Platform team builds in isolation

  Platform team: "We built this amazing thing!"
  Developers: "We don't need that. We need X."
  Platform team: "But this is technically superior!"
  Developers: *ignore it, build their own*

  WHY IT HAPPENS:
  - No product management
  - No developer research
  - Tech-driven instead of outcome-driven

  FIX:
  - Mandatory collaboration phase for new capabilities
  - Regular developer surveys and interviews
  - Adoption metrics as success criteria (not ship date)
```

### The Mandate Anti-Pattern

```
  ANTI-PATTERN: Forcing adoption through policy

  "All teams MUST use the platform pipeline by March 1st"

  WHY IT HAPPENS:
  - Platform adoption is slow
  - Leadership pressure for "standardization"
  - Easier to mandate than to earn adoption

  FIX:
  - Make the platform so good that teams choose it
  - If adoption is low, the platform isn't solving real problems
  - Exception: security-critical requirements (mandatory is ok)
```

### The Everything Platform Anti-Pattern

```
  ANTI-PATTERN: Trying to platform everything

  "We'll abstract all of AWS/GCP/K8s behind our platform!"

  WHY IT HAPPENS:
  - Ambition outpaces capacity
  - Not enough prioritization
  - Trying to serve every use case

  FIX:
  - Start with the most common, most painful use cases
  - 80/20 rule: serve 80% of cases, provide escape hatches for 20%
  - Say no more often
```

## Scaling the Platform Team

As your platform grows, you'll face scaling challenges:

```
  SCALING SIGNALS:

  Time to respond to questions > 1 day?     -> Need more enablement
  Ticket queue growing every sprint?        -> Need more self-service
  Platform reliability incidents increasing? -> Need more SRE focus
  New teams onboarding slowly?              -> Need better docs/templates
  Support concentrated in 1-2 people?       -> Need knowledge sharing
```

### On-Call for the Platform

Your platform is production infrastructure. Treat it accordingly:

```yaml
platform_oncall:
  rotation: weekly
  team_size_minimum: 4
  escalation:
    - level: 1
      who: "on-call platform engineer"
      response_time: "15 minutes"
      scope: "CI/CD, portal, infra provisioning"
    - level: 2
      who: "platform team lead"
      response_time: "30 minutes"
      scope: "data loss, security breach, total platform outage"

  runbooks:
    - name: "CI/CD pipeline outage"
      url: "https://runbooks.internal/platform/cicd-outage"
    - name: "Vault unavailable"
      url: "https://runbooks.internal/platform/vault-outage"
    - name: "Backstage down"
      url: "https://runbooks.internal/platform/backstage-outage"

  slos:
    - service: "CI/CD"
      availability: "99.9%"
    - service: "Vault"
      availability: "99.99%"
    - service: "Developer Portal"
      availability: "99.9%"
```

## Exercises

1. **Team topology mapping.** Map your organization's current team structure
   to the Team Topologies model. Identify: Which teams are stream-aligned?
   Is there a platform team? Are there enabling teams? Where are the gaps?

2. **Interaction mode audit.** For each capability your platform provides,
   identify the current interaction mode (X-as-a-Service, collaboration,
   or facilitating). Are any stuck in collaboration when they should be
   X-as-a-Service?

3. **Stakeholder communication plan.** Design a communication cadence for
   your platform team. Who gets what information, how often, through what
   channel? Include developers, managers, and executives.

4. **Anti-pattern identification.** Which anti-patterns from this lesson
   does your platform team currently exhibit? For each one, design a
   specific action plan to address it.
