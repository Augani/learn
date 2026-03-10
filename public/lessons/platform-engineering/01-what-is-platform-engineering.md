# Lesson 01: What Is Platform Engineering?

## The Highway System Analogy

Imagine a country with no roads. Every business that needs to transport goods
builds its own path — clearing trees, laying gravel, building bridges. Some
paths are excellent. Others are muddy trails that flood in the rain. Every
company reinvents the same work.

Now imagine the government builds a highway system. Standardized roads.
On-ramps and off-ramps. Gas stations. Rest stops. Signage. Businesses
still choose where to drive and what to carry — but they don't build roads.

```
  WITHOUT A PLATFORM (every team builds everything):

  Team A: [Code]--[Build own CI]--[Config own infra]--[Setup monitoring]--[Deploy]
  Team B: [Code]--[Build own CI]--[Config own infra]--[Setup monitoring]--[Deploy]
  Team C: [Code]--[Build own CI]--[Config own infra]--[Setup monitoring]--[Deploy]
  Team D: [Code]--[Build own CI]--[Config own infra]--[Setup monitoring]--[Deploy]

  WITH A PLATFORM (teams use shared capabilities):

                    +----------------------------------+
                    |     Internal Developer Platform   |
                    |  [CI/CD] [Infra] [Obs] [Secrets] |
                    +----------------------------------+
                         |       |       |       |
  Team A: [Code]--------/       |       |       |------>[Deploy]
  Team B: [Code]---------------/       |       |------>[Deploy]
  Team C: [Code]-----------------------/       |------>[Deploy]
  Team D: [Code]-------------------------------/------>[Deploy]
```

Platform engineering is building that highway system for your engineering
organization. You create a self-service layer of tools, workflows, and
infrastructure that product teams use to build, deploy, and operate their
software — without needing to become infrastructure experts.

## Platform Engineering vs DevOps

DevOps is a cultural movement. Platform engineering is a discipline. They're
not opposites — platform engineering is what happens when DevOps principles
get applied at scale.

```
  +-------------------------------+-------------------------------+
  |           DevOps              |     Platform Engineering      |
  +-------------------------------+-------------------------------+
  | Philosophy / culture          | Engineering discipline        |
  | "You build it, you run it"   | "We build the tools you use"  |
  | Every team owns everything   | Shared capabilities layer     |
  | Works great at 5-20 devs     | Necessary at 50+ devs        |
  | Embed ops in every team      | Centralize common tooling     |
  | Knowledge spreads via people  | Knowledge baked into tools    |
  +-------------------------------+-------------------------------+
```

Here's the uncomfortable truth about "pure DevOps" at scale: when every team
owns their entire stack, you get massive duplication. Team A writes a
Terraform module for RDS. Team B writes a different one. Team C copies
Team A's and modifies it. Team D gives up and uses the AWS console.

Cognitive load compounds. A developer who should be focused on building a
recommendation engine is instead debugging Terraform state locks and
configuring Prometheus alert rules.

Platform engineering says: abstract the common stuff. Let product teams focus
on their product. The platform team builds and maintains the shared layer.

```
  Cognitive Load Distribution:

  PURE DEVOPS (every team does everything):
  +------------------------------------------------------------------+
  |  Product Code (40%)  |  Infra (20%)  |  CI/CD (15%)  | Ops (25%) |
  +------------------------------------------------------------------+
    ^ Developer's day

  WITH PLATFORM (platform handles common infra/ops):
  +------------------------------------------------------------------+
  |  Product Code (75%)       |  Platform Self-Service (15%) | (10%) |
  +------------------------------------------------------------------+
    ^ Developer's day                                         ^ Ops
```

## The Internal Developer Platform (IDP)

An Internal Developer Platform is the actual thing you build. It's the
collection of tools, services, and documentation that your developers
interact with daily.

```
  +================================================================+
  |                INTERNAL DEVELOPER PLATFORM                      |
  +================================================================+
  |                                                                |
  |  +-----------------+  +------------------+  +----------------+ |
  |  | Developer Portal|  | Self-Service     |  | Observability  | |
  |  | (Backstage)     |  | Infrastructure   |  | Stack          | |
  |  | - Service       |  | - Databases      |  | - Metrics      | |
  |  |   catalog       |  | - Caches         |  | - Logs         | |
  |  | - API docs      |  | - Queues         |  | - Traces       | |
  |  | - Templates     |  | - DNS            |  | - Dashboards   | |
  |  +-----------------+  +------------------+  +----------------+ |
  |                                                                |
  |  +-----------------+  +------------------+  +----------------+ |
  |  | CI/CD Platform  |  | Secrets &        |  | Golden Paths   | |
  |  | - Shared        |  | Configuration    |  | - Templates    | |
  |  |   pipelines     |  | - Vault          |  | - Scaffolding  | |
  |  | - Build infra   |  | - Config maps    |  | - Standards    | |
  |  | - Artifact      |  | - Dynamic        |  | - Cookbooks    | |
  |  |   registry      |  |   secrets        |  |                | |
  |  +-----------------+  +------------------+  +----------------+ |
  |                                                                |
  +================================================================+
  |  Platform APIs  |  CLI Tools  |  Documentation  |  Support     |
  +================================================================+
```

An IDP isn't a single product you buy. It's a curated set of capabilities
specific to your organization. Some pieces might be open source (Backstage,
ArgoCD), some commercial (Datadog, PagerDuty), and some custom-built.

## The Platform Team's Job

A platform team is not an ops team with a new name. The fundamental shift is
in how you think about your customers. Your customers are your developers.

The platform team:

**Builds self-service capabilities.** Developers shouldn't file a ticket to
get a database. They should be able to provision one through a portal, CLI,
or API in minutes.

**Reduces cognitive load.** Developers shouldn't need to understand Terraform,
Helm charts, Prometheus, and Vault. They should interact with simpler
abstractions that hide the complexity.

**Maintains golden paths.** These are the well-lit, paved, recommended ways of
doing things. Not mandated — recommended. More on this in lesson 02.

**Runs the platform reliably.** If your CI/CD goes down, every team stops
shipping. Platform services need the same rigor as production services —
SLOs, on-call, incident response.

**Gathers feedback and iterates.** Just like a product team runs user research,
the platform team talks to developers, watches them struggle, and fixes
the pain points.

```
  Platform Team Operating Model:

  +--------+     +-----------+     +-----------+     +---------+
  | Listen |---->| Build     |---->| Measure   |---->| Iterate |
  | to dev |     | self-svc  |     | adoption  |     | improve |
  | needs  |     | capability|     | & friction|     | & grow  |
  +--------+     +-----------+     +-----------+     +---------+
       ^                                                   |
       |                                                   |
       +---------------------------------------------------+
```

## Treating the Platform as a Product

This is the single most important mindset shift in platform engineering. Your
platform is not a mandate — it's a product. Developers are your customers.
If your platform is hard to use, they'll work around it.

What does "platform as a product" mean in practice?

**Product management.** You have a backlog. You prioritize features based on
developer impact, not technical elegance. You have a roadmap. You communicate
it.

**User research.** You watch developers use your platform. You measure time-to-
first-deploy. You track where they get stuck. You run surveys.

**Documentation.** Your platform has clear, maintained documentation — not a
wiki graveyard. Getting-started guides. Tutorials. API references.

**Versioning and stability.** You don't break your consumers. You version your
APIs and templates. You deprecate gracefully with migration paths.

**Marketing and adoption.** You can't just build it and expect them to come.
You demo at engineering all-hands. You write internal blog posts. You have
a Slack channel where you're responsive.

```
  Product vs Project Mindset:

  PROJECT MINDSET:                    PRODUCT MINDSET:
  "Build it and move on"             "Build it and improve it"
  "Mandate adoption"                 "Earn adoption"
  "We know what devs need"           "Let's ask what devs need"
  "Ship the feature"                 "Ship the outcome"
  "100% of teams must use it"        "Make it so good they choose it"
```

### A Real Platform Roadmap

Here's what a quarterly platform roadmap might look like:

```yaml
platform_roadmap:
  q1_2025:
    theme: "Zero to deployed in 30 minutes"
    goals:
      - title: "Service scaffolding templates"
        metric: "Time to first deploy < 30 min"
        status: "in-progress"
      - title: "Self-service PostgreSQL provisioning"
        metric: "Eliminate DBA ticket for new databases"
        status: "planned"
      - title: "Standardized CI pipeline for Go services"
        metric: "80% adoption in 8 weeks"
        status: "planned"

  q2_2025:
    theme: "Observable by default"
    goals:
      - title: "Auto-instrumentation for all new services"
        metric: "100% of new services emit traces"
        status: "planned"
      - title: "Shared Grafana dashboards"
        metric: "Every service has a standard dashboard"
        status: "planned"
```

## Developer Experience as a Metric

If you can't measure it, you can't improve it. Developer experience (DevEx)
is measurable — you just have to be intentional about it.

### Quantitative Metrics

**Time to first deploy.** How long from `git init` to running in production?
If this takes days, your platform has gaps. Target: under 1 hour for a
standard service.

**Deployment frequency.** How often do teams deploy? Low frequency often
signals friction in the deployment process.

**Lead time for changes.** From code committed to running in production.
DORA metrics (more in lesson 10) give you industry benchmarks.

**Self-service completion rate.** What percentage of infrastructure requests
can developers fulfill without filing a ticket?

**Onboarding time.** How long until a new hire makes their first production
deployment? Two weeks? Two months?

```
  Developer Experience Metrics Dashboard:

  +--------------------------------------------------------------------+
  |  PLATFORM HEALTH                                     Q1 2025       |
  +--------------------------------------------------------------------+
  |                                                                    |
  |  Time to First Deploy        Self-Service Rate    Deployment Freq  |
  |  ┌──────────────────┐       ┌──────────────┐     ┌─────────────┐  |
  |  │  47 min           │       │  73%          │     │  12/day      │  |
  |  │  Target: <60 min  │       │  Target: 85%  │     │  Target: 15  │  |
  |  │  ▓▓▓▓▓▓▓▓░░       │       │  ▓▓▓▓▓▓▓░░░  │     │  ▓▓▓▓▓▓▓▓░░ │  |
  |  └──────────────────┘       └──────────────┘     └─────────────┘  |
  |                                                                    |
  |  Onboarding Time             Ticket Volume        NPS Score        |
  |  ┌──────────────────┐       ┌──────────────┐     ┌─────────────┐  |
  |  │  3 days           │       │  45/week      │     │  +32         │  |
  |  │  Target: <2 days  │       │  Target: <30  │     │  Target: +40 │  |
  |  │  ▓▓▓▓▓░░░░░       │       │  ▓▓▓▓░░░░░░  │     │  ▓▓▓▓▓▓▓░░░ │  |
  |  └──────────────────┘       └──────────────┘     └─────────────┘  |
  +--------------------------------------------------------------------+
```

### Qualitative Metrics

**Developer surveys.** Run quarterly. Ask about pain points, what they'd
change, what's working. Use a consistent format so you can track trends.

**Developer NPS.** "How likely are you to recommend our platform to a
colleague?" Simple, trackable over time.

**Support ticket analysis.** What are developers asking about most? Those
are your highest-impact improvement areas.

### Sample Developer Survey

```yaml
developer_experience_survey:
  frequency: "quarterly"
  questions:
    - text: "How easy is it to deploy a new service?"
      type: "scale_1_10"
    - text: "How easy is it to provision infrastructure?"
      type: "scale_1_10"
    - text: "What's the most frustrating part of your development workflow?"
      type: "free_text"
    - text: "If you could change one thing about our platform, what would it be?"
      type: "free_text"
    - text: "How likely are you to recommend our platform?"
      type: "nps_0_10"
```

## Where Platform Engineering Goes Wrong

The most common failure modes:

**Building without listening.** The platform team builds what they think is
cool, not what developers need. Three months later, adoption is near zero.

**Mandating adoption.** Forcing teams onto the platform before it's ready
breeds resentment. Earn adoption by being better than the alternative.

**Over-abstracting.** Hiding too much complexity so developers can't debug
when things go wrong. Good abstractions are transparent, not opaque.

**Ignoring the "boring" parts.** Great CI/CD but terrible documentation. A
beautiful portal but no way to debug a failed deployment. The unsexy work
matters most.

**No escape hatches.** If the platform can't handle an edge case, developers
need a way to do it themselves. Locked-down platforms create shadow IT.

## Exercises

1. **Audit your current stack.** List every tool and process a developer at
   your company interacts with from code commit to production. Where are the
   pain points? Where is work duplicated across teams?

2. **Measure time to first deploy.** Walk through creating a new service from
   scratch at your organization. How long does it take? Where are the
   bottlenecks?

3. **Design a developer survey.** Write 10 questions you'd ask your
   organization's developers about their development workflow. Include both
   quantitative (scale) and qualitative (free text) questions.

4. **Platform vs DevOps debate.** Write a one-page argument for why your
   organization should (or shouldn't) invest in a platform team. Use
   specific numbers: team count, deployment frequency, onboarding time.
