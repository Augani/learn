# Lesson 17: Container and Cloud Security -- Securing a City in the Sky

You have built your applications, containerized them, and deployed them to the
cloud. Now you need to lock them down. Cloud security is fundamentally different
from traditional server security because the attack surface is enormous: every
API call, every IAM policy, every misconfigured S3 bucket is a potential entry
point.

Think of cloud security as securing a city in the sky. IAM is the passport
system -- it controls who gets in and what they can do. Security groups are
neighborhood gates -- they control who can go where within the city. Container
security is building codes -- rules about how things must be constructed to be
safe. Kubernetes security adds city zoning, building inspectors, and code
enforcement. Compliance frameworks are the laws you must follow.

---

## IAM: The Passport System

Identity and Access Management is the foundation of cloud security. Every API
call to AWS, GCP, or Azure is authenticated and authorized through IAM. If IAM
is misconfigured, nothing else matters -- the attacker walks through the front
door.

### Principle of Least Privilege

Every identity (human or machine) should have the absolute minimum permissions
needed to do its job. Nothing more.

Think of it like keycards in an office building. The janitor's keycard opens the
supply closet and common areas. The developer's keycard opens their floor and
the server room. The CEO's keycard opens everything. You would never give the
janitor a keycard that opens the server room -- even if the janitor is
trustworthy -- because if their keycard is stolen, the blast radius is limited.

**The wrong way:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}
```

This is `AdministratorAccess`. It lets the identity do anything to any resource
in the account. If compromised, the attacker owns everything -- they can delete
databases, steal data, spin up crypto miners, and lock you out of your own
account.

**The right way:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadUserData",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:BatchGetItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/Users"
    },
    {
      "Sid": "WriteOrderData",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/Orders"
    },
    {
      "Sid": "ReadSecrets",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/myapp/*"
    }
  ]
}
```

This policy lets the application read from the Users table, write to the Orders
table, and read its own secrets. Nothing else. If compromised, the attacker can
see user data and create fake orders -- bad, but they cannot delete tables, access
other services, or escalate privileges.

### Roles, Not Users

For machines and services, always use IAM roles with temporary credentials.
Never create IAM users with long-lived access keys for applications.

```
BAD:  IAM User "myapp" with access key AKIAIOSFODNN7EXAMPLE
      -> Key never expires
      -> If leaked, attacker has permanent access
      -> Key is in config file, env var, or (worst) source code

GOOD: IAM Role "myapp-role" assumed by EC2/ECS/Lambda
      -> Temporary credentials (auto-rotate every hour)
      -> If leaked, attacker has access for <1 hour
      -> No keys to manage, store, or accidentally commit
```

### Conditions: Context-Aware Policies

IAM policies can include conditions that restrict when they apply:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::sensitive-data/*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": "10.0.0.0/8"
        },
        "Bool": {
          "aws:SecureTransport": "true"
        },
        "StringEquals": {
          "aws:PrincipalTag/team": "backend"
        }
      }
    }
  ]
}
```

This policy only allows access to the sensitive-data bucket when the request
comes from an internal IP, uses HTTPS, and the principal has a `team=backend`
tag. All three conditions must be true.

### IAM Boundaries: Limiting What Roles Can Grant

Permission boundaries set a ceiling on what an IAM entity can do, even if its
policies grant broader access. Think of it as a speed limiter on a car -- the
engine might be capable of 200 mph, but the limiter caps it at 120.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:*",
        "dynamodb:*",
        "sqs:*",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Deny",
      "Action": [
        "iam:*",
        "organizations:*",
        "account:*"
      ],
      "Resource": "*"
    }
  ]
}
```

Even if someone attaches `AdministratorAccess` to this role, the boundary
prevents it from modifying IAM, organizations, or account settings.

---

## Container Security

You covered Docker basics in the Docker track. Now we go deeper into securing
containers as a defensive discipline.

### The Threat Model

Containers share a kernel with the host. If an attacker escapes the container,
they have access to the host and every other container on it. Container security
is about making escape difficult and limiting damage if it happens.

```
Host Kernel
  |
  |-- Container A (your app)
  |     |-- Compromise here...
  |     |-- ...should NOT lead to access here:
  |
  |-- Container B (another app)
  |-- Container C (database)
  |-- Host filesystem, network, processes
```

### Rule 1: Never Run as Root

The default user in most Docker images is root. If your application is
compromised, the attacker has root inside the container, which makes kernel
exploits and container escapes much easier.

```dockerfile
FROM node:20-slim

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
```

```dockerfile
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app/server .

FROM scratch
COPY --from=builder /app/server /server
USER 65534:65534
ENTRYPOINT ["/server"]
```

The Go example uses a `scratch` base image (literally nothing -- no shell, no
utilities, no OS files) and runs as user 65534 (the `nobody` user). An attacker
who compromises this container finds no shell to execute, no tools to use, and
no root privileges.

### Rule 2: Read-Only Filesystem

If the application does not need to write to the filesystem, mount it read-only.
This prevents attackers from dropping malware, modifying binaries, or creating
persistence mechanisms.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
    - name: myapp
      image: myapp:latest
      securityContext:
        readOnlyRootFilesystem: true
        runAsNonRoot: true
        runAsUser: 65534
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL
      volumeMounts:
        - name: tmp
          mountPath: /tmp
  volumes:
    - name: tmp
      emptyDir:
        sizeLimit: 50Mi
```

The only writable location is `/tmp` (some apps need a temporary directory),
and it is limited to 50 MB.

### Rule 3: Scan Images for Vulnerabilities

Your container image inherits every vulnerability in its base image and every
dependency you install.

```bash
# Trivy: open-source vulnerability scanner
trivy image myapp:latest

# Output:
# myapp:latest (debian 12.4)
# Total: 23 (UNKNOWN: 0, LOW: 12, MEDIUM: 8, HIGH: 2, CRITICAL: 1)
#
# +------------------+---------------+----------+-------------------+
# |     LIBRARY      | VULNERABILITY |  SEVERITY|  INSTALLED VERSION|
# +------------------+---------------+----------+-------------------+
# | libssl3          | CVE-2024-0727 | CRITICAL | 3.0.11-1          |
# | curl             | CVE-2023-XXXX | HIGH     | 7.88.1-10         |
# +------------------+---------------+----------+-------------------+

# Scan in CI pipeline -- fail the build on critical vulnerabilities
trivy image --exit-code 1 --severity CRITICAL myapp:latest
```

Integrate scanning into your CI pipeline. Every image gets scanned before it
reaches production. A critical vulnerability in your base image is a
vulnerability in your application.

### Rule 4: Minimal Base Images

The more software in your image, the more vulnerabilities and the more tools
an attacker can use post-compromise.

```
Image                  Size      Packages    Attack Surface
ubuntu:22.04           77 MB     ~200        Shell, curl, apt, everything
node:20                ~350 MB   ~400        Full OS + Node toolchain
node:20-slim           ~180 MB   ~150        Reduced OS + Node
node:20-alpine         ~130 MB   ~50         Minimal OS + Node
distroless/nodejs20    ~130 MB   ~20         Node runtime only, no shell
scratch                0 MB      0           Nothing at all
```

The ideal progression: start with alpine or slim images, move to distroless for
production, use scratch for static Go binaries.

---

## Kubernetes Security

Kubernetes adds its own security layer on top of container security. It controls
who can deploy what, which pods can talk to each other, and what system
capabilities pods are allowed to use.

### RBAC (Role-Based Access Control)

RBAC controls who can do what within the Kubernetes API. Every `kubectl` command
and every in-cluster API call goes through RBAC.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-deployer
  namespace: production
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "update", "patch"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: deploy-team-binding
  namespace: production
subjects:
  - kind: Group
    name: deploy-team
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: app-deployer
  apiGroup: rbac.authorization.k8s.io
```

The deploy team can update deployments and view pods in the production namespace.
They cannot create new deployments, delete anything, access secrets, or do
anything in other namespaces.

### NetworkPolicies

By default, every pod in a Kubernetes cluster can talk to every other pod. This
is like an office building with no locked doors -- anyone can walk anywhere.
NetworkPolicies add the doors and locks.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-access
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - port: 5432
          protocol: TCP
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-default
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

The first policy says: only pods labeled `app: backend` can connect to pods
labeled `app: postgres` on port 5432. The second policy is a default-deny rule
that blocks all other ingress and egress. Together, they create a whitelist
model -- no communication happens unless explicitly allowed.

### PodSecurity Standards

PodSecurity Standards replace the old PodSecurityPolicies. They define three
profiles with increasing restrictiveness:

```
Privileged:   No restrictions (for system-level pods only)
Baseline:     Prevents known privilege escalations
Restricted:   Heavily restricted, best practice for untrusted workloads
```

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

With the `restricted` profile enforced, pods in this namespace must:
- Run as non-root
- Drop all Linux capabilities
- Use a read-only root filesystem
- Not use host networking or host ports
- Not mount host paths

Any pod that violates these requirements is rejected at admission time.

### Admission Controllers: OPA Gatekeeper and Kyverno

Admission controllers intercept API requests before objects are persisted. They
can enforce custom policies beyond what built-in RBAC and PodSecurity cover.

Think of them as building inspectors. Before any new construction (pod, deployment,
service) is approved, the inspector checks it against the building code (your
policies).

```yaml
# Kyverno policy: require resource limits on all containers
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resource-limits
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-limits
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "CPU and memory limits are required"
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    memory: "?*"
                    cpu: "?*"
---
# Kyverno policy: disallow latest tag
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-latest-tag
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-image-tag
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Images must use a specific tag, not :latest"
        pattern:
          spec:
            containers:
              - image: "!*:latest"
```

With these policies, any pod without resource limits or using the `:latest` tag
is rejected immediately. No exceptions, no human judgment required, enforced
uniformly across the entire cluster.

---

## Infrastructure as Code Security

If your infrastructure is defined in Terraform or CloudFormation, the security
of your infrastructure is the security of that code. Misconfigurations in IaC
are the cloud equivalent of leaving your front door unlocked.

### Common Terraform Misconfigurations

```hcl
# VULNERABLE: S3 bucket with public access
resource "aws_s3_bucket" "data" {
  bucket = "my-sensitive-data"
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# VULNERABLE: RDS instance publicly accessible
resource "aws_db_instance" "main" {
  engine               = "postgres"
  instance_class       = "db.t3.micro"
  allocated_storage    = 20
  publicly_accessible  = true
  skip_final_snapshot  = true
}

# VULNERABLE: Security group open to the world
resource "aws_security_group" "bad" {
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Scanning IaC: tfsec and checkov

These tools catch misconfigurations before they reach production.

```bash
# tfsec: Terraform-specific security scanner
tfsec ./terraform/

# Output:
# Result 1
#   [AWS002] Resource 'aws_s3_bucket.data' has public access enabled
#   Severity: CRITICAL
#
# Result 2
#   [AWS011] Resource 'aws_db_instance.main' is publicly accessible
#   Severity: HIGH
#
# Result 3
#   [AWS018] Resource 'aws_security_group.bad' allows ingress from 0.0.0.0/0
#   Severity: CRITICAL

# checkov: Multi-framework scanner (Terraform, CloudFormation, K8s, Docker)
checkov -d ./terraform/
checkov -f Dockerfile
checkov -d ./k8s-manifests/
```

### Secure Terraform Patterns

```hcl
resource "aws_s3_bucket" "data" {
  bucket = "my-sensitive-data"
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_db_instance" "main" {
  engine               = "postgres"
  instance_class       = "db.t3.micro"
  allocated_storage    = 20
  publicly_accessible  = false
  storage_encrypted    = true
  kms_key_id           = aws_kms_key.data.arn
  skip_final_snapshot  = false

  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.database.id]
}
```

The secure version: S3 bucket blocks all public access, enables server-side
encryption with KMS, and turns on versioning. The database is in a private
subnet, encrypted, and not publicly accessible.

---

## Compliance Frameworks: What Engineers Need to Know

Compliance frameworks are sets of rules that organizations must follow, usually
to handle certain types of data. As an engineer, you do not need to memorize
these frameworks, but you need to understand what they require so you can build
systems that meet the requirements.

### SOC 2

**What it is:** An audit framework for service organizations. It verifies that
your company has proper security controls.

**What it means for engineers:**
- Access control: every system needs authentication and authorization
- Audit logging: every significant action must be logged
- Change management: code reviews, approved deployments, no cowboy coding
- Encryption: data must be encrypted in transit and at rest
- Monitoring: alerts for anomalies, incident response procedures

### HIPAA

**What it is:** US law governing healthcare data (Protected Health Information).

**What it means for engineers:**
- PHI must be encrypted everywhere -- in transit, at rest, in backups
- Access to PHI must be logged and auditable
- Minimum necessary access -- only the data needed for a specific purpose
- Business Associate Agreements (BAAs) with every third party that touches PHI
- Breach notification within 60 days

### PCI DSS

**What it is:** Standard for handling credit card data.

**What it means for engineers:**
- Cardholder data must be encrypted in transit and at rest
- Never store CVV/CVC after authorization
- Network segmentation: cardholder data environment isolated from the rest
- Regular vulnerability scans and penetration testing
- Strong access controls with MFA for admin access
- The easiest path: use Stripe/Braintree and never touch card data yourself

```
Compliance is not a checkbox exercise. These frameworks exist because real
breaches happened to real companies and real people were harmed. The rules
encode lessons learned from those failures.

Your job as an engineer:
1. Know which frameworks apply to your system
2. Build systems that meet the requirements by default
3. Automate compliance checks (IaC scanning, audit logging, access reviews)
4. Make the secure way the easy way for your team
```

---

## Real-World Breach: Tesla Kubernetes (2018)

Attackers found a Kubernetes dashboard exposed to the internet with no
authentication. Through the dashboard, they accessed AWS credentials stored in
environment variables on the pods. They used those credentials to access S3
buckets containing telemetry data, then spun up crypto mining pods on Tesla's
cloud infrastructure.

The cascade of failures:
1. **Kubernetes dashboard exposed** -- should have required authentication
2. **No RBAC** -- dashboard had cluster-admin access
3. **Secrets in env vars** -- AWS credentials visible in pod spec
4. **No network segmentation** -- pods could reach any AWS service
5. **No monitoring** -- crypto mining went undetected

What should have existed:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-metadata-service
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 169.254.169.254/32
```

This NetworkPolicy blocks all pods from accessing the EC2 metadata service
(169.254.169.254), which is how the attackers got AWS credentials. Combined
with proper RBAC, secret management (Vault instead of env vars), and monitoring,
this attack would have been prevented or detected immediately.

---

## Security Checklist for Cloud Deployments

```
IAM:
  [ ] No wildcard (*) permissions in production
  [ ] Roles (not users) for all machine identities
  [ ] Temporary credentials everywhere possible
  [ ] Permission boundaries on all roles
  [ ] MFA required for human access

Networking:
  [ ] Default deny security groups
  [ ] Databases in private subnets
  [ ] No public IPs on application servers
  [ ] VPN or bastion for admin access
  [ ] VPC flow logs enabled

Containers:
  [ ] Non-root user in all Dockerfiles
  [ ] Read-only root filesystem where possible
  [ ] Image scanning in CI pipeline
  [ ] Minimal base images (alpine/distroless/scratch)
  [ ] No latest tag in production

Kubernetes:
  [ ] RBAC with least privilege
  [ ] NetworkPolicies (default deny + explicit allow)
  [ ] PodSecurity Standards enforced
  [ ] Admission controllers for custom policies
  [ ] Secrets managed externally (Vault, cloud KMS)

Data:
  [ ] Encryption at rest (KMS, not just AES)
  [ ] Encryption in transit (TLS 1.2+ everywhere)
  [ ] Backup encryption
  [ ] Data classification (what is sensitive, where is it)

Monitoring:
  [ ] Audit logging for all API calls (CloudTrail, GCP Audit Logs)
  [ ] Alerts on suspicious activity
  [ ] VPC flow logs analyzed
  [ ] Container runtime monitoring
```

---

## Hands-On Exercises

1. **IAM policy audit**: Take an existing AWS IAM policy from one of your
   projects. Can you narrow the permissions? Use the IAM Access Analyzer to
   find unused permissions.

2. **Container hardening**: Take a Dockerfile from a project, add a non-root
   user, set a read-only filesystem, and drop all capabilities. Verify the
   application still works.

3. **tfsec/checkov scan**: Run tfsec or checkov against existing Terraform or
   Kubernetes manifests. How many findings do you get? Fix the critical ones.

4. **NetworkPolicy**: In a local Kubernetes cluster (minikube or kind), deploy
   two pods and a NetworkPolicy that only allows traffic between them. Verify
   that other pods cannot connect.

5. **Kyverno policies**: Install Kyverno in a test cluster and create a policy
   that requires all pods to have resource limits and disallows running as root.
   Try deploying a non-compliant pod and observe the rejection.

---

## Key Takeaways

- IAM is the most critical cloud security control. Get it wrong and nothing else matters.
- Use roles with temporary credentials, never long-lived access keys for services.
- Least privilege is not optional -- every permission you do not need is attack surface.
- Containers share a kernel with the host. Non-root, read-only, minimal images, and scanned images are your baseline.
- Kubernetes default configuration is insecure. You must add RBAC, NetworkPolicies, and PodSecurity.
- Scan your IaC before deploying. Catching a public S3 bucket in a PR review is infinitely better than catching it in a breach notification.
- Compliance frameworks encode lessons from real breaches. Understand what they require and build it into your systems from day one.
