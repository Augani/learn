# Lesson 10: Terraform Patterns

## The Big Analogy: LEGO Bricks vs Sculpture

```
MONOLITHIC TERRAFORM              MODULAR TERRAFORM
(One big sculpture)               (LEGO bricks)

+---------------------------+     +------+ +------+ +------+
| Everything in one file    |     | VPC  | |  ECS | | RDS  |
| VPC + EC2 + RDS + S3 +   |     |Module| |Module| |Module|
| IAM + Lambda + ...        |     +------+ +------+ +------+
| 2000 lines, fragile,      |
| hard to reuse              |     Snap together differently
+---------------------------+     for each environment.
                                  Reuse across projects.
```

## Modules: Reusable Infrastructure Components

```
MODULE STRUCTURE

  modules/
  +-- vpc/
  |   +-- main.tf        (resources)
  |   +-- variables.tf   (inputs)
  |   +-- outputs.tf     (return values)
  |
  +-- ecs-service/
  |   +-- main.tf
  |   +-- variables.tf
  |   +-- outputs.tf
  |
  +-- rds/
      +-- main.tf
      +-- variables.tf
      +-- outputs.tf

  environments/
  +-- dev/
  |   +-- main.tf        (calls modules with dev values)
  |   +-- terraform.tfvars
  |
  +-- prod/
      +-- main.tf        (calls modules with prod values)
      +-- terraform.tfvars
```

### Writing a Module

```hcl
variable "name" {
  type = string
}

variable "cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  type = list(string)
}

variable "private_subnets" {
  type = list(string)
}

variable "public_subnets" {
  type = list(string)
}

variable "enable_nat" {
  type    = bool
  default = true
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = var.name
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnets)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = var.azs[count.index % length(var.azs)]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.name}-public-${count.index}"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnets)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = var.azs[count.index % length(var.azs)]

  tags = {
    Name = "${var.name}-private-${count.index}"
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
}

resource "aws_eip" "nat" {
  count  = var.enable_nat ? 1 : 0
  domain = "vpc"
}

resource "aws_nat_gateway" "this" {
  count         = var.enable_nat ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
}

output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
```

### Using the Module

```hcl
module "vpc" {
  source = "../../modules/vpc"

  name            = "app-${var.environment}"
  cidr            = "10.0.0.0/16"
  azs             = ["us-east-1a", "us-east-1b"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]
  enable_nat      = var.environment == "prod"
}

module "database" {
  source = "../../modules/rds"

  name              = "app-db"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnet_ids
  instance_class    = var.environment == "prod" ? "db.r6g.large" : "db.t3.micro"
  multi_az          = var.environment == "prod"
}
```

## Workspaces: Same Config, Different State

```
WORKSPACES

  Same Terraform code, separate state files.
  Like having separate save slots in a video game.

  terraform workspace new dev
  terraform workspace new staging
  terraform workspace new prod

  +------------------+
  | main.tf          |
  +------------------+
         |
    +----+----+----+
    |    |    |    |
    v    v    v    v
  +---+ +---+ +---+
  |dev| |stg| |prd|  <-- Separate state files
  +---+ +---+ +---+
```

```hcl
locals {
  env_config = {
    dev = {
      instance_type = "t3.micro"
      min_capacity  = 1
      max_capacity  = 2
    }
    staging = {
      instance_type = "t3.small"
      min_capacity  = 2
      max_capacity  = 4
    }
    prod = {
      instance_type = "t3.medium"
      min_capacity  = 3
      max_capacity  = 10
    }
  }

  config = local.env_config[terraform.workspace]
}

resource "aws_instance" "web" {
  instance_type = local.config.instance_type

  tags = {
    Environment = terraform.workspace
  }
}
```

```bash
terraform workspace list

terraform workspace select prod

terraform workspace show

terraform plan
```

## Remote State Data Source

```
SHARING STATE BETWEEN PROJECTS

  Project: Networking           Project: Application
  +--------------------+       +--------------------+
  | VPC, Subnets,      |       | ECS, RDS, S3       |
  | Security Groups    |       |                    |
  +--------------------+       | data "terraform_   |
  | Output: vpc_id     |------>|   remote_state"    |
  | Output: subnet_ids |       |   { ... }          |
  +--------------------+       +--------------------+
```

```hcl
data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "my-terraform-state"
    key    = "networking/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_ecs_service" "web" {
  network_configuration {
    subnets = data.terraform_remote_state.networking.outputs.private_subnet_ids
  }
}
```

## DRY Patterns

```
DIRECTORY STRUCTURE FOR LARGE PROJECTS

  infrastructure/
  +-- modules/                    Reusable building blocks
  |   +-- vpc/
  |   +-- ecs-cluster/
  |   +-- ecs-service/
  |   +-- rds/
  |   +-- cdn/
  |
  +-- environments/               Environment-specific configs
  |   +-- dev/
  |   |   +-- main.tf            Calls modules, dev settings
  |   |   +-- terraform.tfvars
  |   |   +-- backend.tf
  |   |
  |   +-- staging/
  |   |   +-- main.tf
  |   |   +-- terraform.tfvars
  |   |   +-- backend.tf
  |   |
  |   +-- prod/
  |       +-- main.tf
  |       +-- terraform.tfvars
  |       +-- backend.tf
  |
  +-- global/                     Shared resources (IAM, DNS)
      +-- iam/
      +-- route53/
```

### Avoiding Repetition with .tfvars

```hcl
variable "environment" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "db_instance_class" {
  type = string
}

variable "enable_monitoring" {
  type    = bool
  default = false
}
```

```
dev.tfvars:
  environment       = "dev"
  instance_type     = "t3.micro"
  db_instance_class = "db.t3.micro"
  enable_monitoring = false

prod.tfvars:
  environment       = "prod"
  instance_type     = "t3.large"
  db_instance_class = "db.r6g.xlarge"
  enable_monitoring = true
```

```bash
terraform plan -var-file="environments/prod.tfvars"
```

## Best Practices

```
+--------------------------------------------------------------+
| TERRAFORM BEST PRACTICES                                      |
+--------------------------------------------------------------+
|                                                                |
| 1. NEVER commit terraform.tfstate or .tfvars with secrets     |
| 2. Always use remote state with locking                       |
| 3. Pin provider versions (~> 5.0, not >= 5.0)                |
| 4. Use modules for any repeated pattern                       |
| 5. Keep modules small and focused (single responsibility)     |
| 6. Run terraform fmt before committing                        |
| 7. Run terraform validate in CI                               |
| 8. Use data sources to reference existing resources           |
| 9. Tag everything (cost tracking, ownership)                  |
| 10. Use lifecycle rules for production resources:             |
|                                                                |
|   lifecycle {                                                  |
|     prevent_destroy = true                                     |
|   }                                                            |
|                                                                |
| 11. Use moved blocks for refactoring:                         |
|                                                                |
|   moved {                                                      |
|     from = aws_instance.old_name                               |
|     to   = aws_instance.new_name                               |
|   }                                                            |
+--------------------------------------------------------------+
```

## Exercises

1. Refactor a flat Terraform config into modules. Create a VPC
   module and an ECS module. Call both from a root module.

2. Create a module that accepts a variable for environment
   (dev/staging/prod) and adjusts instance sizes, counts, and
   features accordingly. Deploy to two environments.

3. Set up workspaces for dev and prod. Show that `terraform plan`
   in each workspace creates different resources.

4. Configure remote state sharing: create a networking project
   that outputs VPC IDs, and an application project that reads
   those outputs via `terraform_remote_state`.

5. Write a `.gitignore` for a Terraform project. Include all
   files that should never be committed (state, tfvars with
   secrets, .terraform directory, crash logs).

---

[Next: Lesson 11 - CI/CD for Infrastructure](11-cicd-infrastructure.md)
