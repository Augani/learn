# Lesson 12: Index Strategies -- When, What, and When NOT to Index

Lesson 03 covered what indexes are and how B-trees work. This lesson is
about strategy: choosing the RIGHT index for your workload, and knowing
when adding an index will actually make things worse.

---

## The Cost of Indexes

Every index you create:
- Takes up disk space (sometimes as much as the table itself)
- Must be updated on every INSERT, UPDATE, and DELETE that touches the
  indexed columns
- Adds overhead to VACUUM and maintenance operations

**Analogy — a book's index pages:**

A 300-page book might have a 10-page index at the back. That index makes
lookups fast, but the publisher has to maintain it. If the book is revised
frequently (like a wiki), maintaining the index becomes a significant
effort. If nobody ever looks anything up in the index, those 10 pages are
wasted paper. The same tradeoffs apply to database indexes.

---

## Setup

If you don't already have the tables from Lesson 11, run that setup
first. We'll use the same `users`, `orders`, `products`, and
`order_items` tables with 100K users, 500K orders, 1K products, and
1.5M order items.

Clean up any indexes from previous experiments:

```sql
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_status_total;
DROP INDEX IF EXISTS idx_orders_total_desc;
DROP INDEX IF EXISTS idx_orders_user_id;
```

---

## Multi-Column Indexes: Column Order Matters

A multi-column index is like a phone book sorted by last name, then first
name. You can look up "Smith" quickly. You can look up "Smith, John" even
faster. But you CANNOT efficiently look up "John" (any last name) because
the first sort level is last name.

**The leftmost prefix rule:** A multi-column index on `(a, b, c)` can
be used for queries that filter on:
- `a`
- `a` AND `b`
- `a` AND `b` AND `c`

It CANNOT efficiently help with queries that only filter on:
- `b` alone
- `c` alone
- `b` AND `c`

```sql
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
```

This index helps:

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'pending';

EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'pending' AND created_at > now() - interval '7 days';
```

This index does NOT help:

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE created_at > now() - interval '7 days';
```

For the last query, Postgres can't use the index because `created_at` is
the second column. It would have to scan all statuses to check dates.

### Column Order Strategy

Put columns in this order:
1. **Equality conditions first** (`status = 'pending'`)
2. **Range conditions last** (`created_at > '2025-01-01'`)

Why? Equality narrows to exact values in the B-tree, then the range
condition can scan a contiguous slice. If you put the range column first,
the equality column is scattered across the range.

```sql
CREATE INDEX idx_good ON orders(status, created_at);

CREATE INDEX idx_less_useful ON orders(created_at, status);
```

For `WHERE status = 'pending' AND created_at > '2025-01-01'`:
- `idx_good` jumps to 'pending', then scans forward from '2025-01-01'
- `idx_less_useful` scans the date range, then filters for 'pending'
  within each date entry (less efficient)

---

## Partial Indexes: Index Only What You Need

A partial index includes only rows that match a WHERE clause. If you
only query for active orders, why index the completed ones?

```sql
CREATE INDEX idx_orders_pending ON orders(user_id)
    WHERE status = 'pending';
```

This index is a fraction of the size of a full index on `user_id` because
it only contains rows where `status = 'pending'`.

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'pending' AND user_id = 42;
```

The planner will use `idx_orders_pending` because the query's WHERE
clause matches the index's predicate.

**Common use cases:**
- `WHERE is_active = true` -- most queries filter for active records
- `WHERE status = 'pending'` -- only unprocessed items need fast lookup
- `WHERE deleted_at IS NULL` -- soft deletes; query the living rows
- `WHERE email_verified = false` -- flag unverified users for follow-up

**Size comparison:**

```sql
CREATE INDEX idx_orders_user_id_full ON orders(user_id);

SELECT
    indexrelid::regclass AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE relname = 'orders'
    AND indexrelid::regclass::text IN ('idx_orders_pending', 'idx_orders_user_id_full');
```

The partial index will be significantly smaller.

**Analogy:** A partial index is like a phone book that only lists people
in one city. If you only ever look up people in that city, the smaller
book is faster to search and cheaper to print.

---

## Expression Indexes: Indexing Function Results

You can index the result of a function or expression, not just raw column
values.

```sql
CREATE INDEX idx_users_email_lower ON users(lower(email));
```

Now queries using `lower(email)` can use the index:

```sql
EXPLAIN ANALYZE
SELECT * FROM users WHERE lower(email) = 'user42@example.com';
```

Without this index, Postgres would do a Seq Scan because the expression
`lower(email)` doesn't match the plain `email` column in the existing
unique index.

**Common expression indexes:**

```sql
CREATE INDEX idx_orders_created_date ON orders(date(created_at));

CREATE INDEX idx_products_name_upper ON products(upper(product_name));

CREATE INDEX idx_orders_year_month ON orders(
    extract(year FROM created_at),
    extract(month FROM created_at)
);
```

**Important rule:** The query must use the EXACT same expression. An
index on `lower(email)` won't help a query using `upper(email)` or
`email` without a function.

**Analogy:** If you build an alphabetical index of book titles where all
titles are converted to uppercase, you can only use that index if you
search in uppercase too. Searching for "the great gatsby" won't match
an index entry for "THE GREAT GATSBY" unless you also uppercase your
search term.

---

## Covering Indexes (INCLUDE): Avoiding Table Lookups

A regular index stores only the indexed columns plus a pointer to the
table row. If your query needs other columns, Postgres must follow the
pointer to the table (a "heap fetch"). A covering index stores extra
columns IN the index so the query can be answered entirely from the
index.

```sql
CREATE INDEX idx_orders_status_include ON orders(status)
    INCLUDE (user_id, order_total_cents);
```

Now a query that only needs `status`, `user_id`, and `order_total_cents`
can use an Index Only Scan:

```sql
EXPLAIN ANALYZE
SELECT user_id, order_total_cents
FROM orders
WHERE status = 'delivered';
```

Without the INCLUDE columns, this would be an Index Scan (or Bitmap Scan)
that reads the index AND the table. With them, it's an Index Only Scan
that reads only the index.

**The difference between indexed columns and INCLUDEd columns:**
- Indexed columns (`status`) are part of the B-tree structure and can be
  used for searching and sorting
- INCLUDEd columns (`user_id`, `order_total_cents`) are stored in the
  index leaf pages but NOT in the B-tree structure. They can't be used
  for searching, only for avoiding table lookups

**When to use INCLUDE:**
- Queries that filter on column A but always return columns B and C
- Hot queries that run thousands of times per second and where eliminating
  the heap fetch matters

**When NOT to use INCLUDE:**
- Don't turn every index into a copy of the table. That defeats the
  purpose -- you'd have two copies of the data to maintain.

---

## Index Only Scans and Visibility Maps

Index Only Scans are the fastest possible table access: the query is
answered entirely from the index without touching the table. But there's
a catch.

Postgres uses MVCC (multi-version concurrency control), which means
deleted or updated rows still exist on the table pages until VACUUM
cleans them up. An Index Only Scan needs to verify that each row is
visible to the current transaction. It does this using the **visibility
map**, a compact bitmap that tracks which table pages contain only
visible-to-all rows.

If the visibility map says a page is "all visible," the Index Only Scan
skips the table entirely for rows on that page. If not, it falls back to
reading the table page. This is why you might see:

```
 Index Only Scan using idx_orders_status_include on orders
   Heap Fetches: 23567
```

Those 23,567 heap fetches are visits to the table because the visibility
map was incomplete. After running VACUUM:

```sql
VACUUM orders;
EXPLAIN ANALYZE
SELECT user_id, order_total_cents FROM orders WHERE status = 'delivered';
```

Heap fetches should drop significantly (or to zero).

---

## When NOT to Index

Indexes are not free. Here's when adding one hurts more than it helps.

### Small Tables

A table with 100 rows fits in a single disk page. A Seq Scan reads one
page. An Index Scan reads the index page(s) AND the table page. For tiny
tables, Seq Scan is faster.

**Rule of thumb:** If the table has fewer than a few thousand rows, an
index on it is rarely worth the maintenance cost (unless it's for a UNIQUE
or FOREIGN KEY constraint, which serve a correctness purpose regardless of
size).

### Low-Selectivity Columns

A column with very few distinct values (like `is_active` with only `true`
and `false`) has low selectivity. If 90% of rows have `is_active = true`,
an index on `is_active` for `WHERE is_active = true` reads 90% of the
table through the index, which is slower than a Seq Scan.

**Exception:** A partial index (`WHERE is_active = false`) on the rare
value IS useful because it's tiny and highly selective.

### Write-Heavy Tables

If a table gets thousands of INSERTs per second and is rarely queried,
every index on it slows down every INSERT. Each INSERT must update the
table AND every index.

**Measure the tradeoff:** If your write throughput drops 20% for an index
that speeds up a query that runs once a day, that's a bad trade.

### Columns That Are Always Used with Other Columns

If you already have an index on `(status, created_at)`, adding a separate
index on `status` alone is usually redundant. The multi-column index
already handles queries that filter only on `status` (leftmost prefix
rule).

### Heavily Updated Columns

If a column is updated frequently, every update must also update all
indexes that include that column. A `last_seen_at` timestamp that updates
on every user request is a poor candidate for indexing.

---

## Monitoring Index Usage

Postgres tracks how often each index is used. Check for unused indexes:

```sql
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

This shows indexes that have NEVER been used since the last statistics
reset. If an index is 500MB and has zero scans, it's costing disk space
and write performance for nothing.

**Check when statistics were last reset:**

```sql
SELECT stats_reset FROM pg_stat_bgwriter;
```

If the stats were reset recently, an index with zero scans might just not
have been needed yet. Check again after a reasonable period (a week of
normal traffic).

### Overall Index Hit Rate

How often does your database use indexes vs sequential scans?

```sql
SELECT
    relname AS table_name,
    seq_scan,
    idx_scan,
    CASE WHEN (seq_scan + idx_scan) > 0
        THEN round(100.0 * idx_scan / (seq_scan + idx_scan), 1)
        ELSE 0
    END AS index_usage_pct,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE n_live_tup > 1000
ORDER BY n_live_tup DESC;
```

Large tables with low `index_usage_pct` might be missing useful indexes
(or might legitimately need full table scans for analytics queries).

---

## Practical Example: Optimizing a Slow Query

Here's the scenario. Your application has a dashboard that shows recent
orders for a specific user, filtered by status. The query is slow:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.order_id, o.status, o.order_total_cents, o.created_at
FROM orders o
WHERE o.user_id = 42
  AND o.status IN ('pending', 'confirmed')
ORDER BY o.created_at DESC
LIMIT 20;
```

**Step 1: Read the plan**

Without any custom indexes, you'll likely see a Seq Scan on the entire
orders table, filtering for `user_id = 42` and the two statuses, then
sorting by `created_at`.

**Step 2: Think about what index would help**

The query filters on `user_id` (equality), `status` (equality, via IN),
and orders by `created_at` (descending). Applying our column order
strategy: equality first, then range/sort.

```sql
CREATE INDEX idx_orders_user_status_created
    ON orders(user_id, status, created_at DESC);
```

**Step 3: Re-run the EXPLAIN**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.order_id, o.status, o.order_total_cents, o.created_at
FROM orders o
WHERE o.user_id = 42
  AND o.status IN ('pending', 'confirmed')
ORDER BY o.created_at DESC
LIMIT 20;
```

You should see an Index Scan (or Bitmap Scan) that's dramatically faster.
The index jumps to user 42's pending and confirmed orders, already in
date-descending order, and stops after 20 rows thanks to the LIMIT.

**Step 4: Consider a covering index**

If this query is critical (runs thousands of times per second), eliminate
the heap fetch entirely:

```sql
DROP INDEX idx_orders_user_status_created;

CREATE INDEX idx_orders_user_status_created_covering
    ON orders(user_id, status, created_at DESC)
    INCLUDE (order_id, order_total_cents);
```

Now it can be an Index Only Scan. The query never touches the orders table.

**Step 5: Verify the improvement**

Compare the `Buffers: shared hit` and `Execution Time` between the
original (no index) and optimized (covering index) plans. You should see
an order-of-magnitude improvement.

---

## Index Strategy Decision Flowchart

When deciding whether and how to index, ask these questions in order:

1. **Is the table large enough to benefit?** (>few thousand rows)
   - No: skip the index
2. **Is the query important?** (runs frequently or is user-facing)
   - No: maybe not worth the write overhead
3. **What columns does the query filter on?**
   - Equality filters: put these first in the index
4. **Does the query also sort or range-filter?**
   - Put range/sort columns after equality columns
5. **Does the query only need a few columns?**
   - Consider INCLUDE to enable Index Only Scan
6. **Does the query filter for a specific subset of rows?**
   - Consider a partial index with a WHERE clause
7. **Does the query use functions on columns?**
   - Create an expression index matching the exact function

---

## Exercises

**Exercise 1: Multi-column index ordering**

You have this query:

```sql
SELECT * FROM orders
WHERE status = 'shipped'
  AND created_at BETWEEN '2025-01-01' AND '2025-06-30'
  AND user_id = 100;
```

Design the optimal multi-column index. Explain why you chose that column
order. Create the index, then show the EXPLAIN ANALYZE output proving
it's used.

**Exercise 2: Partial index savings**

The `orders` table has 500,000 rows. Only about 2% have `status = 'pending'`.
Create two indexes:
1. A full index on `(status, created_at)`
2. A partial index on `(created_at) WHERE status = 'pending'`

Compare their sizes using `pg_relation_size()`. Then run a query that
finds pending orders from the last 7 days and compare the EXPLAIN output
for each index.

**Exercise 3: Expression index**

Write a query that finds users whose email domain is 'example.com' using
`split_part(email, '@', 2)`. Show the EXPLAIN plan without an index (it
should be a Seq Scan). Then create an expression index and show the
improved plan.

**Exercise 4: Find unused indexes**

Run the `pg_stat_user_indexes` query from the "Monitoring" section. List
all indexes on your tables that have zero scans. For each one, decide:
should it be dropped, or is there a reason to keep it? (Hint: UNIQUE
indexes and PRIMARY KEY indexes serve a constraint purpose even if they
aren't scanned for queries.)

**Exercise 5: Covering index trade-off**

Take the dashboard query from the practical example. Create two versions:
1. A regular index (no INCLUDE)
2. A covering index with INCLUDE

For each, record:
- The index size (`pg_relation_size`)
- The EXPLAIN ANALYZE execution time
- The number of heap fetches (from BUFFERS output)

Is the covering index worth the extra space? At what query frequency
(queries per second) would the trade-off tip in favor of the covering
index?

---

Next: [Lesson 13: Transactions and ACID — How Databases Stay Correct](./13-transactions-acid.md)
