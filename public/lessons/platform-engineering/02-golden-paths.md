# Lesson 02: Golden Paths

## The Airport Analogy

You land at a well-designed airport. There are signs everywhere. Lines painted
on the floor guide you to baggage claim. Screens show which carousel has your
bags. You don't need a map — the path is obvious.

Now imagine an airport with no signs. No lines. Fifty unmarked doors. You
eventually find your bags, but it takes 40 minutes and you accidentally
walked through a restricted area.

Golden paths are the well-signed airport. They're the recommended, well-lit,
paved way to accomplish common tasks. Developers can leave the path if they
need to — but the path handles 90% of cases with minimal friction.

```
  THE GOLDEN PATH CONCEPT:

  Start                                                    Production
    |                                                          |
    |   Golden Path (paved, lit, signed)                       |
    |   ====================================================   |
    |   || scaffold -> build -> test -> deploy -> observe ||   |
    |   ====================================================   |
    |                                                          |
    |   Off-road (possible but harder)                         |
    |   ....................................................   |
    |   .. custom build .. manual infra .. hand-rolled CI ..   |
    |   ....................................................   |
    |                                                          |
    v                                                          v
  "I have an idea"                                 "It's running in prod"
```

## What Makes a Golden Path

A golden path is not a mandate. It's not a locked-down process that teams
must follow. It's the path of least resistance that happens to lead to
production-grade outcomes.

Good golden paths share these properties:

**Opinionated but not rigid.** The path makes strong default choices (language,
framework, deployment strategy) but allows overrides when justified.

**Self-service.** A developer can follow the path without filing tickets or
waiting for approvals.

**End-to-end.** The path covers the full lifecycle — from creating a service
to monitoring it in production. A path that stops at deployment is half a path.

**Documented.** Every step is documented. Every choice is explained. Not just
"how" but "why."

**Maintained.** Golden paths rot if nobody maintains them. Dependencies get
outdated. Patterns change. Someone must own the path.

```
  ANATOMY OF A GOLDEN PATH:

  +-------------------------------------------------------------------+
  |                     "New Go Microservice"                         |
  +-------------------------------------------------------------------+
  |                                                                   |
  |  1. SCAFFOLD          2. DEVELOP           3. BUILD              |
  |  +--------------+     +--------------+     +--------------+      |
  |  | backstage    |     | local dev    |     | shared CI    |      |
  |  | template     |---->| with docker  |---->| pipeline     |      |
  |  | creates repo |     | compose      |     | runs tests   |      |
  |  | w/ structure |     | hot reload   |     | builds image |      |
  |  +--------------+     +--------------+     +--------------+      |
  |                                                                   |
  |  4. DEPLOY            5. CONFIGURE         6. OBSERVE            |
  |  +--------------+     +--------------+     +--------------+      |
  |  | ArgoCD syncs |     | secrets from |     | auto-instru- |      |
  |  | from GitOps  |---->| Vault via    |---->| mented traces|      |
  |  | repo         |     | sidecar      |     | std dashboard|      |
  |  +--------------+     +--------------+     +--------------+      |
  |                                                                   |
  +-------------------------------------------------------------------+
```

## Reducing Cognitive Load

The concept of cognitive load comes from cognitive psychology, but it maps
perfectly to software engineering. There are three types:

**Intrinsic cognitive load** — the inherent complexity of the problem domain.
Building a recommendation engine is inherently complex. You can't reduce this.

**Extraneous cognitive load** — complexity from the tools and processes. Writing
Helm charts, debugging Terraform state, configuring Prometheus scrapers. This
has nothing to do with your product. You want to minimize this.

**Germane cognitive load** — the effort of learning and integrating new
knowledge. This is productive load — you want to preserve it.

```
  COGNITIVE LOAD TYPES:

  +------------------------------------------------------------------+
  |                                                                  |
  |  INTRINSIC (keep)         EXTRANEOUS (reduce)   GERMANE (keep)   |
  |  +----------------+       +----------------+    +-------------+  |
  |  | Domain logic   |       | Helm charts    |    | Learning    |  |
  |  | Business rules |       | Terraform      |    | new domain  |  |
  |  | Data modeling  |       | CI config      |    | concepts    |  |
  |  | Algorithms     |       | K8s manifests  |    | New APIs    |  |
  |  | Architecture   |       | Monitoring     |    | Patterns    |  |
  |  | decisions      |       | setup          |    |             |  |
  |  +----------------+       +----------------+    +-------------+  |
  |                                  |                               |
  |                           PLATFORM ABSORBS                       |
  |                           THIS BURDEN                            |
  +------------------------------------------------------------------+
```

Golden paths reduce extraneous cognitive load. A developer building a payment
service shouldn't need to understand Kubernetes node affinity rules. They
should specify "I need a service that handles 1000 req/s" and the platform
figures out the rest.

## Opinionated Defaults

The hardest part of golden paths is choosing the defaults. Every choice you
make reduces options — that's the point. But choose wrong and you'll fight
the defaults forever.

### Principles for Choosing Defaults

**Optimize for the 80%.** Your golden path should handle 80% of use cases
brilliantly. The other 20% get escape hatches.

**Make the secure thing the easy thing.** If your default template includes
security headers, TLS, and input validation, teams don't have to think about
security — they get it for free.

**Make the observable thing the easy thing.** If every template ships with
structured logging and trace propagation, observability is automatic.

**Choose boring technology for the path.** The golden path should use proven,
well-understood tools. Save experiments for off-path projects.

Here's an example of opinionated defaults for a Go microservice golden path:

```yaml
golden_path_defaults:
  language: "go"
  version: "1.22"
  framework: "gin"
  rationale: "Most teams already use Go. Gin is simple and fast."

  deployment:
    target: "kubernetes"
    strategy: "rolling-update"
    min_replicas: 2
    max_replicas: 10
    rationale: "K8s is our standard. Rolling updates are safe for stateless services."

  ci_cd:
    provider: "github-actions"
    pipeline: "shared-go-pipeline"
    stages:
      - lint
      - test
      - security-scan
      - build-image
      - deploy-staging
      - integration-test
      - deploy-production
    rationale: "Shared pipeline ensures consistent quality gates."

  observability:
    tracing: "opentelemetry"
    metrics: "prometheus"
    logging: "structured-json"
    dashboard: "auto-generated-grafana"
    rationale: "OpenTelemetry is vendor-neutral. JSON logs are machine-parseable."

  secrets:
    provider: "vault"
    injection: "sidecar"
    rotation: "automatic-30d"
    rationale: "No secrets in env vars or config files."

  database:
    default: "postgresql"
    provisioning: "self-service-crossplane"
    rationale: "PostgreSQL covers most use cases. Crossplane for GitOps provisioning."
```

## Self-Service: The Non-Negotiable

A golden path that requires filing a Jira ticket isn't a golden path — it's
a gated path. Self-service is the defining feature.

```
  SELF-SERVICE SPECTRUM:

  Worst                                                          Best
  |                                                                |
  |  File a      Wait for     Run a CLI    Click a      Auto-     |
  |  ticket      approval     command      button in    provisioned|
  |  and wait    then manual  that calls   portal       at service |
  |  3 days      process      platform API              creation   |
  |                                                                |
  v                                                                v
  "I need a     "Approved,   "db create   [Create DB]  "Your new
   database"     give us a    --type pg    [Size: S]    service
                 week"        --size sm"   [Go!]        already has
                                                        a database"
```

Aim for the rightmost position wherever possible. The best golden paths
don't just make things easy — they make things automatic.

### Self-Service Example: Database Provisioning

Instead of a ticket that says "please create me a PostgreSQL database," the
developer adds a resource to their application manifest:

```yaml
apiVersion: platform.company.com/v1
kind: Database
metadata:
  name: payments-db
  namespace: payments-team
spec:
  engine: postgresql
  version: "15"
  size: small
  backup:
    enabled: true
    retention: 30d
  monitoring:
    enabled: true
```

The platform controller sees this, provisions the database via Crossplane,
creates the connection secret in Vault, sets up backup schedules, configures
monitoring, and writes the connection string to the application's secret
store. The developer never files a ticket.

## Templates and Scaffolding

Templates are the entry point to your golden path. When a developer decides
to build a new service, the template creates the entire starting point.

### What a Good Template Includes

```
  SERVICE TEMPLATE OUTPUT:

  my-new-service/
  ├── .github/
  │   └── workflows/
  │       └── ci.yaml              # Pre-configured CI pipeline
  ├── cmd/
  │   └── server/
  │       └── main.go              # Entrypoint with graceful shutdown
  ├── internal/
  │   ├── handler/
  │   │   └── health.go            # Health check endpoints
  │   ├── middleware/
  │   │   ├── logging.go           # Structured logging middleware
  │   │   ├── tracing.go           # OpenTelemetry middleware
  │   │   └── metrics.go           # Prometheus metrics middleware
  │   └── config/
  │       └── config.go            # Typed configuration loading
  ├── deploy/
  │   ├── base/
  │   │   ├── deployment.yaml      # K8s deployment
  │   │   ├── service.yaml         # K8s service
  │   │   └── kustomization.yaml   # Kustomize base
  │   └── overlays/
  │       ├── staging/
  │       └── production/
  ├── Dockerfile                   # Multi-stage, distroless
  ├── docker-compose.yaml          # Local dev with deps
  ├── Makefile                     # Common tasks
  ├── go.mod
  └── catalog-info.yaml            # Backstage registration
```

Notice what's included: CI pipeline, health checks, observability middleware,
Kubernetes manifests, local development setup, and Backstage registration.
The developer writes zero boilerplate — they start writing business logic
immediately.

### Template Implementation with Backstage

Backstage (covered in depth in lesson 03) uses a template definition to
scaffold new services:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: go-microservice
  title: Go Microservice
  description: Create a production-ready Go microservice with all platform integrations
  tags:
    - go
    - microservice
    - recommended
spec:
  owner: platform-team
  type: service

  parameters:
    - title: Service Details
      required:
        - name
        - owner
        - description
      properties:
        name:
          title: Service Name
          type: string
          pattern: '^[a-z][a-z0-9-]*$'
          maxLength: 40
        owner:
          title: Owner Team
          type: string
          ui:field: OwnerPicker
        description:
          title: Description
          type: string
          maxLength: 200

    - title: Infrastructure
      properties:
        database:
          title: Database
          type: string
          enum:
            - none
            - postgresql
            - redis
          default: none
        queue:
          title: Message Queue
          type: string
          enum:
            - none
            - rabbitmq
            - kafka
          default: none

  steps:
    - id: fetch-template
      name: Fetch Template
      action: fetch:template
      input:
        url: ./skeleton
        values:
          name: ${{ parameters.name }}
          owner: ${{ parameters.owner }}
          description: ${{ parameters.description }}
          database: ${{ parameters.database }}
          queue: ${{ parameters.queue }}

    - id: create-repo
      name: Create Repository
      action: publish:github
      input:
        repoUrl: github.com?owner=myorg&repo=${{ parameters.name }}
        defaultBranch: main

    - id: register-component
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps['create-repo'].output.repoContentsUrl }}
        catalogInfoPath: /catalog-info.yaml

    - id: create-argocd-app
      name: Setup GitOps Deployment
      action: argocd:create-application
      input:
        appName: ${{ parameters.name }}
        repoUrl: ${{ steps['create-repo'].output.remoteUrl }}
        path: deploy/overlays/staging
```

When a developer runs this template, they get: a GitHub repo with all the
code, a Backstage catalog entry, and an ArgoCD application for GitOps
deployment. Five minutes, zero tickets.

## Balancing Flexibility and Standardization

The biggest tension in golden paths: too rigid and teams rebel, too flexible
and you get chaos.

```
  THE FLEXIBILITY SPECTRUM:

  Total Lockdown                                      Total Freedom
  |                                                          |
  |  "You must use           "Here's a great       "Do      |
  |   this exact              default. Override      whatever |
  |   stack with              it if you need         you      |
  |   no changes."            to, but document       want."   |
  |                           why."                           |
  |                                                          |
  |  Problems:                Sweet Spot:            Problems:|
  |  - Rebellion              - High adoption        - Chaos  |
  |  - Shadow IT              - Consistent but       - No     |
  |  - Edge cases             flexible                stds   |
  |    can't be               - Escape hatches       - Can't  |
  |    served                   available              debug  |
  |                                                   others |
```

### The Escape Hatch Pattern

Every golden path needs escape hatches — documented ways to deviate. The key
is making deviation visible, not impossible.

```yaml
apiVersion: platform.company.com/v1
kind: ServiceOverride
metadata:
  name: payments-service-override
  annotations:
    platform.company.com/override-reason: "Need GPU nodes for ML model serving"
    platform.company.com/approved-by: "platform-team"
    platform.company.com/review-date: "2025-06-01"
spec:
  service: payments-ml-scorer
  overrides:
    - path: deployment.nodeSelector
      value:
        gpu: "true"
    - path: deployment.resources.limits.nvidia.com/gpu
      value: "1"
```

This override is:
- **Documented** — there's a reason field
- **Approved** — someone from the platform team reviewed it
- **Temporary** — there's a review date to revisit
- **Visible** — it's in version control, not a hidden config change

### Graduated Flexibility

Another pattern: offer multiple tiers of the golden path.

```
  GRADUATED FLEXIBILITY:

  TIER 1: "Just works" (most teams)
  +----------------------------------------------------------+
  | Use the standard template exactly as-is. All defaults.    |
  | Fastest to start. Least to maintain.                      |
  +----------------------------------------------------------+

  TIER 2: "Configurable" (some teams)
  +----------------------------------------------------------+
  | Use the template but override specific settings:          |
  | custom resource limits, extra middleware, different DB.    |
  | Still on the platform, still supported.                   |
  +----------------------------------------------------------+

  TIER 3: "Custom" (rare, approved)
  +----------------------------------------------------------+
  | Write your own manifests, bring your own CI.              |
  | Must still register in service catalog.                   |
  | Must still emit standard metrics/traces.                  |
  | Platform team assists but doesn't own.                    |
  +----------------------------------------------------------+
```

Most teams should be at Tier 1. If more than 30% of teams are at Tier 3,
your golden path isn't solving the right problems.

## Measuring Golden Path Effectiveness

```
  Key Metrics:

  +-----------------------------------+----------------------------+
  | Metric                            | Target                     |
  +-----------------------------------+----------------------------+
  | Template usage for new services   | > 90%                      |
  | Time from template to production  | < 1 hour                   |
  | Teams at Tier 1 (standard)        | > 60%                      |
  | Teams at Tier 3 (custom)          | < 15%                      |
  | Golden path NPS score             | > +30                      |
  | Override requests per quarter     | Trending down              |
  +-----------------------------------+----------------------------+
```

If override requests are trending up, the golden path is missing use cases.
If template usage is low, the path isn't solving real problems. If time to
production is high, there's friction in the steps.

## Exercises

1. **Map your current paths.** Draw the actual steps a developer takes to go
   from "new service idea" to "running in production" at your organization.
   Identify every manual step, every ticket, every wait.

2. **Design a golden path.** Pick the most common type of service your
   organization builds. Design a golden path template that covers the full
   lifecycle. What opinionated defaults would you choose?

3. **Escape hatch inventory.** List five scenarios where a team might
   legitimately need to deviate from your golden path. For each, design an
   escape hatch that keeps the deviation visible and documented.

4. **Template audit.** If your organization already has templates, evaluate
   them: Do they cover the full lifecycle? Are they maintained? Do they
   include observability and security by default?
