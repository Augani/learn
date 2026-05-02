# Reference: Terraform Commands and Patterns

## Core Commands

```
WORKFLOW

  terraform init -----> terraform plan -----> terraform apply
       |                     |                     |
  Download providers    Preview changes       Execute changes
  Set up backend        Show what will        Create/update/delete
  Initialize modules    happen (dry run)      resources

  terraform destroy     terraform fmt         terraform validate
       |                     |                     |
  Delete all            Format .tf files      Check syntax
  managed resources     (auto-indent)         (no provider needed)
```

```bash
terraform init                          # Initialize working directory
terraform init -upgrade                 # Upgrade providers to latest
terraform init -reconfigure             # Reconfigure backend
terraform init -migrate-state           # Migrate state to new backend

terraform plan                          # Preview changes
terraform plan -out=tfplan              # Save plan to file
terraform plan -target=aws_instance.web # Plan single resource
terraform plan -var="env=prod"          # Pass variable
terraform plan -destroy                 # Preview destroy

terraform apply                         # Apply changes (interactive)
terraform apply -auto-approve           # Skip confirmation
terraform apply tfplan                  # Apply saved plan
terraform apply -target=aws_s3_bucket.x # Apply single resource
terraform apply -replace=aws_instance.x # Force recreate resource

terraform destroy                       # Destroy all resources
terraform destroy -target=aws_s3_bucket # Destroy single resource
terraform destroy -auto-approve         # Skip confirmation

terraform fmt                           # Format current directory
terraform fmt -recursive                # Format all subdirectories
terraform fmt -check                    # Check without modifying

terraform validate                      # Validate configuration
terraform output                        # Show all outputs
terraform output vpc_id                 # Show specific output
terraform output -json                  # JSON format

terraform state list                    # List resources in state
terraform state show aws_instance.web   # Show resource details
terraform state mv a.old a.new          # Rename resource in state
terraform state rm aws_instance.web     # Remove from state (no delete)
terraform state pull                    # Download remote state
terraform state push                    # Upload state

terraform import aws_instance.web i-abc # Import existing resource
terraform refresh                       # Update state from real infra
terraform graph | dot -Tpng > graph.png # Visualize dependency graph
terraform providers                     # List required providers

terraform workspace list                # List workspaces
terraform workspace new staging         # Create workspace
terraform workspace select production   # Switch workspace
terraform workspace delete staging      # Delete workspace
```

## Variable Types

```hcl
variable "name" {
  type        = string
  description = "Application name"
}

variable "port" {
  type    = number
  default = 8080
}

variable "enabled" {
  type    = bool
  default = true
}

variable "tags" {
  type = map(string)
  default = {
    Environment = "dev"
  }
}

variable "subnet_ids" {
  type = list(string)
}

variable "config" {
  type = object({
    cpu    = number
    memory = number
    image  = string
  })
}

variable "services" {
  type = list(object({
    name = string
    port = number
  }))
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Must be dev, staging, or prod."
  }
}

variable "cidr" {
  type = string
  validation {
    condition     = can(cidrhost(var.cidr, 0))
    error_message = "Must be a valid CIDR block."
  }
}
```

## Common Patterns

### Dynamic Blocks

```hcl
resource "aws_security_group" "main" {
  name   = "app-sg"
  vpc_id = var.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
    }
  }
}
```

### for_each vs count

```hcl
resource "aws_s3_bucket" "with_count" {
  count  = 3
  bucket = "my-bucket-${count.index}"
}

resource "aws_s3_bucket" "with_for_each" {
  for_each = toset(["logs", "data", "artifacts"])
  bucket   = "my-${each.key}-bucket"
}

resource "aws_iam_user" "from_map" {
  for_each = {
    alice = "engineering"
    bob   = "platform"
  }
  name = each.key
  tags = { team = each.value }
}
```

### Conditional Resources

```hcl
resource "aws_cloudwatch_metric_alarm" "cpu" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name = "high-cpu"
  threshold  = 80
}

resource "aws_nat_gateway" "main" {
  count = var.environment == "prod" ? length(var.azs) : 1

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
}
```

### Data Sources

```hcl
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_vpc" "existing" {
  filter {
    name   = "tag:Name"
    values = ["production"]
  }
}
```

### Locals

```hcl
locals {
  name_prefix = "${var.project}-${var.environment}"
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  private_subnets = {
    for idx, az in var.azs :
    az => cidrsubnet(var.cidr, 8, idx + 10)
  }
}
```

### Lifecycle Rules

```hcl
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type

  lifecycle {
    create_before_destroy = true
    prevent_destroy       = true
    ignore_changes        = [ami, tags["LastUpdated"]]
  }
}
```

## Backend Configuration

```hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "project/env/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

## Module Patterns

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"
}

module "custom" {
  source = "../../modules/custom"
}

module "git_module" {
  source = "git::https://github.com/org/repo.git//modules/vpc?ref=v1.0.0"
}
```

## Built-in Functions

```
STRING:     format("Hello %s", var.name)
            join(", ", var.list)
            split(",", var.csv)
            replace(var.s, "old", "new")
            upper(var.s) / lower(var.s) / title(var.s)
            trimspace(var.s)
            substr(var.s, 0, 5)

NUMERIC:    min(1, 2, 3)  max(1, 2, 3)
            ceil(1.5)  floor(1.5)  abs(-5)

COLLECTION: length(var.list)
            contains(var.list, "x")
            concat(list1, list2)
            flatten([list1, [list2]])
            distinct(var.list)
            sort(var.list)
            merge(map1, map2)
            lookup(var.map, "key", "default")
            keys(var.map)  values(var.map)
            zipmap(keys, values)

TYPE:       tostring(42)  tonumber("42")  tobool("true")
            toset(var.list)  tolist(var.set)  tomap(var.obj)

NETWORK:    cidrsubnet("10.0.0.0/16", 8, 1)  => "10.0.1.0/24"
            cidrhost("10.0.1.0/24", 5)        => "10.0.1.5"

ENCODING:   jsonencode(var.obj)  jsondecode(var.json_string)
            yamlencode(var.obj)  yamldecode(var.yaml_string)
            base64encode(var.s)  base64decode(var.b64)

FILE:       file("path/to/file")
            fileexists("path")
            templatefile("tpl.tftpl", { name = "world" })

CRYPTO:     md5(var.s)  sha256(var.s)  bcrypt(var.password)
```
