# Lesson 01: What Is a Database (And Why Not Just Use Files)

Before learning SQL or Postgres internals, you need to understand the
problem databases solve — and why you can't just write JSON to disk.

---

## You Could Just Use Files

Here's a user list in a JSON file:

```json
[
  {"id": 1, "name": "Alice", "email": "alice@example.com"},
  {"id": 2, "name": "Bob", "email": "bob@example.com"},
  {"id": 3, "name": "Charlie", "email": "charlie@example.com"}
]
```

For 10 users, this works fine. Here's why it breaks down:

### Problem 1: Finding Data Is Slow

To find Bob, you read the ENTIRE file and check every entry. With 10
million users, that's reading hundreds of megabytes to find one person.

**Analogy:** Imagine finding a word in a 500-page book with no index
and no table of contents. You'd read every page. A database is the book
WITH an index — jump straight to the right page.

### Problem 2: Concurrent Access

Two web requests arrive at the same time:
1. Request A reads the file to add a new user
2. Request B reads the file to add a different user
3. Request A writes the file (with their new user)
4. Request B writes the file (with their new user, but WITHOUT A's user)

Request A's user just vanished. This is called a **race condition**.

**Analogy:** Two people editing the same Google Doc in airplane mode.
When they reconnect, someone's changes get overwritten.

### Problem 3: Crashes Lose Data

Your program writes a new user to the file. Halfway through the write,
your computer loses power. Now the file is half-written — corrupted.

**Analogy:** Writing a letter and the pen runs out of ink mid-sentence.
The letter is incomplete and potentially unreadable.

### Problem 4: No Structure Enforcement

Nothing stops you from writing `{"id": "banana", "email": 42}`. The file
doesn't care. You'll find out about bad data only when your code crashes.

### Problem 5: Relationships Are Painful

Users have orders. Orders have items. Items have products. In files, you
either duplicate data everywhere or build a custom reference system. You're
building a crappy database.

---

## What a Database Actually Is

A database is software that solves ALL five problems above:

| Problem | Database Solution |
|---------|------------------|
| Slow lookups | **Indexes** — jump straight to the data |
| Concurrent access | **Transactions & locks** — safe parallel access |
| Crash safety | **Write-ahead log (WAL)** — recoverable writes |
| No structure | **Schema & types** — enforced rules on data |
| Relationships | **Foreign keys & joins** — structured references |

### The Architecture

```
Your Application (Rust, Go, TS)
        │
        │  SQL query: "SELECT * FROM users WHERE id = 42"
        ▼
┌─────────────────────────┐
│   PostgreSQL Server      │
│                         │
│  ┌───────────────────┐  │
│  │  Query Parser     │  │  ← turns SQL text into a plan
│  │  Query Planner    │  │  ← decides HOW to find the data
│  │  Query Executor   │  │  ← actually fetches the data
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │  Buffer Manager   │  │  ← cache of frequently used data
│  │  (Shared Memory)  │  │    (like keeping popular books on your desk)
│  └───────────────────┘  │
│           │              │
│           ▼              │
│  ┌───────────────────┐  │
│  │  Storage Engine   │  │  ← reads/writes actual files on disk
│  │  WAL Writer       │  │  ← crash recovery journal
│  └───────────────────┘  │
└─────────────────────────┘
        │
        ▼
   Disk (your data files)
```

**Analogy — a restaurant:**
- **Your app** = the customer ordering food
- **SQL** = the language you order in ("I'll have the chicken")
- **Query parser** = the waiter writing down your order
- **Query planner** = the chef deciding the most efficient way to cook it
- **Query executor** = the chef actually cooking
- **Buffer manager** = ingredients already prepped and on the counter (cache)
- **Storage engine** = the pantry and fridge (disk)
- **WAL** = the order ticket that persists even if the kitchen catches fire

---

## Types of Databases

### Relational (what we're learning)

Data organized in tables with rows and columns. Tables relate to each
other through keys. You query with SQL.

**Examples:** PostgreSQL, MySQL, SQLite
**Best for:** Most applications. Structured data with relationships.

### Document

Data stored as JSON-like documents. No fixed schema — each document
can have different fields.

**Examples:** MongoDB, CouchDB
**Best for:** Rapidly changing schemas, content management.

### Key-Value

Simple pairs: a key maps to a value. Extremely fast for simple lookups.

**Examples:** Redis, DynamoDB
**Best for:** Caching, sessions, counters. Not for complex queries.

### Column-Family

Data stored by columns instead of rows. Efficient for analytics on
specific columns across millions of rows.

**Examples:** Cassandra, ClickHouse
**Best for:** Time-series data, analytics, write-heavy workloads.

### Graph

Data stored as nodes and edges (relationships). Great for "who knows
who" or "what's connected to what" queries.

**Examples:** Neo4j, DGraph
**Best for:** Social networks, recommendation engines.

---

## Why PostgreSQL

For learning AND production, PostgreSQL is the best choice because:

1. **Full-featured** — JSON, arrays, full-text search, geospatial, all built in
2. **Standards compliant** — SQL you learn here works in most databases
3. **Production proven** — Instagram, Spotify, Reddit all use it
4. **Best documentation** — the Postgres docs are exceptionally thorough
5. **Open source** — free, no licensing headaches
6. **Growing fastest** — most popular database choice for new projects

---

## Your First Interaction

Set up Postgres (see [PostgreSQL Setup](./reference-postgres-setup.md)),
then:

```bash
psql learn_db
```

```sql
-- Create your first table
CREATE TABLE notes (
    id    SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body  TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some data
INSERT INTO notes (title, body) VALUES ('First note', 'Hello database!');
INSERT INTO notes (title, body) VALUES ('Second note', 'This is stored on disk.');
INSERT INTO notes (title) VALUES ('No body');

-- Query it back
SELECT * FROM notes;

-- Find specific data
SELECT title, created_at FROM notes WHERE body IS NOT NULL;

-- Count
SELECT COUNT(*) FROM notes;

-- Clean up
DROP TABLE notes;
```

---

## Key Takeaways

1. **Files break at scale** — slow lookups, race conditions, crash corruption.
2. **A database solves these** with indexes, transactions, WAL, and schemas.
3. **PostgreSQL** is the best general-purpose database to learn and use.
4. **SQL** is the language you use to talk to relational databases.
5. **The database is a server** — your app connects to it over a network
   (even if both are on the same machine).

Next: [Lesson 02 — How Data Lives on Disk](./02-data-on-disk.md)
