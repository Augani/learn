# Lesson 02: How Data Lives on Disk — Pages, Rows, and Storage

When you INSERT a row, what ACTUALLY happens on your hard drive? This
lesson goes under the hood.

---

## The Big Picture

Your data's journey: SQL → memory → disk.

```
INSERT INTO users (name) VALUES ('Alice');

1. Postgres receives the SQL
2. Finds (or creates) space in a PAGE in memory
3. Writes the row into that page
4. Writes to the WAL (crash safety journal)
5. Eventually flushes the page to the data file on disk
```

---

## Pages — The Fundamental Unit

Postgres does NOT read or write individual rows. It reads and writes
**pages** (also called blocks). A page is always **8 KB** (8192 bytes).

**Analogy — a filing cabinet:**
- The **table** is a filing cabinet
- Each **drawer** is a page (8 KB)
- Each **folder** in a drawer is a row
- You can't pull out a single folder without opening the drawer

When Postgres needs one row, it reads the entire 8 KB page that contains
it into memory. This is by design — disk I/O is expensive, and reading
a full page is nearly as fast as reading a single byte.

```
Table file on disk:
┌──────────┬──────────┬──────────┬──────────┐
│  Page 0  │  Page 1  │  Page 2  │  Page 3  │  ...
│  8 KB    │  8 KB    │  8 KB    │  8 KB    │
│          │          │          │          │
│ row 1    │ row 15   │ row 28   │ row 41   │
│ row 2    │ row 16   │ row 29   │ row 42   │
│ ...      │ ...      │ ...      │ ...      │
│ row 14   │ row 27   │ row 40   │ row 53   │
└──────────┴──────────┴──────────┴──────────┘
```

### Seeing pages in action

```sql
-- Create a table and insert data
CREATE TABLE page_demo (
    id SERIAL PRIMARY KEY,
    name TEXT,
    data TEXT
);

INSERT INTO page_demo (name, data)
SELECT
    'user_' || i,
    repeat('x', 100)  -- 100 bytes per row
FROM generate_series(1, 1000) AS i;

-- How many pages does this table use?
SELECT
    pg_relation_size('page_demo') AS bytes,
    pg_relation_size('page_demo') / 8192 AS pages,
    pg_size_pretty(pg_relation_size('page_demo')) AS human_readable
FROM page_demo LIMIT 1;

-- See which page each row lives on
SELECT ctid, id, name FROM page_demo LIMIT 20;
-- ctid = (page_number, row_number_within_page)
-- (0,1) means page 0, slot 1
-- (2,15) means page 2, slot 15
```

The `ctid` column is the physical location of each row. It's not something
you use in application code, but it shows you exactly where data lives.

---

## Inside a Page

Each 8 KB page has this layout:

```
┌─────────────────────────────────────────┐
│ Page Header (24 bytes)                  │ ← metadata: checksum, free space info
├─────────────────────────────────────────┤
│ Item Pointers (4 bytes each)            │ ← array of offsets pointing to row data
│ [ptr1] [ptr2] [ptr3] [ptr4] ...        │    grows downward ↓
├─────────────────────────────────────────┤
│                                         │
│           Free Space                    │ ← empty space for new rows
│                                         │
├─────────────────────────────────────────┤
│ Row Data                                │ ← actual row contents
│ (stored from bottom, growing upward ↑)  │    grows upward ↑
│ [row4 data] [row3 data] [row2 data]... │
├─────────────────────────────────────────┤
│ Special Space (optional)                │ ← used by indexes
└─────────────────────────────────────────┘
```

**Analogy — a notebook page:**
- Top of the page: table of contents (item pointers)
- Bottom of the page: actual notes (row data)
- They grow toward each other from opposite ends
- When they meet in the middle, the page is full

Why this design? Item pointers let Postgres move row data within a page
(for compaction) without changing any external references. The pointer
gets updated, but the pointer's position stays the same.

---

## Row Layout (Tuple Structure)

Each row on disk looks like:

```
┌──────────────────────────────────────┐
│ Tuple Header (23 bytes)              │
│  - xmin: transaction that created it │
│  - xmax: transaction that deleted it │
│  - field null bitmap                 │
├──────────────────────────────────────┤
│ Column 1 data                        │
│ Column 2 data                        │
│ Column 3 data                        │
│ ...                                  │
└──────────────────────────────────────┘
```

Each row carries a **23-byte header** of overhead. This means:
- A table with a single `INTEGER` column (4 bytes) uses 27+ bytes per row
- Overhead matters for very small rows
- Row headers store version info for MVCC (more in Lesson 14)

### Null values are (almost) free

Nulls don't take space for the value — just a bit in the null bitmap.
This is why NULL is different from empty string or 0.

---

## TOAST — Handling Large Values

What if a single column value is larger than a page (8 KB)? Postgres
uses **TOAST** (The Oversized-Attribute Storage Technique).

```
Regular row:  [header] [name: "Alice"] [bio: "Short bio"]
                        ^small           ^small → fits in page

TOASTed row:  [header] [name: "Alice"] [bio: TOAST_POINTER → separate storage]
                                        ^large → stored separately, compressed
```

**Analogy:** If a folder is too fat for the drawer, you put a note in the
drawer saying "see overflow cabinet #7" and store the big document elsewhere.

```sql
-- See TOAST in action
CREATE TABLE big_data (
    id SERIAL PRIMARY KEY,
    content TEXT
);

-- Insert a large value (100KB of text)
INSERT INTO big_data (content) VALUES (repeat('hello ', 20000));

-- See the table size vs TOAST size
SELECT
    pg_size_pretty(pg_relation_size('big_data')) AS table_size,
    pg_size_pretty(pg_total_relation_size('big_data')) AS total_with_toast;
```

TOAST automatically compresses large values and stores them separately.
You never interact with it directly — it's invisible.

---

## The Buffer Cache — Memory as a Fast Lane

Reading from disk is **slow** (~10ms for spinning disk, ~0.1ms for SSD).
Reading from RAM is **fast** (~0.0001ms). That's 1000x difference.

Postgres keeps recently accessed pages in a memory area called the
**shared buffer cache**.

```
Your query: SELECT * FROM users WHERE id = 42
                │
                ▼
        ┌─────────────────┐
        │  Buffer Cache    │  ← is page in memory?
        │  (shared_buffers)│     YES → return it (fast!)
        └────────┬────────┘     NO → read from disk, put in cache
                 │
                 ▼ (cache miss)
        ┌─────────────────┐
        │  Disk           │  ← read the 8 KB page
        │  (data files)   │
        └─────────────────┘
```

**Analogy — a chef's counter vs the pantry:**
- **Buffer cache** = ingredients on the counter. Instant access.
- **Disk** = ingredients in the pantry. Takes time to walk over and grab them.
- Popular ingredients stay on the counter. Rarely used ones stay in the pantry.

```sql
-- See buffer cache configuration
SHOW shared_buffers;  -- typically 25% of total RAM

-- See cache hit ratio (should be >99%)
SELECT
    sum(heap_blks_read) AS disk_reads,
    sum(heap_blks_hit) AS cache_hits,
    round(
        sum(heap_blks_hit) * 100.0 /
        NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2
    ) AS cache_hit_ratio
FROM pg_statio_user_tables;
```

A well-tuned database has a cache hit ratio above 99% — meaning 99% of
page reads come from memory, not disk.

---

## Table Files on Disk

You can actually see the files Postgres stores your data in:

```sql
-- Find the file path for a table
SELECT pg_relation_filepath('page_demo');
-- Returns something like: base/16384/16385
```

```bash
# On macOS with Homebrew Postgres:
ls -la /opt/homebrew/var/postgresql@17/base/*/
```

Each table is one or more files. As a table grows beyond 1 GB, Postgres
splits it into multiple files (segments).

---

## Why This Matters for You

Understanding pages and storage explains:

1. **Why indexes matter** — without one, Postgres reads EVERY page (sequential scan)
2. **Why SELECT * is wasteful** — each column adds bytes per row, filling pages faster
3. **Why VACUUM exists** — deleted rows leave dead space in pages (Lesson 14)
4. **Why row size matters** — fat rows = fewer rows per page = more I/O
5. **Why caching works** — hot data stays in memory, cold data on disk

---

## Exercises

### Exercise 1: Measure row density
```sql
-- Create a table, insert 10,000 rows
-- Check how many pages it uses
-- Then add a TEXT column with 500 bytes per row
-- Check pages again — how much did it grow?
```

### Exercise 2: Watch ctid change
```sql
-- Insert a row, note its ctid
-- UPDATE the row
-- Check ctid again — did it change? Why?
-- (Hint: Postgres creates a NEW version of the row)
```

### Exercise 3: Cache hit ratio
```sql
-- Query pg_statio_user_tables before and after running
-- many queries on a table. Watch the cache hit ratio.
```

---

## Key Takeaways

1. **Pages (8 KB blocks)** are the fundamental unit — Postgres never reads single rows.
2. **Rows have 23+ bytes of overhead** — tiny tables waste a lot of space proportionally.
3. **Buffer cache** keeps hot pages in RAM — disk reads are a last resort.
4. **TOAST** handles large values transparently by compressing and storing separately.
5. **Understanding pages** is key to understanding why indexes, vacuuming,
   and query optimization work the way they do.

Next: [Lesson 03 — Indexes](./03-indexes.md)
