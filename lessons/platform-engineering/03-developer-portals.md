# Lesson 03: Developer Portals

## The Shopping Mall Analogy

Imagine a city with 200 shops scattered across 50 neighborhoods. No directory.
No map. Want a specific shoe store? Ask around. Need to know their hours?
Drive over and check the door.

Now imagine a shopping mall. Directory at every entrance. Every shop in one
building. Hours posted. Reviews available. You walk in knowing exactly where
to go.

A developer portal is the mall directory for your engineering organization.
It answers: "What services do we have? Who owns them? Are they healthy?
Where's the documentation? How do I create a new one?"

```
  WITHOUT A DEVELOPER PORTAL:

  Developer: "Where's the user-auth service?"
  Slack search... Wiki search... GitHub search...
  30 minutes later: found a README from 2022 (outdated)

  Developer: "Who owns the billing API?"
  Slack: "Anyone know who owns billing?"
  Reply: "Try asking #platform" -> "Try asking #billing-team" ->
         "I think Sarah's team, but she left"

  WITH A DEVELOPER PORTAL:

  Developer: opens portal, searches "user-auth"
  Result: owner, docs, API spec, health status, dependencies, on-call
  Time: 15 seconds
```

## Backstage by Spotify

Backstage is the leading open-source developer portal framework. Spotify
built it internally, then open-sourced it in 2020. It's now a CNCF
Incubating project with a large ecosystem.

Backstage isn't a product you install — it's a framework you build on. Out
of the box it gives you a service catalog, software templates, and
documentation aggregation. You extend it with plugins for your specific
tools.

```
  BACKSTAGE ARCHITECTURE:

  +================================================================+
  |                      BACKSTAGE FRONTEND                         |
  |  React SPA with plugin-based UI                                |
  +================================================================+
       |              |              |              |
       v              v              v              v
  +---------+   +-----------+  +-----------+  +-----------+
  | Catalog |   | Templates |  | TechDocs  |  | Plugins   |
  | Plugin  |   | Plugin    |  | Plugin    |  | (custom)  |
  +---------+   +-----------+  +-----------+  +-----------+
       |              |              |              |
       v              v              v              v
  +================================================================+
  |                      BACKSTAGE BACKEND                          |
  |  Node.js with plugin-based API routes                          |
  +================================================================+
       |              |              |              |
       v              v              v              v
  +---------+   +-----------+  +-----------+  +-----------+
  | Service |   | GitHub    |  | Markdown  |  | ArgoCD    |
  | Catalog |   | API       |  | in repos  |  | Crossplane|
  | (DB)    |   |           |  |           |  | PagerDuty |
  +---------+   +-----------+  +-----------+  +-----------+
```

### Setting Up Backstage

```bash
npx @backstage/create-app@latest
```

This scaffolds a full Backstage application. The key configuration is
`app-config.yaml`:

```yaml
app:
  title: Acme Developer Portal
  baseUrl: http://localhost:3000

organization:
  name: Acme Corp

backend:
  baseUrl: http://localhost:7007
  database:
    client: pg
    connection:
      host: localhost
      port: 5432
      user: backstage
      password: ${POSTGRES_PASSWORD}

catalog:
  import:
    entityFilename: catalog-info.yaml
  rules:
    - allow: [Component, System, API, Resource, Location, Template]
  locations:
    - type: url
      target: https://github.com/acme/backstage-catalog/blob/main/all.yaml
    - type: url
      target: https://github.com/acme/software-templates/blob/main/all-templates.yaml

techdocs:
  builder: external
  generator:
    runIn: local
  publisher:
    type: awsS3
    awsS3:
      bucketName: acme-techdocs

auth:
  providers:
    github:
      development:
        clientId: ${GITHUB_CLIENT_ID}
        clientSecret: ${GITHUB_CLIENT_SECRET}
```

## The Service Catalog

The service catalog is the heart of a developer portal. It's a live inventory
of every piece of software in your organization — services, libraries,
websites, data pipelines, infrastructure components.

```
  SERVICE CATALOG DATA MODEL:

  +----------+     owns      +----------+
  |  Group   |-------------->| Component|
  | (team)   |     1:many    | (service)|
  +----------+               +----------+
       |                          |
       |                     provides/consumes
       |                          |
       v                          v
  +----------+               +----------+
  |  User    |               |   API    |
  | (person) |               | (spec)   |
  +----------+               +----------+
                                  |
                             depends on
                                  |
                                  v
                             +----------+
                             | Resource |
                             | (infra)  |
                             +----------+

  Grouping:
  +---------+     contains    +----------+
  | System  |--------------->| Component|
  | (domain)|     1:many     | + API    |
  +---------+                | + Resource|
                             +----------+
```

### Catalog Entity Definition

Every service registers itself with a `catalog-info.yaml` file in its repo:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payments-service
  description: Processes credit card and ACH payments
  annotations:
    backstage.io/techdocs-ref: dir:.
    github.com/project-slug: acme/payments-service
    pagerduty.com/service-id: P1234AB
    argocd/app-name: payments-service
    grafana/dashboard-selector: payments
    sonarqube.org/project-key: acme_payments-service
  tags:
    - go
    - grpc
    - payments
  links:
    - url: https://grafana.internal/d/payments
      title: Grafana Dashboard
    - url: https://runbooks.internal/payments
      title: Runbook
spec:
  type: service
  lifecycle: production
  owner: team-payments
  system: payment-processing
  providesApis:
    - payments-grpc-api
    - payments-rest-api
  consumesApis:
    - user-service-api
    - fraud-detection-api
  dependsOn:
    - resource:payments-postgresql
    - resource:payments-redis
```

This single file connects the service to its team, APIs, infrastructure,
monitoring, deployment, and documentation. When someone finds this service
in the catalog, they see everything at a glance.

### API Entity Definition

APIs get their own catalog entries with embedded specifications:

```yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: payments-rest-api
  description: REST API for payment processing
spec:
  type: openapi
  lifecycle: production
  owner: team-payments
  system: payment-processing
  definition:
    $text: ./api/openapi.yaml
```

## Documentation Aggregation

Most organizations have documentation scattered across wikis, READMEs,
Confluence, Google Docs, and Notion. A developer portal aggregates it.

Backstage's TechDocs renders Markdown documentation from your service repos
and serves it alongside the service catalog. Documentation lives next to
the code — not in a separate wiki that gets stale.

```
  DOCUMENTATION FLOW:

  Service Repo                    Backstage TechDocs
  +------------------+           +------------------+
  | payments-service/|  build &  | Portal shows     |
  | docs/            |  publish  | rendered docs    |
  |   index.md       |---------->| alongside the    |
  |   architecture.md|           | service catalog  |
  |   runbook.md     |           | entry            |
  |   mkdocs.yml     |           |                  |
  +------------------+           +------------------+
```

### TechDocs Configuration

In the service repo, add `mkdocs.yml`:

```yaml
site_name: Payments Service
nav:
  - Home: index.md
  - Architecture: architecture.md
  - API Reference: api-reference.md
  - Runbook: runbook.md
  - ADRs:
      - ADR-001 - Choose PostgreSQL: adrs/001-choose-postgresql.md
      - ADR-002 - gRPC for internal: adrs/002-grpc-internal.md

plugins:
  - techdocs-core
```

CI pipeline step to publish docs:

```yaml
- name: Publish TechDocs
  run: |
    npx @techdocs/cli generate --no-docker
    npx @techdocs/cli publish \
      --publisher-type awsS3 \
      --storage-name acme-techdocs \
      --entity default/component/payments-service
```

Now the documentation is searchable, versioned, and always colocated with
the service it describes.

## API Discovery

In a large organization, knowing what APIs exist is a genuine challenge. The
developer portal serves as the API marketplace.

```
  API DISCOVERY IN THE PORTAL:

  +----------------------------------------------------------------+
  |  Search: "payment"                                    [Search] |
  +----------------------------------------------------------------+
  |                                                                |
  |  APIS (3 results)                                              |
  |                                                                |
  |  +-----------------------------------------------------------+|
  |  | payments-rest-api                          [OpenAPI Spec]  ||
  |  | Owner: team-payments | Type: REST | Lifecycle: production  ||
  |  | "Process credit card and ACH payments"                     ||
  |  | Consumers: checkout-service, subscription-service          ||
  |  +-----------------------------------------------------------+|
  |                                                                |
  |  +-----------------------------------------------------------+|
  |  | payments-grpc-api                          [Protobuf Spec] ||
  |  | Owner: team-payments | Type: gRPC | Lifecycle: production  ||
  |  | "Internal payment processing API"                          ||
  |  | Consumers: billing-service                                 ||
  |  +-----------------------------------------------------------+|
  |                                                                |
  |  +-----------------------------------------------------------+|
  |  | payment-events                             [AsyncAPI Spec] ||
  |  | Owner: team-payments | Type: async | Lifecycle: production ||
  |  | "Payment lifecycle events on Kafka"                        ||
  |  | Consumers: analytics, notifications                        ||
  |  +-----------------------------------------------------------+|
  +----------------------------------------------------------------+
```

Each API entry shows:
- The specification (OpenAPI, gRPC protobuf, AsyncAPI)
- Who owns it
- Who consumes it
- Its lifecycle stage (experimental, production, deprecated)
- How to get access

This prevents the common problem of teams building duplicate APIs because
they didn't know an existing one covered their use case.

## Software Templates

We covered templates in lesson 02, but the portal is where developers
interact with them. Backstage's scaffolder plugin provides a UI for
discovering and running templates.

```
  TEMPLATE GALLERY IN THE PORTAL:

  +----------------------------------------------------------------+
  |  Create a new component                                        |
  +----------------------------------------------------------------+
  |                                                                |
  |  +---------------------------+  +---------------------------+  |
  |  | [star] Go Microservice    |  | [star] React Frontend     |  |
  |  | Production-ready Go svc   |  | Next.js app with SSR      |  |
  |  | with CI/CD, monitoring,   |  | CI/CD, CDN deploy,        |  |
  |  | and K8s deployment        |  | feature flags              |  |
  |  | Owner: platform-team      |  | Owner: platform-team      |  |
  |  | [Choose]                  |  | [Choose]                  |  |
  |  +---------------------------+  +---------------------------+  |
  |                                                                |
  |  +---------------------------+  +---------------------------+  |
  |  | Python Data Pipeline      |  | Kafka Consumer            |  |
  |  | Airflow DAG with          |  | Event consumer with       |  |
  |  | data quality checks,      |  | dead letter queue,        |  |
  |  | schema validation         |  | retry logic, monitoring   |  |
  |  | Owner: data-platform      |  | Owner: platform-team      |  |
  |  | [Choose]                  |  | [Choose]                  |  |
  |  +---------------------------+  +---------------------------+  |
  +----------------------------------------------------------------+
```

Templates are versioned. When the platform team updates a template (say,
upgrades from Go 1.21 to 1.22), new services get the latest. Existing
services can opt in to upgrades.

## Tech Radar Integration

A tech radar shows which technologies your organization recommends, tolerates,
or is phasing out. Embedding it in the developer portal makes technology
decisions visible.

```
  TECH RADAR RINGS:

  +---------------------------------------------+
  |                                             |
  |              HOLD (phase out)               |
  |         +---------------------------+       |
  |         |      ASSESS (evaluate)    |       |
  |         |   +-------------------+   |       |
  |         |   |   TRIAL (try it)  |   |       |
  |         |   | +-------------+   |   |       |
  |         |   | |   ADOPT     |   |   |       |
  |         |   | | (recommend) |   |   |       |
  |         |   | |             |   |   |       |
  |         |   | | Go, React   |   |   |       |
  |         |   | | PostgreSQL  |   |   |       |
  |         |   | | ArgoCD      |   |   |       |
  |         |   | +-------------+   |   |       |
  |         |   | Rust, Svelte      |   |       |
  |         |   | CockroachDB       |   |       |
  |         |   +-------------------+   |       |
  |         | Deno, WASM                |       |
  |         | Pulumi                    |       |
  |         +---------------------------+       |
  |  Jenkins, Angular.js                        |
  |  MongoDB (for new projects)                 |
  +---------------------------------------------+
```

### Tech Radar Configuration

```yaml
apiVersion: backstage.io/v1alpha1
kind: TechRadar
metadata:
  name: acme-tech-radar
spec:
  rings:
    - id: adopt
      name: Adopt
      description: Technologies we actively recommend
      color: "#5BA300"
    - id: trial
      name: Trial
      description: Worth trying on non-critical projects
      color: "#009EB0"
    - id: assess
      name: Assess
      description: Exploring — not for production yet
      color: "#C7BA00"
    - id: hold
      name: Hold
      description: Do not start new projects with these
      color: "#E09B96"

  quadrants:
    - id: languages
      name: Languages & Frameworks
    - id: infrastructure
      name: Infrastructure
    - id: data
      name: Data Management
    - id: tools
      name: Tools & Processes

  entries:
    - id: go
      title: Go
      quadrant: languages
      ring: adopt
      description: Primary language for backend services
      moved: 0

    - id: rust
      title: Rust
      quadrant: languages
      ring: trial
      description: Evaluating for performance-critical services
      moved: 1

    - id: argocd
      title: ArgoCD
      quadrant: infrastructure
      ring: adopt
      description: Standard GitOps deployment tool
      moved: 0

    - id: jenkins
      title: Jenkins
      quadrant: tools
      ring: hold
      description: Migrating to GitHub Actions
      moved: -1
```

The tech radar connects to the service catalog — when someone creates a
service using a "hold" technology, the portal can flag it. Not block it,
but make the choice visible.

## Building an Effective Portal

A portal that nobody uses is worse than no portal — it creates the illusion
of documentation while being stale. Here's how to build one that sticks.

### Start with the Catalog

Don't try to build everything at once. Start with the service catalog.
Getting every service registered with owner, description, and lifecycle is
the foundation everything else builds on.

### Automate Registration

Manual registration dies. Automate it:

```yaml
name: Register in Backstage
on:
  push:
    branches: [main]
    paths: [catalog-info.yaml]

jobs:
  register:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate catalog-info.yaml
        run: |
          npx @backstage/cli catalog-info validate catalog-info.yaml
      - name: Register or refresh entity
        run: |
          curl -X POST \
            "${BACKSTAGE_URL}/api/catalog/locations" \
            -H "Authorization: Bearer ${BACKSTAGE_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"type\": \"url\", \"target\": \"${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/main/catalog-info.yaml\"}"
```

### Measure Portal Usage

Track what developers actually use:

```
  PORTAL USAGE METRICS:

  +-------------------------------------------+------------------+
  | Metric                                    | Target           |
  +-------------------------------------------+------------------+
  | % of services registered in catalog       | > 95%            |
  | Weekly active users                       | > 80% of devs    |
  | Search success rate (found what needed)   | > 85%            |
  | Template usage for new services           | > 90%            |
  | Documentation freshness (< 90 days old)   | > 80% of docs    |
  | Average time to find service owner        | < 30 seconds     |
  +-------------------------------------------+------------------+
```

### Common Portal Plugins

Backstage has a rich plugin ecosystem. The most commonly used:

```
  ESSENTIAL PLUGINS:

  +--------------------+----------------------------------------+
  | Plugin             | What It Does                           |
  +--------------------+----------------------------------------+
  | Kubernetes         | Shows pod status, logs, events         |
  | ArgoCD             | Deployment status and sync state       |
  | PagerDuty          | On-call schedule, incidents            |
  | GitHub Actions     | CI/CD pipeline status                  |
  | SonarQube          | Code quality and security              |
  | Grafana            | Embedded dashboards                    |
  | Vault              | Secret management status               |
  | Cost Insights      | Cloud spend per service/team           |
  | Tech Radar         | Technology recommendations             |
  | API Docs           | OpenAPI/gRPC spec rendering            |
  +--------------------+----------------------------------------+
```

## Beyond Backstage

Backstage is the dominant open-source option, but it's not the only approach.

**Port** — A commercial developer portal with a strong data model and no-code
customization. Good if you want less custom development.

**Cortex** — Focuses on service maturity scorecards. Tells you which services
meet your standards and which don't.

**OpsLevel** — Similar to Cortex. Strong on service ownership and maturity
tracking.

**Custom-built** — Some organizations build their own portal, usually because
they have unique requirements or prefer full control.

The build-vs-buy decision depends on your team size, budget, and how custom
your needs are. Backstage requires meaningful engineering investment but
gives you full control. Commercial options trade customization for speed.

## Exercises

1. **Catalog audit.** List every service your organization runs. For each,
   can you answer: who owns it, what APIs does it provide, what does it
   depend on, where's the documentation? If you can't, that's your catalog's
   first gap.

2. **Write a catalog-info.yaml.** Pick a real service at your organization and
   write a complete `catalog-info.yaml` for it. Include all annotations,
   dependencies, and API references.

3. **Portal plugin list.** List the top 10 tools your developers use daily.
   For each, determine: does Backstage have a plugin for it? If not, what
   would a custom plugin need to show?

4. **Documentation freshness audit.** Pick 10 services at your organization.
   Check when their documentation was last updated. Calculate the percentage
   that's been updated in the last 90 days.
