# Lesson 04: How a Query Executes — From Text to Results

When you send `SELECT * FROM users WHERE age > 25`, what happens inside
Postgres between receiving your text and returning rows?

---

## The Five Stages

```
SQL Text
  │
  ▼
┌─────────────┐
│ 1. PARSER   │  ← "Is this valid SQL?"
└──────┬──────┘    Turns text into a parse tree
       │
       ▼
┌─────────────┐
│ 2. ANALYZER │  ← "Do these tables and columns exist?"
└──────┬──────┘    Resolves names, checks types
       │
       ▼
┌─────────────┐
│ 3. PLANNER  │  ← "What's the fastest way to get this data?"
└──────┬──────┘    Considers indexes, joins, sort strategies
       │
       ▼
┌─────────────┐
│ 4. EXECUTOR │  ← "Go get the data."
└──────┬──────┘    Reads pages, applies filters, returns rows
       │
       ▼
  Results (rows)
```

**Analogy — ordering a custom PC online:**
1. **Parser** = the website checks your order form is filled out correctly
2. **Analyzer** = verifies the parts you picked actually exist in the catalog
3. **Planner** = the warehouse figures out the fastest way to assemble it
   (pick parts from nearby shelves first, batch similar orders)
4. **Executor** = workers actually walk the shelves, grab parts, assemble, ship

---

## Stage 1: Parsing

The parser turns SQL text into a structured tree:

```sql
SELECT name, age FROM users WHERE age > 25 ORDER BY name;
```

Becomes (conceptually):

```
SelectStatement
├── target_list: [name, age]
├── from: users
├── where: age > 25
└── order_by: name ASC
```

If your SQL has a syntax error, the parser catches it:

```sql
SELECT * FORM users;  -- typo: FORM instead of FROM
-- ERROR: syntax error at or near "users"
```

---

## Stage 2: Analysis

The analyzer resolves names:
- Does the table `users` exist?
- Does it have columns `name` and `age`?
- Is `age` a type that supports `>` comparison?
- Does the current user have permission to read this table?

```sql
SELECT * FROM nonexistent_table;
-- ERROR: relation "nonexistent_table" does not exist

SELECT bogus_column FROM users;
-- ERROR: column "bogus_column" does not exist
```

---

## Stage 3: Planning (the interesting part)

The planner is where the magic happens. Given your query, the planner
considers multiple strategies and picks the cheapest one.

### Example: finding users older than 25

**Strategy A: Sequential Scan**
- Read every page of the users table
- Check each row: is age > 25?
- Cost: proportional to table size

**Strategy B: Index Scan (if index on age exists)**
- Look up age > 25 in the index
- Jump to the exact pages containing matching rows
- Cost: proportional to matching rows

**Strategy C: Bitmap Index Scan**
- Use the index to build a bitmap of matching pages
- Read only those pages
- Cost: between sequential and index scan

The planner estimates the cost of each strategy and picks the cheapest.
It uses **statistics** about your data (how many rows, how values are
distributed) to make these estimates.

### Seeing the plan: EXPLAIN

```sql
-- Show the plan WITHOUT executing
EXPLAIN SELECT * FROM users WHERE age > 25;

-- Show the plan AND execute (with actual timing)
EXPLAIN ANALYZE SELECT * FROM users WHERE age > 25;

-- Pretty format with buffers info
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM users WHERE age > 25;
```

### Reading EXPLAIN output

```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user42@example.com';
```

```
Index Scan using idx_users_email on users  (cost=0.42..8.44 rows=1 width=52) (actual time=0.025..0.026 rows=1 loops=1)
  Index Cond: (email = 'user42@example.com'::text)
Planning Time: 0.087 ms
Execution Time: 0.045 ms
```

Breaking this down:

| Part | Meaning |
|------|---------|
| `Index Scan` | The strategy chosen |
| `using idx_users_email` | Which index |
| `cost=0.42..8.44` | Estimated cost (startup..total) — arbitrary units |
| `rows=1` | Estimated row count |
| `width=52` | Estimated bytes per row |
| `actual time=0.025..0.026` | Real time in ms (start..end) |
| `rows=1` (after actual) | Actual rows returned |
| `loops=1` | How many times this node ran |

### Common scan types

| Scan Type | When used | Speed |
|-----------|-----------|-------|
| **Seq Scan** | No useful index, or selecting most of the table | Slow for large tables |
| **Index Scan** | Index exists, few rows match | Fast |
| **Index Only Scan** | All needed columns are in the index | Fastest |
| **Bitmap Index Scan** | Index exists, moderate number of rows match | Medium |
| **Bitmap Heap Scan** | After bitmap scan, reads actual rows | Medium |

---

## Stage 4: Execution

The executor follows the plan. Plans are trees of operations:

```sql
EXPLAIN SELECT u.name, COUNT(o.id)
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.city = 'London'
GROUP BY u.name
ORDER BY COUNT(o.id) DESC
LIMIT 10;
```

```
Limit
  └── Sort (by count DESC)
        └── HashAggregate (GROUP BY name)
              └── Hash Join (users.id = orders.user_id)
                    ├── Seq Scan on orders
                    └── Index Scan on users (city = 'London')
```

Execution flows from **bottom to top**:
1. First: scan users where city = 'London' (using index)
2. Then: scan all orders (seq scan)
3. Then: hash join them together
4. Then: group by name, count
5. Then: sort by count
6. Finally: take top 10

---

## The Statistics Postgres Uses

The planner makes decisions based on statistics about your data:

```sql
-- See statistics for a column
SELECT
    attname AS column,
    n_distinct,       -- how many distinct values (-1 = all unique)
    most_common_vals, -- most frequently occurring values
    most_common_freqs -- how often each common value appears
FROM pg_stats
WHERE tablename = 'users' AND attname = 'city';
```

Postgres automatically collects statistics via `ANALYZE`:

```sql
-- Manually update statistics (usually automatic)
ANALYZE users;
```

**Why this matters:** If statistics are stale (after bulk inserts/deletes),
the planner might choose a bad strategy. Running `ANALYZE` fixes this.

---

## Join Strategies

When joining two tables, Postgres has three strategies:

### Nested Loop Join

```
For each row in table A:
    For each row in table B:
        If they match: output
```

**Analogy:** For each name on list A, scan through all of list B looking
for matches. Slow for large tables, fast when one table is tiny.

### Hash Join

```
1. Build a hash table from the smaller table
2. Scan the larger table, look up each row in the hash table
```

**Analogy:** First, organize list B into a filing cabinet by key. Then go
through list A — for each entry, immediately find the match in the cabinet.
Fast for large tables.

### Merge Join

```
1. Sort both tables by the join key
2. Walk through both sorted lists simultaneously
```

**Analogy:** Two people each holding a sorted list, reading through them
together in order. When the entries match, pair them up. Great when data
is already sorted (e.g., via an index).

---

## Exercises

### Exercise 1: Read an EXPLAIN plan
```sql
-- Run EXPLAIN ANALYZE on these queries and interpret the output:
EXPLAIN ANALYZE SELECT * FROM users WHERE id = 500000;
EXPLAIN ANALYZE SELECT * FROM users WHERE city = 'London';
EXPLAIN ANALYZE SELECT * FROM users WHERE age BETWEEN 20 AND 30;
EXPLAIN ANALYZE SELECT * FROM users ORDER BY created_at DESC LIMIT 10;

-- For each: What scan type? How many rows? How long?
```

### Exercise 2: Watch the planner change strategies
```sql
-- Without index on age:
EXPLAIN ANALYZE SELECT * FROM users WHERE age = 25;
-- Create index on age:
CREATE INDEX idx_users_age ON users (age);
-- Run the same query — what changed?
EXPLAIN ANALYZE SELECT * FROM users WHERE age = 25;
```

### Exercise 3: Join strategies
```sql
-- Create an orders table, insert 100K orders
-- Join users and orders with EXPLAIN ANALYZE
-- Try with and without indexes on the join column
-- What join strategy does Postgres choose each time?
```

---

## Key Takeaways

1. **Parse → Analyze → Plan → Execute** — four stages for every query.
2. **The planner is the brain** — it picks the best strategy based on statistics.
3. **EXPLAIN ANALYZE** is your window into what the database is actually doing.
4. **Seq Scan = bad for large tables.** Index Scan = good.
5. **Statistics must be fresh** — `ANALYZE` updates them (usually automatic).
6. **Three join strategies:** nested loop, hash, merge. Planner picks the best.
7. **Read plans bottom to top** — execution flows upward.

Next: [Lesson 05 — Tables, Types, and Your First Queries](./05-tables-and-types.md)
