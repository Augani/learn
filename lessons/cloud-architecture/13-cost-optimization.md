# Lesson 13: Cloud Cost Optimization

## The Big Analogy: Renting vs Owning vs Timeshares

```
ON-DEMAND                RESERVED             SPOT
(Hotel room)             (Annual lease)       (Last-minute deal)

  $200/night              $100/night           $40/night
  Cancel anytime          12-month commit      Can be evicted
  No commitment           Guaranteed room      No guarantee
  Most flexible           Predictable cost     Cheapest option

  BEST FOR:               BEST FOR:            BEST FOR:
  Unpredictable           Steady baseline      Batch jobs
  Spiky workloads         Production DBs       CI/CD runners
  Dev/test                Always-on services   Data processing
```

## Understanding Your Cloud Bill

```
TYPICAL AWS BILL BREAKDOWN

  +----------------------------------+
  |          Monthly Bill            |
  |                                  |
  |  Compute (EC2/ECS/Lambda)  40%  |
  |  ==================             |
  |                                  |
  |  Data Transfer              15%  |
  |  =========                       |
  |                                  |
  |  Storage (S3/EBS/EFS)      12%  |
  |  =======                         |
  |                                  |
  |  Database (RDS/DynamoDB)   20%  |
  |  ============                    |
  |                                  |
  |  Other (NAT GW, LB, etc)  13%  |
  |  ========                        |
  +----------------------------------+

  Surprise cost centers:
  - NAT Gateway data processing
  - Cross-AZ data transfer
  - Idle load balancers
  - Unattached EBS volumes
  - Old snapshots
```

## Reserved Instances and Savings Plans

```
COMMITMENT OPTIONS

  Savings          Flexibility       Payment
  +-----+          +-----+          +-----+
  | 72% |  <---->  | Low |  <---->  |AllUp|  All Upfront RI
  +-----+          +-----+          +-----+

  +-----+          +-----+          +-----+
  | 60% |  <---->  | Med |  <---->  |Part |  Partial Upfront RI
  +-----+          +-----+          +-----+

  +-----+          +-----+          +-----+
  | 40% |  <---->  |High |  <---->  |None |  No Upfront RI
  +-----+          +-----+          +-----+

  +-----+          +-----+          +-----+
  | 30% |  <---->  |V.Hi |  <---->  |None |  Compute Savings Plan
  +-----+          +-----+          +-----+
```

### Savings Plans vs Reserved Instances

```
RESERVED INSTANCES              SAVINGS PLANS
+----------------------+        +----------------------+
| Locked to:           |        | Commit to:           |
| - Instance type      |        | - $/hour spend       |
| - Region             |        |                      |
| - OS                 |        | Applies to:          |
|                      |        | - Any instance type  |
| Good: Maximum        |        | - Any region         |
|       savings        |        | - EC2, Fargate,      |
|                      |        |   Lambda             |
| Bad: Inflexible      |        |                      |
+----------------------+        | Good: Flexible       |
                                | Bad: Slightly less   |
                                |      savings         |
                                +----------------------+
```

```python
import boto3
from datetime import datetime, timedelta

ce = boto3.client("ce")

def get_savings_plan_recommendations() -> dict:
    response = ce.get_savings_plans_purchase_recommendation(
        SavingsPlansType="COMPUTE_SP",
        TermInYears="ONE_YEAR",
        PaymentOption="NO_UPFRONT",
        LookbackPeriodInDays="SIXTY_DAYS",
    )
    return response["SavingsPlansPurchaseRecommendation"]

def get_ri_recommendations(service: str) -> dict:
    response = ce.get_reservation_purchase_recommendation(
        Service=service,
        TermInYears="ONE_YEAR",
        PaymentOption="NO_UPFRONT",
        LookbackPeriodInDays="SIXTY_DAYS",
    )
    return response["Recommendations"]
```

## Spot Instances

```
SPOT INSTANCE LIFECYCLE

  You bid $0.05/hr           Spot price = $0.02/hr
       |                           |
       v                           v
  +----------+              +----------+
  | Request  |  price OK   |  Running |
  | Spot     |------------>|  Instance|
  +----------+              +----+-----+
                                  |
                     Spot price rises above bid
                                  |
                                  v
                            +----------+
                            |2-min warn|
                            |then TERM |
                            +----------+
```

```hcl
resource "aws_launch_template" "spot_workers" {
  name_prefix   = "spot-worker-"
  image_id      = data.aws_ami.ecs.id
  instance_type = "c5.xlarge"

  instance_market_options {
    market_type = "spot"
    spot_options {
      max_price                      = "0.10"
      spot_instance_type             = "one-time"
      instance_interruption_behavior = "terminate"
    }
  }
}

resource "aws_autoscaling_group" "spot_workers" {
  desired_capacity = 5
  max_size         = 20
  min_size         = 0

  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 2
      on_demand_percentage_above_base_capacity = 20
      spot_allocation_strategy                 = "capacity-optimized"
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.spot_workers.id
      }

      override {
        instance_type = "c5.xlarge"
      }
      override {
        instance_type = "c5a.xlarge"
      }
      override {
        instance_type = "c5d.xlarge"
      }
      override {
        instance_type = "m5.xlarge"
      }
    }
  }
}
```

## Right-Sizing

```
RIGHT-SIZING DECISION TREE

  Current instance: m5.2xlarge (8 vCPU, 32 GB)
  Avg CPU: 15%    Avg Memory: 25%

  Is avg CPU < 40%?
       |
       YES
       |
       v
  Is avg Memory < 40%?
       |
       YES
       |
       v
  Downsize to m5.large (2 vCPU, 8 GB)
  SAVINGS: 75%

  +------------------+------------------+
  | Before           | After            |
  | m5.2xlarge       | m5.large         |
  | $0.384/hr        | $0.096/hr        |
  | $280/month       | $70/month        |
  | CPU: 15%         | CPU: 60%         |
  | Mem: 25%         | Mem: ~80%        |
  +------------------+------------------+
```

```python
import boto3
from datetime import datetime, timedelta

def find_underutilized_instances(threshold_cpu: float = 20.0) -> list[dict]:
    ec2 = boto3.client("ec2")
    cw = boto3.client("cloudwatch")

    instances = ec2.describe_instances(
        Filters=[{"Name": "instance-state-name", "Values": ["running"]}]
    )

    underutilized = []

    for reservation in instances["Reservations"]:
        for instance in reservation["Instances"]:
            instance_id = instance["InstanceId"]

            stats = cw.get_metric_statistics(
                Namespace="AWS/EC2",
                MetricName="CPUUtilization",
                Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
                StartTime=datetime.utcnow() - timedelta(days=14),
                EndTime=datetime.utcnow(),
                Period=86400,
                Statistics=["Average"],
            )

            if not stats["Datapoints"]:
                continue

            avg_cpu = sum(d["Average"] for d in stats["Datapoints"]) / len(
                stats["Datapoints"]
            )

            if avg_cpu < threshold_cpu:
                underutilized.append(
                    {
                        "instance_id": instance_id,
                        "type": instance["InstanceType"],
                        "avg_cpu": round(avg_cpu, 2),
                    }
                )

    return underutilized
```

## Storage Cost Optimization

```
S3 STORAGE CLASSES (per GB/month)

  Standard          $0.023    Frequent access
  Intelligent-Tier  $0.023    Auto-tiering
  Standard-IA       $0.0125   Infrequent (30-day min)
  One Zone-IA       $0.010    Single AZ, infrequent
  Glacier Instant   $0.004    Millisecond retrieval
  Glacier Flexible  $0.0036   Minutes to hours
  Glacier Deep      $0.00099  12-48 hours retrieval

  USE LIFECYCLE POLICIES:
  Day 0 -----> Standard
  Day 30 ----> Standard-IA
  Day 90 ----> Glacier Instant
  Day 365 ---> Glacier Deep
  Day 730 ---> DELETE
```

```hcl
resource "aws_s3_bucket_lifecycle_configuration" "cost_optimized" {
  bucket = aws_s3_bucket.data.id

  rule {
    id     = "archive-old-data"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 730
    }
  }
}
```

## Cost Monitoring with AWS Budgets

```hcl
resource "aws_budgets_budget" "monthly" {
  name         = "monthly-total"
  budget_type  = "COST"
  limit_amount = "5000"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_email_addresses = ["team@example.com"]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = ["team@example.com"]
  }
}
```

## Exercises

1. Analyze a hypothetical workload running 10x m5.xlarge instances 24/7. Calculate savings with: No Upfront 1-year RIs, All Upfront 1-year RIs, and Compute Savings Plans.

2. Design a mixed fleet ASG that uses 2 on-demand instances as baseline and fills the rest with spot instances across 4 instance types.

3. Write a Python script using boto3 that finds all unattached EBS volumes and calculates the monthly waste.

4. Create S3 lifecycle rules for a data lake with hot (0-7 days), warm (7-90 days), and cold (90+ days) tiers.

5. Set up AWS Budgets with alerts at 50%, 80%, and 100% of a $3,000 monthly budget.

## Key Takeaways

```
+-------------------------------------------+
| COST OPTIMIZATION CHECKLIST               |
|                                           |
| 1. Right-size before committing           |
| 2. Use Savings Plans for steady base      |
| 3. Spot for fault-tolerant workloads      |
| 4. Lifecycle policies for storage         |
| 5. Watch NAT GW and data transfer        |
| 6. Set budgets with forecasted alerts     |
| 7. Review Cost Explorer weekly            |
+-------------------------------------------+
```
