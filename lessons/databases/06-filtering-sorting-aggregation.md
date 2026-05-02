# Lesson 06: Filtering, Sorting, and Aggregation

Lesson 05 covered how to create tables and do basic CRUD. Now you'll learn to
ask precise questions of your data — filtering rows, sorting results, grouping,
and computing aggregates. This is where SQL stops being "fancy INSERT/SELECT"
and starts being a query language.

---

## Setup: Seed Data

Run this in `psql -d learn_db` to create the working dataset for this lesson:

```sql
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    age         INTEGER,
    city        TEXT NOT NULL,
    country     TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    signup_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    in_stock    BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE orders (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    product_id  BIGINT NOT NULL,
    quantity    INTEGER NOT NULL DEFAULT 1,
    total_cents INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    ordered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO users (name, email, age, city, country, is_active, signup_date) VALUES
    ('Alice Chen', 'alice@example.com', 30, 'London', 'UK', true, '2023-01-15'),
    ('Bob Smith', 'bob@example.com', 25, 'Berlin', 'Germany', true, '2023-03-22'),
    ('Charlie Park', 'charlie@example.com', 35, 'London', 'UK', false, '2022-11-01'),
    ('Diana Ruiz', 'diana@example.com', 28, 'Madrid', 'Spain', true, '2023-06-10'),
    ('Eve Weber', 'eve@example.com', 32, 'Berlin', 'Germany', true, '2023-02-14'),
    ('Frank Müller', 'frank@example.com', 40, 'Munich', 'Germany', true, '2022-09-05'),
    ('Grace Kim', 'grace@example.com', 22, 'Tokyo', 'Japan', true, '2023-08-20'),
    ('Hank Brown', 'hank@example.com', 45, 'London', 'UK', false, '2022-06-30'),
    ('Ivy Tanaka', 'ivy@example.com', 27, 'Tokyo', 'Japan', true, '2023-07-12'),
    ('Jack O''Brien', 'jack@example.com', 33, 'Dublin', 'Ireland', true, '2023-04-01'),
    ('Karen Liu', 'karen@example.com', NULL, 'Beijing', 'China', true, '2023-09-15'),
    ('Leo Santos', 'leo@example.com', 29, 'Madrid', 'Spain', false, '2023-01-28');

INSERT INTO products (name, category, price_cents, in_stock) VALUES
    ('Laptop Pro', 'electronics', 129900, true),
    ('Wireless Mouse', 'electronics', 2999, true),
    ('USB-C Hub', 'electronics', 4999, true),
    ('Standing Desk', 'furniture', 59999, true),
    ('Office Chair', 'furniture', 34999, true),
    ('Desk Lamp', 'furniture', 7999, false),
    ('Notebook Set', 'stationery', 1299, true),
    ('Fountain Pen', 'stationery', 8999, true),
    ('Coffee Mug', 'accessories', 1599, true),
    ('Backpack', 'accessories', 7999, true);

INSERT INTO orders (user_id, product_id, quantity, total_cents, status, ordered_at) VALUES
    (1, 1, 1, 129900, 'completed', '2024-01-10 10:30:00+00'),
    (1, 2, 2, 5998, 'completed', '2024-01-10 10:30:00+00'),
    (2, 3, 1, 4999, 'completed', '2024-01-15 14:00:00+00'),
    (2, 7, 3, 3897, 'completed', '2024-02-01 09:00:00+00'),
    (3, 4, 1, 59999, 'cancelled', '2024-01-20 16:45:00+00'),
    (4, 1, 1, 129900, 'completed', '2024-02-05 11:20:00+00'),
    (4, 5, 1, 34999, 'shipped', '2024-02-05 11:20:00+00'),
    (5, 8, 1, 8999, 'completed', '2024-02-10 08:15:00+00'),
    (7, 2, 1, 2999, 'pending', '2024-03-01 13:00:00+00'),
    (7, 9, 2, 3198, 'pending', '2024-03-01 13:00:00+00'),
    (8, 10, 1, 7999, 'completed', '2024-01-05 17:30:00+00'),
    (9, 3, 2, 9998, 'shipped', '2024-02-20 10:00:00+00'),
    (10, 1, 1, 129900, 'completed', '2024-03-10 12:00:00+00'),
    (1, 9, 4, 6396, 'completed', '2024-03-15 09:30:00+00'),
    (6, 4, 1, 59999, 'completed', '2024-01-25 15:00:00+00');
```

---

## WHERE — Filtering Rows

WHERE tells PostgreSQL which rows to include. Think of it as a predicate
function — it runs against every row and keeps only those that return true.

**Analogy:** `WHERE` is `.filter()` in JavaScript or `.iter().filter()` in
Rust. The database evaluates the condition for each row and passes through
only the matches.

### Equality and Comparison

```sql
-- Exact match:
SELECT name, city FROM users WHERE city = 'London';

-- Not equal (both work, != is more common):
SELECT name, city FROM users WHERE city != 'London';
SELECT name, city FROM users WHERE city <> 'London';

-- Greater than / less than:
SELECT name, age FROM users WHERE age > 30;
SELECT name, age FROM users WHERE age <= 25;
```

### BETWEEN — Range Checks

```sql
-- Inclusive on both ends:
SELECT name, age FROM users WHERE age BETWEEN 25 AND 35;

-- Equivalent to:
SELECT name, age FROM users WHERE age >= 25 AND age <= 35;

-- Date ranges:
SELECT name, signup_date
FROM users
WHERE signup_date BETWEEN '2023-01-01' AND '2023-06-30';
```

### IN — Multiple Values

```sql
-- Match any value in the list:
SELECT name, city FROM users WHERE city IN ('London', 'Berlin', 'Tokyo');

-- Equivalent to:
SELECT name, city FROM users WHERE city = 'London' OR city = 'Berlin' OR city = 'Tokyo';

-- NOT IN — exclude a set:
SELECT name, city FROM users WHERE city NOT IN ('London', 'Berlin');
```

`IN` is cleaner than chaining ORs and easier to build dynamically in
application code (e.g., passing an array parameter).

### LIKE and ILIKE — Pattern Matching

```sql
-- % matches any number of characters:
SELECT name FROM users WHERE name LIKE 'A%';         -- starts with A
SELECT name FROM users WHERE email LIKE '%@example%'; -- contains @example

-- _ matches exactly one character:
SELECT name FROM users WHERE name LIKE '_ve%';        -- second and third chars are 've'

-- ILIKE = case-insensitive (PostgreSQL-specific):
SELECT name FROM users WHERE name ILIKE 'alice%';     -- matches Alice, ALICE, alice
SELECT name FROM users WHERE email ILIKE '%EXAMPLE%'; -- matches example, Example, EXAMPLE
```

**Rule of thumb:** Use `ILIKE` instead of `LIKE` when searching user input.
Users don't care about case when searching.

### IS NULL / IS NOT NULL

```sql
-- Find rows where age is unknown:
SELECT name, age FROM users WHERE age IS NULL;

-- Find rows where age IS known:
SELECT name, age FROM users WHERE age IS NOT NULL;
```

**Critical:** You cannot use `= NULL`. NULL is not a value — it's the absence
of a value. `= NULL` always returns unknown (not true), so zero rows match.

```sql
-- WRONG — this returns nothing, even if NULLs exist:
SELECT name FROM users WHERE age = NULL;

-- CORRECT:
SELECT name FROM users WHERE age IS NULL;
```

This is the same trap as `None` in Python or `nil` in Go. You don't compare
with `==`, you check with a special operator.

---

## AND, OR, NOT — Combining Conditions

```sql
-- AND: both must be true:
SELECT name, city, age FROM users
WHERE city = 'London' AND age > 30;

-- OR: either can be true:
SELECT name, city FROM users
WHERE city = 'London' OR city = 'Berlin';

-- NOT: negate a condition:
SELECT name FROM users WHERE NOT is_active;

-- Combined with parentheses (order matters!):
SELECT name, city, country FROM users
WHERE (city = 'London' OR city = 'Berlin') AND is_active = true;

-- Without parentheses, AND binds tighter than OR:
SELECT name, city, country FROM users
WHERE city = 'London' OR city = 'Berlin' AND is_active = true;
-- This means: city='London' OR (city='Berlin' AND is_active=true)
-- Probably NOT what you intended!
```

**Rule of thumb:** Always use parentheses when mixing AND and OR. Just like
arithmetic operator precedence, relying on implicit precedence causes bugs.

---

## ORDER BY — Sorting Results

```sql
-- Sort ascending (default):
SELECT name, age FROM users ORDER BY age;
SELECT name, age FROM users ORDER BY age ASC;

-- Sort descending:
SELECT name, age FROM users ORDER BY age DESC;

-- Multiple sort columns (tie-breaker):
SELECT name, city, age FROM users
ORDER BY city ASC, age DESC;
-- First sort by city alphabetically, then within each city, oldest first.

-- NULLs sort last by default in ASC, first in DESC.
-- Control this explicitly:
SELECT name, age FROM users ORDER BY age ASC NULLS FIRST;
SELECT name, age FROM users ORDER BY age DESC NULLS LAST;

-- Sort by column position (fragile, but useful in quick queries):
SELECT name, age, city FROM users ORDER BY 3, 2;
-- Sorts by 3rd column (city), then 2nd column (age)
```

---

## LIMIT and OFFSET — Pagination

```sql
-- First 5 rows:
SELECT name, age FROM users ORDER BY age LIMIT 5;

-- Skip 5, take next 5 (page 2):
SELECT name, age FROM users ORDER BY age LIMIT 5 OFFSET 5;

-- Page 3:
SELECT name, age FROM users ORDER BY age LIMIT 5 OFFSET 10;
```

**Analogy:** `LIMIT` is `.take(n)` and `OFFSET` is `.skip(n)` in Rust
iterators. `LIMIT 5 OFFSET 10` means skip 10, then take 5.

**Warning about OFFSET pagination:** OFFSET is slow on large datasets. To get
page 1000, the database still reads and discards 999 pages worth of rows.
For large tables, use keyset pagination instead:

```sql
-- Instead of OFFSET:
SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 10000;

-- Use keyset (cursor) pagination:
SELECT * FROM users WHERE id > 10000 ORDER BY id LIMIT 20;
-- This uses the index and is fast regardless of page number.
```

---

## Aggregate Functions

Aggregate functions collapse multiple rows into a single value.

**Analogy:** These are like `.reduce()` in JavaScript or `.fold()` in Rust.
They take a set of rows and produce one summary value.

```sql
-- COUNT: how many rows?
SELECT count(*) FROM users;                       -- all rows (12)
SELECT count(*) FROM users WHERE is_active;       -- active only (9)
SELECT count(age) FROM users;                     -- non-NULL ages (11)

-- SUM: total of a column
SELECT sum(total_cents) FROM orders;              -- total revenue
SELECT sum(total_cents) / 100.0 AS total_dollars FROM orders;

-- AVG: average value
SELECT avg(age) FROM users;                       -- average age
SELECT round(avg(age), 1) AS avg_age FROM users;  -- rounded

-- MIN and MAX:
SELECT min(age), max(age) FROM users;
SELECT min(signup_date), max(signup_date) FROM users;
SELECT min(price_cents), max(price_cents) FROM products;

-- Combine multiple aggregates:
SELECT
    count(*) AS total_orders,
    sum(total_cents) / 100.0 AS revenue_dollars,
    round(avg(total_cents) / 100.0, 2) AS avg_order_dollars,
    min(total_cents) / 100.0 AS smallest_order,
    max(total_cents) / 100.0 AS largest_order
FROM orders
WHERE status = 'completed';
```

**Important:** `count(*)` counts ALL rows. `count(column)` counts non-NULL
values in that column. These can give different numbers.

---

## GROUP BY — Aggregates Per Category

GROUP BY splits rows into groups, then applies the aggregate to each group
separately.

**Analogy:** Imagine sorting a deck of cards by suit, then counting how many
cards are in each pile. GROUP BY is the "sort into piles" step, and the
aggregate function is the "count each pile" step.

```sql
-- Count users per city:
SELECT city, count(*) AS user_count
FROM users
GROUP BY city
ORDER BY user_count DESC;

-- Count users per country:
SELECT country, count(*) AS user_count
FROM users
GROUP BY country;

-- Revenue per order status:
SELECT
    status,
    count(*) AS order_count,
    sum(total_cents) / 100.0 AS revenue_dollars
FROM orders
GROUP BY status
ORDER BY revenue_dollars DESC;

-- Products per category with price range:
SELECT
    category,
    count(*) AS product_count,
    min(price_cents) / 100.0 AS cheapest,
    max(price_cents) / 100.0 AS most_expensive,
    round(avg(price_cents) / 100.0, 2) AS avg_price
FROM products
GROUP BY category
ORDER BY avg_price DESC;

-- Group by multiple columns:
SELECT country, city, count(*) AS user_count
FROM users
GROUP BY country, city
ORDER BY country, user_count DESC;
```

**Critical rule:** Every column in your SELECT must either be in the GROUP BY
or inside an aggregate function. You can't select a non-grouped, non-aggregated
column — the database wouldn't know which value to show.

```sql
-- WRONG: name is not grouped or aggregated
-- SELECT name, city, count(*) FROM users GROUP BY city;
-- ERROR: column "users.name" must appear in the GROUP BY clause
--        or be used in an aggregate function

-- CORRECT:
SELECT city, count(*) FROM users GROUP BY city;
```

---

## HAVING — Filtering Groups

WHERE filters individual rows *before* grouping. HAVING filters groups *after*
aggregation.

**Analogy:** WHERE is the bouncer at the door (checks each person). HAVING is
the fire marshal (checks if the room is too full). Different jobs, different
timing.

```sql
-- Cities with more than 1 user:
SELECT city, count(*) AS user_count
FROM users
GROUP BY city
HAVING count(*) > 1;

-- Categories where average price exceeds $50:
SELECT
    category,
    round(avg(price_cents) / 100.0, 2) AS avg_price
FROM products
GROUP BY category
HAVING avg(price_cents) > 5000;

-- Combine WHERE and HAVING:
-- Active users per country, but only countries with 2+ active users:
SELECT country, count(*) AS active_count
FROM users
WHERE is_active = true
GROUP BY country
HAVING count(*) >= 2;
```

Execution order matters:

```
1. FROM      — which table?
2. WHERE     — filter individual rows
3. GROUP BY  — split into groups
4. HAVING    — filter groups
5. SELECT    — pick columns and compute expressions
6. ORDER BY  — sort the result
7. LIMIT     — cap the output
```

---

## DISTINCT — Unique Values

```sql
-- Unique cities:
SELECT DISTINCT city FROM users;

-- Unique country/city combinations:
SELECT DISTINCT country, city FROM users;

-- Count of unique cities:
SELECT count(DISTINCT city) FROM users;

-- Count of unique countries:
SELECT count(DISTINCT country) FROM users;
```

**DISTINCT applies to the entire row**, not just the first column. So
`SELECT DISTINCT country, city` gives unique pairs.

---

## CASE WHEN — Conditional Logic in Queries

CASE WHEN is SQL's if/else. It lets you compute new values based on conditions.

**Analogy:** It's a `match` expression in Rust or a `switch` in Go, but
inline within your query.

```sql
-- Categorize users by age:
SELECT
    name,
    age,
    CASE
        WHEN age IS NULL THEN 'unknown'
        WHEN age < 25 THEN 'junior'
        WHEN age < 35 THEN 'mid-career'
        ELSE 'senior'
    END AS age_group
FROM users;

-- Translate status codes to human-readable labels:
SELECT
    id,
    status,
    CASE status
        WHEN 'pending' THEN 'Awaiting Processing'
        WHEN 'shipped' THEN 'On Its Way'
        WHEN 'completed' THEN 'Delivered'
        WHEN 'cancelled' THEN 'Cancelled'
        ELSE 'Unknown'
    END AS display_status
FROM orders;

-- Use CASE inside aggregates (conditional counting):
SELECT
    count(*) AS total_orders,
    count(*) FILTER (WHERE status = 'completed') AS completed,
    count(*) FILTER (WHERE status = 'pending') AS pending,
    count(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders;

-- The above uses PostgreSQL's FILTER syntax. The CASE equivalent:
SELECT
    count(*) AS total_orders,
    sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
    sum(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
    sum(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
FROM orders;

-- CASE in ORDER BY (custom sort order):
SELECT name, city FROM users
ORDER BY
    CASE city
        WHEN 'London' THEN 1
        WHEN 'Berlin' THEN 2
        WHEN 'Tokyo' THEN 3
        ELSE 4
    END;
```

PostgreSQL's `FILTER (WHERE ...)` syntax is cleaner than CASE inside
aggregates. It's a Postgres extension — not available in all databases,
but you should prefer it when writing PostgreSQL.

---

## Putting It All Together

Here's a real-world query combining everything from this lesson:

```sql
-- Monthly revenue report for completed orders,
-- only months with revenue over $100:
SELECT
    date_trunc('month', ordered_at)::DATE AS month,
    count(*) AS order_count,
    sum(total_cents) / 100.0 AS revenue_dollars,
    round(avg(total_cents) / 100.0, 2) AS avg_order_dollars,
    min(total_cents) / 100.0 AS smallest_order,
    max(total_cents) / 100.0 AS largest_order
FROM orders
WHERE status = 'completed'
GROUP BY date_trunc('month', ordered_at)
HAVING sum(total_cents) > 10000
ORDER BY month;
```

Step by step:
1. **FROM orders** — start with the orders table
2. **WHERE status = 'completed'** — only completed orders
3. **GROUP BY month** — group into months
4. **HAVING sum > 10000** — only months above $100 revenue
5. **SELECT** — compute the aggregates
6. **ORDER BY month** — chronological order

---

## Exercises

### Exercise 1: Filtering practice

Write queries against the `users` table to find:
1. All users in Germany
2. Users aged between 25 and 35 (inclusive)
3. Users whose name starts with a letter between A and F
4. Users who signed up in 2023
5. Users in London or Tokyo who are still active
6. Users whose age is unknown (NULL)

### Exercise 2: Sorting and pagination

1. List all users sorted by signup date, newest first
2. Get the 3 oldest users
3. Implement page 2 of a user list with 4 users per page, sorted by name
4. Sort users by country, and within each country by age (youngest first),
   handling NULLs so they appear last

### Exercise 3: Aggregation

1. What is the average age of active users?
2. What is the total value of all products currently in stock?
3. Which category has the most products?
4. How many orders does each status have, and what's the total revenue per status?
5. What is the average order value for orders placed after February 1, 2024?

### Exercise 4: GROUP BY and HAVING

1. Which cities have more than 1 user? Show the city and count
2. For each product category, show the number of products and average price.
   Only include categories where the average price is over $30
3. Which users have placed more than 1 order? Show user_id and order count
4. Group orders by month. For each month, show the count and total revenue.
   Only show months with 3+ orders

### Exercise 5: CASE WHEN

1. Create a query that labels products as 'budget' (under $20), 'mid-range'
   ($20-$100), or 'premium' (over $100). Show the count in each tier
2. Write a query that shows each user's "engagement level" based on their
   number of orders: 'none' (0 orders), 'low' (1), 'medium' (2-3),
   'high' (4+). Hint: you'll need a subquery or join — try it and revisit
   after Lesson 07 if needed

### Exercise 6: Combined challenge

Write a single query that produces a "User Activity Report" showing:
- Each country
- Number of active users in that country
- Number of inactive users
- Total orders from users in that country
- Total revenue from those orders

Sort by total revenue descending. Only include countries with at least 1 order.

---

## Key Takeaways

1. **WHERE filters rows, HAVING filters groups.** Different jobs, different timing.
2. **Never use `= NULL`.** Always use `IS NULL` / `IS NOT NULL`.
3. **Use parentheses with AND/OR.** AND binds tighter than OR.
4. **OFFSET pagination is slow at scale.** Use keyset pagination instead.
5. **Every SELECT column must be in GROUP BY or an aggregate.** No exceptions.
6. **CASE WHEN is your inline if/else.** Use it for categorization, conditional
   counting, and custom sort orders.
7. **`FILTER (WHERE ...)`** is PostgreSQL's cleaner syntax for conditional aggregates.
8. **Query execution order:** FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.

Next: [Lesson 07 — Joins: Connecting Tables Together](./07-joins.md)
