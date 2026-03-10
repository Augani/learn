# Lesson 01: Why Infrastructure as Code

> **The one thing to remember**: Infrastructure as Code means you write
> down the instructions for building your servers and networks in a file,
> just like a recipe. Anyone can follow the recipe and get the same
> result every time. No more "it works on my server."

---

## The Restaurant Analogy

Imagine two restaurants.

**Restaurant A** has no written recipes. The head chef just *knows* how
to make everything. When a dish tastes different each night, nobody can
figure out why. When the chef is sick, the restaurant struggles. When
they open a second location, they spend months trying to recreate the
menu because everything lives in one person's head.

**Restaurant B** writes down every recipe with exact measurements,
temperatures, and timing. Any trained cook can follow the recipe and
produce the same dish. Opening a second location means photocopying the
recipe book. When something goes wrong, they check the recipe.

```
RESTAURANT A (ClickOps)          RESTAURANT B (Infrastructure as Code)

  Chef's brain                     Written recipes
  "I just know"                    "Step 1: preheat to 375F"
  Unreproducible                   Reproducible
  Single point of failure          Anyone can follow
  Can't scale                      Copy and repeat
  "What did we change?"            Git blame tells you exactly
```

Infrastructure as Code is choosing to be Restaurant B. Instead of
logging into a server and clicking buttons to configure it (ClickOps),
you write a file that describes what you want, and a tool builds it
for you.

---

## ClickOps: The Problem

ClickOps means managing infrastructure by clicking through a web
console — AWS Console, Azure Portal, GCP Cloud Console.

Here's what ClickOps looks like in practice:

```
THE CLICKOPS WORKFLOW

  1. Log into AWS Console
  2. Click "EC2" → "Launch Instance"
  3. Choose Amazon Linux 2, t2.micro
  4. Configure security group: allow port 22, 80, 443
  5. Click "Launch"
  6. Repeat for staging... wait, was it t2.micro or t2.small?
  7. Repeat for production... did I open port 8080 last time?
  8. Three months later: "Why is staging different from prod?"
  9. Six months later: "Who changed this security group?"
  10. One year later: "I'm afraid to touch anything."
```

This workflow has five fatal problems:

**1. No record of what you did.**
There's no file you can read to see the current configuration. The
"source of truth" is whatever is running right now, and you have to
click through dozens of pages to piece it together.

**2. No way to reproduce it.**
Setting up a second environment means doing everything again from
memory. You will forget steps. The environments will drift apart.

**3. No way to review changes.**
When someone changes a security group, nobody else knows. There's no
pull request, no code review, no approval process.

**4. No way to roll back.**
If a change breaks something, you have to remember what it was before
and manually undo it. Under pressure. At 2 AM.

**5. It doesn't scale.**
Managing 3 servers by hand is tedious. Managing 30 is painful.
Managing 300 is impossible.

---

## The Snowflake Server Problem

A **snowflake server** is a server that has been configured by hand over
time until it's completely unique — like a snowflake, no two are alike.

```
THE SNOWFLAKE SERVER

  Day 1:    Install Ubuntu, set up nginx
  Day 15:   SSH in, install SSL cert manually
  Day 30:   Quick fix: edit nginx.conf directly
  Day 60:   Install monitoring agent, tweak settings
  Day 90:   Another quick fix, different person
  Day 120:  Install security patch, reboot
  Day 180:  "This server is a masterpiece of duct tape"
  Day 365:  "NOBODY TOUCH THIS SERVER. EVER."

  Result: A server nobody understands, nobody can rebuild,
          and everybody is afraid to replace.
```

Snowflake servers are the #1 cause of the phrase "it works on that
server but not this one." Each one is a ticking time bomb — when it
dies, you can't rebuild it because nobody remembers every change that
was made over the past two years.

---

## The IaC Solution

With Infrastructure as Code, your infrastructure is defined in text
files. Those files are stored in version control (Git). Changes go
through pull requests. History is preserved forever.

```
THE IAC WORKFLOW

  1. Write a file describing what you want:

     resource "aws_instance" "web" {
       ami           = "ami-0c55b159cbfafe1f0"
       instance_type = "t2.micro"
     }

  2. Run: terraform plan
     → "I will create 1 EC2 instance"

  3. Review the plan. Looks good.

  4. Run: terraform apply
     → Instance created.

  5. Commit the file to Git.
     → Now you have a permanent record.

  6. Need a second environment?
     → Copy the file. Change one variable. Apply.

  7. Something breaks?
     → git log shows exactly what changed and when.
     → git revert to roll back.
```

Here's what that looks like as a real Terraform file:

```hcl
provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "web_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name        = "web-server"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

resource "aws_security_group" "web_sg" {
  name = "web-server-sg"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

Read that file. Even if you've never seen Terraform before, you can
tell what it does: it creates a web server and a security group that
allows traffic on ports 80 and 443. That's the power of declarative
infrastructure — the code *is* the documentation.

---

## The Five Pillars of IaC

```
THE FIVE PILLARS

  +------------------+
  | Version Control  |  Every change is tracked in Git.
  +------------------+  Who changed what, when, and why.
          |
  +------------------+
  | Reproducibility  |  Run the same code, get the same infra.
  +------------------+  Dev, staging, and prod from one source.
          |
  +------------------+
  | Self-Documenting |  The code IS the documentation.
  +------------------+  No wiki pages to keep updated.
          |
  +------------------+
  | Peer Review      |  Changes go through pull requests.
  +------------------+  Someone reviews before it hits prod.
          |
  +------------------+
  | Automation       |  CI/CD can apply changes automatically.
  +------------------+  Humans approve, machines execute.
```

**Version Control**: Your infrastructure's entire history lives in Git.
You can see every change ever made, who made it, and why (if they wrote
a good commit message). You can diff two points in time. You can revert.

**Reproducibility**: The same Terraform code applied twice produces
identical infrastructure. Want a staging environment that mirrors
production? Same code, different variables.

**Self-Documenting**: Want to know what's running? Read the code. No
more "log into the console and click around to figure out what exists."
The Terraform files are always the source of truth.

**Peer Review**: Infrastructure changes go through pull requests just
like application code. A teammate reviews the plan output before
anything touches production.

**Automation**: Once the code is merged, a CI/CD pipeline can apply it
automatically. No human needs to run commands manually.

---

## What IaC Looks Like in Practice

```
A TYPICAL IAC REPO STRUCTURE

  infrastructure/
  ├── modules/
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
  ├── environments/
  │   ├── dev/
  │   │   ├── main.tf
  │   │   └── terraform.tfvars
  │   ├── staging/
  │   │   ├── main.tf
  │   │   └── terraform.tfvars
  │   └── prod/
  │       ├── main.tf
  │       └── terraform.tfvars
  └── README.md
```

The `modules/` directory contains reusable building blocks. The
`environments/` directory uses those blocks with different settings.
Production might use larger instances and multi-AZ databases. Dev
might use the smallest instances possible to save money. Same code,
different variables.

---

## Exercises

1. **Audit your current setup**: If you use any cloud services (even a
   personal AWS account), log into the console and try to list everything
   that's running. How long does it take? Could someone else figure out
   your setup by looking at the console alone?

2. **Snowflake inventory**: Think about servers or systems you've
   configured by hand. Could you rebuild them from scratch? How long
   would it take?

3. **Before and after**: Write down (in plain English) the steps to
   create a web server with a database. Count the steps. Now look at the
   Terraform example above — how many lines does the same thing take?

4. **Version control thought experiment**: A teammate changed a firewall
   rule last week and now the app is broken. With ClickOps, how do you
   find the change? With IaC and Git, how do you find it?

---

[Next: Lesson 02 — Declarative vs Imperative](./02-declarative-vs-imperative.md)
