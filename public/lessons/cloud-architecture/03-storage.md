# Lesson 3: Storage Services

## The Big Analogy: Ways to Store Your Stuff

```
+---------------------+--------------------------------------+
| REAL WORLD          | AWS EQUIVALENT                       |
+---------------------+--------------------------------------+
|                     |                                      |
| Filing cabinet      | EBS (Elastic Block Store)            |
| Right next to your  | Attached to one EC2 instance.        |
| desk. Fast access.  | Fast, like a hard drive.             |
| Only you can open   | One attachment at a time.            |
| it.                 |                                      |
|                     |                                      |
| Warehouse           | S3 (Simple Storage Service)          |
| Store anything, any | Unlimited object storage.            |
| amount. Drive there | Access via HTTP/API. Not a           |
| to get stuff.       | filesystem. Globally durable.        |
| Catalog system.     |                                      |
|                     |                                      |
| Shared office drive | EFS (Elastic File System)            |
| Mounted on every    | NFS mount shared across multiple     |
| computer in the     | EC2 instances simultaneously.        |
| office. Everyone    |                                      |
| accesses same files.|                                      |
|                     |                                      |
| Attic / offsite     | Glacier                              |
| storage unit        | Cheap archival storage. Takes hours   |
| Cheap, but takes    | to retrieve. Perfect for backups     |
| time to retrieve.   | you rarely need.                     |
+---------------------+--------------------------------------+
```

## Storage Types: Block vs Object vs File

```
BLOCK STORAGE (EBS)          OBJECT STORAGE (S3)
+--+--+--+--+--+--+         +------------------------+
|B1|B2|B3|B4|B5|B6|         | Key: photos/cat.jpg    |
+--+--+--+--+--+--+         | Data: [binary blob]    |
|B7|B8|B9|..|..|..|         | Metadata: {size, type} |
+--+--+--+--+--+--+         +------------------------+
                              | Key: logs/2024/jan.gz  |
Raw blocks, like a hard      | Data: [binary blob]    |
drive. OS formats with       | Metadata: {size, type} |
a filesystem (ext4, xfs).    +------------------------+
Fast random read/write.
                              Flat key-value store.
                              No hierarchy (just prefixes).
                              Access via HTTP API.

FILE STORAGE (EFS)
+------------------+
| /shared/         |
|   reports/       |
|     q1.pdf       |
|     q2.pdf       |
|   data/          |
|     users.csv    |
+------------------+

POSIX filesystem.
Mount via NFS.
Multiple clients simultaneously.
```

## S3: The Object Store

S3 is the backbone of AWS storage. Nearly unlimited, 99.999999999%
(11 nines) durability.

```
S3 STRUCTURE

  Bucket: my-company-assets
  +------------------------------------------+
  |  images/logo.png                         |
  |  images/banner.jpg                       |
  |  css/styles.css                          |
  |  data/users/export-2024.csv              |
  |  backups/db-2024-01-15.sql.gz            |
  +------------------------------------------+

  Bucket = top-level container (globally unique name)
  Object = file + metadata + key (path)
  Max object size = 5 TB
  No limit on number of objects
```

### S3 Storage Classes

```
HOT <-----------------------------------------> COLD
(Frequent Access)                    (Rare Access)

S3 Standard    S3 IA       S3 Glacier    Glacier
               (Infreq.)   Instant       Deep Archive
+----------+  +----------+ +----------+  +----------+
| Fastest  |  | Same     | | ms       |  | 12+ hrs  |
| access   |  | speed,   | | retrieval|  | retrieval|
|          |  | lower $  | | lowest   |  | cheapest |
| $$$$     |  | $$$      | | $$       |  | $        |
+----------+  +----------+ +----------+  +----------+

S3 Intelligent-Tiering: AWS auto-moves objects
between tiers based on access patterns. Set it
and forget it.
```

### S3 with Terraform

```hcl
resource "aws_s3_bucket" "assets" {
  bucket = "my-company-assets-prod"
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

### S3 with AWS CLI

```bash
aws s3 mb s3://my-company-assets-prod

aws s3 cp localfile.txt s3://my-company-assets-prod/uploads/

aws s3 ls s3://my-company-assets-prod/uploads/

aws s3 sync ./build s3://my-company-assets-prod/static/

aws s3 rm s3://my-company-assets-prod/uploads/old-file.txt

aws s3 presign s3://my-company-assets-prod/private/report.pdf \
  --expires-in 3600
```

## EBS: Block Storage for EC2

```
EC2 INSTANCE                   EBS VOLUMES
+--------------+              +-----------+
|              |--- attach -->| gp3 (SSD) |  Root volume
|  Web Server  |              | 100 GB    |  (OS + app)
|              |--- attach -->+-----------+
|              |              | io2 (SSD) |  Data volume
+--------------+              | 500 GB    |  (database)
                              +-----------+

VOLUME TYPES:
  gp3  = General Purpose SSD (default, most workloads)
  io2  = Provisioned IOPS SSD (databases, latency-critical)
  st1  = Throughput HDD (big data, streaming)
  sc1  = Cold HDD (infrequent access, cheapest)
```

### EBS with Terraform

```hcl
resource "aws_ebs_volume" "data" {
  availability_zone = "us-east-1a"
  size              = 100
  type              = "gp3"
  iops              = 3000
  throughput        = 125
  encrypted         = true

  tags = {
    Name = "app-data-volume"
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.web.id
}
```

## EFS: Shared File System

```
  EC2 Instance A ---+
                    |
  EC2 Instance B ---+--> EFS Mount Target --> EFS File System
                    |                         /shared/data/
  EC2 Instance C ---+                         /shared/config/
                    |
  Lambda Function --+

  All clients see the same files.
  Auto-scales (no provisioning).
  Pay per GB stored.
```

### EFS with Terraform

```hcl
resource "aws_efs_file_system" "shared" {
  creation_token = "shared-storage"
  encrypted      = true

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }

  tags = {
    Name = "shared-storage"
  }
}

resource "aws_efs_mount_target" "shared" {
  count           = length(var.private_subnet_ids)
  file_system_id  = aws_efs_file_system.shared.id
  subnet_id       = var.private_subnet_ids[count.index]
  security_groups = [aws_security_group.efs.id]
}
```

## Decision Matrix

```
WHAT DO YOU NEED?                  USE THIS
+---------------------------------+------------------+
| Static website hosting          | S3 + CloudFront  |
| Database storage                | EBS (io2 or gp3) |
| Shared config across instances  | EFS               |
| User-uploaded files             | S3                |
| Backups kept for years          | S3 Glacier        |
| Container persistent volume     | EFS or EBS        |
| Data lake / analytics           | S3                |
| Boot volume for EC2             | EBS (gp3)         |
+---------------------------------+------------------+
```

**GCP equivalents**: Cloud Storage (S3), Persistent Disk (EBS), Filestore (EFS)

## Exercises

1. Create an S3 bucket with versioning and encryption enabled
   using Terraform. Upload a file, modify it, and show that
   both versions exist.

2. Using the AWS CLI, upload a directory to S3 with `aws s3 sync`.
   Then generate a presigned URL for one of the files.

3. Create an EBS volume using Terraform, attach it to an EC2
   instance, format it as ext4, and mount it.

4. For each scenario, recommend a storage service and class:
   - 500 TB of log files accessed monthly for audits
   - Profile images for a social media app
   - Shared configuration files across 20 EC2 instances
   - 7-year regulatory backup archives

5. Calculate the monthly cost to store 1 TB in each: S3 Standard,
   S3 Infrequent Access, S3 Glacier Instant, and Glacier Deep
   Archive. What is the cost difference between hottest and coldest?

---

[Next: Lesson 4 - Networking (VPC)](04-networking.md)
