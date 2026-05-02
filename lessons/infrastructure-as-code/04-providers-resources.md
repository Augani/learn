# Lesson 04: Providers and Resources

> **The one thing to remember**: Providers are Terraform's plugins for
> talking to different services. AWS provider talks to AWS. GCP provider
> talks to Google Cloud. Each provider gives you resource types — the
> building blocks you use to create infrastructure.

---

## The Hardware Store Analogy

Think of Terraform as a general contractor. The contractor doesn't
manufacture plumbing or electrical supplies — they go to different
specialty stores (providers) to get what they need.

```
TERRAFORM AS A GENERAL CONTRACTOR

  Terraform (Contractor)
       │
       ├──→ AWS Provider (electrical store)
       │    ├── aws_instance (light fixtures)
       │    ├── aws_s3_bucket (storage units)
       │    ├── aws_vpc (wiring)
       │    └── aws_rds_instance (appliances)
       │
       ├──→ GCP Provider (plumbing store)
       │    ├── google_compute_instance
       │    ├── google_storage_bucket
       │    └── google_sql_database_instance
       │
       ├──→ Azure Provider (lumber yard)
       │    ├── azurerm_virtual_machine
       │    ├── azurerm_storage_account
       │    └── azurerm_sql_database
       │
       └──→ Other Providers (specialty shops)
            ├── cloudflare_record (DNS)
            ├── github_repository (code hosting)
            └── datadog_monitor (monitoring)
```

There are over 3,000 providers in the Terraform registry. You're not
limited to the Big Three cloud providers — there are providers for
DNS, monitoring, databases, Kubernetes, GitHub, PagerDuty, and more.

---

## Configuring a Provider

Every provider needs configuration — at minimum, how to authenticate.

**AWS Provider:**
```hcl
provider "aws" {
  region = "us-east-1"
}
```

The AWS provider reads credentials from environment variables
(`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), the `~/.aws/credentials`
file, or an IAM role. You almost never put credentials in Terraform
files.

**GCP Provider:**
```hcl
provider "google" {
  project = "my-project-id"
  region  = "us-central1"
}
```

**Azure Provider:**
```hcl
provider "azurerm" {
  features {}
}
```

**Multiple regions with aliases:**
```hcl
provider "aws" {
  region = "us-east-1"
  alias  = "east"
}

provider "aws" {
  region = "eu-west-1"
  alias  = "europe"
}

resource "aws_instance" "us_server" {
  provider      = aws.east
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}

resource "aws_instance" "eu_server" {
  provider      = aws.europe
  ami           = "ami-0d75513e7706cf2d9"
  instance_type = "t2.micro"
}
```

The `alias` lets you use the same provider multiple times with different
configurations. This is how you deploy to multiple regions from a single
Terraform configuration.

---

## Resource Anatomy

Every resource follows the same pattern:

```
resource "TYPE" "NAME" {
  ARGUMENT = VALUE
  ARGUMENT = VALUE
}
```

```
RESOURCE BLOCK ANATOMY

  resource "aws_instance" "web_server" {
  ─────── ──────────────  ──────────
     │          │              │
     │          │              └─ Local name (your label)
     │          │                  Used to reference this resource
     │          │                  in other parts of your code
     │          │
     │          └─ Resource type
     │              Format: provider_resource
     │              "aws" = provider, "instance" = resource
     │
     └─ Keyword (always "resource")

    ami           = "ami-0c55b159cbfafe1f0"   ← Required argument
    instance_type = "t2.micro"                 ← Required argument

    tags = {                                   ← Optional argument
      Name = "web-server"
    }
  }
```

**Type** (`aws_instance`): Determined by the provider. The prefix
tells you which provider it belongs to. `aws_` = AWS, `google_` = GCP,
`azurerm_` = Azure.

**Name** (`web_server`): You choose this. It's how you reference the
resource elsewhere in your code. It must be unique within the same type
in your configuration.

**Arguments**: The settings for the resource. Some are required (the
resource won't work without them), some are optional (they have
defaults).

---

## Resource Arguments and Attributes

This distinction trips up many beginners:

- **Arguments** are what you SET (inputs you provide)
- **Attributes** are what you GET BACK (outputs Terraform gives you)

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"    # ← argument (you set this)
  instance_type = "t2.micro"                  # ← argument (you set this)
}
```

After Terraform creates this instance, you can access attributes:

```hcl
output "instance_id" {
  value = aws_instance.web.id
}

output "public_ip" {
  value = aws_instance.web.public_ip
}

output "private_ip" {
  value = aws_instance.web.private_ip
}
```

```
ARGUMENTS vs ATTRIBUTES

  ARGUMENTS (what you provide)       ATTRIBUTES (what you get back)
  ─────────────────────────          ──────────────────────────────
  ami = "ami-abc123"                 id = "i-0123456789abcdef0"
  instance_type = "t2.micro"         public_ip = "54.123.45.67"
  tags = { Name = "web" }            private_ip = "10.0.1.50"
                                     arn = "arn:aws:ec2:..."
  You write these in your code.      Terraform fills these in after
                                     creating the resource.

  Think of it like ordering a car:
  Arguments = color, engine, trim    Attributes = VIN, license plate
  (you choose)                       (assigned after manufacture)
```

---

## Data Flow Between Resources

The real power comes from connecting resources together. One resource's
attributes become another resource's arguments:

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"

  tags = {
    Name = "main-vpc"
  }
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"

  tags = {
    Name = "public-subnet"
  }
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.public.id

  tags = {
    Name = "web-server"
  }
}
```

```
DATA FLOW BETWEEN RESOURCES

  aws_vpc.main
       │
       │  .id (attribute)
       │
       v
  aws_subnet.public ←── vpc_id = aws_vpc.main.id
       │
       │  .id (attribute)
       │
       v
  aws_instance.web ←── subnet_id = aws_subnet.public.id

  Terraform automatically understands the dependencies:
  1. Create the VPC first (no dependencies)
  2. Create the subnet second (needs VPC ID)
  3. Create the instance third (needs subnet ID)
```

Terraform reads these references and builds a **dependency graph**. It
knows the VPC must exist before the subnet, and the subnet before the
instance. It creates them in the right order automatically. It also
destroys them in reverse order.

---

## Common AWS Resources

Here are the resources you'll use most often with AWS:

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "main-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true

  tags = { Name = "public-subnet" }
}

resource "aws_security_group" "web" {
  name   = "web-sg"
  vpc_id = aws_vpc.main.id

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

  tags = { Name = "web-sg" }
}

resource "aws_instance" "web" {
  ami                    = "ami-0c55b159cbfafe1f0"
  instance_type          = "t2.micro"
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]

  tags = { Name = "web-server" }
}

resource "aws_s3_bucket" "assets" {
  bucket = "my-unique-bucket-name-12345"

  tags = { Name = "assets-bucket" }
}

resource "aws_db_instance" "main" {
  identifier           = "main-db"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.t3.micro"
  allocated_storage    = 20
  db_name              = "myapp"
  username             = "admin"
  password             = var.db_password
  skip_final_snapshot  = true

  tags = { Name = "main-database" }
}
```

Notice the pattern: every resource has a type, a name, required
arguments, optional arguments, and tags. Once you've seen a few
resources, the pattern is the same everywhere.

---

## The Reference Syntax

To reference a resource's attribute elsewhere in your code:

```
REFERENCE SYNTAX

  resource_type.resource_name.attribute
  ─────────────  ─────────────  ─────────
  aws_instance   web             id
  aws_vpc        main            cidr_block
  aws_subnet     public          id

  Examples:
  aws_instance.web.id          → "i-0123456789abcdef0"
  aws_instance.web.public_ip   → "54.123.45.67"
  aws_vpc.main.id              → "vpc-abc123"
  aws_s3_bucket.assets.arn     → "arn:aws:s3:::my-bucket"
```

This is how Terraform code stays connected. You never hardcode IDs
or IP addresses. You always reference them from the resource that
created them. This means if a VPC is destroyed and recreated with a
new ID, every resource that references it automatically gets the new ID.

---

## Provider Documentation

You won't memorize all arguments for all resources. Instead, use
the Terraform Registry documentation:

```
HOW TO FIND RESOURCE DOCUMENTATION

  1. Go to: registry.terraform.io
  2. Search for the provider (e.g., "aws")
  3. Click the provider
  4. Browse or search resource types
  5. Each resource page shows:
     - Required arguments
     - Optional arguments
     - Attributes (what you get back)
     - Example usage

  Bookmark this: registry.terraform.io/providers/hashicorp/aws/latest/docs
```

The documentation is your best friend. Even experienced Terraform
users check the docs constantly. There's no shame in it — there are
thousands of resource types and nobody memorizes them all.

---

## Exercises

1. **Resource references**: Given this code, draw the dependency graph:
   ```hcl
   resource "aws_vpc" "v" { cidr_block = "10.0.0.0/16" }
   resource "aws_subnet" "s" { vpc_id = aws_vpc.v.id }
   resource "aws_security_group" "sg" { vpc_id = aws_vpc.v.id }
   resource "aws_instance" "i" {
     subnet_id = aws_subnet.s.id
     vpc_security_group_ids = [aws_security_group.sg.id]
   }
   ```
   Which resources can be created in parallel?

2. **Provider practice**: Using the `local` provider (no cloud needed),
   create three `local_file` resources where the content of the second
   file references an attribute of the first.

3. **Read the docs**: Go to the Terraform Registry and find the
   `aws_s3_bucket` resource documentation. List 5 optional arguments
   you could set.

4. **Multi-provider**: Write a Terraform config that uses both the
   `local` and `random` providers. Use `random_pet` to generate a
   name, then use that name in a `local_file`.

---

[Next: Lesson 05 — Variables and Outputs](./05-variables-outputs.md)
