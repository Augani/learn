# Platform Engineering - Track Roadmap

## What This Track Covers

This track teaches you how to build internal developer platforms that make
engineering teams faster, safer, and happier. You'll learn to design golden
paths, build self-service infrastructure, and measure what matters.

```
  +----------------------------------------------------------+
  |               PLATFORM ENGINEERING                        |
  +----------------------------------------------------------+
  |                                                          |
  |  FOUNDATIONS          BUILDING BLOCKS    SERVICES         |
  |  +-----------+      +-----------+     +-----------+      |
  |  | What is   |      | Golden    |     | CI/CD     |      |
  |  | Platform  |----->| Paths     |---->| Platform  |      |
  |  | Eng?      |      | Portals   |     | Infra     |      |
  |  | Platform  |      | Internal  |     | Secrets   |      |
  |  | as Product|      | APIs      |     | Observ.   |      |
  |  +-----------+      +-----------+     +-----------+      |
  |        |                  |                 |            |
  |        v                  v                 v            |
  |  DATA SERVICES       MEASUREMENT       CAPSTONE         |
  |  +-----------+      +-----------+     +-----------+      |
  |  | Database  |      | Metrics   |     | Design a  |      |
  |  | as a      |      | Team      |     | Complete  |      |
  |  | Service   |      | Dynamics  |     | IDP       |      |
  |  +-----------+      +-----------+     +-----------+      |
  |                                                          |
  +----------------------------------------------------------+
```

## Lesson Plan

| #  | Lesson                              | Focus                                          |
|----|-------------------------------------|-------------------------------------------------|
| 01 | What Is Platform Engineering?       | Platform eng vs DevOps, platform as a product   |
| 02 | Golden Paths                        | Paved roads, templates, scaffolding, defaults   |
| 03 | Developer Portals                   | Backstage, service catalogs, API discovery      |
| 04 | Internal APIs & SDKs                | Platform APIs, CLI tools, self-service          |
| 05 | CI/CD as a Platform Service         | Shared pipelines, templates, build infra        |
| 06 | Infrastructure Abstraction          | Crossplane, Terraform modules, CRDs, operators  |
| 07 | Secrets & Configuration at Scale    | Vault, dynamic secrets, rotation, zero-trust    |
| 08 | Observability Platform              | Instrumentation, dashboards, alert routing      |
| 09 | Database as a Service               | Self-service provisioning, schemas, backups     |
| 10 | Measuring Platform Success          | DORA, developer surveys, cost attribution       |
| 11 | Platform Team Dynamics              | Team topology, interaction modes, stakeholders  |
| 12 | Design a Developer Platform         | Capstone: end-to-end IDP design                 |

## Reference Materials

- [Platform Engineering Tools](reference-tools.md)
- [Platform Patterns & Anti-Patterns](reference-patterns.md)

## Prerequisites

- Docker and container fundamentals
- Kubernetes basics (pods, deployments, services)
- CI/CD pipeline experience (GitHub Actions, Jenkins, or similar)
- Cloud provider experience (AWS, GCP, or Azure)
- Familiarity with Infrastructure as Code (Terraform or similar)
- Completed the Cloud Architecture track (recommended)
- Completed the CI/CD Pipelines track (recommended)

## How to Use This Track

Each lesson is a deep read with real configuration examples and architecture
diagrams. Work through them in order — later lessons build on concepts from
earlier ones. The capstone in lesson 12 ties everything into a complete
platform design.

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Team Topologies** by Matthew Skelton and Manuel Pais (IT Revolution Press, 2019) — How to organize teams for fast flow, and why platform teams exist
- **Platform Engineering on Kubernetes** by Mauricio Salatino (Manning, 2024) — Hands-on guide to building platforms on top of Kubernetes
