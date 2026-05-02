# Lesson 14: Concurrency — MVCC, Locks, and Isolation Levels

Your database doesn't serve one user at a time. Hundreds or thousands
of connections are reading and writing simultaneously. How does Postgres
let them all work without stepping on each other?

The naive answer is "lock everything" — but then your database can only
serve one request at a time. Postgres uses a much smarter system called
MVCC (Multi-Version Concurrency Control) that lets readers and writers
coexist peacefully.

---

## The Problem: Concurrent Access

Imagine a library with one copy of a popular book. Reader A is reading
chapter 3. Editor B wants to update chapter 3 with corrections. Without
a system:

- If B edits the page while A is reading it, A sees garbled text (half
  old, half new)
- If A locks the book while reading, B has to wait — and so does every
  other reader

**Postgres's solution:** give A and B each their own version of chapter 3.
A reads the old version. B creates the new version. When B finishes
(commits), future readers see the new version. A keeps reading the old
version undisturbed.

This is MVCC.

---

## MVCC: Multi-Version Concurrency Control

MVCC means Postgres doesn't update a row in place. Instead, it creates
a NEW version of the row and marks the OLD version as obsolete. Multiple
versions of the same row exist simultaneously.

**Analogy — Google Docs version history:**
When someone edits a Google Doc, the old version isn't destroyed. It
goes into version history. You can still view any previous version.
MVCC works the same way: old row versions stick around so that ongoing
transactions can still see them.

### How It Works: xmin and xmax

Every row in Postgres has hidden system columns. The two most important
for MVCC:

| Column | Meaning |
|--------|---------|
| `xmin` | The transaction ID that **created** this row version |
| `xmax` | The transaction ID that **deleted or replaced** this row version (0 if still current) |

```sql
-- You can actually see these hidden columns
CREATE TABLE mvcc_demo (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    val  INTEGER NOT NULL
);

INSERT INTO mvcc_demo (name, val) VALUES ('alpha', 10);

SELECT xmin, xmax, id, name, val FROM mvcc_demo;
```

```
  xmin  | xmax | id | name  | val
--------+------+----+-------+-----
 100042 |    0 |  1 | alpha |  10
```

The `xmin` is the transaction ID that inserted this row. `xmax` is 0,
meaning no transaction has deleted or replaced it yet.

Now update the row:

```sql
UPDATE mvcc_demo SET val = 20 WHERE name = 'alpha';

SELECT xmin, xmax, id, name, val FROM mvcc_demo;
```

```
  xmin  | xmax | id | name  | val
--------+------+----+-------+-----
 100043 |    0 |  1 | alpha |  20
```

Notice `xmin` changed. That's because an UPDATE in Postgres is actually
a DELETE of the old row + INSERT of a new row. The old row (xmin=100042)
now has its xmax set to 100043 (the transaction that replaced it). You
can't see it anymore because it's been superseded, but it still exists
on disk until VACUUM cleans it up.

### Transaction Snapshots

When a transaction starts (under the default isolation level), it takes
a snapshot: "Which transactions are committed right now?" This snapshot
determines which row versions are visible.

A row version is visible to your transaction if:
1. Its `xmin` is a committed transaction that committed before your snapshot
2. Its `xmax` is either 0 (not deleted) or belongs to a transaction that
   hasn't committed yet

**Analogy — a photograph:**
Your transaction snapshot is a photograph of the database at a point in
time. Other people can change the room after the photo is taken, but
your photo shows what was there when you clicked the shutter.

---

## Readers Don't Block Writers. Writers Don't Block Readers.

This is the golden rule of MVCC and the single biggest advantage over
simple locking systems.

- **A SELECT never waits for an UPDATE.** The SELECT reads the old row
  version while the UPDATE creates a new one.
- **An UPDATE never waits for a SELECT.** The UPDATE creates a new
  version; the SELECT keeps reading the old one.

The only time transactions block each other is when two transactions try
to UPDATE or DELETE the **same row** at the **same time**. Then the second
one has to wait for the first to commit or rollback.

```
Session A (writer):                 Session B (reader):

BEGIN;
                                    BEGIN;
UPDATE mvcc_demo
  SET val = 30
  WHERE name = 'alpha';
                                    -- This does NOT block!
                                    SELECT val FROM mvcc_demo
                                      WHERE name = 'alpha';
                                    -- Returns 20 (the old version)
                                    -- Session A hasn't committed yet

COMMIT;
                                    -- Now if Session B queries again:
                                    SELECT val FROM mvcc_demo
                                      WHERE name = 'alpha';
                                    -- Returns 30 (committed version)
                                    COMMIT;
```

---

## Isolation Levels

Isolation (the I in ACID) isn't binary — it comes in levels. Higher
isolation means more protection from concurrency anomalies but
potentially lower throughput.

### The Three Anomalies

Before covering isolation levels, you need to know what they protect
against:

**1. Dirty Read — reading uncommitted data**
Transaction A updates a row but hasn't committed. Transaction B reads
that uncommitted value. If A rolls back, B just acted on data that
never existed.

**Analogy:** Reading someone's draft email over their shoulder and
replying to it. They might delete that draft — now your reply makes
no sense.

**2. Non-Repeatable Read — same query, different results**
Transaction B reads a row. Transaction A commits a change to that row.
Transaction B reads the same row again and gets a different value.

**Analogy:** You check the price of a flight. While you're entering your
credit card info, someone else books a seat and the price goes up.
You check the price again — it changed.

**3. Phantom Read — new rows appear between queries**
Transaction B runs a query and gets 10 rows. Transaction A inserts a new
row that matches B's query. B runs the same query again and gets 11 rows.
A row appeared out of thin air.

**Analogy:** You count the people in a room — 10 people. While you're
writing the count down, someone walks in. You count again — 11 people.

### The Four Isolation Levels

| Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|-------|-----------|-------------------|-------------|
| READ UNCOMMITTED | Possible | Possible | Possible |
| READ COMMITTED | Prevented | Possible | Possible |
| REPEATABLE READ | Prevented | Prevented | Prevented* |
| SERIALIZABLE | Prevented | Prevented | Prevented |

*Postgres actually prevents phantom reads at REPEATABLE READ too, which
goes beyond the SQL standard. Postgres's MVCC snapshot mechanism
naturally prevents them.

### READ UNCOMMITTED

**Postgres doesn't actually implement this.** If you set it, Postgres
silently upgrades you to READ COMMITTED. Why? Because MVCC naturally
prevents dirty reads — there's no performance benefit to allowing them.

```sql
-- You can set it, but Postgres treats it as READ COMMITTED
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SHOW transaction_isolation;
-- Shows: read uncommitted (but behavior is read committed)
```

### READ COMMITTED (The Default)

Each statement within a transaction sees the most recently committed
data at the time that STATEMENT starts. If another transaction commits
between your two SELECTs, your second SELECT sees the new data.

**Analogy — a news ticker:**
Every time you look at the screen, you see the latest headlines. If
news breaks between your first and second glance, you see the update.

```sql
-- Demonstrate READ COMMITTED behavior
-- You need TWO psql sessions for this. Open two terminals.

-- SESSION A:
BEGIN;
SELECT val FROM mvcc_demo WHERE name = 'alpha';
-- Returns: 30

-- SESSION B:
BEGIN;
UPDATE mvcc_demo SET val = 999 WHERE name = 'alpha';
COMMIT;

-- SESSION A (still in its transaction):
SELECT val FROM mvcc_demo WHERE name = 'alpha';
-- Returns: 999 (!) — sees B's committed change
-- This is a non-repeatable read
COMMIT;
```

### REPEATABLE READ

Your entire transaction sees a snapshot from when the transaction STARTED.
No matter what other transactions commit, you keep seeing the same data.

**Analogy — downloading a database backup:**
You start a backup at 3:00 PM. Even though users keep changing data, your
backup captures everything as it was at exactly 3:00 PM. It's a frozen-
in-time snapshot.

```sql
-- SESSION A:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT val FROM mvcc_demo WHERE name = 'alpha';
-- Returns current value (let's say 999)

-- SESSION B:
BEGIN;
UPDATE mvcc_demo SET val = 42 WHERE name = 'alpha';
COMMIT;

-- SESSION A:
SELECT val FROM mvcc_demo WHERE name = 'alpha';
-- Still returns 999! Snapshot is frozen.
COMMIT;
```

But what happens if Session A tries to UPDATE a row that Session B
already changed?

```sql
-- SESSION A:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT val FROM mvcc_demo WHERE name = 'alpha';

-- SESSION B:
BEGIN;
UPDATE mvcc_demo SET val = 77 WHERE name = 'alpha';
COMMIT;

-- SESSION A:
UPDATE mvcc_demo SET val = 88 WHERE name = 'alpha';
-- ERROR: could not serialize access due to concurrent update
ROLLBACK;
```

Postgres raises an error rather than silently applying your change on
top of a version you've never seen. Your application must catch this
error and retry the transaction.

### SERIALIZABLE

The strictest level. Postgres guarantees that the result is the same as
if the transactions ran one after another (serially), not concurrently.

**Analogy — a single-lane bridge:**
Cars can drive at the same time on the highway, but when they hit the
single-lane bridge, they go one at a time. SERIALIZABLE makes
transactions behave as if they crossed a single-lane bridge, even
though they're actually running concurrently.

```sql
-- SESSION A:
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT SUM(val) FROM mvcc_demo;

-- SESSION B:
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT SUM(val) FROM mvcc_demo;
INSERT INTO mvcc_demo (name, val) VALUES ('beta', 100);
COMMIT;

-- SESSION A:
INSERT INTO mvcc_demo (name, val) VALUES ('gamma', 200);
COMMIT;
-- ERROR: could not serialize access due to read/write dependencies
-- among transactions
```

Postgres detected that A and B's operations would produce different
results depending on execution order, so it aborted one. Your app
must retry.

**When to use SERIALIZABLE:** when correctness is more important than
throughput — financial calculations, inventory counts, anything where
anomalies would be catastrophic.

---

## Row-Level Locks

Sometimes MVCC isn't enough. You need to explicitly lock rows to
prevent other transactions from changing them.

### FOR UPDATE — Exclusive Row Lock

"I'm going to update this row. Nobody else can change or lock it until
I'm done."

```sql
BEGIN;

SELECT balance FROM accounts WHERE owner = 'Alice' FOR UPDATE;
-- This row is now LOCKED. Other transactions trying to
-- SELECT ... FOR UPDATE on the same row will WAIT.

-- Safely do your calculation and update
UPDATE accounts SET balance = balance - 100 WHERE owner = 'Alice';

COMMIT;
-- Lock released
```

**Use case:** the classic "check then act" pattern:

```sql
BEGIN;

-- Lock the row AND read the stock
SELECT stock FROM products WHERE id = 1 FOR UPDATE;
-- Returns: 48

-- Only if stock is sufficient, proceed
-- (Your application code checks: if stock >= quantity_needed)
UPDATE products SET stock = stock - 5 WHERE id = 1;

COMMIT;
```

Without `FOR UPDATE`, another transaction could decrease the stock
between your SELECT and your UPDATE, causing an oversell.

### FOR SHARE — Shared Row Lock

"I'm reading this row and I need it to NOT change until I'm done.
Other readers can also lock it, but nobody can update it."

```sql
BEGIN;

SELECT balance FROM accounts WHERE owner = 'Alice' FOR SHARE;
-- Multiple transactions can FOR SHARE the same row
-- But nobody can UPDATE or DELETE it until all FOR SHARE locks release

-- Use the balance in calculations...

COMMIT;
```

### FOR UPDATE vs FOR SHARE

| Lock Type | Other FOR SHARE | Other FOR UPDATE | Other UPDATE/DELETE |
|-----------|----------------|-----------------|-------------------|
| FOR SHARE | Allowed | Blocked | Blocked |
| FOR UPDATE | Blocked | Blocked | Blocked |

### SKIP LOCKED and NOWAIT

Two useful options for avoiding waits:

```sql
-- NOWAIT: Error immediately instead of waiting
SELECT * FROM products WHERE stock > 0 FOR UPDATE NOWAIT;
-- If any matching row is locked: ERROR: could not obtain lock on row

-- SKIP LOCKED: Skip rows that are locked, process available ones
SELECT * FROM products WHERE stock > 0 FOR UPDATE SKIP LOCKED LIMIT 5;
-- Returns only unlocked rows — great for job queues
```

`SKIP LOCKED` is how you build a simple job queue in Postgres: multiple
workers SELECT ... FOR UPDATE SKIP LOCKED from a tasks table and each
gets a different task.

---

## Advisory Locks

Advisory locks aren't tied to any row or table. They're application-
defined locks — you pick a number, and use it as a lock ID.

**Analogy — a "meeting in progress" sign on a door:**
The sign doesn't prevent you from opening the door. It's a convention.
If your code checks for the sign, it works. If your code ignores it,
the lock does nothing.

```sql
-- Acquire an advisory lock (blocks if another session holds it)
SELECT pg_advisory_lock(12345);

-- Do exclusive work...

-- Release it
SELECT pg_advisory_unlock(12345);

-- Try-lock variant (returns true/false, never blocks)
SELECT pg_try_advisory_lock(12345);
```

Use cases:
- Ensuring only one instance of a cron job runs at a time
- Application-level mutex for resources that aren't rows
- Rate limiting

---

## Deadlocks

A deadlock happens when two transactions are each waiting for a lock
the other holds. Neither can proceed.

**Analogy — two people in a narrow hallway:**
Person A steps left, Person B steps left. A steps right, B steps right.
They mirror each other forever, neither can pass. They're deadlocked.

```
Session A:                          Session B:

BEGIN;                              BEGIN;

UPDATE accounts                     UPDATE accounts
  SET balance = balance - 10          SET balance = balance - 10
  WHERE owner = 'Alice';              WHERE owner = 'Bob';
-- A holds lock on Alice              -- B holds lock on Bob

UPDATE accounts                     UPDATE accounts
  SET balance = balance + 10          SET balance = balance + 10
  WHERE owner = 'Bob';                WHERE owner = 'Alice';
-- A waits for B's lock on Bob        -- B waits for A's lock on Alice

-- DEADLOCK!
```

### How Postgres Handles Deadlocks

Postgres runs a deadlock detector that periodically checks for cycles in
the wait graph. When it finds one, it picks a victim transaction and
kills it:

```
ERROR: deadlock detected
DETAIL: Process 12345 waits for ShareLock on transaction 67890;
        blocked by process 67891.
        Process 67891 waits for ShareLock on transaction 12345;
        blocked by process 12345.
HINT: See server log for query details.
```

The victim transaction is rolled back. The other transaction proceeds.

### Preventing Deadlocks

The simplest prevention: **always lock rows in the same order.** If every
transaction locks Alice before Bob (alphabetical order, or by ID), no
deadlock can occur.

```sql
-- GOOD: Both transactions lock in the same order (by ID)
-- Transaction 1:
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;  -- Alice first
SELECT * FROM accounts WHERE id = 2 FOR UPDATE;  -- Then Bob
-- ... do work ...
COMMIT;

-- Transaction 2:
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;  -- Alice first (waits if needed)
SELECT * FROM accounts WHERE id = 2 FOR UPDATE;  -- Then Bob
-- ... do work ...
COMMIT;
```

---

## VACUUM: Cleaning Up Old Row Versions

Remember that UPDATE creates a new row version and the old one stays on
disk? Those old versions (called "dead tuples") pile up. VACUUM is the
garbage collector that reclaims that space.

**Analogy — shredding old drafts:**
Every time you revise a document, you print a new copy but leave the old
one on your desk. After a while, your desk is buried. VACUUM shreds the
old drafts that nobody is reading anymore.

```sql
-- See dead tuples for a table
SELECT
    relname,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE relname = 'mvcc_demo';
```

### Why VACUUM Matters

Without VACUUM:
1. **Table bloat** — the table file grows forever, even if the logical
   row count stays the same
2. **Index bloat** — indexes point to dead rows, wasting space and
   slowing queries
3. **Transaction ID wraparound** — Postgres uses 32-bit transaction IDs.
   After ~2 billion transactions, IDs wrap around. VACUUM marks old
   transactions as "frozen" to prevent this catastrophe.

### Running VACUUM

```sql
-- Basic VACUUM: marks dead tuples as reusable (doesn't shrink the file)
VACUUM mvcc_demo;

-- VACUUM VERBOSE: shows what it did
VACUUM VERBOSE mvcc_demo;

-- VACUUM FULL: rewrites the entire table, reclaims disk space
-- WARNING: locks the table exclusively — nobody can read or write
VACUUM FULL mvcc_demo;

-- VACUUM ANALYZE: vacuum + update query planner statistics
VACUUM ANALYZE mvcc_demo;
```

### Autovacuum

You almost never need to run VACUUM manually. Postgres has an
**autovacuum** daemon that runs VACUUM automatically based on how much
a table has changed.

```sql
-- Check autovacuum settings
SHOW autovacuum;
-- on

-- See autovacuum activity
SELECT
    relname,
    last_autovacuum,
    autovacuum_count,
    n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

Autovacuum triggers when the number of dead tuples exceeds a threshold
(by default: 50 + 20% of the table size). For a table with 10,000 rows,
autovacuum fires after roughly 2,050 dead tuples accumulate.

**The rule:** let autovacuum do its job. Don't turn it off. If it's not
keeping up, tune its settings (make it run more frequently or with more
workers) rather than disabling it.

---

## Putting It All Together: An Isolation Level Demo

Create this setup to experiment with isolation levels:

```sql
DROP TABLE IF EXISTS counter;
CREATE TABLE counter (
    id    SERIAL PRIMARY KEY,
    name  TEXT UNIQUE NOT NULL,
    value INTEGER NOT NULL DEFAULT 0
);

INSERT INTO counter (name, value) VALUES ('hits', 0);
```

### Experiment 1: READ COMMITTED Non-Repeatable Read

Open two psql sessions.

```sql
-- SESSION A:
BEGIN;
SELECT value FROM counter WHERE name = 'hits';
-- Returns: 0

-- SESSION B:
UPDATE counter SET value = value + 1 WHERE name = 'hits';
-- Autocommit: immediately committed

-- SESSION A:
SELECT value FROM counter WHERE name = 'hits';
-- Returns: 1  <-- Value changed within A's transaction!
COMMIT;
```

### Experiment 2: REPEATABLE READ Prevents It

```sql
-- SESSION A:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT value FROM counter WHERE name = 'hits';
-- Returns: 1

-- SESSION B:
UPDATE counter SET value = value + 1 WHERE name = 'hits';
-- Committed: value is now 2

-- SESSION A:
SELECT value FROM counter WHERE name = 'hits';
-- Returns: 1  <-- Frozen snapshot! Doesn't see B's change.
COMMIT;

-- After commit, a new query sees the current value:
SELECT value FROM counter WHERE name = 'hits';
-- Returns: 2
```

### Experiment 3: Serialization Failure

```sql
-- Reset
UPDATE counter SET value = 0 WHERE name = 'hits';

-- SESSION A:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
UPDATE counter SET value = value + 10 WHERE name = 'hits';

-- SESSION B:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
UPDATE counter SET value = value + 20 WHERE name = 'hits';
-- SESSION B blocks, waiting for A...

-- SESSION A:
COMMIT;

-- SESSION B (unblocks):
-- ERROR: could not serialize access due to concurrent update
ROLLBACK;
-- Application must retry the transaction
```

---

## Key Takeaways

1. **MVCC keeps old row versions** so readers and writers don't block
   each other.
2. **xmin/xmax** track which transaction created and deleted each row
   version.
3. **READ COMMITTED** (default): each statement sees the latest committed
   data.
4. **REPEATABLE READ**: the entire transaction sees a frozen snapshot.
5. **SERIALIZABLE**: transactions behave as if run one at a time.
6. **FOR UPDATE** locks rows for exclusive modification.
7. **SKIP LOCKED** enables job-queue patterns.
8. **Deadlocks** happen when transactions wait for each other's locks.
   Prevent them by locking in a consistent order.
9. **VACUUM** cleans up dead row versions. Let autovacuum handle it.
10. **Higher isolation = more correctness, more retries.** Choose the
    level that matches your application's needs.

---

## Exercises

### Exercise 1: See MVCC in Action

Create a table, insert a row, and update it 5 times. After each update,
check xmin. Observe that xmin changes every time because each update
creates a new row version.

```sql
-- Your solution here
-- Use: SELECT xmin, xmax, * FROM your_table;
```

### Exercise 2: Non-Repeatable Read

Using two psql sessions, demonstrate a non-repeatable read under READ
COMMITTED. Session A reads a value twice within a transaction, and
Session B changes it between those reads. Show that A sees different
values.

```sql
-- SESSION A:
-- Your solution here

-- SESSION B:
-- Your solution here
```

### Exercise 3: Repeatable Read Prevents Non-Repeatable Read

Repeat Exercise 2 but with Session A using REPEATABLE READ. Show that
Session A sees the same value both times, even after Session B commits
a change.

```sql
-- Your solution here
```

### Exercise 4: Build a Simple Job Queue

Create a `jobs` table with a status column. Insert 10 jobs with status
'pending'. Open two sessions, each acting as a worker. Each worker
should:
1. `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` to grab a job
2. Update its status to 'processing'
3. Commit

Show that the two workers each grab different jobs and never double-
process.

```sql
CREATE TABLE jobs (
    id     SERIAL PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    data   TEXT
);

INSERT INTO jobs (data)
SELECT 'Task ' || generate_series(1, 10);

-- WORKER A (session 1):
-- Your solution here

-- WORKER B (session 2):
-- Your solution here
```

### Exercise 5: Deadlock and Resolution

Create a deliberate deadlock between two sessions by having them lock
rows in opposite order. Observe the deadlock detection error and which
session gets terminated.

```sql
-- SESSION A:
-- Lock row 1 first, then try row 2

-- SESSION B:
-- Lock row 2 first, then try row 1

-- Observe the deadlock error
```

### Exercise 6: VACUUM Observation

Create a table, insert 1000 rows, then update every row 5 times.
Check `n_dead_tup` from `pg_stat_user_tables`. Run VACUUM. Check
`n_dead_tup` again. How many dead tuples were cleaned up?

```sql
CREATE TABLE vacuum_test (
    id  SERIAL PRIMARY KEY,
    val INTEGER
);

INSERT INTO vacuum_test (val) SELECT generate_series(1, 1000);

-- Update all rows 5 times
-- Your solution here

-- Check dead tuples
-- Run VACUUM
-- Check again
```

---

Next: [Lesson 15 — WAL and Crash Recovery: How Databases Survive Failures](./15-wal-recovery.md)
