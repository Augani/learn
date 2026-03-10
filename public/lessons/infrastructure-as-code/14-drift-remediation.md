# Lesson 14: Drift and Remediation

> **The one thing to remember**: Configuration drift is when your real
> infrastructure doesn't match your code. Someone clicked a button in
> the console, a script changed a setting, or an auto-update modified
> something. Drift is inevitable — detecting and fixing it quickly is
> what matters.

---

## The Garden Analogy

You plant a garden according to a plan: roses here, tomatoes there,
a path down the middle. That's your Terraform code.

Over time, things change. Weeds grow. A neighbor's vine creeps over
the fence. Someone moves a planter. The wind knocks over a trellis.
The garden no longer matches the plan. That's drift.

You can either let the garden become a jungle (ignore drift) or
periodically compare it to the plan and fix what's wrong (remediate
drift).

```
DRIFT: CODE vs REALITY

  Your Terraform code says:          What actually exists:

  Security group: ports 80, 443      Security group: ports 80, 443, 8080
                                                              ^^^^^^^^^
                                                     Someone added this manually!

  Instance type: t2.micro            Instance type: t2.small
                                                    ^^^^^^^^
                                     Someone resized it in the console!

  Tags: { Env = "prod" }             Tags: { Env = "prod", Debug = "true" }
                                                           ^^^^^^^^^^^^^^^^
                                     Someone added a debug tag!
```

---

## Why Drift Happens

```
COMMON CAUSES OF DRIFT

  1. CONSOLE COWBOYS
     Someone logs into AWS Console and clicks buttons.
     "Just a quick fix" becomes permanent untracked change.

  2. EMERGENCY CHANGES
     Production is down. Someone SSH's in and changes a config.
     Crisis resolved. Nobody updates the Terraform code.

  3. AUTO-UPDATES
     AWS updates a default security policy. A managed service
     changes its configuration. Cloud provider makes changes
     to your resources without asking.

  4. OTHER TOOLS
     An Ansible playbook modifies a security group that
     Terraform also manages. Two tools, one resource, conflict.

  5. EXTERNAL DEPENDENCIES
     A shared resource (like a VPC managed by another team)
     changes, and your resources reference the old state.
```

---

## Detecting Drift

### Method 1: terraform plan

The simplest drift detection — run `plan` and look for unexpected
changes:

```bash
terraform plan
```

If the plan shows changes you didn't make in code, you have drift:

```
  # aws_security_group.web will be updated in-place
  ~ resource "aws_security_group" "web" {
        id   = "sg-abc123"
        name = "web-sg"

      - ingress {                        ← This will be REMOVED
          - from_port   = 8080
          - to_port     = 8080
          - protocol    = "tcp"
          - cidr_blocks = ["0.0.0.0/0"]
        }
    }

Plan: 0 to add, 1 to change, 0 to destroy.
```

Terraform found that port 8080 exists in reality but not in code. The
plan would remove it. If you didn't expect this, someone added port
8080 outside of Terraform.

### Method 2: terraform plan -refresh-only

Specifically designed for drift detection without making any changes:

```bash
terraform plan -refresh-only
```

This tells Terraform: "Just check if reality matches state. Don't
propose any changes based on my code." It shows what changed in the
real world since the last apply.

```
Note: Objects have changed outside of Terraform

  # aws_instance.web has changed
  ~ resource "aws_instance" "web" {
        id            = "i-0123456789abcdef0"
      ~ instance_type = "t2.micro" -> "t2.small"
        tags          = {
            "Name" = "web-server"
        }
    }

Would you like to update the state to reflect these detected changes?
```

### Method 3: Scheduled Drift Detection

Run `terraform plan` on a schedule (cron job, CI/CD pipeline) and
alert when drift is detected:

```yaml
name: Drift Detection
on:
  schedule:
    - cron: '0 8 * * *'

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Terraform Init
        run: terraform init

      - name: Check for Drift
        id: plan
        run: |
          terraform plan -detailed-exitcode -refresh-only 2>&1 | tee plan_output.txt
          echo "exitcode=$?" >> $GITHUB_OUTPUT
        continue-on-error: true

      - name: Alert on Drift
        if: steps.plan.outputs.exitcode == '2'
        run: |
          echo "DRIFT DETECTED! Review plan_output.txt"
```

```
TERRAFORM PLAN EXIT CODES

  Exit code 0:  No changes. Everything in sync.
  Exit code 1:  Error (syntax, auth, etc.)
  Exit code 2:  Changes detected. (Use -detailed-exitcode flag)

  Exit code 2 in a drift check = drift detected = alert the team.
```

---

## Remediation Strategies

When you find drift, you have three options:

```
DRIFT REMEDIATION OPTIONS

  Option 1: OVERWRITE (terraform apply)
  ─────────────────────────────────────
  Apply your Terraform code, reverting real infrastructure
  to match the code. The manual change is undone.

  Use when: The manual change was unauthorized or incorrect.

  Option 2: ADOPT (update code to match reality)
  ───────────────────────────────────────────────
  Update your Terraform code to include the manual change,
  then apply so state, code, and reality all agree.

  Use when: The manual change was correct and should be permanent.

  Option 3: IMPORT (bring unmanaged resources under Terraform)
  ────────────────────────────────────────────────────────────
  If someone created new resources manually, import them
  into Terraform state and write matching code.

  Use when: New resources were created outside Terraform.
```

**Option 1 — Overwrite:**
```bash
terraform apply
```
The plan shows it will revert the manual change. Type `yes`. Done.

**Option 2 — Adopt:**
```hcl
resource "aws_security_group" "web" {
  name   = "web-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

Add the port 8080 rule to your code. `terraform plan` now shows no
changes. Commit the code.

**Option 3 — Import:**
```bash
terraform import aws_instance.mystery_server i-0987654321fedcba0
```

Write a matching resource block, adjust until `plan` shows no changes.

---

## GitOps for Infrastructure

GitOps takes drift remediation to its logical conclusion: Git is the
single source of truth, and automation continuously reconciles real
infrastructure with what's in Git.

```
GITOPS WORKFLOW

  Developer                    Git                       Automation
  ─────────                    ───                       ──────────

  1. Write Terraform code ───→ Push to branch
  2. Open PR              ───→ PR created
                                    │
                                    ├──→ CI runs plan
                                    ├──→ CI runs policy checks
                                    ├──→ Plan posted as PR comment
                                    │
  3. Review plan & approve ──→ Merge to main
                                    │
                                    └──→ CD runs terraform apply
                                         │
                                         └──→ Infrastructure updated

  DRIFT DETECTION (continuous):

  Scheduled job ──→ terraform plan -refresh-only
       │
       ├── No drift → nothing
       └── Drift detected → Alert team
                              │
                              ├── Auto-remediate (apply from Git)
                              └── OR create issue for human review
```

**Key GitOps Principles:**

1. **Git is the source of truth.** If it's not in Git, it shouldn't
   exist in production.

2. **Changes go through PRs.** No manual console changes. No SSH into
   servers. Everything goes through code review.

3. **Automation applies changes.** Humans review, machines execute.
   Nobody runs `terraform apply` from their laptop.

4. **Drift is automatically detected.** Scheduled plans catch manual
   changes and either revert them or alert the team.

---

## Preventing Drift

The best drift is the drift that never happens:

```
DRIFT PREVENTION STRATEGIES

  1. RESTRICT CONSOLE ACCESS
     Use IAM policies to make the AWS Console read-only
     for most team members. Only the CI/CD pipeline
     has write access.

  2. TAGGING
     Tag every Terraform-managed resource with
     "ManagedBy = terraform". Alert on changes to
     tagged resources from non-Terraform sources.

  3. AWS CONFIG RULES
     Set up AWS Config rules that alert when resources
     change. Compare against expected state.

  4. SERVICE CONTROL POLICIES
     SCPs can prevent certain actions entirely,
     regardless of IAM permissions.

  5. EDUCATION
     Teach your team: "If you need to change something,
     change the code and open a PR."
```

---

## Exercises

1. **Drift simulation**: Apply a Terraform config that creates a
   `local_file`. Manually edit the file's content. Run `terraform plan`.
   What does Terraform propose to do?

2. **Refresh-only**: After making a manual change, run
   `terraform plan -refresh-only`. How does the output differ from
   a regular plan?

3. **Remediation practice**: Practice all three remediation strategies
   (overwrite, adopt, import) with `local_file` resources.

4. **Scheduled detection**: Write a script or CI workflow that runs
   `terraform plan -detailed-exitcode` and outputs "DRIFT DETECTED"
   or "IN SYNC" based on the exit code.

5. **GitOps design**: Design a GitOps workflow for your infrastructure.
   What runs on PR? What runs on merge? How is drift detected? How is
   it remediated?

---

[Next: Lesson 15 — Build a Multi-Environment Infrastructure](./15-build-infrastructure.md)
