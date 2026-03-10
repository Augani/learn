# Lesson 02: Declarative vs Imperative Approaches

> **The one thing to remember**: Declarative means "here's what I want"
> (Terraform). Imperative means "here's how to build it step by step"
> (scripts, Ansible). Declarative is like ordering food at a restaurant.
> Imperative is like following a recipe yourself.

---

## The GPS Analogy

Imagine you're giving directions to someone.

**Imperative** (step-by-step instructions):
"Turn left on Oak Street. Drive 2 miles. Turn right on Main. Go through
3 lights. Turn left into the parking lot."

**Declarative** (desired destination):
"Take me to 123 Main Street."

```
IMPERATIVE vs DECLARATIVE

  Imperative (HOW)                 Declarative (WHAT)
  ──────────────────               ──────────────────
  "Turn left"                      "Take me to 123 Main St"
  "Drive 2 miles"
  "Turn right"                     The GPS figures out how
  "Go through 3 lights"            to get there. If there's
  "Turn left into lot"             a detour, it recalculates.

  You describe the steps.          You describe the destination.
  If the road is closed,           The system adapts to
  the instructions break.          current conditions.
```

With imperative directions, if Oak Street is closed for construction,
you're stuck. With declarative, the GPS just finds another route.

Infrastructure as Code tools fall into these same two camps.

---

## Imperative: Shell Scripts

The oldest form of infrastructure automation is a Bash script:

```bash
#!/bin/bash

apt-get update
apt-get install -y nginx

cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80;
    server_name example.com;
    root /var/www/html;
}
EOF

systemctl enable nginx
systemctl start nginx

ufw allow 80/tcp
ufw allow 443/tcp
```

This works. It reads clearly: update packages, install nginx, write
a config, start the service, open firewall ports. But it has problems:

**Problem 1: Not idempotent.**
Run it twice and things might break. The second `apt-get install` is
fine (it skips already-installed packages), but writing the config
file will overwrite any manual changes. `systemctl start` on a running
service might error. The script doesn't check "what state are we in?"
before acting.

**Idempotent** means you can run something multiple times and get the
same result. Like pressing an elevator button — pressing it 5 times
doesn't call 5 elevators. A good infrastructure tool should be
idempotent: run it once, run it 10 times, same result.

**Problem 2: No state awareness.**
The script doesn't know what currently exists. It just barrels through
every command. If nginx is already installed and configured perfectly,
the script still runs every step.

**Problem 3: Hard to undo.**
There's no "un-run" for a script. You'd need to write a separate
teardown script that reverses every step.

---

## Imperative with State: Ansible

Ansible is a step up from raw scripts. It runs steps in order (imperative),
but each step is *idempotent* — it checks current state before acting:

```yaml
---
- name: Configure web server
  hosts: web_servers
  become: yes
  tasks:
    - name: Install nginx
      apt:
        name: nginx
        state: present
        update_cache: yes

    - name: Copy nginx config
      template:
        src: nginx.conf.j2
        dest: /etc/nginx/sites-available/default
      notify: restart nginx

    - name: Ensure nginx is running
      service:
        name: nginx
        state: started
        enabled: yes

    - name: Allow HTTP traffic
      ufw:
        rule: allow
        port: "80"
        proto: tcp

  handlers:
    - name: restart nginx
      service:
        name: nginx
        state: restarted
```

`state: present` means "make sure this is installed." If it's already
installed, Ansible skips it. `state: started` means "make sure it's
running." If it's already running, nothing happens.

```
BASH SCRIPT vs ANSIBLE

  Bash: "Install nginx"               Ansible: "Ensure nginx is present"
        → Runs every time                     → Checks first, skips if done

  Bash: "Start nginx"                 Ansible: "Ensure nginx is started"
        → Errors if already running           → Checks first, skips if running

  Bash: Run once only (fragile)       Ansible: Run anytime (safe)
```

But Ansible is still imperative in structure — tasks run top-to-bottom
in order. You're still describing *steps*, even if each step is smart.

---

## Declarative: Terraform

Terraform takes a fundamentally different approach. You don't describe
steps. You describe the end result:

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "web-server"
  }
}

resource "aws_security_group" "web_sg" {
  name = "web-sg"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

This file says: "I want a t2.micro EC2 instance and a security group
allowing port 80." That's it. Terraform figures out:
- Does this instance already exist? → Skip creating it.
- Does it exist but with the wrong size? → Update or replace it.
- Does it not exist at all? → Create it.
- Does something extra exist that isn't in the code? → Offer to delete it.

```
HOW TERRAFORM WORKS

  Your Code              Terraform State          Real Infrastructure
  (desired state)        (what Terraform          (what actually exists)
                          thinks exists)

  +-----------+          +-----------+            +-----------+
  | web: t2.  |          | web: t2.  |            | web: t2.  |
  | micro     |  compare | micro     |   compare  | micro     |
  |           |<-------->|           |<---------->|           |
  | sg: port  |          | sg: port  |            | sg: port  |
  | 80        |          | 80        |            | 80, 443   |
  +-----------+          +-----------+            +-----------+
                                                       ^
        "I want this"       "I remember this"     "This is real"
                                                       |
                                                  Someone added
                                                  port 443 manually!

  Terraform detects the difference and shows you:
  "Security group has port 443 open but your code doesn't include it.
   I'll remove port 443 to match your code."
```

This is the key insight: **Terraform continuously reconciles desired
state (your code) with actual state (the real infrastructure)**.

---

## When to Use Which

```
CHOOSING YOUR TOOL

  Need to...                          Use...
  ──────────────────────────────      ──────────
  Create cloud resources              Terraform (declarative)
  (VMs, databases, networks)

  Configure what's ON a server        Ansible (imperative + idempotent)
  (install packages, edit configs)

  One-off automation tasks            Shell scripts (imperative)
  (deploy scripts, backups)

  Full infrastructure lifecycle       Terraform + Ansible together
  (create resources, then configure)
```

In practice, many teams use both:

```
THE COMMON PATTERN

  Terraform                          Ansible
  ────────────                       ──────────
  Creates the VM                     Installs software on the VM
  Creates the network                Configures services
  Creates the database               Manages application config
  Creates DNS records                Deploys application code
  Creates load balancers             Handles rolling updates

  "Build the kitchen"                "Stock and organize the kitchen"
```

Terraform is great at creating cloud resources but doesn't manage what
runs inside them. Ansible is great at configuring servers but doesn't
create cloud resources well. Together, they cover the full stack.

---

## The Desired State Model in Depth

Terraform's declarative model has a beautiful property: **convergence**.
No matter what state your infrastructure is in, applying the same
Terraform code will bring it to the desired state.

```
CONVERGENCE

  Starting State          Apply Code          Result
  ──────────────          ──────────          ──────
  Nothing exists          terraform apply     Creates everything
  Everything correct      terraform apply     No changes (no-op)
  Something was deleted   terraform apply     Recreates it
  Something was changed   terraform apply     Reverts the change
  Extra stuff exists      terraform apply     Removes extras

  Five different starting points. Same result every time.
  THAT is the power of declarative infrastructure.
```

Compare this to a Bash script: if you run it on a server that already
has nginx installed with a different config, the script might partially
succeed, partially fail, or overwrite things unexpectedly. The script
doesn't check where you're starting from.

---

## A Real-World Comparison

Let's say you need 3 web servers behind a load balancer.

**Imperative (Bash)**:
```bash
for i in 1 2 3; do
  aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1f0 \
    --instance-type t2.micro \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=web-$i}]"
done

aws elbv2 create-load-balancer --name web-lb --subnets subnet-abc subnet-def
aws elbv2 create-target-group --name web-tg --protocol HTTP --port 80 --vpc-id vpc-123
```

Now add a 4th server. You run the loop again? No, that creates 3 more.
You run just one command? Which command, with which parameters? What if
you need to remove a server later?

**Declarative (Terraform)**:
```hcl
resource "aws_instance" "web" {
  count         = 3
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "web-${count.index + 1}"
  }
}

resource "aws_lb" "web" {
  name               = "web-lb"
  internal           = false
  load_balancer_type = "application"
  subnets            = ["subnet-abc", "subnet-def"]
}
```

Need a 4th server? Change `count = 3` to `count = 4`. Apply. Done.
Need to remove one? Change to `count = 2`. Apply. Done. Terraform
figures out which ones to create or destroy.

---

## Summary Table

```
COMPARISON AT A GLANCE

                    Shell Scripts    Ansible          Terraform
                    ────────────     ──────────       ─────────
  Approach          Imperative       Imperative       Declarative
  Idempotent?       No               Yes              Yes
  State tracking?   No               Partial          Full
  Undo/destroy?     Manual           Manual           Built-in
  Best for          One-off tasks    Server config    Cloud resources
  Learning curve    Low              Medium           Medium
  Agentless?        N/A              Yes (SSH)        Yes (API)
```

---

## Exercises

1. **Idempotency test**: Write a Bash script that creates a file with
   some content. Run it twice. What happens? Now write it so it checks
   if the file exists first. That's idempotency.

2. **Mental model**: You have 5 servers. You want to change the instance
   type on server 3. Describe how you'd do this with (a) AWS Console,
   (b) a Bash script, (c) Terraform. Which is safest?

3. **Convergence thinking**: Your Terraform code says 3 servers. Someone
   manually deletes one in the console. What happens on the next
   `terraform apply`?

4. **Tool selection**: For each scenario, pick the right tool:
   - Create an S3 bucket → ?
   - Install Python on 50 servers → ?
   - Backup a database daily → ?
   - Create a VPC with subnets → ?

---

[Next: Lesson 03 — Your First Terraform Resource](./03-terraform-first-resource.md)
