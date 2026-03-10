# Lesson 09: Database as a Service

## The Utility Company Analogy

You don't build a power plant to charge your phone. You plug into the grid.
The utility company handles generation, transmission, redundancy, and
maintenance. You pay for what you use. If there's an outage, they fix it.

Database as a service works the same way. Developers shouldn't provision
RDS instances, configure replication, manage backups, tune parameters, or
handle failovers. They should say "I need a PostgreSQL database" and get
one — pre-configured, monitored, backed up, and ready to use.

```
  WITHOUT DATABASE PLATFORM:

  Developer: "I need a database"
  1. File Jira ticket to DBA team                          (Day 1)
  2. DBA reviews, asks for sizing info                     (Day 3)
  3. Developer guesses sizing                              (Day 4)
  4. DBA provisions RDS instance                           (Day 5)
  5. DBA configures security groups                        (Day 5)
  6. DBA sets up backups                                   (Day 6)
  7. DBA creates credentials, emails them (!)              (Day 6)
  8. Developer updates app config                          (Day 7)
  9. Developer realizes they need a staging DB too         (Day 7)
  10. Go to step 1                                         (Day 7)

  WITH DATABASE PLATFORM:

  Developer: "I need a database"
  1. Apply database claim YAML                             (Minute 0)
  2. Platform provisions DB, configures backup,            (Minute 5)
     sets up monitoring, creates creds in Vault
  3. Developer's app picks up connection via sidecar       (Minute 6)
  Done.
```

## Self-Service Database Provisioning

The core capability: developers provision databases without DBA involvement
for standard use cases.

```
  DATABASE PROVISIONING FLOW:

  Developer                Platform                     Cloud
  +----------+            +------------------+         +---------+
  | Apply    |  K8s API   | Validate request |  API    | Create  |
  | Database |----------->| Check quota      |-------->| RDS     |
  | claim    |            | Select config    |         | instance|
  +----------+            | from tier        |         +---------+
       |                  +------------------+              |
       |                       |                            |
       |                  +----+----+                       |
       |                  |         |                       |
       |            +---------+ +--------+                  |
       |            | Create  | | Setup  |                  |
       |            | Vault   | | backup |                  |
       |            | secret  | | sched  |                  |
       |            +---------+ +--------+                  |
       |                  |         |                       |
       |                  +----+----+                       |
       |                       |                            |
       |                  +---------+                       |
       |                  | Deploy  |                       |
       |                  | monitor |                       |
       |                  | dashbrd |                       |
       |                  +---------+                       |
       |                       |                            |
       |<---- Status: Ready ---+                            |
       |      Host: pg-abc.internal                         |
       |      Secret: vault://db/pg-abc                     |
```

### Database Claim CRD

```yaml
apiVersion: platform.acme.com/v1
kind: Database
metadata:
  name: orders-db
  namespace: orders-team
spec:
  engine: postgresql
  version: "15"
  tier: standard

  storage:
    size: 50Gi
    maxSize: 200Gi
    type: gp3

  highAvailability:
    enabled: true
    readReplicas: 1

  backup:
    enabled: true
    schedule: "0 3 * * *"
    retention: 30d
    pointInTimeRecovery: true

  monitoring:
    enabled: true
    alerting: true

  access:
    teams:
      - name: orders-team
        role: readwrite
      - name: analytics-team
        role: readonly
```

### Database Tiers

Instead of exposing every RDS parameter, offer tiers that map to
pre-configured profiles:

```
  DATABASE TIERS:

  +----------+-------------------+-------------------+-------------------+
  |          | STARTER           | STANDARD          | PERFORMANCE       |
  +----------+-------------------+-------------------+-------------------+
  | Use case | Dev, staging,     | Most production   | High-throughput   |
  |          | low-traffic       | workloads         | critical services |
  +----------+-------------------+-------------------+-------------------+
  | Instance | db.t3.micro       | db.r6g.large      | db.r6g.2xlarge    |
  | Storage  | 20GB gp3          | 100GB gp3         | 500GB io2         |
  | HA       | Single AZ         | Multi-AZ          | Multi-AZ + reader |
  | Backups  | 7 days            | 30 days + PITR    | 30 days + PITR   |
  | IOPS     | 3000 (default)    | 6000              | 20000            |
  | Conn.    | 100               | 500               | 2000             |
  | Cost/mo  | ~$30              | ~$300             | ~$1,200          |
  +----------+-------------------+-------------------+-------------------+
```

```yaml
database_tiers:
  starter:
    instance_class: db.t3.micro
    allocated_storage: 20
    storage_type: gp3
    multi_az: false
    backup_retention: 7
    performance_insights: false
    max_connections: 100

  standard:
    instance_class: db.r6g.large
    allocated_storage: 100
    storage_type: gp3
    iops: 6000
    multi_az: true
    backup_retention: 30
    performance_insights: true
    max_connections: 500

  performance:
    instance_class: db.r6g.2xlarge
    allocated_storage: 500
    storage_type: io2
    iops: 20000
    multi_az: true
    backup_retention: 30
    performance_insights: true
    max_connections: 2000
    read_replicas: 1
```

## Managed Schema Migrations

Schema migrations are one of the most dangerous operations in production.
The platform can make them safer by providing guardrails and automation.

```
  SCHEMA MIGRATION FLOW:

  Developer                Platform                    Database
  +----------+            +------------------+         +---------+
  | Write    |  git push  | CI picks up      |  check  | Validate|
  | migration|----------->| migration files  |-------->| against |
  | file     |            | in /migrations   |         | current |
  +----------+            +------------------+         | schema  |
                               |                       +---------+
                          +----+-----+                      |
                          |          |                      |
                     +--------+ +--------+                  |
                     | Lint   | | Dry    |                  |
                     | for    | | run    |                  |
                     | unsafe | | in     |                  |
                     | ops    | | staging|                  |
                     +--------+ +--------+                  |
                          |          |                      |
                          +----+-----+                      |
                               |                            |
                          +---------+                       |
                          | Apply   |                       |
                          | with    |---------------------->|
                          | timeout |   Run migration       |
                          | & lock  |                       |
                          | mgmt   |                       |
                          +---------+                       |
```

### Migration Safety Checks

The platform lints migrations before they run:

```yaml
migration_safety_rules:
  blocking_operations:
    - pattern: "ALTER TABLE .* ADD COLUMN .* NOT NULL(?! DEFAULT)"
      severity: error
      message: "Adding NOT NULL column without default locks table. Add DEFAULT first."

    - pattern: "ALTER TABLE .* ALTER COLUMN .* TYPE"
      severity: warning
      message: "Changing column type may lock table. Consider a new column + backfill."

    - pattern: "CREATE INDEX(?! CONCURRENTLY)"
      severity: error
      message: "Use CREATE INDEX CONCURRENTLY to avoid locking reads."

    - pattern: "DROP TABLE|DROP COLUMN"
      severity: warning
      message: "Destructive operation. Ensure no code references this."

    - pattern: "LOCK TABLE"
      severity: error
      message: "Explicit table locks are not allowed in platform migrations."

  size_checks:
    max_migration_time: 60s
    max_lock_wait: 5s
    require_rollback: true
```

### Migration CLI

```bash
$ platform db migrate create orders-db add-status-column
Created: migrations/20250115_103000_add_status_column.sql

$ platform db migrate lint orders-db
Checking migrations/20250115_103000_add_status_column.sql...
WARNING: ALTER TABLE orders ADD COLUMN status VARCHAR(50) NOT NULL
  → Adding NOT NULL column without DEFAULT locks table
  → Fix: ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'
1 warning, 0 errors

$ platform db migrate plan orders-db --env staging
Migration plan for orders-db (staging):
  1. BEGIN TRANSACTION
  2. ALTER TABLE orders ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'
  3. CREATE INDEX CONCURRENTLY idx_orders_status ON orders(status)
  4. COMMIT
  Estimated time: <5s
  Rollback: DROP COLUMN status

$ platform db migrate apply orders-db --env staging
Applying migration to staging...
Migration complete in 2.3s
Rows affected: 0 (new column only)
```

## Backup Automation

Backups are boring until you need them. Then they're the most important
thing in the world. The platform automates the entire backup lifecycle.

```
  BACKUP AUTOMATION:

  +------------------------------------------------------------------+
  |  AUTOMATED BACKUP SYSTEM                                         |
  +------------------------------------------------------------------+
  |                                                                  |
  |  Scheduled Backups (daily)                                       |
  |  +---+---+---+---+---+---+---+---+---+   Retention: 30 days    |
  |  |D1 |D2 |D3 |D4 |D5 |D6 |D7 |...|D30|   PITR: continuous     |
  |  +---+---+---+---+---+---+---+---+---+                         |
  |                                                                  |
  |  Point-in-Time Recovery                                          |
  |  ──────────────────────────────────────>  WAL archiving          |
  |  Any point in last 30 days                                       |
  |                                                                  |
  |  Cross-Region Copy                                               |
  |  us-east-1 ──────copy──────> us-west-2   Disaster recovery      |
  |                                                                  |
  |  Verification (weekly)                                           |
  |  Restore backup to temp instance                                 |
  |  Run validation queries                                          |
  |  Report: ✓ Backup verified, 847GB, 12m restore time             |
  +------------------------------------------------------------------+
```

### Backup Verification

Untested backups aren't backups — they're hopes. The platform verifies
backups automatically:

```yaml
apiVersion: platform.acme.com/v1
kind: BackupVerification
metadata:
  name: orders-db-verification
spec:
  database: orders-db
  schedule: "0 6 * * SUN"
  verification:
    restoreTest: true
    validationQueries:
      - name: row-count
        query: "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '7 days'"
        expectMinRows: 1000
      - name: schema-check
        query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'"
        expectColumns: ["id", "user_id", "total", "status", "created_at"]
    cleanupAfterTest: true
  notification:
    onFailure:
      slack: "#database-alerts"
      pagerduty: true
    onSuccess:
      slack: "#database-status"
```

### Self-Service Restore

```bash
$ platform db restore orders-db --help
Restore a database from backup

Usage:
  platform db restore <database> [flags]

Flags:
  --target-time    Restore to specific point in time (PITR)
  --snapshot-id    Restore from specific snapshot
  --to-name        Name for restored database (default: {name}-restored)
  --env            Environment (staging/production)
  --approve        Skip confirmation prompt

$ platform db restore orders-db \
    --target-time "2025-01-15T10:00:00Z" \
    --to-name orders-db-restored \
    --env staging

Restoring orders-db to 2025-01-15T10:00:00Z...
Creating new instance: orders-db-restored
Restoring from WAL archives...
Progress: [████████████████████░░░░] 85%
Restore complete in 8m 23s

Restored database:
  Name: orders-db-restored
  Host: pg-restored-xyz.staging.internal
  Size: 45GB
  Point-in-time: 2025-01-15T10:00:00Z

Connection: vault://secrets/db/orders-db-restored
```

## Multi-Tenancy

When multiple teams share database infrastructure, you need isolation
guarantees.

```
  MULTI-TENANCY MODELS:

  MODEL 1: Separate Instances (strongest isolation)
  +----------+   +----------+   +----------+
  | Team A   |   | Team B   |   | Team C   |
  | Instance |   | Instance |   | Instance |
  +----------+   +----------+   +----------+
  + Full isolation    - Expensive    - Management overhead

  MODEL 2: Shared Instance, Separate Databases
  +------------------------------------------+
  | Shared PostgreSQL Instance                |
  | +----------+ +----------+ +----------+   |
  | | team_a_db| | team_b_db| | team_c_db|   |
  | +----------+ +----------+ +----------+   |
  +------------------------------------------+
  + Cost efficient    + Good isolation    - Noisy neighbor possible

  MODEL 3: Shared Database, Schema Isolation
  +------------------------------------------+
  | Shared Database                           |
  | +----------+ +----------+ +----------+   |
  | | schema_a | | schema_b | | schema_c |   |
  | +----------+ +----------+ +----------+   |
  +------------------------------------------+
  + Most efficient    - Weak isolation    - Harder to manage
```

### Resource Isolation with PostgreSQL

```sql
-- Create team-specific database with resource limits
CREATE DATABASE orders_team;

-- Create role with connection limit
CREATE ROLE orders_team_app WITH
  LOGIN
  CONNECTION LIMIT 100
  IN ROLE platform_app_role;

-- Set statement timeout to prevent runaway queries
ALTER ROLE orders_team_app SET statement_timeout = '30s';

-- Set work_mem to prevent memory hogging
ALTER ROLE orders_team_app SET work_mem = '64MB';

-- Grant schema access
GRANT ALL ON SCHEMA public TO orders_team_app;
GRANT USAGE ON SCHEMA public TO orders_team_readonly;
```

### Connection Pooling with PgBouncer

```
  CONNECTION POOLING:

  Without pooling:                 With PgBouncer:
  App (100 pods × 5 conn = 500)   App (100 pods × 5 conn = 500)
       |                                |
       v                                v
  PostgreSQL                       PgBouncer (500 client conn)
  (500 connections = expensive)         |
                                        v
                                   PostgreSQL
                                   (50 server connections = efficient)
```

```yaml
apiVersion: platform.acme.com/v1
kind: ConnectionPool
metadata:
  name: orders-db-pool
  namespace: orders-team
spec:
  database: orders-db
  pooler: pgbouncer
  poolMode: transaction
  maxClientConnections: 500
  defaultPoolSize: 25
  reservePoolSize: 5
  maxDbConnections: 50
  monitoring:
    enabled: true
    metrics:
      - client_connections
      - server_connections
      - avg_query_time
      - total_query_count
```

## Database Observability

Every provisioned database gets monitoring automatically:

```
  DATABASE DASHBOARD:

  +====================================================================+
  |  orders-db (PostgreSQL 15)                          [production]   |
  +====================================================================+
  |                                                                    |
  |  CONNECTIONS          QUERY RATE           REPLICATION LAG          |
  |  ┌────────────────┐  ┌────────────────┐   ┌────────────────┐      |
  |  │ 45/100 active  │  │ 2,340 QPS      │   │ 0.3s            │      |
  |  │ ▃▃▄▄▃▃▄▃▃▃▄▃  │  │ ▅▆▇▆▅▅▆▇▆▅▅▆  │   │ ▁▁▁▁▁▂▁▁▁▁▁▁  │      |
  |  └────────────────┘  └────────────────┘   └────────────────┘      |
  |                                                                    |
  |  STORAGE             CPU                  MEMORY                   |
  |  ┌────────────────┐  ┌────────────────┐   ┌────────────────┐      |
  |  │ 45GB / 200GB   │  │ 23%             │   │ 6.2GB / 16GB   │      |
  |  │ ▃▃▃▃▃▃▃▃▄▄▄▄  │  │ ▂▃▂▂▃▂▂▃▂▃▂▂  │   │ ▅▅▅▅▅▅▅▅▅▅▅▅  │      |
  |  └────────────────┘  └────────────────┘   └────────────────┘      |
  |                                                                    |
  |  SLOW QUERIES (last 24h)                                          |
  |  +---------------------------------------------------+---------+  |
  |  | Query                                             | Avg (ms)|  |
  |  +---------------------------------------------------+---------+  |
  |  | SELECT * FROM orders WHERE user_id = ? AND sta... | 234     |  |
  |  | INSERT INTO order_items (...) VALUES (...)        | 12      |  |
  |  | UPDATE orders SET status = ? WHERE id = ?         | 8       |  |
  |  +---------------------------------------------------+---------+  |
  |                                                                    |
  |  BACKUPS                                                          |
  |  Last backup: 2025-01-15 03:00 UTC (6h ago) ✓                    |
  |  Next backup: 2025-01-16 03:00 UTC                                |
  |  PITR available: last 30 days                                     |
  +====================================================================+
```

### Database Alert Rules

```yaml
groups:
  - name: database-platform-alerts
    rules:
      - alert: DatabaseConnectionsHigh
        expr: |
          pg_stat_database_numbackends / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.datname }} connections at {{ $value | humanizePercentage }}"

      - alert: DatabaseReplicationLag
        expr: |
          pg_replication_lag_seconds > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Replication lag {{ $value }}s on {{ $labels.instance }}"

      - alert: DatabaseStorageRunningOut
        expr: |
          predict_linear(pg_database_size_bytes[7d], 30*24*3600)
          > pg_settings_max_storage_bytes * 0.9
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.datname }} predicted to hit 90% storage in 30 days"

      - alert: DatabaseSlowQueries
        expr: |
          rate(pg_stat_statements_mean_exec_time_ms[5m]) > 500
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow queries detected on {{ $labels.datname }}"

      - alert: DatabaseBackupFailed
        expr: |
          time() - platform_database_last_successful_backup_timestamp > 86400 * 2
        labels:
          severity: critical
        annotations:
          summary: "No successful backup for {{ $labels.database }} in 48 hours"
```

## Database Platform CLI

```bash
$ platform db --help
Manage databases through the platform

Commands:
  create      Provision a new database
  list        List databases for a team
  status      Show database status and health
  connect     Open psql session (via Vault credentials)
  migrate     Run schema migrations
  backup      Manage backups
  restore     Restore from backup
  scale       Change database tier
  metrics     Show database performance metrics

$ platform db connect orders-db --role readonly
Fetching credentials from Vault...
Connecting to orders-db (readonly)...
psql (15.4)
SSL connection (protocol: TLSv1.3)
Type "help" for help.

orders=>

$ platform db scale orders-db --tier performance --env production
Current tier: standard (db.r6g.large, 100GB, Multi-AZ)
New tier:     performance (db.r6g.2xlarge, 500GB, Multi-AZ + Reader)

This will cause a brief failover (~30s downtime).
Scheduled maintenance window: Mon 04:00-05:00 UTC

Proceed? (yes/no): yes
Scaling scheduled for next maintenance window.
```

## Exercises

1. **Database inventory.** List every database at your organization. For
   each: who provisioned it? Who maintains backups? When was the last
   successful restore test? How are credentials managed?

2. **Design database tiers.** Create three database tiers for your
   organization (starter, standard, performance). Define instance sizes,
   storage, backup policies, and connection limits for each.

3. **Migration safety.** Write a migration linter that catches the five
   most common unsafe PostgreSQL migration patterns. Test it against real
   migrations from your codebase.

4. **Backup verification.** Set up automated backup verification for a
   database. Restore to a temporary instance weekly, run validation
   queries, and report results to Slack.
