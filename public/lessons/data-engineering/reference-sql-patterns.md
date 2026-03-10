# Reference: SQL Patterns for Data Engineering

Common SQL patterns you'll use repeatedly when building data pipelines,
transformations, and analytics queries.

---

## Deduplication

```sql
-- Remove exact duplicates
SELECT DISTINCT * FROM raw_events;

-- Keep first occurrence by timestamp (most common pattern)
WITH ranked AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY event_id
            ORDER BY received_at ASC
        ) AS row_num
    FROM raw_events
)
SELECT * FROM ranked WHERE row_num = 1;

-- Keep most recent version of each record
WITH ranked AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY updated_at DESC
        ) AS row_num
    FROM user_snapshots
)
SELECT * FROM ranked WHERE row_num = 1;
```

---

## Slowly Changing Dimensions (SCD Type 2)

```
  Track historical changes to dimension records:

  +--------+--------+--------+------------+------------+--------+
  | user_id| name   | city   | valid_from | valid_to   | active |
  +--------+--------+--------+------------+------------+--------+
  | 1      | Alice  | NYC    | 2023-01-01 | 2023-06-15 | false  |
  | 1      | Alice  | LA     | 2023-06-15 | 9999-12-31 | true   |
  | 2      | Bob    | Chicago| 2023-03-01 | 9999-12-31 | true   |
  +--------+--------+--------+------------+------------+--------+
```

```sql
-- Get current state of all users
SELECT * FROM dim_users WHERE active = true;

-- Get state at a specific point in time
SELECT *
FROM dim_users
WHERE '2023-04-01' BETWEEN valid_from AND valid_to;

-- Create SCD Type 2 with dbt snapshots
-- dbt: snapshots/users_snapshot.sql
{% snapshot users_snapshot %}
{{
    config(
        target_schema='snapshots',
        unique_key='user_id',
        strategy='timestamp',
        updated_at='updated_at',
    )
}}
SELECT * FROM {{ source('app', 'users') }}
{% endsnapshot %}
```

---

## Window Functions for Analytics

```sql
-- Running total
SELECT
    date,
    revenue,
    SUM(revenue) OVER (ORDER BY date) AS cumulative_revenue
FROM daily_revenue;

-- Moving average (7-day)
SELECT
    date,
    revenue,
    AVG(revenue) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7d
FROM daily_revenue;

-- Percent of total
SELECT
    category,
    revenue,
    revenue * 100.0 / SUM(revenue) OVER () AS pct_of_total
FROM category_revenue;

-- Rank within groups
SELECT
    department,
    employee,
    salary,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
FROM employees;

-- Lead/Lag (compare to previous/next row)
SELECT
    date,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY date) AS prev_day_revenue,
    revenue - LAG(revenue, 1) OVER (ORDER BY date) AS day_over_day_change
FROM daily_revenue;

-- First/Last value in a group
SELECT
    user_id,
    event_type,
    event_time,
    FIRST_VALUE(event_type) OVER (
        PARTITION BY user_id ORDER BY event_time
    ) AS first_event,
    LAST_VALUE(event_type) OVER (
        PARTITION BY user_id
        ORDER BY event_time
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS last_event
FROM user_events;
```

---

## Date Spine

Generate a complete series of dates (no gaps).

```sql
-- Generate date spine
WITH RECURSIVE date_spine AS (
    SELECT DATE '2023-01-01' AS date_day
    UNION ALL
    SELECT date_day + INTERVAL '1 day'
    FROM date_spine
    WHERE date_day < DATE '2024-12-31'
)
SELECT date_day FROM date_spine;

-- BigQuery version
SELECT date_day
FROM UNNEST(
    GENERATE_DATE_ARRAY('2023-01-01', '2024-12-31', INTERVAL 1 DAY)
) AS date_day;

-- Join with date spine to fill gaps
SELECT
    ds.date_day,
    COALESCE(m.revenue, 0) AS revenue,
    COALESCE(m.orders, 0) AS orders
FROM date_spine ds
LEFT JOIN daily_metrics m ON ds.date_day = m.metric_date;
```

---

## Sessionization

Group events into sessions based on time gaps.

```sql
WITH time_diffs AS (
    SELECT
        user_id,
        event_time,
        event_type,
        LAG(event_time) OVER (
            PARTITION BY user_id ORDER BY event_time
        ) AS prev_event_time,
        EXTRACT(EPOCH FROM (
            event_time - LAG(event_time) OVER (
                PARTITION BY user_id ORDER BY event_time
            )
        )) / 60.0 AS minutes_since_last
    FROM user_events
),
session_starts AS (
    SELECT *,
        CASE
            WHEN minutes_since_last IS NULL
              OR minutes_since_last > 30
            THEN 1
            ELSE 0
        END AS is_session_start
    FROM time_diffs
),
sessions AS (
    SELECT *,
        SUM(is_session_start) OVER (
            PARTITION BY user_id
            ORDER BY event_time
        ) AS session_id
    FROM session_starts
)
SELECT
    user_id,
    session_id,
    MIN(event_time) AS session_start,
    MAX(event_time) AS session_end,
    COUNT(*) AS event_count,
    EXTRACT(EPOCH FROM (MAX(event_time) - MIN(event_time))) / 60 AS duration_min
FROM sessions
GROUP BY user_id, session_id;
```

---

## Funnel Analysis

```sql
WITH funnel AS (
    SELECT
        user_id,
        MAX(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS step_1_view,
        MAX(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) AS step_2_cart,
        MAX(CASE WHEN event_type = 'checkout' THEN 1 ELSE 0 END) AS step_3_checkout,
        MAX(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END) AS step_4_purchase
    FROM user_events
    WHERE event_date BETWEEN '2024-01-01' AND '2024-01-31'
    GROUP BY user_id
)
SELECT
    SUM(step_1_view) AS viewers,
    SUM(step_2_cart) AS added_to_cart,
    SUM(step_3_checkout) AS checked_out,
    SUM(step_4_purchase) AS purchased,
    ROUND(SUM(step_2_cart)::NUMERIC / NULLIF(SUM(step_1_view), 0) * 100, 1) AS view_to_cart_pct,
    ROUND(SUM(step_3_checkout)::NUMERIC / NULLIF(SUM(step_2_cart), 0) * 100, 1) AS cart_to_checkout_pct,
    ROUND(SUM(step_4_purchase)::NUMERIC / NULLIF(SUM(step_3_checkout), 0) * 100, 1) AS checkout_to_purchase_pct
FROM funnel;
```

---

## Incremental Processing

```sql
-- Only process new/changed rows since last run
-- dbt incremental model pattern:

-- models/fct_events.sql
{{
    config(
        materialized='incremental',
        unique_key='event_id',
        incremental_strategy='merge'
    )
}}

SELECT
    event_id,
    user_id,
    event_type,
    event_time,
    properties
FROM {{ source('raw', 'events') }}

{% if is_incremental() %}
WHERE event_time > (SELECT MAX(event_time) FROM {{ this }})
{% endif %}
```

```sql
-- Manual incremental with watermark
CREATE TABLE processing_watermarks (
    table_name VARCHAR PRIMARY KEY,
    last_processed_at TIMESTAMP NOT NULL
);

-- Process only new rows
INSERT INTO processed_events
SELECT * FROM raw_events
WHERE created_at > (
    SELECT last_processed_at
    FROM processing_watermarks
    WHERE table_name = 'raw_events'
);

-- Update watermark
UPDATE processing_watermarks
SET last_processed_at = (SELECT MAX(created_at) FROM raw_events)
WHERE table_name = 'raw_events';
```

---

## Pivot and Unpivot

```sql
-- Pivot: rows to columns
SELECT
    user_id,
    SUM(CASE WHEN category = 'food' THEN amount ELSE 0 END) AS food_spend,
    SUM(CASE WHEN category = 'electronics' THEN amount ELSE 0 END) AS electronics_spend,
    SUM(CASE WHEN category = 'clothing' THEN amount ELSE 0 END) AS clothing_spend
FROM transactions
GROUP BY user_id;

-- Unpivot: columns to rows (using UNION ALL)
SELECT user_id, 'food' AS category, food_spend AS amount FROM user_spending
UNION ALL
SELECT user_id, 'electronics', electronics_spend FROM user_spending
UNION ALL
SELECT user_id, 'clothing', clothing_spend FROM user_spending;

-- Unpivot (modern SQL with LATERAL)
SELECT u.user_id, x.category, x.amount
FROM user_spending u,
LATERAL (VALUES
    ('food', u.food_spend),
    ('electronics', u.electronics_spend),
    ('clothing', u.clothing_spend)
) AS x(category, amount);
```

---

## Gap and Island Detection

Find continuous ranges and gaps in data.

```sql
-- Identify "islands" (consecutive date ranges)
WITH numbered AS (
    SELECT
        user_id,
        login_date,
        login_date - (ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY login_date
        ))::INT AS grp
    FROM daily_logins
)
SELECT
    user_id,
    MIN(login_date) AS streak_start,
    MAX(login_date) AS streak_end,
    COUNT(*) AS streak_length
FROM numbered
GROUP BY user_id, grp
ORDER BY user_id, streak_start;

-- Find gaps (missing dates)
WITH expected AS (
    SELECT generate_series(
        (SELECT MIN(report_date) FROM daily_reports),
        (SELECT MAX(report_date) FROM daily_reports),
        INTERVAL '1 day'
    )::DATE AS expected_date
)
SELECT expected_date AS missing_date
FROM expected
LEFT JOIN daily_reports ON expected_date = report_date
WHERE report_date IS NULL;
```

---

## Data Quality Checks in SQL

```sql
-- Row count check
SELECT
    CASE
        WHEN COUNT(*) BETWEEN 1000 AND 1000000 THEN 'PASS'
        ELSE 'FAIL: ' || COUNT(*) || ' rows'
    END AS row_count_check
FROM fct_orders
WHERE order_date = CURRENT_DATE - 1;

-- Null rate check
SELECT
    column_name,
    null_count,
    total_count,
    ROUND(null_count * 100.0 / total_count, 2) AS null_pct,
    CASE WHEN null_count * 100.0 / total_count > 5 THEN 'FAIL' ELSE 'PASS' END AS status
FROM (
    SELECT
        'amount' AS column_name,
        SUM(CASE WHEN amount IS NULL THEN 1 ELSE 0 END) AS null_count,
        COUNT(*) AS total_count
    FROM fct_orders
) checks;

-- Freshness check
SELECT
    CASE
        WHEN MAX(created_at) > NOW() - INTERVAL '2 hours' THEN 'FRESH'
        ELSE 'STALE: last record ' || MAX(created_at)::TEXT
    END AS freshness_status
FROM raw_events;

-- Referential integrity
SELECT COUNT(*) AS orphan_orders
FROM fct_orders o
LEFT JOIN dim_users u ON o.user_id = u.user_id
WHERE u.user_id IS NULL;

-- Uniqueness check
SELECT
    CASE
        WHEN COUNT(*) = COUNT(DISTINCT order_id) THEN 'PASS'
        ELSE 'FAIL: ' || (COUNT(*) - COUNT(DISTINCT order_id)) || ' duplicates'
    END AS uniqueness_check
FROM fct_orders;
```

---

## Performance Tips

```
  +--------------------------------------+-----------------------------------+
  | Pattern                              | Why It's Faster                   |
  +--------------------------------------+-----------------------------------+
  | Filter early (WHERE before JOIN)     | Reduces data before expensive ops |
  | Use partition pruning                | Reads less data from disk         |
  | Avoid SELECT * in subqueries         | Reduces data shuffled             |
  | Use approximate functions            | COUNT(DISTINCT) --> APPROX_COUNT  |
  | Materialize CTEs used multiple times | Avoid recomputation               |
  | Pre-aggregate in staging             | Smaller tables for joins          |
  | Use CLUSTER BY / SORT BY             | Better compression and locality   |
  +--------------------------------------+-----------------------------------+
```
