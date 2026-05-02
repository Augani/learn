# Lesson 11: CI/CD for Infrastructure

## The Big Analogy: Assembly Line for Buildings

```
MANUAL INFRASTRUCTURE                CI/CD FOR INFRASTRUCTURE
(Hand-building each house)           (Automated factory line)

  Developer                            Developer
     |                                    |
     v                                    v
  "I'll SSH in                      Push to Git
   and change it"                        |
     |                                    v
     v                              +------------+
  Production                        | Lint & Plan |
  (fingers crossed)                 +------------+
                                          |
                                          v
                                    +------------+
                                    |   Review    |
                                    +------------+
                                          |
                                          v
                                    +------------+
                                    |   Apply     |
                                    +------------+
                                          |
                                          v
                                     Production
                                    (confident)
```

## GitHub Actions for Infrastructure

```
GITHUB ACTIONS WORKFLOW ANATOMY

  .github/workflows/terraform.yml
  +----------------------------------+
  | on: push/pull_request            |
  |   branches: [main]              |
  |                                  |
  | jobs:                            |
  |   plan:                          |
  |     steps:                       |
  |       - checkout                 |
  |       - setup terraform          |
  |       - terraform init           |
  |       - terraform plan           |
  |                                  |
  |   apply:                         |
  |     needs: plan                  |
  |     if: github.ref == 'main'    |
  |     steps:                       |
  |       - terraform apply          |
  +----------------------------------+
```

### Basic Terraform Pipeline

```yaml
name: Terraform CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  TF_VERSION: "1.7.0"
  AWS_REGION: "us-east-1"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform Format Check
        run: terraform fmt -check -recursive

      - name: Terraform Init
        run: terraform init -backend=false

      - name: Terraform Validate
        run: terraform validate

  plan:
    needs: validate
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - run: terraform init
      - run: terraform plan -out=tfplan -no-color
        id: plan

      - uses: actions/github-script@v7
        if: github.event_name == 'pull_request'
        with:
          script: |
            const plan = `${{ steps.plan.outputs.stdout }}`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Terraform Plan\n\`\`\`\n${plan}\n\`\`\``
            });

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - run: terraform init
      - run: terraform apply -auto-approve
```

## AWS CodePipeline

```
CODEPIPELINE STAGES

  Source          Build           Deploy
  +------+      +--------+      +---------+
  |GitHub|----->|CodeBuild|----->|Terraform|
  |Repo  |      |  Plan  |      |  Apply  |
  +------+      +--------+      +---------+
                    |
                    v
              Manual Approval
              (for prod)
```

```hcl
resource "aws_codepipeline" "infra" {
  name     = "infrastructure-pipeline"
  role_arn = aws_iam_role.codepipeline.arn

  artifact_store {
    location = aws_s3_bucket.artifacts.bucket
    type     = "S3"
  }

  stage {
    name = "Source"
    action {
      name             = "Source"
      category         = "Source"
      owner            = "ThirdParty"
      provider         = "GitHub"
      version          = "1"
      output_artifacts = ["source_output"]
      configuration = {
        Owner  = "myorg"
        Repo   = "infrastructure"
        Branch = "main"
      }
    }
  }

  stage {
    name = "Plan"
    action {
      name            = "TerraformPlan"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      input_artifacts = ["source_output"]
      version         = "1"
      configuration = {
        ProjectName = aws_codebuild_project.tf_plan.name
      }
    }
  }

  stage {
    name = "Approve"
    action {
      name     = "ManualApproval"
      category = "Approval"
      owner    = "AWS"
      provider = "Manual"
      version  = "1"
    }
  }

  stage {
    name = "Apply"
    action {
      name            = "TerraformApply"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      input_artifacts = ["source_output"]
      version         = "1"
      configuration = {
        ProjectName = aws_codebuild_project.tf_apply.name
      }
    }
  }
}
```

## GitOps: Git as Single Source of Truth

```
GITOPS FLOW

  Developer pushes               Reconciliation Loop
  to Git repo                    (ArgoCD / Flux)
       |                              |
       v                              v
  +----------+     watches      +----------+
  |   Git    |<-----------------| GitOps   |
  |   Repo   |                  | Operator |
  +----------+                  +----------+
       |                              |
       | desired state                | compares & applies
       v                              v
  +----------+                  +----------+
  | Config   |                  |  Live    |
  | (wanted) |  == must match ==>| Cluster  |
  +----------+                  +----------+

  If someone manually changes the cluster,
  the operator REVERTS it back to Git state.
```

### ArgoCD Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/k8s-manifests.git
    targetRevision: main
    path: environments/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

## Infrastructure Testing

```
TESTING PYRAMID FOR INFRASTRUCTURE

              /\
             /  \       End-to-end
            / E2E\      (Deploy real infra, test, destroy)
           /------\
          / Integr \    Integration
         / ation    \   (Plan against real provider)
        /------------\
       /   Unit       \  Unit tests
      /   (validate,   \ (terraform validate, tflint)
     /    fmt, lint)    \
    /--------------------\
```

### Terratest (Go-based Testing)

```go
package test

import (
	"testing"
	"github.com/gruntwork-io/terratest/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

func TestVpcModule(t *testing.T) {
	t.Parallel()

	opts := &terraform.Options{
		TerraformDir: "../modules/vpc",
		Vars: map[string]interface{}{
			"name": "test-vpc",
			"cidr": "10.99.0.0/16",
		},
	}

	defer terraform.Destroy(t, opts)
	terraform.InitAndApply(t, opts)

	vpcId := terraform.Output(t, opts, "vpc_id")
	assert.NotEmpty(t, vpcId)

	cidr := terraform.Output(t, opts, "cidr_block")
	assert.Equal(t, "10.99.0.0/16", cidr)
}
```

### Policy Testing with OPA/Conftest

```rego
package terraform

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket"
    not resource.change.after.server_side_encryption_configuration
    msg := sprintf("S3 bucket %s must have encryption enabled", [resource.name])
}

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_security_group_rule"
    resource.change.after.cidr_blocks[_] == "0.0.0.0/0"
    resource.change.after.from_port == 22
    msg := "SSH must not be open to the world"
}
```

```bash
terraform plan -out=tfplan
terraform show -json tfplan > tfplan.json
conftest test tfplan.json --policy policy/
```

## Branch Strategy for Infrastructure

```
ENVIRONMENT PROMOTION

  feature/add-redis
       |
       v (PR + plan)
  develop -----------> dev environment
       |
       v (PR + plan)
  staging -----------> staging environment
       |
       v (PR + plan + approval)
  main --------------> production environment

  Each merge triggers:
  1. terraform plan (automatic)
  2. Review plan output
  3. terraform apply (automatic or gated)
```

## Exercises

1. Create a GitHub Actions workflow that runs `terraform fmt -check`, `terraform validate`, and `terraform plan` on PRs.

2. Add a manual approval gate using GitHub Environments for the apply step.

3. Write a Conftest policy that:
   - Denies any EC2 instance without tags
   - Denies any RDS instance that is publicly accessible
   - Requires all S3 buckets to have versioning enabled

4. Set up a basic ArgoCD application manifest that syncs Kubernetes manifests from a Git repository with automated self-healing.

5. Write a Terratest test that deploys an S3 bucket module, verifies the bucket exists, checks that encryption is enabled, then destroys it.

## Key Takeaways

```
+-------------------------------------------+
| CI/CD FOR INFRASTRUCTURE                  |
|                                           |
| 1. Never apply manually in production    |
| 2. Plan on PR, apply on merge            |
| 3. Test infra like you test code         |
| 4. GitOps = Git is the source of truth   |
| 5. Policy-as-code catches bad configs    |
| 6. Use approval gates for production     |
+-------------------------------------------+
```
