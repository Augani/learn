# Lesson 9: Terraform Basics

## The Big Analogy: Blueprints for a Building

```
TRADITIONAL CONSTRUCTION             TERRAFORM
(Manual / ClickOps)                  (Infrastructure as Code)

"Go add a wall here,                 "Here are the blueprints.
 paint it blue,                       Build exactly this."
 and put a door there."
                                     +------------------+
Result: Every building               | Blueprint (HCL)  |
is slightly different.               |  - 3 rooms       |
Nobody remembers exactly             |  - Blue walls     |
what was done.                       |  - 2 doors        |
                                     +------------------+
                                     Result: Reproducible.
                                     Version controlled.
                                     Same every time.
```

## HCL Syntax: The Language of Terraform

```
TERRAFORM FILE STRUCTURE

  main.tf          - Primary resources
  variables.tf     - Input variables
  outputs.tf       - Output values
  providers.tf     - Provider configuration
  terraform.tfvars - Variable values (DO NOT commit secrets)

  HCL BLOCK TYPES:
  +------------------------------------------+
  | terraform { }   - Settings & backends    |
  | provider { }    - Cloud provider config  |
  | resource { }    - Infrastructure to create|
  | data { }        - Read existing infra    |
  | variable { }    - Input parameters       |
  | output { }      - Return values          |
  | locals { }      - Computed values        |
  | module { }      - Reusable components    |
  +------------------------------------------+
```

### Core HCL Syntax

```hcl
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "instance_count" {
  type    = number
  default = 2
}

locals {
  name_prefix = "app-${var.environment}"
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "cloud-track"
  }
}
```

### Resources and Data Sources

```hcl
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "web" {
  count         = var.instance_count
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-web-${count.index}"
  })
}

output "instance_ips" {
  value = aws_instance.web[*].public_ip
}

output "instance_ids" {
  value = aws_instance.web[*].id
}
```

## The Plan/Apply Workflow

```
TERRAFORM WORKFLOW

  terraform init        terraform plan        terraform apply
  +---------------+     +---------------+     +---------------+
  | Download      |     | Compare       |     | Execute the   |
  | providers     |---->| desired state |---->| changes       |
  | Initialize    |     | vs current    |     | Update state  |
  | backend       |     | Show diff     |     | file          |
  +---------------+     +---------------+     +---------------+

  terraform destroy
  +---------------+
  | Remove all    |
  | resources     |
  | managed by    |
  | this config   |
  +---------------+

  PLAN OUTPUT LEGEND:
  + create    (new resource)
  - destroy   (remove resource)
  ~ update    (modify in-place)
  -/+ replace (destroy and recreate)
```

```bash
terraform init

terraform plan -out=tfplan

terraform apply tfplan

terraform plan -destroy

terraform destroy
```

## State: Terraform's Memory

```
STATE FILE (terraform.tfstate)

  Terraform's record of what it has created.
  Maps your HCL config to real cloud resources.

  YOUR CONFIG (main.tf)         STATE FILE              AWS
  +------------------+         +------------------+    +--------+
  | resource "aws_   |         | aws_instance.web |    | i-abc  |
  |   instance" "web"|<------->| id: i-abc123     |<-->| actual |
  | instance_type:   |         | type: t3.micro   |    | EC2    |
  |   t3.micro       |         | ip: 1.2.3.4      |    |instance|
  +------------------+         +------------------+    +--------+

  CRITICAL RULES:
  1. NEVER edit state manually
  2. NEVER commit state to git (contains secrets)
  3. Use remote state for team work
  4. Lock state during applies

  STATE COMMANDS:
  terraform state list              # List all resources
  terraform state show <resource>   # Show resource details
  terraform state mv <src> <dst>    # Rename/move resource
  terraform state rm <resource>     # Remove from state (not cloud)
```

### Remote State with S3

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

```hcl
resource "aws_s3_bucket" "terraform_state" {
  bucket = "my-terraform-state"
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
```

## Resource Dependencies

```
IMPLICIT vs EXPLICIT DEPENDENCIES

  IMPLICIT (Terraform figures it out):
  resource "aws_instance" "web" {
    subnet_id = aws_subnet.public.id   <-- depends on subnet
  }

  Terraform builds a dependency graph:

  VPC --> Subnet --> Security Group --> EC2 Instance
   |                                       |
   +---> Internet Gateway                  +---> EBS Volume

  EXPLICIT (when Terraform cannot infer):
  resource "aws_instance" "web" {
    depends_on = [aws_iam_role_policy_attachment.web]
  }
```

## Loops and Conditionals

```hcl
variable "subnets" {
  type = map(object({
    cidr = string
    az   = string
    public = bool
  }))
  default = {
    public-a  = { cidr = "10.0.1.0/24", az = "us-east-1a", public = true }
    public-b  = { cidr = "10.0.2.0/24", az = "us-east-1b", public = true }
    private-a = { cidr = "10.0.10.0/24", az = "us-east-1a", public = false }
    private-b = { cidr = "10.0.11.0/24", az = "us-east-1b", public = false }
  }
}

resource "aws_subnet" "this" {
  for_each = var.subnets

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = each.value.public

  tags = {
    Name = each.key
  }
}

resource "aws_nat_gateway" "main" {
  count = var.environment == "prod" ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.this["public-a"].id
}
```

## Exercises

1. Create a Terraform project from scratch: `main.tf`,
   `variables.tf`, `outputs.tf`. Define an AWS provider and
   create a VPC with one subnet. Run `init`, `plan`, `apply`.

2. Set up remote state: create an S3 bucket and DynamoDB table
   for state locking. Migrate your local state to the remote
   backend using `terraform init -migrate-state`.

3. Use `for_each` to create 4 subnets (2 public, 2 private)
   from a map variable. Output all subnet IDs.

4. Run `terraform state list` and `terraform state show` on a
   resource you created. Understand what Terraform tracks.

5. Create a resource, then rename it in your config (but keep
   the same cloud resource). Use `terraform state mv` to update
   the state without destroying and recreating.

---

[Next: Lesson 10 - Terraform Patterns](10-terraform-patterns.md)
