# Lesson 08: Subqueries, CTEs, and Window Functions

Lessons 05-07 gave you the core SQL toolkit: tables, filtering, aggregation,
and joins. This lesson adds the advanced tools. Subqueries let you nest queries.
CTEs let you name and organize them. Window functions let you compute values
across rows without collapsing them. These three features separate people who
"know SQL" from people who use SQL effectively.

---

## Setup: Seed Data

Run this in `psql -d learn_db`:

```sql
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    department  TEXT NOT NULL,
    salary      INTEGER NOT NULL,
    hire_date   DATE NOT NULL
);

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    price_cents INTEGER NOT NULL
);

CREATE TABLE orders (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    total_cents INTEGER NOT NULL,
    ordered_at  DATE NOT NULL
);

INSERT INTO users (name, email, department, salary, hire_date) VALUES
    ('Alice Chen', 'alice@example.com', 'engineering', 120000, '2020-03-15'),
    ('Bob Smith', 'bob@example.com', 'engineering', 105000, '2021-06-01'),
    ('Charlie Park', 'charlie@example.com', 'engineering', 95000, '2022-01-10'),
    ('Diana Ruiz', 'diana@example.com', 'marketing', 90000, '2021-04-20'),
    ('Eve Weber', 'eve@example.com', 'marketing', 85000, '2022-08-15'),
    ('Frank Müller', 'frank@example.com', 'sales', 95000, '2020-11-01'),
    ('Grace Kim', 'grace@example.com', 'sales', 110000, '2019-07-22'),
    ('Hank Brown', 'hank@example.com', 'sales', 88000, '2023-02-14'),
    ('Ivy Tanaka', 'ivy@example.com', 'engineering', 130000, '2019-01-08'),
    ('Jack O''Brien', 'jack@example.com', 'marketing', 92000, '2020-09-30');

INSERT INTO products (name, category, price_cents) VALUES
    ('Laptop', 'electronics', 129900),
    ('Mouse', 'electronics', 2999),
    ('Keyboard', 'electronics', 7999),
    ('Desk', 'furniture', 49999),
    ('Chair', 'furniture', 34999),
    ('Monitor', 'electronics', 39999),
    ('Headphones', 'electronics', 14999),
    ('Notebook', 'stationery', 1299);

INSERT INTO orders (user_id, total_cents, ordered_at) VALUES
    (1, 129900, '2024-01-05'),
    (1, 42998, '2024-01-20'),
    (1, 7999, '2024-02-10'),
    (2, 2999, '2024-01-15'),
    (2, 49999, '2024-03-01'),
    (3, 14999, '2024-02-20'),
    (4, 129900, '2024-01-10'),
    (4, 2999, '2024-02-28'),
    (6, 34999, '2024-01-25'),
    (6, 39999, '2024-02-15'),
    (6, 1299, '2024-03-10'),
    (7, 129900, '2024-01-08'),
    (7, 7999, '2024-02-22'),
    (9, 49999, '2024-01-30'),
    (9, 129900, '2024-03-05');
```

---

## Subqueries in WHERE

A subquery is a query inside another query. The inner query runs first, and
its result feeds into the outer query.

**Analogy:** Think of it like function composition in your code. In Rust:
`process(fetch_data())`. The inner function runs first, its return value
becomes input to the outer function. SQL subqueries work the same way.

### IN — Does This Value Appear in a Set?

```sql
-- Find users who have placed at least one order:
SELECT name, department
FROM users
WHERE id IN (SELECT DISTINCT user_id FROM orders);
```

The inner query produces a list of user IDs: `{1, 2, 3, 4, 6, 7, 9}`.
The outer query finds users whose ID is in that list.

```sql
-- Find users who have NEVER ordered:
SELECT name, department
FROM users
WHERE id NOT IN (SELECT DISTINCT user_id FROM orders);
```

**Warning about NOT IN with NULLs:** If the subquery returns any NULL values,
`NOT IN` returns zero rows (because `x NOT IN (1, 2, NULL)` is always unknown).
This is a common trap. Use `NOT EXISTS` instead for safety:

```sql
-- Safer version of "users who never ordered":
SELECT name, department
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

### Scalar Subqueries — Single Value Results

A scalar subquery returns exactly one row and one column — a single value.
You can use it anywhere you'd use a constant.

```sql
-- Users who earn more than the company average:
SELECT name, salary, department
FROM users
WHERE salary > (SELECT avg(salary) FROM users);

-- The most recent order:
SELECT * FROM orders
WHERE ordered_at = (SELECT max(ordered_at) FROM orders);

-- Users who earn more than the average in their department:
-- (This doesn't work as a simple scalar — we need a correlated subquery)
```

### EXISTS — Does at Least One Row Exist?

EXISTS returns true if the subquery produces any rows at all. It doesn't
care about the values — just whether rows exist.

```sql
-- Users who have placed orders over $1000:
SELECT name, department
FROM users u
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.user_id = u.id AND o.total_cents > 100000
);
```

`SELECT 1` is conventional — the value doesn't matter, only existence does.
Some people write `SELECT *`, which is equivalent but slightly less clear
about intent.

---

## Correlated Subqueries

A correlated subquery references a column from the outer query. It runs once
**per row** of the outer query, not just once total.

**Analogy:** A regular subquery is like computing a constant once and reusing
it. A correlated subquery is like calling a function for each element in a
loop — the function's behavior depends on the current element.

```sql
-- Each user with how much they've spent:
SELECT
    name,
    department,
    salary,
    (SELECT coalesce(sum(total_cents), 0)
     FROM orders o
     WHERE o.user_id = u.id) / 100.0 AS total_spent
FROM users u
ORDER BY total_spent DESC;
```

For each user row, the subquery runs with that user's ID. Ivy's row triggers
`WHERE o.user_id = 9`, Alice's triggers `WHERE o.user_id = 1`, and so on.

```sql
-- Users who earn above their department's average:
SELECT name, department, salary
FROM users u
WHERE salary > (
    SELECT avg(salary)
    FROM users u2
    WHERE u2.department = u.department
);
```

This compares each person's salary against their own department's average —
not the company-wide average. The subquery reruns for each row with a
different department filter.

**Performance note:** Correlated subqueries can be slow because they run once
per row. For large tables, a JOIN or CTE is usually faster and clearer.

---

## Subqueries in FROM (Derived Tables)

You can use a subquery as a table in the FROM clause. The result is called a
derived table.

```sql
-- Average order value per user, then find users above the overall average:
SELECT name, avg_order_value
FROM (
    SELECT
        u.name,
        avg(o.total_cents) / 100.0 AS avg_order_value
    FROM users u
    JOIN orders o ON o.user_id = u.id
    GROUP BY u.name
) AS user_averages
WHERE avg_order_value > (
    SELECT avg(total_cents) / 100.0 FROM orders
)
ORDER BY avg_order_value DESC;
```

The inner query computes each user's average order value. The outer query
filters that result. The `AS user_averages` alias is **required** — PostgreSQL
demands that derived tables have a name.

Derived tables work, but they're hard to read when nested. CTEs are the better
tool for this.

---

## CTEs — Common Table Expressions

A CTE (Common Table Expression) uses `WITH ... AS` to name a query and
reference it later. Think of it as assigning a query to a variable.

**Analogy:** In code, instead of:

```typescript
const result = processData(filterItems(fetchAll()));
```

You'd write:

```typescript
const allItems = fetchAll();
const filtered = filterItems(allItems);
const result = processData(filtered);
```

CTEs do the same for SQL — they break a complex query into named, readable
steps.

### Basic CTE Syntax

```sql
WITH order_totals AS (
    SELECT
        user_id,
        count(*) AS order_count,
        sum(total_cents) / 100.0 AS total_spent
    FROM orders
    GROUP BY user_id
)
SELECT
    u.name,
    u.department,
    ot.order_count,
    ot.total_spent
FROM users u
JOIN order_totals ot ON ot.user_id = u.id
ORDER BY ot.total_spent DESC;
```

The CTE `order_totals` is computed first, then the main query joins against
it. The query reads top to bottom, like well-structured code.

### Multiple CTEs

You can define multiple CTEs, each building on the previous ones:

```sql
WITH
monthly_revenue AS (
    SELECT
        date_trunc('month', ordered_at)::DATE AS month,
        sum(total_cents) / 100.0 AS revenue
    FROM orders
    GROUP BY date_trunc('month', ordered_at)
),
avg_monthly AS (
    SELECT avg(revenue) AS avg_revenue
    FROM monthly_revenue
)
SELECT
    mr.month,
    mr.revenue,
    am.avg_revenue,
    CASE
        WHEN mr.revenue > am.avg_revenue THEN 'above average'
        ELSE 'below average'
    END AS performance
FROM monthly_revenue mr
CROSS JOIN avg_monthly am
ORDER BY mr.month;
```

Step 1 computes monthly revenue. Step 2 computes the average of those months.
Step 3 compares each month against the average. Clean, linear, debuggable.

### CTEs vs Subqueries: When to Use Which

| Feature | Subquery | CTE |
|---------|----------|-----|
| Readability | Nested, hard to follow | Linear, top-to-bottom |
| Reuse | Must repeat if needed twice | Define once, reference multiple times |
| Debugging | Hard to run parts independently | Copy-paste each CTE to test |
| Performance | Sometimes optimized better | Usually identical (PostgreSQL 12+ inlines CTEs) |
| Recursion | Not possible | Supported |

**Rule of thumb:** Use CTEs. They're almost always clearer. Use subqueries
only for simple, one-off conditions in WHERE (like `IN (SELECT ...)`).

---

## Recursive CTEs

A recursive CTE references itself to process hierarchical or graph-shaped
data. It has two parts:

1. **Base case** — the starting rows
2. **Recursive case** — how to generate the next level by referencing the CTE itself

**Analogy:** It's exactly like a recursive function. You have a base case
that stops the recursion and a recursive case that builds on the previous
level.

```sql
-- Organizational hierarchy: who reports to whom, and at what level?
DROP TABLE IF EXISTS employees CASCADE;

CREATE TABLE employees (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    manager_id  BIGINT REFERENCES employees(id)
);

INSERT INTO employees (name, manager_id) VALUES
    ('CEO Sara', NULL),
    ('VP Engineering', 1),
    ('VP Marketing', 1),
    ('Senior Dev Alice', 2),
    ('Senior Dev Bob', 2),
    ('Junior Dev Charlie', 4),
    ('Marketing Lead Diana', 3);

-- Walk the entire hierarchy:
WITH RECURSIVE org_chart AS (
    -- Base case: the CEO (no manager)
    SELECT id, name, manager_id, 0 AS level, name AS path
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive case: find people who report to someone already in our result
    SELECT e.id, e.name, e.manager_id, oc.level + 1, oc.path || ' > ' || e.name
    FROM employees e
    JOIN org_chart oc ON e.manager_id = oc.id
)
SELECT level, repeat('  ', level) || name AS org_tree, path
FROM org_chart
ORDER BY path;
```

Output:

```
 level |          org_tree          |                    path
-------+----------------------------+-------------------------------------------
     0 | CEO Sara                   | CEO Sara
     1 |   VP Engineering           | CEO Sara > VP Engineering
     2 |     Senior Dev Alice       | CEO Sara > VP Engineering > Senior Dev Alice
     3 |       Junior Dev Charlie   | CEO Sara > VP Engineering > Senior Dev Alice > Junior Dev Charlie
     2 |     Senior Dev Bob         | CEO Sara > VP Engineering > Senior Dev Bob
     1 |   VP Marketing             | CEO Sara > VP Marketing
     2 |     Marketing Lead Diana   | CEO Sara > VP Marketing > Marketing Lead Diana
```

The recursion proceeds level by level: first the CEO (level 0), then her
direct reports (level 1), then their reports (level 2), and so on until no
more matches exist.

```sql
-- Generate a series of dates (another common use):
WITH RECURSIVE date_series AS (
    SELECT '2024-01-01'::DATE AS day
    UNION ALL
    SELECT day + 1 FROM date_series WHERE day < '2024-01-10'
)
SELECT day FROM date_series;
```

PostgreSQL also has `generate_series()` for this, but recursive CTEs work in
all SQL databases.

---

## Window Functions

Window functions compute a value for each row based on a "window" of related
rows — without collapsing the rows like GROUP BY does.

**Analogy:** GROUP BY is like summarizing a class into a single grade
(average). Window functions are like writing each student's rank on their
individual paper — every paper still exists, but now it shows rank #3 of 30.

### The Key Difference: GROUP BY vs Window

```sql
-- GROUP BY: one row per department
SELECT department, avg(salary) AS avg_salary
FROM users
GROUP BY department;

-- Window function: every row, WITH the department average alongside
SELECT
    name,
    department,
    salary,
    avg(salary) OVER (PARTITION BY department) AS dept_avg_salary
FROM users;
```

GROUP BY collapses 10 rows into 3 (one per department). The window function
keeps all 10 rows and adds a column showing each person's department average.

### OVER — The Window Specification

Every window function uses `OVER(...)` to define which rows to look at:

- `OVER ()` — the entire result set
- `OVER (PARTITION BY column)` — rows sharing the same value
- `OVER (ORDER BY column)` — ordered within the window
- `OVER (PARTITION BY x ORDER BY y)` — partitioned AND ordered

```sql
-- Company-wide average alongside each row:
SELECT name, salary, avg(salary) OVER () AS company_avg
FROM users;

-- Department average alongside each row:
SELECT name, department, salary, avg(salary) OVER (PARTITION BY department) AS dept_avg
FROM users;
```

### ROW_NUMBER, RANK, DENSE_RANK

These assign a position to each row within its window.

```sql
SELECT
    name,
    department,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num,
    RANK()       OVER (PARTITION BY department ORDER BY salary DESC) AS rank,
    DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dense_rank
FROM users;
```

The difference shows up when values tie:

```
 name    | department  | salary | row_num | rank | dense_rank
---------|-------------|--------|---------|------|----------
 Ivy     | engineering | 130000 |       1 |    1 |          1
 Alice   | engineering | 120000 |       2 |    2 |          2
 Bob     | engineering | 105000 |       3 |    3 |          3
 Charlie | engineering |  95000 |       4 |    4 |          4
 Jack    | marketing   |  92000 |       1 |    1 |          1
 Diana   | marketing   |  90000 |       2 |    2 |          2
 Eve     | marketing   |  85000 |       3 |    3 |          3
 Grace   | sales       | 110000 |       1 |    1 |          1
 Frank   | sales       |  95000 |       2 |    2 |          2
 Hank    | sales       |  88000 |       3 |    3 |          3
```

If two people had the same salary:
- **ROW_NUMBER** assigns arbitrary but unique numbers: 1, 2, 3
- **RANK** gives ties the same rank and skips: 1, 1, 3 (no 2)
- **DENSE_RANK** gives ties the same rank without skipping: 1, 1, 2

**Common pattern: top-N per group:**

```sql
-- Highest paid person in each department:
WITH ranked AS (
    SELECT
        name,
        department,
        salary,
        ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn
    FROM users
)
SELECT name, department, salary
FROM ranked
WHERE rn = 1;
```

This is the standard way to get "top 1 per group" in SQL. You can't do it
with plain GROUP BY because you need the name (a non-grouped column).

### LAG and LEAD — Previous and Next Rows

LAG looks at the previous row. LEAD looks at the next row. Both within the
window's ordering.

```sql
-- Each order with the previous order's amount (for the same user):
SELECT
    u.name,
    o.ordered_at,
    o.total_cents / 100.0 AS amount,
    LAG(o.total_cents / 100.0) OVER (
        PARTITION BY o.user_id ORDER BY o.ordered_at
    ) AS prev_amount,
    LEAD(o.total_cents / 100.0) OVER (
        PARTITION BY o.user_id ORDER BY o.ordered_at
    ) AS next_amount
FROM orders o
JOIN users u ON u.id = o.user_id
ORDER BY u.name, o.ordered_at;
```

LAG returns NULL for the first row (no previous). LEAD returns NULL for the
last row (no next). You can provide a default:

```sql
LAG(total_cents, 1, 0) OVER (...)  -- default to 0 instead of NULL
```

The second argument is the offset (1 = one row back, 2 = two rows back).

### Running Totals with SUM OVER

```sql
-- Running total of spending per user:
SELECT
    u.name,
    o.ordered_at,
    o.total_cents / 100.0 AS amount,
    SUM(o.total_cents) OVER (
        PARTITION BY o.user_id ORDER BY o.ordered_at
    ) / 100.0 AS running_total
FROM orders o
JOIN users u ON u.id = o.user_id
ORDER BY u.name, o.ordered_at;
```

When you add `ORDER BY` inside `OVER()` with an aggregate like SUM, it becomes
a cumulative aggregate — it sums from the first row up to the current row.

```sql
-- Company-wide running total by date:
SELECT
    ordered_at,
    total_cents / 100.0 AS amount,
    SUM(total_cents) OVER (ORDER BY ordered_at) / 100.0 AS running_total
FROM orders
ORDER BY ordered_at;
```

### Moving Averages with AVG OVER

```sql
-- 3-order moving average per user:
SELECT
    u.name,
    o.ordered_at,
    o.total_cents / 100.0 AS amount,
    ROUND(AVG(o.total_cents) OVER (
        PARTITION BY o.user_id
        ORDER BY o.ordered_at
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) / 100.0, 2) AS moving_avg_3
FROM orders o
JOIN users u ON u.id = o.user_id
ORDER BY u.name, o.ordered_at;
```

`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` defines the window frame — the
current row plus the 2 rows before it. This is how you compute sliding window
statistics.

### Percentage of Total

```sql
-- Each user's spending as a percentage of total revenue:
SELECT
    u.name,
    SUM(o.total_cents) / 100.0 AS total_spent,
    ROUND(
        SUM(o.total_cents) * 100.0 / SUM(SUM(o.total_cents)) OVER (),
        1
    ) AS pct_of_total
FROM orders o
JOIN users u ON u.id = o.user_id
GROUP BY u.name
ORDER BY total_spent DESC;
```

`SUM(SUM(o.total_cents)) OVER ()` — the inner SUM is the GROUP BY aggregate
(per user), the outer SUM OVER() is a window function summing all groups
(grand total). This layering is powerful but takes time to internalize.

### Named Windows

If you use the same window definition multiple times, name it:

```sql
SELECT
    name,
    department,
    salary,
    ROW_NUMBER() OVER w AS row_num,
    RANK() OVER w AS rank,
    salary - LAG(salary) OVER w AS diff_from_prev
FROM users
WINDOW w AS (PARTITION BY department ORDER BY salary DESC)
ORDER BY department, salary DESC;
```

The `WINDOW w AS (...)` clause defines the window once. Each function
references it with `OVER w`. Cleaner and less error-prone than repeating the
definition.

---

## Putting It All Together

Here's a real-world analytics query combining CTEs, joins, and window
functions:

```sql
WITH
user_orders AS (
    SELECT
        u.id AS user_id,
        u.name,
        u.department,
        o.ordered_at,
        o.total_cents,
        ROW_NUMBER() OVER (
            PARTITION BY u.id ORDER BY o.ordered_at
        ) AS order_sequence,
        SUM(o.total_cents) OVER (
            PARTITION BY u.id ORDER BY o.ordered_at
        ) AS running_total
    FROM users u
    JOIN orders o ON o.user_id = u.id
),
user_summary AS (
    SELECT
        user_id,
        name,
        department,
        count(*) AS total_orders,
        sum(total_cents) / 100.0 AS total_spent,
        round(avg(total_cents) / 100.0, 2) AS avg_order_value,
        min(ordered_at) AS first_order,
        max(ordered_at) AS last_order
    FROM user_orders
    GROUP BY user_id, name, department
)
SELECT
    name,
    department,
    total_orders,
    total_spent,
    avg_order_value,
    first_order,
    last_order,
    last_order - first_order AS days_as_customer,
    RANK() OVER (ORDER BY total_spent DESC) AS spending_rank
FROM user_summary
ORDER BY spending_rank;
```

This builds in stages:
1. **user_orders** — all orders enriched with sequence numbers and running totals
2. **user_summary** — one row per user with aggregate stats
3. **Final SELECT** — adds a company-wide spending rank

Each CTE is testable independently. Copy any `WITH ... AS` block, remove the
rest, and run it to verify intermediate results.

---

## Exercises

### Exercise 1: Subqueries

1. Find all users who earn more than the average salary
2. Find products that cost more than the average product in their category
   (correlated subquery)
3. Find users who have ordered every product in the 'electronics' category
   (hint: compare count of their distinct electronics orders to total
   electronics products)

### Exercise 2: CTEs

1. Rewrite exercise 1.1 using a CTE instead of a subquery
2. Write a CTE that computes each department's total salary, then find
   departments spending above the company average
3. Using the employees table, write a recursive CTE to show the full
   management chain for 'Junior Dev Charlie' (from Charlie up to the CEO)

### Exercise 3: Window functions — Ranking

1. Rank all users by salary within their department
2. Find the second-highest paid person in each department
3. Assign a company-wide salary percentile to each user (hint: use
   `PERCENT_RANK()`)

### Exercise 4: Window functions — LAG/LEAD

1. For each user's orders, show the time gap (in days) between consecutive
   orders
2. For each order, show whether it was larger or smaller than the user's
   previous order
3. Find users whose most recent order was smaller than their first order
   (declining spending)

### Exercise 5: Running totals and averages

1. Compute a running total of all orders by date
2. Compute a 3-order moving average of order amounts (company-wide, ordered
   by date)
3. For each user, compute their cumulative spending and show what percentage
   of their total it represents at each order

### Exercise 6: Combined challenge

Build a "Department Performance Dashboard" query that shows for each department:
- Number of employees
- Total salary budget
- Average salary
- Highest salary
- Number of employees who have placed orders
- Total revenue from that department's employees
- Rank of the department by revenue

Use CTEs to break it into logical steps.

---

## Key Takeaways

1. **Subqueries** nest queries inside queries. Use `IN`, `EXISTS`, or scalar
   subqueries in WHERE. Use derived tables in FROM.
2. **Beware `NOT IN` with NULLs.** Use `NOT EXISTS` instead for safety.
3. **Correlated subqueries** run once per row. They're powerful but can be slow.
4. **CTEs (`WITH ... AS`)** are named, reusable query steps. Prefer them over
   nested subqueries for readability and debugging.
5. **Recursive CTEs** handle hierarchical data (org charts, trees, graphs).
6. **Window functions** compute values across rows WITHOUT collapsing them.
   GROUP BY collapses; window functions don't.
7. **ROW_NUMBER** for unique ranking, **RANK** for ties with gaps,
   **DENSE_RANK** for ties without gaps.
8. **LAG/LEAD** access previous/next rows for comparisons and deltas.
9. **SUM/AVG OVER (ORDER BY ...)** creates running totals and moving averages.
10. **Named windows** (`WINDOW w AS ...`) reduce duplication when multiple
    functions share the same window definition.

Next: [Lesson 09 — Schema Design and Normalization](./09-schema-design.md)
