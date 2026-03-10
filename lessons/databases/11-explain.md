# Lesson 11: EXPLAIN -- Reading What the Database Is Doing

You've written a query. It's slow. But why? EXPLAIN lets you look inside
the database engine's brain and see exactly what it decided to do with
your query.

---

## Why You Need EXPLAIN

When you write SQL, you describe WHAT you want, not HOW to get it. The
query planner decides the HOW: which indexes to use, which join algorithm
to pick, what order to process tables in.

Most of the time, the planner is smarter than you. But sometimes it makes
a bad decision (usually because it has bad statistics or the query is
structured in a way that hides the optimal plan). EXPLAIN shows you the
plan so you can diagnose what went wrong.

**Analogy — GPS navigation:**

You type in a destination (the SQL query). The GPS calculates a route (the
query plan). Most of the time the route is great. But sometimes the GPS
sends you through a traffic jam because its traffic data is stale, or it
takes a winding back road when the highway would be faster. EXPLAIN is
like looking at the GPS route BEFORE you drive, so you can spot problems
and choose a better route.

---

## Setup

Let's create tables with enough data to make query plans interesting:

```sql
DROP TABLE IF EXISTS order_items, orders, products, users CASCADE;

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    country TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    price_cents INTEGER NOT NULL
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    status TEXT NOT NULL DEFAULT 'pending',
    order_total_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL
);

INSERT INTO users (email, full_name, country)
SELECT
    'user' || n || '@example.com',
    'User ' || n,
    (ARRAY['US','UK','DE','FR','JP','AU','CA','BR','IN','MX'])[1 + (n % 10)]
FROM generate_series(1, 100000) AS n;

INSERT INTO products (product_name, category, price_cents)
SELECT
    'Product ' || n,
    (ARRAY['electronics','books','clothing','home','sports'])[1 + (n % 5)],
    (random() * 50000 + 100)::integer
FROM generate_series(1, 1000) AS n;

INSERT INTO orders (user_id, status, order_total_cents, created_at)
SELECT
    1 + (random() * 99999)::integer,
    (ARRAY['pending','confirmed','shipped','delivered'])[1 + (n % 4)],
    (random() * 100000 + 500)::integer,
    now() - (random() * interval '365 days')
FROM generate_series(1, 500000) AS n;

INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
SELECT
    1 + (random() * 499999)::integer,
    1 + (random() * 999)::integer,
    1 + (random() * 5)::integer,
    (random() * 50000 + 100)::integer
FROM generate_series(1, 1500000) AS n;

ANALYZE users;
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
```

The `ANALYZE` at the end updates the statistics the planner uses. Without
fresh stats, plans can be wrong.

---

## EXPLAIN vs EXPLAIN ANALYZE

### EXPLAIN (no ANALYZE)

Shows the plan WITHOUT executing the query. Fast, safe, read-only.

```sql
EXPLAIN SELECT * FROM users WHERE email = 'user42@example.com';
```

```
                                  QUERY PLAN
----------------------------------------------------------------------
 Index Scan using users_email_key on users  (cost=0.42..8.44 rows=1 width=52)
   Index Cond: (email = 'user42@example.com'::text)
```

This tells you: "I'll use the unique index on email, expect to find 1
row, and the estimated cost is 0.42 to 8.44."

### EXPLAIN ANALYZE

Actually executes the query and shows the plan WITH real timing and row
counts.

```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user42@example.com';
```

```
                                  QUERY PLAN
----------------------------------------------------------------------
 Index Scan using users_email_key on users  (cost=0.42..8.44 rows=1 width=52)
                                            (actual time=0.025..0.027 rows=1 loops=1)
   Index Cond: (email = 'user42@example.com'::text)
 Planning Time: 0.085 ms
 Execution Time: 0.045 ms
```

Now you see both the estimate (`rows=1`) and the actual (`rows=1`). When
these diverge significantly, the planner is making decisions based on bad
information.

**Warning:** EXPLAIN ANALYZE actually runs the query. For SELECT, that's
fine. For INSERT/UPDATE/DELETE, it actually modifies data. Wrap mutating
queries in a transaction:

```sql
BEGIN;
EXPLAIN ANALYZE DELETE FROM users WHERE user_id = 1;
ROLLBACK;
```

### EXPLAIN with Extra Options

The most useful combo for debugging:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 42;
```

- **ANALYZE**: real execution times
- **BUFFERS**: how many disk pages were read (shared hit = from cache,
  shared read = from disk)
- **FORMAT TEXT**: human-readable output (the default; alternatives are
  JSON, YAML, XML)

---

## Reading Plans: Bottom to Top

Query plans are trees. The database executes from the innermost (bottom)
nodes up to the root (top). Each node feeds its output to its parent.

```sql
EXPLAIN ANALYZE
SELECT u.full_name, COUNT(*) AS order_count
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE u.country = 'US'
GROUP BY u.full_name
ORDER BY order_count DESC
LIMIT 10;
```

A plan like this might look like:

```
 Limit  (cost=... rows=10)
   ->  Sort  (cost=... rows=10000)
         Sort Key: (count(*)) DESC
         ->  HashAggregate  (cost=... rows=10000)
               Group Key: u.full_name
               ->  Hash Join  (cost=... rows=50000)
                     Hash Cond: (o.user_id = u.user_id)
                     ->  Seq Scan on orders o  (cost=... rows=500000)
                     ->  Hash  (cost=... rows=10000)
                           ->  Seq Scan on users u  (cost=... rows=10000)
                                 Filter: (country = 'US'::text)
```

Read bottom-to-top:

1. **Seq Scan on users** with filter `country = 'US'` -- scans all users,
   keeps those in the US (~10,000 rows)
2. **Hash** -- builds a hash table from those 10,000 users
3. **Seq Scan on orders** -- scans all 500,000 orders
4. **Hash Join** -- for each order, looks up the user in the hash table.
   Keeps only orders that match a US user (~50,000 matches)
5. **HashAggregate** -- groups by `full_name`, counts rows per group
6. **Sort** -- sorts groups by count descending
7. **Limit** -- returns only the first 10 rows

**Analogy — an assembly line:**

The bottom of the plan is the raw material (scanning tables). Each node
is a station on the assembly line that transforms the data: filtering,
joining, grouping, sorting. The top of the plan is the finished product
handed to your application.

---

## Scan Types

The scan type tells you HOW the database reads data from a table.

### Seq Scan (Sequential Scan)

Reads every row in the table, front to back. Like reading a book from
page 1 to the end.

```sql
EXPLAIN SELECT * FROM orders WHERE status = 'pending';
```

If there's no index on `status`, or if a large fraction of rows match,
you'll see a Seq Scan.

**When it's fine:** Small tables, or when you need most of the rows anyway.
**When it's a problem:** Large tables where only a few rows match. You're
reading 500,000 rows to find 100.

### Index Scan

Uses an index to jump directly to matching rows, then reads the actual
table row to get all columns.

```sql
EXPLAIN SELECT * FROM users WHERE email = 'user42@example.com';
```

```
 Index Scan using users_email_key on users  (cost=0.42..8.44 rows=1 width=52)
```

**Analogy:** Looking up a word in a book's index, then turning to the
listed page. Two steps: check the index, then read the page.

### Index Only Scan

Like Index Scan, but the index contains ALL the columns the query needs.
No need to visit the table at all.

```sql
EXPLAIN SELECT email FROM users WHERE email = 'user42@example.com';
```

```
 Index Only Scan using users_email_key on users  (cost=0.42..8.44 rows=1 width=18)
```

The index on `email` already contains the email value, so there's no
reason to read the table row.

**Analogy:** The book's index lists the word AND a short definition.
If that's all you need, you don't even have to turn to the page.

### Bitmap Scan

A two-phase approach: first, scan the index to build a "bitmap" of which
pages contain matching rows. Then, scan those pages in physical order.

```sql
CREATE INDEX idx_orders_status ON orders(status);
EXPLAIN SELECT * FROM orders WHERE status = 'pending';
```

You might see:

```
 Bitmap Heap Scan on orders
   Recheck Cond: (status = 'pending'::text)
   ->  Bitmap Index Scan on idx_orders_status
         Index Cond: (status = 'pending'::text)
```

**When it's used:** When many rows match (too many for an Index Scan to be
efficient) but not so many that a Seq Scan would be better. Also when
combining multiple indexes with BitmapAnd or BitmapOr.

**Analogy:** You're pulling books from a library. Instead of fetching one
book at a time from scattered shelves (Index Scan), you first make a list
of all the shelf locations, sort the list, then walk through the shelves
in order. Fewer trips back and forth.

---

## Cost Estimates

Every plan node shows:

```
(cost=startup_cost..total_cost rows=estimated_rows width=avg_row_bytes)
```

- **startup_cost**: cost before the first row can be returned. A Sort
  node has high startup cost because it must read all input before
  returning anything.
- **total_cost**: cost to return ALL rows. Measured in arbitrary units
  (roughly: 1.0 = one sequential page read).
- **rows**: estimated number of rows this node will output.
- **width**: average size of each output row in bytes.

These are ESTIMATES based on table statistics. Compare them to the
ACTUAL values from EXPLAIN ANALYZE:

```
(cost=0.42..8.44 rows=1 width=52) (actual time=0.025..0.027 rows=1 loops=1)
```

- **actual time**: real milliseconds (startup..total)
- **rows**: actual row count returned
- **loops**: how many times this node was executed (matters for nested
  loops)

**Key insight:** When `rows` (estimated) vs `rows` (actual) are wildly
different, the planner chose a bad plan. Common causes: stale statistics
(run `ANALYZE`), correlated columns, or unusual data distributions.

---

## Common Plan Nodes

### Sort

```
 Sort  (cost=...)
   Sort Key: order_total_cents DESC
   Sort Method: quicksort  Memory: 25kB
```

Sorts the input. If the data fits in memory, it uses quicksort. If not,
it spills to disk (you'll see `external merge Disk: XXkB`), which is
much slower.

**Problem sign:** `Sort Method: external merge  Disk: 500MB` means the
sort was too big for `work_mem` and hit disk. Consider increasing
`work_mem` or adding an index that provides pre-sorted output.

### Hash and Hash Join

```
 Hash Join  (cost=...)
   Hash Cond: (o.user_id = u.user_id)
   ->  Seq Scan on orders o
   ->  Hash
         ->  Seq Scan on users u
```

Builds a hash table from one input (usually the smaller table), then
probes it with rows from the other input. Very fast for equality joins.

### Nested Loop

```
 Nested Loop  (cost=...)
   ->  Index Scan on users u  (rows=1)
   ->  Index Scan on orders o  (rows=5)
         Index Cond: (o.user_id = u.user_id)
```

For each row from the outer input, scan the inner input. Good when the
outer input is small and the inner has an index. Bad when both inputs are
large (N x M row comparisons).

### Merge Join

```
 Merge Join  (cost=...)
   Merge Cond: (u.user_id = o.user_id)
   ->  Sort on users
   ->  Sort on orders
```

Both inputs must be sorted on the join key. Then it zips through them
like merging two sorted lists. Good for large joins where both sides are
already sorted (or can be sorted efficiently).

### Aggregate / HashAggregate / GroupAggregate

Aggregation nodes compute `COUNT`, `SUM`, `AVG`, etc. HashAggregate
groups by building a hash table of groups. GroupAggregate expects
pre-sorted input and groups sequentially.

### Limit

```
 Limit  (cost=0.42..4.18 rows=10)
```

Stops execution after returning N rows. Can dramatically reduce the work
done by lower nodes -- if the lower node can produce rows incrementally
(like an Index Scan), Limit stops early. If the lower node must finish
before producing any output (like a Sort), Limit can't help until the
Sort is done.

---

## How to Spot Problems

### Problem 1: Seq Scan on a Large Table with Few Matching Rows

```
 Seq Scan on orders  (cost=0.00..15406.00 rows=127 width=44)
   Filter: (user_id = 42)
   Rows Removed by Filter: 499873
```

Reading 500,000 rows to find 127. An index on `user_id` would eliminate
the Seq Scan.

```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

Re-run the EXPLAIN and you'll see an Index Scan instead.

### Problem 2: Bad Row Estimates

```
 Hash Join  (cost=... rows=10) (actual ... rows=150000)
```

The planner estimated 10 rows but got 150,000. Everything downstream
(memory allocation, join strategy, sort method) was based on that bad
estimate. Fix: run `ANALYZE` on the table, or check if you're hitting
a known statistics limitation (like correlated columns).

```sql
ANALYZE orders;
```

### Problem 3: Sort Spilling to Disk

```
 Sort  (cost=...)
   Sort Method: external merge  Disk: 125MB
```

The data didn't fit in `work_mem`. Options:
- Increase `work_mem` for this session: `SET work_mem = '256MB';`
- Add an index that provides pre-sorted output
- Reduce the data being sorted (filter earlier)

### Problem 4: Nested Loop on Large Inputs

```
 Nested Loop  (cost=...) (actual time=... rows=... loops=1)
   ->  Seq Scan on users  (rows=100000)
   ->  Seq Scan on orders  (rows=500000 loops=100000)
```

100,000 x 500,000 = 50 billion row comparisons. A Hash Join or Merge
Join would be far better. This usually happens when the planner has bad
row estimates for the outer table.

---

## Practical: Analyzing 5 Queries

### Query 1: Simple lookup by primary key

```sql
EXPLAIN ANALYZE
SELECT * FROM users WHERE user_id = 42;
```

You should see an **Index Scan** using the primary key index. This is as
fast as it gets. Cost will be very low, actual time under 1ms.

### Query 2: Filter on an unindexed column

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'shipped' AND order_total_cents > 50000;
```

Likely a **Seq Scan** or **Bitmap Scan** (if the index on `status` was
created earlier). Note the `Rows Removed by Filter` to see how many rows
were read but discarded.

Now add a targeted index and compare:

```sql
CREATE INDEX idx_orders_status_total ON orders(status, order_total_cents);

EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'shipped' AND order_total_cents > 50000;
```

The scan type should change and execution time should drop.

### Query 3: Join with aggregation

```sql
EXPLAIN ANALYZE
SELECT u.country, COUNT(*) AS order_count, AVG(o.order_total_cents) AS avg_total
FROM users u
JOIN orders o ON u.user_id = o.user_id
GROUP BY u.country
ORDER BY order_count DESC;
```

Look for: which join type was chosen (Hash Join is common here), how the
aggregation is done (HashAggregate), and whether the Sort for ORDER BY
uses memory or disk.

### Query 4: Subquery vs JOIN

Compare these two equivalent queries:

```sql
EXPLAIN ANALYZE
SELECT * FROM users
WHERE user_id IN (SELECT user_id FROM orders WHERE status = 'delivered');

EXPLAIN ANALYZE
SELECT DISTINCT u.*
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.status = 'delivered';
```

Postgres often transforms the subquery into a join internally. The plans
may look similar. But sometimes they diverge, especially with correlated
subqueries. Compare the execution times.

### Query 5: Expensive sort with LIMIT

```sql
EXPLAIN ANALYZE
SELECT *
FROM orders
ORDER BY order_total_cents DESC
LIMIT 10;
```

Without an index on `order_total_cents`, this requires sorting all 500,000
rows just to return 10. The Sort node will show the method used.

Now add an index:

```sql
CREATE INDEX idx_orders_total_desc ON orders(order_total_cents DESC);

EXPLAIN ANALYZE
SELECT *
FROM orders
ORDER BY order_total_cents DESC
LIMIT 10;
```

With the index, the planner can use an **Index Scan** that produces rows
in sorted order. Combined with Limit, it stops after reading just 10 rows
from the index. Massive improvement.

---

## EXPLAIN Cheat Sheet

| What you see | What it means | What to do |
|---|---|---|
| Seq Scan with many Rows Removed | Full table scan, discarding most rows | Add an index on the filter column |
| estimated rows vs actual rows differ 10x+ | Bad statistics | Run ANALYZE, check for correlated columns |
| Sort Method: external merge Disk | Sort spilled to disk | Increase work_mem or add an index |
| Nested Loop with large outer input | O(N*M) join | Check if a Hash Join or Merge Join would be better |
| Bitmap Heap Scan with many Recheck rows | Lossy bitmap scan | May need a more selective index |
| Index Scan returning most of the table | Index overhead with no benefit | Let it Seq Scan, or restructure the query |

---

## Exercises

**Exercise 1: Read a plan**

Run this query with EXPLAIN ANALYZE and answer: What scan type is used
for each table? What join type is used? How many rows did each node
estimate vs actually produce?

```sql
EXPLAIN ANALYZE
SELECT p.product_name, SUM(oi.quantity) AS total_sold
FROM products p
JOIN order_items oi ON p.product_id = oi.product_id
WHERE p.category = 'electronics'
GROUP BY p.product_name
ORDER BY total_sold DESC
LIMIT 5;
```

**Exercise 2: Fix a slow query**

Run this query with EXPLAIN ANALYZE. Identify the bottleneck node (the
one consuming the most time). Create an index to fix it, and show the
before/after plans.

```sql
SELECT o.order_id, o.created_at, u.email
FROM orders o
JOIN users u ON o.user_id = u.user_id
WHERE o.created_at > now() - interval '30 days'
  AND o.status = 'pending';
```

**Exercise 3: Estimate vs actual**

Run `EXPLAIN ANALYZE` on several queries and find one where the estimated
row count is off by more than 5x from the actual count. Why might the
planner be wrong? What can you do about it?

**Exercise 4: Sort behavior**

Run this query with different `work_mem` settings and observe how the
Sort method changes:

```sql
SET work_mem = '64kB';
EXPLAIN ANALYZE SELECT * FROM orders ORDER BY order_total_cents;

SET work_mem = '64MB';
EXPLAIN ANALYZE SELECT * FROM orders ORDER BY order_total_cents;

RESET work_mem;
```

What Sort Method does each use? How does execution time change?

**Exercise 5: BUFFERS**

Run the same query twice with `EXPLAIN (ANALYZE, BUFFERS)`:

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE order_id = 42;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE order_id = 42;
```

Compare the `shared hit` and `shared read` counts between the first and
second run. What changed and why?

---

Next: [Lesson 12: Index Strategies — When, What, and When NOT to Index](./12-index-strategies.md)
