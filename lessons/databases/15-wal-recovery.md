# Lesson 15: WAL and Crash Recovery — How Databases Survive Failures

What happens if the power goes out while Postgres is writing your data?
What if the server kernel panics mid-transaction? What if someone trips
over the power cable right after your application receives "COMMIT OK"?

If the answer were "your data is gone," nobody would use databases.
Postgres guarantees that committed data survives crashes. This lesson
explains how.

---

## The Problem: Writes Are Not Instant

When you UPDATE a row, Postgres modifies the page in shared memory
(the buffer pool). But memory is volatile — it vanishes when power
disappears. The data is only truly safe once it's written to disk.

But writing to disk is slow, and Postgres modifies many pages per second.
If it wrote every changed page to disk immediately, performance would
collapse. So Postgres batches disk writes — which means at any moment,
there are modified pages in memory that haven't been written to disk yet.

This creates a window of vulnerability:

```
                         The Danger Window
                    ┌─────────────────────────┐
  COMMIT returned   │  Data in memory but NOT  │   Data reaches disk
  to the client     │  yet written to the      │   (checkpoint)
       ▼            │  actual data files       │        ▼
  ─────┼────────────┤                          ├────────┼─────
       │            │    CRASH HERE = DATA     │        │
       │            │    LOSS... unless WAL     │        │
       │            └─────────────────────────┘        │
```

If the server crashes during this window, the data in memory is lost.
The data files on disk are stale. How do you recover?

**The Write-Ahead Log (WAL).**

---

## The WAL: A Journal for Your Database

**Analogy — a scientist's lab notebook:**

A scientist doesn't write results directly into the final published paper.
They first write everything in their lab notebook — every step, every
measurement, every observation. If the lab floods and destroys the
experiment, they can reconstruct everything from the notebook.

The WAL is the lab notebook. Before Postgres changes ANYTHING in the
actual data files, it first writes a record of what it's ABOUT to do
into the WAL. The WAL is written to disk immediately. The actual data
files are updated later, at a convenient time.

If the server crashes, Postgres replays the WAL from the last known
good point and reconstructs every committed change.

---

## How WAL Works: Step by Step

Here's what happens when you run an UPDATE inside a transaction:

```
  Your Application
       │
       │  UPDATE accounts SET balance = 500 WHERE id = 1;
       ▼
  ┌─────────────────────────────────────────────────┐
  │                 PostgreSQL                       │
  │                                                 │
  │  1. Modify the page in shared memory (buffer)   │
  │     └─ The row now says balance = 500           │
  │                                                 │
  │  2. Write a WAL record to the WAL buffer        │
  │     └─ "Changed row id=1 in accounts:           │
  │         balance from 1000 to 500"               │
  │                                                 │
  │  When you COMMIT:                               │
  │                                                 │
  │  3. FLUSH the WAL buffer to disk (fsync)        │
  │     └─ The WAL record is now durable on disk    │
  │     └─ This is the critical safety moment       │
  │                                                 │
  │  4. Tell the client: "COMMIT OK"                │
  │     └─ Your application continues               │
  │                                                 │
  │  LATER (at checkpoint time):                    │
  │                                                 │
  │  5. Write the modified page from memory to the  │
  │     actual data file on disk                    │
  │                                                 │
  └─────────────────────────────────────────────────┘
```

The critical insight: **step 3 happens BEFORE step 4.** Postgres never
tells you "committed" until the WAL record is safely on disk. This is
what guarantees durability.

Step 5 can happen minutes or hours later. It doesn't matter — if the
server crashes between steps 4 and 5, Postgres replays the WAL on
startup and reconstructs the change.

### Why Is This Faster Than Writing Data Files Directly?

WAL writes are **sequential** — every record is appended to the end of
the WAL file, one after another. This is the fastest possible disk I/O
pattern.

Data file writes are **random** — updating row 42 in table A, then row
7891 in table B, then row 3 in table C. The disk head jumps all over
the place. This is the slowest disk I/O pattern.

```
WAL writes:     ████████████████████►  (sequential, fast)

Data file writes:  █   █     █  █ █    (random, slow)
```

By batching all the random data file writes and doing them in bulk later
(at checkpoint time), Postgres gets the safety of immediate durability
with the performance of deferred writes.

---

## Checkpoints: Flushing to Data Files

A checkpoint is when Postgres writes all the modified (dirty) pages from
memory to the actual data files on disk. After a checkpoint completes,
the WAL records before that point are no longer needed for crash
recovery — the data files are up to date.

**Analogy — saving your video game:**
You've been playing for an hour, making progress. The game auto-saves
(checkpoint). If the power goes out, you restart from the last save, not
from the beginning. The WAL between the last checkpoint and the crash
is the "unsaved progress" that Postgres replays on recovery.

```
  WAL Timeline:
  ──────┬──────────────┬──────────────┬────────────
        │              │              │
     Checkpoint 1   Checkpoint 2   Crash!
        │              │              │
        │              │     ┌────────┘
        │              │     │
        │              │  Replay this WAL
        │              │  segment on recovery
        │              │
        │  WAL between these checkpoints can
        │  be recycled (data files are up to date)
```

### When Do Checkpoints Happen?

Postgres triggers a checkpoint when:
1. A configured time interval has passed (`checkpoint_timeout`, default 5 minutes)
2. A configured amount of WAL has been written (`max_wal_size`, default 1 GB)
3. An administrator runs `CHECKPOINT` manually
4. The server is shutting down cleanly

```sql
-- See current checkpoint settings
SHOW checkpoint_timeout;
-- 5min

SHOW max_wal_size;
-- 1GB

-- Force a checkpoint (don't do this in production without reason)
CHECKPOINT;

-- See when the last checkpoint happened
SELECT
    checkpoints_timed,
    checkpoints_req,
    checkpoint_write_time,
    checkpoint_sync_time
FROM pg_stat_bgwriter;
```

---

## Crash Recovery: Replay the Journal

When Postgres starts after a crash, it:

1. Finds the last completed checkpoint in the WAL
2. Reads all WAL records after that checkpoint
3. Replays each record, re-applying the changes to the data files
4. Once all WAL records are replayed, the database is consistent
5. Opens for connections

**Analogy — a chef's order tickets:**
A restaurant's kitchen crashes (everyone goes home suddenly). The next
morning, the new shift finds a stack of order tickets. They re-read the
tickets and figure out which orders were completed (the food went out)
and which were in-progress (need to be redone or discarded). The order
tickets are the WAL.

```
  Crash Recovery Process:

  1. Find last checkpoint
     ┌──────────────────────┐
     │  Checkpoint record:  │
     │  "At this point,     │
     │   data files were    │
     │   fully up to date"  │
     └──────────┬───────────┘
                │
  2. Read WAL from checkpoint forward
                │
                ▼
     ┌──────────────────────┐
     │  WAL record: UPDATE  │──► Apply to data file
     │  WAL record: INSERT  │──► Apply to data file
     │  WAL record: DELETE  │──► Apply to data file
     │  WAL record: COMMIT  │──► Mark transaction as committed
     │  WAL record: UPDATE  │──► Apply to data file
     │  WAL record: (no COMMIT) │──► Rolled back (uncommitted)
     └──────────────────────┘
                │
  3. Database is now consistent
                │
                ▼
     Ready for connections
```

Uncommitted transactions are effectively rolled back: their WAL records
might be replayed, but since there's no COMMIT record, the MVCC
visibility rules ensure no other transaction ever sees their changes.

---

## WAL Segments and Archiving

The WAL isn't one infinite file. It's divided into **segments**, each
16 MB by default.

```sql
-- See the current WAL position
SELECT pg_current_wal_lsn();
-- Something like: 0/16A3B28

-- See the current WAL file name
SELECT pg_walfile_name(pg_current_wal_lsn());
-- Something like: 000000010000000000000001
```

### The pg_wal Directory

WAL segments live in the `pg_wal` directory inside the Postgres data
directory:

```bash
# Typical location (varies by installation)
ls $PGDATA/pg_wal/

# On macOS with Homebrew:
ls /opt/homebrew/var/postgresql@16/pg_wal/

# You'll see files like:
# 000000010000000000000001
# 000000010000000000000002
# 000000010000000000000003
```

Each file is a 16 MB WAL segment. Postgres recycles old segments (reuses
the file for new WAL data) once they're no longer needed for crash
recovery.

### WAL Archiving

For production systems, you can configure Postgres to ARCHIVE old WAL
segments before recycling them. This copies each completed WAL segment
to a safe location (another disk, S3, etc.).

Why? Because archived WAL segments enable **Point-in-Time Recovery** — the
ability to restore your database to any specific moment in time.

```sql
-- Check if archiving is enabled
SHOW archive_mode;
-- off (default)

SHOW archive_command;
-- (empty by default)
```

Enabling archiving in `postgresql.conf`:

```
archive_mode = on
archive_command = 'cp %p /path/to/archive/%f'
```

The `%p` is the WAL segment file path, `%f` is the filename. In
production you'd use a more robust command (like shipping to S3 with
error checking).

---

## Point-in-Time Recovery (PITR)

PITR lets you restore your database to any specific point in time. This
is how you recover from "someone accidentally ran DELETE FROM users" at
3:47 PM.

**Analogy — a DVR (digital video recorder):**
You're recording a live TV broadcast. If something interesting happened
at 3:47 PM, you rewind to exactly that point. WAL archiving is the
recording, and PITR is the rewind.

### How PITR Works

1. You have a **base backup** (a copy of all data files from a point in
   time, taken with `pg_basebackup`)
2. You have **archived WAL segments** from that point forward
3. You tell Postgres: "Restore from the base backup, then replay WAL
   up to 3:46 PM" (one minute before the disaster)

```
  Base Backup          Archived WAL Segments
  (Tuesday 2 AM)       (Tuesday 2 AM → Thursday 3:47 PM)
       │                        │
       │    ┌───────────────────┘
       │    │
       ▼    ▼
  ┌──────────────────────────────────┐
  │  Restore Process:                │
  │  1. Copy base backup into place  │
  │  2. Replay WAL up to target time │
  │     (stop at 3:46 PM Thursday)   │
  │  3. Database is now at 3:46 PM   │
  └──────────────────────────────────┘
```

Recovery target in `recovery.conf` (or `postgresql.conf` in newer
versions):

```
restore_command = 'cp /path/to/archive/%f %p'
recovery_target_time = '2025-03-15 15:46:00'
```

---

## fsync and Data Integrity

`fsync` is the operating system call that forces data from the OS cache
to the physical disk. Without fsync, the OS might tell Postgres "write
complete" while the data is still in an OS-level memory buffer.

```sql
SHOW fsync;
-- on (NEVER turn this off in production)

SHOW wal_sync_method;
-- fdatasync (Linux) or open_datasync (varies by OS)
```

**Analogy — certified mail vs regular mail:**
Regular mail: you drop the letter in the mailbox and hope it arrives.
Certified mail: you get a signed receipt confirming delivery. `fsync`
is certified mail for disk writes — you don't proceed until the disk
confirms the data is physically stored.

### Why This Matters for Hardware

Not all storage hardware is honest about fsync. Some cheap SSDs and
hard drives have write caches that report "write complete" before data
reaches persistent storage. If power fails, data in the drive's cache
is lost.

**Enterprise SSDs** with power-loss protection have capacitors that flush
the write cache to NAND flash during a power failure. This is why
production databases should use enterprise-grade storage.

**Battery-backed RAID controllers** provide similar protection for
spinning disks.

A database running on a consumer SSD without power-loss protection is
gambling with data integrity. The WAL guarantee depends on fsync
actually reaching persistent storage.

---

## Backups: pg_dump vs pg_basebackup

Two fundamentally different backup strategies:

### pg_dump: Logical Backup

`pg_dump` reads the database and outputs SQL statements (or a custom
binary format) that can recreate it.

```bash
# Dump the entire database as SQL
pg_dump learn_db > backup.sql

# Dump in custom format (compressed, supports parallel restore)
pg_dump -Fc learn_db > backup.dump

# Dump only specific tables
pg_dump -t accounts -t products learn_db > tables.sql

# Restore from SQL
psql learn_db < backup.sql

# Restore from custom format
pg_restore -d learn_db backup.dump
```

**Pros:**
- Simple to use
- Output is portable (can restore to a different Postgres version)
- Can dump individual tables or schemas
- Human-readable (SQL format)

**Cons:**
- Slow for large databases (reads every row)
- No point-in-time recovery
- Snapshot is from one moment — ongoing writes during dump might cause
  inconsistencies (though pg_dump uses a transaction to ensure
  consistency)

### pg_basebackup: Physical Backup

`pg_basebackup` copies the actual data files (a binary copy of the
entire Postgres data directory). Combined with WAL archiving, this
enables PITR.

```bash
# Take a base backup
pg_basebackup -D /path/to/backup -Ft -z -P

# -D: destination directory
# -Ft: tar format
# -z: compress with gzip
# -P: show progress
```

**Pros:**
- Fast (copies files, doesn't read/process rows)
- Enables point-in-time recovery (with WAL archiving)
- Can restore to any moment between backups

**Cons:**
- Must restore to the same Postgres major version
- Copies everything (can't pick individual tables)
- Requires WAL archiving to be configured for PITR

### Which to Use?

| Scenario | Use |
|----------|-----|
| Small database, simple needs | pg_dump |
| Need to move data between Postgres versions | pg_dump |
| Need to restore individual tables | pg_dump |
| Large production database | pg_basebackup + WAL archiving |
| Need point-in-time recovery | pg_basebackup + WAL archiving |
| Disaster recovery plan | pg_basebackup + WAL archiving |

Most production systems use BOTH: pg_basebackup for disaster recovery
and pg_dump for portability and granular restores.

---

## Seeing WAL in Action

You can observe WAL activity in real time:

```sql
-- Current WAL write position
SELECT pg_current_wal_lsn();

-- Do some writes
INSERT INTO mvcc_demo (name, val) VALUES ('wal_test', 1);

-- Check WAL position again — it advanced
SELECT pg_current_wal_lsn();

-- How much WAL has been generated since the last checkpoint?
SELECT
    pg_current_wal_lsn() AS current_lsn,
    pg_size_pretty(
        pg_wal_lsn_diff(
            pg_current_wal_lsn(),
            '0/0'
        )
    ) AS total_wal_generated;

-- WAL statistics
SELECT * FROM pg_stat_wal;
```

### Measuring WAL Generation

```sql
-- Record starting position
SELECT pg_current_wal_lsn() AS before_insert;
-- e.g., 0/16B4A00

-- Generate some WAL
INSERT INTO mvcc_demo (name, val)
SELECT 'bulk_' || i, i FROM generate_series(1, 10000) AS i;

-- Record ending position
SELECT pg_current_wal_lsn() AS after_insert;
-- e.g., 0/17F2C80

-- Calculate how much WAL was generated
SELECT pg_size_pretty(
    pg_wal_lsn_diff(
        pg_current_wal_lsn(),
        '0/16B4A00'  -- replace with your before_insert value
    )
) AS wal_generated;
-- Something like: 1344 kB
```

---

## The Full Picture: How It All Fits Together

```
  Your Application
       │
       │  SQL statements
       ▼
  ┌───────────────────────────────────────────────┐
  │              PostgreSQL Server                │
  │                                               │
  │  ┌─────────────────────────────────────────┐  │
  │  │         Shared Memory (RAM)             │  │
  │  │                                         │  │
  │  │   Shared Buffers     WAL Buffers        │  │
  │  │   ┌──────────┐      ┌──────────┐       │  │
  │  │   │ Modified  │      │ WAL      │       │  │
  │  │   │ data      │      │ records  │       │  │
  │  │   │ pages     │      │ waiting  │       │  │
  │  │   │           │      │ to flush │       │  │
  │  │   └─────┬─────┘      └─────┬────┘       │  │
  │  │         │                  │             │  │
  │  └─────────┼──────────────────┼─────────────┘  │
  │            │                  │                 │
  │       CHECKPOINT         On COMMIT             │
  │       (periodic)         (immediately)         │
  │            │                  │                 │
  │            ▼                  ▼                 │
  │     ┌────────────┐    ┌────────────┐           │
  │     │ Data Files │    │  WAL Files │           │
  │     │ (base/)    │    │  (pg_wal/) │           │
  │     └────────────┘    └────────────┘           │
  │                              │                 │
  │                          ARCHIVE               │
  │                          (optional)            │
  │                              │                 │
  │                              ▼                 │
  │                       ┌────────────┐           │
  │                       │  Archive   │           │
  │                       │  Storage   │           │
  │                       │  (S3, NFS) │           │
  │                       └────────────┘           │
  └───────────────────────────────────────────────┘
```

The flow:
1. **Normal operation:** Changes go to shared buffers (data) and WAL
   buffers (journal). On COMMIT, the WAL buffer is flushed to WAL files
   on disk.
2. **Checkpoints:** Periodically, dirty pages from shared buffers are
   written to data files. WAL segments before the checkpoint can be
   recycled.
3. **Crash recovery:** Replay WAL from the last checkpoint to bring data
   files up to date.
4. **PITR:** Archive WAL segments. Restore a base backup + replay
   archived WAL to any desired point in time.

---

## Key Takeaways

1. **WAL is "write the plan before doing the work."** Changes are logged
   before being applied to data files.
2. **COMMIT flushes WAL to disk.** Postgres never tells you "committed"
   until the WAL record is safely on persistent storage.
3. **Data files are updated lazily** at checkpoint time for performance.
4. **Crash recovery replays WAL** from the last checkpoint to reconstruct
   any committed changes not yet in the data files.
5. **WAL writes are sequential and fast.** Data file writes are random
   and slow. This is why WAL exists.
6. **Checkpoints** periodically sync data files, allowing old WAL to be
   recycled.
7. **WAL archiving + base backups = PITR.** You can restore to any
   point in time.
8. **fsync ensures data reaches physical disk.** Without it (or with
   dishonest hardware), durability guarantees break.
9. **pg_dump for portability, pg_basebackup for disaster recovery.**
   Use both in production.
10. **Enterprise SSDs with power-loss protection** are essential for
    production databases.

---

## Exercises

### Exercise 1: Watch the WAL Move

Run `SELECT pg_current_wal_lsn();` before and after a series of
INSERT, UPDATE, and DELETE operations. Calculate the WAL generated for
each type of operation. Which generates the most WAL?

```sql
-- Your solution here
-- Hint: Use pg_wal_lsn_diff() to calculate the difference
-- Try: 1000 INSERTs vs 1000 UPDATEs vs 1000 DELETEs
```

### Exercise 2: Checkpoint Observation

Check when the last checkpoint occurred. Run a `CHECKPOINT` command.
Check the timing again. Compare the checkpoint counts before and after.

```sql
-- Your solution here
-- Use: SELECT * FROM pg_stat_bgwriter;
-- Then: CHECKPOINT;
-- Then: SELECT * FROM pg_stat_bgwriter; again
```

### Exercise 3: Backup and Restore with pg_dump

Dump the `learn_db` database to a file. Drop a table. Restore from the
dump. Verify the table is back.

```bash
# Step 1: Dump
pg_dump learn_db > /tmp/learn_db_backup.sql

# Step 2: Drop a table (pick one you can lose)
psql learn_db -c "DROP TABLE mvcc_demo;"

# Step 3: Restore
psql learn_db < /tmp/learn_db_backup.sql

# Step 4: Verify
psql learn_db -c "SELECT * FROM mvcc_demo LIMIT 5;"
```

### Exercise 4: WAL Size Estimation

Insert rows of varying sizes (small text vs large text) and measure
how much WAL each generates. Does row size affect WAL volume linearly?

```sql
-- Your solution here
-- Create a table with a TEXT column
-- Insert 1000 rows with 10-byte text values, measure WAL
-- Insert 1000 rows with 10,000-byte text values, measure WAL
-- Compare the WAL generated
```

### Exercise 5: Understanding the Recovery Window

Calculate how much data could theoretically be "in flight" (committed
but not yet checkpointed) based on your checkpoint settings. What is
the maximum amount of WAL Postgres would need to replay after a crash?

```sql
-- Your solution here
-- Hint: SHOW checkpoint_timeout; and SHOW max_wal_size;
-- The answer is approximately max_wal_size
-- (Postgres triggers a checkpoint when WAL reaches this size)
```

### Exercise 6: Comparing Backup Methods

Run `pg_dump` on your `learn_db` and note how long it takes and the
file size. If you have appropriate permissions, run `pg_basebackup`
and compare. For a small database, which is faster? At what database
size would you expect pg_basebackup to become faster?

```bash
# Time pg_dump
time pg_dump -Fc learn_db > /tmp/learn_db.dump
ls -lh /tmp/learn_db.dump

# Think about: at what scale does pg_basebackup win?
# pg_dump reads every row through SQL (O(rows))
# pg_basebackup copies files directly (O(disk size))
```

---

Next: [Lesson 16 — Schema Design Patterns for Real Applications](./16-schema-patterns.md)
