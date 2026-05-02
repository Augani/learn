# Lesson 05: Variables and Outputs

> **The one thing to remember**: Variables are the knobs and dials on
> your infrastructure. Instead of hardcoding "t2.micro" everywhere,
> you create a variable called `instance_type` and change it in one
> place. Outputs are the display panel — they show you important
> information after Terraform runs.

---

## The Thermostat Analogy

Hardcoding values in Terraform is like having a heating system with no
thermostat — the only way to change the temperature is to rewire the
furnace. Variables give you a thermostat: one dial to adjust, everything
else stays the same.

```
WITHOUT VARIABLES (hardcoded)         WITH VARIABLES (configurable)

  resource "aws_instance" "web" {     variable "instance_type" {
    instance_type = "t2.micro"          default = "t2.micro"
  }                                   }
  resource "aws_instance" "api" {
    instance_type = "t2.micro"        resource "aws_instance" "web" {
  }                                     instance_type = var.instance_type
  resource "aws_instance" "worker" {  }
    instance_type = "t2.micro"        resource "aws_instance" "api" {
  }                                     instance_type = var.instance_type
                                      }
  Change all 3? Edit 3 places.        Change all 3? Edit 1 variable.
```

---

## Input Variables

Declare a variable with the `variable` block:

```hcl
variable "instance_type" {
  description = "EC2 instance type for web servers"
  type        = string
  default     = "t2.micro"
}

variable "server_count" {
  description = "Number of web servers to create"
  type        = number
  default     = 2
}

variable "enable_monitoring" {
  description = "Whether to enable detailed monitoring"
  type        = bool
  default     = false
}
```

Use variables with the `var.` prefix:

```hcl
resource "aws_instance" "web" {
  count         = var.server_count
  instance_type = var.instance_type
  monitoring    = var.enable_monitoring
  ami           = "ami-0c55b159cbfafe1f0"

  tags = {
    Name = "web-${count.index + 1}"
  }
}
```

---

## Variable Types

Terraform supports several types. Think of them as different kinds of
containers:

```
VARIABLE TYPES

  Type        What it holds              Example
  ──────      ──────────────             ───────
  string      Text                       "t2.micro"
  number      A number                   3
  bool        True or false              true
  list        Ordered collection         ["us-east-1a", "us-east-1b"]
  map         Key-value pairs            { dev = "t2.micro", prod = "t2.large" }
  set         Unique unordered values    toset(["80", "443"])
  object      Structured data            { name = "web", port = 80 }
  tuple       Fixed-length typed list    ["hello", 42, true]
```

**List** — an ordered sequence, like a numbered shopping list:
```hcl
variable "availability_zones" {
  description = "AZs to deploy into"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

resource "aws_subnet" "public" {
  count             = length(var.availability_zones)
  availability_zone = var.availability_zones[count.index]
  cidr_block        = "10.0.${count.index + 1}.0/24"
  vpc_id            = aws_vpc.main.id
}
```

**Map** — key-value pairs, like a dictionary:
```hcl
variable "instance_types" {
  description = "Instance type per environment"
  type        = map(string)
  default = {
    dev     = "t2.micro"
    staging = "t2.small"
    prod    = "t2.large"
  }
}

resource "aws_instance" "web" {
  instance_type = var.instance_types[var.environment]
  ami           = "ami-0c55b159cbfafe1f0"
}
```

**Object** — a structured type with named fields:
```hcl
variable "database_config" {
  description = "Database configuration"
  type = object({
    engine         = string
    instance_class = string
    storage_gb     = number
    multi_az       = bool
  })
  default = {
    engine         = "postgres"
    instance_class = "db.t3.micro"
    storage_gb     = 20
    multi_az       = false
  }
}

resource "aws_db_instance" "main" {
  engine            = var.database_config.engine
  instance_class    = var.database_config.instance_class
  allocated_storage = var.database_config.storage_gb
  multi_az          = var.database_config.multi_az
}
```

---

## Variable Validation

You can add rules to catch bad values before Terraform tries to use them:

```hcl
variable "environment" {
  description = "Deployment environment"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"

  validation {
    condition     = can(regex("^t[23]\\.", var.instance_type))
    error_message = "Only t2 and t3 instance types are allowed."
  }
}

variable "cidr_block" {
  description = "VPC CIDR block"
  type        = string

  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "Must be a valid CIDR block (e.g., 10.0.0.0/16)."
  }
}
```

Validation catches mistakes early. Without it, you'd only discover
a bad value when AWS rejects your API call — possibly after other
resources have already been created.

---

## Setting Variable Values

There are five ways to give variables their values, listed from lowest
to highest priority:

```
VARIABLE PRECEDENCE (lowest to highest)

  1. Default value in the variable block
  2. terraform.tfvars file (auto-loaded)
  3. *.auto.tfvars files (auto-loaded)
  4. -var-file flag
  5. -var flag or TF_VAR_ environment variable

  Higher priority wins. So a -var flag overrides everything.
```

**Method 1: Default values** (in variable declaration)
```hcl
variable "region" {
  default = "us-east-1"
}
```

**Method 2: terraform.tfvars file** (auto-loaded)
```hcl
region        = "us-west-2"
instance_type = "t2.small"
server_count  = 3
```

**Method 3: Named .tfvars files** (explicit flag)
```bash
terraform apply -var-file="production.tfvars"
```

```hcl
region        = "us-east-1"
instance_type = "t2.large"
server_count  = 10
```

**Method 4: Command line flags**
```bash
terraform apply -var="instance_type=t2.large" -var="server_count=5"
```

**Method 5: Environment variables**
```bash
export TF_VAR_instance_type="t2.large"
export TF_VAR_server_count=5
terraform apply
```

The environment variable approach is great for secrets — you can set
them in your CI/CD pipeline without putting them in files:

```bash
export TF_VAR_db_password="super-secret-password"
terraform apply
```

---

## Sensitive Variables

Mark variables as sensitive to prevent Terraform from showing their
values in plan output and logs:

```hcl
variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

resource "aws_db_instance" "main" {
  password = var.db_password
}
```

When you run `terraform plan`, the value shows as `(sensitive value)`
instead of the actual password. This prevents credentials from leaking
into CI/CD logs.

---

## Output Values

Outputs are the "return values" of your Terraform configuration. They
display information after `apply` and can be queried later:

```hcl
output "instance_id" {
  description = "ID of the web server"
  value       = aws_instance.web.id
}

output "public_ip" {
  description = "Public IP of the web server"
  value       = aws_instance.web.public_ip
}

output "database_endpoint" {
  description = "Database connection endpoint"
  value       = aws_db_instance.main.endpoint
}

output "database_password" {
  description = "Database password"
  value       = var.db_password
  sensitive   = true
}
```

After `terraform apply`, you'll see:

```
Outputs:

instance_id       = "i-0123456789abcdef0"
public_ip         = "54.123.45.67"
database_endpoint = "main-db.abc123.us-east-1.rds.amazonaws.com:5432"
database_password = <sensitive>
```

Query outputs anytime with:
```bash
terraform output
terraform output public_ip
terraform output -json
```

Outputs are also how modules communicate with each other (Lesson 07).
A VPC module outputs its VPC ID, and the EC2 module uses that as input.

---

## Local Values

Locals are like private variables — computed values you use within
your configuration but don't expose as inputs:

```hcl
locals {
  common_tags = {
    Project     = "web-app"
    Environment = var.environment
    ManagedBy   = "terraform"
    Team        = "platform"
  }

  name_prefix = "${var.project}-${var.environment}"
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = var.instance_type

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-web"
  })
}

resource "aws_s3_bucket" "assets" {
  bucket = "${local.name_prefix}-assets"

  tags = local.common_tags
}
```

```
VARIABLES vs LOCALS vs OUTPUTS

  variable    "var.name"       Input from the user
              (knobs)          "What settings do you want?"

  local       "local.name"     Internal computation
              (wiring)         "I'll calculate this myself"

  output      terraform output  Information for the user
              (display)         "Here's what was created"

  ┌─────────────────────────────────────────────┐
  │                                             │
  │  var.environment ──→ local.name_prefix      │
  │  var.project     ──→ local.common_tags      │
  │                          │                  │
  │                          v                  │
  │              resource "aws_instance"         │
  │                          │                  │
  │                          v                  │
  │              output "public_ip"             │
  │                                             │
  └─────────────────────────────────────────────┘
     inputs            processing            outputs
```

---

## File Organization

Convention is to split variables, outputs, and main configuration into
separate files:

```
STANDARD FILE LAYOUT

  project/
  ├── main.tf           ← Resources and data sources
  ├── variables.tf      ← All variable declarations
  ├── outputs.tf        ← All output declarations
  ├── locals.tf         ← Local values (optional, can be in main.tf)
  ├── providers.tf      ← Provider configuration
  ├── terraform.tfvars  ← Default variable values
  └── versions.tf       ← Terraform and provider version constraints
```

Terraform loads all `.tf` files in a directory and merges them. The
file names don't matter to Terraform — they're a convention for humans.
But following this convention means anyone on your team knows exactly
where to find variable declarations or outputs.

---

## Exercises

1. **Parameterize**: Take the code from Lesson 03 and replace all
   hardcoded values with variables. Create a `variables.tf` file.

2. **Validation**: Add validation to an `environment` variable that
   only allows "dev", "staging", or "prod". Test with an invalid value.

3. **tfvars files**: Create `dev.tfvars` and `prod.tfvars` with
   different values. Apply with `-var-file` and observe the differences.

4. **Locals practice**: Create a `local` that combines `var.project`
   and `var.environment` into a name prefix. Use it in 3 resource tags.

5. **Output chaining**: Create two `local_file` resources. Output the
   filename of the first, and use a `local_file` data source to read it
   in a second configuration.

---

[Next: Lesson 06 — State Management](./06-state-management.md)
