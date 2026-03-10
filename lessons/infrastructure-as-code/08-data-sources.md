# Lesson 08: Data Sources and Dependencies

> **The one thing to remember**: Data sources let you read information
> from existing infrastructure that Terraform doesn't manage. Resources
> create things. Data sources look things up. Dependencies control the
> order Terraform builds things in.

---

## The Phone Book Analogy

Resources are like building a new house — you're creating something.
Data sources are like looking up an address in the phone book — the
house already exists, you just need its information.

```
RESOURCES vs DATA SOURCES

  resource "aws_instance" "web" {        Creates a new EC2 instance
    ami           = "ami-abc123"         Terraform manages its lifecycle
    instance_type = "t2.micro"           Terraform can update/destroy it
  }

  data "aws_ami" "latest_amazon" {       Looks up an existing AMI
    most_recent = true                   Terraform does NOT manage it
    owners      = ["amazon"]             Read-only query
    filter {
      name   = "name"
      values = ["amzn2-ami-hvm-*-x86_64-gp2"]
    }
  }
```

The `data` keyword means "go find this for me." The `resource` keyword
means "create this for me."

---

## Common Data Sources

**Look up the latest AMI** (instead of hardcoding an AMI ID):
```hcl
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t2.micro"
}
```

Without data sources, you'd hardcode `ami = "ami-0c55b159cbfafe1f0"`.
That AMI ID is specific to a region and point in time. Data sources
let you say "give me the latest Ubuntu 22.04" and always get the
right one.

**Look up your current AWS account:**
```hcl
data "aws_caller_identity" "current" {}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}
```

**Look up available AZs:**
```hcl
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_subnet" "public" {
  count             = length(data.aws_availability_zones.available.names)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  cidr_block        = "10.0.${count.index + 1}.0/24"
  vpc_id            = aws_vpc.main.id
}
```

**Look up an existing VPC** (created outside Terraform):
```hcl
data "aws_vpc" "existing" {
  filter {
    name   = "tag:Name"
    values = ["production-vpc"]
  }
}

resource "aws_subnet" "new" {
  vpc_id     = data.aws_vpc.existing.id
  cidr_block = "10.0.99.0/24"
}
```

**Read a local file for configuration:**
```hcl
data "local_file" "config" {
  filename = "${path.module}/config.json"
}

locals {
  config = jsondecode(data.local_file.config.content)
}
```

---

## Data Source Reference Syntax

```
REFERENCE SYNTAX

  Resources:      resource_type.name.attribute
                  aws_instance.web.id

  Data sources:   data.source_type.name.attribute
                  data.aws_ami.ubuntu.id

  The "data." prefix distinguishes data sources from resources.
```

---

## Dependencies

Terraform builds a dependency graph to determine the order of
operations. There are two types of dependencies.

### Implicit Dependencies

When one resource references another's attributes, Terraform
automatically knows the order:

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}
```

The subnet references `aws_vpc.main.id`. Terraform sees this and knows:
1. Create the VPC first (to get its ID)
2. Create the subnet second (using the VPC's ID)

```
IMPLICIT DEPENDENCY GRAPH

  aws_vpc.main
       │
       │  implicit dependency (subnet references vpc.id)
       │
       v
  aws_subnet.public

  Terraform determines this automatically by reading your code.
  You don't need to do anything extra.
```

### Explicit Dependencies

Sometimes two resources don't reference each other but still have a
dependency. Use `depends_on` to make it explicit:

```hcl
resource "aws_iam_role_policy" "s3_access" {
  name   = "s3-access"
  role   = aws_iam_role.ec2_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = ["${aws_s3_bucket.data.arn}/*"]
      }
    ]
  })
}

resource "aws_instance" "worker" {
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = "t2.micro"
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name

  depends_on = [aws_iam_role_policy.s3_access]
}
```

The instance doesn't reference the policy directly, but it needs the
policy to exist before starting (otherwise it can't access S3). The
`depends_on` tells Terraform about this hidden dependency.

```
WHEN TO USE depends_on

  Use implicit (references)       Almost always. This is the default.
  when possible.                  Terraform handles it automatically.

  Use depends_on only when:       - IAM policies that must exist first
                                  - Resources with side effects
                                  - Ordering that can't be expressed
                                    through attribute references

  depends_on is a last resort.    If you're using it frequently,
                                  your code might need restructuring.
```

---

## The Dependency Graph

Terraform builds a directed acyclic graph (DAG) of all resources:

```
FULL DEPENDENCY GRAPH EXAMPLE

  data.aws_ami.ubuntu          data.aws_availability_zones.available
         │                              │
         │                              │
         v                              v
  aws_vpc.main ──────────────→ aws_subnet.public (x3)
         │                              │
         │                              │
         v                              v
  aws_security_group.web ───→ aws_instance.web
                                        │
                                        │
                                        v
                               aws_eip.web_ip

  Resources at the same level with no dependencies between them
  can be created IN PARALLEL. Terraform does this automatically.

  aws_vpc.main and data sources:  created first (in parallel)
  aws_subnet + aws_security_group: created next (in parallel)
  aws_instance: created after both subnet and SG exist
  aws_eip: created last (needs the instance)
```

You can visualize the graph:
```bash
terraform graph | dot -Tpng > graph.png
```

This generates a visual representation of all dependencies. It's
useful for debugging and understanding complex configurations.

---

## Dependencies with Modules

Modules create implicit dependencies just like resources:

```hcl
module "vpc" {
  source = "./modules/vpc"
}

module "database" {
  source     = "./modules/database"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
}

module "app" {
  source      = "./modules/app"
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.public_subnet_ids
  db_endpoint = module.database.endpoint

  depends_on = [module.database]
}
```

```
MODULE DEPENDENCY GRAPH

  module.vpc
     │
     ├──────────────────┐
     │                  │
     v                  v
  module.database    module.app
     │                  ^
     │                  │
     └──── depends_on ──┘

  VPC first. Database and app next (app waits for database).
```

---

## Data Sources as Glue

Data sources often serve as glue between Terraform configurations
that are managed separately:

```
TEAM A manages:              TEAM B needs:
  VPC, subnets, DNS            EC2 instances in Team A's VPC

  Team A's code:               Team B's code:
  ─────────────                ─────────────
  resource "aws_vpc" "main"    data "aws_vpc" "main" {
  outputs vpc_id                 filter {
                                   name   = "tag:Name"
                                   values = ["production-vpc"]
                                 }
                               }

                               resource "aws_instance" "app" {
                                 subnet_id = data.aws_subnet.app.id
                               }
```

Team A creates and manages the VPC. Team B uses a data source to look
it up. Neither team depends on the other's Terraform code — they're
loosely coupled through the actual infrastructure.

---

## Exercises

1. **AMI lookup**: Write a data source that finds the latest Amazon
   Linux 2 AMI. Use it in an `aws_instance` resource (or just output
   the ID if you don't have an AWS account).

2. **Dependency mapping**: Given 5 resources with various references
   between them, draw the dependency graph. Identify which can be
   created in parallel.

3. **depends_on practice**: Create a scenario where implicit
   dependencies aren't enough and you need `depends_on`. Explain why
   the attribute reference approach doesn't work.

4. **Cross-team data**: Write a configuration that uses data sources
   to look up a VPC, its subnets, and a security group — all created
   by another team. Deploy an instance into that infrastructure.

5. **Graph visualization**: Run `terraform graph` on a configuration
   with 5+ resources. Read the output. Can you trace the creation
   order?

---

[Next: Lesson 09 — Workspaces and Environments](./09-workspaces-environments.md)
