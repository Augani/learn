# Lesson 07: Joins — Connecting Tables Together

Up to now, every query has pulled from a single table. Real applications don't
work that way. Users place orders. Orders contain products. Products belong to
categories. Data is split across tables, and joins are how you stitch it back
together.

---

## Why Data Is Split Across Tables

**Analogy:** Imagine a company with a single giant spreadsheet that has every
piece of information — employee name, department name, department budget,
office address, office phone number — all repeated on every row.

When the department moves to a new office, you'd update hundreds of rows. Miss
one? Now you have contradictory data. This is called an **update anomaly**.

The solution is **normalization**: store each fact once, in its own table, and
link them with IDs.

```
BEFORE (one big table — denormalized):
┌─────────┬────────────┬─────────────┬───────────┐
│ emp_name│ dept_name  │ dept_budget │ office    │
├─────────┼────────────┼─────────────┼───────────┤
│ Alice   │ Engineering│ $2,000,000  │ Floor 3   │
│ Bob     │ Engineering│ $2,000,000  │ Floor 3   │  ← repeated!
│ Charlie │ Marketing  │ $800,000    │ Floor 1   │
│ Diana   │ Engineering│ $2,000,000  │ Floor 3   │  ← repeated again!
└─────────┴────────────┴─────────────┴───────────┘

AFTER (normalized — separate tables):
employees:                    departments:
┌────┬─────────┬─────────┐   ┌────┬────────────┬─────────────┬─────────┐
│ id │ name    │ dept_id │   │ id │ name       │ budget      │ office  │
├────┼─────────┼─────────┤   ├────┼────────────┼─────────────┼─────────┤
│ 1  │ Alice   │ 1       │   │ 1  │ Engineering│ $2,000,000  │ Floor 3 │
│ 2  │ Bob     │ 1       │   │ 2  │ Marketing  │ $800,000    │ Floor 1 │
│ 3  │ Charlie │ 2       │   └────┴────────────┴─────────────┴─────────┘
│ 4  │ Diana   │ 1       │
└────┴─────────┴─────────┘
```

Now department info lives in one place. Change the office once, it's correct
everywhere. But to get "Alice's department budget," you need to **join** the
two tables. That's what this lesson teaches.

---

## Setup: Seed Data

Run this in `psql -d learn_db`:

```sql
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    city        TEXT NOT NULL
);

CREATE TABLE categories (
    id   BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    category_id BIGINT REFERENCES categories(id),
    price_cents INTEGER NOT NULL
);

CREATE TABLE orders (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    status      TEXT NOT NULL DEFAULT 'pending',
    ordered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id          BIGSERIAL PRIMARY KEY,
    order_id    BIGINT NOT NULL REFERENCES orders(id),
    product_id  BIGINT NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL
);

INSERT INTO users (name, email, city) VALUES
    ('Alice Chen', 'alice@example.com', 'London'),
    ('Bob Smith', 'bob@example.com', 'Berlin'),
    ('Charlie Park', 'charlie@example.com', 'London'),
    ('Diana Ruiz', 'diana@example.com', 'Madrid'),
    ('Eve Weber', 'eve@example.com', 'Berlin');

INSERT INTO categories (name) VALUES
    ('Electronics'),
    ('Books'),
    ('Clothing'),
    ('Food');

INSERT INTO products (name, category_id, price_cents) VALUES
    ('Laptop', 1, 129900),
    ('Wireless Mouse', 1, 2999),
    ('USB-C Cable', 1, 1299),
    ('DDIA Book', 2, 3999),
    ('Pragmatic Programmer', 2, 4499),
    ('T-Shirt', 3, 2499),
    ('Hoodie', 3, 5999),
    ('Organic Coffee', NULL, 1899);

INSERT INTO orders (user_id, status, ordered_at) VALUES
    (1, 'completed', '2024-01-10 10:00:00+00'),
    (1, 'completed', '2024-02-15 14:30:00+00'),
    (2, 'completed', '2024-01-20 09:00:00+00'),
    (3, 'shipped', '2024-03-01 16:00:00+00'),
    (4, 'pending', '2024-03-10 11:00:00+00');

INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES
    (1, 1, 1, 129900),
    (1, 2, 2, 2999),
    (2, 4, 1, 3999),
    (2, 6, 3, 2499),
    (3, 3, 5, 1299),
    (3, 5, 1, 4499),
    (4, 7, 2, 5999),
    (5, 1, 1, 129900),
    (5, 4, 1, 3999);
```

Notice: Eve (user 5) has no orders. "Organic Coffee" (product 8) has no
category. "Food" (category 4) has no products. These edge cases will make
the difference between join types visible.

---

## Table Aliases

Before diving into joins, learn aliases. They save typing and make queries
readable.

```sql
-- Without aliases:
SELECT users.name, orders.status
FROM users
JOIN orders ON orders.user_id = users.id;

-- With aliases:
SELECT u.name, o.status
FROM users u
JOIN orders o ON o.user_id = u.id;
```

`u` is an alias for `users`, `o` for `orders`. Use them everywhere.

---

## INNER JOIN

An INNER JOIN returns only rows that have a match in **both** tables. If a row
in the left table has no match in the right table, it's excluded. If a row in
the right table has no match in the left, it's excluded too.

```
┌───────────────────────────────────┐
│         INNER JOIN                │
│                                   │
│   Table A       Table B           │
│   ┌─────┐       ┌─────┐          │
│   │     │       │     │          │
│   │  ┌──┼───────┼──┐  │          │
│   │  │  │       │  │  │          │
│   │  │  │RESULT │  │  │          │
│   │  │  │       │  │  │          │
│   │  └──┼───────┼──┘  │          │
│   │     │       │     │          │
│   └─────┘       └─────┘          │
│                                   │
│   Only the overlap is returned    │
└───────────────────────────────────┘
```

```sql
-- Users who have placed orders:
SELECT u.name, o.id AS order_id, o.status
FROM users u
INNER JOIN orders o ON o.user_id = u.id;
```

Result: Alice (2 orders), Bob (1), Charlie (1), Diana (1). **Eve is missing**
because she has no orders. The INNER JOIN excluded her.

`JOIN` without a qualifier defaults to `INNER JOIN`. You'll see both forms in
the wild.

---

## LEFT JOIN (LEFT OUTER JOIN)

A LEFT JOIN returns **all rows from the left table**, plus matching rows from
the right table. If there's no match, the right side columns are NULL.

```
┌───────────────────────────────────┐
│         LEFT JOIN                 │
│                                   │
│   Table A       Table B           │
│   ┌─────┐       ┌─────┐          │
│   │▓▓▓▓▓│       │     │          │
│   │▓▓┌──┼───────┼──┐  │          │
│   │▓▓│▓▓│       │  │  │          │
│   │▓▓│▓▓│MATCH  │  │  │          │
│   │▓▓│▓▓│       │  │  │          │
│   │▓▓└──┼───────┼──┘  │          │
│   │▓▓▓▓▓│       │     │          │
│   └─────┘       └─────┘          │
│                                   │
│   All of A + matching B           │
│   (shaded = returned)             │
└───────────────────────────────────┘
```

```sql
-- All users, with their orders if they have any:
SELECT u.name, o.id AS order_id, o.status
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;
```

Result: Same as INNER JOIN, **plus Eve with NULL for order_id and status**.
Every user appears, whether they've ordered or not.

This is the most common join type. Use it when you want all records from the
primary table and optional related data.

```sql
-- Find users who have NEVER ordered:
SELECT u.name, u.email
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;
```

This pattern — LEFT JOIN then filter WHERE right.id IS NULL — is a standard
way to find "orphan" records.

---

## RIGHT JOIN (RIGHT OUTER JOIN)

A RIGHT JOIN is the mirror of LEFT JOIN: all rows from the **right** table,
plus matches from the left.

```
┌───────────────────────────────────┐
│         RIGHT JOIN                │
│                                   │
│   Table A       Table B           │
│   ┌─────┐       ┌─────┐          │
│   │     │       │▓▓▓▓▓│          │
│   │  ┌──┼───────┼──┐▓▓│          │
│   │  │  │       │▓▓│▓▓│          │
│   │  │  │MATCH  │▓▓│▓▓│          │
│   │  │  │       │▓▓│▓▓│          │
│   │  └──┼───────┼──┘▓▓│          │
│   │     │       │▓▓▓▓▓│          │
│   └─────┘       └─────┘          │
│                                   │
│   Matching A + all of B           │
│   (shaded = returned)             │
└───────────────────────────────────┘
```

```sql
-- All orders, with user info (even if user was somehow deleted):
SELECT u.name, o.id AS order_id, o.status
FROM users u
RIGHT JOIN orders o ON o.user_id = u.id;
```

In practice, **nobody uses RIGHT JOIN**. You can always rewrite it as a LEFT
JOIN by swapping the table order. LEFT JOIN reads more naturally (primary
table on the left), and consistency makes queries easier to understand.

```sql
-- RIGHT JOIN:
SELECT u.name, o.id FROM users u RIGHT JOIN orders o ON o.user_id = u.id;

-- Equivalent LEFT JOIN (preferred):
SELECT u.name, o.id FROM orders o LEFT JOIN users u ON u.id = o.user_id;
```

---

## FULL OUTER JOIN

A FULL OUTER JOIN returns all rows from **both** tables. Where there's a
match, they're combined. Where there isn't, the missing side is NULL.

```
┌───────────────────────────────────┐
│         FULL OUTER JOIN           │
│                                   │
│   Table A       Table B           │
│   ┌─────┐       ┌─────┐          │
│   │▓▓▓▓▓│       │▓▓▓▓▓│          │
│   │▓▓┌──┼───────┼──┐▓▓│          │
│   │▓▓│▓▓│       │▓▓│▓▓│          │
│   │▓▓│▓▓│MATCH  │▓▓│▓▓│          │
│   │▓▓│▓▓│       │▓▓│▓▓│          │
│   │▓▓└──┼───────┼──┘▓▓│          │
│   │▓▓▓▓▓│       │▓▓▓▓▓│          │
│   └─────┘       └─────┘          │
│                                   │
│   Everything from both tables     │
│   (shaded = returned)             │
└───────────────────────────────────┘
```

```sql
-- All products and all categories, matched where possible:
SELECT p.name AS product, c.name AS category
FROM products p
FULL OUTER JOIN categories c ON p.category_id = c.id;
```

Result: All products appear (including "Organic Coffee" with NULL category).
All categories appear (including "Food" with NULL product). FULL OUTER JOIN
is rare — useful for data reconciliation and finding mismatches between two
datasets.

---

## CROSS JOIN (Cartesian Product)

A CROSS JOIN combines **every row from A with every row from B**. If A has 5
rows and B has 8 rows, the result has 40 rows.

```
┌───────────────────────────────────┐
│         CROSS JOIN                │
│                                   │
│   A has 3 rows, B has 3 rows      │
│   Result: 3 × 3 = 9 rows         │
│                                   │
│   A1-B1  A1-B2  A1-B3             │
│   A2-B1  A2-B2  A2-B3             │
│   A3-B1  A3-B2  A3-B3             │
└───────────────────────────────────┘
```

```sql
-- Every user paired with every product:
SELECT u.name, p.name AS product
FROM users u
CROSS JOIN products p;
-- 5 users × 8 products = 40 rows
```

CROSS JOINs are rarely used intentionally. They're useful for generating
combinations (e.g., all sizes × all colors) or creating test data. Most
accidental cross joins happen when you forget the ON clause:

```sql
-- This is an accidental cross join (no ON clause):
SELECT u.name, o.id
FROM users u, orders o;
-- Returns 5 × 5 = 25 rows instead of the 5 you wanted
```

---

## Self-Joins

A self-join joins a table to itself. This is useful for hierarchical data or
comparing rows within the same table.

```sql
-- Setup: employees with a manager column
DROP TABLE IF EXISTS employees CASCADE;

CREATE TABLE employees (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    manager_id  BIGINT REFERENCES employees(id),
    department  TEXT NOT NULL
);

INSERT INTO employees (name, manager_id, department) VALUES
    ('CEO Sara', NULL, 'executive'),
    ('VP Engineering', 1, 'engineering'),
    ('VP Marketing', 1, 'marketing'),
    ('Senior Dev Alice', 2, 'engineering'),
    ('Senior Dev Bob', 2, 'engineering'),
    ('Junior Dev Charlie', 4, 'engineering'),
    ('Marketing Lead Diana', 3, 'marketing');

-- Who reports to whom?
SELECT
    e.name AS employee,
    m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```

The table appears twice in the query with different aliases (`e` for employee,
`m` for manager). The LEFT JOIN ensures the CEO (who has no manager) still
appears.

```sql
-- Find employees in the same department as their manager:
SELECT
    e.name AS employee,
    m.name AS manager,
    e.department
FROM employees e
JOIN employees m ON e.manager_id = m.id
WHERE e.department = m.department;
```

---

## Joining Multiple Tables

Real queries often join 3, 4, or more tables. Each JOIN adds one more table
to the result.

```sql
-- Full order details: user name, order info, product names and prices
SELECT
    u.name AS customer,
    o.id AS order_id,
    o.status,
    p.name AS product,
    oi.quantity,
    oi.unit_price_cents / 100.0 AS unit_price,
    (oi.quantity * oi.unit_price_cents) / 100.0 AS line_total
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
ORDER BY o.id, p.name;
```

Read this as a chain: Start with orders. Attach user info. Attach line items.
Attach product details.

```sql
-- Order summary with category breakdown:
SELECT
    u.name AS customer,
    o.id AS order_id,
    c.name AS category,
    count(*) AS items_in_category,
    sum(oi.quantity * oi.unit_price_cents) / 100.0 AS category_total
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
LEFT JOIN categories c ON c.id = p.category_id
GROUP BY u.name, o.id, c.name
ORDER BY o.id, category_total DESC;
```

Notice the `LEFT JOIN` on categories — because "Organic Coffee" has no
category, using INNER JOIN would exclude it from the results.

---

## Join Conditions Beyond Equality

Most joins use `=`, but you can join on any condition:

```sql
-- Find products in the same price range (within $10 of each other):
SELECT
    a.name AS product_a,
    b.name AS product_b,
    a.price_cents / 100.0 AS price_a,
    b.price_cents / 100.0 AS price_b
FROM products a
JOIN products b ON a.id < b.id
    AND abs(a.price_cents - b.price_cents) <= 1000;
```

The `a.id < b.id` prevents duplicate pairs (A-B and B-A) and self-matches
(A-A).

---

## Common Join Patterns

### Pattern 1: Aggregate across a join

```sql
-- Total spent per user:
SELECT
    u.name,
    u.email,
    coalesce(sum(oi.quantity * oi.unit_price_cents), 0) / 100.0 AS total_spent
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY u.id, u.name, u.email
ORDER BY total_spent DESC;
```

LEFT JOIN so users with no orders show $0 instead of being excluded.
`coalesce` converts NULL (from no orders) to 0.

### Pattern 2: Find unmatched rows

```sql
-- Products nobody has ordered:
SELECT p.name, p.price_cents / 100.0 AS price
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
WHERE oi.id IS NULL;

-- Categories with no products:
SELECT c.name AS empty_category
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
WHERE p.id IS NULL;
```

### Pattern 3: Existence check with JOIN

```sql
-- Users who have at least one completed order:
SELECT DISTINCT u.name
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.status = 'completed';
```

---

## Join Performance Tips

1. **Always join on indexed columns.** Foreign keys and primary keys are
   indexed. If you join on an unindexed column, the database must scan the
   entire table for every row.

2. **Start with the most filtered table.** The planner usually handles this,
   but putting your most selective WHERE conditions on the first table helps
   readability.

3. **Avoid joining unnecessary tables.** If you don't need columns from a
   table, don't join it. Each join adds work.

4. **Be careful with LEFT JOIN + GROUP BY.** Joining before grouping can
   multiply rows unexpectedly. If a user has 3 orders with 4 items each,
   that's 12 rows per user before aggregation.

---

## Quick Reference: Which Join When?

| Join Type | Use When |
|-----------|----------|
| `INNER JOIN` | You only want rows that exist in both tables |
| `LEFT JOIN` | You want all rows from the left table, even without matches |
| `RIGHT JOIN` | (Don't use — rewrite as LEFT JOIN) |
| `FULL OUTER JOIN` | You need everything from both tables, matched or not |
| `CROSS JOIN` | You need every combination of rows from two tables |
| Self-join | You need to compare or relate rows within the same table |

---

## Exercises

### Exercise 1: Basic joins

1. List all orders with the customer name (INNER JOIN)
2. List all users and their orders, including users with no orders (LEFT JOIN)
3. List all products with their category name, including uncategorized products

### Exercise 2: Multi-table joins

1. Write a query that shows: customer name, order id, product name, quantity,
   and line total for every order item
2. Extend it to include the product's category name
3. Find the total revenue per product category

### Exercise 3: Finding gaps

1. Which users have never placed an order?
2. Which products have never been ordered?
3. Which categories have no products assigned to them?

### Exercise 4: Aggregates with joins

1. For each user, show their name and total number of orders
2. For each user, show their name and total amount spent across all orders
3. Find the top 3 users by total spending
4. For each product, show how many times it has been ordered and the total
   quantity sold

### Exercise 5: Self-join

Using the `employees` table:
1. List every employee with their manager's name
2. Find employees who are in a different department than their manager
3. Find all employees who report directly or indirectly to 'CEO Sara'
   (hint: this is tricky with plain joins — you'll learn a better way with
   recursive CTEs in Lesson 08)

### Exercise 6: Combined challenge

Write a query that produces an "Order Summary Report" showing:
- Order ID
- Customer name and city
- Number of distinct products in the order
- Total quantity of items
- Order total in dollars
- Order status

Sort by order total descending. Include only orders with a total over $50.

---

## Key Takeaways

1. **Normalization splits data across tables.** Joins put it back together.
2. **INNER JOIN** = only matching rows from both sides.
3. **LEFT JOIN** = all from left + matches from right. The most common join.
4. **Don't use RIGHT JOIN.** Rewrite as LEFT JOIN with swapped table order.
5. **FULL OUTER JOIN** = everything from both. Rare but useful for reconciliation.
6. **CROSS JOIN** = every combination. Usually accidental.
7. **Self-joins** let you compare rows within the same table.
8. **Always join on indexed columns.** Primary and foreign keys are indexed by default.
9. **LEFT JOIN + WHERE right.id IS NULL** finds unmatched/orphan rows.

Next: [Lesson 08 — Subqueries, CTEs, and Window Functions](./08-subqueries-ctes-windows.md)
