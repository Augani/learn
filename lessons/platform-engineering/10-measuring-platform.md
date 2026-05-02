# Lesson 10: Measuring Platform Success

## The Gym Membership Analogy

A gym can track two things: how many memberships they sold, and whether
members are actually getting healthier. Selling memberships is vanity.
Member health is value.

Platform teams face the same trap. You can measure how many teams use your
platform (adoption), or you can measure whether those teams are actually
shipping better software faster (impact). Both matter, but impact is what
justifies your existence.

```
  VANITY METRICS vs VALUE METRICS:

  VANITY (looks good, means little):
  - "95% of teams use our platform"      (but are they productive?)
  - "We have 47 Backstage plugins"       (but does anyone use them?)
  - "Pipeline runs 10,000 times/month"   (but are they fast?)
  - "Zero platform incidents this month" (but is anyone using it?)

  VALUE (shows real impact):
  - "Time to first deploy dropped from 5 days to 47 minutes"
  - "Deployment frequency increased 3x after pipeline adoption"
  - "Developer NPS improved from +12 to +38"
  - "80% of infra requests fulfilled in <5 minutes (was 3 days)"
```

## The Metrics Framework

Platform metrics fall into four categories. You need all four to tell the
complete story.

```
  PLATFORM METRICS FRAMEWORK:

  +================================================================+
  |                                                                |
  |  1. ADOPTION            2. DEVELOPER             3. DELIVERY   |
  |     METRICS                EXPERIENCE               PERFORMANCE|
  |  +--------------+      +--------------+         +-----------+  |
  |  | Who uses it? |      | Do they like |         | Are they  |  |
  |  | How often?   |      | it? Is it    |         | faster?   |  |
  |  |              |      | easy?        |         | Safer?    |  |
  |  +--------------+      +--------------+         +-----------+  |
  |                                                                |
  |  4. OPERATIONAL          5. COST                               |
  |     HEALTH                  EFFICIENCY                         |
  |  +--------------+      +--------------+                        |
  |  | Is platform  |      | What does it |                        |
  |  | reliable?    |      | cost? Is it  |                        |
  |  | Performant?  |      | worth it?    |                        |
  |  +--------------+      +--------------+                        |
  |                                                                |
  +================================================================+
```

## DORA Metrics

DORA (DevOps Research and Assessment) metrics are the industry standard
for measuring software delivery performance. They're relevant because
a platform's primary goal is improving these numbers.

```
  THE FOUR DORA METRICS:

  +------------------------------------------------------------------+
  |                                                                  |
  |  DEPLOYMENT FREQUENCY          LEAD TIME FOR CHANGES             |
  |  How often do you deploy       How long from commit to           |
  |  to production?                production?                       |
  |                                                                  |
  |  Elite: Multiple per day       Elite: Less than one hour         |
  |  High:  Weekly to monthly      High:  One day to one week        |
  |  Medium: Monthly to 6 months   Medium: One week to one month     |
  |  Low:   Less than once/6mo     Low:   More than six months       |
  |                                                                  |
  +------------------------------------------------------------------+
  |                                                                  |
  |  CHANGE FAILURE RATE           MTTR (Mean Time to Restore)       |
  |  What % of deployments         How long to restore service       |
  |  cause failures?               after a failure?                  |
  |                                                                  |
  |  Elite: 0-15%                  Elite: Less than one hour         |
  |  High:  16-30%                 High:  Less than one day          |
  |  Medium: 31-45%                Medium: One day to one week       |
  |  Low:   46-60%                 Low:   More than six months       |
  |                                                                  |
  +------------------------------------------------------------------+
```

### Tracking DORA Metrics

```yaml
apiVersion: platform.acme.com/v1
kind: DORAMetrics
metadata:
  name: org-dora-dashboard
spec:
  dataSources:
    deployments:
      source: argocd
      productionEnvironments:
        - production
        - prod-*
    changes:
      source: github
      mainBranch: main
    incidents:
      source: pagerduty
      severities: [P1, P2]

  calculation:
    deploymentFrequency:
      window: 30d
      groupBy: [team, service]

    leadTime:
      from: "first_commit"
      to: "production_deploy"
      window: 30d

    changeFailureRate:
      failureIndicators:
        - rollback_within_1h
        - incident_within_1h_of_deploy
      window: 30d

    mttr:
      from: "incident_created"
      to: "incident_resolved"
      window: 90d
```

### DORA Dashboard

```
  DORA METRICS DASHBOARD:

  +====================================================================+
  |  DORA METRICS                                   Organization-wide  |
  +====================================================================+
  |                                                                    |
  |  Deployment Frequency     Lead Time           Change Failure Rate  |
  |  ┌──────────────────┐    ┌──────────────────┐ ┌─────────────────┐ |
  |  │ 94/day            │    │ 2.3 hours         │ │ 8.2%             │ |
  |  │ Rating: ELITE     │    │ Rating: ELITE     │ │ Rating: ELITE   │ |
  |  │ Trend: ↑ +12%     │    │ Trend: ↓ -18%     │ │ Trend: ↓ -3%    │ |
  |  └──────────────────┘    └──────────────────┘ └─────────────────┘ |
  |                                                                    |
  |  MTTR                                                              |
  |  ┌──────────────────┐                                             |
  |  │ 38 minutes        │                                             |
  |  │ Rating: ELITE     │                                             |
  |  │ Trend: ↓ -22%     │                                             |
  |  └──────────────────┘                                             |
  |                                                                    |
  |  BY TEAM:                                                          |
  |  +----------------+-------+--------+---------+--------+---------+ |
  |  | Team           | Freq  | Lead   | Failure | MTTR   | Rating  | |
  |  +----------------+-------+--------+---------+--------+---------+ |
  |  | Payments       | 8/day | 1.2h   | 4%      | 22min  | Elite   | |
  |  | Checkout       | 5/day | 2.1h   | 7%      | 35min  | Elite   | |
  |  | Search         | 3/day | 4.5h   | 12%     | 1.2h   | High    | |
  |  | Analytics      | 2/wk  | 3.2d   | 18%     | 4.5h   | Medium  | |
  |  | Legacy-billing | 1/mo  | 12d    | 35%     | 2.1d   | Low     | |
  |  +----------------+-------+--------+---------+--------+---------+ |
  +====================================================================+
```

## Developer Surveys

Quantitative metrics tell you what's happening. Surveys tell you why.

### Survey Design

```yaml
developer_experience_survey:
  frequency: quarterly
  target_response_rate: ">70%"
  anonymous: true

  sections:
    - name: Overall Satisfaction
      questions:
        - id: nps
          text: "How likely are you to recommend our developer platform to a colleague?"
          type: nps_0_10

        - id: overall
          text: "Overall, how satisfied are you with the developer platform?"
          type: scale_1_5
          labels: ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"]

    - name: Platform Capabilities
      questions:
        - id: ci_cd
          text: "How easy is it to build and deploy your service?"
          type: scale_1_5

        - id: infra
          text: "How easy is it to provision infrastructure (databases, caches, etc.)?"
          type: scale_1_5

        - id: observability
          text: "How easy is it to understand what your service is doing in production?"
          type: scale_1_5

        - id: onboarding
          text: "How easy was it to get started with the platform?"
          type: scale_1_5

        - id: docs
          text: "How would you rate the platform documentation?"
          type: scale_1_5

    - name: Open Feedback
      questions:
        - id: friction
          text: "What's the most frustrating part of your development workflow?"
          type: free_text

        - id: wish
          text: "If you could add one thing to the platform, what would it be?"
          type: free_text

        - id: praise
          text: "What's working really well?"
          type: free_text
```

### Survey Results Tracking

```
  DEVELOPER NPS TREND:

  Score: -10 = terrible, 0 = meh, +50 = great, +70 = world-class

  Q1'24  Q2'24  Q3'24  Q4'24  Q1'25
    +8     +15    +22    +28    +35
    |      |      |      |      |
    ▓      ▓▓     ▓▓▓    ▓▓▓▓   ▓▓▓▓▓
    |      |      |      |      |
  ──+──────+──────+──────+──────+──────
    |      |      |      |      |
    Added  Pipeline Backstage Self-svc Auto-
    golden templates launched  DBs     instru-
    paths                              ment

  Satisfaction by Capability:

  CI/CD          ████████████████████ 4.2/5
  Service Catalog ███████████████████ 4.1/5
  Observability  ████████████████░░░░ 3.8/5
  Infrastructure ███████████████░░░░░ 3.5/5
  Documentation  ██████████████░░░░░░ 3.2/5
  Onboarding     █████████████░░░░░░░ 3.0/5
                                        ^
                                        Focus area for Q2
```

## Adoption Tracking

Adoption metrics tell you whether teams are using the platform — but be
careful. High adoption of a mandated tool doesn't mean the tool is good.
Measure voluntary adoption where possible.

```
  ADOPTION METRICS:

  +-------------------------------------------+--------+---------+
  | Metric                                    | Current| Target  |
  +-------------------------------------------+--------+---------+
  | Services in catalog                       | 142/156| > 95%   |
  | Services using shared CI pipeline         | 118/156| > 85%   |
  | Services with auto-instrumentation        | 95/156 | > 80%   |
  | Services using platform DB provisioning   | 67/89  | > 75%   |
  | New services using golden path template   | 12/14  | > 90%   |
  | Teams with zero platform tickets/month    | 18/23  | > 80%   |
  +-------------------------------------------+--------+---------+
```

### Tracking Adoption Programmatically

```go
package metrics

import (
	"context"
	"time"
)

type AdoptionTracker struct {
	catalog    CatalogClient
	cicd       CICDClient
	infra      InfraClient
	metrics    MetricsStore
}

type AdoptionReport struct {
	Timestamp           time.Time            `json:"timestamp"`
	TotalServices       int                  `json:"total_services"`
	CatalogRegistered   int                  `json:"catalog_registered"`
	SharedPipeline      int                  `json:"shared_pipeline"`
	AutoInstrumented    int                  `json:"auto_instrumented"`
	PlatformDB          int                  `json:"platform_db"`
	GoldenPathTemplate  int                  `json:"golden_path_template"`
	ByTeam              map[string]TeamStats `json:"by_team"`
}

type TeamStats struct {
	TeamName            string  `json:"team_name"`
	Services            int     `json:"services"`
	PlatformAdoption    float64 `json:"platform_adoption_pct"`
	TicketsThisMonth    int     `json:"tickets_this_month"`
	SelfServiceRate     float64 `json:"self_service_rate_pct"`
	AvgDeployFrequency  float64 `json:"avg_deploy_frequency_per_day"`
}

func (t *AdoptionTracker) GenerateReport(ctx context.Context) (*AdoptionReport, error) {
	services, err := t.catalog.ListServices(ctx)
	if err != nil {
		return nil, err
	}

	report := &AdoptionReport{
		Timestamp:     time.Now(),
		TotalServices: len(services),
		ByTeam:        make(map[string]TeamStats),
	}

	for _, svc := range services {
		if svc.CatalogRegistered {
			report.CatalogRegistered++
		}
		if svc.UsesSharedPipeline {
			report.SharedPipeline++
		}
		if svc.AutoInstrumented {
			report.AutoInstrumented++
		}
		if svc.UsesPlatformDB {
			report.PlatformDB++
		}
		if svc.CreatedFromTemplate {
			report.GoldenPathTemplate++
		}
	}

	return report, nil
}
```

## Cost Attribution

Platform teams are cost centers. You need to show the value you provide
relative to the cost of running the platform.

```
  COST ATTRIBUTION MODEL:

  +------------------------------------------------------------------+
  |  PLATFORM COST BREAKDOWN                                         |
  +------------------------------------------------------------------+
  |                                                                  |
  |  Platform Team (people)                   $1.5M / year           |
  |  ████████████████████████████████████████  (5 engineers)         |
  |                                                                  |
  |  Infrastructure (compute, storage)         $800K / year          |
  |  ██████████████████████████                                      |
  |                                                                  |
  |  Tooling licenses (Datadog, PagerDuty)     $400K / year          |
  |  █████████████                                                   |
  |                                                                  |
  |  Total platform cost:                      $2.7M / year          |
  +------------------------------------------------------------------+
  |  VALUE PROVIDED                                                  |
  +------------------------------------------------------------------+
  |                                                                  |
  |  Time saved: 50 teams × 1 engineer-month = $4.2M / year         |
  |  ███████████████████████████████████████████████████████          |
  |  (Each team would need ~1 month/year of infra/ops work)         |
  |                                                                  |
  |  Faster onboarding: 80 hires × 2 weeks saved = $1.2M / year    |
  |  ███████████████████                                             |
  |                                                                  |
  |  Avoided incidents: 12 prevented × $50K avg = $600K / year      |
  |  ██████████                                                      |
  |                                                                  |
  |  Total value:                              $6.0M / year          |
  |  ROI: 122%                                                       |
  +------------------------------------------------------------------+
```

### Per-Team Cost Attribution

Show each team what platform resources they consume:

```yaml
cost_attribution:
  team: payments
  period: "2025-01"

  infrastructure:
    databases:
      - name: payments-db
        type: "db.r6g.large"
        cost: "$312.00"
      - name: payments-cache
        type: "cache.r6g.large"
        cost: "$245.00"
    compute:
      pods: 15
      cpu_hours: 10800
      cost: "$890.00"
    storage:
      persistent_volumes: "200Gi"
      cost: "$40.00"

  platform_services:
    ci_cd:
      pipeline_minutes: 4200
      cost: "$84.00"
    observability:
      metrics_series: 12000
      log_volume_gb: 45
      trace_spans_millions: 8.5
      cost: "$320.00"
    secrets:
      vault_requests: 145000
      cost: "$0.00"

  total_monthly: "$1,891.00"
  cost_per_deploy: "$2.34"
  cost_trend: "-8% vs last month"
```

## Platform SLOs

Your platform needs SLOs just like any production service. If CI/CD goes
down, your entire engineering organization stops shipping.

```
  PLATFORM SLOS:

  +-------------------------------------------+--------+----------+
  | Service                                   | SLO    | Current  |
  +-------------------------------------------+--------+----------+
  | CI/CD pipeline availability               | 99.9%  | 99.95%   |
  | CI/CD pipeline p95 duration               | <15min | 9.2min   |
  | Backstage portal availability             | 99.9%  | 99.98%   |
  | Vault availability                        | 99.99% | 99.997%  |
  | Database provisioning (time to ready)     | <10min | 6.3min   |
  | Infrastructure API response time (p99)    | <500ms | 180ms    |
  | Observability data freshness              | <2min  | 45s      |
  | GitOps sync time (commit to deployed)     | <5min  | 2.1min   |
  +-------------------------------------------+--------+----------+
```

### SLO Monitoring

```yaml
groups:
  - name: platform_slos
    rules:
      - record: platform:cicd:availability:ratio
        expr: |
          1 - (
            sum(rate(cicd_pipeline_failures_total[30d]))
            /
            sum(rate(cicd_pipeline_runs_total[30d]))
          )

      - alert: PlatformCICDSLOBreach
        expr: platform:cicd:availability:ratio < 0.999
        for: 0m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "CI/CD availability SLO breached"
          description: "Current: {{ $value | humanizePercentage }}, Target: 99.9%"
          error_budget: "{{ printf \"%.2f\" (sub $value 0.999 | mulf 100) }}% remaining"

      - record: platform:cicd:duration:p95
        expr: |
          histogram_quantile(0.95,
            sum(rate(cicd_pipeline_duration_seconds_bucket[24h])) by (le)
          )

      - alert: PlatformCICDDurationSLOBreach
        expr: platform:cicd:duration:p95 > 900
        for: 15m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "CI/CD p95 duration exceeds 15 minutes"
```

### Error Budget Tracking

```
  ERROR BUDGET:

  CI/CD Availability SLO: 99.9% (30-day rolling)
  Budget: 43.2 minutes of downtime per 30 days

  ┌──────────────────────────────────────────────┐
  │ Budget remaining: 38.7 minutes (89.6%)       │
  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ │
  │                                              │
  │ Incidents this period:                       │
  │   Jan 5: Pipeline outage (3.2 min)           │
  │   Jan 12: Registry slowness (1.3 min)        │
  │                                              │
  │ Burn rate: 0.32x (on track)                  │
  └──────────────────────────────────────────────┘
```

## Reporting to Leadership

Platform metrics need different views for different audiences.

```
  AUDIENCE-SPECIFIC VIEWS:

  FOR ENGINEERS:
  - Detailed dashboards with per-service metrics
  - Real-time alerting and incident data
  - Technical SLO tracking

  FOR ENGINEERING MANAGERS:
  - Team-level DORA metrics comparison
  - Adoption rates for their team
  - Cost per team per month

  FOR VP/CTO:
  - Organization-wide delivery performance trends
  - Platform ROI and cost efficiency
  - Developer satisfaction trends
  - Comparison to industry benchmarks (DORA)
```

### Executive Summary Template

```yaml
platform_quarterly_review:
  period: "Q1 2025"

  headline_metrics:
    developer_nps: "+35 (up from +28)"
    deployment_frequency: "94/day (up 12%)"
    lead_time: "2.3 hours (down 18%)"
    platform_adoption: "91% of services"

  key_achievements:
    - "Reduced time to first deploy from 5 days to 47 minutes"
    - "Self-service database provisioning launched (67 databases created)"
    - "Auto-instrumentation rolled out to 95 services"

  cost_summary:
    platform_cost: "$675K this quarter"
    value_delivered: "$1.5M (estimated time savings)"
    roi: "122%"

  next_quarter_priorities:
    - "Improve documentation (lowest satisfaction score at 3.2/5)"
    - "Launch self-service Kafka topics"
    - "Reduce CI/CD p95 duration from 9.2 to 7 minutes"
```

## Exercises

1. **DORA baseline.** Measure your organization's current DORA metrics:
   deployment frequency, lead time, change failure rate, and MTTR. Rate
   your organization against the DORA benchmarks.

2. **Design a developer survey.** Create a quarterly developer experience
   survey with at least 15 questions covering satisfaction, capability
   ratings, and open feedback. Plan how you'll track results over time.

3. **Cost attribution.** Calculate the total cost of your platform (people,
   infrastructure, licenses). Then estimate the value it provides (time
   saved, incidents prevented, faster onboarding). What's the ROI?

4. **SLO definition.** Define SLOs for your platform services: CI/CD, portal,
   secrets management, and infrastructure provisioning. Include error
   budgets and alerting thresholds.
