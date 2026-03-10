# Lesson 07: Terraform Modules

> **The one thing to remember**: A module is a reusable package of
> Terraform code. Instead of copying and pasting the same VPC
> configuration into every project, you write it once as a module and
> call it with different settings. It's the same idea as functions in
> programming.

---

## The LEGO Analogy

Think of Terraform resources as individual LEGO bricks. You *could*
build every project brick by brick, but that's tedious and error-prone.

A module is a pre-built LEGO assembly — like a wheel set or a window
frame. Someone assembled it once, tested it, and now anyone can snap
it into their build.

```
WITHOUT MODULES                     WITH MODULES

  Project A:                         Module: "vpc"
    aws_vpc                            aws_vpc
    aws_subnet (x3)                    aws_subnet (x3)
    aws_igw                            aws_igw
    aws_route_table                    aws_route_table
    aws_route                          aws_route

  Project B:                         Project A:
    aws_vpc          (copy-paste)      module "vpc" { source = "./modules/vpc" }
    aws_subnet (x3)
    aws_igw                          Project B:
    aws_route_table                    module "vpc" { source = "./modules/vpc" }
    aws_route
                                     Same module, different projects.
  Copy-paste = bugs.                 One source of truth.
  Change in one? Forget the other.   Change the module? All projects update.
```

---

## Module Structure

A module is just a directory with `.tf` files. There's nothing special
about it — any directory with Terraform files can be used as a module.

```
A MODULE IS JUST A DIRECTORY

  modules/vpc/
  ├── main.tf          ← The resources
  ├── variables.tf     ← Input variables (the module's parameters)
  └── outputs.tf       ← Output values (the module's return values)

  That's it. Three files. The same layout you already know.
```

**modules/vpc/variables.tf** — what the module accepts:
```hcl
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "availability_zones" {
  description = "AZs to deploy subnets into"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}
```

**modules/vpc/main.tf** — the actual resources:
```hcl
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.environment}-vpc"
    Environment = var.environment
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
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name        = "${var.environment}-igw"
    Environment = var.environment
  }
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

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
```

**modules/vpc/outputs.tf** — what the module returns:
```hcl
output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.this.cidr_block
}
```

---

## Calling a Module

From your root configuration, call the module:

```hcl
module "vpc" {
  source = "./modules/vpc"

  vpc_cidr           = "10.0.0.0/16"
  environment        = "production"
  public_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  availability_zones  = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
  subnet_id     = module.vpc.public_subnet_ids[0]

  tags = {
    Name = "web-server"
  }
}
```

```
HOW MODULES COMMUNICATE

  Root Configuration                    Module: vpc
  ──────────────────                    ───────────

  module "vpc" {
    source = "./modules/vpc"
                                        variable "environment" {}
    environment = "production"  ──────→ var.environment
    vpc_cidr    = "10.0.0.0/16" ──────→ var.vpc_cidr
  }
                                        resource "aws_vpc" "this" { ... }
                                        resource "aws_subnet" "public" { ... }

  module.vpc.vpc_id  ←────────────────  output "vpc_id" {
  module.vpc.public_subnet_ids  ←─────    value = aws_vpc.this.id
                                        }

  INPUTS flow in via module arguments.
  OUTPUTS flow back via module.NAME.OUTPUT.
```

---

## Multiple Instances of a Module

The real power: use the same module multiple times with different inputs.

```hcl
module "vpc_dev" {
  source = "./modules/vpc"

  environment         = "dev"
  vpc_cidr            = "10.0.0.0/16"
  public_subnet_cidrs = ["10.0.1.0/24"]
  availability_zones  = ["us-east-1a"]
}

module "vpc_staging" {
  source = "./modules/vpc"

  environment         = "staging"
  vpc_cidr            = "10.1.0.0/16"
  public_subnet_cidrs = ["10.1.1.0/24", "10.1.2.0/24"]
  availability_zones  = ["us-east-1a", "us-east-1b"]
}

module "vpc_prod" {
  source = "./modules/vpc"

  environment         = "prod"
  vpc_cidr            = "10.2.0.0/16"
  public_subnet_cidrs = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
  availability_zones  = ["us-east-1a", "us-east-1b", "us-east-1c"]
}
```

Three completely isolated VPCs from one module. Dev gets 1 subnet
(cheap), prod gets 3 subnets across 3 AZs (resilient). Same module,
different knobs.

---

## Published Modules

The Terraform Registry has thousands of community and official modules.
Instead of writing your own VPC module, you can use the official one:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  name = "my-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true
}
```

```
MODULE SOURCES

  Source Type           Example
  ───────────           ───────
  Local path            source = "./modules/vpc"
  Terraform Registry    source = "terraform-aws-modules/vpc/aws"
  GitHub                source = "github.com/org/repo//modules/vpc"
  S3 bucket             source = "s3::https://bucket.s3.amazonaws.com/vpc.zip"
  Git URL               source = "git::https://example.com/vpc.git"

  Always pin versions for registry modules:
  version = "5.1.2"    ← exact version
  version = "~> 5.1"   ← allows 5.1.x but not 5.2.0
```

**Always pin module versions.** Without pinning, `terraform init` might
download a new version that breaks your infrastructure.

---

## Module Composition

Real projects compose multiple modules together:

```hcl
module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
  vpc_cidr    = "10.0.0.0/16"
}

module "security" {
  source = "./modules/security"
  vpc_id = module.vpc.vpc_id
}

module "database" {
  source            = "./modules/database"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.security.db_sg_id
}

module "web" {
  source            = "./modules/web"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.public_subnet_ids
  security_group_id = module.security.web_sg_id
  db_endpoint       = module.database.endpoint
}
```

```
MODULE COMPOSITION

  ┌──────────┐
  │   vpc    │
  │          │──── vpc_id ────→┌──────────────┐
  │          │                 │   security   │
  │          │──── subnet_ids →│              │──── web_sg_id ──→┌───────┐
  └──────────┘                 │              │──── db_sg_id ──→│  web  │
                               └──────────────┘                 │       │
                                                                └───────┘
  ┌──────────┐                                                      │
  │ database │←── db_endpoint ──────────────────────────────────────┘
  └──────────┘

  Each module is a black box. It takes inputs and produces outputs.
  Modules connect through their inputs and outputs — just like
  functions in a program.
```

---

## Module Design Principles

```
GOOD MODULE DESIGN

  1. Single responsibility    Each module does one thing well.
                              A VPC module creates VPCs. Period.

  2. Configurable            Expose variables for things that change.
                              Hardcode things that shouldn't change.

  3. Outputs for everything   If another module might need a value,
                              output it. Better to output too much
                              than too little.

  4. Sensible defaults        Most variables should have defaults.
                              A module should work with minimal config.

  5. Documentation            A README with usage examples.
                              Description on every variable and output.
```

---

## Exercises

1. **Create a module**: Build a simple module that creates a
   `local_file`. The module should accept `content` and `filename` as
   variables and output the file path.

2. **Multi-instance**: Use your module twice with different inputs.
   Verify both files are created.

3. **Module outputs**: Create module A that outputs a value, and
   module B that uses that value as an input. Trace the data flow.

4. **Registry exploration**: Browse `registry.terraform.io` and find
   3 official AWS modules. Read their inputs and outputs. How many
   variables does the VPC module have?

5. **Refactor**: Take any flat Terraform configuration with 5+ resources
   and refactor it into modules. What groupings make sense?

---

[Next: Lesson 08 — Data Sources and Dependencies](./08-data-sources.md)
