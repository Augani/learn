# Lesson 21: Connection Pooling, Prepared Statements, and Production Patterns

Lesson 20 got you connected. Now let's make it production-ready.

A database connection that works on your laptop is not the same as one
that handles 10,000 requests per second under load, retries on transient
failures, and doesn't leak connections. This lesson covers the patterns
that separate hobby projects from production systems.

---

## Connection Pooling

### The Problem

Opening a database connection is expensive:

```
1. TCP handshake (1 round trip)
2. TLS negotiation (2 round trips)
3. Postgres authentication (1-2 round trips)
4. Connection setup (allocate memory, initialize session)
```

That's 50-200ms per connection. If every HTTP request opens a fresh
connection, your API is already slow before you execute a single query.

### The Solution: Connection Pools

A connection pool maintains a set of open connections that are reused across
requests.

**Analogy — the taxi stand:**

Without a pool: every passenger calls a cab company, waits for a car to be
dispatched, rides to their destination, and the cab goes back to the garage.
Wasteful.

With a pool: a taxi stand keeps 10 cabs lined up and ready. A passenger
walks up, gets in, rides, and the cab returns to the stand for the next
passenger. The cabs (connections) are reused. If all 10 are busy, you wait
at the stand briefly until one returns.

```
                    ┌──────────────┐
 Request 1 ───────►│              │
 Request 2 ───────►│  Connection  │──── Connection A ───► Postgres
 Request 3 ───────►│    Pool      │──── Connection B ───► Postgres
 Request 4 ───────►│  (PgPool)    │──── Connection C ───► Postgres
 Request 5 ───────►│              │──── Connection D ───► Postgres
     ...           └──────────────┘
                   max 4 connections,
                   requests queue if
                   all are busy
```

### PgPool is already a pool

You've been using connection pooling since Lesson 20:

```rust
let pool = PgPool::connect(&database_url).await?;
```

`PgPool::connect` creates a pool with default settings. Let's configure it
properly.

---

## PgPoolOptions — Configuring Your Pool

```rust
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

let pool = PgPoolOptions::new()
    .max_connections(20)
    .min_connections(5)
    .acquire_timeout(Duration::from_secs(3))
    .idle_timeout(Duration::from_secs(600))
    .max_lifetime(Duration::from_secs(1800))
    .test_before_acquire(true)
    .connect(&database_url)
    .await?;
```

### What each setting does

| Setting | Default | Purpose |
|---------|---------|---------|
| `max_connections` | 10 | Maximum number of connections in the pool |
| `min_connections` | 0 | Connections to keep open even when idle |
| `acquire_timeout` | 30s | How long to wait for a free connection |
| `idle_timeout` | 600s | Close a connection after this much idle time |
| `max_lifetime` | 1800s | Maximum age of a connection before it's recycled |
| `test_before_acquire` | true | Ping the connection before handing it out |

### Choosing max_connections

The right number is lower than you think.

**Common mistake:** "We get 1,000 concurrent requests, so we need 1,000
connections." No. Each query typically holds a connection for 1-10ms.
20 connections can handle 1,000+ requests/second easily.

**Formula for a starting point:**

```
max_connections = (2 * CPU cores) + number_of_disks
```

For a typical 4-core server with SSD: `(2 * 4) + 1 = 9`. Start with 10-20.

**Why fewer is better:**
- Each Postgres connection uses ~10MB of memory
- 100 connections = 1GB of RAM just for connections
- More connections = more lock contention, more context switching
- Postgres itself has a `max_connections` setting (default: 100)
- Your pool's `max_connections` should be **well below** Postgres's limit

If you have multiple application instances:

```
Total pool connections across all instances < Postgres max_connections
```

Three app instances with `max_connections = 20` each = 60 total, which
fits under the default Postgres limit of 100.

**Go comparison:** In Go, `sql.DB` has `SetMaxOpenConns`, `SetMaxIdleConns`,
and `SetConnMaxLifetime`. Same concepts, same recommendations. Go defaults
to unlimited connections, which is worse than sqlx's default of 10.

### min_connections

Set `min_connections` to avoid cold-start latency:

```rust
.min_connections(5)
```

The pool keeps at least 5 connections open. When your application starts
receiving traffic, those first 5 requests don't wait for connection setup.

For services with steady traffic, set this to roughly your average concurrent
query count. For bursty services, keep it low (0-2) to avoid wasting
Postgres resources during quiet periods.

---

## Prepared Statements

### What they are

A prepared statement separates SQL parsing from execution:

```
Step 1 (PREPARE): Parse "SELECT * FROM users WHERE id = $1"
                  → Query plan is cached

Step 2 (EXECUTE): Run with parameter id = 42
Step 3 (EXECUTE): Run with parameter id = 99
Step 4 (EXECUTE): Run with parameter id = 7
```

Steps 2-4 skip parsing and planning — they reuse the cached plan.

### Why they're faster and safer

**Faster:** Parsing and planning happen once. For a query executed 10,000
times, you save 9,999 rounds of parsing. On complex queries with multiple
joins, the planning savings alone can be significant.

**Safer:** Parameters are never interpolated into the SQL string. The
database engine treats them as data, making SQL injection impossible.

### sqlx handles this automatically

Every query executed through sqlx is automatically prepared and cached:

```rust
for user_id in user_ids {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1"
    )
        .bind(user_id)
        .fetch_one(&pool)
        .await?;
}
```

sqlx caches the prepared statement on each connection. The first execution
on a connection prepares it; subsequent executions reuse the prepared
statement. You don't need to manage this manually.

**Go comparison:** Go's `database/sql` also auto-prepares with
`db.Query("... $1", val)`, but for explicit control you can use
`db.Prepare()`. sqlx in Rust manages this transparently.

---

## Batch Operations

### Inserting many rows: the wrong way

```rust
for product in &products {
    sqlx::query(
        "INSERT INTO products (name, price) VALUES ($1, $2)"
    )
        .bind(&product.name)
        .bind(product.price)
        .execute(&pool)
        .await?;
}
```

1,000 products = 1,000 round trips to the database. Slow.

### Inserting many rows: with a transaction

Wrapping in a transaction is better (one commit instead of 1,000):

```rust
let mut tx = pool.begin().await?;

for product in &products {
    sqlx::query(
        "INSERT INTO products (name, price) VALUES ($1, $2)"
    )
        .bind(&product.name)
        .bind(product.price)
        .execute(&mut *tx)
        .await?;
}

tx.commit().await?;
```

Still 1,000 round trips, but they share a single transaction, which avoids
per-statement fsync overhead.

### Inserting many rows: with UNNEST (the fast way)

Send all the data in a single query using Postgres `UNNEST`:

```rust
let names: Vec<&str> = products.iter().map(|p| p.name.as_str()).collect();
let prices: Vec<f64> = products.iter().map(|p| p.price).collect();

sqlx::query(
    "INSERT INTO products (name, price)
     SELECT * FROM UNNEST($1::TEXT[], $2::FLOAT8[])"
)
    .bind(&names)
    .bind(&prices)
    .execute(&pool)
    .await?;
```

One round trip. One query. All rows inserted at once.

### Batch with QueryBuilder

For more dynamic batch operations, use `QueryBuilder`:

```rust
use sqlx::QueryBuilder;

let mut query_builder = QueryBuilder::new(
    "INSERT INTO products (name, price) "
);

query_builder.push_values(products.iter(), |mut builder, product| {
    builder.push_bind(&product.name);
    builder.push_bind(product.price);
});

let query = query_builder.build();
query.execute(&pool).await?;
```

`QueryBuilder` constructs a single `INSERT ... VALUES (...), (...), (...)`
statement with proper parameterization. No SQL injection risk.

**Be aware of limits:** Postgres has a maximum parameter count of ~65,535.
If you're inserting thousands of rows with many columns, split into chunks:

```rust
for chunk in products.chunks(500) {
    let mut query_builder = QueryBuilder::new(
        "INSERT INTO products (name, price) "
    );

    query_builder.push_values(chunk.iter(), |mut builder, product| {
        builder.push_bind(&product.name);
        builder.push_bind(product.price);
    });

    query_builder.build().execute(&pool).await?;
}
```

---

## Streaming Large Result Sets

### The problem: loading 1M rows into memory

```rust
let all_rows: Vec<User> = sqlx::query_as("SELECT * FROM users")
    .fetch_all(&pool)
    .await?;
```

If the `users` table has 1 million rows, this loads all of them into a
`Vec`. At ~200 bytes per User struct, that's ~200MB in memory. OOM on a
small server.

### The solution: streaming with fetch()

```rust
use futures::TryStreamExt;

let mut stream = sqlx::query_as::<_, User>("SELECT * FROM users")
    .fetch(&pool);

while let Some(user) = stream.try_next().await? {
    process_user(&user);
}
```

`fetch()` returns a `Stream` that yields rows one at a time. Only one row
is in memory at any moment. Under the hood, Postgres uses a cursor to
fetch rows in batches.

### Processing in batches

For batch processing with controlled memory:

```rust
use futures::TryStreamExt;

let mut stream = sqlx::query_as::<_, User>("SELECT * FROM users")
    .fetch(&pool);

let mut batch: Vec<User> = Vec::with_capacity(1000);

while let Some(user) = stream.try_next().await? {
    batch.push(user);

    if batch.len() >= 1000 {
        process_batch(&batch).await?;
        batch.clear();
    }
}

if !batch.is_empty() {
    process_batch(&batch).await?;
}
```

This processes users in batches of 1,000 — bounded memory regardless of
table size.

**Go comparison:** In Go, `rows.Next()` in a for loop does the same
streaming. Rust's `Stream` trait is the async equivalent of Go's row
iteration pattern.

---

## Health Checks and Connection Validation

### Application-level health check

```rust
async fn check_db_health(pool: &PgPool) -> bool {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool)
        .await
        .is_ok()
}
```

Use this in your HTTP health endpoint:

```rust
async fn health_handler(
    State(pool): State<PgPool>,
) -> impl IntoResponse {
    if check_db_health(&pool).await {
        (StatusCode::OK, "healthy")
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "database unavailable")
    }
}
```

### Connection validation

`test_before_acquire(true)` (enabled by default) pings each connection
before handing it to your code. This catches stale connections that
were closed by the server, network interruption, or idle timeout.

The cost is one extra round trip per query. For most applications this is
negligible. If you need maximum throughput and can tolerate occasional
errors on stale connections, disable it:

```rust
PgPoolOptions::new()
    .test_before_acquire(false)
    .connect(&database_url)
    .await?
```

### max_lifetime

Connections should be recycled periodically:

```rust
.max_lifetime(Duration::from_secs(1800))
```

Even healthy connections accumulate server-side memory (prepared statement
caches, temp buffers). Recycling after 30 minutes keeps memory bounded
and handles cases where the server's IP changes (e.g., after a failover).

---

## Retry Strategies for Transient Failures

Database connections fail. Networks blip. Postgres restarts for maintenance.
Your application needs to handle this gracefully.

### Simple retry with backoff

```rust
use std::time::Duration;
use tokio::time::sleep;

async fn query_with_retry<T, F, Fut>(
    max_retries: u32,
    operation: F,
) -> Result<T, sqlx::Error>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    let mut last_error = None;

    for attempt in 0..=max_retries {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) if is_transient(&e) && attempt < max_retries => {
                let delay = Duration::from_millis(100 * 2_u64.pow(attempt));
                eprintln!(
                    "Transient error (attempt {}/{}), retrying in {:?}: {}",
                    attempt + 1, max_retries, delay, e
                );
                sleep(delay).await;
                last_error = Some(e);
            }
            Err(e) => return Err(e),
        }
    }

    Err(last_error.unwrap())
}

fn is_transient(error: &sqlx::Error) -> bool {
    matches!(
        error,
        sqlx::Error::PoolTimedOut
        | sqlx::Error::PoolClosed
        | sqlx::Error::Io(_)
    )
}
```

Usage:

```rust
let user = query_with_retry(3, || async {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&pool)
        .await
}).await?;
```

### What to retry (and what not to)

| Error type | Retry? | Why |
|-----------|--------|-----|
| Connection refused | Yes | Server might be restarting |
| Connection reset | Yes | Network blip |
| Pool timeout | Yes | Temporary load spike |
| Unique violation | No | Retrying won't help |
| Foreign key violation | No | Data problem, not infrastructure |
| Syntax error | No | Bug in your code |

**Key principle:** Retry infrastructure errors, not application errors.

---

## Logging and Tracing SQL Queries

### Using tracing with sqlx

sqlx integrates with the `tracing` crate. Enable it:

```bash
cargo add tracing
cargo add tracing-subscriber --features env-filter
```

```rust
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("sqlx=info"))
        )
        .init();

    dotenvy::dotenv().ok();
    let pool = PgPool::connect(&std::env::var("DATABASE_URL")?).await?;

    let users = sqlx::query_as::<_, User>("SELECT * FROM users")
        .fetch_all(&pool)
        .await?;

    Ok(())
}
```

Run with SQL logging:

```bash
RUST_LOG=sqlx=trace cargo run
```

This logs every query, its parameters, and execution time:

```
DEBUG sqlx::query: SELECT * FROM users; rows affected: 0, rows returned: 42, elapsed: 1.234ms
```

### Custom query timing

```rust
use std::time::Instant;

async fn timed_query<T>(
    name: &str,
    future: impl std::future::Future<Output = Result<T, sqlx::Error>>,
) -> Result<T, sqlx::Error> {
    let start = Instant::now();
    let result = future.await;
    let elapsed = start.elapsed();

    match &result {
        Ok(_) => tracing::info!("{} completed in {:?}", name, elapsed),
        Err(e) => tracing::error!("{} failed in {:?}: {}", name, elapsed, e),
    }

    if elapsed > Duration::from_millis(100) {
        tracing::warn!("SLOW QUERY: {} took {:?}", name, elapsed);
    }

    result
}

let users = timed_query(
    "list_users",
    sqlx::query_as::<_, User>("SELECT * FROM users").fetch_all(&pool),
).await?;
```

---

## PostgreSQL Configuration for Production

### Key settings in postgresql.conf

```
# Memory
shared_buffers = '256MB'          # 25% of total RAM (for dedicated DB server)
work_mem = '16MB'                 # Per-operation sort/hash memory
effective_cache_size = '768MB'    # 75% of total RAM (helps planner decisions)
maintenance_work_mem = '128MB'    # For VACUUM, CREATE INDEX, etc.

# Connections
max_connections = 100             # Total allowed connections
                                  # Your app pools should total less than this

# Write-Ahead Log
wal_buffers = '16MB'              # WAL write buffer
checkpoint_completion_target = 0.9

# Query Planning
random_page_cost = 1.1            # SSD: lower than default (4.0)
effective_io_concurrency = 200    # SSD: higher parallelism

# Logging
log_min_duration_statement = 200  # Log queries taking > 200ms
log_statement = 'none'            # Don't log every query (use 'all' for debugging)
```

### Why max_connections matters

**Common mistake:** Setting `max_connections = 1000` because "more is better."

Each Postgres connection:
- Uses ~10MB of RAM
- Holds locks
- Competes for CPU
- Adds context-switch overhead

At 1,000 connections, Postgres spends more time managing connections than
executing queries. Use connection pooling (PgBouncer or your app-level pool)
and keep `max_connections` at 100-200.

### Tuning for your server

For a server with 4GB RAM and SSD:

```
shared_buffers = '1GB'
effective_cache_size = '3GB'
work_mem = '32MB'
maintenance_work_mem = '256MB'
max_connections = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

Use [PGTune](https://pgtune.leopard.in.ua/) as a starting point, then
benchmark with your actual workload.

---

## Monitoring

### pg_stat_activity — who's connected and what they're doing

```sql
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    NOW() - query_start AS duration,
    LEFT(query, 80) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```

**What to watch for:**
- `state = 'active'` with long `duration` → stuck or slow query
- `state = 'idle in transaction'` → connection holding a transaction open
  without doing anything (blocks autovacuum, holds locks)
- Too many rows → too many connections

### Kill a stuck query

```sql
SELECT pg_cancel_backend(pid);

SELECT pg_terminate_backend(pid);
```

`pg_cancel_backend` sends a cancel signal (like Ctrl+C). `pg_terminate_backend`
forcefully closes the connection.

### pg_stat_user_tables — table health

```sql
SELECT
    relname AS table,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_autovacuum,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;
```

**What to watch for:**
- `seq_scan` much higher than `idx_scan` → missing indexes
- `n_dead_tup` much higher than `n_live_tup` → VACUUM isn't keeping up
- `last_autovacuum` is NULL or very old → autovacuum might be stuck

### Slow query log

In `postgresql.conf`:

```
log_min_duration_statement = 200
```

This logs every query taking more than 200ms. Review these regularly:

```bash
grep "duration:" /var/log/postgresql/postgresql-16-main.log | sort -t: -k2 -rn | head -20
```

### Index usage

```sql
SELECT
    indexrelname AS index,
    relname AS table,
    idx_scan AS times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

Indexes with `idx_scan = 0` are unused. They cost write performance and
disk space for no benefit. Consider dropping them.

---

## Backups

### pg_dump — logical backup

```bash
pg_dump -Fc learn_db > learn_db_$(date +%Y%m%d).dump

pg_restore -d learn_db learn_db_20240115.dump
```

`-Fc` creates a custom-format compressed dump. Suitable for databases up
to ~100GB.

### Continuous archiving (WAL shipping)

For larger databases and point-in-time recovery:

1. Enable WAL archiving in `postgresql.conf`:

```
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

2. Take a base backup:

```bash
pg_basebackup -D /var/lib/postgresql/backup -Ft -z -P
```

3. Restore to a specific point in time:

```
recovery_target_time = '2024-01-15 14:30:00'
```

### Backup strategy checklist

| Concern | Solution |
|---------|----------|
| Small database (<10GB) | Daily `pg_dump`, keep 7 days |
| Medium database (10-100GB) | Daily `pg_dump` + WAL archiving |
| Large database (>100GB) | `pg_basebackup` + WAL archiving |
| Point-in-time recovery | WAL archiving (mandatory) |
| Testing backups | Restore to a test server monthly |

**The most important rule:** Test your restores. A backup you've never
restored is not a backup — it's a hope.

---

## Practical: Production-Ready Connection Pool

Putting it all together. Here's a production-quality pool setup:

```rust
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;
use tracing_subscriber::EnvFilter;

struct DatabaseConfig {
    url: String,
    max_connections: u32,
    min_connections: u32,
    acquire_timeout: Duration,
    idle_timeout: Duration,
    max_lifetime: Duration,
}

impl DatabaseConfig {
    fn from_env() -> Self {
        Self {
            url: std::env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            max_connections: std::env::var("DB_MAX_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(20),
            min_connections: std::env::var("DB_MIN_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(5),
            acquire_timeout: Duration::from_secs(
                std::env::var("DB_ACQUIRE_TIMEOUT_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(3),
            ),
            idle_timeout: Duration::from_secs(
                std::env::var("DB_IDLE_TIMEOUT_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(600),
            ),
            max_lifetime: Duration::from_secs(
                std::env::var("DB_MAX_LIFETIME_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(1800),
            ),
        }
    }
}

async fn create_pool(config: &DatabaseConfig) -> Result<PgPool, sqlx::Error> {
    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(config.min_connections)
        .acquire_timeout(config.acquire_timeout)
        .idle_timeout(config.idle_timeout)
        .max_lifetime(config.max_lifetime)
        .test_before_acquire(true)
        .connect(&config.url)
        .await?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run database migrations");

    tracing::info!(
        max_connections = config.max_connections,
        min_connections = config.min_connections,
        "Database pool initialized"
    );

    Ok(pool)
}

async fn check_health(pool: &PgPool) -> bool {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool)
        .await
        .is_ok()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn"))
        )
        .init();

    let config = DatabaseConfig::from_env();
    let pool = create_pool(&config).await?;

    if check_health(&pool).await {
        tracing::info!("Database health check passed");
    } else {
        tracing::error!("Database health check failed");
        std::process::exit(1);
    }

    tracing::info!("Application ready");

    Ok(())
}
```

### Corresponding .env file

```bash
DATABASE_URL=postgres://app:secret@localhost:5432/learn_db
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=5
DB_ACQUIRE_TIMEOUT_SECS=3
DB_IDLE_TIMEOUT_SECS=600
DB_MAX_LIFETIME_SECS=1800
RUST_LOG=info,sqlx=warn
```

### What this gives you

- **Configurable via environment variables** — no recompilation to tune
- **Migrations run on startup** — database is always up to date
- **Health check** — load balancers can verify the service is ready
- **Tracing** — structured logging for queries and errors
- **Connection recycling** — prevents stale connections and memory leaks
- **Bounded pool** — won't overwhelm Postgres under load

---

## Exercises

### Exercise 1: Pool Under Load

Write a program that:
1. Creates a pool with `max_connections = 5`
2. Spawns 100 concurrent Tokio tasks
3. Each task executes `SELECT pg_sleep(0.1)` (simulating a 100ms query)
4. Measure total elapsed time

Then change `max_connections` to 20, 50, 100 and observe how total time
changes. Plot or print the results.

```rust
use std::time::Instant;
use tokio::task::JoinSet;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&std::env::var("DATABASE_URL")?)
        .await?;

    let start = Instant::now();
    let mut tasks = JoinSet::new();

    for task_id in 0..100 {
        let pool = pool.clone();
        tasks.spawn(async move {
            let task_start = Instant::now();
            sqlx::query("SELECT pg_sleep(0.1)")
                .execute(&pool)
                .await
                .unwrap();
            println!("Task {} completed in {:?}", task_id, task_start.elapsed());
        });
    }

    while let Some(result) = tasks.join_next().await {
        result?;
    }

    println!("Total time with 5 connections: {:?}", start.elapsed());

    Ok(())
}
```

With 5 connections and 100 tasks each taking 100ms:
- Theoretical minimum: 100 tasks / 5 connections * 100ms = 2 seconds

### Exercise 2: Batch Insert Performance

Write a benchmark that inserts 10,000 rows using three different strategies:
1. One-at-a-time (individual INSERTs)
2. Wrapped in a single transaction
3. Using `UNNEST` or `QueryBuilder` for bulk insert

Print the elapsed time for each strategy. Expected results:
- Strategy 1: ~5-10 seconds
- Strategy 2: ~1-2 seconds
- Strategy 3: ~50-200 milliseconds

### Exercise 3: Streaming

Create a table with 100,000 rows. Write two programs:
1. `fetch_all` that loads everything into memory — print peak memory usage
2. `fetch` stream that processes rows one at a time — print peak memory usage

Use `/proc/self/status` (Linux) or `mach_task_self` (macOS) or simply
observe with `htop`.

### Exercise 4: Monitoring Queries

Connect to your `learn_db` and:
1. Run `pg_stat_activity` to see your connections
2. Run `pg_stat_user_tables` and identify which tables have the most
   sequential scans
3. Find any unused indexes with `pg_stat_user_indexes`
4. Set `log_min_duration_statement = 0` temporarily and run some queries,
   then check the Postgres log

### Exercise 5: Production Config

Write a complete `DatabaseConfig` struct and setup function that:
1. Reads all settings from environment variables with sensible defaults
2. Validates settings (e.g., `max_connections` between 1 and 100)
3. Runs migrations on startup
4. Exposes a health check function
5. Logs pool statistics (active connections, idle connections) periodically
   using a background Tokio task

---

## Key Takeaways

1. **Connection pooling is mandatory.** Opening connections per request is
   too slow. `PgPool` handles this automatically.
2. **Fewer connections is usually better.** Start with 10-20, benchmark,
   adjust. Don't set 1,000.
3. **Prepared statements are automatic.** sqlx caches them per connection.
4. **Batch inserts with UNNEST or QueryBuilder.** One round trip beats 1,000.
5. **Stream large result sets.** Never `fetch_all` on a million-row table.
6. **Recycle connections** with `max_lifetime` to prevent stale connections
   and memory leaks.
7. **Retry transient errors** (network, pool timeout) but not application
   errors (constraint violations).
8. **Monitor your database.** `pg_stat_activity` and slow query logs are
   your best friends.
9. **Test your backups.** A backup you've never restored is not a backup.
10. **Tune Postgres settings** for your hardware — especially
    `shared_buffers`, `work_mem`, and `max_connections`.

Next: [Lesson 22 — Building a Complete Data Layer](./22-data-layer-project.md)
