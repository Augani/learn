# Lesson 02: SQL for Data Engineers

## Beyond SELECT *

If basic SQL is knowing how to drive, data engineering SQL is knowing
how to build and race the car. This lesson covers the SQL that data
engineers actually write every day.

```
  BASIC SQL                    DATA ENGINEERING SQL
  +-------------+              +-------------------+
  | SELECT      |              | Window Functions  |
  | WHERE       |              | CTEs              |
  | JOIN        |   -------->  | Optimization      |
  | GROUP BY    |              | Analytical Queries|
  | ORDER BY    |              | Query Plans       |
  +-------------+              +-------------------+
       Driving                    Racing
```

---

## Common Table Expressions (CTEs)

CTEs are like naming intermediate steps in a recipe. Instead of one
giant nested query, you break it into readable chunks.

Think of it like cooking: instead of saying "put the thing you made
from the other thing into the thing," you name each dish.

```sql
WITH daily_revenue AS (
    SELECT
        date_trunc('day', order_date) AS order_day,
        SUM(amount) AS total_revenue,
        COUNT(DISTINCT user_id) AS unique_buyers
    FROM orders
    WHERE order_date >= '2024-01-01'
    GROUP BY 1
),

rolling_avg AS (
    SELECT
        order_day,
        total_revenue,
        unique_buyers,
        AVG(total_revenue) OVER (
            ORDER BY order_day
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS revenue_7d_avg
    FROM daily_revenue
)

SELECT
    order_day,
    total_revenue,
    revenue_7d_avg,
    total_revenue - revenue_7d_avg AS deviation_from_avg
FROM rolling_avg
ORDER BY order_day;
```

**CTE chaining** lets you build complex analysis step by step:

```sql
WITH raw_events AS (
    SELECT * FROM events WHERE event_date = CURRENT_DATE
),

enriched AS (
    SELECT
        e.*,
        u.segment,
        u.country
    FROM raw_events e
    JOIN users u ON e.user_id = u.id
),

aggregated AS (
    SELECT
        segment,
        country,
        COUNT(*) AS event_count,
        COUNT(DISTINCT user_id) AS unique_users
    FROM enriched
    GROUP BY segment, country
)

SELECT * FROM aggregated WHERE event_count > 100;
```

---

## Window Functions

Window functions are like having a calculator that can see beyond the
current row. Imagine standing in a line: you can see the person ahead
and behind you, not just yourself.

```
  Regular GROUP BY:           Window Function:
  Collapses rows              Keeps all rows, adds context

  +----+-----+               +----+-----+--------+------+
  | dep| avg  |              | id | dep | salary | rank |
  +----+-----+               +----+-----+--------+------+
  | Eng| 95k  |              | 1  | Eng | 100k   |  1   |
  | Mkt| 80k  |              | 2  | Eng | 90k    |  2   |
  +----+-----+               | 3  | Mkt | 85k    |  1   |
                              | 4  | Mkt | 75k    |  2   |
  2 rows                     +----+-----+--------+------+
                              4 rows (nothing lost)
```

### ROW_NUMBER, RANK, DENSE_RANK

```sql
SELECT
    employee_id,
    department,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS rank_num,
    DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dense_num
FROM employees;
```

```
  Salary: 100, 100, 90, 80

  ROW_NUMBER:  1, 2, 3, 4   (always unique)
  RANK:        1, 1, 3, 4   (ties skip)
  DENSE_RANK:  1, 1, 2, 3   (ties don't skip)
```

### LAG and LEAD

Look backward and forward in time:

```sql
SELECT
    order_date,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY order_date) AS prev_day_revenue,
    LEAD(revenue, 1) OVER (ORDER BY order_date) AS next_day_revenue,
    revenue - LAG(revenue, 1) OVER (ORDER BY order_date) AS daily_change
FROM daily_revenue;
```

### Running Totals and Moving Averages

```sql
SELECT
    order_date,
    revenue,
    SUM(revenue) OVER (
        ORDER BY order_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_revenue,
    AVG(revenue) OVER (
        ORDER BY order_date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ) AS moving_avg_30d
FROM daily_revenue;
```

### Frame Specifications

```
  ROWS BETWEEN ... AND ...

  UNBOUNDED PRECEDING  ---+
  3 PRECEDING          ---+--- before current row
  1 PRECEDING          ---+
  CURRENT ROW          ------  the row itself
  1 FOLLOWING          ---+
  3 FOLLOWING          ---+--- after current row
  UNBOUNDED FOLLOWING  ---+

  Example frames:
  +---+---+---+[===]+---+---+---+
                 ^
            CURRENT ROW

  ROWS BETWEEN 2 PRECEDING AND CURRENT ROW:
  +---+[==+===+===]+---+---+---+

  ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING:
  +---+---+[==+===+===]+---+---+

  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW:
  [===+===+===+===]+---+---+---+
```

---

## Analytical Patterns

### Sessionization

Group user events into sessions (30-minute gap = new session):

```sql
WITH events_with_gap AS (
    SELECT
        user_id,
        event_time,
        EXTRACT(EPOCH FROM (
            event_time - LAG(event_time) OVER (
                PARTITION BY user_id ORDER BY event_time
            )
        )) / 60.0 AS minutes_since_last
    FROM user_events
),

session_starts AS (
    SELECT
        *,
        CASE
            WHEN minutes_since_last IS NULL THEN 1
            WHEN minutes_since_last > 30 THEN 1
            ELSE 0
        END AS is_new_session
    FROM events_with_gap
),

sessions AS (
    SELECT
        *,
        SUM(is_new_session) OVER (
            PARTITION BY user_id ORDER BY event_time
        ) AS session_id
    FROM session_starts
)

SELECT
    user_id,
    session_id,
    MIN(event_time) AS session_start,
    MAX(event_time) AS session_end,
    COUNT(*) AS events_in_session
FROM sessions
GROUP BY user_id, session_id;
```

### Funnel Analysis

```sql
WITH funnel AS (
    SELECT
        user_id,
        MAX(CASE WHEN event = 'page_view' THEN 1 ELSE 0 END) AS viewed,
        MAX(CASE WHEN event = 'add_to_cart' THEN 1 ELSE 0 END) AS added,
        MAX(CASE WHEN event = 'checkout' THEN 1 ELSE 0 END) AS checked_out,
        MAX(CASE WHEN event = 'purchase' THEN 1 ELSE 0 END) AS purchased
    FROM events
    WHERE event_date BETWEEN '2024-01-01' AND '2024-01-31'
    GROUP BY user_id
)

SELECT
    COUNT(*) AS total_users,
    SUM(viewed) AS step_1_view,
    SUM(added) AS step_2_cart,
    SUM(checked_out) AS step_3_checkout,
    SUM(purchased) AS step_4_purchase,
    ROUND(100.0 * SUM(added) / NULLIF(SUM(viewed), 0), 1) AS view_to_cart_pct,
    ROUND(100.0 * SUM(purchased) / NULLIF(SUM(viewed), 0), 1) AS view_to_purchase_pct
FROM funnel;
```

### Cohort Retention

```sql
WITH user_cohorts AS (
    SELECT
        user_id,
        DATE_TRUNC('month', MIN(event_date)) AS cohort_month
    FROM events
    GROUP BY user_id
),

activity AS (
    SELECT DISTINCT
        e.user_id,
        c.cohort_month,
        DATE_TRUNC('month', e.event_date) AS activity_month
    FROM events e
    JOIN user_cohorts c ON e.user_id = c.user_id
)

SELECT
    cohort_month,
    COUNT(DISTINCT CASE WHEN activity_month = cohort_month THEN user_id END) AS month_0,
    COUNT(DISTINCT CASE WHEN activity_month = cohort_month + INTERVAL '1 month' THEN user_id END) AS month_1,
    COUNT(DISTINCT CASE WHEN activity_month = cohort_month + INTERVAL '2 months' THEN user_id END) AS month_2,
    COUNT(DISTINCT CASE WHEN activity_month = cohort_month + INTERVAL '3 months' THEN user_id END) AS month_3
FROM activity
GROUP BY cohort_month
ORDER BY cohort_month;
```

---

## Query Optimization

### Reading Execution Plans

```
  EXPLAIN ANALYZE SELECT ...

  +------------------------------------------+
  | Seq Scan on orders                       |  <-- Full table scan (BAD)
  |   Filter: amount > 100                   |
  |   Rows Removed by Filter: 950000         |
  |   Actual time: 245ms                     |
  +------------------------------------------+

  vs.

  +------------------------------------------+
  | Index Scan using idx_amount on orders    |  <-- Uses index (GOOD)
  |   Index Cond: amount > 100               |
  |   Actual time: 2ms                       |
  +------------------------------------------+
```

### Key Optimization Techniques

**1. Use appropriate indexes:**

```sql
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_user_date ON orders(user_id, order_date);
```

**2. Avoid SELECT * :**

```sql
SELECT user_id, order_date, amount
FROM orders
WHERE order_date > '2024-01-01';
```

**3. Push filters early:**

```sql
WITH recent_orders AS (
    SELECT * FROM orders WHERE order_date > '2024-01-01'
)
SELECT u.name, COUNT(*)
FROM recent_orders r
JOIN users u ON r.user_id = u.id
GROUP BY u.name;
```

**4. Use EXISTS instead of IN for large subqueries:**

```sql
SELECT u.name
FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.user_id = u.id
    AND o.amount > 1000
);
```

**5. Partition large tables:**

```sql
CREATE TABLE events (
    event_id BIGINT,
    event_date DATE,
    user_id BIGINT,
    event_type TEXT
) PARTITION BY RANGE (event_date);

CREATE TABLE events_2024_01
    PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

---

## Anti-Patterns to Avoid

```
  +----------------------------+-----------------------------+
  | ANTI-PATTERN               | BETTER APPROACH             |
  +----------------------------+-----------------------------+
  | SELECT DISTINCT on         | Fix the JOIN that causes    |
  | everything                 | duplicates                  |
  +----------------------------+-----------------------------+
  | Correlated subqueries      | Use JOINs or window         |
  | in SELECT                  | functions                   |
  +----------------------------+-----------------------------+
  | ORDER BY in subqueries     | Only ORDER BY in the        |
  |                            | outermost query             |
  +----------------------------+-----------------------------+
  | LIKE '%search%'            | Use full-text search or     |
  |                            | trigram indexes             |
  +----------------------------+-----------------------------+
  | Functions on indexed       | Rewrite to keep index       |
  | columns in WHERE           | column bare                 |
  +----------------------------+-----------------------------+
```

---

## Exercises

1. **Window function practice**: Given a table of daily stock prices
   (date, ticker, close_price), write a query that computes for each
   stock: 7-day moving average, 30-day moving average, and flags days
   where the 7-day crosses above the 30-day.

2. **Sessionization**: Given a table of website events (user_id,
   event_time, page_url), create sessions with a 20-minute inactivity
   gap. Report the average session duration and events per session.

3. **Funnel with timing**: Extend the funnel analysis to include the
   median time between each step. Use PERCENTILE_CONT.

4. **Optimization challenge**: You have a query that takes 45 seconds.
   The EXPLAIN shows a sequential scan on a 50M row table filtered by
   date range and user_id. Write the index and rewritten query to
   bring it under 1 second.

5. **Cohort analysis**: Build a weekly retention cohort for the last
   12 weeks. Output should be a matrix showing what percentage of each
   cohort returned in weeks 1 through 8.

---

[Next: Lesson 03 - ETL vs ELT ->](03-etl-vs-elt.md)
