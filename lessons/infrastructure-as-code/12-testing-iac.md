# Lesson 12: Testing Infrastructure Code

> **The one thing to remember**: You test application code before
> deploying it. You should test infrastructure code too. Start with
> `terraform validate` and `terraform plan` (free, fast), add linting
> with `tflint`, then graduate to integration tests with Terratest when
> your infrastructure is complex enough to warrant it.

---

## The Building Inspection Analogy

Before you move into a building, inspectors check it at multiple levels:

1. **Blueprint review** — Does the plan make sense on paper?
2. **Code compliance** — Does it follow building codes?
3. **Materials testing** — Are the materials what they claim to be?
4. **Walk-through** — Build it and check everything works.

Infrastructure testing follows the same progression:

```
THE TESTING PYRAMID FOR INFRASTRUCTURE

                    ┌───────────┐
                    │ End-to-End│  Expensive, slow, thorough
                    │ (Terratest│  Actually deploy and test
                    │  kitchen) │
                   ┌┴───────────┴┐
                   │ Plan Tests   │  Medium cost, medium speed
                   │ (plan output │  Check plan for expected changes
                   │  analysis)   │
                  ┌┴──────────────┴┐
                  │ Policy Tests    │  Low cost, fast
                  │ (OPA, Sentinel, │  Enforce rules on plan output
                  │  checkov)       │
                 ┌┴────────────────┴┐
                 │ Static Analysis   │  Zero cost, instant
                 │ (validate, tflint,│  Catch errors before plan
                 │  fmt)             │
                 └──────────────────┘

  Start at the bottom. Add layers as your infrastructure grows.
```

---

## Level 1: terraform validate

The most basic check — does your code parse correctly?

```bash
terraform validate
```

```
Success! The configuration is valid.
```

Or if you have an error:
```
Error: Missing required argument

  on main.tf line 5, in resource "aws_instance" "web":
   5: resource "aws_instance" "web" {

The argument "ami" is required, but no definition was found.
```

`validate` checks:
- Syntax errors (missing braces, bad HCL)
- Missing required arguments
- Invalid argument types (string where number expected)
- Unknown resource types (after `init`)

`validate` does NOT check:
- Whether the AMI ID exists
- Whether you have permission to create the resource
- Whether the configuration makes logical sense

Think of it as a spell checker — it catches typos, not bad writing.

---

## Level 2: terraform fmt

Not a test per se, but consistent formatting catches diffs that are
just whitespace changes:

```bash
terraform fmt -check -diff
```

`-check` returns a non-zero exit code if files need formatting (useful
in CI). `-diff` shows what would change.

```bash
terraform fmt -recursive
```

Formats all `.tf` files in the current directory and subdirectories.
Run this before every commit.

---

## Level 3: tflint

`tflint` catches errors that `validate` misses — like invalid instance
types or deprecated resource arguments.

**Install:**
```bash
brew install tflint      # macOS
```

**Configure** (`.tflint.hcl`):
```hcl
plugin "aws" {
  enabled = true
  version = "0.27.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

rule "terraform_naming_convention" {
  enabled = true
}

rule "terraform_documented_variables" {
  enabled = true
}

rule "terraform_documented_outputs" {
  enabled = true
}
```

**Run:**
```bash
tflint --init
tflint
```

```
3 issue(s) found:

Warning: "t2.nano" is previous generation instance type. (aws_instance_previous_type)
  on main.tf line 3:
   3:   instance_type = "t2.nano"

Error: "us-east-1x" is an invalid availability zone. (aws_instance_invalid_az)
  on main.tf line 5:
   5:   availability_zone = "us-east-1x"

Warning: variable "instance_type" has no description (terraform_documented_variables)
  on variables.tf line 1:
   1: variable "instance_type" {
```

`tflint` catches things `validate` can't:
- Invalid instance types or availability zones
- Deprecated resource arguments
- Naming convention violations
- Missing descriptions on variables
- Provider-specific best practices

---

## Level 4: Plan Analysis

`terraform plan` is itself a test. The plan output tells you exactly
what will change. In CI/CD, you can save and analyze it:

```bash
terraform plan -out=tfplan
terraform show -json tfplan > plan.json
```

Now you have a JSON file you can analyze programmatically:

```bash
terraform show -json tfplan | jq '.resource_changes[] | {
  address: .address,
  action: .change.actions[0]
}'
```

```json
{
  "address": "aws_instance.web",
  "action": "create"
}
{
  "address": "aws_security_group.web_sg",
  "action": "create"
}
```

**Plan-based checks you can automate:**
```
PLAN CHECKS

  Check                             Why
  ─────                             ───
  No unexpected destroys            Catch accidental deletions
  No changes to prod database       Prevent data loss
  Instance count within limits      Cost control
  No public security groups         Security compliance
  All resources have tags           Organization policy
```

A simple script to fail CI if anything is being destroyed:

```bash
#!/bin/bash
DESTROYS=$(terraform show -json tfplan | \
  jq '[.resource_changes[] | select(.change.actions[] == "delete")] | length')

if [ "$DESTROYS" -gt 0 ]; then
  echo "ERROR: Plan includes $DESTROYS resource deletions. Review required."
  terraform show -json tfplan | \
    jq '.resource_changes[] | select(.change.actions[] == "delete") | .address'
  exit 1
fi
```

---

## Level 5: Policy Testing

Tools like Checkov and tfsec scan your code for security and
compliance issues without running `plan`:

**Checkov:**
```bash
pip install checkov
checkov -d .
```

```
Passed checks: 12, Failed checks: 3, Skipped checks: 0

Check: CKV_AWS_79: "Ensure Instance Metadata Service Version 1 is not enabled"
  FAILED for resource: aws_instance.web
  File: main.tf:1-8

Check: CKV_AWS_8: "Ensure all data stored in the Launch configuration EBS is encrypted"
  FAILED for resource: aws_instance.web
  File: main.tf:1-8

Check: CKV_AWS_88: "EC2 instance should not have public IP"
  FAILED for resource: aws_instance.web
  File: main.tf:1-8
```

Checkov knows hundreds of security best practices and checks your
code against them automatically. It's like having a security expert
review every change.

---

## Level 6: Integration Testing with Terratest

Terratest (written in Go) actually deploys your infrastructure, runs
tests against it, and tears it down:

```go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/gruntwork-io/terratest/modules/http-helper"
    "time"
)

func TestWebServer(t *testing.T) {
    terraformOptions := &terraform.Options{
        TerraformDir: "../environments/test",
        Vars: map[string]interface{}{
            "instance_type": "t2.micro",
            "environment":   "test",
        },
    }

    defer terraform.Destroy(t, terraformOptions)

    terraform.InitAndApply(t, terraformOptions)

    publicIP := terraform.Output(t, terraformOptions, "public_ip")

    url := "http://" + publicIP
    expectedStatus := 200
    expectedBody := "Hello, World"
    maxRetries := 10
    sleepBetween := 10 * time.Second

    http_helper.HttpGetWithRetry(
        t, url, nil, expectedStatus, expectedBody,
        maxRetries, sleepBetween,
    )
}
```

```
TERRATEST WORKFLOW

  1. terraform init + apply    → Creates real infrastructure
  2. Run tests                 → HTTP requests, SSH checks, etc.
  3. terraform destroy         → Cleans up everything

  This costs real money (cloud resources are created).
  Run only in CI, not on every local change.
  Use the smallest possible instance types.
```

---

## CI/CD Pipeline for Terraform

A complete CI/CD pipeline combines all testing levels:

```
CI/CD PIPELINE

  ┌───────────────┐
  │ Git Push       │
  └───────┬───────┘
          │
  ┌───────v───────┐
  │ terraform fmt  │  ← Formatting check
  │ -check         │     Fail if code isn't formatted
  └───────┬───────┘
          │
  ┌───────v───────┐
  │ terraform      │  ← Syntax and type check
  │ validate       │     Fail on missing args, bad syntax
  └───────┬───────┘
          │
  ┌───────v───────┐
  │ tflint         │  ← Provider-specific linting
  │                │     Fail on invalid values, bad practices
  └───────┬───────┘
          │
  ┌───────v───────┐
  │ checkov /      │  ← Security scanning
  │ tfsec          │     Fail on security violations
  └───────┬───────┘
          │
  ┌───────v───────┐
  │ terraform plan │  ← Preview changes
  │ -out=tfplan    │     Post plan to PR as comment
  └───────┬───────┘
          │
  ┌───────v───────┐
  │ Plan analysis  │  ← Automated plan checks
  │ (no destroys?) │     Fail on unexpected changes
  └───────┬───────┘
          │
  ┌───────v───────┐
  │ Human review   │  ← Someone reads the plan
  │ (PR approval)  │     Manual approval required
  └───────┬───────┘
          │
  ┌───────v───────┐
  │ terraform      │  ← Apply changes
  │ apply tfplan   │     Only after all checks pass
  └───────────────┘
```

---

## Exercises

1. **Validation gauntlet**: Write intentionally broken Terraform code
   (missing arguments, wrong types, invalid syntax). Run `terraform
   validate` on each. Catalog the error messages.

2. **tflint setup**: Install tflint, create a `.tflint.hcl` config,
   and run it on an existing configuration. Fix all warnings.

3. **Plan analysis**: Save a plan to JSON and write a script that
   checks for specific conditions (no destroys, all resources tagged).

4. **Checkov scan**: Run Checkov on an AWS configuration. How many
   checks fail? Pick three and fix them.

5. **CI pipeline design**: Write a GitHub Actions workflow that runs
   fmt, validate, tflint, and plan on every pull request.

---

[Next: Lesson 13 — Policy as Code](./13-policy-as-code.md)
