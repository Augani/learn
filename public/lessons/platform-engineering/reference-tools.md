# Platform Engineering Tools Reference

## Developer Portals

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| Backstage        | Open-source developer portal framework.       | Open source      |
|                  | Service catalog, templates, TechDocs,         | (CNCF)           |
|                  | plugin ecosystem. Built by Spotify.           |                  |
+------------------+-----------------------------------------------+------------------+
| Port             | Commercial developer portal with no-code      | Commercial       |
|                  | customization and strong data modeling.        |                  |
+------------------+-----------------------------------------------+------------------+
| Cortex           | Service maturity scorecards. Tracks which     | Commercial       |
|                  | services meet org standards.                  |                  |
+------------------+-----------------------------------------------+------------------+
| OpsLevel         | Service ownership and maturity tracking.      | Commercial       |
|                  | Similar to Cortex with catalog focus.         |                  |
+------------------+-----------------------------------------------+------------------+
| Roadie           | Managed Backstage SaaS. Less custom dev       | Commercial       |
|                  | work compared to self-hosted Backstage.       | (Backstage SaaS) |
+------------------+-----------------------------------------------+------------------+
```

## GitOps & Deployment

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| ArgoCD           | GitOps continuous delivery for Kubernetes.    | Open source      |
|                  | Syncs K8s state from Git repositories.        | (CNCF)           |
|                  | Declarative, auditable deployments.           |                  |
+------------------+-----------------------------------------------+------------------+
| Flux             | GitOps toolkit for Kubernetes. Source          | Open source      |
|                  | controller, Kustomize controller, Helm        | (CNCF)           |
|                  | controller. Alternative to ArgoCD.            |                  |
+------------------+-----------------------------------------------+------------------+
| Argo Rollouts    | Progressive delivery controller for K8s.     | Open source      |
|                  | Canary deployments, blue-green, analysis.     |                  |
+------------------+-----------------------------------------------+------------------+
| Spinnaker        | Multi-cloud continuous delivery platform.     | Open source      |
|                  | Mature but complex. Pipeline-based.           |                  |
+------------------+-----------------------------------------------+------------------+
```

## Infrastructure as Code / Abstraction

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| Crossplane       | Extends K8s to manage cloud infrastructure.   | Open source      |
|                  | Compositions abstract cloud resources into    | (CNCF)           |
|                  | simple CRDs. GitOps-native.                   |                  |
+------------------+-----------------------------------------------+------------------+
| Terraform        | Infrastructure as Code with declarative HCL.  | Open source      |
|                  | Multi-cloud. Huge provider ecosystem.         | (HashiCorp)      |
|                  | Modules enable shared abstractions.           |                  |
+------------------+-----------------------------------------------+------------------+
| Pulumi           | Infrastructure as Code using real programming | Open source      |
|                  | languages (Go, Python, TypeScript, etc).      |                  |
+------------------+-----------------------------------------------+------------------+
| OpenTofu         | Open-source fork of Terraform after           | Open source      |
|                  | HashiCorp license change. Drop-in compatible. | (Linux Foundation)|
+------------------+-----------------------------------------------+------------------+
| Atlantis         | Terraform pull request automation. Runs       | Open source      |
|                  | plan/apply from PRs. Good for Terraform       |                  |
|                  | self-service via GitOps.                      |                  |
+------------------+-----------------------------------------------+------------------+
| Kratix           | Framework for building platforms. Uses        | Open source      |
|                  | Kubernetes and GitOps to compose platform     |                  |
|                  | capabilities as "Promises."                   |                  |
+------------------+-----------------------------------------------+------------------+
```

## Secrets Management

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| HashiCorp Vault  | Secrets management, dynamic secrets,          | Open source /    |
|                  | encryption as a service, PKI.                 | Commercial       |
|                  | Industry standard for secrets at scale.       |                  |
+------------------+-----------------------------------------------+------------------+
| External Secrets | Syncs secrets from Vault, AWS Secrets         | Open source      |
| Operator         | Manager, GCP Secret Manager into K8s          |                  |
|                  | Secrets. Kubernetes-native.                   |                  |
+------------------+-----------------------------------------------+------------------+
| Sealed Secrets   | Encrypt K8s secrets for safe storage in Git.  | Open source      |
|                  | Simple but limited (no dynamic secrets).      |                  |
+------------------+-----------------------------------------------+------------------+
| cert-manager     | Automates TLS certificate management in       | Open source      |
|                  | Kubernetes. Integrates with Let's Encrypt,    | (CNCF)           |
|                  | Vault PKI, and other CAs.                     |                  |
+------------------+-----------------------------------------------+------------------+
```

## Observability

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| OpenTelemetry    | Vendor-neutral telemetry framework.           | Open source      |
|                  | SDKs, Collector, auto-instrumentation.        | (CNCF)           |
|                  | Standard for metrics, traces, logs.           |                  |
+------------------+-----------------------------------------------+------------------+
| Grafana          | Visualization and dashboards. Supports        | Open source /    |
|                  | Prometheus, Loki, Tempo, and many others.     | Commercial       |
+------------------+-----------------------------------------------+------------------+
| Prometheus       | Time-series metrics database. Pull-based      | Open source      |
|                  | scraping. PromQL query language.               | (CNCF)           |
+------------------+-----------------------------------------------+------------------+
| Grafana Mimir    | Horizontally scalable, long-term storage      | Open source      |
|                  | for Prometheus metrics. Multi-tenant.         |                  |
+------------------+-----------------------------------------------+------------------+
| Grafana Loki     | Log aggregation system. Indexes labels,       | Open source      |
|                  | not full text. Cost-effective at scale.        |                  |
+------------------+-----------------------------------------------+------------------+
| Grafana Tempo    | Distributed tracing backend. Scales well.     | Open source      |
|                  | Integrates with Grafana for trace search.     |                  |
+------------------+-----------------------------------------------+------------------+
| Jaeger           | Distributed tracing backend.                  | Open source      |
|                  | CNCF project. Good for smaller scale.         | (CNCF)           |
+------------------+-----------------------------------------------+------------------+
| Pyroscope        | Continuous profiling. CPU/memory flame         | Open source      |
|                  | graphs. Integrates with Grafana.              |                  |
+------------------+-----------------------------------------------+------------------+
| Datadog          | Full observability SaaS. Metrics, traces,     | Commercial       |
|                  | logs, APM, synthetics, security.              |                  |
+------------------+-----------------------------------------------+------------------+
| PagerDuty        | Incident management and on-call scheduling.   | Commercial       |
|                  | Alert routing, escalation, postmortems.       |                  |
+------------------+-----------------------------------------------+------------------+
```

## CI/CD

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| GitHub Actions   | CI/CD built into GitHub. Reusable workflows   | Commercial       |
|                  | enable shared pipeline templates.              | (free tier)      |
+------------------+-----------------------------------------------+------------------+
| Tekton           | Cloud-native CI/CD on Kubernetes. Pipeline    | Open source      |
|                  | resources as CRDs. Highly extensible.         | (Linux Foundation)|
+------------------+-----------------------------------------------+------------------+
| Dagger           | CI/CD pipelines as code using containers.     | Open source      |
|                  | Runs locally and in any CI system.             |                  |
+------------------+-----------------------------------------------+------------------+
| Jenkins          | Legacy CI server. Mature plugin ecosystem     | Open source      |
|                  | but complex to maintain at scale.              |                  |
+------------------+-----------------------------------------------+------------------+
```

## Policy & Security

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| OPA / Gatekeeper | Policy engine for Kubernetes. Rego policy     | Open source      |
|                  | language. Admission control, audit.           | (CNCF)           |
+------------------+-----------------------------------------------+------------------+
| Kyverno          | Kubernetes-native policy engine. Policies     | Open source      |
|                  | written as K8s resources (YAML, not Rego).    | (CNCF)           |
+------------------+-----------------------------------------------+------------------+
| Trivy            | Vulnerability scanner for containers, IaC,    | Open source      |
|                  | filesystems, and Git repos.                   |                  |
+------------------+-----------------------------------------------+------------------+
| Sigstore / cosign| Container image signing and verification.     | Open source      |
|                  | Keyless signing with OIDC. Supply chain       | (Linux Foundation)|
|                  | security.                                     |                  |
+------------------+-----------------------------------------------+------------------+
| Falco            | Runtime security monitoring for containers    | Open source      |
|                  | and Kubernetes. Detects anomalous behavior.   | (CNCF)           |
+------------------+-----------------------------------------------+------------------+
```

## Service Mesh & Networking

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| Istio            | Service mesh for K8s. mTLS, traffic           | Open source      |
|                  | management, observability. Feature-rich       |                  |
|                  | but complex.                                  |                  |
+------------------+-----------------------------------------------+------------------+
| Linkerd          | Lightweight service mesh. Simpler than        | Open source      |
|                  | Istio. Good mTLS and observability.           | (CNCF)           |
+------------------+-----------------------------------------------+------------------+
| Cilium           | eBPF-based networking and security for K8s.   | Open source      |
|                  | Network policies, observability, service      | (CNCF)           |
|                  | mesh without sidecars.                        |                  |
+------------------+-----------------------------------------------+------------------+
```

## Database Management

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| CloudNativePG    | PostgreSQL operator for Kubernetes.           | Open source      |
|                  | Automated failover, backups, scaling.         | (CNCF sandbox)   |
+------------------+-----------------------------------------------+------------------+
| PgBouncer        | Connection pooler for PostgreSQL.              | Open source      |
|                  | Reduces database connection overhead.          |                  |
+------------------+-----------------------------------------------+------------------+
| SchemaHero       | Declarative database schema management        | Open source      |
|                  | as Kubernetes CRDs. Database-agnostic.        |                  |
+------------------+-----------------------------------------------+------------------+
| Atlas            | Database schema management tool.              | Open source      |
|                  | Schema-as-code with migration linting.        |                  |
+------------------+-----------------------------------------------+------------------+
```

## Configuration & Feature Flags

```
+------------------+-----------------------------------------------+------------------+
| Tool             | What It Does                                  | Type             |
+------------------+-----------------------------------------------+------------------+
| LaunchDarkly     | Feature flag management SaaS. Targeting,      | Commercial       |
|                  | rollouts, experiments.                        |                  |
+------------------+-----------------------------------------------+------------------+
| Flagsmith        | Open-source feature flag and remote config.   | Open source /    |
|                  | Self-hosted or cloud.                         | Commercial       |
+------------------+-----------------------------------------------+------------------+
| OpenFeature      | Vendor-neutral feature flag SDK standard.     | Open source      |
|                  | Swap providers without code changes.          | (CNCF)           |
+------------------+-----------------------------------------------+------------------+
```

## Choosing Tools

```
  SELECTION CRITERIA:

  1. Does it solve a real developer pain point?     (not a theoretical one)
  2. Is it actively maintained?                     (check commit frequency)
  3. Does the community/vendor have staying power?  (CNCF, large company)
  4. Can your team operate it?                      (complexity budget)
  5. Does it integrate with your existing stack?    (avoid glue work)
  6. Is there an escape hatch?                      (avoid lock-in)
  7. What's the total cost of ownership?            (not just license cost)
```
