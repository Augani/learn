# Cloud Architecture & Infrastructure as Code

## Track Roadmap

```
+------------------------------------------------------------------+
|                CLOUD ARCHITECTURE & IaC TRACK                     |
+------------------------------------------------------------------+
|                                                                    |
|  FOUNDATIONS (Lessons 1-5)                                        |
|  +----------+  +----------+  +----------+  +----------+          |
|  | Cloud    |->| Compute  |->| Storage  |->| Network  |          |
|  | Basics   |  | Services |  | Services |  | (VPC)    |          |
|  +----------+  +----------+  +----------+  +----------+          |
|       |                                          |                |
|       v                                          v                |
|  +----------+                              +----------+          |
|  | IAM &    |                              | Databases|          |
|  | Security |                              | in Cloud |          |
|  +----------+                              +----------+          |
|                                                                    |
|  APPLICATION PATTERNS (Lessons 7-8)                               |
|  +----------+  +------------------+                               |
|  |Serverless|->| Containers in    |                               |
|  | Patterns |  | Cloud (ECS/EKS)  |                               |
|  +----------+  +------------------+                               |
|                                                                    |
|  INFRASTRUCTURE AS CODE (Lessons 9-11)                            |
|  +----------+  +----------+  +----------+                         |
|  | Terraform|->| Terraform|->| CI/CD for|                         |
|  | Basics   |  | Patterns |  | Infra    |                         |
|  +----------+  +----------+  +----------+                         |
|                                                                    |
|  OPERATIONS & OPTIMIZATION (Lessons 12-14)                        |
|  +----------+  +----------+  +----------+                         |
|  |Monitoring|->| Cost     |->| Security |                         |
|  |& Logging |  | Optimize |  | Hardening|                         |
|  +----------+  +----------+  +----------+                         |
|                                                                    |
|  ADVANCED ARCHITECTURE (Lessons 15-17)                            |
|  +----------+  +----------+  +----------+                         |
|  | Multi-   |->| Disaster |->| Well-    |                         |
|  | Region   |  | Recovery |  | Architctd|                         |
|  +----------+  +----------+  +----------+                         |
|                                                                    |
|  CAPSTONE (Lesson 18)                                             |
|  +--------------------------------------------------+            |
|  | Full Application Deploy with Terraform            |            |
|  | VPC + ECS + RDS + S3 + CloudFront                 |            |
|  +--------------------------------------------------+            |
|                                                                    |
+------------------------------------------------------------------+
```

## Prerequisites

- Familiarity with Linux command line
- Docker basics (see Docker track)
- Kubernetes concepts helpful (see K8s track)
- An AWS free-tier account (recommended)
- Terraform installed locally

## What You Will Build

By the end of this track, you will deploy a production-grade
application on AWS using Terraform, complete with:

- Custom VPC with public/private subnets
- Containerized application on ECS/Fargate
- Managed database with RDS
- Static assets on S3 + CloudFront CDN
- Monitoring, alerting, and cost controls

## Lesson Index

| #  | Lesson                    | Focus Area        |
|----|---------------------------|-------------------|
| 01 | Cloud Fundamentals        | Foundations       |
| 02 | Compute Services          | Foundations       |
| 03 | Storage Services          | Foundations       |
| 04 | Networking (VPC)          | Foundations       |
| 05 | IAM & Access Control      | Foundations       |
| 06 | Databases in Cloud        | Foundations       |
| 07 | Serverless Patterns       | App Patterns      |
| 08 | Containers in Cloud       | App Patterns      |
| 09 | Terraform Basics          | IaC               |
| 10 | Terraform Patterns        | IaC               |
| 11 | CI/CD for Infrastructure  | IaC               |
| 12 | Monitoring & Logging      | Operations        |
| 13 | Cost Optimization         | Operations        |
| 14 | Security in Cloud         | Operations        |
| 15 | Multi-Region Architecture | Advanced          |
| 16 | Disaster Recovery         | Advanced          |
| 17 | Well-Architected Framework| Advanced          |
| 18 | Capstone Project          | Capstone          |

## Reference Materials

- [AWS Services Cheat Sheet](reference-services.md)
- [Terraform Quick Reference](reference-terraform.md)

## Estimated Time

- 18 lessons x 20-30 minutes = ~7-9 hours
- Capstone project: 2-4 hours additional

---

[Start the track -> Lesson 1: Cloud Fundamentals](01-cloud-fundamentals.md)
