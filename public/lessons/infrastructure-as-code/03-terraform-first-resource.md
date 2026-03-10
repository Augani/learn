# Lesson 03: Your First Terraform Resource

> **The one thing to remember**: Terraform's workflow is three steps:
> `init` (set up), `plan` (preview), `apply` (execute). Always plan
> before you apply. The plan is your safety net — it shows you exactly
> what will change before anything actually happens.

---

## The Blueprint Analogy

Building infrastructure with Terraform is like building a house.

1. **Write the blueprint** (your `.tf` files) — what you want built
2. **Review the blueprint** (`terraform plan`) — check the details
3. **Build it** (`terraform apply`) — the construction crew does the work

You wouldn't start pouring concrete without reviewing the blueprint.
Don't `apply` without reading the `plan`.

```
THE TERRAFORM WORKFLOW

  Write .tf files ──→ terraform init ──→ terraform plan ──→ terraform apply
       │                    │                  │                   │
       │                    │                  │                   │
   "What I want"    "Download the        "Here's what         "Do it"
                     tools I need"        I'm going to do"
```

---

## Installing Terraform

Terraform is a single binary. No runtime, no dependencies, no package
manager battles.

**macOS** (with Homebrew):
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

**Linux** (Ubuntu/Debian):
```bash
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

**Windows** (with Chocolatey):
```
choco install terraform
```

**Verify it works:**
```bash
terraform version
```

You should see something like `Terraform v1.7.x`. The exact version
doesn't matter for this course.

---

## Your First Terraform File

Create a new directory and file:

```bash
mkdir learn-terraform && cd learn-terraform
```

Create a file called `main.tf`:

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

resource "local_file" "hello" {
  content  = "Hello from Terraform!"
  filename = "${path.module}/hello.txt"
}
```

We're using the `local` provider — it manages files on your own machine.
No cloud account needed. No credit card. No risk of accidentally
spinning up a $500 server.

Let's break down every piece of this file:

```
ANATOMY OF A TERRAFORM FILE

  terraform {                          ← Settings block
    required_version = ">= 1.0"       ← Minimum Terraform version
    required_providers {               ← Which plugins we need
      local = {
        source  = "hashicorp/local"    ← Where to download it
        version = "~> 2.0"            ← Version constraint
      }
    }
  }

  resource "local_file" "hello" {      ← Resource block
  ─────── ────────────  ───────
     │         │           │
     │         │           └─ YOUR name for this resource
     │         └─ The resource TYPE (provider_thing)
     └─ Keyword: "I want a resource"

    content  = "Hello from Terraform!" ← Argument (input)
    filename = "${path.module}/hello.txt" ← Another argument
  }
```

The resource type `local_file` follows a pattern: `provider_resourcetype`.
The `local` provider gives us `local_file`. The AWS provider gives us
`aws_instance`, `aws_s3_bucket`, `aws_vpc`, and hundreds more.

---

## Step 1: Init

```bash
terraform init
```

This does three things:
1. Downloads the `local` provider plugin
2. Creates a `.terraform/` directory to store plugins
3. Creates a `.terraform.lock.hcl` file to pin versions

```
WHAT terraform init CREATES

  learn-terraform/
  ├── main.tf                    ← Your code (you wrote this)
  ├── .terraform/                ← Plugin directory (auto-created)
  │   └── providers/
  │       └── hashicorp/local/   ← Downloaded provider binary
  └── .terraform.lock.hcl       ← Version lock file (auto-created)
```

You run `init` once when you start a project, and again whenever you
add a new provider. Think of it like `npm install` for Node.js or
`pip install` for Python.

---

## Step 2: Plan

```bash
terraform plan
```

Terraform reads your `.tf` files, compares them to the current state
(nothing exists yet), and tells you what it would do:

```
Terraform will perform the following actions:

  # local_file.hello will be created
  + resource "local_file" "hello" {
      + content              = "Hello from Terraform!"
      + directory_permission = "0777"
      + file_permission      = "0777"
      + filename             = "./hello.txt"
      + id                   = (known after apply)
    }

Plan: 1 to add, 0 to change, 0 to destroy.
```

```
READING A PLAN

  + means CREATE (new resource)
  ~ means UPDATE (change in place)
  - means DESTROY (delete resource)
  -/+ means REPLACE (destroy and recreate)

  Green (+) = adding something
  Yellow (~) = changing something
  Red (-) = removing something

  The plan NEVER makes changes. It's read-only.
  It's the blueprint review, not the construction.
```

Read the plan carefully. It shows:
- What resources will be created, changed, or destroyed
- The exact values for each argument
- Values that won't be known until after creation (marked `known after apply`)

---

## Step 3: Apply

```bash
terraform apply
```

Terraform shows the plan again and asks for confirmation:

```
Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value: yes
```

Type `yes` (the full word, not just `y`). Terraform creates the file:

```
local_file.hello: Creating...
local_file.hello: Creation complete after 0s [id=a8fdc205a9f19cc1c7507a60c4f01b13d11d7fd0]

Apply complete! Resources: 1 added, 0 changed, 0 destroyed.
```

Check that it worked:

```bash
cat hello.txt
```

Output: `Hello from Terraform!`

---

## What Just Happened Under the Hood

Terraform created two things: your `hello.txt` file and a **state file**.

```
AFTER terraform apply

  learn-terraform/
  ├── main.tf                  ← Your code
  ├── hello.txt                ← The resource Terraform created
  ├── terraform.tfstate        ← STATE FILE (critical!)
  ├── .terraform/              ← Plugins
  └── .terraform.lock.hcl     ← Version lock
```

The `terraform.tfstate` file is Terraform's memory. It records what
resources exist and their current configuration. This is how Terraform
knows what to do on the next `apply` — it compares your code to the
state file to figure out what changed.

```
THE THREE-WAY COMPARISON

  Your Code (.tf)     State File (.tfstate)     Real World
  ────────────────    ───────────────────────    ──────────
  "hello.txt with     "hello.txt exists with     hello.txt exists
   content X"          content X, created at      with content X
                       2024-01-15 10:30:00"

  All three agree → terraform plan says "No changes."
```

---

## Making Changes

Edit `main.tf` to change the content:

```hcl
resource "local_file" "hello" {
  content  = "Hello from Terraform! Updated."
  filename = "${path.module}/hello.txt"
}
```

Run `terraform plan`:

```
  # local_file.hello must be replaced
  -/+ resource "local_file" "hello" {
      ~ content              = "Hello from Terraform!" -> "Hello from Terraform! Updated."
        # (3 unchanged attributes hidden)
      }

Plan: 1 to add, 0 to change, 1 to destroy.
```

The `-/+` means Terraform will destroy the old file and create a new one.
The `~` on `content` shows exactly what changed. Run `terraform apply`
and type `yes` to make the change.

---

## Destroying Resources

When you're done, clean up:

```bash
terraform destroy
```

Terraform shows what it will remove and asks for confirmation. Type
`yes` and everything Terraform created is deleted.

```
TERRAFORM LIFECYCLE

  terraform init      Set up. Download providers.
       │
       v
  terraform plan      Preview changes. Read-only.
       │
       v
  terraform apply     Make changes. Creates/updates/deletes.
       │
       v
  terraform destroy   Remove everything. Clean up.
```

---

## Common Mistakes and How to Fix Them

**Mistake: Running apply without reading the plan.**
The plan might say "destroy 47 resources." Always read it.

**Mistake: Editing the state file by hand.**
Never do this. The state file is Terraform's internal data. Use
`terraform state` commands if you need to modify state (Lesson 06).

**Mistake: Not committing `.terraform.lock.hcl` to Git.**
This file pins exact provider versions. Commit it. Don't commit
`.terraform/` (the directory) — add it to `.gitignore`.

**Mistake: Committing `terraform.tfstate` to Git.**
State files can contain secrets (database passwords, API keys).
Never commit them to Git. We'll cover remote state in Lesson 10.

```
WHAT TO COMMIT TO GIT

  ✓ Commit:    *.tf files, .terraform.lock.hcl
  ✗ Ignore:    .terraform/, terraform.tfstate, terraform.tfstate.backup
  ✗ Never:     Any file containing secrets

  .gitignore for Terraform:
  ──────────────────────────
  .terraform/
  *.tfstate
  *.tfstate.backup
  *.tfvars       (may contain secrets)
```

---

## Exercises

1. **First resource**: Follow this lesson exactly. Create the `local_file`
   resource, run init/plan/apply, verify the file exists.

2. **Modify and observe**: Change the file content 3 times, running
   `plan` each time. Read the diff output. Get comfortable reading plans.

3. **Add a second resource**: Add another `local_file` with a different
   name and content. Plan and apply. How does the output differ?

4. **Destroy and rebuild**: Run `terraform destroy`, then `terraform
   apply`. Everything should come back exactly as defined. That's
   reproducibility.

5. **Break it on purpose**: Remove the `filename` argument and run
   `terraform plan`. Read the error message. Terraform's error messages
   are usually very helpful.

---

[Next: Lesson 04 — Providers and Resources](./04-providers-resources.md)
