# Lesson 06: Infrastructure Abstraction

## The Car Dashboard Analogy

When you drive a car, you interact with a steering wheel, pedals, and a
dashboard. You don't directly manipulate the fuel injectors, transmission
gears, or ABS modules. The dashboard abstracts hundreds of mechanical and
electronic systems into a simple interface.

But the dashboard doesn't hide everything. Warning lights tell you when
something's wrong. The tachometer shows engine RPM if you need it. A good
abstraction simplifies without making the underlying system opaque.

Infrastructure abstraction works the same way. Developers shouldn't need to
write Terraform HCL or Helm templates to get a database. They should express
intent — "I need a PostgreSQL database for production" — and the platform
translates that into the right infrastructure.

```
  ABSTRACTION LAYERS:

  Developer sees:           Platform translates:      Cloud provides:
  +-----------------+       +------------------+      +-----------------+
  | "I need a       |       | Terraform module |      | RDS instance    |
  |  PostgreSQL     |------>| with 47 params   |----->| Security groups |
  |  database,      |       | all pre-filled   |      | Subnet config   |
  |  medium size,   |       | based on intent  |      | Backup schedule |
  |  production"    |       |                  |      | Monitoring      |
  +-----------------+       +------------------+      +-----------------+

  Developer writes:         Platform manages:         Cloud manages:
  8 lines of YAML           200 lines of Terraform    Actual hardware
```

## The Abstraction Spectrum

There's a spectrum from "raw cloud" to "fully abstracted." Different
organizations land at different points.

```
  ABSTRACTION SPECTRUM:

  Raw Cloud          Modules            Operators          Full Abstraction
  |                  |                  |                  |
  v                  v                  v                  v
  Write raw          Use shared         Declare desired    "Give me a
  Terraform          Terraform          state via CRDs     database"
  for every          modules with       and controllers    (portal button)
  resource           sane defaults      reconcile

  +---------------+  +---------------+  +---------------+  +---------------+
  | resource "aws" |  | module "db" { |  | kind: Database|  | [Create DB]   |
  |  _rds_instance |  |   source =    |  | spec:         |  | Name: ____    |
  |  "main" {      |  |   "acme/rds"  |  |   engine: pg  |  | Size: [S M L] |
  |   engine = ... |  |   name = "db" |  |   size: med   |  | [Submit]      |
  |   instance = ..|  |   size = "med"|  |               |  |               |
  |   subnet = ... |  | }             |  |               |  |               |
  |   security = ..|  |               |  |               |  |               |
  |   backup = ... |  |               |  |               |  |               |
  |   ... 40 more  |  |               |  |               |  |               |
  | }              |  |               |  |               |  |               |
  +---------------+  +---------------+  +---------------+  +---------------+

  Flexibility: HIGH   Flexibility: MED   Flexibility: MED   Flexibility: LOW
  Complexity:  HIGH   Complexity:  MED   Complexity:  LOW   Complexity:  LOW
  Expertise:   HIGH   Expertise:   MED   Expertise:   LOW   Expertise:   NONE
```

Most platform teams start with shared modules and evolve toward operators
and CRDs as their platform matures.

## Crossplane: Infrastructure as Kubernetes Resources

Crossplane extends Kubernetes to manage cloud infrastructure. Developers
define infrastructure using Kubernetes-style YAML, and Crossplane controllers
provision and manage the actual cloud resources.

```
  CROSSPLANE ARCHITECTURE:

  Developer                   Crossplane                    Cloud
  +----------+               +-------------------+         +---------+
  | Apply    |   K8s API     | Composition       |  API    | AWS RDS |
  | Database |-------------->| Engine resolves   |-------->| created |
  | claim    |               | to cloud resources|         |         |
  +----------+               +-------------------+         +---------+
       |                            |                           |
       |                     +------+------+                    |
       |                     |             |                    |
       |              +-----------+  +-----------+              |
       |              | Provider  |  | Provider  |              |
       |              | AWS       |  | Helm      |              |
       |              +-----------+  +-----------+              |
       |                     |             |                    |
       |               Manages:      Manages:                   |
       |               RDS, SG,      Monitoring,                |
       |               Subnet        Dashboard                  |
       |                                                        |
       +--- Status updates flow back to the claim: ready/failed
```

### Crossplane Composition

A Composition defines how a developer's simple request maps to complex
cloud resources:

```yaml
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xdatabases.platform.acme.com
spec:
  group: platform.acme.com
  names:
    kind: XDatabase
    plural: xdatabases
  claimNames:
    kind: Database
    plural: databases
  versions:
    - name: v1
      served: true
      referenceable: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required:
                - engine
                - size
                - environment
              properties:
                engine:
                  type: string
                  enum: [postgresql, mysql]
                size:
                  type: string
                  enum: [small, medium, large]
                environment:
                  type: string
                  enum: [staging, production]
            status:
              type: object
              properties:
                host:
                  type: string
                port:
                  type: integer
                secretName:
                  type: string
                ready:
                  type: boolean

---
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: database-aws
  labels:
    provider: aws
spec:
  compositeTypeRef:
    apiVersion: platform.acme.com/v1
    kind: XDatabase
  resources:
    - name: rds-instance
      base:
        apiVersion: rds.aws.upbound.io/v1beta1
        kind: Instance
        spec:
          forProvider:
            engine: postgresql
            engineVersion: "15"
            dbName: app
            masterUsername: admin
            autoMinorVersionUpgrade: true
            backupRetentionPeriod: 7
            deletionProtection: true
            storageEncrypted: true
            publiclyAccessible: false
            vpcSecurityGroupIdSelector:
              matchLabels:
                platform.acme.com/network: private
            dbSubnetGroupNameSelector:
              matchLabels:
                platform.acme.com/network: private
          writeConnectionSecretToRef:
            namespace: crossplane-system
      patches:
        - type: FromCompositeFieldPath
          fromFieldPath: spec.engine
          toFieldPath: spec.forProvider.engine
        - type: FromCompositeFieldPath
          fromFieldPath: spec.size
          toFieldPath: spec.forProvider.instanceClass
          transforms:
            - type: map
              map:
                small: db.t3.micro
                medium: db.t3.medium
                large: db.r6g.xlarge
        - type: FromCompositeFieldPath
          fromFieldPath: spec.size
          toFieldPath: spec.forProvider.allocatedStorage
          transforms:
            - type: map
              map:
                small: "20"
                medium: "100"
                large: "500"
        - type: FromCompositeFieldPath
          fromFieldPath: spec.environment
          toFieldPath: spec.forProvider.multiAz
          transforms:
            - type: map
              map:
                staging: "false"
                production: "true"

    - name: security-group
      base:
        apiVersion: ec2.aws.upbound.io/v1beta1
        kind: SecurityGroup
        spec:
          forProvider:
            description: Database security group
            vpcIdSelector:
              matchLabels:
                platform.acme.com/network: main

    - name: monitoring-dashboard
      base:
        apiVersion: helm.crossplane.io/v1beta1
        kind: Release
        spec:
          forProvider:
            chart:
              name: database-dashboard
              repository: https://charts.internal.acme.com
```

Now the developer writes this to get a fully configured, monitored,
backed-up production database:

```yaml
apiVersion: platform.acme.com/v1
kind: Database
metadata:
  name: payments-db
  namespace: payments-team
spec:
  engine: postgresql
  size: medium
  environment: production
```

Eight lines of YAML. The Composition handles 200+ lines of cloud
configuration behind the scenes.

## Terraform Modules as a Service

Not every organization runs Kubernetes. Terraform modules provide a similar
abstraction layer for teams using Terraform.

### Module Design

```
  TERRAFORM MODULE STRUCTURE:

  modules/
  └── database/
      ├── main.tf           # Resource definitions
      ├── variables.tf      # Input variables (the API)
      ├── outputs.tf        # Output values
      ├── versions.tf       # Provider version constraints
      ├── validation.tf     # Input validation rules
      └── README.md         # Auto-generated docs

  The module is your abstraction boundary.
  variables.tf defines what developers can configure.
  Everything else is implementation detail.
```

### Platform Module Example

```hcl
variable "name" {
  type        = string
  description = "Database name"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,62}$", var.name))
    error_message = "Name must be lowercase alphanumeric with hyphens, 3-63 chars"
  }
}

variable "engine" {
  type    = string
  default = "postgresql"
  validation {
    condition     = contains(["postgresql", "mysql"], var.engine)
    error_message = "Engine must be postgresql or mysql"
  }
}

variable "size" {
  type    = string
  default = "small"
  validation {
    condition     = contains(["small", "medium", "large"], var.size)
    error_message = "Size must be small, medium, or large"
  }
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production"
  }
}

variable "team" {
  type        = string
  description = "Owning team for tagging and access control"
}

locals {
  instance_class_map = {
    small  = "db.t3.micro"
    medium = "db.t3.medium"
    large  = "db.r6g.xlarge"
  }

  storage_map = {
    small  = 20
    medium = 100
    large  = 500
  }

  is_production = var.environment == "production"
}

resource "aws_db_instance" "main" {
  identifier = var.name
  engine     = var.engine == "postgresql" ? "postgres" : var.engine

  instance_class        = local.instance_class_map[var.size]
  allocated_storage     = local.storage_map[var.size]
  max_allocated_storage = local.storage_map[var.size] * 2

  multi_az            = local.is_production
  deletion_protection = local.is_production
  storage_encrypted   = true

  backup_retention_period = local.is_production ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  db_subnet_group_name   = data.aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.database.id]

  performance_insights_enabled = local.is_production

  tags = {
    Team        = var.team
    Environment = var.environment
    ManagedBy   = "platform-terraform"
  }
}
```

Developers consume the module:

```hcl
module "payments_db" {
  source = "git::https://github.com/acme/terraform-modules.git//database?ref=v3.1.0"

  name        = "payments-db"
  engine      = "postgresql"
  size        = "medium"
  environment = "production"
  team        = "payments"
}
```

Five parameters instead of forty.

### Module Registry

Publish modules to a private registry for discoverability:

```
  INTERNAL MODULE REGISTRY:

  +----------------------------------------------------------------+
  |  Platform Terraform Modules                                    |
  +----------------------------------------------------------------+
  |                                                                |
  |  acme/database/aws           v3.1.0    [Docs] [Source]        |
  |  Managed PostgreSQL or MySQL database                          |
  |  Downloads: 847 | Teams: 23                                    |
  |                                                                |
  |  acme/cache/aws              v2.0.0    [Docs] [Source]        |
  |  Managed Redis or Memcached cache                              |
  |  Downloads: 512 | Teams: 18                                    |
  |                                                                |
  |  acme/queue/aws              v1.5.0    [Docs] [Source]        |
  |  Managed SQS or RabbitMQ queue                                 |
  |  Downloads: 234 | Teams: 12                                    |
  +----------------------------------------------------------------+
```

## Kubernetes Operators

Operators extend Kubernetes with custom controllers that manage the
lifecycle of complex applications. For platform engineering, operators
automate the "day 2" operations that developers shouldn't need to think
about.

```
  OPERATOR RECONCILIATION LOOP:

  +--------+     +----------+     +---------+     +---------+
  | Watch  |---->| Compare  |---->| Act     |---->| Update  |
  | desired|     | desired  |     | create/ |     | status  |
  | state  |     | vs actual|     | update/ |     |         |
  +--------+     +----------+     | delete  |     +---------+
       ^                          +---------+          |
       |                                               |
       +-----------------------------------------------+
                    Continuous reconciliation

  Example: Database Operator
  +-----------+    Watches    +------------+    Manages     +--------+
  | Database  |<------------>| DB Operator |<-------------->| RDS    |
  | CRD       |    Events    | Controller  |    AWS API     | PG     |
  | (desired) |              |             |               | Backups |
  +-----------+              +------------+               +--------+
```

### Custom Resource Definition

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.platform.acme.com
spec:
  group: platform.acme.com
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          required: [spec]
          properties:
            spec:
              type: object
              required: [engine, size, environment]
              properties:
                engine:
                  type: string
                  enum: [postgresql, mysql]
                size:
                  type: string
                  enum: [small, medium, large]
                environment:
                  type: string
                  enum: [staging, production]
            status:
              type: object
              properties:
                phase:
                  type: string
                  enum: [Provisioning, Ready, Failed, Deleting]
                host:
                  type: string
                port:
                  type: integer
                conditions:
                  type: array
                  items:
                    type: object
                    properties:
                      type:
                        type: string
                      status:
                        type: string
                      lastTransitionTime:
                        type: string
                        format: date-time
                      message:
                        type: string
      subresources:
        status: {}
      additionalPrinterColumns:
        - name: Engine
          type: string
          jsonPath: .spec.engine
        - name: Size
          type: string
          jsonPath: .spec.size
        - name: Status
          type: string
          jsonPath: .status.phase
        - name: Host
          type: string
          jsonPath: .status.host
  scope: Namespaced
  names:
    plural: databases
    singular: database
    kind: Database
    shortNames: [db]
```

Developers interact with familiar `kubectl`:

```bash
$ kubectl get databases
NAME          ENGINE       SIZE     STATUS   HOST
payments-db   postgresql   medium   Ready    pg-abc.internal
analytics-db  postgresql   large    Ready    pg-def.internal
cache-db      postgresql   small    Ready    pg-ghi.internal

$ kubectl describe database payments-db
Name:         payments-db
Namespace:    payments-team
Status:
  Phase:  Ready
  Host:   pg-abc.internal
  Port:   5432
  Conditions:
    Type: Ready    Status: True    Message: Database is accepting connections
    Type: Backup   Status: True    Message: Last backup 2h ago
```

## Infrastructure APIs: Bringing It Together

The highest level of abstraction combines Crossplane compositions, operators,
and platform APIs into a unified infrastructure layer:

```
  INFRASTRUCTURE API ARCHITECTURE:

  +================================================================+
  |  Developer Interfaces                                           |
  |  [Portal UI]  [CLI Tool]  [K8s CRDs]  [REST API]  [GitOps]    |
  +================================================================+
                              |
                              v
  +================================================================+
  |  Platform Control Plane                                         |
  |  +------------------+  +------------------+  +---------------+  |
  |  | Policy Engine    |  | Quota Manager    |  | Audit Logger  |  |
  |  | (OPA/Gatekeeper) |  |                  |  |               |  |
  |  +------------------+  +------------------+  +---------------+  |
  +================================================================+
                              |
                              v
  +================================================================+
  |  Provisioning Engine                                            |
  |  +------------------+  +------------------+  +---------------+  |
  |  | Crossplane       |  | Terraform        |  | Custom        |  |
  |  | Compositions     |  | Controllers      |  | Operators     |  |
  |  +------------------+  +------------------+  +---------------+  |
  +================================================================+
                              |
                              v
  +================================================================+
  |  Cloud Providers                                                |
  |  [AWS]  [GCP]  [Azure]  [On-Prem]                             |
  +================================================================+
```

The key insight: the developer interface is consistent regardless of
which provisioning engine runs underneath. A developer doesn't care whether
their database is provisioned by Crossplane or Terraform — they care that
it works.

## Choosing Your Abstraction Strategy

```
  DECISION FRAMEWORK:

  +-------------------+------------------+------------------+
  |                   | Terraform        | Crossplane       |
  |                   | Modules          | + Operators      |
  +-------------------+------------------+------------------+
  | Best when         | Teams already    | Running on K8s   |
  |                   | use Terraform    | K8s-native teams |
  +-------------------+------------------+------------------+
  | Reconciliation    | Manual (re-apply)| Automatic        |
  | (drift detection) |                  | (continuous)     |
  +-------------------+------------------+------------------+
  | Developer         | HCL files in     | YAML CRDs with   |
  | experience        | repo, plan/apply | kubectl apply    |
  +-------------------+------------------+------------------+
  | Self-service      | Via CI pipeline  | Via K8s API      |
  | mechanism         | or Atlantis      | or portal        |
  +-------------------+------------------+------------------+
  | State management  | Terraform state  | Kubernetes etcd  |
  |                   | (remote backend) | (built-in)       |
  +-------------------+------------------+------------------+
  | Multi-cloud       | Native support   | Provider plugins |
  +-------------------+------------------+------------------+
```

Many organizations use both — Crossplane for Kubernetes-native teams and
Terraform modules for teams with existing Terraform expertise. The platform
API layer unifies them.

## Exercises

1. **Abstraction audit.** List the top 10 infrastructure resources your
   developers provision. For each, how many parameters does the current
   process require? Design intent-based abstractions that reduce each to
   5 or fewer parameters.

2. **Build a Crossplane Composition.** Create a Crossplane Composition for
   a database that provisions the RDS instance, security group, monitoring
   dashboard, and connection secret — all from an 8-line developer claim.

3. **Module design.** Create a Terraform module for a common resource at
   your organization. Include input validation, sensible defaults, and
   auto-generated documentation.

4. **Abstraction trade-offs.** For a specific resource, compare the developer
   experience of: raw Terraform, a shared module, a Crossplane claim, and
   a portal button. Document the trade-offs in flexibility, complexity,
   and time-to-provision.
