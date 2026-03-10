# Lesson 18: Capstone — Deploy a Full Application with Terraform

## The Project: Production-Ready Three-Tier Web App

```
ARCHITECTURE OVERVIEW

  Internet
     |
     v
  +--------+
  |CloudFrt|     CDN + WAF
  +---+----+
      |
      v
  +--------+     Application Load Balancer
  |  ALB   |     (public subnets)
  +---+----+
      |
      v
  +--------+     ECS Fargate Service
  | ECS    |     (private subnets)
  | Fargate|     Auto-scaling 2-10 tasks
  +---+----+
      |
  +---+----+----+
  |        |    |
  v        v    v
+----+  +----+ +----+
| RDS|  |Redis| | S3 |
|    |  |    |  |    |
+----+  +----+  +----+
 Multi-AZ  Cluster  Encrypted
```

## Project Structure

```
PROJECT LAYOUT

  infrastructure/
  +-- modules/
  |   +-- vpc/
  |   |   +-- main.tf
  |   |   +-- variables.tf
  |   |   +-- outputs.tf
  |   |
  |   +-- ecs/
  |   |   +-- main.tf
  |   |   +-- variables.tf
  |   |   +-- outputs.tf
  |   |
  |   +-- rds/
  |   |   +-- main.tf
  |   |   +-- variables.tf
  |   |   +-- outputs.tf
  |   |
  |   +-- redis/
  |   +-- s3/
  |   +-- monitoring/
  |
  +-- environments/
  |   +-- dev/
  |   |   +-- main.tf
  |   |   +-- terraform.tfvars
  |   |   +-- backend.tf
  |   |
  |   +-- prod/
  |       +-- main.tf
  |       +-- terraform.tfvars
  |       +-- backend.tf
  |
  +-- .github/
      +-- workflows/
          +-- terraform.yml
```

## Step 1: VPC Module

```hcl
variable "name" {
  type = string
}

variable "cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

resource "aws_vpc" "main" {
  cidr_block           = var.cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = var.name }
}

resource "aws_subnet" "public" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr, 8, count.index)
  availability_zone = var.azs[count.index]

  map_public_ip_on_launch = true
  tags = { Name = "${var.name}-public-${var.azs[count.index]}" }
}

resource "aws_subnet" "private" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr, 8, count.index + 10)
  availability_zone = var.azs[count.index]

  tags = { Name = "${var.name}-private-${var.azs[count.index]}" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = var.name }
}

resource "aws_eip" "nat" {
  count  = 1
  domain = "vpc"
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = var.name }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

output "vpc_id" { value = aws_vpc.main.id }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
```

## Step 2: ECS Fargate Module

```hcl
variable "name" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "public_subnet_ids" { type = list(string) }
variable "container_image" { type = string }
variable "container_port" { type = number, default = 8080 }
variable "cpu" { type = number, default = 256 }
variable "memory" { type = number, default = 512 }
variable "desired_count" { type = number, default = 2 }
variable "environment_variables" {
  type    = map(string)
  default = {}
}

resource "aws_ecs_cluster" "main" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_security_group" "alb" {
  name   = "${var.name}-alb"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name   = "${var.name}-ecs"
  vpc_id = var.vpc_id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "main" {
  name               = var.name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "app" {
  name        = var.name
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    interval            = 30
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.name}"
  retention_in_days = 30
}

resource "aws_ecs_task_definition" "app" {
  family                   = var.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = var.name
      image = var.container_image
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = [
        for key, value in var.environment_variables : {
          name  = key
          value = value
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  name            = var.name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.name
    container_port   = var.container_port
  }
}

resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.name}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 60.0
  }
}

data "aws_region" "current" {}
```

## Step 3: Environment Configuration

```hcl
terraform {
  required_version = ">= 1.7.0"

  backend "s3" {
    bucket         = "myapp-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "production"
      ManagedBy   = "terraform"
      Project     = "myapp"
    }
  }
}

module "vpc" {
  source = "../../modules/vpc"
  name   = "myapp-prod"
  cidr   = "10.0.0.0/16"
}

module "ecs" {
  source              = "../../modules/ecs"
  name                = "myapp-prod"
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_subnet_ids   = module.vpc.public_subnet_ids
  container_image     = "123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:latest"
  cpu                 = 512
  memory              = 1024
  desired_count       = 3

  environment_variables = {
    DATABASE_URL = "postgresql://${module.rds.endpoint}:5432/myapp"
    REDIS_URL    = "redis://${module.redis.endpoint}:6379"
    S3_BUCKET    = module.s3.bucket_name
    ENVIRONMENT  = "production"
  }
}
```

## Step 4: CI/CD Pipeline

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths: [infrastructure/**]
  pull_request:
    branches: [main]
    paths: [infrastructure/**]

permissions:
  id-token: write
  contents: read
  pull-requests: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform fmt -check -recursive
        working-directory: infrastructure
      - run: terraform init -backend=false
        working-directory: infrastructure/environments/prod
      - run: terraform validate
        working-directory: infrastructure/environments/prod

  plan:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - run: terraform init
        working-directory: infrastructure/environments/prod
      - run: terraform plan -no-color -out=tfplan
        working-directory: infrastructure/environments/prod
        id: plan
      - uses: actions/github-script@v7
        if: github.event_name == 'pull_request'
        with:
          script: |
            const plan = `${{ steps.plan.outputs.stdout }}`;
            const truncated = plan.length > 60000
              ? plan.substring(0, 60000) + '\n\n... truncated ...'
              : plan;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Terraform Plan\n\`\`\`\n${truncated}\n\`\`\``
            });

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - run: terraform init
        working-directory: infrastructure/environments/prod
      - run: terraform apply -auto-approve
        working-directory: infrastructure/environments/prod
```

## Deployment Checklist

```
PRE-DEPLOYMENT
[ ] Terraform state backend created (S3 + DynamoDB)
[ ] OIDC provider configured for GitHub Actions
[ ] Container image built and pushed to ECR
[ ] Domain name registered, hosted zone created
[ ] SSL certificate issued via ACM

DEPLOYMENT ORDER
[ ] 1. VPC (networking foundation)
[ ] 2. Security groups
[ ] 3. RDS (database, takes longest)
[ ] 4. ElastiCache (Redis)
[ ] 5. S3 buckets
[ ] 6. ECS cluster + service
[ ] 7. ALB + target groups
[ ] 8. CloudFront distribution
[ ] 9. WAF rules
[ ] 10. Monitoring + alarms
[ ] 11. DNS records

POST-DEPLOYMENT
[ ] Health check passing
[ ] Logs flowing to CloudWatch
[ ] Metrics visible in dashboard
[ ] Alarms configured and tested
[ ] Backup plan active
[ ] Cost alerts set up
```

## Exercises

1. Deploy the complete infrastructure from this lesson to a personal AWS account using Terraform. Use `t3.micro` instances and `db.t3.micro` for RDS to stay in free tier.

2. Add a monitoring module that creates CloudWatch alarms for: ECS CPU, ALB 5xx errors, RDS connections, and Redis memory.

3. Set up the GitHub Actions pipeline and verify that PRs show the Terraform plan as a comment.

4. Add a WAF module to protect the ALB with rate limiting and AWS managed rules.

5. Implement a blue-green deployment strategy by creating two ECS services behind the same ALB and using weighted target groups.

## Key Takeaways

```
+-------------------------------------------+
| CAPSTONE PROJECT CHECKLIST                |
|                                           |
| 1. Modular Terraform = reusable infra    |
| 2. Environments separate dev from prod   |
| 3. CI/CD automates plan and apply        |
| 4. Security at every layer              |
| 5. Monitoring from day one              |
| 6. Start small, iterate fast            |
+-------------------------------------------+
```
