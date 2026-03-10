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
