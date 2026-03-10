# Database Glossary & SQL Cheat Sheet

Terms and quick reference for everything in these lessons.

---

## Core Concepts

### Database
An organized collection of data stored on disk, managed by software
(the database engine/server) that lets you efficiently store, retrieve,
and modify that data.

**Analogy:** A filing cabinet with a really smart assistant. You tell
the assistant what you want, and they find it instantly — even in millions
of files.

### Table
A collection of related data organized in rows and columns. Like a
spreadsheet, but with strict rules about what goes in each column.

### Row (Record/Tuple)
A single entry in a table. One user, one order, one product.

### Column (Field/Attribute)
A named property that every row has. Like "name", "email", "created_at".

### Schema
The blueprint for your database — which tables exist, what columns they
have, what types those columns are, and how tables relate to each other.

### Primary Key
A column (or set of columns) that uniquely identifies each row. No two
rows can have the same primary key. Usually an auto-incrementing integer
or a UUID.

**Analogy:** A social security number — unique to each person.

### Foreign Key
A column that references the primary key of another table. This creates
a relationship between tables.

**Analogy:** Your "employer_id" on a tax form points to a specific company
in the company registry.

### Index
A separate data structure that speeds up lookups. Like the index at the
back of a book — instead of reading every page to find "PostgreSQL",
you look it up in the index and jump to page 247.

### Query
A request you send to the database. Usually written in SQL. "Give me
all users who signed up this month" is a query.

### Transaction
A group of operations that either ALL succeed or ALL fail. "Transfer
$100 from account A to account B" needs both the debit and credit to
succeed — you can't have one without the other.

### ACID
The four guarantees a proper database transaction provides:
- **A**tomicity — all operations succeed or none do
- **C**onsistency — data always follows the rules (constraints)
- **I**solation — concurrent transactions don't interfere
- **D**urability — committed data survives crashes/power loss

### Normalization
Organizing tables to reduce duplication. Instead of storing the customer's
address on every order, store it once in a customers table and reference it.

### Join
Combining rows from two or more tables based on a related column. "Give me
each order WITH the customer's name" joins the orders table with the
customers table.

---

## SQL Quick Reference

### Data Definition (DDL) — Defining Structure

```sql
-- Create a table
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    age         INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Add a column
ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT true;

-- Remove a column
ALTER TABLE users DROP COLUMN age;

-- Rename a column
ALTER TABLE users RENAME COLUMN name TO full_name;

-- Drop a table (DELETES EVERYTHING)
DROP TABLE users;
DROP TABLE IF EXISTS users;  -- no error if missing

-- Create an index
CREATE INDEX idx_users_email ON users (email);
CREATE UNIQUE INDEX idx_users_email ON users (email);
```

### Data Manipulation (DML) — Working with Data

```sql
-- Insert
INSERT INTO users (name, email) VALUES ('Augustus', 'aug@example.com');
INSERT INTO users (name, email) VALUES
    ('Alice', 'alice@example.com'),
    ('Bob', 'bob@example.com');

-- Select
SELECT * FROM users;
SELECT name, email FROM users WHERE age > 25;
SELECT name, email FROM users WHERE name LIKE 'A%';
SELECT COUNT(*) FROM users;

-- Update
UPDATE users SET name = 'Augustus II' WHERE id = 1;
UPDATE users SET active = false WHERE created_at < '2024-01-01';

-- Delete
DELETE FROM users WHERE id = 1;
DELETE FROM users WHERE active = false;

-- Upsert (insert or update on conflict)
INSERT INTO users (email, name)
VALUES ('aug@example.com', 'Augustus')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;
```

### Filtering & Sorting

```sql
SELECT * FROM users WHERE age > 25;
SELECT * FROM users WHERE age BETWEEN 20 AND 30;
SELECT * FROM users WHERE name IN ('Alice', 'Bob');
SELECT * FROM users WHERE email IS NOT NULL;
SELECT * FROM users WHERE name ILIKE '%aug%';       -- case-insensitive
SELECT * FROM users ORDER BY created_at DESC;
SELECT * FROM users ORDER BY name ASC LIMIT 10;
SELECT * FROM users LIMIT 10 OFFSET 20;             -- pagination
```

### Aggregation

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(DISTINCT email) FROM users;
SELECT AVG(age), MIN(age), MAX(age) FROM users;
SELECT status, COUNT(*) FROM orders GROUP BY status;
SELECT status, COUNT(*) FROM orders GROUP BY status HAVING COUNT(*) > 5;
```

### Joins

```sql
-- Inner join (only matching rows)
SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON o.user_id = u.id;

-- Left join (all users, even without orders)
SELECT u.name, o.total
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;

-- Multiple joins
SELECT u.name, o.id AS order_id, p.name AS product
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id;
```

### Subqueries & CTEs

```sql
-- Subquery
SELECT * FROM users WHERE id IN (
    SELECT user_id FROM orders WHERE total > 100
);

-- CTE (Common Table Expression) — readable subquery
WITH big_spenders AS (
    SELECT user_id, SUM(total) AS total_spent
    FROM orders
    GROUP BY user_id
    HAVING SUM(total) > 1000
)
SELECT u.name, bs.total_spent
FROM users u
JOIN big_spenders bs ON bs.user_id = u.id;
```

### Transactions

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

-- Or rollback if something goes wrong
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- oops, something went wrong
ROLLBACK;
```

---

## PostgreSQL Data Types

| Type | What it stores | Example |
|------|---------------|---------|
| `SERIAL` | Auto-incrementing integer | 1, 2, 3, ... |
| `BIGSERIAL` | Large auto-incrementing integer | Large IDs |
| `INTEGER` / `INT` | Whole number (4 bytes) | 42 |
| `BIGINT` | Large whole number (8 bytes) | 9223372036854775807 |
| `NUMERIC(p,s)` | Exact decimal | 99.99 (money) |
| `REAL` / `FLOAT4` | Approximate decimal (4 bytes) | 3.14 |
| `DOUBLE PRECISION` | Approximate decimal (8 bytes) | 3.14159265358979 |
| `TEXT` | Variable-length string | "hello world" |
| `VARCHAR(n)` | String with max length | "hello" (max n chars) |
| `BOOLEAN` | true/false | true |
| `DATE` | Calendar date | 2024-01-15 |
| `TIMESTAMP` | Date + time (no timezone) | 2024-01-15 10:30:00 |
| `TIMESTAMPTZ` | Date + time (with timezone) | 2024-01-15 10:30:00+00 |
| `UUID` | Universally unique identifier | a0eebc99-9c0b-4ef8... |
| `JSONB` | Binary JSON (queryable) | {"key": "value"} |
| `INTEGER[]` | Array of integers | {1, 2, 3} |
| `TEXT[]` | Array of text | {"a", "b", "c"} |
| `BYTEA` | Binary data | File contents |
| `INET` | IP address | 192.168.1.1 |

### Type choice rules of thumb

| Need | Use |
|------|-----|
| IDs | `BIGSERIAL` (auto) or `UUID` |
| Money | `NUMERIC(12,2)` — NEVER use float for money |
| Strings | `TEXT` (Postgres optimizes it the same as VARCHAR) |
| Timestamps | `TIMESTAMPTZ` — always store timezone |
| True/false | `BOOLEAN` |
| Flexible data | `JSONB` |
| Counts/amounts | `INTEGER` or `BIGINT` |

---

## psql Cheat Sheet

| Command | What it does |
|---------|-------------|
| `\l` | List databases |
| `\c dbname` | Connect to a database |
| `\dt` | List tables |
| `\d tablename` | Describe table structure |
| `\di` | List indexes |
| `\df` | List functions |
| `\dn` | List schemas |
| `\du` | List users/roles |
| `\x` | Toggle expanded display |
| `\timing` | Toggle query timing |
| `\i file.sql` | Execute SQL file |
| `\e` | Open editor for query |
| `\q` | Quit |

---

## Common PostgreSQL Functions

```sql
-- String
LENGTH('hello')                    -- 5
UPPER('hello')                     -- 'HELLO'
LOWER('HELLO')                     -- 'hello'
TRIM('  hello  ')                  -- 'hello'
CONCAT('hello', ' ', 'world')     -- 'hello world'
SUBSTRING('hello' FROM 1 FOR 3)   -- 'hel'
REPLACE('hello', 'l', 'r')        -- 'herro'

-- Date/Time
NOW()                              -- current timestamp
CURRENT_DATE                       -- today's date
AGE(timestamp)                     -- interval from timestamp to now
DATE_TRUNC('month', timestamp)     -- truncate to month start
EXTRACT(YEAR FROM timestamp)       -- get year component

-- Conditional
COALESCE(nullable_col, 'default') -- first non-null value
NULLIF(a, b)                       -- null if a = b
CASE WHEN x > 0 THEN 'positive' ELSE 'non-positive' END

-- Aggregates
COUNT(*), COUNT(col), COUNT(DISTINCT col)
SUM(col), AVG(col), MIN(col), MAX(col)
ARRAY_AGG(col)                     -- collect into array
STRING_AGG(col, ', ')              -- join into string
```
