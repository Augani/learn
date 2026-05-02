# Lesson 03: Indexes — The Single Most Important Concept

If you learn ONE thing from this entire database course, learn indexes.
They're the difference between a query taking 5 milliseconds and 5 minutes.

---

## The Problem Without Indexes

```sql
SELECT * FROM users WHERE email = 'alice@example.com';
```

Without an index, Postgres must do a **sequential scan** — read EVERY page
of the table, check EVERY row, looking for a match.

| Table size | Pages | Time (SSD) | Time (spinning disk) |
|-----------|-------|-----------|---------------------|
| 1,000 rows | ~10 | <1ms | ~1ms |
| 100,000 rows | ~1,000 | ~10ms | ~100ms |
| 10,000,000 rows | ~100,000 | ~1 second | ~10 seconds |
| 1,000,000,000 rows | ~10,000,000 | ~100 seconds | ~15 minutes |

**Analogy:** Finding a phone number in a phone book by reading every single
entry from the beginning vs looking up the name in the alphabetical index.

---

## What an Index Is

An index is a **separate data structure** stored alongside your table that
maps column values to row locations. It's like the index at the back of a
textbook.

```
Table (heap):                     Index on email:
Page 0: [id=1, email=zara@...]    alice@... → Page 2, Slot 3
Page 1: [id=2, email=mike@...]    bob@...   → Page 0, Slot 5
Page 2: [id=3, email=alice@...]   mike@...  → Page 1, Slot 1
         ...                      zara@...  → Page 0, Slot 1
                                  (sorted alphabetically)
```

With the index, finding `alice@example.com`:
1. Look up "alice@..." in the index → Page 2, Slot 3
2. Read Page 2, get the row
3. Done. Two reads instead of scanning everything.

---

## B-Tree — The Default Index Type

When you create an index in Postgres, it's a **B-tree** by default.

### What's a B-tree?

Think of a library's card catalog (or a more modern analogy: a phone's
contacts app).

Your contacts aren't stored as a flat list you scroll through. They're
organized by first letter, then further subdivided:

```
                    [M]
                   /   \
              [D, H]    [R, V]
             / |  \     / |  \
          [A-C][E-G][I-L][N-Q][S-U][W-Z]
           │    │    │    │    │    │
          rows rows rows rows rows rows
```

To find "Mike":
1. Start at root: M? Go right
2. Next level: R? Mike < R, go left
3. Next level: N-Q? Mike < N, go to the previous leaf
4. Scan the leaf: found Mike!

**That's 3 steps to search millions of entries.** A B-tree with 10 million
entries is typically only 3-4 levels deep. That means 3-4 page reads to
find anything.

### B-tree properties

- **Balanced** — every path from root to leaf is the same length
- **Sorted** — data in leaves is ordered, enabling range queries
- **Self-balancing** — insertions and deletions keep it balanced
- **Wide** — each node holds many keys (hundreds), not just 2

---

## Creating Indexes

```sql
-- Setup: create a table with a million rows
CREATE TABLE users (
    id    SERIAL PRIMARY KEY,     -- PRIMARY KEY automatically creates an index
    name  TEXT NOT NULL,
    email TEXT NOT NULL,
    age   INTEGER,
    city  TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (name, email, age, city)
SELECT
    'User ' || i,
    'user' || i || '@example.com',
    (random() * 80 + 18)::integer,
    (ARRAY['New York', 'London', 'Tokyo', 'Paris', 'Berlin'])[floor(random() * 5 + 1)::int]
FROM generate_series(1, 1000000) AS i;

-- Check: query WITHOUT index
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user500000@example.com';
-- You'll see: Seq Scan (sequential scan) — reads all pages

-- Create an index
CREATE INDEX idx_users_email ON users (email);

-- Check: query WITH index
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user500000@example.com';
-- You'll see: Index Scan — jumps straight to the row
-- Time drops from ~100ms to <1ms
```

### What EXPLAIN ANALYZE shows you

```
Index Scan using idx_users_email on users  (cost=0.42..8.44 rows=1 width=52)
  Index Cond: (email = 'user500000@example.com'::text)
Planning Time: 0.087 ms
Execution Time: 0.031 ms     ← fast!
```

vs without index:

```
Seq Scan on users  (cost=0.00..20834.00 rows=1 width=52)
  Filter: (email = 'user500000@example.com'::text)
Planning Time: 0.069 ms
Execution Time: 95.432 ms    ← 3000x slower
```

---

## Index Types

### B-tree (default) — for most things

```sql
CREATE INDEX idx_users_email ON users (email);
-- Good for: =, <, >, <=, >=, BETWEEN, IN, IS NULL
-- Good for: ORDER BY (index is already sorted)
-- Good for: LIKE 'prefix%' (but NOT '%suffix')
```

### Hash — for equality only

```sql
CREATE INDEX idx_users_email_hash ON users USING hash (email);
-- Good for: = only
-- Slightly faster than B-tree for pure equality
-- Cannot do range queries, sorting, or partial matches
```

### GIN (Generalized Inverted Index) — for arrays, JSONB, full-text

```sql
-- For JSONB columns
CREATE INDEX idx_data_gin ON documents USING gin (data);

-- For array columns
CREATE INDEX idx_tags_gin ON posts USING gin (tags);

-- For full-text search
CREATE INDEX idx_search ON articles USING gin (to_tsvector('english', body));
```

**Analogy:** A B-tree is like a phone book (one entry per person). A GIN
index is like a book's back-of-book index — one entry per WORD, pointing
to all pages where that word appears. Perfect for "find all documents
containing the word X."

### GiST — for geometric/spatial data

```sql
CREATE INDEX idx_location ON places USING gist (coordinates);
-- For: nearest neighbor, contains, overlaps, distance queries
```

---

## Composite Indexes (multiple columns)

```sql
CREATE INDEX idx_users_city_age ON users (city, age);
```

This index is like a phone book sorted by **city first, then age within
each city**.

```
City      | Age | Row pointer
----------|-----|------------
Berlin    | 18  | → Page 5, Slot 3
Berlin    | 25  | → Page 12, Slot 1
Berlin    | 42  | → Page 7, Slot 8
London    | 19  | → Page 3, Slot 2
London    | 31  | → Page 9, Slot 5
...
```

**The leftmost column matters most:**

```sql
-- Uses the index (starts with city):
SELECT * FROM users WHERE city = 'London';
SELECT * FROM users WHERE city = 'London' AND age > 25;

-- Does NOT use the index efficiently (skips city):
SELECT * FROM users WHERE age > 25;
-- This is like searching a phone book by first name when it's sorted by last name
```

**Rule:** A composite index on `(A, B, C)` can efficiently answer queries
on `A`, `A+B`, or `A+B+C`. NOT on `B`, `C`, or `B+C` alone.

---

## Unique Indexes

```sql
CREATE UNIQUE INDEX idx_users_email_unique ON users (email);

-- Or equivalently:
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
```

Both create an index AND enforce uniqueness. Primary keys automatically
create unique indexes.

---

## The Cost of Indexes

Indexes aren't free. Every index:

1. **Takes disk space** — roughly the size of the indexed columns
2. **Slows down writes** — every INSERT/UPDATE/DELETE must update all indexes
3. **Needs maintenance** — bloated indexes slow down reads

```sql
-- See index sizes
SELECT
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Rule of thumb:** Index columns you search on (WHERE), join on (JOIN),
and sort on (ORDER BY). Don't index columns you never filter by.

---

## Exercises

### Exercise 1: Measure the difference
```sql
-- Create a 1M row table
-- Run a SELECT with EXPLAIN ANALYZE (no index)
-- Create an index
-- Run the same query — compare execution times
```

### Exercise 2: Composite index order
```sql
-- Create a table with columns: country, city, name
-- Insert 100K rows
-- Create index on (country, city)
-- Test these queries with EXPLAIN ANALYZE:
--   WHERE country = 'US'
--   WHERE city = 'London'
--   WHERE country = 'US' AND city = 'NYC'
-- Which ones use the index?
```

### Exercise 3: Index overhead
```sql
-- Create a table with 500K rows
-- Measure insert speed (INSERT 10,000 rows, time it)
-- Create 5 indexes on different columns
-- Measure insert speed again — how much slower?
```

---

## Key Takeaways

1. **Without indexes = sequential scan = read everything.** This is the #1
   performance problem in databases.
2. **B-tree is the default** and handles 90% of use cases.
3. **Composite indexes** must be queried left-to-right.
4. **Indexes cost disk space and slow writes** — index strategically, not everything.
5. **EXPLAIN ANALYZE** is how you verify an index is being used.
6. **PRIMARY KEY automatically creates an index.** UNIQUE constraints do too.

Next: [Lesson 04 — How a Query Executes](./04-query-execution.md)
