# Platform Engineering Patterns & Anti-Patterns

## Patterns (Do These)

### 1. Platform as a Product

```
  PATTERN: Treat the platform like a product with customers (developers).

  +----------+     +-----------+     +-----------+     +---------+
  | Discover |---->| Prioritize|---->| Build     |---->| Measure |
  | needs    |     | by impact |     | & ship    |     | adoption|
  +----------+     +-----------+     +-----------+     +---------+
       ^                                                     |
       +-----------------------------------------------------+

  Key practices:
  - Product roadmap, publicly shared
  - Developer surveys (quarterly)
  - NPS tracking
  - Feature prioritization by developer impact
  - "Not doing" list (as important as the roadmap)

  Signs it's working:
  - Teams voluntarily adopt new capabilities
  - Developers give feedback (they care enough to complain)
  - Adoption grows without mandates
```

### 2. Thin Platform

```
  PATTERN: Build the thinnest viable platform. Curate and configure
  existing tools rather than building from scratch.

  BAD: Build a custom CI system, custom container registry,
       custom monitoring stack, custom secret manager.

  GOOD: GitHub Actions (reusable workflows) + ECR + Grafana stack
        + Vault, all glued together with thin automation.

  +------------------+
  | Your thin layer  |   <-- Templates, CLIs, CRDs, portal config
  +------------------+       (this is what you build)
  | Backstage        |
  | ArgoCD           |   <-- Open source / commercial tools
  | Crossplane       |       (this is what you curate)
  | Vault            |
  | OTel + Grafana   |
  +------------------+
  | Cloud provider   |   <-- AWS / GCP / Azure
  +------------------+       (this is what you consume)

  Rule of thumb: if an open-source tool does 80% of what you need,
  use it and live with the 20% gap. Don't build your own.
```

### 3. Golden Paths, Not Golden Cages

```
  PATTERN: Provide opinionated defaults that are easy to follow,
  but allow teams to deviate when justified.

  +==================================================+
  || Golden Path (paved, lit, recommended)           ||
  || 90% of teams follow this                        ||
  +==================================================+

  ....................................................
  .. Off-road (possible, documented, visible)        ..
  .. 10% of teams deviate here                       ..
  ....................................................

  Key practices:
  - Defaults handle 80%+ of use cases
  - Escape hatches are documented, not forbidden
  - Deviations are visible (tracked in catalog)
  - Override requests inform future path improvements
```

### 4. Self-Service by Default

```
  PATTERN: Every platform capability should be self-service.
  If a developer needs to file a ticket, the platform has a gap.

  SELF-SERVICE MATURITY LADDER:

  Level 0: File a ticket, wait days
  Level 1: File a ticket, automated provisioning (hours)
  Level 2: CLI command, automated provisioning (minutes)
  Level 3: Portal button, automated provisioning (minutes)
  Level 4: Declared in code, auto-provisioned at deploy (seconds)
  Level 5: Included in template, exists before developer thinks about it

  Target Level 3-4 for most capabilities.
  Level 5 for observability and security.
```

### 5. Collaboration Before X-as-a-Service

```
  PATTERN: Build new capabilities in collaboration with 2-3
  stream-aligned teams before making them self-service.

  WRONG:
  Platform team builds in isolation for 6 months -> launches ->
  nobody uses it because it doesn't solve real problems.

  RIGHT:
  Platform team + 2 stream-aligned teams collaborate for 6 weeks ->
  iterate based on real usage -> launch to org -> teams adopt
  because it solves problems they helped define.

  Timeline:
  [Collaborate 4-8 weeks] -> [Facilitate 2-4 weeks] -> [X-as-a-Service]
```

### 6. Measure Everything

```
  PATTERN: Define success metrics before building. Track adoption,
  satisfaction, and delivery performance.

  Metrics pyramid:

         /\
        /  \     DORA metrics (org-wide delivery performance)
       /    \    Deployment freq, lead time, CFR, MTTR
      /------\
     /        \   Developer experience
    /          \  NPS, survey scores, friction points
   /------------\
  /              \ Adoption & operational
 /                \ Service coverage, self-service rate,
/                  \ platform uptime, cost per team
+------------------+

  If you can't answer "did this capability make developers
  faster?" you shouldn't have built it.
```

### 7. Incremental Adoption

```
  PATTERN: Roll out platform capabilities incrementally.
  Don't big-bang migrate everyone at once.

  Phase 1: Build with 2-3 early adopter teams
  Phase 2: Open to 5-10 volunteer teams
  Phase 3: Active outreach to remaining teams
  Phase 4: Gentle nudges for stragglers

  Never: "Everyone must migrate by March 1st"

  Track adoption as a curve:
  100% |                                    xxxxxxxxxx
       |                              xxxxxx
       |                        xxxxxx
       |                  xxxxxx
       |            xxxxxx
       |      xxxxxx
    0% |xxxxxx
       +------------------------------------------>
       Phase 1  Phase 2    Phase 3      Phase 4
```

### 8. Secure by Default

```
  PATTERN: Security should be built into the golden path,
  not bolted on afterward.

  Every template includes:
  - TLS everywhere (cert-manager auto-provisioned)
  - Secrets from Vault (never env vars or config files)
  - Security scanning in CI (Trivy, gosec)
  - Network policies (deny-all default, allow-list)
  - SBOM generation (supply chain transparency)
  - Image signing (cosign/sigstore)
  - Non-root containers (distroless base images)

  Developers get security for free. They don't opt in.
  They'd have to opt out (and that's visible).
```

### 9. Documentation as Code

```
  PATTERN: Documentation lives in the service repo, next to
  the code. Rendered and aggregated by the portal.

  Service repo:
  my-service/
  ├── docs/
  │   ├── index.md
  │   ├── architecture.md
  │   ├── runbook.md
  │   └── adr/
  │       └── 001-chose-postgresql.md
  ├── mkdocs.yml
  └── catalog-info.yaml

  Benefits:
  - Docs are versioned with code
  - PRs that change behavior must update docs
  - Stale docs are visible (last commit date)
  - Portal aggregates all docs, making them searchable
```

### 10. Error Budgets for the Platform

```
  PATTERN: Platform services have SLOs with error budgets.
  When budget is spent, freeze features and fix reliability.

  CI/CD SLO: 99.9% availability (43 min downtime / 30 days)
  Vault SLO: 99.99% availability (4.3 min downtime / 30 days)

  Budget remaining:
  CI/CD:  [████████████████████████████░░░] 89% remaining
  Vault:  [██████████████████████████████░] 95% remaining

  When budget < 20%:
  - No new features on that service
  - Focus entirely on reliability
  - Post-mortem on budget consumption
```

---

## Anti-Patterns (Don't Do These)

### 1. The Mandate Anti-Pattern

```
  ANTI-PATTERN: Force adoption through policy instead of value.

  "All teams MUST migrate to the platform pipeline by Q2."

  Why it fails:
  - Teams resent forced migration
  - Platform may not handle edge cases
  - Creates shadow IT (teams work around the platform)
  - Erodes trust

  Fix: Make the platform so good teams choose it.
  Exception: Security-critical requirements can be mandatory.
```

### 2. The Ivory Tower Anti-Pattern

```
  ANTI-PATTERN: Platform team builds what they think is cool,
  not what developers need.

  "We built a custom Kubernetes scheduler plugin!"
  Developers: "We just want faster builds."

  Fix:
  - Talk to developers weekly
  - Prioritize by pain, not by technical interest
  - Measure adoption as a success metric
  - Require collaboration phase for new capabilities
```

### 3. The Ticket Queue Anti-Pattern

```
  ANTI-PATTERN: Platform team becomes an ops team handling
  tickets instead of building self-service.

  Symptom: Growing ticket backlog, platform team is bottleneck.

  Fix:
  - Every repeated ticket = missing self-service capability
  - Track top 5 ticket categories monthly
  - Convert top categories into self-service automation
  - Goal: zero tickets for standard operations
```

### 4. The Big Bang Anti-Pattern

```
  ANTI-PATTERN: Build the entire platform before releasing anything.

  "We'll launch the complete platform in 12 months."
  Month 6: Requirements changed. Month 10: Team burned out.
  Month 12: Nobody uses it because they built workarounds.

  Fix: Ship incrementally.
  Month 1-3: Service catalog + shared CI templates
  Month 4-6: Self-service databases + secrets management
  Month 7-9: Observability + golden path templates
  Month 10-12: Optimization + maturity
```

### 5. The Over-Abstraction Anti-Pattern

```
  ANTI-PATTERN: Abstract so much that developers can't debug
  when things go wrong.

  "Our platform hides all Kubernetes complexity!"
  Developer: "My pod is crashing and I can't see why."

  Good abstraction: simpler default interface, full access underneath.
  Bad abstraction: opaque black box with no escape hatch.

  Fix:
  - Abstractions should be transparent, not opaque
  - Always provide a way to "see behind the curtain"
  - Error messages should reference underlying resources
  - kubectl access is preserved, even if CRDs are the primary interface
```

### 6. The Everything Platform Anti-Pattern

```
  ANTI-PATTERN: Try to platform every possible infrastructure
  resource and workflow.

  "We need to support PostgreSQL, MySQL, MongoDB, CockroachDB,
  DynamoDB, Cassandra, Redis, Memcached, ..."

  Fix:
  - 80/20 rule: platform the top 3-4 use cases
  - Provide escape hatches for the rest
  - "Not supported" is a valid answer
  - Add support when demand justifies investment
```

### 7. The Copy-Paste Platform Anti-Pattern

```
  ANTI-PATTERN: Copy another company's platform without
  understanding your own developers' needs.

  "Spotify built Backstage, so we should too!"
  (But your 50-person company doesn't have Spotify's problems.)

  Fix:
  - Start with your pain points, not someone else's solution
  - Right-size the platform to your org
  - 50-person company: shared CI templates + simple docs
  - 500-person company: full portal + self-service infra
  - 5000-person company: multi-cloud platform org
```

### 8. The No Feedback Anti-Pattern

```
  ANTI-PATTERN: Build the platform without structured feedback loops.

  Platform team: "We shipped 12 features this quarter!"
  Developers: "None of those were what we needed."

  Fix:
  - Quarterly developer surveys
  - Monthly office hours
  - Weekly Slack engagement
  - Adoption metrics per capability
  - "Was this useful?" prompts in tooling
```

### 9. The Underfunded Platform Anti-Pattern

```
  ANTI-PATTERN: Start a platform team with 1-2 people who
  also do ops, SRE, and security.

  Fix:
  - Minimum viable platform team: 3-4 dedicated engineers
  - Platform is their full-time job, not a side project
  - Include time for support, docs, and developer research
  - Scale team as platform scope grows
```

### 10. The Stale Platform Anti-Pattern

```
  ANTI-PATTERN: Build the platform and stop maintaining it.
  Templates get outdated. Documentation rots. Dependencies
  accumulate vulnerabilities.

  Fix:
  - Automated dependency updates (Dependabot/Renovate)
  - Template freshness monitoring
  - Documentation staleness alerts (>90 days unchanged)
  - Quarterly "maintenance sprint" for platform hygiene
  - Treat the platform like production: on-call, SLOs, incident response
```

---

## Decision Framework

When evaluating whether to add something to the platform, ask:

```
  +------------------------------------------------------------------+
  | SHOULD THIS BE A PLATFORM CAPABILITY?                            |
  +------------------------------------------------------------------+
  |                                                                  |
  | 1. Do 3+ teams need this?                    YES -> continue     |
  |                                               NO  -> don't build |
  |                                                                  |
  | 2. Is it causing duplicated effort?           YES -> continue     |
  |                                               NO  -> reconsider  |
  |                                                                  |
  | 3. Does a good OSS/commercial tool exist?     YES -> curate it   |
  |                                               NO  -> maybe build |
  |                                                                  |
  | 4. Can you maintain it long-term?             YES -> continue     |
  |                                               NO  -> don't build |
  |                                                                  |
  | 5. Will developers voluntarily adopt it?      YES -> build it    |
  |                                               NO  -> reconsider  |
  +------------------------------------------------------------------+
```
