# Lesson 17: AWS Well-Architected Framework

## The Big Analogy: Building Codes for the Cloud

```
PHYSICAL BUILDING CODES              WELL-ARCHITECTED FRAMEWORK

  Structural integrity  -------->    Reliability
  Fire safety           -------->    Security
  Energy efficiency     -------->    Cost Optimization
  Accessibility         -------->    Operational Excellence
  Speed of construction -------->    Performance Efficiency
  Environmental impact  -------->    Sustainability

  Building inspectors check codes.
  AWS Well-Architected Tool reviews your architecture.
```

## The Five Pillars

```
FIVE PILLARS OF WELL-ARCHITECTED

  +------------------+
  |  Operational     |  How do you run and monitor systems?
  |  Excellence      |
  +------------------+
  |  Security        |  How do you protect data and systems?
  +------------------+
  |  Reliability     |  How do you recover from failure?
  +------------------+
  |  Performance     |  How do you use resources efficiently?
  |  Efficiency      |
  +------------------+
  |  Cost            |  How do you avoid unnecessary spending?
  |  Optimization    |
  +------------------+

  +====================================+
  |        Sustainability              |  (6th pillar, added later)
  |  How do you minimize impact?       |
  +====================================+
```

## Pillar 1: Operational Excellence

```
OPERATIONAL EXCELLENCE PRINCIPLES

  +-------------------------------------------+
  | Perform operations as code                |
  | Make frequent, small, reversible changes  |
  | Refine operations procedures frequently   |
  | Anticipate failure                        |
  | Learn from operational failures           |
  +-------------------------------------------+

  MATURITY LEVELS:
  Level 1: Manual deploys, no runbooks
  Level 2: CI/CD, basic monitoring
  Level 3: IaC, automated testing, dashboards
  Level 4: Auto-remediation, chaos engineering
```

```hcl
resource "aws_ssm_document" "restart_service" {
  name            = "RestartECSService"
  document_type   = "Automation"
  document_format = "YAML"

  content = yamlencode({
    schemaVersion = "0.3"
    description   = "Restart an ECS service"
    parameters = {
      ClusterName = { type = "String" }
      ServiceName = { type = "String" }
    }
    mainSteps = [
      {
        name   = "restartService"
        action = "aws:executeAwsApi"
        inputs = {
          Service = "ecs"
          Api     = "UpdateService"
          cluster = "{{ ClusterName }}"
          service = "{{ ServiceName }}"
          forceNewDeployment = true
        }
      }
    ]
  })
}
```

## Pillar 2: Security

```
SECURITY DESIGN PRINCIPLES

  +-------------------------------------------+
  | Implement a strong identity foundation    |
  | Enable traceability                       |
  | Apply security at all layers             |
  | Automate security best practices         |
  | Protect data in transit and at rest      |
  | Keep people away from data               |
  | Prepare for security events              |
  +-------------------------------------------+

  IDENTITY -----> IAM, SSO, MFA
  DETECTION ----> GuardDuty, CloudTrail, Config
  PROTECTION ---> WAF, Shield, KMS, Secrets Manager
  RESPONSE -----> EventBridge, Lambda, Security Hub
```

```hcl
resource "aws_config_config_rule" "encrypted_volumes" {
  name = "encrypted-volumes"

  source {
    owner             = "AWS"
    source_identifier = "ENCRYPTED_VOLUMES"
  }
}

resource "aws_config_config_rule" "s3_bucket_public_read" {
  name = "s3-bucket-public-read-prohibited"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_READ_PROHIBITED"
  }
}

resource "aws_config_config_rule" "iam_root_access_key" {
  name = "iam-root-access-key-check"

  source {
    owner             = "AWS"
    source_identifier = "IAM_ROOT_ACCESS_KEY_CHECK"
  }
}
```

## Pillar 3: Reliability

```
RELIABILITY DESIGN PRINCIPLES

  +-------------------------------------------+
  | Automatically recover from failure        |
  | Test recovery procedures                  |
  | Scale horizontally                        |
  | Stop guessing capacity                    |
  | Manage change in automation              |
  +-------------------------------------------+

  FAILURE ISOLATION:

  Account Level:    Multi-account strategy
       |
  Region Level:     Multi-region deployment
       |
  AZ Level:         Multi-AZ (minimum)
       |
  Service Level:    Microservices isolation
       |
  Instance Level:   Auto-scaling groups

  Each level contains blast radius of failures below it.
```

```hcl
resource "aws_autoscaling_group" "reliable_app" {
  name                = "reliable-app"
  min_size            = 3
  max_size            = 12
  desired_capacity    = 6
  vpc_zone_identifier = module.vpc.private_subnet_ids

  health_check_type         = "ELB"
  health_check_grace_period = 300

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 90
    }
  }

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "reliable-app"
    propagate_at_launch = true
  }
}

resource "aws_autoscaling_policy" "target_tracking" {
  name                   = "target-tracking"
  autoscaling_group_name = aws_autoscaling_group.reliable_app.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0
  }
}
```

## Pillar 4: Performance Efficiency

```
PERFORMANCE EFFICIENCY PRINCIPLES

  +-------------------------------------------+
  | Democratize advanced technologies         |
  | Go global in minutes                      |
  | Use serverless architectures              |
  | Experiment more often                     |
  | Consider mechanical sympathy              |
  +-------------------------------------------+

  CHOOSING COMPUTE:

  Request-driven, short-lived -----> Lambda
  Container workloads ------------>  ECS/EKS Fargate
  Steady-state, compute-heavy ----> EC2 (right instance family)
  GPU/ML workloads --------------->  EC2 P/G instances, SageMaker

  CHOOSING STORAGE:

  Object storage -----> S3
  Block storage ------> EBS (gp3 for general, io2 for IOPS)
  File storage -------> EFS (Linux), FSx (Windows/Lustre)
  Caching ------------> ElastiCache (Redis/Memcached)
```

```hcl
resource "aws_elasticache_replication_group" "cache" {
  replication_group_id = "app-cache"
  description          = "Redis cache for hot data"
  node_type            = "cache.r6g.large"
  num_cache_clusters   = 3
  engine               = "redis"
  engine_version       = "7.0"

  automatic_failover_enabled = true
  multi_az_enabled           = true

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}
```

## Pillar 5: Cost Optimization

```
COST OPTIMIZATION PRINCIPLES

  +-------------------------------------------+
  | Implement cloud financial management      |
  | Adopt a consumption model                 |
  | Measure overall efficiency               |
  | Stop spending on undifferentiated lifting |
  | Analyze and attribute expenditure        |
  +-------------------------------------------+

  COST OPTIMIZATION LIFECYCLE:

  See -----> Understand your costs (Cost Explorer)
    |
  Plan ----> Budget and forecast (Budgets)
    |
  Run -----> Optimize resources (Right-sizing)
    |
  Track ---> Measure savings (Savings Plans)
    |
  Loop back to See
```

## Well-Architected Review Process

```
REVIEW PROCESS

  Step 1: Identify workload
  +---------------------------+
  | What are we reviewing?    |
  | Scope, components, users  |
  +---------------------------+
           |
           v
  Step 2: Answer questions per pillar
  +---------------------------+
  | 58 questions across       |
  | 5 pillars                 |
  | Rate: None/Some/Most/All  |
  +---------------------------+
           |
           v
  Step 3: Identify high-risk items
  +---------------------------+
  | HRI = potential for       |
  | significant business      |
  | impact                    |
  +---------------------------+
           |
           v
  Step 4: Create improvement plan
  +---------------------------+
  | Prioritize by business    |
  | impact and effort         |
  +---------------------------+
           |
           v
  Step 5: Make improvements
  +---------------------------+
  | Implement, verify,        |
  | re-review                 |
  +---------------------------+
```

## Well-Architected Lens Examples

```
SPECIFIC LENSES AVAILABLE

  +------------------------+-------------------------------+
  | Lens                   | Focus Area                    |
  +------------------------+-------------------------------+
  | Serverless             | Lambda, API Gateway, DynamoDB |
  | SaaS                   | Multi-tenant architecture     |
  | Machine Learning       | ML workload best practices    |
  | Data Analytics         | Data lakes, ETL, warehousing  |
  | Container              | ECS, EKS best practices       |
  | IoT                    | Edge computing, device mgmt   |
  | Financial Services     | Compliance, regulatory        |
  +------------------------+-------------------------------+
```

## Putting It All Together

```hcl
module "well_architected_app" {
  source = "./modules/app"

  operational_excellence = {
    iac_managed          = true
    ci_cd_pipeline       = true
    monitoring_enabled   = true
    runbooks_documented  = true
  }

  security = {
    encryption_at_rest   = true
    encryption_in_transit = true
    waf_enabled          = true
    guardduty_enabled    = true
    least_privilege_iam  = true
  }

  reliability = {
    multi_az             = true
    auto_scaling         = true
    health_checks        = true
    backup_enabled       = true
    dr_strategy          = "pilot-light"
  }

  performance = {
    caching_enabled      = true
    cdn_enabled          = true
    right_sized          = true
    serverless_where_fit = true
  }

  cost = {
    savings_plans        = true
    lifecycle_policies   = true
    budget_alerts        = true
    tagging_enforced     = true
  }
}
```

## Exercises

1. Conduct a mini Well-Architected review of a personal project. Answer 3 key questions from each pillar and identify the top 3 high-risk items.

2. For each pillar, list the top 3 AWS services that support it. Explain why each service belongs to that pillar.

3. Design an architecture that scores well across all 5 pillars for a web application with: 10K daily users, HIPAA compliance requirements, and a $5K/month budget.

4. Create AWS Config rules that check for: unencrypted EBS volumes, public S3 buckets, overly permissive security groups, and missing tags.

5. Write a cost optimization plan for a startup that is currently 100% on-demand EC2. Include right-sizing analysis, savings plans recommendation, and storage tiering.

## Key Takeaways

```
+-------------------------------------------+
| WELL-ARCHITECTED FRAMEWORK                |
|                                           |
| 1. Five pillars: not one is optional      |
| 2. Review regularly, not just once        |
| 3. Trade-offs exist between pillars       |
| 4. Use the WA Tool for guided reviews    |
| 5. Lenses customize for your workload    |
| 6. Architecture is never "done"          |
+-------------------------------------------+
```
