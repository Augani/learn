# Lesson 05: Tables, Types, and Your First Queries

In the first four lessons, you learned how databases store data on disk, use
indexes to find it fast, and plan query execution. Now you actually build
something. This lesson is where you start writing SQL that creates real
structures and manipulates real data.

---

## What Is a Table?

A table is a spreadsheet with strict rules. Every column has a name and a fixed
type. Every row follows those rules or the database rejects it.

**Analogy:** Think of a Go struct or a TypeScript interface. You define the
shape once, and every instance must match. A table is that — but the database
enforces it at the storage level.

```go
// In Go, this is a struct:
type User struct {
    ID    int64
    Name  string
    Email string
    Age   int
}
```

```sql
-- In PostgreSQL, this is a table:
CREATE TABLE users (
    id    BIGSERIAL PRIMARY KEY,
    name  TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    age   INTEGER
);
```

Same idea, different enforcement point. The struct enforces shape at compile
time. The table enforces shape at write time.

---

## CREATE TABLE Syntax

```sql
CREATE TABLE table_name (
    column_name  DATA_TYPE  CONSTRAINTS,
    column_name  DATA_TYPE  CONSTRAINTS,
    ...
);
```

Let's connect to our database and create a real table:

```sql
-- Connect to learn_db first:
-- psql -d learn_db

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    in_stock    BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Breaking this down:

- `BIGSERIAL PRIMARY KEY` — auto-incrementing ID (covered below)
- `TEXT NOT NULL` — required text field
- `TEXT` — optional text field (NULLs allowed)
- `INTEGER NOT NULL` — required integer
- `BOOLEAN NOT NULL DEFAULT true` — required boolean, defaults to true if omitted
- `TIMESTAMPTZ NOT NULL DEFAULT now()` — timestamp with timezone, defaults to current time

---

## PostgreSQL Data Types

Here's what you'll actually use 95% of the time:

### Numbers

| Type | Range | Use When |
|------|-------|----------|
| `SMALLINT` | -32,768 to 32,767 | Status codes, small enums |
| `INTEGER` | -2.1 billion to 2.1 billion | Most counts, quantities, ages |
| `BIGINT` | -9.2 quintillion to 9.2 quintillion | IDs on high-volume tables, money in cents |
| `NUMERIC(p, s)` | Exact, arbitrary precision | Money (when exactness matters), scientific data |
| `REAL` | 6 decimal digits precision | Approximate values where speed > precision |
| `DOUBLE PRECISION` | 15 decimal digits precision | Approximate values needing more precision |

**Rule of thumb:** Use `INTEGER` by default. Use `BIGINT` for IDs and anything
that could exceed 2 billion. Use `NUMERIC` for money. Never use `REAL` or
`DOUBLE PRECISION` for money.

```sql
-- Why not floats for money?
SELECT 0.1::REAL + 0.2::REAL;
-- Returns: 0.30000001192092896

SELECT 0.1::NUMERIC + 0.2::NUMERIC;
-- Returns: 0.3

-- This is the same as f32 rounding in Rust or float64 in Go.
-- Store money as cents (INTEGER) or use NUMERIC.
```

### Text

| Type | Description | Use When |
|------|-------------|----------|
| `TEXT` | Unlimited length | Almost always — names, emails, descriptions |
| `VARCHAR(n)` | Limited to n characters | When you genuinely need a hard limit |
| `CHAR(n)` | Fixed width, space-padded | Almost never — legacy use only |

**Rule of thumb:** Just use `TEXT`. In PostgreSQL, `TEXT` and `VARCHAR` have
identical performance. Adding a length constraint via `VARCHAR(255)` is a
MySQL habit that doesn't help in Postgres. If you need to enforce max length,
use a `CHECK` constraint instead — it gives a better error message.

```sql
-- These are functionally identical in PostgreSQL:
CREATE TABLE example1 (name TEXT);
CREATE TABLE example2 (name VARCHAR(255));

-- If you genuinely need a length limit, prefer:
CREATE TABLE example3 (
    name TEXT CHECK (length(name) <= 100)
);
```

### Booleans

| Type | Values | Storage |
|------|--------|---------|
| `BOOLEAN` | `true` / `false` / `NULL` | 1 byte |

```sql
-- All of these work:
INSERT INTO products (name, price_cents, in_stock) VALUES ('Widget', 999, true);
INSERT INTO products (name, price_cents, in_stock) VALUES ('Gadget', 1999, 't');
INSERT INTO products (name, price_cents, in_stock) VALUES ('Doohickey', 499, 'yes');
-- PostgreSQL accepts: true/false, 't'/'f', 'yes'/'no', '1'/'0', 'on'/'off'
```

### Timestamps and Dates

| Type | What It Stores | Use When |
|------|---------------|----------|
| `TIMESTAMPTZ` | Date + time + timezone | Almost always — events, created_at, updated_at |
| `TIMESTAMP` | Date + time, NO timezone | Almost never — timezone-unaware causes bugs |
| `DATE` | Just the date | Birthdays, due dates |
| `TIME` | Just the time | Rare — scheduling |
| `INTERVAL` | A duration | Time differences, "30 days" |

**Rule of thumb:** Always use `TIMESTAMPTZ` (timestamp WITH time zone). Using
`TIMESTAMP` (without timezone) is like using a naive datetime in Python — it
works until your users are in different time zones, then it doesn't.

```sql
-- TIMESTAMPTZ stores everything in UTC internally, converts on display:
SET timezone = 'America/New_York';
SELECT now();
-- 2025-01-15 14:30:00-05

SET timezone = 'Europe/London';
SELECT now();
-- 2025-01-15 19:30:00+00

-- Same moment in time, different display.
```

### UUIDs

```sql
-- Enable the extension (once per database):
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserting with auto-generated UUID:
INSERT INTO sessions (user_id) VALUES (1);

-- Inserting with explicit UUID:
INSERT INTO sessions (id, user_id) VALUES ('550e8400-e29b-41d4-a716-446655440000', 2);
```

### SERIAL / BIGSERIAL — Auto-Incrementing IDs

These aren't real types — they're shorthand for creating a sequence:

```sql
-- This:
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY
);

-- Is equivalent to:
CREATE SEQUENCE users_id_seq;
CREATE TABLE users (
    id BIGINT NOT NULL DEFAULT nextval('users_id_seq') PRIMARY KEY
);
ALTER SEQUENCE users_id_seq OWNED BY users.id;
```

| Type | Underlying Type | Max Value |
|------|----------------|-----------|
| `SERIAL` | `INTEGER` | 2.1 billion |
| `BIGSERIAL` | `BIGINT` | 9.2 quintillion |
| `SMALLSERIAL` | `SMALLINT` | 32,767 |

---

## SERIAL vs BIGSERIAL vs UUID — Which ID Strategy?

This is a real decision you'll face on every table:

### BIGSERIAL (auto-increment integer)

**Pros:**
- Small (8 bytes), fast to compare, index-friendly
- Human-readable: user #4582 is meaningful
- Naturally ordered: higher ID = created later

**Cons:**
- Exposes information: competitors can estimate your user count
- Requires the database to generate IDs (can't generate in application code)
- Merging databases is painful (ID collisions)

### UUID v4 (random)

**Pros:**
- Globally unique — no collisions ever, no coordination needed
- Can be generated in application code before hitting the database
- Doesn't leak information (no sequential guessing)

**Cons:**
- Large (16 bytes vs 8 for BIGINT)
- Random = bad B-tree locality (see Lesson 03). Inserts scatter across the index
- Not human-readable: `550e8400-e29b-41d4-a716-446655440000` means nothing

### UUID v7 (time-ordered, newer standard)

**Pros:**
- Globally unique like UUIDv4
- Time-ordered: preserves B-tree locality (great insert performance)
- Encodes creation time in the ID itself

**Cons:**
- 16 bytes (same as v4)
- Not natively supported in PostgreSQL yet (generate in application code)

**Rule of thumb:**
- Internal tables (users, products, orders): **BIGSERIAL**. Simple, fast, readable.
- Externally visible IDs (API resources, webhook targets): **UUID**. Don't leak
  sequential info to the outside world.
- High-volume distributed systems: **UUID v7**. Time-ordered for performance.

---

## NOT NULL and DEFAULT

### NOT NULL

`NOT NULL` means this column must always have a value. No exceptions.

```sql
CREATE TABLE orders (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,           -- every order must have a user
    total_cents INTEGER NOT NULL,          -- every order must have a total
    notes      TEXT                        -- notes are optional (NULL allowed)
);

-- This works:
INSERT INTO orders (user_id, total_cents) VALUES (1, 4999);

-- This fails:
INSERT INTO orders (user_id, total_cents) VALUES (NULL, 4999);
-- ERROR: null value in column "user_id" violates not-null constraint
```

**Rule of thumb:** Make everything `NOT NULL` unless you have a specific reason
to allow NULL. NULL introduces three-valued logic (true/false/unknown) and is
a common source of bugs.

### DEFAULT

`DEFAULT` provides a value when you don't specify one:

```sql
CREATE TABLE articles (
    id          BIGSERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'draft',
    view_count  INTEGER NOT NULL DEFAULT 0,
    published   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only need to provide title and body:
INSERT INTO articles (title, body) VALUES ('Hello World', 'My first article.');

-- Check what was auto-filled:
SELECT * FROM articles;
-- id=1, title='Hello World', body='My first article.',
-- status='draft', view_count=0, published=false,
-- created_at=2025-01-15 14:30:00+00, updated_at=2025-01-15 14:30:00+00
```

---

## Your First Queries: INSERT, SELECT, UPDATE, DELETE

Let's set up a working example. Run this in `psql -d learn_db`:

```sql
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    age         INTEGER,
    city        TEXT NOT NULL DEFAULT 'Unknown',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### INSERT — Adding Rows

```sql
-- Insert a single row:
INSERT INTO users (name, email, age, city)
VALUES ('Alice', 'alice@example.com', 30, 'London');

-- Insert multiple rows:
INSERT INTO users (name, email, age, city) VALUES
    ('Bob', 'bob@example.com', 25, 'Berlin'),
    ('Charlie', 'charlie@example.com', 35, 'London'),
    ('Diana', 'diana@example.com', 28, 'Paris'),
    ('Eve', 'eve@example.com', 32, 'Berlin');

-- Insert with defaults (city defaults to 'Unknown', is_active to true):
INSERT INTO users (name, email, age)
VALUES ('Frank', 'frank@example.com', 40);

-- Insert and return the created row:
INSERT INTO users (name, email, age, city)
VALUES ('Grace', 'grace@example.com', 22, 'Tokyo')
RETURNING *;

-- Insert and return just the ID:
INSERT INTO users (name, email, age, city)
VALUES ('Hank', 'hank@example.com', 45, 'London')
RETURNING id;
```

`RETURNING` is a PostgreSQL superpower — it gives back the inserted row
without a second query. In application code, this is how you get the
auto-generated ID.

### SELECT — Reading Rows

```sql
-- Select all columns, all rows:
SELECT * FROM users;

-- Select specific columns:
SELECT name, email, city FROM users;

-- Select with a condition:
SELECT name, email FROM users WHERE city = 'London';

-- Select with multiple conditions:
SELECT name, age FROM users WHERE city = 'Berlin' AND age > 24;

-- Count rows:
SELECT count(*) FROM users;

-- Select one row by ID:
SELECT * FROM users WHERE id = 1;
```

**Rule:** Avoid `SELECT *` in application code. It fetches every column,
including ones you don't need. It also breaks when you add columns. Always
list the columns you want.

### UPDATE — Modifying Rows

```sql
-- Update one row:
UPDATE users SET city = 'Manchester' WHERE id = 1;

-- Update multiple columns:
UPDATE users SET age = 31, city = 'Edinburgh' WHERE id = 1;

-- Update multiple rows:
UPDATE users SET is_active = false WHERE city = 'Berlin';

-- Update with RETURNING:
UPDATE users SET age = age + 1 WHERE id = 1 RETURNING *;

-- DANGER: Update without WHERE updates ALL rows:
-- UPDATE users SET is_active = false;  -- This hits every row!
```

**Always include a WHERE clause on UPDATE.** An UPDATE without WHERE modifies
every row in the table. This is the database equivalent of `rm -rf /`.

### DELETE — Removing Rows

```sql
-- Delete one row:
DELETE FROM users WHERE id = 6;

-- Delete with a condition:
DELETE FROM users WHERE is_active = false;

-- Delete and return what was deleted:
DELETE FROM users WHERE id = 5 RETURNING *;

-- DANGER: Delete without WHERE deletes everything:
-- DELETE FROM users;  -- Drops every row!
```

**Same rule as UPDATE:** Always include a WHERE clause. If you want to
delete all rows, use `TRUNCATE users` — it's explicit about what it does
and significantly faster for full table wipes.

---

## Practical Example: Building a Products Table

```sql
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    sku         TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    category    TEXT NOT NULL,
    in_stock    BOOLEAN NOT NULL DEFAULT true,
    stock_count INTEGER NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
    weight_grams INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO products (sku, name, description, price_cents, category, stock_count, weight_grams) VALUES
    ('LAPTOP-001', 'ThinkPad X1 Carbon', '14" ultrabook, Intel i7, 16GB RAM', 134999, 'electronics', 45, 1130),
    ('LAPTOP-002', 'MacBook Air M3', '13.6" Retina, 8GB RAM, 256GB SSD', 109900, 'electronics', 120, 1240),
    ('PHONE-001', 'Pixel 8', '6.2" OLED, 128GB, Android 14', 69900, 'electronics', 200, 187),
    ('PHONE-002', 'iPhone 15', '6.1" Super Retina, 128GB', 79900, 'electronics', 150, 171),
    ('BOOK-001', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 3999, 'books', 500, 680),
    ('BOOK-002', 'The Pragmatic Programmer', 'Hunt and Thomas, 20th anniversary', 4499, 'books', 300, 720),
    ('DESK-001', 'Standing Desk Pro', 'Electric sit/stand, 60x30 inches', 59999, 'furniture', 25, 34000),
    ('CHAIR-001', 'Ergonomic Office Chair', 'Mesh back, lumbar support', 34999, 'furniture', 40, 15000),
    ('CABLE-001', 'USB-C Cable 6ft', 'Braided, 100W PD charging', 1299, 'accessories', 1000, 45),
    ('CABLE-002', 'HDMI 2.1 Cable 3ft', '8K/60Hz, 4K/120Hz', 1499, 'accessories', 800, 55);

-- Verify:
SELECT sku, name, price_cents, category, stock_count FROM products;
```

Try some queries on this data:

```sql
-- Electronics under $1000:
SELECT name, price_cents / 100.0 AS price_dollars
FROM products
WHERE category = 'electronics' AND price_cents < 100000;

-- Out of stock items (or low stock):
SELECT sku, name, stock_count
FROM products
WHERE stock_count < 50;

-- Total inventory value:
SELECT sum(price_cents * stock_count) / 100.0 AS total_value_dollars
FROM products;
```

---

## Dropping and Altering Tables

```sql
-- Delete a table permanently:
DROP TABLE products;

-- Delete only if it exists (no error if missing):
DROP TABLE IF EXISTS products;

-- Add a column:
ALTER TABLE users ADD COLUMN phone TEXT;

-- Remove a column:
ALTER TABLE users DROP COLUMN phone;

-- Rename a column:
ALTER TABLE users RENAME COLUMN city TO location;

-- Change a column's default:
ALTER TABLE users ALTER COLUMN city SET DEFAULT 'Unknown';

-- Add a NOT NULL constraint (only works if no existing NULLs):
ALTER TABLE users ALTER COLUMN age SET NOT NULL;

-- Remove a NOT NULL constraint:
ALTER TABLE users ALTER COLUMN age DROP NOT NULL;
```

---

## Exercises

### Exercise 1: Create and populate a table

Create an `employees` table with:
- Auto-incrementing BIGSERIAL id
- `first_name` (required)
- `last_name` (required)
- `email` (required, unique)
- `department` (required, default 'engineering')
- `salary_cents` (required, must be positive)
- `hire_date` (required, default to today)
- `is_remote` (required, default false)

Insert at least 8 employees across 3 departments.

### Exercise 2: CRUD operations

Using your employees table:
1. Select all remote employees
2. Give everyone in 'engineering' a 10% raise
3. Change one employee's department from 'engineering' to 'management'
4. Delete all employees hired before a certain date
5. Use `RETURNING` to see what each UPDATE/DELETE affected

### Exercise 3: Type exploration

```sql
-- Run each of these and observe what happens:

-- Integer overflow:
SELECT 2147483647::INTEGER + 1;

-- Text vs VARCHAR:
CREATE TABLE type_test (
    a TEXT,
    b VARCHAR(5)
);
INSERT INTO type_test VALUES ('hello world', 'hello world');

-- Timestamp arithmetic:
SELECT now() - INTERVAL '30 days';
SELECT now() + INTERVAL '2 hours 30 minutes';
SELECT age(now(), '1990-06-15'::DATE);

-- UUID generation:
SELECT gen_random_uuid();
SELECT gen_random_uuid();
SELECT gen_random_uuid();
-- Are any the same?

-- Boolean expressions:
SELECT true AND NULL;
SELECT false AND NULL;
SELECT true OR NULL;
SELECT NULL = NULL;
SELECT NULL IS NULL;
```

### Exercise 4: Design a table

Design a `blog_posts` table for a blogging platform. Consider:
- What columns does it need?
- Which should be NOT NULL?
- What defaults make sense?
- What type should each column be?
- Should the ID be BIGSERIAL or UUID?

Write the CREATE TABLE statement, insert 5 posts, and write queries to:
1. Find all published posts
2. Find drafts older than 7 days
3. Count posts per author

---

## Key Takeaways

1. **Tables are typed structs** enforced by the database, not the compiler.
2. **Use `TEXT` for strings** in PostgreSQL. `VARCHAR(n)` adds nothing.
3. **Use `TIMESTAMPTZ`** (with timezone), not `TIMESTAMP`.
4. **Use `BIGSERIAL` for internal IDs**, UUID for externally visible ones.
5. **Make columns `NOT NULL` by default.** Allow NULL only with a reason.
6. **Always use WHERE with UPDATE and DELETE.** Forgetting it affects every row.
7. **Use `RETURNING`** to get back inserted/updated/deleted rows without a second query.
8. **Store money as integer cents** or `NUMERIC`. Never as `REAL`/`DOUBLE PRECISION`.

Next: [Lesson 06 — Filtering, Sorting, and Aggregation](./06-filtering-sorting-aggregation.md)
