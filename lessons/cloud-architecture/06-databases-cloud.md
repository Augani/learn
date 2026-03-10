# Lesson 6: Databases in Cloud

## The Big Analogy: Restaurants

```
+---------------------+---------------------------------------+
| RESTAURANT TYPE     | DATABASE EQUIVALENT                   |
+---------------------+---------------------------------------+
|                     |                                       |
| Cooking at home     | Self-managed DB on EC2                |
| You buy groceries,  | You install, patch, back up,          |
| cook, clean dishes  | scale, and maintain everything        |
|                     |                                       |
| Meal kit delivery   | Amazon RDS                            |
| Ingredients prepped,| AWS manages patching, backups,        |
| you just cook       | replication. You manage schema.       |
|                     |                                       |
| Fine dining         | Amazon Aurora                         |
| Chef handles        | MySQL/Postgres compatible, 5x faster, |
| everything, premium | auto-scaling storage, higher cost     |
| quality             |                                       |
|                     |                                       |
| Fast food counter   | DynamoDB                              |
| Order by number,    | Key-value/document, millisecond       |
| instant, simple     | response, fully managed, serverless   |
| menu                |                                       |
|                     |                                       |
| Coffee machine      | ElastiCache                           |
| Quick grab, keeps   | In-memory (Redis/Memcached),          |
| you going, not a    | microsecond response, caching layer   |
| full meal           |                                       |
+---------------------+---------------------------------------+
```

## When to Use What

```
START HERE: What kind of data?
|
+-- Structured (tables, rows, relationships)?
|   |
|   +-- Need MySQL/PostgreSQL compatibility?
|   |   |
|   |   +-- Standard workload --------> RDS
|   |   +-- High performance/scale ----> Aurora
|   |
|   +-- Need global scale, >100K TPS?
|       +------------------------------> Aurora Global / DynamoDB
|
+-- Semi-structured (JSON docs, key-value)?
|   |
|   +-- Predictable access patterns ----> DynamoDB
|   +-- Need flexible queries -----------> DocumentDB (MongoDB)
|
+-- Caching / session data?
|   +-- Sub-millisecond latency ---------> ElastiCache (Redis)
|
+-- Time series / IoT data?
    +------------------------------> Timestream
```

## Amazon RDS

```
RDS ARCHITECTURE (Multi-AZ)

  AZ-a                          AZ-b
  +-----------------------+     +-----------------------+
  | RDS Primary           |     | RDS Standby           |
  | +------------------+  |     | +------------------+  |
  | | MySQL / Postgres |  |     | | Synchronous      |  |
  | | Your database    |  |====>| | Replication      |  |
  | +------------------+  |     | +------------------+  |
  | | EBS Storage      |  |     | | EBS Storage      |  |
  | +------------------+  |     | +------------------+  |
  +-----------------------+     +-----------------------+
           |
           | Automatic failover
           | (30-60 seconds)

  RDS MANAGES:                 YOU MANAGE:
  - OS patching                - Schema design
  - DB engine patching         - Query optimization
  - Automated backups          - Application connection
  - Multi-AZ failover          - Parameter tuning
  - Monitoring                 - Security groups
```

### RDS with Terraform

```hcl
resource "aws_db_subnet_group" "main" {
  name       = "main-db-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier     = "app-database"
  engine         = "postgres"
  engine_version = "16.1"
  instance_class = "db.t3.medium"

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_encrypted     = true
  storage_type          = "gp3"

  db_name  = "appdb"
  username = "admin"
  password = var.db_password

  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  skip_final_snapshot = false
  final_snapshot_identifier = "app-db-final-snapshot"

  tags = {
    Environment = "production"
  }
}
```

## Amazon Aurora

```
AURORA ARCHITECTURE

              Writer Instance
              +------------------+
              | Aurora Primary   |
              |                  |
              +--------+---------+
                       |
          Shared Storage Volume (auto-scales to 128 TB)
  +--------+--------+--------+--------+--------+--------+
  | Copy 1 | Copy 2 | Copy 3 | Copy 4 | Copy 5 | Copy 6 |
  +--------+--------+--------+--------+--------+--------+
    AZ-a     AZ-a     AZ-b     AZ-b     AZ-c     AZ-c

              6 copies across 3 AZs
              Can lose 2 copies and still write
              Can lose 3 copies and still read

  Reader Instances (up to 15)
  +------------+ +------------+ +------------+
  | Reader 1   | | Reader 2   | | Reader 3   |
  | (AZ-a)     | | (AZ-b)     | | (AZ-c)     |
  +------------+ +------------+ +------------+
        Read traffic load balanced across readers
```

### Aurora with Terraform

```hcl
resource "aws_rds_cluster" "main" {
  cluster_identifier = "app-aurora-cluster"
  engine             = "aurora-postgresql"
  engine_version     = "16.1"
  database_name      = "appdb"
  master_username    = "admin"
  master_password    = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  storage_encrypted   = true
  deletion_protection = true

  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"
}

resource "aws_rds_cluster_instance" "main" {
  count              = 2
  identifier         = "app-aurora-${count.index}"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.r6g.large"
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version
}
```

## Amazon DynamoDB

```
DYNAMODB DATA MODEL

  Table: Users
  +----------------+----------------+-------------------+
  | Partition Key  | Sort Key       | Attributes        |
  | (user_id)      | (created_at)   | (schema-free)     |
  +----------------+----------------+-------------------+
  | user_001       | 2024-01-15     | {name: "Alice"}   |
  | user_001       | 2024-03-20     | {name: "Alice B"} |
  | user_002       | 2024-02-01     | {name: "Bob"}     |
  +----------------+----------------+-------------------+

  PRICING MODES:
  +-------------------+----------------------------+
  | On-Demand         | Provisioned                |
  | Pay per request   | Set read/write capacity    |
  | Good for spiky    | Good for steady traffic    |
  | Scales auto       | Cheaper at scale           |
  +-------------------+----------------------------+
```

### DynamoDB with Terraform

```hcl
resource "aws_dynamodb_table" "users" {
  name         = "Users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "created_at"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}
```

## ElastiCache

```
CACHING PATTERN

  Client --> App Server --> Cache HIT? --YES--> Return cached
                              |
                              NO
                              |
                              v
                           Database --> Store in cache --> Return

  ElastiCache (Redis)
  +------------------------------------------+
  | Use cases:                               |
  |   Session storage                        |
  |   API response caching                   |
  |   Leaderboards (sorted sets)             |
  |   Rate limiting                          |
  |   Pub/Sub messaging                      |
  |                                          |
  | Performance: microsecond reads           |
  | Cluster mode: up to 500 nodes            |
  +------------------------------------------+
```

### ElastiCache with Terraform

```hcl
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "app-cache"
  description          = "Redis cache cluster"
  node_type            = "cache.t3.medium"
  num_cache_clusters   = 2
  engine               = "redis"
  engine_version       = "7.0"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = true
}
```

## Database Comparison

```
+-------------+---------+--------+----------+----------+
| Feature     | RDS     | Aurora | DynamoDB | Elasti-  |
|             |         |        |          | Cache    |
+-------------+---------+--------+----------+----------+
| Type        | Relat.  | Relat. | NoSQL    | In-mem   |
| SQL         | Yes     | Yes    | No       | No       |
| Max storage | 64 TB   | 128 TB | Unlim.   | ~13 TB   |
| Latency     | ms      | ms     | <10 ms   | <1 ms    |
| Scaling     | Vert.   | Horiz. | Auto     | Vert.    |
| Serverless  | No      | Yes    | Yes      | Yes      |
| Multi-AZ    | Yes     | Yes    | Yes      | Yes      |
| Global      | Read    | Global | Global   | Global   |
|             | replica | DB     | Tables   | Datastore|
+-------------+---------+--------+----------+----------+
```

**GCP equivalents**: Cloud SQL (RDS), AlloyDB (Aurora), Bigtable/Firestore (DynamoDB), Memorystore (ElastiCache)

## Exercises

1. Create an RDS PostgreSQL instance in a private subnet with
   Multi-AZ enabled using Terraform. Ensure it is encrypted and
   has automated backups.

2. Create a DynamoDB table for an e-commerce order system with
   `order_id` as partition key and `created_at` as sort key. Add
   a GSI on `customer_id`.

3. Design a caching strategy for a web app that shows user
   profiles. Show where ElastiCache fits and what invalidation
   strategy you would use.

4. For each scenario, recommend a database service:
   - Social media feed with millions of writes per second
   - Financial application needing ACID transactions and joins
   - Session storage for a web app with 100K concurrent users
   - IoT platform storing billions of sensor readings

5. Set up an Aurora PostgreSQL cluster with one writer and one
   reader instance using Terraform. Configure the reader endpoint
   for read queries.

---

[Next: Lesson 7 - Serverless Patterns](07-serverless.md)
