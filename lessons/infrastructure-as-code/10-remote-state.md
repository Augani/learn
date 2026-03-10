# Lesson 10: Remote State

> **The one thing to remember**: Local state files are fine for learning,
> but for teams you need remote state — stored in a shared location like
> S3 with locking so two people can't modify infrastructure at the same
> time. Remote state is the difference between a solo hobby project and
> production-grade infrastructure.

---

## The Shared Document Analogy

Local state is like editing a Word document on your laptop. It works
fine alone, but if your teammate also has a copy, you'll end up with
conflicting versions.

Remote state is like Google Docs — one shared copy, everyone sees the
latest version, and it locks the paragraph you're editing so nobody
else can change it simultaneously.

```
LOCAL STATE                          REMOTE STATE

  Alice's laptop:                    S3 Bucket:
  terraform.tfstate ← Alice edits    terraform.tfstate ← shared
                                          │
  Bob's laptop:                           ├── Alice reads/writes
  terraform.tfstate ← Bob edits           ├── Bob reads/writes
                                          └── CI/CD reads/writes
  Two copies. Out of sync.
  Who has the right version?         One copy. Always in sync.
  What if both apply at once?        DynamoDB lock prevents conflicts.
```

---

## Configuring the S3 Backend

The most common remote state setup for AWS uses S3 for storage and
DynamoDB for locking:

```hcl
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

```
S3 BACKEND ARCHITECTURE

  ┌────────────────┐         ┌─────────────────────┐
  │  Your Machine  │         │  AWS                 │
  │                │         │                      │
  │  terraform     │────────→│  S3 Bucket           │
  │  apply         │         │  ┌─────────────────┐ │
  │                │         │  │ prod/network/    │ │
  │                │         │  │ terraform.tfstate│ │
  │                │         │  └─────────────────┘ │
  │                │         │                      │
  │                │────────→│  DynamoDB Table      │
  │                │  lock   │  ┌─────────────────┐ │
  │                │         │  │ LockID           │ │
  │                │         │  │ Who: alice       │ │
  │                │         │  │ Since: 10:30 AM  │ │
  │                │         │  └─────────────────┘ │
  └────────────────┘         └─────────────────────┘
```

Let's break down each component:

**S3 Bucket** (`mycompany-terraform-state`): Stores the state file.
S3 provides durability (99.999999999%), versioning (you can recover
previous state), and access control.

**Key** (`prod/network/terraform.tfstate`): The path within the bucket.
Organize by environment and component.

**DynamoDB Table** (`terraform-locks`): Provides locking. When someone
runs `terraform apply`, a lock record is created. If someone else tries
to apply at the same time, they'll get a "state locked" error.

**Encrypt** (`true`): Encrypts the state file at rest in S3. State
files contain sensitive data — encryption is not optional for production.

---

## Creating the Backend Resources

Here's the chicken-and-egg problem: you need S3 and DynamoDB to store
state, but you also need Terraform to create S3 and DynamoDB. The
solution is a bootstrap configuration:

```hcl
provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "mycompany-terraform-state"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name      = "Terraform State"
    ManagedBy = "terraform-bootstrap"
  }
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

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name      = "Terraform Lock Table"
    ManagedBy = "terraform-bootstrap"
  }
}
```

Apply this with local state first (no backend block). Once the bucket
and table exist, add the backend block and run `terraform init` to
migrate the state to S3.

```
THE BOOTSTRAP PROCESS

  Step 1: Create bootstrap/main.tf (no backend block)
          $ terraform init        ← local state
          $ terraform apply       ← creates S3 + DynamoDB

  Step 2: Add backend "s3" block to bootstrap/main.tf
          $ terraform init        ← Terraform detects new backend

          "Do you want to copy existing state to the new backend?"
          Enter: yes

  Step 3: State is now in S3. Delete local terraform.tfstate.

  This is a one-time setup per AWS account.
```

---

## State Locking in Action

When you run `terraform apply`, here's what happens:

```
LOCKING SEQUENCE

  1. terraform apply starts
  2. Terraform writes a lock to DynamoDB:
     { LockID: "mycompany-terraform-state/prod/terraform.tfstate",
       Info: { Who: "alice@laptop", Operation: "apply", When: "..." } }
  3. Terraform reads state from S3
  4. Terraform makes changes
  5. Terraform writes updated state to S3
  6. Terraform removes the lock from DynamoDB

  If Bob tries to apply during steps 2-6:
  ─────────────────────────────────────────
  Error: Error acquiring the state lock
  Lock Info:
    ID:        abc-123-def
    Path:      mycompany-terraform-state/prod/terraform.tfstate
    Operation: apply
    Who:       alice@laptop
    Created:   2024-01-15 10:30:00 UTC

  Bob must wait until Alice's operation finishes.
```

If a lock gets stuck (Terraform crashed mid-apply), you can force
unlock:
```bash
terraform force-unlock LOCK_ID
```

Use this carefully — only when you're certain the locking process is
no longer running.

---

## State Isolation Patterns

Don't put all your state in one file. Split by environment AND by
component:

```
STATE ISOLATION

  BAD: One state file for everything
  ─────────────────────────────────
  s3://state-bucket/terraform.tfstate
  Contains: VPC + EC2 + RDS + S3 + IAM + DNS + ...
  Risk: A bad `apply` can break everything at once

  GOOD: Separate state per environment and component
  ──────────────────────────────────────────────────
  s3://state-bucket/prod/network/terraform.tfstate     ← VPC, subnets
  s3://state-bucket/prod/compute/terraform.tfstate     ← EC2, ASG
  s3://state-bucket/prod/database/terraform.tfstate    ← RDS
  s3://state-bucket/prod/dns/terraform.tfstate         ← Route53
  s3://state-bucket/dev/network/terraform.tfstate      ← Dev VPC
  s3://state-bucket/dev/compute/terraform.tfstate      ← Dev EC2
```

```
ISOLATION REDUCES BLAST RADIUS

  Monolithic state:                 Isolated state:

  ┌──────────────────┐              ┌──────────┐  ┌──────────┐
  │ VPC + EC2 + RDS  │              │ network  │  │ compute  │
  │ + S3 + IAM + DNS │              └──────────┘  └──────────┘
  └──────────────────┘              ┌──────────┐  ┌──────────┐
                                    │ database │  │   dns    │
  One mistake affects               └──────────┘  └──────────┘
  EVERYTHING.
                                    A mistake in compute
                                    can't affect the database.
```

---

## Reading Remote State from Other Configurations

When you split state, configurations sometimes need data from each
other. The `terraform_remote_state` data source enables this:

```hcl
data "terraform_remote_state" "network" {
  backend = "s3"

  config = {
    bucket = "mycompany-terraform-state"
    key    = "prod/network/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t2.micro"
  subnet_id     = data.terraform_remote_state.network.outputs.public_subnet_ids[0]
}
```

```
CROSS-STATE DATA FLOW

  State: prod/network                  State: prod/compute

  resource "aws_vpc" "main" { ... }
  resource "aws_subnet" "public" { ... }

  output "vpc_id" {                    data "terraform_remote_state" "network" {
    value = aws_vpc.main.id              backend = "s3"
  }                                      config = {
  output "public_subnet_ids" {  ────→      key = "prod/network/terraform.tfstate"
    value = aws_subnet.public[*].id      }
  }                                    }

                                       resource "aws_instance" "web" {
                                         subnet_id = data.terraform_remote_state
                                                     .network.outputs
                                                     .public_subnet_ids[0]
                                       }
```

The network team manages VPCs and subnets, outputting IDs. The compute
team reads those outputs as data sources. Clean separation.

---

## Other Backend Options

S3 is the most common for AWS shops, but other options exist:

```
BACKEND OPTIONS

  Backend              Storage          Locking         Best For
  ───────              ───────          ───────         ────────
  S3 + DynamoDB        AWS S3           DynamoDB        AWS teams
  Azure Blob           Azure Storage    Blob lease      Azure teams
  GCS                  Google Cloud     Built-in        GCP teams
  Terraform Cloud      HashiCorp SaaS   Built-in        Any team
  Consul               Consul KV        Built-in        HashiCorp stack
  PostgreSQL           PostgreSQL DB    Row locking     Self-hosted
```

**Terraform Cloud** is worth mentioning specifically. It provides
remote state, locking, a web UI, policy enforcement, and CI/CD for
Terraform — all in one. Free for small teams.

---

## Exercises

1. **Bootstrap practice**: Write the bootstrap configuration for S3 +
   DynamoDB. Apply it with local state. (If you don't have AWS, trace
   through the code and explain what each resource does.)

2. **Migration**: Start with a local state configuration. Add a backend
   block and run `terraform init`. Observe the migration prompt.

3. **Locking test**: Open two terminals. Run `terraform apply` in both
   at the same time (use the `-auto-approve` flag). One should get a
   lock error.

4. **State isolation design**: You have an app with: VPC, 3 EC2
   instances, RDS database, S3 bucket, CloudFront CDN, Route53 DNS.
   Design the state isolation strategy. What goes in each state file?
   What outputs are needed for cross-state references?

5. **Key structure**: Design the S3 key naming convention for a company
   with 3 environments, 4 applications, and shared infrastructure.

---

[Next: Lesson 11 — Advanced HCL Patterns](./11-advanced-patterns.md)
