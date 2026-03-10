# Lesson 1: Cloud Fundamentals

## The Big Analogy: Renting vs Owning a House

Think about buying a house versus renting an apartment:

```
OWNING A HOUSE (On-Premises)          RENTING AN APARTMENT (Cloud)
+---------------------------+         +---------------------------+
| You handle:               |         | Landlord handles:         |
|  - Foundation             |         |  - Foundation             |
|  - Roof repairs           |         |  - Roof repairs           |
|  - Plumbing               |         |  - Plumbing               |
|  - Electrical             |         |  - Electrical             |
|  - Security system        |         |  - Building security      |
|  - Lawn care              |         |  - Common areas           |
|                           |         |                           |
| YOU own it all            |         | You handle:               |
| YOU maintain it all       |         |  - Your furniture         |
| YOU pay upfront           |         |  - Your decor             |
|                           |         |  - Your locks             |
| Big upfront cost          |         |                           |
| Full control              |         | Monthly payment           |
| Full responsibility       |         | Less control              |
+---------------------------+         | Less responsibility       |
                                      +---------------------------+
```

Cloud computing is renting someone else's computers. You pay for
what you use, someone else handles the physical hardware, and you
can scale up or down as needed.

## Regions and Availability Zones

AWS operates data centers worldwide, organized into Regions and
Availability Zones (AZs).

```
                    AWS GLOBAL INFRASTRUCTURE

   US-EAST-1 (Virginia)        EU-WEST-1 (Ireland)
   +--------------------+      +--------------------+
   | +----+  +----+     |      | +----+  +----+     |
   | |AZ-a|  |AZ-b|     |      | |AZ-a|  |AZ-b|     |
   | |    |  |    |     |      | |    |  |    |     |
   | +----+  +----+     |      | +----+  +----+     |
   |      +----+        |      |      +----+        |
   |      |AZ-c|        |      |      |AZ-c|        |
   |      |    |        |      |      |    |        |
   |      +----+        |      |      +----+        |
   +--------------------+      +--------------------+

   AP-SOUTHEAST-1 (Singapore)
   +--------------------+
   | +----+  +----+     |
   | |AZ-a|  |AZ-b|     |
   | +----+  +----+     |
   |      +----+        |
   |      |AZ-c|        |
   |      +----+        |
   +--------------------+

   Region  = A geographic area (city/country)
   AZ      = An isolated data center within a region
   Each AZ = Separate power, cooling, networking
```

Think of it like a city (Region) with multiple hospitals (AZs).
If one hospital loses power, the others keep running. Each
hospital is independent but they can share patients quickly.

**GCP equivalent**: Regions and Zones (same concept, different names)

## The Shared Responsibility Model

AWS and you split the security work. AWS secures the building;
you secure your apartment.

```
+----------------------------------------------------------+
|              SHARED RESPONSIBILITY MODEL                   |
+----------------------------------------------------------+
|                                                            |
|  YOUR RESPONSIBILITY (Security IN the Cloud)              |
|  +------------------------------------------------------+ |
|  | Customer data                                         | |
|  | Platform, apps, IAM                                   | |
|  | Operating system, network, firewall config            | |
|  | Client-side encryption | Server-side encryption       | |
|  | Network traffic protection                            | |
|  +------------------------------------------------------+ |
|  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  |
|  AWS RESPONSIBILITY (Security OF the Cloud)               |
|  +------------------------------------------------------+ |
|  | Hardware / AWS Global Infrastructure                   | |
|  | Regions, AZs, Edge Locations                          | |
|  | Compute, Storage, Database, Networking (physical)      | |
|  | Managed services patching and maintenance              | |
|  +------------------------------------------------------+ |
+----------------------------------------------------------+
```

The more "managed" a service is, the more AWS handles:

```
YOU MANAGE MORE  <----------------------------->  AWS MANAGES MORE

  EC2 Instance      Elastic         Lambda
  (Full VM)         Beanstalk       (Serverless)
  +-----------+    +-----------+    +-----------+
  | Your Code |    | Your Code |    | Your Code |
  | OS Patches|    | Config    |    +-----------+
  | Security  |    +-----------+    AWS handles
  | Scaling   |    AWS handles      everything
  | Networking|    OS, scaling,     else
  +-----------+    networking
```

## Cloud Service Models

```
ON-PREM       IaaS          PaaS          SaaS
(You Own)     (EC2)         (Beanstalk)   (Gmail)
+---------+   +---------+   +---------+   +---------+
|  Apps   |   |  Apps   |   |  Apps   |   | xxxxxxx |
+---------+   +---------+   +---------+   +---------+
|  Data   |   |  Data   |   |  Data   |   | xxxxxxx |
+---------+   +---------+   +---------+   +---------+
| Runtime |   | Runtime |   | xxxxxxx |   | xxxxxxx |
+---------+   +---------+   +---------+   +---------+
|   OS    |   |   OS    |   | xxxxxxx |   | xxxxxxx |
+---------+   +---------+   +---------+   +---------+
| Virtual |   | xxxxxxx |   | xxxxxxx |   | xxxxxxx |
+---------+   +---------+   +---------+   +---------+
| Servers |   | xxxxxxx |   | xxxxxxx |   | xxxxxxx |
+---------+   +---------+   +---------+   +---------+
| Storage |   | xxxxxxx |   | xxxxxxx |   | xxxxxxx |
+---------+   +---------+   +---------+   +---------+
| Network |   | xxxxxxx |   | xxxxxxx |   | xxxxxxx |
+---------+   +---------+   +---------+   +---------+

  You manage      xxxxx = Cloud provider manages
```

## On-Prem vs Cloud: When to Choose What

```
+-------------------+-------------------+
| CHOOSE ON-PREM    | CHOOSE CLOUD      |
+-------------------+-------------------+
| Strict compliance | Variable demand   |
| Legacy systems    | Rapid scaling     |
| Predictable load  | Global reach      |
| Data sovereignty  | Low upfront cost  |
| Extremely low     | Fast time-to-     |
| latency needed    | market            |
+-------------------+-------------------+
```

## AWS CLI: Your First Commands

```bash
aws configure

aws sts get-caller-identity

aws ec2 describe-regions --output table

aws ec2 describe-availability-zones \
  --region us-east-1 \
  --output table
```

## Terraform: Configuring a Provider

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}
```

## Key Terminology

| Term              | Meaning                                    |
|-------------------|--------------------------------------------|
| Region            | Geographic area with multiple data centers |
| Availability Zone | Isolated data center within a region       |
| Edge Location     | CDN endpoint for caching content           |
| IaaS              | Infrastructure as a Service (VMs, storage) |
| PaaS              | Platform as a Service (managed runtime)    |
| SaaS              | Software as a Service (full application)   |
| ARN               | Amazon Resource Name (unique identifier)   |

## Exercises

1. Run `aws ec2 describe-regions` and identify the 3 regions
   closest to your location.

2. For your nearest region, list all Availability Zones using
   `aws ec2 describe-availability-zones`.

3. Create a `main.tf` file with an AWS provider configured for
   your nearest region. Run `terraform init` to verify.

4. Draw the shared responsibility model for these scenarios:
   - Running a MySQL database on an EC2 instance
   - Using Amazon RDS (managed MySQL)
   - Using DynamoDB (fully managed NoSQL)
   Who is responsible for patching in each case?

5. Your company has a steady workload of 100 servers 24/7 and
   occasional spikes to 300 servers during sales events. Would
   you go fully on-prem, fully cloud, or hybrid? Justify.

---

[Next: Lesson 2 - Compute Services](02-compute.md)
