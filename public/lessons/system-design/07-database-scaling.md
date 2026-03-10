# Lesson 07: Database Scaling — Replication, Partitioning, Sharding

Your database is a single PostgreSQL server. It handles 100 requests per
second fine. Then your app gets popular and suddenly you need 10,000
requests per second. Your single server is sweating. What do you do?

Database scaling is like running a library. Right now you have one
building, one librarian, one copy of every book. As your city grows, you
have options: build a bigger building (vertical scaling), open branch
libraries with copies of popular books (read replicas), or split the
collection across buildings by genre (sharding).

---

## The Scaling Spectrum

```
   Stage 1           Stage 2              Stage 3             Stage 4
  ┌────────┐     ┌────────────┐     ┌──────────────┐     ┌──────────────┐
  │ Single │     │   Bigger   │     │   Primary +  │     │   Sharded    │
  │ Server │ ──► │   Server   │ ──► │   Replicas   │ ──► │   Cluster    │
  │        │     │  (Vertical)│     │  (Read Scale) │     │ (Write Scale)│
  └────────┘     └────────────┘     └──────────────┘     └──────────────┘
   1K QPS          5K QPS            50K reads/sec         500K+ QPS
   Easy            Easy              Moderate              Hard
```

Don't jump to sharding. Most companies never need it. Follow the
progression left to right, stopping when you have enough capacity.

---

## Strategy 1: Vertical Scaling (Bigger Server)

The simplest approach. Buy a bigger machine: more CPU, more RAM, faster
SSD. This is like expanding your library building — add another floor,
more shelves, wider aisles.

### What you get

| Resource     | Impact                                        |
|-------------|-----------------------------------------------|
| More RAM     | Larger buffer pool, more data cached in memory |
| More CPU     | More concurrent queries, faster sorting        |
| Faster SSD   | Faster reads/writes when data isn't cached     |
| More storage | Hold more data before worrying about disk      |

### The limits

A single AWS RDS instance tops out around:
- **db.r6g.16xlarge**: 64 vCPUs, 512 GB RAM
- Cost: ~$8,000/month
- Can handle maybe 50K simple queries/sec

That's a lot, but there's a hard ceiling. You can't buy a machine with
1 TB of RAM and 256 cores (well, not easily or cheaply). And a single
machine is a single point of failure.

### When to use it

Always start here. Vertical scaling buys you time to figure out if you
actually need something more complex. Most startups that sharded early
wish they hadn't.

```
Before: t3.medium (2 CPU, 4 GB RAM) → struggling at 2K QPS
After:  r6g.4xlarge (16 CPU, 128 GB RAM) → handling 20K QPS

Total effort: change an instance type in your cloud console
Total risk: near zero
```

---

## Strategy 2: Read Replicas (The Branch Library Model)

Most applications are read-heavy. An e-commerce site might have 100
product page views for every 1 purchase. A social media feed generates
hundreds of reads for every post. If reads are your bottleneck, replicas
solve it without touching your write path.

### How it works

One **primary** (also called master/leader) handles ALL writes. One or
more **replicas** (also called secondaries/followers) receive copies of
the data and handle reads.

```
                    ┌─────────────┐
                    │  Application │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         Write only    Read only    Read only
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Primary  │ │ Replica  │ │ Replica  │
        │ (Leader) │ │    #1    │ │    #2    │
        └────┬─────┘ └──────────┘ └──────────┘
             │             ▲            ▲
             │   WAL Stream│  WAL Stream│
             └─────────────┴────────────┘
```

The primary streams its write-ahead log (WAL) to replicas. Each replica
replays those WAL entries to stay in sync. Think of it as the newspaper
printing press model: one editor writes the content (primary), printing
presses across the city (replicas) produce copies for readers.

### PostgreSQL streaming replication setup

On the **primary**, enable replication in `postgresql.conf`:

```
wal_level = replica
max_wal_senders = 5
wal_keep_size = 1GB
```

Create a replication user:

```sql
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'secure_password';
```

Allow replication connections in `pg_hba.conf`:

```
host replication replicator 10.0.0.0/8 md5
```

On the **replica**, create a base backup and configure:

```bash
pg_basebackup -h primary-host -U replicator -D /var/lib/postgresql/data -P
```

In the replica's `postgresql.conf`:

```
primary_conninfo = 'host=primary-host user=replicator password=secure_password'
```

Create a standby signal file:

```bash
touch /var/lib/postgresql/data/standby.signal
```

Start the replica. It connects to the primary and begins streaming WAL.

### Replication lag

Replicas are NOT instant copies. There's always some delay (replication
lag) between a write on the primary and when it appears on replicas.
Usually milliseconds, but can spike to seconds under load.

This creates a classic problem:

```
1. User updates their profile name (write → primary)
2. User refreshes the page (read → replica)
3. Replica hasn't gotten the update yet
4. User sees their OLD name — "my update didn't work!"
```

Solutions:
- **Read-your-own-writes**: after a user writes, route THEIR reads to
  the primary for a few seconds
- **Synchronous replication**: primary waits for at least one replica to
  confirm. Safer but slower
- **Version tracking**: client sends a version token, route to primary
  if replica is behind that version

### Go connection routing example

```go
type DBPool struct {
    primary  *sql.DB
    replicas []*sql.DB
    counter  atomic.Uint64
}

func (p *DBPool) ReadDB() *sql.DB {
    idx := p.counter.Add(1) % uint64(len(p.replicas))
    return p.replicas[idx]
}

func (p *DBPool) WriteDB() *sql.DB {
    return p.primary
}

func (p *DBPool) GetUser(ctx context.Context, id int64) (*User, error) {
    row := p.ReadDB().QueryRowContext(ctx,
        "SELECT id, name, email FROM users WHERE id = $1", id)

    var user User
    if err := row.Scan(&user.ID, &user.Name, &user.Email); err != nil {
        return nil, fmt.Errorf("get user %d: %w", id, err)
    }
    return &user, nil
}

func (p *DBPool) UpdateUser(ctx context.Context, id int64, name string) error {
    _, err := p.WriteDB().ExecContext(ctx,
        "UPDATE users SET name = $1 WHERE id = $2", name, id)
    if err != nil {
        return fmt.Errorf("update user %d: %w", id, err)
    }
    return nil
}
```

### Scaling reads with replicas

You can add many replicas. Each additional replica increases your read
capacity roughly linearly:

```
1 primary + 0 replicas:  10K reads/sec
1 primary + 2 replicas:  30K reads/sec
1 primary + 5 replicas:  60K reads/sec
1 primary + 10 replicas: 100K+ reads/sec
```

But writes still go through one primary. Replicas don't help with write
throughput at all.

---

## Strategy 3: Partitioning (Splitting One Table)

When a single table gets too large (hundreds of millions or billions of
rows), even indexed queries slow down. Partitioning splits one logical
table into multiple physical pieces on the SAME server.

### Table partitioning in PostgreSQL

```sql
CREATE TABLE events (
    id         BIGSERIAL,
    user_id    BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    payload    JSONB,
    created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2024_q1 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE events_2024_q2 PARTITION OF events
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

CREATE TABLE events_2024_q3 PARTITION OF events
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');

CREATE TABLE events_2024_q4 PARTITION OF events
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');
```

Queries that include `created_at` in the WHERE clause automatically skip
irrelevant partitions (partition pruning). A query for March 2024 data
only scans `events_2024_q1`, ignoring the other three partitions.

```
              ┌──────────────────────┐
              │   events (logical)   │
              └──────────┬───────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────┴──────┐ ┌────┴───────┐ ┌────┴───────┐
    │  Q1 2024   │ │  Q2 2024   │ │  Q3 2024   │  ...
    │  90M rows  │ │  85M rows  │ │  92M rows  │
    └────────────┘ └────────────┘ └────────────┘
```

### Partitioning vs sharding

Partitioning splits data within ONE database server. Sharding splits
data across MULTIPLE servers. Partitioning is simpler. Try it before
sharding.

---

## Strategy 4: Sharding (Splitting Across Servers)

When vertical scaling hits its ceiling, replicas can't handle your write
volume, and partitioning isn't enough — you shard. Sharding distributes
rows from a single logical table across multiple database servers.

Going back to the library analogy: you split your collection across
multiple buildings. Building A has all fiction, Building B has all
non-fiction, Building C has all reference materials. Each building is
independently managed, but together they form one library system.

### The architecture

```
                    ┌─────────────┐
                    │  Application │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Shard     │
                    │   Router    │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────┴──────┐ ┌────┴───────┐ ┌────┴───────┐
     │  Shard 0    │ │  Shard 1   │ │  Shard 2   │
     │ Users A-H   │ │ Users I-Q  │ │ Users R-Z  │
     │ (Primary +  │ │ (Primary + │ │ (Primary + │
     │  Replicas)  │ │  Replicas) │ │  Replicas) │
     └─────────────┘ └────────────┘ └────────────┘
```

Each shard is a fully independent database, often with its own primary
and replicas. The shard router determines which shard owns a given piece
of data.

### Sharding strategy 1: Range-based

Divide data by ranges of a key value.

```
Shard 0: user_id   1 - 1,000,000
Shard 1: user_id   1,000,001 - 2,000,000
Shard 2: user_id   2,000,001 - 3,000,000
```

**Pros**: Simple to understand. Range queries on the shard key are
efficient (all data is contiguous on one shard).

**Cons**: Hotspots. If new users are always getting IDs at the high end,
one shard gets all the write traffic. Celebrity users with millions of
followers create hotspots on whichever shard holds them.

### Sharding strategy 2: Hash-based

Hash the shard key and mod by the number of shards.

```
shard_id = hash(user_id) % num_shards
```

**Pros**: Even distribution of data. No hotspots from sequential keys.

**Cons**: Range queries are impossible (users 1-1000 are scattered
across all shards). Adding/removing shards requires rehashing
everything (unless you use consistent hashing — see Lesson 09).

### Sharding strategy 3: Directory-based

Maintain a lookup table that maps each key to its shard.

```
┌──────────┬──────────┐
│ user_id  │ shard_id │
├──────────┼──────────┤
│    1     │    0     │
│    2     │    2     │
│    3     │    1     │
│   ...    │   ...    │
└──────────┴──────────┘
```

**Pros**: Complete flexibility. You can move individual users between
shards for load balancing. Support arbitrary shard assignments.

**Cons**: The directory itself becomes a bottleneck and single point of
failure. Every query requires a directory lookup first. The directory
must be highly available and fast.

### Comparison

| Strategy    | Distribution | Range queries | Rebalancing | Complexity |
|------------|-------------|---------------|-------------|------------|
| Range      | Uneven       | Efficient     | Medium      | Low        |
| Hash       | Even         | Impossible    | Hard        | Medium     |
| Directory  | Flexible     | Depends       | Easy        | High       |

### Go shard router example

```go
type ShardRouter struct {
    shards []*sql.DB
    count  int
}

func NewShardRouter(dsns []string) (*ShardRouter, error) {
    shards := make([]*sql.DB, len(dsns))
    for i, dsn := range dsns {
        db, err := sql.Open("postgres", dsn)
        if err != nil {
            return nil, fmt.Errorf("open shard %d: %w", i, err)
        }
        shards[i] = db
    }
    return &ShardRouter{shards: shards, count: len(shards)}, nil
}

func (r *ShardRouter) ShardFor(userID int64) *sql.DB {
    hash := fnv.New32a()
    binary.Write(hash, binary.BigEndian, userID)
    idx := int(hash.Sum32()) % r.count
    return r.shards[idx]
}

func (r *ShardRouter) GetUser(ctx context.Context, userID int64) (*User, error) {
    db := r.ShardFor(userID)
    row := db.QueryRowContext(ctx,
        "SELECT id, name, email FROM users WHERE id = $1", userID)

    var user User
    if err := row.Scan(&user.ID, &user.Name, &user.Email); err != nil {
        return nil, fmt.Errorf("get user %d: %w", userID, err)
    }
    return &user, nil
}
```

---

## The Problems Sharding Introduces

Sharding is not free. It comes with serious operational and engineering
costs that you'll pay for the life of your system.

### Problem 1: Cross-shard queries

Need to find all users who signed up last week? That data lives across
ALL shards. You must query every shard and merge results in your
application.

```go
func (r *ShardRouter) SearchAllShards(ctx context.Context, query string) ([]User, error) {
    results := make([][]User, r.count)
    errGroup, gCtx := errgroup.WithContext(ctx)

    for i := 0; i < r.count; i++ {
        shardIdx := i
        errGroup.Go(func() error {
            rows, err := r.shards[shardIdx].QueryContext(gCtx,
                "SELECT id, name, email FROM users WHERE name ILIKE $1",
                "%"+query+"%")
            if err != nil {
                return fmt.Errorf("shard %d: %w", shardIdx, err)
            }
            defer rows.Close()

            for rows.Next() {
                var user User
                if err := rows.Scan(&user.ID, &user.Name, &user.Email); err != nil {
                    return fmt.Errorf("scan shard %d: %w", shardIdx, err)
                }
                results[shardIdx] = append(results[shardIdx], user)
            }
            return rows.Err()
        })
    }

    if err := errGroup.Wait(); err != nil {
        return nil, err
    }

    var merged []User
    for _, shard := range results {
        merged = append(merged, shard...)
    }
    return merged, nil
}
```

Cross-shard queries are slow and expensive. Design your shard key so the
most common queries only hit one shard.

### Problem 2: Rebalancing

When one shard gets too large, you need to split it. This means moving
data between servers while the system is live. It's like reorganizing a
library while people are still checking out books.

### Problem 3: Hotspots

Even with hash-based sharding, some keys generate disproportionate
traffic. If one user has 50 million followers, their shard handles far
more reads than others.

### Problem 4: Cross-shard transactions

A transaction that spans shards requires distributed coordination (two-
phase commit). This is slow, complex, and failure-prone. Most sharded
systems simply avoid cross-shard transactions.

### Problem 5: Operational complexity

Every shard needs backups, monitoring, failover, and upgrades.
3 shards with 2 replicas each = 9 database servers to manage.

---

## Connection Pooling with PgBouncer

Before you shard, consider whether your real bottleneck is connections,
not capacity. PostgreSQL creates a new OS process for each connection.
Each process uses ~10 MB of RAM. With 500 connections, that's 5 GB of
RAM just for connections, before any query work.

PgBouncer sits between your application and PostgreSQL, multiplexing
many application connections through a small pool of database
connections.

```
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │  App #1  │ │  App #2  │ │  App #3  │
  │ 100 conn │ │ 100 conn │ │ 100 conn │
  └────┬─────┘ └────┬─────┘ └────┬─────┘
       │             │             │
       └─────────────┼─────────────┘
                     │
              300 connections
                     │
                     ▼
            ┌────────────────┐
            │   PgBouncer    │
            │ (Connection    │
            │  Pooler)       │
            └───────┬────────┘
                    │
              20 connections  ← orders of magnitude fewer
                    │
                    ▼
            ┌────────────────┐
            │   PostgreSQL   │
            └────────────────┘
```

### PgBouncer pooling modes

| Mode              | Behavior                                   | Use case          |
|------------------|--------------------------------------------|-------------------|
| Session pooling   | Connection held for entire client session   | Full compatibility |
| Transaction pooling | Connection returned after each transaction | Most apps          |
| Statement pooling | Connection returned after each statement    | Simple queries     |

Transaction pooling gives the best balance. Your application gets a real
PostgreSQL connection only for the duration of a transaction, then it
goes back to the pool.

### PgBouncer configuration

```ini
[databases]
myapp = host=127.0.0.1 port=5432 dbname=myapp

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
default_pool_size = 20
max_client_conn = 1000
```

Your app connects to PgBouncer on port 6432 instead of PostgreSQL on
port 5432. No code changes needed.

---

## When NOT to Shard

Sharding is a last resort, not a starting point. Do NOT shard if:

**1. You haven't tried vertical scaling.** A single PostgreSQL server on
good hardware can handle more than most people think. Instagram ran on a
single PostgreSQL server for longer than you'd expect.

**2. Your read/write ratio is high.** If 95% of your traffic is reads,
read replicas will scale you much further than sharding.

**3. You haven't optimized your queries.** Run EXPLAIN ANALYZE. Add
missing indexes. Optimize slow queries. Fix N+1 problems. These cost
nothing and can improve performance 10x-100x.

**4. You haven't tried connection pooling.** PgBouncer often solves what
looks like a database capacity problem.

**5. You haven't tried caching.** Put a Redis cache in front of your
database for hot data. This eliminates the majority of reads.

**6. Your data fits in memory.** If your entire dataset fits in RAM,
a single server with enough memory will be fast enough.

### The scaling decision tree

```
Is your database slow?
├── YES: Are your queries optimized? (indexes, EXPLAIN ANALYZE)
│   ├── NO: Fix queries first
│   └── YES: Is it a connection problem?
│       ├── YES: Add PgBouncer
│       └── NO: Is it read-heavy?
│           ├── YES: Add read replicas
│           └── NO: Is it a single huge table?
│               ├── YES: Try partitioning
│               └── NO: Is it write throughput?
│                   ├── YES: Consider sharding (finally)
│                   └── NO: Check application code
└── NO: Don't touch the database
```

---

## Real-World Example: Scaling an E-Commerce Database

Let's trace through scaling decisions for an online store.

**Stage 1 — Launch (1K users)**
Single PostgreSQL server on a t3.medium. Everything works fine. Total
database cost: $30/month.

**Stage 2 — Growing (50K users)**
Product searches are slow. Solution: add indexes on product name, category,
and price. Run EXPLAIN ANALYZE to verify. Still one server. Cost: $30/month.

**Stage 3 — Popular (500K users)**
Connection errors during peak hours. Solution: add PgBouncer. Connections
go from 200 direct to 20 pooled. Still one server. Cost: $35/month.

**Stage 4 — Scaling (2M users)**
Homepage loads slowly because product catalog reads are heavy. Solution:
add 2 read replicas. Route product listings, search, and recommendations
to replicas. Cost: $300/month.

**Stage 5 — Big (20M users)**
Order history table has 500 million rows. Queries for recent orders are
slow even with indexes. Solution: partition order table by month. Old
months can be moved to cheaper storage. Cost: $800/month.

**Stage 6 — Massive (100M+ users)**
Write throughput is the bottleneck. Thousands of orders per second.
Solution: shard the orders table by user_id. Each shard handles a subset
of users. Cost: $5,000/month.

Most companies stop at Stage 3 or 4.

---

## Key Takeaways

1. **Scale vertically first.** A bigger server is the cheapest, safest
   scaling strategy.

2. **Read replicas solve read bottlenecks.** Most apps are read-heavy.
   One primary + N replicas scales reads linearly.

3. **Partitioning splits large tables** on one server. Try it before
   sharding.

4. **Sharding splits data across servers.** It scales writes but adds
   enormous complexity.

5. **Sharding strategies**: range (simple, hotspot-prone), hash (even,
   no range queries), directory (flexible, adds dependency).

6. **PgBouncer** should be your first move when you see connection
   limits. It's a 30-minute fix.

7. **Don't shard until you've exhausted** query optimization, connection
   pooling, caching, read replicas, and partitioning.

Next: [Lesson 08 — SQL vs NoSQL: When to Use What](./08-sql-vs-nosql.md)
