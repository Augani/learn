# Reference: Terraform CLI & HCL Syntax

> Quick reference for Terraform commands and HCL patterns. Keep this
> open while working through the lessons.

---

## CLI Commands

### Core Workflow

```bash
terraform init                    # Download providers, set up backend
terraform plan                    # Preview changes (read-only)
terraform apply                   # Apply changes (creates/updates/deletes)
terraform destroy                 # Destroy all managed resources
```

### Planning Options

```bash
terraform plan -out=tfplan        # Save plan to file
terraform apply tfplan            # Apply a saved plan (no confirmation needed)
terraform plan -target=aws_instance.web   # Plan only one resource
terraform plan -var="env=prod"    # Pass variable on command line
terraform plan -var-file=prod.tfvars      # Use specific var file
terraform plan -refresh-only      # Only detect drift, don't propose code changes
terraform plan -detailed-exitcode # Exit 0=no changes, 1=error, 2=changes
terraform plan -destroy           # Preview what destroy would do
```

### State Commands

```bash
terraform state list              # List all resources in state
terraform state show aws_instance.web     # Show one resource's details
terraform state mv OLD NEW        # Rename a resource in state
terraform state rm aws_instance.web       # Remove resource from state (doesn't delete it)
terraform state pull              # Download remote state to stdout
terraform state push              # Upload local state to remote backend
```

### Import

```bash
terraform import aws_instance.web i-0123456789   # Import existing resource
```

Declarative import (Terraform 1.5+):
```hcl
import {
  to = aws_instance.web
  id = "i-0123456789"
}
```

### Workspace Commands

```bash
terraform workspace list          # List workspaces
terraform workspace new dev       # Create workspace
terraform workspace select dev    # Switch workspace
terraform workspace delete dev    # Delete workspace
terraform workspace show          # Show current workspace
```

### Utility Commands

```bash
terraform fmt                     # Format .tf files
terraform fmt -check              # Check formatting (CI-friendly)
terraform fmt -recursive          # Format all subdirectories
terraform validate                # Validate syntax and types
terraform output                  # Show all outputs
terraform output public_ip        # Show one output
terraform output -json            # Outputs as JSON
terraform graph                   # Generate dependency graph (DOT format)
terraform console                 # Interactive expression evaluator
terraform providers               # Show required providers
terraform version                 # Show Terraform version
```

### Force and Override

```bash
terraform apply -auto-approve     # Skip confirmation (CI/CD only)
terraform destroy -auto-approve   # Skip confirmation (CI/CD only)
terraform force-unlock LOCK_ID    # Remove stuck state lock
terraform taint aws_instance.web  # Mark for recreation (deprecated)
terraform untaint aws_instance.web # Unmark (deprecated)
terraform apply -replace=aws_instance.web  # Replace specific resource
```

---

## HCL Syntax Reference

### Block Types

```hcl
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "my-state-bucket"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
  alias  = "east"
}

resource "aws_instance" "web" {
  ami           = "ami-abc123"
  instance_type = "t2.micro"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
  sensitive   = false
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Must be dev, staging, or prod."
  }
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.web.id
  sensitive   = false
}

locals {
  name_prefix = "${var.project}-${var.environment}"
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "vpc" {
  source  = "./modules/vpc"
  version = "1.0.0"        # Only for registry modules
  environment = var.environment
  providers = {
    aws = aws.east
  }
}
```

### Variable Types

```hcl
type = string               # "hello"
type = number               # 42
type = bool                 # true / false
type = list(string)         # ["a", "b", "c"]
type = set(string)          # toset(["a", "b", "c"])
type = map(string)          # { key = "value" }
type = map(number)          # { port = 8080 }
type = object({             # Structured type
  name = string
  port = number
  tags = map(string)
})
type = tuple([string, number, bool])  # Fixed-type list
type = any                  # Accepts anything (avoid when possible)
```

### Version Constraints

```hcl
version = "5.0.0"          # Exact version
version = ">= 5.0"         # Minimum version
version = "~> 5.0"         # >= 5.0.0, < 6.0.0  (pessimistic)
version = "~> 5.0.1"       # >= 5.0.1, < 5.1.0  (patch-level pessimistic)
version = ">= 5.0, < 6.0"  # Range
```

### References

```hcl
var.environment                     # Input variable
local.name_prefix                   # Local value
aws_instance.web.id                 # Resource attribute
data.aws_ami.ubuntu.id              # Data source attribute
module.vpc.vpc_id                   # Module output
terraform.workspace                 # Current workspace name
path.module                         # Directory of current module
path.root                           # Directory of root module
path.cwd                            # Current working directory
```

### Iteration

```hcl
resource "aws_instance" "web" {
  count = 3                         # Create 3 copies: web[0], web[1], web[2]
  tags = { Name = "web-${count.index}" }
}

resource "aws_instance" "server" {
  for_each = toset(["web", "api"])  # Named copies: server["web"], server["api"]
  tags = { Name = each.key }
}

resource "aws_instance" "server" {
  for_each = var.servers            # Map iteration
  instance_type = each.value.type   # each.key = map key, each.value = map value
}

dynamic "ingress" {                 # Generate nested blocks
  for_each = var.ports
  content {
    from_port = ingress.value
    to_port   = ingress.value
    protocol  = "tcp"
  }
}
```

### Expressions

```hcl
condition ? true_val : false_val    # Ternary

[for s in var.list : upper(s)]                    # List transform
{for k, v in var.map : k => upper(v)}             # Map transform
[for s in var.list : s if s != "exclude"]          # Filter

"Hello, ${var.name}!"               # String interpolation
"prefix-${var.env == "prod" ? "production" : var.env}"

<<-EOF                              # Heredoc (multi-line string)
  line one
  line two
EOF
```

---

## Common Functions

### Strings
```hcl
upper("hello")                      # "HELLO"
lower("HELLO")                      # "hello"
title("hello world")                # "Hello World"
trimspace("  hi  ")                 # "hi"
replace("hello", "l", "r")         # "herro"
split(",", "a,b,c")                # ["a", "b", "c"]
join("-", ["a", "b", "c"])         # "a-b-c"
format("Hello, %s!", "world")      # "Hello, world!"
substr("hello", 0, 3)             # "hel"
regex("^([a-z]+)-([0-9]+)$", "web-01")  # ["web", "01"]
```

### Collections
```hcl
length([1, 2, 3])                   # 3
element(["a","b","c"], 1)           # "b"
index(["a","b","c"], "b")           # 1
contains(["a","b"], "b")            # true
concat([1,2], [3,4])               # [1,2,3,4]
flatten([[1,2],[3,[4,5]]])          # [1,2,3,4,5]
distinct([1,2,2,3])                # [1,2,3]
sort(["c","a","b"])                # ["a","b","c"]
reverse([1,2,3])                   # [3,2,1]
slice(["a","b","c","d"], 1, 3)     # ["b","c"]
keys({a=1, b=2})                   # ["a","b"]
values({a=1, b=2})                 # [1,2]
merge({a=1}, {b=2})                # {a=1, b=2}
lookup({a=1, b=2}, "a", 0)         # 1
zipmap(["a","b"], [1,2])           # {a=1, b=2}
```

### Numeric
```hcl
min(1, 2, 3)                       # 1
max(1, 2, 3)                       # 3
abs(-5)                            # 5
ceil(4.1)                          # 5
floor(4.9)                         # 4
pow(2, 3)                          # 8
```

### Type Conversion
```hcl
tostring(42)                       # "42"
tonumber("42")                     # 42
tobool("true")                     # true
tolist(toset(["a","b"]))           # ["a","b"]
toset(["a","b","a"])               # ["a","b"]
tomap({a=1})                       # {a=1}
```

### Encoding
```hcl
jsonencode({a = 1})                # "{\"a\":1}"
jsondecode("{\"a\":1}")            # {a = 1}
yamlencode({a = 1})                # "a: 1\n"
yamldecode("a: 1")                 # {a = "1"}
base64encode("hello")             # "aGVsbG8="
base64decode("aGVsbG8=")          # "hello"
```

### File System
```hcl
file("${path.module}/script.sh")   # Read file contents
fileexists("${path.module}/x.txt") # true/false
templatefile("tmpl.tpl", {name="web"})  # Render template
```

### IP/CIDR
```hcl
cidrsubnet("10.0.0.0/16", 8, 1)   # "10.0.1.0/24"
cidrhost("10.0.1.0/24", 5)        # "10.0.1.5"
cidrnetmask("10.0.0.0/16")        # "255.255.0.0"
```

### Error Handling
```hcl
try(var.map["key"], "default")     # Safe access with fallback
can(tonumber(var.input))           # Returns true/false without error
coalesce("", "", "hello")         # First non-empty: "hello"
coalescelist([], [], [1,2])       # First non-empty list: [1,2]
one(toset(["single"]))            # Extract single element, error if >1
```

---

## Lifecycle Meta-Arguments

```hcl
resource "aws_instance" "web" {
  lifecycle {
    create_before_destroy = true    # Create replacement before destroying old
    prevent_destroy       = true    # Block terraform destroy (safety net)
    ignore_changes        = [tags]  # Don't track changes to tags
    ignore_changes        = [all]   # Don't track any changes
    replace_triggered_by  = [       # Recreate when these change
      aws_security_group.web.id
    ]

    precondition {
      condition     = var.instance_type != "t2.nano"
      error_message = "t2.nano is too small for production."
    }

    postcondition {
      condition     = self.public_ip != ""
      error_message = "Instance must have a public IP."
    }
  }
}
```

---

## .gitignore for Terraform

```
.terraform/
*.tfstate
*.tfstate.backup
*.tfplan
*.tfvars
!example.tfvars
.terraform.lock.hcl
```

Note: Some teams DO commit `.terraform.lock.hcl` for reproducible
builds. Decide as a team and be consistent.

---

[Reference: Provider Resources (AWS/GCP/Azure)](./reference-providers.md)
