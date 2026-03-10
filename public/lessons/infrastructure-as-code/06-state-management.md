# Lesson 06: State Management

> **The one thing to remember**: Terraform state is the link between
> your code and the real world. It's a database that maps what's in
> your `.tf` files to what actually exists in AWS/GCP/Azure. Without
> state, Terraform wouldn't know what it has already created.

---

## The Inventory Ledger Analogy

Imagine you're managing a warehouse. You have:

1. **The order form** (your `.tf` files) — what you want in stock
2. **The inventory ledger** (state file) — what you believe is in stock
3. **The actual warehouse** (real infrastructure) — what's really there

```
THE THREE SOURCES OF TRUTH

  .tf Files              terraform.tfstate          Real Infrastructure
  (Desired State)        (Known State)              (Actual State)
  ═══════════════        ═════════════════          ═══════════════════

  "I want:               "Last time I checked:      What actually exists
   - 3 web servers        - 3 web servers            in AWS right now:
   - 1 database           - 1 database               - 3 web servers
   - 1 load balancer"     - 1 load balancer"          - 1 database
                                                      - 1 load balancer

  terraform plan compares all three to determine what to do.
```

When all three agree, `terraform plan` says "No changes." When they
disagree, Terraform figures out what actions to take:

```
DISAGREEMENT SCENARIOS

  Code says        State says       Real world says    Terraform does
  ─────────        ───────────      ───────────────    ──────────────
  3 servers        3 servers        3 servers          Nothing (in sync)
  4 servers        3 servers        3 servers          Create 1 server
  2 servers        3 servers        3 servers          Destroy 1 server
  3 servers        3 servers        2 servers*         Create 1 server
  (no server)      3 servers        3 servers          Destroy 3 servers

  * Someone manually deleted one outside of Terraform
```

---

## What's Inside the State File

The state file is JSON. Here's a simplified version:

```json
{
  "version": 4,
  "terraform_version": "1.7.0",
  "resources": [
    {
      "mode": "managed",
      "type": "aws_instance",
      "name": "web",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [
        {
          "attributes": {
            "id": "i-0123456789abcdef0",
            "ami": "ami-0c55b159cbfafe1f0",
            "instance_type": "t2.micro",
            "public_ip": "54.123.45.67",
            "private_ip": "10.0.1.50",
            "tags": {
              "Name": "web-server"
            }
          }
        }
      ]
    }
  ]
}
```

The state file records:
- **Every resource** Terraform manages
- **Every attribute** of each resource (including computed ones like IDs)
- **Dependencies** between resources
- **Provider information** for each resource

```
STATE FILE CONTENTS

  ┌─────────────────────────────────────────────────┐
  │ terraform.tfstate                                │
  │                                                  │
  │ Resource: aws_instance.web                       │
  │   id:            i-0123456789abcdef0             │
  │   ami:           ami-0c55b159cbfafe1f0           │
  │   instance_type: t2.micro                        │
  │   public_ip:     54.123.45.67                    │
  │   private_ip:    10.0.1.50                       │
  │   subnet_id:     subnet-abc123                   │
  │                                                  │
  │ Resource: aws_vpc.main                           │
  │   id:            vpc-def456                      │
  │   cidr_block:    10.0.0.0/16                     │
  │                                                  │
  │ Resource: aws_subnet.public                      │
  │   id:            subnet-abc123                   │
  │   vpc_id:        vpc-def456                      │
  │   cidr_block:    10.0.1.0/24                     │
  └─────────────────────────────────────────────────┘
```

---

## Why State Matters

**1. Performance.**
Without state, Terraform would have to query every cloud API to
discover what exists. For large infrastructures with hundreds of
resources, this would take minutes. The state file lets Terraform
know what to check.

**2. Mapping code to reality.**
Your code says `aws_instance.web`. The real world says
`i-0123456789abcdef0`. The state file maps one to the other.

**3. Tracking metadata.**
State tracks dependencies, so Terraform knows to delete the subnet
before the VPC. It also tracks which provider manages each resource.

**4. Detecting drift.**
When someone changes something manually (outside Terraform), the
state file and real world disagree. `terraform plan` detects this
and shows you the difference.

---

## State Commands

Terraform provides commands to inspect and manipulate state. You'll
rarely use most of these, but knowing they exist is important.

**List all resources in state:**
```bash
terraform state list
```
```
aws_instance.web
aws_vpc.main
aws_subnet.public
aws_security_group.web_sg
```

**Show details of one resource:**
```bash
terraform state show aws_instance.web
```
```
# aws_instance.web:
resource "aws_instance" "web" {
    ami                    = "ami-0c55b159cbfafe1f0"
    id                     = "i-0123456789abcdef0"
    instance_type          = "t2.micro"
    public_ip              = "54.123.45.67"
    private_ip             = "10.0.1.50"
    subnet_id              = "subnet-abc123"
    tags                   = {
        "Name" = "web-server"
    }
}
```

**Move a resource** (rename in state without destroying):
```bash
terraform state mv aws_instance.web aws_instance.web_server
```

This is useful when you rename a resource in your code. Without `mv`,
Terraform would destroy the old one and create a new one (same
infrastructure, different name).

**Remove a resource from state** (stop managing it):
```bash
terraform state rm aws_instance.web
```

This tells Terraform to "forget" the resource. It still exists in AWS,
but Terraform won't manage it anymore. Useful when you want to hand
a resource off to another team or tool.

**Refresh state** (update state from real world):
```bash
terraform refresh
```

This queries the cloud APIs and updates the state file to match reality.
It doesn't change any infrastructure — it just updates Terraform's
memory. Note: `terraform plan` does a refresh automatically.

---

## Importing Existing Resources

What if you have infrastructure that was created manually (ClickOps)
and you want Terraform to manage it? That's where `import` comes in.

**Step 1: Write the resource block in your code:**
```hcl
resource "aws_instance" "legacy_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}
```

**Step 2: Import the real resource into state:**
```bash
terraform import aws_instance.legacy_server i-0123456789abcdef0
```

This tells Terraform: "The resource `aws_instance.legacy_server` in
my code corresponds to instance `i-0123456789abcdef0` in AWS."

**Step 3: Run plan to check alignment:**
```bash
terraform plan
```

If your code doesn't exactly match the real resource's configuration,
the plan will show changes. Adjust your code until `plan` shows no
changes.

```
THE IMPORT WORKFLOW

  Real Infrastructure              Your Code
  (already exists)                 (you write to match)

  EC2: i-0abc123                   resource "aws_instance" "web" {
    type: t2.micro        ←──→      instance_type = "t2.micro"
    ami: ami-xyz           ←──→      ami = "ami-xyz"
    subnet: subnet-123     ←──→      subnet_id = "subnet-123"
                                   }

  terraform import aws_instance.web i-0abc123
       │
       v
  State now maps aws_instance.web → i-0abc123
  terraform plan shows "No changes" if code matches reality
```

**Terraform 1.5+ import blocks** (declarative import):
```hcl
import {
  to = aws_instance.legacy_server
  id = "i-0123456789abcdef0"
}

resource "aws_instance" "legacy_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}
```

This approach puts the import in code (version-controlled) instead of
a one-off command.

---

## State File Safety

The state file is **critical** and **sensitive**:

```
STATE FILE RULES

  ┌──────────────────────────────────────────────────┐
  │  NEVER commit terraform.tfstate to Git            │
  │  NEVER edit terraform.tfstate by hand             │
  │  NEVER delete terraform.tfstate (you'll orphan    │
  │        all your resources)                        │
  │  ALWAYS back up state before risky operations     │
  │  ALWAYS use remote state for teams (Lesson 10)    │
  └──────────────────────────────────────────────────┘
```

**Why never commit to Git?**
State files can contain secrets. Database passwords, API keys, private
IPs — they're all in the state. Git history is forever. Even if you
delete the file later, the secret is in the history.

**Why never edit by hand?**
The state file has internal checksums and cross-references. A hand edit
is almost guaranteed to corrupt it. Use `terraform state` commands.

**Why never delete it?**
If you delete the state file, Terraform thinks nothing exists. The next
`apply` will try to create everything from scratch — but the resources
already exist in AWS, so you'll get errors like "VPC already exists"
or worse, duplicate resources.

---

## State Locking

When two people run `terraform apply` at the same time, they can
corrupt the state file. State locking prevents this:

```
WITHOUT LOCKING                  WITH LOCKING

  Alice: terraform apply          Alice: terraform apply
  Bob:   terraform apply          Bob:   terraform apply
         │     │                         │     │
         ▼     ▼                         ▼     x── LOCKED
  Both read state                  Alice gets lock
  Both make changes                Bob waits
  Last writer wins                 Alice finishes, releases lock
  State is CORRUPTED               Bob gets lock, reads fresh state
                                   Both changes applied safely
```

Local state files don't have locking. Remote backends (Lesson 10)
provide locking automatically. This is one of many reasons to use
remote state for any team project.

---

## Exercises

1. **Explore state**: Create a few `local_file` resources, apply them,
   then run `terraform state list` and `terraform state show` on each.
   Read the JSON in `terraform.tfstate`.

2. **State move**: Create a resource called `local_file.test`. Apply it.
   Then rename it to `local_file.renamed` in your code and use
   `terraform state mv` to avoid recreation.

3. **Import simulation**: Manually create a file called `existing.txt`.
   Write a `local_file` resource for it and use `terraform import` to
   bring it under management.

4. **Drift detection**: Apply a configuration, then manually edit the
   created file. Run `terraform plan`. What does Terraform report?

5. **State backup**: Before any state operation, copy
   `terraform.tfstate` to a backup. Practice restoring from backup
   after a `state rm`.

---

[Next: Lesson 07 — Modules](./07-modules.md)
