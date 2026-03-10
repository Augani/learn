# Lesson 12: Design an Internal Developer Platform (Capstone)

## The Challenge

You're the founding engineer of a platform team at a company with 200
engineers across 25 teams. The company builds a B2B SaaS product. Engineers
primarily use Go and TypeScript. Everything runs on AWS and Kubernetes.

Currently, there's no platform. Every team manages their own CI/CD,
provisions their own infrastructure, configures their own monitoring, and
writes their own deployment manifests. The result is predictable:

- Time to first deploy for a new service: **5 days**
- 30% of engineering time is spent on infrastructure and operations
- Deployment frequency varies from 10/day (best team) to 1/month (worst)
- 3 major incidents per month caused by misconfigured infrastructure
- New hire onboarding takes 3 weeks before first production deployment
- 47 different Terraform modules with varying quality
- Monitoring is inconsistent — some teams use Datadog, some use Prometheus, some use nothing

Your job: design an Internal Developer Platform that fixes this.

```
  CURRENT STATE:

  25 teams × doing everything themselves = chaos

  +------+  +------+  +------+  +------+      +------+
  |Team 1|  |Team 2|  |Team 3|  |Team 4| .... |Team25|
  +------+  +------+  +------+  +------+      +------+
  |CI/CD |  |CI/CD |  |CI/CD |  |CI/CD |      |CI/CD |  (25 different setups)
  |Infra |  |Infra |  |Infra |  |Infra |      |Infra |  (47 TF modules)
  |Monitor| |Monitor| |Monitor| |Monitor|      |Monitor| (3 different tools)
  |Deploy|  |Deploy|  |Deploy|  |Deploy|      |Deploy|  (inconsistent)
  +------+  +------+  +------+  +------+      +------+

  TARGET STATE:

  25 teams × focused on product = velocity

  +------+  +------+  +------+  +------+      +------+
  |Team 1|  |Team 2|  |Team 3|  |Team 4| .... |Team25|
  +------+  +------+  +------+  +------+      +------+
  | Product code (80% of time)                        |
  +---------------------------------------------------+
       |          |          |          |          |
  +===================================================+
  |            INTERNAL DEVELOPER PLATFORM              |
  |  [CI/CD] [Infra] [Observe] [Secrets] [Portal]     |
  +===================================================+
```

## Phase 1: Foundation (Months 1-3)

Start with the highest-impact, lowest-risk capabilities. Don't try to
build everything at once.

### Service Catalog

Before you build anything else, know what you have. The service catalog is
the foundation.

```
  PHASE 1 ARCHITECTURE:

  +================================================================+
  |  Backstage Developer Portal                                     |
  |  +------------------+  +------------------+                    |
  |  | Service Catalog  |  | TechDocs         |                    |
  |  | - All 156 svcs   |  | - Docs from repos|                    |
  |  | - Owners         |  |                  |                    |
  |  | - Dependencies   |  |                  |                    |
  |  +------------------+  +------------------+                    |
  +================================================================+
```

**Action items:**

1. Deploy Backstage with PostgreSQL backend
2. Define the catalog entity schema
3. Write `catalog-info.yaml` for every service (automate where possible)
4. Set up GitHub integration for auto-discovery

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payments-service
  description: Processes credit card and ACH payments
  annotations:
    github.com/project-slug: acme/payments-service
    backstage.io/techdocs-ref: dir:.
  tags:
    - go
    - grpc
spec:
  type: service
  lifecycle: production
  owner: team-payments
  system: payment-processing
  providesApis:
    - payments-api
  consumesApis:
    - user-service-api
    - fraud-detection-api
  dependsOn:
    - resource:payments-postgresql
    - resource:payments-redis
```

### Shared CI/CD Pipeline Templates

The quickest win. Standardize what 80% of teams need.

```yaml
name: Go Service Pipeline
on:
  workflow_call:
    inputs:
      service-name:
        required: true
        type: string
      go-version:
        type: string
        default: "1.22"
    secrets:
      REGISTRY_TOKEN:
        required: true

jobs:
  quality:
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: ${{ inputs.go-version }}
      - run: golangci-lint run ./...
      - run: go test -race -coverprofile=coverage.out ./...
      - run: |
          COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
          if (( $(echo "$COVERAGE < 70" | bc -l) )); then
            echo "Coverage ${COVERAGE}% below 70%"
            exit 1
          fi

  security:
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: CRITICAL,HIGH
          exit-code: 1

  build:
    needs: [quality, security]
    runs-on: [self-hosted, linux]
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: registry.internal/${{ inputs.service-name }}
          tags: type=sha,prefix=
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: [build]
    runs-on: [self-hosted, linux]
    environment: staging
    steps:
      - uses: acme/argocd-deploy-action@v1
        with:
          app-name: ${{ inputs.service-name }}
          image-tag: ${{ needs.build.outputs.image-tag }}
          environment: staging

  deploy-production:
    needs: [deploy-staging]
    if: github.ref == 'refs/heads/main'
    runs-on: [self-hosted, linux]
    environment: production
    steps:
      - uses: acme/argocd-deploy-action@v1
        with:
          app-name: ${{ inputs.service-name }}
          image-tag: ${{ needs.build.outputs.image-tag }}
          environment: production
```

Also create a TypeScript equivalent:

```yaml
name: TypeScript Service Pipeline
on:
  workflow_call:
    inputs:
      service-name:
        required: true
        type: string
      node-version:
        type: string
        default: "20"
    secrets:
      REGISTRY_TOKEN:
        required: true

jobs:
  quality:
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage --passWithNoTests
      - run: |
          COVERAGE=$(npx istanbul-threshold-checker --threshold 70)

  security:
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: CRITICAL,HIGH
          exit-code: 1

  build:
    needs: [quality, security]
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: registry.internal/${{ inputs.service-name }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Phase 1 Success Metrics

```
  PHASE 1 TARGETS (end of month 3):

  +-------------------------------------------+--------+---------+
  | Metric                                    | Before | Target  |
  +-------------------------------------------+--------+---------+
  | Services in catalog                       | 0%     | > 80%   |
  | Teams using shared pipeline               | 0%     | > 50%   |
  | Documentation in portal                   | 0%     | > 30%   |
  | Time to deploy (shared pipeline users)    | 5 days | < 1 day |
  +-------------------------------------------+--------+---------+
```

## Phase 2: Self-Service Infrastructure (Months 4-6)

Now that teams can build and deploy, give them self-service infrastructure.

### Database Provisioning

```yaml
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xdatabases.platform.acme.com
spec:
  group: platform.acme.com
  names:
    kind: XDatabase
    plural: xdatabases
  claimNames:
    kind: Database
    plural: databases
  versions:
    - name: v1
      served: true
      referenceable: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required: [engine, tier, environment]
              properties:
                engine:
                  type: string
                  enum: [postgresql, mysql, redis]
                tier:
                  type: string
                  enum: [starter, standard, performance]
                environment:
                  type: string
                  enum: [staging, production]
```

Developer claim:

```yaml
apiVersion: platform.acme.com/v1
kind: Database
metadata:
  name: orders-db
  namespace: orders-team
spec:
  engine: postgresql
  tier: standard
  environment: production
```

### Secrets Management

Deploy Vault with Kubernetes authentication:

```yaml
apiVersion: platform.acme.com/v1
kind: VaultPolicy
metadata:
  name: orders-team-policy
spec:
  team: orders-team
  permissions:
    - path: "secret/data/orders-team/*"
      capabilities: ["create", "read", "update", "delete", "list"]
    - path: "database/creds/orders-*"
      capabilities: ["read"]
    - path: "pki/issue/orders-team"
      capabilities: ["create", "update"]
```

### Platform CLI

```go
package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

func main() {
	rootCmd := &cobra.Command{
		Use:   "platform",
		Short: "Acme Internal Developer Platform CLI",
	}

	rootCmd.AddCommand(
		newDBCommand(),
		newSecretCommand(),
		newServiceCommand(),
		newPipelineCommand(),
	)

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func newDBCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "db",
		Short: "Manage databases",
	}

	cmd.AddCommand(
		&cobra.Command{
			Use:   "create",
			Short: "Create a new database",
			RunE:  runDBCreate,
		},
		&cobra.Command{
			Use:   "list",
			Short: "List databases",
			RunE:  runDBList,
		},
		&cobra.Command{
			Use:   "status [name]",
			Short: "Show database status",
			Args:  cobra.ExactArgs(1),
			RunE:  runDBStatus,
		},
		&cobra.Command{
			Use:   "connect [name]",
			Short: "Connect to database",
			Args:  cobra.ExactArgs(1),
			RunE:  runDBConnect,
		},
	)

	return cmd
}

func newServiceCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "service",
		Short: "Manage services",
	}

	cmd.AddCommand(
		&cobra.Command{
			Use:   "create",
			Short: "Create a new service from template",
			RunE:  runServiceCreate,
		},
		&cobra.Command{
			Use:   "list",
			Short: "List services",
			RunE:  runServiceList,
		},
		&cobra.Command{
			Use:   "logs [name]",
			Short: "Tail service logs",
			Args:  cobra.ExactArgs(1),
			RunE:  runServiceLogs,
		},
	)

	return cmd
}
```

Usage:

```bash
$ platform service create
? Service name: notification-service
? Language: Go
? Template: go-microservice
? Database needed: postgresql (standard)
? Message queue needed: rabbitmq
? Owner team: notifications

Creating service notification-service...
  ✓ GitHub repository created
  ✓ CI/CD pipeline configured
  ✓ ArgoCD application created
  ✓ Database provisioning started (will be ready in ~5 min)
  ✓ RabbitMQ queue created
  ✓ Vault secrets configured
  ✓ Backstage catalog entry registered
  ✓ Grafana dashboard created

Your service is ready for development!
  Repo: https://github.com/acme/notification-service
  Portal: https://backstage.internal/catalog/default/component/notification-service
  Dashboard: https://grafana.internal/d/notification-service

Next steps:
  1. git clone git@github.com:acme/notification-service.git
  2. cd notification-service
  3. make dev  (starts local development environment)
  4. Write your first endpoint
  5. git push  (triggers CI/CD pipeline)
```

### Phase 2 Architecture

```
  PHASE 2 ARCHITECTURE:

  +================================================================+
  |  Developer Interfaces                                           |
  |  [Backstage Portal]  [Platform CLI]  [K8s CRDs]               |
  +================================================================+
       |              |              |
       v              v              v
  +================================================================+
  |  Platform Services                                              |
  |  +-----------+  +-----------+  +-----------+  +-----------+    |
  |  | CI/CD     |  | Infra     |  | Secrets   |  | Service   |    |
  |  | Templates |  | (Crossplane| | (Vault)   |  | Catalog   |    |
  |  | (GitHub)  |  |  + custom) |  |           |  | (Backstage|    |
  |  +-----------+  +-----------+  +-----------+  +-----------+    |
  +================================================================+
       |              |              |              |
       v              v              v              v
  +================================================================+
  |  Infrastructure                                                 |
  |  [AWS RDS] [ElastiCache] [SQS/RabbitMQ] [Route53] [ACM]       |
  +================================================================+
```

### Phase 2 Success Metrics

```
  PHASE 2 TARGETS (end of month 6):

  +-------------------------------------------+--------+---------+
  | Metric                                    | Before | Target  |
  +-------------------------------------------+--------+---------+
  | Self-service DB provisioning              | 0%     | > 60%   |
  | Secrets in Vault (vs env vars)            | 10%    | > 70%   |
  | Time to first deploy (new service)        | 5 days | < 1 hour|
  | Infra tickets per month                   | 200    | < 50    |
  | Platform CLI active users                 | 0      | > 100   |
  +-------------------------------------------+--------+---------+
```

## Phase 3: Observability & Golden Paths (Months 7-9)

### Auto-Instrumentation

```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: platform-instrumentation
  namespace: opentelemetry-system
spec:
  exporter:
    endpoint: http://otel-collector:4317
  propagators:
    - tracecontext
    - baggage
  sampler:
    type: parentbased_traceidratio
    argument: "0.1"
  go:
    image: ghcr.io/open-telemetry/opentelemetry-go-instrumentation/autoinstrumentation-go:latest
  nodejs:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-nodejs:latest
```

### Standard Dashboards

Auto-generated for every service in the catalog:

```jsonnet
local serviceDashboard(service) = {
  title: '%s Service Dashboard' % service.name,
  tags: ['platform', 'auto-generated', service.team],
  panels: [
    requestRatePanel(service.name),
    errorRatePanel(service.name),
    latencyPanel(service.name),
    podStatusPanel(service.namespace),
    cpuPanel(service.namespace, service.name),
    memoryPanel(service.namespace, service.name),
    dependencyPanel(service.dependencies),
    deploymentPanel(service.name),
  ],
};
```

### Golden Path Templates

Create Backstage templates for the two primary languages:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: go-microservice
  title: Go Microservice (Recommended)
  description: Production-ready Go microservice with all platform integrations
spec:
  owner: platform-team
  type: service
  parameters:
    - title: Service Details
      required: [name, owner, description]
      properties:
        name:
          title: Service Name
          type: string
          pattern: '^[a-z][a-z0-9-]{2,39}$'
        owner:
          title: Owner Team
          type: string
          ui:field: OwnerPicker
        description:
          title: Description
          type: string

    - title: Infrastructure
      properties:
        database:
          type: string
          enum: [none, postgresql, mysql]
          default: none
        cache:
          type: string
          enum: [none, redis]
          default: none
        queue:
          type: string
          enum: [none, rabbitmq, sqs]
          default: none

  steps:
    - id: scaffold
      action: fetch:template
      input:
        url: ./skeleton
        values:
          name: ${{ parameters.name }}
          owner: ${{ parameters.owner }}
          description: ${{ parameters.description }}
          database: ${{ parameters.database }}
          cache: ${{ parameters.cache }}
          queue: ${{ parameters.queue }}

    - id: publish
      action: publish:github
      input:
        repoUrl: github.com?owner=acme&repo=${{ parameters.name }}
        defaultBranch: main

    - id: register
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
        catalogInfoPath: /catalog-info.yaml

    - id: argocd
      action: argocd:create-application
      input:
        appName: ${{ parameters.name }}
        repoUrl: ${{ steps.publish.output.remoteUrl }}

    - id: database
      if: ${{ parameters.database !== 'none' }}
      action: platform:create-database
      input:
        name: ${{ parameters.name }}-db
        engine: ${{ parameters.database }}
        tier: starter

    - id: dashboard
      action: platform:create-dashboard
      input:
        serviceName: ${{ parameters.name }}
        team: ${{ parameters.owner }}
```

### Phase 3 Success Metrics

```
  PHASE 3 TARGETS (end of month 9):

  +-------------------------------------------+--------+---------+
  | Metric                                    | Before | Target  |
  +-------------------------------------------+--------+---------+
  | Services with auto-instrumentation        | 0%     | > 70%   |
  | Services with standard dashboard          | 0%     | > 70%   |
  | New services using golden path template   | 0%     | > 85%   |
  | Developer NPS                             | N/A    | > +20   |
  | DORA: Deployment frequency (org-wide)     | varies | measured|
  | DORA: Lead time for changes               | varies | measured|
  +-------------------------------------------+--------+---------+
```

## Phase 4: Maturity & Optimization (Months 10-12)

### SLO-Based Alerting

Move from threshold-based alerts to SLO-based burn rate alerts:

```yaml
groups:
  - name: service_slos
    rules:
      - record: slo:availability:ratio
        expr: |
          sum(rate(http_server_request_duration_seconds_count{http_status_code!~"5.."}[5m])) by (service_name)
          /
          sum(rate(http_server_request_duration_seconds_count[5m])) by (service_name)

      - alert: SLOBurnRateHigh
        expr: |
          (
            1 - slo:availability:ratio
          ) > (14.4 * (1 - 0.999))
        for: 5m
        labels:
          severity: critical
          window: 1h
        annotations:
          summary: "High burn rate for {{ $labels.service_name }}"
          description: "At current error rate, 30-day error budget will be exhausted in {{ humanizeDuration (divf (mulf (sub 1 0.999) 2.592e+9) (sub 1 $value)) }}"
```

### Cost Attribution Dashboard

```yaml
apiVersion: platform.acme.com/v1
kind: CostReport
metadata:
  name: monthly-cost-report
spec:
  schedule: "0 0 1 * *"
  groupBy: [team, service, resource_type]
  outputs:
    - type: backstage-dashboard
    - type: slack
      channel: "#platform-costs"
    - type: email
      recipients: ["engineering-leads@acme.com"]
```

### Tech Radar

```yaml
entries:
  - id: go
    title: Go
    quadrant: languages
    ring: adopt
  - id: typescript
    title: TypeScript
    quadrant: languages
    ring: adopt
  - id: python
    title: Python
    quadrant: languages
    ring: trial
    description: "For data/ML workloads"
  - id: argocd
    title: ArgoCD
    quadrant: tools
    ring: adopt
  - id: crossplane
    title: Crossplane
    quadrant: infrastructure
    ring: adopt
  - id: terraform
    title: Terraform (direct)
    quadrant: infrastructure
    ring: hold
    description: "Use Crossplane claims instead"
```

## Complete Platform Architecture

```
  COMPLETE IDP ARCHITECTURE (Month 12):

  +================================================================+
  |  DEVELOPER INTERFACES                                           |
  |                                                                |
  |  +--------+  +---------+  +--------+  +---------+  +--------+ |
  |  | Portal |  | CLI     |  | GitOps |  | K8s API |  | Slack  | |
  |  | (Back- |  | (plat-  |  | (Git   |  | (CRDs)  |  | Bot    | |
  |  |  stage)|  |  form)  |  |  push) |  |         |  |        | |
  |  +--------+  +---------+  +--------+  +---------+  +--------+ |
  +================================================================+
                              |
                              v
  +================================================================+
  |  PLATFORM CONTROL PLANE                                         |
  |                                                                |
  |  +----------+  +----------+  +----------+  +----------+       |
  |  | Service  |  | Template |  | Policy   |  | Cost     |       |
  |  | Catalog  |  | Engine   |  | Engine   |  | Engine   |       |
  |  +----------+  +----------+  +----------+  +----------+       |
  +================================================================+
                              |
                              v
  +================================================================+
  |  PLATFORM SERVICES                                              |
  |                                                                |
  |  +---------+ +---------+ +---------+ +---------+ +---------+  |
  |  | CI/CD   | | Infra   | | Secrets | | Observe | | Data    |  |
  |  | Pipelines| | Crossplane| | Vault   | | OTel +  | | DBaaS  |  |
  |  | GitHub  | | Operators| | mTLS   | | Grafana | | Backup |  |
  |  | Actions | |         | |        | | Loki   | |        |  |
  |  +---------+ +---------+ +---------+ +---------+ +---------+  |
  +================================================================+
                              |
                              v
  +================================================================+
  |  INFRASTRUCTURE                                                 |
  |  [Kubernetes]  [AWS]  [GitHub]  [Container Registry]           |
  +================================================================+
```

## 12-Month Success Metrics

```
  PLATFORM SUCCESS AT MONTH 12:

  +-------------------------------------------+---------+---------+
  | Metric                                    | Before  | After   |
  +-------------------------------------------+---------+---------+
  | Time to first deploy                      | 5 days  | 47 min  |
  | Deployment frequency (org-wide)           | ~20/day | ~95/day |
  | Lead time for changes                     | 5 days  | 2.3 hrs |
  | Change failure rate                       | 18%     | 8%      |
  | MTTR                                      | 4 hours | 38 min  |
  | Self-service rate (infra requests)        | 5%      | 82%     |
  | Developer NPS                             | N/A     | +35     |
  | % engineering time on infra/ops           | 30%     | 10%     |
  | New hire time to first deploy             | 3 weeks | 2 days  |
  | Services in catalog                       | 0       | 156     |
  | Platform team size                        | 0       | 5       |
  +-------------------------------------------+---------+---------+
```

## Your Capstone Deliverables

Design your own IDP. Produce the following:

1. **Architecture diagram.** Show all platform components, how they connect,
   and how developers interact with them.

2. **Phased roadmap.** Break the build into 3-4 phases. Each phase should
   deliver standalone value. Include timeline, resources, and success
   metrics.

3. **Golden path template.** Design a complete service template for your
   primary language. Include: repo structure, CI/CD pipeline, Kubernetes
   manifests, observability configuration, and Backstage registration.

4. **Platform API specification.** Write an OpenAPI spec for at least three
   platform APIs: database provisioning, secret management, and service
   creation.

5. **Measurement plan.** Define the metrics you'll track: DORA metrics,
   developer NPS, adoption rates, cost attribution, and platform SLOs.
   Include targets for each phase.

6. **Team topology.** Define how your platform team will be structured,
   how it will interact with stream-aligned teams (collaboration,
   facilitating, X-as-a-Service), and how you'll manage stakeholders.

7. **Migration plan.** Design the strategy for migrating 25 existing teams
   from their current setup to the new platform. How do you earn adoption
   without mandating it?

This capstone integrates everything from the entire track. Take your time.
A well-designed platform is worth more than a quickly built one.
