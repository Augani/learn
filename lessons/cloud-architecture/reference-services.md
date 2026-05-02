# Reference: Cloud Services Cheat Sheet (AWS + GCP Equivalents)

## Compute

```
+------------------------+------------------------+------------------------+
| Category               | AWS                    | GCP                    |
+------------------------+------------------------+------------------------+
| Virtual Machines       | EC2                    | Compute Engine         |
| Containers (managed)   | ECS                    | Cloud Run              |
| Kubernetes             | EKS                    | GKE                    |
| Serverless Functions   | Lambda                 | Cloud Functions        |
| Serverless Containers  | Fargate                | Cloud Run              |
| Batch Processing       | AWS Batch              | Batch on GKE           |
| Edge Compute           | Lambda@Edge            | Cloud CDN Functions    |
+------------------------+------------------------+------------------------+
```

## Storage

```
+------------------------+------------------------+------------------------+
| Category               | AWS                    | GCP                    |
+------------------------+------------------------+------------------------+
| Object Storage         | S3                     | Cloud Storage          |
| Block Storage          | EBS                    | Persistent Disk        |
| File Storage (Linux)   | EFS                    | Filestore              |
| File Storage (Windows) | FSx                    | (Use Filestore)        |
| Archive                | S3 Glacier             | Archive Storage        |
| Local SSD              | Instance Store         | Local SSD              |
+------------------------+------------------------+------------------------+
```

## Database

```
+------------------------+------------------------+------------------------+
| Category               | AWS                    | GCP                    |
+------------------------+------------------------+------------------------+
| Relational (managed)   | RDS                    | Cloud SQL              |
| Relational (serverless)| Aurora Serverless      | AlloyDB                |
| NoSQL (key-value)      | DynamoDB               | Firestore / Bigtable   |
| NoSQL (document)       | DocumentDB             | Firestore              |
| In-Memory Cache        | ElastiCache            | Memorystore            |
| Graph                  | Neptune                | (Use Neo4j on GCE)    |
| Time Series            | Timestream             | (Use Bigtable)         |
| Data Warehouse         | Redshift               | BigQuery               |
+------------------------+------------------------+------------------------+
```

## Networking

```
+------------------------+------------------------+------------------------+
| Category               | AWS                    | GCP                    |
+------------------------+------------------------+------------------------+
| Virtual Network        | VPC                    | VPC                    |
| Load Balancer (L7)     | ALB                    | HTTP(S) Load Balancer  |
| Load Balancer (L4)     | NLB                    | TCP/UDP Load Balancer  |
| DNS                    | Route 53               | Cloud DNS              |
| CDN                    | CloudFront             | Cloud CDN              |
| API Gateway            | API Gateway            | API Gateway / Apigee   |
| VPN                    | Site-to-Site VPN       | Cloud VPN              |
| Direct Connection      | Direct Connect         | Cloud Interconnect     |
| Service Mesh           | App Mesh               | Traffic Director       |
+------------------------+------------------------+------------------------+
```

## Security & Identity

```
+------------------------+------------------------+------------------------+
| Category               | AWS                    | GCP                    |
+------------------------+------------------------+------------------------+
| Identity & Access      | IAM                    | IAM                    |
| SSO                    | IAM Identity Center    | Cloud Identity         |
| Key Management         | KMS                    | Cloud KMS              |
| Secrets                | Secrets Manager        | Secret Manager         |
| Certificates           | ACM                    | Certificate Manager    |
| WAF                    | WAF                    | Cloud Armor            |
| DDoS Protection        | Shield                 | Cloud Armor            |
| Threat Detection       | GuardDuty              | Security Command Cntr  |
| Compliance             | Config                 | Policy Intelligence    |
+------------------------+------------------------+------------------------+
```

## Monitoring & Operations

```
+------------------------+------------------------+------------------------+
| Category               | AWS                    | GCP                    |
+------------------------+------------------------+------------------------+
| Metrics                | CloudWatch Metrics     | Cloud Monitoring       |
| Logs                   | CloudWatch Logs        | Cloud Logging          |
| Tracing                | X-Ray                  | Cloud Trace            |
| Dashboards             | CloudWatch Dashboards  | Cloud Monitoring       |
| Audit Logging          | CloudTrail             | Audit Logs             |
| Infrastructure as Code | CloudFormation         | Deployment Manager     |
| Parameter Store        | Systems Manager        | Runtime Configurator   |
+------------------------+------------------------+------------------------+
```

## AI/ML

```
+------------------------+------------------------+------------------------+
| Category               | AWS                    | GCP                    |
+------------------------+------------------------+------------------------+
| ML Platform            | SageMaker              | Vertex AI              |
| Pre-trained AI         | Rekognition/Comprehend | Vision AI / NL API     |
| Speech                 | Transcribe / Polly     | Speech-to-Text / TTS   |
| Translation            | Translate              | Translation API        |
| Chatbot                | Lex                    | Dialogflow             |
+------------------------+------------------------+------------------------+
```

## Data & Analytics

```
+------------------------+------------------------+------------------------+
| Category               | AWS                    | GCP                    |
+------------------------+------------------------+------------------------+
| Stream Processing      | Kinesis                | Pub/Sub + Dataflow     |
| ETL                    | Glue                   | Dataflow               |
| Data Catalog           | Glue Data Catalog      | Data Catalog           |
| Message Queue          | SQS                    | Pub/Sub                |
| Event Bus              | EventBridge            | Eventarc               |
| Search                 | OpenSearch             | (Use Elastic on GCE)   |
| Workflow               | Step Functions         | Workflows              |
+------------------------+------------------------+------------------------+
```

## Quick Reference: Common Patterns

```
WEB APP:           ALB + ECS Fargate + RDS + ElastiCache + S3
                   GCP: HTTP LB + Cloud Run + Cloud SQL + Memorystore + GCS

EVENT-DRIVEN:      API GW + Lambda + SQS + DynamoDB
                   GCP: API GW + Cloud Functions + Pub/Sub + Firestore

DATA PIPELINE:     Kinesis + Lambda + S3 + Glue + Redshift
                   GCP: Pub/Sub + Dataflow + GCS + BigQuery

ML PIPELINE:       S3 + SageMaker + ECR + Lambda
                   GCP: GCS + Vertex AI + Artifact Registry + Cloud Functions
```
