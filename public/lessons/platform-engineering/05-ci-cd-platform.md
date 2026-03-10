# Lesson 05: CI/CD as a Platform Service

## The Factory Assembly Line Analogy

In the early days of manufacturing, every workshop built products from scratch.
Each craftsman had their own tools, their own process, their own quality
standards. Quality varied wildly.

Then came the assembly line. Standardized stations. Consistent quality checks.
Interchangeable parts. Individual workers still applied skill and judgment —
but the process was reliable, repeatable, and visible.

CI/CD as a platform service is the assembly line for software. Product teams
still write the code. But the build, test, security scan, package, and
deploy steps are standardized, shared, and maintained by the platform team.

```
  BEFORE: Each Team Maintains Their Own Pipeline

  Team A: [lint]--[test]--[build]--[push]--[deploy]    (Jenkins, custom)
  Team B: [test]--[build]--[push]--[deploy]            (GitHub Actions, no lint)
  Team C: [build]--[deploy]                            (shell scripts, no tests)
  Team D: [lint]--[test]--[scan]--[build]--[push]--[deploy] (CircleCI, thorough)

  AFTER: Shared Pipeline Templates

                    +----------------------------------+
                    |    CI/CD Platform Service         |
                    |  [Standard Pipeline Templates]    |
                    +----------------------------------+
                         |       |       |       |
  Team A: [code]--------/       |       |       |
  Team B: [code]---------------/       |       |
  Team C: [code]-----------------------/       |
  Team D: [code]-------------------------------/
                         |
                    [lint]--[test]--[scan]--[build]--[push]--[deploy]
                    (consistent for all teams)
```

## Why Centralize CI/CD?

When every team maintains their own pipeline, you get predictable problems:

**Inconsistent quality gates.** Team A runs security scans. Team B doesn't.
You don't find out until Team B's service gets compromised.

**Duplicated effort.** Every team solves the same problems: Docker caching,
test parallelization, deployment rollbacks. Multiply that by 50 teams.

**Drift.** Team A's pipeline was great when they set it up two years ago. It
hasn't been updated since. The base image has 47 known vulnerabilities.

**Knowledge silos.** When the person who wrote the pipeline leaves, nobody
knows how to fix it. The pipeline becomes a haunted house that nobody enters.

**No visibility.** How often does your organization deploy? What's the average
build time? What's the test failure rate? Without centralization, these
questions require asking 50 teams individually.

```
  THE COST OF DECENTRALIZED PIPELINES:

  50 teams × 2 days setting up pipelines = 100 engineer-days
  50 teams × 1 day/month maintaining pipelines = 600 engineer-days/year
  50 teams × inconsistent security = unknown risk exposure

  Centralized pipeline platform:
  5 engineers × full-time = 1,250 engineer-days/year
  BUT: 50 teams × 0 days on pipelines = 0 engineer-days
  Net savings: ~600 engineer-days + consistent security + visibility
```

## Shared Pipeline Templates

Pipeline templates are parameterized pipeline definitions that teams
configure but don't maintain. The platform team owns the template;
product teams provide the parameters.

### GitHub Actions Reusable Workflows

GitHub Actions supports reusable workflows — the foundation for shared
pipeline templates:

```yaml
name: Go Service Pipeline

on:
  workflow_call:
    inputs:
      go-version:
        type: string
        default: "1.22"
      service-name:
        required: true
        type: string
      deploy-environments:
        type: string
        default: '["staging", "production"]'
      run-integration-tests:
        type: boolean
        default: true
      extra-lint-flags:
        type: string
        default: ""
    secrets:
      REGISTRY_TOKEN:
        required: true
      DEPLOY_TOKEN:
        required: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: ${{ inputs.go-version }}
      - name: golangci-lint
        uses: golangci/golangci-lint-action@v4
        with:
          args: ${{ inputs.extra-lint-flags }}

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: ${{ inputs.go-version }}
      - name: Run tests
        run: go test -race -coverprofile=coverage.out ./...
      - name: Check coverage
        run: |
          COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
          if (( $(echo "$COVERAGE < 70" | bc -l) )); then
            echo "Coverage ${COVERAGE}% is below 70% threshold"
            exit 1
          fi
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage.out

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: CRITICAL,HIGH
          exit-code: 1
      - name: Run gosec
        uses: securego/gosec@master
        with:
          args: ./...

  build:
    needs: [lint, test, security-scan]
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: registry.internal/${{ inputs.service-name }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: [build]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Update ArgoCD application
        uses: acme/argocd-deploy-action@v2
        with:
          app-name: ${{ inputs.service-name }}
          image-tag: ${{ needs.build.outputs.image-tag }}
          environment: staging

  integration-test:
    if: ${{ inputs.run-integration-tests }}
    needs: [deploy-staging]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run integration tests
        run: go test -tags=integration ./tests/integration/...
        env:
          TEST_ENV: staging
          SERVICE_URL: https://${{ inputs.service-name }}.staging.internal

  deploy-production:
    needs: [integration-test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Update ArgoCD application
        uses: acme/argocd-deploy-action@v2
        with:
          app-name: ${{ inputs.service-name }}
          image-tag: ${{ needs.build.outputs.image-tag }}
          environment: production
```

Product teams consume this template with minimal configuration:

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  pipeline:
    uses: acme/platform-pipelines/.github/workflows/go-service.yaml@v3
    with:
      service-name: payments-service
      go-version: "1.22"
    secrets:
      REGISTRY_TOKEN: ${{ secrets.REGISTRY_TOKEN }}
      DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

Seven lines of configuration. The product team gets: linting, testing with
coverage enforcement, security scanning, Docker build with caching,
staged deployment, and integration testing. All maintained by the platform
team.

## Pipeline Template Versioning

Templates need versioning just like any API. Teams should be able to pin to
a version and upgrade on their schedule.

```
  TEMPLATE VERSIONING STRATEGY:

  @v1  ──── @v1.0 ──── @v1.1 ──── @v1.2 (security patches)
                                      |
  @v2  ──── @v2.0 ──── @v2.1         |
                                      |
  @v3  ──── @v3.0                    |
         (latest)                     |
                                      |
  Team A: uses @v3  (latest, auto-updates on minor)
  Team B: uses @v2  (stable, will upgrade to v3 next sprint)
  Team C: uses @v1.2 (pinned, has special requirements)
```

### Migration Strategy

When you release a new major version:

```yaml
pipeline_migration:
  v2_to_v3:
    breaking_changes:
      - "Removed `docker-compose` test support (use testcontainers)"
      - "Changed coverage threshold from 60% to 70%"
      - "Added mandatory SBOM generation"

    migration_steps:
      - step: "Update workflow reference from @v2 to @v3"
      - step: "Replace docker-compose tests with testcontainers"
      - step: "Ensure code coverage is above 70%"
      - step: "Verify SBOM is generated correctly"

    timeline:
      announcement: "2025-01-01"
      v3_available: "2025-01-15"
      v2_deprecated: "2025-04-01"
      v2_removed: "2025-07-01"

    support:
      migration_guide: "https://platform.internal/docs/pipeline-v3-migration"
      office_hours: "Every Wednesday 2-3pm for 6 weeks"
      slack_channel: "#platform-pipeline-migration"
```

## Build Infrastructure

Shared pipelines need shared build infrastructure. This is where the platform
team provides compute, caching, and tooling.

```
  BUILD INFRASTRUCTURE LAYERS:

  +================================================================+
  |                    BUILD INFRASTRUCTURE                          |
  +================================================================+
  |                                                                |
  |  COMPUTE              CACHING              ARTIFACTS           |
  |  +--------------+     +--------------+     +--------------+    |
  |  | Self-hosted  |     | Docker layer |     | Container    |    |
  |  | runners      |     | cache        |     | registry     |    |
  |  | (K8s pods)   |     |              |     |              |    |
  |  | Auto-scaling |     | Go module    |     | Helm chart   |    |
  |  | Spot/preempt |     | cache        |     | repository   |    |
  |  |              |     |              |     |              |    |
  |  | GPU runners  |     | npm cache    |     | SBOM store   |    |
  |  | (ML builds)  |     |              |     |              |    |
  |  | ARM runners  |     | Bazel remote |     | Signature    |    |
  |  | (multi-arch) |     | cache        |     | store        |    |
  |  +--------------+     +--------------+     +--------------+    |
  |                                                                |
  +================================================================+
```

### Self-Hosted Runners on Kubernetes

```yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: platform-runners
  namespace: actions-runner-system
spec:
  replicas: 5
  template:
    spec:
      repository: acme
      labels:
        - platform-runner
        - linux
        - amd64
      dockerEnabled: true
      resources:
        limits:
          cpu: "4"
          memory: 8Gi
        requests:
          cpu: "2"
          memory: 4Gi
      volumeMounts:
        - name: docker-cache
          mountPath: /var/lib/docker
        - name: go-cache
          mountPath: /home/runner/.cache/go-build
      volumes:
        - name: docker-cache
          persistentVolumeClaim:
            claimName: runner-docker-cache
        - name: go-cache
          persistentVolumeClaim:
            claimName: runner-go-cache

---
apiVersion: actions.summerwind.dev/v1alpha1
kind: HorizontalRunnerAutoscaler
metadata:
  name: platform-runners-autoscaler
spec:
  scaleTargetRef:
    kind: RunnerDeployment
    name: platform-runners
  minReplicas: 3
  maxReplicas: 20
  scaleUpTriggers:
    - type: PercentageRunnersBusy
      percentageRunnersBusy:
        threshold: "0.75"
  scaleDownDelaySecondsAfterScaleOut: 300
```

## Developer Self-Service for Pipelines

Not every team fits the standard template perfectly. Self-service means
letting teams customize within guardrails.

### Composable Pipeline Steps

Instead of one monolithic template, offer composable building blocks:

```yaml
name: Custom Pipeline

on:
  push:
    branches: [main]

jobs:
  quality:
    uses: acme/platform-pipelines/.github/workflows/go-quality.yaml@v3
    with:
      go-version: "1.22"
      coverage-threshold: 80

  security:
    uses: acme/platform-pipelines/.github/workflows/security-scan.yaml@v3
    with:
      scan-type: full
      severity-threshold: HIGH

  build:
    needs: [quality, security]
    uses: acme/platform-pipelines/.github/workflows/docker-build.yaml@v3
    with:
      service-name: payments-service
      platforms: linux/amd64,linux/arm64
    secrets:
      REGISTRY_TOKEN: ${{ secrets.REGISTRY_TOKEN }}

  deploy:
    needs: [build]
    uses: acme/platform-pipelines/.github/workflows/argocd-deploy.yaml@v3
    with:
      service-name: payments-service
      image-tag: ${{ needs.build.outputs.image-tag }}
      strategy: canary
      canary-weight: 10
    secrets:
      DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

This gives teams the flexibility to compose their pipeline from standardized
blocks while maintaining consistency at the step level.

## Pipeline Observability

If you're running CI/CD as a platform service, you need to observe it like
a platform service. Build times, failure rates, queue depths — these are
your platform SLIs.

```
  CI/CD PLATFORM DASHBOARD:

  +--------------------------------------------------------------------+
  |  CI/CD PLATFORM HEALTH                              Last 24h      |
  +--------------------------------------------------------------------+
  |                                                                    |
  |  Total Builds        Success Rate      Avg Build Time              |
  |  ┌──────────────┐   ┌──────────────┐  ┌──────────────┐            |
  |  │ 847           │   │ 94.2%         │  │ 8m 23s        │            |
  |  │ +12% vs avg   │   │ Target: >95%  │  │ Target: <10m  │            |
  |  └──────────────┘   └──────────────┘  └──────────────┘            |
  |                                                                    |
  |  Queue Depth         Runner Util       Deploy Frequency            |
  |  ┌──────────────┐   ┌──────────────┐  ┌──────────────┐            |
  |  │ 3 waiting     │   │ 72%           │  │ 94/day        │            |
  |  │ Target: <5    │   │ Target: <85%  │  │ +8% vs avg   │            |
  |  └──────────────┘   └──────────────┘  └──────────────┘            |
  |                                                                    |
  |  SLOWEST PIPELINES (p95)                                          |
  |  +---------------------------+-------+--------+---------+         |
  |  | Pipeline                  | p50   | p95    | Status  |         |
  |  +---------------------------+-------+--------+---------+         |
  |  | ml-training-pipeline      | 22m   | 45m    | ⚠ slow  |         |
  |  | frontend-e2e-tests        | 15m   | 32m    | ⚠ slow  |         |
  |  | payments-service          | 6m    | 9m     | ✓ ok    |         |
  |  | user-service              | 4m    | 7m     | ✓ ok    |         |
  |  +---------------------------+-------+--------+---------+         |
  |                                                                    |
  |  TOP FAILURE REASONS (last 7 days)                                |
  |  +---------------------------+---------+-----------+              |
  |  | Reason                    | Count   | % of fail |              |
  |  +---------------------------+---------+-----------+              |
  |  | Flaky test                | 23      | 38%       |              |
  |  | OOM during build          | 12      | 20%       |              |
  |  | Registry timeout          | 8       | 13%       |              |
  |  | Lint failure              | 7       | 12%       |              |
  |  | Security scan finding     | 6       | 10%       |              |
  |  +---------------------------+---------+-----------+              |
  +--------------------------------------------------------------------+
```

### Pipeline Metrics Collection

Emit pipeline metrics to your observability stack:

```yaml
name: Pipeline Metrics
on:
  workflow_run:
    workflows: ["*"]
    types: [completed]

jobs:
  collect-metrics:
    runs-on: ubuntu-latest
    steps:
      - name: Calculate duration
        id: duration
        run: |
          START="${{ github.event.workflow_run.created_at }}"
          END="${{ github.event.workflow_run.updated_at }}"
          DURATION=$(( $(date -d "$END" +%s) - $(date -d "$START" +%s) ))
          echo "duration=$DURATION" >> "$GITHUB_OUTPUT"

      - name: Push metrics
        run: |
          curl -X POST "${PROMETHEUS_PUSHGATEWAY}/metrics/job/ci_cd" \
            --data-binary @- <<EOF
          ci_pipeline_duration_seconds{
            workflow="${{ github.event.workflow_run.name }}",
            repo="${{ github.event.workflow_run.repository.full_name }}",
            branch="${{ github.event.workflow_run.head_branch }}",
            conclusion="${{ github.event.workflow_run.conclusion }}"
          } ${{ steps.duration.outputs.duration }}
          ci_pipeline_total{
            workflow="${{ github.event.workflow_run.name }}",
            repo="${{ github.event.workflow_run.repository.full_name }}",
            conclusion="${{ github.event.workflow_run.conclusion }}"
          } 1
          EOF
```

### Alerting on Pipeline Health

```yaml
groups:
  - name: ci_cd_platform
    rules:
      - alert: PipelineSuccessRateLow
        expr: |
          sum(rate(ci_pipeline_total{conclusion="success"}[1h]))
          /
          sum(rate(ci_pipeline_total[1h]))
          < 0.90
        for: 15m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "CI/CD success rate below 90%"
          description: "Pipeline success rate is {{ $value | humanizePercentage }}"

      - alert: PipelineQueueDepthHigh
        expr: ci_runner_queue_depth > 10
        for: 10m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Build queue depth is high"
          description: "{{ $value }} builds waiting for runners"

      - alert: PipelineDurationP95High
        expr: |
          histogram_quantile(0.95,
            rate(ci_pipeline_duration_seconds_bucket[1h])
          ) > 900
        for: 30m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "p95 build time exceeds 15 minutes"
```

## Security in Shared Pipelines

Shared pipelines are a security-critical component. A compromised pipeline
template affects every team that uses it.

```
  PIPELINE SECURITY LAYERS:

  +------------------------------------------------------------------+
  |  1. TEMPLATE INTEGRITY                                           |
  |     - Signed commits on pipeline templates repo                  |
  |     - Required code review for template changes                  |
  |     - Branch protection on main                                  |
  +------------------------------------------------------------------+
  |  2. SECRET MANAGEMENT                                            |
  |     - Secrets never logged or echoed                              |
  |     - OIDC for cloud authentication (no long-lived tokens)        |
  |     - Least-privilege service accounts                            |
  +------------------------------------------------------------------+
  |  3. SUPPLY CHAIN                                                 |
  |     - Pin action versions by SHA, not tag                         |
  |     - SBOM generation for every build                             |
  |     - Image signing with Sigstore/cosign                          |
  +------------------------------------------------------------------+
  |  4. RUNTIME ISOLATION                                            |
  |     - Each build runs in an ephemeral container                   |
  |     - No shared filesystem between builds                         |
  |     - Network policies limit build egress                         |
  +------------------------------------------------------------------+
```

### Supply Chain Security Example

```yaml
- name: Build and push
  id: build
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ${{ steps.meta.outputs.tags }}

- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ${{ steps.meta.outputs.tags }}
    output-file: sbom.spdx.json

- name: Sign image
  run: |
    cosign sign \
      --key env://COSIGN_PRIVATE_KEY \
      ${{ steps.build.outputs.digest }}

- name: Attest SBOM
  run: |
    cosign attest \
      --key env://COSIGN_PRIVATE_KEY \
      --predicate sbom.spdx.json \
      --type spdxjson \
      ${{ steps.build.outputs.digest }}
```

## Exercises

1. **Pipeline audit.** Survey 5 teams at your organization. How do their
   CI/CD pipelines differ? What steps are common? What's unique? Use this
   to design a shared template that covers the common 80%.

2. **Build a reusable workflow.** Create a GitHub Actions reusable workflow
   for your primary language. Include: linting, testing with coverage,
   security scanning, Docker build, and staged deployment.

3. **Pipeline observability.** Set up metrics collection for your CI/CD
   pipelines. Track: build duration, success rate, queue depth, and failure
   reasons. Create a dashboard.

4. **Migration plan.** Design a migration plan to move 10 teams from custom
   pipelines to your shared template. Include: timeline, communication,
   support plan, and rollback strategy.
