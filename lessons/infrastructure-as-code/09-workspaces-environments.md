# Lesson 09: Workspaces and Environments

> **The one thing to remember**: Every application needs multiple
> environments — dev for experimenting, staging for testing, prod for
> real users. There are two main ways to separate them in Terraform:
> workspaces (same code, different state) and directory-based (separate
> directories per environment). Most teams prefer directories.

---

## The Apartment Building Analogy

Think of your Terraform code as a building floor plan. You want to
build the same floor plan in three different locations:

- **Dev**: A small test building (cheap materials, one floor)
- **Staging**: A medium building (closer to real, two floors)
- **Prod**: The real building (premium materials, five floors)

Same floor plan, different specifications. The question is how to
organize this.

```
TWO APPROACHES TO ENVIRONMENTS

  Approach 1: WORKSPACES               Approach 2: DIRECTORIES
  (Same drawer, different labels)      (Different drawers)

  project/                             project/
  ├── main.tf          ← shared        ├── modules/
  ├── variables.tf     ← shared        │   └── vpc/
  ├── outputs.tf       ← shared        │       ├── main.tf
  └── terraform.tfstate.d/             │       └── variables.tf
      ├── dev/                         ├── environments/
      │   └── terraform.tfstate        │   ├── dev/
      ├── staging/                     │   │   ├── main.tf
      │   └── terraform.tfstate        │   │   └── terraform.tfvars
      └── prod/                        │   ├── staging/
          └── terraform.tfstate        │   │   ├── main.tf
                                       │   │   └── terraform.tfvars
  One codebase, multiple states.       │   └── prod/
  Switch with: terraform workspace     │       ├── main.tf
                                       │       └── terraform.tfvars

                                       Separate directories, separate states.
                                       Each environment is independent.
```

---

## Terraform Workspaces

Workspaces let you maintain multiple state files for the same
configuration. By default, you're in the `default` workspace.

**Create and switch workspaces:**
```bash
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

terraform workspace list
```
```
  default
* dev
  staging
  prod
```

**Switch between them:**
```bash
terraform workspace select prod
```

**Use the workspace name in your code:**
```hcl
variable "instance_types" {
  type = map(string)
  default = {
    dev     = "t2.micro"
    staging = "t2.small"
    prod    = "t2.large"
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_types[terraform.workspace]

  tags = {
    Name        = "web-${terraform.workspace}"
    Environment = terraform.workspace
  }
}
```

`terraform.workspace` returns the current workspace name. You can use
it to look up environment-specific values from maps.

```
WORKSPACE WORKFLOW

  $ terraform workspace select dev
  $ terraform apply                    → Creates dev infrastructure
                                         State: terraform.tfstate.d/dev/

  $ terraform workspace select prod
  $ terraform apply                    → Creates prod infrastructure
                                         State: terraform.tfstate.d/prod/

  Same code. Different state. Different resources.
```

---

## Problems with Workspaces

Workspaces seem elegant, but they have real problems in practice:

```
WORKSPACE RISKS

  Problem 1: HUMAN ERROR
  ───────────────────────
  $ terraform workspace select prod    ← Thought I was in dev
  $ terraform apply                    ← Just applied dev config to prod
  $ terraform destroy                  ← Just destroyed production

  There's no visual distinction. The terminal looks the same.
  The only difference is which workspace is selected.

  Problem 2: SHARED CODE
  ──────────────────────
  Dev and prod share the SAME .tf files. You can't have a resource
  that exists only in prod. You can't test a code change in dev
  without also changing what prod will deploy next.

  Problem 3: ALL-OR-NOTHING
  ─────────────────────────
  You apply the entire configuration per workspace. You can't
  apply just the database changes to prod while testing everything
  else in dev.

  Problem 4: NO ISOLATION
  ───────────────────────
  A mistake in shared code affects all environments. A syntax error
  in main.tf blocks ALL workspaces, not just dev.
```

---

## Directory-Based Environments (Recommended)

Most experienced teams use separate directories per environment:

```
DIRECTORY STRUCTURE

  infrastructure/
  ├── modules/                    ← Shared modules (the building blocks)
  │   ├── vpc/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   └── outputs.tf
  │   ├── ec2/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   └── outputs.tf
  │   └── rds/
  │       ├── main.tf
  │       ├── variables.tf
  │       └── outputs.tf
  │
  └── environments/               ← Environment-specific configs
      ├── dev/
      │   ├── main.tf             ← Calls modules with dev settings
      │   ├── terraform.tfvars    ← Dev-specific values
      │   └── backend.tf          ← Dev state location
      ├── staging/
      │   ├── main.tf
      │   ├── terraform.tfvars
      │   └── backend.tf
      └── prod/
          ├── main.tf
          ├── terraform.tfvars
          └── backend.tf
```

**environments/dev/main.tf:**
```hcl
module "vpc" {
  source      = "../../modules/vpc"
  environment = "dev"
  vpc_cidr    = "10.0.0.0/16"
}

module "web" {
  source        = "../../modules/ec2"
  instance_type = "t2.micro"
  instance_count = 1
  subnet_ids    = module.vpc.public_subnet_ids
}
```

**environments/prod/main.tf:**
```hcl
module "vpc" {
  source      = "../../modules/vpc"
  environment = "prod"
  vpc_cidr    = "10.2.0.0/16"
}

module "web" {
  source         = "../../modules/ec2"
  instance_type  = "t2.large"
  instance_count = 3
  subnet_ids     = module.vpc.public_subnet_ids
}

module "database" {
  source         = "../../modules/rds"
  instance_class = "db.r5.large"
  multi_az       = true
  subnet_ids     = module.vpc.private_subnet_ids
}
```

Notice: prod has a database module that dev doesn't. Dev uses tiny
instances. Prod uses large ones with multi-AZ. Each environment is
independently managed.

**To apply:**
```bash
cd infrastructure/environments/dev
terraform init
terraform apply

cd infrastructure/environments/prod
terraform init
terraform apply
```

---

## Comparing the Approaches

```
WORKSPACES vs DIRECTORIES

                        Workspaces              Directories
  ────────────────      ──────────              ───────────
  Code sharing          Shared (same files)     Modules (shared logic)
  State isolation       Separate state files    Completely separate
  Human error risk      HIGH (wrong workspace)  LOW (different dirs)
  Env-specific config   Maps + conditionals     Different .tf files
  Prod-only resources   Awkward conditionals    Just add to prod/
  CI/CD complexity      Workspace management    Simple directory paths
  Team preference       Small teams, simple     Most teams, recommended

  RECOMMENDATION: Use directories for anything beyond personal projects.
```

---

## The Hybrid Approach: Terragrunt

Some teams use Terragrunt (a thin wrapper around Terraform) to reduce
duplication in directory-based approaches:

```
WITH TERRAGRUNT

  infrastructure/
  ├── modules/
  │   └── vpc/
  ├── terragrunt.hcl              ← Common config (backend, provider)
  └── environments/
      ├── dev/
      │   └── terragrunt.hcl     ← include parent + dev overrides
      ├── staging/
      │   └── terragrunt.hcl     ← include parent + staging overrides
      └── prod/
          └── terragrunt.hcl     ← include parent + prod overrides
```

Terragrunt lets you keep the isolation of directories while reducing
the boilerplate. It's a separate tool you'd learn after mastering
Terraform itself.

---

## Environment-Specific Variables

With directories, use `.tfvars` files for environment differences:

**environments/dev/terraform.tfvars:**
```hcl
environment    = "dev"
instance_type  = "t2.micro"
instance_count = 1
db_multi_az    = false
enable_cdn     = false
```

**environments/prod/terraform.tfvars:**
```hcl
environment    = "prod"
instance_type  = "t2.large"
instance_count = 3
db_multi_az    = true
enable_cdn     = true
```

The modules read these variables and build infrastructure accordingly.
Same modules, different configurations, complete isolation.

---

## Exercises

1. **Workspace basics**: Create `dev` and `prod` workspaces. Use
   `terraform.workspace` to create a `local_file` with the workspace
   name in its content. Switch between workspaces and apply.

2. **Directory setup**: Create a `modules/file/` module and two
   environment directories (`dev/`, `prod/`) that use it with different
   inputs.

3. **Risk assessment**: You accidentally run `terraform destroy` while
   in the wrong workspace. With workspaces, what happens? With
   directories, how is this risk mitigated?

4. **Migration plan**: You have a workspace-based setup with dev and
   prod. Write the steps to migrate to a directory-based approach
   without destroying any infrastructure.

5. **CI/CD design**: Design a CI/CD pipeline that deploys to dev on
   every push, staging on merge to main, and prod with manual approval.
   Which approach (workspaces or directories) makes this easier?

---

[Next: Lesson 10 — Remote State](./10-remote-state.md)
