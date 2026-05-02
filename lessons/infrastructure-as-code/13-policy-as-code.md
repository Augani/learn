# Lesson 13: Policy as Code

> **The one thing to remember**: Policy as code means writing your
> organization's rules (security, compliance, cost) as executable code
> that automatically enforces them. Instead of a wiki page saying "don't
> create public S3 buckets," you write a policy that blocks it before
> it happens.

---

## The Bouncer Analogy

A nightclub has rules: dress code, age limit, capacity limit. The
bouncer enforces these rules at the door. They don't care *who* you
are or *why* you want in — they check the rules and either let you
through or turn you away.

Policy as code is the bouncer for your infrastructure. Before any
Terraform change reaches production, it passes through automated
policy checks that enforce your organization's rules.

```
POLICY AS CODE FLOW

  Developer writes Terraform → terraform plan → Policy engine → Pass/Fail
                                    │                │
                                    │                ├── "No public S3 buckets"
                                    │                ├── "All resources must be tagged"
                                    │                ├── "Max instance type: t3.xlarge"
                                    │                └── "Encryption required everywhere"
                                    │                         │
                                    v                         v
                              Plan output JSON          Policy decisions
                              (what WILL change)        (allow / deny)
```

---

## Why Policies Need to Be Code

Written policies (wiki pages, runbooks) have the same problems as
manual infrastructure:

```
WRITTEN POLICIES vs POLICY AS CODE

  Wiki page:                         Policy as code:
  "Don't create public               policy "no_public_buckets" {
   S3 buckets"                          check: no resource has
                                          aws_s3_bucket with
  ✗ Relies on humans reading it          acl = "public-read"
  ✗ Can be ignored or missed           }
  ✗ No enforcement mechanism
  ✗ Outdated within weeks             ✓ Automatically enforced
                                      ✓ Can't be bypassed
                                      ✓ Version controlled
                                      ✓ Always current
```

---

## OPA (Open Policy Agent) and Rego

OPA is an open-source policy engine. Rego is the language you write
policies in. OPA is general-purpose — it works with Terraform,
Kubernetes, API gateways, and more.

**How OPA works with Terraform:**

```
OPA + TERRAFORM WORKFLOW

  1. terraform plan -out=tfplan
  2. terraform show -json tfplan > plan.json
  3. opa eval --data policy/ --input plan.json "data.terraform.deny"
  4. If deny is non-empty → block the apply
```

**A simple Rego policy** — no public S3 buckets:

```rego
package terraform

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket"
    resource.change.after.acl == "public-read"
    msg := sprintf("S3 bucket '%s' must not be public", [resource.address])
}
```

Reading Rego:
- `deny[msg]` — this block produces denial messages
- `resource := input.resource_changes[_]` — iterate over all resource changes
- The remaining lines are conditions — ALL must be true for the deny to fire
- `msg := sprintf(...)` — the error message if denied

**Tag enforcement policy:**

```rego
package terraform

required_tags := {"Environment", "Team", "ManagedBy"}

deny[msg] {
    resource := input.resource_changes[_]
    resource.change.actions[_] == "create"

    tags := object.get(resource.change.after, "tags", {})
    missing := required_tags - {tag | tags[tag]}
    count(missing) > 0

    msg := sprintf(
        "Resource '%s' is missing required tags: %v",
        [resource.address, missing]
    )
}
```

**Cost control policy** — limit instance sizes:

```rego
package terraform

allowed_instance_types := {
    "t3.micro", "t3.small", "t3.medium", "t3.large"
}

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_instance"
    resource.change.actions[_] == "create"

    instance_type := resource.change.after.instance_type
    not allowed_instance_types[instance_type]

    msg := sprintf(
        "Instance '%s' uses '%s'. Allowed types: %v",
        [resource.address, instance_type, allowed_instance_types]
    )
}
```

---

## Sentinel (HashiCorp)

Sentinel is HashiCorp's policy-as-code framework. It's built into
Terraform Cloud and Terraform Enterprise. Unlike OPA, Sentinel is
proprietary — but if you use Terraform Cloud, it's deeply integrated.

**Sentinel policy — require tags:**

```python
import "tfplan/v2" as tfplan

mandatory_tags = ["Environment", "Team"]

ec2_instances = filter tfplan.resource_changes as _, rc {
    rc.type is "aws_instance" and
    rc.mode is "managed" and
    (rc.change.actions contains "create" or rc.change.actions contains "update")
}

tags_contain_required = rule {
    all ec2_instances as _, instance {
        all mandatory_tags as tag {
            instance.change.after.tags contains tag
        }
    }
}

main = rule {
    tags_contain_required
}
```

**Sentinel policy — restrict regions:**

```python
import "tfplan/v2" as tfplan
import "tfconfig/v2" as tfconfig

allowed_regions = ["us-east-1", "us-west-2", "eu-west-1"]

providers = filter tfconfig.providers as _, p {
    p.provider_name is "aws"
}

region_allowed = rule {
    all providers as _, p {
        p.config.region.constant_value in allowed_regions
    }
}

main = rule {
    region_allowed
}
```

```
OPA vs SENTINEL

                    OPA / Rego              Sentinel
  ────────────      ──────────              ────────
  Open source?      Yes                     No (proprietary)
  Cost              Free                    Terraform Cloud/Enterprise
  Language          Rego                    Sentinel (Python-like)
  Integration       Any tool                Terraform Cloud/Enterprise
  Learning curve    Steeper                 Moderate
  Community         Large                   HashiCorp ecosystem
  Best for          Multi-tool orgs         Terraform Cloud users
```

---

## Checkov: Pre-Built Policy Checks

If writing custom policies sounds like too much work, Checkov comes
with 1000+ pre-built checks for security best practices:

```bash
checkov -d . --framework terraform
```

```
Passed checks: 45, Failed checks: 8, Skipped checks: 0

Check: CKV_AWS_18: "Ensure the S3 bucket has access logging enabled"
  FAILED for resource: aws_s3_bucket.data
  Guide: https://docs.bridgecrew.io/docs/s3_13-enable-logging

Check: CKV_AWS_145: "Ensure S3 bucket is encrypted with KMS"
  FAILED for resource: aws_s3_bucket.data

Check: CKV_AWS_21: "Ensure S3 bucket versioning is enabled"
  FAILED for resource: aws_s3_bucket.data
```

**Suppress a check** (when you have a valid reason):

```hcl
resource "aws_s3_bucket" "public_website" {
  #checkov:skip=CKV_AWS_18:Access logging not needed for public static website
  bucket = "my-public-website"
}
```

---

## Building a Policy Pipeline

```
POLICY ENFORCEMENT IN CI/CD

  ┌──────────────────────────────────────────────────────────┐
  │ Pull Request                                              │
  │                                                           │
  │  terraform plan -out=tfplan                               │
  │       │                                                   │
  │       v                                                   │
  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐ │
  │  │   Checkov    │  │   OPA/Rego   │  │   Custom plan    │ │
  │  │  (security)  │  │  (business   │  │   analysis       │ │
  │  │              │  │   rules)     │  │   (cost, scope)  │ │
  │  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘ │
  │         │                │                    │           │
  │         v                v                    v           │
  │     Pass/Fail        Pass/Fail            Pass/Fail      │
  │         │                │                    │           │
  │         └────────────────┴────────────────────┘           │
  │                          │                                │
  │                    All pass?                              │
  │                    ├── Yes → Allow apply                  │
  │                    └── No  → Block with explanation       │
  └──────────────────────────────────────────────────────────┘
```

**Example GitHub Actions workflow:**

```yaml
name: Terraform Policy Check
on:
  pull_request:
    paths: ['infrastructure/**']

jobs:
  policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Init
        run: terraform init
        working-directory: infrastructure/environments/dev

      - name: Terraform Plan
        run: terraform plan -out=tfplan
        working-directory: infrastructure/environments/dev

      - name: Checkov
        uses: bridgecrewio/checkov-action@v12
        with:
          directory: infrastructure/
          framework: terraform

      - name: OPA Policy Check
        run: |
          terraform show -json tfplan > plan.json
          opa eval \
            --data policies/ \
            --input plan.json \
            --format pretty \
            "data.terraform.deny"
        working-directory: infrastructure/environments/dev
```

---

## Common Policies Every Team Should Have

```
STARTER POLICY SET

  Security:
  ├── No public S3 buckets
  ├── Encryption at rest on all storage
  ├── No wide-open security groups (0.0.0.0/0 on SSH)
  ├── HTTPS only on load balancers
  └── IMDSv2 required on EC2 instances

  Compliance:
  ├── All resources must have required tags
  ├── Resources only in approved regions
  ├── Logging enabled on all services
  └── No resources outside the project's VPC

  Cost:
  ├── Instance types limited to approved list
  ├── No resources above a certain size
  ├── Storage limits on databases
  └── Auto-scaling max limits
```

---

## Exercises

1. **Rego basics**: Write an OPA policy that denies any EC2 instance
   without an "Environment" tag. Test it with a sample plan JSON.

2. **Cost control**: Write a policy that limits RDS instances to
   `db.t3.micro` and `db.t3.small` only.

3. **Checkov scan**: Run Checkov on a real or sample Terraform project.
   Fix three of the failed checks.

4. **Pipeline integration**: Write a GitHub Actions workflow (or your
   CI tool of choice) that runs Checkov and fails the PR if any checks
   fail.

5. **Policy design**: Your company requires all S3 buckets to have
   versioning, encryption, and logging. Write OPA policies for all
   three. Test each with a plan that should pass and one that should
   fail.

---

[Next: Lesson 14 — Drift and Remediation](./14-drift-remediation.md)
