# Lesson 19: Common Mistakes and Anti-Patterns

Every one of these mistakes has brought down a production system. Some
are obvious in hindsight; others are subtle traps that even experienced
developers fall into. For each anti-pattern, we'll cover what it is, why
it hurts, and what to do instead.

---

## 1. The N+1 Query Problem

### What It Is

You fetch a list of items, then loop through and run a separate query
for each item to get related data.

```sql
-- Step 1: Get all posts
SELECT id, title FROM posts;
-- Returns 100 rows

-- Step 2: For EACH post, get the author (your app does this in a loop)
SELECT username FROM users WHERE id = 1;
SELECT username FROM users WHERE id = 2;
SELECT username FROM users WHERE id = 3;
-- ... 97 more queries
```

1 query + N queries = N+1 queries. With 100 posts, that's 101 database
round trips.

### Why It's Bad

Each query has overhead: network latency, parsing, planning, execution.
With 100 round trips at 1ms each, you're spending 100ms just on overhead.
At 1,000 posts, it's 1 second of pure waste. Under load, this pattern
saturates your connection pool.

**Analogy:** Going to the grocery store, buying one item, driving home,
then driving back for the next item. A hundred trips for a hundred items,
when one trip with a list would do.

### What To Do Instead

```sql
-- One query with a JOIN
SELECT p.id, p.title, u.username
FROM posts p
JOIN users u ON u.id = p.user_id;

-- Or if you must query separately, use IN
SELECT id, username FROM users WHERE id IN (1, 2, 3, 4, 5, ...);
```

### Detecting It

In application code (TypeScript/Go/Rust), the telltale sign is a query
inside a loop:

```typescript
// BAD: N+1
const posts = await db.query('SELECT * FROM posts');
for (const post of posts) {
    const author = await db.query('SELECT * FROM users WHERE id = $1', [post.user_id]);
    post.author = author;
}

// GOOD: One query
const postsWithAuthors = await db.query(`
    SELECT p.*, u.username
    FROM posts p
    JOIN users u ON u.id = p.user_id
`);
```

---

## 2. SELECT * in Production

### What It Is

Using `SELECT *` in application queries instead of specifying the columns
you need.

```sql
-- Bad
SELECT * FROM users WHERE id = 42;

-- Good
SELECT id, username, email FROM users WHERE id = 42;
```

### Why It's Bad

1. **Wasted bandwidth.** If your `users` table has a `bio` column with
   10 KB of text, you're transferring 10 KB per row even when you only
   need the username.
2. **Breaks on schema changes.** When someone adds a column, your query
   returns an extra field your code doesn't expect. Some ORMs map by
   position, not name — adding a column silently shifts all values.
3. **Prevents covering indexes.** An index on `(id, username, email)`
   can serve the specific query without touching the table. `SELECT *`
   always reads the table.

### When SELECT * Is Acceptable

- Exploratory queries in `psql` (interactive development)
- One-off scripts
- When you genuinely need every column and understand the table

### What To Do Instead

Always list columns explicitly in application code:

```sql
SELECT id, username, email, created_at
FROM users
WHERE id = 42;
```

---

## 3. Missing Indexes on Foreign Keys

### What It Is

You create a foreign key but forget to index the column.

```sql
CREATE TABLE comments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id),
    body TEXT NOT NULL
);

-- No index on post_id!
```

### Why It's Bad

Every time you query `SELECT * FROM comments WHERE post_id = 42`, Postgres
must scan the entire comments table. Every JOIN from posts to comments
scans the whole table. Every `DELETE FROM posts WHERE id = 42` triggers a
scan of comments to check for referencing rows.

**Analogy:** A library has a card catalog that lists books by title (the
primary key on `comments.id`), but no way to look up books by author
(the foreign key `post_id`). Every time someone asks "show me all books
by this author," the librarian walks through every shelf.

### What To Do Instead

Always index foreign keys:

```sql
CREATE INDEX idx_comments_post_id ON comments(post_id);
```

### Finding Missing Indexes

```sql
-- Find foreign keys without matching indexes
SELECT
    c.conname AS constraint_name,
    c.conrelid::regclass AS table_name,
    a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
    AND a.attnum = ANY(i.indkey)
);
```

---

## 4. OFFSET Pagination on Large Tables

### What It Is

Using `OFFSET` to paginate through results:

```sql
-- Page 1
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 0;
-- Page 2
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 20;
-- Page 50
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 980;
-- Page 5000
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 99980;
```

### Why It's Bad

`OFFSET 99980` means Postgres fetches 100,000 rows, discards 99,980 of
them, and returns 20. As the offset grows, the query gets linearly
slower. Page 5,000 is 5,000x slower than page 1.

**Analogy:** Imagine counting through a deck of 100,000 cards to find
cards #99,981 through #100,000. You're handling 99,980 cards just to
throw them away.

### What To Do Instead: Keyset (Cursor) Pagination

Instead of "skip N rows," use "give me rows after this value":

```sql
-- Page 1 (no cursor yet)
SELECT id, title, created_at
FROM posts
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Page 2 (use the last row's values as cursor)
SELECT id, title, created_at
FROM posts
WHERE (created_at, id) < ('2024-03-15 10:30:00', 4523)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

This is constant-time regardless of which "page" you're on, because
Postgres uses the index to jump directly to the right position.

**Tradeoff:** You can't jump to "page 50" directly. Keyset pagination
only supports "next" and "previous." For most UIs (infinite scroll,
"load more" buttons), this is fine. For UIs that need "go to page 50,"
consider whether that's genuinely needed or just a habit from the offset
era.

---

## 5. Storing Money as Float

### What It Is

```sql
-- Bad
CREATE TABLE invoices_bad (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    amount FLOAT NOT NULL
);

INSERT INTO invoices_bad (amount) VALUES (19.99);
```

### Why It's Bad

Floating-point arithmetic is imprecise:

```sql
SELECT 0.1::FLOAT + 0.2::FLOAT;
-- 0.30000000000000004

SELECT 0.1::FLOAT + 0.2::FLOAT = 0.3::FLOAT;
-- false
```

When you're dealing with money, rounding errors accumulate. A billing
system processing millions of transactions will eventually mischarge
customers or miscalculate revenue.

**Analogy:** Using a ruler marked in thirds to measure something in
tenths. You can get close, but you'll always be slightly off, and those
tiny errors add up when you measure a thousand times.

### What To Do Instead

**Option 1: NUMERIC (exact decimal)**

```sql
CREATE TABLE invoices_good (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    amount NUMERIC(12, 2) NOT NULL
);

SELECT 0.1::NUMERIC + 0.2::NUMERIC = 0.3::NUMERIC;
-- true
```

**Option 2: Store as integer cents (most common)**

```sql
CREATE TABLE invoices_cents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0)
);

-- $19.99 stored as 1999
INSERT INTO invoices_cents (amount_cents) VALUES (1999);

-- Display as dollars
SELECT amount_cents / 100.0 AS amount_dollars FROM invoices_cents;
```

Integer arithmetic has zero rounding issues. Every fintech company uses
this approach.

---

## 6. Not Using Transactions for Multi-Step Operations

### What It Is

Running related statements without wrapping them in a transaction:

```sql
-- Bad: no transaction
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- Server crashes here
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
```

If the server crashes after the first `UPDATE`, $100 has vanished. Account
1 lost money, account 2 never received it.

### Why It's Bad

Without a transaction, each statement commits independently. A failure
between statements leaves your data in a half-updated, inconsistent
state that may be impossible to recover from automatically.

**Analogy:** Handing cash to a friend in two steps — you take $100 out
of your wallet, then hand it to them. If you drop the money in between,
it's gone from your wallet but never reached your friend.

### What To Do Instead

```sql
BEGIN;
    UPDATE accounts SET balance = balance - 100 WHERE id = 1;
    UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

If anything fails, `ROLLBACK` undoes both updates. The money either
moves completely or not at all. In application code:

```typescript
const client = await pool.connect();
try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET balance = balance - 100 WHERE id = $1', [1]);
    await client.query('UPDATE accounts SET balance = balance + 100 WHERE id = $1', [2]);
    await client.query('COMMIT');
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    client.release();
}
```

---

## 7. God Tables

### What It Is

One massive table that tries to represent multiple unrelated concepts:

```sql
-- Bad: the "everything" table
CREATE TABLE entities (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT,
    email TEXT,
    title TEXT,
    body TEXT,
    price NUMERIC,
    quantity INTEGER,
    parent_id BIGINT,
    status TEXT,
    url TEXT,
    metadata TEXT,
    extra1 TEXT,
    extra2 TEXT,
    extra3 TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Users, posts, products, and comments all share one table, distinguished
by a `type` column.

### Why It's Bad

1. **No constraints.** You can't enforce that every user has an email or
   every product has a price, because the table serves all types.
2. **Sparse data.** Most rows have most columns NULL.
3. **No foreign keys.** `parent_id` could mean anything — the parent user,
   the parent post, the parent category.
4. **Query confusion.** Every query needs `WHERE type = 'user'` and it's
   easy to forget.
5. **Index bloat.** Indexes span all types even when you only query one.

**Analogy:** A single drawer where you keep socks, tools, cutlery, and
documents. Finding anything requires sorting through everything.

### What To Do Instead

Separate tables for separate concepts:

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price_cents BIGINT NOT NULL CHECK (price_cents > 0)
);
```

Each table has meaningful constraints, focused indexes, and clear
semantics.

---

## 8. Premature Denormalization

### What It Is

Duplicating data across tables "for performance" before you have evidence
that normalization is actually slow.

```sql
-- Normalized (correct starting point)
SELECT p.title, u.username
FROM posts p
JOIN users u ON u.id = p.user_id;

-- Prematurely denormalized: storing username on posts
CREATE TABLE posts_denormalized (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    author_username TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL
);
```

### Why It's Bad

1. **Data drift.** When a user changes their username, you must update it
   in `users` AND in every post. Miss one and the data is inconsistent.
2. **Update anomalies.** A user with 10,000 posts means updating 10,001
   rows for a username change.
3. **Solving a problem you don't have.** The JOIN is probably fast
   enough. Postgres joins two indexed tables in microseconds.

**Analogy:** Photocopying your passport and taping a copy to every piece
of luggage "in case you need it." Now when your passport expires, you
have 10 outdated copies floating around.

### What To Do Instead

1. Start normalized.
2. Measure actual query performance with `EXPLAIN ANALYZE`.
3. Add indexes first.
4. Only denormalize when you have measured proof that the JOIN is a
   bottleneck — and accept the maintenance cost.

Denormalization is a valid optimization, but it's a tradeoff, not a
default.

---

## 9. Not Using Prepared Statements (SQL Injection)

### What It Is

Building SQL queries by concatenating user input:

```typescript
// CATASTROPHICALLY BAD
const query = `SELECT * FROM users WHERE username = '${userInput}'`;
await db.query(query);
```

If `userInput` is `'; DROP TABLE users; --`, the query becomes:

```sql
SELECT * FROM users WHERE username = ''; DROP TABLE users; --'
```

Your users table is gone.

### Why It's Bad

SQL injection is consistently in the OWASP Top 10. It can:
- Delete or modify any data
- Read any data (including passwords, emails, payment info)
- Execute system commands (in some configurations)
- Grant the attacker full database access

### What To Do Instead

Use parameterized queries (prepared statements):

```typescript
// TypeScript (node-postgres)
const result = await db.query(
    'SELECT * FROM users WHERE username = $1',
    [userInput]
);
```

```go
// Go
row := db.QueryRow("SELECT * FROM users WHERE username = $1", userInput)
```

```rust
// Rust (sqlx)
let user = sqlx::query_as!(User, "SELECT * FROM users WHERE username = $1", user_input)
    .fetch_one(&pool)
    .await?;
```

The database treats the parameter as a value, never as SQL code. Even if
the input contains `'; DROP TABLE users; --`, it's treated as a literal
string to match against the username column.

### Demonstrating the Difference

```sql
-- Simulating prepared statement behavior in psql
PREPARE safe_lookup (TEXT) AS
    SELECT id, username FROM users WHERE username = $1;

-- This is safe — the input is treated as a value
EXECUTE safe_lookup('''; DROP TABLE users; --');
-- Returns 0 rows (no user with that weird name)
-- users table is unharmed
```

---

## 10. Ignoring VACUUM and Bloat

### What It Is

PostgreSQL uses MVCC (Multi-Version Concurrency Control). When you
update or delete a row, the old version isn't immediately removed — it's
marked as "dead" but stays on disk. `VACUUM` cleans up these dead rows.

### Why It's Bad

Without regular vacuuming:
1. **Table bloat.** Dead rows accumulate, making the table larger than
   necessary. Seq scans read dead rows too.
2. **Index bloat.** Indexes point to dead rows, growing unnecessarily.
3. **Transaction ID wraparound.** Postgres uses 32-bit transaction IDs.
   Without vacuuming, you can run out and the database freezes to
   prevent data corruption.

**Analogy:** A notebook where you cross out lines instead of erasing
them. Eventually the notebook is 90% crossed-out lines, and finding
anything means flipping through pages of irrelevant scribbles. VACUUM
is an eraser.

### What To Do Instead

**Autovacuum is on by default.** Don't turn it off. But do monitor it:

```sql
-- Check when tables were last vacuumed
SELECT
    schemaname,
    relname AS table_name,
    n_dead_tup AS dead_rows,
    n_live_tup AS live_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

For high-churn tables (lots of updates/deletes), tune autovacuum to be
more aggressive:

```sql
ALTER TABLE high_churn_table SET (
    autovacuum_vacuum_threshold = 100,
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_threshold = 50,
    autovacuum_analyze_scale_factor = 0.02
);
```

This tells Postgres to vacuum after 100 + 5% of rows are dead (instead
of the default 50 + 20%).

---

## 11. Using ORM-Generated Queries Without Reviewing Them

### What It Is

Trusting your ORM to generate efficient SQL without ever looking at what
it actually produces.

### Why It's Bad

ORMs optimize for developer convenience, not query performance. Common
issues:

1. **Hidden N+1s.** Lazy loading in ORMs triggers a query per
   relationship access.
2. **Unnecessary joins.** Eager loading might join 5 tables when you
   only need data from 2.
3. **SELECT *.** Most ORMs fetch all columns by default.
4. **Suboptimal WHERE clauses.** ORM-generated conditions may not match
   your indexes.
5. **Missing batching.** Bulk inserts done as individual `INSERT`
   statements.

**Analogy:** Using GPS navigation without ever checking the route. Most
of the time it's fine, but occasionally it takes you through a
construction zone or a 30-mile detour when a direct road exists.

### What To Do Instead

1. **Enable query logging** during development:
   ```sql
   ALTER SYSTEM SET log_min_duration_statement = 100;
   SELECT pg_reload_conf();
   ```
   This logs any query taking more than 100ms.

2. **Review generated SQL** for critical paths:
   ```typescript
   // Prisma: use query events
   prisma.$on('query', (e) => {
       console.log(e.query, e.duration);
   });
   ```

3. **Use raw SQL for complex queries.** Every good ORM provides an
   escape hatch. Use it for performance-critical queries, reports, and
   analytics.

4. **Run EXPLAIN ANALYZE** on ORM-generated queries to see the execution
   plan.

---

## 12. Not Setting Connection Pool Limits

### What It Is

Every database connection consumes memory (roughly 10 MB per connection
in Postgres). Allowing unlimited connections, or setting the pool too
high, exhausts server memory.

### Why It's Bad

With no pool limits:
- A traffic spike opens hundreds of connections
- Each connection consumes ~10 MB of RAM
- 500 connections = 5 GB of RAM just for connections
- The database starts swapping to disk, queries slow to a crawl
- New connections are refused, your application errors cascade

**Analogy:** A restaurant with 20 tables but no reservation system.
During the dinner rush, 200 people walk in. The kitchen gets
overwhelmed, everyone waits 2 hours, and nobody has a good experience.
A reservation system (connection pool) limits concurrent diners to what
the kitchen can handle.

### What To Do Instead

```sql
-- Check your current max connections
SHOW max_connections;

-- Check current connection usage
SELECT
    count(*) AS total,
    count(*) FILTER (WHERE state = 'active') AS active,
    count(*) FILTER (WHERE state = 'idle') AS idle,
    count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction
FROM pg_stat_activity
WHERE backend_type = 'client backend';
```

**Set pool size in your application** (not in Postgres):

```typescript
// node-postgres
const pool = new Pool({
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
```

**Rule of thumb for pool size:**

```
pool_size = (number_of_cpu_cores * 2) + number_of_disks
```

For a machine with 4 cores and 1 SSD, that's 9 connections. Surprisingly
small, but concurrent queries compete for CPU and I/O. More connections
means more contention, which means slower total throughput.

For applications that need more concurrent access, use a connection
pooler like PgBouncer in front of Postgres.

---

## 13. Storing Files in the Database

### What It Is

Storing images, PDFs, videos, or other binary files as `BYTEA` columns:

```sql
-- Bad
CREATE TABLE user_avatars (
    user_id BIGINT PRIMARY KEY REFERENCES users(id),
    image BYTEA NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL
);
```

### Why It's Bad

1. **Database size explodes.** A 5 MB image per user, with 100,000 users,
   is 500 GB in your database.
2. **Backups become enormous.** Backing up 500 GB takes hours. Restoring
   takes hours.
3. **Replication lag.** Every image write is replicated to standby
   servers, consuming bandwidth.
4. **WAL bloat.** Binary writes generate large WAL entries.
5. **No CDN.** You can't put a CDN in front of database reads. Every
   image request hits the database.
6. **Memory pressure.** Postgres loads rows into shared buffers. Large
   BYTEA values waste buffer pool space.

**Analogy:** Storing all your family photos inside your wallet. Your
wallet becomes enormous, impossible to carry, and you can't share a
photo without pulling out the whole wallet.

### What To Do Instead

Store files in object storage (S3, Google Cloud Storage, R2, MinIO).
Store the reference in the database:

```sql
-- Good
CREATE TABLE user_avatars (
    user_id BIGINT PRIMARY KEY REFERENCES users(id),
    storage_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO user_avatars (user_id, storage_key, filename, content_type, size_bytes)
VALUES (1, 'avatars/user-1/photo.jpg', 'photo.jpg', 'image/jpeg', 245000);
```

Your application generates a signed URL or serves the file through a
CDN. The database stores metadata only (a few hundred bytes per row
instead of megabytes).

### When BYTEA Is Acceptable

- Very small files (< 10 KB) that are tightly coupled to row data
- Files that must be transactionally consistent with their row
  (e.g., cryptographic keys)
- Temporary data that's processed and deleted quickly

---

## Quick Reference: Anti-Pattern Checklist

| # | Anti-Pattern | Fix |
|---|---|---|
| 1 | N+1 queries | Use JOINs or IN clauses |
| 2 | SELECT * | List columns explicitly |
| 3 | Missing FK indexes | Always index foreign keys |
| 4 | OFFSET pagination | Use keyset/cursor pagination |
| 5 | Float for money | Use NUMERIC or integer cents |
| 6 | No transactions | Wrap related operations in BEGIN/COMMIT |
| 7 | God tables | Separate tables for separate concepts |
| 8 | Premature denormalization | Start normalized, measure, then optimize |
| 9 | String concatenation in SQL | Use parameterized queries |
| 10 | Ignoring VACUUM | Monitor autovacuum, tune for high-churn tables |
| 11 | Blind ORM trust | Log and review generated queries |
| 12 | Unlimited connections | Set pool limits, use PgBouncer |
| 13 | Files in the database | Use object storage, store references |

---

## Exercises

### Exercise 1: Detect N+1

Create `users` and `posts` tables with seed data (10 users, 100 posts).
Write the N+1 version (one query + loop) and the JOIN version. Use
`EXPLAIN ANALYZE` on the JOIN query and manually count the queries for
the N+1 version. How many total queries does each approach use?

```sql
-- Setup
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL
);

INSERT INTO users (username)
SELECT 'user_' || i FROM generate_series(1, 10) AS i;

INSERT INTO posts (user_id, title)
SELECT (i % 10) + 1, 'Post #' || i FROM generate_series(1, 100) AS i;

-- N+1 approach (DO NOT DO THIS — just count the queries)
-- Query 1: SELECT id FROM users;
-- Query 2-11: SELECT title FROM posts WHERE user_id = {each id};
-- Total: 11 queries

-- JOIN approach (DO THIS)
EXPLAIN ANALYZE
SELECT u.username, p.title
FROM users u
JOIN posts p ON p.user_id = u.id;
-- Total: 1 query
```

### Exercise 2: OFFSET vs Keyset Pagination

Create a table with 500,000 rows. Compare the performance of OFFSET
pagination at page 1 vs page 10,000, then implement keyset pagination
and compare:

```sql
CREATE TABLE large_posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() - (random() * interval '365 days')
);

INSERT INTO large_posts (title)
SELECT 'Post #' || i FROM generate_series(1, 500000) AS i;

CREATE INDEX idx_large_posts_created ON large_posts(created_at DESC, id DESC);

-- Test OFFSET at different pages
\timing
SELECT id, title FROM large_posts ORDER BY created_at DESC LIMIT 20 OFFSET 0;
SELECT id, title FROM large_posts ORDER BY created_at DESC LIMIT 20 OFFSET 200000;

-- Now implement keyset pagination and compare
```

### Exercise 3: Float vs NUMERIC

Run this experiment and observe the difference:

```sql
-- Float accumulation error
SELECT SUM(amount) FROM (
    SELECT 0.1::FLOAT AS amount FROM generate_series(1, 1000)
) t;

-- NUMERIC precision
SELECT SUM(amount) FROM (
    SELECT 0.1::NUMERIC AS amount FROM generate_series(1, 1000)
) t;

-- Integer cents
SELECT SUM(amount_cents) / 100.0 AS total FROM (
    SELECT 10 AS amount_cents FROM generate_series(1, 1000)
) t;
```

### Exercise 4: Find Your Anti-Patterns

Run these diagnostic queries against `learn_db` (or any project
database) and report what you find:

```sql
-- Find tables without primary keys
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_indexes i ON i.tablename = t.tablename AND i.indexname LIKE '%pkey%'
WHERE t.schemaname = 'public' AND i.indexname IS NULL;

-- Find foreign keys without indexes (from earlier in lesson)
SELECT
    c.conname AS constraint_name,
    c.conrelid::regclass AS table_name,
    a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
    AND a.attnum = ANY(i.indkey)
);

-- Find bloated tables (high dead tuple ratio)
SELECT
    relname AS table_name,
    n_dead_tup,
    n_live_tup,
    CASE WHEN n_live_tup > 0
         THEN round(100.0 * n_dead_tup / n_live_tup, 1)
         ELSE 0
    END AS dead_ratio_pct,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 100
ORDER BY n_dead_tup DESC;

-- Find unused indexes (candidates for removal)
SELECT
    indexrelname AS index_name,
    relname AS table_name,
    idx_scan AS times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE '%pkey%'
AND indexrelname NOT LIKE '%unique%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Exercise 5: Connection Monitoring

Check your PostgreSQL server's connection settings and current usage:

```sql
SHOW max_connections;

SELECT
    usename,
    client_addr,
    state,
    query,
    NOW() - query_start AS query_duration
FROM pg_stat_activity
WHERE backend_type = 'client backend'
ORDER BY query_start;
```

Identify any idle connections that have been open for a long time. These
are often leaked connections from application code that didn't properly
return connections to the pool.

---

## Key Takeaways

1. **N+1 is the most common performance killer.** Always JOIN or batch.
2. **SELECT * wastes resources.** Name your columns.
3. **Index every foreign key.** Postgres doesn't do it automatically.
4. **OFFSET pagination doesn't scale.** Switch to keyset pagination.
5. **Never use float for money.** Use NUMERIC or integer cents.
6. **Transactions protect data consistency.** Use them for multi-step operations.
7. **God tables break every relational benefit.** One concept per table.
8. **Denormalize only with measured evidence.** Start normalized.
9. **Parameterized queries prevent SQL injection.** No exceptions.
10. **Monitor VACUUM and bloat.** Don't turn off autovacuum.
11. **Review ORM queries.** Log them, EXPLAIN them, rewrite the slow ones.
12. **Limit connection pools.** More connections doesn't mean more throughput.
13. **Files go in object storage, not the database.** Store references only.

Next: [Lesson 20 — sqlx: Async Postgres from Rust](./20-sqlx-rust.md)
