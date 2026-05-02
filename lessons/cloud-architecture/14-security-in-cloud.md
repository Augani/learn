# Lesson 14: Cloud Security

## The Big Analogy: Castle Defense Layers

```
DEFENSE IN DEPTH

  Internet
     |
     v
  +--[WAF]--+           Outer wall (Web Application Firewall)
  |          |
  | +[SG]---+--+        Castle gate (Security Groups)
  | |           |
  | | +[IAM]---+-+      Guards checking IDs (Identity)
  | | |          | |
  | | | +[KMS]--+-+-+   Vault with encrypted treasures
  | | | |         | | |
  | | | | [Data]  | | |  The crown jewels
  | | | +---------+ | |
  | | +-------------+ |
  | +------------------+
  +--------------------+

  Every layer must be breached to reach data.
  Compromise one layer? Others still protect you.
```

## KMS: Key Management Service

```
KMS KEY HIERARCHY

  AWS KMS
  +--------------------------------+
  |  Customer Master Key (CMK)     |
  |  (never leaves KMS)            |
  |        |                       |
  |        v                       |
  |  Generates Data Keys           |
  |        |                       |
  |   +----+----+                  |
  |   |         |                  |
  |   v         v                  |
  | Plaintext  Encrypted           |
  | Data Key   Data Key            |
  +----+----------+----------------+
       |          |
       v          v
  Encrypt      Store encrypted
  your data    data key WITH
  in memory    encrypted data
       |
       v
  Discard plaintext key immediately
```

```hcl
resource "aws_kms_key" "app_data" {
  description             = "Encryption key for application data"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowRootAccount"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowAppRole"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.app.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
        ]
        Resource = "*"
      },
    ]
  })
}

resource "aws_kms_alias" "app_data" {
  name          = "alias/app-data"
  target_key_id = aws_kms_key.app_data.key_id
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.app_data.arn
    }
    bucket_key_enabled = true
  }
}
```

## Secrets Manager

```
SECRETS MANAGER vs PARAMETER STORE

  Secrets Manager             Parameter Store
  +--------------------+      +--------------------+
  | Auto-rotation      |      | No auto-rotation   |
  | $0.40/secret/month |      | Free (standard)    |
  | Cross-account      |      | Same account       |
  | Built-in RDS       |      | Manual integration |
  |   rotation         |      |                    |
  +--------------------+      +--------------------+

  USE SECRETS MANAGER FOR:    USE PARAMETER STORE FOR:
  - Database passwords        - Config values
  - API keys                  - Feature flags
  - OAuth tokens              - Endpoint URLs
```

```hcl
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "production/database/password"
  kms_key_id              = aws_kms_key.app_data.arn
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_rotation" "db_password" {
  secret_id           = aws_secretsmanager_secret.db_password.id
  rotation_lambda_arn = aws_lambda_function.rotate_secret.arn

  rotation_rules {
    automatically_after_days = 30
  }
}
```

```python
import boto3
import json
from functools import lru_cache

secrets_client = boto3.client("secretsmanager")

@lru_cache(maxsize=32)
def get_secret(secret_name: str) -> dict:
    response = secrets_client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

def get_db_connection_string() -> str:
    secret = get_secret("production/database/password")
    return (
        f"postgresql://{secret['username']}:{secret['password']}"
        f"@{secret['host']}:{secret['port']}/{secret['dbname']}"
    )
```

## WAF: Web Application Firewall

```
WAF RULE EVALUATION ORDER

  Request arrives
       |
       v
  +--[Rate Limit]--+     Block IPs sending > 2000 req/5min
  |   PASS          |
  +--------+--------+
           |
           v
  +--[IP Blocklist]-+     Known bad IPs
  |   PASS          |
  +--------+--------+
           |
           v
  +--[SQL Injection]-+    AWS managed rule
  |   PASS           |
  +--------+---------+
           |
           v
  +--[XSS Protection]-+   AWS managed rule
  |   PASS            |
  +--------+----------+
           |
           v
  +--[Bot Control]----+   Block known scrapers
  |   PASS            |
  +--------+----------+
           |
           v
     Allow request
```

```hcl
resource "aws_wafv2_web_acl" "main" {
  name        = "production-waf"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
    }
  }

  rule {
    name     = "aws-managed-sql-injection"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLInjection"
    }
  }

  rule {
    name     = "aws-managed-common"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRules"
    }
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "ProductionWAF"
  }
}
```

## GuardDuty: Threat Detection

```
GUARDDUTY DATA SOURCES

  VPC Flow Logs -----+
                      |
  DNS Logs ----------+----> GuardDuty -----> EventBridge
                      |     (ML-based        |
  CloudTrail --------+      analysis)        v
                      |                   Lambda
  S3 Data Events ----+                      |
                      |                      v
  EKS Audit Logs ----+                   SNS / Slack
                                         Security Hub
```

```hcl
resource "aws_guardduty_detector" "main" {
  enable = true

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }
}

resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  name        = "guardduty-high-severity"
  description = "GuardDuty high severity findings"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", 7] }]
    }
  })
}

resource "aws_cloudwatch_event_target" "notify" {
  rule      = aws_cloudwatch_event_rule.guardduty_findings.name
  target_id = "send-to-sns"
  arn       = aws_sns_topic.security_alerts.arn
}
```

## Security Best Practices Checklist

```
+--------------------------------------------------+
| CLOUD SECURITY CHECKLIST                         |
|                                                  |
| Identity:                                        |
| [x] No root account usage                       |
| [x] MFA on all human accounts                   |
| [x] Least-privilege IAM policies                |
| [x] Use IAM roles, not access keys              |
|                                                  |
| Data:                                            |
| [x] Encryption at rest (KMS)                    |
| [x] Encryption in transit (TLS)                 |
| [x] S3 bucket policies block public access      |
| [x] Secrets in Secrets Manager, not env vars    |
|                                                  |
| Network:                                         |
| [x] WAF on all public endpoints                 |
| [x] Security groups: least privilege             |
| [x] Private subnets for databases               |
| [x] VPC Flow Logs enabled                       |
|                                                  |
| Detection:                                       |
| [x] GuardDuty enabled                           |
| [x] CloudTrail logging to S3                    |
| [x] Config rules for compliance                 |
| [x] Security Hub for aggregated view            |
+--------------------------------------------------+
```

## Exercises

1. Create a KMS key with automatic rotation and a policy that allows only a specific IAM role to decrypt.

2. Set up Secrets Manager for a database password with 30-day automatic rotation.

3. Build a WAF configuration with rate limiting, SQL injection protection, and a geographic restriction that blocks requests from specific countries.

4. Enable GuardDuty and create an EventBridge rule that sends high-severity findings to an SNS topic.

5. Write an IAM policy that follows least-privilege for an application that needs to read from one S3 bucket and write to one DynamoDB table.

## Key Takeaways

```
+-------------------------------------------+
| CLOUD SECURITY PRINCIPLES                |
|                                           |
| 1. Encrypt everything, everywhere         |
| 2. Rotate secrets automatically           |
| 3. WAF protects at the edge             |
| 4. GuardDuty detects threats with ML     |
| 5. Defense in depth: multiple layers     |
| 6. Least privilege: minimum access       |
+-------------------------------------------+
```
