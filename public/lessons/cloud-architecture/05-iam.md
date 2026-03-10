# Lesson 5: IAM & Access Control

## The Big Analogy: Building Access Badges

Think of AWS IAM like the badge system in a corporate building:

```
BUILDING ACCESS SYSTEM              AWS IAM
+-----------------------------+    +-----------------------------+
|                             |    |                             |
| Employee Badge = IAM User   |    | Username + credentials      |
| Each person gets one        |    | Each person gets one        |
|                             |    |                             |
| Badge Role = IAM Role       |    | Temporary permissions       |
| "Visitor" badge gives       |    | An EC2 instance "wears"     |
| lobby access only           |    | a role to access S3         |
|                             |    |                             |
| Access Card Rules = Policy  |    | JSON doc defining what      |
| "Floor 3, rooms 301-310"   |    | actions on what resources   |
|                             |    |                             |
| Badge Group = IAM Group     |    | "Engineering" group gets    |
| All engineers get same      |    | same set of policies        |
| floor access                |    |                             |
|                             |    |                             |
| Least Privilege = Only      |    | Only grant the minimum      |
| give access to floors       |    | permissions needed          |
| they actually need          |    |                             |
+-----------------------------+    +-----------------------------+
```

## IAM Building Blocks

```
IAM HIERARCHY

  AWS Account (Root User)
  |
  +-- IAM Users (people)
  |   +-- alice (dev team)
  |   +-- bob (ops team)
  |
  +-- IAM Groups (collections of users)
  |   +-- Developers
  |   |   +-- alice
  |   +-- Operations
  |       +-- bob
  |
  +-- IAM Roles (for services / cross-account)
  |   +-- EC2-S3-ReadOnly (worn by EC2 instances)
  |   +-- Lambda-DynamoDB (worn by Lambda functions)
  |   +-- CrossAccount-Audit (assumed by external account)
  |
  +-- IAM Policies (permission documents)
      +-- AmazonS3ReadOnlyAccess (AWS managed)
      +-- CustomDeployPolicy (customer managed)

  Users/Groups = WHO (identity)
  Roles = WHAT CAN ASSUME (temporary identity)
  Policies = WHAT IS ALLOWED (permissions)
```

## IAM Policies: The Permission Language

Every IAM policy is a JSON document with this structure:

```
POLICY STRUCTURE

  +------------------------------------------+
  | {                                        |
  |   "Version": "2012-10-17",              |
  |   "Statement": [                        |
  |     {                                    |
  |       "Effect": "Allow" or "Deny",      |
  |       "Action": what operations,         |
  |       "Resource": on what resources,     |
  |       "Condition": under what conditions |
  |     }                                    |
  |   ]                                      |
  | }                                        |
  +------------------------------------------+

  EVALUATION LOGIC:
  +-------+     +-------+     +--------+
  | Deny? |---->| Allow?|---->| Default|
  | (any  | No  | (any  | No  | DENY   |
  | deny?)|     | allow)|     |        |
  +---+---+     +---+---+     +--------+
      | Yes         | Yes
      v             v
    DENIED       ALLOWED

  Explicit Deny ALWAYS wins over Allow.
```

### Policy Evaluation: A Real-World Walkthrough

**Analogy — a bouncer with a checklist:**

Imagine a bouncer at a VIP event with three lists:
1. **Banned list** (explicit deny) — checked FIRST. If you're on it, you're out. Period.
2. **VIP list** (explicit allow) — checked second. If you're on it, you're in.
3. **Default: no entry** — if you're on neither list, you're denied.

```
Request: "Can user alice perform s3:DeleteBucket on my-prod-bucket?"

Step 1: Gather ALL policies that apply to alice
  ├── alice's user policy (inline)
  ├── "Developers" group policy
  ├── Permission boundary (if set)
  └── Resource-based policy on my-prod-bucket

Step 2: Evaluate
  ┌─────────────────────────────────────────────┐
  │ Any EXPLICIT DENY in ANY policy?            │
  │   Group policy says: Deny s3:Delete* on *   │──→ DENIED
  │                                             │
  │ Even though alice's user policy says:       │
  │   Allow s3:* on my-prod-bucket              │
  │                                             │
  │ DENY ALWAYS WINS. No exceptions.            │
  └─────────────────────────────────────────────┘

  This is why security teams add "guardrail" deny policies
  to groups — they can't be overridden by individual allows.
```

### Example Policies

```hcl
resource "aws_iam_policy" "s3_read" {
  name = "s3-read-assets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::my-assets-bucket",
          "arn:aws:s3:::my-assets-bucket/*"
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "deploy" {
  name = "deploy-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecr:GetAuthorizationToken",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion" = "us-east-1"
          }
        }
      }
    ]
  })
}
```

## IAM Roles: Temporary Credentials

Roles are not people. They are identities that services or users
temporarily "assume," like putting on a different badge.

```
HOW ROLE ASSUMPTION WORKS

  EC2 Instance                 STS (Security Token Service)
  +-----------+                +---------------------------+
  |           |-- AssumeRole ->| Generate temporary        |
  | App needs |                | credentials:              |
  | to read   |<- Credentials -| - Access Key              |
  | S3 bucket |                | - Secret Key              |
  |           |                | - Session Token           |
  +-----------+                | - Expiration (1hr)        |
       |                       +---------------------------+
       |
       v
  S3 Bucket
  +-----------+
  | Checks:   |
  | Does role |
  | policy    |
  | allow     |
  | GetObject?|
  +-----------+
```

### Role with Terraform

```hcl
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "app-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "app_s3" {
  role       = aws_iam_role.app.name
  policy_arn = aws_iam_policy.s3_read.arn
}

resource "aws_iam_instance_profile" "app" {
  name = "app-profile"
  role = aws_iam_role.app.name
}
```

## Least Privilege: The Golden Rule

```
BAD: Overly permissive                GOOD: Least privilege
+---------------------------+         +---------------------------+
| {                         |         | {                         |
|   "Effect": "Allow",     |         |   "Effect": "Allow",     |
|   "Action": "*",         |         |   "Action": [            |
|   "Resource": "*"        |         |     "s3:GetObject"       |
| }                         |         |   ],                     |
|                           |         |   "Resource": [          |
| This is admin access.     |         |     "arn:aws:s3:::      |
| Never do this for apps.   |         |      my-bucket/*"       |
+---------------------------+         |   ]                      |
                                      | }                         |
                                      |                           |
                                      | Only what is needed.      |
                                      | Only where it is needed.  |
                                      +---------------------------+
```

### Why Developers Over-Permission: The Convenience Trap

**Analogy — giving everyone the master key:**

It's 2 AM, the deploy is broken, and the error says "Access Denied." The fastest fix? `"Action": "*", "Resource": "*"`. It works. The developer moves on. That wildcard policy stays in production for 3 years until a breach.

This is the #1 cause of cloud security incidents. The fix:

```
The permission escalation ladder (from worst to best):

Level 0: "Action": "*", "Resource": "*"
  → God mode. One compromised credential = entire AWS account.

Level 1: "Action": "s3:*", "Resource": "*"
  → Full S3 access. Can read billing data, delete backups.

Level 2: "Action": "s3:*", "Resource": "arn:aws:s3:::my-bucket/*"
  → Full access to one bucket. Better, but includes Delete.

Level 3: "Action": ["s3:GetObject", "s3:PutObject"],
         "Resource": "arn:aws:s3:::my-bucket/*"
  → Read/write to one bucket. No delete. Good.

Level 4: Level 3 + Condition:
         "IpAddress": {"aws:SourceIp": "10.0.0.0/8"}
  → Same as Level 3 but only from internal network. Best.

Start at Level 4. Widen ONLY when you hit a real error.
```

### Permission Boundaries: The Safety Net

**Analogy — a child's allowance:**

A parent (admin) gives a child (developer) $50/week (permission boundary). The child can decide to spend it however they want (IAM policies they create), but can NEVER spend more than $50. Even if the child writes "I can spend $1000" on a piece of paper, the boundary enforces the limit.

```
Without permission boundary:
  Developer creates role → can grant themselves ANY permission

With permission boundary:
  Boundary says: max permissions = S3 + DynamoDB
  Developer creates role with EC2 access → DENIED
  Even though the role policy says "Allow EC2"
  The boundary doesn't include EC2

  Effective permissions = Policy ∩ Boundary
  (intersection, not union)

  ┌──────────────────────────────────┐
  │        Policy allows             │
  │   ┌──────────────────────────┐   │
  │   │  S3 ✓  DynamoDB ✓       │   │
  │   │  EC2 ✗  (boundary denies)│   │
  │   └──────────────────────────┘   │
  │        Boundary allows           │
  └──────────────────────────────────┘
```

## Cross-Account Access

```
ACCOUNT A (Production)           ACCOUNT B (Audit)
+------------------------+      +------------------------+
|                        |      |                        |
| IAM Role: AuditRole   |      | IAM User: auditor      |
| Trust Policy:          |      |                        |
|   "Allow Account B    |<-----| Policy: sts:AssumeRole |
|    to assume this     |      |   on Account A's       |
|    role"              |      |   AuditRole ARN        |
|                        |      |                        |
| Permissions:           |      | Workflow:              |
|   ReadOnly access     |      |  1. auditor calls      |
|   to CloudTrail       |      |     AssumeRole         |
|                        |      |  2. Gets temp creds    |
+------------------------+      |  3. Reads CloudTrail   |
                                +------------------------+
```

### Cross-Account Role with Terraform

```hcl
data "aws_iam_policy_document" "cross_account_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::111111111111:root"]
    }
    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = ["unique-external-id-here"]
    }
  }
}

resource "aws_iam_role" "audit" {
  name               = "cross-account-audit"
  assume_role_policy = data.aws_iam_policy_document.cross_account_trust.json
}

resource "aws_iam_role_policy_attachment" "audit_readonly" {
  role       = aws_iam_role.audit.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}
```

### The Confused Deputy Problem

**Analogy — tricking a locksmith:**

You call a locksmith and say "I locked myself out of apartment 5B." The locksmith opens the door — but it's not YOUR apartment. You tricked the locksmith (a trusted service) into using their access on your behalf.

In AWS, this happens when Service A trusts Service B to assume a role, but an attacker tricks Service B into assuming the role for them.

```
The attack:
  Attacker → "Hey Service B, access Account A for me"
  Service B → assumes role in Account A (it's allowed to!)
  Account A → "Service B is trusted, access granted"

  But Service B is acting on the ATTACKER's behalf.

The fix: External ID (a shared secret)
  Account A's trust policy:
    "Allow Service B to assume role IF ExternalId = abc123"

  Attacker doesn't know abc123, so:
  Attacker → "Hey Service B, access Account A for me"
  Service B → assumes role... but with wrong/no ExternalId
  Account A → DENIED
```

This is why cross-account trust policies should ALWAYS include an ExternalId condition — it prevents the confused deputy attack.

### AWS CLI for IAM

```bash
aws iam create-user --user-name deploy-bot

aws iam create-group --group-name Developers

aws iam add-user-to-group \
  --user-name deploy-bot \
  --group-name Developers

aws iam attach-group-policy \
  --group-name Developers \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/AuditRole \
  --role-session-name audit-session

aws iam list-attached-role-policies --role-name app-role
```

**GCP equivalents**: IAM (IAM), Service Accounts (IAM Roles), Cloud Identity (Users/Groups)

## Exercises

1. Create an IAM role for a Lambda function that can read from
   one specific DynamoDB table and write to one specific S3
   bucket. Use Terraform with the principle of least privilege.

2. Write a policy that allows `ec2:StartInstances` and
   `ec2:StopInstances` only on instances tagged
   `Environment=development` in `us-east-1`.

3. Set up cross-account access: create a role in Account A that
   Account B can assume with read-only S3 access. Include an
   external ID condition.

4. Using the AWS CLI, list all IAM users with console access.
   Then list all policies attached to each user and identify any
   overly permissive ones (policies with `*` actions).

5. Design an IAM strategy for a team of 5 developers, 2 ops
   engineers, and 1 manager. Define groups, policies, and roles.
   Apply least privilege to each group.

---

[Next: Lesson 6 - Databases in Cloud](06-databases-cloud.md)
