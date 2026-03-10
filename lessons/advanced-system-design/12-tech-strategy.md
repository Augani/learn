# Lesson 12: Technical Strategy

> At the staff+ level, the code you don't write matters more
> than the code you do. The decisions you make — and document —
> shape the system for years.

---

## The Analogy

A chess grandmaster and a beginner see the same board. But the
grandmaster sees patterns, threats, and opportunities three to
ten moves ahead. They don't just pick the best move right now —
they pick the move that creates the best position for future
moves.

Technical strategy is chess at the organizational level. Every
technology choice, every architecture decision, every "we'll
fix it later" creates a position. Good strategy creates positions
where future decisions are easier. Bad strategy creates positions
where every future decision is a compromise.

The grandmaster also knows when NOT to play aggressively. Sometimes
the best move is to consolidate, not attack. That's the hardest
lesson in tech strategy: knowing when to invest in what you have
instead of building something new.

---

## Build vs Buy

The most consequential and recurring decision in engineering.

```
  Build vs Buy Decision Framework:

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Is this your core competency?                       │
  │  (Does it differentiate your product?)               │
  │                                                      │
  │        YES                          NO               │
  │         │                           │                │
  │         ▼                           ▼                │
  │  Does a viable                 Buy/adopt.            │
  │  product exist?                 Don't build           │
  │                                commodity              │
  │   YES          NO              infrastructure.        │
  │    │            │                                     │
  │    ▼            ▼                                     │
  │  Evaluate    Build it.                               │
  │  deeply.     This is your                            │
  │  Maybe build,competitive                             │
  │  maybe buy.  advantage.                              │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

### The Hidden Costs of Building

```
  Visible cost of building:
  - 3 engineers × 6 months = 18 person-months
  - Cost: ~$360K (salary + overhead)

  Hidden costs (over 3 years):
  - Maintenance: 1 engineer × 50% time × 3 years = $300K
  - On-call burden: 10% of time × 2 engineers = $120K
  - Security patches: ongoing = $50K/year
  - Feature requests from internal consumers: $100K/year
  - Documentation and training: $30K
  - Opportunity cost (what else could those engineers build?)

  Total 3-year cost: ~$1.3M+

  Hidden costs of buying:
  - Licensing: varies ($10K-500K/year)
  - Integration: 1 engineer × 2 months = $40K
  - Vendor lock-in risk
  - Limited customization
  - Dependency on vendor roadmap

  Total 3-year cost: varies wildly
```

### Real Examples

```
  SHOULD BUILD:
  - Your recommendation algorithm (core product)
  - Your domain-specific data pipeline
  - Your customer-facing API layer

  SHOULD BUY:
  - Authentication (Auth0, Okta)
  - Email delivery (SendGrid, SES)
  - Monitoring (Datadog, Grafana Cloud)
  - CI/CD (GitHub Actions, CircleCI)
  - Payment processing (Stripe, Adyen)

  IT DEPENDS:
  - Message queue (Kafka vs managed Kafka vs SQS)
  - Database (self-managed vs RDS vs CockroachDB Cloud)
  - Search (Elasticsearch vs Algolia vs managed OpenSearch)
  - Feature flags (home-grown vs LaunchDarkly)
```

---

## Technology Radar

A technology radar catalogs your organization's relationship
with technologies. Popularized by ThoughtWorks, adapted for
internal use by many engineering organizations.

```
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │                    ADOPT                             │
  │            (use freely in production)                │
  │                                                      │
  │   Go, PostgreSQL, Kafka, Kubernetes, React,          │
  │   Terraform, Datadog, GitHub Actions                 │
  │                                                      │
  ├──────────────────────────────────────────────────────┤
  │                    TRIAL                             │
  │         (use in new projects with review)            │
  │                                                      │
  │   Rust (for performance-critical services),          │
  │   CockroachDB, Temporal (workflow engine),           │
  │   OpenTelemetry                                      │
  │                                                      │
  ├──────────────────────────────────────────────────────┤
  │                   ASSESS                             │
  │       (research only, no production use yet)         │
  │                                                      │
  │   Zig, Neon (serverless Postgres), WasmEdge,         │
  │   ClickHouse                                         │
  │                                                      │
  ├──────────────────────────────────────────────────────┤
  │                    HOLD                              │
  │  (stop new adoption, migrate away when possible)     │
  │                                                      │
  │   Ruby on Rails (legacy), MongoDB (for relational    │
  │   data), Jenkins, self-hosted GitLab                 │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

### Running a Technology Radar Process

```
  Quarterly cycle:

  Week 1-2: Proposals
  - Any engineer can propose adding, moving, or removing
    a technology
  - Proposal template:
    * Technology name
    * Proposed ring (adopt/trial/assess/hold)
    * Rationale (why this ring?)
    * Experience (who has used it? what was the outcome?)
    * Alternatives considered

  Week 3: Review
  - Architecture council reviews proposals
  - Discussion on tradeoffs
  - Decision: accept, modify, or defer

  Week 4: Publish
  - Updated radar published to engineering org
  - Blog post explaining changes
  - Teams update their roadmaps accordingly
```

---

## Managing Technical Debt

Technical debt is not inherently bad. Like financial debt, it's
a tool — powerful when used deliberately, destructive when
accumulated accidentally.

### Types of Technical Debt

```
  ┌────────────────┬───────────────────────────────────────────┐
  │ Type           │ Description                               │
  ├────────────────┼───────────────────────────────────────────┤
  │ Deliberate/    │ "We know this is a shortcut, but we need  │
  │ Prudent        │ to ship by Friday. We'll fix it in the    │
  │                │ next sprint." (This is healthy.)           │
  ├────────────────┼───────────────────────────────────────────┤
  │ Deliberate/    │ "We don't have time for tests." (This is  │
  │ Reckless       │ never paid back and compounds fast.)       │
  ├────────────────┼───────────────────────────────────────────┤
  │ Accidental/    │ "Now that we understand the domain better,│
  │ Prudent        │ we see this design doesn't fit." (Natural │
  │                │ evolution — unavoidable.)                  │
  ├────────────────┼───────────────────────────────────────────┤
  │ Accidental/    │ "What is this code even doing?" (Result   │
  │ Reckless       │ of junior engineers without mentorship    │
  │                │ or lack of code review.)                  │
  └────────────────┴───────────────────────────────────────────┘
```

### Quantifying Technical Debt

Don't say "we have a lot of tech debt." Quantify it:

```
  Tech Debt Register:

  ┌─────────────────────┬────────┬──────────┬──────────┬────────┐
  │ Item                │ Impact │ Cost to  │ Interest │ Priority│
  │                     │ (1-5)  │ Fix (wks)│ (wks/yr) │        │
  ├─────────────────────┼────────┼──────────┼──────────┼────────┤
  │ Monolithic deploy   │ 5      │ 16       │ 8        │ HIGH   │
  │ pipeline            │        │          │ (slow    │        │
  │                     │        │          │  deploys)│        │
  ├─────────────────────┼────────┼──────────┼──────────┼────────┤
  │ Missing DB indexes  │ 3      │ 1        │ 4        │ HIGH   │
  │ on search queries   │        │          │ (slow    │        │
  │                     │        │          │  queries)│        │
  ├─────────────────────┼────────┼──────────┼──────────┼────────┤
  │ No integration tests│ 4      │ 8        │ 12       │ HIGH   │
  │ for payment flow    │        │          │ (manual  │        │
  │                     │        │          │  testing)│        │
  ├─────────────────────┼────────┼──────────┼──────────┼────────┤
  │ Legacy auth library │ 2      │ 12       │ 2        │ LOW    │
  │                     │        │          │ (small   │        │
  │                     │        │          │  friction│        │
  └─────────────────────┴────────┴──────────┴──────────┴────────┘

  Priority = Impact × Interest / Cost to Fix

  "Interest" = ongoing cost of NOT fixing it (wasted engineer
  time per year). This makes the business case.
```

### The 20% Rule

Many successful organizations dedicate ~20% of engineering time
to technical debt and infrastructure improvements. The key is
making this systematic, not ad-hoc:

```
  Quarter planning:

  Feature work:    ~60% of capacity
  Tech debt:       ~20% of capacity
  Operational:     ~10% of capacity (on-call, incidents)
  Innovation:      ~10% of capacity (exploration, prototypes)

  The 20% for tech debt is protected. Product managers
  can't borrow from it. If they do, debt compounds and
  velocity drops — then they'll need 40% to catch up.
```

---

## Architecture Decision Records (ADRs)

ADRs document the WHY behind architecture decisions. They're
the single most important artifact a staff engineer produces.

```
  Why ADRs matter:

  6 months from now, someone will ask:
  "Why did we choose Kafka over RabbitMQ?"
  "Why is this service in Go instead of Java?"
  "Why are we using eventual consistency here?"

  Without an ADR: "I don't know, ask Sarah... oh, Sarah left."
  With an ADR: Read the document. Context, options, decision,
  consequences — all recorded.
```

### ADR Template

```markdown
# ADR-042: Use PostgreSQL for Order Event Store

## Status
Accepted (2026-02-15)

## Context
We're implementing event sourcing for the order management
domain (ref: Project Phoenix). We need an event store that
supports:
- Append-only writes at 5K events/second (current peak)
- Stream-level reads with ordering guarantees
- Optimistic concurrency control
- Integration with our existing operational tooling

Growth projection: 50K events/second within 18 months.

## Decision Drivers
- Operational familiarity (team knows PostgreSQL deeply)
- Cost constraints (budget for new infrastructure limited)
- Timeline (MVP needed in 6 weeks)
- Future migration path if we outgrow PostgreSQL

## Options Considered

### Option A: EventStoreDB
Pros: Purpose-built, subscriptions, projections built-in
Cons: New operational burden, small community, team unfamiliar
Risk: High operational risk for a critical system

### Option B: PostgreSQL with custom event store schema
Pros: Team expertise, existing tooling, ACID guarantees
Cons: Not optimized for event sourcing workload,
      may need migration at 50K events/sec
Risk: Medium — may need to migrate in 12-18 months

### Option C: Kafka as event store
Pros: High throughput, built-in pub/sub, partitioned
Cons: Not a database, no per-stream queries, retention
      complexity, harder to debug
Risk: Medium — mismatch between Kafka's model and
      our event sourcing needs

## Decision
Option B: PostgreSQL with custom event store schema.

## Rationale
- Team can build and operate this in 6 weeks
- Operational risk is lowest (known technology)
- If we outgrow PostgreSQL, we can migrate to EventStoreDB
  or Kafka+PostgreSQL hybrid
- The event store schema is our abstraction — the backing
  store can change without affecting consumers

## Consequences
- Must implement optimistic concurrency manually
- Must implement subscription/projection infrastructure
- Must plan migration path for 50K events/sec
  (revisit at 20K events/sec or Q3 2026, whichever is first)
- Team will document event store interface as a clean
  abstraction layer to facilitate future migration

## Follow-up Actions
- [ ] Implement event store schema (Jane, Sprint 42)
- [ ] Implement projection infrastructure (Bob, Sprint 43)
- [ ] Set up monitoring for event throughput (Jane, Sprint 43)
- [ ] Schedule capacity review for Q3 2026 (Staff eng)
```

### ADR Governance

```
  When is an ADR required?

  ALWAYS required for:
  - New technology adoption (language, database, framework)
  - Architecture changes affecting multiple services
  - Breaking API changes
  - Data model changes to core entities
  - Security architecture changes
  - Changes to deployment or infrastructure strategy

  NOT required for:
  - Library version upgrades
  - Bug fixes
  - Internal refactoring within a single service
  - Adding a new endpoint to an existing API
  - Configuration changes
```

---

## Communicating Architecture

The best architecture decision is worthless if nobody understands
it or follows it.

### The C4 Model (for architecture diagrams)

```
  Level 1: System Context
  (who uses the system and what it connects to)

  ┌─────────┐     ┌───────────────┐     ┌──────────┐
  │ Customer │────>│  E-Commerce   │────>│ Payment  │
  │          │     │  Platform     │     │ Provider │
  └─────────┘     └───────────────┘     └──────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  Shipping    │
                  │  Partner     │
                  └──────────────┘


  Level 2: Container (major runtime components)

  ┌─────────────────────────────────────────┐
  │          E-Commerce Platform            │
  │                                         │
  │  ┌───────┐  ┌───────┐  ┌───────┐       │
  │  │Web App│  │Mobile │  │ API   │       │
  │  │(React)│  │ App   │  │Gateway│       │
  │  └───┬───┘  └───┬───┘  └───┬───┘       │
  │      │          │          │            │
  │      └──────────┴──────────┘            │
  │                 │                       │
  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐  │
  │  │Order │ │User  │ │Search│ │Payment│  │
  │  │ Svc  │ │ Svc  │ │ Svc  │ │ Svc   │  │
  │  └──┬───┘ └──┬───┘ └──┬───┘ └───┬───┘  │
  │     │        │        │         │       │
  │  ┌──▼───┐ ┌──▼───┐ ┌──▼────┐   │       │
  │  │PgSQL │ │PgSQL │ │Elastic│   │       │
  │  └──────┘ └──────┘ └───────┘   │       │
  └─────────────────────────────────┘       │


  Level 3: Component (inside one container)
  Level 4: Code (class/function level — rarely needed)
```

### Writing Technical Strategy Documents

```
  Structure of a Technical Strategy Document:

  1. CONTEXT (1 page)
     - Where are we now?
     - What's changing? (business, technical, organizational)
     - What are the constraints?

  2. VISION (0.5 page)
     - Where do we want to be in 12-18 months?
     - What does success look like? (measurable outcomes)

  3. DIAGNOSIS (1-2 pages)
     - What's working?
     - What's not working? (be specific, use data)
     - What are the root causes?

  4. STRATEGY (1-2 pages)
     - What are we going to do about it?
     - What are we explicitly NOT going to do?
     - What are the key tradeoffs?

  5. PLAN (1-2 pages)
     - Milestones with dates
     - Dependencies
     - Risks and mitigations
     - How we'll measure progress

  6. APPENDIX
     - ADRs referenced
     - Supporting data
     - Alternative approaches considered
```

### Communicating to Different Audiences

```
  Executive audience:
  - Lead with business impact
  - One diagram maximum
  - "This will reduce downtime by 50%, saving $2M/year"
  - Skip technical details

  Engineering manager audience:
  - Lead with team impact
  - Timeline and resource needs
  - "This requires 2 engineers for 3 months"
  - Include risks

  Engineer audience:
  - Lead with the technical problem
  - Show the architecture
  - Explain the tradeoffs
  - Include ADRs and references

  Same decision, three different documents.
```

---

## Building Technical Influence

At staff+ level, your impact comes from influence, not authority.

```
  How staff engineers create impact:

  1. DOCUMENTATION
     Write the ADR, the strategy doc, the RFC.
     Whoever writes the document frames the discussion.

  2. CODE REVIEWS
     Use reviews to teach, not gatekeep.
     Explain the WHY behind suggestions.

  3. OFFICE HOURS
     Regular time for anyone to ask architecture questions.
     Prevent bad decisions before they're made.

  4. PROOF OF CONCEPT
     Don't argue about architecture in meetings.
     Build a small proof of concept and show it.

  5. TEACHING
     Write internal blog posts. Give tech talks.
     Create runbooks and training materials.

  6. SPONSORSHIP
     Find the right person for a project and sponsor them.
     Your job is to multiply, not to do everything yourself.
```

---

## Exercises

1. **Build vs buy.** Your team needs a feature flag system. Build
   the analysis: what would building in-house look like (cost,
   timeline, maintenance)? What would LaunchDarkly or Unleash
   cost? What's the recommendation and why? Write this as a
   one-page decision memo.

2. **Technology radar.** Create a technology radar for a team
   you've worked with. Put every technology in a ring (adopt,
   trial, assess, hold). For each "hold" item, explain why and
   what the migration path is. For each "trial" item, explain
   the evaluation criteria.

3. **ADR practice.** Write an ADR for a real decision you've
   made (or need to make). Follow the template. Include at
   least three options with honest pros/cons. Would someone
   reading this in 2 years understand why you chose what you
   chose?

4. **Tech debt quantification.** List the top 5 technical debt
   items in a codebase you know. For each, estimate: cost to
   fix (engineer-weeks), ongoing interest (engineer-weeks/year),
   and risk if left unaddressed. Calculate the ROI of fixing
   each. Which do you fix first?

5. **Strategy document.** Write a 2-page technical strategy
   document for a system you work on. Cover: where it is now,
   where it needs to be in 12 months, what the biggest risks
   are, and what the first three concrete steps should be.

---

[Next: Lesson 13 — Design a Global-Scale System -->](13-design-real-systems.md)
