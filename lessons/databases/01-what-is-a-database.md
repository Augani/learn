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

## How Indexes Actually Work: B-Trees Under the Hood

We said indexes let you "jump straight to the data." But how? The answer
is one of the most elegant data structures in computer science: the **B-tree**.

**Analogy — the library card catalog:** Imagine a library with 10 million
books. Without a catalog, finding a book means walking every aisle, scanning
every shelf. With a card catalog, you look up the author's last name, and
the card tells you "Aisle 14, Shelf 3, Position 7." You walk straight there.

A B-tree works like a multi-level card catalog:

```
Looking for user with id = 42:

Level 1 (root):     [50]
                   /     \
Level 2:      [25]        [75]
             /    \      /    \
Level 3:  [10,20] [30,42] [60,70] [80,90]
                      ^
                   FOUND IT! → points to row on disk

Only 3 comparisons to search millions of rows!
```

Without an index, finding id=42 in a table with 10 million rows means
reading ALL 10 million rows (a **sequential scan**). With a B-tree index,
it takes about `log(10,000,000) ≈ 23` comparisons. That's the difference
between reading 10 million rows and reading 23. Not 23 thousand. Twenty-three.

This is why adding an index to a slow query can make it 100,000x faster.
It's also why databases don't index everything by default — each index is
a separate B-tree that must be updated on every INSERT, UPDATE, and DELETE.
More indexes = faster reads, slower writes. There's always a tradeoff.

---

## ACID: The Four Promises a Database Makes

Databases guarantee four properties that flat files never could. Together
they're called **ACID**, and they're the reason you can trust a database
with your money.

**Analogy — a bank transfer:** You're moving $500 from checking to savings.

**A — Atomicity:** "All or nothing." Either BOTH accounts update (checking
-$500, savings +$500) or NEITHER does. If the power goes out halfway through,
the database rolls back to the state before the transfer. You'll never have
$500 vanish into thin air. It's like a light switch — it's either on or off,
never stuck halfway.

**C — Consistency:** "The rules always hold." If you have a rule that
account balances can't go negative, the database won't let a transfer
violate that, even in a crash. The database moves from one valid state to
another valid state, never passing through an invalid state.

**I — Isolation:** "Transactions don't see each other's unfinished work."
If you're transferring money while someone else is checking your balance,
they see either the old balance or the new one — never a partial state where
checking has -$500 but savings hasn't gained it yet.

**D — Durability:** "Once committed, it's permanent." When the database
says "transfer complete," the data is safely on disk. Even if the server
catches fire the next millisecond, your transfer survives.

```
Without ACID (flat files):
  1. Read checking: $1000 ✓
  2. Write checking: $500  ✓
  --- POWER FAILURE ---
  3. Write savings: $500   ✗ (never happened)
  Result: $500 vanished.

With ACID (database):
  1. BEGIN TRANSACTION
  2. Write to WAL: "checking -500, savings +500"
  3. Update checking: $500
  --- POWER FAILURE ---
  On restart: database reads WAL, sees uncommitted transaction, rolls back.
  Result: checking is back to $1000. No money lost.
```

The **Write-Ahead Log (WAL)** is the secret ingredient. Before changing any
data, the database writes a record of WHAT it's about to do to a separate
log file. If it crashes, it replays the log on startup to recover.
Think of it as a "shopping list" — even if you drop your groceries in the
parking lot, you still have the list to start over.

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
