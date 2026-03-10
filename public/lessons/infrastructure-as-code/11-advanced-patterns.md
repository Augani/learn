# Lesson 11: Advanced HCL Patterns

> **The one thing to remember**: `count` creates multiple copies of a
> resource by number. `for_each` creates copies from a map or set,
> giving you named instances instead of numbered ones. `for_each` is
> almost always better than `count` because removing an item from the
> middle doesn't force Terraform to recreate everything after it.

---

## The Printing Press Analogy

`count` is like a printing press that makes numbered copies: copy #0,
copy #1, copy #2. If you remove copy #1, everything after it gets
renumbered — copy #2 becomes the new #1. That means Terraform destroys
and recreates it.

`for_each` is like a filing cabinet with labeled folders. Remove the
"staging" folder and the "dev" and "prod" folders are untouched. No
renumbering, no unnecessary destruction.

```
count vs for_each

  count = 3                          for_each = { "web", "api", "worker" }

  aws_instance.server[0]             aws_instance.server["web"]
  aws_instance.server[1]             aws_instance.server["api"]
  aws_instance.server[2]             aws_instance.server["worker"]

  Remove [1]? → [2] becomes [1]     Remove "api"? → "web" and "worker"
  Terraform destroys and recreates!   are untouched. Only "api" is removed.
```

---

## count

`count` creates multiple instances of a resource:

```hcl
resource "aws_instance" "web" {
  count         = 3
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "web-${count.index + 1}"
  }
}
```

This creates `aws_instance.web[0]`, `aws_instance.web[1]`, and
`aws_instance.web[2]`.

**Conditional resources** — use `count` to create or skip a resource:

```hcl
variable "create_database" {
  type    = bool
  default = true
}

resource "aws_db_instance" "main" {
  count            = var.create_database ? 1 : 0
  identifier       = "main-db"
  engine           = "postgres"
  instance_class   = "db.t3.micro"
  allocated_storage = 20
}

output "db_endpoint" {
  value = var.create_database ? aws_db_instance.main[0].endpoint : null
}
```

`count = 1` means "create it." `count = 0` means "skip it." This is
the Terraform equivalent of an if statement for resources.

---

## for_each

`for_each` iterates over a map or set:

```hcl
variable "servers" {
  type = map(object({
    instance_type = string
    ami           = string
  }))
  default = {
    web = {
      instance_type = "t2.micro"
      ami           = "ami-0c55b159cbfafe1f0"
    }
    api = {
      instance_type = "t2.small"
      ami           = "ami-0c55b159cbfafe1f0"
    }
    worker = {
      instance_type = "t2.medium"
      ami           = "ami-0c55b159cbfafe1f0"
    }
  }
}

resource "aws_instance" "server" {
  for_each      = var.servers
  ami           = each.value.ami
  instance_type = each.value.instance_type

  tags = {
    Name = each.key
    Role = each.key
  }
}
```

Inside the `for_each` block:
- `each.key` is the map key (`"web"`, `"api"`, `"worker"`)
- `each.value` is the map value (the object with instance_type and ami)

**for_each with a set of strings:**
```hcl
variable "bucket_names" {
  type    = set(string)
  default = ["logs", "backups", "uploads"]
}

resource "aws_s3_bucket" "bucket" {
  for_each = var.bucket_names
  bucket   = "mycompany-${each.key}"

  tags = {
    Name = each.key
  }
}
```

This creates `aws_s3_bucket.bucket["logs"]`,
`aws_s3_bucket.bucket["backups"]`, and
`aws_s3_bucket.bucket["uploads"]`.

---

## Dynamic Blocks

Some resources have repeating nested blocks (like security group
rules). Instead of writing each one manually, use `dynamic`:

**Without dynamic (repetitive):**
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
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
}
```

**With dynamic (DRY):**
```hcl
variable "ingress_rules" {
  type = list(object({
    port        = number
    cidr_blocks = list(string)
    description = string
  }))
  default = [
    { port = 80,  cidr_blocks = ["0.0.0.0/0"],  description = "HTTP" },
    { port = 443, cidr_blocks = ["0.0.0.0/0"],  description = "HTTPS" },
    { port = 22,  cidr_blocks = ["10.0.0.0/8"], description = "SSH internal" },
  ]
}

resource "aws_security_group" "web" {
  name   = "web-sg"
  vpc_id = aws_vpc.main.id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.port
      to_port     = ingress.value.port
      protocol    = "tcp"
      cidr_blocks = ingress.value.cidr_blocks
      description = ingress.value.description
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

```
DYNAMIC BLOCK ANATOMY

  dynamic "ingress" {           ← Name matches the nested block type
    for_each = var.ingress_rules ← What to iterate over
    content {                    ← The generated block content
      from_port = ingress.value.port ← "ingress" is the iterator name
    }                                   (same as the dynamic block name)
  }
```

---

## Terraform Functions

HCL has built-in functions for string manipulation, math, collections,
encoding, and more:

**String functions:**
```hcl
locals {
  upper_env = upper(var.environment)
  name      = join("-", ["myapp", var.environment, "web"])
  trimmed   = trimspace("  hello  ")
  replaced  = replace("hello-world", "-", "_")
}
```

**Collection functions:**
```hcl
locals {
  merged_tags = merge(
    var.common_tags,
    { Name = "web-server" }
  )

  flat_subnets   = flatten([var.public_subnets, var.private_subnets])
  unique_regions = distinct(var.regions)
  subnet_count   = length(var.subnets)
  first_az       = element(var.availability_zones, 0)
}
```

**Numeric functions:**
```hcl
locals {
  max_instances = min(var.desired_count, 10)
  storage_gb    = max(var.requested_storage, 20)
  cidr_offset   = pow(2, 32 - var.subnet_bits)
}
```

**Encoding functions:**
```hcl
locals {
  user_data_encoded = base64encode(file("${path.module}/scripts/init.sh"))
  config_json       = jsonencode({ port = 8080, debug = false })
  config_yaml       = yamlencode({ port = 8080, debug = false })
}
```

**Type conversion and testing:**
```hcl
locals {
  as_string  = tostring(42)
  as_number  = tonumber("42")
  as_list    = tolist(toset(["a", "b", "c"]))
  is_valid   = can(tonumber(var.port))
  safe_value = try(var.optional_map["key"], "default")
}
```

---

## Complex Expressions

**for expressions** — transform collections:

```hcl
variable "users" {
  type = list(string)
  default = ["alice", "bob", "charlie"]
}

locals {
  upper_users = [for u in var.users : upper(u)]
  user_map    = { for u in var.users : u => "${u}@company.com" }
  admins      = [for u in var.users : u if u != "charlie"]
}
```

`upper_users` = `["ALICE", "BOB", "CHARLIE"]`
`user_map` = `{ alice = "alice@company.com", bob = "bob@company.com", ... }`
`admins` = `["alice", "bob"]`

**Nested for expressions:**
```hcl
variable "environments" {
  default = ["dev", "staging", "prod"]
}

variable "services" {
  default = ["web", "api", "worker"]
}

locals {
  env_service_pairs = flatten([
    for env in var.environments : [
      for svc in var.services : {
        environment = env
        service     = svc
        name        = "${env}-${svc}"
      }
    ]
  ])
}
```

This produces 9 objects (3 environments x 3 services), each with a
name like "dev-web", "staging-api", "prod-worker".

---

## Putting It All Together

A real-world example that uses multiple advanced patterns:

```hcl
variable "services" {
  type = map(object({
    instance_type = string
    port          = number
    replicas      = number
    public        = bool
  }))
  default = {
    web = {
      instance_type = "t2.micro"
      port          = 80
      replicas      = 2
      public        = true
    }
    api = {
      instance_type = "t2.small"
      port          = 8080
      replicas      = 2
      public        = false
    }
    worker = {
      instance_type = "t2.medium"
      port          = 0
      replicas      = 1
      public        = false
    }
  }
}

locals {
  public_services = {
    for name, config in var.services : name => config
    if config.public
  }
}

resource "aws_security_group" "service" {
  for_each = var.services
  name     = "${each.key}-sg"
  vpc_id   = aws_vpc.main.id

  dynamic "ingress" {
    for_each = each.value.port > 0 ? [each.value.port] : []
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = each.value.public ? ["0.0.0.0/0"] : [aws_vpc.main.cidr_block]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${each.key}-sg"
    Service = each.key
  }
}
```

This creates a security group per service, with dynamic ingress rules
based on whether the service has a port and whether it's public.

---

## Exercises

1. **count vs for_each**: Create 3 `local_file` resources using
   `count`, then refactor to `for_each`. Remove the middle one. What
   happens with `count`? What happens with `for_each`?

2. **Dynamic blocks**: Create a security group variable with a list of
   ports. Use a `dynamic` block to generate ingress rules.

3. **for expressions**: Given a list of names, produce a map where
   keys are names and values are email addresses (`name@company.com`).

4. **Complex composition**: Create a variable that defines 3 different
   services with different instance types, ports, and replica counts.
   Use `for_each` and `count` together (for_each for services, count
   for replicas within each).

5. **Functions practice**: Use `merge`, `flatten`, `lookup`, `try`,
   and `can` in a single configuration. Write a local that safely
   reads from a map with a fallback default.

---

[Next: Lesson 12 — Testing Infrastructure Code](./12-testing-iac.md)
