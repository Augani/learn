# Lesson 15: Build a Multi-Environment AWS Infrastructure (Capstone)

> **The one thing to remember**: This lesson ties together everything
> you've learned. You'll build a production-grade AWS infrastructure
> with VPC, EC2, RDS, and S3 — using modules, remote state, variables,
> and a CI/CD pipeline. If you can build this, you can build real
> infrastructure for a real company.

---

## What We're Building

```
ARCHITECTURE OVERVIEW

  ┌─────────────────────────────────────────────────────────────┐
  │ AWS Account                                                  │
  │                                                              │
  │  ┌────────────────────── VPC (10.0.0.0/16) ──────────────┐  │
  │  │                                                        │  │
  │  │  Public Subnets                                        │  │
  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
  │  │  │ 10.0.1.0/24  │  │ 10.0.2.0/24  │  │ 10.0.3.0/24  │ │  │
  │  │  │   us-east-1a │  │   us-east-1b │  │   us-east-1c │ │  │
  │  │  │              │  │              │  │              │ │  │
  │  │  │  ┌────────┐  │  │  ┌────────┐  │  │              │ │  │
  │  │  │  │  EC2   │  │  │  │  EC2   │  │  │              │ │  │
  │  │  │  │  web-1 │  │  │  │  web-2 │  │  │              │ │  │
  │  │  │  └────────┘  │  │  └────────┘  │  │              │ │  │
  │  │  └──────────────┘  └──────────────┘  └──────────────┘ │  │
  │  │        │                  │                            │  │
  │  │        └──────┬───────────┘                            │  │
  │  │               v                                        │  │
  │  │        ┌──────────────┐                                │  │
  │  │        │     ALB      │ ← Application Load Balancer    │  │
  │  │        └──────────────┘                                │  │
  │  │                                                        │  │
  │  │  Private Subnets                                       │  │
  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
  │  │  │ 10.0.11.0/24 │  │ 10.0.12.0/24 │  │ 10.0.13.0/24│ │  │
  │  │  │   us-east-1a │  │   us-east-1b │  │   us-east-1c │ │  │
  │  │  │              │  │              │  │              │ │  │
  │  │  │  ┌────────┐  │  │  ┌────────┐  │  │              │ │  │
  │  │  │  │  RDS   │  │  │  │  RDS   │  │  │              │ │  │
  │  │  │  │ primary│  │  │  │standby │  │  │              │ │  │
  │  │  │  └────────┘  │  │  └────────┘  │  │              │ │  │
  │  │  └──────────────┘  └──────────────┘  └──────────────┘ │  │
  │  │                                                        │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                              │
  │  ┌──────────┐                                                │
  │  │ S3 Bucket│ ← Static assets / application data             │
  │  └──────────┘                                                │
  └─────────────────────────────────────────────────────────────┘
```

This is a classic three-tier architecture: load balancer in front,
web servers in public subnets, database in private subnets, S3 for
storage.

---

## Project Structure

```
PROJECT DIRECTORY

  infrastructure/
  ├── modules/
  │   ├── vpc/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   └── outputs.tf
  │   ├── compute/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   └── outputs.tf
  │   ├── database/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   └── outputs.tf
  │   └── storage/
  │       ├── main.tf
  │       ├── variables.tf
  │       └── outputs.tf
  ├── environments/
  │   ├── dev/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   ├── outputs.tf
  │   │   ├── backend.tf
  │   │   └── terraform.tfvars
  │   └── prod/
  │       ├── main.tf
  │       ├── variables.tf
  │       ├── outputs.tf
  │       ├── backend.tf
  │       └── terraform.tfvars
  └── .github/
      └── workflows/
          └── terraform.yml
```

---

## Module 1: VPC

**modules/vpc/variables.tf:**
```hcl
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
}
```

**modules/vpc/main.tf:**
```hcl
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.environment}-vpc"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.environment}-public-${count.index + 1}"
    Environment = var.environment
    Tier        = "public"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${var.environment}-private-${count.index + 1}"
    Environment = var.environment
    Tier        = "private"
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name        = "${var.environment}-igw"
    Environment = var.environment
  }
}

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name        = "${var.environment}-nat-eip"
    Environment = var.environment
  }
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name        = "${var.environment}-nat"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.this]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = {
    Name        = "${var.environment}-public-rt"
    Environment = var.environment
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }

  tags = {
    Name        = "${var.environment}-private-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.private_subnet_cidrs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
```

**modules/vpc/outputs.tf:**
```hcl
output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "vpc_cidr" {
  value = aws_vpc.this.cidr_block
}
```

---

## Module 2: Compute

**modules/compute/main.tf:**
```hcl
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "web" {
  name   = "${var.environment}-web-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-web-sg"
    Environment = var.environment
  }
}

resource "aws_security_group" "alb" {
  name   = "${var.environment}-alb-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-alb-sg"
    Environment = var.environment
  }
}

resource "aws_instance" "web" {
  count                  = var.instance_count
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = var.public_subnet_ids[count.index % length(var.public_subnet_ids)]
  vpc_security_group_ids = [aws_security_group.web.id]

  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd
    systemctl enable httpd
    echo "<h1>Hello from ${var.environment} server ${count.index + 1}</h1>" > /var/www/html/index.html
  EOF

  tags = {
    Name        = "${var.environment}-web-${count.index + 1}"
    Environment = var.environment
    Role        = "web"
  }
}

resource "aws_lb" "web" {
  name               = "${var.environment}-web-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = {
    Name        = "${var.environment}-web-alb"
    Environment = var.environment
  }
}

resource "aws_lb_target_group" "web" {
  name     = "${var.environment}-web-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 10
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_lb_target_group_attachment" "web" {
  count            = var.instance_count
  target_group_arn = aws_lb_target_group.web.arn
  target_id        = aws_instance.web[count.index].id
  port             = 80
}

resource "aws_lb_listener" "web" {
  load_balancer_arn = aws_lb.web.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}
```

**modules/compute/variables.tf:**
```hcl
variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "instance_type" {
  type    = string
  default = "t2.micro"
}

variable "instance_count" {
  type    = number
  default = 2
}
```

**modules/compute/outputs.tf:**
```hcl
output "alb_dns_name" {
  value = aws_lb.web.dns_name
}

output "instance_ids" {
  value = aws_instance.web[*].id
}

output "web_security_group_id" {
  value = aws_security_group.web.id
}
```

---

## Module 3: Database

**modules/database/main.tf:**
```hcl
resource "aws_security_group" "db" {
  name   = "${var.environment}-db-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.web_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-db-sg"
    Environment = var.environment
  }
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.environment}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.environment}-db-subnet-group"
    Environment = var.environment
  }
}

resource "aws_db_instance" "this" {
  identifier = "${var.environment}-postgres"

  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_storage_gb
  storage_encrypted    = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  multi_az             = var.multi_az
  db_subnet_group_name = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = var.environment == "prod" ? 7 : 1
  skip_final_snapshot     = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.environment}-final-snapshot" : null

  tags = {
    Name        = "${var.environment}-postgres"
    Environment = var.environment
  }
}
```

**modules/database/variables.tf:**
```hcl
variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "web_security_group_id" {
  type = string
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_storage_gb" {
  type    = number
  default = 20
}

variable "db_name" {
  type    = string
  default = "appdb"
}

variable "db_username" {
  type    = string
  default = "admin"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "multi_az" {
  type    = bool
  default = false
}
```

**modules/database/outputs.tf:**
```hcl
output "endpoint" {
  value = aws_db_instance.this.endpoint
}

output "db_name" {
  value = aws_db_instance.this.db_name
}

output "port" {
  value = aws_db_instance.this.port
}
```

---

## Module 4: Storage

**modules/storage/main.tf:**
```hcl
resource "aws_s3_bucket" "this" {
  bucket = "${var.project}-${var.environment}-${var.bucket_purpose}"

  tags = {
    Name        = "${var.project}-${var.environment}-${var.bucket_purpose}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

**modules/storage/variables.tf:**
```hcl
variable "environment" {
  type = string
}

variable "project" {
  type = string
}

variable "bucket_purpose" {
  type = string
}

variable "enable_versioning" {
  type    = bool
  default = true
}
```

**modules/storage/outputs.tf:**
```hcl
output "bucket_id" {
  value = aws_s3_bucket.this.id
}

output "bucket_arn" {
  value = aws_s3_bucket.this.arn
}

output "bucket_domain_name" {
  value = aws_s3_bucket.this.bucket_domain_name
}
```

---

## Environment: Dev

**environments/dev/main.tf:**
```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "vpc" {
  source = "../../modules/vpc"

  environment          = "dev"
  vpc_cidr             = "10.0.0.0/16"
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24"]
  availability_zones   = ["us-east-1a", "us-east-1b"]
}

module "compute" {
  source = "../../modules/compute"

  environment       = "dev"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  instance_type     = "t2.micro"
  instance_count    = 1
}

module "database" {
  source = "../../modules/database"

  environment           = "dev"
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  web_security_group_id = module.compute.web_security_group_id
  db_instance_class     = "db.t3.micro"
  db_storage_gb         = 20
  db_password           = var.db_password
  multi_az              = false
}

module "assets" {
  source = "../../modules/storage"

  environment  = "dev"
  project      = var.project_name
  bucket_purpose = "assets"
}
```

**environments/dev/terraform.tfvars:**
```hcl
aws_region   = "us-east-1"
project_name = "myapp"
```

---

## Environment: Prod

**environments/prod/main.tf:**
```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "vpc" {
  source = "../../modules/vpc"

  environment          = "prod"
  vpc_cidr             = "10.2.0.0/16"
  public_subnet_cidrs  = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
  private_subnet_cidrs = ["10.2.11.0/24", "10.2.12.0/24", "10.2.13.0/24"]
  availability_zones   = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

module "compute" {
  source = "../../modules/compute"

  environment       = "prod"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  instance_type     = "t3.large"
  instance_count    = 3
}

module "database" {
  source = "../../modules/database"

  environment           = "prod"
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  web_security_group_id = module.compute.web_security_group_id
  db_instance_class     = "db.r6g.large"
  db_storage_gb         = 100
  db_password           = var.db_password
  multi_az              = true
}

module "assets" {
  source = "../../modules/storage"

  environment    = "prod"
  project        = var.project_name
  bucket_purpose = "assets"
}

module "backups" {
  source = "../../modules/storage"

  environment    = "prod"
  project        = var.project_name
  bucket_purpose = "backups"
}
```

```
DEV vs PROD COMPARISON

                        Dev                 Prod
  ──────────────        ───                 ────
  VPC CIDR              10.0.0.0/16         10.2.0.0/16
  Availability Zones    2                   3
  Web Instances         1 x t2.micro        3 x t3.large
  Database              db.t3.micro         db.r6g.large
  DB Storage            20 GB               100 GB
  Multi-AZ DB           No                  Yes
  Backup Retention      1 day               7 days
  Final Snapshot        Skipped             Required
  S3 Buckets            assets              assets + backups

  Same modules. Different variables. Different scale.
```

---

## CI/CD Pipeline

**.github/workflows/terraform.yml:**
```yaml
name: Terraform
on:
  pull_request:
    paths: ['infrastructure/**']
  push:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Format Check
        run: terraform fmt -check -recursive
        working-directory: infrastructure

      - name: Validate Dev
        run: terraform init -backend=false && terraform validate
        working-directory: infrastructure/environments/dev

      - name: Validate Prod
        run: terraform init -backend=false && terraform validate
        working-directory: infrastructure/environments/prod

  plan-dev:
    needs: validate
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Plan Dev
        run: |
          terraform init
          terraform plan -out=tfplan
        working-directory: infrastructure/environments/dev
        env:
          TF_VAR_db_password: ${{ secrets.DEV_DB_PASSWORD }}

  apply-dev:
    needs: validate
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Apply Dev
        run: |
          terraform init
          terraform apply -auto-approve
        working-directory: infrastructure/environments/dev
        env:
          TF_VAR_db_password: ${{ secrets.DEV_DB_PASSWORD }}

  apply-prod:
    needs: apply-dev
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Apply Prod
        run: |
          terraform init
          terraform apply -auto-approve
        working-directory: infrastructure/environments/prod
        env:
          TF_VAR_db_password: ${{ secrets.PROD_DB_PASSWORD }}
```

```
CI/CD FLOW

  Pull Request:
    validate → plan-dev → (post plan to PR as comment)

  Merge to main:
    validate → apply-dev → (manual approval) → apply-prod

  Dev deploys automatically. Prod requires manual approval.
```

---

## Exercises

1. **Build it**: Follow this lesson step by step. Create the module
   structure and environment configurations. If you don't have AWS,
   use `terraform validate` and `terraform plan -target=module.vpc`
   with a mock provider.

2. **Add staging**: Create a `staging` environment that's between dev
   and prod in scale. 2 instances, multi-AZ database, 2 AZs.

3. **Add a module**: Create a `monitoring` module that sets up a
   CloudWatch dashboard and alarms. Wire it into both environments.

4. **Cost estimate**: Use `infracost` (free tool) to estimate the
   monthly cost of both dev and prod environments. How much does
   multi-AZ add?

5. **Destroy and rebuild**: Run `terraform destroy` on dev, then
   `terraform apply`. Everything should come back exactly the same.
   That's the promise of Infrastructure as Code.

---

Congratulations. You've built a production-grade multi-environment
infrastructure. The same patterns scale to hundreds of resources
and dozens of services. The modules grow, the environments multiply,
but the principles stay the same: declare what you want, version
control it, review changes, and let automation do the work.

---

[Reference: Terraform CLI & HCL](./reference-terraform.md)
