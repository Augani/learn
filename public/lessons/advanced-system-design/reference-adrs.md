# Architecture Decision Records (ADRs)

Templates and examples for documenting architecture decisions.

---

## Why ADRs

```
  Without ADRs:

  "Why did we choose X?"
  "I think Sarah decided that... but she left 6 months ago."
  "Let's just rewrite it with Y."
  (Y has the same problems. Nobody remembers why X was chosen.)

  With ADRs:

  "Why did we choose X?"
  "ADR-017 explains: we evaluated X, Y, and Z. We chose X because
   of constraints A and B. The tradeoff is C, which we accepted
   because D. If constraint B changes, revisit this decision."
```

---

## ADR Template (Lightweight)

Use this template for most decisions. It fits in a single
page and takes 30-60 minutes to write.

```markdown
# ADR-[NUMBER]: [TITLE]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Date
[YYYY-MM-DD]

## Context
[What is the issue? What forces are at play? What constraints
exist? 2-4 sentences max.]

## Decision
[What did we decide? Be specific. 1-3 sentences.]

## Consequences
[What are the results? Both positive and negative.
Bullet list, 3-6 items.]

## Alternatives Considered
[What other options were evaluated? Why were they rejected?
Brief, 1-2 sentences per alternative.]
```

---

## ADR Template (Detailed)

Use this template for consequential, hard-to-reverse decisions
that affect multiple teams or will last 2+ years.

```markdown
# ADR-[NUMBER]: [TITLE]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Date
[YYYY-MM-DD]

## Decision Makers
[Who participated in this decision?]

## Context

### Problem Statement
[What problem are we solving? Why is the current state
unacceptable? Include data if available.]

### Constraints
[What are the non-negotiable constraints?
Budget, timeline, team skills, compliance, etc.]

### Decision Drivers
[What qualities are we optimizing for? Rank them.
e.g., 1. Availability, 2. Cost, 3. Simplicity]

## Options Considered

### Option A: [Name]
**Description:** [How this option works]
**Pros:**
- [Pro 1]
- [Pro 2]
**Cons:**
- [Con 1]
- [Con 2]
**Estimated effort:** [T-shirt size or weeks]
**Risk:** [Low/Medium/High with explanation]

### Option B: [Name]
[Same structure as Option A]

### Option C: [Name]
[Same structure as Option A]

## Decision
[Which option was chosen and why. Reference the decision
drivers. Explain why this option best satisfies the ranked
priorities.]

## Consequences

### Positive
- [What gets better]

### Negative
- [What gets worse or harder]

### Neutral
- [What changes but isn't clearly better or worse]

## Risks and Mitigations
[What could go wrong with this decision?
How will we detect and handle it?]

## Follow-up Actions
- [ ] [Action 1] (Owner, Deadline)
- [ ] [Action 2] (Owner, Deadline)

## Review Date
[When should this decision be revisited?]

## References
- [Link to relevant design doc]
- [Link to related ADR]
- [Link to relevant metrics/data]
```

---

## Example: Database Selection

```markdown
# ADR-017: Use CockroachDB for Order Management

## Status
Accepted

## Date
2026-01-15

## Decision Makers
Jane (Staff Eng), Bob (Eng Manager), Alice (DBA Lead)

## Context

### Problem Statement
Our order management system currently uses a single-region
PostgreSQL instance (RDS). We're expanding to EU and APAC,
requiring multi-region data access. EU users experience
200ms+ latency on order operations. GDPR requires EU user
data to be stored in EU.

Current peak: 5K orders/minute (expected 15K in 12 months).
Current DB: RDS PostgreSQL, db.r6g.4xlarge, 15K IOPS.

### Constraints
- Budget: $20K/month for database infrastructure
- Timeline: Production-ready within 4 months
- Team: 2 DBAs, familiar with PostgreSQL, no CockroachDB exp
- Compliance: GDPR data residency for EU users
- Availability: 99.95% SLO

### Decision Drivers
1. Multi-region read/write with low latency
2. GDPR compliance (data pinning)
3. Operational simplicity
4. Cost
5. Migration risk from PostgreSQL

## Options Considered

### Option A: CockroachDB (multi-region)
**Description:** Distributed SQL database with multi-region
support. Pin data to regions using locality constraints.
PostgreSQL-compatible wire protocol.
**Pros:**
- Native multi-region with data pinning (GDPR)
- PostgreSQL-compatible (easier migration)
- Automatic rebalancing and failover
- Serializable isolation by default
**Cons:**
- Team has no CockroachDB experience
- Higher latency for cross-region transactions
- Licensing cost for Enterprise (needed for geo-partitioning)
**Estimated effort:** 12 weeks (including migration)
**Risk:** Medium — new technology, but PostgreSQL compatibility
reduces migration risk.

### Option B: PostgreSQL with Citus (multi-region)
**Description:** Distributed PostgreSQL using Citus extension.
Set up primary in each region with logical replication.
**Pros:**
- Team knows PostgreSQL deeply
- Lower licensing cost (open source + managed)
- Full PostgreSQL feature set
**Cons:**
- Multi-region active-active requires complex custom setup
- No native data pinning for GDPR
- Conflict resolution is manual
- Operational complexity for multi-region
**Estimated effort:** 16 weeks
**Risk:** High — custom multi-region setup, conflict resolution.

### Option C: DynamoDB Global Tables
**Description:** AWS-managed multi-region NoSQL database with
automatic replication.
**Pros:**
- Fully managed, minimal ops burden
- Multi-region out of the box
- Scales automatically
**Cons:**
- Not SQL — requires complete data access layer rewrite
- Last-writer-wins conflict resolution only
- No ACID transactions across items
- Vendor lock-in (AWS only)
- Cost can spike unpredictably at scale
**Estimated effort:** 20 weeks (full rewrite of data layer)
**Risk:** High — complete rewrite, loss of SQL capabilities.

## Decision
Option A: CockroachDB.

Multi-region with data pinning is the primary requirement,
and CockroachDB handles this natively. PostgreSQL wire
compatibility reduces migration risk significantly — our
existing queries will largely work. The team skill gap is
addressed by the 4-week training plan and CockroachDB's
similarity to PostgreSQL.

## Consequences

### Positive
- EU users get local-region latency (< 20ms for reads)
- GDPR compliance through data pinning
- Automatic failover across regions
- Serializable transactions without custom conflict logic

### Negative
- Cross-region writes add 100-200ms latency
- Enterprise license cost (~$8K/month additional)
- Team needs 4+ weeks to build operational confidence
- Some PostgreSQL-specific features unavailable (extensions)

### Neutral
- Migration from PostgreSQL requires testing but not rewriting
- Monitoring stack needs CockroachDB dashboards

## Risks and Mitigations
- **Team skill gap:** 4-week training plan, CockroachDB
  professional services engagement for first month.
- **Migration data loss:** Use dual-write migration pattern
  (ADR-018) with shadow reads for validation.
- **Performance regression:** Load test at 2x projected peak
  before cutover. Rollback plan to PostgreSQL for 30 days.

## Follow-up Actions
- [ ] CockroachDB training for DBA team (Alice, Feb 1)
- [ ] Migration plan document (Jane, Feb 15)
- [ ] Load test environment setup (Bob, Feb 15)
- [ ] GDPR data pinning validation (Alice, Mar 1)
- [ ] Production cutover (Jane, Apr 1)

## Review Date
July 2026 (6 months post-migration, evaluate operational
experience and cost vs projections)

## References
- ADR-018: Order DB Migration Strategy
- [CockroachDB Multi-Region docs]
- [Internal: Q4 Latency Analysis for EU Users]
```

---

## Example: Build vs Buy

```markdown
# ADR-023: Use LaunchDarkly for Feature Flags

## Status
Accepted

## Date
2026-02-01

## Context
We need a feature flag system to support:
- Zero-downtime migrations (ADR-018)
- Canary deployments
- A/B testing
- Kill switches for degradation

Currently using environment variables and config files,
which require redeployment to change.

### Constraints
- Budget: < $2K/month
- Timeline: Operational within 2 weeks
- Must support Go, Python, and React SDKs

### Decision Drivers
1. Time to operational (speed)
2. Reliability (feature flags are critical infrastructure)
3. Total cost of ownership over 2 years

## Options Considered

### Option A: LaunchDarkly
**Pros:** Mature product, all SDKs, targeting, audit trail
**Cons:** SaaS dependency, cost scales with seats
**Cost:** ~$1.2K/month (50 seats)
**Effort:** 1 week integration

### Option B: Unleash (self-hosted)
**Pros:** Open source, self-hosted (control), lower cost
**Cons:** Ops burden, fewer features, smaller community
**Cost:** ~$400/month (infrastructure) + ops time
**Effort:** 3 weeks setup + ongoing maintenance

### Option C: Build in-house
**Pros:** Full control, exact features needed
**Cons:** 3-6 months to build, ongoing maintenance
**Cost:** ~$150K build + $50K/year maintenance
**Effort:** 12+ weeks

## Decision
Option A: LaunchDarkly.

Feature flags are not our core competency. Building or
self-hosting diverts engineering time from product work.
LaunchDarkly is operational in 1 week vs 3-12 weeks for
alternatives. At $1.2K/month, the 2-year cost ($28.8K) is
far less than building ($250K) and comparable to self-hosted
when accounting for ops time.

## Consequences
### Positive
- Operational in 1 week
- No maintenance burden
- Mature targeting and audit trail

### Negative
- SaaS dependency (mitigated by SDK-side caching)
- Cost increases with headcount
- Limited customization

## Review Date
February 2027 (evaluate cost at current headcount, assess
whether needs have outgrown LaunchDarkly)
```

---

## Example: Deprecation Decision

```markdown
# ADR-031: Deprecate MongoDB for Relational Data

## Status
Accepted

## Date
2026-02-20

## Context
Three services (user-profile, notification-prefs, and
audit-log) use MongoDB for data that is fundamentally
relational. This causes:
- No JOIN capability, requiring application-level joins
- Data inconsistency from denormalization
- Two database platforms to operate (PostgreSQL + MongoDB)
- Team context-switching between query languages

MongoDB remains appropriate for the document-search service
where schema flexibility is genuinely needed.

## Decision
Move user-profile and notification-prefs data to PostgreSQL.
Keep audit-log in MongoDB (append-heavy, schema varies).
Move MongoDB to "Hold" on the technology radar for new
relational use cases.

## Consequences
### Positive
- Simplified operations (one fewer database for most teams)
- Proper JOINs for relational data
- Consistent tooling and monitoring

### Negative
- Migration effort: ~6 weeks for both services
- audit-log remains on MongoDB (acceptable, good fit)

## Follow-up Actions
- [ ] user-profile migration plan (ADR-032, Sam, Mar 1)
- [ ] notification-prefs migration plan (Lee, Mar 15)
- [ ] Update technology radar (Staff eng, Mar 1)
```

---

## ADR Governance

### When to Write an ADR

```
  ALWAYS write an ADR for:

  □ New technology adoption (database, language, framework)
  □ Architecture changes affecting 2+ services
  □ Data model changes to core entities
  □ Breaking API changes
  □ Security architecture changes
  □ Deployment strategy changes
  □ Build vs buy decisions over $10K
  □ Deprecation of existing technology

  DON'T need an ADR for:

  □ Library version upgrades (unless major version)
  □ Bug fixes
  □ Internal refactoring within one service
  □ Adding endpoints to existing APIs
  □ Configuration changes
  □ Choosing between equivalent options with no tradeoffs
```

### ADR Lifecycle

```
  PROPOSED ──> ACCEPTED ──> [SUPERSEDED by ADR-XXX]
      │                         │
      └──> REJECTED             └──> DEPRECATED
```

### Storage and Discovery

```
  Option 1: In the repository (recommended for small teams)
  /docs/adrs/
  ├── 0001-use-postgresql.md
  ├── 0002-adopt-kubernetes.md
  ├── 0003-event-sourcing-for-orders.md
  └── template.md

  Option 2: Wiki/Confluence (for large organizations)
  Searchable, cross-team visibility, comments

  Option 3: Dedicated tool (log4brains, ADR Manager)
  Auto-generates index, tracks status, links related ADRs
```

### Review Process

```
  1. Author writes ADR (draft status: PROPOSED)
  2. Share with affected teams for feedback (1 week)
  3. Architecture review meeting (30 min, focused)
  4. Address feedback, update ADR
  5. Decision maker approves → status: ACCEPTED
  6. Merge to main branch / publish to wiki

  Total time: 1-2 weeks for most decisions
  Heavyweight review: only for irreversible, high-impact decisions
```

---

## Common Pitfalls

```
  ✗ Writing ADRs after the decision
    (Write it BEFORE or DURING the decision process.
     The process of writing clarifies thinking.)

  ✗ Too much detail
    (The lightweight template is one page. If you need
     more, use the detailed template — but rarely.)

  ✗ Not listing alternatives
    (If there's only one option, you don't need an ADR.
     ADRs exist because there ARE alternatives.)

  ✗ Hiding tradeoffs
    (Be honest about the downsides. Future readers need
     to understand what was sacrificed.)

  ✗ Not setting a review date
    (Decisions have a shelf life. Set a date to revisit.)

  ✗ Not linking related ADRs
    (Decisions build on each other. Make the chain visible.)

  ✗ Treating ADRs as approvals
    (ADRs document decisions, not seek permission.
     The decision maker is the author's team lead or
     staff engineer, not a committee.)
```

---

[Back to Roadmap](00-roadmap.md)
