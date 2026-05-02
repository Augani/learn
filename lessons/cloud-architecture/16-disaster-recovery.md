# Lesson 16: Disaster Recovery

## The Big Analogy: Fire Safety Plan

```
DISASTER RECOVERY = FIRE SAFETY

  Prevention         Detection         Response          Recovery
  (Smoke detectors)  (Fire alarm)      (Evacuation)      (Rebuild)

  Backups            Monitoring        Failover           Restore
  Redundancy         Health checks     Runbooks           Verify
  Multi-AZ           Alerting          Communication      Post-mortem

  You don't build fire exits DURING a fire.
  You don't build DR DURING an outage.
```

## RTO and RPO

```
THE TWO NUMBERS THAT DEFINE YOUR DR STRATEGY

  Time --->

  Last backup     Disaster      Service restored
      |               |               |
      v               v               v
  ----+-------X-------+---------------+---->
      |<----->|       |<------------->|
         RPO              RTO

  RPO (Recovery Point Objective):
    How much data can you AFFORD TO LOSE?
    RPO = 1 hour means you accept losing up to 1 hour of data.

  RTO (Recovery Time Objective):
    How LONG can you be down?
    RTO = 4 hours means service must be back within 4 hours.

  +------------------+--------+--------+--------+
  | Strategy         | RTO    | RPO    | Cost   |
  +------------------+--------+--------+--------+
  | Backup/Restore   | Hours  | Hours  | $      |
  | Pilot Light      | 10 min | Minutes| $$     |
  | Warm Standby     | Minutes| Seconds| $$$    |
  | Active-Active    | ~Zero  | ~Zero  | $$$$   |
  +------------------+--------+--------+--------+
```

## DR Strategy Spectrum

```
BACKUP & RESTORE          PILOT LIGHT
(Cheapest, slowest)       (Core running, scale up)

  Primary Region           Primary     DR Region
  +-----------+            +-----+     +-----+
  | Full App  |            | App |     |Core |
  | Running   |            |     |     |only |
  +-----------+            +-----+     +-----+
       |                      |           |
       v                      v           v
  [S3 Backup]              [DB]  --->  [DB replica]
                                       (running)
  On disaster:                         App servers stopped
  1. Restore from S3
  2. Provision infra         On disaster:
  3. Deploy app              1. Scale up DR
  4. Switch DNS              2. Start app servers
                             3. Promote DB
  RTO: hours                 4. Switch DNS
  RPO: hours
                             RTO: 10-30 min
                             RPO: minutes


WARM STANDBY              ACTIVE-ACTIVE
(Scaled-down copy)        (Full copies everywhere)

  Primary     DR Region    Region A     Region B
  +-----+     +-----+     +-----+      +-----+
  | App |     | App |     | App |      | App |
  | x10 |     | x2  |     | x10 |     | x10 |
  +-----+     +-----+     +-----+      +-----+
     |           |            |            |
  +-----+     +-----+     +-----+      +-----+
  | DB  |--->| DB  |     | DB  |<---->| DB  |
  +-----+     +-----+     +-----+      +-----+

  On disaster:              Both serve traffic
  1. Scale up DR to full    Automatic failover
  2. Promote DB             No manual steps
  3. Switch DNS
                            RTO: ~0
  RTO: minutes              RPO: ~0 (or eventual)
  RPO: seconds              Cost: 2x
```

## Backup Strategies

```
BACKUP TYPES

  Full Backup         Incremental          Differential
  (Everything)        (Changes since       (Changes since
                       last backup)         last FULL backup)

  Day 1: [AAABBB]    Day 1: [AAABBB]     Day 1: [AAABBB]
  Day 2: [AAABBB]    Day 2: [..C...]      Day 2: [..C...]
  Day 3: [AAABBB]    Day 3: [.....D]      Day 3: [..C..D]
  Day 4: [AAABBB]    Day 4: [E.....]      Day 4: [E.C..D]

  Restore: latest     Restore: Full +      Restore: Full +
  full backup         ALL incrementals     latest differential

  Slow backup         Fast backup          Medium backup
  Fast restore        Slow restore         Medium restore
```

```hcl
resource "aws_backup_plan" "production" {
  name = "production-backup-plan"

  rule {
    rule_name         = "daily-backup"
    target_vault_name = aws_backup_vault.production.name
    schedule          = "cron(0 2 * * ? *)"

    lifecycle {
      cold_storage_after = 30
      delete_after       = 365
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.dr_region.arn
      lifecycle {
        delete_after = 365
      }
    }
  }

  rule {
    rule_name         = "hourly-backup"
    target_vault_name = aws_backup_vault.production.name
    schedule          = "cron(0 * * * ? *)"

    lifecycle {
      delete_after = 7
    }
  }
}

resource "aws_backup_selection" "production" {
  name         = "production-resources"
  iam_role_arn = aws_iam_role.backup.arn
  plan_id      = aws_backup_plan.production.id

  selection_tag {
    type  = "STRINGEQUALS"
    key   = "Environment"
    value = "production"
  }
}
```

## Pilot Light Implementation

```hcl
module "dr_database" {
  source = "./modules/rds"

  providers = {
    aws = aws.dr_region
  }

  replicate_source_db = module.primary_database.db_arn
  instance_class      = "db.r6g.large"
  multi_az            = false

  tags = {
    Environment = "dr"
    Role        = "pilot-light"
  }
}

resource "aws_launch_template" "dr_app" {
  provider = aws.dr_region

  name_prefix   = "dr-app-"
  image_id      = data.aws_ami.app_dr.id
  instance_type = "t3.micro"
}

resource "aws_autoscaling_group" "dr_app" {
  provider = aws.dr_region

  desired_capacity = 0
  min_size         = 0
  max_size         = 20

  launch_template {
    id      = aws_launch_template.dr_app.id
    version = "$Latest"
  }
}
```

### Failover Automation

```python
import boto3

def execute_failover(dr_region: str, primary_region: str) -> None:
    asg = boto3.client("autoscaling", region_name=dr_region)
    rds = boto3.client("rds", region_name=dr_region)
    route53 = boto3.client("route53")

    print("Step 1: Promote DR database to primary")
    rds.promote_read_replica_db_cluster(
        DBClusterIdentifier="dr-database-cluster"
    )

    waiter = rds.get_waiter("db_cluster_available")
    waiter.wait(DBClusterIdentifier="dr-database-cluster")

    print("Step 2: Scale up application servers")
    asg.update_auto_scaling_group(
        AutoScalingGroupName="dr-app-asg",
        MinSize=4,
        DesiredCapacity=10,
        MaxSize=20,
    )

    print("Step 3: Wait for instances to be healthy")
    asg_waiter = boto3.client("autoscaling", region_name=dr_region)
    import time
    time.sleep(120)

    print("Step 4: Update DNS to point to DR region")
    route53.change_resource_record_sets(
        HostedZoneId="Z1234567890",
        ChangeBatch={
            "Changes": [
                {
                    "Action": "UPSERT",
                    "ResourceRecordSet": {
                        "Name": "app.example.com",
                        "Type": "A",
                        "AliasTarget": {
                            "HostedZoneId": "Z9876543210",
                            "DNSName": "dr-alb.eu-west-1.elb.amazonaws.com",
                            "EvaluateTargetHealth": True,
                        },
                    },
                }
            ]
        },
    )

    print("Failover complete")
```

## DR Testing

```
DR TEST TYPES

  Tabletop Exercise        Simulated Failover       Full Failover
  (Discussion only)        (Parallel environment)   (Actually switch)

  "What would we do        Deploy DR, verify         Cut over production
   if us-east-1 went       it works, then            to DR region, run
   down?"                  tear it down              for 24 hours

  Frequency: Monthly       Frequency: Quarterly      Frequency: Annually
  Risk: None               Risk: Low                 Risk: Medium
  Cost: $0                 Cost: $$                  Cost: $$$
  Value: Medium            Value: High               Value: Highest
```

## Exercises

1. For a SaaS application with RTO=15 minutes and RPO=5 minutes, determine which DR strategy is appropriate. Design the architecture.

2. Create an AWS Backup plan that takes hourly snapshots (kept 7 days), daily snapshots (kept 30 days), and copies daily backups to a DR region.

3. Write a failover automation script that promotes an RDS read replica, scales up an ASG, and updates Route 53 DNS.

4. Design a pilot light architecture for a three-tier web app (ALB + ECS + RDS). Specify what runs at all times and what gets activated on failover.

5. Create a tabletop exercise checklist for your team: 10 questions to walk through during a DR discussion.

## Key Takeaways

```
+-------------------------------------------+
| DISASTER RECOVERY ESSENTIALS              |
|                                           |
| 1. Define RTO/RPO before choosing DR     |
| 2. Cheaper DR = longer recovery time     |
| 3. Automate failover - no manual steps   |
| 4. Test DR regularly or it won't work    |
| 5. Cross-region backups are essential    |
| 6. DR is an investment, not an expense   |
+-------------------------------------------+
```
